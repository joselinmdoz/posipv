import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Customer, CustomerHistory, CustomersService } from '@/app/core/services/customers.service';

type CustomerForm = {
    name: string;
    identification: string;
    phone: string;
    email: string;
    address: string;
    active: boolean;
};

@Component({
    selector: 'app-customers',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, ConfirmDialogModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, ToastModule, ToolbarModule],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo cliente" icon="pi pi-plus" severity="secondary" (onClick)="openNew()" />
            </ng-template>
        </p-toolbar>

        <div class="grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto] gap-3 items-end mb-4">
            <div>
                <label class="block mb-2">Buscar cliente</label>
                <input pInputText [(ngModel)]="searchTerm" (keydown.enter)="loadCustomers()" class="w-full" placeholder="Nombre, identificación, teléfono o email" />
            </div>
            <div>
                <label class="block mb-2">Estado</label>
                <p-select [options]="statusFilterOptions" [(ngModel)]="activeFilter" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <p-button label="Buscar" icon="pi pi-search" [loading]="loading()" (onClick)="loadCustomers()" />
            <p-button label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" [disabled]="loading()" (onClick)="clearFilters()" />
        </div>

        <p-table [value]="customers()" [loading]="loading()" [rows]="10" [paginator]="true" dataKey="id">
            <ng-template #header>
                <tr>
                    <th>Nombre</th>
                    <th>Identificación</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th class="text-right">Compras</th>
                    <th class="text-right">Total</th>
                    <th>Última compra</th>
                    <th>Estado</th>
                    <th class="text-center">Acciones</th>
                </tr>
            </ng-template>
            <ng-template #body let-customer>
                <tr>
                    <td>{{ customer.name }}</td>
                    <td>{{ customer.identification }}</td>
                    <td>{{ customer.phone || '-' }}</td>
                    <td>{{ customer.email || '-' }}</td>
                    <td class="text-right">{{ customer.purchasesCount || 0 }}</td>
                    <td class="text-right">{{ customer.totalAmount | currency:'CUP' }}</td>
                    <td>{{ formatDateTime(customer.lastPurchaseAt) }}</td>
                    <td>
                        <p-tag [value]="customer.active ? 'Activo' : 'Inactivo'" [severity]="customer.active ? 'success' : 'warn'" />
                    </td>
                    <td class="text-center">
                        <div class="flex justify-center gap-1">
                            <p-button icon="pi pi-chart-line" [rounded]="true" [text]="true" severity="secondary" (onClick)="openHistory(customer)" />
                            <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="success" (onClick)="editCustomer(customer)" />
                            <p-button
                                [icon]="customer.active ? 'pi pi-ban' : 'pi pi-check'"
                                [rounded]="true"
                                [text]="true"
                                [severity]="customer.active ? 'danger' : 'help'"
                                (onClick)="toggleActive(customer)"
                            />
                        </div>
                    </td>
                </tr>
            </ng-template>
            <ng-template #emptymessage>
                <tr>
                    <td colspan="9" class="text-center">No hay clientes para mostrar.</td>
                </tr>
            </ng-template>
        </p-table>

        <p-dialog
            header="{{ editMode() ? 'Editar cliente' : 'Nuevo cliente' }}"
            [(visible)]="customerDialog"
            [modal]="true"
            [style]="{ width: '560px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div class="md:col-span-2">
                    <label class="block mb-2">Nombre *</label>
                    <input pInputText [(ngModel)]="form.name" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Identificación *</label>
                    <input pInputText [(ngModel)]="form.identification" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Teléfono</label>
                    <input pInputText [(ngModel)]="form.phone" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Email</label>
                    <input pInputText [(ngModel)]="form.email" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Dirección</label>
                    <input pInputText [(ngModel)]="form.address" class="w-full" />
                </div>
                @if (editMode()) {
                    <div class="md:col-span-2">
                        <label class="block mb-2">Estado</label>
                        <p-select [options]="statusEditOptions" [(ngModel)]="form.active" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideCustomerDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveCustomer()" />
            </ng-template>
        </p-dialog>

        <p-dialog
            header="Historial de cliente"
            [(visible)]="historyDialog"
            [modal]="true"
            [style]="{ width: '980px' }"
            [breakpoints]="{ '1200px': '96vw', '960px': '98vw' }"
        >
            @if (historyLoading()) {
                <div class="text-sm text-gray-500">Cargando historial...</div>
            } @else if (selectedHistory()) {
                <div class="flex flex-col gap-3">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div><b>Cliente:</b> {{ selectedHistory()!.customer.name }}</div>
                        <div><b>Identificación:</b> {{ selectedHistory()!.customer.identification }}</div>
                        <div><b>Estado:</b> {{ selectedHistory()!.customer.active ? 'Activo' : 'Inactivo' }}</div>
                        <div><b>Compras:</b> {{ selectedHistory()!.summary.purchasesCount }}</div>
                        <div><b>Total:</b> {{ selectedHistory()!.summary.totalAmount | currency:'CUP' }}</div>
                        <div><b>Última compra:</b> {{ formatDateTime(selectedHistory()!.summary.lastPurchaseAt) }}</div>
                    </div>

                    <p-table [value]="selectedHistory()!.recentSales || []" [rows]="10" [paginator]="true">
                        <ng-template #header>
                            <tr>
                                <th>Fecha</th>
                                <th>Documento</th>
                                <th>Canal</th>
                                <th>Almacén</th>
                                <th>Cajero</th>
                                <th class="text-right">Total</th>
                            </tr>
                        </ng-template>
                        <ng-template #body let-sale>
                            <tr>
                                <td>{{ formatDateTime(sale.createdAt) }}</td>
                                <td>{{ sale.documentNumber || '-' }}</td>
                                <td>{{ getChannelLabel(sale.channel) }}</td>
                                <td>{{ sale.warehouse?.name || '-' }}</td>
                                <td>{{ sale.cashier?.email || '-' }}</td>
                                <td class="text-right">{{ sale.total | currency:'CUP' }}</td>
                            </tr>
                        </ng-template>
                        <ng-template #emptymessage>
                            <tr>
                                <td colspan="6" class="text-center">Este cliente aún no tiene ventas.</td>
                            </tr>
                        </ng-template>
                    </p-table>
                </div>
            } @else {
                <div class="text-sm text-gray-500">No se pudo cargar la información del cliente.</div>
            }
            <ng-template #footer>
                <p-button label="Cerrar" icon="pi pi-times" text (onClick)="historyDialog = false" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Customers implements OnInit {
    customers = signal<Customer[]>([]);
    loading = signal(false);
    editMode = signal(false);
    historyLoading = signal(false);
    selectedHistory = signal<CustomerHistory | null>(null);

    customerDialog = false;
    historyDialog = false;
    selectedCustomer: Customer | null = null;

    searchTerm = '';
    activeFilter: boolean | null = null;

    readonly statusFilterOptions: Array<{ label: string; value: boolean | null }> = [
        { label: 'Todos', value: null },
        { label: 'Activos', value: true },
        { label: 'Inactivos', value: false }
    ];

    readonly statusEditOptions: Array<{ label: string; value: boolean }> = [
        { label: 'Activo', value: true },
        { label: 'Inactivo', value: false }
    ];

    form: CustomerForm = this.emptyForm();

    constructor(
        private readonly customersService: CustomersService,
        private readonly messageService: MessageService,
        private readonly confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadCustomers();
    }

    loadCustomers() {
        this.loading.set(true);
        this.customersService
            .list({
                q: this.searchTerm?.trim() || undefined,
                active: this.activeFilter === null ? undefined : this.activeFilter,
                limit: 200
            })
            .subscribe({
                next: (rows) => {
                    this.customers.set(rows || []);
                    this.loading.set(false);
                },
                error: () => {
                    this.customers.set([]);
                    this.loading.set(false);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar los clientes.'
                    });
                }
            });
    }

    clearFilters() {
        this.searchTerm = '';
        this.activeFilter = null;
        this.loadCustomers();
    }

    openNew() {
        this.editMode.set(false);
        this.selectedCustomer = null;
        this.form = this.emptyForm();
        this.customerDialog = true;
    }

    editCustomer(customer: Customer) {
        this.editMode.set(true);
        this.selectedCustomer = customer;
        this.form = {
            name: customer.name || '',
            identification: customer.identification || '',
            phone: customer.phone || '',
            email: customer.email || '',
            address: customer.address || '',
            active: !!customer.active
        };
        this.customerDialog = true;
    }

    hideCustomerDialog() {
        this.customerDialog = false;
    }

    saveCustomer() {
        const payload = {
            name: this.form.name?.trim(),
            identification: this.form.identification?.trim(),
            phone: this.form.phone?.trim() || '',
            email: this.form.email?.trim() || '',
            address: this.form.address?.trim() || ''
        };

        if (!payload.name || !payload.identification) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Datos incompletos',
                detail: 'Nombre e identificación son obligatorios.'
            });
            return;
        }

        if (this.editMode() && this.selectedCustomer) {
            this.customersService
                .update(this.selectedCustomer.id, {
                    ...payload,
                    active: this.form.active
                })
                .subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Cliente actualizado',
                            detail: 'Los cambios se guardaron correctamente.'
                        });
                        this.customerDialog = false;
                        this.loadCustomers();
                    },
                    error: (err) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: err?.error?.message || 'No se pudo actualizar el cliente.'
                        });
                    }
                });
            return;
        }

        this.customersService.create(payload).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Cliente creado',
                    detail: 'El cliente fue creado correctamente.'
                });
                this.customerDialog = false;
                this.loadCustomers();
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo crear el cliente.'
                });
            }
        });
    }

    toggleActive(customer: Customer) {
        const nextStatus = !customer.active;
        const actionLabel = nextStatus ? 'activar' : 'desactivar';

        this.confirmationService.confirm({
            header: `${nextStatus ? 'Activar' : 'Desactivar'} cliente`,
            message: `¿Desea ${actionLabel} el cliente ${customer.name}?`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí',
            rejectLabel: 'Cancelar',
            accept: () => {
                this.customersService.update(customer.id, { active: nextStatus }).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Cliente actualizado',
                            detail: `Cliente ${nextStatus ? 'activado' : 'desactivado'} correctamente.`
                        });
                        this.loadCustomers();
                    },
                    error: (err) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: err?.error?.message || 'No se pudo actualizar el estado del cliente.'
                        });
                    }
                });
            }
        });
    }

    openHistory(customer: Customer) {
        this.historyDialog = true;
        this.historyLoading.set(true);
        this.selectedHistory.set(null);
        this.customersService.getHistory(customer.id).subscribe({
            next: (history) => {
                this.selectedHistory.set(history);
                this.historyLoading.set(false);
            },
            error: () => {
                this.historyLoading.set(false);
                this.selectedHistory.set(null);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudo cargar el historial del cliente.'
                });
            }
        });
    }

    formatDateTime(value: string | null | undefined): string {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }

    getChannelLabel(channel: string): string {
        if (channel === 'DIRECT') return 'Venta Directa';
        if (channel === 'TPV') return 'TPV';
        return channel || '-';
    }

    private emptyForm(): CustomerForm {
        return {
            name: '',
            identification: '',
            phone: '',
            email: '',
            address: '',
            active: true
        };
    }
}
