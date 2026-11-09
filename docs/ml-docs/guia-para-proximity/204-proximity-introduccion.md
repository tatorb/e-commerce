<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/proximity-introduccion -->
<!-- Sección: Guía para Proximity -->

# Introducción

Última actualización 08/03/2026

## Introducción

Mercado Pago Delivery es una solución de entrega de comidas a pedido en la que el cliente ingresa a una lista de restaurantes registrados, selecciona su pedido.

Contacto comercial requerido

Sólo puedes integrar este producto si tu contacto comercial te compartió toda la información necesaria para hacerlo.

### Disponibilidad por país

## Beneficios

Puedes integrar el PDV/POS de tu restaurante con Mercado Pago Delivery para:

| Beneficio | Descripción |
| --- | --- |
| **Lista** | Estar en la lista de restaurantes registrados. |
| **Pedidos** | Recibir y aceptar pedidos automáticamente. |
| **Inventario** | Administrar fácilmente el inventario y las finanzas. |
| **Conciliación** | Cerrar la caja de manera eficiente utilizando la solución de conciliación ya integrada, mostrando en detalle todas las transacciones financieras realizadas. |

## Integración

La integración del PDV con Mercado Pago Delivery se realiza a través de APIs o de la herramienta Gestor de Pedidos en el panel de negocios de Mercado Pago, encargado de controlar todo el flujo de una orden para los restaurantes que no cuentan con un software de gestión integrado con Mercado Pago. Una vez integrado, las notificaciones de nuevas órdenes se envían al PDV/POS que consulta los datos de la orden y la acepta.

## Tipos de pago aceptados

Para obtener detalles sobre los medios de pago aceptados en cada país, consulte la lista completa con [disponibilidad de medios de pago](https://www.mercadopago.com.ar/developers/es/docs/sales-processing/payment-methods).

## Requisitos previos

Para poder integrar Mercado Pago Delivery con tu PDV/POS, debes cumplir con los siguientes requisitos.

| Requisitos | Descripción |
| --- | --- |
| **Permiso de uso** | Para habilitar tu aplicación para esta integración y consumir las APIs citadas en la documentación, contacta a tu **ejecutivo comercial** . |
| **Cuenta Mercado Pago** | Es necesario que el integrador tenga una cuenta en Mercado Pago para crear una aplicación. Con una aplicación puedes configurar tu Webhook, para recibir notificaciones de nuevos pedidos, y generar tus credenciales. Si no la tienes, [haz clic aquí](https://www.mercadopago.com.ar/hub/registration/fiscal-splitter?origin=router) para crearla. |
| **Credenciales** | Las [credenciales](https://www.mercadopago.com.ar/developers/es/docs/mp-delivery/additional-content/your-integrations/credentials) son contraseñas únicas con las que identificamos una integración en tu cuenta, y que sirven para capturar pagos en tiendas virtuales y otras aplicaciones de forma segura. |
| **Access Token** | Mediante el protocolo de autorización OAuth, cada restaurante debe autorizar a la aplicación creada en la cuenta del integrador para recibir notificaciones de nuevos pedidos. Además, cada restaurante tendrá un Access Token los cuales serán utilizados para realizar operaciones utilizando las APIs de Mercado Pago Delivery. Consulta [OAuth](https://www.mercadopago.com.ar/developers/es/docs/mp-delivery/additional-content/security/oauth/introduction) para entender el flujo de autorización que se debe hacer con los restaurantes. |
