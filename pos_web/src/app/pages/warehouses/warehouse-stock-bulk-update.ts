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
import { Warehouse, WarehousesService } from '@/app/core/services/warehouses.service';

type BulkStockRow = {
    productId: string;
    codigo: string;
    name: string;
    price: number;
    currency: 'CUP' | 'USD';
    allowFractionalQty: boolean;
    qty: number;
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
                    <h2 class="text-2xl font-semibold m-0">Carga Masiva de Stock</h2>
                    <p class="m-0 text-color-secondary">Registra entradas por producto en un solo flujo.</p>
                </div>
                <div class="flex gap-2">
                    <p-button label="Volver a almacenes" icon="pi pi-arrow-left" severity="secondary" [outlined]="true" (onClick)="goBack()" />
                    <p-button label="Guardar movimientos" icon="pi pi-save" [disabled]="saving() || !canSave()" [loading]="saving()" (onClick)="saveBulkUpdate()" />
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div class="flex flex-col gap-2">
                    <label class="font-medium">Almacén destino para todos</label>
                    <p-select
                        [options]="warehouseOptions()"
                        [(ngModel)]="globalWarehouseId"
                        optionLabel="label"
                        optionValue="value"
                        [showClear]="true"
                        placeholder="Seleccione almacén global"
                        appendTo="body"
                    />
                    <small class="text-color-secondary">Puedes sobrescribir por fila en la tabla.</small>
                </div>

                <div class="flex flex-col gap-2">
                    <label class="font-medium">Motivo global</label>
                    <input pInputText [(ngModel)]="globalReason" placeholder="Ej: Reposición general de inventario" />
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
                [tableStyle]="{ 'min-width': '72rem' }"
            >
                <ng-template #header>
                    <tr>
                        <th style="width: 150px;">Código</th>
                        <th style="width: 260px;">Nombre</th>
                        <th class="text-right" style="width: 140px;">Precio venta</th>
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
                        <td>
                            <p-inputnumber
                                [(ngModel)]="row.qty"
                                [min]="0"
                                [step]="row.allowFractionalQty ? 0.01 : 1"
                                [minFractionDigits]="0"
                                [maxFractionDigits]="row.allowFractionalQty ? 2 : 0"
                                locale="es-ES"
                                [useGrouping]="false"
                                inputStyleClass="w-full"
                                styleClass="w-full"
                            />
                        </td>
                        <td>
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
                        <td>
                            <input pInputText [(ngModel)]="row.reason" placeholder="Usar motivo global" class="w-full" />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr><td colspan="6">No hay productos para mostrar.</td></tr>
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

    searchTerm = '';
    globalWarehouseId: string | null = null;
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

    ngOnInit(): void {
        this.loadWarehouses();
        this.loadProducts();
    }

    goBack() {
        this.router.navigate(['/warehouses']);
    }

    canSave() {
        if (this.saving()) return false;
        return this.rows().some((row) => this.normalizeQty(row.qty, row.allowFractionalQty) > 0);
    }

    saveBulkUpdate() {
        if (this.saving()) return;

        const rows = this.rows();
        const payloads = rows
            .map((row) => {
                const qty = this.normalizeQty(row.qty, row.allowFractionalQty);
                if (qty <= 0) return null;

                const toWarehouseId = row.toWarehouseId || this.globalWarehouseId;
                const reason = (row.reason || '').trim() || (this.globalReason || '').trim() || 'Carga masiva de stock';

                return {
                    row,
                    movement: {
                        type: 'IN' as const,
                        productId: row.productId,
                        qty,
                        toWarehouseId: toWarehouseId || undefined,
                        reason
                    }
                };
            })
            .filter((item): item is NonNullable<typeof item> => !!item);

        if (!payloads.length) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Introduzca al menos una cantidad mayor a 0.' });
            return;
        }

        const missingWarehouse = payloads.filter((p) => !p.movement.toWarehouseId);
        if (missingWarehouse.length > 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Almacén requerido',
                detail: `Hay ${missingWarehouse.length} producto(s) sin almacén destino.`
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
                            summary: 'Carga completada',
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

    private mapProductToRow(product: Product): BulkStockRow {
        return {
            productId: product.id,
            codigo: (product.codigo || '').trim(),
            name: product.name,
            price: Number(product.price || 0),
            currency: String(product.currency || 'CUP').toUpperCase() === 'USD' ? 'USD' : 'CUP',
            allowFractionalQty: !!product.allowFractionalQty,
            qty: 0,
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

    private normalizeQty(value: unknown, allowFractional: boolean): number {
        const parsed = Number(value);
        if (!Number.isFinite(parsed) || parsed <= 0) return 0;
        if (allowFractional) return Number(parsed.toFixed(2));
        return Math.floor(parsed);
    }
}
