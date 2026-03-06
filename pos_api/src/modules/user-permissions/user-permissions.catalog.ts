export type PermissionCatalogItem = {
  code: string;
  label: string;
  description: string;
  group: string;
};

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  { code: "dashboard.view", label: "Ver dashboard", description: "Permite ver métricas y resumen general.", group: "General" },
  { code: "reports.view", label: "Ver reportes", description: "Permite consultar reportes de ventas e inventario.", group: "General" },
  { code: "settings.manage", label: "Configurar sistema", description: "Permite modificar configuración general y de TPV.", group: "General" },

  { code: "products.view", label: "Ver productos", description: "Permite consultar el catálogo de productos.", group: "Inventario" },
  { code: "products.manage", label: "Gestionar productos", description: "Permite crear, editar y desactivar productos.", group: "Inventario" },
  { code: "warehouses.view", label: "Ver almacenes", description: "Permite consultar almacenes y existencias.", group: "Inventario" },
  { code: "warehouses.manage", label: "Gestionar almacenes", description: "Permite crear/editar almacenes y stock.", group: "Inventario" },
  { code: "warehouses.delete", label: "Eliminar almacenes", description: "Permite eliminar (desactivar) almacenes.", group: "Inventario" },
  { code: "warehouses.reset-stock", label: "Resetear stock", description: "Permite reiniciar a cero el stock de un almacén.", group: "Inventario" },
  { code: "stock-movements.manage", label: "Gestionar movimientos", description: "Permite registrar entradas/salidas/traslados.", group: "Inventario" },
  { code: "stock-movements.delete", label: "Eliminar movimientos", description: "Permite eliminar movimientos de inventario y revertir su impacto.", group: "Inventario" },
  { code: "inventory-reports.delete", label: "Eliminar reportes IPV", description: "Permite eliminar reportes IPV de una sesión.", group: "Inventario" },

  { code: "tpv.manage", label: "Gestionar TPV", description: "Permite administrar configuración y sesiones TPV.", group: "Ventas" },
  { code: "sales.tpv", label: "Vender en TPV", description: "Permite procesar ventas desde TPV.", group: "Ventas" },
  { code: "sales.direct", label: "Vender directo", description: "Permite registrar ventas directas.", group: "Ventas" },
  { code: "sales.void", label: "Anular ventas", description: "Permite anular/invalidar ventas.", group: "Ventas" },
  { code: "sales.delete", label: "Eliminar ventas", description: "Permite eliminar ventas y revertir stock.", group: "Ventas" },

  { code: "customers.view", label: "Ver clientes", description: "Permite consultar clientes.", group: "Clientes" },
  { code: "customers.manage", label: "Gestionar clientes", description: "Permite crear/editar clientes.", group: "Clientes" },

  { code: "employees.view", label: "Ver empleados", description: "Permite consultar empleados.", group: "RRHH" },
  { code: "employees.manage", label: "Gestionar empleados", description: "Permite crear/editar empleados.", group: "RRHH" },
  { code: "users.manage", label: "Gestionar usuarios", description: "Permite crear/editar usuarios del sistema.", group: "Seguridad" },
  { code: "permissions.manage", label: "Gestionar permisos", description: "Permite asignar permisos por usuario.", group: "Seguridad" },
];
