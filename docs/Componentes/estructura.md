# Componentes del Frontend

## Estructura del Proyecto

```
pos_web/src/app/
├── app.component.ts          # Componente raíz
├── app.config.ts            # Configuración de la aplicación
├── app.routes.ts            # Rutas principales
├── core/
│   ├── services/
│   │   └── auth.service.ts # Servicio de autenticación
│   └── interceptors/
│       └── auth.interceptor.ts # Interceptor HTTP
├── layout/
│   └── component/
│       ├── app.layout.ts    # Layout principal
│       ├── app.topbar.ts    # Barra superior
│       ├── app.sidebar.ts   # Barra lateral
│       ├── app.menu.ts      # Menú de navegación
│       └── app.configurator.ts # Configurador de tema
└── pages/
    ├── auth/
    │   ├── login.ts         # Página de login
    │   ├── access.ts       # Acceso denegado
    │   └── error.ts        # Página de error
    ├── dashboard/
    │   └── dashboard.ts    # Panel principal
    ├── pages.routes.ts     # Rutas de páginas
    └── ...
```

---

## Componentes Principales

### AppComponent
Componente raíz de la aplicación.

```typescript
// pos_web/src/app.component.ts
@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent {}
```

**Responsabilidad:** Renderizar las rutas dinámicas.

---

### AppLayout
Layout principal con sidebar, topbar y contenido.

```typescript
// pos_web/src/app/layout/component/app.layout.ts
@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [AppComponent, AppTopbar, AppSidebar, AppFooter],
    template: `
        <div class="layout-wrapper">
            <app-topbar></app-topbar>
            <app-sidebar></app-sidebar>
            <div class="layout-main">
                <router-outlet></router-outlet>
            </div>
            <app-footer></app-footer>
        </div>
    `
})
export class AppLayout {}
```

---

### AppTopbar
Barra superior con información del usuario y menú.

```typescript
// pos_web/src/app/layout/component/app.topbar.ts
@Component({
    selector: 'app-topbar',
    template: `
        <div class="topbar">
            <!-- Logo y título -->
            <div class="topbar-left">
                <span class="app-title">POS System</span>
            </div>
            
            <!-- Menú de usuario -->
            <div class="topbar-right">
                <span class="user-name">{{ user?.email }}</span>
                <button (click)="logout()">Cerrar sesión</button>
            </div>
        </div>
    `
})
export class AppTopbar {
    private authService = inject(AuthService);
    user = this.authService.currentUser();
    
    logout() {
        this.authService.logout();
    }
}
```

---

### AppSidebar
Barra lateral de navegación.

```typescript
// pos_web/src/app/layout/component/app.sidebar.ts
@Component({
    selector: 'app-sidebar',
    template: `
        <div class="sidebar">
            <app-menu></app-menu>
        </div>
    `
})
export class AppSidebar {}
```

---

### AppMenu
Menú de navegación principal.

```typescript
// pos_web/src/app/layout/component/app.menu.ts
@Component({
    selector: 'app-menu',
    template: `
        <ul class="menu-list">
            <li><a routerLink="/">Dashboard</a></li>
            <li><a routerLink="/pages">Páginas</a></li>
            <li><a routerLink="/uikit">UI Kit</a></li>
            <li><a routerLink="/documentation">Documentación</a></li>
        </ul>
    `
})
export class AppMenu {}
```

---

## Páginas

### Login
Página de inicio de sesión.

```typescript
// pos_web/src/app/pages/auth/login.ts
@Component({
    selector: 'app-login',
    standalone: true,
    imports: [
        ButtonModule, 
        InputTextModule, 
        PasswordModule,
        FormsModule,
        RouterModule,
        ToastModule
    ],
    template: `
        <div class="login-container">
            <input pInputText [(ngModel)]="email" placeholder="Email" />
            <p-password [(ngModel)]="password" placeholder="Password" />
            <p-button label="Sign In" (onClick)="onLogin()" />
        </div>
        <p-toast></p-toast>
    `
})
export class Login {
    email = '';
    password = '';
    private authService = inject(AuthService);
    private router = inject(Router);
    
    onLogin() {
        this.authService.login(this.email, this.password).subscribe({
            next: () => this.router.navigate(['/']),
            error: (err) => this.showError(err.message)
        });
    }
}
```

---

### Dashboard
Página del panel principal.

```typescript
// pos_web/src/app/pages/dashboard/dashboard.ts
@Component({
    selector: 'app-dashboard',
    standalone: true,
    template: `
        <div class="dashboard">
            <h1>Dashboard</h1>
            <div class="stats-grid">
                <!-- Widgets de estadísticas -->
            </div>
        </div>
    `
})
export class Dashboard {}
```

---

## Componentes de PrimeNG

###常用 Componentes

| Componente | Módulo | Descripción |
|------------|--------|-------------|
| Button | ButtonModule | Botones |
| InputText | InputTextModule | Campos de texto |
| Password | PasswordModule | Campos de contraseña |
| Checkbox | CheckboxModule | Casillas de verificación |
| Toast | ToastModule | Mensajes emergentes |
| Table | TableModule | Tablas de datos |
| Dialog | DialogModule | Ventanas modales |
| Menu | MenuModule | Menús |
| Chart | ChartModule | Gráficos |

### Ejemplo de Uso

```typescript
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

@Component({
    standalone: true,
    imports: [ButtonModule, InputTextModule],
    template: `
        <span class="p-input-icon-left">
            <i class="pi pi-search"></i>
            <input pInputText placeholder="Buscar" />
        </span>
        <p-button label="Guardar"></p-button>
    `
})
export class MiComponente {}
```

---

## Servicios del Proyecto

### AuthService
Manejo de autenticación.

```typescript
// Ubicación: pos_web/src/app/core/services/auth.service.ts
// Métodos principales:
// - login(email, password): Observable<LoginResponse>
// - logout(): void
// - isAuthenticated(): boolean
// - currentUser(): User | null
// - getToken(): string | null
```

---

## Configuración de Estilos

### TailwindCSS
El proyecto usa TailwindCSS para estilos.

```css
/* pos_web/src/assets/tailwind.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Temas PrimeNG
Configuración de temas en app.config.ts:

```typescript
providePrimeNG({ 
    theme: { 
        preset: Aura,
        options: { darkModeSelector: '.app-dark' } 
    } 
})
```

---

## Lazy Loading

Los módulos se cargan de forma perezosa:

```typescript
// app.routes.ts
{ 
    path: 'uikit', 
    loadChildren: () => import('./app/pages/uikit/uikit.routes') 
}
{ 
    path: 'auth', 
    loadChildren: () => import('./app/pages/auth/auth.routes') 
}
```
