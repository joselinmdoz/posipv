import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Product } from './products.service';

export interface Register {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface CashSession {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: Date;
  closedAt?: Date;
  openingAmount: number;
  closingAmount?: number;
  note?: string;
  registerId: string;
  openedById: string;
  openedBy?: {
    id: string;
    email: string;
    employee?: {
      id: string;
      firstName: string;
      lastName: string;
    } | null;
  };
}

export interface CashSessionSummary {
  id: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: Date;
  closedAt?: Date;
  openingAmount: number;
  register: {
    id: string;
    name: string;
    code: string;
  };
  salesCount: number;
  totalSales: number;
  paymentTotals: {
    CASH: number;
    CARD: number;
    TRANSFER: number;
    OTHER: number;
  };
}

export interface SaleItem {
  productId: string;
  productName: string;
  productCodigo?: string;
  price: number;
  qty: number;
  subtotal: number;
}

export interface Payment {
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  amount: number;
  currency?: 'CUP' | 'USD';
  transactionCode?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PosService {
  private readonly API_URL = '/api';

  // State signals
  private _currentSession = signal<CashSession | null>(null);
  private _cart = signal<SaleItem[]>([]);
  private _registers = signal<Register[]>([]);

  readonly currentSession = this._currentSession.asReadonly();
  readonly cart = this._cart.asReadonly();
  readonly registers = this._registers.asReadonly();

  constructor(private http: HttpClient) {}

  // Registers
  listRegisters(): Observable<Register[]> {
    return this.http.get<Register[]>(`${this.API_URL}/registers`);
  }

  // Cash Sessions
  getOpenSession(registerId: string): Observable<CashSession | null> {
    return this.http.get<CashSession | null>(`${this.API_URL}/cash-sessions/open?registerId=${registerId}`);
  }

  openSession(registerId: string, openingAmount: number, note?: string): Observable<CashSession> {
    return this.http.post<CashSession>(`${this.API_URL}/cash-sessions/open`, {
      registerId,
      openingAmount: openingAmount.toString(),
      note
    });
  }

  closeSession(sessionId: string, closingAmount: number, note?: string): Observable<CashSession> {
    return this.http.post<CashSession>(`${this.API_URL}/cash-sessions/${sessionId}/close`, {
      closingAmount: closingAmount.toString(),
      note
    });
  }

  createSessionMovement(
    sessionId: string,
    dto: { type: 'IN' | 'OUT'; productId: string; qty: number; reason?: string }
  ): Observable<any> {
    return this.http.post(`${this.API_URL}/cash-sessions/${sessionId}/movement`, dto);
  }

  getSessionSummary(sessionId: string): Observable<CashSessionSummary> {
    return this.http.get<CashSessionSummary>(`${this.API_URL}/cash-sessions/${sessionId}/summary`);
  }

  // Cart operations
  addToCart(product: any, qty: number = 1) {
    const normalizedQty = this.normalizeQty(qty);
    if (normalizedQty <= 0) return;

    const currentCart = this._cart();
    const existingIndex = currentCart.findIndex(item => item.productId === product.id);

    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...currentCart];
      const nextQty = this.normalizeQty(updated[existingIndex].qty + normalizedQty);
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: nextQty,
        subtotal: this.roundMoney(nextQty * updated[existingIndex].price)
      };
      this._cart.set(updated);
    } else {
      // Add new item
      this._cart.set([...currentCart, {
        productId: product.id,
        productName: product.name,
        productCodigo: product.codigo,
        price: Number(product.price),
        qty: normalizedQty,
        subtotal: this.roundMoney(Number(product.price) * normalizedQty)
      }]);
    }
  }

  updateCartItemQty(productId: string, qty: number) {
    const currentCart = this._cart();
    const normalizedQty = this.normalizeQty(qty);

    const updated = currentCart.map(item => 
      item.productId === productId 
        ? { ...item, qty: normalizedQty, subtotal: this.roundMoney(item.price * normalizedQty) }
        : item
    );
    this._cart.set(updated);
  }

  removeFromCart(productId: string) {
    const currentCart = this._cart();
    this._cart.set(currentCart.filter(item => item.productId !== productId));
  }

  clearCart() {
    this._cart.set([]);
  }

  getCartTotal(): number {
    return this.roundMoney(this._cart().reduce((sum, item) => sum + item.subtotal, 0));
  }

  // Sales
  listSessionProducts(cashSessionId: string): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.API_URL}/sales/session/${cashSessionId}/products`);
  }

  createSale(cashSessionId: string, items: any[], payments: Payment[], customerId?: string, customerName?: string): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/sales`, {
      cashSessionId,
      customerId: customerId || undefined,
      customerName: customerName || undefined,
      items: items.map(item => ({ productId: item.productId, qty: item.qty })),
      payments: payments.map(p => ({
        method: p.method,
        amountOriginal: p.amount.toString(),
        amount: p.amount.toString(),
        currency: p.currency || 'CUP',
        transactionCode: p.transactionCode?.trim() || undefined
      }))
    });
  }

  // Session state
  setCurrentSession(session: CashSession | null) {
    this._currentSession.set(session);
  }

  loadRegisters() {
    this.listRegisters().subscribe(registers => this._registers.set(registers));
  }

  private normalizeQty(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Number(parsed.toFixed(6));
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }
}
