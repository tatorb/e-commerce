<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mensajes-pendientes -->
<!-- Sección: Guía para productos > Mensajería posventa -->

# Mensajes pendientes

Última actualización 11/09/2025

## Mensajes pendientes

## Flujo desde notificaciones

El flujo indicado para trabajar y consumir los mensajes nuevos (no leídos) desde la integración, es utilizando las notificaciones de /messages para así obtener las ventas con nuevos mensajes y hacer el GET directamente en cada una para traer los detalles de los mensajes recibidos.

## Mensajes pendientes de leer filtrado por resource

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/unread/$RESOURCE?tag=post_sale
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/unread/packs/1234/sellers/2345?tag=post_sale
```

Respuesta:

```
{
   "user_id":2345,
   "results":[
      {
         "resource":"/packs/1234/sellers/2345",
         "count":1
      }
   ]
}
```

### Modos de uso

Si deseas obtener todas las ordenes con mensajes pendientes de leer como vendedor deberás realizar la siguiente llamada:

```
curl -x GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/unread?role=$ROLE&tag=post_sale
```

### Parámetros

| Parámetro | Tipo | Obligatório | Descripción |
| --- | --- | --- | --- |
| Role | String | Sí | Rol del usuario para el cual se consultan las conversaciones pendientes de leer. No existe valor por defecto, por lo que debes enviarlo siempre. Valores válidos: seller, buyer. |

Nota:

La consulta está diseñada para ser neutral respecto del rol; por eso

**no se establece un valor por defecto**

. Para obtener resultados correctos y consistentes,

**siempre envía el parámetro role**

.

Respuesta:

En caso de que la respuesta de la API sea satisfactoria, nos devolverá un JSON similar al siguiente:

```
{
   "user_id":378136913,
   "results":[
      {
         "resource":"/packs/1977056109/sellers/378136913",
         "count":1
      }
   ]
}
```

En esta respuesta visualizarás:

- ID del usuario que hizo la petición (“user_id”).

- Mensajes pendientes de leer (“count”).

- Cada orden que disponemos (“order_id”).

Por último, en caso de no tener mensajes pendientes de leer, la respuesta será similar a la siguiente:

```
{
    "user_id": "1234512314",
    "results": []
}
```

Nota:

Este es un recurso privado por lo que si realizas una llamada sin access_token obtendrás un error 400.

## Marcar mensajes como leídos

Con el siguiente GET puedes marcar los mensajes como leídos.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/$PACK_ID/sellers/$SELLER_ID?tag=post_sale
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/2000000089077943/sellers/415458330?tag=post_sale
```

Respuesta:

```
{
    "paging": {
        "limit": 2,
        "offset": 1,
        "total": 31
    },
    "conversation_status": {
        "path": "/packs/2000000089077943/seller/415458330",
        "status": "active",
        "substatus": null,
        "status_date": "2019-04-08T16:36:30.000Z",
        "status_update_allowed": false,
        "claim_id": null,
        "shipping_id": null
    },
    "messages": [
        {
            "id": "2c92808469fea23a0169febf14580001",
            "site_id": "MLA",
            "client_id": 123,
            "from": {
                "user_id": "415458330",
                "email": "test_user_83388960@testuser.com",
                "name": "Juan Pablo Robledo"
            },
            "status": "IN_MODERATION",
            "text": "Test message ToUserId",
            "message_date": {
                "received": "2019-04-08T20:58:49.000Z",
                "available": null,
                "notified": null,
                "created": "2019-04-08T20:58:49.000Z",
                "read": "2019-04-08T20:58:52.000Z"
            },
            "message_moderation": {
                "status": "NON_MODERATED",
                "reason": "none",
                "by": "none",
                "moderation_date": null
            },
            "message_attachments": [
                {
                    "filename": "415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d.pdf",
                    "original_filename": "Ayuda-Memoria-Arduino-ELINSI.pdf",
                    "type": "application/octet-stream",
                    "size": 225677,
                    "potential_security_threat": false,
                    "creation_date": "2019-04-08T20:58:49.000Z"
                }
            ],
            "message_resources": [
                {
                    "id": "2000000089077943",
                    "name": "packs"
                },
                {
                    "id": "415458330",
                    "name": "seller"
                }
            ]
        },
        {
            "id": "2c92808469fea23a0169febdb0570000",
            "site_id": "MLA",
            "client_id": 123,
            "from": {
                "user_id": "415458330",
                "email": "test_user_83388960@testuser.com",
                "name": "Juan Pablo Robledo"
            },
            "status": "IN_MODERATION",
            "text": "Test message ToUserId",
            "message_date": {
                "received": "2019-04-08T20:57:18.000Z",
                "available": null,
                "notified": null,
                "created": "2019-04-08T20:57:18.000Z",
                "read": "2019-04-08T20:57:22.000Z"
            },
            "message_moderation": {
                "status": "NON_MODERATED",
                "reason": "none",
                "by": "none",
                "moderation_date": null
            },
            "message_attachments": [
                {
                    "filename": "415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d.pdf",
                    "original_filename": "Ayuda-Memoria-Arduino-ELINSI.pdf",
                    "type": "application/octet-stream",
                    "size": 225677,
                    "potential_security_threat": false,
                    "creation_date": "2019-04-08T20:57:19.000Z"
                }
            ],
            "message_resources": [
                {
                    "id": "2000000089077943",
                    "name": "packs"
                },
                {
                    "id": "415458330",
                    "name": "seller"
                }
            ]
        }
    ]
}
```

En caso que no quieras marcarlos como leídos, realiza el GET con el parámetro mark_as_read = false y la consulta será: /messages/packs/pack_id/sellers/seller_id?mark_as_read=false.

## Mensajes pendientes de leer

Esta opción te permitirá obtener los mensajes pendientes de leer en Mercado Libre de todas las órdenes existentes. Además, también podrás definir el role del usuario para cada caso, ya sea comprador o vendedor. Este recurso es indicado para un uso de una redundancia, sólo para validación si no hubo perdidas en la integración desde las notificaciones.
 
 Para obtener la información mencionada deberás realizar el GET que se muestra a continuación.

Nota:

Este recurso devuelve hasta 500 (quinientas) conversaciones por llamado. En caso de querer obtener más, debes [marcar algunas como leídas](https://developers.mercadolibre.com.ar/es_ar/mensajeria-post-venta#Marcar-mensajes-como-le%C3%ADdos) y realizar el mismo llamado nuevamente.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/unread?tag=post_sale
```

Parámetro opcional:

- **role** : “buyer”/”seller”

### Errores

| Status | Error | Mensaje |
| --- | --- | --- |
| 400 | Messages id empty or invalid | IDs de mensajes inválidos o vacíos |
| 400 | The specified message id: a does not exists | ID de mensaje inexistente |
| 400 | Not allowed messages from multiple orders | ID de mensajes que corresponden a diferentes órdenes |
| 404 | The message with id: a could not be retrieved from storage | Mensaje no encontrado en el servidor, intenta nuevamente en unos segundos |

**Siguiente:**  [Mensajes bloqueados](https://developers.mercadolibre.com.ar/es_ar/mensajes-bloqueados).
