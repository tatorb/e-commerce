<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/ofertas-relampago -->
<!-- Sección: Guía para productos > Central de promociones -->

# Ofertas relámpago

Última actualización 09/06/2026

# Ofertas relámpago

Importante:

- 

- **Campos de boost (condicionales)**  NUEVO  Mercado Libre puede aplicar un descuento extra (boost) sobre la oferta base de las campañas **LIGHTNING** . Si esto ocurre, podés identificarlo en la consulta por ítem [**GET /seller-promotions/items/$ITEM_ID**](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Consultar-promociones-del-item) a través de los campos **boosted_offer**  (boolean), **discount_meli_boosted_percentage**  (float), **discount_meli_boost_amount**  (number) y **total_price_for_boosted_offer**  (number), presentes únicamente cuando **boosted_offer: true** .

Los vendedores son invitados periódicamente a participar de diferentes promociones que se realizan en el sitio. Si recibiste la invitación para participar de una **oferta relámpago**  y quieres sumarte puedes hacerlo con los siguientes recursos. 
 Ten en cuenta que este tipo de ofertas tiene un stock reservado que al terminarse se finaliza la promoción. 
 El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused".

## Consultar ítems

Para conocer los ítems que forman parte de una **oferta relámpago**  puedes realizar la siguiente consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/$PROMOTION_ID/items?app_version=v2&promotion_type=LIGHTNING
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/LGH-MLB1000/items?app_version=v2&promotion_type=LIGHTNING
```

Respuesta:

```
{
   "results": [
       {
           "id": "MLB3293401743",
           "start_date": "2023-04-21T15:00:00",
           "finish_date": "2023-04-21T23:00:00",
           "status": "candidate",
           "price": 4000,
           "original_price": 5000,
           "max_discounted_price": 4950,
           "min_discounted_price": 1500,
           "stock": {
                 "min": 2,
                 "max": 5
             }

       }
   ],
   "paging": {
       "offset": 0,
       "limit": 50,
       "total": 1
   }
}
```

**Campos de respuesta**

- **id**  (string): identificador del ítem.

- **start_date**  (string): fecha de inicio de la campaña.

- **finish_date**  (string): fecha de finalización de la campaña.

- **status**  (string): estado del ítem en la promoción. [(Ver estados)](https://developers.mercadolibre.com.ar/es_ar/ofertas-relampago#Estado-del-%C3%ADtem)

- **price**  (number): precio del ítem en la promoción. Cuando el estado es **candidate** , hace referencia al precio sugerido.

- **original_price**  (number): precio actual del ítem sin descuento.

- **max_discounted_price**  (number): precio máximo al que puede ofrecerse el ítem en la promoción.

- **min_discounted_price**  (number): precio mínimo permitido para la promoción, es decir, el mayor descuento posible.

- **stock**  (object): rango de stock mínimo y máximo requerido para participar en la promoción.

## Estado del ítem

Estos son los posibles estados que pueden tomar los ítems dentro de una oferta relámpago.

- **candidate** : candidato para participar en la promoción.

- **pending** : promoción programada.

- **started** : activo en la oferta.

- **finished** : eliminado de la campaña.

## Indicar ítems

Una vez invitado a participar en una **oferta relámpago** , puedes indicar qué productos candidatos deseas incluir en la misma. Teniendo en cuenta que debes informar el stock que estará disponible para esta promoción. Cuando se agote el stock disponible automáticamente se dará por finalizada la promoción en el ítem.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
-d '{
   "deal_price": $DEAL_PRICE,
   "stock": $STOCK,
   "promotion_type": "$PROMOTION_TYPE"
}'
https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
-d '{
   "deal_price": 14999,
   "stock": 2,
   "promotion_type": "LIGHTNING"
}'
https://api.mercadolibre.com/seller-promotions/items/MLB3293401743?app_version=v2
```

Respuesta:

```
{
  "price": 14999,
  "original_price": 17000
}
```

**Parámetros**

- **deal_price**  (number): precio del ítem en la promoción.

- **stock**  (number): cantidad de stock que el vendedor reserva para esta promoción.

- **promotion_type**  (string): tipo de promoción. Valor fijo: **LIGHTNING** .

## Eliminar ítems

Nota:

Una vez activadas, las ofertas no pueden ser eliminadas. Debido a su corta duración, esperamos que el vendedor se comprometa a mantenerlas activas durante su ciclo. Sin embargo, si el vendedor no desea mantener la oferta, puede [pausar el ítem](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones#Flujo-y-estados-de-las-publicaciones).

Con este recurso podrás eliminar la oferta relámpago del ítem.

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2&promotion_type=$PROMOTION_TYPE
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLA632979587?app_version=v2&promotion_type=LIGHTNING
```

**Respuesta: Status 200 OK**

Conoce más sobre [Ofertas relámpago](https://vendedores.mercadolibre.com.ar/nota/ofertas-relampago-liquida-tu-stock-en-pocas-horas/).

**Siguiente** : [Campañas del vendedor](https://developers.mercadolibre.com.ar/es_ar/campanas-del-vendedor).
