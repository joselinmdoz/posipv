import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CashSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  openingAmount: number;
  closingAmount?: number;
  note?: string;
  registerId: string;
  register?: {
    id: string;
    name: string;
  };
  openedById: string;
  openedBy?: {
    id: string;
    email: string;
  };
  warehouseId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CashSessionsService {
  private readonly API_URL = 'http://localhost:3021/api';
  private readonly URL = `${this.API_URL}/cash-sessions`;

  constructor(private http: HttpClient) {}

  findAll(): Observable<CashSession[]> {
    return this.http.get<CashSession[]>(this.URL);
  }

  findOne(id: string): Observable<CashSession> {
    return this.http.get<CashSession>(`${this.URL}/${id}`);
  }

  openSession(registerId: string, openingAmount: number): Observable<CashSession> {
    return this.http.post<CashSession>(this.URL, { registerId, openingAmount });
  }

  closeSession(id: string, closingAmount: number, note?: string): Observable<CashSession> {
    return this.http.post<CashSession>(`${this.URL}/${id}/close`, { closingAmount, note });
  }

  getOpenSession(registerId: string): Observable<CashSession | null> {
    return this.http.get<CashSession | null>(`${this.URL}/open/${registerId}`);
  }
}
