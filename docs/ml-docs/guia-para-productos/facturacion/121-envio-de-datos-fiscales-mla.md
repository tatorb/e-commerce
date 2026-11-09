<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/envio-de-datos-fiscales-mla -->
<!-- Sección: Guía para productos > Facturación -->

# Envío de Datos Fiscales

Última actualización 16/03/2026

# Envío de Datos Fiscales

Importante:

Esta funcionalidad está disponible solo en Argentina.

Para la facturación automática de los ítems por Mercado Libre, primero el vendedor debe enviar los datos fiscales de los productos.

## Enviar datos fiscales

Primero, debes crear las configuraciones fiscales antes de hacer la vinculación con un ítem.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "mutation CreateFiscalInformationMLA($input: CreateFiscalInformationMLAInput!) { createFiscalInformationMLA(input: $input) { sku upc ncm iva impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } }",
      "variables": {
        "input": {
          "sku": "string",
          "upc": "string",
          "ncm": "string",
          "iva": "string",
          "impuestoInterno": 0.0,
          "description": "string",
          "measureUnit": "string",
          "origin": "string",
          "customsClearanceId": "string",
          "additionalFiscalInfo": "string"
        }
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "mutation CreateFiscalInformationMLA($input: CreateFiscalInformationMLAInput!) { createFiscalInformationMLA(input: $input) { sku upc ncm iva impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } }",
      "variables": {
        "input": {
          "sku": "sku12343",
          "upc": "11111",
          "ncm": "111111",
          "iva": "21",
          "impuestoInterno": 0.0,
          "description": "producto de prueba",
          "measureUnit": "UN",
          "origin": "IMPORTED || NATIONAL",
          "customsClearanceId": "0500001234562023001",
          "additionalFiscalInfo": "Instrucciones adicionales sobre productos importados. Este campo es opcional."
        }
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Respuesta:

```
{
    "data": {
        "createFiscalInformationMLA": {
            "sku": "sku12343",
            "upc": "14111601",
            "ncm": "11111111",
            "iva": "21",
            "impuestoInterno": 0,
            "description": "producto de prueba",
            "measureUnit": "H87",
            "origin": "IMPORTED || NATIONAL",
         "customsClearanceId": "0500001234562023001",
         "additionalFiscalInfo": "Instrucciones adicionales sobre productos importados. Este campo es opcional."
        }
    }
 }
 
```

## Configurar datos fiscales por producto

Después de informar los datos fiscales, vincula el ítem a través del SKU:

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "mutation CreateFiscalInformationLinkToItem($input: CreateFiscalInformationLinkToItemInput!) { createFiscalInformationLinkToItem(input: $input) { itemId variationId components { sku quantity percentageShare } } }",
      "variables": {
        "input": {
          "itemId": "string",
          "variationId": "string",
          "components": {
            "sku": "string",
            "quantity": 1,
            "percentageShare": 100.0
          }
        }
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "mutation CreateFiscalInformationLinkToItem($input: CreateFiscalInformationLinkToItemInput!) { createFiscalInformationLinkToItem(input: $input) { itemId components { sku quantity percentageShare } } }",
      "variables": {
        "input": {
          "itemId": "MLA1323056751",
          "components": {
            "sku": "SKU1234",
            "quantity": 1,
            "percentageShare": 100.0
          }
        }
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Respuesta:

```
{
    "data": {
        "createFiscalInformationLinkToItem": {
            "itemId": "MLA1323056751",
            "variationId": null,
            "type": "SINGLE",
            "components": [
                {
                    "sku": "SKU1234",
                    "quantity": 1,
                    "percentageShare": 100
                }
            ]
        }
    }
 }
 
```

Cuando el ítem sea único, el campo **variationId**  será null.

## Consultar datos fiscales por SKU

Notas:

Con el objetivo de mejorar nuestras funcionalidades, estamos implementando una actualización en el Facturador para soportar la emisión de facturas en el contexto de User Products (UP). Este cambio está diseñado para preservar la compatibilidad con los contratos ya vigentes, garantizando que no haya impactos significativos para los integradores.

### Detalles de la Implementación

- **Registro de Datos Fiscales:**   El procedimiento estándar permite el registro de datos fiscales por ítem individualmente Con la introducción de User Products, esta funcionalidad se ampliará. Ahora, al registrar datos fiscales en un único ítem, nuestro sistema replicará automáticamente estos datos a todos los "hermanos" dentro del mismo User Product. Esta replicación sigue una lógica similar a la ya existente para alteraciones entre ítems del mismo grupo UP.

### Consideraciones

- **Continuidad y Compatibilidad:**   No es necesario realizar cambios en los contratos actuales de integración. El comportamiento de replicación de datos dentro de un User Product es consistente con prácticas ya establecidas internamente.

Consulta los datos fiscales utilizando el SKU:

Llamada:

```
ccurl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "query ($sku: String!) { getFiscalInformationBySku (sku:$sku) { ...on FiscalInformationMLA { sku ncm iva upc impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } } }",
      "variables": {
        "sku": "string"
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "query ($sku: String!) { getFiscalInformationBySku (sku:$sku) { ...on FiscalInformationMLA { sku ncm iva upc impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } } }",
      "variables": {
        "sku": "SKU1234"
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Respuesta:

```
{
    "data": {
        "getFiscalInformationBySku": {
            "sku": "SKU1234",
            "ncm": "14111601",
            "iva": "0",
            "upc": "11111111",
            "impuestoInterno": 0,
            "description": "producto de prueba",
            "measureUnit": "UN",
            "origin": "IMPORTED",
         "customsClearanceId": "0500001234562023001",
         "additinalFiscalInfo": "Instrucciones adicionales sobre productos importados. Este campo es opcional."
        }
    }
 }
 
```

## Consultar datos fiscales por item

También puedes buscar las infos vinculadas a una publicación en Mercado Libre:

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "query ($itemId: String!, $variationId: String, $allVariations: Boolean) { getFiscalInformationsByItem (itemId:$itemId, variationId: $variationId, allVariations: $allVariations) { itemId variationId type components { sku quantity percentageShare fiscalInformation { ...on FiscalInformationMLA { ncm upc iva impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } } } } }",
      "variables": {
        "itemId": "string",
        "variationId": "string",
        "allVariations": false
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "query ($itemId: String!, $variationId: String, $allVariations: Boolean) { getFiscalInformationsByItem (itemId:$itemId, variationId: $variationId, allVariations: $allVariations) { itemId variationId type components { sku quantity percentageShare fiscalInformation { ...on FiscalInformationMLA { ncm upc iva impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } } } } }",
      "variables": {
        "itemId": "MLA1323056751",
        "variationId": "string",
        "allVariations": false
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
```

Respuesta:

```
{
    "data": {
        "getFiscalInformationsByItem": [
            {
                "itemId": "MLA1323056751",
                "variationId": null,
                "type": "SINGLE",
                "components": [
                    {
                        "sku": "SKU1234",
                        "quantity": 1,
                        "percentageShare": 100,
                        "fiscalInformation": {
                            "ncm": "14111601",
                            "upc": "11111111",
                            "iva": "0",
                            "impuestoInterno": 0,
                            "description": "producto de prueba",
                            "measureUnit": "UN",
                            "origin": "IMPORTED",
                            "customsClearanceId": "0500001234562023001",
                            "additionalFiscalInfo": "Instrucciones adicionales sobre productos importados. Este campo es opcional."
                        }
                    }
                ]
            }
        ]
    }
 }
 
```

Estas son las posibles formas de hacer la búsqueda:

- **itemId:**  cuando la publicación no tiene variación.

- **itemId + variationId:**  cuando la publicación tiene variación, para obtener los datos sólo de las variaciones solicitadas.

- **itemId + allVariations:**  cuando la publicación tiene variación, para obtener los datos de todas las variaciones de esta publicación.

## Actualizar datos fiscales

El recurso permite la actualización completa o parcial de los datos fiscales de una publicación:

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "mutation ($where: UpdateFiscalInformationMLAWhere! $input: UpdateFiscalInformationMLAInput!) { updateFiscalInformationMLA (where: $where, input: $input) { sku ncm upc iva impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } }",
      "variables": {
        "where": {
          "sku": "string"
        },
        "input": {
          "ncm": "string",
          "upc": "string",
          "iva": "string",
          "impuestoInterno": 0,
          "measureUnit": "string",
          "description": "string",
          "origin": "string",
          "customsClearanceId": "string",
          "additionalFiscalInfo": "string"
        }
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
    {
      "query": "mutation ($where: UpdateFiscalInformationMLAWhere! $input: UpdateFiscalInformationMLAInput!) { updateFiscalInformationMLA (where: $where, input: $input) { sku ncm upc iva impuestoInterno description measureUnit origin customsClearanceId additionalFiscalInfo } }",
      "variables": {
        "where": {
          "sku": "SKU1234"
        },
        "input": {
          "ncm": "14111601",
          "upc": "11111111",
          "iva": "16",
          "impuestoInterno": 0,
          "measureUnit": "H87",
          "description": "producto de prueba",
          "origin": "IMPORTED",
          "customsClearanceId": "123456789",
          "additionalFiscalInfo": ""
        }
      }
    }
    https://api.mercadolibre.com/fiscal_information/graphql
    
```

Respuesta:

```
{
    "data": {
        "updateFiscalInformationMLM": {
            "sku": "SKU1234",
            "ncm": "14111601",
            "upc": "11111111",
            "iva": "16",
            "impuestoInterno": 0,
            "description": "producto de prueba",
            "measureUnit": "H87",
            "origin": "IMPORTED",
            "customsClearanceId": "123456789",
            "additionalFiscalInfo": "Updating"
        }
    }
 } 
```

Para actualizar parcialmente los datos fiscales, envía solamente los campos necesarios en las variables después del input.

## Consultar si una publicación puede ser facturada

Este recurso permite identificar si una determinada publicación tiene todos los datos necesarios para que nuestro facturador pueda emitir la nota de venta. Puede buscar por publicación o por variaciones:

**Consulta por publicación:**

Llamada:

```
curl --location --request GET 'https://api.mercadolibre.com/can_invoice/items/$ITEM_ID \
    --header 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo:

```
curl --location --request GET 'https://api.mercadolibre.com/can_invoice/items/MLA1984512046 \
    --header 'Authorization: Bearer $ACCESS_TOKEN'    
```

Respuesta:

```
{
    "item_id": "MLA1984512046",
    "seller_id": "809726122",
    "variation_id": "",
    "status": true
 }
```

Nota:

Si busca una publicación con variaciones, sólo tendrá el status = true cuando todas las variaciones sean adecuadas. De lo contrario, debe identificar qué variación no tiene datos fiscales o tiene datos incorrectos y cambiarla.

**Consulta por variación:**

Llamada:

```
curl --location --request GET 'https://api.mercadolibre.com/can_invoice/items/$ITEM_ID/variations/$VARIATION_ID' \
    --header 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo:

```
curl --location --request GET 'https://api.mercadolibre.com/can_invoice/items/MLA1398143045/variations/$VARIATION_ID' \
    --header 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{
    "item_id": "MLA1984512046",
    "seller_id": "809726122",
    "variation_id": "94754627308",
    "status": true
 } 
```

El campo de estado indica si el artículo está listo para ser facturado.
