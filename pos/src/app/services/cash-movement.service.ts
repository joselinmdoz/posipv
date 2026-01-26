import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export type CashMovementType = 'IN' | 'OUT';

export interface CashMovement {
  id: string;
  createdAt: string;
  type: CashMovementType;
  amount: string;
  reason?: string | null;
  cashSessionId: string;
}

@Injectable({ providedIn: 'root' })
export class CashMovementService {
  constructor(private http: HttpClient) {}

  list(cashSessionId: string) {
    return this.http.get<CashMovement[]>(`/api/cash-sessions/${encodeURIComponent(cashSessionId)}/cash-movements`);
  }

  create(cashSessionId: string, payload: { type: CashMovementType; amount: string; reason?: string | null }) {
    return this.http.post<CashMovement>(
      `/api/cash-sessions/${encodeURIComponent(cashSessionId)}/cash-movements`,
      payload,
    );
  }
}
