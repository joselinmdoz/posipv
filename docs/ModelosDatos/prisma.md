# Modelos de Datos - Prisma Schema

## Enumeraciones

### Role
Roles de usuario en el sistema.
```prisma
enum Role {
  ADMIN      // Administrador con acceso completo
  CASHIER   // Cajero con acceso limitado
}
```

### CashSessionStatus
Estado de una sesión de caja.
```prisma
enum CashSessionStatus {
  OPEN   // Caja abierta
  CLOSED // Caja cerrada
}
```

### SaleStatus
Estado de una venta.
```prisma
enum SaleStatus {
  PAID  // Pagada
  VOID  // Anulada
}
```

### PaymentMethod
Métodos de pago disponibles.
```prisma
enum PaymentMethod {
  CASH     // Efectivo
  CARD     // Tarjeta
  TRANSFER // Transferencia
  OTHER    // Otro
}
```

### WarehouseType
Tipo de almacén.
```prisma
enum WarehouseType {
  CENTRAL // Almacén central
  TPV     // Almacén de punto de venta
}
```

### StockMovementType
Tipo de movimiento de stock.
```prisma
enum StockMovementType {
  IN       // Entrada
  OUT      // Salida
  TRANSFER // Transferencia
}
```

---

## Modelos

### User
Usuario del sistema.
```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  role         Role     @default(CASHIER)
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())

  cashSessions CashSession[]
  sales        Sale[]
}
```

**Relaciones:**
- Un usuario puede tener múltiples sesiones de caja
- Un usuario puede tener múltiples ventas

---

### Register
Caja registradora del POS.
```prisma
model Register {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique @default(cuid())
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  cashSessions CashSession[]
  settings     RegisterSettings?
  warehouse    Warehouse?
}
```

**Relaciones:**
- Un register puede tener múltiples sesiones de caja
- Un register puede tener una configuración
- Un register puede tener un almacén asociado

---

### CashSession
Sesión de caja (apertura/cierre).
```prisma
model CashSession {
  id            String            @id @default(cuid())
  status        CashSessionStatus @default(OPEN)
  openedAt      DateTime          @default(now())
  closedAt      DateTime?
  openingAmount Decimal           @db.Decimal(12,2)
  closingAmount Decimal?          @db.Decimal(12,2)
  note          String?

  registerId String
  register   Register @relation(fields: [registerId], references: [id])

  openedById String
  openedBy   User     @relation(fields: [openedById], references: [id])

  sales Sale[]
}
```

---

### Product
Producto en el inventario.
```prisma
model Product {
  id        String   @id @default(cuid())
  name      String
  sku       String?  @unique
  barcode   String?  @unique
  price     Decimal  @db.Decimal(12,2)
  cost      Decimal? @db.Decimal(12,2)
  unit      String?  // Unidad de medida
  image     String?  // URL o path de la imagen
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  items SaleItem[]
  stock Stock[]
  stockMovements StockMovement[]
}
```

---

### Sale
Venta realizada.
```prisma
model Sale {
  id          String     @id @default(cuid())
  createdAt   DateTime   @default(now())
  status      SaleStatus @default(PAID)
  total       Decimal    @db.Decimal(12,2)

  cashierId   String
  cashier     User       @relation(fields: [cashierId], references: [id])

  cashSessionId String
  cashSession   CashSession @relation(fields: [cashSessionId], references: [id])

  items     SaleItem[]
  payments  Payment[]
}
```

---

### SaleItem
Ítem individual de una venta.
```prisma
model SaleItem {
  id        String   @id @default(cuid())
  saleId    String
  sale      Sale     @relation(fields: [saleId], references: [id])

  productId String
  product   Product  @relation(fields: [productId], references: [id])

  qty       Int
  price     Decimal  @db.Decimal(12,2)
}
```

---

### Payment
Pago de una venta.
```prisma
model Payment {
  id       String        @id @default(cuid())
  saleId   String
  sale     Sale          @relation(fields: [saleId], references: [id])

  method   PaymentMethod
  amount   Decimal       @db.Decimal(12,2)
}
```

---

### Warehouse
Almacén para gestión de inventario.
```prisma
model Warehouse {
  id        String         @id @default(cuid())
  name      String
  code      String         @unique
  type      WarehouseType  @default(TPV)
  active    Boolean        @default(true)
  createdAt DateTime       @default(now())

  registerId String?   @unique
  register   Register? @relation(fields: [registerId], references: [id])

  registerSettings RegisterSettings[]

  stock Stock[]
  fromMovements StockMovement[] @relation("FromWarehouse")
  toMovements   StockMovement[] @relation("ToWarehouse")
}
```

---

### Stock
Inventario por producto y almacén.
```prisma
model Stock {
  id          String   @id @default(cuid())
  warehouseId String
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])

  productId   String
  product     Product  @relation(fields: [productId], references: [id])

  qty         Int      @default(0)
  updatedAt   DateTime @updatedAt

  @@unique([warehouseId, productId])
}
```

---

### StockMovement
Movimiento de inventario.
```prisma
model StockMovement {
  id              String            @id @default(cuid())
  createdAt       DateTime          @default(now())
  type            StockMovementType

  productId       String
  product         Product           @relation(fields: [productId], references: [id])

  qty             Int

  fromWarehouseId String?
  fromWarehouse   Warehouse?        @relation("FromWarehouse", fields: [fromWarehouseId], references: [id])

  toWarehouseId   String?
  toWarehouse     Warehouse?        @relation("ToWarehouse", fields: [toWarehouseId], references: [id])

  reason          String?
}
```

---

### RegisterSettings
Configuración de una caja registradora.
```prisma
model RegisterSettings {
  id                  String   @id @default(cuid())
  registerId          String   @unique
  register            Register @relation(fields: [registerId], references: [id])

  defaultOpeningFloat Decimal  @db.Decimal(12,2) @default(0)
  currency            String   @default("USD")
  warehouseId         String?
  warehouse           Warehouse? @relation(fields: [warehouseId], references: [id])
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  paymentMethods PaymentMethodSetting[]
  denominations  Denomination[]
}
```

---

### PaymentMethodSetting
Métodos de pago configurados por caja.
```prisma
model PaymentMethodSetting {
  id                String  @id @default(cuid())
  code              String  @unique
  name              String
  enabled           Boolean @default(true)
  registerSettingsId String?
  registerSettings   RegisterSettings? @relation(fields: [registerSettingsId], references: [id])
}
```

---

### Denomination
Denominaciones de efectivo configuradas por caja.
```prisma
model Denomination {
  id                String  @id @default(cuid())
  value             Decimal @db.Decimal(12,2)
  enabled           Boolean @default(true)
  registerSettingsId String?
  registerSettings   RegisterSettings? @relation(fields: [registerSettingsId], references: [id])
}
```

---

## Diagramas de Relación

### Flujo de Venta
```
User → CashSession → Sale → SaleItem → Product
                         ↓
                      Payment
```

### Flujo de Inventario
```
Warehouse → Stock → Product
     ↓
StockMovement
```
