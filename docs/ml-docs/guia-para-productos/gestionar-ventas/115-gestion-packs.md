<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestion-packs -->
<!-- Sección: Guía para productos > Gestionar ventas -->

# Packs

Última actualización 29/12/2025

# Gestión de packs

**Importante:**

Actualmente, la funcionalidad está disponible para vendedores de Argentina, Brasil, México, Chile, Colombia, Uruguay, Perú y Ecuador.

## Relación de entidades

El diagrama ilustra cómo se interrelacionan los componentes clave dentro de un pack:

- **Pack:**  Se convierte en un componente obligatorio en todas las compras, ya que todas las órdenes estarán asociadas a un pack_id.

- **Relación con Order (Orden):**  Existe una relación de **1 a N**  entre un pack y una o más órdenes. Esto significa que un pack puede contener múltiples órdenes, lo que refleja situaciones donde varias órdenes se agrupan en un solo pack. **Relación con Shipping (Envío):**  Existe una relación de **0 a 1** , lo que sugiere que un pack puede o no estar vinculado a un proceso de envío. Este caso es común, especialmente en ventas de ítems not_specified, donde no siempre se requiere un shipment_id. **Relación con Payments (Pagos):**  Existe una relación de **1 a N**  entre una orden y uno o más pagos. Esto implica que una orden puede requerir múltiples pagos, como en el caso de pagos a plazos o cuando una orden está asociada a varias transacciones diferentes. **Relación con Descuentos (Discounts):**  Existe una relación de **N a N**  entre payments y discounts. Esto implica que ahora un solo pago puede estar vinculado a múltiples descuentos.

Este diagrama proporciona una visión clara del flujo de packs, órdenes, envíos y pagos, destacando la flexibilidad y las posibles variaciones en cada componente.

Nota:

- De manera gradual y durante este año 2024, todas las órdenes estarán vinculadas a un pack_id.

- De acuerdo con la relación de entidades, se recomienda el siguiente flujo:

- Primero, consulta el endpoint /packs para obtener un panorama inicial de las órdenes vinculadas. Luego, utiliza el endpoint /orders para acceder a detalles específicos sobre las órdenes de ese carrito. Si necesitas información detallada sobre pagos, emplea el endpoint https://api.mercadopago.com/v1/payments/{id}, que proporciona los datos necesarios y está documentada en el sitio para desarrolladores de [Mercado Pago](https://www.mercadopago.com.ar/developers/es/reference/payments/_payments_id/get).

- Recuerda que al agregar la garantía extendida para ítems not_specified, se generará una excepción. Este ítem se considerará adicional, creando un nuevo pack_id, aunque no se asignará un shipment_id.

Conoce más sobre:

- [¿Cómo uso la garantía extendida?](https://www.mercadolibre.com.ar/ayuda/20515)

- [¿Cómo extender la garantía de un producto?](https://www.mercadolibre.com.ar/ayuda/como-extender-la-proteccion-de-un-producto_4388)

- [¿Cómo cancelo la garantía extendida?](https://www.mercadolibre.com.ar/ayuda/20516)

## Consultar órdenes de un pack

Representa un paquete de compra, puede tener una o varias órdenes del mismo o de distintos vendedores.

Este endpoint te permite consultar información sobre las órdenes de un pack.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/packs/$PACK_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/packs/2000006181551917
```

**Respuesta:**

```
{
    "shipment": {
        "id": 43729529445
    },
    "orders": [
        {
            "id": 2000009047722568
        },
        {
            "id": 2000009047707726
        }
    ],
    "id": 2000006181551917,
    "status": "released",
    "status_detail": null,
    "buyer": {
        "id": 1944693439
    },
    "date_created": "2024-08-15T17:38:30.000-0400",
    "last_updated": "2024-08-15T17:42:52.000-0400"
}
```

**Parámetros de respuesta:**

- **shipment.id:**  Identificador único del envío.

- **orders.id:**  Identificadores únicos de las órdenes que están asociadas a un pack.

- **id:**  Identificador único del pack.

- **status:**  Estado actual del pack. Podría tomar los siguientes valores:  **Released:**  las órdenes y el envío están pagados. **Error:**  Algo falló dentro del proceso y podría recuperarse. **Pending_cancel:**  ocurrió un error no recuperable. **Cancelled:**  las órdenes y el envío están cancelados.

- **status_detail:**  Proporciona detalles adicionales sobre el estado del pack, como los motivos de una cancelación o cualquier otro problema específico que afecte el envío (en este caso, null indica que no hay detalles adicionales).

- **buyer.id:**  Identificador único del comprador asociado al pack.

- **date_created:**  Fecha y hora en que se creó el pack.

- **last_updated:**  Fecha y hora de la última actualización del pack.

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Posible Solución |
| --- | --- | --- | --- |
| 200 - OK | - | Consulta exitosa. | - |
| 403 - forbidden | Can not identify the user | No se puede identificar al usuario. | Validar access token. |
| 403 - forbidden | The user has not access to the order | El caller no está autorizado a acceder al recurso. | Validar access token. |
| 404 - not_found | Order do not exists | El pack no existe. | Validar el pack_id. |

Nota:

- Solo podrás ver o leer las órdenes de los vendedores que estén utilizando tu integración o sistema. Esto significa que si una consulta devuelve solo una orden, podría deberse a que las otras órdenes no están asociadas a vendedores que usen tu sistema.

## Consultar órdenes

Una orden representa la compra de un ítem-variación en el marketplace. Siempre la orden es de un solo ítem, pero pueden ser múltiples unidades del mismo.

Este endpoint te permite obtener detalles sobre una orden específica.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/orders/$ORDER_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/orders/2000008779458474
```

**Respuesta:**

```

    {
        "id": 2000009713473608,
        "date_created": "2024-11-01T09:34:59.000-04:00",
        "last_updated": "2024-11-01T09:37:20.000-04:00",
        "date_closed": "2024-11-01T09:35:43.000-04:00",
        "pack_id": 2000006556183755,
        "fulfilled": null,
        "buying_mode": "buy_equals_pay",
        "shipping_cost": 0.0,
        "mediations": [],
        "total_amount": 125.92,
        "paid_amount": 125.92,
        "order_items": [
            {
                "item": {
                    "id": "MLB3737188005",
                    "title": "Espa\u00e7ador E Nivelador Para Piso 1,5 Mm 500p\u00e7s Eco Cortag Cor Vermelho",
                    "category_id": "MLB188658",
                    "variation_id": null,
                    "seller_custom_field": null,
                    "variation_attributes": [],
                    "warranty": "Garantia de f\u00e1brica: 3 meses",
                    "condition": "new",
                    "seller_sku": "ESPA\u00c7ADOR NIVELADOR ECO C/500 P\u00c7S CORTAG-2",
                    "global_price": null,
                    "net_weight": null,
                    "user_product_id": "MLBU1458960576",
                    "release_date": null
                },
                "quantity": 2,
                "requested_quantity": {
                    "measure": "unit",
                    "value": 2
                },
                "picked_quantity": null,
                "unit_price": 62.96,
                "full_unit_price": 72.37,
                "currency_id": "BRL",
                "manufacturing_days": null,
                "sale_fee": 11.07,
                "listing_type_id": "gold_special",
                "base_exchange_rate": null,
                "base_currency_id": null,
                "element_id": 1,
                "stock": [
                    {
                      "store_id": "54936888", // Nuevos atributos de Stock Distribuido y Multi Origen
                      "network_node_id": "163942": "54936888", // Nuevos atributos de Stock Distribuido y Multi Origen
    
                    }
               ],
            }
        ],
    
        "currency_id": "BRL",
        "payments": [
            {
                "id": 91776699099,
                "order_id": 2000009713473608,
                "payer_id": 6427433,
                "collector": {
                    "id": 779432305
                },
                "card_id": null,
                "reason": "Espa\u00e7ador E Nivelador Para Piso 1,5 Mm 500p\u00e7s Eco Cortag Cor Vermelho",
                "site_id": "MLB",
                "payment_method_id": "account_money",
                "currency_id": "BRL",
                "installments": 1,
                "issuer_id": "2007",
                "atm_transfer_reference": {
                    "transaction_id": null,
                    "company_id": null
                },
                "activation_uri": null,
                "operation_type": "regular_payment",
                "payment_type": "account_money",
                "available_actions": [
                    "refund"
                ],
                "status": "approved",
                "status_code": null,
                "status_detail": "accredited",
                "transaction_amount": 125.92,
                "transaction_amount_refunded": 0.0,
                "taxes_amount": 0.0,
                "shipping_cost": 0.0,
                "overpaid_amount": 0.0,
                "total_paid_amount": 125.92,
                "installment_amount": null,
                "deferred_period": null,
                "date_approved": "2024-11-01T09:35:42.000-04:00",
                "transaction_order_id": null,
                "date_created": "2024-11-01T09:35:42.000-04:00",
                "date_last_modified": "2024-11-01T09:37:12.000-04:00",
                "marketplace_fee": 22.14,
                "reference_id": null,
                "authorization_code": null
            }
        ],
        "shipping": {
            "id": 44028792542
        },
        "status": "paid",
        "status_detail": null,
        "tags": [
            "pack_order",
            "order_has_discount",
            "catalog",
            "paid",
            "not_delivered"
        ],
        "feedback": {
            "seller": null,
            "buyer": null
        },
        "context": {
            "channel": "marketplace",
            "site": "MLB",
            "flows": [
                "catalog"
            ],
        },
        "seller": {
            "id": 779432305,
            "user_type": null,
            "tags": [],
            "status": null,
            "buy_restrictions": []
        },
        "buyer": {
            "id": 6427433,
            "user_type": null,
            "tags": [],
            "status": null,
            "buy_restrictions": []
        },
        "taxes": {
            "amount": null,
            "currency_id": null,
            "id": null
        },
        "cancel_detail": null,
        "manufacturing_ending_date": null,
        "order_request": {
            "change": null,
            "return": null
        }
    }    
    
```

**Parámetros de respuesta:**

- **id:**  Identificador único de la orden.

- **date_created:**  Fecha y hora en que se creó la orden.

- **last_updated:**  Fecha y hora de la última actualización de la orden.

- **date_closed:**  Fecha y hora en que se cerró la orden.

- **pack_id:**  Identificador del pack al que pertenece la orden, si está asociada a un pack.

- **fulfilled:**  Indica si la orden ha sido cumplida o completada (valor booleano).

- **buying_mode:**  Modo de compra utilizado, en este caso, "buy_equals_pay" (comprar equivale a pagar).

- **shipping_cost:**  Costo del envío asociado a la orden. Puede ser nulo si forma parte de un pack_id. De no ser así, se mostrará el costo de envío que el comprador pagó por su pedido.

- **mediations:**  Array de mediaciones asociadas con la orden (puede estar vacío).

- **total_amount:**  Monto total de la orden.

- **paid_amount:**  Monto pagado por la orden.

- **order_items:**  Array que contiene los detalles de los productos incluidos en la orden, como el título, cantidad, precio unitario, etc.

- **order_items.stock.store_id:**  Identifica la tienda o ubicación física específica donde se encuentra almacenado el stock de un ítem. **order_items.stock.network_node_id:**  Representa el nodo del seller o la ubicación física específica desde la cual proviene un ítem.

- **currency_id:**  Identificador de la moneda utilizada en la transacción.

- **payments:**  Array de pagos asociados a la orden, incluyendo detalles como el método de pago, monto de la transacción, estado del pago, etc.

- **shipping:**  Información sobre el envío, incluyendo el id del envío.

- **status:**  Estado actual de la orden (por ejemplo, "paid").

- **status_detail:**  Detalles adicionales sobre el estado de la orden (puede ser nulo).

- **tags:**  Array de etiquetas asociadas a la orden.

- **pack_order:**  La orden pertenece a un pack. **not_delivered:**  La orden no fue entregada. **not_paid:**  La orden no ha sido pagada. **high_concurrency:**  Indica que la orden es de un artículo de alta concurrencia (por ejemplo, en eventos de venta masiva). **catalog:**  Orden creada por un ítem listado por catálogo. **unfulfilled:**  Orden que no se ha concretado. **test_order:**  Orden de prueba (ambas partes deben ser usuarios de prueba).

- **feedback:**  Representa las calificaciones de las contrapartes en una venta.

- **buyer:**  ID del feedback del comprador. **seller:**  ID del feedback del vendedor.

- **context:**  Información contextual de la orden, incluyendo canal y país.

- **seller:**  Información sobre el vendedor, incluyendo su “id”, tipo de usuario, y restricciones de compra.

- **buyer:**  Información sobre el comprador, incluyendo su “id”, apodo, nombre, apellido, tipo de usuario, y restricciones de compra.

- **taxes:**  Información sobre los impuestos aplicados a la orden, incluyendo el monto y la moneda (puede ser nulo).

- **cancel_detail:**  Detalles sobre la cancelación de la orden (puede ser nulo).

- **manufacturing_ending_date:**  Fecha de finalización de la fabricación, si aplica (puede ser nulo).

- **order_request:**  Información sobre solicitudes de cambio o devolución asociadas a la orden (puede ser nulo).

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Posible Solución |
| --- | --- | --- | --- |
| 200 - OK | - | Consulta exitosa. | - |
| 403 - forbidden | Can not identify the user | No se puede identificar al usuario. | Validar access token. |
| 403 - forbidden | The user has not access to the order | El caller no está autorizado a acceder al recurso. | Validar access token. |
| 404 - not_found | Order does not exist | La orden no existe. | Validar el order_id. |

**Consideraciones**

- En ocasiones, puede suceder que, aunque exista una orden, el envío demore en crearse. En estos casos, el shipping ID será null hasta que se cree el envío, y recibirás una notificación una vez se genere.

- Los tags delivered/not delivered ya no se agregarán automáticamente. Si necesitas que estos tags estén presentes, el integrador deberá realizar un PUT con el tag correspondiente.

- Las órdenes en estado paid se cancelarán si el pago es devuelto. Cuando esto ocurra, recibirás una notificación para que estés al tanto del cambio de estado de la orden.

- Aunque la orden seguirá mostrando el campo seller_custom_field, la información mostrada en este campo seguirá ciertos criterios para seleccionar la información de SKU, tales como:

- seller_sku de atributos de variación seller_custom_field de variación seller_sku de atributos de ítem seller_custom_field de item

- En caso que la orden no esté asociada a un pack y la transacción sea bajo la modalidad “acordar con el vendedor”, ya no recibirás un estado “to be agreed” sino que directamente el shipping ID vendrá como null. Eso te dará la pauta de que deberás entrar en contacto con el comprador para coordinar la forma de envío.

Nota:

- Es importante tener en cuenta que en el uso del endpoint /orders, la información relacionada con los cupones y/o descuentos no debe ser consultada directamente a través de la información de discount en el nodo de payments. Se recomienda utilizar los endpoints específicos de descuentos y promociones para obtener detalles completos y precisos sobre cupones y descuentos aplicados a una orden, tales como:

- /orders/$ORDER_ID/discounts https://api.mercadopago.com/v1/payments/{id}

## Ya tengo el producto

Este endpoint permite al vendedor marcar la disponibilidad de stock o "Ya tengo el producto", permitiendo despachar el producto cuando esté listo.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/$SHIPMENT_ID/process/ready_to_ship
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/43664723386/process/ready_to_ship
```

**Respuesta:**

```
{                                                                                                              
    "status": 200                                                                                              
}
```

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Posible Solución |
| --- | --- | --- | --- |
| 200 - OK | - | Consulta exitosa. | - |
| 403 - forbidden | At least one policy returned UNAUTHORIZED | El caller no está autorizado a acceder al recurso. | Validar access token. |
| 404 - not_found | Not found shipment with id. | No se encontró shipment_id. | Validar shipment_id. |

**Consideraciones:**

- Tomar en cuenta que esta funcionalidad solo se puede usar para órdenes ME2.

- Considerar que está habilitada en países que cuenten con la funcionalidad de manufacturing_time y ME2.
