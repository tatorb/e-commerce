<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/vehiculos-gestiona-preguntas-y-contactos -->
<!-- Sección: Guía para vehículos -->

# Gestiona preguntas y contactos

Última actualización 20/01/2026

## Gestiona preguntas y contactos

Cuando los usuarios buscan en las publicaciones de clasificados (inmuebles, vehículos, servicios), pueden contactar al propietario de la publicación a través de un formulario que se muestra en la publicación, pueden ver el teléfono del propietario (ver teléfono) y contactar via Whatsapp. En el caso de una pregunta, cuando se realiza, se la envía automáticamente al buzón de entrada de mensajes, dentro de la cuenta del cliente en Mercado Libre. Es muy importante que su integración lea las preguntas y también permita que los usuarios puedan responderlas a través del sistema.

Para saber cómo manejar las preguntas y respuestas, consulte nuestra [guía de Gestión de preguntas y respuestas](https://developers.mercadolibre.com.ar/es_ar/gestiona-preguntas-respuestas). Aquí tiene todo el contenido necesario para poder realizar la integración de leads de Mercado Libre. Además de la guía mencionada arriba, puede consultar datos sobre preguntas y registrar cuántos clics tuvo las opciones **Ver teléfono**  y **Whatsapp** . Estos métodos se detallan más abajo.

Recuerda que las publicaciones con el botón **Quiero que me contacten** , cuando este sea presionado por el comprador, se generará una nueva pregunta en la misma API de preguntas y respuestas.

## Descripción de parámetros

| Tipo | Parámetro | Descripción |
| --- | --- | --- |
| Entero | {userId} | ID de usuario. |
| Entero | {itemId} | ID de producto. |
| Fecha | {dateFrom} | Fecha, en formato ISO, que define el inicio de la consulta. |
| Fecha | {dateTo} | Fecha, en formato ISO, que define el fin de la consulta. |
| Entero | {limit} | Opcional. Cantidad máxima de productos a devolver. |
| Entero | {offset} | Opcional. Paginación. |
| Entero | {last} | Opcional. Denota cuántas horas/días atrás cubrirá la muestra. |
| Cadena | {unit} | Unidad de consulta, valores posibles: [“día”, “hora”]. |
| Fecha | {ending} | Opcional. Fecha, en formato ISO, que establece el tiempo de finalización de la muestra; por defecto es la fecha y hora actuales. |
| Cadena | {order} | Opcional. Clasifica los resultados por fecha: [“desc”, “asc”] (por defecto es “asc”). |

**Importante:**

El formulario de preguntas (**botón “Preguntar”** ) permanece activo solo para sellers con "user_type": "car_dealer" que **no poseen número de WhatsApp**  registrado.

## Consulta del total de preguntas

Puedes acceder a las preguntas totales que tuvo una publicación o las preguntas totales que tuvo un vendedor en todos sus publicaciones en un rango de fechas.

### Por publicación:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/contacts/questions?date_from=$DATE_FROM&date_to=$DATE_TO
```

### Por usuario:

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/contacts/questions?date_from=$DATE_FROM&date_to=$DATE_TO
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLV421672596/contacts/questions?date_from=2014-08-01T00:00:00.000-03:00&date_to=2014-08-02T23:59:59.999
```

Respuesta:

```
{
	"date_from": "2014-08-01T00:00:00.000-03:00",
	"date_to": "2014-08-02T23:59:59.999",
	"item_id": "MLV421672596",
	"total": 9
}
```

### Contactos con fecha

Este recurso te permite acceder a las preguntas sobre una publicación específico o por vendedor para un período de tiempo específico. Además, accedes a detalles sobre contactos realizados en modo invitado (usuarios que no iniciaron sesión o que no están registrados) entre intervalos de tiempo, por hora o por día.

### Por publicación

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/contacts/questions/time_window?last=$LAST&unit=$UNIT
```

Si necesitas concatenar publicaciones, haz lo siguiente:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/contacts/questions/time_window?ids=$ID1,ID2&last=$LAST&unit=$UNIT&ending=$ENDING_DATE
```

### Por usuario

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/contacts/questions/time_window?last=$LAST&unit=$UNIT
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA510272257/contacts/questions/time_window?last=2&unit=hour
```

Respuesta:

```
{
	"item_id": "MLA510272257",
	"total": 0,
	"date_from": "2014-08-06T12:00:00Z",
	"date_to": "2014-08-06T14:00:00Z",
	"last": 2,
	"unit": "hour",
	"results": [
    	{
        	"date": "2014-08-06T12:00:00Z",
        	"total": 0
    	},
    	{
      	  "date": "2014-08-06T13:00:00Z",
        	"total": 0
    	}
	]
}
```

## Clicks en teléfonos de contacto

Puedes acceder a la cantidad total de veces que se hizo clic en la opción ‘Ver teléfono’ de una publicación o para cada publicación de un usuario en rangos de fechas.

### Por publicación

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/contacts/phone_views?date_from=$DATE_FROM&date_to=$DATE_TO
```

### Por usuario

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/contacts/phone_views?date_from=$DATE_FROM&date_to=$DATE_TO
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/52366166/contacts/phone_views?date_from=2014-05-28T00:00:00.000-03:00&date_to=2014-05-29T23:59:59.999
```

Respuesta:

```
{
	"date_from": "2014-05-28T00:00:00.000-03:00",
	"date_to": "2014-05-29T23:59:59.999",
	"total": 71,
	"user_id": "52366166"
}
```

## Click en teléfonos de contacto con fecha

Puedes acceder a la cantidad total de veces que se hizo clic en la opción ‘Ver teléfono’ de una publicación o para cada publicación de un usuario durante cierto período de tiempo. Además de entregar las visitas totales, la información se detalla y agrupa por intervalo de tiempo.

### Por publicación

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/contacts/phone_views/time_window?last=$LAST&unit=$UNIT
```

## Si necesitas concatenar publicaciones:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/contacts/phone_views/time_window?ids=$ID1,ID2&last=$LAST&unit=$UNIT&ending=$ENDING_NOTE
```

### Por usuario

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/contacts/phone_views/time_window?last=$LAST&unit=$UNIT
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/contacts/phone_views/time_window?ids=MLA510272257,MLA489747739&last=2&unit=hour&ending=2014-05-28T00:00:00.000-03:00
```

Respuesta:

```
[
	{
    	"item_id": "MLA510272257",
    	"total": 0,
    	"date_from": "2014-05-28T02:00:00Z",
    	"date_to": "2014-05-28T04:00:00Z",
    	"last": 2,
    	"unit": "hour",
    	"results": [
        	{
            	"date": "2014-05-28T02:00:00Z",
            	"total": 0
        	},
        	{
            	"date": "2014-05-28T03:00:00Z",
            	"total": 0
        	}
    	]
	},
	{
    	"item_id": "MLA489747739",
    	"total": 0,
    	"date_from": "2014-05-28T02:00:00Z",
  	  "date_to": "2014-05-28T04:00:00Z",
    	"last": 2,
    	"unit": "hour",
    	"results": [
        	{
            	"date": "2014-05-28T02:00:00Z",
            	"total": 0
        	},
        	{
            	"date": "2014-05-28T03:00:00Z",
            	"total": 0
        	}
    	]
	}
]
```

**Estructura Errores 400:**

Respuesta:

```
{ 
 "code":"bad_request", 
 "message":"error decoding 'user_id'. It must be string or number"
}
```

## Clicks en botón de Whatsapp

Puedes acceder a la cantidad total de veces que se hizo clic en la opción **Whatsapp**  de una publicación o para cada publicación de un usuario en rangos de fechas.

### Por publicación

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/items/$ITEM_ID/contacts/whatsapp?date_from=$DATE_FROM&date_to=$DATE_TO
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/items/MLA1116194549/contacts/whatsapp?date_from=2014-05-28T00:00:00.000-03:00&date_to=2014-05-29T23:59:59.999
```

Respuesta:

```
{
    "total": 3,
    "date_from": "2022-10-14T17:01:00Z",
    "date_to": "2022-10-29T17:01:00Z",
    "item_id": "MLA1116194549"
}
```

### Por usuario

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/users/$USER_ID/contacts/phone_views?date_from=$DATE_FROM&date_to=$DATE_TO
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/users/127232529/contacts/phone_views?date_from=2014-05-28T00:00:00.000-03:00&date_to=2014-05-29T23:59:59.999
```

Respuesta:

```
{
    "total": 174,
    "date_from": "2022-10-14T17:01:00Z",
    "date_to": "2022-10-29T17:01:00Z",
    "user_id": "127232529"
}
```

## Clicks en botón de Whatsapp con fecha

Puedes acceder a la cantidad total de veces que se hizo clic en el botón **WhatsApp**  de un publicación o para cada publicación de un usuario durante cierto período de tiempo. Además de entregar los clics totales, la información se detalla y agrupa por intervalo de tiempo..

### Por publicación

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/contacts/whatsapp/time_window?unit=$UNIT&last=$LAST
```

### Si necesitas consultar múltiples publicaciones:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/contacts/whatsapp/time_window?ids=$IDS&unit=$UNIT&last=$LAST&ending=$ENDING
```

### Parámetros

**ids:**  obligatorio. Indica los ids de los Ítems cuando la búsqueda es por múltiples publicaciones, se separan por coma.

**last:**  obligatorio. Denota cuántas horas/días atrás cubrirá la muestra.

**unit:**  obligatorio. Unidad de consulta, valores posibles: [“day”, “hour”].

**ending:**  opcional. Fecha, en formato ISO, que establece el tiempo de finalización de la muestra; por defecto es la fecha y hora actuales.

### Por usuario

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/contacts/whatsapp/time_window?unit=$UNIT&last=$LAST
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/127232529/contacts/whatsapp/time_window?unit=$UNIT&last=$LAST
```

Respuesta:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
 {
    "total": 31,
    "last": "3",
    "unit": "day",
    "date_from": "2022-10-26T04:00:00Z",
    "date_to": "2022-10-29T04:00:00Z",
    "user_id": "127232529",
    "results": [
        {
            "date": "2022-10-26T04:00:00Z",
            "total": 7
        },
        {
            "date": "2022-10-27T04:00:00Z",
            "total": 16
        },
        {
            "date": "2022-10-28T04:00:00Z",
            "total": 8
        }
    ]
}
```

## Visitas por publicación

Para consultar las visitas por publicación, utilice el artículo [Recurso de Visitas](https://developers.mercadolibre.com.ar/es_ar/recurso-de-visitas#Visitas).

**Siguiente:**  [Personas Interesadas](https://developers.mercadolibre.com.ar/es_ar/persona-interesadas)
