"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CashSessionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const client_1 = require("@prisma/client");
const decimal_1 = require("../../common/decimal");
let CashSessionsService = class CashSessionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    getOpenByRegister(registerId) {
        return this.prisma.cashSession.findFirst({
            where: { registerId, status: client_1.CashSessionStatus.OPEN },
            orderBy: { openedAt: "desc" },
        });
    }
    async open(input) {
        const reg = await this.prisma.register.findUnique({ where: { id: input.registerId } });
        if (!reg || !reg.active)
            throw new common_1.NotFoundException("Caja no existe o está inactiva.");
        const openExisting = await this.getOpenByRegister(input.registerId);
        if (openExisting)
            throw new common_1.BadRequestException("Esa caja ya tiene una sesión abierta.");
        return this.prisma.cashSession.create({
            data: {
                registerId: input.registerId,
                openingAmount: (0, decimal_1.dec)(input.openingAmount),
                note: input.note,
                openedById: input.openedById,
            },
        });
    }
    async close(id, closingAmount, note) {
        const sess = await this.prisma.cashSession.findUnique({ where: { id } });
        if (!sess)
            throw new common_1.NotFoundException("Sesión no encontrada.");
        if (sess.status === client_1.CashSessionStatus.CLOSED)
            throw new common_1.BadRequestException("Ya está cerrada.");
        return this.prisma.cashSession.update({
            where: { id },
            data: {
                status: client_1.CashSessionStatus.CLOSED,
                closedAt: new Date(),
                closingAmount: (0, decimal_1.dec)(closingAmount),
                note,
            },
        });
    }
};
exports.CashSessionsService = CashSessionsService;
exports.CashSessionsService = CashSessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CashSessionsService);
//# sourceMappingURL=cash-sessions.service.js.map