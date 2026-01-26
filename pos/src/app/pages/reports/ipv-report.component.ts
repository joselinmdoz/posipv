import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, IpvReport } from '../../services/reports.service';
import { RegisterService, Register } from '../../services/register.service';
import { CashService, CashSession } from '../../services/cash.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ipv-report.component.html',
  styleUrls: ['./ipv-report.component.scss'],
})
export class IpvReportComponent {
  private readonly reports = inject(ReportsService);
  private readonly regs = inject(RegisterService);
  private readonly cash = inject(CashService);
  private readonly toast = inject(ToastService);

  readonly registers = signal<Register[]>([]);
  readonly openSession = signal<CashSession | null>(null);
  readonly report = signal<IpvReport | null>(null);
  readonly error = signal<string | null>(null);

  registerId = '';
  cashSessionId = '';

  readonly totalImporte = computed(() => (this.report()?.lines || []).reduce((s, l) => s + (l.importe || 0), 0));
  readonly totalTransfer = computed(() => (this.report()?.lines || []).reduce((s, l) => s + (l.importeTransferencia || 0), 0));

  constructor() {
    this.regs.list().pipe(catchError(() => of([]))).subscribe((d) => this.registers.set(d));
  }

  loadOpenSession() {
    this.openSession.set(null);
    this.report.set(null);
    this.cashSessionId = '';
    if (!this.registerId) return;
    this.cash.getOpen(this.registerId).pipe(catchError(() => of(null))).subscribe((s) => {
      this.openSession.set(s);
      if (s?.id) this.cashSessionId = s.id;
    });
  }

  load() {
    this.error.set(null);
    this.report.set(null);
    if (!this.cashSessionId) return;

    this.reports.ipv(this.cashSessionId).pipe(
      catchError(() => {
        this.error.set('ipv_failed');
        this.toast.push({ kind: 'error', title: 'No se pudo consultar', message: 'Verifica /api/reports/ipv' });
        return of(null);
      }),
    ).subscribe((r) => this.report.set(r));
  }

  money(v: number) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v || 0);
  }

  /** Angular templates no soportan arrow functions; formateamos aquí. */
  workersText(workers: Array<{ id: string; email: string }> | null | undefined): string {
    if (!workers || workers.length === 0) return '—';
    return workers.map((w) => w.email).join(', ');
  }
}
