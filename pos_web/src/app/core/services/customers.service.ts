import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Customer {
  id: string;
  name: string;
  identification: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  purchasesCount: number;
  totalAmount: number;
  lastPurchaseAt: string | null;
}

export interface CreateCustomerDto {
  name: string;
  identification: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface UpdateCustomerDto {
  name?: string;
  identification?: string;
  phone?: string;
  email?: string;
  address?: string;
  active?: boolean;
}

export interface CustomerHistory {
  customer: {
    id: string;
    name: string;
    identification: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  };
  summary: {
    purchasesCount: number;
    totalAmount: number;
    lastPurchaseAt: string | null;
  };
  recentSales: Array<{
    id: string;
    documentNumber: string | null;
    channel: 'TPV' | 'DIRECT' | string;
    total: number;
    createdAt: string;
    warehouse: {
      id: string;
      name: string;
      code: string;
    } | null;
    cashier: {
      id: string;
      email: string;
    };
  }>;
}

@Injectable({
  providedIn: 'root'
})
export class CustomersService {
  private readonly API_URL = '/api/customers';

  constructor(private readonly http: HttpClient) {}

  list(params?: { q?: string; active?: boolean; limit?: number }): Observable<Customer[]> {
    let query = new HttpParams();
    if (params?.q) query = query.set('q', params.q);
    if (params?.active !== undefined) query = query.set('active', String(params.active));
    if (params?.limit) query = query.set('limit', String(params.limit));
    return this.http.get<Customer[]>(this.API_URL, { params: query });
  }

  create(payload: CreateCustomerDto): Observable<Customer> {
    return this.http.post<Customer>(this.API_URL, payload);
  }

  findOne(customerId: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.API_URL}/${customerId}`);
  }

  update(customerId: string, payload: UpdateCustomerDto): Observable<Customer> {
    return this.http.put<Customer>(`${this.API_URL}/${customerId}`, payload);
  }

  getHistory(customerId: string): Observable<CustomerHistory> {
    return this.http.get<CustomerHistory>(`${this.API_URL}/${customerId}/history`);
  }
}
