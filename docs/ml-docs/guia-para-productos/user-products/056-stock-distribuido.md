<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/stock-distribuido -->
<!-- Sección: Guía para productos > User Products -->

# Stock distribuido

Última actualización 20/04/2026

## Stock distribuido

Stock Distribuido tiene como objetivo permitir que los vendedores configuren diferentes ubicaciones del stock (**stock_locations** ) a un mismo User Product.

## Tipos de stock

Para la gestión del stock definimos las tres siguientes tipologías de **stock_locations** :

| Location type | Caso de uso | Gestor del stock | Permite editar stock vía API |
| --- | --- | --- | --- |
| **meli_facility** | El vendedor envía su stock a los depósitos de Fulfillment de Mercado Libre. | Mercado Libre (Full) | No. |
| **selling_address** | Depósito de origen del vendedor que representa las logísticas que no son fullfillment tales como: crossdocking, xd_drop_off y flex. | Usuario (Vendedor) | Sí, en los sites donde está encendida la experiencia stock distribuido full y flex, es decir en MLA y MLC. |
| **seller_warehouse** | Múltiples orígenes de stock gestionados por el vendedor. Permite al vendedor gestionar el stock de varios depósitos que corresponden a las ubicaciones donde tiene su inventario. | Usuario (Vendedor) | Sí, siempre que el seller esté configurado en la experiencia de multi origen y cuente con la tag de warehouse_management. |

Diagrama de ejemplo de stock distribuido para un User Product con Convivencia Full - Flex en sites donde el seller puede gestionar el stock de flex:

**Nota:**

Diagrama de ejemplo de stock distribuido para un seller activo a multiorigen y un User Product con stock en diferentes locations:

## Obtener detalle de stock

Tenga en cuenta que un mismo UP podrá tener hasta dos tipologías, ya sea (**selling_address**  y **meli_facility** ) o (**seller_warehouse**  y **meli_facility** ).

Para consultar el stock asociado a un User Product deberás hacer la siguiente requisición.

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/stock -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo:**

```
curl -X GET https://api.mercadolibre.com/user-products/MLAU123456789/stock -H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Ejemplo de respuesta para tipología **selling_address** :**

```
{
  "locations": [
    {
      "type": "selling_address",
      "quantity": 5
    }
  ],
  "user_id": 1234,
  "id": "MLBU206642488"
}
```

**Ejemplo de respuesta para tipología **meli_facility** :**

```
{
  "locations": [
    {
      "type": "meli_facility", //fulfillment
      "quantity": 5
    }
  ],
  "user_id": 1234,
  "id": "MLBU206642488"
}
```

**Ejemplo de respuesta para tipología `seller_warehouse`:**

```
{
   "locations": [
       {
           "type": "seller_warehouse",
           "network_node_id": "MXP123451",
           "store_id": "9876543",
           "quantity": 15
       },
       {
           "type": "seller_warehouse",
           "network_node_id": "MXP123452",
           "store_id": "9876553",
           "quantity": 15
       }
   ],
   "user_id": 1234,
   "id": "MLAU123456789"
}
```

**Consideraciones:**

- Al consultar el detalle de stock, se retornará un header llamado **x-version** , el cual tendrá un valor entero (de tipo long) que representará la versión actual de **/stock/** .

- Este header debe ser enviado al utilizar recursos que modifiquen el stock de los User Products (PUT /stock/type/selling_address y PUT /stock/type/seller_warehouse ).

- Si no se envía, retornará un bad request (status code: 400).

- Adicionalmente, en caso de que la versión enviada no sea la última, se retornará un conflict (status code: 409).

- En el caso de una respuesta con código 409, se debe consultar nuevamente el stock para obtener la versión actualizada del header **x-version** .

## Gestionar stock

La gestión y actualización de stock varía según la configuración del seller y la convivencia entre los modelos de logística. A continuación, se describen los diferentes escenarios y las recomendaciones para actualizar el stock de manera adecuada:

- **Stock sin multi origen activo:**  Se debe utilizar el método **PUT**  en el endpoint `/items` para actualizar el stock en `available_quantity`. En este caso, Mercado Libre sincronizará automáticamente el stock de todos los ítems asociados al mismo `user_product_id`.

- **Stock con convivencia Full/Flex sin multi origen activo (ubicaciones: meli_facility y selling_address):**   **Stock distribuido (aplica a MLA y MLC):**  Los sellers pueden gestionar el stock de Flex de forma independiente. Para ello, deben actualizar el stock a través del endpoint: **PUT user-products/stock/type/selling_address**  Para más detalles, consulta la documentación: [Gestión de stock en convivencia Full y Flex](https://developers.mercadolibre.com.ar/es_ar/convivencia-full-y-flex).  **Sin stock distribuido (resto de sites que operan con Full y Flex):**  En estos casos, los vendedores no tienen la posibilidad de actualizar el stock de Flex de manera independiente.

- **Stock Multi Origen con convivencia Fulfillment, Cross Docking, Flex u otras logísticas:**   En los casos donde el vendedor tiene habilitado Multi Origen (`warehouse_management`) y un mismo User Product (UP) cuenta con más de una logística activa (por ejemplo, Fulfillment, Cross Docking, Flex), la administración del stock debe realizarse en función del depósito asociado a cada logística. Esto permite que distintas logísticas convivan y el inventario disponible en cada depósito se gestione de manera independiente.   **Stock de Fulfillment (Full):**  Corresponde al inventario almacenado en los centros de distribución de Mercado Libre. Este stock solo se puede incrementar enviando productos a los depósitos de Full desde el panel de Mercado Libre.  **Stock local (Cross Docking, Flex u otras logísticas del seller):**  Corresponde al inventario gestionado desde los propios depósitos del seller o integrador, identificados como `seller_warehouse`. Este stock se administra a través del endpoint:   `PUT /user-products/$USER_PRODUCT_ID/stock/type/seller_warehouse`    Además, el vendedor puede asociar la logística de Flex o demás logísticas al depósito que desee, configurándolo desde su cuenta de Mercado Libre. Cada depósito tendrá sus cantidades gestionadas de forma independiente.   **Importante:**   El stock de Fulfillment (Full) y el stock local (Cross Docking, Flex, etc.) son totalmente independientes: una venta por Full descuenta del stock de Full; una venta por Flex o Cross Docking descuenta del stock local. La logística de Flex puede coexistir con Fulfillment y otras en uno o varios depósitos que el seller elija. El seller debe configurar los depósitos en los que desea activar cada logística y mantener su capacidad de envío para Flex configurada. Para más información sobre la administración de inventario por ubicación, consulta la [documentación de stock multi-origen](https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen#gestion-de-stock-por-ubicacion).

**Próxima documentación:**  [Stock multi-origen](https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen).
