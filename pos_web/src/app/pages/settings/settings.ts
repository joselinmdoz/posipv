import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { ExchangeRateRecord, SettingsService, SystemCurrencyCode, SystemSettings } from '@/app/core/services/settings.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, InputNumberModule, SelectModule, ToastModule, CardModule, ToggleSwitchModule],
    providers: [MessageService],
    template: `
        <div class="p-4 settings-page">
            <h1 class="text-2xl font-bold mb-1">Configuración General del Sistema</h1>
            <p class="text-gray-500 mb-4">Define la moneda por defecto, monedas habilitadas y la tasa de cambio operativa.</p>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <p-card header="Moneda y Tasa de Cambio">
                    <div class="flex flex-col gap-4">
                        <div>
                            <label class="block mb-2 font-medium">Moneda por defecto</label>
                            <p-select
                                [options]="currencyOptions"
                                [(ngModel)]="defaultCurrency"
                                (ngModelChange)="enforceDefaultCurrencyEnabled()"
                                class="w-full"
                            />
                        </div>

                        <div>
                            <label class="block mb-2 font-medium">Monedas habilitadas</label>
                            <div class="flex flex-col gap-2">
                                <div class="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <div class="font-semibold">CUP</div>
                                        <div class="text-sm text-gray-500">Peso cubano</div>
                                    </div>
                                    <p-toggleswitch [(ngModel)]="enabledCUP" (onChange)="onCurrenciesToggle()" />
                                </div>
                                <div class="flex items-center justify-between p-3 border rounded-lg">
                                    <div>
                                        <div class="font-semibold">USD</div>
                                        <div class="text-sm text-gray-500">Dólar estadounidense</div>
                                    </div>
                                    <p-toggleswitch [(ngModel)]="enabledUSD" (onChange)="onCurrenciesToggle()" />
                                </div>
                            </div>
                            @if (currencyValidationMessage()) {
                                <small class="text-red-500 block mt-2">{{ currencyValidationMessage() }}</small>
                            }
                        </div>

                        <div>
                            <label class="block mb-2 font-medium">Tasa de cambio USD → CUP</label>
                            <p-inputnumber
                                [(ngModel)]="exchangeRateUsdToCup"
                                [min]="0.000001"
                                [minFractionDigits]="2"
                                [maxFractionDigits]="6"
                                mode="decimal"
                                inputStyleClass="w-full"
                                class="w-full"
                            />
                            <small class="text-gray-500 block mt-2">1 USD = {{ exchangeRateUsdToCup || 0 }} CUP</small>
                        </div>
                    </div>
                </p-card>

                <p-card header="Vista Operativa">
                    <div class="flex flex-col gap-4 text-sm">
                        <div class="p-3 border rounded-lg bg-surface-50">
                            <div class="font-semibold mb-1">Resumen actual</div>
                            <div>Moneda por defecto: <b>{{ defaultCurrency }}</b></div>
                            <div>Monedas habilitadas: <b>{{ enabledCurrenciesPreview() }}</b></div>
                            <div>Tasa activa: <b>1 USD = {{ exchangeRateUsdToCup || 0 }} CUP</b></div>
                        </div>

                        <div class="p-3 border rounded-lg">
                            <div class="font-semibold mb-2">Recomendación de operación</div>
                            <p class="m-0 text-gray-600">
                                Define <b>CUP</b> como moneda por defecto para operaciones locales y mantiene <b>USD</b> habilitada para ventas mixtas.
                                Actualiza esta tasa al inicio de la jornada o cuando cambie oficialmente.
                            </p>
                        </div>

                        <div class="p-3 border rounded-lg">
                            <div class="font-semibold mb-2">Historial de tasas (USD → CUP)</div>
                            <div class="overflow-auto">
                                <table class="w-full text-sm">
                                    <thead>
                                        <tr>
                                            <th class="text-left py-1">Fecha</th>
                                            <th class="text-right py-1">Tasa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @for (row of exchangeRateHistory(); track row.id) {
                                            <tr>
                                                <td class="py-1">{{ formatDateTime(row.createdAt) }}</td>
                                                <td class="py-1 text-right">{{ row.rate }}</td>
                                            </tr>
                                        }
                                        @if (!exchangeRateHistory().length) {
                                            <tr>
                                                <td colspan="2" class="py-1 text-center text-gray-500">Sin historial registrado.</td>
                                            </tr>
                                        }
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </p-card>
            </div>

            <div class="mt-4 flex gap-2">
                <p-button label="Guardar Configuración" icon="pi pi-save" (onClick)="saveSettings()" [disabled]="hasValidationErrors()" />
                <p-button label="Recargar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadSystemSettings()" />
            </div>
        </div>

        <p-toast />
    `
})
export class Settings implements OnInit {
    readonly currencyOptions = [
        { label: 'CUP - Peso cubano', value: 'CUP' as SystemCurrencyCode },
        { label: 'USD - Dólar estadounidense', value: 'USD' as SystemCurrencyCode }
    ];

    defaultCurrency: SystemCurrencyCode = 'CUP';
    enabledCUP = true;
    enabledUSD = true;
    exchangeRateUsdToCup = 1;
    exchangeRateHistory = signal<ExchangeRateRecord[]>([]);

    currencyValidationMessage = signal('');

    constructor(
        private settingsService: SettingsService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadSystemSettings();
    }

    loadSystemSettings() {
        this.settingsService.getSystemSettings().subscribe({
            next: (settings) => {
                this.applySystemSettings(settings);
                this.loadExchangeRateHistory();
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar la configuración del sistema'
                });
            }
        });
    }

    saveSettings() {
        if (this.hasValidationErrors()) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: this.currencyValidationMessage() || 'Revise los datos antes de guardar.'
            });
            return;
        }

        this.settingsService
            .saveSystemSettings({
                defaultCurrency: this.defaultCurrency,
                enabledCurrencies: this.getEnabledCurrencies(),
                exchangeRateUsdToCup: Number(this.exchangeRateUsdToCup || 0)
            })
            .subscribe({
                next: (saved) => {
                    this.applySystemSettings(saved);
                    this.loadExchangeRateHistory();
                    this.messageService.add({
                        severity: 'success',
                        summary: 'Éxito',
                        detail: 'Configuración general actualizada'
                    });
                },
                error: (error) => {
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: error?.error?.message || 'No se pudo guardar la configuración'
                    });
                }
            });
    }

    onCurrenciesToggle() {
        this.validateCurrencies();
        this.enforceDefaultCurrencyEnabled();
    }

    enforceDefaultCurrencyEnabled() {
        if (this.defaultCurrency === 'CUP') {
            this.enabledCUP = true;
        }
        if (this.defaultCurrency === 'USD') {
            this.enabledUSD = true;
        }
        this.validateCurrencies();
    }

    hasValidationErrors() {
        if (!this.exchangeRateUsdToCup || Number(this.exchangeRateUsdToCup) <= 0) {
            return true;
        }
        return !!this.currencyValidationMessage();
    }

    enabledCurrenciesPreview() {
        return this.getEnabledCurrencies().join(', ');
    }

    private applySystemSettings(settings: SystemSettings) {
        this.defaultCurrency = settings.defaultCurrency || 'CUP';
        const enabled = settings.enabledCurrencies || ['CUP', 'USD'];
        this.enabledCUP = enabled.includes('CUP');
        this.enabledUSD = enabled.includes('USD');
        this.exchangeRateUsdToCup = Number(settings.exchangeRateUsdToCup || 1);
        this.validateCurrencies();
        this.enforceDefaultCurrencyEnabled();
    }

    private getEnabledCurrencies(): SystemCurrencyCode[] {
        const list: SystemCurrencyCode[] = [];
        if (this.enabledCUP) list.push('CUP');
        if (this.enabledUSD) list.push('USD');
        return list;
    }

    private validateCurrencies() {
        const enabled = this.getEnabledCurrencies();

        if (enabled.length === 0) {
            this.currencyValidationMessage.set('Debe habilitar al menos una moneda.');
            return;
        }

        if (!enabled.includes(this.defaultCurrency)) {
            this.currencyValidationMessage.set('La moneda por defecto debe estar habilitada.');
            return;
        }

        this.currencyValidationMessage.set('');
    }

    private loadExchangeRateHistory() {
        this.settingsService.listExchangeRates(10).subscribe({
            next: (rows) => {
                this.exchangeRateHistory.set(rows || []);
            },
            error: () => {
                this.exchangeRateHistory.set([]);
            }
        });
    }

    formatDateTime(value: string | Date | null | undefined): string {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        const formatter = new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        return formatter.format(date);
    }
}
