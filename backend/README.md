# Edición de operadores

La función adicional `digiturno_v2` y la Edge Function `digiturno-operators` están desplegadas en el proyecto del digiturno. El endpoint principal permanece sin cambios.

`operator-edit.sql` contiene la función SQL adicional. Requiere las tablas y la función `digiturno_api` ya existentes. `operator-api.ts` es el código del endpoint dedicado; solo utiliza las variables de servidor de Supabase y no contiene claves privadas.

La edición requiere sesión de administrador. Un PIN vacío conserva el hash actual; uno nuevo debe tener cuatro dígitos y revoca las sesiones del box editado. Renombrar conserva preferencias, sesiones, historial y notas. El historial y las notas siguen vinculados al box renombrado; el llamado activo no se reescribe.

Las operaciones de box y las ediciones comparten un bloqueo transaccional para evitar cambios de identidad a mitad de una operación. No se modifican claves foráneas ni permisos de la API anterior. La nueva función SQL solo se puede ejecutar desde el servidor.

Los colores personalizados y el estilo de esquinas se guardan dentro de `config`, junto con las opciones anteriores. Los colores de franjas se guardan en `rss`. No requieren cambios en las tablas.
