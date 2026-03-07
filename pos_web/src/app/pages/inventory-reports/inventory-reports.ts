import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ConfirmationService, MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { catchError, forkJoin, of } from 'rxjs';
import { CashSession, CashSessionsService } from '@/app/core/services/cash-sessions.service';
import { InventoryReportsService, SessionIvpReport } from '@/app/core/services/inventory-reports.service';
import { Warehouse, WarehousesService } from '@/app/core/services/warehouses.service';
import { AuthService } from '@/app/core/services/auth.service';
import { SettingsService } from '@/app/core/services/settings.service';

type SessionStatusFilter = 'ALL' | 'OPEN' | 'CLOSED';

@Component({
    selector: 'app-inventory-reports',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        CardModule,
        ConfirmDialogModule,
        DatePickerModule,
        DialogModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        ToastModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <p-toast />
            <p-confirmdialog />

            <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 class="text-2xl font-bold m-0">Informes de Inventario (IPV)</h1>
                    <p class="text-sm text-gray-600 mt-1 mb-0">
                        Un IPV por sesión de TPV. Consulta y filtra por sesión, estado, almacén y fecha.
                    </p>
                </div>
                <div class="flex items-center gap-2">
                    <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" [loading]="loading()" (onClick)="refreshData()" />
                </div>
            </div>

            <p-card>
                <ng-template pTemplate="header">
                    <div class="p-3 bg-primary text-white font-bold">Filtros de búsqueda</div>
                </ng-template>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <div class="flex flex-col gap-2">
                        <label>Estado de sesión</label>
                        <p-select
                            [options]="statusOptions"
                            [(ngModel)]="selectedStatus"
                            optionLabel="label"
                            optionValue="value"
                            class="w-full"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label>Almacén</label>
                        <p-select
                            [options]="warehouseOptions()"
                            [(ngModel)]="selectedWarehouseId"
                            optionLabel="name"
                            optionValue="id"
                            [filter]="true"
                            [showClear]="true"
                            placeholder="Todos los almacenes"
                            class="w-full"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label>Sesión (ID completo o parcial)</label>
                        <input pInputText [(ngModel)]="sessionQuery" class="w-full" placeholder="Ej: cm4abc..." />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label>Buscar TPV / Almacén</label>
                        <input pInputText [(ngModel)]="keyword" class="w-full" placeholder="Texto libre..." />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label>Apertura desde</label>
                        <p-datepicker
                            [(ngModel)]="startDate"
                            dateFormat="yy-mm-dd"
                            [showIcon]="true"
                            [maxDate]="endDate || undefined"
                            class="w-full"
                        />
                    </div>

                    <div class="flex flex-col gap-2">
                        <label>Apertura hasta</label>
                        <p-datepicker
                            [(ngModel)]="endDate"
                            dateFormat="yy-mm-dd"
                            [showIcon]="true"
                            [minDate]="startDate || undefined"
                            [maxDate]="today"
                            class="w-full"
                        />
                    </div>
                </div>

                <div class="mt-4 flex flex-wrap items-center gap-2">
                    <p-button label="Hoy" severity="secondary" [outlined]="true" (onClick)="setQuickRange(1)" />
                    <p-button label="7 días" severity="secondary" [outlined]="true" (onClick)="setQuickRange(7)" />
                    <p-button label="30 días" severity="secondary" [outlined]="true" (onClick)="setQuickRange(30)" />
                    <p-button label="90 días" severity="secondary" [outlined]="true" (onClick)="setQuickRange(90)" />
                    <span class="mx-1 text-gray-300">|</span>
                    <p-button label="Buscar" icon="pi pi-search" (onClick)="searchReports()" [loading]="loading()" />
                    <p-button label="Limpiar" icon="pi pi-eraser" severity="secondary" [outlined]="true" (onClick)="clearFilters()" [disabled]="loading()" />
                </div>
            </p-card>

            @if (searchExecuted()) {
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                    <p-card>
                        <div class="text-xs uppercase text-gray-500 font-semibold">Sesiones IPV</div>
                        <div class="text-2xl font-bold mt-1">{{ summary().totalSessions }}</div>
                    </p-card>
                    <p-card>
                        <div class="text-xs uppercase text-gray-500 font-semibold">Sesiones abiertas</div>
                        <div class="text-2xl font-bold mt-1 text-green-700">{{ summary().openSessions }}</div>
                    </p-card>
                    <p-card>
                        <div class="text-xs uppercase text-gray-500 font-semibold">Sesiones cerradas</div>
                        <div class="text-2xl font-bold mt-1 text-cyan-700">{{ summary().closedSessions }}</div>
                    </p-card>
                    <p-card>
                        <div class="text-xs uppercase text-gray-500 font-semibold">Importe total vendido</div>
                        @if (summaryCurrencyLabel() === 'VARIOS') {
                            <div class="text-xl font-bold mt-1 flex flex-wrap items-center gap-1">
                                @for (total of summaryTotalsByCurrency(); track total.currency; let isLast = $last) {
                                    <span>{{ formatMoney(total.amount, total.currency) }}</span>
                                    @if (!isLast) {
                                        <span class="text-gray-400 px-1">/</span>
                                    }
                                }
                            </div>
                        } @else {
                            <div class="text-2xl font-bold mt-1">{{ formatMoney(summary().totalAmount, summaryCurrencyLabel()) }}</div>
                        }
                    </p-card>
                </div>
            }

            <p-card>
                <ng-template pTemplate="header">
                    <div class="p-3 bg-primary text-white font-bold">Resultados por sesión</div>
                </ng-template>

                @if (!loading() && reports().length === 0) {
                    <div class="py-8 text-center text-gray-500">
                        <i class="pi pi-folder-open text-3xl mb-2 block"></i>
                        @if (searchExecuted()) {
                            <p class="m-0">No se encontraron IPV para los filtros seleccionados.</p>
                        } @else {
                            <p class="m-0">Aplica filtros y presiona Buscar para consultar IPV por sesión.</p>
                        }
                    </div>
                } @else {
                    <p-table
                        [value]="reports()"
                        [loading]="loading()"
                        [paginator]="true"
                        [rows]="12"
                        [rowsPerPageOptions]="[12, 25, 50]"
                        sortField="openedAt"
                        [sortOrder]="-1"
                        styleClass="p-datatable-sm"
                    >
                        <ng-template pTemplate="header">
                            <tr>
                                <th>TPV</th>
                                <th>Sesión</th>
                                <th>Apertura</th>
                                <th>Cierre</th>
                                <th>Estado</th>
                                <th class="text-right">Ventas</th>
                                <th class="text-right">Entradas</th>
                                <th class="text-right">Salidas</th>
                                <th class="text-right">Importe</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </ng-template>

                        <ng-template pTemplate="body" let-report>
                            <tr>
                                <td>{{ report.register.name }}</td>
                                <td><code class="text-xs">{{ report.cashSessionId.substring(0, 8) }}</code></td>
                                <td>{{ report.openedAt | date:'dd/MM/yyyy HH:mm' }}</td>
                                <td>{{ report.closedAt ? (report.closedAt | date:'dd/MM/yyyy HH:mm') : 'En curso' }}</td>
                                <td>
                                    <p-tag [value]="report.closed ? 'Cerrada' : 'Abierta'" [severity]="report.closed ? 'info' : 'success'" />
                                </td>
                                <td class="text-right">{{ report.totals.sales }}</td>
                                <td class="text-right">{{ report.totals.entries }}</td>
                                <td class="text-right">{{ report.totals.outs }}</td>
                                <td class="text-right font-semibold">{{ formatMoney(report.totals.amount, getReportDisplayCurrency(report)) }}</td>
                                <td class="text-center">
                                    <p-button
                                        icon="pi pi-eye"
                                        [rounded]="true"
                                        [text]="true"
                                        severity="secondary"
                                        (onClick)="viewReport(report)"
                                    />
                                    @if (canDeleteIpvReports()) {
                                        <p-button
                                            icon="pi pi-trash"
                                            [rounded]="true"
                                            [text]="true"
                                            severity="danger"
                                            (onClick)="deleteReport(report)"
                                        />
                                    }
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                }
            </p-card>
        </div>

        <p-dialog
            header="Reporte IPV de la Sesión"
            [(visible)]="showDetail"
            [modal]="true"
            [style]="{ width: '1120px' }"
            [breakpoints]="{ '1400px': '96vw', '960px': '98vw' }"
            styleClass="tpv-ipv-dialog"
        >
            <div class="tpv-ipv-modal">
                @if (detailLoading()) {
                    <div class="tpv-ipv-loading">
                        <i class="pi pi-spin pi-spinner"></i>
                        <p>Cargando reporte IPV...</p>
                    </div>
                } @else if (selectedReport()) {
                    <div class="tpv-ipv-toolbar">
                        <div class="tpv-ipv-session-meta">
                            <div>
                                TPV:
                                <strong>{{ selectedReport()!.register.name }}</strong>
                            </div>
                            <div>
                                Apertura:
                                <strong>{{ selectedReport()!.openedAt | date:'dd/MM/yyyy HH:mm' }}</strong>
                            </div>
                            <div>
                                Empleado:
                                <strong>{{ getSessionResponsibleLabel(selectedReport()!) }}</strong>
                            </div>
                        </div>
                        <div class="tpv-ipv-toolbar-actions">
                            <p-button icon="pi pi-refresh" label="Actualizar" severity="secondary" [outlined]="true" (onClick)="refreshSelectedReport()" />
                            <p-button icon="pi pi-file-pdf" label="Exportar PDF" severity="secondary" (onClick)="exportSelectedReportAsPdf()" />
                            @if (canDeleteIpvReports()) {
                                <p-button icon="pi pi-trash" label="Eliminar IPV" severity="danger" [outlined]="true" (onClick)="deleteReport(selectedReport()!)" />
                            }
                        </div>
                    </div>

                    <div class="tpv-ipv-summary">
                        <div class="tpv-ipv-summary-item">
                            <span>Total de ventas</span>
                            <strong>{{ selectedReport()!.totals.sales }}</strong>
                        </div>
                        <div class="tpv-ipv-summary-item">
                            <span>Total de entradas</span>
                            <strong>{{ selectedReport()!.totals.entries }}</strong>
                        </div>
                        <div class="tpv-ipv-summary-item">
                            <span>Total de salidas</span>
                            <strong>{{ selectedReport()!.totals.outs }}</strong>
                        </div>
                        @for (paymentRow of selectedReportPaymentRows(); track paymentRow.code) {
                            <div class="tpv-ipv-summary-item">
                                <span>Total {{ paymentRow.label.toLowerCase() }}</span>
                                <strong>{{ formatMoney(paymentRow.amount, selectedReportCurrency()) }}</strong>
                            </div>
                        }
                    </div>

                    <div class="tpv-ipv-table-wrap">
                        <table class="tpv-ipv-table">
                            <thead>
                                <tr>
                                    <th class="text-left">Producto</th>
                                    <th class="text-right">Inicio</th>
                                    <th class="text-right">Entradas</th>
                                    <th class="text-right">Salidas</th>
                                    <th class="text-right">Ventas</th>
                                    <th class="text-right">Total</th>
                                    <th class="text-right">Final</th>
                                    <th class="text-right">Precio</th>
                                    <th class="text-right">Importe</th>
                                </tr>
                            </thead>
                            <tbody>
                                @if (selectedReport()!.lines.length === 0) {
                                    <tr>
                                        <td colspan="9" class="tpv-ipv-empty-cell">No hay productos para mostrar en este IPV.</td>
                                    </tr>
                                } @else {
                                    @for (line of selectedReport()!.lines; track line.productId) {
                                        <tr>
                                            <td>
                                                <div class="tpv-ipv-product-name">{{ line.name }}</div>
                                                <div class="tpv-ipv-product-code">{{ line.codigo || '-' }}</div>
                                            </td>
                                            <td class="text-right">{{ line.initial }}</td>
                                            <td class="text-right text-green-700">{{ line.entries }}</td>
                                            <td class="text-right text-red-600">{{ line.outs }}</td>
                                            <td class="text-right font-semibold">{{ line.sales }}</td>
                                            <td class="text-right">{{ line.total }}</td>
                                            <td class="text-right font-semibold">{{ line.final }}</td>
                                            <td class="text-right">{{ formatMoney(line.price, line.currency || selectedReportCurrency()) }}</td>
                                            <td class="text-right font-semibold">{{ formatMoney(line.amount, line.currency || selectedReportCurrency()) }}</td>
                                        </tr>
                                    }
                                }
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="8" class="text-right">Total Importe</td>
                                    <td class="text-right">{{ formatMoney(selectedReport()!.totals.amount, selectedReportCurrency()) }}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                } @else {
                    <div class="tpv-ipv-empty">
                        <i class="pi pi-folder-open"></i>
                        <p>No hay reporte IPV disponible para esta sesión.</p>
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cerrar" icon="pi pi-times" text (onClick)="showDetail = false" />
            </ng-template>
        </p-dialog>
    `
})
export class InventoryReportsComponent implements OnInit {
    private readonly ipvService = inject(InventoryReportsService);
    private readonly warehousesService = inject(WarehousesService);
    private readonly cashSessionsService = inject(CashSessionsService);
    private readonly settingsService = inject(SettingsService);
    private readonly messageService = inject(MessageService);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly authService = inject(AuthService);

    readonly sessions = signal<CashSession[]>([]);
    readonly warehouses = signal<Warehouse[]>([]);
    readonly reports = signal<SessionIvpReport[]>([]);
    readonly loading = signal<boolean>(false);
    readonly detailLoading = signal<boolean>(false);
    readonly searchExecuted = signal<boolean>(false);
    readonly selectedReport = signal<SessionIvpReport | null>(null);
    readonly selectedReportPaymentRows = signal<Array<{ code: string; label: string; amount: number }>>([]);
    readonly selectedReportCurrency = signal<string>('CUP');

    showDetail = false;

    selectedStatus: SessionStatusFilter = 'ALL';
    selectedWarehouseId: string | null = null;
    sessionQuery = '';
    keyword = '';
    startDate: Date | null = null;
    endDate: Date | null = null;
    readonly today = new Date();

    readonly statusOptions = [
        { label: 'Todos', value: 'ALL' as SessionStatusFilter },
        { label: 'Abiertas', value: 'OPEN' as SessionStatusFilter },
        { label: 'Cerradas', value: 'CLOSED' as SessionStatusFilter }
    ];

    private readonly paymentMethodCatalog: Array<{ label: string; value: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'; defaultEnabled: boolean }> = [
        { label: 'Efectivo', value: 'CASH', defaultEnabled: true },
        { label: 'Tarjeta', value: 'CARD', defaultEnabled: true },
        { label: 'Transferencia', value: 'TRANSFER', defaultEnabled: true },
        { label: 'Otro', value: 'OTHER', defaultEnabled: false }
    ];

    readonly warehouseOptions = computed(() => {
        const base = [{ id: null, name: 'Todos los almacenes' }];
        const rows = this.warehouses().map((warehouse) => ({
            id: warehouse.id,
            name: warehouse.name
        }));
        return [...base, ...rows];
    });

    readonly summary = computed(() => {
        const reports = this.reports();
        return {
            totalSessions: reports.length,
            openSessions: reports.filter((report) => !report.closed).length,
            closedSessions: reports.filter((report) => report.closed).length,
            totalAmount: reports.reduce((sum, report) => sum + Number(report.totals.amount || 0), 0)
        };
    });

    readonly summaryTotalsByCurrency = computed(() => {
        const totals = new Map<string, number>();

        for (const report of this.reports()) {
            if (report.lines.length > 0) {
                for (const line of report.lines) {
                    const currency = this.normalizeCurrencyCode(line.currency || this.getReportDisplayCurrency(report));
                    const amount = this.roundMoney(line.amount);
                    totals.set(currency, this.roundMoney((totals.get(currency) || 0) + amount));
                }
                continue;
            }

            const currency = this.getReportDisplayCurrency(report);
            const amount = this.roundMoney(report.totals.amount);
            totals.set(currency, this.roundMoney((totals.get(currency) || 0) + amount));
        }

        const priority = new Map<string, number>([
            ['CUP', 0],
            ['USD', 1]
        ]);

        return Array.from(totals.entries())
            .map(([currency, amount]) => ({ currency, amount: this.roundMoney(amount) }))
            .sort((a, b) => {
                const leftPriority = priority.get(a.currency) ?? 99;
                const rightPriority = priority.get(b.currency) ?? 99;
                if (leftPriority !== rightPriority) return leftPriority - rightPriority;
                return a.currency.localeCompare(b.currency);
            });
    });

    private readonly amountFormatter = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    ngOnInit() {
        this.refreshData();
    }

    refreshData() {
        this.loading.set(true);
        forkJoin({
            sessions: this.cashSessionsService.findAll().pipe(catchError(() => of([] as CashSession[]))),
            warehouses: this.warehousesService.listWarehouses().pipe(catchError(() => of([] as Warehouse[]))),
        }).subscribe({
            next: ({ sessions, warehouses }) => {
                this.sessions.set(sessions);
                this.warehouses.set(warehouses);
                this.searchReports();
            },
            error: () => {
                this.sessions.set([]);
                this.warehouses.set([]);
                this.reports.set([]);
                this.searchExecuted.set(true);
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar las sesiones de TPV' });
            }
        });
    }

    searchReports() {
        if (!this.validateDateRange()) return;

        this.searchExecuted.set(true);
        this.loading.set(true);

        const candidates = this.filterSessions(this.sessions());
        if (candidates.length === 0) {
            this.reports.set([]);
            this.loading.set(false);
            return;
        }

        const requests = candidates.map((session) =>
            this.ipvService.getSessionIpv(session.id).pipe(catchError(() => of(null)))
        );

        forkJoin(requests).subscribe({
            next: (responses) => {
                const reports = responses.filter((report): report is SessionIvpReport => !!report);
                reports.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
                this.reports.set(reports);
                this.loading.set(false);
            },
            error: () => {
                this.reports.set([]);
                this.loading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron consultar los IPV por sesión' });
            }
        });
    }

    clearFilters() {
        this.selectedStatus = 'ALL';
        this.selectedWarehouseId = null;
        this.sessionQuery = '';
        this.keyword = '';
        this.startDate = null;
        this.endDate = null;
        this.searchReports();
    }

    setQuickRange(days: number) {
        const end = new Date();
        const start = this.shiftDate(end, -(days - 1));
        this.startDate = start;
        this.endDate = end;
    }

    viewReport(report: SessionIvpReport) {
        this.selectedReport.set(report);
        this.selectedReportCurrency.set((report.lines[0]?.currency || 'CUP') as string);
        this.loadSelectedReportPaymentRows(report);
        this.showDetail = true;
    }

    canDeleteIpvReports() {
        return this.authService.hasPermission('inventory-reports.delete');
    }

    deleteReport(report: SessionIvpReport) {
        if (!this.canDeleteIpvReports()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Sin permisos',
                detail: 'No tiene permisos para eliminar reportes IPV.'
            });
            return;
        }

        this.confirmationService.confirm({
            header: 'Eliminar IPV',
            icon: 'pi pi-exclamation-triangle',
            message: 'Se eliminará el reporte IPV de la sesión seleccionada. ¿Desea continuar?',
            acceptLabel: 'Eliminar',
            rejectLabel: 'Cancelar',
            acceptButtonStyleClass: 'p-button-danger',
            rejectButtonStyleClass: 'p-button-outlined p-button-secondary',
            accept: () => {
                this.ipvService.deleteSessionReport(report.cashSessionId).subscribe({
                    next: () => {
                        this.reports.update((rows) => rows.filter((row) => row.cashSessionId !== report.cashSessionId));
                        if (this.selectedReport()?.cashSessionId === report.cashSessionId) {
                            this.selectedReport.set(null);
                            this.showDetail = false;
                        }
                        this.messageService.add({
                            severity: 'success',
                            summary: 'IPV eliminado',
                            detail: 'El reporte IPV fue eliminado correctamente.'
                        });
                    },
                    error: (err) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: err?.error?.message || 'No se pudo eliminar el IPV.'
                        });
                    }
                });
            }
        });
    }

    refreshSelectedReport() {
        const current = this.selectedReport();
        if (!current) return;

        this.detailLoading.set(true);
        this.ipvService.getSessionIpv(current.cashSessionId).subscribe({
            next: (report) => {
                this.selectedReport.set(report);
                this.reports.update((rows) => rows.map((row) => (row.cashSessionId === report.cashSessionId ? report : row)));
                this.selectedReportCurrency.set((report.lines[0]?.currency || 'CUP') as string);
                this.loadSelectedReportPaymentRows(report);
                this.detailLoading.set(false);
            },
            error: () => {
                this.detailLoading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el detalle del IPV' });
            }
        });
    }

    getReportDisplayCurrency(report: SessionIvpReport): string {
        const lineCurrency = report.lines.find((line) => !!line.currency)?.currency;
        return this.normalizeCurrencyCode(lineCurrency || 'CUP');
    }

    summaryCurrencyLabel(): string {
        const totals = this.summaryTotalsByCurrency();
        if (totals.length === 0) return 'CUP';
        if (totals.length === 1) return totals[0].currency;
        return 'VARIOS';
    }

    formatMoney(value: unknown, currencyInput?: string | null): string {
        const amount = this.roundMoney(value);
        const currency = this.normalizeCurrencyCode(currencyInput || 'CUP');
        const amountText = this.amountFormatter.format(amount);
        return `${currency} ${amountText}`;
    }

    getSessionResponsibleLabel(report: SessionIvpReport): string {
        const session = this.sessions().find((row) => row.id === report.cashSessionId);
        const employee = session?.openedBy?.employee;
        if (employee) {
            const name = `${employee.firstName || ''} ${employee.lastName || ''}`.trim();
            if (name) return name;
        }
        const openedByUser = session?.openedBy?.email?.trim();
        if (openedByUser) return openedByUser;
        const currentUser = this.authService.getUser();
        return currentUser?.email || 'Usuario no disponible';
    }

    exportSelectedReportAsPdf() {
        const report = this.selectedReport();
        if (!report) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay reporte IPV para exportar' });
            return;
        }

        const employeeLabel = this.getSessionResponsibleLabel(report);
        this.settingsService
            .getRegisterSettings(report.register.id)
            .pipe(catchError(() => of(null)))
            .subscribe({
                next: (settings) => {
                    const paymentRows = this.buildSessionIpvPaymentSummaryRowsFromReport(report, settings?.paymentMethods || null);
                    const pdfBlob = this.buildSessionIpvProfessionalPdfBlob(report, paymentRows, employeeLabel);
                    this.downloadBlob(
                        pdfBlob,
                        `ipv-${report.register.code || 'tpv'}-${this.formatFileDate(new Date())}.pdf`
                    );
                },
                error: () => {
                    const paymentRows = this.buildSessionIpvPaymentSummaryRowsFromReport(report, null);
                    const pdfBlob = this.buildSessionIpvProfessionalPdfBlob(report, paymentRows, employeeLabel);
                    this.downloadBlob(
                        pdfBlob,
                        `ipv-${report.register.code || 'tpv'}-${this.formatFileDate(new Date())}.pdf`
                    );
                }
            });
    }

    private loadSelectedReportPaymentRows(report: SessionIvpReport) {
        this.settingsService
            .getRegisterSettings(report.register.id)
            .pipe(catchError(() => of(null)))
            .subscribe({
                next: (settings) => {
                    const rows = this.buildSessionIpvPaymentSummaryRowsFromReport(report, settings?.paymentMethods || null);
                    this.selectedReportPaymentRows.set(rows);
                    this.selectedReportCurrency.set(
                        (settings?.currency || report.lines[0]?.currency || 'CUP') as string
                    );
                },
                error: () => {
                    const rows = this.buildSessionIpvPaymentSummaryRowsFromReport(report, null);
                    this.selectedReportPaymentRows.set(rows);
                    this.selectedReportCurrency.set((report.lines[0]?.currency || 'CUP') as string);
                }
            });
    }

    private buildSessionIpvPaymentSummaryRowsFromReport(
        report: SessionIvpReport,
        paymentMethods: Array<{ code: string; name: string; enabled: boolean }> | null
    ) {
        const configuredMethods =
            paymentMethods
                ?.filter((method) => method.enabled)
                .map((method) => ({
                    label: method.name,
                    value: method.code as 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'
                }))
                .filter((row) => ['CASH', 'CARD', 'TRANSFER', 'OTHER'].includes(row.value)) || [];

        const fallbackMethods: Array<{ label: string; value: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER' }> = this.paymentMethodCatalog
            .filter((item) => item.defaultEnabled)
            .map(({ label, value }) => ({ label, value }));

        const methods = configuredMethods.length > 0 ? configuredMethods : fallbackMethods;
        return methods.map((method) => ({
            code: method.value,
            label: method.label,
            amount: Number(report.paymentTotals?.[method.value] || 0)
        }));
    }

    private buildSessionIpvProfessionalPdfBlob(
        report: SessionIvpReport,
        paymentRows: Array<{ code: string; label: string; amount: number }>,
        employeeLabel: string
    ): Blob {
        const pages: string[] = [];
        let rowIndex = 0;
        let forceTotalsPage = false;

        while (rowIndex < report.lines.length || forceTotalsPage || pages.length === 0) {
            const page = this.buildSessionIpvProfessionalPdfPage({
                report,
                paymentRows,
                employeeLabel,
                rowIndex,
                pageNumber: pages.length + 1,
                isFirstPage: pages.length === 0,
                forceTotalsPage
            });

            pages.push(page.content);
            rowIndex = page.nextRowIndex;
            forceTotalsPage = !page.totalsDrawn && rowIndex >= report.lines.length;

            if (forceTotalsPage && page.rowsDrawn === 0) {
                forceTotalsPage = false;
            }
        }

        return this.buildPdfFromContentPages(pages);
    }

    private buildSessionIpvProfessionalPdfPage(params: {
        report: SessionIvpReport;
        paymentRows: Array<{ code: string; label: string; amount: number }>;
        employeeLabel: string;
        rowIndex: number;
        pageNumber: number;
        isFirstPage: boolean;
        forceTotalsPage: boolean;
    }): { content: string; nextRowIndex: number; totalsDrawn: boolean; rowsDrawn: number } {
        const { report, paymentRows, employeeLabel, rowIndex, pageNumber, isFirstPage, forceTotalsPage } = params;

        const pageWidth = 595;
        const pageHeight = 842;
        const marginX = 24;
        const headerTop = 24;
        const contentWidth = pageWidth - marginX * 2;
        const footerTop = 808;
        const tableHeaderHeight = 18;
        const tableRowHeight = 16;
        const tableMaxTop = 780;

        const columns: Array<{ key: string; label: string; width: number; align: 'left' | 'right' }> = [
            { key: 'name', label: 'Producto', width: 150, align: 'left' },
            { key: 'codigo', label: 'Cod', width: 55, align: 'left' },
            { key: 'initial', label: 'Ini', width: 32, align: 'right' },
            { key: 'entries', label: 'Ent', width: 32, align: 'right' },
            { key: 'outs', label: 'Sal', width: 32, align: 'right' },
            { key: 'sales', label: 'Ven', width: 32, align: 'right' },
            { key: 'total', label: 'Tot', width: 32, align: 'right' },
            { key: 'final', label: 'Fin', width: 32, align: 'right' },
            { key: 'price', label: 'Precio', width: 65, align: 'right' },
            { key: 'amount', label: 'Importe', width: 85, align: 'right' }
        ];

        const ops: string[] = [];
        const generatedAt = this.formatDateTime(new Date().toISOString());

        const toPdfY = (top: number) => pageHeight - top;
        const color = (rgb: [number, number, number]) => rgb.map((v) => (v / 255).toFixed(3)).join(' ');
        const safeText = (value: string) => this.escapePdfText(this.toAscii(value));

        const drawRect = (
            x: number,
            top: number,
            width: number,
            height: number,
            fill?: [number, number, number],
            stroke?: [number, number, number]
        ) => {
            const y = pageHeight - top - height;
            if (fill) ops.push(`${color(fill)} rg`);
            if (stroke) ops.push(`${color(stroke)} RG`);
            ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
        };

        const drawLine = (x1: number, top1: number, x2: number, top2: number, stroke: [number, number, number], lineWidth = 1) => {
            ops.push(`${lineWidth.toFixed(2)} w`);
            ops.push(`${color(stroke)} RG`);
            ops.push(`${x1.toFixed(2)} ${toPdfY(top1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(top2).toFixed(2)} l S`);
        };

        const drawText = (
            value: string,
            x: number,
            topBaseline: number,
            options?: { font?: 'F1' | 'F2'; size?: number; color?: [number, number, number]; align?: 'left' | 'right'; maxChars?: number }
        ) => {
            const font = options?.font || 'F1';
            const size = options?.size || 10;
            const textColor: [number, number, number] = options?.color || [33, 37, 41];
            const align = options?.align || 'left';
            const maxChars = options?.maxChars || 200;
            const raw = value || '';
            const fitted = raw.length <= maxChars ? raw : `${raw.slice(0, Math.max(0, maxChars - 3))}...`;
            const safe = safeText(fitted);
            const estimateWidth = safe.length * (size * (font === 'F2' ? 0.54 : 0.5));
            const textX = align === 'right' ? x - estimateWidth : x;

            ops.push('BT');
            ops.push(`/${font} ${size} Tf`);
            ops.push(`${color(textColor)} rg`);
            ops.push(`${textX.toFixed(2)} ${toPdfY(topBaseline).toFixed(2)} Td`);
            ops.push(`(${safe}) Tj`);
            ops.push('ET');
        };

        drawRect(marginX, headerTop, contentWidth, 42, [16, 38, 84], [16, 38, 84]);
        drawText('REPORTE IPV DE SESION', marginX + 12, headerTop + 26, { font: 'F2', size: 15, color: [255, 255, 255] });
        drawText(`Generado: ${generatedAt}`, pageWidth - marginX - 12, headerTop + 26, { size: 9, color: [235, 241, 255], align: 'right' });
        drawText(`Pagina ${pageNumber}`, pageWidth - marginX - 12, headerTop + 38, { size: 8, color: [208, 221, 255], align: 'right' });

        let topCursor = headerTop + 54;

        if (isFirstPage) {
            drawRect(marginX, topCursor, contentWidth, 72, [245, 248, 252], [214, 221, 229]);
            drawText(`TPV: ${report.register.name} (${report.register.code})`, marginX + 12, topCursor + 20, { font: 'F2', size: 10 });
            drawText(`Apertura: ${this.formatDateTime(report.openedAt)}`, marginX + 12, topCursor + 34, { size: 10, color: [68, 84, 106] });
            drawText(`Almacen: ${report.warehouse.name} (${report.warehouse.code})`, marginX + 12, topCursor + 48, { size: 10, color: [68, 84, 106] });
            drawText(`Empleado: ${employeeLabel}`, marginX + 12, topCursor + 62, { size: 10, color: [68, 84, 106] });
            topCursor += 86;

            drawText('Resumen Ejecutivo', marginX, topCursor + 12, { font: 'F2', size: 11, color: [27, 44, 94] });
            topCursor += 20;

            const summaryRows = [
                { label: 'Total de ventas', value: report.totals.sales.toString() },
                { label: 'Total de entradas', value: report.totals.entries.toString() },
                { label: 'Total de salidas', value: report.totals.outs.toString() },
                ...paymentRows.map((row) => ({ label: `Total ${row.label.toLowerCase()}`, value: this.roundMoney(row.amount).toFixed(2) })),
                { label: 'Importe total', value: this.roundMoney(report.totals.amount).toFixed(2) }
            ];

            const boxWidth = (contentWidth - 16) / 2;
            const lineHeight = 14;
            const perBox = Math.ceil(summaryRows.length / 2);
            const boxHeight = perBox * lineHeight + 16;

            drawRect(marginX, topCursor, boxWidth, boxHeight, [251, 253, 255], [214, 221, 229]);
            drawRect(marginX + boxWidth + 16, topCursor, boxWidth, boxHeight, [251, 253, 255], [214, 221, 229]);

            for (let i = 0; i < summaryRows.length; i++) {
                const row = summaryRows[i];
                const isRight = i >= perBox;
                const localIndex = isRight ? i - perBox : i;
                const rowTop = topCursor + 16 + localIndex * lineHeight;
                const xBase = isRight ? marginX + boxWidth + 16 : marginX;
                drawText(row.label, xBase + 10, rowTop, { size: 9, color: [66, 82, 102], maxChars: 28 });
                drawText(row.value, xBase + boxWidth - 10, rowTop, { font: 'F2', size: 9, align: 'right' });
            }

            topCursor += boxHeight + 22;
        } else {
            drawRect(marginX, topCursor, contentWidth, 46, [247, 250, 254], [220, 228, 236]);
            drawText(`TPV: ${report.register.name}`, marginX + 12, topCursor + 16, { font: 'F2', size: 9 });
            drawText(`Apertura: ${this.formatDateTime(report.openedAt)}`, marginX + 12, topCursor + 28, { size: 9, color: [68, 84, 106] });
            drawText(`Empleado: ${employeeLabel}`, marginX + 12, topCursor + 40, { size: 9, color: [68, 84, 106] });
            topCursor += 58;
        }

        const tableTop = Math.max(topCursor, 164);
        let rowTop = tableTop;
        drawRect(marginX, rowTop, contentWidth, tableHeaderHeight, [228, 236, 248], [160, 177, 204]);

        let columnX = marginX;
        for (const column of columns) {
            const textX = column.align === 'right' ? columnX + column.width - 6 : columnX + 6;
            drawText(column.label, textX, rowTop + 12, {
                font: 'F2',
                size: 8,
                color: [30, 54, 96],
                align: column.align,
                maxChars: column.key === 'name' ? 18 : 12
            });
            drawLine(columnX, rowTop, columnX, rowTop + tableHeaderHeight, [160, 177, 204], 0.6);
            columnX += column.width;
        }
        drawLine(marginX + contentWidth, rowTop, marginX + contentWidth, rowTop + tableHeaderHeight, [160, 177, 204], 0.6);

        rowTop += tableHeaderHeight;

        let currentIndex = rowIndex;
        let rowsDrawn = 0;
        while (currentIndex < report.lines.length && rowTop + tableRowHeight <= tableMaxTop) {
            const line = report.lines[currentIndex];
            if (rowsDrawn % 2 === 0) {
                drawRect(marginX, rowTop, contentWidth, tableRowHeight, [250, 252, 255], [230, 235, 242]);
            } else {
                drawRect(marginX, rowTop, contentWidth, tableRowHeight, [255, 255, 255], [230, 235, 242]);
            }

            const rowValues: Record<string, string> = {
                name: line.name || '-',
                codigo: line.codigo || '-',
                initial: `${line.initial}`,
                entries: `${line.entries}`,
                outs: `${line.outs}`,
                sales: `${line.sales}`,
                total: `${line.total}`,
                final: `${line.final}`,
                price: this.roundMoney(line.price).toFixed(2),
                amount: this.roundMoney(line.amount).toFixed(2)
            };

            let x = marginX;
            for (const column of columns) {
                const maxChars = column.key === 'name' ? 30 : column.key === 'codigo' ? 12 : 10;
                const textX = column.align === 'right' ? x + column.width - 6 : x + 6;
                drawText(rowValues[column.key], textX, rowTop + 11, {
                    size: 8.2,
                    align: column.align,
                    maxChars
                });
                drawLine(x, rowTop, x, rowTop + tableRowHeight, [230, 235, 242], 0.5);
                x += column.width;
            }
            drawLine(marginX + contentWidth, rowTop, marginX + contentWidth, rowTop + tableRowHeight, [230, 235, 242], 0.5);

            rowTop += tableRowHeight;
            currentIndex += 1;
            rowsDrawn += 1;
        }

        let totalsDrawn = false;
        if ((currentIndex >= report.lines.length || forceTotalsPage) && rowTop + tableRowHeight <= tableMaxTop) {
            drawRect(marginX, rowTop, contentWidth, tableRowHeight, [226, 244, 235], [146, 178, 163]);
            drawText('TOTAL IMPORTE', marginX + contentWidth - 140, rowTop + 11, { font: 'F2', size: 8.6, align: 'right' });
            drawText(this.roundMoney(report.totals.amount).toFixed(2), marginX + contentWidth - 6, rowTop + 11, {
                font: 'F2',
                size: 8.6,
                align: 'right'
            });
            totalsDrawn = true;
        }

        drawLine(marginX, footerTop - 10, pageWidth - marginX, footerTop - 10, [208, 216, 228], 0.7);
        drawText(
            `Reporte IPV | ${report.register.code} | Sesion ${report.cashSessionId.slice(0, 8)} | Estado ${report.status}`,
            marginX,
            footerTop + 4,
            { size: 8, color: [93, 109, 130], maxChars: 95 }
        );
        drawText(`Pagina ${pageNumber}`, pageWidth - marginX, footerTop + 4, { size: 8, color: [93, 109, 130], align: 'right' });

        return {
            content: ops.join('\n'),
            nextRowIndex: currentIndex,
            totalsDrawn,
            rowsDrawn
        };
    }

    private buildPdfFromContentPages(contentPages: string[]): Blob {
        const pages = contentPages.length > 0 ? contentPages : [''];
        const objects: string[] = [];
        const pageIds: number[] = [];
        const contentIds: number[] = [];
        let objectId = 5;

        for (let index = 0; index < pages.length; index++) {
            pageIds.push(objectId++);
            contentIds.push(objectId++);
        }

        objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
        objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

        for (let index = 0; index < pages.length; index++) {
            const content = pages[index] || '';
            const pageId = pageIds[index];
            const contentId = contentIds[index];
            objects[pageId] =
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
                `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
            objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
        }

        let pdf = '%PDF-1.4\n';
        const offsets: number[] = [0];

        for (let i = 1; i < objects.length; i++) {
            if (!objects[i]) continue;
            offsets[i] = pdf.length;
            pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
        }

        const xrefStart = pdf.length;
        pdf += `xref\n0 ${objects.length}\n`;
        pdf += '0000000000 65535 f \n';

        for (let i = 1; i < objects.length; i++) {
            const offset = offsets[i] || 0;
            pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
        }

        pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    }

    private downloadBlob(blob: Blob, fileName: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }

    private escapePdfText(value: string): string {
        return value
            .replaceAll('\\', '\\\\')
            .replaceAll('(', '\\(')
            .replaceAll(')', '\\)');
    }

    private toAscii(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7e]/g, '');
    }

    private formatDateTime(value: string | null | undefined): string {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';

        const formatter = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        return formatter.format(date);
    }

    private formatFileDate(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        const hours = `${date.getHours()}`.padStart(2, '0');
        const minutes = `${date.getMinutes()}`.padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    private roundMoney(value: unknown): number {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric)) return 0;
        return Number(numeric.toFixed(2));
    }

    private normalizeCurrencyCode(currencyInput?: string | null): string {
        const raw = String(currencyInput || 'CUP').trim().toUpperCase();
        if (raw === 'USD') return 'USD';
        if (raw === 'CUP') return 'CUP';
        if (raw === 'VARIOS') return 'VARIOS';
        return 'CUP';
    }

    private filterSessions(sessions: CashSession[]): CashSession[] {
        const sessionSearch = this.sessionQuery.trim().toLowerCase();
        const keywordSearch = this.keyword.trim().toLowerCase();
        const start = this.startDate ? this.getStartOfDay(this.startDate) : null;
        const end = this.endDate ? this.getEndOfDay(this.endDate) : null;

        const warehousesMap = new Map(this.warehouses().map((warehouse) => [warehouse.id, warehouse.name]));

        return sessions.filter((session) => {
            if (this.selectedStatus !== 'ALL' && session.status !== this.selectedStatus) return false;
            if (this.selectedWarehouseId && session.warehouseId !== this.selectedWarehouseId) return false;
            if (sessionSearch && !session.id.toLowerCase().includes(sessionSearch)) return false;

            if (keywordSearch) {
                const warehouseName = session.warehouseId ? warehousesMap.get(session.warehouseId) || '' : '';
                const haystack = [
                    session.id,
                    session.register?.name || '',
                    warehouseName,
                ].join(' ').toLowerCase();
                if (!haystack.includes(keywordSearch)) return false;
            }

            const openedAt = new Date(session.openedAt).getTime();
            if (Number.isNaN(openedAt)) return false;
            if (start && openedAt < start.getTime()) return false;
            if (end && openedAt > end.getTime()) return false;
            return true;
        });
    }

    private validateDateRange(): boolean {
        if (!this.startDate || !this.endDate) return true;

        const start = this.getStartOfDay(this.startDate);
        const end = this.getEndOfDay(this.endDate);
        if (start.getTime() > end.getTime()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Rango inválido',
                detail: 'La fecha "desde" no puede ser mayor que la fecha "hasta".'
            });
            return false;
        }

        const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
        if (diffDays > 366) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Rango demasiado grande',
                detail: 'Use un rango de máximo 366 días para una consulta más rápida y segura.'
            });
            return false;
        }

        return true;
    }

    private shiftDate(baseDate: Date, dayOffset: number): Date {
        const value = new Date(baseDate);
        value.setHours(0, 0, 0, 0);
        value.setDate(value.getDate() + dayOffset);
        return value;
    }

    private getStartOfDay(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    }

    private getEndOfDay(date: Date): Date {
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    }
}
