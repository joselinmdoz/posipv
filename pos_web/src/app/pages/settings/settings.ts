import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { SettingsService, RegisterSettings, PaymentMethodSetting, Denomination } from '@/app/core/services/settings.service';
import { PosService, Register } from '@/app/core/services/pos.service';
import { WarehousesService, Warehouse } from '@/app/core/services/warehouses.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        TableModule,
        ToastModule,
        CardModule,
        ToggleSwitchModule
    ],
    providers: [MessageService],
    template: `
        <div class="p-4">
            <h1 class="text-2xl font-bold mb-4">Configuraciones del TPV</h1>

            <!-- Selector de TPV -->
            <div class="mb-4">
                <label class="block mb-2 font-medium">Seleccionar TPV</label>
                <p-select 
                    [options]="registerOptions" 
                    [(ngModel)]="selectedRegisterId" 
                    placeholder="Seleccionar TPV"
                    (onChange)="loadSettings()"
                    styleClass="w-64" 
                />
            </div>

            @if (selectedRegisterId) {
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Configuración General -->
                    <p-card header="Configuración General">
                        <div class="flex flex-col gap-4">
                            <div>
                                <label class="block mb-2">Fondo de caja por defecto</label>
                                <p-inputnumber 
                                    [(ngModel)]="settings().defaultOpeningFloat" 
                                    mode="currency" 
                                    currency="USD" 
                                    locale="en-US" 
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block mb-2">Moneda</label>
                                <p-select 
                                    [options]="currencyOptions" 
                                    [(ngModel)]="settings().currency" 
                                    class="w-full"
                                />
                            </div>
                            <div>
                                <label class="block mb-2">Almacén predeterminado</label>
                                <p-select 
                                    [options]="warehouseOptions" 
                                    [(ngModel)]="settings().warehouseId" 
                                    placeholder="Seleccionar almacén"
                                    [showClear]="true"
                                    class="w-full"
                                />
                            </div>
                        </div>
                    </p-card>

                    <!-- Métodos de Pago -->
                    <p-card header="Métodos de Pago">
                        <div class="flex flex-col gap-2">
                            @for (method of paymentMethods(); track method.code) {
                                <div class="flex items-center justify-between p-2 border rounded">
                                    <span>{{ method.name }}</span>
                                    <p-toggleswitch [(ngModel)]="method.enabled" />
                                </div>
                            }
                        </div>
                    </p-card>

                    <!-- Denominaciones -->
                    <p-card header="Denominaciones" styleClass="md:col-span-2">
                        <p-table [value]="denominations()" [rows]="5">
                            <ng-template #header>
                                <tr>
                                    <th>Valor</th>
                                    <th>Habilitado</th>
                                    <th>Acciones</th>
                                </tr>
                            </ng-template>
                            <ng-template #body let-denom>
                                <tr>
                                    <td>{{ denom.value | currency }}</td>
                                    <td>
                                        <p-toggleswitch [(ngModel)]="denom.enabled" />
                                    </td>
                                    <td>
                                        <p-button 
                                            icon="pi pi-trash" 
                                            [text]="true" 
                                            severity="danger"
                                            (onClick)="removeDenomination(denom)"
                                        />
                                    </td>
                                </tr>
                            </ng-template>
                            <ng-template #emptymessage>
                                <tr>
                                    <td colspan="3" class="text-center">No hay denominaciones configuradas.</td>
                                </tr>
                            </ng-template>
                        </p-table>

                        <div class="mt-4 flex gap-2">
                            <p-inputnumber 
                                [(ngModel)]="newDenomination" 
                                mode="currency" 
                                currency="USD" 
                                locale="en-US"
                                placeholder="Nueva denominación"
                            />
                            <p-button 
                                label="Agregar" 
                                icon="pi pi-plus" 
                                (onClick)="addDenomination()"
                                [disabled]="!newDenomination"
                            />
                        </div>
                    </p-card>
                </div>

                <!-- Botón Guardar -->
                <div class="mt-4">
                    <p-button 
                        label="Guardar Configuraciones" 
                        icon="pi pi-save" 
                        (onClick)="saveSettings()"
                    />
                </div>
            } @else {
                <div class="text-center py-8 text-gray-500">
                    <i class="pi pi-cog text-4xl mb-2"></i>
                    <p>Seleccione un TPV para configurar</p>
                </div>
            }
        </div>

        <p-toast />
    `
})
export class Settings implements OnInit {
    registerOptions: any[] = [];
    warehouseOptions: any[] = [];
    selectedRegisterId: string = '';
    
    settings = signal<RegisterSettings>({
        id: '',
        registerId: '',
        defaultOpeningFloat: 0,
        currency: 'USD',
        warehouseId: '',
        paymentMethods: [],
        denominations: []
    });
    
    paymentMethods = signal<PaymentMethodSetting[]>([]);
    denominations = signal<Denomination[]>([]);
    
    newDenomination: number = 0;

    currencyOptions = [
        { label: 'USD - Dólar estadounidense', value: 'USD' },
        { label: 'EUR - Euro', value: 'EUR' },
        { label: 'MXN - Peso mexicano', value: 'MXN' },
        { label: 'COP - Peso colombiano', value: 'COP' }
    ];

    constructor(
        private settingsService: SettingsService,
        private posService: PosService,
        private warehousesService: WarehousesService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadRegisters();
        this.loadWarehouses();
    }

    loadRegisters() {
        this.posService.loadRegisters();
        setTimeout(() => {
            this.registerOptions = this.posService.registers().map(r => ({
                label: r.name,
                value: r.id
            }));
        }, 500);
    }

    loadWarehouses() {
        this.warehousesService.listWarehouses().subscribe({
            next: (warehouses) => {
                this.warehouseOptions = [
                    { label: 'Sin asignar', value: '' },
                    ...warehouses.map(w => ({ label: w.name, value: w.id }))
                ];
            }
        });
    }

    loadSettings() {
        if (!this.selectedRegisterId) return;

        this.settingsService.getRegisterSettings(this.selectedRegisterId).subscribe({
            next: (settings) => {
                this.settings.set(settings);
                this.paymentMethods.set(settings.paymentMethods || []);
                this.denominations.set(settings.denominations || []);
            },
            error: () => {
                // Create default settings
                this.paymentMethods.set([
                    { id: '1', code: 'CASH', name: 'Efectivo', enabled: true },
                    { id: '2', code: 'CARD', name: 'Tarjeta', enabled: true },
                    { id: '3', code: 'TRANSFER', name: 'Transferencia', enabled: true },
                    { id: '4', code: 'OTHER', name: 'Otro', enabled: false }
                ]);
                this.denominations.set([]);
            }
        });
    }

    addDenomination() {
        if (!this.newDenomination) return;
        
        const current = this.denominations();
        this.denominations.set([...current, {
            id: `temp-${Date.now()}`,
            value: this.newDenomination,
            enabled: true
        }]);
        this.newDenomination = 0;
    }

    removeDenomination(denom: Denomination) {
        const current = this.denominations();
        this.denominations.set(current.filter(d => d.id !== denom.id));
    }

    saveSettings() {
        if (!this.selectedRegisterId) return;

        const settings = this.settings();
        
        this.settingsService.saveRegisterSettings(this.selectedRegisterId, {
            defaultOpeningFloat: settings.defaultOpeningFloat,
            currency: settings.currency,
            warehouseId: settings.warehouseId || undefined,
            paymentMethods: this.paymentMethods()
                .filter(m => m.enabled)
                .map(m => m.code),
            denominations: this.denominations()
                .filter(d => d.enabled)
                .map(d => d.value)
        }).subscribe({
            next: () => {
                this.messageService.add({ 
                    severity: 'success', 
                    summary: 'Éxito', 
                    detail: 'Configuraciones guardadas' 
                });
            },
            error: () => {
                this.messageService.add({ 
                    severity: 'error', 
                    summary: 'Error', 
                    detail: 'Error al guardar configuraciones' 
                });
            }
        });
    }
}
