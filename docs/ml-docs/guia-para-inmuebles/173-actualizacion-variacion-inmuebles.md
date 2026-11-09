<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/actualizacion-variacion-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Actualización variación inmuebles

Última actualización 08/11/2025

## Actualiza las variaciones de tu inmueble

Una vez publicado tu inmueble con variaciones, es posible que desees modificar alguna variación, agregar una nueva a tu publicación o cambiar el stock disponible o el precio. En esta guía te mostramos cómo realizar estos cambios.

## Agregar nuevas variaciones

Para añadir una nueva variante a un ítem ya publicado, si ha ingresado una nueva variante en stock, puedes hacerlo mediante un post al ítem. En este post, en la propiedad de variaciones, se deben incluir la nueva variación que se desea crear. Por ejemplo:

```

curl -X POST 
-H 'Authorization: Bearer $ACCESS_TOKEN' 
-H 'Content-Type: application/json' 
-d '{
    "attribute_combinations": [
      {
        "id": "TOTAL_AREA",
        "value_name": "90 m²"
      },
      {
        "id": "PARKING_LOTS",
        "value_name": "3"
      },
      {
        "id": "BEDROOMS",
        "value_name": "5"
      },
      {
        "id": "FULL_BATHROOMS",
        "value_name": "3"
      }
    ],
    "price": 125000000,
    "available_quantity": 8,
    "sold_quantity": 0
  }' 
https://api.mercadolibre.com/items/MLA658778048/variations
```

Recibirás una respuesta con estado **201 - Created** , con el cuerpo como se vio en [Consulta tu publicación con variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones-para-inmuebles), solo que además tendrá la nueva variación publicada.

## Modifica variaciones

Ahora que ya aprendiste cómo publicar y consultar ítems con variaciones, además de agregar nuevas variantes, es posible que en algún momento debas realizar cambios a fin de actualizar stock, precios, o cualquier otro atributo, para esto deberás enviar una petición tipo **PUT**  al endpoint de /items, muy similar a como los vimos en la guía de [Actualiza tu inmueble](https://developers.mercadolibre.com.ar/es_ar/actualiza-tus-publicaciones), solo que en el cuerpo de la petición deberás agregar, en el array de variations [], el id de la variación, junto con el dato a actualizar. Veamos un ejemplo, suponiendo que queremos actualizar el precio y el stock de las variaciones.

```

curl -X PUT 
-H 'Authorization: Bearer $ACCESS_TOKEN' 
-H 'Content-Type: application/json' 
-d '{
  "variations": [
    {
      "id": 1789456123,
      "available_quantity": 10,
      "price": 110000000
    },
    {
      "id": 123456789,
      "available_quantity": 10,
      "price": 115000000
    }
  ]
}' 
https://api.mercadolibre.com/items/MLC2913388294
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en el punto 4.3 de la guía “Pasos Rápidos para Publicar un Inmueble de Prueba” |
| ITEM_ID | String | No | Item id obtenido como respuesta al publicar el inmueble |
| variations | Array | No | Array con las variaciones a modificar |
| id | Integer | No | Id de la variación a modificar |
| price | Integer | Sí | Precio o cualquier otro atributo que se desea actualizar para la variación dada. |

Recibirás una respuesta con estado **200 - OK** , con el cuerpo como si hubieras publicado un inmueble, mostrando los nuevos datos de tus variaciones.

## Elimina una variación

Al igual que puedes actualizar tu inmueble añadiendo nuevas variaciones, también tienes la opción de eliminar una variación en particular, tal como se demuestra en el siguiente ejemplo:

```

curl -X DELETE 
-H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/items/$ITEM_ID/variations/$VARIATION_ID
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en el punto 4.3 de la guía “Pasos Rápidos para Publicar un Inmueble de Prueba” |
| ITEM_ID | String | No | id del ítem publicado |
| VARIATION_ID | INTEGER | No | Id de la variación que se va a eliminar |

Al enviar la solicitud, se obtendrá una respuesta con estado **200 - OK** . El contenido será similar al recibido al consultar las variaciones, mostrando las variaciones disponibles después de la eliminación.

Si necesitas más detalles sobre esta temática, puedes encontrar la guía de [variaciones generales para productos](https://developers.mercadolibre.com.ar/es_ar/variaciones#).

### Lecturas recomendadas

- [Ciclo de vida de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/ciclo-de-vida-de-las-publicaciones-de-inmuebles)

- [Calidad de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
