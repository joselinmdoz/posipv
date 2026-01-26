import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsService, SalesByProductLine } from '../../services/reports.service';
import { RegisterService, Register } from '../../services/register.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sales-report.component.html',
  styleUrls: ['./sales-report.component.scss'],
})
export class SalesReportComponent {
  private readonly api = inject(ReportsService);
  private readonly regApi = inject(RegisterService);
  private readonly toast = inject(ToastService);

  readonly registers = signal<Register[]>([]);
  readonly lines = signal<SalesByProductLine[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  from = this.isoDate(new Date(Date.now() - 7*24*3600*1000));
  to = this.isoDate(new Date());
  registerId = '';

  readonly total = computed(() => this.lines().reduce((s, l) => s + (l.total || 0), 0));

  constructor() {
    this.regApi.list().pipe(catchError(() => of([]))).subscribe((d) => this.registers.set(d));
    this.load();
  }

  load() {
    this.busy.set(true);
    this.error.set(null);
    this.api.salesByProduct({ from: this.from, to: this.to, registerId: this.registerId || undefined }).pipe(
      catchError(() => {
        this.error.set('sales_report_failed');
        this.toast.push({ kind: 'error', title: 'No se pudo consultar', message: 'Verifica /api/reports/sales-by-product' });
        return of([]);
      }),
    ).subscribe((d) => {
      this.lines.set(d);
      this.busy.set(false);
    });
  }

  money(v: number) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v || 0);
  }

  isoDate(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
}
