<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/buenas-practicas-para-uso-de-la-plataforma -->
<!-- Sección: Primeros pasos -->

# Buenas prácticas para uso de la plataforma

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Buenas prácticas para uso de la plataforma

Tenga en cuenta que al ser una aplicación integrada con API de MeLi las acciones tienen un impacto más grande cuando se ejecutan acciones masivas en las cuentas de vendedores, con lo cual, el mal uso de la plataforma puede generar sanciones en sus cuentas.
 Sigue las recomendaciones a continuación para así evitar penalizaciones en las cuentas de vendedores.

### Moderaciones o suspensión de cuentas por:

## Envío de mensajes automáticos

- Utiliza siempre los [motivos para comunicarse](https://developers.mercadolibre.com.ar/es_ar/motivos-para-comunicarse), exclusivamente en los escenarios especificados.

- No está permitido enviar mensajes automáticos (repetitivos o templates) de ningún tipo, debido a que serán bloqueados por MercadoLibre.

- Evita el envío de mensajes innecesarios como 'recibimos tu compra' o actualización de status del envío, ya que desde la integración es posible [actualizar el estado para pedidos ME1](https://developers.mercadolibre.com.ar/es_ar/estados-de-ordenes-me1), mientras que para ME2 la actualización sucede desde MeLi y se le informa al comprador.

- Los mensajes repetitivos o innecesarios generan spam y una mala experiencia al comprador. Por esta razón, informamos a nuestros vendedores [cómo y cuándo enviar un mensaje postventa](https://vendedores.mercadolibre.com.ar/nota/mensajes-de-la-venta-aprende-cuando-utilizarlos-y-ahorra-tiempo-en-tu-gestion) y así entender estratégicamente en qué momentos contactar al comprador para ahorrar tiempo y esfuerzo.

## Modificación en template de etiquetas

- No está permitido cualquier cambio en el template de las etiquetas generadas desde Mercado Libre.

## Clonación de publicación

- No recomendamos clonar las publicaciones. Este escenario será moderado por las políticas de publicación de MeLi. Conoce más sobre [Anuncios Duplicados](https://www.mercadolibre.com.ar/ayuda/2517#suggest).

- Tampoco recomendamos clonar imágenes. Conoce [cómo tomar buenas imágenes](https://www.mercadolibre.com.ar/ayuda/805#suggest).

## Uso de las funcionalidades para los tipos de productos

- Ítems elegibles para catálogo siempre deben ser [publicados en catálogo o hacer el optin](https://developers.mercadolibre.com.ar/es_ar/que-es-catalogo).

- Ítems de autopartes (piezas) siempre deben tener las [compatibilidades asociadas](https://developers.mercadolibre.com.ar/es_ar/compatibilidades-entre-items-y-productos) e informar las excepciones correspondientes.

- Ítems de moda siempre deben ser publicadas con la [guía de talles asociada](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles).

Siendo una API abierta de Mercado Libre, debes tener en cuenta algunas consideraciones técnicas importantes:

### Web Crawler:

- No hacer web crawling, sino que siempre trabajar con la API de MeLi.
 - Es recomendable [limitar los IPs](https://developers.mercadolibre.com.ar/es_ar/gestionar-ips-de-una-aplicacion) de tu ambiente para utilizar el access token de tu aplicación.
 - Ten en cuenta que existen límites de requisiciones en algunos endpoints, es decir, debes identificar el error 429 recibidos en tu integración y disminuir y/o mejorar la distribución de requisiciones realizadas a lo largo del tiempo.
