<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mensajes-bloqueados -->
<!-- Sección: Guía para productos > Mensajería posventa -->

# Mensajes bloqueados

Última actualización 22/10/2026

## Mensajes bloqueados

Recuerda que moderamos los links acortados con las siguientes herramientas:

- Bitly

- Bl.ink

- Polr

- Rebrandly

- T2M

- TinyURL

- URL Shortener by Zapier

- Yourls

## Consultar mensajes bloqueados

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/$PACK_ID/sellers/$SELLER_ID?tag=post_sale
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/messages/packs/22175467/sellers/32086568493?tag=post_sale
```

Respuesta:

```
{
    "paging": {
        "limit": 10,
        "offset": 0,
        "total": 4
    },
    "conversation_status": {
        "path": "/packs/22175467/sellers/32086568493",
        "status": "blocked",
        "substatus": "blocked_by_buyer",
        "status_date": "2020-01-10T19:58:04.317Z",
        "status_update_allowed": false,
        "claim_ids": null,
        "shipping_id": null
    },
    "messages": [...]
}
```

## Campos de la respuesta

### status

Este campo acepta dos valores:

- **active:**  la conversación está abierta para enviar/recibir mensajes

- **blocked:**  la conversación está cerrada para enviar/recibir mensajes

### substatus

Motivos por los cuales bloqueamos ciertos mensajes posventa para mejorar la experiencia del comprador:

| Substatus | Descripción |
| --- | --- |
| **blocked_by_time** | El vendedor podrá responder siempre que no hayan pasado 30 días desde el último mensaje. El plazo para recibir mensajes expiró y solo se reabrirá si el comprador así lo decide. |
| **blocked_by_buyer** | El comprador decide bloquear la recepción de mensajes. |
| **blocked_by_mediation** | Existe una mediación en proceso entre el comprador y el vendedor. |
| **blocked_by_fulfillment** | Por ser una venta con Fulfillment, la mensajería estará disponible cuando el paquete sea entregado (estado de envío: delivered). |
| **blocked_by_payment** | El pago aún no fue realizado o aún no fue procesado. Una orden no se encuentra pagada cuando tiene alguno de los estados: payment_required, payment_in_process o partially_paid. Este bloqueo es temporal hasta que el pago sea realizado. |
| **blocked_by_conversation_initiated_by_seller** | La compra en totalidad es de productos de Supermercado y el vendedor inicia la conversación. Aplica en Argentina, México y Brasil. Cuando el comprador inicie la conversación, la mensajería del vendedor no será bloqueada. |
| **blocked_by_conversation_use_message_api** | El vendedor intenta comunicarse por action-guide cuando el comprador ya inició la conversación. |
| **blocked_by_conversation_initiated_by_seller_limited** | Este bloqueo se aplica para ventas con Mercado Envíos 2. Deberás utilizar el recurso [Motivos para comunicarse](https://developers.mercadolibre.com.ar/es_ar/motivos-para-comunicarse?nocache=true). Cuando el asistente de IA inicie la conversación, la mensajería del vendedor no será bloqueada. |
| **blocked_by_cancelled_order** | No puedes comunicarte, pues la venta está cancelada. |
| **blocked_by_cancelled_order_by_fraud** | No puedes comunicarte, porque la venta está cancelada por comportamientos irregulares. Los mensajes no estarán disponibles por punto de riesgo. |
| **blocked_by_mediation_fbm** | El vendedor no puede comunicarse porque existe una mediación en proceso en una venta Fulfillment. |
| **blocked_by_conversation_expired** | La mensajería queda bloqueada y no son retornados los mensajes cuando ML detecta que han pasado 18 meses desde la fecha de compra. |
| **blocked_by_refund** | El vendedor no puede comunicarse con el comprador, pues fue realizado un reembolso parcial o total sobre la orden. Solo se reabrirá si el comprador envía un nuevo mensaje. |
| **blocked_by_claim_change_closed** | La mensajería de reclamación se encuentra bloqueada porque existe un cambio de producto en proceso asociado a la orden. |
| **blocked_by_deactivated_account** | La mensajería se encuentra bloqueada porque el comprador o vendedor eliminó su cuenta. |
| **blocked_by_restrictions** | La mensajería se encuentra bloqueada porque existe una restricción sobre el vendedor o comprador. |
| **blocked_by_cancelled_order_hidden** | No puedes comunicarte, pues la compra/venta no logró ser procesada y fue cancelada. La orden solo será visible para el comprador. |
| **blocked_by_claim_change_open** | La mensajería se encuentra bloqueada porque existe un cambio de producto en proceso asociado a la orden. |
| **blocked_by_message_pending_review** | El vendedor no puede comunicarse con el comprador porque la conversación se encuentra bajo revisión. Podrá hacerlo después de la revisión de los mensajes. |
| **blocked_by_return_to_buyer_fulfillment** | La mensajería se encuentra bloqueada para los casos donde, después de la revisión de clasificación en fulfillment, se decide devolver el producto al comprador por incumplimiento de las políticas de devolución. |
| **blocked_by_ai_assistant** | La mensajería con el comprador está deshabilitada porque es una venta Fulfillment y el asistente de IA está activado. |
| **blocked_by_ai_assistant_expired** | La mensajería con el asistente de IA se encuentra expirada. |
| **blocked_by_ai_assistant_contact_closed** | La mensajería con el asistente de IA se encuentra cerrada por consulta finalizada. |
| **block_by_ai_assistant_initiated_by_seller_expired** | La mensajería iniciada por el vendedor con el asistente de IA se encuentra expirada. |
| **blocked_by_resale** | La mensajería se encuentra deshabilitada porque en la venta hay al menos un producto de reventa. |
| **blocked_by_proximity_groceries** | La mensajería se encuentra deshabilitada porque la venta corresponde a una compra de supermercado con entrega inmediata (Proximity). |

### status_date

Es la fecha cuando el estado de la conversación fue actualizado.

**Volver:**  [Gestión de mensajes](https://developers.mercadolibre.com.ar/es_ar/mensajeria-post-venta).
