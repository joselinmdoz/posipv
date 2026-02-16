import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  list() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(dto: { email: string; password: string; role: 'ADMIN' | 'CASHIER' }) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role as any,
      },
      select: { id: true, email: true, role: true, active: true, createdAt: true },
    });
  }

  update(id: string, dto: Partial<{ email: string; role: 'ADMIN' | 'CASHIER'; active: boolean }>) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: { id: true, email: true, role: true, active: true, createdAt: true },
    });
  }

  async resetPassword(id: string, dto: { password: string }) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }
}
