<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/me1-me2-y-envio-gratis -->
<!-- Sección: FAQs -->

# ME1 / ME2 y envío gratis

Última actualización 14/08/2026

[FAQs](https://developers.mercadolibre.com.ar/es_ar/faq-preguntas-frecuentes) › ME1 / ME2 y envío gratis

## ME1 / ME2 y envío gratis

¿Por qué setear shipping.mode = "me1" vía API no muestra envío gratis en el frontend aunque free_shipping:true esté en el item?

En ME1 el flag free_shipping:true puede existir en los datos, pero Mercado Libre no lo interpreta automáticamente como "envío gratis" en el frontend ni le aplica los beneficios automáticos de ME2. La visibilidad y beneficios de "Envío gratis" están diseñados para ME2; para que el frontend muestre el envío gratis con los beneficios automáticos, el ítem debe estar en modo me2.

Recomendación

Si necesita la exhibición y beneficios automáticos de envío gratis, verifique que el ítem esté en modo ME2 y cumpla los requisitos de elegibilidad del mercado.

¿Por qué al intentar cambiar un ítem de ME2 a ME1 la API lo deja como not_specified?

Si la cuenta o las preferencias de usuario tienen coexistencia priorizada a ME2 (por ejemplo, tags como me2_available o preferencias), la plataforma puede impedir la conversión a ME1 y devolver not_specified. La razón suele ser la configuración de la cuenta y las preferencias comerciales; la conversión a ME1 puede requerir intervención comercial (KAM) para ajustar las preferencias de envío.

Recomendación

Revise las preferencias comerciales y tags del seller; si la conversión falla, coordine con el equipo comercial para ajustar la configuración de convivencia.

¿Es obligatorio estar en ME2 para que se activen automáticamente opciones como "envío gratis a todo el país"?

Sí: muchas de las reglas automáticas de muestra y beneficios (por ejemplo, "Envío gratis" con beneficios) se aplican preferentemente a ítems en modo ME2 y dependen además del umbral de precio y otras políticas internas. No es posible forzar vía API el beneficio global si no se cumplen esas condiciones.

Recomendación

Compruebe elegibilidad para ME2 y los umbrales requeridos; no intente forzar beneficios por API sin cumplir las condiciones del mercado.

¿Se puede forzar por API el envío gratis a todo el país?

No. La activación de envío gratis a nivel nacional depende de reglas automáticas (precio, tipo de logística como ME2) y no se puede forzar vía API sin cumplir esos requisitos.

Recomendación

Ajuste precios y logística para cumplir las condiciones del mercado; no espere poder habilitar envío gratis nacional únicamente por API.

¿Por qué configurar shipping.mode = "me1" vía API retorna HTTP 200 pero el ítem permanece con logistic_type "not_specified"?

Cuando se actualiza el modo de envío de un anuncio a ME1 mediante PUT /items con shipping.mode = "me1", la API puede devolver una respuesta 200 exitosa sin que el cambio se aplique efectivamente en el marketplace. Esto ocurre cuando el vendedor tiene Mercado Envios 2 (ME2) habilitado a nivel de cuenta — la plataforma prioriza automáticamente ME2 y anula la configuración de ME1 establecida vía API. No se trata de un error de integración sino de una regla de negocio a nivel de cuenta que tiene precedencia sobre las llamadas API.

Recomendación

Si necesitas que la configuración de ME1 surta efecto para un vendedor, asegúrate de que los ajustes de convivencia entre ME1 y ME2 estén configurados correctamente a través del equipo comercial o KAM del vendedor. Intentar forzar ME1 solo vía API no tendrá efecto si ME2 está habilitado a nivel de cuenta.
