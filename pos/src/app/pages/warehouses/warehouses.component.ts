import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Warehouse, WarehouseService, WarehouseStockLine } from '../../services/warehouse.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './warehouses.component.html',
  styleUrls: ['./warehouses.component.scss'],
})
export class WarehousesComponent {
  private readonly api = inject(WarehouseService);
  private readonly toast = inject(ToastService);

  readonly warehouses = signal<Warehouse[]>([]);
  readonly selected = signal<Warehouse | null>(null);
  readonly stock = signal<WarehouseStockLine[]>([]);
  readonly busy = signal(false);
  readonly busyStock = signal(false);
  readonly error = signal<string | null>(null);

  readonly showNew = signal(false);
  newName = '';
  newCode = '';
  newType: 'CENTRAL' | 'TPV' = 'TPV';

  constructor() {
    this.reload();
  }

  toggleNew(){ this.showNew.set(!this.showNew()); }

  reload() {
    this.busy.set(true);
    this.error.set(null);
    this.api.list().pipe(
      catchError(() => {
        this.error.set('warehouses_failed');
        return of([]);
      }),
    ).subscribe((data) => {
      this.warehouses.set(data);
      if (data.length && !this.selected()) this.selected.set(data[0]);
      this.busy.set(false);
    });
  }

  select(w: Warehouse) {
    this.selected.set(w);
    this.stock.set([]);
    this.loadStock();
  }

  loadStock() {
    const w = this.selected();
    if (!w) return;
    this.busyStock.set(true);
    this.api.stock(w.id).pipe(
      catchError(() => of([])),
    ).subscribe((lines) => {
      this.stock.set(lines);
      this.busyStock.set(false);
    });
  }

  create() {
    if (!this.newName || !this.newCode) return;
    this.busy.set(true);
    this.api.create({ name: this.newName, code: this.newCode, type: this.newType }).pipe(
      catchError(() => {
        this.toast.push({ kind: 'error', title: 'No se pudo crear', message: 'Verifica el backend /api/warehouses' });
        return of(null);
      }),
    ).subscribe((created) => {
      if (created) {
        this.toast.push({ kind: 'success', title: 'Almacén creado', message: created.name });
        this.warehouses.update((arr) => [created, ...arr]);
        this.selected.set(created);
        this.showNew.set(false);
        this.newName=''; this.newCode=''; this.newType='TPV';
      }
      this.busy.set(false);
    });
  }
}
