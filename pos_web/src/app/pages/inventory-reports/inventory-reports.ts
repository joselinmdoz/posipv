import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker';
import { TableModule } from 'primeng/table';
import { CardModule } from 'primeng/card';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InventoryReportsService, InventoryReport } from '@/app/core/services/inventory-reports.service';
import { WarehousesService } from '@/app/core/services/warehouses.service';
import { CashSessionsService, CashSession } from '@/app/core/services/cash-sessions.service';

@Component({
    selector: 'app-inventory-reports',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        DatePickerModule,
        TableModule,
        CardModule,
        ToastModule,
        SelectModule,
        TagModule,
        DialogModule
    ],
    providers: [MessageService],
    template: `
        <div class="p-4">
            <h1 class="text-2xl font-bold mb-4">Informes de Inventario (IPV)</h1>
            <p-toast />

            <!-- Sección de IPV por Sesión -->
            <p-card class="mb-4">
                <ng-template pTemplate="header">
                    <div class="p-3 bg-primary text-white font-bold">
                        IPV por Sesión de Caja
                    </div>
                </ng-template>
                
                <div class="flex gap-4 items-end flex-wrap mb-4">
                    <div class="flex-1 min-w-64">
                        <label class="block mb-2">Sesión de Caja</label>
                        <p-select 
                            [(ngModel)]="selectedSession" 
                            [options]="sessions()"
                            optionLabel="id"
                            placeholder="Seleccionar sesión"
                            styleClass="w-full"
                            [filter]="true"
                        >
                            <ng-template let-session pTemplate="item">
                                <div>{{ session.id.substring(0, 8) }} - {{ session.status }} ({{ session.openedAt | date:'short' }})</div>
                            </ng-template>
                        </p-select>
                    </div>
                </div>

                <div class="flex gap-2 mb-4">
                    <p-button 
                        label="Generar IPV Inicial" 
                        icon="pi pi-plus"
                        severity="success"
                        [disabled]="!selectedSession"
                        (onClick)="createInitial()"
                    />
                    <p-button 
                        label="Generar IPV Final" 
                        icon="pi pi-check"
                        severity="warn"
                        [disabled]="!selectedSession"
                        (onClick)="createFinal()"
                    />
                </div>

                @if (sessionReports().length > 0) {
                    <div class="mt-4">
                        <h3 class="text-lg font-semibold mb-2">Informes de esta Sesión</h3>
                        <p-table [value]="sessionReports()" styleClass="p-datatable-sm">
                            <ng-template pTemplate="header">
                                <tr>
                                    <th>Tipo</th>
                                    <th>Fecha</th>
                                    <th>Total Valor</th>
                                    <th>Almacén</th>
                                    <th>Acciones</th>
                                </tr>
                            </ng-template>
                            <ng-template let-report pTemplate="body">
                                <tr>
                                    <td>
                                        <p-tag 
                                            [value]="report.type === 'INITIAL' ? 'Inicial' : 'Final'" 
                                            [severity]="report.type === 'INITIAL' ? 'success' : 'warn'"
                                        />
                                    </td>
                                    <td>{{ report.createdAt | date:'short' }}</td>
                                    <td>{{ report.totalValue | currency }}</td>
                                    <td>{{ report.warehouse.name }}</td>
                                    <td>
                                        <p-button 
                                            icon="pi pi-eye" 
                                            [rounded]="true" 
                                            [text]="true"
                                            (onClick)="viewReport(report)"
                                        />
                                    </td>
                                </tr>
                            </ng-template>
                        </p-table>
                    </div>
                }
            </p-card>

            <!-- Sección de IPV por Almacén -->
            <p-card>
                <ng-template pTemplate="header">
                    <div class="p-3 bg-primary text-white font-bold">
                        IPV por Almacén
                    </div>
                </ng-template>
                
                <div class="flex gap-4 items-end flex-wrap mb-4">
                    <div class="flex-1 min-w-64">
                        <label class="block mb-2">Almacén</label>
                        <p-select 
                            [(ngModel)]="selectedWarehouse" 
                            [options]="warehouses()"
                            optionLabel="name"
                            placeholder="Seleccionar almacén"
                            styleClass="w-full"
                            [filter]="true"
                        />
                    </div>
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
                        label="Buscar" 
                        icon="pi pi-search" 
                        (onClick)="searchByWarehouse()"
                        [disabled]="!selectedWarehouse"
                    />
                </div>

                @if (warehouseReports().length > 0) {
                    <p-table [value]="warehouseReports()" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Tipo</th>
                                <th>Fecha</th>
                                <th>Total Valor</th>
                                <th>Sesión</th>
                                <th>Acciones</th>
                            </tr>
                        </ng-template>
                        <ng-template let-report pTemplate="body">
                            <tr>
                                <td>
                                    <p-tag 
                                        [value]="report.type === 'INITIAL' ? 'Inicial' : 'Final'" 
                                        [severity]="report.type === 'INITIAL' ? 'success' : 'warn'"
                                    />
                                </td>
                                <td>{{ report.createdAt | date:'short' }}</td>
                                <td>{{ report.totalValue | currency }}</td>
                                <td>{{ report.cashSessionId.substring(0, 8) }}</td>
                                <td>
                                    <p-button 
                                        icon="pi pi-eye" 
                                        [rounded]="true" 
                                        [text]="true"
                                        (onClick)="viewReport(report)"
                                    />
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>
                }
            </p-card>

            <!-- Modal de Detalle del IPV -->
            @if (selectedReport()) {
                <p-dialog 
                    [(visible)]="showDetail" 
                    [header]="'Detalle IPV - ' + (selectedReport()?.type === 'INITIAL' ? 'Inicial' : 'Final')"
                    [modal]="true"
                    [style]="{width: '80vw'}"
                >
                    <div class="mb-4">
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <strong>Fecha:</strong> {{ selectedReport()?.createdAt | date:'short' }}
                            </div>
                            <div>
                                <strong>Almacén:</strong> {{ selectedReport()?.warehouse?.name }}
                            </div>
                            <div>
                                <strong>Valor Total:</strong> {{ selectedReport()?.totalValue | currency }}
                            </div>
                        </div>
                    </div>

                    <p-table [value]="selectedReport()?.items || []" styleClass="p-datatable-sm">
                        <ng-template pTemplate="header">
                            <tr>
                                <th>Producto</th>
                                <th>SKU</th>
                                <th>Cantidad</th>
                                <th>Precio</th>
                                <th>Importe</th>
                            </tr>
                        </ng-template>
                        <ng-template let-item pTemplate="body">
                            <tr>
                                <td>{{ item.product.name }}</td>
                                <td>{{ item.product.sku || '-' }}</td>
                                <td>{{ item.qty }}</td>
                                <td>{{ item.price | currency }}</td>
                                <td>{{ item.total | currency }}</td>
                            </tr>
                        </ng-template>
                        <ng-template pTemplate="footer">
                            <tr>
                                <td colspan="4" class="text-right font-bold">Total:</td>
                                <td class="font-bold">{{ selectedReport()?.totalValue | currency }}</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </p-dialog>
            }
        </div>
    `
})
export class InventoryReportsComponent implements OnInit {
    private ipvService = inject(InventoryReportsService);
    private warehousesService = inject(WarehousesService);
    private cashSessionsService = inject(CashSessionsService);
    private messageService = inject(MessageService);

    warehouses = signal<any[]>([]);
    sessions = signal<any[]>([]);
    sessionReports = signal<InventoryReport[]>([]);
    warehouseReports = signal<InventoryReport[]>([]);
    
    selectedSession: CashSession | null = null;
    selectedWarehouse: any = null;
    startDate: Date | null = null;
    endDate: Date | null = null;
    
    selectedReport = signal<InventoryReport | null>(null);
    showDetail = false;

    ngOnInit() {
        this.loadWarehouses();
        this.loadSessions();
    }

    loadWarehouses() {
        this.warehousesService.listWarehouses().subscribe({
            next: (data) => this.warehouses.set(data),
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar almacenes' })
        });
    }

    loadSessions() {
        this.cashSessionsService.findAll().subscribe({
            next: (data) => this.sessions.set(data),
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar sesiones' })
        });
    }

    createInitial() {
        if (!this.selectedSession || !this.selectedSession.warehouseId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione una sesión con almacén asignado' });
            return;
        }

        this.ipvService.createInitial(this.selectedSession.id, this.selectedSession.warehouseId).subscribe({
            next: (report) => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'IPV Inicial generado correctamente' });
                this.sessionReports.update(reports => [report, ...reports]);
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al generar IPV Inicial' })
        });
    }

    createFinal() {
        if (!this.selectedSession || !this.selectedSession.warehouseId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione una sesión con almacén asignado' });
            return;
        }

        this.ipvService.createFinal(this.selectedSession.id, this.selectedSession.warehouseId).subscribe({
            next: (report) => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'IPV Final generado correctamente' });
                this.sessionReports.update(reports => [report, ...reports]);
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al generar IPV Final' })
        });
    }

    searchByWarehouse() {
        if (!this.selectedWarehouse) return;

        const startDateStr = this.startDate ? this.startDate.toISOString().split('T')[0] : undefined;
        const endDateStr = this.endDate ? this.endDate.toISOString().split('T')[0] : undefined;

        this.ipvService.findByWarehouse(this.selectedWarehouse.id, startDateStr, endDateStr).subscribe({
            next: (reports) => this.warehouseReports.set(reports),
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al buscar informes' })
        });
    }

    viewReport(report: InventoryReport) {
        this.selectedReport.set(report);
        this.showDetail = true;
    }
}
