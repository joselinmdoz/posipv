import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SystemCurrencyCode } from './settings.service';

export type PaymentMethodCode = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

export interface DirectSaleProduct {
  id: string;
  name: string;
  codigo?: string | null;
  barcode?: string | null;
  price: number;
  currency: SystemCurrencyCode;
  qtyAvailable: number;
  image?: string | null;
  active: boolean;
}

export interface CreateDirectSaleDto {
  warehouseId: string;
  customerId?: string;
  customerName?: string;
  items: Array<{ productId: string; qty: number }>;
  payments: Array<{
    method: PaymentMethodCode;
    amountOriginal: string;
    amount?: string;
    currency: SystemCurrencyCode;
    transactionCode?: string;
  }>;
}

export interface DirectSale {
  id: string;
  createdAt: string;
  status: 'PAID' | 'VOID' | string;
  channel: 'DIRECT' | 'TPV' | string;
  documentNumber: string | null;
  customerId?: string | null;
  customerName: string | null;
  total: number;
  warehouseId: string | null;
}

export interface DirectSaleTicket {
  saleId: string;
  documentNumber: string | null;
  createdAt: string;
  customerId?: string | null;
  customerName: string | null;
  customer?: {
    id: string;
    name: string;
    identification: string;
  } | null;
  cashier: {
    id: string;
    email: string;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
  } | null;
  totals: {
    total: number;
    paymentTotal: number;
  };
  items: Array<{
    productId: string;
    name: string;
    codigo: string | null;
    barcode: string | null;
    currency: SystemCurrencyCode;
    qty: number;
    price: number;
    subtotal: number;
  }>;
  payments: Array<{
    method: PaymentMethodCode;
    amount: number;
    amountOriginal: number;
    transactionCode?: string | null;
    currency: SystemCurrencyCode;
    exchangeRateUsdToCup: number | null;
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class DirectSalesService {
  private readonly API_URL = '/api/direct-sales';

  constructor(private readonly http: HttpClient) {}

  listWarehouseProducts(warehouseId: string): Observable<DirectSaleProduct[]> {
    return this.http.get<DirectSaleProduct[]>(`${this.API_URL}/warehouse/${warehouseId}/products`);
  }

  createSale(payload: CreateDirectSaleDto): Observable<DirectSale> {
    return this.http.post<DirectSale>(this.API_URL, payload);
  }

  getTicket(saleId: string): Observable<DirectSaleTicket> {
    return this.http.get<DirectSaleTicket>(`${this.API_URL}/${saleId}/ticket`);
  }
}
