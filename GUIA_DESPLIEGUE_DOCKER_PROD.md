# Guia de despliegue en produccion con Docker (base vacia)

## 1) Requisitos
- Docker Engine.
- Docker Compose v2 (`docker compose version`).
- Puerto `80/tcp` abierto.

## 2) Consolidar migraciones en una sola `init` (recomendado si no hay datos)
Ejecutar una sola vez:

```bash
cd pos_api
npm ci
find prisma/migrations -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
ts=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${ts}_init
PRISMA_HIDE_UPDATE_MESSAGE=1 ./node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | awk 'BEGIN{p=0} /^-- /{p=1} p{print}' > prisma/migrations/${ts}_init/migration.sql
sed -n '1,10p' prisma/migrations/${ts}_init/migration.sql
cd ..
```

Verificar que en `pos_api/prisma/migrations` quede solo:
- `${ts}_init`
- `migration_lock.toml`

## 3) Variables de entorno
```bash
cp .env.prod.example .env.prod
```

Editar `.env.prod` y definir:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

## 4) Limpieza total del despliegue anterior
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v --remove-orphans
docker volume rm -f pos_pgdata_prod pos_uploads_prod 2>/dev/null || true
```

## 5) Build y arranque desde cero
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma db seed
docker compose --env-file .env.prod -f docker-compose.prod.yml restart api
```

## 6) Verificacion
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=150 api
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma migrate status
```

Probar:
- `http://localhost/`
- `http://localhost/health`
- `http://localhost/api/health`

Login:
- Email: valor de `SEED_ADMIN_EMAIL`
- Password: valor de `SEED_ADMIN_PASSWORD`

## 7) Recuperar admin si login da 401
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -e ADMIN_EMAIL=admin@pos.local -e ADMIN_PASS=Admin1234 api node -e 'const {PrismaClient,Role}=require("@prisma/client"); const bcrypt=require("bcryptjs"); (async()=>{const prisma=new PrismaClient(); const hash=await bcrypt.hash(process.env.ADMIN_PASS,10); await prisma.user.upsert({where:{email:process.env.ADMIN_EMAIL},update:{passwordHash:hash,role:Role.ADMIN,active:true},create:{email:process.env.ADMIN_EMAIL,passwordHash:hash,role:Role.ADMIN,active:true}}); console.log("admin listo"); await prisma.$disconnect();})().catch(e=>{console.error(e);process.exit(1);});'
```

## 8) Operacion diaria
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
docker compose --env-file .env.prod -f docker-compose.prod.yml restart
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

## 9) Actualizar version
```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

## 10) Troubleshooting rapido
- Si `migrate deploy` falla con `P3018` y el SQL dice `syntax error at or near "Need"` o `[dotenv`:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml down -v --remove-orphans
docker volume rm -f pos_pgdata_prod pos_uploads_prod 2>/dev/null || true

cd pos_api
npm ci
find prisma/migrations -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +
ts=$(date +%Y%m%d%H%M%S)
mkdir -p prisma/migrations/${ts}_init
PRISMA_HIDE_UPDATE_MESSAGE=1 ./node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | awk 'BEGIN{p=0} /^-- /{p=1} p{print}' > prisma/migrations/${ts}_init/migration.sql
cd ..

docker compose --env-file .env.prod -f docker-compose.prod.yml build --no-cache api
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm api npx prisma db seed
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d api web
```
- Si alguna ruta `/api/...` devuelve `500`:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=200 api
```
- Los warnings de navegador sobre `touchstart/touchmove` no causan errores 500 del backend.
