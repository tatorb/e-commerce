<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/product-ads-para-catalogo-y-user-products-lectura -->
<!-- Sección: Guía para Mercado Ads -->

# Product Ads para Catálogo y User Products

Última actualización 19/10/2026

## Product Ads para Catálogo y User Products

Importante:

Informamos que, tras el período de transición finalizado en septiembre de 2025, los endpoints legados de Product Ads listados a continuación fueron desactivados permanentemente el

**27 de mayo de 2026**

.

A partir de esa fecha, las llamadas a estos recursos retornan un error

**(404 Not Found)**

. Si tu aplicación aún utiliza alguno de estos endpoints, adapta inmediatamente tu desarrollo para evitar interrupciones en el servicio.

Solo los endpoints publicados en la documentación de Product Ads tienen soporte.

**Endpoints descontinuados:**

- **GET /advertising/product_ads/items/$ITEM_ID**

- **GET /advertising/$ADVERTISER_SITE_ID/product_ads/items/$ITEM_ID**

- **GET /advertising/advertisers/$ADVERTISER_ID/product_ads/items**

- **GET /advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/items/search**

- **GET /advertising/product_ads/campaigns/$CAMPAIGN_ID**

- **GET /advertising/advertisers/$ADVERTISER_ID/product_ads/campaigns**

- **GET /advertising/product_ads/campaigns/$CAMPAIGN_ID/metrics**

- **GET /advertising/product_ads_2/campaigns/$CAMPAIGN_ID/metrics**

- **GET /advertising/product_ads/campaigns/$CAMPAIGN_ID/ads/metrics**

- **GET /advertising/product_ads_2/campaigns/$CAMPAIGN_ID/ads/metrics**

- **GET /advertising/product_ads/ads/search**

Nota:

Antes de comenzar a utilizar esta API, es importante que te familiarices con las documentaciones [Qué es Catálogo](https://developers.mercadolivre.com.br/pt_br/o-catalogo-chegou-saiba-como-adaptar-sua-integracao), [Cómo publicar en Catálogo](https://developers.mercadolivre.com.br/pt_br/publicacao-no-catalogo) y [User Products](https://developers.mercadolivre.com.br/pt_br/user-products). Estas documentaciones te ayudarán a comprender mejor cada concepto y las funcionalidades ofrecidas.

Con la evolución de nuestros productos, Product Ads ahora requiere que los usuarios que trabajan con ítems de **Catálogo**  y **User Products**  agrupen sus anuncios de forma eficiente.

# Tipos de agrupamiento en anuncios

## Nuevo flujo de Product Ads con variantes unificadas

A partir de este nuevo flujo, todas las variantes de un producto, incluidas aquellas publicadas vía catálogo, pasan a ser gestionadas dentro de una única campaña de Product Ads. Esto representa un cambio importante en la estructura de campaña, ya que elimina la fragmentación de campañas entre diferentes variantes del mismo producto.

### ¿Qué cambió en el flujo?

#### Antes:

- Variantes de un mismo producto (por ejemplo, colores o tamaños) se promocionaban por separado, pudiendo estar asociadas a campañas distintas.

- Los productos publicados vía User Products y Catálogo requerían campañas individuales, con gestión aislada.

#### Ahora:

- Todas las variantes están unificadas en una misma campaña, centralizada en el producto principal.

- La variante con mejor rendimiento define la base de la campaña.

- Las acciones ejecutadas en la campaña (ediciones, pausas, activaciones, etc.) pasan a afectar a todas las variantes simultáneamente.

**Importante:**

Las APIs de Product Ads ahora consideran las entidades **family_id**  y **catalog_product_id**  como punto central de agrupación de las variantes.

Con los siguientes endpoints de Product Ads, puedes monitorear campañas, anuncios y métricas.Existen dos tipos de gestión de anuncios en Product Ads:

- **Automático** : Product Ads elige publicaciones con buen nivel de ventas en Mercado Libre y las muestra en los primeros lugares de los resultados de búsqueda. Puedes agregar o eliminar publicaciones de tu campaña manualmente. Al comenzar a usar Product Ads, utilizarás el modo automático por defecto.

- **Personalizado** : puedes crear múltiples campañas para agrupar tus anuncios, asignar y configurar el presupuesto y objetivo de cada una. Esta es la forma ideal de gestionar tus anuncios, ya que te permite tener más control sobre tus campañas y realizar ajustes según su rendimiento.

### Flujo técnico recomendado

A continuación, consulta los nuevos endpoints de anuncios que debes reemplazar:

| Funcionalidad | Flujo anterior | Nuevo flujo |
| --- | --- | --- |
| **Consultar anunciante** | Consultar anunciante (advertiser) | **Sin cambios** |
| **Anuncios** | Detalle del anuncio | Buscar Ad Groups por ítems Consultar detalle del Ad Group |
| **Métricas** | Métricas de anuncios | Reemplazado por las métricas de Ad Group. |
| **Métricas** | Métricas de campañas | **Sin cambios** |
| **Métricas** | — | Métricas de Ad Groups de una campaña Métricas de los anuncios del Ad Group Detalles y métricas de Ad Group por advertiser |

## Consultar anunciante

Los anunciantes (**advertiser_id** ) son aquellos que invierten un presupuesto para la creación y distribución de anuncios publicitarios, con el objetivo de promocionar sus productos o servicios. Consulta la lista de anunciantes que tienen acceso a un usuario, dependiendo del tipo de producto requerido.

**Parámetros obligatorios:**

- **product_id** : tipo de producto. Valores disponibles: PADS (Product Ads), DISPLAY, BADS (Brand Ads).

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -H 'Api-Version: 1'
https://api.mercadolibre.com/advertising/advertisers?product_id=$PRODUCT_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -H 'Api-Version: 1'
https://api.mercadolibre.com/advertising/advertisers?product_id=PADS
```

**Respuesta:**

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

**Parámetros de respuesta:**

- **advertiser_id** : identificador del anunciante. Lo utilizarás para el resto de las solicitudes.

- **site_id** : identificador del país. Consulta la nomenclatura de los sitios de Mercado Libre y sus respectivas monedas.

- **advertiser_name** : nombre del anunciante.

- **account_name** : nombre de la cuenta.

Nota:

Si recibes el error 404 - “No permissions found for user_id”, significa que el usuario no tiene el producto habilitado. El usuario debe acceder a Mercado Libre > Mi perfil > Publicidad.

## Buscar Ad Groups por ítems

A partir de este nuevo flujo, la identificación de los anuncios en las campañas se realiza mediante un nuevo identificador, el **ad_group_id** . Este identificador se utilizará en las llamadas para consultar los detalles de los ad groups y métricas de los anuncios.

Para buscar el **ad_group_id**  a partir de uno o más **item_ids** , utilizá el filtro **filters[item_ids]**  (plural) sobre el endpoint de búsqueda de Ad Groups.

**Llamada**  Current

```
curl -L -g -X GET 'https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/ad_groups/search?filters[item_ids]=$ITEM_ID,$ITEM_ID' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'api-version: 2'
```

**Ejemplo:**

```
curl -L -g -X GET 'https://api.mercadolibre.com/advertising/MLA/advertisers/882927/product_ads/ad_groups/search?filters[item_ids]=MLA2283350014,MLA2288350754' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'api-version: 2'
```

**Respuesta:**

```
{
    "paging": {
        "offset": 0,
        "total": 2,
        "limit": 50
    },
    "results": [
        {
            "id": 1194808653,
            "ad_group_external_id": "MLA2283350014",
            "status": "ACTIVE",
            "campaign_id": 353605357,
            "advertiser_id": 882927,
            "ad_group_type": "ITEM"
        },
        {
            "id": 1194727929,
            "ad_group_external_id": "MLA2288350754",
            "status": "ACTIVE",
            "campaign_id": 353605357,
            "advertiser_id": 882927,
            "ad_group_type": "ITEM"
        }
    ]
}
```

**Observación:**  El campo **id**  retornado en cada resultado es el **ad_group_id**  que utilizarás en los flujos de gestión y consulta de métricas. El campo **ad_group_external_id**  corresponde al **item_id**  enviado en el filtro.

**Llamada**  Deprecated

```
curl -L -g -X GET 'https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/ads/search?filters[item_id]=MLM1234567898' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
-H 'api-version: 2'
```

## Consultar detalle del Ad Group

Este recurso permite obtener toda la información detallada de un **Ad Group**  específico.

**Parámetros:**

- **site_id** : Identificador del sitio.

- **ad_group_id** : Identificador del Ad Group.

- **date_to** : la fecha final de la búsqueda.

- **date_from** : la fecha inicial de la búsqueda.

- **channel**  (opcional): filtro para seleccionar el canal del Ad Group.  marketplace (predeterminado)

- **filters[campaign_id]**  (opcional): filtro que utiliza ids de campañas de los Ad Groups.

- **aggregation_type**  (opcional):  adgroup (predeterminado) → para adGroup no enviar el parámetro daily

- **metrics** : las métricas deseadas.  CLICKS PRINTS COST CPC CTR DIRECT_AMOUNT INDIRECT_AMOUNT TOTAL_AMOUNT DIRECT_UNITS_QUANTITY INDIRECT_UNITS_QUANTITY UNITS_QUANTITY DIRECT_ITEMS_QUANTITY INDIRECT_ITEMS_QUANTITY ADVERTISING_ITEMS_QUANTITY ORGANIC_UNITS_QUANTITY  ORGANIC_UNITS_AMOUNT  ORGANIC_ITEMS_QUANTITY

**Llamada:**

```
curl -L -X GET \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/product_ads/ad_groups/$AD_GROUP_ID"
```

**Ejemplo:**

```
curl -L -X GET 'https://api.mercadolibre.com/advertising/MLM/product_ads/ad_groups/65867?date_from=2025-08-31&date_to=2025-09-30&metrics=CLICKS,PRINTS,COST,CPC,CTR,DIRECT_AMOUNT,INDIRECT_AMOUNT,TOTAL_AMOUNT,DIRECT_UNITS_QUANTITY,INDIRECT_UNITS_QUANTITY,UNITS_QUANTITY,DIRECT_ITEMS_QUANTITY,INDIRECT_ITEMS_QUANTITY,ADVERTISING_ITEMS_QUANTITY,ORGANIC_UNITS_QUANTITY,ORGANIC_UNITS_AMOUNT,ORGANIC_ITEMS_QUANTITY,ACOS' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

**Respuesta:**

```
{
   "channel": "MARKETPLACE",
   "catalog_listing": true,
   "title": "Espejo rectangular de pared DECOROSA 1",
   "advertiser_id": 706921,
   "ad_group_type": "CATALOG",
   "domain_id": "MLC-MIRRORS",
   "official_store_id": 0,
   "id": 976667081,
   "campaign_id": 352858339,
   "original_advertiser_id": 706921,
   "thumbnail": "https://http2.mlstatic.com/D_NQ_NP_747848-MLA86888423870_072025-F.jpg",
   "date_created": "2025-07-03T12:00:04Z",
   "ad_group_external_id": "MLC52015944",
   "current_advertiser_id": 706921,
   "sll": true,
   "brand_value_id": "55570491",
   "status": "ACTIVE",
   "metrics": {
       "clicks": 47,
       "prints": 2660,
       "cost": 3992.0,
       "cpc": 84.94,
       "direct_amount": 15608.0,
       "indirect_amount": 0.0,
       "total_amount": 15608.0,
       "direct_units_quantity": 1,
       "indirect_units_quantity": 0,
       "units_quantity": 1,
       "direct_items_quantity": 1,
       "indirect_items_quantity": 0,
       "advertising_items_quantity": 1,
       "organic_units_quantity": 0,
       "organic_items_quantity": 0,
       "acos": 25.58,
       "organic_units_amount": 0.0
   }
}
```

**Parámetros de respuesta:**

- **channel** : canal de las campañas.

- **catalog_listing** : true o false. Indica si el ítem es de catálogo.

- **advertiser_id** : identificador del anunciante. Lo utilizarás para el resto de las solicitudes.

- **ad_group_type** : tipos de agrupadores de anuncio (CATALOG, FAMILY o ITEM).

- **ad_group_id** : identificador del Ad Group del ítem.

- **ad_group_external_id** : identificador de la entidad de cada tipo de ítem:  Ítems de catálogo → utiliza el valor de parent_id. Ítems de User Product → utiliza el valor de family_id. Ítems tradicionales → utiliza el propio identificador del ítem (item_id).

- **brand_value_id** : identificador de la marca.

## Métricas de campañas

**Importante:**

A partir de

**enero de 2026**

, las respuestas de las consultas de métricas de campañas comenzarán a incluir el campo

**["roas_target"](https://developers.mercadolibre.com.ar/es_ar/product-ads-para-catalogo-y-user-products-lectura?nocache=true#:~:text=INCREASE%20y%20VISIBILITY.-,roas_target,-%3A%20Retorno%20sobre%20la)**

.

Para mejorar el análisis de desempeño, el sistema ahora prioriza el ROAS en lugar del ACOS. El ROAS se enfoca en el retorno directo de la inversión, indicando cuánto gana el vendedor por cada unidad monetaria invertida en publicidad. Las campañas que anteriormente utilizaban el ACOS Objetivo se migraron automáticamente al valor equivalente en ROAS Objetivo.

El campo

**acos_target**

seguirá visible

**hasta el 30 de marzo de 2026**

como una métrica opcional para facilitar la adaptación y la comparación, ya que

**roas_target**

es ahora el indicador estándar de performance. Se calcula automáticamente en base al ROAS enviado y a la siguiente fórmula: ACOS = (1/ROAS) X 100.

**Endpoints impactados:**

El nuevo campo

**roas_target**

pasa a devolverse en los siguientes endpoints:

- Search y métricas de campañas

- Métricas sumarizadas de campañas

- Detalle y métricas de una campaña

### Parámetros opcionales

**limit** : límite de elementos a mostrar

**offset** : atributo de paginado de los resultados, permite recorrer las páginas de la lista desde el 0 hasta el múltiplo del total de elementos con el límite por página.

**date_from** : fecha desde (YYYY-MM-DD). Se valida que esté presente si se solicitan metrics.

**date_to** : fecha hasta (YYYY-MM-DD). Se valida que esté presente si se solicitan metrics.

**metrics** : lista separada por coma (Ej. clicks, prints). Indica los campos que serán retornados en la respuesta. Valores posibles:

- clicks, prints, ctr, cost, cpc, acos, organic_units_quantity, organic_units_amount, organic_items_quantity, direct_items_quantity, indirect_items_quantity, advertising_items_quantity, cvr, roas, sov, direct_units_quantity, indirect_units_quantity, units_quantity, direct_amount, indirect_amount, total_amount

**aggregation** : agregación por la cual se presentarán los resultados. Por defecto, sum.

**aggregation_type** : Tipo de agregación en la cual se presentarán los resultados. Por defecto, campaign.

**metrics_summary** : solicitas sumarizado de métricas. Debe usarse en conjunto con metrics. Por defecto, false.

Nota:

- Para todos los endpoints de métricas puedes aplicar el rango de fechas de 90 días hacia atrás.
 - La información para validar las métricas se actualiza a las 10:00 hrs GMT-3. 
 - Solo se puede solicitar un aggregation_type a la vez.
 - **La suma de los parámetros limit y offset no puede superar 10.000.**

### Filtros disponibles

Para utilizar los filtros debes seguir la estructura **?filters[nombre del filtro]= valor**

**campaign_ids** : filtro por id de campañas separado por comas.

**campaign_id** : filtro por id de una campaña, se obtienen todos los ítems que han estado en la campaña para el rango de fechas.

**status** : estado de las campañas, separado por comas. Valores disponibles: active, paused.

**channel** : canal de las campañas. Valor por defecto: marketplace.

## Consultar campañas

**Llamada:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/campaigns/search
```

Ejemplo:

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' 
https://api.mercadolibre.com/advertising/MLM/advertisers/12345/product_ads/campaigns/search?filters[status]=active
```

**Respuesta:**

```
{
   "paging": {
       "offset": 0,
       "total": 4,
       "limit": 50
   },
   "results": [
       {
           "id": 111111,
           "name": "TEST NAME",
           "status": "active",
           "last_updated": "2024-09-20T16:23:51.000Z",
           "date_created": "2024-05-16T20:17:01.000Z",
           "channel": "marketplace",
           "daily_budget": 28.0,
           "budget": 28.0,
           "currency_id": "BRL",
           "acos_target": 9.0,
           "strategy": "PROFITABILITY"
       },
       {
           "id": 222222,
           "name": "TEST NAME 2",
           "status": "active",
           "last_updated": "2024-09-21T07:05:51.000Z",
           "date_created": "2024-05-16T20:20:34.000Z",
           "channel": "marketplace",
           "daily_budget": 15.0,
           "budget": 15.0,
           "currency_id": "BRL",
           "acos_target": 12.0,
           "strategy": "PROFITABILITY"
       },
       {
           "id": 3333333,
           "name": "TEST NAME 3",
           "status": "active",
           "last_updated": "2024-09-20T16:26:31.000Z",
           "date_created": "2024-05-16T20:22:31.000Z",
           "channel": "marketplace",
           "daily_budget": 8.67,
           "budget": 8.67,
           "currency_id": "BRL",
           "acos_target": 14.0,
           "strategy": "INCREASE"
       },
       {
           "id": 4444444,
           "name": "TEST NAME 4",
           "status": "active",
           "last_updated": "2024-09-23T07:48:44.000Z",
           "date_created": "2024-07-12T04:58:26.000Z",
           "channel": "marketplace",
           "daily_budget": 8.33,
           "budget": 8.33,
           "currency_id": "BRL",
           "acos_target": 14.0,
           "strategy": "PROFITABILITY"
       }
   ]
}
```

## Búsqueda y métricas de campañas

Obtén todas las campañas de un anunciante y además sus métricas correspondientes.

**Llamada:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/campaigns/search
```

**Ejemplo:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' 
https://api.mercadolibre.com/advertising/MLA/advertisers/882927/product_ads/campaigns/search?limit=1&offset=0&date_from=2025-12-01&date_to=2025-12-30&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount
```

**Respuesta:**

```
{
    "paging": {
        "offset": 0,
        "total": 15,
        "limit": 1
    },
    "results": [
        {
            "id": 355189450,
            "name": "Campaña",
            "status": "active",
            "last_updated": "2025-11-25T21:12:59.000Z",
            "date_created": "2025-11-25T21:12:59.000Z",
            "strategy": "VISIBILITY",
            "acos_target": 50.0,
            "acos_top_search_target": 0.0,
            "roas_target": 2.0,
            "channel": "marketplace",
            "advertiser_id": 882927,
            "salesforce_event_id": 14,
            "budget": 900.0,
            "automatic_budget": false,
            "metrics": {
                "clicks": 0,
                "prints": 0,
                "cost": 0.0,
                "cpc": 0.0,
                "ctr": 0.0,
                "direct_amount": 0.0,
                "indirect_amount": 0.0,
                "total_amount": 0.0,
                "direct_units_quantity": 0,
                "indirect_units_quantity": 0,
                "units_quantity": 0,
                "direct_items_quantity": 0,
                "indirect_items_quantity": 0,
                "advertising_items_quantity": 0,
                "organic_units_quantity": 0,
                "organic_units_amount": 0.0,
                "organic_items_quantity": 0,
                "acos": 0.0,
                "cvr": 0.0,
                "roas": 0.0,
                "sov": 0.0
            }
        }
    ]
}
```

## Métricas diarias de campañas

**Llamada:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/campaigns/search?limit=2&offset=0&date_from=2024-01-01&date_to=2024-02-28&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount&aggregation_type=DAILY
```

**Respuesta:**

```
{
   "paging": {
       "total": 50,
       "offset": 0,
       "limit": 2
   },
   "results": [
       {
           "date": "2024-01-01",
           "clicks": 0,
           "prints": 0,
           "ctr": 0.01,
           "cost": 0.01,
           "cpc": 0.01,
           "acos": 0.01,
           "organic_units_quantity": 0,
           "organic_units_amount": 0,
           "organic_items_quantity": 0,
           "direct_items_quantity": 0,
           "indirect_items_quantity": 0,
           "advertising_items_quantity": 0,
           "cvr": 0,
           "roas": 0,
           "sov": 0,
           "direct_units_quantity": 0,
           "indirect_units_quantity": 0,
           "units_quantity": 0,
           "direct_amount": 0.01,
           "indirect_amount": 0.01,
           "total_amount": 0.01
       },
       {
           "date": "2024-01-01",
           "clicks": 0,
           "prints": 0,
           "ctr": 0.01,
           "cost": 0.01,
           "cpc": 0.01,
           "acos": 0.01,
           "organic_units_quantity": 0,
           "organic_units_amount": 0,
           "organic_items_quantity": 0,
           "direct_items_quantity": 0,
           "indirect_items_quantity": 0,
           "advertising_items_quantity": 0,
           "cvr": 0,
           "roas": 0,
           "sov": 0,
           "direct_units_quantity": 0,
           "indirect_units_quantity": 0,
           "units_quantity": 0,
           "direct_amount": 0.01,
           "indirect_amount": 0.01,
           "total_amount": 0.01
       }
   ]
}
```

## Métricas sumarizadas de campañas

Utiliza el mismo endpoint para consultar métricas de campañas adicionando el parámetro **metrics_summary=true** .

**Llamada:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/campaigns/search?limit=1&offset=0&date_from=2025-12-01&date_to=2025-12-30&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount&metrics_summary=true
```

**Respuesta:**

```
{
    "paging": {
        "offset": 0,
        "total": 15,
        "limit": 1
    },
    "results": [
        {
            "id": 355189450,
            "name": "Campaña",
            "status": "active",
            "last_updated": "2025-11-25T21:12:59.000Z",
            "date_created": "2025-11-25T21:12:59.000Z",
            "strategy": "VISIBILITY",
            "acos_target": 50.0,
            "acos_top_search_target": 0.0,
            "roas_target": 2.0,
            "channel": "marketplace",
            "advertiser_id": 882927,
            "salesforce_event_id": 14,
            "budget": 900.0,
            "automatic_budget": false,
            "metrics": {
                "clicks": 0,
                "prints": 0,
                "cost": 0.0,
                "cpc": 0.0,
                "ctr": 0.0,
                "direct_amount": 0.0,
                "indirect_amount": 0.0,
                "total_amount": 0.0,
                "direct_units_quantity": 0,
                "indirect_units_quantity": 0,
                "units_quantity": 0,
                "direct_items_quantity": 0,
                "indirect_items_quantity": 0,
                "advertising_items_quantity": 0,
                "organic_units_quantity": 0,
                "organic_units_amount": 0.0,
                "organic_items_quantity": 0,
                "acos": 0.0,
                "cvr": 0.0,
                "roas": 0.0,
                "sov": 0.0
            }
        }
    ],
    "metrics_summary": {
        "clicks": 0,
        "prints": 0,
        "cost": 0.0,
        "cpc": 0.0,
        "ctr": 0.0,
        "direct_amount": 0.0,
        "indirect_amount": 0.0,
        "total_amount": 0.0,
        "direct_units_quantity": 0,
        "indirect_units_quantity": 0,
        "units_quantity": 0,
        "direct_items_quantity": 0,
        "indirect_items_quantity": 0,
        "advertising_items_quantity": 0,
        "organic_units_quantity": 0,
        "organic_units_amount": 0.0,
        "organic_items_quantity": 0,
        "acos": 0.0,
        "cvr": 0.0,
        "roas": 0.0,
        "sov": 0.0
    }
}
```

## Detalle y métricas de una campaña

**Parámetros opcionales:**

- **date_from:**  fecha desde (YYYY-MM-DD). Se valida que esté presente si se solicitan campos metrics.

- **date_to:**  fecha hasta (YYYY-MM-DD). Se valida que esté presente si se solicitan campos metrics.

- **metrics:**  lista separada por coma (Ej clicks,prints) indica los campos que serán retornados en la respuesta. Valores posibles:  clicks, prints, ctr, cost, cpc, acos, organic_units_quantity, organic_units_amount, organic_items_quantity, direct_items_quantity, indirect_items_quantity, advertising_items_quantity, cvr, roas, sov, direct_units_quantity, indirect_units_quantity, units_quantity, direct_amount, indirect_amount, total_amount, impression_share, top_impression_share, lost_impression_share_by_budget, lost_impression_share_by_ad_rank, acos_benchmark.

- **aggregation:**  agregación por la cual se presentarán los resultados. Default: sum.

- **aggregation_type:**  tipo de agregación en la cual se presentarán los resultados. Default: campaign.

**Filtros disponibles:**

- **channel:**  canal de las campañas. Valor por defecto: marketplace.

**Llamada:**

```
curl GET -H 'api-version: 2' -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/product_ads/campaigns/$CAMPAIGN_ID?date_from=2025-12-01&date_to=2025-12-30&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount,impression_share,top_impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank,acos_benchmark
```

**Respuesta:**

```
{
    "id": 355189450,
    "name": "Campaña",
    "status": "active",
    "last_updated": "2025-11-25T21:12:59.000Z",
    "date_created": "2025-11-25T21:12:59.000Z",
    "strategy": "VISIBILITY",
    "acos_target": 50.0,
    "acos_top_search_target": 0.0,
    "roas_target": 2.0,
    "channel": "marketplace",
    "budget": 900.0,
    "currency_id": "ARS",
    "metrics": {
        "clicks": 0,
        "prints": 0,
        "cost": 0.0,
        "cpc": 0.0,
        "ctr": 0.0,
        "direct_amount": 0.0,
        "indirect_amount": 0.0,
        "total_amount": 0.0,
        "direct_units_quantity": 0,
        "indirect_units_quantity": 0,
        "units_quantity": 0,
        "direct_items_quantity": 0,
        "indirect_items_quantity": 0,
        "advertising_items_quantity": 0,
        "organic_units_quantity": 0,
        "organic_units_amount": 0.0,
        "organic_items_quantity": 0,
        "acos": 0.0,
        "cvr": 0.0,
        "roas": 0.0,
        "sov": 0.0,
        "impression_share": 0.0,
        "top_impression_share": 0.0,
        "lost_impression_share_by_budget": 0.0,
        "lost_impression_share_by_ad_rank": 0.0,
        "acos_benchmark": 0.0
    }
}
```

## Métricas diarias de una campaña

**Llamada:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2'
https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/product_ads/campaigns/$CAMPAIGN_ID?date_from=2024-01-01&date_to=2024-02-28&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount,impression_share,top_impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank,acos_benchmark&aggregation_type=DAILY
```

**Respuesta:**

```
[
   {
       "date": "2024-01-01",
       "clicks": 0,
       "prints": 0,
       "ctr": 0.01,
       "cost": 0.01,
       "cpc": 0.01,
       "acos": 0.01,
       "organic_units_quantity": 0,
       "organic_units_amount": 0,
       "organic_items_quantity": 0,
       "direct_items_quantity": 0,
       "indirect_items_quantity": 0,
       "advertising_items_quantity": 0,
       "cvr": 0,
       "roas": 0,
       "sov": 0,
       "direct_units_quantity": 0,
       "indirect_units_quantity": 0,
       "units_quantity": 0,
       "direct_amount": 0.01,
       "indirect_amount": 0.01,
       "total_amount": 0.01,
       "impression_share": 0,
       "top_impression_share": 0,
       "lost_impression_share_by_budget": 0.01,
       "lost_impression_share_by_ad_rank": 0.01,
       "acos_benchmark": 123      
   }
]
```

## Métricas de anuncios

**Importante:**

Los endpoints de Métricas de anuncios fueron eliminados el **30 de mayo de 2026**  y deben ser reemplazados por los endpoints de **Métricas de Ad Group** , que ofrecen métricas a nivel de Ad Group.

## Search y métricas de todos los anuncios

Obtén todos los anuncios y métricas correspondientes a estos.

**Llamada**  Deprecated

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/ads/search?limit=1&offset=0&date_from=2024-01-01&date_to=2024-02-28&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount
```

## Métricas diarias de anuncios

**Llamada**  Deprecated

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/ads/search?limit=1&offset=0&date_from=2024-01-01&date_to=2024-02-28&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount&aggregation_type=DAILY
```

## Métricas sumarizadas de anuncios

**Llamada**  Deprecated

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/ads/search?limit=1&offset=0&date_from=2024-01-01&date_to=2024-02-28&metrics=clicks,prints,ctr,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,cvr,roas,sov,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount&metrics_summary=true
```

## Métricas diarias de anuncios de una campaña

Obtén métricas de todos los anuncios de una campaña en el intervalo de fechas especificado, indicando los **item_ids**  que deseas consultar mediante el filtro filters[item_ids].

**Llamada**  Deprecated

```
curl -L -g -X GET 'https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/campaigns/$CAMPAIGN_ID/ads/metrics?date_from=2025-10-28&date_to=2025-10-29&filters[item_ids]=MLM3930085076&metrics=clicks,prints,cost,cpc,acos,organic_units_quantity,organic_units_amount,organic_items_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,direct_units_quantity,indirect_units_quantity,units_quantity,direct_amount,indirect_amount,total_amount' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

## Métricas de Ad Groups de una campaña

Obtiene métricas de todos los Ad Groups de una campaña para el período de un día (**date_to**  igual a **date_from** ). Para períodos superiores a un día, especificá el filtro **filters[ad_group_ids]** .

**Llamada**  Current

```
curl -L -g -X GET 'https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/product_ads/campaigns/$CAMPAIGN_ID/ad_groups/metrics?date_from=2026-04-01&date_to=2026-04-01&metrics=clicks,prints,cost,cpc,ctr,direct_amount,indirect_amount,total_amount,direct_units_quantity,indirect_units_quantity,units_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,organic_units_quantity,organic_units_amount,organic_items_quantity,acos,sov,roas,cvr,tacos' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
-H 'api-version: 2'
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2'
https://api.mercadolibre.com/advertising/MCO/product_ads/campaigns/355771832/ad_groups/metrics?date_from=2026-04-01&date_to=2026-04-01&metrics=clicks,prints,cost,cpc,ctr,direct_amount,indirect_amount,total_amount,direct_units_quantity,indirect_units_quantity,units_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,organic_units_quantity,organic_units_amount,organic_items_quantity,acos,sov,roas,cvr,tacos
```

**Respuesta:**

```
{
    "date": "2026-04-01",
    "results": [
        {
            "ad_group_id": 1406314785,
            "metrics": {
                "clicks": 0,
                "prints": 11,
                "cost": 0.0,
                "cpc": 0.0,
                "ctr": 0.0,
                "direct_amount": 0.0,
                "indirect_amount": 0.0,
                "total_amount": 0.0,
                "direct_units_quantity": 0,
                "indirect_units_quantity": 0,
                "units_quantity": 0,
                "direct_items_quantity": 0,
                "indirect_items_quantity": 0,
                "advertising_items_quantity": 0,
                "organic_units_quantity": 0,
                "organic_items_quantity": 0,
                "acos": 0.0,
                "tacos": 0.0,
                "organic_units_amount": 0.0,
                "sov": 0.0,
                "cvr": 0.0,
                "roas": 0.0
            }
        }
    ]
}
```

Nota:

Si no existen métricas para la fecha consultada, este endpoint responde con el campo **results**  vacío.

## Métricas de los anuncios pertenecientes al Ad group

Devuelve métricas de rendimiento de los anuncios pertenecientes a un Ad Group específico, en el intervalo de fechas indicado.

**Llamada:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' 
https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/product_ads/ad_groups/$AD_GROUP_ID/ads?date_from=2025-09-20&date_to=2025-10-08&metrics=clicks,prints,cost,cpc,ctr,direct_amount,indirect_amount,total_amount,direct_units_quantity,indirect_units_quantity,units_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,organic_units_quantity,organic_units_amount,organic_items_quantity,acos,tacos,sov,cvr,roas
```

**Ejemplo:**

```
curl -X  GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'api-version: 2' 
https://api.mercadolibre.com/advertising/MLM/product_ads/ad_groups/1142185192/ads?date_from=2025-09-20&date_to=2025-10-08&metrics=clicks,prints,cost,cpc,ctr,direct_amount,indirect_amount,total_amount,direct_units_quantity,indirect_units_quantity,units_quantity,direct_items_quantity,indirect_items_quantity,advertising_items_quantity,organic_units_quantity,organic_units_amount,organic_items_quantity,acos,tacos,sov,cvr,roas
```

**Respuesta:**

```
{
    "paging": {
        "offset": 0,
        "total": 3,
        "limit": 50
    },
    "results": [
        {
            "item_id": "MLM3930085076",
            "campaign_id": 353605357,
            "ad_group_id": 1142185192,
            "price": 500.0,
            "price_usd": 0.0,
            "title": "Camisa Hombre - No Ofertar Azul G",
            "status": "active",
            "has_discount": false,
            "catalog_listing": false,
            "logistic_type": "xd_drop_off",
            "listing_type_id": "gold_special",
            "domain_id": "MLM-SHIRTS",
            "date_created": "2025-08-13T01:28:01Z",
            "buy_box_winner": false,
            "channel": "marketplace",
            "advertiser_id": 348449,
            "original_advertiser_id": 348449,
            "brand_value_id": "276243",
            "brand_value_name": "Genérica",
            "condition": "new",
            "current_level": "unknown",
            "deferred_stock": false,
            "thumbnail": "http://http2.mlstatic.com/D_823560-MLM89977402289_082025-I.jpg",
            "permalink": "https://articulo.mercadolibre.com.mx/MLM-3930085076-camisa-hombre-no-ofertar-azul-g-_JM",
            "recommended": false,
            "image_quality": "good_quality_thumbnail",
            "metrics": {
                "clicks": 0,
                "prints": 0,
                "cost": 0.0,
                "cpc": 0.0,
                "direct_amount": 0.0,
                "indirect_amount": 0.0,
                "total_amount": 0.0,
                "direct_units_quantity": 0,
                "indirect_units_quantity": 0,
                "units_quantity": 0,
                "direct_items_quantity": 0,
                "indirect_items_quantity": 0,
                "advertising_items_quantity": 0,
                "organic_units_quantity": 0,
                "organic_items_quantity": 0,
                "acos": 0.0,
                "tacos": 0.0,
                "organic_units_amount": 0.0,
                "sov": 0.0,
                "ctr": 0.0,
                "cvr": 0.0,
                "roas": 0.0
            },
            "status_raw": "A",
            "family_id": 3080359231396376,
            "family_name": "Camisa Hombre - No Ofertar",
            "user_product_id": "MLMU3361694576",
            "user_product_name": "Camisa Hombre - No Ofertar Azul G"
        },
        {
            "item_id": "MLM3930021010",
            "campaign_id": 353605357,
            "ad_group_id": 1142185192,
            "price": 500.0,
            "price_usd": 0.0,
            "title": "Camisa Hombre - No Ofertar Rojo G",
            "status": "active",
            "has_discount": false,
            "catalog_listing": false,
            "logistic_type": "xd_drop_off",
            "listing_type_id": "gold_special",
            "domain_id": "MLM-SHIRTS",
            "date_created": "2025-08-13T01:28:01Z",
            "buy_box_winner": false,
            "channel": "marketplace",
            "advertiser_id": 348449,
            "original_advertiser_id": 348449,
            "brand_value_id": "276243",
            "brand_value_name": "Genérica",
            "condition": "new",
            "current_level": "newbie",
            "deferred_stock": false,
            "thumbnail": "http://http2.mlstatic.com/D_925659-MLM89604452328_082025-I.jpg",
            "permalink": "https://articulo.mercadolibre.com.mx/MLM-3930021010-camisa-hombre-no-ofertar-rojo-g-_JM",
            "recommended": false,
            "image_quality": "good_quality_thumbnail",
            "metrics": {
                "clicks": 0,
                "prints": 0,
                "cost": 0.0,
                "cpc": 0.0,
                "direct_amount": 0.0,
                "indirect_amount": 0.0,
                "total_amount": 0.0,
                "direct_units_quantity": 0,
                "indirect_units_quantity": 0,
                "units_quantity": 0,
                "direct_items_quantity": 0,
                "indirect_items_quantity": 0,
                "advertising_items_quantity": 0,
                "organic_units_quantity": 0,
                "organic_items_quantity": 0,
                "acos": 0.0,
                "tacos": 0.0,
                "organic_units_amount": 0.0,
                "sov": 0.0,
                "ctr": 0.0,
                "cvr": 0.0,
                "roas": 0.0
            },
            "status_raw": "A",
            "family_id": 3080359231396376,
            "family_name": "Camisa Hombre - No Ofertar",
            "user_product_id": "MLMU3355646079",
            "user_product_name": "Camisa Hombre - No Ofertar Rojo G"
        },
        {
            "item_id": "MLM2406804973",
            "campaign_id": 353605357,
            "ad_group_id": 1142185192,
            "price": 500.0,
            "price_usd": 0.0,
            "title": "Camisa Hombre - No Ofertar Amarillo G",
            "status": "active",
            "has_discount": false,
            "catalog_listing": false,
            "logistic_type": "xd_drop_off",
            "listing_type_id": "gold_special",
            "domain_id": "MLM-SHIRTS",
            "date_created": "2025-08-13T01:28:01Z",
            "buy_box_winner": false,
            "channel": "marketplace",
            "advertiser_id": 348449,
            "original_advertiser_id": 348449,
            "brand_value_id": "276243",
            "brand_value_name": "Genérica",
            "condition": "new",
            "current_level": "newbie",
            "deferred_stock": false,
            "thumbnail": "http://http2.mlstatic.com/D_663458-MLM89604679576_082025-I.jpg",
            "permalink": "https://articulo.mercadolibre.com.mx/MLM-2406804973-camisa-hombre-no-ofertar-amarillo-g-_JM",
            "recommended": false,
            "image_quality": "good_quality_thumbnail",
            "metrics": {
                "clicks": 0,
                "prints": 0,
                "cost": 0.0,
                "cpc": 0.0,
                "direct_amount": 0.0,
                "indirect_amount": 0.0,
                "total_amount": 0.0,
                "direct_units_quantity": 0,
                "indirect_units_quantity": 0,
                "units_quantity": 0,
                "direct_items_quantity": 0,
                "indirect_items_quantity": 0,
                "advertising_items_quantity": 0,
                "organic_units_quantity": 0,
                "organic_items_quantity": 0,
                "acos": 0.0,
                "tacos": 0.0,
                "organic_units_amount": 0.0,
                "sov": 0.0,
                "ctr": 0.0,
                "cvr": 0.0,
                "roas": 0.0
            },
            "status_raw": "A",
            "family_id": 3080359231396376,
            "family_name": "Camisa Hombre - No Ofertar",
            "user_product_id": "MLMU3355646081",
            "user_product_name": "Camisa Hombre - No Ofertar Amarillo G"
        }
    ]
}
```

## Detalles y métricas de Ad Group por advertiser

Obtiene métricas y detalles de los Ad Groups pertenecientes a un advertiser en el rango de fechas especificado

**Llamada:**

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/ad_groups/search?date_to=2025-09-30&date_from=2025-08-01&limit=800&sort=desc&sort_by=clicks&metrics=CLICKS,PRINTS,COST,CPC,CTR,DIRECT_AMOUNT,INDIRECT_AMOUNT,TOTAL_AMOUNT,DIRECT_UNITS_QUANTITY,INDIRECT_UNITS_QUANTITY,UNITS_QUANTITY,DIRECT_ITEMS_QUANTITY,INDIRECT_ITEMS_QUANTITY,ADVERTISING_ITEMS_QUANTITY,ORGANIC_UNITS_QUANTITY,ORGANIC_UNITS_AMOUNT,ORGANIC_ITEMS_QUANTITY,ACOS,TACOS,SOV,CVR,ROAS&metrics_summary=true&filters[ad_group_id]=65867&sll=false&filters[original_advertiser_id]=348449&filters[campaigns]=353072052&filters[statuses]=active&filters[q]=Ofertar&filters[domains]=MLM-UNCLASSIFIED_PRODUCTS&filters[official_stores]=3782&filters[channel]=marketplace'
```

**Ejemplo:**

```

curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/advertising/MLM/advertisers/4622/product_ads/ad_groups/search?date_to=2025-09-30&date_from=2025-08-01&limit=800&sort=desc&sort_by=clicks&metrics=CLICKS,PRINTS,COST,CPC,CTR,DIRECT_AMOUNT,INDIRECT_AMOUNT,TOTAL_AMOUNT,DIRECT_UNITS_QUANTITY,INDIRECT_UNITS_QUANTITY,UNITS_QUANTITY,DIRECT_ITEMS_QUANTITY,INDIRECT_ITEMS_QUANTITY,ADVERTISING_ITEMS_QUANTITY,ORGANIC_UNITS_QUANTITY,ORGANIC_UNITS_AMOUNT,ORGANIC_ITEMS_QUANTITY,ACOS,TACOS,SOV,CVR,ROAS&metrics_summary=true&filters[ad_group_id]=65867&sll=false&filters[original_advertiser_id]=348449&filters[campaigns]=353072052&filters[statuses]=active&filters[q]=Ofertar&filters[domains]=MLM-UNCLASSIFIED_PRODUCTS&filters[official_stores]=3782&filters[channel]=marketplace'
```

**Respuesta:**

```
{
    "paging": {
        "offset": 0,
        "total": 1,
        "limit": 800
    },
    "results": [
        {
            "channel": "MARKETPLACE",
            "title": "Termometro Digital Para Baño Philips Avent Sch480/00",
            "advertiser_id": 4622,
            "ad_group_type": "FAMILY",
            "domain_id": "MLC-BABY_BATH_THERMOMETERS",
            "official_store_id": 647,
            "id": 960468947,
            "campaign_id": 348413165,
            "original_advertiser_id": 79196,
            "thumbnail": "https://http2.mlstatic.com/D_653570-MLC54380685959_032023-O.jpg",
            "date_created": "2025-06-23T23:40:16Z",
            "ad_group_external_id": "1243844975276562",
            "current_advertiser_id": 4622,
            "sll": false,
            "brand_value_id": "35924451",
            "status": "ACTIVE",
            "metrics": {
                "clicks": 2,
                "prints": 143,
                "cost": 728.0,
                "cpc": 364.0,
                "direct_amount": 0.0,
                "indirect_amount": 0.0,
                "total_amount": 0.0,
                "direct_units_quantity": 0,
                "indirect_units_quantity": 0,
                "units_quantity": 0,
                "direct_items_quantity": 0,
                "indirect_items_quantity": 0,
                "advertising_items_quantity": 0,
                "organic_units_quantity": 2,
                "organic_items_quantity": 2,
                "acos": 0.0,
                "tacos": 1.82,
                "organic_units_amount": 39980.0,
                "sov": 0.0,
                "ctr": 1.4,
                "cvr": 0.0,
                "roas": 0.0
            }
        }
    ],
    "metrics_summary": {
        "clicks": 248,
        "prints": 67931,
        "cost": 58660.0,
        "cpc": 236.53,
        "direct_amount": 192897.0,
        "indirect_amount": 109351.0,
        "total_amount": 302248.0,
        "direct_units_quantity": 11,
        "indirect_units_quantity": 10,
        "units_quantity": 21,
        "direct_items_quantity": 11,
        "indirect_items_quantity": 7,
        "advertising_items_quantity": 18,
        "organic_units_quantity": 28,
        "organic_items_quantity": 28,
        "acos": 19.41,
        "tacos": 7.24,
        "organic_units_amount": 508094.0,
        "sov": 39.13,
        "ctr": 0.37,
        "cvr": 8.47,
        "roas": 5.15
    }
}
```

**Importante:**

El endpoint **/advertising/$ADVERTISER_SITE_ID/advertisers/$ADVERTISER_ID/product_ads/ad_groups/search**  ya no soporta el filtro **filters[item_id]**  (singular). Para mapear múltiples ítems a sus ad_groups, utilizá el filtro **filters[item_ids]**  (plural) tal como se documenta en la sección **Buscar Ad Groups por ítems** . Este endpoint sin filtro de items debe usarse exclusivamente para obtener detalles y métricas de Ad Groups por advertiser.

## Glosario

**total** : total de registros obtenidos.

**offset** : valor por defecto: 0.

**limit** : límites de elementos en la lista de campañas. Por defecto: 50. La suma de los parámetros limit y offset no puede superar 10.000.

**results** : resultados obtenidos.

**id** : identificador del anuncio o campaña.

**budget** : promedio diario del presupuesto (mensual) de la campaña, es decir, si el presupuesto no queda consumido durante el día se usará el restante en los días siguientes hasta que finalice el mes. Se actualiza a diario a las 4:00 hs GMT -3.

**last_updated** : fecha de última modificación de la campaña.

**date_created** : fecha de creación de la campaña.

**price** : precio del artículo asociado.

**title** : nombre de la publicación.

**has_discount** : si cuenta con descuento. Este valor se identifica en base a la diferencia entre los campos regular amount y amount entregado por [Prices API](https://developers.mercadolibre.com.ar/es_ar/api-de-precios#Obtener-precio-de-venta-actual).

**catalog_listing** : es una publicación de catálogo.

**logistic_type** : tipo de logística para el envío del artículo.

**listing_type_id** : identificador del tipo de publicación.

**domain_id** : dominio.

**date_created** : fecha de creación del anuncio.

**official_store_id** : identificador de la tienda oficial.

**buy_box_winner** : es ganador de Catálogo.

**channel** : canal de la campaña (marketplace).

**campaign_id** : identificador de la campaña. Si el campaign id es cero quiere decir que el item no está en ninguna campaña actualmente.

**condition** : condición del artículo.

**current_level** : reputación.

**deferred_stock** : stock de producto disponible. Un [item con manufacturing_time](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones#Agregar-tiempo-de-disponibilidad-de-stock) (tiempo de disponibilidad) hace que el anuncio no se muestre, se priorizan entonces los anuncios que tengan stock inmediato.

**thumbnail** : enlace a la imagen miniatura.

**permalink** : enlace a la publicación.

**brand_value_id** : identificador de la marca asociada al ítem.

**brand_value_name** : nombre de la marca asociada al ítem.

**status** : estado del anuncio o campaña.

**recommended** : el anuncio es recomendado.

**image_quality** : Calidad de imagen de portada: good_quality_thumbnail.

**user_product_id** : User Product (UP) es un nuevo concepto dentro de Mercado Libre que tiene como objetivo permitir al vendedor la elección de diferentes condiciones de venta para cada variante de un mismo producto. Conoce más sobre [User Product](https://developers.mercadolibre.com.ar/es_ar/user-products).

**user_product_name** : nombre del user product (UP).

**family_id** : id de familia. Cada User Product pertenece a una familia (family_id), y cada familia agrupa a varios UPs.

**metrics** : métricas del artículo o campaña.

**prints** : cantidad de impresiones (veces en las que se muestra el anuncio).

**sov** : porcentaje de ventas por publicidad sobre ventas totales.

**clicks** : cantidad de veces que los usuarios de Mercado Libre hicieron clics en tus anuncios promocionados de Product Ads.

**ctr** : tasa de clicks.

**cost**  (Inversión): inversión de la campaña. Suma del costo de los clics que recibieron los anuncios promocionados de Product Ads.

**cpc** : costo por click.

**acos** : porcentaje de inversión en publicidad sobre los ingresos obtenidos. Es la relación entre lo que inviertes en tu campaña y los ingresos que generas con ella.

**Ventas sin publicidad** : son las ventas de tus publicaciones promocionadas que no se generaron a partir de clics en tus anuncios.

- **organic_units_quantity** : cantidad de unidades vendidas sin publicidad.

- **organic_units_amount** : monto de ventas de órdenes orgánicas.

- **organic_items_quantity** : cantidad de ventas sin publicidad.

**Ventas por publicidad** : son ventas recibidas a partir de clics en tus anuncios. Cada producto diferente en el carrito cuenta como una venta, sin importar su cantidad de unidades vendidas. Pueden ser directas o indirectas.

- **Ventas directas** : se refieren a las compras que realiza una persona luego de hacer clic en el anuncio.

- **direct_items_quantity** : cantidad de ventas directas por publicidad. **direct_units_quantity** : cantidad de unidades vendidas en ventas directas. **direct_amount** : suma del valor de las ventas directas obtenidas de tu Product Ad, en moneda local.

- **Ventas indirectas** : ocurren cuando una persona hace clic en un anuncio pero compra otro de tus productos.

- **indirect_items_quantity** : cantidad de ventas indirectas por publicidad. **indirect_units_quantity** : cantidad de unidades vendidas en ventas asistidas. **indirect_amount** : suma del valor de las ventas asistidas obtenidas de tu Product Ad, en moneda local.

**advertising_items_quantity** : cantidad de ventas por publicidad.

**cvr** : tasa de conversión.

**roas** : retorno sobre el gasto publicitario.

**units_quantity** : cantidad de ventas totales.

**direct_amount** : suma del valor de las ventas directas obtenidas de tu Product Ad, en moneda local.

**indirect_amount** : suma del valor de las ventas asistidas obtenidas de tu Product Ad, en moneda local.

Nota:

Las ventas se atribuyen a los anuncios promocionados no solo cuando la compra se hace inmediatamente después del click, sino dentro de un cierto período posterior al clic, que se lo llama “ventana de atribución”. En el caso de Product Ads, ese período es de 14 días.

**total_amount** (Ingresos): suma del valor de las ventas obtenidas de tu Product Ad, en moneda local. Son los ingresos que obtienes por ventas directas o indirectas a través de los anuncios promocionados de Product Ads.

**impression_share**  (Impresiones): porcentaje de veces que se muestran los anuncios considerando todas las veces que pueden ser mostrados.

### Métricas de competitividad

Estas métricas se calculan según el número de impresiones (la cantidad de veces que se muestra un anuncio). Indican la participación de tu campaña de Product Ads en los espacios publicitarios. Es decir, te permiten entender cuántas impresiones obtienen tus anuncios y cuántas podrías haber obtenido en relación a las oportunidades que se generaron en un período determinado.

**top_impression_share** (impresiones ganadas): porcentaje de subastas ganadas en las primeras posiciones del search entre la cantidad de subastas en las que pudo participar. Por ejemplo, si es 70 significa que la campaña ganó un 70% de las subastas posibles. Es decir, el anuncio se mostró en 7 de cada 10 oportunidades.

**lost_impression_share_by_budget**  (impresiones perdidas por presupuesto): porcentaje de veces que no se muestran los anuncios considerando todas las veces que pudieran ser mostrados y que no sucedió porque el presupuesto diario es muy bajo. Este porcentaje indicará si el presupuesto de tu campaña es insuficiente para aprovechar todas las impresiones disponibles.

- Si la campaña está activa con presupuesto insuficiente, significa que no será considerada para participar de una subasta y por lo tanto no podrá competir para imprimirse.

- Si la campaña está consumiendo el 100 % del presupuesto, es posible que se genere un mayor porcentaje de impresiones perdidas. Por eso, es recomendable aumentar el presupuesto de tu campaña para que este porcentaje disminuya.

**lost_impression_share_by_ad_rank**  (impresiones perdidas por ranking): porcentaje de veces que no se muestran los anuncios considerando todas las veces que pueden ser mostrados y que no sucedió porque tu ranking es más bajo que otros vendedores. Indica cuánto no se mostraron tus anuncios por tener un ranking más bajo que los de otros vendedores.

Este porcentaje **te ayuda a identificar si es necesario aumentar el ACOS objetivo de tu campaña** . Así serán más competitivas las ofertas con las cuales participas de las subastas y aumentarás tu posibilidad de ganarlas.
 Esta métrica representa la cantidad de veces que **tus anuncios no se imprimieron por no tener un ranking suficiente (buena calidad y ACOS Objetivo alto)** , en relación a la cantidad de veces que se podrían haber impreso en todos los espacios publicitarios. Esta situación se da cuando un anuncio participa de una subasta porque la campaña tiene presupuesto suficiente, pero al anuncio no le alcanza el ranking para que se imprima.
 Algunas recomendaciones para estos casos: **aumentar el ACOS, activar anuncios de mejor calidad, agregar a tu campaña anuncios que tengan un mejor nivel de conversión**  y **pausar los que**  consideres que en cierto tiempo **no generan los resultados que buscas** .

Nota:

Impresiones ganadas, Impresiones perdidas por presupuesto e Impresiones perdidas por ranking suman 100 %, que representa el total de oportunidades de mostrar tus anuncios promocionados dentro de un período considerado.

**acos_benchmark** : el ACOS objetivo usado por anuncios con buenos resultados en impresiones y ventas.

**picture_id** : id de imagen del artículo a nivel MercadoLibre.

**acos_target** : costo publicitario de ventas (ACOS) target utilizado por anuncios con buenos resultados en impresiones y ventas.

**strategy** : tipo de estrategia de campaña. Puede ser PROFITABILITY, INCREASE y VISIBILITY.

**roas_target** : Retorno sobre la inversión publicitaria (ROAS Objetivo). Es el ingreso generado por la campaña/anuncio por cada unidad monetaria invertida en publicidad (ingresos atribuibles /gasto publicitario). Debe ser mayor o igual a 1x e inferior o igual a 35x.

**¿Cómo interpreto la relación entre el ROAS que defino y mis resultados?**

**ROAS Objetivo bajo:**  Busca generar más ventas y tener mayor alcance, aunque la rentabilidad por cada venta sea menor.

**ROAS Objetivo alto:**  Busca mayor rentabilidad por cada venta, aunque esto signifique que sus anuncios sean menos competitivos y generen un volumen de ventas e ingresos totales más bajo.
