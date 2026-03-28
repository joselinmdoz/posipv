import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { SettingsService } from '@/app/core/services/settings.service';

type PaymentMethodRow = {
    id: string;
    code: string;
    name: string;
    enabled: boolean;
    requiresTransactionCode: boolean;
    custom: boolean;
};

type DefaultPaymentMethod = {
    code: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
    name: string;
    enabled: boolean;
};

@Component({
    selector: 'app-payment-methods',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, ToastModule, ToolbarModule, InputTextModule, TagModule, ToggleSwitchModule],
    providers: [MessageService],
    template: `
        <div class="p-4">
            <h1 class="text-2xl font-bold mb-1">Gestión de Métodos de Pago</h1>
            <p class="text-gray-500 mb-4">
                Define los métodos disponibles para ventas y TPV.
            </p>

            <p-toolbar styleClass="mb-4">
                <ng-template #start>
                    <p-button label="Restaurar por defecto" icon="pi pi-history" severity="secondary" class="mr-2" (onClick)="restoreDefaults()" />
                    <p-button label="Guardar" icon="pi pi-save" (onClick)="save()" />
                </ng-template>
                <ng-template #end>
                    <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadData()" [loading]="loading()" />
                </ng-template>
            </p-toolbar>

            <div class="card">
                <p-table
                    [value]="methods()"
                    [loading]="loading()"
                    dataKey="code"
                    responsiveLayout="scroll"
                    [tableStyle]="{ 'min-width': '44rem' }"
                >
                    <ng-template #header>
                        <tr>
                            <th style="width: 20%">Código</th>
                            <th style="width: 30%">Nombre</th>
                            <th style="width: 16%">Habilitado</th>
                            <th style="width: 18%">Solicitar código</th>
                            <th style="width: 16%">Uso</th>
                        </tr>
                    </ng-template>
                    <ng-template #body let-row>
                        <tr>
                            <td>
                                <div class="flex items-center gap-2">
                                    <code>{{ row.code }}</code>
                                    @if (row.custom) {
                                        <p-tag value="Personalizado" severity="warn" />
                                    }
                                </div>
                            </td>
                            <td>
                                <input
                                    pInputText
                                    [(ngModel)]="row.name"
                                    class="w-full"
                                    maxlength="60"
                                    placeholder="Nombre visible"
                                    (blur)="normalizeRowName(row)"
                                />
                            </td>
                            <td>
                                <p-toggleswitch [(ngModel)]="row.enabled" />
                            </td>
                            <td>
                                <p-toggleswitch [(ngModel)]="row.requiresTransactionCode" [disabled]="!row.enabled" />
                            </td>
                            <td class="text-sm text-gray-500">
                                {{ methodDescription(row.code) }}
                            </td>
                        </tr>
                    </ng-template>
                    <ng-template #emptymessage>
                        <tr>
                            <td colspan="5" class="text-center py-4">No hay métodos de pago configurados.</td>
                        </tr>
                    </ng-template>
                </p-table>
            </div>
        </div>

        <p-toast />
    `
})
export class PaymentMethods implements OnInit {
    loading = signal(false);
    methods = signal<PaymentMethodRow[]>([]);

    private readonly defaultMethods: DefaultPaymentMethod[] = [
        { code: 'CASH', name: 'Efectivo', enabled: true },
        { code: 'CARD', name: 'Tarjeta', enabled: true },
        { code: 'TRANSFER', name: 'Transferencia', enabled: true },
        { code: 'OTHER', name: 'Otro', enabled: false }
    ];

    private readonly methodDescriptionMap: Record<string, string> = {
        CASH: 'Pago en efectivo',
        CARD: 'Pago por tarjeta',
        TRANSFER: 'Pago por transferencia',
        OTHER: 'Otro método'
    };

    constructor(
        private settingsService: SettingsService,
        private messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadData();
    }

    loadData() {
        this.loading.set(true);
        this.settingsService.listPaymentMethods().subscribe({
            next: (rows) => {
                const normalizedRows = (rows || [])
                    .map((row) => ({
                        id: String(row.id || ''),
                        code: this.normalizeCode(row.code),
                        name: String(row.name || '').trim(),
                        enabled: !!row.enabled,
                        requiresTransactionCode: row.requiresTransactionCode === true
                    }))
                    .filter((row) => !!row.code);

                const byCode = new Map(normalizedRows.map((row) => [row.code, row]));
                const knownCodes = new Set<string>(this.defaultMethods.map((method) => method.code));

                const knownRows: PaymentMethodRow[] = this.defaultMethods.map((method) => {
                    const existing = byCode.get(method.code);
                    return {
                        id: existing?.id || '',
                        code: method.code,
                        name: existing?.name || method.name,
                        enabled: existing?.enabled ?? method.enabled,
                        requiresTransactionCode: existing?.requiresTransactionCode === true,
                        custom: false
                    };
                });

                const customRows: PaymentMethodRow[] = normalizedRows
                    .filter((row) => !knownCodes.has(row.code))
                    .map((row) => ({
                        id: row.id,
                        code: row.code,
                        name: row.name || row.code,
                        enabled: row.enabled,
                        requiresTransactionCode: row.requiresTransactionCode === true,
                        custom: true
                    }))
                    .sort((a, b) => a.code.localeCompare(b.code));

                this.methods.set([...knownRows, ...customRows]);
                this.loading.set(false);
            },
            error: () => {
                this.loading.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar los métodos de pago'
                });
            }
        });
    }

    restoreDefaults() {
        this.methods.set(
            this.defaultMethods.map((method) => ({
                id: '',
                code: method.code,
                name: method.name,
                enabled: method.enabled,
                requiresTransactionCode: false,
                custom: false
            }))
        );
        this.messageService.add({
            severity: 'info',
            summary: 'Restaurado',
            detail: 'Se restauraron los métodos de pago por defecto. Guarda para aplicar.'
        });
    }

    normalizeRowName(row: PaymentMethodRow) {
        row.name = String(row.name || '').trim();
    }

    save() {
        const payload = this.methods()
            .map((row) => ({
                code: this.normalizeCode(row.code),
                name: String(row.name || '').trim(),
                enabled: !!row.enabled,
                requiresTransactionCode: !!row.requiresTransactionCode
            }))
            .filter((row) => !!row.code);

        if (!payload.length) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Debe existir al menos un método de pago.'
            });
            return;
        }

        if (payload.some((row) => !row.name)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Todos los métodos deben tener nombre.'
            });
            return;
        }

        const uniqueCodes = new Set(payload.map((row) => row.code));
        if (uniqueCodes.size !== payload.length) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Hay códigos de método de pago duplicados.'
            });
            return;
        }

        if (!payload.some((row) => row.enabled)) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Validación',
                detail: 'Debes habilitar al menos un método de pago.'
            });
            return;
        }

        this.loading.set(true);
        this.settingsService.savePaymentMethods(payload).subscribe({
            next: () => {
                this.loading.set(false);
                this.messageService.add({
                    severity: 'success',
                    summary: 'Éxito',
                    detail: 'Métodos de pago guardados correctamente.'
                });
                this.loadData();
            },
            error: (error) => {
                this.loading.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: error?.error?.message || 'No se pudieron guardar los métodos de pago'
                });
            }
        });
    }

    methodDescription(code: string): string {
        return this.methodDescriptionMap[this.normalizeCode(code)] || 'Método personalizado';
    }

    private normalizeCode(code: string): string {
        return String(code || '').trim().toUpperCase();
    }
}
