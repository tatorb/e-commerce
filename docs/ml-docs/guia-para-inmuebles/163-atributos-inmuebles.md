<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/atributos-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Atributos

Última actualización 24/11/2025

## Atributos

### Attributes API: descubre los atributos clave que necesitas para publicar

Cada tipo de inmueble es único y se define por sus características particulares, como si una casa tiene patio, piscina, quincho o un departamento tiene balcón, estacionamiento, logia. A estas características las llamamos "atributos". Para publicar tu inmueble de prueba correctamente, necesitas conocer los atributos que exige MercadoLibre para la categoría que seleccionaste.

Seguí los siguientes pasos para identificar los atributos obligatorios.

## Uso del endpoint /attributes

Utiliza el endpoint de /attributes de la API de MercadoLibre, especificando la categoría final que seleccionaste.

**Ejemplo:**  Si la categoría final es **MLA401685**  para Casas en venta como Propiedades Individuales en Argentina, ejecuta la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/categories/MLA401685/attributes
```

Nota:

Recuerda utilizar el token que generaste para tu usuario de prueba en el punto 4 de la guía [Configuración](https://developers.mercadolibre.com.ar/es_ar/configuracion-o-requisitos-previos)

La respuesta JSON que recibirás es extensa. Al principio, encontrarás información resumida sobre la categoría que estás consultando. Posteriormente, encontrarás la lista de atributos necesarios para tus publicaciones.

**Importante:**

Debes proporcionar todos los atributos que tengan el valor 'required': true dentro del campo "tags". Estos son los atributos obligatorios para que tu publicación sea válida..

Por ejemplo los siguientes campos:

```
{
  "id": "COVERED_AREA",
  "name": "Superficie útil",
  "tags": {
    "required": true,
    "catalog_listing_required": true
  },
  "hierarchy": "ITEM",
  "relevance": 1,
  "value_type": "number_unit",
  "value_max_length": 255,
  "allowed_units": [
    { "id": "m²", "name": "m²" }
  ],
  "default_unit": "m²",
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
},
{
  "id": "BEDROOMS",
  "name": "Dormitorios",
  "tags": {
    "required": true,
    "catalog_listing_required": true
  },
  "hierarchy": "ITEM",
  "relevance": 1,
  "value_type": "number",
  "value_max_length": 18,
  "attribute_group_id": "FIND",
  "attribute_group_name": "Ficha técnica"
}
```

Cada atributo cuenta con la siguiente estructura:

| Parámetro | Tipo | Valores |
| --- | --- | --- |
| id | String | Id del atributo, por ejemplo "BEDROOMS", “COVERED_AREA”, “TOTAL_AREA“, etc. |
| name | String | Nombre del atributo, ejemplo: "Dormitorios", “Superficie útil”, “Superficie total”, etc |
| tags | Object | Este campo nos dice cuando el atributo es requerido. |
| hierarchy | String | "ITEM" |
| relevance | Integer | 1 |
| value_type | String | El tipo de dato del atributo al momento de publicar, por ejemplo "number". |
| value_max_length | Integer | Tamaño máximo para el atributo, ejemplo 18 para BEDROOMS |
| attribute_group_id | String | Si pertenece a este grupo se puede filtrar por esta característica en la publicación "FIND" |
| attribute_group_name | String | El grupo al que pertenece el atributo por ejemplo "Ficha técnica" o “Otro” |

## Atributos Importantes a tener en Cuenta

Al realizar la consulta mediante la API, nos encontraremos los siguientes atributos esenciales al momento de crear tus publicaciones de inmuebles:

1. **Precio:**   **Obligatoriedad** : El precio es un atributo obligatorio y debe estar incluido en la publicación.  **Formato** : Debe ser un valor numérico que represente el precio de venta o alquiler de la propiedad.

2. 

3. **Moneda:**   **Obligatoriedad** : La moneda es un atributo obligatorio.  **Identificación** : Debes definir la moneda utilizando un ID preestablecido.  **Obtención de IDs** : Los IDs de monedas disponibles se obtienen llamando a la categoría donde deseas publicar tu artículo. Consulta nuestra guía [Categorías](https://developers.mercadolibre.com.ar/%E2%80%9Chttps://developers.mercadolibre.com.ar/es_ar/categorias-inmuebles%E2%80%9D) para más información.

4. 

5. **Gasto Común (Expensas):**   **Atributo** : Utiliza el atributo **MAINTENANCE_FEE** .  **Obligatoriedad** : Este atributo es obligatorio.  **Valor** : Incluye el valor monetario del gasto común mensual en la moneda correspondiente del país (cada moneda tiene un ID preestablecido).

6. 

7. **Mascotas:**   **Atributo** : Utiliza el atributo **IS_SUITABLE_FOR_PETS** .  **Obligatoriedad** : Este atributo es obligatorio y debe ser enviado.  **Valores** : Los valores definidos son "Sí" o "No" ( junto con el ID preestablecido correspondiente) para indicar si se aceptan mascotas.

8. 

9. **Estacionamiento:**   **Atributo** : Utiliza el atributo **PARKING_LOTS** .  **Obligatoriedad** : Este es un valor numérico obligatorio.  **Valor** : Indica el número de espacios de estacionamiento con los que cuenta la propiedad.

10. 

11. **Bodega (Almacenamiento):**   **Atributo** : Utiliza el atributo **WAREHOUSES** .  **Obligatoriedad** : Este es un valor numérico obligatorio.  **Valor** : Indica el número de espacios de bodega con los que cuenta la propiedad.

12. 

13. **Baños Completos:**   **Atributo** : Utiliza el atributo **FULL_BATHROOMS** .  **Obligatoriedad** : Este es un valor numérico obligatorio.  **Valor** : Indica la cantidad de baños completos con los que cuenta la propiedad.

14. 

15. **Amoblado:**   **Atributo** : Utiliza el atributo **FURNISHED** .  **Obligatoriedad** : Este atributo es obligatorio.  **Valores** : Indica si la propiedad se encuentra amueblada con "Sí" o "No" ( junto con el ID correspondiente).

16. 

17. **Tipo de Publicación:**   **Atributo** : Utiliza el atributo **Listing Type** .  **Descripción** : Se refiere al plan contratado para la publicación.  **Obligatoriedad** : Es un atributo obligatorio que solo acepta valores predefinidos.  Obtención de Listing Types: Debes realizar una llamada a través de los sites y recursos listing_types para conocer los tipos de publicación soportados.  **Guía** : Sigue nuestra guía [guía](https://developers.mercadolibre.com.ar/%E2%80%9Chttps://developers.mercadolibre.com.ar/es_ar/gestionar-paquetes-de-inmuebles%E2%80%9D) para saber qué tipo de publicación te convendrá más para tu propiedad.

18. 

19. **Cantidad Disponible:**   **Atributo** : Utiliza el atributo **available_quantity** .  **Valor** : Siempre se debe enviar "1".  **Representación** : Representa la cantidad de ítems de la publicación. En MercadoLibre, las publicaciones de clasificados no trabajan con stock; cada una representa un registro de inmueble, vehículo o servicio único.

20. 

21. **Condición:**   **Atributo** : Utiliza el atributo **Condition** .  **Descripción** : Representa la condición del inmueble, si es nuevo o usado.  **Valores Posibles** : Puede ser "new", "used" o "not_specified", dependiendo de la condición de la publicación.

Para mayor información puedes consultar la sección de [Atributos específicos de las categorías](https://developers.mercadolibre.com.ar/es_ar/categorias-y-atributos-inmuebles#Atributos-espec%C3%ADficos) de esta la guía de categorías y atributos.

## Atributos adicionales

Además de los atributos consultados mediante la API, existen otros aspectos importantes que debes considerar al crear tus publicaciones de inmuebles

### 1. Título de la publicación

- **Formato:**  El título debe seguir el siguiente formato: Tipo de Operación (Alquiler/Venta/Alquiler Temporario) + Tipo de Propiedad + Ambientes + Barrio.

- **Importancia:**  Las palabras clave en el título son cruciales, ya que coinciden con las búsquedas de los usuarios. Un título preciso y completo mejora la visibilidad de tu publicación.

- **Recomendación:**  Evita adjetivos y abreviaciones. Utiliza términos claros y específicos.

Ejemplo:

```
title:  "Venta Departamento 4 ambientes Recoleta."
```

### 2. Descripción del Inmueble

- **Formato:**  La descripción debe ser texto plano, sin formato HTML ni etiquetas.

- **Restricciones:**  No incluyas información de contacto (teléfono, dirección, sitio web). Incluir esta información resultará en la moderación o penalización de la publicación.

- **Proceso de Creación:**  Primero, crea la publicación sin descripción. Luego, añade la descripción enviando un **POST**  al recurso /items/$ITEM_ID/description.

Para conocer más puedes consultar en [descripción de productos](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos).

Ejemplo:

```
curl -L -X POST 'https://api.mercadolibre.com/items/$ITEM_ID/description' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "plain_text":"Descripción con Texto Plano  \n"
}'
```

### 3. Ubicación del inmueble

- **Obligatoriedad:**  La ubicación es obligatoria para los anuncios clasificados.

- **Niveles de Ubicación:**  MercadoLibre utiliza cuatro niveles: país (country), estado, ciudad (city) y barrio (neighborhood).

- **Requisito Mínimo:**  Debes proporcionar al menos la ciudad (city) o el barrio (neighborhood).

Para conocer la información necesaria consulta la sección de [Localiza inmuebles.](https://developers.mercadolibre.com.ar/es_ar/localizar-inmuebles)

### 4. Contactos del vendedor

- **Opcionalidad:**  Los datos de contacto del vendedor son opcionales. Si no se proporcionan, se utilizarán los datos de la cuenta del vendedor.

- **Notificaciones por Correo Electrónico:**  Las preguntas de los compradores se envían al correo electrónico del vendedor (campo **seller_contact.email** ). Si no se especifica, se usará el correo de la cuenta del vendedor.

- **Gestión de Preguntas por API:**  Utiliza la guía [Gestiona preguntas y respuestas](https://developers.mercadolibre.com.ar/es_ar/gestiona-preguntas-respuestas).

- **Restricción "seller_contact"** : "not_allowed": Si este campo está configurado como "not_allowed", la categoría no permitirá cargar información de contacto.

- **Contactos por WhatsApp:**  Los campos **country_code2** , **area_code2** , **phone2**  permiten recibir contactos por WhatsApp.

Ejemplo:

```
seller_contact: {
  contact: "Nome Contato Teste",
  area_code: "11",
  phone: "4444-5555",
  area_code2: "21",
  phone2: "1111-3333",
  email: "contact-email@somedomain.com"
}
```

### 5. Imágenes del inmueble

**Importante:**

Con el objetivo de elevar la calidad de las publicaciones y garantizar una mejor experiencia a los compradores, a partir del **20 de enero de 2026** , será **obligatorio el envío de al menos una imagen**  para todas las publicaciones creadas con **Listing Type Silver** .

De esta forma, ya **no será posible crear el anuncio primero y agregar las imágenes posteriormente** . Las peticiones de creación de publicaciones con Listing Type Silver que no contengan el array de imágenes (“pictures”) serán rechazadas.

Recomendamos que **ajusten sus desarrollos**  para incluir el campo “pictures” en el payload de la petición POST /items antes de la fecha límite, para que no tengan las **publicaciones moderadas** .

- **Importancia:**  Las imágenes atractivas mejoran la presentación de tu propiedad y ofrecen una idea clara a los usuarios.

- **Cantidad de Imágenes:**  Consulta la sección de [categorías](https://developers.mercadolibre.com.ar/%E2%80%9Chttps://developers.mercadolibre.com.ar/es_ar/categorias-inmuebles%E2%80%9D), específicamente los campos max_pictures_per_item y max_pictures_per_item_var para conocer la cantidad máxima permitida por categoría.

- **Recomendación:**  No utilices servidores lentos para alojar las imágenes. Esto puede afectar negativamente la publicación.

- **Actualización de Imágenes:**  Puedes agregar o cambiar imágenes después de publicar el anuncio.

- **Guía de Imágenes:**  Consulta [Trabajar con imágenes](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes) para obtener información detallada sobre los tipos de imágenes permitidas y cómo gestionarlas.

- **Cantidad Mínima de Imágenes:**  La cantidad mínima de imágenes influye en la calidad de la publicación y varía según el tipo de propiedad:  Grupo 1 (Casas/Departamentos/Oficinas/Parcelas): 12 fotos. Grupo 2 (Locales/Agrícolas/Sitios/Terrenos/Bodegas/Loteos): 6 fotos. Grupo 3 (Estacionamientos): 4 fotos.

Ejemplo:

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

### Siguientes Pasos

Antes de publicar tu inmueble de prueba, es crucial asegurarte de que estés correctamente geolocalizado. Conoce más en [Localizar inmuebles](https://developers.mercadolibre.com.ar/es_ar/localizar-inmuebles).

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 05/11/2025 | 1.0 | Publicación Inicial |
