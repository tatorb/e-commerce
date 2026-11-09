<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/envios-personalizados -->
<!-- Sección: Guía para productos > Envíos -->

# Envíos Personalizados

Última actualización 13/03/2026

## Envíos Personalizados

El envío personalizado permite a los vendedores gestionar la logística de sus ventas de manera propia, ofreciendo flexibilidad en los costos de envío para sus clientes.

- **Custom:** El vendedor carga una tabla con precios de envío específicos para cada región. Este se encarga completamente de la logística y entrega.

- **Not_Specified:**  El vendedor no define precios de envío. El comprador debe contactar al vendedor para acordar los detalles y costos de envío. Solo para estos casos no hay shipment_id.

- Con estas opciones, los compradores pueden elegir la modalidad que mejor se ajuste a sus necesidades, garantizando la recepción de su compra.

- 

- Conoce más sobre:

- [Hacer entregas personales](https://www.mercadolibre.com.ar/ayuda/Hacer-entr-egas-personales_828) [¿Cómo gestionar de forma segura las ventas que tienen acuerdo de entrega?](https://www.mercadolibre.com.ar/ayuda/17177) [¿Cuándo y cómo hacer envíos por mi cuenta?](https://www.mercadolibre.com.ar/ayuda/827)

- 

- Ofrecer envío personalizado para tus productos

- Para crear un item con el envío personalizado en el POST a /items deberás enviar el modo “custom” junto a los diferentes costos con sus descripciones dentro de la sección de shipping.

- `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d { "title": "Anteojos Ray Ban Wayfare", "category_id": "MLA3636", "price": 10, "currency_id": "ARS", "available_quantity": 1, "buying_mode": "buy_it_now", "listing_type_id": "bronze", "condition": "new", "description": "Item:, Ray-Ban WAYFARER Gloss Black RB2140 901 Model: RB2140. Size: 50mm. Name: WAYFARER. Color: Gloss Black. Includes Ray-Ban Carrying Case and Cleaning Cloth. New in Box", "video_id": "YOUTUBE_ID_HERE", "warranty": "12 months by Ray Ban", "pictures": [ { "source": "http://upload.wikimedia.org/wikipedia/commons/f/fd/Ray_Ban_Original_Wayfarer.jpg" } ], "shipping": { "mode": "custom", "local_pick_up": false, "free_shipping": false, "methods": [], "costs": [ { "description": "TEST1", "cost": "70" }, { "description": "TEST2 ", "cost": "80" } ] } } https://api.mercadolibre.com/items/$ITEM_ID`

- Ahora, puedes ver el ítem con envío personalizado y la tabla de costos configurada en shipping options. Ten en cuenta que este recurso solo muestra información cuando el vendedor elige la opción custom.  Llamada:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/shipping_options?zip_code=$ZIP_CODE`

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA803066380/shipping_options?zip_code=$1234`

- Respuesta:

- `{ "destination": null, "options": [ { "id": "MLA803066380-0", "option_hash": "d02e7314a07319e7ae3df65c40c59114", "name": "TEST2 ", "currency_id": "ARS", "list_cost": 80, "cost": 80, "base_cost": null, "display": "always", "speed": null }, { "id": "MLA803066380-1", "option_hash": "c83f3c67e7df67b84da2a283a2c64a50", "name": "TEST1", "currency_id": "ARS", "list_cost": 70, "cost": 70, "base_cost": null, "display": "always", "speed": null } ], "buyer": { "id": null, "loyalty_level": null, "shipping_level": null }, "custom_message": { "reason": "", "display_mode": null } }`

- Notas:   - En países donde Mercado Envíos se encuentra activo, solo puedes agregar envíos custom gratis en categorías que no acepten Mercado Envíos. - Si no especificas el tipo de envío en la creación del ítem, el mismo será “to_be_agreed”.  - Si el usuario tiene configurada la opción Mercado Envíos por defecto, todas sus publicaciones se crearán bajo esa modalidad, con excepción de aquellas que tengan una categoría que no la soporte.

- Envío gratis en envíos personalizados

- Solo puedes ofrecerlo siempre y cuando la categoría no acepte Mercado Envíos. Deberás realizar directamente un PUT con el campo **free_shipping**  en **true** , sin costos ni descripciones.  Llamada:

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json"-d { "shipping": { "mode": "not_specified", "local_pick_up": false, "free_shipping": true, "methods": [], "costs": [] } } https://api.mercadolibre.com/items/$ITEM_ID`

- Agregar envío personalizado en productos

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d { "shipping": { "mode": "custom", "methods": [], "costs": [{ "description": "TEST1", "cost": "70" }, { "description": "TEST2 ", "cost": "80" } ] } } https://api.mercadolibre.com/items/$ITEM_ID`

- Agregar número de seguimiento

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d' { "tracking_number": 12345, "receiver_id": 12345678 } https://api.mercadolibre.com/shipments/$SHIPMENT_ID`

- Estados de envío y transiciones

- **Pending** : es el estado inicial con el cual se crea un envío personalizado. P, y que puede pasar a **Shipped** , **Delivered**  o **Cancelled** .  **Shipped** : es el estado enviado en el cual se pueden actualizar el Tracking ID y el tiempo de promesa de entrega, en horas.  **Delivered** : se refiere al estado de envío entregado y, se puede volver al estado de Pending o Shipped.  **Cancelled** : representa el estado de envío cancelado, no se puede pasar a ningún otro estado. El envío se anula.

- 

- Informar estado de entrega

- Con el siguiente recurso puedes informar a los compradores el status de entrega de sus productos cuando no utilicen Mercado Envíos. Utilízalo teniendo en cuenta los siguientes escenarios:

- 

- **Escenario 1**   Ocurre cuando la orden tiene un Custom Shipping creado y está en estado “pending”:

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json"-d { "speed": 120, "status":"shipped", "tracking_number": 1234, "receiver_id": 12345678, "comments": "Comentario opcional", } https://api.mercadolibre.com/shipments/$SHIPMENT_ID`

- Notas:   - El campo **speed**  representa la distancia en horas que va a demorar la entrega del producto. - La fecha de promesa de entrega será igual a la cantidad de horas especificadas en el campo **speed** , contadas a partir del día en que se indique este valor. - El campo **tracking_number**  es requerido para la API, pero no será en ningún listado y/o detalle de venta. El campo **receiver_id**  hay que tomarlo desde la información del envío.  El campo **comments**  es un campo opcional para agregar algún comentario sobre el envío. Sirve para gestión del vendedor.

- **Escenario 2**   Se da cuando la orden tiene un Custom Shipping creado y está en estado “shipped”:

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d { "speed": 120, "receiver_id": 12345678 } https://api.mercadolibre.com/shipments/$SHIPMENT_ID`

- Nota:   Solo se actualiza la promesa de entrega, por lo que no se requiere un **tracking_number**  de parte de la API.

- **Escenario 3**   En caso que haya que Informar que ya fue entregado:

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d { "status":"delivered", "receiver_id": 12345678 } https://api.mercadolibre.com/shipments/$SHIPMENT_ID`

- **Escenario 4**  Cuando sea necesario cancelar una venta:

- `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d { "status":"cancelled", "receiver_id": 12345678 } https://api.mercadolibre.com/shipments/$SHIPMENT_ID`
