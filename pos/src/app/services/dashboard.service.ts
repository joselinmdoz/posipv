import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface DashboardSummary {
  salesToday: number;
  transactionsToday: number;
  openSessions: number;
  lowStock: number;
  lastSaleAt?: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  constructor(private http: HttpClient) {}

  summary() {
    return this.http.get<DashboardSummary>('/api/dashboard/summary');
  }
}
