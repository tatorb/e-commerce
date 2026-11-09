<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/tienda-oficial -->
<!-- Sección: Guía para productos > MercadoLíder y Tiendas Oficiales -->

# Tiendas Oficiales

Última actualización 27/02/2026

## Tiendas Oficiales

Algunos usuarios son parte de las Tiendas Oficiales de Mercado Libre y tienen una o más marcas bajo el mismo usuario. Si quieres formar parte de las Tiendas Oficiales de Mercado Libre, debes comunicarte con un **asesor comercial** . Si ya eres parte de las Tiendas Oficiales, sigue este tutorial para aprender los aspectos básicos de cómo trabajar con este tipo de usuario.

## Acceso a los IDs de sus marcas

Este recurso recupera marcas asociadas a un user_id. Puede haber más de una por usuario. La tienda se identifica con el atributo **official_store_id** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/users/$USER_ID/brands
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/2275117700/brands
```

Respuesta:

```
{
    "status": "LINKED",
    "cust_id": 2275117700,
    "shield_id": null,
    "site_id": "MLA",
    "user_type": "brand",
    "brands": [
        {
            "site_id": "MLA",
            "official_store_id": 294894,
            "name": "Generica",
            "type": "normal",
            "relevance_position": 10000,
            "status_id": 1,
            "status": "active",
            "fantasy_name": "Genérica",
            "date_created": "2026-01-15T16:33:15Z",
            "reputation": null,
            "return_policy": null,
            "landing_permalink": "https://www.mercadolibre.com.ar/tienda/generica",
            "reputation_meli": null,
            "keywords": [],
            "pictures": [
                {
                    "id": 1117276,
                    "name": "high_resolution_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_949195-MLA107749042667_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_949195-MLA107749042667_022026-F.jpg",
                    "size": "1024x747",
                    "picture_id": "949195-MLA107749042667_022026"
                },
                {
                    "id": 1117278,
                    "name": "logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_726135-MLA107749721107_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_726135-MLA107749721107_022026-F.jpg",
                    "size": "160x80",
                    "picture_id": "726135-MLA107749721107_022026"
                },
                {
                    "id": 1117280,
                    "name": "logo_landing",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_737553-MLA107059136516_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_737553-MLA107059136516_022026-F.jpg",
                    "size": "160x80",
                    "picture_id": "737553-MLA107059136516_022026"
                },
                {
                    "id": 888681,
                    "name": "small_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_939151-MLA107749721109_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_939151-MLA107749721109_022026-F.jpg",
                    "size": "96x70",
                    "picture_id": "939151-MLA107749721109_022026"
                },
                {
                    "id": 888683,
                    "name": "big_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_917241-MLA107059166262_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_917241-MLA107059166262_022026-F.jpg",
                    "size": "174x164",
                    "picture_id": "917241-MLA107059166262_022026"
                },
                {
                    "id": 888685,
                    "name": "facebook_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_725533-MLA107749868205_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_725533-MLA107749868205_022026-F.jpg",
                    "size": "200x200",
                    "picture_id": "725533-MLA107749868205_022026"
                },
                {
                    "id": 888687,
                    "name": "dynamic_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_732424-MLA107059373888_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_732424-MLA107059373888_022026-F.jpg",
                    "size": "1024x747",
                    "picture_id": "732424-MLA107059373888_022026"
                },
                {
                    "id": 311582,
                    "name": "component_image",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_712414-MLA106907616380_022026-OO.webp",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_712414-MLA106907616380_022026-OO.webp",
                    "size": null,
                    "picture_id": "712414-MLA106907616380_022026"
                },
                {
                    "id": 1296250,
                    "name": "background",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_890834-MLA107750130589_022026-OO.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_890834-MLA107750130589_022026-OO.jpg",
                    "size": "1200x189",
                    "picture_id": "890834-MLA107750130589_022026"
                }
            ],
            "tags": [
                "test_store",
                "STANDARD"
            ],
            "categories_ids": [
                "MLA1367"
            ],
            "main_categories": [
                {
                    "id": "MLA1367"
                }
            ],
            "permalink": "https://tienda.mercadolibre.com.ar/generica",
            "normalized_name": "generica",
            "last_updated": "2026-02-26T21:50:18Z",
            "brand_registry": {
                "brand_id": 276243,
                "brand_registry_id": 65798,
                "brand_name": "Genérica"
            },
            "storefront_id": "511e79c539444d95a2a07e4e3d0dd9cc2275117700"
        },
        {
            "site_id": "MLA",
            "official_store_id": 311582,
            "name": "Test Edwin",
            "type": "normal",
            "relevance_position": 10000,
            "status_id": 3,
            "status": "offline",
            "fantasy_name": "Test Edwin",
            "date_created": "2026-02-06T16:45:18Z",
            "reputation": null,
            "return_policy": null,
            "landing_permalink": null,
            "reputation_meli": null,
            "keywords": [],
            "pictures": [
                {
                    "id": 957469,
                    "name": "high_resolution_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_879758-MLA106748379013_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_879758-MLA106748379013_022026-F.jpg",
                    "size": "1024x747",
                    "picture_id": "879758-MLA106748379013_022026"
                },
                {
                    "id": 957471,
                    "name": "logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_613478-MLA106748648991_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_613478-MLA106748648991_022026-F.jpg",
                    "size": "160x80",
                    "picture_id": "613478-MLA106748648991_022026"
                },
                {
                    "id": 957473,
                    "name": "logo_landing",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_856855-MLA106748678917_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_856855-MLA106748678917_022026-F.jpg",
                    "size": "160x80",
                    "picture_id": "856855-MLA106748678917_022026"
                },
                {
                    "id": 957475,
                    "name": "small_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_723477-MLA106748113503_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_723477-MLA106748113503_022026-F.jpg",
                    "size": "96x70",
                    "picture_id": "723477-MLA106748113503_022026"
                },
                {
                    "id": 957477,
                    "name": "big_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_607356-MLA106748499017_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_607356-MLA106748499017_022026-F.jpg",
                    "size": "174x164",
                    "picture_id": "607356-MLA106748499017_022026"
                },
                {
                    "id": 957479,
                    "name": "facebook_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_881677-MLA106126554480_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_881677-MLA106126554480_022026-F.jpg",
                    "size": "200x200",
                    "picture_id": "881677-MLA106126554480_022026"
                },
                {
                    "id": 1201282,
                    "name": "dynamic_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_863456-MLA106748708881_022026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_863456-MLA106748708881_022026-F.jpg",
                    "size": "1024x747",
                    "picture_id": "863456-MLA106748708881_022026"
                }
            ],
            "tags": [
                "test_store"
            ],
            "categories_ids": [
                "MLA1403"
            ],
            "main_categories": [
                {
                    "id": "MLA1403"
                }
            ],
            "permalink": "https://listado.mercadolibre.com.ar/_OfficialStoreId_311582",
            "normalized_name": "test edwin",
            "last_updated": "2026-02-06T16:45:18Z",
            "brand_registry": {
                "brand_id": 0,
                "brand_registry_id": 92379,
                "brand_name": "Test Edwin"
            },
            "storefront_id": null
        },
        {
            "site_id": "MLA",
            "official_store_id": 143304,
            "name": "test multitienda mla cupones",
            "type": "normal",
            "relevance_position": 10000,
            "status_id": 1,
            "status": "active",
            "fantasy_name": "test multitienda mla cupones",
            "date_created": "2025-02-18T19:41:18Z",
            "reputation": null,
            "return_policy": null,
            "landing_permalink": "https://www.mercadolibre.com.ar/tienda/test-multitienda-mla-cupones",
            "reputation_meli": null,
            "keywords": [],
            "pictures": [
                {
                    "id": 409700,
                    "name": "high_resolution_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_849337-MLA104009616779_012026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_849337-MLA104009616779_012026-F.jpg",
                    "size": "1024x747",
                    "picture_id": "849337-MLA104009616779_012026"
                },
                {
                    "id": 342961,
                    "name": "logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_894154-MLA104009292219_012026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_894154-MLA104009292219_012026-F.jpg",
                    "size": "160x80",
                    "picture_id": "894154-MLA104009292219_012026"
                },
                {
                    "id": 342963,
                    "name": "logo_landing",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_916798-MLA104009352385_012026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_916798-MLA104009352385_012026-F.jpg",
                    "size": "160x80",
                    "picture_id": "916798-MLA104009352385_012026"
                },
                {
                    "id": 342965,
                    "name": "small_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_661514-MLA104009173803_012026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_661514-MLA104009173803_012026-F.jpg",
                    "size": "96x70",
                    "picture_id": "661514-MLA104009173803_012026"
                },
                {
                    "id": 342967,
                    "name": "big_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_833896-MLA104009292221_012026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_833896-MLA104009292221_012026-F.jpg",
                    "size": "174x164",
                    "picture_id": "833896-MLA104009292221_012026"
                },
                {
                    "id": 342969,
                    "name": "facebook_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_989810-MLA104010237741_012026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_989810-MLA104010237741_012026-F.jpg",
                    "size": "200x200",
                    "picture_id": "989810-MLA104010237741_012026"
                },
                {
                    "id": 342971,
                    "name": "dynamic_logo",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_604853-MLA104009587141_012026-F.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_604853-MLA104009587141_012026-F.jpg",
                    "size": "1024x747",
                    "picture_id": "604853-MLA104009587141_012026"
                },
                {
                    "id": 409540,
                    "name": "background",
                    "secure_url": "https://http2.mlstatic.com/D_NQ_NP_942104-MLA106075597073_012026-OO.jpg",
                    "url": "https://http2.mlstatic.com/D_NQ_NP_942104-MLA106075597073_012026-OO.jpg",
                    "size": "1200x63",
                    "picture_id": "942104-MLA106075597073_012026"
                }
            ],
            "tags": [
                "test_store",
                "STANDARD"
            ],
            "categories_ids": [
                "MLA1403"
            ],
            "main_categories": [
                {
                    "id": "MLA1403"
                }
            ],
            "permalink": "https://tienda.mercadolibre.com.ar/test-multitienda-mla-cupones",
            "normalized_name": "test multitienda mla cupones",
            "last_updated": "2026-02-27T21:05:04Z",
            "brand_registry": {
                "brand_id": 0,
                "brand_registry_id": 37435,
                "brand_name": "test multitienda mla cupones"
            },
            "storefront_id": "dd53547f81fa4e24966839dcda1414432275117700"
        }
    ],
    "tags": [
        "eshop",
        "user_product_seller",
        "large_seller",
        "test_user",
        "brand"
    ],
    "seller_type": "owner"
}
```

### Campos de respuesta

- **status** : tendrá el estado del usuario con respecto a la tienda

- **normalized_name** : tendrá el nombre de la tienda normalizado (sin tildes, dobles espacios, diéresis, etc.)

- **last_updated** : fecha en la que se actualizó la tienda por la última vez.

Error que puede pasar en el recurso anterior:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/14775362261111111/brands
```

```
{
   "error": "U00002",
   "message": "U00002 - The user '14775362261111111' was not found",
   "status": 404
}
```

## Accede a toda la información sobre una marca específica

Para obtener información sobre una marca específica, puedes realizar la llamada al **brand_id**  que deseas conocer, tal como ves.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/brands/$BRAND
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/users/2275117700/brands/294894
```

Respuesta:

```
{
    "site_id": "MLA",
    "official_store_id": 294894,
    "name": "Generica",
    "type": "normal",
    "relevance_position": 10000,
    "status_id": 1,
    "status": "active",
    "fantasy_name": "Genérica",
    "date_created": "2026-01-15T16:33:15Z",
    "reputation": null,
    "return_policy": null,
    "landing_permalink": "https://www.mercadolibre.com.ar/tienda/generica",
    "reputation_meli": null,
    "users": [
        {
            "status": "LINKED",
            "cust_id": 2275117700,
            "shield_id": null,
            "site_id": "MLA",
            "user_type": "brand",
            "tags": [
                "eshop",
                "user_product_seller",
                "large_seller",
                "test_user",
                "brand"
            ],
            "seller_type": "owner"
        }
    ],
    "keywords": [],
    "pictures": [
        {
            "id": 1117276,
            "name": "high_resolution_logo",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_949195-MLA107749042667_022026-F.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_949195-MLA107749042667_022026-F.jpg",
            "size": "1024x747",
            "picture_id": "949195-MLA107749042667_022026"
        },
        {
            "id": 1117278,
            "name": "logo",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_726135-MLA107749721107_022026-F.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_726135-MLA107749721107_022026-F.jpg",
            "size": "160x80",
            "picture_id": "726135-MLA107749721107_022026"
        },
        {
            "id": 1117280,
            "name": "logo_landing",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_737553-MLA107059136516_022026-F.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_737553-MLA107059136516_022026-F.jpg",
            "size": "160x80",
            "picture_id": "737553-MLA107059136516_022026"
        },
        {
            "id": 888681,
            "name": "small_logo",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_939151-MLA107749721109_022026-F.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_939151-MLA107749721109_022026-F.jpg",
            "size": "96x70",
            "picture_id": "939151-MLA107749721109_022026"
        },
        {
            "id": 888683,
            "name": "big_logo",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_917241-MLA107059166262_022026-F.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_917241-MLA107059166262_022026-F.jpg",
            "size": "174x164",
            "picture_id": "917241-MLA107059166262_022026"
        },
        {
            "id": 888685,
            "name": "facebook_logo",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_725533-MLA107749868205_022026-F.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_725533-MLA107749868205_022026-F.jpg",
            "size": "200x200",
            "picture_id": "725533-MLA107749868205_022026"
        },
        {
            "id": 888687,
            "name": "dynamic_logo",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_732424-MLA107059373888_022026-F.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_732424-MLA107059373888_022026-F.jpg",
            "size": "1024x747",
            "picture_id": "732424-MLA107059373888_022026"
        },
        {
            "id": 311582,
            "name": "component_image",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_712414-MLA106907616380_022026-OO.webp",
            "url": "https://http2.mlstatic.com/D_NQ_NP_712414-MLA106907616380_022026-OO.webp",
            "size": null,
            "picture_id": "712414-MLA106907616380_022026"
        },
        {
            "id": 1296250,
            "name": "background",
            "secure_url": "https://http2.mlstatic.com/D_NQ_NP_890834-MLA107750130589_022026-OO.jpg",
            "url": "https://http2.mlstatic.com/D_NQ_NP_890834-MLA107750130589_022026-OO.jpg",
            "size": "1200x189",
            "picture_id": "890834-MLA107750130589_022026"
        }
    ],
    "tags": [
        "test_store",
        "STANDARD"
    ],
    "categories_ids": [
        "MLA1367"
    ],
    "main_categories": [
        {
            "id": "MLA1367"
        }
    ],
    "permalink": "https://tienda.mercadolibre.com.ar/generica",
    "normalized_name": "generica",
    "last_updated": "2026-02-26T21:50:18Z",
    "brand_registry": {
        "brand_id": 276243,
        "brand_registry_id": 65798,
        "brand_name": "Genérica"
    },
    "storefront_id": "511e79c539444d95a2a07e4e3d0dd9cc2275117700"
}
```

Errores que pueden presentarse en el recurso anterior:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/1477536226/brands/aaaaa
```

Respuesta:

```
{
  "error": "invalid_parameter",
  "message": "The officialStoreId must contain only digits.",
  "status": 400
}
```

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/1477536226/brands/14501111111
```

Respuesta:

```
{
   "error": "B00001",
   "message": "B00001 - The brand '14501111111' was not found for site 'MLA'",
   "status": 404
}
```

## Errores comunes en la respuesta de la API al publicar en Tiendas Oficiales multimarca

Si no envías el official_store_id del artículo para una Tienda Oficial multimarca, como respuesta recibirás los posibles ID que podrías enviar con tu usuario:

```
"message": "Validation error",
   "error": "validation_error",
   "status": 400,
   "cause": [{
   	"code": "item.official_store_id.invalid",
   	"message": "Users type brand have to provide one of this [60, 274, 257] official store id"
```

Si envías un official_store_id inválido para una Tienda Oficial multimarca recibirás:

```
{
   "message": "body.invalid_official_store_id",
   "error": "The seller 148829068 is not allowed to use official_store_id 315 on site MLA.",
   "status": 403,
   "cause": []
}
```

¡Excelente! Ya conoces los brand_id asociados a tu usuario, los cuales deberás enviar cada vez que desees publicar un item.
