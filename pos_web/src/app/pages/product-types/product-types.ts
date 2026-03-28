import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CatalogService, ProductType } from '@/app/core/services/catalog.service';

@Component({
    selector: 'app-product-types',
    standalone: true,
    imports: [
        CommonModule,
        TableModule,
        FormsModule,
        ButtonModule,
        ToastModule,
        ToolbarModule,
        InputTextModule,
        DialogModule,
        TagModule,
        ToggleSwitchModule,
        ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo Tipo" icon="pi pi-plus" severity="secondary" class="mr-2" (onClick)="openNew()" />
            </ng-template>
            <ng-template #end>
                <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" (onClick)="loadData()" />
            </ng-template>
        </p-toolbar>

        <p-table
            [value]="items()"
            [rows]="10"
            [paginator]="true"
            [tableStyle]="{ 'min-width': '50rem' }"
            [rowHover]="true"
            dataKey="id"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} tipos"
        >
            <ng-template #header>
                <tr>
                    <th pSortableColumn="name">Nombre <p-sortIcon field="name" /></th>
                    <th pSortableColumn="description">Descripción</th>
                    <th pSortableColumn="active">Estado</th>
                    <th>Acciones</th>
                </tr>
            </ng-template>
            <ng-template #body let-item>
                <tr>
                    <td>{{ item.name }}</td>
                    <td>{{ item.description || '-' }}</td>
                    <td>
                        <p-tag [value]="item.active ? 'Activo' : 'Inactivo'" [severity]="item.active ? 'success' : 'warn'" />
                    </td>
                    <td>
                        <p-button icon="pi pi-pencil" class="mr-2" [rounded]="true" [outlined]="true" severity="success" (onClick)="editItem(item)" />
                        <p-button icon="pi pi-trash" [rounded]="true" [outlined]="true" severity="danger" (onClick)="deleteItem(item)" />
                    </td>
                </tr>
            </ng-template>
            <ng-template #emptymessage>
                <tr>
                    <td colspan="4">No se encontraron tipos de producto.</td>
                </tr>
            </ng-template>
        </p-table>

        <p-dialog 
            header="{{ isEditMode() ? 'Editar' : 'Nuevo' }} Tipo de Producto" 
            [(visible)]="dialogVisible" 
            [modal]="true" 
            [style]="{ width: '450px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="name">Nombre *</label>
                    <input pInputText id="name" [(ngModel)]="item.name" required autofocus class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="description">Descripción</label>
                    <input pInputText id="description" [(ngModel)]="item.description" class="w-full" />
                </div>
                @if (isEditMode()) {
                    <div class="flex align-items-center gap-2">
                        <p-toggleswitch id="active" [(ngModel)]="item.active" />
                        <label for="active">Activo</label>
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveItem()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class ProductTypes implements OnInit {
    items = signal<ProductType[]>([]);
    isEditMode = signal<boolean>(false);
    dialogVisible = false;
    
    item: any = {
        name: '',
        description: '',
        active: true
    };
    selectedItem: ProductType | null = null;

    constructor(
        private catalogService: CatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.catalogService.getProductTypes().subscribe({
            next: (data) => this.items.set(data),
            error: (_err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar tipos de producto' })
        });
    }

    openNew() {
        this.item = { name: '', description: '', active: true };
        this.selectedItem = null;
        this.isEditMode.set(false);
        this.dialogVisible = true;
    }

    editItem(item: ProductType) {
        this.selectedItem = item;
        this.item = { ...item };
        this.isEditMode.set(true);
        this.dialogVisible = true;
    }

    hideDialog() {
        this.dialogVisible = false;
        this.selectedItem = null;
    }

    saveItem() {
        if (!this.item.name) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El nombre es requerido' });
            return;
        }

        const saveObservable = this.isEditMode() && this.selectedItem
            ? this.catalogService.updateProductType(this.selectedItem.id, this.item)
            : this.catalogService.createProductType(this.item);

        saveObservable.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.isEditMode() ? 'Tipo actualizado' : 'Tipo creado' });
                this.loadData();
                this.hideDialog();
            },
            error: (_err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar' })
        });
    }

    deleteItem(item: ProductType) {
        this.confirmationService.confirm({
            message: `¿Está seguro de eliminar el tipo ${item.name}?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.catalogService.deleteProductType(item.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Tipo eliminado' });
                        this.loadData();
                    },
                    error: (_err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar' })
                });
            }
        });
    }
}
