# Endpoints de la API REST

## Base URL
```
http://localhost:3021/api
```

## Autenticación

### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@pos.local",
  "password": "Admin123!"
}
```

**Respuesta exitosa (200):**
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

---

## Usuarios

### Listar usuarios
```bash
GET /api/users
Authorization: Bearer <token>
```

**Respuesta:**
```json
[
  {
    "id": "cmli...",
    "email": "admin@pos.local",
    "role": "ADMIN",
    "createdAt": "2026-01-25T21:26:42.000Z"
  }
]
```

### Crear usuario
```bash
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "nuevo@pos.local",
  "password": "Password123!",
  "role": "USER"
}
```

### Actualizar usuario
```bash
PUT /api/users/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "actualizado@pos.local"
}
```

---

## Productos

### Listar productos
```bash
GET /api/products
Authorization: Bearer <token>
```

### Crear producto
```bash
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Producto Nuevo",
  "price": 100.00,
  "sku": "PROD-001"
}
```

### Actualizar producto
```bash
PUT /api/products/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Producto Actualizado",
  "price": 150.00
}
```

---

## Ventas

### Crear venta
```bash
POST /api/sales
Authorization: Bearer <token>
Content-Type: application/json

{
  "registerId": "reg_xxx",
  "items": [
    {
      "productId": "prod_xxx",
      "quantity": 2,
      "unitPrice": 100.00,
      "subtotal": 200.00
    }
  ],
  "total": 200.00,
  "paymentMethod": "CASH"
}
```

---

## Cajas (Cash Sessions)

### Abrir caja
```bash
POST /api/cash-sessions/open
Authorization: Bearer <token>
Content-Type: application/json

{
  "registerId": "reg_xxx",
  "initialAmount": 1000.00
}
```

### Cerrar caja
```bash
POST /api/cash-sessions/:id/close
Authorization: Bearer <token>
Content-Type: application/json

{
  "finalAmount": 2500.00,
  "notes": "Cierre de jornada"
}
```

### Ver caja abierta
```bash
GET /api/cash-sessions/open
Authorization: Bearer <token>
```

---

## Almacenes (Warehouses)

### Listar almacenes
```bash
GET /api/warehouses
Authorization: Bearer <token>
```

### Crear almacén
```bash
POST /api/warehouses
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Almacén Central",
  "address": "Calle Principal 123"
}
```

### Ver stock de almacén
```bash
GET /api/warehouses/:id/stock
Authorization: Bearer <token>
```

---

## Movimientos de Stock

### Listar movimientos
```bash
GET /api/stock-movements
Authorization: Bearer <token>
```

### Crear movimiento
```bash
POST /api/stock-movements
Authorization: Bearer <token>
Content-Type: application/json

{
  "warehouseId": "ware_xxx",
  "productId": "prod_xxx",
  "type": "IN",
  "quantity": 50,
  "reason": "Compra de inventario"
}
```

---

## Configuración

### Obtener configuración de caja
```bash
GET /api/settings/register/:registerId
Authorization: Bearer <token>
```

### Actualizar configuración de caja
```bash
PUT /api/settings/register/:registerId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Caja Principal",
  "allowNegativeStock": false
}
```

### Métodos de pago
```bash
GET /api/settings/payment-methods
PUT /api/settings/payment-methods
```

### Denominaciones
```bash
GET /api/settings/denominations
PUT /api/settings/denominations
```

---

## Dashboard

### Resumen del dashboard
```bash
GET /api/dashboard/summary
Authorization: Bearer <token>
```

---

## Reportes

### Reporte de ventas
```bash
GET /api/reports/sales?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer <token>
```

---

## Salud (Health Check)

```bash
GET /api/health
```

**Respuesta:**
```json
{
  "ok": true,
  "service": "pos-api"
}
```
