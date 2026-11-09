<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/recurso-de-visitas -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Visitas

Última actualización 02/01/2026

## Visitas

Con este recurso puedes obtener la información sobre visitas de publicaciones en Mercado Libre. Puedes consultar datos por ventanas de tiempo y sites. Recuerda que al volver a publicar se heredan las visitas históricas del parent_item, sin importar cuántas veces se vuelva a publicar.

## Descripción de parámetros

- **user_id**  (Integer): ID de usuario.

- **item_id**  (String): ID de artículo.

- **date_from**  (Date): Fecha, en formato ISO, que define el inicio de la consulta. El máximo es de 150 días.

- **date_to**  (Date): Fecha, en formato ISO, que define el fin de la consulta. El máximo es de 150 días.

- **ending**  (Date, opcional): Fecha en formato ISO **YYYY-MM-DD**  que establece el tiempo de finalización de la muestra. Por defecto es la fecha y hora actuales.

- **unit**  (String): Unidad de consulta. Valores posibles: `day`.

- **last**  (Integer, opcional): Denota cuántos días atrás cubrirá la muestra.

### Campos de respuesta

- **total_visits**  (Integer): Visitas totales a un artículo.

- **visits_detail**  (Array): Visitas detalladas por país y site.

- **results**  (Array): Detalle de visitas agrupadas por intervalos de tiempo. La longitud está definida por el parámetro `unit`.

## Visitas totales por usuario

Recupera las visitas totales que recibe un usuario entre rangos de fechas.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/items_visits?date_from=$DATE_FROM&date_to=$DATE_TO
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/1000011398/items_visits?date_from=2021-01-01&date_to=2021-02-01
```

Respuesta:

```
{
  "user_id": 1000011398,
  "date_from": "2021-01-01T00:00:00Z",
  "date_to": "2021-02-01T00:00:00Z",
  "total_visits": 323690,
  "visits_detail": [
    {
      "company": "mercadolibre",
      "quantity": 323690
    }
  ]
}
```

## Visitas totales por artículo

Recupera las visitas totales a un artículo de los últimos dos años.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/visits/items?ids=$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/visits/items?ids=MLB9992242141
```

Respuesta:

```
{
  "MLB9992242141": 552
}
```

## Visitas por artículo entre rangos de fecha

Recupera las visitas totales de acuerdo con un conjunto de artículos concatenados dentro de un rango de fechas, por site.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/visits?ids=$ITEM_ID&date_from=$DATE_FROM&date_to=$DATE_TO
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/visits?ids=MCO473861358&date_from=2021-01-01&date_to=2021-02-01
```

Respuesta:

```
{
  "item_id": "MCO473861358",
  "date_from": "2021-01-01T00:00:00Z",
  "date_to": "2021-02-01T00:00:00Z",
  "total_visits": 536,
  "visits_detail": [
    {
      "company": "mercadolibre",
      "quantity": 536
    }
  ]
}
```

## Visitas con fecha por usuario

Recupera las visitas de un usuario a cada artículo para cierta ventana de tiempo, por site. El detalle de la información está agrupado por intervalos de tiempo.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/items_visits/time_window?last=$LAST&unit=$UNIT&ending=$ENDING
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/1000011398/items_visits/time_window?last=2&unit=day
```

Respuesta:

```
{
  "user_id": 1000011398,
  "date_from": "2021-01-08T00:00:00Z",
  "date_to": "2021-01-10T00:00:00Z",
  "total_visits": 2923,
  "last": 2,
  "unit": "day",
  "results": [
    {
      "date": "2021-01-08T00:00:00Z",
      "total": 2205,
      "visits_detail": [
        {
          "company": "mercadolibre",
          "quantity": 2205
        }
      ]
    },
    {
      "date": "2021-01-09T00:00:00Z",
      "total": 718,
      "visits_detail": [
        {
          "company": "mercadolibre",
          "quantity": 718
        }
      ]
    }
  ]
}
```

## Visitas con fecha por artículo

Recupera las visitas a un artículo para cierta ventana de tiempo, por site. El detalle de la información está agrupado por intervalos de tiempo.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/visits/time_window?last=$LAST&unit=$UNIT&ending=$ENDING
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MCO471870973/visits/time_window?last=2&unit=day&ending=2021-08-06
```

Respuesta:

```
{
  "item_id": "MCO471870973",
  "date_from": "2021-08-04T00:00:00Z",
  "date_to": "2021-08-06T00:00:00Z",
  "total_visits": 26,
  "last": 2,
  "unit": "day",
  "results": [
    {
      "date": "2021-08-04T00:00:00Z",
      "total": 16,
      "visits_detail": [
        {
          "company": "mercadolibre",
          "quantity": 16
        }
      ]
    },
    {
      "date": "2021-08-05T00:00:00Z",
      "total": 10,
      "visits_detail": [
        {
          "company": "mercadolibre",
          "quantity": 10
        }
      ]
    }
  ]
}
```

## Errores

La siguiente tabla lista los posibles errores que retorna la API de Visitas:

| Status_code | Error code | Mensaje de error | Descripción |
| --- | --- | --- | --- |
| 400 | bad_request | Invalid Site ID | Cuando el artículo o usuario no pertenece a un site local válido. |
| 400 | bad_request | unknown date format | Cuando el parámetro date_from o date_to está ausente o tiene un formato inválido. |
| 400 | bad_request | invalid time window, should be smaller or equal to 150 days | Cuando el rango de tiempo excede el máximo permitido de 150 días. |
| 400 | bad_request | invalid date format for ending date | Cuando el parámetro ending tiene un formato de fecha inválido. Solo se acepta el formato YYYY-MM-DD. |
| 400 | validation_parameters | maximum amount of items to query is 1 | Cuando se intenta consultar más de un artículo a la vez en el parámetro ids. |
| 400 | bad_request | Invalid item ID format: $ITEM_ID | Cuando el ID del artículo no sigue el formato correcto (prefijo de site + ID numérico). |
| 403 | PA_UNAUTHORIZED_RESULT_FROM_POLICIES | At least one policy returned UNAUTHORIZED | Cuando el access token es inválido, ha expirado, o no tiene los permisos requeridos. |
| 404 | not_found | Item not found | Cuando el ID del artículo no existe en el endpoint time_window. |
