import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { SettingsService, Denomination } from '@/app/core/services/settings.service';
import { PosService } from '@/app/core/services/pos.service';

@Component({
    selector: 'app-denominations',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputNumberModule,
        SelectModule,
        TableModule,
        ToastModule,
        CardModule,
        ToggleSwitchModule
    ],
    providers: [MessageService],
    template: `
        <div class="p-4">
            <h1 class="text-2xl font-bold mb-4">Gestión de Denominaciones</h1>

            <div class="mb-4">
                <label class="block mb-2 font-medium">Seleccionar TPV</label>
                <p-select
                    [options]="registerOptions"
                    [(ngModel)]="selectedRegisterId"
                    placeholder="Seleccionar TPV"
                    (onChange)="loadDenominations()"
                    styleClass="w-64"
                />
            </div>

            @if (selectedRegisterId) {
                <p-card header="Denominaciones de monedas y billetes">
                    <p-table [value]="denominations()" [rows]="10">
                        <ng-template #header>
                            <tr>
                                <th>Valor</th>
                                <th>Habilitado</th>
                                <th>Acciones</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-denom>
                            <tr>
                                <td>
                                    <p-inputnumber
                                        [(ngModel)]="denom.value"
                                        mode="currency"
                                        [currency]="currency"
                                        locale="en-US"
                                        [min]="0.01"
                                        [max]="999999"
                                        [maxFractionDigits]="2"
                                        (onFocus)="rememberDenominationValue(denom)"
                                        (onBlur)="validateDenominationValue(denom)"
                                    />
                                </td>
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
                            [currency]="currency"
                            locale="en-US"
                            [min]="0.01"
                            [max]="999999"
                            [maxFractionDigits]="2"
                            placeholder="Nueva denominación"
                        />
                        <p-button
                            label="Agregar"
                            icon="pi pi-plus"
                            (onClick)="addDenomination()"
                            [disabled]="!newDenomination"
                        />
                        <p-button
                            label="Guardar"
                            icon="pi pi-save"
                            (onClick)="saveDenominations()"
                        />
                    </div>
                </p-card>
            } @else {
                <div class="text-center py-8 text-gray-500">
                    <i class="pi pi-money-bill text-4xl mb-2"></i>
                    <p>Seleccione un TPV para gestionar sus denominaciones</p>
                </div>
            }
        </div>

        <p-toast />
    `
})
export class Denominations implements OnInit {
    registerOptions: any[] = [];
    selectedRegisterId: string = '';
    denominations = signal<Denomination[]>([]);
    currency: string = 'USD';
    newDenomination: number = 0;

    private denominationSnapshot: Record<string, number> = {};

    constructor(
        private settingsService: SettingsService,
        private posService: PosService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadRegisters();
    }

    loadRegisters() {
        this.posService.loadRegisters();
        setTimeout(() => {
            this.registerOptions = this.posService.registers().map((r) => ({
                label: r.name,
                value: r.id
            }));
        }, 500);
    }

    loadDenominations() {
        if (!this.selectedRegisterId) return;

        this.settingsService.getRegisterSettings(this.selectedRegisterId).subscribe({
            next: (settings) => {
                this.currency = settings.currency || 'USD';
                this.denominations.set(
                    this.sortDenominations(
                        (settings.denominations || []).map((d) => ({
                            ...d,
                            value: this.normalizeDenominationValue(Number(d.value))
                        }))
                    )
                );
                this.syncDenominationSnapshot();
            },
            error: () => {
                this.denominations.set([]);
                this.syncDenominationSnapshot();
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar las denominaciones'
                });
            }
        });
    }

    addDenomination() {
        const value = this.normalizeDenominationValue(this.newDenomination);
        if (value <= 0) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'La denominación debe ser mayor a 0'
            });
            return;
        }

        if (this.hasDenominationValue(value)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'La denominación ya existe'
            });
            return;
        }

        this.denominations.set(
            this.sortDenominations([
                ...this.denominations(),
                {
                    id: `temp-${Date.now()}`,
                    value,
                    enabled: true
                }
            ])
        );
        this.syncDenominationSnapshot();
        this.newDenomination = 0;
    }

    removeDenomination(denom: Denomination) {
        this.denominations.set(this.denominations().filter((d) => d.id !== denom.id));
        this.syncDenominationSnapshot();
    }

    rememberDenominationValue(denom: Denomination) {
        this.denominationSnapshot[denom.id] = this.normalizeDenominationValue(Number(denom.value));
    }

    validateDenominationValue(denom: Denomination) {
        const previousValue = this.denominationSnapshot[denom.id] ?? this.normalizeDenominationValue(Number(denom.value));
        const nextValue = this.normalizeDenominationValue(Number(denom.value));

        if (nextValue <= 0) {
            denom.value = previousValue;
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'La denominación debe ser mayor a 0'
            });
            return;
        }

        if (this.hasDenominationValue(nextValue, denom.id)) {
            denom.value = previousValue;
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Ya existe una denominación con ese valor'
            });
            return;
        }

        denom.value = nextValue;
        this.denominations.set(this.sortDenominations([...this.denominations()]));
        this.syncDenominationSnapshot();
    }

    saveDenominations() {
        if (!this.selectedRegisterId) return;
        if (!this.areDenominationsValid()) return;

        const payload = this.sortDenominations(this.denominations()).map((d) => ({
            value: this.normalizeDenominationValue(Number(d.value)),
            enabled: d.enabled
        }));

        this.settingsService
            .saveRegisterSettings(this.selectedRegisterId, {
                denominations: payload
            })
            .subscribe({
                next: (settings) => {
                    this.currency = settings.currency || this.currency;
                    this.denominations.set(
                        this.sortDenominations(
                            (settings.denominations || []).map((d) => ({
                                ...d,
                                value: this.normalizeDenominationValue(Number(d.value))
                            }))
                        )
                    );
                    this.syncDenominationSnapshot();
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: 'Denominaciones guardadas'
                    });
                },
                error: () => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'Error al guardar denominaciones'
                    });
                }
            });
    }

    private normalizeDenominationValue(value: number): number {
        if (!Number.isFinite(value)) return 0;
        return Number(value.toFixed(2));
    }

    private hasDenominationValue(value: number, ignoreId?: string): boolean {
        const normalized = this.normalizeDenominationValue(value);
        return this.denominations().some((d) => (
            d.id !== ignoreId &&
            this.normalizeDenominationValue(Number(d.value)) === normalized
        ));
    }

    private sortDenominations(list: Denomination[]): Denomination[] {
        return [...list].sort((a, b) => Number(a.value) - Number(b.value));
    }

    private syncDenominationSnapshot() {
        this.denominationSnapshot = {};
        for (const d of this.denominations()) {
            this.denominationSnapshot[d.id] = this.normalizeDenominationValue(Number(d.value));
        }
    }

    private areDenominationsValid(): boolean {
        const values = this.denominations().map((d) => this.normalizeDenominationValue(Number(d.value)));

        if (values.some((v) => v <= 0)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'Todas las denominaciones deben ser mayores a 0'
            });
            return false;
        }

        if (new Set(values).size !== values.length) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'No puede haber denominaciones repetidas'
            });
            return false;
        }

        return true;
    }
}
