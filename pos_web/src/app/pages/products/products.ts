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
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { InputNumberModule } from 'primeng/inputnumber';
import { FileUploadModule } from 'primeng/fileupload';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ProductsService, Product, CreateProductDto, UpdateProductDto } from '@/app/core/services/products.service';

interface Column {
    field: string;
    header: string;
}

@Component({
    selector: 'app-products',
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
        InputIconModule,
        IconFieldModule,
        InputNumberModule,
        FileUploadModule,
        ConfirmDialogModule,
        ToggleSwitchModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo" icon="pi pi-plus" severity="secondary" class="mr-2" (onClick)="openNew()" />
            </ng-template>
            <ng-template #end>
                <p-button label="Exportar" icon="pi pi-upload" severity="secondary" (onClick)="exportCSV()" />
            </ng-template>
        </p-toolbar>

        <p-table
            #dt
            [value]="products()"
            [rows]="10"
            [paginator]="true"
            [globalFilterFields]="['name', 'sku', 'barcode']"
            [tableStyle]="{ 'min-width': '50rem' }"
            [rowHover]="true"
            dataKey="id"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} productos"
        >
            <ng-template #header>
                <tr>
                    <th style="width: 4rem">
                        <p-tableHeaderCheckbox />
                    </th>
                    <th pSortableColumn="name">Nombre <p-sortIcon field="name" /></th>
                    <th pSortableColumn="sku">SKU <p-sortIcon field="sku" /></th>
                    <th pSortableColumn="barcode">Código de Barras</th>
                    <th pSortableColumn="price">Precio <p-sortIcon field="price" /></th>
                    <th pSortableColumn="cost">Costo</th>
                    <th pSortableColumn="unit">Unidad</th>
                    <th pSortableColumn="active">Estado</th>
                    <th>Acciones</th>
                </tr>
                <tr>
                    <th></th>
                    <th>
                        <input pInputText [(ngModel)]="filters['name']" placeholder="Buscar por nombre" (input)="filterGlobal($event)" />
                    </th>
                    <th>
                        <input pInputText [(ngModel)]="filters['sku']" placeholder="Buscar SKU" (input)="filterGlobal($event)" />
                    </th>
                    <th>
                        <input pInputText [(ngModel)]="filters['barcode']" placeholder="Buscar código" (input)="filterGlobal($event)" />
                    </th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                    <th></th>
                </tr>
            </ng-template>
            <ng-template #body let-product>
                <tr>
                    <td>
                        <p-tableCheckbox [value]="product" />
                    </td>
                    <td>
                        <div class="flex align-items-center gap-2">
                            @if (product.image) {
                                <img [src]="'http://localhost:3021' + product.image" [alt]="product.name" width="32" style="border-radius: 4px;" />
                            }
                            {{ product.name }}
                        </div>
                    </td>
                    <td>{{ product.sku || '-' }}</td>
                    <td>{{ product.barcode || '-' }}</td>
                    <td>{{ product.price | currency }}</td>
                    <td>{{ product.cost ? (product.cost | currency) : '-' }}</td>
                    <td>{{ product.unit || '-' }}</td>
                    <td>
                        <p-tag [value]="product.active ? 'Activo' : 'Inactivo'" [severity]="product.active ? 'success' : 'warn'" />
                    </td>
                    <td>
                        <p-button icon="pi pi-pencil" class="mr-2" [rounded]="true" [outlined]="true" severity="success" (onClick)="editProduct(product)" />
                        <p-button icon="pi pi-trash" [rounded]="true" [outlined]="true" severity="danger" (onClick)="deleteProduct(product)" />
                    </td>
                </tr>
            </ng-template>
            <ng-template #emptymessage>
                <tr>
                    <td colspan="9">No se encontraron productos.</td>
                </tr>
            </ng-template>
        </p-table>

        <!-- Dialog para crear/editar producto -->
        <p-dialog 
            header="{{ isEditMode() ? 'Editar' : 'Nuevo' }} Producto" 
            [(visible)]="productDialog" 
            [modal]="true" 
            [style]="{ width: '600px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="name">Nombre *</label>
                        <input pInputText id="name" [(ngModel)]="product.name" required autofocus />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="sku">SKU</label>
                        <input pInputText id="sku" [(ngModel)]="product.sku" />
                    </div>
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="barcode">Código de Barras</label>
                        <input pInputText id="barcode" [(ngModel)]="product.barcode" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="unit">Unidad</label>
                        <input pInputText id="unit" [(ngModel)]="product.unit" placeholder="ej: kg, und, lt" />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="price">Precio *</label>
                        <p-inputnumber id="price" [(ngModel)]="product.price" mode="currency" currency="USD" locale="en-US" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="cost">Costo</label>
                        <p-inputnumber id="cost" [(ngModel)]="product.cost" mode="currency" currency="USD" locale="en-US" />
                    </div>
                </div>

                <div class="flex flex-col gap-2">
                    <label for="image">Imagen</label>
                    <div class="flex align-items-center gap-4">
                        @if (product.image) {
                            <img [src]="'http://localhost:3021' + product.image" [alt]="product.name" width="80" style="border-radius: 4px;" />
                        }
                        <input type="file" (change)="onFileSelected($event)" accept="image/*" />
                    </div>
                </div>

                @if (isEditMode()) {
                    <div class="flex align-items-center gap-2">
                        <p-toggleswitch id="active" [(ngModel)]="product.active" />
                        <label for="active">Producto activo</label>
                    </div>
                }
            </div>

            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveProduct()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Products implements OnInit {
    products = signal<Product[]>([]);
    isEditMode = signal<boolean>(false);
    
    productDialog = false;
    selectedProduct: Product | null = null;
    selectedFile: File | null = null;

    cols: Column[] = [
        { field: 'name', header: 'Nombre' },
        { field: 'sku', header: 'SKU' },
        { field: 'barcode', header: 'Código de Barras' },
        { field: 'price', header: 'Precio' },
        { field: 'cost', header: 'Costo' },
        { field: 'unit', header: 'Unidad' },
        { field: 'active', header: 'Estado' }
    ];

    filters = {
        name: '',
        sku: '',
        barcode: ''
    };

    product: any = {
        name: '',
        sku: '',
        barcode: '',
        price: 0,
        cost: 0,
        unit: '',
        image: '',
        active: true
    };

    constructor(
        private productsService: ProductsService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadProducts();
    }

    loadProducts() {
        this.productsService.list().subscribe({
            next: (products) => this.products.set(products),
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar productos' })
        });
    }

    openNew() {
        this.product = {
            name: '',
            sku: '',
            barcode: '',
            price: 0,
            cost: 0,
            unit: '',
            image: '',
            active: true
        };
        this.selectedFile = null;
        this.isEditMode.set(false);
        this.productDialog = true;
    }

    editProduct(product: Product) {
        this.selectedProduct = product;
        this.product = { ...product };
        this.selectedFile = null;
        this.isEditMode.set(true);
        this.productDialog = true;
    }

    hideDialog() {
        this.productDialog = false;
        this.selectedProduct = null;
        this.selectedFile = null;
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
        }
    }

    saveProduct() {
        if (!this.product.name || !this.product.price) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Complete todos los campos requeridos' });
            return;
        }

        const saveObservable = this.isEditMode() && this.selectedProduct
            ? this.productsService.update(this.selectedProduct.id, this.product)
            : this.productsService.create(this.product as CreateProductDto);

        saveObservable.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.isEditMode() ? 'Producto actualizado' : 'Producto creado' });
                this.loadProducts();
                this.hideDialog();
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar producto' })
        });
    }

    deleteProduct(product: Product) {
        this.confirmationService.confirm({
            message: `¿Está seguro de eliminar el producto ${product.name}?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.productsService.delete(product.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Producto eliminado' });
                        this.loadProducts();
                    },
                    error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar producto' })
                });
            }
        });
    }

    filterGlobal(event: Event) {
        // Implementar filtrado global
    }

    exportCSV() {
        // Implementar exportación
    }
}
