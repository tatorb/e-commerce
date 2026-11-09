<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/deals -->
<!-- Sección: Guía para productos > Central de promociones -->

# Campañas tradicionales

Última actualización 09/06/2026

# Campañas tradicionales

Importante:

- 

- **Campos de boost (condicionales)**  NUEVO  Mercado Libre puede aplicar un descuento extra (boost) sobre la oferta base de las campañas **DEAL** . Si esto ocurre, podés identificarlo a través de los campos **boosted_offer**  (boolean), **discount_meli_boosted_percentage**  (float), **discount_meli_boost_amount**  (number) y **total_price_for_boosted_offer**  (number), presentes únicamente cuando **boosted_offer: true** , en los siguientes endpoints:   Consulta por ítem: [**GET /seller-promotions/items/$ITEM_ID**](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Consultar-promociones-del-item) Consulta por campaña-ítems: **GET /seller-promotions/promotions/$PROMOTION_ID/items**

La **campaña tradicional** , conocida como **DEAL** , es un tipo de promoción organizada por Mercado Libre, en la cual los vendedores invitados pueden ofrecer sus productos con precios promocionales.

Los vendedores son invitados periódicamente por Mercado Libre para participar en campañas DEAL. Si aceptan la invitación, pueden incluir productos y definir precios promocionales dentro de los parámetros establecidos por la plataforma.

IMPORTANTE El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused".

## Consultar detalles de una campaña

Para obtener los detalles de una oferta del tipo DEAL, utiliza el siguiente endpoint:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/P-MLB1806019?promotion_type=DEAL&app_version=v2
```

Respuesta:

```
{
  "id": "P-MLB1806019",
  "type": "DEAL",
  "status": "started",
  "start_date": "2023-04-20T03:00:00Z",
  "finish_date": "2023-08-01T02:00:00Z",
  "deadline_date": "2023-08-01T01:00:00Z",
  "name": "HOTSALE"
}
```

## Estados

Estos son los distintos estados por los que puede pasar una campaña tradicional.

- **pending** : promoción aprobada que aún no inició.

- **started** : promoción activa.

- **finished** : promoción finalizada.

## Consultar ítems de una campaña

ACTUALIZADO

Para conocer los ítems que forman parte de una campaña tradicional, utiliza el siguiente endpoint:

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/P-MLB1806019/items?promotion_type=DEAL&app_version=v2
```

Respuesta:

```
{
  "results": [
      {
          "id": "MLB3538191898",
          "status": "candidate",
          "price": 0,
          "original_price": 5000,
          "max_discounted_price": 4800,
          "suggested_discounted_price": 4150,
          "min_discounted_price": 1600,
          "start_date": "2024-11-27T00:00:00",
          "end_date": "2024-12-05T00:00:00",
          "sub_type": "FLEXIBLE_PERCENTAGE"
   },
      {
          "id": "MLB3538191900",
          "status": "started",
          "price": 1000,
          "original_price": 1500,
          "max_discounted_price": 1300,
          "suggested_discounted_price": 1200,
          "min_discounted_price": 1000,
          "start_date": "2024-12-01T00:00:00",
          "end_date": "2024-12-10T00:00:00",
          "sub_type": "FIXED_AMOUNT",
          "top_deal_price": 1100,
          "discount_percentage": 33.33,
          "currency": "BRL"
      },
      {
          "id": "MLB3538191901",
          "status": "pending",
          "price": 0,
          "original_price": 2000,
          "max_discounted_price": 1800,
          "suggested_discounted_price": 1700,
          "min_discounted_price": 1500,
          "start_date": "2024-12-05T00:00:00",
          "end_date": "2024-12-15T00:00:00",
          "sub_type": "FLEXIBLE_PERCENTAGE",
          "currency": "BRL"
      },
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
      "offset": 0,
      "limit": 50,
      "total": 2
  }
}
```

### Campos de la respuesta

- **id**  (string): identificador del ítem.

- **status**  (string): estado del ítem en la campaña.

- **price**  (number): precio del ítem en la campaña. Valor 0 cuando el ítem es candidato.

- **original_price**  (number): precio del ítem sin descuento.

- **min_discounted_price**  (number): precio mínimo permitido en la campaña. Representa el mayor descuento posible para el ítem.

- **max_discounted_price**  (number): precio máximo de descuento considerado creíble.

- **suggested_discounted_price**  (number): precio promocional sugerido. Puede ser null si no hay una sugerencia disponible.

- **top_deal_price**  (number): precio para compradores con nivel Mercado Puntos 3 a 6. Presente solo si el ítem está activo y el vendedor configuró este valor al sumarse a la campaña.

- **discount_percentage**  (float): porcentaje de descuento aplicado.

- **currency**  (string): moneda del precio (código ISO 4217, ej. BRL, ARS).

- **sub_type**  (string): subtipo de campaña. Valores posibles: **FLEXIBLE_PERCENTAGE**  o **FIXED_AMOUNT** .

- **boosted_offer**  (boolean): indica si hay un boost activo sobre la oferta.

- **discount_meli_boosted_percentage**  (float): porcentaje adicional de descuento aportado por Mercado Libre como parte del boost.

- **discount_meli_boost_amount**  (number): monto absoluto (en moneda local) del descuento extra del boost.

- **total_price_for_boosted_offer**  (number): precio final con descuento base y boost aplicados. Es el precio que verá el comprador.

IMPORTANTE Se generará un error **400**  si el valor de **deal_price**  informado al asociar ítems a una campaña no corresponde con los descuentos sugeridos.

## Estado de los ítems

Estos son los posibles estados que pueden tomar los ítems dentro de una campaña tradicional.

- **candidate** : ítem elegible para participar en la campaña.

- **pending** : ítem incluido en la campaña pero aún no iniciada.

- **started** : ítem activo en la campaña.

- **finished** : ítem eliminado de la campaña.

## Sugerencia de descuentos para promociones

Los campos **min_discounted_price** , **max_discounted_price**  y **suggested_discounted_price**  son calculados automáticamente por Mercado Libre para ayudar al vendedor a definir un precio competitivo al sumarse a la campaña. Están disponibles en la respuesta de **GET /seller-promotions/promotions/$PROMOTION_ID/items**  para los siguientes tipos de campaña:

- Campañas tradicionales (DEAL)

- Descuento individual (PRICE_DISCOUNT)

- Campañas del vendedor (SELLER_CAMPAIGN)

IMPORTANTE Estos campos no se retornan para ofertas ya creadas.

## Indicar ítems para una campaña

Una vez invitado a participar en una campaña tradicional, puedes indicar qué productos deseas incluir en la misma. Es opcional informar el precio para **top_deal_price** .

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
-d '{
  "top_deal_price":$TOP_DEAL_PRICE
  "promotion_id":"$PROMOTION_ID"
   "deal_price":$DEAL_PRICE,
   "promotion_type":"$PROMOTION_TYPE"
}'
https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
-d '{
  "deal_price": 4000,
  "top_deal_price": 3000,
  "promotion_id": "P-MLB1806019",
  "promotion_type": "DEAL"
 }' 
https://api.mercadolibre.com/seller-promotions/items/MLB3295112047?app_version=v2
```

Respuesta:

```
{
  "price": 4000,
  "top_price": 3000,
  "original_price": 5000
}
```

Respuesta con error:

Error 400: Se produce cuando el **deal_price**  informado no cumple con los requisitos para el "Precio Sugerido".

```
{
  "message": "Errors: ERROR_CREDIBILITY_DISCOUNTED_PRICE - The discounted price is not credible.",
  "error": "bad_request",
  "status": 400,
  "cause": [
    {
      "error_code": "ERROR_CREDIBILITY_DISCOUNTED_PRICE",
      "error_message": "The discounted price is not credible."
    }
  ]
}
```

### Parámetros

- **deal_price**  (number): precio del ítem en la promoción.

- **top_deal_price**  (number): precio para compradores con nivel Mercado Puntos 3 a 6. Opcional.

- **promotion_id**  (string): identificador de la promoción.

- **promotion_type**  (string): tipo de promoción. Valor fijo: **DEAL** .

## Modificar ítems

Para modificar los ítems que están participando en una promoción realiza la siguiente operación:

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN'
-d'{
   "deal_price":$DEAL_PRICE,
   "top_deal_price":$TOP_DEAL_PRICE,
   "promotion_id":"$PROMOTION_ID"
   "promotion_type":"DEAL"
}'
https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?app_version=v2
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN'
-d'{
  "deal_price": 3900,
  "top_deal_price": 3000,
  "promotion_id": "P-MLB1806019",
  "promotion_type": "DEAL"
 }'
https://api.mercadolibre.com/seller-promotions/items/MLB3295112047?app_version=v2
```

Respuesta:

```
{
  "price": 3900,
  "top_price": 3000,
  "original_price": 5000
}
```

## Eliminar ítems

Con este recurso podrás eliminar la oferta del ítem.

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=$PROMOTION_TYPE&promotion_id=$PROMOTION_ID&app_version=v2
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLB3295112047?promotion_type=DEAL&promotion_id=P-MLB1806019&app_version=v2
```

Respuesta: **Status 200 OK**

## Posibles Mensajes de Error

Al interactuar con la API, es importante estar al tanto de los mensajes de error que pueden ocurrir, especialmente en casos de solicitudes inválidas o falta de acceso. En caso de problemas, se recomienda verificar los permisos de acceso y los parámetros de solicitud, además de mantener el token de autenticación actualizado.

| Código de Error | Mensaje de Error | Descripción |
| --- | --- | --- |
| **400** | **Bad Request** | La solicitud es inválida o está malformada. Verifique los parámetros o el cuerpo de la solicitud. |
| **401** | **Unauthorized** | El token de autenticación proporcionado es inválido o ha expirado. Solicite un nuevo token. |
| **403** | **Forbidden** | El acceso a la API está prohibido para el usuario o para el tipo de operación solicitada. |
| **404** | **Not Found** | El recurso solicitado no se encontró. Verifique el endpoint o el ID del recurso. |
| **422** | **Unprocessable Entity** | El servidor entiende la solicitud, pero no puede procesarla debido a datos inválidos o inconsistentes. |
| **429** | **Too Many Requests** | El número de solicitudes realizadas excedió el límite permitido. Intente nuevamente más tarde. |
| **500** | **Internal Server Error** | Ocurrió un error inesperado en el servidor. Intente nuevamente más tarde. |
| **503** | **Service Unavailable** | El servicio está temporalmente fuera de servicio. Intente nuevamente más tarde. |

**Next** : [Campañas co-fondeadas](https://developers.mercadolibre.com.ar/es_ar/campanas-co-fondeadas)
