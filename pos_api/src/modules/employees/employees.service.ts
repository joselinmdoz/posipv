import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";

type ListEmployeesInput = {
  q?: string;
  active?: string;
  limit?: string;
};

type CreateEmployeeInput = {
  firstName: string;
  lastName: string;
  identification?: string;
  phone?: string;
  email?: string;
  position?: string;
  image?: string;
  hireDate?: string;
  salary?: string;
  notes?: string;
  active?: boolean | string;
  userId?: string;
};

type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: ListEmployeesInput) {
    const q = this.normalize(input.q);
    const activeFilter = this.parseActive(input.active);
    const limit = this.parseLimit(input.limit);

    const rows = await this.prisma.employee.findMany({
      where: {
        ...(activeFilter === null ? {} : { active: activeFilter }),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
                { identification: { contains: q, mode: "insensitive" } },
                { phone: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
                { position: { contains: q, mode: "insensitive" } },
                { user: { email: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: limit,
    });

    return rows.map((row) => ({
      ...row,
      salary: row.salary ? Number(row.salary.toFixed(2)) : null,
    }));
  }

  async findOne(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException("Empleado no encontrado.");
    }

    return {
      ...employee,
      salary: employee.salary ? Number(employee.salary.toFixed(2)) : null,
    };
  }

  async create(input: CreateEmployeeInput) {
    const data = await this.buildMutationData(input);

    try {
      const created = await this.prisma.employee.create({
        data: data as Prisma.EmployeeUncheckedCreateInput,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              active: true,
            },
          },
        },
      });

      return {
        ...created,
        salary: created.salary ? Number(created.salary.toFixed(2)) : null,
      };
    } catch (error) {
      this.handleMutationError(error, "No se pudo crear el empleado.");
    }
  }

  async update(employeeId: string, input: UpdateEmployeeInput) {
    await this.findOne(employeeId);
    const data = await this.buildMutationData(input, employeeId, true);

    if (Object.keys(data).length === 0) {
      return this.findOne(employeeId);
    }

    try {
      const updated = await this.prisma.employee.update({
        where: { id: employeeId },
        data: data as Prisma.EmployeeUncheckedUpdateInput,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              role: true,
              active: true,
            },
          },
        },
      });

      return {
        ...updated,
        salary: updated.salary ? Number(updated.salary.toFixed(2)) : null,
      };
    } catch (error) {
      this.handleMutationError(error, "No se pudo actualizar el empleado.");
    }
  }

  async listAssignableUsers(employeeId?: string) {
    const excludeId = this.normalize(employeeId);
    const employees = await this.prisma.employee.findMany({
      where: {
        userId: { not: null },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: {
        userId: true,
      },
    });

    const usedUserIds = employees
      .map((row) => row.userId)
      .filter((id): id is string => !!id);

    return this.prisma.user.findMany({
      where: {
        active: true,
        ...(usedUserIds.length ? { id: { notIn: usedUserIds } } : {}),
      },
      orderBy: [{ email: "asc" }],
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
      },
    });
  }

  private async buildMutationData(input: UpdateEmployeeInput, employeeId?: string, partial = false) {
    const data: Record<string, unknown> = {};

    if (!partial || input.firstName !== undefined) {
      if (input.firstName === undefined) throw new BadRequestException("Nombre requerido.");
      data.firstName = this.normalizeRequired(input.firstName, "Nombre requerido.");
    }

    if (!partial || input.lastName !== undefined) {
      if (input.lastName === undefined) throw new BadRequestException("Apellidos requeridos.");
      data.lastName = this.normalizeRequired(input.lastName, "Apellidos requeridos.");
    }

    if (input.identification !== undefined) data.identification = this.normalize(input.identification);
    if (input.phone !== undefined) data.phone = this.normalize(input.phone);
    if (input.email !== undefined) data.email = this.normalize(input.email);
    if (input.position !== undefined) data.position = this.normalize(input.position);
    if (input.image !== undefined) data.image = this.normalize(input.image);
    if (input.notes !== undefined) data.notes = this.normalize(input.notes);
    if (input.active !== undefined) data.active = this.parseBoolean(input.active);

    if (input.hireDate !== undefined) {
      data.hireDate = this.parseDate(input.hireDate);
    }

    if (input.salary !== undefined) {
      data.salary = this.parseSalary(input.salary) as any;
    }

    if (input.userId !== undefined) {
      const normalizedUserId = this.normalize(input.userId);
      if (normalizedUserId) {
        await this.ensureUserAvailable(normalizedUserId, employeeId);
        data.userId = normalizedUserId;
      } else {
        data.userId = null;
      }
    }

    return data;
  }

  private async ensureUserAvailable(userId: string, employeeId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new BadRequestException("Usuario vinculado inválido.");

    const linked = await this.prisma.employee.findFirst({
      where: {
        userId,
        ...(employeeId ? { id: { not: employeeId } } : {}),
      },
      select: { id: true },
    });
    if (linked) {
      throw new ConflictException("El usuario seleccionado ya está vinculado a otro empleado.");
    }
  }

  private parseDate(value?: string | null): Date | null {
    const normalized = this.normalize(value);
    if (!normalized) return null;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException("Fecha de contratación inválida.");
    }
    return date;
  }

  private parseSalary(value?: string | null): Prisma.Decimal | null {
    const normalized = this.normalize(value);
    if (!normalized) return null;
    try {
      const amount = dec(normalized);
      if (!amount.isFinite() || amount.lt(0)) {
        throw new BadRequestException("Salario inválido.");
      }
      return dec(amount.toFixed(2));
    } catch {
      throw new BadRequestException("Salario inválido.");
    }
  }

  private parseBoolean(value: boolean | string): boolean {
    if (typeof value === "boolean") return value;
    const normalized = String(value || "").trim().toLowerCase();
    if (["true", "1", "yes", "si"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
    throw new BadRequestException("Valor booleano inválido.");
  }

  private handleMutationError(error: unknown, fallbackMessage: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException("Ya existe un empleado con la identificación o usuario indicado.");
    }
    throw new BadRequestException(fallbackMessage);
  }

  private normalize(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeRequired(value: string | undefined, message: string): string {
    const normalized = this.normalize(value);
    if (!normalized) throw new BadRequestException(message);
    return normalized;
  }

  private parseActive(value?: string): boolean | null {
    if (value === undefined || value === null || value === "") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new BadRequestException("Parámetro active inválido. Use true o false.");
  }

  private parseLimit(value?: string): number {
    if (!value) return 200;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException("Parámetro limit inválido.");
    }
    return Math.min(500, Math.floor(parsed));
  }
}
