<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/imagenes-y-moderaciones -->
<!-- Sección: FAQs -->

# Imágenes y moderaciones

Última actualización 05/05/2026

[FAQs](https://developers.mercadolibre.com.ar/es_ar/faq-preguntas-frecuentes) › Imágenes y moderaciones

## Imágenes y moderaciones

¿Por qué algunas imágenes devuelven error 403 o quedan "pendientes" en la API al publicar?

Un 403 suele indicar que el servidor que hospeda la imagen bloquea el acceso (firewall, whitelist de IPs) o que la URL no es accesible para la plataforma; además, en publicaciones asociadas al catálogo las imágenes pueden estar gestionadas por el catálogo y no ser modificables vía API.

Recomendación

Asegúrese de que las URLs de las imágenes sean accesibles públicamente desde la plataforma y que el host permita las IPs necesarias; si la imagen pertenece al catálogo, revise la gestión del catálogo.

¿La API soporta imágenes en formato WebP o debo usar JPG/PNG?

El sistema procesa múltiples formatos (JPG, PNG, WebP, GIF). Mercado Libre puede optimizar y servir imágenes en WebP, por lo que la aparición de .webp en el array de pictures es esperada y no requiere cambio en la integración.

Recomendación

Puede subir JPG/PNG normalmente; el sistema puede convertir o servir WebP internamente, por lo que no es necesario reemplazar formatos actuales.

¿Cómo evitar 429 al usar el endpoint de diagnóstico de imágenes?

Evite picos de llamadas y distribuya las solicitudes; no hay un modo masivo público en todos los casos, por lo que hay que gestionar rate limits con backoff exponencial, batching y optimización de requests para no saturar el endpoint.

Recomendación

Agrupe diagnósticos en lotes cuando sea posible, espacie llamadas y aplique backoff con jitter para minimizar 429.
