<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/descargar-facturas-mla -->
<!-- Sección: Guía para productos > Facturación -->

# Descargar Facturas - Emisión MELI

Última actualización 16/03/2026

# Descarga de Factura

El recurso permite obtener las facturas de ventas facturadas por Mercado Libre a través del sistema propio de facturación. Puedes descargarlas en tres formatos: **PDF** , **XML**  o **JSON** .

## Descargar Factura en PDF

Para acceder a las facturas en formato PDF utiliza el siguiente recurso, informando el **ORDER_ID**  de la venta. También puedes buscar directo por el **INVOICE_ID** , reemplazando `/order/$ORDER_ID` por `/invoice/$INVOICE_ID`.

```
https://api.mercadolibre.com/invoices/io/documents/stream/order/$ORDER_ID/pdf
```

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/invoices/io/documents/stream/order/$ORDER_ID/pdf
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/invoices/io/documents/stream/order/2000065432198754/pdf
```

Respuesta:

Ejemplo de factura retornada. Los datos personales y fiscales han sido ofuscados — la imagen tiene como objetivo ilustrar el formato del documento.

También puede ocurrir que una factura sea emitida originalmente con un DNI y que, posteriormente, el comprador se comunique con el equipo de atención al cliente para modificar los datos fiscales y refacturar a un CUIT. En estos casos, el documento original quedará anulado y se emitirá una nueva factura con los datos actualizados.

Para las consultas con **ORDER_ID**  puedes informar el transaction_type para obtener el documento fiscal correspondiente al tipo de operación. El tipo de documento generado depende del valor informado:

Cuando el transaction_type es **sale**  o **disposal_sale** , el documento emitido será una **Factura**  — el campo document_type retornará factura_a o factura_b, según el perfil fiscal del comprador.

Cuando el transaction_type es **sale_return** , **devolution**  o **disposal_sale_return** , el documento emitido será una **Nota de Crédito**  — el campo document_type retornará nota_de_credito_a o nota_de_credito_b.

Importante:

Los valores disponibles de transaction_type pueden variar según el site. La lista anterior aplica a **MLA (Argentina)** . Consulta la documentación específica de tu site para conocer los tipos disponibles.

Ejemplo de llamada con `transaction_type`:

Puedes obtener el valor de transaction_type consultando la factura en formato JSON — el campo se encuentra dentro del objeto fiscal_data en la respuesta.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/invoices/io/documents/stream/order/2000065432198754/pdf?transaction_type=sale
```

## Descargar Factura en XML

Para acceder a las facturas en formato XML utiliza el siguiente recurso. También puedes buscar directo por el **INVOICE_ID** , reemplazando `/order/$ORDER_ID` por `/invoice/$INVOICE_ID`.

```
https://api.mercadolibre.com/invoices/io/documents/stream/order/$ORDER_ID/xml
```

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/invoices/io/documents/stream/order/$ORDER_ID/xml
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/invoices/io/documents/stream/order/2000065432198754/xml
```

Respuesta:

```
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<FECompConsultarResponse xmlns="http://ar.gov.afip.dif.FEV1/">
    <FECompConsultarResult>
        <ResultGet>
            <Concepto>1</Concepto>
            <DocTipo>80</DocTipo>
            <DocNro>20312456789</DocNro>
            <CbteDesde>1500001</CbteDesde>
            <CbteHasta>1500001</CbteHasta>
            <CbteFch>20260316</CbteFch>
            <ImpTotal>12100.00</ImpTotal>
            <ImpTotConc>0</ImpTotConc>
            <ImpNeto>10000.00</ImpNeto>
            <ImpOpEx>0</ImpOpEx>
            <ImpTrib>0</ImpTrib>
            <ImpIVA>2100.00</ImpIVA>
            <FchServDesde/>
            <FchServHasta/>
            <FchVtoPago/>
            <MonId>PES</MonId>
            <MonCotiz>1</MonCotiz>
            <Iva>
                <AlicIva>
                    <Id>5</Id>
                    <BaseImp>10000.00</BaseImp>
                    <Importe>2100.00</Importe>
                </AlicIva>
            </Iva>
            <Resultado>A</Resultado>
            <CodAutorizacion>75124341299001</CodAutorizacion>
            <EmisionTipo>CAE</EmisionTipo>
            <FchVto>20260326</FchVto>
            <FchProceso>20260316091900</FchProceso>
            <PtoVta>4</PtoVta>
            <CbteTipo>1</CbteTipo>
        </ResultGet>
    </FECompConsultarResult>
</FECompConsultarResponse>
```

## Descargar Factura en JSON

Para acceder a los datos de la factura en formato JSON utiliza el siguiente recurso, informando el **USER_ID**  del vendedor y el **ORDER_ID**  de la venta. También puedes consultar por **SHIPMENT_ID**  o **INVOICE_ID** ::

Consulta a partir del **ORDER_ID** :

```
https://api.mercadolibre.com/users/$USER_ID/invoices/orders/$ORDER_ID
```

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/$USER_ID/invoices/orders/$ORDER_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/123456789/invoices/orders/2000065432198754
```

Consulta a partir del **INVOICE_ID** :

```
https://api.mercadolibre.com/users/$USER_ID/invoices/$INVOICE_ID
```

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/$USER_ID/invoices/$INVOICE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/123456789/invoices/5000065432198754
```

También puedes consultar la factura a partir del **SHIPMENT_ID** :

```
https://api.mercadolibre.com/users/$USER_ID/invoices/shipments/$SHIPMENT_ID
```

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/$USER_ID/invoices/shipments/$SHIPMENT_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/123456789/invoices/shipments/44620099001
```

El retorno es el mismo para las consultas:

```
{
    "id": 2000000009876543,
    "status": "authorized",
    "transaction_status": "authorized",
    "issuer": {
        "name": "Electrónica Demo S.R.L.",
        "identifications": {
            "cuit": "30712345678",
            "tax_type": "RESPONSABLE_INSCRIPTO"
        },
        "address": {
            "city": "Ciudad Autonoma Buenos Aires",
            "country": "AR",
            "state": "CIUDAD AUTONOMA BUENOS AIRES",
            "street_name": "Av. Corrientes 1234 Piso:3",
            "zip_code": "1043"
        },
        "user_id": "123456789",
        "brand_name": "Electrónica Demo",
        "phone": {
            "area_code": "11",
            "number": "00000000"
        }
    },
    "recipient": {
        "name": "Juan Pérez S.R.L.",
        "identifications": {
            "cuit": "20312456789",
            "tax_type": "Responsable Inscripto"
        },
        "address": {
            "city": "Rosario",
            "complement": "Piso 2",
            "country": "AR",
            "state": "Santa Fe",
            "street_name": "San Martín",
            "street_number": "500",
            "zip_code": "2000"
        },
        "external_recipient_id": "987654321",
        "discriminated_billing": false
    },
    "shipment": {
        "id": "44620099001",
        "site_id": "MLA",
        "mode": "me2",
        "logistic_type": "fulfillment",
        "logistic_center": {
            "id": "ARBA01",
            "address": {},
            "identifications": {}
        },
        "buyer_cost": 0,
        "paid_by": "third_party",
        "estimated_delivery_date": "2026-03-19T00:00:00"
    },
    "items": [
        {
            "id": "123456789_PRODUCTION_2000000009876543_1",
            "document_id": "2000000009876543",
            "seller_id": "123456789",
            "external_order_id": "2000065432198754",
            "external_product_id": "MLA1500000001",
            "external_user_product_id": "MLAU500000001",
            "attributes": {
                "bundle_quantity": 1,
                "sku": "NB-DEMO-001",
                "type": "SINGLE"
            },
            "product_name": "Notebook Demo 15 pulgadas 8 Gb Ram 256 Gb SSD",
            "quantity": 1,
            "total_amount": 12100,
            "shipping_buyer_cost": 0,
            "fiscal_data": {
                "attributes": {
                    "taxes_persistence_id": "SI-00000000-0000-0000-0000-000000000001"
                },
                "rules": [
                    {
                        "attributes": {
                            "value": 10000.00
                        },
                        "name": "ORIGINAL_VALUE"
                    },
                    {
                        "attributes": {
                            "id": 5,
                            "piva": "21",
                            "viva": 2100.00,
                            "biva": 10000.00,
                            "diva": "gravado"
                        },
                        "name": "IVA"
                    }
                ]
            },
            "reference_quantity": 1
        }
    ],
    "issued_date": "2026-03-16T09:00:00.000000000",
    "invoice_series": "0004",
    "invoice_number": 1500001,
    "attributes": {
        "authorization_date": "2026-03-16T09:19:00.000000000",
        "invoice_creation_date": "2026-03-16T09:00:00.000000000",
        "order_source": "meli",
        "invoice_source": "internal",
        "environment_type": "production",
        "payment_method": "credit_card",
        "document_type": "factura_a",
        "protocol": "75124341299001",
        "protocol_due_date": "2026-03-26",
        "tags": [
            "COMPOSE"
        ],
        "authorization_data": {}
    },
    "fiscal_data": {
        "fiscal_amounts": [
            {
                "name": "original_value",
                "attributes": {
                    "value": 10000.00
                }
            },
            {
                "name": "iva",
                "attributes": {
                    "id": 5,
                    "piva": "21",
                    "viva": 2100.00,
                    "biva": 10000.00,
                    "diva": "gravado"
                }
            },
            {
                "name": "additional_taxes",
                "attributes": {
                    "value": 0
                }
            },
            {
                "name": "items_amount_with_additional_taxes",
                "attributes": {
                    "value": 12100.00
                }
            }
        ],
        "transaction_type": "sale"
    },
    "amount": 12100.00,
    "items_amount": 12100,
    "items_quantity": 1,
    "site_id": "MLA",
    "additional_info": {
        "external_invoice_id": "0004A01500001"
    }
}
```

El campo document_type, presente en el objeto attributes de la respuesta, indica el tipo de documento fiscal emitido. Para más detalles sobre los valores posibles y su relación con el transaction_type, consulta la sección de **Descargar Factura en PDF** .
