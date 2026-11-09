<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/api-de-precios -->
<!-- Sección: Guía para productos > Precios y Costos -->

# Precios de productos

Última actualización 14/10/2026

## Precios de productos

Importante:

Utiliza los siguientes endpoints para consultar precios, ya que eliminaremos progresivamente: 
 - Los campos **price, base_price**  y **original_price**  de la API de /items.

Si publicas y sincronizas items debes consultar los precios relacionados a un producto y contexto (canal y/o nivel de comprador) con las siguientes APIs. Además, puedes conocer el valor exacto de venta. Para **[crear un item](https://developers.mercadolibre.com.ar/es_ar/publica-productos#Publica-un-articulo)**  y **[editarlo](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones#Consideraciones-para-actualizar-items)**  debes continuar haciéndolo mediante la API de /items. **Próximamente, habilitaremos este [endpoint para editar precios](https://developers.mercadolibre.com.ar/es_ar/api-de-precios?nocache=true#Editar-precios-tipo-standard)** .

## Notificaciones sobre precios

Para recibir notificaciones sobre los precios, debes suscribirte al tópico [**items_prices**](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#items-prices), después de recibir la notificación debe consultar el recurso de **/prices** .

## Obtener precio de venta actual

Para conocer el precio de venta, debes saber que **los precios pueden ser de tipo standard**  (precios por default sin promociones asociadas) o **promotion**  (promocionales, el precio tiene una promoción). 

 Con el siguiente request identificas el precio de venta ganador de un producto y puedes filtrar precios por canal de venta y/o nivel del comprador. Además, recibirás información sobre las promociones asociadas al ítem con el precio ganador, que se muestra al comprador. 

 **Context** : parámetro opcional para filtrar canal de venta y/o nivel de comprador. Te recomendamos enviar por lo menos un channel a la vez y opcional puedes agregar cada loyalty_level. Valores posibles:

**CHANNEL (Canal de venta)**

- **channel_marketplace** : canal Mercado Libre.

- **channel_proximity, mp_merchants y mp_links** : canal de productos publicados en Mercado Pago. Próximamente estarán habilitados.

**LOYALTY_LEVEL (Nivel del comprador)** : no disponible en MLU y MPE

- buyer_loyalty_3

- buyer_loyalty_4

- buyer_loyalty_5

- buyer_loyalty_6

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/sale_price?context=$CHANNEL,LOYALTY_LEVEL
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA3191390879/sale_price?context=channel_marketplace,buyer_loyalty_3
```

Respuesta:

```
{
    "price_id": "145",
    "amount": 39200.0,
    "regular_amount": 49000.0,
    "currency_id": "ARS",
    "reference_date": "2023-06-08T19:06:56Z",
    "metadata": {
        "promotion_id": "OFFER-MLA13456789-1122334455", 
        "promotion_type": "custom" 
    }
}
```

### Descripción de los campos

**price_id** : ID del precio.
 **amount** : precio de venta del producto.
 **regular_amount** : precio original del producto, en casos que tenga promoción. El precio tachado del precio ganador también es calculado, y se puede tomar de varias fuentes. No necesariamente será el mismo 'regular_amount' del recurso /prices.
 **currency_id** : ID de la moneda a la que se refiere el campo amount y regular_amount.
 **reference_date** : fecha para la cual está calculando el precio de venta.
 **metadata** : información privada del usuario relacionada a la promotion asociada.

Nota:

Si el ítem tiene un precio con promoción, los siguientes campos estarán relacionados a Promociones. Puedes utilizarlos como input para realizar consultas específicas sobre [promociones de marketplace](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones).

**promotion_id** : Id de la promoción. Con este ID puedes [consultar la oferta](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Consultar-ofertas) (item, promoción y estado). .
 **promotion_type** : tipo de promoción.

### Cuando la promoción está activa:

- Y bajas el precio a un valor por debajo de la oferta, Mercado Libre elimina la promoción y queda el precio standard nuevo.

- Y bajas el precio pero no por debajo del valor de la promoción, esta seguirá activa independientemente del aumento del precio standard.

- 

- Cuando la promoción está programada:

- No se verá reflejada  Si actualizas el precio de los DEALS, no se impactará hasta la fecha indicada.

- 

- Con la API de Promotions, puedes [consultar promociones filtrando por su estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Filtros) (started, finished, pending y candidate).   Solo las ofertas **CUSTOM**  y **PRICE_DISCOUNT**  se reportan como custom. Esto es porque se pueden crear de 2 formas:

- **De forma individual** , colocando una oferta custom a un ítem.  **De forma masiva**  como parte de una **campaña de seller de porcentaje de descuento** . Esto es, creas una campaña de 5% de descuento y subes items a esa campaña.

- 

- Esto significa que para todos esos ítems se crearon ofertas **CUSTOM/PRICE_DISCOUNT**  con un 5% de descuento. No existen otros tipos de campañas que también reporten ser custom

- 

- **Importante:**    Antes de modificar el precio de un ítem mediante un PUT en **/items** , verifica si la publicación tiene la [**automatización de precios activa**](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#:~:text=access%20token%22%0A%7D-,Obtener%20automatizaci%C3%B3n%20de%20precios%20de%20%C3%ADtems%20por%20vendedor,-Este%20recurso%20devuelve). A partir del **18 de marzo de 2026** , las solicitudes que actualicen únicamente el campo **price**  serán [rechazadas con un 400 Bad Request](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#:~:text=el%20front%2Dend.-,Qu%C3%A9%20cambia%3F,-Las%20peticiones%20PUT). Por otro lado, las solicitudes que incluyan el campo **price**  junto con otros atributos serán procesadas con un 200 OK, sin embargo, el valor enviado en **price**  será ignorado y la respuesta devolverá un warning informando que el precio no fue actualizado.

- 

- Obtener precios del producto

- Conoce todos los tipos de precio (standard y promotion), siempre y cuando estén vigentes, que puede tener un producto en los diferentes canales donde está publicado.

- Llamada:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/prices`

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM237323192/prices`

- Respuesta:

- `{ "id": "MLM237323192", "prices": [ { "id": "1", "type": "standard", "amount": 6700, "regular_amount": null, "currency_id": "MXN", "last_updated": "2025-07-15T14:44:58Z", "conditions": { "context_restrictions": [], "start_time": null, "end_time": null } }, { "id": "346", "type": "promotion", "amount": 6365.0, "regular_amount": 6700.0, "currency_id": "MXN", "last_updated": "2025-12-18T13:06:35Z", "conditions": { "context_restrictions": [ "channel_marketplace" ], "start_time": "2025-12-10T06:00:00Z", "end_time": "2026-01-01T05:59:59Z" } }, { "id": "347", "type": "promotion", "amount": 6164, "regular_amount": 6700.0, "currency_id": "MXN", "last_updated": "2025-12-18T13:06:35Z", "conditions": { "context_restrictions": [ "channel_marketplace" ], "start_time": "2025-12-10T06:00:00Z", "end_time": "2026-01-01T05:55:00Z" } }, { "id": "348", "type": "promotion", "amount": 6164.0, "regular_amount": 6700.0, "currency_id": "MXN", "last_updated": "2025-12-18T13:06:35Z", "conditions": { "context_restrictions": [ "channel_marketplace" ], "start_time": "2025-11-05T16:10:00Z", "end_time": "2026-01-01T05:55:00Z" } } ] }`

- Descripción de los campos

- **id** : ID del producto.  **price** : array con información relacionada al precio.

- **id** : id del precio.  **type** : tipo de precio. Puede ser: **standard**  (valor indicado por el vendedor sin promociones) o **promotion**  (precio promocional).  **amount** : precio del producto. **regular_amount** : precio original del producto, en casos que tenga promoción. **currency_id** : ID de la moneda a la que se refiere el campo amount regular_amount. **last_updated** : fecha última actualización.

- **conditions** : array de condiciones bajo las cuales puede aplicar el precio.

- **context_restrictions** : canal que se aplica el precio o nivel de loyalty. Conceptualmente son restricciones que solo 'compiten' por ser el precio de venta si el contexto cumple con esos valores, por lo que está restringido a esos valores. **start_time/end_time** : fecha de inicio y finalización del precio. Información sensible oculta si consultas un ítem con token que no pertenece al ítem.

- Editar precios tipo standard

- Importante:    Esta API aún no está disponible. Próximamente reemplazará al PUT de ítems para editar precios.

- Antes de utilizar este recurso, realiza GET a [/items/$ITEM_ID/prices](https://developers.mercadolibre.com.ar/es_ar/api-de-precios?nocache=true#Obtener-precios-del-%C3%ADtem) para conocer el precio standard del item y luego envía en el body del JSON **conditions**  (canal de venta), **amount**  (nuevo precio) y **currency_id**  (moneda local) que desees cambiar. En todo los casos, debes enviar los canales de venta donde está publicado el precio standard.

- 

- Parámetros obligatorios

- **prices** : array lista de precios por canal.  **conditions** : condiciones del precio. Debes enviar **context_restrictions**  como parte de las condiciones del precio. Dicta qué restricciones tendrá al momento de hacer match en búsqueda del Precio de Venta.  **amount** : valor del precio. Aplican máximos y mínimos según el país y categoría del producto.  **currency_id** : moneda del precio. [Consulta las monedas disponibles por sites](https://api.mercadolibre.com/sites) o [detalle de monedas](https://api.mercadolibre.com/currencies).

- Llamada:

- `curl -x POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' https://api.mercadolibre.com/items/$ITEM_ID/prices/standard { "prices": [ { "conditions": { "context_restrictions": ["channel_marketplace"] }, "amount":400, "currency_id":"USD" }, { "conditions": { "context_restrictions": ["channel_mshops"] }, "amount":450, "currency_id":"USD" } ] }`

- Nota:   Recibirás error 400 si:   - envías un nodo sin restricción por contexto y luego uno o más nodos con restricciones por contexto. Por default, si envías el nodo de precio sin restricciones por contexto, editarás precios standard.   - envías más de un nodo sin restricción por contexto.   - envías uno o más nodos con restricciones por contexto con valores de canales inválidos.   - no envías uno o más nodos con restricciones por contexto con valores de canales que el item tiene en el campo channels (/items).
