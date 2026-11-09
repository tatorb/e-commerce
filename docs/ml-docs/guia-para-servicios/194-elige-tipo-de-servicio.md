<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/elige-tipo-de-servicio -->
<!-- Sección: Guía para servicios -->

# Elige tipo de servicio

Última actualización 30/12/2025

## Elige tipo de servicio

Las categorías son un conjunto jerárquico de grupos en los cuales se enumeran las publicaciones de naturaleza similar, denominados “Árbol de Categorías”. Las categorías ayudan a los usuarios a buscar fácilmente el tipo de publicación que desean. Cada sitio tiene su propio conjunto de categorías, es decir que Argentina tendrá un conjunto único de categorías, diferente de las que encontrarás en Brasil, porque cada país tiene sus propias particularidades en el mercado clasificados. Antes de publicar un publicación, debes explorar la estructura de categorías y elegir en cuál deseas publicar. Para ayudarte, puedes descargar la [jerarquía completa de categorías](https://developers.mercadolibre.com.ar/es_ar/descarga-de-categorias) con ID y nombres fáciles desde nuestra API.

## Categorías por Site

El recurso Sites puede ofrecerte la estructura de categorías para un país en particular, en este caso Argentina.

Ejemplo:

```
curl -X GET 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/categories
```

Respuesta:

```
"categories": [
{
"id": "MLA5725",
"name": "Accesorios para Vehiculos",
},
{
"id": "MLA1071",
"name": "Animales y Mascotas",
},
{
"id": "MLA1367",
"name": "Antigüedades",
},
{
"id": "MLA1743",
"name": "Autos, Motos y Otros",
},
```

Para categorías de segundo nivel o información relacionada con categorías específicas, debes utilizar el recurso /categories y enviar el ID de categoría como parámetro URL.

Ejemplo:

```
curl -X GET 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1071
```

Respuesta:

```
{
  "id": "MLA1540",
  "name": "Servicios",
  "picture": "http://resources.mlstatic.com/category/images/3b5619b2-cc62-4775-8e64-05a1e5585bba.png",
  "permalink": "http://www.mercadolibre.com.ar/servicios/",
  "total_items_in_this_category": 33783,
  "path_from_root": [
    {
      "id": "MLA1540",
      "name": "Servicios"
    }
  ],
  "children_categories": [
    {
      "id": "MLA122264",
      "name": "Arte, Música y Cine",
      "total_items_in_this_category": 1134
    },
    {
      "id": "MLA10514",
      "name": "Belleza y Cuidado Personal",
      "total_items_in_this_category": 1029
    },
    {
      "id": "MLA43986",
      "name": "Cursos y Clases",
      "total_items_in_this_category": 1188
    },
    {
      "id": "MLA91058",
      "name": "Delivery",
      "total_items_in_this_category": 338
    },
    {
      "id": "MLA1550",
      "name": "Fiestas y Eventos",
      "total_items_in_this_category": 6840
    },
    {
      "id": "MLA122258",
      "name": "Hogar",
      "total_items_in_this_category": 4067
    },
    {
      "id": "MLA56666",
      "name": "Imprenta",
      "total_items_in_this_category": 717
    },
    {
      "id": "MLA9007",
      "name": "Mantenimiento de Vehículos",
      "total_items_in_this_category": 1980
    },
    {
      "id": "MLA111029",
      "name": "Medicina y Salud",
      "total_items_in_this_category": 641
    },
    {
      "id": "MLA113657",
      "name": "Oficios",
      "total_items_in_this_category": 1994
    },
    {
      "id": "MLA1898",
      "name": "Otros Servicios",
      "total_items_in_this_category": 2842
    },
    {
      "id": "MLA1541",
      "name": "Profesionales",
      "total_items_in_this_category": 2106
    },
    {
      "id": "MLA91088",
      "name": "Ropa y Moda",
      "total_items_in_this_category": 515
    },
    {
      "id": "MLA11813",
      "name": "Servicio Técnico",
      "total_items_in_this_category": 3916
    },
    {
      "id": "MLA11798",
      "name": "Servicios para Mascotas",
      "total_items_in_this_category": 653
    },
    {
      "id": "MLA91083",
      "name": "Servicios para Oficinas",
      "total_items_in_this_category": 262
    },
    {
      "id": "MLA9038",
      "name": "Transporte",
      "total_items_in_this_category": 2316
    },
    {
      "id": "MLA1229",
      "name": "Viajes y Turismo",
      "total_items_in_this_category": 1218
    }
  ],
  "attribute_types": "none",
  "settings": {
    "adult_content": false,
    "buying_allowed": true,
    "buying_modes": [
      "classified"
    ],
    "coverage_areas": "optional",
    "currencies": [
      "ARS",
      "USD"
    ],
    "fragile": false,
    "immediate_payment": "optional",
    "item_conditions": [
      "not_allowed"
    ],
    "items_reviews_allowed": true,
    "max_description_length": 50000,
    "max_pictures_per_item": 12,
    "max_sub_title_length": 70,
    "max_title_length": 60,
    "price": "optional",
    "restrictions": [
    ],
    "rounded_address": false,
    "seller_contact": "required",
    "shipping_modes": [
      "not_specified",
      "custom"
    ],
    "shipping_options": [
    ],
    "shipping_profile": "not_allowed",
    "show_contact_information": true,
    "simple_shipping": "not_allowed",
    "stock": "optional",
    "tags": [
    ],
    "vip_subdomain": "servicio",
    "mirror_category": null,
    "listing_allowed": false,
    "maximum_price": null,
    "minimum_price": null
  },
  "meta_categ_id": null,
  "attributable": false
}
```

## Categorías JSON

Realizar una llamada a una categoría en particular te permitirá conocer sus atributos. A continuación encontrarás una descripción de algunos de estos atributos.

```
curl -X GET 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA58257
{
  "id": "MLA58257",
  "name": "Estudios de Grabación",
  "picture": null,
  "permalink": null,
  "total_items_in_this_category": 37,
  "path_from_root": [
    {
      "id": "MLA1540",
      "name": "Servicios"
    },
    {
      "id": "MLA122264",
      "name": "Arte, Música y Cine"
    },
    {
      "id": "MLA94730",
      "name": "Música"
    },
    {
      "id": "MLA58257",
      "name": "Estudios de Grabación"
    }
  ],
  "children_categories": [
  ],
  "attribute_types": "none",
  "settings": {
    "adult_content": false,
    "buying_allowed": true,
    "buying_modes": [
      "classified"
    ],
    "coverage_areas": "optional",
    "currencies": [
      "ARS",
      "USD"
    ],
    "fragile": false,
    "immediate_payment": "optional",
    "item_conditions": [
      "not_allowed"
    ],
    "items_reviews_allowed": true,
    "max_description_length": 50000,
    "max_pictures_per_item": 12,
    "max_sub_title_length": 70,
    "max_title_length": 60,
    "price": "optional",
    "restrictions": [
    ],
    "rounded_address": false,
    "seller_contact": "required",
    "shipping_modes": [
      "not_specified",
      "custom"
    ],
    "shipping_options": [
    ],
    "shipping_profile": "not_allowed",
    "show_contact_information": true,
    "simple_shipping": "not_allowed",
    "stock": "optional",
    "tags": [
    ],
    "vip_subdomain": "servicio",
    "mirror_category": null,
    "listing_allowed": true,
    "maximum_price": null,
    "minimum_price": null
  },
  "meta_categ_id": null,
  "attributable": false
}
```

## Atributos específicos de las categorías

Para conocer los atributos específicos y valores posibles de las categorías que debes enviar para publicar un publicación, consulta el recurso atributos.

Ejemplo:

```
curl -X GET 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA24272/attributes
```

Respuesta:

```
{
  "id": "MLA1744-MARC",
  "name": "Marca",
  "value_type": "list",
  "tags": {
    "fixed": true,
    "required": true
  },
  "values": [
    {
      "id": "MLA1744-MARC-FORD",
      "name": "Ford"
    }
  ],
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-MODL",
  "name": "Modelo",
  "value_type": "list",
  "tags": {
    "fixed": true,
    "required": true
  },
  "values": [
    {
      "id": "MLA1744-MODL-ECOSPORT",
      "name": "Ecosport"
    }
  ],
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-DOOR",
  "name": "Cant. de puertas",
  "value_type": "list",
  "tags": {
    "required": true
  },
  "values": [
    {
      "id": "MLA1744-DOOR-2",
      "name": "2"
    },
    {
      "id": "MLA1744-DOOR-3",
      "name": "3"
    },
    {
      "id": "MLA1744-DOOR-4",
      "name": "4"
    },
    {
      "id": "MLA1744-DOOR-5",
      "name": "5"
    }
  ],
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-COMBUS",
  "name": "Combustible",
  "value_type": "list",
  "tags": {
    "required": true
  },
  "values": [
    {
      "id": "MLA1744-COMBUS-DIESEL",
      "name": "Diesel"
    },
    {
      "id": "MLA1744-COMBUS-NAFTA",
      "name": "Nafta"
    },
    {
      "id": "MLA1744-COMBUS-NAFTAGNC",
      "name": "Nafta/Gnc"
    }
  ],
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-KMTS",
  "name": "Kilómetros",
  "value_type": "number",
  "value_max_length": 60,
  "tags": {
    "required": true
  },
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-YEAR",
  "name": "Año",
  "value_type": "list",
  "tags": {
    "required": true
  },
  "values": [
    {
      "id": "MLA1744-YEAR-95192c",
      "name": "2016"
    },
    {
      "id": "a9f0a06",
      "name": "2015"
    },
    {
      "id": "MLA1744-YEAR-2014",
      "name": "2014"
    },
    {
      "id": "MLA1744-YEAR-2013",
      "name": "2013"
    },
    {
      "id": "MLA1744-YEAR-2012",
      "name": "2012"
    },
    {
      "id": "MLA1744-YEAR-2011",
      "name": "2011"
    },
    {
      "id": "MLA1744-YEAR-2010",
      "name": "2010"
    },
    {
      "id": "MLA1744-YEAR-2009",
      "name": "2009"
    },
    {
      "id": "MLA1744-YEAR-2008",
      "name": "2008"
    },
    {
      "id": "MLA1744-YEAR-2007",
      "name": "2007"
    },
    {
      "id": "MLA1744-YEAR-2006",
      "name": "2006"
    },
    {
      "id": "MLA1744-YEAR-2005",
      "name": "2005"
    },
    {
      "id": "MLA1744-YEAR-2004",
      "name": "2004"
    },
    {
      "id": "MLA1744-YEAR-2003",
      "name": "2003"
    },
    {
      "id": "MLA1744-YEAR-2002",
      "name": "2002"
    },
    {
      "id": "MLA1744-YEAR-2001",
      "name": "2001"
    },
    {
      "id": "MLA1744-YEAR-2000",
      "name": "2000"
    },
    {
      "id": "MLA1744-YEAR-1999",
      "name": "1999"
    },
    {
      "id": "MLA1744-YEAR-1998",
      "name": "1998"
    },
    {
      "id": "MLA1744-YEAR-1997",
      "name": "1997"
    },
    {
      "id": "MLA1744-YEAR-1996",
      "name": "1996"
    },
    {
      "id": "MLA1744-YEAR-1995",
      "name": "1995"
    },
    {
      "id": "MLA1744-YEAR-1994",
      "name": "1994"
    },
    {
      "id": "MLA1744-YEAR-1993",
      "name": "1993"
    },
    {
      "id": "MLA1744-YEAR-1992",
      "name": "1992"
    },
    {
      "id": "MLA1744-YEAR-1991",
      "name": "1991"
    },
    {
      "id": "MLA1744-YEAR-1990",
      "name": "1990"
    },
    {
      "id": "MLA1744-YEAR-1989",
      "name": "1989"
    },
    {
      "id": "MLA1744-YEAR-1988",
      "name": "1988"
    },
    {
      "id": "MLA1744-YEAR-1987",
      "name": "1987"
    },
    {
      "id": "MLA1744-YEAR-1986",
      "name": "1986"
    },
    {
      "id": "MLA1744-YEAR-1985",
      "name": "1985"
    },
    {
      "id": "MLA1744-YEAR-1984",
      "name": "1984"
    },
    {
      "id": "MLA1744-YEAR-1983",
      "name": "1983"
    },
    {
      "id": "MLA1744-YEAR-1982",
      "name": "1982"
    },
    {
      "id": "MLA1744-YEAR-1981",
      "name": "1981"
    },
    {
      "id": "MLA1744-YEAR-1980",
      "name": "1980"
    }
  ],
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-CAJACD",
  "name": "Caja de CD",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-CAJACD-N",
      "name": "No"
    },
    {
      "id": "MLA1744-CAJACD-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA24272-VERS",
  "name": "Versión",
  "value_type": "list",
  "tags": {
  },
  "values": [
    {
      "id": "MLA0150027005-MLA24272",
      "name": "1.4 TDI XL Plus % MP3"
    },
    {
      "id": "MLA0150027033-MLA24272",
      "name": "1.4 TDI XL Plus MP3 (L08)"
    },
    {
      "id": "MLA0150027006-MLA24272",
      "name": "1.4 TDI XLS MP3"
    },
    {
      "id": "MLA0150027034-MLA24272",
      "name": "1.4 TDI XLS MP3 (L08)"
    },
    {
      "id": "d4de20c",
      "name": "1.6 Nafta S MT5 (110cv)"
    },
    {
      "id": "MLA0150027001-MLA24272",
      "name": "1.6 XL Plus % MP3"
    },
    {
      "id": "MLA0150027010-MLA24272",
      "name": "1.6 XL Plus 2ABG"
    },
    {
      "id": "MLA0150027009-MLA24272",
      "name": "1.6 XL Plus ABG"
    },
    {
      "id": "MLA0150027027-MLA24272",
      "name": "1.6 XL Plus MP3 (L08)"
    },
    {
      "id": "MLA0150027002-MLA24272",
      "name": "1.6 XLS % MP3"
    },
    {
      "id": "MLA0150027011-MLA24272",
      "name": "1.6 XLS ABG"
    },
    {
      "id": "MLA0150027028-MLA24272",
      "name": "1.6 XLS MP3 (L08)"
    },
    {
      "id": "MLA0150027014-MLA24272",
      "name": "1.6 XLS MP3 ABS"
    },
    {
      "id": "MLA0150027022-MLA24272",
      "name": "1.6 XLT"
    },
    {
      "id": "MLA0150027015-MLA24272",
      "name": "1.6 XLT Free Style"
    },
    {
      "id": "MLA0150027038-MLA24272",
      "name": "1.6 XLT Free Style (L08) DICONTINUO"
    },
    {
      "id": "MLA0150027037-MLA24272",
      "name": "1.6 XLT Plus MP3 (L08)"
    },
    {
      "id": "MLA0150027023-MLA24272",
      "name": "1.6 XLT SVP HE - Edic. Limitada"
    },
    {
      "id": "MLA0150027024-MLA24272",
      "name": "1.6 XLT SVP SHE - Edic. Limitada"
    },
    {
      "id": "MLA0150027029-MLA24272",
      "name": "2.0 XLS (L08)"
    },
    {
      "id": "MLA0150027004-MLA24272",
      "name": "2.0 XLT"
    },
    {
      "id": "MLA0150027035-MLA24272",
      "name": "2.0 XLT (L08)"
    },
    {
      "id": "MLA0150027013-MLA24272",
      "name": "2.0 XLT 2ABG"
    },
    {
      "id": "MLA0150027008-MLA24272",
      "name": "2.0 XLT 4X4"
    },
    {
      "id": "MLA0150027007-MLA24272",
      "name": "2.0 XLT 4X4 Plus Cuero"
    },
    {
      "id": "MLA0150027032-MLA24272",
      "name": "2.0 XLT 4X4 Plus Cuero (L08)"
    },
    {
      "id": "MLA0150027012-MLA24272",
      "name": "2.0 XLT ABG"
    },
    {
      "id": "MLA0150027025-MLA24272",
      "name": "2.0 XLT AT"
    },
    {
      "id": "MLA0150027026-MLA24272",
      "name": "2.0 XLT AT Plus Cuero"
    },
    {
      "id": "MLA0150027036-MLA24272",
      "name": "2.0 XLT Night Running (L08) - Edic. Limitada"
    },
    {
      "id": "MLA0150027031-MLA24272",
      "name": "2.0 XLT Plus AT Cuero (L08)"
    },
    {
      "id": "MLA0150027021-MLA24272",
      "name": "2.0 XLT Plus Cuero"
    },
    {
      "id": "MLA0150027030-MLA24272",
      "name": "2.0 XLT Plus Cuero (L08)"
    },
    {
      "id": "ca9d9bf",
      "name": "FreeStyle 1.6L Sigma"
    },
    {
      "id": "a54e5d5",
      "name": "FreeStyle 2.0L Duratec 4WD"
    },
    {
      "id": "07ebca7",
      "name": "S 1.5L Duratorq TDCi"
    },
    {
      "id": "3ad53d4",
      "name": "S 1.6L Sigma"
    },
    {
      "id": "30a9692",
      "name": "SE 1.5L Duratorq TDCi"
    },
    {
      "id": "f1b7b93",
      "name": "SE 1.6L Sigma"
    },
    {
      "id": "ab9e7ab",
      "name": "SE 2.0L Duratec"
    },
    {
      "id": "5d8133e",
      "name": "Titanium 1.6L Sigma"
    },
    {
      "id": "8d53516",
      "name": "Titanium 2.0L Duratec"
    },
    {
      "id": "41d7238",
      "name": "Titanium 2.0L Duratec AT"
    },
    {
      "id": "acb2185",
      "name": "Otras Versiones"
    }
  ],
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-AIR1",
  "name": "Airbag conductor",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-AIR1-N",
      "name": "No"
    },
    {
      "id": "MLA1744-AIR1-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-AIRBAGCORT",
  "name": "Airbag de cortina",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-AIRBAGCORT-N",
      "name": "No"
    },
    {
      "id": "MLA1744-AIRBAGCORT-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-AIR3",
  "name": "Airbag laterales",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-AIR3-N",
      "name": "No"
    },
    {
      "id": "MLA1744-AIR3-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-AIR2",
  "name": "Airbag pasajero",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-AIR2-N",
      "name": "No"
    },
    {
      "id": "MLA1744-AIR2-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-AIRACON",
  "name": "Aire acondicionado",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-AIRACON-N",
      "name": "No"
    },
    {
      "id": "MLA1744-AIRACON-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-ALAR",
  "name": "Alarma",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ALAR-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ALAR-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-ALARMLUC",
  "name": "Alarma de luces encendidas",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ALARMLUC-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ALARMLUC-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-AM_FM",
  "name": "AM/FM",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-AM/FM-N",
      "name": "No"
    },
    {
      "id": "MLA1744-AM/FM-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-APERBAUL",
  "name": "Apertura remota de baúl",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-APERBAUL-N",
      "name": "No"
    },
    {
      "id": "MLA1744-APERBAUL-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-APCABEZA",
  "name": "Apoya cabeza en asientos traseros",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-APCABEZA-N",
      "name": "No"
    },
    {
      "id": "MLA1744-APCABEZA-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-ASREGULA",
  "name": "Asiento conductor regulable en altura",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ASREGULA-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ASREGULA-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-ASREBAT",
  "name": "Asiento trasero rebatible",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ASREBAT-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ASREBAT-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-ASIENELEC",
  "name": "Asientos eléctricos",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ASIENELEC-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ASIENELEC-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-BLIND",
  "name": "Blindado",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-BLIND-N",
      "name": "No"
    },
    {
      "id": "MLA1744-BLIND-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-BLUETOOTH",
  "name": "Bluetooth",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-BLUETOOTH-N",
      "name": "No"
    },
    {
      "id": "MLA1744-BLUETOOTH-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-CARGADORCD",
  "name": "Cargador de CD",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-CARGADORCD-N",
      "name": "No"
    },
    {
      "id": "MLA1744-CARGADORCD-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-REPRODCD",
  "name": "CD",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-REPRODCD-N",
      "name": "No"
    },
    {
      "id": "MLA1744-REPRODCD-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-BLQCNTDOOR",
  "name": "Cierre centralizado de puertas",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-BLQCNTDOOR-N",
      "name": "No"
    },
    {
      "id": "MLA1744-BLQCNTDOOR-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-CLIMAUT",
  "name": "Climatizador automático",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-CLIMAUT-N",
      "name": "No"
    },
    {
      "id": "MLA1744-CLIMAUT-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-COLOREXT",
  "name": "Color",
  "value_type": "list",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-COLOREXT-AMARILLO",
      "name": "Amarillo"
    },
    {
      "id": "MLA1744-COLOREXT-AZUL",
      "name": "Azul"
    },
    {
      "id": "MLA1744-COLOREXT-BEIGE",
      "name": "Beige"
    },
    {
      "id": "MLA1744-COLOREXT-BLANCO",
      "name": "Blanco"
    },
    {
      "id": "MLA1744-COLOREXT-BORDO",
      "name": "Bordó"
    },
    {
      "id": "MLA1744-COLOREXT-CELESTE",
      "name": "Celeste"
    },
    {
      "id": "MLA1744-COLOREXT-CHAMPAGNE",
      "name": "Champagne"
    },
    {
      "id": "MLA1744-COLOREXT-GRIS",
      "name": "Gris"
    },
    {
      "id": "MLA1744-COLOREXT-MARRON",
      "name": "Marrón"
    },
    {
      "id": "MLA1744-COLOREXT-NEGRO",
      "name": "Negro"
    },
    {
      "id": "MLA1744-COLOREXT-ORO",
      "name": "Oro"
    },
    {
      "id": "MLA1744-COLOREXT-PLATA",
      "name": "Plata"
    },
    {
      "id": "MLA1744-COLOREXT-ROJO",
      "name": "Rojo"
    },
    {
      "id": "MLA1744-COLOREXT-ROSADO",
      "name": "Rosado"
    },
    {
      "id": "MLA1744-COLOREXT-VERDE",
      "name": "Verde"
    },
    {
      "id": "MLA1744-COLOREXT-OTRO",
      "name": "Otro"
    }
  ],
  "attribute_group_id": "ADICIONALES",
  "attribute_group_name": "Adicionales"
},
{
  "id": "MLA1744-COMANDOSAT",
  "name": "Comando satelital de stereo",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-COMANDOSAT-N",
      "name": "No"
    },
    {
      "id": "MLA1744-COMANDOSAT-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-COMPABO",
  "name": "Computadora de abordo",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-COMPABO-N",
      "name": "No"
    },
    {
      "id": "MLA1744-COMPABO-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-CONTR",
  "name": "Control de estabilidad",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-CONTR-N",
      "name": "No"
    },
    {
      "id": "MLA1744-CONTR-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-CNTTRACC",
  "name": "Control de tracción",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-CNTTRACC-N",
      "name": "No"
    },
    {
      "id": "MLA1744-CNTTRACC-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-CTRLVEL",
  "name": "Control de velocidad de crucero",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-CTRLVEL-N",
      "name": "No"
    },
    {
      "id": "MLA1744-CTRLVEL-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-VIDELEC",
  "name": "Cristales eléctricos",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-VIDELEC-N",
      "name": "No"
    },
    {
      "id": "MLA1744-VIDELEC-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-DIREC",
  "name": "Dirección",
  "value_type": "list",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-DIREC-ASISTIDA",
      "name": "Asistida"
    },
    {
      "id": "MLA1744-DIREC-HIDRAULICA",
      "name": "Hidráulica"
    },
    {
      "id": "MLA1744-DIREC-MECANICA",
      "name": "Mecánica"
    }
  ],
  "attribute_group_id": "ADICIONALES",
  "attribute_group_name": "Adicionales"
},
{
  "id": "MLA1744-DOBTRACC",
  "name": "Doble tracción",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-DOBTRACC-N",
      "name": "No"
    },
    {
      "id": "MLA1744-DOBTRACC-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-DVD",
  "name": "DVD",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-DVD-N",
      "name": "No"
    },
    {
      "id": "MLA1744-DVD-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-ENTAUXILIA",
  "name": "Entrada auxiliar",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ENTAUXILIA-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ENTAUXILIA-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-USB",
  "name": "Entrada USB",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-USB-N",
      "name": "No"
    },
    {
      "id": "MLA1744-USB-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-ESPELEC",
  "name": "Espejos eléctricos",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ESPELEC-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ESPELEC-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-FARANTI",
  "name": "Faros antinieblas delanteros",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-FARANTI-N",
      "name": "No"
    },
    {
      "id": "MLA1744-FARANTI-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-NEBLTRAS",
  "name": "Faros antinieblas traseros",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-NEBLTRAS-N",
      "name": "No"
    },
    {
      "id": "MLA1744-NEBLTRAS-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-FAROXEN",
  "name": "Faros de xenón",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-FAROXEN-N",
      "name": "No"
    },
    {
      "id": "MLA1744-FAROXEN-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-FAROREG",
  "name": "Faros regulables desde el interior",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-FAROREG-N",
      "name": "No"
    },
    {
      "id": "MLA1744-FAROREG-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-ABS",
  "name": "Frenos ABS",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ABS-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ABS-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-GPS",
  "name": "GPS",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-GPS-N",
      "name": "No"
    },
    {
      "id": "MLA1744-GPS-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1743-HORPREF",
  "name": "Horario de contacto",
  "value_type": "string",
  "value_max_length": 60,
  "tags": {
  },
  "attribute_group_id": "ADICIONALES",
  "attribute_group_name": "Adicionales"
},
{
  "id": "MLA1744-INMOVMOT",
  "name": "Inmovilizador de motor",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-INMOVMOT-N",
      "name": "No"
    },
    {
      "id": "MLA1744-INMOVMOT-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-ISOFIX",
  "name": "Isofix",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ISOFIX-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ISOFIX-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-LIMPIA_LAV",
  "name": "Limpia/lava luneta",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-LIMPIA/LAV-N",
      "name": "No"
    },
    {
      "id": "MLA1744-LIMPIA/LAV-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "EXTERIOR",
  "attribute_group_name": "Exterior"
},
{
  "id": "MLA1744-LLANALEAC",
  "name": "Llantas de aleación",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-LLANALEAC-N",
      "name": "No"
    },
    {
      "id": "MLA1744-LLANALEAC-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "EXTERIOR",
  "attribute_group_name": "Exterior"
},
{
  "id": "MLA1744-MP3",
  "name": "MP3",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-MP3-N",
      "name": "No"
    },
    {
      "id": "MLA1744-MP3-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-PARAGOLPES",
  "name": "Paragolpes pintados",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-PARAGOLPES-N",
      "name": "No"
    },
    {
      "id": "MLA1744-PARAGOLPES-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "EXTERIOR",
  "attribute_group_name": "Exterior"
},
{
  "id": "MLA1744-CASET",
  "name": "Pasacassette",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-CASET-N",
      "name": "No"
    },
    {
      "id": "MLA1744-CASET-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-REPFUERZA",
  "name": "Repartidor electrónico de fuerza de frenado",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-REPFUERZA-N",
      "name": "No"
    },
    {
      "id": "MLA1744-REPFUERZA-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-ESTACIONAM",
  "name": "Sensor de estacionamiento",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-ESTACIONAM-N",
      "name": "No"
    },
    {
      "id": "MLA1744-ESTACIONAM-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-SENSLL",
  "name": "Sensor de lluvia",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-SENSLL-N",
      "name": "No"
    },
    {
      "id": "MLA1744-SENSLL-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-SENSLUZ",
  "name": "Sensor de luz",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-SENSLUZ-N",
      "name": "No"
    },
    {
      "id": "MLA1744-SENSLUZ-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-TAPCUERO",
  "name": "Tapizado de cuero",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-TAPCUERO-N",
      "name": "No"
    },
    {
      "id": "MLA1744-TAPCUERO-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-TARJETASD",
  "name": "Tarjeta SD",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-TARJETASD-N",
      "name": "No"
    },
    {
      "id": "MLA1744-TARJETASD-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SONIDO",
  "attribute_group_name": "Sonido"
},
{
  "id": "MLA1744-TECHOCORR",
  "name": "Techo corredizo",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-TECHOCORR-N",
      "name": "No"
    },
    {
      "id": "MLA1744-TECHOCORR-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "CONFORT",
  "attribute_group_name": "Confort"
},
{
  "id": "MLA1744-3LUZSTOP",
  "name": "Tercer stop",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-3LUZSTOP-N",
      "name": "No"
    },
    {
      "id": "MLA1744-3LUZSTOP-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "SECURITY",
  "attribute_group_name": "Seguridad"
},
{
  "id": "MLA1744-TRANS",
  "name": "Transmisión",
  "value_type": "list",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-TRANS-AUTOMATICA",
      "name": "Automática"
    },
    {
      "id": "MLA1744-TRANS-MANUAL",
      "name": "Manual"
    },
    {
      "id": "MLA1744-TRANS-SECUENCIAL",
      "name": "Secuencial"
    }
  ],
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "MLA1744-VIDPOLARIZ",
  "name": "Vidrios polarizados",
  "value_type": "boolean",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-VIDPOLARIZ-N",
      "name": "No"
    },
    {
      "id": "MLA1744-VIDPOLARIZ-Y",
      "name": "Sí"
    }
  ],
  "attribute_group_id": "EXTERIOR",
  "attribute_group_name": "Exterior"
},
{
  "id": "MLA1744-OWNER",
  "name": "Único dueño",
  "value_type": "list",
  "tags": {
  },
  "values": [
    {
      "id": "MLA1744-OWNER-SI",
      "name": "Sí"
    },
    {
      "id": "MLA1744-OWNER-NO",
      "name": "No"
    }
  ],
  "attribute_group_id": "ADICIONALES",
  "attribute_group_name": "Adicionales"
}
```

Con solo leer el JSON anterior sabes que, por ejemplo, se trata de una categoría de clasificados que no permite incluir opciones de envío, existen 1332 publicaciones publicados en la misma y puedes incluir el precio en ARS o USD.

## Nombre

Este atributo muestra un nombre corto. No se puede utilizar este nombre para buscar productos. Si desea buscar mediante el ID de la categoría, puede utilizar la siguiente solicitud:

```
curl -X GET 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/search?category=MLA5726
```

## Ruta de la raíz

Cuando te posicionas en una categoría, puedes saber cuál es la ruta desde la raíz hasta la categoría seleccionada. Mira como utiliza MercadoLibre sus categorías:

## Elige la mejor categoría para tu producto

La categoría hoja es la última categoría del árbol y la única en la que se pueden publicar productos. La elección de la categoría adecuada para su producto determinará la rapidez con la que lo encontrarán los compradores, lo que mejorará sus posibilidades de venta. Por eso recomendamos utilizar [nuestra herramienta de predicción de categorías](https://developers.mercadolibre.com.ar/es_ar/api-prediccion-categorias) antes de publicar un producto. Tal vez algunas de las categorías no tengan buenas sugerencias, por lo que debe hacer que el usuario del sistema realice un mapeo de las categorías manualmente para encontrar sus productos. Un proceso más sencillo podría ser utilizar la API de categorías y navegar por el árbol de categorías para detectar cuál es la mejor opción. Sólo debe utilizar las categorías recuperadas de la API que no tengan subcategorías relacionadas. Otra opción podría ser encontrar productos similares en Mercado Livre para utilizar su categoría.

**Siguiente:**  [Administra áreas de cobertura.](https://developers.mercadolibre.com.ar/es_ar/administra-areas-de-cobertura)
