import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CashSessionStatus } from "@prisma/client";
import { dec } from "../../common/decimal";

@Injectable()
export class CashSessionsService {
  constructor(private prisma: PrismaService) {}

  getOpenByRegister(registerId: string) {
    return this.prisma.cashSession.findFirst({
      where: { registerId, status: CashSessionStatus.OPEN },
      orderBy: { openedAt: "desc" },
    });
  }

  async open(input: { registerId: string; openingAmount: string; note?: string; openedById: string }) {
    const reg = await this.prisma.register.findUnique({ where: { id: input.registerId } });
    if (!reg || !reg.active) throw new NotFoundException("Caja no existe o está inactiva.");

    const openExisting = await this.getOpenByRegister(input.registerId);
    if (openExisting) throw new BadRequestException("Esa caja ya tiene una sesión abierta.");

    return this.prisma.cashSession.create({
      data: {
        registerId: input.registerId,
        openingAmount: dec(input.openingAmount) as any,
        note: input.note,
        openedById: input.openedById,
      },
    });
  }

  async close(id: string, closingAmount: string, note?: string) {
    const sess = await this.prisma.cashSession.findUnique({ where: { id } });
    if (!sess) throw new NotFoundException("Sesión no encontrada.");
    if (sess.status === CashSessionStatus.CLOSED) throw new BadRequestException("Ya está cerrada.");

    return this.prisma.cashSession.update({
      where: { id },
      data: {
        status: CashSessionStatus.CLOSED,
        closedAt: new Date(),
        closingAmount: dec(closingAmount) as any,
        note,
      },
    });
  }
}
