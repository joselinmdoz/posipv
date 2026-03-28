import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AppMenuitem } from './app.menuitem';
import { AuthService } from '@/app/core/services/auth.service';

type AppMenuItem = MenuItem & {
    permissions?: string[];
    items?: AppMenuItem[];
};

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model; track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `,
})
export class AppMenu {
    model: MenuItem[] = [];

    constructor(private authService: AuthService) {}

    ngOnInit() {
        const baseModel: AppMenuItem[] = [
            {
                label: 'Inicio',
                items: [{ label: 'Dashboard', icon: 'pi pi-fw pi-home', routerLink: ['/'], permissions: ['dashboard.view'] }]
            },
            {
                label: 'Gestión',
                icon: 'pi pi-fw pi-briefcase',
                items: [
                    { label: 'Productos', icon: 'pi pi-fw pi-box', routerLink: ['/products'], permissions: ['products.view'] },
                    { label: 'Tipos de Producto', icon: 'pi pi-fw pi-tag', routerLink: ['/product-types'], permissions: ['products.manage'] },
                    { label: 'Categorías', icon: 'pi pi-fw pi-folder', routerLink: ['/product-categories'], permissions: ['products.manage'] },
                    { label: 'Unidades de Medida', icon: 'pi pi-fw pi-slack', routerLink: ['/measurement-units'], permissions: ['products.manage'] },
                    { label: 'Almacenes', icon: 'pi pi-fw pi-warehouse', routerLink: ['/warehouses'], permissions: ['warehouses.view'] },
                    { label: 'TPV', icon: 'pi pi-fw pi-shop', routerLink: ['/tpv-management'], permissions: ['sales.tpv', 'tpv.manage'] },
                    { label: 'Ventas', icon: 'pi pi-fw pi-shopping-bag', routerLink: ['/direct-sales'], permissions: ['sales.direct'] },
                    { label: 'Compras', icon: 'pi pi-fw pi-shopping-cart', routerLink: ['/purchases'], permissions: ['purchases.view', 'purchases.manage'] },
                    { label: 'Clientes', icon: 'pi pi-fw pi-address-book', routerLink: ['/customers'], permissions: ['customers.view'] },
                    { label: 'Denominaciones', icon: 'pi pi-fw pi-dollar', routerLink: ['/denominations'], permissions: ['tpv.manage'] }
                ]
            },
            {
                label: 'Reportes',
                icon: 'pi pi-chart-bar',
                items: [
                    { label: 'Ventas', icon: 'pi pi-fw pi-chart-line', routerLink: ['/reports'], permissions: ['reports.view'] },
                    { label: 'Inventario (IPV)', icon: 'pi pi-fw pi-list', routerLink: ['/inventory-reports'], permissions: ['reports.view'] }
                ]
            },
             {
                label: 'Administración',
                icon: 'pi pi-chart-bar',
                items: [
                 { label: 'Empleados', icon: 'pi pi-fw pi-id-card', routerLink: ['/employees'], permissions: ['employees.view'] },
                 {
                    label: 'Contabilidad',
                    icon: 'pi pi-fw pi-calculator',
                    path: '/administracion/contabilidad',
                    items: [
                        { label: 'Plan de Cuentas', icon: 'pi pi-fw pi-list', routerLink: ['/accounting/plan-cuentas'], permissions: ['accounting.view'] },
                        { label: 'Períodos Fiscales', icon: 'pi pi-fw pi-calendar', routerLink: ['/accounting/periodos-fiscales'], permissions: ['accounting.view'] },
                        { label: 'Reglas', icon: 'pi pi-fw pi-cog', routerLink: ['/accounting/reglas-contables'], permissions: ['accounting.view'] },
                        { label: 'Asientos Contables', icon: 'pi pi-fw pi-pencil', routerLink: ['/accounting/asientos-contables'], permissions: ['accounting.view'] },
                        { label: 'Estado de Cuentas', icon: 'pi pi-fw pi-chart-line', routerLink: ['/accounting/estado-cuentas'], permissions: ['accounting.view'] },
                        { label: 'Reportes', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/accounting/reportes'], permissions: ['accounting.view'] }
                    ]
                 },
                 { label: 'Usuarios', icon: 'pi pi-fw pi-users', routerLink: ['/users'], permissions: ['users.manage', 'permissions.manage'] },
                { label: 'Config. General', icon: 'pi pi-fw pi-cog', routerLink: ['/settings'], permissions: ['settings.manage'] },
                { label: 'Métodos de Pago', icon: 'pi pi-fw pi-credit-card', routerLink: ['/payment-methods'], permissions: ['tpv.manage', 'settings.manage'] },
                ]
            },
            // {
            //     label: 'UI Components',
            //     items: [
            //         { label: 'Form Layout', icon: 'pi pi-fw pi-id-card', routerLink: ['/uikit/formlayout'] },
            //         { label: 'Input', icon: 'pi pi-fw pi-check-square', routerLink: ['/uikit/input'] },
            //         { label: 'Button', icon: 'pi pi-fw pi-mobile', class: 'rotated-icon', routerLink: ['/uikit/button'] },
            //         { label: 'Table', icon: 'pi pi-fw pi-table', routerLink: ['/uikit/table'] },
            //         { label: 'List', icon: 'pi pi-fw pi-list', routerLink: ['/uikit/list'] },
            //         { label: 'Tree', icon: 'pi pi-fw pi-share-alt', routerLink: ['/uikit/tree'] },
            //         { label: 'Panel', icon: 'pi pi-fw pi-tablet', routerLink: ['/uikit/panel'] },
            //         { label: 'Overlay', icon: 'pi pi-fw pi-clone', routerLink: ['/uikit/overlay'] },
            //         { label: 'Media', icon: 'pi pi-fw pi-image', routerLink: ['/uikit/media'] },
            //         { label: 'Menu', icon: 'pi pi-fw pi-bars', routerLink: ['/uikit/menu'] },
            //         { label: 'Message', icon: 'pi pi-fw pi-comment', routerLink: ['/uikit/message'] },
            //         { label: 'File', icon: 'pi pi-fw pi-file', routerLink: ['/uikit/file'] },
            //         { label: 'Chart', icon: 'pi pi-fw pi-chart-bar', routerLink: ['/uikit/charts'] },
            //         { label: 'Timeline', icon: 'pi pi-fw pi-calendar', routerLink: ['/uikit/timeline'] },
            //         { label: 'Misc', icon: 'pi pi-fw pi-circle', routerLink: ['/uikit/misc'] }
            //     ]
            // },
            // {
            //     label: 'Pages',
            //     icon: 'pi pi-fw pi-briefcase',
            //     path: '/pages',
            //     items: [
            //         {
            //             label: 'Landing',
            //             icon: 'pi pi-fw pi-globe',
            //             routerLink: ['/landing']
            //         },
            //         {
            //             label: 'Auth',
            //             icon: 'pi pi-fw pi-user',
            //             path: '/auth',
            //             items: [
            //                 {
            //                     label: 'Login',
            //                     icon: 'pi pi-fw pi-sign-in',
            //                     routerLink: ['/auth/login']
            //                 },
            //                 {
            //                     label: 'Error',
            //                     icon: 'pi pi-fw pi-times-circle',
            //                     routerLink: ['/auth/error']
            //                 },
            //                 {
            //                     label: 'Access Denied',
            //                     icon: 'pi pi-fw pi-lock',
            //                     routerLink: ['/auth/access']
            //                 }
            //             ]
            //         },
            //         {
            //             label: 'Crud',
            //             icon: 'pi pi-fw pi-pencil',
            //             routerLink: ['/pages/crud']
            //         },
            //         {
            //             label: 'Not Found',
            //             icon: 'pi pi-fw pi-exclamation-circle',
            //             routerLink: ['/pages/notfound']
            //         },
            //         {
            //             label: 'Empty',
            //             icon: 'pi pi-fw pi-circle-off',
            //             routerLink: ['/pages/empty']
            //         }
            //     ]
            // },
            // {
            //     label: 'Hierarchy',
            //     path: '/hierarchy',
            //     items: [
            //         {
            //             label: 'Submenu 1',
            //             icon: 'pi pi-fw pi-bookmark',
            //             path: '/hierarchy/submenu_1',
            //             items: [
            //                 {
            //                     label: 'Submenu 1.1',
            //                     icon: 'pi pi-fw pi-bookmark',
            //                     path: '/hierarchy/submenu_1/submenu_1_1',
            //                     items: [
            //                         { label: 'Submenu 1.1.1', icon: 'pi pi-fw pi-bookmark' },
            //                         { label: 'Submenu 1.1.2', icon: 'pi pi-fw pi-bookmark' },
            //                         { label: 'Submenu 1.1.3', icon: 'pi pi-fw pi-bookmark' }
            //                     ]
            //                 },
            //                 {
            //                     label: 'Submenu 1.2',
            //                     icon: 'pi pi-fw pi-bookmark',
            //                     path: '/hierarchy/submenu_1/submenu_1_2',
            //                     items: [{ label: 'Submenu 1.2.1', icon: 'pi pi-fw pi-bookmark' }]
            //                 }
            //             ]
            //         },
            //         {
            //             label: 'Submenu 2',
            //             icon: 'pi pi-fw pi-bookmark',
            //             path: '/hierarchy/submenu_2',
            //             items: [
            //                 {
            //                     label: 'Submenu 2.1',
            //                     icon: 'pi pi-fw pi-bookmark',
            //                     path: '/hierarchy/submenu_2/submenu_2_1',
            //                     items: [
            //                         { label: 'Submenu 2.1.1', icon: 'pi pi-fw pi-bookmark' },
            //                         { label: 'Submenu 2.1.2', icon: 'pi pi-fw pi-bookmark' }
            //                     ]
            //                 },
            //                 {
            //                     label: 'Submenu 2.2',
            //                     icon: 'pi pi-fw pi-bookmark',
            //                     path: '/hierarchy/submenu_2/submenu_2_2',
            //                     items: [{ label: 'Submenu 2.2.1', icon: 'pi pi-fw pi-bookmark' }]
            //                 }
            //             ]
            //         }
            //     ]
            // },
            // {
            //     label: 'Get Started',
            //     items: [
            //         {
            //             label: 'Documentation',
            //             icon: 'pi pi-fw pi-book',
            //             routerLink: ['/documentation']
            //         },
            //         {
            //             label: 'View Source',
            //             icon: 'pi pi-fw pi-github',
            //             url: 'https://github.com/primefaces/sakai-ng',
            //             target: '_blank'
            //         }
            //     ]
            // }
        ];
        this.model = this.filterMenuByPermissions(baseModel);
    }

    private filterMenuByPermissions(items: AppMenuItem[]): AppMenuItem[] {
        const visibleItems: AppMenuItem[] = [];

        for (const item of items) {
            if (item.separator) {
                visibleItems.push(item);
                continue;
            }

            const hasPermission = !item.permissions || this.authService.hasAnyPermission(item.permissions);
            let children: AppMenuItem[] | undefined;

            if (item.items?.length) {
                children = this.filterMenuByPermissions(item.items);
                if (!children.length && !item.routerLink && !item.url) {
                    continue;
                }
            }

            const hasVisibleChildren = !!children?.length;
            if (!hasPermission && !hasVisibleChildren) continue;

            visibleItems.push({
                ...item,
                items: children,
            });
        }

        return visibleItems;
    }
}
