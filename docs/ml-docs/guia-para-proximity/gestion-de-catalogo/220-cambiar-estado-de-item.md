<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/cambiar-estado-de-item -->
<!-- Sección: Guía para Proximity > Gestión de Catalogo -->

# Cambiar estado de item

Última actualización 04/03/2026

## Cambiar estado de item

Nota:

Para cambiar el status de un ítem, realiza un PUT informando el `external_id` (SKU) del ítem y el `external_id` de la tienda. 

 Además, será necesario informar en el header el `access_token` del usuario que recibió la publicación. El `access_token` puede ser generado por el proceso de autenticación de OAuth.

Un ítem puede tener los siguientes estados:

| Estado | Descripción |
| --- | --- |
| `active` | Activa el ítem para que esté disponible en el catálogo. |
| `paused` | Pausa el ítem temporalmente, dejándolo no disponible para los compradores. |

## Llamada

```
curl -X PUT \
    'https://api.mercadopago.com/proximity/integration/v1/catalog/stores/$EXTERNAL_STORE_ID/items/$EXTERNAL_ITEM_ID' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -d '{
  "status": "active"
}'
```

### Ejemplo

```
curl -X PUT \
    'https://api.mercadopago.com/proximity/integration/v1/catalog/stores/STORE001/items/SKU12345' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890' \
    -d '{
  "status": "active"
}'
```

### Respuesta

```
{
  "status": "active"
}
```

## Parámetros de Request

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **Authorization**  (obligatorio) | string | Access Token del usuario propietario del catálogo. Obligatorio en todas las solicitudes. |

### Path

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **external_store_id**  (obligatorio) | string | Identificador externo de la tienda donde se encuentra el ítem a actualizar. |
| **external_item_id**  (obligatorio) | string | Identificador externo (SKU) del ítem que se desea actualizar. |

### Body

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status**  (obligatorio) | string | Nuevo estado que se asignará al ítem. Valores posibles:  `active`: Activa el ítem para que esté disponible. `paused`: Pausa el ítem temporalmente. |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status** | string | Estado actualizado del ítem. Confirma que el cambio se realizó correctamente. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Bad Request | Error de publicación causado por alguna inconsistencia en los campos enviados. |
| **401** | Unauthorized | Access Token inválido o expirado. |
| **403** | Forbidden | El usuario no tiene permisos para actualizar este ítem. |
| **404** | Not Found | No se encontró el ítem o la tienda con los IDs proporcionados. |
| **500** | Internal Server Error | Error interno del servidor al procesar la solicitud. |
