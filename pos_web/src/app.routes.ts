import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { Users } from './app/pages/users/users';
import { Products } from './app/pages/products/products';
import { Warehouses } from './app/pages/warehouses/warehouses';
import { Settings } from './app/pages/settings/settings';
import { Reports } from './app/pages/reports/reports';
import { InventoryReportsComponent } from './app/pages/inventory-reports/inventory-reports';
import { ProductTypes } from './app/pages/product-types/product-types';
import { ProductCategories } from './app/pages/product-categories/product-categories';
import { MeasurementUnits } from './app/pages/measurement-units/measurement-units';
import { Denominations } from './app/pages/denominations/denominations';
import { TpvManagement } from './app/pages/tpv-management/tpv-management';
import { Tpv } from './app/pages/tpv/tpv';
import { DirectSales } from './app/pages/direct-sales/direct-sales';
import { Purchases } from './app/pages/purchases/purchases';
import { Customers } from './app/pages/customers/customers';
import { Employees } from './app/pages/employees/employees';
import { AccountingChartOfAccounts } from './app/pages/accounting/accounting-chart-of-accounts';
import { AccountingFiscalPeriods } from './app/pages/accounting/accounting-fiscal-periods';
import { AccountingPostingRules } from './app/pages/accounting/accounting-posting-rules';
import { AccountingJournalEntries } from './app/pages/accounting/accounting-journal-entries';
import { AccountingAccountStatus } from './app/pages/accounting/accounting-account-status';
import { AccountingReports } from './app/pages/accounting/accounting-reports';
import { inject } from '@angular/core';
import { AuthService } from './app/core/services/auth.service';
import { Router } from '@angular/router';

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
        component: AppLayout,
        canActivate: [authGuard],
        children: [
            { path: '', component: Dashboard, canActivate: [permissionGuard(['dashboard.view'])] },
            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes'), canActivate: [permissionGuard(['dashboard.view'])] },
            { path: 'documentation', component: Documentation, canActivate: [permissionGuard(['dashboard.view'])] },
            { path: 'users', component: Users, canActivate: [permissionGuard(['users.manage', 'permissions.manage'])] },
            { path: 'products', component: Products, canActivate: [permissionGuard(['products.view'])] },
            { path: 'product-types', component: ProductTypes, canActivate: [permissionGuard(['products.manage'])] },
            { path: 'product-categories', component: ProductCategories, canActivate: [permissionGuard(['products.manage'])] },
            { path: 'measurement-units', component: MeasurementUnits, canActivate: [permissionGuard(['products.manage'])] },
            { path: 'warehouses', component: Warehouses, canActivate: [permissionGuard(['warehouses.view'])] },
            { path: 'tpv', component: Tpv, canActivate: [permissionGuard(['sales.tpv'])] },
            { path: 'tpv-management', component: TpvManagement, canActivate: [permissionGuard(['sales.tpv', 'tpv.manage'])] },
            { path: 'direct-sales', component: DirectSales, canActivate: [permissionGuard(['sales.direct'])] },
            { path: 'purchases', component: Purchases, canActivate: [permissionGuard(['purchases.view', 'purchases.manage'])] },
            { path: 'customers', component: Customers, canActivate: [permissionGuard(['customers.view'])] },
            { path: 'employees', component: Employees, canActivate: [permissionGuard(['employees.view'])] },
            { path: 'accounting', pathMatch: 'full', redirectTo: 'accounting/plan-cuentas' },
            {
                path: 'accounting/plan-cuentas',
                component: AccountingChartOfAccounts,
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/periodos-fiscales',
                component: AccountingFiscalPeriods,
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/reglas-contables',
                component: AccountingPostingRules,
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/asientos-contables',
                component: AccountingJournalEntries,
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/estado-cuentas',
                component: AccountingAccountStatus,
                canActivate: [permissionGuard(['accounting.view'])]
            },
            {
                path: 'accounting/reportes',
                component: AccountingReports,
                canActivate: [permissionGuard(['accounting.view'])]
            },
            { path: 'user-permissions', redirectTo: 'users', pathMatch: 'full' },
            { path: 'settings', component: Settings, canActivate: [permissionGuard(['settings.manage'])] },
            { path: 'denominations', component: Denominations, canActivate: [permissionGuard(['tpv.manage'])] },
            { path: 'reports', component: Reports, canActivate: [permissionGuard(['reports.view'])] },
            { path: 'inventory-reports', component: InventoryReportsComponent, canActivate: [permissionGuard(['reports.view'])] },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes'), canActivate: [permissionGuard(['dashboard.view'])] }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound },
    { path: '**', redirectTo: '/notfound' }
];
