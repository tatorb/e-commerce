<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestionar-devoluciones -->
<!-- Sección: Guía para productos > Reclamos, Devoluciones y Cambios -->

# Devoluciones

Última actualización 22/12/2025

## ¿Qué es una devolución?

Una devolución es un proceso crucial en la experiencia de compra en nuestra plataforma, mediante el cual un comprador puede devolver un artículo al vendedor. Este procedimiento puede activarse por diversas razones, tales como discrepancias entre la descripción del producto y su estado real, problemas de funcionamiento, o incluso un cambio de opinión por parte del comprador. Gestionar eficazmente las devoluciones es fundamental para mantener la confianza y satisfacción del cliente, asegurando que cualquier problema se resuelva de manera transparente y eficiente.

Nota:

El recurso /post-purchase/v2/claims/$CLAIM_ID/returns es una herramienta esencial que te permite acceder a los detalles específicos de cada devolución, identificada por su $CLAIM_ID, incluyendo sus tipos, subtipos y estados.

En Mercado Libre, gestionamos varios tipos de devoluciones para asegurar una experiencia de compra transparente y justa:

- **claim:**  Devolución iniciada a través de un reclamo del comprador.

- **dispute:**  Devolución resultante de una disputa entre el comprador y el vendedor.

- **automatic:**  Devolución iniciada por el comprador, procesada automáticamente por el sistema.

Estos diferentes tipos de devoluciones nos permiten abordar cada situación de manera específica, garantizando que tanto compradores como vendedores reciban el soporte adecuado en cada etapa del proceso post-compra.

## Gestionar una devolución

Para identificar correctamente una devolución, hacemos las siguientes recomendaciones:

1. Monitorear la notificación del reclamo: Escucha el feed de reclamos (feed claims), el cual contiene la información de la orden en la que se originó el reclamo.

2. Consultar el recurso /claims/$CLAIMS para acceder al campo "related_entities", que ofrece una lista de entidades vinculadas al reclamo. Si existe el valor "return" significa que hay una devolución asociada a este reclamo. Ahora puedes consultar el recurso de Returns para obtener los detalles de la devolución y tomar las medidas necesarias dentro de los plazos establecidos.

Para más información, consulta la documentación de [Gestión de Reclamos](https://developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo).

## Consultar una devolución

Para consultar una devolución, realiza una solicitud a post-purchase/v2/claims/$CLAIM_ID/returns, especificando el $CLAIM_ID. Esto te proporcionará información detallada sobre la devolución asociada al reclamo correspondiente.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v2/claims/$CLAIM_ID/returns
```

**Respuesta:**

```
{
    "id": 57341011,
    "last_updated": "2024-09-10T17:26:41.704+00:00",
    "shipments": [
        {
            "shipment_id": 43810672299,
            "status": "delivered",
            "tracking_number": null,
            "destination": {
                "name": "warehouse",
                "shipping_address": {
                    "address_id": 0,
                    "address_line": "Av. Dr. Antonio Joao Abdalla, 3333",
                    "street_name": "Av. Dr. Antonio Joao Abdalla",
                    "street_number": "3333",
                    "comment": "Mercado Livre",
                    "zip_code": "07750020",
                    "city": {
                        "id": "QlItU1BDYWphbWFy",
                        "name": "Cajamar"
                    },
                    "state": {
                        "id": "BR-SP",
                        "name": "São Paulo"
                    },
                    "country": {
                        "id": "BR",
                        "name": "Brasil"
                    },
                    "neighborhood": {
                        "id": null,
                        "name": "Empresarial Colina"
                    },
                    "municipality": {
                        "id": null,
                        "name": null
                    }
                }
            },
            "type": "return"
        },
        {
            "shipment_id": 43825249694,
            "status": "pending",
            "tracking_number": null,
            "destination": {
                "name": "seller_address",
                "shipping_address": {
                    "address_id": 1351779578,
                    "address_line": "Rua Rio Grande SN",
                    "street_name": "Rua Rio Grande",
                    "street_number": "SN",
                    "comment": "Referencia: test",
                    "zip_code": "09831740",
                    "city": {
                        "id": "BR-SP-39",
                        "name": "São Bernardo do Campo"
                    },
                    "state": {
                        "id": "BR-SP",
                        "name": "São Paulo"
                    },
                    "country": {
                        "id": "BR",
                        "name": "Brasil"
                    },
                    "neighborhood": {
                        "id": null,
                        "name": "Rio Grande"
                    },
                    "municipality": {
                        "id": null,
                        "name": null
                    }
                }
            },
            "type": "return_from_triage"
        }
    ],
    "refund_at": "delivered",
    "date_closed": null,
    "resource_type": "order",
    "date_created": "2024-09-06T16:24:26.636+00:00",
    "claim_id": 5298178312,
    "status_money": "retained",
    "resource_id": 2000009229357366,
    "orders": [
        {
            "order_id": 2000009229357366,
            "item_id": "MLB3840513395",
            "variation_id": null,
            "context_type": "total",
            "total_quantity": "1.0",
            "return_quantity": "1.0"
        }
    ],
    "subtype": "return_total",
    "status": "delivered",
    "related_entities": [
        "reviews"
    ],
    "intermediate_check": true,
    "resources": [
        {
            "resource": "claim",
            "resource_id": "5383321687"
        }
    ]
}
```

### Campos de la respuesta

La respuesta de un GET al recurso v2/claims/$CLAIM_ID/returns proporcionará los siguientes campos:

- **id** : identificador de la devolución (return_id).

- **last_updated** : fecha de última actualización.

- **shipments** : lista de envíos asociados a la devolución.  **shipment_id** : identificador del envío. **status** : estado en el que se encuentra el envío. Posibles valores:  **pending** : cuando se genera el envío. **ready_to_ship** : etiqueta lista para despachar. **shipped** : enviado. **not_delivered** : no entregado. **delivered** : entregado. **cancelled** : envío cancelado.   **tracking_number** : número de seguimiento del envío de la devolución. **destination** : información del destino del envío.  **name** : nombre del destino. Posibles valores:  **seller_address** : destino vendedor. **warehouse** : destino depósito de Mercado Libre.   **shipping_address** : dirección de envío.  **address_id** : identificador de la dirección. **address_line** : dirección completa. **street_name** : nombre de la calle. **street_number** : número de la calle. **comment** : comentario adicional. **zip_code** : código postal. **city** : ciudad (objeto con **id**  y **name** ). **state** : estado (objeto con **id**  y **name** ). **country** : país (objeto con **id**  y **name** ). **neighborhood** : barrio (objeto con **id**  y **name** ). **municipality** : municipio (objeto con **id**  y **name** ).     **type** : tipo de envío. Posibles valores:  **return** : envío con destino seller o warehouse. **return_from_triage** : envío desde warehouse para una revisión intermedia.

- **refund_at** : cuándo se devuelve el dinero al comprador. Posibles valores:  **shipped** : cuando el comprador realiza el despacho del envío de la devolución. **delivered** : 3 días después de que el vendedor recibe el envío. **n/a** : para casos low cost que no generan una devolución.

- **date_closed** : fecha en la que se cierra la devolución.

- **resource_type** : nombre del recurso al cual se asocia la devolución. Posibles valores:  **order**  **claim**  **shipment**  **other**

- **date_created** : fecha de creación de la devolución.

- **claim_id** : ID del reclamo al que está asociada la devolución.

- **status_money** : estado del dinero. Posibles valores:  **retained** : dinero en cuenta pero retenido. **refunded** : dinero devuelto al comprador. **available** : dinero disponible.

- **resource_id** : identificador del recurso asociado.

- **orders** : lista de órdenes asociadas.  **order_id** : identificador de la orden. **item_id** : identificador del ítem. **variation_id** : identificador de la variación. **context_type** : contexto del ítem. Posibles valores:  **total** : reclamada por toda la orden. **partial** : reclamada por cantidad parcial. **incomplete** : unidades no recibidas, no pueden devolverse.   **total_quantity** : cantidad total de ítems. **return_quantity** : cantidad de ítems a devolver.

- **subtype** : subtipo de devolución. Posibles valores:  **low_cost** : devolución automática de tipo low cost. **return_partial** : devolución parcial. **return_total** : devolución total.

- **status** : estado actual de la devolución. Posibles valores:  **pending_cancel** : en proceso de cancelación. **pending** : devolución creada e inicializando el shipment. **failed** : no se pudo crear y/o inicializar el shipment. **shipped** : devolución enviada, dinero retenido. **pending_delivered** : en proceso de pasar a delivered. **return_to_buyer** : devolución volviendo al comprador. **pending_expiration** : en proceso de expiración. **scheduled** : programada para retirada. **pending_failure** : en proceso de falla. **label_generated** : devolución lista para ser enviada. **cancelled** : devolución cancelada, dinero disponible. **not_delivered** : devolución no entregada. **expired** : devolución expirada. **delivered** : devolución en manos del vendedor.

- **related_entities** : entidades relacionadas. Ejemplo: ["reviews"]

- **intermediate_check** : indica si se realizó verificación intermedia. Posibles valores:  **true**  **false**

- **resources** : lista de recursos (claims) asociados a la devolución.

Nota:

Recuerda que el recurso /shipments/$SHIPMENT_ID/costs devuelve los costos del envío que deberá afrontar el usuario.

## Obtener detalles de las revisiones de una devolución

### ¿Cómo identificar la posibilidad de consultar la API de GET Reviews?

La API de [GET Returns](https://developers.mercadolibre.com.ar/es_ar/gestionar-devoluciones?nocache=true#Consultar-una-devolucion) devolverá el campo related_entities, el cual debe contener el ítem "reviews" para indicar que existe una revisión para esa devolución.

### ¿Qué son las apelaciones?

Es cuando una devolución tiene una revisión por parte del proceso de triage y el vendedor puede cuestionar o disputar la decisión tomada.

### ¿Cuál es la diferencia entre apelaciones y devolución con falla?

- **Devolución con falla:**  Ocurre cuando no hay una revisión por parte del triage y el vendedor es el responsable de realizar dicha revisión, pudiendo indicar si el producto llegó con algún problema.

- **Apelación:**  Es la respuesta del vendedor a una decisión ya tomada por el triage.

### Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/returns/$RETURN_ID/reviews
```

### Parámetros de consulta

| Variable | Tipo | Valor ejemplo | Descripción |
| --- | --- | --- | --- |
| RETURN_ID | Long | 54640533964 | ID del return obtenido a través del endpoint: `/post-purchase/v2/claims/$CLAIM_ID/returns` |

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/returns/54640533964/reviews
```

**Respuesta:**

```
{
  "reviews": [
    {
      "resource": "order",
      "resource_id": 20000053458866422,
      "method": "triage",
      "resource_reviews": [
        {
          "stage": "",
          "status": "success",
          "product_condition": "unsaleable",
          "product_destination": "seller",
          "reason_id": "accepted",
          "benefited": "buyer",
          "seller_status": "failed",
          "seller_reason": "SRF2",
          "benefited_type": null,
          "benefited_reason": null,
          "missing_quantity": 1
        }
      ],
      "date_created": "2024-08-27T14:58:21.978Z",
      "last_updated": "2024-08-27T14:58:21.978Z"
    }
  ]
}
```

### Parámetros de respuesta:

| Campo | Tipo | Valor ejemplo | Posibles valores | Descripción |
| --- | --- | --- | --- | --- |
| reviews | List<Review> | [] | [] | Listado de las revisiones finalizadas por el proceso de triage o por el seller. |
| resource | String | "order" | "order" | Tipo de recurso que estará relacionado con la revisión. Para el carrito, será order. Para los casos distintos al carrito, el recurso también será order. |
| resource_id | Long | 2000008990790882 | > 0 | ID del recurso indicado en resource. |
| method | String | "none" | **"none"** : revisión realizada por el vendedor  **"triage"** : revisión por triage. | Indica el método de revisión de la devolución. |
| date_created | String | "2024-09-03T22:43:06.633Z" | - | Fecha de creación de la review (ISO 8601). |
| last_updated | String | "2024-09-03T22:43:06.633Z" | - | Fecha de actualización de la review (ISO 8601). |
| resource_reviews | List<ResourceReview> | [] | - | Lista con los detalles de las revisiones. |

### Campos de resource_reviews:

| Campo | Tipo | Valor ejemplo | Posibles valores | Descripción |
| --- | --- | --- | --- | --- |
| stage | String | "closed" | **"closed"** : La revisión ha finalizado. Puede ser a través de una triage que haya dado lugar a una apelación del vendedor o a una devolución marcada como fallida.  **"pending"** : La devolución fallida está pendiente de resolución.  **"seller_review_pending"** : Revisión de triage que puede tener una apelación por parte del vendedor y está pendiente.  **"timeout"** : El tiempo para revisar el producto ha expirado. | Casos posibles: 1. Resultó en una apelación iniciada por el vendedor; 2. Tiempo de resolución agotado. |
| status | String | "success" | **"success"** : Revisión realizada y el producto está OK.  **"failed"** : indica que el operador ha detectado que el producto tiene algún problema. El campo product_condition detalla el estado del producto.  **""** : no tienen una revisión de la triage.  **null** : es una revisión realizada por el vendedor. | Estado de la revisión realizada por la triage. Puede ser un string vacío ("") en caso de una devolución fallida, ya que este campo es exclusivo para devoluciones al Warehouse. Cuando no hay triage, el valor es null. |
| product_condition | String | "saleable" | **"saleable"** : el producto está en buenas condiciones para su venta.  **"discard"** : el producto ha sido descartado.  **"unsaleable"** : El producto no es apto para la venta. O bien el producto se ha descartado y posteriormente se puede vender en B2B. Cuando "product_condition" = "discard", esto no ocurre.  **"missing"** : El producto no llegó para su revisión.  **"" o null** : cuando no hay triage. | Condición del producto. |
| product_destination | String | "meli" | **"meli"**   **"buyer"**   **"seller"**   **""**   **null** | Destino del producto tras el análisis de la triage. Observaciones: 1. En casos de missing, el valor de este campo estará vacio (""). 2. Cuando no hay triage, el valor es null. |
| reason_id | String | "accepted" | **"accepted"**   **"different_product"**   **"discard"**   **"misused"**   **"not_working"**   **"incomplete"**   **"blocked"**   **"open_box"**   **"missing"**   **"default"**   **null** | Clasificación elegida en el proceso de triage. Valor "default": casos en los que la triage no ha podido generar una revisión. Valor null: no hay triage. |
| benefited | String | "both" | **"both"**   **"buyer"**   **"seller"**   **null** | Indica quién fue el beneficiario de la revisión de la triage. Valor null: no hay triage. |
| benefited_type | String | - | **null**   **"partial_buyer"** | Cuando hay una devolución parcial, indique quién realizó la devolución parcial. |
| benefited_reason | String | null | **null**   **"penalty_low"**   **"penalty_mid"**   **"penalty_high"** | Cuando hay una devolución parcial, indica si el comprador ha recibido una penalización. |
| seller_status | String | "pending" | **"pending"** : a tiempo para que el vendedor realice la revisión.  **"success"** : Seller indica que el producto está OK; Seller no revisó a tiempo; El representante le dio la razón al comprador.  **"failed"** : El representante le dio la razón al vendedor.  **"claimed"** : seller revisó y reclamó/contestó.  **""** : La revisión por triage no merece una nueva revisión por parte del vendedor, ya sea porque la decisión da lugar a un descarte, una devolución al comprador o restock.  **null** : cuando el vendedor no ha recibido el producto para revisarlo o cuando no es necesario revisar el producto. | Estado de la revisión del vendedor, si procede. Puede ser una string vacía (""). |
| seller_reason | String | "SRF2" | **"SRF2"**   **"SRF3"**   **"SRF6"**   **"SRF7"**   **null** : cuando el vendedor no ha revisado el producto o cuando ha indicado que el producto está OK. | Identifica el motivo alegado por el vendedor si la revisión no se realiza correctamente. Para consultar el significado de cada motivo, consulte la API: `/post-purchase/v1/returns/reasons?flow=$FLOW&claim_id=$CLAIM_ID` |
| missing_quantity | Long | 1 | **>= 0**   **null** | Número de ítems faltantes. Se utiliza para identificar el número de ítems que no se han revisado porque el producto no ha llegado para su revisión. |

### Errores

### 404 Not Found

```
{
  "code": 404,
  "error": "not_found_error",
  "message": "return review not found",
  "cause": null
}
```

No se ha encontrado la review para la devolución. Verifique si el campo related_entities en el recurso `/post-purchase/v2/claims/$CLAIM_ID/returns` contiene el elemento "reviews" para indicar que existe una review para la devolución.

## Revisión de una devolución

Cuando una devolución llega al vendedor, éste tiene la posibilidad de hacer una revisión de la misma indicando si el producto llegó en las condiciones esperadas o si hay algún problema con el mismo.

Importante:

Hemos unificado los flujos de **revisión OK**  y **revisión con falla**  en un **único endpoint**  basado en `return_id`. A partir de ahora, debes usar `/post-purchase/v1/returns/{return_id}/return-review` para ambos casos.

### Cómo obtener el return_id

Para realizar una revisión de devolución, primero necesitas obtener el **return_id** . Sigue estos pasos:

1. Consulta el recurso `/post-purchase/v2/claims/$CLAIM_ID/returns` para obtener los detalles de la devolución.

2. Extrae el **return_id**  de la respuesta (se retorna como `id` en el objeto de devolución).

3. Usa este **return_id**  para realizar la revisión.

### Verificar si la revisión está disponible

Para saber si el vendedor tiene habilitada la opción de hacer una revisión, consulta el recurso `/claims/$CLAIM_ID`. Dentro del array de **"players"** , busca el player `"type": "seller"` y valida que en sus **"available_actions"**  exista:

- `"action": "return_review_ok"` - para aprobar la devolución

- `"action": "return_review_fail"` - para reportar un problema

## Realizar una revisión

Usa el endpoint unificado para enviar tu revisión de devolución. El body de la solicitud determina si es una revisión exitosa (OK) o una revisión fallida.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
https://api.mercadolibre.com/post-purchase/v1/returns/$RETURN_ID/return-review \
-d '$REQUEST_BODY'
```

## Revisión OK (producto llegó como esperado)

Para confirmar que el producto llegó en las condiciones esperadas, envía un body vacío:

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
https://api.mercadolibre.com/post-purchase/v1/returns/267582953/return-review \
-d '{}'
```

## Obtener razones para crear una revisión fallida

Para crear una revisión fallida tendrás que conocer la razón por la cual el vendedor identifica que el producto no llegó en las condiciones esperadas.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/post-purchase/v1/returns/reasons?flow=$FLOW&claim_id=$CLAIM_ID'
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/post-purchase/v1/returns/reasons?flow=seller_return_failed&claim_id=5555555'
```

Es necesario enviar:

- **flow:**  Indicando las reasons de qué flujo queremos obtener (por ahora solo es válido el valor **seller_return_failed** )

- **claim_id:**  Identificador único del reclamo.

**Respuesta:**

```
[
    {
        "id": "SRF2",
        "name": "product_damaged",
        "detail": "El producto llegó dañado",
        "position": 1,
        "apply": [
            "order"
        ]
    },
    {
        "id": "SRF3",
        "name": "return_incomplete",
        "detail": "La devolución está incompleta",
        "position": 2,
        "apply": [
            "order"
        ]
    },
    {
        "id": "SRF4",
        "name": "returned_product_different",
        "detail": "Devolvieron un producto distinto al que envié",
        "position": 3,
        "apply": [
            "order"
        ]
    },
    {
        "id": "SRF5",
        "name": "product_not_in_package",
        "detail": "El producto no está en el paquete",
        "position": 4,
        "apply": [
            "order",
            "package"
        ]
    },
    {
        "id": "SRF6",
        "name": "another_failure_with_product",
        "detail": "Reportar otra falla en el producto",
        "position": 5,
        "apply": [
            "order"
        ]
    },
    {
        "id": "SRF7",
        "name": "return_has_not_arrived",
        "detail": "Aún no me llegó",
        "position": 6,
        "apply": [
            "package"
        ]
    }
]
```

**Errores:**

**Claim inexistente:**

```
{
    "code": 404,
    "error": "not_found_error",
    "message": "claim_Not Found",
    "cause": null
}
```

**Flow inválido:**

```
{
    "code": 400,
    "error": "bad_request_error",
    "message": "flow: invalid_flow does not exist. claimId: 5358155244",
    "cause": null
}
```

Actualmente solo es válido el flow **seller_return_failed** . Cualquier otro valor devolverá este error.

#### Campos de la respuesta

- **id** : Identificador de la reason. Este valor es el que se deberá enviar al crear una revisión fallida.

- **name** : Código de la reason.

- **detail** : Motivo de la devolución fallida para darle contexto al vendedor a la hora de elegir la reason.

- **position** : Posición recomendada de la reason a la hora de mostrarle todas las reasons al vendedor.

- **apply** : Indica para qué se puede utilizar la reason. En devoluciones carrito (que incluyen varias órdenes), hay reasons que aplican solo para todo el paquete, otras para las órdenes de manera individual y otras para ambos casos. Posibles valores: **package**  y **order** .

## Obtener nombre de las evidencias a adjuntar en la revisión fallida

Al crear una revisión fallida, también se habilita el envío de evidencias, con el fin de colaborar con más información al caso. Por lo tanto podrás utilizar el recurso de `/claims/$CLAIM_ID/returns/attachments` para la carga de archivos.

Como resultado, se obtendrá el nombre de archivo que se enviará como evidencia en la revisión. Se debe utilizar este recurso para cada evidencia que se quiera adjuntar a una revisión fallida.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/returns/attachments \
-F 'file=@"/Users/user/Downloads/file.png'
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/post-purchase/v1/claims/5255026166/returns/attachments \
-F 'file=@"/Users/user/Downloads/file.png'
```

**Respuesta:**

```
{
    "user_id": 1277895049,
    "file_name": "1277895049_9d6b8d38-a2c2-4d17-a68b-f0845bc35fd1.png"
}
```

**Errores:**

**Claim inexistente:**

```
{
    "code": 404,
    "error": "not_found_error",
    "message": "Claim not found. claimId: 5255026166",
    "cause": null
}
```

**Error con el body (por ejemplo no se le pasa una imagen):**

```
{
    "code": "bad_request",
    "message": "Error retrieving uploaded file. claim_id: 5356116886. caller_id: 1985874106"
}
```

**Invalid key:**

```
{
    "code": "not_found",
    "message": "Request error: [{\"status\":404,\"error\":\"not_found\",\"message\":\"Can not get attachment\"}]"
}
```

#### Campos de la respuesta

- **user_id** : identificador del usuario

- **file_name** : nombre del archivo que se podrá utilizar a la hora de crear una revisión fallida

Nota:

Con la nueva arquitectura, los adjuntos ya no se vinculan a nivel de `claim`, sino que se gestionan a través del **Return** , que puede estar asociado a uno o varios reclamos. Asegúrate de actualizar tu integración para usar `return_id` como la referencia correcta.

## Revisión con falla (producto llegó con problemas)

Para indicar que el producto tiene problemas, debes proporcionar la razón, un mensaje y opcionalmente evidencias.

### Parámetros

| Parámetro | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| reason | String | Sí | Identificador de la razón por la cual el producto no llegó como esperado. Valores obtenidos del recurso /returns/reasons. |
| message | String | Sí | Mensaje del vendedor explicando el problema con el producto devuelto. |
| attachments | Array[String] | Requerido para SRF2 y SRF4 | Nombres de archivos de evidencia a adjuntar. Valores obtenidos del recurso /returns/attachments. |
| order_id | Integer | Solo para casos carrito | Identificador de la orden. Solo usar para casos carrito al revisar una orden específica. No enviar para casos no carrito o revisiones completas de carrito. |

**Ejemplo - Revisión de orden individual:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
https://api.mercadolibre.com/post-purchase/v1/returns/267582953/return-review \
-d '[
  {
    "reason": "SRF2",
    "message": "El producto llegó con daño visible en la pantalla",
    "attachments": ["1277895049_9d6b8d38-a2c2-4d17-a68b-f0845bc35fd1.png"]
  }
]'
```

**Ejemplo - Caso carrito con múltiples órdenes:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
https://api.mercadolibre.com/post-purchase/v1/returns/267582953/return-review \
-d '[
  {
    "reason": "SRF2",
    "message": "Producto dañado",
    "attachments": ["1277895049_9d6b8d38-a2c2-4d17-a68b-f0845bc35fd1.png"],
    "order_id": 2000011248679992
  },
  {
    "reason": "SRF4",
    "message": "Producto diferente recibido",
    "attachments": ["1117895119_abc123-a1c7-4f1f-a68b-xyz789.png"],
    "order_id": 2000011248679993
  }
]'
```

**Ejemplo - Razón a nivel de paquete (ej. paquete no recibido):**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
https://api.mercadolibre.com/post-purchase/v1/returns/267582953/return-review \
-d '[
  {
    "reason": "SRF7",
    "message": "El paquete de devolución aún no ha llegado"
  }
]'
```

Nota:

Algunas razones aplican a todo el paquete (como SRF7 - "aún no llegó"), mientras que otras aplican a órdenes individuales. Revisa el campo

**apply**

en la respuesta de reasons para determinar el uso correcto:

- **package** : aplica a toda la devolución

- **order** : aplica a órdenes individuales

## Costo de envío de devoluciones e intercambios

Con el objetivo de mejorar la experiencia que ofrecemos a nuestros vendedores, hemos creado esta funcionalidad para permitir que pueda obtener la información de costo de envío de devoluciones e intercambios.

Para obtener la información del costo de envío de devoluciones e intercambios, realice una solicitud **GET**  a:

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/charges/return-cost'
```

Especificando el $CLAIM_ID. Esto proporcionará información detallada sobre el valor asociado al envío de devoluciones e intercambios de la reclamación correspondiente.

Nota:

El parámetro **calculate_amount_usd**  es un parámetro de consulta que, por defecto, tiene el valor `false`. Cuando se envía con el valor `true`, la aplicación realizará el cálculo del valor en dólares (USD). Si no se envía o se envía con el valor `false`, no se realizará el cálculo.

### Ejemplo con parámetro calculate_amount_usd=true

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/charges/return-cost?calculate_amount_usd=true'
```

**Respuesta:**

```
{
    "currency_id": "BRL",
    "amount": 42.90,
    "amount_usd": 7.517
}
```

### Ejemplo sin parámetro calculate_amount_usd

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/charges/return-cost'
```

**Respuesta:**

```
{
    "currency_id": "BRL",
    "amount": 42.90
}
```

### Campos de la respuesta

| Campo | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- |
| **currency_id** | String | ID de la moneda a la cual el campo amount se refiere | BRL, ARS, MXN |
| **amount** | BigDecimal | Valor a ser cobrado al vendedor por la devolución | 42.90 |
| **amount_usd** | BigDecimal | Valor en dólares (solo cuando calculate_amount_usd=true) | 7.517 |

## Errores

A continuación, se detallan los posibles mensajes de error que los recursos pueden generar:

**Si la reclamación no pertenece al vendedor:**

```
{
    "code": 400,
    "error": "bad_request_error",
    "message": "Invalid roleId :12343234 in claim :123454323",
    "cause": null
}
```

**Si la reclamación no existe:**

```
{
    "code": 404,
    "error": "not_found_error",
    "message": "claim id: 5255026166 not found",
    "cause": null
}
```

**Si el token no se envía:**

```
{
    "code": 401,
    "error": "unauthorized_request_error",
    "message": "Invalid caller.id",
    "cause": null
}
```

**Si el token ha expirado o es inválido:**

```
{
    "message": "invalid_token",
    "error": "not_found",
    "status": 401,
    "cause": []
}
```

**Si el token es incorrecto:**

```
{
    "message": "{\"message\":\"Malformed access_token: token\",\"error\":\"bad_request\",\"status\":400,\"cause\":[]}",
    "error": "",
    "status": 400,
    "cause": []
}
```

**Si el vendedor no está habilitado para hacer una revisión de devolución:**

```
{
    "code": 400,
    "error": "bad_request_error",
    "message": "Not valid action return_review_ok for player role respondent",
    "cause": null
}
```

**Si el formato del archivo que se desea adjuntar no es válido:**

```
{
    "code": 400,
    "error": "bad_request_error",
    "message": "Invalid mime_type",
    "cause": null
}
```

**Si el nombre del archivo no es válido:**

```
{
    "code": 400,
    "error": "bad_request_error",
    "message": "Invalid file_name: ",
    "cause": null
}
```

**Si el campo "file" no se envía:**

```
{
    "code": 400,
    "error": "bad_request_error",
    "message": "Current request is not a multipart request",
    "cause": null
}
```

**Si alguno de los campos obligatorios no se envía:**

```
{
    "code": 400,
    "error": "bad_request_error",
    "message": "Required request body is missing or incorrect, please see the documentation.",
    "cause": null
}
```

Ir: [Gestionar reclamos](https://developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo)
