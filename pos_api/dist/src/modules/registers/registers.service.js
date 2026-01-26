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
exports.RegistersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const decimal_1 = require("../../common/decimal");
let RegistersService = class RegistersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    listActive() {
        return this.prisma.register.findMany({
            where: { active: true },
            orderBy: { name: "asc" },
        });
    }
    async create(dto) {
        const data = { name: dto.name };
        if (dto.code) {
            data.code = dto.code;
        }
        const register = await this.prisma.register.create({ data });
        const warehouse = await this.prisma.warehouse.create({
            data: {
                name: `Almacén ${dto.name}`,
                code: `WH_${register.id}`,
                type: 'TPV',
                registerId: register.id,
            },
        });
        await this.prisma.registerSettings.upsert({
            where: { registerId: register.id },
            update: { warehouseId: warehouse.id },
            create: {
                registerId: register.id,
                warehouseId: warehouse.id,
                defaultOpeningFloat: (0, decimal_1.dec)('0'),
                currency: 'CUP',
            },
        });
        return register;
    }
    async update(id, dto) {
        const data = { name: dto.name };
        if (dto.code) {
            data.code = dto.code;
        }
        return this.prisma.register.update({
            where: { id },
            data,
        });
    }
    async delete(id) {
        await this.prisma.warehouse.deleteMany({
            where: { registerId: id },
        });
        await this.prisma.registerSettings.deleteMany({
            where: { registerId: id },
        });
        return this.prisma.register.delete({
            where: { id },
        });
    }
};
exports.RegistersService = RegistersService;
exports.RegistersService = RegistersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RegistersService);
//# sourceMappingURL=registers.service.js.map