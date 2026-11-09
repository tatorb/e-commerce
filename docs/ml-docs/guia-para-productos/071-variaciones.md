<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/variaciones -->
<!-- Sección: Guía para productos -->

# Variaciones

Última actualización 30/12/2025

## Variaciones

Importante:

A partir del 14 de diciembre de 2022, el máximo de variaciones permitidas (**max_variations_allowed** ) por categoría a 100. Excepto, categorías de Moda, Accesorios para celulares y Autopartes tendrán un límite de 250. Además, todas las variaciones existentes podrán ser editadas.

En esta guía encuentras qué hacer para publicar un mismo modelo de Zapatos pero en diferentes Colores y Talles/Tallas. Con variaciones podrás contar en una misma publicación todas las variantes del ítem, manteniendo stock diferencial por cada una. En la orden de compra verás el color y talle elegido por el comprador. Conoce más sobre la [importancia de crear productos con variantes](https://vendedores.mercadolibre.com.ar/nota/conoce-como-vender-los-productos-con-variantes-en-full).

## Beneficios

- El comprador puede ver, dentro de una misma publicación, las diferentes variantes y la disponibilidad de cada una.

- Disminuye las consultas entre comprador y vendedor.

- En la orden de compra, aparecerá el color y talle elegido por el comprador, facilitando el proceso postventa y evitando reclamos.

- Permite mayor control y organización del stock.

## Consideraciones

- Podrás enviar el código de stock (SKU) para cada variación. La forma correcta de almacenar el SKU es en el atributo del ítem. Este atributo es el SELLER_SKU, dejando al campo seller_custom_field para un uso interno del vendedor y sin tener relación entre ambos campos.

- En el recurso de /orders, actualmente se cuenta con ambos campos como en el recurso de /items y estos no son combinables.

- Siempre que el ítem cuente con el atributo SELLER_SKU, tanto en /items como en /orders se visualizará el valor del atributo. Deberás cargar siempre el valor en el atributo para que esta sea considerada.

- El precio deberá ser el mismo para cada variación. Si bien, vía API, puedes poner diferentes precios para cada variación, en la VIP solo será visto el precio más alto y también se tendrá en cuenta en el momento que se realice el pago.

## Publicar ítems con variaciones

Para publicar ítems con variaciones debes elegir la categoría donde deseas publicar, una vez seleccionada, debes chequear si la misma permite variaciones identificando aquellos atributos con el tag allow_variations. Este tipo de atributos los debes cargar en la sección attribute_combinations, dentro de variations, teniendo en cuenta que debes cargar los mismos para todas las variaciones.

A su vez, puedes enviar la propiedad attributes para cada variación, para poder especificar características del ítem propias de cada variante. Los atributos que puedes cargar en esta sección serán identificados en la API por el tag variation_attribute. Por ejemplo, si vendes un celular en varios colores, y para cada uno de ellos tienes su código de barra, puedes cargarlo para cada variante en la sección attributes.

Notas:

- Para saber cuáles son los atributos obligatorios de una variación se deben buscar aquellos con el tags required = true, en caso de tener una categoría que sea allow variation pero que no tenga atributos con este tag, quiere decir que se pueden crear items sin variaciones.
 - Actualmente los atributos con el tag variation_attribute no se muestran en la VIP, pero lo harán en un futuro. ¡Te alentamos a irlos completando para estar preparado a las nuevas funcionalidades que involucren estos atributos!
- Supongamos que quieres vender un ventilador variando por los colores Marrón y Negro pero a su vez cargarle el código de barras (EAN), para eso deberás dirigirte a la API de atributos de dicha categoría para corroborar si los atributos Color y EAN poseen los tags allow_variations y variation_attribute respectivamente.

Ejemplo

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA126186/attributes
```

Respuesta:

```
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

Luego de chequear la configuración en la API de atributos, deberás crear un JSON de publicación como el siguiente.

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d
{  
   "listing_type_id":"gold_special",
   "pictures":[  
      {  
         "id":"553111-MLA20482692355_112015"
      }
   ],
   "title":"Item de testeo",
   "available_quantity":4,
   "category_id":"MLA378496",
   "buying_mode":"buy_it_now",
   "currency_id":"ARS",
   "condition":"not_specified",
   "site_id":"MLA",
   "price":100,
   "variations":[  
      {  
         "attribute_combinations":[  
            {  
               "name":"Color",
               "value_id":"52049",
               "value_name":"Negro"
            }
         ],
         "price":100,
         "available_quantity":4,
         "attributes":[  
            {  
               "id":"EAN",
               "value_name":"4006381333931"
            }
         ],
         "sold_quantity":0,
         "picture_ids":[  
            "553111-MLA20482692355_112015"
         ]
      },
      {  
         "attribute_combinations":[  
            {  
               "name":"Color",
               "value_id":"52005",
               "value_name":"Marrón"
            }
         ],
         "price":100,
         "available_quantity":4,
         "attributes":[  
            {  
               "id":"EAN",
               "value_name":"9780471117094"
            }
         ],
         "sold_quantity":0,
         "picture_ids":[  
            "553111-MLA20482692355_112015"
         ]
      }
   ]
}
http://api.mercadolibre.com/items
```

Respuesta:

```
{  
   "id":"MLA657381404",
   "site_id":"MLA",
   "title":"Item De Testeo",
   "subtitle":null,
   "seller_id":222576250,
   "category_id":"MLA378496",
   "official_store_id":null,
   "price":100,
   "base_price":100,
   "original_price":null,
   "currency_id":"ARS",
   "initial_quantity":8,
   "available_quantity":8,
   "sold_quantity":0,
   "buying_mode":"buy_it_now",
   "listing_type_id":"gold_special",
   "start_time":"2017-03-10T21:18:09.588Z",
   "stop_time":"2037-03-05T21:18:09.588Z",
   "end_time":"2037-03-05T21:18:09.588Z",
   "expiration_time":"2017-05-29T21:18:09.651Z",
   "condition":"not_specified",
   "permalink":"http://articulo.mercadolibre.com.ar/MLA-657381404-item-de-testeo-_JM",
   "thumbnail":"http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
   "secure_thumbnail":"https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
   "pictures":[  
      {  
         "id":"553111-MLA20482692355_112015",
         "url":"http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
         "secure_url":"https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
         "size":"320x320",
         "max_size":"320x320",
         "quality":""
      }
   ],
   "video_id":null,
   "descriptions":[  

   ],
   "accepts_mercadopago":true,
   "non_mercado_pago_payment_methods":[  

   ],
   "shipping":{  
      "mode":"not_specified",
      "local_pick_up":false,
      "free_shipping":false,
      "methods":[  

      ],
      "dimensions":null,
      "tags":[  
         "me2_available"
      ],
      "logistic_type":"not_specified"
   },
   "international_delivery_mode":"none",
   "seller_address":{  
      "id":189626559,
      "comment":"",
      "address_line":"santa fe 1000",
      "zip_code":"1641",
      "city":{  
         "id":"",
         "name":"Acassuso"
      },
      "state":{  
         "id":"AR-B",
         "name":"Buenos Aires"
      },
      "country":{  
         "id":"AR",
         "name":"Argentina"
      },
      "latitude":-34.4817565,
      "longitude":-58.5056779,
      "search_location":{  
         "neighborhood":{  
            "id":"TUxBQkFDQTMyNzNa",
            "name":"Acassuso"
         },
         "city":{  
            "id":"TUxBQ1NBTjg4ZmJk",
            "name":"San Isidro"
         },
         "state":{  
            "id":"TUxBUEdSQWU4ZDkz",
            "name":"Bs.As. G.B.A. Norte"
         }
      }
   },
   "seller_contact":null,
   "location":{  

   },
   "geolocation":{  
      "latitude":-34.4817565,
      "longitude":-58.5056779
   },
   "coverage_areas":[  

   ],
   "attributes":[  
      {  
         "id":"FAN_TYPE",
         "name":"Tipo de Ventilador",
         "value_id":"291719",
         "value_name":"De Techo",
         "attribute_group_id":"DFLT",
         "attribute_group_name":"Otros"
      },
      {  
         "id":"BRAND",
         "name":"Marca",
         "value_id":"86416",
         "value_name":"Eiffel",
         "attribute_group_id":"MAIN",
         "attribute_group_name":"Atributos Principales"
      }
   ],
   "warnings":[  

   ],
   "listing_source":"",
   "variations":[  
      {  
         "id":14979332589,
         "attribute_combinations":[  
            {  
               "id":"COLOR",
               "name":"Color",
               "value_id":"52049",
               "value_name":"Negro"
            }
         ],
         "price":100,
         "available_quantity":4,
         "sold_quantity":0,
         "picture_ids":[  
            "553111-MLA20482692355_112015"
         ],
         "seller_custom_field":null,
         "catalog_product_id":null,
         "attributes":[  
            {  
               "id":"EAN",
               "name":"EAN",
               "value_id":null,
               "value_name":"4006381333931"
            }
         ]
      },
      {  
         "id":14979332592,
         "attribute_combinations":[  
            {  
               "id":"COLOR",
               "name":"Color",
               "value_id":"52005",
               "value_name":"Marrón"
            }
         ],
         "price":100,
         "available_quantity":4,
         "sold_quantity":0,
         "picture_ids":[  
            "553111-MLA20482692355_112015"
         ],
         "seller_custom_field":null,
         "catalog_product_id":null,
         "attributes":[  
            {  
               "id":"EAN",
               "name":"EAN",
               "value_id":null,
               "value_name":"9780471117094"
            }
         ]
      }
   ],
   "status":"active",
   "sub_status":[  

   ],
   "tags":[  
      "immediate_payment"
   ],
   "warranty":null,
   "catalog_product_id":null,
   "domain_id":null,
   "seller_custom_field":null,
   "parent_item_id":null,
   "differential_pricing":null,
   "deal_ids":[  

   ],
   "automatic_relist":false,
   "date_created":"2017-03-10T21:18:09.763Z",
   "last_updated":"2017-03-10T21:18:09.763Z"
}
```

Notas:

- Existen propiedades obligatorias a enviar en cada variación. Las mismas son: price, available_quantity, pictures y attribute_combinations.
- La cantidad máxima de imágenes que se puede enviar por variación está definido por el campo max_pictures_per_item_var en la API de Categorias, ejemplo: https://api.mercadolibre.com/categories/MLA1577.
- Los attribute_combinations de todas las variaciones deben contener los mismos atributos, pero no deben repetirse combinaciones de valores. 
- Si se envía un atributo que no pertenece a la categoría, será ignorado, lo cual puede generar que dos variaciones queden con los mismos atributos y presentar variaciones duplicadas.
- Se permite agregar un atributo con el tag allow_variations en la propiedad attributes del ítem.
- Se permite agregar un atributo con el tag variation_attribute en la propiedad attributes del ítems.

**Ejemplo:**

- Si quieres utilizar el talle 46 que no se encuentra entre los valores posibles para el atributo Talle de la categoría MLU185734, puedes utilizarlo de todos modos como "value_name": "46", tal como se muestra a continuación:

```
	"variations": [{
		"attribute_combinations": [{
			"id": "103000",
			"value_id": "4883e91",
                        "value_struct": null,
                        "values": [
                        {
                            "id": "4883e91",
                            "name": null,
                            "struct": null
                        }
                        ]
		}, {
			"id": "11000",
			"value_id": "10295e4",
                        "values": [
                        {
                            "id": "10295e4",
                            "name": null,
                            "struct": null
                        }
                        ]
		}],
		"available_quantity": 17,
		"price": 1299.0,
		"seller_custom_field": "611111",
		"picture_ids": ["https://s-media-cache-ak0.pinimg.com/736x/63/9c/a0/639ca03b5ca79e73002b4f2d4776d03b.jpg"
		]
	}, {
		"attribute_combinations": [{
			"id": "103000",
			"value_id": "86e5356",
                        "values": [
                        {
                            "id": "86e5356",
                            "name": null,
                            "struct": null
                        }
                        ]     
		}, {
			"id": "11000",
			"value_id": "10295e4",
                        "values": [
                        {
                            "id": "10295e4",
                            "name": null,
                            "struct": null
                        }
                        ]
		}],
		"available_quantity": 12,
		"price": 1299.0,
		"seller_custom_field": "6131111",
		"picture_ids": ["https://s-media-cache-ak0.pinimg.com/736x/63/9c/a0/639ca03b5ca79e73002b4f2d4776d03b.jpg"
			]
	}, {
		"attribute_combinations": [{
			"id": "103000",
			"value_name": "46",
                        "values": [
                        {
                            "id": null,
                            "name": "46",
                            "struct": null
                        }
                        ]     
		}, {
			"id": "11000",
			"value_id": "10295e4",
                        "values": [
                        {
                            "id": "10295e4",
                            "name": null,
                            "struct": null
                        }
                        ]
		}],
		"available_quantity": 21,
		"price": 1299.0,
		"seller_custom_field": "611111",
		"picture_ids": ["https://s-media-cache-ak0.pinimg.com/736x/63/9c/a0/639ca03b5ca79e73002b4f2d4776d03b.jpg"
			]
	}]
```

Para más información te sugerimos revisar la documentación de [Atributos](https://developers.mercadolibre.com.ar/es_ar/atributos).

## Atributos requeridos

Ahora cuando realices nuevas publicaciones, deberás leer el tag **"required:true"**  para identificar los atributos que son requeridos por categoría.

Importante:

Si el atributo requerido no es enviado, recibirás como respuesta el siguiente error. (400 item.attributes.missing_required – No se envía atributo requerido).

```
{
	"message": "Validation error",
	"error": "validation_error",
	"status": 400,
	"cause": [{
		"code": "item.attributes.missing_required",
		"message": "One or more required attributes are not present in the item. Check the attribute is present in the attributes list or in the variations attributes_combination or attributes."
	}]
}
```

Notas:

- En caso que el atributo no sea requerido, el tag de required no aparecerá.
- No podrás eliminar, del ítem, atributos marcados como requeridos.
 - Para el caso del tag new_required se tendrá en cuenta la condición del item. Este es obligatorio para publicaciones nuevas y para aquellas existentes al momento de querer eliminar el atributo.

## Consultar variaciones

Existen dos formas de consultar las variantes de tu ítem, una es mirando la sección variations en la información del ítem:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA658778048?attributes=variations
```

Respuesta:

```
{
    "variations": [
        {
            "id": 15093610263,
            "attribute_combinations": [
                {
                    "id": "COLOR",
                    "name": "Color",
                    "value_id": "52000",
                    "value_name": "Naranja"
                }
            ],
            "price": 100,
            "available_quantity": 4,
            "sold_quantity": 0,
            "picture_ids": [
                "553111-MLA20482692355_112015"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null
        }
    ]
}
```

O bien con la siguiente llamada donde directamente se filtrará la respuesta anterior para mostrar únicamente las variaciones:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/variations
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA658778048/variations
```

Respuesta:

```
[
  {
    "id": 15092589430,
    "attribute_combinations": [
      {
        "id": "COLOR",
        "name": "Color",
        "value_id": "52005",
        "value_name": "Marrón"
      }
    ],
    "price": 100,
    "available_quantity": 4,
    "sold_quantity": 0,
    "picture_ids": [
      "553111-MLA20482692355_112015"
    ],
    "seller_custom_field": null,
    "catalog_product_id": null
  },
  {
    "id": 15092589427,
    "attribute_combinations": [
      {
        "id": "COLOR",
        "name": "Color",
        "value_id": "52049",
        "value_name": "Negro"
      }
    ],
    "price": 100,
    "available_quantity": 4,
    "sold_quantity": 0,
    "picture_ids": [
      "553111-MLA20482692355_112015"
    ],
    "seller_custom_field": null,
    "catalog_product_id": null
  }
]
```

Una vez que tengas los Ids de cada variación, una forma de consultar una en particular es agregando el variation_id al final de la llamada anterior tal como se muestra a continuación.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/{Item_id}/variations/{Variation_id}
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA658778048/variations/15092589430
```

Respuesta:

```
{
  "id": 15092589430,
  "attribute_combinations": [
    {
      "id": "COLOR",
      "name": "Color",
      "value_id": "52028",
      "value_name": "Celeste Oscuro"
    }
  ],
  "price": 100,
  "available_quantity": 4,
  "sold_quantity": 0,
  "picture_ids": [
    "553111-MLA20482692355_112015",
    "629425-MLA25446587248_032017"
  ],
  "seller_custom_field": null,
  "catalog_product_id": null,
  "attributes": [
    {
      "id": "EAN",
      "name": "EAN",
      "value_id": null,
      "value_name": "7794940000796"
    },
    {
      "id": "UPC",
      "name": "UPC",
      "value_id": null,
      "value_name": "7792931000015"
    }
  ]
}
```

Nota:

Para ver la propiedad attributes dentro de cada variación, debes agregar el parámetro include_attributes=all a la URL de consulta.

Ejemplo:

```
https://api.mercadolibre.com/items/MLA640992661?include_attributes=all
```

Nota:

En caso que desees consultar la sección attributes de las variaciones deberás enviar el parámetro "include_attributes=all" dentro de la llamada (https://api.mercadolibre.com/items/MLA000000?include_attributes=all).

## Agregar nuevas variaciones

Si entró en stock una nueva variante de tu ítem ya publicado, podrás agregar una nueva variación. Para hacerlo debes hacer un PUT al ítem, listando en la propiedad variations los Ids de las variaciones ya existentes, así como la variación a crear.

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
    "attribute_combinations": [
       {
          "id": "COLOR",
          "value_id": "52035"
        }
    ],
    "price": 100,
    "available_quantity": 10,
    "sold_quantity": 0,
    "picture_ids": [
      "553111-MLA20482692355_112015"
    ]
  }
https://api.mercadolibre.com/items/MLA658778048/variations
```

## Modificar variaciones

Ahora que ya aprendiste cómo publicar y consultar ítems con variaciones es posible que en algún momento debas realizar cambios a fin de actualizar stock, precios, agregar variantes de tu ítem o modificar el valor de algún atributo publicado. Siguiendo con ejemplo de Ventiladores, anteriormente te hemos mostrado cómo publicar un Ventilador que varíe por Color. Ahora imagina que además de variar por Color, quieres que varíe por Voltaje, para eso debes hacer un PUT, como el del ejemplo a continuación, enviando todas las variaciones y sumando el atributo Voltaje en el campo attribute_combinations de cada variación.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
"variations": [
    {
      "id": 15092589430,
      "attribute_combinations": [
        {
          "id": "COLOR",
          "value_id": "52005"
        },
        {
          "id": "VOLTAGE",
          "value_id": "198812"
        }
      ]
    },
    {
      "id": 15093506680,
      "attribute_combinations": [
        {
          "id": "COLOR",
          "value_id": "52035"
        },
        {
          "id": "VOLTAGE",
          "value_id": "198813"
        }
      ]
    }
  ]
}
https://api.mercadolibre.com/items/MLA658778048
```

También puede darse el caso que quieras modificar o eliminar un atributo por el que varía tu ítem, para realizar dicha acción deberás revisar que las variantes que deseas modificar no posean ventas.

Nota:

Para variantes con ventas únicamente se podrá sumar nuevos atributos sin modificar ni eliminar los existentes. 
Partiendo del ejemplo de Ventiladores, supongamos que tus Ventiladores ya no varían por Voltaje y a su vez tu Ventilador Color Violeta en realidad es de Color Violeta Oscuro, para hacer estos cambio deberás hacer un PUT, como el del ejemplo a continuación, enviando todas las variantes con el atributo Voltaje con value id y value name null para ser borrado y a su vez la variante que corresponde al color Violeta con el value_name modificado a Violeta Oscuro.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d 
{
"variations": [
    {
      "id": 15092589430,
      "attribute_combinations": [
        {
          "id": "COLOR",
          "value_id": "52005",
          "value_name": null,
          "value_struct": null,
          "values": [
           {
               "id": "52005",
               "name": null,
               "struct": null
           }
          ]
        },
        {
          "id": "VOLTAGE",
          "value_id": null,
          "value_name": null,
          "value_struct": null,
          "values": [
           {
               "id": null,
               "name": null,
               "struct": null
           }
          ]
        }
      ]
    },
    {
      "id": 15093506680,
      "attribute_combinations": [
        {
          "id": "COLOR",
          "value_id": "52035",
          "value_name": "Violeta Oscuro",
          "value_struct": null,
          "values": [
           {
               "id": "52035",
               "name": "Violeta Oscuro",
               "struct": null
           }
          ]
        },
        {
          "id": "VOLTAGE",
          "value_id": null,
          "value_name": null,
          "value_struct": null,
          "values": [
           {
               "id": null,
               "name": null,
               "struct": null
           }
          ]
         }
      ]
    }
  ]
}
https://api.mercadolibre.com/items/MLA658778048
```

Respuesta:

```
[
 {
   "id": 15092589430,
   "attribute_combinations": [
     {
       "id": "COLOR",
       "name": "Color",
       "value_id": "52005",
       "value_name": "Marrón",
       "value_struct": null,
       "values": [
           {
               "id": "52005",
               "name": "Marrón",
               "struct": null
           }
       ]
     }
   ],
   "price": 100,
   "available_quantity": 4,
   "sold_quantity": 0,
   "picture_ids": [
     "553111-MLA20482692355_112015",
     "629425-MLA25446587248_032017"
   ],
   "seller_custom_field": null,
   "catalog_product_id": null,
   "attributes": [
     {
       "id": "EAN",
       "name": "EAN",
       "value_id": null,
       "value_name": "7794940000796",
       "value_struct": null,
       "values": [
           {
               "id": null,
               "name": "7794940000796",
               "struct": null
           }
       ]
     },
     {
       "id": "UPC",
       "name": "UPC",
       "value_id": null,
       "value_name": "7792931000015",
       "value_struct": null,
       "values": [
           {
               "id": null,
               "name": "7792931000015",
               "struct": null
           }
       ]
     }
   ]
 },{
   "id": 15093506680,
   "attribute_combinations": [
     {
       "id": "COLOR",
       "name": "Color",
       "value_id": "52035",
       "value_name": "Violeta Oscuro",
       "value_struct": null,
       "values": [
           {
               "id": "52035",
               "name": "Violeta Oscuro",
               "struct": null
           }
       ]
     }
   ],
   "price": 100,
   "available_quantity": 4,
   "sold_quantity": 0,
   "picture_ids": [
     "553111-MLA20482692355_112015",
     "629425-MLA25446587248_032017"
   ],
   "seller_custom_field": null,
   "catalog_product_id": null,
   "attributes": [
     {
       "id": "EAN",
       "name": "EAN",
       "value_id": null,
       "value_name": "7794940000796",
       "value_struct": null,
       "values": [
           {
               "id": null,
               "name": "7794940000796",
               "struct": null
           }
       ]
     },
     {
       "id": "UPC",
       "name": "UPC",
       "value_id": null,
       "value_name": "7792931000015",
       "value_struct": null,
       "values": [
           {
               "id": null,
               "name": "7792931000015",
               "struct": null
           }
       ]
     }
   ]
 }
]
```

Nota:

Siempre que quieras modificar una variante, deberás enviar el ID. En caso que no lo envíes, se borrará la variante y se creará una nueva con la información incluída en el request, perdiendo así todo el histórico de ventas o generando un error si no están presentes todos los campos necesarios para la creación de la misma.

Ejemplo:

Si tienes las siguientes variantes:

```
"variations": [
        {
            "id": 30078896884,
            "attribute_combinations": [
                {
                    "id": "COLOR",
                    "name": "Color",
                    "value_id": "52014",
                    "value_name": "Verde",
                    "value_struct": null,
                    "values": [
                      {
                               "id": "52014",
                               "name": "Verde",
                               "struct": null
                      }
                    ]
                },
                {
                    "id": "SIZE",
                    "name": "Talle",
                    "value_id": null,
                    "value_name": "M",
                    "value_struct": null,
                    "values": [
                      {
                               "id": null,
                               "name": "M",
                               "struct": null
                      }
                    ]
                }
            ],
            "price": 47.81,
            "available_quantity": 2
        },
        
{
            "id": 30078896888,
            "attribute_combinations": [
                {
                    "id": "COLOR",
                    "name": "Color",
                    "value_id": "52014",
                    "value_name": "Verde",
                    "value_struct": null,
                    "values": [
                      {
                               "id": "52014",
                               "name": "Verde",
                               "struct": null
                      }
                    ]                  
                },
                {
                    "id": "SIZE",
                    "name": "Talle",
                    "value_id": null,
                    "value_name": " L",
                    "value_struct": null,
                    "values": [
                      {
                               "id": null,
                               "name": "L",
                               "struct": null
                      }
                    ]
                }
            ],
            "price": 47.81,
            "available_quantity": 2
        }
    ]
```

Y deseas modificar la variante 30078896888 y no envías su id, como en el siguiente ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d 
{
	"variations": [{
			"id": 30078896884
		},
		{
			"attribute_combinations": [{
					"id": "COLOR",
					"name": "Color",
					"value_id": "52014",
					"value_name": "Verde",
					"value_struct": null,
					"values": [{
						"id": "52014",
						"name": "Verde",
						"struct": null
					}]
				},
				{
					"id": "SIZE",
					"name": "Talle",
					"value_id": null,
					"value_name": "L",
					"value_struct": null,
					"values": [{
						"id": null,
						"name": "L",
						"struct": null
					}]
				}
			],
			"price": 47.81,
			"available_quantity": 8 - & gt;Se pretende modificar el stock
		}
	]
}
https://api.mercadolibre.com/items/$ITEM_ID
```

El request provocará la eliminación de la variante 30078896888 (dado que su ID no fue enviado) y la creación de una nueva variante con Color Verde y Talle “L” (que no tendrá relación con la eliminada, pese a tener los mismos atributos). La manera correcta de realizar la operación es:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
	"variations": [{
			"id": 30078896884
		},
		{
			"id": 30078896888,
			"available_quantity": 8 - > Se pretende modificar el stock
		}
	]
}
https://api.mercadolibre.com/items/$ITEM_ID
```

## Agregar o modificar los atributos propios de cada variación

Por otro lado, es posible que en algún momento quieras agregar más atributos propios de una o varias variaciones en particular. Siguiendo con el ejemplo de Ventiladores, hasta el momento cada variación posee la información del código de barras (EAN).

Supongamos que ahora contamos con la información de otro código de barras, el UPC, para algunas variaciones y queremos sumarlo. Para eso tenemos dos opciones, hacer un PUT, como el del ejemplo a continuación, enviando todas las variaciones pero sumando el campo attributes, en las variaciones que queremos sumar el atributo UPC.

Ejemplo

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
	"variations": [{
			"id": 23217493044
		},
		{
			"id": 23217493049,
			"attributes": [{
				"id": "PACKAGE_HEIGHT",
				"value_name": "25 cm"
			}, {
				"id": "PACKAGE_WIDTH",
				"value_name": "17 cm"
			}, {
				"id": "SELLER_SKU",
				"value_name": "Prueba3_xxx"
			}]
		}
	]
}
https://api.mercadolibre.com/items/MLM623075370
```

Respuesta:

```
{
    "id": "MLM623075370",
    "site_id": "MLM",
    "title": "Item De Prueba - No Ofertar",
    "subtitle": null,
    "seller_id": 310695640,
    "category_id": "MLM174913",
    "official_store_id": null,
    "price": 1,
    "base_price": 1,
    "original_price": null,
    "currency_id": "MXN",
    "initial_quantity": 2,
    "available_quantity": 2,
    "sold_quantity": 0,
    "sale_terms": [],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_pro",
    "start_time": "2018-04-24T16:43:02.000Z",
    "historical_start_time": "2018-04-24T16:43:02.000Z",
    "stop_time": "2038-04-19T04:00:00.000Z",
    "end_time": "2038-04-19T04:00:00.000Z",
    "expiration_time": "2018-07-13T17:01:35.847Z",
    "condition": "new",
    "permalink": "http://articulo.mercadolibre.com.mx/MLM-623075370-item-de-prueba-no-ofertar-_JM",
    "thumbnail": "http://mlm-s1-p.mlstatic.com/965478-MLM27243332493_042018-I.jpg",
    "secure_thumbnail": "https://mlm-s1-p.mlstatic.com/965478-MLM27243332493_042018-I.jpg",
    "pictures": [
        {
            "id": "965478-MLM27243332493_042018",
            "url": "http://mlm-s1-p.mlstatic.com/965478-MLM27243332493_042018-O.jpg",
            "secure_url": "https://mlm-s1-p.mlstatic.com/965478-MLM27243332493_042018-O.jpg",
            "size": "500x500",
            "max_size": "1000x1000",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": true,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": "not_specified",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 855164029,
        "comment": "",
        "address_line": "Test Address 123",
        "zip_code": "",
        "city": {
            "id": "",
            "name": "Ciudad de Mexico"
        },
        "state": {
            "id": "MX-DIF",
            "name": "Distrito Federal"
        },
        "country": {
            "id": "MX",
            "name": "Mexico"
        },
        "latitude": "",
        "longitude": "",
        "search_location": {
            "neighborhood": {
                "id": "",
                "name": ""
            },
            "city": {
                "id": "",
                "name": ""
            },
            "state": {
                "id": "TUxNUERJUzYwOTQ",
                "name": "Distrito Federal"
            }
        }
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": "",
        "longitude": ""
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": null,
            "value_name": "Mosaic",
            "value_struct": null,
            "attribute_group_id": "OTHERS",
            "attribute_group_name": "Otros"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": null,
            "value_name": "ROHO",
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
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [
        {
            "id": 23217493044,
            "attribute_combinations": [
                {
                    "id": null,
                    "name": "Tamaño",
                    "value_id": null,
                    "value_name": "16\" x 16\" (40 x 40 cm)",
                    "value_struct": null
                }
            ],
            "price": 1,
            "available_quantity": 1,
            "sold_quantity": 0,
            "sale_terms": [],
            "picture_ids": [
                "965478-MLM27243332493_042018"
            ],
            "seller_custom_field": "Datos_interno_variacion_xxxx",
            "catalog_product_id": null,
            "attributes": [
                {
                    "id": "SELLER_SKU",
                    "name": "SKU ",
                    "value_id": null,
                    "value_name": "Prueba-xxx",
                    "value_struct": null
                }
            ]
        },
        {
            "id": 23217493049,
            "attribute_combinations": [
                {
                    "id": null,
                    "name": "Tamaño",
                    "value_id": null,
                    "value_name": "18\" x 18\" (45 x 45 cm)",
                    "value_struct": null
                }
            ],
            "price": 1,
            "available_quantity": 1,
            "sold_quantity": 0,
            "sale_terms": [],
            "picture_ids": [
                "965478-MLM27243332493_042018"
            ],
            "seller_custom_field": "Datos_interno_variacion_xxxx1",
            "catalog_product_id": null,
            "attributes": [
                {
                    "id": "PACKAGE_HEIGHT",
                    "name": "Altura del paquete",
                    "value_id": null,
                    "value_name": "25 cm",
                    "value_struct": {
                        "unit": "cm",
                        "number": 25
                    }
                },
                {
                    "id": "PACKAGE_WIDTH",
                    "name": "Ancho del paquete",
                    "value_id": null,
                    "value_name": "17 cm",
                    "value_struct": {
                        "unit": "cm",
                        "number": 17
                    }
                },
                {
                    "id": "SELLER_SKU",
                    "name": "SKU ",
                    "value_id": null,
                    "value_name": "Prueba3_xxx",
                    "value_struct": null
                }
            ]
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "test_item",
        "good_quality_picture",
        "immediate_payment"
    ],
    "warranty": "1 Año de garantia directamente con nosotros contra defectos de fabrica y mal funcionamiento.\n12 meses.",
    "catalog_product_id": null,
    "domain_id": null,
    "seller_custom_field": "Datos_interno_item",
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2018-04-24T16:43:02.000Z",
    "last_updated": "2018-04-24T17:01:35.883Z",
    "total_listing_fee"
```

También puede darse el caso que quieras modificar el valor de un atributo propio de cada variación. Supongamos que queremos modificar el valor del atributo EAN de una variación en particular. Para eso, debes hacer un PUT como el del ejemplo a continuación, especificando la variación que quieres modificar. En el campo attributes deberás enviar todos los atributos y para el EAN, el campo value_name modificado. No olvides enviar el ID del resto de las variantes que no desees modificar para evitar que las mismas sean borradas.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
   "variations":[
      {
         "id":"15092589430",
         "attributes":[
            {
               "id":"EAN",
               "name":"EAN",
               "value_name":"7792931000015",
               "value_struct": null,
                    "values": [
                      {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                      }
                    ]

            },
            {
               "id":"GTIN",
               "name":"GTIN",
               "value_name":"7792931000015",
               "value_struct": null,
                    "values": [
                      {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                      }
                 ]
            }
         ]
      }
   ]
}
https://api.mercadolibre.com/items/MLA658778048
```

Respuesta:

```
{
    "id": "MLA658778048",
    "site_id": "MLA",
    "title": "Item De Testeo",
    "subtitle": null,
    "seller_id": 247212006,
    "category_id": "MLA378496",
    "official_store_id": null,
    "price": 100,
    "base_price": 100,
    "original_price": null,
    "currency_id": "ARS",
    "initial_quantity": 4,
    "available_quantity": 4,
    "sold_quantity": 0,
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2017-03-20T15:44:00.000Z",
    "stop_time": "2037-03-15T15:44:00.000Z",
    "end_time": "2037-03-15T15:44:00.000Z",
    "expiration_time": "2017-06-17T14:55:54.306Z",
    "condition": "not_specified",
    "permalink": "http://articulo.mercadolibre.com.ar/MLA-658778048-item-de-testeo-_JM",
    "thumbnail": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "secure_thumbnail": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "pictures": [
        {
            "id": "553111-MLA20482692355_112015",
            "url": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "size": "320x320",
            "max_size": "320x320",
            "quality": ""
        },
        {
            "id": "629425-MLA25446587248_032017",
            "url": "http://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "size": "384x500",
            "max_size": "922x1200",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": null,
        "dimensions": null,
        "tags": [],
        "logistic_type": "not_specified"
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 265953311,
        "comment": "",
        "address_line": "Test Address 123",
        "zip_code": "1414",
        "city": {
            "id": "",
            "name": "Palermo"
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
                "id": "TUxBQlBBTDI1MTVa",
                "name": "Palermo"
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
        "latitude": "",
        "longitude": ""
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "FAN_TYPE",
            "name": "Tipo de Ventilador",
            "value_id": "291719",
            "value_name": "De Techo",
            "value_struct": null,
            "values": [
             {
                      "id": "291719",
                      "name": "De Techo",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "HEIGHT_ADJUSTABLE",
            "name": "Altura Regulable",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "LATERAL_OSCILLATION",
            "name": "Oscilación Lateral",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "REMOTE_CONTROL",
            "name": "Control Remoto",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "WITH_LIGHT",
            "name": "Con Luz",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "86416",
            "value_name": "Eiffel",
            "value_struct": null,
            "values": [
             {
                      "id": "86416",
                      "name": "Eiffel",
                      "struct": null
             }
             ],
            "attribute_group_id": "MAIN",
            "attribute_group_name": "Atributos Principales"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [
        {
            "id": 15092589430,
            "attribute_combinations": [
                {
                    "id": "COLOR",
                    "name": "Color",
                    "value_id": "52005",
                    "value_name": "Marrón",
                    "value_struct": null,
                    "values": [
                     {
                               "id": "52005",
                               "name": "Marrón",
                               "struct": null
                     }
                     ]
                },
                {
                    "id": "VOLTAGE",
                    "name": "Voltaje",
                    "value_id": "198812",
                    "value_name": "110V/220V (Bivolt)",
                    "value_struct": null,
                    "values": [
                     {
                               "id": "198812",
                               "name": "110V/220V (Bivolt)",
                               "struct": null
                     }
                     ]

                }
            ],
            "price": 100,
            "available_quantity": 4,
            "sold_quantity": 0,
            "picture_ids": [
                "553111-MLA20482692355_112015",
                "629425-MLA25446587248_032017"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "attributes": [
                {
                    "id": "GTIN",
                    "name": "GTIN",
                    "value_id": null,
                    "value_name": "7792931000015",
                    "value_struct": null,
                    "values": [
                     {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                     }
                     ]
                },
                {
                    "id": "EAN",
                    "name": "EAN",
                    "value_id": null,
                    "value_name": "7792931000015",
                    "value_struct": null,
                    "values": [
                     {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                     }
                     ]
                }
            ]
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "poor_quality_picture",
        "immediate_payment"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLA-FANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2017-03-20T15:44:01.000Z",
    "last_updated": "2017-03-29T14:55:54.337Z"
}
```

También puede darse el caso que quieras modificar el valor de un atributo propio de cada variación. Supongamos que queremos modificar el valor del atributo EAN de una variación en particular. Para eso debes hacer un PUT, como el del ejemplo a continuación, especificando la variación que quieres modificar y en el campo attributes deberás enviar todos los atributos y para el atributo EAN el campo value_name modificado.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
   "variations":[
      {
         "id":"15092589430",
         "attributes":[
            {
               "id":"EAN",
               "name":"EAN",
               "value_name":"7792931000015",
               "value_struct": null,
                    "values": [
                      {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                      }
                    ]

            },
            {
               "id":"UPC",
               "name":"UPC",
               "value_name":"7792931000015",
               "value_struct": null,
                    "values": [
                      {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                      }
                 ]
            }
         ]
      }
   ]
}
https://api.mercadolibre.com/items/MLA658778048
```

Respuesta:

```
{
    "id": "MLA658778048",
    "site_id": "MLA",
    "title": "Item De Testeo",
    "subtitle": null,
    "seller_id": 247212006,
    "category_id": "MLA378496",
    "official_store_id": null,
    "price": 100,
    "base_price": 100,
    "original_price": null,
    "currency_id": "ARS",
    "initial_quantity": 4,
    "available_quantity": 4,
    "sold_quantity": 0,
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2017-03-20T15:44:00.000Z",
    "stop_time": "2037-03-15T15:44:00.000Z",
    "end_time": "2037-03-15T15:44:00.000Z",
    "expiration_time": "2017-06-17T14:55:54.306Z",
    "condition": "not_specified",
    "permalink": "http://articulo.mercadolibre.com.ar/MLA-658778048-item-de-testeo-_JM",
    "thumbnail": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "secure_thumbnail": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "pictures": [
        {
            "id": "553111-MLA20482692355_112015",
            "url": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "size": "320x320",
            "max_size": "320x320",
            "quality": ""
        },
        {
            "id": "629425-MLA25446587248_032017",
            "url": "http://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "size": "384x500",
            "max_size": "922x1200",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": null,
        "dimensions": null,
        "tags": [],
        "logistic_type": "not_specified"
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 265953311,
        "comment": "",
        "address_line": "Test Address 123",
        "zip_code": "1414",
        "city": {
            "id": "",
            "name": "Palermo"
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
                "id": "TUxBQlBBTDI1MTVa",
                "name": "Palermo"
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
        "latitude": "",
        "longitude": ""
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "FAN_TYPE",
            "name": "Tipo de Ventilador",
            "value_id": "291719",
            "value_name": "De Techo",
            "value_struct": null,
            "values": [
             {
                      "id": "291719",
                      "name": "De Techo",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "HEIGHT_ADJUSTABLE",
            "name": "Altura Regulable",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "LATERAL_OSCILLATION",
            "name": "Oscilación Lateral",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "REMOTE_CONTROL",
            "name": "Control Remoto",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "WITH_LIGHT",
            "name": "Con Luz",
            "value_id": "242084",
            "value_name": "No",
            "value_struct": null,
            "values": [
             {
                      "id": "242084",
                      "name": "No",
                      "struct": null
             }
             ],
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "86416",
            "value_name": "Eiffel",
            "value_struct": null,
            "values": [
             {
                      "id": "86416",
                      "name": "Eiffel",
                      "struct": null
             }
             ],
            "attribute_group_id": "MAIN",
            "attribute_group_name": "Atributos Principales"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [
        {
            "id": 15092589430,
            "attribute_combinations": [
                {
                    "id": "COLOR",
                    "name": "Color",
                    "value_id": "52005",
                    "value_name": "Marrón",
                    "value_struct": null,
                    "values": [
                     {
                               "id": "52005",
                               "name": "Marrón",
                               "struct": null
                     }
                     ]
                },
                {
                    "id": "VOLTAGE",
                    "name": "Voltaje",
                    "value_id": "198812",
                    "value_name": "110V/220V (Bivolt)",
                    "value_struct": null,
                    "values": [
                     {
                               "id": "198812",
                               "name": "110V/220V (Bivolt)",
                               "struct": null
                     }
                     ]

                }
            ],
            "price": 100,
            "available_quantity": 4,
            "sold_quantity": 0,
            "picture_ids": [
                "553111-MLA20482692355_112015",
                "629425-MLA25446587248_032017"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "attributes": [
                {
                    "id": "GTIN",
                    "name": "GTIN",
                    "value_id": null,
                    "value_name": "7792931000015",
                    "value_struct": null,
                    "values": [
                     {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                     }
                     ]
                },
                {
                    "id": "UPC",
                    "name": "UPC",
                    "value_id": null,
                    "value_name": "7792931000015",
                    "value_struct": null,
                    "values": [
                     {
                               "id": null,
                               "name": "7792931000015",
                               "struct": null
                     }
                     ]
                }
            ]
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "poor_quality_picture",
        "immediate_payment"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLA-FANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2017-03-20T15:44:01.000Z",
    "last_updated": "2017-03-29T14:55:54.337Z"
}
```

Nota:

En caso de no querer conservar las imágenes anteriores, no las envíes en el Json y serán desvinculadas automáticamente.

## Modificar el precio

Si deseas modificar el precio de un ítem con variaciones, deberás realizar un PUT enviando el mismo precio en todos los IDs correspondientes a las variantes.

Nota:

En caso que envíes precios diferentes recibirás un error en la respuesta y no se actualizará la información.

En caso de no enviar todos los IDs de las variaciones, se borrarán del ítem aquellas que no hayan sido envIadas al momento de hacer el PUT.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
	"variations": [{
			"id": 15092589430,
			"price": 300
		},
		{
			"id": 15092544559,
			"price": 300
		},
		{
			"id": 15091378470,
			"price": 300
		}
	]
}
https://api.mercadolibre.com/items/MLA658778048
```

## Modificar el stock

Análogamente a la modificación de precio, solo basta con hacer un PUT a la API de ítems, incluyendo la propiedad variations, listando cada una de ellas con su id, y el nuevo available_quantity de aquellas variaciones que desees modificar stock.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
	"variations": [{
		"id": 15092589430,
		"available_quantity": 10
	}]
}
https://api.mercadolibre.com/items/MLA658778048
```

Respuesta:

```
{
    "id": "MLA658778048",
    "site_id": "MLA",
    "title": "Item De Testeo",
    "subtitle": null,
    "seller_id": 247212006,
    "category_id": "MLA378496",
    "official_store_id": null,
    "price": 100,
    "base_price": 100,
    "original_price": null,
    "currency_id": "ARS",
    "initial_quantity": 10,
    "available_quantity": 10,
    "sold_quantity": 0,
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2017-03-20T15:44:00.000Z",
    "stop_time": "2037-03-15T15:44:00.000Z",
    "end_time": "2037-03-15T15:44:00.000Z",
    "expiration_time": "2017-06-17T15:00:27.592Z",
    "condition": "not_specified",
    "permalink": "http://articulo.mercadolibre.com.ar/MLA-658778048-item-de-testeo-_JM",
    "thumbnail": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "secure_thumbnail": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "pictures": [
        {
            "id": "553111-MLA20482692355_112015",
            "url": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "size": "320x320",
            "max_size": "320x320",
            "quality": ""
        },
        {
            "id": "629425-MLA25446587248_032017",
            "url": "http://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "size": "384x500",
            "max_size": "922x1200",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": null,
        "dimensions": null,
        "tags": [],
        "logistic_type": "not_specified"
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 265953311,
        "comment": "",
        "address_line": "Test Address 123",
        "zip_code": "1414",
        "city": {
            "id": "",
            "name": "Palermo"
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
                "id": "TUxBQlBBTDI1MTVa",
                "name": "Palermo"
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
        "latitude": "",
        "longitude": ""
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "FAN_TYPE",
            "name": "Tipo de Ventilador",
            "value_id": "291719",
            "value_name": "De Techo",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "HEIGHT_ADJUSTABLE",
            "name": "Altura Regulable",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "LATERAL_OSCILLATION",
            "name": "Oscilación Lateral",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "REMOTE_CONTROL",
            "name": "Control Remoto",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "WITH_LIGHT",
            "name": "Con Luz",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "86416",
            "value_name": "Eiffel",
            "attribute_group_id": "MAIN",
            "attribute_group_name": "Atributos Principales"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [
        {
            "id": 15092589430,
            "attribute_combinations": [
                {
                    "id": "COLOR",
                    "name": "Color",
                    "value_id": "52005",
                    "value_name": "Marrón"
                },
                {
                    "id": "VOLTAGE",
                    "name": "Voltaje",
                    "value_id": "198812",
                    "value_name": "110V/220V (Bivolt)"
                }
            ],
            "price": 100,
            "available_quantity": 10,
            "sold_quantity": 0,
            "picture_ids": [
                "629425-MLA25446587248_032017"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "attributes": [
                {
                    "id": "EAN",
                    "name": "EAN",
                    "value_id": null,
                    "value_name": "7792931000015"
                },
                {
                    "id": "UPC",
                    "name": "UPC",
                    "value_id": null,
                    "value_name": "7792931000015"
                }
            ]
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "poor_quality_picture",
        "immediate_payment"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLA-FANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2017-03-20T15:44:01.000Z",
    "last_updated": "2017-03-29T15:00:27.650Z"
}
```

## Trabajar con imágenes en variaciones

Para que se vean las distintas imágenes de cada variación, es importante tener en cuenta que el atributo que las determina es aquel que tiene el tag defines_picture: true. Todas las variaciones que compartan el mismo valor en el atributo con el tag define_picture deben tener siempre las mismas imágenes.

Ejemplo:

- rojo/32 y rojo/28 deben tener las mismas imágenes

- rojo/32 y verde/32 deben tener distintas imágenes

Es decir:

- Todas las variaciones con el mismo value en el atributo con el tag “defines_picture” tienen que tener las mismas imágenes.

- Todas las variaciones con distinto value en el atributo con el tag “defines_picture” tienen que tener distintas imágenes.

- Todas las variaciones tienen que tener una imagen asociada.

- Teniendo en cuenta los puntos anteriores, también lograrás que se vean correctamente las imágenes en miniatura.

## Modificar las imágenes

Si quieres agregar una imagen a una variación existente deberás enviar la URL o el picture_id, si ya se encuentra cargada la imagen, en la lista de pictures general del ítem y en el de pictures de la variación. Al mismo tiempo, como la actualización se hará sobre el recurso de ítems, es importante que envíes los IDs de cada variación existente en el Json. De lo contrario la API interpretará que no deseas conservarlas en la publicación.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d
{
	"pictures": [{
			"source": "http://www.apertura.com/export/sites/revistaap/img/Tecnologia/Logo_ML_NUEVO.jpg_33442984.jpg"
		},
		{
			"source": "http://static.ellahoy.es/ellahoy/fotogallery/1200X0/371265/falda-plisada-rosa.jpg"
		},
		{
			"id": "553111-MLA20482692355_112015"
		},
		{
			"id": "629425-MLA25446587248_032017"
		}
	],
	"variations": [{
			"id": 18200178910,
			"picture_ids": [
				"http://static.ellahoy.es/ellahoy/fotogallery/1200X0/371265/falda-plisada-rosa.jpg",
				"553111-MLA20482692355_112015"
			]
		},
		{
			"id": 18200178913,
			"picture_ids": [
				"http://www.apertura.com/export/sites/revistaap/img/Tecnologia/Logo_ML_NUEVO.jpg_33442984.jpg",
				"629425-MLA25446587248_032017"
			]
		}
	]
}
https://api.mercadolibre.com/items/MLA658778048
```

Respuesta:

```
{
    "id": "MLA689372871",
    "site_id": "MLA",
    "title": "Test Item - No Ofertar",
    "subtitle": null,
    "seller_id": 235461680,
    "category_id": "MLA374515",
    "official_store_id": null,
    "price": 200,
    "base_price": 200,
    "original_price": null,
    "currency_id": "ARS",
    "initial_quantity": 2,
    "available_quantity": 2,
    "sold_quantity": 0,
    "sale_terms": [],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2017-10-26T13:03:44.000Z",
    "historical_start_time": "2017-10-26T13:03:44.000Z",
    "stop_time": "2037-10-21T13:03:44.000Z",
    "end_time": "2037-10-21T13:03:44.000Z",
    "expiration_time": "2018-01-14T16:32:57.725Z",
    "condition": "new",
    "permalink": "http://articulo.mercadolibre.com.ar/MLA-689372871-test-item-no-ofertar-_JM",
    "thumbnail": "http://mla-s1-p.mlstatic.com/942947-MLA26244780225_102017-I.jpg",
    "secure_thumbnail": "https://mla-s1-p.mlstatic.com/942947-MLA26244780225_102017-I.jpg",
    "pictures": [
        {
            "id": "942947-MLA26244780225_102017",
            "url": "http://mla-s1-p.mlstatic.com/942947-MLA26244780225_102017-O.jpg",
            "secure_url": "https://mla-s1-p.mlstatic.com/942947-MLA26244780225_102017-O.jpg",
            "size": "500x228",
            "max_size": "625x285",
            "quality": ""
        },
        {
            "id": "837548-MLA26244864461_102017",
            "url": "http://www.mercadolibre.com/jm/img?s=STC&v=O&f=proccesing_image_es.jpg",
            "secure_url": "https://www.mercadolibre.com/jm/img?s=STC&v=O&f=proccesing_image_es.jpg",
            "size": "500x500",
            "max_size": "500x500",
            "quality": ""
        },
        {
            "id": "553111-MLA20482692355_112015",
            "url": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "size": "320x320",
            "max_size": "320x320",
            "quality": ""
        },
        {
            "id": "629425-MLA25446587248_032017",
            "url": "http://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "size": "384x500",
            "max_size": "922x1200",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [
        {
            "id": "MLA689372871-1476963486"
        }
    ],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [
            "me2_available"
        ],
        "logistic_type": "not_specified",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 206175834,
        "comment": "",
        "address_line": "sssss 111",
        "zip_code": "5000",
        "city": {
            "id": "",
            "name": "Cordoba"
        },
        "state": {
            "id": "AR-X",
            "name": "Córdoba"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": -32.8224655,
        "longitude": -63.8666332,
        "search_location": {
            "neighborhood": {
                "id": "",
                "name": ""
            },
            "city": {
                "id": "TUxBQ0NBUGNiZGQx",
                "name": "Córdoba"
            },
            "state": {
                "id": "TUxBUENPUmFkZGIw",
                "name": "Córdoba"
            }
        }
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -32.8224655,
        "longitude": -63.8666332
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "GENDER",
            "name": "Género",
            "value_id": "female",
            "value_name": "Mujer",
            "value_struct": null,
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "Season",
            "name": "Season",
            "value_id": "Season-All-Season",
            "value_name": "All-Season",
            "value_struct": null,
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [
        {
            "id": 18200178910,
            "attribute_combinations": [
                {
                    "id": "83000",
                    "name": "Color Primario",
                    "value_id": "92028",
                    "value_name": "Blanco",
                    "value_struct": null
                },
                {
                    "id": "93000",
                    "name": "Talle",
                    "value_id": "101994",
                    "value_name": "S",
                    "value_struct": null
                }
            ],
            "price": 200,
            "available_quantity": 1,
            "sold_quantity": 0,
            "sale_terms": [],
            "picture_ids": [
                "837548-MLA26244864461_102017",
                "553111-MLA20482692355_112015"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "attributes": []
        },
        {
            "id": 18200178913,
            "attribute_combinations": [
                {
                    "id": "83000",
                    "name": "Color Primario",
                    "value_id": "91994",
                    "value_name": "Rosa",
                    "value_struct": null
                },
                {
                    "id": "93000",
                    "name": "Talle",
                    "value_id": "101995",
                    "value_name": "M",
                    "value_struct": null
                }
            ],
            "price": 200,
            "available_quantity": 1,
            "sold_quantity": 0,
            "sale_terms": [],
            "picture_ids": [
                "942947-MLA26244780225_102017",
                "629425-MLA25446587248_032017"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "attributes": []
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "test_item",
        "only_html_description",
        "good_quality_thumbnail",
        "unknown_quality_picture",
        "immediate_payment"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": null,
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2017-10-26T13:03:44.000Z",
    "last_updated": "2017-10-26T16:32:57.945Z",
    "total_listing_fee": null
}
```

Notas:

En caso de no querer conservar las imágenes anteriores, no las envíes en el Json y serán desvinculadas automáticamente.

## Eliminar variaciones

Si deseas eliminar una variación podrás hacerlo tal como se muestra en el siguiente ejemplo.

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA599099879/variations/10449631060
```

Respuesta:

```
{
    "id": "MLA658778048",
    "site_id": "MLA",
    "title": "Item De Testeo",
    "subtitle": null,
    "seller_id": 247212006,
    "category_id": "MLA378496",
    "official_store_id": null,
    "price": 300,
    "base_price": 300,
    "original_price": null,
    "currency_id": "ARS",
    "initial_quantity": 8,
    "available_quantity": 8,
    "sold_quantity": 0,
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2017-03-20T15:44:00.000Z",
    "stop_time": "2037-03-15T15:44:00.000Z",
    "end_time": "2037-03-15T15:44:00.000Z",
    "expiration_time": "2017-06-17T15:03:02.000Z",
    "condition": "not_specified",
    "permalink": "http://articulo.mercadolibre.com.ar/MLA-658778048-item-de-testeo-_JM",
    "thumbnail": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "secure_thumbnail": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
    "pictures": [
        {
            "id": "553111-MLA20482692355_112015",
            "url": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
            "size": "320x320",
            "max_size": "320x320",
            "quality": ""
        },
        {
            "id": "629425-MLA25446587248_032017",
            "url": "http://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "secure_url": "https://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
            "size": "384x500",
            "max_size": "922x1200",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": null,
        "dimensions": null,
        "tags": [],
        "logistic_type": "not_specified"
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 265953311,
        "comment": "",
        "address_line": "Test Address 123",
        "zip_code": "1414",
        "city": {
            "id": "",
            "name": "Palermo"
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
                "id": "TUxBQlBBTDI1MTVa",
                "name": "Palermo"
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
        "latitude": "",
        "longitude": ""
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "FAN_TYPE",
            "name": "Tipo de Ventilador",
            "value_id": "291719",
            "value_name": "De Techo",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "HEIGHT_ADJUSTABLE",
            "name": "Altura Regulable",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "LATERAL_OSCILLATION",
            "name": "Oscilación Lateral",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "REMOTE_CONTROL",
            "name": "Control Remoto",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "WITH_LIGHT",
            "name": "Con Luz",
            "value_id": "242084",
            "value_name": "No",
            "attribute_group_id": "DFLT",
            "attribute_group_name": "Otros"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "86416",
            "value_name": "Eiffel",
            "attribute_group_id": "MAIN",
            "attribute_group_name": "Atributos Principales"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [
        {
            "id": 15092589430,
            "attribute_combinations": [
                {
                    "id": "COLOR",
                    "name": "Color",
                    "value_id": "52005",
                    "value_name": "Marrón"
                },
                {
                    "id": "VOLTAGE",
                    "name": "Voltaje",
                    "value_id": "198812",
                    "value_name": "110V/220V (Bivolt)"
                }
            ],
            "price": 300,
            "available_quantity": 8,
            "sold_quantity": 0,
            "picture_ids": [
                "629425-MLA25446587248_032017"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "attributes": [
                {
                    "id": "EAN",
                    "name": "EAN",
                    "value_id": null,
                    "value_name": "7792931000015"
                },
                {
                    "id": "UPC",
                    "name": "UPC",
                    "value_id": null,
                    "value_name": "7792931000015"
                }
            ]
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "poor_quality_picture",
        "immediate_payment"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLA-FANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2017-03-20T15:44:01.000Z",
    "last_updated": "2017-03-29T15:04:20.999Z"
}
```

Como puedes ver, eliminamos la variación 10449631060 y conservamos las variaciones 10449631063 y 10449631067. Otra forma de eliminar variaciones, es enviando un PUT a la API de ítems con la propiedad variations, listando únicamente los Ids de las variaciones que deseamos mantener.

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' https://api.mercadolibre.com/items/MLA658778048/variations/15092589430
```

## Característica personalizada

Si bien para una gran cantidad de categorías hay identificados atributos por los cuales puedes variar tu ítem, posiblemente necesites generar variantes por características personalizadas no definidas en la API de atributos por categoría. Por ejemplo, un vendedor de fundas de teléfonos celulares puede querer variar su ítem por el “Diseño”, para poder así ofrecer en una misma publicación las variantes Flamenco, Cocodrilo y Búho. Como la categoría no tiene este atributo definido, podemos enviar la característica personalizada en el attribute_combinations de la variación.

### Consideraciones

- A la hora de publicar un ítem con características personalizadas deberás asegurarte que los atributos en la categoría donde deseas publicar, son distintos a aquellos que deseas agregar.

- Solo podrás varíar tu ítem por una única característica personalizada.

- Las características personalizadas deberán estar dentro de la sección attribute_combinations en variations.

## Publicar y modificar ítems con variaciones con características personalizadas

Agregar o modificar los atributos personalizados es análogo a hacerlo con los definidos en la API de atributos por categoría. Simplemente, debes especificar el name del atributo y el value_name del valor a cargar. Recuerda ser consistente con el name definido para el atributo, y modifica su value_name de la misma forma que lo harías con cualquier otro. El name del atributo es lo que verán los compradores en la VIP. Para el ejemplo anterior, el name que utilizaremos es “Diseño”.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN'  -H 'Content-Type: application/json' -d
{
	"variations": [{
			"attribute_combinations": [{
				"name": "Diseño",
				"value_name": "Buho",
				"value_struct": null,
				"values": [{
					"id": null,
					"name": "Buho",
					"struct": null
				}]
			}],
			"price": 100,
			"available_quantity": 10
		},
		{
			"attribute_combinations": [{
				"name": "Diseño",
				"value_name": "Flamenco",
				"value_struct": null,
				"values": [{
					"id": null,
					"name": "Flamenco",
					"struct": null
				}]
			}],
			"price": 100,
			"available_quantity": 10
		},
		{
			"attribute_combinations": [{
				"name": "Diseño",
				"value_name": "Cocodrilo",
				"value_struct": null,
				"values": [{
					"id": null,
					"name": "Cocodrilo",
					"struct": null
				}]
			}],
			"price": 100,
			"available_quantity": 10
		}
	]
}
https://api.mercadolibre.com/items/MLA658778048
```

Respuesta:

```
{
	"id": "MLA658778048",
	"site_id": "MLA",
	"title": "Item De Testeo",
	"subtitle": null,
	"seller_id": 247212006,
	"category_id": "MLA378496",
	"official_store_id": null,
	"price": 100,
	"base_price": 100,
	"original_price": null,
	"currency_id": "ARS",
	"initial_quantity": 30,
	"available_quantity": 30,
	"sold_quantity": 0,
	"buying_mode": "buy_it_now",
	"listing_type_id": "gold_special",
	"start_time": "2017-03-20T15:44:00.000Z",
	"stop_time": "2037-03-15T15:44:00.000Z",
	"end_time": "2037-03-15T15:44:00.000Z",
	"expiration_time": "2017-06-26T16:55:52.935Z",
	"condition": "not_specified",
	"permalink": "http://articulo.mercadolibre.com.ar/MLA-658778048-item-de-testeo-_JM",
	"thumbnail": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
	"secure_thumbnail": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-I.jpg",
	"pictures": [{
			"id": "553111-MLA20482692355_112015",
			"url": "http://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
			"secure_url": "https://mla-s2-p.mlstatic.com/553111-MLA20482692355_112015-O.jpg",
			"size": "320x320",
			"max_size": "320x320",
			"quality": ""
		},
		{
			"id": "629425-MLA25446587248_032017",
			"url": "http://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
			"secure_url": "https://mla-s2-p.mlstatic.com/629425-MLA25446587248_032017-O.jpg",
			"size": "384x500",
			"max_size": "922x1200",
			"quality": ""
		}
	],
	"video_id": null,
	"descriptions": [],
	"accepts_mercadopago": true,
	"non_mercado_pago_payment_methods": [],
	"shipping": {
		"mode": "not_specified",
		"local_pick_up": false,
		"free_shipping": false,
		"methods": null,
		"dimensions": null,
		"tags": [],
		"logistic_type": "not_specified"
	},
	"international_delivery_mode": "none",
	"seller_address": {
		"id": 265953311,
		"comment": "",
		"address_line": "Test Address 123",
		"zip_code": "1414",
		"city": {
			"id": "",
			"name": "Palermo"
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
				"id": "TUxBQlBBTDI1MTVa",
				"name": "Palermo"
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
		"latitude": "",
		"longitude": ""
	},
	"coverage_areas": [],
	"attributes": [{
			"id": "FAN_TYPE",
			"name": "Tipo de Ventilador",
			"value_id": "291719",
			"value_name": "De Techo",
			"attribute_group_id": "DFLT",
			"attribute_group_name": "Otros"
		},
		{
			"id": "HEIGHT_ADJUSTABLE",
			"name": "Altura Regulable",
			"value_id": "242084",
			"value_name": "No",
			"attribute_group_id": "DFLT",
			"attribute_group_name": "Otros"
		},
		{
			"id": "REMOTE_CONTROL",
			"name": "Control Remoto",
			"value_id": "242084",
			"value_name": "No",
			"attribute_group_id": "DFLT",
			"attribute_group_name": "Otros"
		},
		{
			"id": "WITH_LIGHT",
			"name": "Con Luz",
			"value_id": "242084",
			"value_name": "No",
			"attribute_group_id": "DFLT",
			"attribute_group_name": "Otros"
		},
		{
			"id": "BRAND",
			"name": "Marca",
			"value_id": "86416",
			"value_name": "Eiffel",
			"attribute_group_id": "MAIN",
			"attribute_group_name": "Atributos Principales"
		}
	],
	"warnings": [],
	"listing_source": "",
	"variations": [{
			"id": 15311871917,
			"attribute_combinations": [{
				"id": null,
				"name": "Diseño",
				"value_id": null,
				"value_name": "Buho"
			}],
			"price": 100,
			"available_quantity": 10,
			"sold_quantity": 0,
			"picture_ids": [],
			"seller_custom_field": null,
			"catalog_product_id": null,
			"attributes": []
		},
		{
			"id": 15313572235,
			"attribute_combinations": [{
				"id": null,
				"name": "Diseño",
				"value_id": null,
				"value_name": "Flamenco"
			}],
			"price": 100,
			"available_quantity": 10,
			"sold_quantity": 0,
			"picture_ids": [],
			"seller_custom_field": null,
			"catalog_product_id": null,
			"attributes": []
		},
		{
			"id": 15313572237,
			"attribute_combinations": [{
				"id": null,
				"name": "Diseño",
				"value_id": null,
				"value_name": "Cocodrilo"
			}],
			"price": 100,
			"available_quantity": 10,
			"sold_quantity": 0,
			"picture_ids": [],
			"seller_custom_field": null,
			"catalog_product_id": null,
			"attributes": []
		}
	],
	"status": "active",
	"sub_status": [],
	"tags": [
		"poor_quality_picture",
		"immediate_payment"
	],
	"warranty": null,
	"catalog_product_id": null,
	"domain_id": "MLA-FANS",
	"seller_custom_field": null,
	"parent_item_id": null,
	"differential_pricing": null,
	"deal_ids": [],
	"automatic_relist": false,
	"date_created": "2017-03-20T15:44:01.000Z",
	"last_updated": "2017-04-07T16:55:52.996Z"
}
```
