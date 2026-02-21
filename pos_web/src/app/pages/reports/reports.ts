import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ReportsService, SalesReport } from '@/app/core/services/reports.service';

@Component({
    selector: 'app-reports',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DatePickerModule,
        TableModule,
        CardModule,
        ToastModule
    ],
    providers: [MessageService],
    template: `
        <div class="p-4">
            <h1 class="text-2xl font-bold mb-4">Reportes de Ventas</h1>

            <!-- Filtros de fecha -->
            <p-card class="mb-4">
                <div class="flex gap-4 items-end flex-wrap">
                    <div class="flex-1 min-w-64">
                        <label class="block mb-2">Fecha desde</label>
                        <p-datepicker 
                            [(ngModel)]="startDate" 
                            dateFormat="yy-mm-dd"
                            [showIcon]="true"
                            styleClass="w-full"
                        />
                    </div>
                    <div class="flex-1 min-w-64">
                        <label class="block mb-2">Fecha hasta</label>
                        <p-datepicker 
                            [(ngModel)]="endDate" 
                            dateFormat="yy-mm-dd"
                            [showIcon]="true"
                            styleClass="w-full"
                        />
                    </div>
                    <p-button 
                        label="Generar Reporte" 
                        icon="pi pi-chart-bar" 
                        (onClick)="generateReport()"
                    />
                </div>
            </p-card>

            @if (report()) {
                <!-- Resumen -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <p-card>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-primary">{{ report()?.totalSales }}</div>
                            <div class="text-gray-500">Total de Ventas</div>
                        </div>
                    </p-card>
                    <p-card>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-green-600">{{ report()?.totalAmount | currency }}</div>
                            <div class="text-gray-500">Monto Total</div>
                        </div>
                    </p-card>
                    <p-card>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-blue-600">{{ report()?.averageTicket | currency }}</div>
                            <div class="text-gray-500">Ticket Promedio</div>
                        </div>
                    </p-card>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <!-- Ventas por método de pago -->
                    <p-card header="Ventas por Método de Pago">
                        <p-table [value]="report()?.salesByPaymentMethod || []">
                            <ng-template #header>
                                <tr>
                                    <th>Método</th>
                                    <th>Monto</th>
                                </tr>
                            </ng-template>
                            <ng-template #body let-item>
                                <tr>
                                    <td>{{ getPaymentMethodLabel(item.method) }}</td>
                                    <td>{{ item.amount | currency }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </p-card>

                    <!-- Ventas por cajero -->
                    <p-card header="Ventas por Cajero">
                        <p-table [value]="report()?.salesByCashier || []">
                            <ng-template #header>
                                <tr>
                                    <th>Cajero</th>
                                    <th>Ventas</th>
                                    <th>Monto</th>
                                </tr>
                            </ng-template>
                            <ng-template #body let-item>
                                <tr>
                                    <td>{{ item.name }}</td>
                                    <td>{{ item.sales }}</td>
                                    <td>{{ item.amount | currency }}</td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </p-card>
                </div>

                <!-- Detalle de ventas -->
                <p-card header="Detalle de Ventas">
                    <p-table [value]="report()?.detailedSales || []" [paginator]="true" [rows]="10">
                        <ng-template #header>
                            <tr>
                                <th>ID</th>
                                <th>Fecha</th>
                                <th>Cajero</th>
                                <th>Total</th>
                                <th>Estado</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-sale>
                            <tr>
                                <td>{{ sale.id.slice(0, 8) }}...</td>
                                <td>{{ sale.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                                <td>{{ sale.cashier?.email || 'N/A' }}</td>
                                <td>{{ sale.total | currency }}</td>
                                <td>
                                    <span [class]="sale.status === 'PAID' ? 'text-green-600' : 'text-red-600'">
                                        {{ sale.status }}
                                    </span>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr>
                                <td colspan="5" class="text-center">No hay ventas en el período seleccionado.</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </p-card>
            }
        </div>

        <p-toast />
    `
})
export class Reports implements OnInit {
    startDate: Date = new Date();
    endDate: Date = new Date();
    report = signal<SalesReport | null>(null);

    constructor(
        private reportsService: ReportsService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        // Set default to last 7 days
        this.startDate.setDate(this.startDate.getDate() - 7);
    }

    generateReport() {
        const startStr = this.formatDate(this.startDate);
        const endStr = this.formatDate(this.endDate);

        this.reportsService.getSalesReport(startStr, endStr).subscribe({
            next: (report) => this.report.set(report),
            error: () => this.messageService.add({ 
                severity: 'error', 
                summary: 'Error', 
                detail: 'Error al generar reporte' 
            })
        });
    }

    formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    getPaymentMethodLabel(method: string): string {
        const labels: Record<string, string> = {
            'CASH': 'Efectivo',
            'CARD': 'Tarjeta',
            'TRANSFER': 'Transferencia',
            'OTHER': 'Otro'
        };
        return labels[method] || method;
    }
}
