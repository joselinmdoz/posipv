import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { PosService, SaleItem, CashSession, Register } from '@/app/core/services/pos.service';
import { ProductsService, Product } from '@/app/core/services/products.service';

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
        ToastModule,
        TagModule
    ],
    providers: [MessageService],
    template: `
        <div class="flex h-screen gap-4 p-4">
            <!-- Panel Izquierdo: Productos -->
            <div class="flex-1 flex flex-col">
                <!-- Header con TPV selector y búsqueda -->
                <div class="flex gap-4 mb-4">
                    <div class="flex-1">
                        <label class="block mb-1 text-sm">TPV</label>
                        <p-select 
                            [options]="registerOptions" 
                            [(ngModel)]="selectedRegisterId" 
                            placeholder="Seleccionar TPV"
                            (onChange)="onRegisterChange()"
                            styleClass="w-full" 
                        />
                    </div>
                    <div class="flex-1">
                        <label class="block mb-1 text-sm">Buscar producto</label>
                        <input 
                            pInputText 
                            [(ngModel)]="searchQuery" 
                            placeholder="Buscar por nombre o código..."
                            (input)="filterProducts()"
                            class="w-full"
                        />
                    </div>
                </div>

                <!-- Grid de productos -->
                <div class="flex-1 overflow-auto">
                    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        @for (product of filteredProducts(); track product.id) {
                            <div 
                                class="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-primary-500 hover:shadow-md transition-all"
                                (click)="addToCart(product)"
                            >
                                @if (product.image) {
                                    <img [src]="'http://localhost:3021' + product.image" class="w-full h-24 object-cover rounded mb-2" />
                                } @else {
                                    <div class="w-full h-24 bg-gray-100 rounded mb-2 flex items-center justify-center">
                                        <i class="pi pi-image text-3xl text-gray-400"></i>
                                    </div>
                                }
                                <div class="text-sm font-medium truncate">{{ product.name }}</div>
                                <div class="text-lg font-bold text-primary-600">{{ product.price | currency }}</div>
                            </div>
                        }
                    </div>
                    
                    @if (filteredProducts().length === 0) {
                        <div class="text-center py-8 text-gray-500">
                            <i class="pi pi-search text-4xl mb-2"></i>
                            <p>No se encontraron productos</p>
                        </div>
                    }
                </div>
            </div>

            <!-- Panel Derecho: Carrito y Pago -->
            <div class="w-96 flex flex-col bg-white rounded-lg shadow">
                <!-- Header del carrito -->
                <div class="p-4 border-b">
                    <div class="flex justify-between items-center">
                        <h2 class="text-xl font-bold">Carrito</h2>
                        @if (posService.currentSession()) {
                            <p-tag value="Caja Abierta" severity="success" />
                        } @else {
                            <p-tag value="Caja Cerrada" severity="danger" />
                        }
                    </div>
                </div>

                <!-- Items del carrito -->
                <div class="flex-1 overflow-auto p-4">
                    @for (item of posService.cart(); track item.productId) {
                        <div class="flex items-center justify-between mb-3 pb-3 border-b">
                            <div class="flex-1">
                                <div class="font-medium">{{ item.productName }}</div>
                                <div class="text-sm text-gray-500">{{ item.price | currency }} x {{ item.qty }}</div>
                            </div>
                            <div class="flex items-center gap-2">
                                <p-button 
                                    icon="pi pi-minus" 
                                    [rounded]="true" 
                                    [text]="true" 
                                    severity="secondary"
                                    (onClick)="decreaseQty(item)"
                                />
                                <span class="w-8 text-center">{{ item.qty }}</span>
                                <p-button 
                                    icon="pi pi-plus" 
                                    [rounded]="true" 
                                    [text]="true" 
                                    severity="secondary"
                                    (onClick)="increaseQty(item)"
                                />
                            </div>
                            <div class="w-20 text-right font-bold">
                                {{ item.subtotal | currency }}
                            </div>
                            <p-button 
                                icon="pi pi-trash" 
                                [rounded]="true" 
                                [text]="true" 
                                severity="danger"
                                (onClick)="removeFromCart(item)"
                            />
                        </div>
                    }

                    @if (posService.cart().length === 0) {
                        <div class="text-center py-8 text-gray-500">
                            <i class="pi pi-shopping-cart text-4xl mb-2"></i>
                            <p>El carrito está vacío</p>
                        </div>
                    }
                </div>

                <!-- Total y acciones -->
                <div class="p-4 border-t bg-gray-50">
                    <div class="flex justify-between text-xl font-bold mb-4">
                        <span>Total:</span>
                        <span>{{ cartTotal() | currency }}</span>
                    </div>

                    <div class="flex gap-2">
                        @if (!posService.currentSession()) {
                            <p-button 
                                label="Abrir Caja" 
                                icon="pi pi-lock-open" 
                                class="flex-1"
                                (onClick)="showOpenDialog()"
                            />
                        } @else {
                            <p-button 
                                label="Cobrar" 
                                icon="pi pi-credit-card" 
                                class="flex-1"
                                [disabled]="posService.cart().length === 0"
                                (onClick)="showPaymentDialog()"
                            />
                            <p-button 
                                label="Cerrar Caja" 
                                icon="pi pi-lock" 
                                severity="danger"
                                (onClick)="showCloseDialog()"
                            />
                        }
                    </div>
                </div>
            </div>
        </div>

        <!-- Dialog: Abrir Caja -->
        <p-dialog header="Abrir Caja" [(visible)]="openDialog" [modal]="true" [style]="{ width: '400px' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block mb-2">Fondo inicial</label>
                    <p-inputnumber [(ngModel)]="openingAmount" mode="currency" currency="USD" locale="en-US" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Nota</label>
                    <input pInputText [(ngModel)]="openingNote" class="w-full" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="openDialog = false" />
                <p-button label="Abrir Caja" icon="pi pi-check" (onClick)="openSession()" />
            </ng-template>
        </p-dialog>

        <!-- Dialog: Cerrar Caja -->
        <p-dialog header="Cerrar Caja" [(visible)]="closeDialog" [modal]="true" [style]="{ width: '400px' }">
            <div class="flex flex-col gap-4">
                <div>
                    <label class="block mb-2">Total en caja</label>
                    <p-inputnumber [(ngModel)]="closingAmount" mode="currency" currency="USD" locale="en-US" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Nota</label>
                    <input pInputText [(ngModel)]="closingNote" class="w-full" />
                </div>
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="closeDialog = false" />
                <p-button label="Cerrar Caja" icon="pi pi-check" (onClick)="closeSession()" />
            </ng-template>
        </p-dialog>

        <!-- Dialog: Pago -->
        <p-dialog header="Procesar Pago" [(visible)]="paymentDialog" [modal]="true" [style]="{ width: '500px' }">
            <div class="flex flex-col gap-4">
                <div class="text-xl font-bold text-center">
                    Total a pagar: {{ cartTotal() | currency }}
                </div>

                <div>
                    <label class="block mb-2">Método de pago</label>
                    <p-select 
                        [options]="paymentMethods" 
                        [(ngModel)]="selectedPaymentMethod" 
                        optionLabel="label" 
                        optionValue="value"
                        class="w-full"
                    />
                </div>

                @if (selectedPaymentMethod === 'CASH') {
                    <div>
                        <label class="block mb-2">Monto recibido</label>
                        <p-inputnumber 
                            [(ngModel)]="cashReceived" 
                            mode="currency" 
                            currency="USD" 
                            locale="en-US" 
                            class="w-full"
                            (onInput)="calculateChange()"
                        />
                    </div>
                    <div class="text-lg font-bold text-right">
                        Cambio: {{ change() | currency }}
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="paymentDialog = false" />
                <p-button 
                    label="Completar Venta" 
                    icon="pi pi-check" 
                    [disabled]="!canCompletePayment()"
                    (onClick)="completeSale()"
                />
            </ng-template>
        </p-dialog>

        <p-toast />
    `
})
export class Tpv implements OnInit {
    products = signal<Product[]>([]);
    filteredProducts = signal<Product[]>([]);
    registerOptions: any[] = [];
    
    selectedRegisterId: string = '';
    searchQuery: string = '';
    
    openDialog = false;
    closeDialog = false;
    paymentDialog = false;
    
    openingAmount: number = 0;
    openingNote: string = '';
    closingAmount: number = 0;
    closingNote: string = '';
    
    selectedPaymentMethod: string = 'CASH';
    cashReceived: number = 0;

    paymentMethods = [
        { label: 'Efectivo', value: 'CASH' },
        { label: 'Tarjeta', value: 'CARD' },
        { label: 'Transferencia', value: 'TRANSFER' },
        { label: 'Otro', value: 'OTHER' }
    ];

    cartTotal = computed(() => this.posService.getCartTotal());
    change = computed(() => Math.max(0, this.cashReceived - this.cartTotal()));

    constructor(
        public posService: PosService,
        private productsService: ProductsService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadProducts();
        this.loadRegisters();
    }

    loadProducts() {
        this.productsService.list().subscribe({
            next: (products) => {
                this.products.set(products);
                this.filteredProducts.set(products);
            }
        });
    }

    loadRegisters() {
        this.posService.loadRegisters();
        // Subscribe to registers signal
        const interval = setInterval(() => {
            if (this.posService.registers().length > 0) {
                this.registerOptions = this.posService.registers().map(r => ({
                    label: r.name,
                    value: r.id
                }));
                clearInterval(interval);
            }
        }, 500);
    }

    onRegisterChange() {
        if (this.selectedRegisterId) {
            this.posService.getOpenSession(this.selectedRegisterId).subscribe({
                next: (session) => {
                    this.posService.setCurrentSession(session);
                }
            });
        }
    }

    filterProducts() {
        const query = this.searchQuery.toLowerCase();
        const filtered = this.products().filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.sku && p.sku.toLowerCase().includes(query)) ||
            (p.barcode && p.barcode.toLowerCase().includes(query))
        );
        this.filteredProducts.set(filtered);
    }

    addToCart(product: Product) {
        if (!this.posService.currentSession()) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Debe abrir la caja primero' });
            return;
        }
        this.posService.addToCart(product, 1);
    }

    increaseQty(item: SaleItem) {
        this.posService.updateCartItemQty(item.productId, item.qty + 1);
    }

    decreaseQty(item: SaleItem) {
        this.posService.updateCartItemQty(item.productId, item.qty - 1);
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
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Caja abierta' });
                this.openDialog = false;
                this.openingAmount = 0;
                this.openingNote = '';
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al abrir caja' })
        });
    }

    showCloseDialog() {
        this.closeDialog = true;
    }

    closeSession() {
        const session = this.posService.currentSession();
        if (session) {
            this.posService.closeSession(session.id, this.closingAmount, this.closingNote).subscribe({
                next: () => {
                    this.posService.setCurrentSession(null);
                    this.posService.clearCart();
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Caja cerrada' });
                    this.closeDialog = false;
                    this.closingAmount = 0;
                    this.closingNote = '';
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cerrar caja' })
            });
        }
    }

    showPaymentDialog() {
        if (!this.posService.currentSession()) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Abra la caja primero' });
            return;
        }
        this.cashReceived = this.cartTotal();
        this.calculateChange();
        this.paymentDialog = true;
    }

    calculateChange() {
        // Trigger change computation
    }

    canCompletePayment(): boolean {
        if (this.selectedPaymentMethod === 'CASH') {
            return this.cashReceived >= this.cartTotal();
        }
        return true;
    }

    completeSale() {
        const session = this.posService.currentSession();
        if (!session) return;

        const payment = {
            method: this.selectedPaymentMethod as any,
            amount: this.selectedPaymentMethod === 'CASH' ? this.cashReceived : this.cartTotal()
        };

        this.posService.createSale(session.id, this.posService.cart(), [payment]).subscribe({
            next: () => {
                this.posService.clearCart();
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Venta completada' });
                this.paymentDialog = false;
                this.cashReceived = 0;
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: err.error?.message || 'Error al procesar venta' })
        });
    }
}
