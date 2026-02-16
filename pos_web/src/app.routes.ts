import { Routes } from '@angular/router';
import { AppLayout } from './app/layout/component/app.layout';
import { Dashboard } from './app/pages/dashboard/dashboard';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
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
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound },
    { path: '**', redirectTo: '/notfound' }
];
