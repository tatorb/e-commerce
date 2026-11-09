<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/reportes-de-facturacion -->
<!-- Sección: Guía para productos > Reportes de Facturación -->

# Reportes de Facturación

Última actualización 03/03/2026

## Reportes de Facturación

Con esta funcionalidad puedes poner a disposición los detalles de facturación realizados en Mercado Libre y Mercado Pago para los vendedores. Consultando **/billing/monthly/periods**  obtendrás información de los últimos 12 períodos. Luego, con **/documents**  conseguirás todas las facturas (documentos) de un período, y finalmente, con **/summary**  y **/details**  podrás acceder al resumen de facturación de un período y respectivamente, los detalles.

**Todos los endpoints necesitan el parámetro group** . Grupos de facturación para obtener información: **ML**  (Mercado Libre) o **MP**  (Mercado Pago). En caso de no especificarlo, obtendrá la información de ambos.

## Obtener período

Consultar primero este endpoint es opcional, ya que la key necesaria para consumir el resto de los endpoints se proporciona el primer día del mes. Por ejemplo: `2023-06-01`. Te permite obtener información sobre los períodos de facturación para el grupo de facturación indicado (Mercado Libre o Mercado Pago). Por defecto, recibes los últimos 6 períodos, con la posibilidad de consultar períodos más antiguos usando la paginación de offset y limit. Valor máximo: 12. Considera que el período de facturación puede variar según el usuario.

### Parámetro obligatorio

**document_type** : tipo de documento a obtener. Valores posibles: **BILL** ; **CREDIT_NOTE** .

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/monthly/periods
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/monthly/periods?group=MP&document_type=BILL&offset=1&limit=2
```

**Respuesta:**

```
{
  "offset": 1,
  "limit": 2,
  "total": 27,
  "results": [{
    "amount": 30.46000027656555,
    "unpaid_amount": 0.0,
    "period": {
      "date_from": "2020-02-19",
      "date_to": "2020-03-18"
    },
    "key": "2020-03-01",
    "expiration_date": "2020-03-24",
    "debt_expiration_date": "2020-03-24",
    "debt_expiration_date_move_reason": null,
    "debt_expiration_date_move_reason_description": null,
    "period_status": "CLOSED"
  }]
}
```

### Parámetros de respuesta

- **amount** : valor total del período.

- **unpaid_amount** : valor total pendiente de pago.

- **period** : rango de fechas del período.  date_from: fecha de inicio del período. date_to: fecha de fin del período.

- **key** : es la fecha del primer día del mes. Para los sitios MLA, MLB, MCO, MLC, MLU, MPE, MLV y MCR es el valor utilizado para consumir los endpoints de documents, details y summary.

- **expiration_date** : fecha de fin del período. Se informa siempre que el estado del período se encuentra cerrado. Para MLM es el valor utilizado para consumir los endpoints de documents, details y summary.

- **debt_expiration_date** : fecha de vencimiento de la deuda. En caso de que no se mueva la fecha de vencimiento, este campo será igual al **expiration_date** .

- **debt_expiration_date_move_reason** : motivo del cambio de fecha de vencimiento de la deuda. En caso de que no se mueva la fecha de vencimiento, este campo será null.

- Valores posibles: **AUTOMATIC_DOCUMENT_CLOSURE_PROCES** ; **RECEIPT_ANNULMENT_PROCESS_UNRECORDED** ; **RECEIPT_ANNULMENT_PROCESS** ; **PERIOD_EXTENDED_BY_ADMIN** ; **PAYMENT_ANNULMENT** .

- **debt_expiration_date_move_reason_description** : descripción internacionalizada de debt_expiration_date_move_reason. En caso de que no se mueva la fecha de vencimiento, este campo será null.

- **period_status** : indica si el período se encuentra abierto o cerrado.  Valores posibles: **OPEN** ; **CLOSED** .

## Obtener Documentos de un Período

Permite obtener información de los documentos (Facturas y Notas de crédito) para un período de facturación específico para el grupo de facturación indicado (Mercado Libre o Mercado Pago).

### Parámetros opcionales

- **document_id** : búsqueda por id de la factura. Ej: document_id=987046992.

- **document_type** : filtra por tipo de documento: Factura o Nota de Crédito. Valores posibles: **BILL** , **CREDIT_NOTE** .

- **offset** : permite buscar a partir de un número de resultado. Ej: offset=100 (retorna a partir del resultado número 100).

- **limit** : limita la cantidad de resultados. Por defecto el mínimo es 150. Valor máximo permitido: 1000. Ej: limit=300 (retorna hasta 300 resultados).

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/documents
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/periods/key/2021-06-01/documents?group=MP&document_type=BILL&limit=1
```

**Respuesta:**

```
{
  "offset": 0,
  "limit": 1,
  "total": 2,
  "results": [{
    "id": 987654321,
    "user_id": 1234,
    "document_type": "BILL",
    "expiration_date": "2021-06-02",
    "associated_document_id": null,
    "amount": 3.86,
    "unpaid_amount": 0.0,
    "document_status": "BILLED",
    "site_id": "MLM",
    "period": {
      "date_from": "2021-05-03",
      "date_to": "2021-05-03"
    },
    "currency_id": "MXN",
    "count_details": 1,
    "files": [
      {
        "file_id": "1234_FE_MEPF00869625_pdf",
        "reference_number": "MEPF00999999"
      },
      {
        "file_id": "1234_FE_MEPF00869625_xml",
        "reference_number": "MEPF00999999"
      }
    ]
  }]
}
```

## Resumen de Facturación

Permite obtener el resumen de cargos y bonificaciones que el vendedor tuvo para un período de tiempo específico.

Importante:

No recomendamos utilizar este endpoint dentro de un procesamiento batch. Su uso es recomendado de forma secuencial. La información que este endpoint provee no se modifica durante el día, por lo tanto un consumo diario por usuario es suficiente.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/summary/details
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/billing/integration/periods/key/2023-10-01/summary/details
```

**Respuesta:**

```
{
    "user": {
        "nickname": "TEST"
    },
    "period": {
        "date_from": "2023-06-19",
        "date_to": "2023-07-18",
        "expiration_date": "2023-07-24",
        "key": "2023-07-01"
    },
    "bill_includes": {
        "total_amount": 171070532.64,
        "total_perceptions": 33077380.48,
        "bonuses": [
            {
                "label": "Bonificación cargo por Mercado Envíos",
                "amount": 385261.63,
                "type": "BXD",
                "groupId": 3
            },
            {
                "label": "Bonificación del cargo por venta",
                "amount": 6123337.46,
                "type": "BXD",
                "groupId": 4
            }
        ],
        "charges": [
            {
                "label": "Campañas de publicidad - Product Ads",
                "amount": 48600,
                "type": "PADS",
                "groupId": 24
            },
            {
                "label": "Cargo por Mercado Envíos",
                "amount": 11195255.36,
                "type": "CXD",
                "groupId": 24
            },
            {
                "label": "Cargo por venta",
                "amount": 131285530.48,
                "type": "CV",
                "groupId": 28
            }
        ]
    },
    "payment_collected": {
        "operation_discount": 136492738.16,
        "total_payment": 33353689.85,
        "total_credit_note": 1989281,
        "total_collected": 171070532.64,
        "total_debt": 0.00
    },
    "errors": []
}
```

### Parámetros de respuesta

- **user** :  **nickname** : nombre de usuario.

- **period** :  **date_from** : fecha de inicio del período. **date_to** : fecha de fin del período. **expiration_date** : fecha de expiración. **key** : fecha del primer día del mes.

- **bill_includes** :  **total_amount** : valor total. **total_perceptions** : valor total de percepciones. **bonuses** : lista de bonificaciones.  **label** : descripción de la bonificación. **amount** : valor de la bonificación. **type** : tipo de bonificación. **groupId** : grupo de la bonificación.   **charges** : lista de cargos.  **label** : descripción del cargo. **amount** : valor del cargo. **type** : tipo de cargo. **groupId** : grupo del cargo.

- **payment_collected** :  **operation_discount** : operaciones descontadas de las ventas. **total_payment** : pagos realizados. **total_credit_note** : total de notas de crédito. **total_collected** : total cobrado. **total_debt** : total de la deuda.

## Tipos de Bonificaciones

Las bonificaciones pueden ser por los siguientes conceptos:

- **Cargos de venta y envíos** : si una venta no se concreta debido a una devolución o por problemas con el correo (como pérdida o daño del producto), reintegramos la comisión de venta y el costo de envío.

- **Cargos de publicidad** : si por error contrataste el servicio o hubo algún problema con el cobro, reintegramos la diferencia.

- **Bonificaciones por Percepciones Tributarias** : cuando se devuelve un cargo por venta, también se incluye la devolución correspondiente de la percepción tributaria de IVA (ya sea por un artículo nuevo o usado) y de Impuestos sobre Ingresos Brutos. Lo mismo si hay errores en la aplicación de una percepción.

- **charges** : diferentes cargos que el vendedor puede tener: comisiones por ventas, costo de publicaciones, percepciones tributarias, cobros de servicios. Por ejemplo: Mercado Envíos. En caso de contratar campañas publicitarias, también aparecerán en los cargos.

## Errores

| Código | Tipo | Mensaje | Solución |
| --- | --- | --- | --- |
| 206 | Partial content | An error occurred while retrieving the information. Try again. | Ocurre cuando faltan algunos datos y la respuesta está incompleta. Aplica a todos los recursos, excepto la descarga de documento legal y reporte de conciliación en formato XLSX y CSV. |
| 429 | Too Many Requests | Bloqueo preventivo por cantidad limitada de requests por IP. | Evita realizar llamadas repetitivas que no requieran el uso de limit y offset para paginar. |

**Siguiente:**  [Provisiones](https://developers.mercadolibre.com.ar/es_ar/provisiones).
