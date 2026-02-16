# Documentación Técnica del Proyecto POS (Punto de Venta Multi-caja)

## Tabla de Contenidos

1. [Descripción General del Proyecto y su Arquitectura](#1-descripción-general-del-proyecto-y-su-arquitectura)
2. [Requisitos del Sistema y Dependencias](#2-requisitos-del-sistema-y-dependencias)
3. [Instrucciones Detalladas de Instalación y Configuración del Entorno de Desarrollo](#3-instrucciones-detalladas-de-instalación-y-configuración-del-entorno-de-desarrollo)
4. [Configuración de Conexiones a la Base de Datos PostgreSQL 16](#4-configuración-de-conexiones-a-la-base-de-datos-postgresql-16)
5. [Estructura del Proyecto Explicada Carpeta por Carpeta](#5-estructura-del-proyecto-explicada-carpeta-por-carpeta)
6. [Guía de Comandos Útiles para Desarrollo](#6-guía-de-comandos-útiles-para-desarrollo)
7. [Resolución de Problemas Comunes](#7-resolución-de-problemas-comunes)
8. [Formato para Actualizaciones Futuras](#8-formato-para-actualizaciones-futuras)

---

## 1. Descripción General del Proyecto y su Arquitectura

### 1.1 Visión General

El Proyecto POS (Punto de Venta Multi-caja) es una aplicación completa de gestión de ventas y inventario diseñada para funcionar en múltiples cajas registradoras (TPV - Terminales de Punto de Venta). El sistema permite gestionar múltiples cajas registradoras, sesiones de caja, productos, ventas, inventario y reportes desde una interfaz web moderna.

### 1.2 Arquitectura del Sistema

El proyecto sigue una **arquitectura monolítica modular** dividida en dos componentes principales:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROYECTO POS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────┐         ┌─────────────────────┐      │
│   │     POS_API         │         │     POS_WEB         │      │
│   │   (Backend/NestJS)  │◄────────►│  (Frontend/Angular) │      │
│   └──────────┬──────────┘         └──────────┬──────────┘      │
│              │                                │                  │
│              ▼                                │                  │
│   ┌─────────────────────┐                     │                  │
│   │   PostgreSQL 16     │                     │                  │
│   │   (Base de Datos)  │                     │                  │
│   └─────────────────────┘                     │                  │
│                                              │                  │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Componentes del Sistema

#### 1.3.1 Backend (pos_api)
- **Framework**: NestJS 11.x
- **ORM**: Prisma 6.x
- **Base de Datos**: PostgreSQL 16
- **Autenticación**: JWT (JSON Web Tokens)
- **Puerto default**: 3021 (configurable)
- **Prefijo de API**: `/api`

#### 1.3.2 Frontend (pos_web)
- **Framework**: Angular 21
- **UI Library**: PrimeNG 21.x
- **Estilos**: TailwindCSS 4.x + SCSS
- **Puerto default**: 4200

### 1.4 Características Principales

| Módulo | Funcionalidad |
|--------|---------------|
| **Autenticación** | Login con JWT, roles (ADMIN, CASHIER) |
| **Cajas Registradoras** | Gestión de múltiples cajas (registers) |
| **Sesiones de Caja** | Apertura y cierre de cajas con control de efectivo |
| **Productos** | CRUD de productos con código de barras, SKU, precios |
| **Ventas** | Registro de ventas con múltiples métodos de pago |
| **Inventario** | Gestión de almacenes, stock y movimientos |
| **Reportes** | Reportes de ventas, productos más vendidos |
| **Dashboard** | Estadísticas en tiempo real |
| **Configuración** | Configuración por caja (métodos de pago, denominaciones) |

---

## 2. Requisitos del Sistema y Dependencias

### 2.1 Requisitos de Hardware

| Componente | Mínimo | Recomendado |
|------------|--------|-------------|
| **CPU** | 2 núcleos | 4+ núcleos |
| **RAM** | 4 GB | 8+ GB |
| **Disco** | 20 GB SSD | 50 GB SSD |
| **Red** | Conexión estable | Conexión de alta velocidad |

### 2.2 Requisitos de Software

#### 2.2.1 Para Desarrolladores (Entorno Local)

| Software | Versión Mínima | Versión Recomendada |
|----------|----------------|---------------------|
| **Node.js** | 20.x LTS | 20.x LTS o superior |
| **npm** | 9.x | 10.x |
| **Docker** | 20.x | 24.x |
| **Docker Compose** | 2.x | 2.x |
| **Git** | 2.x | 2.x |
| **WSL2** (Windows) | Ubuntu 20.04+ | Ubuntu 22.04+ |

#### 2.2.2 Dependencias del Backend (pos_api)

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/jwt": "^11.0.0",
    "@nestjs/passport": "^11.0.0",
    "@nestjs/platform-express": "^11.1.12",
    "@nestjs/serve-static": "^5.0.4",
    "@prisma/client": "^6.0.0",
    "bcrypt": "^5.1.1",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "multer": "^2.0.2",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "prisma": "^6.0.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/bcrypt": "^5.0.2",
    "@types/node": "^20.11.30",
    "@types/passport-jwt": "^4.0.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.6.3"
  }
}
```

#### 2.3 Dependencias del Frontend (pos_web)

```json
{
  "dependencies": {
    "@angular/common": "^21",
    "@angular/compiler": "^21",
    "@angular/core": "^21",
    "@angular/forms": "^21",
    "@angular/platform-browser": "^21",
    "@angular/platform-browser-dynamic": "^21",
    "@angular/router": "^21",
    "@primeuix/themes": "^2.0.0",
    "@tailwindcss/postcss": "^4.1.11",
    "chart.js": "4.4.2",
    "primeclt": "^0.1.5",
    "primeicons": "^7.0.0",
    "primeng": "^21.0.2",
    "quill": "^2.0.3",
    "rxjs": "~7.8.0",
    "tailwindcss-primeui": "^0.6.1",
    "tslib": "^2.8.1"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^21",
    "@angular/cli": "^21",
    "@angular/compiler-cli": "^21",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.14.0",
    "postcss": "^8.5.6",
    "prettier": "^3.0.0",
    "tailwindcss": "^4.1.11",
    "typescript": "~5.9.3"
  }
}
```

### 2.4 Servicios Externos Requeridos

| Servicio | Propósito | Puerto Default |
|----------|-----------|----------------|
| **PostgreSQL 16** | Base de datos relacional | 5421 |
| **API NestJS** | Backend REST API | 3021 |
| **Angular Dev Server** | Frontend de desarrollo | 4200 |

---

## 3. Instrucciones Detalladas de Instalación y Configuración del Entorno de Desarrollo

### 3.1 Pre-requisitos del Sistema

#### 3.1.1 Instalación de Node.js

```bash
# Verificar si Node.js está instalado
node --version

# Verificar si npm está instalado
npm --version
```

Si no están instalados, seguir las instrucciones en: https://nodejs.org/

#### 3.1.2 Instalación de Docker

```bash
# Verificar instalación de Docker
docker --version
docker-compose --version

# En Windows con WSL2:
# 1. Instalar Docker Desktop
# 2. Habilitar WSL Integration en configuración
```

#### 3.1.3 Configuración de WSL2 (Windows)

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v20.x.x
npm --version   # Debe mostrar 10.x.x
```

### 3.2 Configuración del Proyecto

#### 3.2.1 Clonar el Repositorio (si aplica)

```bash
git clone <url-del-repositorio>
cd <nombre-del-proyecto>
```

#### 3.2.2 Estructura de Directorios

```
proyecto-pos/
├── pos_api/          # Backend (NestJS)
│   ├── prisma/       # Migraciones y schema de BD
│   ├── src/          # Código fuente del backend
│   ├── uploads/      # Archivos subidos (imágenes)
│   └── ...
└── pos_web/          # Frontend (Angular)
    ├── src/          # Código fuente del frontend
    ├── public/      # Archivos estáticos
    └── ...
```

### 3.3 Configuración del Backend (pos_api)

#### 3.3.1 Navegar al Directorio del Backend

```bash
cd pos_api
```

#### 3.3.2 Instalar Dependencias

```bash
npm install
```

#### 3.3.3 Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env
```

Editar el archivo `.env` con los valores deseados:

```env
# Configuración de la Base de Datos
# Puerto: 5421 (configurado para evitar conflictos)
DATABASE_URL="postgresql://pos:pos123@localhost:5421/pos?schema=public"

# Configuración de Seguridad
JWT_SECRET="CAMBIA_ESTO_POR_ALGO_LARGO_Y_SERIO_ABC123XYZ789"

# Configuración del Servidor
PORT=3021

# Configuración de CORS (orígenes permitidos separados por coma)
CORS_ORIGIN="http://localhost:4200,http://10.255.255.254:4200,http://172.24.100.247:4200"
```

**Nota importante**: 
- Cambia el `JWT_SECRET` por una cadena aleatoria segura en producción
- Los orígenes CORS incluyen `localhost:4200` para desarrollo local y las IPs especificadas

#### 3.3.4 Levantar la Base de Datos PostgreSQL

```bash
# Usando Docker Compose
docker compose -f docker-compose.dev.yml up -d

# O usando el script npm
npm run db:up
```

Verificar que el contenedor está corriendo:

```bash
docker ps
```

Debería mostrar un contenedor llamado `pos_postgres_dev` con la imagen `postgres:16`.

### 3.4 Configuración con Docker Compose (Completo)

El proyecto incluye un archivo [`docker-compose.dev.yml`](docker-compose.dev.yml) que configura todos los servicios necesarios:

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **PostgreSQL** | 5421 | Base de datos |
| **API (NestJS)** | 3021 | Backend |
| **Frontend (Angular)** | 4200 | Interfaz de usuario |

#### 3.4.1 Iniciar Todos los Servicios

```bash
# Desde la raíz del proyecto
docker compose -f docker-compose.dev.yml up -d

# Ver el estado de los servicios
docker compose -f docker-compose.dev.yml ps

# Ver logs de un servicio específico
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f web
docker compose -f docker-compose.dev.yml logs -f postgres
```

#### 3.4.2 Detener Todos los Servicios

```bash
# Detener sin eliminar volúmenes
docker compose -f docker-compose.dev.yml down

# Detener y eliminar volúmenes (¡CUIDADO! Elimina todos los datos)
docker compose -f docker-compose.dev.yml down -v

# Detener y eliminar imágenes también
docker compose -f docker-compose.dev.yml down --rmi all
```

#### 3.4.3 Rebuild de los Contenedores

```bash
# Reconstruir las imágenes sin caché
docker compose -f docker-compose.dev.yml build --no-cache

# Reconstruir un servicio específico
docker compose -f docker-compose.dev.yml build api
docker compose -f docker-compose.dev.yml build web
```

### 3.5 Producción con Docker

Para entornos de producción, usa el archivo [`docker-compose.prod.yml`](docker-compose.prod.yml):

```bash
# Construir e iniciar todos los servicios
docker compose -f docker-compose.prod.yml up -d --build

# Ver logs
docker compose -f docker-compose.prod.yml logs -f

# Detener
docker compose -f docker-compose.prod.yml down
```

**Puertos en producción:**

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **PostgreSQL** | 5421 | Base de datos |
| **API (NestJS)** | 3021 | Backend |
| **Frontend (Nginx)** | 80 | Interfaz de usuario |

#### Archivos Docker Creados

| Archivo | Descripción |
|---------|-------------|
| [`pos_api/Dockerfile`](pos_api/Dockerfile) | Imagen del backend para desarrollo |
| [`pos_web/Dockerfile`](pos_web/Dockerfile) | Imagen del frontend para desarrollo |
| [`pos_web/Dockerfile.prod`](pos_web/Dockerfile.prod) | Imagen del frontend para producción (Nginx) |
| [`pos_web/nginx.conf`](pos_web/nginx.conf) | Configuración de Nginx para producción |
| [`docker-compose.dev.yml`](docker-compose.dev.yml) | Orquestación para desarrollo |
| [`docker-compose.prod.yml`](docker-compose.prod.yml) | Orquestación para producción |
| [`pos_api/.dockerignore`](pos_api/.dockerignore) | Archivos ignorados en el backend |
| [`pos_web/.dockerignore`](pos_web/.dockerignore) | Archivos ignorados en el frontend |

#### 3.3.5 Ejecutar Migraciones de Base de Datos

```bash
# Generar el cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev --name init
```

**Nota**: El proyecto ya tiene migraciones existentes:
- `20260125212642_init` - Esquema inicial
- `20260126003128_add_warehouses_stock_settings` - Almacenes y stock
- `20260126003346_add_user_active` - Campo active en usuarios
- `20260126004156_add_product_fields` - Campos adicionales en productos

#### 3.3.6 Ejecutar Seed (Datos Iniciales)

```bash
npm run seed
```

Esto creará:
- Usuario administrador: `admin@pos.local` / `Admin123!`
- 2 Cajas registradoras de ejemplo

#### 3.3.7 Iniciar el Servidor de Desarrollo

```bash
npm run start:dev
```

La API estará disponible en: `http://localhost:3021/api`

Verificar el estado de salud:

```bash
curl http://localhost:3021/api/health
```

### 3.4 Configuración del Frontend (pos_web)

#### 3.4.1 Navegar al Directorio del Frontend

```bash
cd pos_web
```

#### 3.4.2 Instalar Dependencias

```bash
npm install
```

Este proceso puede tomar varios minutos dependiendo de la conexión a internet.

#### 3.4.3 Iniciar el Servidor de Desarrollo

```bash
# Usando npm
npm start

# O usando Angular CLI
ng serve
```

La aplicación estará disponible en: `http://localhost:4200`

#### 3.4.4 Configuración Adicional (Opcional)

Para cambiar el puerto del servidor de desarrollo, editar `angular.json` o usar:

```bash
ng serve --port 4201
```

### 3.5 Configuración de Proxy (Opcional)

Para evitar problemas de CORS, configurar un proxy en Angular:

1. Crear archivo `proxy.conf.json` en `pos_web/`:

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false,
    "changeOrigin": true
  }
}
```

2. Modificar el script de inicio en `package.json`:

```json
"scripts": {
  "start": "ng serve --proxy-config proxy.conf.json"
}
```

---

## 4. Configuración de Conexiones a la Base de Datos PostgreSQL 16

### 4.1 Configuración de Docker

El archivo `docker-compose.dev.yml` define la configuración de PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: pos_postgres_dev
    environment:
      POSTGRES_DB: pos
      POSTGRES_USER: pos
      POSTGRES_PASSWORD: pos123
    ports:
      - "5421:5432"  # Puerto 5421 para evitar conflictos
    volumes:
      - pos_pgdata_dev:/var/lib/postgresql/data
```

### 4.2 Parámetros de Conexión

| Parámetro | Valor Default | Descripción |
|-----------|---------------|-------------|
| **Host** | localhost | Dirección del servidor PostgreSQL |
| **Puerto** | 5421 | Puerto de PostgreSQL (configurado para evitar conflictos) |
| **Base de Datos** | pos | Nombre de la base de datos |
| **Usuario** | pos | Usuario de la base de datos |
| **Contraseña** | pos123 | Contraseña del usuario |
| **Schema** | public | Schema de PostgreSQL |

### 4.3 Cadena de Conexión (Connection String)

```
postgresql://pos:pos123@localhost:5421/pos?schema=public
```

### 4.4 Gestión de la Base de Datos

#### 4.4.1 Comandos Útiles de Docker

```bash
# Iniciar la base de datos
docker compose -f docker-compose.dev.yml up -d postgres

# Detener la base de datos
docker compose -f docker-compose.dev.yml down postgres

# Detener y eliminar volúmenes (¡CUIDADO! Elimina todos los datos)
docker compose -f docker-compose.dev.yml down -v

# Ver logs de PostgreSQL
docker compose -f docker-compose.dev.yml logs postgres

# Acceder a PostgreSQL desde el contenedor
docker exec -it pos_postgres_dev psql -U pos -d pos
```

#### 4.4.2 Herramientas de Administración

Puedes usar herramientas como:
- **pgAdmin**: Interfaz web de administración
- **DBeaver**: Cliente universal de bases de datos
- **DataGrip**: IDE de JetBrains
- **TablePlus**: Cliente moderno para Mac/Windows

Configuración de conexión en estas herramientas:

| Campo | Valor |
|-------|-------|
| Host | localhost |
| Port | 5432 |
| Database | pos |
| Username | pos |
| Password | pos123 |

### 4.5 Prisma Studio (Visualizador de Base de Datos)

Para visualizar y editar datos usando Prisma:

```bash
cd pos_api
npx prisma studio
```

Esto abrirá una interfaz web en: `http://localhost:5555`

### 4.6 Respaldo y Restauración

#### 4.6.1 Respaldo de la Base de Datos

```bash
docker exec -it pos_db pg_dump -U pos pos > backup_$(date +%Y%m%d_%H%M%S).sql
```

#### 4.6.2 Restaurar Base de Datos

```bash
docker exec -i pos_db psql -U pos pos < backup_archivo.sql
```

---

## 5. Estructura del Proyecto Explicada Carpeta por Carpeta

### 5.1 Estructura General

```
proyecto-pos/
├── pos_api/                    # Backend NestJS
│   ├── prisma/                 # Configuración de Prisma
│   │   ├── migrations/         # Migraciones de base de datos
│   │   ├── schema.prisma      # Esquema de la base de datos
│   │   └── seed.ts            # Datos iniciales
│   ├── src/                    # Código fuente
│   │   ├── common/             # Utilidades comunes
│   │   ├── controllers/        # Controladores (legacy)
│   │   ├── models/             # Modelos (legacy)
│   │   ├── modules/            # Módulos NestJS
│   │   ├── prisma/             # Módulo de Prisma
│   │   ├── services/          # Servicios (legacy)
│   │   ├── app.module.ts      # Módulo principal
│   │   └── main.ts            # Punto de entrada
│   ├── uploads/               # Archivos subidos
│   ├── .env                   # Variables de entorno
│   ├── docker-compose.dev.yml # Docker para desarrollo
│   ├── package.json           # Dependencias npm
│   ├── tsconfig.json          # Configuración TypeScript
│   └── nest-cli.json         # Configuración NestJS
│
└── pos_web/                    # Frontend Angular
    ├── public/                 # Archivos estáticos públicos
    │   └── demo/              # Imágenes demo
    ├── src/                   # Código fuente
    │   ├── app/               # Componentes y módulos Angular
    │   │   ├── layout/       # Layout de la aplicación
    │   │   │   ├── component/ # Componentes del layout
    │   │   │   └── service/  # Servicios del layout
    │   │   └── pages/       # Páginas de la aplicación
    │   │       ├── auth/    # Autenticación
    │   │       ├── dashboard/ # Dashboard
    │   │       ├── crud/    # Gestión de datos
    │   │       ├── uikit/   # Componentes UI
    │   │       └── ...
    │   ├── assets/           # Recursos estáticos
    │   ├── app.component.ts # Componente raíz
    │   ├── app.config.ts    # Configuración de la app
    │   ├── app.routes.ts    # Rutas de la aplicación
    │   └── main.ts          # Punto de entrada
    ├── angular.json          # Configuración Angular CLI
    ├── package.json          # Dependencias npm
    └── tsconfig.json         # Configuración TypeScript
```

### 5.2 Estructura del Backend (pos_api)

#### 5.2.1 Módulos del Backend

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| **Auth** | `src/modules/auth/` | Autenticación JWT, login, registro |
| **Users** | `src/modules/users/` | Gestión de usuarios |
| **Registers** | `src/modules/registers/` | Gestión de cajas registradoras |
| **CashSessions** | `src/modules/cash-sessions/` | Sesiones de caja (apertura/cierre) |
| **Products** | `src/modules/products/` | Gestión de productos |
| **Sales** | `src/modules/sales/` | Registro de ventas |
| **Health** | `src/modules/health/` | Health check de la API |
| **Dashboard** | `src/modules/dashboard/` | Estadísticas del dashboard |
| **Reports** | `src/modules/reports/` | Reportes del sistema |
| **Warehouses** | `src/modules/warehouses/` | Gestión de almacenes |
| **StockMovements** | `src/modules/stock-movements/` | Movimientos de inventario |
| **Settings** | `src/modules/settings/` | Configuración por caja |
| **Prisma** | `src/prisma/` | Conexión a la base de datos |

#### 5.2.2 Estructura de un Módulo NestJS

Cada módulo sigue el patrón:

```
modules/<nombre-modulo>/
├── <nombre-modulo>.controller.ts  # Endpoints HTTP
├── <nombre-modulo>.module.ts     # Definición del módulo
└── <nombre-modulo>.service.ts    # Lógica de negocio
```

### 5.3 Estructura del Frontend (pos_web)

#### 5.3.1 Componentes del Layout

| Componente | Archivo | Descripción |
|------------|---------|-------------|
| **TopBar** | `app/layout/component/app.topbar.ts` | Barra superior con usuario |
| **Sidebar** | `app/layout/component/app.sidebar.ts` | Menú lateral |
| **Menu** | `app/layout/component/app.menu.ts` | Definición del menú |
| **Footer** | `app/layout/component/app.footer.ts` | Pie de página |
| **Configurator** | `app/layout/component/app.configurator.ts` | Panel de configuración |

#### 5.3.2 Páginas de la Aplicación

| Página | Ruta | Descripción |
|--------|------|-------------|
| **Login** | `app/pages/auth/login.ts` | Página de inicio de sesión |
| **Dashboard** | `app/pages/dashboard/` | Panel principal |
| **CRUD** | `app/pages/crud/` | Gestión de datos |
| **UI Kit** | `app/pages/uikit/` | Componentes de demostración |

### 5.4 Esquema de Base de Datos (Prisma)

#### 5.4.1 Modelos Principales

```prisma
// Usuarios del sistema
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

// Cajas registradoras
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

// Sesiones de caja
model CashSession {
  id            String            @id @default(cuid())
  status        CashSessionStatus @default(OPEN)
  openedAt      DateTime          @default(now())
  closedAt      DateTime?
  openingAmount Decimal           @db.Decimal(12,2)
  closingAmount Decimal?          @db.Decimal(12,2)
  note          String?
  registerId    String
  openedById    String
  sales         Sale[]
}

// Productos
model Product {
  id        String   @id @default(cuid())
  name      String
  sku       String?  @unique
  barcode   String?  @unique
  price     Decimal  @db.Decimal(12,2)
  cost      Decimal? @db.Decimal(12,2)
  unit      String?
  image     String?
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  items     SaleItem[]
  stock     Stock[]
  stockMovements StockMovement[]
}

// Ventas
model Sale {
  id          String     @id @default(cuid())
  createdAt   DateTime   @default(now())
  status      SaleStatus @default(PAID)
  total       Decimal    @db.Decimal(12,2)
  cashierId   String
  cashSessionId String
  items       SaleItem[]
  payments    Payment[]
}

// Almacenes
model Warehouse {
  id        String         @id @default(cuid())
  name      String
  code      String         @unique
  type      WarehouseType  @default(TPV)
  active    Boolean        @default(true)
  registerId String?   @unique
  stock     Stock[]
  fromMovements StockMovement[] @relation("FromWarehouse")
  toMovements   StockMovement[] @relation("ToWarehouse")
}

// Stock por producto y almacén
model Stock {
  id          String   @id @default(cuid())
  warehouseId String
  productId   String
  qty         Int      @default(0)
  updatedAt   DateTime @updatedAt
  @@unique([warehouseId, productId])
}

// Movimientos de stock
model StockMovement {
  id              String            @id @default(cuid())
  createdAt       DateTime          @default(now())
  type            StockMovementType
  productId       String
  qty             Int
  fromWarehouseId String?
  toWarehouseId   String?
  reason          String?
}
```

---

## 6. Guía de Comandos Útiles para Desarrollo

### 6.1 Comandos del Backend (pos_api)

#### 6.1.1 Instalación y Configuración

```bash
# Instalar todas las dependencias
npm install

# Generar el cliente Prisma
npm run prisma:generate
# o
npx prisma generate

# Ejecutar migraciones
npm run prisma:migrate
# o
npx prisma migrate dev

# Sembrar datos iniciales
npm run seed
# o
npx prisma db seed
```

#### 6.1.2 Desarrollo

```bash
# Iniciar en modo desarrollo con hot-reload
npm run start:dev
# o
nest start --watch

# Compilar el proyecto
npm run build
# o
nest build

# Iniciar en modo producción
npm start
```

#### 6.1.3 Base de Datos

```bash
# Iniciar la base de datos con Docker
npm run db:up
# o
docker compose -f docker-compose.dev.yml up -d

# Detener la base de datos
npm run db:down
# o
docker compose -f docker-compose.dev.yml down -v

# Abrir Prisma Studio (visualizador de BD)
npx prisma studio

# Resetear la base de datos (elimina todo)
npx prisma migrate reset
```

#### 6.1.4 Linting y Formatting

```bash
# Verificar código (configuración básica)
npm run lint

# Formatear código (no configurado aún)
# npm run format
```

### 6.2 Comandos del Frontend (pos_web)

#### 6.2.1 Instalación y Configuración

```bash
# Instalar todas las dependencias
npm install

# Instalar dependencias opcionales (linting)
npm install --include=dev prettier eslint eslint-config-prettier
```

#### 6.2.2 Desarrollo

```bash
# Iniciar servidor de desarrollo
npm start
# o
ng serve

# Iniciar en un puerto específico
ng serve --port 4201

# Iniciar con configuración de proxy
ng serve --proxy-config proxy.conf.json

# Compilar para desarrollo
npm run build
# o
ng build --configuration development

# Compilar para producción
ng build
# o
ng build --configuration production
```

#### 6.2.3 Generación de Código

```bash
# Generar un nuevo componente
ng generate component components/nombre-componente

# Generar un nuevo servicio
ng generate service services/nombre-servicio

# Generar un nuevo módulo
ng generate module modules/nombre-modulo

# Generar un nuevo pipe
ng generate pipe pipes/nombre-pipe

# Generar una nueva directive
ng generate directive directives/nombre-directive
```

#### 6.2.4 Testing

```bash
# Ejecutar tests unitarios
npm test
# o
ng test

# Ejecutar tests con coverage
ng test --coverage

# Ejecutar tests en modo watch
ng test --watch
```

#### 6.2.5 Mantenimiento

```bash
# Formatear código
npm run format

# Actualizar Angular CLI global
npm install -g @angular/cli

# Actualizar proyecto a nueva versión de Angular
ng update @angular/core @angular/cli
```

### 6.3 Comandos de Docker

```bash
# Ver contenedores activos
docker ps

# Ver todos los contenedores
docker ps -a

# Ver logs de un contenedor
docker logs <nombre-contenedor>

# Acceder al shell de un contenedor
docker exec -it <nombre-contenedor> bash

# Eliminar contenedores detenido
docker container prune

# Eliminar imágenes sin usar
docker image prune

# Ver uso de recursos
docker stats
```

### 6.4 Comodos atajos con npm scripts

```bash
# En pos_api/
npm run prisma:generate  # Generar cliente Prisma
npm run prisma:migrate  # Ejecutar migraciones
npm run seed           # Sembrar datos
npm run db:up          # Iniciar BD
npm run db:down        # Detener BD

# En pos_web/
npm start             # Iniciar desarrollo
npm run build        # Compilar producción
npm run watch        # Compilar en watch mode
npm run format       # Formatear código
```

---

## 7. Resolución de Problemas Comunes

### 7.1 Problemas de Instalación de Dependencias

#### 7.1.1 Error de permisos en npm

**Síntoma**: `EACCES: permission denied`

**Solución**:

```bash
# Solución 1: Cambiar directorio de npm
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH

# Solución 2: Usar nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20
```

#### 7.1.2 Error de versión de Node.js

**Síntoma**: Errores de sintaxis o incompatibilidad

**Solución**:

```bash
# Verificar versión actual
node --version

# Usar nvm para cambiar versión
nvm install 20
nvm use 20
nvm alias default 20
```

### 7.2 Problemas de Docker

#### 7.2.1 PostgreSQL no inicia

**Síntoma**: Error al conectar a la base de datos

**Solución**:

```bash
# Verificar si hay conflictos en el puerto
sudo lsof -i :5432

# Eliminar contenedores antiguos
docker rm -f pos_db

# Reiniciar Docker
sudo systemctl restart docker

# Volver a iniciar
docker compose -f docker-compose.dev.yml up -d
```

#### 7.2.2 Error de volumen de Docker

**Síntoma**: `error creating volume`

**Solución**:

```bash
# Eliminar volúmenes huérfanos
docker volume prune

# Especificar volumen nuevo
docker volume create pos_pgdata
```

### 7.3 Problemas de Prisma

#### 7.3.1 Error de conexión a la base de datos

**Síntoma**: `Can't reach database server`

**Solución**:

```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep pos_db

# Verificar la cadena de conexión en .env
cat .env | grep DATABASE_URL

# Probar conexión manualmente
docker exec -it pos_db psql -U pos -d pos
```

#### 7.3.2 Error de migración

**Síntoma**: `migration failed` o errores de sintaxis SQL

**Solución**:

```bash
# Resetear base de datos (¡cuidado!, pierde datos)
npx prisma migrate reset

# O crear nueva migración desde el estado actual
npx prisma migrate dev --name nombre_migracion
```

#### 7.3.3 Prisma Studio no conecta

**Síntoma**: `Unable to connect to database`

**Solución**:

```bash
# Verificar que la BD esté corriendo
docker ps

# Regenerar cliente Prisma
npx prisma generate

# Verificar DATABASE_URL
echo $DATABASE_URL
```

### 7.4 Problemas del Frontend Angular

#### 7.4.1 Error de compilación

**Síntoma**: Errores de TypeScript

**Solución**:

```bash
# Limpiar caché de Angular
rm -rf node_modules/.cache
rm -rf dist

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

#### 7.4.2 Error de CORS

**Síntoma**: `Access-Control-Allow-Origin` error en consola

**Solución**:

1. Verificar que la API esté corriendo
2. Agregar el origen al archivo `.env` del backend:

```env
CORS_ORIGIN="http://localhost:4200"
```

3. O configurar proxy en Angular

#### 7.4.3 Slow compilation

**Síntoma**: La compilación es muy lenta

**Solución**:

```bash
# Usar compilación incremental
ng serve --configuration development

# Aumentar memoria de Node
export NODE_OPTIONS="--max-old-space-size=4096"
ng serve
```

### 7.5 Problemas de Autenticación

#### 7.5.1 Token JWT inválido

**Síntoma**: `Unauthorized` en todas las peticiones

**Solución**:

```bash
# Verificar que JWT_SECRET esté configurado
cat .env | grep JWT_SECRET

# Regenerar el token (hacer login nuevamente)
# El servidor debe estar corriendo
```

#### 7.5.2 Login no funciona

**Síntoma**: Credenciales correctas pero no accede

**Solución**:

```bash
# Verificar que el seed se haya ejecutado
npx prisma studio
# Revisar tabla User

# Verificar que el usuario esté activo
# En Prisma Studio, revisar campo 'active' = true
```

### 7.6 Problemas de Git

#### 7.6.1 Submodules no inicializados

**Síntoma**: Error al clonar repositorio con submodules

**Solución**:

```bash
# Clonar con submodules
git clone --recurse-submodules <url>

# O inicializar submodules después
git submodule update --init --recursive
```

---

## 8. Formato para Actualizaciones Futuras

### 8.1 Registro de Cambios

| Fecha | Versión | Cambios | Responsable |
|-------|---------|---------|-------------|
| 2026-02-16 | 1.0.0 | Documentación inicial | Sistema |

### 8.2 Plantilla para Nuevos Cambios

Al actualizar la documentación, seguir este formato:

```markdown
### [Fecha] - [Versión]

**Cambios realizados:**
- [Cambio 1]
- [Cambio 2]

**Archivos afectados:**
- `ruta/archivo1`
- `ruta/archivo2`

**Notas de migración:**
- [Nota de migración si aplica]
```

### 8.3 Checklist de Actualización

Antes de actualizar esta documentación, verificar:

- [ ] Nueva versión de dependencias
- [ ] Nuevos scripts npm añadidos
- [ ] Cambios en la estructura del proyecto
- [ ] Nuevos módulos o funcionalidades
- [ ] Cambios en la base de datos
- [ ] Nueva configuración de entorno
- [ ] Comandos actualizados
- [ ] Nuevos problemas y soluciones

### 8.4 Variables de Entorno para Agregar

Al agregar nuevas variables de entorno, documentar en esta plantilla:

```markdown
| Variable | Default | Descripción | Requerido |
|---------|---------|-------------|-----------|
| NUEVA_VARIABLE | valor | Descripción | Sí/No |
```

### 8.5 Nuevos Módulos

Al agregar nuevos módulos al proyecto, actualizar:

1. **Sección 5.2.1**: Agregar a la tabla de módulos
2. **Sección 5.4**: Agregar al esquema de Prisma
3. **Sección 6**: Agregar nuevos comandos si aplican
4. **Sección 7**: Agregar problemas comunes si aplica

---

## Anexo: Credenciales y Datos de Prueba

### Usuario Administrador (Seed)

| Campo | Valor |
|-------|-------|
| Email | admin@pos.local |
| Contraseña | Admin123! |
| Rol | ADMIN |

### Cajas Registradoras (Seed)

| Nombre | Código |
|--------|--------|
| Caja 1 | (generado automáticamente) |
| Caja 2 | (generado automáticamente) |

### Productos Demo

El proyecto incluye imágenes de productos demo en `pos_web/public/demo/images/product/`.

---

## Referencias Adicionales

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Angular Documentation](https://angular.io/docs)
- [PrimeNG Documentation](https://primeng.org/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

*Documento generado automáticamente. Última actualización: 2026-02-16*
