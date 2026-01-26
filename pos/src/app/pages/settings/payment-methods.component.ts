import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SettingsService, PaymentMethodSetting } from '../../services/settings.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './payment-methods.component.html',
  styleUrls: ['./payment-methods.component.scss'],
})
export class PaymentMethodsComponent {
  private readonly api = inject(SettingsService);
  private readonly toast = inject(ToastService);

  readonly methods = signal<PaymentMethodSetting[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  constructor() {
    this.api.listPaymentMethods().pipe(
      catchError(() => {
        this.error.set('methods_failed');
        return of([
          { code: 'CASH', name: 'Efectivo', enabled: true },
          { code: 'TRANSFER', name: 'Transferencia', enabled: true },
          { code: 'CARD', name: 'Tarjeta', enabled: false },
          { code: 'OTHER', name: 'Otro', enabled: false },
        ] as PaymentMethodSetting[]);
      }),
    ).subscribe((d) => this.methods.set(d));
  }

  save() {
    this.busy.set(true);
    this.api.savePaymentMethods(this.methods()).pipe(
      catchError(() => {
        this.toast.push({ kind: 'error', title: 'No se pudo guardar', message: 'Verifica /api/settings/payment-methods' });
        return of(null);
      }),
    ).subscribe(() => {
      this.toast.push({ kind: 'success', title: 'Guardado', message: 'Métodos de pago actualizados' });
      this.busy.set(false);
    });
  }
}
