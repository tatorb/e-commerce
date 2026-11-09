<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones-vehiculos -->
<!-- Sección: Guía para vehículos -->

# Calidad de publicaciones (vehículos)

Última actualización 19/06/2026

## Calidad de publicaciones (vehículos)

El recurso /health te permite mostrarle a los usuarios (vendedores) la calidad de las publicaciones, sabiendo qué acciones están cumplidas y las pendientes. De esta manera, pueden alcanzar los objetivos de publicación y aumentar la calidad de las publicaciones, mejorando la exposición del ítem y también la experiencia de venta y compra.

## Niveles de calidad por sitio

El recurso /health_level te permite identificar el rango de puntuación necesario para cada nivel de publicación por país.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/health_levels
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLB/health_levels
```

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

**level** : identificación del nivel de calidad en que se encuentra la publicación: basic, standard y professional.
 **health_min**  e **health_max** : representan respectivamente los valores mínimos y máximos del rango de puntuación utilizado para identificar el nivel de calidad en el que la publicación esté.

## Detalle de la calidad por ítem

Para conocer el nivel de calidad de un ítem, dispones del recurso /health. En este, puedes ver el porcentaje de calidad del ítem, el cual es calculado dividiendo la cantidad de objetivos cumplidos por la calidad de objetivos aplicables. Y además, conoces el nivel en el que se encuadra.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/health
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM735814032/health
```

Respuesta:

```
{
    "item_id": "MLM735814032",
    "health": 0.16,
    "level": "basic",
    "goals": [
        {
            "progress": 0,
            "progress_max": 1,
            "id": "picture",
            "name": "picture",
            "apply": true,
            "data": {
                "min": 10
            }
        },
        {
            "progress": 0,
            "progress_max": 1,
            "id": "whatsapp",
            "name": "whatsapp",
            "apply": true
        },
        {
            "progress": 1,
            "progress_max": 1,
            "id": "price",
            "name": "price",
            "apply": true,
            "completed": "2025-04-15T14:23:07.409Z"
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
            "id": "verification",
            "name": "verification",
            "apply": true,
            "data": {
                "is_data_filled": false
            }
        },
        {
            "progress": 0,
            "progress_max": 1,
            "id": "description",
            "name": "description",
            "apply": true
        }
    ]
}
```

### Campos de la respuesta

**id** : identificador del objetivo.
 **name** : nombre descriptivo.
 **apply** : indica si el objetivo es aplicable para el ítem.
 **completed** : muestra la fecha en la cual el objetivo fue cumplido. En caso de que este aún no haya sido cumplido o no aplique, este campo estará oculto.
 **progress_max** : es el número que indica el mayor valor de progreso posible para ese objetivo.
 **progress** : es el número que indica el valor actual del progreso en el objetivo. Cuando fuera igual al valor progress_max, significa que el objetivo fue alcanzado.
 **health** : representa el porcentaje de calidad del ítem.
 **data** : presenta los valores a alcanzar en el parámetro objetivo.

Nota:

En el campo "data" del goal "technical_specification", se retornan los atributos pendientes de completar que impactan el score de calidad del ítem.

## Acciones necesarias para mejorar la calidad de un ítem

Luego de identificar el nivel de calidad del ítem, en casos aplicables, es posible verificar cuáles son los objetivos que el vendedor aún tiene pendientes y puede ajustar para mejorar la calidad de publicación de la publicación y ganar más exposición.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/health/actions
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLM735814032/health/actions
```

Respuesta:

```
{
   "item_id": "MLM735814032",
  "health": 0.16,
    "actions": [
        {
            "id": "picture",
            "name": "picture"
        },
        {
            "id": "whatsapp",
            "name": "whatsapp"
        },
        {
            "id": "video",
            "name": "video"
        },
        {
            "id": "verification",
            "name": "verification"
        },
        {
            "id": "description",
            "name": "description"
        }
    ]
}
```

### Descripción de las acciones

En actions puedes encontrar todas las acciones que te ayudarán a mejorar la calidad de la publicación. A continuación, puedes conocer todas las acciones posibles y los recursos que deberían ser verificados para realizar las mejoras:

### Acciones para Vehículos

**picture** : [cantidad mínima de imágenes.](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos#Imagenes)
 **price** : publicar con precio más competitivo, y en caso de que aplique, te vamos a indicar el rango de precio que puedes utilizar.
 **technical_specification** : [completar los atributos técnicos específicos del ítem.](https://developers.mercadolibre.com.ar/es_ar/atributos#)
 **video** : [cargar video presentando el vehículo.](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos#Publica-veh%C3%ADculo)
 **upgrade_listing** : [aplicar un upgrade en el tipo de la publicación.](https://developers.mercadolibre.com.ar/es_ar/vehiculos-gestiona-paquetes#Actualizar-un-anuncio)
 **publish** : es el objetivo relacionado a la publicación del ítem, realizado automáticamente al publicar.

Nota:

La carga de [**whatsapp**](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos#Contactos-del-vendedor) en las publicaciones no es más un objetivo considerado para la Calidad de la publicación, todavía sigue teniendo un impacto positivo sobre las conversiones de los ítems.
