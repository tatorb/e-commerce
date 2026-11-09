<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/cupones-del-vendedor -->
<!-- Sección: Guía para productos > Central de promociones -->

# Cupones del vendedor

Última actualización 13/03/2026

## Campañas de cupones del vendedor

Importante:

El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused".

Importante:

Actualmente, esta campaña está disponible solo para MLB.

Los vendedores pueden crear sus propias campañas de cupones. En este tipo de campaña **el descuento se aplica sobre el valor total de la venta de los productos participantes y es acumulativo con la promoción activa**  (solo es permitido un cupón por venta). **Existen dos tipos de campañas de cupones, las que tienen código de cupón**  en la cual solo tendrán acceso al descuento los compradores que posean este código, y **las que no tienen código de cupón**  donde podrán acceder a este descuento todos los compradores que vean las publicaciones, en ese caso Mercado Libre se encargará de destacar el descuento por cupón en estas publicaciones que participan en la campaña de cupones.

Nota:

El plazo máximo para este tipo de campaña es de 31 días.

### Para ofrecer este descuento es necesario:

- Tener reputación verde.

- El ítem debe tener status igual a activo.

- Condición igual a nuevo.

- La exposición del ítem no puede ser gratuita.

Estos son los mismos criterios para que el ítem partícipe en una campaña de descuento individual, es decir, si el ítem es candidato para esta campaña, automáticamente también cumple los criterios para participar en una campaña de cupones del vendedor.

## Crear campaña

Hay dos tipos de campañas de cupones (con código o sin código), pero también hay dos sub_type: FIXED_PERCENTAGE y FIXED_AMOUNT.

**FIXED_AMOUNT**  Es el monto fijo de descuento, independientemente del precio total acumulado de los ítems que participan en esta campaña en el carrito del comprador.

**FIXED_PERCENTAGE**  Es el porcentaje fijo de descuento, y es dependiente del precio total acumulado de los ítems que participan en esta campaña en el carrito del comprador.

Para crear una campaña de cupones del vendedor realiza la siguiente llamada:

Ejemplo "sub_type": "FIXED_AMOUNT" con código de cupón:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2

{
   "promotion_type": "SELLER_COUPON_CAMPAIGN",
   "name": "test_coupon",
   "sub_type": "FIXED_AMOUNT",
   "start_date": "2023-10-14T00:00:00",
   "finish_date": "2023-10-30T00:00:00",
   "fixed_amount": 200,
   "min_purchase_amount": 1000,
   "partial_coupon_code": "MYCODE",
   "budget": 10000
}
```

Ejemplo “sub_type”: “FIXED_AMOUNT” sin código de cupón:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2

      {
         "promotion_type": "SELLER_COUPON_CAMPAIGN",
         "name": "test_coupon",
         "sub_type": "FIXED_AMOUNT",
         "start_date": "2023-10-14T00:00:00",
         "finish_date": "2023-10-30T00:00:00",
         "fixed_amount": 200,
         "min_purchase_amount": 1000,
         "budget": 10000
      }
```

Ejemplo “sub_type”: “FIXED_PERCENTAGE” con código de cupón:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2
      
      {
         "promotion_type": "SELLER_COUPON_CAMPAIGN",
         "name": "test_coupon",
         "sub_type": "FIXED_PERCENTAGE",
         "start_date": "2023-10-14T00:00:00",
         "finish_date": "2023-10-30T00:00:00",
         "fixed_percentage": 10,
         "min_purchase_amount": 1000,
         "max_purchase_amount": 200,
         "partial_coupon_code": "MYCODE",
         "budget": 10000
      }
```

Ejemplo "sub_type": "FIXED_PERCENTAGE" sin código de cupón:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2
      
      {
         "promotion_type": "SELLER_COUPON_CAMPAIGN",
         "name": "test_coupon",
         "sub_type": "FIXED_PERCENTAGE",
         "start_date": "2023-10-14T00:00:00",
         "finish_date": "2023-10-30T00:00:00",
         "fixed_percentage": 10,
         "min_purchase_amount": 1000,
         "max_purchase_amount": 200,
         "budget": 10000
      }
```

### Campos de la llamada

- **promotion_type (Obligatorio)** : Tipo de la campaña a crear, en este caso SELLER_COUPON_CAMPAIGN.

- **name (Obligatorio)** : Nombre de la campaña (solo lo verá el vendedor, el comprador no lo verá).

- **sub_type (Obligatorio)** : Subtipo de campaña a crear. Para el caso de campañas de cupones del vendedor, los subtipos permitidos son FIXED_PERCENTAGE y FIXED_AMOUNT.

- **fixed_percentage** : Porcentaje de descuento de la promoción. Solo es obligatorio para el subtipo FIXED_PERCENTAGE.

- **fixed_amount** : Monto de descuento de la promoción. Solo es obligatorio para el subtipo FIXED_AMOUNT.

- **min_purchase_amount (Obligatorio)** : Monto mínimo de compra para que aplique el cupón.

- **max_purchase_amount** : Monto máximo de reintegro para el valor total de la compra a la que se aplicó el cupón. Solo es obligatorio para subtype FIXED_PERCENTAGE.

- **start_date (Obligatorio)** : Fecha de inicio de la campaña en formato local. Siempre se tomará el principio del día como hora de inicio.

- **finish_date (Obligatorio)** : Fecha de finalización de la campaña en formato local. Siempre se tomará el final del día como hora de finalización.

- **partial_coupon_code** : Código parcial de cupón. Opcional. Solo los compradores que tengan este código podrán usarlo para su compra y el valor final de este campo será compuesto por los primeros cinco caracteres del nickname del vendedor concatenado al valor que envíen (Máximo 10 caracteres). En caso de que no se envíe este campo, podrán usar este cupón todos los compradores que vean las publicaciones del vendedor.

- **budget (Obligatorio)** : Presupuesto destinado a la campaña. Una vez agotado, la campaña finaliza.

Respuesta sub_type FIXED_AMOUNT con código de cupón:

```
{
   "id": "C-MLB1234",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_AMOUNT",
   "fixed_amount": 200,
   "min_purchase_amount": 1000,
   "status": "pending",
   "start_date": "2023-10-14T00:00:00Z",
   "finish_date": "2023-11-01T02:59:59Z",
   "name": "test_coupon",
   "coupon_code": "NICKNMY_CODE",
   "redeems_per_user": 1,
   "budget": 10000,
   "remaining_budget": 10000,
   "used_coupons": 0
}
```

Respuesta sub_type FIXED_AMOUNT sin código de cupón:

```
{
   "id": "C-MLB1234",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_AMOUNT",
   "fixed_amount": 200,
   "min_purchase_amount": 1000,
   "status": "pending",
   "start_date": "2023-10-14T00:00:00Z",
   "finish_date": "2023-11-01T02:59:59Z",
   "name": "test_coupon",
   "redeems_per_user": 1,
   "budget": 10000,
   "remaining_budget": 10000,
   "used_coupons": 0
}
```

Respuesta sub_type FIXED_PERCENTAGE con código de cupón:

```
{
   "id": "C-MLB1234",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_AMOUNT",
   "fixed_percentage": 10,
   "min_purchase_amount": 1000,
   "max_purchase_amount": 200,
   "status": "pending",
   "start_date": "2023-10-14T00:00:00Z",
   "finish_date": "2023-11-01T02:59:59Z",
   "name": "test_coupon",
   "coupon_code": "NICKNMY_CODE",
   "redeems_per_user": 1,
   "budget": 10000,
   "remaining_budget": 10000,
   "used_coupons": 0
}
```

Respuesta sub_type FIXED_PERCENTAGE sin código de cupón:

```
{
   "id": "C-MLB1234",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_AMOUNT",
   "fixed_percentage": 10,
   "min_purchase_amount": 1000,
   "max_purchase_amount": 200,
   "status": "pending",
   "start_date": "2023-10-14T00:00:00Z",
   "finish_date": "2023-11-01T02:59:59Z",
   "name": "test_coupon",
   "redeems_per_user": 1,
   "budget": 10000,
   "remaining_budget": 10000,
   "used_coupons": 0
}
```

### Campos de la respuesta

- **id** : Identificador de la campaña con el formato C-{siteId}XXXXX. Ejemplo: “C-MLB1234”

- **type** : Tipo de la campaña (SELLER_COUPON_CAMPAIGN).

- **sub_type** : Subtipo de la campaña (FIXED_AMOUNT o FIXED_PERCENTAGE).

- **fixed_percentage** : Valor de porcentaje de descuento. Se devuelve siempre que la campaña sea de subtipo FIXED_PERCENTAGE.

- **fixed_amount** : Valor de monto de descuento. Se devuelve siempre que la campaña sea de subtipo FIXED_AMOUNT.

- **min_purchase_amount** : Monto mínimo de compra.

- **max_purchase_amount** : Monto máximo de reintegro. Se devuelve siempre que la campaña sea de subtipo FIXED_PERCENTAGE.

- **status** : Estado de la campaña. Puede ser pending o started.

- **start_date** : Fecha de inicio de la campaña.

- **finish_date** : Fecha de finalización de la campaña.

- **name** : Nombre utilizado para identificar a la campaña.

- **coupon_code** : Código de cupón. Si el nickname del vendedor es NICKNAME1234, el coupon_code será NICKN + el código completado por el usuario.

- **redeems_per_user** : Cantidad de veces que un usuario puede usar el cupón de esta campaña. Siempre es 1, el comprador podrá utilizar solo una vez el cupón.

- **budget** : Presupuesto destinado a la campaña, es 100% a cargo del vendedor.

- **remaining_budget** : Presupuesto restante de la campaña.

- **used_coupons** : Cantidad total de cupones usados por los compradores.

## Actualizar campaña

Para actualizar la campaña solo debe enviarse los campos que quieras modificarse. El único obligatorio es promotion_type, el cual siempre debe estar presente.

### Campos que se puede actualizar:

- name

- start_date

- finish_date

- budget

- fixed_amount: Solo para subtipo FIXED_AMOUNT.

- fixed_percentage: Solo para subtipo FIXED_PERCENTAGE.

- min_purchase_amount

- max_purchase_amount: Solo para subtipo FIXED_PERCENTAGE.

Nota:

Para las campañas en estado STARTED, solo pueden modificarse los campos:

- finish_date

- budget: Solo puede incrementarse

- name

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID?app_version=v2
    
    
    {
       "promotion_type": "SELLER_COUPON_CAMPAIGN",
       "name": "test_coupon_modified",
       "start_date": "2023-10-19T00:00:00",
       "finish_date": "2023-11-05T00:00:00",
       "fixed_percentage": 11,
       "min_purchase_amount": 1100,
       "max_purchase_amount": 270,
       "budget": 20000
    }
```

Respuesta:

```
{
       "id": "C-MLB1234",
       "type": "SELLER_COUPON_CAMPAIGN",
       "sub_type": "FIXED_AMOUNT",
       "fixed_percentage": 11,
       "min_purchase_amount": 1100,
       "max_purchase_amount": 270,
       "status": "pending",
       "start_date": "2023-10-19T00:00:00Z",
       "finish_date": "2023-11-05T00:00:00Z",
       "name": "test_coupon_modified",
       "redeems_per_user": 1,
       "budget": 20000,
       "remaining_budget": 20000,
       "used_coupons": 0
    }
```

## Eliminar campaña

Para eliminar una campaña de cupones del vendedor realiza esta llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/C-MLB1234?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
```

Respuesta: **Status 200 OK**

## Consultar detalle de la campaña

Para las campañas de cupones del vendedor existen dos subtipos y la opción de tener o no el código de cupón:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/C-MLB300?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
```

Respuesta sub_type FIXED_AMOUNT con código de cupón:

```
{
   "id": "C-MLB1082",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_AMOUNT",
   "fixed_amount": 10,
   "min_purchase_amount": 100,
   "max_purchase_amount": 200,
   "status": "started",
   "start_date": "2023-09-14T03:00:00Z",
   "finish_date": "2023-10-01T02:59:59Z",
   "name": "test_coupon_004",
   "coupon_code": "NICKNCCODE004",
   "redeems_per_user": 1,
   "budget": 1000,
   "remaining_budget": 1000,
   "used_coupons": 0
}
```

Respuesta sub_type FIXED_AMOUNT sin código de cupón:

```
{
   "id": "C-MLB1079",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_AMOUNT",
   "fixed_amount": 50,
   "min_purchase_amount": 500,
   "max_purchase_amount": 1000,
   "status": "started",
   "start_date": "2023-09-14T03:00:00Z",
   "finish_date": "2023-10-01T02:59:59Z",
   "name": "test_coupon_002",
   "redeems_per_user": 1,
   "budget": 1000,
   "remaining_budget": 1000,
   "used_coupons": 0
}
```

Respuesta sub_type FIXED_PERCENTAGE con codigo de cupón:

```
{
   "id": "C-MLB1081",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_PERCENTAGE",
   "fixed_percentage": 5,
   "min_purchase_amount": 10,
   "max_purchase_amount": 100,
   "status": "started",
   "start_date": "2023-09-14T03:00:00Z",
   "finish_date": "2023-10-01T02:59:59Z",
   "name": "test_coupon_003",
   "coupon_code": "NICKNCODE003",
   "redeems_per_user": 1,
   "budget": 1000,
   "remaining_budget": 1000,
   "used_coupons": 0
}
```

Respuesta sub_type FIXED_PERCENTAGE sin código de cupón:

```
{
   "id": "C-MLB1067",
   "type": "SELLER_COUPON_CAMPAIGN",
   "sub_type": "FIXED_PERCENTAGE",
   "fixed_percentage": 5,
   "min_purchase_amount": 10,
   "max_purchase_amount": 100,
   "status": "started",
   "start_date": "2023-09-14T03:00:00Z",
   "finish_date": "2023-10-01T02:59:59Z",
   "name": "test_coupon_001",
   "redeems_per_user": 1,
   "budget": 1000,
   "remaining_budget": 1000,
   "used_coupons": 0
}
```

### Estados

Estos son los distintos estados por los que puede pasar una campaña de cupones del vendedor.

| Estado | Descripción |
| --- | --- |
| **pending** | Promoción aprobada que aún no inició. |
| **started** | Promoción activa. |
| **finished** | Promoción finalizada. |
| **deleted** | Campaña eliminada. |

## Consultar ítems en una campaña

Para conocer los ítems que forman parte de una campaña de cupón del vendedor realiza la siguiente consulta:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID/items?promotion_type=SELLER_COUPON_CAMPAIGN&app_version=v2
```

Respuesta sub_type FIXED_AMOUNT:

```
{
             "results": [
                 {
                     "id": "MLB4096076774",
                     "status": "candidate",
                     "price": 0,
                     "original_price": 3346,
                     "fixed_amount": 200,
                     "start_date": "2023-12-07T00:00:00",
                     "end_date": "2024-01-06T23:59:59",
                     "sub_type": "FIXED_AMOUNT"
                 }
             ],
             "paging": {
                 "total": 1,
                 "limit": 50
             }
          }
```

Respuesta sub_type FIXED_PERCENTAGE:

```
{
             "results": [
                 {
                     "id": "MLB4096076774",
                     "status": "candidate",
                     "price": 0,
                     "original_price": 3346,
                     "fixed_percentage": 15,
                     "start_date": "2023-12-07T00:00:00",
                     "end_date": "2024-01-06T23:59:59",
                     "sub_type": "FIXED_PERCENTAGE"
                 }
             ],
             "paging": {
                 "total": 1,
                 "limit": 50
             }
          }
```

### Estado de los ítems

Estos son los posibles estados que pueden tener los ítems dentro de este tipo de campaña.

| Estado | Descripción |
| --- | --- |
| **candidated** | Ítem candidato para participar de la promoción. |
| **pending** | Ítem con promoción aprobada y programada. |
| **started** | Ítem activo en la campaña. |
| **finished** | Ítem eliminado de la campaña. |

## Indicar ítems para una campaña

Una vez que tienes ítems candidatos a participar de esta campaña, puedes indicar qué productos quieres incluir. No se envían precios, ya que es un cupón de descuento que se aplica en el checkout de la compra del comprador.

Ejemplo sub_type FIXED_PERCENTAGE:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
  "promotion_id":"C-MLB1081",
  "promotion_type":"SELLER_COUPON_CAMPAIGN"

}'
https://api.mercadolibre.com/seller-promotions/items/MLB123456789?app_version=v2
```

Respuesta:

```
{
   "price": 0,
   "original_price": 0,
   "promotion_name": "test_coupon_001",
   "fixed_percentage": 5
}
```

Los precios son siempre 0 porque la oferta no tiene precio, sino que es un descuento que se aplica en el checkout de la compra.

Importante:

No es posible modificar un ítem en la campaña, ya que son montos o porcentajes de descuento que son fijos y están conectados a la configuración de campaña.

## Eliminar ítem de la campaña

Para eliminar una campaña del vendedor realizar esta llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=SELLER_COUPON_CAMPAIGN&promotion_id=$PROMOTION_ID&app_version=v2
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLB123456789?promotion_type=SELLER_COUPON_CAMPAIGN&promotion_id=C-MLB1081&app_version=v2
```

Respuesta: **Status 200 OK**

## Errores de validación

**400 Bad Request**

| Mensaje de error | Descripción |
| --- | --- |
| start_date cannot be earlier than today | La fecha de inicio de la campaña no puede ser menor al día de hoy. |
| finish_date cannot be earlier than start_date | La fecha de finalización no puede ser menor a la fecha de inicio de la campaña. |
| maximum period cannot exceed the allowed | Cuando se intenta actualizar alguna fecha (de inicio o de finalización o ambas), y el nuevo período entre ambas excede el permitido de 31 días. |
| minimum period cannot be lower than allowed | Cuando se intenta actualizar alguna fecha (de inicio o de finalización o ambas), y el nuevo período entre ambas es menor al permitido de 1 día. |
| the field {field} not upgradable | Cuando se quiere modificar un campo no permitido cuando la promoción tiene estado STARTED. |
| the promotion budget cannot be decreased | El budget sólo puede incrementarse. |
| the name already exists | Ya existe una campaña de cupones del vendedor con el mismo nombre. |
| the fixed_percentage is greater than allowed | El máximo porcentaje permitido es del 80%. Si se envía, por ejemplo, fixed_percentage: 71. |
| the fixed_percentage is less than allowed | El mínimo permitido es del 5%. Si se envía, por ejemplo, fixed_percentage: 4. |
| The max_purchase_amount should be greater than min value allowed {value} | El valor del campo max_purchase_amount debe ser mayor al mínimo permitido. Para MLB por ejemplo, es 5. |
| The fixed_percentage applied to min purchase amount should be lower than max purchase amount value | El valor del beneficio aplicado al monto mínimo de compra debe ser menor que el valor del monto máximo de reintegro. |
| The promotion budget should be greater than max purchase amount value when campaign subtype is fixed percentage | Cuando el budget es menor al monto máximo de reintegro para este subtipo. |
| The fixed_amount should be greater than min value allowed {value} | El valor del campo fixed_amount debe ser mayor al mínimo permitido. Para todos los sitios es 0. |
| The fixed_amount should be lower than min purchase amount value | Cuando el valor del campo fixed_amount es mayor que el valor del campo min_puchase_amount. Por ejemplo, cuando se quiere dar 10 de monto fijo de descuento pero el valor mínimo de compra para que aplique el cupón es de 5. |
| The min_puchase_amount {value} should be bigger than the min value: {min_value} | Cuando el valor del campo min_puchase_amount es menor al cálculo del porcentaje mínimo permitido utilizando el valor del campo fixed_amount. |
| The min_puchase_amount {value} should be lower than the max value: {max_value} | Cuando el valor del campo min_puchase_amount es mayor al cálculo del porcentaje máximo permitido utilizando el valor del campo fixed_amount. |
| The promotion budget should be greater than benefit value when campaign subtype is fixed amount | Cuando el budget es menor al monto fijo de descuento para este subtipo. |
