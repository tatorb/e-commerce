<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publicaciones-requeridas-en-catalogo -->
<!-- Sección: Guía para productos > Catálogo -->

# Publicaciones requeridas

Última actualización 30/12/2025

## Publicaciones requeridas

Una publicación de marketplace es requerida para catálogo si es elegible con el tag **catalog_listing_eligible**  y adicionalmente el producto de catálogo al cual la vas a asociar cuenta con el campo **listing_strategy** : catalog_required, en este caso Mercado Libre podrá moderar la publicación solicitando que publique en catálogo mediante el optin.
 Algunos dominios únicamente se permite publicar productos a través de catálogo, quiere decir que, si la publicación de marketplace ya tiene su correspondiente producto de catálogo asociado, la publicación original de marketplace será inactivada por Mercado Libre. Actualmente, la mayoría de dominios son de publicación obligatoria en catálogo.

## Reconocer dominios previamente (DUMP)

Obtén el listado de los dominios obligatorios (catalog_required) y/o exclusivos (catalog_only) de catálogo por país (site_id) previo a la publicación u opti-in.

Nota:

Si publicas sin considerar los siguientes dump, [las publicaciones serán moderadas](https://developers.mercadolibre.com.ar/es_ar/gestionar-moderaciones) por opt_obey (dominios obligatorios) o catalog_only_restricted (dominios exclusivos).

**Dominios obligatorios** : dominios de venta obligatoria en catálogo cuando hay una coincidencia. El vendedor deberá publicar en catálogo y podrá tener una publicación tradicional como opcional.

Ejemplo:

```
curl -X GET http://api.mercadolibre.com/catalog/dumps/domains/MLB/catalog_required
```

Respuesta:

```
{
    "generation_date": "2024-02-19T19:03:57Z",
    "domains": [
        {
            "id": "MLB-CODING_MACHINES",
            "date": "2023-12-14T18:36:28Z"
        },
        {
            "id": "MLB-SURVEILLANCE_VIDEO_RECORDERS",
            "date": "2023-06-02T14:36:51Z"
        },
        {
            "id": "MLB-TABLETS",
            "date": "2021-03-18T14:28:46Z"
        },
        {
            "id": "MLB-MANUAL_BROCHETTE_MAKERS",
            "date": "2023-12-14T18:41:31Z"
        },
        {
            "id": "MLB-PEANUTS",
            "date": "2022-06-07T17:26:42Z"
        },
        {
            "id": "MLB-PERCUSSION_WASHERS",
            "date": "2023-11-10T18:52:02Z"
        },
        {
            "id": "MLB-EDIBLE_MARKERS",
            "date": "2023-11-23T17:41:34Z"
        },
      …
    ]
}
```

**Dominios exclusivos** : dominios de venta exclusiva en catálogo cuando hay una coincidencia. El vendedor deberá publicar exclusivamente en catálogo y no podrá tener una publicación tradicional.

Ejemplo:

```
curl -X GET http://api.mercadolibre.com/catalog/dumps/domains/MLB/catalog_only
```

Respuesta:

```
{
    "generation_date": "2024-02-19T18:58:45Z",
    "domains": [
        {
            "id": "MLB-CELLPHONES",
            "date": "2022-07-04T14:30:44Z"
        },
        {
            "id": "MLB-ELECTRIC_SHOWER_HEADS",
            "date": "2022-06-06T14:27:44Z"
        }
    ]
}
```

### Campos de respuesta

**Id** : dominio que se encuentra en catálogo. 
 **Date** : fecha de activación de la obligatoriedad o exclusividad.

## Reconocer productos previamente

Previo a crear nuevos productos en catálogo, debes reconocer si el producto existe y está activo. Para esto, realiza un **GET al recurso /products/search con el filtro status:active**  y revisa mediante el **listing_strategy: catalog_required**  si el producto debe estar publicado en catálogo. En este caso, podrás:

- [Publicar de manera directa en catálogo.](https://developers.mercadolibre.com.ar/es_ar/publicacion-en-catalogo#Publicar-directamente-en-catalogo)

- Realizar una publicación tradicional y [asociarla a una publicación de catálogo](https://developers.mercadolibre.com.ar/es_ar/publicacion-en-catalogo#Publicar-desde-publicacion-existente) (optin).

Llamada para reconocer productos requeridos en catálogo donde puedes usar el q o **product_identifier**  o **parent_product_id**  para hacer la búsqueda exacta:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/products/search?status=active&site_id=$SITE_ID&listing_strategy=catalog_required&q={q}
```

Ejemplo de llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/products/search?status=active&site_id=MLA&skip_cache=true&listing_strategy=catalog_required&q=Huawei Y6p 64 GB black
```

Ejemplo de respuesta acortada para un producto requerido en catálogo:

```
{
    "keywords": "Huawei Y6p 64 GB black",
    "paging": {
        "total": 1,
        "limit": 10,
        "offset": 0
    },
    "results": [
        {
            "id": "MLA15996644",
            "status": "active",
            "domain_id": "MLA-CELLPHONES",
            "settings": {
                "listing_strategy": "catalog_required"
            },
            "name": "Huawei Y6p 64 GB  midnight black 3 GB RAM",
            "main_features": [],
            "attributes": [ ...
            ],
            "pictures": [
                ...
            ],
            "parent_id": "MLA15996641",
            "children_ids": []
        }
    ]
}
```

Para nuevos dominios donde las publicaciones a catálogo sean requeridas, desde Mercado Libre implementamos una forma de que puedas reconocer el listado de todas las publicaciones de marketplace que deben publicarse en catálogo antes de ser moderadas y evitar fricciones con el vendedor.
 Para identificarlas debes hacer uso del recurso GET items/search filtrando por el tag **catalog_forewarning**  una vez identificadas, te recomendamos asociar cada publicación a un producto de catálogo (hacer optin) y evitar penalizaciones.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/items/search?tags=catalog_forewarning
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/123456/items/search?tags=catalog_forewarning
```

Respuesta acortada:

```
{
    "seller_id": "123456",
    "query": null,
    "paging": {
        "limit": 50,
        "offset": 0,
        "total": 15
    },
    "results": [
        "MLA887478882",
        "MLA830583442",
        "MLA830570458",
        "MLA835548382",
        "MLA835731852",
        "MLA837273858",
        "MLA833333835",
        "MLA833333341",
        "MLA700204505",
        "MLA703848375",
        "MLA703848388",
        "MLA708343730",
        "MLA703234381",
        "MLA712487522",
        "MLA712883748"
    ],
    "orders": [
      ...
    ],
    "available_orders": [...]
}
```

Estas publicaciones de marketplace tendrán asociadas una fecha límite para ser asociadas a un producto de catálogo, luego de esta fecha, si el seller no hizo el optin (crear la publicación de catálogo), se ejecuta un proceso que va a remover el tag de **catalog_forewarning**  y modera la publicación de marketplace bajo el filtro de **OP_OBEY** , puedes consultar esta fecha límite realizando una consulta al recurso **/catalog_forewarning/date** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/catalog_forewarning/date
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA830570458/catalog_forewarning/date
```

Respuesta de publicación con fecha asignada:

```
{
   "status":"date_defined",
   "moderation_date":"2020-08-20T13:00:00Z"
}
```

Respuesta de publicación que no tiene el tag de **catalog_forewarning** :

```
{
   "status":"date_not_defined",
   "moderation_date": null
}
```

Respuesta de publicación con una fecha que ya expiró:

```
{
   "status":"date_expired",
   "moderation_date":"2020-06-10T13:00:00Z"
}
```

## Dominios de venta exclusiva en catálogo

Nota:

Esta funcionalidad no está disponible en MPE o MEC.

Algunos dominios son de venta exclusiva para catálogo, es decir, únicamente se puede publicar y vender a través de páginas de producto de catálogo y no de publicaciones del marketplace, por este motivo, al momento de hacer optin de una publicación de marketplace completa (todas las variaciones de la publicación tienen su correspondiente asociación a un producto de catálogo)), la publicación de marketplace se modera con **status: under_review**  y solo podrás venderlo y gestionando a través de catálogo.
 Para una publicación de marketplace creada en algún dominio de venta exclusiva para catálogo, vas a poder reconocer que se moderó por medio del tag: **catalog_only_restricted** .

```
"status": "under_review",
   "sub_status": [
       "forbidden"
   ],
   "tags": [
       "catalog_only_restricted",
       "poor_quality_picture",
       "test_item",
       "immediate_payment",
       "cart_eligible"
   ],
```

Para considerar:

- Las publicaciones de marketplace que tienen múltiples variaciones solo se inactivan después del optin completo de todas las variaciones en catálogo. De lo contrario, permanecerá activo.

- El flujo de dominios de venta exclusiva estará disponible únicamente nuevas publicaciones y al hacer optin, las publicaciones de marketplace que ya se encuentren dentro de estos dominios por ahora no serán afectados.

## Moderaciones

Nota:

- Esta funcionalidad no está disponible para MPE ni para MEC, ya que las publicaciones no se están moderando. 
 - Para otros países, está disponible para los canales de marketplace.

A continuación, puedes reconocer si una publicación fue moderada (pausada) por no asociarla a tiempo a un producto de catálogo, validando su **reason**  (causa) y **remedy**  (accionable). Recuerda que, **cualquier cambio o modificación que altere la calidad de la publicación, podrá generar su moderación** .

Llamada:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/infractions/$USER_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/infractions/1234567
```

Respuesta para una publicación de marketplace moderada que no pertenece a un dominio de venta exclusiva en catálogo:

```
{
   "infractions": [
       {
           "id": "594794188",
           "date_created": "2020-10-28T01:43:32.414-0400",
           "user_id": "1234567",
           "related_item_id": "MLA1692147078",
           "element_id": "MLA1692147078",
           "element_type": "ITM",
           "site_id": "MLA",
           "reason": "La pausamos porque no ofreces el producto también en catálogo.",
           "remedy": "Publica tu producto en catálogo para seguir vendiéndolo. Cuando lo hagas, tu publicación original se reactivará automáticamente."
       }
   ],
   "paging": {
       "offset": 0,
       "limit": 2,
       "total": 20671
   },
   "sorting_type": "date_created_desc"
}
```

Para reactivar tu publicación deberás asociar la publicación a catálogo (hacer optin) o marcar la publicación/variación para mencionar que no se encontró un producto para asociarla. 
 Respuesta para una **publicación de marketplace moderada que pertenece a un dominio de venta exclusiva** , este producto no se podrá reactivar nuevamente:

```
{
   "infractions": [
       {
           "id": "943314941",
           "date_created": "2022-05-23T16:52:14.387-0400",
           "user_id": "1005109061",
           "related_item_id": "MLA1138520248",
           "element_id": "MLA1138520248",
           "element_type": "ITM",
           "site_id": "MLA",
           "filter_subgroup": "AP",
           "reason": "La anulamos porque este producto solo puedes venderlo con tu publicación de catálogo.",
           "remedy": "La anulamos porque este producto solo puedes venderlo con tu publicación de catálogo."
       }
   ],
   "paging": {
       "offset": 0,
       "limit": 20,
       "total": 2
   },
   "sorting_type": "date_created_desc"
}
```

## Tag de preaviso para pruebas

Para probar la funcionalidad de preaviso en dominios de catálogo requeridos, es necesario que:

- La publicación de marketplace sea elegible en catálogo, dentro de un producto activo.

- La publicación no puede ser de un producto de catálogo que ya pertenece a un dominio requerido. Caso contrario, al publicarse, el ítem será moderado.

Si cumples estos requisitos, carga los datos en el [formulario para agregar el tag **catalog_forewarning**](https://docs.google.com/forms/d/e/1FAIpQLSdNoAayELrncSJhiCdWj3EgDX9Oiuwj3B-z2I7W3-QeozR5wQ/viewform).

**Siguiente** : [Competencia](https://developers.mercadolibre.com.ar/es_ar/competencia-en-catalogo).
