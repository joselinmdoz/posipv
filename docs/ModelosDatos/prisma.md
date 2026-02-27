# Modelos de Datos - Prisma Schema

## Enumeraciones principales

### `Role`
```prisma
enum Role {
  ADMIN
  CASHIER
}
```

### `CashSessionStatus`
```prisma
enum CashSessionStatus {
  OPEN
  CLOSED
}
```

### `SaleStatus`
```prisma
enum SaleStatus {
  PAID
  VOID
}
```

### `SaleChannel`
```prisma
enum SaleChannel {
  TPV
  DIRECT
}
```

### `PaymentMethod`
```prisma
enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  OTHER
}
```

### `CurrencyCode`
```prisma
enum CurrencyCode {
  CUP
  USD
}
```

### `WarehouseType`
```prisma
enum WarehouseType {
  CENTRAL
  TPV
}
```

### `StockMovementType`
```prisma
enum StockMovementType {
  IN
  OUT
  TRANSFER
}
```

### `IPVType`
```prisma
enum IPVType {
  INITIAL
  FINAL
}
```

---

## Entidades principales

### `User`
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

### `Register` (TPV)
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

### `CashSession`
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

  sales            Sale[]
  inventoryReports InventoryReport[]
}
```

### `Product`
```prisma
model Product {
  id        String   @id @default(cuid())
  name      String
  codigo    String?  @unique
  barcode   String?  @unique
  price     Decimal  @db.Decimal(12,2)
  cost      Decimal? @db.Decimal(12,2)
  currency  CurrencyCode @default(CUP)
  image     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())

  productTypeId     String?
  productCategoryId String?
  measurementUnitId String?

  items                SaleItem[]
  stock                Stock[]
  stockMovements       StockMovement[]
  inventoryReportItems InventoryReportItem[]
}
```

### `Sale` (actualizada para TPV + Directa)
```prisma
model Sale {
  id             String      @id @default(cuid())
  createdAt      DateTime    @default(now())
  status         SaleStatus  @default(PAID)
  channel        SaleChannel @default(TPV)
  total          Decimal     @db.Decimal(12,2)
  customerName   String?
  documentNumber String?     @unique

  cashierId String
  cashier   User @relation(fields: [cashierId], references: [id])

  cashSessionId String?
  cashSession   CashSession? @relation(fields: [cashSessionId], references: [id])

  warehouseId String?
  warehouse   Warehouse? @relation(fields: [warehouseId], references: [id])

  items    SaleItem[]
  payments Payment[]
}
```

Notas:
- `channel = TPV` para ventas desde punto de venta con sesión de caja.
- `channel = DIRECT` para ventas directas sin caja TPV/IPV.
- `cashSessionId` ahora es opcional para soportar ventas directas.
- `warehouseId` permite trazabilidad de salida de inventario por almacén.

### `SaleItem`
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

### `Payment`
```prisma
model Payment {
  id                   String        @id @default(cuid())
  saleId               String
  sale                 Sale          @relation(fields: [saleId], references: [id])

  method               PaymentMethod
  amount               Decimal       @db.Decimal(12,2)
  currency             CurrencyCode  @default(CUP)
  amountOriginal       Decimal       @db.Decimal(12,2)
  exchangeRateUsdToCup Decimal?      @db.Decimal(12,6)
  exchangeRateRecordId String?
  exchangeRateRecord   ExchangeRateRecord? @relation(fields: [exchangeRateRecordId], references: [id])
}
```

### `Warehouse`
```prisma
model Warehouse {
  id        String        @id @default(cuid())
  name      String
  code      String        @unique
  type      WarehouseType @default(TPV)
  active    Boolean       @default(true)
  createdAt DateTime      @default(now())

  registerId String?   @unique
  register   Register? @relation(fields: [registerId], references: [id])

  registerSettings RegisterSettings[]

  stock            Stock[]
  fromMovements    StockMovement[] @relation("FromWarehouse")
  toMovements      StockMovement[] @relation("ToWarehouse")
  inventoryReports InventoryReport[]
  sales            Sale[]
}
```

### `Stock`
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

### `StockMovement`
```prisma
model StockMovement {
  id              String            @id @default(cuid())
  createdAt       DateTime          @default(now())
  type            StockMovementType

  productId       String
  product         Product           @relation(fields: [productId], references: [id])

  qty             Int

  fromWarehouseId String?
  fromWarehouse   Warehouse? @relation("FromWarehouse", fields: [fromWarehouseId], references: [id])

  toWarehouseId   String?
  toWarehouse     Warehouse? @relation("ToWarehouse", fields: [toWarehouseId], references: [id])

  reason          String?
}
```

### `RegisterSettings` y `Denomination`
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

model Denomination {
  id                 String       @id @default(cuid())
  value              Decimal      @db.Decimal(12,2)
  enabled            Boolean      @default(true)
  currency           CurrencyCode @default(CUP)
  registerSettingsId String?
  registerSettings   RegisterSettings? @relation(fields: [registerSettingsId], references: [id])

  @@index([registerSettingsId, currency])
  @@unique([registerSettingsId, currency, value])
}
```

### `SystemSettings` y `ExchangeRateRecord`
```prisma
model SystemSettings {
  id                   String         @id
  defaultCurrency      CurrencyCode   @default(CUP)
  enabledCurrencies    CurrencyCode[] @default([CUP, USD])
  exchangeRateUsdToCup Decimal        @db.Decimal(12,6) @default(1)
  createdAt            DateTime       @default(now())
  updatedAt            DateTime       @updatedAt
}

model ExchangeRateRecord {
  id            String       @id @default(cuid())
  baseCurrency  CurrencyCode @default(USD)
  quoteCurrency CurrencyCode @default(CUP)
  rate          Decimal      @db.Decimal(12,6)
  source        String?      @default("SYSTEM_SETTINGS")
  createdAt     DateTime     @default(now())

  payments      Payment[]
}
```

### `InventoryReport` (IPV por sesión TPV)
```prisma
model InventoryReport {
  id           String   @id @default(cuid())
  type         IPVType
  createdAt    DateTime @default(now())
  totalValue   Decimal  @db.Decimal(12,2) @default(0)
  note         String?

  cashSessionId String
  cashSession   CashSession @relation(fields: [cashSessionId], references: [id])

  warehouseId String
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id])

  items       InventoryReportItem[]
}
```
