<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/categorias-y-atributos -->
<!-- Sección: Guía para vehículos -->

# Categorías y Atributos

Última actualización 02/04/2025

## Categorías y Atributos

Las categorías son conjuntos jerárquicos en los cuales agrupamos los productos de naturaleza similar. Las categorías ayudan a los usuarios a buscar de manera sencilla el producto que deseado y cada sitio (Brasil, Argentina, México, etc.) tienen su propio conjunto de categorías. Te recomendamos que uses el predictor de categorías que te permite identificar la mejor categoría de acuerdo con el título de tu producto. De lo contrario, para hacer una publicación de un vehículo, deberás utilizar el recurso /categories y elegir en cuál publicar. Atributos representan características del ítem, por ejemplo, Marca y Modelo, obligatorios para publicar. Recuerda que los atributos cambian por categoría.

Mira nuestro webinar sobre Predictor de categorías:

## Categorías

El recurso /sites puede ofrecerte la estructura de categorías para un país en particular, en este caso Argentina.

Llamada:

```
curl -X GET https://api.mercadolibre.com/sites/MLA/categories
```

Respuesta:

```
[

    {

        "id": "MLA5725",

        "name": "Accesorios para Vehículos"

    },

    {

        "id": "MLA1512",

        "name": "Agro"

    },

    {

        "id": "MLA1403",

        "name": "Alimentos y Bebidas"

    },

    {

        "id": "MLA1071",

        "name": "Animales y Mascotas"

    },

    {

        "id": "MLA1367",

        "name": "Antigüedades y Colecciones"

    },

    {

        "id": "MLA1368",

        "name": "Arte, Librería y Mercería"

    },

    {

        "id": "MLA1743",

        "name": "Autos, Motos y Otros"

    },

    {

        "id": "MLA1384",

        "name": "Bebés"

    },

    {

        "id": "MLA1246",

        "name": "Belleza y Cuidado Personal"

    },

    {

        "id": "MLA1039",

        "name": "Cámaras y Accesorios"

    },

    {

        "id": "MLA1051",

        "name": "Celulares y Teléfonos"

    },

    {

        "id": "MLA1648",

        "name": "Computación"

    },

    {

        "id": "MLA1144",

        "name": "Consolas y Videojuegos"

    },

    {

        "id": "MLA1276",

        "name": "Deportes y Fitness"

    },

    {

        "id": "MLA5726",

        "name": "Electrodomésticos y Aires Ac."

    },

    {

        "id": "MLA1000",

        "name": "Electrónica, Audio y Video"

    },

    {

        "id": "MLA2547",

        "name": "Entradas para Eventos"

    },

    {

        "id": "MLA407134",

        "name": "Herramientas y Construcción"

    },

    {

        "id": "MLA1574",

        "name": "Hogar, Muebles y Jardín"

    },

    {

        "id": "MLA1499",

        "name": "Industrias y Oficinas"

    },

    {

        "id": "MLA1459",

        "name": "Inmuebles"

    },

    {

        "id": "MLA1182",

        "name": "Instrumentos Musicales"

    },

    {

        "id": "MLA3937",

        "name": "Joyas y Relojes"

    },

    {

        "id": "MLA1132",

        "name": "Juegos y Juguetes"

    },

    {

        "id": "MLA3025",

        "name": "Libros, Revistas y Comics"

    },

    {

        "id": "MLA1168",

        "name": "Música, Películas y Series"

    },

    {

        "id": "MLA1430",

        "name": "Ropa y Accesorios"

    },

    {

        "id": "MLA409431",

        "name": "Salud y Equipamiento Médico"

    },

    {

        "id": "MLA1540",

        "name": "Servicios"

    },

    {

        "id": "MLA9304",

        "name": "Souvenirs, Cotillón y Fiestas"

    },

    {

        "id": "MLA1953",

        "name": "Otras categorías"

    }

]
```

Para categorías de segundo nivel o información relacionada con categorías específicas, debes utilizar el recurso /categories y enviar el ID de categoría como parámetro. Veamos qué encontramos en la categoría MLA1743 “Auto, Motos y Otros”.

Llamada:

```
curl -X GET https://api.mercadolibre.com/categories/MLA1743
```

Respuesta:

```
{

    "id": "MLA1743",

    "name": "Autos, Motos y Otros",

    "picture": "http://resources.mlstatic.com/category/images/e1a43666-ad57-4b8b-b405-f9d04dbbd8fc.png",

    "permalink": "http://www.mercadolibre.com.ar/vehiculos/",

    "total_items_in_this_category": 176713,

    "path_from_root": [

        {

            "id": "MLA1743",

            "name": "Autos, Motos y Otros"

        }

    ],

    "children_categories": [

        {

            "id": "MLA93412",

            "name": "Autos Chocados y Averiados",

            "total_items_in_this_category": 1406

        },

        {

            "id": "MLA1745",

            "name": "Autos de Colección",

            "total_items_in_this_category": 2670

        },

        {

            "id": "MLA1744",

            "name": "Autos y Camionetas",

            "total_items_in_this_category": 104271

        },

        {

            "id": "MLA58254",

            "name": "Camiones",

            "total_items_in_this_category": 3242

        },

        {

            "id": "MLA51547",

            "name": "Colectivos",

            "total_items_in_this_category": 555

        },

        {

            "id": "MLA7312",

            "name": "Maquinaria Agrícola",

            "total_items_in_this_category": 3644

        },

        {

            "id": "MLA405183",

            "name": "Maquinaria Vial",

            "total_items_in_this_category": 2293

        },

        {

            "id": "MLA80579",

            "name": "Motorhomes",

            "total_items_in_this_category": 984

        },

        {

            "id": "MLA1763",

            "name": "Motos",

            "total_items_in_this_category": 38878

        },

        {

            "id": "MLA1785",

            "name": "Náutica",

            "total_items_in_this_category": 7730

        },

        {

            "id": "MLA1784",

            "name": "Planes de Ahorro",

            "total_items_in_this_category": 1708

        },

        {

            "id": "MLA93430",

            "name": "Semirremolques",

            "total_items_in_this_category": 1147

        },

        {

            "id": "MLA1907",

            "name": "Otros Vehículos",

            "total_items_in_this_category": 8081

        }

    ],

    "attribute_types": "none",

    "settings": {

        "adult_content": false,

        "buying_allowed": false,

        "buying_modes": [

            "classified"

        ],

        "catalog_domain": null,

        "coverage_areas": "not_allowed",

        "currencies": [

            "USD",

            "ARS"

        ],

        "fragile": false,

        "immediate_payment": "optional",

        "item_conditions": [

            "used",

            "not_specified",

            "new"

        ],

        "items_reviews_allowed": false,

        "listing_allowed": false,

        "max_description_length": 50000,

        "max_pictures_per_item": 15,

        "max_pictures_per_item_var": 6,

        "max_sub_title_length": 70,

        "max_title_length": 60,

        "maximum_price": null,

        "minimum_price": null,

        "mirror_category": null,

        "mirror_master_category": null,

        "mirror_slave_categories": [],

        "price": "required",

        "reservation_allowed": "mandatory",

        "restrictions": [],

        "rounded_address": false,

        "seller_contact": "optional",

        "shipping_modes": [

            "not_specified",

            "custom"

        ],

        "shipping_options": [],

        "shipping_profile": "not_allowed",

        "show_contact_information": true,

        "simple_shipping": "not_allowed",

        "stock": "required",

        "sub_vertical": null,

        "subscribable": false,

        "tags": [],

        "vertical": "motors",

        "vip_subdomain": "vehiculo",

        "buyer_protection_programs": [

            "delivered",

            "undelivered"

        ],

        "status": "enabled"

    },

    "meta_categ_id": null,

    "attributable": false,

    "date_created": "2018-04-25T08:12:56.000Z"

}
```

Realiza una llamada a una categoría en particular, encontrarás todos los atributos disponibles y puedes saber si son obligatorios u opcionales para publicar en la categoría. Por ejemplo, para explorar el árbol de categorías debes utilizar “path_from_root” para conocer los niveles anteriores y "children_categories" para los niveles abajo. Realizaremos otra llamada, ahora en la categoría MLA1744, que es la categoría de los automóviles.

Llamada:

```
curl -X GET https://api.mercadolibre.com/categories/MLA1744
```

Respuesta:

```
{

    "id": "MLA1744",

    "name": "Autos y Camionetas",

    "picture": "http://resources.mlstatic.com/category/images/470e5a62-5d07-432a-8f00-6a67b2ffada8.png",

    "permalink": null,

    "total_items_in_this_category": 104271,

    "path_from_root": [

        {

            "id": "MLA1743",

            "name": "Autos, Motos y Otros"

        },

        {

            "id": "MLA1744",

            "name": "Autos y Camionetas"

        }

    ],

    "children_categories": [

        {

            "id": "MLA6039",

            "name": "Alfa Romeo",

            "total_items_in_this_category": 199

        },

        {

            "id": "MLA411489",

            "name": "Aro",

            "total_items_in_this_category": 11

        },

        {

            "id": "MLA10356",

            "name": "Asia",

            "total_items_in_this_category": 8

        },

        {

            "id": "MLA420506",

            "name": "Aston Martin",

            "total_items_in_this_category": 0

        },

        {

            "id": "MLA5782",

            "name": "Audi",

            "total_items_in_this_category": 3375

        },

        {

            "id": "MLA410981",

            "name": "BAIC",

            "total_items_in_this_category": 108

        },

        {

            "id": "MLA5783",

            "name": "BMW",

            "total_items_in_this_category": 2184

        },

        {

            "id": "MLA422397",

            "name": "Changan",

            "total_items_in_this_category": 58

        },

        {

            "id": "MLA42429",

            "name": "Chery",

            "total_items_in_this_category": 698

        },

        {

            "id": "MLA3185",

            "name": "Chevrolet",

            "total_items_in_this_category": 12132

        },

        {

            "id": "MLA4357",

            "name": "Chrysler",

            "total_items_in_this_category": 186

        },

        {

            "id": "MLA5779",

            "name": "Citroën",

            "total_items_in_this_category": 3786

        },

        {

            "id": "MLA411740",

            "name": "Dacia",

            "total_items_in_this_category": 4

        },

        {

            "id": "MLA5680",

            "name": "Daewoo",

            "total_items_in_this_category": 21

        },

        {

            "id": "MLA6619",

            "name": "Daihatsu",

            "total_items_in_this_category": 33

        },

        {

            "id": "MLA412008",

            "name": "DFSK",

            "total_items_in_this_category": 97

        },

        {

            "id": "MLA6671",

            "name": "Dodge",

            "total_items_in_this_category": 510

        },

        {

            "id": "MLA411856",

            "name": "DS",

            "total_items_in_this_category": 123

        },

        {

            "id": "MLA97714",

            "name": "Ferrari",

            "total_items_in_this_category": 23

        },

        {

            "id": "MLA3174",

            "name": "Fiat",

            "total_items_in_this_category": 11657

        },

        {

            "id": "MLA3180",

            "name": "Ford",

            "total_items_in_this_category": 9319

        },

        {

            "id": "MLA410982",

            "name": "Foton",

            "total_items_in_this_category": 67

        },

        {

            "id": "MLA406048",

            "name": "Geely",

            "total_items_in_this_category": 104

        },

        {

            "id": "MLA413791",

            "name": "Great Wall",

            "total_items_in_this_category": 43

        },

        {

            "id": "MLA413792",

            "name": "Haval",

            "total_items_in_this_category": 116

        },

        {

            "id": "MLA5791",

            "name": "Honda",

            "total_items_in_this_category": 1555

        },

        {

            "id": "MLA8509",

            "name": "Hummer",

            "total_items_in_this_category": 8

        },

        {

            "id": "MLA5683",

            "name": "Hyundai",

            "total_items_in_this_category": 788

        },

        {

            "id": "MLA6599",

            "name": "Isuzu",

            "total_items_in_this_category": 50

        },

        {

            "id": "MLA412827",

            "name": "Iveco",

            "total_items_in_this_category": 33

        },

        {

            "id": "MLA417839",

            "name": "JAC",

            "total_items_in_this_category": 61

        },

        {

            "id": "MLA83415",

            "name": "Jaguar",

            "total_items_in_this_category": 42

        },

        {

            "id": "MLA6600",

            "name": "Jeep",

            "total_items_in_this_category": 3015

        },

        {

            "id": "MLA7079",

            "name": "Kia",

            "total_items_in_this_category": 909

        },

        {

            "id": "MLA7219",

            "name": "Lada",

            "total_items_in_this_category": 8

        },

        {

            "id": "MLA8125",

            "name": "Land Rover",

            "total_items_in_this_category": 175

        },

        {

            "id": "MLA412093",

            "name": "Lexus",

            "total_items_in_this_category": 7

        },

        {

            "id": "MLA389337",

            "name": "Lifan",

            "total_items_in_this_category": 248

        },

        {

            "id": "MLA407429",

            "name": "Maserati",

            "total_items_in_this_category": 25

        },

        {

            "id": "MLA5681",

            "name": "Mazda",

            "total_items_in_this_category": 39

        },

        {

            "id": "MLA6038",

            "name": "Mercedes Benz",

            "total_items_in_this_category": 2717

        },

        {

            "id": "MLA8480",

            "name": "Mini",

            "total_items_in_this_category": 377

        },

        {

            "id": "MLA5743",

            "name": "Mitsubishi",

            "total_items_in_this_category": 366

        },

        {

            "id": "MLA6173",

            "name": "Nissan",

            "total_items_in_this_category": 1525

        },

        {

            "id": "MLA4100",

            "name": "Peugeot",

            "total_items_in_this_category": 8293

        },

        {

            "id": "MLA8503",

            "name": "Porsche",

            "total_items_in_this_category": 179

        },

        {

            "id": "MLA411743",

            "name": "Proton",

            "total_items_in_this_category": 0

        },

        {

            "id": "MLA99993",

            "name": "Ram",

            "total_items_in_this_category": 461

        },

        {

            "id": "MLA3205",

            "name": "Renault",

            "total_items_in_this_category": 11829

        },

        {

            "id": "MLA6041",

            "name": "Rover",

            "total_items_in_this_category": 48

        },

        {

            "id": "MLA411512",

            "name": "Saab",

            "total_items_in_this_category": 4

        },

        {

            "id": "MLA6109",

            "name": "Seat",

            "total_items_in_this_category": 58

        },

        {

            "id": "MLA440813",

            "name": "Sero Electric",

            "total_items_in_this_category": 6

        },

        {

            "id": "MLA413532",

            "name": "Shineray",

            "total_items_in_this_category": 94

        },

        {

            "id": "MLA106929",

            "name": "Smart",

            "total_items_in_this_category": 127

        },

        {

            "id": "MLA11927",

            "name": "Ssangyong",

            "total_items_in_this_category": 23

        },

        {

            "id": "MLA7078",

            "name": "Subaru",

            "total_items_in_this_category": 121

        },

        {

            "id": "MLA6583",

            "name": "Suzuki",

            "total_items_in_this_category": 329

        },

        {

            "id": "MLA11807",

            "name": "Tata",

            "total_items_in_this_category": 8

        },

        {

            "id": "MLA5753",

            "name": "Toyota",

            "total_items_in_this_category": 5099

        },

        {

            "id": "MLA3196",

            "name": "Volkswagen",

            "total_items_in_this_category": 19957

        },

        {

            "id": "MLA440812",

            "name": "Volt Motors",

            "total_items_in_this_category": 0

        },

        {

            "id": "MLA7080",

            "name": "Volvo",

            "total_items_in_this_category": 179

        },

        {

            "id": "MLA417354",

            "name": "Zanella",

            "total_items_in_this_category": 4

        },

        {

            "id": "MLA1939",

            "name": "Otras Marcas",

            "total_items_in_this_category": 313

        }

    ],

    "attribute_types": "attributes",

    "settings": {

        "adult_content": false,

        "buying_allowed": false,

        "buying_modes": [

            "classified"

        ],

        "catalog_domain": "MLA-CARS_AND_VANS",

        "coverage_areas": "not_allowed",

        "currencies": [

            "USD",

            "ARS"

        ],

        "fragile": false,

        "immediate_payment": "optional",

        "item_conditions": [

            "used",

            "not_specified",

            "new"

        ],

        "items_reviews_allowed": false,

        "listing_allowed": false,

        "max_description_length": 50000,

        "max_pictures_per_item": 15,

        "max_pictures_per_item_var": 6,

        "max_sub_title_length": 70,

        "max_title_length": 60,

        "maximum_price": null,

        "minimum_price": null,

        "mirror_category": null,

        "mirror_master_category": null,

        "mirror_slave_categories": [],

        "price": "required",

        "reservation_allowed": "mandatory",

        "restrictions": [],

        "rounded_address": false,

        "seller_contact": "optional",

        "shipping_modes": [

            "not_specified",

            "custom"

        ],

        "shipping_options": [],

        "shipping_profile": "not_allowed",

        "show_contact_information": true,

        "simple_shipping": "not_allowed",

        "stock": "required",

        "sub_vertical": "cars",

        "subscribable": false,

        "tags": [],

        "vertical": "motors",

        "vip_subdomain": "auto",

        "buyer_protection_programs": [

            "delivered",

            "undelivered"

        ],

        "status": "enabled"

    },

    "meta_categ_id": null,

    "attributable": true,

    "date_created": "2018-04-25T08:12:56.000Z"

}
```

## Predictor de categorías

Para identificar la mejor categoría para su publicación, realiza una llamada GET en el recurso /domain_discovery a partir del título provisto. En la respuesta, la primera es la de mayor probabilidad.

**Parámetros obligatorios**

**site_id:**  es el sitio en el que realizas la publicación.

**q:**  es el título del artículo a predecir y debe estar completamente en el idioma del sitio (español o portugués).

**Parámetros opcionales**

**limit:**  por defecto, el límite será de 4 con un máximo de 8, por lo que podrías definir un limit entre 1 a 8.

**target:**  puede estar compuesto por core (Producto) o classified (Clasificados) dependiendo la vertical en el que estés publicando.

Llamada:

```
curl -X GET https://api.mercadolibre.com/sites/$SITE_ID/domain_discovery/search?q=$Q
```

Ejemplo:

```
curl -X GET https://api.mercadolibre.com/sites/MLA/domain_discovery/search?limit=1&q=fiat%20uno
```

Respuesta

```
[
    {
        "domain_id": "MLA-CARS_AND_VANS",
        "domain_name": "Autos y camionetas",
        "category_id": "MLA24322",
        "category_name": "Uno",
        "attributes": []
    }
]
```

**Campos de respuesta**

**domain_id:**  es el ID del dominio que predices para el artículo.

**domain_name:**  es el nombre del dominio que predices.

**category_id:**  es el ID de la categoría que predices para el artículo.

**category_name:**  es el nombre de la categoría que predices.

**attributes:**  listado de atributos para la categoría que se predijo.

## Atributos específicos de las categorías

Para conocer los atributos específicos y valores posibles de las categorías para publicar un automóvil, consulta el recurso /attributes.

Llamada:

```
curl -X GET https://api.mercadolibre.com/categories/MLA1744/attributes
```

Respuesta acotada:

```
[
    {
        "id": "BRAND",
        "name": "Marca",
        "tags": {
            "catalog_required": true,
            "required": true
        },
        "hierarchy": "PARENT_PK",
        "relevance": 1,
        "value_type": "string",
        "value_max_length": 255,
        "values": [
        ...
           {
                "id": "389168",
                "name": "Chery"
            },
            {
                "id": "58955",
                "name": "Chevrolet"
            },
            {
                "id": "66395",
                "name": "Chrysler"
            },
            {
                "id": "389169",
                "name": "Citroën"
            },
        ...
        ],
        "attribute_group_id": "FIND",
        "attribute_group_name": "Ficha técnica"
    },
    {
        "id": "MODEL",
        "name": "Modelo",
        "tags": {
            "catalog_required": true,
            "required": true
        },
        "hierarchy": "PARENT_PK",
        "relevance": 1,
        "value_type": "string",
        "value_max_length": 255,
        "values": [
        ...
            {
                "id": "389394",
                "name": "Aircross"
            },
            {
                "id": "389395",
                "name": "Airtrek"
            },
            {
                "id": "71720",
                "name": "Albea"
            },
            {
                "id": "60597",
                "name": "Alhambra"
            },
            {
                "id": "64101",
                "name": "Alliance"
            },
        ...
        ],
        "attribute_group_id": "FIND",
        "attribute_group_name": "Ficha técnica"
    },
    {
        "id": "VEHICLE_YEAR",
        "name": "Año",
        "tags": {
            "required": true
        },
        "hierarchy": "PARENT_PK",
        "relevance": 1,
        "value_type": "number",
        "value_max_length": 18,
        "attribute_group_id": "FIND",
        "attribute_group_name": "Ficha técnica"
    },
    {
        "id": "TRIM",
        "name": "Versión",
        "tags": {
            "catalog_required": true,
            "required": true
        },
        "hierarchy": "PARENT_PK",
        "relevance": 1,
        "value_type": "string",
        "value_max_length": 255,
        "attribute_group_id": "FIND",
        "attribute_group_name": "Ficha técnica"
    },
   {
   ...
   }
]
```

Notas:

- En la respuesta están todos los atributos referentes a la categoría. Como el resultado es muy grande, el ejemplo está acotado.
 - Es importante sumar los atributos de la ficha técnica de una publicación y así cumplir con el objetivo de [Calidad de publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones#Acciones-necesarias-para-mejorar-la-calidad-de-un-item).

## Atributos obligatorios

Los atributos obligatorios se configuran como “required” en el detalle de la categoría. En el ejemplo anterior, puedes ver que precio y stock son obligatorios; no se permiten las áreas de cobertura y el seller_contact es opcional.

## Valores más utilizados (top values)

Importante:

Este recurso sólo está disponible para los países Argentina, Brasil, México y Uruguay para el dominio CARS_AND_VANS.

Con este recurso podrás conocer cuáles son los valores más usados para determinado atributo de un dominio. También podrás profundizar la búsqueda indicando otros valores de atributos para que se listen solo los valores que apliquen a ellos.

Los vendedores podrán utilizar los valores obtenidos para elegir dentro de ellos cuál es el correcto y mejorar la calidad de las publicaciones.

**Parámetros obligatorios**

**domain_id:**  es el ID del dominio al cual queremos hacer referencia.

**attribute_id:**  es el ID del atributo del cual necesitamos conocer los valores más usados.

**Parámetros opcionales**

**limit:**  es el límite de resultados que se solicita tiene un máximo de 1000.

**metric_type:**  es la métrica por la cual se ordenarán los resultados, en principio solo se admiten NOLs (nuevas publicaciones en los últimos 90 días). El único parámetro por el momento es NOL_90. Próximamente, sumaremos nuevos criterios. Ejemplo: metric_type=NOL_90.

Para identificar los atributos recomendados y conocidos, debes realizar un POST.

Llamada simple con un solo atributo:

```
curl -X POST https://api.mercadolibre.com/catalog_domains/$DOMAIN_ID/attributes/$ATTRIBUTE_ID/top_values
```

Ejemplo:

```
curl -X POST https://api.mercadolibre.com/catalog_domains/MLA-CARS_AND_VANS/attributes/BRAND/top_values
```

Respuesta:

```
[

    {

        "id": "60249",

        "name": "Volkswagen",

        "metric": 7987

    },

    {

        "id": "66432",

        "name": "Ford",

        "metric": 5619

    },

    {

        "id": "9909",

        "name": "Renault",

        "metric": 4659

    },

    {

        "id": "58955",

        "name": "Chevrolet",

        "metric": 4319

    },

    {

        "id": "60279",

        "name": "Peugeot",

        "metric": 4285

    },

    {

        "id": "67781",

        "name": "Fiat",

        "metric": 4172

    },

...

]
```

Ejemplo con más de un atributo:

Llamada:

```
curl -X POST https://api.mercadolibre.com/catalog_domains/$DOMAIN_ID/attributes/$ATTRIBUTE_ID/top_values

{

    "known_attributes": [

        {

            "id": "attributes.id",

            "value_id": "attributes.value_id"

        }

    ]

}
```

Ejemplo:

```
curl -X POST https://api.mercadolibre.com/catalog_domains/MLA-CARS_AND_VANS/attributes/MODEL/top_values

{

    "known_attributes": [

        {

            "id": "BRAND",

            "value_id": "60249"

        }

    ]

}
```

En este caso, el contenido de la respuesta serán los modelos más utilizados de la marca 6249 Volkswagen.

Nota:

El listado de known_attributes representa el conjunto de atributos que se tendrán en cuenta para el cálculo de top values.

## Descarga de categorías

Recuerda que te recomendamos utilizar el predictor de categorías en tu desarrollo, pero si prefieres, puedes descargar el árbol de categorías para el sitio del país destinado al procesamiento offline. Este recurso te devuelve el árbol de categorías en formato JSON dentro de una respuesta codificada con gzip. Para obtener las categorías de Argentina, utiliza esta URL:

```
curl -X GET https://api.mercadolibre.com/sites/MLA/categories/all
```

Contiene 2 encabezados que pueden utilizarse para verificar cuándo se generó el último volcado.

**X-Content-Created [contenido X creado]:**  contiene la fecha de la última generación.

**X-Content-MD5:**  contiene la suma de comprobación MD5 de la última generación.

Llamada:

```
curl -X GET https://api.mercadolibre.com/sites/MLA/categories/all
```

Respuesta:

```
HTTP/2 200 

content-type: application/json

content-length: 0

date: Wed, 29 Apr 2020 20:40:14 GMT

x-amz-id-2: VTcFVSUdn06VM4dbsuP5vZyHQ5fycw3kHjUgzRxEzSJxSJfEuYpr9DlHZ6ab+2DPvJ/SD97R7OQ=

x-amz-replication-status: COMPLETED

x-amz-request-id: 8BA998DE0241013D

x-amz-version-id: nhcoZXYi83Rh5CjxRYMmFLRIPO_cz7yl

x-content-type-options: nosniff

x-request-id: 071f0a43-1b95-4b04-accd-77646bd6dc3e

x-frame-options: DENY

x-xss-protection: 1; mode=block

access-control-allow-origin: *

access-control-allow-headers: Content-Type

access-control-allow-methods: PUT, GET, POST, DELETE, OPTIONS

access-control-max-age: 86400

accept-ranges: bytes

last-modified: Wed, 29 Apr 2020 20:01:12 GMT

cache-control: max-age=300

content-encoding: gzip

x-content-created: 2020-04-29T20:01:12.000Z

x-content-md5: 7526ed93467ec227359522beac126d82

x-cache: Miss from cloudfront

via: 1.1 b7b2667a8f791fb60d70bb1835ef9b2b.cloudfront.net (CloudFront)

x-amz-cf-pop: GRU1-C1

x-amz-cf-id: bvgXHVEFMS1BSLQCqEJxXmUL6zMRQQnCHBCCJMg78WUfPLVYGubO8Q==
```

## Convertir de Domínio a Categoría

El rercuso `/Domain_id` ofrece la estructura de domínio de un país en particular, en este caso, Brasil.

Chamada:

```
curl -X GET https://api.mercadolibre.com/catalog_domains/DOMAIN_ID/categories
```

Ejemplo:

```
curl -X GET https://api.mercadolibre.com/catalog_domains/MLB-CARS_AND_VANS/categories
```

Respuesta:

```

   [{"id":"MLB1744","name":"Carros e Caminhonetes"}]
```

**Siguiente:**

[Localiza vehículos](https://developers.mercadolibre.com.ar/es_ar/localizacion-de-vehiculos)

.
