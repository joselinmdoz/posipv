import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  CartItem,
  CashSession,
  CashSessionSummary,
  CurrencyCode,
  PaymentMethodCode,
  Register,
  RegisterSettings,
  SalePayment,
  SessionProduct
} from '../models/pos.model';

type CreateSaleResponse = {
  id: string;
  documentNumber: string;
  total: number | string;
};

@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly sessionStorageKey = 'pos_mobile_current_session';

  private readonly _currentSession = signal<CashSession | null>(null);
  private readonly _cart = signal<CartItem[]>([]);

  readonly currentSession = this._currentSession.asReadonly();
  readonly cart = this._cart.asReadonly();
  readonly cartTotal = computed(() => this._cart().reduce((sum, item) => sum + item.subtotal, 0));

  constructor() {
    this.restoreSession();
  }

  listRegisters(): Observable<Register[]> {
    return this.http.get<Register[]>(`${this.apiConfig.baseUrl}/registers`);
  }

  getRegisterSettings(registerId: string): Observable<RegisterSettings> {
    return this.http.get<RegisterSettings>(`${this.apiConfig.baseUrl}/settings/register/${registerId}`);
  }

  getOpenSession(registerId: string): Observable<CashSession | null> {
    return this.http.get<CashSession | null>(`${this.apiConfig.baseUrl}/cash-sessions/open?registerId=${registerId}`);
  }

  openSession(registerId: string, openingAmount: number, note?: string): Observable<CashSession> {
    return this.http.post<CashSession>(`${this.apiConfig.baseUrl}/cash-sessions/open`, {
      registerId,
      openingAmount: openingAmount.toString(),
      note
    });
  }

  closeSession(sessionId: string, closingAmount: number, note?: string): Observable<CashSession> {
    return this.http.post<CashSession>(`${this.apiConfig.baseUrl}/cash-sessions/${sessionId}/close`, {
      closingAmount: closingAmount.toString(),
      note
    });
  }

  getSessionSummary(sessionId: string): Observable<CashSessionSummary> {
    return this.http.get<CashSessionSummary>(`${this.apiConfig.baseUrl}/cash-sessions/${sessionId}/summary`);
  }

  listSessionProducts(cashSessionId: string): Observable<SessionProduct[]> {
    return this.http.get<SessionProduct[]>(`${this.apiConfig.baseUrl}/sales/session/${cashSessionId}/products`);
  }

  createSale(cashSessionId: string, items: CartItem[], payments: SalePayment[]): Observable<CreateSaleResponse> {
    return this.http.post<CreateSaleResponse>(`${this.apiConfig.baseUrl}/sales`, {
      cashSessionId,
      items: items.map((item) => ({ productId: item.productId, qty: item.qty })),
      payments: payments.map((payment) => ({
        method: payment.method,
        amountOriginal: payment.amount.toString(),
        amount: payment.amount.toString(),
        currency: payment.currency
      }))
    });
  }

  setCurrentSession(session: CashSession | null): void {
    this._currentSession.set(session);
    if (session) {
      localStorage.setItem(this.sessionStorageKey, JSON.stringify(session));
    } else {
      localStorage.removeItem(this.sessionStorageKey);
    }
  }

  addToCart(product: SessionProduct, qty = 1): void {
    const current = this._cart();
    const index = current.findIndex((item) => item.productId === product.id);
    const price = Number(product.price || 0);
    if (index >= 0) {
      const updated = [...current];
      const newQty = updated[index].qty + qty;
      updated[index] = { ...updated[index], qty: newQty, subtotal: price * newQty };
      this._cart.set(updated);
      return;
    }

    this._cart.set([
      ...current,
      {
        productId: product.id,
        productName: product.name,
        productCodigo: product.codigo,
        price,
        qty,
        subtotal: price * qty
      }
    ]);
  }

  updateCartItemQty(productId: string, qty: number): void {
    if (qty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this._cart.set(
      this._cart().map((item) =>
        item.productId === productId
          ? { ...item, qty, subtotal: item.price * qty }
          : item
      )
    );
  }

  removeFromCart(productId: string): void {
    this._cart.set(this._cart().filter((item) => item.productId !== productId));
  }

  clearCart(): void {
    this._cart.set([]);
  }

  normalizeCurrency(raw?: string | null): CurrencyCode {
    return String(raw || 'CUP').toUpperCase() === 'USD' ? 'USD' : 'CUP';
  }

  normalizePaymentMethod(raw?: string | null): PaymentMethodCode | null {
    const value = String(raw || '').trim().toUpperCase();
    if (!value) return null;
    if (value === 'CASH' || value === 'EFECTIVO') return 'CASH';
    if (value === 'CARD' || value === 'TARJETA') return 'CARD';
    if (value === 'TRANSFER' || value === 'TRANSFERENCIA') return 'TRANSFER';
    if (value === 'OTHER' || value === 'OTRO') return 'OTHER';
    return null;
  }

  private restoreSession(): void {
    const raw = localStorage.getItem(this.sessionStorageKey);
    if (!raw) return;
    try {
      this._currentSession.set(JSON.parse(raw) as CashSession);
    } catch {
      localStorage.removeItem(this.sessionStorageKey);
      this._currentSession.set(null);
    }
  }
}
