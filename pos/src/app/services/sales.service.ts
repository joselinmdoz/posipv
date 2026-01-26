import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';

@Injectable({ providedIn: 'root' })
export class SalesService {
  constructor(private http: HttpClient) {}

  createSale(payload: {
    cashSessionId: string;
    items: Array<{ productId: string; qty: number }>;
    payments: Array<{ method: PaymentMethod; amount: string }>;
  }) {
    return this.http.post<any>('/api/sales', payload);
  }
}
