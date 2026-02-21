import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { InputIconModule } from 'primeng/inputicon';
import { IconFieldModule } from 'primeng/iconfield';
import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { UsersService, User, CreateUserDto, UpdateUserDto } from '@/app/core/services/users.service';

interface Column {
    field: string;
    header: string;
}

@Component({
    selector: 'app-users',
    standalone: true,
    imports: [
        CommonModule,
        TableModule,
        FormsModule,
        ButtonModule,
        RippleModule,
        ToastModule,
        ToolbarModule,
        InputTextModule,
        DialogModule,
        TagModule,
        InputIconModule,
        IconFieldModule,
        SelectModule,
        ConfirmDialogModule,
        PasswordModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                <p-button label="Nuevo" icon="pi pi-plus" severity="secondary" class="mr-2" (onClick)="openNew()" />
            </ng-template>
        </p-toolbar>

        <p-table
            #dt
            [value]="users()"
            [rows]="10"
            [columns]="cols"
            [paginator]="true"
            [globalFilterFields]="['email', 'role']"
            [tableStyle]="{ 'min-width': '50rem' }"
            [rowHover]="true"
            dataKey="id"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} usuarios"
        >
            <ng-template #header>
                <tr>
                    <th style="width: 4rem">
                        <p-tableHeaderCheckbox />
                    </th>
                    <th pSortableColumn="email">Email <p-sortIcon field="email" /></th>
                    <th pSortableColumn="role">Rol <p-sortIcon field="role" /></th>
                    <th pSortableColumn="active">Estado <p-sortIcon field="active" /></th>
                    <th pSortableColumn="createdAt">Fecha <p-sortIcon field="createdAt" /></th>
                    <th>Acciones</th>
                </tr>
                <tr>
                    <th></th>
                    <th>
                        <p-inputtext [(ngModel)]="filters['email']" placeholder="Buscar por email" (input)="filterGlobal($event)" />
                    </th>
                    <th>
                        <p-select [(ngModel)]="filters['role']" [options]="roles" placeholder="Todos" (onChange)="filterGlobal($event)" [showClear]="true" />
                    </th>
                    <th>
                        <p-select [(ngModel)]="filters['active']" [options]="statusOptions" placeholder="Todos" (onChange)="filterGlobal($event)" [showClear]="true" />
                    </th>
                    <th></th>
                    <th></th>
                </tr>
            </ng-template>
            <ng-template #body let-user>
                <tr>
                    <td>
                        <p-tableCheckbox [value]="user" />
                    </td>
                    <td>{{ user.email }}</td>
                    <td>
                        <p-tag [value]="user.role === 'ADMIN' ? 'Administrador' : 'Cajero'" [severity]="user.role === 'ADMIN' ? 'danger' : 'info'" />
                    </td>
                    <td>
                        <p-tag [value]="user.active ? 'Activo' : 'Inactivo'" [severity]="user.active ? 'success' : 'warn'" />
                    </td>
                    <td>{{ user.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>
                        <p-button icon="pi pi-pencil" class="mr-2" [rounded]="true" [outlined]="true" severity="success" (onClick)="editUser(user)" />
                        <p-button icon="pi pi-trash" class="mr-2" [rounded]="true" [outlined]="true" severity="danger" (onClick)="deleteUser(user)" />
                        <p-button icon="pi pi-key" [rounded]="true" [outlined]="true" severity="help" (onClick)="resetPassword(user)" pTooltip="Restablecer contraseña" />
                    </td>
                </tr>
            </ng-template>
            <ng-template #emptymessage>
                <tr>
                    <td colspan="6">No se encontraron usuarios.</td>
                </tr>
            </ng-template>
        </p-table>

        <!-- Dialog para crear/editar usuario -->
        <p-dialog 
            header="{{ isEditMode() ? 'Editar' : 'Nuevo' }} Usuario" 
            [(visible)]="userDialog" 
            [modal]="true" 
            [style]="{ width: '450px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <div class="flex flex-col gap-2">
                    <label for="email">Email</label>
                    <input pInputText id="email" [(ngModel)]="user.email" required autofocus [disabled]="isEditMode()" />
                </div>
                
                @if (!isEditMode()) {
                    <div class="flex flex-col gap-2">
                        <label for="password">Contraseña</label>
                        <p-password id="password" [(ngModel)]="user.password" [feedback]="false" [toggleMask]="true" placeholder="Mínimo 6 caracteres" />
                    </div>
                }

                <div class="flex flex-col gap-2">
                    <label for="role">Rol</label>
                    <p-select id="role" [(ngModel)]="user.role" [options]="roles" optionLabel="label" optionValue="value" placeholder="Seleccione un rol" />
                </div>

                @if (isEditMode()) {
                    <div class="flex flex-col gap-2">
                        <label for="active">Estado</label>
                        <p-select id="active" [(ngModel)]="user.active" [options]="statusOptions" optionLabel="label" optionValue="value" placeholder="Seleccione estado" />
                    </div>
                }
            </div>

            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hideDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="saveUser()" />
            </ng-template>
        </p-dialog>

        <!-- Dialog para restablecer contraseña -->
        <p-dialog 
            header="Restablecer Contraseña" 
            [(visible)]="passwordDialog" 
            [modal]="true" 
            [style]="{ width: '350px' }"
            [draggable]="false"
            [resizable]="false"
        >
            <div class="flex flex-col gap-4">
                <p>Introduzca la nueva contraseña para el usuario <strong>{{ selectedUser?.email }}</strong></p>
                <div class="flex flex-col gap-2">
                    <label for="newPassword">Nueva Contraseña</label>
                    <p-password id="newPassword" [(ngModel)]="newPassword" [feedback]="true" [toggleMask]="true" placeholder="Mínimo 6 caracteres" />
                </div>
            </div>

            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="hidePasswordDialog()" />
                <p-button label="Guardar" icon="pi pi-check" (onClick)="savePassword()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Users implements OnInit {
    users = signal<User[]>([]);
    isEditMode = signal<boolean>(false);
    
    userDialog = false;
    passwordDialog = false;
    
    selectedUser: User | null = null;
    newPassword: string = '';

    cols: Column[] = [
        { field: 'email', header: 'Email' },
        { field: 'role', header: 'Rol' },
        { field: 'active', header: 'Estado' },
        { field: 'createdAt', header: 'Fecha' }
    ];

    roles = [
        { label: 'Administrador', value: 'ADMIN' },
        { label: 'Cajero', value: 'CASHIER' }
    ];

    statusOptions = [
        { label: 'Activo', value: true },
        { label: 'Inactivo', value: false }
    ];

    filters = {
        email: '',
        role: null,
        active: null
    };

    user: any = {
        email: '',
        password: '',
        role: 'CASHIER',
        active: true
    };

    constructor(
        private usersService: UsersService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadUsers();
    }

    loadUsers() {
        this.usersService.list().subscribe({
            next: (users) => this.users.set(users),
            error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar usuarios' })
        });
    }

    openNew() {
        this.user = { email: '', password: '', role: 'CASHIER', active: true };
        this.isEditMode.set(false);
        this.userDialog = true;
    }

    editUser(user: User) {
        this.selectedUser = user;
        this.user = { 
            email: user.email, 
            role: user.role, 
            active: user.active 
        };
        this.isEditMode.set(true);
        this.userDialog = true;
    }

    hideDialog() {
        this.userDialog = false;
        this.selectedUser = null;
    }

    saveUser() {
        if (!this.user.email || (!this.isEditMode() && !this.user.password)) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Complete todos los campos requeridos' });
            return;
        }

        if (this.isEditMode() && this.selectedUser) {
            this.usersService.update(this.selectedUser.id, this.user).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario actualizado' });
                    this.loadUsers();
                    this.hideDialog();
                },
                error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar usuario' })
            });
        } else {
            this.usersService.create(this.user as CreateUserDto).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario creado' });
                    this.loadUsers();
                    this.hideDialog();
                },
                error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al crear usuario' })
            });
        }
    }

    deleteUser(user: User) {
        this.confirmationService.confirm({
            message: `¿Está seguro de eliminar el usuario ${user.email}?`,
            header: 'Confirmar',
            icon: 'pi pi-exclamation-triangle',
            accept: () => {
                this.usersService.delete(user.id).subscribe({
                    next: () => {
                        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario eliminado' });
                        this.loadUsers();
                    },
                    error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar usuario' })
                });
            }
        });
    }

    resetPassword(user: User) {
        this.selectedUser = user;
        this.newPassword = '';
        this.passwordDialog = true;
    }

    hidePasswordDialog() {
        this.passwordDialog = false;
        this.selectedUser = null;
        this.newPassword = '';
    }

    savePassword() {
        if (!this.newPassword || this.newPassword.length < 6) {
            this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'La contraseña debe tener al menos 6 caracteres' });
            return;
        }

        if (this.selectedUser) {
            this.usersService.resetPassword(this.selectedUser.id, this.newPassword).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Contraseña restablecida' });
                    this.hidePasswordDialog();
                },
                error: (err) => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al restablecer contraseña' })
            });
        }
    }

    filterGlobal(event: any) {
        // Implementar filtrado global si es necesario
    }
}
