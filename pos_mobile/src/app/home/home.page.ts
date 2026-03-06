import { Component, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { CashSession, CashSessionSummary, Register } from '../core/models/pos.model';
import { ApiConfigService } from '../core/services/api-config.service';
import { PosService } from '../core/services/pos.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly posService = inject(PosService);
  private readonly apiConfig = inject(ApiConfigService);

  readonly user$ = this.authService.user$;
  readonly apiBaseUrl = this.apiConfig.baseUrl;

  registers: Register[] = [];
  selectedRegisterId = '';
  registerCurrency = 'CUP';

  openSession: CashSession | null = null;
  summary: CashSessionSummary | null = null;

  openingAmount = '0';
  closingAmount = '';

  loadingRegisters = false;
  loadingSession = false;
  openingSession = false;
  closingSession = false;

  status = '';
  statusIsError = false;

  ionViewWillEnter(): void {
    this.loadRegisters();
  }

  loadRegisters(): void {
    this.loadingRegisters = true;
    this.posService
      .listRegisters()
      .pipe(finalize(() => (this.loadingRegisters = false)))
      .subscribe({
        next: (registers) => {
          this.registers = registers;
          if (registers.length === 0) {
            this.selectedRegisterId = '';
            this.openSession = null;
            this.summary = null;
            this.posService.setCurrentSession(null);
            this.setStatus('No hay TPV configurados en el sistema.', true);
            return;
          }

          const savedRegisterId = localStorage.getItem('pos_mobile_register_id') || '';
          const nextId = registers.some((r) => r.id === savedRegisterId)
            ? savedRegisterId
            : registers[0].id;

          this.selectedRegisterId = nextId;
          this.onRegisterChange();
        },
        error: (error: HttpErrorResponse) => {
          this.setStatus(this.resolveErrorMessage(error), true);
        }
      });
  }

  onRegisterChange(): void {
    if (!this.selectedRegisterId) return;
    localStorage.setItem('pos_mobile_register_id', this.selectedRegisterId);
    this.refreshSelectedRegisterState();
  }

  refreshSelectedRegisterState(): void {
    if (!this.selectedRegisterId) return;
    this.loadingSession = true;
    this.status = '';
    this.summary = null;

    this.posService.getRegisterSettings(this.selectedRegisterId).subscribe({
      next: (settings) => {
        this.registerCurrency = this.posService.normalizeCurrency(settings.currency);
        this.openingAmount = String(Number(settings.defaultOpeningFloat || 0));
      },
      error: () => {
        this.registerCurrency = 'CUP';
        this.openingAmount = '0';
      }
    });

    this.posService
      .getOpenSession(this.selectedRegisterId)
      .pipe(finalize(() => (this.loadingSession = false)))
      .subscribe({
        next: (session) => {
          this.openSession = session;
          this.posService.setCurrentSession(session);
          if (session?.status === 'OPEN') {
            this.loadSummary(session.id);
          }
        },
        error: (error: HttpErrorResponse) => {
          this.openSession = null;
          this.posService.setCurrentSession(null);
          this.setStatus(this.resolveErrorMessage(error), true);
        }
      });
  }

  openCashSession(): void {
    if (!this.selectedRegisterId || this.openingSession) return;
    const openingAmount = this.parseMoney(this.openingAmount);
    if (openingAmount === null || openingAmount < 0) {
      this.setStatus('El monto de apertura no es valido.', true);
      return;
    }

    this.openingSession = true;
    this.status = '';
    this.posService
      .openSession(this.selectedRegisterId, openingAmount)
      .pipe(finalize(() => (this.openingSession = false)))
      .subscribe({
        next: (session) => {
          this.openSession = session;
          this.posService.setCurrentSession(session);
          this.setStatus('Sesion de caja abierta correctamente.', false);
          this.loadSummary(session.id);
        },
        error: (error: HttpErrorResponse) => {
          this.setStatus(this.resolveErrorMessage(error), true);
        }
      });
  }

  closeCashSession(): void {
    if (!this.openSession || this.closingSession) return;
    const closingAmount = this.parseMoney(this.closingAmount);
    if (closingAmount === null || closingAmount < 0) {
      this.setStatus('El monto de cierre no es valido.', true);
      return;
    }

    this.closingSession = true;
    this.status = '';
    this.posService
      .closeSession(this.openSession.id, closingAmount)
      .pipe(finalize(() => (this.closingSession = false)))
      .subscribe({
        next: () => {
          this.setStatus('Sesion cerrada correctamente.', false);
          this.openSession = null;
          this.summary = null;
          this.closingAmount = '';
          this.posService.setCurrentSession(null);
          this.refreshSelectedRegisterState();
        },
        error: (error: HttpErrorResponse) => {
          this.setStatus(this.resolveErrorMessage(error), true);
        }
      });
  }

  goToPos(): void {
    if (!this.openSession || this.openSession.status !== 'OPEN') {
      this.setStatus('Abre una sesion de caja para continuar.', true);
      return;
    }
    this.router.navigateByUrl('/pos');
  }

  logout(): void {
    this.authService.logout();
    this.posService.setCurrentSession(null);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  private loadSummary(sessionId: string): void {
    this.posService.getSessionSummary(sessionId).subscribe({
      next: (summary) => {
        this.summary = summary;
        this.closingAmount = String(Number(summary.paymentTotals.CASH || 0));
      },
      error: () => {
        this.summary = null;
      }
    });
  }

  private setStatus(message: string, isError: boolean): void {
    this.status = message;
    this.statusIsError = isError;
  }

  private resolveErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) return 'No se pudo conectar al servidor.';
    const apiMessage = error.error?.message;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage;
    if (Array.isArray(apiMessage) && apiMessage.length > 0) return String(apiMessage[0]);
    if (error.status === 401) return 'Sesion expirada. Inicia sesion nuevamente.';
    return 'Operacion no completada.';
  }

  private parseMoney(raw: string): number | null {
    const normalized = raw.replace(',', '.').trim();
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }
}
