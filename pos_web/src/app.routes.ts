import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { Users } from './app/pages/users/users';
import { Products } from './app/pages/products/products';
import { Warehouses } from './app/pages/warehouses/warehouses';
import { Tpv } from './app/pages/tpv/tpv';
import { Settings } from './app/pages/settings/settings';
import { Reports } from './app/pages/reports/reports';
import { InventoryReportsComponent } from './app/pages/inventory-reports/inventory-reports';
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
            { path: '', component: Dashboard },
            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') },
            { path: 'documentation', component: Documentation },
            { path: 'users', component: Users },
            { path: 'products', component: Products },
            { path: 'warehouses', component: Warehouses },
            { path: 'tpv', component: Tpv },
            { path: 'settings', component: Settings },
            { path: 'reports', component: Reports },
            { path: 'inventory-reports', component: InventoryReportsComponent },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound },
    { path: '**', redirectTo: '/notfound' }
];
