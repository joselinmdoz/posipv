import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../api.config';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type?: 'CENTRAL' | 'TPV';
  active?: boolean;
}

export interface WarehouseStockLine {
  productId: string;
  name: string;
  sku?: string | null;
  qty: number;
}

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Warehouse[]>(`${API_BASE_URL}/api/warehouses`);
  }

  create(data: { name: string; code: string; type?: string }) {
    return this.http.post<Warehouse>(`${API_BASE_URL}/api/warehouses`, data);
  }

  stock(warehouseId: string) {
    return this.http.get<WarehouseStockLine[]>(`${API_BASE_URL}/api/warehouses/${encodeURIComponent(warehouseId)}/stock`);
  }
}
