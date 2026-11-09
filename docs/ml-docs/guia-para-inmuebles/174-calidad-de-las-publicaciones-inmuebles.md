<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Calidad de las Publicaciones

Última actualización 19/06/2026

## Calidad de las Publicaciones

Esta guía explica cómo utilizar los recursos de la API para maximizar la calidad y visibilidad de las publicaciones de inmuebles en MercadoLibre. Una alta calidad en tus publicaciones se traduce en una mejor experiencia para los compradores y un mayor potencial de ventas. Esta sección te guiará a través de las mejores prácticas y herramientas disponibles para asegurar que tus publicaciones cumplan con los estándares de calidad requeridos.

## Niveles de Calidad por País

Como paso inicial revisemos los niveles de calidad por sitio, haciendo uso del recurso **/health_levels**  que permite identificar el rango de puntuación necesario para cada nivel de publicación.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/sites/$SITE_ID/health_levels
```

### Parámetros de la solicitud

| Parámetro | Tipo | Opcional | Valores / Descripción |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Primeros pasos](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-inmuebles). |
| SITE_ID | string | No | Corresponde al ID del país consultado, por ejemplo `MLA` para Argentina. |

Respuesta:

```
[
  {
    "level": "basic",
    "health_min": 0,
    "health_max": 0.49
  },
  {
    "level": "standard",
    "health_min": 0.5,
    "health_max": 0.65
  },
  {
    "level": "professional",
    "health_min": 0.66,
    "health_max": 1
  }
]
```

### Campos de la respuesta

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| level | string | Identificación del nivel de calidad en que se puede encontrar la publicación: basic, standard o professional. |
| health_min | float | Valor mínimo del rango de puntuación utilizado para identificar el nivel de calidad. |
| health_max | float | Valor máximo del rango de puntuación utilizado para identificar el nivel de calidad. |

## Niveles de Calidad por Ítem

Conociendo los rangos de calidad por nivel para un país específico, el recurso **/health**  permite identificar el nivel de calidad de una publicación. Además, este recurso muestra el porcentaje de calidad del ítem, calculado como la división entre la cantidad de objetivos cumplidos y la cantidad de objetivos aplicables.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/items/$ITEM_ID/health
```

### Parámetros de la solicitud

| Parámetro | Tipo | Opcional | Valores / Descripción |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token de tu usuario. |
| ITEM_ID | string | No | ID del ítem que se desea consultar. |

Respuesta:

```
{
  "item_id": "MLA123456",
  "health": 0.25,
  "level": "basic",
  "goals": [
    {
      "progress": 0,
      "progress_max": 1,
      "id": "picture",
      "name": "picture",
      "apply": true,
      "data": {
        "min": 12
      }
    },
    {
      "progress": 0,
      "progress_max": 1,
      "id": "technical_specification",
      "name": "technical_specification",
      "apply": true
    },
    {
      "progress": 0,
      "progress_max": 1,
      "id": "video",
      "name": "video",
      "apply": true
    },
    {
      "progress": 0,
      "progress_max": 1,
      "id": "upgrade_listing",
      "name": "upgrade_listing",
      "apply": false
    },
    {
      "progress": 1,
      "progress_max": 1,
      "id": "publish",
      "name": "publish",
      "apply": true,
      "completed": "2025-06-05T23:09:01.032Z"
    }
  ]
}
```

### Campos de la respuesta

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| item_id | string | ID del ítem consultado. |
| health | float | Porcentaje de calidad actual del ítem. |
| level | string | Nivel de publicación. |
| goals | array | Objetivos pendientes a corregir para mejorar la calidad de publicación. |
| id | string | ID del atributo a mejorar. |
| name | string | Nombre del atributo a mejorar. |
| apply | boolean | Indica si el parámetro objetivo es aplicable para el ítem. |
| progress | integer | Valor actual del progreso en el objetivo. Cuando es igual a `progress_max`, el objetivo fue alcanzado. |
| progress_max | integer | Valor máximo de progreso posible para el parámetro objetivo. |
| data | integer | Presenta los valores a alcanzar en el parámetro objetivo. |

Nota:

En el campo "data" del goal "technical_specification", se retornan los atributos pendientes de completar que impactan el score de calidad del ítem.

Analizando los resultados, se observa que para la publicación del ítem consultado, por ejemplo en el primer objetivo **picture** , se tiene un progreso de 0 de 1. Este parámetro, aplicable al ítem, requiere un mínimo de 12 imágenes en la publicación para mejorar el porcentaje de calidad.Pero ampliaremos estas acciones a continuación.

Nota:

Si recibes el error **"health is not supported for this item"** , revisa los siguientes requisitos con relación al ítem consultado:

- El ítem no puede ser de desarrollo. Verifica que el "domain_id" del ítem no contenga el string **DEVELOPMENT** .

- El ítem debe estar activo y no puede tener tags de penalización.

## Acciones para mejorar la calidad de una publicación

Como mencionamos anteriormente, luego de identificar el nivel de calidad del ítem, en casos aplicables, es posible verificar cuáles son los objetivos que el vendedor aún tiene pendientes y puede ajustar para mejorar la calidad de la publicación y ganar más exposición.

Para conocer las acciones que se pueden implementar, ejecuta el siguiente comando con el ID del ítem y tu token respectivo.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/items/$ITEM_ID/health/actions
```

Recibirás una respuesta, donde se presenta la puntuación actual de la calidad de tu publicación y los elementos accionables para mejorar dicha calidad.

Ejemplo de respuesta:

```
{
  "item_id": "MLA123456",
  "health": 0.25,
  "actions": [
    { "id": "picture", "name": "picture" },
    { "id": "technical_specification", "name": "technical_specification" },
    { "id": "video", "name": "video" }
  ]
}
```

### Campos de la respuesta

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| item_id | string | ID del ítem consultado. |
| health | float | Porcentaje de calidad actual del ítem. |
| actions | array | Parámetros sobre los que se puede implementar una acción para mejorar la calidad de la publicación. |
| id | string | ID del parámetro a accionar. |
| name | string | Nombre del parámetro a accionar. |

Basándonos en esta respuesta y la anterior, se pueden implementar acciones más específicas en ciertos campos. Esto te permitirá optimizar la calidad de las publicaciones y maximizar su potencial para lograr una mayor visibilidad.

Para algunos atributos y categorías específicos se presentan algunas recomendaciones y guías en las que puedes apoyarte para mejorar la calidad de las publicaciones.

### 1. Imágenes (Pictures)

La calidad de una publicación se ve directamente impactada por la cantidad mínima de imágenes. Se definen tres grupos con requisitos distintos, según el tipo de propiedad:

- **Grupo 1:**  Para Casas, Departamentos, Oficinas o Parcelas, se exige un mínimo de 12 fotografías o imágenes.

- **Grupo 2:**  En el caso de Locales, Agrícolas, Sitios, Terrenos, Bodegas y Lotes, se requiere un mínimo de 6 fotografías o imágenes.

- **Grupo 3:**  Para Estacionamientos, el mínimo establecido es de 4 fotografías o imágenes.

### 2. Atributos técnicos

Asegúrate de completar todos los atributos obligatorios y más representativos de tu publicación para asegurar de exponer todas las características necesarias y llamativas para tu inmueble. Puedes consultar más información en la guía de [atributos para inmuebles](https://developers.mercadolibre.com.ar/es_ar/atributos-inmuebles) o en la guía de [atributos generales](https://developers.mercadolibre.cl/es_ar/atributos#)

### 3. Video

Para enriquecer tu publicación, considera añadir un video o un tour virtual de la propiedad. Esto se realiza mediante el campo `video_id` en la publicación. Este campo requiere una cadena compuesta por el identificador del recurso multimedia y el identificador del proveedor o plataforma del recurso.

#### Formato del campo video_id

- video_id = id_del_recurso_multimedia;id_del_proveedor_multimedia

Se admiten dos tipos de recursos multimedia

- **YouTube (solo videos):**  El parámetro debe seguir este formato: video_id:"gqkEN9poKM;youtube".

- **Matterport (solo tours virtuales):**  El parámetro debe seguir este formato: video_id:"gqkEN9poKM;matterport".

Importante:

Solo se permite un tipo de contenido multimedia, ya sea un enlace de video de YouTube o una URL de Matterport. 
 El campo video_id no acepta parámetros adicionales en la URL del video. Por ejemplo, "video_id:"URTsWQ6iHsJ**\&brand=0**;matterport"" no funcionará.

### 4. Publicaciones de venta y arriendo

- **Propiedades en venta:**  Es necesario cumplir todos los objetivos para alcanzar el 100% de calidad. Aunque no es obligatorio cumplir con todos los objetivos (por ejemplo, incluir un video), estos elementos adicionales ayudan a mejorar la evaluación general.

- **Propiedades en arriendo:**  Se requiere cumplir con menos objetivos para lograr el 100% de calidad; se debe evaluar con los recursos presentados anteriormente.

### Lecturas recomendadas

- [Actualiza tu inmueble](https://developers.mercadolibre.com.ar/es_ar/actualiza-tus-publicaciones).

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
