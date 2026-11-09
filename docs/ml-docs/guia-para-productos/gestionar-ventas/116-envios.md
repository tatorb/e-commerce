<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/envios -->
<!-- Sección: Guía para productos > Gestionar ventas -->

# Envíos

Última actualización 18/09/2026

## Gestionar envíos

El recurso /shipments contiene toda la información referida al envío que se debe realizar para concluir con la transacción.

Nota:

Puedes acceder informaciones sobre los diferentes tipos de logísticas en [Mercado Envíos 2](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-2).

**Importante:**  Tengas en cuenta que para trabajar con el Json de shipments, al hacer un GET, debes utilizar el header **"x-format-new: true"** .

Es importante recordar que [el nuevo JSON de Orders](https://developers.mercadolibre.com.ar/es_ar/ordenes-de-carrito) ya no contendrá datos de Shipping, como ha sido hasta ahora. El recurso /shipments/shipment_id/ seguirá teniendo su estructura, mostrando la información básica para realizar el envío. Hemos introducido algunos cambios en la estructura JSON, que puede ver a continuación

## Consultar envíos

**Importante:**

A partir del **12 de octubre de 2025** , los campos "order_id" y "external_reference" serán **descontinuados**  en los recursos de shipments y dejarán de ser retornados en las respuestas. Además, el envío del header x-format-new: true pasará a ser **obligatorio**  en todas las solicitudes. Asegúrate de actualizar tus integraciones antes de esa fecha.

Nota:

El domicilio del comprador en **destination**  se ocultará hasta que se confirme el pago del pedido. Por lo tanto, recuerde utilizar las [**notificaciones**](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones) en el tópico **shipments**  para recibir todas las actualizaciones. Además, la información del teléfono en **receiver_phone**  solo estará disponible para pedidos con Mercado Envios 1 ([ME1](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-1)).

Para los países Chile, Ecuador y Perú, Mercado Libre todavia no brinda los códigos de zip_code, lo cuál el vendedor o su integrador puede crear su propia lógica de identificación.

Ejemplo de llamada

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID
```

Respuesta

```
	{
    "snapshot_packing": {
        "snapshot_id": "string",
        "pack_hash": "string"
    },
    "last_updated": "string",
    "items_types": [
        "new"
    ],
    "substatus": "string",
    "date_created": "string",
    "origin": {
        "node": "string", // campo correspondiente a la network_node_id de multi-origen
        "shipping_address": {
            "country": {
                "id": "string",
                "name": "string"
            },
            "address_line": "XXXXXXX",
            "types": [
                "billing",
                "default_return_address",
                "default_selling_address",
                "flex_pickup",
                "shipping"
            ],
            "scoring": 0,
            "agency": {
                "carrier_id": null,
                "phone": null,
                "agency_id": null,
                "description": null,
                "type": null,
                "open_hours": null
            },
            "city": {
                "id": "string",
                "name": "string"
            },
            "geolocation_type": "string",
            "latitude": 0,
            "address_id": 0,
            "municipality": {
                "id": null,
                "name": null
            },
            "location_id": 0,
            "street_name": "XXXXXXX",
            "zip_code": "XXXXXXX",
            "geolocation_source": "string",
            "node": {
                "node_id": "string" // campo correspondiente a la network_node_id de multi-origen
            },
            "intersection": null,
            "street_number": "XXXXXXX",
            "comment": "XXXXXXX",
            "state": {
                "id": "string",
                "name": "string"
            },
            "neighborhood": {
                "id": null,
                "name": "string"
            },
            "geolocation_last_updated": "string",
            "longitude": 0
        },
        "type": "string",
        "sender_id": 0,
        "snapshot": {
            "id": "string",
            "version": 0
        }
    },
    "destination": {
        "comments": null,
        "receiver_id": 0,
        "receiver_name": "string",
        "shipping_address": {
            "country": {
                "id": "string",
                "name": "string"
            },
            "address_line": "string",
            "types": [
                "string"
            ],
            "scoring": 0,
            "agency": {
                "carrier_id": null,
                "phone": null,
                "agency_id": null,
                "description": null,
                "type": null,
                "open_hours": null
            },
            "city": {
                "id": "string",
                "name": "string"
            },
            "geolocation_type": "string",
            "latitude": 0,
            "address_id": 0,
            "municipality": {
                "id": null,
                "name": null
            },
            "location_id": 0,
            "street_name": "string",
            "zip_code": "string",
            "geolocation_source": "string",
            "delivery_preference": "string",
            "node": null,
            "intersection": null,
            "street_number": "string",
            "comment": null,
            "state": {
                "id": "string",
                "name": "string"
            },
            "neighborhood": {
                "id": null,
                "name": "string"
            },
            "geolocation_last_updated": "string",
            "longitude": 0
        },
        "type": "string",
        "receiver_phone": "1199988776644",
        "snapshot": {
            "id": "string",
            "version": 0
        }
    },
    "source": {
        "site_id": "string",
        "market_place": "MELI",
        "customer_id": null,
        "application_id": null
    },
    "tags": [
        "string"
    ],
    "declared_value": 0,
    "logistic": {
        "mode": "me2",
        "type": "drop_off",
        "direction": "forward"
    },
    "sibling": {
        "reason": null,
        "sibling_id": null,
        "description": null,
        "source": null,
        "date_created": null,
        "last_updated": null
    },
    "priority_class": {
        "id": "string"
    },
    "lead_time": {
        "processing_time": null,
        "cost": 0,
        "estimated_schedule_limit": {
            "date": null
        },
        "cost_type": "string",
        "estimated_delivery_final": {
            "date": "string"
        },
        "buffering": {
            "date": null
        },
        "pickup_promise": {
            "from": null,
            "to": null
        },
        "list_cost": 0,
        "estimated_delivery_limit": {
            "date": "string"
        },
        "priority_class": {
            "id": "string"
        },
        "delivery_promise": "string",
        "shipping_method": {
            "name": "string",
            "deliver_to": "string",
            "id": 511948,
            "type": "string"
        },
        "delivery_type": "string",
        "service_id": 22,
        "estimated_delivery_time": {
            "date": "string",
            "pay_before": "string",
            "schedule": null,
            "unit": "string",
            "offset": {
                "date": "string",
                "shipping": 0
            },
            "shipping": 0,
            "time_frame": {
                "from": null,
                "to": null
            },
            "handling": 0,
            "type": "string"
        },
        "option_id": 0,
        "estimated_delivery_extended": {
            "date": "string"
        },
        "currency_id": "string"
    },
    "tracking_number": "string",
    "id": 0,
    "tracking_method": "string",
    "quotation": null,
    "status": "string",
    "dimensions": {
        "height": 0,
        "width": 0,
        "length": 0,
        "weight": 0
    }
}
```

Nota:

Para la gestión de stock multi-origen, se incorporó el campo **node_id**  dentro del array origin.node que identifica el depósito correspondiente de este envío. Para saber cuál es el deposito, consulte el recurso [detalle de stock](https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen#Obtener-detalle-de-stock)

## Órdenes asociadas a un envio Nuevo

Con este recurso podés obtener todas las órdenes de las ventas asociadas a un envío. A partir del ID del shipment, retorna el listado de ordenes, sus cantidades y lDs del pack, order y seller correspondientes. Es útil para conocer y relacionar las órdenes desde el envio, y conformar la relación de las entidades partiendo de los shipments.

### Llamada

Nota:

En este nuevo recurso, es obligatorio enviar el header `X-New-Domain: true` en todas las llamadas.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'X-New-Domain:true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/orders
```

### Parametros

| **Parámetro** | **Tipo** | **Required** | **Descripción** |
| --- | --- | --- | --- |
| `shipment_id` | Long | Sí | ID del shipment |

### Respuesta (200 OK)

**Respuesta:**

```
[
  {
    "order_id": "2000014428837134",
    "pack_id": "2000015428123455",
    "item_id": "MLA2041819084",
    "variation_id": null,
    "user_product_id": "MLAU147563159",
    "seller_id": 12345,
    "requested_quantity": 1
  },
  {
    "order_id": "2000014428837136",
    "pack_id": "2000015428123455",
    "item_id": "MLA2041819099",
    "variation_id": 9876543210,
    "user_product_id": null,
    "seller_id": 12345,
    "requested_quantity": 2
  },
  {
    "order_id": "2000064328921180",
    "pack_id": "2000015428123533",
    "item_id": "MLA2055102030",
    "variation_id": null,
    "user_product_id": "MLAU2055102030",
    "seller_id": 12345,
    "requested_quantity": 1
  },
  {
    "order_id": "2000038294759239",
    "pack_id": "2000015428123948",
    "item_id": "MLA2066778899",
    "variation_id": 1122334455,
    "user_product_id": null,
    "seller_id": 6789,
    "requested_quantity": 5
  }
]
```

### Descripción de Campos

| **Campo** | **Tipo** | **Descripción** |
| --- | --- | --- |
| `order_id` | String | ID de la orden (dato inmutable) |
| `pack_id` | String | ID del pack (dato inmutable) |
| `item_id` | String | ID del item de la orden |
| `variation_id` | Long (nullable) | ID de la variación del item |
| `user_product_id` | String (nullable) | ID del user product |
| `seller_id` | Long | ID del seller de la orden |
| `requested_quantity` | Integer | # de unidades del item solicitadas en la compra |

### Status Codes

| **Code** | **Descripción** |
| --- | --- |
| 200 OK | Orders encontradas |
| 204 No Content | Shipment no tiene orders (caso raro) |
| 400 Bad Request | Parámetros inválidos |
| 401 Unauthorized | Autenticación fallida |
| 404 Not Found | Shipment no existe |
| 500 Internal Server Error | Error del servidor |
| 503 Service Unavailable | Servicio no disponible |

## Ítems asociados a un envío

El recurso /shipments/$SHIPMENT_ID/items devuelve los ítems asociados a un shipment. En caso de que el ítem contenga [variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones) (Por ejemplo: talle o color en indumentaria), también podrás ver cual corresponde a la orden dentro del envío. A medida que habilitemos envíos con más de un ítem, la lista pasará a contener cada uno de ellos.

Nota:

Cada vendedor sólo visualizará sus propios productos.

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/items

[
  {
    "item_id": "string",
    "description": "string",
    "quantity": 0,
    "variation_id": 0,
    "dimensions": {
      "height": 0,
      "width": 0,
      "length": 0,
      "weight": 0
    },
    "sender_id": 0
  }
]
```

## Costos del envío

El recurso /shipments/shipment_id/costs devuelve los costos del envío que deberá afrontar el usuario. También podrá visualizar el ahorro conseguido por el envío de más de un producto en la misma caja (cuando esté habilitada está funcionalidad), a través del parámetro "save", en caso de que exista.

Importante:

A partir de Octubre de 2024, el campo "save" dejará de ser actualizado y en todos los casos el campo recibirá el valor 0. 
 Posteriormente, a partir de Enero de 2025, el campo será eliminado del recurso.

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/costs
{
	"gross_amount": 24.55,
	"receiver": {
    	"user_id": 74425755,
    	"cost": 0,
    	"compensation": 0,
    	"save": 0,
    	"discounts": [
        	{
            	"rate": 1,
            	"type": "loyal",
            	"promoted_amount": 4.07
        	}
    		]
	},
	"senders": [
    	{
        	"user_id": 81387353,
        	"cost": 8.19,
        	"compensation": 0,
        	"save": 0,
        	"discounts": [
            	{
                	"rate": 0.6,
                	"type": "mandatory",
                	"promoted_amount": 12.29
            	}
        	]
    	}
	]
}
```

### Parámetros

**gross_amount** : Es el costo total del shipment sin ningún tipo de descuento. 
 **discounts** : representa una lista que puede venir vacía si no hay ningún descuento, y sino puede tener uno o más descuentos asociados. 
 **senders** : es una lista adaptada a versiones futuras de Carrito de Compras donde un solo envío podrá contener productos de diferentes vendedores. 
 **cost** : representa el costo final del envío que corresponde a cada usuario.

## Pagos de un envío

El recurso /shipments/shipment_id/payments devuelve los payments asociados al envío. Ten en cuenta que ahora el pago del envío estará discriminado.

Llamada:

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/payments
```

Ejemplo:

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/1111111111/payments
```

Respuesta:

```
	[
   {
       "payment_id": 1111111111,
       "user_id": 291760105,
       "amount": 17.7,
       "status": "approved"
   }
]
```

Nota:

- Recuerda verificar que el estado de pago esté como "aprobado" antes de continuar con el proceso de envío y obtener la información correspondiente a la entrega.

- Ten en cuenta que, para consultar la API de /shipments/$SHIPMENT_ID/payments, es necesario que el shipment_id esté asociado a un pack_id. Sin embargo, para utilizar la API de /shipments/$SHIPMENT_ID/costs, no es necesario cumplir con este requisito.

## Plazo máximo de despacho (SLA)

El recurso /shipments/$SHIPMENT_ID/sla devuelve la información asociada a la fecha y hora máximas de despacho de los paquetes, sea entregando a la red de Mercadolibre o haciendo el envío directo a los compradores. En caso de que el vendedor despache sus envíos posteriormente a esta fecha y hora definidos incurrirá en demoras con afectación en su reputación y destaques. Esto no solo afectará la exposición de sus publicaciones, sino que además generará una mala experiencia para nuestros compradores.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/sla
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/43416180080/sla
```

Respuesta:

```

{
    "status": "on_time",
     "service": "xd_same_day" | "instant_gm", 
    "expected_date": "2024-05-22T23:59:59-03:00",
    "last_updated": "2024-05-21T17:16:04Z"
}
```

Notas:

- Este horario puede actualizarse hasta el día anterior a la fecha de despacho. Validá el horario el mismo día del despacho.

- No consultes el SLA de envíos cancelados ni de logística Fulfillment, ya que no proveemos información para esos casos.

- Los envíos con el tag **proximity**  cuentan con el servicio de **instant_gm**  (Mercado Envíos ahora) y un SLA prioritario de envío ultra rápido. Por eso, se deben despachar con prioridad.

- Para los envíos con Mercado Colecta (cross docking), la fecha y hora máxima de despacho corresponde a la hora específica programada para la colecta. Entregá el paquete en ese horario.

### Parámetros de respuesta:

- **status:**  Indica el estado actual del envío. Puede tener valores como "on_time" (a tiempo), "delayed" (demorado), "early" (temprano), "insuficient_info" (caso raro en donde no se pudo calcular el SLA).

- **service:**  Identifica el tipo de servicio asociado al envio. Por ahora devuelve los valores de "xd_same_day" cuando sea un envio que corresponda a una colecta rápida y "instant_gm" para los envios de Mercado Envios Ahora que tienen que enviarse hasta 1 hora.

- **expected_date:**  Es la fecha y hora máximas para despachar el producto.

- **last_updated:**  Representa la última vez que se actualizó la información del envío.

### Códigos de estado de respuesta:

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se obtuvo correctamente la consulta. | - |
| 401 - Unauthorized | authorization value not present | Access token no encontrado. | Validar si el access_token. |
| 401 - Unauthorized | invalid access token | Access token no válido. | Validar si el access_token. |
| 404 - Not Found | failed to retrieve data | Shipment no encontrado. | Validar el shipment_id. |

Nota:

- El tiempo de despacho es el tiempo que el vendedor tiene que cumplir para despachar el paquete desde el momento en que recibió la compra de un producto. Es importante que cumpla este tiempo para que el paquete llegue a tiempo a la persona que hizo la compra.

- Se recomienda que en los procesos de preparación de envíos se pueda ordenar el listado a preparar a través de esta fecha de exigencia, de manera de poder priorizar los envios que tengan fecha de expiración más próxima. De esta manera incurrirá en menor cantidad de demoras, y esto le permitirá tener una mejor reputación.

Conoce más sobre el manejo de despacho:

- [Conocé que es la colecta rápida](https://developers.mercadolibre.com.ar/es_ar/envios-colectas-places#:~:text=Colecta%20r%C3%A1pida%20(xd_same_day)%3A)

- [Despachar a tiempo: la clave para una buena reputación](https://vendedores.mercadolibre.com.uy/nota/despachar-tus-ventas-a-tiempo-la-clave-de-una-buena-reputacion)

- [Qué es y cómo funciona la reputación](https://www.mercadolibre.com.ar/ayuda/Como-funciona-la-reputacion-de-vendedor_866)

- [Qué se tiene en cuenta para calcular la reputación](https://www.mercadolibre.com.ar/ayuda/variables-reputacion_30193)

- [Cuánto tiempo tienes para despachar tus ventas](https://vendedores.mercadolibre.com.uy/nota/cuanto-tiempo-tienes-para-despachar-tus-ventas?moduleKeyId=MO55&guideKeyId=GE9)

- [Cómo tener el destaque "Llega mañana" en tus publicaciones](https://vendedores.mercadolibre.com.uy/nota/como-tener-el-destaque-llega-manana-en-tus-publicaciones?moduleKeyId=MO54&guideKeyId=GE9)

- [Cómo enviar tus ventas usando las agencias de Mercado Libre.](https://vendedores.mercadolibre.com.uy/nota/como-enviar-tus-ventas-usando-las-agencias-de-mercado-libre?moduleKeyId=MO54&guideKeyId=GE9)

## Conocer envíos con retraso

Los vendedores deben despachar sus paquetes en horarios específicos para no afectar tu reputación. Utiliza los links en tu herramienta para que tus vendedores tengan acceso a esa información (Argentina, Brasil, México, Chile, Uruguai y Colombia).

Llamada:

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/delays
```

Ejemplo:

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/30143583389/delays
```

Respuesta:

```
	{
	"shipment_id": 30143583389,
	"delays": [{
		"type": "handling_delayed",
		"date": "2020-09-23T09:07:20Z",
		"source": "shipping-delays"
	}]
}
```

Notas:

- El **type sla_delayed**  indica que superó el tiempo esperado de despacho definido por el SLA. 
- Cuando el envío no tiene retraso, recibirás error 404: "Delays Not Found for shipment".

## Plazos de entrega

El recurso /shipments/$SHIPMENT_ID/lead_time devuelve todo lo referente a los plazos de entrega de un envío y tipo de servicio, sumando las fechas límites de despacho y entrega. Si bien el recurso base de shipment ya trae información útil para hacer estas estimaciones, acá podrás visualizarlo de manera más detallada, lo cual ayudará a dar una mejor experiencia para el usuario.

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/lead_time
{
  "option_id": 0,
  "shipping_method": {
    "id": 0,
    "type": "standard",
    "name": "string",
    "deliver_to": "address"
  },
  "currency_id": "string",
  "cost": 0,
  "cost_type": "charged",
  "service_id": 0,
  "estimated_delivery_time": {
    "type": "known",
    "date": "string",
    "shipping": 0,
    "handling": 0,
    "unit": "string",
    "offset": {
      "date": "string",
      "shipping": 0
    },
    "time_frame": {
      "from": 0,
      "to": 0
    },
    "pay_before": "string"
  }, 
  "estimated_delivery_extended": {
    "date":  "2016-12-30T12:32:35.000Z"
  },
  "estimated_delivery_limit": {
    "date":  "2016-12-30T12:32:35.000Z"
  },
  "estimated_delivery_final": {
    "date":  "2016-12-30T12:32:35.000Z"
  },
  "delay": [
    "shipping_delayed",
  ]
}
```

El campo cost_type puede ser "free", "charged" o "partially_free".

## Campos de respuesta (tiempos estimados)

Importante:

A partir del 13 Mayo de 2025 se depreca el campo "estimated_handling_limit" y la información sólo podrá ser consumida en el recurso de **SLA.**

- **estimated_handling_limit:**  fecha tentativa de despacho del vendedor. Este valor es solo una estimación y puede variar. Para conocer el tiempo de despacho comprometido, se debe considerar el SLA correspondiente. Más detalles en el [tópico correspondiente](https://developers.mercadolibre.com.ar/es_ar/envios?nocache=true#Plazo-m%C3%A1ximo-de-despacho-(SLA)).

- **estimated_delivery_extended:**  segunda promesa de entrega, en caso de que la original no se cumpla.   **estimated_delivery_limit:**  fecha límite para que el comprador puede cancelar la compra y pedir la devolución de dinero, siempre y cuando todavía no haya llegado el envío.

- **estimated_delivery_final:**  fecha final como plazo para que llegue el envío y se determine el status final que puede ser delivered o, en caso de haber entrado un reclamo, not_delivered. Ver más información sobre [los costos de envío y handling time](https://developers.mercadolibre.com.ar/es_ar/costos-de-envio-y-handling-time).

## Consultar historial (status y substatus) del envío

Ejemplo:

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/1234567899/history
[
   {
      "status":"ready_to_ship",
      "substatus":"printed",
      "date":"2016-12-30T12:32:35.000Z"
   },
   {
      "status":"handling",
      "substatus":"waiting_for_label_generation",
      "date":"2016-12-30T12:32:35.000Z"
   }
]
```

Nota:

Ventas donde el pago falló, pueden tener el medio de envío original cambiado, ya que hay una recompra. Para casos donde la compra original tenia un envío asociado, y la recompra un "to be agree", el status del envío si quedará status: "cancelled", y substatus: "closed_by_user", y la venta necesita ser cancelada

## Status y substatus Front vs. API

Ten en cuenta que los substatus pueden cambiar en base a los tipos logísticos.

### Tracking para Cross Docking

| Front | Descripción | API - "status_history" |
| --- | --- | --- |
| **"En preparación"** | "Estamos preparando el paquete" | status: handling |
|  |  |  |
| **"En camino"** | "El vendedor despachó ty paquete" | status: ready_to_ship  substatus: picked_up, authorized_by_carrier |
|  |  |  |
|  | "Ingresó al centro de distribución de ....." | status: ready_to_ship  substatus: in_hub |
| **"Entregado"** | "Entregamos el paquete" | status: delivered |

### Tracking para Fulfillment

| Front | Descripción | API - "status_history" |
| --- | --- | --- |
| **"En preparación"** | "Estamos preparando el paquete" | status: handling |
|  |  |  |
| **"En camino"** | "El paquete salió del centro de distribuición" | status: shipped |
| **"Entregado"** | "Entregamos el paquete" | status: delivered |

## Consultar información del transporte (carrier)

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/carrier
```

Ejemplo:

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/27691621451/carrier
{
   "url":"http://tracking.totalexpress.com.br/poupup_track.php?reid=3&pedido=14&nfiscal=1", 
   "name":"Total Express"
}
```

## Información sobre estados y subestados de un envío

Llamada:

```
	curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' https://api.mercadolibre.com/shipment_statuses
```

Respuesta:

```
	[
    {
        "id": "to_be_agreed",
        "name": "To be agreed",
        "substatuses": []
    },
    {
        "id": "pending",
        "name": "Pending",
        "substatuses": [
            {
                "id": "cost_exceeded",
                "name": "Cost exceeded"
            },
            {
                "id": "under_review",
                "name": "Under review (e.g. fraud)"
            },
            {
                "id": "reviewed",
                "name": "Reviewed"
            },
            {
                "id": "fraudulent",
                "name": "fraudulent"
            },
            {
                "id": "waiting_for_payment",
                "name": "Waiting for shipping payment to be accredited"
            },
            {
                "id": "shipment_paid",
                "name": "Shipping cost has been paid"
            },
            {
                "id": "creating_route",
                "name": "Route has been created"
            },
            {
                "id": "manufacturing",
                "name": "Manufacturing"
            },
            {
                "id": "buffered",
                "name": "Buffered"
            },
            {
                "id": "creating_shipping_order",
                "name": "Creating shipping order"
            }
        ]
    },
    {
        "id": "handling",
        "name": "Handling",
        "substatuses": [
            {
                "id": "regenerating",
                "name": "Regenerating"
            },
            {
                "id": "waiting_for_label_generation",
                "name": "Waiting for label generation"
            },
            {
                "id": "invoice_pending",
                "name": "Invoice pending"
            },
            {
                "id": "waiting_for_return_confirmation",
                "name": "Waiting for return confirmation"
            },
            {
                "id": "return_confirmed",
                "name": "Return Confirmed"
            },
            {
                "id": "manufacturing",
                "name": "Manufacturing"
            },
            {
                "id": "agency_unavailable",
                "name": "Agency unavailable"
            }
        ]
    },
    {
        "id": "ready_to_ship",
        "name": "Ready to ship",
        "substatuses": [
            {
                "id": "ready_to_print",
                "name": "Ready to print"
            },
            {
                "id": "invoice_pending",
                "name": "Invoice pending"
            },
            {
                "id": "printed",
                "name": "Printed"
            },
            {
                "id": "in_pickup_list",
                "name": "In pikcup list"
            },
            {
                "id": "ready_for_pkl_creation",
                "name": "Ready for pkl creation"
            },
            {
                "id": "ready_for_pickup",
                "name": "Ready for pickup"
            },
            {
                "id": "ready_for_dropoff",
                "name": "Ready for drop off"
            },
            {
                "id": "picked_up",
                "name": "Picked up"
            },
            {
                "id": "stale",
                "name": "Stale Ready To Ship"
            },
            {
                "id": "dropped_off",
                "name": "Dropped off in Melipoint"
            },
            {
                "id": "delayed",
                "name": "Delayed"
            },
            {
                "id": "claimed_me",
                "name": "Stale shipment claimed by buyer"
            },
            {
                "id": "waiting_for_last_mile_authorization",
                "name": "Waiting for last mile authorization"
            },
            {
                "id": "rejected_in_hub",
                "name": "Rejected in hub"
            },
            {
                "id": "in_transit",
                "name": "In transit"
            },
            {
                "id": "in_warehouse",
                "name": "In Warehouse"
            },
            {
                "id": "ready_to_pack",
                "name": "Ready to Pack"
            },
            {
                "id": "in_hub",
                "name": "In hub"
            },
            {
                "id": "measures_ready",
                "name": "Measures and weight ready"
            },
            {
                "id": "waiting_for_carrier_authorization",
                "name": "Waiting for carrier authorization"
            },
            {
                "id": "authorized_by_carrier",
                "name": "Authorized by carrier MELI"
            },
            {
                "id": "in_packing_list",
                "name": "In packing list"
            },
            {
                "id": "in_plp",
                "name": "In PLP"
            },
            {
                "id": "on_hold",
                "name": "On hold"
            },
            {
                "id": "packed",
                "name": "Packed"
            },
            {
                "id": "on_route_to_pickup",
                "name": "On route to pickup"
            },
            {
                "id": "picking_up",
                "name": "Picking up"
            },
            {
                "id": "shipping_order_initialized",
                "name": "Shipping order initialized"
            },
            {
                "id": "looking_for_driver",
                "name": "looking for driver"
            }
        ]
    },
    {
        "id": "shipped",
        "name": "Shipped",
        "substatuses": [
            {
                "id": "delayed",
                "name": "Delayed"
            },
            {
                "id": "waiting_for_withdrawal",
                "name": "Waiting for withdrawal"
            },
            {
                "id": "contact_with_carrier_required",
                "name": "Contact with carrier required"
            },
            {
                "id": "receiver_absent",
                "name": "Receiver absent"
            },
            {
                "id": "reclaimed",
                "name": "Reclaimed"
            },
            {
                "id": "not_localized",
                "name": "Not localized"
            },
            {
                "id": "forwarded_to_third",
                "name": "Forwarded to third party"
            },
            {
                "id": "soon_deliver",
                "name": "Soon deliver"
            },
            {
                "id": "refused_delivery",
                "name": "Delivery refused"
            },
            {
                "id": "bad_address",
                "name": "Bad address"
            },
            {
                "id": "changed_address",
                "name": "Changed address"
            },
            {
                "id": "negative_feedback",
                "name": "Stale shipped with negative feedback by buyer"
            },
            {
                "id": "need_review",
                "name": "Need to review carrier status to understand what happened"
            },
            {
                "id": "stale",
                "name": "Stale shipped"
            },
            {
                "id": "operator_intervention",
                "name": "Need operator intervention"
            },
            {
                "id": "claimed_me",
                "name": "Stale shipped that was claimed by the receiver"
            },
            {
                "id": "retained",
                "name": "Retained when package is on going"
            },
            {
                "id": "out_for_delivery",
                "name": "Package is out for delivery"
            },
            {
                "id": "delivery_failed",
                "name": "Delivery failed"
            },
            {
                "id": "waiting_for_confirmation",
                "name": "waiting for confirmation"
            },
            {
                "id": "at_the_door",
                "name": "Shipment at buyers door"
            },
            {
                "id": "buyer_edt_limit_stale",
                "name": "Buyer edt limit stale"
            },
            {
                "id": "delivery_blocked",
                "name": "Delivery blocked"
            },
            {
                "id": "awaiting_tax_documentation",
                "name": "Awaiting tax documentation"
            },
            {
                "id": "dangerous_area",
                "name": "Dangerous area"
            },
            {
                "id": "buyer_rescheduled",
                "name": "Buyer rescheduled"
            },
            {
                "id": "failover",
                "name": "Failover"
            },
            {
                "id": "picked_up",
                "name": "Picked up"
            },
            {
                "id": "dropped_off",
                "name": "Dropped off"
            },
            {
                "id": "at_customs",
                "name": "At customs"
            },
            {
                "id": "delayed_at_customs",
                "name": "Delayed at customs"
            },
            {
                "id": "left_customs",
                "name": "Left customs"
            },
            {
                "id": "missing_sender_payment",
                "name": "Missing sender payment"
            },
            {
                "id": "missing_sender_documentation",
                "name": "Missing sender documentation"
            },
            {
                "id": "missing_recipient_documentation",
                "name": "Missing recipient documentation"
            },
            {
                "id": "missing_recipient_payment",
                "name": "Missing recipient payment"
            },
            {
                "id": "import_taxes_paid",
                "name": "Import taxes paid"
            }
        ]
    },
    {
        "id": "delivered",
        "name": "Delivered",
        "substatuses": [
            {
                "id": "damaged",
                "name": "damaged"
            },
            {
                "id": "fulfilled_feedback",
                "name": "Fulfilled by buyer feedback"
            },
            {
                "id": "no_action_taken",
                "name": "No action taken by buyer"
            },
            {
                "id": "double_refund",
                "name": "Double Refund"
            },
            {
                "id": "inferred",
                "name": "Inferred Delivery"
            }
        ]
    },
    {
        "id": "not_delivered",
        "name": "Not delivered",
        "substatuses": [
            {
                "id": "returning_to_sender",
                "name": "Returning to sender"
            },
            {
                "id": "receiver_absent",
                "name": "Receiver absent"
            },
            {
                "id": "to_review",
                "name": "Closed shipment"
            },
            {
                "id": "destroyed",
                "name": "Destroyed"
            },
            {
                "id": "waiting_for_withdrawal",
                "name": "Waiting for withdrawal"
            },
            {
                "id": "negative_feedback",
                "name": "Stale shipped forced to not delivered due to negative feedback by buyer"
            },
            {
                "id": "not_localized",
                "name": "Not localized"
            },
            {
                "id": "double_refund",
                "name": "Double Refund"
            },
            {
                "id": "cancelled_measurement_exceeded",
                "name": "Shipment cancelled for measurement exceeded"
            },
            {
                "id": "returned_to_hub",
                "name": "Returned to hub"
            },
            {
                "id": "returned_to_agency",
                "name": "Returned to agency"
            },
            {
                "id": "picked_up_for_return",
                "name": "Picked up for return"
            },
            {
                "id": "claimed_me",
                "name": "Not delivered that was claimed by the receiver"
            },
            {
                "id": "returning_to_warehouse",
                "name": "Returning to Warehouse"
            },
            {
                "id": "returning_to_hub",
                "name": "Returning to Hub"
            },
            {
                "id": "soon_to_be_returned",
                "name": "Soon to be returned"
            },
            {
                "id": "return_failed",
                "name": "Return failed"
            },
            {
                "id": "in_storage",
                "name": "In storage"
            },
            {
                "id": "pending_recovery",
                "name": "Pending recovery"
            },
            {
                "id": "agency_unavailable",
                "name": "Agency unavailable"
            },
            {
                "id": "rejected_damaged",
                "name": "Rejected damaged"
            },
            {
                "id": "refused_delivery",
                "name": "Refused delivery"
            },
            {
                "id": "refunded_by_delay",
                "name": "Refunded by delay"
            },
            {
                "id": "delayed",
                "name": "Delayed"
            },
            {
                "id": "delayed_to_hub",
                "name": "Delayed to hub"
            },
            {
                "id": "shipment_stopped",
                "name": "Shipment stopped"
            },
            {
                "id": "awaiting_tax_documentation",
                "name": "Awaiting tax documentation"
            },
            {
                "id": "retained",
                "name": "Retained"
            },
            {
                "id": "stolen",
                "name": "Stolen"
            },
            {
                "id": "returned",
                "name": "Returned"
            },
            {
                "id": "confiscated",
                "name": "confiscated"
            },
            {
                "id": "damaged",
                "name": "Package damaged in hub"
            },
            {
                "id": "lost",
                "name": "Package lost"
            },
            {
                "id": "recovered",
                "name": "Recovered"
            },
            {
                "id": "returned_to_warehouse",
                "name": "Returned to Warehouse"
            },
            {
                "id": "not_recovered",
                "name": "Not recovered"
            },
            {
                "id": "detained_at_customs",
                "name": "Detained at customs"
            },
            {
                "id": "detained_at_origin",
                "name": "Detained at origin"
            },
            {
                "id": "unclaimed",
                "name": "Unclaimed by seller"
            },
            {
                "id": "import_tax_rejected",
                "name": "Import tax rejected"
            },
            {
                "id": "import_tax_expired",
                "name": "Import tax expired"
            },
            {
                "id": "rider_not_found",
                "name": "Rider not found"
            }
        ]
    },
    {
        "id": "not_verified",
        "name": "Not verified",
        "substatuses": []
    },
    {
        "id": "cancelled",
        "name": "Cancelled",
        "substatuses": [
            {
                "id": "recovered",
                "name": "Recovered"
            },
            {
                "id": "label_expired",
                "name": "Label Expired"
            },
            {
                "id": "cancelled_manually",
                "name": "Cancelled Manually"
            },
            {
                "id": "fraudulent",
                "name": "Cancelled Fraudulent"
            },
            {
                "id": "return_expired",
                "name": "Return expired"
            },
            {
                "id": "return_session_expired",
                "name": "Return session expired"
            },
            {
                "id": "unfulfillable",
                "name": "Unfulfillable"
            },
            {
                "id": "closed_by_user",
                "name": "User changes the type of shipping and cancels the previous"
            },
            {
                "id": "pack_splitted",
                "name": "The pack was split by the cart splitter so the shipment gets cancelled"
            },
            {
                "id": "shipped_outside_me",
                "name": "Shipped outside me"
            },
            {
                "id": "shipped_outside_me_trusted",
                "name": "Shipped outside me by trusted seller"
            },
            {
                "id": "inferred_shipped",
                "name": "Inferred shipped"
            },
            {
                "id": "service_unavailable",
                "name": "Service unavailable"
            },
            {
                "id": "dismissed",
                "name": "Dismissed"
            },
            {
                "id": "time_expired",
                "name": "Time expired"
            },
            {
                "id": "pack_partially_cancelled",
                "name": "Pack partially cancelled"
            },
            {
                "id": "rejected_manually",
                "name": "Rejected manually"
            },
            {
                "id": "closed_store",
                "name": "Closed store"
            },
            {
                "id": "out_of_range",
                "name": "Out of range"
            }
        ]
    },
    {
        "id": "closed",
        "name": "Closed",
        "substatuses": []
    },
    {
        "id": "error",
        "name": "Error",
        "substatuses": []
    },
    {
        "id": "active",
        "name": "Active",
        "substatuses": []
    },
    {
        "id": "not_specified",
        "name": "Not specified",
        "substatuses": []
    },
    {
        "id": "stale_ready_to_ship",
        "name": "Stale ready to ship",
        "substatuses": []
    },
    {
        "id": "stale_shipped",
        "name": "Stale shipped",
        "substatuses": []
    }
]
```

## Crear paquetes de envío adicionales (Split de envíos)

Importante:

Este recurso no aplica para Envíos Flex ni Full.

En caso que tengas un inconveniente al momento de agrupar diferentes productos en un mismo paquete (ya sea porque están en distintos depósitos, son frágiles, no entran en una misma caja, etc.) puedes utilizar el recurso que te permite generar paquetes adicionales para poder despachar todos los productos.

### Consideraciones

No puede sobrar ni faltar ningún ítem en el body. En la sumatoria global de todos los subpacks deben figurar todas las órdenes y la cantidad total de ítems de cada una.

El atributo **package_id**  es **opcional**  está pensado a modo de etiqueta para identificar el subpack resultante con su futuro shipment. La condición debe ser 1 de estos 2:

- Todos los subpacks lleven un package_id único dentro del body.  Ninguno de los subpacks lleve un package_id. Lo anterior implica que puede no usarse, pero si se provee un package_id en algún subpack, todos deben llevar un package_id y además debe cumplirse que sean todos distintos para poder identificarlos.

- El **envío**  debe poseer una orden de cantidad mayor a 2 o tener más de una orden.

- El **order_id**  representa a la orden que contiene el producto que debe ser apartado del paquete original.

- Se creará un **nuevo shipment**  con la orden correspondiente al order_id apartado y disparará las notificaciones correspondientes.

- El mismo shipment **únicamente**  se puede dividir en dos cajas por vez y además, no se puede dividir múltiples veces.

### Valores posibles en el campo "reason"

**FRAGILE** : productos frágiles. 
 **ANOTHER_WAREHOUSE** : otro centro de distribución. 
 **IRREGULAR_SHAPE** : forma irregulares. 
 **OTHER_MOTIVE** : otro motivo. 
 **DIMENSIONS_EXCEEDED** : dimensiones excedidas.

Llamada:

```
	curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'x-format-new: true' -H 'x-format-new: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/split 
```

```
	{
	"reason": "DIMENSIONS_EXCEEDED",
	"packs": [{
			"package_id": 1, --- OPTIONAL FIELD ---
			"orders": [{
				"id": 20000001,
				"quantity": 2
			}]
		},
		{
			"package_id": 2, --- OPTIONAL FIELD ---
			"orders": [{
					"id": 20000002,
					"quantity": 1
				},
				{
					"id": 20000003,
					"quantity": 1
				}

			]
		}
	]
}
```

### Respuesta

La respuesta con éxito será solo un "200 - OK" con retorno vacío.

```
	{}
```

### Consideraciones post-Split

Como el recurso no devuelve los nuevos pedidos creados, se debe consultar a través de las [notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones) de pedidos o envíos, correspondientes al split.

Con esto, verá impactado en:

- Pack: El estado del pack de este pedido cambiará a **"status": "cancelled"**  y **"status_detail": "splitted"**

- Order: El pedido también quedará con el **"status": "cancelled"**  y en **"cancel_detail":**  tendrá la descripción **"code": "pack_splitted"**

- Shipments: El envío tendrá **"status": "cancelled"**  y **"substatus": "pack_splitted"**

- Por último, como forma de identificar que el nuevo pedido está relacionado con el anterior que sufrió el split, en el envío tendrá el campo **sibling_id**  con el número del envío cancelado, además del **Reason**  con el motivo del split.

Conoce más sobre [Modos de Envíos](https://developers.mercadolibre.com.ar/es_ar/mercado-envios), [Gestionar órdenes de Carrito](https://developers.mercadolibre.com.ar/es_ar/gestion-packs).

**Siguiente** : [Gestionar pagos](https://developers.mercadolibre.com.ar/es_ar/pagos).
