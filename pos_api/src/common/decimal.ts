import { Prisma } from "@prisma/client";

/**
 * Prisma usa Decimal (decimal.js). Estos helpers evitan errores de coma flotante.
 */
export function dec(value: string | number | Prisma.Decimal): Prisma.Decimal {
  if (value instanceof Prisma.Decimal) return value;
  return new Prisma.Decimal(value);
}

export function decToMoney(d: Prisma.Decimal): string {
  // 2 decimales exactos
  return d.toFixed(2);
}

export function moneyEq(a: Prisma.Decimal, b: Prisma.Decimal): boolean {
  return a.toFixed(2) === b.toFixed(2);
}
