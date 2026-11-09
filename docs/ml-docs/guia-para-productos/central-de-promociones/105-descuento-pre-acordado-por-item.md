<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/descuento-pre-acordado-por-item -->
<!-- Sección: Guía para productos > Central de promociones -->

# Pre-acordado por ítem y liquidación stock Full

Última actualización 09/06/2026

## Descuento pre-acordado por ítem y Campaña de liquidación stock Full

Importante:

- Estas campañas se encuentran en la misma documentación porque trabajan con la misma lógica y los mismos parámetros.

- 

- **Campos de boost (condicionales)**  NUEVO  Mercado Libre puede aplicar un descuento extra (boost) sobre la oferta base de las campañas **PRE_NEGOTIATED** . Si esto ocurre, podés identificarlo a través de los campos **boosted_offer** , **discount_meli_boosted_percentage** , **discount_meli_boost_amount**  y **total_price_for_boosted_offer** , presentes únicamente cuando **boosted_offer: true** , en los siguientes endpoints:   Consulta por ítem: [**/seller-promotions/items/$ITEM_ID**](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Consultar-promociones-del-item) Consulta por campaña-ítems: **/seller-promotions/promotions/$PROMOTION_ID/items**

Los vendedores son invitados periódicamente a participar de diferentes campañas que se realizan en el sitio. 
 **Descuento pre-acordado por ítem** : En este tipo de campaña el vendedor pre-acuerda un descuento para determinados ítems con un agente comercial de Mercado Libre, donde se establece el precio, el descuento ofrecido y el beneficio otorgado.
 **Campaña de liquidación stock Full** : Este tipo de campaña es muy similar a la campaña de descuento pre-acordado por ítem, pero con la diferencia que es solo para ítems de full. 
 Si el vendedor recibió una invitación y quiere sumarse, puede hacerlo con los siguientes recursos.

El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused".

**Vista del vendedor**

## Consultar detalles de una campaña

Ejemplo de descuento pre-acordado:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/P-MLM394001?promotion_type=PRE_NEGOTIATED&app_version=v2
```

Respuesta de descuento pre-acordado:

```
{
   "id": "P-MLM394001",
   "type": "PRE_NEGOTIATED",
   "status": "started",
   "start_date": "2021-03-30T18:30:15.525Z",
   "finish_date": "2021-12-27T17:59:59.525Z",
   "deadline_date": "2021-05-27T17:59:59.525Z",
   "name": "Prueba descuento x item sin benefit",
   "offers": [
       {
           "id": "MLM848619385-f588cf87-e298-498e-82ad-285b16dd11d5",
           "original_price": 101,
           "new_price": 21,
           "status": "active",
           "start_date": "2021-05-10T16:00:00Z",
           "end_date": "2021-05-11T15:00:00Z",
           "benefits": {
               "type": "REBATE",
               "meli_percent": 9.9,
               "seller_percent": 69.3
           }
       }
   ]
}
```

Ejemplo de liquidación stock Full:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB12345?promotion_type=PRE_NEGOTIATED&app_version=v2'
```

Respuesta de liquidación stock Full:

```
{
  "id": "P-MLB12345",
  "type": "UNHEALTHY_STOCK",
  "status": "started",
  "start_date": "2023-08-30T18:30:15.525Z",
  "finish_date": "2023-12-27T17:59:59.525Z",
  "deadline_date": "2023-09-27T17:59:59.525Z",
  "name": "Prueba liquidación stock Full",
  "offers": [
      {
          "id": "MLB10203040-f588cf87-e298-498e-82ad-285b16dd11d5",
          "original_price": 101,
          "new_price": 21,
          "status": "active",
          "start_date": "2023-09-10T16:00:00Z",
          "end_date": "2021-09-11T15:00:00Z",
          "benefits": {
              "type": "REBATE",
              "meli_percent": 9.9,
              "seller_percent": 69.3
          }
      }
  ]
}
```

**Campos específicos de estas campañas**

**Offers** : detalle del descuento pre-acordado.

**id** : id de la oferta

**original_price** : precio original del ítem

**new_price** : precio final del ítem

**status** : estado del ítem en la promoción

**start_date** : fecha de inicio de la oferta en la promoción

**end_date** : fecha de fin de la oferta en la promoción

**Benefits** : detalle de los beneficios de la promoción.

- **type** : tipo de beneficio.  **meli_percent** : porcentaje que aporta Mercado Libre.  **seller_percent** : porcentaje que aporta el vendedor.

## Estados de las campañas

Estos son los distintos estados por los cuales las campañas pueden pasar.

- **pending** : aprobada que aún no inició.

- **started** : activa.

- **finished** : finalizada.

## Consultar ítems en una campaña

ACTUALIZADO

Para conocer los ítems que forman parte de una campaña puedes realizar la siguiente consulta:

Ejemplo de descuento pre-acordado:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/P-MLM394001/items?promotion_type=PRE_NEGOTIATED&app_version=v2
```

Respuesta de descuento pre-acordado:

```
{
   "results": [
       {
            "id": "MLA1658866847",
            "status": "started",
            "price": 2148665,
            "original_price": 2191665,
            "offer_id": "OFFER-MLA1658866847-10000265507",
            "meli_percentage": 0.5,
            "seller_percentage": 1,
            "start_date": "2026-06-01T01:00:00Z",
            "end_date": "2026-06-08T01:00:00Z",
            "boosted_offer": true,
            "discount_meli_boosted_percentage": 0.5,
            "discount_meli_boost_amount": 10000,
            "total_price_for_boosted_offer": 2148665
        }
   ],
   "paging": {
       "total": 1
   }
}
```

**Nuevos campos de respuesta**

- **boosted_offer** : indica si Mercado Libre está aplicando un descuento adicional a la oferta ya existente.

- **discount_meli_boosted_percentage** : porcentaje adicional de descuento dado por Mercado Libre como parte del boost, a partir del costo del ítem. Independiente de **meli_percentage** .

- **discount_meli_boost_amount** : monto absoluto (en moneda local) del descuento dado por Mercado Libre como parte del boost a partir del costo del ítem.

- **total_price_for_boosted_offer** : precio final del ítem una vez aplicados el descuento base de la promoción y el boost. Es el precio que verá el comprador.

Ejemplo de liquidación stock Full:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/P-MLB12345/items?promotion_type=UNHEALTHY_STOCK&app_version=v2'
```

Respuesta de liquidación stock Full:

```
{
  "results": [
      {
          "id": "MLB10203040",
          "status": "candidate",
          "price": 21,
          "original_price": 101,
          "offer_id": "MLB10203040-0e2f3064-0e13-425d-b4a7-0dee85414835",
          "meli_percentage": 24.8,
          "seller_percentage": 54.5,
          "start_date": "2023-09-11T22:00:00Z",
          "end_date": "2023-09-13T01:00:00Z"
      }
  ],
  "paging": {
      "total": 1
  }
}
```

Al crearse una nueva campaña se seleccionan todos los ítems aplicables a la misma. El estado inicial (**status** ) de los ítems es **candidate**  y cuentan con un **offer_id**  único. Al momento que el vendedor incorpora un ítem a la campaña su status se modifica y pasa a estar **programmed**  o **active** .

## Estado de los ítems

En la siguiente tabla puedes encontrar los posibles estados que pueden tomar los ítems dentro de estos tipos de campañas.

| Estado | Descripción |
| --- | --- |
| **candidate** | Candidato para participar de la promoción. |
| **pending** | Promoción aprobada y programada. |
| **started** | Activo en la campaña. |
| **finished** | Eliminado de la campaña. |

## Aceptar descuento

Una vez que se ha acordado un descuento para un ítem, con el siguiente recurso se puede dar la confirmación por parte del vendedor.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
   "promotion_id":"$PROMOTION_ID",
   "offer_id":"$OFFER_ID",
   "promotion_type":"$PROMOTION_TYPE"
}'
https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID
```

Ejemplo de descuento pre-acordado:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
   "promotion_id":"P-MLM394001",
   "offer_id":"MLM848619385-f588cf87-e298-498e-82ad-285b16dd11d5",
   "promotion_type":"PRE_NEGOTIATED"
}'
https://api.mercadolibre.com/seller-promotions/items/MLM848619385
```

Respuesta de descuento pre-acordado:

```
{
   "offer_id": "MLM848619385-f588cf87-e298-498e-82ad-285b16dd11d5",
   "price": 21,
   "original_price": 101
}
```

Ejemplo de liquidación stock Full:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -d '{
     "promotion_id":"P-MLB12345",
      "offer_id":"MLB10203040-f588cf87-e298-498e-82ad-285b16dd11d5",
     "promotion_type":"UNHEALTHY_STOCK"
  }'
  https://api.mercadolibre.com/seller-promotions/items/MLB10203040
```

Respuesta de liquidación stock Full:

```
{
  "offer_id": "MLB10203040-f588cf87-e298-498e-82ad-285b16dd11d5",
  "price": 21,
  "original_price": 101
}
```

### Parámetros

- **promotion_id** : identificación de la promoción.

- **offer_id** : identificación de la oferta acordada.

- **promotion_type** : tipo de promoción (PRE_NEGOTIATED o UNHEALTHY_STOCK).

## Eliminar descuento

Con esta función puede eliminar la oferta del ítem.

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=$PROMOTION_TYPE&promotion_id=$PROMOTION_ID&offer_id=$OFFER_ID
```

Ejemplo de descuento pre-acordado:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLB1834747833?promotion_type=PRE_NEGOTIATED&promotion_id=P-MLM394001&offer_id=MLM1834747833-9eafadd4-16d2-49ae-b272-9a7a34585cb8
```

Ejemplo liquidación stock Full:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/items/MLB10203040?promotion_type=UNHEALTHY_STOCK&promotion_id=P-MLB12345&offer_id=MLB10203040-f588cf87-e298-498e-82ad-285b16dd11d5'
```

**Respuesta: Status 200 OK**

Nota:

Ten en cuenta que si eliminas un descuento pre-acordado o liquidación stock Full el ítem ya no se será candidato.

**Siguiente** : [Descuento individual](https://developers.mercadolibre.com.ar/es_ar/descuento-individual)
