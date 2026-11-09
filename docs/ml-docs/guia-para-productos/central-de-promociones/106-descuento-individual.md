<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/descuento-individual -->
<!-- Sección: Guía para productos > Central de promociones -->

# Descuento individual

Última actualización 09/06/2026

## Descuento individual

Importante:

- **Campos de boost (condicionales)**  NUEVO  Mercado Libre puede aplicar un descuento extra (boost) sobre la oferta base de los descuentos individuales (**PRICE_DISCOUNT** ). Si esto ocurre, podés identificarlo a través de los campos **boosted_offer**  (boolean), **discount_meli_boosted_percentage**  (float), **discount_meli_boost_amount**  (number) y **total_price_for_boosted_offer**  (number), presentes únicamente cuando **boosted_offer: true** , en el siguiente endpoint:   Consulta por ítem: [**GET /seller-promotions/items/$ITEM_ID**](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Consultar-promociones-del-item)

Los vendedores que deseen ofrecer una oferta particular para sus ítems con los siguientes recursos podrán hacerlo. Tendrán la posibilidad de aplicar, eliminar y consultar el descuento.

### Para ofrecer este descuento es necesario:

- Tener reputación verde.

- El item debe tener status igual a activo.

- Condición igual a nuevo.

- La exposición del ítem no puede ser gratuita.

- Y sólo para MLA este tipo de descuento no está disponible en las categorías de libros.

## Ofrecer descuento

Para este tipo de oferta, debes cumplir algunos requisitos. Conoce más sobre [cómo ofrecer descuentos](https://www.mercadolibre.com.ar/ayuda/Como-ofrecer-un-descuento_3992).

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
-d '{
   "deal_price": $DEAL_PRICE,
   "top_deal_price": $TOP_DEAL_PRICE,
   "start_date": "$START_DATE",
   "finish_date": "$FINISH_DATE",
   "promotion_type": "PRICE_DISCOUNT"
}'
https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
-d '{
   "deal_price": 20,
   "top_deal_price": 30,
   "start_date": "2023-04-19T00:00:00",
   "finish_date": "2024-04-20T00:00:00",
   "promotion_type": "PRICE_DISCOUNT"
}'
https://api.mercadolibre.com/seller-promotions/items/MLA876768946?app_version=v2'
```

Respuesta:

```
{
    "price": 70,
    "original_price": 100
}
```

### Parámetros

- **deal_price** : precio del ítem con descuento para todos los compradores.

- **top_deal_price** : precio del ítem con descuento para los mejores compradores (con Mercado Puntos nivel 3 a 6). Opcional.

- **start_date** : fecha de inicio del descuento.

- **finish_date** : fecha de fin del descuento.

### Consideraciones

- Es posible segmentar la oferta de descuentos, estableciendo un precio general para todos los compradores, y uno menor sólo para nuestros compradores leales (con nivel 3 al 6 de Mercado Puntos).

- El descuento general debe ser como mínimo 5% menor al descuento de usuarios de nivel 3 al 6, para descuentos de hasta 35%. Para descuentos superiores, la diferencia debe ser de mínimo 10%, es decir, damos mejores descuentos a los niveles más altos.

- El descuento máximo debe ser menor a 80% y el descuento mínimo a ofrecer deberá ser mayor o igual al 5%.

- Si se realiza una suba del precio del ítem, los descuentos serán quitados automáticamente.

- Si al iniciar el descuento, el ítem se encuentra participando de un DEAL, dicho descuento no será aplicado hasta que finalice el DEAL asociado.

- El plazo máximo para un descuento PRICE_DISCOUNT es de 14 días.

- Las fechas de inicio (start_date) y fin del descuento (finish_date) sólo consideran la fecha en sí, independientemente del horario informado. Por defecto, el descuento comienza a las 00:00:00 del día de inicio y termina a las 23:59:59 del día de finalización.

Nota:

Ten en cuenta que para realizar pruebas, es necesario que el usuario de TEST tenga reputación verde y el ítem tenga como mínimo 1 venta con el precio actual.

## Estado del ítem

Estos son los posibles estados que pueden tomar los ítems cuando aplicás un descuento individual.

- **started** : descuento activo en el ítem.

- **finished** : descuento finalizado.

- **pending** : descuento programado.

- **sync_requested** : proceso de activación pendiente.

- **restore_requested** : proceso pendiente de eliminación del descuento.

- **candidate** : ítem candidato para participar en la promoción.

## Eliminar descuento individual a un ítem

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=$PROMOTION_TYPE&app_version=v2
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLA876768946?promotion_type=PRICE_DISCOUNT&app_version=v2
```

Recuerda que para las ofertas individuales (PRICE DISCOUNT) eliminarás toda la oferta, no podrás eliminar por niveles del comprador.

**Respuesta: Status 200 OK**

## Errores

| key | message | Causa |
| --- | --- | --- |
| **buyer_discount_not_in_range** | buyers_discount_percentage parameter must be in range (5, 80) | El descuento general está fuera del rango permitido (5%–80%). |
| **best_buyer_discount_not_in_range** | buyers_discount_percentage parameter must be in range (5, 80) | El descuento para mejores compradores está fuera del rango permitido (5%–80%). |
| **discount_below_10_percent_difference** | The best buyer discount difference cannot be below 10% when buyers discount is above 35% | Cuando el descuento general supera el 35%, la diferencia con el descuento para niveles 3–6 debe ser de al menos 10%. |
| **discount_below_5_percent_difference** | The discount difference cannot be below 5% | La diferencia entre el descuento general y el de niveles 3–6 debe ser de al menos 5%. |
| **error_credibility_price** | The price is not credible. | El descuento aplicado no es suficiente para ser considerado creíble. El vendedor debe aplicar un descuento mayor. |

Conoce más sobre [Descuentos en tus publicaciones](https://vendedores.mercadolibre.com.ar/nota/como-crear-descuentos-en-tus-publicaciones-de-mercado-libre/).

**Siguiente** : [Ofertas del día](https://developers.mercadolibre.com.ar/es_ar/ofertas-del-dia)
