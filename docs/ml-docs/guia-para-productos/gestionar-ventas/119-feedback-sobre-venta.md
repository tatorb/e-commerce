<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/feedback-sobre-venta -->
<!-- Sección: Guía para productos > Gestionar ventas -->

# Feedback de una venta

Última actualización 29/12/2025

## Feedback sobre venta

Una vez concretada una venta (o compra), el vendedor podrá dejar su feedback sobre la transacción y calificar a la contraparte.
 Cuando se califica la operación como concretada, para envíos "custom" y "me1" se indica que ya se entregó el producto; por eso es importante recordar que este proceso recién debe realizarse cuando se tenga seguridad de que el producto fue entregado al comprador. De esta forma, cuando el vendedor califique, se le enviará un mensaje al comprador preguntándole sobre la venta y solicitándole que confirme la recepción del producto de dicha venta.
 Actualmente, esta acción sólo es válida para realizar el seguimiento de los estados de envío entregados, es decir, no impacta de ninguna manera en la reputación del Seller involucrado; siempre deberá aplicarse para modificar el estado a entregado en ventas sin Mercado Envíos, lo que mueve estas ventas a las listas de finalizadas.

## Descripción de recursos

| Atributo | Descripción |
| --- | --- |
| **fulfilled** | Indica si la operacion se concreto o no. Valores posibles: True / False. Obligatorio. |
| **message** | Cadena con menos de 160 caracteres. Obligatorio |
| **rating** | Calificación de la operación. Valores posibles son: ‘negative’, ‘neutral’ o ‘positive’ (solo en caso de ‘fulfilled’: ‘true’) Obligatorio. |
| **reason** | Motivo Valores posibles: ver información en “[Valores aceptados para enviar como reason](https://developers.mercadolibre.com.ar/es_ar/feedback-sobre-venta?nocache=true#motivo)” Obligatorio. (En caso que ‘fulfilled’: ‘false’) |
| **restock_item** | Indica que el pedido no fue completado, por tal motivo se debe reponer el artículo. La única restricción para la reposición es que el estado del artículo no puede ser cerrado. Valores posibles: true / false |

## Valores aceptados para enviar como "reason"

Los motivos disponibles para los vendedores son:

- OUT_OF_STOCK: Sin stock

- BUYER_NOT_ENOUGH_MONEY: El comprador no tiene el dinero suficiente

- BUYER_REGRETS: El comprador se arrepintió de la operación

- SELLER_REGRETS: El vendedor se arrepintió de la operación

- BUYER_DID_NOT_ANSWER: El comprador no responde

- THEY_NOT_HONORING_POLICIES: El comprador no está honrando las políticas

- OTHER_MY_RESPONSIBILITY: Es responsabilidad propia (otro motivo)

- OTHER_THEIR_RESPONSIBILITY: Es responsabilidad de la contraparte (otro motivo)

- DUBIOUS_BUYER: Comprador no es confiable

- HIGH_ML_COMISSION: Comisión de venta es muy elevada

- HIGH_TAXES: Impuestos muy elevados

- SELLER_HOLIDAY: No se está operando por vacaciones

- UNFRIENDLY_SHIPMENT_POLICY: Comprador no acepta la política de envío

- UNAVAILABLE_PRODUCT: No está disponible el producto

- SELLER_ADDRESS_WITHDRAWAL: Comprador prefiere retirar personalmente

- WRONG_RECEIVER_ADDRESS: Direccion erronea de entrega

- HIGH_SHIPMENT_COST: Costos de envío muy elevado

- WRONG_SHIPMENT_COST: Costo de envío mal calculado

- UNPRINTED_LABEL: No se puede imprimir etiqueta

- UNWITHDRAWN_PRODUCT_BY_DELIVER_COMPANY: Compañia de envio no retiro el producto para la entrega

- DENIED_PACKAGE: Compañia de envio no acepta el paquete debido al tamaño o al peso

- UNABLE_TO_READ_LABEL: Compañia de envio no puede leer etiqueta

- MANUFACTURING_PRODUCT_NOT_FINISHED: Producto manufacturado sin terminar

- SHIPMENT_PROBLEM_OTHER: Envío tuvo algún otro problema

- DELIVERY_COMPANY_PROBLEM_OTHER: Compañia de envio tuvo otro problema

Los motivos disponibles para los compradores son:

- OUT_OF_STOCK: Sin stock

- BUYER_PAID_BUT_DID_NOT_RECEIVE: El comprador efectuó el pago pero no recibió el producto

- OTHER_MY_RESPONSIBILITY: La responsabilidad es propia (otro motivo)

- BUYER_REGRETS: El comprador se arrepintió de la operación

- HIGH_SHIPMENT_COST: Costo elevado del envío

- SELLER_DID_NOT_ANSWER: Vendedor no responde

- THEY_NOT_HONORING_POLICIES: Vendedor no está honrando las políticas

- OTHER_THEIR_RESPONSIBILITY: Responsabilidad de contraparte (Otro motivo)

- DESCRIPTION_DIDNT_MATCH_ARTICLE: Descripción no se corresponde con el artículo

## Publicar feedback

Para asociar feedback a un pedido, realiza una solicitud POST al pedido como se muestra a continuación:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
  "fulfilled": false,
  "rating": "neutral",
  "message": "Operation not completed",
  "reason": "OUT_OF_STOCK",
  "restock_item": false,
}'
https://api.mercadolibre.com/orders/$ORDER_ID/feedback
```

Notas:

- El vendedor no puede realizar un feedback “no concretado” una vez que la orden expiró. 
 **Status** : 400
 **Error** : not_fulfilled_feedback_in_order_expired.
 **Mensaje de error** : You can't submit a not fulfilled feedback after order has expired.
 - No se permite la creación de un feedback más de una vez, al hacer nuevamente ese POST recibirás un error 400.

## Responder al feedback

Puedes responder al feedback recibido de tus socios comerciales para explicar tus motivos u ofrecer información adicional con una solicitud POST a la API, incluyendo el feedback_id, como se describe a continuación:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d'{
"reply":"Muchas gracias por la buena predisposición"
}' 
https://api.mercadolibre.com/feedback/$FEEDBACK_ID/reply
```

## Consultar feedbacks de una venta

Nota:

Los vendedores pueden acceder a feedbacks de ventas con una antigüedad de hasta 5 (cinco) años.

Con la siguiente llamada GET a /orders/$order_id/feedback puedes consultar los feedbacks realizados sobre las ventas y en la respuesta obtendrás, además, el feedback_id:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/orders/$ORDER_ID/feedback
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/orders/2000003508419013/feedback
```

Respuesta:

```
{
	"sale": {
		"reason": null,
		"item": {
			"price": 275.48,
			"id": "MLB1179412386",
			"title": "Capa Térmica Para Piscina Thermocap Preta 7,5x3 Metros",
			"currency_id": "BRL"
		},
		"role": "seller",
		"extended_feedback": [],
		"date_created": "2020-09-25T16:33:29.000-04:00",
		"fulfilled": true,
		"rating": "positive",
		"visibility_date": "2020-09-29T18:39:35.000-04:00",
		"restock_item": false,
		"message": null,
		"has_seller_refunded_money": null,
		"site_id": "MLB",
		"modified": false,
		"from": {
			"nickname": "OLIST",
			"id": 219324699,
			"status": "active",
			"points": 702811
		},
		"id": 5040068160032,
		"to": {
			"nickname": "OLAD3975325",
			"id": 230788845,
			"status": "active",
			"points": 22
		},
		"reply": null,
		"order_id": 2000003508419013,
		"app_id": "1505",
		"status": "active"
	},
	"purchase": {
		"reason": null,
		"item": {
			"price": 275.48,
			"id": "MLB1179412386",
			"title": "Capa Térmica Para Piscina Thermocap Preta 7,5x3 Metros",
			"currency_id": "BRL"
		},
		"role": "buyer",
		"extended_feedback": [],
		"date_created": "2020-09-29T18:39:36.000-04:00",
		"fulfilled": true,
		"rating": "positive",
		"visibility_date": "2020-09-29T18:39:35.000-04:00",
		"message": "Produto chegou no prazo!",
		"has_seller_refunded_money": null,
		"site_id": "MLB",
		"modified": false,
		"from": {
			"nickname": "OLAD3975325",
			"id": 230788845,
			"status": "active",
			"points": 22
		},
		"id": 5040068164512,
		"to": {
			"nickname": "OLIST",
			"id": 219324699,
			"status": "active",
			"points": 702811
		},
		"reply": null,
		"order_id": 2000003508419014,
		"app_id": "1505",
		"status": "active"
	}
}
```

Existen feedback_id para cada transacción: venta y compra. En este ejemplo, el “id”: 5040068160032 es el feedback que dio el vendedor al comprador, mientras que el “id”: 5040068164512 es el feedback que dio el comprador al vendedor.

Nota:

En el caso de envíos sin Mercado Envíos (o Envíos Personalizados), es fundamental contar con el feedback de la venta para su cierre exitoso. Está es la confirmación de que el comprador ha recibido su producto y está satisfecho con la transacción. Para validar que un feedback de venta se ha recibido adecuadamente, es importante verificar ciertos atributos, como por ejemplo:
 
 "role": "buyer",
 "extended_feedback": [],
 "date_created": "2020-09-29T18:39:36.000-04:00",
 "fulfilled": true,
 "rating": "positive",
 "visibility_date": "2020-09-29T18:39:35.000-04:00",
 "message": "Produto chegou no prazo!",
 "has_seller_refunded_money": null,
 "site_id": "MLB"
 
 Es importante destacar que una vez que se ha recibido el feedback de venta y se ha confirmado que la transacción se ha cumplido con éxito, el pago se libera para el vendedor. Este es un paso fundamental para garantizar la confiabilidad y la eficiencia en todas las transacciones realizadas a través de Mercado Libre.

## Consultar el feedback

También puedes realizar una solicitud GET para obtener los detalles de un feedback, solo del seller, usando el ID del feedbak de "sale" obtenido en Orders, como se muestra a continuación:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/feedback/$FEEDBACK_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/feedback/9041207884458
```

Respuesta:

```
{
	"adult_content": false,
	"reason": null,
	"item": {
		"price": 275.48,
		"id": "MLB1179412386",
		"title": "Capa Térmica Para Piscina Thermocap Preta 7,5x3 Metros",
		"currency_id": "BRL"
	},
	"role": "seller",
	"extended_feedback": [],
	"date_created": "2020-09-25T16:33:29.000-04:00",
	"fulfilled": true,
	"rating": "positive",
	"visibility_date": "2020-09-29T18:39:35.000-04:00",
	"restock_item": false,
	"message": null,
	"has_seller_refunded_money": null,
	"site_id": "MLB",
	"modified": false,
	"from": {
		"nickname": "OLIST",
		"id": 219324699,
		"status": "active",
		"points": 702831
	},
	"id": 9041207884458,
	"to": {
		"nickname": "OLAD3975325",
		"id": 230788845,
		"status": "active",
		"points": 22
	},
	"reply": null,
	"order_id": 2000003508419015,
	"status": "active"
}
}
```

## Modificar el feedback

Ya aprendiste cómo realizar una solicitud GET para obtener el feedback_id de la otra parte con solo realizar una solicitud POST a la API como se muestra a continuación:

```
curl-X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d '{
  "fulfilled": true,
  "rating": "positive",
  "message": "It’s ok.",
}'
https://api.mercadolibre.com/feedback/$FEEDBACK_ID
```

**Siguiente** : [Datos de facturación](https://developers.mercadolibre.com.ar/es_ar/facturacion).
