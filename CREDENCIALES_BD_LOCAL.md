# Credenciales de Base de Datos Local (Desarrollo)

## Acceso desde tu máquina (host)
- Motor: PostgreSQL
- Host: `localhost`
- Puerto: `5421`
- Base de datos: `pos`
- Usuario: `pos`
- Contraseña: `pos123`
- URL completa:
  - `postgresql://pos:pos123@localhost:5421/pos?schema=public`

## Acceso desde contenedores Docker (red interna)
- Host: `postgres`
- Puerto: `5432`
- Base de datos: `pos`
- Usuario: `pos`
- Contraseña: `pos123`
- URL completa:
  - `postgresql://pos:pos123@postgres:5432/pos?schema=public`

