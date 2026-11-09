<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/stock-multiwarehouse -->
<!-- Sección: FAQs -->

# Gestión de stock multiorigen / User Products

Última actualización 14/08/2026

[FAQs](https://developers.mercadolibre.com.ar/es_ar/faq-preguntas-frecuentes) › Gestión de stock multiorigen / User Products

## Gestión de stock multiorigen / User Products

¿Cómo debo actualizar stock cuando la cuenta tiene gestión multiorigen / multi-warehouse?

Cuando la cuenta tiene multiorigen no se debe usar `available_quantity` en el endpoint `/items`. El stock se gestiona por depósitos y hay endpoints específicos de User Products para eso: `/user-products/{user_product_id}/stock/type/{seller_warehouse}` (para depósitos del seller) o los endpoints de stock multiorigen. Actualizar `available_quantity` en `/items` será ignorado o devolverá error; hay que actualizar por ubicación (stores/warehouses) con los endpoints de User Products.

Para actualizar el stock por depósito use el endpoint `PUT /user-products/{user_product_id}/stock/type/seller_warehouse`:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"quantity": 10}' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock/type/seller_warehouse
```

Recomendación

Use los endpoints de User Products por `seller_warehouse` para todas las actualizaciones de stock en cuentas multiorigen y valide que el `user_product_id` y las locations estén inicializadas antes de modificar cantidades.

¿Por qué recibo "stock-locations not found" al consultar `/user-products/{id}/stock`?

Ese error aparece cuando el User Product no tiene stock inicializado o no tiene locations creadas; el recurso de stock no existe hasta que se crea el stock en las ubicaciones. La solución es crear las stock locations correspondientes mediante los endpoints de escritura de stock (usar `seller_warehouse`) antes de consultar.

Para consultar el stock de un User Product use el endpoint `GET /user-products/{user_product_id}/stock`:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock
```

Recomendación

Asegure la creación previa de stock locations (`store_id`, `network_node_id`) para el user_product antes de leer o actualizar stock.

¿Qué endpoint usar para cuentas en México (MLM) con Full + Flex? ¿Puedo usar `selling_address`?

El endpoint `selling_address` (`/user-products/{id}/stock/type/selling_address`) está habilitado solo para sitios como MLA y MLC. En sitios como MLM no está disponible; en esos casos debe usarse la gestión por `seller_warehouse` o el flujo multiorigen soportado para ese mercado. No existe el mismo flujo de `selling_address` para todas las regiones.

El endpoint `PUT /user-products/{user_product_id}/stock/type/selling_address` solo está disponible para MLA y MLC:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"quantity": 10}' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock/type/selling_address
```

Recomendación

Verifique la disponibilidad de `selling_address` por sitio y, si no está soportado, implemente la actualización por `seller_warehouse` o el flujo multiorigen específico del mercado.

¿Por qué una actualización `PUT` a `/items` para `available_quantity` a veces devuelve OK pero el stock no cambia?

Si la cuenta tiene multiorigen o stock por depósitos, `/items` `PUT` con `available_quantity` puede devolver `200` pero no actualizar el stock real. En cuentas con `warehouse_management` el stock se debe actualizar vía User Products (endpoint de stock por `seller_warehouse`); el API `/items` no modifica el stock en modo multiorigen.

Este es el endpoint `PUT /items/{item_id}` que devuelve `200` pero no actualiza el stock en cuentas multiorigen:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"available_quantity": 10}' \
  https://api.mercadolibre.com/items/{item_id}
```

Recomendación

Verifique si la cuenta usa `warehouse_management` y utilice los endpoints de User Products para cambios de stock en multiorigen.

¿Cómo habilito o asigno un depósito (warehouse) a un producto existente?

La documentación indica que la creación/actualización de stock para multiwarehouse requiere crear stock locations asociadas al user_product mediante el endpoint de stock. Si faltan `network_node_id` o `stock-locations`, la operación falla; la creación de locations y su asociación debe realizarse antes de actualizar stock.

Para crear y asociar una stock location a un User Product use el endpoint `POST /user-products/{user_product_id}/stock/type/seller_warehouse`:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"store_id": "{store_id}", "network_node_id": "{network_node_id}", "quantity": 10}' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock/type/seller_warehouse
```

Recomendación

Cree y asocie `stock_locations` con los campos requeridos (`store_id`, `network_node_id`) antes de intentar publicar o actualizar stock multiwarehouse.

¿Por qué al actualizar stock vía API aparece "the site is blocked for modifications to the selling address"?

Ese mensaje indica que está usando un endpoint de `selling_address` no soportado para ese sitio. La capacidad de modificar `selling_address` existe solo en sitios como MLA/MLC; en otros sitios (ej. MLB) debe usar `seller_warehouse` o el endpoint de stock que corresponda al mercado.

En lugar del endpoint bloqueado de `selling_address`, use `PUT /user-products/{user_product_id}/stock/type/seller_warehouse`:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"quantity": 10}' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock/type/seller_warehouse
```

Recomendación

Confirme qué tipos de stock (`selling_address` vs `seller_warehouse`) están habilitados para el sitio y utilice el endpoint correspondiente.

¿Cómo detecto si un User Product está en modelo multiorigen y cuál endpoint debo usar para actualizar stock?

Verifique si el item tiene `stock_locations` o un `user_product_id`; luego consulte `/user-products/{user_product_id}/stock`. Si las locations muestran `type:seller_warehouse` entonces está en multiorigen y hay que actualizar por ubicación (`seller_warehouse`). No use `available_quantity` en `/items` si la cuenta está en multiorigen.

Para verificar si un User Product tiene stock locations y detectar el modelo de gestión use `GET /user-products/{user_product_id}/stock`:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock
```

Recomendación

Compruebe la presencia de `stock_locations` y el tipo de location antes de decidir el flujo de actualización de stock.

¿Qué pasa si intento publicar multiwarehouse sin incluir `stock_locations`?

La publicación fallará con errores (ej. `validation error` o `stock-locations not found`). Debe proveer `stock_locations` válidas (`store_id`, `network_node_id`) y asegurarse de que las tiendas/depósitos estén configurados para el seller antes de crear o actualizar items multiwarehouse.

Para publicar un item multiwarehouse con `stock_locations` correctamente incluidas use `POST /user-products/{user_product_id}/stock/type/seller_warehouse`:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "stock_locations": [
      {"store_id": "{store_id}", "network_node_id": "{network_node_id}", "quantity": 10}
    ]
  }' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock/type/seller_warehouse
```

Recomendación

Siempre incluya `stock_locations` completas y validadas al crear o publicar items multiwarehouse para evitar rechazos.

Al crear un ítem multiwarehouse obtengo "Conflict. Try again later" (`409`) sin más detalle. ¿Qué puede causar este conflicto?

Un `409` suele indicar conflictos por modificaciones concurrentes o colisiones en recursos (por ejemplo `SKU` o `GTIN` ya asociado a otro `user_product`) o intentos de crear recursos que ya existen. También puede deberse a cambios simultáneos sobre la misma clave.

El error `409` puede ocurrir al intentar crear un User Product con `POST /user-products` usando un `SKU` o `GTIN` ya existente:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"sku": "{sku}", "gtin": "{gtin}"}' \
  https://api.mercadolibre.com/user-products
```

Recomendación

Implemente reintentos con backoff, asegure unicidad de `SKU`/`GTIN` y actualice `user_product` existentes en lugar de crear duplicados.

Si un anuncio está configurado Full + Flex, ¿puedo actualizar el stock FLEX vía API en MLB?

En algunos sitios la actualización de stock por `selling_address` para Flex no está habilitada; en ML Brasil la opción suele estar bloqueada y el stock de Full suele ser gestionado por Mercado Libre, por lo que no es modificable por la API del seller.

Para sitios donde `selling_address` no está habilitado en MLB, use `PUT /user-products/{user_product_id}/stock/type/seller_warehouse`:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"quantity": 10}' \
  https://api.mercadolibre.com/user-products/{user_product_id}/stock/type/seller_warehouse
```

Recomendación

Confirme las capacidades del site y use `seller_warehouse` cuando corresponda; si hay coexistencia Full+Flex, espere que ciertas ubicaciones sean gestionadas por la operación de Mercado Libre.

¿Por qué un anuncio queda "paused — `out_of_stock`" durante la sincronización multialmacén y cuánto tarda ese proceso?

Durante la sincronización multialmacén el marketplace puede pausar anuncios mientras procesa las locations y stock; este proceso es asíncrono y puede tardar más de un día en algunos casos, tras lo cual los anuncios se reactivan automáticamente si hay stock.

Para monitorear el estado del anuncio y verificar si sigue pausado use `GET /items/{item_id}`:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
  https://api.mercadolibre.com/items/{item_id}
```

Recomendación

Monitoree la finalización del proceso y asegúrese de que las `stock_locations` estén correctamente configuradas para evitar pausas prolongadas.

¿Por qué actualizar el stock en seller_warehouse no refleja disponibilidad en el marketplace para ítems en modo Fulfillment?

Para ítems en el modelo de Fulfillment de Mercado Libre, la disponibilidad en el marketplace se gestiona exclusivamente a través del depósito meli_facility — no a través de seller_warehouse. Enviar una actualización de stock a seller_warehouse devuelve una respuesta exitosa de la API, pero el anuncio permanecerá sin stock y pausado porque la disponibilidad de Fulfillment depende del inventario físicamente presente en el centro de distribución de Mercado Libre, no del almacén del vendedor.

Recomendación

Identifica el modelo logístico de cada anuncio antes de enrutar actualizaciones de stock. Para ítems en Fulfillment, gestiona el inventario a través de los endpoints de inventario de Fulfillment y el proceso de ingreso físico de mercancía — la actualización estándar de stock en seller_warehouse no tiene efecto sobre la disponibilidad de estos anuncios.
