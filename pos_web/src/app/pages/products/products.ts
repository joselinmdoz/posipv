import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
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
import { SelectModule } from 'primeng/select';
import { SliderModule } from 'primeng/slider';
import { CardModule } from 'primeng/card';
import { DividerModule } from 'primeng/divider';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ProductsService, Product, CreateProductDto, UpdateProductDto, ProductType, ProductCategory, MeasurementUnit } from '@/app/core/services/products.service';
import { CatalogService, ProductType as CatalogProductType, ProductCategory as CatalogProductCategory, MeasurementUnit as CatalogMeasurementUnit } from '@/app/core/services/catalog.service';

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
        ToggleSwitchModule,
        SelectModule,
        SliderModule,
        CardModule,
        DividerModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo" icon="pi pi-plus" severity="secondary" class="mr-2" (click)="openNew()" />
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
            [globalFilterFields]="['name', 'codigo', 'barcode', 'productType.name', 'productCategory.name', 'measurementUnit.name']"
            [tableStyle]="{ 'min-width': '60rem' }"
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
                    <th pSortableColumn="codigo">Código <p-sortIcon field="codigo" /></th>
                    <th pSortableColumn="barcode">Código de Barras</th>
                    <th pSortableColumn="productType">Tipo</th>
                    <th pSortableColumn="productCategory">Categoría</th>
                    <th pSortableColumn="measurementUnit">Unidad</th>
                    <th pSortableColumn="price">Precio <p-sortIcon field="price" /></th>
                    <th pSortableColumn="cost">Costo</th>
                    <th pSortableColumn="active">Estado</th>
                    <th>Acciones</th>
                </tr>
                <tr>
                    <th></th>
                    <th>
                        <input pInputText [(ngModel)]="filters['name']" placeholder="Buscar por nombre" (input)="filterGlobal($event)" class="w-full" />
                    </th>
                    <th>
                        <input pInputText [(ngModel)]="filters['codigo']" placeholder="Buscar código" (input)="filterGlobal($event)" class="w-full" />
                    </th>
                    <th>
                        <input pInputText [(ngModel)]="filters['barcode']" placeholder="Buscar código" (input)="filterGlobal($event)" class="w-full" />
                    </th>
                    <th></th>
                    <th></th>
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
                                <img [src]="getImageUrl(product.image)" [alt]="product.name" width="32" style="border-radius: 4px;" />
                            }
                            {{ product.name }}
                        </div>
                    </td>
                    <td>{{ product.codigo || '-' }}</td>
                    <td>{{ product.barcode || '-' }}</td>
                    <td>
                        @if (product.productType) {
                            <p-tag [value]="product.productType.name" severity="info" />
                        } @else {
                            <span class="text-gray-400">-</span>
                        }
                    </td>
                    <td>
                        @if (product.productCategory) {
                            <p-tag [value]="product.productCategory.name" severity="success" />
                        } @else {
                            <span class="text-gray-400">-</span>
                        }
                    </td>
                    <td>
                        @if (product.measurementUnit) {
                            <span>{{ product.measurementUnit.name }} ({{ product.measurementUnit.symbol }})</span>
                        } @else {
                            <span class="text-gray-400">-</span>
                        }
                    </td>
                    <td>{{ product.price | currency }}</td>
                    <td>{{ product.cost ? (product.cost | currency) : '-' }}</td>
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
                    <td colspan="11">No se encontraron productos.</td>
                </tr>
            </ng-template>
        </p-table>

        <!-- Dialog para crear/editar producto -->
        <p-dialog 
            header="{{ isEditMode() ? 'Editar' : 'Nuevo' }} Producto" 
            [(visible)]="productDialog" 
            [modal]="true" 
            [style]="{ width: '800px' }"
            [draggable]="false"
            [resizable]="false"
            [closable]="true"
            [closeOnEscape]="true"
            [appendTo]="'body'"
            [focusOnShow]="false"
        >
            <div class="grid grid-cols-12 gap-6">
                <!-- Columna Izquierda: Imagen y Preview -->
                <div class="col-span-12 md:col-span-4">
                    <div class="flex flex-col items-center gap-4">
                        <!-- Preview de Imagen -->
                        <div class="image-preview-container">
                            @if (imagePreview || product.image) {
                                <img 
                                    [src]="imagePreview || getImageUrl(product.image)" 
                                    [alt]="product.name || 'Imagen del producto'" 
                                    class="product-image-preview"
                                    loading="lazy"
                                />
                            } @else {
                                <div class="image-placeholder">
                                    <i class="pi pi-image text-4xl text-400"></i>
                                    <span class="text-500">Sin imagen</span>
                                </div>
                            }
                        </div>
                        
                        <!-- Selector de Archivo -->
                        <div class="upload-button-container w-full">
                            <label for="productImage" class="upload-label">
                                <i class="pi pi-upload mr-2"></i>
                                {{ imagePreview ? 'Cambiar imagen' : 'Seleccionar imagen' }}
                            </label>
                            <input 
                                type="file" 
                                id="productImage" 
                                (change)="onFileSelected($event)" 
                                accept="image/webp, image/jpeg, image/png, image/gif" 
                                class="upload-input"
                            />
                        </div>
                        
                        @if (imagePreview || product.image) {
                            <p-button 
                                label="Remover imagen" 
                                icon="pi pi-times" 
                                severity="danger" 
                                [text]="true" 
                                size="small"
                                (onClick)="removeImage()"
                            />
                        }
                    </div>
                </div>
                
                <!-- Columna Derecha: Formulario -->
                <div class="col-span-12 md:col-span-8">
                    <!-- Información Básica -->
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold mb-3">Información Básica</h3>
                        <div class="flex flex-col gap-4">
                            <div class="flex flex-col gap-2">
                                <label for="name" class="font-semibold">Nombre del Producto *</label>
                                <input 
                                    pInputText 
                                    id="name" 
                                    [(ngModel)]="product.name" 
                                    required 
                                    class="w-full" 
                                    placeholder="Ej: Galletas María"
                                />
                            </div>
                            
                            <div class="grid grid-cols-2 gap-4">
                                <div class="flex flex-col gap-2">
                                    <label for="codigo" class="font-semibold">Código</label>
                                    <input 
                                        pInputText 
                                        id="codigo" 
                                        [(ngModel)]="product.codigo" 
                                        class="w-full" 
                                        placeholder="Ej: GALL-MARIA"
                                    />
                                </div>
                                <div class="flex flex-col gap-2">
                                    <label for="barcode" class="font-semibold">Código de Barras</label>
                                    <input 
                                        pInputText 
                                        id="barcode" 
                                        [(ngModel)]="product.barcode" 
                                        class="w-full" 
                                        placeholder="Ej: 7501234567890"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Clasificación -->
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold mb-3">Clasificación</h3>
                        <div class="grid grid-cols-3 gap-4">
                            <div class="flex flex-col gap-2">
                                <label for="productType" class="font-semibold">Tipo de Producto</label>
                                <p-select 
                                    id="productType" 
                                    [options]="productTypes()" 
                                    [(ngModel)]="product.productTypeId" 
                                    optionLabel="name" 
                                    optionValue="id"
                                    placeholder="Seleccionar"
                                    [showClear]="true"
                                    class="w-full"
                                />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label for="productCategory" class="font-semibold">Categoría</label>
                                <p-select 
                                    id="productCategory" 
                                    [options]="productCategories()" 
                                    [(ngModel)]="product.productCategoryId" 
                                    optionLabel="name" 
                                    optionValue="id"
                                    placeholder="Seleccionar"
                                    [showClear]="true"
                                    class="w-full"
                                />
                            </div>
                            <div class="flex flex-col gap-2">
                                <label for="measurementUnit" class="font-semibold">Unidad de Medida</label>
                                <p-select 
                                    id="measurementUnit" 
                                    [options]="measurementUnits()" 
                                    [(ngModel)]="product.measurementUnitId" 
                                    optionLabel="name" 
                                    optionValue="id"
                                    placeholder="Seleccionar"
                                    [showClear]="true"
                                    class="w-full"
                                >
                                    <ng-template let-unit pTemplate="item">
                                        {{ unit.name }} ({{ unit.symbol }})
                                    </ng-template>
                                </p-select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Precios -->
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold mb-3">Precios</h3>
                        <div class="flex flex-col gap-4">
                            <!-- Campo de Costo -->
                            <div class="flex flex-col gap-2">
                                <label for="cost" class="font-semibold">Costo de Compra</label>
                                <p-inputnumber 
                                    id="cost" 
                                    [(ngModel)]="product.cost" 
                                    mode="currency" 
                                    currency="USD" 
                                    locale="es-MX"
                                    (onInput)="onCostChange()"
                                    (onFocus)="selectInputValue($event)"
                                    class="w-full" 
                                    placeholder="0.00"
                                />
                            </div>
                            
                            <!-- Calculadora de Ganancia -->
                            <div class="profit-calculator">
                                <div class="flex align-items-center justify-content-between mb-2">
                                    <label class="font-semibold">Porcentaje de Ganancia</label>
                                    <span class="profit-percentage">{{ profitPercentage | number:'1.0-0' }}%</span>
                                </div>
                                
                                <p-slider 
                                    [(ngModel)]="profitPercentage" 
                                    [min]="0" 
                                    [max]="200" 
                                    [step]="5"
                                    (onChange)="calculateSuggestedPrice()"
                                    styleClass="profit-slider"
                                />
                                
                                <div class="quick-buttons mt-3">
                                    <p-button 
                                        label="10%" 
                                        [text]="true" 
                                        size="small"
                                        [severity]="profitPercentage === 10 ? 'success' : 'secondary'"
                                        (onClick)="setProfitPercentage(10)"
                                    />
                                    <p-button 
                                        label="25%" 
                                        [text]="true" 
                                        size="small"
                                        [severity]="profitPercentage === 25 ? 'success' : 'secondary'"
                                        (onClick)="setProfitPercentage(25)"
                                    />
                                    <p-button 
                                        label="30%" 
                                        [text]="true" 
                                        size="small"
                                        [severity]="profitPercentage === 30 ? 'success' : 'secondary'"
                                        (onClick)="setProfitPercentage(30)"
                                    />
                                    <p-button 
                                        label="50%" 
                                        [text]="true" 
                                        size="small"
                                        [severity]="profitPercentage === 50 ? 'success' : 'secondary'"
                                        (onClick)="setProfitPercentage(50)"
                                    />
                                    <p-button 
                                        label="100%" 
                                        [text]="true" 
                                        size="small"
                                        [severity]="profitPercentage === 100 ? 'success' : 'secondary'"
                                        (onClick)="setProfitPercentage(100)"
                                    />
                                </div>
                            </div>
                            
                            <!-- Precio Sugerido -->
                            @if (suggestedPrice > 0) {
                                <div class="suggested-price-card">
                                    <div class="flex align-items-center justify-content-between">
                                        <span class="text-500">Precio sugerido ({{ profitPercentage | number:'1.0-0' }}% de ganancia):</span>
                                        <span class="suggested-price">{{ suggestedPrice | currency:'USD':'symbol':'1.2-2' }}</span>
                                    </div>
                                </div>
                            }
                            
                            <!-- Campo de Precio -->
                            <p-divider />
                            
                            <div class="flex flex-col gap-2">
                                <label for="price" class="font-semibold">Precio de Venta *</label>
                                <p-inputnumber 
                                    id="price" 
                                    [(ngModel)]="product.price" 
                                    mode="currency" 
                                    currency="USD" 
                                    locale="es-MX"
                                    (onFocus)="selectInputValue($event)"
                                    class="w-full price-input" 
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <!-- Estado (solo en modo edición) -->
                    @if (isEditMode()) {
                        <div class="flex align-items-center gap-3 mt-4">
                            <p-toggleswitch id="active" [(ngModel)]="product.active" />
                            <label for="active" class="font-semibold cursor-pointer" (click)="product.active = !product.active">
                                Producto activo
                            </label>
                        </div>
                    }
                </div>
            </div>

            <ng-template #footer>
                <div class="flex justify-content-end gap-2">
                    <p-button label="Cancelar" icon="pi pi-times" severity="secondary" [outlined]="true" (onClick)="hideDialog()" />
                    <p-button label="Guardar Producto" icon="pi pi-check" (onClick)="saveProduct()" />
                </div>
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Products implements OnInit {
    products = signal<Product[]>([]);
    productTypes = signal<CatalogProductType[]>([]);
    productCategories = signal<CatalogProductCategory[]>([]);
    measurementUnits = signal<CatalogMeasurementUnit[]>([]);
    isEditMode = signal<boolean>(false);
    
    productDialog = false;
    selectedProduct: Product | null = null;
    selectedFile: File | null = null;
    
    // Imagen preview
    imagePreview: string | null = null;
    
    // Calculadora de ganancia
    profitPercentage: number = 30;
    suggestedPrice: number = 0;

    // URL base del API para las imágenes
    readonly IMAGE_BASE_URL = 'http://localhost:3021';

    cols: Column[] = [
        { field: 'name', header: 'Nombre' },
        { field: 'codigo', header: 'Código' },
        { field: 'barcode', header: 'Código de Barras' },
        { field: 'productType', header: 'Tipo' },
        { field: 'productCategory', header: 'Categoría' },
        { field: 'measurementUnit', header: 'Unidad' },
        { field: 'price', header: 'Precio' },
        { field: 'cost', header: 'Costo' },
        { field: 'active', header: 'Estado' }
    ];

    filters = {
        name: '',
        codigo: '',
        barcode: ''
    };

    product: any = {
        name: '',
        codigo: '',
        barcode: '',
        price: 0,
        cost: 0,
        image: '',
        active: true,
        productTypeId: undefined,
        productCategoryId: undefined,
        measurementUnitId: undefined
    };

    constructor(
        private productsService: ProductsService,
        private catalogService: CatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.loadProducts();
        this.loadCatalogs();
    }

    loadProducts() {
        this.productsService.list().subscribe({
            next: (products) => this.products.set(products),
            error: (err) => {
                console.error('Error loading products:', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar productos' });
            }
        });
    }

    loadCatalogs() {
        this.catalogService.getProductTypes().subscribe({
            next: (types) => this.productTypes.set(types),
            error: (err) => console.error('Error loading product types:', err)
        });

        this.catalogService.getProductCategories().subscribe({
            next: (categories) => this.productCategories.set(categories),
            error: (err) => console.error('Error loading product categories:', err)
        });

        this.catalogService.getMeasurementUnits().subscribe({
            next: (units) => this.measurementUnits.set(units),
            error: (err) => console.error('Error loading measurement units:', err)
        });
    }

    getImageUrl(imagePath: string): string {
        if (!imagePath) return '';
        // Si la imagen ya tiene una URL completa, retornarla
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }
        // Verificar si la ruta ya comienza con /
        if (imagePath.startsWith('/')) {
            return this.IMAGE_BASE_URL + imagePath;
        }
        // Agregar / antes de la ruta
        return this.IMAGE_BASE_URL + '/' + imagePath;
    }

    openNew() {
        // Quitar el foco de cualquier elemento antes de abrir el diálogo
        if (document.activeElement) {
            (document.activeElement as HTMLElement).blur();
        }
        
        this.product = {
            name: '',
            codigo: '',
            barcode: '',
            price: 0,
            cost: 0,
            image: '',
            active: true,
            productTypeId: undefined,
            productCategoryId: undefined,
            measurementUnitId: undefined
        };
        this.selectedFile = null;
        this.imagePreview = null;
        this.profitPercentage = 30;
        this.suggestedPrice = 0;
        this.isEditMode.set(false);
        this.productDialog = true;
    }

    editProduct(product: Product) {
        this.selectedProduct = product;
        this.product = { 
            ...product,
            productTypeId: product.productTypeId,
            productCategoryId: product.productCategoryId,
            measurementUnitId: product.measurementUnitId
        };
        this.selectedFile = null;
        this.imagePreview = null;
        // Calcular porcentaje de ganancia basado en el precio actual
        if (product.cost && product.price) {
            this.profitPercentage = Math.round(((product.price - product.cost) / product.cost) * 100);
        } else {
            this.profitPercentage = 30;
        }
        this.calculateSuggestedPrice();
        this.isEditMode.set(true);
        this.productDialog = true;
    }

    hideDialog() {
        this.productDialog = false;
        this.selectedProduct = null;
        this.selectedFile = null;
        this.imagePreview = null;
    }

    onFileSelected(event: any) {
        const file = event.target.files[0];
        if (file) {
            this.selectedFile = file;
            // Crear preview de la imagen
            const reader = new FileReader();
            reader.onload = (e: any) => {
                this.imagePreview = e.target.result;
            };
            reader.readAsDataURL(file);
            // Forzar detección de cambios después de un pequeño retraso
            setTimeout(() => {
                this.cdr.detectChanges();
            }, 10);
        }
        // Limpiar el valor del input para permitir seleccionar el mismo archivo de nuevo
        event.target.value = '';
    }

    removeImage() {
        this.selectedFile = null;
        this.imagePreview = null;
        this.product.image = '';
    }

    setProfitPercentage(value: number) {
        this.profitPercentage = value;
        this.calculateSuggestedPrice();
    }

    calculateSuggestedPrice() {
        if (this.product.cost && this.product.cost > 0) {
            // Calcular precio con el porcentaje de ganancia
            this.suggestedPrice = this.product.cost * (1 + this.profitPercentage / 100);
        } else {
            this.suggestedPrice = 0;
        }
    }

    onCostChange() {
        // Cuando cambia el costo, calcular automáticamente el precio de venta
        this.calculateSuggestedPrice();
        // Autoaplicar el precio sugerido al campo de precio
        if (this.suggestedPrice > 0) {
            this.product.price = this.suggestedPrice;
        }
    }

    selectInputValue(event: any) {
        // Seleccionar todo el contenido del input cuando recibe foco
        if (event && event.target) {
            event.target.select();
        }
    }

    applySuggestedPrice() {
        if (this.suggestedPrice > 0) {
            this.product.price = this.suggestedPrice;
        }
    }

    saveProduct() {
        if (!this.product.name || !this.product.price) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Complete todos los campos requeridos' });
            return;
        }

        // Validar porcentaje de ganancia
        if (this.profitPercentage < 0) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El porcentaje de ganancia no puede ser negativo' });
            return;
        }
        
        if (this.profitPercentage > 500) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El porcentaje de ganancia es muy alto (máximo 500%)' });
            return;
        }

        // Crear FormData para enviar la imagen junto con los datos
        const formData = new FormData();
        formData.append('name', this.product.name);
        formData.append('price', String(this.product.price));
        
        if (this.product.codigo) formData.append('codigo', this.product.codigo);
        if (this.product.barcode) formData.append('barcode', this.product.barcode);
        if (this.product.cost) formData.append('cost', String(this.product.cost));
        if (this.product.productTypeId) formData.append('productTypeId', this.product.productTypeId);
        if (this.product.productCategoryId) formData.append('productCategoryId', this.product.productCategoryId);
        if (this.product.measurementUnitId) formData.append('measurementUnitId', this.product.measurementUnitId);
        if (this.product.active !== undefined) formData.append('active', String(this.product.active));
        
        // En modo edición, mantener la imagen existente
        if (this.isEditMode() && this.product.image && !this.selectedFile) {
            formData.append('existingImage', this.product.image);
        }
        
        // Agregar la imagen si hay una seleccionada
        if (this.selectedFile) {
            formData.append('image', this.selectedFile);
        }

        // Determinar si es create o update
        const saveObservable = this.isEditMode() && this.selectedProduct
            ? this.productsService.updateWithFormData(this.selectedProduct.id, formData)
            : this.productsService.createWithFormData(formData);

        saveObservable.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.isEditMode() ? 'Producto actualizado' : 'Producto creado' });
                this.loadProducts();
                this.hideDialog();
            },
            error: (err) => {
                console.error('Error saving product:', err);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar producto' });
            }
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
                    error: (err) => {
                        console.error('Error deleting product:', err);
                        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar producto' });
                    }
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
