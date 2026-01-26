import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsService, DenominationSetting } from '../../services/settings.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './denominations.component.html',
  styleUrls: ['./denominations.component.scss'],
})
export class DenominationsComponent {
  private readonly api = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly denoms = signal<DenominationSetting[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.listDenominations().pipe(
      catchError(() => {
        this.error.set('denoms_failed');
        return of([
          { value: 1, enabled: true },
          { value: 5, enabled: true },
          { value: 10, enabled: true },
          { value: 20, enabled: true },
          { value: 50, enabled: true },
          { value: 100, enabled: true },
        ] as DenominationSetting[]);
      }),
    ).subscribe((d) => this.denoms.set(d));
  }

  add() {
    this.denoms.update((arr) => [...arr, { value: 0, enabled: true }]);
  }

  remove(i: number) {
    this.denoms.update((arr) => arr.filter((_, idx) => idx !== i));
  }

  save() {
    this.busy.set(true);
    const cleaned = this.denoms()
      .filter((d) => isFinite(Number(d.value)))
      .map((d) => ({ value: Number(d.value), enabled: !!d.enabled }))
      .sort((a, b) => a.value - b.value);

    this.api.saveDenominations(cleaned).pipe(
      catchError(() => {
        this.toast.push({ kind: 'error', title: 'No se pudo guardar', message: 'Verifica /api/settings/denominations' });
        return of(null);
      }),
    ).subscribe(() => {
      this.toast.push({ kind: 'success', title: 'Guardado', message: 'Denominaciones actualizadas' });
      this.busy.set(false);
      this.denoms.set(cleaned);
    });
  }
}
