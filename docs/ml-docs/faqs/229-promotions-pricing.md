<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/promotions-pricing -->
<!-- Sección: FAQs -->

# Promotions / Pricing

Última actualización 05/05/2026

[FAQs](https://developers.mercadolibre.com.ar/es_ar/faq-preguntas-frecuentes) › Promotions / Pricing

## Promotions / Pricing

¿Por qué los porcentajes o valores que devuelve la API de campañas o price_to_win pueden diferir de lo que muestra el front del sitio?

El frontend puede aplicar decoraciones en tiempo real o recálculos de presentación, mientras que la API devuelve los valores tal como están en el motor en el momento de la consulta; por eso pueden existir discrepancias entre ambos.

Recomendación

Utilice los datos de la API para decisiones programáticas y considere que el front puede ajustar valores para presentación; valide con ejemplos reales si requiere concordancia exacta.

Si una oferta figura como "candidate" en la API pero aparece activa en el front, ¿qué puede estar pasando?

Algunas campañas y procesos son asíncronos; una oferta puede estar como candidate en la API hasta que finalice la activación, mientras que el front puede mostrar el estado publicado por reglas de visualización o por procesamiento reciente.

Recomendación

Verifique fechas de start_date/end_date y el estado de la campaña; considere que ciertos tipos de campaña requieren procesamiento final para mostrarse como started en la API.

price_to_win indica que "ganamos" pero el front muestra otro vendedor en destaque; ¿qué causa la diferencia?

El motor price_to_win evalúa condiciones en el instante de la consulta, mientras que el front puede aplicar recálculos por geolocalización, disponibilidad Full/SameDay o ventanas horarias que alteran el vendedor destacado; por eso el estado puede diferir entre API y front.

Recomendación

Revise la configuración de zonas y parámetros logísticos; considere que la visualización front puede incorporar reglas adicionales en tiempo real.
