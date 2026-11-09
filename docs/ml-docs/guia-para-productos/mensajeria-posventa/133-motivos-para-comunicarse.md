<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/motivos-para-comunicarse -->
<!-- Sección: Guía para productos > Mensajería posventa -->

# Motivos para comunicarse

Última actualización 29/09/2026

## Motivos para comunicarse

Importante:

Ahora, para enviar mensajes posventa con Mercado Envíos 2 (Fulfillment, Cross docking, Drop off y Flex) debes actualizar tu integración y el vendedor debe elegir un motivo para comunicarse. Caso contrario, recibirás el error [blocked_by_conversation_started_by_seller](https://developers.mercadolibre.com.ar/es_ar/mensajes-bloqueados).

## Consultar motivos disponibles de comunicación

Con los siguientes recursos los vendedores disponen de elegir un motivo para iniciar la conversación con el comprador y tendrán una cantidad de mensajes disponibles para enviar.

## Templates disponibles según el país

El template es un texto predefinido disponibilizado por Mercado Libre, que el vendedor no puede modificar.

Template de “REQUEST_VARIANTS”

Para MLA, MLM, MCO, MLC, MLU, MPE y MEC:

Hola, por favor confirma las características que quieres del producto que compraste, así podemos concretar el envío.

Para MLB:

Olá! Por favor, confirme as características que quer para o produto que você comprou, assim, podemos fazer o envio.

**Template de “REQUEST_BILLING_INFO”**

Para MLA:

Para adjuntarte la factura de tu compra necesito los siguientes datos:

- Nombre y apellido

- DNI

- Domicilio

- Código postal

Para MLM:

Para adjuntarte la factura de tu compra necesito los siguientes datos:

- Nombre y apellido

- RFC

- Domicilio

- Código postal

Para MCO:

Para adjuntarte la factura de tu compra necesito los siguientes datos:

- Nombre y apellido

- Tipo y número de documento

- Email

- Domicilio

- Código postal

- Código de municipio

- Código de departamento

Para MLU:

Para adjuntarte la factura de tu compra necesito los siguientes datos:

- Nombre y apellido

- Cédula

Para MPE:

Para adjuntarte la factura de tu compra necesito los siguientes datos:

- Nombre y apellido

- DNI

- Domicilio

- Código postal

Para MEC:

Para adjuntarte la factura de tu compra necesito los siguientes datos:

- Nombre y apellido

- Tipo y número de documento

- Domicilio

- Código postal

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/action_guide/packs/$PACK_ID?tag=post_sale
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/action_guide/packs/20000000000?tag=post_sale
```

Respuesta:

```

{
   "options":[
      {
         "id":"REQUEST_VARIANTS",
         "internal_description":"This is an example...",
         "enabled":true,
         "type":"template",
         "templates":[
            {
               "id":"TEMPLATE___REQUEST_VARIANTS___1",
               "vars":null
            }
         ],
         "actionable":true,
         "child_options":null,
         "cap_available":1
      },
      {
         "id":"REQUEST_BILLING_INFO",
         "internal_description":"This is an example...",
         "enabled":true,
         "type":"template",
         "templates":[
            {
               "id":"TEMPLATE___REQUEST_BILLING_INFO___1",
               "vars":null
            }
         ],
         "actionable":true,
         "child_options":null,
         "cap_available":1
      },
      {
         "id":"SEND_INVOICE_LINK",
         "internal_description":"This is an example...",
         "enabled":true,
         "type":"free_text",
         "templates":null,
         "actionable":true,
         "char_limit":350,
         "child_options":null,
         "cap_available":1
      },
      {
         "id":"DELIVERY_PROMISE",
         "internal_description":"This is an example...",
         "enabled":true,
         "type":"TEMPLATE",
         "templates":[
            {
               "id":"TEMPLATE___DELIVERY_PROMISE___1",
               "texts":{
                  "mla":{
                     "html":"Hola,Entregaremos tu compra %s entre las %d y las %d hs."
                  },
                  "mlb":{
                     "html":"Olá,Entregaremos sua compra %s entre %d e %d h."
                  },
                  "mlc":{
                     "html":"Hola,Entregaremos tu compra %s entre las %d y las %d hs."
                  },
                  "mco":{
                     "html":"Hola,Entregaremos tu compra %s entre las %d y las %d hs."
                  },
                  "mlu":{
                     "html":"Hola,Entregaremos tu compra %s entre las %d y las %d hs."
                  }
               },
               "vars":[
                  {
                     "id":"TEMPLATE___DELIVERY_PROMISE___1___VAR___INIT",
                     "type":"NUMBER"
                  },
                  {
                     "id":"TEMPLATE___DELIVERY_PROMISE___1___VAR___LIMIT",
                     "type":"NUMBER"
                  }
               ]
            }
         ],
         "actionable":true,
         "char_limit":null,
         "child_options":[
            
         ],
         "cap_available":1
      },
      {
         "id":"OTHER",
         "internal_description":"This is an example...",
         "enabled":true,
         "type":"free_text",
         "templates":null,
         "actionable":true,
         "char_limit":350,
         "child_options":null,
         "cap_available":1
      }
   ]
}
}
```

### Campos de la respuesta

**char_limit** : es la cantidad máxima de caracteres aceptados en la opción ( "OTHER" o "SEND_INVOICE_LINK"). 
 La opción REQUEST_VARIANTS sólo está disponible en tipos de envío cross docking y drop off. 
 La opción DELIVERY_PROMISE sólo está disponible en tipos de envíos Flex. 
 Dentro de las opciones de tipo template (REQUEST_VARIANTS y REQUEST_BILLING_INFO) tenemos el template id, que se debe utilizar en el POST para enviar el mensaje.

## Consultar cantidad de mensajes disponibles a enviar

Dentro del árbol de motivos, las categorías pueden tener la opción de enviar un mensaje al comprador y puedes reconocerlos con el campo cap_available:

- Si es 0 (cero), el vendedor no podrá enviar mensajes al comprador

- Si es 1 (uno) o más, indica la cantidad disponible para enviar.

Recuerda que el mensaje tendrá caracteres limitados y conservará las moderaciones de un mensaje normal (solo para OTHER y SEND_INVOICE_LINK). 
 En el caso de que el vendedor haya consumido el cap de mensajes disponibles a enviar, si vuelve a ingresar a una sección de campo abierto (OTHER), la respuesta retornará un error de que ya no es posible hacerlo, y deberá esperar a que el comprador responda.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/action_guide/packs/$PACK_ID/caps_available?tag=post_sale
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/action_guide/packs/200000000000/caps_available?tag=post_sale
```

Respuesta:

```
[
   {
      "option_id":"REQUEST_VARIANTS",
      "cap_available":1
   },
   {
      "option_id":"REQUEST_BILLING_INFO",
      "cap_available":1
   },
   {
      "option_id":"SEND_INVOICE_LINK",
      "cap_available":1
   },
   {
      "option_id":"DELIVERY_PROMISE",
      "cap_available":1
   },
   {
      "option_id":"OTHER",
      "cap_available":1
   }
]
```

## Enviar mensaje según opción

Luego de buscar las opciones disponibles para el pack_id, debes enviar el mensaje como el siguiente POST. Recuerda que, después de que el comprador responda, los mensajes siguientes deberán enviarse directamente mediante [el post /messages](https://developers.mercadolibre.com.ar/es_ar/mensajeria-post-venta).

**Nota:**  Los mensajes con la opción **OTHER**  no están disponibles cuando el envío se encuentra en estado “Entregado”.

Conoce los option_id disponibles por sitios:

| Sitio / Option_id | **“REQUEST_VARIANTS”** :   Solicitar datos de variantes | **“REQUEST_BILLING_INFO”** :  Pedir datos de facturación | **“SEND_INVOICE_LINK”** :  Enviar link para facturación | **“OTHER”** :  Otros, campo libre | **“DELIVERY_PROMISE”** :  Informar promesa de entrega |
| --- | --- | --- | --- | --- | --- |
| **MLA** |  |  |  |  |  |
| **MLB** |  |  |  |  |  |
| **MLM** |  |  |  |  |  |
| **MCO** |  |  |  |  |  |
| **MLC** |  |  |  |  |  |
| **MLU** |  |  |  |  |  |
| **MPE** |  |  |  |  |  |
| **MEC** |  |  |  |  |  |

**Nota:**  Para las órdenes de Reventa en MLM, los motivos **REQUEST_BILLING_INFO**  y **SEND_INVOICE_LINK**  no están disponibles.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json'  
{
    "option_id": $OPTION_ID,
    "template_id": $TEMPLATE_ID
}
https://api.mercadolibre.com/messages/action_guide/packs/$PACK_ID/option?tag=post_sale
```

Ejemplo con REQUEST_BILLING_INFO (Tipo template):

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json'  
{
    "option_id": "REQUEST_BILLING_INFO",
    "template_id": "TEMPLATE___REQUEST_BILLING_INFO___1"
}
https://api.mercadolibre.com/messages/action_guide/packs/2000000000000000/option?tag=post_sale
```

Respuesta de mensaje enviado:

```
{
    "id": "94353d192b9640e8b1ed3c77aa406f39",
    "to": {
        "user_id": 618491100,
        "name": "Test Test"
    },
    "status": "available",
    "text": "Este es un template para solicitar datos de facturación: ",
    "message_date": {
        "received": "2020-09-09T19:07:24.890Z",
        "available": "2020-09-09T19:07:25.056Z",
        "notified": null,
        "created": "2020-09-09T19:07:24.890Z",
        "read": null
    },
    "message_moderation": {
        "status": "clean",
        "reason": null,
        "source": "online",
        "moderation_date": "2020-09-09T19:07:25.056Z"
    }
}
```

Nota:

En el campo text estará el contenido enviado correspondiente al template.

Ejemplo con OTHER (Tipo texto libre):

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/action_guide/packs/2000000000000000/option -H 'Content-Type: application/json'  \
{
    "option_id": "OTHER",
    "text": "Cómo estás María, estaría necesitando de..."
}
```

Respuesta de mensaje enviado correctamente:

```
{
    "id": "94353d192b9640e8b1ed3c77aa406f39",
    "to": {
        "user_id": 618491100,
        "name": "Test Test"
    },
    "status": "available",
    "text": "Cómo estás María, estaría necesitando de...",
    "message_date": {
        "received": "2020-09-09T19:07:24.890Z",
        "available": "2020-09-09T19:07:25.056Z",
        "notified": null,
        "created": "2020-09-09T19:07:24.890Z",
        "read": null
    },
    "message_moderation": {
        "status": "clean",
        "reason": null,
        "source": "online",
        "moderation_date": "2020-09-09T19:07:25.056Z"
    }
}
```

Nota:

El campo text tiene el contenido enviado en el body de la llamada.

Respuesta mensaje moderado:

```
{
    "id": "94353d192b9640e8b1ed3c77aa406f39",
    "to": {
        "user_id": 618491100,
        "name": "Test Test"
    },
    "status": "moderated",
    "text": "Cómo estás María, estaría necesitando de...",
    "message_date": {
        "received": "2020-09-09T19:02:11.438Z",
        "available": null,
        "notified": null,
        "created": "2020-09-09T19:02:11.438Z",
        "read": null
    },
    "message_moderation": {
        "status": "rejected",
        "reason": "out_of_place_language",
        "source": "online",
        "moderation_date": "2020-09-09T19:02:11.697Z"
    }
}
```

### Campos de la respuesta

**status** : estado del mensaje. Por ejemplo: available o moderated
 **message_moderation:** 
 **status** : estado de la moderación del mensaje.
 **reason** : motivo de moderación. Por ejemplo: **out_of_place_language**  moderación por lenguaje inapropiado.

Ejemplo con DELIVERY_PROMISE:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' 
{
  "option_id": "DELIVERY_PROMISE",
  "template_id": "TEMPLATE___DELIVERY_PROMISE___1",
  "vars": [{
      "id": "TEMPLATE___DELIVERY_PROMISE___1___VAR___INIT",
      "value": 12
  },
  {
      "id": "TEMPLATE___DELIVERY_PROMISE___1___VAR___LIMIT",
      "value": 23
  }]

}
https://api.mercadolibre.com/messages/action_guide/packs/2000000000000000/option
```

Al tener una promesa de entrega antigua, no enviaremos el mensaje y recibirás el error:

```
{
   "status_code": 500,
   "message": "delivery date is before than today"
}
```

Respuesta mensaje:

```
{

    "id": "374c945ce97446f5b4a73123adfasdd0e1ed17f",
    "status": "available",
    "text": "Entregaremos tu compra {hoy/mañana/el próximo día hábil} entre las {initial} y las {final} hs.",
    "to": {
        "user_id": 667304586,
        "name": "Test Test"
    },
    "message_date": {
        "received": "2021-01-11T18:06:46.070Z",
        "available": "2021-01-11T18:06:46.450Z",
        "notified": null,
        "created": "2021-01-11T18:06:46.070Z",
        "read": null
    },
    "message_moderation": {
        "status": "clean",
        "reason": null,
        "source": "online",
        "moderation_date": "2021-01-11T18:06:46.450Z"
    }

}
```

## Ejemplos de mensajes de error

### Por ser caso exceptuado

- Productos con tiempo de realización (manufacturing time) de cualquier categoría

- Recuerda que podemos modificar estas excepciones sin previo aviso. 

 Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/action_guide/packs/2000000000000012?tag=post_sale
```

Respuesta:

```
{
   "cause": "blocked_by_excepted_case",
   "error": "bad_request",
   "message": "This pack belongs to an excepted case, it is requested to use the messaging resource.",
   "status_code": 400
}
```

Así, el vendedor podrá [utilizar la mensajería posventa sin restricciones](https://developers.mercadolibre.com.ar/es_ar/mensajeria-post-venta#Crear-mensajes).

### Errores

| Status (error) | Mensaje | Detalle |
| --- | --- | --- |
| 400 - limit_exceeded | The text is invalid | Por exceder el límite de 350 caracteres (option OTHER y SEND_INVOICE_LINK) |
| 403 - bad_request | You are not allowed to execute the option OTHER again | Cantidad (cap) no disponible |
| 403 - forbidden | This package has the conversation blocked, please check blocked messages | Tiene una conversación abierta, debes utilizar el recurso de /messages |
| 404 - not_found | The option selected is not valid | Option_id inválido |
| 409 - conflict | There is another request locking this operation | Este error sucede porque el vendedor ejecuta varias opciones simultáneas sobre la misma venta y, para evitar que se realicen más caps de los disponibles, creamos un “Lock” del servicio sobre el vendedor y la venta, el cual se libera al terminar de ejecutar la opción. |
| 403 - forbidden | The conversation is blocked | Pack_id con mensajería bloqueada |
| 403 - forbidden | You are not allowed to access the information of the pack $PACK_ID | Vendedor no está autorizado para consultar la información de ese pack id |
| 400 - bad_request | The template $TEMPLATE_ID is invalid | Template_id incorrecto |
| 400 - bad_request | The promise of delivery of the shipping contained in the pack is from a date before today | Fecha inválida/vencida para la promesa de entrega |
| 500 - internal_server_error | Internal server error | Error interno |
| 429 - too_many_request | Too many request | Se devuelve este error cuando un usuario ha enviado demasiadas peticiones en un corto periodo de tiempo |
| 451 - Unavailable | Unavailable | Se devuelve este error cuando el comprador ha desactivado su cuenta. |

**Siguiente** : [Gestión de mensajes](https://developers.mercadolibre.com.ar/es_ar/mensajeria-post-venta).
