<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/rate-limit-error-429 -->
<!-- Sección: FAQs -->

# Rate Limit / Error 429

Última actualización 05/05/2026

[FAQs](https://developers.mercadolibre.com.ar/es_ar/faq-preguntas-frecuentes) › Rate limit / Error 429

## Rate limit / Error 429 y pedidos de aumento de RL

¿Qué debo hacer cuando la API devuelve 429 Too Many Requests?

429 indica exceso de peticiones en un corto período. Implementar backoff y retries (pausas con jitter), distribuir requests (evitar picos), consumir el scroll completamente antes de expirar y validar que no haya retries masivos. Para operaciones masivas use batching prudente y evite concurrencia extrema.

Recomendación

Aplique backoff exponencial con jitter, reduzca concurrencia y consolide llamadas para minimizar la probabilidad de 429.

¿La API de visitas o de diagnóstico de imágenes soporta multiget grande o requests masivas sin provocar 429?

Muchas APIs no soportan multiget amplio; por ejemplo, items/visits acepta un solo product_id por consulta. Si es necesario reducir llamadas, diseñe batching, use intervalos y limite RPM; para diagnóstico de imágenes no hay un multiget oficial, por lo que debe limitarse el ritmo y considerar requests en masa solo si el endpoint lo soporta.

Recomendación

Respete las limitaciones de cada endpoint, implemente batching controlado y espacie peticiones cuando el endpoint no soporte multiget.

¿El rate limit se aplica por IP, por Client ID o por usuario?

El control principal se aplica por Client ID (aplicación) en la mayoría de los casos y por pieza de endpoint; no se considera el tamaño del payload para cálculo del límite. Es recomendable distribuir el consumo de la app y solicitar aumento de cuota en casos de volumen legítimo mediante los canales correspondientes.

Recomendación

Monitoree el consumo por Client ID y solicite aumentos de cuota con evidencia de uso si necesita mayor RPM.

¿Por qué recibo 429 al usar scroll_id en búsquedas y cómo evitarlo?

El scroll expira (tiempo limitado) y el consumo repetido o abierto por mucho tiempo genera 429 (sobre cuota). Consuma las páginas del scroll dentro del tiempo de vigencia, reduzca concurrencia, y añada backoff y retries con jitter para evitar picos.

Recomendación

Procese el scroll de forma continua dentro del tiempo de vida y reduzca llamadas concurrentes para evitar expiraciones y 429.

¿Puedo combinar offset/limit con scroll_id en el mismo request?

No. Usar scroll_id junto con offset/limit o parámetros incompatibles causará errores. Utilice el método de paginación adecuado a cada endpoint y respete el mecanismo elegido (scroll o offset).

Recomendación

No mezcle mecanismos de paginación; elija scroll o offset según la API y ajuste su implementación en consecuencia.

¿Existe forma de solicitar aumento de RPM para endpoints de stock?

Para necesidades de alto volumen contacte al equipo de integraciones comerciales con evidencia de uso; mientras tanto, optimice llamadas (batching, consolidación por user_product) para reducir RPM y evitar bloqueos.

Recomendación

Optimice llamadas y consolide operaciones por user_product mientras gestiona la solicitud de aumento de cuota con el equipo comercial.
