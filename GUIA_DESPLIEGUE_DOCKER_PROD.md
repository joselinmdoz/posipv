# Guia de despliegue en produccion con Docker

Esta guia cubre dos escenarios:
- Primer despliegue (base vacia).
- Actualizacion de version sin perder datos (base con informacion en uso).

Proyecto: `posipv`  
Compose: `docker-compose.prod.yml`  
Entorno: `.env.prod`

## 1) Requisitos
- Docker Engine 24+.
- Docker Compose v2 (`docker compose version`).
- Puertos publicados segun tu infraestructura (normalmente `80/tcp`).
- Acceso al repo en el servidor.

## 2) Variables de entorno de produccion
Crear archivo:

```bash
cp .env.prod.example .env.prod
```

Ajustar al menos:
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Verificar que `.env.prod` no quede versionado en Git.

## 3) Primer despliegue (base vacia)
Ejecutar una sola vez en un entorno nuevo:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma db seed
docker compose --env-file .env.prod -f docker-compose.prod.yml restart api
```

Verificacion:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=200 api
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma migrate status
```

## 4) Actualizar version SIN perder datos (recomendado)
Este es el flujo correcto cuando ya tienes informacion en produccion.

### 4.1 Backup previo obligatorio
Desde la raiz del proyecto:

```bash
ts=$(date +%Y%m%d_%H%M%S)
mkdir -p backups
```

Backup de PostgreSQL:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U pos -d pos -Fc > backups/pos_${ts}.dump
```

Backup de archivos subidos (`uploads`):

```bash
docker run --rm \
  -v pos_uploads_prod:/data \
  -v "$PWD/backups":/backup \
  alpine sh -c "tar czf /backup/uploads_${ts}.tar.gz -C /data ."
```

### 4.2 Desplegar nueva version
No uses `down -v`, no borres volumenes, no recrees migraciones.

```bash
git pull
docker compose --env-file .env.prod -f docker-compose.prod.yml build api web
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d postgres
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm api npx prisma migrate deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d api web
```

### 4.3 Validacion post-despliegue

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=200 api
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=150 web
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma migrate status
```

Endpoints de salud esperados:
- `http://<host>/health`
- `http://<host>/api/health`

## 5) Recuperar usuario admin (si login falla)

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec \
  -e ADMIN_EMAIL=admin@pos.local \
  -e ADMIN_PASS=Admin1234 \
  api node -e 'const {PrismaClient,Role}=require("@prisma/client"); const bcrypt=require("bcryptjs"); (async()=>{const prisma=new PrismaClient(); const hash=await bcrypt.hash(process.env.ADMIN_PASS,10); await prisma.user.upsert({where:{email:process.env.ADMIN_EMAIL},update:{passwordHash:hash,role:Role.ADMIN,active:true},create:{email:process.env.ADMIN_EMAIL,passwordHash:hash,role:Role.ADMIN,active:true}}); console.log("admin listo"); await prisma.$disconnect();})().catch(e=>{console.error(e);process.exit(1);});'
```

## 6) Rollback rapido (si algo sale mal)
1. Regresar codigo a commit estable.
2. Rebuild y levantar servicios.
3. Si hubo cambio de esquema incompatible, restaurar backup de DB.

### 6.1 Restaurar DB desde dump
Atencion: esto sobreescribe la base actual.

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml stop api web
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  psql -U pos -d postgres -c "DROP DATABASE IF EXISTS pos;"
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  psql -U pos -d postgres -c "CREATE DATABASE pos OWNER pos;"
cat backups/pos_<timestamp>.dump | docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U pos -d pos --clean --if-exists --no-owner --no-privileges
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d api web
```

### 6.2 Restaurar uploads

```bash
docker run --rm \
  -v pos_uploads_prod:/data \
  -v "$PWD/backups":/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/uploads_<timestamp>.tar.gz -C /data"
```

## 7) Operacion diaria

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f
docker compose --env-file .env.prod -f docker-compose.prod.yml restart api web
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

## 8) Buenas practicas importantes
- Nunca ejecutar en produccion:
  - `docker compose ... down -v`
  - borrado manual de volumenes `pos_pgdata_prod` y `pos_uploads_prod`
  - recrear carpeta `prisma/migrations` en caliente
- Aplicar migraciones siempre con `prisma migrate deploy`.
- Mantener backups versionados por fecha (`backups/pos_YYYYmmdd_HHMMSS.dump`).
- Validar `health` y login admin despues de cada release.

## 9) Ajuste recomendado del compose (hardening)
Actualmente el servicio `api` ejecuta `npx prisma db seed` en cada arranque:

```yaml
command: sh -c "npx prisma migrate deploy && npx prisma db seed && node dist/src/main.js"
```

Recomendado en produccion:

```yaml
command: sh -c "npx prisma migrate deploy && node dist/src/main.js"
```

`seed` se ejecuta manualmente solo cuando sea necesario para no introducir cambios de datos no deseados en reinicios.

## 10) Troubleshooting rapido
- Si `migrate deploy` falla:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=300 api
docker compose --env-file .env.prod -f docker-compose.prod.yml run --rm api npx prisma migrate status
```

- Si API responde `500`:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api npx prisma migrate deploy
docker compose --env-file .env.prod -f docker-compose.prod.yml logs --tail=250 api
```

- Si frontend no conecta a backend:
  - revisar `CORS_ORIGIN` en `.env.prod`
  - revisar rutas proxy/config nginx del contenedor `web`
