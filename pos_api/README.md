# POS API (multicaja) — NestJS + Prisma + PostgreSQL

Backend listo para conectar con tu Angular POS (multi-caja).

## Requisitos (WSL Ubuntu)
- Docker Desktop instalado en Windows y **WSL Integration** habilitada para tu distro Ubuntu.
- Node.js 20+ en WSL (recomendado).
- npm (incluido con Node).

## 1) Preparar entorno
En WSL, entra a la carpeta del proyecto y crea `.env`:

```bash
cp .env.example .env
```

## 2) Levantar PostgreSQL (dev)
```bash
docker compose -f docker-compose.dev.yml up -d
```

Verifica:
```bash
docker ps
```

## 3) Instalar dependencias
```bash
npm install
```

## 4) Migrar DB + generar cliente Prisma
```bash
npx prisma migrate dev --name init
npx prisma generate
```

## 5) Seed inicial (admin + 2 cajas)
```bash
npx prisma db seed
```

Credenciales seed:
- email: admin@pos.local
- pass:  Admin123!

## 6) Correr API en modo desarrollo
```bash
npm run start:dev
```

La API queda en:
- http://localhost:3000/api

Health:
- http://localhost:3000/api/health

## Endpoints usados por el front
- POST /api/auth/login
- GET  /api/registers
- GET  /api/cash-sessions/open?registerId=...
- POST /api/cash-sessions/open
- POST /api/cash-sessions/:id/close
- GET  /api/products
- POST /api/products
- POST /api/sales

## Notas rápidas
- CORS por defecto permite `http://localhost:4200` (ajustable con CORS_ORIGIN en `.env`).
- Global prefix `api` ya configurado para calzar con el proxy del Angular.
