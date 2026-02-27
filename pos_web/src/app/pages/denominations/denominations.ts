import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { SettingsService, Denomination, SystemCurrencyCode } from '@/app/core/services/settings.service';
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

            <div class="mb-4 flex flex-wrap gap-3 items-end">
                <div>
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
                    <div>
                        <label class="block mb-2 font-medium">Moneda</label>
                        <p-select
                            [options]="currencyOptions"
                            [(ngModel)]="selectedCurrency"
                            placeholder="Seleccionar moneda"
                            styleClass="w-48"
                        />
                    </div>
                }
            </div>

            @if (selectedRegisterId) {
                <p-card header="Denominaciones de monedas y billetes">
                    <div class="mb-3 text-sm text-gray-600">
                        Administrando denominaciones de: <strong>{{ selectedCurrency }}</strong>
                    </div>

                    <p-table [value]="visibleDenominations()" [rows]="10">
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
                                        [currency]="selectedCurrency"
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
                                <td colspan="3" class="text-center">
                                    No hay denominaciones configuradas para {{ selectedCurrency }}.
                                </td>
                            </tr>
                        </ng-template>
                    </p-table>

                    <div class="mt-4 flex flex-wrap gap-2 items-center">
                        <p-inputnumber
                            [(ngModel)]="newDenomination"
                            mode="currency"
                            [currency]="selectedCurrency"
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
    registerOptions: Array<{ label: string; value: string }> = [];
    selectedRegisterId = '';
    selectedCurrency: SystemCurrencyCode = 'CUP';

    denominations = signal<Denomination[]>([]);

    currencyOptions: Array<{ label: string; value: SystemCurrencyCode }> = [
        { label: 'CUP', value: 'CUP' },
        { label: 'USD', value: 'USD' }
    ];

    newDenomination = 0;
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
        this.posService.listRegisters().subscribe({
            next: (registers) => {
                this.registerOptions = registers.map((r) => ({
                    label: r.name,
                    value: r.id
                }));
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

    loadDenominations() {
        if (!this.selectedRegisterId) return;

        forkJoin({
            system: this.settingsService.getSystemSettings(),
            register: this.settingsService.getRegisterSettings(this.selectedRegisterId)
        }).subscribe({
            next: ({ system, register }) => {
                const enabled = Array.isArray(system.enabledCurrencies) && system.enabledCurrencies.length
                    ? system.enabledCurrencies
                    : (['CUP', 'USD'] as SystemCurrencyCode[]);

                this.currencyOptions = enabled.map((currency) => ({ label: currency, value: currency }));

                const registerCurrency = this.normalizeCurrency(register.currency, enabled[0] || 'CUP');
                if (!enabled.includes(this.selectedCurrency)) {
                    this.selectedCurrency = registerCurrency;
                }

                const normalized = (register.denominations || []).map((d) => ({
                    ...d,
                    value: this.normalizeDenominationValue(Number(d.value)),
                    currency: this.normalizeCurrency(d.currency, registerCurrency)
                }));

                this.denominations.set(this.sortDenominations(normalized));
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

        if (this.hasDenominationValue(value, this.selectedCurrency)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: `La denominación ya existe para ${this.selectedCurrency}`
            });
            return;
        }

        this.denominations.set(
            this.sortDenominations([
                ...this.denominations(),
                {
                    id: `temp-${Date.now()}`,
                    value,
                    enabled: true,
                    currency: this.selectedCurrency
                }
            ])
        );

        this.syncDenominationSnapshot();
        this.newDenomination = 0;
    }

    visibleDenominations(): Denomination[] {
        return this.sortCurrencyDenominations(
            this.denominations().filter((d) => this.normalizeCurrency(d.currency, this.selectedCurrency) === this.selectedCurrency)
        );
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
        const currency = this.normalizeCurrency(denom.currency, this.selectedCurrency);

        if (nextValue <= 0) {
            denom.value = previousValue;
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'La denominación debe ser mayor a 0'
            });
            return;
        }

        if (this.hasDenominationValue(nextValue, currency, denom.id)) {
            denom.value = previousValue;
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: `Ya existe una denominación con ese valor para ${currency}`
            });
            return;
        }

        denom.value = nextValue;
        denom.currency = currency;
        this.denominations.set(this.sortDenominations([...this.denominations()]));
        this.syncDenominationSnapshot();
    }

    saveDenominations() {
        if (!this.selectedRegisterId) return;
        if (!this.areDenominationsValid()) return;

        const payload = this.sortDenominations(this.denominations()).map((d) => ({
            value: this.normalizeDenominationValue(Number(d.value)),
            enabled: d.enabled,
            currency: this.normalizeCurrency(d.currency, this.selectedCurrency)
        }));

        this.settingsService
            .saveRegisterSettings(this.selectedRegisterId, {
                denominations: payload
            })
            .subscribe({
                next: (settings) => {
                    const registerCurrency = this.normalizeCurrency(settings.currency, this.selectedCurrency);
                    const normalized = (settings.denominations || []).map((d) => ({
                        ...d,
                        value: this.normalizeDenominationValue(Number(d.value)),
                        currency: this.normalizeCurrency(d.currency, registerCurrency)
                    }));

                    this.denominations.set(this.sortDenominations(normalized));
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

    private normalizeCurrency(currency: string | undefined, fallback: SystemCurrencyCode): SystemCurrencyCode {
        const code = (currency || '').trim().toUpperCase();
        if (code === 'CUP' || code === 'USD') {
            return code;
        }
        return fallback;
    }

    private hasDenominationValue(value: number, currency: SystemCurrencyCode, ignoreId?: string): boolean {
        const normalizedValue = this.normalizeDenominationValue(value);
        return this.denominations().some((d) => (
            d.id !== ignoreId &&
            this.normalizeCurrency(d.currency, currency) === currency &&
            this.normalizeDenominationValue(Number(d.value)) === normalizedValue
        ));
    }

    private sortCurrencyDenominations(list: Denomination[]): Denomination[] {
        return [...list].sort((a, b) => Number(a.value) - Number(b.value));
    }

    private sortDenominations(list: Denomination[]): Denomination[] {
        return [...list].sort((a, b) => {
            const leftCurrency = this.normalizeCurrency(a.currency, this.selectedCurrency);
            const rightCurrency = this.normalizeCurrency(b.currency, this.selectedCurrency);
            if (leftCurrency === rightCurrency) {
                return Number(a.value) - Number(b.value);
            }
            return leftCurrency.localeCompare(rightCurrency);
        });
    }

    private syncDenominationSnapshot() {
        this.denominationSnapshot = {};
        for (const d of this.denominations()) {
            this.denominationSnapshot[d.id] = this.normalizeDenominationValue(Number(d.value));
        }
    }

    private areDenominationsValid(): boolean {
        const grouped = new Map<SystemCurrencyCode, number[]>();

        for (const denomination of this.denominations()) {
            const currency = this.normalizeCurrency(denomination.currency, this.selectedCurrency);
            const value = this.normalizeDenominationValue(Number(denomination.value));

            if (value <= 0) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Advertencia',
                    detail: 'Todas las denominaciones deben ser mayores a 0'
                });
                return false;
            }

            const values = grouped.get(currency) || [];
            values.push(value);
            grouped.set(currency, values);
        }

        for (const [currency, values] of grouped.entries()) {
            if (new Set(values).size !== values.length) {
                this.messageService.add({
                    severity: 'warn',
                    summary: 'Advertencia',
                    detail: `No puede haber denominaciones repetidas para ${currency}`
                });
                return false;
            }
        }

        return true;
    }
}
