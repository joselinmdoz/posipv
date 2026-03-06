export type PaymentMethodCode = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type CurrencyCode = 'CUP' | 'USD';

export interface Register {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface PaymentMethodSetting {
  id: string;
  code: string;
  name: string;
  enabled: boolean;
}

export interface RegisterSettings {
  id: string;
  registerId: string;
  defaultOpeningFloat: number | string;
  currency: string;
  warehouseId?: string;
  paymentMethods: PaymentMethodSetting[];
}

export interface CashSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  openingAmount: number | string;
  closingAmount?: number | string;
  note?: string;
  registerId: string;
  openedById: string;
}

export interface CashSessionSummary {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  register: {
    id: string;
    name: string;
    code: string;
  };
  salesCount: number;
  totalSales: number;
  paymentTotals: {
    CASH: number;
    CARD: number;
    TRANSFER: number;
    OTHER: number;
  };
}

export interface SessionProduct {
  id: string;
  name: string;
  codigo?: string;
  price: number | string;
  qtyAvailable: number | string;
}

export interface CartItem {
  productId: string;
  productName: string;
  productCodigo?: string;
  price: number;
  qty: number;
  subtotal: number;
}

export interface SalePayment {
  method: PaymentMethodCode;
  amount: number;
  currency: CurrencyCode;
}
