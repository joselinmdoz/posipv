import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SystemCurrencyCode } from './settings.service';

export type PurchaseStatus = 'DRAFT' | 'CONFIRMED' | 'VOID';

export interface PurchaseSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  voidedAt?: string | null;
  status: PurchaseStatus;
  documentNumber?: string | null;
  supplierName?: string | null;
  supplierDocument?: string | null;
  note?: string | null;
  subtotal: string | number;
  total: string | number;
  currency: SystemCurrencyCode;
  warehouseId: string;
  warehouse: {
    id: string;
    name: string;
    code: string;
  };
  createdById: string;
  createdBy: {
    id: string;
    email: string;
  };
}

export interface PurchaseItemDetail {
  id: string;
  purchaseId: string;
  productId: string;
  qty: number;
  cost: string | number;
  total: string | number;
  product: {
    id: string;
    name: string;
    codigo?: string | null;
    barcode?: string | null;
    currency: SystemCurrencyCode;
  };
}

export interface PurchaseDetail extends PurchaseSummary {
  warehouse: {
    id: string;
    name: string;
    code: string;
    type: 'CENTRAL' | 'TPV';
  };
  createdBy: {
    id: string;
    email: string;
    role: string;
  };
  items: PurchaseItemDetail[];
}

export interface PurchaseItemInput {
  productId: string;
  qty: number;
  cost: number;
}

export interface CreatePurchaseDto {
  warehouseId: string;
  supplierName?: string;
  supplierDocument?: string;
  documentNumber?: string;
  note?: string;
  currency?: SystemCurrencyCode;
  status?: PurchaseStatus;
  items: PurchaseItemInput[];
}

export interface UpdatePurchaseDto {
  warehouseId?: string;
  supplierName?: string;
  supplierDocument?: string;
  documentNumber?: string;
  note?: string;
  currency?: SystemCurrencyCode;
  items?: PurchaseItemInput[];
}

@Injectable({
  providedIn: 'root'
})
export class PurchasesService {
  private readonly API_URL = '/api/purchases';

  constructor(private readonly http: HttpClient) {}

  list(params?: {
    q?: string;
    warehouseId?: string;
    status?: PurchaseStatus;
    from?: string;
    to?: string;
    limit?: number;
  }): Observable<PurchaseSummary[]> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.warehouseId) query.set('warehouseId', params.warehouseId);
    if (params?.status) query.set('status', params.status);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    return this.http.get<PurchaseSummary[]>(`${this.API_URL}${suffix ? `?${suffix}` : ''}`);
  }

  findOne(id: string): Observable<PurchaseDetail> {
    return this.http.get<PurchaseDetail>(`${this.API_URL}/${id}`);
  }

  create(payload: CreatePurchaseDto): Observable<PurchaseDetail> {
    return this.http.post<PurchaseDetail>(this.API_URL, payload);
  }

  update(id: string, payload: UpdatePurchaseDto): Observable<PurchaseDetail> {
    return this.http.put<PurchaseDetail>(`${this.API_URL}/${id}`, payload);
  }

  confirm(id: string): Observable<PurchaseDetail> {
    return this.http.put<PurchaseDetail>(`${this.API_URL}/${id}/confirm`, {});
  }

  void(id: string, reason?: string): Observable<PurchaseDetail> {
    return this.http.put<PurchaseDetail>(`${this.API_URL}/${id}/void`, { reason: reason?.trim() || undefined });
  }

  delete(id: string): Observable<{ ok: boolean; id: string }> {
    return this.http.delete<{ ok: boolean; id: string }>(`${this.API_URL}/${id}`);
  }
}

