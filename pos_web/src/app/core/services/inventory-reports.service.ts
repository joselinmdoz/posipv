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
  currency?: 'CUP' | 'USD' | string;
  initial: number;
  entries: number;
  outs: number;
  sales: number;
  total: number;
  final: number;
  price: number;
  amount: number;
  gp?: number;
  gain?: number;
}

export interface SessionIvpReport {
  cashSessionId: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string | null;
  responsible?: {
    userId: string;
    email: string;
    employeeId?: string | null;
    employeeName?: string | null;
  };
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
    entriesCount?: number;
    outs: number;
    outsCount?: number;
    sales: number;
    salesCount?: number;
    total: number;
    final: number;
    amount: number;
    profit?: number;
  };
  paymentTotals: {
    CASH: number;
    CARD: number;
    TRANSFER: number;
    OTHER: number;
  };
  closed: boolean;
}

export interface ManualIvpRegisterOption {
  id: string;
  name: string;
  code: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface ManualIvpEmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  active: boolean;
  userId: string | null;
  user?: {
    id: string;
    email: string;
    active: boolean;
  } | null;
}

export interface ManualIvpPaymentMethodOption {
  code: string;
  name: string;
  requiresTransactionCode?: boolean;
}

export interface ManualIvpLine {
  productId: string;
  codigo?: string;
  name: string;
  currency?: string;
  allowFractionalQty?: boolean;
  price: number;
  cost?: number;
  initial: number;
  entries: number;
  outs: number;
  sales: number;
  total: number;
  final: number;
  amount: number;
  gp?: number;
  gain?: number;
}

export interface ManualIvpBootstrap {
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
  reportDate: string;
  isFirstReport: boolean;
  previousReportId?: string | null;
  editing: boolean;
  existingReportId?: string | null;
  note?: string;
  employees: ManualIvpEmployeeOption[];
  paymentMethods: ManualIvpPaymentMethodOption[];
  selectedEmployeeIds: string[];
  paymentBreakdown: Record<string, number>;
  lines: ManualIvpLine[];
}

export interface ManualIvpReport {
  id: string;
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
  reportDate: string;
  note?: string;
  employeeIds: string[];
  employees: ManualIvpEmployeeOption[];
  paymentMethods: ManualIvpPaymentMethodOption[];
  paymentBreakdown: Record<string, number>;
  lines: ManualIvpLine[];
  totals: {
    initial: number;
    entries: number;
    outs: number;
    sales: number;
    total: number;
    final: number;
    amount: number;
    profit?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SaveManualIvpPayload {
  registerId: string;
  reportDate: string;
  note?: string;
  employeeIds?: string[];
  paymentBreakdown?: Record<string, number>;
  lines: Array<{
    productId: string;
    initial: number;
    entries: number;
    outs: number;
    sales: number;
  }>;
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

  deleteReport(id: string): Observable<{ ok: boolean; deletedReportId: string }> {
    return this.http.delete<{ ok: boolean; deletedReportId: string }>(`${this.baseUrl}/${id}`);
  }

  deleteSessionReport(cashSessionId: string): Observable<{ ok: boolean; cashSessionId: string; deletedReports: number }> {
    return this.http.delete<{ ok: boolean; cashSessionId: string; deletedReports: number }>(
      `${this.baseUrl}/session/${cashSessionId}`
    );
  }

  listManualRegisters(): Observable<ManualIvpRegisterOption[]> {
    return this.http.get<ManualIvpRegisterOption[]>(`${this.baseUrl}/manual/registers`);
  }

  getManualBootstrap(registerId: string, reportDate?: string): Observable<ManualIvpBootstrap> {
    let params = new HttpParams().set('registerId', registerId);
    if (reportDate) params = params.set('reportDate', reportDate);
    return this.http.get<ManualIvpBootstrap>(`${this.baseUrl}/manual/bootstrap`, { params });
  }

  getManualById(id: string): Observable<ManualIvpReport> {
    return this.http.get<ManualIvpReport>(`${this.baseUrl}/manual/${id}`);
  }

  saveManual(payload: SaveManualIvpPayload): Observable<ManualIvpReport> {
    return this.http.post<ManualIvpReport>(`${this.baseUrl}/manual`, payload);
  }

  updateManual(id: string, payload: SaveManualIvpPayload): Observable<ManualIvpReport> {
    return this.http.put<ManualIvpReport>(`${this.baseUrl}/manual/${id}`, payload);
  }

  listManual(params?: {
    registerId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
  }): Observable<ManualIvpReport[]> {
    let httpParams = new HttpParams();
    if (params?.registerId) httpParams = httpParams.set('registerId', params.registerId);
    if (params?.warehouseId) httpParams = httpParams.set('warehouseId', params.warehouseId);
    if (params?.startDate) httpParams = httpParams.set('startDate', params.startDate);
    if (params?.endDate) httpParams = httpParams.set('endDate', params.endDate);
    return this.http.get<ManualIvpReport[]>(`${this.baseUrl}/manual`, { params: httpParams });
  }

  deleteManual(id: string): Observable<{ ok: boolean; deletedReportId: string }> {
    return this.http.delete<{ ok: boolean; deletedReportId: string }>(`${this.baseUrl}/manual/${id}`);
  }
}
