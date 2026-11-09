<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publicaciones-de-tiendas-oficiales-para-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Publicaciones de Tiendas Oficiales para Inmuebles

Última actualización 06/11/2025

## Publicaciones de tiendas oficiales para inmuebles

La publicación de un ítem en una Tienda Oficial sigue el mismo proceso que la publicación de cualquier otro ítem, con la adición del atributo **official_store_id**  en el cuerpo de la solicitud, tal como se vio en [Publica Inmuebles](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble).

El campo **official_store_id**  es obligatorio para todas las publicaciones de usuarios vinculados a una Tienda Oficial. Si el vendedor no tiene una Tienda Oficial asociada, el campo **official_store_id**  debe enviarse como nulo (null).

La omisión de este campo para vendedores con Tienda Oficial resultará en un error como el siguiente:

```
{
  "message": "Validation error",
  "error": "validation_error",
  "status": 400,
  "cause": [
    {
      "department": "items",
      "cause_id": 144,
      "type": "error",
      "code": "item.official_store_id.invalid",
      "references": [
        "item.official_store_id",
        "item.seller_id"
      ],
      "message": "Users type brand have to provide a official store id"
    }
  ]
}
```

El campo **official_store_id**  vincula un ítem a la Tienda Oficial correspondiente al ID proporcionado. Para obtener más información sobre las Tiendas Oficiales, consulte la documentación de [Tiendas Oficiales](https://developers.mercadolibre.com.ar/es_ar/Tienda-oficial).

## Verificación de tienda oficial del vendedor

Para determinar si un vendedor tiene una Tienda Oficial, siga esta [guía](https://developers.mercadolibre.com.ar/es_ar/Tienda-oficial) para obtener el ID y detalles adicionales de la marca.

### Inclusión del official_store_id

Al crear una nueva publicación, incluya el ID de la tienda en el campo **official_store_id**  al momento de [Publicar tu Item](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble).

Ejemplo:

```
curl -X POST 
-H 'Authorization: Bearer $ACCESS_TOKEN' 
"Content-Type: application/json" -d
'{
  "title":"Item de Test -No Ofertar",
  "category_id":"MLA401686",
  "price":137000,
  "official_store_id": 3121,
  "currency_id":"USD",
  "available_quantity":1,
  "buying_mode":"classified",
  "listing_type_id":"silver",
  "condition":"new",
  "description": "Item:, Depto 2 Amb Semipiso Con Balcón Terraza Al Frente!",
  "video_id": "YOUTUBE_ID_HERE",
  "pictures":[
    {"source":"http://upload.wikimedia.org/wikipedia/commons/f/fd/ap.jpg"},
    {"source":"http://en.wikipedia.org/wiki/File:Teashades.gif"}
  ]
}'
https://api.mercadolibre.com/items
```

En las [actualizaciones de tu inmueble](https://developers.mercadolibre.com.ar/es_ar/actualiza-tus-publicaciones), incluye **official_store_id**  solo si necesitas modificar la tienda oficial asociada al ítem.

## Errores comunes al publicar en Tiendas Oficiales

A continuación, puedes ver los errores 400 que reciben los usuarios asociados a Tiendas Oficiales que no envían el atributo **official_store_id** :

- **Error 400** :  Código: item.official_store_id.invalid Mensaje: Users type brand have to provide a official store id

```
{
  "message": "Validation error",
  "error": "validation_error",
  "status": 400,
  "cause": [
    {
      "code": "item.official_store_id.invalid",
      "message": "Users type brand have to provide a official store id"
    }
  ]
}
```

Si no envías el **official_store_id**  del artículo para una Tienda Oficial multimarca, recibirás como respuesta los posibles ID que podrías enviar con tu usuario.

- **Error 403** :  Código: body.invalid_official_store_id Mensaje: The seller 148829068 is not allowed to use official_store_id 315 on site MLA.

Si envías un **official_store_id**  inválido para una Tienda Oficial multimarca, recibirás este error.

```
{
  "message": "body.invalid_official_store_id",
  "error": "The seller 148829068 is not allowed to use official_store_id 315 on site MLA.",
  "status": 403,
  "cause": []
}
```

### Lecturas recomendadas

- [Ciclo de vida de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/ciclo-de-vida-de-las-publicaciones-de-inmuebles)

- [Actualiza tu inmueble](https://developers.mercadolibre.com.ar/es_ar/actualiza-tus-publicaciones)

- [Calidad de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación inicial |
