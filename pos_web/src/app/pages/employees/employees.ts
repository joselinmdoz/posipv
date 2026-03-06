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
import { Employee, EmployeeUserRef, EmployeesService } from '@/app/core/services/employees.service';

type EmployeeForm = {
    firstName: string;
    lastName: string;
    identification: string;
    phone: string;
    email: string;
    position: string;
    hireDate: string;
    salary: string;
    notes: string;
    active: boolean;
    userId: string;
};

@Component({
    selector: 'app-employees',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, ConfirmDialogModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, ToastModule, ToolbarModule],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo empleado" icon="pi pi-plus" severity="secondary" (onClick)="openNew()" />
            </ng-template>
        </p-toolbar>

        <div class="grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto] gap-3 items-end mb-4">
            <div>
                <label class="block mb-2">Buscar empleado</label>
                <input pInputText [(ngModel)]="searchTerm" (keydown.enter)="loadEmployees()" class="w-full" placeholder="Nombre, identificación, cargo o email" />
            </div>
            <div>
                <label class="block mb-2">Estado</label>
                <p-select [options]="statusFilterOptions" [(ngModel)]="activeFilter" optionLabel="label" optionValue="value" class="w-full" />
            </div>
            <p-button label="Buscar" icon="pi pi-search" [loading]="loading()" (onClick)="loadEmployees()" />
            <p-button label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" [disabled]="loading()" (onClick)="clearFilters()" />
        </div>

        <p-table [value]="employees()" [loading]="loading()" [rows]="10" [paginator]="true" dataKey="id">
            <ng-template #header>
                <tr>
                    <th>Nombre</th>
                    <th>Identificación</th>
                    <th>Cargo</th>
                    <th>Usuario</th>
                    <th>Teléfono</th>
                    <th class="text-right">Salario</th>
                    <th>Estado</th>
                    <th class="text-center">Acciones</th>
                </tr>
            </ng-template>
            <ng-template #body let-employee>
                <tr>
                    <td>{{ employee.firstName }} {{ employee.lastName }}</td>
                    <td>{{ employee.identification || '-' }}</td>
                    <td>{{ employee.position || '-' }}</td>
                    <td>{{ employee.user?.email || '-' }}</td>
                    <td>{{ employee.phone || '-' }}</td>
                    <td class="text-right">{{ employee.salary !== null ? (employee.salary | number:'1.2-2') : '-' }}</td>
                    <td>
                        <p-tag [value]="employee.active ? 'Activo' : 'Inactivo'" [severity]="employee.active ? 'success' : 'warn'" />
                    </td>
                    <td class="text-center">
                        <div class="flex justify-center gap-1">
                            <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" severity="success" (onClick)="editEmployee(employee)" />
                            <p-button
                                [icon]="employee.active ? 'pi pi-ban' : 'pi pi-check'"
                                [rounded]="true"
                                [text]="true"
                                [severity]="employee.active ? 'danger' : 'help'"
                                (onClick)="toggleActive(employee)"
                            />
                        </div>
                    </td>
                </tr>
            </ng-template>
            <ng-template #emptymessage>
                <tr>
                    <td colspan="8" class="text-center">No hay empleados para mostrar.</td>
                </tr>
            </ng-template>
        </p-table>

        <p-dialog
            header="{{ editMode() ? 'Editar empleado' : 'Nuevo empleado' }}"
            [(visible)]="employeeDialog"
            [modal]="true"
            [style]="{ width: '780px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block mb-2">Nombre *</label>
                    <input pInputText [(ngModel)]="form.firstName" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Apellidos *</label>
                    <input pInputText [(ngModel)]="form.lastName" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Identificación</label>
                    <input pInputText [(ngModel)]="form.identification" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Cargo</label>
                    <input pInputText [(ngModel)]="form.position" class="w-full" />
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
                    <label class="block mb-2">Fecha contratación</label>
                    <input pInputText type="date" [(ngModel)]="form.hireDate" class="w-full" />
                </div>
                <div>
                    <label class="block mb-2">Salario</label>
                    <input pInputText [(ngModel)]="form.salary" class="w-full" placeholder="0.00" />
                </div>
                <div class="md:col-span-2">
                    <label class="block mb-2">Usuario del sistema (opcional)</label>
                    <p-select
                        [options]="assignableUserOptions()"
                        [(ngModel)]="form.userId"
                        optionLabel="label"
                        optionValue="value"
                        placeholder="Sin usuario vinculado"
                        [showClear]="true"
                        class="w-full"
                    />
                </div>
                <div class="md:col-span-2">
                    <label class="block mb-2">Notas</label>
                    <input pInputText [(ngModel)]="form.notes" class="w-full" />
                </div>
                @if (editMode()) {
                    <div class="md:col-span-2">
                        <label class="block mb-2">Estado</label>
                        <p-select [options]="statusEditOptions" [(ngModel)]="form.active" optionLabel="label" optionValue="value" class="w-full" />
                    </div>
                }
            </div>
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveEmployee()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Employees implements OnInit {
    employees = signal<Employee[]>([]);
    loading = signal(false);
    editMode = signal(false);
    assignableUsers = signal<EmployeeUserRef[]>([]);

    employeeDialog = false;
    selectedEmployee: Employee | null = null;

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

    form: EmployeeForm = this.emptyForm();

    constructor(
        private readonly employeesService: EmployeesService,
        private readonly messageService: MessageService,
        private readonly confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadEmployees();
    }

    assignableUserOptions() {
        const users = this.assignableUsers();
        const options = users.map((user) => ({
            label: `${user.email} (${user.role})`,
            value: user.id
        }));
        if (this.selectedEmployee?.user && !options.find((item) => item.value === this.selectedEmployee!.user!.id)) {
            options.unshift({
                label: `${this.selectedEmployee.user.email} (${this.selectedEmployee.user.role})`,
                value: this.selectedEmployee.user.id
            });
        }
        return options;
    }

    loadEmployees() {
        this.loading.set(true);
        this.employeesService
            .list({
                q: this.searchTerm?.trim() || undefined,
                active: this.activeFilter === null ? undefined : this.activeFilter,
                limit: 200
            })
            .subscribe({
                next: (rows) => {
                    this.employees.set(rows || []);
                    this.loading.set(false);
                },
                error: () => {
                    this.employees.set([]);
                    this.loading.set(false);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar los empleados.'
                    });
                }
            });
    }

    clearFilters() {
        this.searchTerm = '';
        this.activeFilter = null;
        this.loadEmployees();
    }

    openNew() {
        this.editMode.set(false);
        this.selectedEmployee = null;
        this.form = this.emptyForm();
        this.employeeDialog = true;
        this.loadAssignableUsers();
    }

    editEmployee(employee: Employee) {
        this.editMode.set(true);
        this.selectedEmployee = employee;
        this.form = {
            firstName: employee.firstName || '',
            lastName: employee.lastName || '',
            identification: employee.identification || '',
            phone: employee.phone || '',
            email: employee.email || '',
            position: employee.position || '',
            hireDate: employee.hireDate ? this.toInputDate(employee.hireDate) : '',
            salary: employee.salary !== null && employee.salary !== undefined ? String(employee.salary) : '',
            notes: employee.notes || '',
            active: !!employee.active,
            userId: employee.userId || ''
        };
        this.employeeDialog = true;
        this.loadAssignableUsers(employee.id);
    }

    hideDialog() {
        this.employeeDialog = false;
    }

    saveEmployee() {
        const payload = {
            firstName: this.form.firstName?.trim(),
            lastName: this.form.lastName?.trim(),
            identification: this.form.identification?.trim() || '',
            phone: this.form.phone?.trim() || '',
            email: this.form.email?.trim() || '',
            position: this.form.position?.trim() || '',
            hireDate: this.form.hireDate || '',
            salary: this.form.salary?.trim() || '',
            notes: this.form.notes?.trim() || '',
            userId: this.form.userId || ''
        };

        if (!payload.firstName || !payload.lastName) {
            this.messageService.add({
                severity: 'warn',
                summary: 'Datos incompletos',
                detail: 'Nombre y apellidos son obligatorios.'
            });
            return;
        }

        if (this.editMode() && this.selectedEmployee) {
            this.employeesService
                .update(this.selectedEmployee.id, {
                    ...payload,
                    active: this.form.active
                })
                .subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Empleado actualizado',
                            detail: 'Los cambios se guardaron correctamente.'
                        });
                        this.employeeDialog = false;
                        this.loadEmployees();
                    },
                    error: (err) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: err?.error?.message || 'No se pudo actualizar el empleado.'
                        });
                    }
                });
            return;
        }

        this.employeesService.create(payload).subscribe({
            next: () => {
                this.messageService.add({
                    severity: 'success',
                    summary: 'Empleado creado',
                    detail: 'El empleado fue creado correctamente.'
                });
                this.employeeDialog = false;
                this.loadEmployees();
            },
            error: (err) => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudo crear el empleado.'
                });
            }
        });
    }

    toggleActive(employee: Employee) {
        const nextStatus = !employee.active;
        const actionLabel = nextStatus ? 'activar' : 'desactivar';
        this.confirmationService.confirm({
            header: `${nextStatus ? 'Activar' : 'Desactivar'} empleado`,
            message: `¿Desea ${actionLabel} a ${employee.firstName} ${employee.lastName}?`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Sí',
            rejectLabel: 'Cancelar',
            accept: () => {
                this.employeesService.update(employee.id, { active: nextStatus }).subscribe({
                    next: () => {
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Empleado actualizado',
                            detail: `Empleado ${nextStatus ? 'activado' : 'desactivado'} correctamente.`
                        });
                        this.loadEmployees();
                    },
                    error: (err) => {
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Error',
                            detail: err?.error?.message || 'No se pudo actualizar el estado del empleado.'
                        });
                    }
                });
            }
        });
    }

    private loadAssignableUsers(excludeEmployeeId?: string) {
        this.employeesService.listAssignableUsers(excludeEmployeeId).subscribe({
            next: (rows) => this.assignableUsers.set(rows || []),
            error: () => this.assignableUsers.set([])
        });
    }

    private toInputDate(value: string): string {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    private emptyForm(): EmployeeForm {
        return {
            firstName: '',
            lastName: '',
            identification: '',
            phone: '',
            email: '',
            position: '',
            hireDate: '',
            salary: '',
            notes: '',
            active: true,
            userId: ''
        };
    }
}
