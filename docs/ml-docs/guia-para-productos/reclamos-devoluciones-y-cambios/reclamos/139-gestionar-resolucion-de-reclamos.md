<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos -->
<!-- Sección: Guía para productos > Reclamos, Devoluciones y Cambios > Reclamos -->

# Gestionar resolución de reclamos

Última actualización 08/09/2025

## ¿Qué es gestionar la resolución de un reclamo?

La gestión de la resolución de reclamos implica abordar y resolver las quejas de los usuarios de manera eficiente y satisfactoria. El objetivo principal es solucionar los problemas de manera efectiva para mantener altos niveles de satisfacción del cliente y garantizar la calidad continua del servicio ofrecido. Esto no solo fortalece la confianza del cliente en la plataforma, sino que también contribuye a cultivar relaciones positivas y duraderas con la base de usuarios.

## Solicitar mediación

El objetivo principal de la mediación es lograr una solución que sea beneficiosa para ambas partes, asegurando una resolución justa y equitativa de cualquier disputa que pueda surgir. Para los vendedores que se enfrentan a reclamos, este proceso representa una herramienta eficaz para abordar conflictos de manera rápida y eficiente, al mismo tiempo que mantiene una relación positiva tanto con sus clientes como con la plataforma de Mercado Libre. Esta táctica, además de promover la satisfacción del cliente, fortalece la reputación del vendedor y fomenta una atmósfera colaborativa en el entorno de Mercado Libre.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/open-dispute
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/actions/open-dispute
```

**Respuesta:**

```
{
   "id": 5204934310,
   "resource_id": 2000008026430162,
   "status": "opened",
   "type": "mediations",
   "stage": "dispute",
   "parent_id": null,
   "resource": "order",
   "reason_id": "PDD9549",
   "fulfilled": true,
   "quantity_type": "total",
   "players": [
       {
           "role": "complainant",
           "type": "buyer",
           "user_id": 1277895049,
           "available_actions": []

       },
       {
           "role": "respondent",
           "type": "seller",
           "user_id": 1582937623,
           "available_actions": [
               {
                   "action": "send_message_to_mediator",
                   "mandatory": false,
                   "due_date": null
               }
           ]
       },
       {
           "role": "mediator",
           "type": "internal",
           "user_id": 46622406
       }
   ],
   "resolution": null,
   "site_id": "MLB",
   "date_created": "2024-04-12T08:26:23.000-04:00",
   "last_updated": "2024-04-12T08:27:43.000-04:00"
}
```

Nota:

Cuando la mediación se activa, se establece un canal exclusivo de comunicación a través de Mercado Libre, lo que implica que no se pueden enviar mensajes directos al comprador. En este proceso, es esencial ajustar el "receiver_role" a "mediator" para asegurar que todas las interacciones sean gestionadas de manera centralizada y eficiente por la plataforma. Este enfoque garantiza una mediación efectiva y transparente, optimizando el flujo de información y facilitando una resolución rápida y equitativa de cualquier disputa.

## Opciones de resolución de reclamos

La expectativa de resolución del reclamante se registra como información adicional junto al reclamo, asegurando que sus deseos sean considerados al momento de emitir un fallo. Esta práctica no solo demuestra un compromiso con la satisfacción del cliente, sino que también permite una toma de decisiones más informada y personalizada.

### Tipos de expected-resolutions

| EXPECTED RESOLUTION | CLAIM TYPE | EXPECTATION |
| --- | --- | --- |
| product | PNR | El comprador desea que llegue el producto. |
| refund | PNR y PDD | El comprador desea la devolución del dinero del producto (inicio de reclamo - expected creada por el comprador) / El vendedor directamente ejecuta la devolución del dinero (cierre del reclamo - expected creada por el vendedor) |
| change_product | PDD | El comprador desea que le cambien el producto. |
| return_product | PDD | El comprador desea la devolución del dinero del producto. |

Nota:

Las resoluciones pueden ser aceptadas o rechazadas, y en caso de ser rechazadas, se ofrece una alternativa. Esto permite adaptarse a las necesidades específicas de cada situación, asegurando que se explore todas las opciones disponibles para llegar a una solución satisfactoria.

### Consultar resoluciones esperadas

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/expected-resolutions
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/expected-resolutions
```

**Respuesta:**

```
[
    {
        "player_role": "complainant",
        "user_id": 1354382565,
        "expected_resolution": "return_product",
        "details": [],
        "date_created": "2023-04-18T12:06:48.000-04:00",
        "last_updated": "2023-04-18T12:06:48.000-04:00",
        "status": "pending"
    }
]
```

### Campos de la respuesta

La respuesta de un GET al recurso /claims/expected-resolutions proporcionará los siguientes parámetros:

- **player_role** : Actor que inicia o interactúa en el reclamo  complainant respondent mediator

- **user_id** : ID del usuario que inicia el reclamo

- **expected_resolution** : Resolución del reclamo cargada por el player indicado en el parámetro anterior.  refund: el player espera que se devuelva el dinero. product: el player espera que le llegue el producto. change_product: el player espera cambiar el producto. return_product: el player espera que se devuelva el producto con la posterior devolución del dinero.

- **detail** : Información adicional sobre expected-resolution

- **date_created** : fecha de creación de la resolución esperada.

- **last_updated** : fecha de última actualización de la resolución esperada

- **status** : Estado de resolución del reclamo  pending: el player cargó la resolución esperada pero no aún no fue aceptada por la contraparte. accepted: La resolución cargada por el player fue aceptada por su contraparte o en su defecto por el mediador de Mercado Libre. rejected: La resolución cargada por el player fue rechazada por su contraparte y en su defecto cargó una nueva opción de resolución.

Nota:

A pesar de las resoluciones presentadas por los participantes, en ciertos escenarios, la determinación final recae en un representante de Mercado Libre, especialmente cuando las partes no logran alcanzar un acuerdo mutuo. Este proceso garantiza que incluso en situaciones de desacuerdo, se tome una decisión imparcial y justa, preservando la integridad y la equidad del sistema de mediación.

## Consultar resoluciones esperadas

Devuelve ofertas posibles de **reembolso parcial** , ahora enriquecidas con dos nuevas listas:

- `recommendations`: sugerencias al seller/integrador (`percentage`, `reason`, `type`).

- `restrictions`: restricciones de mínimo (ídem arriba). Si no hay recomendaciones/restricciones, devuelve listas vacías.

**Llamada:**

```
curl --location 'https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/partial-refund/available-offers' \
--header 'Authorization: Bearer <TOKEN>' \
```

**Ejemplo:**

```
curl --location 'https://api.mercadolibre.com/post-purchase/v1/claims/5341941616/partial-refund/available-offers' \
--header 'Authorization: Bearer <TOKEN>' \
```

**Respuesta:**

```
{
  "currency_id": "MXN",
  "available_offers": [
    { "amount": 855.00, "percentage": 90.0 },
    { "amount": 950.00, "percentage": 100.0 }
  ],
  "recommendations": [
    {
      "percentage": 40.0,
      "reason": "PARTIAL_REFUND_BETTER_THAN_RETURN",
      "type": "maximum"
    }
  ],
  "restrictions": [
    {
      "percentage": 50.0,
      "reason": "PAREX_REJECTED",
      "type": "minimum"
    }
  ]
}
```

### Parámetros de Respuesta

La respuesta de un GET al recurso `/v1/claims/{claim_id}/partial-refund/available-offers` puede devolver:

- **400** : Parámetro inválido, intento de uso fuera del mínimo

- **403** : ClaimId no existe

- **404** : Usuario no autorizado

- **422** : Claim no apto para el flujo (ej: CBT, sin return label)

## Reembolso parcial de dinero

El flujo de reembolso parcial está estrechamente ligado al proceso de reclamación del comprador. Dependiendo de las opciones disponibles para el vendedor, se puede ofrecer una solución al reclamo devolviendo una parte del importe pagado por la compra.

Por esta razón, es crucial que el conjunto de acciones disponibles, representado por el array **available_actions** , incluya la opción de **allow_partial_refund** , tal como se ilustra en el siguiente ejemplo:

**Respuesta:**

```
[
    {
    "id": 123,
    "type": "mediations",
    "stage": "claim",
    "status": "opened",
    "parent_id": null,
    "client_id": null,
    "resource_id": 123,
    "resource": "order",
    "reason_id": "PDD9551",
    "fulfilled": true,
    "players":
    [
        {
            "role": "complainant",
            "type": "buyer",
            "user_id": 123,
            "available_actions":
            []
        },
        {
            "role": "respondent",
            "type": "seller",
            "user_id": 123,
            "available_actions":
            [
                {
                    "action": "send_message_to_complainant",
                    "due_date": "2023-01-27T22:43:59.000-04:00",
                    "mandatory": true
                },
                {
                    "action": "refund",
                    "due_date": null,
                    "mandatory": false
                },
                {
                    "action": "allow_partial_refund",
                    "due_date": null,
                    "mandatory": false
                }
            ]
        }
    ],
    "resolution": null,
    "labels": null,
    "site_id": "MLB",
    "date_created": "2023-01-23T09:59:05.000-04:00",
    "last_updated": "2023-01-23T11:18:01.000-04:00"
}
]
```

### Cómo ofrecer reembolso parcial

Para conceder un reembolso parcial, el reclamo debe estar en PDD, con **expected_resolution**  establecido como **return_product**  y **status**  pending. Es necesario consultar el recurso /available-offers para determinar los montos y porcentajes de reembolso disponibles. Este enfoque garantiza una gestión precisa y transparente de las devoluciones parciales, optimizando así la experiencia tanto del comprador como del vendedor.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/partial-refund/available-offers
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/partial-refund/available-offers
```

**Respuesta:**

```
{
    "currency_id": "MXN",
    "available_offers": [
        {
            "amount": 268.20,
            "percentage": 90.0
        },
        {
            "amount": 238.40,
            "percentage": 80.0
        },
        {
            "amount": 208.60,
            "percentage": 70.0
        },
        {
            "amount": 178.80,
            "percentage": 60.0
        },
        {
            "amount": 149.00,
            "percentage": 50.0
        },
        {
            "amount": 119.20,
            "percentage": 40.0
        },
        {
            "amount": 89.40,
            "percentage": 30.0
        },
        {
            "amount": 59.60,
            "percentage": 20.0
        },
        {
            "amount": 29.80,
            "percentage": 10.0
        }
    ]
}
"recommendations": [
       {
           "percentage": 40.0,
           "reason": "partial_refund_better_than_return",
           "type": "maximum",
           "restrictions": [
               {
                   "percentage": 30.0,
                   "reason": "parex_rejected",
                   "type": "minimum"
               }
           ]
       }
   ]
}
```

### Campos de la respuesta

La respuesta de un GET al recurso /claims/partial-refund/available-offers-resolutions proporcionará los siguientes parámetros:

- **currency_id** : moneda

- **amount** : valor de la devolución

- **percentage** : porcentaje de devolución representando el valor (amount)

Nota:

Para seleccionar el porcentaje de reembolso, es esencial realizar una elección activa. En caso de no especificar un porcentaje, se asignará automáticamente un valor predeterminado de reembolso del 50%, establecido como **default_percentage** .

Al ofrecer un reembolso parcial, se produce una transición en el campo **expected_resolution** . Inicialmente, este campo estaba del lado del vendedor con **player_role: complainant** . Sin embargo, al ofrecer un reembolso parcial, este campo será rechazado y se creará uno nuevo con **expected_resolution=partial_refund** . En este nuevo campo, el estado será pendiente y la responsabilidad recaerá en el comprador, con **player_role: respondent** . Este cambio de roles y estados asegura una gestión fluida y transparente de los reembolsos parciales, optimizando así la experiencia de todos los involucrados.

Después de obtener los montos y porcentajes disponibles, procederás a realizar la solicitud POST correspondiente para efectuar la devolución seleccionada. Es importante destacar que en este punto, no se permite ofrecer un reembolso del 100% a través de este endpoint específico. Es decir, el reembolso total no puede ser ofrecido en el contexto de una solicitud de reembolso parcial. Esta limitación asegura un manejo preciso y coherente de las devoluciones, alineado con las políticas establecidas.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{
 "percentage"=$VALOR
}

https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/expected-resolutions/partial-refund
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{
 "percentage"= 50
}

https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/expected-resolutions/partial-refund
```

**Respuesta:**

```
[
    {
        "player_role": "complainant",
        "user_id": 1680903379,
        "details": [],
        "expected_resolution": "return_product",
        "date_created": "2024-04-11T11:22:06",
        "last_updated": "2024-04-11T11:22:06",
        "status": "rejected"
    },
    {
        "player_role": "respondent",
        "user_id": 1277895049,
        "details": [
            {
                "key": "percentage",
                "value": "50.0"
            },
            {
                "key": "seller_amount",
                "value": "2500.0"
            },
            {
                "key": "seller_currency",
                "value": "R$"
            }
        ],
        "expected_resolution": "partial_refund",
        "date_created": "2024-04-16T13:05:04",
        "last_updated": "2024-04-16T13:05:04",
        "status": "pending"
    }

]
```

Si envía un valor distinto de los permitidos, recibirá esta respuesta:

**Respuesta:**

```
{
    "message": "Percentage not found 35.0",
    "error": "error checking configuration percentage",
    "status": 400,
    "cause": []
}
```

Si el vendedor no tiene habilitado el reembolso parcial, recibirá esta respuesta:

**Respuesta:**

```
{
    "message": "Action allow_partial_refund not available for player",
    "error": "bad_request",
    "status": 400,
    "cause": []
}
```

Nota:

- Si el reembolso parcial es aceptado por el comprador, el reclamo será cerrado y se reembolsará al comprador el monto correspondiente al porcentaje ofrecido.

- Si el reembolso parcial no es aceptado por el comprador, la resolución de reembolso parcial esperada se marcará como rechazada. Esta notificación indica que la solicitud de reembolso parcial no ha sido aceptada en su estado actual.

## Devolución total del dinero

Cuando se dispone de la opción **available_actions**  como **refund** , se pueden utilizar los siguientes recursos para realizar la devolución total del dinero al comprador a través del reclamo.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/expected-resolutions/refund
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/expected-resolutions/refund
```

**Respuesta:**

```
[
    {
        "player_role": "complainant",
        "user_id": 1680903379,
        "expected_resolution": "return_product",
        "status": "rejected",
        "detail": [],
        "date_created": "2024-04-11T11:22:06",
        "last_update": "2024-04-11T11:22:06"
    },
    {
        "player_role": "respondent",
        "user_id": 1277895049,
        "expected_resolution": "partial_refund",
        "status": "rejected",
        "detail": [
            {
                "key": "percentage",
                "value": "50.0"
            },
            {
                "key": "seller_amount",
                "value": "2500.0"
            },
            {
                "key": "seller_currency",
                "value": "R$"
            }
        ],
        "date_created": "2024-04-16T13:05:04",
        "last_update": "2024-04-16T13:05:04"
    },
    {
        "player_role": "respondent",
        "user_id": 1277895049,
        "expected_resolution": "refund",
        "status": "accepted",
        "detail": [],
        "date_created": "2024-04-16T13:06:41",
        "last_update": "2024-04-16T13:06:41"
    }
]
```

Nota:

Esta respuesta presenta un ejemplo ilustrativo del proceso que comienza con una devolución de producto, la cual es inicialmente rechazada. Luego, se propone un reembolso parcial, el cual también es rechazado. Finalmente, se opta por aceptar el reembolso total. Este flujo demuestra la flexibilidad y adaptabilidad del sistema para encontrar la mejor solución posible, asegurando una experiencia satisfactoria para todas las partes involucradas.

## Devolución del producto

Importante:

**Importante:**  El recurso **/expected-resolutions/allow-return**  se agrega para realizar la devolución, lo que reemplaza la funcionalidad **aceptar resolución**  o **cargar una nueva resolución** , ya que ambos flujos resultaban en una devolución.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/expected-resolutions/allow-return
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/expected-resolutions/allow-return
```

**Respuesta:**

```
[
    {
        "player_role": "complainant",
        "user_id": 1680903379,
        "expected_resolution": "return_product",
        "status": "pending",
        "details": [],
        "date_created": "2024-04-15T12:13:28",
        "last_update": "2024-04-15T12:13:28"
    }
]
```

El tipo de reclamo influye directamente en las soluciones que se pueden ofrecer y en cómo se gestionan las expectativas tanto del comprador como del vendedor. Existen principalmente dos tipos de reclamos: "PNR" (pagado y no recibido) y "PDD" (producto defectuoso). Para identificar el tipo de reclamo, verifica las tres primeras letras del campo `reason_id`. Por ejemplo, si el campo contiene "PNR3430", el reclamo es de tipo "PNR".

Para los reclamos de tipo **PNR** , las opciones disponibles son:

- "refund": El comprador desea la devolución del dinero pagado por el producto.

- "product": El comprador desea recibir el producto que compró.

De manera similar, para los casos **PDD** , se presentan estas opciones:

- "return_product": El comprador desea la devolución del dinero pagado por el producto.

- "partial_refund": Se ofrece un reembolso parcial al comprador.

Con esta información, el vendedor puede decidir si desea proceder según el deseo del comprador o tomar una acción diferente en el reclamo, como ofrecer un reembolso parcial o gestionar la devolución del producto.

Para los casos de tipo **"PDD"**  donde la compra utiliza Mercado Envíos y el estado del envío es 'delivered', cuando el vendedor ofrece la devolución, se genera una etiqueta para que el comprador devuelva el producto. El dinero es reembolsado una vez que el envío de devolución se actualiza a 'shipped' o 'delivered'.

Si la resolución es la devolución total del dinero, el reclamo se cerrará y el importe será reembolsado al comprador.

Si la resolución es un reembolso parcial, el comprador recibirá una oferta de reembolso. Si acepta la oferta, el reclamo se cerrará. En caso de no aceptarla, el comprador puede optar por abrir una disputa.

Este enfoque asegura que todos los involucrados comprendan el proceso y las opciones disponibles, promoviendo una gestión eficiente y transparente de los reclamos. Vendedores y compradores pueden gestionar los reclamos con confianza, asegurando atención justa.

Siguiente: [Gestionar evidencia de reclamos](https://developers.mercadolibre.com.ar/es_ar/gestionar-evidencia-de-reclamos?)
