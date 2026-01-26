import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RegisterService } from '../../services/register.service';
import { CashService, CashSession } from '../../services/cash.service';
import { Product, ProductService } from '../../services/product.service';
import { SalesService } from '../../services/sales.service';

type CartLine = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pos.component.html',
  styleUrls: ['./pos.component.scss'],
})
export class PosComponent {
  private readonly reg = inject(RegisterService);
  private readonly cash = inject(CashService);
  private readonly productsApi = inject(ProductService);
  private readonly sales = inject(SalesService);

  registerId = this.reg.selectedId;

  session = signal<CashSession | null>(null);
  products = signal<Product[]>([]);
  cart = signal<CartLine[]>([]);

  q = '';
  opening = 100;
  note = '';

  busy = signal(false);
  paying = signal(false);
  err = signal('');
  ok = signal('');

  total = computed(() => this.cart().reduce((acc, c) => acc + c.price * c.qty, 0));

  filtered = computed(() => {
    const query = this.q.trim().toLowerCase();
    const items = this.products();
    if (!query) return items;
    return items.filter((p) => p.name.toLowerCase().includes(query) || (p.sku || '').toLowerCase().includes(query));
  });

  constructor() {
    this.load();
  }

  private load() {
    const rid = this.registerId();
    if (!rid) return;

    this.productsApi.list().subscribe({
      next: (p) => this.products.set(p),
    });

    this.cash.getOpen(rid).subscribe({
      next: (sess) => this.session.set(sess),
      error: () => this.err.set('No se pudo verificar la sesión de caja.'),
    });
  }

  toMoney(v: string) {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : v;
  }

  openSession() {
    const rid = this.registerId();
    if (!rid) return;

    this.err.set('');
    this.ok.set('');
    this.busy.set(true);

    this.cash.open(rid, Number(this.opening), this.note || undefined).subscribe({
      next: (sess) => {
        this.session.set(sess);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        const msg = e?.error?.message;
        this.err.set(Array.isArray(msg) ? msg.join(', ') : msg || 'No se pudo abrir la caja.');
      },
    });
  }

  createDemo() {
    this.productsApi.create({ name: 'Producto Demo', price: 5 }).subscribe({
      next: () => this.productsApi.list().subscribe((p) => this.products.set(p)),
      error: () => this.err.set('No se pudo crear el producto demo.'),
    });
  }

  add(p: Product) {
    this.err.set('');
    this.ok.set('');

    const price = Number(p.price);
    const cart = [...this.cart()];
    const found = cart.find((x) => x.id === p.id);
    if (found) found.qty += 1;
    else cart.push({ id: p.id, name: p.name, price: Number.isFinite(price) ? price : 0, qty: 1 });
    this.cart.set(cart);
  }

  inc(line: CartLine) {
    const cart = [...this.cart()];
    const found = cart.find((x) => x.id === line.id);
    if (found) found.qty += 1;
    this.cart.set(cart);
  }

  dec(line: CartLine) {
    const cart = [...this.cart()];
    const found = cart.find((x) => x.id === line.id);
    if (!found) return;
    found.qty -= 1;
    this.cart.set(found.qty <= 0 ? cart.filter((x) => x.id !== line.id) : cart);
  }

  payCash() {
    const sess = this.session();
    if (!sess) {
      this.err.set('No hay sesión abierta.');
      return;
    }

    if (!this.cart().length) return;

    this.err.set('');
    this.ok.set('');
    this.paying.set(true);

    const total = this.total();
    const payload = {
      cashSessionId: sess.id,
      items: this.cart().map((c) => ({ productId: c.id, qty: c.qty })),
      payments: [{ method: 'CASH' as const, amount: total.toFixed(2) }],
    };

    this.sales.createSale(payload).subscribe({
      next: (res) => {
        this.paying.set(false);
        this.cart.set([]);
        this.ok.set(`✅ Venta OK: ${res?.id || 'OK'}`);
      },
      error: (e) => {
        this.paying.set(false);
        const msg = e?.error?.message;
        this.err.set(Array.isArray(msg) ? msg.join(', ') : msg || 'No se pudo completar la venta.');
      },
    });
  }
}
