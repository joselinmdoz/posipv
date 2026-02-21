import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService, ConfirmationService } from 'primeng/api';
import { 
    WarehousesService, 
    Warehouse, 
    StockItem, 
    StockMovement 
} from '@/app/core/services/warehouses.service';

@Component({
    selector: 'app-warehouses',
    standalone: true,
    imports: [
        CommonModule,
        TableModule,
        FormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        InputTextModule,
        DialogModule,
        TagModule,
        SelectModule,
        InputNumberModule,
        ConfirmDialogModule,
        ToggleSwitchModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo Almacén" icon="pi pi-plus" severity="secondary" class="mr-2" (onClick)="openNewWarehouse()" />
                <p-button label="Nuevo Movimiento" icon="pi pi-arrow-right-arrow-left" severity="secondary" (onClick)="openNewMovement()" />
            </ng-template>
        </p-toolbar>

        <!-- Lista de Almacenes -->
        <div class="mb-4">
            <h2 class="text-xl font-semibold mb-4">Almacenes</h2>
            <p-table
                #dt
                [value]="warehouses()"
                [rows]="10"
                [paginator]="true"
                [globalFilterFields]="['name', 'code']"
                [tableStyle]="{ 'min-width': '50rem' }"
                [rowHover]="true"
                dataKey="id"
            >
                <ng-template #header>
                    <tr>
                        <th pSortableColumn="name">Nombre <p-sortIcon field="name" /></th>
                        <th pSortableColumn="code">Código <p-sortIcon field="code" /></th>
                        <th pSortableColumn="type">Tipo <p-sortIcon field="type" /></th>
                        <th pSortableColumn="active">Estado</th>
                        <th>Acciones</th>
                    </tr>
                </ng-template>
                <ng-template #body let-warehouse>
                    <tr>
                        <td>{{ warehouse.name }}</td>
                        <td>{{ warehouse.code }}</td>
                        <td>
                            <p-tag [value]="warehouse.type === 'CENTRAL' ? 'Central' : 'TPV'" 
                                   [severity]="warehouse.type === 'CENTRAL' ? 'info' : 'success'" />
                        </td>
                        <td>
                            <p-tag [value]="warehouse.active ? 'Activo' : 'Inactivo'" 
                                   [severity]="warehouse.active ? 'success' : 'warn'" />
                        </td>
                        <td>
                            <p-button icon="pi pi-eye" class="mr-2" [rounded]="true" [outlined]="true" severity="info" 
                                      (onClick)="viewStock(warehouse)" pTooltip="Ver stock" />
                            <p-button icon="pi pi-pencil" class="mr-2" [rounded]="true" [outlined]="true" severity="success" 
                                      (onClick)="editWarehouse(warehouse)" />
                            <p-button icon="pi pi-trash" [rounded]="true" [outlined]="true" severity="danger" 
                                      (onClick)="deleteWarehouse(warehouse)" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="5">No hay almacenes.</td></tr>
                </ng-template>
            </p-table>
        </div>

        <!-- Movimientos de Stock -->
        <div>
            <h2 class="text-xl font-semibold mb-4">Movimientos de Stock</h2>
            <div class="flex gap-4 mb-4">
                <p-select [options]="warehouseOptions" [(ngModel)]="selectedWarehouseFilter" 
                          placeholder="Todos los almacenes" (onChange)="loadMovements()" [showClear]="true" 
                          styleClass="w-64" />
            </div>
            
            <p-table [value]="movements()" [rows]="10" [paginator]="true" [tableStyle]="{ 'min-width': '50rem' }">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Origen</th>
                        <th>Destino</th>
                        <th>Motivo</th>
                    </tr>
                </ng-template>
                <ng-template #body let-movement>
                    <tr>
                        <td>{{ movement.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                        <td>
                            <p-tag [value]="getMovementTypeLabel(movement.type)" 
                                   [severity]="getMovementTypeSeverity(movement.type)" />
                        </td>
                        <td>{{ movement.product.name }}</td>
                        <td>{{ movement.qty }}</td>
                        <td>{{ movement.fromWarehouse?.name || '-' }}</td>
                        <td>{{ movement.toWarehouse?.name || '-' }}</td>
                        <td>{{ movement.reason || '-' }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="7">No hay movimientos de stock.</td></tr>
                </ng-template>
            </p-table>
        </div>

        <!-- Dialog para crear/editar almacén -->
        <p-dialog 
            header="{{ isEditMode() ? 'Editar' : 'Nuevo' }} Almacén" 
            [(visible)]="warehouseDialog" 
            [modal]="true" 
            [style]="{ width: '450px' }"
        >
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label>Nombre *</label>
                    <input pInputText [(ngModel)]="warehouse.name" />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Código *</label>
                    <input pInputText [(ngModel)]="warehouse.code" [disabled]="isEditMode()" />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Tipo</label>
                    <p-select [options]="typeOptions" [(ngModel)]="warehouse.type" optionLabel="label" optionValue="value" />
                </div>
                @if (isEditMode()) {
                    <div class="flex align-items-center gap-2">
                        <p-toggleswitch [(ngModel)]="warehouse.active" />
                        <label>Almacén activo</label>
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideWarehouseDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveWarehouse()" />
            </ng-template>
        </p-dialog>

        <!-- Dialog para ver stock -->
        <p-dialog header="Stock del Almacén" [(visible)]="stockDialog" [modal]="true" [style]="{ width: '700px' }">
            @if (selectedWarehouse) {
                <h3>{{ selectedWarehouse.name }}</h3>
            }
            <p-table [value]="stock()" [rows]="10" [paginator]="true">
                <ng-template #header>
                    <tr>
                        <th>Producto</th>
                        <th>SKU</th>
                        <th>Cantidad</th>
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        <td>{{ item.product.name }}</td>
                        <td>{{ item.product.sku || '-' }}</td>
                        <td>{{ item.qty }}</td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="3">No hay productos en stock.</td></tr>
                </ng-template>
            </p-table>
        </p-dialog>

        <!-- Dialog para nuevo movimiento -->
        <p-dialog header="Nuevo Movimiento de Stock" [(visible)]="movementDialog" [modal]="true" [style]="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label>Tipo de Movimiento</label>
                    <p-select [options]="movementTypeOptions" [(ngModel)]="movement.type" optionLabel="label" optionValue="value" />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Cantidad *</label>
                    <p-inputnumber [(ngModel)]="movement.qty" [min]="1" />
                </div>
                @if (movement.type === 'OUT' || movement.type === 'TRANSFER') {
                    <div class="flex flex-col gap-2">
                        <label>Almacén de Origen *</label>
                        <p-select [options]="warehouseOptions" [(ngModel)]="movement.fromWarehouseId" optionLabel="label" optionValue="value" />
                    </div>
                }
                @if (movement.type === 'IN' || movement.type === 'TRANSFER') {
                    <div class="flex flex-col gap-2">
                        <label>Almacén de Destino *</label>
                        <p-select [options]="warehouseOptions" [(ngModel)]="movement.toWarehouseId" optionLabel="label" optionValue="value" />
                    </div>
                }
                <div class="flex flex-col gap-2">
                    <label>Motivo</label>
                    <input pInputText [(ngModel)]="movement.reason" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideMovementDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveMovement()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Warehouses implements OnInit {
    warehouses = signal<Warehouse[]>([]);
    stock = signal<StockItem[]>([]);
    movements = signal<StockMovement[]>([]);
    isEditMode = signal<boolean>(false);

    warehouseDialog = false;
    stockDialog = false;
    movementDialog = false;
    
    selectedWarehouse: Warehouse | null = null;
    selectedWarehouseFilter: string | null = null;

    warehouse: any = { name: '', code: '', type: 'TPV', active: true };
    movement: any = { type: 'IN', productId: '', qty: 1, fromWarehouseId: '', toWarehouseId: '', reason: '' };

    typeOptions = [
        { label: 'TPV', value: 'TPV' },
        { label: 'Central', value: 'CENTRAL' }
    ];

    movementTypeOptions = [
        { label: 'Entrada', value: 'IN' },
        { label: 'Salida', value: 'OUT' },
        { label: 'Transferencia', value: 'TRANSFER' }
    ];

    warehouseOptions: any[] = [];

    constructor(
        private warehousesService: WarehousesService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadWarehouses();
        this.loadMovements();
    }

    loadWarehouses() {
        this.warehousesService.listWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouses.set(warehouses);
                this.warehouseOptions = warehouses.map(w => ({ label: w.name, value: w.id }));
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar almacenes' })
        });
    }

    loadMovements() {
        this.warehousesService.listMovements({ warehouseId: this.selectedWarehouseFilter || undefined }).subscribe({
            next: (movements) => this.movements.set(movements),
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar movimientos' })
        });
    }

    openNewWarehouse() {
        this.warehouse = { name: '', code: '', type: 'TPV', active: true };
        this.isEditMode.set(false);
        this.warehouseDialog = true;
    }

    editWarehouse(warehouse: Warehouse) {
        this.selectedWarehouse = warehouse;
        this.warehouse = { ...warehouse };
        this.isEditMode.set(true);
        this.warehouseDialog = true;
    }

    hideWarehouseDialog() {
        this.warehouseDialog = false;
        this.selectedWarehouse = null;
    }

    saveWarehouse() {
        if (!this.warehouse.name || !this.warehouse.code) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Complete los campos requeridos' });
            return;
        }

        const saveObs = this.isEditMode() && this.selectedWarehouse
            ? this.warehousesService.updateWarehouse(this.selectedWarehouse.id, this.warehouse)
            : this.warehousesService.createWarehouse(this.warehouse);

        saveObs.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Almacén guardado' });
                this.loadWarehouses();
                this.hideWarehouseDialog();
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar almacén' })
        });
    }

    deleteWarehouse(warehouse: Warehouse) {
        this.confirmationService.confirm({
            message: `¿Eliminar el almacén ${warehouse.name}?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.warehousesService.deleteWarehouse(warehouse.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Almacén eliminado' });
                        this.loadWarehouses();
                    },
                    error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar' })
                });
            }
        });
    }

    viewStock(warehouse: Warehouse) {
        this.selectedWarehouse = warehouse;
        this.warehousesService.getStock(warehouse.id).subscribe({
            next: (stock) => {
                this.stock.set(stock);
                this.stockDialog = true;
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar stock' })
        });
    }

    openNewMovement() {
        this.movement = { type: 'IN', productId: '', qty: 1, fromWarehouseId: '', toWarehouseId: '', reason: '' };
        this.movementDialog = true;
    }

    hideMovementDialog() {
        this.movementDialog = false;
    }

    saveMovement() {
        if (!this.movement.qty) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Ingrese la cantidad' });
            return;
        }

        if ((this.movement.type === 'OUT' || this.movement.type === 'TRANSFER') && !this.movement.fromWarehouseId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione almacén de origen' });
            return;
        }

        if ((this.movement.type === 'IN' || this.movement.type === 'TRANSFER') && !this.movement.toWarehouseId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione almacén de destino' });
            return;
        }

        this.warehousesService.createMovement(this.movement).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Movimiento registrado' });
                this.loadMovements();
                this.hideMovementDialog();
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al registrar movimiento' })
        });
    }

    getMovementTypeLabel(type: string): string {
        const labels: any = { 'IN': 'Entrada', 'OUT': 'Salida', 'TRANSFER': 'Transferencia' };
        return labels[type] || type;
    }

    getMovementTypeSeverity(type: string): 'success' | 'info' | 'warn' | 'danger' {
        const severities: any = { 'IN': 'success', 'OUT': 'danger', 'TRANSFER': 'info' };
        return severities[type] || 'info';
    }
}
