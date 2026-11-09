<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/diagnostico-imagenes -->
<!-- Sección: Recursos de la API > Moderaciones -->

# Diagnóstico de imágenes

Última actualización 29/12/2025

## Diagnóstico de imágenes

La **API de diagnóstico de imágenes**  permite validar imágenes antes de asociarlas a una publicación en Mercado Libre. Su objetivo es detectar problemas y retornar mensajes claros para que el usuario pueda corregirlos antes de publicar, evitando moderaciones y mejorando la experiencia.

Esta funcionalidad permite:

- Obtener solo los problemas actuales de una imagen.

- Diagnosticar antes de asociar la imagen a la publicación.

- Mostrar mensajes claros (wordings) para que el seller pueda corregir errores fácilmente.

Nota:

Actualmente esta API sólo diagnostica por los siguientes criterios (según corresponda por categoría):

- Fondos no blancos (white_background).

- Incumplimiento de tamaño mínimo (minimum_size).

- Textos o logos no permitidos (text_logo).

- Marcas de agua (watermark).

# Cuándo y cómo usarla

Siempre debes usar esta API antes de asociar una imagen a una publicación, durante el proceso de carga de imágenes, tanto para la imagen principal, variantes o imágenes secundarias.

**Llamada:**

```
curl -L -X POST 'https://api.mercadolibre.com/moderations/pictures/diagnostic' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
  "picture_url": "URL_DE_LA_IMAGEN_O_BASE64_O_PICTURE_ID",
  "context": {
    "category_id": "ID_CATEGORIA",
    "title": "TITULO_PUBLICACION", 
    "picture_type": "thumbnail"

  }
}'
```

**Ejemplo:**

```
curl -L -X POST 'https://api.mercadolibre.com/moderations/pictures/diagnostic' \
--H 'Content-Type: application/json' \
--H 'Authorization: Bearer $ACCESS_TOKEN' \
--d '{
  "id": "f0b6198b-a4ef-4291-82a5-41956e0af96e",
  "picture_url": "https://miurl.com/mi_imagen.jpg",
  "context": {
    "category_id": "MLA1346",
    "title": "This a item title",
    "picture_type": "thumbnail"
  }
}'
```

**Campos del body:**

| Atributo | Descripción | Obligatorio | Observación |
| --- | --- | --- | --- |
| **id** | Identificador del diagnóstico | No | Si no se envía se genera automáticamente. |
| **picture_url** | Puede ser una URL pública o una cadena en base64. | Sí | formatos:   **URL:**  https://{{picture}} **Base64:** data:[][;base64],< data> |
| **picture_id** | Id generado para fotos existentes en el CDN de Meli | Sí | Ej: 123456-MLAXXXXX_782025 |
| **context** | Información adicional contextual | Sí |  |
| **context.category_id** | ID de la categoría del ítem. Define las reglas de validación aplicables. | Sí | Se eligen los criterios a evaluar dependiendo de la categoría donde se desea usar la foto. **Para casos donde la categoría enviada no exista, solo se evaluará el minimum_size** |
| **context.title** | Título de la publicación | No | Recomendado para mayor contexto de la publicación |
| **context.picture_type** | Tipo de imagen (thumbnail \| variation_thumbnail \| other). Obligatorio si sabes donde se usara la imagen | No | Indica dónde se va a usar la foto dentro del ítem, si se entrega, filtra el resultado, si no, se evalúan todas. |

Nota:

Al cargar imágenes, el campo que debés utilizar en el body de la request depende del tipo de dato que vas a enviar:

- Si vas a enviar el ID de una imagen ya existente en el CDN, utilizá el campo picture_id.

- Si vas a enviar una URL o la imagen en base64, utilizá el campo picture_url.

Recordá: siempre se debe enviar solo uno de estos campos por imagen.

URLs validas

Al enviar una imagen en el campo picture_url, ten presente que la URL debe ser pública, estática y accesible. Mercado Libre no gestiona la obtención ni el acceso a imágenes alojadas en plataformas externas sin los permisos correctos; el integrador es responsable de proporcionar una URL válida para que nuestra API pueda procesarla correctamente.

# Qué es el picture_type y para qué sirve?

El campo **picture_type**  indica el rol o el lugar que ocupará la imagen dentro de la publicación. Es fundamental para que la API realice las validaciones correctas según el uso real de la imagen.

Existen tres valores posibles:

- **thumbnail:**  Imagen principal de la publicación. Es la foto más importante, la que primero ve el comprador y la que tiene reglas más estrictas.

- **variation_thumbnail:**  Imagen de una variante del producto (por ejemplo, diferentes colores o tallas). También tiene reglas estrictas, pero pueden variar respecto a la imagen principal.

- **other:**  Imágenes secundarias o adicionales, como fotos de detalles o ángulos diferentes. Tienen reglas más flexibles.

```
 //Para la imagen principal 
"picture_type": "thumbnail"

//Para una variante
"picture_type": "variation_thumbnail"

//Para una imagen secundaria
"picture_type": "other"
```

Importante:

- Si sabes dónde se usará la imagen, SIEMPRE especifica el **picture_type** .

- Si no lo especificas, la API devolverá diagnósticos para los tres tipos, pero deberás filtrar y mostrar solo el que corresponda según el uso real de la imágen.

# Respuesta

Cuando se realiza un análisis de imagen **sin picture_type** , la API devuelve una estructura como esta:

```
{
  "id": "f0b6198b-a4ef-4291-82a5-41956e0af96e",
  "diagnostics": [
    {
      "picture_type": "thumbnail",
      "action": "diagnostic",
      "detections": [
        {
          "name": "text_logo",
          "wordings": [
            {
              "kind": "REMEDY_SHORT",
              "value": "Elimina tus fotos que contienen logos y/o textos."
            }
          ]
        },
        {
          "name": "white_background",
          "wordings": [
            {
              "kind": "REMEDY_SHORT",
              "value": "El fondo de tu foto debe ser blanco digitalizado."
            }
          ]
        }
      ]
    },
    {
      "picture_type": "variation thumbnail",
      "action": "diagnostic",
      "detections": [
        {
          "name": "text_logo",
          "wordings": [
            {
              "kind": "REMEDY_SHORT",
              "value": "Elimina tus fotos que contienen logos y/o textos."
            }
          ]
        },
        {
          "name": "white_background",
          "wordings": [
            {
              "kind": "REMEDY_SHORT",
              "value": "El fondo de tu foto debe ser blanco digitalizado."
            }
          ]
        }
      ]
    },
    {
      "picture_type": "other",
      "action": "empty",
      "detections": []
    }
  ]
}
```

# Campos de respuesta

- **id:**  identificador del diagnóstico

- **diagnostics:**  Listado de detecciones por tipo de imagen.   **picture_type:**  Tipo de foto para la cual aplica la detección (thumbnail | variation_thumbnail | other)   **action:**  Si es "diagnostic", hay problemas a corregir. Si es "empty", la imagen es válida.   **detections:**  Listado de todas las detecciones que fueron encontradas para la foto (si la acción es "empty", se retorna vacío este campo).   **name:**  Tipo de problema detectado   **wordings:**  Mensajes claros para mostrar al usuario y guiar la corrección.   **kind:**  Tipo de wording (siempre **REMEDY_SHORT** )   **value:**  Valor del wording al usuario final.

## Buenas prácticas y recomendaciones

- **Siempre especifica el picture_type**  si sabes dónde se usará la imagen. Así vas a obtener diagnósticos precisos y relevantes.

- **Valida cada imagen al momento de cargarla** , antes de asociarla a la publicación.

- **Muestra los mensajes de la API directamente al usuario** , para que pueda corregir los problemas antes de publicar.

- **No bloquees el flujo si la API falla** : permite continuar, pero informa que no se pudo validar la imagen.

- **Si recibes diagnósticos para varios tipos de imagen** , filtra y muestra solo el que corresponda según el uso real de la imagen.

- **Prioriza la validación de la imagen principal (thumbnail)** , ya que es la más relevante para la publicación.

**Siguiente:**  [Moderaciones de Imágenes](https://developers.mercadolibre.com.ar/es_ar/moderaciones-de-imagenes)
