# Guia de desarrollo local (BD en Docker, API + Web local)

Objetivo: correr solo PostgreSQL en Docker y trabajar `pos_api` y `pos_web` directamente en tu máquina, sin afectar producción.

## 1) Aislamiento respecto a produccion
- Desarrollo usa:
  - `docker-compose.dev.yml`
  - `.env` / `pos_api/.env`
  - Puerto DB `5421`
- Producción usa:
  - `docker-compose.prod.yml`
  - `.env.prod`
  - Volúmenes `pos_pgdata_prod` / `pos_uploads_prod`

Mientras uses `docker-compose.dev.yml`, no tocas producción.

## 2) Levantar solo la base de datos en Docker
Desde la raíz del proyecto:

```bash
docker compose -f docker-compose.dev.yml up -d postgres
docker compose -f docker-compose.dev.yml ps
```

Opcional (ver logs DB):
```bash
docker compose -f docker-compose.dev.yml logs -f postgres
```

## 3) Backend local (NestJS)
```bash
cd pos_api
cp .env.example .env
npm ci
npx prisma migrate deploy
npx prisma db seed
npm run start:dev
```

Verificar en navegador:
- `http://localhost:3021/api/health`

## 4) Frontend local (Angular)
El frontend usa rutas relativas (`/api`), por eso en desarrollo local debes usar proxy.

```bash
cd pos_web
npm ci
npx ng serve --proxy-config proxy.local.json
```

Abrir:
- `http://localhost:4200`

## 5) Flujo recomendado diario
Terminal 1 (DB Docker):
```bash
docker compose -f docker-compose.dev.yml up -d postgres
```

Terminal 2 (API local):
```bash
cd pos_api
npm run start:dev
```

Terminal 3 (Web local):
```bash
cd pos_web
npx ng serve --proxy-config proxy.local.json
```

## 6) Comandos utiles
- Reiniciar DB dev:
```bash
docker compose -f docker-compose.dev.yml restart postgres
```
- Parar DB dev:
```bash
docker compose -f docker-compose.dev.yml down
```
- Resetear DB dev (borra datos):
```bash
docker compose -f docker-compose.dev.yml down -v
docker volume rm -f pos_pgdata_dev pos_uploads_dev 2>/dev/null || true
docker compose -f docker-compose.dev.yml up -d postgres
```

## 7) Problemas comunes
- `401` en login:
  - vuelve a ejecutar seed:
```bash
cd pos_api
npx prisma db seed
```
- `500` en endpoints:
  - aplicar migraciones:
```bash
cd pos_api
npx prisma migrate deploy
```
- Frontend no llega a API:
  - confirma que ejecutaste Angular con:
    - `npx ng serve --proxy-config proxy.local.json`
  - confirma que API está viva en `http://localhost:3021/api/health`
