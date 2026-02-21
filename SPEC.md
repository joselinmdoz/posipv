# Sistema POS - Especificación del Proyecto

## Descripción General

Nuestra aplicación de Punto de Venta (POS) está diseñada para ofrecer una solución robusta y flexible para la gestión de inventarios y operaciones comerciales. Desarrollada con tecnologías de vanguardia como Angular 21, NestJS y PostgreSQL 16, esta plataforma ofrece un alto rendimiento y escalabilidad para empresas de todos los tamaños.

---

## Características Principales

### 1. Dashboard Intuitivo ✅
- Al iniciar sesión, los usuarios acceden a un panel de control centralizado
- Proporciona una visión clara del estado del negocio
- Navegación rápida a diferentes vistas
- Gestión de productos y seguimiento de ventas y movimientos

### 2. Gestión de Inventarios y Almacenes ✅
- Administrar uno o más puntos de venta (TPV)
- Control completo de productos y movimientos entre almacenes
- Crear almacenes centrales que distribuyen productos a los TPV
- Visibilidad en tiempo real del stock disponible

### 3. Configuraciones Personalizables
- Vista exclusiva para administradores
- Gestionar configuración de cada TPV
- Parámetros: fondo de caja, denominaciones de billets

### 4. Métodos de Pago y Denominaciones de Monedas
- Gestión completa de métodos de pago
- Gestión de denominaciones de monedas
- Asegurar correcta manipulación de transacciones

### 5. Gestión de Usuarios ✅
- Crear y administrar perfiles de usuarios
- Diferentes permisos (ADMIN, CASHIER)
- Solo administradores acceden a configuraciones sensibles
- Restablecer contraseñas

### 6. Cierre y Apertura de Caja ✅
- Configurar fondo inicial de caja para cambio (no incluido en reportes)
- Registrar total de efectivo al final del día
- Registro por denominaciones de billetes

### 7. Funcionalidades de TPV ✅

#### Entrada y Salida de Productos ✅
- Entrada y salida de productos al almacén
- Especificar motivo y cantidad

#### Movimientos de Dinero
- Movimientos de dinero en la caja
- Especificar motivo

#### Reportes de Ventas
- Agrupadas por productos

### 8. Informes de Inventario (IPV)
- Generados en cada sesión del TPV
- Informes iniciales y finales del inventario
- Control preciso de entradas, salidas y ventas
- Detalles: precio de venta, importe total, valor final

---

## Estado de Implementación

### Backend (NestJS + Prisma + PostgreSQL)
| Módulo | Estado | Descripción |
|--------|--------|-------------|
| Auth | ✅ Completo | JWT authentication, roles |
| Users | ✅ Completo | CRUD, reset password |
| Products | ✅ Completo | CRUD, imágenes |
| Warehouses | ✅ Completo | CRUD, stock, movimientos |
| Registers | ✅ Completo | CRUD de TPV |
| Cash Sessions | ✅ Completo | Apertura/cierre |
| Sales | ✅ Completo | Crear ventas |
| Stock Movements | ✅ Completo | Entrada/salida/transferencia |
| Reports | ✅ Parcial | Endpoints existentes |
| Settings | ✅ Parcial | Configuraciones |

### Frontend (Angular 21 + PrimeNG)
| Módulo | Estado | Ruta |
|--------|--------|------|
| Login | ✅ Completo | /auth/login |
| Dashboard | ✅ Básico | / |
| Usuarios | ✅ Completo | /users |
| Productos | ✅ Completo | /products |
| Almacenes | ✅ Completo | /warehouses |
| TPV | ✅ Completo | /tpv |
| Reportes | ⏳ Pendiente | - |
| Configuraciones | ⏳ Pendiente | - |

---

## Tecnologías

- **Frontend**: Angular 21, PrimeNG, PrimeFlex
- **Backend**: NestJS, Prisma ORM
- **Base de Datos**: PostgreSQL 16
- **Autenticación**: JWT

---

## Roles de Usuario

| Rol | Descripción |
|-----|-------------|
| ADMIN | Acceso completo a todas las funcionalidades y configuraciones |
| CASHIER | Acceso a operaciones de venta y TPV |

---

## Modelos de Datos Principales

- **User**: Usuarios del sistema
- **Register (TPV)**: Puntos de venta
- **CashSession**: Sesiones de caja
- **Product**: Productos
- **Sale**: Ventas
- **SaleItem**: Items de venta
- **Payment**: Pagos
- **Warehouse**: Almacenes
- **Stock**: Stock por almacén
- **StockMovement**: Movimientos de stock
- **RegisterSettings**: Configuraciones del TPV
- **Denomination**: Denominaciones de dinero
- **PaymentMethodSetting**: Métodos de pago

---

## Rutas de la API

### Autenticación
- `POST /api/auth/login` - Iniciar sesión

### Usuarios
- `GET /api/users` - Listar usuarios
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario
- `POST /api/users/:id/reset-password` - Restablecer contraseña

### Productos
- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto

### Almacenes
- `GET /api/warehouses` - Listar almacenes
- `GET /api/warehouses/:id` - Obtener almacén
- `POST /api/warehouses` - Crear almacén
- `PUT /api/warehouses/:id` - Actualizar almacén
- `DELETE /api/warehouses/:id` - Eliminar almacén
- `GET /api/warehouses/:id/stock` - Ver stock

### Movimientos de Stock
- `GET /api/stock-movements` - Listar movimientos
- `POST /api/stock-movements` - Crear movimiento

### Sesiones de Caja
- `GET /api/cash-sessions/open?registerId=` - Obtener sesión abierta
- `POST /api/cash-sessions/open` - Abrir caja
- `POST /api/cash-sessions/:id/close` - Cerrar caja

### Ventas
- `POST /api/sales` - Crear venta

### Registros (TPV)
- `GET /api/registers` - Listar TPV
- `POST /api/registers` - Crear TPV
- `PUT /api/registers/:id` - Actualizar TPV
- `DELETE /api/registers/:id` - Eliminar TPV

---

## Estructura de Archivos

```
posipv/
├── SPEC.md                    # Este archivo
├── pos_api/                   # Backend NestJS
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── products/
│   │   │   ├── warehouses/
│   │   │   ├── cash-sessions/
│   │   │   ├── sales/
│   │   │   └── ...
│   │   └── prisma/
│   │       └── schema.prisma
│   └── package.json
│
└── pos_web/                   # Frontend Angular
    ├── src/
    │   ├── app/
    │   │   ├── core/
    │   │   │   └── services/
    │   │   │       ├── auth.service.ts
    │   │   │       ├── users.service.ts
    │   │   │       ├── products.service.ts
    │   │   │       ├── warehouses.service.ts
    │   │   │       └── pos.service.ts
    │   │   ├── pages/
    │   │   │   ├── users/
    │   │   │   ├── products/
    │   │   │   ├── warehouses/
    │   │   │   └── tpv/
    │   │   └── layout/
    │   └── app.routes.ts
    └── package.json
```

---

## Pendiente por Implementar

1. **Reportes de Ventas** - Generación de reportes por período
2. **Configuraciones del TPV** - Denominaciones, métodos de pago
3. **IPV (Informes de Inventario)** - Informes inicial/final de sesión
4. **Dashboard Mejorado** - Métricas y estadísticas
5. **Módulo de Configuración** - Parámetros del sistema

---

## Notas de Desarrollo

- El proyecto usa señales (signals) de Angular para estado reactivo
- PrimeNG 19+ para componentes de UI
- Autenticación con JWT
- Backend con Prisma ORM
- Base de datos PostgreSQL
