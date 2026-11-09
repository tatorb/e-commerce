<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/costos-de-envios -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Costos de envío

Última actualización 13/02/2026

## Costos de envío

**Importante:**

- Actualmente, todas las funcionalidades descritas en la presente documentación, están disponibles para los sites MLB, MLA, MLM, MLC, MCO, MPE, MLU y MEC.
 - Asimismo, todas las funcionalidades descritas son aplicables a todos los tipos de logística de ME2.

La gestión de costos de envíos implica dos aspectos muy relevantes: el primero ocurre al momento de publicar o editar un artículo, mientras que el segundo ocurre al momento de la compra.

Para la primera fase, es decir, al momento de publicar o editar un artículo, son necesarios los siguientes endpoints:

## Consultar productos con envíos gratis

El primer endpoint proporciona la información necesaria para verificar si el vendedor ofrece envío gratuito en su publicación.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1122334488
```

Respuesta con free shipping optional:

```

"shipping": {
    "mode": "me2",
    "methods": [],
    "tags": [
        "self_service_in"
    ],
    "dimensions": null,
    "local_pick_up": false,
    "free_shipping": true,
    "logistic_type": "cross_docking",
    "store_pick_up": false
}
```

Recuerda que si la etiqueta "mandatory_free_shipping" no está presente, se puede enviar el atributo "free_shipping" como true o false. Esto se debe a que el vendedor puede optar por ofrecer o no envíos gratuitos de forma opcional.

Respuesta con free shipping mandatory:

```

"shipping": {
    "mode": "me2",
    "methods": [],
    "tags": [
        "mandatory_free_shipping"
    ],
    "dimensions": null,
    "local_pick_up": true,
    "free_shipping": true,
    "logistic_type": "xd_drop_off",
    "store_pick_up": false
}
```

- El tag “mandatory_free_shipping” se aplica exclusivamente a envíos realizados a través de Mercado Envíos 2 (ME2).

- En caso de que el parámetro "mandatory_free_shipping" esté presente, el requisito es obligatorio. Es crucial adherirse a este parámetro cuando el endpoint lo proporciona.

- Para Envíos Turbo, la opción de "mandatory_free_shipping" no estará disponible. En su lugar, Mercado Libre ofrecerá un descuento según corresponda.

Respuesta con free shipping fuera de me2:

```

"shipping": {
    "mode": "not_specified",
    "methods": [],
    "tags": [],
    "dimensions": null,
    "local_pick_up": true,
    "free_shipping": true,
    "logistic_type": "not_specified",
    "store_pick_up": false
}
```

En modalidades de envío que no corresponden a ME2, los vendedores tienen la libertad de establecer el costo de envío según sus preferencias.

### Parámetros de respuesta:

- **shipping.mode:**  Modalidad de envío configurado para el ítem.

- **shipping.tags:**  Etiquetas de envío del ítem.

- Si indica **"mandatory_free_shipping"**  es porque el ítem superó el límite de precio establecido por Mercado Libre. Para estos productos, el envío gratuito es una obligación. Los vendedores deben ofrecer envíos gratis o importantes descuentos en el envío.

- En cambio, para productos con un precio por debajo de ese límite de precio, el envío gratuito es opcional.

- **shipping.dimensions:**  Dimensiones del producto, en el formato: altura x ancho x largo, peso.

- **shipping.local_pick_up:**  Indicador booleano que muestra si está disponible la opción de retiro en persona.

- **shipping.free_shipping:**  Indicador booleano que muestra si el envío es gratuito.

- **shipping.logistic_type:**  Tipo de logística del envío.

- **shipping.store_pick_up:**  Indicador booleano que muestra si está disponible la opción de recogida en tienda.

Para obtener una visión más detallada sobre el límite de precios para envíos gratis, te invitamos a consultar las siguientes páginas:

- [Costos por ofrecer envíos gratis en Brasil](https://www.mercadolivre.com.br/landing/custos-de-venda)

- [Costos por ofrecer envíos gratis en Argentina](https://www.mercadolibre.com.ar/landing/costos-de-venta)

- [Costos por ofrecer envíos gratis en México](https://www.mercadolibre.com.mx/landing/costos-de-venta)

- [Costos por ofrecer envíos gratis en Chile](https://www.mercadolibre.cl/landing/costos-de-venta)

- [Costos por ofrecer envíos gratis en Colombia](https://www.mercadolibre.com.co/landing/costos-de-venta)

- [Costos por ofrecer envíos gratis en Perú](https://www.mercadolibre.com.pe/landing/costos-de-venta)

- [Costos por ofrecer envíos gratis en Uruguay](https://www.mercadolibre.com.uy/landing/costos-de-venta)

- [Costos por ofrecer envíos gratis en Ecuador](https://www.mercadolibre.com.ec/landing/costos-de-venta)

**Importante:**

Asegúrate de comprender los requisitos y las políticas de MELI relacionadas con el envío gratuito para poder implementar esta funcionalidad de manera efectiva en tu plataforma de venta.

## Consultar costos de envíos de un ítem

Este endpoint permite conocer el precio aproximado que el vendedor pagará por el envío de un determinado ítem. Se puede utilizar también para simular costos de envíos al momento de publicar o editar un ítem.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/shipping_options/free?dimensions=$DIMENSIONES&verbose=$VERBOSE&item_price=$ITEM_PRICE&listing_type_id=$LISTING_TYPE&mode=$MODE&condition=$CONDITION&logistic_type=$LOGISTIC_TYPE&free_shipping=$FREE_SHIPPING
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/244878077/shipping_options/free?dimensions=9x17x22,462&verbose=true&item_price=300&listing_type_id=gold_pro&mode=me2&condition=new&logistic_type=drop_off&free_shipping=True
```

### Parámetros de consulta aceptables:

| Nombre | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- |
| **item_id** | string | ID del ítem. | MLB23332 |
| **dimensions** | string | Dimensiones del ítem (altura x ancho x largo, peso). | 60x364x63,661 |
| **item_price** | number | Precio unitario del ítem. | 123 |
| **verbose** | bool | El verbose determina si el descuento para el envío se incluye o no en la respuesta. | TRUE |
| **condition** | string | Condición del ítem, puede ser usado o nuevo. | new |
| **currency_id** | string | Tipo de moneda ofrecido para el ítem. | ARS |
| **category_id** | string | Categoría del ítem. | MLB23332 |
| **listing_type_id** | string | Nivel de publicación del ítem, determina nivel de exposición y determinados beneficios. | gold_special |
| **variation_id** | number | Variación del ítem. | 123213 |
| **seller_status** | string | Indica el nivel de las tiendas Líderes (Platinum, Gold, Silver). | gold |
| **seller_type** | string | Indica si se trata de una tienda oficial o no. | normal |
| **reputation** | string | Indica la reputación del vendedor (red, Orange, Yellow, Light_green, Green). | green |
| **mode** | string | Modo de envío (me2, me1, custom y not specified). | me2 |
| **logistic_type** | string | Tipo de logística:  CrossDocking = “cross_docking”  DropShipping = “drop_off”  Fulfillment = “fulfillment”  XdDropOff = “xd_drop_off”  Flex = “self_service” | self_service |
| **tags** | string | Etiquetas de información general del ítem. Permite determinar si el ítem tiene Flex como logística. | self_service |
| **state_id** | string | ID del estado desde donde se origina el envío. | BRL |
| **city_id** | string | Ciudad desde donde se origina el envío. | TUxDQ1BVRWRiYjBh |
| **zip_code** | number | El zip code de origen del envío. | 35519000 |
| **free_shipping** | bolean | Indica si el vendedor desea ofrecer envio gratis o no. | True \| False |

Nota:

- Ten en cuenta que este endpoint proporciona una estimación aproximada del monto, basado en los parámetros al momento de la consulta y considerando únicamente la cantidad de un solo artículo.

- Dentro de todos los parámetros de consulta para utilizar este endpoint, es importante destacar que los obligatorios son ITEM_ID o DIMENSIONS. Esto significa que al hacer uso de este recurso, es esencial proporcionar al menos uno de estos dos parámetros en la solicitud.

- Recuerda que para utilizar el ITEM_ID, este debe haber sido creado previamente y encontrarse activo.

- Deben enviar el nuevo parámetro de “free_shipping” para tener la respuesta correcta del costo; Con valor True cuando se desea otorgar envío gratis para el comprador y valor False cuando el envío queda a carga del comprador. Eso implica hacer la validación de las 2 formas para tener las dos opciones de costos correctas y posibles para el vendedor.

Respuesta:

```

{
    "coverage": {
        "all_country": {
            "list_cost": 8106.49,
            "currency_id": "ARS",
            "billable_weight": 5828
        }
    }
}
```

### Parámetros de respuesta:

- **coverage** : Representa la cobertura de envío y contiene información sobre los costos y la moneda utilizada para el envío.

- **coverage.all_country** : Dentro de "coverage", "all_country" especifica que la información se aplica a envíos a todo el país.

- **coverage.all_country.list_cost** : Costo de envío ofrecido al vendedor.

- **coverage.all_country.currency_id** : Moneda utilizada para el costo de envío.

- **coverage.all_country.billable_weight** : Peso facturable del envío.

- **coverage.discount** : Información sobre descuentos aplicados al envío.

- **coverage.discount.rate** : Tasa de descuento aplicada.

- **coverage.discount.type** : Describe el tipo de descuento.

- **coverage.discount.promoted_amount** : Monto o valor base sobre el cual se aplicará un cierto porcentaje de descuento. Por ejemplo, si tenemos un costo de envío de $200 y se aplica un descuento del 40%, en la respuesta final obtendríamos: list_cost = 120, rate: 0.4 y promoted_amount = 200.

### Códigos de estado de respuesta:

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se obtuvo correctamente la consulta. | - |
| 400 - Bad Request | seller_id must have a value! | No existe el usuario. | Validar el valor del seller_id. |
| 404 - Not Found | Item with id {itemID} not found | Ítem no encontrado. | Validar el valor del item_id. |

Nota:

- Es importante destacar que el array 'discount' solo estará presente en la respuesta si se ofrece algún descuento. En caso contrario, este array no estará incluido en la respuesta.

- Este endpoint tiene un propósito específico y está diseñado para operar únicamente con artículos que se encuentran disponibles en el Marketplace de nuestra plataforma.

Para la segunda fase o el proceso de compra de un artículo, debes utilizar los siguientes endpoints:

## Consultar costos de envíos al comprar un artículo

Este endpoint proporciona una vista detallada de las opciones de envío disponibles junto con sus costos al momento de la compra de un artículo, adaptándose al destino del comprador.

Nota:

**ME1:**  Para publicaciones de [ME1](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-1), el costo de envío devuelto en esta llamada será el valor de la tabla de costos de envío cargada como [contingencia para la integración de flete dinámico](https://developers.mercadolibre.com.ar/es_ar/flete-dinamico#Contingencia-Mercado-Libre), y no el valor de la integración de cotización al integrador, para evitar múltiples requisiciones a la integración con otros partners.

Llamada por Código Postal:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/shipping_options?zip_code=$ZIP_CODE
```

Ejemplo por Código Postal:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1398714241/shipping_options?zip_code=1675
```

Llamada por Ciudad:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/shipping_options?city_to=$CITY_TO
```

Ejemplo por Ciudad:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1398714241/shipping_options?city_to=Q08tRENCb2dvdA
```

Respuesta:

```

{
  "destination": {
    "zip_code": "1675",
    "city": {
      "id": null,
      "name": null
    },
    "state": {
      "id": "AR-B",
      "name": "Buenos Aires"
    },
    "country": {
      "id": "AR",
      "name": "Argentina"
    }
  },
  "buyer": {
    "id": 0,
    "loyalty_level": 1,
    "shipping_level": "1"
  },
  "options": [
    {
      "id": 3048556710,
      "option_hash": "708dd0837f1b1b6468c85d7079091889",
      "name": "Prioritario a domicilio",
      "currency_id": "ARS",
      "base_cost": 6023.99,
      "cost": 6023.99,
      "list_cost": 6023.99,
      "display": "recommended",
      "shipping_method_id": 510445,
      "shipping_method_type": "next_day",
      "shipping_option_type": "address",
      "estimated_delivery_time": {
        "type": "known",
        "date": "2024-04-20T00:00:00-03:00",
        "unit": "hour",
        "offset": {
          "date": null,
          "shipping": null
        },
        "time_frame": {
          "from": null,
          "to": null
        },
        "pay_before": "2024-04-20T14:00:00-03:00",
        "shipping": 0,
        "handling": 0,
        "schedule": null
      },
      "discount": {
        "promoted_amount": 0,
        "rate": 0,
        "type": "none",
        "show_loyal_benefit": false
      }
    },
    {
      "id": 1638980834,
      "option_hash": "0f1d5344a6cded1656403bfb6b4dbf50",
      "name": "Estándar a domicilio",
      "currency_id": "ARS",
      "base_cost": 6023.99,
      "cost": 6023.99,
      "list_cost": 6023.99,
      "display": "always",
      "shipping_method_id": 510645,
      "shipping_method_type": "three_days",
      "shipping_option_type": "address",
      "estimated_delivery_time": {
        "type": "known",
        "date": "2024-04-22T00:00:00-03:00",
        "unit": "hour",
        "offset": {
          "date": null,
          "shipping": null
        },
        "time_frame": {
          "from": null,
          "to": null
        },
        "pay_before": "2024-04-22T16:00:00-03:00",
        "shipping": 0,
        "handling": 0,
        "schedule           ": null
    },
    "discount": {
      "promoted_amount": 0,
      "rate": 0,
      "type": "none",
      "show_loyal_benefit": false
    }
  },
  {
    "id": 336095950,
    "option_hash": "027577b20d617392425136c0528cfb74",
    "name": "Estándar a sucursal de correo",
    "currency_id": "ARS",
    "base_cost": 10051.99,
    "cost": 10051.99,
    "list_cost": 10051.99,
    "display": "always",
    "shipping_method_id": 504345,
    "shipping_method_type": "standard",
    "shipping_option_type": "agency",
    "estimated_delivery_time": {
      "type": "known_frame",
      "date": "2024-04-24T00:00:00-03:00",
      "unit": "hour",
      "offset": {
        "date": "2024-04-29T00:00:00-03:00",
        "shipping": 72
      },
      "time_frame": {
        "from": null,
        "to": null
      },
      "pay_before": "2024-04-20T00:00:00-03:00",
      "shipping": 24,
      "handling": 48,
      "schedule": null
    },
    "discount": {
      "promoted_amount": 0,
      "rate": 0,
      "type": "none",
      "show_loyal_benefit": false
    }
  },
  {
    "id": 3594424224,
    "option_hash": "6f2e2eb2926b9e6a11c45fe07e9b8803",
    "name": "Estándar a domicilio",
    "currency_id": "ARS",
    "base_cost": 11409.99,
    "cost": 11409.99,
    "list_cost": 11409.99,
    "display": "optional",
    "shipping_method_id": 73328,
    "shipping_method_type": "standard",
    "shipping_option_type": "address",
    "estimated_delivery_time": {
      "type": "known_frame",
      "date": "2024-04-24T00:00:00-03:00",
      "unit": "hour",
      "offset": {
        "date": "2024-04-29T00:00:00-03:00",
        "shipping": 72
      },
      "time_frame": {
        "from": null,
        "to": null
      },
      "pay_before": "2024-04-20T00:00:00-03:00",
      "shipping": 24,
      "handling": 48,
      "schedule": null
    },
    "discount": {
      "promoted_amount": 0,
      "rate": 0,
      "type": "none",
      "show_loyal_benefit": false
    }
  }
],
"custom_message": {
  "display_mode": null,
  "reason": ""
}
}
}
```

### Parámetros de respuesta:

- **destination:**  Información sobre el destino del envío, incluyendo el código postal, la ciudad, el estado y el país.

- **buyer:**  Información del comprador, como su identificación, nivel de lealtad y nivel de envío.

- **options:**  Información de las opciones de envío.

- **options.id:**  Identificador único de la opción de envío.

- **options.option_hash:**  Hash único que identifica la opción de envío.

- **options.name:**  Nombre o alias del modo de envío.

- **options.currency_id:**  Identificador de la moneda utilizada para el costo del envío.

- **options.base_cost:**  Costo base del envío.

- **options.cost:**  Costo total del envío de cara al comprador, aplicando descuentos.

- **options.list_cost:**  Costo real del envío antes de aplicar descuentos.

- **options.display:**  Visualización de la opción de envío, puede tomar los valores “recommended”, “always” u “optional”.

- **options.shipping_method_id:**  Identificador del método de envío utilizado.

- **options.method_type:**  Tipo de método de envío utilizado.

- **options.option_type:**  Tipo de opción de envío utilizado: address, agency o place.

- **options.estimated_delivery_time:**  Información sobre el tiempo estimado de entrega, incluyendo la fecha estimada, y cualquier otra información relevante.

- **options.discount:**  Información sobre descuento en el envío.

- **custom_message:**  Este campo se usa para devolver avisos especiales y de cuestiones ajenas a MercadoLibre que puedan afectar o demorar el envío.

### Códigos de estado de respuesta:

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se actualizó correctamente la configuración. | - |
| 400 - Bad Request | invalid_zip_code | Zip_code inválido. | Validar si el zip_code. |
| 403 - Forbidden | items API error | Item inválido. | Validar el ítem asociado. |
| 404 - Not Found | sla coverage not found | Área inválida para el envío. | Validar el área de envío. |

Nota:

- El parámetro de consulta ZIP_CODE se utiliza para MLB, MLM y MLA, mientras que el parámetro CITY se emplea para MCL, MCO, MPE y MLU.

- Ten en cuenta que este endpoint proporciona una estimación aproximada del monto, basado en los parámetros al momento de la consulta y considerando únicamente la cantidad de un solo artículo.

Más detalles sobre

[Gestionar Envios](https://developers.mercadolibre.com.ar/es_ar/envios)

.
