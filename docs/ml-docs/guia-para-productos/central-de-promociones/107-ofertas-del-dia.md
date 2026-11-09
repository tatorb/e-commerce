<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/ofertas-del-dia -->
<!-- Sección: Guía para productos > Central de promociones -->

# Ofertas del día

Última actualización 22/01/2025

## Ofertas del día

Importante:

El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused".

Los vendedores son invitados periódicamente a participar de diferentes promociones que se realizan en el sitio. Si recibiste la invitación para participar de una oferta del día y quieres sumarte, puedes hacerlo con los siguientes recursos.

## Consultar ítems de la campaña

Para conocer los ítems que forman parte de una oferta del día puedes realizar la siguiente consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID/items?promotion_type=DOD&app_version=v2'
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/DOD-MLB1000/items?promotion_type=DOD&app_version=v2
```

Respuesta:

```
{
   "results": [
       {
           "id": "MLB3500438494",
           "start_date": "2023-04-20T00:00:00",
           "finish_date": "2023-04-20T23:59:59",
           "status": "candidate",
           "price": 3900,
           "original_price": 4000,
           "max_discounted_price": 3960,
           "min_discounted_price": 1200,
           "stock": {
                 "min": 1,
                 "max": 5
             }

       },

{
           "id": "MLB833682552",
           "start_date": "2023-04-20T00:00:00",
           "finish_date": "2023-04-20T23:59:59",
           "status": "candidate",
           "price": 4900,
           "original_price": 5000,
           "max_discounted_price": 4960,
           "min_discounted_price": 2200,
           "stock": {
                 "min": 1,
                 "max": 5
             }

       },
{
           "id": "MLB915917360",
           "start_date": "2023-04-20T00:00:00",
           "finish_date": "2023-04-20T23:59:59",
           "status": "candidate",
           "price": 5900,
           "original_price": 6000,
           "max_discounted_price": 5960,
           "min_discounted_price": 3200,
           "stock": {
                 "min": 1,
                 "max": 5
             }

       }

   ],
   "paging": {
       "offset": 0,
       "limit": 50,
       "total": 3
   }
}
```

**Campos de respuesta**

**id** : identificador del ítem.
 **start_date** : fecha que empieza la campaña.
 **finish_date** : fecha de finalización de la campaña.
 **status** : estado del ítem en la promoción. (ver tabla)
 **price** : precio del ítem dentro de la promoción. En el caso de que el estado del ítem sea **candidate**  hace referencia al precio sugerido.
 **original_price** : precio actual del ítem.
 **max_discounted_price** : es el precio de menor valor al que se puede ofrecer esa promoción.
 **min_discounted_price** : es el mayor precio permitido para esa promoción (es decir, el menor descuento permitido).
 **stock** : valor informativo sobre el stock mínimo que debe tener el ítem al momento de subir un candidato en una promoción.

## Estado del ítem

En la siguiente tabla puedes encontrar los posibles estados que pueden tomar los ítems dentro de este tipo de promoción.

| Estado | Descripción |
| --- | --- |
| **candidate** | Candidato para participar en la promoción. |
| **pending** | Promoción programada. |
| **started** | Activo en la promoción. |
| **finished** | Eliminado de la campaña. |

## Indicar ítems

Una vez invitado a participar en una **oferta del día** , puedes indicar qué productos candidatos deseas incluir en la misma.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
-d '{ 
   "deal_price":"deal_price",
   "promotion_type":"$PROMOTION_TYPE"
}' 
https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2 
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
-d '{ 
   "deal_price": 14999,
   "promotion_type":"DOD"
}' 
https://api.mercadolibre.com/seller-promotions/items/MLA876768946?app_version=v2
```

Respuesta:

```
{
  "price": 14999,
  "original_price": 17000
}
```

**Parámetros**

**deal_price** : precio del ítem en la promoción.
 **promotion_type** : tipo de promoción DOD (oferta del día).

## Eliminar ítems

Nota:

Una vez activadas, las ofertas no pueden ser eliminadas. Debido a su corta duración, esperamos que el vendedor se comprometa a mantenerlas activas durante su ciclo. Sin embargo, si el vendedor no desea mantener la oferta, puede [pausar el ítem](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones#Flujo-y-estados-de-las-publicaciones).

Con este recurso podrás eliminar la oferta programada del ítem.

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2&promotion_type=$PROMOTION_TYPE
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLA632979587??app_version=v2&promotion_type=DOD'
```

**Respuesta: Status 200 OK**

**Next post** : [Ofertas relámpago](https://developers.mercadolibre.com.ar/es_ar/ofertas-relampago)
