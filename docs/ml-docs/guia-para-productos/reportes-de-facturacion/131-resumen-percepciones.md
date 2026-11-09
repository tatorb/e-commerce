<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/resumen-percepciones -->
<!-- Sección: Guía para productos > Reportes de Facturación -->

# Percepciones

Última actualización 12/03/2026

## Resumen de Percepciones

Importante:

Aplica solamente para Argentina.

Permite obtener el resumen de percepciones que tuvo el vendedor para un período en particular, el grupo de facturación (Mercado Libre o Mercado Pago).

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/perceptions/summary
```

Filtros opcionales:

- **currency** : tipo de moneda. Valores posibles: `USD` | `ARS`

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/periods/key/2021-08-01/perceptions/summary?group=MP
```

Respuesta:

```
{
"summary": [
       {
        "document_id": 123456789,
        "society": "ML",
        "legal_document_number": "0011A012345678",
        "user_fiscal_condition": "Responsable inscripto sin incumplimientos",
        "amount": 229314.11,
        "regimen_tax_type": "MLA_RE_IVA_N",
        "regimen_tax_type_description": "Percepción de IVA nuevos del régimen 
especial",
        "taxable_amount": 22931410.96,
        "aliquot": 1.00,
           "coefficient": 1.0000,
           "perception_charge_number": 1123456789,
           "tax_type": "CRGI",
           "tax_type_description": 
"Percepción Impuesto al Valor Agregado nuevos",
           "bill_date": "2021-11-29",
           "status": "APPLIED",
           "status_description": "Aplicado"
           "tax_ids": [123345678,233455678],
           "currency": "USD"
       }
],
"errors": []
}
```

### Campos de la respuesta

**summary** : información del resumen.

- document_id: identificador del documento.

- society: sociedad. Valores posibles ML | MP | FIN.

- legal_document_number: número de documento.

- user_fiscal_condition: condición fiscal del usuario.

- amount: total a pagar dentro del período consultado.

- regimen_tax_type: régimen del tipo de impuesto.

- regimen_tax_type_description: descripción internacionalizada del régimen del tipo de impuesto.

- taxable_amount: base imponible.

- aliquot: alor de la alícuota.

- coefficient: coeficiente que interviene en el cálculo del impuesto.

- perception_charge_number: número de cargo de percepción.

- tax_type: tipo de impuesto.

- tax_type_description: descripción internacionalizada del tipo de impuesto.

- bill_date: fecha de facturación.

- status: estado del resumen.

- status_description: descripción internacionalizada del estado.

- tax_ids: tipos de impuestos.

- currency: tipo de moneda de cada elemento. Valores posibles: `USD` | `ARS`

## Detalle de percepciones

Importante:

Aplica solamente para Argentina.

Permite obtener el detalle de una determinada percepción. Para percepciones de Mercado Libre a partir del código de percepción y el número de documento. Para percepciones de Mercado Pago a partir del código de percepción, el número de documento y el identificador del impuesto.

Notas:

- Mercado Pago: con el campo **tax_type** , **document_id**  y **tax_id**  se accede al detalle de la percepción y del documento indicado en los filtros. 
 - Mercado Libre: con el campo **tax_type** , **document_id**  se accede al detalle de la percepción y del documento indicado en los filtros.
 - Dichos campos se obtienen del endpoint Resumen de percepciones.
 - Los campos resultados varían de acuerdo al **tax_type**  consultado: Régimen General, Regimen Especial, Régimen Tucumán.

## Mercado Libre

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/group/ML/perceptions/details
```

Filtros opcionales:

- **currency** : tipo de moneda. Valores posibles: `USD` | `ARS`

Ejemplo (Régimen General):

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/group/ML/perceptions/details?document_id=333555777&tax_type=CIVA&offset=1&limit=2&currency=USD
```

Respuesta (Régimen General):

```
{
   "offset": 0,
   "limit": 150,
   "total": 4241,
   "results": [
       {
           "detail_id": 12345678,
           "date_created": "2021-10-30",
           "taxable_amount": 2660.0,
           "aliquot": 3.0,
           "tax_amount": 79.8,
           "transaction_detail": "CV",
           "transaction_detail_description": "Cargo por venta",
           "charge_bonified_id": null,
           "amount": 2660.0,
           "gross_amount": 3218.6,
           "detail_type": "CHARGE",
           "detail_type_description": "Cargo",
           "currency": "USD"
       }],
   "errors": []
}
```

## Mercado Pago

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/group/MP/perceptions/details
```

Filtros opcionales:

- **currency** : tipo de moneda. Valores posibles: `USD` | `ARS`

Ejemplo (Régimen General):

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/group/MP/perceptions/details?document_id=333555777&tax_type=CIVAMP&tax_id=12345&offset=1&limit=2&currency=USD
```

Respuesta (Régimen General):

```
{
   "offset": 0,
   "limit": 150,
   "total": 5,
   "results": [
       {
           "detail_id": 1114444,
           "date_created": "2021-10-30",
           "taxable_amount": 154.93,
           "aliquot": 3.0,
           "tax_amount": 4.6479,
           "movement_id": "1234567",
           "reference_id": 1234567,
           "transaction_detail": "CCMP",
           "transaction_detail_description": "Cargo de MercadoPago",
           "amount": 154.93,
           "gross_amount": 187.46,
           "detail_type": "CHARGE",
           "detail_type_description": "Cargo",
           "currency": "USD"
       }],
   "errors": []
}
```

### Campos de la respuesta

Para Mercado Libre y para una percepción del Régimen General se retornan los siguientes datos:

- **detail_id** : identificador del detalle.

- **date_created** : fecha de creación.

- **taxable_amount** : base imponible.

- **aliquot** : valor de la alícuota..

- **tax_amount** : importe del impuesto.

- **transaction_detai** : detalle de la transacción.

- **transaction_detail_description** : descripción internacionalizada de detalle de la transacción.

- **charge_bonified_id** : identificador del cargo que bonifica en el caso que el cargo se un bonus.

- **amount** : monto de la percepción.

- **gross_amount** : monto bruto de la percepción.

- **detail_type** : tipo de detalle a que aplica la percepción.

- **detail_type_description** : descripción del tipo de detalle al que aplica la percepción.

- **currency** : tipo de moneda de cada elemento. Valores posibles: `USD` | `ARS`

Para Mercado libre y para una percepción del Régimen Especial se informan además los siguientes datos:

- **publish_number** : número de publicación.

- **publish_title** : título de la publicación.

- **sale_date** : fecha de venta.

- **sale_number** : número de venta.

- **buyer_name** : número del comprador.

- **buyer_state_name** : provincia del comprador.

Para Mercado Libre y para una percepción del Régimen Tucumán se informa además el siguiente dato:

- **coefficient** : coeficiente con el que se calcula el importe del impuesto.

Para Mercado Pago se informa además los siguientes datos:

- **movement_id** : número de movimiento.

- **reference_id** : operación relacionada.
