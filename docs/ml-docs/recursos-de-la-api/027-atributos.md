<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/atributos -->
<!-- Sección: Recursos de la API -->

# Atributos

Última actualización 08/06/2026

## Atributos

Un atributo sirve para representar una característica de tu ítem, como por ejemplo Marca y Modelo de Microondas. Estos pueden sumarse al momento de la publicación y posteriormente podrás modificarlos, eliminarlos o agregar nuevos. En la siguiente documentación, podrás conocer los tipos de atributos posibles, los obligatorios, cómo identificar penalizaciones, entre otras acciones.

## Consulta atributos

Ten en cuenta que los atributos varían por [categoría](https://developers.mercadolibre.com.ar/es_ar/categoriza-productos) y podrás consultarlos visitando la siguiente url.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/attributes
```

Ejemplo:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1234/attributes
[
 {
   "id": "HEADPHONE_FORMAT",
   "name": "Formato",
   "tags": {
     "fixed": true
   },
   "value_type": "list",
   "values": [
     {
       "id": "182349",
       "name": "In-Ear"
     }
   ],
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "BRAND",
   "name": "Marca",
   "tags": {
     "fixed": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "values": [
     {
       "id": "15438",
       "name": "Shure"
     }
   ],
   "attribute_group_id": "MAIN",
   "attribute_group_name": "Atributos Principales"
 },
 {
   "id": "COLOR",
   "name": "Color",
   "tags": {
     "allow_variations": true,
     "hidden": true
   },
   "type": "color",
   "value_type": "list",
   "values": [
     {
       "id": "52049",
       "name": "Negro",
       "metadata": {
         "rgb": "000000"
       }
     },
     {
       "id": "51993",
       "name": "Rojo",
       "metadata": {
         "rgb": "FF0000"
       }
     },
     {
       "id": "52035",
       "name": "Violeta",
       "metadata": {
         "rgb": "9F00FF"
       }
     },
     {
       "id": "52028",
       "name": "Azul",
       "metadata": {
         "rgb": "1717FF"
       }
     },
     {
       "id": "52005",
       "name": "Marrón",
       "metadata": {
         "rgb": "A0522D"
       }
     },
     {
       "id": "52051",
       "name": "Gris oscuro",
       "metadata": {
         "rgb": "666666"
       }
     },
     {
       "id": "52000",
       "name": "Naranja",
       "metadata": {
         "rgb": "FF8C00"
       }
     },
     {
       "id": "52014",
       "name": "Verde",
       "metadata": {
         "rgb": "0DA600"
       }
     },
     {
       "id": "51994",
       "name": "Rosa",
       "metadata": {
         "rgb": "FCB1BE"
       }
     },
     {
       "id": "283164",
       "name": "Dorado",
       "metadata": {
         "rgb": "FFD700"
       }
     },
     {
       "id": "52007",
       "name": "Amarillo",
       "metadata": {
         "rgb": "FFED00"
       }
     },
     {
       "id": "52053",
       "name": "Plateado",
       "metadata": {
         "rgb": "CBCFD0"
       }
     },
     {
       "id": "283165",
       "name": "Gris claro",
       "metadata": {
         "rgb": "E1E1E1"
       }
     },
     {
       "id": "52021",
       "name": "Celeste",
       "metadata": {
         "rgb": "83DDFF"
       }
     },
     {
       "id": "52055",
       "name": "Blanco",
       "metadata": {
         "rgb": "FFFFFF"
       }
     },
     {
       "id": "51998",
       "name": "Bordó",
       "metadata": {
         "rgb": "830500",
         "parent_id": "51993"
       }
     },
     {
       "id": "51996",
       "name": "Terracota",
       "metadata": {
         "rgb": "C63633",
         "parent_id": "51993"
       }
     },
     {
       "id": "283149",
       "name": "Coral",
       "metadata": {
         "rgb": "FA8072",
         "parent_id": "51993"
       }
     },
     {
       "id": "283148",
       "name": "Coral claro",
       "metadata": {
         "rgb": "F9AC95",
         "parent_id": "51993"
       }
     },
     {
       "id": "52047",
       "name": "Violeta oscuro",
       "metadata": {
         "rgb": "4E0087",
         "parent_id": "52035"
       }
     },
     {
       "id": "283162",
       "name": "Índigo",
       "metadata": {
         "rgb": "7A64C6",
         "parent_id": "52035"
       }
     },
     {
       "id": "52038",
       "name": "Lila",
       "metadata": {
         "rgb": "CC87FF",
         "parent_id": "52035"
       }
     },
     {
       "id": "52036",
       "name": "Lavanda",
       "metadata": {
         "rgb": "D9D2E9",
         "parent_id": "52035"
       }
     },
     {
       "id": "52033",
       "name": "Azul oscuro",
       "metadata": {
         "rgb": "013267",
         "parent_id": "52028"
       }
     },
     {
       "id": "283161",
       "name": "Azul marino",
       "metadata": {
         "rgb": "0F5299",
         "parent_id": "52028"
       }
     },
     {
       "id": "52031",
       "name": "Azul acero",
       "metadata": {
         "rgb": "6FA8DC",
         "parent_id": "52028"
       }
     },
     {
       "id": "52029",
       "name": "Azul claro",
       "metadata": {
         "rgb": "DCECFF",
         "parent_id": "52028"
       }
     },
     {
       "id": "283155",
       "name": "Marrón oscuro",
       "metadata": {
         "rgb": "5D3806",
         "parent_id": "52005"
       }
     },
     {
       "id": "283154",
       "name": "Marrón claro",
       "metadata": {
         "rgb": "AF8650",
         "parent_id": "52005"
       }
     },
     {
       "id": "283153",
       "name": "Suela",
       "metadata": {
         "rgb": "FAEBD7",
         "parent_id": "52005"
       }
     },
     {
       "id": "52001",
       "name": "Beige",
       "metadata": {
         "rgb": "F5F3DC",
         "parent_id": "52005"
       }
     },
     {
       "id": "283152",
       "name": "Chocolate",
       "metadata": {
         "rgb": "9B3F14",
         "parent_id": "52000"
       }
     },
     {
       "id": "283151",
       "name": "Naranja oscuro",
       "metadata": {
         "rgb": "D2691E",
         "parent_id": "52000"
       }
     },
     {
       "id": "283150",
       "name": "Naranja claro",
       "metadata": {
         "rgb": "FDAF20",
         "parent_id": "52000"
       }
     },
     {
       "id": "52003",
       "name": "Piel",
       "metadata": {
         "rgb": "FFE4C4",
         "parent_id": "52000"
       }
     },
     {
       "id": "52019",
       "name": "Verde oscuro",
       "metadata": {
         "rgb": "003D00",
         "parent_id": "52014"
       }
     },
     {
       "id": "283158",
       "name": "Verde musgo",
       "metadata": {
         "rgb": "3F7600",
         "parent_id": "52014"
       }
     },
     {
       "id": "283157",
       "name": "Verde limón",
       "metadata": {
         "rgb": "73E129",
         "parent_id": "52014"
       }
     },
     {
       "id": "52015",
       "name": "Verde claro",
       "metadata": {
         "rgb": "9FF39F",
         "parent_id": "52014"
       }
     },
     {
       "id": "52042",
       "name": "Fucsia",
       "metadata": {
         "rgb": "FF00EC",
         "parent_id": "51994"
       }
     },
     {
       "id": "283163",
       "name": "Rosa chicle",
       "metadata": {
         "rgb": "FF51A8",
         "parent_id": "51994"
       }
     },
     {
       "id": "52045",
       "name": "Rosa pálido",
       "metadata": {
         "rgb": "D06EA8",
         "parent_id": "51994"
       }
     },
     {
       "id": "52043",
       "name": "Rosa claro",
       "metadata": {
         "rgb": "FADBE2",
         "parent_id": "51994"
       }
     },
     {
       "id": "52012",
       "name": "Dorado oscuro",
       "metadata": {
         "rgb": "BF9000",
         "parent_id": "52007"
       }
     },
     {
       "id": "52010",
       "name": "Ocre",
       "metadata": {
         "rgb": "EACB53",
         "parent_id": "52007"
       }
     },
     {
       "id": "283156",
       "name": "Caqui",
       "metadata": {
         "rgb": "F0E68C",
         "parent_id": "52007"
       }
     },
     {
       "id": "52008",
       "name": "Crema",
       "metadata": {
         "rgb": "FFFFE0",
         "parent_id": "52007"
       }
     },
     {
       "id": "52024",
       "name": "Azul petróleo",
       "metadata": {
         "rgb": "1E6E7F",
         "parent_id": "52021"
       }
     },
     {
       "id": "283160",
       "name": "Turquesa",
       "metadata": {
         "rgb": "40E0D0",
         "parent_id": "52021"
       }
     },
     {
       "id": "52022",
       "name": "Agua",
       "metadata": {
         "rgb": "E0FFFF",
         "parent_id": "52021"
       }
     },
     {
       "id": "283159",
       "name": "Cyan",
       "metadata": {
         "rgb": "00FFFF",
         "parent_id": "52021"
       }
     }
   ],
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "WIRELESS_RANGE",
   "name": "Alcance Inalámbrico",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "km",
       "name": "km"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     }
   ],
   "default_unit": "cm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_HEIGHT",
   "name": "Altura del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "km",
       "name": "km"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_WIDTH",
   "name": "Ancho del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "km",
       "name": "km"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "BLUETOOTH",
   "name": "Bluetooth",
   "tags": {
     "hidden": true
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "BATTERY_LIFE",
   "name": "Duración de la Batería",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "h",
       "name": "h"
     },
     {
       "id": "años",
       "name": "años"
     },
     {
       "id": "d",
       "name": "d"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "meses",
       "name": "meses"
     },
     {
       "id": "ms",
       "name": "ms"
     },
     {
       "id": "s",
       "name": "s"
     }
   ],
   "default_unit": "h",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "EAN",
   "name": "EAN",
   "tags": {
     "multivalued": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "GTIN",
   "name": "GTIN",
   "tags": {
     "hidden": true,
     "multivalued": true,
     "variation_attribute": true
     "conditional_required": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "IMPEDANCE",
   "name": "Impedancia",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "ω",
       "name": "ω"
     }
   ],
   "default_unit": "ω",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "JAN",
   "name": "JAN",
   "tags": {
     "hidden": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "LINE",
   "name": "Línea",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "CABLE_LENGTH",
   "name": "Longitud del Cable",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "km",
       "name": "km"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     }
   ],
   "default_unit": "cm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_LENGTH",
   "name": "Longitud del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "km",
       "name": "km"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MICROPHONE_INCLUDED",
   "name": "Micrófono Incluido",
   "tags": {
     "hidden": true
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MODEL",
   "name": "Modelo",
   "tags": {
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "MAIN",
   "attribute_group_name": "Atributos Principales"
 },
 {
   "id": "ALPHANUMERIC_MODEL",
   "name": "Modelo Alfanumérico",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "DETAILED_MODEL",
   "name": "Modelo Detallado",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MPN",
   "name": "MPN",
   "tags": {
     "hidden": true,
     "multivalued": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_WEIGHT",
   "name": "Peso del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mcg",
       "name": "mcg"
     },
     {
       "id": "mg",
       "name": "mg"
     },
     {
       "id": "g",
       "name": "g"
     },
     {
       "id": "oz",
       "name": "oz"
     },
     {
       "id": "lb",
       "name": "lb"
     },
     {
       "id": "kg",
       "name": "kg"
     }
   ],
   "default_unit": "mcg",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "WIRELESS_CAPABILITY",
   "name": "Recepción Inalámbrica",
   "tags": {
     "hidden": true
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "FREQUENCY_RESPONSE",
   "name": "Respuesta en Frecuencia",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "SENSITIVITY",
   "name": "Sensibilidad",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "db",
       "name": "db"
     }
   ],
   "default_unit": "db",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MEMORY_SIZE",
   "name": "Tamaño Efectivo de Memoria",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "gb",
       "name": "gb"
     },
     {
       "id": "gib",
       "name": "gib"
     },
     {
       "id": "kb",
       "name": "kb"
     },
     {
       "id": "kib",
       "name": "kib"
     },
     {
       "id": "mb",
       "name": "mb"
     },
     {
       "id": "mib",
       "name": "mib"
     },
     {
       "id": "tb",
       "name": "tb"
     },
     {
       "id": "tib",
       "name": "tib"
     }
   ],
   "default_unit": "gb",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "HEADPHONES_TYPE",
   "name": "Tipo",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "TYPE_COUPLING",
   "name": "Tipo de Acoplamiento",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "suggested_values": [
     {
       "id": "114209",
       "name": "Supraaural"
     },
     {
       "id": "114210",
       "name": "Intraural"
     },
     {
       "id": "114208",
       "name": "Circumaural"
     }
   ],
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "DIAPHRAGM_UNIT",
   "name": "Unidad de Diafragma",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "km",
       "name": "km"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "UPC",
   "name": "UPC",
   "tags": {
     "multivalued": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
    "id": "VALUE_ADDED_TAX",
    "name": "Impuesto al valor agregado",
    "tags": {
        "conditional_required": true
    },
    "hierarchy": "ITEM",
    "relevance": 1,
    "value_type": "list",
    "values": [
        {
            "id": "48405907",
            "name": "0 %"
        },
        {
            "id": "48405908",
            "name": "10.5 %"
        },
        {
            "id": "48405909",
            "name": "21 %"
        },
        {
            "id": "48405910",
            "name": "27 %"
        }
    ],
    "default_unit": "%",
    "tooltip": "El impuesto al valor agregado se aplica sobre la compra de bienes o servicios y se suma al precio de venta.",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
},
{
    "id": "IMPORT_DUTY",
    "name": "Impuesto de importación",
    "tags": {
        "conditional_required": true
    },
    "hierarchy": "ITEM",
    "relevance": 1,
    "value_type": "list",
    "values": [
        {
            "id": "49553239",
            "name": "0 %"
        },
        {
            "id": "49553240",
            "name": "1 %"
        },
        {
            "id": "49553241",
            "name": "2.5 %"
        },
        {
            "id": "49553242",
            "name": "4 %"
        },
        {
            "id": "49553243",
            "name": "5 %"
        },
        {
            "id": "49553244",
            "name": "8 %"
        },
        {
            "id": "49553245",
            "name": "9.5 %"
        },
        {
            "id": "49553246",
            "name": "10 %"
        },
        {
            "id": "49553247",
            "name": "14 %"
        },
        {
            "id": "49553248",
            "name": "15 %"
        },
        {
            "id": "49553249",
            "name": "18 %"
        },
        {
            "id": "49553250",
            "name": "19 %"
        },
        {
            "id": "49553251",
            "name": "20 %"
        },
        {
            "id": "49553252",
            "name": "23 %"
        },
        {
            "id": "49553253",
            "name": "25 %"
        },
        {
            "id": "49553254",
            "name": "26 %"
        },
        {
            "id": "49553255",
            "name": "70 %"
        }
    ],
    "default_unit": "%",
    "tooltip": "El impuesto interno se aplica sobre artículos superfluos o de lujo como alcohol, cigarrillos, entre otros.",
    "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
}
]
```

## Tipos de atributos posibles

Existen varios tipos de atributos, dependiendo de ellos son los valores posibles que soportará. El tipo de un atributo se puede visualizar ingresando a la API de atributos de la categoría en cuestión y consultar el campo value_type. Los tipos posibles son:

**string**

Puedes completar atributos de este tipo con texto libre incluyendo letras y números indistintamente.
**Consideraciones:**  para este tipo de atributos te sugerimos una lista de valores conocidos, aunque también puedes ingresar nuevos que no estén en dicha lista. Para el caso de nuevos valores basta con enviarnos únicamente el name pero para valores conocidos lo puedes hacer enviando tanto el id como el name. ¡Te alentamos a ver los valores sugeridos en la API!

**number**

Estos atributos se completan únicamente con valores numéricos.
**Consideraciones:**  para este tipo de atributos te sugerimos una lista de valores conocidos, aunque también puedes ingresar nuevos que no estén en dicha lista. Para el caso de nuevos valores basta con enviarnos únicamente el name pero para valores conocidos lo puedes hacer enviando tanto el id como el name. ¡Te alentamos a ver los valores sugeridos en la API!

**number_unit**

Son atributos conformados por un valor numérico y una unidad. Desde la API de atributos puedes visualizar las unidades disponibles para dicho atributo.

**boolean**

Permite únicamente dos valores, uno corresponde a un valor positivo y otro negativo. 
**Consideraciones:**  es necesario enviar el id del valor, el cual puedes consultar en la API de atributos.

**list**

En la propiedad values se listan los valores posibles que puede tomar este atributo, siempre habrá por lo menos un valor.

## Comportamientos especiales

En la propiedad tags se especifican comportamientos particulares del atributo. A continuación se listan los posibles valores que pueden incluirse, junto con la descripción del comportamiento.

- **allow_variations:**  Permite que el ítem varíe por atributo. Por tal motivo, deberás revisar que el tag allow_variations se encuentre en "true" para poder subir las variaciones. Si deseas conocer más sobre cómo agregarlos te invitamos a leer la documentación de [Variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones).

- **defines_picture:**  indica que el atributo define la foto. Por ejemplo, Color en zapatos. Utilizando este tag se interpretará como se deben mostrar diferentes componentes en los flujos. Este comportamiento aplica solamente para los atributos que admiten variaciones.

- **fixed:**  indica que existe un valor fijo para la categoría y todos los ítems publicados bajo esta sección tendrán dicho valor. Por ejemplo, si estás vendiendo un Microondas en la categoría MLB232411 correspondiente a Microondas -> Otras Marcas -> 18 Litros, la misma posee el atributo VOLUMEN_CAPACITY con los valores 18 Litros, 20 Litros, etc, pero para dicha categoría ya sabemos que el valor adecuado para el atributo es 18 Litros, por tal motivo no es necesario que lo envíes en el momento de la publicación porque nosotros lo auto-completamos por tí.

- **hidden:**  los atributos con esta propiedad no se muestran en el flujo de ventas por el front, pero pueden ser cargados vía API.

- **used_hidden:**  Este tag sugiere que el atributo es oculto y se utiliza en contextos específicos relacionados con productos usados o reacondicionados.

- **new_hidden:**  Similarmente, este tag indica que el atributo es oculto y está relacionado con productos nuevos.

- **inferred:**  indica que existe un valor inferido para el atributo. Dicho valor no es modificable. Por ejemplo: en la categoría iPhone debajo de celulares, está fijo el atributo LINE con valor iPhone, y se infiere que la marca es Apple.

- **multivalued:**  los atributos pueden completarse con más de un valor, separándolos por comas.

- **others:**  este tag es de uso interno.

- **product_pk:**  este tag sirve para reconocer los atributos que forman parte de la pk de un producto. A partir de la misma, podemos identificar unívocamente un producto del catálogo.

- **read_only:**  este tag es de uso interno. Los atributos con este tag no pueden ser cargados ni modificados por vendedores.

- **restricted_values** : este tag es de uso interno.

- **variation_attribute** : sí al ítem se le especifican variaciones, este atributo puede ser publicado con un valor distinto para cada variación. Por ejemplo: cualquier publicación de electrónica que tenga variaciones por color, sus códigos identificadores de producto pueden cargarse para cada variación. En el caso que el ítem no tenga variaciones, igualmente se puede cargar un valor para este atributo.

- **required** : se requiere la completitud del atributo para la publicación del ítem tradicional.

- **new_required** : Se requiere la completitud del atributo, para la publicación del ítem, siempre que la condición del mismo sea nueva.

- **conditional_required** : previo a realizar la publicación se deberá revisar si el atributo es requerido para publicar o si se encuentra dentro de excepciones, realizando un POST al recurso de [recurso de /attributes/conditional](https://developers.mercadolibre.com.ar/es_ar/atributos?nocache=true#Atributos-obligatorios-por-condicion) toda la información del ítem.

- **catalog_listing_required** : requerido para enviar una publicación tradicional o hacer una publicacion directa al catálogo. Si este valor es igual a TRUE, será necesario agregar el atributo al hacer el optin/envío al catálogo.

## Atributos obligatorios

Importante:

Para estandarizar las condiciones de venta en los dominios de venta granel como pisos, revestimientos y otros, al publicar o modificar publicaciones debes enviar los atributos obligatorios **Unidad de venta**  (**SALES_UNIT** ) y **Rendimiento**  (**YIELD_OF_SALES_UNIT** ). [Consulta los dominios que serán impactados](https://www.mercadolibre.com.ar/ayuda/30901).

Notas:

Para sellers de **MLA**  con condición fiscal de **Responsables inscriptos** , deben incluir en su flujo de publicación dos nuevos atributos en formato porcentual: IVA (VALUE_ADDED_TAX) e Impuestos Internos (IMPORT_DUTY).

Consultando el recurso /categories/$CATEGORY_ID/technical_specs/input podrás saber cuáles son los atributos obligatorios por categoría y completarlos con anticipación para evitar que las publicaciones se vean afectadas en el posicionamiento de los listados. Podrás identificar los atributos que serán obligatorios con el tag "required".

Llamada:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/technical_specs/input
```

Ejemplo

```
curl -X GET   -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1002/technical_specs/input
```

Respuesta:

```
{
  "groups": [
    {
      "id": "MAIN",
      "label": "Características principales",
      "relevance": 1,
      "ui_config": {
      },
      "components": [
        {
          "component": "COMBO",
          "label": "Marca",
          "ui_config": {
            "allow_custom_value": true,
            "allow_filtering": true
          },
          "attributes": [
            {
              "id": "BRAND",
              "name": "Marca",
              "value_type": "string",
              "value_max_length": 255,
              "tags": [
                "catalog_required",
                "required"
              ],
              "values": [
                {
                  "id": "20262",
                  "name": "AOC"
                },
                {
                  "id": "27499",
                  "name": "Admiral"
                },
                {
                  "id": "3",
                  "name": "Philips"
                },
                {
                  "id": "9838",
                  "name": "Pioneer"
                },
                {
                  "id": "21980",
                  "name": "RCA"
                },
                {
                  "id": "206",
                  "name": "Samsung"
                },
             
              "hierarchy": "PARENT_PK",
              "relevance": 1
            }
          ],
          "unified_units": [
          ]
        },
        {
          "component": "TEXT_INPUT",
          "label": "GTIN-14",
          "ui_config": {
            "allow_custom_value": false,
            "allow_filtering": false
          },
          "attributes": [
            {
              "id": "GTIN14",
              "name": "GTIN-14",
              "value_type": "string",
              "value_max_length": 255,
              "tags": [
                "vip_hidden",
                "hidden",
                "multivalued",
                "used_hidden",
                "variation_attribute",
                "validate"
              ],
              "hierarchy": "PRODUCT_IDENTIFIER",
              "relevance": 2
            }
          ],
          "unified_units": [
          ]
        }
      ]
    }
  ]
}
```

Notas:

Los atributos marcados como requeridos en el recurso /categories/$CATEGORY_ID/attributes son obligatorios al momento de la publicación, en caso de no estar presentes se generará un error.
-Los atributos marcados como obligatorios en este nuevo recurso y que no estén presentes en /categories/$CATEGORY_ID/attributes, únicamente afectarán el posicionamiento en los listados. Ten en cuenta que para identificar los ítems que ya se encuentran perdiendo exposición, deberás consultar [el tag de incomplete_technical_specs](https://developers.mercadolibre.com.ar/es_ar/atributos#Tag-incomplete-technical-specs).

Con el recurso /categories/$CATEGORY_ID/technical_specs/output podrás mostrar tus productos tal y como se pueden ver en Mercado Libre, así tus publicaciones quedarán organizadas con la misma ficha técnica.

Llamada:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/technical_specs/output
```

Ejemplo:

```
curl -X GET   -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA1002/technical_specs/output
```

Respuesta:

```
{
  "main_title": "Características Principales",
  "groups": [
    {
      "id": "MAIN",
      "label": "Características principales",
      "relevance": 1,
      "ui_config": {
      },
      "components": [
        {
          "component": "TEXT_OUTPUT",
          "label": "Marca",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "BRAND",
              "name": "Marca",
              "value_type": "string"
            }
          ]
        },
                      {
          "component": "BOOLEAN_OUTPUT",
          "label": "Es",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "IS_PORTABLE",
              "name": "Portátil",
              "value_type": "boolean"
            }
          ]
        },
        {
          "component": "TEXT_OUTPUT",
          "label": "Origen",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "ORIGIN",
              "name": "Origen",
              "value_type": "string"
            }
          ]
        },
        {
          "component": "TEXT_OUTPUT",
          "label": "Resolución máxima",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "MAX_RESOLUTION",
              "name": "Resolución máxima",
              "value_type": "string"
            }
          ]
        },
        {
          "component": "NUMBER_UNIT_OUTPUT",
          "label": "Ángulo de visión horizontal",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "HORIZONTAL_VIEWING_ANGLE",
              "name": "Ángulo de visión horizontal",
              "value_type": "number_unit"
            }
          ]
        },
        {
          "component": "NUMBER_UNIT_OUTPUT",
          "label": "Ángulo de visión vertical",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "VERTICAL_VIEWING_ANGLE",
              "name": "Ángulo de visión vertical",
              "value_type": "number_unit"
            }
          ]
        },
        {
          "component": "TEXT_OUTPUT",
          "label": "Relación de aspecto",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "ASPECT_RATIO",
              "name": "Relación de aspecto",
              "value_type": "string"
            }
          ]
        },
        {
          "component": "TEXT_OUTPUT",
          "label": "Relación de contraste",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "CONTRAST_RATIO",
              "name": "Relación de contraste",
              "value_type": "string"
            }
          ]
        },
        {
          "component": "NUMBER_UNIT_OUTPUT",
          "label": "Brillo",
          "ui_config": {
          },
          "attributes": [
            {
              "id": "BRIGHTNESS",
              "name": "Brillo",
              "value_type": "number_unit"
            }
          ]
        },
         ]
        }
      ]
    }
  ]
}
```

### Atributos obligatorios por condición

Importante:

Este recurso está disponible sólo para Argentina, Brasil y México.

Consultando el recurso **/categories/$CATEGORY_ID/attributes/conditional**  puedes validar si los atributos que cuentan con el tag **“conditional_required”**  son requeridos para tu publicación. Para hacerlo deberás enviar toda la información del item que deseas publicar.

Llamada:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/attributes/conditional
```

Ejemplo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA403656/attributes/conditional
{
   "title": "Item de test Cerveza Patagonia - No Ofertar",
   "category_id": "MLA403656",
   "price": 900,
   "currency_id": "ARS",
   "available_quantity": 10,
   "buying_mode": "buy_it_now",
   "condition": "new",
   "listing_type_id": "gold_special",
   "description": {
       "plain_text": "Descripción con Texto Plano \n"
   },
   "video_id": "YOUTUBE_ID_HERE",
   "sale_terms": [
       {
           "id": "WARRANTY_TYPE",
           "value_name": "Garantía del vendedor"
       },
       {
           "id": "WARRANTY_TIME",
           "value_name": "90 días"
       }
   ],
   "pictures": [
       {
           "source": "http://mla-s2-p.mlstatic.com/968521-MLA20805195516_072016-O.jpg"
       }
   ],
   "attributes": [
       {
           "id": "BEER_STYLE",
           "name": "Estilo de cerveza",
           "value_id": "6443462",
           "value_name": "Pale Ale",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "BRAND",
           "name": "Marca",
           "value_id": "2809299",
           "value_name": "Patagonia",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "IS_CRAFT_BEER",
           "name": "Es cerveza artesanal",
           "value_id": "242084",
           "value_name": "No",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "ITEM_CONDITION",
           "name": "Condición del ítem",
           "value_id": "2230284",
           "value_name": "Nuevo",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "PACKAGING_TYPE",
           "name": "Tipo de envase",
           "value_id": "2290293",
           "value_name": "Botella",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "SALE_FORMAT",
           "name": "Formato de venta",
           "value_id": "1359391",
           "value_name": "Unidad",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "UNITS_PER_PACK",
           "name": "Unidades por pack",
           "value_id": null,
           "value_name": "1",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "UNIT_VOLUME",
           "name": "Volumen de la unidad",
           "value_id": "3681798",
           "value_name": "355 mL",
           "value_struct": {},
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       }
   ]
}
```

Respuesta con atributos obligatorios:

```
{ required_attributes: [ { id: "GTIN", "name": "Código universal de producto" } ] }
```

Nota:

Los atributos que se encuentren como requeridos en la respuesta, deberán ser enviados al publicar.

Ejemplo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA403656/attributes/conditional
{
   "title": "Item de test Cerveza Artesanal - No Ofertar",
   "category_id": "MLA403656",
   "price": 900,
   "currency_id": "ARS",
   "available_quantity": 10,
   "buying_mode": "buy_it_now",
   "condition": "new",
   "listing_type_id": "gold_special",
   "description": {
       "plain_text": "Descripción con Texto Plano \n"
   },
   "video_id": "YOUTUBE_ID_HERE",
   "sale_terms": [
       {
           "id": "WARRANTY_TYPE",
           "value_name": "Garantía del vendedor"
       },
       {
           "id": "WARRANTY_TIME",
           "value_name": "90 días"
       }
   ],
   "pictures": [
       {
           "source": "http://mla-s2-p.mlstatic.com/968521-MLA20805195516_072016-O.jpg"
       }
   ],
   "attributes": [
       {
           "id": "BEER_STYLE",
           "name": "Estilo de cerveza",
           "value_id": "5893263",
           "value_name": "Stout",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "BRAND",
           "name": "Marca",
           "value_id": null,
           "value_name": "artesanal",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "IS_CRAFT_BEER",
           "name": "Es cerveza artesanal",
           "value_id": "242085",
           "value_name": "Sí",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "IS_NON_ALCOHOLIC_BEER",
           "name": "Es cerveza sin alcohol",
           "value_id": "242084",
           "value_name": "No",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "ITEM_CONDITION",
           "name": "Condición del ítem",
           "value_id": "2230284",
           "value_name": "Nuevo",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "PACKAGING_TYPE",
           "name": "Tipo de envase",
           "value_id": "2130464",
           "value_name": "Botella retornable",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "SALE_FORMAT",
           "name": "Formato de venta",
           "value_id": "1359391",
           "value_name": "Unidad",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "UNITS_PER_PACK",
           "name": "Unidades por pack",
           "value_id": null,
           "value_name": "1",
           "value_struct": null,
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       },
       {
           "id": "UNIT_VOLUME",
           "name": "Volumen de la unidad",
           "value_id": "188135",
           "value_name": "1 L",
           "value_struct": {},
           "values": [],
           "attribute_group_id": "OTHERS",
           "attribute_group_name": "Otros"
       }
   ]
}
```

Respuesta sin atributos obligatorios:

```
{ required_attributes: [] }
```

Nota:

En este caso no es necesario enviar los atributos que cuentan con el tag “conditional_required” ya que el ítem a publicar se encuentra dentro de las excepciones.

## Atributos de Dimensiones de Paquete

Notas:

- Estos atributos son obligatorios para vendedores con ME2 en las modalidades cross docking y xd_drop_off, aunque actualmente no estén marcados con el tag required en las respuestas de la API por dominio. Si no se informan, la API devolverá un error. Esta obligatoriedad se irá extendiendo progresivamente a más categorías y modalidades.

- Quienes operen con **ME1**  deben seguir utilizando el campo actual: **shipping.dimensions** .

Para mejorar la precisión en el manejo y envío de productos, permitiendo prever el espacio necesario en el transporte y mejorar el servicio de envío, se han introducido los siguientes atributos de dimensiones de paquete para poder agregarlos a las publicaciones:

- **SELLER_PACKAGE_HEIGHT** : Altura del paquete de envío (valor en cm).

- **SELLER_PACKAGE_LENGTH** : Longitud del paquete de envío (valor en cm).

- **SELLER_PACKAGE_WIDTH** : Ancho del paquete de envío (valor en cm).

- **SELLER_PACKAGE_WEIGHT** : Peso del paquete de envío (valor en g).

**Recuerda:**  estos atributos deben cargarse en cada publicación. Solo se aceptan centímetros y gramos.

Notas:

-El vendedor declara las dimensiones del paquete según el concepto **ancho × alto × largo** , pero en el front-end las tres dimensiones se ordenan automáticamente de **mayor a menor** para una visualización estandarizada.

Esto no afecta el cálculo del costo de envío, ya que el volumen total del paquete permanece igual.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items
```

**Ejemplo:**

```
{
  "attributes": [
    {
      "id": "SELLER_PACKAGE_HEIGHT",
      "value_name": "6 cm"
    },
    {
      "id": "SELLER_PACKAGE_LENGTH",
      "value_name": "31 cm"
    },
    {
      "id": "SELLER_PACKAGE_WIDTH",
      "value_name": "25 cm"
    },
    {
      "id": "SELLER_PACKAGE_WEIGHT",
      "value_name": "214 g"
    },
   
  ]
}
```

### Errores

A continuación, te detallamos los errores más comunes que pueden presentarse al validar los atributos obligatorios de dimensiones del paquete, junto con su causa y solución.

**1. Falta al menos un atributo de dimensiones**

Este error se presenta cuando uno o más atributos requeridos están ausentes, aunque otros hayan sido informados correctamente.

**Solución:**  Verifica que este presente el atributos mencionado en el error. Todos son obligatorios.

seller_package_height, seller_package_length, seller_package_width, seller_package_weight

```

{
  "department": "pymes",
  "cause_id": 5400,
  "type": "error",
  "code": "item.attribute.missing.seller.package.dimensions",
  "references": ["item.attributes"],
  "message": "The attributes seller_package_height, seller_package_length, seller_package_width, seller_package_weight are all required"
}
```

**2. Formato inválido (por ejemplo, uso de decimales)**

Este error aparece cuando uno o más atributos se envían en un formato no admitido, como con valores decimales o unidades incorrectas.

**Solución:**  Utiliza únicamente valores enteros.

```

{
  "department": "pymes",
  "cause_id": 5402,
  "type": "error",
  "code": "item.attribute.invalid.format.seller.package.dimensions",
  "references": ["item.attributes"],
  "message": "One or more attributes for seller_package_height, seller_package_length, seller_package_width, seller_package_weight are in the wrong format - only integers are accepted for dimensions and weight, with 'cm' as the unit for dimensions and 'g' as the unit for weight. Examples: 10 g, 10 cm"
}
```

**3. Valores absurdos**

Este error ocurre cuando se ingresan dimensiones o pesos que no son realistas, están fuera de los rangos aceptados por el sistema, o no tienen el formato correcto.

**Solución:**  Verificá que los valores ingresados coincidan con las características reales del producto y que no sean menores a las dimensiones mínimas definidas por fábrica. Además, asegurate de usar el formato correcto para cada unidad de medida.

```

{
  "department": "pymes",
  "cause_id": 5401,
  "type": "error",
  "code": "item.attribute.invalid.seller.package.dimensions",
  "references": [
    "item.attributes"
  ],
  "message": "One or more attributes for seller_package_height, seller_package_length, seller_package_width, seller_package_weight have invalid values"
}
```

### Cómo identificar ítems penalizados

Con el recurso **items/search?**  podrás listar, dentro del campo "results", todos los ítems penalizados que tienen el tag incomplete_technical_specs. Así, identificarás las publicaciones que están perdiendo exposición en los listados para mejorar su calidad.

Para conocer en detalle los motivos por los cuales tus publicaciones están perdiendo exposición deberás revisar [los recursos de calidad](https://developers.mercadolibre.com.ar/es_ar/conoce-como-estan-los-vendedores-frente-la-carga-de-atributos).

Llamada:

```
curl -X GET   -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/items/search?tags=incomplete_technical_specs
```

Ejemplo:

```
curl -X GET   -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/465432224/items/search?tags=incomplete_technical_specs
```

Respuesta:

```
{
   "seller_id": "465432224",
   "query": null,
   "paging": {
       "limit": 50,
       "offset": 0,
       "total": 5
   },
   "results": [
       "MLA803174898",
       "MLA803174894",
       "MLA803174788",
       "MLA803174771",
       "MLA803086664"
   ],
   "filters": [],
   "available_filters": [
       {
           "id": "status",
           "name": "Status",
           "values": [
               {
                   "id": "pending",
                   "name": "Inactive items for debt or MercadoLibre policy violation",
                   "results": 0
               },
               {
                   "id": "not_yet_active",
                   "name": "Items newly created or pending activation",
                   "results": 0
               },
               {
                   "id": "programmed",
                   "name": "Items scheduled for future activation",
                   "results": 0
               },
               {
                   "id": "active",
                   "name": "Active items",
                   "results": 0
               },
               {
                   "id": "paused",
                   "name": "Paused Items",
                   "results": 5
               },
               {
                   "id": "closed",
                   "name": "Closed Items",
                   "results": 0
               }
           ]
       },
       {
           "id": "sub_status",
           "name": "Substatus",
           "values": [
               {
                   "id": "deleted",
                   "name": "Deleted substatus",
                   "results": 0
               },
               {
                   "id": "forbidden",
                   "name": "Forbidden substatus",
                   "results": 0
               },
               {
                   "id": "freezed",
                   "name": "Freezed substatus",
                   "results": 0
               },
               {
                   "id": "held",
                   "name": "Held substatus",
                   "results": 0
               },
               {
                   "id": "suspended",
                   "name": "Suspended substatus",
                   "results": 0
               },
               {
                   "id": "waiting_for_patch",
                   "name": "Waiting for patch substatus",
                   "results": 0
               },
               {
                   "id": "warning",
                   "name": "Warning items with MercadoLibre policy violation",
                   "results": 0
               }
           ]
       },
       {
           "id": "buying_mode",
           "name": "Buying Mode",
           "values": [
               {
                   "id": "buy_it_now",
                   "name": "Buy it now",
                   "results": 5
               },
               {
                   "id": "classified",
                   "name": "Classified",
                   "results": 0
               },
               {
                   "id": "auction",
                   "name": "Auction",
                   "results": 0
               }
           ]
       },
       {
           "id": "listing_type_id",
           "name": "Listing type",
           "values": [
               {
                   "id": "gold_pro",
                   "name": "Gold proffesional",
                   "results": 5
               },
               {
                   "id": "gold_special",
                   "name": "Gold special",
                   "results": 0
               },
               {
                   "id": "gold_premium",
                   "name": "Gold premium",
                   "results": 0
               },
               {
                   "id": "gold",
                   "name": "Gold",
                   "results": 0
               },
               {
                   "id": "silver",
                   "name": "Silver",
                   "results": 0
               },
               {
                   "id": "bronze",
                   "name": "Bronze",
                   "results": 0
               },
               {
                   "id": "free",
                   "name": "Free",
                   "results": 0
               }
           ]
       },
       {
           "id": "shipping_free_methods",
           "name": "Shipping free methods",
           "values": [
               {
                   "id": 73328,
                   "results": 3
               }
           ]
       },
       {
           "id": "shipping_tags",
           "name": "Shipping Tags",
           "values": [
               {
                   "id": "mandatory_free_shipping",
                   "results": 3
               },
               {
                   "id": "me2_available",
                   "results": 2
               }
           ]
       },
       {
           "id": "shipping_mode",
           "name": "Shipping Mode",
           "values": [
               {
                   "id": "me2",
                   "results": 3
               },
               {
                   "id": "not_specified",
                   "results": 2
               }
           ]
       },
       {
           "id": "listing_source",
           "name": "Listing Source",
           "values": [
               {
                   "id": "tucarro",
                   "name": "TuCarro",
                   "results": 0
               },
               {
                   "id": "tuinmueble",
                   "name": "TuInmueble",
                   "results": 0
               },
               {
                   "id": "tumoto",
                   "name": "TuMoto",
                   "results": 0
               },
               {
                   "id": "tulancha",
                   "name": "TuLancha",
                   "results": 0
               },
               {
                   "id": "autoplaza",
                   "name": "Autoplaza",
                   "results": 0
               },
               {
                   "id": "autoplaza_ml",
                   "name": "Autoplaza Premium",
                   "results": 0
               }
           ]
       },
       {
           "id": "labels",
           "name": "Others",
           "values": [
               {
                   "id": "few_available",
                   "name": "Items with few availables",
                   "results": 0
               },
               {
                   "id": "with_bids",
                   "name": "Items with bids",
                   "results": 2
               },
               {
                   "id": "without_bids",
                   "name": "Items whithout bids",
                   "results": 3
               },
               {
                   "id": "accepts_mercadopago",
                   "name": "Items with MercadoPago",
                   "results": 5
               },
               {
                   "id": "ending_soon",
                   "name": "Items ending in 20 days or less",
                   "results": 0
               },
               {
                   "id": "with_mercadolibre_envios",
                   "name": "Items with MercadoLibre Envíos",
                   "results": 3
               },
               {
                   "id": "without_mercadolibre_envios",
                   "name": "Items without MercadoLibre Envíos",
                   "results": 2
               },
               {
                   "id": "with_low_quality_image",
                   "name": "Items with low quality image",
                   "results": 0
               },
               {
                   "id": "with_free_shipping",
                   "name": "Items with free shipping",
                   "results": 3
               },
               {
                   "id": "without_free_shipping",
                   "name": "Items with free shipping",
                   "results": 2
               },
               {
                   "id": "with_automatic_relist",
                   "name": "Items with automatic relist",
                   "results": 0
               },
               {
                   "id": "waiting_for_payment",
                   "name": "Items waiting for payment",
                   "results": 0
               },
               {
                   "id": "suspended",
                   "name": "Suspended items",
                   "results": 0
               },
               {
                   "id": "cancelled",
                   "name": "Items cancelled that can not be recovered",
                   "results": 0
               },
               {
                   "id": "being_reviewed",
                   "name": "Items under review",
                   "results": 0
               },
               {
                   "id": "fix_required",
                   "name": "Items waiting for user fix",
                   "results": 0
               },
               {
                   "id": "waiting_for_documentation",
                   "name": "Items waiting for user documentation",
                   "results": 0
               },
               {
                   "id": "without_stock",
                   "name": "Paused items that are out of stock",
                   "results": 0
               },
               {
                   "id": "incomplete_technical_specs",
                   "name": "Items with incomplete technical specs",
                   "results": 5
               },
               {
                   "id": "loyalty_discount_eligible",
                   "name": "Loyalty discount eligible items",
                   "results": 0
               },
               {
                   "id": "with_fbm_contingency",
                   "name": "Items in FBM contingency",
                   "results": 0
               },
               {
                   "id": "with_shipping_self_service",
                   "name": "Items with shipping self service logistic",
                   "results": 0
               }
           ]
       },
       {
           "id": "logistic_type",
           "name": "Logistic Type",
           "values": [
               {
                   "id": "drop_off",
                   "results": 3
               },
               {
                   "id": "not_specified",
                   "results": 2
               }
           ]
       }
   ],
   "orders": [
       {
           "id": "stop_time_asc",
           "name": "Order by stop time ascending"
       }
   ],
   "available_orders": [
       {
           "id": "stop_time_asc",
           "name": "Order by stop time ascending"
       },
       {
           "id": "stop_time_desc",
           "name": "Order by stop time descending"
       },
       {
           "id": "start_time_asc",
           "name": "Order by start time ascending"
       },
       {
           "id": "start_time_desc",
           "name": "Order by start time descending"
       },
       {
           "id": "available_quantity_asc",
           "name": "Order by available quantity ascending"
       },
       {
           "id": "available_quantity_desc",
           "name": "Order by available quantity descending"
       },
       {
           "id": "sold_quantity_asc",
           "name": "Order by sold quantity ascending"
       },
       {
           "id": "sold_quantity_desc",
           "name": "Order by sold quantity descending"
       },
       {
           "id": "price_asc",
           "name": "Order by price ascending"
       },
       {
           "id": "price_desc",
           "name": "Order by price descending"
       },
       {
           "id": "last_updated_desc",
           "name": "Order by lastUpdated descending"
       },
       {
           "id": "last_updated_asc",
           "name": "Order by last updated ascending"
       },
       {
           "id": "total_sold_quantity_asc",
           "name": "Order by total sold quantity ascending"
       },
       {
           "id": {
               "id": "total_sold_quantity_desc",
               "field": "sold_quantity",
               "missing": "_last",
               "order": "desc"
           },
           "name": "Order by total sold quantity descending"
       },
       {
           "id": {
               "id": "inventory_id_asc",
               "field": "inventory_id",
               "missing": "_last",
               "order": "asc"
           },
           "name": "Order by inventory id ascending"
       }
   ]
}
```

## Especificar atributos que no aplican

Si alguna especificación no aplica al producto que estás publicando, es importante que lo marques como N/A (no aplica). Para eso, debes enviar:

- Value_id ="-1"

- Value_name = "Null"

En la API de ítems, para poder visualizar los atributos N/A deberán agregar el parámetro include_internal_attributes=true, ya que si se hace el llamado sin el mismo no se visualizarán los atributos N/A. 
 Llamada

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/{item_id?attributes=attributes&include_internal_attributes=true
```

Ejemplo

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA0000000?attributes=attributes&include_internal_attributes=true
```

Respuesta

```
],
  "attributes": [
    {
      "id": "BRAND",
      "name": "Marca",
      "value_id": "134",
      "value_name": "Winco",
      "value_struct": null,
      "attribute_group_id": "OTHERS",
      "attribute_group_name": "Otros"
    },
    {
      "id": "GTIN",
      "name": "Código universal de producto",
      "value_id": "-1",
      "value_name": null,
      "value_struct": null,
      "attribute_group_id": "OTHERS",
      "attribute_group_name": "Otros"
    }, 
    {
      "id": "ITEM_CONDITION",
      "name": "Condición del ítem",
      "value_id": "2230284",
      "value_name": "Nuevo",
      "value_struct": null,
      "attribute_group_id": "OTHERS",
      "attribute_group_name": "Otros"
    },
  {
      "id": "MODEL",
      "name": " Modelo",
      "value_id": null,
      "value_name": "Modelo1",
      "value_struct": null,
      "attribute_group_id": "OTHERS",
    "attribute_group_name": "Otros"
    "attribute_group_name": "Otros"
    },

    {
      "id": "POWER",
      "name": "Potencia",
      "value_id":"-1",
      "value_name":null,
      "value_struct": null    
  }
      "attribute_group_id": "OTHERS",
      "attribute_group_name": "Otros"
    },
```

Si quieres realizar un POST o un PUT, la configuración de los atributos se seguirá armando de la misma manera Ejemplos

## Crear un ítem con un atributo N/A

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -d '{
 "site_id":"MLA",
 "title":"Item de testeo, por favor no contactar --kc:off",
 "category_id":"MLA125703",
 "price":4000,
 "currency_id":"ARS",
 "buying_mode":"buy_it_now",
 "listing_type_id":"gold_special",
 "condition":"new",
 "available_quantity":10,
"attributes": [{
      "id": "COLOR",
      "value_id": "52049"
    },
    {
      "id": "VOLTAGE",
      "value_name": "198813"
    },
    {
      "id": "DIAMETER",
      "value_id": "-1",
      "value_name": null
    }

 ]
}'
```

## Modificar una publicación activa e indicar que un atributo no aplica (N/A)

```
curl -X PUT  -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -H "Accept: application/json" -d { "attributes": [{
      "id": "COLOR",
      "value_id": "52049"
    },
    {
      "id": "VOLTAGE",
      "value_name": "198813"
    },
    {
      "id": "DIAMETER",
      "value_id": "-1",
      "value_name": null
    },
    {
      "id": "LATERAL_OSCILLATION",
      "value_id": "242085"
    
    }
  ]
}
```

## Consideraciones

Los atributos con tag allow_variations no pueden ser N/A.

Si se envía un atributo con value_id -1, pero el value_name tiene algún valor que no sea null, se ignora como si no se hubiera enviado. Ya que desde la Api de Items, se verifica que la especificación de N/A sea enviada y lee ambos campos para considerarlo.

Por el momento, si envías N/A, solo puede ser reemplazado por un valor (Al hacer un PUT, no se puede dejar el atributo null).

## Exclusiones e implicaciones de comportamientos

| Matriz de exclusiones | Required | Fixed | Allow_variations | Variation_attribute | Defines_Picture | Hidden |
| --- | --- | --- | --- | --- | --- | --- |
| Required |  |  |  |  |  | X |
| Fixed |  |  | X | X | X |  |
| Allow_variations |  | X |  | X |  |  |
| Variation_attribute |  | X | X |  | X |  |
| Defines_Picture |  | X |  | X |  |  |
| Hidden | X |  |  |  |  |  |

| Matriz de implicaciones | Required | Fixed | Allow_variations | Variation_attribute | Defines_Picture | Hidden |
| --- | --- | --- | --- | --- | --- | --- |
| Required |  |  |  |  |  |  |
| Fixed |  |  |  |  |  |  |
| Allow_variations |  |  |  |  |  |  |
| Variation_attribute |  |  |  |  |  |  |
| Defines_Picture |  |  | X |  |  |  |
| Hidden |  |  |  |  |  |  |

## Beneficio

La información del ítem será más completa y tendrá más protagonismo, mostrando los atributos a través de una ficha técnica en VIP, evitando así preguntas y fricciones.

## Crear ítem con atributos

Supongamos que queremos vender un Microondas para el cual conocemos su marca, modelo y capacidad; primero, deberemos determinar en qué categoría queremos publicarlo y posteriormente consultar qué atributos posee dicha categoría:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA125703/attributes
[
 {
   "id": "BRAND",
   "name": "Marca",
   "tags": {
     "fixed": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "values": [
     {
       "id": "5601",
       "name": "BGH"
     }
   ],
   "attribute_group_id": "MAIN",
   "attribute_group_name": "Atributos Principales"
 },
 {
   "id": "COLOR",
   "name": "Color",
   "tags": {
     "allow_variations": true,
     "hidden": true
   },
   "type": "color",
   "value_type": "list",
   "values": [
     {
       "id": "52049",
       "name": "Negro",
       "metadata": {
         "rgb": "000000"
       }
     },
     {
       "id": "51993",
       "name": "Rojo",
       "metadata": {
         "rgb": "FF0000"
       }
     },
     {
       "id": "52035",
       "name": "Violeta",
       "metadata": {
         "rgb": "9F00FF"
       }
     },
     {
       "id": "52028",
       "name": "Azul",
       "metadata": {
         "rgb": "1717FF"
       }
     },
     {
       "id": "52005",
       "name": "Marrón",
       "metadata": {
         "rgb": "A0522D"
       }
     },
     {
       "id": "52051",
       "name": "Gris oscuro",
       "metadata": {
         "rgb": "666666"
       }
     },
     {
       "id": "52000",
       "name": "Naranja",
       "metadata": {
         "rgb": "FF8C00"
       }
     },
     {
       "id": "52014",
       "name": "Verde",
       "metadata": {
         "rgb": "0DA600"
       }
     },
     {
       "id": "51994",
       "name": "Rosa",
       "metadata": {
         "rgb": "FCB1BE"
       }
     },
     {
       "id": "283164",
       "name": "Dorado",
       "metadata": {
         "rgb": "FFD700"
       }
     },
     {
       "id": "52007",
       "name": "Amarillo",
       "metadata": {
         "rgb": "FFED00"
       }
     },
     {
       "id": "52053",
       "name": "Plateado",
       "metadata": {
         "rgb": "CBCFD0"
       }
     },
     {
       "id": "283165",
       "name": "Gris claro",
       "metadata": {
         "rgb": "E1E1E1"
       }
     },
     {
       "id": "52021",
       "name": "Celeste",
       "metadata": {
         "rgb": "83DDFF"
       }
     },
     {
       "id": "52055",
       "name": "Blanco",
       "metadata": {
         "rgb": "FFFFFF"
       }
     },
     {
       "id": "51998",
       "name": "Bordó",
       "metadata": {
         "rgb": "830500",
         "parent_id": "51993"
       }
     },
     {
       "id": "51996",
       "name": "Terracota",
       "metadata": {
         "rgb": "C63633",
         "parent_id": "51993"
       }
     },
     {
       "id": "283149",
       "name": "Coral",
       "metadata": {
         "rgb": "FA8072",
         "parent_id": "51993"
       }
     },
     {
       "id": "283148",
       "name": "Coral claro",
       "metadata": {
         "rgb": "F9AC95",
         "parent_id": "51993"
       }
     },
     {
       "id": "52047",
       "name": "Violeta oscuro",
       "metadata": {
         "rgb": "4E0087",
         "parent_id": "52035"
       }
     },
     {
       "id": "283162",
       "name": "Índigo",
       "metadata": {
         "rgb": "7A64C6",
         "parent_id": "52035"
       }
     },
     {
       "id": "52038",
       "name": "Lila",
       "metadata": {
         "rgb": "CC87FF",
         "parent_id": "52035"
       }
     },
     {
       "id": "52036",
       "name": "Lavanda",
       "metadata": {
         "rgb": "D9D2E9",
         "parent_id": "52035"
       }
     },
     {
       "id": "52033",
       "name": "Azul oscuro",
       "metadata": {
         "rgb": "013267",
         "parent_id": "52028"
       }
     },
     {
       "id": "283161",
       "name": "Azul marino",
       "metadata": {
         "rgb": "0F5299",
         "parent_id": "52028"
       }
     },
     {
       "id": "52031",
       "name": "Azul acero",
       "metadata": {
         "rgb": "6FA8DC",
         "parent_id": "52028"
       }
     },
     {
       "id": "52029",
       "name": "Azul claro",
       "metadata": {
         "rgb": "DCECFF",
         "parent_id": "52028"
       }
     },
     {
       "id": "283155",
       "name": "Marrón oscuro",
       "metadata": {
         "rgb": "5D3806",
         "parent_id": "52005"
       }
     },
     {
       "id": "283154",
       "name": "Marrón claro",
       "metadata": {
         "rgb": "AF8650",
         "parent_id": "52005"
       }
     },
     {
       "id": "283153",
       "name": "Suela",
       "metadata": {
         "rgb": "FAEBD7",
         "parent_id": "52005"
       }
     },
     {
       "id": "52001",
       "name": "Beige",
       "metadata": {
         "rgb": "F5F3DC",
         "parent_id": "52005"
       }
     },
     {
       "id": "283152",
       "name": "Chocolate",
       "metadata": {
         "rgb": "9B3F14",
         "parent_id": "52000"
       }
     },
     {
       "id": "283151",
       "name": "Naranja oscuro",
       "metadata": {
         "rgb": "D2691E",
         "parent_id": "52000"
       }
     },
     {
       "id": "283150",
       "name": "Naranja claro",
       "metadata": {
         "rgb": "FDAF20",
         "parent_id": "52000"
       }
     },
     {
       "id": "52003",
       "name": "Piel",
       "metadata": {
         "rgb": "FFE4C4",
         "parent_id": "52000"
       }
     },
     {
       "id": "52019",
       "name": "Verde oscuro",
       "metadata": {
         "rgb": "003D00",
         "parent_id": "52014"
       }
     },
     {
       "id": "283158",
       "name": "Verde musgo",
       "metadata": {
         "rgb": "3F7600",
         "parent_id": "52014"
       }
     },
     {
       "id": "283157",
       "name": "Verde limón",
       "metadata": {
         "rgb": "73E129",
         "parent_id": "52014"
       }
     },
     {
       "id": "52015",
       "name": "Verde claro",
       "metadata": {
         "rgb": "9FF39F",
         "parent_id": "52014"
       }
     },
     {
       "id": "52042",
       "name": "Fucsia",
       "metadata": {
         "rgb": "FF00EC",
         "parent_id": "51994"
       }
     },
     {
       "id": "283163",
       "name": "Rosa chicle",
       "metadata": {
         "rgb": "FF51A8",
         "parent_id": "51994"
       }
     },
     {
       "id": "52045",
       "name": "Rosa pálido",
       "metadata": {
         "rgb": "D06EA8",
         "parent_id": "51994"
       }
     },
     {
       "id": "52043",
       "name": "Rosa claro",
       "metadata": {
         "rgb": "FADBE2",
         "parent_id": "51994"
       }
     },
     {
       "id": "52012",
       "name": "Dorado oscuro",
       "metadata": {
         "rgb": "BF9000",
         "parent_id": "52007"
       }
     },
     {
       "id": "52010",
       "name": "Ocre",
       "metadata": {
         "rgb": "EACB53",
         "parent_id": "52007"
       }
     },
     {
       "id": "283156",
       "name": "Caqui",
       "metadata": {
         "rgb": "F0E68C",
         "parent_id": "52007"
       }
     },
     {
       "id": "52008",
       "name": "Crema",
       "metadata": {
         "rgb": "FFFFE0",
         "parent_id": "52007"
       }
     },
     {
       "id": "52024",
       "name": "Azul petróleo",
       "metadata": {
         "rgb": "1E6E7F",
         "parent_id": "52021"
       }
     },
     {
       "id": "283160",
       "name": "Turquesa",
       "metadata": {
         "rgb": "40E0D0",
         "parent_id": "52021"
       }
     },
     {
       "id": "52022",
       "name": "Agua",
       "metadata": {
         "rgb": "E0FFFF",
         "parent_id": "52021"
       }
     },
     {
       "id": "283159",
       "name": "Cyan",
       "metadata": {
         "rgb": "00FFFF",
         "parent_id": "52021"
       }
     }
   ],
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_HEIGHT",
   "name": "Altura del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "km",
       "name": "km"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_WIDTH",
   "name": "Ancho del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "km",
       "name": "km"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "TURNTABLE",
   "name": "Bandeja Giratoria",
   "tags": {
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "NUMBER_OF_PROGRAMS",
   "name": "Cantidad de Programas",
   "tags": {
     "hidden": true
   },
   "value_type": "number",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "VOLUME_CAPACITY",
   "name": "Capacidad",
   "tags": {
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "l",
       "name": "l"
     },
     {
       "id": "cc",
       "name": "cc"
     },
     {
       "id": "ft³",
       "name": "ft³"
     },
     {
       "id": "ml",
       "name": "ml"
     },
     {
       "id": "mm³",
       "name": "mm³"
     }
   ],
   "default_unit": "l",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "CONVECTION",
   "name": "Convección",
   "tags": {
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "TURNTABLE_DIAMETER",
   "name": "Diámetro de Bandeja Giratoria",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "km",
       "name": "km"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "EAN",
   "name": "EAN",
   "tags": {
     "hidden": true,
     "multivalued": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "FREQUENCY",
   "name": "Frecuencia",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "hz",
       "name": "hz"
     },
     {
       "id": "ghz",
       "name": "ghz"
     },
     {
       "id": "khz",
       "name": "khz"
     },
     {
       "id": "mhz",
       "name": "mhz"
     },
     {
       "id": "rpm",
       "name": "rpm"
     }
   ],
   "default_unit": "hz",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MICROWAVE_FUNCTIONS",
   "name": "Funciones",
   "tags": {
     "hidden": true,
     "multivalued": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "GRILL",
   "name": "Grill",
   "tags": {
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "GTIN",
   "name": "GTIN",
   "tags": {
     "hidden": true,
     "multivalued": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "JAN",
   "name": "JAN",
   "tags": {
     "hidden": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "LINE",
   "name": "Línea",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_LENGTH",
   "name": "Longitud del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mm",
       "name": "mm"
     },
     {
       "id": "cm",
       "name": "cm"
     },
     {
       "id": "in",
       "name": "in"
     },
     {
       "id": "pulgadas",
       "name": "pulgadas"
     },
     {
       "id": "ft",
       "name": "ft"
     },
     {
       "id": "m",
       "name": "m"
     },
     {
       "id": "km",
       "name": "km"
     }
   ],
   "default_unit": "mm",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "DIMENSIONS",
   "name": "Medidas",
   "tags": {
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MODEL",
   "name": "Modelo",
   "tags": {
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "MAIN",
   "attribute_group_name": "Atributos Principales"
 },
 {
   "id": "ALPHANUMERIC_MODEL",
   "name": "Modelo Alfanumérico",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "DETAILED_MODEL",
   "name": "Modelo Detallado",
   "tags": {
     "hidden": true
   },
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MPN",
   "name": "MPN",
   "tags": {
     "hidden": true,
     "multivalued": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "POWER_LEVELS",
   "name": "Niveles de Potencia",
   "tags": {
     "hidden": true
   },
   "value_type": "number",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PACKAGE_WEIGHT",
   "name": "Peso del paquete",
   "tags": {
     "hidden": true,
     "read_only": true,
     "variation_attribute": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "mcg",
       "name": "mcg"
     },
     {
       "id": "mg",
       "name": "mg"
     },
     {
       "id": "g",
       "name": "g"
     },
     {
       "id": "oz",
       "name": "oz"
     },
     {
       "id": "lb",
       "name": "lb"
     },
     {
       "id": "kg",
       "name": "kg"
     }
   ],
   "default_unit": "mcg",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "POWER",
   "name": "Potencia",
   "tags": {
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "w",
       "name": "w"
     },
     {
       "id": "btu/h",
       "name": "btu/h"
     },
     {
       "id": "cv",
       "name": "cv"
     },
     {
       "id": "fg",
       "name": "fg"
     },
     {
       "id": "hp",
       "name": "hp"
     },
     {
       "id": "kcal/h",
       "name": "kcal/h"
     },
     {
       "id": "kw",
       "name": "kw"
     },
     {
       "id": "mw",
       "name": "mw"
     },
     {
       "id": "tfr",
       "name": "tfr"
     },
     {
       "id": "va",
       "name": "va"
     }
   ],
   "default_unit": "w",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "GRILL_POWER",
   "name": "Potencia de Grill",
   "tags": {
     "hidden": true
   },
   "value_type": "number_unit",
   "value_max_length": 60,
   "allowed_units": [
     {
       "id": "w",
       "name": "w"
     },
     {
       "id": "btu/h",
       "name": "btu/h"
     },
     {
       "id": "cv",
       "name": "cv"
     },
     {
       "id": "fg",
       "name": "fg"
     },
     {
       "id": "hp",
       "name": "hp"
     },
     {
       "id": "kcal/h",
       "name": "kcal/h"
     },
     {
       "id": "kw",
       "name": "kw"
     },
     {
       "id": "mw",
       "name": "mw"
     },
     {
       "id": "tfr",
       "name": "tfr"
     },
     {
       "id": "va",
       "name": "va"
     }
   ],
   "default_unit": "w",
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MIRRORED_DOOR",
   "name": "Puerta Espejada",
   "tags": {
     "hidden": true
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "PROGRAMMABLE_KEYS",
   "name": "Teclas Programables",
   "tags": {
     "hidden": true
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "MICROWAVE_TYPE",
   "name": "Tipo",
   "tags": {
   },
   "value_type": "list",
   "values": [
     {
       "id": "289784",
       "name": "De Apoyo"
     },
     {
       "id": "289785",
       "name": "De Embutir"
     }
   ],
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "CHILD_SAFETY_LOCK",
   "name": "Traba de Seguridad para Niños",
   "tags": {
     "hidden": true
   },
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
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "UPC",
   "name": "UPC",
   "tags": {
     "hidden": true,
     "multivalued": true,
     "variation_attribute": true
   },
   "type": "product_identifier",
   "value_type": "string",
   "value_max_length": 60,
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 },
 {
   "id": "VOLTAGE",
   "name": "Voltaje",
   "tags": {
     "hidden": true
   },
   "value_type": "list",
   "values": [
     {
       "id": "198812",
       "name": "110V / 220V"
     },
     {
       "id": "198813",
       "name": "220V"
     },
     {
       "id": "198814",
       "name": "110V"
     }
   ],
   "attribute_group_id": "DFLT",
   "attribute_group_name": "Otros"
 }
]
```

En este ejemplo, se puede apreciar como el atributo BRAND tiene el tag fixed para la categoría. Esto sucede porque al haber navegado por el árbol, con el fin de buscar la categoría para publicar el microondas, elegiste implícitamente la marca del mismo. 
 Ten en cuenta que **si el producto no tiene una marca propia** , debes escribir en su atributo BRAND que es un **producto “genérico”** .
 Luego de analizar los atributos disponibles, sus tipos y los valores sugeridos, solo resta armar el JSON de la publicación incluyendo la sección de attributes.
 A continuación te mostramos cómo hacerlo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -d '{
 "site_id":"MLA",
 "title":"Item de testeo, por favor no contactar --kc:off",
 "category_id":"MLA125703",
 "price":4000,
 "currency_id":"ARS",
 "buying_mode":"buy_it_now",
 "listing_type_id":"gold_special",
 "condition":"new",
 "available_quantity":10,
 "attributes":[
   {
     "id":"MODEL",
     "value_name":"B228D"
   },
   {
     "id":"VOLUME_CAPACITY",
     "value_name":"28 L"
   }
 ]
}' 'https://api.mercadolibre.com/items'
```

Notas:

- Los atributos pueden ser agregados en los ítems en cualquier momento del su ciclo de vida.
- En caso que el atributo posea una lista de suggested_values puedes enviar uno de dichos valores o enviar un valor nuevo. Para enviar valores nuevos debes enviar únicamente el value_name pero para valores existentes basta con enviar el value_id.
- En caso de atributos de tipo list debes enviar únicamente valores que pertenezcan a esa lista. Alcanza con enviar únicamente el value_id. Pero si quieres cargar un valor que no existe en la lista, puedes hacerlo enviando en el value_name tu valor personalizado, con el value_id del valor que más se asemeje al tuyo.
- Todos los atributos principales son identificados como MAIN en el campo attribute_group_id mientras que, los atributos secundarios serán distinguidos bajo otros valores como por ejemplo: DELT.
- Ten en cuentan que en categorías que contengan color primario y secundario, excepcionalmente, no será necesario que todas las variaciones repliquen ambos atributos.

## Valores más utilizados (tops values)

Con este recurso podrás conocer cuáles son los valores más usados para determinado atributo de un dominio. También podrás profundizar la búsqueda indicando otros valores de atributos para que se listen sólo los valores que apliquen a ellos.
 Los vendedores podrán utilizar los valores obtenidos para elegir dentro de ellos cuál es el correcto y mejorar la calidad de las publicaciones.

### Parámetros obligatorios

**domain_id** : es el ID del dominio al cual queremos hacer referencia.
 **attribute_id** : es el ID del atributo del cual necesitamos conocer los valores más usados.

### Parámetros opcionales

**limit** : es el límite de resultados que se solicita tiene un máximo de 1000. 
 **metric_type** : es la métrica por la cual se ordenarán los resultados, en principio solo se admiten NOLs (nuevas publicaciones en los últimos 90 días). El único parámetro por el momento es NOL_90. Próximamente, sumaremos nuevos criterios. Ejemplo: metric_type=NOL_90.

Para identificar los atributos recomendados y conocidos, debes realizar un POST.

Llamada simple con un solo atributo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/$DOMAIN_ID/attributes/$ATTRIBUTE_ID/top_values
```

Ejemplo con un solo atributo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLA-CELLPHONES/attributes/BRAND/top_values
```

Respuesta acotada de Marcas para el dominio MLA-CELLPHONES:

```
[
    {
        "id": "9344",
        "name": "Apple",
        "metric": 12189
    },
    {
        "id": "206",
        "name": "Samsung",
        "metric": 10389
    },
    {
        "id": "59387",
        "name": "Xiaomi",
        "metric": 5183
    },
    {
        "id": "2503",
        "name": "Motorola",
        "metric": 4272
    },
    {
        "id": "8784",
        "name": "Huawei",
        "metric": 1203
    },
    {
        "id": "215",
        "name": "LG",
        "metric": 1022
    }
]
```

Llamada con más de un atributo:

```
curl -X POST https://api.mercadolibre.com/catalog_domains/$DOAMAIN_ID/attributes/$ATTRIBUTE_ID/top_values
{
    "known_attributes": [
        {
            "id": "attributes.id",
            "value_id": "attributes.value_id"
        }
    ]
}
```

Nota:

El listado de **known_attributes**  representa el conjunto de atributos que se tendrán en cuenta para el cálculo de top values.

Ejemplo con más de un atributo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLA-CELLPHONES/attributes/MODEL/top_values
{
   "known_attributes": [
       {
           "id": "BRAND",
           "value_id": "206"
       }
   ]
}
```

Respuesta acotada de Modelos para la Marca Samsung en el dominio MLA-CELLPHONES:

```
[
    {
        "id": "7693",
        "name": "A50",
        "metric": 517
    },
    {
        "id": "35040",
        "name": "A30",
        "metric": 437
    },
    {
        "id": "8480",
        "name": "A10",
        "metric": 345
    },
    {
        "id": "397729",
        "name": "J2 Prime",
        "metric": 301
    }
]
```

Nota:

En la respuesta se listarán todos los valores del atributo solicitado. Este listado estará ordenado por el campo **metric**  de manera descendente.

## Modificar y/o agregar atributos

Luego de creada la publicación, puedes agregar nuevos atributos o modificar los ya existentes. Supongamos que quieres modificar el Modelo del Microondas, y agregarle la Cantidad de Programas que posee. En primer lugar, te recomendamos hacer un GET para conocer los atributos que ya están completos (por ejemplo Modelo). Llamada:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/{item_id}
```

Ejemplo:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA0000000
```

Respuesta:

```
{
  "id": "MLA0000000",
  "site_id": "MLA",
  "title": "Korg Sintetizador Analogico Monofonico 37 Teclas Ms-20 Mini",
  "subtitle": null,
  "seller_id": 000000,
  "category_id": "MLA3001",
  "official_store_id": null,
  "price": 15150.63,
  "base_price": 15150.63,
  "original_price": null,
  "currency_id": "ARS",
  "initial_quantity": 32,
  "available_quantity": 27,
  "sold_quantity": 5,
  "sale_terms": [
  ],
  "buying_mode": "buy_it_now",
  "listing_type_id": "gold_special",
  "start_time": "2016-06-21T20:59:05.000Z",
  "stop_time": "2036-06-16T20:59:05.000Z",
  "condition": "new",
  "permalink": "http://articulo.mercadolibre.com.ar/MLA-624882373-korg-sintetizador-analogico-monofonico-37-teclas-ms-20-mini-_JM",
  "thumbnail": "http://mla-s2-p.mlstatic.com/777099-MLA26466460545_112017-I.jpg",
  "secure_thumbnail": "https://mla-s2-p.mlstatic.com/777099-MLA26466460545_112017-I.jpg",
  "pictures": [
    {
      "id": "777099-MLA26466460545_112017",
      "url": "http://mla-s2-p.mlstatic.com/777099-MLA26466460545_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/777099-MLA26466460545_112017-O.jpg",
      "size": "500x297",
      "max_size": "500x297",
      "quality": ""
    },
    {
      "id": "838812-MLA26466460548_112017",
      "url": "http://mla-s2-p.mlstatic.com/838812-MLA26466460548_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/838812-MLA26466460548_112017-O.jpg",
      "size": "500x167",
      "max_size": "500x167",
      "quality": ""
    },
    {
      "id": "788581-MLA26466460552_112017",
      "url": "http://mla-s2-p.mlstatic.com/788581-MLA26466460552_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/788581-MLA26466460552_112017-O.jpg",
      "size": "500x262",
      "max_size": "500x262",
      "quality": ""
    },
    {
      "id": "700278-MLA26466460555_112017",
      "url": "http://mla-s2-p.mlstatic.com/700278-MLA26466460555_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/700278-MLA26466460555_112017-O.jpg",
      "size": "500x169",
      "max_size": "500x169",
      "quality": ""
    },
    {
      "id": "944935-MLA26466456419_112017",
      "url": "http://mla-s2-p.mlstatic.com/944935-MLA26466456419_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/944935-MLA26466456419_112017-O.jpg",
      "size": "500x210",
      "max_size": "500x210",
      "quality": ""
    },
    {
      "id": "869141-MLA26466456422_112017",
      "url": "http://mla-s2-p.mlstatic.com/869141-MLA26466456422_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/869141-MLA26466456422_112017-O.jpg",
      "size": "500x500",
      "max_size": "500x500",
      "quality": ""
    },
    {
      "id": "867779-MLA26466456425_112017",
      "url": "http://mla-s2-p.mlstatic.com/867779-MLA26466456425_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/867779-MLA26466456425_112017-O.jpg",
      "size": "500x500",
      "max_size": "500x500",
      "quality": ""
    },
    {
      "id": "849841-MLA26466456432_112017",
      "url": "http://mla-s2-p.mlstatic.com/849841-MLA26466456432_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/849841-MLA26466456432_112017-O.jpg",
      "size": "500x500",
      "max_size": "500x500",
      "quality": ""
    },
    {
      "id": "877748-MLA26466456435_112017",
      "url": "http://mla-s2-p.mlstatic.com/877748-MLA26466456435_112017-O.jpg",
      "secure_url": "https://mla-s2-p.mlstatic.com/877748-MLA26466456435_112017-O.jpg",
      "size": "500x500",
      "max_size": "500x500",
      "quality": ""
    }
  ],
  "video_id": "tCRPz6Q70VU",
  "descriptions": [
    {
      "id": "0000000-1123489912"
    }
  ],
  "accepts_mercadopago": true,
  "non_mercado_pago_payment_methods": [
    {
      "id": "MLATB",
      "description": "Transferencia bancaria",
      "type": "G"
    },
    {
      "id": "MLAOT",
      "description": "Tarjeta de crédito",
      "type": "N"
    },
    {
      "id": "MLAMO",
      "description": "Efectivo",
      "type": "G"
    }
  ],
  "shipping": {
    "mode": "not_specified",
    "methods": [
    ],
    "tags": [
    ],
    "dimensions": null,
    "local_pick_up": true,
    "free_shipping": false,
    "logistic_type": "not_specified",
    "store_pick_up": false
  },
  "international_delivery_mode": "none",
  "seller_address": {
    "comment": "",
    "address_line": "",
    "zip_code": "",
    "city": {
      "id": "TUxBQlJFQzkyMTVa",
      "name": "Recoleta"
    },
    "state": {
      "id": "AR-C",
      "name": "Capital Federal"
    },
    "country": {
      "id": "AR",
      "name": "Argentina"
    },
    "search_location": {
      "neighborhood": {
        "id": "TUxBQlJFQzkyMTVa",
        "name": "Recoleta"
      },
      "city": {
        "id": "TUxBQ0NBUGZlZG1sYQ",
        "name": "Capital Federal"
      },
      "state": {
        "id": "TUxBUENBUGw3M2E1",
        "name": "Capital Federal"
      }
    },
    "latitude": -34.598694,
    "longitude": -58.391033,
    "id": 156708999
  },
  "seller_contact": null,
  "location": {
  },
  "geolocation": {
    "latitude": -34.598694,
    "longitude": -58.391033
  },
  "coverage_areas": [
  ],
  "attributes": [
    {
      "id": "AMOUNT_OF_KEYS",
      "name": "Cantidad de teclas",
      "value_id": null,
      "value_name": "37",
      "value_struct": null,
      "attribute_group_id": "DFLT",
      "attribute_group_name": "Otros"
    },
    {
      "id": "DIMENSIONS",
      "name": "Medidas",
      "value_id": null,
      "value_name": "493 × 257 × 208 mm",
      "value_struct": null,
      "attribute_group_id": "DFLT",
      "attribute_group_name": "Otros"
    },
    {
      "id": "WEIGHT",
      "name": "Peso",
      "value_id": null,
      "value_name": "4.8 kg",
      "value_struct": null,
      "attribute_group_id": "DFLT",
      "attribute_group_name": "Otros"
    },
    {
      "id": "BRAND",
      "name": "Marca",
      "value_id": "18163",
      "value_name": "KORG",
      "value_struct": null,
      "attribute_group_id": "MAIN",
      "attribute_group_name": "Principales"
    },
    {
      "id": "MODEL",
      "name": "Modelo",
      "value_id": "522231",
      "value_name": "MS-20 mini",
      "value_struct": null,
      "attribute_group_id": "MAIN",
      "attribute_group_name": "Principales"
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
    "good_quality_thumbnail",
    "good_quality_picture",
    "immediate_payment"
  ],
  "warranty": "null",
  "catalog_product_id": null,
  "domain_id": "MLA-MUSICAL_KEYBOARDS",
  "parent_item_id": null,
  "differential_pricing": null,
  "deal_ids": [
  ],
  "automatic_relist": false,
  "date_created": "2016-06-21T20:59:05.000Z",
  "last_updated": "2017-12-30T16:49:01.000Z"
}
```

**Necesitarás volver a subir este atributo cuando hagas el PUT para no perder la información.**  ¿Listo para hacer la subida? Realiza un PUT incluyendo los nuevos atributos, como Cantidad de programas, y los que ya tenías (como Modelo).

```
curl -X PUT  -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -H "Accept: application/json" -d "{
   "attributes": [{
       "id": "BRAND"
   },{
       "id": "MODEL",
       "value_name": "B466GT"
   }, {
       "id": "VOLUME_CAPACITY"
   }, {
       "id": "NUMBER_OF_PROGRAMS",
       "value_name": "4"
   }]
} "https://api.mercadolibre.com/items/MLA621092868"
```

## Eliminar atributos

La forma correcta de eliminar el valor del atributo es enviando null en los campos "value_id" y "value_name". De esta forma el atributo permanecerá en el ítem, pero sin valores. Si no lo haces, y envías estos campos vacíos, ya no lo contaremos como borrados, y se verá la información que cargaste previamente. Ten en cuenta que, si algún dato es requerido e intentas enviar "null", te devolveremos un bad request con el siguiente código de error: **"code": "item.attributes.deleted_required"**  Para lograrlo, realiza una llamada similar al siguiente ejemplo: 
Llamada:

```
curl -H 'Content-Type: application/json' -X PUT  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA20805195516  -d
```

Ejemplo:

```
{
  "title": "Item de test - No Ofertar 456",
  "category_id": "MLA126186",
  "price": 10,
  "currency_id": "ARS",
  "available_quantity": 1,
  "buying_mode": "buy_it_now",
  "listing_type_id": "gold_special",
  "condition": "new",
  "description": "Item de test - No Ofertar",
  "video_id": "YOUTUBE_ID_HERE",
  "warranty": "null",
  "pictures": [{
    "source": "http://mla-s2-p.mlstatic.com/968521-MLA20805195516_072016-O.jpg"
  }],
  "attributes": [{
      "id": "COLOR",
      "value_id": "52049"
    },
    {
      "id": "VOLTAGE",
      "value_name": "198813"
    },
    {
      "id": "DIAMETER",
      "value_id": null,
      "value_name": null
    }
  ]
}
```

**Siguiente:**  [Identificadores de productos](https://developers.mercadolibre.com.ar/es_ar/identificadores-de-productos)
