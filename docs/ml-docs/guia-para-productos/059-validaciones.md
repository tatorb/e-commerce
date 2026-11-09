<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/validaciones -->
<!-- Sección: Guía para productos -->

# Validaciones

Última actualización 29/12/2025

## Validaciones

Nuestro objetivo es aumentar la calidad de las publicaciones de nuestros vendedores. Por este motivo está disponible un flujo que valida consistencias dentro de la publicación, previo a su creación, y en ciertas ocasiones solicita acciones de corrección por parte del vendedor, para cumplir los estándares esperados.
 Ejemplo de respuesta con validaciones luego de ejecutar la llamada para la [creación de una publicación](https://developers.mercadolibre.com.mx/es_ar/publica-productos#Publica-un-articulo):

```
{
   "message": "Validation error",
   "error": "validation_error",
   "status": 400,
   "cause": [
       {
           "department": "structured-data",
           "cause_id": 2511,
           "type": "warning",
           "code": "create.item.attribute.business_conditional",
           "references": [
               "item.attributes"
           ],
           "message": "Attribute [AGE_GROUP] to be added with values [(6725189,null)]"
       },
       {
           "department": "moderations",
           "cause_id": 3250,
           "type": "error",
           "code": "moderations.seller.not_authorized",
           "references": [
               "item.seller_id",
               "item.category_id",
               "item.attributes[0]"
           ],
           "message": "Seller is not authorized for this brand and category"
       },
       {
           "department": "structured-data",
           "cause_id": 1212,
           "type": "warning",
           "code": "normalize.item.attribute.values",
           "references": [
               "item.variations[0].attribute_combinations[1].values"
           ],
           "message": "Attribute [SIZE] to be modified - values [(null,32.5 BR)] should be [(11375386,32.5 BR)] - Normalized form: [migration]"
       },
       {
           "department": "shipping",
           "cause_id": 4029,
           "type": "warning",
           "code": "shipping.me2_adoption_mandatory",
           "references": [
               "shipping.modes",
               "user.shipping_preferences.option"
           ],
           "message": "ME2 adoption is mandatory for the user"
       }
```

### Descripción de los campos

- **message** : mensaje que indica que fue generado por la validación de calidad.

- **error** : código de error.

- **status** : código http para identificar error.

- **cause** : array que contiene el detalle de las validaciones ejecutadas y que posiblemente requiere una acción del vendedor para solucionarlas.

- **department** : nombre del área de Mercado Libre owner de la validación. **cause_id** : ID de la validación. **type** : tipo de validación con dos posibles valores warning (validación no bloqueante para la ejecución de la llamada, informativa) o error (validación bloqueante para la ejecución de la llamada, requiere de una acción del vendedor que modifique el JSON). **code** : código de validación. **references** : referencias a los atributos del JSON que causaron la validación. **message** : mensaje que detalla la validación causada.

## Detalle

A continuación, encontrarás el detalle de las validaciones que ayudan a mejorar la calidad de las publicaciones, donde las cuatro primeras columnas hacen referencia a los campos **cause_id** , **type** , **code**  y **message**  de la respuesta, respectivamente:

| Id | Tipo | Código de validación | Mensaje | Descripción | Posible solución |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |
| 101 | error | body.invalid_field_types | linvalid property type: [$FIELD_ID] expected URL-Friendly String but was String value: $VALUE. | El campo $FIELD_ID tiene valores inválidos $VALUE. | Para los valores disponibles de los campos, consulta /categories/$CATEGORY_ID/$TYPE_ID. |
| 109 | error | item.price.invalid | The category $CATEGORY_ID requires a minimum price of $VALUE. | El precio está por debajo del permitido para esta categoría. | Consulta el campo minimum_price en /categories/$CATEGORY_ID. |
| 126 | error | item.category_id.invalid | Is not allowed to post in category $CATEGORY_ID. Make sure you're posting in a leaf category". | "listing_allowed": false por lo que no se permite publicar en esta categoría. | Consulta el campo listing_allowed en /categories/$CATEGORY_ID. |
| 129 | error | item.price.invalid | Price must be less than 9999999999. | El precio supera el máximo permitido. | Corregir el campo price con un valor válido. |
| 147 | error | item.attributes.missing_required | The attributes [$ATTRIBUTE_ID] are required for category $CATEGORY_ID and channel marketplace. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes. | El atributo $ATTRIBUTE_ID es obligatorio para esta categoria $CATEGORY_ID. | Para ver los atributos obligatorios en la categoría, consulta /categories/$CATEGORY_ID/attributes reconociendo "tags": { "required": true }. |
| 154 | error | item.attributes.invalid_length | Invalid value length for attribute $ATTRIBUTE_ID. Maximum length is 255. | La longitud máxima para el atributo $ATTRIBUTE_ID se superó. | Para ver los atributos consulta /categories/$CATEGORY_ID/attributes campo value_max_length. |
| 173 | error | item.listing_type_id.requiresPictures | Item pictures are mandatory for listing type gold_special. | Las imágenes son obligatorias. | Asociar imágenes a la publicación. |
| 201 | error | item.pictures.max | Items in category $CATEGORY_ID cannot exceeds $NUMBER pictures. | Las imágenes exceden la cantidad máxima permitida. | Consulta el límite permitido de imágenes en /categories/$CATEGORY_ID campos max_pictures_per_item y max_pictures_per_item_var. |
| 204 | error | item.pictures.picture_not_found | Picture id $PICTURE_ID does not exist. | La imágen no existe. | Ingresa una imágen válida. |
| 369 | error | body.required_fields | The variations[$VARIATION_NUMBER] does not contains some or none of the following properties [attribute_combinations, $ATTRIBUTE_ID]. | El atributo $ATTRIBUTE_ID es obligatorio para el array de attribute_combinations en la variación. | Para ver los atributos obligatorios en la categoría, consulta /categories/$CATEGORY_ID/attributes reconociendo "tags": { "required": true }. |
| 372 | error | tem.attributes.non_existent.limit_exceded | The attribute_combinations not existing in category $CATEGORY_ID in the variation $VARIATION_ID exceed the allowed amount, only 1 of this kind is allowed. | Alguno de los atributos especificados en el array de attribute_combinations no existe o está repetido. | Verifique el array attribute_combinations. |
| 382 | warning | item.category_id.migrated | Category id migrated to: $CATEGORY_ID. | El id de categoría ingresada fue migrada a $CATEGORY-ID. | No aplica el cambio es automático. |
| 394 | error | item.attribute.values.name.invalid | Attribute $ATTRIBUTE_ID has a values entry with name too long ($CHARACTERS_NUMBER). Maximum name size allowed is 255. | La longitud máxima para el atributo $ATTRIBUTE_ID se superó. | Para ver los atributos consulta la /categories/$CATEGORY_ID/attributes campo value_max_length. |
| 465 | warning | item.video_id.dropped | Item video id was dropped. | Desactivamos la opción de incluir vídeos de Youtube en las publicaciones de Marketplace. | Utilizar [Clips](https://vendedores.mercadolibre.com.ar/nota/sube-videos-de-tus-productos-para-llegar-a-mas-personas). |
| 1212 | warning | normalize.item.attribute.values | Attribute [$ATTRIBUTE] to be modified - values [($VALUE_ID,$VALUE_NAME)] should be [($VALUE_ID,$VALUE_NAME)] - Normalized form: [migration]. | El atributo no cuenta con el value_id o value_name especificados en el llamado, completamos automáticamente el campo faltante. | No aplica. |
| 2511 | warning | create.item.attribute.business_conditional | Attribute $ATTRIBUTE to be added with values [($VALUE_ID,$VALUE_NAME)]". | El atributo no se encuentra especificado en la llamada, lo adicionamos automáticamente. | No aplica. |
| 3250 | warning | moderations.seller.not_authorized | Seller is not authorized for this brand and category. | Es una marca que debe ser acreditada, es decir, demostrar que se adquieren los productos a través de distribuidores o retailers autorizados por la marca en el país. | Ingresar a Mercado Libre a la sección Ventas > Preferencias de ventas > Acreditaciones, seleccionar “Acreditar marca”, ingresar la marca a acreditar y adjuntar facturas de compra. |
| 4029 | warning | shipping.me2_adoption_mandatory | ME2 adoption is mandatory for the user. | El tipo de envíos ME2 es obligatorio para el usuario, completamos la información automáticamente. | No aplica. |
| 7710 | error | item.attribute.product_identifier.invalid | Product Identifier [GTIN] has invalid values: [$VALUE]. | El identificador de productos contiene caracteres no válidos. | Ingresar un identificador de producto válido. |
| 7711 | error | item.attribute.product_identifier.invalid_format | Product Identifier [GTIN] contains values with invalid format: [$VALUE]. | El identificador del producto en este caso GTIN tiene formato incorrecto. | Ingresar un identificador de producto válido. |
| 7712 | error | item.attribute.product_identifier.invalid_by_domain_catalog | Product Identifier [GTIN] with values [$VALUE] corresponds to category [$CATEGORY_ID]. | El identificador de producto enviado corresponde a un producto de otra categoría $CATEGORY_ID dentro del mismo dominio donde se está publicando. | Ingresar un identificador de producto válido para la categoría que está publicando. |
| 7714 | error |  | The {$UNIVERSAL_CODE_FIELD} universal code has an incorrect format. | Al menos un atributo del tipo (GTIN, EAN, UPC, JAN, GTIN14, ISBN, ISBN10, ISBN13) no es válido. | Puede validar los códigos, usando este recurso /product-identifier/validator?product_identifier=$UNIVERSAL_CODE_FIELD. |
| 7810 | error | item.attribute.missing_conditional_required | The attributes [$ATTRIBUTE_ID] are required for category [$CATEGORY_ID]. Check the attribute is present in the attributes list or in all variation's attributes_combination or attributes. | El $ATTRIBUTE_ID es un atributo obligatorio para la categoría $CATEGORY_ID. | Para ver los atributos obligatorios en la categoría, consulta /categories/$CATEGORY_ID/attributes reconociendo "conditional_required": true. |
| 3701 | error | item.attribute.invalid_product_identifier | Enter a universal code that you have not used in another brand listing/category listing. | El GTIN se ha utilizado para otras publicaciones de otra marca o dominio. | Corrige el campo GTIN o código universal. |
| 3702 | error | item.attribute.invalid_sanitary_registry_value | The value you entered in {$ATTRIBUTE_ID} is incorrect. An example is: {$VALUE}. | Tiene errores de formato en datos de registro sanitario. | Corrige el atributo $ATTRIBUTE_ID con un valor válido. |
| 3703 | error | item.pictures.invalid_size | The photos must have a minimum size of 500 pixels on at least one side. | Las fotos deben tener un tamaño mínimo de 500 píxeles en al menos uno de sus lados. | Cargar fotos que cumplan con el estándar mínimo de 500 pixeles. |
| 3704 | error | item.attribute.missing_catalog_required | The {$FIELD_ID} field is mandatory and was not added. | Falta completar alguno de los atributos de tipo catalog_required o catalog_child_required. | Para ver los atributos obligatorios en la categoría, consulta /categories/$CATEGORY_ID/attributes reconociendo "catalog_required": true o “catalog_child_required”: true. |
| 3705 | error | item.title.minimum_length | You should include more main features in the title to differentiate it from other products. | El título debe incluir mayor detalle sobre el artículo ofertado. | Corregir el campo título de la publicación. |
| 3706 | error | item.pictures.unavailable | An error occurred while processing the photo. Please upload it again. | Durante el proceso de carga la imágen principal fallo o quedó inaccesible. | Intenta cargar la publicación, si el error persiste, modifica la imágen. |
| 3707 | error | item.descriptions.length_exceeded | You exceeded the {$VALUE} character limit. Shorten the description. | La descripción no debe superar los $VALUE caracteres. | Corregir la descripción para que no supere la regla de la cantidad máxima de caracteres permitidos. |
| 3708 | error | item.attribute.number_invalid_format | The value you entered in {$FIELD_ID} is incorrect. An example is: {$VALUE}. | El valor que ingresaste en el campo $FIELD_ID es incorrecto. | Corregir valores erróneos que tienen un formato incorrecto en los atributos numéricos. |
| 3709 | error | item.attribute.invalid_sale_units | You added {$VALUE_1} in the {$FIELD_ID_1} field, but you have not filled out the {$FIELD_ID_2} field.   You added {$VALUE_1} in the {$FIELD_ID_1} field and, in this case, the {$FIELD_ID_2} field should not be {$VALUE_2}.  If in the {ase, the {$FIELD_ID} option, you chose {$VALUE_1}, in this field you must fill in {ase, the {$VALUE_2}. | Cargaste {0} en el campo {1} pero no completaste el campo {2}.  Cargaste {0} en el campo {1} y, en ese caso, el campo {2} no debería ser {3}.  Si en {0} elegiste {1}, en este campo debes completar {2}. | Corregir los atributos SALE_FORMAT y UNITS_PER_PACK. Siguiendo las siguientes condiciones: Si está cargado UNITS_PER_PACK, debe estar cargado SALE_FORMAT.  Si SALE_FORMAT tiene valor Unidad, entonces UNITS_PER_PACK (si está cargado) debe ser 1.  Si SALE_FORMAT tiene valor Pack, entonces UNITS_PER_PACK debe ser mayor a 1.  Si SALE_FORMAT tiene valor Peso, entonces NET_WEIGHT debe estar cargado. |
| 3710 | error | item.attribute.invalid_voltage | It is not allowed to sell products of this voltage in Argentina. | Aplica para Argentina, tiene un voltaje entre 100 y 199 Volts y no es permitida su venta. | No aplica. |
| 3711 | error | item.attribute.gtin_invalid_domain | The {$GTIN} universal code corresponds to the {$CATEGORY_ID} category. | Se valida que GTIN no esté en otro producto correspondiente a otro dominio al cual se está publicando. | Ingresar un identificador de producto válido para la categoría que está publicando. |
| 3510 | error | Attribute [%s] is not valid, item values [%s] | "Attribute [%s] is not valid, item values [%s]", attributeId, itemValuesStr | Se validan los atributos requeridos en la Categoría y/o dominios. | Ingresar con atributos válidos. |
| 3712 | error | item.attribute.gtin_invalid_brand | The {$GTIN} universal code corresponds to the {$BRAND} brand. | El código universal ingresado corresponde a otra marca $BRAND diferente a la que ingresaste para tu publicación. | Ingresar un identificador de producto válido para la categoría que está publicando. |
| 4210 | error | invalid.title.gender | Please make sure you enter a gender that matches the title of your listing. | El título de la publicación hace referencia a un género diferente al que se detallo en el atributo GENDER. | Debe corregir el título para que haga referencia al mismo género que el detallado en la ficha técnica de la publicación. |
