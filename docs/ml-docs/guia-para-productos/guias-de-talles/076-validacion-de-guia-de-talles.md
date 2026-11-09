<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/validacion-de-guia-de-talles -->
<!-- Sección: Guía para productos > Guías de Talles -->

# Validación de guía de talles

Última actualización 30/12/2025

## Validación de guía de talles

Importante:

Este recurso está disponible en Argentina, Mexico, Brasil, Uruguay, Colombia, Perú, Ecuador y Chile.

Con el objetivo de mejorar la experiencia en publicaciones de moda, disponemos de la guía de talles donde los vendedores pueden detallar las medidas de sus productos a los compradores. Esta funcionalidad permite disminuir el número de preguntas, devoluciones por problemas con los tamaños y aumentar las ventas. ¡Revisa nuestra documentación para conocer cómo cargarlas!

## Recomendaciones para publicaciones de moda

- Completa la [ficha técnica](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) de las publicaciones.

- Revisa los géneros por país mediante el recurso de **/catalog_domains/$DOMAIN_ID/attributes/GENDER**  para que las publicaciones hagan referencia a géneros reconocidos por Mercado Libre.

- Carga todos los [Atributos requeridos](https://developers.mercadolibre.com.ar/es_ar/atributos#atributos-obligatorios), al igual que las [variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones) a las publicaciones.

- Identifica si la publicación no cumple con algún [requisito de calidad](https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones#Acciones-para-productos) y realiza las acciones adecuadas.

- Confirma si el dominio tiene atributos configurados para el uso de la guía de talle.

- Para los dominios que corresponda, utiliza como mínimo los campos de género y marca para [encontrar una guía de talles adecuada](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) para asociar a tu publicación.

- Especifica los atributos del tipo GRID_ID y GRID_ROW_ID según corresponda, al momento de [crear o modificar la publicación](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles?nocache=true#Asociar-gu%C3%ADa-de-talles-a-la-publicaci%C3%B3n).

## Validaciones al crear una guía de talles

Con el objetivo de mantener guías de talles con información de calidad, hemos creado validaciones que mediante mensajes de error nos informarán las acciones que debe tomar el vendedor previo a [crear una guía de talles](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles#Crear-gu%C3%ADa-de-talles-personalizadas), los cuales detallamos a continuación:

1. El valor {VALUE_NAME} que se especificó para el atributo género, no es un valor válido dentro de la [ficha técnica del dominio](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-t%C3%A9cnica-del-dominio).

```
{
"error": "chart_tech_specs_not_found",
"message": "Chart technical specification not found for SITE:{SITE_ID}-DOMAIN:{DOMAIN_ID}-GENDER:{VALUE_NAME}",
"status": 404
}
```

2. No se ha especificado un atributo principal o main_attribute.

```
{
"error": "main_attribute_missing_error",
"message": "Main attribute for site {SITE_ID} is missing.",
"status": 400
}
```

3. El atributo {ATTRIBUTE_ID} elegido como main_attribute o principal no es un atributo válido, debe consultar la [ficha técnica de la guía de talles](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) que informará de posibles atributos candidatos.

```
{
"code": "invalid_main_attribute_id",
"message": "Chart main attribute with ID {ATTRIBUTE_ID} is invalid."
}
```

4. Hay atributos requeridos {ATTRIBUTE_ID} dentro de la ficha técnica de la guía de talles, que no fueron especificados. El mensaje adiciona información detallada de la fila o row {ROW_MAIN_ATTRIBUTE_VALUE_NAME} donde hace falta información.

```
{
    "code": "required_row_attribute_not_found",
    "message": "Required attribute {ATTRIBUTE_ID} was not found in row {MAIN_ATTRIBUTE_ID} {ROW_MAIN_ATTRIBUTE_VALUE_NAME}.",
    "cell": {
        "attribute_id": "{ATTRIBUTE_ID}",
        "row": {
            "id": null,
            "main_attribute": {
                "id": "{MAIN_ATTRIBUTE_ID}",
                "value": "{ROW_MAIN_ATTRIBUTE_VALUE_NAME}"
            }
        }
    }
}
```

5. El valor {VALUE_NAME} ingresado en el atributo {ATTRIBUTE_ID} no es válido, debe consultar la [ficha técnica de la guía de talles](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) para obtener la lista de valores que puede usar. El mensaje adiciona información detallada de la fila o row {ROW_MAIN_ATTRIBUTE_VALUE_NAME} que presenta el error.

```
{
    "code": "invalid_row_attribute_value",
    "message": "Attribute {ATTRIBUTE_ID} in row {MAIN_ATTRIBUTE_ID} {VALUE_NAME} has an invalid value.",
    "cell": {
        "attribute_id": "{ATTRIBUTE_ID}",
        "row": {
            "id": null,
            "main_attribute": {
                "id": "{MAIN_ATTRIBUTE_ID}",
                "value": "{ROW_MAIN_ATTRIBUTE_VALUE_NAME}"
            }
        }
    }
}
```

6. El valor {VALUE_NAME} del atributo {ATTRIBUTE_ID}, está fuera del rango permitido, se adiciona información del rango. El mensaje adiciona información detallada de la fila o row {ROW_MAIN_ATTRIBUTE_VALUE_NAME} que presenta el error.

```
{
    "code": "value_out_of_range",
    "message": "The value {VALUE_NAME} of the {ATTRIBUTE_ID} attribute of the row main attribute {MAIN_ATTRIBUTE_ID} {ROW_MAIN_ATTRIBUTE_VALUE_NAME} is out of range. The value must be within the range: {MINIMUM_RANGE} - {MAXIMUM_RANGE}",
    "cell": {
        "attribute_id": "{ATTRIBUTE_ID}",
        "row": {
            "id": null,
            "main_attribute": {
                "id": "{MAIN_ATTRIBUTE_ID}",
                "value": "{ROW_MAIN_ATTRIBUTE_VALUE_NAME}"
            }
        }
    }
}
```

7. El valor {VALUE_NAME} del atributo principal es incorrecto ya que está haciendo uso de palabras como género, colores, etc. Únicamente debe contener palabras que tengan relación con la talla. El mensaje adiciona información detallada de la fila o row {ROW_MAIN_ATTRIBUTE_VALUE_NAME} que presenta el error.

```
{
    "code": "invalid_attribute_value",
    "message": "The value {VALUE_NAME} of the attribute {ATTRIBUTE_ID}   is incorrect. The value must contain only words related to SIZE",
    "cell": {
        "attribute_id": "{ATTRIBUTE_ID}",
        "row": {
            "id": null,
            "main_attribute": {
                "id": "{MAIN_ATTRIBUTE_ID}",
                "value": "{ROW_MAIN_ATTRIBUTE_VALUE_NAME}"
            }
        }
    }
}
```

8. El valor del atributo {ATTRIBUTE_ID} es igual al que se especificó en la fila o row {ROW_MAIN_ATTRIBUTE_VALUE_NAME}, no se permite especificar valores duplicados en una guía de talles.

```
{
    "code": "duplicated_measure_value",
    "message": "Duplicated measure in attribute {ATTRIBUTE_ID} was found in row {MAIN_ATTRIBUTE_ID} {ROW_MAIN_ATTRIBUTE_VALUE_NAME} .",
    "cell": {
        "attribute_id": "{ATTRIBUTE_ID}",
        "row": {
            "id": null,
            "main_attribute": {
                "id": "{MAIN_ATTRIBUTE_ID}",
                "value": "{ROW_MAIN_ATTRIBUTE_VALUE_NAME}"
            }
        }
    }
}
```

9. Los valores del campo FILTRABLE_SIZE para una misma guía de talles, son o numéricos o alfanuméricos, no se permite combinar tipos de datos en el atributo.

```
{
    "code": "value_is_not_the_same_type",
    "message": "All FILTRABLE_SIZE values must be the same type, only numbers or alphanumeric",
    "cell": {
        "attribute_id": "FILTRABLE_SIZE",
        "row": {
            "id": null,
            "main_attribute": {
                "id": "{MAIN_ATTRIBUTE_ID}",
                "value": "{ROW_MAIN_ATTRIBUTE_VALUE_NAME}"
            }
        }
    }
}
```

10. El atributo {ATTRIBUTE_ID} no debe estar en la guía de talles, este error se debe a que se trata de ingresar un atributo de tipo BODY_MEASURE, CLOTHING_MEASURE o MIXED_MEASURE, y la guía de talles tiene configurado un tipo de medida diferente al del atributo. Las guías de talles únicamente pueden tener un tipo de medida.

```
{
   "code": "invalid_row_attribute",
   "message": "Attribute {ATTRIBUTE_ID} found in row {MAIN_ATTRIBUTE_ID} {ROW_MAIN_ATTRIBUTE_VALUE_NAME} is not valid and should not be present in the chart rows.",
   "cell": {
       "attribute_id": "{ATTRIBUTE_ID}",
       "row": {
           "id": null,
           "main_attribute": {
               "id": "{MAIN_ATTRIBUTE_ID}",
               "value": "{ROW_MAIN_ATTRIBUTE_VALUE_NAME}"
           }
       }
```

## Validaciones al asociar una guía a una publicación

Para algunos dominios de la vertical de Fashion, es obligatorio [asociar una guía de talles a las publicaciones](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles#Asociar-gu%C3%ADa-de-talles-a-la-publicaci%C3%B3n) para ello validamos que la información de la publicación sea consistente a la guía de talles mediante mensajes de error que buscan una acción correctiva del vendedor, los cuales detallamos a continuación.

Nota:

Dentro de las validaciones de obligatoriedad de la guia de talles para los Live Listings no se tiene en cuenta ajustes como:  Cambios de stock y precio en la publicación.   Cambios a estado pausado o cerrado en la publicación.  Es decir, no muestra error al momento de hacer el PUT al recurso de /items/

1. El atributo **SIZE_GRID_ID**  no existe en la publicación:

```
{
    "code": "missing.fashion_grid.grid_id.values",
    "message": "Attribute [SIZE_GRID_ID] is missing",
    "type": "ERROR",
    "cause_id": 2610,
    "references": [
        "item.attributes"
    ],
    "department": "structured-data",
    "validation": "fashion-validator",
    "custom_data": {}
}
```

2. Para la publicación existe el atributo **SIZE_GRID_ID**  pero no existe el atributo que especifica el row **SIZE_GRID_ROW_ID** :

```
{
    "code": "missing.fashion_grid.grid_row_id.values",
    "message": "Attribute [SIZE_GRID_ROW_ID] is missing",
    "type": "ERROR",
    "cause_id": 2611,
    "references": [
        "item.attributes"
    ],
    "department": "structured-data",
    "validation": "fashion-validator",
    "custom_data": {}
}
```

3. Para la publicación y/o sus variaciones no se está especificando el atributo **SIZE** :

```
{
    "code": "missing.fashion_grid.size.values",
    "message": "Attribute [SIZE] is missing",
    "type": "ERROR",
    "cause_id": 2612,
    "references": [
        "item.attributes"
    ],
    "department": "structured-data",
    "validation": "fashion-validator",
    "custom_data": {}
}
```

4. La publicación cuenta con la especificación del atributo **SIZE_GRID_ID**  pero el código de guía enviado es inválido, por ejemplo, cuando a la publicación se le asocia una guía de talles de otra categoría:

```
{
    "code": "invalid.fashion_grid.grid_id.values",
    "message": "Attribute [SIZE_GRID_ID] is not valid",
    "type": "ERROR",
    "cause_id": 2613,
    "references": [
        "item.name"
    ],
    "department": "structured-data",
    "validation": "fashion-validator",
    "custom_data": {}
}
```

5. La publicación cuenta con la especificación del atributo **SIZE_GRID_ID**  y **SIZE_GRID_ROW_ID**  pero el id enviado en el row es inválido, es decir, no existe dentro de la guía especificada en el grid_id:

```
 {
    "code": "invalid.fashion_grid.grid_row_id.values",
    "message": "Attribute [SIZE_GRID_ROW_ID] is not valid",
    "type": "ERROR",
    "cause_id": 2614,
    "references": [
        "item.name"
    ],
    "department": "structured-data",
    "validation": "fashion-validator",
    "custom_data": {}
}
```

6. Al atributo size de la publicación o de la variación debe corresponder consistentemente al de la row de la guía que se está seleccionando, es decir, deben ser idénticos, si el **SIZE**  de la publicación o variación no es válido en esta comparación:

```
   {
    "code": "invalid.fashion_grid.size.values",
    "message": "Attribute [SIZE] is not valid",
    "type": "WARNING",
    "cause_id": 2615,
    "references": [
        "item.name"
    ],
    "department": "structured-data",
    "validation": "fashion-validator",
    "custom_data": {}
}
```

7. Los atributos que están detallados en la guía deben corresponder consistentemente con la información de la publicación, por ejemplo el atributo **GENDER**  de la guía debe ser el mismo que el de la publicación:

```
{
    "code": "invalid.fashion_grid.size.values",
    "message": "Attribute [GENDER] is not valid",
    "type": "WARNING",
    "cause_id": 2616,
    "references": [
        "item.name"
    ],
    "department": "structured-data",
    "validation": "fashion-validator",
    "custom_data": {}
}
```

8. Intentas asociar una guía de talles personalizada o específica que no le pertenece al vendedor actual.

```
{
"department": "structured-data",
"cause_id": 2617,
"type": "error",
"code": "invalid.fashion_grid.seller_id.values",
"references": [
"item.seller_id"
],
"message": "The size chart {CHART_ID} doesn't belong to the seller id [{SELLER_ID}]"
}
```

## Moderaciones

Las nuevas publicaciones que se crearon satisfactoriamente dentro de Mercado Libre, pero que incumplen con uno o varios de los [motivos de validación](https://developers.mercadolibre.com.ar/es_ar/validacion-de-guia-de-talles#Validaciones-y-mensajes-de-error) antes descritos, serán moderadas y posteriormente pausadas. 

 Podrás consultar la razón y el remedy de las mismas desde nuestra API de [moderaciones](https://developers.mercadolibre.com.ar/es_ar/gestionar-moderaciones#Consultar-moderaciones-de-un-usuario).

Ejemplo de respuesta de un ítem moderado por inconsistencias en guía de talles:

```
{
   "infractions": [
       {
           "id": "1119693123",
           "date_created": "2023-01-31T15:54:09.537-0400",
           "user_id": "1241259814",
           "related_item_id": "MLM1791370022",
           "element_id": "MLM1791370022",
           "element_type": "ITM",
           "site_id": "MLM",
           "filter_subgroup": "TP",
           "reason": "La pausamos porque el género de la guía de tallas no coincide con el de la publicación. Asocia otra guía para reactivarla.",
           "remedy": "Asocia otra guía de tallas para reactivar la publicaciónEl género de la guía de tallas no coincide con el de la publicación."
       }
   ],
   "paging": {
       "offset": 0,
       "limit": 20,
       "total": 1
   },
   "sorting_type": "date_created_desc"
}
```

Siguiente: [Calidad de fotos de moda](https://developers.mercadolibre.com.ar/es_ar/calidad-de-fotos-de-moda).
