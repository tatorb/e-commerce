<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publica-productos -->
<!-- Sección: Guía para productos -->

# Publicar productos

Última actualización 09/01/2026

## Publicar productos

Importante:

Para nuevos desarrollos de flujos de publicación, es necesario llevar en consideración la nueva manera de publicar en Mercado Libre que es **User Products** . Los invitamos a leer nuestra [documentación](https://developers.mercadolibre.com.ar/es_ar/user-products) y identificar sus debidas fechas de activación.

En la API de Mercado Libre, las publicaciones son artículos que contienen productos con atributos que puedes vender o comprar. Los usuarios no pueden intercambiar información de contacto de inmediato. Por eso, cada vez que existe la intención de comprar un producto, los compradores potenciales pueden realizar preguntas y se crea un pedido tanto para el comprador como para el vendedor con el detalle de la transacción, como una venta o compra para cada uno. En ese momento, la información de contacto será visible entre los usuarios.

## Detalle de las publicaciones

Cuando un usuario selecciona un artículo del resultado, esta página muestra los siguientes detalles del artículo:

- Item_id

- Título

- Categoría

- Imágenes

- Precio

- Ciudad

- Cantidad vendida

- Preguntas

- Reputación del vendedor

Importante:

Eliminamos el atributo exclusive_channel del recurso /items. **Para crear o modificar correctamente el canal de publicación debes usar el array channels**  caso contrario recibirás mensaje de error: Item attribute EXCLUSIVE_CHANNEL is no longer supporte.

Importante:

El atributo **"condition"**  de la API de ítems será deprecado y reemplazado por **"item_condition"** . Este cambio permite una gestión más precisa y flexible de las condiciones de los ítems.

Puntos clave

- El atributo **"condition"**  seguirá disponible por motivos de retrocompatibilidad.

- Para nuevas implementaciones utilizar **"item_condition"**  dentro de "attributes".

- Para consultar los valores admitidos de **"item_condition"**  según la categoría, acceda a: [/categories/$CATEGORY_ID/attributes](https://developers.mercadolibre.com.ar/es_ar/dominios-y-categorias#close:~:text=/categories/%24CATEGORY_ID/attributes)

## Consultar productos

Nota:

Desde ahora puedes obtener un nuevo parámetro **“value_type”**  dentro del detalle de los atributos de los ítems. Este campo entrega información del tipo de dato que se espera. ejemplo: string, number, etc.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/items/MLA1136716168
```

Respuesta:

```
{

   "id": "MLA1136716168",
   "site_id": "MLA",
   "title": "Zapatillas Avid Fof - Test Item",
   "seller_id": 1108966308,
   "category_id": "MLA109027",
   "official_store_id": null,
   "price": 15000,
   "base_price": 15000,
   "original_price": null,
   "currency_id": "ARS",
   "initial_quantity": 2,
   --- No aparece sin token propietario
   "available_quantity": 2,
   --- No aparece sin token propietario
   "sold_quantity": 0,
   "sale_terms": [],
   "buying_mode": "buy_it_now",
   "listing_type_id": "gold_pro",
   "start_time": "2022-05-10T21:55:46.000Z",
   "historical_start_time": "2022-05-10T21:55:46.000Z",
   "stop_time": "2042-05-05T04:00:00.000Z",
   "condition": "new",
   "permalink": "https://articulo.mercadolibre.com.ar/MLA-1136716168-zapatillas-avid-fof-test-item-_JM",
   "thumbnail_id": "963513-MLA49868862376_052022",
   "thumbnail": "http://http2.mlstatic.com/D_963513-MLA49868862376_052022-I.jpg",
   "pictures": [
       {
           "id": "963513-MLA49868862376_052022",
           "url": "http://http2.mlstatic.com/D_963513-MLA49868862376_052022-O.jpg",
           "secure_url": "https://http2.mlstatic.com/D_963513-MLA49868862376_052022-O.jpg",
           "size": "500x411",
           "max_size": "898x739",
           "quality": ""
       }
   ],
   "video_id": null,
   "descriptions": [],
   "accepts_mercadopago": true,
   "non_mercado_pago_payment_methods": [],
   "shipping": {
       "mode": "not_specified",
       "methods": [],
       "tags": [
           "adoption_required"
       ],
       "dimensions": null,
       "local_pick_up": false,
       "free_shipping": false,
       "logistic_type": "not_specified",
       "store_pick_up": false
   },
   "international_delivery_mode": "none",
   "seller_address": {
       "id": 0
   },
   "seller_contact": null,
   "location": {},
   "coverage_areas": [],
   "attributes": [
       {
           "id": "AGE_GROUP",
           "name": "Edad",
           "value_id": "6725189",
           "value_name": "Adultos"
       },
       {
           "id": "BRAND",
           "name": "Marca",
           "value_id": "11823494",
           "value_name": "Propia"
       },
       {
           "id": "FOOTWEAR_TYPE",
           "name": "Tipo de calzado",
           "value_id": "517583",
           "value_name": "Zapatilla"
       },
       {
           "id": "GENDER",
           "name": "Género",
           "value_id": "339666",
           "value_name": "Hombre"
       },
       {
           "id": "ITEM_CONDITION",
           "name": "Condición del ítem",
           "value_id": "2230284",
           "value_name": "Nuevo"
       },
       {
           "id": "MODEL",
           "name": "Modelo",
           "value_id": null,
           "value_name": "EQ2122"
       },
       {
           "id": "SIZE_GRID_ID",
           "name": "ID de la guía de talles",
           "value_id": null,
           "value_name": "210052"
       },
       {
           "id": "STYLE",
           "name": "Estilo",
           "value_id": "6694773",
           "value_name": "Urbano"
       }
   ],
   "listing_source": "",
   "variations": [
       {
           "id": 174497701554,
           "price": 15000.00,
           "attribute_combinations": [
               {
                   "id": "COLOR",
                   "name": "Color",
                   "value_id": "52049",
                   "value_name": "Negro"
               },
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "value_id": "11505183",
                   "value_name": "45,0 AR"
           ],
           "available_quantity": 1,
           "sold_quantity": 0,
           "sale_terms": [],
           "picture_ids": [
               "963513-MLA49868862376_052022"
           ],
           "catalog_product_id": null
       },
       {
           "id": 174497701555,
           "price": 15000.00,
           "attribute_combinations": [
               {
                   "id": "COLOR",
                   "name": "Color",
                   "value_id": "52049",
                   "value_name": "Negro"
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "value_id": "11505178",
                   "value_name": "44,0 AR"
               }
           ],
           "available_quantity": 1,
           "sold_quantity": 0,
           "sale_terms": [],
           "picture_ids": [
               "963513-MLA49868862376_052022"
           ],
           "catalog_product_id": null
       }
   ],
   "status": "active",
   "sub_status": [],
   "tags": [
       "test_item",
       "good_quality_picture",
       "good_quality_thumbnail",
       "immediate_payment"
   ],
   "warranty": null,
   "catalog_product_id": null,
   "domain_id": "MLA-SNEAKERS",
   "parent_item_id": null,
   "deal_ids": [],
   "automatic_relist": false,
   "date_created": "2022-05-10T21:55:46.000Z",
   "last_updated": "2022-05-22T09:49:16.725Z",
   "total_listing_fee": null,
   "health": 0.85,
   "catalog_listing": false,
   "channels": [
       "marketplace", --- No aparece sin token propietario
            
   ],
   "bundle": null
   
}
```

## Atributos

Cuando creas un artículo, algunos de los campos son obligatorios, mientras que otros se pueden omitir o los agregaremos automáticamente. Definirán cómo se muestra el artículo, cómo pueden comprarlo los compradores y la posición en los resultados de la búsqueda, entre otras variables.

### Título

Importante:

En la nueva manera de publicar **(User Products)**  el campo titulo cambiará de función, y no deberá ser enviado en la publicación. Necesario identificar las debidas fechas de activación en la [documentación](https://developers.mercadolibre.com.ar/es_ar/precio-variacion#:~:text=Publicar%20un%20%C3%ADtem-,Importante,-%3A) de **User Products** .

El título es la clave para que los compradores encuentren el producto que están buscando. Sigue estas recomendaciones para que sea lo más claro posible y también para evitar algunas infracciones:

- **Sigue la estructura:** Producto + Marca + modelo del producto + algunas especificaciones que ayuden a identificar el producto.

- Ejemplo: Microondas Grill BGH Quick Chef B223D plata 23L 220V

- **Evita dar información de otros beneficios** , como devoluciones, envío gratis o pagos en cuotas.

- **Si el producto es nuevo, usado o reacondicionado** , no lo incluyas en el título, cárgalo en las características. Esta información se mostrará en el detalle de la publicación.

- **Si vendes el mismo producto pero con distintos colores,**  no pongas el color en el título. [Crea variantes](https://developers.mercadolibre.com.ar/es_ar/variaciones), así todo estará en una sola publicación.

- **Si realizas algún descuento,**  usa las etiquetas especiales o indica el porcentaje de la promoción. [Descubre cómo hacerlo](https://developers.mercadolibre.com.ar/es_ar/central-de-promociones).

- **No está permitido mencionar stock** ,si lo haces tu publicación será moderada. El límite del título de la publicación está establecido por la categoría a la que pertenece el mismo ("max_title_length").

- **No menciones marcas de terceros** Si lo haces, que sea **únicamente para indicar la compatibilidad de tu producto con otras marcas**  y siguiendo estas indicaciones:

- **Para productos compatibles que tienen marca propia** : [Nombre del producto] + [Marca de tu producto] + **“para”**  o **“compatible con”**  + [Marcas con la que es compatible] Ejemplo: -Adaptador Mimarca **para**  speaker Tedge -Adaptador Mimarca **compatible con**  speaker Tedge   **Para productos compatibles SIN marca** : [Nombre del producto] + **“para”**  o **“compatible con”**  + [Marcas con la que es compatible]: Ejemplo: - Adaptador para speaker Tedge - Adaptador compatible con speaker Tedge

- **Separa las palabras con espacios** no uses signos de puntuación ni símbolos.

- Revisa que no tenga errores de ortografía.

Nota:

- En Colombia, los títulos se actualizarán con el precio por unidad de medida del producto cumpliendo con la ley de **Precio por Unidad de Medida** .
 - Podrás hacer todos los cambios que necesites [realizando un PUT al recurso items](https://developers.mercadolibre.com.ar/es_ar/items-y-busquedas?nocache=true#Valores-en-campos-sold-quantity-y-available-quantity) modificando el campo tittle siempre que sold_quantity sea 0.

### Descripción

Antes de crear la [descripción de un producto](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos), debes crear la publicación sin descripción pero incluyendo todos los atributos e información detallada del ítem.

### Estado

Al publicar un artículo, debes declarar si el estado es nuevo o usado. Este atributo es obligatorio para completar una operación de publicación. Para ítems usados en la categoría **moda/deportes**  solo podrás crear ítems con avaliable quantity =1, y al realizar una venta el ítems pasará a status: closed. Esta funcionalidad aplica solo para Argentina, Brasil, México y Colombia.

### Cantidad disponible

Nota:

Este campo solamente podrá ser visualizado cuando se consulte el ítem con el token propietario de esta publicación. Es decir, solamente el vendedor podrá visualizar información de su publicación. En caso de que la consulta sea con token que no es del propietario, este campo no va a estar disponible.

Este atributo define el stock, que es la cantidad de productos disponibles para la venta de este artículo. El tipo de publicación elegido define el valor más alto. Para más detalles, consulta la sección [tipos de publicación](https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos).

Además, cuando deseas publicar productos de Fulfillment puedes especificar la cantidad disponible en cero, modificando el campo **available_quantity**  en 0. De esta manera, la publicación se creará con estado **pausado**  y subestado **out_of_stock** . Esto permitirá que no tengas ventas y no las puedas entregar por falta de logística. ¿Qué sucede cuando realizas PUT a ítems y no tienes stock? Admite las mismas operaciones que un ítem pausado por falta de stock, es decir, no podrás activarlo y deberás agregar unidades para que se active automáticamente.

Importante:

Esta posibilidad aplica solo para Argentina, México y Brasil donde operamos Fulfillment.

Ejemplo:

```
curl -X POST-H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d

'{
    ...
    "available_quantity": 0,
    ...
}'
 
https://api.mercadolibre.com/items/$ITEM_ID
```

Respuesta:

```
{
    "id": "MLB1374737433",
    "site_id": "MLB",
    "title": "Item De Teste - Não Comprar",
    "base_price": 10,
    ...
    "initial_quantity": 0,
    "available_quantity": 0,
    "sold_quantity": 0,
    ...
    "status": "paused",
    "sub_status": [
        "out_of_stock"
    ],
    ...
}
```

### Imágenes

Las buenas imágenes pueden hacer que un artículo sea más atractivo y ofrecer a los compradores una idea más certera de su aspecto. Básicamente, deberías agregar un conjunto de hasta seis imágenes URL en el JSON.

```
{
 ....
 "pictures":[
  {"source":"http://yourServer/path/to/your/picture.jpg"},
  {"source":"http://yourServer/path/to/your/otherPicture.gif"},
  {"source":"http://yourServer/path/to/your/anotherPicture.png"}
 ]
 ...
}
```

Te recomendamos no utilizar servidores lentos para alojar tus imágenes porque pueden generar desventajas al momento de publicar. También puedes agregar o cambiar las imágenes de tu artículo aquí más adelante. Por favor, [lee más sobre este tema para conocer qué tipo de imágenes se permiten y cómo trabajar con ellas](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes).

### Categoría

Antes de publicar un producto, utiliza el [predictor de categorías](https://developers.mercadolibre.com.ar/es_ar/categoriza-productos) para definir en base al título, la categoría adecuada donde publicar un producto. Recuerda que si el vendedor elige otra categoría que no sea la recomendada por Mercado Libre, será moderado. Si tu aplicación publica masivamente, te recomendamos realizar una validación de sus categorías previa a publicar los productos.

### Modalidad de compra

La modalidad de compra inmediata ("buying_mode"="buy_it_now") garantiza que una order sólo aparecerá para el vendedor cuando el pago esté aprobado.

### Precio

Es un atributo obligatorio: cuando defines un nuevo artículo, debe tener precio. Para consultar y editar precios debes utilizar la [API de prices](https://developers.mercadolibre.com.ar/es_ar/api-de-precios).

### Moneda

Además del precio, debes definir una moneda. Este atributo también es obligatorio. Debes definirla utilizando un ID preestablecido. Sabrás qué ID enviar llamando a nuestro recurso Monedas. **En Venezuela, solo puedes publicar productos y vehículos en dólares** . Las publicaciones activas, las convertiremos automáticamente a dólares. Para hacer la conversión de moneda, tomaremos la cotización del día según el Banco Central de Venezuela.

### Métodos de pago

Es importante que consideres los [métodos de pago disponibles de Mercado Pago.](https://www.mercadopago.com.co/developers/es/guides/localization/payment-methods).

### Envío

Cada sitio cuenta con un conjunto de métodos de envío disponibles y estos presentan diferentes tiempos y costos de envío. Conoce más sobre [Mercado Envíos](https://developers.mercadolibre.com.ar/es_ar/mercado-envios).

### Identificadores de productos

Los identificadores son códigos que sirven para localizar unívocamente a un producto. Conoce más las <a href=">descripciones y cómo enviar Identificadores de productos.

### SKU

Esta información ayudará a tus vendedores a identificar, localizar y hacer seguimiento interno de un producto. Solo tenemos en cuenta la información cargada en el atributo SELLER_SKU. Conoce más sobre [consideraciones a tener en cuenta](https://developers.mercadolibre.com.mx/es_ar/variaciones#Consideraciones).

### Variaciones

Con variaciones podrás contar en una misma publicación todas las variantes del ítem, manteniendo incluso stock diferencial por cada una. De esta forma, cuando recibas una compra, verás en la orden de compra el color y talle elegido por el comprador, facilitando así el proceso post-venta. Conoce más sobre [Variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones).

## Tipos de publicación

[Conoce los diferentes tipos de publicación](https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos) (listing_types).

## Condición de un ítem

Para definir si un producto es nuevo, usado o reacondicionado, será necesario enviar el atributo “item_condition” con el valor que se desea asignar. Para conocer los atributos que corresponden a una categoría y los valores que soportan te sugerimos revisar la documentación de [Atributos](https://developers.mercadolibre.com.ar/es_ar/atributos).

Ejemplo:

```
 curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA30835/attributes
```

Respuesta:

```
{
    "id": "ITEM_CONDITION",
    "name": "Condición del ítem",
    "tags": {
      "hidden": true
    },
    "hierarchy": "ITEM",
    "relevance": 2,
    "value_type": "list",
    "values": [
      {
        "id": "2230284",
        "name": "Nuevo"
      },
      {
        "id": "2230581",
        "name": "Usado"
      },
      {
        "id": "2230582",
        "name": "Reacondicionado"
      }
    ],
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
```

Importante:

Cuando la publicación tiene condición “reacondicionado” es necesario cargar la Garantía del producto dentro de la sección "sale_terms".

## Garantía del producto

Dentro de la sección “sale_terms” de un ítem, se deberá definir la garantía que tendrá el producto publicado. Para eso, habrá que pasar la información en una combinación de atributos: 
**Tipo de Garantía:**  representa las formas que puede tener esa garantía. Por ejemplo: garantía de vendedor, de fábrica, etc. 
**Tiempo de Garantía:**  representa el tiempo que tendrá vigencia esa garantía. 

 Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/sale_terms
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1642/sale_terms
```

Respuesta:

```
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
        "id": "2230279",
        "name": "Garantía de fábrica"
      },
      {
        "id": "2230280",
        "name": "Garantía del vendedor"
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
        "id": "años",
        "name": "años"
      },
      {
        "id": "meses",
        "name": "meses"
      }
    ],
    "default_unit": "días",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
  },
```

Nota:

Ten en cuenta que al momento de configurar un item como reacondicionado se deberá hacer con una garantía de 90 días o más. Mira más sobre [Políticas de Publicación](https://www.mercadolibre.com.ar/ayuda/Politicas-de-Publicacion_s1011#3737).

## Tags de un ítem

| Recurso | Tag | Descripción |
| --- | --- | --- |
| Atributos | incomplete_technical_specs | La ficha técnica del item (atributos) está incompleta. Son items que están perdiendo exposición |
| Atributos | extended_warranty_eligible | Se puede aplicar una garantía extendida en la compra del item |
| Catálogo | catalog_listing_eligible | Publicaciones elegibles para catálogo |
| Catálogo | catalog_boost | Publicaciones que han sido optimizadas automáticamente por Mercado Libre |
| Catálogo | catalog_forewarning | Publicaciones de marketplace que deben publicarse en catálogo antes de ser moderadas para evitar fricciones con el vendedor |
| Catálogo | catalog_only_restricted | Dominios exclusivos |
| Catálogo | opt_obey | Dominios obligatorios |
| Precio por variación | user_product_listing | Item en el nuevo modelo de Productos de Usuario |
| Precio por variación | variations_migration_source | Item antiguo que pasó por la migración de UPTIN y fue finalizado |
| Precio por variación | variations_migration_pending | Item en proceso de creación a través de la migración al nuevo modelo de productos de usuario, desde la acción de UPTIN |
| Precio por variación | variations_migration_uptin | Items creados a través de la migración al nuevo modelo de productos de usuario, desde la acción de UPTIN |
| Multiorigen | warehouse_management | Item bajo el modelo de Multiorigen |
| Imágenes | poor_quality_picture / poor_quality_thumbnail | Las imágenes del item son de mala calidad |
| Imágenes | good_quality_thumbnail / good_quality_picture | Las imágenes del item son de buena calidad |
| Imágenes | unknown_quality_picture | No se conoce la calidad de las imágenes del item |
| Precio | not_market_price | Publicaciones con precios poco competitivos |
| Promoción | loyalty_discount_eligible | Se puede aplicar un descuento de fidelidad |
| Promoción | today_promotion | Indica que el item aplica para ofertas promocionales de corta duración |
| Publicar | non_buyable_as_standalone | No es posible comprar el item solo; debe formar parte de un kit |
| Republicar | dragged_visits | Indica que el item es republicado y las visitas de su item padre son contabilizadas |
| Republicar | dragged_bids_and_visits | Indica que el item es republicado y las ventas y visitas de su item padre son contabilizadas |
| Republicar | relist | Indica que el item ya ha sido republicado. En este caso, no podrá ser republicado nuevamente |
| Republicar | free_relist | Indica si el item fue republicado gratuitamente |
| Pedidos | cart_eligible | El item puede ser añadido al carrito |
| Pago | immediate_payment | Indica que el item acepta solo MercadoPago como medio de pago |
| Envío | fbm_in_process | Cuando el vendedor programa el envío para full (inbound), el item se pausa. Al llegar al FBM, el tag se elimina |
| Envío | optional_me1_chosen | La cuenta tiene ME1 y ME2 permitidos, y el item tiene ME1 en el envío como opcional |
| Envío | lost_me2_by_dimensions | El vendedor tiene restricciones para enviar a través de ME2 porque las dimensiones del paquete superan el límite permitido |
| Envío | adoption_required | Item not_specified que aún no ha adoptado ME2, que es el recomendado |
| Envío | mandatory_free_shipping | Item tiene un precio por encima del mínimo para ofrecer envío gratis en el sitio. Por lo tanto, el item queda con free_shipping=true y con este tag |
| Envío | me2_available | Item puede ser ofrecido como ME2 |
| Envío | self_service_in | Item tiene Flex activado |
| Envío | self_service_out | Item no tiene Flex activado |
| Envío | self_service_available | Item es elegible para Flex, pero no está activado |
| Moderaciones | moderation_penalty | Item con restricción. Si el item es solo de marketplace, el estado es paused; de lo contrario, es active |
| Brand | brand_verified | Items de una tienda oficial que han sido validados |
| CPG | supermarket_eligible | Items de supermercado |
| VIS | hirable | El item es un servicio (clasificado), sobre el cual se puede realizar la acción "contratar" |
| CBT | cbt_item | Items de CBT |
| Prueba | test_item | Items de prueba |

## Género de una publicación

Nota:

A finales de julio 2023 comenzaremos a impactar dominios que contengan el atributo de género y este pasará a ser de tipo “list”, adicionando una opción nueva “Sin género infantil”, así como una nueva validación que impedirá crear publicaciones donde el título haga referencia a un genero diferente al especificado en “GENDER”. Para realizar pruebas sobre este cambio y adaptar las integraciones hemos pre configurado un dominio de pruebas SNEAKERS_TEST.

En algunos dominios **/domains/$DOMAIN_ID/technical_specs**  podrás encontrar que dentro de sus atributos principales se solicita la especificación del género **"id": "GENDER"** . Más información de dominios y categorías [aquí](https://developers.mercadolibre.com.ar/es_ar/dominios-y-categorias?nocache=true).

Este atributo tiene como finalidad detallar el género de una publicación y así poderlos segmentar con mayor facilidad al momento que el comprador quiera hacer una búsqueda selectiva dentro de las publicaciones. Ejemplo: Bicicleta disco hidraulico adulto.

El atributo género es una lista, que únicamente permite las siguientes opciones:

```
{ 
"attributes": [{
	"id": "GENDER",
	"name": "Género",
	"value_type": "list",
	"tags": [
		"catalog_listing_required",
		"grid_template_required",
		"grid_filter",
		"catalog_required",
		"required"
	],
	"values": [{
			"id": "339665",
			"name": "Mujer"
		},
		{
			"id": "339666",
			"name": "Hombre"
		},
		{
			"id": "339668",
			"name": "Niñas"
		},
		{
			"id": "339667",
			"name": "Niños"
		},
		{
			"id": "110461",
			"name": "Sin género"
		},
		{
			"id": "19159491",
			"name": "Sin género infantil"
		},
		{
			"id": "371795",
			"name": "Bebés"
		}
	],
	"hierarchy": "PARENT_PK",
	"relevance": 1
}]
```

Donde la opción de “Sin género” estará enfocada en segmentar publicaciones unisex para adultos, mientras que “Sin género infantil” se enfocará únicamente para publicaciones unisex de niños.

El atributo GENDER principalmente se encuentra en dominios de moda, para los cuales debes recordar que la [guía de talles](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es) es obligatoria. Posterior al PUT o POST del recurso /items si usaste un género que no se encuentra en la lista de la ficha técnica, mostrará el siguiente error impidiendo la creación de la nueva publicación, hasta que realices la respectiva corrección:

```
{
"department": "structured-data",
"cause_id": 2516,
"type": "error",
"code": "error.item.attribute.business_conditional.value_name",
"references": [
"item.name"
],
"message": "Attribute [GENDER] is not valid"
}
```

Adicionalmente, el atributo de título para publicaciones donde el GENDER es requerido, será validado y devolverá error en caso de que el título “title" haga referencia a un género diferente, al que se especificó en el atributo "id": "GENDER", puedes consultar el detalle de las [validaciones](https://developers.mercadolibre.com.ar/es_ar/validaciones).

## Publica un artículo

Importante:

A partir del 9 de septiembre de 2024, desactivaremos la opción de incluir videos de YouTube en las publicaciones. Mientras tanto, te recomendamos que los vendedores con reputación amarilla o superior, de MLA, MLB, MLC, MCO y MLM con videos de YouTube migren a [Clips](https://vendedores.mercadolibre.com.ar/nota/sube-videos-de-tus-productos-para-llegar-a-mas-personas).

Antes de publicar un producto, te recomendamos utilizar usuarios de test para publicar artículos de prueba. Si aún no tienes tu usuario test, consulta cómo [realizar pruebas](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas) y obtén el tuyo. Puedes crear un JSON para tu artículo en base al ejemplo a continuación o simplemente envíalo así y estarás publicando un producto de muestra en el site.

Nota:

Si una publicación infringe derechos de propiedad intelectual, podrás ser denunciado por el titular de los derechos o tendremos que pausar o dar de baja tu publicación por incumplimiento a [nuestras políticas](https://www.mercadolibre.com.ar/ayuda/Politicas-de-Publicacion_1011).

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d
{
  "title":"Item de test - No Ofertar",
  "category_id":"MLA3530",
  "price":350,
  "currency_id":"ARS",
  "available_quantity":10,
  "buying_mode":"buy_it_now",
  "condition":"new",
  "listing_type_id":"gold_special",
  "sale_terms":[
     {
        "id":"WARRANTY_TYPE",
        "value_name":"Garantía del vendedor"
     },
     {
        "id":"WARRANTY_TIME",
        "value_name":"90 días"
     }
  ],
  "pictures":[
     {
        "source":"http://mla-s2-p.mlstatic.com/968521-MLA20805195516_072016-O.jpg"
     }
  ],
  "attributes":[
     {
        "id":"BRAND",
        "value_name":"Marca del producto"
     },
     {
        "id":"EAN",
        "value_name":"7898095297749"
     }
  ]
}
https://api.mercadolibre.com/items
```

Resposta:

```
{
    "id": "MLA880314064",
    "site_id": "MLA",
    "title": "Item De Test - No Ofertar",
    "seller_id": 629334160,
    "category_id": "MLA3530",
    "user_product_id": "MLAU1234567",
    "official_store_id": null,
    "price": 350,
    "base_price": 350,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "ARS",
    "initial_quantity": 10,
    "available_quantity": 10,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WARRANTY_TYPE",
            "name": "Tipo de garantía",
            "value_id": "2230280",
            "value_name": "Garantía del vendedor"
        },
        {
            "id": "WARRANTY_TIME",
            "name": "Tiempo de garantía",
            "value_id": null,
            "value_name": "90 días"
    ],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2020-09-23T18:31:16.342Z",
    "stop_time": "2040-09-18T04:00:00.000Z",
    "end_time": "2040-09-18T04:00:00.000Z",
    "expiration_time": "2020-12-12T18:31:16.398Z",
    "condition": "new",
    "permalink": "http://articulo.mercadolibre.com.ar/MLA-880314064-item-de-test-no-ofertar-_JM",
    "pictures": [
        {
            "id": "971132-MLA43558185924_092020",
            "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
            "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
            "size": "500x500",
            "max_size": "500x500",
            "quality": ""
        }
    ],
    "video_id": "null",
    "descriptions": [ ],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": "not_specified",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 1126268188,
        "comment": "Referencia: The Testing Cavern",
        "address_line": "Testing Street 1450",
        "zip_code": "1430",
        "city": {
            "id": "TUxBQlNBQTM3Mzda",
            "name": "Saavedra"
        },
        "state": {
            "id": "AR-C",
            "name": "Capital Federal"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": -34.5545188,
        "longitude": -58.4915986,
        "search_location": {
            "neighborhood": {
                "id": "TUxBQlNBQTM3Mzda",
                "name": "Saavedra"
            },
            "city": {
                "id": "TUxBQ0NBUGZlZG1sYQ",
                "name": "Capital Federal"
            },
            "state": {
                "id": "TUxBUENBUGw3M2E1",
                "name": "Capital Federal"
            }
        }
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -34.5545188,
        "longitude": -58.4915986
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "ITEM_CONDITION",
            "name": "Condición del ítem",
            "value_id": "2230284",
            "value_name": "Nuevo"
        {
            "id": "GTIN",
            "name": "Código universal de producto",
            "value_id": null,
            "value_name": "7898095297749",
            "value_struct": null
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": null,
            "value_name": "Marca del producto"
        }
    ],
    "listing_source": "",
    "variations": [],
    "thumbnail_id": "971132-MLA43558185924_092020",
    "thumbnail": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/I-ES.jpg",
    "secure_thumbnail": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/I-ES.jpg",
    "status": "active",
    "sub_status": [],
    "tags": [
        "immediate_payment",
        "test_item"
    ],
    "warranty": "Garantía del vendedor: 90 días",
    "catalog_product_id": null,
    "domain_id": "MLA-UNCLASSIFIED_PRODUCTS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2020-09-23T18:31:16.523Z",
    "last_updated": "2020-09-23T18:31:16.523Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": []
}
```

Nota:

Si tienes problemas al intentar publicar, consulta la referencia de la tabla de códigos de Error de la API al final de esta guía.

## Artículos con Mercado Pago obligatorio

Así como un user o una categoría pueden estar marcado con pago inmediato, también lo puede estar un ítem. Este escenario se presenta cuando:

- Todas las publicaciones de MLB.

- Todas las publicaciones de MLA y MLM por venta de productos con "condition": "new".

- Las publicaciones de Tiendas Oficiales en todos los países con Mercado Pago.

- Existen categorías con Mercado Pago como única opción (Para obtener más información dirígete a: “[Usuario marcado automáticamente](https://developers.mercadolibre.com.ar/es_ar/publica-productos#categorias) para que sus operaciones vayan por este flujo, con la marca “immediate_payment” en la API de users.

- [Vendedor “auto” marcado para que sus ventas vayan por este flujo](https://developers.mercadolibre.com.ar/es_ar/producto-consulta-usuarios#Mercado-Pago).

Conoce más sobre las [Validaciones para publicar](https://developers.mercadolibre.com.ar/es_ar/validaciones?nocache=true).

## Publica un artículo con pago inmediato

Si deseas que tu ítem se pueda abonar solamente con Mercado Pago, podrás definirlo al momento de crear un ítem nuevo, o bien modificar uno ya activo. Para eso, utilizarás el tag **inmediate_payment** . 

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
    "title": "Item de teste - Não Comprar",
    "category_id": "MLB437616",
    "price": 10,
    "currency_id": "BRL",
    "available_quantity": 1,
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "condition": "new",
    "description": "Publicação de teste, não comprar",
    "video_id": "null",
    "tags": [
        "immediate_payment"
    ],
   "sale_terms":[
      {
         "id":"WARRANTY_TYPE",
         "value_name":"Garantia do vendedor"
      },
      {
         "id":"WARRANTY_TIME",
         "value_name":"90 días"
      }
   ],

    "pictures": [
         {
    "source": "https://www.motorino.com.br/site/wp-content/uploads/2018/01/produto_de_teste_amarelo_4_2_20171020224326-400x400.jpg"}

    ]
}
 
'
 
https://api.mercadolibre.com/items
```

Ejemplo:

```
{
    "id": "MLB1548991737",
    "site_id": "MLB",
    "title": "Item De Teste - Não Comprar",
    "seller_id": 419059118,
    "category_id": "MLB437616",
    "user_product_id": "MLAU1234567",
    "official_store_id": null,
    "price": 10,
    "base_price": 10,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 1,
    "available_quantity": 1,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WARRANTY_TYPE",
            "name": "Tipo de garantia",
            "value_id": "2230280",
            "value_name": "Garantia do vendedor"
        },
        {
            "id": "WARRANTY_TIME",
            "name": "Tempo de garantia",
            "value_id": null
        }
    ],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2020-06-05T13:48:44.964Z",
    "stop_time": "2040-05-31T04:00:00.000Z",
    "end_time": "2040-05-31T04:00:00.000Z",
    "expiration_time": "2020-08-24T13:48:45.039Z",
    "condition": "new",
    "permalink": "http://produto.mercadolivre.com.br/MLB-1548991737-item-de-teste-no-comprar-_JM",
    "pictures": [
        {
            "id": "830983-MLB42088778762_062020",
            "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-PT.jpg",
            "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-PT.jpg",
            "size": "500x500",
            "max_size": "500x500",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [ ],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "me1",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": "default",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 1032937241,
        "comment": "",
        "address_line": "Rua Exemplo 123",
        "zip_code": "01234100",
        "city": {
            "id": "BR-SP-44",
            "name": "São Paulo"
        },
        "state": {
            "id": "BR-SP",
            "name": "São Paulo"
        },
        "country": {
            "id": "BR",
            "name": "Brasil"
        },
        "latitude": -23.6251244,
        "longitude": -46.7441422,
        "search_location": {
            "neighborhood": {
                "id": "TUxCQlZJTDI1OTI",
                "name": "Vila Andrade"
            },
            "city": {
                "id": "TUxCQ1NQLTkxMjE",
                "name": "São Paulo Zona Sul"
            },
            "state": {
                "id": "TUxCUFNBT085N2E4",
                "name": "São Paulo"
            }
        }
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -23.6251244,
        "longitude": -46.7441422
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "ITEM_CONDITION",
            "name": "Condição do item",
            "value_id": "2230284"
        }
    ],
    "listing_source": "",
    "variations": [],
    "thumbnail": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/I-PT.jpg",
    "status": "active",
    "sub_status": [],
    "tags": [
        "cart_eligible",
        "immediate_payment",
        "test_item"
    ],
    "warranty": "Garantia do vendedor: 90 días",
    "catalog_product_id": null,
    "domain_id": null,
    "seller_custom_field": null,
    "parent_item_id": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2020-06-05T13:48:45.176Z",
    "last_updated": "2020-06-05T13:48:45.176Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": []
}
```

## Categorías con pago inmediato

Dentro de Mercado Libre existen categorías que exigen como única opción a Mercado Pago. Para saber si la categoría en la que se quiere publicar es una de ellas, consulta lo siguiente:

```
curl - X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/categories/$CATEGORY_ID

"immediate_payment": "required",
    "item_conditions": [
      "new",
      "not_specified",
      "used"
    ],
```

Si tiene el campo "immediate_payment" en "required" es porque Mercado Pago es obligatorio. Si tiene “optional” es porque también acepta “Acuerdo con el vendedor”.

## Publica un artículo en una Tienda Oficial

Nota:

Las **marcas de publicación limitada**  solo podrán ser ofrecidas por **Tiendas Oficiales y por vendedores acreditados por las marcas** . Esta medida aplica:
 - En **Argentina** , para Adidas y Reebok y Nike
 - En **Brasil** , para Adidas y Reebok y Nike
 - En **Colombia** , para Adidas y Reebok y Nike
 - En **México** , para Adidas, Reebok y Nike
 - En **Peru** , para Adidas y Reebok
 - En **Chile** , para Adidas y Reebok

Publicar un artículo en una tienda oficial es lo mismo que publicar cualquier otro artículo, salvo que también debes agregar el atributo official_store_id en el JSON.

 Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
   "title":"Item de Test -No Ofertar",
   "category_id":"MLA5529",
   "price":10,
   "official_store_id":1,
   "currency_id":"ARS",
   "available_quantity":1,
   "buying_mode":"buy_it_now",
   "listing_type_id":"bronze",
   "condition":"new",
   "description":{
      "plain_text":"Item:, Ray-Ban WAYFARER Gloss Black RB2140 901 Model: RB2140. Size: 50mm. Name: WAYFARER. Color: Gloss Black. Includes Ray-Ban Carrying Case and Cleaning Cloth. New in Box"
   },
   "video_id":"null",
   "sale_terms":[
      {
         "id":"WARRANTY_TYPE",
         "value_name":"Garantia do vendedor"
      },
      {
         "id":"WARRANTY_TIME",
         "value_name":"90 días"
      }
   ],

   "pictures":[
      {
         "source":"http://upload.wikimedia.org/wikipedia/commons/f/fd/Ray_Ban_Original_Wayfarer.jpg"
      },
      {
         "source":"http://en.wikipedia.org/wiki/File:Teashades.gif"
      }
   ]
}'https://api.mercadolibre.com/items
```

Si tu tienda es multimarca, debes especificar el official_store_id de la marca donde deseas publicar ese artículo. Consulta [nuestra guía de Tiendas Oficiales para conocer más sobre este tema](https://developers.mercadolibre.com.ar/es_ar/tiendas-oficiales).

## Errores

| Código de error | Mensaje de error | Descripción | Posible solución |
| --- | --- | --- | --- |
|  |  |  |  |
| item.category_id.invalid | Category $CATEGORY_ID does not exist. | La categoría enviada no existe | Consulta las [categorías disponibles por site.](https://developers.mercadolibre.com.mx/es_ar/categoriza-productos#Categor%C3%ADas-por-Site) |
| body.invalid_fields | The fields [$FIELD_ID] are invalid for requested call. | El campo $FIELD_ID es invalido para la categoría. | Consulta los campos válidos en /categories/$CATEGORY_ID |
| seller.unable_to_list | The seller is not allowed to publish. | El vendedor por determinada causa no puede publicar. Identifica el campo **cause**  dentro del response. | - Consulta el significado de **cause**  en /users#options ese status to list y podrás ver el significado. - Prueba realizar una primera publicación manual desde Mi Cuenta de Mercado Libre para que aparezcan las advertencias en el flujo. |

## Referencias de código de respuesta HTTP

Items podrá devolver el código http 206 cuando no se haya podido obtener algún dato. Ten en cuenta que en la mayoría de los casos la información que recibas será suficiente para que puedas seguir trabajando. 
En el header de respuesta X-Content-Missing tendrás el nombre de los campos sin información, que pueden ser **location** , **geolocation**  y/o **seller_address** .

**Siguiente:**  [Envío de productos](https://developers.mercadolibre.com.ar/es_ar/mercado-envios).
