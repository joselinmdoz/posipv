import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DashboardService, DashboardSummary } from '../../services/dashboard.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  private readonly api = inject(DashboardService);
  readonly summary = signal<DashboardSummary | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.summary().pipe(
      catchError((e) => {
        this.error.set('dashboard_summary_failed');
        return of(null);
      }),
    ).subscribe((s) => this.summary.set(s));
  }

  money(v?: number | null) {
    if (v == null) return '—';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(v);
  }
}
