import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { dec } from "../../common/decimal";
import { CashSessionStatus, CurrencyCode, Prisma } from "@prisma/client";

type CreateProductInput = {
  name: string;
  codigo?: string;
  barcode?: string;
  price: string;
  cost?: string;
  lowStockAlertQty?: string;
  allowFractionalQty?: boolean;
  currency?: CurrencyCode;
  image?: string;
  productTypeId?: string;
  productCategoryId?: string;
  measurementUnitId?: string;
};

type UpdateProductInput = {
  name?: string;
  codigo?: string;
  barcode?: string;
  price?: string;
  cost?: string;
  lowStockAlertQty?: string;
  allowFractionalQty?: boolean;
  currency?: CurrencyCode;
  image?: string;
  active?: boolean;
  productTypeId?: string;
  productCategoryId?: string;
  measurementUnitId?: string;
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  list(includeInactive = false) {
    return this.prisma.product.findMany({
      where: includeInactive ? undefined : { active: true },
      orderBy: { createdAt: "desc" },
      include: {
        productType: true,
        productCategory: true,
        measurementUnit: true,
      },
    });
  }

  async create(dto: CreateProductInput) {
    try {
      return await this.prisma.product.create({
        data: {
          name: dto.name,
          codigo: this.asOptional(dto.codigo),
          barcode: this.asOptional(dto.barcode),
          price: dec(dto.price) as any,
          cost: dto.cost ? dec(dto.cost) as any : undefined,
          lowStockAlertQty: this.asOptionalDecimal(dto.lowStockAlertQty),
          allowFractionalQty: dto.allowFractionalQty === true,
          currency: dto.currency || CurrencyCode.CUP,
          image: this.asOptional(dto.image),
          productTypeId: this.asOptional(dto.productTypeId),
          productCategoryId: this.asOptional(dto.productCategoryId),
          measurementUnitId: this.asOptional(dto.measurementUnitId),
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async update(id: string, dto: UpdateProductInput) {
    try {
      let priceToPersist: Prisma.Decimal | undefined = undefined;
      if (dto.price !== undefined) {
        const currentProduct = await this.prisma.product.findUnique({
          where: { id },
          select: { id: true, price: true },
        });

        if (!currentProduct) {
          throw new BadRequestException("Producto no encontrado.");
        }

        const nextPrice = dec(dto.price);
        const currentPrice = dec(currentProduct.price);
        if (!nextPrice.equals(currentPrice)) {
          await this.ensurePriceChangeAllowed(id);
        }

        priceToPersist = nextPrice as any;
      }

      return await this.prisma.product.update({
        where: { id },
        data: {
          name: dto.name,
          codigo: dto.codigo !== undefined ? this.asOptional(dto.codigo) : undefined,
          barcode: dto.barcode !== undefined ? this.asOptional(dto.barcode) : undefined,
          price: priceToPersist,
          cost: dto.cost ? dec(dto.cost) as any : undefined,
          lowStockAlertQty: dto.lowStockAlertQty !== undefined ? this.asOptionalDecimal(dto.lowStockAlertQty) : undefined,
          allowFractionalQty: dto.allowFractionalQty,
          currency: dto.currency !== undefined ? dto.currency : undefined,
          image: dto.image,
          active: dto.active,
          productTypeId: dto.productTypeId !== undefined ? this.asOptional(dto.productTypeId) : undefined,
          productCategoryId: dto.productCategoryId !== undefined ? this.asOptional(dto.productCategoryId) : undefined,
          measurementUnitId: dto.measurementUnitId !== undefined ? this.asOptional(dto.measurementUnitId) : undefined,
        },
      });
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  private async ensurePriceChangeAllowed(productId: string) {
    const conflictingOpenSession = await this.prisma.cashSession.findFirst({
      where: {
        status: CashSessionStatus.OPEN,
        register: {
          warehouse: {
            stock: {
              some: {
                productId,
                qty: { gt: 0 },
              },
            },
          },
        },
      },
      select: {
        id: true,
        register: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    if (!conflictingOpenSession) return;

    const registerLabel = conflictingOpenSession.register?.name || conflictingOpenSession.register?.code || conflictingOpenSession.id;
    throw new BadRequestException(
      `No se puede modificar el precio mientras exista una sesión TPV abierta con stock de este producto. TPV en conflicto: ${registerLabel}.`
    );
  }

  findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        productType: true,
        productCategory: true,
        measurementUnit: true,
      },
    });
  }

  delete(id: string) {
    // Soft delete - solo desactivamos el producto
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }

  private asOptional(value?: string) {
    if (value === undefined || value === null) return undefined;
    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private asOptionalDecimal(value?: string) {
    const normalized = this.asOptional(value);
    if (normalized === undefined) return undefined;
    const parsed = dec(normalized);
    if (!parsed.isFinite() || parsed.lt(0)) {
      throw new BadRequestException("El umbral de stock bajo debe ser un número mayor o igual a 0.");
    }
    return dec(parsed.toFixed(3)) as any;
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = Array.isArray((error.meta as any)?.target)
          ? ((error.meta as any).target as string[])
          : [];
        if (target.includes("codigo")) {
          throw new ConflictException("Ya existe un producto con ese código.");
        }
        if (target.includes("barcode")) {
          throw new ConflictException("Ya existe un producto con ese código de barras.");
        }
        throw new ConflictException("Ya existe un producto con datos únicos duplicados.");
      }

      if (error.code === "P2003") {
        throw new BadRequestException("Referencia inválida en tipo/categoría/unidad de medida.");
      }
    }

    if (error instanceof Error) {
      throw new BadRequestException(error.message);
    }

    throw new BadRequestException("No se pudo guardar el producto.");
  }
}
