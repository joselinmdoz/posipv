import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CashSessionStatus, IPVType, InventoryReport, PaymentMethod, Prisma, SaleStatus } from '@prisma/client';
import { dec } from '../../common/decimal';
import { InventoryCostingService } from '../inventory-costing/inventory-costing.service';

type ManualIvpLineInput = {
  productId: string;
  initial: number;
  entries: number;
  outs: number;
  sales: number;
};

type SaveManualIvpInput = {
  id?: string;
  registerId: string;
  reportDate: string;
  note?: string;
  employeeIds?: string[];
  paymentBreakdown?: Record<string, number>;
  lines: ManualIvpLineInput[];
  createdById?: string;
};

@Injectable()
export class InventoryReportsService {
  constructor(
    private prisma: PrismaService,
    private readonly inventoryCostingService: InventoryCostingService,
  ) {}

  async createInitial(cashSessionId: string, warehouseId: string) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    if (session.register.warehouse!.id !== warehouseId) {
      throw new BadRequestException('El almacén no corresponde con la sesión.');
    }
    return this.ensureInitialReportForSession(cashSessionId);
  }

  async createFinal(cashSessionId: string, warehouseId: string) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    if (session.register.warehouse!.id !== warehouseId) {
      throw new BadRequestException('El almacén no corresponde con la sesión.');
    }
    throw new BadRequestException(
      'Ahora existe un solo IPV por sesión. Se crea al abrir caja y se cierra al cerrar la sesión.',
    );
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

  async listManualReports(filters: {
    registerId?: string;
    warehouseId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};
    if (filters.registerId) where.registerId = filters.registerId;
    if (filters.warehouseId) where.warehouseId = filters.warehouseId;
    if (filters.startDate || filters.endDate) {
      where.reportDate = {};
      if (filters.startDate) where.reportDate.gte = filters.startDate;
      if (filters.endDate) where.reportDate.lte = filters.endDate;
    }

    const reports = await this.prisma.manualIvpReport.findMany({
      where,
      include: {
        register: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        lines: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                codigo: true,
                currency: true,
                cost: true,
                allowFractionalQty: true,
              },
            },
          },
        },
      },
      orderBy: { reportDate: 'desc' },
    });

    return reports.map((report) => {
      const lines = report.lines.map((line) => ({
        productId: line.productId,
        codigo: line.product?.codigo || '',
        name: line.product?.name || `Producto ${line.productId.slice(0, 8)}`,
        currency: line.product?.currency || 'CUP',
        allowFractionalQty: line.product?.allowFractionalQty === true,
        price: Number(line.price || 0),
        initial: Number(line.initialQty || 0),
        entries: Number(line.entriesQty || 0),
        outs: Number(line.outsQty || 0),
        sales: Number(line.salesQty || 0),
        total: Number(line.totalQty || 0),
        final: Number(line.finalQty || 0),
        amount: Number(line.amount || 0),
        gp: Number(line.gp || 0),
        gain: Number(line.gain || 0),
      }));

      const totals = this.sumManualLineTotals(lines);

      return {
        id: report.id,
        register: report.register,
        warehouse: report.warehouse,
        reportDate: report.reportDate,
        note: report.note || '',
        employeeIds: report.employeeIds || [],
        employees: [],
        paymentMethods: [],
        paymentBreakdown: this.normalizePaymentBreakdownFromRaw(report.paymentBreakdown),
        lines,
        totals,
        createdAt: report.createdAt,
        updatedAt: report.updatedAt,
      };
    });
  }

  async deleteManual(id: string) {
    const report = await this.prisma.manualIvpReport.findUnique({
      where: { id },
      select: {
        id: true,
        warehouseId: true,
        reportDate: true,
        lines: {
          select: {
            productId: true,
            entriesQty: true,
            outsQty: true,
            salesQty: true,
          },
        },
      },
    });
    if (!report) throw new NotFoundException("Reporte IPV manual no encontrado.");

    return this.prisma.$transaction(async (tx) => {
      const reasonPrefix = `MANUAL_IPV_${id}`;
      const hasStockSyncV2 = await tx.stockMovement.findFirst({
        where: {
          reason: {
            startsWith: reasonPrefix,
            contains: '[SYNC_V2]',
          },
        },
        select: { id: true },
      });

      if (hasStockSyncV2 && report.lines.length > 0) {
        const productIds = Array.from(new Set(report.lines.map((line) => line.productId)));
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, cost: true },
        });
        const productCostById = new Map(products.map((product) => [product.id, Number(product.cost || 0)]));

        await this.syncManualIvpStockAndLots(tx, {
          warehouseId: report.warehouseId,
          reportDate: report.reportDate,
          reasonPrefix,
          mode: 'REVERT',
          lines: report.lines.map((line) => ({
            productId: line.productId,
            entriesQty: Number(line.entriesQty || 0),
            outsQty: Number(line.outsQty || 0),
            salesQty: Number(line.salesQty || 0),
            fallbackCost: Number(productCostById.get(line.productId) || 0),
          })),
        });
      }

      await tx.stockMovement.deleteMany({
        where: { reason: { startsWith: reasonPrefix } },
      });
      await tx.manualIvpReportLine.deleteMany({
        where: { reportId: id },
      });
      await tx.manualIvpReport.delete({
        where: { id },
      });
      return { ok: true, deletedReportId: id };
    });
  }

  async delete(id: string) {
    const report = await this.prisma.inventoryReport.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!report) throw new NotFoundException("Reporte IPV no encontrado.");

    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryReportItem.deleteMany({
        where: { inventoryReportId: id },
      });
      await tx.inventoryReport.delete({
        where: { id },
      });
      return { ok: true, deletedReportId: id };
    });
  }

  async deleteBySession(cashSessionId: string) {
    const reports = await this.prisma.inventoryReport.findMany({
      where: { cashSessionId },
      select: { id: true },
    });
    if (!reports.length) {
      throw new NotFoundException("No existen reportes IPV para la sesión indicada.");
    }

    const reportIds = reports.map((report) => report.id);
    return this.prisma.$transaction(async (tx) => {
      await tx.inventoryReportItem.deleteMany({
        where: { inventoryReportId: { in: reportIds } },
      });
      await tx.inventoryReport.deleteMany({
        where: { id: { in: reportIds } },
      });
      return { ok: true, cashSessionId, deletedReports: reportIds.length };
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

  async ensureInitialReportForSession(cashSessionId: string): Promise<InventoryReport> {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    const warehouseId = session.register.warehouse!.id;

    const existing = await this.prisma.inventoryReport.findFirst({
      where: {
        cashSessionId,
        type: IPVType.INITIAL,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const items = await this.buildInitialItemsForSession(cashSessionId);

    const totalValue = Number(items.reduce((sum, item) => sum + item.total, 0).toFixed(2));
    return this.prisma.inventoryReport.create({
      data: {
        type: IPVType.INITIAL,
        createdAt: session.openedAt,
        cashSessionId,
        warehouseId,
        totalValue: dec(totalValue.toString()) as any,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            qty: item.qty,
            price: dec(item.price.toString()) as any,
            total: dec(item.total.toString()) as any,
          })),
        },
      },
    });
  }

  async getSessionIpvReport(cashSessionId: string, asOf?: Date) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    const warehouseId = session.register.warehouse!.id;
    await this.ensureInitialReportForSession(cashSessionId);

    const initial = await this.prisma.inventoryReport.findFirst({
      where: {
        cashSessionId,
        type: IPVType.INITIAL,
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!initial) throw new BadRequestException('No se pudo inicializar el IPV de la sesión.');

    const sessionEnd = asOf || session.closedAt || new Date();
    const previousClosedSession = await this.prisma.cashSession.findFirst({
      where: {
        id: { not: cashSessionId },
        registerId: session.registerId,
        status: CashSessionStatus.CLOSED,
        closedAt: { lt: session.openedAt },
      },
      select: { closedAt: true },
      orderBy: { closedAt: 'desc' },
    });

    const initialMap = new Map<string, number>(initial.items.map((i) => [i.productId, Number(i.qty)]));
    const productIds = new Set<string>(initial.items.map((i) => i.productId));

    const movementCreatedAtFilter: { lte: Date; gte?: Date; gt?: Date } = {
      lte: sessionEnd,
    };
    if (previousClosedSession?.closedAt) {
      // Include carry-over movements between last close and this opening.
      movementCreatedAtFilter.gt = previousClosedSession.closedAt;
    } else {
      // First known session: keep movement window inside current session only.
      movementCreatedAtFilter.gte = session.openedAt;
    }

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        createdAt: movementCreatedAtFilter,
        OR: [
          { toWarehouseId: warehouseId },
          { fromWarehouseId: warehouseId },
        ],
      },
    });

    const entriesMap = new Map<string, number>();
    const outsMap = new Map<string, number>();
    const saleReasonRegex = /VENTA/i;
    const tpvSessionReasonRegex = /TPV[_\s-]*SESION/i;
    const legacyTpvSessionReasonRegex = /AJUSTE\s+EN\s+TPV\s*\(\s*SESION\s*\)/i;
    const isFirstKnownSession = !previousClosedSession?.closedAt;
    let entriesCount = 0;
    let outsCount = 0;
    for (const mv of movements) {
      productIds.add(mv.productId);
      const qty = Number(mv.qty);
      const isSessionWindowMovement = mv.createdAt >= session.openedAt;
      const reason = (mv.reason || '').trim();
      const isTpvSessionMovement =
        tpvSessionReasonRegex.test(reason) || legacyTpvSessionReasonRegex.test(reason);

      const isInbound =
        (mv.type === 'IN' && mv.toWarehouseId === warehouseId) ||
        (mv.type === 'TRANSFER' && mv.toWarehouseId === warehouseId);
      if (isInbound) {
        const isCarryIntoInitial = isFirstKnownSession && !isTpvSessionMovement;
        if (isCarryIntoInitial) {
          initialMap.set(mv.productId, Number((initialMap.get(mv.productId) || 0) + qty));
        } else {
          entriesMap.set(mv.productId, Number((entriesMap.get(mv.productId) || 0) + qty));
          if (mv.type === 'IN' && mv.toWarehouseId === warehouseId) {
            entriesCount += 1;
          }
        }
      }

      const isOutbound =
        (mv.type === 'OUT' && mv.fromWarehouseId === warehouseId) ||
        (mv.type === 'TRANSFER' && mv.fromWarehouseId === warehouseId);
      if (isOutbound) {
        // Exclude sale movements only during this session to avoid double count with salesMap.
        const isSaleOutInsideSession = isSessionWindowMovement && saleReasonRegex.test(reason);
        if (!isSaleOutInsideSession) {
          const isCarryIntoInitial = isFirstKnownSession && !isTpvSessionMovement;
          if (isCarryIntoInitial) {
            initialMap.set(mv.productId, Number((initialMap.get(mv.productId) || 0) - qty));
          } else {
            outsMap.set(mv.productId, Number((outsMap.get(mv.productId) || 0) + qty));
          }
        }
      }
      if (mv.type === 'OUT' && mv.fromWarehouseId === warehouseId) {
        if (!saleReasonRegex.test(reason)) {
          const isCarryIntoInitial = isFirstKnownSession && !isTpvSessionMovement;
          if (!isCarryIntoInitial) {
            outsCount += 1;
          }
        }
      }
    }

    const soldItems = await this.prisma.saleItem.findMany({
      where: {
        sale: {
          cashSessionId,
          status: SaleStatus.PAID,
        },
      },
      select: {
        productId: true,
        qty: true,
        price: true,
        costSnapshot: true,
      },
    });
    const salesMap = new Map<string, number>();
    const salesAmountMap = new Map<string, number>();
    const salesCostAmountMap = new Map<string, number>();
    const salesMissingCostQtyMap = new Map<string, number>();
    for (const it of soldItems) {
      productIds.add(it.productId);
      const qty = Number(it.qty);
      const unitPrice = Number(it.price || 0);
      const unitCostSnapshot = it.costSnapshot != null ? Number(it.costSnapshot) : null;

      salesMap.set(it.productId, Number(((salesMap.get(it.productId) || 0) + qty).toFixed(6)));
      salesAmountMap.set(
        it.productId,
        Number(((salesAmountMap.get(it.productId) || 0) + qty * unitPrice).toFixed(2))
      );

      if (unitCostSnapshot != null) {
        salesCostAmountMap.set(
          it.productId,
          Number(((salesCostAmountMap.get(it.productId) || 0) + qty * unitCostSnapshot).toFixed(2))
        );
      } else {
        salesMissingCostQtyMap.set(
          it.productId,
          Number(((salesMissingCostQtyMap.get(it.productId) || 0) + qty).toFixed(6))
        );
      }
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: {
        id: true,
        name: true,
        codigo: true,
        price: true,
        cost: true,
        currency: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const lines = Array.from(productIds).map((productId) => {
      const product = productMap.get(productId);
      const initialQty = Number(initialMap.get(productId) || 0);
      const entries = Number(entriesMap.get(productId) || 0);
      const outs = Number(outsMap.get(productId) || 0);
      const sales = Number(salesMap.get(productId) || 0);
      const total = initialQty + entries - outs;
      const final = total - sales;
      const currentProductPrice = Number(product?.price || 0);
      const salesAmount = Number(salesAmountMap.get(productId) || 0);
      const linePrice = sales > 0 ? Number((salesAmount / sales).toFixed(2)) : currentProductPrice;
      const fallbackUnitCost = Number(product?.cost || 0);
      const knownCostAmount = Number(salesCostAmountMap.get(productId) || 0);
      const missingCostQty = Number(salesMissingCostQtyMap.get(productId) || 0);
      const totalCostAmount = Number((knownCostAmount + (missingCostQty * fallbackUnitCost)).toFixed(2));
      const gain = Number((salesAmount - totalCostAmount).toFixed(2));
      const gp = sales > 0 ? Number((gain / sales).toFixed(2)) : 0;
      const amount = Number(salesAmount.toFixed(2));

      return {
        productId,
        name: product?.name || `Producto ${productId.slice(0, 8)}`,
        codigo: product?.codigo || null,
        currency: product?.currency || 'CUP',
        initial: initialQty,
        entries,
        outs,
        sales,
        total,
        final,
        price: linePrice,
        amount,
        gp,
        gain,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));

    const totals = lines.reduce(
      (acc, line) => ({
        initial: acc.initial + line.initial,
        entries: acc.entries + line.entries,
        outs: acc.outs + line.outs,
        sales: acc.sales + line.sales,
        total: acc.total + line.total,
        final: acc.final + line.final,
        amount: Number((acc.amount + line.amount).toFixed(2)),
        profit: Number((acc.profit + line.gain).toFixed(2)),
      }),
      { initial: 0, entries: 0, outs: 0, sales: 0, total: 0, final: 0, amount: 0, profit: 0 }
    );

    const [paymentTotals, salesCount] = await Promise.all([
      this.getPaymentTotals(cashSessionId, session.openedAt, sessionEnd),
      this.prisma.sale.count({
        where: {
          cashSessionId,
          status: SaleStatus.PAID,
        },
      }),
    ]);

    return {
      cashSessionId,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      responsible: {
        userId: session.openedBy.id,
        email: session.openedBy.email,
        employeeId: session.openedBy.employee?.id || null,
        employeeName: session.openedBy.employee
          ? `${session.openedBy.employee.firstName} ${session.openedBy.employee.lastName}`.trim()
          : null,
      },
      register: {
        id: session.register.id,
        name: session.register.name,
        code: session.register.code,
      },
      warehouse: {
        id: session.register.warehouse!.id,
        name: session.register.warehouse!.name,
        code: session.register.warehouse!.code,
      },
      lines,
      totals: {
        ...totals,
        salesCount,
        entriesCount,
        outsCount,
      },
      paymentTotals,
      closed: session.status === CashSessionStatus.CLOSED,
    };
  }

  async listManualRegisters() {
    return this.prisma.register.findMany({
      where: {
        active: true,
        warehouse: { isNot: null },
      },
      select: {
        id: true,
        name: true,
        code: true,
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getManualBootstrap(registerId: string, reportDate?: Date | string) {
    const normalizedDate = this.normalizeManualReportDate(reportDate);
    const register = await this.prisma.register.findUnique({
      where: { id: registerId },
      include: {
        warehouse: true,
        settings: {
          include: {
            paymentMethods: true,
          },
        },
      },
    });
    if (!register || !register.active) {
      throw new NotFoundException('TPV no encontrado o inactivo.');
    }
    if (!register.warehouse?.id) {
      throw new BadRequestException('El TPV seleccionado no tiene almacén asociado.');
    }

    const [existingReport, previousReport, stockRows, employees, paymentMethods] = await Promise.all([
      this.prisma.manualIvpReport.findUnique({
        where: {
          registerId_reportDate: {
            registerId: register.id,
            reportDate: normalizedDate,
          },
        },
        include: {
          lines: true,
        },
      }),
      this.prisma.manualIvpReport.findFirst({
        where: {
          registerId: register.id,
          reportDate: { lt: normalizedDate },
        },
        include: {
          lines: true,
        },
        orderBy: { reportDate: 'desc' },
      }),
      this.prisma.stock.findMany({
        where: { warehouseId: register.warehouse.id, qty: { gt: 0 } },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              codigo: true,
              price: true,
              cost: true,
              currency: true,
              allowFractionalQty: true,
              active: true,
            },
          },
        },
      }),
      this.resolveManualEmployees(register.settings?.sellerEmployeeIds || []),
      this.resolveManualPaymentMethods(register.settings?.paymentMethods || []),
    ]);

    const seedInitialByProduct = new Map<string, number>();
    if (previousReport) {
      for (const line of previousReport.lines) {
        seedInitialByProduct.set(line.productId, Number(line.finalQty || 0));
      }
    } else {
      for (const row of stockRows) {
        seedInitialByProduct.set(row.productId, Number(row.qty || 0));
      }
    }

    // Include products that may have appeared in stock after previous report.
    for (const row of stockRows) {
      if (!seedInitialByProduct.has(row.productId)) {
        seedInitialByProduct.set(row.productId, Number(row.qty || 0));
      }
    }

    const productIds = Array.from(seedInitialByProduct.keys());
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            codigo: true,
            price: true,
            cost: true,
            currency: true,
            allowFractionalQty: true,
            active: true,
          },
        })
      : [];
    const productById = new Map(products.map((product) => [product.id, product]));
    const existingLineByProduct = new Map((existingReport?.lines || []).map((line) => [line.productId, line]));

    const lines = productIds
      .map((productId) => {
        const product = productById.get(productId);
        if (!product) return null;
        const currentPrice = Number(product.price || 0);
        const currentCost = Number(product.cost || 0);
        const initial = Number(seedInitialByProduct.get(productId) || 0);
        const existingLine = existingLineByProduct.get(productId);
        const entries = Number(existingLine?.entriesQty || 0);
        const outs = Number(existingLine?.outsQty || 0);
        const sales = Number(existingLine?.salesQty || 0);
        const total = Number((initial + entries - outs).toFixed(3));
        const final = Number((total - sales).toFixed(3));
        const amount = Number((sales * currentPrice).toFixed(2));
        const gp = Number((currentPrice - currentCost).toFixed(2));
        const gain = Number((gp * sales).toFixed(2));
        return {
          productId: product.id,
          codigo: product.codigo || '',
          name: product.name,
          currency: product.currency,
          allowFractionalQty: product.allowFractionalQty === true,
          price: currentPrice,
          cost: currentCost,
          initial,
          entries,
          outs,
          sales,
          total,
          final,
          amount,
          gp,
          gain,
        };
      })
      .filter((line): line is NonNullable<typeof line> => !!line)
      .sort((a, b) => this.compareProductByCodigoThenName(a.codigo, a.name, b.codigo, b.name));

    return {
      register: {
        id: register.id,
        name: register.name,
        code: register.code,
      },
      warehouse: {
        id: register.warehouse.id,
        name: register.warehouse.name,
        code: register.warehouse.code,
      },
      reportDate: normalizedDate,
      isFirstReport: !previousReport,
      previousReportId: previousReport?.id || null,
      editing: !!existingReport,
      existingReportId: existingReport?.id || null,
      note: existingReport?.note || '',
      employees,
      paymentMethods,
      selectedEmployeeIds: existingReport?.employeeIds || [],
      paymentBreakdown: this.normalizePaymentBreakdown(paymentMethods, existingReport?.paymentBreakdown),
      lines,
    };
  }

  async findManualById(id: string) {
    const report = await this.prisma.manualIvpReport.findUnique({
      where: { id },
      include: {
        register: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        lines: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                codigo: true,
                currency: true,
                allowFractionalQty: true,
              },
            },
          },
          orderBy: [
            { product: { codigo: 'asc' } },
            { product: { name: 'asc' } },
          ],
        },
      },
    });
    if (!report) throw new NotFoundException('IPV manual no encontrado.');

    const paymentMethods = await this.resolveManualPaymentMethodsByRegister(report.registerId);
    const employees = await this.resolveManualEmployeesByIds(report.employeeIds || []);

    const lines = report.lines.map((line) => ({
      productId: line.productId,
      codigo: line.product?.codigo || '',
      name: line.product?.name || `Producto ${line.productId.slice(0, 8)}`,
      currency: line.product?.currency || 'CUP',
      allowFractionalQty: line.product?.allowFractionalQty === true,
      price: Number(line.price || 0),
      initial: Number(line.initialQty || 0),
      entries: Number(line.entriesQty || 0),
      outs: Number(line.outsQty || 0),
      sales: Number(line.salesQty || 0),
      total: Number(line.totalQty || 0),
      final: Number(line.finalQty || 0),
      amount: Number(line.amount || 0),
      gp: Number(line.gp || 0),
      gain: Number(line.gain || 0),
    }));

    const totals = this.sumManualLineTotals(lines);

    return {
      id: report.id,
      register: report.register,
      warehouse: report.warehouse,
      reportDate: report.reportDate,
      note: report.note || '',
      employeeIds: report.employeeIds || [],
      employees,
      paymentMethods,
      paymentBreakdown: this.normalizePaymentBreakdown(paymentMethods, report.paymentBreakdown),
      lines,
      totals,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };
  }

  async saveManualReport(input: SaveManualIvpInput) {
    const registerId = String(input.registerId || '').trim();
    if (!registerId) {
      throw new BadRequestException('Debe seleccionar un TPV.');
    }
    const reportDate = this.normalizeManualReportDate(input.reportDate);
    const normalizedLines = Array.isArray(input.lines) ? input.lines : [];
    if (normalizedLines.length === 0) {
      throw new BadRequestException('Debe enviar al menos una línea de productos.');
    }

    const register = await this.prisma.register.findUnique({
      where: { id: registerId },
      include: {
        warehouse: true,
        settings: {
          include: {
            paymentMethods: true,
          },
        },
      },
    });
    if (!register || !register.active) {
      throw new NotFoundException('TPV no encontrado o inactivo.');
    }
    if (!register.warehouse?.id) {
      throw new BadRequestException('El TPV seleccionado no tiene almacén asociado.');
    }

    const productIds = Array.from(
      new Set(
        normalizedLines
          .map((line) => String(line.productId || '').trim())
          .filter((id) => !!id),
      ),
    );
    if (productIds.length === 0) {
      throw new BadRequestException('Debe incluir líneas válidas con producto.');
    }

    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        price: true,
        cost: true,
        allowFractionalQty: true,
        codigo: true,
        name: true,
        currency: true,
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));
    if (productById.size !== productIds.length) {
      throw new BadRequestException('Uno o más productos no existen.');
    }

    const resolvedEmployees = await this.resolveManualEmployeesByIds(input.employeeIds || []);
    const employeeIds = resolvedEmployees.map((employee) => employee.id);
    const paymentMethods = await this.resolveManualPaymentMethods(register.settings?.paymentMethods || []);
    const paymentBreakdown = this.normalizePaymentBreakdown(paymentMethods, input.paymentBreakdown);
    const note = String(input.note || '').trim() || null;
    const previousManualReport = await this.prisma.manualIvpReport.findFirst({
      where: {
        registerId,
        reportDate: { lt: reportDate },
      },
      select: { reportDate: true },
      orderBy: { reportDate: 'desc' },
    });

    const lines = normalizedLines.map((line) => {
      const productId = String(line.productId || '').trim();
      const product = productById.get(productId);
      if (!product) {
        throw new BadRequestException(`Producto inválido en la línea: ${productId || 'N/D'}`);
      }

      const initial = this.normalizeManualQty(line.initial, product.allowFractionalQty === true, 'inicio');
      const entries = this.normalizeManualQty(line.entries, product.allowFractionalQty === true, 'entradas');
      const outs = this.normalizeManualQty(line.outs, product.allowFractionalQty === true, 'salidas');
      const sales = this.normalizeManualQty(line.sales, product.allowFractionalQty === true, 'ventas');
      const price = Number(product.price || 0);
      const cost = Number(product.cost || 0);

      const total = Number((initial + entries - outs).toFixed(3));
      const final = Number((total - sales).toFixed(3));
      const amount = Number((sales * price).toFixed(2));

      return {
        productId,
        initialQty: initial,
        entriesQty: entries,
        outsQty: outs,
        salesQty: sales,
        totalQty: total,
        finalQty: final,
        price,
        amount,
        // gp/gain se recalculan con FIFO usando purchase lots.
        gp: 0,
        gain: 0,
        fallbackCost: cost,
      };
    });

    // Recalcular gp/gain con costo histórico de ventas del período del IPV.
    const warehouseId = register.warehouse!.id;
    const productIdsWithSales = Array.from(
      new Set(lines.filter((l) => Number(l.salesQty || 0) > 0).map((l) => l.productId)),
    );

    const historicalCostsByProduct = await this.buildHistoricalSalesCostByProduct({
      warehouseId,
      productIds: productIdsWithSales,
      fromExclusive: previousManualReport?.reportDate || null,
      toInclusive: this.endOfDay(reportDate),
    });

    for (const line of lines) {
      if (!line.salesQty || Number(line.salesQty) <= 0) continue;
      const salesQty = dec(line.salesQty);
      const fallbackUnitCost = dec(line.fallbackCost || 0);
      const historical = historicalCostsByProduct.get(line.productId);
      const historicalQty = dec(historical?.qty || 0);
      const historicalCost = dec(historical?.totalCost || 0);
      const avgUnitCostSold = historical && historicalQty.gt(0)
        ? dec(historicalCost.div(historicalQty).toFixed(2))
        : fallbackUnitCost;

      const gpUnit = dec(Number(line.price || 0)).sub(avgUnitCostSold);
      line.gp = Number(gpUnit.toFixed(2));
      line.gain = Number(gpUnit.mul(salesQty).toFixed(2));
    }

    const reportId = await this.prisma.$transaction(async (tx) => {
      let existingReport: {
        id: string;
        registerId: string;
        lines: Array<{
          productId: string;
          entriesQty: Prisma.Decimal;
          outsQty: Prisma.Decimal;
          salesQty: Prisma.Decimal;
        }>;
      } | null = null;

      if (input.id) {
        existingReport = await tx.manualIvpReport.findUnique({
          where: { id: input.id },
          select: {
            id: true,
            registerId: true,
            lines: {
              select: {
                productId: true,
                entriesQty: true,
                outsQty: true,
                salesQty: true,
              },
            },
          },
        });
        if (!existingReport) throw new NotFoundException('IPV manual no encontrado.');
        if (existingReport.registerId !== registerId) {
          throw new BadRequestException('El IPV manual no corresponde con el TPV seleccionado.');
        }
      } else {
        existingReport = await tx.manualIvpReport.findUnique({
          where: {
            registerId_reportDate: {
              registerId,
              reportDate,
            },
          },
          select: {
            id: true,
            registerId: true,
            lines: {
              select: {
                productId: true,
                entriesQty: true,
                outsQty: true,
                salesQty: true,
              },
            },
          },
        });
      }

      const reportId = existingReport?.id || (
        await tx.manualIvpReport.create({
          data: {
            registerId,
            warehouseId: register.warehouse!.id,
            reportDate,
            note,
            employeeIds,
            paymentBreakdown: paymentBreakdown as any,
            createdById: input.createdById || undefined,
          },
          select: { id: true },
        })
      ).id;

      await tx.manualIvpReport.update({
        where: { id: reportId },
        data: {
          warehouseId: register.warehouse!.id,
          reportDate,
          note,
          employeeIds,
          paymentBreakdown: paymentBreakdown as any,
          createdById: input.createdById || undefined,
        },
      });

      const previousLineSnapshot = (existingReport?.lines || []).map((line) => ({
        productId: line.productId,
        entriesQty: Number(line.entriesQty || 0),
        outsQty: Number(line.outsQty || 0),
        salesQty: Number(line.salesQty || 0),
        fallbackCost: Number(productById.get(line.productId)?.cost || 0),
      }));

      if (previousLineSnapshot.length > 0) {
        const previousMissing = previousLineSnapshot
          .map((line) => line.productId)
          .filter((id) => !productById.has(id));
        if (previousMissing.length > 0) {
          const previousProducts = await tx.product.findMany({
            where: { id: { in: previousMissing } },
            select: { id: true, cost: true },
          });
          const previousCostById = new Map(previousProducts.map((product) => [product.id, Number(product.cost || 0)]));
          for (const line of previousLineSnapshot) {
            if (!line.fallbackCost && previousCostById.has(line.productId)) {
              line.fallbackCost = Number(previousCostById.get(line.productId) || 0);
            }
          }
        }
      }

      await tx.manualIvpReportLine.deleteMany({ where: { reportId } });
      if (lines.length > 0) {
        await tx.manualIvpReportLine.createMany({
          data: lines.map((line) => ({
            reportId,
            productId: line.productId,
            initialQty: dec(line.initialQty.toString()) as any,
            entriesQty: dec(line.entriesQty.toString()) as any,
            outsQty: dec(line.outsQty.toString()) as any,
            salesQty: dec(line.salesQty.toString()) as any,
            totalQty: dec(line.totalQty.toString()) as any,
            finalQty: dec(line.finalQty.toString()) as any,
            price: dec(line.price.toString()) as any,
            amount: dec(line.amount.toString()) as any,
            gp: dec(line.gp.toString()) as any,
            gain: dec(line.gain.toString()) as any,
          })),
        });
      }

      const reasonPrefix = `MANUAL_IPV_${reportId}`;
      const hasStockSyncV2 = await tx.stockMovement.findFirst({
        where: {
          reason: {
            startsWith: reasonPrefix,
            contains: '[SYNC_V2]',
          },
        },
        select: { id: true },
      });
      await tx.stockMovement.deleteMany({
        where: { reason: { startsWith: reasonPrefix } },
      });

      if (previousLineSnapshot.length > 0 && !!hasStockSyncV2) {
        await this.syncManualIvpStockAndLots(tx, {
          warehouseId: register.warehouse!.id,
          reportDate,
          reasonPrefix,
          lines: previousLineSnapshot,
          mode: 'REVERT',
        });
      }

      await this.syncManualIvpStockAndLots(tx, {
        warehouseId: register.warehouse!.id,
        reportDate,
        reasonPrefix,
        lines: lines.map((line) => ({
          productId: line.productId,
          entriesQty: Number(line.entriesQty || 0),
          outsQty: Number(line.outsQty || 0),
          salesQty: Number(line.salesQty || 0),
          fallbackCost: Number(line.fallbackCost || 0),
        })),
        mode: 'APPLY',
      });

      return reportId;
    });

    return this.findManualById(reportId);
  }

  private async buildHistoricalSalesCostByProduct(input: {
    warehouseId: string;
    productIds: string[];
    fromExclusive: Date | null;
    toInclusive: Date;
  }) {
    const productIds = Array.from(new Set(input.productIds.filter(Boolean)));
    const result = new Map<string, { qty: number; totalCost: number }>();
    if (!productIds.length) return result;

    const where: any = {
      saleItem: {
        productId: { in: productIds },
        sale: {
          warehouseId: input.warehouseId,
          status: SaleStatus.PAID,
          createdAt: {
            lte: input.toInclusive,
            ...(input.fromExclusive ? { gt: input.fromExclusive } : {}),
          },
        },
      },
    };

    const consumptions = await this.prisma.saleItemLotConsumption.findMany({
      where,
      select: {
        qty: true,
        lineCost: true,
        saleItem: {
          select: {
            productId: true,
          },
        },
      },
    });

    for (const row of consumptions) {
      const productId = row.saleItem.productId;
      const current = result.get(productId) || { qty: 0, totalCost: 0 };
      result.set(productId, {
        qty: Number((current.qty + Number(row.qty || 0)).toFixed(6)),
        totalCost: Number((current.totalCost + Number(row.lineCost || 0)).toFixed(2)),
      });
    }

    return result;
  }

  private async syncManualIvpStockAndLots(
    tx: Prisma.TransactionClient,
    input: {
      warehouseId: string;
      reportDate: Date;
      reasonPrefix: string;
      lines: Array<{
        productId: string;
        entriesQty: number;
        outsQty: number;
        salesQty: number;
        fallbackCost: number;
      }>;
      mode: 'APPLY' | 'REVERT';
    },
  ) {
    const deltasByProduct = new Map<string, { entries: number; out: number; fallbackCost: number }>();
    for (const line of input.lines) {
      const productId = String(line.productId || '').trim();
      if (!productId) continue;
      const current = deltasByProduct.get(productId) || { entries: 0, out: 0, fallbackCost: 0 };
      current.entries = Number((current.entries + Number(line.entriesQty || 0)).toFixed(3));
      current.out = Number((current.out + Number(line.outsQty || 0) + Number(line.salesQty || 0)).toFixed(3));
      current.fallbackCost = Number(line.fallbackCost || current.fallbackCost || 0);
      deltasByProduct.set(productId, current);
    }

    for (const [productId, delta] of deltasByProduct.entries()) {
      const entriesQty = Number(delta.entries || 0);
      const outQty = Number(delta.out || 0);
      const fallbackCost = Number(delta.fallbackCost || 0);

      if (input.mode === 'REVERT') {
        if (entriesQty > 0) {
          const updated = await tx.stock.updateMany({
            where: {
              warehouseId: input.warehouseId,
              productId,
              qty: { gte: entriesQty },
            },
            data: {
              qty: { decrement: entriesQty },
            },
          });
          if (updated.count === 0) {
            throw new BadRequestException(
              'No se puede recalcular el IPV manual porque el stock actual no permite revertir entradas previas.',
            );
          }
          await this.inventoryCostingService.consumeStockWithFifo(tx, {
            warehouseId: input.warehouseId,
            productId,
            qty: entriesQty,
            fallbackUnitCost: fallbackCost,
            reference: `${input.reasonPrefix}:REVERSA_ENTRADA`,
            receivedAt: input.reportDate,
          });
        }

        if (outQty > 0) {
          await tx.stock.upsert({
            where: {
              warehouseId_productId: {
                warehouseId: input.warehouseId,
                productId,
              },
            },
            create: {
              warehouseId: input.warehouseId,
              productId,
              qty: outQty,
            },
            update: {
              qty: { increment: outQty },
            },
          });
          await this.inventoryCostingService.createAdjustmentLot(tx, {
            warehouseId: input.warehouseId,
            productId,
            qty: outQty,
            unitCost: fallbackCost,
            reference: `${input.reasonPrefix}:REVERSA_SALIDA`,
            receivedAt: input.reportDate,
          });
        }
        continue;
      }

      if (entriesQty > 0) {
        await tx.stock.upsert({
          where: {
            warehouseId_productId: {
              warehouseId: input.warehouseId,
              productId,
            },
          },
          create: {
            warehouseId: input.warehouseId,
            productId,
            qty: entriesQty,
          },
          update: {
            qty: { increment: entriesQty },
          },
        });
        await this.inventoryCostingService.createAdjustmentLot(tx, {
          warehouseId: input.warehouseId,
          productId,
          qty: entriesQty,
          unitCost: fallbackCost,
          reference: `${input.reasonPrefix}:ENTRADA`,
          receivedAt: input.reportDate,
        });
      }

      if (outQty > 0) {
        const updated = await tx.stock.updateMany({
          where: {
            warehouseId: input.warehouseId,
            productId,
            qty: { gte: outQty },
          },
          data: {
            qty: { decrement: outQty },
          },
        });
        if (updated.count === 0) {
          throw new BadRequestException(
            'Stock insuficiente para aplicar salidas/ventas del IPV manual.',
          );
        }
        await this.inventoryCostingService.consumeStockWithFifo(tx, {
          warehouseId: input.warehouseId,
          productId,
          qty: outQty,
          fallbackUnitCost: fallbackCost,
          reference: `${input.reasonPrefix}:SALIDA`,
          receivedAt: input.reportDate,
        });
      }
    }

    if (input.mode === 'APPLY') {
      const movementRows: Array<{
        type: 'IN' | 'OUT';
        productId: string;
        qty: number;
        fromWarehouseId?: string;
        toWarehouseId?: string;
        reason: string;
        createdAt: Date;
      }> = [];

      for (const line of input.lines) {
        if (line.entriesQty > 0) {
          movementRows.push({
            type: 'IN',
            productId: line.productId,
            qty: line.entriesQty,
            toWarehouseId: input.warehouseId,
            reason: `${input.reasonPrefix} [SYNC_V2] - ENTRADA`,
            createdAt: input.reportDate,
          });
        }
        if (line.outsQty > 0) {
          movementRows.push({
            type: 'OUT',
            productId: line.productId,
            qty: line.outsQty,
            fromWarehouseId: input.warehouseId,
            reason: `${input.reasonPrefix} [SYNC_V2] - SALIDA`,
            createdAt: input.reportDate,
          });
        }
        if (line.salesQty > 0) {
          movementRows.push({
            type: 'OUT',
            productId: line.productId,
            qty: line.salesQty,
            fromWarehouseId: input.warehouseId,
            reason: `${input.reasonPrefix} [SYNC_V2] - VENTA`,
            createdAt: input.reportDate,
          });
        }
      }

      for (const movement of movementRows) {
        await tx.stockMovement.create({ data: movement as any });
      }
    }
  }

  private endOfDay(value: Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      23,
      59,
      59,
      999,
    );
  }

  private async resolveManualEmployees(sellerEmployeeIds: string[]) {
    const ids = Array.isArray(sellerEmployeeIds)
      ? Array.from(new Set(sellerEmployeeIds.map((id) => String(id || '').trim()).filter(Boolean)))
      : [];

    const where = ids.length > 0
      ? { id: { in: ids }, active: true, userId: { not: null } }
      : { active: true, userId: { not: null } };

    const employees = await this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        active: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            active: true,
          },
        },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return employees.map((employee) => ({
      ...employee,
      fullName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
    }));
  }

  private async resolveManualEmployeesByIds(employeeIds: string[]) {
    const ids = Array.from(
      new Set((employeeIds || []).map((id) => String(id || '').trim()).filter(Boolean)),
    );
    if (ids.length === 0) return [];

    const employees = await this.prisma.employee.findMany({
      where: {
        id: { in: ids },
        active: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        active: true,
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
            active: true,
          },
        },
      },
    });

    const byId = new Map(employees.map((employee) => [employee.id, employee]));
    return ids
      .map((id) => byId.get(id))
      .filter((employee): employee is NonNullable<typeof employee> => !!employee)
      .map((employee) => ({
        ...employee,
        fullName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
      }));
  }

  private async resolveManualPaymentMethods(
    configured: Array<{ code: string; name: string; enabled: boolean; requiresTransactionCode?: boolean }>,
  ) {
    const enabledConfigured = (configured || []).filter((method) => method.enabled !== false);
    if (enabledConfigured.length > 0) {
      return enabledConfigured
        .map((method) => ({
          code: this.normalizePaymentMethodCode(method.code),
          name: (method.name || '').trim() || this.getPaymentMethodLabel(method.code),
          requiresTransactionCode: method.requiresTransactionCode === true,
        }))
        .filter((method) => !!method.code) as Array<{ code: string; name: string; requiresTransactionCode: boolean }>;
    }

    const globalEnabled = await this.prisma.paymentMethodSetting.findMany({
      where: { enabled: true },
      select: {
        code: true,
        name: true,
        requiresTransactionCode: true,
      },
      orderBy: { code: 'asc' },
    });

    if (globalEnabled.length > 0) {
      return globalEnabled.map((method) => ({
        code: this.normalizePaymentMethodCode(method.code),
        name: (method.name || '').trim() || this.getPaymentMethodLabel(method.code),
        requiresTransactionCode: method.requiresTransactionCode === true,
      }));
    }

    return [
      { code: 'CASH', name: 'Efectivo', requiresTransactionCode: false },
      { code: 'CARD', name: 'Tarjeta', requiresTransactionCode: false },
      { code: 'TRANSFER', name: 'Transferencia', requiresTransactionCode: false },
      { code: 'OTHER', name: 'Otro', requiresTransactionCode: false },
    ];
  }

  private async resolveManualPaymentMethodsByRegister(registerId: string) {
    const settings = await this.prisma.registerSettings.findUnique({
      where: { registerId },
      include: { paymentMethods: true },
    });
    return this.resolveManualPaymentMethods(settings?.paymentMethods || []);
  }

  private normalizePaymentBreakdown(
    paymentMethods: Array<{ code: string; name: string; requiresTransactionCode?: boolean }>,
    raw: unknown,
  ) {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const normalized: Record<string, number> = {};
    for (const method of paymentMethods) {
      const code = this.normalizePaymentMethodCode(method.code);
      const value = Number(source[code] || 0);
      normalized[code] = Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : 0;
    }
    return normalized;
  }

  private normalizePaymentBreakdownFromRaw(raw: unknown): Record<string, number> {
    const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    const normalized: Record<'CASH' | 'CARD' | 'TRANSFER' | 'OTHER', number> = {
      CASH: 0,
      CARD: 0,
      TRANSFER: 0,
      OTHER: 0,
    };

    for (const [rawKey, rawValue] of Object.entries(source)) {
      const code = this.normalizePaymentMethodCode(rawKey);
      const value = Number(rawValue || 0);
      const fixed = Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : 0;
      (normalized as any)[code] = fixed;
    }

    return normalized;
  }

  private normalizePaymentMethodCode(code?: string | null): string {
    const normalized = String(code || '').trim().toUpperCase();
    switch (normalized) {
      case 'EFECTIVO':
      case 'CASH':
        return 'CASH';
      case 'TARJETA':
      case 'CARD':
        return 'CARD';
      case 'TRANSFERENCIA':
      case 'TRANSFER':
        return 'TRANSFER';
      case 'OTRO':
      case 'OTHER':
      default:
        return normalized || 'OTHER';
    }
  }

  private getPaymentMethodLabel(code: string): string {
    const normalized = this.normalizePaymentMethodCode(code);
    if (normalized === 'CASH') return 'Efectivo';
    if (normalized === 'CARD') return 'Tarjeta';
    if (normalized === 'TRANSFER') return 'Transferencia';
    return 'Otro';
  }

  private normalizeManualReportDate(value?: Date | string) {
    const base = this.parseManualReportDateInput(value) || new Date();
    if (Number.isNaN(base.getTime())) {
      throw new BadRequestException('Fecha de IPV manual inválida.');
    }
    return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  }

  private parseManualReportDateInput(value?: Date | string) {
    if (value === null || value === undefined) return undefined;
    if (value instanceof Date) return value;

    const raw = String(value).trim();
    if (!raw) return undefined;

    const ymdMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const year = Number(ymdMatch[1]);
      const month = Number(ymdMatch[2]) - 1;
      const day = Number(ymdMatch[3]);
      return new Date(year, month, day, 0, 0, 0, 0);
    }

    return new Date(raw);
  }

  private normalizeManualQty(value: unknown, allowFractional: boolean, label: string) {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`La cantidad de ${label} debe ser mayor o igual a 0.`);
    }
    if (!allowFractional && !Number.isInteger(parsed)) {
      throw new BadRequestException(`El producto de ${label} solo admite cantidades enteras.`);
    }
    if (allowFractional) return Number(parsed.toFixed(3));
    return Math.floor(parsed);
  }

  private compareProductByCodigoThenName(
    codigoA: string,
    nameA: string,
    codigoB: string,
    nameB: string,
  ): number {
    const a = String(codigoA || '').trim();
    const b = String(codigoB || '').trim();
    if (a && b) {
      const byCode = a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
      if (byCode !== 0) return byCode;
    } else if (a) {
      return -1;
    } else if (b) {
      return 1;
    }
    return String(nameA || '').localeCompare(String(nameB || ''), 'es', { sensitivity: 'base' });
  }

  private sumManualLineTotals(
    lines: Array<{
      initial: number;
      entries: number;
      outs: number;
      sales: number;
      total: number;
      final: number;
      amount: number;
      gain?: number;
    }>,
  ) {
    return lines.reduce<{
      initial: number;
      entries: number;
      outs: number;
      sales: number;
      total: number;
      final: number;
      amount: number;
      profit: number;
    }>(
      (acc, line) => ({
        initial: Number((acc.initial + Number(line.initial || 0)).toFixed(3)),
        entries: Number((acc.entries + Number(line.entries || 0)).toFixed(3)),
        outs: Number((acc.outs + Number(line.outs || 0)).toFixed(3)),
        sales: Number((acc.sales + Number(line.sales || 0)).toFixed(3)),
        total: Number((acc.total + Number(line.total || 0)).toFixed(3)),
        final: Number((acc.final + Number(line.final || 0)).toFixed(3)),
        amount: Number((acc.amount + Number(line.amount || 0)).toFixed(2)),
        profit: Number((acc.profit + Number(line.gain || 0)).toFixed(2)),
      }),
      { initial: 0, entries: 0, outs: 0, sales: 0, total: 0, final: 0, amount: 0, profit: 0 },
    );
  }

  private async getPaymentTotals(cashSessionId: string, _from: Date, _to: Date) {
    const grouped = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        sale: {
          cashSessionId,
          status: SaleStatus.PAID,
        },
      },
      _sum: { amount: true },
    });

    const map = new Map(grouped.map((g) => [g.method, Number(g._sum.amount || 0)]));
    return {
      CASH: Number((map.get(PaymentMethod.CASH) || 0).toFixed(2)),
      CARD: Number((map.get(PaymentMethod.CARD) || 0).toFixed(2)),
      TRANSFER: Number((map.get(PaymentMethod.TRANSFER) || 0).toFixed(2)),
      OTHER: Number((map.get(PaymentMethod.OTHER) || 0).toFixed(2)),
    };
  }

  private async buildInitialItemsForSession(cashSessionId: string) {
    const session = await this.requireSessionWithWarehouse(cashSessionId);
    const warehouseId = session.register.warehouse!.id;

    const previousSession = await this.prisma.cashSession.findFirst({
      where: {
        id: { not: cashSessionId },
        registerId: session.registerId,
        status: CashSessionStatus.CLOSED,
        closedAt: {
          lt: session.openedAt,
        },
      },
      select: {
        id: true,
        closedAt: true,
      },
      orderBy: {
        closedAt: 'desc',
      },
    });

    if (previousSession?.closedAt) {
      const previousIpv = await this.getSessionIpvReport(previousSession.id, previousSession.closedAt);
      const previousProductIds = previousIpv.lines.map((line) => line.productId);
      const products = await this.prisma.product.findMany({
        where: { id: { in: previousProductIds } },
        select: {
          id: true,
          price: true,
        },
      });
      const productPriceMap = new Map(products.map((p) => [p.id, Number(p.price)]));

      return previousIpv.lines.map((line) => {
        const qty = Number(line.final);
        const price = Number(productPriceMap.get(line.productId) ?? line.price ?? 0);
        return {
          productId: line.productId,
          qty,
          price,
          total: Number((qty * price).toFixed(2)),
        };
      });
    }

    const stock = await this.prisma.stock.findMany({
      where: { warehouseId },
      include: { product: true },
    });
    return stock.map((s) => {
      const price = Number(s.product.price);
      const qty = Number(s.qty);
      return {
        productId: s.productId,
        qty,
        price,
        total: Number((qty * price).toFixed(2)),
      };
    });
  }

  private async requireSessionWithWarehouse(cashSessionId: string) {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: cashSessionId },
      include: {
        openedBy: {
          select: {
            id: true,
            email: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        register: {
          include: {
            warehouse: true,
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Sesión de caja no existe.');
    if (!session.register.warehouse?.id) {
      throw new BadRequestException('El TPV no tiene almacén asociado.');
    }
    return session;
  }
}
