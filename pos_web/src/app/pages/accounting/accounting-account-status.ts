import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import {
    AccountingAccount,
    AccountingLedgerReport,
    AccountingService,
    AccountingTrialBalanceReport,
    FiscalPeriod
} from '@/app/core/services/accounting.service';
import { formatDate } from './accounting.shared';

@Component({
    selector: 'app-accounting-account-status',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, CardModule, InputTextModule, SelectModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Contabilidad · Estado de Cuentas</h1>
                <p class="text-gray-500 m-0">Consulta del estado de cuentas (balanza y mayor).</p>
            </div>

            <p-card header="Estado de Cuentas">
                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <p-select [options]="allPeriodOptionsList" optionLabel="label" optionValue="value" [(ngModel)]="reportFilters.periodId" placeholder="Período (opcional)" />
                        <input pInputText type="date" [(ngModel)]="reportFilters.fromDate" />
                        <input pInputText type="date" [(ngModel)]="reportFilters.toDate" />
                        <div class="flex items-center gap-2">
                            <input id="acc-draft" type="checkbox" [(ngModel)]="reportFilters.includeDraft" />
                            <label for="acc-draft" class="text-sm">Incluir borradores</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input id="acc-void" type="checkbox" [(ngModel)]="reportFilters.includeVoid" />
                            <label for="acc-void" class="text-sm">Incluir anulados</label>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <p-button label="Balanza" icon="pi pi-chart-bar" severity="secondary" [outlined]="true" (onClick)="loadTrialBalanceReport()" />
                        <p-select [options]="ruleAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="ledgerAccountId" [appendTo]="'body'" placeholder="Cuenta para Mayor" class="min-w-80" />
                        <p-button label="Mayor" icon="pi pi-list" severity="secondary" [outlined]="true" (onClick)="loadLedgerReport()" />
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div class="border rounded-lg p-3 overflow-auto">
                            <div class="font-semibold mb-2">Balanza de Comprobación</div>
                            @if (trialBalanceReport) {
                                <div class="text-sm mb-2">
                                    Débito: {{ trialBalanceReport.totals.debit | number: '1.2-2' }} |
                                    Crédito: {{ trialBalanceReport.totals.credit | number: '1.2-2' }} |
                                    Diferencia: {{ trialBalanceReport.totals.difference | number: '1.2-2' }}
                                </div>
                            }
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="bg-surface-100">
                                        <th class="text-left py-2 px-3">Cuenta</th>
                                        <th class="text-right py-2 px-3">Débito</th>
                                        <th class="text-right py-2 px-3">Crédito</th>
                                        <th class="text-right py-2 px-3">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (row of trialBalanceReport?.rows || []; track row.accountId) {
                                        <tr>
                                            <td class="py-2 px-3">{{ row.code }} - {{ row.name }}</td>
                                            <td class="py-2 px-3 text-right">{{ row.debit | number: '1.2-2' }}</td>
                                            <td class="py-2 px-3 text-right">{{ row.credit | number: '1.2-2' }}</td>
                                            <td class="py-2 px-3 text-right">{{ row.balance | number: '1.2-2' }}</td>
                                        </tr>
                                    }
                                    @if (!(trialBalanceReport?.rows || []).length) {
                                        <tr><td colspan="4" class="text-center py-3 text-gray-500">Sin datos</td></tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div class="border rounded-lg p-3 overflow-auto">
                        <div class="font-semibold mb-2">
                            Mayor por Cuenta
                            @if (ledgerReport?.account) {
                                - {{ ledgerReport?.account?.code }} {{ ledgerReport?.account?.name }}
                            }
                        </div>
                        @if (ledgerReport) {
                            <div class="text-sm mb-2">
                                Saldo inicial: {{ ledgerReport.opening.balance | number: '1.2-2' }} |
                                Débito mov.: {{ ledgerReport.totals.debit | number: '1.2-2' }} |
                                Crédito mov.: {{ ledgerReport.totals.credit | number: '1.2-2' }} |
                                Saldo final: {{ ledgerReport.totals.closingBalance | number: '1.2-2' }}
                            </div>
                        }
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-surface-100">
                                    <th class="text-left py-2 px-3">Fecha</th>
                                    <th class="text-left py-2 px-3">Asiento</th>
                                    <th class="text-left py-2 px-3">Descripción</th>
                                    <th class="text-right py-2 px-3">Débito</th>
                                    <th class="text-right py-2 px-3">Crédito</th>
                                    <th class="text-right py-2 px-3">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (mov of ledgerReport?.movements || []; track mov.id) {
                                    <tr>
                                        <td class="py-2 px-3">{{ formatDateFn(mov.date) }}</td>
                                        <td class="py-2 px-3">{{ mov.entryNumber }}</td>
                                        <td class="py-2 px-3">{{ mov.description }}</td>
                                        <td class="py-2 px-3 text-right">{{ mov.debit | number: '1.2-2' }}</td>
                                        <td class="py-2 px-3 text-right">{{ mov.credit | number: '1.2-2' }}</td>
                                        <td class="py-2 px-3 text-right">{{ mov.balance | number: '1.2-2' }}</td>
                                    </tr>
                                }
                                @if (!(ledgerReport?.movements || []).length) {
                                    <tr><td colspan="6" class="text-center py-3 text-gray-500">Sin datos</td></tr>
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </p-card>

            <p-toast />
        </div>
    `
})
export class AccountingAccountStatus implements OnInit {
    accounts: AccountingAccount[] = [];
    periods: FiscalPeriod[] = [];

    ruleAccountOptions: Array<{ label: string; value: string }> = [];
    allPeriodOptionsList: Array<{ label: string; value: string }> = [];

    ledgerReport: AccountingLedgerReport | null = null;
    trialBalanceReport: AccountingTrialBalanceReport | null = null;

    reportFilters = {
        periodId: '',
        fromDate: '',
        toDate: '',
        includeDraft: false,
        includeVoid: false
    };

    ledgerAccountId = '';

    constructor(
        private accountingService: AccountingService,
        private messageService: MessageService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        setTimeout(() => {
            this.loadAccounts();
            this.loadPeriods();
            this.loadTrialBalanceReport();
        }, 0);
    }

    formatDateFn(value: string | Date | null | undefined): string {
        return formatDate(value);
    }

    loadAccounts() {
        this.accountingService.listAccounts({ limit: 1000 }).subscribe({
            next: (rows) => {
                this.accounts = rows || [];
                this.ruleAccountOptions = this.accounts
                    .filter((acc) => acc.active)
                    .map((acc) => ({ label: `${acc.code} - ${acc.name}`, value: acc.id }));
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar las cuentas')
        });
    }

    loadPeriods() {
        this.accountingService.listPeriods({ limit: 500 }).subscribe({
            next: (rows) => {
                this.periods = rows || [];
                this.allPeriodOptionsList = this.periods.map((period) => ({
                    label: `${period.name} (${formatDate(period.startDate)} - ${formatDate(period.endDate)})`,
                    value: period.id
                }));
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar los períodos')
        });
    }

    loadLedgerReport() {
        if (!this.ledgerAccountId) {
            this.error('Seleccione una cuenta para consultar el mayor');
            return;
        }

        this.accountingService
            .getLedgerReport(this.ledgerAccountId, {
                periodId: this.reportFilters.periodId || undefined,
                fromDate: this.reportFilters.fromDate || undefined,
                toDate: this.reportFilters.toDate || undefined,
                includeDraft: this.reportFilters.includeDraft,
                includeVoid: this.reportFilters.includeVoid,
                limit: 1000
            })
            .subscribe({
                next: (report) => {
                    this.ledgerReport = report;
                    this.cdr.markForCheck();
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo cargar el mayor')
            });
    }

    loadTrialBalanceReport() {
        this.accountingService
            .getTrialBalanceReport({
                periodId: this.reportFilters.periodId || undefined,
                fromDate: this.reportFilters.fromDate || undefined,
                toDate: this.reportFilters.toDate || undefined,
                includeDraft: this.reportFilters.includeDraft,
                includeVoid: this.reportFilters.includeVoid,
                limit: 5000
            })
            .subscribe({
                next: (report) => {
                    this.trialBalanceReport = report;
                    this.cdr.markForCheck();
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo cargar la balanza')
            });
    }

    private error(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
