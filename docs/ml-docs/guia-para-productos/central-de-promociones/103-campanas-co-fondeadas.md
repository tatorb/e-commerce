<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas -->
<!-- Sección: Guía para productos > Central de promociones -->

# Campañas co-fondeadas

Última actualización 22/01/2025

## Campañas co-fondeadas

Importante:

El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused".

Los vendedores son invitados periódicamente a participar de diferentes campañas que se realizan en el sitio. La característica principal de este tipo de campañas es que Mercado Libre paga un porcentaje del descuento ofrecido.
 Si recibiste una invitación y quieres sumarte puedes hacerlo con los siguientes recursos.

## Consultar detalle de la campaña

Para obtener los detalles de una oferta co-fondeada, realiza la siguiente consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/P-MLB1806015?promotion_type=MARKETPLACE_CAMPAIGN&app_version=v2'
```

Respuesta:

```
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
}
```

### Campos específicos de esta campaña

Benefits: detalle de los beneficios de la promoción.

- **type** : el vendedor no podrá enviar mensajes al comprador.

- **meli_percent** : porcentaje que aporta Mercado Libre.

**seller_percent** : porcentaje que aporta el vendedor.

## Estados

Estos son los distintos estados por los que puede pasar una campaña co-fondeada.

| Estado | Descripción |
| --- | --- |
| **pending** | Promoción aprobada que aún no inició. |
| **started** | Promoción activa. |
| **finished** | Promoción finalizada. |

## Consultar ítems en una campaña

Para conocer los ítems candidatos y/o que forman parte de una campaña co-fondeada puedes realizar la siguiente consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/P-MLB1806015/items?promotion_type=MARKETPLACE_CAMPAIGN&app_version=v2'
```

Respuesta:

```
{
  "results": [
      {
          "id": "MLB3293401659",
          "status": "started",
          "price": 700,
          "original_price": 1000,
          "offer_id": "OFFER-MLB3293401659-177366",
          "meli_percentage": 5,
          "seller_percentage": 25,
          "start_date": "2023-04-23T23:06:53Z",
          "end_date": "2023-08-01T02:00:00Z"
      }
  ],
  "paging": {
      "offset": 0,
      "limit": 50,
      "total": 1
  }
}
```

Al crearse una nueva campaña se seleccionan todos los ítems aplicables a la misma. El estado inicial (**status** ) de los ítems es **candidate**  y sin offer id asignado. Al momento que el vendedor incorpora un ítem a la campaña, su status se modifica y se le asigna un **offer_id**  único.

## Estado de los ítems

En las siguiente tabla puedes encontrar los posibles estados que pueden tomar los ítems dentro de este tipo de campaña.

| Estado | Descripción |
| --- | --- |
| **candidate** | Ítem candidato para participar de la promoción. |
| **pending** | Ítem con promoción aprobada y programada. |
| **started** | Ítem activo en la campaña. |
| **finished** | Ítem eliminado de la campaña |

## Indicar ítems para una campaña

Una vez que has sido invitado a participar en una campaña co-fondeada, puedes indicar qué productos deseas incluir en la misma.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
   "promotion_id":"$PROMOTION_ID",
   "promotion_type":"$PROMOTION_TYPE"
}'
https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2

 
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
   "promotion_id":"P-MLB1806015",
   "promotion_type":"MARKETPLACE_CAMPAIGN"
}'
https://api.mercadolibre.com/seller-promotions/items/MLB3293401659?app_version=v2
```

Respuesta:

```
{
  "offer_id": "OFFER-MLB3293401659-177366",
  "price": 700,
  "original_price": 1000
```

### Parámetros

**promotion_id** : identificación de la promoción.
 **promotion_type** : tipo de promoción (MARKETPLACE_CAMPAIGN).

## Modificar ítems

Para modificar el precio de un ítem que se encuentra participando de una campaña co-fondeada se deben realizar los siguientes pasos, ya que no es posible modificar el precio directamente.

- Eliminar el ítem de la campaña

- Modificar el precio del ítem como la sincronización de precio normal

- Incluir nuevamente el ítem dentro de la campaña

- 

- Nota:  Los ítems que participan de las ofertas co-fondeadas (Marketplace Campaign) no tienen el precio fijo, por ende si un ítem está participando y aumenta su precio, saldrá automáticamente de la oferta y no lo podrás agregar nuevamente.  - Te recomendamos **validar si el ítem está participando de una campaña co-fondeada**  cuando realices una modificación del precio (manuales o automáticas).

- 

- 

- Eliminar ítems

- Con este recurso podrás eliminar la oferta del ítem.

- Llamada:

- `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=$PROMOTION_TYPE&promotion_id=$PROMOTION_ID&offer_id=$OFFER_ID`

- Ejemplo:

- `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLA632979587?promotion_type=MARKETPLACE_CAMPAIGN&promotion_id=1804&offer_id=MLA876618673-9eafadd4-16d2-49ae-b272-9a7a34585cb8&app_version=v2'`

- 

- Respuesta: **Status 200 OK**

- 

- Conoce más sobre [Campañas co-fondeadas](https://vendedores.mercadolibre.com.ar/nota/ofrece-un-descuento-y-nosotros-sumamos-un-porcentaje-extra/).

- 

- **Siguiente** : [Campañas con descuento por volumen](https://developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-volumen)
