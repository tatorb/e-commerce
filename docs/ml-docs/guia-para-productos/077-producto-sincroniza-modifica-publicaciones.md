<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones -->
<!-- Sección: Guía para productos -->

# Sincroniza y modifica publicaciones

Última actualización 21/10/2026

## Sincroniza y modifica publicaciones

Una vez que tienes publicaciones activas en nuestro marketplace, puedes actualizarles precio y stock sincronizándolas con otras plataformas. Además, puedes pausar publicaciones y agregar tiempo de realización de los productos.

## Consideraciones para actualizar ítems

- Identifica a qué canal corresponde tu publicación (Mercado Libre). 
 - Cuando el ítem está **activo**  puedes modificar:

- Available_quantity

- Precio

- Video

- Imágenes

- Descripción

- Envío

- Cuando el **ítem tiene ventas** , no puedes cambiar:

- Título

- Modo de compra

- Métodos de Pago distintos de Mercado Pago

- Cuando el **ítem no tiene ventas**  ("sold_quantity" = 0), puedes modificar:

- Título

- El tipo de publicación se puede modificar solo una vez.
 - Considera si la publicación tiene [variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones). 
 - Verifica [si el ítem tiene una oferta activa](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones#Consultar-ofertas-del-item).

## Actualizar ítems

**Importante:**

Antes de modificar el precio de un ítem mediante un PUT en **/items** , verifica si la publicación tiene la [**automatización de precios activa**](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#:~:text=access%20token%22%0A%7D-,Obtener%20automatizaci%C3%B3n%20de%20precios%20de%20%C3%ADtems%20por%20vendedor,-Este%20recurso%20devuelve). A partir del **18 de marzo de 2026** , las solicitudes que actualicen únicamente el campo **price**  serán [rechazadas con un 400 Bad Request](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#:~:text=el%20front%2Dend.-,Qu%C3%A9%20cambia%3F,-Las%20peticiones%20PUT). Por otro lado, las solicitudes que incluyan el campo **price**  junto con otros atributos serán procesadas con un 200 OK, sin embargo, el valor enviado en **price**  será ignorado y la respuesta devolverá un warning informando que el precio no fue actualizado.

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "title": "Your new title",
  "price": 1000
}
https://api.mercadolibre.com/items/$ITEM_ID
```

### Descripciones

En nuestra documentración **Descripción de productos**  [crear, actualizar o eliminar una descripc un ítem](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos).

### Imágenes

Siempre puedes agregar o reemplazar imágenes de ítems. Mira más sobre [Trabajar con imágenes](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes).

### Tipos de publicación

Para mejorar o actualizar el tipo de publicación puedes revisar nuestros [Tipos y exposición de publicaciones](https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos).

## Flujo y estados de las publicaciones

**Active** : la publicación se encuentra activa y tiene la posibilidad de recibir ofertas o preguntas. Puede cambiar la exposición de la publicación (upgrade de listing type). 
 **Payment required** : este caso se da cuando un usuario con deuda o baja política de crédito realiza una publicación y se reactiva automáticamente una vez que el usuario realiza el pago. 
 **Under Review** : el ítem se encuentra bajo revisión por Mercado Libre por los siguientes motivos:

- warning: ítem que sigue activo, pero tiene una corrección pendiente por parte del usuario. Si no se corrige en 2 días pasa a waiting_for_patch.

- waiting_for_patch: ítem oculto hasta que el usuario corrija la infracción reportada.

- held: ítem oculto a la espera de una moderación manual por parte de Mercado Libre.

- pending_documentation: ítem oculto hasta que el usuario presente la documentación solicitada.

- forbidden: ítem dado de baja por moderación. En esta condición, el elemento sólo puede ser eliminado directamente.

**Paused** : puede ser automáticamente (out of stock) o por decisión del usuario (paused_by_seller).

- out of stock: el ítem fue pausado por falta de stock y será activado automáticamente cuando sea repuesto.

- paused_by_seller: Cuando el vendedor elige pausar el ítem, este puede o no tener unidades en stock. En caso de que no haya stock (out_of_stock) y el vendedor vuelva a pausar el ítem, el substatus cambia a paused_by_seller. Incluso si luego se reponen unidades al stock, el ítem no se activa automáticamente, permanecerá pausado hasta que el vendedor decida cambiar el status nuevamente.

- picture downloading pending: el ítem fue pausado hasta que la imagen tipo source se descargue correctamente y será activado cuando esto suceda.

**Closed:**  este es el estado final del ítem y se puede dar por las siguientes causas:

- waiting for patch

- held

- expired: se alcanzó la fecha de finalización de la publicación (end_time) y aún tiene stock.

- deleted: se agrega cuando el ítem está cerrado y el seller decide eliminarlo. O cuando el ítem expira y se republica automaticamente.

- suspended

- freezed

Luego de un periodo de tiempo, los ítems finalizados dejaran de mostrarse para ser consultados.

**Inactive** : si no se realiza la corrección necesaria para salir del estado under review el ítem pasa a inactive. La corrección se puede encontrar en la cuenta del usuario en la sección de ventas en la solapa de publicaciones "revisar".

### Los ítems pueden tener estado:

- **cerrado** : finaliza tu publicación. Una vez cerrado, no se puede volver a activar, pero [puedes republicar ítems](https://developers.mercadolibre.com.ar/es_ar/re-publica).

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "status":"closed"
}
https://api.mercadolibre.com/items/$ITEM_ID
```

- **pausado** : pausa tu publicación. Una vez pausado, no será visible para otros usuarios de Mercado Libre, pero no se cerrará y se podrá reactivar más tarde.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "status":"paused"
}
https://api.mercadolibre.com/items/$ITEM_ID
```

- **activo** : reactiva un artículo previamente pausado.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "status":"active"
}
https://api.mercadolibre.com/items/$ITEM_ID
```

Nota:

Recuerda que el valor distingue entre mayúsculas y minúsculas y debes enviar en minúscula.

## Eliminar publicaciones

Recuerda que los items cerrados serán descartados automáticamente y si aún necesitas eliminar un ítems, por ejemplo con estado: payment_required que no responderán al estado ‘cerrado’, debes:

Ejemplo:

- 1. Actualizar el estado a cerrado:

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d { "status": "closed" } https://api.mercadolibre.com/items/$ITEM_ID`

- 2. Eliminar el ítem:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "deleted": "true"
}
https://api.mercadolibre.com/items/$ITEM_ID
```

Notas:

- En caso que al hacer el segunda PUT obtengas el error: message: item optimistic locking error: conflict status: 409 cause: array(0) Se debe a que deberás esperar unos segundos hasta que se actualice la información.
- Una vez eliminada la publicación se continuará viendo en la VIP por un período de tiempo corto bajo la leyenda "publicación finalizada".
- Para ítems con estado "under_review" y subsatus "forbidden" sólo se debe realizar el segundo PUT de exclusión.

# Stock de ítems

## Actualizar el stock

Para actualizar el stock de un ítem debes agregar un valor en el campo “available_quantity” teniendo en cuenta:

- Si haces **PUT del available_quantity = 0**  cambiará el estado a “paused” con sub estado out_of_stock.

- Si haces **PUT del available_quantity mayor a 0**  y el sub estado es out_of_stock cambiará el estado a activo sin sub estado out_of_stock.

- Sólo puedes **pausar un ítem enviando available_quantity = 0**  cuando sea del tipo **condition = new**  y no sea **listing_type = free** .

Nota:

Este cambio es posible hacerlo tanto en ítems como en variaciones de un ítem.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "available_quantity": 6
}
https://api.mercadolibre.com/items/$ITEM_ID
```

## Stock de ítems usados

Conoce las categorías y países con límite de 1 (un) ítem con condición usada ("condition":"used").

Referencias MLA MLM MLC MPE

| Category_id | Categoría |
| --- | --- |
| ID de la categoría | Nombre de la categoría |

| Category_id | Categoría |
| --- | --- |
| MLA1322 | Tenis, Padel y Squash |
| MLA3114 | Accesorios de Moda |
| MLA47786 | Montañismo y Trekking |
| MLA430281 | Trajes de Baño |

| Category_id | Categoría |
| --- | --- |
| MLM1456 | Accesorios de Moda - Lentes |
| MLM5529 | Accesorios de Moda - Otros |
| MLM438426 | Deportes y Fitness - Esqui y Snowboard - Accesorios |

| Category_id | Categoría |
| --- | --- |
| MLC3724 | Zapatillas |
| MLC1339 | Ropa Deportiva |
| MLC158467 | Poleras |
| MLC7022 | Bolsos, Carteras y Mochilas |
| MLC158340 | Chaquetas |
| MLC158425 | Vestidos |
| MLC158583 | Pantalones y Jeans |
| MLC158350 | Zapatillas |
| MLC3111 | Calzados |
| MLC158335 | Camisas |
| MLC158382 | Polerones |
| MLC158342 | Blusas |
| MLC158340 | Chaquetas, Parkas y Blazers |
| MLC158457 | Faldas |
| MLC440323 | Ropa Interior y de Dormir |
| MLC158416 | Chalecos |
| MLC158307 | Bermudas y Shorts |
| MLC440434 | Uniformes y Ropa de Trabajo |
| MLC1455 | Vestuario para Bebés |
| MLC455528 | Abrigos |
| MLC413460 | Lotes de Ropa |
| MLC3111 | Calzado |
| MLC440371 | Chalecos, Sweaters y Cardigans |
| MLC158422 | Sweaters |
| MLC158473 | Trajes |
| MLC440654 | Calzas |
| MLC440371 | Cardigans, Sweaters y Chalecos |
| MLC440687 | Ropa Deportiva |
| MLC158340 | Chaquetas y Parkas |
| MLC158473 | Ternos |
| MLC1455 | Ropa para Bebés |
| MLC440714 | Enteritos |
| MLC440679 | Trajes de Baño |

| Category_id | Categoría |
| --- | --- |
| MPE3724 | Zapatillas Deportivas |
| MPE3724 | Zapatillas |
| MPE417397 | Ropa Deportiva |
| MPE6585 | Zapatillas |
| MPE127832 | Vestidos |
| MPE127835 | Casacas |
| MPE127808 | Calzado |
| MPE127752 | Bolsos, Carteras y Billeteras |
| MPE127828 | Pantalones y Jeans |
| MPE127835 | Casacas, Sacos y Blazers |
| MPE127752 | Equipaje, Bolsos y Carteras |
| MPE127828 | Pantalones, Jeans y Joggers |
| MPE127827 | Shorts |
| MPE431499 | Polos |
| MPE127831 | Polos |
| MPE127894 | Chompas |
| MPE431500 | Blusas |
| MPE455528 | Abrigos |
| MPE431498 | Camisas |
| MPE443832 | Cardigans, Chompas y Chalecos |
| MPE127833 | Chalecos |
| MPE443907 | Poleras |
| MPE443830 | Ropa Deportiva |
| MPE443973 | Ternos |
| MPE443920 | Ropa Interior y de Dormir |
| MPE443969 | Enterizos y Overoles |
| MPE413460 | Lotes de Ropa |
| MPE127826 | Poleras |
| MPE127834 | Cardigans |
| MPE443975 | Ropa y Calzado de Bebé |
| MPE430281 | Ropa de Baño |
| MPE443953 | Uniformes y Ropa de Trabajo |
| MPE443951 | Leggings |
| MPE127830 | Ropa Interior |
| MPE417479 | Ropa de Danza y Patinaje |

# Disponibilidad de stock (MANUFACTURING_TIME)

Importante:

Esta funcionalidad está disponible en Argentina, Brasil, Uruguay, Colombia y México.

Puedes utilizar la funcionalidad para mostrar a los compradores cuánto tiempo tardas en disponibilizar los productos para vender. Esto aplica tanto a productos que requieren preparación previa como a aquellos con demoras logísticas.

Situaciones como:

- Realización de pedidos por encargo.

- Fabricación de productos.

- Personalización de productos para venderlos.

- Cuando recibas stock del proveedor de manera periódica.

La publicación quedará activa aunque los productos no estén listos para la venta y los compradores podrán comprarlo sabiendo el día exacto que llegará. Cuanto más tiempo agregues, menos exposición tendrán las publicaciones. Siempre mostraremos primero las que tengan stock disponible, por lo tanto asegúrate de utilizarla solo cuando sea necesario.

### Consultar categoría con manufacturing time

En sale_terms de un ítem podrás especificar el tiempo de disponibilidad de stock de tu publicación usando el sale_term MANUFACTURING_TIME.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/sale_terms
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1577/sale_terms
```

Respuesta:

```
[
  {
    "id": "INVOICE",
    "name": "Facturación",
    "tags": {
      "hidden": true,
      "multivalued": true
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 1,
    "value_type": "list",
    "values": [
      {
        "id": "6891885",
        "name": "Factura A"
      },
      {
        "id": "6891886",
        "name": "Factura B"
      },
      {
        "id": "6891887",
        "name": "Factura C"
      },
      {
        "id": "6891888",
        "name": "No factura"
      }
    ],
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "SUBSCRIBABLE",
    "name": "Suscribible",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "boolean",
    "values": [
      {
        "id": "242084",
        "name": "No",
        "metadata": {
          "value": false
        }
      },
      {
        "id": "242085",
        "name": "Sí",
        "metadata": {
          "value": true
        }
      }
    ],
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "PRICE_SUBSCRIPTION",
    "name": "Precio por suscripción",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "USD",
        "name": "USD"
      },
      {
        "id": "UVA",
        "name": "UVA"
      },
      {
        "id": "ARS",
        "name": "ARS"
      }
    ],
    "default_unit": "USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "SUBSCRIPTION_FREE_SHIPPING",
    "name": "Envío gratis por suscripciones",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "boolean",
    "values": [
      {
        "id": "242084",
        "name": "No",
        "metadata": {
          "value": false
        }
      },
      {
        "id": "242085",
        "name": "Sí",
        "metadata": {
          "value": true
        }
      }
    ],
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "LOYALTY_LEVEL_1",
    "name": "Precio por nivel 1 de loyalty",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "USD",
        "name": "USD"
      },
      {
        "id": "UVA",
        "name": "UVA"
      },
      {
        "id": "ARS",
        "name": "ARS"
      }
    ],
    "default_unit": "USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "LOYALTY_LEVEL_2",
    "name": "Precio por nivel 2 de loyalty",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "USD",
        "name": "USD"
      },
      {
        "id": "UVA",
        "name": "UVA"
      },
      {
        "id": "ARS",
        "name": "ARS"
      }
    ],
    "default_unit": "USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "LOYALTY_LEVEL_3",
    "name": "Precio por nivel 3 de loyalty",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "USD",
        "name": "USD"
      },
      {
        "id": "UVA",
        "name": "UVA"
      },
      {
        "id": "ARS",
        "name": "ARS"
      }
    ],
    "default_unit": "USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "LOYALTY_LEVEL_4",
    "name": "Precio por nivel 4 de loyalty",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "USD",
        "name": "USD"
      },
      {
        "id": "UVA",
        "name": "UVA"
      },
      {
        "id": "ARS",
        "name": "ARS"
      }
    ],
    "default_unit": "USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "LOYALTY_LEVEL_5",
    "name": "Precio por nivel 5 de loyalty",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "USD",
        "name": "USD"
      },
      {
        "id": "UVA",
        "name": "UVA"
      },
      {
        "id": "ARS",
        "name": "ARS"
      }
    ],
    "default_unit": "USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "LOYALTY_LEVEL_6",
    "name": "Precio por nivel 6 de loyalty",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "USD",
        "name": "USD"
      },
      {
        "id": "UVA",
        "name": "UVA"
      },
      {
        "id": "ARS",
        "name": "ARS"
      }
    ],
    "default_unit": "USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "CHECKOUT_EXCHANGE_RATE",
    "name": "Tipo de cambio para checkout",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "ARS/USD",
        "name": "ARS/USD"
      }
    ],
    "default_unit": "ARS/USD",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "DISCOUNT_SUBSCRIPTION",
    "name": "Descuento por suscripciones",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "%",
        "name": "%"
      }
    ],
    "default_unit": "%",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "WARRANTY_TYPE",
    "name": "Tipo de garantía",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "list",
    "values": [
      {
        "id": "2230280",
        "name": "Garantía del vendedor"
      },
      {
        "id": "2230279",
        "name": "Garantía de fábrica"
      },
      {
        "id": "6150835",
        "name": "Sin garantía"
      }
    ],
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "WARRANTY_TIME",
    "name": "Tiempo de garantía",
    "tags": {
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "días",
        "name": "días"
      },
      {
        "id": "meses",
        "name": "meses"
      },
      {
        "id": "años",
        "name": "años"
      }
    ],
    "default_unit": "meses",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
  {
    "id": "MANUFACTURING_TIME",
    "name": "Tiempo de elaboración",
    "tags": {
      "hidden": true
    },
    "hierarchy": "SALE_TERMS",
    "relevance": 2,
    "value_type": "number_unit",
    "value_max_length": 255,
    "allowed_units": [
      {
        "id": "días",
        "name": "días"
      }
    ],
    "default_unit": "días",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  }
]
```

### Consideraciones

- No puedes configurar valores superiores a 60 días.

- No aplica a la vertical VIS (Inmuebles, Automóviles y Servicios).

- No es compatible con ítems con envíos Flex o Fulfillment.

- Al agregar o modificar el sale term, utiliza alguna unidad disponible (ver en **allowed_units** ). Siguiendo el ejemplo anterior, puedes apreciar que solo la unidad “días” está disponible para usarse dentro de la categoría MLA1577.

Nota:

Las validaciones anteriores no serán aplicadas en tiempo real al interactuar con el recurso de ítems. En caso que alguna no se cumpla devolveremos un warning code: delete.item.sale_terms.manufacturing_time especificando la acción que se ejecutará en segundo plano sobre el sale_term.

### Crear ítem con disponibilidad de stock

Para crear una publicación con MANUFACTURING_TIME, primero debes consultar y verificar que la categoría en la que deseas publicar tenga disponible MANUFACTURING_TIME.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
  "site_id": "MLA",
  "title": "Item de testeo, por favor no contactar --kc:off",
  "category_id": "MLA1577",
  "price": 4000,
  "currency_id": "ARS",
  "pictures": [{
    "source": "http://mla-s2-p.mlstatic.com/777099-MLA26466460545_112017-O.jpg"
  }],
  "buying_mode": "buy_it_now",
  "listing_type_id": "gold_special",
  "condition": "new",
  "available_quantity": 10,
  "sale_terms": [{
    "id": "MANUFACTURING_TIME",
    "value_name": "20 días"
  }]
}
https://api.mercadolibre.com/items
```

### Modificar disponibilidad de stock

Realiza un PUT similar al anterior especificando el nuevo valor del sale_term en value_name.

Ejemplo:

```
curl -X PUT -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' -d
{
   "sale_terms": [{
       "id": "MANUFACTURING_TIME",
       "value_name": "30 días"
   }]
}
https://api.mercadolibre.com/items/11000222
```

### Eliminar disponibilidad de stock

Para eliminar el sale term MANUFACTURING_TIME, envia null en los campos value_id y value_name del ítem.

Llamada:

```
curl -X PUT -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' -d
{
  "sale_terms": [
    {
      "id": "MANUFACTURING_TIME",
      "value_id": null
      "value_name": null
    }
  ]
}
https://api.mercadolibre.com/items/110002223
```

## Cantidad máxima de compra

Importante:

A partir del 30/10/2026, eliminaremos el límite de unidades por compra en las publicaciones de todos los dominios. Los compradores podrán adquirir más unidades de una misma publicación, según el stock disponible. Desde esa fecha, ignoraremos PURCHASE_MAX_QUANTITY en las solicitudes POST y PUT a /items (HTTP 200) y actualizaremos automáticamente a null su valor en sale_terms para las publicaciones activas que lo tengan configurado. .

Permite limitar las unidades de compra disponibles. Consulta si la categoría tiene la condición de cantidad máxima de compra por operación con el $CATEGORY_ID.

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLM167991/sale_terms
```

Respuesta:

```
{
  [
[...]
{
        "id": "PURCHASE_MAX_QUANTITY",
        "name": "Cantidad máxima de compra",
        "tags": {
            "hidden": true,
            "read_only": true
        },
        "hierarchy": "SALE_TERMS",
        "relevance": 2,
        "value_type": "number",
        "value_max_length": 18,
        "attribute_group_id": "OTHERS",
        "attribute_group_name": "Otros"
    }
[...]
]
}
```

### Cargar la cantidad máxima de compra en una publicación

Desde Mercado Libre revisaremos aquellos valores ingresados que estén por debajo del valor mínimo permitido “1” en un proceso offline, eliminando el sale_term de los casos que no cumplan con el requisito.

Llamada:

```
curl -X PUT 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json'
{...}
https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -H 'Accept: application/json' -d
{
   "sale_terms":[
      {
         "id":"PURCHASE_MAX_QUANTITY",
         "value_name":"10"
      }
   ]
}
https://api.mercadolibre.com/items/11122233
```

En este caso, la cantidad máxima de compra es de 10 unidades.

Conoce más sobre [Sincronizamos tus publicaciones](https://vendedores.mercadolibre.com.ar/nota/sincronizamos-tus-publicaciones-de-catalogo-y-listado-general/).

## Número de pedimento para Reventa (MLM)

Para los ítems de Reventa en México (MLM), puedes enviar o editar el número de pedimento mediante `PUT /items/$ITEM_ID`. Incluye el atributo `IMPORT_DECLARATION_NUMBER` dentro de `attributes` y envía el número de pedimento en `value_name`.

Nota:

Esta funcionalidad está disponible exclusivamente para el site MLM (México).

Ejemplo de llamada:

```
curl -X PUT "https://api.mercadolibre.com/items/$ITEM_ID" \
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "attributes": [
    {
      "id": "IMPORT_DECLARATION_NUMBER",
      "value_name": "1234"
    }
  ]
}'
```

Ejemplo de respuesta (fragmento):

La respuesta mantiene la estructura del ítem e incluye el número de pedimento en `attributes`.

```
{
  ...
  "attributes": [
    ...
    {
      "id": "IMPORT_DECLARATION_NUMBER",
      "name": "Número de pedimento",
      "value_id": null,
      "value_name": "1234",
      "value_struct": null,
      "attribute_group_id": "OTHERS",
      "attribute_group_name": "Otros",
      "values": [
        {
          "id": null,
          "name": "1234",
          "struct": null
        }
      ],
      "value_type": "number"
    },
    ...
  ],
  ...
}
```
