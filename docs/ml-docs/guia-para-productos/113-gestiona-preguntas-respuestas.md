<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestiona-preguntas-respuestas -->
<!-- Sección: Guía para productos -->

# Preguntas y respuestas

Última actualización 29/09/2023

## Gestiona preguntas y respuestas

Las preguntas son la forma en que los compradores pueden comunicarse con los vendedores en la página Detalles del artículo antes de realizar una transacción y, por lo tanto, la forma en que manejes la interacción en esta etapa será decisiva para realizar una venta exitosa.

## Buscar preguntas

Importante:

Devolvemos vacío el texto en preguntas y respuestas con status: “BANNED”. 
 **Utiliza el parámetro api_version=4**  para obtener la nueva estructura del JSON.

Existen varias formas de buscar preguntas.

## Preguntas recibidas por un vendedor

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?seller_id=$SELLER_ID&api_version=4
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?seller_id=419059118&api_version=4
```

Respuesta:

```
 
{
   "total": 36,
   "limit": 2,
   "questions": [
       {
           "date_created": "2021-02-16T14:50:27.938-04:00",
           "item_id": "MLA903218023",
           "seller_id": 189394110,
           "status": "ANSWERED",
           "text": "Texto de la pregunta.",
           "id": 11764931832,
           "deleted_from_listing": false,
           "hold": false,
           "suspected_spam": false,
           "answer": {
               "text": "",
               "status": "BANNED",
               "date_created": "2021-02-16T14:52:13.580-04:00"
           },
           "from": {
               "id": 162981404
           }
       },
       {
           "date_created": "2021-02-16T14:47:58.950-04:00",
           "item_id": "MLA903218023",
           "seller_id": 189394110,
           "status": "BANNED",
           "text": "",
           "id": 11764926522,
           "deleted_from_listing": false,
           "hold": false,
           "suspected_spam": false,
           "answer": null,
           "from": {
               "id": 162981404
           }
       }
   ],
....
}
```

Nota:

Ten en cuenta que las preguntas de más de 7 meses sin responder serán eliminadas.

## Preguntas recibidas respecto de un artículo

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?item=$ITEM_ID&api_version=4
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?item=MLB1623490410&api_version=4
```

Respuesta:

```
{
    "total": 1,
    "limit": 50,
    "questions": [
        {
            "date_created": "2020-08-20T13:22:01.600-04:00",
            "item_id": "MLB1623490410",
            "seller_id": 419059118,
            "status": "UNANSWERED",
            "text": "Hola, estoy interesado en Item De Prueba, por favor comunícate conmigo. ¡Gracias!",
            "id": 11436370259,
            "deleted_from_listing": false,
            "hold": false,
            "answer": null,
            "from": {
                "id": 419067349
            }
        }
    ],
    "filters": {
        "limit": 50,
        "offset": 0,
        "api_version": "4",
        "is_admin": false,
        "sorts": [],
        "caller": 419059118,
        "item": "MLB1623490410"
    },
    "available_filters": [
        {
            "id": "from",
            "name": "From user id",
            "type": "number"
        },
        {
            "id": "seller",
            "name": "Seller id",
            "type": "number"
        },
        {
            "id": "totalDivisions",
            "name": "total divisions",
            "type": "number"
        },
        {
            "id": "division",
            "name": "Division",
            "type": "number"
        },
        {
            "id": "status",
            "name": "Status",
            "type": "text",
            "values": [
                "ANSWERED",
                "BANNED",
                "CLOSED_UNANSWERED",
                "DELETED",
                "DISABLED",
                "UNANSWERED",
                "UNDER_REVIEW"
            ]
        }
    ],
    "available_sorts": [
        "item_id",
        "from_id",
        "date_created",
        "seller_id"
    ]
}
```

### ¿Cómo ordenar?

Para ordenar los resultados puedes añadir los siguientes query params:

**sort_fields** : permite ordenar los resultados de la búsqueda por uno o varios campos determinados. Acepta los campos item_id, seller_id, from_id y date_created separados por coma. 
 Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?seller_id=$SELLER_ID&sort_fields=item_id,date_created&api_version=4
```

**sort_types** : permite establecer si el ordenamiento de los campos establecidos en sort_fields será de forma ASC o DESC. 
 Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?seller_id=$SELLER_ID&sort_fields=item_id,date_created&sort_types=ASC&api_version=4
```

## Preguntas realizadas por un usuario respecto de un artículo

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?item=$ITEM_ID&from=$CUST_ID&api_version=4
```

## Preguntas por ID

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/$QUESTION_ID?api_version=4
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/11751825075?api_version=4
```

Respuesta:

```
{
    "id": 11751825075,
   "seller_id": 179571326,
   "buyer_id": 56801932,
   "item_id": "MLA739200576",
   "deleted_from_listing": false,
   "suspected_spam": false,
   "status": "ANSWERED",
   "hold": false,
   "text": "Texto de la pregunta.",
   "app_id": 8304540643508652,
   "date_created": "2021-02-08T17:51:21.746608612Z",
   "last_updated": "2021-02-08T17:51:29.184950392Z",
   "answer": {
       "text": "",
       "status": "BANNED",
       "date_created": "2021-02-16T14:52:13.580-04:00"
   }

}
```

Respuesta para Vehículos:

```
{
	"id": 11949565740,
	"seller_id": 456236760,
	"text": "Hola Tete936018, Estoy interesado en Prueba - San Jose De La Estrella / La Serena, por favor comunícate conmigo. ¡Gracias!",
	"status": "UNANSWERED",
	"item_id": "MLC595976788",
	"date_created": "2021-06-16T12:07:18.109-04:00",
	"hold": false,
	"deleted_from_listing": false,
	"answer": null,
	"from": {
		"id": 21547449,
		"answered_questions": 0,
		"first_name": "Juan",
		"last_name": "Lead",
		"phone": {
			"number": "95712582",
			"area_code": "9"
		},
		"email": "juan.lead@mail.com"
	}
}
}
```

Nota:

Conoce los motivos por los cuales una pregunta o respuesta tiene **"status": "BANNED"**  consultando [/moderations/infractions](https://developers.mercadolibre.com.ar/es_ar/moderaciones).

## Descripción de atributos

**id** : ID de la pregunta

**seller_id** : ID del vendedor del producto

**text** : Texto de la pregunta

**status** : Estado de la pregunta

**Valores posibles:**

**-unanswered** : La pregunta todavía no fue respondida

**-answered** : La pregunta no fue respondida

**-closed_unanswered** : El producto está cerrado y la pregunta nunca fue respondida

**-under_review** : El producto está en análisis y la pregunta también

**-item_id** : ID del producto al cual pertenece la pregunta

**-date_created** : Fecha de creación de la pregunta

**-answer** : Respuesta del vendedor

**text** : Texto de la respuesta

**status** : Estado de la respuesta

**Valores posibles** :

**-active** : La respuesta se encuentra disponible

**-disabled** : La respuesta fue deshabilitada

**date_created** : Fecha de creación de la respuesta

¡Excelente! Ahora sabes qué aspectos debes tener en cuenta en relación a las preguntas. Mira cuáles son las acciones disponibles de acuerdo a la búsqueda de preguntas.

## Métodos permitidos

GET /questions/:id devuelve una pregunta con ese ID. 
POST /questions: crea una pregunta sobre un artículo. 
DELETE /questions/:id: elimina una pregunta.
POST /answers/: publica una respuesta a una pregunta determinada. 
POST /my/questions/hidden: oculta preguntas. 
Como ves, puedes buscar preguntas por artículo, vendedor y usuario que la formuló y filtrarlas por estado o período. Si lo deseas, también puedes buscar todas las preguntas recibidas y ocultarlas.

## Recursos y conexiones relacionados

Utiliza los siguientes recursos para buscar preguntas por artículo o por usuario. Deberás incluir el item_id o el cust:id.

```
"related_resources": [
    	"/items",
        "/users"
	],
	"connections": {
    	"item_id": "/items/:id",
    	"seller_id": "/users/:id"
	}
}
```

Veamos algunos ejemplos de cómo buscar preguntas en nuestra plataforma.

## Formular preguntas

Es una tarea muy fácil. Solo debes conocer el item_id y enviarlo junto con un String de texto en el cuerpo del JSON como en el siguiente ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' "Content-Type: application/json" -d
{
   "text":"Do you have these shoes in red?",
   "item_id":"MLA123456"
}
https://api.mercadolibre.com/questions
```

Nota:

Recuerda realizar el POST con codificación UTF-8 para evitar conflictos con caracteres especiales.

## Responder preguntas

Cuando tienes gran cantidad de artículos publicados en Mercado Libre, es probable que recibas muchas preguntas; por eso, te recomendamos que desarrolles un método para responder esas preguntas de un modo semiautomático, en el cual los operadores reciben respuestas sugerencias en base a palabras clave frecuentemente recibidas. Para hacerlo, debes saber cómo responder una pregunta por API. Esto será fácil. Primero, veamos todas las preguntas recibidas para tu artículo. Simplemente, realiza una búsqueda de preguntas por artículo como muestra el ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/search?item_id=$ITEM_ID&api_version=4
```

Verás que las preguntas tienen un estado, por eso es probable que debas mantenerlas en el estado “unanswered”. Ahora, respondamos una sola pregunta:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' "Content-Type: application/json" -d
{
"question_id": 3957150025, 
 "text":"Test answer..." 
}
https://api.mercadolibre.com/answers
```

Al trabajar con preguntas, es muy útil escuchar las Notificaciones, porque te permiten tener un feed en tiempo real de los eventos que se producen con relación a las mismas. Conoce [cómo trabajar con notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones).

Nota:

Para responder o formular preguntas el máximo de caracteres es de 2.000.

## Calcular tiempo de respuesta

El nuevo recurso de “tiempo de respuestas” calcula en minutos el tiempo que demora un vendedor en responder la consulta. Se puede dar en 3 períodos:

- Lunes a Viernes de 09 a 18 hs (weekdays_working_hours).

- Lunes a Viernes de 18 a 00 hs (weekdays_extra_hours).

- Sábados y Domingos (weekend).

Además, permite visualizar el porcentaje de ventas proyectadas que puede tener el vendedor si se responde en menos de 1 hora, visualizando el porcentaje en el campo “sales_percent_increase”. 
El promedio es considerado por cada uno de los periodos mencionados, contemplando los últimos 14 días de preguntas y utilizando la primera pregunta que realizó un comprador sobre un ítem. 
Las preguntas sin respuesta van a considerarse respondidas al momento de calcular los tiempos de respuesta, con un tope de 1 semana. Ejemplo: Si contamos con una pregunta sin responder desde hace 4 días, se va a considerar que hay una pregunta que se tardó en responder 4 días y al dia siguiente 5 días.
Para el objeto “total” se consideran los datos de los últimos 14 días sin períodos, también incluyen las preguntas de 0 a 9 hs que no entran en ninguno de los otros periodos de los que damos visibilidad por corte.
 Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/questions/response_time
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/1111111/questions/response_time
```

Respuesta:

```
{
	"user_id": 1111111,
	"total": {
		"response_time": 22
	},
	"weekend": {
		"response_time": 8,
		"sales_percent_increase": null
	},
	"weekdays_working_hours": {
		"response_time": 8,
		"sales_percent_increase": null
	},
	"weekdays_extra_hours": {
		"response_time": 72,
		"sales_percent_increase": 10
	}
}
```

## Descripción de parámetros

**user_id:**  El ID del vendedor consultado. 
**total:**  El tiempo promedio de respuesta del vendedor, sin considerar franjas de horarios.
**response_time:**  Representa el tiempo de respuesta promedio del vendedor en la unidad de tiempo minutos. 
**weekend:**  El tiempo promedio de respuesta del vendedor durante los fines de semana.
**weekdays_working_hours:**  El tiempo promedio de respuesta del vendedor en horario laboral en días hábiles (lunes a viernes, de 9 a 18hs).
**weekdays_extra_hours:**  El tiempo de respuesta promedio del vendedor en horario extra laboral en días hábiles (lunes a viernes, de 18 a 00hs).
**sales_percent_increase:**  El porcentaje de ventas que se podrían incrementar si se mejoran los tiempos de respuesta, siempre y cuando el response_time sea mayor a 60 en cualquiera de los segmentos, excepto en el Total que no cuenta con este parámetro.

Nota:

Ten en cuenta que la información se actualiza una vez por día.

En caso que el seller consultado no cuente con preguntas en sus ítems, se dará como respuesta un Not Found 404. 
Ejemplo:

```
{
	"message": "Response time not found for user id: 276274936",
	"error": "not_found",
	"status": 404,
	"cause": []
}
```

## Eliminar preguntas

Si necesitas eliminar una pregunta que realizó un usuario sobre tu artículo, simplemente utiliza el método eliminar con el ID de pregunta y el ACCESS TOKEN del usuario. 
Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/questions/$QUESTION_ID
```

Eliminar con nuestros SDK (ejemplo) Respuesta:

```
[
  "Question deleted."
]
```

Si deseas, puedes [bloquear usuarios](https://developers.mercadolibre.com.ar/es_ar/inmuebles-consulta-usuarios?nocache=true#Bloquear-usuarios-de-preguntas) para evitar que realicen preguntas.

## Notificaciones

Suscríbete a las notificaciones de preguntas, mediante el tópico questions. Conoce más sobre [notificaciones de Preguntas](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones).

## Referencia de códigos de error

| Error_code | Mensaje de error | Descripción | Posible solución |
| --- | --- | --- | --- |
| invalid_question | La pregunta es inválida. | No se puede responder la pregunta. | El parámetro question_id debe ser un número entero. Para buscar tu pregunta, llama a resource/questions/search [recurso/preguntas/búsqueda]. |
| invalid_post_body | JSON inválido. Los atributos válidos son: {0}. | Parámetros inválidos. | Los parámetros esperados son question_id y text. |

**Siguiente:**  [Moderaciones](https://developers.mercadolibre.com.ar/es_ar/moderaciones).
