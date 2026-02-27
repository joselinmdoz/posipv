import { Component, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToolbarModule } from 'primeng/toolbar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { RegistersService, Register, CreateRegisterDto, UpdateRegisterDto } from '@/app/core/services/registers.service';
import { PosService, CashSession } from '@/app/core/services/pos.service';
import { SettingsService, PaymentMethodSetting } from '@/app/core/services/settings.service';

interface RegisterCard extends Register {
    openSession: CashSession | null;
}

@Component({
    selector: 'app-tpv-management',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        CardModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        SelectModule,
        TagModule,
        ToastModule,
        ToggleSwitchModule,
        ToolbarModule,
        ConfirmDialogModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo TPV" icon="pi pi-plus" severity="secondary" class="mr-2" (onClick)="openNew()" />
                <p-button label="Actualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" (onClick)="loadRegisters()" />
            </ng-template>
        </p-toolbar>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            @for (tpv of registerCards(); track tpv.id) {
                <p-card styleClass="h-full">
                    <ng-template #title>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-xl font-semibold">{{ tpv.name }}</span>
                            <p-tag [value]="tpv.active ? 'Activo' : 'Inactivo'" [severity]="tpv.active ? 'success' : 'warn'" />
                        </div>
                    </ng-template>

                    <div class="flex flex-col gap-3 text-sm">
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500">Sesion</span>
                            <p-tag
                                [value]="tpv.openSession ? 'Abierta' : 'Cerrada'"
                                [severity]="tpv.openSession ? 'success' : 'warn'"
                            />
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500">Creado</span>
                            <strong>{{ tpv.createdAt | date:'dd/MM/yyyy HH:mm' }}</strong>
                        </div>
                        @if (tpv.openSession) {
                            <div class="flex items-center justify-between">
                                <span class="text-gray-500">Caja abierta</span>
                                <strong>{{ tpv.openSession.openedAt | date:'dd/MM/yyyy HH:mm' }}</strong>
                            </div>
                        }
                    </div>

                    <ng-template #footer>
                        <div class="flex flex-wrap gap-2 justify-content-end">
                            <p-button
                                [label]="tpv.openSession ? 'Continuar sesion' : 'Abrir sesion'"
                                icon="pi pi-shopping-cart"
                                [loading]="openingRegisterId() === tpv.id"
                                (onClick)="goToSales(tpv)"
                            />
                            <p-button label="Configurar" icon="pi pi-cog" severity="secondary" [outlined]="true" (onClick)="openSettings(tpv)" />
                            <p-button icon="pi pi-pencil" severity="success" [outlined]="true" (onClick)="editRegister(tpv)" />
                            <p-button icon="pi pi-trash" severity="danger" [outlined]="true" (onClick)="deleteRegister(tpv)" />
                        </div>
                    </ng-template>
                </p-card>
            }
        </div>

        @if (registerCards().length === 0) {
            <div class="text-center py-8 text-gray-500">
                <i class="pi pi-shop text-4xl mb-2"></i>
                <p>No hay TPV registrados.</p>
            </div>
        }

        <p-dialog
            header="{{ isEditMode() ? 'Editar' : 'Nuevo' }} TPV"
            [(visible)]="tpvDialog"
            [modal]="true"
            [style]="{ width: '450px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="name">Nombre del TPV *</label>
                    <input pInputText id="name" [(ngModel)]="tpv.name" required autofocus />
                </div>
                <div class="flex flex-col gap-2">
                    <label for="code">Codigo (opcional)</label>
                    <input pInputText id="code" [(ngModel)]="tpv.code" placeholder="Se autogenera si se omite" />
                </div>
            </div>

            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveRegister()" />
            </ng-template>
        </p-dialog>

        <p-dialog
            header="Configuracion TPV"
            [visible]="settingsDialog"
            (visibleChange)="onSettingsDialogVisibleChange($event)"
            [modal]="true"
            [style]="{ width: '560px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="text-sm text-gray-600">
                    TPV: <strong>{{ selectedRegisterForSettings?.name }}</strong>
                </div>

                <div class="flex flex-col gap-2">
                    <label>Fondo de caja por defecto</label>
                    <p-inputnumber [(ngModel)]="settingsForm.defaultOpeningFloat" mode="currency" [currency]="settingsForm.currency" locale="en-US" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label>Moneda</label>
                    <p-select [options]="currencyOptions" [(ngModel)]="settingsForm.currency" class="w-full" />
                </div>

                <div class="flex flex-col gap-2">
                    <label>Metodos de pago</label>
                    <div class="flex flex-col gap-2">
                        @for (method of settingsForm.paymentMethods; track method.code) {
                            <div class="flex items-center justify-between p-2 border rounded">
                                <span>{{ method.name }}</span>
                                <p-toggleswitch [(ngModel)]="method.enabled" />
                            </div>
                        }
                    </div>
                </div>

                <div class="text-sm text-gray-600">
                    Las denominaciones se gestionan en la vista de <strong>Denominaciones</strong>.
                </div>
            </div>

            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideSettingsDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveSettings()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class TpvManagement implements OnInit {
    registerCards = signal<RegisterCard[]>([]);
    isEditMode = signal<boolean>(false);
    openingRegisterId = signal<string | null>(null);

    tpvDialog = false;
    settingsDialog = false;

    selectedRegister: Register | null = null;
    selectedRegisterForSettings: Register | null = null;

    tpv: { name: string; code?: string } = {
        name: '',
        code: ''
    };

    settingsForm: {
        defaultOpeningFloat: number;
        currency: string;
        paymentMethods: PaymentMethodSetting[];
    } = {
        defaultOpeningFloat: 0,
        currency: 'CUP',
        paymentMethods: []
    };

    currencyOptions = [
        { label: 'CUP - Peso cubano', value: 'CUP' },
        { label: 'USD - Dolar estadounidense', value: 'USD' }
    ];

    private readonly paymentMethodCatalog: PaymentMethodSetting[] = [
        { id: 'cash', code: 'CASH', name: 'Efectivo', enabled: true },
        { id: 'card', code: 'CARD', name: 'Tarjeta', enabled: true },
        { id: 'transfer', code: 'TRANSFER', name: 'Transferencia', enabled: true },
        { id: 'other', code: 'OTHER', name: 'Otro', enabled: false }
    ];

    constructor(
        private registersService: RegistersService,
        private posService: PosService,
        private settingsService: SettingsService,
        private router: Router,
        private messageService: MessageService,
        private confirmationService: ConfirmationService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        this.loadRegisters();
    }

    loadRegisters() {
        this.registersService.list().subscribe({
            next: (registers) => {
                if (registers.length === 0) {
                    this.registerCards.set([]);
                    return;
                }

                const openSessionCalls = registers.map((r) =>
                    this.posService.getOpenSession(r.id).pipe(catchError(() => of(null)))
                );

                forkJoin(openSessionCalls).subscribe({
                    next: (sessions) => {
                        const cards = registers.map((register, index) => ({
                            ...register,
                            openSession: sessions[index]
                        }));
                        this.registerCards.set(cards);
                    },
                    error: () => {
                        const cards = registers.map((register) => ({
                            ...register,
                            openSession: null
                        }));
                        this.registerCards.set(cards);
                    }
                });
            },
            error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar TPV' })
        });
    }

    goToSales(register: RegisterCard) {
        if (!register.active) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'El TPV esta inactivo' });
            return;
        }

        if (register.openSession) {
            this.router.navigate(['/tpv'], {
                queryParams: {
                    registerId: register.id,
                    action: 'continue'
                }
            });
            return;
        }

        this.openingRegisterId.set(register.id);
        this.settingsService.getRegisterSettings(register.id).pipe(
            catchError(() => of(null)),
            switchMap((settings) => this.posService.openSession(register.id, Number(settings?.defaultOpeningFloat || 0)))
        ).subscribe({
            next: () => {
                this.openingRegisterId.set(null);
                this.router.navigate(['/tpv'], {
                    queryParams: {
                        registerId: register.id,
                        action: 'continue'
                    }
                });
            },
            error: (err) => {
                this.openingRegisterId.set(null);
                const detail = err?.error?.message || 'No se pudo abrir la sesion del TPV';
                const alreadyOpen = String(detail).toLowerCase().includes('sesión abierta') || String(detail).toLowerCase().includes('sesion abierta');

                if (alreadyOpen) {
                    this.router.navigate(['/tpv'], {
                        queryParams: {
                            registerId: register.id,
                            action: 'continue'
                        }
                    });
                    return;
                }

                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail
                });
            }
        });
    }

    openNew() {
        this.tpv = { name: '', code: '' };
        this.selectedRegister = null;
        this.isEditMode.set(false);
        this.tpvDialog = true;
    }

    editRegister(register: Register) {
        this.selectedRegister = register;
        this.tpv = {
            name: register.name,
            code: register.code
        };
        this.isEditMode.set(true);
        this.tpvDialog = true;
    }

    hideDialog() {
        this.tpvDialog = false;
        this.selectedRegister = null;
    }

    saveRegister() {
        if (!this.tpv.name || this.tpv.name.trim().length < 2) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Advertencia',
                detail: 'El nombre del TPV es requerido (minimo 2 caracteres)'
            });
            return;
        }

        const payload = {
            name: this.tpv.name.trim(),
            code: this.tpv.code?.trim() || undefined
        };

        const saveObs = this.isEditMode() && this.selectedRegister
            ? this.registersService.update(this.selectedRegister.id, payload as UpdateRegisterDto)
            : this.registersService.create(payload as CreateRegisterDto);

        saveObs.subscribe({
            next: () => {
                this.loadRegisters();
                this.hideDialog();
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exito',
                    detail: this.isEditMode()
                        ? 'TPV actualizado'
                        : 'TPV creado. Almacen asociado creado automaticamente'
                });
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo guardar el TPV'
                });
            }
        });
    }

    deleteRegister(register: Register) {
        this.confirmationService.confirm({
            message: `¿Eliminar el TPV ${register.name}? Esta accion tambien eliminara su almacen asociado.`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.registersService.delete(register.id).subscribe({
                    next: () => {
                        this.loadRegisters();
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Exito',
                            detail: 'TPV eliminado'
                        });
                    },
                    error: (err) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: err?.error?.message || 'No se pudo eliminar el TPV'
                        });
                    }
                });
            }
        });
    }

    openSettings(register: Register) {
        this.selectedRegisterForSettings = register;
        this.settingsDialog = false;
        this.settingsForm = {
            defaultOpeningFloat: 0,
            currency: 'CUP',
            paymentMethods: this.paymentMethodCatalog.map((pm) => ({ ...pm }))
        };

        this.settingsService.getRegisterSettings(register.id).subscribe({
            next: (settings) => {
                const enabledCodes = new Set((settings.paymentMethods || []).filter((m) => m.enabled).map((m) => m.code));
                this.settingsForm = {
                    defaultOpeningFloat: Number(settings.defaultOpeningFloat || 0),
                    currency: this.normalizeCurrency(settings.currency),
                    paymentMethods: this.paymentMethodCatalog.map((pm) => ({
                        ...pm,
                        enabled: enabledCodes.size > 0 ? enabledCodes.has(pm.code) : pm.enabled
                    }))
                };
                this.openSettingsDialogSafely();
            },
            error: () => {
                this.settingsForm = {
                    defaultOpeningFloat: 0,
                    currency: 'CUP',
                    paymentMethods: this.paymentMethodCatalog.map((pm) => ({ ...pm }))
                };
                this.openSettingsDialogSafely();
            }
        });
    }

    hideSettingsDialog() {
        this.settingsDialog = false;
        this.selectedRegisterForSettings = null;
    }

    saveSettings() {
        if (!this.selectedRegisterForSettings) return;

        this.settingsService.saveRegisterSettings(this.selectedRegisterForSettings.id, {
            defaultOpeningFloat: Number(this.settingsForm.defaultOpeningFloat || 0),
            currency: this.settingsForm.currency,
            paymentMethods: this.settingsForm.paymentMethods.filter((m) => m.enabled).map((m) => m.code)
        }).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Exito',
                    detail: 'Configuracion guardada'
                });
                this.hideSettingsDialog();
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo guardar la configuracion'
                });
            }
        });
    }

    private normalizeCurrency(value?: string | null): string {
        const normalized = (value || '').toString().trim().toUpperCase();
        return normalized === 'USD' ? 'USD' : 'CUP';
    }

    private openSettingsDialogSafely() {
        setTimeout(() => {
            this.settingsDialog = true;
            this.cdr.detectChanges();
        }, 0);
    }

    onSettingsDialogVisibleChange(visible: boolean) {
        if (!visible) {
            this.hideSettingsDialog();
        }
    }
}
