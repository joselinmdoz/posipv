import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { SettingsService, RegisterSettings, PaymentMethodSetting, DenominationSetting } from '../../services/settings.service';
import { RegisterService, Register } from '../../services/register.service';
import { WarehouseService, Warehouse } from '../../services/warehouse.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './tpv-settings.component.html',
  styleUrls: ['./tpv-settings.component.scss'],
})
export class TpvSettingsComponent {
  private readonly api = inject(SettingsService);
  private readonly regs = inject(RegisterService);
  private readonly warehouses = inject(WarehouseService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly registers = signal<Register[]>([]);
  readonly warehousesList = signal<Warehouse[]>([]);
  readonly paymentMethods = signal<PaymentMethodSetting[]>([]);
  readonly denominations = signal<DenominationSetting[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  registerId = '';
  defaultOpeningFloat: number | null = null;
  currency = 'CUP';
  warehouseId = '';
  selectedPaymentMethods: string[] = [];
  selectedDenominations: number[] = [];

  constructor() {
    this.regs.list().pipe(catchError(() => of([]))).subscribe((d) => this.registers.set(d));
    this.warehouses.list().pipe(catchError(() => of([]))).subscribe((d) => this.warehousesList.set(d));
    this.api.listPaymentMethods().pipe(catchError(() => of([]))).subscribe((d) => this.paymentMethods.set(d));
    this.api.listDenominations().pipe(catchError(() => of([]))).subscribe((d) => this.denominations.set(d));

    this.route.queryParams.subscribe((params) => {
      if (params['registerId']) {
        this.registerId = params['registerId'];
        this.load();
      }
    });
  }

  load() {
    this.error.set(null);
    if (!this.registerId) return;
    this.api.getRegisterSettings(this.registerId).pipe(
      catchError(() => {
        this.error.set('settings_failed');
        return of(null);
      }),
    ).subscribe((s) => {
      if (!s) return;
      this.defaultOpeningFloat = s.defaultOpeningFloat ?? 0;
      this.currency = s.currency || 'CUP';
      this.warehouseId = s.warehouseId || '';
      this.selectedPaymentMethods = s.paymentMethods?.filter(p => p.enabled).map(p => p.code) || [];
      this.selectedDenominations = s.denominations?.filter(d => d.enabled).map(d => d.value) || [];
    });
  }

  togglePaymentMethod(code: string) {
    const index = this.selectedPaymentMethods.indexOf(code);
    if (index > -1) {
      this.selectedPaymentMethods.splice(index, 1);
    } else {
      this.selectedPaymentMethods.push(code);
    }
  }

  isPaymentMethodSelected(code: string): boolean {
    return this.selectedPaymentMethods.includes(code);
  }

  toggleDenomination(value: number) {
    const index = this.selectedDenominations.indexOf(value);
    if (index > -1) {
      this.selectedDenominations.splice(index, 1);
    } else {
      this.selectedDenominations.push(value);
    }
  }

  isDenominationSelected(value: number): boolean {
    return this.selectedDenominations.includes(value);
  }

  save() {
    if (!this.registerId || this.defaultOpeningFloat == null) return;
    this.busy.set(true);
    this.api.saveRegisterSettings(this.registerId, {
      defaultOpeningFloat: Number(this.defaultOpeningFloat),
      currency: this.currency,
      warehouseId: this.warehouseId,
      paymentMethods: this.selectedPaymentMethods,
      denominations: this.selectedDenominations
    }).pipe(
      catchError(() => {
        this.toast.push({ kind: 'error', title: 'No se pudo guardar', message: 'Verifica /api/settings/register/:id' });
        return of(null);
      }),
    ).subscribe(() => {
      this.toast.push({ kind: 'success', title: 'Guardado', message: 'Configuración actualizada' });
      this.busy.set(false);
    });
  }
}
