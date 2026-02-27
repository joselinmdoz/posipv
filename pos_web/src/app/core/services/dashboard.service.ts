import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DashboardSummary {
  salesToday: number;
  transactionsToday: number;
  openSessions: number;
  lowStock: number;
  lastSaleAt?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly API_URL = '/api/dashboard';

  constructor(private http: HttpClient) {}

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.API_URL}/summary`);
  }
}

