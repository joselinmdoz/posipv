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
import { firstValueFrom } from 'rxjs';
import { ProductsService, Product, CreateProductDto } from '@/app/core/services/products.service';
import { CatalogService, ProductType as CatalogProductType, ProductCategory as CatalogProductCategory, MeasurementUnit as CatalogMeasurementUnit } from '@/app/core/services/catalog.service';
import { SettingsService, SystemCurrencyCode } from '@/app/core/services/settings.service';

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
        <div class="catalog-page-shell">
            <div class="catalog-header-surface mb-4">
                <div class="catalog-header-main">
                    <div>
                        <h2 class="catalog-title">Catálogo de productos</h2>
                       
                    </div>

                    <div class="catalog-header-actions">
                        <div class="catalog-search-wrap">
                            <i class="pi pi-search"></i>
                            <input
                                pInputText
                                [(ngModel)]="searchTerm"
                                placeholder="Buscar en catálogo..."
                                (input)="onSearchInput()"
                            />
                            <button type="button" class="catalog-clear-btn" [disabled]="!searchTerm" (click)="clearSearch()">
                                <i class="pi pi-times"></i>
                            </button>
                        </div>

                        <div class="catalog-view-toggle compact">
                            <button type="button" [class.active]="viewMode === 'cards'" (click)="viewMode = 'cards'" aria-label="Vista tarjetas">
                                <i class="pi pi-th-large"></i>
                            </button>
                            <button type="button" [class.active]="viewMode === 'table'" (click)="viewMode = 'table'" aria-label="Vista tabla">
                                <i class="pi pi-table"></i>
                            </button>
                        </div>

                        <button type="button" class="catalog-link-action" (click)="exportCSV()">
                            <i class="pi pi-download"></i>
                            Exportar
                        </button>
                        <button type="button" class="catalog-link-action" (click)="triggerCsvImport(csvFileInput)">
                            <i class="pi pi-upload"></i>
                            Importar
                        </button>
                        <button type="button" class="catalog-primary-action" (click)="openNew()">
                            <i class="pi pi-plus"></i>
                            Nuevo producto
                        </button>
                        <input #csvFileInput type="file" accept=".csv,text/csv" class="hidden" (change)="onCsvSelected($event)" />
                    </div>
                </div>

                <div class="catalog-chip-row">
                    <button class="catalog-chip" [class.active]="isCategoryActive('all')" (click)="setCategoryFilter('all')">
                        Todas las colecciones
                    </button>
                    @for (category of productCategories(); track category.id) {
                        <button
                            class="catalog-chip"
                            [class.active]="isCategoryActive(category.id)"
                            (click)="setCategoryFilter(category.id)"
                        >
                            {{ category.name }}
                        </button>
                    }
                    <div class="catalog-inactive-toggle">
                        <p-toggleswitch
                            inputId="showInactive"
                            [(ngModel)]="showInactive"
                            (ngModelChange)="onShowInactiveChange()"
                        />
                        <label for="showInactive">Mostrar inactivos</label>
                    </div>
                </div>
            </div>

            @if (viewMode === 'cards') {
                @if (products().length > 0) {
                    <div class="catalog-card-grid">
                        @for (product of products(); track product.id) {
                            <article class="catalog-card" [style.opacity]="product.active ? '1' : '0.72'">
                                <div class="catalog-card-image-wrap" [class.no-image]="!product.image">
                                    @if (product.image) {
                                        <img [src]="getImageUrl(product.image)" [alt]="product.name" class="catalog-card-image" />
                                    } @else {
                                        <div class="catalog-image-placeholder">
                                            <i class="pi pi-image"></i>
                                        </div>
                                    }
                                    <span class="catalog-stock-badge" [class.low]="hasLowStockBadge(product)" [class.inactive]="!product.active">
                                        {{ getStockBadgeLabel(product) }}
                                    </span>
                                </div>

                                <div class="catalog-card-content">
                                    <div class="catalog-card-headline">
                                        <h3>{{ product.name }}</h3>
                                        <strong>{{ formatProductPrice(product) }}</strong>
                                    </div>

                                    <p class="catalog-sku">SKU: {{ getProductSku(product) }}</p>

                                    <div class="catalog-card-actions">
                                        <button type="button" class="quick-edit-btn" (click)="editProduct(product)">EDICIÓN RÁPIDA</button>
                                        <button
                                            type="button"
                                            class="quick-delete-btn"
                                            (click)="toggleProductStatus(product)"
                                            [attr.aria-label]="product.active ? 'Desactivar producto' : 'Reactivar producto'"
                                        >
                                            <i class="pi" [ngClass]="product.active ? 'pi-trash' : 'pi-refresh'"></i>
                                        </button>
                                    </div>
                                </div>
                            </article>
                        }
                    </div>
                } @else {
                    <div class="surface-card border-1 border-round p-4 text-center text-500">
                        No se encontraron productos.
                    </div>
                }

                <button type="button" class="catalog-fab" (click)="openNew()" aria-label="Nuevo producto">
                    <i class="pi pi-plus"></i>
                </button>
            } @else {
                <p-table
                    [value]="products()"
                    [rows]="10"
                    [paginator]="true"
                    responsiveLayout="scroll"
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
                            <th pSortableColumn="lowStockAlertQty">Stock bajo</th>
                            <th pSortableColumn="currency">Moneda</th>
                            <th pSortableColumn="price">Precio <p-sortIcon field="price" /></th>
                            <th pSortableColumn="cost">Costo</th>
                            <th pSortableColumn="active">Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-product>
                        <tr [style.opacity]="product.active ? '1' : '0.7'">
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
                            <td>{{ product.lowStockAlertQty ?? '-' }}</td>
                            <td>{{ product.currency || defaultProductCurrency }}</td>
                            <td>{{ product.price | number:'1.2-2' }}</td>
                            <td>{{ product.cost ? (product.cost | number:'1.2-2') : '-' }}</td>
                            <td>
                                <p-tag [value]="product.active ? 'Activo' : 'Inactivo'" [severity]="product.active ? 'success' : 'warn'" />
                            </td>
                            <td>
                                <p-button icon="pi pi-pencil" class="mr-2" [rounded]="true" [outlined]="true" severity="success" (onClick)="editProduct(product)" />
                                <p-button
                                    [icon]="product.active ? 'pi pi-trash' : 'pi pi-refresh'"
                                    [rounded]="true"
                                    [outlined]="true"
                                    [severity]="product.active ? 'danger' : 'contrast'"
                                    (onClick)="toggleProductStatus(product)"
                                />
                            </td>
                        </tr>
                    </ng-template>
                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="13">No se encontraron productos.</td>
                        </tr>
                    </ng-template>
                </p-table>
            }
        </div>

        <!-- Dialog para crear/editar producto -->
        <p-dialog 
            header="{{ isEditMode() ? 'Editar' : 'Nuevo' }} Producto" 
            [(visible)]="productDialog" 
            [modal]="true" 
            [style]="{ width: '800px' }"
            [breakpoints]="{ '1200px': '96vw', '960px': '98vw' }"
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
                        <small class="text-500 text-center">Formatos: WEBP, JPG, PNG, GIF (máx {{ productImageMaxFileMb }}MB)</small>
                        
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

                        <div class="grid grid-cols-2 gap-4 mt-4">
                            <div class="flex flex-col gap-2">
                                <label for="lowStockAlertQty" class="font-semibold">Umbral de stock bajo</label>
                                <p-inputnumber
                                    id="lowStockAlertQty"
                                    [(ngModel)]="product.lowStockAlertQty"
                                    [min]="0"
                                    [maxFractionDigits]="3"
                                    [minFractionDigits]="0"
                                    [useGrouping]="false"
                                    class="w-full"
                                    placeholder="Ej: 5"
                                />
                            </div>
                            <div class="flex align-items-center gap-3 mt-6">
                                <p-toggleswitch id="allowFractionalQty" [(ngModel)]="product.allowFractionalQty" />
                                <label for="allowFractionalQty" class="font-semibold cursor-pointer">
                                    Permitir cantidad fraccionada
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Precios -->
                    <div class="mb-4">
                        <h3 class="text-lg font-semibold mb-3">Precios</h3>
                        <div class="flex flex-col gap-4">
                            <!-- Campo de Costo -->
                            <div class="flex flex-col gap-2">
                                <label for="currency" class="font-semibold">Moneda del Producto *</label>
                                <p-select
                                    id="currency"
                                    [options]="currencyOptions"
                                    [(ngModel)]="product.currency"
                                    optionLabel="label"
                                    optionValue="value"
                                    class="w-full"
                                />
                            </div>

                            <div class="flex flex-col gap-2">
                                <label for="cost" class="font-semibold">Costo de Compra</label>
                                <p-inputnumber 
                                    id="cost" 
                                    [(ngModel)]="product.cost" 
                                    mode="currency" 
                                    [currency]="product.currency || defaultProductCurrency"
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
                                    <span class="profit-percentage">{{ profitPercentage | number:'1.0-2' }}%</span>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                    <div class="flex flex-col gap-2">
                                        <label class="text-sm text-600">Ganancia (%)</label>
                                        <p-inputnumber
                                            [(ngModel)]="profitPercentage"
                                            mode="decimal"
                                            [min]="0"
                                            [maxFractionDigits]="2"
                                            [useGrouping]="false"
                                            (ngModelChange)="onProfitPercentageInputChange()"
                                            class="w-full"
                                            placeholder="Ej: 30"
                                        />
                                    </div>
                                    <div class="flex flex-col gap-2">
                                        <label class="text-sm text-600">Ganancia por unidad</label>
                                        <p-inputnumber
                                            [(ngModel)]="profitAmount"
                                            mode="currency"
                                            [currency]="product.currency || defaultProductCurrency"
                                            locale="es-MX"
                                            [min]="0"
                                            [maxFractionDigits]="2"
                                            (ngModelChange)="onProfitAmountInputChange()"
                                            class="w-full"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                
                                <p-slider 
                                    [(ngModel)]="profitPercentage" 
                                    [min]="0" 
                                    [max]="200" 
                                    [step]="5"
                                    (onChange)="onProfitPercentageChanged()"
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

                                <div class="mt-3">
                                    <p-button
                                        label="Calcular precio de venta"
                                        icon="pi pi-calculator"
                                        styleClass="w-full"
                                        (onClick)="applySuggestedPrice()"
                                    />
                                </div>
                            </div>
                            
                            <!-- Precio Sugerido -->
                            @if (suggestedPrice > 0) {
                                <div class="suggested-price-card">
                                    <div class="flex align-items-center justify-content-between">
                                        <span class="text-500">Precio sugerido ({{ profitPercentage | number:'1.0-0' }}% de ganancia):</span>
                                        <span class="suggested-price">{{ suggestedPrice | currency:(product.currency || defaultProductCurrency):'symbol':'1.2-2' }}</span>
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
                                    [currency]="product.currency || defaultProductCurrency"
                                    locale="es-MX"
                                    (onInput)="onPriceChange()"
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
    `,
    styles: []
})
export class Products implements OnInit {
    readonly productImageMaxFileMb = 5;
    private readonly productImageMaxBytes = this.productImageMaxFileMb * 1024 * 1024;
    private readonly allowedProductImageExtensions = ['.webp', '.jpg', '.jpeg', '.png', '.gif'];

    allProducts = signal<Product[]>([]);
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
    profitAmount: number = 0;
    suggestedPrice: number = 0;
    private profitCalculationMode: 'PERCENTAGE' | 'AMOUNT' = 'PERCENTAGE';
    defaultProductCurrency: SystemCurrencyCode = 'CUP';
    enabledProductCurrencies: SystemCurrencyCode[] = ['CUP', 'USD'];
    currencyOptions: Array<{ label: string; value: SystemCurrencyCode }> = [
        { label: 'CUP', value: 'CUP' },
        { label: 'USD', value: 'USD' }
    ];

    // URL base del API para las imágenes
    readonly IMAGE_BASE_URL = '';

    cols: Column[] = [
        { field: 'name', header: 'Nombre' },
        { field: 'codigo', header: 'Código' },
        { field: 'barcode', header: 'Código de Barras' },
        { field: 'productType', header: 'Tipo' },
        { field: 'productCategory', header: 'Categoría' },
        { field: 'measurementUnit', header: 'Unidad' },
        { field: 'lowStockAlertQty', header: 'Stock bajo' },
        { field: 'currency', header: 'Moneda' },
        { field: 'price', header: 'Precio' },
        { field: 'cost', header: 'Costo' },
        { field: 'active', header: 'Estado' }
    ];

    searchTerm = '';
    showInactive = false;
    viewMode: 'cards' | 'table' = 'cards';
    selectedCategoryId = 'all';

    product: any = {
        name: '',
        codigo: '',
        barcode: '',
        price: 0,
        cost: 0,
        lowStockAlertQty: undefined,
        allowFractionalQty: false,
        currency: 'CUP' as SystemCurrencyCode,
        image: '',
        active: true,
        productTypeId: undefined,
        productCategoryId: undefined,
        measurementUnitId: undefined
    };

    constructor(
        private productsService: ProductsService,
        private catalogService: CatalogService,
        private settingsService: SettingsService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.loadSystemCurrencySettings();
        this.loadProducts();
        this.loadCatalogs();
    }

    loadProducts() {
        this.productsService.list(this.showInactive).subscribe({
            next: (products) => {
                this.allProducts.set(products);
                this.applyFilters();
            },
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
            lowStockAlertQty: undefined,
            allowFractionalQty: false,
            currency: this.defaultProductCurrency,
            image: '',
            active: true,
            productTypeId: undefined,
            productCategoryId: undefined,
            measurementUnitId: undefined
        };
        this.selectedFile = null;
        this.imagePreview = null;
        this.profitPercentage = 30;
        this.profitAmount = 0;
        this.suggestedPrice = 0;
        this.profitCalculationMode = 'PERCENTAGE';
        this.isEditMode.set(false);
        this.productDialog = true;
    }

    editProduct(product: Product) {
        this.selectedProduct = product;
        this.product = {
            ...product,
            currency: (product.currency || this.defaultProductCurrency) as SystemCurrencyCode,
            productTypeId: product.productTypeId,
            productCategoryId: product.productCategoryId,
            measurementUnitId: product.measurementUnitId
        };
        this.selectedFile = null;
        this.imagePreview = null;
        this.profitCalculationMode = 'PERCENTAGE';
        this.syncProfitMetricsFromCostAndPrice();
        this.isEditMode.set(true);
        this.productDialog = true;
    }

    hideDialog() {
        this.productDialog = false;
        this.selectedProduct = null;
        this.selectedFile = null;
        this.imagePreview = null;
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files?.[0];
        if (!file) return;

        if (file.size > this.productImageMaxBytes) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Imagen inválida',
                detail: `La imagen supera ${this.productImageMaxFileMb}MB`
            });
            if (input) input.value = '';
            return;
        }

        if (!this.isAllowedProductImage(file)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Imagen inválida',
                detail: 'Debes seleccionar una imagen válida (WEBP, JPG, PNG o GIF).'
            });
            if (input) input.value = '';
            return;
        }

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

        // Limpiar el valor del input para permitir seleccionar el mismo archivo de nuevo
        if (input) input.value = '';
    }

    removeImage() {
        this.selectedFile = null;
        this.imagePreview = null;
        this.product.image = '';
    }

    setProfitPercentage(value: number) {
        this.profitPercentage = value;
        this.profitCalculationMode = 'PERCENTAGE';
        this.calculateSuggestedPrice(false);
    }

    onProfitPercentageChanged() {
        this.profitCalculationMode = 'PERCENTAGE';
        this.calculateSuggestedPrice(false);
    }

    onProfitPercentageInputChange() {
        this.profitCalculationMode = 'PERCENTAGE';
        this.calculateSuggestedPrice(false);
    }

    onProfitAmountInputChange() {
        this.profitCalculationMode = 'AMOUNT';
        this.calculateSuggestedPrice(false);
    }

    calculateSuggestedPrice(autoApply = false) {
        const cost = Number(this.product.cost || 0);
        if (cost > 0) {
            if (this.profitCalculationMode === 'AMOUNT') {
                const amount = Math.max(0, Number(this.profitAmount || 0));
                this.profitAmount = this.roundMoney(amount);
                this.suggestedPrice = this.roundMoney(cost + this.profitAmount);
                this.profitPercentage = this.roundPercent(((this.suggestedPrice - cost) / cost) * 100);
            } else {
                const percentage = Math.max(0, Number(this.profitPercentage || 0));
                this.profitPercentage = this.roundPercent(percentage);
                this.suggestedPrice = this.roundMoney(cost * (1 + this.profitPercentage / 100));
                this.profitAmount = this.roundMoney(this.suggestedPrice - cost);
            }
            if (autoApply) {
                this.product.price = this.roundMoney(this.suggestedPrice);
                this.syncProfitMetricsFromCostAndPrice();
            }
        } else {
            this.suggestedPrice = 0;
            if (this.profitCalculationMode === 'PERCENTAGE') {
                this.profitAmount = 0;
            } else {
                this.profitAmount = this.roundMoney(Math.max(0, Number(this.profitAmount || 0)));
            }
        }
    }

    onCostChange() {
        const salePrice = Number(this.product.price || 0);
        if (salePrice > 0) {
            this.syncProfitMetricsFromCostAndPrice();
            return;
        }
        this.calculateSuggestedPrice(false);
    }

    onPriceChange() {
        this.syncProfitMetricsFromCostAndPrice();
    }

    selectInputValue(event: any) {
        // Seleccionar todo el contenido del input cuando recibe foco
        if (event && event.target) {
            event.target.select();
        }
    }

    applySuggestedPrice() {
        this.calculateSuggestedPrice(false);
        if (this.suggestedPrice > 0) {
            this.product.price = this.roundMoney(this.suggestedPrice);
            this.syncProfitMetricsFromCostAndPrice();
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

        // Crear FormData para enviar la imagen junto con los datos
        const formData = new FormData();
        formData.append('name', this.product.name);
        formData.append('price', String(this.product.price));
        formData.append('currency', String(this.product.currency || this.defaultProductCurrency));

        if (this.product.codigo) formData.append('codigo', this.product.codigo);
        if (this.product.barcode) formData.append('barcode', this.product.barcode);
        if (this.product.cost) formData.append('cost', String(this.product.cost));
        if (this.product.lowStockAlertQty !== undefined && this.product.lowStockAlertQty !== null && this.product.lowStockAlertQty !== '') {
            formData.append('lowStockAlertQty', String(this.product.lowStockAlertQty));
        }
        formData.append('allowFractionalQty', String(!!this.product.allowFractionalQty));
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
                const backendMessage = this.extractErrorMessage(err);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: backendMessage || 'Error al guardar producto'
                });
            }
        });
    }

    toggleProductStatus(product: Product) {
        const activating = !product.active;
        const verb = activating ? 'reactivar' : 'desactivar';
        const successMsg = activating ? 'Producto reactivado' : 'Producto desactivado';

        this.confirmationService.confirm({
            message: `¿Está seguro de ${verb} el producto ${product.name}?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                const onSuccess = () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: successMsg });
                    this.loadProducts();
                };
                const onError = (err: unknown) => {
                    console.error('Error toggling product status:', err);
                    this.messageService.add({ severity: 'error', summary: 'Error', detail: `Error al ${verb} producto` });
                };

                if (activating) {
                    this.productsService.update(product.id, { active: true }).subscribe({
                        next: onSuccess,
                        error: onError
                    });
                    return;
                }

                this.productsService.delete(product.id).subscribe({
                    next: () => {
                        onSuccess();
                    },
                    error: onError
                });
            }
        });
    }

    onSearchInput() {
        this.applyFilters();
    }

    clearSearch() {
        this.searchTerm = '';
        this.applyFilters();
    }

    onShowInactiveChange() {
        this.loadProducts();
    }

    setCategoryFilter(categoryId: string) {
        this.selectedCategoryId = categoryId || 'all';
        this.applyFilters();
    }

    isCategoryActive(categoryId: string) {
        return this.selectedCategoryId === (categoryId || 'all');
    }

    getProductSku(product: Product) {
        return product.codigo || product.barcode || product.id.slice(0, 8).toUpperCase();
    }

    hasLowStockBadge(product: Product) {
        return Number(product.lowStockAlertQty || 0) > 0 && !!product.active;
    }

    getStockBadgeLabel(product: Product) {
        if (!product.active) return 'INACTIVO';
        const lowQty = Number(product.lowStockAlertQty || 0);
        if (lowQty > 0) return `STOCK BAJO: ${this.formatCompactQuantity(lowQty)}`;
        return 'EN STOCK';
    }

    formatProductPrice(product: Product) {
        const currency = (product.currency || this.defaultProductCurrency) as SystemCurrencyCode;
        const amount = Number(product.price || 0);
        const locale = currency === 'USD' ? 'en-US' : 'es-CU';
        try {
            return new Intl.NumberFormat(locale, {
                style: 'currency',
                currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(amount);
        } catch {
            return `${amount.toFixed(2)} ${currency}`;
        }
    }

    private formatCompactQuantity(value: number) {
        if (Number.isInteger(value)) return String(value);
        return value.toFixed(2).replace(/\.?0+$/, '');
    }

    private applyFilters() {
        const source = this.allProducts();
        if (!source || source.length === 0) {
            this.products.set([]);
            return;
        }

        const term = (this.searchTerm || '').trim().toLowerCase();

        const filtered = source.filter((product) => {
            const productName = String(product.name || '').toLowerCase();
            const productCodigo = String(product.codigo || '').toLowerCase();
            const productBarcode = String(product.barcode || '').toLowerCase();
            const categoryMatches =
                this.selectedCategoryId === 'all' ||
                String(product.productCategoryId || '') === this.selectedCategoryId;

            if (!categoryMatches) return false;
            if (!term) return true;
            return (
                productName.includes(term) ||
                productCodigo.includes(term) ||
                productBarcode.includes(term)
            );
        });

        this.products.set(filtered);
    }

    triggerCsvImport(input: HTMLInputElement) {
        input.value = '';
        input.click();
    }

    onCsvSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input?.files?.[0];
        if (!file) return;

        const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv') || file.type === 'text/plain';
        if (!isCsv) {
            this.messageService.add({ severity: 'warn', summary: 'Formato inválido', detail: 'Seleccione un archivo CSV válido.' });
            input.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            const content = String(reader.result || '');
            await this.importProductsFromCsv(content);
            input.value = '';
        };
        reader.onerror = () => {
            this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo leer el archivo CSV.' });
            input.value = '';
        };
        reader.readAsText(file, 'utf-8');
    }

    private async importProductsFromCsv(content: string) {
        const rows = this.parseCsv(content);
        if (rows.length < 2) {
            this.messageService.add({ severity: 'warn', summary: 'CSV vacío', detail: 'El archivo no contiene filas de datos.' });
            return;
        }

        const headers = rows[0].map((h) => this.normalizeHeader(h));
        const nameIdx = headers.indexOf('name');
        const priceIdx = headers.indexOf('price');
        if (nameIdx === -1 || priceIdx === -1) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Columnas requeridas',
                detail: 'El CSV debe incluir al menos las columnas: name y price.'
            });
            return;
        }

        let created = 0;
        let failed = 0;
        let skipped = 0;
        const errors: string[] = [];
        const existingCodigo = new Set(
            this.products()
                .map((p) => this.toKey(p.codigo))
                .filter((key): key is string => !!key)
        );
        const existingBarcode = new Set(
            this.products()
                .map((p) => this.toKey(p.barcode))
                .filter((key): key is string => !!key)
        );
        const csvCodigo = new Set<string>();
        const csvBarcode = new Set<string>();

        for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            if (this.isEmptyRow(row)) continue;

            const raw = this.rowToRecord(headers, row);
            const line = rowIndex + 1;

            const name = (raw['name'] || '').trim();
            const priceText = (raw['price'] || '').trim().replace(',', '.');
            const price = Number(priceText);
            if (!name || Number.isNaN(price) || price <= 0) {
                failed++;
                errors.push(`Fila ${line}: name/price inválido.`);
                continue;
            }

            const productTypeId = this.resolveCatalogId(raw, 'producttypeid', 'producttype', this.productTypes());
            const productCategoryId = this.resolveCatalogId(raw, 'productcategoryid', 'productcategory', this.productCategories());
            const measurementUnitId = this.resolveCatalogId(raw, 'measurementunitid', 'measurementunit', this.measurementUnits());

            const dto: CreateProductDto = {
                name,
                price: price.toFixed(2),
                currency: this.defaultProductCurrency,
            };

            const codigo = (raw['codigo'] || '').trim();
            const barcode = (raw['barcode'] || '').trim();
            const costText = (raw['cost'] || '').trim().replace(',', '.');
            const cost = Number(costText);
            const lowStockAlertQtyText = (raw['lowstockalertqty'] || '').trim().replace(',', '.');
            const lowStockAlertQty = Number(lowStockAlertQtyText);
            const currencyText = (raw['currency'] || '').trim().toUpperCase();
            const allowFractionalQtyText = (raw['allowfractionalqty'] || '').trim().toLowerCase();

            const codigoKey = this.toKey(codigo);
            if (codigoKey && (existingCodigo.has(codigoKey) || csvCodigo.has(codigoKey))) {
                skipped++;
                errors.push(`Fila ${line}: código duplicado (${codigo}).`);
                continue;
            }

            const barcodeKey = this.toKey(barcode);
            if (barcodeKey && (existingBarcode.has(barcodeKey) || csvBarcode.has(barcodeKey))) {
                skipped++;
                errors.push(`Fila ${line}: código de barras duplicado (${barcode}).`);
                continue;
            }

            if (codigo) dto.codigo = codigo;
            if (barcode) dto.barcode = barcode;
            if (costText && !Number.isNaN(cost) && cost >= 0) dto.cost = cost.toFixed(2);
            if (lowStockAlertQtyText && !Number.isNaN(lowStockAlertQty) && lowStockAlertQty >= 0) {
                dto.lowStockAlertQty = lowStockAlertQty.toFixed(3);
            }
            if (['true', '1', 'yes', 'si', 'sí'].includes(allowFractionalQtyText)) {
                dto.allowFractionalQty = true;
            }
            if (currencyText && this.isValidCurrencyCode(currencyText)) dto.currency = currencyText as SystemCurrencyCode;
            if (productTypeId) dto.productTypeId = productTypeId;
            if (productCategoryId) dto.productCategoryId = productCategoryId;
            if (measurementUnitId) dto.measurementUnitId = measurementUnitId;

            try {
                await firstValueFrom(this.productsService.create(dto));
                created++;
                if (codigoKey) existingCodigo.add(codigoKey);
                if (barcodeKey) existingBarcode.add(barcodeKey);
                if (codigoKey) csvCodigo.add(codigoKey);
                if (barcodeKey) csvBarcode.add(barcodeKey);
            } catch (error: any) {
                failed++;
                const detail = error?.error?.message || 'Error al crear producto';
                errors.push(`Fila ${line}: ${detail}`);
            }
        }

        this.loadProducts();

        if (created > 0 && failed === 0 && skipped === 0) {
            this.messageService.add({
                severity: 'success',
                summary: 'Importación completada',
                detail: `Se importaron ${created} productos correctamente.`
            });
            return;
        }

        if (created > 0 || skipped > 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Importación procesada',
                detail: `Importados: ${created}. Omitidos: ${skipped}. Fallidos: ${failed}.`
            });
            console.warn('Errores de importación CSV:', errors);
            return;
        }

        this.messageService.add({
            severity: 'error',
            summary: 'Importación fallida',
            detail: 'No se pudo importar ningún producto. Revise formato y datos del CSV.'
        });
        console.warn('Errores de importación CSV:', errors);
    }

    private parseCsv(content: string): string[][] {
        const delimiter = this.detectCsvDelimiter(content);
        const rows: string[][] = [];
        let row: string[] = [];
        let value = '';
        let inQuotes = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const next = content[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    value += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }

            if (char === delimiter && !inQuotes) {
                row.push(value.trim());
                value = '';
                continue;
            }

            if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && next === '\n') i++;
                row.push(value.trim());
                rows.push(row);
                row = [];
                value = '';
                continue;
            }

            value += char;
        }

        if (value.length > 0 || row.length > 0) {
            row.push(value.trim());
            rows.push(row);
        }

        return rows.filter((r) => r.some((col) => col !== ''));
    }

    private detectCsvDelimiter(content: string): ',' | ';' {
        let sample = '';
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            if (char === '\n' || char === '\r') break;
            sample += char;
        }

        let commas = 0;
        let semicolons = 0;
        let inQuotes = false;

        for (let i = 0; i < sample.length; i++) {
            const char = sample[i];
            const next = sample[i + 1];
            if (char === '"') {
                if (inQuotes && next === '"') {
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (inQuotes) continue;
            if (char === ',') commas++;
            if (char === ';') semicolons++;
        }

        return semicolons > commas ? ';' : ',';
    }

    private rowToRecord(headers: string[], row: string[]) {
        const record: Record<string, string> = {};
        for (let i = 0; i < headers.length; i++) {
            record[headers[i]] = (row[i] || '').trim();
        }
        return record;
    }

    private normalizeHeader(value: string) {
        return String(value || '')
            .replace(/^\ufeff/, '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/_/g, '');
    }

    private resolveCatalogId(
        row: Record<string, string>,
        idKey: string,
        nameKey: string,
        catalog: Array<{ id: string; name: string }>
    ): string | undefined {
        const id = (row[idKey] || '').trim();
        if (id) return id;

        const name = (row[nameKey] || '').trim().toLowerCase();
        if (!name) return undefined;
        return catalog.find((item) => item.name.trim().toLowerCase() === name)?.id;
    }

    private isEmptyRow(row: string[]) {
        return row.every((col) => !String(col || '').trim());
    }

    private toKey(value?: string | null) {
        const normalized = String(value || '').trim().toLowerCase();
        return normalized.length ? normalized : undefined;
    }

    exportCSV() {
        const rows = this.products();
        if (!rows || rows.length === 0) {
            this.messageService.add({ severity: 'warn', summary: 'Sin datos', detail: 'No hay productos para exportar.' });
            return;
        }

        const headers = ['name', 'codigo', 'barcode', 'currency', 'price', 'cost', 'lowStockAlertQty', 'allowFractionalQty', 'productType', 'productCategory', 'measurementUnit', 'active'];
        const lines = rows.map((product) => [
            product.name || '',
            product.codigo || '',
            product.barcode || '',
            product.currency || this.defaultProductCurrency,
            product.price != null ? Number(product.price).toFixed(2) : '',
            product.cost != null ? Number(product.cost).toFixed(2) : '',
            product.lowStockAlertQty != null ? Number(product.lowStockAlertQty).toFixed(3) : '',
            product.allowFractionalQty ? 'true' : 'false',
            product.productType?.name || '',
            product.productCategory?.name || '',
            product.measurementUnit?.name || '',
            product.active ? 'true' : 'false',
        ]);

        const csv = [headers, ...lines]
            .map((line) => line.map((value) => this.escapeCsv(String(value ?? ''))).join(','))
            .join('\r\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const stamp = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `productos_${stamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.messageService.add({ severity: 'success', summary: 'Exportación', detail: 'CSV exportado correctamente.' });
    }

    private escapeCsv(value: string): string {
        if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    }

    private extractErrorMessage(error: any): string {
        const message = error?.error?.message;
        const rawErrorCode = String(error?.error?.code || error?.code || '').toUpperCase();
        const rawMessage = String(message || error?.message || '').toLowerCase();
        if (rawErrorCode.includes('LIMIT_FILE_SIZE') || rawMessage.includes('file too large') || error?.status === 413) {
            return `La imagen supera ${this.productImageMaxFileMb}MB.`;
        }
        if (Array.isArray(message)) {
            return message.map((item) => String(item || '').trim()).filter(Boolean).join(' | ');
        }
        if (typeof message === 'string' && message.trim()) {
            return message.trim();
        }
        if (typeof error?.message === 'string' && error.message.trim()) {
            return error.message.trim();
        }
        return '';
    }

    private isAllowedProductImage(file: File): boolean {
        const mime = String(file.type || '').trim().toLowerCase();
        const fileName = String(file.name || '').trim().toLowerCase();
        const hasAllowedMime = mime.startsWith('image/');
        const hasAllowedExtension = this.allowedProductImageExtensions.some((ext) => fileName.endsWith(ext));
        return hasAllowedMime || hasAllowedExtension;
    }

    private syncProfitMetricsFromCostAndPrice() {
        const cost = Number(this.product.cost || 0);
        const price = Number(this.product.price || 0);

        if (cost > 0 && price >= 0) {
            const amount = this.roundMoney(price - cost);
            this.profitAmount = amount;
            this.profitPercentage = this.roundPercent((amount / cost) * 100);
            this.suggestedPrice = this.roundMoney(price);
            return;
        }

        if (cost > 0) {
            this.calculateSuggestedPrice(false);
            return;
        }

        this.suggestedPrice = 0;
        this.profitAmount = 0;
        this.profitPercentage = 0;
    }

    private loadSystemCurrencySettings() {
        this.settingsService.getSystemSettings().subscribe({
            next: (settings) => {
                this.defaultProductCurrency = settings.defaultCurrency || 'CUP';
                const enabled = (settings.enabledCurrencies || ['CUP', 'USD']) as SystemCurrencyCode[];
                this.enabledProductCurrencies = enabled.length > 0 ? enabled : ['CUP'];
                this.currencyOptions = this.enabledProductCurrencies.map((code) => ({ label: code, value: code }));

                if (!this.enabledProductCurrencies.includes(this.defaultProductCurrency)) {
                    this.defaultProductCurrency = this.enabledProductCurrencies[0];
                }

                if (!this.product?.currency || !this.enabledProductCurrencies.includes(this.product.currency)) {
                    this.product.currency = this.defaultProductCurrency;
                }
            },
            error: () => {
                this.defaultProductCurrency = 'CUP';
                this.enabledProductCurrencies = ['CUP', 'USD'];
                this.currencyOptions = this.enabledProductCurrencies.map((code) => ({ label: code, value: code }));
                if (!this.product?.currency) {
                    this.product.currency = this.defaultProductCurrency;
                }
            }
        });
    }

    private roundMoney(value: number): number {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    private roundPercent(value: number): number {
        return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
    }

    private isValidCurrencyCode(code: string): code is SystemCurrencyCode {
        return code === 'CUP' || code === 'USD';
    }
}
