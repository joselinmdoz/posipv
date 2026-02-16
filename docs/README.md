# Documentación del Proyecto POS IPv

## Índice

1. **[API - Endpoints](./API/endpoints.md)**
   - Todos los endpoints REST disponibles
   - Métodos HTTP y payloads

2. **[Autenticación](./Autenticacion/sistema.md)**
   - Sistema de login con JWT
   - Protección de rutas
   - Interceptor de autenticación

3. **[Rutas del Frontend](./Rutas/frontend.md)**
   - Estructura de rutas
   - Lazy loading
   - Guards de autenticación

4. **[Modelos de Datos](./ModelosDatos/prisma.md)**
   - Esquema de Prisma
   - Relaciones entre entidades
   - Enumeraciones

5. **[Servicios HTTP](./Servicios/http.md)**
   - Configuración de Angular HttpClient
   - Servicios del frontend
   - Interceptors

6. **[Componentes](./Componentes/estructura.md)**
   - Estructura de componentes
   - Layout principal
   - Páginas principales

7. **[Guía de Usuario](./GuiasUsuario/manual.md)**
   - Manual para usuarios finales
   - Operaciones comunes
   - Solución de problemas

---

## Inicio Rápido

### Ejecutar el Proyecto

```bash
# Terminal 1: Base de datos (Docker)
docker start pos_postgres_dev

# Terminal 2: Backend
cd pos_api
npm run start:dev

# Terminal 3: Frontend
cd pos_web
npm start
```

### Acceder a la Aplicación

- Frontend: http://localhost:4200
- Backend API: http://localhost:3021/api

### Credenciales por Defecto

- Email: admin@pos.local
- Password: Admin123!

---

## Tecnologías

### Backend
- NestJS 11.x
- Prisma 6.x
- PostgreSQL 16
- JWT Authentication
- TypeScript

### Frontend
- Angular 21
- PrimeNG 21
- TailwindCSS
- TypeScript

---

## Estructura del Proyecto

```
posipv/
├── pos_api/              # Backend (NestJS)
│   ├── src/
│   │   └── modules/     # Módulos de la API
│   ├── prisma/          # Esquema y migraciones
│   └── Dockerfile        # Imagen Docker
│
├── pos_web/             # Frontend (Angular)
│   ├── src/
│   │   └── app/        # Componentes y servicios
│   └── Dockerfile       # Imagen Docker
│
├── docs/                # Documentación
│   ├── API/
│   ├── Autenticacion/
│   ├── Rutas/
│   ├── ModelosDatos/
│   ├── Servicios/
│   ├── Componentes/
│   └── GuiasUsuario/
│
├── docker-compose.dev.yml
└── docker-compose.prod.yml
```

---

## Configuración de Puertos

| Servicio | Puerto |
|----------|--------|
| PostgreSQL | 5421 |
| Backend API | 3021 |
| Frontend | 4200 |

---

## Más Información

- [Endpoints de API](./API/endpoints.md)
- [Sistema de Autenticación](./Autenticacion/sistema.md)
- [Modelos de Datos](./ModelosDatos/prisma.md)
