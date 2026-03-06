import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { PasswordModule } from 'primeng/password';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageService, ConfirmationService } from 'primeng/api';
import { UsersService, User, CreateUserDto } from '@/app/core/services/users.service';
import { AuthService } from '@/app/core/services/auth.service';
import { PermissionCatalogItem, UserPermissionsService } from '@/app/core/services/user-permissions.service';

interface ManagedUser extends User {
    permissions: string[];
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
        SelectModule,
        ConfirmDialogModule,
        PasswordModule,
        CheckboxModule
    ],
    providers: [MessageService, ConfirmationService],
    template: `
        <p-toolbar styleClass="mb-6">
            <ng-template #start>
                @if (canManageUsers()) {
                    <p-button label="Nuevo" icon="pi pi-plus" severity="secondary" class="mr-2" (onClick)="openNew()" />
                }
            </ng-template>
        </p-toolbar>

        <p-table
            [value]="users()"
            [rows]="10"
            [paginator]="true"
            [globalFilterFields]="['email', 'role']"
            [tableStyle]="{ 'min-width': '58rem' }"
            [rowHover]="true"
            dataKey="id"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} usuarios"
        >
            <ng-template #header>
                <tr>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Fecha</th>
                    @if (canManagePermissions()) {
                        <th class="text-right">Permisos</th>
                    }
                    <th>Acciones</th>
                </tr>
            </ng-template>

            <ng-template #body let-user>
                <tr>
                    <td>{{ user.email }}</td>
                    <td>
                        <p-tag [value]="user.role === 'ADMIN' ? 'Administrador' : 'Cajero'" [severity]="user.role === 'ADMIN' ? 'danger' : 'info'" />
                    </td>
                    <td>
                        <p-tag [value]="user.active ? 'Activo' : 'Inactivo'" [severity]="user.active ? 'success' : 'warn'" />
                    </td>
                    <td>{{ user.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
                    @if (canManagePermissions()) {
                        <td class="text-right">{{ (user.permissions || []).length }}</td>
                    }
                    <td>
                        @if (canManageUsers()) {
                            <p-button icon="pi pi-pencil" class="mr-2" [rounded]="true" [outlined]="true" severity="success" (onClick)="editUser(user)" />
                            <p-button icon="pi pi-trash" class="mr-2" [rounded]="true" [outlined]="true" severity="danger" (onClick)="deleteUser(user)" />
                            <p-button icon="pi pi-key" class="mr-2" [rounded]="true" [outlined]="true" severity="help" (onClick)="resetPassword(user)" pTooltip="Restablecer contraseña" />
                        }
                        @if (canManagePermissions()) {
                            <p-button icon="pi pi-shield" [rounded]="true" [outlined]="true" severity="secondary" (onClick)="openPermissionsDialog(user)" pTooltip="Configurar permisos" />
                        }
                    </td>
                </tr>
            </ng-template>

            <ng-template #emptymessage>
                <tr>
                    <td [attr.colspan]="canManagePermissions() ? 6 : 5">No se encontraron usuarios.</td>
                </tr>
            </ng-template>
        </p-table>

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

        <p-dialog
            header="Configurar permisos"
            [(visible)]="permissionsDialog"
            [modal]="true"
            [style]="{ width: '980px' }"
            [breakpoints]="{ '1200px': '96vw', '960px': '98vw' }"
        >
            @if (selectedPermissionUser()) {
                <div class="flex flex-col gap-3">
                    <div class="text-sm">
                        <div><b>Usuario:</b> {{ selectedPermissionUser()!.email }}</div>
                        <div><b>Rol:</b> {{ selectedPermissionUser()!.role }}</div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        @for (group of permissionGroups(); track group.name) {
                            <div class="border rounded p-3">
                                <div class="font-semibold mb-2">{{ group.name }}</div>
                                <div class="flex flex-col gap-2">
                                    @for (perm of group.items; track perm.code) {
                                        <div class="flex items-start gap-2">
                                            <p-checkbox
                                                [binary]="true"
                                                [ngModel]="isPermissionSelected(perm.code)"
                                                (onChange)="togglePermission(perm.code, $event.checked)"
                                                [inputId]="'perm-' + perm.code"
                                            />
                                            <label [for]="'perm-' + perm.code" class="cursor-pointer">
                                                <div class="font-medium text-sm">{{ perm.label }}</div>
                                                <div class="text-xs text-gray-500">{{ perm.description }}</div>
                                            </label>
                                        </div>
                                    }
                                </div>
                            </div>
                        }
                    </div>
                </div>
            }
            <ng-template #footer>
                <p-button label="Cancelar" icon="pi pi-times" text (onClick)="permissionsDialog = false" />
                <p-button label="Guardar permisos" icon="pi pi-save" [loading]="savingPermissions()" [disabled]="!selectedPermissionUser()" (onClick)="savePermissions()" />
            </ng-template>
        </p-dialog>

        <p-confirmdialog />
        <p-toast />
    `
})
export class Users implements OnInit {
    users = signal<ManagedUser[]>([]);
    catalog = signal<PermissionCatalogItem[]>([]);
    selectedPermissions = signal<string[]>([]);
    isEditMode = signal<boolean>(false);
    savingPermissions = signal<boolean>(false);

    userDialog = false;
    passwordDialog = false;
    permissionsDialog = false;

    selectedUser: ManagedUser | null = null;
    selectedPermissionUser = signal<ManagedUser | null>(null);
    newPassword = '';

    roles = [
        { label: 'Administrador', value: 'ADMIN' },
        { label: 'Cajero', value: 'CASHIER' }
    ];

    statusOptions = [
        { label: 'Activo', value: true },
        { label: 'Inactivo', value: false }
    ];

    user: any = {
        email: '',
        password: '',
        role: 'CASHIER',
        active: true
    };

    constructor(
        private usersService: UsersService,
        private userPermissionsService: UserPermissionsService,
        private authService: AuthService,
        private messageService: MessageService,
        private confirmationService: ConfirmationService
    ) {}

    ngOnInit() {
        this.loadCatalog();
        this.loadUsers();
    }

    canManageUsers() {
        return this.authService.hasPermission('users.manage');
    }

    canManagePermissions() {
        return this.authService.hasPermission('permissions.manage');
    }

    loadUsers() {
        const canPermissions = this.canManagePermissions();

        forkJoin({
            base: this.usersService.list().pipe(catchError(() => of([] as User[]))),
            perms: canPermissions
                ? this.userPermissionsService.listUsers({ limit: 500 }).pipe(catchError(() => of([])))
                : of([])
        }).subscribe({
            next: ({ base, perms }) => {
                const permissionsMap = new Map<string, string[]>(
                    (perms as any[]).map((row) => [row.id, Array.isArray(row.permissions) ? row.permissions : []])
                );
                const rows: ManagedUser[] = (base || []).map((user) => ({
                    ...user,
                    permissions: permissionsMap.get(user.id) || []
                }));
                this.users.set(rows);
            },
            error: () => {
                this.users.set([]);
                this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al cargar usuarios' });
            }
        });
    }

    loadCatalog() {
        if (!this.canManagePermissions()) {
            this.catalog.set([]);
            return;
        }

        this.userPermissionsService.getCatalog().subscribe({
            next: (rows) => this.catalog.set(rows || []),
            error: () => this.catalog.set([])
        });
    }

    openNew() {
        this.user = { email: '', password: '', role: 'CASHIER', active: true };
        this.isEditMode.set(false);
        this.userDialog = true;
    }

    editUser(user: ManagedUser) {
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
                error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al actualizar usuario' })
            });
        } else {
            this.usersService.create(this.user as CreateUserDto).subscribe({
                next: () => {
                    this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Usuario creado' });
                    this.loadUsers();
                    this.hideDialog();
                },
                error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al crear usuario' })
            });
        }
    }

    deleteUser(user: ManagedUser) {
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
                    error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al eliminar usuario' })
                });
            }
        });
    }

    resetPassword(user: ManagedUser) {
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
                error: () => this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Error al restablecer contraseña' })
            });
        }
    }

    openPermissionsDialog(user: ManagedUser) {
        if (!this.canManagePermissions()) return;

        this.userPermissionsService.getUser(user.id).subscribe({
            next: (row) => {
                const selected: ManagedUser = {
                    id: row.id,
                    email: row.email,
                    role: row.role as 'ADMIN' | 'CASHIER',
                    active: row.active,
                    createdAt: row.createdAt as any,
                    permissions: [...(row.permissions || [])]
                };
                this.selectedPermissionUser.set(selected);
                this.selectedPermissions.set([...(row.permissions || [])]);
                this.permissionsDialog = true;
            },
            error: () => {
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: 'No se pudieron cargar los permisos del usuario.'
                });
            }
        });
    }

    permissionGroups() {
        const map = new Map<string, PermissionCatalogItem[]>();
        for (const item of this.catalog()) {
            const group = item.group || 'Otros';
            const current = map.get(group) || [];
            current.push(item);
            map.set(group, current);
        }

        return Array.from(map.entries())
            .map(([name, items]) => ({
                name,
                items: [...items].sort((a, b) => a.label.localeCompare(b.label))
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    isPermissionSelected(code: string): boolean {
        return this.selectedPermissions().includes(code);
    }

    togglePermission(code: string, checked: boolean) {
        const current = new Set(this.selectedPermissions());
        if (checked) current.add(code);
        else current.delete(code);
        this.selectedPermissions.set(Array.from(current).sort((a, b) => a.localeCompare(b)));
    }

    savePermissions() {
        const user = this.selectedPermissionUser();
        if (!user) return;

        this.savingPermissions.set(true);
        this.userPermissionsService.updateUserPermissions(user.id, this.selectedPermissions()).subscribe({
            next: (updated) => {
                this.savingPermissions.set(false);
                this.permissionsDialog = false;
                this.selectedPermissionUser.set(null);
                this.users.update((rows) =>
                    rows.map((row) =>
                        row.id === updated.id ? { ...row, permissions: [...(updated.permissions || [])] } : row
                    )
                );
                this.messageService.add({
                    severity: 'success',
                    summary: 'Permisos actualizados',
                    detail: 'Los permisos del usuario se guardaron correctamente.'
                });
            },
            error: (err) => {
                this.savingPermissions.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudieron actualizar los permisos.'
                });
            }
        });
    }
}
