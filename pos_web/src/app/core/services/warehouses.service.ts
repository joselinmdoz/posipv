import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: 'CENTRAL' | 'TPV';
  active: boolean;
  createdAt: Date;
}

export interface StockItem {
  id: string;
  warehouseId: string;
  productId: string;
  qty: number;
  product: {
    id: string;
    name: string;
    sku?: string;
  };
}

export interface CreateWarehouseDto {
  name: string;
  code: string;
  type: 'CENTRAL' | 'TPV';
}

export interface UpdateWarehouseDto {
  name?: string;
  code?: string;
  type?: 'CENTRAL' | 'TPV';
  active?: boolean;
}

export interface StockMovement {
  id: string;
  type: 'IN' | 'OUT' | 'TRANSFER';
  productId: string;
  qty: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  reason?: string;
  createdAt: Date;
  product: { id: string; name: string };
  fromWarehouse?: { id: string; name: string };
  toWarehouse?: { id: string; name: string };
}

export interface CreateStockMovementDto {
  type: 'IN' | 'OUT' | 'TRANSFER';
  productId: string;
  qty: number;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  reason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class WarehousesService {
  private readonly API_URL = 'http://localhost:3021/api';
  private readonly WAREHOUSES_URL = `${this.API_URL}/warehouses`;
  private readonly MOVEMENTS_URL = `${this.API_URL}/stock-movements`;

  constructor(private http: HttpClient) {}

  // Warehouses
  listWarehouses(): Observable<Warehouse[]> {
    return this.http.get<Warehouse[]>(this.WAREHOUSES_URL);
  }

  findWarehouse(id: string): Observable<Warehouse> {
    return this.http.get<Warehouse>(`${this.WAREHOUSES_URL}/${id}`);
  }

  createWarehouse(dto: CreateWarehouseDto): Observable<Warehouse> {
    return this.http.post<Warehouse>(this.WAREHOUSES_URL, dto);
  }

  updateWarehouse(id: string, dto: UpdateWarehouseDto): Observable<Warehouse> {
    return this.http.put<Warehouse>(`${this.WAREHOUSES_URL}/${id}`, dto);
  }

  deleteWarehouse(id: string): Observable<void> {
    return this.http.delete<void>(`${this.WAREHOUSES_URL}/${id}`);
  }

  // Stock
  getStock(warehouseId: string): Observable<StockItem[]> {
    return this.http.get<StockItem[]>(`${this.WAREHOUSES_URL}/${warehouseId}/stock`);
  }

  // Stock Movements
  listMovements(params?: { warehouseId?: string; from?: string; to?: string }): Observable<StockMovement[]> {
    const queryParams = new URLSearchParams();
    if (params?.warehouseId) queryParams.set('warehouseId', params.warehouseId);
    if (params?.from) queryParams.set('from', params.from);
    if (params?.to) queryParams.set('to', params.to);
    
    const url = queryParams.toString() ? `${this.MOVEMENTS_URL}?${queryParams}` : this.MOVEMENTS_URL;
    return this.http.get<StockMovement[]>(url);
  }

  createMovement(dto: CreateStockMovementDto): Observable<StockMovement> {
    return this.http.post<StockMovement>(this.MOVEMENTS_URL, dto);
  }
}
