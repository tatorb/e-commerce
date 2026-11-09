<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/reportes-descargas -->
<!-- Sección: Guía para productos > Reportes de Facturación -->

# Descargas

Última actualización 28/10/2026

## Descarga de documento legal

Te compartimos un paso a paso para descargar las facturas legales de Mercado Libre y Mercado Pago en formato PDF. Debes obtener el file_id consultando el endpoint de /documents. En algunos casos, puedes recibir dos file_id. Solo en estos casos, es importante observar que debes usar el file_id correspondiente al PDF.
 Si el endpoint devuelve solo un file_id, entonces debes usar ese dato para descargar el documento legal.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/legal_document/$FILE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/legal_document/1234_FE_MEPF00869625_pdf
```

Respuesta: **descarga del archivo en formato PDF** .

## Descarga del informe de conciliación

Para descargar los informes de conciliación de **Mercado Libre** , **Mercado Envíos Flex** , **Insurtech**  y **Mercado Pago**  en formatos **XLSX**  y **CSV**  debes seguir un proceso de generar el informe. Este mismo proceso servirá para el informe de **Fulfillment y para el informe de pagos** , que admiten solo el formato de descarga **XLSX** .
 El proceso de generar el informe consiste en tres pasos:

### 1. Creación del informe

A través de este endpoint realizarás la creación del informe.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d {...}
https://api.mercadolibre.com/billing/integration/periods/key/$KEY/reports
```

Para generar el informe, `KEY` debe ser el primer día del mes del período, con el formato `YYYY-MM-01`. Por ejemplo, para septiembre de 2026, utiliza `2026-09-01`.

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
  -d '{
     "group": "ML",
     "document_type": "BILL",
     "report_format": "CSV"
  }'
  https://api.mercadolibre.com/billing/integration/periods/key/2021-08-01/reports
```

El valor del parámetro group varía según el informe que quieras generar:

- ML para informe de ML

- MP para informe de MP

- FLEX para informe de Flex

- FULL para informe de Fulfillment

- INSURTECH para informe de Insurtech

- PAYMENT para informe de pagos

Respuesta:

```
{
  "fileId": "ML-report-BILL-2021-08-04-11119999-CSV-v2"
  }
```

Si `KEY` no corresponde al primer día del mes, la API devuelve un error HTTP 400 (`BAD_REQUEST_ERROR`):

```
{
  "timestamp": "2026-10-27T13:05:24.413758933Z",
  "status": 400,
  "type": "BAD_REQUEST_ERROR",
  "message": "key must be the first day of the month",
  "path": "/periods/key/2026-09-10/reports"
}
```

### 2. Estado de creación del informe

Te permitirá obtener el estado de creación de un informe. Los estados pueden ser:

- PROCESSING: el informe está siendo generado.

- READY: el informe terminó de ser creado.

- ERROR: la creación del informe falló, deberás consultarlo nuevamente.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/reports/$FILE_ID/status
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/reports/ML-report-BILL-2021-08-04-11119999-CSV-v2/status?document_type=BILL
```

Respuesta:

```
{
"status": "PROCESSING"
}
```

### 3. Descarga del informe

Con este endpoint podrás realizar la descarga del informe. Esta descarga podrá hacerse una vez que el estado de la creación sea **Ready** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/reports/$FILE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/billing/integration/reports/ML-report-BILL-2021-08-04-11119999-CSV-v2?document_type=BILL
```

**Siguiente** : [Percepciones](https://developers.mercadolibre.com.ar/es_ar/resumen-percepciones).
