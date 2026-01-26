import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { registerGuard } from './guards/register.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },

  // Core
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'tpv',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/register/register.component').then((m) => m.TPVComponent),
  },
  {
    path: 'pos',
    canActivate: [authGuard, registerGuard],
    loadComponent: () => import('./pages/pos/pos.component').then((m) => m.PosComponent),
  },
  {
    path: 'cash',
    canActivate: [authGuard, registerGuard],
    loadComponent: () => import('./pages/cash/cash.component').then((m) => m.CashComponent),
  },

  // Inventory
  {
    path: 'products',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/products/products.component').then((m) => m.ProductsComponent),
  },
  {
    path: 'warehouses',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/warehouses/warehouses.component').then((m) => m.WarehousesComponent),
  },
  {
    path: 'stock-movements',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/stock-movements/stock-movements.component').then((m) => m.StockMovementsComponent),
  },
  {
    path: 'ipv-initial',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/ipv-initial/ipv-initial.component').then((m) => m.IpvInitialComponent),
  },

  // Reports
  {
    path: 'reports/sales',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/reports/sales-report.component').then((m) => m.SalesReportComponent),
  },
  {
    path: 'reports/ipv',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/reports/ipv-report.component').then((m) => m.IpvReportComponent),
  },

  // Settings
  {
    path: 'settings',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/settings/tpv-settings.component').then((m) => m.TpvSettingsComponent),
  },
  {
    path: 'settings/payment-methods',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/settings/payment-methods.component').then((m) => m.PaymentMethodsComponent),
  },
  {
    path: 'settings/denominations',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/settings/denominations.component').then((m) => m.DenominationsComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () => import('./pages/users/users.component').then((m) => m.UsersComponent),
  },

  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
