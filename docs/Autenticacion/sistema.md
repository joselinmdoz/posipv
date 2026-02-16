# Sistema de Autenticación

## Visión General

El sistema de autenticación del proyecto POS IPv utiliza **JWT (JSON Web Tokens)** para la autenticación stateless. El flujo completo incluye:

1. El usuario envía credenciales al endpoint de login
2. El servidor valida las credenciales contra la base de datos
3. Si son válidas, genera un token JWT con la información del usuario
4. El frontend guarda el token en localStorage
5. Todas las peticiones subsecuentes incluyen el token en el header Authorization
6. El guard de rutas verifica la autenticación antes de permitir acceso

---

## Flujo de Login

### 1. Solicitud de Login

```bash
curl -X POST http://localhost:3021/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@pos.local",
    "password": "Admin123!"
  }'
```

### 2. Respuesta Exitosa

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cmli...",
    "email": "admin@pos.local",
    "role": "ADMIN"
  }
}
```

### 3. Guardar Token en el Frontend

El servicio de autenticación guarda el token en localStorage:

```typescript
// pos_web/src/app/core/services/auth.service.ts
localStorage.setItem('access_token', response.access_token);
localStorage.setItem('user', JSON.stringify(response.user));
```

---

## Protección de Rutas

### Guard de Autenticación

El proyecto implementa un guard que protege las rutas del frontend:

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

### Aplicación del Guard

```typescript
export const appRoutes: Routes = [
    {
        path: '',
        component: AppLayout,
        canActivate: [authGuard],  // Ruta protegida
        children: [
            { path: '', component: Dashboard },
            // ...
        ]
    },
    {
        path: 'auth',
        loadChildren: () => import('./app/pages/auth/auth.routes')
        // Rutas públicas (login, etc.)
    }
];
```

---

## Interceptor HTTP

### Agregar Token a Peticiones

Cada petición HTTP automáticamente incluye el token:

```typescript
// pos_web/src/app/core/interceptors/auth.interceptor.ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');
  
  if (token) {
    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });
    return next(cloned);
  }
  
  return next(req);
};
```

### Registro del Interceptor

```typescript
// pos_web/src/app.config.ts
provideHttpClient(
  withFetch(),
  withInterceptors([authInterceptor])
)
```

---

## Estructura del Token JWT

El token JWT contiene la siguiente información:

```json
{
  "sub": "cmli...",      // ID del usuario
  "role": "ADMIN",       // Rol del usuario
  "email": "admin@pos.local",
  "iat": 1771275483,     // Issued At
  "exp": 1771880238       // Expiration
}
```

---

## Manejo de Sesión

### Verificar Estado de Autenticación

```typescript
// En cualquier componente
const authService = inject(AuthService);

if (authService.isAuthenticated()) {
  // Usuario autenticado
  const user = authService.currentUser();
}
```

### Cerrar Sesión

```typescript
// Eliminar token y redirigir a login
authService.logout();
```

---

## Códigos de Respuesta

| Código | Descripción |
|--------|-------------|
| 200 | Login exitoso |
| 401 | Credenciales inválidas |
| 403 | Token válido pero sin permisos |
| 404 | Usuario no encontrado |

---

## Ejemplo Completo de Uso

### Login desde el Frontend

```typescript
// pos_web/src/app/pages/auth/login.ts
private authService = inject(AuthService);
private router = inject(Router);

onLogin() {
    this.authService.login(this.email, this.password).subscribe({
        next: () => {
            this.router.navigate(['/']);  // Redirigir al dashboard
        },
        error: (error) => {
            // Mostrar mensaje de error
        }
    });
}
```

### Verificar Acceso en Componente

```typescript
const authService = inject(AuthService);

// Verificar rol
if (authService.currentUser()?.role === 'ADMIN') {
    // Mostrar opciones de administrador
}
```
