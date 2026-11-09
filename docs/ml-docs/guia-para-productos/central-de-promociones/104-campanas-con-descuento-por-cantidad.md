<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/campanas-con-descuento-por-cantidad -->
<!-- Sección: Guía para productos > Central de promociones -->

# Campañas con descuento por cantidad

Última actualización 13/03/2026

## Campañas con descuento por cantidad

Importante:

El [nuevo filtro por estado](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones?nocache=true#:~:text=Ejemplo%20de%20filtro%20por%20status_item%3A) ya está disponible para filtrar los ítems de una campaña mediante el query param **status_item** , que acepta los valores "active" o "paused".

Ahora los vendedores tienen control de la creación de las campañas de descuento por cantidad que se realizan en el sitio. La característica principal de este tipo de campañas es que se aplica un descuento cuando se alcanza una cierta cantidad de ítems de un producto. También agregamos el concepto de descuentos en distintas situaciones de volumen y descuento, además del nuevo concepto de “campaña combinable” y “campaña no combinable” lo cual mejora la flexibilidad del descuento.

**Importante:**

El antiguo mecanismo de descuento por volumen creado por Mercado Livre ha sido descontinuado, las campañas creadas y activadas antes de este cambio se mantendrán hasta su finalización. Al ser una campaña personalizada, Mercado Livre no prevé coparticipación, similar a la campaña del vendedor.

### Vista del vendedor

## Crear campaña

Además de los detalles generales de la campaña, cómo nombre, fecha inicial y fin, hay tres tipos de campañas de volumen para considerar en la creación:

**BNGM** (Buy N get M): pagá 3 y llevá 9.

**BNSP** (Buy N save P%): 50% OFF comprando 2.

**SPONTH** (Save P% on the Nth): 50% OFF en la 2da unidad.

También es necesario informar si es posible aplicar el descuento en la cantidad seleccionada de lo mismo ítem o es posible combinar ítems distintos para aplicar el descuento.

Para crear una campaña de volumen de vendedores, ejecute la siguiente llamada:

Ejemplo BNGM enviando buy_quantity, pay_quantity y allow_combination permitiéndo combinar ítems distintos:

```
curl -X POST -H https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2 \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
  "promotion_type": "VOLUME",
  "sub_type": "BNGM",
  "buy_quantity": 3,
  "pay_quantity": 2,
  "allow_combination": true,
  "name": "DxV teste BNGM",
  "start_date": "2024-08-29T00:00:00",
  "finish_date": "2024-09-29T00:00:00"
}
'
```

Respuesta:

```
{
   "id": "C-MLB5790",
   "type": "VOLUME",
   "sub_type": "BNGM",
   "status": "pending",
   "start_date": "2024-08-29T00:00:00",
   "finish_date": "2024-09-29T23:59:59",
   "name": "DxV teste BNGM",
   "buy_quantity": 3,
   "pay_quantity": 2,
   "allow_combination": true
}
```

Ejemplo BNSP enviando buy_quantity, discount_percentage y allow_combination no permitiendo combinar ítems distintos:

```
curl -X POST -H https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2&version=test \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
  "promotion_type": "VOLUME",
  "sub_type": "BNSP",
  "buy_quantity": 5,
 "discount_percentage": 30,
  "allow_combination": false,
  "name": "DxV teste BNSP",
  "start_date": "2024-08-29T00:00:00",
  "finish_date": "2024-09-29T00:00:00"
}'
```

Respuesta:

```
​​{
   "id": "C-MLB5789",
   "type": "VOLUME",
   "sub_type": "BNSP",
   "status": "pending",
   "start_date": "2024-08-29T00:00:00",
   "finish_date": "2024-09-29T23:59:59",
   "name": "DxV teste BNSP",
   "buy_quantity": 5,
   "discount_percentage": 30,
   "allow_combination": false,
}
```

Ejemplo SPONTH enviando buy_quantity, discount_percentage y allow_combination permitiendo combinar ítems distintos:

```
curl -X POST -H https://api.mercadolibre.com/seller-promotions/promotions?app_version=v2&version=test \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
   "promotion_type": "VOLUME",
   "sub_type": "SPONTH",
   "buy_quantity": 2,
   "discount_percentage": 50,
   "allow_combination": true,
   "name": "DxV teste SPONTH",
  "start_date": "2024-08-29T00:00:00",
  "finish_date": "2024-09-29T00:00:00"
}'
```

Respuesta:

```
{
   "id": "C-MLB5791",
   "type": "VOLUME",
   "sub_type": "SPONTH",
   "status": "pending",
   "start_date": "2024-08-29T00:00:00",
   "finish_date": "2024-09-29T23:59:59",
   "name": "DxV teste SPONTH",
   "buy_quantity": 2,
   "discount_percentage": 50,
   "allow_combination": true
}
```

**promotion_type** : VOLUME. Obligatorio.

**name** : nombre de la campaña que sirve como identificador para este tipo de campañas en la central de promociones. Obligatorio.

**start_date y finish date** : vigencia de la campaña. Obligatorio

**allow_combination** : en caso de ser true, permite la combinación de items. Obligatorio.

**sub_type** : informar el sub-tipo de la campaña BNGM/BNSP/SPONTH. Obligatorio.

Considerando el subtype, se deben enviar 2 de los siguientes campos: buy_quantity, pay_quantity, discount_percentage.

**BNGM** : se necesita enviar buy_quantity indicando la cantidad a comprar (ej. 9) y pay_quantity, indicando la cantidad que realmente se paga (ej. 3).

**BNSP** : se necesita enviar buy_quantity indicando la cantidad a comprar (ej. 2) y discount_percentage, indicando el porcentaje de descuento (ej. 50).

**SPONTH** : buy_quantity indicando la cantidad a comprar (ej. 2) y discount_percentage indicando el porcentaje de descuento en esa unidad (ej. 50).

## Actualizar la campaña

Para la edición de campañas de descuento por cantidad se deben tener las siguientes consideraciones:

Siempre deberá enviarse el campo promotion_type (que deberá tener el valor VOLUME).

No puede modificarse la fecha de inicio ni de finalización.

Para las campañas activas, solamente puede modificarse el nombre.

Solo el seller que creó la campaña tendrá permisos para modificarla.

Para las programadas, solo deben enviarse los campos que deseen modificarse, teniendo en cuenta:

En caso de querer modificar los atributos de una campaña (buy_quantity, pay_quantity, discount_percentage) o cambiar su subtype, deberán indicarse todos los atributos correspondientes según el subtipo, por más que no sufran modificaciones.

Ejemplo:

```
curl --location --request PUT https://api.mercadolibre.com/seller-promotions/promotions/C-MLB5783?app_version=v2&version=test \
--header 'Content-Type: application/json' \
--header 'Authorization: ••••••' \
--data '{
   "promotion_type": "VOLUME",
   "sub_type": "BNSP",
   "buy_quantity": 9,
   "discount_percentage": 30,
   "allow_combination": false,
   "name": "campanha de teste"
}'
```

La respuesta exitosa es un código 200 OK. Y tiene el mismo formato que la respuesta de la creación de una campaña::

```
{
   "id": "C-MLB5783",
   "type": "VOLUME",
   "sub_type": "BNSP",
   "status": "pending",
   "start_date": "2024-08-29T00:00:00",
   "finish_date": "2024-09-29T23:59:59",
   "name": "campanha de teste",
   "buy_quantity": 9,
   "discount_percentage": 30,
   "allow_combination": false
}
```

## Eliminar campaña

Puede eliminarse una campaña y su eliminación dará de baja todas las ofertas existentes asociadas a la misma:

```
curl --location --request DELETE https://api.mercadolibre.com/seller-promotions/promotions/{{Promo-ID}}?promotion_type=VOLUME&app_version=v2 \
--header 'Authorization: Bearer {{token}}'
```

La respuesta exitosa es un código 200 OK, con el body en null.

## Consultar detalles de una campaña

Para obtener los detalles de una campaña con descuento por volumen,realiza la siguiente consulta:

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions/P-MLB1806017?promotion_type=VOLUME&app_version=v2
```

Respuesta:

```
{
     "id": "C-MLB5790",
   "type": "VOLUME",
   "sub_type": "BNGM",
   "status": "started",
   "start_date": "2024-08-29T03:00:00Z",
   "finish_date": "2024-09-30T02:59:59Z",
   "name": "DxV teste BNGM",
   "buy_quantity": 3,
   "pay_quantity": 2,
   "allow_combination": false
}
```

### Campos específicos de esta campaña

**id** : identificador da campaña.

**type** : tipo de campaña (VOLUME).

**sub_type** : informar el sub-tipo de la campaña BNGM/BNSP/SPONTH.

**status** : estado actual de la campaña.

**start_date e finish_date** : vigencia de la campaña.

**allow_combination** : en caso de ser true, permite la combinación de items. Obligatorio.

**buy_quantity** : cantidad requerida de ítems para acceder al descuento.

**pay_quantity** : cantidad de ítems que se abonan

**discount_percentage** : porcentaje de descuento sobre cada ítem.

**allow_combination** : en caso de ser true, permite la combinación de items.

## Estados

Estos son los distintos estados por los que puede pasar una campaña con descuento por volumen.

| Estado | Descripción |
| --- | --- |
| **pending** | Promoción aprobada que aún no inició. |
| **started** | Promoción activa. |
| **finished** | Promoción finalizada. |

## Consultar ítems en una campaña

Para conocer los ítems candidatos y/o que forman parte de una campaña con descuento por volumen puedes realizar la siguiente consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/promotions//P-MLB1806017/items?promotion_type=VOLUME&app_version=v2
```

Respuesta:

```
{
  "results": [
      {
          "id": "MLB3500418540",
          "status": "candidate",
          "price": 1333.34,
          "original_price": 2000,
          "meli_percentage": 10,
          "seller_percentage": 23.3,
          "start_date": "2023-04-20T03:00:00Z",
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

Al crearse una nueva campaña se seleccionan todos los ítems aplicables a la misma. El estado inicial (**status** ) de los ítems es **candidate**  y sin offer id asignado. Al momento que el vendedor incorpora un ítem a la campaña su status se modifica y se le asigna un **offer_id**  único.

## Estado de los ítems

En la siguiente tabla puedes encontrar los posibles estados que pueden tomar los ítems dentro de este tipo de campaña.

| Estado | Descripción |
| --- | --- |
| **candidate** | Ítem candidato para participar de la promoción. |
| **pending** | Ítem con promoción aprobada y programada. |
| **started** | Ítem activo en la campaña. |
| **finished** | Ítem eliminado de la campaña |

## Indicar ítems para una campaña

Una vez que has sido invitado a participar para este tipo de campaña, puedes indicar qué productos deseas incluir en la misma.

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
   "promotion_id":"P-MLB379009",
   "promotion_type":"VOLUME"
}'
https://api.mercadolibre.com/seller-promotions/items/MLB1834747833&app_version=v2
```

Respuesta:

```
{
  "offer_id": "MLB1834747833-9eafadd4-16d2-49ae-b272-9a7a34585cb8",
  "price": 1800,
  "original_price": 2000
}
```

### Parámetros

**promotion_id** : identificación de la promoción.
 **promotion_type** : tipo de promoción (VOLUME).

## Modificando ítems

Para modificar el precio de un ítem que se encuentra participando de una campaña con descuento por volumen se deben realizar los siguientes pasos, ya que no es posible modificar el precio directamente.

- Eliminar el ítem de la campaña;

- Modificar el precio del ítem como la sincronización de precio normal;

- Incluir nuevamente el ítem dentro de la campaña.

- 

- Nota:  Los ítems que participan de las campañas con descuento por volumen no tienen el precio fijo, por ende si un ítem está participando y aumenta su precio, saldrá automáticamente de la oferta y no lo podrás agregar nuevamente.  - Te recomendamos **validar si el ítem está participando de una campaña con descuento por volumen cuando realices una modificación del precio**  (manuales o automáticas).

- 

- Eliminar ítems

- Con este recurso podrás eliminar la oferta del ítem.

- Llamada:

- `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/$ITEM_ID?promotion_type=$PROMOTION_TYPE&promotion_id=$PROMOTION_ID&offer_id=$OFFER_ID`

- Ejemplo:

- `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/seller-promotions/items/MLA632979587?promotion_type=VOLUME&promotion_id=1804&offer_id=MLA876618673-9eafadd4-16d2-49ae-b272-9a7a34585cb8&app_version=v2'Í`

- 

- Respuesta: **Status 200 OK**

- 

- Conoce más sobre [Ofertas por cantidad](https://vendedores.mercadolibre.com.ar/nota/ofertas-por-cantidad/).

- 

- **Siguiente** : [Descuento pre-acordado por ítem](https://developers.mercadolibre.com.ar/es_ar/descuento-pre-acordado-por-item)
