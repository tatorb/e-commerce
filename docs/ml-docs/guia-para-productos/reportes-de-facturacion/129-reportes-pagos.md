<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/reportes-pagos -->
<!-- Sección: Guía para productos > Reportes de Facturación -->

# Pagos

Última actualización 20/05/2025

## Reporte de pagos

Permite obtener el detalle de las facturas del vendedor abonadas en un determinado período.

### Parámetros

**expiration_date** : Periodo en el cual se quiere obtener el detalle (Formato: YYYY-mm-dd)
 **sort_by** : valores posibles: ID, DATE. Valor por defecto: ID.
 **order_by** : Permite ordenar la búsqueda. Valores posibles: ASC, DESC. Valor por defecto: ASC.
 **offset** : Permite buscar desde un número de resultado en adelante. El valor mínimo permitido es 0 y el valor máximo permitido es 10000. Por defecto el valor es 0.
 **limit** : Limita la cantidad del resultado. El valor mínimo permitido es 1 y el valor máximo permitido es 1000. Por defecto el valor es 150.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/group/ML/payment/details
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/periods/key/2023-08-01/group/ML/payment/details?limit=1
```

Respuesta:

```
"payment_info": {
               "payment_id": "111111abcde",
               "credit_note_number": null,
               "payment_date": "2023-12-06T19:43:32",
               "payment_type": "collections_forced",
               "payment_type_description": "Pagos con débito automático",
               "payment_method": "account_money",
               "payment_method_description": "Mercado Pago",
               "payment_status": "approved",
               "payment_status_description": "Aplicado",
               "payment_amount": 30000.5,
               "amount_in_this_period": 500.32,
               "amount_in_other_period": 300.18,
               "remaining_amount": 0,
               "return_amount": 200
           }
```

Importante:

El tipo del campo **payment_id**  debe ser de tipo string, para aceptar id’s alfanuméricos. 
 Actualmente este cambio solo alcanzará a sellers de MLA, MLB, MLM y MLC. Pero todas aquellas integraciones que trabajen con sellers de MLA, MLB y/o MLM deberán seguir las recomendaciones.

### Campos de respuesta

**payment_id** : identificador del pago (no corresponde para notas de crédito). [string] 
 **credit_note_number** : Número de nota de crédito (si corresponde).
 **payment_date** : Fecha del pago.
 **payment_type_description** : Descripción del tipo de pago.
 **payment_type** : Tipo de pago.
 **payment_method_description** : Descripción del método de pago.
 **payment_method** : Método de pago.
 **payment_status_description** : Descripción del estado del pago.
 **payment_status** : Estado del pago.
 **payment_amount** : Importe total del pago.
 **amount_in_this_period** : Importe aplicado en este período.
 **amount_in_other_period** : Importe aplicado en otro período.
 **remaining_amount** : Saldo a favor para próximas facturas.
 **return_amount** : Saldo a favor que tiene el vendedor. Se mostrará únicamente cuando el valor sea mayor a cero.

## Detalle de pagos

Accede al detalle de cargos y percepciones correspondientes a un determinado pago.

### Parámetros opcionales

**sort_by** : permite seleccionar por qué campo ordenar. Valores posibles: ID (valor por default) y DATE
 **order_by** : permite ordenar la búsqueda.
 **asc** : ordena los resultados de manera ascendente (valor por default)
 **desc** : ordena los resultados de manera descendente. Ej: date_sort=asc
 **offset** : permite buscar desde un número de resultado en adelante Ej: offset=100 (devuelve a partir del resultado número 100).
 **limit** : limita la cantidad de resultados. Por defecto el mínimo es 150. Máximo valor permitido: 1000. Ej: limit=300 (devuelve hasta 300 resultados).

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/payment/$PAYMENT_ID/charges
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/payment/111111abcde/charges
```

Respuesta:

```
"payment_details": [
              {
	"payment_info": {
               "payment_id": "111111abcde",
               "payment_date": "aaaa-mm-ddThh:mm:ss",
               "association_amount": 4500,
               "payment_amount": 999999,99
           },
       "charge_info": {
               "detail_id": 999999999,
               "detail_description": "xxxxxxxxxxx",               
               "detail_date": "aaaa-mm-ddThh:mm:ss"
           }
                }
]
```

### Campos de respuesta

**payment_id** : identificador del pago. [string] 
 **payment_date** : fecha del pago.
 **association_amount** : parte del pago aplicado a cargos o impuestos.
 **payment_amount** : monto del pago que se aplica a los cargos o impuestos.
 **detail_id** : Id del cargo.
 **detail_description** : descripción del cargo.
 **detail_date** : fecha del cargo.

**Siguiente** : [Descargas](https://developers.mercadolibre.com.ar/es_ar/reportes-descargas).
