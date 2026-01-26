import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RegisterService, Register } from '../../services/register.service';
import { CashService, CashSession } from '../../services/cash.service';
import { SettingsService } from '../../services/settings.service';
import { WarehouseService, Warehouse } from '../../services/warehouse.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../ui/toast.service';
import { catchError, finalize, of } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
})
export class TPVComponent {
  private readonly regService = inject(RegisterService);
  private readonly cashService = inject(CashService);
  private readonly settings = inject(SettingsService);
  private readonly warehouses = inject(WarehouseService);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  registers = signal<Register[]>([]);
  warehousesList = signal<Warehouse[]>([]);
  selectedId = this.regService.selectedId;

  openSession = signal<CashSession | null>(null);
  busy = signal(false);
  err = signal('');

  opening = 100;
  note = '';

  showNew = signal(false);
  newName = '';
  newCode = '';
  openMenu = signal<string | null>(null);

  showEditModal = signal(false);
  showConfigModal = signal(false);
  editingTPV: Register | null = null;
  configTPV: Register | null = null;
  configWarehouseId = '';
  configWarehouseName = signal('');
  configCurrency = 'CUP';
  configPaymentMethods: string[] = [];
  configDenominations: number[] = [];

  /** Solo ADMIN puede modificar el monto inicial (fondo fijo). */
  readonly isAdmin = computed(() => this.auth.user()?.role === 'ADMIN');

  constructor() {
    this.refresh();
    this.warehouses.list().pipe(catchError(() => of([]))).subscribe((d) => this.warehousesList.set(d));
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.menu') && !target.closest('.menu-btn')) {
        this.openMenu.set(null);
      }
    });
  }

  refresh() {
    this.regService.list().subscribe({
      next: (regs) => {
        this.registers.set(regs);
        const id = this.selectedId();
        if (id) {
          // Check if selected register still exists
          const exists = regs.some(r => r.id === id);
          if (exists) {
            this.loadOpenSession(id);
          } else {
            // Clear invalid selection
            this.regService.clear();
          }
        }
      },
      error: () => this.err.set('No se pudieron cargar las cajas.'),
    });
  }

  select(r: Register) {
    this.err.set('');
    this.regService.select(r.id);
    this.loadOpenSession(r.id);
  }

  loadOpenSession(registerId: string) {
    this.openSession.set(null);

    // Load per-register default opening float
    this.settings.getRegisterSettings(registerId).pipe(
      catchError(() => of(null)),
    ).subscribe((s) => {
      if (s && typeof s.defaultOpeningFloat === 'number') {
        this.opening = s.defaultOpeningFloat;
      }
    });

    this.cashService.getOpen(registerId).subscribe({
      next: (sess) => this.openSession.set(sess),
      error: () => this.err.set('No se pudo verificar la sesión de caja.'),
    });
  }

  open() {
    const registerId = this.selectedId();
    if (!registerId) return;

    this.err.set('');
    this.busy.set(true);

    this.cashService.open(registerId, Number(this.opening), this.note || undefined).subscribe({
      next: (sess) => {
        this.openSession.set(sess);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        const msg = e?.error?.message;
        this.err.set(Array.isArray(msg) ? msg.join(', ') : msg || 'No se pudo abrir la caja.');
      },
    });
  }

  goPos() {
    this.router.navigateByUrl('/pos');
  }

  toggleNew() {
    this.showNew.set(!this.showNew());
  }

  create() {
    if (!this.newName) return;
    this.busy.set(true);
    this.regService.create({ name: this.newName }).subscribe({
      next: (created) => {
        this.toast.push({ kind: 'success', title: 'TPV creado', message: created.name });
        this.newName = '';
        this.newCode = '';
        this.showNew.set(false);
        this.refresh();
        this.busy.set(false);
      },
      error: (err) => {
        console.error('Error creating TPV:', err);
        this.toast.push({ kind: 'error', title: 'Error', message: 'No se pudo crear el TPV' });
        this.busy.set(false);
      },
    });
  }

  toggleMenu(id: string) {
    this.openMenu.set(this.openMenu() === id ? null : id);
  }

  configure(r: Register) {
    this.configTPV = r;
    this.configWarehouseId = '';
    this.configWarehouseName.set('Cargando...');
    this.configCurrency = 'CUP';
    this.configPaymentMethods = ['EFECTIVO', 'TRANSFERENCIA'];
    this.configDenominations = [1, 5, 10, 20, 50, 100];
    // Load current settings
    this.settings.getRegisterSettings(r.id).pipe(
      catchError(() => of(null)),
    ).subscribe((s) => {
      this.configWarehouseId = s?.warehouseId || '';
      this.configWarehouseName.set(this.getWarehouseName(this.configWarehouseId));
      this.configCurrency = s?.currency || 'CUP';
      this.configPaymentMethods = s?.paymentMethods?.filter(p => p.enabled).map(p => p.code) || [];
      this.configDenominations = s?.denominations?.filter(d => d.enabled).map(d => d.value) || [];
    });
    this.showConfigModal.set(true);
  }

  edit(r: Register) {
    this.editingTPV = r;
    this.newName = r.name;
    this.newCode = r.code;
    this.showEditModal.set(true);
  }

  delete(r: Register) {
    if (confirm('¿Eliminar TPV ' + r.name + '? Esta acción no se puede deshacer.')) {
      this.regService.delete(r.id).subscribe({
        next: () => {
          this.toast.push({ kind: 'success', title: 'Eliminado', message: 'TPV eliminado correctamente' });
          this.refresh();
        },
        error: (err) => {
          console.error('Error deleting TPV:', err);
          this.toast.push({ kind: 'error', title: 'Error', message: 'No se pudo eliminar el TPV' });
        },
      });
    }
  }

  getWarehouseName(id: string): string {
    const warehouse = this.warehousesList().find(w => w.id === id);
    return warehouse ? warehouse.name : 'No asignado';
  }

  saveConfig() {
    if (!this.configTPV) return;
    this.settings.saveRegisterSettings(this.configTPV.id, {
      currency: this.configCurrency,
      warehouseId: this.configWarehouseId,
      paymentMethods: this.configPaymentMethods,
      denominations: this.configDenominations,
    }).subscribe({
      next: () => {
        this.showConfigModal.set(false);
        this.toast.push({ kind: 'success', title: 'Guardado', message: 'Configuración actualizada' });
        this.busy.set(false);
      },
      error: () => {
        this.toast.push({ kind: 'error', title: 'Error', message: 'No se pudo guardar' });
        this.busy.set(false);
      },
    });
  }

  saveEdit() {
    if (!this.editingTPV || !this.newName) return;
    this.busy.set(true);
    this.regService.update(this.editingTPV.id, { name: this.newName }).subscribe({
      next: (updated) => {
        this.toast.push({ kind: 'success', title: 'TPV actualizado', message: updated.name });
        this.showEditModal.set(false);
        this.refresh();
        this.busy.set(false);
      },
      error: (err) => {
        console.error('Error updating TPV:', err);
        this.toast.push({ kind: 'error', title: 'Error', message: 'No se pudo actualizar el TPV' });
        this.busy.set(false);
      },
    });
  }

  closeModals() {
    this.showNew.set(false);
    this.showEditModal.set(false);
    this.showConfigModal.set(false);
    this.newName = '';
    this.newCode = '';
    this.editingTPV = null;
    this.configTPV = null;
  }
}
