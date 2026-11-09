<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/servicio-sincroniza-publicaciones -->
<!-- Sección: Guía para servicios -->

# Sincroniza publicaciones

Última actualización 15/03/2023

## Sincroniza publicaciones

Una vez que tienes publicaciones activas en nuestro marketplace, es probable que debas actualizarlas y modificarlas en forma periódica para sincronizar el stock con otras plataformas con las que trabajas, pausar publicaciones, mejorar descripciones, actualizar precios, etc. Sigue esta guía para aprender cómo hacerlo.

## Consideraciones

No todos los campos se pueden actualizar y esto cambiará si el artículo tiene ventas o no. Además, recuerda que tu artículo debe estar activo para poder modificarlo. Puedes modificar los valores para:

- Title

- Available_quantity

- Price

- Video

- Pictures

- Description*

- Shipping

- Category

*No es posible modificar, solo agregar un post.

Cuando el artículo tiene ventas, no podrás cambiar ninguno de los siguientes campos del mismo:

- Title

- Condition

- Buying mode

- Non Mercado Pago Payment Methods

- Shipping dimensions

- Warranty

También recuerda que:

- El tipo de publicación se puede modificar solo una vez.

- El título no se puede modificar en un artículo con ventas salvo seas parte de las tiendas oficiales de Mercado Libre.

## Actualiza tu artículo

Veamos un ejemplo básico de actualización del título y el precio de un artículo. Lo único que necesitas es el item_id del producto publicado y, por supuesto, el access_token del vendedor.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "title": "Your new title",
  "price": 1000
}
https://api.mercadolibre.com/items/ITEM_ID
```

Bien, el título y precio de tu artículo fueron actualizados y deberías recibir un estado de respuesta con código 200 OK para confirmar que no hubo inconvenientes. Recuerda que puede tardar un momento hasta ver la información actualizada.

## Descripciones

Es muy fácil actualizar una descripción y lo puedes hacer independientemente de que el artículo tenga o no ofertas. Pero como existen ciertas consideraciones que debes recordar al agregar o reemplazar descripciones, [consulta nuestro artículo sobre descripciones](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos) para asegurarte de entenderlo bien.

## Imágenes

Siempre puedes agregar o reemplazar imágenes de artículos; [consulta nuestro tutorial Trabajar con imágenes](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes) para conocer la mejor forma de hacerlo.

## Tipos de publicación

Cuando quieres más exposición para tu artículo, debes actualizar el tipo de publicación. Conoce los detalles y consideraciones y aprende cómo realizar una actualización en nuestro [tutorial Tipos y actualización de publicaciones](http://developers.mercadolibre.com/tipos-de-publicacion-y-actualizaciones/).

## Cambia el estado de las publicaciones

Cualquier artículo publicado en nuestro marketplace puede tener diferentes estados; analiza la descripción de cada uno a continuación:

- **cerrado:**  finaliza tu publicación. Una vez cerrado, no se puede volver a activar, pero se puede volver a publicar.

- **pausado:**  pausa tu publicación. Una vez pausado, los visitantes no podrán entrar en contacto, ya que los datos serán eliminados.

- **activo:**  reactiva un artículo previamente pausado.

Si necesitas realizar cambios en el estado del artículo, debes enviar uno de estos valores para el campo "estado”. Recuerda que el valor distingue entre mayúsculas y minúsculas y se debe enviar en minúscula.

Para pausar un artículo activo, sigue el ejemplo a continuación.

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "status":"paused"
}
https://api.mercadolibre.com/items/ITEM_ID
```

¡Excelente! Tu artículo ha sido pausado. Ahora puedes intentar reactivarlo realizando exactamente la misma llamada, pero enviando "activo" en lugar de "pausado" como valor del estado. Si actualmente tu artículo está cerrado y quieres volver a publicarlo, [consulta nuestro artículo sobre volver a publicar para hacerlo rápido.](https://developers.mercadolibre.com.ar/es_ar/re-publica)

## Elimina publicaciones

Después de eliminar una publicación no hay vuelta atrás; por eso, ten cuidado cuando realizas esta acción. Además, recuerda que no es necesario eliminar los artículos cerrados porque serán descartados automáticamente después de cierto tiempo.

Si aún necesitas eliminar un artículo, por ejemplo artículos en estado: payment_required que no responderán al estado ‘cerrado’, deberás realizar los siguientes PUTs.

Primer paso:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
"status": "closed"
}
https://api.mercadolibre.com/items/ITEM_ID
```

Segundo paso:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
  {
  "deleted":"true"
  }
  https://api.mercadolibre.com/items/ITEM_ID
```

Nota:

En caso de que al hacer el segundo PUT obtengas el error:

message: item optimistic

locking error: conflict

status: 409

cause: array(0)

Se debe a que deberás esperar unos segundos hasta que se actualice la información. Una vez eliminada la publicación se continuará viendo en la VIP por un período de tiempo corto bajo la leyenda "publicación finalizada".

¡Eso es! Tu artículo será eliminado.

## Actualización de stock

Actualizar el stock de un producto es muy fácil. Sólo tiene que actualizar el valor del campo "available_quantity".

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
  {
    "available_quantity": 6
  }
  https://api.mercadolibre.com/items/ITEM_ID
```

Fácil. Puede consultar su publicación y ver el stock actualizado.

**Siguiente:**  [Gestiona contactos y visitas](https://developers.mercadolibre.com.ar/es_ar/servicio-gestiona-contactos-y-visitas).
