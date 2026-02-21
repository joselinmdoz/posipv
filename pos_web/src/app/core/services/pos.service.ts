import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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
}

export interface SaleItem {
  productId: string;
  productName: string;
  productSku?: string;
  price: number;
  qty: number;
  subtotal: number;
}

export interface Payment {
  method: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
  amount: number;
}

@Injectable({
  providedIn: 'root'
})
export class PosService {
  private readonly API_URL = 'http://localhost:3021/api';

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

  // Cart operations
  addToCart(product: any, qty: number = 1) {
    const currentCart = this._cart();
    const existingIndex = currentCart.findIndex(item => item.productId === product.id);

    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...currentCart];
      updated[existingIndex] = {
        ...updated[existingIndex],
        qty: updated[existingIndex].qty + qty,
        subtotal: (updated[existingIndex].qty + qty) * updated[existingIndex].price
      };
      this._cart.set(updated);
    } else {
      // Add new item
      this._cart.set([...currentCart, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        price: Number(product.price),
        qty,
        subtotal: Number(product.price) * qty
      }]);
    }
  }

  updateCartItemQty(productId: string, qty: number) {
    const currentCart = this._cart();
    if (qty <= 0) {
      this.removeFromCart(productId);
      return;
    }

    const updated = currentCart.map(item => 
      item.productId === productId 
        ? { ...item, qty, subtotal: item.price * qty }
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
    return this._cart().reduce((sum, item) => sum + item.subtotal, 0);
  }

  // Sales
  createSale(cashSessionId: string, items: any[], payments: Payment[]): Observable<any> {
    return this.http.post<any>(`${this.API_URL}/sales`, {
      cashSessionId,
      items: items.map(item => ({ productId: item.productId, qty: item.qty })),
      payments: payments.map(p => ({ method: p.method, amount: p.amount.toString() }))
    });
  }

  // Session state
  setCurrentSession(session: CashSession | null) {
    this._currentSession.set(session);
  }

  loadRegisters() {
    this.listRegisters().subscribe(registers => this._registers.set(registers));
  }
}
