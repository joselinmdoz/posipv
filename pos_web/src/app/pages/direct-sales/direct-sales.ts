import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { DirectSaleProduct, DirectSaleTicket, DirectSalesService, PaymentMethodCode } from '@/app/core/services/direct-sales.service';
import { SettingsService, SystemCurrencyCode } from '@/app/core/services/settings.service';
import { Warehouse, WarehousesService } from '@/app/core/services/warehouses.service';
import { Customer, CustomerHistory, CustomersService } from '@/app/core/services/customers.service';

interface CartLine {
    productId: string;
    name: string;
    codigo?: string | null;
    price: number;
    qty: number;
    subtotal: number;
}

interface PaymentLine {
    id: number;
    method: PaymentMethodCode;
    currency: SystemCurrencyCode;
    amount: number | null;
}

interface NewCustomerForm {
    name: string;
    identification: string;
    phone: string;
    email: string;
    address: string;
}

@Component({
    selector: 'app-direct-sales',
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
        ToastModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <div class="p-4 direct-sales-page">
            <div class="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                    <h1 class="text-2xl font-bold m-0">Ventas Directas</h1>
                    <p class="m-0 mt-1 text-sm text-gray-600">Ventas desde almacenes no-TPV, sin apertura/cierre de caja.</p>
                </div>
                <div class="text-sm text-gray-600">
                    Monedas habilitadas: <strong>{{ enabledCurrencies.join(', ') }}</strong>
                    <span class="mx-2">|</span>
                    Tasa: <strong>1 USD = {{ exchangeRateUsdToCup }} CUP</strong>
                </div>
            </div>

            <p-card class="mb-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label class="block mb-2">Almacén</label>
                        <p-select
                            [options]="warehouseOptions"
                            [(ngModel)]="selectedWarehouseId"
                            placeholder="Seleccione almacén"
                            class="w-full"
                            (onChange)="onWarehouseChange()"
                        />
                    </div>
                    <div>
                        <label class="block mb-2">Cliente (opcional)</label>
                        <div class="border rounded p-3 bg-gray-50 min-h-16">
                            @if (selectedCustomer()) {
                                <div class="font-semibold">{{ selectedCustomer()!.name }}</div>
                                <div class="text-sm text-gray-600">
                                    ID: {{ selectedCustomer()!.identification }}
                                    <span class="mx-1">|</span>
                                    Compras: {{ selectedCustomer()!.purchasesCount }}
                                </div>
                            } @else {
                                <div class="text-sm text-gray-500">No hay cliente seleccionado para esta venta.</div>
                            }
                        </div>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <p-button label="Seleccionar cliente" icon="pi pi-user-plus" severity="secondary" [outlined]="true" (onClick)="openCustomerDialog()" />
                            <p-button
                                label="Quitar cliente"
                                icon="pi pi-times"
                                severity="danger"
                                [outlined]="true"
                                [disabled]="!selectedCustomer()"
                                (onClick)="clearSelectedCustomer()"
                            />
                        </div>
                    </div>
                </div>
            </p-card>

            <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div class="xl:col-span-2">
                    <p-card>
                        <div class="flex flex-wrap justify-between items-center gap-2 mb-3">
                            <h3 class="m-0 text-lg font-semibold">Productos disponibles</h3>
                            <div class="flex gap-2">
                                <p-button
                                    icon="pi pi-th-large"
                                    label="Cards"
                                    size="small"
                                    severity="secondary"
                                    [outlined]="productsViewMode !== 'cards'"
                                    (onClick)="setProductsViewMode('cards')"
                                />
                                <p-button
                                    icon="pi pi-table"
                                    label="Tabla"
                                    size="small"
                                    severity="secondary"
                                    [outlined]="productsViewMode !== 'table'"
                                    (onClick)="setProductsViewMode('table')"
                                />
                            </div>
                        </div>
                        <div class="mb-3">
                            <label class="block mb-2">Buscar producto</label>
                            <div class="tpv-search-wrap">
                                <i class="pi pi-search"></i>
                                <input
                                    pInputText
                                    [(ngModel)]="search"
                                    (input)="applyFilter()"
                                    class="w-full tpv-search-input"
                                    placeholder="Nombre, código o barcode"
                                />
                            </div>
                        </div>

                        @if (productsViewMode === 'cards') {
                            <div class="tpv-product-grid">
                                @for (product of filteredProducts(); track product.id) {
                                    <button
                                        type="button"
                                        class="tpv-product-card"
                                        [class.no-stock]="(product.qtyAvailable || 0) <= inCartQty(product.id)"
                                        [disabled]="(product.qtyAvailable || 0) <= inCartQty(product.id)"
                                        (click)="addToCart(product)"
                                    >
                                        <div class="tpv-product-head">
                                            <div class="tpv-product-name">{{ product.name }}</div>
                                            <span
                                                class="tpv-stock-pill"
                                                [class.low]="(product.qtyAvailable || 0) > 0 && (product.qtyAvailable || 0) <= 5"
                                                [class.empty]="(product.qtyAvailable || 0) <= 0"
                                            >
                                                @if ((product.qtyAvailable || 0) > 0) {
                                                    Stock {{ product.qtyAvailable || 0 }}
                                                } @else {
                                                    Sin stock
                                                }
                                            </span>
                                        </div>

                                        <div class="tpv-product-media">
                                            @if (product.image) {
                                                <img [src]="product.image" class="tpv-product-image" />
                                            } @else {
                                                <div class="tpv-product-placeholder">
                                                    <i class="pi pi-image"></i>
                                                </div>
                                            }
                                        </div>

                                        <div class="tpv-product-content">
                                            <div class="tpv-product-meta">{{ product.codigo || product.barcode || 'Sin identificador' }}</div>
                                            <div class="tpv-product-footer">
                                                <strong>{{ product.price | currency:'CUP' }}</strong>
                                                <span class="tpv-add-chip">
                                                    <i class="pi pi-plus"></i>
                                                    Agregar
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                }
                            </div>

                            @if (filteredProducts().length === 0) {
                                <div class="tpv-empty-state mt-3">
                                    <i class="pi pi-search"></i>
                                    <p>No hay productos disponibles.</p>
                                </div>
                            }
                        } @else {
                            <p-table [value]="filteredProducts()" [paginator]="true" [rows]="10">
                                <ng-template #header>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Código</th>
                                        <th class="text-right">Stock</th>
                                        <th class="text-right">Precio</th>
                                        <th class="text-center">Acción</th>
                                    </tr>
                                </ng-template>
                                <ng-template #body let-product>
                                    <tr>
                                        <td>{{ product.name }}</td>
                                        <td>{{ product.codigo || product.barcode || '-' }}</td>
                                        <td class="text-right">{{ product.qtyAvailable }}</td>
                                        <td class="text-right">{{ product.price | currency:'CUP' }}</td>
                                        <td class="text-center">
                                            <p-button
                                                icon="pi pi-plus"
                                                [rounded]="true"
                                                [text]="true"
                                                [disabled]="product.qtyAvailable <= inCartQty(product.id)"
                                                (onClick)="addToCart(product)"
                                            />
                                        </td>
                                    </tr>
                                </ng-template>
                                <ng-template #emptymessage>
                                    <tr>
                                        <td colspan="5" class="text-center">No hay productos disponibles.</td>
                                    </tr>
                                </ng-template>
                            </p-table>
                        }
                    </p-card>
                </div>

                <div>
                    <p-card header="Ticket actual">
                        <div class="mb-3">
                            <p-button
                                label="Limpiar ticket"
                                icon="pi pi-trash"
                                severity="danger"
                                [outlined]="true"
                                styleClass="w-full"
                                [disabled]="cart().length === 0 && paymentLines.length <= 1"
                                (onClick)="confirmClearTicket()"
                            />
                        </div>
                        <div class="flex flex-col gap-2 mb-3 cart-lines">
                            @for (line of cart(); track line.productId) {
                                <div class="border rounded p-2">
                                    <div class="font-medium">{{ line.name }}</div>
                                    <div class="text-xs text-gray-500 mb-2">{{ line.codigo || '-' }}</div>
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-2">
                                            <p-button icon="pi pi-minus" [rounded]="true" [text]="true" (onClick)="changeQty(line, -1)" />
                                            <strong>{{ line.qty }}</strong>
                                            <p-button icon="pi pi-plus" [rounded]="true" [text]="true" (onClick)="changeQty(line, 1)" />
                                        </div>
                                        <div class="font-semibold">{{ line.subtotal | currency:'CUP' }}</div>
                                    </div>
                                </div>
                            }

                            @if (cart().length === 0) {
                                <div class="text-sm text-gray-500">No hay productos agregados.</div>
                            }
                        </div>

                        <div class="flex items-center justify-between text-lg mb-3">
                            <span>Total</span>
                            <strong>{{ cartTotal() | currency:'CUP' }}</strong>
                        </div>

                        <h4 class="m-0 mb-2">Pagos</h4>
                        <div class="flex flex-col gap-2 payment-lines">
                            @for (line of paymentLines; track line.id; let i = $index) {
                                <div class="grid grid-cols-[1fr_100px_140px_40px] gap-2 items-center">
                                    <p-select [options]="paymentMethodOptions" [(ngModel)]="line.method" class="w-full" />
                                    <p-select [options]="currencyOptions" [(ngModel)]="line.currency" class="w-full" (onChange)="recalculateLineFromBase(i)" />
                                    <p-inputnumber [(ngModel)]="line.amount" [min]="0" [maxFractionDigits]="2" mode="decimal" class="w-full" />
                                    <p-button icon="pi pi-trash" [text]="true" severity="danger" [disabled]="paymentLines.length === 1" (onClick)="removePaymentLine(i)" />
                                </div>
                            }
                        </div>

                        <div class="flex justify-between mt-2 text-sm">
                            <span>Pagado (CUP)</span>
                            <strong>{{ paymentTotal() | currency:'CUP' }}</strong>
                        </div>
                        <div class="flex justify-between text-sm mb-3">
                            <span>Diferencia</span>
                            <strong [class.text-green-600]="paymentDifference() === 0" [class.text-red-600]="paymentDifference() !== 0">
                                {{ paymentDifference() | currency:'CUP' }}
                            </strong>
                        </div>

                        <div class="flex gap-2">
                            <p-button label="Agregar pago" icon="pi pi-plus" [outlined]="true" severity="secondary" (onClick)="addPaymentLine()" />
                            <p-button label="Cobrar" icon="pi pi-check" [disabled]="!canSubmit() || submitting()" [loading]="submitting()" (onClick)="submitSale()" />
                        </div>
                    </p-card>
                </div>
            </div>
        </div>

        <p-dialog header="Comprobante de Venta" [(visible)]="ticketDialog" [modal]="true" [style]="{ width: '760px' }">
            @if (lastTicket()) {
                <div class="flex flex-col gap-3" id="direct-sale-ticket-content">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><b>Comprobante:</b> {{ lastTicket()!.documentNumber || '-' }}</div>
                        <div><b>Fecha:</b> {{ lastTicket()!.createdAt | date:'dd/MM/yyyy HH:mm' }}</div>
                        <div>
                            <b>Cliente:</b>
                            {{ lastTicket()!.customerName || 'N/A' }}
                            @if (lastTicket()!.customer?.identification) {
                                <span class="text-gray-600">({{ lastTicket()!.customer!.identification }})</span>
                            }
                        </div>
                        <div><b>Cajero:</b> {{ lastTicket()!.cashier.email }}</div>
                        <div class="md:col-span-2"><b>Almacén:</b> {{ lastTicket()!.warehouse?.name || '-' }} ({{ lastTicket()!.warehouse?.code || '-' }})</div>
                    </div>

                    <p-table [value]="lastTicket()!.items">
                        <ng-template #header>
                            <tr>
                                <th>Producto</th>
                                <th class="text-right">Cant</th>
                                <th class="text-right">Precio</th>
                                <th class="text-right">Subtotal</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-item>
                            <tr>
                                <td>{{ item.name }}</td>
                                <td class="text-right">{{ item.qty }}</td>
                                <td class="text-right">{{ item.price | currency:'CUP' }}</td>
                                <td class="text-right">{{ item.subtotal | currency:'CUP' }}</td>
                            </tr>
                        </ng-template>
                    </p-table>

                    <p-table [value]="lastTicket()!.payments">
                        <ng-template #header>
                            <tr>
                                <th>Método</th>
                                <th>Moneda</th>
                                <th class="text-right">Monto</th>
                                <th class="text-right">Monto Base (CUP)</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-payment>
                            <tr>
                                <td>{{ payment.method }}</td>
                                <td>{{ payment.currency }}</td>
                                <td class="text-right">{{ payment.amountOriginal | currency:payment.currency }}</td>
                                <td class="text-right">{{ payment.amount | currency:'CUP' }}</td>
                            </tr>
                        </ng-template>
                    </p-table>

                    <div class="flex justify-end text-lg">
                        <strong>Total: {{ lastTicket()!.totals.total | currency:'CUP' }}</strong>
                    </div>
                </div>
            }
            <ng-template #footer>
                <p-button label="Descargar TXT" icon="pi pi-download" severity="secondary" [outlined]="true" (onClick)="downloadTicketTxt()" [disabled]="!lastTicket()" />
                <p-button label="Cerrar" icon="pi pi-times" text (onClick)="ticketDialog = false" />
            </ng-template>
        </p-dialog>

        <p-toast />
    `
})
export class DirectSales implements OnInit, AfterViewInit {
    warehouses = signal<Warehouse[]>([]);
    products = signal<DirectSaleProduct[]>([]);
    filteredProducts = signal<DirectSaleProduct[]>([]);
    cart = signal<CartLine[]>([]);

    selectedWarehouseId = '';
    customerName = '';
    search = '';

    paymentLines: PaymentLine[] = [];
    private paymentLineSeq = 1;
    productsViewMode: 'cards' | 'table' = 'cards';

    enabledCurrencies: SystemCurrencyCode[] = ['CUP', 'USD'];
    defaultCurrency: SystemCurrencyCode = 'CUP';
    exchangeRateUsdToCup = 1;

    submitting = signal(false);
    ticketDialog = false;
    lastTicket = signal<DirectSaleTicket | null>(null);

    paymentMethodOptions: Array<{ label: string; value: PaymentMethodCode }> = [
        { label: 'Efectivo', value: 'CASH' },
        { label: 'Tarjeta', value: 'CARD' },
        { label: 'Transferencia', value: 'TRANSFER' },
        { label: 'Otro', value: 'OTHER' }
    ];

    warehouseOptions: Array<{ label: string; value: string }> = [];
    currencyOptions: Array<{ label: string; value: SystemCurrencyCode }> = [
        { label: 'CUP', value: 'CUP' },
        { label: 'USD', value: 'USD' }
    ];

    cartTotal = computed(() =>
        Number(this.cart().reduce((sum, line) => sum + line.subtotal, 0).toFixed(2))
    );

    constructor(
        private readonly warehousesService: WarehousesService,
        private readonly directSalesService: DirectSalesService,
        private readonly settingsService: SettingsService,
        private readonly messageService: MessageService
    ) {}

    ngOnInit(): void {
        this.loadWarehouses();
        this.initPaymentLines();
    }

    ngAfterViewInit(): void {
        this.loadSystemSettings();
    }

    private loadSystemSettings() {
        this.settingsService.getSystemSettings().subscribe({
            next: (settings) => {
                setTimeout(() => {
                    const enabled = (settings.enabledCurrencies || ['CUP', 'USD']) as SystemCurrencyCode[];
                    this.enabledCurrencies = enabled.length ? enabled : ['CUP', 'USD'];
                    this.defaultCurrency = (settings.defaultCurrency || this.enabledCurrencies[0] || 'CUP') as SystemCurrencyCode;
                    if (!this.enabledCurrencies.includes(this.defaultCurrency)) {
                        this.defaultCurrency = this.enabledCurrencies[0];
                    }
                    this.exchangeRateUsdToCup = Number(settings.exchangeRateUsdToCup || 1);
                    if (!Number.isFinite(this.exchangeRateUsdToCup) || this.exchangeRateUsdToCup <= 0) {
                        this.exchangeRateUsdToCup = 1;
                    }
                    this.currencyOptions = this.enabledCurrencies.map((code) => ({ label: code, value: code }));
                    this.paymentLines = this.paymentLines.map((line) => ({
                        ...line,
                        currency: this.enabledCurrencies.includes(line.currency) ? line.currency : this.defaultCurrency
                    }));
                });
            },
            error: () => {
                setTimeout(() => {
                    this.enabledCurrencies = ['CUP', 'USD'];
                    this.defaultCurrency = 'CUP';
                    this.exchangeRateUsdToCup = 1;
                    this.currencyOptions = this.enabledCurrencies.map((code) => ({ label: code, value: code }));
                });
            }
        });
    }

    private loadWarehouses() {
        this.warehousesService.listWarehouses().subscribe({
            next: (rows) => {
                const directWarehouses = rows.filter((w) => w.active && w.type !== 'TPV');
                this.warehouses.set(directWarehouses);
                this.warehouseOptions = directWarehouses.map((w) => ({
                    label: `${w.name} (${w.code})`,
                    value: w.id
                }));
            },
            error: () => {
                this.warehouses.set([]);
                this.warehouseOptions = [];
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar los almacenes.'
                });
            }
        });
    }

    onWarehouseChange() {
        this.cart.set([]);
        this.search = '';

        if (!this.selectedWarehouseId) {
            this.products.set([]);
            this.filteredProducts.set([]);
            return;
        }

        this.directSalesService.listWarehouseProducts(this.selectedWarehouseId).subscribe({
            next: (products) => {
                this.products.set(products);
                this.filteredProducts.set(products);
            },
            error: (err) => {
                this.products.set([]);
                this.filteredProducts.set([]);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo cargar el stock del almacén.'
                });
            }
        });
    }

    applyFilter() {
        const q = this.search.trim().toLowerCase();
        if (!q) {
            this.filteredProducts.set(this.products());
            return;
        }

        this.filteredProducts.set(
            this.products().filter((p) =>
                p.name.toLowerCase().includes(q) ||
                (p.codigo || '').toLowerCase().includes(q) ||
                (p.barcode || '').toLowerCase().includes(q)
            )
        );
    }

    setProductsViewMode(mode: 'cards' | 'table') {
        this.productsViewMode = mode;
    }

    inCartQty(productId: string) {
        return this.cart().find((line) => line.productId === productId)?.qty || 0;
    }

    addToCart(product: DirectSaleProduct) {
        const lines = [...this.cart()];
        const index = lines.findIndex((line) => line.productId === product.id);
        if (index >= 0) {
            if (lines[index].qty + 1 > Number(product.qtyAvailable || 0)) {
                this.messageService.add({ severity: 'warn', summary: 'Sin stock', detail: 'No hay stock suficiente.' });
                return;
            }
            lines[index].qty += 1;
            lines[index].subtotal = Number((lines[index].qty * lines[index].price).toFixed(2));
        } else {
            lines.push({
                productId: product.id,
                name: product.name,
                codigo: product.codigo || product.barcode,
                price: Number(product.price || 0),
                qty: 1,
                subtotal: Number(product.price || 0)
            });
        }

        this.cart.set(lines);
        this.rebalancePayments();
    }

    changeQty(line: CartLine, delta: number) {
        const product = this.products().find((p) => p.id === line.productId);
        const lines = [...this.cart()];
        const index = lines.findIndex((l) => l.productId === line.productId);
        if (index < 0) return;

        const next = lines[index].qty + delta;
        if (next <= 0) {
            lines.splice(index, 1);
            this.cart.set(lines);
            this.rebalancePayments();
            return;
        }

        if (product && next > Number(product.qtyAvailable || 0)) {
            this.messageService.add({ severity: 'warn', summary: 'Sin stock', detail: 'No hay stock suficiente.' });
            return;
        }

        lines[index].qty = next;
        lines[index].subtotal = Number((lines[index].qty * lines[index].price).toFixed(2));
        this.cart.set(lines);
        this.rebalancePayments();
    }

    addPaymentLine() {
        const baseMethod = this.paymentMethodOptions[0]?.value || 'CASH';
        this.paymentLines = [
            ...this.paymentLines,
            {
                id: this.paymentLineSeq++,
                method: baseMethod,
                currency: this.defaultCurrency,
                amount: 0
            }
        ];
    }

    removePaymentLine(index: number) {
        if (this.paymentLines.length <= 1) return;
        this.paymentLines = this.paymentLines.filter((_, i) => i !== index);
        this.rebalancePayments();
    }

    recalculateLineFromBase(index: number) {
        const line = this.paymentLines[index];
        if (!line) return;

        const base = this.toBaseAmount(Number(line.amount || 0), line.currency);
        line.amount = this.fromBaseAmount(base, line.currency);
        this.paymentLines = [...this.paymentLines];
    }

    canSubmit() {
        if (!this.selectedWarehouseId) return false;
        if (this.cart().length === 0) return false;
        if (!this.paymentLines.length) return false;
        if (this.paymentLines.some((line) => Number(line.amount || 0) <= 0)) return false;
        return this.paymentDifference() === 0;
    }

    submitSale() {
        if (!this.canSubmit()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Datos incompletos',
                detail: 'Revise almacén, productos y líneas de pago.'
            });
            return;
        }

        const payload = {
            warehouseId: this.selectedWarehouseId,
            customerName: this.customerName?.trim() || undefined,
            items: this.cart().map((line) => ({
                productId: line.productId,
                qty: line.qty
            })),
            payments: this.paymentLines.map((line) => ({
                method: line.method,
                currency: line.currency,
                amountOriginal: String(Number(line.amount || 0).toFixed(2)),
                amount: String(this.toBaseAmount(Number(line.amount || 0), line.currency).toFixed(2))
            }))
        };

        this.submitting.set(true);
        this.directSalesService.createSale(payload).subscribe({
            next: (sale) => {
                this.submitting.set(false);
                this.messageService.add({ severity: 'success', summary: 'Venta registrada', detail: `Comprobante ${sale.documentNumber || sale.id}` });
                this.directSalesService.getTicket(sale.id).subscribe({
                    next: (ticket) => {
                        this.lastTicket.set(ticket);
                        this.ticketDialog = true;
                    },
                    error: () => {
                        this.lastTicket.set(null);
                    }
                });

                this.cart.set([]);
                this.customerName = '';
                this.initPaymentLines();
                this.onWarehouseChange();
            },
            error: (err) => {
                this.submitting.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo registrar la venta directa.'
                });
            }
        });
    }

    downloadTicketTxt() {
        const ticket = this.lastTicket();
        if (!ticket) return;

        const lines: string[] = [];
        lines.push(`COMPROBANTE: ${ticket.documentNumber || ticket.saleId}`);
        lines.push(`FECHA: ${new Date(ticket.createdAt).toLocaleString('es-ES')}`);
        lines.push(`CLIENTE: ${ticket.customerName || 'N/A'}`);
        lines.push(`CAJERO: ${ticket.cashier.email}`);
        lines.push(`ALMACEN: ${ticket.warehouse?.name || '-'} (${ticket.warehouse?.code || '-'})`);
        lines.push('');
        lines.push('PRODUCTOS');
        for (const item of ticket.items) {
            lines.push(`- ${item.name} | ${item.qty} x ${item.price.toFixed(2)} = ${item.subtotal.toFixed(2)} CUP`);
        }
        lines.push('');
        lines.push('PAGOS');
        for (const payment of ticket.payments) {
            lines.push(`- ${payment.method} | ${payment.amountOriginal.toFixed(2)} ${payment.currency} | Base: ${payment.amount.toFixed(2)} CUP`);
        }
        lines.push('');
        lines.push(`TOTAL: ${ticket.totals.total.toFixed(2)} CUP`);

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${ticket.documentNumber || ticket.saleId}.txt`;
        link.click();
        URL.revokeObjectURL(url);
    }

    private initPaymentLines() {
        this.paymentLineSeq = 1;
        this.paymentLines = [
            {
                id: this.paymentLineSeq++,
                method: this.paymentMethodOptions[0]?.value || 'CASH',
                currency: this.defaultCurrency,
                amount: 0
            }
        ];
    }

    paymentTotal() {
        return Number(
            this.paymentLines
                .reduce((sum, line) => sum + this.toBaseAmount(Number(line.amount || 0), line.currency), 0)
                .toFixed(2)
        );
    }

    paymentDifference() {
        return Number((this.cartTotal() - this.paymentTotal()).toFixed(2));
    }

    private rebalancePayments() {
        if (!this.paymentLines.length) return;

        const target = this.cartTotal();
        const first = this.paymentLines[0];
        if (!first) return;

        const othersBase = this.paymentLines.slice(1).reduce((sum, line) => sum + this.toBaseAmount(Number(line.amount || 0), line.currency), 0);
        const firstBase = Number((target - othersBase).toFixed(2));
        first.amount = firstBase > 0 ? this.fromBaseAmount(firstBase, first.currency) : 0;
        this.paymentLines = [...this.paymentLines];
    }

    private toBaseAmount(amount: number, currency: SystemCurrencyCode): number {
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        if (currency === 'USD') {
            return Number((amount * this.exchangeRateUsdToCup).toFixed(2));
        }
        return Number(amount.toFixed(2));
    }

    private fromBaseAmount(baseAmount: number, currency: SystemCurrencyCode): number {
        if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
        if (currency === 'USD') {
            return Number((baseAmount / this.exchangeRateUsdToCup).toFixed(2));
        }
        return Number(baseAmount.toFixed(2));
    }
}
