import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Warehouse, WarehouseService, WarehouseStockLine } from '../../services/warehouse.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';

interface IpvInitialLine {
  productId: string;
  qty: number;
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ipv-initial.component.html',
  styleUrls: ['./ipv-initial.component.scss'],
})
export class IpvInitialComponent {
  private readonly warehousesApi = inject(WarehouseService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);

  readonly warehouses = signal<Warehouse[]>([]);
  warehouseId = '';

  readonly stock = signal<WarehouseStockLine[]>([]);
  readonly initial = signal<IpvInitialLine[]>([]);

  readonly busy = signal(false);
  readonly busyStock = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.warehousesApi.list().pipe(catchError(() => of([]))).subscribe((d) => this.warehouses.set(d));
  }

  loadStock() {
    if (!this.warehouseId) return;
    this.busyStock.set(true);
    this.warehousesApi.stock(this.warehouseId).pipe(
      catchError(() => of([])),
    ).subscribe((lines) => {
      this.stock.set(lines);
      this.initial.set(lines.map((l) => ({ productId: l.productId, qty: l.qty })));
      this.busyStock.set(false);
    });
  }

  save() {
    if (!this.warehouseId) return;
    this.busy.set(true);
    const payload = { warehouseId: this.warehouseId, lines: this.initial() };
    this.http.post('/api/ipv/initial', payload).pipe(
      catchError(() => {
        this.error.set('ipv_initial_failed');
        this.toast.push({ kind: 'error', title: 'No se pudo guardar', message: 'Verifica /api/ipv/initial' });
        return of(null);
      }),
    ).subscribe(() => {
      this.toast.push({ kind: 'success', title: 'IPV inicial guardado', message: 'Listo para iniciar turno' });
      this.busy.set(false);
    });
  }
}
