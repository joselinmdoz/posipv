import { inject } from '@angular/core';
import { AuthService } from './app/core/services/auth.service';
import { Router, Routes } from '@angular/router';

const authGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    
    if (authService.isAuthenticated()) {
        return true;
    }
    
    return router.createUrlTree(['/auth/login']);
};

const permissionGuard = (permissions: string[]) => () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
        return router.createUrlTree(['/auth/login']);
    }

    if (authService.hasAnyPermission(permissions)) {
        return true;
    }

    return router.createUrlTree(['/auth/access']);
};

export const appRoutes: Routes = [
    {
        path: 'auth',
        loadChildren: () => import('./app/pages/auth/auth.routes')
    },
    {
        path: '',
        loadComponent: () => import('./app/layout/component/app.layout').then((m) => m.AppLayout),
        canActivate: [authGuard],
        children: [
            { path: '', loadComponent: () => import('./app/pages/dashboard/dashboard').then((m) => m.Dashboard), canActivate: [permissionGuard(['dashboard.view'])] },
            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes'), canActivate: [permissionGuard(['dashboard.view'])] },
            { path: 'documentation', loadComponent: () => import('./app/pages/documentation/documentation').then((m) => m.Documentation), canActivate: [permissionGuard(['dashboard.view'])] },
            { path: 'users', loadComponent: () => import('./app/pages/users/users').then((m) => m.Users), canActivate: [permissionGuard(['users.manage', 'permissions.manage'])] },
            { path: 'products', loadComponent: () => import('./app/pages/products/products').then((m) => m.Products), canActivate: [permissionGuard(['products.view'])] },
            { path: 'product-types', loadComponent: () => import('./app/pages/product-types/product-types').then((m) => m.ProductTypes), canActivate: [permissionGuard(['products.manage'])] },
            { path: 'product-categories', loadComponent: () => import('./app/pages/product-categories/product-categories').then((m) => m.ProductCategories), canActivate: [permissionGuard(['products.manage'])] },
            { path: 'measurement-units', loadComponent: () => import('./app/pages/measurement-units/measurement-units').then((m) => m.MeasurementUnits), canActivate: [permissionGuard(['products.manage'])] },
            { path: 'warehouses', loadComponent: () => import('./app/pages/warehouses/warehouses').then((m) => m.Warehouses), canActivate: [permissionGuard(['warehouses.view'])] },
            {
                path: 'warehouses/stock-bulk-update',
                loadComponent: () => import('./app/pages/warehouses/warehouse-stock-bulk-update').then((m) => m.WarehouseStockBulkUpdate),
                canActivate: [permissionGuard(['stock-movements.manage', 'warehouses.manage'])]
            },
            { path: 'tpv', loadComponent: () => import('./app/pages/tpv/tpv').then((m) => m.Tpv), canActivate: [permissionGuard(['sales.tpv'])] },
            { path: 'tpv-management', loadComponent: () => import('./app/pages/tpv-management/tpv-management').then((m) => m.TpvManagement), canActivate: [permissionGuard(['sales.tpv', 'tpv.manage'])] },
            { path: 'direct-sales', loadComponent: () => import('./app/pages/direct-sales/direct-sales').then((m) => m.DirectSales), canActivate: [permissionGuard(['sales.direct'])] },
            { path: 'purchases', loadComponent: () => import('./app/pages/purchases/purchases').then((m) => m.Purchases), canActivate: [permissionGuard(['purchases.view', 'purchases.manage'])] },
            { path: 'customers', loadComponent: () => import('./app/pages/customers/customers').then((m) => m.Customers), canActivate: [permissionGuard(['customers.view'])] },
            { path: 'employees', loadComponent: () => import('./app/pages/employees/employees').then((m) => m.Employees), canActivate: [permissionGuard(['employees.view'])] },
            { path: 'accounting', pathMatch: 'full', redirectTo: 'accounting/plan-cuentas' },
            {
                path: 'accounting/plan-cuentas',
                loadComponent: () => import('./app/pages/accounting/accounting-chart-of-accounts').then((m) => m.AccountingChartOfAccounts),
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/periodos-fiscales',
                loadComponent: () => import('./app/pages/accounting/accounting-fiscal-periods').then((m) => m.AccountingFiscalPeriods),
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/reglas-contables',
                loadComponent: () => import('./app/pages/accounting/accounting-posting-rules').then((m) => m.AccountingPostingRules),
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/asientos-contables',
                loadComponent: () => import('./app/pages/accounting/accounting-journal-entries').then((m) => m.AccountingJournalEntries),
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/estado-cuentas',
                loadComponent: () => import('./app/pages/accounting/accounting-account-status').then((m) => m.AccountingAccountStatus),
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/reportes',
                loadComponent: () => import('./app/pages/accounting/accounting-reports').then((m) => m.AccountingReports),
                canActivate: [permissionGuard(['accounting.view'])]
            },
            { path: 'user-permissions', redirectTo: 'users', pathMatch: 'full' },
            { path: 'settings', loadComponent: () => import('./app/pages/settings/settings').then((m) => m.Settings), canActivate: [permissionGuard(['settings.manage'])] },
            { path: 'license', loadComponent: () => import('./app/pages/license/license').then((m) => m.LicensePage), canActivate: [permissionGuard(['settings.manage'])] },
            { path: 'keypem', loadComponent: () => import('./app/pages/keypem/keypem').then((m) => m.KeyPemPage), canActivate: [permissionGuard(['settings.manage'])] },
            {
                path: 'payment-methods',
                loadComponent: () => import('./app/pages/payment-methods/payment-methods').then((m) => m.PaymentMethods),
                canActivate: [permissionGuard(['tpv.manage', 'settings.manage'])]
            },
            { path: 'denominations', loadComponent: () => import('./app/pages/denominations/denominations').then((m) => m.Denominations), canActivate: [permissionGuard(['tpv.manage'])] },
            { path: 'reports', loadComponent: () => import('./app/pages/reports/reports').then((m) => m.Reports), canActivate: [permissionGuard(['reports.view'])] },
            { path: 'inventory-reports', loadComponent: () => import('./app/pages/inventory-reports/inventory-reports').then((m) => m.InventoryReportsComponent), canActivate: [permissionGuard(['reports.view'])] },
            {
                path: 'inventory-reports/manual-editor',
                loadComponent: () => import('./app/pages/inventory-reports/manual-ipv-editor').then((m) => m.ManualIvpEditorComponent),
                canActivate: [permissionGuard(['tpv.manage'])]
            },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes'), canActivate: [permissionGuard(['dashboard.view'])] }
        ]
    },
    { path: 'landing', loadComponent: () => import('./app/pages/landing/landing').then((m) => m.Landing) },
    { path: 'notfound', loadComponent: () => import('./app/pages/notfound/notfound').then((m) => m.Notfound) },
    { path: '**', redirectTo: '/notfound' }
];
