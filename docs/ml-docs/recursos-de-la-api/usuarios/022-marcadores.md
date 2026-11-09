<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/marcadores -->
<!-- Sección: Recursos de la API > Usuarios -->

# Favoritos

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Marcadores

Con el recurso de Marcadores puedes agregar o eliminar referencias que se sincronizan con aplicaciones móviles.

## Accede a tus marcadores

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/me/bookmarks
```

Respuesta:

```
[
    {
        "item_id": "MLA880652918",
        "bookmarked_date": "2021-05-22T15:24:19.000-04:00"
    },
    {
        "item_id": "MLA878620076",
        "bookmarked_date": "2021-05-22T15:24:15.000-04:00"
    },
    {
        "item_id": "MLA905560536",
        "bookmarked_date": "2021-05-22T15:24:07.000-04:00"
    }
]
```

## Marca un producto

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
   	"item_id":"MLA5529"
}
https://api.mercadolibre.com/users/me/bookmarks
```

## Elimina un marcador

Los marcadores se pueden eliminar en cualquier momento con solo eliminar la referencia.

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" https://api.mercadolibre.com/users/me/bookmarks/MLA5529
```

Respuesta:

```
{
  "item_id":"MLA426609874",
  "bookmarked_date":"2012-08-21T10:43:32.978-04:00"
}
```
