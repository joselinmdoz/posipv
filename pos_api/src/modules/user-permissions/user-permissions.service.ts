import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { PERMISSION_CATALOG } from "./user-permissions.catalog";

type ListUsersInput = {
  q?: string;
  active?: string;
  limit?: string;
};

@Injectable()
export class UserPermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  getCatalog() {
    return PERMISSION_CATALOG;
  }

  async listUsers(input: ListUsersInput) {
    const q = this.normalize(input.q);
    const activeFilter = this.parseActive(input.active);
    const limit = this.parseLimit(input.limit);

    return this.prisma.user.findMany({
      where: {
        ...(activeFilter === null ? {} : { active: activeFilter }),
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ email: "asc" }],
      take: limit,
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        permissions: true,
        createdAt: true,
      },
    });
  }

  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        permissions: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado.");
    }

    return user;
  }

  async updateUserPermissions(userId: string, permissionsInput: string[]) {
    await this.getUser(userId);
    const permissions = this.normalizePermissions(permissionsInput);

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        permissions,
      },
      select: {
        id: true,
        email: true,
        role: true,
        active: true,
        permissions: true,
        createdAt: true,
      },
    });
  }

  private normalize(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
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

  private normalizePermissions(input: string[]) {
    if (!Array.isArray(input)) {
      throw new BadRequestException("Lista de permisos inválida.");
    }

    const allowedCodes = new Set(PERMISSION_CATALOG.map((item) => item.code));
    const normalized = Array.from(
      new Set(
        input
          .map((code) => (code || "").toString().trim())
          .filter((code) => !!code),
      ),
    );

    const invalid = normalized.filter((code) => !allowedCodes.has(code));
    if (invalid.length > 0) {
      throw new BadRequestException(`Permisos inválidos: ${invalid.join(", ")}`);
    }

    return normalized.sort((a, b) => a.localeCompare(b));
  }
}
