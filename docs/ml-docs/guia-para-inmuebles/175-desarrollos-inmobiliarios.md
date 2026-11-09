<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/desarrollos-inmobiliarios -->
<!-- Sección: Guía para inmuebles -->

# Desarrollos inmobiliarios

Última actualización 06/11/2026

## Desarrollos Inmobiliarios

Los desarrollos inmobiliarios habitacionales son proyectos que crean espacios de vivienda privada, ya sea para venta o alquiler, destinados a uso residencial y no comercial. Involucran la urbanización de terrenos, construcción de casas, departamentos o barrios cerrados, y buscan ofrecer calidad de vida, seguridad y acceso a servicios. Cada desarrollo apunta a distintos segmentos socioeconómicos, desde viviendas de interés social hasta proyectos premium.

En Argentina se los denomina "emprendimientos inmobiliarios residenciales", en México "desarrollos habitacionales", en Chile "proyectos de vivienda" y en Brasil "empreendimentos residenciales". Suelen compartir características como planificación de amenities (plazas, piscinas, gimnasios), control de accesos, integración con el entorno urbano o suburbano, y en proyectos modernos, también foco en la sustentabilidad y el diseño comunitario.

 En MercadoLibre, una publicación de Desarrollo Inmobiliario o Proyecto permite al vendedor exhibir una unidad en construcción o por construir. Esta unidad puede ofrecer distintas alternativas, denominadas variaciones. Cada variación especifica una posible unidad a construir, incluyendo sus características, planos, entre otros detalles.
 
 Para conocer más consulta la guía de [variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones-para-inmuebles).

## ¿Cómo se publica un Desarrollo Inmobiliario?

¿Qué paquetes necesitas tener habilitado como vendedor?

- El vendedor tiene que tener habilitado un paquete del tipo desarrollo. Para conocer cómo gestionar tu paquete de este y otros tipos, sigue la documentación en [Gestionar Paquetes de Inmuebles](https://developers.mercadolibre.com.ar/es_ar/gestionar-paquetes-de-inmuebles).

- Es importante tener en cuenta que sólo podrás habilitar un paquete de este tipo en los países donde esté habilitada la experiencia de Desarrollos Inmobiliarios.

**¿Qué categorías debo utilizar para publicar el desarrollo inmobiliario?**

- Consulta la [sección](https://developers.mercadolibre.com.ar/es_ar/desarrollos-inmobiliarios?nocache=true#:~:text=inmuebles%20con%20variaciones-,Categor%C3%ADas%20de%20un%20Desarrollo%20Inmobiliario,-Como%20cualquier%20otra) especial dedicada a las categorías de este tipo.

**¿Qué características deben tener las fotografías de los inmuebles?**

- Consulta la [sección](https://developers.mercadolibre.com.ar/es_ar/desarrollos-inmobiliarios?nocache=true#:~:text=de%20Desarrollos%20Inmobiliarios.-,Fotograf%C3%ADas%20de%20una%20publicaci%C3%B3n%20para%20un%20desarrollo%20inmobiliario,-La%20publicaci%C3%B3n%20de) especial dedicada a las fotografías de este tipo.

¿En qué países está habilitada la publicación de desarrollos inmobiliarios?

- Chile

- México

- Argentina

- Uruguay

Para conocer más consulta la guía de [publica inmuebles con variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones-para-inmuebles)

## Categorías de un Desarrollo Inmobiliario

Como cualquier otra publicación en MercadoLibre, es necesario asociar esta publicación a la categoría correspondiente. Para ello, primero debemos identificar la misma dentro de las categorías habilitadas en el país donde vamos a generar la publicación.

Listamos las categorías del país.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/sites/$SITE_ID/categories
```

### Parámetros

Como path parameter, es necesario incluir en el endpoint el id de país para listar las categorías. Los valores posibles son:

- MLA

- MLC

- MLM

- MLU

Por supuesto también será necesario un token de acceso vigente para poder autorizar la consulta. Como resultado se obtienen todas las categorías del país. En Argentina, generalmente la categoría Inmuebles es el valor MLA1459 (esto puede variar por países e incluso en el tiempo. Se recomienda realizar la consulta para confirmar).

Luego, para obtener la categoría correspondiente a Desarrollos Inmobiliarios o Emprendimientos, es necesario ver el detalle de la categoría padre y luego buscar en la categoría hijas (children_categories).

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/categories/MLA1459
```

Ejemplo parcial de respuesta:

```
{
  "id": "MLA1459",
  "name": "Inmuebles",
  "picture": "...",
  "permalink": "https://www.mercadolibre.com.ar/c/inmuebles",
  "total_items_in_this_category": ...,
  "path_from_root": [
    {
      "id": "MLA1459",
      "name": "Inmuebles"
    }
  ],
  "children_categories": [
    {
      "id": "MLA401805",
      "name": "Emprendimientos",
      "total_items_in_this_category": ..
    },
    ...
  ]
}
```

Identificado el id de la categoría hija correspondiente, es el que como resultado debiera utilizarse para publicar los inmuebles con estas características de Desarrollos Inmobiliarios.

## Fotografías de una publicación para un desarrollo inmobiliario

La publicación de un desarrollo inmobiliario tiene variaciones. Las imágenes que detallan cada variación, deben generarse y asociarse a cada una de estas variaciones.Para realizar esto, estas imágenes deben generarse utilizando el recurso `pictures`, enviándolas en el mismo POST dentro del array correspondiente.

Aquellas fotografías cuyo ID no se encuentre en las variaciones correspondientes, no se mostrarán en la página principal del desarrollo. Sin embargo, las que sí tengan su ID referenciado correctamente en la variación, serán visibles tanto en la descripción como en la cotización.

La cantidad máxima de imágenes permitidas para el envío está determinada por la categoría, específicamente en los campos max_pictures_per_item y max_pictures_per_item_var.

### Ejemplo de la categoría de desarrollo inmobiliario para Argentina específicamente “Departamentos”

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/categories/MLA401806
```

Ejemplo parcial de respuesta:

```
{
  ...
  "max_pictures_per_item": 80,
  "max_pictures_per_item_var": 6,
  ...
}
```

## Publicación de desarrollos inmobiliarios

En esta sección encontrarás cómo puedes publicar desarrollos inmobiliarios en MercadoLibre. Para un emprendimiento o desarrollo inmobiliario, se requiere como mínimo una variación. Todos los atributos y las combinaciones de variaciones se pueden obtener del recurso /attributes de la categoría correspondiente.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/categories/$CATEGORY_ID/attributes
```

Ejemplo parcial de respuesta:

```
...{
  "id": "ROOMS",
  "name": "Ambientes",
  "tags": {
    "allow_variations": true,
    "required": true,
    "catalog_listing_required": true
  },
  "hierarchy": "ITEM",
  "relevance": 1,
  "value_type": "number",
  "value_max_length": 18,
  "attribute_group_id": "MAIN_CHARACTERISTICS_OF_MODEL",
  "attribute_group_name": "Características principales del modelo"
}...
```

En una publicación de inmuebles, los atributos del emprendimiento en sí se encuentran en el campo attributes, siendo DEVELOPMENT_NAME el título del desarrollo. Cada unidad específica se detalla en variations. Dentro de cada variación, attribute_combinations actúa como su clave primaria, garantizando que no haya dos unidades con la misma combinación de valores en estos atributos (por ejemplo, UNIT_NAME suele ser un identificador único).

Adicionalmente, cada variación posee atributos particulares que varían según el emprendimiento.

Importante:

Otra consideración importante a tener en cuenta antes de publicar es que las variaciones de un desarrollo inmobiliario deben tener la misma moneda al `price` del emprendimiento. Y en cada variación solo debe mencionarse el **precio**  sin repetir la moneda.

```
"title": "Casas financiadas en pesos y planes de ahorro",
"category_id": "MLA401805",
"price":"XXXXXX",
"currency_id":"ARS"
```

### Publicación

Luego, teniendo en cuenta todas estas consideraciones que hemos indicado anteriormente, y siguiendo la guía de publicación de inmuebles con variaciones en detalle, se publica el inmueble con estas características utilizando la API de Items, ejecutando un POST para generar la publicación.

El siguiente es un ejemplo de un posteo de un desarrollo inmobiliario ficticio.

```
curl --location --request POST 'https://api.mercadolibre.com/items' \
--header 'Authorization: Bearer $ACCESS_TOKEN' \
--header 'Content-Type: application/json' \
--data-raw '{
  "title": "Item de prueba - no ofertar - test - Domus 2222",
  "category_id": "MLA401806",
  "price": 157000,
  "currency_id": "USD",
  "available_quantity": 2,
  "buying_mode": "classified",
  "listing_type_id": "gold_premium",
  "condition": "new",
  "location": {
    ...
  },
  "description": {"plain_text": "Una descripción de prueba  \n"},
  "pictures": [
    {
      "id": "872895-MLA26491094940_122017",
      "url": "http://mla-s2-p.mlstatic.com/872895-MLA26491094940_122017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/872895-MLA26491094940_122017-O.jpg",
      "size": "500x312",
      "max_size": "1200x750",
      "quality": ""
    },
    {
      "id": "681776-MLA26491106096_122017",
      "url": "http://mla-s2-p.mlstatic.com/681776-MLA26491106096_122017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/681776-MLA26491106096_122017-O.jpg",
      "size": "500x236",
      "max_size": "1200x567",
      "quality": ""
    },
    ...
  ],
  ...
  "seller_address": {
    "comment": "",
    "address_line": "Av. Libertador 4189",
    "zip_code": "1636",
    "city": {
      "id": "TUxBQ1ZJQ2E3MTQz",
      "name": "Vicente López"
    },
    "state": {
      "id": "AR-B",
      "name": "Buenos Aires"
    },
    "country": {
      "id": "AR",
      "name": "Argentina"
    }
  },
  "attributes": [
    {
      "id": "AVAILABLE_PARKING_SLOTS",
      "name": "Cocheras disponibles",
      "value_id": null,
      "value_name": "82",
      "value_struct": null,
      "attribute_group_id": "ADDITIONAL_CHARACTERISTICS_OF_DEVELOPMENT",
      "attribute_group_name": "Características adicionales del desarrollo"
    },
    {
      "id": "HAS_LIFT",
      "name": "Ascensor",
      "value_id": "242084",
      "value_name": "No",
      "value_struct": null,
      "attribute_group_id": "ADDITIONAL_CHARACTERISTICS_OF_DEVELOPMENT",
      "attribute_group_name": "Características adicionales del desarrollo"
    },
    ...
  ],
  "variations": [
    {
      "price": 158000,
      "attribute_combinations": [
        { "id": "ROOMS", "name": "Ambientes", "value_id": null, "value_name": "2", "value_struct": null },
        { "id": "FULL_BATHROOMS", "name": "Baños", "value_id": null, "value_name": "1", "value_struct": null },
        { "id": "PARKING_LOTS", "name": "Cocheras", "value_id": null, "value_name": "0", "value_struct": null },
        { "id": "BEDROOMS", "name": "Dormitorios", "value_id": null, "value_name": "1", "value_struct": null },
        ...
      ],
      "available_quantity": 1,
      "sold_quantity": 0,
      "sale_terms": [],
      "picture_ids": ["674837-MLA26491070000_122017"]
    },
    {
      "price": 161000,
      "attribute_combinations": [
        { "id": "ROOMS", "name": "Ambientes", "value_id": null, "value_name": "1", "value_struct": null },
        ...
      ],
      "available_quantity": 1,
      "picture_ids": ["913036-MLA26491092856_122017"]
    }
  ]
}'
```

Ejemplo parcial de respuesta:

```
{
  "id": "MLA843263657",
  "site_id": "MLA",
  "title": "Item De Prueba - No Ofertar - Test - Domus 2222",
  "subtitle": null,
  "seller_id": 534776711,
  "category_id": "MLA401806",
  "official_store_id": null,
  "price": 158000,
  "base_price": 158000,
  ...
  "condition": "new",
  "permalink": "http://departamento.mercadolibre.com.ar/MLA-843263657-item-de-prueba-no-ofertar-test-domus-2222-_JM",
  "pictures": [
    {
      "id": "872895-MLA26491094940_122017",
      "url": "http://mla-s1-p.mlstatic.com/872895-MLA26491094940_122017-O.jpg",
      "secure_url": "https://mla-s1-p.mlstatic.com/872895-MLA26491094940_122017-O.jpg",
      "size": "500x312",
      "max_size": "1200x750",
      "quality": ""
    },
    {
      "id": "681776-MLA26491106096_122017",
      "url": "http://mla-s1-p.mlstatic.com/681776-MLA26491106096_122017-O.jpg",
      "secure_url": "https://mla-s1-p.mlstatic.com/681776-MLA26491106096_122017-O.jpg",
      "size": "500x236",
      "max_size": "1200x567",
      "quality": ""
    },
    ...
  ],
  "video_id": null,
  "descriptions": [{ "id": "MLA843263657-2561842362" }],
  "accepts_mercadopago": false,
  "non_mercado_pago_payment_methods": [],
  "shipping": {...},
  "international_delivery_mode": "none",
  "seller_address": {
    "id": 1091410987,
    "comment": "",
    "address_line": "Test Address 123",
    "zip_code": "1414",
    "city": { "id": "", "name": "Palermo" },
    "state": { "id": "AR-C", "name": "Capital Federal" },
    "country": { "id": "AR", "name": "Argentina" },
    ...
  },
  "geolocation": { "latitude": -34.5101161, "longitude": -58.4765109 },
  "attributes": [
    {
      "id": "ITEM_CONDITION",
      "name": "Condición del ítem",
      "value_id": "2230284",
      "value_name": "Nuevo",
      "value_struct": null,
      "values": [{ "id": "2230284", "name": "Nuevo", "struct": null }],
      "attribute_group_id": "",
      "attribute_group_name": ""
    },
    {
      "id": "AVAILABLE_PARKING_SLOTS",
      "name": "Cocheras disponibles",
      "value_id": null,
      "value_name": "82",
      "value_struct": null,
      "values": [{ "id": null, "name": "82", "struct": null }],
      "attribute_group_id": "ADDITIONAL_CHARACTERISTICS_OF_DEVELOPMENT",
      "attribute_group_name": "Características adicionales del desarrollo"
    },
    ...
  ],
  "warnings": [
    {
      "department": "items",
      "cause_id": 314,
      "code": "item.price.dropped",
      "message": "Item price was changed by the lowest-price variation.",
      "references": ["item.price"]
    }
  ],
  "variations": [
    {
      "id": 52173477243,
      "attribute_combinations": [
        { "id": "ROOMS", "name": "Ambientes", "value_id": null, "value_name": "2", "value_struct": null, "values": [{ "id": null, "name": "2", "struct": null }] },
        { "id": "FULL_BATHROOMS", "name": "Baños", "value_id": null, "value_name": "1", "value_struct": null, "values": [{ "id": null, "name": "1", "struct": null }] },
        ...
      ],
      "price": 158000,
      "available_quantity": 1,
      "sold_quantity": 0,
      "sale_terms": [],
      "picture_ids": ["674837-MLA26491070000_122017"],
      ...
    },
    {
      "id": 52173477261,
      "attribute_combinations": [
        { "id": "ROOMS", "name": "Ambientes", "value_id": null, "value_name": "1", "value_struct": null, "values": [{ "id": null, "name": "1", "struct": null }] },
        ...
      ],
      "price": 161000,
      "available_quantity": 1,
      "sold_quantity": 0,
      "sale_terms": [],
      "picture_ids": ["913036-MLA26491092856_122017"],
      "seller_custom_field": null,
      "catalog_product_id": null,
      "attributes": [],
      "inventory_id": null,
      "item_relations": []
    }
  ],
  "thumbnail": "http://mla-s1-p.mlstatic.com/872895-MLA26491094940_122017-I.jpg",
  "secure_thumbnail": "https://mla-s1-p.mlstatic.com/872895-MLA26491094940_122017-I.jpg",
  "status": "active",
  "tags": ["test_item"],
  "catalog_listing": false
}
```

## Gestion de Interesados / Contactos a Desarrollos Inmobiliarios

La gestión de las consultas de potenciales compradores para Desarrollos Inmobiliarios sigue el mismo proceso que para otros tipos de inmuebles. Para obtener más detalles, puedes consultar la guía de Leads.

Al igual que con otros inmuebles, existen varias formas donde el usuario comprador puede contactar para obtener más información del inmueble. Por ejemplo, en la esquina superior derecha de la galería de imágenes en la publicación o en cada uno de los modelos de desarrollo.

En todos los casos, se envía un correo electrónico al vendedor o inmobiliaria con información similar a la siguiente:

```
Hola Inmobiliaria XYZ
Te hicieron una pregunta en MercadoLibre en la publicacion MLA1111

"Hola, buenos dias. Estoy interesado en el desarrollo denominado Desarrollo Ficticio, por favor comunícate conmigo. ¡Gracias!

Datos de contacto:
Nombre: [Nombre Comprador]
E-mail: suemail@dominio.com
Teléfono: 01-1111-1111"
```

Este correo será acompañado de una notificación para el seller o inmobiliaria en la cuenta del usuario. En su perfil podrá ver todas estas notificaciones, en la esquina superior derecha.

Eventualmente, permitiremos que los usuarios no registrados puedan informarse del desarrollo inmobiliario mediante un formulario de contacto que los identifique. En las publicaciones de este tipo, dicho formulario será similar al siguiente.

Es importante recordar que el teléfono puede no aparecer porque no es un dato obligatorio del formulario de contacto, y por lo tanto el usuario puede decidir enviarlo o no.

## Gestión de Cotizaciones

El usuario comprador tiene la posibilidad de pedir una cotización para informarse de los detalles y valor del inmueble en el cual está interesado. Una cotización ocurre cuando el interesado realiza una consulta en un anuncio del tipo "Desarollo Inmobiliario".

El usuario elige la planta y la unidad (en caso de tratarse de un desarrollo inmobiliario de departamentos), y a partir de ahí, puede acceder a conocer el precio de la unidad. Una cotización es un documento que contiene información del vendedor, del inmueble y del comprador en el momento que es creada.

Cuando el usuario solicita una cotización, la información del ítem o publicación de inmueble es congelada y se mantiene para garantizar el precio del momento en que la cotización fue realizada.Existe la particularidad que para algunos procesos o casos de uso, el integrador debe enviar la variable caller.type para identificar quién es el generador de la acción. Puede ser un vendedor o un usuario. Generalmente, para las aplicaciones de lanzamientos será el vendedor.

## Cotizaciones MercadoLibre - ¿Cómo se notifica una “quotation” a su aplicación?

Para recibir notificaciones en tiempo real sobre la creación de cotizaciones (quotations), debes registrarte en nuestro feed de quotations. Este evento se origina en MercadoLibre.

Para hacerlo, dirígete al gestor de aplicaciones, donde creaste tu aplicación ([Argentina, Brasil, Chile, México, Colombia, Uruguay, Perú, Ecuador y Venezuela](https://developers.mercadolivre.com.br/devcenter/)), loguéate con el usuario que configuró la aplicación y edita la configuración. En la sección de Tópicos, se listarán subsecciones en las cuales podrás activar las notificaciones.

**Importante:**

Actualmente, cuando un comprador solicita una cotización en un anuncio de Desarrollo Inmobiliario, las notificaciones pueden recibirse por el **tópico “quotations”**  de **Items**  y/o por e-mail. Como parte de la evolución del flujo de Leads, estas notificaciones **pasarán a enviarse exclusivamente por el tópico de VIS Leads** .

De esta forma, el **subtópico “quotations” del tópico Items será deprecado el 13 de agosto de 2026**  y será **reemplazado por el subtópico “quotation” en el tópico de notificaciones de VIS Leads** . El envío del **e-mail**  de notificación de cotización también **será discontinuado el 13 de agosto de 2026** .

Para evitar la pérdida de notificaciones, realizá la **activación del subtópico “quotation” en VIS Leads** .

En la parte inferior se habilitará un campo para que definas un Callback URL: ingresa la URL pública del dominio donde deseas recibir todas las notificaciones de MercadoLibre.

Si necesitas más información sobre notificaciones puedes consultar [este link](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones).

## Buscar una cotización

**Importante:**

El cambio de formato de `external_id` aplica únicamente a los leads con `contact_type` igual a `schedule`. Si recibes un lead de este tipo, `external_id` identifica la agenda asociada y es diferente del ID del lead.

Actualmente, el ID numérico de una agenda ya se entrega en `external_id` como texto, por ejemplo `"4823917"`. Las agendas creadas a partir de la implementación del 21/12/26 tendrán un ID UUID, que puede ser UUIDv7. Las agendas anteriores conservan su mismo ID numérico, que seguirá siendo válido para consulta y actualización después del 31/12. Conserva ambos formatos como texto. Los demás tipos de lead no se ven afectados por este cambio. En la consulta de cotizaciones de esta sección, `external_id` identifica la cotización.

Al consultar los [datos del lead](https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles#:~:text=la%20tabla%20relacionada.-,Obtener%20detalles%20de%20un%20Lead,-Cuando%20MercadoLibre%20notifica), la respuesta incluirá el campo **"external_id"** , que corresponde al identificador de la cotización. Utilizá el valor de "external_id" como QUOTATION_ID en la siguiente llamada para obtener los detalles de la cotización:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/quotations/$QUOTATION_ID?caller.type=seller
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores / Descripción |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en la guía de configuración |
| QUOTATIONID | String | No | Id de la cotización a consultar |
| caller.type | String | No | Identifica quién es el generador de la acción. Puede ser un vendedor o un usuario. Generalmente, para aplicaciones de lanzamiento, será el del vendedor. Por ejemplo seller, para vendedores. |

Ejemplo de respuesta:

```
{
  "id": 5992689,
  "user": {
    "id": 535115061,
    "nickname": "TESTIIU8DDRW",
    "registration_date": "2020-03-11T16:53:15Z",
    ...
  },
  "item": {
    "id": "MLA843263657",
    "site_id": "MLA",
    "title": "Item De Prueba - No Ofertar - Test - Domus 2222",
    "subtitle": "",
    "seller_id": 534776711,
    "category_id": "MLA401806",
    "domain_id": "MLA-DEVELOPMENT_APARTMENTS_FOR_SALE",
    "price": 158000,
    "base_price": 158000,
    ...
  },
  "variation": {
    "id": 52173477243,
    "attribute_combinations": [ ... ],
    "price": 158000,
    "available_quantity": 1,
    "sold_quantity": 0,
    "picture_ids": ["674837-MLA26491070000_122017"],
    "attributes": []
  },
  "disclaimer": "Nota: La información entregada ...",
  "created_at": "2020-03-11T17:01:10Z",
  "is_guest": false
}
```

Estructura de respuesta esperada:

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| id | Int64 | No | Identificador de la cotización |
| user | Object | No | Información del usuario que realizó la cotización |
| item | Object | No | Estructura completa del Item donde se pidió la cotización |
| variation | Object | No | Estructura completa de la Variation asociada al Item que se solicitó cotizar. |
| disclaimer | String | No | Disclaimer de la publicación |
| created_at | Datetime | No | Fecha y hora de la cotización |
| is_guest | Boolean | No | Boolean para identificar un usuario Guest. |

## Buscar una cotización por Item ID

Para obtener la cantidad de cotizaciones que ha obtenido un item, puede ejecutar el siguiente comando:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/quotations/items_ids?query=$ITEMID&caller.type=seller
```

Para consultar varios ítems a la vez:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/quotations/items_ids?query=ItemId1,Itemid2,Itemid3&caller.type=seller
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en la guía de configuración |
| items_ids | String | No | Id del item a consultar, pueden ser varios id separados por coma. Ej: `items_ids?query=itemId1,Itemid2` |

Ejemplo de respuesta:

```
{
  "paging": {
    "total": 3,
    "offset": 0,
    "limit": 10
  },
  "results": [
    "MLA843263657"
  ]
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| paging | Objeto | Contiene información sobre la paginación de resultados. |
| paging.total | Int | El número total de resultados. |
| paging.offset | Int | El punto de inicio de los resultados en la lista completa. |
| paging.limit | Int | El número máximo de resultados mostrados por página. |
| results | Array | Lista de IDs de los resultados. |
| results[n] | String | Un ID específico de un resultado. |

## Consultar reporte de cotizaciones por vendedor

Para obtener la cantidad de cotizaciones que ha recibido un vendedor, se puede consultar con el id del seller mediante el siguiente comando:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/quotations/report?seller.id=$SELLER.ID
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en la guía de configuración |
| SELLER.ID | String | No | Id del vendedor que desea consultar |

Ejemplo de respuesta

```
{
  "seller_id": 534776711,
  "total": 8,
  "date_from": "0001-01-01T00:00:00Z",
  "date_to": "2020-03-11T17:48:49Z",
  "results": [
    { "date": "2020-03-11T00:00:00Z", "total": 1 }
  ]
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| seller_id | Int | El ID del vendedor. |
| total | Int | El número total de resultados. |
| date_from | String | La fecha de inicio del período del reporte. |
| date_to | String | La fecha final del período del reporte. |
| results | Array | Lista de objetos que contienen datos de resultados. |
| results[n].date | String | Fecha específica del resultado dentro del período. |
| results[n].total | Int | Número total asociado a la fecha específica del resultado. |

## Eliminar una cotización

Puedes eliminar una cotización utilizando el siguiente comando PUT de la API:

```
curl -X PUT \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "delete": true
  }' \
  "https://api.mercadolibre.com/quotations/$QUOTATION_ID?caller.type=seller"
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en la guía de configuración |
| QUOTATION_ID | String | No | Id de la cotización a eliminar |

Recibirás una respuesta con status 200 OK.

### Lecturas recomendadas

- [Variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones-para-inmuebles)

- [Leads](https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
