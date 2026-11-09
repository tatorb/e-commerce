<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/comision-por-vender -->
<!-- Sección: Guía para productos > Precios y Costos -->

# Costos por vender

Última actualización 03/09/2026

## Costos por vender

El calculador de listing prices es un recurso de solo lectura que ofrece muchas formas de conocer los costos al vender un artículo por Mercado Libre, para que el vendedor pueda saber exactamente cuánto costará vender en cierto listing_type para un site, categoría, moneda, logística y cantidad determinados.

Importante:

Mercado Libre actualizó la estructura de costos de envío. El fixed_fee ya no se calcula únicamente por el precio del producto, sino que depende del tipo de logística del vendedor.

**Fechas de encendido:**

- Brasil: 02/03

- Argentina: 12/03

- Colombia: 23/03

- Chile: 06/04

- México: 08/04

Si no envías los parámetros **logistic_type** , **shipping_mode**  y **billable_weight**  (obligatorio en Argentina), el fixed fee calculado no coincidirá con lo que realmente se cobrará al vendedor.

## Descripción de atributos

| Atributo | Descripción |
| --- | --- |
| currency_id | ID de moneda de los costos. |
| listing_exposure | Nivel de exposición de la publicación. |
| listing_fee_amount | Costos por publicar. |
| listing_fee_details | Array que muestra el detalle de los costos por publicar:  - fixed_fee: cargo fijo por publicar  - gross_amount: valor bruto de comisión (sin aplicar descuentos) |
| listing_type_id | ID del tipo de publicación. |
| listing_type_name | Nombre del tipo de publicación. |
| requires_picture | Muestra si el tipo de publicación requiere, por lo menos, una imagen. |
| sale_fee_amount | Costos por vender. |
| sale_fee_details | Array que muestra el detalle de los costos por vender:   - financing_add_on_fee: costos por agregar cuotas.  - fixed_fee: Costo fijo por unidad vendida.  - gross_amount: valor bruto de comisión (sin aplicar descuentos).  - meli_percentage_fee: costos por vender en la plataforma (aplica solo MLA).  - percentage_fee: porcentaje de comisión total. |

Nota:

El valor del campo **percentage_fee**  puede tener variaciones para **MLB** . Además de la categoría y del tipo de publicación, el **percentage_fee**  retornado puede variar también de acuerdo con otros parámetros objetivos definidos por Mercado Libre, que pueden incluir diversos factores comerciales.

 Para el sitio **MLB (Brasil)** , los productos de categorías seleccionadas que estén en determinado **[rango de valor](https://vendedores.mercadolivre.com.br/ajuda/51251)**  pueden tener una reducción en su tarifa de venta. Esta reducción puede variar de acuerdo con otros criterios adicionales; por lo tanto, el mismo producto puede tener comisiones diferentes en momentos distintos.

**Recuerda** :

- Los tipos de publicación o listing_type disponibles para Marketplace son free, gold_special, gold_pro (puede variar según el site).

- Filtrar por channel para ver las comisiones específicas. En caso contrario, verás por defecto las de marketplace.

- Respetar la relación listing_type + tag [ver opciones](https://developers.mercadolibre.com.ar/es_ar/campanas-con-cuotas-para-marketplace?nocache=true#Comparaci%C3%B3n-opciones-de-cuotas:~:text=Mercado%20Libre%20.-,Comparaci%C3%B3n%20opciones%20de%20cuotas,-Publicaciones%20en%20las) aplica solo MLA.

- Conoce más sobre [costos por vender un producto y opciones de cuotas (MLA)](https://www.mercadolibre.com.ar/ayuda/870).

- Según el site, puede variar la cantidad de atributos en la respuesta.

## Obtener el costo de envío según nueva estructura

Mercado Libre actualiza la estructura de costos de envío para las ventas. El fixed fee ya no se calculan solo en función del precio del producto, sino también según el tipo de logística y el modo de envío que use el vendedor. Si no enviás los nuevos parámetros, el fixed fee que obtengas en tu integración no va a coincidir con lo que realmente se cobra. Esto puede generar:

- Información incorrecta mostrada a quienes usan tu aplicación.

- Diferencias entre los costos proyectados y los costos reales.

Con esta consulta vas a poder obtener el costo real por vender un producto. Sumá los parámetros **shipping_mode**  , **logistic_type**  y **billable_weight**  (obligatorio para Argentina) para obtener un cálculo más preciso de las comisiones.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?category_id=$CATEGORY_ID&price=$PRICE&currency_id=$CURRENCY_ID&logistic_type=$LOGISTIC_TYPE&shipping_modes=$SHIPPING_MODES&listing_type_id=$LISTING_TYPE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
  "https://api.mercadolibre.com/sites/MLA/listing_prices?price=5000&currency_id=ARS&category_id=MLA418448&listing_type_id=gold_pro&logistic_type=drop_off&shipping_mode=me2&billable_weight=5828&tags=ahora-3"
```

Respuesta:

```
[
   [
  {
    "currency_id": "ARS",
    "listing_type_id": "gold_pro",
    "listing_type_name": "Premium",
    "listing_exposure": "highest",
    "listing_fee_amount": 0,
    "listing_fee_details": {
      "fixed_fee": 0,
      "gross_amount": 0
    },
    "requires_picture": true,
    "sale_fee_amount": 2000,
    "sale_fee_details": {
      "financing_add_on_fee": 23,
      "fixed_fee": 200,
      "gross_amount": 2000,
      "meli_percentage_fee": 13,
      "percentage_fee": 36
    },
    "stop_time": "2043-06-01T00:00:00.000-04:00"
  }
]
```

### Parámetros:

- **price (number):**  Define el precio de venta del ítem.

- **currency_id (string):**  Indica la moneda del ítem usando el identificador de moneda del site.

- **category_id (string):**  Especifica la categoría del ítem mediante su category_id.

- **listing_type_id (string):**  Determina el tipo de publicación que aplicás al ítem.

- **logistic_type (string):**  Define el tipo logístico del envío asociado al ítem. Obtener de Documentación  drop_off: Mercado Envíos Drop Off. Modo: me2. cross_docking: Mercado Envíos Colecta. Modo: me2. xd_drop_off: Mercado Envíos Places. Modo: me2. self_service: Mercado Envíos Flex. Modo: me2. turbo: Mercado Envíos Turbo. Modo: me2. fulfillment: Mercado Envíos Full. Modo: me2. default: Logística por defecto. Modo: me1. custom: Personalizado. Modo: custom. not_specified: No especificado. Modo: not_specified.

- **shipping_mode (string):**  Indica el modo de envío que usás para la publicación. Obtener de Documentación  me2: Mercado Envíos 2 - Logística gestionada por Mercado Libre me1: Mercado Envíos 1 - Logística propia del vendedor o terceros custom: Envío personalizado con tabla de precios del vendedor not_specified: Sin modo de envío especificado

- **billable_weight (number):**  Envía el peso facturable del paquete, en gramos. Ejemplo: 5828 (Obligatorio para Argentina). Obtener de Documentación

- **tags (string):**  Asigna la campaña de cuotas activa para el ítem (solo disponible en Argentina). Ejemplo: ahora-3

## Lógica de cálculo

Conoce la nueva lógica de cálculo de costos. Estas reglas aplican una vez que cada site active esta nueva estructura.

**Brasil, Colombia, Chile, México:**

- **Precio < TH + ME2:**  Solo Flex (self_service) cobra costo fijo. Los demás modelos no generan cargo.

- **ME1 / custom / not_specified:**  Siempre se cobra costo fijo (cuando precio < TH).

- **Precio ≥ TH:**  No se cobra costo fijo en ningún caso.

- **Peso facturable:**  No aplica.

- **Cargo por venta (sale_fee):**  Siempre se cobra un porcentaje del precio, según la categoría del producto.

*** TH (Umbral):**  Umbral de envío gratis obligatorio definido por cada site. Consulta las FAQs de pricing para conocer los valores específicos.

## Filtrar por precio

Recupera información detallada sobre tipos de publicaciones filtrando por el precio asociado.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?price=$PRICE
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=5000
```

Respuesta:

```
[
    {
        "currency_id": "ARS",
        "free_relist": false,
        "listing_exposure": "highest",
        "listing_fee_amount": 0,
        "listing_fee_details": {
            "fixed_fee": 0,
            "gross_amount": 0
        },
        "listing_type_id": "gold_pro",
        "listing_type_name": "Premium",
        "mapping": "gold_pro",
        "requires_picture": true,
        "sale_fee_amount": 2000,
        "sale_fee_details": {
            "financing_add_on_fee": 23,
            "fixed_fee": 200,
            "gross_amount": 2000,
            "meli_percentage_fee": 13,
            "percentage_fee": 36
        },
        "stop_time": "2043-06-01T00:00:00.000-04:00"
    },
    {
        "currency_id": "ARS",
        "free_relist": false,
        "listing_exposure": "highest",
        "listing_fee_amount": 0,
        "listing_fee_details": {
            "fixed_fee": 0,
            "gross_amount": 0
        },
        "listing_type_id": "gold_special",
        "listing_type_name": "Clásica",
        "mapping": "gold_special",
        "requires_picture": true,
        "sale_fee_amount": 850,
        "sale_fee_details": {
            "financing_add_on_fee": 0,
            "fixed_fee": 200,
            "gross_amount": 850,
            "meli_percentage_fee": 13,
            "percentage_fee": 13
        },
        "stop_time": "2043-06-01T00:00:00.000-04:00"
    },
     {
        "currency_id": "ARS",
        "free_relist": false,
        "listing_exposure": "lowest",
        "listing_fee_amount": 0,
        "listing_fee_details": {
            "fixed_fee": 0,
            "gross_amount": 0
        },
        "listing_type_id": "free",
        "listing_type_name": "Gratuita",
        "mapping": "free",
        "requires_picture": true,
        "sale_fee_amount": 0,
        "sale_fee_details": {
            "financing_add_on_fee": 0,
            "fixed_fee": 0,
            "gross_amount": 0,
            "meli_percentage_fee": 0,
            "percentage_fee": 0
        },
        "stop_time": "2023-08-05T00:00:00.000-04:00"
    }
]
```

## Filtrar por precio y listing type

Recupera información detallada sobre tipos de publicaciones filtrando por el precio y listing_type asociados.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?price=$PRICE&listing_type_id=$LISTING_TYPE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=5290&listing_type_id=gold_special
```

Respuesta:

```
[
    {
        "currency_id": "ARS",
        "free_relist": false,
        "listing_exposure": "highest",
        "listing_fee_amount": 0,
        "listing_fee_details": {
            "fixed_fee": 0,
            "gross_amount": 0
        },
        "listing_type_id": "gold_special",
        "listing_type_name": "Clásica",
        "mapping": "gold_special",
        "requires_picture": true,
        "sale_fee_amount": 887.7,
        "sale_fee_details": {
            "financing_add_on_fee": 0,
            "fixed_fee": 200,
            "gross_amount": 887.7,
            "meli_percentage_fee": 13,
            "percentage_fee": 13
        },
        "stop_time": "2043-06-01T00:00:00.000-04:00"
    }
]
```

## Filtrar por precio y cantidad

Recupera información detallada sobre tipos de publicaciones filtrando por el precio y cantidad asociados.

Llamada

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?price=$PRICE&quantity=$QUANTITY
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=10630&quantity=80
```

Respuesta:

```
 [
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_pro",
          "listing_type_name": "Premium",
          "mapping": "gold_pro",
          "requires_picture": true,
          "sale_fee_amount": 3826.8,
          "sale_fee_details": {
              "financing_add_on_fee": 23,
              "fixed_fee": 0,
              "gross_amount": 3826.8,
              "meli_percentage_fee": 13,
              "percentage_fee": 36
          },
          "stop_time": "2043-06-01T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_premium",
          "listing_type_name": "Oro Premium",
          "mapping": "gold_special",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_special",
          "listing_type_name": "Clásica",
          "mapping": "gold_special",
          "requires_picture": true,
          "sale_fee_amount": 1381.9,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 1381.9,
              "meli_percentage_fee": 13,
              "percentage_fee": 13
          },
          "stop_time": "2043-06-01T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "high",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold",
          "listing_type_name": "Oro",
          "mapping": "gold_special",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "mid",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "silver",
          "listing_type_name": "Plata",
          "mapping": "gold_special",
          "requires_picture": false,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "low",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "bronze",
          "listing_type_name": "Bronce",
          "mapping": "gold_special",
          "requires_picture": false,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "lowest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "free",
          "listing_type_name": "Gratuita",
          "mapping": "free",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      }
  ]
```

## Filtrar por precio y categoría

Recupera información detallada sobre tipos de publicaciones filtrando por el precio y categoría de la publicación asociados.

Lhamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?price=$PRICE&category_id=$CATEGORY_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=19500&category_id=MLA120353
```

Respuesta:

```
[
  {
      "currency_id": "ARS",
      "free_relist": false,
      "listing_exposure": "highest",
      "listing_fee_amount": 0,
      "listing_fee_details": {
          "fixed_fee": 0,
          "gross_amount": 0
      },
      "listing_type_id": "gold_pro",
      "listing_type_name": "Premium",
      "mapping": "gold_pro",
      "requires_picture": true,
      "sale_fee_amount": 7507.5,
      "sale_fee_details": {
          "financing_add_on_fee": 23,
          "fixed_fee": 0,
          "gross_amount": 7507.5,
          "meli_percentage_fee": 15.5,
          "percentage_fee": 38.5
      },
      "stop_time": "2043-06-01T00:00:00.000-04:00"
  },
  {
      "currency_id": "ARS",
      "free_relist": false,
      "listing_exposure": "highest",
      "listing_fee_amount": 0,
      "listing_fee_details": {
          "fixed_fee": 0,
          "gross_amount": 0
      },
      "listing_type_id": "gold_premium",
      "listing_type_name": "Oro Premium",
      "mapping": "gold_special",
      "requires_picture": true,
      "sale_fee_amount": 0,
      "sale_fee_details": {
          "financing_add_on_fee": 0,
          "fixed_fee": 0,
          "gross_amount": 0,
          "meli_percentage_fee": 0,
          "percentage_fee": 0
      },
      "stop_time": "2023-08-05T00:00:00.000-04:00"
  },
  {
      "currency_id": "ARS",
      "free_relist": false,
      "listing_exposure": "highest",
      "listing_fee_amount": 0,
      "listing_fee_details": {
          "fixed_fee": 0,
          "gross_amount": 0
      },
      "listing_type_id": "gold_special",
      "listing_type_name": "Clásica",
      "mapping": "gold_special",
      "requires_picture": true,
      "sale_fee_amount": 3022.5,
      "sale_fee_details": {
          "financing_add_on_fee": 0,
          "fixed_fee": 0,
          "gross_amount": 3022.5,
          "meli_percentage_fee": 15.5,
          "percentage_fee": 15.5
      },
      "stop_time": "2043-06-01T00:00:00.000-04:00"
  },
  {
      "currency_id": "ARS",
      "free_relist": false,
      "listing_exposure": "high",
      "listing_fee_amount": 0,
      "listing_fee_details": {
          "fixed_fee": 0,
          "gross_amount": 0
      },
      "listing_type_id": "gold",
      "listing_type_name": "Oro",
      "mapping": "gold_special",
      "requires_picture": true,
      "sale_fee_amount": 0,
      "sale_fee_details": {
          "financing_add_on_fee": 0,
          "fixed_fee": 0,
          "gross_amount": 0,
          "meli_percentage_fee": 0,
          "percentage_fee": 0
      },
      "stop_time": "2023-08-05T00:00:00.000-04:00"
  },
  {
      "currency_id": "ARS",
      "free_relist": false,
      "listing_exposure": "mid",
      "listing_fee_amount": 0,
      "listing_fee_details": {
          "fixed_fee": 0,
          "gross_amount": 0
      },
      "listing_type_id": "silver",
      "listing_type_name": "Plata",
      "mapping": "gold_special",
      "requires_picture": false,
      "sale_fee_amount": 0,
      "sale_fee_details": {
          "financing_add_on_fee": 0,
          "fixed_fee": 0,
          "gross_amount": 0,
          "meli_percentage_fee": 0,
          "percentage_fee": 0
      },
      "stop_time": "2023-08-05T00:00:00.000-04:00"
  },
  {
      "currency_id": "ARS",
      "free_relist": false,
      "listing_exposure": "low",
      "listing_fee_amount": 0,
      "listing_fee_details": {
          "fixed_fee": 0,
          "gross_amount": 0
      },
      "listing_type_id": "bronze",
      "listing_type_name": "Bronce",
      "mapping": "gold_special",
      "requires_picture": false,
      "sale_fee_amount": 0,
      "sale_fee_details": {
          "financing_add_on_fee": 0,
          "fixed_fee": 0,
          "gross_amount": 0,
          "meli_percentage_fee": 0,
          "percentage_fee": 0
      },
      "stop_time": "2023-08-05T00:00:00.000-04:00"
  },
  {
      "currency_id": "ARS",
      "free_relist": false,
      "listing_exposure": "lowest",
      "listing_fee_amount": 0,
      "listing_fee_details": {
          "fixed_fee": 0,
          "gross_amount": 0
      },
      "listing_type_id": "free",
      "listing_type_name": "Gratuita",
      "mapping": "free",
      "requires_picture": true,
      "sale_fee_amount": 0,
      "sale_fee_details": {
          "financing_add_on_fee": 0,
          "fixed_fee": 0,
          "gross_amount": 0,
          "meli_percentage_fee": 0,
          "percentage_fee": 0
      },
      "stop_time": "2023-08-05T00:00:00.000-04:00"
  }
]
```

## Filtrar por precio y moneda

Recupera información detallada sobre tipos de publicaciones filtrando por el precio y tipo de moneda local asociados.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?price=$PRICE&currency_id
=$CURRENCY_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=6649&currency_id=ARS
```

Respuesta:

```
[
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_pro",
          "listing_type_name": "Premium",
          "mapping": "gold_pro",
          "requires_picture": true,
          "sale_fee_amount": 2593.64,
          "sale_fee_details": {
              "financing_add_on_fee": 23,
              "fixed_fee": 200,
              "gross_amount": 2593.64,
              "meli_percentage_fee": 13,
              "percentage_fee": 36
          },
          "stop_time": "2043-06-01T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_premium",
          "listing_type_name": "Oro Premium",
          "mapping": "gold_special",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_special",
          "listing_type_name": "Clásica",
          "mapping": "gold_special",
          "requires_picture": true,
          "sale_fee_amount": 1064.37,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 200,
              "gross_amount": 1064.37,
              "meli_percentage_fee": 13,
              "percentage_fee": 13
          },
          "stop_time": "2043-06-01T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "high",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold",
          "listing_type_name": "Oro",
          "mapping": "gold_special",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "mid",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "silver",
          "listing_type_name": "Plata",
          "mapping": "gold_special",
          "requires_picture": false,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "low",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "bronze",
          "listing_type_name": "Bronce",
          "mapping": "gold_special",
          "requires_picture": false,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "lowest",
          "listing_fee_amount": 0,
          "listing_fee_details": {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "free",
          "listing_type_name": "Gratuita",
          "mapping": "free",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details": {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-08-05T00:00:00.000-04:00"
      }
  ]
```

## Filtrar por precio, listing_type y categoría

Recupera información detallada sobre tipos de publicaciones filtrando por listing_type y categoría de la publicación asociados.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices??category_id=$CATEGORY_ID&price=$PRICE&currency_id=$CURRENCY_ID&logistic_
  type=$LOGISTIC_TYPE&shipping_modes=$SHIPPING_MODES&listing_type_id=$LISTING_TYPE_ID
```

Ejemplo:

```
 curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/sites/MLA/listing_pricesprice=10345&listing_type_id=gold_special&category_id=MLA120350
```

Respuesta:

```
{
    "currency_id": "ARS",
    "free_relist": false,
    "listing_exposure": "highest",
    "listing_fee_amount": 0,
    "listing_fee_details": {
        "fixed_fee": 0,
        "gross_amount": 0
    },
    "listing_type_id": "gold_special",
    "listing_type_name": "Clásica",
    "requires_picture": true,
    "sale_fee_amount": 1603.48,
    "sale_fee_details": {
        "financing_add_on_fee": 0,
        "fixed_fee": 0,
        "gross_amount": 1603.48,
        "meli_percentage_fee": 15.5,
        "percentage_fee": 15.5
    },
    "stop_time": "2043-06-01T00:00:00.000-04:00"
}
```

## Filtrar por categorías, precio, tipo de moneda y tipo de logística

Recupera información detallada sobre tipos de publicaciones filtrando por la categoría, precio, tipo de moneda local, y tipo de logística asociados.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?category_id=$CATEGORY_ID&price=$PRICE&currency_id=$CURRENCY_ID&logistic_type=$LOGISTIC_TYPE
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?category_id=MLA6711&price=80.12&currency_id=ARS&logistic_type=drop_off
```

Respuesta:

```
[
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details":
          {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_pro",
          "listing_type_name": "Premium",
          "requires_picture": true,
          "sale_fee_amount": 26.46,
          "sale_fee_details":
          {
              "financing_add_on_fee": 10.96,
              "fixed_fee": 0,
              "gross_amount": 26.46,
              "meli_percentage_fee": 15.5,
              "percentage_fee": 26.46
          },
          "stop_time": "2043-05-11T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details":
          {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_premium",
          "listing_type_name": "Oro Premium",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details":
          {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-07-15T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "highest",
          "listing_fee_amount": 0,
          "listing_fee_details":
          {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold_special",
          "listing_type_name": "Clásica",
          "requires_picture": true,
          "sale_fee_amount": 15.5,
          "sale_fee_details":
          {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 15.5,
              "meli_percentage_fee": 15.5,
              "percentage_fee": 15.5
          },
          "stop_time": "2043-05-11T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "high",
          "listing_fee_amount": 0,
          "listing_fee_details":
          {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "gold",
          "listing_type_name": "Oro",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details":
          {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-07-15T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "mid",
          "listing_fee_amount": 0,
          "listing_fee_details":
          {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "silver",
          "listing_type_name": "Plata",
          "requires_picture": false,
          "sale_fee_amount": 0,
          "sale_fee_details":
          {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-07-15T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "low",
          "listing_fee_amount": 0,
          "listing_fee_details":
          {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "bronze",
          "listing_type_name": "Bronce",
          "requires_picture": false,
          "sale_fee_amount": 0,
          "sale_fee_details":
          {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-07-15T00:00:00.000-04:00"
      },
      {
          "currency_id": "ARS",
          "free_relist": false,
          "listing_exposure": "lowest",
          "listing_fee_amount": 0,
          "listing_fee_details":
          {
              "fixed_fee": 0,
              "gross_amount": 0
          },
          "listing_type_id": "free",
          "listing_type_name": "Gratuita",
          "requires_picture": true,
          "sale_fee_amount": 0,
          "sale_fee_details":
          {
              "financing_add_on_fee": 0,
              "fixed_fee": 0,
              "gross_amount": 0,
              "meli_percentage_fee": 0,
              "percentage_fee": 0
          },
          "stop_time": "2023-07-15T00:00:00.000-04:00"
      }
  ]
```

## Filtrar por precio, categoría, tags y listing_type

Recupera información detallada sobre tipos de publicaciones filtrando por el precio, categoría de la publicación, tags, y listing_type asociados.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE/listing_prices?price=$PRICE&category_id=$CATEGORY_ID&tags=$CAMPAIGN_TAG_ID&listing_type_id=$LISTING_TYPE
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_prices?price=100&category_id=MLA3551&tags=ahora-3&listing_type_id=gold_pro
```

Respuesta:

```
{
  "currency_id": "ARS",
  "free_relist": false,
  "listing_exposure": "highest",
  "listing_fee_amount": 0,
  "listing_fee_details": {
      "fixed_fee": 0,
      "gross_amount": 0
  },
  "listing_type_id": "gold_pro",
  "listing_type_name": "Premium",
  "requires_picture": true,
  "sale_fee_amount": 25.86,
  "sale_fee_details": {
      "financing_add_on_fee": 10.36,
      "fixed_fee": 0,
      "gross_amount": 25.86,
      "meli_percentage_fee": 15.5,
      "percentage_fee": 25.86
  },
  "stop_time": "2043-06-01T00:00:00.000-04:00"
}
```

## Consultar ítems de Supermarket

Para calcular el costo por vender de un ítem de Supermarket, enviá los nuevos campos **shipping_mode** , **logistic_type**  y **billable_weight** , junto con el parámetro **tags=supermarket_eligible** . En Argentina, **billable_weight**  es obligatorio y debe informarse en gramos.

### Consulta por categoría

Usá esta consulta cuando cotizás el ítem por su categoría.

**Llamada:**

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/sites/$SITE/listing_prices?category_id=$CATEGORY_ID&price=$PRICE&currency_id=$CURRENCY_ID&listing_type_id=$LISTING_TYPE_ID&tags=supermarket_eligible&logistic_type=$LOGISTIC_TYPE&shipping_mode=$SHIPPING_MODE&billable_weight=$BILLABLE_WEIGHT'
```

### Consulta por producto de catálogo

Para obtener un cálculo más preciso, enviá **catalog_product_id**  en lugar de **category_id** .

**Llamada:**

```
curl -X GET \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  'https://api.mercadolibre.com/sites/$SITE/listing_prices?catalog_product_id=$CATALOG_PRODUCT_ID&price=$PRICE&currency_id=$CURRENCY_ID&listing_type_id=$LISTING_TYPE_ID&tags=supermarket_eligible&logistic_type=$LOGISTIC_TYPE&shipping_mode=$SHIPPING_MODE&billable_weight=$BILLABLE_WEIGHT'
```

Elegí una de las dos consultas según la información disponible del ítem. No ejecutes ambas para la misma cotización: las dos devuelven la misma estructura de response.

**Respuesta:**

```
[
  {
    "currency_id": "ARS",
    "free_relist": false,
    "listing_exposure": "highest",
    "listing_fee_amount": 0,
    "listing_fee_details": {
      "fixed_fee": 0,
      "gross_amount": 0
    },
    "listing_type_id": "gold_special",
    "listing_type_name": "Clásica",
    "requires_picture": true,
    "sale_fee_amount": 670,
    "sale_fee_details": {
      "financing_add_on_fee": 0,
      "fixed_fee": 280,
      "gross_amount": 670,
      "meli_percentage_fee": 13,
      "percentage_fee": 13
    },
    "stop_time": "2046-08-29T00:00:00.000-04:00"
  }
]
```

**Parámetros de respuesta:**

- **sale_fee_amount:**  costo total por vender que debés mostrar.

- **sale_fee_details.fixed_fee:**  costo fijo por unidad vendida. Este importe ya está incluido en `sale_fee_amount`; no lo sumes nuevamente.

## Error

```
{
  "message": "The parameter 'price' has to be a number",
  "error": "bad_request",
  "status": 400,
  "cause": [
  ]
}
```

**Consultá la información actualizada sobre costos de venta:**

- [Argentina](https://www.mercadolibre.com.ar/landing/costos-de-venta).

- [Brasil](https://www.mercadolivre.com.br/landing/custos-de-venda).

- [Colombia](https://www.mercadolibre.com.co/landing/costos-de-venta).

- [México](https://www.mercadolibre.com.mx/landing/costos-de-venta).

**Conoce más sobre:** :

- [Campañas con cuotas para Marketplace](https://developers.mercadolibre.com.ar/es_ar/campanas-con-cuotas-para-marketplace) (aplica solo a MLA).

- [Tipos de publicación](https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos).
