# Endpoints de la API REST

## Base URL
`http://localhost:3021/api`

## Autenticación

### Login
```bash
POST /api/auth/login
```

Payload:
```json
{
  "email": "admin@pos.local",
  "password": "Admin123!"
}
```

Respuesta:
```json
{
  "access_token": "...",
  "user": {
    "id": "cm...",
    "email": "admin@pos.local",
    "role": "ADMIN"
  }
}
```

---

## Usuarios

- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:id`

---

## Productos

- `GET /api/products`
- `POST /api/products` (JSON o multipart/form-data)
- `PUT /api/products/:id` (JSON o multipart/form-data)
- `DELETE /api/products/:id`

Campos principales:
- `name` (requerido)
- `price` (requerido, string decimal)
- `currency` (`CUP` | `USD`)
- `codigo`, `barcode`, `cost`, `productTypeId`, `productCategoryId`, `measurementUnitId`, `image`

---

## Registers (TPV)

- `GET /api/registers`
- `POST /api/registers`
- `PUT /api/registers/:id`
- `DELETE /api/registers/:id`

---

## Sesiones de Caja (TPV)

- `GET /api/cash-sessions`
- `GET /api/cash-sessions/:id`
- `GET /api/cash-sessions/open?registerId=:registerId`
- `POST /api/cash-sessions/open`
- `POST /api/cash-sessions/:id/close`
- `GET /api/cash-sessions/:id/summary`

### Abrir caja
```bash
POST /api/cash-sessions/open
```

```json
{
  "registerId": "reg_xxx",
  "openingAmount": "1000.00",
  "note": "Apertura turno mañana"
}
```

### Cerrar caja
```bash
POST /api/cash-sessions/:id/close
```

```json
{
  "closingAmount": "2500.00",
  "note": "Cierre turno mañana"
}
```

---

## Ventas TPV

### Listar productos disponibles de una sesión TPV abierta
```bash
GET /api/sales/session/:cashSessionId/products
```

### Crear venta TPV
```bash
POST /api/sales
```

```json
{
  "cashSessionId": "sess_xxx",
  "items": [
    { "productId": "prod_1", "qty": 2 },
    { "productId": "prod_2", "qty": 1 }
  ],
  "payments": [
    { "method": "CASH", "amountOriginal": "500.00", "currency": "CUP" },
    { "method": "CARD", "amountOriginal": "5.00", "currency": "USD" }
  ]
}
```

Notas:
- La venta TPV requiere sesión de caja abierta.
- Se descuenta inventario del almacén TPV asociado.
- Se registra `channel = TPV` y comprobante `documentNumber`.

---

## Ventas Directas (nuevo)

Flujo de ventas sin caja TPV/IPV, usando almacenes no-TPV.

### Listar productos disponibles por almacén no-TPV
```bash
GET /api/direct-sales/warehouse/:warehouseId/products
```

### Crear venta directa
```bash
POST /api/direct-sales
```

```json
{
  "warehouseId": "wh_xxx",
  "customerName": "Cliente Mostrador",
  "items": [
    { "productId": "prod_1", "qty": 2 }
  ],
  "payments": [
    { "method": "CASH", "amountOriginal": "320.00", "currency": "CUP" }
  ]
}
```

### Obtener ticket/comprobante de una venta directa
```bash
GET /api/direct-sales/:saleId/ticket
```

Notas:
- Solo acepta `warehouse.type != TPV`.
- No crea ni requiere `cashSessionId`.
- Descuenta stock y crea `StockMovement` con razón `VENTA_DIRECTA`.
- Registra `channel = DIRECT` y `documentNumber`.

---

## IPV (Inventario por Sesión TPV)

- `GET /api/inventory-reports/session/:cashSessionId/ipv`
- `GET /api/inventory-reports/session/:cashSessionId`
- `GET /api/inventory-reports/session/:cashSessionId/latest`
- `GET /api/inventory-reports/warehouse/:warehouseId`
- `GET /api/inventory-reports/:id`

> El modelo actual opera con un IPV consolidado por sesión TPV.

---

## Almacenes

- `GET /api/warehouses`
- `POST /api/warehouses`
- `GET /api/warehouses/:id`
- `PUT /api/warehouses/:id`
- `DELETE /api/warehouses/:id` (soft delete)
- `GET /api/warehouses/:id/stock`

---

## Movimientos de Stock

- `GET /api/stock-movements`
- `POST /api/stock-movements`

Payload base:
```json
{
  "type": "IN",
  "productId": "prod_xxx",
  "qty": 10,
  "toWarehouseId": "wh_xxx",
  "reason": "Ajuste"
}
```

---

## Configuración

### Sistema
- `GET /api/settings/system`
- `PUT /api/settings/system`
- `GET /api/settings/exchange-rates?limit=50`

### Register (TPV)
- `GET /api/settings/register/:registerId`
- `PUT /api/settings/register/:registerId`

### Catálogos de config
- `GET /api/settings/payment-methods`
- `PUT /api/settings/payment-methods`
- `GET /api/settings/denominations?registerId=:id&currency=:CUP|USD`
- `PUT /api/settings/denominations`

---

## Reportes y Dashboard

- `GET /api/reports/server-date`
- `GET /api/reports/sales?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/dashboard/summary`

---

## Health

- `GET /api/health`

Respuesta:
```json
{
  "ok": true,
  "service": "pos-api"
}
```
