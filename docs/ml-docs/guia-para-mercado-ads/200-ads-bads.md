<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/ads-bads -->
<!-- Sección: Guía para Mercado Ads -->

# Brand Ads

Última actualización 09/06/2026

## Brand Ads

Importante:

**Migración de Brand Ads a PAds**

A partir del **17 de junio de 2026** , las campañas de Brand Ads de un conjunto de sellers serán migradas automáticamente a PAds. Los sellers afectados serán notificados directamente.
 **Impacto en la API:** 
 -Los advertisers migrados dejarán de aparecer en consultas con **product_id=BADS.** 
 -Los endpoints de métricas y campañas devolverán **204 - No content**  para esos advertisers a partir de la fecha de migración.
 -Las métricas históricas estarán disponibles durante **30 días adicionales**  desde la fecha de migración.

Esta funcionalidad tiene el objetivo de mejorar la capacidad de los anunciantes para comprender y optimizar el rendimiento de sus campañas publicitarias. Puedes acceder a información relevante y actualizada de manera automatizada, permitiendo a los anunciantes integrar eficientemente los datos para análisis y comparación. 
 
 **Posicionamiento** 
Para que un anuncio de Brand Ads se muestre en la posición 0 de los resultados de búsqueda, el significado de las palabras clave configuradas deben coincidir con la búsqueda que realizó un usuario. Para determinar qué anuncio se muestra, **Brand Ads utiliza un sistema de pujas donde cada anunciante establece** :

- la palabra clave que quiere vincular con su anuncio

- el CPC máximo que está dispuesto a pagar

El algoritmo de Brand Ads evalúa los anuncios que compiten por un mismo espacio (es decir, que comparten palabras clave) en base a una serie de criterios y les asigna un puntaje, llamado **Ad-Score** , que mide la probabilidad de convertir del anuncio. Este puntaje luego se tiene en cuenta junto con el CPC máximo para elaborar un ranking (**Ad Rank** ) que establece el ganador de la subasta.

IMPORTANTE Está disponible para todas las marcas y vendedores que cuenten con una Tienda Oficial o Mi Pagina en Mercado Libre, que tengan reputación verde o superior y que tengan un mínimo de 3 publicaciones.
 -En Marketplace está disponible en MLA, MLB, MLM, MLC, MCO, MLU, MPE.
 -En VIS-Motors (vehículos) está disponible en MLA, MLB, MLM y MCO.

### Flujo técnico recomendado

1. Consulta anunciante (advertiser id)

2. Consulta las campañas, anuncios y keywords

3. Consulta métricas de advertiser, campañas y keywords

## Consultar anunciante

Los anunciantes (advertiser_id) son quienes invierten un presupuesto para la creación y distribución de anuncios publicitarios, con el objetivo de promocionar sus productos o servicios. Consulta el listado de anunciantes que tiene acceso a un usuario, según el tipo de producto que se requiera.

**Parámetros obligatorios**

**product_id** : tipo de producto. Valores disponibles: PADS (Product Ads), DISPLAY, BADS (Brand Ads).

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -H 'Api-Version: 1'
https://api.mercadolibre.com/advertising/advertisers?product_id=$PRODUCT_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -H 'Api-Version: 1'
https://api.mercadolibre.com/advertising/advertisers?product_id=BADS
```

Respuesta:

```
{
    "advertisers": [
        {
            "advertiser_id": 000,
            "site_id": "MLB",
            "advertiser_name": "Advertiser AAA",
            "account_name": "MLB - XZY"
        },
        {
            "advertiser_id": 111,
            "site_id": "MLM",
            "advertiser_name": "Advertiser BBB",
            "account_name": "MLM - XYZ"
        },
        {
            "advertiser_id": 222,
            "site_id": "MLA",
            "advertiser_name": "Advertiser CCC",
            "account_name": "MLA - XYZ"
        },
        {
            "advertiser_id": 333,
            "site_id": "MLC",
            "advertiser_name": "Advertiser DDD",
            "account_name": "MLC - XYZ"
        }
    ]
}
```

### Campos de respuesta

**advertiser_id** : identificador del anunciante. Lo utilizarás para el resto de solicitudes.
 **site_id** : identificador del país. Consulta la [nomenclatura de los sites de Mercado Libre y sus respectivas monedas](https://api.mercadolibre.com/sites).
 **advertiser_name** : nombre del anunciante.
 **account_name** : nombre de la cuenta.

Nota:

En caso de recibir el error 404 - No permissions found for user_id significa que el usuario no tiene habilitado el Producto. El usuario deberá acceder a Mercado Libre > Mi perfil > Publicidad.

## Tipos de campañas

Antes de consultar campañas, te recomendamos conocer los tipos de campañas. Además, puedes acceder a métricas de campañas a partir del 2023-02-09.

- **Automatic** : las campañas automáticas son administradas por Mercado Ads. Se ejecutará automáticamente la campaña para todos los items asociados al official_store_id del destination_id enviado y creará keywords, que no podrán ser editadas ni eliminadas, es decir, Mercado Ads administrará el inventario del advertiser y asignará las mejores keywords para sus anuncios.

- **Custom** : las campañas personalizadas son creadas y administradas por el usuario, donde el anunciante (advertiser) debe proveer un listado de ítems (mínimo 3, máximo 10) con los cuales configurar su anuncio y las keywords (mínimo 1, máximo 200) que son palabras clave para búsquedas en que quiere imprimirse. Luego podrá editar y eliminar estas keywords.

Nota:

Para **consultar los items y keywords de una campaña automática**  debes utilizar los **endpoints de métricas** . De lo contrario, recibirás un http 200 vacío.

## Buscar campañas

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns
```

Respuesta:

```
{
  "paging": {
    "total": 50,
    "offset": 0,
    "limit": 2
  },
  "campaigns": [
    {
      "campaign_id": 1,
      "name": "campaign meli 1",
      "start_date": "2024-01-01T00:06:22.000Z",
      "end_date": "2024-01-01T00:06:22.000Z",
      "advertiser_id": 1234,
      "campaign_type": "custom",
      "status": "active",
      "site_id": "MLA",
      "official_store_id": 12345,
      "destination_id": 12345,
      "headline": "esto es un headline",
      "budget": {
        "amount": 1111111.32,
        "currency": "ARS"
      },
      "cpc": 100.5,
      "items": [
        {
          "campaign_id": 1,
          "status": "active",
          "item_id": "MLA1178375484"
        }
      ],
      "keywords": [
        {
          "campaign_id": 1,
          "type": "custom",
          "term": "auto",
          "match_type": "phrase",
          "is_negative": false,
          "cpc": 50.5
        }
      ]
    }
  ]
}
```

### Campos de respuesta

**campaign_id** : Id que identifica a la campaña en el sistema.
 **name** : nombre de la campaña.
 **start_date** : fecha de inicio de la campaña en formato ISO-8601 con time-zone.
 **end_date** : fecha de fin de la campaña.
 **advertiser_id** : advertiser al que pertenece la campaña.
 **campaign_type** : tipo de campaña: “custom” o “automatic”.
 **status** : status de la campaña, los status posibles son “active”, “paused”, “disabled”.
 **site_id** : país al que pertenece la campaña.
 **official_store_id** : identificador de la Tienda Oficial sobre la que se creó la campaña.
 **destination_id** : destination id asociado a la Tienda Oficial de la campaña.
 **headline** : título/bajada a mostrar en el espacio publicitario de brand ads.
 **budget** : array con información presupuestaria.

- **amount** : budget diario de la campaña.

- **currency** : moneda en la que se encuentra el budget. Para más información, consulta [/currencies](https://api.mercadolibre.com/currencies/).

**cpc** : costo por click máximo de la campaña.
 **items** : listado de ítems que formarán parte de la campaña. Aplica solo a campañas tipo custom (mínimo 3 items y máximo 10). Los ítems deben pertenecer a la tienda oficial asociada al destination provisto en el campo de destination_id.
 **keywords** : array con información de las keywords.

- **campaign_id** : identificador de la campaña a la que está asociada la keyword.

- **type** : tipo de keyword “custom”. Próximamente, podrán ser también tipo “suggested”.

- **term** : el término de la keyword.

- **match_type** : el tipo de matcheo con el cual se utilizará la keyword. Valor posible: “phrase”. Próximamente habilitaremos valores “exact”y “broad”.

- **is_negative** : indica si la keyword es negativa, es decir la campaña no se imprime con la keyword. Próximamente estará habilitada, hoy is_negative solo puede ser false.

- **cpc** : costo por click máximo de la keyword.

## Detalle de campaña

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns/$CAMPAIGN_ID
```

Respuesta:

```
{
      "campaign_id": 1,
      "name": "campaign meli 1",
      "start_date": "2024-01-01T00:06:22.000Z",
      "end_date": "2024-01-01T00:06:22.000Z",
      "advertiser_id": 1234,
      "campaign_type": "custom",
      "status": "active",
      "site_id": "MLA",
      "official_store_id": 12345,
      "destination_id": 12345,
      "headline": "esto es un headline",
      "budget": {
        "amount": 1111111.32,
        "currency": "ARS"
      },
      "cpc": 100.5,
      "items": [
        {
          "campaign_id": 1,
          "status": "active",
          "item_id": "MLA1178375484"
        }
      ],
      "keywords": [
        {
          "campaign_id": 1,
          "keyword_id": 1,
          "type": "custom",
          "term": "auto",
          "match_type": "phrase",
          "is_negative": false,
          "cpc": 50.5
        }
      ]
    }
```

## Consultar anuncios de una campaña custom

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns/$CAMPAIGN_ID/items
```

Response:

```
[
  {
    "campaign_id": 1,
    "status": "active",
    "item_id": "MLA1178375484"
  }
]
```

## Consultar keywords de campaña custom

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns/$CAMPAIGN_ID/keywords
```

Respuesta:

```
[
  {
    "campaign_id": 1,
    "type": "custom",
    "term": "auto",
    "match_type": "phrase",
    "is_negative": false,
    "cpc": 50.5
  }
]
```

## Consulta de métricas

La consulta de métricas es una funcionalidad esencial para seguir y optimizar el desempeño de tus campañas de Brand Ads. A través de ella, podés obtener datos detallados sobre impresiones, clics, conversiones y costos de tus anuncios, permitiendo un análisis completo del retorno sobre la inversión publicitaria.

## Métricas de la campaña

### Parámetros obligatorios

**date_from** : fecha de inicio de la consulta en formato YYYY-MM-DD.
 **date_to** : fecha de fin de la consulta en formato YYYY-MM-DD.

Nota:

Las métricas que se muestran corresponden **exclusivamente a los últimos 90 días** . Esto significa que **no es posible consultar períodos anteriores a ese intervalo** . Esta regla fue actualizada, ya que no almacenamos métricas anteriores a 90 días.

### Parámetros opcionales

**limit** : por defecto 50.
 **offset** : por defecto 0.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns/metrics?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD&aggregation_type=daily
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/10101010/brand_ads/campaigns/metrics?date_from=2025-04-01&date_to=2025-04-07&aggregation_type=daily
```

Respuesta:

```
{
    "dashboard": {
        "ctr": [
            {
                "x": "2025-04-01",
                "y": 0.02
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 0.01
            },
            {
                "x": "2025-04-04",
                "y": 0.01
            },
            {
                "x": "2025-04-05",
                "y": 0.01
            },
            {
                "x": "2025-04-06",
                "y": 0.01
            },
            {
                "x": "2025-04-07",
                "y": 0.01
            }
        ],
        "campaignId": [
            {
                "x": "2025-04-01",
                "y": 0
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 0
            },
            {
                "x": "2025-04-04",
                "y": 0
            },
            {
                "x": "2025-04-05",
                "y": 0
            },
            {
                "x": "2025-04-06",
                "y": 0
            },
            {
                "x": "2025-04-07",
                "y": 0
            }
        ],
        "acos": [
            {
                "x": "2025-04-01",
                "y": 0.00
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 12.69
            },
            {
                "x": "2025-04-04",
                "y": 1.98
            },
            {
                "x": "2025-04-05",
                "y": 2.99
            },
            {
                "x": "2025-04-06",
                "y": 0.00
            },
            {
                "x": "2025-04-07",
                "y": 17.26
            }
        ],
        "attribution_order_amount": [
            {
                "x": "2025-04-01",
                "y": 0.00
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 789999.00
            },
            {
                "x": "2025-04-04",
                "y": 7597994.00
            },
            {
                "x": "2025-04-05",
                "y": 4977997.00
            },
            {
                "x": "2025-04-06",
                "y": 0.00
            },
            {
                "x": "2025-04-07",
                "y": 869013.00
            }
        ],
        "attribution_order_conversions": [
            {
                "x": "2025-04-01",
                "y": 0
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 1
            },
            {
                "x": "2025-04-04",
                "y": 6
            },
            {
                "x": "2025-04-05",
                "y": 3
            },
            {
                "x": "2025-04-06",
                "y": 0
            },
            {
                "x": "2025-04-07",
                "y": 2
            }
        ],
        "prints": [
            {
                "x": "2025-04-01",
                "y": 4528
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 16275
            },
            {
                "x": "2025-04-04",
                "y": 16975
            },
            {
                "x": "2025-04-05",
                "y": 20429
            },
            {
                "x": "2025-04-06",
                "y": 18822
            },
            {
                "x": "2025-04-07",
                "y": 20696
            }
        ],
        "consumed_budget": [
            {
                "x": "2025-04-01",
                "y": 80047.58
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 100263.18
            },
            {
                "x": "2025-04-04",
                "y": 150378.75
            },
            {
                "x": "2025-04-05",
                "y": 148986.63
            },
            {
                "x": "2025-04-06",
                "y": 149729.73
            },
            {
                "x": "2025-04-07",
                "y": 150006.54
            }
        ],
        "leads": [
            {
                "x": "2025-04-01",
                "y": 0
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 0
            },
            {
                "x": "2025-04-04",
                "y": 0
            },
            {
                "x": "2025-04-05",
                "y": 0
            },
            {
                "x": "2025-04-06",
                "y": 0
            },
            {
                "x": "2025-04-07",
                "y": 0
            }
        ],
        "cost_per_clicks": [
            {
                "x": "2025-04-01",
                "y": 650.79
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 396.30
            },
            {
                "x": "2025-04-04",
                "y": 496.30
            },
            {
                "x": "2025-04-05",
                "y": 480.60
            },
            {
                "x": "2025-04-06",
                "y": 479.90
            },
            {
                "x": "2025-04-07",
                "y": 438.62
            }
        ],
        "clicks": [
            {
                "x": "2025-04-01",
                "y": 123
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 253
            },
            {
                "x": "2025-04-04",
                "y": 303
            },
            {
                "x": "2025-04-05",
                "y": 310
            },
            {
                "x": "2025-04-06",
                "y": 312
            },
            {
                "x": "2025-04-07",
                "y": 342
            }
        ],
        "keyword": [
            {
                "x": "2025-04-01",
                "y": 0
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 0
            },
            {
                "x": "2025-04-04",
                "y": 0
            },
            {
                "x": "2025-04-05",
                "y": 0
            },
            {
                "x": "2025-04-06",
                "y": 0
            },
            {
                "x": "2025-04-07",
                "y": 0
            }
        ],
        "cvr": [
            {
                "x": "2025-04-01",
                "y": 0.00
            },
            {
                "x": "2025-04-02",
                "y": 0
            },
            {
                "x": "2025-04-03",
                "y": 0.00
            },
            {
                "x": "2025-04-04",
                "y": 0.01
            },
            {
                "x": "2025-04-05",
                "y": 0.00
            },
            {
                "x": "2025-04-06",
                "y": 0.00
            },
            {
                "x": "2025-04-07",
                "y": 0.00
            }
        ]
    },
    "metrics": [
        {
            "date": "2025-04-01",
            "metrics": {
                "prints": 4528,
                "clicks": 123,
                "ctr": 0.02,
                "cvr": 0.00,
                "acos": 0.00,
                "attribution_order_conversions": 0,
                "attribution_order_amount": 0.00,
                "consumed_budget": 80047.58,
                "cost_per_clicks": 650.79,
                "leads": 0
            }
        },
        {
            "date": "2025-04-03",
            "metrics": {
                "prints": 16275,
                "clicks": 253,
                "ctr": 0.01,
                "cvr": 0.00,
                "acos": 12.69,
                "attribution_order_conversions": 1,
                "attribution_order_amount": 789999.00,
                "consumed_budget": 100263.18,
                "cost_per_clicks": 396.30,
                "leads": 0
            }
        },
        {
            "date": "2025-04-04",
            "metrics": {
                "prints": 16975,
                "clicks": 303,
                "ctr": 0.01,
                "cvr": 0.01,
                "acos": 1.98,
                "attribution_order_conversions": 6,
                "attribution_order_amount": 7597994.00,
                "consumed_budget": 150378.75,
                "cost_per_clicks": 496.30,
                "leads": 0
            }
        },
        {
            "date": "2025-04-05",
            "metrics": {
                "prints": 20429,
                "clicks": 310,
                "ctr": 0.01,
                "cvr": 0.00,
                "acos": 2.99,
                "attribution_order_conversions": 3,
                "attribution_order_amount": 4977997.00,
                "consumed_budget": 148986.63,
                "cost_per_clicks": 480.60,
                "leads": 0
            }
        },
        {
            "date": "2025-04-06",
            "metrics": {
                "prints": 18822,
                "clicks": 312,
                "ctr": 0.01,
                "cvr": 0.00,
                "acos": 0.00,
                "attribution_order_conversions": 0,
                "attribution_order_amount": 0.00,
                "consumed_budget": 149729.73,
                "cost_per_clicks": 479.90,
                "leads": 0
            }
        },
        {
            "date": "2025-04-07",
            "metrics": {
                "prints": 20696,
                "clicks": 342,
                "ctr": 0.01,
                "cvr": 0.00,
                "acos": 17.26,
                "attribution_order_conversions": 2,
                "attribution_order_amount": 869013.00,
                "consumed_budget": 150006.54,
                "cost_per_clicks": 438.62,
                "leads": 0
            }
        }
    ],
    "summary": {
        "prints": 97725,
        "clicks": 1643,
        "ctr": 0.01,
        "cvr": 0.00,
        "acos": 5.48,
        "attribution_order_conversions": 12,
        "attribution_order_amount": 14235003.00,
        "consumed_budget": 779412.41,
        "cost_per_clicks": 474.38,
        "leads": 0
    }
}
```

Nota:

Para los días sin retorno de métricas, se representarán con el valor cero en el objeto “dashboard”.

## Métricas por campaña y día

### Parámetros obligatorios

**date_from** : fecha desde la cual consultar en formato YYYY-MM-DD.
 **date_to** : fecha hasta la cual consultar en formato YYYY-MM-DD.

### Parámetros opcionales

**aggregation_type** : tipo agregado de datos a mostrar. Valores posibles: daily, total. Por defecto retorna ambos.
 **strategy** : tipo de campaña. Valores posibles: marketplace, motors o real_estate.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns/$CAMPAIGN_ID/metrics?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/10101010/brand_ads/campaigns/123456/metrics?date_from=2025-05-01&date_to=2025-05-05
```

Respuesta:

```
{
    "dashboard": {
        "ctr": [
            {
                "x": "2025-05-01",
                "y": 0.07
            },
            {
                "x": "2025-05-02",
                "y": 0.01
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0.01
            }
        ],
        "campaignId": [
            {
                "x": "2025-05-01",
                "y": 0
            },
            {
                "x": "2025-05-02",
                "y": 0
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0
            }
        ],
        "acos": [
            {
                "x": "2025-05-01",
                "y": 0.00
            },
            {
                "x": "2025-05-02",
                "y": 0.00
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0.00
            }
        ],
        "attribution_order_amount": [
            {
                "x": "2025-05-01",
                "y": 0.00
            },
            {
                "x": "2025-05-02",
                "y": 0.00
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0.00
            }
        ],
        "attribution_order_conversions": [
            {
                "x": "2025-05-01",
                "y": 0
            },
            {
                "x": "2025-05-02",
                "y": 0
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0
            }
        ],
        "prints": [
            {
                "x": "2025-05-01",
                "y": 362
            },
            {
                "x": "2025-05-02",
                "y": 1244
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 2547
            }
        ],
        "consumed_budget": [
            {
                "x": "2025-05-01",
                "y": 13523.60
            },
            {
                "x": "2025-05-02",
                "y": 10420.76
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 25034.95
            }
        ],
        "leads": [
            {
                "x": "2025-05-01",
                "y": 0
            },
            {
                "x": "2025-05-02",
                "y": 0
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0
            }
        ],
        "cost_per_clicks": [
            {
                "x": "2025-05-01",
                "y": 520.14
            },
            {
                "x": "2025-05-02",
                "y": 744.34
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 641.92
            }
        ],
        "clicks": [
            {
                "x": "2025-05-01",
                "y": 26
            },
            {
                "x": "2025-05-02",
                "y": 14
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 39
            }
        ],
        "keyword": [
            {
                "x": "2025-05-01",
                "y": 0
            },
            {
                "x": "2025-05-02",
                "y": 0
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0
            }
        ],
        "cvr": [
            {
                "x": "2025-05-01",
                "y": 0.00
            },
            {
                "x": "2025-05-02",
                "y": 0.00
            },
            {
                "x": "2025-05-03",
                "y": 0
            },
            {
                "x": "2025-05-04",
                "y": 0
            },
            {
                "x": "2025-05-05",
                "y": 0.00
            }
        ]
    },
    "metrics": [
        {
            "date": "2025-05-01",
            "metrics": {
                "prints": 362,
                "clicks": 26,
                "ctr": 0.07,
                "cvr": 0.00,
                "acos": 0.00,
                "attribution_order_conversions": 0,
                "attribution_order_amount": 0.00,
                "consumed_budget": 13523.60,
                "cost_per_clicks": 520.14,
                "leads": 0
            }
        },
        {
            "date": "2025-05-02",
            "metrics": {
                "prints": 1244,
                "clicks": 14,
                "ctr": 0.01,
                "cvr": 0.00,
                "acos": 0.00,
                "attribution_order_conversions": 0,
                "attribution_order_amount": 0.00,
                "consumed_budget": 10420.76,
                "cost_per_clicks": 744.34,
                "leads": 0
            }
        },
        {
            "date": "2025-05-05",
            "metrics": {
                "prints": 2547,
                "clicks": 39,
                "ctr": 0.01,
                "cvr": 0.00,
                "acos": 0.00,
                "attribution_order_conversions": 0,
                "attribution_order_amount": 0.00,
                "consumed_budget": 25034.95,
                "cost_per_clicks": 641.92,
                "leads": 0
            }
        }
    ],
    "summary": {
        "prints": 4153,
        "clicks": 79,
        "ctr": 0.01,
        "cvr": 0.00,
        "acos": 0.00,
        "attribution_order_conversions": 0,
        "attribution_order_amount": 0.00,
        "consumed_budget": 48979.31,
        "cost_per_clicks": 619.99,
        "leads": 0,
        "competitive_cpc": 200.0,
        "impression_share": 0.03,
        "lost_impression_share_by_ad_rank": 0.0,
        "lost_impression_share_by_budget": 0.97
    }
}
```

Nota:

Para los días sin retorno de métricas, se representarán con el valor cero en el objeto “dashboard”.

## Métricas de keywords por campaña y días

Obtiene las métricas de palabras clave de cada día para una campaña específica.

### Parámetros obligatorios

**date_from** : fecha desde la cual consultar en formato YYYY-MM-DD.
 **date_to** : fecha hasta la cual consultar en formato YYYY-MM-DD.

### Parámetros opcionales

**limit** : por defecto 50.
 **offset** : por defecto 0.
 **aggregation_type** : tipo agregado de datos a mostrar. Valores posibles: daily, total. Por defecto retorna ambos.
 **keywords** : palabras clave específicas para consultar.
 **strategy** : tipo de campaña. Valores posibles: marketplace, motors o real_estate.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns/$CAMPAIGN_ID/keywords/metrics?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/101010/brand_ads/campaigns/123456/keywords/metrics?date_from=2024-07-01&date_to=2024-07-10
```

Respuesta:

```
{
   "metrics": [
        {
            "keyword": "gel",
            "prints": 1,
            "clicks": 0,
            "ctr": 0,
            "cvr": 0,
            "acos": 0,
            "attribution_order_conversions": 0,
            "attribution_order_amount": 0.0,
            "consumed_budget": 0.0,
            "cost_per_clicks": 0,
            "leads": 0,
            "won_auctions": 0.0,
            "recommendation": 0.0,
            "is_deleted": false
        }
   ],
    "summary": [
        {
            "keyword": "productos para el cuidado facial",
            "prints": 292,
            "clicks": 0,
            "attribution_order_conversions": 0,
            "attribution_order_amount": 0.0,
            "consumed_budget": 0.0,
            "leads": 0,
            "won_auctions": 0.0,
            "goal_cpc_max": 0.0,
            "is_deleted": false
        }
    ]
}
```

## Métricas de campañas por período

Con esta consulta es posible obtener las métricas de todas las campañas de un anunciante para un período de tiempo determinado.

### Parámetros obligatorios

**date_from** : fecha de inicio de la consulta en formato YYYY-MM-DD.
 **date_to** : fecha de fin de la consulta en formato YYYY-MM-DD.

### Parámetros opcionales

**limit** : por defecto 50. (no es posible modificarlo)
 **offset** : por defecto 0.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/$ADVERTISER_ID/brand_ads/campaigns/full_summary?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/advertising/advertisers/101010/brand_ads/campaigns/full_summary?date_from=2024-07-01&date_to=2024-07-10
```

**Respuesta:**

```
{
    "summary": [
      {
        "campaignId": 12445,
        "name": "AVIT",
        "type": "Personalizada",
        "status": "ACTIVE",
        "reason_status": "BLOCKED",
        "startDate": "2025-02-13",
        "endDate": null,
        "budget": 350.00,
        "destinationId": 456,
        "goal_value": 0.33,
        "campaign_tags": null,
        "site_id": "MLB",
        "currency": "BRL",
        "official_store_id": 123,
        "eshop_id": null,
        "metrics": {
          "prints": 49508,
          "clicks": 262,
          "ctr": 0.00,
          "cvr": 0.01,
          "acos": 284.50,
          "attribution_order_conversions": 5,
          "attribution_order_amount": 156965.00,
          "consumed_budget": 446563.77,
          "cost_per_clicks": 1704.44,
          "leads": 0
        }
      }
    ],
    "pagination": {
      "total_elements": 1,
      "total_pages": 1,
      "offset": 1,
      "limit": 50
    }
}
```

### Campos de respuesta

**campaignId:**  id de la campaña

**name:**  nombre de la campaña

**type:**  tipo de campaña - valores posibles: CUSTOM o AUTOMATIC

**status:**  estado de la campaña - valores posibles: ACTIVE, PAUSED o BLOCKED

**startDate:**  inicio de la campaña

**endDate:**  fin de la campaña

**budget:**  presupuesto de la campaña

**goal_value:**  valor máximo permitido para el costo por clic (CPC) de una campaña

**site_id:**  sitio de la campaña

**official_store_id:**  tienda oficial del ítem asociado

## Posibles errores al consultar las métricas

- **204 - No content:**  No se encontraron métricas para el advertiser. La respuesta será vacía.  `{}`

- **400 - Bad request:**  Campo obligatorio no enviado, rango de fechas superior a 90 días o campo obligatorio enviado con valor incorrecto.  `{ "description": "Validation Error", "cause": [ { "error 1": "Parameter date_to is required" } ], "error": "bad_request", "status": 400 }`

- **401 - Unauthorized:**  El usuario no tiene permiso para consultar las métricas/información del advertiser.  `{ "description": "Unauthorized access", "cause": [ { "cause": "User unauthorized" } ], "error": "unauthorized", "status": 401 }`

- **500 - Internal Server Error:**  El servidor encontró un error inesperado y no pudo completar la solicitud.  `{ "description": "The server has an unexpected error and cannot complete the request", "error": "internal_server_error", "status": 500 }`

## Glosario

**won_auctions**  : porcentaje de veces que una determinada keyword ganó la subasta.
 **goal_cpc_max** : custo por clique, caso o CPC da keyword não esteja disponível, será devolvido o CPC da campanha.
 **prints**  (impresiones): cantidad de veces que se mostraron tus anuncios.
 **clicks** : cantidad de veces que los usuarios hicieron clic en tus anuncios.
 **ctr**  (click-through rate): tasa de clics obtenidos sobre el total de impresiones.
 **cvr**  (conversion rate): tasa de conversión respecto a los clics.
 **consumed_budget**  (inversión): monto de dinero efectivamente gastado para mostrar tus anuncios.
 **cpc**  (costo por clic): costo promedio pagado por cada clic recibido.
 **acos**  (advertising cost of sales): inversión/ingreso, costo publicitario de las ventas.
 **attribution_order_amount**  (ingresos): valor total generado por las ventas atribuidas a tus anuncios.
 **attribution_order_conversions** : cantidad de artículos vendidos por atribución.
 **leads** : cantidad de potenciales compradores interesados en tu producto que realizaron una pregunta o te contactaron por WhatsApp a partir de tu publicación luego de hacer clic en tus anuncios.

Las métricas de competitividad se muestran solo a nivel de campaña y reflejan tu distribución de impresiones, es decir, son porcentajes relacionados con el número de veces que tus anuncios patrocinados fueron o no fueron mostrados respecto al 100% de las veces que podrían haberse mostrado. Se calculan con datos de los últimos 7 días. Las métricas pueden ser:

- **lost_impression_share_by_budget**  (Perdidas por presupuesto): porcentaje de pérdida, entendiendo como tal las impresiones potenciales que no se pudieron capitalizar por bajo presupuesto. Por ejemplo: si es 10, significa que la campaña perdió impresiones en el 10% de las veces que podría haberlas tenido por falta de presupuesto. En estos casos, se recomienda aumentar el presupuesto.

- **lost_impression_share_by_ad_rank**  (Perdidas por ranking): porcentaje de pérdida, entendiendo como tal las impresiones potenciales que no se pudieron capitalizar por bajo ranking. Por ejemplo: si es 30, la campaña perdió impresiones en el 30% de las veces que podría haberlas tenido por tener un ad-rank insuficiente.

El ad-rank está compuesto por el Acos Target y el Quality Score (métrica interna que no puede ser gestionada directamente). Para mejorar las impresiones ganadas por ranking, sugerimos enfocarse en las siguientes acciones:

- **Revisar el CPC máximo** : lo recomendable es que estés dentro del promedio de tu competencia para obtener mejores resultados.

- **Verificar si la campaña está segmentada en las palabras clave correctas** : recomendamos tener diferentes campañas para enfocarse en palabras clave específicas en cada una.

- **Mejorar la calidad de la publicación** : la calidad de las fotos, la descripción del producto e incluso las condiciones de envío pueden influir en tu ranking.

- **Cuidar la reputación** : el servicio posventa y la valoración del producto pueden marcar la diferencia frente a la competencia. Conoce más sobre la API de Calidad de Publicaciones.

- **impression_share**  (Impresiones ganadas): porcentaje de éxito, entendiendo como tal las impresiones efectivas, es decir, el porcentaje de veces que la campaña ganó las subastas en las que participó con esa palabra clave. Es la cantidad de impresiones obtenidas dividida por la cantidad de impresiones estimadas/potenciales que podría haber tenido. Por ejemplo: si es 60%, significa que la campaña ganó y fue mostrada en el 60% de las veces que pudo haberlo sido.

- **competitive_cpc** : es el CPC promedio de la competencia.

**Siguiente** : [Display Ads](https://developers.mercadolivre.com.br/pt_br/display-ads).
