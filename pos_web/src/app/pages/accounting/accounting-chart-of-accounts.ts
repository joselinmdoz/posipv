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
import { AccountingAccount, AccountingAccountType, AccountingService } from '@/app/core/services/accounting.service';
import {
    ACCOUNT_STATUS_FILTER_OPTIONS,
    ACCOUNT_TYPE_FILTER_OPTIONS,
    ACCOUNT_TYPE_OPTIONS,
    ACTIVE_OPTIONS,
    YES_NO_OPTIONS,
    accountTypeLabel
} from './accounting.shared';

@Component({
    selector: 'app-accounting-chart-of-accounts',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, CardModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Contabilidad · Plan de Cuentas</h1>
                <p class="text-gray-500 m-0">Gestión del plan de cuentas contables.</p>
            </div>

            <p-card header="Plan de Cuentas">
                <div class="flex flex-col gap-3">
                    <div class="flex flex-wrap gap-2">
                        <p-button label="Nueva cuenta" icon="pi pi-plus" (onClick)="openNewAccountDialog()" />
                        <p-button label="Cargar plan base" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="seedDefaultChart()" />
                        <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadAccounts()" />
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <input pInputText [(ngModel)]="accountSearchTerm" (ngModelChange)="applyAccountFilters()" placeholder="Buscar por código, nombre o descripción" />
                        <p-select
                            [options]="accountTypeFilterOptions"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="accountTypeFilter"
                            (ngModelChange)="applyAccountFilters()"
                            placeholder="Tipo"
                        />
                        <p-select
                            [options]="accountStatusFilterOptions"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="accountStatusFilter"
                            (ngModelChange)="applyAccountFilters()"
                            placeholder="Estado"
                        />
                    </div>

                    <p-table [value]="filteredAccounts" [rows]="10" [paginator]="true" [rowsPerPageOptions]="[10,25,50]" dataKey="id" currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} cuentas">
                        <ng-template #header>
                            <tr>
                                <th>Código</th>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Estado</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-acc>
                            <tr>
                                <td class="font-medium">{{ acc.code }}</td>
                                <td>{{ acc.name }}</td>
                                <td>{{ accountTypeLabelFn(acc.type) }}</td>
                                <td><p-tag [value]="acc.active ? 'Activa' : 'Inactiva'" [severity]="acc.active ? 'success' : 'secondary'" /></td>
                                <td class="text-center">
                                    <div class="flex justify-center gap-1">
                                        <p-button size="small" icon="pi pi-pencil" severity="secondary" [outlined]="true" (onClick)="editAccount(acc)" />
                                        <p-button size="small" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="deleteAccount(acc)" />
                                    </div>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr><td colspan="5" class="text-center py-3 text-gray-500">Sin cuentas registradas</td></tr>
                        </ng-template>
                    </p-table>
                </div>
            </p-card>

            <p-dialog [header]="editingAccountId ? 'Editar cuenta' : 'Nueva cuenta'" [(visible)]="accountDialog" [modal]="true" [style]="{ width: '520px' }" [draggable]="false" [resizable]="false">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block mb-2">Código *</label>
                        <input pInputText [(ngModel)]="accountForm.code" class="w-full" />
                    </div>
                    <div>
                        <label class="block mb-2">Tipo *</label>
                        <p-select [options]="accountTypeOptions" optionLabel="label" optionValue="value" [(ngModel)]="accountForm.type" [appendTo]="'body'" class="w-full" />
                    </div>
                    <div class="md:col-span-2">
                        <label class="block mb-2">Nombre *</label>
                        <input pInputText [(ngModel)]="accountForm.name" class="w-full" />
                    </div>
                    <div class="md:col-span-2">
                        <label class="block mb-2">Descripción</label>
                        <input pInputText [(ngModel)]="accountForm.description" class="w-full" />
                    </div>
                    <div>
                        <label class="block mb-2">Permite asientos manuales</label>
                        <p-select [options]="yesNoOptions" optionLabel="label" optionValue="value" [(ngModel)]="accountForm.allowManualEntries" [appendTo]="'body'" class="w-full" />
                    </div>
                    <div>
                        <label class="block mb-2">Estado</label>
                        <p-select [options]="activeOptions" optionLabel="label" optionValue="value" [(ngModel)]="accountForm.active" [appendTo]="'body'" class="w-full" />
                    </div>
                </div>
                <ng-template #footer>
                    <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideAccountDialog()" />
                    <p-button [label]="editingAccountId ? 'Guardar cambios' : 'Crear cuenta'" icon="pi pi-check" (onClick)="submitAccount()" />
                </ng-template>
            </p-dialog>

            <p-toast />
        </div>
    `
})
export class AccountingChartOfAccounts implements OnInit {
    readonly accountTypeOptions = ACCOUNT_TYPE_OPTIONS;
    readonly accountTypeFilterOptions = ACCOUNT_TYPE_FILTER_OPTIONS;
    readonly accountStatusFilterOptions = ACCOUNT_STATUS_FILTER_OPTIONS;
    readonly yesNoOptions = YES_NO_OPTIONS;
    readonly activeOptions = ACTIVE_OPTIONS;

    accounts: AccountingAccount[] = [];
    filteredAccounts: AccountingAccount[] = [];

    editingAccountId: string | null = null;
    accountDialog = false;
    accountSearchTerm = '';
    accountTypeFilter: AccountingAccountType | '' = '';
    accountStatusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';

    accountForm = {
        code: '',
        name: '',
        type: 'ASSET' as AccountingAccountType,
        description: '',
        allowManualEntries: true,
        active: true
    };

    constructor(
        private accountingService: AccountingService,
        private messageService: MessageService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit(): void {
        setTimeout(() => this.loadAccounts(), 0);
    }

    accountTypeLabelFn(type: AccountingAccountType): string {
        return accountTypeLabel(type);
    }

    loadAccounts() {
        this.accountingService.listAccounts({ limit: 1000 }).subscribe({
            next: (rows) => {
                this.accounts = rows || [];
                this.applyAccountFilters();
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar las cuentas')
        });
    }

    applyAccountFilters() {
        const term = (this.accountSearchTerm || '').trim().toLowerCase();
        this.filteredAccounts = this.accounts.filter((account) => {
            const byTerm =
                !term ||
                account.code.toLowerCase().includes(term) ||
                account.name.toLowerCase().includes(term) ||
                (account.description || '').toLowerCase().includes(term);

            const byType = !this.accountTypeFilter || account.type === this.accountTypeFilter;

            const byStatus =
                this.accountStatusFilter === 'ALL' ||
                (this.accountStatusFilter === 'ACTIVE' && account.active) ||
                (this.accountStatusFilter === 'INACTIVE' && !account.active);

            return byTerm && byType && byStatus;
        });
        this.cdr.markForCheck();
    }

    submitAccount() {
        const payload = {
            code: this.accountForm.code,
            name: this.accountForm.name,
            type: this.accountForm.type,
            description: this.accountForm.description,
            allowManualEntries: this.accountForm.allowManualEntries,
            active: this.accountForm.active
        };

        if (this.editingAccountId) {
            this.accountingService.updateAccount(this.editingAccountId, payload).subscribe({
                next: () => {
                    this.success('Cuenta actualizada');
                    this.cancelAccountEdit();
                    this.hideAccountDialog();
                    this.loadAccounts();
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo actualizar la cuenta')
            });
            return;
        }

        this.accountingService.createAccount(payload).subscribe({
            next: () => {
                this.success('Cuenta creada');
                this.cancelAccountEdit();
                this.hideAccountDialog();
                this.loadAccounts();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo crear la cuenta')
        });
    }

    openNewAccountDialog() {
        this.cancelAccountEdit();
        this.accountDialog = true;
    }

    hideAccountDialog() {
        this.accountDialog = false;
    }

    editAccount(account: AccountingAccount) {
        this.editingAccountId = account.id;
        this.accountForm = {
            code: account.code,
            name: account.name,
            type: account.type,
            description: account.description || '',
            allowManualEntries: !!account.allowManualEntries,
            active: !!account.active
        };
        this.accountDialog = true;
    }

    cancelAccountEdit() {
        this.editingAccountId = null;
        this.accountForm = { code: '', name: '', type: 'ASSET', description: '', allowManualEntries: true, active: true };
    }

    deleteAccount(account: AccountingAccount) {
        const ok = window.confirm(`¿Eliminar cuenta "${account.code} - ${account.name}"?`);
        if (!ok) return;
        this.accountingService.deleteAccount(account.id).subscribe({
            next: () => {
                this.success('Cuenta eliminada');
                if (this.editingAccountId === account.id) {
                    this.cancelAccountEdit();
                    this.hideAccountDialog();
                }
                this.loadAccounts();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo eliminar la cuenta')
        });
    }

    seedDefaultChart() {
        this.accountingService.seedDefaultChart().subscribe({
            next: () => {
                this.success('Plan base cargado');
                this.loadAccounts();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo cargar el plan base')
        });
    }

    private success(detail: string) {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
    }

    private error(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
