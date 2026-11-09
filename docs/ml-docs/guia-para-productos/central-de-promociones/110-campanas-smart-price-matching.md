<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/campanas-smart-price-matching -->
<!-- Sección: Guía para productos > Central de promociones -->

# Co-fondeada automatizada y precios competitivos

Última actualización 20/10/2026

## Campañas co-fondeada automatizada y campañas de precios competitivos

Importante:

- **Campos de boost (condicionales)**  NUEVO  Mercado Libre puede aplicar un descuento extra (boost) sobre la oferta base de las campañas **SMART**  y **PRICE_MATCHING** . Si esto ocurre, podés identificarlo a través de los campos **boosted_offer**  (boolean), **discount_meli_boosted_percentage**  (float), **discount_meli_boost_amount**  (number) y **total_price_for_boosted_offer**  (number), presentes únicamente cuando **boosted_offer: true** , en los siguientes endpoints:   Consulta por ítem: [**GET /seller-promotions/items/$ITEM_ID**](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Consultar-promociones-del-item) Consulta por campaña-ítems: **GET /seller-promotions/promotions/$PROMOTION_ID/items**

Los vendedores son invitados de manera periódica a participar en diversas campañas que se realizan en el sitio. En el caso de las **campañas co-fondeadas automatizadas y las de precios competitivos** , Mercado Libre asume un porcentaje del descuento ofrecido. 
 Las campañas co-fondeadas automatizadas funcionan de manera similar a las co-fondeadas tradicionales, pero utilizan un proceso automatizado para seleccionar los ítems que serán invitados a participar. En cuanto a las campañas de precios competitivos, su objetivo es asegurar que los productos alcancen el mejor precio en comparación con otros sitios web y marketplaces. Los candidatos para estas campañas se actualizan diariamente, lo que significa que un ítem puede ser elegible hoy, pero no necesariamente mañana.
 El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused". 
 A partir de ahora, las campañas de precios competitivos ofrecen dos tipos de promociones:

- **PRICE_MATCHING** : El descuento es cofinanciado entre el vendedor y Mercado Libre.

- **PRICE_MATCHING_MELI_ALL** : El descuento es 100% financiado por Mercado Libre, y la participación del vendedor se gestiona automáticamente, sin necesidad de ninguna acción por su parte.

Esta estructura proporciona mayor flexibilidad en la implementación de descuentos, adaptándose a las características de cada campaña. Si el vendedor recibió una invitación y quiere sumarse, puede hacerlo con los siguientes recursos.

### Ofertas Relámpago co-fondeadas (SMART_LIGHTNING)

**SMART_LIGHTNING**  identifica las ofertas Relámpago co-fondeadas automáticas. El precio y los aportes de Mercado Libre y del vendedor están definidos por la campaña. El vendedor elige las unidades que ofrecerá dentro del rango informado para cada candidato; al participar, se mantienen el precio y los aportes propuestos.

Este tipo utiliza los recursos existentes de **seller-promotions** . En las consultas de promociones del vendedor, ítem, candidato y oferta se identifica con **type: "SMART_LIGHTNING"** . En las llamadas que reciben **promotion_type** , utilizá el valor **SMART_LIGHTNING** .

En todas las llamadas, enviá el access token del vendedor en el header **Authorization: Bearer $ACCESS_TOKEN**  y utilizá **app_version=v2** . Los identificadores, las fechas y los estados de los ejemplos son ilustrativos: reemplazalos por los de una campaña vigente y un candidato disponible.

## Consultar detalle de campaña

Nota:

Para estas campañas, las respuestas tienen los mismos campos, cambiando únicamente la información del "type" (SMART, PRICE_MATCHING, PRICE_MATCHING_MELI_ALL o SMART_LIGHTNING).

Para obtener los detalles de una promoción, realiza la siguiente consulta:

Ejemplo de co-fondeada automatizada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB1812010?promotion_type=SMART&app_version=v2'
```

Respuesta de co-fondeada automatizada:

```
{
  "id": "P-MLB1812010",
  "type": "SMART",
  "status": "started",
  "start_date": "2023-04-26T23:00:00Z",
  "finish_date": "2023-05-10T23:59:00Z",
  "deadline_date": "2023-05-10T23:59:00Z",
  "name": "test-smart-2"
}
```

Ejemplo de precios competitivos co-fondeada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB2087012?promotion_type=PRICE_MATCHING&app_version=v2'
```

Respuesta de precios competitivos co-fondeada:

```
{
  "id": "P-MLB2087012",
  "type": "PRICE_MATCHING",
  "status": "pending",
  "start_date": "2023-09-19T18:15:00Z",
  "finish_date": "2023-10-01T05:59:59Z",
  "deadline_date": "2023-10-01T05:59:59Z",
  "name": "Gánale a la competencia con un aporte de Mercado Libre"
}
```

Ejemplo de precios competitivos 100% Mercado Libre:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB35280024?promotion_type=PRICE_MATCHING_MELI_ALL&app_version=v2'
```

Respuesta de precios competitivos 100% Mercado Libre:

```
{
    "id": "P-MLB3528002",
    "type": "PRICE_MATCHING_MELI_ALL",
    "status": "started",
    "start_date": "2024-09-26T15:20:04Z",
    "finish_date": "2024-10-01T15:18:04Z",
    "deadline_date": "2024-10-01T15:18:04Z",
    "name": "100% a cargo de Mercado Libre"
}
```

### Ejemplo de SMART_LIGHTNING: detalle de campaña

**Parámetros:**  el identificador de campaña en la URL es un string obligatorio. En la query, **promotion_type**  (string, obligatorio) debe ser **SMART_LIGHTNING**  y **app_version**  (string, obligatorio) debe ser **v2** .

**Llamada:**

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/seller-promotions/promotions/P-MLA18055092?promotion_type=SMART_LIGHTNING&app_version=v2'
```

**Ejemplo de respuesta:**

```
{
  "id": "P-MLA18055092",
  "type": "SMART_LIGHTNING",
  "status": "started",
  "start_date": "2026-09-10T15:25:00Z",
  "finish_date": "2026-10-18T02:59:00Z",
  "deadline_date": "2026-10-18T02:59:00Z",
  "name": "Relampago compartidas"
}
```

Las fechas de esta respuesta describen la campaña. El horario de cada oferta se asigna automáticamente cuando el vendedor acepta el candidato.

### Campos de la respuesta

- **id** : identificador de la campaña.

- **type** : tipo de campaña (SMART, PRICE_MATCHING, PRICE_MATCHING_MELI_ALL o SMART_LIGHTNING).

- **status** : status de la campaña.

- **start_date** : fecha que empieza la campaña.

- **finish_date** : fecha que se cierra la campaña.

- **deadline_date** : fecha límite para crear la campaña.

- **name** : nombre de la campaña.

## Estados

Estos son los distintos estados por los que puede pasar una campaña co-fondeada automatizada o de precios competitivos.

- **pending** : promoción aprobada que aún no inició.

- **started** : promoción activa.

- **finished** : promoción finalizada.

## Consultar ítems en una campaña

ACTUALIZADO

Para conocer los ítems que forman parte de una campaña puedes realizar la siguiente consulta:

Ejemplo de co-fondeada automatizada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB1812010/items?promotion_type=SMART&app_version=v2'
```

Respuesta de co-fondeada automatizada:

```
{
  "results": [
      {
          "id": "MLB3538191898",
          "status": "started",
          "price": 3245,
          "original_price": 5000,
          "offer_id": "OFFER-MLB3538191898-10000263432",
          "meli_percentage": 8,
          "seller_percentage": 16,
          "start_date": "2026-04-22T01:00:00Z",
          "end_date": "2026-05-22T01:00:00Z",
          "boosted_offer": true,
          "discount_meli_boosted_percentage": 11.1,
          "discount_meli_boost_amount": 555,
          "total_price_for_boosted_offer": 3245
      }
  ],
  "paging": {
      "total": 1,
      "limit": 50
  }
}
```

**Nuevos campos de respuesta**

- **boosted_offer**  (boolean): indica si Mercado Libre está aplicando un descuento adicional a la oferta ya existente.

- **discount_meli_boosted_percentage**  (float): porcentaje adicional de descuento dado por Mercado Libre como parte del boost, a partir del costo del ítem. Independiente de **meli_percentage** .

- **discount_meli_boost_amount**  (number): monto absoluto (en moneda local) del descuento dado por Mercado Libre como parte del boost.

- **total_price_for_boosted_offer**  (number): precio final del ítem una vez aplicados el descuento base y el boost. Es el precio que verá el comprador.

Ejemplo de precios competitivos co-fondeada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB2087012/items?promotion_type=PRICE_MATCHING&app_version=v2'
```

Respuesta de precios competitivos co-fondeada:

```
{
   "results": [
       {
            "id": "MLA2722062952",
            "status": "started",
            "price": 73001,
            "original_price": 76287,
            "offer_id": "OFFER-MLA2722062952-10000265597",
            "meli_percentage": 1.3,
            "seller_percentage": 1.7,
            "start_date": "2026-06-03T01:00:00Z",
            "end_date": "2026-06-10T01:00:00Z",
            "boosted_offer": true,
            "discount_meli_boosted_percentage": 1.3,
            "discount_meli_boost_amount": 999,
            "total_price_for_boosted_offer": 73001
        }
   ],
   "paging": {
       "total": 1,
       "limit": 50
   }
}
```

Ejemplo de precios competitivos 100% Mercado Libre:

Nota:

Para este tipo de campaña, no se visualizará un estado de "candidate", dado que el proceso de activar es ejecutado automáticamente por Mercado Libre. Cuando la campaña es mostrada al vendedor, indica que los ítems ya han sido activados en la campaña de manera automática.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB3528002/items?promotion_type=PRICE_MATCHING_MELI_ALL&app_version=v2'
```

Respuesta de precios competitivos 100% Mercado Libre:

```
{
    "results": [
        {
            "id": "MLB3845318745",
            "status": "started",
            "price": 121.5,
            "original_price": 135,
            "offer_id": "OFFER-MLB3845318745-10000115845",
            "meli_percentage": 10,
            "seller_percentage": 0,
            "start_date": "2024-09-26T15:24:35Z",
            "end_date": "2024-09-28T23:59:59Z"
        }
    ],
    "paging": {
        "total": 1,
        "limit": 50
    }
}
```

### Ejemplo de SMART_LIGHTNING: candidatos y rango de stock

Consultá los candidatos antes de participar para obtener el precio, los aportes y el rango de unidades permitido. El **offer_id**  de un candidato SMART_LIGHTNING se utiliza en el POST de participación.

La URL requiere el identificador de campaña (string). La query requiere **promotion_type=SMART_LIGHTNING**  y **app_version=v2**  (strings). En este ejemplo, los parámetros opcionales **status**  (string) y **limit**  (integer) filtran los candidatos y solicitan hasta 50 resultados.

**Llamada:**

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/seller-promotions/promotions/P-MLA18055092/items?promotion_type=SMART_LIGHTNING&app_version=v2&status=candidate&limit=50'
```

**Ejemplo de respuesta:**

```
{
  "results": [
    {
      "id": "MLA1531516767",
      "status": "candidate",
      "offer_id": "CANDIDATE-MLA1531516767-71633691239",
      "price": 11167.2,
      "original_price": 12000,
      "meli_percentage": 5.2,
      "seller_percentage": 1.7,
      "stock": {
        "min": 1,
        "max": 3
      }
    }
  ],
  "paging": {
    "total": 1,
    "limit": 50
  }
}
```

**stock.min**  y **stock.max**  (integer) definen el mínimo y el máximo de unidades promocionales que pueden ofrecerse para ese candidato, inclusive. Este rango no representa el inventario del ítem. Si el candidato no informa el rango, no puede aceptarse.

El candidato no incluye **start_date**  ni **end_date**  porque todavía no tiene un horario asignado. Esas fechas se devuelven al crear la oferta.

### Consultar unidades promocionales restantes

Una vez creada una oferta SMART_LIGHTNING, la consulta de promociones del ítem informa las unidades promocionales restantes en **stock.remaining_stock**  (integer). Este campo pertenece a la oferta creada; el rango **stock.min** /**stock.max**  pertenece al candidato.

El identificador del ítem en la URL es un string obligatorio. En la query, enviá **app_version=v2**  (string, obligatorio).

**Llamada:**

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/seller-promotions/items/MLA1531516767?app_version=v2'
```

Al crearse una nueva campaña del tipo SMART y PRICE_MATCHING se seleccionan todos los ítems aplicables a la misma. El estado inicial (**status** ) de los ítems es **candidate**  y sin offer id asignado. Al momento que el vendedor incorpora un ítem a la campaña su status se modifica y se le asigna un **offer_id**  único.

## Estado de los ítems

Estos son los posibles estados que pueden tomar los ítems dentro de estos tipos de campañas.

- **candidate** : ítem candidato para participar de la promoción.

- **pending** : ítem con promoción aprobada y programada.

- **started** : ítem activo en la campaña.

- **finished** : ítem eliminado de la campaña.

## Indicar ítems para una campaña

Una vez que has sido invitado a participar en una de estas campañas, puedes indicar qué productos deseas incluir en las mismas. La campaña co-fondeada automatizada puede tener una duración máxima de 30 días, mientras que la de precios competitivos puede tener hasta 10 días.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' \
  -d '{
     "promotion_id":"$PROMOTION_ID",
     "promotion_type":"$PROMOTION_TYPE",
     "offer_id":"$OFFER_ID"
  }' \
  'https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2'
```

Ejemplo de co-fondeada automatizada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' \
  -d '{
    "promotion_id":"P-MLB1812010",
    "promotion_type":"SMART",
    "offer_id":"CANDIDATE-MLB3538191898-25593903"
  }' \
  'https://api.mercadolibre.com/seller-promotions/items/MLB3538191898?app_version=v2'
```

Respuesta de co-fondeada automatizada:

```
{
  "offer_id": "OFFER-MLB3538191898-177685",
  "price": 3000,
  "original_price": 5000
}
```

Ejemplo de precios competitivos:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' \
  -d '{
     "promotion_id": "P-MLB2087012",
     "offer_id": "CANDIDATE-MLB4048719074-70000001705",
     "promotion_type": "PRICE_MATCHING"
  }' \
  'https://api.mercadolibre.com/seller-promotions/items/MLB4048719074?app_version=v2'
```

Respuesta de precios competitivos:

```
{
    "offer_id": "OFFER-MLB4048719074-10000001972",
    "price": 3000,
    "original_price": 5000
 }
 
 
```

### Participar en SMART_LIGHTNING con el stock elegido

Enviá **promotion_id** , el **offer_id**  del candidato, **promotion_type: "SMART_LIGHTNING"**  y **stock** . El stock es obligatorio: debe ser un entero positivo entre **stock.min**  y **stock.max** , inclusive. En el ejemplo anterior se permiten 1, 2 o 3 unidades.

No envíes precio, aportes ni fechas en el body. La campaña conserva los valores propuestos y asigna automáticamente el horario de la oferta. Los límites de duración indicados para SMART y PRICE_MATCHING no deben utilizarse para definir fechas en esta solicitud.

El identificador del ítem en la URL es un string obligatorio. En la query, enviá **app_version=v2**  (string, obligatorio).

**Llamada:**

```
curl -X POST \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "promotion_id": "P-MLA18055092",
  "offer_id": "CANDIDATE-MLA1531516767-71633691239",
  "promotion_type": "SMART_LIGHTNING",
  "stock": 3
}' \
  'https://api.mercadolibre.com/seller-promotions/items/MLA1531516767?app_version=v2'
```

**Ejemplo de respuesta:**

```
{
  "offer_id": "OFFER-MLA1531516767-71633691239",
  "price": 11167.2,
  "original_price": 12000,
  "start_date": "2026-09-11T18:00:00",
  "end_date": "2026-09-11T19:00:00"
}
```

Guardá el **offer_id**  de la oferta creada: es el identificador que debés usar para consultarla o eliminarla. **start_date**  y **end_date**  indican el horario asignado por Mercado Libre y se reciben en la respuesta, no en el body de la solicitud.

### Parámetros

- **promotion_id**  (string): identificador de la promoción. Obligatorio.

- **promotion_type**  (string): tipo de promoción. Obligatorio. Valores posibles: **SMART** , **PRICE_MATCHING**  o **SMART_LIGHTNING** .

- **offer_id**  (string): identificador de la oferta candidata. Obligatorio.

- **stock**  (integer): obligatorio para **SMART_LIGHTNING** . Cantidad positiva de unidades promocionales elegida por el vendedor dentro del rango **stock.min** /**stock.max**  del candidato, inclusive.

## Eliminar campaña

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=$PROMOTION_TYPE&promotion_id=$PROMOTION_ID&offer_id=$OFFER_ID'
```

Ejemplo de co-fondeada automatizada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/items/MLB3538191898?promotion_type=SMART&promotion_id=P-MLB1812010&offer_id=OFFER-MLB3538191898-177685&app_version=v2'
```

Respuesta: **Status 200 OK**

Ejemplo de precios competitivos co-fondeada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/items/MLB4048719074?promotion_type=PRICE_MATCHING&promotion_id=P-MLB2087012&offer_id=OFFER-MLB4048719074-10000001972&app_version=v2'
```

Respuesta: **Status 200 OK**

Ejemplo de precios competitivos 100% Mercado Libre:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/items/MLA1387793467?promotion_type=PRICE_MATCHING_MELI_ALL&promotion_id=P-MLA2072013&offer_id=OFFER-MLA1387793467-1000000151&app_version=v2'
```

Respuesta: **Status 200 OK**

### Eliminar una oferta SMART_LIGHTNING antes del inicio

La oferta sólo puede eliminarse mientras su estado es **pending** . Enviá **promotion_id** , **promotion_type=SMART_LIGHTNING**  y el **offer_id**  devuelto por el POST de participación; no utilices el identificador del candidato.

El identificador del ítem en la URL es un string obligatorio. Los parámetros de query **promotion_id** , **promotion_type** , **offer_id**  y **app_version**  son strings obligatorios; utilizá **SMART_LIGHTNING**  y **v2**  en los dos campos correspondientes.

**Llamada:**

```
curl -X DELETE \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/seller-promotions/items/MLA1531516767?app_version=v2&promotion_type=SMART_LIGHTNING&promotion_id=P-MLA18055092&offer_id=OFFER-MLA1531516767-71633691239'
```

Respuesta para una oferta **pending** : **HTTP 200 OK** , sin body. Si la oferta ya está **started** , la API devuelve **HTTP 400 Bad Request**  y la eliminación no está permitida.

### Errores específicos de SMART_LIGHTNING

- **HTTP 400 por stock fuera del rango o por rango no disponible:**  consultá nuevamente el candidato y elegí un stock válido. Si no se informa el rango, no intentes aceptar el candidato.

- **HTTP 400 al eliminar una oferta started:**  sólo se permite la eliminación antes del inicio, cuando la oferta está **pending** .

- **HTTP 400 con PROMOTION_STATUS_OPT_IN - finished al participar:**  la campaña ya finalizó. Consultá las campañas del vendedor y seleccioná una campaña vigente antes de volver a intentar.
