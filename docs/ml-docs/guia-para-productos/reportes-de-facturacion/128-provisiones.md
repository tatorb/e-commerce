<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/provisiones -->
<!-- Sección: Guía para productos > Reportes de Facturación -->

# Provisiones

Última actualización 08/06/2026

## Provisiones

Obtén el detallamiento para verificar las notas fiscales y los cobros de ventas de un período específico, el grupo de facturación (Mercado Libre o Mercado Pago) y el tipo de documento (Nota Fiscal o Nota de Crédito) conforme a la unidad de negocio que escojas: Mercado Libre, Mercado Pago, Mercado Envíos Flex, Fulfillment e Insurtech. Puedes filtrar con los parámetros: group (ML, MP) y document_type (BILL, CREDIT_NOTE).

## Parámetros de paginación

Proponemos el uso de 2 parámetros para gestionar la paginación:

- limit: limita la cantidad de resultados a obtener. El valor mínimo es 1 y el máximo permitido es 1000. Por defecto, su valor es 150.

- from_id: permite buscar a partir de un Id de detalle específico. Este valor se retorna en el campo last_id de la respuesta JSON. Por defecto, su valor es 0.

Para ordenar y obtener los resultados de forma correcta, deben añadirse a la request los siguientes parámetros:

- sort_by: propiedad por la cual deseas ordenar (ID o DATE)

- order_by: orientación de la ordenación (ASC o DESC)

La API de reportes de facturación permite ajustar la cantidad de resultados por página a través del parámetro limit. Por defecto, ese valor es 150, con un máximo permitido de 1000. Esto significa que puedes incrementar el número de registros por solicitud hasta 1000, conforme a tus necesidades.

La frecuencia de consumo depende del volumen de datos y de las necesidades específicas de tu aplicación. Si manejas grandes volúmenes de información, es recomendable realizar solicitudes periódicas, ajustando el limit y utilizando el from_id para paginar los resultados de forma eficiente. Por ejemplo, si deseas obtener los primeros 1000 registros, puedes establecer limit=1000 y from_id=0. Para la próxima página, mantén limit=1000, from_id=<last_id de la request anterior> y así sucesivamente. Este enfoque te permite dividir la información en páginas manejables y procesarlas de manera eficiente.

## Filtros opcionales

- date_sort: permite ordenar la búsqueda.  asc: ordena los resultados de forma ascendente (valor por defecto) desc: ordena los resultados de forma descendente Ejemplo: date_sort=asc

- sort_by: permite seleccionar por cuál campo ordenar.  Valores posibles: ID (valor por defecto) y DATE

- detail_type: permite buscar por tipos de detalles.  charge: retorna solo cobros. bonus: retorna solo bonificaciones. Ejemplo: detail_type=charge

- detail_sub_types: permite filtrar por subtipos de detalles. Es posible definir varios separados por coma.  Valores posibles: Ejemplo: detail_sub_types=CV, BV

- detail_excluded_sub_types: permite excluir de la búsqueda los subtipos de detalles indicados. Es posible definir varios separados por coma.  Ejemplo: not_subtypes=CXD, BXD

- marketplace_type: permite buscar por el marketplace del cobro y/o bonificación.  Valores posibles: Ejemplo: marketplace_type=SHIPPING

- order_ids: permite buscar por uno o varios ids de la order. Disponible para Mercado Libre.  Ejemplo: order_ids=2294412230

- item_ids: permite buscar por uno o más ids del anuncio.  Ejemplo: item_ids=724159812

- document_ids: permite buscar por uno o más ids de la nota fiscal.  Ejemplo: document_ids=987046992

- detail_ids: permite buscar por uno o más ids del detalle.  Ejemplo: detail_ids=724159812

- offset: permite buscar a partir de un número de resultado en adelante. El valor mínimo permitido es 0 y el valor máximo permitido es 10000. Por defecto, el valor es 0 – Te recomendamos utilizar más filtros y limitar los resultados.

- limit: limita la cantidad de resultados. Por defecto, el mínimo es 1 y el máximo permitido: 1000.

- from_id: permite buscar a partir de un Id de detalle específico. Este valor se retorna en el campo last_id de la respuesta JSON. Por defecto, su valor es 0.

## Ejemplo de paginación: Detalles de Mercado Pago

**Primera página:**

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2024-11-01/group/MP/details?document_type=BILL&limit=1000&from_id=0
```

**Segunda página:**

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2024-11-01/group/MP/details?document_type=BILL&limit=1000&from_id=12345678
```

## Consideraciones

¿Cómo integrarse para garantizar que, incluso realizando varias consultas, la información no quede duplicada?

Para evitar duplicatas al realizar múltiples consultas, es fundamental utilizar correctamente los parámetros limit y from_id en cada solicitud. El parámetro limit define la cantidad de registros a obtener y from_id permite indicar un id de detalle específico. Al incrementar el limit en cada solicitud y enviar el from_id, garantizas que cada página de resultados sea única y no se repitan registros.

- Para obtener la primera página: limit=1000 y from_id=0.

- Para la segunda página: limit=1000 y from_id=<last_id de la request anterior>.

- Y así sucesivamente hasta consultar todos los detalles.

Este método garantiza una paginación eficaz sin duplicatas.

También encontrarás el parámetro offset. El offset permite buscar a partir de un número de resultado en adelante. El valor mínimo permitido es 0 y el valor máximo permitido es 9999. Este parámetro solo se recomienda en casos donde la cantidad de detalles es menor que 10000.

## Mercado Libre

Verás los cobros facturados, información de la venta, descuentos, envíos y el anuncio.

Importante:

La estructura de la tarifa de venta para MLB fue actualizada para separar el costo por vender en la plataforma, el costo por cobrar con Mercado Pago y la tarifa de financiación, que depende del método y de la cantidad de cuotas elegidas por el comprador (no genera Nota Fiscal, ya que no corresponde a un servicio o transacción). Además, algunos productos pueden incluir un costo fijo adicional a la tarifa de venta. Para más información, visita [Conoce más sobre las tarifas de Mercado Libre](https://www.mercadolibre.com.br/ajuda/41577).

Para MLB, la respuesta de la API incluirá una nueva entidad con información detallada sobre la composición de la tarifa de venta (sale_fee). Esta mejora te permitirá visualizar de forma más clara los componentes de la tarifa asociados a la venta, separando los descuentos aplicados y los rebates recibidos por cada order.

### Llamada:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/group/ML/details
```

### Ejemplo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2021-06-01/group/ML/details?document_type=BILL&limit=1
```

### Respuesta:

```

{
  "charge_info": {
    "legal_document_number": null,
    "legal_document_status": "PROCESSING",
    "legal_document_status_description": "En procesamiento",
    "creation_date_time": "2024-11-14T10:36:38",
    "detail_id": 126303124,
    "transaction_detail": "Tarifa de financiación (incremento en el valor pagado por el comprador)",
    "debited_from_operation": "NO",
    "debited_from_operation_description": "No",
    "status": null,
    "status_description": null,
    "charge_bonified_id": null,
    "detail_amount": 2.75,
    "detail_type": "CHARGE",
    "detail_sub_type": "CFONPN"
  },
  "discount_info": {
    "charge_amount_without_discount": 2.75,
    "discount_amount": 0,
    "discount_reason": null,
    "rebate": null
  },
  "sales_info": [
    {
      "order_id": 2000009839350282,
      "operation_id": 93353250128,
      "sale_date_time": "2024-11-14T09:36:25",
      "sales_channel": "Mercado Libre",
      "payer_nickname": "TESTUSER1317068011",
      "state_name": null,
      "transaction_amount": 100,
      "financing_transfer_total": 102.75,
      "financing_fee": 2.75,
      "sale_fee": {
        "gross": 13.84,
        "net": 8.39,
        "rebate": 5.45,
        "discount": 0.0,
        "discount_reason": "reason"
      }
    }
  ],
  "shipping_info": null,
  "items_info": null,
  "document_info": {
    "document_id": 3454540850
  },
  "marketplace_info": {
    "marketplace": "MP"
  },
  "currency_info": {
    "currency_id": "BRL"
  }
}
```

### Campos de respuesta Mercado Libre:

- charge_info: información del cobro.  legal_document_number: número del documento. legal_document_status: estado de generación del documento.  Valores posibles: PROCESSING, PROCESSED.   legal_document_status_description: descripción internacionalizada del estado del legal_document_status. creation_date_time: fecha de creación del cobro. detail_id: identificador del cobro. transaction_detail: detalle del cobro. debited_from_operation: indica si fue debitado de la operación.  Valores posibles: YES, NO, INAPPLICABLE.   debited_from_operation_description: descripción internacionalizada del campo debited_from_operation. status: estado del cobro.  Valores posibles:  BONUS_ON_CREDIT_NOTE, BONUS_PART_ON_CREDIT_NOTE, BONUS_ON_BILL, BONUS_PART_ON_BILL, BONUS_ON, BONUS_PART_ON.     status_description: descripción internacionalizada de status. charge_bonified_id: identificador del cobro que bonifica. detail_amount: valor del cobro. detail_type: tipo de detalle.  Valores posibles:   detail_sub_type: subtipos de detalles.  Valores posibles:

- discount_info: información sobre descuentos.  applied_percentage: porcentaje aplicado para calcular el valor del cobro. [Exclusivo para Argentina] charge_amount_without_discount: valor del cobro sin descuento. discount_amount: valor del descuento. discount_reason: motivo del descuento. rebate: valor del descuento por participación en campaña comercial.

- sales_info: información de las ventas.  order_id: identificador de la venta. operation_id: identificador del pago. sale_date_time: fecha y hora de la venta. sales_channel: canal de venta. payer_nickname: cliente. state_name: estado. transaction_amount: valor total de la venta. financing_fee: diferenciación en el precio conforme a la cantidad de cuotas elegidas por el comprador [Exclusivo para Brasil]. financing_transfer_total: valor total pagado por el cliente por el producto [Exclusivo para Brasil]. sale_fee: información sobre la tarifa de la venta (Exclusivo para Brasil).  gross: valor del cobro sin descuento. net: valor del cobro. rebate: valor del descuento por participación en campaña comercial. discount: valor del descuento. discount_reason: motivo del descuento.

- shipping_info: información del envío.  shipping_id: identificador del envío. pack_id: identificador del paquete. receiver_shipping_cost: flete a cargo del cliente.

- items_info: información sobre los anuncios.  item_id: identificador del anuncio. item_kit_id: identificador del kit. [Disponible solo para Argentina, Brasil y México] item_title: título del anuncio.  Kits Virtuales: En caso de que un producto pertenezca a un kit, el nombre del item se concatena con Producto en Kit: <nombre del kit>. [Disponible solo para Argentina, Brasil y México]   item_type: tipo de anuncio. item_category: categoría del anuncio. inventory_id: código de Mercado Libre. item_amount: cantidad de items vendidos. item_price: precio unitario del item. order_id: order a la cual pertenece el item. fees_added_in_publication: indica si el anuncio ofrece financiación. [Disponible solo para Argentina]

- document_info: información del documento.  document_id: número Id del documento.

- marketplace_info: información del marketplace.  marketplace: nombre del marketplace.

- currency_info: información de la moneda conforme al site_id.  currency_id: identificador de la moneda conforme al site_id.

- store_info: información de la filial.  store_id: identificador de la filial. [Disponible solo para MLM, MLC, MCO y MLA] store_name: nombre de la filial. [Disponible solo para MLM, MLC, MCO y MLA]

## Reportes de Facturación por Orders y Packs

Este endpoint te permite obtener los reportes de facturación por el filtro de orders y packs.

### Llamada:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/group/ML/order/details?order_ids=$ORDER_ID
```

### Parámetros de consulta:

- order_ids: Permite buscar por uno o varios ids de order. **Límite máximo:**  60 order_ids por consulta.

- pack_id: Permite buscar por un id de pack.

- sort_by:  Valores posibles: ID y DATE; Valor por defecto: ID

- order_by: Permite ordenar la búsqueda.  Valores posibles: ASC, DESC; Valor por defecto: ASC

### Ejemplo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/group/ML/order/details?order_ids=1234567890000
```

### Respuesta:

```

{
  "offset": 0,
  "limit": 150,
  "total": 1,
  "results": [
    {
      "order_id": 1234567890000,
      "payment_info": [
        {
          "payment_id": 99999999999,
          "date_approved": "2024-04-23T03:11:47",
          "date_created": "2024-04-23T03:11:43",
          "money_release_date": "2024-05-02T19:40:45",
          "money_release_days": 28,
          "money_release_status": "released",
          "payer_id": 12345678,
          "payment_method_id": "visa",
          "payment_type_id": "credit_card",
          "status": "approved",
          "status_details": null,
          "tax_details": [
            {
              "from": "collector",
              "to": "mp",
              "original_amount": 2018.99,
              "refunded_amount": 0,
              "mov_detail": "tax_withholding",
              "mov_financial_entity": "retencion_ganancias",
              "tax_id": 9999999997,
              "tax_status": "applied"
            },
            {
              "from": "collector",
              "to": "mp",
              "original_amount": 6056.97,
              "refunded_amount": 0,
              "mov_detail": "tax_withholding",
              "mov_financial_entity": "retencion_iva",
              "tax_id": 9999999998,
              "tax_status": "applied"
            },
            {
              "from": "collector",
              "to": "mp",
              "original_amount": 1211.39,
              "refunded_amount": 0,
              "mov_detail": "tax_withholding_collector",
              "mov_financial_entity": "debitos_creditos",
              "tax_id": 9999999999,
              "tax_status": "applied"
            },
            {
              "from": "collector",
              "to": "mp",
              "original_amount": 201.9,
              "refunded_amount": 0,
              "mov_detail": "tax_withholding_sirtac",
              "mov_financial_entity": "cordoba",
              "tax_id": 9999999990,
              "tax_status": "applied"
            }
          ]
        }
      ],
      "sale_fee": {
        "gross": 120,
        "net": 100,
        "rebate": 20,
        "discount": 0,
        "discount_reason": null
      },
      "details": [
        {
          "charge_info": {
            "legal_document_number": "0011A03800000",
            "legal_document_status": "PROCESSED",
            "legal_document_status_description": "Procesado",
            "creation_date_time": "2024-04-22T23:12:02",
            "detail_id": 5555566666,
            "transaction_detail": "Cargo por venta",
            "debited_from_operation": "YES",
            "debited_from_operation_description": "Si",
            "status": null,
            "status_description": null,
            "charge_bonified_id": null,
            "detail_amount": 28265.86,
            "detail_type": "CHARGE",
            "detail_sub_type": "CV"
          },
          "discount_info": {
            "charge_amount_without_discount": 28265.86,
            "discount_amount": 0,
            "discount_reason": "Descuento general",
            "applied_percentage": 14,
            "rebate": null
          },
          "sales_info": [
            {
              "order_id": 1234567890000,
              "operation_id": 99999999999,
              "sale_date_time": "2024-04-22T23:11:42",
              "sales_channel": "Mercado Libre",
              "payer_nickname": "NICKNAME",
              "state_name": "Córdoba",
              "transaction_amount": 201899,
              "financing_transfer_total": 102.75,
              "financing_fee": 2.75
            }
          ],
          "shipping_info": {
            "shipping_id": "5555566666",
            "pack_id": null,
            "receiver_shipping_cost": null
          },
          "items_info": [
            {
              "item_id": "MLA920316309",
              "item_title": "Calefactor A Gas Eskabe Miniconvex 5000 S21p Marfil Clase A",
              "item_type": "gold_special",
              "item_category": "Electrodomésticos y Aires Ac. > Climatización > Estufas y Calefactores > A Gas",
              "inventory_id": null,
              "item_amount": 1,
              "item_price": 201899,
              "order_id": 1234567890000,
              "fees_added_in_publication": "No"
            }
          ],
          "document_info": { "document_id": 5555566666 },
          "marketplace_info": { "marketplace": "CORE" },
          "currency_info": { "currency_id": "ARS" }
        },
        {
          "charge_info": {
            "legal_document_number": "0011A03800000",
            "legal_document_status": "PROCESSED",
            "legal_document_status_description": "Procesado",
            "creation_date_time": "2024-04-22T23:12:02",
            "detail_id": 5555566666,
            "transaction_detail": "Cargo por Mercado Envíos",
            "debited_from_operation": "YES",
            "debited_from_operation_description": "Si",
            "status": null,
            "status_description": null,
            "charge_bonified_id": null,
            "detail_amount": 9380.99,
            "detail_type": "CHARGE",
            "detail_sub_type": "CXD"
          },
          "discount_info": {
            "charge_amount_without_discount": 18761.99,
            "discount_amount": 9381,
            "discount_reason": "Descuento general",
            "rebate": null
          },
          "sales_info": [
            {
              "order_id": 1234567890000,
              "operation_id": 99999999999,
              "sale_date_time": "2024-04-22T23:11:42",
              "sales_channel": "Mercado Libre",
              "payer_nickname": "NICKNAME",
              "state_name": "Córdoba",
              "transaction_amount": 201899
            }
          ],
          "shipping_info": {
            "shipping_id": "5555566666",
            "pack_id": null,
            "receiver_shipping_cost": 0
          },
          "items_info": [
            {
              "item_id": "MLA920316309",
              "item_title": "Calefactor A Gas Eskabe Miniconvex 5000 S21p Marfil Clase A",
              "item_type": "gold_special",
              "item_category": "Electrodomésticos y Aires Ac. > Climatización > Estufas y Calefactores > A Gas",
              "inventory_id": null,
              "item_amount": 1,
              "item_price": 201899,
              "order_id": 1234567890000,
              "fees_added_in_publication": "No"
            }
          ],
          "document_info": { "document_id": 5555566666 },
          "marketplace_info": { "marketplace": "SHIPPING" },
          "currency_info": { "currency_id": "ARS" }
        }
      ]
    }
  ]
}
```

### Parámetros de respuesta

- order_id: Identificador de la venta.

- payment_info: Información del pago.  payment_id: Identificador del pago. date_approved: Fecha de aprobación. date_created: Fecha de creación. money_release_date: Fecha de liberación del pago. money_release_days: Días para la liberación del pago. money_release_status: Estado de la liberación del pago. payer_id: Identificador del cliente. payment_method_id: Método de pago. payment_type_id: Tipo de medio de pago. status: Estado del pago. status_details: Detalles del estado del pago. tax_details: Detalles de impuestos.

- details: Detalles de cobros.  charge_info: Información del cobro. discount_info: Información sobre descuentos. sales_info: Información sobre la venta. shipping_info: Información del envío. items_info: Información del anuncio. document_info: Información del documento. marketplace_info: Información del marketplace. currency_info: Información de la moneda conforme al site_id.

- sale_fee: Información sobre la tarifa de la venta (Exclusivo para Brasil).  gross: Valor del cobro sin descuento. net: Valor del cobro. rebate: Valor del descuento por participación en campaña comercial. discount: Valor del descuento. discount_reason: Motivo del descuento.

## Enlaces útiles

### 1. Valores a recibir

- **[GET /orders](https://developers.mercadolibre.com.ar/es_ar/gestion-de-ventas)** : datos del pedido.  **unit_price** : valor unitario del item con el descuento "de/por" ya aplicado. **quantity** : cantidad de items del pedido. **sale_fee** : tarifa por unidad. **marketplace_fee** : tarifa totalizada en el pedido.

- **[GET /packs](https://developers.mercadolibre.com.ar/es_ar/gestion-packs)** : identificar las orders dentro de un pack.  **orders_ids** : identificadores de los pedidos que componen el pack.

- **[GET /shipments](https://developers.mercadolibre.com.ar/es_ar/envios)** : identificar el costo de envío.  **seller.cost** : costo de envío subsidiado por el vendedor.

**Ejemplo de cálculo simplificado:** 
 (unit_price * quantity) - marketplace_fee - seller.cost = valor neto del pedido.

### 2. Costos y descuentos aplicados

- **[GET /orders/{order_id}/discounts](https://developers.mercadolibre.com.ar/es_ar/gestion-de-ventas#Obtener-descuentos-aplicados)** : información de descuentos y campañas aplicadas al pedido.  **discounts** , **coupon** : tipos de descuentos aplicados. **supplier** : proveedor de la campaña. **meli_campaign** : campaña de descuentos asociada al cupón. **offer_id** : identificador de la oferta (útil para rastrear la promoción). **funding_mode** : tipo de promoción (ej.: sale_fee). **amounts.total** : valor total del descuento (parte MELI + parte vendedor).

- **GET /items/{item_id}/sale_price** : identificar el precio de venta aplicado a un item.  **amount** : precio vigente del producto (ya con descuento). **regular_amount** : precio original antes de la promoción. **metadata.promotion_id** : identificador de la promoción asociada. **metadata.promotion_type** : tipo de la promoción (ej.: custom, deal).

- **GET /seller-promotions/offers/{offer_id}** : identificar cambios y estado de las ofertas promocionales.  **promotion_id** : ID de la promoción asociada. **type** : tipo de la promoción (ej.: DEAL). **status.id** : estado actual de la promoción (ej.: ACTIVE, FINISHED).

### 3. Conciliación financiera

La conciliación se realiza a partir de la combinación de los siguientes recursos:

- GET /orders

- GET /orders/{id}/discounts

- GET /shipments

- GET /packs

El cálculo consolidado considera:

- Valor del item (unit_price * quantity).

- Tarifas (sale_fee, marketplace_fee).

- Costos de envío (seller.cost).

- Descuentos aplicados (discounts, coupon).

**Resultado:**  Visión consolidada de los valores netos a recibir por pedido o pack.

## Mercado Pago

Verás el detalle de los cobros facturados con información complementaria sobre la operación de Mercado Pago, como los movimientos, medios de pago, payer, filial, punto de venta, entre otros.

### Llamada:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 

https://api.mercadolibre.com/billing/integration/periods/key/$KEY/group/MP/details
```

### Ejemplo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2024-05-01/group/MP/details?document_type=BILL&limit=1
```

### Respuesta:

```
{
  "offset": 0,
  "limit": 1,
  "total": 1,
  "results": [
    {
      "charge_info": {
        "legal_document_number": "0029A01508173",
        "legal_document_status": "PROCESSED",
        "legal_document_status_description": "Procesado",
        "detail_id": 24168819712,
        "movement_id": "199835301597",
        "transaction_detail": "Cargo de Mercado Pago",
        "debited_from_operation": "INAPPLICABLE",
        "debited_from_operation_description": "No aplica",
        "status": "BONUS_ON_BILL",
        "status_description": "Anulado en factura",
        "charge_bonified_id": null,
        "creation_date_time": "2023-07-19T07:29:02",
        "detail_amount": 3122.76,
        "detail_type": "CHARGE",
        "detail_sub_type": "CCMP"
      },
      "operation_info": {
        "operation_type": "BUY",
        "operation_type_description": "Pago",
        "reference_id": 60833750481,
        "sales_channel": "Checkout",
        "store_id": null,
        "store_name": null,
        "external_reference": "385080",
        "payer_nickname": "SALADO1958",
        "financing_fee": 9.2,
        "financing_transfer_total": 109.2,
        "transaction_amount": 73999
      },
      "perception_info": {
        "aliquot": null,
        "taxable_amount": null
      },
      "document_info": {
        "document_id": 2589999426
      },
      "marketplace_info": { "marketplace": "MP" },
      "currency_info": { "currency_id": "ARS" }
    }
  ]
}
```

### Campos de respuesta:

- charge_info: información del cobro.  legal_document_number: número del documento. detail_id: identificador del cobro. legal_document_status: estado de generación del documento.  **Valores posibles:**  PROCESSING, PROCESSED, NOT_APPLICABLE.   legal_document_status_description: descripción internacionalizada. movement_id: número del movimiento. transaction_detail: detalle. debited_from_operation:  **Valores posibles:**  YES, NO, INAPPLICABLE.   debited_from_operation_description: descripción internacionalizada. status: estado del cobro.  **Valores posibles:**  BONUS_ON_CREDIT_NOTE, BONUS_PART_ON_CREDIT_NOTE, BONUS_ON_BILL, BONUS_PART_ON_BILL, BONUS_ON, BONUS_PART_ON.   status_description: descripción internacionalizada de status. charge_bonified_id: identificador del cobro que bonifica. creation_date_time: fecha del cobro. detail_amount: valor del cobro. detail_type: tipo de detalle. detail_sub_type: subtipos de detalles.

- operation_info: información de la operación sobre la cual se aplica.  operation_type: tipo de operación.  **Valores posibles:**  BUY, TAX.   operation_type_description: descripción internacionalizada. reference_id: número de la operación relacionada. sales_channel: tipo de pago. store_id: número de la filial. store_name: nombre de la filial. external_reference: número de referencia externa. payer_nickname: cliente. financing_fee / financing_transfer_total: Exclusivo para Brasil. transaction_amount: valor de la operación.

- perception_info: información de percepción.  aliquot: alícuota. taxable_amount: valor gravable.

- document_info: información del documento (document_id).

- marketplace_info: información del marketplace.

- currency_info: información de la moneda (currency_id).

## Mercado Envíos Flex

Importante:

Disponible en MLA, MLC y MCO.

Verás el detallamiento para verificar las bonificaciones y anulaciones de Flex para un período específico, el grupo de facturación Mercado Libre y el tipo de documento (nota de débito o nota de crédito). Además, información sobre el envío e información de la venta.

### Llamada:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/group/ML/flex/details
```

### Ejemplo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2023-03-01/group/ML/flex/details?document_type=BILL&limit=1
```

### Respuesta:

```
{
  "offset": 0,
  "limit": 1,
  "total": 100,
  "results": [{
    "charge_info": {
      "legal_document_number": "00AA11AA00",
      "legal_document_status": "PROCESSED",
      "legal_document_status_description": "Procesado",
      "creation_date_time": "2023-02-21T12:35:58",
      "detail_id": 2020202020,
      "detail_associated_id": 4040404040,
      "detail_amount": 163,
      "transaction_detail": "Anulación de bonificación por Mercado Envíos Flex",
      "detail_type": "CHARGE",
      "detail_sub_type": "CFLX",
      "concept_type": "FLEX"
    },
    "shipping_info": {
      "shipping_id": 4444455555,
      "receiver_nickname": "NICKNAME",
      "pack_id": "12345678",
      "receiver_shipping_cost": 814.99,
      "order": {
        "order_id": 9000000008888888,
        "date_created": "2023-02-15T11:54:51",
        "total_amount": 29499,
        "payment_id": 998899889988,
        "buyer_nickname": "NICKNAME"
      }
    },
    "document_info": { "document_id": 776677667711 }
  }],
  "errors": []
}
```

### Campos de respuesta:

- charge_info: información del cobro.  legal_document_number: número del documento. legal_document_status: estado de generación del documento.  **Valores posibles:**  PROCESSING, PROCESSED.   legal_document_status_description: descripción internacionalizada del estado del legal_document_status. creation_date_time: fecha de creación del cobro. detail_id: identificador del cobro. detail_associated_id: identificador del cobro asociado (en caso de anulación de bonificación). detail_amount: valor del cobro. transaction_detail: detalle del cobro. detail_type: tipo de detalle. detail_sub_type: subtipos de detalles. concept_type: tipo de concepto.

- shipping_info: información sobre envío.  shipping_id: identificador del envío. receiver_nickname: cliente. pack_id: número del paquete. receiver_shipping_cost: costo del envío.

- order: información de la venta.  order_id: identificador de la venta. date_created: fecha de la order. total_amount: total de la order. payment_id: identificador del pago. buyer_nickname: cliente.

- document_info: información del documento.  document_id: id del documento.

## Fulfillment

Importante:

Disponible en MLA, MLB, MLM, MCO y MLC.

Verás los cobros y bonificaciones por recolección y/o almacenamiento para un período específico, el grupo de facturación Mercado Libre y el tipo de documento (nota fiscal o nota de crédito). También información del producto almacenado o recolectado. Los tipos de cobros para el reporte de Fulfillment pueden ser por: retirada de estoque, almacenamiento prolongado, servicio de recolección, incumplimiento, almacenamiento.

### Llamada:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/group/ML/full/details
```

### Ejemplo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2023-03-01/group/ML/full/details?document_type=BILL&limit=1
```

### Respuesta:

```
{
  "offset": 0,
  "limit": 100,
  "total": 634,
  "results": [{
    "charge_info": {
      "legal_document_number": "000AAA00000000",
      "legal_document_status": "PROCESSED",
      "legal_document_status_description": "Procesado",
      "creation_date_time": "2021-07-23T16:37:58",
      "detail_id": 11111111111,
      "detail_amount": 2.54,
      "transaction_detail": "Cargo por servicio de recolección Full",
      "charge_bonified_id": null,
      "detail_type": "CHARGE",
      "detail_sub_type": "CFCB",
      "concept_type": "FULFILLMENT",
      "payment_id": 222222222
    },
    "fulfillment_info": {
      "type": "WITHDRAWAL",
      "amount": 2.54,
      "sku": "3125404000009",
      "ean": "3125404000009",
      "item_id": "MLM788740252",
      "item_title": "VESTIDO CORTO AZUL MARINO BORDADO EN PECHO DEVENDI",
      "variation": "AZUL MARINO | EG",
      "quantity": 1,
      "volume_type": null,
      "inventory_id": "LLLGGKK12",
      "inbound_id": 555555,
      "volume_unit": "large",
      "amount_per_volume_unit": 500,
      "volume": 0.00507,
      "volume_total": 0.00507
    },
    "document_info": { "document_id": 333333333 }
  }],
  "errors": []
}
```

### Campos de respuesta Mercado Envíos Fulfillment:

- charge_info: información del cobro.  legal_document_number: número del documento. legal_document_status: estado de generación del documento.  **Valores posibles:**  PROCESSING, PROCESSED.   legal_document_status_description: descripción internacionalizada del estado del legal_document_status. creation_date_time: fecha de creación del cobro. detail_id: identificador del cobro. detail_associated_id: identificador del cobro asociado (en caso de anulación de bonificación). detail_amount: valor del cobro. transaction_detail: detalle del cobro. detail_type: tipo de detalle. detail_sub_type: subtipos de detalles. concept_type: tipo de concepto.

Importante:

[SOLO MLC y MLA] Para `fulfillment_info` con `type` = `WITHDRAWAL`, el campo `amount_per_unit` será removido.
 El campo `volume_type` ahora puede tener los siguientes valores: small, medium, large, extralarge.

- fulfillment_info: información de fulfillment.  type: tipo de fulfillment.  **Valores posibles:**  WITHDRAWAL, AGING, INBOUND_COLLECT, INBOUND_PENALTY, WAREHOUSING, OVERAGE, SPACE_PURCHASE, SPACE_CANCELLATION.   amount_per_unit: valor por unidad. amount: valor total. sku: stock keeping unit. item_id: número del anuncio. item_title: título del anuncio. variation: variante del producto. quantity: unidades almacenadas o recolectadas. volume_type: tamaño de la unidad. inventory_id: código del inventario del ML. withdrawal_id: número de la retirada – TYPE WITHDRAWAL: Cobro por retirada de estoque. shipment_type: forma de retirada – TYPE WITHDRAWAL: Cobro por retirada de estoque. volume_unit: unidad de medida (m3) – TYPE WITHDRAWAL: Cobro por retirada de estoque. amount_per_volume_unit: valor por m3 – TYPE WITHDRAWAL: Cobro por retirada de estoque. volume: volumen unitario (cm3) – TYPE WITHDRAWAL: Cobro por retirada de estoque. volume_total: volumen total – TYPE WITHDRAWAL: Cobro por retirada de estoque. months_range: antigüedad en meses – TYPE AGING: Cobro por almacenamiento prolongado. stock_details: detalles del estoque – TYPE AGING: Cobro por almacenamiento prolongado. quantity: cantidad en estoque – TYPE AGING: Cobro por almacenamiento prolongado. inventory_status: estado del inventario – TYPE AGING: Cobro por almacenamiento prolongado. inbound_id: número del envío – TYPE INBOUND_COLLECT: Cobro por servicio de recolección / TYPE INBOUND_PENALTY: Cobro por incumplimiento. volume_unit: unidad de medida (m³) – TYPE INBOUND_COLLECT: Cobro por servicio de recolección. amount_per_volume_unit: valor por m³ – TYPE INBOUND_COLLECT: Cobro por servicio de recolección. volume: volumen unitario (cm³) – TYPE INBOUND_COLLECT: Cobro por servicio de recolección. volume_total: volumen total – TYPE INBOUND_COLLECT: Cobro por servicio de recolección. penalty_type: tipo de incumplimiento – TYPE INBOUND_PENALTY: Cobro por incumplimiento. warehouse_id: identificador del warehouse – TYPE WAREHOUSING: Cobro por almacenamiento. size: tamaño de la unidad – TYPE WAREHOUSING: Cobro por almacenamiento. item_quantity: unidades almacenadas – TYPE WAREHOUSING: Cobro por almacenamiento. space: indica el tipo de espacio que se compra o cancela – TYPE SPACE_PURCHASE / SPACE_CANCELLATION.  **Valores posibles (2 espacios):**  Pequeños y medianos, Grandes y extra grandes. **Valores posibles (1 espacio):**  Almacenamiento.

- document_info: información del documento.  document_id: ID del documento.

## Insurtech

Importante:

Disponible en MLA, MLB, MLC y MLM.

Verás el detallamiento para verificar los cobros y bonificaciones de las garantías aplicadas sobre los productos para un período específico, el grupo de facturación Mercado Libre y el tipo de documento (Nota Fiscal o Nota de Crédito).

### Llamada:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 

https://api.mercadolibre.com/billing/integration/periods/key/$KEY/group/ML/insurtech/details
```

### Ejemplo:

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2022-10-01/group/ML/insurtech/details?document_type=BILL&limit=1
```

### Respuesta:

```
{
  "offset": 0,
  "limit": 150,
  "total": 1,
  "results": [
    {
      "charge_info": {
        "legal_document_number": "001112131415",
        "legal_document_status": "PROCESSED",
        "legal_document_status_description": "Procesado",
        "creation_date_time": "2022-10-04T22:24:18",
        "detail_id": 123456,
        "detail_amount": 520.01,
        "transaction_detail": "Cargo por seguro de garantía extendida",
        "status": null,
        "status_description": null,
        "charge_bonified_id": null,
        "detail_type": "CHARGE",
        "detail_sub_type": "CEW",
        "concept_type": "WARRANTY"
      },
      "warranty_info": {
        "warranty_id": "11111111-43c2-44ea-8436-00000000",
        "certificate_id": "MLA999999",
        "warranty_product": "GAREX",
        "buyer_nickname": "TEST",
        "order": {
          "order_id": 102030405060,
          "order_items": [
            {
              "listing_type_id": "gold_special",
              "item": {
                "item_id": "MLA88888888",
                "category_id": "MLA1234",
                "category_name": "Auriculares"
              }
            }
          ]
        },
        "quote_model": null,
        "quote_brand": null,
        "quote_description": ""
      },
      "prepaid_info": {
        "operation_id": 55558888,
        "movement_id": 123456789,
        "doc_id": 11111111111,
        "payment": {
          "payment_id": 5555555555,
          "date_created": "2022-10-04T22:23:40",
          "transaction_amount": 736.98,
          "money_release_date": "2023-03-03T22:23:41"
        }
      },
      "document_info": { "document_id": 3333333333 }
    }
  ]
}
```

### Campos de respuesta Insurtech:

- charge_info: información del cobro.  legal_document_number: número del documento. legal_document_status: estado de generación del documento.  **Valores posibles:**  PROCESSING, PROCESSED.   legal_document_status_description: descripción internacionalizada del estado del legal_document_status. creation_date_time: fecha de creación del cobro. detail_id: identificador del cobro. detail_amount: valor del cobro. transaction_detail: detalle del cobro. status: estado del cobro.  **Valores posibles:**  BONUS_ON_CREDIT_NOTE, BONUS_PART_ON_CREDIT_NOTE, BONUS_ON_BILL, BONUS_PART_ON_BILL, BONUS_ON, BONUS_PART_ON.   status_description: descripción internacionalizada de status. charge_bonified_id: identificador del cobro que bonifica. detail_type: tipo de detalle. detail_sub_type: subtipos de detalles. concept_type: tipo de concepto.

- warranty_info: información de la garantía.  warranty_id: identificador de la garantía. certificate_id: identificador del certificado. warranty_product: tipo de garantía.  **Valores posibles:**  CARDS, GAREX, RODA.   buyer_nickname: número del comprador. buyer_state_name: estado del comprador. order: información de la order.  order_id: identificador de la order. order_items: lista de items de la order. listing_type_id: tipo de anuncio. item: información del item (item_id, title, category_id, category_name).   quote_model: modelo del producto. Se aplica a RODA. quote_brand: marca del producto. Se aplica a RODA. quote_description: descripción adicional. Se aplica a RODA.

- prepaid_info: información del prepago.  operation_id: identificador de la operación. movement_id: identificador del movimiento. doc_id: identificador del documento. payment: información del pago.  payment_id: identificador del pago. date_created: fecha del pago. transaction_amount: valor del pago. money_release_date: fecha de liberación del dinero.

- document_info: información del documento.  document_id: ID del documento.

**Siguiente** : [Pagos](https://developers.mercadolibre.com.ar/latam/reportes-facturacion/pagos).
