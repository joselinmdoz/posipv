# Rutas del Frontend

## Estructura de Rutas

El proyecto utiliza Angular Router con **lazy loading** para cargar los módulos de forma perezosa y mejorar el rendimiento.

### Archivo Principal de Rutas

```typescript
// pos_web/src/app.routes.ts
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
```

---

## Rutas Públicas

### /auth/login
- **Componente:** Login
- **Descripción:** Página de inicio de sesión
- **Acceso:** Público (sin autenticación)

### /auth/access
- **Componente:** Access
- **Descripción:** Página de acceso denegado

### /auth/error
- **Componente:** Error
- **Descripción:** Página de error

---

## Rutas Protegidas

Todas las rutas dentro del `AppLayout` requieren autenticación.

### /
- **Componente:** Dashboard
- **Descripción:** Panel principal
- **Requiere:** Autenticación

### /uikit
- **Carga:** Lazy loading
- **Descripción:** Componentes UI de PrimeNG
- **Requiere:** Autenticación

### /documentation
- **Componente:** Documentation
- **Descripción:** Documentación de la aplicación
- **Requiere:** Autenticación

### /pages
- **Carga:** Lazy loading
- **Descripción:** Páginas adicionales
- **Requiere:** Autenticación

---

## Rutas Especiales

### /landing
- **Componente:** Landing
- **Descripción:** Página de landing pública
- **Acceso:** Público

### /notfound
- **Componente:** Notfound
- **Descripción:** Página 404
- **Acceso:** Público

### /**
- **Comportamiento:** Redirige a /notfound

---

## Guard de Autenticación

### Implementación

```typescript
// pos_web/src/app.routes.ts
const authGuard = () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    
    if (authService.isAuthenticated()) {
        return true;
    }
    
    return router.createUrlTree(['/auth/login']);
};
```

### Funcionamiento

1. Cuando el usuario intenta acceder a una ruta protegida
2. El guard verifica si hay un token en localStorage
3. Si existe token y es válido, permite el acceso
4. Si no existe, redirige a /auth/login

---

## Lazy Loading

El proyecto utiliza lazy loading para optimizar el rendimiento:

```typescript
{ path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') }
{ path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') }
{ path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
```

---

## Navegación

### Desde el Template

```html
<!-- RouterLink sin reload -->
<a routerLink="/">Inicio</a>

<!-- RouterLink con parámetros -->
<a [routerLink]="['/product', product.id]">Ver producto</a>

<!-- Redirección programática -->
<button (click)="goToDashboard()">Dashboard</button>
```

### Desde TypeScript

```typescript
import { Router } from '@angular/router';

constructor(private router: Router) {}

navigateToDashboard() {
    this.router.navigate(['/']);
}

navigateToProduct(id: string) {
    this.router.navigate(['/product', id]);
}
```

---

## Rutas Hijas (Auth)

```typescript
// pos_web/src/app/pages/auth/auth.routes.ts
export default [
    { path: 'access', component: Access },
    { path: 'error', component: Error },
    { path: 'login', component: Login }
] as Routes;
```

---

## Ejemplos de curl

### Proteger ruta con token

```bash
curl http://localhost:4200/ \
  -H "Authorization: Bearer <tu_token_jwt>"
```

### Acceder a ruta de login

```bash
curl http://localhost:4200/auth/login
```
