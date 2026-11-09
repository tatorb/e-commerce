<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/agrupacion-de-paquetes-para-la-colecta -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Agrupación de paquetes para la Colecta

Última actualización 19/05/2026

## Agrupación de paquetes para la Colecta

Esta funcionalidad te permite optimizar la colecta de envíos, habilitando al seller a declarar previamente los paquetes que entregará y generar una contenerización virtual. A partir de esta declaración, se pueden agrupar los paquetes en sacas, cajas o palets, generando una nueva etiqueta para el grupo, lo que permite que el driver realice un solo escaneo por grupo creado, reduciendo fricción operativa y mejorando significativamente el performance y la velocidad del proceso de colecta.
 
 En esta guía, te mostraremos el paso a paso para gestionar todo el proceso de creación y edición de los grupos y paquetes (técnicamente bundles y volumes). 
 
¡Prepárate para llevar tus colectas al siguiente nivel de eficiencia y agilidad.

**Importante:**

Reforzamos que debe ser usado el scope de **test**  en el proceso de desarrollo, enviando el header **x-scope**  con el valor **"test"**  en todas las llamadas.

## 1. Validar usuario

Antes de poder crear un bundle, necesitas verificar que el usuario esté habilitado con esta funcionalidad. 
 Este recurso te permite validar los vendedores habilitados para utilizar la funcionalidad de agrupación de paquetes para las colectas.

### Llamada:

```
curl -X GET "https://api.mercadolibre.com/soe/bundles/users/validate" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $ACCESS_TOKEN"
```

### Ejemplo:

```
curl -X GET "https://api.mercadolibre.com/soe/bundles/users/validate" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer {ACCESS_TOKEN}"

// Respuesta:
// 200 OK
{
  "active": true,
  "init_date": 2026-03-12T13:09:00Z
}

// 200 OK
{
  "active": false,
  "reason": "FEATURE_DISABLED"
}
```

### Campos de la respuesta

- `active`: Campo boolean que indica si el integrador tiene la experiencia activa.

- `init_date`: Campo que indica la fecha de activación de la feature.

- `reason`: Campo que indica la razón de NO activación de la feature. Esto quiere decir que si `active` es `true`, el campo viene nulo. En caso contrario viene con el valor `FEATURE_DISABLED`.

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 403 | At least one policy returned UNAUTHORIZED | The integrator is missing read/write permissions for Shipments and Sales or does not have the grouping feature enabled |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 2. Crear Bundle

Este recurso te permite crear un bundle de envíos a partir de la contenerización virtual definida por el seller, asociando múltiples paquetes a una única unidad contenerizada. Al generar el bundle, se obtiene un ID identificador del bundle y un hash calculado a partir del ID, el nombre, la fecha de creación y el client_id recibido en el token. Este hash luego se deberá pasar como parámetro obligatorio (en forma de autorización sobre el bundle) en la adición y remoción de paquetes (shipments) con el fin de que cuentas distintas del vendedor puedan agrupar en un mismo bundle.

Nota:

Solo permitimos la agrupación de los paquetes (envíos) luego de la impresión de la etiqueta, idealmente en los estados de:

- `ready_to_ship`

con subestados:

- `ready_for_pickup`

- `printed`

### Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles
```

### Parámetros obligatorios

| Variable | Descripción |
| --- | --- |
| N/A | Todos los parámetros van en el body |

### Body

| Campo | Descripción |
| --- | --- |
| name | Nombre del bundle |
| volumes | Listado de IDs de shipment (opcional) |

### Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \ https://api.mercadolibre.com/soe/bundles
-H 'Content-Type: application/json' \
-d '{"name": "{bundle_name}", "volumes": ["123", "234"]}' \

// Respuesta:
{
  "id": 2073,
  "name": "{bundle_name}",
  "status": "OPENED",
  "service_type": "XD",
  "create_date": "2025-11-05T16:13:02.710912202",
  "update_date": "2025-11-05T16:13:02.710912202",
  "scan_code_id": "",
 "volumes": [{
      ...,
      "reference_id": {shipment_id}
      ...
  }],
  "hash": "abcd1234"
}
```

### Campos de la respuesta

- `id`: Campo numérico con el ID del bundle. (Tipo: Long)

- `name`: Campo string con el Nombre del bundle. (Tipo: String, Tamaño: 15, Requerido: Si)

- `status`: Campo string con el Estado del bundle. (Tipo: Constante, Requerido: Si, Valores: OPENED)

- `create_date`: Campo fecha con la fecha de creación del bundle. (Tipo: LocalDateTime)

- `update_date`: Campo fecha con la fecha de actualización del bundle. (Tipo: LocalDateTime)

- `service_type`: Campo constante (Tipo: Constante, Requerido: Si, Valores: XD)

- `hash`: Campo string con hash asociado al bundle para permitir adición/remoción de paquetes (Tipo: String, Requerido: Si)

- `volumes.reference_id`: Id de shipments (Tipo: String, Tamaño: 12, Requerido: No)

**Respuesta en error al validar volumen 409:**

```
{
  "volume_id": "{volume_id}",
  "bundle_name": "(depende del caso de uso)",
  "reason": "{reason}"
}
```

### Errores

| Variable | Descripción | Valores | Detalle |
| --- | --- | --- | --- |
| **volume_id** | Id del volume error | String |  |
|  |  | **ERR_SHIPMENT_INVALID** | ocurre cuando el shipment es invalido para la operación.. |
|  |  | **ERR_SHIPMENT_CANCELLED** | ocurre cuando un shipment fue cancelado. |
|  |  | **ERR_SHIPMENT_NOT_FOUND** | ocurre cuando el shipment no existe. |
|  |  | ERR_SHIPMENT_FEATURE_DISABLED | ocurre cuando el usuario dueño del shipment no tiene la experiencia de OneBip activa. |
| **reason** | Descripción del error | **ERR_LOGISTIC** | ocurre cuando la logística es inválida, |
|  |  | **ERR_NOT_READY_FOR_PICKUP_OR_NOT_PRINTED** | ocurre cuando el shipment no está en el estado y subestado correcto. |
|  |  | **ERR_SHIPMENT_EXIST_IN_OTHER_BUNDLE** | ocurre cuando el shipment existe en otro bundle. |
|  |  | **ERR_SHIPMENT_DUPLICATED** | error de validación de duplicidad |
|  |  | **ERR_BUNDLE_LIMIT_EXCEEDED_SHIPMENT** | El límite de shipment excedió el límite máximo 450. |

## Errores genéricos:

| Http Code | Message | Solution |
| --- | --- | --- |
| **201** | Created | - |
| **400** | Bad arguments | Validar el formato del JSON |
| **401** | User is not authorized into the application | El usuario no tiene acceso a la aplicación |
| **409** | The request generates conflict with existing data | Ya existe un bundle con características similares. Verificar unicidad de datos |
| **424** | An external dependency has failed | Error en servicio externo de gestión de bundles |
| **500** | Internal server error | Error interno del servidor |

## 3.1. Búsqueda de Bundle por ID

Este recurso te permite obtener la información de un bundle existente a partir de su identificador. A través de la búsqueda por bundle_id, es posible consultar el resumen del bundle, incluyendo los datos asociados a la unidad contenerizada, los paquetes que la componen y su estado, facilitando la trazabilidad y validación del agrupamiento durante el proceso logístico.

### Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/{bundle_id}/summary
```

### Parámetros de consulta obligatorios

| Variable | Descripción |
| --- | --- |
| bundle_id | ID del bundle a buscar |

### Ejemplo

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/12345/summary
```

### Campos de respuesta para todas las búsquedas

Bundle Summary

- `id`: Id del bundle

- `bundle_name`: Nombre del bundle

- `service_type`: Tipo de servicio/logística con el que se operará el bundle

- `status`: Estado actual del bundle

- `created_date`: Fecha de creación del bundle

- `update_date`: Fecha de última actualización del bundle

- `scan_code_id`: Id de etiqueta del bundle

Volume

- `id`: Id del volumen

- `bundle_id`: Id del bundle

- `reference_id`: Id del volumen en la network de MELI

- `status`: Estado actual del volumen en contexto de kitting

- `create_date`: Fecha de creación del volumen

- `update_date`: Fecha de última actualización del volumen

## Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Bundle data not found for given user and ID | El usuario o bundle especificado no existe en el sistema |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 3.2. Búsqueda de Bundle por Referencia

Este recurso te permite buscar bundles a partir de una referencia parcial, ya sea por nombre o por código bipeable asociado al bundle. La búsqueda por bundle_reference facilita la identificación de unidades contenerizadas cuando no se dispone del ID exacto, devolviendo un listado de bundles coincidentes para mejorar la trazabilidad y la gestión operativa durante la colecta y los procesos logísticos posteriores.

### Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/search
```

### Parámetros de consulta obligatorios

| Variable | Descripción |
| --- | --- |
| bundle_reference | Parte del nombre o del código bipeable del bundle |

### Ejemplo

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/search?bundle_reference=ABCD1234
```

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | One or more of the given parameters is invalid | Verificar que **bundle_reference**  sea válido. **bundle_reference**  no puede ser vacío o null |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Bundle data not found for given user | El usuario o el bundle especificado no existe en el sistema |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 3.3. Búsqueda de Bundles por usuario

Este recurso te permite buscar todos los bundles del usuario integrado. Esta búsqueda trae la información de todos los bundles abiertos, cerrados, finalizados y cancelados. Este recurso no trae información acerca de volúmenes, sin embargo trae información suficiente para luego ejecutar consultas a nivel de bundles (o grupos de bundles) específicos.

### Llamada

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles
```

### Ejemplo

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles

// Respuesta
[
  {
    "id": 2073,
    "name": "{bundle_name}",
    "status": "OPENED",
    "service_type": "XD",
    "create_date": "2025-11-05T16:13:02.710912202",
    "update_date": "2025-11-05T16:13:02.710912202",
    "scan_code_id": "",
    "hash": "abcd1234"
  },
  ...
]
```

### Campos de la respuesta (Listado de objetos)

### Errores

| **Http Code** | **Message** | **Solution** |
| --- | --- | --- |
| `401` | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header. |
| `404` | Bundle data not found for given user | El usuario especificado no existe en el sistema. |
| `424` | An external dependency has failed | Error en servicio externo. |
| `500` | Internal server error | Error interno del servidor. |

## 3.4. Búsqueda de Volumes por ID de Bundle

Este recurso te permite obtener el listado de volúmenes asociados a un bundle específico a partir de su identificador. Mediante la búsqueda por bundle_id, es posible consultar los paquetes individuales que componen la unidad contenerizada, accediendo a su información detallada para facilitar la trazabilidad, validación operativa y control del contenido durante la colecta y las etapas posteriores del flujo logístico.

### Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/{bundle_id}/volumes
```

### Parámetros de consulta obligatorios

| Variable | Descripción |
| --- | --- |
| bundle_id | ID del bundle cuyos volúmenes se debe buscar |

### Ejemplo

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/12345/volumes
```

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | One or more of the given parameters is invalid | Verificar que bundle_id sea válido. bundle_id no puede ser vacío o null |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Management data not found for given user | El usuario especificado no existe en el sistema |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 3.5. Búsqueda de volumes por referencia y ID de Bundle

Este recurso te permite buscar volúmenes específicos dentro de un bundle determinado, combinando el ID del bundle con una referencia parcial del volumen. A través del parámetro volume_reference, es posible identificar uno o más paquetes dentro de la unidad contenerizada cuando no se dispone del identificador completo, facilitando la localización puntual, trazabilidad y validación operativa de los volúmenes asociados.

### Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/{bundle_id}/volumes/search
```

### Parámetros de consulta obligatorios

| Variable | Descripción |
| --- | --- |
| bundle_id | ID del bundle cuyos volumes se debe buscar |
| volume_reference | Parte de ID del shipment que se quiere buscar dentro del bundle |

### Ejemplo

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/12345/volumes/search?volume_reference=451235132
```

### Errores

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | One or more of the given parameters is invalid | Verificar que bundle_id y volume_references sean válidos. bundle_id y volume_reference no pueden ser vacio o null |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Volume data not found for given user | El usuario o el volumen especificado no existe en el sistema |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 4. Actualizar Bundle

Este recurso te permite actualizar la información de un bundle existente a partir de su identificador. Mediante esta operación es posible modificar el nombre y/o el estado del bundle, reflejando cambios en la unidad contenerizada a lo largo de su ciclo de vida. Además se permite la eliminación del bundle pasando el status DELETED en el cuerpo de la request.

| Variable | Descripción |
| --- | --- |
| bundleId | ID del bundle a actualizar (path parameter) |

### Llamada:

```
curl -X PUT "https://api.mercadolibre.com/soe/bundles/{bundleId}" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-d '{"name": "name", "status": "status"}'
```

### Body

| Campo | Descripción | Valores permitidos |
| --- | --- | --- |
| name | Nombre actualizado del bundle |  |
| status | Status del bundle | CLOSED, DELETED |

### Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{"name": "Bundle actualizado", "status": "CLOSED"}' \
https://api.mercadolibre.com/soe/bundles/789
```

### Campos de la respuesta

- `id`: Campo numérico con el ID del bundle. (Tipo: Long)

- `name`: Campo string con el Nombre del bundle. (Tipo: String, Tamaño: 15, Requerido: Si)

- `status`: Campo string con el Estado del bundle. (Tipo: Constante, Requerido: Si, Valores: OPENED, CLOSED)

- `create_date`: Campo fecha con la fecha de creación del bundle. (Tipo: LocalDateTime)

- `update_date`: Campo fecha con la fecha de actualización del bundle. (Tipo: LocalDateTime)

- `service_type`: Campo constante (Tipo: Constante, Requerido: Si, Valores: XD)

- `hash`: Campo string con hash asociado al bundle para permitir adición/remoción de paquetes (Tipo: String, Requerido: Si)

Nota:

Si el estado es DELETED, la respuesta será vacia

### Errores de validación

| Variable | Descripción | Valores | Detalle |
| --- | --- | --- | --- |
| status | estado del bundle | String |  |
| bundle_name | nombre del bundle | String |  |
|  |  | ERR_USER_WITH_FEATURE_DISABLED | ocurre cuando el usuario no tiene activa la experiencia. |
|  |  | ERR_BUNDLE_FINISHED | ocurre cuando un bundle está finalizado e intentas eliminarlo. |
|  |  | ERR_DELETING_BUNDLE | Ocurre cuando falla la eliminación de un bundle. |
|  |  | ERR_DATA_NOT_FOUND | ocurre cuando no encuentras un bundle. |
|  |  | ERR_BUNDLE_IS_DELETED | ocurre cuando intentas eliminar un bundle que ya está eliminado. |
| reason | Descripción del error | ERR_TRANSITION_BUNDLE_STATUS | ocurre cuando intentas cerrar un bundle y no tiene el estado OPENED. |
|  |  | ERR_TRANSITION_STATUS_CLOSED_WITH_BUNDLE_EMPTY | ocurre cuando intentas cerrar un bundle que no tiene shipments agregados. |
|  |  | ERR_TRANSITION_BUNDLE_STATUS_WITH_ALL_VOLUMES_CANCELLED | ocurre cuando intentas cerrar un bundle con todos su shipments cancelados. |
|  |  | ERR_TRANSITION_BUNDLE_TEST_USER | ocurre cuando se intenta cerrar un bundle creado en producción con un usuario de test. |
|  |  | ERR_CLOSING_BUNDLE | Ocurre cuando falla el cierre de un bundle, se omiten detalles del fallo. |

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | One or more of the given parameters is invalid | Verificar que bundleId sea un número positivo válido |
| 400 | Bad arguments | Validar el formato del body JSON y que cumplan con las validaciones |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Bundle data not found for given user | El bundle especificado no existe |
| 409 | The request generates conflict with existing data | La actualización genera conflicto con el estado actual del bundle |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 5. Agregar Volúmenes al Bundle

Este recurso te permite agregar uno o más volúmenes a un bundle existente, asociando paquetes individuales a una unidad contenerizada ya creada. A través del envío del listado de IDs de shipment, es posible incorporar nuevos volúmenes al bundle, manteniendo la coherencia del agrupamiento.

### Llamada:

```
curl -X PUT "https://api.mercadolibre.com/soe/bundles/{bundle_id}/volumes" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-d '{"volumes": ["volume_id", "volume_id", ...] "hash": "hashcode"}'}'
```

### Parámetros obligatorios

| Variable | Descripción |
| --- | --- |
| bundleId | ID del bundle que debe contener los volúmenes (path parameter) |

### Body

| Campos | Descripción |
| --- | --- |
| volumes | Listado de IDs de shipments a agregar |
| hash | Hash asociado al bundle |

### Ejemplo:

```
curl -X PUT "https://api.mercadolibre.com/soe/bundles/12345/volumes" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-d '{"volumes": ["123456789", "987654321", "555666777", "111222333", "444555666"], "hash": "abcd1234"}'

// Respuesta:
// 200 OK

// Response Error:
{
  "status": "CLOSED",
  "reason": "ERR_INVALID_BUNDLE_STATUS",
  "max_limit": 0,
  "bundle_name": "GRUPO 7"
}

// Or:
{
  "status": "OPENED",
  "reason": "ERR_BUNDLE_IS_DELETED",
  "max_limit": 0
}
// Or:
{
  "reason": "ERR_BUNDLE_HASH_MISMATCH",
  "max_limit": 0
}

// Or:
{
  "volume_id": "{volume_id}",
  "bundle_name": "(depende del caso de uso)",
  "reason": "{reason}"
}
```

### Errores de validación (Campos de respuesta de error)

| Variable | Descripción | Valores | Detalle |
| --- | --- | --- | --- |
| volume_id | Id del volume error | String |  |
|  |  | ERR_SHIPMENT_INVALID | ocurre cuando el shipment es invalido no existe. |
|  |  | ERR_SHIPMENT_CANCELLED | ocurre cuando un shipment fue cancelado. |
|  |  | ERR_SHIPMENT_NOT_FOUND | ocurre cuando el shipment no existe. |
|  |  | ERR_BUNDLE_HASH_MISMATCH | ocurre cuando el hash del body no coincide con el calculado en la creación del bundle. |
|  |  | ERR_SHIPMENT_FEATURE_DISABLED | ocurre cuando el usuario dueño del shipment no tiene la experiencia de OneBip activa. |
| reason | Descripción del error | ERR_LOGISTIC | ocurre cuando la logística es invalida. |
|  |  | ERR_NOT_READY_FOR_PICKUP_OR_NOT_PRINTED | ocurre cuando el shipment no está en el estado y subestado correcto. |
|  |  | ERR_SHIPMENT_ALREADY_EXIST_IN_THE_BUNDLE | ocurre cuando el shipment ya existe en el bundle actual. |
|  |  | ERR_SHIPMENT_EXIST_IN_OTHER_BUNDLE | ocurre cuando el shipment existe en otro bundle. |

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | One or more of the given parameters is invalid | Verificar que bundleId sea un número positivo válido |
| 400 | Bad arguments | Validar el formato del body JSON con lista de volúmenes válida |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Bundle data not found for given user | El bundle especificado no existe |
| 409 | The request generates conflict with existing data | Los volúmenes ya están asociados al bundle o hay conflicto de estado |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 6. Remover Volúmenes del Bundle

Este recurso te permite remover uno o más volúmenes de un bundle existente, desvinculando paquetes individuales de la unidad contenerizada. A través del envío del listado de IDs de shipment, es posible ajustar la composición del bundle, reflejando cambios operativos y manteniendo la consistencia.

### Llamada:

```
curl -X DELETE "https://api.mercadolibre.com/soe/bundles/{bundle_id}/volumes" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-d '{"volumes": ["volume_id", "volume_id", "volume_id"], "hash": "hashcode"}'
```

### Parámetros obligatorios

| Variable | Descripción |
| --- | --- |
| bundleId | ID del bundle que debe remover los shipments (path parameter) |

### Body

| Campos | Descripción |
| --- | --- |
| volumes | Listado de IDs de shipments a eliminar |
| hash | Hash asociado al bundle |

### Ejemplo:

```
curl -X DELETE "https://api.mercadolibre.com/soe/bundles/12345/volumes" \
-H "Content-Type: application/json" \
-H "Authorization: Bearer {tu_token}" \
-d '{"volumes": ["123456789", "987654321", "555666777"], "hash": "abcd1234"}'

// Respuesta:
// 200 OK
```

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | One or more of the given parameters is invalid | Verificar que bundleId sea un número positivo válido |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Bundle data not found for given user | El bundle especificado no existe |
| 409 | The request generates conflict with existing data | Los volúmenes no pueden ser removidos debido a su estado actual |
| 424 | An external dependency has failed | Error en servicio externo. |
| 500 | Internal server error | Error interno del servidor. |

## 7. Descargar Archivo

Este recurso te permite descargar el archivo asociado a un bundle específico, a partir de su identificador. Con eso, es posible obtener el archivo CSV generado con la información del bundle y su contenerización, facilitando la impresión, validación y uso operativo de la documentación necesaria durante la colecta.

### Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/{bundleId}/file
```

### Parámetros de consulta obligatorios

| Variable | Descripción |
| --- | --- |
| bundleId | ID del bundle para descargar archivo (path parameter) |

### Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/789/file

// Respuesta:
// Binary file content (CSV)
```

### Campos de la respuesta

- `file`: Contenido del archivo

### Headers de la respuesta

- `content_disposition`: Disposición de contenido

- `content_type`: Tipo de contenido del archivo

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | One or more of the given parameters is invalid | Verificar que bundleId sea un número positivo válido |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Bundle data not found for given user | El bundle o usuario especificado no existe |
| 424 | An external dependency has failed | Error en servicio externo de generación de archivos |
| 500 | Internal server error | Error interno del servidor al generar el archivo |

## 8. Descargar Etiqueta

Este recurso te permite descargar la etiqueta asociada a un bundle específico, indicando el formato de impresión deseado. A partir del bundle_id, se genera la etiqueta de la unidad contenerizada en el formato solicitado (por ejemplo, PDF), permitiendo su impresión, escaneo y uso operativo. Si el formato no se pasa, la etiqueta se genera según las preferencias del vendedor dueño de esta colecta.

### Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/soe/bundles/label
```

### Body Label DownLoad Request (JSON válido)

| Campos | Descripción |
| --- | --- |
| bundle_id | Id del bundle cuya etiqueta se quiere imprimir |
| format | Opcional. Formato que se desea forzar para la impresión de la etiqueta. Valores válidos: pdf, zpl. Si es null, se toma preferencia de usuario |

### Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{"bundle_id": 789}' \
https://api.mercadolibre.com/soe/bundles/label

// Respuesta:
{
  "file": "base64_encoded_data",
  "content_type": "application/pdf",
  "file_name": "ETIQUETA_789"
}

curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{"bundle_id": 789, 'format': 'zpl'}' \
https://api.mercadolibre.com/soe/bundles/label

// Respuesta:
{
  "file": "base64_encoded_data",
  "content_type": "text/plain",
  "file_name": "ETIQUETA_789"
}
```

### Campos de la respuesta

- `file`: Binario de la etiqueta

- `content_type`: Tipo de contenido

- `file_name`: Nombre del archivo

### Errores

| Http Code | Message | Solution |
| --- | --- | --- |
| 400 | Bad arguments | Validar el formato del body JSON con parámetros válidos |
| 401 | User is not authorized into the application | Verificar que el token de autorización sea válido y esté presente en el header |
| 404 | Management data not found for given user | El bundle especificado para generar etiqueta no existe |
| 424 | An external dependency has failed | Error en servicio externo de generación de etiquetas |
| 500 | Internal server error | Error interno del servidor al generar la etiqueta |

## 9. Estados posibles

### Bundle Status

| Valor | Descripción |
| --- | --- |
| **OPENED (“En preparación”)** | Status con el que se crea el bundle. En este estado se permiten la edición del bundle, la adición y la remoción de shipments en el mismo. No se permite la generación de etiqueta ni de archivo (listado de shipments). |
| **CLOSED (“Por despachar”)** | Status de bundle cerrado, ya no se pueden agregar y remover shipments ni cambiar datos acerca del bundle. Se permite la generación de etiqueta y de archivo (listado de shipments). Una vez cerrado, un bundle no puede volver a abrirse. |
| **IN_PROCESS** | Status intermedio en el proceso de cierre de bundle. Es un estado que existe para prevenir la edición del bundle y la adición y remoción de shipments mientras se está generando la etiqueta y el container que luego se recolectará. La transición es automática y ante fallos en el cierre, un bundle en este estado se puede transicionar manualmente a CLOSED. |
| **FINISHED (“Finalizado”)** | Status de bundle colectado. Se permite la descarga del archivo (listado de shipments). La transición a este estado es automática. |
| **CANCELLED (“Cancelado”)** | Status de bundle cancelado. La transición a este estado es automática y se da cuando un shipment agrupado en un bundle se colecta por fuera del bundle. |
| **DELETED** | Se elimina el bundle y no vuelve a aparecer en las búsquedas. De la misma forma, se eliminan los volúmenes asociados y se permite agrupar los mismos shipments en un novo bundle. Una vez eliminado, el bundle no puede recuperarse. |

### Volume Status

| Valor | Descripción |
| --- | --- |
| **ADDED** | El volumen se agregó a un bundle |
| **PICKED_UP** | El volumen se recolectó dentro del bundle. |
| **EXTERNAL_PICKED_UP** | El shipment asociado al volumen se recolectó por fuera del bundle, en una colecta distinta. |
| **EXTERNAL_CANCELLED** | El shipment asociado al volumen se canceló. |
