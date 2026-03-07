import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import {
    AccountingAccount,
    AccountingService,
    CurrencyCode,
    FiscalPeriod,
    JournalEntryDetail,
    JournalEntryLine,
    JournalEntryStatus
} from '@/app/core/services/accounting.service';
import { CURRENCY_OPTIONS, LINE_SIDE_OPTIONS, formatDate, formatDateTime, todayInput } from './accounting.shared';

@Component({
    selector: 'app-accounting-journal-entries',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, CardModule, InputTextModule, InputNumberModule, SelectModule, TagModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Contabilidad · Asientos Contables</h1>
                <p class="text-gray-500 m-0">Registro y administración de asientos contables.</p>
            </div>

            <p-card header="Asiento Manual">
                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                        <input pInputText type="date" [(ngModel)]="entryForm.date" />
                        <input pInputText [(ngModel)]="entryForm.description" placeholder="Descripción" />
                        <input pInputText [(ngModel)]="entryForm.reference" placeholder="Referencia (opcional)" />
                        <p-select [options]="currencyOptions" optionLabel="label" optionValue="value" [(ngModel)]="entryForm.currency" placeholder="Moneda" />
                        <p-select [options]="openPeriodOptions" optionLabel="label" optionValue="value" [(ngModel)]="entryForm.periodId" placeholder="Período abierto" />
                    </div>

                    <div class="overflow-auto border rounded-lg">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-surface-100">
                                    <th class="text-left py-2 px-3">Cuenta</th>
                                    <th class="text-left py-2 px-3">Lado</th>
                                    <th class="text-left py-2 px-3">Importe</th>
                                    <th class="text-left py-2 px-3">Memo</th>
                                    <th class="text-left py-2 px-3">Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (line of entryForm.lines; track $index) {
                                    <tr>
                                        <td class="py-2 px-3 min-w-52">
                                            <p-select [options]="manualAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="line.accountId" [appendTo]="'body'" placeholder="Seleccione cuenta" class="w-full" />
                                        </td>
                                        <td class="py-2 px-3 min-w-40">
                                            <p-select [options]="lineSideOptions" optionLabel="label" optionValue="value" [(ngModel)]="line.side" [appendTo]="'body'" class="w-full" />
                                        </td>
                                        <td class="py-2 px-3 min-w-36">
                                            <p-inputnumber [(ngModel)]="line.amount" [min]="0" [minFractionDigits]="2" [maxFractionDigits]="2" mode="decimal" inputStyleClass="w-full" />
                                        </td>
                                        <td class="py-2 px-3 min-w-52">
                                            <input pInputText [(ngModel)]="line.memo" placeholder="Memo (opcional)" class="w-full" />
                                        </td>
                                        <td class="py-2 px-3">
                                            <p-button icon="pi pi-trash" size="small" severity="danger" [outlined]="true" (onClick)="removeLine($index)" [disabled]="entryForm.lines.length <= 2" />
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>

                    <div class="flex flex-wrap gap-2 items-center justify-between">
                        <div class="flex gap-2">
                            <p-button label="Agregar línea" icon="pi pi-plus" severity="secondary" [outlined]="true" (onClick)="addLine()" />
                            <p-button label="Limpiar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="resetEntryForm()" />
                        </div>
                        <div class="text-sm font-semibold">
                            Débito: {{ totalDebit() | number: '1.2-2' }} | Crédito: {{ totalCredit() | number: '1.2-2' }}
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <p-button label="Guardar borrador" icon="pi pi-save" severity="secondary" [outlined]="true" (onClick)="createEntry('DRAFT')" />
                        <p-button label="Publicar asiento" icon="pi pi-check" (onClick)="createEntry('POSTED')" />
                    </div>
                </div>
            </p-card>

            <p-card header="Asientos Recientes">
                <div class="flex flex-col gap-3">
                    <div class="flex flex-wrap gap-2">
                        <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadEntries()" />
                    </div>
                    <div class="overflow-auto border rounded-lg">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-surface-100">
                                    <th class="text-left py-2 px-3">No.</th>
                                    <th class="text-left py-2 px-3">Fecha</th>
                                    <th class="text-left py-2 px-3">Descripción</th>
                                    <th class="text-left py-2 px-3">Estado</th>
                                    <th class="text-right py-2 px-3">Débito</th>
                                    <th class="text-right py-2 px-3">Crédito</th>
                                    <th class="text-left py-2 px-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (entry of entries; track entry.id) {
                                    <tr>
                                        <td class="py-2 px-3">{{ entry.entryNumber }}</td>
                                        <td class="py-2 px-3">{{ formatDateFn(entry.date) }}</td>
                                        <td class="py-2 px-3">{{ entry.description }}</td>
                                        <td class="py-2 px-3">
                                            <p-tag [value]="entry.status" [severity]="entry.status === 'POSTED' ? 'success' : entry.status === 'DRAFT' ? 'warn' : 'danger'" />
                                        </td>
                                        <td class="py-2 px-3 text-right">{{ entry.totalDebit | number: '1.2-2' }}</td>
                                        <td class="py-2 px-3 text-right">{{ entry.totalCredit | number: '1.2-2' }}</td>
                                        <td class="py-2 px-3">
                                            <div class="flex flex-wrap gap-1">
                                                <p-button size="small" icon="pi pi-eye" severity="secondary" [outlined]="true" (onClick)="viewEntry(entry.id)" />
                                                @if (entry.status === 'DRAFT') {
                                                    <p-button size="small" icon="pi pi-check" severity="success" [outlined]="true" (onClick)="postEntry(entry.id)" />
                                                }
                                                @if (entry.status !== 'VOID') {
                                                    <p-button size="small" icon="pi pi-times" severity="danger" [outlined]="true" (onClick)="voidEntry(entry.id)" />
                                                }
                                            </div>
                                        </td>
                                    </tr>
                                }
                                @if (!entries.length) {
                                    <tr><td colspan="7" class="text-center py-3 text-gray-500">Sin asientos registrados</td></tr>
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </p-card>

            @if (selectedEntry) {
                <p-card [header]="'Detalle ' + selectedEntry.entryNumber">
                    <div class="flex flex-col gap-3">
                        <div class="text-sm text-gray-600">{{ selectedEntry.description }} | {{ formatDateTimeFn(selectedEntry.date) }} | Estado: {{ selectedEntry.status }}</div>
                        <div class="overflow-auto border rounded-lg">
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="bg-surface-100">
                                        <th class="text-left py-2 px-3">Cuenta</th>
                                        <th class="text-left py-2 px-3">Lado</th>
                                        <th class="text-right py-2 px-3">Importe</th>
                                        <th class="text-left py-2 px-3">Memo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (line of selectedEntry.lines; track line.id) {
                                        <tr>
                                            <td class="py-2 px-3">{{ line.account?.code }} - {{ line.account?.name }}</td>
                                            <td class="py-2 px-3">{{ line.side === 'DEBIT' ? 'Débito' : 'Crédito' }}</td>
                                            <td class="py-2 px-3 text-right">{{ line.amount | number: '1.2-2' }}</td>
                                            <td class="py-2 px-3">{{ line.memo || '-' }}</td>
                                        </tr>
                                    }
                                </tbody>
                            </table>
                        </div>
                    </div>
                </p-card>
            }

            <p-toast />
        </div>
    `
})
export class AccountingJournalEntries implements OnInit {
    readonly lineSideOptions = LINE_SIDE_OPTIONS;
    readonly currencyOptions = CURRENCY_OPTIONS;

    accounts: AccountingAccount[] = [];
    periods: FiscalPeriod[] = [];
    manualAccountOptions: Array<{ label: string; value: string }> = [];
    openPeriodOptions: Array<{ label: string; value: string }> = [];

    entries: any[] = [];
    selectedEntry: JournalEntryDetail | null = null;

    entryForm: {
        date: string;
        description: string;
        reference: string;
        currency: CurrencyCode;
        periodId: string;
        lines: JournalEntryLine[];
    } = {
        date: todayInput(),
        description: '',
        reference: '',
        currency: 'CUP',
        periodId: '',
        lines: [
            { accountId: '', side: 'DEBIT', amount: 0, memo: '' },
            { accountId: '', side: 'CREDIT', amount: 0, memo: '' }
        ]
    };

    constructor(
        private accountingService: AccountingService,
        private messageService: MessageService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        setTimeout(() => {
            this.loadAccounts();
            this.loadPeriods();
            this.loadEntries();
        }, 0);
    }

    formatDateFn(value: string | Date | null | undefined): string {
        return formatDate(value);
    }

    formatDateTimeFn(value: string | Date | null | undefined): string {
        return formatDateTime(value);
    }

    loadAccounts() {
        this.accountingService.listAccounts({ limit: 1000 }).subscribe({
            next: (rows) => {
                this.accounts = rows || [];
                this.manualAccountOptions = this.accounts
                    .filter((acc) => acc.active && acc.allowManualEntries)
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
                this.openPeriodOptions = this.periods
                    .filter((period) => period.status === 'OPEN')
                    .map((period) => ({
                        label: `${period.name} (${formatDate(period.startDate)} - ${formatDate(period.endDate)})`,
                        value: period.id
                    }));

                if (!this.entryForm.periodId) {
                    const open = this.periods.find((p) => p.status === 'OPEN');
                    this.entryForm.periodId = open?.id || '';
                }
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar los períodos')
        });
    }

    loadEntries() {
        this.accountingService.listJournalEntries({ limit: 200 }).subscribe({
            next: (rows) => {
                this.entries = rows || [];
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar los asientos')
        });
    }

    addLine() {
        this.entryForm.lines.push({ accountId: '', side: 'DEBIT', amount: 0, memo: '' });
    }

    removeLine(index: number) {
        if (this.entryForm.lines.length <= 2) return;
        this.entryForm.lines.splice(index, 1);
    }

    createEntry(status: JournalEntryStatus) {
        const payload = {
            date: this.entryForm.date ? `${this.entryForm.date}T00:00:00.000Z` : undefined,
            description: this.entryForm.description,
            reference: this.entryForm.reference || undefined,
            currency: this.entryForm.currency,
            periodId: this.entryForm.periodId || undefined,
            status,
            lines: this.entryForm.lines.map((line) => ({
                accountId: line.accountId,
                side: line.side,
                amount: Number(line.amount || 0),
                memo: line.memo || undefined
            }))
        };

        this.accountingService.createJournalEntry(payload).subscribe({
            next: (entry) => {
                this.success(status === 'DRAFT' ? 'Borrador guardado' : 'Asiento publicado');
                this.selectedEntry = entry;
                this.resetEntryForm();
                this.loadEntries();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo guardar el asiento')
        });
    }

    viewEntry(entryId: string) {
        this.accountingService.getJournalEntry(entryId).subscribe({
            next: (entry) => (this.selectedEntry = entry),
            error: () => this.error('No se pudo cargar el detalle del asiento')
        });
    }

    postEntry(entryId: string) {
        this.accountingService.postJournalEntry(entryId).subscribe({
            next: (entry) => {
                this.success('Asiento publicado');
                this.selectedEntry = entry;
                this.loadEntries();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo publicar el asiento')
        });
    }

    voidEntry(entryId: string) {
        const reason = window.prompt('Motivo de anulación (opcional):') || undefined;
        this.accountingService.voidJournalEntry(entryId, reason).subscribe({
            next: (entry) => {
                this.success('Asiento anulado');
                this.selectedEntry = entry;
                this.loadEntries();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo anular el asiento')
        });
    }

    resetEntryForm() {
        const openPeriod = this.periods.find((p) => p.status === 'OPEN');
        this.entryForm = {
            date: todayInput(),
            description: '',
            reference: '',
            currency: 'CUP',
            periodId: openPeriod?.id || '',
            lines: [
                { accountId: '', side: 'DEBIT', amount: 0, memo: '' },
                { accountId: '', side: 'CREDIT', amount: 0, memo: '' }
            ]
        };
    }

    totalDebit() {
        return this.entryForm.lines.filter((line) => line.side === 'DEBIT').reduce((sum, line) => sum + Number(line.amount || 0), 0);
    }

    totalCredit() {
        return this.entryForm.lines.filter((line) => line.side === 'CREDIT').reduce((sum, line) => sum + Number(line.amount || 0), 0);
    }

    private success(detail: string) {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
    }

    private error(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
