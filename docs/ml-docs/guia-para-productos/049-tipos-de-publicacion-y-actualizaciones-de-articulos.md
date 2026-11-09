<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos -->
<!-- Sección: Guía para productos -->

# Tipos de publicación

Última actualización 01/06/2026

## Tipos de publicación

De acuerdo con el nivel de exposición que desees para tus artículos, podrás elegir entre diferentes tipos de publicación. Cada tipo de publicación tiene sus propias características y feeds. Veamos cómo trabajar correctamente con ellos.

Nota:

- Recuerda que los tipos de publicación o listing_type disponibles para Marketplace son free, gold_special, gold_pro (puede variar según el site). 
 - Conoce más sobre los [costos por vender](https://developers.mercadolibre.com.ar/es_ar/comision-por-vender)para un listing_type particular por site, categoría, moneda, logística y más.

## Ahora tus publicaciones se diferencian por las cuotas que agregues

Importante:

Esta funcionalidad aplica solo al site de Argentina.

Para que puedas identificar de una manera más clara qué ofrecen tus publicaciones, **dejamos de llamarlas Clásica o Premium**  (aplica sólo a nivel de frontend, a nivel backend seguiremos usando los listing_type gold_special y gold_pro) y podés diferenciarlas así:

- **Publicaciones en las que elegís no agregar cuotas**    Aplican a las publicaciones **gold_special** , sólo tienen las cuotas con interés que ofrecen los bancos. Por eso pagás solo el cargo por vender y, si aplica, también el costo fijo.

- **Publicaciones en las que elegís agregar cuotas**    En las publicaciones **gold_pro** , al ofrecer cuotas más convenientes a los compradores, pagás el cargo por vender más un costo por ofrecer cuotas, y el costo fijo si aplica.

[Conocer más sobre costos y comisiones](https://www.mercadolibre.com.ar/ayuda/31519).

Ten en cuenta la **relación entre el listing_type**  (atributo requerido) **y los tags de campañas** . Conoce más sobre [Campañas con cuotas para Marketplace](https://developers.mercadolibre.com.ar/es_ar/campanas-con-cuotas-para-marketplace#:~:text=Mercado%20Libre%20.-,Comparaci%C3%B3n%20opciones%20de%20cuotas,-Publicaciones%20en%20las).

## Tipos de publicación por site

Conoce los diferentes tipos de publicación **por sitio**  de Mercado Libre. Para conocer los ID disponibles, ejecuta la siguiente llamada.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/listing_types
```

Ejemplo site MLA:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_types
```

Respuesta:

```
[
    {
        "site_id": "MLA",
        "id": "gold_pro",
        "name": "Premium"
    },
    {
        "site_id": "MLA",
        "id": "gold_premium",
        "name": "Oro Premium"
    },
    {
        "site_id": "MLA",
        "id": "gold_special",
        "name": "Clásica"
    },
    {
        "site_id": "MLA",
        "id": "gold",
        "name": "Oro"
    },
    {
        "site_id": "MLA",
        "id": "silver",
        "name": "Plata"
    },
    {
        "site_id": "MLA",
        "id": "bronze",
        "name": "Bronce"
    },
    {
        "site_id": "MLA",
        "id": "free",
        "name": "Gratuita"
    }
]
```

## Especificación del tipo de publicación

Si deseas más información sobre un listing_type específico por site, incluye el ID en la llamada:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/listing_types/$LISTING_TYPE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_types/gold_special
```

Respuesta:

```
{
  "id": "gold_special",
  "not_available_in_categories": [
    "MLA1743",
    "MLA1459",
    "MLA1540"
  ],
  "configuration": {
    "name": "Clásica",
    "listing_exposure": "highest",
    "requires_picture": true,
    "max_stock_per_item": 99999,
    "deduction_profile_id": null,
    "differential_pricing_id": null,
    "duration_days": {
      "buy_it_now": 7300,
      "auction": null,
      "classified": null
    },
    "immediate_payment": {
      "buy_it_now": false,
      "auction": false,
      "classified": false
    },
    "mercado_pago": "mandatory",
    "listing_fee_criteria": {
      "min_fee_amount": 0,
      "max_fee_amount": 0,
      "percentage_of_fee_amount": 0,
      "currency": "ARS"
    },
    "sale_fee_criteria": {
      "min_fee_amount": 0,
      "max_fee_amount": 750000,
      "percentage_of_fee_amount": 13,
      "currency": "ARS"
    }
  },
  "exceptions_by_category": []
}
```

Las publicaciones gold_special y gold_pro tendrán una duración ilimitada; puedes consultarlo en /items, filtrando por el atributo stop_time:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$TIEM_ID?attributes=stop_time
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1389403099?attributes=stop_time
```

Recuerda que las publicaciones serán pausadas si el stock está en 0 y se activarán cuando agregues una nueva cantidad. Conoce más sobre cómo [Actualizar el stock](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones#Actualiza-el-stock:~:text=Stock%20de%20%C3%ADtems-,Actualizar%20el%20stock,-Para%20actualizar%20el) de tus publicaciones.

## Tipos de publicación disponibles

Puedes consultar los tipos de publicación disponibles para uno usuario y categoría determinada.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/available_listing_types?category_id=$CATEGORY_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/1234/available_listing_types?category_id=MLA1055
```

Respuesta:

```
{
  "category_id": "MLA1055",
  "available": [
    {
      "site_id": "MLA",
      "id": "gold_pro",
      "name": "Premium",
      "remaining_listings": null
    },
    {
      "site_id": "MLA",
      "id": "gold_special",
      "name": "Clásica",
      "remaining_listings": null
    },
    {
      "site_id": "MLA",
      "id": "free",
      "name": "Gratuita",
      "remaining_listings": 10
    }
  ]
}
```

Si no puedes publicar en cierto tipo de publicación y quieres saber por qué no está disponible para ti, puedes realizar un GET para averiguar el motivo:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/available_listing_type/free?category_id=$CATEGORY_ID
```

Respuesta:

```
{
  "available": false,
  "cause": "You have more than 5 transactions in the last year.",
  "code": "list.transactions.exceeded"
}
```

## Exposiciones de las publicaciones

Podrás consultar la información sobre los niveles de exposición asociados a todos los tipos de publicaciones en Mercado Libre por site.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/listing_exposures
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_exposures
```

Respuesta:

```
[
  {
    "id": "lowest",
    "name": "Última",
    "home_page": false,
    "category_home_page": false,
    "advertising_on_listing_page": true,
    "priority_in_search": 4
  },
  {
    "id": "low",
    "name": "Inferior",
    "home_page": false,
    "category_home_page": false,
    "advertising_on_listing_page": false,
    "priority_in_search": 3
  },
  {
    "id": "mid",
    "name": "Media",
    "home_page": false,
    "category_home_page": true,
    "advertising_on_listing_page": false,
    "priority_in_search": 2
  },
  {
    "id": "high",
    "name": "Alta",
    "home_page": false,
    "category_home_page": true,
    "advertising_on_listing_page": false,
    "priority_in_search": 1
  },
  {
    "id": "highest",
    "name": "Superior",
    "home_page": true,
    "category_home_page": true,
    "advertising_on_listing_page": false,
    "priority_in_search": 0
  }
]
```

También puedes consultar cada nivel de exposición por separado con su respectivo ID.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/listing_exposures/$EXPOSURE_LEVEL
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_exposures/high
```

Respuesta:

```
{
  "id": "high",
  "name": "Alta",
  "home_page": false,
  "category_home_page": true,
  "advertising_on_listing_page": false,
  "priority_in_search": 1
}
```

## Transacciones disponibles para una publicación

Puedes consultar los tipos de listing_type disponibles para una publicación específica, puede variar según el site.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/available_listing_types
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1389403099/available_listing_types
```

Respuesta:

```
[
  {
    "site_id": "MLA",
    "id": "gold_pro",
    "name": "Premium"
  },
  {
    "site_id": "MLA",
    "id": "gold_premium",
    "name": "Oro Premium"
  }
]
```

## Upgrades disponibles para una publicación

Puedes realizar una actualización a un tipo de publicación superior (upgrade). Si necesitas realizar una actualización, puedes ver qué tipos de publicaciones están disponibles para tu artículo, puede variar según el site. En caso de no encontrarse upgrades disponibles, devuelve una lista vacía.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/available_upgrades
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1389403099/available_upgrades
```

Respuesta:

```
[
  {
    "site_id": "MLA",
    "id": "gold_pro",
    "name": "Premium"
  }
]
```

## Downgrades disponibles para una publicación

Downgrade es reducir la exposición de tu publicación al actualizarlo a un tipo inferior. Está disponible para algunos casos particulares:

- Está permitido realizar downgrades en las publicaciones entre gold_pro a gold_special y viceversa en cualquier momento (depende del site).

- Puedes realizar downgrade de una publicación con status PAYMENT_REQUIED. Además, en MLA también puedes hacer downgrade de publicaciones con status ACTIVE, NOT_YET_ACTIVE, UNDER_REVIEW y PAUSED.

- No está permitido realizar el downgrade de una publicación a gratis.

- En caso de no encontrarse downgrades disponibles, devuelve una lista vacía.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/available_downgrades
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1389403099/available_downgrades
```

Respuesta:

```
 [ ]
```

## Actualizar tipo de publicación

Recuerda que puedes **cambiar entre los tipos de publicación gold_special y gold_pro**  (depende del site) cada vez que lo desees **sin cargo** .
 Si deseas actualizar el listing_type de una publicación, debes realizar un POST al siguiente recurso:

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "id": "gold_special"
}
https://api.mercadolibre.com/items/$TIEM_ID/listing_type
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "id": "gold_special"
}
https://api.mercadolibre.com/items/MLA1389403099/listing_type
```

Respuesta:

```
{
  "id": "MLA1389403099",
  "site_id": "MLA",
  "title": " Moto Z3 Play 64 Gb  Índigo Oscuro 4 Gb Ram",
  "subtitle": null,
  "seller_id": 1160561786,
  "category_id": "MLA1055",
  "user_product_id": "MLAU10645855",
  "official_store_id": null,
  "price": 18008976,
  "base_price": 18008976,
  "original_price": null,
  "inventory_id": null,
  "currency_id": "ARS",
  "initial_quantity": 6,
  "available_quantity": 6,
  "sold_quantity": 0,
  "sale_terms": []
  "buying_mode": "buy_it_now",
  "listing_type_id": "gold_special"
[...]
}
```

¡Eso es! Ahora estás listo para acceder a la exposición correcta para tus productos y realizar actualizaciones de artículos. Como sabemos que a veces necesitas más de un intento para realizar tu publicación, te ofrecemos la posibilidad de consultar si tu publicación quedó exactamente cómo la querías antes de publicarla. Consulta más sobre [el validador de publicaciones](https://developers.mercadolibre.com.ar/es_ar/validador-de-publicaciones).

**Conoce más sobre:**

- [Campañas con cuotas para Marketplace](https://developers.mercadolibre.com.ar/es_ar/campanas-con-cuotas-para-marketplace) (aplica solo a MLA).

- [Costos por vender](https://developers.mercadolibre.com.ar/es_ar/comision-por-vender).
