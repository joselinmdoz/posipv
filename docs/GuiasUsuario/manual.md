# Manual de Usuario - POS IPv

## Introducción

Bienvenido al sistema POS (Point of Sale) IPv. Este manual te guiará a través de las funcionalidades principales del sistema.

---

## Requisitos del Sistema

### Acceso a la Aplicación

Para acceder al sistema necesitas:

1. Un navegador web moderno (Chrome, Firefox, Edge, Safari)
2. Credenciales de usuario válidas
3. Conexión a la red del sistema

### Credenciales por Defecto

El sistema viene con un usuario administrador por defecto:

- **Email:** admin@pos.local
- **Password:** Admin123!

> ⚠️ **Importante:** Cambia la contraseña después del primer inicio de sesión.

---

## Iniciar Sesión

### Pasos para el Login

1. Abre tu navegador e ingresa la URL: `http://localhost:4200`

2. Serás redirigido a la página de inicio de sesión

3. Ingresa tu correo electrónico en el campo "Email"

4. Ingresa tu contraseña en el campo "Password"

5. Haz clic en el botón "Sign In"

6. Si las credenciales son correctas, serás redirigido al dashboard

### Manejo de Errores

- **Credenciales inválidas:** Se mostrará un mensaje de error
- **Campos vacíos:** El botón de inicio sesión estará deshabilitado

---

## Dashboard

El dashboard es la pantalla principal después de iniciar sesión. Muestra:

- Resumen de ventas del día
- Productos más vendidos
- Notificaciones recientes
- Estadísticas de ingresos

---

## Gestión de Productos

### Crear Producto

1. Navega a la sección de productos
2. Haz clic en "Nuevo Producto"
3. Completa los campos:
   - Nombre del producto
   - SKU (código)
   - Precio
   - Costo (opcional)
   - Unidad de medida
4. Haz clic en "Guardar"

### Editar Producto

1. Busca el producto en la lista
2. Haz clic en el botón de edición
3. Modifica los campos necesarios
4. Haz clic en "Guardar"

---

## Punto de Venta (POS)

### Realizar una Venta

1. Abre una caja registradora
2. Busca productos por nombre o escanea el código de barras
3. Agrega los productos al carrito
4. Selecciona el método de pago
5. Confirma la venta
6. Imprime el ticket (si está configurado)

### Abrir Caja

1. Ve a la sección de cajas
2. Haz clic en "Abrir Caja"
3. Ingresa el monto inicial
4. Confirma la apertura

### Cerrar Caja

1. Ve a la sección de cajas
2. Haz clic en "Cerrar Caja"
3. Ingresa el monto final
4. Agrega notas si es necesario
5. Confirma el cierre

---

## Gestión de Inventario

### Movimientos de Stock

Para registrar movimientos de inventario:

1. Ve a "Inventario" > "Movimientos"
2. Selecciona el tipo de movimiento:
   - **Entrada:** Compra de mercancía
   - **Salida:** Venta o pérdida
   - **Transferencia:** Entre almacenes
3. Selecciona el producto
4. Ingresa la cantidad
5. Indica el motivo
6. Confirma el movimiento

---

## Gestión de Usuarios

### Crear Nuevo Usuario

Solo los administradores pueden crear usuarios:

1. Ve a "Configuración" > "Usuarios"
2. Haz clic en "Nuevo Usuario"
3. Completa los datos:
   - Email
   - Contraseña
   - Rol (Administrador o Cajero)
4. Asigna los permisos correspondientes
5. Guarda el usuario

---

## Configuración

### Configurar Caja

1. Ve a "Configuración" > "Cajas"
2. Selecciona la caja a configurar
3. Ajusta:
   - Nombre
   - Método de apertura de caja
   - Almacén predeterminado
   - Métodos de pago habilitados

### Métodos de Pago

Configura los métodos de pago aceptados:

1. Ve a "Configuración" > "Métodos de Pago"
2. Activa o desactiva cada método
3. Guarda los cambios

---

## Cierre de Sesión

Para cerrar sesión:

1. Haz clic en tu perfil (esquina superior derecha)
2. Selecciona "Cerrar Sesión"
3. Confirmas la acción

---

## Solución de Problemas

### No puedo iniciar sesión

1. Verifica que el servidor esté funcionando
2. Confirma tus credenciales
3. Limpia la caché del navegador

### Los productos no aparecen

1. Verifica la conexión a la base de datos
2. Confirma que los productos estén activos
3. Actualiza la página

### Error de conexión

1. Verifica que el backend esté ejecutándose
2. Confirma que PostgreSQL esté corriendo
3. Revisa la configuración de red

---

## Glosario

| Término | Descripción |
|---------|-------------|
| POS | Point of Sale - Punto de Venta |
| SKU | Stock Keeping Unit - Código de producto |
| Cash Session | Sesión de caja |
| Stock | Inventario |
| Dashboard | Panel de control |

---

## Contacto y Soporte

Para soporte técnico, contacta al administrador del sistema.
