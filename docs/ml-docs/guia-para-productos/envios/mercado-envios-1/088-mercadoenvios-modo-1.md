<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-1 -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 1 -->

# Mercado Envíos 1

Última actualización 06/02/2026

## Mercado Envíos 1

Importante:

Actualmente, esta modalidad de envío está disponible para vendedores de Argentina, Brasil, México, Chile, Colombia, Uruguay y Perú.

Mercado Envíos 1 (ME1) es una modalidad de envío que posibilita a los vendedores la venta de productos pesados o voluminosos a través de Mercado Libre. Con esta opción, los vendedores pueden gestionar su propia logística o utilizar servicios de terceros para enviar los productos que no son elegibles para Mercado Envíos 2 (ME2). Esto proporciona una mayor visibilidad al comprador en lo que respecta a los costos, los plazos de entrega y la disponibilidad de cobertura.

## Activar ME1 a un vendedor

El proceso de activación de ME1 para un vendedor puede seguir via asesor comercial o Key Account Manager (KAM) de la cuenta en MeLi, o mismo una solicitud directa conforme descrito en la [landing page de Mercado Envios 1](https://www.mercadolibre.com.ar/a/store/mercado-envios-1) .

Para mayor detalle, revisar la sección [consultar la sección Contingencia Mercado Libre.](https://developers.mercadolibre.com.ar/es_ar/flete-dinamico)

Nota:

- ME 1 es una modalidad que requiere el apoyo del asesor comercial para una gestión adecuada. En el caso de que el vendedor no disponga de un asesor comercial, puede solicitar soporte para proporcionar los datos de los referentes por cada país.
 - Es importante destacar que todas las activaciones de ME1 requieren que el vendedor tenga previamente activa la modalidad ME2. Es decir, ambas modalidades deben estar activas en la cuenta del vendedor. Sin embargo, es fundamental comprender que ME2 siempre se mantendrá como la modalidad de envío preferencial.

Importante:

Antes de publicar o editar un ítem utilizando la modalidad ME1, es importante tener en cuenta los siguientes aspectos:

1. Verificar que el vendedor ya tenga

[consultar la sección activada la modalidad ME1 en su cuenta.](https://developers.mercadolibre.com.ar/es_ar/envio)

2. Verificar que el ítem sea

[elegible para ser enviado por ME1.](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-2)

3. Verificar que el ítem cumpla al menos con una de las dimensiones máximas establecidas:

- Alto: 500 cm

- Ancho: 500 cm

- Largo: 500 cm

- Peso: 500000 gr = 500 kg

4. Tener en cuenta que si un ítem tiene la modalidad ME2 disponible, no podrá ser publicado por la modalidad ME1.

Estos pasos aseguran una gestión adecuada de los ítems en Mercado Libre y ayudan a ofrecer la mejor experiencia de compra para los usuarios.

## Publicar un ítem con ME1

Este endpoint permite publicar un ítem con ME1.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items
[...]
{
  "shipping": {
    "mode": "me1",
    "local_pick_up": true,
    "dimensions": "189x72x96,58000"
  }
}
[...]
```

Respuesta:

```
{
   "id": "MLA1644124644",
   "site_id": "MLA",
   "title": "Refrigeradora Samsung Side By Side 602lt Rs60t5200s9",
   "subtitle": null,
   "seller_id": 1459527474,
   "category_id": "MLA9458",
   "official_store_id": null,
   "price": 567803,
   "base_price": 567803,
   "original_price": null,
   "inventory_id": null,
   "currency_id": "ARS",
   "initial_quantity": 15,
   "available_quantity": 12,
   "sold_quantity": 3,
   "sale_terms": [
       {
           "id": "WARRANTY_TYPE",
           "name": "Tipo de garantía",
           "value_id": "2230279",
           "value_name": "Garantía de fábrica",
           "value_struct": null,
           "values": [
               {
                   "id": "2230279",
                   "name": "Garantía de fábrica",
                   "struct": null
               }
           ]
       },
       {
           "id": "WARRANTY_TIME",
           "name": "Tiempo de garantía",
           "value_id": null,
           "value_name": "6 meses",
           "value_struct": {
               "unit": "meses",
               "number": 6
           },
           "values": [
               {
                   "id": null,
                   "name": "6 meses",
                   "struct": {
                       "number": 6,
                       "unit": "meses"
                   }
               }
           ]
       }
   ],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_special",
   "start_time": "2020-09-16T15:06:56.000Z",
   "stop_time": "2040-09-11T04:00:00.000Z",
   "end_time": "2040-09-11T04:00:00.000Z",
   "expiration_time": "2021-01-11T19:28:44.000Z",
   "condition": "new",
   "permalink": "http://articulo.mercadolibre.com.ar/MLA-879036495-test-no-comprar-aire-acondicionado-3000-frigorias-_JM",
   "pictures": [
       {
           "id": "790234-MLA43483081743_092020",
           "url": "http://mla-s2-p.mlstatic.com/790234-MLA43483081743_092020-O.jpg",
           "secure_url": "https://mla-s2-p.mlstatic.com/790234-MLA43483081743_092020-O.jpg",
           "size": "246x120",
           "max_size": "246x120",
           "quality": ""
       }
   ],
   "video_id": null,
   "descriptions": [],
   "accepts_mercadopago": true,
   "non_mercado_pago_payment_methods": [],
   "shipping": {
       "mode": "me1",
       "local_pick_up": false,
       "free_shipping": false,
       "methods": [],
       "dimensions": "189x72x96,58000",
       "tags": [
           "optional_me1_chosen"
       ],
       "logistic_type": "default",
       "store_pick_up": false
   },
   "international_delivery_mode": "none",
   "seller_address": {
       "id": 1131257838,
       "comment": "",
       "address_line": "falsa 123",
       "zip_code": "6000",
       "city": {
           "id": "",
           "name": "junin"
       },
       "state": {
           "id": "AR-B",
           "name": "Buenos Aires"
       },
       "country": {
           "id": "AR",
           "name": "Argentina"
       },
       "latitude": -34.5885499,
       "longitude": -60.94955400000001,
       "search_location": {
           "neighborhood": {
               "id": "",
               "name": ""
           },
           "city": {
               "id": "TUxBQ0pVTjE5NjM",
               "name": "Junín"
           },
           "state": {
               "id": "TUxBUFpPTmFpbnRl",
               "name": "Buenos Aires Interior"
           }
       }
   },
   "seller_contact": null,
   "location": {},
   "geolocation": {
       "latitude": -34.5885499,
       "longitude": -60.94955400000001
   },
   "coverage_areas": [],
   "attributes": [
       {
           "id": "ENERGY_EFFICIENCY",
           "name": "Eficiencia energética",
           "value_id": "98473",
           "value_name": "A",
           "value_struct": null,
           "values": [
               {
                   "id": "98473",
                   "name": "A",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "AIR_CONDITIONER_TYPE",
           "name": "Tipo de aire acondicionado",
           "value_id": "290203",
           "value_name": "Split",
           "value_struct": null,
           "values": [
               {
                   "id": "290203",
                   "name": "Split",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "SEER",
           "name": "SEER",
           "value_id": "-1",
           "value_name": null,
           "value_struct": null,
           "values": [
               {
                   "id": "-1",
                   "name": null,
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "COLOR",
           "name": "Color",
           "value_id": "52055",
           "value_name": "Blanco",
           "value_struct": null,
           "values": [
               {
                   "id": "52055",
                   "name": "Blanco",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "FRIGORIAS",
           "name": "Frigorías",
           "value_id": null,
           "value_name": "3000 fg",
           "value_struct": {
               "unit": "fg",
               "number": 3000
           },
           "values": [
               {
                   "id": null,
                   "name": "3000 fg",
                   "struct": {
                       "number": 3000,
                       "unit": "fg"
                   }
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "ITEM_CONDITION",
           "name": "Condición del ítem",
           "value_id": "2230284",
           "value_name": "Nuevo",
           "value_struct": null,
           "values": [
               {
                   "id": "2230284",
                   "name": "Nuevo",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "COOLING_CAPACITY",
           "name": "Capacidad de refrigeración",
           "value_id": null,
           "value_name": "3520 W",
           "value_struct": {
               "unit": "W",
               "number": 3520
           },
           "values": [
               {
                   "id": null,
                   "name": "3520 W",
                   "struct": {
                       "number": 3520,
                       "unit": "W"
                   }
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "INSTALLATION_PLACEMENTS",
           "name": "Lugares de colocación",
           "value_id": null,
           "value_name": "Pared",
           "value_struct": null,
           "values": [
               {
                   "id": null,
                   "name": "Pared",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "HEATING_CAPACITY",
           "name": "Capacidad de calefacción",
           "value_id": null,
           "value_name": "3520 W",
           "value_struct": {
               "unit": "W",
               "number": 3520
           },
           "values": [
               {
                   "id": null,
                   "name": "3520 W",
                   "struct": {
                       "number": 3520,
                       "unit": "W"
                   }
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "SELLER_SKU",
           "name": "SKU",
           "value_id": null,
           "value_name": "116078",
           "value_struct": null,
           "values": [
               {
                   "id": null,
                   "name": "116078",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "MODEL",
           "name": "Modelo",
           "value_id": null,
           "value_name": "F3000-T",
           "value_struct": null,
           "values": [
               {
                   "id": null,
                   "name": "F3000-T",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "BRAND",
           "name": "Marca",
           "value_id": "8039499",
           "value_name": "Tedge",
           "value_struct": null,
           "values": [
               {
                   "id": "8039499",
                   "name": "Tedge",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "GTIN",
           "name": "Código universal de producto",
           "value_id": null,
           "value_name": "1234567890418",
           "value_struct": null,
           "values": [
               {
                   "id": null,
                   "name": "1234567890418",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "AIR_CONDITIONING_TYPE",
           "name": "Tipo de climatización",
           "value_id": "83445",
           "value_name": "Frío/Calor",
           "value_struct": null,
           "values": [
               {
                   "id": "83445",
                   "name": "Frío/Calor",
                   "struct": null
               }
           ],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       }
   ],
   "warnings": [],
   "listing_source": "",
   "variations": [],
   "thumbnail_id": "790234-MLA43483081743_092020",
   "thumbnail": "http://mla-s2-p.mlstatic.com/790234-MLA43483081743_092020-I.jpg",
   "secure_thumbnail": "https://mla-s2-p.mlstatic.com/790234-MLA43483081743_092020-I.jpg",
   "status": "active",
   "sub_status": [],
   "tags": [
       "cart_eligible",
       "immediate_payment",
       "poor_quality_picture",
       "test_item"
   ],
   "warranty": "Garantía de fábrica: 6 meses",
   "catalog_product_id": null,
   "domain_id": "MLA-AIR_CONDITIONERS",
   "seller_custom_field": null,
   "parent_item_id": null,
   "differential_pricing": null,
   "deal_ids": [],
   "automatic_relist": false,
   "date_created": "2020-09-16T15:06:56.000Z",
   "last_updated": "2020-10-28T16:40:58.491Z",
   "health": 0.83,
   "catalog_listing": false,
   "item_relations": []
}
```

## Activar ME1 en un ítem

Este endpoint permite activar ME1 para los ítems que estén configurados en la modalidad de envíos “Custom” o “Acordar con el vendedor”:

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1644124644
{
  "shipping": {
    "mode": "me1",
    "local_pick_up": true,
    "dimensions": "189x72x96,58000"
  }
}
```

### Códigos de estado de respuesta:

La siguiente tabla proporciona una mayor visibilidad sobre posibles problemas en la configuración de envío ME1. Asegúrate de revisar regularmente las recomendaciones para mantener un flujo de procesos optimizado y brindar una mejor experiencia a tus clientes.

| Parámetro | Descripción | Recomendación |
| --- | --- | --- |
| 4052 | Esta sugerencia se activará cuando un envío ME1 esté disponible, pero se pierde debido a problemas de dimensiones. Te permitirá identificar rápidamente los casos en los que ME1 no puede ser utilizado debido a restricciones de tamaño o peso. | Validar que al menos una de las dimensiones ingresadas supere el umbral de ME1. Mayor a 500 cm o 500 kg. |
| 4053 | Si un vendedor no tiene habilitada la opción de envío ME1 en sus preferencias de envío, esta sugerencia se activará. De esta manera, podrás verificar fácilmente si ME1 está disponible para el vendedor en cuestión. | Validar las modalidades de envío activas para el vendedor. En caso de no mostrarse ME1, contactar al Key Account Manager (KAM) asignado a la cuenta. |
| 4054 | Esta sugerencia te alertará cuando un producto no tenga habilitada la opción de envío ME1 en las preferencias del catálogo. Con esta información, podrás identificar rápidamente los productos que no son elegibles para ME1. | Validar las modalidades de envíos que tiene el ítem, el dominio o la categoría. |

## Consultar envíos con ME1

Este endpoint permite consultar los envíos con ME1 del vendedor.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/$SHIPMENT_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/12345678
```

Respuesta:

```
{
[…]
    "receiver_id": 0987654332,
    "base_cost": 0,
    "status_history": {
        "date_shipped": "2024-02-02T16:31:31.184-04:00",
        "date_returned": null,
        "date_delivered": "2024-02-05T08:38:14.000-04:00",
        "date_first_visit": "2024-02-05T08:38:14.000-04:00",
        "date_not_delivered": null,
        "date_cancelled": null,
        "date_handling": null,
        "date_ready_to_ship": null
    },
    "type": "forward",
    "return_details": null,
    "sender_id": 474415116,
    "mode": "me1",
    "order_cost": 1699999,
    "priority_class": {
        "id": null
    },
    "service_id": 154,
    "shipping_items": [
        {
            "domain_id": null,
            "quantity": 1,
            "dimensions_source": {
                "origin": "seller",
                "id": "MLA1388902895__1"
            },
            "description": "Heladera Samsung Freezer Inf Multi Flow 400l Dispenser Inver",
            "id": "MLA1388902895",
            "user_product_id": null,
            "sender_id": 11111111,
            "dimensions": "180.0x76.0x77.0,84000.0"
        }
    ],
    "tracking_number": "0999-111111111",
    "cost_components": {
        "loyal_discount": 0,
        "special_discount": 0,
        "compensation": 0,
        "gap_discount": 0,
        "ratio": 0
    },
[…]
    "customer_id": null,
    "order_id": 2000007511222222,
    "quotation": null,
    "status": "delivered",
    "logistic_type": "default"
}
```

## Alertas de fraude

Los pedidos ME1 también pueden tener alertas de fraude. Revisa si el pedido tiene el tag fraud_risk_detected ya que en este caso, el pedido no debe ser enviado al comprador. Cuando identificamos una venta sospechosa, alertamos al vendedor por front y API a través del feed de orders. Para más información consulta [nuestra documentación de órdenes](https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas).

Nota:

Es posible [usar el recurso de Cargar factura](https://developers.mercadolibre.com.ar/es_ar/cargar-factura) para disponibilizar la factura correspondiente para el comprador.

**Siguiente** : [Estados de órdenes y seguimiento](https://developers.mercadolibre.com.ar/es_ar/estados-de-ordenes-me1).
