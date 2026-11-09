<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/envios-fulfillment -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Envíos Fulfillment

Última actualización 05/10/2026

## Envíos Fulfillment

**Importante:**

Actualmente, esta modalidad de envío está disponible para vendedores de Argentina, Brasil, México, Chile y Colombia.

Envíos Full es un servicio integral de Mercado Libre diseñado para simplificar y optimizar la gestión logística de los vendedores. Con Envíos Full, no solo nos encargamos de tus envíos, sino que también almacenamos tu stock y preparamos cada pedido para su envío inmediato al concretar una venta.

Conoce más sobre:

- [Qué es Envíos Full](https://www.mercadolibre.com.ar/ayuda/que-es-mercado-envios-full_5162)

- [Cómo planificar tus envíos a Full](https://vendedores.mercadolibre.com.ar/nota/guia-para-tus-envios-a-full/)

- [Cómo gestionar tu stock de Full](https://www.mercadolibre.com.ar/ayuda/16958)

- [Cómo envío mi stock a Full](https://www.mercadolibre.com.ar/ayuda/Guia-para-tu-primer-envio-de-stock-a-Full_5163)

- [Cómo retirar productos de Full](https://www.mercadolibre.com.ar/ayuda/15999)

- [Cuáles son los costos de Full](https://www.mercadolibre.com.ar/ayuda/20522)

- [Cómo pagar los cargos de Full](https://www.mercadolibre.com.ar/ayuda/17597)

- [Cargos por descartar stock de Full](https://www.mercadolibre.com.ar/ayuda/21881)

- [Cómo ofrecer Envíos Flex y Full en la misma publicación](https://www.mercadolibre.com.ar/ayuda/ofrecer-Flex-y-Full_4980)

- [Qué productos está prohibido enviar a Full](https://www.mercadolibre.com.ar/ayuda/5200)

- [Cuáles son los beneficios de usar Envíos Full](https://www.mercadolibre.com.ar/ayuda/cual-es-el-costo-de-usar-mercado-envios-full_5171)

## Obtener el inventory_id

Para consultar el stock y las operaciones del ítem en fulfillment, primero debes obtener el inventory_id que es el código que identifica al ítem cuando está en fulfillment. Para esto consulta el inventory_id a través del recurso de /items.

Nota:

Cuando el artículo tenga variaciones, tendrá una identificación **inventory_id**  por variación.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLB1557246024
```

Respuesta:

```
{
  "id": "MLB1557246024",
  "site_id": "MLB",
  "title": "Kit Capa Chuva Test 228",
  "subtitle": null,
  "seller_id": 384324657,
  "category_id": "MLB22675",
  "official_store_id": null,
  "price": 87,
  "base_price": 87,
  "original_price": null,
  "inventory_id": "LCQI05831",
  "currency_id": "BRL",
  "initial_quantity": 50,
  "available_quantity": 50,
  "sold_quantity": 0,
  "sale_terms": []
}
```

## Consultar el stock del vendedor

Además, puedes consultar el stock total de un vendedor en todos los depósitos de Fulfillment y conocer el estado de las piezas no disponibles.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/inventories/$INVENTORY_ID/stock/fulfillment
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/inventories/LCQI05831/stock/fulfillment
```

Respuesta:

```
{
    "inventory_id": "LCQI05831",
    "total": 20,
    "available_quantity": 5,
    "not_available_quantity": 15,
    "not_available_detail":[
        {
            "status": "damage",
            "quantity": 2
        },
        {
            "status": "lost",
            "quantity": 1
        },
        {
            "status": "noFiscalCoverage"
            "quantity": 5
        },
        {
            "status": "withdrawal",
            "quantity": 5
        },
        {
            "status": "internal_process",
            "quantity": 1
        },
        {
            "status": "transfer",
            "quantity": 1
        }
    ],
    "external_references": [
        {
        "type": "item",
        "id": "MLB1557246024",
        "variation_id": 4742223403
      }
   ]
}
```

### Campos de la respuesta

**total** : es la suma de los campos available_quantity y not_available_quantity.
 **available_quantity** : cantidad de ítems disponibles para la venta.
 **not_available_quantity** : total de ítems que no se encuentran disponibles para la venta.
 **not_available_detail** : detalle del status de los ítems que no se encuentran disponibles.

- **damaged** : total de ítems dañados (incluye damaged seller, meli y carrier).

- **lost** : total de ítems que se perdieron y no fueron encontrados.

- **withdrawal** : total de ítems reservados para retiro.

- **internal_process** : total de ítems reservados por procesos de calidad del depósito.

- **transfer** : total reservado para ser transferido de depósito.

- **noFiscalCoverage** : total de ítems que no se encuentran a la venta por no poseer cobertura fiscal.

- **not_supported** : todos los ítems ingresados son no identificables o no procesables.

**external_references**

: información de la relación del inventory con la publicación de marketplace, y una identificación del tipo.

**type**

: tipo de relación entre la publicación y el stock almacenado.

**id**

: identificador del ítem relacionado con el inventory.

**variation_id**

: identificador de la variación asociada al inventory.

### Manejo de errores

Respuesta con error:

```
{
    "status": 403,
    "error": "forbidden",
    "message": "User 281349747 cannot access to seller_product ESZJ28231",
    "cause": []
}
```

### Posibles errores

| Status | Mensaje | Error | Descripción |
| --- | --- | --- | --- |
| 404 | Inventory not found with id: ESZJ28232 | seller_product_not_found | No se encuentra el vendedor product solicitado |
| 400 | The field inventory_id has an invalid value | validation_error | Parámetro inválido |
| 403 | The caller is not authorized to access this resource | forbidden | El caller no está autorizado a acceder al recurso |
| 401 | No autorizado | unauthorized | El caller no está autenticado en la plataforma |
| 429 | Too many request | too_many_request | El usuario ha superado el número de request permitidas por minuto |
| 500 | Internal server error | internal_error | Error interno al obtener la información |

## Consultar detalle del stock no disponible

Este recurso devuelve información adicional sobre las unidades almacenadas en full que no están disponibles a la venta, describiendo ciertos atributos o condiciones particulares de estas.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/inventories/$INVENTORY_ID/stock/fulfillment?include_attributes=conditions
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/inventories/YLXH33638/stock/fulfillment?include_attributes=conditions
```

Respuesta:

```
{
  "inventory_id": "YLXH33638",
  "total": 20,
  "available_quantity": 5,
  "not_available_quantity": 15,
  "not_available_detail": [
    {
      "status": "damaged",
      "quantity": 2,
      "conditions": [
        {
          "condition": "arrived_damaged",
          "quantity": 1
        },
        {
          "condition": "damaged_in_full",
          "quantity": 1  (meli+carrier)
        }
      ]
    },
    {
      "status": "lost",
      "quantity": 1
    },
    {
      "status": "not_supported",
      "quantity": 3,
      "conditions": [
        {
          "condition": "dimensions_exceeds",
          "quantity": 1
        },
        {
          "condition": "flammable",
          "quantity": 1
        },
        {
          "condition": "multiple_identifier",
          "quantity": 1
        }
      ]
    }
  ]
}
```

Los posibles status son damaged, not_supported, lost, withdrawal, no_fiscal_coverage, internal_process y transfer.

Los status con información adicional son:

**Damaged** : Brinda información sobre las unidades dañadas almacenadas en el depósito que permite a los integradores accionar según se trate de dañados en full o si llegaron dañados.
 **Not supported** : Brinda información de productos not supported (NS) en stock, es decir, productos que no pueden ponerse a la venta por algún problema de identificación o por pertenecer a categorías no aptos.

Conoce las condiciones por las cuales identificamos un producto como dañado o no cumple con los requisitos para ingresar al centro de Fulfillment. También aplica para productos ingresados y que posteriormente detectamos un problema.

| Status Not available | Condition | Descripción del producto |
| --- | --- | --- |
| **damaged** | arrived_damaged | Llegó dañado por el vendedor |
| damaged_in_full | Está dañado dentro del depósito o por el transportista (carrier) |  |
| **not supportted** | dimensions_exceeds | Excede las dimensiones de almacenamiento permitidas del centro de Fulfillment |
| expiration_problem | Tuvo un problema relacionado a su caducidad |  |
| package_problem | No tiene packaging o este no es apropiado para el centro de Fulfillment |  |
| flammable | Es inflamable o explosivo |  |
| regulation_problem | No cumple las regulaciones por el tipo de producto, por ejemplo, sello sanidad |  |
| other | Toda condición no especificada en los puntos anteriores |  |
| multiple_identifier | Tiene el código universal duplicado (EAN) |  |
| empty_identifier | No tiene identificación/etiqueta del vendedor o no tiene EAN en la base de datos del centro de Fulfillment |  |
| multiple_sku | Tiene dos o más SKUs de Mercado Libre |  |
| invalid_identifier | Tiene el código universal incorrecto |  |
| return_problem | Fue devuelto por el comprador por no cumplir con la calidad especificada en la venta |  |

## Consultar operaciones

Obtén el listado de las operaciones de stock para un inventory_id en particular.

Nota:

Recuerdas que solo disponemos de la información correspondiente a los últimos 12 meses, considerando el día actual de la consulta.

### Parámetros

**inventory_id** : lista de identificadores separados por coma.
 **seller_id** : identificador del vendedor.
 **date_from** : fecha de inicio de la búsqueda. Si no lo defines en el GET, por default son 15 días.
 **date_to** : fecha final de búsqueda. Si no lo defines en el GET, por default es la fecha actual.
 **type** : tipo de operación (inbound_reception, sale_confirmation, etc.)
 **external_references**

- **external_references.shipment_id** : identificador del envío al comprador.

**limit** : cantidad de registros a devolver por “página” de resultados.
 **sort** : identificador del campo y orden de búsqueda.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/stock/fulfillment/operations/search?seller_id=$SELLER_ID&inventory_id=$INVENTORY_ID&date_from=$aaaa-mm-dd&date_to=$aaaa-mm-dd
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/stock/fulfillment/operations/search?seller_id=384324657&inventory_id=DEHW09303&date_from=2020-06-01&date_to=2020-06-30
```

Ejemplo con filtros:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/stock/fulfillment/operations/search?seller_id=384741716&inventory_id=NFWV18668&date_from=2020-06-29&date_to=2020-07-28&type=SALE_CONFIRMATION&external_references.shipment_id=1111?
```

Respuesta:

```
{
    "paging": {
        "total": 4,
        "scroll": ""
    },
    "results": [
        {
            "id": 306811273,
            "seller_id": 384324657,
            "inventory_id": "DEHW09303",
            "date_created": "2020-06-18T18:43:26Z",
            "type": "ADJUSTMENT",
            "detail": {
                "available_quantity": -5,
                "not_available_quantity": 5,
                "not_available_detail": [
                    {
                        "status": "lost",
                        "quantity": 5
                    }
                ]
            },
            "result": {
                "total": 100,
                "available_quantity": 95,
                "not_available_quantity": 5,
                "not_available_detail": [
                    {
                        "status": "lost",
                        "quantity": 5
                    }
                ]
            },
            "external_references": []
        },
        {
            "id": 306745917,
            "seller_id": 384324657,
            "inventory_id": "DEHW09303",
            "date_created": "2020-06-18T18:15:13Z",
            "type": "SALE_CANCELATION",
            "detail": {
                "available_quantity": 10,
                "not_available_detail": []
            },
            "result": {
                "total": 100,
                "available_quantity": 100,
                "not_available_quantity": 0,
                "not_available_detail": []
            },
            "external_references": [
                {
                    "type": "shipment_id",
                    "value": "28312959315"
                }
            ]
        },
        {
            "id": 306718974,
            "seller_id": 384324657,
            "inventory_id": "DEHW09303",
            "date_created": "2020-06-18T18:02:33Z",
            "type": "SALE_CONFIRMATION",
            "detail": {
                "available_quantity": -10,
                "not_available_detail": []
            },
            "result": {
                "total": 90,
                "available_quantity": 90,
                "not_available_quantity": 0,
                "not_available_detail": []
            },
            "external_references": [
                {
                    "type": "shipment_id",
                    "value": "28312961122"
                }
            ]
        },
        {
            "id": 306705012,
            "seller_id": 384324657,
            "inventory_id": "DEHW09303",
            "date_created": "2020-06-18T17:55:42Z",
            "type": "INBOUND_RECEPTION",
            "detail": {
                "available_quantity": 100,
                "not_available_detail": []
            },
            "result": {
                "total": 100,
                "available_quantity": 100,
                "not_available_quantity": 0,
                "not_available_detail": []
            },
            "external_references": [
                {
                    "type": "inbound_id",
                    "value": "0001"
                }
            ]
        }
    ],

    "filters": [],
    "available_filters": [],
    "available_sort": [],
    "sort": [], 
    "available_sorts": []
}
```

### Reglas

- En el search de operaciones, el rango máximo de consulta son 60 días

- El filtro de fechas no es obligatorio, pero si no las pones trae los últimos 15 días

- Ejemplo con filtros disponibles:

- `"available_filters": [ { "id": "inventory_id", "name": "Inventory id" }, { "id": "date_from", "name": "Date created from" } ]`

- Ejemplo con filtros seleccionados:

- `"filters": { { "id": "inventory_id", "name": "Inventory id" "values": [ "ESZJ28231" ] } ]`

- Posibles errores

- Respuesta con error:

- `{ "status": 403, "message": "User 281349747 cannot access to inventory ESZJ28231", "error": "forbidden", "cause": [] }`

- Ejemplo de errores

- Status Mensaje Error Descripción     400 The field ‘seller_id’ is required validation_error No se encuentra el parámetro seller_id   400 The field ‘type’ has an invalid value validation_error Parámetro inválido   400 The limit param must be greater than 0 validation_error El parámetro limit de la llamada debe ser mayor a 0   400 Date range can’t be greater than “60” days validation_error El rango de fechas excede el límite permitido por días   400 The field date_from and date_to are required validation_error Los campos date_from y date_to son requeridos   400 The field date_from and date_to are required validation_error El campo date_from no puede ser más grande o igual que el campo date_to   403 Access denied for user 30265782 forbidden El caller no está autorizado a acceder al recurso   401 No autorizado unauthorized    429 Too many request too_many_request El usuario ha superado el número de request permitidas por minuto   500 Internal server error internal_error Error interno

- 

- Modo de búsqueda por scroll

- Trabajar con scroll + limit

- El **scroll**  se utiliza para obtener el listado de las operaciones de stock para un inventory_id en particular.

- El **limit**  es la cantidad de registros a devolver por “página” de resultados y **scroll**  es el atributo que permite paginar los resultados. Para utilizarlo debes:

- Obtener en el resultado un campo scroll que expira a los 5 minutos. Agregar a la consulta el scroll obtenido en el primer GET. Si no utilizas el parámetro limit, por default se establece el máximo 1000 resultados por página.

- Llamada para consultar las operaciones:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' http://api.mercadolibre.com/stock/fulfillment/operations/search?seller_id=$SELLER_ID&inventory_id=$INVENTORY_ID&date_from=$aaaa-mm-dd&date_to=$aaa-mm-dd`

- Respuesta:

- `"scroll":"YXBpY29yZS1pdGVtcw==:ZHMtYXBpY29yZS1pdGVtcy0wMQ==:DXF1ZXJ5QW5kRmV0Y2gBAAAAABIu7AgWMXl6anF3SU5SMVNaQXFxTkZubHBqQQ=="`

- Agregamos el scroll obtenido en el paso anterior:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/stock/fulfillment/operations/search?seller_id=$SELLER_ID&inventory_id=$INVENTORY_ID&date_from=$aaaa-mm-dd&date_to=$aaaa-mm-dd&scroll=YXBpY29yZS1pdGVtcw==:ZHMtYXBpY29yZS1pdGVtcy0wMQ==:DXF1ZXJ5QW5kRmV0Y2gBAAAAABIu7AgWMXl6anF3SU5SMVNaQXFxTkZubHBqQQ==`

- Para seguir obteniendo las próximas páginas de resultados basta con hacer el mismo GET hasta llegar al final. Solo cuando scroll = null significa que llegamos al final y no hay más resultados.

- 

- Consultar operaciones con ID

- Puedes obtener el detalle de una operación en particular ejecutada sobre el stock que el vendedor tiene almacenado en los centros de Fulfillment.

- **Parámetro**

- operation_id: identificador de id de operation

- Llamada:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' http://api.mercadolibre.com/stock/fulfillment/operations/$OPERATION_ID`

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' http://api.mercadolibre.com/stock/fulfillment/operations/329663159`

- Respuesta:

- `{ "id": "329663159", "seller_id": 404584692, "inventory_id": "FIWU34511" "date_created": "2020-06-29T13:45:13Z" "type": "SALE_CONFIRMATION" "detail":{ "available_quantity": -1 "not_available_detail":[] }, "result":{ "total": 1 "available_quantity": 0 "not_available_detail":[ { "status": "damaged", "quantity": 1, } ] }, "external_references":[ { "type": "shipment_id", "value": "28518304587", } ] }`

- Ejemplo de errores

- Status Mensaje Error Descripción     400 Invalid operation_id abc34567 invalid_param Parámetro inválido   403 The caller is not authorized to access this resource forbidden El caller no está autorizado a acceder al recurso   401 No autorizado unauthorized El caller no está autenticado en la plataforma   404 Operation not found not_found No se encuentra la operación solicitada   500 Internal server error internal_error Error Interno al obtener la información

- 

- Nota:  La fecha de consulta retorna hasta el día -1. En este caso, retorna las operaciones desde el 29/06 hasta el 27/07, o sea no incluye el día 28.

- Campos de la respuesta

- **Paging**

- **limit** : cantidad de registros a devolver por “página” de resultados. Por default será 1000 **scroll** : scroll a partir del cual se continúa la búsqueda. Cuando devuelve scroll = null significa que no tiene más registros en la próxima página. Las reglas del scroll son:

- 

- - En el resultado obtienes un campo scroll que expira en 5 minutos.  - Debes agregar el mismo scroll a la consulta del campo obtenido anteriormente.  - En caso de no utilizar el parámetro limit, devolverá por defecto 1000 operaciones del total. Podrás agregar un limit máximo de 1000.  - Para seguir obteniendo las próximas páginas de resultados, basta con hacer el mismo GET a la llamada hasta llegar al final de la lista.

- **results** : listado de operaciones encontradas.

- **id** : identificador de la operación de stock. **seller_id** : identificador del seller propietario del inventory. **inventory_idd** : identificador del producto en el depósito. **date_created** : fecha de creación de la operación (tipo date UTC). **type** : tipo de operación ejecutada (ingreso, venta, venta cancelada, etc.).

- **result** : estado del stock

- **available_quantity** : cantidad de productos disponibles a la venta. **not_available_quantity** : total de productos que no se encuentran disponibles. **not_available_detail** : detalle del estado de las diferentes unidades no disponibles.

- **status** : estado del ítem no disponible.  **quantity** : cantidad de ítems en el estado asignado.  **external_references** : referencias a las entidades que generan la operación.

- **type** : tipo de external reference, en principio pueden ser: **shipment_id** : identificador del envío al comprador.

- 

- Tipos de operaciones

- Estos tipos de operaciones reflejan las interacciones de los diferentes flujos en las unidades almacenadas.

- 

- Inbound

- **inbound_reception**  **Ingreso de stock** : el proceso de inbound disponibiliza a la venta unidades al finalizar el flujo de ingreso. Pueden tener:   Ingreso de unidades que llegaron dañadas.  Ingreso de unidades sin cobertura fiscal (sólo para Brasil).  **fiscal_coverage_ajustment** : ajuste de cobertura fiscal (sólo para Brasil).

- 

- Outbound

- **sale_confirmation** : confirma la reserva de unidades para la venta.  **sale_cancelation** : cancela la reserva de unidades para la venta.  **sale_delivery_cancelation**   **Venta no entregada** : no fue posible entregar al comprador y vuelve al depósito.  **sale_return** : devolución de ventas por parte del comprador.

- 

- 

- Withdrawal

- Se trata de la solicitud de retiro del vendedor.

- **withdrawal_reservation** : reservan unidades para un retiro de stock.  **withdrawal_cancelation** : cancelación total o parcial de reserva de retiro, se cancela la reserva de unidades para un retiro de stock.  **withdrawal_delivery** : el vendedor retira físicamente las unidades reservadas.  **withdrawal_removal** : remoción de stock por retiro abandonado.   **withdrawal_discarded** : remoción de stock solicitado por el seller.

- 

- Transfer

- Se trata del manejo interno del stock por parte de Mercado Libre, no del vendedor.

- **transfer_reservation** : se reservan unidades para una transferencia o retiro multiwarehouse.  **transfer_ajustment** : luego de inspeccionar las unidades, se determina el estado de calidad y se hace el restock como available o damaged.  **transfer_delivery** : ingresan las unidades en transferencia.

- 

- Quarantine

- Se trata del manejo interno sobre el control de calidad.

- **quarantine_reservation** : reservan unidades por el área de calidad para inspección.  **quarantine_restock** : luego de inspeccionar las unidades, determina el estado de calidad y se hace el restock como available o damaged.  **lost_refund** : baja definitiva de unidades extraviadas (reembolsadas).  **damaged_removal** : remoción y reembolso por unidades dañadas en full.  **disposed_tainted**  rezagado porque el producto está contaminado.  **disposed_expired**  rezagado porque el producto está vencido.

- 

- Removal QA

- Se trata de un retiro impulsado internamente.

- **removal_reservation** : luego de inspeccionar las unidades, se determina el estado de calidad y se pasan a retiro.  **removal_completion** : se eliminan las unidades con mal estado de calidad.  **stranded_disposal_removal** : remoción de stock por falta de rotación.

- 

- Ajustes de stock

- **ajustement** : ajustes internos de stock generados por la operación.  **identification_problem_remove** : cuando un producto fue ingresado con un SKU incorrecto. Al realizar la reidentificación, se da de baja el mismo.  **identification_problem_add** : cuando un producto fue ingresado con un SKU incorrecto. Al realizar la reidentificación, se da de baja el mismo, y se añade stock del nuevo SKU.
