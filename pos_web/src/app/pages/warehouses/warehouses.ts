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
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageService, ConfirmationService } from 'primeng/api';
import { 
    WarehousesService, 
    Warehouse, 
    StockItem, 
    StockMovement 
} from '@/app/core/services/warehouses.service';
import { ProductsService, Product } from '@/app/core/services/products.service';

type StockColumnKey =
    | 'image'
    | 'name'
    | 'codigo'
    | 'barcode'
    | 'type'
    | 'category'
    | 'unit'
    | 'price'
    | 'cost'
    | 'active'
    | 'createdAt'
    | 'qty';

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
        MultiSelectModule,
        InputNumberModule,
        ConfirmDialogModule,
        ToggleSwitchModule,
        DatePickerModule
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
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mb-3">
                <div class="flex flex-col gap-2">
                    <label>Almacén</label>
                    <p-select
                        [options]="warehouseOptions"
                        [(ngModel)]="selectedWarehouseFilter"
                        (onChange)="applyMovementFilters()"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Todos los almacenes"
                        [showClear]="true"
                        styleClass="w-full"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Desde</label>
                    <p-datepicker
                        [(ngModel)]="selectedFromDateFilter"
                        (onSelect)="applyMovementFilters()"
                        (onClearClick)="applyMovementFilters()"
                        dateFormat="yy-mm-dd"
                        [showIcon]="true"
                        [showButtonBar]="true"
                        [maxDate]="selectedToDateFilter || today"
                        styleClass="w-full"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Hasta</label>
                    <p-datepicker
                        [(ngModel)]="selectedToDateFilter"
                        (onSelect)="applyMovementFilters()"
                        (onClearClick)="applyMovementFilters()"
                        dateFormat="yy-mm-dd"
                        [showIcon]="true"
                        [showButtonBar]="true"
                        [minDate]="selectedFromDateFilter || undefined"
                        [maxDate]="today"
                        styleClass="w-full"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Tipo de movimiento</label>
                    <p-select
                        [options]="movementTypeOptions"
                        [(ngModel)]="selectedMovementTypeFilter"
                        (onChange)="applyMovementFilters()"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Todos los tipos"
                        [showClear]="true"
                        styleClass="w-full"
                    />
                </div>
                <div class="flex flex-col gap-2">
                    <label>Razón</label>
                    <input
                        pInputText
                        [(ngModel)]="selectedReasonFilter"
                        (keydown.enter)="applyMovementFilters()"
                        placeholder="Ej: ajuste, merma, devolución"
                    />
                </div>
            </div>
                <div class="flex flex-wrap gap-2 mb-4">
                <p-button label="Aplicar filtros" icon="pi pi-filter" [loading]="loadingMovements" (onClick)="applyMovementFilters()" />
                <p-button label="Limpiar" icon="pi pi-eraser" severity="secondary" [outlined]="true" [disabled]="loadingMovements" (onClick)="clearMovementFilters()" />
            </div>
            
            <p-table [value]="movements()" [loading]="loadingMovements" [rows]="10" [paginator]="true" [tableStyle]="{ 'min-width': '50rem' }">
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
            [contentStyle]="{ overflow: 'visible' }"
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
                    <p-select [options]="typeOptions" [(ngModel)]="warehouse.type" optionLabel="label" optionValue="value" appendTo="body" />
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
        <p-dialog
            header="Stock del Almacén"
            [(visible)]="stockDialog"
            [modal]="true"
            [style]="{ width: '96vw', maxWidth: '1400px' }"
            [breakpoints]="{ '1400px': '96vw', '960px': '98vw' }"
            [maximizable]="true"
        >
            @if (selectedWarehouse) {
                <h3>{{ selectedWarehouse.name }}</h3>
            }
            <div class="flex flex-col gap-2 mb-3">
                <label>Columnas visibles</label>
                <p-multiselect
                    [options]="stockColumnOptions"
                    [(ngModel)]="visibleStockColumns"
                    optionLabel="label"
                    optionValue="value"
                    [filter]="true"
                    [showClear]="false"
                    display="chip"
                    appendTo="body"
                    defaultLabel="Seleccionar columnas"
                    styleClass="w-full"
                />
            </div>
            <p-table
                [value]="stock()"
                [rows]="10"
                [paginator]="true"
                [scrollable]="true"
                scrollHeight="56vh"
                styleClass="p-datatable-sm"
                [tableStyle]="{ 'min-width': '78rem', 'table-layout': 'fixed' }"
            >
                <ng-template #header>
                    <tr>
                        @if (isStockColumnVisible('image')) { <th class="whitespace-nowrap" style="width: 72px;">Imagen</th> }
                        @if (isStockColumnVisible('name')) { <th class="whitespace-nowrap" style="width: 220px;">Producto</th> }
                        @if (isStockColumnVisible('codigo')) { <th class="whitespace-nowrap" style="width: 130px;">Código</th> }
                        @if (isStockColumnVisible('barcode')) { <th class="whitespace-nowrap" style="width: 150px;">Barras</th> }
                        @if (isStockColumnVisible('type')) { <th class="whitespace-nowrap" style="width: 140px;">Tipo</th> }
                        @if (isStockColumnVisible('category')) { <th class="whitespace-nowrap" style="width: 140px;">Categoría</th> }
                        @if (isStockColumnVisible('unit')) { <th class="whitespace-nowrap" style="width: 140px;">Unidad</th> }
                        @if (isStockColumnVisible('price')) { <th class="text-right whitespace-nowrap" style="width: 120px;">Precio</th> }
                        @if (isStockColumnVisible('cost')) { <th class="text-right whitespace-nowrap" style="width: 120px;">Costo</th> }
                        @if (isStockColumnVisible('active')) { <th class="whitespace-nowrap" style="width: 110px;">Estado</th> }
                        @if (isStockColumnVisible('createdAt')) { <th class="whitespace-nowrap" style="width: 165px;">Creado</th> }
                        @if (isStockColumnVisible('qty')) { <th class="whitespace-nowrap text-center" style="width: 110px;">Cantidad</th> }
                    </tr>
                </ng-template>
                <ng-template #body let-item>
                    <tr>
                        @if (isStockColumnVisible('image')) {
                            <td style="width: 72px;">
                                @if (item.product.image) {
                                    <img [src]="getProductImageUrl(item.product.image)" [alt]="item.product.name" width="32" style="border-radius: 4px;" />
                                } @else {
                                    <span class="text-gray-400">-</span>
                                }
                            </td>
                        }
                        @if (isStockColumnVisible('name')) {
                            <td class="whitespace-nowrap" style="width: 220px;">
                                <div [title]="item.product.name" style="overflow: hidden; text-overflow: ellipsis;">{{ item.product.name }}</div>
                            </td>
                        }
                        @if (isStockColumnVisible('codigo')) {
                            <td class="whitespace-nowrap" style="width: 130px;">
                                <div [title]="item.product.codigo || '-'" style="overflow: hidden; text-overflow: ellipsis;">{{ item.product.codigo || '-' }}</div>
                            </td>
                        }
                        @if (isStockColumnVisible('barcode')) {
                            <td class="whitespace-nowrap" style="width: 150px;">
                                <div [title]="item.product.barcode || '-'" style="overflow: hidden; text-overflow: ellipsis;">{{ item.product.barcode || '-' }}</div>
                            </td>
                        }
                        @if (isStockColumnVisible('type')) {
                            <td class="whitespace-nowrap" style="width: 140px;">
                                <div [title]="item.product.productType?.name || '-'" style="overflow: hidden; text-overflow: ellipsis;">{{ item.product.productType?.name || '-' }}</div>
                            </td>
                        }
                        @if (isStockColumnVisible('category')) {
                            <td class="whitespace-nowrap" style="width: 140px;">
                                <div [title]="item.product.productCategory?.name || '-'" style="overflow: hidden; text-overflow: ellipsis;">{{ item.product.productCategory?.name || '-' }}</div>
                            </td>
                        }
                        @if (isStockColumnVisible('unit')) {
                            <td class="whitespace-nowrap" style="width: 140px;">
                                <div [title]="item.product.measurementUnit ? (item.product.measurementUnit.name + ' (' + item.product.measurementUnit.symbol + ')') : '-'" style="overflow: hidden; text-overflow: ellipsis;">
                                    @if (item.product.measurementUnit) {
                                        {{ item.product.measurementUnit.name }} ({{ item.product.measurementUnit.symbol }})
                                    } @else {
                                        -
                                    }
                                </div>
                            </td>
                        }
                        @if (isStockColumnVisible('price')) { <td class="text-right whitespace-nowrap" style="width: 120px;">{{ item.product.price | currency }}</td> }
                        @if (isStockColumnVisible('cost')) { <td class="text-right whitespace-nowrap" style="width: 120px;">{{ item.product.cost ? (item.product.cost | currency) : '-' }}</td> }
                        @if (isStockColumnVisible('active')) {
                            <td class="whitespace-nowrap" style="width: 110px;">
                                <p-tag [value]="item.product.active ? 'Activo' : 'Inactivo'" [severity]="item.product.active ? 'success' : 'warn'" />
                            </td>
                        }
                        @if (isStockColumnVisible('createdAt')) { <td class="whitespace-nowrap" style="width: 165px;">{{ item.product.createdAt | date:'dd/MM/yyyy HH:mm' }}</td> }
                        @if (isStockColumnVisible('qty')) {
                            <td class="text-center whitespace-nowrap" style="width: 110px;">
                                <p-tag [value]="item.qty" [severity]="getQtySeverity(item.qty)" styleClass="font-semibold" />
                            </td>
                        }
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td [attr.colspan]="visibleStockColumnCount()">No hay productos en stock.</td></tr>
                </ng-template>
            </p-table>
        </p-dialog>

        <!-- Dialog para nuevo movimiento -->
        <p-dialog
            header="Nuevo Movimiento de Stock"
            [(visible)]="movementDialog"
            [modal]="true"
            [style]="{ width: '760px', maxWidth: '96vw' }"
            [breakpoints]="{ '960px': '98vw' }"
            [draggable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="rounded-xl border border-surface-200 bg-surface-50 p-3">
                    <div class="flex items-start gap-3">
                        <div class="h-10 w-10 rounded-lg bg-primary text-white flex items-center justify-center">
                            <i class="pi pi-box"></i>
                        </div>
                        <div>
                            <div class="font-semibold">Registra entradas, salidas y transferencias de forma rápida</div>
                            <small class="text-color-secondary">
                                Completa los campos requeridos y valida el resumen antes de guardar.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Tipo de movimiento</label>
                        <p-select
                            [options]="movementTypeOptions"
                            [(ngModel)]="movement.type"
                            optionLabel="label"
                            optionValue="value"
                            appendTo="body"
                        />
                        <div class="text-xs text-color-secondary">{{ getMovementTypeHint(movement.type) }}</div>
                    </div>

                    <div class="flex flex-col gap-2">
                        <label class="font-medium">Cantidad *</label>
                        <p-inputnumber [(ngModel)]="movement.qty" [min]="1" [showButtons]="true" buttonLayout="horizontal" decrementButtonClass="p-button-secondary" incrementButtonClass="p-button-secondary" incrementButtonIcon="pi pi-plus" decrementButtonIcon="pi pi-minus" />
                        <div class="text-xs text-color-secondary">Solo valores enteros mayores a 0.</div>
                    </div>

                    <div class="flex flex-col gap-2 md:col-span-2">
                        <label class="font-medium">Producto *</label>
                        <p-select
                            [options]="productOptions"
                            [(ngModel)]="movement.productId"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Seleccione un producto"
                            [filter]="true"
                            [showClear]="true"
                            appendTo="body"
                        />
                    </div>

                    @if (movement.type === 'OUT' || movement.type === 'TRANSFER') {
                        <div class="flex flex-col gap-2">
                            <label class="font-medium">Almacén de origen *</label>
                            <p-select
                                [options]="warehouseOptions"
                                [(ngModel)]="movement.fromWarehouseId"
                                optionLabel="label"
                                optionValue="value"
                                [filter]="true"
                                [showClear]="true"
                                appendTo="body"
                            />
                        </div>
                    }

                    @if (movement.type === 'IN' || movement.type === 'TRANSFER') {
                        <div class="flex flex-col gap-2">
                            <label class="font-medium">Almacén de destino *</label>
                            <p-select
                                [options]="warehouseOptions"
                                [(ngModel)]="movement.toWarehouseId"
                                optionLabel="label"
                                optionValue="value"
                                [filter]="true"
                                [showClear]="true"
                                appendTo="body"
                            />
                        </div>
                    }

                    <div class="flex flex-col gap-2 md:col-span-2">
                        <label class="font-medium">Motivo</label>
                        <input pInputText [(ngModel)]="movement.reason" placeholder="Ej: ajuste de inventario, merma, reposición" />
                        <div class="flex flex-wrap gap-2">
                            <p-button label="Ajuste" size="small" severity="secondary" [outlined]="true" (onClick)="setMovementReason('Ajuste de inventario')" />
                            <p-button label="Reposición" size="small" severity="secondary" [outlined]="true" (onClick)="setMovementReason('Reposición de stock')" />
                            <p-button label="Merma" size="small" severity="secondary" [outlined]="true" (onClick)="setMovementReason('Merma')" />
                            <p-button label="Devolución" size="small" severity="secondary" [outlined]="true" (onClick)="setMovementReason('Devolución')" />
                        </div>
                    </div>
                </div>

                <div class="rounded-xl border border-surface-200 bg-surface-50 p-3">
                    <div class="font-semibold mb-3">Resumen del movimiento</div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-color-secondary">Tipo</span>
                            <p-tag [value]="getMovementTypeLabel(movement.type)" [severity]="getMovementTypeSeverity(movement.type)" />
                        </div>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-color-secondary">Cantidad</span>
                            <strong>{{ movement.qty || 0 }}</strong>
                        </div>
                        <div class="flex items-center justify-between gap-2 md:col-span-2">
                            <span class="text-color-secondary">Producto</span>
                            <strong class="text-right">{{ getSelectedProductLabel() }}</strong>
                        </div>
                        @if (movement.type === 'OUT' || movement.type === 'TRANSFER') {
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-color-secondary">Origen</span>
                                <strong>{{ getWarehouseLabelById(movement.fromWarehouseId) }}</strong>
                            </div>
                        }
                        @if (movement.type === 'IN' || movement.type === 'TRANSFER') {
                            <div class="flex items-center justify-between gap-2">
                                <span class="text-color-secondary">Destino</span>
                                <strong>{{ getWarehouseLabelById(movement.toWarehouseId) }}</strong>
                            </div>
                        }
                        <div class="flex items-center justify-between gap-2 md:col-span-2">
                            <span class="text-color-secondary">Motivo</span>
                            <strong class="text-right">{{ movement.reason?.trim() || 'Sin motivo especificado' }}</strong>
                        </div>
                    </div>
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideMovementDialog()" />
                <p-button label="Guardar" icon="pi pi-check" [disabled]="!isMovementFormValid()" (onClick)="saveMovement()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Warehouses implements OnInit {
    readonly IMAGE_BASE_URL = '';
    warehouses = signal<Warehouse[]>([]);
    stock = signal<StockItem[]>([]);
    movements = signal<StockMovement[]>([]);
    isEditMode = signal<boolean>(false);

    warehouseDialog = false;
    stockDialog = false;
    movementDialog = false;
    loadingMovements = false;
    
    selectedWarehouse: Warehouse | null = null;
    selectedWarehouseFilter: string | null = null;
    selectedFromDateFilter: Date | null = null;
    selectedToDateFilter: Date | null = null;
    selectedMovementTypeFilter: 'IN' | 'OUT' | 'TRANSFER' | null = null;
    selectedReasonFilter = '';
    readonly today = new Date();
    private movementsRequestId = 0;

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
    productOptions: any[] = [];
    stockColumnOptions: Array<{ label: string; value: StockColumnKey }> = [
        { label: 'Imagen', value: 'image' },
        { label: 'Nombre', value: 'name' },
        { label: 'Código', value: 'codigo' },
        { label: 'Precio', value: 'price' },
        { label: 'Costo', value: 'cost' },
        { label: 'Tipo', value: 'type' },
        { label: 'Categoría', value: 'category' },
        { label: 'Unidad', value: 'unit' },
        { label: 'Cantidad', value: 'qty' },
        { label: 'Código de Barras', value: 'barcode' },
        { label: 'Estado', value: 'active' },
        { label: 'Fecha Creación', value: 'createdAt' }
    ];
    visibleStockColumns: StockColumnKey[] = [
        'image',
        'name',
        'codigo',
        'price',
        'cost',
        'type',
        'category',
        'unit',
        'qty'
    ];

    constructor(
        private warehousesService: WarehousesService,
        private productsService: ProductsService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadWarehouses();
        this.loadMovements();
        this.loadProductsForMovements();
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
        if (
            this.selectedFromDateFilter &&
            this.selectedToDateFilter &&
            this.selectedFromDateFilter.getTime() > this.selectedToDateFilter.getTime()
        ) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: "La fecha 'Desde' no puede ser mayor que 'Hasta'" });
            return;
        }

        const requestId = ++this.movementsRequestId;
        this.loadingMovements = true;
        const typeFilter = this.normalizeMovementTypeFilter(this.selectedMovementTypeFilter);
        const reasonFilter = this.selectedReasonFilter.trim() || undefined;

        this.warehousesService.listMovements({
            warehouseId: this.selectedWarehouseFilter || undefined,
            from: this.selectedFromDateFilter ? this.formatDateAsYmd(this.selectedFromDateFilter) : undefined,
            to: this.selectedToDateFilter ? this.formatDateAsYmd(this.selectedToDateFilter) : undefined,
            type: typeFilter,
            reason: reasonFilter
        }).subscribe({
            next: (movements) => {
                if (requestId !== this.movementsRequestId) return;
                this.movements.set(this.applyClientSideFilters(movements, typeFilter, reasonFilter));
                this.loadingMovements = false;
            },
            error: () => {
                if (requestId !== this.movementsRequestId) return;
                this.loadingMovements = false;
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar movimientos' });
            }
        });
    }

    applyMovementFilters() {
        this.loadMovements();
    }

    clearMovementFilters() {
        this.selectedWarehouseFilter = null;
        this.selectedFromDateFilter = null;
        this.selectedToDateFilter = null;
        this.selectedMovementTypeFilter = null;
        this.selectedReasonFilter = '';
        this.loadMovements();
    }

    loadProductsForMovements() {
        this.productsService.list().subscribe({
            next: (products) => {
                this.productOptions = products.map((p: Product) => ({
                    label: this.buildMovementProductLabel(p),
                    value: p.id
                }));
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar productos' })
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

    setMovementReason(reason: string) {
        this.movement.reason = reason;
    }

    isMovementFormValid(): boolean {
        if (!this.movement.productId) return false;

        const qty = Number(this.movement.qty);
        if (!Number.isInteger(qty) || qty <= 0) return false;

        if ((this.movement.type === 'OUT' || this.movement.type === 'TRANSFER') && !this.movement.fromWarehouseId) {
            return false;
        }

        if ((this.movement.type === 'IN' || this.movement.type === 'TRANSFER') && !this.movement.toWarehouseId) {
            return false;
        }

        if (
            this.movement.type === 'TRANSFER' &&
            this.movement.fromWarehouseId &&
            this.movement.toWarehouseId &&
            this.movement.fromWarehouseId === this.movement.toWarehouseId
        ) {
            return false;
        }

        return true;
    }

    saveMovement() {
        if (!this.movement.productId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione un producto' });
            return;
        }

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

        if (
            this.movement.type === 'TRANSFER' &&
            this.movement.fromWarehouseId &&
            this.movement.toWarehouseId &&
            this.movement.fromWarehouseId === this.movement.toWarehouseId
        ) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El almacén de origen y destino no puede ser el mismo' });
            return;
        }

        const payload = {
            type: this.movement.type as 'IN' | 'OUT' | 'TRANSFER',
            productId: this.movement.productId,
            qty: Number(this.movement.qty),
            fromWarehouseId: this.movement.fromWarehouseId || undefined,
            toWarehouseId: this.movement.toWarehouseId || undefined,
            reason: this.movement.reason?.trim() || undefined
        };

        this.warehousesService.createMovement(payload).subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Movimiento registrado' });
                this.loadMovements();
                this.hideMovementDialog();
            },
            error: (err) => this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: err?.error?.message || 'Error al registrar movimiento'
            })
        });
    }

    getMovementTypeLabel(type: string): string {
        const labels: any = { 'IN': 'Entrada', 'OUT': 'Salida', 'TRANSFER': 'Transferencia' };
        return labels[type] || type;
    }

    getMovementTypeHint(type: string): string {
        const hints: Record<string, string> = {
            IN: 'Agrega stock al almacén seleccionado.',
            OUT: 'Descuenta stock del almacén de origen.',
            TRANSFER: 'Mueve stock entre un almacén de origen y uno de destino.'
        };
        return hints[type] || '';
    }

    getSelectedProductLabel(): string {
        if (!this.movement.productId) return 'Sin seleccionar';
        const option = this.productOptions.find((item) => item.value === this.movement.productId);
        return option?.label || 'Sin seleccionar';
    }

    getWarehouseLabelById(warehouseId?: string | null): string {
        if (!warehouseId) return 'Sin seleccionar';
        const option = this.warehouseOptions.find((item) => item.value === warehouseId);
        return option?.label || 'Sin seleccionar';
    }

    getMovementTypeSeverity(type: string): 'success' | 'info' | 'warn' | 'danger' {
        const severities: any = { 'IN': 'success', 'OUT': 'danger', 'TRANSFER': 'info' };
        return severities[type] || 'info';
    }

    getQtySeverity(qty: number): 'success' | 'info' | 'warn' | 'danger' {
        if (qty <= 0) return 'danger';
        if (qty <= 5) return 'warn';
        return 'success';
    }

    getProductImageUrl(imagePath: string): string {
        if (!imagePath) return '';
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
        if (imagePath.startsWith('/')) return this.IMAGE_BASE_URL + imagePath;
        return this.IMAGE_BASE_URL + '/' + imagePath;
    }

    isStockColumnVisible(column: StockColumnKey): boolean {
        return this.visibleStockColumns.includes(column);
    }

    visibleStockColumnCount(): number {
        return Math.max(1, this.visibleStockColumns.length);
    }

    private formatDateAsYmd(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private normalizeMovementTypeFilter(value: unknown): 'IN' | 'OUT' | 'TRANSFER' | undefined {
        const raw = typeof value === 'string'
            ? value
            : (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)
                ? String((value as Record<string, unknown>)['value'])
                : '');

        if (raw === 'IN' || raw === 'OUT' || raw === 'TRANSFER') return raw;
        return undefined;
    }

    private applyClientSideFilters(
        movements: StockMovement[],
        type?: 'IN' | 'OUT' | 'TRANSFER',
        reason?: string
    ): StockMovement[] {
        const reasonQuery = reason?.toLowerCase();
        const fromBoundary = this.selectedFromDateFilter
            ? new Date(
                this.selectedFromDateFilter.getFullYear(),
                this.selectedFromDateFilter.getMonth(),
                this.selectedFromDateFilter.getDate(),
                0, 0, 0, 0
            ).getTime()
            : null;
        const toBoundary = this.selectedToDateFilter
            ? new Date(
                this.selectedToDateFilter.getFullYear(),
                this.selectedToDateFilter.getMonth(),
                this.selectedToDateFilter.getDate(),
                23, 59, 59, 999
            ).getTime()
            : null;

        return movements.filter((movement) => {
            if (type && movement.type !== type) return false;

            if (reasonQuery) {
                const movementReason = (movement.reason || '').toLowerCase();
                if (!movementReason.includes(reasonQuery)) return false;
            }

            if (fromBoundary !== null || toBoundary !== null) {
                const createdAt = new Date(movement.createdAt).getTime();
                if (Number.isNaN(createdAt)) return false;
                if (fromBoundary !== null && createdAt < fromBoundary) return false;
                if (toBoundary !== null && createdAt > toBoundary) return false;
            }

            return true;
        });
    }

    private buildMovementProductLabel(product: Product): string {
        const codePart = product.codigo ? ` (${product.codigo})` : '';
        const pricePart = this.formatMovementPrice(product.price);
        return `${product.name}${codePart} - ${pricePart}`;
    }

    private formatMovementPrice(value: unknown): string {
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return '$0.00';
        return new Intl.NumberFormat('es-DO', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(numericValue);
    }
}
