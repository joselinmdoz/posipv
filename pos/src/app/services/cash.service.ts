import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface CashSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  openingAmount: string;
  registerId: string;
}

@Injectable({ providedIn: 'root' })
export class CashService {
  constructor(private http: HttpClient) {}

  getOpen(registerId: string) {
    return this.http.get<CashSession | null>(`/api/cash-sessions/open?registerId=${encodeURIComponent(registerId)}`);
  }

  open(registerId: string, openingAmount: number, note?: string) {
    return this.http.post<CashSession>('/api/cash-sessions/open', {
      registerId,
      openingAmount: openingAmount.toFixed(2),
      note,
    });
  }

  close(sessionId: string, closingAmount: number, note?: string) {
    return this.http.post(`/api/cash-sessions/${sessionId}/close`, {
      closingAmount: closingAmount.toFixed(2),
      note,
    });
  }
}
