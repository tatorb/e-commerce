<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mensajeria-post-venta -->
<!-- Sección: Guía para productos > Mensajería posventa -->

# Gestión de mensajes

Última actualización 27/10/2026

## Gestión de mensajes

Este recurso permite gestionar la comunicación entre vendedores y compradores en el contexto posventa, incluyendo el envío, consulta y gestión de mensajes y anexos.

## Nueva arquitectura de mensajería

A partir del **02 de febrero de 2026** , implementaremos una nueva capa de intermediación en la comunicación entre compradores y vendedores para **MLB (Brasil)**  y **MLC (Chile)** . Las interacciones pasarán a ser gestionadas de forma progresiva por medio de **Agentes de Mensajería [Inteligencia Artificial]** , comenzando por la logística **Full** .

**No habrá nuevos endpoints públicos ni cambios en las estructuras de los endpoints actuales.**  El flujo transaccional permanece inalterado, no siendo necesaria una migración obligatoria de arquitectura.

**¿Qué cambia en la práctica?**

Existen cinco ajustes puntuales que debes observar:

- **Actualización del campo "conversation_status" → "path":**  Cuando el flujo de mensajes pase por los agentes, el path retornado será: /packs/{pack_id}/sellers/{seller_id}/conversations/{type}.

- **Envío de mensajes al comprador:**  En el cuerpo del POST para crear mensajes, el campo **"to": { "user_id": "..." }**  deberá contener el ID del Agente del país correspondiente (consulta la tabla abajo), y no más el ID real del comprador. El agente se encargará de la entrega final al destinatario.

- **Lectura de mensajes (GET):**  Al consultar los mensajes, el campo **"from": { "user_id": "..." }**  contendrá el ID del Agente y no el ID real del comprador.

- **Límite de mensajes:**  Los integradores podrán enviar únicamente **1 mensaje por vez**  al agente.

- **Mensajes leídos y bloqueo:**  Este cambio impacta en la gestión de mensajes leídos. El vendedor tendrá **48 horas útiles**  para resolver la consulta antes que la conversación sea bloqueada.

### IDs de los Agentes por país

| Sitio | Agent User ID |
| --- | --- |
| MLC (Chile) | 3020819166 |
| MCO (Colombia) | 3037204123 |
| MLM (México) | 3037204279 |
| MLA (Argentina) | 3037674934 |
| MLB (Brasil) | 3037675074 |
| MLU (Otros) | 3037204685 |

## Consideraciones

- Los recursos de consulta (GET) comparten un rate limit de **500 rpm** , y los recursos de escritura (POST/PUT) también comparten entre sí un rate limit de **500 rpm** .

- La regla de inicio de conversación permanece inalterada: el vendedor no puede iniciar una conversación. El flujo siempre debe ser iniciado por el comprador.

## Parámetros

- **message_id** : ID de mensaje.

- **date_created** : Fecha de creación.

- **date** : Fecha en que el mensaje es guardado.

- **date_received** : Fecha de recepción del mensaje.

- **date_available** : Fecha en que el mensaje pasó por moderación.

- **date_notified** : Fecha en que la contraparte fue notificada del mensaje.

- **date_read** : Fecha en que la contraparte leyó el mensaje.

- **from** : Quién envía el mensaje.

- **to** : Quién recibe el mensaje.

- **user_id** : ID del usuario (remitente o destinatario).

- **subject** : Asunto del email.

- **text** : Texto del mensaje.

- **plain** : Texto plano del mensaje.

- **attachments** : [Anexos](https://developers.mercadolibre.com.ar/es_ar/mensajeria-post-venta#Obtener-anexo).

- **attachments_validations** : Validaciones de anexos.

- **invalid_size** : Tamaño de anexo inválido.

- **invalid_extension** : Extensión de anexo inválida.

- **internal_error** : Error interno.

- **site_id** : Sitio de Mercado Libre (MLA, MLB, etc.).

- **message_resources** : Contiene una lista con IDs relacionados al mensaje, describiendo a qué recurso cada uno pertenece.

- **resource** : Relativo a la orden a que pertenece (orders).

- **resource_id** : ID de la orden.

- **status** : Estado del mensaje (available - pending_review - moderated - rejected - pending_translation).    Nota: La API puede responder con HTTP 202 y el estado `pending_review` mientras el mensaje está en revisión. Este es un estado intermedio, sin un resultado definitivo. Cuando finalice la revisión, el mensaje puede alcanzar uno de estos estados finales: `available` o `rejected`. Considerá `pending_review` al procesar la respuesta.

- **moderation_status** : Estado de moderación del mensaje.

- **moderation.status** : Resultado del proceso de moderación (clean, rejected, pending, non_moderated).

- **moderation.date_moderated** : Fecha en que la información de moderación impactó.

- **moderation.source** : Modalidad de la moderación.

- **moderation.reason** : Motivo por el cual el mensaje fue moderado. Valores posibles: OUT_OF_PLACE_LANGUAGE, SOCIAL_NETWORK_LINK, LINK_SHORT_URL, AUTOMATIC_MESSAGE, PERSONAL_DATA, LINK_MERCADOPAGO, ML_LINKS_PAYPAL, EVASION_CLAIM_SELLER.

## Obtener mensajes de un paquete

Utiliza el pack_id en la llamada para obtener los mensajes enviados. Si el pack_id es null, puedes utilizar el order_id como estándar, pero manteniendo la estructura del endpoint (es decir, aún utilizando /packs). Considera que los mensajes enviados por los compradores, que fueron moderados, no estarán visibles. Por otro lado, los mensajes del vendedor, aunque sean moderados, estarán visibles.

Cuando consultes **/messages/packs/pack_id/sellers/seller_id** , los mensajes serán marcados como leídos. Si no quieres marcarlos como leídos, ejecuta el GET con el parámetro mark_as_read=false y la consulta será: **/messages/packs/pack_id/sellers/seller_id?mark_as_read=false** . Recuerda que el resto de los recursos no marcará los mensajes como leídos.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/$PACK_ID/sellers/$USER_ID?tag=post_sale
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/2000000089077943/sellers/415458330?limit=2&offset=1&tag=post_sale
```

**Respuesta:**

```
{
  "paging":{
     "limit":10,
     "offset":0,
     "total":3
  },
  "conversation_status":{
       "path": "/packs/2000000089077943/seller/415458330",
       "status": "active",
       "substatus": null,
       "status_date": "2020-12-05T20:01:46.000Z",
       "status_update_allowed": false,
       "claim_id": null,
       "shipping_id": null
   },
  "messages":[
     {
        "id":"fd1d2e37ad004ede9e0bf25d1215002d",
        "site_id":"MLB",
        "client_id":123456789,
        "from":{
           "user_id": 123456789000,
        },
        "to":{
           "user_id": 2332423234,
        },
        "status":"available",
        "subject":null,
        "text":"Mensaje de prueba",
        "message_date":{
           "received":"2020-12-05T20:01:46.000Z",
           "available":"2020-12-05T20:01:46.000Z",
           "notified":"2020-12-05T20:01:46.000Z",
           "created":"2020-12-05T20:01:46.000Z",
           "read":null
        },
        "message_moderation":{
           "status":"clean",
           "reason":null,
           "source":"online",
           "moderation_date":"2020-12-05T20:01:46.000Z"
        },
        "message_attachments":null,
        "message_resources":[
           {
              "id":"000011122344",
              "name":"packs"
           },
           {
              "id":"475684066",
              "name":"sellers"
           }
        ],
        "conversation_first_message":false,
        "conversation_id":"/packs/2000000089077943/sellers/415458330/conversations/resale-seller"
     }
  ],
  "seller_max_message_length":350,
  "buyer_max_message_length":3500
}
```

El atributo `conversation_id` comenzará a devolverse en cada mensaje de `messages` para identificar su conversación, incluso en órdenes de reventa, en todos los sitios y modalidades logísticas. Por el momento, el campo es solo informativo y no requiere ninguna acción de los integradores.

Al final de la respuesta, puedes ver el número máximo de caracteres que el vendedor puede enviar (seller_max_message_length).

## Obtener los detalles del mensaje por ID

Con este recurso podrás obtener la información del mensaje enviado utilizando el ID retornado en el recurso Obtener mensajes de un paquete.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/$MESSAGE_ID?tag=post_sale
```

**Ejemplo de respuesta sin header:**

```
{
  "message_id": "0033b582a1474fa98c02d229abcec43c",
  "date_received": "2016-09-01T05:15:25.821Z",
  "date": "2016-09-01T05:15:25.821Z",
  "date_available": "2016-09-01T05:15:25.821Z",
  "date_notified": "2016-09-01T05:17:42.945Z",
  "date_read": "2016-09-01T21:31:19.606Z",
  "from": {
    "user_id": 123456789
  },
  "to": {
    "user_id": 123456780
  },
  "subject": "Test Item subject",
  "text": {
    "plain": "Ejemplo de texto"
  },
  "attachments": [
    {}
  ],
  "attachments_validations": {
    "invalid_size": [],
    "invalid_extension": [],
    "forbidden": [],
    "internal_error": []
  },
  "site_id": "MLB",
  "resource": "orders",
  "resource_id": "1234567871",
  "status": "available",
  "moderation": {
    "status": "clean",
    "date_moderated": "2019-03-13T09:34:26.450-04:00",
    "source": "online"
  }
}
```

**Ejemplo de respuesta actualizada (con header):**

```
{
	"paging": null,
	"conversation_status": null,
	"messages": [{
		"id": "fd1d2e37ad004ede9e0bf25d1215002d",
		"site_id": "MLB",
		"client_id": 123456789,
		"from": {
			"user_id": 123456789000
		},
		"to": {
			"user_id": 2332423234
		},
		"status": "available",
		"subject": null,
		"text": "Mensaje de prueba",
		"message_date": {
			"received": "2020-12-05T20:01:46.000Z",
			"available": "2020-12-05T20:01:46.000Z",
			"notified": "2020-12-05T20:01:46.000Z",
			"created": "2020-12-05T20:01:46.000Z",
			"read": null
		},
		"message_moderation": {
			"status": "clean",
			"reason": null,
			"source": "online",
			"moderation_date": "2020-12-05T20:01:46.000Z"
		},
		"message_attachments": null,
		"message_resources": [{
				"id": "000011122344",
				"name": "packs"
			},
			{
				"id": "475684066",
				"name": "sellers"
			}
		],
		"conversation_first_message": false
	}]
}
```

## Enviar mensaje al comprador

Utiliza este recurso para crear un mensaje a ser enviado al comprador. Hay un límite de 350 caracteres. Aceptamos los caracteres de la [norma ISO-8859-1 latin1](https://es.wikipedia.org/wiki/ISO/IEC_8859-1) y [los emoticones de este listado](https://github.com/vdurmont/emoji-java/blob/master/EMOJIS.md), sujetas a las restricciones de seguridad siguientes.

Para reducir los riesgos de XSS, se rechazan los mensajes que contengan las siguientes secuencias:

- **CRLF (`\r\n`):**  `Hola\r\nmundo`.

- **Caracteres de control `U+007F–U+009F`:**  `Hola\u0085mundo`.

- **64 no caracteres Unicode adicionales:**  `Hola\uFDD0mundo`.

- **Espacios especiales dentro de etiquetas:**  `<b\u3000width='1'>Hola</b>`.

- **Etiquetas incompletas:**  `A<B` y `x<p`.

- **Cierres inválidos:**  `a</>b`, `a</1>b` y `a</ >b`.

Estas secuencias devuelven **HTTP 403** . Revisa la integración para que no dependa de la conservación de estas secuencias. El error 400 para caracteres no admitidos, incluido en la sección de errores, es distinto de este 403.

Considera que a partir del 02/02/2026 estaremos dando inicio a la migración a nueva arquitectura de mensajería. Con esto, para **MLB**  y **MLC** , al crear el mensaje a ser enviado al comprador recuerda que el campo "to": { "user_id" } deberá contener el ID del Agente del país correspondiente. Consulta la tabla de IDs de los Agentes.

| Sitio | Agent User ID |
| --- | --- |
| MLC (Chile) | 3020819166 |
| MCO (Colombia) | 3037204123 |
| MLM (México) | 3037204279 |
| MLA (Argentina) | 3037674934 |
| MLB (Brasil) | 3037675074 |
| MLU (Otros) | 3037204685 |

El atributo attachments se obtiene de la respuesta del POST de attachments. Mira cómo Cargar y guardar un anexo. Si no es necesario anexar un archivo, la sección "attachments" debe ser removida del JSON. Si necesitas insertar un link clickeable en el texto, puedes insertarlo usando la función href, por ejemplo: <a href="tu_url">Tu link de rastreo</a>.

**Importante:**  los anexos deben ser asociados a un mensaje dentro de 2 días (48 horas) después de su cargamento; de lo contrario, serán eliminados y el envío fallará. En ese caso, carga el archivo nuevamente para obtener una nueva key (ID del anexo).

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/$PACK_ID/sellers/$USER_ID?tag=post_sale
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/2000000089077943/sellers/415458330?tag=post_sale \
  -H 'Content-Type: application/json' \
  -d '{
    "from": {
      "user_id": "415458330"
    },
    "to": {
      "user_id": "3037675074"
    },
    "text": "¡Hola! Tu paquete fue despachado.",
    "attachments": ["415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d.pdf"]
  }'
```

**Error posible:**

```
{
    "status_code": 403,
    "code": "forbidden",
    "message": "blocked_conversation_send_message_forbidden"
}
```

Importante:

La mensajería está bloqueada en órdenes con estado cancelled de todas las categorías. Si tienes una conversación abierta anterior al cambio, los mensajes posventa estarán disponibles.

## Cargar y guardar un anexo

Para anexar un archivo en el mensaje, debe ser guardado previamente. La respuesta retornará el ID del anexo. El POST debe ser realizado como form-data con key: value → file = referencia al archivo. El archivo debe tener un tamaño máximo de 25 MB. Formatos aceptados: JPG, JPEG, PNG, PDF, HEIF, HEIC y GIF. Los archivos XLSX y XML no son aceptados.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/attachments?tag=post_sale&site_id=SITE_ID
```

**Ejemplo:**

```
curl -X POST \
  'https://api.mercadolibre.com/messages/attachments?tag=post_sale&site_id=MLB' \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/home/user/Anexo.jpg'
```

En este caso, el servidor responderá con un JSON que contiene el ID del archivo, si la solicitud fue exitosa. La respuesta obtenida deberá ser anexada en el mensaje deseado.

**Respuesta:**

```
{
  "id": "210438685_59f0f034-db1b-4ea6-8c5e-1d34e2092482.jpg"
}
```

**Vencimiento de anexos no asignados (TTL de primera relación):**

Todo anexo enviado que no sea asignado a un mensaje dentro de 2 días (48 h) será eliminado automáticamente. Esta limpieza afecta únicamente anexos "huérfanos" (sin relación con ningún mensaje).

- **Inicio del conteo** : a partir de la confirmación de envío (respuesta exitosa del upload).

- **Alcance** : se aplica hasta la primera asociación del anexo a un mensaje. Una vez asociado por primera vez, el anexo deja de estar sujeto a este TTL.

- **Efecto** : la eliminación es irreversible. Los intentos de usar la key de un anexo eliminado fallarán.

- **Recomendación** : envía el anexo lo más próximo posible del envío y asocia la key inmediatamente.

- **Recuperación** : si el anexo fue eliminado, envía el archivo nuevamente para obtener una nueva key y úsala en el mensaje.

## Obtén los anexos enviados

Para obtener los detalles sobre el(los) anexo(s) previamente cargados, realiza:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/attachments/$ATTACHMENT_ID?tag=post_sale&site_id=SITE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/attachments/76601286_5946e4c4-168a-45fd-945e-b8f0c306c58d.png?tag=post_sale&site_id=MLB
```

Si la solicitud es exitosa, la llamada retornará el archivo solicitado.

## Errores

A continuación están listados los posibles errores que pueden ocurrir al utilizar los recursos de mensajería.

### Obtener mensajes de un paquete

| Status | Error | Mensaje |
| --- | --- | --- |
| 403 | User access token invalid for resource {resource_id} | Usuario sin acceso a la orden |
| 400 | The limit param must be greater than 0 | El param "limit" del request debe ser mayor que 0 |
| 400 | Invalid offset param | Param "offset" inválido |
| 400 | Invalid limit param | Param "limit" inválido |

### Obtener mensajes por ID

| Status | Error | Mensaje |
| --- | --- | --- |
| 403 | Access denied for user 30265782 to message with id 006b9b2df38f452b80402041ae86f6d4 | Usuario sin acceso a un mensaje determinado |
| 400 | The specified message id does not exists | El mensaje solicitado no existe |
| 404 | The message with id: a could not be retrieved from storage | Mensaje no encontrado en el servidor. Intenta nuevamente en algunos segundos |

### Enviar mensaje al comprador

| Status | Error | Mensaje |
| --- | --- | --- |
| 400 | The text has character/s that is/are not supported. | Carácter no soportado (ej: UTF-8) |
| 400 | The message content is too long, max characters allowed are 350 | El mensaje excede el límite de 350 caracteres |
| 403 | You can not send the message because a mediation is in process | Mensaje bloqueado por mediación en proceso (solo Brasil) |
| 403 | You can not send the message because the purchase is Mercado Envíos Full and has not been yet delivered | Envío gestionado por el Fulfillment aún no entregado |
| 403 | Access denied for user {from.user_id} to order {to.resource_id} | El usuario "from" no tiene acceso al pedido |
| 403 | Receiver does not belong to order {to.resource_id} | El destinatario del mensaje no pertenece al pedido |
| 400 | The field 'to.user_id' is required | Mensaje sin receptor (es necesario agregar "to") |
| 400 | Invalid 'to' user id | User id "to" inválido |
| 400 | Sender and received must not be equals | El user "from" y "to" son iguales |
| 400 | The field 'to.email' must be a secure email | Si el user_id es 0 y el email no es un secure_email |
| 400 | The field 'to.resource' is required | El atributo "resource" no puede ser encontrado |
| 400 | Invalid field 'to.resource' | Atributo resource inválido |
| 400 | The field 'to.site_id' is required | Request sin site_id |
| 400 | The field 'to.site_id' has an invalid value | Atributo site_id inválido |
| 400 | A JSON body is required | POST sin JSON body |
| 400 | The field 'from' is required | Mensaje sin 'from' |
| 400 | Access token is required | Request sin access token |
| 400 | Application id is required | Access token sin application_id |
| 422 | Attachment key is invalid or not found | El ID del attachment no existe, no es accesible o no pertenece al usuario. |

### Cargar y guardar anexo

| Status | Error | Mensaje |
| --- | --- | --- |
| 500 | File can not be saved, try it later | Problemas al almacenar el archivo |
| 400 | File attached is empty | Anexo vacío o nulo |
| 400 | File name cannot include characters like /, \ | El nombre del archivo no puede contener caracteres como /, \ |
| 400 | File attachment is bigger than 25 Mb. | El tamaño del archivo excede 25 MB |
| 400 | The message exceeds the allowed number of attachments: 25 | El mensaje excede el número permitido de anexos: 25 |
| 400 | The queryparam 'site_id' is required | Request sin el site_id |
| 400 | The original_filename exceeded 200 character limit | El nombre del archivo excede el límite de 200 caracteres |

### Obtener anexo

| Status | Error | Mensaje |
| --- | --- | --- |
| 400 | Invalid site_id: 'XYZ' is not a recognized site | site_id inválido |
| 500 | File can not be saved, try it later | No fue posible obtener el archivo solicitado |

**Siguiente** : [Mensajes pendientes](https://developers.mercadolibre.com.ar/es_ar/mensajes-pendientes).
