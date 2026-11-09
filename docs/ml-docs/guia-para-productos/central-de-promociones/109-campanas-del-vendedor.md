<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/campanas-del-vendedor -->
<!-- Sección: Guía para productos > Central de promociones -->

# Campañas del vendedor

Última actualización 13/03/2026

## Campañas del vendedor

Nota importante:

A partir de julio de 2025, el sub-type de promoción “FIXED_PERCENTAGE” dejará de estar disponible.

Los vendedores pueden crear sus propias campañas y gestionarlas a través de la integración.

Consideraciones claves:

- El plazo máximo para este tipo de campaña es de 14 días.

- El nuevo filtro por estado ya está disponible para filtrar los ítems de una campaña mediante el query param status_item, que acepta los valores "active" o "paused".

Para ofrecer este descuento es necesario:

- Tener reputación verde.

- El ítem debe tener status igual a activo.

- Condición igual a nuevo.

- La exposición del ítem no puede ser gratuita.

## Crear campaña

Para crear una campaña del vendedor realice la siguiente llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2
  {
    "promotion_type": "SELLER_CAMPAIGN",
    "name": "test campana del seller",
    "sub_type": "FLEXIBLE_PERCENTAGE",
    "start_date": "2023-07-17T00:00:00",
    "finish_date": "2023-07-20T00:00:00"
 }
 
```

Respuesta:

```
{
   "id": "C-MLB360923",
   "type": "SELLER_CAMPAIGN",
   "sub_type": "FLEXIBLE_PERCENTAGE",
   "status": "pending",
   "start_date": "2023-07-17T00:00:00",
   "finish_date": "2023-07-20T23:59:59",
   "name": "test campana del seller"
}
```

### Campos de la llamada

**promotion_type:**  tipo de la campaña a crear, de momento solo se permite **SELLER_CAMPAIGN** .
 **name:**  nombre de la campaña.
 **sub_type:**  el valor permitido es FLEXIBLE_PERCENTAGE.
 **start_date** : fecha de inicio de la campaña **en formato local** . Siempre se tomará el principio del día como hora de inicio.
 **finish_date:**  fecha de finalización de la campaña **en formato local** . Siempre se tomará el final del día como hora de finalización.

## Actualizar campaña

Todos los campos pueden ser modificados, pero **solo deben enviarse los campos que deseen modificarse** . El único obligatorio es **promotion_type** , el cual siempre debe estar presente.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID?app_version=v2
  {
    "promotion_type": "SELLER_CAMPAIGN",
    "name": "new name 10",
    "sub_type": "FLEXIBLE_PERCENTAGE",
       "start_date": "2023-07-18T00:00:00",
    "finish_date": "2023-07-19T00:00:00"
 }
```

Respuesta:

```
{
   "id": "C-MLB360923",
   "type": "SELLER_CAMPAIGN",
   "sub_type": "FLEXIBLE_PERCENTAGE",
   "status": "pending",
   "start_date": "2023-07-18T00:00:00",
   "finish_date": "2023-07-19T23:59:59",
   "name": "new name 10"
}
```

## Eliminar campaña

Para eliminar una campaña del vendedor debes realizar esta llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID?promotion_type=SELLER_CAMPAIGN&app_version=v2
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/C-MLB360923?promotion_type=SELLER_CAMPAIGN&app_version=v2
```

**Respuesta: Status 200 OK**

## Consultar detalle de campaña

Para obtener los detalles de la campaña, realiza la siguiente consulta:

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/C-MLB302?promotion_type=SELLER_CAMPAIGN&app_version=v2
```

Respuesta:

```
{
  "id": "C-MLB302",
  "type": "SELLER_CAMPAIGN",
  "sub_type": "FLEXIBLE_PERCENTAGE",
  "status": "started",
  "start_date": "2023-04-27T15:04:00Z",
  "finish_date": "2023-05-05T03:00:00Z",
  "name": "camp del seller tahi 2"
}
```

### Campos de la respuesta

- **id** : identificador de la campaña.

- **type** : tipo de campaña (SELLER_CAMPAIGN).

- **sub_type** : FLEXIBLE_PERCENTAGE.

- **status** : status de la campaña.

- **start_date** : fecha que empieza la campaña.

- **finish_date** : fecha que se cierra la campaña.

- **name** : nombre de la campaña.

## Estados

Estos son los distintos estados por los que puede pasar una campaña del vendedor.

| Estado | Descripción |
| --- | --- |
| **pending** | Promoción aprobada, pero aún no inició. |
| **started** | Promoción activa. |
| **finished** | Promoción finalizada. |

## Consultar ítems en una campaña

Para conocer los ítems que forman parte de una campaña del vendedor puedes realizar la siguiente consulta:

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/C-MLB300/items?promotion_type=SELLER_CAMPAIGN&app_version=v2
```

Respuesta:

```
{
  "results": [
      {
          "id": "MLB3538191898",
          "status": "candidate",
          "price": 0,
          "original_price": 5000,
          "start_date": "2023-04-27T12:03:00",
          "end_date": "2023-05-05T00:00:00",
          "sub_type": "FLEXIBLE_PERCENTAGE"
      }
  ],
  "paging": {
      "offset": 0,
      "limit": 50,
      "total": 1
  }
}
```

## Estado de los ítems

En la siguiente tabla puedes encontrar los posibles estados que pueden tomar los ítems dentro de este tipo de campaña.

| Estado | Descripción |
| --- | --- |
| **candidate** | Ítem candidato para participar de la promoción. |
| **pending** | Ítem con promoción aprobada y programada. |
| **started** | Ítem activo en la campaña. |
| **finished** | Ítem eliminado de la campaña |

## Indicar ítems para una campaña

Una vez que has sido invitado a participar en una campaña del vendedor, puedes indicar qué productos deseas incluir en la misma.

Ejemplo :

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -d '{
    "promotion_id":"C-MLB302",
    "promotion_type":"SELLER_CAMPAIGN",
    "deal_price": 3500,
    "top_deal_price": 3000
  }'
  https://api.mercadolibre.com/seller-promotions/items/MLB3538191898?app_version=v2
```

Respuesta:

```
{
    "price": 3500,
    "original_price": 5000
 }
```

### Parámetros

- **promotion_id** : identificación de la promoción.

- **promotion_type** : tipo de promoción (SELLER_CAMPAIGN).

- **deal_price**  precio del ítem en la promoción.

- **top_deal_price**  precio del ítem para los mejores compradores, con nivel Mercado Puntos 3 a 6 (es opcional informar este precio)

## Modificar ítems

En este tipo de campaña solo puede modificar los items que pertenecen a campañas con sub_type FLEXIBLE_PERCENTAGE. 
 Para modificar los ítems realiza la siguiente operación.
 Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -d '{
    "promotion_id":"C-MLB302",
    "promotion_type":"SELLER_CAMPAIGN",
    "deal_price": 3300,
    "top_deal_price": 3000,
      "remove_loyalty": true  
  }'
  https://api.mercadolibre.com/seller-promotions/items/MLB3538191898?app_version=v2
```

Respuesta:

```
{
  "price": 3300,
  "original_price": 5000
}
```

### Consideraciones

Si la oferta está **activa** :

- Si tiene descuento de loyalty cargado, no se puede quitar más ese descuento.  Error message: **"Top_deal_price can't be removed when the seller campaign has already started"** .  Si fue creada sin el descuento loyalty, no se puede agregar después.  Error message: **"Top_deal_price can't be set when the seller campaign has already started"** .  Los precios sólo pueden mejorar.  Error message: **"New deal_price must be lower than current deal_price" / "New top_deal_price must be lower than current top_deal_price"** .

Si la oferta está **pendiente** :

- Puede modificarse el deal_price y top_deal_price para un mayor o menor descuento.  Se puede agregar o sacar el descuento loyalty.

En caso de querer sacar el descuento de loyalty, se envía “remove_loyalty”: true. En el resto de los casos (no se quiere eliminar, se quiere agregar, se quiere modificar, o no se desea actuar sobre dicho precio), el campo se envía en **false**  o directamente no se envía.

En el body solo se envían los campos que se desee cambiar.

**Ejemplo** . Modificación de top_deal_price:

```
{
    "top_deal_price": 1000.33,
    "promotion_id": "C-MLA123",
    "promotion_type": "SELLER_CAMPAIGN"
}
```

**Ejemplo** . Modificación de deal_price y eliminación de top_deal_price:

```
{
    "deal_price": 700,
    "promotion_id": "C-MLA123",
    "promotion_type": "SELLER_CAMPAIGN",
    "remove_loyalty": true
}
```

Respuesta:

```
{
    "price": 950,
    "original_price": 1000
}
```

## Eliminar

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=$PROMOTION_TYPE&promotion_id=$PROMOTION&app_version=v2
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLB3538191898?promotion_type=SELLER_CAMPAIGN&promotion_id=C-MLB302
```

Respuesta: **Status 200 OK**

## Error de validación: 400 bad request

| Mensaje de error | Descripción |
| --- | --- |
| The name already exists. | Ya existe una campaña del vendedor con el mismo nombre. |
| Invalid sub_type | Cuando el sub_type de una SELLER_CAMPAIGN no es FLEXIBLE_PERCENTAGE ni FIXED_PERCENTAGE. |
| The percentage is greater than allowed. the maximum percentage allowed is 70.000000 | El máximo porcentaje permitido es del 80%. Si se envía, por ejemplo, fixed_percentage: 71, retornará este error. |
| The percentage is less than allowed. the minimum percentage allowed is 10.000000 | El porcentaje esta abajo del permitido. |
| Invalid promotion type | Cuando el promotion_type es inválido. |
| Start and finish dates must be in local format | Cuando las fechas enviadas no están en formato local (como el ejemplo) o no se envían. |
| Start_date cannot be earlier than today | Start_date no puede ser anterior a hoy. |
| Finish_date cannot be earlier than startdate | Finish_date no puede ser anterior a start_date. |
| Maximum period cannot exceed the allowed | Cuando la distancia entre la start y finish date es mayor a la permitida. |
| Maximum period can not exceed the allowed | Cuando se quiere actualizar alguna fecha (o las dos), y el nuevo período entre ambas excede el permitido. |
| The start_date field cannot be modified for the current promotion status | No se puede cambiar la fecha de inicio de una promoción en estado started. |
