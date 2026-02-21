import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IPVType } from '@prisma/client';

@Injectable()
export class InventoryReportsService {
  constructor(private prisma: PrismaService) {}

  async createInitial(cashSessionId: string, warehouseId: string) {
    // Get current stock for the warehouse
    const stock = await this.prisma.stock.findMany({
      where: { warehouseId },
      include: { product: true },
    });

    // Calculate total value
    let totalValue = 0;
    const items = stock.map((s) => {
      const total = Number(s.product.price) * s.qty;
      totalValue += total;
      return {
        productId: s.productId,
        qty: s.qty,
        price: s.product.price,
        total,
      };
    });

    // Create the inventory report
    const report = await this.prisma.inventoryReport.create({
      data: {
        type: 'INITIAL',
        cashSessionId,
        warehouseId,
        totalValue,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            price: item.price,
            total: item.total,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
        cashSession: true,
      },
    });

    return report;
  }

  async createFinal(cashSessionId: string, warehouseId: string) {
    // Get current stock for the warehouse
    const stock = await this.prisma.stock.findMany({
      where: { warehouseId },
      include: { product: true },
    });

    // Calculate total value
    let totalValue = 0;
    const items = stock.map((s) => {
      const total = Number(s.product.price) * s.qty;
      totalValue += total;
      return {
        productId: s.productId,
        qty: s.qty,
        price: s.product.price,
        total,
      };
    });

    // Create the inventory report
    const report = await this.prisma.inventoryReport.create({
      data: {
        type: 'FINAL',
        cashSessionId,
        warehouseId,
        totalValue,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            price: item.price,
            total: item.total,
          })),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
        cashSession: true,
      },
    });

    return report;
  }

  async findBySession(cashSessionId: string) {
    return this.prisma.inventoryReport.findMany({
      where: { cashSessionId },
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByWarehouse(warehouseId: string, startDate?: Date, endDate?: Date) {
    const where: any = { warehouseId };
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    return this.prisma.inventoryReport.findMany({
      where,
      include: {
        items: {
          include: { product: true },
        },
        cashSession: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.inventoryReport.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
        cashSession: {
          include: {
            openedBy: true,
            register: true,
          },
        },
      },
    });
  }

  async getLatestBySession(cashSessionId: string, type?: IPVType) {
    const where: any = { cashSessionId };
    if (type) where.type = type;

    return this.prisma.inventoryReport.findFirst({
      where,
      include: {
        items: {
          include: { product: true },
        },
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
