<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/guias-de-talles -->
<!-- Sección: Guía para productos > Guías de Talles -->

# Gestionar guía de talles

Última actualización 16/10/2026

## Gestionar guía de talles

Importante:

Este recurso está disponible en Argentina, México, Brasil, Uruguay, Colombia, Perú, Ecuador y Chile.

Luego de obtener las estructuras necesarias de las fichas técnicas del dominio y la guía de talles, estará listo para crear una guía de talles de tipo personalizada/específica **(SPECIFIC)** .

 Utilizando la información de la guía de talles previamente creada ya sea de tipo Marca (BRAND), estándar de Mercado Libre (STANDARD) o personalizada/específica (SPECIFIC). podrás asociarla a publicaciones de moda.

 Tenga en cuenta que en Uruguay, Colombia, Perú, Ecuador y Chile únicamente contamos con la experiencia de guía de talles personalizada/específica (SPECIFIC).

## Crear guía de talles personalizadas

Ten en cuenta la respuesta obtenida en la [ficha técnica](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) de la guía de talles, con esta información podrás estructurar el body del POST, si envías algún atributo que no se encuentre en la ficha técnica retornará error.

Adicionalmente, esta ficha técnica también indica:

- Tipos de datos (text, number unit, list, etc).

- Atributos que cuenten con el tag de **main_attribute_candidate**  (Candidatos a ser talle principal) deberás enviar al menos uno como **main_atributte** . Los atributos con el tag de **required**  son obligatorios.

- Atributos con el tag de **required**  deben ser cargados a nivel general de guía de talles y no a nivel de rows.

- A nivel de rows, tendrás que enviar aquellos atributos que cuenten con el tag de **required**  únicamente y al menos uno que cuente con el tag de **main_attribute_candidate** .

- El atributo **BRAND**  también es requerido en el campo **attributes** , al mismo nivel donde se declara **GENDER** . Ambos son atributos generales de la guía y no deben enviarse dentro de **rows** .

Nota:

- El campo **names**  tiene un máximo de **60 caracteres**  y no acepta caracteres especiales como `(`, `)` ni `-`. Utiliza únicamente letras, números y espacios.

- El **domain_id**  debe enviarse **sin el prefijo del site** . Ejemplo: usar `"SHIRTS"` en lugar de `"MLB-SHIRTS"`. La API concatena el prefijo internamente según el **site_id**  del token.

- El **Access Token**  debe pertenecer a un usuario registrado en el **mismo site**  indicado en **site_id** . Si hay discrepancia, la API retorna `site_id: this field has an invalid value` sin aclarar que el problema es el token.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d {...} https://api.mercadolibre.com/catalog/charts
```

Ejemplo de creación de una guía personalizada para un dominio de footwear, género Hombre con las medidas desde 40 a la 42 y adicionalmente se define como talle principal el US_SIZE:

```
curl -X POST 'https://api.mercadolibre.com/catalog/charts' -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' --data-raw '{
   "names": {
       "MLA": "Guía de talles de calzado de hombre"
   },
   "domain_id": "SNEAKERS",
   "site_id": "MLA",
   "main_attribute": {
       "attributes": [
           {
               "site_id": "MLA",
               "id": "M_US_SIZE"
           }
       ]
   },
   "attributes": [
       {
           "id": "GENDER",
           "values": [
               {
                   "id": "339666",
                   "name": "Hombre"
               }
           ]
       }
   ],
   "rows": [
       {
           "attributes": [
               {
                   "id": "AR_SIZE",
                   "values": [
                       {
                           "name": "40 AR"
                       }
                   ]
               },
               {
                   "id": "M_US_SIZE",
                   "values": [
                       {
                           "name": "8,5 US"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "values": [
                       {
                           "name": "10 cm"
                       }
                   ]
               }
           ]
       },
       {
           "attributes": [
               {
                   "id": "AR_SIZE",
                   "values": [
                       {
                           "name": "41 AR"
                       }
                   ]
               },
               {
                   "id": "M_US_SIZE",
                   "values": [
                       {
                           "name": "9 US"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "values": [
                       {
                           "name": "15 cm"
                       }
                   ]
               }
           ]
       },
       {
           "attributes": [
               {
                   "id": "AR_SIZE",
                   "values": [
                       {
                           "name": "42 AR"
                       }
                   ]
               },
               {
                   "id": "M_US_SIZE",
                   "values": [
                       {
                           "name": "9,5 US"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "values": [
                       {
                           "name": "20 cm"
                       }
                   ]
               }
           ]
       }
   ]
}'
```

Respuesta, creación de la guía de talles para dominios de footwear:

```
{
   "id": "463005",
   "names": {
       "MLA": "Guía de talles de calzado de hombre"
   },
   "domain_id": "SNEAKERS",
   "site_id": "MLA",
   "type": "SPECIFIC",
   "seller_id": 1108966308,
   "main_attribute_id": "M_US_SIZE",
   "secondary_attribute_id": "AR_SIZE",
   "attributes": [
       {
           "id": "GENDER",
           "name": "Género",
           "values": [
               {
                   "id": "339666",
                   "name": "Hombre"
               }
           ]
       }
   ],
   "rows": [
       {
           "id": "463005:1",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "values": [
                       {
                           "name": "8,5 US",
                           "struct": {
                               "number": 8.5,
                               "unit": "US"
                           }
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "name": "Largo del pie",
                   "values": [
                       {
                           "name": "10 cm",
                           "struct": {
                               "number": 10.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "AR_SIZE",
                   "name": "AR",
                   "values": [
                       {
                           "name": "40 AR",
                           "struct": {
                               "number": 40.0,
                               "unit": "AR"
                           }
                       }
                   ]
               },
               {
                   "id": "M_US_SIZE",
                   "name": "US-M",
                   "values": [
                       {
                           "name": "8,5 US",
                           "struct": {
                               "number": 8.5,
                               "unit": "US"
                           }
                       }
                   ]
               }
           ]
       },
       {
           "id": "463005:2",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "values": [
                       {
                           "name": "9 US",
                           "struct": {
                               "number": 9.0,
                               "unit": "US"
                           }
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "name": "Largo del pie",
                   "values": [
                       {
                           "name": "15 cm",
                           "struct": {
                               "number": 15.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "AR_SIZE",
                   "name": "AR",
                   "values": [
                       {
                           "name": "41 AR",
                           "struct": {
                               "number": 41.0,
                               "unit": "AR"
                           }
                       }
                   ]
               },
               {
                   "id": "M_US_SIZE",
                   "name": "US-M",
                   "values": [
                       {
                           "name": "9 US",
                           "struct": {
                               "number": 9.0,
                               "unit": "US"
                           }
                       }
                   ]
               }
           ]
       },
       {
           "id": "463005:3",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "values": [
                       {
                           "name": "9,5 US",
                           "struct": {
                               "number": 9.5,
                               "unit": "US"
                           }
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "name": "Largo del pie",
                   "values": [
                       {
                           "name": "20 cm",
                           "struct": {
                               "number": 20.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "AR_SIZE",
                   "name": "AR",
                   "values": [
                       {
                           "name": "42 AR",
                           "struct": {
                               "number": 42.0,
                               "unit": "AR"
                           }
                       }
                   ]
               },
               {
                   "id": "M_US_SIZE",
                   "name": "US-M",
                   "values": [
                       {
                           "name": "9,5 US",
                           "struct": {
                               "number": 9.5,
                               "unit": "US"
                           }
                       }
                   ]
               }
           ]
       }
   ]
}
```

Ejemplo para crear una guía personalizada usando rangos de medidas:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
   "names": {
       "MLA": "Guia de test para rangos niños"
   },
   "domain_id": "SNEAKERS_TEST",
   "site_id": "MLA",
   "attributes": [
       {
           "id": "GENDER",
           "values": [
               {
                   "id": "339667",
                   "name": "Niños"
               }
           ]
       }
   ],
   "main_attribute": {
       "attributes": [
           {
               "site_id": "MLA",
               "id": "MANUFACTURER_SIZE"
           }
       ]
   },
   "rows": [
       {
           "attributes": [
               {
                   "id": "MANUFACTURER_SIZE",
                   "values": [
                       {
                           "name": "3 US"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "values": [
                       {
                           "name": "10 cm"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH_TO",
                   "values": [
                       {
                           "name": "13 cm"
                       }
                   ]
               }
           ]
       },
       {
           "attributes": [
               {
                   "id": "MANUFACTURER_SIZE",
                   "values": [
                       {
                           "name": "4 US"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "values": [
                       {
                           "name": "15 cm"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH_TO",
                   "values": [
                       {
                           "name": "20 cm"
                       }
                   ]
               }
           ]
       }
   ]
}' https://api.mercadolibre.com/catalog/charts
```

Algunas consideraciones sobre los atributos de la guía de talles:

- **manufacturer_size** : el cual es optativo y representa el talle de la marca o del fabricante.

- **size** : que representará el talle principal que se visualiza en la publicación.

- **foot_length y foot_length_to** : atributos utilizados para crear rangos de medidas dentro de la especificación de una fila de la guía de talles.

Nota:

Para atributos de tipo **number_unit**  (como **FOOT_LENGTH** , **WAIST_CIRCUMFERENCE** , entre otros), siempre incluye el objeto **struct**  junto al campo **name** . Omitirlo puede provocar inconsistencias al guardar los valores:

**Correcto:** 
`{"name": "48 cm", "struct": {"number": 48, "unit": "cm"}}`

La primera columna de la guía de talles, determina lo que va en el picker (detalle descriptivo de los talles). Esta columna puede ser determinada por el vendedor para cambiar lo que queremos mostrar como descripción de los talles.

En el caso de guía de talles standard y marca, la columna del detalle (picker) va a estar predefinida y son configuradas por cada sitio.

Ejemplo, el vendedor indicó que sus talles principales serán del tipo US_SIZE, por lo tanto la columna SIZE es calculada de acuerdo a lo que indicó el vendedor.

Ejemplo desde el front para una publicación con guía de talles asociada.

Cada cuadro azul (picker) en el caso de la imagen “9 US” hace referencia a los talles designados como principales por el vendedor.

## Crear guía en dominios TOPS and BOTTOMS

Nota:

Para las categorías de **TOPS and BOTTOMS** , únicamente se podrá crear publicaciones a partir de la guía de talles de tipo personalizada **(SPECIFIC)** .
 Se podrán crear guía de talles, [especificando atributos de medidas de prenda](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles?nocache=true#Crear-gu%C3%ADas-con-medidas-de-prenda) , como por ejemplo largo de la prenda, ancho de la prenda, entrepierna de la prenda, entre otros. Según la necesidad de cada vendedor

Para dominios de [TOPS and BOTTOMS](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Dominios-disponibles), por ejemplo: pantalones, camisas, vestidos, entre otros. Incluimos atributos del tipo de dato **value_type: "list"**  una **Lista** , que contiene un conjunto de valores predeterminados por Mercado Libre para especificar ciertos atributos de una guía de talles personalizada, adicionalmente encontrarás el tag de **multivalued**  que permitirá crear la guía con uno o más valores específicos dentro de la lista para cada fila, para ejemplificar: podrás ver que la talla Small incluye los valores de la lista de tallas desde la 26 hasta la 30 (26, 27, 28, 29, 30), mientras que la talla Large corresponde un único valor de talla 40.

En los dominios de **TOPS and BOTTOMS únicamente se puede hacer uso de guía de tipo SPECIFIC** , o guía personalizadas especificadas por cada vendedor. 
 Al [consultar la ficha técnica de la guía de talles](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) se verá en el resultado un tipo de dato **list**  que determina una Lista, dicho atributo indicará los posibles valores que puede tomar, tanto su **value_id**  como su **value_name** .

Ejemplo de creación de una guía de talles personalizada, con medidas corporalesdes, desde una Lista:

```
curl -L -X POST 'https://api.mercadolibre.com/catalog/charts' -H 'Authorization: Bearer  $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "names": {
       "MLA": "Guia de tallas lista-multivalued pants test"
   },
   "domain_id": "PANTS_TEST",
   "site_id": "MLA",
   "attributes": [
       {
           "id": "GENDER",
           "values": [
               {
                   "name": "Hombre"
               }
           ]
       }
   ],
   "main_attribute": {
       "attributes": [
           {
               "site_id": "MLA",
               "id": "SIZE"
           }
       ]
   },
   "rows": [
       {
           "attributes": [
               {
                   "id": "SIZE",
                   "values": [
                       {
                           "name": "Small"
                       }
                   ]
               },
               {
                   "id": "PANTS_TEST_FILTRABLE_SIZES",
                   "values": [
                       {
                           "name": "26"
                       },
                       {
                           "name": "27"
                       },
                       {
                           "name": "28"
                       },
                       {
                           "name": "29"
                       },
                       {
                           "name": "30"
                       }
                   ]
               },
               {
                   "id": "WAIST_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "82 cm"
                       }
                   ]
               },
               {
                   "id": "HIP_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "90 cm"
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_WAIST_TO_ANKLE_FROM",
                   "values": [
                       {
                           "name": "104 cm"
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_INSEAM_TO_ANKLE_FROM",
                   "values": [
                       {
                           "name": "107 cm"
                       }
                   ]
               },
               {
                   "id": "THIGH_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "45 cm"
                       }
                   ]
               }
           ]
       },
       {
           "attributes": [
               {
                   "id": "SIZE",
                   "values": [
                       {
                           "name": "Medium"
                       }
                   ]
               },
               {
                   "id": "PANTS_TEST_FILTRABLE_SIZES",
                   "values": [
                       {
                           "id": "3259507"
                       },
                       {
                           "id": "3189126"
                       },
                       {
                           "id": "3189128"
                       }
                   ]
               },
               {
                   "id": "WAIST_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "86 cm"
                       }
                   ]
               },
               {
                   "id": "HIP_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "93 cm"
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_WAIST_TO_ANKLE_FROM",
                   "values": [
                       {
                           "name": "108 cm"
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_INSEAM_TO_ANKLE_FROM",
                   "values": [
                       {
                           "name": "110 cm"
                       }
                   ]
               },
               {
                   "id": "THIGH_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "47 cm"
                       }
                   ]
               }
           ]
       },
       {
           "attributes": [
               {
                   "id": "SIZE",
                   "values": [
                       {
                           "name": "Large"
                       }
                   ]
               },
               {
                   "id": "PANTS_TEST_FILTRABLE_SIZES",
                   "values": [
                       {
                           "name": "40"
                       }
                   ]
               },
               {
                   "id": "WAIST_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "88 cm"
                       }
                   ]
               },
               {
                   "id": "HIP_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "111 cm"
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_WAIST_TO_ANKLE_FROM",
                   "values": [
                       {
                           "name": "113 cm"
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_INSEAM_TO_ANKLE_FROM",
                   "values": [
                       {
                           "name": "107 cm"
                       }
                   ]
               },
               {
                   "id": "THIGH_CIRCUMFERENCE_FROM",
                   "values": [
                       {
                           "name": "49 cm"
                       }
                   ]
               }
           ]
       }
   ]
}'
```

Respuesta de la creación de una guía de talles con medidas corporales desde una Lista:

```
{
   "id": "515255",
   "names": {
       "MLA": "Guia de tallas lista-multivalued pants test"
   },
   "domain_id": "PANTS_TEST",
   "site_id": "MLA",
   "type": "SPECIFIC",
   "seller_id": 1108966308,
   "main_attribute_id": "SIZE",
   "attributes": [
       {
           "id": "GENDER",
           "name": "Género",
           "values": [
               {
                   "name": "Hombre"
               }
           ]
       }
   ],
   "rows": [
       {
           "id": "515255:1",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "values": [
                       {
                           "name": "Small"
                       }
                   ]
               },
               {
                   "id": "SIZE",
                   "name": "Talla de la etiqueta",
                   "values": [
                       {
                           "name": "Small"
                       }
                   ]
               },
               {
                   "id": "PANTS_TEST_FILTRABLE_SIZES",
                   "name": "Talle estándar",
                   "values": [
                       {
                           "id": "4147746",
                           "name": "26"
                       },
                       {
                           "id": "3259523",
                           "name": "27"
                       },
                       {
                           "id": "3259504",
                           "name": "28"
                       },
                       {
                           "id": "3259505",
                           "name": "29"
                       },
                       {
                           "id": "3259506",
                           "name": "30"
                       }
                   ]
               },
               {
                   "id": "WAIST_CIRCUMFERENCE_FROM",
                   "name": "Circunferencia de cintura desde",
                   "values": [
                       {
                           "name": "82 cm",
                           "struct": {
                               "number": 82.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "HIP_CIRCUMFERENCE_FROM",
                   "name": "Circunferencia de cadera desde",
                   "values": [
                       {
                           "name": "90 cm",
                           "struct": {
                               "number": 90.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_WAIST_TO_ANKLE_FROM",
                   "name": "Largo de la cintura al tobillo desde",
                   "values": [
                       {
                           "name": "104 cm",
                           "struct": {
                               "number": 104.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_INSEAM_TO_ANKLE_FROM",
                   "name": "Largo de la entrepierna al tobillo desde",
                   "values": [
                       {
                           "name": "107 cm",
                           "struct": {
                               "number": 107.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "THIGH_CIRCUMFERENCE_FROM",
                   "name": "Contorno del muslo desde",
                   "values": [
                       {
                           "name": "45 cm",
                           "struct": {
                               "number": 45.0,
                               "unit": "cm"
                           }
                       }
                   ]
               }
           ]
       },
       {
           "id": "515255:2",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "values": [
                       {
                           "name": "Medium"
                       }
                   ]
               },
               {
                   "id": "SIZE",
                   "name": "Talla de la etiqueta",
                   "values": [
                       {
                           "name": "Medium"
                       }
                   ]
               },
               {
                   "id": "PANTS_TEST_FILTRABLE_SIZES",
                   "name": "Talle estándar",
                   "values": [
                       {
                           "id": "3259507",
                           "name": "31"
                       },
                       {
                           "id": "3189126",
                           "name": "32"
                       },
                       {
                           "id": "3189128",
                           "name": "33"
                       }
                   ]
               },
               {
                   "id": "WAIST_CIRCUMFERENCE_FROM",
                   "name": "Circunferencia de cintura desde",
                   "values": [
                       {
                           "name": "86 cm",
                           "struct": {
                               "number": 86.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "HIP_CIRCUMFERENCE_FROM",
                   "name": "Circunferencia de cadera desde",
                   "values": [
                       {
                           "name": "93 cm",
                           "struct": {
                               "number": 93.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_WAIST_TO_ANKLE_FROM",
                   "name": "Largo de la cintura al tobillo desde",
                   "values": [
                       {
                           "name": "108 cm",
                           "struct": {
                               "number": 108.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_INSEAM_TO_ANKLE_FROM",
                   "name": "Largo de la entrepierna al tobillo desde",
                   "values": [
                       {
                           "name": "110 cm",
                           "struct": {
                               "number": 110.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "THIGH_CIRCUMFERENCE_FROM",
                   "name": "Contorno del muslo desde",
                   "values": [
                       {
                           "name": "47 cm",
                           "struct": {
                               "number": 47.0,
                               "unit": "cm"
                           }
                       }
                   ]
               }
           ]
       },
       {
           "id": "515255:3",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talle",
                   "values": [
                       {
                           "name": "Large"
                       }
                   ]
               },
               {
                   "id": "SIZE",
                   "name": "Talla de la etiqueta",
                   "values": [
                       {
                           "name": "Large"
                       }
                   ]
               },
               {
                   "id": "PANTS_TEST_FILTRABLE_SIZES",
                   "name": "Talle estándar",
                   "values": [
                       {
                           "id": "3189142",
                           "name": "40"
                       }
                   ]
               },
               {
                   "id": "WAIST_CIRCUMFERENCE_FROM",
                   "name": "Circunferencia de cintura desde",
                   "values": [
                       {
                           "name": "88 cm",
                           "struct": {
                               "number": 88.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "HIP_CIRCUMFERENCE_FROM",
                   "name": "Circunferencia de cadera desde",
                   "values": [
                       {
                           "name": "111 cm",
                           "struct": {
                               "number": 111.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_WAIST_TO_ANKLE_FROM",
                   "name": "Largo de la cintura al tobillo desde",
                   "values": [
                       {
                           "name": "113 cm",
                           "struct": {
                               "number": 113.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "LENGTH_FROM_INSEAM_TO_ANKLE_FROM",
                   "name": "Largo de la entrepierna al tobillo desde",
                   "values": [
                       {
                           "name": "107 cm",
                           "struct": {
                               "number": 107.0,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "THIGH_CIRCUMFERENCE_FROM",
                   "name": "Contorno del muslo desde",
                   "values": [
                       {
                           "name": "49 cm",
                           "struct": {
                               "number": 49.0,
                               "unit": "cm"
                           }
                       }
                   ]
               }
           ]
       }
   ]
}
```

A considerar:

- Los valores recibidos dentro del atributo tipo **list** , se validarán contra la Lista que Mercado Libre dispone en la ficha técnica, en caso de enviar un valor que no esté dentro de dicha lista, retornará un error de tipo **value_is_not_in_the_list** .

```
{
   "error": "chart_validation_error",
   "message": "Chart validation errors found",
   "status": 400,
   "errors": [
       {
           "code": "value_is_not_in_the_list",
           "message": "Value 88 in attribute FILTRABLE_SIZE is incorrect",
           "cell": {
               "attribute_id": "FILTRABLE_SIZE",
               "row": {
                   "id": null,
                   "main_attribute": {
                       "id": "SIZE",
                       "value": "46"
                   }
               }
           }
       }
   ]
}
```

- Para especificar el campo de tipo list, se puede enviar el **value_id**  o el value_name, en caso de enviar ambos parámetros el value_id tiene mayor relevancia que el **value_name** .

Importante:

Para atributos de tipo **list**  (como **FILTRABLE_SIZE** ), el campo **id**  del valor es obligatorio y debe obtenerse del response de `technical_specs?section=grids`. Enviar únicamente el **name**  puede provocar errores de validación del tipo `value_is_not_in_the_list`.

**Incorrecto:** 
`{"id": "FILTRABLE_SIZE", "values": [{"name": "9-12 meses"}]}`

**Correcto:** 
`{"id": "FILTRABLE_SIZE", "values": [{"id": "12917813", "name": "9-12 meses"}]}`

## Crear guías con medidas de prenda

Important:

Únicamente para dominios de TOPS and BOTTOMS, se podrán crear guía de talles permitiendo que el vendedor especifique medidas de prenda. 
 Para pruebas, hemos habilitado el dominio de **PANTS_TEST**  en todos los sitios **únicamente para el género "Mujer"**  con la nueva configuración.

Solo para dominios de TOPS and BOTTOMS, después de [consultar la ficha técnica de la guía de talles](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) y reconocer que atributos tienen el tag de CLOTHING_MEASURE se podrá crear guía de talles únicamente especificando medidas de prenda.

A considerar:

- Se debe especificar el campo "**measure_type** " y sus posibles valores: BODY_MEASURE, CLOTHING_MEASURE o MIXED_MEASURE. Este campo hace referencia al tipo de medida que el vendedor especificará en la guía de talles. Una vez creada la guía de talles, **este campo no podrá modificarse** .

- Es posible en una misma guía de talles tener medidas de prenda y corporales al mismo tiempo con él "measure_type" MIXED_MEASURE.

- En caso de no enviar el campo "**measure_type" por defecto la guía de talles será de medidas corporales o BODY_MEASURE y todas las [validaciones](https://developers.mercadolibre.com.ar/es_ar/validacion-de-guia-de-talles#Validaciones-al-crear-una-gu%C3%ADa-de-talles) serán a partir de este tipo de medida.**

Ejemplo de creación de una guía de talles personalizada, con medidas de prenda:

```
curl -L -X POST 'https://api.mercadolibre.com/catalog/charts' -H 'Authorization: Bearer  $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "names": {
       "MLA": "Guia test pants con medidas prenda"
   },
   "domain_id": "PANTS_TEST",
   "site_id": "MLA",
   "measure_type": "CLOTHING_MEASURE",
   "attributes": [
       {
           "id": "GENDER",
           "values": [
               {
                   "name": "Mujer"
               }
           ]
       }
   ],
   "main_attribute": {
       "attributes": [
           {
               "site_id": "MLA",
               "id": "SIZE"
           }
       ]
   },
   "rows": [
       {
           "attributes": [
               {
                   "id": "SIZE",
                   "values": [
                       {
                           "name": "46"
                       }
                   ]
               },
               {
                   "id": "PANTS_TEST_FILTRABLE_SIZES",
                   "values": [
                       {
                           "name": "S"
                       }
                   ]
               },
               {
                   "id": "GARMENT_LENGTH_FROM",
                   "name": "Largo de la prenda desde",
                   "values": [
                       {
                           "name": "12 cm"
                       }
                   ]
               },
               {
                   "id": "GARMENT_WAIST_WIDTH_FROM",
                   "name": "Ancho de cintura la prenda desde",
                   "values": [
                       {
                           "name": "30 cm"
                       }
                   ]
               },
               {
                   "id": "GARMENT_HIP_WIDTH_FROM",
                   "name": "Ancho de cadera de la prenda desde",
                   "values": [
                       {
                           "name": "40 cm"
                       }
                   ]
               },
               {
                   "id": "GARMENT_THIGH_WIDTH_FROM",
                   "name": "Ancho de muslo de la prenda desde",
                   "values": [
                       {
                           "name": "22 cm"
                       }
                   ]
               },
               {
                   "id": "GARMENT_INSEAM_LENGTH_FROM",
                   "name": "Largo de la entrepierna de la prenda desde",
                   "values": [
                       {
                           "name": "11 cm"
                       }
                   ]
               },
               {
                   "id": "GARMENT_FRONT_RISE_FROM",
                   "name": "Tiro delantero de la prenda desde",
                   "values": [
                       {
                           "name": "13 cm"
                       }
                   ]
               }
           ]
       }
   ]
}'
```

## Validaciones de consistencia al crear y actualizar una guía de talles

Al crear una guía con `POST /catalog/charts` o actualizarla con `PUT /catalog/charts/$CHART_ID`, la API valida la consistencia entre las filas enviadas. Si detecta un problema, responde **HTTP 400**  y no completa la operación. Las URLs, los parámetros y la estructura general de los recursos no cambian.

### Filas con medidas y equivalencias repetidas

Dos talles distintos no pueden tener exactamente la misma combinación de equivalencias y medidas. Compartir una equivalencia, por ejemplo `M`, continúa siendo válido si al menos una medida de cada fila es diferente.

### Progresión de medidas en centímetros

Cuando aumenta el valor de `FILTRABLE_SIZE` entre filas comparables, al menos una de las medidas comparables expresadas en centímetros debe aumentar. Las demás medidas pueden mantenerse o disminuir si la tabla real así lo requiere.

| Validación | Respuesta de error | Cómo corregirla |
| --- | --- | --- |
| Dos filas repiten todas sus equivalencias y medidas. | `invalid_row_attribute_value` | Revisa las filas involucradas y conserva los valores de talle y medida que correspondan a la tabla real. |
| Aumenta `FILTRABLE_SIZE` y ninguna medida comparable en cm aumenta. | `invalid_row_attribute_value` | Compara la fila indicada con la anterior y ajusta la equivalencia o la medida que no represente correctamente la guía. |

Antes de reenviar la solicitud, consulta la ficha técnica del dominio y verifica que los atributos y valores de lista —en especial `FILTRABLE_SIZE`— sean válidos. La respuesta identifica el atributo y el talle que deben revisarse en `errors[].cell`.

Ejemplo de respuesta:

```
{
  "error": "chart_validation_error",
  "message": "Chart validation errors found",
  "status": 400,
  "errors": [
    {
      "code": "invalid_row_attribute_value",
      "message": "When value 28 in attribute FILTRABLE_SIZE appears in row SIZE 13, at least one comparable CM measurement must increase from previous value 27.",
      "cell": {
        "attribute_id": "FILTRABLE_SIZE",
        "row": {
          "main_attribute": {
            "id": "SIZE",
            "value": "13"
          }
        }
      }
    }
  ]
}
```

Para la validación de filas repetidas, el valor de `errors[].code` será `duplicated_measure_value`. Lee cada elemento de `errors`, corrige la fila señalada y vuelve a enviar la guía.

## Consultar una guía de talles

Podrás consultar una guía de talles específica enviando el id de la misma mediante el recurso de **/catalog/charts/$chart_id** .

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d {...} https://api.mercadolibre.com/catalog/charts/$CHART_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog/charts/232382
```

Respuesta

```
 {
   "id": "232382",
   "names": {
       "MLC": "Tabla de tallas Sandalias Niña"
   },
   "domain_id": "SANDALS_AND_CLOGS",
   "site_id": "MLC",
   "type": "SPECIFIC",
   "seller_id": 12345667,
   "main_attribute_id": "MANUFACTURER_SIZE",
   "attributes": [
       {
           "id": "GENDER",
           "name": "Género",
           "values": [
               {
                   "id": "339668",
                   "name": "Niñas"
               }
           ]
       }
   ],
   "rows": [
       {
           "id": "569686:1",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talla",
                   "values": [
                       {
                           "name": "17"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "name": "Largo del pie",
                   "values": [
                       {
                           "name": "10.9 cm",
                           "struct": {
                               "number": 10.9,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "MANUFACTURER_SIZE",
                   "name": "Talle de marca",
                   "values": [
                       {
                           "name": "17"
                       }
                   ]
               }
           ]
       },
       {
           "id": "569686:2",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talla",
                   "values": [
                       {
                           "name": "18"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "name": "Largo del pie",
                   "values": [
                       {
                           "name": "11.5 cm",
                           "struct": {
                               "number": 11.5,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "MANUFACTURER_SIZE",
                   "name": "Talle de marca",
                   "values": [
                       {
                           "name": "18"
                       }
                   ]
               }
           ]
       },
       {
           "id": "569686:3",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talla",
                   "values": [
                       {
                           "name": "19"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "name": "Largo del pie",
                   "values": [
                       {
                           "name": "12.2 cm",
                           "struct": {
                               "number": 12.2,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "MANUFACTURER_SIZE",
                   "name": "Talle de marca",
                   "values": [
                       {
                           "name": "19"
                       }
                   ]
               }
           ]
       },
       {
           "id": "569686:4",
           "attributes": [
               {
                   "id": "SIZE",
                   "name": "Talla",
                   "values": [
                       {
                           "name": "20"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH",
                   "name": "Largo del pie",
                   "values": [
                       {
                           "name": "12.9 cm",
                           "struct": {
                               "number": 12.9,
                               "unit": "cm"
                           }
                       }
                   ]
               },
               {
                   "id": "MANUFACTURER_SIZE",
                   "name": "Talle de marca",
                   "values": [
                       {
                           "name": "20"
                       }
                   ]
               }
           ]
       }
}
```

## Agregar filas en guía de talles

También podrás crear o agregar una fila en una guía de talles creada. Sin necesidad de tener que modificar la guía, podrás realizar un POST al recurso de **/catalog/charts/$chart_id/rows**  y sumar la fila correspondiente.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d {...} https://api.mercadolibre.com/catalog/charts/$CHART_ID/rows
```

Ejemplo para agregar una fila en una guía de talles del tipo BRAND o STANDARD:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
   "sites": ["MLA", "CBT"], // Aplica si type = BRAND | STANDARD
   "attributes": [{
     "id": "UK_SIZE",
     "values": [{
       "name": "44"
     }]
   },{
     "id": "AR_SIZE",
     "values": [{
       "name": "44"
     }]
   }
}'
https://api.mercadolibre.com/catalog/charts/4/rows
```

Ejemplo para agregar una fila en una guía de talles del tipo SPECIFIC:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
   "attributes": [{
     "id": "AR_SIZE",
     "values": [{
       "name": "43 AR"
     }]
   },{
     "id": "FOOT_LENGTH",
     "values": [{
       "name": "22 cm"
     }]
   }]
}'
https://api.mercadolibre.com/catalog/charts/4/rows
```

## Modificar fila en guía de talles

Podrás realizar un PUT al recurso de **/catalog/charts/$chart_id/rows/$row_id**  y editando la fila correspondiente, solo aplica para casos donde se quiere adicionar información extra como el caso del ejemplo que se adiciona FOOT_LENGTH.

Importante:

No podrás editar el talle principal **(main_attribute)**  de cada fila **(row)** y tampoco podrás eliminar filas.

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d {...} https://api.mercadolibre.com/catalog/charts/$CHART_ID/rows/$ROW_ID
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d

'{
    "attributes": [
        {
            "id": "FOOT_LENGTH",
            "values": [
                {
                   "id": "FOOT_LENGTH",
                   "values": [
                       {
                           "name": "10 cm"
                       }
                   ]
               },
               {
                   "id": "FOOT_LENGTH_TO",
                   "values": [
                       {
                           "name": "13 cm"
                       }
                   ]
               }
            ]
        }
    ]
}'
https://api.mercadolibre.com/catalog/charts/569686/rows/1
```

## Modificar guía de talles

De una guía de talles previamente creada solo será posible modificar el campo **name** . Si se cometió un error al momento de crear la guía, por ejemplo en sus talles principales o en la asignación del género, se deberá volver a [crear la guía de talles](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles?nocache=true#Crear-gu%C3%ADa-de-talles-personalizadas).

Importante:

Ten en cuenta que al modificar no podrás editar el talle principal **(main_attribute)**  de la guía, como el valor del talle principal de la fila **(row** ) y los atributos generales. **La guía de talles no podrá eliminarse** .

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -d {...} https://api.mercadolibre.com/catalog/charts/$CHART_ID
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -d
'{
  "names": {
   "MLA": "Guía de talles de calzado de hombre"
          }
}'
https://api.mercadolibre.com/catalog/charts/5
```

## Asociar guía de talles a la publicación

Para asociar una guía de talles a una publicación, tendrás que realizar un POST a /items, especificando los atributos **SIZE_GRID_ID**  que hace referencia al id de la guía de talles **SIZE_GRID_ROW_ID**  en referencia a cada fila dentro de la guía de talles.

Ejemplo de asociar una guía de talles, para una publicación sin variaciones, donde el atributo **SIZE_GRID_ROW_ID**  va a nivel de atributos de la publicación:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
'{
    "title": "ITEM DE TEST MODA - NO OFERTAR",
    "pictures": [
        {
            "secure_url": "https://http2.mlstatic.com/D_783501-MLB20327737026_062015-O.jpg",
            "url": "http://http2.mlstatic.com/D_783501-MLB20327737026_062015-O.jpg",
            "quality": "",
            "id": "783501-MLB20327737026_062015"
        }
    ],
    "price": 30000,
    "currency_id": "ARS",
    "available_quantity": 5,
    "catalog_listing": false,
    "attributes": [
        {
            "id": "ITEM_CONDITION",
            "value_id": "2230284"
        },
        {
            "id": "BRAND",
            "value_id": "14671",
            "value_name" : "Nike"
        },
        {
            "id": "LINE",
            "value_id": "289533",
            "value_name": "Air Max"
        },
        {
            "id": "MODEL",
            "value_id": "27030",
            "value_name": "AP"
        },
        {
            "id": "GENDER",
            "value_id": "339665",
            "value_name": "Mujer"
        },
        {
            "id": "AGE_GROUP",
            "value_id": "6725189",
            "value_name": "Adultos"
        },
        {
            "id": "SIZE_GRID_ID",
            "value_id": "11273930",
            "value_name":"26008"
        },
        {
            "id": "STYLE",
            "value_id": "6694772",
            "value_name": "Deportivo"
        },
        {
            "id": "RECOMMENDED_SPORTS",
            "value_id": "6694768",
            "value_name": "Running"
        },
        {
            "id": "EXTERIOR_MATERIALS",
            "value_id": "5017538",
            "value_name": "Cuero sintético"
        },
        {
            "id": "OUTSOLE_MATERIALS",
            "value_id": "930364",
            "value_name": "Goma"
        },
        {
            "id": "FOOTWEAR_TECHNOLOGIES",
            "value_id": "8668190",
            "value_name": "Air"
        },
        {
            "id": "FOOTWEAR_TYPE",
            "value_id": "517583",
            "value_name": "Zapatilla"
        },
        {
            "id": "COLOR",
            "value_id": null,
            "value_name": "Blanco/Blanco/Platino metalizado/Platino puro"
        },
        {
            "id": "SIZE_GRID_ROW_ID",
            "value_id": "11286240",
            "value_name": "26008:1"
        }
    ],
    "catalog_product_id": "MLA18565233",
    "category_id": "MLA455855",
    "listing_type_id": "gold_pro"
}'
https://api.mercadolibre.com/items
```

Ejemplo de asociar una guía de talles, para una publicación con variaciones, donde el atributo **SIZE_GRID_ROW_ID**  va a nivel de atributos de cada una de las variaciones de la publicación:

```
curl -L -X POST 'https://api.mercadolibre.com/items' -H 'Authorization: Bearer $ACCESS_TOKEN' -H 'Content-Type: application/json' -d '{
   "title": "Tênis Unissex Eros Olympikus Test No Ofertar",
   "category_id": "MLB23332",
   "price": 349.9,
   "currency_id": "BRL",
   "available_quantity": 6,
   "buying_mode": "buy_it_now",
   "condition": "new",
   "listing_type_id": "gold_special",
   "pictures": [
       {
           "source": "http://http2.mlstatic.com/D_686163-MLB51823676081_102022-O.jpg"
       },
       {
           "source": "http://http2.mlstatic.com/D_945109-MLB51823569653_102022-O.jpg"
       }
   ],
   "attributes": [
       {
           "id": "BRAND",
           "value_name": "Olympikus"
       },
       {
           "id": "GENDER",
           "value_name": "Homem"
       },
       {
           "id": "MODEL",
           "value_name": "EROS"
       },
       {
           "id": "SIZE_GRID_ID",
           "value_name": "210058"
       }
   ],
   "variations": [
       {
           "available_quantity": 5,
           "price": 349.9,
           "attribute_combinations": [
               {
                   "id": "COLOR",
                   "value_name": "BRANCO-SAFFRON"
               },
               {
                   "id": "SIZE",
                   "value_name": "36 BR"
               }
           ],
           "picture_ids": [
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670601935.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670605879.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670608926.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670611911.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670614401.jpg"
           ],
           "attributes": [
               {
                   "id": "EAN",
                   "value_name": "9003065700244"
               },
               {
                   "id": "SELLER_SKU",
                   "value_name": "9003065700244"
               },
               {
                   "id": "SIZE_GRID_ROW_ID",
                   "value_name": "210058:4"
               }
           ]
       },
       {
           "available_quantity": 2,
           "price": 349.9,
           "attribute_combinations": [
               {
                   "id": "COLOR",
                   "value_name": "BRANCO-SAFFRON"
               },
               {
                   "id": "SIZE",
                   "value_name": "37 BR",
                   "value_id": "11375309"
               }
           ],
           "picture_ids": [
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670601935.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670605879.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670608926.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670611911.jpg",
               "https://storage.googleapis.com/vetorapp0.appspot.com/BATA-5227/3065770-3011_1665670614401.jpg"
           ],
           "attributes": [
               {
                   "id": "EAN",
                   "value_name": "9003065700060"
               },
               {
                   "id": "SELLER_SKU",
                   "value_name": "9003065700060"
               },
               {
                   "id": "SIZE_GRID_ROW_ID",
                   "value_name": "210058:5"
               }
           ]
       }
   ]
}'
```

## Borrar Guía de Talles sin uso

Considere eliminar únicamente las guías de talles que no estén vinculadas a ningún ítem.

**Llamada:**

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/catalog/charts/$CHART_ID'
```

**Ejemplo:**

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/catalog/charts/124125'
```

**Respuesta:**

```
{ 
      "message": "Before removing the size chart, we'll check that it isn't linked to any listing. If it's still there after 24 hours, it means it's linked to one or more listings and you'll have to unlink it to remove it"
}
```

La Guía de talles no se elimina de inmediato, sino que se realiza una verificación para asegurar que no esté relacionada con ningún ítem activo, como se indica en el mensaje de éxito de la API.

Para saber si la Guía de Talles se eliminó exitosamente es necesario consultar su estado [consultar o seu status](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles#:~:text=%5D%0A%7D%27-,Consultar%20una%20gu%C3%ADa%20de%20talles,-Podr%C3%A1s%20consultar%20una) 24 horas después de solicitar la eliminación.

Mientras se verifica si la Guía de talles está vinculada a algún ítem activo, se actualizará “chart_status”:**INACTIVE** .
 Si se detecta que aún se encuentra en uso, no será eliminada y se mantendrá “chart_status”: **ACTIVE** .

Estos estados solo serán visibles al consultar una guía de talles que esté en proceso de eliminación o que se haya solicitado su eliminación.

Para asegurar su eliminación correcta, es necesario desvincular la guía de talles de todos los ítems [actualizando la Guía de Talles y sus variaciones](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones).

**Siguiente** : [Validación de guía de talles](https://developers.mercadolibre.com.ar/es_ar/validacion-de-guia-de-talles).
