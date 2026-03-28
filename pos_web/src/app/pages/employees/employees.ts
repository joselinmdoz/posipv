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
    image: string;
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
    styles: [
        `
            :host ::ng-deep .employee-form-dialog .p-dialog-content {
                background: #f7f9fb;
                padding: 0;
            }

            :host ::ng-deep .employee-form-dialog .p-dialog {
                border-radius: 18px;
                overflow: hidden;
            }

            :host ::ng-deep .employee-form-dialog .p-dialog-header,
            :host ::ng-deep .employee-form-dialog .p-dialog-footer {
                background: #f7f9fb;
            }

            :host ::ng-deep .employee-form-dialog .p-dialog-header {
                border-top-left-radius: 18px;
                border-top-right-radius: 18px;
            }

            :host ::ng-deep .employee-form-dialog .p-dialog-footer {
                border-bottom-left-radius: 18px;
                border-bottom-right-radius: 18px;
            }

            .employee-form-shell {
                padding: 1.25rem;
                display: grid;
                gap: 1rem;
            }

            .employee-profile-header {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: 0.55rem;
                background: #ffffff;
                border: 1px solid #d9deea;
                border-radius: 18px;
                padding: 1.2rem 1rem 1rem;
            }

            .employee-avatar-wrap {
                display: flex;
                align-items: center;
                justify-content: center;
                flex-direction: column;
                gap: 0.35rem;
            }

            .employee-avatar-clickable {
                cursor: pointer;
                user-select: none;
                transition: transform 0.14s ease;
            }

            .employee-avatar-clickable:hover {
                transform: translateY(-1px);
            }

            .employee-avatar-ring {
                width: 112px;
                height: 112px;
                border-radius: 999px;
                padding: 3px;
                background: linear-gradient(135deg, #003ca7, #1152d4);
                position: relative;
            }

            .employee-avatar {
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: 999px;
                border: 3px solid #ffffff;
            }

            .employee-avatar-placeholder {
                width: 100%;
                height: 100%;
                border-radius: 999px;
                border: 3px solid #ffffff;
                background: #e8edf7;
                color: #1152d4;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.6rem;
            }

            .employee-avatar-edit-badge {
                position: absolute;
                right: 1px;
                bottom: 2px;
                width: 28px;
                height: 28px;
                border-radius: 999px;
                background: #1152d4;
                color: #ffffff;
                border: 2px solid #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.8rem;
            }

            .employee-avatar-hint {
                margin: 0;
                font-size: 0.72rem;
                color: #6a7385;
            }

            .employee-remove-image-link {
                border: none;
                background: transparent;
                color: #ba1a1a;
                font-size: 0.8rem;
                font-weight: 600;
                cursor: pointer;
                padding: 0.1rem 0.3rem;
            }

            .employee-profile-title {
                font-family: 'Manrope', Inter, sans-serif;
                font-size: 1.36rem;
                line-height: 1.15;
                font-weight: 800;
                color: #191c1e;
                margin: 0;
            }

            .employee-profile-chip {
                background: #dbe1ff;
                color: #003da9;
                border-radius: 999px;
                padding: 0.26rem 0.72rem;
                font-size: 0.68rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                font-weight: 700;
            }

            .employee-fields-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.85rem;
            }

            .employee-list-person {
                display: flex;
                align-items: center;
                gap: 0.55rem;
            }

            .employee-list-avatar {
                width: 2rem;
                height: 2rem;
                border-radius: 999px;
                object-fit: cover;
                border: 1px solid #d1d8e5;
                flex: 0 0 2rem;
            }

            .employee-list-avatar-placeholder {
                width: 2rem;
                height: 2rem;
                border-radius: 999px;
                border: 1px solid #d1d8e5;
                background: #edf1f8;
                color: #4f5c73;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                font-size: 0.92rem;
                flex: 0 0 2rem;
            }

            .employee-field-card {
                background: #ffffff;
                border: 1px solid #dbe1ec;
                border-radius: 14px;
                padding: 0.75rem 0.8rem;
                display: grid;
                gap: 0.45rem;
            }

            .employee-field-card.full {
                grid-column: 1 / -1;
            }

            .employee-field-label {
                font-size: 0.66rem;
                letter-spacing: 0.11em;
                text-transform: uppercase;
                font-weight: 700;
                color: #545f73;
                margin: 0;
            }

            :host ::ng-deep .employee-form-shell .p-inputtext,
            :host ::ng-deep .employee-form-shell .p-select {
                width: 100%;
                border-radius: 10px;
                border-color: #cdd5e2;
                background: #fcfdff;
            }

            :host ::ng-deep .employee-form-shell .p-inputtext:enabled:focus,
            :host ::ng-deep .employee-form-shell .p-select:not(.p-disabled).p-focus {
                border-color: #1152d4;
                box-shadow: 0 0 0 0.15rem rgba(17, 82, 212, 0.14);
            }

            :host ::ng-deep .employee-form-dialog .p-dialog-footer {
                border-top: 1px solid #e0e3e5;
            }

            @media (max-width: 860px) {
                .employee-fields-grid {
                    grid-template-columns: 1fr;
                }
            }
        `
    ],
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

        <p-table [value]="employees()" [loading]="loading()" [rows]="10" [paginator]="true" responsiveLayout="scroll" dataKey="id">
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
                    <td>
                        <div class="employee-list-person">
                            @if (employee.image) {
                                <img class="employee-list-avatar" [src]="getImageUrl(employee.image)" [alt]="employee.firstName + ' ' + employee.lastName" />
                            } @else {
                                <span class="employee-list-avatar-placeholder">
                                    <i class="pi pi-user"></i>
                                </span>
                            }
                            <span>{{ employee.firstName }} {{ employee.lastName }}</span>
                        </div>
                    </td>
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
            [styleClass]="'employee-form-dialog'"
            [breakpoints]="{ '1200px': '96vw', '960px': '98vw' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="employee-form-shell">
                <section class="employee-profile-header">
                    <label for="employeeImageInput" class="employee-avatar-wrap employee-avatar-clickable">
                        <div class="employee-avatar-ring">
                            @if (imagePreview || form.image) {
                                <img class="employee-avatar" [src]="imagePreview || getImageUrl(form.image)" alt="Empleado" />
                            } @else {
                                <div class="employee-avatar-placeholder">
                                    <i class="pi pi-user"></i>
                                </div>
                            }
                            <span class="employee-avatar-edit-badge">
                                <i class="pi pi-camera"></i>
                            </span>
                        </div>
                    </label>
                    <input id="employeeImageInput" type="file" class="hidden" accept="image/webp,image/jpeg,image/png,image/gif" (change)="onImageSelected($event)" />
                    <h3 class="employee-profile-title">{{ (form.firstName || 'Nuevo') + ' ' + (form.lastName || 'empleado') }}</h3>
                    <span class="employee-profile-chip">{{ form.position || 'Perfil de empleado' }}</span>
                    <p class="employee-avatar-hint">Toca la imagen para seleccionar o cambiar la foto</p>
                    @if (imagePreview || form.image) {
                        <button type="button" class="employee-remove-image-link" (click)="removeImage()">Quitar foto</button>
                    }
                </section>

                <section class="employee-fields-grid">
                    <div class="employee-field-card">
                        <p class="employee-field-label">Nombre *</p>
                        <input pInputText [(ngModel)]="form.firstName" />
                    </div>
                    <div class="employee-field-card">
                        <p class="employee-field-label">Apellidos *</p>
                        <input pInputText [(ngModel)]="form.lastName" />
                    </div>
                    <div class="employee-field-card">
                        <p class="employee-field-label">Identificación</p>
                        <input pInputText [(ngModel)]="form.identification" />
                    </div>
                    <div class="employee-field-card">
                        <p class="employee-field-label">Cargo</p>
                        <input pInputText [(ngModel)]="form.position" />
                    </div>
                    <div class="employee-field-card">
                        <p class="employee-field-label">Teléfono</p>
                        <input pInputText [(ngModel)]="form.phone" />
                    </div>
                    <div class="employee-field-card">
                        <p class="employee-field-label">Email</p>
                        <input pInputText [(ngModel)]="form.email" />
                    </div>
                    <div class="employee-field-card">
                        <p class="employee-field-label">Fecha contratación</p>
                        <input pInputText type="date" [(ngModel)]="form.hireDate" />
                    </div>
                    <div class="employee-field-card">
                        <p class="employee-field-label">Salario</p>
                        <input pInputText [(ngModel)]="form.salary" placeholder="0.00" />
                    </div>
                    <div class="employee-field-card full">
                        <p class="employee-field-label">Usuario del sistema (opcional)</p>
                        <p-select
                            [options]="assignableUserOptions()"
                            [(ngModel)]="form.userId"
                            optionLabel="label"
                            optionValue="value"
                            placeholder="Sin usuario vinculado"
                            [appendTo]="'body'"
                            [showClear]="true"
                            class="w-full"
                        />
                    </div>
                    <div class="employee-field-card full">
                        <p class="employee-field-label">Notas</p>
                        <input pInputText [(ngModel)]="form.notes" />
                    </div>
                    @if (editMode()) {
                        <div class="employee-field-card full">
                            <p class="employee-field-label">Estado</p>
                            <p-select [options]="statusEditOptions" [(ngModel)]="form.active" optionLabel="label" optionValue="value" [appendTo]="'body'" class="w-full" />
                        </div>
                    }
                </section>
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
    selectedFile: File | null = null;
    imagePreview: string | null = null;
    readonly IMAGE_BASE_URL = '';

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
        this.selectedFile = null;
        this.imagePreview = null;
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
            image: employee.image || '',
            hireDate: employee.hireDate ? this.toInputDate(employee.hireDate) : '',
            salary: employee.salary !== null && employee.salary !== undefined ? String(employee.salary) : '',
            notes: employee.notes || '',
            active: !!employee.active,
            userId: employee.userId || ''
        };
        this.selectedFile = null;
        this.imagePreview = null;
        this.employeeDialog = true;
        this.loadAssignableUsers(employee.id);
    }

    hideDialog() {
        this.employeeDialog = false;
        this.selectedFile = null;
        this.imagePreview = null;
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

        const formData = new FormData();
        formData.append('firstName', payload.firstName);
        formData.append('lastName', payload.lastName);
        if (payload.identification) formData.append('identification', payload.identification);
        if (payload.phone) formData.append('phone', payload.phone);
        if (payload.email) formData.append('email', payload.email);
        if (payload.position) formData.append('position', payload.position);
        if (payload.hireDate) formData.append('hireDate', payload.hireDate);
        if (payload.salary) formData.append('salary', payload.salary);
        if (payload.notes) formData.append('notes', payload.notes);
        if (payload.userId) formData.append('userId', payload.userId);

        if (this.editMode()) {
            formData.append('active', String(this.form.active));
        }

        if (this.selectedFile) {
            formData.append('image', this.selectedFile);
        } else if (this.editMode()) {
            formData.append('existingImage', this.form.image || '');
        }

        if (this.editMode() && this.selectedEmployee) {
            this.employeesService
                .updateWithFormData(this.selectedEmployee.id, formData)
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

        this.employeesService.createWithFormData(formData).subscribe({
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

    onImageSelected(event: Event) {
        const target = event.target as HTMLInputElement | null;
        const file = target?.files?.[0] || null;
        if (file) {
            this.selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                this.imagePreview = String((e.target as FileReader | null)?.result || '');
            };
            reader.readAsDataURL(file);
        }
        if (target) target.value = '';
    }

    removeImage() {
        this.selectedFile = null;
        this.imagePreview = null;
        this.form.image = '';
    }

    getImageUrl(imagePath?: string | null): string {
        const path = String(imagePath || '').trim();
        if (!path) return '';
        if (path.startsWith('http://') || path.startsWith('https://')) return path;
        if (path.startsWith('/')) return this.IMAGE_BASE_URL + path;
        return `${this.IMAGE_BASE_URL}/${path}`;
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
            image: '',
            hireDate: '',
            salary: '',
            notes: '',
            active: true,
            userId: ''
        };
    }
}
