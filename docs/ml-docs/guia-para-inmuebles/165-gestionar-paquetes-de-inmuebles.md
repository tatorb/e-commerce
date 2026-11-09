<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestionar-paquetes-de-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Gestionar paquetes de inmuebles

Última actualización 24/11/2025

## Gestionar paquetes de inmuebles

Para publicar anuncios de inmuebles en MercadoLibre, es requisito indispensable contar con un **paquete de publicaciones** . Un paquete de publicaciones es un servicio que otorga al vendedor un cupo determinado de anuncios y/o beneficios especiales, como destacar sus publicaciones sobre otras, según el tipo de paquete elegido.

Estos paquetes son necesarios para asegurar la correcta gestión y exposición de los inmuebles en la plataforma.La contratación de los paquetes la mencionamos más adelante en esta guía.

## Tipos de Paquetes

**Importante:**

Con el objetivo de elevar la calidad de las publicaciones y garantizar una mejor experiencia a los compradores, a partir del **20 de enero de 2026** , será **obligatorio el envío de al menos una imagen**  para todas las publicaciones creadas con **Listing Type Silver** .

De esta forma, ya **no será posible crear el anuncio primero y agregar las imágenes posteriormente** . Las peticiones de creación de publicaciones con Listing Type Silver que no contengan el array de imágenes (“pictures”) serán rechazadas.

Recomendamos que **ajusten sus desarrollos**  para incluir el campo “pictures” en el payload de la petición POST /items antes de la fecha límite, para que no tengan las **publicaciones moderadas** .

En la publicación de cada inmueble, el tipo de paquete contratado se identifica mediante el campo **listing_type** .Para publicar inmuebles en MercadoLibre, es fundamental comprender los diferentes tipos de paquetes disponibles y su impacto en la gestión y visibilidad de las publicaciones:

- **1. Paquete de Publicación (listing_type: silver)**

- El paquete de publicación es de carácter obligatorio. Sin este paquete, no es posible crear ningún anuncio en la plataforma, ya que habilita el cupo necesario para publicar. Cada vez que creas una publicación, se descuenta un cupo de este paquete; esto garantiza que tu cuenta está habilitada para listar inmuebles.

- **2. Paquete Destacado (listing_typec: gold / gold_premium )**

- El paquete destacado es opcional y se utiliza para aumentar la exposición y prioridad de una publicación frente a otras en los resultados de búsqueda. Los paquetes tipo Oro (gold) y Oro Premium (gold_premium) permiten resaltar tus anuncios, logrando mayor visibilidad y atrayendo a más potenciales compradores. Esto mejora el posicionamiento y visibilidad de un anuncio publicado.

## Cupos y límite de publicaciones

Cada paquete, ya sea de publicación o destacado, incluye una cantidad finita de cupos que determina el número de publicaciones o destaques que puedes realizar. Si agotas los cupos de algún paquete, ya no podrás crear (o destacar) nuevas publicaciones hasta contratar o ampliar tu paquete. Es importante monitorear regularmente la disponibilidad de cupos para evitar interrupciones en tu operativa.

### Consideraciones Adicionales sobre Paquetes:

- **Paquetes Mixtos:**

- Es fundamental consultar el paquete de publicación que posee el usuario para verificar el listing_type de los cupos disponibles para publicar. Es importante aclarar que los paquetes MIXTOS (con cupos Oro, Oro Premium y Plata) no se pueden utilizar para destacar publicaciones.

- **Retraso en la Actualización de la API de Paquetes:**

- Los cupos pueden tardar unos minutos en liberarse. Si el integrador finaliza los ítems y los vuelve a activar rápidamente, o si realiza un downgrade y luego un upgrade en un corto período de tiempo, es posible que los cupos no se liberen a tiempo, lo que podría resultar en la pérdida de cupos.

### Consejos adicionales.

- **Upgrades y downgrades:**  Puedes cambiar el tipo de paquete de una publicación existente. Por ejemplo, puedes “upgradear” de plata a oro para destacar un inmueble, siempre que tengas cupos disponibles.

El campo **listing_type_id**  define tanto el nivel de visibilidad como el consumo del cupo apropiado.

Si superas el límite de cupos disponibles, cualquier operación que intente usar un cupo adicional será rechazada por la API.

## 1. Consulta qué paquetes de publicación están disponibles para contratar:

Recuerda que, al realizar llamadas GET al recurso /classifieds_promotion_packs, podrás consultar los paquetes disponibles para una categoría principal específica con la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/classifieds_promotion_packs
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Autenticación](https://developers.mercadolibre.com.ar/es_ar/obtencion-del-access-token) |
| CATEGORY_ID | string | No | Corresponde al valor de la categoría principal. Para más información consulta el punto 1 de la documentación de la [Categorías](https://developers.mercadolibre.com.ar/es_ar/categorias-inmuebles) |

### Estructura de Respuesta Esperada:

Para este ejemplo vamos a consultar los paquetes disponibles para la categoría de inmuebles de Chile, así que en el curl anterior vamos a reemplazar **$CATEGORY_ID**  por **MCL1459** .El resultado esperado es un arreglo de paquetes de publicación con la siguiente estructura:

```
[
    {
        "id": "IP10000P30",
        "category_id": "MLC1459",
        "brand": "PORTALINMOBILIARIO",
        "description": "10000 Publicaciones Plata",
        "price": 345.1,
        "package_type": "rotary",
        "package_content": "publications",
        "duration": 30,
        "status": "active",
        "charge_type_id": "CREM",
        "max_upgrades": null,
        "quota_type": "reusable",
        "listing_details": [
            {
                "listing_type_id": "silver",
                "available_listings": 10000
            }
        ],
        "visibility": "public"
    }
]
```

| Atributo | Tipo | Descripción |
| --- | --- | --- |
| id | string | Id único del paquete por categoría. |
| category_id | string | Id de la categoría consultada. |
| brand | string | Portal correspondiente a la categoría. |
| description | string | Descripción del paquete consultado, por lo regular muestra la cantidad de publicaciones o si este es ilimitado. |
| price | float | Precio del paquete consultado. |
| package_type | string | Presenta 2 opciones:  - **unlimited** : para publicaciones ilimitadas.  - **rotary** : para publicaciones con cierta cantidad que se puede renovar una vez se venza o se consuma. |
| package_content | string | Tipo de paquete:  - **publications** : paquetes de publicación.  - **upgrades** : paquetes destacados.  - **developments** : paquetes de emprendimientos inmobiliarios.  - **ALL** : devuelve todos los paquetes disponibles. |
| duration | integer | Duración o vigencia en días del paquete consultado. |
| status | string | Estado del paquete consultado. |
| charge_type_id | string | Corresponde al tipo de cargo del paquete. |
| max_upgrades | integer | Cantidad máxima de upgrades que puedes realizar a la publicación. |
| quota_type | string | Cuota asignada a cada paquete, que indica que puede ser usado varias veces o recargarse. |
| listing_type_id | string | Tipo de paquete:  - **silver** : Paquete de publicación.  - **gold** : Paquete básico de destaque.  - **gold_premium** : Paquete premium de destaque. |
| available_listings | integer | Cantidad disponibles de publicaciones o destaques por paquete. |
| visibility | string | Visibilidad del paquete. |

## 2. Contrata paquetes de publicación

Para contratar los paquetes de publicación que se ajusten a tus necesidades, como primer paso deberás solicitar que se active tu usuario mediante el [formulario de contactar a soporte](https://docs.google.com/forms/d/e/1FAIpQLSeuq9lWo7ax0var28sVSEC8J-Rd-yqCUtYXEa-vozx3k2krbA/viewform), seleccionando la opción de activación de usuario. Una vez se te notifique que tu usuario se encuentra activo, sigue los pasos definidos en la [guía de contratación de paquetes de publicación y destaques.](https://developers.mercadolibre.com.ar/es_ar/contratacion-de-paquetes-de-publicacion)

## 3. Consulta que paquetes tienes contratados por usuario

Esta consulta es fundamental para determinar qué paquetes tiene contratados un cliente y la cantidad de anuncios disponibles en cada uno.

Llamada:

```
 -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/classifieds_promotion_packs?package_content=$PACKAGE_CONTENT&status=$STATUS
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Autenticación](https://developers.mercadolibre.com.ar/es_ar/obtencion-del-access-token) |
| USER_ID | string | No | Utiliza el campo “id” de la respuesta que se menciona en la guía de [consulta de usuarios](https://developers.mercadolibre.com.uy/es_ar/producto-consulta-usuarios). |
| PACKAGE_CONTENT | string | Sí | **publications:**  paquetes de publicación. **upgrades:**  paquetes destacados. **developments:**  paquetes de emprendimientos inmobiliarios. **ALL:**  devuelve todos los paquetes disponibles. |
| STATUS | string | Sí | **active:**  Paquetes activos para el usuario consultado. **paused:**  Paquetes pausados para el usuario consultado. **pending:**  El paquete aún no está activo. **finished:**  Paquete expirado. |

Estructura de respuesta esperada:

```
[
    {
     "id": 754985,
     "user_id": "123456789",

https://developers.mercadolibre.com.uy/es_ar/producto-consulta-usuarios

     "promotion_pack_id": "MPAB",
     "category_id": "MLC1743",
     "description": "Paquete 15 Básico",
     "package_type": "rotary",
     "package_content": "publications",
     "status": "active",
     "date_created": "2013-05-23T15:34:48.498-04:00",
     "date_start": "2013-05-23T15:34:47.544-04:00",
     "date_expires": "2013-06-22T15:34:47.544-04:00",
     "date_stopped": null,
     "last_updated": "2013-05-23T15:35:48.211-04:00",
     "engagement_type": "none",
     "charge_id": 822129921,
     "remaining_listings": 15,
     "used_listings": 0,
     "listing_details": [
        {
           "listing_type_id": "silver",
           "available_listings": 15,
           "used_listings": 0,
           "remaining_listings": 15
        }
     ]
    }
]
```

| Atributos | Tipo | Descripción |
| --- | --- | --- |
| id | string | Identificador exclusivo del paquete. |
| user_id | string | ID único del usuario que contrató el paquete. |
| promotion_pack_id | string | ID único del paquete contratado. |
| category_id | string | Categoría del paquete. |
| description | string | Nombre del paquete. |
| package_type | string | Detalles del paquete. |
| package_content | string | **publications:**  paquetes de publicación. **upgrades:**  paquetes destacados. **developments:**  paquetes de emprendimientos inmobiliarios. **ALL:**  devuelve todos los paquetes disponibles. |
| status | string | Los valores posibles del estado del paquete son:  **active:**  el usuario puede utilizar este paquete para publicar. Se descontará una available_listing cuando lo haga. **pending:**  el paquete aún no está activo. **finalized:**  paquete expirado. |
| date_created | date | Fecha de creación del paquete. |
| date_start | date | Fecha de activación del paquete. |
| date_expires | date | Fecha de expiración del paquete en que expiran los ítems publicados con ese paquete. |
| date_stopped | date | Fecha de finalización del paquete. |
| last_updated | date | Última actualización del paquete. |
| engagement_type | string | Los valores posibles son:  **ninguno (none):**  El paquete se contrató por única vez. **recontratación (re-engagement):**  Cuando el paquete expira, se contratará nuevamente de forma automática un package_type similar. |
| charge_id | string | ID único del cargo generado durante la contratación del paquete. |
| remaining_listings | integer | Publicaciones restantes disponibles. |
| used_listings | integer | Publicaciones ya utilizadas. |
| listing_details | string | Información detallada sobre tipos y disponibilidad de publicaciones. |
| listing_type_id | string | listing_type asociado con el paquete. |
| available_listings | integer | Cantidad de publicaciones que el usuario obtiene con el paquete. |
| used_listings | integer | Publicaciones ya utilizadas. |
| remaining_listings | integer | Publicaciones restantes disponibles. |

## 3.1 Consulta que paquetes tienes contratados por usuario y tipo de paquete

Puedes consultar si un usuario tiene contratado un tipo de paquete (listing_type) específico por medio del siguiente curl:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/classifieds_promotion_packs/$LISTING_TYPE?categoryId=$CATEGORY_ID
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Autenticación](https://developers.mercadolibre.com.ar/es_ar/obtencion-del-access-token) |
| USER_ID | string | No | Utiliza el campo “id” de la respuesta que se menciona en la guía de [consulta de usuarios](https://developers.mercadolibre.com.ar/es_ar/inmuebles-consulta-usuarios). |
| LISTING_TYPE | string | Si | **silver:**  Paquete de publicación **gold:**  Paquete destacado **gold_premium:**  Paquete destacado premium |
| CATEGORY_ID | string | Si | Corresponde al valor de la categoría principal. Para más información consulta el punto 1 de la documentación de la [Categorías](https://developers.mercadolibre.com.ar/es_ar/categorias-inmuebles). |

Nota:

La estructura de respuesta esperada es similar a la que se indica en el punto 3 de esta documentación.

### Siguientes Pasos

- [Publica inmuebles.](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble)

- [Publicaciones de tiendas oficiales](https://developers.mercadolibre.com.ar/es_ar/publicaciones-de-tiendas-oficiales-para-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 05/11/2025 | 1.0 | Publicación Inicial |
