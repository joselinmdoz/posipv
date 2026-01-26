import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type StockMovementType = 'IN' | 'OUT' | 'TRANSFER';

export interface StockMovement {
  id: string;
  createdAt: string;
  type: StockMovementType;
  productId: string;
  productName?: string;
  qty: number;
  fromWarehouseId?: string | null;
  toWarehouseId?: string | null;
  reason?: string | null;
}

@Injectable({ providedIn: 'root' })
export class StockMovementService {
  constructor(private http: HttpClient) {}

  list(params?: { warehouseId?: string; from?: string; to?: string }) {
    const qs = new URLSearchParams();
    if (params?.warehouseId) qs.set('warehouseId', params.warehouseId);
    if (params?.from) qs.set('from', params.from);
    if (params?.to) qs.set('to', params.to);
    const q = qs.toString();
    return this.http.get<StockMovement[]>(`/api/stock-movements${q ? '?' + q : ''}`);
  }

  create(payload: {
    type: StockMovementType;
    productId: string;
    qty: number;
    fromWarehouseId?: string | null;
    toWarehouseId?: string | null;
    reason?: string | null;
  }) {
    return this.http.post<StockMovement>('/api/stock-movements', payload);
  }
}
