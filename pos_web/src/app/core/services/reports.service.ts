import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DetailedSale {
  id: string;
  createdAt: string;
  createdAtServer: string;
  status: 'PAID' | 'VOID' | string;
  total: number;
  cashierId: string;
  cashSessionId: string;
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
    };
  }>;
  payments: Array<{
    id: string;
    saleId: string;
    method: string;
    amount: number;
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
  salesByPaymentMethod: { method: string; amount: number }[];
  salesByCashier: { name: string; sales: number; amount: number }[];
  detailedSales: DetailedSale[];
}

export interface ServerDateInfo {
  serverDate: string;
  serverTimezone: string;
  serverNow: string;
  serverNowLabel: string;
}

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private readonly API_URL = 'http://localhost:3021/api/reports';

  constructor(private http: HttpClient) {}

  getSalesReport(startDate?: string, endDate?: string): Observable<SalesReport> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<SalesReport>(`${this.API_URL}/sales`, { params });
  }

  getServerDateInfo(): Observable<ServerDateInfo> {
    return this.http.get<ServerDateInfo>(`${this.API_URL}/server-date`);
  }
}
