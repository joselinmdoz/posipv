import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StockMovement, StockMovementService, StockMovementType } from '../../services/stock-movement.service';
import { Warehouse, WarehouseService } from '../../services/warehouse.service';
import { Product, ProductService } from '../../services/product.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stock-movements.component.html',
  styleUrls: ['./stock-movements.component.scss'],
})
export class StockMovementsComponent {
  private readonly api = inject(StockMovementService);
  private readonly warehousesApi = inject(WarehouseService);
  private readonly productsApi = inject(ProductService);
  private readonly toast = inject(ToastService);

  readonly warehouses = signal<Warehouse[]>([]);
  readonly products = signal<Product[]>([]);
  readonly movements = signal<StockMovement[]>([]);

  readonly busy = signal(false);
  readonly busyList = signal(false);
  readonly error = signal<string | null>(null);

  type: StockMovementType = 'IN';
  productId = '';
  qty = 1;
  fromWarehouseId = '';
  toWarehouseId = '';
  reason = '';

  filterWarehouseId = '';

  constructor() {
    this.bootstrap();
  }

  bootstrap() {
    this.warehousesApi.list().pipe(catchError(() => of([]))).subscribe((d) => this.warehouses.set(d));
    this.productsApi.list().pipe(catchError(() => of([]))).subscribe((d) => this.products.set(d));
    this.reload();
  }

  canCreate() {
    if (!this.productId || !this.qty || this.qty < 1) return false;
    if (this.type === 'IN') return !!this.toWarehouseId;
    if (this.type === 'OUT') return !!this.fromWarehouseId;
    if (this.type === 'TRANSFER') return !!this.fromWarehouseId && !!this.toWarehouseId && this.fromWarehouseId !== this.toWarehouseId;
    return false;
  }

  create() {
    if (!this.canCreate()) return;
    this.busy.set(true);
    this.api.create({
      type: this.type,
      productId: this.productId,
      qty: Number(this.qty),
      fromWarehouseId: this.type === 'IN' ? null : this.fromWarehouseId || null,
      toWarehouseId: this.type === 'OUT' ? null : this.toWarehouseId || null,
      reason: this.reason || null,
    }).pipe(
      catchError(() => {
        this.error.set('stock_movements_failed');
        this.toast.push({ kind: 'error', title: 'No se pudo guardar', message: 'Verifica /api/stock-movements' });
        return of(null);
      }),
    ).subscribe((created) => {
      if (created) {
        this.toast.push({ kind: 'success', title: 'Movimiento registrado', message: this.label(created.type) });
        this.movements.update((arr) => [created, ...arr]);
        this.productId = '';
        this.qty = 1;
        this.reason = '';
      }
      this.busy.set(false);
    });
  }

  reload() {
    this.busyList.set(true);
    this.api.list({ warehouseId: this.filterWarehouseId || undefined }).pipe(
      catchError(() => of([])),
    ).subscribe((d) => {
      this.movements.set(d);
      this.busyList.set(false);
    });
  }

  label(t: StockMovementType) {
    if (t === 'IN') return 'Entrada';
    if (t === 'OUT') return 'Salida';
    return 'Transferencia';
  }

  route(m: StockMovement) {
    const w = (id?: string | null) => this.warehouses().find((x) => x.id === id)?.code || (id ? id.slice(0, 6) : '—');
    if (m.type === 'IN') return `→ ${w(m.toWarehouseId)}`;
    if (m.type === 'OUT') return `${w(m.fromWarehouseId)} →`;
    return `${w(m.fromWarehouseId)} → ${w(m.toWarehouseId)}`;
  }
}
