import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { PermissionCatalogItem, UserPermissionsService, UserPermissionsUser } from '@/app/core/services/user-permissions.service';

@Component({
    selector: 'app-user-permissions',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, CheckboxModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, ToastModule],
    providers: [MessageService],
    template: `
        <div class="p-4">
            <div class="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div>
                    <h1 class="text-2xl font-bold m-0">Permisos de Usuario</h1>
                    <p class="m-0 mt-1 text-sm text-gray-600">Asigne permisos específicos por usuario para controlar acceso a módulos y acciones.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto] gap-3 items-end mb-4">
                <div>
                    <label class="block mb-2">Buscar usuario</label>
                    <input pInputText [(ngModel)]="searchTerm" (keydown.enter)="loadUsers()" class="w-full" placeholder="Email del usuario" />
                </div>
                <div>
                    <label class="block mb-2">Estado</label>
                    <p-select [options]="statusFilterOptions" [(ngModel)]="activeFilter" optionLabel="label" optionValue="value" class="w-full" />
                </div>
                <p-button label="Buscar" icon="pi pi-search" [loading]="loading()" (onClick)="loadUsers()" />
                <p-button label="Limpiar" icon="pi pi-filter-slash" severity="secondary" [outlined]="true" [disabled]="loading()" (onClick)="clearFilters()" />
            </div>

            <p-table [value]="users()" [loading]="loading()" [rows]="12" [paginator]="true" responsiveLayout="scroll" dataKey="id">
                <ng-template #header>
                    <tr>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th class="text-right">Permisos</th>
                        <th class="text-center">Opciones</th>
                    </tr>
                </ng-template>
                <ng-template #body let-user>
                    <tr>
                        <td>{{ user.email }}</td>
                        <td>{{ user.role }}</td>
                        <td>
                            <p-tag [value]="user.active ? 'Activo' : 'Inactivo'" [severity]="user.active ? 'success' : 'warn'" />
                        </td>
                        <td class="text-right">{{ (user.permissions || []).length }}</td>
                        <td class="text-center">
                            <p-button
                                icon="pi pi-key"
                                label="Configurar"
                                size="small"
                                severity="secondary"
                                [outlined]="true"
                                (onClick)="openPermissionsDialog(user)"
                            />
                        </td>
                    </tr>
                </ng-template>
                <ng-template #emptymessage>
                    <tr>
                        <td colspan="5" class="text-center">No hay usuarios para mostrar.</td>
                    </tr>
                </ng-template>
            </p-table>
        </div>

        <p-dialog
            header="Configurar permisos"
            [(visible)]="permissionsDialog"
            [modal]="true"
            [style]="{ width: '980px' }"
            [breakpoints]="{ '1200px': '96vw', '960px': '98vw' }"
        >
            @if (selectedUser()) {
                <div class="flex flex-col gap-3">
                    <div class="text-sm">
                        <div><b>Usuario:</b> {{ selectedUser()!.email }}</div>
                        <div><b>Rol:</b> {{ selectedUser()!.role }}</div>
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
                <p-button label="Guardar permisos" icon="pi pi-save" [loading]="saving()" [disabled]="!selectedUser()" (onClick)="savePermissions()" />
            </ng-template>
        </p-dialog>

        <p-toast />
    `
})
export class UserPermissions implements OnInit {
    users = signal<UserPermissionsUser[]>([]);
    catalog = signal<PermissionCatalogItem[]>([]);
    loading = signal(false);
    saving = signal(false);
    selectedUser = signal<UserPermissionsUser | null>(null);
    selectedPermissions = signal<string[]>([]);

    permissionsDialog = false;
    searchTerm = '';
    activeFilter: boolean | null = null;

    readonly statusFilterOptions: Array<{ label: string; value: boolean | null }> = [
        { label: 'Todos', value: null },
        { label: 'Activos', value: true },
        { label: 'Inactivos', value: false }
    ];

    constructor(
        private readonly userPermissionsService: UserPermissionsService,
        private readonly messageService: MessageService
    ) {}

    ngOnInit() {
        this.loadCatalog();
        this.loadUsers();
    }

    loadCatalog() {
        this.userPermissionsService.getCatalog().subscribe({
            next: (rows) => this.catalog.set(rows || []),
            error: () => this.catalog.set([])
        });
    }

    loadUsers() {
        this.loading.set(true);
        this.userPermissionsService
            .listUsers({
                q: this.searchTerm?.trim() || undefined,
                active: this.activeFilter === null ? undefined : this.activeFilter,
                limit: 500
            })
            .subscribe({
                next: (rows) => {
                    this.users.set(rows || []);
                    this.loading.set(false);
                },
                error: () => {
                    this.users.set([]);
                    this.loading.set(false);
                    this.messageService.add({
                        severity: 'error',
                        summary: 'Error',
                        detail: 'No se pudieron cargar los usuarios.'
                    });
                }
            });
    }

    clearFilters() {
        this.searchTerm = '';
        this.activeFilter = null;
        this.loadUsers();
    }

    openPermissionsDialog(user: UserPermissionsUser) {
        this.userPermissionsService.getUser(user.id).subscribe({
            next: (row) => {
                this.selectedUser.set(row);
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
        const user = this.selectedUser();
        if (!user) return;
        this.saving.set(true);
        this.userPermissionsService.updateUserPermissions(user.id, this.selectedPermissions()).subscribe({
            next: (updated) => {
                this.saving.set(false);
                this.selectedUser.set(updated);
                this.users.set(
                    this.users().map((row) => (row.id === updated.id ? updated : row))
                );
                this.permissionsDialog = false;
                this.messageService.add({
                    severity: 'success',
                    summary: 'Permisos actualizados',
                    detail: 'Los permisos del usuario se guardaron correctamente.'
                });
            },
            error: (err) => {
                this.saving.set(false);
                this.messageService.add({
                    severity: 'error',
                    summary: 'Error',
                    detail: err?.error?.message || 'No se pudieron actualizar los permisos.'
                });
            }
        });
    }
}
