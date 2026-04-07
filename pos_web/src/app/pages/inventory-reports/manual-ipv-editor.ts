import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Product, ProductsService } from '@/app/core/services/products.service';
import {
    InventoryReportsService,
    ManualIvpBootstrap,
    ManualIvpLine,
    ManualIvpPaymentMethodOption,
    ManualIvpRegisterOption,
    SaveManualIvpPayload
} from '@/app/core/services/inventory-reports.service';

type EditableManualLine = ManualIvpLine & {
    entries: number;
    outs: number;
    sales: number;
    cost: number;
    computedGain: number;
};

@Component({
    selector: 'app-manual-ipv-editor',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        CardModule,
        DatePickerModule,
        DialogModule,
        InputNumberModule,
        MultiSelectModule,
        SelectModule,
        TableModule,
        TagModule,
        ToastModule
    ],
    providers: [MessageService],
    template: `
        <div class="p-4 flex flex-col gap-4">
            <p-toast />

            <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 class="text-2xl font-bold m-0">IPV Manual de TPV</h3>
                </div>
                <div class="flex items-center gap-2">
                    <p-button label="Volver" icon="pi pi-arrow-left" severity="secondary" [outlined]="true" (onClick)="goBack()" />
                    <p-button
                        label="Guardar IPV manual"
                        icon="pi pi-save"
                        [loading]="saving()"
                        [disabled]="saving() || loadingBootstrap() || !canSave()"
                        (onClick)="saveManualIvp()"
                    />
                </div>
            </div>

            <p-card>
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
                    <div class="flex flex-col gap-2 xl:col-span-4">
                        <label>TPV *</label>
                        <p-select
                            [options]="registerOptions()"
                            [(ngModel)]="selectedRegisterId"
                            optionLabel="label"
                            optionValue="value"
                            [filter]="true"
                            appendTo="body"
                            placeholder="Seleccione TPV"
                            (ngModelChange)="onHeaderFiltersChanged()"
                        />
                    </div>

                    <div class="flex flex-col gap-2 xl:col-span-3">
                        <label>Fecha del IPV *</label>
                        <p-datepicker
                            [(ngModel)]="selectedReportDate"
                            dateFormat="dd-mm-yy"
                            [showIcon]="true"
                            [maxDate]="today"
                            (onSelect)="onHeaderFiltersChanged()"
                            styleClass="w-full"
                        />
                    </div>

                    <div class="flex flex-col gap-2 md:col-span-2 xl:col-span-5">
                        <label>Empleados que trabajaron</label>
                        <p-multiselect
                            [options]="employeeOptions()"
                            [(ngModel)]="selectedEmployeeIds"
                            optionLabel="label"
                            optionValue="value"
                            appendTo="body"
                            defaultLabel="Seleccione empleados"
                            display="chip"
                            [filter]="true"
                        />
                    </div>
                </div>

                <div class="mt-3">
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div class="font-semibold text-color">Desglose por métodos de pago</div>
                        @if (bootstrapState()?.editing) {
                            <p-tag value="Editando IPV existente" severity="contrast" />
                        } @else {
                            <p-tag value="Nuevo IPV manual" severity="success" />
                        }
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        @for (method of paymentMethods(); track method.code) {
                            <div class="flex flex-col gap-2">
                                <label>{{ method.name }}</label>
                                <p-inputnumber
                                    [(ngModel)]="paymentBreakdown[method.code]"
                                    (ngModelChange)="onPaymentBreakdownChange()"
                                    [min]="0"
                                    [minFractionDigits]="0"
                                    [maxFractionDigits]="2"
                                    [useGrouping]="false"
                                    locale="es-ES"
                                />
                            </div>
                        }
                    </div>
                    <div class="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                        <div class="px-3 py-2 surface-100 border-round">
                            <span class="text-color-secondary">Importe total:</span>
                            <strong class="ml-1">{{ formatMoney(totalAmount(), totalsCurrency()) }}</strong>
                        </div>
                        <div class="px-3 py-2 surface-100 border-round">
                            <span class="text-color-secondary">Pagos ingresados:</span>
                            <strong class="ml-1">{{ formatMoney(paymentEnteredTotal(), totalsCurrency()) }}</strong>
                        </div>
                        <div class="px-3 py-2 border-round" [ngClass]="paymentDifference() === 0 ? 'surface-100' : 'surface-200 text-red-700'">
                            <span class="text-color-secondary">Diferencia:</span>
                            <strong class="ml-1">{{ formatSignedMoney(paymentDifference(), totalsCurrency()) }}</strong>
                        </div>
                    </div>
                </div>
            </p-card>

            <p-card>
                <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-bottom-1 surface-border">
                    <span class="font-bold text-color">Productos del IPV manual</span>
                    <p-button
                        label="Agregar producto"
                        icon="pi pi-plus"
                        [disabled]="loadingBootstrap() || loadingProducts()"
                        (onClick)="openAddProductDialog()"
                    />
                </div>

                <p-table
                    [value]="lines()"
                    [paginator]="true"
                    [rows]="20"
                    [rowsPerPageOptions]="[20, 50, 100]"
                    responsiveLayout="scroll"
                    [scrollable]="true"
                    scrollHeight="58vh"
                    styleClass="p-datatable-sm"
                    [tableStyle]="{ 'min-width': '100rem', 'table-layout': 'fixed', 'width': '100%' }"
                >
                    <ng-template pTemplate="header">
                        <tr>
                            <th style="width: 150px;">Código</th>
                            <th style="width: 260px;">Nombre</th>
                            <th class="text-right" style="width: 120px;">Inicio</th>
                            <th style="width: 120px;">Entradas</th>
                            <th style="width: 120px;">Salidas</th>
                            <th style="width: 120px;">Ventas</th>
                            <th class="text-right" style="width: 120px;">Final</th>
                            <th class="text-right" style="width: 120px;">Precio venta</th>
                            <th class="text-right" style="width: 130px;">Importe</th>
                            <th class="text-right" style="width: 110px;">Ganancia (uds)</th>
                            <th class="text-right" style="width: 130px;">Ganancia real</th>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-line>
                        <tr>
                            <td>{{ line.codigo || '-' }}</td>
                            <td>
                                <div class="font-medium">{{ line.name }}</div>
                                @if (line.allowFractionalQty) {
                                    <small class="text-color-secondary">Admite fracciones</small>
                                }
                            </td>
                            <td class="text-right">{{ formatQty(line.initial, line.allowFractionalQty) }}</td>
                            <td>
                                <p-inputnumber
                                    [(ngModel)]="line.entries"
                                    (ngModelChange)="onLineQtyChange(line, 'entries', $event)"
                                    [style]="{ width: '100%' }"
                                    [inputStyle]="{ width: '100%', minWidth: '0' }"
                                    [min]="0"
                                    [step]="line.allowFractionalQty ? 0.01 : 1"
                                    [minFractionDigits]="0"
                                    [maxFractionDigits]="line.allowFractionalQty ? 2 : 0"
                                    [useGrouping]="false"
                                    locale="es-ES"
                                    styleClass="w-full"
                                />
                            </td>
                            <td>
                                <p-inputnumber
                                    [(ngModel)]="line.outs"
                                    (ngModelChange)="onLineQtyChange(line, 'outs', $event)"
                                    [style]="{ width: '100%' }"
                                    [inputStyle]="{ width: '100%', minWidth: '0' }"
                                    [min]="0"
                                    [step]="line.allowFractionalQty ? 0.01 : 1"
                                    [minFractionDigits]="0"
                                    [maxFractionDigits]="line.allowFractionalQty ? 2 : 0"
                                    [useGrouping]="false"
                                    locale="es-ES"
                                    styleClass="w-full"
                                />
                            </td>
                            <td>
                                <p-inputnumber
                                    [(ngModel)]="line.sales"
                                    (ngModelChange)="onLineQtyChange(line, 'sales', $event)"
                                    [style]="{ width: '100%' }"
                                    [inputStyle]="{ width: '100%', minWidth: '0' }"
                                    [min]="0"
                                    [step]="line.allowFractionalQty ? 0.01 : 1"
                                    [minFractionDigits]="0"
                                    [maxFractionDigits]="line.allowFractionalQty ? 2 : 0"
                                    [useGrouping]="false"
                                    locale="es-ES"
                                    styleClass="w-full"
                                />
                            </td>
                            <td class="text-right font-semibold">{{ formatQty(line.final, line.allowFractionalQty) }}</td>
                            <td class="text-right">{{ formatMoney(line.price, line.currency) }}</td>
                            <td class="text-right font-semibold">{{ formatMoney(line.amount, line.currency) }}</td>
                            <td class="text-right">{{ line.gp ? formatMoney(line.gp, line.currency) : '-' }}</td>
                            <td class="text-right font-semibold text-green-600">{{ formatMoney(line.computedGain, line.currency) }}</td>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="footer">
                        <tr>
                            <td colspan="10"></td>
                            <td class="text-right font-bold">{{ formatMoney(totalAmount(), totalsCurrency()) }}</td>
                            <td></td>
                        </tr>
                    </ng-template>
                    <ng-template pTemplate="emptymessage">
                        <tr><td colspan="11">No hay productos para mostrar.</td></tr>
                    </ng-template>
                </p-table>
            </p-card>

            <p-dialog
                header="Agregar producto al IPV"
                [(visible)]="showAddProductDialog"
                [modal]="true"
                [draggable]="false"
                [resizable]="false"
                [style]="{ width: '32rem' }"
                [breakpoints]="{ '640px': '96vw' }"
            >
                <div class="flex flex-col gap-3">
                    <p-select
                        [options]="addableProductOptions()"
                        [(ngModel)]="selectedProductToAddId"
                        optionLabel="label"
                        optionValue="value"
                        [filter]="true"
                        appendTo="body"
                        placeholder="Seleccione producto"
                        styleClass="w-full"
                    />
                    <small class="text-color-secondary">El producto se agrega con Inicio=0 y resto de cantidades en 0.</small>
                </div>
                <ng-template pTemplate="footer">
                    <div class="flex justify-end gap-2">
                        <p-button label="Cancelar" severity="secondary" [outlined]="true" (onClick)="closeAddProductDialog()" />
                        <p-button label="Agregar" icon="pi pi-check" [disabled]="!selectedProductToAddId" (onClick)="addSelectedProductToIpv()" />
                    </div>
                </ng-template>
            </p-dialog>
        </div>
    `
})
export class ManualIvpEditorComponent implements OnInit {
    private readonly ipvService = inject(InventoryReportsService);
    private readonly productsService = inject(ProductsService);
    private readonly router = inject(Router);
    private readonly messageService = inject(MessageService);

    readonly loadingBootstrap = signal(false);
    readonly loadingProducts = signal(false);
    readonly saving = signal(false);

    readonly registerRows = signal<ManualIvpRegisterOption[]>([]);
    readonly lines = signal<EditableManualLine[]>([]);
    readonly productsCatalog = signal<Product[]>([]);
    readonly bootstrapState = signal<ManualIvpBootstrap | null>(null);
    readonly paymentMethods = signal<ManualIvpPaymentMethodOption[]>([]);

    selectedRegisterId: string | null = null;
    selectedReportDate: Date | null = new Date();
    selectedEmployeeIds: string[] = [];
    paymentBreakdown: Record<string, number> = {};
    private readonly paymentBreakdownChanged = signal(0);
    note = '';
    showAddProductDialog = false;
    selectedProductToAddId: string | null = null;
    readonly today = new Date();

    readonly registerOptions = computed(() =>
        this.registerRows().map((row) => ({
            label: `${row.name} (${row.code})`,
            value: row.id
        }))
    );

    readonly employeeOptions = computed(() =>
        (this.bootstrapState()?.employees || []).map((employee) => ({
            label: employee.fullName || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.user?.email || employee.id,
            value: employee.id
        }))
    );

    readonly addableProductOptions = computed(() => {
        const currentIds = new Set(this.lines().map((line) => line.productId));
        return this.productsCatalog()
            .filter((product) => !currentIds.has(product.id))
            .map((product) => ({
                label: `${(product.codigo || '').trim() ? `${product.codigo} - ` : ''}${product.name} · ${this.formatMoney(product.price, product.currency || 'CUP')}`,
                value: product.id
            }))
            .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base', numeric: true }));
    });
    readonly totalEntries = computed(() => Number(this.lines().reduce((acc, line) => acc + Number(line.entries || 0), 0).toFixed(2)));
    readonly totalOuts = computed(() => Number(this.lines().reduce((acc, line) => acc + Number(line.outs || 0), 0).toFixed(2)));
    readonly totalAmount = computed(() => Number(this.lines().reduce((acc, line) => acc + Number(line.amount || 0), 0).toFixed(2)));
    readonly totalComputedGain = computed(() => Number(this.lines().reduce((acc, line) => acc + Number(line.computedGain || 0), 0).toFixed(2)));
    readonly totalsCurrency = computed(() => this.getSummaryCurrency());
    readonly paymentEnteredTotal = computed(() => {
        this.paymentBreakdownChanged();
        return this.getPaymentBreakdownTotal();
    });
    readonly paymentDifference = computed(() => Number((this.paymentEnteredTotal() - this.totalAmount()).toFixed(2)));

    ngOnInit(): void {
        this.loadProductsCatalog();
        this.loadRegisters();
    }

    goBack() {
        this.router.navigate(['/inventory-reports']);
    }

    onHeaderFiltersChanged() {
        if (!this.selectedRegisterId) return;
        this.loadBootstrap();
    }

    onPaymentBreakdownChange() {
        this.paymentBreakdownChanged.update((v) => v + 1);
    }

    openAddProductDialog() {
        if (this.addableProductOptions().length === 0) {
            this.messageService.add({
                severity: 'info',
                summary: 'Sin productos disponibles',
                detail: 'Todos los productos ya están incluidos en este IPV.'
            });
            return;
        }
        this.selectedProductToAddId = null;
        this.showAddProductDialog = true;
    }

    closeAddProductDialog() {
        this.showAddProductDialog = false;
        this.selectedProductToAddId = null;
    }

    addSelectedProductToIpv() {
        const productId = String(this.selectedProductToAddId || '').trim();
        if (!productId) return;

        const product = this.productsCatalog().find((item) => item.id === productId);
        if (!product) {
            this.messageService.add({ severity: 'warn', summary: 'Producto no encontrado', detail: 'Seleccione un producto válido.' });
            return;
        }
        if (this.lines().some((line) => line.productId === product.id)) {
            this.messageService.add({ severity: 'warn', summary: 'Producto ya agregado', detail: 'El producto ya existe en la tabla del IPV.' });
            return;
        }

        const newLine = this.recalculateLine({
            productId: product.id,
            codigo: (product.codigo || '').trim(),
            name: product.name,
            currency: product.currency || 'CUP',
            allowFractionalQty: product.allowFractionalQty === true,
            price: Number(product.price || 0),
            cost: product.cost != null ? Number(product.cost) : null as any,
            initial: 0,
            entries: 0,
            outs: 0,
            sales: 0,
            total: 0,
            final: 0,
            amount: 0,
            gp: product.cost !== undefined && product.cost !== null
                ? Number((Number(product.price || 0) - Number(product.cost || 0)).toFixed(2))
                : undefined,
            gain: 0,
            computedGain: 0
        });

        this.lines.update((rows) => [...rows, newLine].sort((a, b) => this.compareLinesByCodeAndName(a, b)));
        this.closeAddProductDialog();
        this.messageService.add({
            severity: 'success',
            summary: 'Producto agregado',
            detail: `Se agregó "${product.name}" con inicio en 0.`
        });
    }

    canSave() {
        if (!this.selectedRegisterId || !this.selectedReportDate) return false;
        return this.lines().length > 0;
    }

    calcTotal(line: EditableManualLine) {
        const initial = Number(line.initial || 0);
        const entries = Number(line.entries || 0);
        const outs = Number(line.outs || 0);
        return Number((initial + entries - outs).toFixed(3));
    }

    calcFinal(line: EditableManualLine) {
        return Number((this.calcTotal(line) - Number(line.sales || 0)).toFixed(3));
    }

    calcAmount(line: EditableManualLine) {
        return Number((Number(line.sales || 0) * Number(line.price || 0)).toFixed(2));
    }

    onLineQtyChange(line: EditableManualLine, field: 'entries' | 'outs' | 'sales', rawValue: unknown) {
        line[field] = this.normalizeEditableQty(rawValue);
        this.recalculateLine(line);
        this.lines.update((rows) => [...rows]);
    }

    formatMoney(value: unknown, currency?: string | null) {
        const amount = Number(value || 0);
        const safeCurrency = String(currency || 'CUP').toUpperCase() === 'USD' ? 'USD' : 'CUP';
        const formatter = new Intl.NumberFormat(safeCurrency === 'USD' ? 'en-US' : 'es-CU', {
            style: 'currency',
            currency: safeCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        return formatter.format(Number.isFinite(amount) ? amount : 0);
    }

    formatQty(value: unknown, allowFractional?: boolean) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric)) return '0';
        if (allowFractional) {
            const trimmed = numeric.toFixed(2).replace(/\.?0+$/, '');
            return trimmed === '' ? '0' : trimmed;
        }
        return `${Math.floor(numeric)}`;
    }

    formatQtyTotal(value: unknown) {
        const numeric = Number(value || 0);
        if (!Number.isFinite(numeric)) return '0';
        const trimmed = numeric.toFixed(2).replace(/\.?0+$/, '');
        return trimmed === '' ? '0' : trimmed;
    }

    saveManualIvp() {
        if (!this.canSave() || !this.selectedRegisterId || !this.selectedReportDate) {
            this.messageService.add({ severity: 'warn', summary: 'Validación', detail: 'Complete TPV, fecha y líneas del IPV.' });
            return;
        }

        const enteredPaymentTotal = this.getPaymentBreakdownTotal();
        const reportAmountTotal = this.totalAmount();
        const paymentDifference = Number((enteredPaymentTotal - reportAmountTotal).toFixed(2));
        if (Math.abs(paymentDifference) > 0.009) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Métodos de pago no cuadran',
                detail: `El total por métodos de pago (${this.formatMoney(enteredPaymentTotal, this.totalsCurrency())}) no coincide con el importe total (${this.formatMoney(reportAmountTotal, this.totalsCurrency())}). Diferencia: ${this.formatSignedMoney(paymentDifference, this.totalsCurrency())}.`
            });
            return;
        }

        const payload: SaveManualIvpPayload = {
            registerId: this.selectedRegisterId,
            reportDate: this.formatDateYmd(this.selectedReportDate),
            note: this.note?.trim() || undefined,
            employeeIds: this.selectedEmployeeIds,
            paymentBreakdown: this.paymentBreakdown,
            lines: this.lines().map((line) => ({
                productId: line.productId,
                initial: Number(line.initial || 0),
                entries: Number(line.entries || 0),
                outs: Number(line.outs || 0),
                sales: Number(line.sales || 0)
            }))
        };

        const editingId = this.bootstrapState()?.existingReportId || null;
        const request$ = editingId
            ? this.ipvService.updateManual(editingId, payload)
            : this.ipvService.saveManual(payload);

        this.saving.set(true);
        request$.subscribe({
            next: (saved) => {
                this.saving.set(false);
                this.messageService.add({
                    severity: 'success',
                    summary: 'IPV manual guardado',
                    detail: editingId ? 'El IPV manual fue actualizado correctamente.' : 'El IPV manual fue creado correctamente.'
                });
                this.note = saved.note || '';
                this.selectedEmployeeIds = [...(saved.employeeIds || [])];
                this.paymentBreakdown = { ...(saved.paymentBreakdown || {}) };
                this.onPaymentBreakdownChange();
                this.lines.set(
                    (saved.lines || []).map((line) => ({
                        ...line,
                        entries: Number(line.entries || 0),
                        outs: Number(line.outs || 0),
                        sales: Number(line.sales || 0),
                        cost: line.cost != null ? Number(line.cost) : null as any,
                        computedGain: 0
                    })).map((line) => this.recalculateLine(line))
                );
                this.loadBootstrap();
            },
            error: (err) => {
                this.saving.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo guardar el IPV manual.'
                });
            }
        });
    }

    private loadRegisters() {
        this.ipvService.listManualRegisters().subscribe({
            next: (rows) => {
                this.registerRows.set(rows || []);
                if (!this.selectedRegisterId && rows.length > 0) {
                    this.selectedRegisterId = rows[0].id;
                }
                if (this.selectedRegisterId) {
                    this.loadBootstrap();
                }
            },
            error: () => {
                this.registerRows.set([]);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar los TPV para IPV manual.'
                });
            }
        });
    }

    private loadProductsCatalog() {
        this.loadingProducts.set(true);
        this.productsService.list().subscribe({
            next: (products) => {
                this.loadingProducts.set(false);
                this.productsCatalog.set((products || []).filter((product) => product.active !== false));
            },
            error: () => {
                this.loadingProducts.set(false);
                this.productsCatalog.set([]);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar el catálogo de productos.'
                });
            }
        });
    }

    private loadBootstrap() {
        if (!this.selectedRegisterId) return;
        const reportDate = this.selectedReportDate ? this.formatDateYmd(this.selectedReportDate) : this.formatDateYmd(new Date());

        this.loadingBootstrap.set(true);
        this.ipvService.getManualBootstrap(this.selectedRegisterId, reportDate).subscribe({
            next: (bootstrap) => {
                this.loadingBootstrap.set(false);
                this.bootstrapState.set(bootstrap);
                this.paymentMethods.set(bootstrap.paymentMethods || []);
                this.selectedEmployeeIds = [...(bootstrap.selectedEmployeeIds || [])];
                this.paymentBreakdown = { ...(bootstrap.paymentBreakdown || {}) };
                this.note = bootstrap.note || '';
                this.onPaymentBreakdownChange();
                this.lines.set(
                    (bootstrap.lines || []).map((line) => ({
                        ...line,
                        entries: Number(line.entries || 0),
                        outs: Number(line.outs || 0),
                        sales: Number(line.sales || 0),
                        cost: line.cost != null ? Number(line.cost) : null as any,
                        computedGain: 0
                    })).map((line) => this.recalculateLine(line))
                );
            },
            error: (err) => {
                this.loadingBootstrap.set(false);
                this.bootstrapState.set(null);
                this.paymentMethods.set([]);
                this.lines.set([]);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo cargar la base del IPV manual.'
                });
            }
        });
    }

    private formatDateYmd(value: Date): string {
        const date = new Date(value);
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private getSummaryCurrency() {
        const currencies = Array.from(new Set(this.lines().map((line) => String(line.currency || 'CUP').toUpperCase())));
        if (currencies.length === 1 && currencies[0] === 'USD') return 'USD';
        return 'CUP';
    }

    private getPaymentBreakdownTotal() {
        const codes = this.paymentMethods().map((method) => String(method.code || '').trim()).filter(Boolean);
        if (!codes.length) return 0;
        return Number(codes.reduce((acc, code) => acc + Number(this.paymentBreakdown[code] || 0), 0).toFixed(2));
    }

    formatSignedMoney(value: number, currency?: string | null) {
        const numeric = Number(value || 0);
        if (numeric >= 0) return `+${this.formatMoney(numeric, currency)}`;
        return `-${this.formatMoney(Math.abs(numeric), currency)}`;
    }

    private normalizeEditableQty(value: unknown) {
        const parsed = Number(value ?? 0);
        if (!Number.isFinite(parsed) || parsed < 0) return 0;
        return parsed;
    }

    private recalculateLine(line: EditableManualLine): EditableManualLine {
        line.total = this.calcTotal(line);
        line.final = this.calcFinal(line);
        line.amount = this.calcAmount(line);
        // Recalcular gp (ganancia por unidad) PRIMERO, con chequeo nulo correcto
        if (line.cost != null && Number(line.price || 0) > 0) {
            line.gp = Number((Number(line.price) - Number(line.cost)).toFixed(2));
        }
        // Calcular computedGain usando el gp ya actualizado
        line.computedGain = this.calcComputedGain(line);
        return line;
    }

    private calcComputedGain(line: EditableManualLine): number {
        const salesQty = Number(line.sales || 0);
        const gp = Number(line.gp ?? 0);
        return Number((salesQty * gp).toFixed(2));
    }

    private compareLinesByCodeAndName(a: EditableManualLine, b: EditableManualLine) {
        const codeA = String(a.codigo || '').trim();
        const codeB = String(b.codigo || '').trim();
        if (codeA && codeB) {
            const byCode = codeA.localeCompare(codeB, 'es', { numeric: true, sensitivity: 'base' });
            if (byCode !== 0) return byCode;
        } else if (codeA) {
            return -1;
        } else if (codeB) {
            return 1;
        }
        return String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' });
    }
}
