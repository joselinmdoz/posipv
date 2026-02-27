import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InventoryReportItem {
  id: string;
  productId: string;
  product: {
    id: string;
    name: string;
    codigo?: string;
    barcode?: string;
    price: number;
    unit?: string;
  };
  qty: number;
  price: number;
  total: number;
}

export interface InventoryReport {
  id: string;
  type: 'INITIAL' | 'FINAL';
  createdAt: string;
  totalValue: number;
  note?: string;
  cashSessionId: string;
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  items: InventoryReportItem[];
}

export interface SessionIvpLine {
  productId: string;
  name: string;
  codigo?: string | null;
  initial: number;
  entries: number;
  outs: number;
  sales: number;
  total: number;
  final: number;
  price: number;
  amount: number;
}

export interface SessionIvpReport {
  cashSessionId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
  register: {
    id: string;
    name: string;
    code: string;
  };
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  lines: SessionIvpLine[];
  totals: {
    initial: number;
    entries: number;
    outs: number;
    sales: number;
    total: number;
    final: number;
    amount: number;
  };
  paymentTotals: {
    CASH: number;
    CARD: number;
    TRANSFER: number;
    OTHER: number;
  };
  closed: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class InventoryReportsService {
  private http = inject(HttpClient);
  private readonly baseUrl = '/api/inventory-reports';

  createInitial(cashSessionId: string, warehouseId: string): Observable<InventoryReport> {
    return this.http.post<InventoryReport>(`${this.baseUrl}/initial`, {
      cashSessionId,
      warehouseId,
    });
  }

  createFinal(cashSessionId: string, warehouseId: string): Observable<InventoryReport> {
    return this.http.post<InventoryReport>(`${this.baseUrl}/final`, {
      cashSessionId,
      warehouseId,
    });
  }

  findBySession(cashSessionId: string): Observable<InventoryReport[]> {
    return this.http.get<InventoryReport[]>(`${this.baseUrl}/session/${cashSessionId}`);
  }

  getSessionIpv(cashSessionId: string): Observable<SessionIvpReport> {
    return this.http.get<SessionIvpReport>(`${this.baseUrl}/session/${cashSessionId}/ipv`);
  }

  getLatestBySession(cashSessionId: string, type?: 'INITIAL' | 'FINAL'): Observable<InventoryReport | null> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    return this.http.get<InventoryReport | null>(`${this.baseUrl}/session/${cashSessionId}/latest`, { params });
  }

  findByWarehouse(
    warehouseId: string,
    startDate?: string,
    endDate?: string,
  ): Observable<InventoryReport[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);
    return this.http.get<InventoryReport[]>(`${this.baseUrl}/warehouse/${warehouseId}`, { params });
  }

  findOne(id: string): Observable<InventoryReport> {
    return this.http.get<InventoryReport>(`${this.baseUrl}/${id}`);
  }
}
