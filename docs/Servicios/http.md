# Servicios HTTP del Frontend

## Configuración

### app.config.ts
Archivo principal de configuración de Angular.

```typescript
// pos_web/src/app.config.ts
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { appRoutes } from './app.routes';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
    providers: [
        provideRouter(appRoutes),
        provideHttpClient(
            withFetch(),                    // Usar fetch API
            withInterceptors([authInterceptor]) // Agregar interceptor
        ),
        provideZonelessChangeDetection(),
        providePrimeNG({ theme: { preset: Aura } })
    ]
};
```

---

## Servicio de Autenticación

### auth.service.ts
Maneja la autenticación del usuario.

```typescript
// pos_web/src/app/core/services/auth.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

export interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    role: string;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API_URL = 'http://localhost:3021/api';
  
  // Signals
  private _currentUser = signal<LoginResponse['user'] | null>(null);
  private _isAuthenticated = signal<boolean>(false);
  
  readonly currentUser = computed(() => this._currentUser());
  readonly isAuthenticated = computed(() => this._isAuthenticated());

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.checkAuthStatus();
  }

  login(email: string, password: string) {
    return this.http.post<LoginResponse>(
      `${this.API_URL}/auth/login`, 
      { email, password }
    ).pipe(
      tap(response => {
        localStorage.setItem('access_token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));
        this._currentUser.set(response.user);
        this._isAuthenticated.set(true);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    this._currentUser.set(null);
    this._isAuthenticated.set(false);
    this.router.navigate(['/auth/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('access_token');
  }
}
```

---

## Interceptor de Autenticación

### auth.interceptor.ts
Agrega el token JWT a todas las peticiones HTTP.

```typescript
// pos_web/src/app/core/interceptors/auth.interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';

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

---

## Ejemplos de Uso

### Login con éxito
```typescript
const authService = inject(AuthService);

authService.login('admin@pos.local', 'Admin123!').subscribe({
  next: () => {
    console.log('Login exitoso');
    this.router.navigate(['/']);
  },
  error: (err) => {
    console.error('Error:', err.message);
  }
});
```

### Verificar autenticación
```typescript
const authService = inject(AuthService);

if (authService.isAuthenticated()) {
  const user = authService.currentUser();
  console.log('Usuario:', user?.email);
}
```

### Cerrar sesión
```typescript
const authService = inject(AuthService);
authService.logout();
```

---

## Servicios de Datos (Ejemplo)

### Product Service
```typescript
// pos_web/src/app/pages/service/product.service.ts
@Injectable()
export class ProductService {
  constructor(private http: HttpClient) {}

  getProducts() {
    return this.http.get<Product[]>('/api/products');
  }

  getProduct(id: string) {
    return this.http.get<Product>(`/api/products/${id}`);
  }

  createProduct(product: CreateProductDto) {
    return this.http.post<Product>('/api/products', product);
  }

  updateProduct(id: string, product: UpdateProductDto) {
    return this.http.put<Product>(`/api/products/${id}`, product);
  }

  deleteProduct(id: string) {
    return this.http.delete(`/api/products/${id}`);
  }
}
```

---

## Patrón de Servicios

### Inyección de Dependencias
```typescript
// En un componente
@Component({...})
export class MiComponente {
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  
  ngOnInit() {
    // Obtener productos
    this.productService.getProducts().subscribe(...);
    
    // Verificar usuario
    const user = this.authService.currentUser();
  }
}
```

---

## Headers Automáticos

Gracias al interceptor, todas las peticiones incluyen:

```http
Authorization: Bearer <tu_token_jwt>
Content-Type: application/json
```

### Ejemplo de petición
```bash
# El interceptor agrega automáticamente el token
GET /api/products
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## Manejo de Errores

### Ejemplo con catchError
```typescript
import { catchError, of } from 'rxjs';

this.http.get('/api/products').pipe(
  catchError(error => {
    console.error('Error:', error);
    return of([]); // Retorna array vacío en caso de error
  })
).subscribe(products => {
  // Manejar productos
});
```

---

## Configuración de CORS

El backend debe tener CORS configurado para permitir las peticiones del frontend.

```typescript
// pos_api/src/main.ts
app.enableCors({
  origin: ['http://localhost:4200'],
  credentials: true
});
```
