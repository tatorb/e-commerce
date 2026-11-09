<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mercado-envios-costos-y-cotizaciones -->
<!-- Sección: FAQs -->

# Mercado Envíos - Costos y cotizaciones

Última actualización 05/05/2026

[FAQs](https://developers.mercadolibre.com.ar/es_ar/faq-preguntas-frecuentes) › Mercado Envíos - Costos y cotizaciones

## Mercado Envíos - Costos y cotizaciones

¿Qué parámetros mínimos debo enviar a /users/{user_id}/shipping_options/free para obtener una cotización coherente?

El endpoint requiere más contexto que solo dimensions: conviene enviar item_id o, si se usa dimensions, además item_price, listing_type_id, mode/logistic_type y free_shipping si aplica. Solo enviar dimensions sin otros parámetros puede devolver list_cost=0 porque no hay suficiente contexto para calcular el costo.

Recomendación

Incluya item_price, logistic_type y listing_type_id o el item_id en la consulta para obtener cotizaciones coherentes y evitar valores nulos.

¿En qué unidad debo enviar el peso en el parámetro dimensions (ej. 0.7605)?

El peso en dimensions debe ser pasado en gramos como entero (number_unit). Convierte 0.7605 kg a gramos (ej. 761 g) y envíalo como valor entero; el API no acepta fracciones en kilogramos en ese campo.

Recomendación

Normalice pesos a gramos enteros antes de enviar y redondee según las reglas de negocio para evitar rechazos por formato.

¿Cómo determino, desde la API, si el vendedor recibió el cobro del flete o si éste fue subsidiado (envío gratis)? ¿Qué campos debo usar?

Para saber quién pagó el flete, consulte /shipments/{id}/costs. receiver.cost refleja el costo final pagado por el comprador; senders[].cost refleja el monto asociado al vendedor. Si receiver.cost == 0, el comprador no pagó el flete. Si senders[].cost == 0, el vendedor no fue cobrado. Los campos promoted_amount y save son informativos, pero los valores determinantes son receiver.cost y senders[].cost.

Recomendación

Use /shipments/{id}/costs y consulte receiver.cost y senders[].cost para determinar la transferencia real de costos entre comprador y vendedor.

¿Qué representa promoted_amount o save en los objetos de costos?

promoted_amount puede representar el monto final subsidiado; en algunos flujos receiver.promoted_amount refleja el monto cubierto, pero para cálculo de reembolsos y costos al vendedor, use senders[].cost. El campo save es informativo y su uso puede variar según la lógica interna; no siempre debe usarse como base para facturación.

Recomendación

Use senders[].cost para cálculos financieros y trate promoted_amount/save como campos informativos que requieren validación según el contexto.

¿Por qué la cotización por API puede diferir del valor que muestra el front?

Las discrepancias pueden ocurrir si no se envían todos los parámetros necesarios (dimensions, item_price, logistic_type), si hay simulaciones en front o si existen reglas de contingencia. La recomendación es usar /shipments/{id}/costs para obtener el costo final que aplicará al pedido.

Recomendación

Proporcione todos los parámetros requeridos en la consulta y consulte /shipments/{id}/costs para el valor definitivo aplicado al pedido.

¿En qué moneda se devuelve el costo de envío por el endpoint /users/{user_id}/shipping_options/free?

El costo de envío se devuelve en la moneda del sitio (p. ej. UYU para MLU). Si trabajas con precios en otra moneda, debes convertir el valor devuelto a la moneda que uses para tu cálculo.

Recomendación

Tenga en cuenta la moneda del sitio en sus cálculos y convierta las cotizaciones según sea necesario para mantener consistencia.

¿Qué campo de la API refleja el costo final que paga el vendedor por un envío (para conciliaciones)?

Para conocer lo cobrado al vendedor, consulte senders[].cost en /shipments/{id}/costs; receiver.cost muestra lo que paga el comprador. promoted_amount y campos de discounts explican subsidios o bonos aplicados.

Recomendación

Use /shipments/{id}/costs (senders/receiver) como fuente para conciliaciones y combine con sale_fee_amount y campos de descuentos para calcular subsidios.
