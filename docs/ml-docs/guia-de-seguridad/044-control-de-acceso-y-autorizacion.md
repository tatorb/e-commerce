<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/control-de-acceso-y-autorizacion -->
<!-- Sección: Guía de seguridad -->

# Control de acceso y autorización

Última actualización 30/03/2026

## Control de acceso y autorización

La aplicación que se integra a Mercado Libre maneja datos de múltiples sellers que deben ser protegidos. Sin un control de acceso adecuado, un usuario podría acceder a datos de sellers que no le corresponden, o realizar acciones para las que no tiene permiso.

Es por eso que necesitamos garantizar:

### Principios de autorización

- **Mínimo privilegio:**  otorgar solo los permisos estrictamente necesarios.

- **Denegación por defecto:**  si no hay un permiso explícito, se debe denegar el acceso.

- **Verificación en backend:**  las verificaciones deben hacerse siempre del lado del servidor, nunca confiar en validaciones del frontend. Deben realizarse mediante fuentes confiables como la sesión, y no a partir de parámetros fácilmente manipulables por un usuario.

- **Verificación en cada petición:**  se debe validar en cada operación los permisos antes de ejecutarla.

Veamos un ejemplo de cada principio:

#### Mínimo privilegio:

❌ **INCORRECTO:**

```
Todos los operadores tienen acceso de administrador
"Por si acaso necesitan algo"

Problema: Un operador comprometido = acceso total
```

✅ **CORRECTO:**

```
Rol "Operador de órdenes":
   ✅ Ver órdenes
   ✅ Actualizar estado de envío
   ❌ Modificar precios
   ❌ Eliminar publicaciones
   ❌ Gestionar usuarios

Solo tiene acceso a lo que necesita para su trabajo.
```

#### Denegación por defecto:

❌ **INCORRECTO:**

```
if (user.role == "blocked") {
    denyAccess();
}
// Si no está bloqueado, tiene acceso

Problema: Roles nuevos tienen acceso por defecto
```

✅ **CORRECTO:**

```
if (user.hasPermission("view_orders")) {
    allowAccess();
} else {
    denyAccess();  // Por defecto, denegar
}

Si no tiene permiso explícito, no tiene acceso.
```

#### Verificación en backend:

❌ **INCORRECTO:**

```
// Frontend (JavaScript)
if (user.role === "admin") {
    showAdminButton();
}

// Backend: No verifica nada, confía en el frontend

Problema: Atacante puede modificar el JavaScript o llamar
directamente a la API sin pasar por el frontend.
```

✅ **CORRECTO:**

```
// Frontend (JavaScript)
if (user.role === "admin") {
    showAdminButton();
}

// Backend (en cada request)
if (!user.hasPermission("admin_action")) {
    return error(403, "No autorizado");
}

// Procesar solo si tiene permiso
```

#### Verificación en cada petición:

❌ **INCORRECTO:**

```
Usuario hace login → Se verifica una vez → Tiene acceso a todo

Problema: Si los permisos cambian después del login,
no se refleja
```

✅ **CORRECTO:**

```
Cada petición:
   1. Verificar que la sesión es válida
   2. Verificar que el usuario tiene permiso para
      esta acción
   3. Verificar que el usuario tiene acceso a este seller
   4. Solo entonces, procesar la petición
```

### Segregación por seller

La app integradora debe garantizar que cada usuario pueda acceder solo a los sellers que tiene asignados.

- Establecer un esquema de roles y permisos que permita asignar sellers de manera explícita, de forma que cada usuario solo pueda gestionar los sellers que le han sido permitidos.

- Validar en cada operación, antes de mostrar o modificar datos, que la cuenta en cuestión tiene acceso a ese seller.

- Validar en lo posible poder responder a las preguntas: "¿Quién hizo qué, desde dónde, cuándo y con qué resultado?" con los logs disponibles en cada funcionalidad de la aplicación.

Apoyémonos del siguiente ejemplo para mayor claridad:

❌ **SIN SEGREGACIÓN:**

```
TU SISTEMA
+-------------------------------------------+
|                                           |
|  Juan (op.) --> Seller A    OK            |
|             --> Seller B    [X] sin perm. |
|             --> Seller C    [X] sin perm. |
|                                           |
+-------------------------------------------+
Problema: Juan accede a sellers no asignados
```

✅ **CON SEGREGACIÓN:**

```
TU SISTEMA
+-------------------------------------------+
|                                           |
|  Juan (op.) --> [Seller A] --> PERMITIDO  |
|      |                                    |
|      +--[X]--> [Seller B] --> DENEGADO    |
|      |                                    |
|      +--[X]--> [Seller C] --> DENEGADO    |
|                                           |
+-------------------------------------------+
Solo accede a los sellers que tiene asignados
```

### Gestión de permisos

- **Revisión periódica:**  auditar los permisos y realizar una re-certificación de accesos.

- **Revocación inmediata:**  al desvincular un colaborador, revocar los accesos inmediatamente.

- **Registro de cambios:**  documentar quién otorgó/revocó qué permiso y cuándo.

- **Separación de funciones:**  quien aprueba permisos no debe ser quien los solicita.

### ¿Cómo podemos verificar que seguimos los principios de autorización?

1. Crea 2 cuentas de usuario de prueba.

2. Asigna seller A al usuario 1.

3. Asigna seller B al usuario 2.

4. Inicia sesión como usuario 1.

5. Intenta acceder a datos del seller B.

Nota:

Puedes realizar esta misma prueba para iterar los diferentes roles y permisos que utilices.

| **Resultado** | **Significa** |
| --- | --- |
| Puedes ver los datos del seller B | ❌ Falló tu esquema de autorización, debes ajustarlo hasta que no lo permita |
| Puedes realizar acciones con un rol que no tiene permisos específicos para hacerlas | ❌ Falló tu esquema de autorización, debes ajustarlo hasta que no lo permita |
| Error 403 / 401 "Acceso denegado" | ✅ Funciona tu esquema de autorización |
| Error 404 "No encontrado" | ✅ Funciona tu esquema de autorización y con manejo de errores que oculta la existencia del recurso |

## Prevención de acceso a recursos no autorizados (IDOR)

**IDOR (Insecure Direct Object Reference)**  es una de las vulnerabilidades más comunes. Ocurre cuando un usuario puede acceder a recursos de otro simplemente cambiando un identificador en la URL o petición.

Ejemplo: si la aplicación muestra órdenes en `/orders/12345`, un atacante podría intentar `/orders/123456` para ver órdenes de otro seller.

❌ **VULNERABLE A IDOR:**

```
# ❌ VULNERABLE A IDOR:

@app.get("/orders/{order_id}")
def get_order(order_id: int):
    order = database.get_order(order_id)
    return order  # No verifica si el usuario tiene acceso

# Problema: Cualquiera puede ver cualquier orden cambiando el ID
```

Lo ideal sería que siempre se validara que el usuario que hace la solicitud realmente tenga permisos para hacerla:

✅ **PROTEGIDO CONTRA IDOR:**

```
# ✅ PROTEGIDO CONTRA IDOR:

@app.get("/orders/{order_id}")
def get_order(order_id: int, current_user: User):
    order = database.get_order(order_id)

    # Verificar que la orden pertenece al seller del usuario
    if order.seller_id not in current_user.allowed_sellers:
        raise HTTPException(403, "No tienes acceso a esta orden")
    return order
```

Es importante tener en cuenta los siguientes mecanismos de protección ante este tipo de fallo:

- **Siempre validar propiedad:**  antes de mostrar o modificar un recurso, verificar que pertenece al usuario/seller. En caso de empleados o colaboradores, garantizar que tienen los permisos necesarios para consultar recursos del seller correspondiente.

- **Validación en el servidor:**  la validación siempre debe estar del lado del backend y no del cliente (frontend).

- **Validar cada endpoint:**  no asumir que si pasó autenticación ya tiene autorización.

- **Usar el contexto de sesión:**  obtener el `seller_id` al resolver el token de sesión y nunca de parámetros de la petición.

**Recursos a proteger:**

- Órdenes de compra e información de las ventas.

- Publicaciones.

- Preguntas.

- Mensajes.

- Envíos.

- Pagos.

- Cualquier información u otra función no pública exclusiva del vendedor.

```
PARA CADA TIPO DE RECURSO, PRUEBA:

  ( 1 ) Inicia sesion como Usuario A
    |
    v
  ( 2 ) Accede a un recurso propio (ej: /orders/123)
    |
    v
  ( 3 ) Copia la URL
    |
    v
  ( 4 ) Inicia sesion como Usuario B (en otro navegador)
    |
    v
  ( 5 ) Pega la URL del recurso de Usuario A
```

## Referencias

- [OWASP Authorization Cheat Sheet:](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) guía completa de control de acceso y autorización.

- [OWASP IDOR Prevention Cheat Sheet:](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html) guía específica para prevenir IDOR.

- [OWASP Top 10 - A01:2021 Broken Access Control:](https://owasp.org/Top10/A01_2021-Broken_Access_Control/) problemas de control de acceso más comunes.

- [CWE-284: Improper Access Control:](https://cwe.mitre.org/data/definitions/284.html) categoría principal de problemas de control de acceso.

- [MELI - Autenticación y Autorización:](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion) documentación oficial de OAuth en MercadoLibre.

## Glosario

| **Término** | **Significado** |
| --- | --- |
| **Autorización** | Verificar QUÉ puede hacer un usuario ya autenticado (permisos, roles, recursos) |
| **RBAC** | Role-Based Access Control - Control de acceso basado en roles (admin, operador, viewer, etc.) |
| **ABAC** | Attribute-Based Access Control - Control de acceso basado en atributos (departamento, ubicación, horario, etc.) |
| **Principio de mínimo privilegio** | Dar a cada usuario solo los permisos estrictamente necesarios para su función |
| **Escalación de privilegios** | Ataque donde un usuario obtiene permisos que no le corresponden |
| **Escalación horizontal** | Acceder a recursos de otro usuario del mismo nivel (ej: ver órdenes de otro seller) |
| **Escalación vertical** | Obtener permisos de un rol superior (ej: usuario normal actúa como admin) |
| **Object-level authorization** | Verificar permisos a nivel de cada objeto/recurso individual, no solo a nivel de endpoint |
| **Bypass de autorización** | Evadir controles de acceso para realizar acciones no permitidas |
| **Middleware de autorización** | Capa de código que verifica permisos antes de ejecutar la lógica del endpoint |
| **Auditoría de acceso** | Registrar quién accedió a qué recurso y cuándo, para detectar accesos indebidos |

**Siguiente** : [Seguridad de aplicaciones](https://developers.mercadolibre.com.ar/es_ar/seguridad-apps).
