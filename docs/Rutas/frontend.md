# Rutas del Frontend

## Estructura real de rutas (`pos_web/src/app.routes.ts`)

```typescript
export const appRoutes: Routes = [
  { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: Dashboard },
      { path: 'users', component: Users },
      { path: 'products', component: Products },
      { path: 'product-types', component: ProductTypes },
      { path: 'product-categories', component: ProductCategories },
      { path: 'measurement-units', component: MeasurementUnits },
      { path: 'warehouses', component: Warehouses },
      { path: 'tpv-management', component: TpvManagement },
      { path: 'tpv', component: Tpv },
      { path: 'settings', component: Settings },
      { path: 'denominations', component: Denominations },
      { path: 'reports', component: Reports },
      { path: 'inventory-reports', component: InventoryReportsComponent },
      { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') },
      { path: 'documentation', component: Documentation },
      { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
    ]
  },
  { path: 'landing', component: Landing },
  { path: 'notfound', component: Notfound },
  { path: '**', redirectTo: '/notfound' }
];
```

---

## Rutas publicas

- `/auth/login`: inicio de sesion.
- `/auth/access`: acceso denegado.
- `/auth/error`: pagina de error.
- `/landing`: landing publica.
- `/notfound`: pagina 404.

---

## Rutas protegidas (requieren JWT)

- `/`: dashboard principal.
- `/tpv-management`: administracion de TPV y acceso a sesion.
- `/tpv`: punto de venta activo.
- `/inventory-reports`: consulta de IPV por sesion.
- `/products`, `/warehouses`, `/settings`, `/reports`, etc.

---

## Flujos nuevos de navegacion (2026-02-23)

### 1) Apertura directa de sesion desde TPV management

Desde `/tpv-management`, el boton `Abrir sesion`:

1. valida estado del TPV,
2. intenta abrir sesion con el fondo por defecto configurado,
3. navega a `/tpv?action=continue&registerId=<id>`.

Si el TPV ya tenia sesion abierta, navega directo a `/tpv` con `action=continue`.

### 2) Parametros de entrada a `/tpv`

- `registerId`: TPV a cargar.
- `action=open`: abrir modal de apertura.
- `action=continue`: intentar continuar sesion existente.

### 3) Salida al cerrar sesion de caja

Al cerrar sesion desde `/tpv`, la aplicacion redirige automaticamente a:

- `/tpv-management`

### 4) Reporte IPV por sesion

Desde `/tpv` y desde `/inventory-reports` se abre el mismo esquema de detalle IPV:

- resumen de ventas/entradas/salidas,
- totales por metodo de pago,
- tabla de lineas,
- pie con solo `Total Importe`.

---

## Guard de autenticacion

El `authGuard` valida `authService.isAuthenticated()`.  
Sin token valido, redirige a `/auth/login`.
