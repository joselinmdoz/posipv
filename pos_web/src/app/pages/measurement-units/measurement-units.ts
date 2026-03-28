import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
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

type MeasurementUnitRow = MeasurementUnit & {
    groupTypeName: string;
};

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
                <p-button label="Nuevo tipo" icon="pi pi-folder-plus" severity="secondary" class="mr-2" (onClick)="openNewType()" />
                <p-button label="Nueva unidad" icon="pi pi-plus" severity="secondary" (onClick)="openNewUnit()" />
            </ng-template>
            <ng-template #end>
                <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" (onClick)="loadData()" />
            </ng-template>
        </p-toolbar>

        <div class="grid grid-cols-1 2xl:grid-cols-3 gap-4">
            <div class="2xl:col-span-1">
                <div class="card">
                    <div class="flex items-center justify-between mb-3">
                        <div class="font-semibold text-lg">Tipos de Unidad</div>
                    </div>

                    <div class="mb-3">
                        <input
                            pInputText
                            [(ngModel)]="typeSearchTerm"
                            (ngModelChange)="applyTypeFilter()"
                            class="w-full"
                            placeholder="Buscar tipo por nombre o descripción"
                        />
                    </div>

                    <p-table
                        [value]="filteredTypes()"
                        [rows]="8"
                        [paginator]="true"
                        responsiveLayout="scroll"
                        [rowsPerPageOptions]="[8, 16, 32]"
                        dataKey="id"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} tipos"
                    >
                        <ng-template #header>
                            <tr>
                                <th>Tipo</th>
                                <th class="text-right">Unidades</th>
                                <th>Estado</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-type>
                            <tr>
                                <td>
                                    <div class="font-medium">{{ type.name }}</div>
                                    <div class="text-xs text-gray-500">{{ type.description || '-' }}</div>
                                </td>
                                <td class="text-right">{{ countUnitsByType(type.id) }}</td>
                                <td>
                                    <p-tag [value]="type.active ? 'Activo' : 'Inactivo'" [severity]="type.active ? 'success' : 'warn'" />
                                </td>
                                <td class="text-center">
                                    <div class="flex justify-center gap-1">
                                        <p-button icon="pi pi-pencil" [rounded]="true" [outlined]="true" severity="success" (onClick)="editType(type)" />
                                        <p-button icon="pi pi-trash" [rounded]="true" [outlined]="true" severity="danger" (onClick)="deleteType(type)" />
                                    </div>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr>
                                <td colspan="4" class="text-center">No se encontraron tipos de unidad.</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </div>

            <div class="2xl:col-span-2">
                <div class="card">
                    <div class="flex items-center justify-between mb-3">
                        <div class="font-semibold text-lg">Unidades de Medida (Agrupadas por Tipo)</div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-3">
                        <input
                            pInputText
                            [(ngModel)]="unitSearchTerm"
                            (ngModelChange)="applyUnitFilter()"
                            class="w-full"
                            placeholder="Buscar unidad por nombre, símbolo o tipo"
                        />
                        <p-select
                            [options]="unitTypeFilterOptions()"
                            optionLabel="label"
                            optionValue="value"
                            [(ngModel)]="unitTypeFilter"
                            (ngModelChange)="applyUnitFilter()"
                            class="w-full"
                            placeholder="Filtrar por tipo"
                            [showClear]="true"
                        />
                    </div>

                    <p-table
                        [value]="filteredUnits()"
                        [rows]="12"
                        [paginator]="true"
                        responsiveLayout="scroll"
                        [rowsPerPageOptions]="[12, 24, 48]"
                        dataKey="id"
                        sortField="groupTypeName"
                        sortMode="single"
                        rowGroupMode="subheader"
                        groupRowsBy="groupTypeName"
                        currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} unidades"
                    >
                        <ng-template #header>
                            <tr>
                                <th>Nombre</th>
                                <th>Símbolo</th>
                                <th>Estado</th>
                                <th class="text-center">Acciones</th>
                            </tr>
                        </ng-template>
                        <ng-template #groupheader let-unit>
                            <tr pRowGroupHeader>
                                <td colspan="4">
                                    <div class="font-semibold text-primary">{{ unit.groupTypeName }}</div>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #body let-unit>
                            <tr>
                                <td>{{ unit.name }}</td>
                                <td>{{ unit.symbol }}</td>
                                <td>
                                    <p-tag [value]="unit.active ? 'Activo' : 'Inactivo'" [severity]="unit.active ? 'success' : 'warn'" />
                                </td>
                                <td class="text-center">
                                    <div class="flex justify-center gap-1">
                                        <p-button icon="pi pi-pencil" [rounded]="true" [outlined]="true" severity="success" (onClick)="editUnit(unit)" />
                                        <p-button icon="pi pi-trash" [rounded]="true" [outlined]="true" severity="danger" (onClick)="deleteUnit(unit)" />
                                    </div>
                                </td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr>
                                <td colspan="4" class="text-center">No se encontraron unidades de medida.</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            </div>
        </div>

        <p-dialog
            [header]="isTypeEditMode() ? 'Editar tipo de unidad' : 'Nuevo tipo de unidad'"
            [(visible)]="typeDialogVisible"
            [modal]="true"
            [style]="{ width: '460px' }"
            [breakpoints]="{ '960px': '98vw' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="type-name">Nombre *</label>
                    <input pInputText id="type-name" [(ngModel)]="typeForm.name" required autofocus class="w-full" />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="type-description">Descripción</label>
                    <input pInputText id="type-description" [(ngModel)]="typeForm.description" class="w-full" />
                </div>
                @if (isTypeEditMode()) {
                    <div class="flex items-center gap-2">
                        <p-toggleswitch id="type-active" [(ngModel)]="typeForm.active" />
                        <label for="type-active">Activo</label>
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideTypeDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveType()" />
            </ng-template>
        </p-dialog>

        <p-dialog
            [header]="isUnitEditMode() ? 'Editar unidad de medida' : 'Nueva unidad de medida'"
            [(visible)]="unitDialogVisible"
            [modal]="true"
            [style]="{ width: '520px' }"
            [breakpoints]="{ '960px': '98vw' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="flex flex-col gap-2">
                        <label for="unit-name">Nombre *</label>
                        <input pInputText id="unit-name" [(ngModel)]="unitForm.name" required autofocus class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="unit-symbol">Símbolo *</label>
                        <input pInputText id="unit-symbol" [(ngModel)]="unitForm.symbol" required class="w-full" placeholder="ej: kg, lt, und" />
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <label for="unit-type">Tipo de unidad</label>
                        <p-select
                            id="unit-type"
                            [options]="unitTypes()"
                            [(ngModel)]="unitForm.typeId"
                            optionLabel="name"
                            optionValue="id"
                            [appendTo]="'body'"
                            placeholder="Seleccionar tipo"
                            [showClear]="true"
                            class="w-full"
                        />
                </div>
                @if (isUnitEditMode()) {
                    <div class="flex items-center gap-2">
                        <p-toggleswitch id="unit-active" [(ngModel)]="unitForm.active" />
                        <label for="unit-active">Activo</label>
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideUnitDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveUnit()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class MeasurementUnits implements OnInit {
    units = signal<MeasurementUnitRow[]>([]);
    filteredUnits = signal<MeasurementUnitRow[]>([]);
    unitTypes = signal<MeasurementUnitType[]>([]);
    filteredTypes = signal<MeasurementUnitType[]>([]);

    isTypeEditMode = signal<boolean>(false);
    isUnitEditMode = signal<boolean>(false);

    typeDialogVisible = false;
    unitDialogVisible = false;

    typeSearchTerm = '';
    unitSearchTerm = '';
    unitTypeFilter: string | null = null;

    typeForm: {
        name: string;
        description: string;
        active: boolean;
    } = {
        name: '',
        description: '',
        active: true
    };

    unitForm: {
        name: string;
        symbol: string;
        typeId?: string;
        active: boolean;
    } = {
        name: '',
        symbol: '',
        typeId: undefined,
        active: true
    };

    selectedType: MeasurementUnitType | null = null;
    selectedUnit: MeasurementUnitRow | null = null;

    constructor(
        private catalogService: CatalogService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        forkJoin({
            unitTypes: this.catalogService.getMeasurementUnitTypes(),
            units: this.catalogService.getMeasurementUnits()
        }).subscribe({
            next: ({ unitTypes, units }) => {
                this.unitTypes.set(unitTypes || []);
                this.units.set(this.buildUnitRows(units || []));
                this.applyTypeFilter();
                this.applyUnitFilter();
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar tipos y unidades de medida.'
                });
            }
        });
    }

    unitTypeFilterOptions() {
        return [{ label: 'Todos los tipos', value: null }, ...this.unitTypes().map((type) => ({ label: type.name, value: type.id }))];
    }

    applyTypeFilter() {
        const term = (this.typeSearchTerm || '').trim().toLowerCase();
        const filtered = this.unitTypes().filter((type) => {
            if (!term) return true;
            return type.name.toLowerCase().includes(term) || (type.description || '').toLowerCase().includes(term);
        });
        this.filteredTypes.set(filtered);
    }

    applyUnitFilter() {
        const term = (this.unitSearchTerm || '').trim().toLowerCase();
        const typeFilter = this.unitTypeFilter;
        const filtered = this.units().filter((unit) => {
            const matchesTerm =
                !term ||
                unit.name.toLowerCase().includes(term) ||
                unit.symbol.toLowerCase().includes(term) ||
                unit.groupTypeName.toLowerCase().includes(term);
            const matchesType = !typeFilter || unit.typeId === typeFilter;
            return matchesTerm && matchesType;
        });
        this.filteredUnits.set(filtered);
    }

    countUnitsByType(typeId: string) {
        return this.units().filter((unit) => unit.typeId === typeId && unit.active).length;
    }

    openNewType() {
        this.selectedType = null;
        this.isTypeEditMode.set(false);
        this.typeForm = { name: '', description: '', active: true };
        this.typeDialogVisible = true;
    }

    editType(type: MeasurementUnitType) {
        this.selectedType = type;
        this.isTypeEditMode.set(true);
        this.typeForm = {
            name: type.name || '',
            description: type.description || '',
            active: !!type.active
        };
        this.typeDialogVisible = true;
    }

    hideTypeDialog() {
        this.typeDialogVisible = false;
        this.selectedType = null;
    }

    saveType() {
        const payload = {
            name: (this.typeForm.name || '').trim(),
            description: (this.typeForm.description || '').trim() || undefined,
            active: this.typeForm.active
        };

        if (!payload.name) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'El nombre del tipo es requerido.'
            });
            return;
        }

        const request$ =
            this.isTypeEditMode() && this.selectedType
                ? this.catalogService.updateMeasurementUnitType(this.selectedType.id, payload)
                : this.catalogService.createMeasurementUnitType(payload);

        request$.subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: this.isTypeEditMode() ? 'Tipo de unidad actualizado' : 'Tipo de unidad creado'
                });
                this.hideTypeDialog();
                this.loadData();
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo guardar el tipo de unidad.'
                });
            }
        });
    }

    deleteType(type: MeasurementUnitType) {
        const usedCount = this.countUnitsByType(type.id);
        if (usedCount > 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Tipo en uso',
                detail: `No se puede eliminar "${type.name}" porque tiene ${usedCount} unidad(es) activa(s) asociada(s).`
            });
            return;
        }

        this.confirmationService.confirm({
            message: `¿Está seguro de eliminar el tipo "${type.name}"?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.catalogService.deleteMeasurementUnitType(type.id).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Éxito',
                            detail: 'Tipo de unidad eliminado'
                        });
                        this.loadData();
                    },
                    error: () => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: 'No se pudo eliminar el tipo de unidad.'
                        });
                    }
                });
            }
        });
    }

    openNewUnit() {
        this.selectedUnit = null;
        this.isUnitEditMode.set(false);
        this.unitForm = { name: '', symbol: '', typeId: undefined, active: true };
        this.unitDialogVisible = true;
    }

    editUnit(unit: MeasurementUnitRow) {
        this.selectedUnit = unit;
        this.isUnitEditMode.set(true);
        this.unitForm = {
            name: unit.name || '',
            symbol: unit.symbol || '',
            typeId: unit.typeId || undefined,
            active: !!unit.active
        };
        this.unitDialogVisible = true;
    }

    hideUnitDialog() {
        this.unitDialogVisible = false;
        this.selectedUnit = null;
    }

    saveUnit() {
        const payload = {
            name: (this.unitForm.name || '').trim(),
            symbol: (this.unitForm.symbol || '').trim(),
            typeId: this.unitForm.typeId || undefined,
            active: this.unitForm.active
        };

        if (!payload.name || !payload.symbol) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'El nombre y símbolo de la unidad son requeridos.'
            });
            return;
        }

        const request$ =
            this.isUnitEditMode() && this.selectedUnit
                ? this.catalogService.updateMeasurementUnit(this.selectedUnit.id, payload)
                : this.catalogService.createMeasurementUnit(payload);

        request$.subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: this.isUnitEditMode() ? 'Unidad actualizada' : 'Unidad creada'
                });
                this.hideUnitDialog();
                this.loadData();
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo guardar la unidad de medida.'
                });
            }
        });
    }

    deleteUnit(unit: MeasurementUnitRow) {
        this.confirmationService.confirm({
            message: `¿Está seguro de eliminar la unidad "${unit.name}"?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.catalogService.deleteMeasurementUnit(unit.id).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Éxito',
                            detail: 'Unidad eliminada'
                        });
                        this.loadData();
                    },
                    error: () => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: 'No se pudo eliminar la unidad de medida.'
                        });
                    }
                });
            }
        });
    }

    private buildUnitRows(units: MeasurementUnit[]): MeasurementUnitRow[] {
        return (units || [])
            .map((unit) => ({
                ...unit,
                groupTypeName: unit.type?.name?.trim() || 'Sin tipo'
            }))
            .sort((a, b) => {
                const byType = a.groupTypeName.localeCompare(b.groupTypeName);
                if (byType !== 0) return byType;
                return a.name.localeCompare(b.name);
            });
    }
}
