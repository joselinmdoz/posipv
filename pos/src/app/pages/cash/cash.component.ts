import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegisterService } from '../../services/register.service';
import { CashService, CashSession } from '../../services/cash.service';
import { CashMovementService, CashMovement, CashMovementType } from '../../services/cash-movement.service';
import { SessionService } from '../../services/session.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

type DenomRow = { value: number; qty: number };

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cash.component.html',
  styleUrls: ['./cash.component.scss'],
})
export class CashComponent {
  private readonly reg = inject(RegisterService);
  private readonly cash = inject(CashService);
  private readonly cashMov = inject(CashMovementService);
  private readonly sessionStore = inject(SessionService);
  private readonly toast = inject(ToastService);

  readonly registerId = computed(() => this.reg.selectedId());
  readonly session = signal<CashSession | null>(null);

  readonly movements = signal<CashMovement[]>([]);
  readonly busyList = signal(false);
  readonly busyMov = signal(false);
  readonly busyClose = signal(false);

  movType: CashMovementType = 'IN';
  movAmount: number | null = null;
  movReason = '';

  readonly denoms = signal<DenomRow[]>([
    { value: 1, qty: 0 },
    { value: 5, qty: 0 },
    { value: 10, qty: 0 },
    { value: 20, qty: 0 },
    { value: 50, qty: 0 },
    { value: 100, qty: 0 },
  ]);

  readonly countedTotal = computed(() => this.denoms().reduce((s, d) => s + (d.value * d.qty), 0));

  constructor() {
    this.reload();
  }

  reload() {
    const rid = this.registerId();
    if (!rid) return;

    this.cash.getOpen(rid).pipe(
      catchError(() => of(null)),
    ).subscribe((s) => {
      this.session.set(s);
      if (s?.id) this.sessionStore.setCashSessionId(rid, s.id);
      if (s?.id) this.loadMovements(s.id);
      else this.movements.set([]);
    });
  }

  loadMovements(sessionId: string) {
    this.busyList.set(true);
    this.cashMov.list(sessionId).pipe(
      catchError(() => of([])),
    ).subscribe((list) => {
      this.movements.set(list);
      this.busyList.set(false);
    });
  }

  createMovement() {
    const s = this.session();
    if (!s || !this.movAmount) return;

    this.busyMov.set(true);
    this.cashMov.create(s.id, {
      type: this.movType,
      amount: Number(this.movAmount).toFixed(2),
      reason: this.movReason || null,
    }).pipe(
      catchError(() => {
        this.toast.push({ kind: 'error', title: 'No se pudo guardar', message: 'Verifica el backend' });
        return of(null);
      }),
    ).subscribe((created) => {
      if (created) {
        this.toast.push({ kind: 'success', title: 'Movimiento registrado', message: this.movType === 'IN' ? 'Entrada' : 'Salida' });
        this.movements.update((arr) => [created, ...arr]);
        this.movAmount = null;
        this.movReason = '';
      }
      this.busyMov.set(false);
    });
  }

  close() {
    const rid = this.registerId();
    const s = this.session();
    if (!rid || !s) return;

    const closing = this.countedTotal();
    this.busyClose.set(true);
    this.cash.close(s.id, closing, 'Cierre por denominaciones (frontend)').pipe(
      catchError(() => {
        this.toast.push({ kind: 'error', title: 'No se pudo cerrar', message: 'Verifica /api/cash-sessions/:id/close' });
        return of(null);
      }),
    ).subscribe((res) => {
      this.toast.push({ kind: 'success', title: 'Sesión cerrada', message: 'Caja cerrada correctamente' });
      this.session.set(null);
      this.sessionStore.clearCashSessionId(rid);
      this.busyClose.set(false);
    });
  }

  money(v: any) {
    const n = Number(v);
    if (!isFinite(n)) return v;
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(n);
  }
}
