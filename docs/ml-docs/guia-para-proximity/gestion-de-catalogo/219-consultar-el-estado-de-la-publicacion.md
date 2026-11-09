<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/consultar-el-estado-de-la-publicacion -->
<!-- Sección: Guía para Proximity > Gestión de Catalogo -->

# Consultar estado de la publicación

Última actualización 05/03/2026

## Consultar el estado de la publicación

Nota:

Este endpoint permite verificar el estado actual de una publicación de catálogo, utilizando el ID devuelto en la respuesta de publicación.

## Llamada

```
curl -X GET \
    'https://api.mercadopago.com/proximity/integration/v1/catalog/$PUBLICATION_ID' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN'
```

### Ejemplo

```
curl -X GET \
    'https://api.mercadopago.com/proximity/integration/v1/catalog/b2f6b992-5133-11ed-a81f-acde48001122' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer APP_USR-1234567890-123456-abcdef1234567890'
```

### Respuesta

```
{
  "status": "success"
}
```

## Parámetros de Request

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **Authorization**  (obligatorio) | string | Access Token obtenido a través del panel de desarrollador. Obligatorio ser enviado en todas las solicitudes. |

### Path

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **publication_id**  (obligatorio) | string | ID de publicación devuelta por el proceso de importación. |

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **status** | string | Estado actual del proceso de publicación del catálogo.  **processing** : El catálogo está siendo procesado. **error** : El proceso de publicación ha sido abortado porque ocurrió algún error irrecuperable. **success** : El catálogo ha sido publicado correctamente. |

## Errores

| Código de Error | Mensaje | Descripción |
| --- | --- | --- |
| **400** | Error | Error de publicación causado por alguna inconsistencia en los campos. |
| **401** | Unauthorized | Access Token inválido. |
| **403** | Forbidden | El usuario no puede acceder a este recurso. |
| **500** | Internal Server Error | Error interno del servidor. |

**Siguiente** : [Cambiar estado de item](https://developers.mercadolibre.com.ar/es_ar/cambiar-estado-de-item)
