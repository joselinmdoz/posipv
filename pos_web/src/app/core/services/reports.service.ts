import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DetailedSale {
  id: string;
  createdAt: string;
  createdAtServer: string;
  status: 'PAID' | 'VOID' | string;
  channel: 'TPV' | 'DIRECT' | string;
  total: number;
  cashierId: string;
  cashSessionId: string | null;
  warehouseId?: string | null;
  warehouse?: {
    id: string;
    name: string;
    code: string;
    type: 'CENTRAL' | 'TPV' | string;
  } | null;
  customerName?: string | null;
  documentNumber?: string | null;
  items: Array<{
    id: string;
    saleId: string;
    productId: string;
    qty: number;
    price: number;
    product: {
      id: string;
      name: string;
      codigo: string | null;
      barcode: string | null;
      currency: 'CUP' | 'USD' | string;
    };
  }>;
  payments: Array<{
    id: string;
    saleId: string;
    method: string;
    amount: number;
    currency: 'CUP' | 'USD' | string;
    amountOriginal: number;
    exchangeRateUsdToCup: number | null;
    exchangeRateRecordId: string | null;
  }>;
  cashier: {
    id: string;
    email: string;
    role: string;
    active: boolean;
    createdAt: string;
  };
}

export interface SalesReport {
  serverDate: string;
  serverTimezone: string;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalAmount: number;
  averageTicket: number;
  salesByPaymentMethod: {
    method: string;
    currency: 'CUP' | 'USD' | string;
    amountOriginal: number;
    amountBase: number;
  }[];
  salesByCashier: { name: string; sales: number; amount: number }[];
  detailedSales: DetailedSale[];
}

export interface ServerDateInfo {
  serverDate: string;
  serverTimezone: string;
  serverNow: string;
  serverNowLabel: string;
}

export interface SalesReportFilters {
  channel?: 'TPV' | 'DIRECT' | '';
  warehouseId?: string;
  cashierEmail?: string;
  customerName?: string;
  documentNumber?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private readonly API_URL = '/api/reports';

  constructor(private http: HttpClient) {}

  getSalesReport(startDate?: string, endDate?: string, filters?: SalesReportFilters): Observable<SalesReport> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    if (filters?.channel) params = params.set('channel', filters.channel);
    if (filters?.warehouseId) params = params.set('warehouseId', filters.warehouseId);
    if (filters?.cashierEmail) params = params.set('cashierEmail', filters.cashierEmail.trim());
    if (filters?.customerName) params = params.set('customerName', filters.customerName.trim());
    if (filters?.documentNumber) params = params.set('documentNumber', filters.documentNumber.trim());
    return this.http.get<SalesReport>(`${this.API_URL}/sales`, { params });
  }

  getServerDateInfo(): Observable<ServerDateInfo> {
    return this.http.get<ServerDateInfo>(`${this.API_URL}/server-date`);
  }
}
