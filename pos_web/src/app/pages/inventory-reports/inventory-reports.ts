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
                        <div class="text-2xl font-bold mt-1">{{ summary().totalAmount | currency }}</div>
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
                                <td class="text-right font-semibold">{{ report.totals.amount | currency }}</td>
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
                        </div>
                        <div class="tpv-ipv-toolbar-actions">
                            <p-button icon="pi pi-refresh" label="Actualizar" severity="secondary" [outlined]="true" (onClick)="refreshSelectedReport()" />
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
                        <div class="tpv-ipv-summary-item">
                            <span>Total efectivo</span>
                            <strong>{{ selectedReport()!.paymentTotals.CASH | currency }}</strong>
                        </div>
                        <div class="tpv-ipv-summary-item">
                            <span>Total tarjeta</span>
                            <strong>{{ selectedReport()!.paymentTotals.CARD | currency }}</strong>
                        </div>
                        <div class="tpv-ipv-summary-item">
                            <span>Total transferencia</span>
                            <strong>{{ selectedReport()!.paymentTotals.TRANSFER | currency }}</strong>
                        </div>
                        <div class="tpv-ipv-summary-item">
                            <span>Total otros</span>
                            <strong>{{ selectedReport()!.paymentTotals.OTHER | currency }}</strong>
                        </div>
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
                                            <td class="text-right">{{ line.price | currency }}</td>
                                            <td class="text-right font-semibold">{{ line.amount | currency }}</td>
                                        </tr>
                                    }
                                }
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="8" class="text-right">Total Importe</td>
                                    <td class="text-right">{{ selectedReport()!.totals.amount | currency }}</td>
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
                this.detailLoading.set(false);
            },
            error: () => {
                this.detailLoading.set(false);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el detalle del IPV' });
            }
        });
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
