<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/central-de-promociones -->
<!-- Sección: Guía para productos > Central de promociones -->

# Gestionar promociones

Última actualización 06/11/2026

## Gestionar promociones

Importante:

Mercado Libre puede aplicar un descuento extra (boost) sobre el co-fondeo de ciertas campañas. Cuando esto ocurra, podrás identificarlo en la respuesta a través de los siguientes campos adicionales: **boosted_offer** , **discount_meli_boosted_percentage** , **discount_meli_boost_amount**  y **total_price_for_boosted_offer** .

 Secciones actualizadas: Consultar ítems de la promoción y Consultar promociones del ítem.
 **Campañas impactadas:**  DEAL, PRICE_DISCOUNT, PRE_NEGOTIATED, SMART, PRICE_MATCHING y LIGHTNING (solo a nivel de ítem).

Con el recurso **/seller-promotions**  puedes centralizar todos los tipos de promociones disponibles como **campañas tradicionales**  (DEAL),**campañas co-fondeadas**  por Mercado Libre (MARKETPLACE CAMPAIGN), **descuentos individuales**  (PRICE_DISCOUNT), **ofertas relámpago**  (LIGHTNING), **ofertas del día**  (DOD), **descuento por volumen**  (VOLUME), **descuento pre-acordado por item**  (PRE NEGOTIATED), **campaña del vendedor**  (SELLER_CAMPAIGN), **campañas co-fondeada automatizada**  (SMART),**campañas de precios competitivos**  (PRICE_MATCHING), **campaña de liquidación stock Full**  (UNHEALTHY_STOCK) y **campañas de cupones del vendedor**  (SELLER_COUPON_CAMPAIGN). Además de los nuevos tipos de ofertas que disponibilicemos.

## Características de las promociones

| Nombre de la campaña | Tipo de campaña | Definición de precio | Sugerencia de precio | Bonificación MELI | Stock para participar | Deadline | Aprobación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **Tradicional** | DEAL | Usuario define | Si | No | No | Sí | Sí |
| **Co-fondeada** | MARKETPLACE CAMPAIGN | Usuario acepta | No | Sí | No | Sí | No |
| **Descuento por volumen** | VOLUME | Usuario acepta | No | Sí | No | Sí | No |
| **Oferta del día** | DOD | Usuario define | Sí | No | Sí, informativo | No | No |
| **Oferta relámpago** | LIGHTNING | Usuario define | Sí | No | Sí, mandatorio | No | No |
| **Descuento pre-acordado por ítem** | PRE_NEGOTIATED | Usuario acuerda y acepta | No | Sí | Sí | Sí | No |
| **Campaña del vendedor** | SELLER CAMPAIGN | Usuario define y acepta | No | No | No | Sí | No |
| **Campaña co-fondeada automatizada** | SMART | Usuario acepta | No | Sí | No | Sí | No |
| **Campaña de precios competitivos** | PRICE_MATCHING | Usuario acepta | No | Sí | No | Sí | No |
| **Campaña de liquidación stock Full** | UNHEALTHY_STOCK | Usuario acuerda y acepta | No | Sí | Sí | Sí | No |

## Disponibilidad por país

| Sitio | **Campañas tradicionales**  (DEAL) | **Campaña co-fondeada**  (MARKETPLACE CAMPAIGN) | **Descuento individual**  (PRICE_DISCOUNT) | **Descuento por volumen**  (VOLUME) | **Descuento pre-acordado por ítem**  (PRE_NEGOTIATED) | **Oferta del día**  (DOD) | **Oferta relámpago**  (LIGHTNING) | **Campaña co-fondeada automatizada**  (SMART) | **Campaña de precios competitivos**  (PRICE_MATCHING) | **Campaña de liquidación stock Full**  (UNHEALTHY_STOCK) | **Campaña del vendedor**  (SELLER_CAMPAIGN) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **MLA, MLB, MLM, MCO, MLC, MLU, MPE** |  |  |  |  |  |  |  |  |  |  |  |
| **MLV y MEC** |  |  |  |  |  |  |  |  |  |  |  |

Nota:

La campaña de cupones del vendedor (SELLER_COUPON_CAMPAIGN) esta disponible solo para MLB.

## Promociones del vendedor

Recuerda que un usuario puede tener más de una invitación y de diferentes tipos.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/users/$USER_ID?app_version=v2
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/users/1356551933?app_version=v2
```

Respuesta:

```
{
  "results": [
    {
      "id": "P-MLB1806015",
      "type": "MARKETPLACE_CAMPAIGN",
      "status": "started",
      "start_date": "2023-04-20T02:00:00Z",
      "finish_date": "2023-08-01T02:00:00Z",
      "deadline_date": "2023-08-01T01:00:00Z",
      "name": "Campanha de teste v2",
      "benefits": {
        "type": "REBATE",
        "meli_percent": 5,
        "seller_percent": 25
      }
    },
    {
      "id": "P-MLB1806017",
      "type": "VOLUME",
      "status": "started",
      "start_date": "2023-04-20T03:00:00Z",
      "finish_date": "2023-08-01T02:00:00Z",
      "deadline_date": "2023-08-01T01:00:00Z",
      "name": "Leva 3 paga 2",
      "benefits": {
        "type": "VOLUME",
        "meli_percent": 9.9999,
        "seller_percent": 23.3331,
        "name": "3x2",
        "buy_quantity": 3,
        "pay_quantity": 2,
        "item_discount_percent": 33.333
      }
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 50,
    "total": 5
  }
}
```

### Campos de la respuesta

- **id**  (string): identificador de la oferta.

- **type**  (string): tipo de la oferta. Valores posibles: DEAL, MARKETPLACE_CAMPAIGN, DOD, LIGHTNING, VOLUME, PRICE_DISCOUNT, PRE_NEGOTIATED, SELLER_CAMPAIGN, SMART, PRICE_MATCHING, UNHEALTHY_STOCK y SELLER_COUPON_CAMPAIGN.

- **status**  (string): estado de la oferta.

- **start_date**  (string): fecha de inicio de la oferta.

- **finish_date**  (string): fecha de fin de la oferta.

- **deadline_date**  (string): plazo máximo para aceptar la invitación.

- **name**  (string): nombre de la promoción.

- **benefits**  (object): configuración de beneficios de la promoción.

## Consultar ítems candidatos

El recurso **/seller-promotions/candidates**  permite identificar los ítems invitados a participar de una promoción. Siempre que un ítem obtiene el status de **candidate**  en una promoción se envía una notificación con el **candidate_id** , con este recurso es posible identificar el ítem, la promoción y el status.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/seller-promotions/candidates/$CANDIDATE_ID?app_version=v2
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/seller-promotions/candidates/CANDIDATE-MLB1254949426-803130663?app_version=v2
```

Respuesta:

```
{
  "id": "CANDIDATE-MLB1254949426-803130663",
  "item_id": "MLB1254949426",
  "promotion_id": "P-MLB4629001",
  "type": "MARKETPLACE_CAMPAIGN",
  "status": {
    "id": "candidate"
  }
}
```

**Campos de respuesta**

- **id**  (string): identificador del candidato.

- **item_id**  (string): ítem asociado al candidato.

- **promotion_id**  (string): identificador de la promoción.

- **type**  (string): tipo de promoción. Valores posibles: DEAL, MARKETPLACE_CAMPAIGN, DOD, LIGHTNING, VOLUME, PRICE_DISCOUNT, PRE_NEGOTIATED, SELLER_CAMPAIGN, SMART, PRICE_MATCHING, UNHEALTHY_STOCK y SELLER_COUPON_CAMPAIGN.

- **status**  (string): estado del candidato.

Nota:

El id del candidato se obtiene a través de la notificación del topic **public candidate** .

## Consultar ofertas

El recurso **/seller-promotions/offers**  permite identificar cambios en la oferta de un ítem. Todos los cambios se envían por medio de notificaciones con el **offer_id** , es posible identificar el item, la promoción y el estado.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/offers/$OFFERS_ID?app_version=v2
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/offers/OFFER-MLB1970246686-42701792?app_version=v2
```

Respuesta:

```
{
  "id": "OFFER-MLB1970246686-42701792",
  "item_id": "MLB1970246686",
  "promotion_id": "P-MLB3329001",
  "type": "DEAL",
  "status": {
    "id": "ACTIVE"
  }
}
```

### Campos de la respuesta

- **id**  (string): identificador de la oferta.

- **item_id**  (string): ítem asociado a la oferta.

- **promotion_id**  (string): identificador de la promoción.

- **type**  (string): tipo de promoción. Valores posibles: DEAL, MARKETPLACE_CAMPAIGN, DOD, LIGHTNING, VOLUME, PRICE_DISCOUNT, PRE_NEGOTIATED, SELLER_CAMPAIGN, SMART, PRICE_MATCHING, UNHEALTHY_STOCK y SELLER_COUPON_CAMPAIGN.

- **status**  (string): estado de la oferta. Valores posibles: **programmed** , **active**  e **inactive** .

Nota:

El id de la oferta lo obtienes por medio de una notificación del tópico [public offers](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones?#public-offers).

## Consultar detalles de la promoción

Realiza la siguiente consulta para acceder a los detalles particulares de una campaña tradicional, campaña co-fondeada y para los descuentos por volumen.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID?promotion_type=$PROMOTION_TYPE&app_version=v2
```

Para obtener más información, acceda a las documentaciones de cada campaña.

## Estado

A continuación puedes encontrar los posibles estados que pueden tener los distintos tipos de promociones:

- [Estados de campaña tradicional](https://developers.mercadolibre.com.ar/es_ar/deals?#Estados)

- [Estado de una campaña co-fondeada](https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas?#Estados)

- [Estado de campaña descuento por cantidad](https://developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-cantidad#Estados)

- [Estado de campaña pre-acordado por ítem y Campaña de liquidación stock Full](https://developers.mercadolibre.com.ar/es_ar/descuento-pre-acordado-por-item#Estados-de-las-campa%C3%B1as)

- [Estado campaña co-fondeada automatizada y campañas de precios competitivos](https://developers.mercadolibre.com.ar/es_ar/campanas-smart-price-matching#Estados)

- [Cupones del vendedor](https://developers.mercadolibre.com.ar/es_ar/cupones-del-vendedor)

## Consultar ítems de la promoción

ACTUALIZADO

Nota:

En esta consulta se obtiene el estado del ítem en la campaña.

Para conocer los ítems que forman parte de una determinada oferta puedes realizar la siguiente consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID/items?promotion_type=$PROMOTION_TYPE&app_version=v2
```

Además, puedes consultar ítems de una campaña:

- [Tradicional](https://developers.mercadolibre.com.ar/es_ar/deals#Consultar-%C3%ADtems-en-una-campa%C3%B1a-tradicional)

- [Co-fondeada](https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas#Consultar-%C3%ADtems-en-una-campa%C3%B1a-co-fondeada)

- [Descuento por cantidad](https://developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-cantidad)

- [Descuento pre-acordado por ítem y Campaña de liquidación stock Full](https://developers.mercadolibre.com.ar/es_ar/descuento-pre-acordado-por-item)

- [Oferta del día](https://developers.mercadolibre.com.ar/es_ar/ofertas-del-dia#Consultar-%C3%ADtems-en-una-oferta-del-d%C3%ADa)

- [Oferta relámpago](https://developers.mercadolibre.com.ar/es_ar/ofertas-relampago#Consultar-%C3%ADtems-en-una-oferta-rel%C3%A1mpago)

- [Del vendedor](https://developers.mercadolibre.com.ar/es_ar/campanas-del-vendedor?nocache=true#)

- [Co-fondeada automatizada y campañas de precios competitivos](https://developers.mercadolibre.com.ar/es_ar/campanas-smart-price-matching)

- [Cupones del vendedor](https://developers.mercadolibre.com.ar/es_ar/cupones-del-vendedor)

## Filtros

Puedes aplicar filtros por item_id, status y status_item:

- **item_id:**  Permite filtrar por un ítem específico.

- **status:**  Permite filtrar por el estado de la oferta: **started** , **pending**  o **candidate** .

- **status_item:**  Permite filtrar por el estado de los ítems que forman parte de la campaña, pudiendo ser **active**  o **paused** .

Nota:

Cuando se envía el filtro status_item, solo se devuelven los ítems correspondientes al estado consultado: "active" o "paused". Si no se incluye este parámetro, la consulta, por defecto, devuelve únicamente los ítems activos en Mercado Libre.
En caso de enviar un valor distinto de "active" o "paused", se responderá con un **400 - Bad Request.**

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID/items?promotion_type=$PROMOTION_TYPE&status=$STATUS&item_id=$ITEM_ID&app_version=v2
```

Ejemplo de filtro por ítem_id:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/MLA1111/items?promotion_type=DEAL&item_id=MLA604400000&app_version=v2
```

Respuesta:

```
{
  "results": [
    {
      "id": "MLA604400000",
      "status": "started",
      "price": 23968,
      "original_price": 28549
    }
  ],
  "paging": {}
}
```

Ejemplo de filtro por status:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/MLA1111/items?promotion_type=DEAL&status=started&app_version=v2
```

Respuesta:

```
{
  "results": [
    {
      "id": "MLA639970000",
      "status": "started",
      "price": 4037,
      "original_price": 4427
    },
    {
      "id": "MLA639973333",
      "status": "started",
      "price": 6007,
      "original_price": 6587
    }
  ],
  "paging": []
}
```

Ejemplo de filtro por status_item:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/MLA1111/items?promotion_type=DEAL&status_item=active&app_version=v2
```

Respuesta:

```
{
  "results": [
    {
      "id": "MLA639970000",
      "status": "started",
      "price": 4037,
      "original_price": 4427
    },
    {
      "id": "MLA639973333",
      "status": "started",
      "price": 6007,
      "original_price": 6587
    }
  ],
  "paging": []
}
```

## Paginación

Importante:

- El query param **comienza a llamarse search_after**  (antes searchAfter). Se continuará aceptando searchAfter por un tiempo.

- **Se unifica el valor de search_after**  para que solo utilice valores distintos, eliminando la ambigüedad.

Para realizar la paginación deberás utilizar el parámetro search_after. 
En la respuesta del GET, devolvemos el parámetro searchAfter, el cual servirá para poder recorrer los resultados. Para ello se deberá recuperar dicho ID y realizar la siguiente request con el query param search_after={search_after}. Este ID es un string, por eso tienen que aceptar el string y usarlo luego en sus solicitudes.

Nota:

Si no utilizas el parámetro de limit, se retornarán por defecto 50 ítems del total. Puedes agregar un limit máximo de 50.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID/items?promotion_type=$PROMOTION_TYPE&app_version=v2&limit=50&search_after={$SEARCH_AFTER}
```

### Consideraciones

- Se devolverá search_after en todas las páginas, excepto en la última.

- La única forma de avanzar en la respuesta (paginar) es a través del uso de este parámetro.

- Al iterar los resultados, cada llamada retornará el search_after que deberá ser utilizado en la siguiente llamada.

- Siempre se debe utilizar el search_after que fue proporcionado por la respuesta del request, ya que este puede cambiar y expirar (tienen un TTL de 5 minutos).

- No es posible realizar paginados hacia atrás.

## Cómo participar

Puedes participar en distintos tipos de promociones e incluso ofrecer un descuento individual para los ítems:

- [Indicando ítems para una campaña tradicional](https://developers.mercadolibre.com.ar/es_ar/deals?#Indicar-%C3%ADtems-para-una-campa%C3%B1a-tradicional).

- [Indicando ítems para una campaña co-fondeada](https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas?#Indicar-%C3%ADtems-para-una-campa%C3%B1a-co-fondeada).

- [Indicando ítems para descuento por volumen](https://developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-volumen#Indicar-%C3%ADtems-para-una-campa%C3%B1a-con-descuento-por-volumen).

- [Aceptando descuento pre-acordado por ítem](https://developers.mercadolibre.com.ar/es_ar/descuento-pre-acordado-por-item#Aceptar-descuentopre-acordado-por-%C3%ADtem).

- [Indicando ítems para una oferta del día](https://developers.mercadolibre.com.ar/es_ar/ofertas-del-dia#Indicar-%C3%ADtems-para-una-oferta-del-d%C3%ADa).

- [Indicando ítems para una oferta relámpago](https://developers.mercadolibre.com.ar/es_ar/ofertas-relampago#Indicar-%C3%ADtems-para-una-oferta-rel%C3%A1mpago).

- [Ofreciendo un descuento individual para un ítem](https://developers.mercadolibre.com.ar/es_ar/descuento-individual#Ofrecer-un-descuento-para-un-%C3%ADtem).

- [Indicando items para una campaña del vendedor.](https://developers.mercadolibre.com.ar/es_ar/campanas-del-vendedor?nocache=true#)

- [Indicando items para una campaña smart.](https://developers.mercadolibre.com.ar/es_ar/campanas-smart?nocache=true)

## Consultar promociones del ítem

ACTUALIZADO

Este recurso devuelve todas las promociones asociadas a un ítem. La respuesta indica el estado de participación del ítem en cada promoción y el precio correspondiente en el momento de la consulta. No incluye información general de la promoción.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLA1658866847?app_version=v2
```

Respuesta:

```
[
  {
    "type": "PRICE_DISCOUNT",
    "status": "candidate",
    "price": 0,
    "original_price": 2191665,
    "name": "",
    "min_discounted_price": 629896.94,
    "max_discounted_price": 2082081.8,
    "suggested_discounted_price": 2082081.8
  },
  {
       "id": "P-MLA6004016",
        "type": "PRICE_DISCOUNT",
        "ref_id": "OFFER-MLA1658866847-10000262324",
        "status": "started",
        "price": 2098056.5,
        "meli_percentage": 4.1,
        "seller_percentage": 0.1,
        "original_price": 2191656.5,
        "name": "PM100 Test",
        "boosted_offer": true,
        "discount_meli_boosted_percentage": 0.1,
        "discount_meli_boost_amount": 1600,
        "total_price_for_boosted_offer": 2098056.5

  }
 {
        "id": "P-MLA5626060",
        "type": "DEAL",
        "status": "started",
        "price": 157000,
        "original_price": 170000,
        "start_date": "2026-04-03T21:40:00-03:00",
        "finish_date": "2026-07-01T21:40:00-03:00",
        "name": "Promo TIER_2 - 3",
        "boosted_offer": true,
        "discount_meli_boosted_percentage": 3.5,
        "discount_meli_boost_amount": 6000,
        "total_price_for_boosted_offer": 157000
    }
{
        "type": "PRICE_DISCOUNT",
        "status": "started",
        "price": 5.1,
        "original_price": 6,
        "top_price": 5,
        "start_date": "2026-05-28T22:00:00",
        "finish_date": "2026-06-05T22:00:00",
        "name": "",
        "boosted_offer": true,
        "discount_meli_boosted_percentage": 6.7,
        "discount_meli_boost_amount": 0.4,
        "total_price_for_boosted_offer": 5.1
    },
{
        "id": "P-MLA6506024",
        "type": "PRE_NEGOTIATED",
        "ref_id": "OFFER-MLA1658866847-10000265507",
        "status": "started",
        "price": 2148665,
        "meli_percentage": 0.5,
        "seller_percentage": 1,
        "original_price": 2191665,
        "name": "pruebaCHOmayo2026",
        "boosted_offer": true,
        "discount_meli_boosted_percentage": 0.5,
        "discount_meli_boost_amount": 10000,
        "total_price_for_boosted_offer": 2148665
    }
{
        "id": "P-MLB6288014",
        "type": "SMART",
        "ref_id": "OFFER-MLB4561352621-10000263432",
        "status": "started",
        "price": 3245,
        "meli_percentage": 8,
        "seller_percentage": 16,
        "original_price": 5000,
        "name": "Desconto no Pix",
        "boosted_offer": true,
        "discount_meli_boosted_percentage": 11.1,
        "discount_meli_boost_amount": 555,
        "total_price_for_boosted_offer": 3245
    }
{
        "id": "LGH-MLA1000",
        "type": "LIGHTNING",
        "ref_id": "OFFER-MLA2125872090-10000263447",
        "status": "started",
        "price": 72223,
        "original_price": 83998,
        "stock": {
            "remaining_stock": 10
        },
        "boosted_offer": true,
        "discount_meli_boosted_percentage": 9.3,
        "discount_meli_boost_amount": 7777,
        "total_price_for_boosted_offer": 72223
    },
{
        "id": "P-MLA6214006",
        "type": "PRICE_MATCHING",
        "ref_id": "OFFER-MLA2722062952-10000265597",
        "status": "started",
        "price": 73001,
        "meli_percentage": 1.3,
        "seller_percentage": 1.7,
        "original_price": 76287,
        "name": "Promo test PM",
        "boosted_offer": true,
        "discount_meli_boosted_percentage": 1.3,
        "discount_meli_boost_amount": 999,
        "total_price_for_boosted_offer": 73001
    },

]
```

### Campos de respuesta:

**id** : Identificador de la promoción

**status** : Estado específico del ítem en la promoción:

- **candidate** : El ítem es elegible y puede participar en la promoción

- **started** : El ítem participa activamente en la promoción

- **pending** : El ítem fue optineado pero la oferta aún no comenzó

**original_price** : precio del ítem sin descuento.

**min_discounted_price** : Precio mínimo permitido en la promoción. Refleja el mayor descuento posible para el ítem.

**max_discounted_price** : Precio máximo al que puede ofrecerse el ítem en la promoción, garantizando descuentos creíbles.

**suggested_discounted_price** : Precio sugerido para una oferta atractiva, basado en el historial y contexto del ítem. Puede ser null si no hay una sugerencia disponible.

#### **Según promoción**

**Deal**

**top_deal_price** : Precio exclusivo disponible únicamente para compradores destacados (niveles 3 y 6 de Mercado Puntos). Este campo solo aparece si el ítem está activo en la campaña y el vendedor lo configuró al momento de sumarse.

**Marketplace campaign**

**ref_id** : id de la oferta o candidato (presente solo cuando el estado es started).

**meli_percentage** : Porcentaje de descuento aportado por Mercado Libre.

**seller_percentaje** : Porcentaje de descuento aportado por el vendedor.

**price** : precio del ítem en la campaña

**Seller campaign**

**sub_type** : FLEXIBLE_PERCENTAGE.

**price** : precio del ítem en la campaña

**Volume**

**buy_quantity/pay_quantity_discount_percentage** : se completa de acuerdo al subtipo de promo.

**allow_combination** : permite la combinación de items.

**sub_type** : pudiendo ser BNGM - BNSP - SPONTH.

**Oferta del día y Oferta relámpago**

**stock** : Información sobre el stock mínimo y máximo requerido para que el ítem pueda sumarse como candidato a la promoción.

**Cupones**

**fixed_percentage** : Porcentaje de descuento ofertado (solo para subtipo FIXED_PERCENTAGE).

**sub_type** : Subtipo de la campaña. Indica si el cupón es de monto fijo (FIXED_AMOUNT) o porcentaje (FIXED_PERCENTAGE).

**fixed_amount** : Monto fijo de descuento otorgado (solo para subtipo FIXED_AMOUNT).

**Campos de boost (condicionales)**  NUEVO

Presentes únicamente cuando boosted_offer: true. Aplica para campañas DEAL, PRICE_DISCOUNT, PRE_NEGOTIATED, SMART, PRICE_MATCHING y LIGHTNING (solo a nivel de ítem).

**boosted_offer** : Indica que Mercado Libre está aplicando un descuento adicional sobre el precio de la campaña base.

**discount_meli_boosted_percentage** : Porcentaje adicional de descuento absorbido por Mercado Libre como parte del boost. Independiente de meli_percentage.

**discount_meli_boost_amount** : Monto absoluto (en moneda local) del descuento extra aportado por el boost.

**total_price_for_boosted_offer** : Precio final del ítem luego de aplicar el descuento base y el boost. Es el precio que verá el comprador.

## Modificar ítems

Puedes modificar los ítems que están participando en una determinada oferta:

- [Modificando ítems en una campaña tradicional](https://developers.mercadolibre.com.ar/es_ar/deals?#Modificar-%C3%ADtems).

- [Modificando ítems en una campaña co-fondeada](https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas?#Modificar-%C3%ADtems).

- [Modificando ítems en una campaña con descuento por volumen](https://developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-volumen#Modificar-%C3%ADtems).

Nota:

Para editar los descuentos individuales (PRICE_DISCOUNT), las ofertas del día (DOD) y las ofertas relámpago (LIGHTNING) debes eliminar la promoción y aplicarla nuevamente.

## Delete masivo de ofertas

Puedes eliminar de forma masiva todas las ofertas que están en el ítem.

Nota:

Este delete masivo no se aplica en casos de ofertas de campañas del tipo DOD y LIGHTNING. Para estas ofertas, es necesario continuar eliminando una campaña por vez.

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLA1399846831?app_version=v2
```

Respuesta:

```
{
  "successful_ids": [
    {
      "offer_id": "OFFER-MLA1399846831-10000081416",
      "error": null
    },
    {
      "offer_id": "OFFER-MLA1399846831-10000081567",
      "error": null
    }
  ],
  "errors": []
}
```

### Posibles errores

**423_ENTITY_LOCKED** : La solicitud no pudo ser procesada porque el ítem está temporalmente bloqueado para realizar solicitudes. La solicitud puede intentarse nuevamente después de unos segundos.

**400_BAD_REQUEST** : Cuando el formato del ítem es inválido.

## Eliminar ítems

Puedes eliminar los ítems que están participando en una determinada oferta:

- [Eliminando ítems en una campaña tradicional](https://developers.mercadolibre.com.ar/es_ar/deals?#Eliminar-%C3%ADtems).

- [Eliminando ítems en una campaña co-fondeada](https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas?#Eliminar-%C3%ADtems).

- [Eliminando ítems en una campaña con descuento por volumen](https://developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-volumen#Eliminar-%C3%ADtems).

- [Eliminando descuento pre-acordado por ítem](https://developers.mercadolibre.com.ar/es_ar/descuento-pre-acordado-por-item#Eliminar-%C3%ADtems).

- [Eliminando ítems en una oferta del día](https://developers.mercadolibre.com.ar/es_ar/ofertas-del-dia#Eliminar%20%C3%ADtems).

- [Eliminando ítems en una oferta relámpago](https://developers.mercadolibre.com.ar/es_ar/ofertas-relampago#Eliminar%20%C3%ADtems).

- [Eliminando descuento individual a un ítem](https://developers.mercadolibre.com.ar/es_ar/descuento-individual?#Eliminar-descuento-individual-a-un-%C3%ADtem).

## Gestión de lista de exclusión para Campañas Automáticas

Con este recurso podrás administrar la lista de exclusión automática para las promociones en Mercado Libre. Si deseas evitar que determinados **sellers**  o **productos**  participen en campañas de forma automática, esta guía te mostrará cómo hacerlo.

### Consulta por Seller

Puedes verificar si un seller está excluido de la participación automática en promociones.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/seller-promotions/exclusion-list/seller?app_version=v2
```

**Respuesta:**

```
{
  "excluded": "not_excluded"
}
```

**Parámetros:**

- **excluded** : Indica si el seller está excluido.**"not_excluded"** : No está excluido.**"excluded"** : Está excluido.

### Gestionar sellers de la Lista de Exclusión

Puedes agregar o eliminar un seller de la lista de exclusión para controlar su participación en promociones automáticas.

**Importante:**  Mercado Libre no creará ofertas de participación automática para sellers excluidos.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
    https://api.mercadolibre.com/seller-promotions/exclusion-list/seller?app_version=v2
    --data '{
    "exclusion_status": "true"
    }'
```

### Consulta por items

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
    https://api.mercadolibre.com/seller-promotions/exclusion-list/seller/{item_id}?app_version=v2
```

### Gestionar items de la Lista de Exclusión

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
   https://api.mercadolibre.com/seller-promotions/exclusion-list/item?app_version=v2
--data '{
    "item_id": "12345678",
    "exclusion_status": "false"
}'
```

## Asignar campañas de pruebas

Para realizar pruebas con campañas de test, envíanos los datos de tu usuario e ítems en el siguiente **Formulario:** .

- [Formulario](https://docs.google.com/forms/d/e/1FAIpQLSenA_USmZQb8deHLrjhO_Rx1oOqfsj--Rhv-f_L1SebEJRBjA/viewform)

Recuerda que tanto los usuarios como los ítems deben ser de test.

Nota:

Debes agregar el parámetro **version=test**  dentro de las llamadas para interactuar con las promociones de test.

**Next post** : [Campañas co-fondeadas](https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas)
