<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/pagos -->
<!-- Sección: Guía para productos > Gestionar ventas -->

# Pagos

Última actualización 29/12/2025

## Gestiona pagos

Mercado Pago es la plataforma abierta de pagos de Mercado Libre. Si deseas integrar una solución de pagos en tu plataforma, puedes [ingresar a Mercado Pago Developers](https://www.mercadopago.com.br/developers/es/guides).

## Recibir una notificación

Para [recibir notificaciones de pagos](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#Suscr%C3%ADbete-notificaciones), asegúrate de suscribir tu aplicación al [tópico payments](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#payments). Conoce el resto de topics disponibles y más detalles sobre el tópico payments.

## Flujo de devolución de dinero en cuenta por ventas canceladas

Importante:

Solo está disponible para vendedores de México y próximamente, para aquellos de Argentina y Brasil.

Ante cancelaciones, los compradores con buena reputación y que realicen pagos con tarjeta de crédito o débito recibirán automáticamente la devolución con dinero en cuenta de Mercado Pago. De esta manera, la orden de compra queda en estado diferente respecto de los demás flujos. Los cambios serán:

- status = paid

- Nuevo tag: unfulfilled

Nota:

La orden jamás tendrá el status cancelled ya que mediante la devolución con dinero en cuenta genera que el pago debe concretarse. En el pago de la orden encontrarás el tag refund_account_money.

**Siguiente** : [Feedback de una venta](https://developers.mercadolibre.com.ar/es_ar/feedback-sobre-venta).
