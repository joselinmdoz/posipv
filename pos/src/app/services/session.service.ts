import { Injectable } from '@angular/core';

const KEY_PREFIX = 'pos_cash_session_id:';

@Injectable({ providedIn: 'root' })
export class SessionService {
  getCashSessionId(registerId: string): string | null {
    return localStorage.getItem(KEY_PREFIX + registerId);
  }

  setCashSessionId(registerId: string, sessionId: string) {
    localStorage.setItem(KEY_PREFIX + registerId, sessionId);
  }

  clearCashSessionId(registerId: string) {
    localStorage.removeItem(KEY_PREFIX + registerId);
  }

  clearAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(KEY_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }
}
