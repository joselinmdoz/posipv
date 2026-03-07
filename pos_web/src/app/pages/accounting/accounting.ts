import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import {
    AccountingAccount,
    AccountingJournalReport,
    AccountingLedgerReport,
    AccountingPostingRule,
    AccountingPostingRuleKey,
    AccountingAccountType,
    AccountingService,
    AccountingTrialBalanceReport,
    CurrencyCode,
    FiscalPeriod,
    JournalEntryDetail,
    JournalEntryLine,
    JournalEntryStatus
} from '@/app/core/services/accounting.service';

@Component({
    selector: 'app-accounting',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, CardModule, DialogModule, InputTextModule, InputNumberModule, SelectModule, TableModule, TagModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div>
                <h1 class="text-2xl font-bold mb-1">Contabilidad</h1>
                <p class="text-gray-500 m-0">Plan de cuentas, períodos fiscales y asientos manuales.</p>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <p-card header="Plan de Cuentas">
                    <div class="flex flex-col gap-3">
                        <div class="flex flex-wrap gap-2">
                            <p-button label="Nueva cuenta" icon="pi pi-plus" (onClick)="openNewAccountDialog()" />
                            <p-button label="Cargar plan base" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="seedDefaultChart()" />
                            <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadAccounts()" />
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                                pInputText
                                [(ngModel)]="accountSearchTerm"
                                (ngModelChange)="applyAccountFilters()"
                                placeholder="Buscar por código, nombre o descripción"
                            />
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

                        <p-table
                            [value]="filteredAccounts"
                            [rows]="10"
                            [paginator]="true"
                            [rowsPerPageOptions]="[10, 25, 50]"
                            dataKey="id"
                            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} cuentas"
                        >
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
                                    <td>{{ accountTypeLabel(acc.type) }}</td>
                                    <td>
                                        <p-tag [value]="acc.active ? 'Activa' : 'Inactiva'" [severity]="acc.active ? 'success' : 'secondary'" />
                                    </td>
                                    <td class="text-center">
                                        <div class="flex justify-center gap-1">
                                            <p-button size="small" icon="pi pi-pencil" severity="secondary" [outlined]="true" (onClick)="editAccount(acc)" />
                                            <p-button size="small" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="deleteAccount(acc)" />
                                        </div>
                                    </td>
                                </tr>
                            </ng-template>
                            <ng-template #emptymessage>
                                <tr>
                                    <td colspan="5" class="text-center py-3 text-gray-500">Sin cuentas registradas</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                </p-card>

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

                        <p-table
                            [value]="filteredPeriods"
                            [rows]="10"
                            [paginator]="true"
                            [rowsPerPageOptions]="[10, 25, 50]"
                            dataKey="id"
                            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} períodos"
                        >
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
                                    <td>{{ formatDate(period.startDate) }} - {{ formatDate(period.endDate) }}</td>
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
                                <tr>
                                    <td colspan="4" class="text-center py-3 text-gray-500">Sin períodos creados</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                </p-card>
            </div>

            <p-dialog
                [header]="editingAccountId ? 'Editar cuenta' : 'Nueva cuenta'"
                [(visible)]="accountDialog"
                [modal]="true"
                [style]="{ width: '520px' }"
                [draggable]="false"
                [resizable]="false"
            >
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

            <p-dialog
                [header]="editingPeriodId ? 'Editar período' : 'Nuevo período'"
                [(visible)]="periodDialog"
                [modal]="true"
                [style]="{ width: '520px' }"
                [draggable]="false"
                [resizable]="false"
            >
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

            <p-card header="Reglas de Contabilización Automática">
                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
                        <p-select [options]="postingRuleKeyOptions" optionLabel="label" optionValue="value" [(ngModel)]="postingRuleForm.key" placeholder="Clave de regla" />
                        <input pInputText [(ngModel)]="postingRuleForm.name" placeholder="Nombre (opcional)" />
                        <p-select [options]="ruleAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="postingRuleForm.debitAccountId" placeholder="Cuenta débito" />
                        <p-select [options]="ruleAccountOptions" optionLabel="label" optionValue="value" [(ngModel)]="postingRuleForm.creditAccountId" placeholder="Cuenta crédito" />
                        <p-button label="Crear / Reactivar regla" icon="pi pi-plus" (onClick)="createPostingRule()" />
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadPostingRules()" />
                        <p-button label="Restaurar reglas por defecto" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="seedDefaultPostingRules()" />
                    </div>

                    <div class="overflow-auto border rounded-lg">
                        <table class="w-full text-sm">
                            <thead>
                                <tr class="bg-surface-100">
                                    <th class="text-left py-2 px-3">Regla</th>
                                    <th class="text-left py-2 px-3">Cuenta Débito</th>
                                    <th class="text-left py-2 px-3">Cuenta Crédito</th>
                                    <th class="text-left py-2 px-3">Activa</th>
                                    <th class="text-left py-2 px-3">Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                @for (rule of postingRules; track rule.id) {
                                    <tr>
                                        <td class="py-2 px-3 min-w-52">
                                            <div class="font-semibold">{{ postingRuleLabel(rule.key) }}</div>
                                            <div class="text-xs text-gray-500">{{ rule.key }}</div>
                                        </td>
                                        <td class="py-2 px-3 min-w-64">
                                            <p-select
                                                [options]="ruleAccountOptions"
                                                optionLabel="label"
                                                optionValue="value"
                                                [(ngModel)]="rule.debitAccountId"
                                                [appendTo]="'body'"
                                                class="w-full"
                                            />
                                        </td>
                                        <td class="py-2 px-3 min-w-64">
                                            <p-select
                                                [options]="ruleAccountOptions"
                                                optionLabel="label"
                                                optionValue="value"
                                                [(ngModel)]="rule.creditAccountId"
                                                [appendTo]="'body'"
                                                class="w-full"
                                            />
                                        </td>
                                        <td class="py-2 px-3">
                                            <input type="checkbox" [(ngModel)]="rule.active" />
                                        </td>
                                        <td class="py-2 px-3">
                                            <div class="flex flex-wrap gap-1">
                                                <p-button size="small" icon="pi pi-save" label="Guardar" (onClick)="savePostingRule(rule)" />
                                                <p-button size="small" icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="deletePostingRule(rule)" />
                                            </div>
                                        </td>
                                    </tr>
                                }
                                @if (!postingRules.length) {
                                    <tr>
                                        <td colspan="5" class="text-center py-3 text-gray-500">Sin reglas contables configuradas</td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </p-card>

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
                                            <p-select
                                                [options]="manualAccountOptions"
                                                optionLabel="label"
                                                optionValue="value"
                                                [(ngModel)]="line.accountId"
                                                [appendTo]="'body'"
                                                placeholder="Seleccione cuenta"
                                                class="w-full"
                                            />
                                        </td>
                                        <td class="py-2 px-3 min-w-40">
                                            <p-select
                                                [options]="lineSideOptions"
                                                optionLabel="label"
                                                optionValue="value"
                                                [(ngModel)]="line.side"
                                                [appendTo]="'body'"
                                                class="w-full"
                                            />
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
                                        <td class="py-2 px-3">{{ formatDate(entry.date) }}</td>
                                        <td class="py-2 px-3">{{ entry.description }}</td>
                                        <td class="py-2 px-3">
                                            <p-tag
                                                [value]="entry.status"
                                                [severity]="entry.status === 'POSTED' ? 'success' : entry.status === 'DRAFT' ? 'warn' : 'danger'"
                                            />
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
                                    <tr>
                                        <td colspan="7" class="text-center py-3 text-gray-500">Sin asientos registrados</td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                </div>
            </p-card>

            <p-card header="Reportes Contables">
                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
                            <p-select
                                [options]="allPeriodOptionsList"
                                optionLabel="label"
                                optionValue="value"
                                [(ngModel)]="reportFilters.periodId"
                                placeholder="Período (opcional)"
                        />
                        <input pInputText type="date" [(ngModel)]="reportFilters.fromDate" />
                        <input pInputText type="date" [(ngModel)]="reportFilters.toDate" />
                        <div class="flex items-center gap-2">
                            <input id="rep-draft" type="checkbox" [(ngModel)]="reportFilters.includeDraft" />
                            <label for="rep-draft" class="text-sm">Incluir borradores</label>
                        </div>
                        <div class="flex items-center gap-2">
                            <input id="rep-void" type="checkbox" [(ngModel)]="reportFilters.includeVoid" />
                            <label for="rep-void" class="text-sm">Incluir anulados</label>
                        </div>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <p-button label="Libro Diario" icon="pi pi-book" (onClick)="loadJournalReport()" />
                        <p-button label="Balanza" icon="pi pi-chart-bar" severity="secondary" [outlined]="true" (onClick)="loadTrialBalanceReport()" />
                        <p-select
                            [options]="ruleAccountOptions"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="ledgerAccountId"
                            [appendTo]="'body'"
                            placeholder="Cuenta para Mayor"
                            class="min-w-80"
                        />
                        <p-button label="Mayor" icon="pi pi-list" severity="secondary" [outlined]="true" (onClick)="loadLedgerReport()" />
                    </div>

                    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div class="border rounded-lg p-3 overflow-auto">
                            <div class="font-semibold mb-2">Libro Diario</div>
                            @if (journalReport) {
                                <div class="text-sm mb-2">
                                    Entradas: {{ journalReport.totals.entries }} |
                                    Débito: {{ journalReport.totals.totalDebit | number: '1.2-2' }} |
                                    Crédito: {{ journalReport.totals.totalCredit | number: '1.2-2' }}
                                </div>
                            }
                            <table class="w-full text-sm">
                                <thead>
                                    <tr class="bg-surface-100">
                                        <th class="text-left py-2 px-3">No.</th>
                                        <th class="text-left py-2 px-3">Fecha</th>
                                        <th class="text-left py-2 px-3">Descripción</th>
                                        <th class="text-right py-2 px-3">Débito</th>
                                        <th class="text-right py-2 px-3">Crédito</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @for (row of journalReport?.entries || []; track row.id) {
                                        <tr>
                                            <td class="py-2 px-3">{{ row.entryNumber }}</td>
                                            <td class="py-2 px-3">{{ formatDate(row.date) }}</td>
                                            <td class="py-2 px-3">{{ row.description }}</td>
                                            <td class="py-2 px-3 text-right">{{ row.totalDebit | number: '1.2-2' }}</td>
                                            <td class="py-2 px-3 text-right">{{ row.totalCredit | number: '1.2-2' }}</td>
                                        </tr>
                                    }
                                    @if (!(journalReport?.entries || []).length) {
                                        <tr><td colspan="5" class="text-center py-3 text-gray-500">Sin datos</td></tr>
                                    }
                                </tbody>
                            </table>
                        </div>

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
                                        <td class="py-2 px-3">{{ formatDate(mov.date) }}</td>
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

            @if (selectedEntry) {
                <p-card [header]="'Detalle ' + selectedEntry.entryNumber">
                    <div class="flex flex-col gap-3">
                        <div class="text-sm text-gray-600">
                            {{ selectedEntry.description }} | {{ formatDateTime(selectedEntry.date) }} | Estado: {{ selectedEntry.status }}
                        </div>
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
        </div>
        <p-toast />
    `
})
export class Accounting implements OnInit {
    readonly accountTypeOptions = [
        { label: 'Activo', value: 'ASSET' as AccountingAccountType },
        { label: 'Pasivo', value: 'LIABILITY' as AccountingAccountType },
        { label: 'Patrimonio', value: 'EQUITY' as AccountingAccountType },
        { label: 'Ingreso', value: 'INCOME' as AccountingAccountType },
        { label: 'Gasto', value: 'EXPENSE' as AccountingAccountType }
    ];
    readonly accountTypeFilterOptions: Array<{ label: string; value: AccountingAccountType | '' }> = [
        { label: 'Todos los tipos', value: '' },
        { label: 'Activo', value: 'ASSET' },
        { label: 'Pasivo', value: 'LIABILITY' },
        { label: 'Patrimonio', value: 'EQUITY' },
        { label: 'Ingreso', value: 'INCOME' },
        { label: 'Gasto', value: 'EXPENSE' }
    ];
    readonly accountStatusFilterOptions: Array<{ label: string; value: 'ALL' | 'ACTIVE' | 'INACTIVE' }> = [
        { label: 'Todos los estados', value: 'ALL' },
        { label: 'Activas', value: 'ACTIVE' },
        { label: 'Inactivas', value: 'INACTIVE' }
    ];
    readonly periodStatusFilterOptions: Array<{ label: string; value: '' | 'OPEN' | 'CLOSED' }> = [
        { label: 'Todos los estados', value: '' },
        { label: 'Abiertos', value: 'OPEN' },
        { label: 'Cerrados', value: 'CLOSED' }
    ];
    readonly yesNoOptions = [
        { label: 'Sí', value: true },
        { label: 'No', value: false }
    ];
    readonly activeOptions = [
        { label: 'Activo', value: true },
        { label: 'Inactivo', value: false }
    ];

    readonly lineSideOptions = [
        { label: 'Débito', value: 'DEBIT' as const },
        { label: 'Crédito', value: 'CREDIT' as const }
    ];

    readonly currencyOptions = [
        { label: 'CUP', value: 'CUP' as CurrencyCode },
        { label: 'USD', value: 'USD' as CurrencyCode }
    ];

    accounts: AccountingAccount[] = [];
    filteredAccounts: AccountingAccount[] = [];
    postingRules: AccountingPostingRule[] = [];
    periods: FiscalPeriod[] = [];
    filteredPeriods: FiscalPeriod[] = [];
    editingAccountId: string | null = null;
    editingPeriodId: string | null = null;
    accountDialog = false;
    periodDialog = false;
    accountSearchTerm = '';
    accountTypeFilter: AccountingAccountType | '' = '';
    accountStatusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
    periodSearchTerm = '';
    periodStatusFilter: '' | 'OPEN' | 'CLOSED' = '';
    manualAccountOptions: Array<{ label: string; value: string }> = [];
    ruleAccountOptions: Array<{ label: string; value: string }> = [];
    openPeriodOptions: Array<{ label: string; value: string }> = [];
    allPeriodOptionsList: Array<{ label: string; value: string }> = [];
    postingRuleKeyOptions: Array<{ label: string; value: AccountingPostingRuleKey }> = [];
    entries: any[] = [];
    selectedEntry: JournalEntryDetail | null = null;
    journalReport: AccountingJournalReport | null = null;
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
    postingRuleForm: {
        key: AccountingPostingRuleKey;
        name: string;
        debitAccountId: string;
        creditAccountId: string;
    } = {
        key: 'SALE_REVENUE_CUP',
        name: '',
        debitAccountId: '',
        creditAccountId: ''
    };

    accountForm = {
        code: '',
        name: '',
        type: 'ASSET' as AccountingAccountType,
        description: '',
        allowManualEntries: true,
        active: true
    };

    periodForm = {
        name: '',
        startDate: '',
        endDate: ''
    };

    entryForm: {
        date: string;
        description: string;
        reference: string;
        currency: CurrencyCode;
        periodId: string;
        lines: JournalEntryLine[];
    } = {
        date: this.todayInput(),
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
        this.rebuildPostingRuleKeyOptions();
        // Evita NG0100 al inicializar selects/tablas con datos asíncronos de forma inmediata.
        setTimeout(() => this.loadAll(), 0);
    }

    loadAll() {
        this.loadAccounts();
        this.loadPostingRules();
        this.loadPeriods();
        this.loadEntries();
        this.loadTrialBalanceReport();
        this.loadJournalReport();
    }

    loadAccounts() {
        this.accountingService.listAccounts({ limit: 1000 }).subscribe({
            next: (rows) => {
                this.accounts = rows || [];
                this.rebuildAccountOptions();
                this.applyAccountFilters();
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar las cuentas')
        });
    }

    loadPostingRules() {
        this.accountingService.listPostingRules().subscribe({
            next: (rows) => {
                this.postingRules = rows || [];
                this.rebuildPostingRuleKeyOptions();
                this.cdr.markForCheck();
            },
            error: () => this.error('No se pudieron cargar las reglas contables')
        });
    }

    loadPeriods() {
        this.accountingService.listPeriods({ limit: 500 }).subscribe({
            next: (rows) => {
                this.periods = rows || [];
                this.rebuildPeriodOptions();
                this.applyPeriodFilters();
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
                this.loadPostingRules();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo cargar el plan base')
        });
    }

    seedDefaultPostingRules() {
        this.accountingService.seedDefaultPostingRules().subscribe({
            next: (rows) => {
                this.postingRules = rows || [];
                this.rebuildPostingRuleKeyOptions();
                this.success('Reglas por defecto cargadas');
                this.cdr.markForCheck();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudieron cargar las reglas por defecto')
        });
    }

    createPostingRule() {
        this.accountingService
            .createPostingRule({
                key: this.postingRuleForm.key,
                name: this.postingRuleForm.name || undefined,
                debitAccountId: this.postingRuleForm.debitAccountId || undefined,
                creditAccountId: this.postingRuleForm.creditAccountId || undefined,
                active: true
            })
            .subscribe({
                next: () => {
                    this.success('Regla creada/reactivada');
                    this.postingRuleForm = {
                        key: this.postingRuleForm.key,
                        name: '',
                        debitAccountId: '',
                        creditAccountId: ''
                    };
                    this.loadPostingRules();
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo crear/reactivar la regla')
            });
    }

    savePostingRule(rule: AccountingPostingRule) {
        this.accountingService
            .updatePostingRule(rule.key, {
                name: rule.name,
                description: rule.description || undefined,
                active: rule.active,
                debitAccountId: rule.debitAccountId,
                creditAccountId: rule.creditAccountId
            })
            .subscribe({
                next: (saved) => {
                    const idx = this.postingRules.findIndex((r) => r.id === saved.id);
                    if (idx >= 0) this.postingRules[idx] = saved;
                    this.success(`Regla ${this.postingRuleLabel(saved.key)} actualizada`);
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo actualizar la regla')
            });
    }

    deletePostingRule(rule: AccountingPostingRule) {
        const ok = window.confirm(`¿Desactivar regla "${this.postingRuleLabel(rule.key)}"?`);
        if (!ok) return;
        this.accountingService.deletePostingRule(rule.key).subscribe({
            next: () => {
                this.success(`Regla ${this.postingRuleLabel(rule.key)} desactivada`);
                this.loadPostingRules();
            },
            error: (e) => this.error(e?.error?.message || 'No se pudo desactivar la regla')
        });
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
            startDate: this.toInputDate(period.startDate),
            endDate: this.toInputDate(period.endDate)
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
            date: this.todayInput(),
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
        return this.entryForm.lines
            .filter((line) => line.side === 'DEBIT')
            .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    }

    totalCredit() {
        return this.entryForm.lines
            .filter((line) => line.side === 'CREDIT')
            .reduce((sum, line) => sum + Number(line.amount || 0), 0);
    }

    loadJournalReport() {
        this.accountingService
            .getJournalReport({
                periodId: this.reportFilters.periodId || undefined,
                fromDate: this.reportFilters.fromDate || undefined,
                toDate: this.reportFilters.toDate || undefined,
                includeDraft: this.reportFilters.includeDraft,
                includeVoid: this.reportFilters.includeVoid,
                limit: 500
            })
            .subscribe({
                next: (report) => {
                    this.journalReport = report;
                    this.cdr.markForCheck();
                },
                error: (e) => this.error(e?.error?.message || 'No se pudo cargar el libro diario')
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

    private rebuildAccountOptions() {
        this.manualAccountOptions = this.accounts
            .filter((acc) => acc.active && acc.allowManualEntries)
            .map((acc) => ({ label: `${acc.code} - ${acc.name}`, value: acc.id }));

        this.ruleAccountOptions = this.accounts
            .filter((acc) => acc.active)
            .map((acc) => ({ label: `${acc.code} - ${acc.name}`, value: acc.id }));
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

    private rebuildPeriodOptions() {
        this.openPeriodOptions = this.periods
            .filter((period) => period.status === 'OPEN')
            .map((period) => ({
                label: `${period.name} (${this.formatDate(period.startDate)} - ${this.formatDate(period.endDate)})`,
                value: period.id
            }));

        this.allPeriodOptionsList = this.periods.map((period) => ({
            label: `${period.name} (${this.formatDate(period.startDate)} - ${this.formatDate(period.endDate)})`,
            value: period.id
        }));
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

    private rebuildPostingRuleKeyOptions() {
        const labels: Record<AccountingPostingRuleKey, string> = {
            SALE_REVENUE_CUP: 'Ingreso venta CUP',
            SALE_REVENUE_USD: 'Ingreso venta USD',
            SALE_COGS: 'Costo de venta',
            STOCK_IN: 'Entrada inventario',
            STOCK_OUT: 'Salida inventario'
        };
        this.postingRuleKeyOptions = (Object.keys(labels) as AccountingPostingRuleKey[]).map((key) => ({
            label: `${labels[key]} (${key})`,
            value: key
        }));
    }

    postingRuleLabel(key: AccountingPostingRuleKey) {
        const map: Record<AccountingPostingRuleKey, string> = {
            SALE_REVENUE_CUP: 'Ingreso venta CUP',
            SALE_REVENUE_USD: 'Ingreso venta USD',
            SALE_COGS: 'Costo de venta',
            STOCK_IN: 'Entrada inventario',
            STOCK_OUT: 'Salida inventario'
        };
        return map[key] || key;
    }

    accountTypeLabel(type: AccountingAccountType): string {
        const map: Record<AccountingAccountType, string> = {
            ASSET: 'Activo',
            LIABILITY: 'Pasivo',
            EQUITY: 'Patrimonio',
            INCOME: 'Ingreso',
            EXPENSE: 'Gasto'
        };
        return map[type] || type;
    }

    formatDate(value: string | Date | null | undefined): string {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    }

    formatDateTime(value: string | Date | null | undefined): string {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    private todayInput() {
        return new Date().toISOString().slice(0, 10);
    }

    private toInputDate(value: string | Date | null | undefined): string {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    }

    private success(detail: string) {
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
    }

    private error(detail: string) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }
}
