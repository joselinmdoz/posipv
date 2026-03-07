import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { AccountingService, FiscalPeriod } from '@/app/core/services/accounting.service';
import { PERIOD_STATUS_FILTER_OPTIONS, formatDate, toInputDate } from './accounting.shared';

@Component({
    selector: 'app-accounting-fiscal-periods',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, CardModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Contabilidad · Períodos Fiscales</h1>
                <p class="text-gray-500 m-0">Apertura, cierre y control de períodos fiscales.</p>
            </div>

            <p-card header="Períodos Fiscales">
                <div class="flex flex-col gap-3">
                    <div class="flex flex-wrap gap-2">
                        <p-button label="Nuevo período" icon="pi pi-calendar-plus" (onClick)="openNewPeriodDialog()" />
                        <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadPeriods()" />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input pInputText [(ngModel)]="periodSearchTerm" (ngModelChange)="applyPeriodFilters()" placeholder="Buscar por nombre de período" />
                        <p-select
                            [options]="periodStatusFilterOptions"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="periodStatusFilter"
                            (ngModelChange)="applyPeriodFilters()"
                            placeholder="Estado"
                        />
                    </div>

                    <p-table [value]="filteredPeriods" [rows]="10" [paginator]="true" [rowsPerPageOptions]="[10,25,50]" dataKey="id" currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} períodos">
                        <ng-template #header>
                            <tr>
                                <th>Nombre</th>
                                <th>Rango</th>
                                <th>Estado</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-period>
                            <tr>
                                <td>{{ period.name }}</td>
                                <td>{{ formatDateFn(period.startDate) }} - {{ formatDateFn(period.endDate) }}</td>
                                <td>
                                    <p-tag [value]="period.status === 'OPEN' ? 'Abierto' : 'Cerrado'" [severity]="period.status === 'OPEN' ? 'success' : 'danger'" />
                                </td>
                                <td class="text-center">
                                    <div class="flex justify-center gap-1">
                                        <p-button size="small" icon="pi pi-pencil" severity="secondary" [outlined]="true" (onClick)="editPeriod(period)" />
                                        @if (period.status === 'OPEN') {
                                            <p-button size="small" icon="pi pi-lock" severity="secondary" [outlined]="true" (onClick)="closePeriod(period)" />
                                        } @else {
                                            <p-button size="small" icon="pi pi-lock-open" severity="secondary" [outlined]="true" (onClick)="reopenPeriod(period.id)" />
                                        }
                                        <p-button size="small" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="deletePeriod(period)" />
                                    </div>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr><td colspan="4" class="text-center py-3 text-gray-500">Sin períodos creados</td></tr>
                        </ng-template>
                    </p-table>
                </div>
            </p-card>

            <p-dialog [header]="editingPeriodId ? 'Editar período' : 'Nuevo período'" [(visible)]="periodDialog" [modal]="true" [style]="{ width: '520px' }" [draggable]="false" [resizable]="false">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="md:col-span-2">
                        <label class="block mb-2">Nombre (opcional)</label>
                        <input pInputText [(ngModel)]="periodForm.name" class="w-full" />
                    </div>
                    <div>
                        <label class="block mb-2">Fecha inicio *</label>
                        <input pInputText type="date" [(ngModel)]="periodForm.startDate" class="w-full" />
                    </div>
                    <div>
                        <label class="block mb-2">Fecha fin *</label>
                        <input pInputText type="date" [(ngModel)]="periodForm.endDate" class="w-full" />
                    </div>
                </div>
                <ng-template #footer>
                    <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hidePeriodDialog()" />
                    <p-button [label]="editingPeriodId ? 'Guardar cambios' : 'Crear período'" icon="pi pi-check" (onClick)="submitPeriod()" />
                </ng-template>
            </p-dialog>

            <p-toast />
        </div>
    `
})
export class AccountingFiscalPeriods implements OnInit {
    readonly periodStatusFilterOptions = PERIOD_STATUS_FILTER_OPTIONS;

    periods: FiscalPeriod[] = [];
    filteredPeriods: FiscalPeriod[] = [];
    periodDialog = false;
    editingPeriodId: string | null = null;
    periodSearchTerm = '';
    periodStatusFilter: '' | 'OPEN' | 'CLOSED' = '';

    periodForm = {
        name: '',
        startDate: '',
        endDate: ''
    };

    constructor(
        private accountingService: AccountingService,
        private messageService: MessageService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        setTimeout(() => this.loadPeriods(), 0);
    }

    formatDateFn(value: string | Date | null | undefined): string {
        return formatDate(value);
    }

    loadPeriods() {
        this.accountingService.listPeriods({ limit: 500 }).subscribe({
            next: (rows) => {
                this.periods = rows || [];
                this.applyPeriodFilters();
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar los períodos')
        });
    }

    applyPeriodFilters() {
        const term = (this.periodSearchTerm || '').trim().toLowerCase();
        this.filteredPeriods = this.periods.filter((period) => {
            const byTerm = !term || period.name.toLowerCase().includes(term);
            const byStatus = !this.periodStatusFilter || period.status === this.periodStatusFilter;
            return byTerm && byStatus;
        });
        this.cdr.markForCheck();
    }

    submitPeriod() {
        const payload = {
            name: this.periodForm.name?.trim() || undefined,
            startDate: this.periodForm.startDate,
            endDate: this.periodForm.endDate
        };

        if (this.editingPeriodId) {
            this.accountingService.updatePeriod(this.editingPeriodId, payload).subscribe({
                next: () => {
                    this.success('Período actualizado');
                    this.cancelPeriodEdit();
                    this.hidePeriodDialog();
                    this.loadPeriods();
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo actualizar el período')
            });
            return;
        }

        this.accountingService.createPeriod(payload).subscribe({
            next: () => {
                this.success('Período creado');
                this.cancelPeriodEdit();
                this.hidePeriodDialog();
                this.loadPeriods();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo crear el período')
        });
    }

    openNewPeriodDialog() {
        this.cancelPeriodEdit();
        this.periodDialog = true;
    }

    hidePeriodDialog() {
        this.periodDialog = false;
    }

    editPeriod(period: FiscalPeriod) {
        this.editingPeriodId = period.id;
        this.periodForm = {
            name: period.name || '',
            startDate: toInputDate(period.startDate),
            endDate: toInputDate(period.endDate)
        };
        this.periodDialog = true;
    }

    cancelPeriodEdit() {
        this.editingPeriodId = null;
        this.periodForm = { name: '', startDate: '', endDate: '' };
    }

    deletePeriod(period: FiscalPeriod) {
        const ok = window.confirm(`¿Eliminar período "${period.name}"?`);
        if (!ok) return;
        this.accountingService.deletePeriod(period.id).subscribe({
            next: () => {
                this.success('Período eliminado');
                if (this.editingPeriodId === period.id) {
                    this.cancelPeriodEdit();
                    this.hidePeriodDialog();
                }
                this.loadPeriods();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo eliminar el período')
        });
    }

    closePeriod(period: FiscalPeriod) {
        const note = window.prompt(`Cerrar período ${period.name}. Nota de cierre (opcional):`) || undefined;
        this.accountingService.closePeriod(period.id, note).subscribe({
            next: () => {
                this.success('Período cerrado');
                this.loadPeriods();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo cerrar el período')
        });
    }

    reopenPeriod(periodId: string) {
        this.accountingService.reopenPeriod(periodId).subscribe({
            next: () => {
                this.success('Período reabierto');
                this.loadPeriods();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo reabrir el período')
        });
    }

    private success(detail: string) {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
    }

    private error(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
