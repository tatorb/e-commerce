<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publica-servicios-vis -->
<!-- Sección: Guía para servicios -->

# Publica servicios

Última actualización 15/03/2023

## Publica servicios

Ahora que ya analizamos autenticación, usuarios y categorías, creemos que estás listo para realizar tu primera publicación. Sigue este tutorial para aprender cómo hacerlo.

## Puntos básicos

En la API de MercadoLibre, las publicaciones son artículos que contienen productos y otros atributos que puedes vender o comprar. Los usuarios no pueden intercambiar información de contacto de inmediato. Por eso, cada vez que existe la intención de comprar un producto, los compradores potenciales pueden formular tantas preguntas como deseen sobre el artículo y, cuando están listos, deben hacer una oferta por el producto del vendedor para que se cree un pedido tanto para el comprador como para el vendedor con el detalle de la transacción como venta o compra para cada uno. En ese momento la información de contacto se hace automáticamente visible entre esos usuarios.

## Resultados de publicaciones

Cada artículo que publicas aparecerá en los resultados de publicaciones de la búsqueda de un producto determinado. Por ejemplo, cuando un usuario busca la consulta “peluquería”, obtendrá como resultado una lista de todos los artículos relacionados. Tu artículo puede estar en esa lista. Cuando alguien hace clic en un artículo, se muestra la página Detalles del artículo con toda la información sobre el artículo que fue ingresada al momento de la publicación. Para más información, sigue leyendo.

## Página detalles del artículo

Cuando un usuario selecciona un artículo del resultado, esta página muestra los siguientes detalles del artículo:

- Item_id

- Título

- Ciudad

- Imágenes

- Precio

- Información de contacto

- Formulario de contacto

- Atributos

- Descripción detallada

- Reputación del vendedor

## Campos del artículo

Veamos un artículo común en detalle. Esto es fácil, porque solo debes conocer el item_id asociado al producto y, como es público, puedes obtenerlo en la página Detalles del artículo en la parte superior de la página, como en la imagen del ejemplo. Debes agregar el site_id antes del número y listo. Ahora puedes llamar al recurso Artículos para obtener toda la información relacionada:

Llamada:

```
curl - X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/Item_id
```

Ejemplo::

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA612001263
```

Respuesta:

```
{
  "id": "MLA612001263",
  "site_id": "MLA",
  "title": "Okm Amarok Highline Pack Automatic Cuero Navegador Esp.rebat",
  "subtitle": null,
  "seller_id": 171413284,
  "category_id": "MLA92242",
  "official_store_id": null,
  "price": 694000,
  "base_price": 694000,
  "original_price": null,
  "currency_id": "ARS",
  "initial_quantity": 1,
  "available_quantity": 1,
  "sold_quantity": 0,
  "buying_mode": "classified",
  "listing_type_id": "gold",
  "start_time": "2016-03-17T12:52:07.000Z",
  "stop_time": "2016-04-23T17:06:37.707Z",
  "condition": "not_specified",
  "permalink": "http://auto.mercadolibre.com.ar/MLA-612001263-okm-amarok-highline-pack-automatic-cuero-navegador-esprebat-_JM",
  "thumbnail": "http://mla-s2-p.mlstatic.com/624411-MLA20545255891_012016-I.jpg",
  "secure_thumbnail": "https://a248.e.akamai.net/mla-s2-p.mlstatic.com/624411-MLA20545255891_012016-I.jpg",
  "pictures": [
    {
      "id": "624411-MLA20545255891_012016",
      "url": "http://mla-s2-p.mlstatic.com/624411-MLA20545255891_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s2-p.mlstatic.com/624411-MLA20545255891_012016-O.jpg",
      "size": "500x428",
      "max_size": "1200x1028",
      "quality": ""
    },
    {
      "id": "366311-MLA20544374183_012016",
      "url": "http://mla-s1-p.mlstatic.com/366311-MLA20544374183_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/366311-MLA20544374183_012016-O.jpg",
      "size": "499x272",
      "max_size": "995x543",
      "quality": ""
    },
    {
      "id": "636311-MLA20545255955_012016",
      "url": "http://mla-s1-p.mlstatic.com/636311-MLA20545255955_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/636311-MLA20545255955_012016-O.jpg",
      "size": "500x383",
      "max_size": "1200x921",
      "quality": ""
    },
    {
      "id": "134311-MLA20545256000_012016",
      "url": "http://mla-s1-p.mlstatic.com/134311-MLA20545256000_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/134311-MLA20545256000_012016-O.jpg",
      "size": "500x357",
      "max_size": "1200x858",
      "quality": ""
    },
    {
      "id": "661411-MLA20545258607_012016",
      "url": "http://mla-s2-p.mlstatic.com/661411-MLA20545258607_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s2-p.mlstatic.com/661411-MLA20545258607_012016-O.jpg",
      "size": "500x375",
      "max_size": "1200x900",
      "quality": ""
    },
    {
      "id": "820411-MLA20545256923_012016",
      "url": "http://mla-s1-p.mlstatic.com/820411-MLA20545256923_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/820411-MLA20545256923_012016-O.jpg",
      "size": "375x500",
      "max_size": "900x1200",
      "quality": ""
    },
    {
      "id": "757311-MLA20545256948_012016",
      "url": "http://mla-s2-p.mlstatic.com/757311-MLA20545256948_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s2-p.mlstatic.com/757311-MLA20545256948_012016-O.jpg",
      "size": "375x500",
      "max_size": "900x1200",
      "quality": ""
    },
    {
      "id": "843311-MLA20545256985_012016",
      "url": "http://mla-s1-p.mlstatic.com/843311-MLA20545256985_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/843311-MLA20545256985_012016-O.jpg",
      "size": "375x500",
      "max_size": "900x1200",
      "quality": ""
    },
    {
      "id": "952411-MLA20545259213_012016",
      "url": "http://mla-s2-p.mlstatic.com/952411-MLA20545259213_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s2-p.mlstatic.com/952411-MLA20545259213_012016-O.jpg",
      "size": "375x500",
      "max_size": "900x1200",
      "quality": ""
    },
    {
      "id": "658311-MLA20545259279_012016",
      "url": "http://mla-s2-p.mlstatic.com/658311-MLA20545259279_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s2-p.mlstatic.com/658311-MLA20545259279_012016-O.jpg",
      "size": "500x375",
      "max_size": "1200x900",
      "quality": ""
    },
    {
      "id": "281411-MLA20545257928_012016",
      "url": "http://mla-s1-p.mlstatic.com/281411-MLA20545257928_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/281411-MLA20545257928_012016-O.jpg",
      "size": "500x375",
      "max_size": "1200x900",
      "quality": ""
    },
    {
      "id": "846311-MLA20545257964_012016",
      "url": "http://mla-s1-p.mlstatic.com/846311-MLA20545257964_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/846311-MLA20545257964_012016-O.jpg",
      "size": "375x500",
      "max_size": "900x1200",
      "quality": ""
    },
    {
      "id": "816311-MLA20545261007_012016",
      "url": "http://mla-s2-p.mlstatic.com/816311-MLA20545261007_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s2-p.mlstatic.com/816311-MLA20545261007_012016-O.jpg",
      "size": "489x500",
      "max_size": "1174x1200",
      "quality": ""
    },
    {
      "id": "793311-MLA20545258000_012016",
      "url": "http://mla-s1-p.mlstatic.com/793311-MLA20545258000_012016-O.jpg",
      "secure_url": "https://a248.e.akamai.net/mla-s1-p.mlstatic.com/793311-MLA20545258000_012016-O.jpg",
      "size": "500x254",
      "max_size": "1200x610",
      "quality": ""
    }
  ],
  "video_id": "XVYGawQRnlo",
  "descriptions": [
    {
      "id": "MLA612001263-1056189973"
    }
  ],
  "accepts_mercadopago": false,
  "non_mercado_pago_payment_methods": [
  ],
  "shipping": {
    "mode": "not_specified",
    "local_pick_up": false,
    "free_shipping": false,
    "methods": [
    ],
    "dimensions": null,
    "tags": [
    ]
  },
  "international_delivery_mode": "none",
  "seller_address": {
    "id": 153496278,
    "comment": "",
    "address_line": "av Gaona 4460",
    "zip_code": "",
    "city": {
      "id": "TUxBQkZMTzg5MjFa",
      "name": "Floresta"
    },
    "state": {
      "id": "AR-C",
      "name": "Capital Federal"
    },
    "country": {
      "id": "AR",
      "name": "Argentina"
    },
    "latitude": "",
    "longitude": "",
    "search_location": {
      "neighborhood": {
        "id": "TUxBQkZMTzg5MjFa",
        "name": "Floresta"
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
  "seller_contact": {
    "contact": "",
    "other_info": "",
    "area_code": "",
    "phone": "",
    "area_code2": "",
    "phone2": "",
    "email": "",
    "webpage": ""
  },
  "location": {
    "address_line": "",
    "zip_code": "",
    "neighborhood": {
      "id": "TUxBQlNBTjEyMjNa",
      "name": "Santa Rita"
    },
    "city": {
      "id": "TUxBQ0NBUGZlZG1sYQ",
      "name": "Capital Federal"
    },
    "state": {
      "id": "TUxBUENBUGw3M2E1",
      "name": "Capital Federal"
    },
    "country": {
      "id": "AR",
      "name": "Argentina"
    },
    "latitude": "",
    "longitude": "",
    "open_hours": ""
  },
  "geolocation": {
    "latitude": "",
    "longitude": ""
  },
  "coverage_areas": [
  ],
  "attributes": [
    {
      "id": "MLA1743-HORPREF",
      "name": "Horario de contacto",
      "value_id": "",
      "value_name": "08.30 a 20 ",
      "attribute_group_id": "ADICIONALES",
      "attribute_group_name": "Adicionales"
    },
    {
      "id": "MLA1744-COLOREXT",
      "name": "Color",
      "value_id": "",
      "value_name": "",
      "attribute_group_id": "ADICIONALES",
      "attribute_group_name": "Adicionales"
    },
    {
      "id": "MLA1744-DIREC",
      "name": "Dirección",
      "value_id": "",
      "value_name": "",
      "attribute_group_id": "ADICIONALES",
      "attribute_group_name": "Adicionales"
    },
    {
      "id": "MLA1744-OWNER",
      "name": "Único dueño",
      "value_id": "",
      "value_name": "",
      "attribute_group_id": "ADICIONALES",
      "attribute_group_name": "Adicionales"
    },
    {
      "id": "MLA1744-AIRACON",
      "name": "Aire acondicionado",
      "value_id": "MLA1744-AIRACON-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-ALARMLUC",
      "name": "Alarma de luces encendidas",
      "value_id": "MLA1744-ALARMLUC-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-APERBAUL",
      "name": "Apertura remota de baúl",
      "value_id": "MLA1744-APERBAUL-N",
      "value_name": "No",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-ASIENELEC",
      "name": "Asientos eléctricos",
      "value_id": "MLA1744-ASIENELEC-N",
      "value_name": "No",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-ASREBAT",
      "name": "Asiento trasero rebatible",
      "value_id": "MLA1744-ASREBAT-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-ASREGULA",
      "name": "Asiento conductor regulable en altura",
      "value_id": "MLA1744-ASREGULA-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-BLQCNTDOOR",
      "name": "Cierre centralizado de puertas",
      "value_id": "MLA1744-BLQCNTDOOR-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-CLIMAUT",
      "name": "Climatizador automático",
      "value_id": "MLA1744-CLIMAUT-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-COMPABO",
      "name": "Computadora de abordo",
      "value_id": "MLA1744-COMPABO-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-CTRLVEL",
      "name": "Control de velocidad de crucero",
      "value_id": "MLA1744-CTRLVEL-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-ESPELEC",
      "name": "Espejos eléctricos",
      "value_id": "MLA1744-ESPELEC-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-ESTACIONAM",
      "name": "Sensor de estacionamiento",
      "value_id": "MLA1744-ESTACIONAM-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-FAROREG",
      "name": "Faros regulables desde el interior",
      "value_id": "MLA1744-FAROREG-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-GPS",
      "name": "GPS",
      "value_id": "MLA1744-GPS-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-SENSLL",
      "name": "Sensor de lluvia",
      "value_id": "MLA1744-SENSLL-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-SENSLUZ",
      "name": "Sensor de luz",
      "value_id": "MLA1744-SENSLUZ-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-TAPCUERO",
      "name": "Tapizado de cuero",
      "value_id": "MLA1744-TAPCUERO-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-TECHOCORR",
      "name": "Techo corredizo",
      "value_id": "MLA1744-TECHOCORR-N",
      "value_name": "No",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-VIDELEC",
      "name": "Cristales eléctricos",
      "value_id": "MLA1744-VIDELEC-Y",
      "value_name": "Sí",
      "attribute_group_id": "CONFORT",
      "attribute_group_name": "Confort"
    },
    {
      "id": "MLA1744-LIMPIA_LAV",
      "name": "Limpia/lava luneta",
      "value_id": "MLA1744-LIMPIA/LAV-N",
      "value_name": "No",
      "attribute_group_id": "EXTERIOR",
      "attribute_group_name": "Exterior"
    },
    {
      "id": "MLA1744-LLANALEAC",
      "name": "Llantas de aleación",
      "value_id": "MLA1744-LLANALEAC-Y",
      "value_name": "Sí",
      "attribute_group_id": "EXTERIOR",
      "attribute_group_name": "Exterior"
    },
    {
      "id": "MLA1744-PARAGOLPES",
      "name": "Paragolpes pintados",
      "value_id": "MLA1744-PARAGOLPES-Y",
      "value_name": "Sí",
      "attribute_group_id": "EXTERIOR",
      "attribute_group_name": "Exterior"
    },
    {
      "id": "MLA1744-VIDPOLARIZ",
      "name": "Vidrios polarizados",
      "value_id": "MLA1744-VIDPOLARIZ-N",
      "value_name": "No",
      "attribute_group_id": "EXTERIOR",
      "attribute_group_name": "Exterior"
    },
    {
      "id": "MLA1744-COMBUS",
      "name": "Combustible",
      "value_id": "MLA1744-COMBUS-DIESEL",
      "value_name": "Diesel",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA1744-DOOR",
      "name": "Cant. de puertas",
      "value_id": "MLA1744-DOOR-4",
      "value_name": "4",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA1744-KMTS",
      "name": "Kilómetros",
      "value_id": "",
      "value_name": "0",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA1744-MARC",
      "name": "Marca",
      "value_id": "MLA1744-MARC-VOLKSWAGEN",
      "value_name": "Volkswagen",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA1744-MODL",
      "name": "Modelo",
      "value_id": "MLA1744-MODL-AMAROK",
      "value_name": "Amarok",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA1744-TRANS",
      "name": "Transmisión",
      "value_id": "",
      "value_name": "",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA1744-YEAR",
      "name": "Año",
      "value_id": "MLA1744-YEAR-95192c",
      "value_name": "2016",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA92242-VERS",
      "name": "Versión",
      "value_id": "",
      "value_name": "",
      "attribute_group_id": "FIND",
      "attribute_group_name": "Ficha técnica"
    },
    {
      "id": "MLA1744-3LUZSTOP",
      "name": "Tercer stop",
      "value_id": "MLA1744-3LUZSTOP-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-ABS",
      "name": "Frenos ABS",
      "value_id": "MLA1744-ABS-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-AIR1",
      "name": "Airbag conductor",
      "value_id": "MLA1744-AIR1-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-AIR2",
      "name": "Airbag pasajero",
      "value_id": "MLA1744-AIR2-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-AIR3",
      "name": "Airbag laterales",
      "value_id": "MLA1744-AIR3-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-AIRBAGCORT",
      "name": "Airbag de cortina",
      "value_id": "MLA1744-AIRBAGCORT-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-ALAR",
      "name": "Alarma",
      "value_id": "MLA1744-ALAR-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-APCABEZA",
      "name": "Apoya cabeza en asientos traseros",
      "value_id": "MLA1744-APCABEZA-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-BLIND",
      "name": "Blindado",
      "value_id": "MLA1744-BLIND-N",
      "value_name": "No",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-CNTTRACC",
      "name": "Control de tracción",
      "value_id": "MLA1744-CNTTRACC-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-CONTR",
      "name": "Control de estabilidad",
      "value_id": "MLA1744-CONTR-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-DOBTRACC",
      "name": "Doble tracción",
      "value_id": "MLA1744-DOBTRACC-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-FARANTI",
      "name": "Faros antinieblas delanteros",
      "value_id": "MLA1744-FARANTI-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-FAROXEN",
      "name": "Faros de xenón",
      "value_id": "MLA1744-FAROXEN-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-INMOVMOT",
      "name": "Inmovilizador de motor",
      "value_id": "MLA1744-INMOVMOT-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-ISOFIX",
      "name": "Isofix",
      "value_id": "MLA1744-ISOFIX-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-NEBLTRAS",
      "name": "Faros antinieblas traseros",
      "value_id": "MLA1744-NEBLTRAS-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-REPFUERZA",
      "name": "Repartidor electrónico de fuerza de frenado",
      "value_id": "MLA1744-REPFUERZA-Y",
      "value_name": "Sí",
      "attribute_group_id": "SECURITY",
      "attribute_group_name": "Seguridad"
    },
    {
      "id": "MLA1744-AM_FM",
      "name": "AM/FM",
      "value_id": "MLA1744-AM/FM-Y",
      "value_name": "Sí",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-BLUETOOTH",
      "name": "Bluetooth",
      "value_id": "MLA1744-BLUETOOTH-Y",
      "value_name": "Sí",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-CAJACD",
      "name": "Caja de CD",
      "value_id": "MLA1744-CAJACD-N",
      "value_name": "No",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-CARGADORCD",
      "name": "Cargador de CD",
      "value_id": "MLA1744-CARGADORCD-N",
      "value_name": "No",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-CASET",
      "name": "Pasacassette",
      "value_id": "MLA1744-CASET-N",
      "value_name": "No",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-COMANDOSAT",
      "name": "Comando satelital de stereo",
      "value_id": "MLA1744-COMANDOSAT-N",
      "value_name": "No",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-DVD",
      "name": "DVD",
      "value_id": "MLA1744-DVD-N",
      "value_name": "No",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-ENTAUXILIA",
      "name": "Entrada auxiliar",
      "value_id": "MLA1744-ENTAUXILIA-Y",
      "value_name": "Sí",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-MP3",
      "name": "MP3",
      "value_id": "MLA1744-MP3-Y",
      "value_name": "Sí",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-REPRODCD",
      "name": "CD",
      "value_id": "MLA1744-REPRODCD-Y",
      "value_name": "Sí",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-TARJETASD",
      "name": "Tarjeta SD",
      "value_id": "MLA1744-TARJETASD-Y",
      "value_name": "Sí",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    },
    {
      "id": "MLA1744-USB",
      "name": "Entrada USB",
      "value_id": "MLA1744-USB-Y",
      "value_name": "Sí",
      "attribute_group_id": "SONIDO",
      "attribute_group_name": "Sonido"
    }
  ],
  "warnings": [
  ],
  "listing_source": "",
  "variations": [
  ],
  "status": "active",
  "sub_status": [
  ],
  "tags": [
    "dragged_visits"
  ],
  "warranty": null,
  "catalog_product_id": null,
  "parent_item_id": "MLA599924359",
  "differential_pricing": null,
  "deal_ids": [
  ],
  "automatic_relist": false,
  "date_created": "2016-03-17T12:52:08.000Z",
  "last_updated": "2016-03-22T17:07:24.286Z"
}
```

## Definición de atributos

Cuando creas un artículo, algunos de los campos son obligatorios, mientras que otros se pueden omitir o los agregaremos automáticamente. Definirán cómo se muestra el artículo, cómo pueden comprarlo los compradores y la posición en los resultados de la búsqueda, entre otras variables.

### Título

El título es un atributo obligatorio y la clave para que los compradores encuentren tu producto; por eso, debes ser lo más específico posible. La mejor forma de armar un título es nombre + marca + modelo + especificaciones técnicas y características + servicios adicionales. Separa las palabras con espacios y no utilices símbolos ni signos de puntuación. Controla para evitar palabras con errores de ortografía. Por ejemplo: Ipod Touch Apple 16gb 5 Geração.

### Descripción

La información detallada mejorará tus posibilidades de vender un producto y te ahorrará tiempo al no tener que responder preguntas. Al trabajar con descripciones, existen algunas consideraciones; por ejemplo, no se permite publicar una descripción con información de contacto. Si te interesa conocer más sobre este tema, consulta nuestra guía [Descripciones de Artículos](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos).

Nota:

Ten en cuenta que la descripción del producto deberá ser en texto sin formato..

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

Te recomendamos no utilizar servidores lentos para alojar tus imágenes porque pueden generar desventajas al momento de publicar. También puedes agregar o cambiar las imágenes de tu artículo aquí más adelante. [Por favor, lee más sobre este tema para conocer qué tipo de imágenes se permiten y cómo trabajar con ellas.](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes)

### Categoría

Los vendedores deben definir una categoría en el site de MercadoLibre. Este atributo es obligatorio y solo acepta ID preestablecidos. Para más información, lee la guía de categorías. [Para acceder a una sugerencia de categorías, lee este artículo](https://developers.mercadolibre.com.ar/es_ar/elige-tipo-de-servicio).

```
{
 ....
  "category_id":"MLA12683",
 ...
}
```

### Precio

Éste es un atributo obligatorio: cuando defines un nuevo artículo, debe tener precio. Te sugerimos que busques artículos similares en nuestro mercado para conocer el mejor precio para tus productos y aumentar tu competitividad. Si definiste un precio, pero no estás contento con el mismo, puedes cambiarlo más tarde; aprende cómo modificar artículos.

### Moneda

Además del precio, debes definir una moneda. Este atributo también es obligatorio. Debes definirla utilizando un ID preestablecido. [Sabrás qué ID enviar llamando a nuestro recurso Monedas](https://developers.mercadolibre.com.ar/es_ar/elige-tipo-de-servicio).

### Seller custom field

Si bien el Seller custom field no es obligatorio, es muy útil porque no existen valores preestablecidos y puedes enviar lo que desees como una String [cadena]. La mayoría de los vendedores utilizan este campo para asociar sus propios SKU a sus productos y así identificar el producto vendido en el pedido.

Ejemplo para modificar este campo en un item:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -d '{"seller_custom_field": "21000093"}' https://api.mercadolibre.com/items/MLA599074368
```

## Listing type

Este es otro caso de atributo obligatorio que sólo acepta valores predefinidos y es muy importante que entienda esto. Existen diferentes tipos de publicación disponible para cada site. Debe realizar una llamada mixta a través de los sites y de los recursos listinng_types para saber cuales son los listinng_types que se aceptan. [. Accede a nuestra guía para saber qué tipo de publicación es más conveniente para su servicio.](https://developers.mercadolibre.com.ar/pt_br/validador-de-publicacoes).

Chamada:

```
 curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/listing_types
```

Ejemplo:

```
 curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/listing_types
```

Respuesta:

```
 [
  {
    "site_id": "MLA",
    "id": "gold_pro",
    "name": "Oro Premium Full"
  },
  {
    "site_id": "MLA",
    "id": "gold_premium",
    "name": "Oro Premium"
  },
  {
    "site_id": "MLA",
    "id": "gold_special",
    "name": "Oro Profesional"
  },
  {
    "site_id": "MLA",
    "id": "gold",
    "name": "Oro"
  },
  {
    "site_id": "MLA",
    "id": "silver",
    "name": "Plata"
  },
  {
    "site_id": "MLA",
    "id": "bronze",
    "name": "Bronce"
  },
  {
    "site_id": "MLA",
    "id": "free",
    "name": "Gratuita"
  }
Publica un servicio

Estás listo para publicar tu primer artículo. Recuerda que necesitarás un access_token para hacerlo. Si tienes preguntas sobre cómo obtener tu access token, por favor regresa al tutorial de autenticación. También te recomendamos utilizar usuarios de test para publicar artículos de prueba. Si no estás familiarizado con los mismos, por favor consulta la sección generar usuarios de test aquí. Además, te recomendamos validar el JSON que envías antes de realizar la solicitud POST; por eso, será mejor que consultes este tutorial de validación de artículos, que es fácil y rápido. Puedes crear un JSON para tu artículo en base al ejemplo a continuación o simplemente envíalo así y estarás publicando un producto de muestra en el site:
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d{
title: "Property title",
  category_id: "MLA1474",
  price: 100000,
  currency_id: "ARS",
  available_quantity: 1,
  buying_mode: "classified",
  listing_type_id: "silver",
  condition: "not_specified",
  pictures: [
    {
      id: "MLA2096545948_102011"
    },
    {
      source:"http://media.point2.com/p2a/htmltext/f2a4/590f/3627/f49be256595a86c91457/original.jpg"
    }
  ],
  seller_contact: {
    contact: "Contact name",
    other_info: "Additional contact info",
    area_code: "011",
    phone: "4444-5555",
    area_code2: "",
    phone2: "",
    email: "contact-email@somedomain.com",
    webmail: ""
  },
  location: {
    address_line: "My property address 1234",
    zip_code: "01234567",
    neighborhood: {
      id: "TUxBQlBBUzgyNjBa"
    },
    latitude: -34.48755,
    longitude: -58.56987,
  },
  attributes: [
    {
      id: "MLA1472-ANTIG",
      value_id: "MLA1472-ANTIG-A_ESTRENAR"
    },
    {
      id: "MLA1472-DISPOSIC",
      value_id: "MLA1472-DISPOSIC-FRENTE"
    },
    {
      id: "MLA1472-AMBQTY",
      value_id: "MLA1472-AMBQTY-2"
    },
    {
      id: "MLA1472-BATHQTY",
      value_id: "MLA1472-BATHQTY-1"
    },
    {
      id: "MLA1472-DORMQTY",
      value_id: "MLA1472-DORMQTY-2"
    },
    {
      id: "MLA1472-EDIFIC",
      value_id: "MLA1472-EDIFIC-DEPARTAMENTO"
    },
    {
      id: "MLA1472-MTRS",
      value_name: "80"
    },
    {
      id: "MLA1472-MTRSTOTAL",
      value_name: "100"
    }
  ],
  description : "This is the real estate property description."
}

Tenga en cuenta que el ejemplo anterior sólo fiunciona en MLA (Argentina). Si está trabajando en cualquier otro país, deberá susutituir los valores de category_id, currency_id e quizás listing_type_id. La API de Productos descargará automaticamente las imágenes proporcionadas por Mercado Libre Storage, creando una publicación para su producto. Recibirá la siguiente respuesta:
{
  "id":"MLA430387888",
  "site_id":"MLA",
  "title":"Anteojos Ray Ban Wayfare",
  "sold_quantity":0,
  "permalink":"http://articulo.mercadolibre.com.ar/MLA-430387888-anteojos-ray-ban-wayfare-_JM",
    ...
}
¡Felicitaciones, publicaste tu primer producto! Accede a la página Detalles del producto a través del enlace . Para calcular los feeds de ventas de un producto según diferentes parámetros, sigue la guía para Calcular los precios de las publicaciones.
 
 
  
    
      
      
        
        
      
    
  

    
      Nota:
    
    
        Si, experimenta algún inconveniente al intentar publicar, consulte los valores de referencia de la tabla de código de error de la API que se encuentran al final de esta guía.. 

    
  

.
Tiendas Oficiales para Vehículos e Inmuebles
Consulta la siguiente guía sobre Tiendas Oficiales para Vehículos e Inmuebles.
Próximo: Sincronização de publicações
```
