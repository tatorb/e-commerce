<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-2 -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Mercado Envíos 2

Última actualización 06/07/2026

## Gestionar Mercado Envíos 2

Con estas guías te ayudaremos a publicar un producto con Mercado Envíos 2 y manejar todo el proceso de envío utilizando los recursos de nuestra API. Recuerda que las dimensiones de los paquetes son estipuladas por Mercado Libre y no pueden ser manipuladas por el usuario. Si deseas activar Mercado Envíos 2, puedes hacer desde cada país (Argentina, Brasil, Colombia, México, Chile, Uruguay, Perú y Ecuador).

## Tipos de logísticas

Los diferentes tipos de logísticas de envíos para Mercado Envíos 2 son:

- Mercado Envíos Drop_off

- [Mercado Envíos Colectas (cross_docking) y Places (xd_drop_off)](https://developers.mercadolibre.com.ar/envios-colectas-places)

- [Mercado Envíos Flex (self_service)](https://developers.mercadolibre.com.ar/envios-flex)

[Mercado Envíos Full (fulfillment)](https://developers.mercadolibre.com.ar/envios-fulfillment)

## Agregar ME2 a un ítem

Utiliza POST para publicar el ítem. Asegúrate de informar los [atributos obligatorios requeridos por la categoría](https://developers.mercadolibre.com.mx/es_ar/atributos#atributos-obligatorios) y los atributos requeridos por el dominio.

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -d 
  {
      "title": "Item de teste",
      "category_id": "MLA91727",
      "price": 1200,
      "currency_id": "ARS",
      "available_quantity": 2,
      "buying_mode": "buy_it_now",
      "listing_type_id": "bronze",
      "condition": "new",
      "description": "test",
      "pictures": [
          {
              "source": "http://upload.wikimedia.org/wikipedia/commons/f/fd/Ray_Ban_Original_Wayfarer.jpg"
          },
          {
              "source": "http://en.wikipedia.org/wiki/File:Teashades.gif"
          }
      ],
     "shipping": {
     "mode": "me2",
     "local_pick_up": false,
     "free_shipping": false,
     "free_methods": []
   }
  }
  https://api.mercadolibre.com/items
```

Recuerda que para publicar en categorías que marcadas como Frágil, el usuario también deberá estar marcado como "frágil", para esto deberá tener un acuerdo comercial. En las siguientes llamadas de la API deberás validar los campos que se muestran a continuación:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/shipping_preferences

{
  "local_pick_up": false,
  "modes": [
    "custom",
    "not_specified",
    "me1",
    "me2"
  ],
  "trusted_user": true,
  "custom_calculator": false,
  "picking_type": "cross_docking",
  "thermal_printer": null,
  "option": "in",
  "tags": [
  ],
  "carrier_pickup": false,
  "items_combination": "enabled",
  "services": [
    311,
    591,
    671,
    801,
    881,
    1181,
    1191,
    136261
  ],
  "logistics": [
    { 
      "mode": "me1",
      "types": [
        {
          "type": "default",
          "carrier_pickup": [],
          "services": [
            21,
            23,
            22,
            11
          ],
          "default": true
        }
      ]
    },

      {"mode": "me2",
      "types": [
        {
          "type": "cross_docking",
          "carrier_pickup": [
            17501840
          ],
          "services": [
            311,
            591,
            671,
            801,
            881,
            1181,
            1191
          ],
          "default": false
        },
        {
          "type": "self_service",
          "carrier_pickup": [
          ],
          "services": [
            136261
          ],
          "default": false
        }
      ]
    },
    {
      "mode": "custom",
      "types": [
        {
          "type": "custom",
          "carrier_pickup": [
          ],
          "services": null,
          "default": true
        }
      ]
    },
    {
      "mode": "not_specified",
      "types": [
        {
          "type": "not_specified",
          "carrier_pickup": [
          ],
          "services": null,
          "default": true
        }
      ]
    }
  ],
  "content_declaration_disabled": false,
  "conciliation": {
    "type": null
  },
  "mandatory_invoice_data": false,
  "site_id": "MLA",
  "free_configurations": [
    {
      "condition": {
        "value": null,
        "type": "all"
      },
      "rule": {
        "default": true,
        "free_mode": "country",
        "value": null
      }
    }
  ],
  "mandatory_settings": {
  }
}
```

"restricted": true (API category)

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MCO7159/shipping_preferences
{
  "category_id": "MCO7159",
  "dimensions": {
    "weight": 50000,
    "height": 20,
    "width": 60,
    "length": 130
  },
  "logistics": [
    {
      "types": [
        "default"
      ],
      "mode": "me1"
    },
    {
      "types": [
        "drop_off",
        "xd_drop_off",
        "cross_docking",
        "fulfillment"
      ],
      "mode": "me2"
    },
    {
      "types": [
        "not_specified"
      ],
      "mode": "not_specified"
    },
    {
      "types": [
        "custom"
      ],
      "mode": "custom"
    }
  ],
  "restricted": true
}
```

## Atributos requeridos por dominio

Deberás validar cuáles son los atributos que acorde al dominio serán requeridos informar de manera obligatoria **para poder determinar si el ítem es candidato a ser envíado por me2 o no**  Estos datos son complementares a los resultados de la API disponible en la llamadaEsses dados são [https://api.mercadolibre.com/categories/MLB278114/attributes](https://api.mercadolibre.com/categories/MLB278114/attributes).

.

Llamada:

```
curl -X GET 'Authorization: Bearer $ACCESS_TOKEN' http://api.mercadolibre.com/catalog_domains/$DOMAIN_ID/shipping_attributes
```

Ejemplo de llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLB-AUTOMOTIVE_TIRES/shipping_attributes
```

Ejemplo de respuesta:

```
{
   "domain_id": "MLB-AUTOMOTIVE_TIRES",
   "attributes": [
       {
           "id": "RIM_DIAMETER",
           "type": "NUMBER_UNIT",
           "unit": "\"",
           "index": 1,
           "ranges": null
       },
       {
           "id": "TIRES_NUMBER",
           "type": "INTEGER",
           "unit": "",
           "index": 2,
           "ranges": null
       },
       {
           "id": "SECTION_WIDTH",
           "type": "NUMBER_UNIT",
           "unit": "mm",
           "index": 3,
           "ranges": null
       }
   ],
   "client_id": 3536736322237473,
   "date_created": "2022-03-29T13:04:27.912-03:00",
   "last_modified": "2023-07-18T11:31:20.092-03:00"
}
```

### Los campos indicarán:

- domain_id: ID del dominio consultado.

- attributes: arreglo que contiene los atributos que deben ser informados de manera obligatoria al momento de crear o modificar un ítem y que ayudarán a determinar si el ítem es candidato a ser envíados por me2.

## Consultar fecha de envío del producto

Importante:

Esta funcionalidad está disponible en Argentina, Brasil, Chile y México.

Para evitar sobrepasar la capacidad de los transportistas (carriers) y que los compradores reciban los productos a tiempo, es necesario que consultes la fecha de envío de los productos. Identifica los envíos de este tipo realizando un GET a /shipments, incorporando el header 'X-Format-New: true' verificando el nodo “buffering”.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'X-Format-New: true' https://api.mercadolibre.com/shipments/$SHIPMENT_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'X-Format-New: true' https://api.mercadolibre.com/shipments/40173236996
```

Respuesta:

```
{
   "id":40173236996,
   "external_reference":null,
   "status":"pending",
   "substatus":"buffered",
   "date_created":"2020-10-20T10:08:30.000-04:00",
   "last_updated":"2020-10-20T15:09:22.000-04:00",
   "declared_value":7000,
   "dimensions":{
      "height":14,
      "width":19,
      "length":38,
      "weight":950
   },
   "logistic":{
      "direction":"forward",
      "mode":"me2",
      "type":"xd_drop_off"
   },
  []
   "lead_time":{
      "option_id":3628548109,
      "shipping_method":{
         "id":510545,
         "name":"Express a domicilio",
         "type":"two_days",
         "deliver_to":"address"
      },
      "currency_id":"ARS",
      "cost":0,
      "list_cost":504.99,
      "cost_type":"free",
      "service_id":831,
      "delivery_type":"estimated",
      "estimated_schedule_limit":{
         "date":null
      },
      "buffering":{
         "date":"2020-10-21T20:18:26.000Z" ---> Fecha que podrá realizar el envío
      },
      "estimated_delivery_time":{
         "type":"known",
         "date":"2020-10-22T00:00:00.000-03:00",
         "unit":"hour",
         "offset":{
            "date":null,
            "shipping":null
         },
         "time_frame":{
            "from":null,
            "to":null
         },
         "pay_before":"2020-10-21T00:00:00.000-03:00",
         "shipping":24,
         "handling":24,
         "schedule":null
      },
      "estimated_delivery_limit":{
         "date":null,
         "offset":null
      },
      "estimated_delivery_final":{
         "date":null,
         "offset":null
      },
      "estimated_delivery_extended":{
         "date":null,
         "offset":null
      },
      "estimated_handling_limit":{
         "date":"2020-10-21T00:00:00.000-03:00"
      }
   },
   "tags":[
      "test_shipment"
   ]
}
```

En el campo buffering “date” del nodo “buffering” estará la fecha correspondiente que se tiene que despachar el paquete y ese mismo día disponibilizaremos la etiqueta para la impresión.

Notas:

- Para las **ventas con envíos DropShipping** , **Cross Docking**  y **Cross Docking Drop Off** , si el substatus es **"buffered"**  debes marcar el "buffering" e informar al vendedor que podrá imprimir la etiqueta en la fecha indicada en el campo "date".

- La fecha de liberación de impresión de etiqueta (buffering) puede diferir de la fecha límite estimada de despacho/colecta (`estimated_handling_limit`):  La fecha límite (`estimated_handling_limit`) siempre será igual o mayor al tiempo de buffering. Si el vendedor necesita verificar la fecha exacta en la que debe realizar el despacho o la colecta, siempre debe consultar el campo `estimated_handling_limit`.

## Imprimir etiquetas de envío

Cuando un comprador completa su compra, es crucial que el vendedor pueda generar rápidamente la etiqueta de envío para agilizar el proceso de despacho.

### Validaciones de tipos de logística:

Antes de intentar obtener la etiqueta, es esencial verificar los campos "mode" y "type" dentro del nodo logístico para garantizar que la etiqueta esté disponible.

**Mode** : siempre debe ser “me2”.
 **Logistic_type** : indica los tipos de logística aceptados tales como:

- “drop_off”

- “xd_drop_off”

- “cross_docking”

- “self_service”

- Nota:   Es fundamental aclarar que en los Envíos Fulfillment, el vendedor no tiene la capacidad de imprimir etiquetas de ventas para el envío de productos, ya que esta tarea es llevada a cabo exclusivamente por el equipo de Mercado Libre dado que, el stock se encuentra en nuestros depósitos. La única etiqueta que el vendedor puede imprimir en esta modalidad de envío es la etiqueta de stock o de producto, la cual se utiliza para enviar un producto a los depósitos.

- 

- Validaciones de estado de envío:

- Es importante validar que el estado sea "ready_to_ship" y el subestado "ready_to_print" para poder imprimir la etiqueta. En casos o estados distintos, la impresión de etiquetas no será posible y generará un error.

- 

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/43308302844`

- Respuesta:

- `[ { ... "mode": "me2", ... "substatus": "ready_to_print", ... "status": "ready_to_ship", "logistic_type": "self_service" } ]`

- Etiquetas:

- Este endpoint permite generar etiquetas de envío de forma rápida y eficiente para Mercado Envíos 2.

- 

- Llamada para formato PDF:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipment_labels?shipment_ids=$SHIPPING_ID1,$SHIPPING_ID2&response_type=pdf`

- Ejemplo para formato PDF:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipment_labels?shipment_ids=43308302844&response_type=pdf`

- Llamada para formato ZPL:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipment_labels?shipment_ids=$SHIPPING_ID1,$SHIPPING_ID2&response_type=zpl2`

- Ejemplo para formato ZPL:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipment_labels?shipment_ids=43308302844&response_type=zpl2`

- Códigos de Estado de respuesta:

- Código Mensaje Descripción Recomendación     200 - OK - Se obtuvo correctamente la consulta. -    400 - Bad Request invalid_shipment_caller No existe el usuario. Validar el valor del seller_id y access_token.   400 - Bad Request not_printable_status Estado no permitido para la impresión de etiquetas. Validar que el estado sea "ready_to_ship" y el subestado "ready_to_print".   400 - Bad Request shipment_ids Límite de etiquetas excedido. Validar que se envíen como máximo 50 shipment_ids.   400 - Bad Request invalid_shipment_ff_public Shipment de fulfillment. Validar el logistic_type.   400 - Bad Request invalid_shipment_mode Shipment fuera de me2. Validar el shipping mode.   404 - Not Found Missing a valid shipment id value Shipment no encontrado. Validar el valor del shipment_id.

- 

- 

- Algunas validaciones adicionales son las siguientes:

- Consulta máximo 50 (cincuenta) shipment_ids en un mismo GET para evitar errores. Si superas esta cantidad máxima permitida, recibirás un error 400. En todos los países, las medidas estándar para imprimir etiquetas son de 15 cm de alto x 10 cm de ancho, con la excepción de México, donde las medidas son de 20 cm de alto x 10 cm de ancho. Para los países de 10x15 cm, las etiquetas en PDF se pueden reducir a 9x15 cm para que puedan caber tres por hoja A4, lo que permite optimizar el uso de recursos y reducir costos. Cuando imprimas etiquetas de envío en formato PDF,te recomendamos utilizar una hoja A4 para garantizar una impresión precisa y eficiente. Asegúrate de calibrar tu impresora para las dimensiones acotadas anteriormente.. Para reimprimir la etiqueta, simplemente realiza el mismo GET. Sin embargo, asegúrate de cumplir con las validaciones previas para evitar errores.  Las etiquetas en el estado "ready_to_ship" y el subestado "ready_to_print" o “printed” pueden reimprimirse según sea necesario. Es importante destacar que no se permite crear etiquetas personalizadas para ningún vendedor.  Para imprimir etiquetas Zebra, es necesario contar con una impresora térmica compatible con el lenguaje Zebra (ZPL). Exclusivamente para Brasil: Ten en cuenta que las notas fiscales tienen las mismas dimensiones que las etiquetas. Solo podrás imprimir las notas fiscales después de haberlas generado. En ese momento, podrás imprimir las notas fiscales de forma independiente o junto con la etiqueta.    Consultar envíos de carrito     Importante:   Carrito de compras está disponible en Argentina, Brasil, México, Chile y Colombia. Próximamente en Uruguay.    Con el carrito de compras, los compradores pueden aprovechar más los envíos. Cuando estén visitando tus publicaciones, les recomendaremos tus otros productos para que los agreguen al carrito. Si te compran varios productos, los compradores podrán tener envío gratis o descuentos en el envío. Con la actual estructura del JSON de orders, la información del envío no está más disponible, solo estará la identificación. De esta manera, puedes conseguir la información adicional [en el recurso /shipments](https://developers.mercadolibre.com.ar/es_ar/envios).   Para trabajar con el JSON actualizado, al hacer el GET deberás enviar el parámetro "x-format-new: true". El resto de la estructura del recurso seguirá funcionando de la misma manera, con algunas modificaciones que deberás tener en cuenta. Llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/orders/$ORDER_ID` Ejemplo: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/orders/2053577644` Respuesta: `{ "id": 2053577644, "date_created": "2019-06-13T09:20:02.000-04:00", "date_closed": "2019-06-13T09:20:08.000-04:00", "last_updated": "2019-06-13T09:20:08.000-04:00", "manufacturing_ending_date": null, "feedback": { "sale": null, "purchase": null }, "mediations": [], "comments": null, "pack_id": 2000000101334825, "pickup_id": null, "order_request": { "return": null, "change": null }, "fulfilled": null, "total_amount": 9.99, "paid_amount": 9.99, "coupon": { "id": null, "amount": 0 }, "expiration_date": "2019-07-11T09:20:08.000-04:00", "order_items": [ "item": { "id": "MLB1226730704", "title": "Produto Teste - Não Ofertar", "category_id": "MLB11742", "variation_id": null, "seller_custom_field": null, "variation_attributes": [], "warranty": "12 months", "condition": "new", "seller_sku": null }, "quantity": 1, "unit_price": 9.99, "full_unit_price": 9.99, "currency_id": "BRL", "manufacturing_days": null ], "currency_id": "BRL", "payments": [ "id": 4863317779, "order_id": 2053577644, "payer_id": 419067349, "collector": { "id": 419059118 }, "card_id": null, "site_id": "MLB", "reason": "Produto Teste - Não Ofertar", "payment_method_id": "account_money", "currency_id": "BRL", "installments": 1, "issuer_id": null, "atm_transfer_reference": { "company_id": null, "transaction_id": null }, "coupon_id": null, "activation_uri": null, "operation_type": "regular_payment", "payment_type": "account_money", "available_actions": [ "refund" ], "status": "approved", "status_code": null, "status_detail": "accredited", "transaction_amount": 9.99, "taxes_amount": 0, "shipping_cost": 0, "coupon_amount": 0, "overpaid_amount": 0, "total_paid_amount": 9.99, "installment_amount": null, "deferred_period": null, "date_approved": "2019-06-13T09:20:07.000-04:00", "authorization_code": null, "transaction_order_id": null, "date_created": "2019-06-13T09:20:07.000-04:00", "date_last_modified": "2019-06-13T09:20:07.000-04:00" ], "shipping": { "id": 27987243797 }, "status": "paid", "status_detail": null, "tags": [ "test_order", "pack_order", "paid" ], "buyer": { "id": 419067349, "nickname": "TT763866", "email": "ttest.6hqmq6+2-ogiydkmzvg43tmobx@mail.mercadolivre.com", }, "first_name": "Test", "last_name": "Test", "billing_info": { "doc_type": "CPF", "doc_number": "78525276200" }, "seller": { "id": 419059118, "nickname": "TETE8288849", "email": "ttest.hpz2z6q+2-ogiydkmzvg43tmobs@mail.mercadolivre.com", "phone": { "area_code": "01", "extension": "", "number": "1111-1111", "verified": false }, "alternative_phone": { "area_code": "", "extension": "", "number": "" }, "first_name": "Test", "last_name": "Test" }, "taxes": { "amount": null, "currency_id": null }` La respuesta no devuelve el campo total_amount_with_shipping, el cual debe ser calculado. Para entender a qué hace referencia cada uno de los parámetros realiza la siguiente llamada: `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/orders/$ORDER_ID?options` Calcular monto total con envío Con nuestro recurso orders puedes [calcular el monto total con envío](https://developers.mercadolibre.com.ar/es_ar/gestiona-ventas#C%C3%A1lculo-del-total-amount-with-shipping).   Consideraciones  El tag “pack_order” se genera de manera automática para poder discriminar si la orden está asociada a un carrito y no podrá ser borrado por el comprador o el vendedor. El campo "pack_id" muestra el número de carrito al cual pertenece la orden. En caso que la orden no esté asociada a un Carrito de Compras y la transacción sea bajo la modalidad “acordar con el vendedor”, ya no recibirás un status to be agreed si no que directamente el shipping ID vendrá como nule. Eso te dará la pauta de que deberás entrar en contacto con el comprador para coordinar la forma de envío. Solo contarás con el ID del envío, para luego ir a buscar la información a los nuevos recursos de Shipping. Existe la posibilidad de que, aún existiendo una orden, el envío demore en crearse. En esos casos el ID será nulo hasta su creación. Cuando eso pase, serás notificado. Los tags “delivered/not delivered” ya no se agregarán automáticamente. Solamente existirá la marca si el integrador realiza un PUT con el tag definido. Las órdenes en status paid se cancelarán si se rechaza o devuelve el pago. Si sucede, recibirás una notificación para que puedas conocer el cambio en el estado de la orden.      Importante:   La Orden seguirá mostrando el campo "seller_custom_field", pero mostrará los datos cargados con los siguientes criterios usados para escoger la información de SKU:  1- SELLER_SKU de atributos de variación   2- seller_custom_field de variación   3- SELLER_SKU de atributos de item   4- seller_custom_field de item.      Posibles errores 400: validaciones de consistencia:  Los campos obligatorios están incompletos. El formato de los IDsids es incorrecto.  401: token invalido.  403: falta de permisos.  404: Bad Request - el ítem, los productos o los dominios especificados no existen.  **Siguiente** : [Costos de envío](https://developers.mercadolibre.com.ar/es_ar/costos-de-envios).
