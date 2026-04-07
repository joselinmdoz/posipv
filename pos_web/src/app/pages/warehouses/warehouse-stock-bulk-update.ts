import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { from, of } from 'rxjs';
import { catchError, concatMap, finalize } from 'rxjs/operators';
import { Product, ProductsService } from '@/app/core/services/products.service';
import { Warehouse, WarehousesService, StockItem } from '@/app/core/services/warehouses.service';

type BulkStockRow = {
    productId: string;
    codigo: string;
    name: string;
    price: number;
    currency: 'CUP' | 'USD';
    allowFractionalQty: boolean;
    qty: number;
    currentStock: number;
    toWarehouseId: string | null;
    reason: string;
};

@Component({
    selector: 'app-warehouse-stock-bulk-update',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        ToastModule
    ],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 class="text-2xl font-semibold m-0">Movimiento Masivo de Stock</h2>
                    <p class="m-0 text-color-secondary">Registra movimientos de inventario por producto en un solo flujo.</p>
                </div>
                <div class="flex gap-2">
                    <p-button label="Volver a almacenes" icon="pi pi-arrow-left" severity="secondary" [outlined]="true" (onClick)="goBack()" />
                    <p-button label="Guardar movimientos" icon="pi pi-save" [disabled]="saving() || !canSave()" [loading]="saving()" (onClick)="saveBulkUpdate()" />
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Tipo de movimiento</label>
                    <p-select
                        [options]="[
                            { label: 'Entrada', value: 'IN' },
                            { label: 'Salida', value: 'OUT' },
                            { label: 'Transferencia', value: 'TRANSFER' }
                        ]"
                        [(ngModel)]="movementType"
                        optionLabel="label"
                        optionValue="value"
                        (onChange)="onMovementTypeChange()"
                        appendTo="body"
                    />
                </div>
                 <div class="flex flex-col gap-2" *ngIf="movementType() === 'OUT' || movementType() === 'TRANSFER'">
                    <label class="font-medium">Almacén origen para todos</label>
                    <p-select
                        [options]="warehouseOptions()"
                        [(ngModel)]="globalFromWarehouseId"
                        optionLabel="label"
                        optionValue="value"
                        [showClear]="true"
                        placeholder="Seleccione almacén origen global"
                        (onChange)="onFromWarehouseChange()"
                        appendTo="body"
                    />
                    <small class="text-color-secondary">Para transferencias y salidas, selecciona el almacén de origen.</small>
                </div>

                <div class="flex flex-col gap-2" *ngIf="movementType() === 'IN' || movementType() === 'TRANSFER'">
                    <label class="font-medium">Almacén destino para todos</label>
                    <p-select
                        [options]="warehouseOptions()"
                        [(ngModel)]="globalToWarehouseId"
                        optionLabel="label"
                        optionValue="value"
                        [showClear]="true"
                        placeholder="Seleccione almacén destino global"
                        appendTo="body"
                    />
                    <small class="text-color-secondary">Puedes sobrescribir por fila en la tabla.</small>
                </div>

               

                <div class="flex flex-col gap-2 col-span-full lg:col-span-3">
                    <label class="font-medium">Motivo global</label>
                    <input pInputText [(ngModel)]="globalReason" placeholder="Ej: Movimiento general de inventario" />
                    <small class="text-color-secondary">Si no defines motivo en una fila, se usa este.</small>
                </div>
            </div>

            <div class="flex items-center gap-2">
                <i class="pi pi-search text-color-secondary"></i>
                <input pInputText class="w-full md:w-25rem" [(ngModel)]="searchTerm" placeholder="Buscar por código o nombre" />
            </div>

            <p-table
                [value]="filteredRows()"
                [rows]="25"
                [paginator]="true"
                responsiveLayout="scroll"
                [scrollable]="true"
                scrollHeight="60vh"
                styleClass="p-datatable-sm"
                [tableStyle]="{ 'min-width': movementType() === 'IN' ? '72rem' : '80rem' }"
            >
                <ng-template #header>
                    <tr>
                        <th style="width: 150px;">Código</th>
                        <th style="width: 260px;">Nombre</th>
                        <th class="text-right" style="width: 140px;">Precio venta</th>
                        @if (movementType() !== 'IN') {
                            <th class="text-right" style="width: 140px;">Stock actual</th>
                        }
                        <th style="width: 160px;">Cantidad</th>
                        <th style="width: 260px;">Almacén destino</th>
                        <th>Motivo</th>
                    </tr>
                </ng-template>
                <ng-template #body let-row>
                    <tr>
                        <td>{{ row.codigo || '-' }}</td>
                        <td>
                            <div class="font-medium">{{ row.name }}</div>
                            @if (row.allowFractionalQty) {
                                <p-tag value="Fraccionado" severity="info" styleClass="mt-1" />
                            }
                        </td>
                        <td class="text-right">{{ formatPrice(row.price, row.currency) }}</td>
                        @if (movementType() !== 'IN') {
                            <td class="text-right">{{ row.currentStock }}</td>
                        }
                        <td>
                            <p-inputnumber
                                [(ngModel)]="row.qty"
                                [min]="0"
                                [max]="getMaxQty(row)"
                                [step]="row.allowFractionalQty ? 0.01 : 1"
                                [minFractionDigits]="0"
                                [maxFractionDigits]="row.allowFractionalQty ? 2 : 0"
                                locale="es-ES"
                                [useGrouping]="false"
                                inputStyleClass="w-full"
                                styleClass="w-full"
                            />
                        </td>
                        <td *ngIf="movementType() === 'IN' || movementType() === 'TRANSFER'">
                            <p-select
                                [options]="warehouseOptions()"
                                [(ngModel)]="row.toWarehouseId"
                                optionLabel="label"
                                optionValue="value"
                                [showClear]="true"
                                appendTo="body"
                                placeholder="Usar almacén global"
                                styleClass="w-full"
                            />
                        </td>
                        <td *ngIf="movementType() === 'OUT'">
                            -
                        </td>
                        <td>
                            <input pInputText [(ngModel)]="row.reason" placeholder="Usar motivo global" class="w-full" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td [colSpan]="movementType() === 'IN' ? 6 : 7">No hay productos para mostrar.</td></tr>
                </ng-template>
            </p-table>
        </div>

        <p-toast />
    `
})
export class WarehouseStockBulkUpdate implements OnInit {
    rows = signal<BulkStockRow[]>([]);
    warehouses = signal<Warehouse[]>([]);
    saving = signal(false);
    movementType = signal<'IN' | 'OUT' | 'TRANSFER'>('IN');

    searchTerm = '';
    globalToWarehouseId: string | null = null;
    globalFromWarehouseId: string | null = null;
    globalReason = '';

    warehouseOptions = computed(() =>
        this.warehouses().map((w) => ({
            label: w.name,
            value: w.id
        }))
    );

    filteredRows = computed(() => {
        const rows = this.rows();
        const term = (this.searchTerm || '').trim().toLowerCase();
        if (!term) return rows;
        return rows.filter((row) => {
            return row.codigo.toLowerCase().includes(term) || row.name.toLowerCase().includes(term);
        });
    });

    constructor(
        private readonly warehousesService: WarehousesService,
        private readonly productsService: ProductsService,
        private readonly messageService: MessageService,
        private readonly router: Router
    ) {}

    onMovementTypeChange() {
        this.globalFromWarehouseId = null;
        this.globalToWarehouseId = null;
        this.loadRows();
    }

    onFromWarehouseChange() {
        this.loadRows();
    }

    getMaxQty(row: BulkStockRow): number | undefined {
        if (this.movementType() === 'IN') return undefined;
        return row.allowFractionalQty ? row.currentStock : Math.floor(row.currentStock);
    }

    ngOnInit(): void {
        this.loadWarehouses();
        this.loadRows();
    }

    goBack() {
        this.router.navigate(['/warehouses']);
    }

    canSave() {
        if (this.saving()) return false;
        return this.rows().some((row) => {
            const qty = this.normalizeQty(row.qty, row.allowFractionalQty);
            if (qty <= 0) return false;
            if (this.movementType() !== 'IN' && qty > row.currentStock) return false;
            return true;
        });
    }

    saveBulkUpdate() {
        if (this.saving()) return;

        const type = this.movementType();
        const rows = this.rows();
        const payloads = rows
            .map((row) => {
                const qty = this.normalizeQty(row.qty, row.allowFractionalQty);
                if (qty <= 0) return null;
                if (type !== 'IN' && qty > row.currentStock) return null;

                let fromWarehouseId: string | undefined;
                let toWarehouseId: string | undefined;
                const reason = (row.reason || '').trim() || (this.globalReason || '').trim() || 'Movimiento masivo de stock';

                if (type === 'IN') {
                    toWarehouseId = row.toWarehouseId || this.globalToWarehouseId || undefined;
                } else if (type === 'OUT') {
                    fromWarehouseId = this.globalFromWarehouseId || undefined;
                } else if (type === 'TRANSFER') {
                    fromWarehouseId = this.globalFromWarehouseId || undefined;
                    toWarehouseId = row.toWarehouseId || this.globalToWarehouseId || undefined;
                }

                return {
                    row,
                    movement: {
                        type,
                        productId: row.productId,
                        qty,
                        fromWarehouseId,
                        toWarehouseId,
                        reason
                    }
                };
            })
            .filter((item): item is NonNullable<typeof item> => !!item);

        if (!payloads.length) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Introduzca al menos una cantidad válida.' });
            return;
        }

        // Validar almacenes requeridos
        const missingToWarehouse = type === 'IN' || type === 'TRANSFER' ? payloads.filter((p) => !p.movement.toWarehouseId) : [];
        const missingFromWarehouse = type === 'OUT' || type === 'TRANSFER' ? payloads.filter((p) => !p.movement.fromWarehouseId) : [];

        if (missingToWarehouse.length > 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Almacén destino requerido',
                detail: `Hay ${missingToWarehouse.length} producto(s) sin almacén destino.`
            });
            return;
        }

        if (missingFromWarehouse.length > 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Almacén origen requerido',
                detail: `Hay ${missingFromWarehouse.length} producto(s) sin almacén origen.`
            });
            return;
        }

        let successCount = 0;
        const failed: string[] = [];
        this.saving.set(true);

        from(payloads)
            .pipe(
                concatMap((item) =>
                    this.warehousesService.createMovement(item.movement).pipe(
                        catchError((err) => {
                            const msg = err?.error?.message || 'Error al registrar movimiento';
                            failed.push(`${item.row.codigo || item.row.name}: ${msg}`);
                            return of(null);
                        })
                    )
                ),
                finalize(() => {
                    this.saving.set(false);

                    if (successCount > 0) {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Movimiento completado',
                            detail: `Se registraron ${successCount} movimiento(s).`
                        });
                    }

                    if (failed.length > 0) {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Algunos productos fallaron',
                            detail: failed.slice(0, 3).join(' | ') + (failed.length > 3 ? ' | ...' : '')
                        });
                    }

                    if (successCount > 0) {
                        this.loadProducts();
                    }
                })
            )
            .subscribe((result) => {
                if (result) successCount += 1;
            });
    }

    formatPrice(value: number, currency: 'CUP' | 'USD') {
        const amount = Number(value || 0);
        const locale = currency === 'USD' ? 'en-US' : 'es-CU';
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    private loadWarehouses() {
        this.warehousesService.listWarehouses().subscribe({
            next: (rows) => {
                this.warehouses.set(rows || []);
            },
            error: () => {
                this.warehouses.set([]);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los almacenes.' });
            }
        });
    }

    private loadRows() {
        const type = this.movementType();
        if (type === 'IN') {
            this.loadProducts();
        } else if ((type === 'OUT' || type === 'TRANSFER') && this.globalFromWarehouseId) {
            this.loadStockProducts(this.globalFromWarehouseId);
        } else {
            this.rows.set([]);
        }
    }

    private loadProducts() {
        this.productsService.list().subscribe({
            next: (products) => {
                const rows = (products || [])
                    .slice()
                    .sort((a, b) => this.compareByCodigoThenName(a, b))
                    .map((product) => this.mapProductToRow(product));
                this.rows.set(rows);
            },
            error: () => {
                this.rows.set([]);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los productos.' });
            }
        });
    }

    private loadStockProducts(warehouseId: string) {
        this.warehousesService.getStock(warehouseId).subscribe({
            next: (stockItems) => {
                const rows = (stockItems || [])
                    .filter((item) => item.qty > 0)
                    .slice()
                    .sort((a, b) => this.compareStockItemsByCodigoThenName(a, b))
                    .map((item) => this.mapStockItemToRow(item));
                this.rows.set(rows);
            },
            error: () => {
                this.rows.set([]);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los productos con stock.' });
            }
        });
    }

    private mapProductToRow(product: Product): BulkStockRow {
        return {
            productId: product.id,
            codigo: (product.codigo || '').trim(),
            name: product.name,
            price: Number(product.price || 0),
            currency: String(product.currency || 'CUP').toUpperCase() === 'USD' ? 'USD' : 'CUP',
            allowFractionalQty: !!product.allowFractionalQty,
            qty: 0,
            currentStock: 0,
            toWarehouseId: null,
            reason: ''
        };
    }

    private mapStockItemToRow(item: StockItem): BulkStockRow {
        const product = item.product;
        return {
            productId: product.id,
            codigo: (product.codigo || '').trim(),
            name: product.name,
            price: Number(product.price || 0),
            currency: 'CUP', // Assuming default, since StockItem.product doesn't include currency
            allowFractionalQty: !!product.allowFractionalQty,
            qty: 0,
            currentStock: item.qty,
            toWarehouseId: null,
            reason: ''
        };
    }

    private compareByCodigoThenName(a: Product, b: Product): number {
        const codeA = (a.codigo || '').trim();
        const codeB = (b.codigo || '').trim();
        if (codeA && codeB) {
            const byCode = codeA.localeCompare(codeB, 'es', { numeric: true, sensitivity: 'base' });
            if (byCode !== 0) return byCode;
        } else if (codeA) {
            return -1;
        } else if (codeB) {
            return 1;
        }
        return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
    }

    private compareStockItemsByCodigoThenName(a: StockItem, b: StockItem): number {
        const codeA = (a.product.codigo || '').trim();
        const codeB = (b.product.codigo || '').trim();
        if (codeA && codeB) {
            const byCode = codeA.localeCompare(codeB, 'es', { numeric: true, sensitivity: 'base' });
            if (byCode !== 0) return byCode;
        } else if (codeA) {
            return -1;
        } else if (codeB) {
            return 1;
        }
        return (a.product.name || '').localeCompare(b.product.name || '', 'es', { sensitivity: 'base' });
    }

    private normalizeQty(value: unknown, allowFractional: boolean): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        if (allowFractional) return Number(parsed.toFixed(2));
        return Math.floor(parsed);
    }
}
