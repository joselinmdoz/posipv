import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { SplitButtonModule } from 'primeng/splitbutton';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { MenuItem, MessageService } from 'primeng/api';
import { CashSessionSummary, Payment, PosService, SaleItem } from '@/app/core/services/pos.service';
import { Product, ProductsService } from '@/app/core/services/products.service';
import { Denomination, PaymentMethodSetting, SettingsService, SystemCurrencyCode } from '@/app/core/services/settings.service';
import { WarehousesService } from '@/app/core/services/warehouses.service';
import { InventoryReportsService, SessionIvpReport } from '@/app/core/services/inventory-reports.service';
import { Customer, CustomersService } from '@/app/core/services/customers.service';
import { catchError, forkJoin, of } from 'rxjs';

@Component({
    selector: 'app-tpv',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputNumberModule,
        InputTextModule,
        DialogModule,
        SelectModule,
        SplitButtonModule,
        ToastModule,
        TagModule,
        TableModule
    ],
    providers: [MessageService],
    templateUrl: './tpv.html'
})
export class Tpv implements OnInit {
    products = signal<Product[]>([]);
    filteredProducts = signal<Product[]>([]);
    registerOptions: any[] = [];
    private pendingNavigationSelection: { registerId: string; action: 'open' | 'continue' } | null = null;
    
    selectedRegisterId: string = '';
    searchQuery: string = '';
    selectedCategoryFilter = 'all';
    productCategoryByProductId = signal<Record<string, string>>({});
    tpvCategoryFilters = computed(() => {
        const categoryById = this.productCategoryByProductId();
        const categories = new Set<string>();
        for (const product of this.products()) {
            const categoryName = (product.productCategory?.name || categoryById[product.id] || '').trim();
            if (categoryName) categories.add(categoryName);
        }
        return Array.from(categories).sort((a, b) => a.localeCompare(b, 'es'));
    });
    
    openDialog = false;
    closeDialog = false;
    paymentDialog = false;
    sessionMovementDialog = false;
    sessionIpvDialog = false;
    
    openingAmount: number = 0;
    openingNote: string = '';
    closingNote: string = '';
    registerWarehouseId: string = '';
    registerWarehouseName: string = '';
    
    paymentLines: Array<{
        id: number;
        method: Payment['method'];
        currency: SystemCurrencyCode;
        amount: number | null;
        transactionCode?: string;
    }> = [];
    private paymentLineSeq = 1;
    paymentDefaultCurrency: SystemCurrencyCode = 'CUP';
    paymentEnabledCurrencies: SystemCurrencyCode[] = ['CUP'];
    selectedCustomer = signal<Customer | null>(null);
    customers = signal<Customer[]>([]);
    customersLoading = signal(false);
    customerDialog = false;
    customerSearch = '';
    showNewCustomerForm = false;
    creatingCustomer = signal(false);
    newCustomer: {
        name: string;
        identification: string;
        phone: string;
        email: string;
        address: string;
    } = this.getEmptyNewCustomerForm();

    movementProductOptions: Array<{
        label: string;
        value: string;
        name: string;
        codigo: string;
        image?: string;
        price: number;
        currency: SystemCurrencyCode;
        stock: number;
        allowFractionalQty: boolean;
    }> = [];
    movementProductsCatalog: Product[] = [];
    movementProductsLoading = false;
    movementStockByProduct = new Map<string, number>();

    sessionMovement: {
        type: 'IN' | 'OUT';
        productId: string;
        qty: number;
        reason: string;
    } = {
        type: 'IN',
        productId: '',
        qty: 1,
        reason: ''
    };

    sessionMovementTypeOptions = [
        { label: 'Entrada', value: 'IN' },
        { label: 'Salida', value: 'OUT' }
    ];

    private readonly paymentMethodCatalog: Array<{ label: string; value: Payment['method']; defaultEnabled: boolean; defaultRequiresTransactionCode: boolean }> = [
        { label: 'Efectivo', value: 'CASH', defaultEnabled: true, defaultRequiresTransactionCode: false },
        { label: 'Tarjeta', value: 'CARD', defaultEnabled: true, defaultRequiresTransactionCode: false },
        { label: 'Transferencia', value: 'TRANSFER', defaultEnabled: true, defaultRequiresTransactionCode: false },
        { label: 'Otro', value: 'OTHER', defaultEnabled: false, defaultRequiresTransactionCode: false }
    ];
    paymentMethods: Array<{ label: string; value: Payment['method']; requiresTransactionCode: boolean }> = this.paymentMethodCatalog
        .filter((item) => item.defaultEnabled)
        .map(({ label, value, defaultRequiresTransactionCode }) => ({ label, value, requiresTransactionCode: defaultRequiresTransactionCode }));
    private allowedPaymentMethods = new Set<Payment['method']>(this.paymentMethods.map((item) => item.value));
    sessionIpvExportItems: MenuItem[] = [
        {
            label: 'Exportar XLSX',
            icon: 'pi pi-file-excel',
            command: () => this.exportSessionIpvAsXlsx()
        },
        {
            label: 'Exportar PDF',
            icon: 'pi pi-file-pdf',
            command: () => this.exportSessionIpvAsPdf()
        }
    ];

    cartTotal = computed(() => this.posService.getCartTotal());
    sessionIpvReport = signal<SessionIvpReport | null>(null);
    sessionIpvLoading = signal<boolean>(false);
    closeSummary = signal<CashSessionSummary | null>(null);
    closeSummaryLoading = signal<boolean>(false);
    closeDenominationLines: Array<{ id: string; value: number; qty: number; currency: SystemCurrencyCode }> = [];
    closeCashCurrency: SystemCurrencyCode = 'CUP';
    sessionIpvConfiguredPaymentMethods: PaymentMethodSetting[] = [];

    constructor(
        public posService: PosService,
        private productsService: ProductsService,
        private settingsService: SettingsService,
        private warehousesService: WarehousesService,
        private inventoryReportsService: InventoryReportsService,
        private customersService: CustomersService,
        private route: ActivatedRoute,
        private router: Router,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.setDefaultPaymentMethods();
        this.applyRegisterCurrency('CUP');
        this.clearProducts();
        this.handleNavigationParams();
        this.loadRegisters();
        this.loadProductsForMovements();
    }

    loadSessionProducts(cashSessionId: string) {
        this.posService.listSessionProducts(cashSessionId).subscribe({
            next: (products) => {
                const normalized = products.map((product) => ({
                    ...product,
                    qtyAvailable: this.normalizeAvailableQty(product),
                }));
                this.mergeProductCategoryMap(normalized);
                this.products.set(normalized);
                this.filterProducts();
            },
            error: (err) => {
                this.clearProducts();
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudieron cargar los productos del TPV'
                });
            },
        });
    }

    clearProducts() {
        this.products.set([]);
        this.filteredProducts.set([]);
    }

    loadRegisters() {
        this.posService.listRegisters().subscribe({
            next: (registers) => {
                this.registerOptions = registers.map((r) => ({
                    label: r.name,
                    value: r.id
                }));
                this.tryApplyNavigationSelection();
            },
            error: () => {
                this.registerOptions = [];
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar los TPV'
                });
            }
        });
    }

    onRegisterChange(preferredAction?: 'open' | 'continue') {
        this.posService.clearCart();
        this.clearProducts();
        this.searchQuery = '';
        this.selectedCategoryFilter = 'all';
        this.applyRegisterCurrency('CUP');
        this.registerWarehouseId = '';
        this.registerWarehouseName = '';

        if (this.selectedRegisterId) {
            this.setPaymentMethods([]);
            this.loadRegisterWarehouse(this.selectedRegisterId);

            this.posService.getOpenSession(this.selectedRegisterId).subscribe({
                next: (session) => {
                    this.posService.setCurrentSession(session);
                    if (session) {
                        this.loadSessionProducts(session.id);
                    } else if (preferredAction === 'open') {
                        this.showOpenDialog();
                    } else if (preferredAction === 'continue') {
                        this.messageService.add({
                            severity: 'warn',
                            summary: 'Sin sesion abierta',
                            detail: 'Este TPV no tiene una caja abierta. Debe abrir una nueva sesion.'
                        });
                    }
                },
                error: (err) => {
                    this.posService.setCurrentSession(null);
                    if (preferredAction === 'open') {
                        this.showOpenDialog();
                        return;
                    }
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: err?.error?.message || 'No se pudo consultar el estado de la sesion del TPV'
                    });
                }
            });
        } else {
            this.posService.setCurrentSession(null);
            this.setDefaultPaymentMethods();
            this.applyRegisterCurrency('CUP');
        }
    }

    filterProducts() {
        const query = this.searchQuery.toLowerCase();
        const filtered = this.products().filter(p => 
            this.isCurrencyAllowed(p.currency) &&
            this.matchesTpvCategoryFilter(p) &&
            (
                !query ||
                p.name.toLowerCase().includes(query) || 
                (p.codigo && p.codigo.toLowerCase().includes(query)) ||
                (p.barcode && p.barcode.toLowerCase().includes(query))
            )
        );
        this.filteredProducts.set(filtered);
    }

    clearProductSearch() {
        this.searchQuery = '';
        this.filterProducts();
    }

    setTpvCategoryFilter(category: string) {
        this.selectedCategoryFilter = category || 'all';
        this.filterProducts();
    }

    isTpvCategoryActive(category: string): boolean {
        return this.selectedCategoryFilter === category;
    }

    addToCart(product: Product) {
        if (!this.posService.currentSession()) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Debe abrir la caja primero' });
            return;
        }
        if (!this.isCurrencyAllowed(product.currency)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Moneda no permitida',
                detail: `Este TPV solo permite ventas en ${this.paymentBaseCurrency()}`
            });
            return;
        }

        const available = this.getAvailableQtyByProductId(product.id);
        const qtyInCart = this.getCartQty(product.id);
        const step = this.getStepQtyForProduct(product.id);
        const qtyToAdd = this.roundQty(Math.min(step, Math.max(0, available - qtyInCart)));
        if (available <= 0 || qtyToAdd <= 0 || qtyInCart + qtyToAdd > available + 0.000001) {
            this.messageService.add({ severity: 'warn', summary: 'Sin stock', detail: 'No hay stock suficiente en este TPV' });
            return;
        }

        this.posService.addToCart(product, qtyToAdd);
    }

    increaseQty(item: SaleItem) {
        const available = this.getAvailableQtyByProductId(item.productId);
        const step = this.getStepQtyForProduct(item.productId);
        if (available <= item.qty + 0.000001) {
            this.messageService.add({ severity: 'warn', summary: 'Sin stock', detail: 'No hay stock suficiente en este TPV' });
            return;
        }
        const nextQty = this.roundQty(item.qty + step);
        this.applyCartQty(item, nextQty, true);
    }

    decreaseQty(item: SaleItem) {
        const step = this.getStepQtyForProduct(item.productId);
        const nextQty = this.roundQty(item.qty - step);
        this.applyCartQty(item, nextQty, false);
    }

    onCartQtyInputChange(item: SaleItem, rawQty: number | null) {
        if (rawQty === null || rawQty === undefined || Number.isNaN(Number(rawQty))) {
            return;
        }
        this.applyCartQty(item, rawQty, true);
    }

    onCartQtyInputBlur(item: SaleItem, event: any) {
        const modelValue = this.parseInputNumberValue(event?.value);
        if (modelValue !== null) {
            this.applyCartQty(item, modelValue, false);
            return;
        }

        const rawInputValue = this.readInputNumberRawValue(event);
        if (rawInputValue === null) return;

        if (rawInputValue.trim() === '') {
            this.posService.updateCartItemQty(item.productId, 0);
            return;
        }

        const parsedRawValue = this.parseInputNumberValue(rawInputValue);
        if (parsedRawValue !== null) {
            this.applyCartQty(item, parsedRawValue, false);
        }
    }

    onCartAmountInputChange(item: SaleItem, rawAmount: number | null) {
        if (rawAmount === null || rawAmount === undefined || Number.isNaN(Number(rawAmount))) {
            return;
        }
        const amount = Number(rawAmount);
        if (amount <= 0) {
            this.posService.updateCartItemQty(item.productId, 0);
            return;
        }
        const unitPrice = Number(item.price || 0);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
            this.posService.updateCartItemQty(item.productId, 0);
            return;
        }
        const qty = this.roundQty(amount / unitPrice);
        this.applyCartQty(item, qty, true);
    }

    onCartAmountInputBlur(item: SaleItem, event: any) {
        const modelValue = this.parseInputNumberValue(event?.value);
        if (modelValue !== null) {
            this.onCartAmountInputChange(item, modelValue);
            return;
        }

        const rawInputValue = this.readInputNumberRawValue(event);
        if (rawInputValue === null) return;

        if (rawInputValue.trim() === '') {
            this.posService.updateCartItemQty(item.productId, 0);
            return;
        }

        const parsedRawValue = this.parseInputNumberValue(rawInputValue);
        if (parsedRawValue !== null) {
            this.onCartAmountInputChange(item, parsedRawValue);
        }
    }

    onCartFieldInteraction(event: Event): void {
        const target = event.target as HTMLElement | null;
        const input = target instanceof HTMLInputElement ? target : (target?.closest('.p-inputnumber')?.querySelector('input') as HTMLInputElement | null);
        if (!input) return;
        setTimeout(() => input.select(), 0);
    }

    getAvailableQtyForCartItem(item: SaleItem): number {
        return this.getAvailableQtyByProductId(item.productId);
    }

    removeFromCart(item: SaleItem) {
        this.posService.removeFromCart(item.productId);
    }

    showOpenDialog() {
        if (!this.selectedRegisterId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione un TPV' });
            return;
        }
        this.openDialog = true;
    }

    openSession() {
        this.posService.openSession(this.selectedRegisterId, this.openingAmount, this.openingNote).subscribe({
            next: (session) => {
                this.posService.setCurrentSession(session);
                this.loadSessionProducts(session.id);
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Caja abierta' });
                this.openDialog = false;
                this.openingAmount = 0;
                this.openingNote = '';
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al abrir caja' })
        });
    }

    showCloseDialog() {
        const session = this.posService.currentSession();
        if (!session) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay una sesión activa para cerrar' });
            return;
        }

        this.closeDialog = true;
        this.closeSummaryLoading.set(true);
        this.closeSummary.set(null);
        this.closeDenominationLines = [];

        forkJoin({
            summary: this.posService.getSessionSummary(session.id),
            registerSettings: this.settingsService.getRegisterSettings(session.registerId)
        }).subscribe({
            next: ({ summary, registerSettings }) => {
                this.closeSummary.set(summary);
                this.closeDenominationLines = this.buildCloseDenominationLines(registerSettings.denominations || []);
                this.closeSummaryLoading.set(false);
            },
            error: (err) => {
                this.closeSummaryLoading.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo cargar el resumen de cierre'
                });
            }
        });
    }

    closeSession() {
        const session = this.posService.currentSession();
        if (!session) return;
        if (!this.canConfirmCloseSession()) return;

        const countedCash = this.closeCountedCash();

        this.posService.closeSession(session.id, countedCash, this.closingNote).subscribe({
            next: () => {
                this.posService.setCurrentSession(null);
                this.posService.clearCart();
                this.clearProducts();
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Caja cerrada' });
                this.closeDialog = false;
                this.closingNote = '';
                this.closeSummary.set(null);
                this.closeDenominationLines = [];
                this.router.navigate(['/tpv-management']);
            },
            error: (err) => this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: err?.error?.message || 'Error al cerrar caja'
            })
        });
    }

    closePaymentMethodRows() {
        const summary = this.closeSummary();
        if (!summary) return [];
        const fallbackMethods: Array<{ label: string; value: Payment['method'] }> = this.paymentMethodCatalog
            .filter((item) => item.defaultEnabled)
            .map(({ label, value }) => ({ label, value }));
        const methods = this.paymentMethods.length > 0 ? this.paymentMethods : fallbackMethods;

        return methods.map((method) => ({
            code: method.value,
            label: method.label,
            amount: Number(summary.paymentTotals?.[method.value] || 0)
        }));
    }

    sessionIpvPaymentSummaryRows() {
        const report = this.sessionIpvReport();
        if (!report) return [];
        return this.sessionIpvPaymentSummaryRowsFromReport(report);
    }

    private sessionIpvPaymentSummaryRowsFromReport(report: SessionIvpReport) {
        const configuredMethods = (this.sessionIpvConfiguredPaymentMethods || [])
            .filter((method) => method.enabled !== false)
            .map((method) => ({
                label: String(method.name || method.code).trim() || method.code,
                value: this.normalizePaymentMethodCode(method.code)
            }))
            .filter((row): row is { label: string; value: Payment['method'] } => !!row.value);

        const fallbackMethods: Array<{ label: string; value: Payment['method'] }> = this.paymentMethodCatalog
            .filter((item) => item.defaultEnabled)
            .map(({ label, value }) => ({ label, value }));
        const methods = configuredMethods.length > 0
            ? configuredMethods
            : (this.paymentMethods.length > 0 ? this.paymentMethods : fallbackMethods);

        return methods.map((method) => ({
            code: method.value,
            label: method.label,
            amount: Number(report.paymentTotals?.[method.value] || 0)
        }));
    }

    closeExpectedCash(): number {
        const summary = this.closeSummary();
        return this.roundMoney(Number(summary?.paymentTotals.CASH || 0));
    }

    closeCountedCash(): number {
        return this.roundMoney(
            this.closeDenominationLines.reduce((sum, line) => {
                const qty = Math.max(0, Math.floor(Number(line.qty || 0)));
                return sum + (line.value * qty);
            }, 0)
        );
    }

    closeCashDifference(): number {
        return this.roundMoney(this.closeCountedCash() - this.closeExpectedCash());
    }

    canConfirmCloseSession(): boolean {
        if (this.closeSummaryLoading()) return false;
        if (!this.closeSummary()) return false;
        return true;
    }

    private buildCloseDenominationLines(denominations: Denomination[]) {
        return denominations
            .filter((d) => d.enabled && d.currency === this.closeCashCurrency)
            .sort((a, b) => Number(b.value) - Number(a.value))
            .map((d) => ({
                id: d.id || d.value.toString(),
                value: this.roundMoney(Number(d.value)),
                currency: d.currency,
                qty: 0,
            }));
    }

    onCloseDenominationFieldInteraction(event: Event): void {
        const target = event.target as HTMLElement | null;
        const input =
            target instanceof HTMLInputElement
                ? target
                : (target?.closest('.tpv-close-denom-row')?.querySelector('input') as HTMLInputElement | null);

        if (!input) return;
        setTimeout(() => input.select(), 0);
    }

    onCloseDenominationQtyChange(line: { qty: number }) {
        if (line.qty === null || line.qty === undefined || Number.isNaN(line.qty as any)) {
            line.qty = 0;
            return;
        }
        line.qty = Math.max(0, Math.floor(Number(line.qty)));
    }

    openCustomerDialog() {
        this.customerDialog = true;
    }

    onCustomerDialogShow() {
        this.loadCustomers();
    }

    loadCustomers() {
        this.customersLoading.set(true);
        this.customersService
            .list({
                q: this.customerSearch?.trim() || undefined,
                active: true,
                limit: 200
            })
            .subscribe({
                next: (rows) => {
                    this.customers.set(rows || []);
                    this.customersLoading.set(false);
                },
                error: () => {
                    this.customers.set([]);
                    this.customersLoading.set(false);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar los clientes.'
                    });
                }
            });
    }

    selectCustomer(customer: Customer) {
        this.selectedCustomer.set(customer);
        this.customerDialog = false;
        this.messageService.add({
            severity: 'success',
            summary: 'Cliente seleccionado',
            detail: `${customer.name} (${customer.identification})`
        });
    }

    clearSelectedCustomer() {
        this.selectedCustomer.set(null);
    }

    toggleNewCustomerForm() {
        this.showNewCustomerForm = !this.showNewCustomerForm;
        if (!this.showNewCustomerForm) {
            this.newCustomer = this.getEmptyNewCustomerForm();
        }
    }

    createCustomer() {
        const payload = {
            name: this.newCustomer.name?.trim(),
            identification: this.newCustomer.identification?.trim(),
            phone: this.newCustomer.phone?.trim() || undefined,
            email: this.newCustomer.email?.trim() || undefined,
            address: this.newCustomer.address?.trim() || undefined
        };

        if (!payload.name || !payload.identification) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Datos incompletos',
                detail: 'Nombre e identificación son obligatorios.'
            });
            return;
        }

        this.creatingCustomer.set(true);
        this.customersService.create(payload).subscribe({
            next: (created) => {
                this.creatingCustomer.set(false);
                this.newCustomer = this.getEmptyNewCustomerForm();
                this.showNewCustomerForm = false;
                this.loadCustomers();
                this.selectCustomer(created);
            },
            error: (err) => {
                this.creatingCustomer.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo crear el cliente.'
                });
            }
        });
    }

    showPaymentDialog() {
        if (!this.posService.currentSession()) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Abra la caja primero' });
            return;
        }
        if (!this.hasPositiveCartItems()) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay lineas con cantidad mayor a 0 en el ticket' });
            return;
        }
        if (this.paymentMethods.length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Este TPV no tiene métodos de pago configurados' });
            return;
        }
        this.initPaymentLines();
        this.paymentDialog = true;
    }

    canCompletePayment(): boolean {
        if (!this.hasPositiveCartItems()) return false;
        if (!this.paymentLines.length) return false;

        const hasInvalidLine = this.paymentLines.some(
            (line) => !line.method || !this.isCurrencyAllowed(line.currency) || Number(line.amount || 0) <= 0
        );
        if (hasInvalidLine) return false;
        if (this.findLineMissingTransactionCode()) return false;
        if (this.hasDuplicatePaymentMethods()) return false;

        return this.paymentDifference() === 0;
    }

    completeSale() {
        const session = this.posService.currentSession();
        if (!session) return;
        const saleItems = this.positiveCartItems();
        if (saleItems.length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay lineas con cantidad mayor a 0 para cobrar' });
            return;
        }

        if (!this.validatePaymentsBeforeSubmit()) return;

        const payments: Payment[] = this.paymentLines
            .filter((line) => Number(line.amount || 0) > 0)
            .map((line) => ({
                method: line.method,
                amount: this.roundMoney(Number(line.amount || 0)),
                currency: line.currency,
                transactionCode: line.transactionCode?.trim() || undefined
            }));

        this.posService.createSale(
            session.id,
            saleItems,
            payments,
            this.selectedCustomer()?.id || undefined
        ).subscribe({
            next: () => {
                this.posService.clearCart();
                this.loadSessionProducts(session.id);
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Venta completada' });
                this.paymentDialog = false;
                this.initPaymentLines();
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al procesar venta' })
        });
    }

    addPaymentLine(method?: Payment['method'], amount?: number) {
        const methodToUse = method || this.getNextAvailablePaymentMethod();
        if (!methodToUse) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay métodos de pago disponibles para este TPV' });
            return;
        }

        if (!this.isPaymentMethodAllowed(methodToUse)) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El método de pago no está permitido en este TPV' });
            return;
        }

        if (this.isPaymentMethodAlreadyUsed(methodToUse)) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No puede repetir el mismo método de pago' });
            return;
        }

        const lineAmount = amount !== undefined ? this.roundMoney(amount) : 0;
        this.paymentLines = [
            ...this.paymentLines,
            {
                id: this.paymentLineSeq++,
                method: methodToUse,
                currency: this.paymentDefaultCurrency,
                amount: lineAmount,
                transactionCode: ''
            }
        ];
    }

    removePaymentLine(index: number) {
        if (this.paymentLines.length <= 1) return;
        this.paymentLines = this.paymentLines.filter((_, i) => i !== index);
    }

    fillLineWithRemaining(index: number) {
        const line = this.paymentLines[index];
        if (!line) return;

        const totalExcludingLine = this.paymentLines.reduce((sum, current, i) => {
            if (i === index) return sum;
            return sum + this.toBaseAmount(Number(current.amount || 0), current.currency);
        }, 0);
        const remaining = this.roundMoney(this.cartTotal() - totalExcludingLine);
        line.amount = remaining > 0 ? this.roundMoney(this.fromBaseAmount(remaining, line.currency)) : 0;
        this.paymentLines = [...this.paymentLines];
    }

    addRemainingAs(method: Payment['method']) {
        if (!this.isPaymentMethodAllowed(method)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Método no permitido',
                detail: 'El método seleccionado no está configurado en este TPV'
            });
            return;
        }

        const remaining = this.paymentDifference();
        if (remaining <= 0) {
            this.messageService.add({ severity: 'info', summary: 'Info', detail: 'No hay monto restante por asignar' });
            return;
        }

        const existingIndex = this.paymentLines.findIndex((line) => line.method === method);
        if (existingIndex >= 0) {
            const line = this.paymentLines[existingIndex];
            const currentBase = this.toBaseAmount(Number(line.amount || 0), line.currency);
            const nextBase = this.roundMoney(currentBase + remaining);
            line.amount = this.roundMoney(this.fromBaseAmount(nextBase, line.currency));
            this.paymentLines = [...this.paymentLines];
            return;
        }

        this.addPaymentLine(method, this.fromBaseAmount(remaining, this.paymentDefaultCurrency));
    }

    canManageSessionInventory(): boolean {
        return !!this.posService.currentSession() && !!this.registerWarehouseId;
    }

    currentShiftCashierName(): string {
        const session = this.posService.currentSession();
        if (!session) return '-';
        const firstName = session.openedBy?.employee?.firstName || '';
        const lastName = session.openedBy?.employee?.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || session.openedBy?.email || '-';
    }

    sessionIpvResponsibleName(): string {
        const report = this.sessionIpvReport();
        if (!report) return '-';
        return this.resolveSessionIpvResponsibleName(report);
    }

    private resolveSessionIpvResponsibleName(report: SessionIvpReport): string {
        const name = String(report.responsible?.employeeName || '').trim();
        if (name) return name;
        return report.responsible?.email || '-';
    }

    getSelectedRegisterName(): string {
        const selected = this.registerOptions.find((opt) => opt.value === this.selectedRegisterId);
        return selected?.label || '';
    }

    openSessionMovementDialog() {
        if (!this.posService.currentSession()) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Debe abrir una sesion de caja' });
            return;
        }
        if (!this.registerWarehouseId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El TPV no tiene almacen asociado' });
            return;
        }
        this.sessionMovement = {
            type: 'IN',
            productId: '',
            qty: 1,
            reason: ''
        };
        this.onSessionMovementTypeChange();
        this.loadMovementStockForWarehouse(this.registerWarehouseId);
        this.sessionMovementDialog = true;
    }

    onSessionMovementTypeChange() {
        this.refreshMovementProductOptions();
    }

    onSessionMovementProductChange() {
        const allowFractional = this.isSessionMovementFractionalProduct();
        const normalizedQty = this.normalizeMovementQty(this.sessionMovement.qty, allowFractional);
        this.sessionMovement.qty = normalizedQty > 0 ? normalizedQty : 1;
    }

    isSessionMovementFractionalProduct(): boolean {
        return this.isMovementProductFractional(this.sessionMovement.productId);
    }

    getMovementAvailableQty(productId: string): number {
        return Number(this.movementStockByProduct.get(productId) || 0);
    }

    saveSessionMovement() {
        const session = this.posService.currentSession();
        if (!session) return;

        if (!this.sessionMovement.productId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Seleccione un producto' });
            return;
        }

        const allowFractionalQty = this.isMovementProductFractional(this.sessionMovement.productId);
        const qty = this.normalizeMovementQty(this.sessionMovement.qty, allowFractionalQty);
        if (qty <= 0) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Ingrese una cantidad valida' });
            return;
        }
        this.sessionMovement.qty = qty;
        if (this.sessionMovement.type === 'OUT') {
            const available = this.getMovementAvailableQty(this.sessionMovement.productId);
            if (available <= 0) {
                this.messageService.add({ severity: 'warn', summary: 'Sin stock', detail: 'El producto no tiene stock en el almacen del TPV' });
                return;
            }
            if (qty > available + 1e-9) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Stock insuficiente',
                    detail: `Solo hay ${this.formatQty(available, allowFractionalQty)} unidades disponibles en el almacen del TPV`
                });
                return;
            }
        }

        if (!this.registerWarehouseId) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No se encontro almacen para este TPV' });
            return;
        }

        const payload: { type: 'IN' | 'OUT'; productId: string; qty: number; reason?: string } = {
            type: this.sessionMovement.type,
            productId: this.sessionMovement.productId,
            qty,
            reason: this.sessionMovement.reason?.trim() || undefined
        };

        this.posService.createSessionMovement(session.id, payload).subscribe({
            next: () => {
                this.sessionMovementDialog = false;
                this.loadSessionProducts(session.id);
                this.messageService.add({ severity: 'success', summary: 'Exito', detail: 'Movimiento registrado' });
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo registrar el movimiento'
                });
            }
        });
    }

    openSessionIpvDialog() {
        const session = this.posService.currentSession();
        if (!session) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Debe abrir una sesion para ver el IPV' });
            return;
        }

        this.sessionIpvDialog = true;
        this.sessionIpvLoading.set(true);
        this.sessionIpvReport.set(null);
        this.sessionIpvConfiguredPaymentMethods = [];
        forkJoin({
            report: this.inventoryReportsService.getSessionIpv(session.id),
            settings: this.settingsService.getRegisterSettings(session.registerId).pipe(catchError(() => of(null)))
        }).subscribe({
            next: ({ report, settings }) => {
                this.sessionIpvReport.set(report);
                this.sessionIpvConfiguredPaymentMethods = (settings?.paymentMethods || []).filter((method) => method.enabled !== false);
                this.sessionIpvLoading.set(false);
            },
            error: (err) => {
                this.sessionIpvReport.set(null);
                this.sessionIpvConfiguredPaymentMethods = [];
                this.sessionIpvLoading.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo cargar el IPV de la sesion'
                });
            }
        });
    }

    exportSessionIpvAsXlsx() {
        const report = this.sessionIpvReport();
        if (!report) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay reporte IPV para exportar' });
            return;
        }

        const rows = this.buildSessionIpvExportRows(report);
        const sheetXml = this.buildXlsxSheet(rows);
        const xlsxBlob = this.buildXlsxZipBlob(sheetXml);
        this.downloadBlob(
            xlsxBlob,
            `ipv-${report.register.code || 'tpv'}-${this.formatFileDate(new Date())}.xlsx`
        );
    }

    exportSessionIpvAsPdf() {
        const report = this.sessionIpvReport();
        if (!report) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'No hay reporte IPV para exportar' });
            return;
        }

        const pdfBlob = this.buildSessionIpvProfessionalPdfBlob(report);
        this.downloadBlob(
            pdfBlob,
            `ipv-${report.register.code || 'tpv'}-${this.formatFileDate(new Date())}.pdf`
        );
    }

    getCartQty(productId: string): number {
        const item = this.posService.cart().find((p) => p.productId === productId);
        return item?.qty || 0;
    }

    hasPositiveCartItems(): boolean {
        return this.positiveCartItems().length > 0;
    }

    formatQty(value: number, allowFractional: boolean): string {
        const safe = this.roundQty(Number(value || 0));
        if (!allowFractional) {
            return `${Math.max(0, Math.floor(safe))}`;
        }
        return safe.toFixed(6).replace(/\.?0+$/, '');
    }

    isFractionalProduct(productId: string): boolean {
        return !!this.getProductById(productId)?.allowFractionalQty;
    }

    getAvailableQtyForProduct(product: Product): number {
        return this.normalizeAvailableQty(product);
    }

    private getAvailableQtyByProductId(productId: string): number {
        const product = this.getProductById(productId);
        return this.normalizeAvailableQty(product);
    }

    private getProductById(productId: string): Product | undefined {
        return this.products().find((p) => p.id === productId);
    }

    private getStepQtyForProduct(productId: string): number {
        return 1;
    }

    private normalizeAvailableQty(product?: Product): number {
        const raw = Number(product?.qtyAvailable || 0);
        const safe = Number.isFinite(raw) && raw > 0 ? this.roundQty(raw) : 0;
        if (!!product?.allowFractionalQty) {
            return safe;
        }
        return Math.max(0, Math.floor(safe));
    }

    private normalizeQtyForProduct(productId: string, value: number): number {
        if (!Number.isFinite(value) || value <= 0) {
            return 0;
        }
        const allowFractional = this.isFractionalProduct(productId);
        if (allowFractional) {
            return this.roundQty(value);
        }
        return Math.max(0, Math.floor(value));
    }

    private isMovementProductFractional(productId: string): boolean {
        if (!productId) return false;
        return !!this.movementProductsCatalog.find((p) => p.id === productId)?.allowFractionalQty;
    }

    private normalizeMovementQty(value: unknown, allowFractional: boolean): number {
        const parsed = this.parseInputNumberValue(value);
        if (parsed === null || parsed <= 0) return 0;
        if (allowFractional) {
            return Number(parsed.toFixed(2));
        }
        return Math.floor(parsed);
    }

    private applyCartQty(item: SaleItem, rawQty: number | null | undefined, notifyIfClamped: boolean): void {
        const parsedQty = Number(rawQty);
        if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
            this.posService.updateCartItemQty(item.productId, 0);
            return;
        }

        const normalizedQty = this.normalizeQtyForProduct(item.productId, parsedQty);
        if (normalizedQty <= 0) {
            this.posService.updateCartItemQty(item.productId, 0);
            return;
        }

        const available = this.getAvailableQtyByProductId(item.productId);
        if (available <= 0) {
            this.posService.updateCartItemQty(item.productId, 0);
            if (notifyIfClamped) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Sin stock',
                    detail: 'El producto ya no tiene stock disponible en este TPV'
                });
            }
            return;
        }

        if (normalizedQty > available) {
            this.posService.updateCartItemQty(item.productId, available);
            if (notifyIfClamped) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Stock insuficiente',
                    detail: `Solo hay ${this.formatQty(available, this.isFractionalProduct(item.productId))} unidades disponibles para ${item.productName}`
                });
            }
            return;
        }

        this.posService.updateCartItemQty(item.productId, normalizedQty);
    }

    private positiveCartItems(): SaleItem[] {
        return this.posService.cart().filter((item) => Number(item.qty || 0) > 0);
    }

    private parseInputNumberValue(value: unknown): number | null {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        const text = String(value).trim();
        if (!text) return null;
        const compact = text.replace(/\s+/g, '');
        const normalized = compact.includes(',') && compact.includes('.')
            ? compact.replace(/\./g, '').replace(',', '.')
            : compact.replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : null;
    }

    private readInputNumberRawValue(event: any): string | null {
        const directTarget = event?.target;
        if (directTarget instanceof HTMLInputElement) {
            return String(directTarget.value ?? '');
        }

        const originalTarget = event?.originalEvent?.target;
        if (originalTarget instanceof HTMLInputElement) {
            return String(originalTarget.value ?? '');
        }

        return null;
    }

    private loadProductsForMovements() {
        this.productsService.list().subscribe({
            next: (products) => {
                this.movementProductsCatalog = products.filter((p) => p.active);
                this.mergeProductCategoryMap(products);
                this.refreshMovementProductOptions();
                this.filterProducts();
            },
            error: () => {
                this.movementProductsCatalog = [];
                this.movementProductOptions = [];
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar el catalogo de productos para movimientos'
                });
            }
        });
    }

    private matchesTpvCategoryFilter(product: Product): boolean {
        if (this.selectedCategoryFilter === 'all') return true;
        return this.getProductCategoryName(product) === this.selectedCategoryFilter;
    }

    private getProductCategoryName(product: Product): string {
        const fromProduct = product.productCategory?.name?.trim();
        if (fromProduct) return fromProduct;
        return (this.productCategoryByProductId()[product.id] || '').trim();
    }

    private mergeProductCategoryMap(products: Product[]) {
        const current = this.productCategoryByProductId();
        const next: Record<string, string> = { ...current };
        for (const product of products || []) {
            const categoryName = product.productCategory?.name?.trim();
            if (categoryName) {
                next[product.id] = categoryName;
            }
        }
        this.productCategoryByProductId.set(next);
    }

    private loadMovementStockForWarehouse(warehouseId: string) {
        this.movementProductsLoading = true;
        this.warehousesService.getStock(warehouseId).subscribe({
            next: (stock) => {
                this.movementStockByProduct = new Map(stock.map((item) => [item.productId, Number(item.qty || 0)]));
                this.refreshMovementProductOptions();
                this.movementProductsLoading = false;
            },
            error: () => {
                this.movementStockByProduct = new Map();
                this.refreshMovementProductOptions();
                this.movementProductsLoading = false;
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar el stock del almacen del TPV'
                });
            }
        });
    }

    private refreshMovementProductOptions() {
        const isOut = this.sessionMovement.type === 'OUT';
        this.movementProductOptions = this.movementProductsCatalog
            .filter((product) => {
                if (!isOut) return true;
                return this.getMovementAvailableQty(product.id) > 0;
            })
            .map((product) => {
                const stock = this.getMovementAvailableQty(product.id);
                return {
                    label: `${product.codigo ? `${product.name} (${product.codigo})` : product.name}`,
                    value: product.id,
                    name: product.name,
                    codigo: product.codigo || product.barcode || '',
                    image: product.image || '',
                    price: Number(product.price || 0),
                    currency: (product.currency || this.paymentBaseCurrency()) as SystemCurrencyCode,
                    stock: Number(stock || 0),
                    allowFractionalQty: !!product.allowFractionalQty
                };
            });

        if (this.sessionMovement.productId) {
            const hasSelected = this.movementProductOptions.some((option) => option.value === this.sessionMovement.productId);
            if (!hasSelected) {
                this.sessionMovement.productId = '';
            }
        }
    }

    private loadRegisterWarehouse(registerId: string) {
        forkJoin({
            registerSettings: this.settingsService.getRegisterSettings(registerId).pipe(catchError(() => of(null))),
            activeSystemPaymentMethods: this.settingsService.listPaymentMethods().pipe(catchError(() => of([] as PaymentMethodSetting[])))
        }).subscribe({
            next: ({ registerSettings, activeSystemPaymentMethods }) => {
                if (this.selectedRegisterId !== registerId) return;
                this.applyRegisterCurrency(registerSettings?.currency || 'CUP');
                this.applyRegisterPaymentMethods(registerSettings?.paymentMethods || [], activeSystemPaymentMethods || []);
                this.resolveRegisterWarehouse(registerId, registerSettings?.warehouseId || '');
            },
            error: () => {
                if (this.selectedRegisterId !== registerId) return;
                this.applyRegisterCurrency('CUP');
                this.setDefaultPaymentMethods();
                this.resolveRegisterWarehouse(registerId, '');
            }
        });
    }

    private resolveRegisterWarehouse(registerId: string, warehouseIdFromSettings: string) {
        if (warehouseIdFromSettings) {
            this.registerWarehouseId = warehouseIdFromSettings;
            this.loadRegisterWarehouseName(warehouseIdFromSettings);
            return;
        }

        this.warehousesService.listWarehouses().subscribe({
            next: (warehouses) => {
                const registerWarehouse = warehouses.find((warehouse) => warehouse.registerId === registerId);
                if (!registerWarehouse) {
                    this.registerWarehouseId = '';
                    this.registerWarehouseName = '';
                    this.messageService.add({
                        severity: 'warn',
                        summary: 'Advertencia',
                        detail: 'El TPV no tiene almacen asociado. Configurelo en ajustes del TPV.'
                    });
                    return;
                }

                this.registerWarehouseId = registerWarehouse.id;
                this.registerWarehouseName = registerWarehouse.name;
                this.settingsService.saveRegisterSettings(registerId, { warehouseId: registerWarehouse.id }).subscribe({
                    next: () => {},
                    error: () => {}
                });
            },
            error: () => {
                this.registerWarehouseId = '';
                this.registerWarehouseName = '';
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Advertencia',
                    detail: 'No se pudo obtener el almacen asociado al TPV'
                });
            }
        });
    }

    private loadRegisterWarehouseName(warehouseId: string) {
        this.warehousesService.findWarehouse(warehouseId).subscribe({
            next: (warehouse) => {
                this.registerWarehouseName = warehouse.name;
            },
            error: () => {
                this.registerWarehouseName = warehouseId;
            }
        });
    }

    private handleNavigationParams() {
        this.route.queryParamMap.subscribe((params) => {
            const registerId = params.get('registerId');
            const actionParam = params.get('action');
            if (!registerId) return;

            const action: 'open' | 'continue' = actionParam === 'open' ? 'open' : 'continue';
            this.pendingNavigationSelection = { registerId, action };
            this.tryApplyNavigationSelection();
        });
    }

    private tryApplyNavigationSelection() {
        if (!this.pendingNavigationSelection || this.registerOptions.length === 0) return;

        const { registerId, action } = this.pendingNavigationSelection;
        const registerExists = this.registerOptions.some((opt) => opt.value === registerId);
        if (!registerExists) {
            this.messageService.add({
                severity: 'warn',
                summary: 'TPV no encontrado',
                detail: 'El TPV seleccionado ya no esta disponible.'
            });
            this.pendingNavigationSelection = null;
            return;
        }

        this.selectedRegisterId = registerId;
        this.pendingNavigationSelection = null;
        this.onRegisterChange(action);
    }

    private initPaymentLines() {
        const defaultMethod = this.getDefaultPaymentMethod();
        if (!defaultMethod) {
            this.paymentLines = [];
            return;
        }

        this.paymentLineSeq = 1;
        this.paymentLines = [
            {
                id: this.paymentLineSeq++,
                method: defaultMethod,
                currency: this.paymentDefaultCurrency,
                amount: this.roundMoney(this.cartTotal()),
                transactionCode: ''
            }
        ];
    }

    private validatePaymentsBeforeSubmit(): boolean {
        if (!this.paymentLines.length) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Debe agregar al menos una linea de pago' });
            return false;
        }

        const invalidLine = this.paymentLines.find((line) => !line.method || Number(line.amount || 0) <= 0);
        if (invalidLine) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Todas las lineas de pago deben tener metodo y monto mayor a 0' });
            return false;
        }

        const lineMissingCode = this.findLineMissingTransactionCode();
        if (lineMissingCode) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Código requerido',
                detail: `El método ${this.paymentMethodLabel(lineMissingCode.method)} requiere código de transacción`
            });
            return false;
        }

        const invalidCurrency = this.paymentLines.find((line) => !this.isCurrencyAllowed(line.currency));
        if (invalidCurrency) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Moneda inválida',
                detail: `Todas las líneas de pago deben registrarse en ${this.paymentBaseCurrency()}`
            });
            return false;
        }

        const disallowedLine = this.paymentLines.find((line) => !this.isPaymentMethodAllowed(line.method));
        if (disallowedLine) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Método no permitido',
                detail: 'Hay líneas con métodos de pago no configurados para este TPV'
            });
            return false;
        }

        if (this.hasDuplicatePaymentMethods()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Métodos duplicados',
                detail: 'No puede repetir el mismo método de pago en varias líneas'
            });
            return false;
        }

        if (this.paymentDifference() !== 0) {
            if (this.paymentDifference() > 0) {
                this.messageService.add({ severity: 'warn', summary: 'Pago incompleto', detail: `Falta ${this.absolutePaymentDifference().toFixed(2)} por cobrar` });
            } else {
                this.messageService.add({ severity: 'warn', summary: 'Pago excedido', detail: `Hay ${this.absolutePaymentDifference().toFixed(2)} de exceso en las lineas` });
            }
            return false;
        }

        return true;
    }

    private roundMoney(value: number): number {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    private roundQty(value: number): number {
        return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
    }

    private applyRegisterCurrency(registerCurrency?: string | null) {
        const normalized = this.normalizeRegisterCurrency(registerCurrency);
        this.paymentDefaultCurrency = normalized;
        this.paymentEnabledCurrencies = [normalized];
        this.closeCashCurrency = normalized;
        this.sanitizePaymentLines();
        this.filterProducts();
    }

    private normalizeRegisterCurrency(value?: string | null): SystemCurrencyCode {
        const normalized = (value || '').toString().trim().toUpperCase();
        return normalized === 'USD' ? 'USD' : 'CUP';
    }

    private toBaseAmount(amount: number, _currency: SystemCurrencyCode): number {
        if (!Number.isFinite(amount) || amount <= 0) return 0;
        return this.roundMoney(amount);
    }

    private fromBaseAmount(baseAmount: number, _currency: SystemCurrencyCode): number {
        if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
        return this.roundMoney(baseAmount);
    }

    private setDefaultPaymentMethods() {
        const defaultCodes = this.paymentMethodCatalog
            .filter((item) => item.defaultEnabled)
            .map((item) => item.value);
        this.setPaymentMethods(defaultCodes);
    }

    private applyRegisterPaymentMethods(settingsMethods: PaymentMethodSetting[], activeSystemMethods: PaymentMethodSetting[] = []) {
        const metadata = new Map<Payment['method'], { label?: string; requiresTransactionCode: boolean }>();
        const activeSystemCodes = this.collectEnabledPaymentMethodCodes(activeSystemMethods, metadata);
        const configuredCodes = this.collectEnabledPaymentMethodCodes(settingsMethods, metadata);

        if (configuredCodes.length > 0) {
            if (activeSystemCodes.length > 0) {
                const activeSet = new Set(activeSystemCodes);
                const configuredActiveCodes = configuredCodes.filter((code) => activeSet.has(code));
                if (configuredActiveCodes.length > 0) {
                    this.setPaymentMethods(configuredActiveCodes, metadata);
                    return;
                }
            } else {
                this.setPaymentMethods(configuredCodes, metadata);
                return;
            }
        }

        if (activeSystemCodes.length > 0) {
            this.setPaymentMethods(activeSystemCodes, metadata);
            return;
        }

        this.setDefaultPaymentMethods();
    }

    private collectEnabledPaymentMethodCodes(
        methods: PaymentMethodSetting[],
        metadata: Map<Payment['method'], { label?: string; requiresTransactionCode: boolean }>
    ): Payment['method'][] {
        const codes = Array.from(
            new Set(
                (methods || [])
                    .filter((method) => method.enabled !== false)
                    .map((method) => {
                        const code = this.normalizePaymentMethodCode(method.code);
                        if (!code) return null;
                        metadata.set(code, {
                            label: String(method.name || '').trim() || undefined,
                            requiresTransactionCode: method.requiresTransactionCode === true
                        });
                        return code;
                    })
                    .filter((code): code is Payment['method'] => !!code)
            )
        );
        return codes;
    }

    private normalizePaymentMethodCode(code: string): Payment['method'] | null {
        const normalized = (code || '').trim().toUpperCase();
        switch (normalized) {
            case 'CASH':
            case 'EFECTIVO':
                return 'CASH';
            case 'CARD':
            case 'TARJETA':
                return 'CARD';
            case 'TRANSFER':
            case 'TRANSFERENCIA':
                return 'TRANSFER';
            case 'OTHER':
            case 'OTRO':
                return 'OTHER';
            default:
                return null;
        }
    }

    private setPaymentMethods(
        codes: Payment['method'][],
        metadata?: Map<Payment['method'], { label?: string; requiresTransactionCode: boolean }>
    ) {
        const allowed = new Set(codes);
        this.paymentMethods = this.paymentMethodCatalog
            .filter((item) => allowed.has(item.value))
            .map(({ label, value, defaultRequiresTransactionCode }) => {
                const custom = metadata?.get(value);
                return {
                    label: custom?.label || label,
                    value,
                    requiresTransactionCode: custom?.requiresTransactionCode ?? defaultRequiresTransactionCode
                };
            });

        this.allowedPaymentMethods = new Set(this.paymentMethods.map((item) => item.value));
        this.sanitizePaymentLines();
    }

    private sanitizePaymentLines() {
        if (!this.paymentLines.length) return;

        const defaultMethod = this.getDefaultPaymentMethod();
        if (!defaultMethod) {
            this.paymentLines = [];
            return;
        }

        let hasChanges = false;
        const sanitized = this.paymentLines.map((line) => {
            let next = line;
            if (!this.isPaymentMethodAllowed(line.method)) {
                hasChanges = true;
                next = { ...next, method: defaultMethod, transactionCode: '' };
            }

            if (!this.isCurrencyAllowed(next.currency)) {
                hasChanges = true;
                next = { ...next, currency: this.paymentDefaultCurrency };
            }

            if (!this.requiresTransactionCodeForMethod(next.method) && next.transactionCode) {
                hasChanges = true;
                next = { ...next, transactionCode: '' };
            }

            return next;
        });

        if (hasChanges) {
            this.paymentLines = sanitized;
        }

        this.removeDuplicatePaymentLines();
    }

    private isPaymentMethodAllowed(method: Payment['method']): boolean {
        return this.allowedPaymentMethods.has(method);
    }

    private isCurrencyAllowed(currency: SystemCurrencyCode): boolean {
        return this.paymentEnabledCurrencies.includes(currency);
    }

    private getDefaultPaymentMethod(): Payment['method'] | null {
        return this.paymentMethods.length > 0 ? this.paymentMethods[0].value : null;
    }

    getPaymentMethodOptionsForLine(index: number): Array<{ label: string; value: Payment['method']; requiresTransactionCode: boolean }> {
        const line = this.paymentLines[index];
        if (!line) return this.paymentMethods;

        const usedByOthers = new Set<Payment['method']>(
            this.paymentLines
                .filter((_, i) => i !== index)
                .map((item) => item.method)
        );

        return this.paymentMethods.filter((option) => !usedByOthers.has(option.value) || option.value === line.method);
    }

    onPaymentMethodChanged(index: number, method: Payment['method']) {
        if (!this.isPaymentMethodAllowed(method)) {
            return;
        }

        if (!this.isPaymentMethodDuplicated(index, method)) {
            if (!this.requiresTransactionCodeForMethod(method) && this.paymentLines[index]) {
                this.paymentLines[index].transactionCode = '';
                this.paymentLines = [...this.paymentLines];
            }
            return;
        }

        const fallback = this.getFallbackPaymentMethodForLine(index, method);
        if (fallback) {
            this.paymentLines[index].method = fallback;
            if (!this.requiresTransactionCodeForMethod(fallback)) {
                this.paymentLines[index].transactionCode = '';
            }
            this.paymentLines = [...this.paymentLines];
        }

        this.messageService.add({
            severity: 'warn',
            summary: 'Método duplicado',
            detail: 'Cada línea debe usar un método de pago diferente'
        });
    }

    paymentBaseCurrency(): SystemCurrencyCode {
        return this.paymentDefaultCurrency;
    }

    private isPaymentMethodAlreadyUsed(method: Payment['method']): boolean {
        return this.paymentLines.some((line) => line.method === method);
    }

    private isPaymentMethodDuplicated(index: number, method: Payment['method']): boolean {
        return this.paymentLines.some((line, i) => i !== index && line.method === method);
    }

    private hasDuplicatePaymentMethods(): boolean {
        const used = new Set<Payment['method']>();
        for (const line of this.paymentLines) {
            if (!line.method) continue;
            if (used.has(line.method)) return true;
            used.add(line.method);
        }
        return false;
    }

    private getNextAvailablePaymentMethod(): Payment['method'] | null {
        const used = new Set<Payment['method']>(this.paymentLines.map((line) => line.method));
        const available = this.paymentMethods.find((option) => !used.has(option.value));
        return available?.value || null;
    }

    private getFallbackPaymentMethodForLine(index: number, currentMethod: Payment['method']): Payment['method'] | null {
        const fallback = this.getPaymentMethodOptionsForLine(index).find((option) => option.value !== currentMethod);
        return fallback?.value || null;
    }

    private removeDuplicatePaymentLines() {
        const used = new Set<Payment['method']>();
        this.paymentLines = this.paymentLines.filter((line) => {
            if (!line.method) return true;
            if (used.has(line.method)) return false;
            used.add(line.method);
            return true;
        });
    }

    requiresTransactionCodeForMethod(method: Payment['method']): boolean {
        const option = this.paymentMethods.find((item) => item.value === method);
        if (option) return option.requiresTransactionCode === true;
        const fallback = this.paymentMethodCatalog.find((item) => item.value === method);
        return fallback?.defaultRequiresTransactionCode === true;
    }

    private paymentMethodLabel(method: Payment['method']): string {
        return this.paymentMethods.find((item) => item.value === method)?.label || method;
    }

    private findLineMissingTransactionCode() {
        return this.paymentLines.find((line) => this.requiresTransactionCodeForMethod(line.method) && !String(line.transactionCode || '').trim()) || null;
    }

    onAmountFieldInteraction(event: Event): void {
        const target = event.target as HTMLElement | null;
        const input =
            target instanceof HTMLInputElement
                ? target
                : (target?.closest('.tpv-payment-line-amount')?.querySelector('input') as HTMLInputElement | null);

        if (!input) return;
        setTimeout(() => input.select(), 0);
    }

    paymentTotal(): number {
        return this.roundMoney(
            this.paymentLines.reduce((sum, line) => sum + this.toBaseAmount(Number(line.amount || 0), line.currency), 0)
        );
    }

    paymentDifference(): number {
        return this.roundMoney(this.cartTotal() - this.paymentTotal());
    }

    absolutePaymentDifference(): number {
        return Math.abs(this.paymentDifference());
    }

    private buildSessionIpvExportRows(report: SessionIvpReport): Array<Array<string | number>> {
        const paymentRows = this.sessionIpvPaymentSummaryRowsFromReport(report);
        const rows: Array<Array<string | number>> = [
            ['REPORTE IPV DE SESION'],
            ['TPV', report.register.name],
            ['Fecha apertura', this.formatDateTime(report.openedAt)],
            ['Responsable', this.resolveSessionIpvResponsibleName(report)],
            [],
            ['RESUMEN'],
            ['Total de ventas', report.totals.salesCount ?? report.totals.sales],
            ['Total de entradas', report.totals.entriesCount ?? report.totals.entries],
            ['Total de salidas', report.totals.outsCount ?? report.totals.outs],
        ];

        for (const paymentRow of paymentRows) {
            rows.push([`Total ${paymentRow.label.toLowerCase()}`, Number(paymentRow.amount || 0)]);
        }

        rows.push([]);
        rows.push(['DETALLE DE PRODUCTOS']);
        rows.push(['Producto', 'Codigo', 'Inicio', 'Entradas', 'Salidas', 'Ventas', 'Total', 'Final', 'Precio', 'Importe']);

        for (const line of report.lines) {
            rows.push([
                line.name,
                line.codigo || '-',
                line.initial,
                line.entries,
                line.outs,
                line.sales,
                line.total,
                line.final,
                line.price,
                line.amount,
            ]);
        }

        rows.push([]);
        rows.push(['TOTAL IMPORTE', '', '', '', '', '', '', '', '', report.totals.amount]);
        return rows;
    }

    private buildSessionIpvProfessionalPdfBlob(report: SessionIvpReport): Blob {
        const pages: string[] = [];
        let rowIndex = 0;
        let forceTotalsPage = false;

        while (rowIndex < report.lines.length || forceTotalsPage || pages.length === 0) {
            const page = this.buildSessionIpvProfessionalPdfPage({
                report,
                paymentRows: this.sessionIpvPaymentSummaryRowsFromReport(report),
                rowIndex,
                pageNumber: pages.length + 1,
                isFirstPage: pages.length === 0,
                forceTotalsPage
            });

            pages.push(page.content);
            rowIndex = page.nextRowIndex;
            forceTotalsPage = !page.totalsDrawn && rowIndex >= report.lines.length;

            if (forceTotalsPage && page.rowsDrawn === 0) {
                // Salvaguarda para evitar bucle infinito si no hay espacio utilizable.
                forceTotalsPage = false;
            }
        }

        return this.buildPdfFromContentPages(pages);
    }

    private buildSessionIpvProfessionalPdfPage(params: {
        report: SessionIvpReport;
        paymentRows: Array<{ code: string; label: string; amount: number }>;
        rowIndex: number;
        pageNumber: number;
        isFirstPage: boolean;
        forceTotalsPage: boolean;
    }): { content: string; nextRowIndex: number; totalsDrawn: boolean; rowsDrawn: number } {
        const { report, paymentRows, rowIndex, pageNumber, isFirstPage, forceTotalsPage } = params;

        const pageWidth = 595;
        const pageHeight = 842;
        const marginX = 24;
        const headerTop = 24;
        const contentWidth = pageWidth - marginX * 2;
        const footerTop = 808;
        const tableHeaderHeight = 18;
        const tableRowHeight = 16;
        const tableMaxTop = 780;

        const columns: Array<{ key: string; label: string; width: number; align: 'left' | 'right' }> = [
            { key: 'name', label: 'Producto', width: 150, align: 'left' },
            { key: 'codigo', label: 'Cod', width: 55, align: 'left' },
            { key: 'initial', label: 'Ini', width: 32, align: 'right' },
            { key: 'entries', label: 'Ent', width: 32, align: 'right' },
            { key: 'outs', label: 'Sal', width: 32, align: 'right' },
            { key: 'sales', label: 'Ven', width: 32, align: 'right' },
            { key: 'total', label: 'Tot', width: 32, align: 'right' },
            { key: 'final', label: 'Fin', width: 32, align: 'right' },
            { key: 'price', label: 'Precio', width: 65, align: 'right' },
            { key: 'amount', label: 'Importe', width: 85, align: 'right' }
        ];

        const ops: string[] = [];
        const generatedAt = this.formatDateTime(new Date().toISOString());

        const toPdfY = (top: number) => pageHeight - top;
        const color = (rgb: [number, number, number]) => rgb.map((v) => (v / 255).toFixed(3)).join(' ');
        const safeText = (value: string) => this.escapePdfText(this.toAscii(value));

        const drawRect = (
            x: number,
            top: number,
            width: number,
            height: number,
            fill?: [number, number, number],
            stroke?: [number, number, number]
        ) => {
            const y = pageHeight - top - height;
            if (fill) ops.push(`${color(fill)} rg`);
            if (stroke) ops.push(`${color(stroke)} RG`);
            ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re ${fill && stroke ? 'B' : fill ? 'f' : 'S'}`);
        };

        const drawLine = (x1: number, top1: number, x2: number, top2: number, stroke: [number, number, number], lineWidth = 1) => {
            ops.push(`${lineWidth.toFixed(2)} w`);
            ops.push(`${color(stroke)} RG`);
            ops.push(`${x1.toFixed(2)} ${toPdfY(top1).toFixed(2)} m ${x2.toFixed(2)} ${toPdfY(top2).toFixed(2)} l S`);
        };

        const drawText = (
            value: string,
            x: number,
            topBaseline: number,
            options?: { font?: 'F1' | 'F2'; size?: number; color?: [number, number, number]; align?: 'left' | 'right'; maxChars?: number }
        ) => {
            const font = options?.font || 'F1';
            const size = options?.size || 10;
            const textColor: [number, number, number] = options?.color || [33, 37, 41];
            const align = options?.align || 'left';
            const maxChars = options?.maxChars || 200;
            const raw = value || '';
            const fitted = raw.length <= maxChars ? raw : `${raw.slice(0, Math.max(0, maxChars - 3))}...`;
            const safe = safeText(fitted);
            const estimateWidth = safe.length * (size * (font === 'F2' ? 0.54 : 0.5));
            const textX = align === 'right' ? x - estimateWidth : x;

            ops.push('BT');
            ops.push(`/${font} ${size} Tf`);
            ops.push(`${color(textColor)} rg`);
            ops.push(`${textX.toFixed(2)} ${toPdfY(topBaseline).toFixed(2)} Td`);
            ops.push(`(${safe}) Tj`);
            ops.push('ET');
        };

        drawRect(marginX, headerTop, contentWidth, 42, [16, 38, 84], [16, 38, 84]);
        drawText('REPORTE IPV DE SESION', marginX + 12, headerTop + 26, { font: 'F2', size: 15, color: [255, 255, 255] });
        drawText(`Generado: ${generatedAt}`, pageWidth - marginX - 12, headerTop + 26, { size: 9, color: [235, 241, 255], align: 'right' });
        drawText(`Pagina ${pageNumber}`, pageWidth - marginX - 12, headerTop + 38, { size: 8, color: [208, 221, 255], align: 'right' });

        let topCursor = headerTop + 54;

        if (isFirstPage) {
            drawRect(marginX, topCursor, contentWidth, 58, [245, 248, 252], [214, 221, 229]);
            drawText(`TPV: ${report.register.name}`, marginX + 12, topCursor + 20, { font: 'F2', size: 10 });
            drawText(`Apertura: ${this.formatDateTime(report.openedAt)}`, marginX + 12, topCursor + 34, { size: 10, color: [68, 84, 106] });
            drawText(`Responsable: ${this.resolveSessionIpvResponsibleName(report)}`, marginX + 12, topCursor + 48, { size: 10, color: [68, 84, 106] });
            topCursor += 86;

            drawText('Resumen Ejecutivo', marginX, topCursor + 12, { font: 'F2', size: 11, color: [27, 44, 94] });
            topCursor += 20;

            const summaryRows = [
                { label: 'Total de ventas', value: String(report.totals.salesCount ?? report.totals.sales) },
                { label: 'Total de entradas', value: String(report.totals.entriesCount ?? report.totals.entries) },
                { label: 'Total de salidas', value: String(report.totals.outsCount ?? report.totals.outs) },
                ...paymentRows.map((row) => ({ label: `Total ${row.label.toLowerCase()}`, value: this.roundMoney(row.amount).toFixed(2) })),
                { label: 'Importe total', value: this.roundMoney(report.totals.amount).toFixed(2) }
            ];

            const boxWidth = (contentWidth - 16) / 2;
            const lineHeight = 14;
            const perBox = Math.ceil(summaryRows.length / 2);
            const boxHeight = perBox * lineHeight + 16;

            drawRect(marginX, topCursor, boxWidth, boxHeight, [251, 253, 255], [214, 221, 229]);
            drawRect(marginX + boxWidth + 16, topCursor, boxWidth, boxHeight, [251, 253, 255], [214, 221, 229]);

            for (let i = 0; i < summaryRows.length; i++) {
                const row = summaryRows[i];
                const isRight = i >= perBox;
                const localIndex = isRight ? i - perBox : i;
                const rowTop = topCursor + 16 + localIndex * lineHeight;
                const xBase = isRight ? marginX + boxWidth + 16 : marginX;
                drawText(row.label, xBase + 10, rowTop, { size: 9, color: [66, 82, 102], maxChars: 28 });
                drawText(row.value, xBase + boxWidth - 10, rowTop, { font: 'F2', size: 9, align: 'right' });
            }

            topCursor += boxHeight + 22;
        } else {
            drawRect(marginX, topCursor, contentWidth, 46, [247, 250, 254], [220, 228, 236]);
            drawText(`TPV: ${report.register.name}`, marginX + 12, topCursor + 16, { font: 'F2', size: 9 });
            drawText(`Apertura: ${this.formatDateTime(report.openedAt)}`, marginX + 12, topCursor + 28, { size: 9, color: [68, 84, 106] });
            drawText(`Responsable: ${this.resolveSessionIpvResponsibleName(report)}`, marginX + 12, topCursor + 40, { size: 9, color: [68, 84, 106] });
            topCursor += 58;
        }

        const tableTop = Math.max(topCursor, 164);
        let rowTop = tableTop;
        drawRect(marginX, rowTop, contentWidth, tableHeaderHeight, [228, 236, 248], [160, 177, 204]);

        let columnX = marginX;
        for (const column of columns) {
            const textX = column.align === 'right' ? columnX + column.width - 6 : columnX + 6;
            drawText(column.label, textX, rowTop + 12, {
                font: 'F2',
                size: 8,
                color: [30, 54, 96],
                align: column.align,
                maxChars: column.key === 'name' ? 18 : 12
            });
            drawLine(columnX, rowTop, columnX, rowTop + tableHeaderHeight, [160, 177, 204], 0.6);
            columnX += column.width;
        }
        drawLine(marginX + contentWidth, rowTop, marginX + contentWidth, rowTop + tableHeaderHeight, [160, 177, 204], 0.6);

        rowTop += tableHeaderHeight;

        let currentIndex = rowIndex;
        let rowsDrawn = 0;
        while (currentIndex < report.lines.length && rowTop + tableRowHeight <= tableMaxTop) {
            const line = report.lines[currentIndex];
            if (rowsDrawn % 2 === 0) {
                drawRect(marginX, rowTop, contentWidth, tableRowHeight, [250, 252, 255], [230, 235, 242]);
            } else {
                drawRect(marginX, rowTop, contentWidth, tableRowHeight, [255, 255, 255], [230, 235, 242]);
            }

            const rowValues: Record<string, string> = {
                name: line.name || '-',
                codigo: line.codigo || '-',
                initial: `${line.initial}`,
                entries: `${line.entries}`,
                outs: `${line.outs}`,
                sales: `${line.sales}`,
                total: `${line.total}`,
                final: `${line.final}`,
                price: this.roundMoney(line.price).toFixed(2),
                amount: this.roundMoney(line.amount).toFixed(2)
            };

            let x = marginX;
            for (const column of columns) {
                const maxChars = column.key === 'name' ? 30 : column.key === 'codigo' ? 12 : 10;
                const textX = column.align === 'right' ? x + column.width - 6 : x + 6;
                drawText(rowValues[column.key], textX, rowTop + 11, {
                    size: 8.2,
                    align: column.align,
                    maxChars
                });
                drawLine(x, rowTop, x, rowTop + tableRowHeight, [230, 235, 242], 0.5);
                x += column.width;
            }
            drawLine(marginX + contentWidth, rowTop, marginX + contentWidth, rowTop + tableRowHeight, [230, 235, 242], 0.5);

            rowTop += tableRowHeight;
            currentIndex += 1;
            rowsDrawn += 1;
        }

        let totalsDrawn = false;
        if ((currentIndex >= report.lines.length || forceTotalsPage) && rowTop + tableRowHeight <= tableMaxTop) {
            drawRect(marginX, rowTop, contentWidth, tableRowHeight, [226, 244, 235], [146, 178, 163]);
            drawText('TOTAL IMPORTE', marginX + contentWidth - 140, rowTop + 11, { font: 'F2', size: 8.6, align: 'right' });
            drawText(this.roundMoney(report.totals.amount).toFixed(2), marginX + contentWidth - 6, rowTop + 11, {
                font: 'F2',
                size: 8.6,
                align: 'right'
            });
            totalsDrawn = true;
        }

        drawLine(marginX, footerTop - 10, pageWidth - marginX, footerTop - 10, [208, 216, 228], 0.7);
        drawText(
            `Reporte IPV | ${report.register.name} | Sesion ${report.cashSessionId.slice(0, 8)} | Estado ${report.status}`,
            marginX,
            footerTop + 4,
            { size: 8, color: [93, 109, 130], maxChars: 95 }
        );
        drawText(`Pagina ${pageNumber}`, pageWidth - marginX, footerTop + 4, { size: 8, color: [93, 109, 130], align: 'right' });

        return {
            content: ops.join('\n'),
            nextRowIndex: currentIndex,
            totalsDrawn,
            rowsDrawn
        };
    }

    private buildXlsxSheet(rows: Array<Array<string | number>>): string {
        const rowXml = rows
            .map((row, rowIndex) => {
                const cellsXml = row
                    .map((value, columnIndex) => this.buildXlsxCell(value, rowIndex + 1, columnIndex + 1))
                    .join('');
                return `<row r="${rowIndex + 1}">${cellsXml}</row>`;
            })
            .join('');

        return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
    }

    private buildXlsxCell(value: string | number, row: number, column: number): string {
        const ref = `${this.columnToLetters(column)}${row}`;
        if (typeof value === 'number') {
            return `<c r="${ref}" t="n"><v>${Number(value)}</v></c>`;
        }

        const escapedValue = this.escapeXml(value ?? '');
        return `<c r="${ref}" t="inlineStr"><is><t>${escapedValue}</t></is></c>`;
    }

    private buildXlsxZipBlob(sheetXml: string): Blob {
        const encoder = new TextEncoder();
        const entries: Array<{ name: string; content: Uint8Array }> = [
            {
                name: '[Content_Types].xml',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`),
            },
            {
                name: '_rels/.rels',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
            },
            {
                name: 'xl/workbook.xml',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="IPV" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`),
            },
            {
                name: 'xl/_rels/workbook.xml.rels',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`),
            },
            {
                name: 'xl/styles.xml',
                content: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`),
            },
            {
                name: 'xl/worksheets/sheet1.xml',
                content: encoder.encode(sheetXml),
            },
        ];

        return this.buildZip(entries, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }

    private buildSimplePdfBlob(lines: string[]): Blob {
        const linesPerPage = 45;
        const pages: string[][] = [];
        for (let i = 0; i < lines.length; i += linesPerPage) {
            pages.push(lines.slice(i, i + linesPerPage));
        }

        const objects: string[] = [];
        const pageIds: number[] = [];
        const contentIds: number[] = [];
        let objectId = 4;

        for (let index = 0; index < pages.length; index++) {
            pageIds.push(objectId++);
            contentIds.push(objectId++);
        }

        objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
        objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

        for (let index = 0; index < pages.length; index++) {
            const content = this.buildPdfContent(pages[index]);
            const pageId = pageIds[index];
            const contentId = contentIds[index];
            objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
            objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
        }

        let pdf = '%PDF-1.4\n';
        const offsets: number[] = [0];

        for (let i = 1; i < objects.length; i++) {
            if (!objects[i]) continue;
            offsets[i] = pdf.length;
            pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
        }

        const xrefStart = pdf.length;
        pdf += `xref\n0 ${objects.length}\n`;
        pdf += '0000000000 65535 f \n';

        for (let i = 1; i < objects.length; i++) {
            const offset = offsets[i] || 0;
            pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
        }

        pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    }

    private buildPdfFromContentPages(contentPages: string[]): Blob {
        const pages = contentPages.length > 0 ? contentPages : [''];
        const objects: string[] = [];
        const pageIds: number[] = [];
        const contentIds: number[] = [];
        let objectId = 5;

        for (let index = 0; index < pages.length; index++) {
            pageIds.push(objectId++);
            contentIds.push(objectId++);
        }

        objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
        objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] >>`;
        objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
        objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';

        for (let index = 0; index < pages.length; index++) {
            const content = pages[index] || '';
            const pageId = pageIds[index];
            const contentId = contentIds[index];
            objects[pageId] =
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
                `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`;
            objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
        }

        let pdf = '%PDF-1.4\n';
        const offsets: number[] = [0];

        for (let i = 1; i < objects.length; i++) {
            if (!objects[i]) continue;
            offsets[i] = pdf.length;
            pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
        }

        const xrefStart = pdf.length;
        pdf += `xref\n0 ${objects.length}\n`;
        pdf += '0000000000 65535 f \n';

        for (let i = 1; i < objects.length; i++) {
            const offset = offsets[i] || 0;
            pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
        }

        pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
        return new Blob([pdf], { type: 'application/pdf' });
    }

    private buildPdfContent(lines: string[]): string {
        const safeLines = lines.map((line) => this.escapePdfText(this.toAscii(line)));
        const content: string[] = [
            'BT',
            '/F1 10 Tf',
            '14 TL',
            '40 805 Td',
        ];

        for (let i = 0; i < safeLines.length; i++) {
            const line = safeLines[i];
            content.push(`(${line}) Tj`);
            if (i < safeLines.length - 1) {
                content.push('T*');
            }
        }

        content.push('ET');
        return content.join('\n');
    }

    private buildZip(entries: Array<{ name: string; content: Uint8Array }>, mimeType: string): Blob {
        const fileParts: Uint8Array[] = [];
        const centralParts: Uint8Array[] = [];
        let offset = 0;
        let centralDirectorySize = 0;

        for (const entry of entries) {
            const nameBytes = new TextEncoder().encode(entry.name);
            const crc = this.crc32(entry.content);
            const localHeader = new Uint8Array(30);
            const localView = new DataView(localHeader.buffer);

            localView.setUint32(0, 0x04034b50, true);
            localView.setUint16(4, 20, true);
            localView.setUint16(6, 0, true);
            localView.setUint16(8, 0, true);
            localView.setUint16(10, 0, true);
            localView.setUint16(12, 0, true);
            localView.setUint32(14, crc, true);
            localView.setUint32(18, entry.content.length, true);
            localView.setUint32(22, entry.content.length, true);
            localView.setUint16(26, nameBytes.length, true);
            localView.setUint16(28, 0, true);

            fileParts.push(localHeader, nameBytes, entry.content);

            const centralHeader = new Uint8Array(46);
            const centralView = new DataView(centralHeader.buffer);
            centralView.setUint32(0, 0x02014b50, true);
            centralView.setUint16(4, 20, true);
            centralView.setUint16(6, 20, true);
            centralView.setUint16(8, 0, true);
            centralView.setUint16(10, 0, true);
            centralView.setUint16(12, 0, true);
            centralView.setUint16(14, 0, true);
            centralView.setUint32(16, crc, true);
            centralView.setUint32(20, entry.content.length, true);
            centralView.setUint32(24, entry.content.length, true);
            centralView.setUint16(28, nameBytes.length, true);
            centralView.setUint16(30, 0, true);
            centralView.setUint16(32, 0, true);
            centralView.setUint16(34, 0, true);
            centralView.setUint16(36, 0, true);
            centralView.setUint32(38, 0, true);
            centralView.setUint32(42, offset, true);

            centralParts.push(centralHeader, nameBytes);

            const localSize = localHeader.length + nameBytes.length + entry.content.length;
            offset += localSize;
            centralDirectorySize += centralHeader.length + nameBytes.length;
        }

        const endHeader = new Uint8Array(22);
        const endView = new DataView(endHeader.buffer);
        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(4, 0, true);
        endView.setUint16(6, 0, true);
        endView.setUint16(8, entries.length, true);
        endView.setUint16(10, entries.length, true);
        endView.setUint32(12, centralDirectorySize, true);
        endView.setUint32(16, offset, true);
        endView.setUint16(20, 0, true);

        const blobParts: BlobPart[] = [...fileParts, ...centralParts, endHeader].map((part) => {
            const copy = new Uint8Array(part.byteLength);
            copy.set(part);
            return copy.buffer;
        });
        return new Blob(blobParts, { type: mimeType });
    }

    private crc32(bytes: Uint8Array): number {
        let crc = 0xffffffff;

        for (let i = 0; i < bytes.length; i++) {
            crc ^= bytes[i];
            for (let j = 0; j < 8; j++) {
                crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
            }
        }

        return (crc ^ 0xffffffff) >>> 0;
    }

    private downloadBlob(blob: Blob, fileName: string) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);
    }

    private columnToLetters(column: number): string {
        let num = column;
        let letters = '';
        while (num > 0) {
            const remainder = (num - 1) % 26;
            letters = String.fromCharCode(65 + remainder) + letters;
            num = Math.floor((num - 1) / 26);
        }
        return letters;
    }

    private escapeXml(value: string): string {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll('\'', '&apos;');
    }

    private escapePdfText(value: string): string {
        return value
            .replaceAll('\\', '\\\\')
            .replaceAll('(', '\\(')
            .replaceAll(')', '\\)');
    }

    private toAscii(value: string): string {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\x20-\x7e]/g, '');
    }

    private formatDateTime(value: string | null | undefined): string {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';

        const formatter = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        return formatter.format(date);
    }

    private formatFileDate(date: Date): string {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        const hours = `${date.getHours()}`.padStart(2, '0');
        const minutes = `${date.getMinutes()}`.padStart(2, '0');
        return `${year}${month}${day}-${hours}${minutes}`;
    }

    private truncateForPdf(value: string, maxLength: number): string {
        if (value.length <= maxLength) return value;
        return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
    }

    private getEmptyNewCustomerForm() {
        return {
            name: '',
            identification: '',
            phone: '',
            email: '',
            address: ''
        };
    }
}
