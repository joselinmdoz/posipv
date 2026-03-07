import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { forkJoin } from 'rxjs';
import { Product, ProductsService } from '@/app/core/services/products.service';
import {
    CreatePurchaseDto,
    PurchaseDetail,
    PurchaseItemInput,
    PurchaseStatus,
    PurchaseSummary,
    PurchasesService
} from '@/app/core/services/purchases.service';
import { SettingsService, SystemCurrencyCode } from '@/app/core/services/settings.service';
import { Warehouse, WarehousesService } from '@/app/core/services/warehouses.service';

interface PurchaseFormLine {
    rowId: number;
    productId: string;
    qty: number | null;
    cost: number | null;
}

@Component({
    selector: 'app-purchases',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        CardModule,
        ConfirmDialogModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        TableModule,
        TagModule,
        ToastModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <div class="p-4">
            <div class="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                    <h1 class="text-2xl font-bold m-0">Compras</h1>
                    <p class="m-0 mt-1 text-sm text-gray-600">Registro y gestión de compras con impacto automático en inventario.</p>
                </div>
                <div class="flex gap-2">
                    <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadPurchases()" />
                    <p-button label="Nueva compra" icon="pi pi-plus" (onClick)="openNewPurchase()" />
                </div>
            </div>

            <p-card class="mb-4">
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                    <div class="xl:col-span-2">
                        <label class="block mb-2">Buscar</label>
                        <input pInputText [(ngModel)]="filters.q" class="w-full" placeholder="Proveedor, documento o nota" />
                    </div>
                    <div>
                        <label class="block mb-2">Almacén</label>
                        <p-select
                            [options]="warehouseFilterOptions()"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="filters.warehouseId"
                            [appendTo]="'body'"
                            class="w-full"
                            [showClear]="true"
                        />
                    </div>
                    <div>
                        <label class="block mb-2">Estado</label>
                        <p-select
                            [options]="statusFilterOptions"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="filters.status"
                            [appendTo]="'body'"
                            class="w-full"
                            [showClear]="true"
                        />
                    </div>
                    <div>
                        <label class="block mb-2">Desde</label>
                        <input pInputText type="date" [(ngModel)]="filters.from" class="w-full" />
                    </div>
                    <div>
                        <label class="block mb-2">Hasta</label>
                        <input pInputText type="date" [(ngModel)]="filters.to" class="w-full" />
                    </div>
                </div>
                <div class="flex gap-2 mt-3">
                    <p-button label="Aplicar filtros" icon="pi pi-search" (onClick)="loadPurchases()" />
                    <p-button label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" (onClick)="clearFilters()" />
                </div>
            </p-card>

            <p-table [value]="purchases()" [rows]="10" [paginator]="true" dataKey="id" currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} compras">
                <ng-template #header>
                    <tr>
                        <th>Fecha</th>
                        <th>Documento</th>
                        <th>Proveedor</th>
                        <th>Almacén</th>
                        <th>Estado</th>
                        <th class="text-right">Total</th>
                        <th>Creador</th>
                        <th class="text-center">Acciones</th>
                    </tr>
                </ng-template>
                <ng-template #body let-row>
                    <tr>
                        <td>{{ formatDateTime(row.createdAt) }}</td>
                        <td>{{ row.documentNumber || '-' }}</td>
                        <td>
                            <div>{{ row.supplierName || '-' }}</div>
                            <div class="text-xs text-gray-500">{{ row.supplierDocument || '' }}</div>
                        </td>
                        <td>{{ row.warehouse?.name || '-' }}</td>
                        <td><p-tag [value]="statusLabel(row.status)" [severity]="statusSeverity(row.status)" /></td>
                        <td class="text-right whitespace-nowrap">{{ formatMoney(row.total, row.currency) }}</td>
                        <td>{{ row.createdBy?.email || '-' }}</td>
                        <td class="text-center">
                            <div class="flex justify-center gap-1">
                                <p-button icon="pi pi-eye" [rounded]="true" [text]="true" severity="secondary" (onClick)="openDetail(row)" />
                                @if (row.status === 'DRAFT') {
                                    <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="help" (onClick)="editPurchase(row)" />
                                    <p-button icon="pi pi-check" [rounded]="true" [text]="true" severity="success" (onClick)="confirmPurchase(row)" />
                                    <p-button icon="pi pi-trash" [rounded]="true" [text]="true" severity="danger" (onClick)="deletePurchase(row)" />
                                } @else if (row.status === 'CONFIRMED') {
                                    <p-button icon="pi pi-ban" [rounded]="true" [text]="true" severity="danger" (onClick)="voidPurchase(row)" />
                                }
                            </div>
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="8" class="text-center py-4 text-gray-500">No hay compras registradas.</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog
            [header]="editingPurchaseId ? 'Editar compra (borrador)' : 'Nueva compra'"
            [(visible)]="purchaseDialog"
            [modal]="true"
            [style]="{ width: '1100px' }"
            [breakpoints]="{ '1400px': '96vw', '960px': '98vw' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
                <div>
                    <label class="block mb-2">Almacén *</label>
                    <p-select
                        [options]="warehouseOptions()"
                        optionLabel="label"
                        optionValue="value"
                        [(ngModel)]="form.warehouseId"
                        [appendTo]="'body'"
                        class="w-full"
                    />
                </div>
                <div>
                    <label class="block mb-2">Moneda</label>
                    <p-select
                        [options]="currencyOptions"
                        optionLabel="label"
                        optionValue="value"
                        [(ngModel)]="form.currency"
                        [appendTo]="'body'"
                        class="w-full"
                    />
                </div>
                <div>
                    <label class="block mb-2">No. Documento</label>
                    <input pInputText [(ngModel)]="form.documentNumber" class="w-full" placeholder="Opcional" />
                </div>
                <div>
                    <label class="block mb-2">Proveedor</label>
                    <input pInputText [(ngModel)]="form.supplierName" class="w-full" placeholder="Opcional" />
                </div>
                <div>
                    <label class="block mb-2">Documento proveedor</label>
                    <input pInputText [(ngModel)]="form.supplierDocument" class="w-full" placeholder="Opcional" />
                </div>
                <div class="md:col-span-2 xl:col-span-3">
                    <label class="block mb-2">Nota</label>
                    <input pInputText [(ngModel)]="form.note" class="w-full" placeholder="Opcional" />
                </div>
            </div>

            <div class="border rounded-lg p-2">
                <div class="flex items-center justify-between mb-2">
                    <div class="font-semibold">Productos de la compra</div>
                    <p-button label="Agregar línea" icon="pi pi-plus" size="small" severity="secondary" [outlined]="true" (onClick)="addLine()" />
                </div>
                <p-table [value]="form.lines">
                    <ng-template #header>
                        <tr>
                            <th>Producto</th>
                            <th class="text-right">Cantidad</th>
                            <th class="text-right">Costo</th>
                            <th class="text-right">Subtotal</th>
                            <th class="text-center">Acción</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-line let-i="rowIndex">
                        <tr>
                            <td>
                                <p-select
                                    [options]="productOptions()"
                                    optionLabel="label"
                                    optionValue="value"
                                    [(ngModel)]="line.productId"
                                    [appendTo]="'body'"
                                    class="w-full"
                                    [filter]="true"
                                    filterBy="label"
                                    (onChange)="onLineProductChange(i)"
                                />
                            </td>
                            <td class="text-right">
                                <p-inputnumber
                                    [(ngModel)]="line.qty"
                                    [min]="1"
                                    [maxFractionDigits]="0"
                                    mode="decimal"
                                    inputStyleClass="w-full text-right"
                                />
                            </td>
                            <td class="text-right">
                                <p-inputnumber
                                    [(ngModel)]="line.cost"
                                    [min]="0.01"
                                    [maxFractionDigits]="2"
                                    mode="decimal"
                                    inputStyleClass="w-full text-right"
                                />
                            </td>
                            <td class="text-right whitespace-nowrap">{{ formatMoney(lineSubtotal(line), form.currency) }}</td>
                            <td class="text-center">
                                <p-button icon="pi pi-trash" [text]="true" severity="danger" [disabled]="form.lines.length <= 1" (onClick)="removeLine(i)" />
                            </td>
                        </tr>
                    </ng-template>
                </p-table>
            </div>

            <div class="flex justify-end mt-3 text-lg">
                <span>Total: <strong>{{ formatMoney(formTotal(), form.currency) }}</strong></span>
            </div>

            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hidePurchaseDialog()" />
                <p-button label="Guardar borrador" icon="pi pi-save" severity="secondary" [outlined]="true" [loading]="saving" (onClick)="savePurchase('DRAFT')" />
                <p-button label="Guardar y confirmar" icon="pi pi-check" [loading]="saving" (onClick)="savePurchase('CONFIRMED')" />
            </ng-template>
        </p-dialog>

        <p-dialog
            header="Detalle de compra"
            [(visible)]="detailDialog"
            [modal]="true"
            [style]="{ width: '1100px' }"
            [breakpoints]="{ '1400px': '96vw', '960px': '98vw' }"
            [draggable]="false"
            [resizable]="false"
        >
            @if (selectedDetail) {
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 mb-3 text-sm">
                    <div><b>Fecha:</b> {{ formatDateTime(selectedDetail.createdAt) }}</div>
                    <div><b>Documento:</b> {{ selectedDetail.documentNumber || '-' }}</div>
                    <div><b>Estado:</b> {{ statusLabel(selectedDetail.status) }}</div>
                    <div><b>Almacén:</b> {{ selectedDetail.warehouse?.name || '-' }}</div>
                    <div><b>Proveedor:</b> {{ selectedDetail.supplierName || '-' }}</div>
                    <div><b>Doc. proveedor:</b> {{ selectedDetail.supplierDocument || '-' }}</div>
                    <div><b>Creador:</b> {{ selectedDetail.createdBy?.email || '-' }}</div>
                    <div><b>Total:</b> {{ formatMoney(selectedDetail.total, selectedDetail.currency) }}</div>
                    <div class="md:col-span-2 xl:col-span-4"><b>Nota:</b> {{ selectedDetail.note || '-' }}</div>
                </div>

                <p-table [value]="selectedDetail.items">
                    <ng-template #header>
                        <tr>
                            <th>Producto</th>
                            <th>Código</th>
                            <th class="text-right">Cant.</th>
                            <th class="text-right">Costo</th>
                            <th class="text-right">Subtotal</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-item>
                        <tr>
                            <td>{{ item.product?.name || '-' }}</td>
                            <td>{{ item.product?.codigo || item.product?.barcode || '-' }}</td>
                            <td class="text-right">{{ item.qty }}</td>
                            <td class="text-right whitespace-nowrap">{{ formatMoney(item.cost, selectedDetail.currency) }}</td>
                            <td class="text-right whitespace-nowrap">{{ formatMoney(item.total, selectedDetail.currency) }}</td>
                        </tr>
                    </ng-template>
                </p-table>
            }
            <ng-template #footer>
                <p-button label="Cerrar" icon="pi pi-times" text (onClick)="detailDialog = false" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Purchases implements OnInit {
    purchases = signal<PurchaseSummary[]>([]);
    warehouses = signal<Warehouse[]>([]);
    products = signal<Product[]>([]);
    defaultCurrency: SystemCurrencyCode = 'CUP';
    saving = false;
    purchaseDialog = false;
    detailDialog = false;
    editingPurchaseId: string | null = null;
    selectedDetail: PurchaseDetail | null = null;
    private lineSeed = 1;

    readonly currencyOptions = [
        { label: 'CUP', value: 'CUP' as SystemCurrencyCode },
        { label: 'USD', value: 'USD' as SystemCurrencyCode }
    ];

    readonly statusFilterOptions: Array<{ label: string; value: PurchaseStatus | null }> = [
        { label: 'Todos', value: null },
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmada', value: 'CONFIRMED' },
        { label: 'Anulada', value: 'VOID' }
    ];

    filters: {
        q: string;
        warehouseId: string | null;
        status: PurchaseStatus | null;
        from: string;
        to: string;
    } = {
        q: '',
        warehouseId: null,
        status: null,
        from: '',
        to: ''
    };

    form: {
        warehouseId: string;
        supplierName: string;
        supplierDocument: string;
        documentNumber: string;
        note: string;
        currency: SystemCurrencyCode;
        lines: PurchaseFormLine[];
    } = this.buildEmptyForm();

    constructor(
        private readonly purchasesService: PurchasesService,
        private readonly warehousesService: WarehousesService,
        private readonly productsService: ProductsService,
        private readonly settingsService: SettingsService,
        private readonly messageService: MessageService,
        private readonly confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadCatalogAndPurchases();
    }

    loadCatalogAndPurchases() {
        forkJoin({
            warehouses: this.warehousesService.listWarehouses(),
            products: this.productsService.list(),
            settings: this.settingsService.getSystemSettings()
        }).subscribe({
            next: ({ warehouses, products, settings }) => {
                this.warehouses.set((warehouses || []).filter((w) => w.active));
                this.products.set((products || []).filter((p) => p.active));
                this.defaultCurrency = settings?.defaultCurrency || 'CUP';
                this.form.currency = this.defaultCurrency;
                this.loadPurchases();
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar catálogos para compras.'
                });
            }
        });
    }

    loadPurchases() {
        this.purchasesService
            .list({
                q: this.filters.q?.trim() || undefined,
                warehouseId: this.filters.warehouseId || undefined,
                status: this.filters.status || undefined,
                from: this.filters.from || undefined,
                to: this.filters.to || undefined,
                limit: 500
            })
            .subscribe({
                next: (rows) => this.purchases.set(rows || []),
                error: (e) =>
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: e?.error?.message || 'No se pudo cargar el listado de compras.'
                    })
            });
    }

    clearFilters() {
        this.filters = { q: '', warehouseId: null, status: null, from: '', to: '' };
        this.loadPurchases();
    }

    warehouseOptions() {
        return this.warehouses().map((w) => ({
            label: `${w.name} (${w.code})`,
            value: w.id
        }));
    }

    warehouseFilterOptions() {
        return [{ label: 'Todos', value: null }, ...this.warehouseOptions()];
    }

    productOptions() {
        return this.products()
            .map((p) => ({
                label: `${p.name}${p.codigo ? ` (${p.codigo})` : ''} - ${this.formatMoney(p.cost ?? p.price, p.currency || this.defaultCurrency)}`,
                value: p.id
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }

    openNewPurchase() {
        this.editingPurchaseId = null;
        this.form = this.buildEmptyForm();
        if (!this.form.warehouseId) {
            this.form.warehouseId = this.warehouses()[0]?.id || '';
        }
        this.form.currency = this.defaultCurrency;
        this.purchaseDialog = true;
    }

    hidePurchaseDialog() {
        this.purchaseDialog = false;
        this.editingPurchaseId = null;
        this.saving = false;
    }

    addLine() {
        this.form.lines.push({ rowId: this.lineSeed++, productId: '', qty: 1, cost: null });
    }

    removeLine(index: number) {
        if (this.form.lines.length <= 1) return;
        this.form.lines.splice(index, 1);
    }

    onLineProductChange(index: number) {
        const line = this.form.lines[index];
        if (!line?.productId) return;
        const product = this.products().find((p) => p.id === line.productId);
        if (!product) return;
        if (!line.cost || line.cost <= 0) {
            line.cost = Number(product.cost ?? product.price ?? 0);
        }
    }

    lineSubtotal(line: PurchaseFormLine) {
        const qty = Number(line.qty || 0);
        const cost = Number(line.cost || 0);
        return qty * cost;
    }

    formTotal() {
        return this.form.lines.reduce((sum, line) => sum + this.lineSubtotal(line), 0);
    }

    savePurchase(status: PurchaseStatus) {
        const payload = this.buildPayload(status);
        if (!payload) return;
        this.saving = true;

        if (this.editingPurchaseId) {
            this.purchasesService
                .update(this.editingPurchaseId, payload)
                .subscribe({
                    next: () => {
                        if (status === 'CONFIRMED') {
                            this.purchasesService.confirm(this.editingPurchaseId!).subscribe({
                                next: () => this.onSaveSuccess('Compra confirmada correctamente'),
                                error: (e) => this.onSaveError(e?.error?.message || 'No se pudo confirmar la compra')
                            });
                            return;
                        }
                        this.onSaveSuccess('Borrador de compra actualizado');
                    },
                    error: (e) => this.onSaveError(e?.error?.message || 'No se pudo actualizar la compra')
                });
            return;
        }

        this.purchasesService
            .create({ ...payload, status })
            .subscribe({
                next: () => this.onSaveSuccess(status === 'CONFIRMED' ? 'Compra registrada y confirmada' : 'Compra guardada como borrador'),
                error: (e) => this.onSaveError(e?.error?.message || 'No se pudo registrar la compra')
            });
    }

    private onSaveSuccess(detail: string) {
        this.saving = false;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail });
        this.hidePurchaseDialog();
        this.loadPurchases();
    }

    private onSaveError(detail: string) {
        this.saving = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
    }

    private buildPayload(status: PurchaseStatus): CreatePurchaseDto | null {
        if (!this.form.warehouseId) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Seleccione un almacén.' });
            return null;
        }

        const items: PurchaseItemInput[] = [];
        const repeated = new Set<string>();
        for (const line of this.form.lines) {
            if (!line.productId) {
                this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Todas las líneas deben tener producto.' });
                return null;
            }
            const qty = Number(line.qty || 0);
            const cost = Number(line.cost || 0);
            if (!Number.isInteger(qty) || qty <= 0) {
                this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'La cantidad debe ser un entero mayor que 0.' });
                return null;
            }
            if (!Number.isFinite(cost) || cost <= 0) {
                this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'El costo debe ser mayor que 0.' });
                return null;
            }
            if (repeated.has(line.productId)) {
                this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'No repita el mismo producto en varias líneas.' });
                return null;
            }
            repeated.add(line.productId);
            items.push({
                productId: line.productId,
                qty,
                cost
            });
        }

        return {
            warehouseId: this.form.warehouseId,
            supplierName: this.form.supplierName?.trim() || undefined,
            supplierDocument: this.form.supplierDocument?.trim() || undefined,
            documentNumber: this.form.documentNumber?.trim() || undefined,
            note: this.form.note?.trim() || undefined,
            currency: this.form.currency,
            status,
            items
        };
    }

    editPurchase(row: PurchaseSummary) {
        if (row.status !== 'DRAFT') {
            this.messageService.add({ severity: 'warn', summary: 'No permitido', detail: 'Solo se pueden editar compras en borrador.' });
            return;
        }

        this.purchasesService.findOne(row.id).subscribe({
            next: (detail) => {
                this.editingPurchaseId = detail.id;
                this.form = {
                    warehouseId: detail.warehouseId,
                    supplierName: detail.supplierName || '',
                    supplierDocument: detail.supplierDocument || '',
                    documentNumber: detail.documentNumber || '',
                    note: detail.note || '',
                    currency: detail.currency,
                    lines: (detail.items || []).map((item) => ({
                        rowId: this.lineSeed++,
                        productId: item.productId,
                        qty: item.qty,
                        cost: Number(item.cost)
                    }))
                };
                if (!this.form.lines.length) this.addLine();
                this.purchaseDialog = true;
            },
            error: () =>
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar la compra para edición.'
                })
        });
    }

    openDetail(row: PurchaseSummary) {
        this.purchasesService.findOne(row.id).subscribe({
            next: (detail) => {
                this.selectedDetail = detail;
                this.detailDialog = true;
            },
            error: () =>
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar el detalle de la compra.'
                })
        });
    }

    confirmPurchase(row: PurchaseSummary) {
        if (row.status !== 'DRAFT') return;
        this.confirmationService.confirm({
            message: `¿Confirmar la compra ${row.documentNumber || row.id.slice(0, 8)}?`,
            header: 'Confirmar compra',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.purchasesService.confirm(row.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Compra confirmada.' });
                        this.loadPurchases();
                    },
                    error: (e) =>
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: e?.error?.message || 'No se pudo confirmar la compra.'
                        })
                });
            }
        });
    }

    voidPurchase(row: PurchaseSummary) {
        const reason = window.prompt('Motivo de anulación (opcional):') || undefined;
        this.confirmationService.confirm({
            message: `¿Anular la compra ${row.documentNumber || row.id.slice(0, 8)}?`,
            header: 'Anular compra',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.purchasesService.void(row.id, reason).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Compra anulada.' });
                        this.loadPurchases();
                    },
                    error: (e) =>
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: e?.error?.message || 'No se pudo anular la compra.'
                        })
                });
            }
        });
    }

    deletePurchase(row: PurchaseSummary) {
        if (row.status !== 'DRAFT') {
            this.messageService.add({ severity: 'warn', summary: 'No permitido', detail: 'Solo se pueden eliminar compras en borrador.' });
            return;
        }
        this.confirmationService.confirm({
            message: `¿Eliminar el borrador ${row.documentNumber || row.id.slice(0, 8)}?`,
            header: 'Eliminar borrador',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.purchasesService.delete(row.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Borrador eliminado.' });
                        this.loadPurchases();
                    },
                    error: (e) =>
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: e?.error?.message || 'No se pudo eliminar el borrador.'
                        })
                });
            }
        });
    }

    statusLabel(status: PurchaseStatus) {
        if (status === 'DRAFT') return 'Borrador';
        if (status === 'CONFIRMED') return 'Confirmada';
        return 'Anulada';
    }

    statusSeverity(status: PurchaseStatus): 'success' | 'warn' | 'danger' | 'secondary' {
        if (status === 'DRAFT') return 'warn';
        if (status === 'CONFIRMED') return 'success';
        return 'danger';
    }

    formatMoney(value: string | number | null | undefined, currency: SystemCurrencyCode) {
        const amount = Number(value || 0);
        const symbol = currency === 'USD' ? 'USD' : 'CUP';
        return `${symbol} ${amount.toFixed(2)}`;
    }

    formatDateTime(value: string | null | undefined) {
        if (!value) return '-';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '-';
        return new Intl.DateTimeFormat('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(d);
    }

    private buildEmptyForm() {
        return {
            warehouseId: '',
            supplierName: '',
            supplierDocument: '',
            documentNumber: '',
            note: '',
            currency: this.defaultCurrency,
            lines: [{ rowId: this.lineSeed++, productId: '', qty: 1, cost: null }]
        };
    }
}
