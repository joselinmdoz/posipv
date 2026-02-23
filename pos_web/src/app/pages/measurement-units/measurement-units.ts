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
import { SelectModule } from 'primeng/select';
import { CatalogService, MeasurementUnit, MeasurementUnitType } from '@/app/core/services/catalog.service';

@Component({
    selector: 'app-measurement-units',
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
        ConfirmDialogModule,
        SelectModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nueva Unidad" icon="pi pi-plus" severity="secondary" class="mr-2" (onClick)="openNew()" />
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
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} unidades"
        >
            <ng-template #header>
                <tr>
                    <th pSortableColumn="name">Nombre <p-sortIcon field="name" /></th>
                    <th pSortableColumn="symbol">Símbolo</th>
                    <th pSortableColumn="type">Tipo</th>
                    <th pSortableColumn="active">Estado</th>
                    <th>Acciones</th>
                </tr>
            </ng-template>
            <ng-template #body let-item>
                <tr>
                    <td>{{ item.name }}</td>
                    <td>{{ item.symbol }}</td>
                    <td>{{ item.type?.name || '-' }}</td>
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
                    <td colspan="5">No se encontraron unidades de medida.</td>
                </tr>
            </ng-template>
        </p-table>

        <p-dialog 
            header="{{ isEditMode() ? 'Editar' : 'Nueva' }} Unidad de Medida" 
            [(visible)]="dialogVisible" 
            [modal]="true" 
            [style]="{ width: '450px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="name">Nombre *</label>
                        <input pInputText id="name" [(ngModel)]="item.name" required autofocus class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="symbol">Símbolo *</label>
                        <input pInputText id="symbol" [(ngModel)]="item.symbol" required class="w-full" placeholder="ej: kg, lt, und" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="typeId">Tipo de Unidad</label>
                    <p-select 
                        id="typeId" 
                        [options]="unitTypes()" 
                        [(ngModel)]="item.typeId" 
                        optionLabel="name" 
                        optionValue="id"
                        placeholder="Seleccionar tipo"
                        [showClear]="true"
                        class="w-full"
                    />
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
export class MeasurementUnits implements OnInit {
    items = signal<MeasurementUnit[]>([]);
    unitTypes = signal<MeasurementUnitType[]>([]);
    isEditMode = signal<boolean>(false);
    dialogVisible = false;
    
    item: any = {
        name: '',
        symbol: '',
        typeId: undefined,
        active: true
    };
    selectedItem: MeasurementUnit | null = null;

    constructor(
        private catalogService: CatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadData();
        this.loadUnitTypes();
    }

    loadData() {
        this.catalogService.getMeasurementUnits().subscribe({
            next: (data) => this.items.set(data),
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar unidades de medida' })
        });
    }

    loadUnitTypes() {
        this.catalogService.getMeasurementUnitTypes().subscribe({
            next: (data) => this.unitTypes.set(data),
            error: (err) => console.error('Error loading unit types:', err)
        });
    }

    openNew() {
        this.item = { name: '', symbol: '', typeId: undefined, active: true };
        this.selectedItem = null;
        this.isEditMode.set(false);
        this.dialogVisible = true;
    }

    editItem(item: MeasurementUnit) {
        this.selectedItem = item;
        this.item = { ...item, typeId: item.typeId };
        this.isEditMode.set(true);
        this.dialogVisible = true;
    }

    hideDialog() {
        this.dialogVisible = false;
        this.selectedItem = null;
    }

    saveItem() {
        if (!this.item.name || !this.item.symbol) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El nombre y símbolo son requeridos' });
            return;
        }

        const saveObservable = this.isEditMode() && this.selectedItem
            ? this.catalogService.updateMeasurementUnit(this.selectedItem.id, this.item)
            : this.catalogService.createMeasurementUnit(this.item);

        saveObservable.subscribe({
            next: () => {
                this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.isEditMode() ? 'Unidad actualizada' : 'Unidad creada' });
                this.loadData();
                this.hideDialog();
            },
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al guardar' })
        });
    }

    deleteItem(item: MeasurementUnit) {
        this.confirmationService.confirm({
            message: `¿Está seguro de eliminar la unidad ${item.name}?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.catalogService.deleteMeasurementUnit(item.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Unidad eliminada' });
                        this.loadData();
                    },
                    error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar' })
                });
            }
        });
    }
}
