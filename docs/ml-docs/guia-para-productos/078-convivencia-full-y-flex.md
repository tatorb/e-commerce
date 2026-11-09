<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/convivencia-full-y-flex -->
<!-- Sección: Guía para productos -->

# Convivencia Full/Flex (MLA y MLC)

Última actualización 15/05/2026

## Gestión de stock en convivencia Full/Flex (MLA y MLC)

Ahora en**Argentina y Chile, en items con convivencia full y flex, los vendedres pueden administrar el stock en su depósito (selling_address) y el stock en Full (meli_facilty) por separado**  para tener una mejor experiencia que los ayude a tener más ventas y menos cancelaciones.
 
 Es importante tener en cuenta que para utilizar el recurso de actualización de stock, además de tener ítems en stock Full, debes tener las [formas de envío Flex y Fulfillment](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-2#Tipos-logisticas) activos. Para corroborar esto valida que la publicación tenga el **logistic_type fulfillment**  y el tag **self_service_in** , ya que estos dos campos indican que la publicación está en convivencia de ambas logísticas.

## Notificaciones

Próximamente, disponibilizaremos [el tópico **stock_locations**](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones?nocache=true#Accede-a-los-detalles) notificaciones para cuando se modifiquen las **stock_locations**  del **user_product** , ya sea por incremento o decremento el campo quantity.

## Obtener el stock de un ítem

Para consultar el stock del ítem, **primero debes obtener el user_product_id** . Para esto [consulta el campo a través del recurso de /ítems](https://developers.mercadolibre.com.ar/es_ar/publica-productos#Condici%C3%B3n-de-un-%C3%ADtem:~:text=Reputaci%C3%B3n%20del%20vendedor-,Consultar%20productos,-Nota%3A). Si el ítem tiene variaciones, se debe obtener el user_product_id dentro del array variations.

Nota:

El rate limit de este recurso es de 100 RPM.

Llamada:

```
curl -X GET -h 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/stock
```

Ejemplo:

```
curl -X GET -h 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-products/MLAU12345678/stock
```

Respuesta:

```
{
    "locations":
    [
        {
            "type": "meli_facility",
            "quantity": 5
        }
        {
            "type": "selling_address",
            "quantity": 9
        }

    ],
    "id": "MLAU12345678",
    "user_id": 1376088286
}
```

### Campos de la repuesta:

- **Type** : permite diferenciar las locations del ítem.

- selling_address: stock disponible en el depósito del vendedor (Flex). meli_facility: stock gestionado por Fulfillment.

**Quantity** : cantidad de ítems disponibles para la venta.

Al consultar el endpoint, retornará un header llamado “x-version” el cual tendrá un valor entero (de tipo long) que representará la versión de la entidad.
 Este header debe ser enviado a la hora de realizar modificaciones a las entidades, en caso de no ser enviado se retornará un bad request status code: 400 y en caso de que la versión enviada no sea más la última en la entidad a modificar, se retornará un conflict status code: 409. 
 En el caso de una respuesta con status code 409, se debe realizar nuevamente un GET a la entidad a modificar, para obtener la versión actualizada del header x-version.

## Modificar el stock de un ítem

Nota:

- Para empezar a vender, es necesario que se informe el stock del ítem en selling_address 
 - La cuenta del vendedor debe tener Flex encendido y el ítem debe estar también en Full
 - Es posible cambiar el stock de Flex en selling_address, independiente del stock en Full

Llamada:

```
curl -X PUT -h 'Authorization: Bearer $ACCESS_TOKEN' -h 'x-version:$HEADER -h 'Content-Type: application/json' 
https://api.mercadolibre.com/user-products/$USER_PRODUCT_ID/stock/type/selling_address -d 
{
   "quantity": XX
}
```

Ejemplo:

```
curl -X PUT -h 'Authorization: Bearer $ACCESS_TOKEN' -h 'x-version:$HEADER -h 'Content-Type: application/json' 
https://api.mercadolibre.com/user-products/MLAU12345678/stock/type/selling_address -d 
{
   "quantity": 10
}
```

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 204 | OK | El stock se actualizará de manera asíncrona en todas las condiciones de venta del user product. |  |
| 400 | You cannot modify selling address stock if associated items are fulfillment only or no items are associated. | No es posible modificar el stock de selling_addres si el item sólo está activo en full. | No intentar modificar stock en items que no cuentan con convivencia full/flex. |
| 400 | You cannot modify selling address stock in items without inventory id. | No es posible modificar el stock de selling_address si no se cuenta con stock en fullfillment. | El seller debe primero enviar stock al depósito de meli antes de modificar el stock de selling address. |
| 400 | You cannot modify selling address stock because you have to do a full inbound first before modifying. |  |  |
| 400 | Missing X-Version header | Debes informar el Header “x-version” |  |
| 400 | seller with a single warehouse cannot update selling address stock | El seller tiene ubicaciones de tipo seller_warehouse configuradas pero no posee una ubicación de tipo selling_address en su stock. Esta combinación no permite actualizar el stock de selling_address. | Usar el endpoint PUT /user-products/{id}/stock/type/seller_warehouse para gestionar el stock. Los sellers con depósito único deben operar exclusivamente sobre ese endpoint. |
| 409 | Version mismatch | El header “x-version” informado es incorrecto | Haz un GET en /user-product para obtener el header “x-version” actualizado. |
