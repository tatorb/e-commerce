<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mas-vendidos-en-mercado-libre -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Más vendidos en Mercado Libre

Última actualización 22/06/2026

## Más vendidos en Mercado Libre

Consulta el listado de los 20 productos más vendidos en Mercado Libre usando el recurso **/highlights** . Puedes filtrar por [categoría](https://developers.mercadolibre.com.ar/categoriza-productos), marca, [producto](https://developers.mercadolibre.com.ar/buscador-de-productos#Producto-por-ID) y/o [ítem](https://developers.mercadolibre.com.ar/items-y-busquedas#Multiget).

## Más vendidos por categoría

Consulta el top 20 de ítems/productos de una categoría específica.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/$SITE_ID/category/$CATEGORY_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/MLB/category/MLB432825
```

Respuesta:

```
{
    "query_data": {
        "highlight_type": "BEST_SELLER",
        "criteria": "CATEGORY",
        "id": "MLB432825"
    },
    "content": [
        {
            "id": "MLBU3013800008",
            "position": 1,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLBU3981133472",
            "position": 2,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLBU4039073621",
            "position": 3,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLBU3021966048",
            "position": 4,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLBU3969242429",
            "position": 5,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLB24162817",
            "position": 6,
            "type": "PRODUCT"
        },
        {
            "id": "MLBU4035041691",
            "position": 7,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLB47622621",
            "position": 8,
            "type": "PRODUCT"
        },
        {
            "id": "MLBU3981122876",
            "position": 9,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLB24723692",
            "position": 10,
            "type": "PRODUCT"
        },
        {
            "id": "MLB70334862",
            "position": 11,
            "type": "PRODUCT"
        },
        {
            "id": "MLBU670601037",
            "position": 12,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLBU3986388996",
            "position": 13,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLBU1966388133",
            "position": 14,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLBU3440726552",
            "position": 15,
            "type": "USER_PRODUCT"
        },
        {
            "id": "MLB6868664726",
            "position": 16,
            "type": "ITEM"
        },
        {
            "id": "MLB61695785",
            "position": 17,
            "type": "PRODUCT"
        },
        {
            "id": "MLB70659272",
            "position": 18,
            "type": "PRODUCT"
        },
        {
            "id": "MLB41966415",
            "position": 19,
            "type": "PRODUCT"
        },
        {
            "id": "MLB2064796357",
            "position": 20,
            "type": "PRODUCT"
        }
    ]
}
```

### Campos de la respuesta

- **query_data** : información sobre el filtro aplicado en la consulta.

- **highlight_type** : tipo de ranking. Valor fijo: **BEST_SELLER** . **criteria** : criterio utilizado. Valor: **CATEGORY** . **id** : ID de la categoría consultada.

- **content** : lista de hasta 20 elementos más vendidos.

- **id** : identificador del elemento. El prefijo varía según el tipo (MLB, MLA, MLBU, etc.). **position** : posición dentro del ranking (1 = más vendido). **type** : tipo de elemento. Valores posibles:  **ITEM** : publicación individual sin catálogo asociado. **PRODUCT** : producto del catálogo oficial de Mercado Libre. **USER_PRODUCT** : producto creado por un vendedor (catálogo de usuario). El ID tiene el prefijo **MLBU** .

Note:

El listado puede contener una mezcla de los tres tipos (**ITEM** , **PRODUCT** , **USER_PRODUCT** ) en función de los productos más vendidos en la categoría.

## Más vendidos por categoría y atributo marca

Obtén el Top 20 de ítems/productos de una marca específica dentro de una categoría. Usa los parámetros **attribute**  y **attributeValue**  para filtrar por cualquier atributo soportado.

### Query parameters

- **attribute**  (requerido): nombre del atributo por el que se filtra. Ejemplo: **BRAND** .

- **attributeValue**  (requerido): ID del valor del atributo. Ejemplo: **59387** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/$SITE_ID/category/$CATEGORY_ID?attribute=BRAND&attributeValue=$BRAND_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/MLA/category/MLA1055?attribute=BRAND&attributeValue=59387
```

Respuesta:

```
{
    "query_data": {
        "highlight_type": "BEST_SELLER",
        "criteria": "CATEGORY",
        "id": "MLA1055"
    },
    "content": [
        {
            "id": "MLA55323897",
            "position": 1,
            "type": "PRODUCT"
        },
        {
            "id": "MLA65759096",
            "position": 2,
            "type": "PRODUCT"
        },
        {
            "id": "MLA45818964",
            "position": 3,
            "type": "PRODUCT"
        },
        {
            "id": "MLA46219511",
            "position": 4,
            "type": "PRODUCT"
        }
    ]
}
```

Note:

Cuando se aplica el filtro por atributo, el resultado puede contener **menos de 20 elementos**  si la marca no tiene suficientes productos en el ranking de la categoría.

## Posicionamiento del producto

Consulta en qué posición se encuentra un producto dentro del ranking de más vendidos, y en qué categoría o dimensión está rankeado.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/$SITE_ID/product/$PRODUCT_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/MLA/product/MLA55323897
```

Respuesta:

```
{
    "dimension": "attributes",
    "id": "MLA1055-BRAND-59387",
    "label": "Celulares y Smartphones Xiaomi",
    "position": 1
}
```

### Campos de la respuesta

- **dimension** : criterio por el que el producto fue rankeado. Valores posibles:  **category** : el producto está en el top de una categoría. **attributes** : el producto está en el top de una categoría filtrada por atributo (p. ej. marca).

- **id** : identificador de la dimensión.  Si **dimension = category** : ID de la categoría (ej. **MLA1055** ). Si **dimension = attributes** : ID compuesto con formato **{CATEGORY_ID}-{ATTRIBUTE}-{VALUE_ID}**  (ej. **MLA1055-BRAND-59387** ).

- **label** : nombre descriptivo de la dimensión (ej. nombre de la categoría o categoría + marca).

- **position** : posición del producto dentro del ranking de esa dimensión.

## Posicionamiento del ítem

Consulta en qué posición se encuentra una publicación (ítem) dentro del ranking de más vendidos.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/$SITE_ID/item/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/highlights/MLB/item/MLB6868664726
```

Respuesta:

```
{
    "dimension": "category",
    "id": "MLB270287",
    "label": "Geladeiras",
    "position": 12
}
```

### Campos de la respuesta

- **dimension** : criterio por el que el ítem fue rankeado. Valor: **category** .

- **id** : ID de la categoría donde el ítem está rankeado.

- **label** : nombre de la categoría.

- **position** : posición del ítem dentro del ranking de esa categoría.

## Errores

| Código | Mensaje | Causa | Solución |
| --- | --- | --- | --- |
| 400 | Error site: ML | El **site_id**  enviado no es válido. | Usa un **site_id**  válido (MLA, MLB, MLM, MCO, MLC, etc.). |
| 400 | Invalid product id MLB | El **product_id**  o **item_id**  no es válido o no pertenece al site indicado. | Verifica que el ID sea correcto y corresponda al **site_id**  de la URL. |
| 401 | unspecified_token | No se envió el access token o tiene un formato incorrecto. | Incluye el header **Authorization: Bearer $ACCESS_TOKEN**  con un token válido. |
| 404 | item/product with id {id} not found | El ítem o producto existe pero no aparece en ningún ranking de más vendidos. | Solo se puede consultar la posición de ítems/productos que estén en el top 20 de alguna categoría. |
| 404 | Dimension CATEGORY with id {id} not found | La categoría no tiene un listado de más vendidos disponible. | Verifica que la categoría sea una hoja del árbol de categorías (categoría sin subcategorías). |
