<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es -->
<!-- Sección: Guía para productos > Guías de Talles -->

# Primeros pasos

Última actualización 14/08/2024

## Primeros pasos

Importante:

Este recurso está disponible en Argentina, México, Brasil, Uruguay, Colombia, Perú, Ecuador y Chile.

La guía de talles permite que los compradores tengan una mejor experiencia al momento de elegir su producto, evitando así cambios de talle y/o reclamos; por eso tenga en cuenta desarrollar esta funcionalidad para atender a vendedores de moda.

Previo a la creación de publicaciones con guía de talles, debes obtener toda la información de las fichas técnicas que te permitirá conocer la estructura para la creación de guía de talles y posterior asignación de una guía a una publicación.

Por lo tanto, hemos detallado el flujo técnico en la siguiente imagen para obtener publicaciones de moda con calidad y una guía de talles correctamente asociada:

1. Primeros pasos para obtener detalle de ficha técnica.

2. Gestionar guía de talles a partir de la información de la ficha técnica.

3. Validaciones con los posibles mensajes de error, moderaciones y algunas recomendaciones.

4. Calidad de fotos donde certificamos las imágenes de las publicaciones de moda.

5. 

6. Definir dominio de moda para publicar

7. Para avanzar en el flujo de publicación de un artículo de moda con guía de talles asociada, es necesario revisar ejecutar el [predictor de categorías](https://developers.mercadolibre.com.ar/es_ar/categoriza-productos#Predictor-de-categorias) mediante el recurso de **/domain_discovery**  y así obtener el dato del **domain_id**  sobre el cual se va a publicar.

8. 

9. Ejemplo de respuesta del predictor de categorías para un dominio de moda:

10. `[ { "domain_id": "MLA-SNEAKERS", "domain_name": "Zapatillas", "category_id": "MLA109027", "category_name": "Zapatillas", "attributes": [] } ]`

11. 

12. Dominios disponibles para guía de talles

13. Podrás consultar los dominios encendidos con la experiencia de guía de talles especificando el SITE_ID.

14. 

15. Llamada:

16. `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/catalog/charts/$SITE_ID/configurations/active_domains'`

17. 

18. Ejemplo de la respuesta obtenida para **MLA** , donde el array **domains**  especifica todos los id de dominios activados para el site específico, en el ejemplo, Argentina:

19. `{ "domains": [ { "domain_id": "MLA-SNEAKERS" }, { "domain_id": "MLA-BOOTS_AND_BOOTIES" }, { "domain_id": "MLA-LOAFERS_AND_OXFORDS" }, { "domain_id": "MLA-FOOTBALL_SHOES" }, { "domain_id": "MLA-SANDALS_AND_CLOGS" } ] }`

20. 

21. Ejemplo de respuesta cuando el SITE_ID no tiene ningún dominio activado para el uso de guía de talles:

22. `{ "error": "config_not_found", "message": "Config not found", "status": 404 }`

23. 

24. Consultar ficha técnica del dominio

25. Ya con la categoría y dominio identificado para la publicación, deberás realizar una consulta al recurso de **/domains/$domain_id/technical_specs**  y consultar la ficha técnica del dominio reconociendo los atributos con **value_type: grid_id**  y **grid_row_id**  que permitirán asociar la información de la guía de talles al momento de crear o modificar una publicación.   Adicionalmente tendrás que reconocer aquellos atributos que cuenten con el tag de **grid_template_required**  los cuales serán requeridos para la búsqueda de la ficha técnica de la guía de talles.

26. Nota:    Tenga en cuenta que la guía de talles tiene una ficha técnica, que es definida según el dominio de la publicación, y así especificamos qué información es necesaria al momento de crear una guía de talles.

27. 

28. Llamada:

29. `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/domains/$DOMAIN_ID/technical_specs`

30. Ejemplo que consulta la ficha técnica del dominio MLA-SNEAKERS:

31. `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/domains/MLA-SNEAKERS/technical_specs`

32. Respuesta con el detalle de la ficha técnica del dominio:

33. `{ "input": { "groups": [ { "id": "MAIN", "label": "Características principales", "relevance": 1, "section": "SPECIFICATIONS", "ui_config": {}, "components": [ { "component": "COMBO", "label": "Marca", "ui_config": { "hint": "Escribe la marca real del producto o 'Genérica' si no tiene marca.", "allow_custom_value": true, "allow_filtering": true }, "attributes": [ { "id": "BRAND", "name": "Marca", "value_type": "string", "value_max_length": 255, "tags": [ "grid_filter", "catalog_required", "required" ], "values": [], "hierarchy": "PARENT_PK", "relevance": 1 } ], "unified_units": [] }, {}, {}, {}, { "component": "COMBO", "label": "Género", "ui_config": { "allow_custom_value": false, "allow_filtering": true }, "attributes": [ { "id": "GENDER", "name": "Género", "value_type": "list", "tags": [ "grid_template_required", "grid_filter", "catalog_required", "required" ], "values": [ { "id": "339665", "name": "Mujer" }, { "id": "339666", "name": "Hombre" }, { "id": "339668", "name": "Niñas" }, { "id": "339667", "name": "Niños" }, { "id": "110461", "name": "Sin género" } ], "hierarchy": "PARENT_PK", "relevance": 1 } ], "unified_units": [] }, {}, {}, {}, {}, { "component": "GRID_ROW_INPUT", "label": "ID de la fila de la guía de talles", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "SIZE_GRID_ROW_ID", "name": "ID de la fila de la guía de talles", "value_type": "grid_row_id", "value_max_length": 255, "tags": [ "vip_hidden", "hidden", "variation_attribute" ], "hierarchy": "CHILD_PK", "relevance": 1 } ], "unified_units": [] }, {} ] }, { "id": "DMT", "label": "Otras características", "relevance": 1, "section": "SPECIFICATIONS", "ui_config": {}, "components": [ {}, {}, {}, {}, {}, { "component": "GRID_INPUT", "label": "ID de la guía de talles", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "SIZE_GRID_ID", "name": "ID de la guía de talles", "value_type": "grid_id", "value_max_length": 255, "tags": [ "vip_hidden" ], "hierarchy": "FAMILY", "relevance": 1 } ], "unified_units": [] }, {}, { "component": "COMBO", "label": "Deportes recomendados", "ui_config": { "allow_custom_value": true, "allow_filtering": true }, "attributes": [ { "id": "RECOMMENDED_SPORTS", "name": "Deportes recomendados", "value_type": "string", "value_max_length": 255, "tags": [ "multivalued", "grid_filter" ], "values": [], "hierarchy": "FAMILY", "relevance": 1 } ], "unified_units": [] }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {} ] } ] }, "output": {} }`

34. 

35. Consulta ficha técnica de la guía de talles

36. Para crear una nueva guía de talles debemos determinar la estructura de sus atributos, para ello deberás realizar un POST al recurso de **/domains/$domain_id/technical_specs?section=grids**  enviando en el body todos los atributos reconocidos al consultar la ficha técnica del dominio con el tag de **grid_template_required** .

37. 

38. Existen 3 tipos de guías de talles: Marca **(BRAND)** , estándar de Mercado Libre **(STANDARD)**  o personalizada/específica **(SPECIFIC)** .

39. 

40. En Uruguay, Colombia, Perú, Ecuador y Chile únicamente contaremos con la experiencia de guía de talles de tipo personalizada/específica (SPECIFIC).

41. 

42. Llamada:

43. `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d{...}https://api.mercadolibre.com/domains/$DOMAIN_ID/technical_specs?section=grids`

44. Ejemplo que consulta el detalle de la ficha técnica para una guía de talles de la marca Nike y el género mujer:

45. `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d ' { "attributes": [ { "id": "BRAND", "name": "Marca", "value_id": "14671", "value_name": "Nike", "value_struct": null, "values": [ { "id": "14671", "name": "Nike", "struct": null } ], "attribute_group_id": "OTHERS", "attribute_group_name": "Otros" }, { "id": "GENDER", "name": "Género", "value_id": "339665", "value_name": "Mujer", "value_struct": null, "values": [ { "id": "339665", "name": "Mujer", "struct": null } ], "attribute_group_id": "OTHERS", "attribute_group_name": "Otros" } ] }' https://api.mercadolibre.com/domains/MLA-SNEAKERS/technical_specs?section=grids`

46. Respuesta con el detalle de la ficha técnica de la guía de talles:

47. Nota:    Ten en cuenta esta respuesta para la especificación del JSON en la [creación de la guía de talles personalizadas](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles#Crear-gu%C3%ADa-de-talles-personalizadas) .

48. `{ "input": { "groups": [ { "id": "SIZE_CHART", "label": "Guía de talles", "relevance": 1, "section": "GRIDS", "ui_config": {}, "components": [ { "component": "GRID", "label": "Guia de Talles", "ui_config": { "max_allowed": 75, "allow_custom_value": true, "allow_filtering": false }, "components": [ { "component": "TEXT_OUTPUT", "label": "Género", "ui_config": {}, "attributes": [ { "id": "GENDER", "name": "Género", "value_type": "string", "tags": [ "grid_template_required", "grid_filter", "fixed", "catalog_required", "required" ], "values": [ { "id": "339665", "name": "Mujer" } ], "hierarchy": "PARENT_PK", "relevance": 1 } ], "unified_units": [] }, { "component": "TEXT_OUTPUT", "label": "Marca", "ui_config": {}, "attributes": [ { "id": "BRAND", "name": "Marca", "value_type": "string", "value_max_length": 255, "tags": [ "grid_filter", "catalog_required", "required" ], "hierarchy": "PARENT_PK", "relevance": 1 } ], "unified_units": [] }, { "component": "TEXT_INPUT", "label": "Edad", "ui_config": {}, "attributes": [ { "id": "AGE_GROUP", "name": "Edad", "value_type": "string", "value_max_length": 255, "tags": [ "hidden", "read_only", "grid_filter" ], "hierarchy": "PARENT_PK", "relevance": 1 } ], "unified_units": [] }, { "component": "TEXT_INPUT", "label": "Estilo", "ui_config": {}, "attributes": [ { "id": "STYLE", "name": "Estilo", "value_type": "string", "value_max_length": 255, "tags": [ "grid_filter", "required" ], "hierarchy": "FAMILY", "relevance": 1 } ], "unified_units": [] }, { "component": "TEXT_INPUT", "label": "Deportes recomendados", "ui_config": {}, "attributes": [ { "id": "RECOMMENDED_SPORTS", "name": "Deportes recomendados", "value_type": "string", "value_max_length": 255, "tags": [ "multivalued", "grid_filter" ], "hierarchy": "FAMILY", "relevance": 1 } ], "unified_units": [] }, { "component": "NUMBER_UNIT_INPUT", "label": "Largo del pie", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "FOOT_LENGTH", "name": "Largo del pie", "value_type": "number_unit", "value_max_length": 255, "tags": [ "required" ], "default_unit_id": "cm", "units": [ { "id": "\"", "name": "\"" }, { "id": "cm", "name": "cm" } ], "hierarchy": "CHILD_PK", "relevance": 1 } ], "default_unified_unit_id": "cm", "unified_units": [ { "id": "\"", "name": "\"" }, { "id": "cm", "name": "cm" } ] }, { "component": "TEXT_INPUT", "label": "Talle de marca", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "MANUFACTURER_SIZE", "name": "Talle de marca", "value_type": "string", "value_max_length": 255, "tags": [ "unique", "main_attribute_candidate" ], "hierarchy": "ITEM", "relevance": 1 } ], "unified_units": [] }, { "component": "NUMBER_UNIT_INPUT", "label": "AR", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "AR_SIZE", "name": "AR", "value_type": "number_unit", "value_max_length": 255, "tags": [ "main_attribute_candidate" ], "default_unit_id": "AR", "units": [ { "id": "AR", "name": "AR" } ], "hierarchy": "CHILD_PK", "relevance": 1 } ], "default_unified_unit_id": "AR", "unified_units": [ { "id": "AR", "name": "AR" } ] }, { "component": "NUMBER_UNIT_INPUT", "label": "US-F", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "F_US_SIZE", "name": "US-F", "value_type": "number_unit", "value_max_length": 255, "tags": [ "main_attribute_candidate" ], "default_unit_id": "US", "units": [ { "id": "US", "name": "US" } ], "hierarchy": "CHILD_PK", "relevance": 1 } ], "default_unified_unit_id": "US", "unified_units": [ { "id": "US", "name": "US" } ] }, { "component": "NUMBER_UNIT_INPUT", "label": "EU", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "EU_SIZE", "name": "EU", "value_type": "number_unit", "value_max_length": 255, "tags": [ "main_attribute_candidate" ], "default_unit_id": "EU", "units": [ { "id": "EU", "name": "EU" } ], "hierarchy": "CHILD_PK", "relevance": 1 } ], "default_unified_unit_id": "EU", "unified_units": [ { "id": "EU", "name": "EU" } ] }, { "component": "NUMBER_UNIT_INPUT", "label": "UK", "ui_config": { "allow_custom_value": false, "allow_filtering": false }, "attributes": [ { "id": "UK_SIZE", "name": "UK", "value_type": "number_unit", "value_max_length": 255, "tags": [ "main_attribute_candidate" ], "default_unit_id": "UK", "units": [ { "id": "UK", "name": "UK" } ], "hierarchy": "CHILD_PK", "relevance": 1 } ], "default_unified_unit_id": "UK", "unified_units": [ { "id": "UK", "name": "UK" } ] } ] } ] } ] } }`

49. Al consultar la ficha técnica de la guía de talles en dominios de **TOPS and BOTTOMS**  se encontrará un tipo de dato **list**  el cual determina los posibles valores de una Lista, estos valores se deben tener en cuenta al momento de [crear una guía de talles personalizada](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles?nocache=true#Crear-gu%C3%ADa-de-talles-personalizadas) en dichos dominios.

50. `"attributes": [ { "id": "FILTRABLE_SIZE", "name": "Talle estándar", "value_type": "list", "value_max_length": 255, "tags": [ "vip_hidden", "hidden", "read_only", "variation_attribute", "required" ], "values": [ { "id": "4147746", "name": "26" }, { "id": "3259523", "name": "27" }, { "id": "3259504", "name": "28" }, { "id": "3259505", "name": "29" }, { "id": "3259506", "name": "30" }, { "id": "3259507", "name": "31" }, { "id": "3189126", "name": "32" }, { "id": "3189128", "name": "33" }, { "id": "3189130", "name": "34" }, { "id": "4608574", "name": "35" }, { "id": "3259450", "name": "36" }, { "id": "3259451", "name": "38" }, { "id": "3189142", "name": "40" }, { "id": "3259453", "name": "42" }, { "id": "3259454", "name": "44" }, { "id": "3189154", "name": "46" }, { "id": "3189158", "name": "48" }, { "id": "3189161", "name": "50" }, { "id": "4146158", "name": "52" }, { "id": "3259459", "name": "54" }, { "id": "3259460", "name": "56" }, { "id": "4294027", "name": "58" }, { "id": "4294028", "name": "60" }, { "id": "3259463", "name": "62" }, { "id": "3259464", "name": "64" }, { "id": "3259465", "name": "66" }, { "id": "3259466", "name": "68" }, { "id": "2920269", "name": "70" }, { "id": "5576727", "name": "72" }, { "id": "5576729", "name": "74" }, { "id": "5576730", "name": "76" } ], "hierarchy": "ITEM", "relevance": 2 } ]`

51. Adicionalmente para dominios de TOPS and BOTTOMS se permite la creación de guía de talles especificando medidas de corporales o medidas de la prenda, ambos casos podrás reconocerlos desde la ficha técnica por medio de tags BODY_MEASURE o CLOTHING_MEASURE.

52. 

53. Ejemplo del atributo GARMENT_LENGTH_FROM usado en medidas de prenda:

54. `"attributes": [ { "id": "GARMENT_LENGTH_FROM", "name": "Largo de la prenda desde", "value_type": "number_unit", "value_max_length": 255, "tags": [ "CLOTHING_MEASURE", "required" ], "default_unit_id": "cm", "units": [ { "id": "\"", "name": "\"" }, { "id": "cm", "name": "cm" } ], "hierarchy": "CHILD_DEPENDENT", "relevance": 3 } ]`

55. 

56. Búsqueda de guía de talles

57. Con el recurso **/catalog/charts/search**  podrás realizar un POST y reconocer las guía de talles que se sugieren para que el vendedor use en sus publicaciones. Si necesitas ver más de 100 registros, puede configurar el tamaño de página de la lista de resultados con los parámetros "offset" y "limit".

58. 

59. Llamada:

60. `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d {...} https://api.mercadolibre.com/catalog/charts/search?offset=1&limit=100`

61. Ejemplo para una búsqueda de guía de talles disponibles de tipo BRAND Adidas, género Mujer en el dominio de SNEAKERS:

62. `curl -X POST 'https://api.mercadolibre.com/catalog/charts/search' -H 'x-caller-id: 123456' -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' --data-raw '{ "domain_id": "SNEAKERS", "site_id": "MLA", "seller_id": 123456, "attributes": [ { "id": "GENDER", "values": [ { "name": "Mujer" } ] }, { "id": "BRAND", "values": [ { "name": "adidas" } ] } ] }'`

63. Previo a realizar búsquedas de guía de talles debes tener en cuenta el atributo con el tag **grid_template_required**  en la [ficha técnica](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Consultar-ficha-tecnica) este define los atributos del POST. En todos los casos **dominio** , **site** , **seller**  son obligatorios.

64. 

65. 

66. Si en el body del POST se envía:

67. Sin **type**  se retornan todos los resultados de guía personalizada, estándar y por marca. De acuerdo a los filtros enviados en el POST.   Con **type** = **SPECIFIC**  se retornan todos los resultados de guía personalizada, de acuerdo a los filtros enviados en el POST de acuerdo al género que se envíe.   Con **type** =**STANDARD**  se retornan todos los resultados de guía estándar de acuerdo a los filtros enviados en el POST.   Con **type** =**BRAND**  se retornan todos los resultados de guía por marca de acuerdo a los filtros enviados en el POST.

68. Respuesta:

69. Como respuesta se obtendrán todos los chart_id que arroje como resultado la búsqueda de guía de acuerdo a los filtros enviados y la paginación configurada

70. `{ "paging": { "total": 6, "offset": 1, "limit": 100 }, "charts": [ { "id": "426237", "names": { "MLA": "Guia de talles de calzado de mujer de adidas TEST APPAREL" }, "domain_id": "SNEAKERS", "type": "BRAND", "main_attribute_id": "EU_SIZE", "secondary_attribute_id": "F_US_SIZE", "attributes": [], "rows": [] }, { "id": "426238", "names": { "MLA": "Guía de talles Standard de calzado de mujer TEST" }, "domain_id": "SNEAKERS", "type": "STANDARD", "main_attribute_id": "AR_SIZE", "secondary_attribute_id": "F_US_SIZE", "attributes": [], "rows": [] }, {}, {}, {}, {} ] }`

71. De igual manera puedes usar en la llamada el filtro o atributo de **main_attribute_id**  para el siguiente ejemplo estamos utilizando UZ_SIZE:

72. `curl -X POST 'https://api.mercadolibre.com/catalog/charts/search' -H 'x-caller-id: 123456' -H 'Content-Type: application/json' -H 'Authorization: Bearer $ACCESS_TOKEN' --data-raw '{ "domain_id": "SNEAKERS", "site_id": "MLA", "seller_id": 123456, "attributes": [ { "id": "GENDER", "values": [ { "name": "Mujer" } ] }, { "id": "BRAND", "values": [ { "name": "adidas" } ] } ] }'`

73. Si la búsqueda no cuenta con resultados de tablas sugeridas, la respuesta que obtendrás es la siguiente y deberás primero [crear guía de talles](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles#Crear-gu%C3%ADa-de-talles-personalizadas) para el vendedor:

74. `{ "paging": { "total": 0, "offset": 1, "limit": 50 }, "charts": [] }`

75. En caso de que realices una búsqueda con un dominio que no esté configurado con la nueva guía de talles, recibirás un error.

76. `{ "error": "domain_not_active", "message": "Domain MLA-HATS_AND_CAPS is not active to be used in charts.", "status": 400 }`

77. 

78. Dominios de Marca y Estándar

79. Importante:   Este recurso únicamente tiene uso para Argentina, México y Brasil, donde existen guía de talles de tipo marca y estándar. No recomendamos su uso para reconocer qué dominios están disponibles para la asignación de guía de talles a las publicaciones, para esto deben usar el recurso de [Dominios disponibles para guía de talles](https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-es#Dominios-disponibles).

80. Este recurso tiene como objetivo informar los dominios que actualmente tienen guía de talles creadas ya sea de **marca (BRAND)**  o **estándar (STANDARD)**  para un site específico y que pueden ser utilizadas por el vendedor en sus publicaciones.

81. 

82. Debes enviar en el body del POST el filtro de **type=BRAND**  o **type=STANDARD**  y el site correspondiente.

83. 

84. Nota:    La guía de talles estándar de Mercado Libre y de la Marca ya cuentan con toda la información requerida completa (Ficha técnica y valores).

85. Llamada:

86. `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d{...}https://api.mercadolibre.com/catalog/charts/domains/search`

87. Ejemplo de dominios configurados con guía por marca:

88. `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d ' { "site_id": "MLA", "type": "BRAND" }' https://api.mercadolibre.com/catalog/charts/domains/search`

89. Ejemplo de dominios configurados con guía estándar:

90. `curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d ' { "site_id": "MLA" "type": "STANDARD" }' https://api.mercadolibre.com/catalog/charts/domains/search`

91. Respuesta:

92. `{ "domains": [ { "domain_id": "SNEAKERS" }, { "domain_id": "BOOTS_AND_BOOTIES" }, { "domain_id": "SANDALS_AND_CLOGS" }, { "domain_id": "LOAFERS_AND_OXFORDS" }, { "domain_id": "FOOTBALL_SHOES" }, { "domain_id": "SNEAKERS_TEST" } ] }`

93. **Siguiente** : [Gestionar guía de talles](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles).
