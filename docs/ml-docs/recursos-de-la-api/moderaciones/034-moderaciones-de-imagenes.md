<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/moderaciones-de-imagenes -->
<!-- Sección: Recursos de la API > Moderaciones -->

# Moderaciones de imágenes

Última actualización 21/07/2025

## Moderaciones de imágenes

Las publicaciones pueden ser moderadas debido a problemas de calidad en las imágenes. Estas moderaciones pueden presentarse con el status **active**  o **paused**  y el tag **poor_quality_thumbnail** . 
 Conoce recomendaciones para sacar buenas fotos de [Productos](https://www.mercadolibre.com.ar/ayuda/Sacar-bue-nas-fotos-productos_805), [Moda](https://www.mercadolibre.com.ar/ayuda/22140), [Vehículos](https://www.mercadolibre.com.ar/ayuda/Sacar-bue-nas-fotos-vehiculos_806), [Inmuebles](https://www.mercadolibre.com.ar/ayuda/Sacar-buenas-fotos-de-inmuebles_807) y Servicios.

## Flujo recomendado para carga sin moderaciones

1. Utiliza la [API de diagnóstico de imágenes](https://developers.mercadolibre.com.ar/diagnostico-imagenes?nocache=true) para imágenes base64, picture_id (para fotos existentes en el CDN de Meli) y URL

2. Para cargar imágenes en el CDN de Meli, podes utilizar el endpoint https://api.mercadolibre.com/pictures/items/upload.

3. 

4. 

5. Consultar items con moderación de imágenes

6. **Llamada:**

7. `curl -L -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'https://api.mercadolibre.com/moderations/last_moderation/$MODERATION_REFERENCE_ID'`

8. Nota:   Para comprender cómo obtener **MODERATION_REFERENCE_ID**  pueden verlo en la sección de ‘Gestionar Moderaciones’

9. Ejemplos de respuesta:

10. **Marca de agua**

11. `[ { "name": "WATERMARK", "id": "7123400333", "date_created": "2022-03-22 09:08:06.0", "wordings": [ { "type": "REASON", "value": "La foto de portada contiene marcas de agua. Corregila para recuperar exposición." }, { "type": "REMEDY", "value": "Corregí tus fotos de portada. Eliminá tus fotos que contienen marcas de agua." } ], "evidence": [ { "text_matched": "623362-MLA31659909568_082019", "section_name": "pictures" } ] } ]`

12. **Múltiple por fotos:**

13. `[ { "name": "MULTIPLE", "id": "7123400444", "date_created": "2025-04-30 14:45:59.0", "wordings": [ { "type": "REASON", "value": "Algunas fotos de portada no cumplen con nuestros requisitos de fotos." }, { "type": "REMEDY", "value": "Corrige tus fotos:El producto debe estar bien iluminado. Puedes corregirla con nuestro editor. Encontrarás el acceso en el botón del lápiz, sobre la foto que quieras modificar.Tu producto no debe verse cortado o tocar los bordes de la imagen.Elimina tus fotos que contienen marcas de agua." } ], "evidence": [ { "text_matched": "785537-MLU84244573037_042025", "section_name": "pictures" } ] } ]`

14. `[ { "name": "MULTIPLE", "id": "7123400555", "date_created": "2022-06-18 13:21:35.0", "wordings": [ { "type": "REASON", "value": "Algunas fotos de portada no cumplen con nuestros requisitos de fotos." }, { "type": "REMEDY", "value": "Corrige tus fotos:Eliminá tus fotos que contienen marcas de agua.Eliminá tus fotos que contienen logos y/o textos." } ], "evidence": [ { "text_matched": "947645-MLA47645285814_092021", "section_name": "pictures" }, { "text_matched": "835521-MLA47645265981_092021", "section_name": "pictures" } ] } ]`

15. Conoce más sobre [cómo trabajar con imágenes](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes).
