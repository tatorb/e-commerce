<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/referencias-de-precios -->
<!-- Sección: Guía para productos > Precios y Costos -->

# Referencias de precios

Última actualización 17/12/2025

## Gestionar referencias de precios

Las referencias de precios en Mercado Libre es una recomendación que ofrece la plataforma para ayudar a los vendedores a establecer un precio competitivo para sus productos. Esta referencia se basa en un análisis de los precios actuales de artículos similares en la plataforma y plataformas externas, el historial de ventas y la demanda del producto. El objetivo es guiar al vendedor para que fije un precio que sea atractivo para los compradores, incrementando así las posibilidades de venta y mejorando su posicionamiento en los resultados de búsqueda.

## Obtener items con referencias de precios por vendedor

Devuelve un listado de **items_id**  que tengan referencias de precios para un **seller_id**  específico.

### Pre condiciones para obtener referencias de precios por vendedor

- Debe consultarse sobre un usuario existente

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/suggestions/user/$USER_ID/items
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/suggestions/user/12345678/items
```

**Respuesta:**

```
{
    "total": 3,
    "items": [
        "MLM2098685855",
        "MLM3092970874",
        "MLM2081093293"
    ]
}
```

**Campos de la respuesta:**

La respuesta de un GET al recurso **suggestions/user/$USER_ID/items**  proporcionará los siguientes parámetros

- **total:**  Cantidad total de ítems con referencias

- **items:**  Lista de IDs de ítems con referencias.

## Obtener detalle de la referencia de precios por item_id

Para consultar el precio e referencia para asignarle a un ítem específico, es necesario realizar un GET al recurso **/suggestions/items/{itemId}/details**

### Pre condiciones para obtener referencias de precios

- Debe consultarse sobre un ítem existente

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/suggestions/items/$ITEM_ID/details
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/suggestions/items/MLA12345678/details
```

**Respuesta:**

```
{
    "item_id": "MLM2077308861",
    "status": "with_benchmark_highest",
    "currency_id": "MXN",
    "ratio": 0,
    "current_price": {
        "amount": 150000,
        "usd_amount": 0
    },
    "suggested_price": {
        "amount": 230,
        "usd_amount": 0
    },
    "lowest_price": {
        "amount": 230,
        "usd_amount": 0
     },
    "internal_price": {
        "amount": 230,
        "usd_amount": 0
    },
    "costs": {
        "selling_fees": 67.5,
        "shipping_fees": 73
    },
    "applicable_suggestion": false,
    "percent_difference": 100,
    "metadata": {
        "graph": [
            {
                "price": {
                    "amount": 50000,
                    "usd_amount": 0
                },
                "info": {
                    "title": "Mate De Test No Ofertar",
                    "sold_quantity": 0
                }
            }
        ],
        "compared_values": 1
    },
    "promotion_detail": {
        "unhealthy_reason": "no_sales",
        "days_unhealthy": 30,
        "campaign_start_date": "2024-06-16",
        "campaign_end_date": "2024-07-20",
        "promotion_id": "P-MLC13857010",
        "discount_percent": 30,
        "campaign_name": "UNHEALTHY_STOCK"
    },
    "last_updated": "01-08-2024 11:30:07"
}
```

### Campos de la respuesta

La respuesta de un GET al recurso **/suggestions/items/$ITEM_ID/details**  proporcionará los siguientes parámetros:

- **item_id** : Identificador del ítem

- **status** : Estado de la referencia de precios en relación con el benchmark de competencia. Las posibles referencias de precio son:  with_benchmark_highest: Si el precio actual del ítem es más alto que el precio de referencia y el máximo precio de sus vecinos **with_benchmark_high**  : Si el precio actual del **ítem**  es alto respecto al de referencia **no_benchmark_ok** : Si el precio actual del ítem es igual al de referencia **no_benchmark_lowest** : Si el precio actual del ítem está por debajo del de referencia  En el caso de que la referencia ganadora sea del tipo Markdown, el precio de la referencia pasa a los estados:  **not_optin_applied** : Si no se ha aplicado la promoción **promotion_scheduled** : Si la promoción fue **optineada**  pero todavía no llegó la fecha de la promoción **promotion_active** : Si la promoción fue **optineada**  y está dentro de las fechas donde se aplica la promoción

- La mayoría de nuestras referencias están basadas en competencias de precios. Es decir, precio de referencia en base a competidores, internos o externos.

- 

- **Nota:**  Este es el único caso en el que se utiliza una estrategia de referencia basada en una campaña promocional de tipo **unhealthy** . Su objetivo es incentivar que el vendedor active una campaña en aquellos ítems que llevan un tiempo prolongado sin ventas. Al crearse la campaña, se vincula automáticamente a una oportunidad de ajuste de precio, lo que genera una referencia del tipo **markdown** .

- 

- **currency_id** : Identificador de la moneda en la que se expresan los precios

- **ratio** : Relación entre el precio actual y el precio de referencia

- **current_price** : Precio actual del ítem.  **amount** : Monto en la moneda local. **usd_amount** : Monto en dólares estadounidenses.

- **suggested_price** : Precio de referencia comparando con la competencia.  **suggested_price_amount** : Monto de referencia en la moneda local. **usd_amount** : Monto de referencia en dólares estadounidenses.

- **lowest_price** : Precio mínimo existente en este ítem  **amount** : Precio expresado en moneda local **usd_amount** : Precio expresado en dólares

- **internal_price** : Precio de referencia comparado internamente en Mercado Libre  **amount** : Monto de referencia en la moneda local **usd_amount** : Monto de referencia en dólares estadounidenses.

- **costs** : Costos relacionados con la venta del ítem  **selling_fees** : Costos por la venta del ítem. **shipping_fees** : Costos por el envío del ítem.

- **applicable_suggestion** : Si la referencia de precio es aplicable para este ítem o no.

- **percent_difference** : Porcentaje de diferencia entre el precio actual y el de referencia.

- **metadata** :  **graph** : Lista de objetos que contienen detalles de ítems similares para comparar. **price** : Precio del ítem similar.  **amount** : Precio en la moneda local. **usd_amount** : Precio convertido a dólares estadounidenses.

- **info** :  **title** : Nombre de la publicación **sold_quantity** : Cantidad vendida del ítem

- **compared_values** : Cantidad de valores comparados.

**last_updated** : Fecha de la última referencia de precio.

## Posibles errores al consultar referencias de precios de un ítem

Al consultar la referencia de precios de un ítem, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

**El item no pertenece al seller:**

```
{
    "message": "Caller is not the item's owner",
    "error": "",
    "status": 401,
    "cause": []
}
```

**No autorizado:**

```
{
    "code": "unauthorized",
    "message": "invalid access token"
}
```

**Item consultado no cuenta con referencias:**

```
{
    "message": "item price suggestion not found, item id: [MLM2890672004], error: [kvs: key not found]",
    "error": "",
    "status": 404,
    "cause": []
}
```

Siguiente: [Automatizaciones de precios](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#Gestionar-automatizaciones)
