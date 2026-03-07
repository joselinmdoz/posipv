import { AccountingAccountType, CurrencyCode } from '@/app/core/services/accounting.service';

export const ACCOUNT_TYPE_OPTIONS = [
  { label: 'Activo', value: 'ASSET' as AccountingAccountType },
  { label: 'Pasivo', value: 'LIABILITY' as AccountingAccountType },
  { label: 'Patrimonio', value: 'EQUITY' as AccountingAccountType },
  { label: 'Ingreso', value: 'INCOME' as AccountingAccountType },
  { label: 'Gasto', value: 'EXPENSE' as AccountingAccountType }
];

export const ACCOUNT_TYPE_FILTER_OPTIONS: Array<{ label: string; value: AccountingAccountType | '' }> = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Activo', value: 'ASSET' },
  { label: 'Pasivo', value: 'LIABILITY' },
  { label: 'Patrimonio', value: 'EQUITY' },
  { label: 'Ingreso', value: 'INCOME' },
  { label: 'Gasto', value: 'EXPENSE' }
];

export const ACCOUNT_STATUS_FILTER_OPTIONS: Array<{ label: string; value: 'ALL' | 'ACTIVE' | 'INACTIVE' }> = [
  { label: 'Todos los estados', value: 'ALL' },
  { label: 'Activas', value: 'ACTIVE' },
  { label: 'Inactivas', value: 'INACTIVE' }
];

export const PERIOD_STATUS_FILTER_OPTIONS: Array<{ label: string; value: '' | 'OPEN' | 'CLOSED' }> = [
  { label: 'Todos los estados', value: '' },
  { label: 'Abiertos', value: 'OPEN' },
  { label: 'Cerrados', value: 'CLOSED' }
];

export const YES_NO_OPTIONS = [
  { label: 'Sí', value: true },
  { label: 'No', value: false }
];

export const ACTIVE_OPTIONS = [
  { label: 'Activo', value: true },
  { label: 'Inactivo', value: false }
];

export const LINE_SIDE_OPTIONS = [
  { label: 'Débito', value: 'DEBIT' as const },
  { label: 'Crédito', value: 'CREDIT' as const }
];

export const CURRENCY_OPTIONS = [
  { label: 'CUP', value: 'CUP' as CurrencyCode },
  { label: 'USD', value: 'USD' as CurrencyCode }
];

export function accountTypeLabel(type: AccountingAccountType): string {
  const map: Record<AccountingAccountType, string> = {
    ASSET: 'Activo',
    LIABILITY: 'Pasivo',
    EQUITY: 'Patrimonio',
    INCOME: 'Ingreso',
    EXPENSE: 'Gasto'
  };
  return map[type] || type;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function toInputDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function postingRuleLabel(
  key: 'SALE_REVENUE_CUP' | 'SALE_REVENUE_USD' | 'SALE_COGS' | 'STOCK_IN' | 'STOCK_OUT'
): string {
  const map = {
    SALE_REVENUE_CUP: 'Ingreso venta CUP',
    SALE_REVENUE_USD: 'Ingreso venta USD',
    SALE_COGS: 'Costo de venta',
    STOCK_IN: 'Entrada inventario',
    STOCK_OUT: 'Salida inventario'
  } as const;
  return map[key] || key;
}
