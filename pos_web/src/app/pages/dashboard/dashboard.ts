import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { forkJoin, map, switchMap } from 'rxjs';
import { DashboardService } from '@/app/core/services/dashboard.service';
import { ReportsService, SalesReport } from '@/app/core/services/reports.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, ButtonModule, TableModule, TagModule],
    template: `
        <div class="flex items-center justify-between mb-6">
            <div>
                <h1 class="text-2xl font-bold m-0">Dashboard</h1>
                <p class="text-sm text-color-secondary mt-1 mb-0">
                    Información real desde base de datos.
                    @if (serverNowLabel()) {
                        <span>Servidor: {{ serverNowLabel() }}</span>
                    }
                </p>
            </div>
            <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" [loading]="loading()" (onClick)="loadDashboard()" />
        </div>

        <div class="grid grid-cols-12 gap-6">
            <div class="col-span-12 lg:col-span-6 xl:col-span-3">
                <div class="card mb-0">
                    <div class="text-sm text-color-secondary">Ventas hoy</div>
                    <div class="text-2xl font-semibold mt-2">{{ summary()?.salesToday || 0 | currency }}</div>
                </div>
            </div>
            <div class="col-span-12 lg:col-span-6 xl:col-span-3">
                <div class="card mb-0">
                    <div class="text-sm text-color-secondary">Transacciones hoy</div>
                    <div class="text-2xl font-semibold mt-2">{{ summary()?.transactionsToday || 0 }}</div>
                </div>
            </div>
            <div class="col-span-12 lg:col-span-6 xl:col-span-3">
                <div class="card mb-0">
                    <div class="text-sm text-color-secondary">Sesiones abiertas</div>
                    <div class="text-2xl font-semibold mt-2">{{ summary()?.openSessions || 0 }}</div>
                </div>
            </div>
            <div class="col-span-12 lg:col-span-6 xl:col-span-3">
                <div class="card mb-0">
                    <div class="text-sm text-color-secondary">Stock bajo (<= 5)</div>
                    <div class="text-2xl font-semibold mt-2">{{ summary()?.lowStock || 0 }}</div>
                </div>
            </div>

            <div class="col-span-12 xl:col-span-7">
                <div class="card mb-0">
                    <div class="flex items-center justify-between mb-4">
                        <div class="font-semibold text-xl">Ventas recientes (30 días)</div>
                        <p-tag [value]="recentSales().length + ' registros'" severity="info" />
                    </div>

                    <p-table [value]="recentSales()" [loading]="loading()" [paginator]="true" [rows]="8" responsiveLayout="scroll">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Fecha</th>
                                <th>Cajero</th>
                                <th class="text-right">Total</th>
                                <th>Estado</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-sale>
                            <tr>
                                <td>{{ sale.createdAtServer || (sale.createdAt | date:'dd/MM/yyyy HH:mm') }}</td>
                                <td>{{ sale.cashier?.email || '-' }}</td>
                                <td class="text-right font-semibold">{{ sale.total | currency }}</td>
                                <td>
                                    <p-tag [value]="sale.status" [severity]="sale.status === 'PAID' ? 'success' : 'warn'" />
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="emptymessage">
                            <tr>
                                <td colspan="4">No hay ventas para mostrar.</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </div>

            <div class="col-span-12 xl:col-span-5">
                <div class="card mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <div class="font-semibold text-xl">Productos más vendidos (30 días)</div>
                        <p-tag [value]="topProducts().length + ' productos'" severity="success" />
                    </div>
                    <p-table [value]="topProducts()" [loading]="loading()" [paginator]="true" [rows]="8" responsiveLayout="scroll">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Producto</th>
                                <th class="text-right">Cantidad</th>
                                <th class="text-right">Importe</th>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="body" let-row>
                            <tr>
                                <td>
                                    <div class="font-medium">{{ row.name }}</div>
                                    <small class="text-color-secondary">{{ row.codigo || '-' }}</small>
                                </td>
                                <td class="text-right">{{ row.qty }}</td>
                                <td class="text-right font-semibold">{{ row.amount | currency }}</td>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="emptymessage">
                            <tr>
                                <td colspan="3">No hay productos vendidos en el período.</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>

                <div class="card mb-0">
                    <div class="font-semibold text-xl mb-4">Métodos de pago de hoy</div>
                    <div class="grid grid-cols-2 gap-3">
                        @for (item of paymentRows(); track item.method) {
                            <div class="p-3 rounded-lg border border-surface-200">
                                <div class="text-sm text-color-secondary">{{ getPaymentMethodLabel(item.method) }}</div>
                                <div class="text-lg font-semibold mt-1">{{ item.amount | currency }}</div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        </div>
    `
})
export class Dashboard implements OnInit {
    private readonly dashboardService = inject(DashboardService);
    private readonly reportsService = inject(ReportsService);

    readonly loading = signal<boolean>(false);
    readonly serverNowLabel = signal<string>('');
    readonly summary = signal<{
        salesToday: number;
        transactionsToday: number;
        openSessions: number;
        lowStock: number;
        lastSaleAt?: string | null;
    } | null>(null);
    readonly todayReport = signal<SalesReport | null>(null);
    readonly rangeReport = signal<SalesReport | null>(null);

    readonly recentSales = computed(() => {
        const report = this.rangeReport();
        if (!report) return [];
        return [...report.detailedSales]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 8);
    });

    readonly topProducts = computed(() => {
        const report = this.rangeReport();
        if (!report) return [] as Array<{ productId: string; name: string; codigo: string | null; qty: number; amount: number }>;

        const map = new Map<string, { productId: string; name: string; codigo: string | null; qty: number; amount: number }>();

        for (const sale of report.detailedSales) {
            for (const item of sale.items || []) {
                const current = map.get(item.productId) || {
                    productId: item.productId,
                    name: item.product?.name || `Producto ${item.productId.slice(0, 8)}`,
                    codigo: item.product?.codigo || null,
                    qty: 0,
                    amount: 0
                };

                const qty = Number(item.qty || 0);
                const price = Number(item.price || 0);
                current.qty += qty;
                current.amount = Number((current.amount + qty * price).toFixed(2));
                map.set(item.productId, current);
            }
        }

        return Array.from(map.values())
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 8);
    });

    readonly paymentRows = computed(() => {
        const report = this.todayReport();
        if (!report) return [] as Array<{ method: string; amount: number }>;
        return report.salesByPaymentMethod
            .map((item) => ({ method: item.method, amount: Number(item.amount || 0) }))
            .sort((a, b) => b.amount - a.amount);
    });

    ngOnInit() {
        this.loadDashboard();
    }

    loadDashboard() {
        this.loading.set(true);

        this.reportsService.getServerDateInfo()
            .pipe(
                switchMap((server) => {
                    const endDate = server.serverDate;
                    const startDate = this.shiftYmd(server.serverDate, -29);

                    return forkJoin({
                        summary: this.dashboardService.getSummary(),
                        todayReport: this.reportsService.getSalesReport(endDate, endDate),
                        rangeReport: this.reportsService.getSalesReport(startDate, endDate)
                    }).pipe(map((data) => ({ ...data, serverLabel: server })));
                })
            )
            .subscribe({
                next: ({ serverLabel, summary, todayReport, rangeReport }) => {
                    this.serverNowLabel.set(serverLabel.serverNowLabel || '');
                    this.summary.set(summary);
                    this.todayReport.set(todayReport);
                    this.rangeReport.set(rangeReport);
                    this.loading.set(false);
                },
                error: () => {
                    this.serverNowLabel.set('');
                    this.summary.set(null);
                    this.todayReport.set(null);
                    this.rangeReport.set(null);
                    this.loading.set(false);
                }
            });
    }

    getPaymentMethodLabel(method: string): string {
        const labels: Record<string, string> = {
            CASH: 'Efectivo',
            CARD: 'Tarjeta',
            TRANSFER: 'Transferencia',
            OTHER: 'Otro'
        };
        return labels[method] || method;
    }

    private shiftYmd(ymd: string, days: number): string {
        const [year, month, day] = ymd.split('-').map((n) => Number(n));
        const dt = new Date(year, month - 1, day);
        dt.setDate(dt.getDate() + days);
        const y = dt.getFullYear();
        const m = `${dt.getMonth() + 1}`.padStart(2, '0');
        const d = `${dt.getDate()}`.padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
}
