<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes -->
<!-- Sección: Guía para productos -->

# Imágenes

Última actualización 24/03/2026

## Imágenes en publicaciones

Al publicar un artículo, dependiendo el tipo de publicación, las imágenes pueden ser obligatorias y marcan una gran diferencia respecto de la calidad, es decir, atraerán más visitas y mejorarán las posibilidades de vender. Cuando publicas un artículo nuevo, puedes agregar imágenes en ese momento. En esta guía, puedes ver cómo cargar imágenes a nuestros servidores y agregarlas a tus artículos. Lee más sobre la importancia de las imágenes, [las fotos son tu vidriera, ¡lucite!](https://www.mercadolibre.com.ar/ayuda/805).

## Recomendaciones para subir imágenes

- **Formato**  JPG, JPEG y PNG.

- **Calidad**  La **imagen RGB**  es mejor que CMYK y debe ocupar el 95% del espacio.

- **Cantidad**  identifica el máximo de imágenes por publicación permitidas (max_pictures_per_item y max_pictures_per_item_var) según su categoría.

- **Tamaño**

- Puedes cargar imágenes de **hasta 10 MB** .

- Sube **imágenes de 1200 x 1200 px** . Si son más grandes, las editaremos para que mantengan el tamaño mencionado.

- El **tamaño máximo aceptado es 1920 x 1920 px**  (versión F) y el **mínimo es 500px x 500px**  (versión M). Si la imagen tiene mayor resolución, será redimensionada a la versión F. Si tiene un tamaño menor al mínimo, quedará con el mismo tamaño (no agrandaremos la imagen).

- Si el **ancho de la imagen es mayor a 800 px, activamos un widget de zoom**  para que cuando los compradores pasen el mouse sobre la imagen puedan verla en primer plano. Recomendable para Indumentaria e Inmuebles.

## Validar y cargar una imagen

Este recurso te permite, previo a subir una imagen, realizar la validación online del tamaño de la imagen enviada a través de un proceso smartcrop que elimina el fondo sobrante para que el producto tenga una relación adecuada con el tamaño de la imagen.

Llamada:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN'  \
-H 'content-type: multipart/form-data' \
-F 'file=@FILE' \
'https://api.mercadolibre.com/pictures/items/upload'
```

Nota:

El endpoint solo soporta subidas multipart (de data directa) y para ítem.

Ejemplo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN'  \
-H 'content-type: multipart/form-data' \
-F 'file=@/Users/Documents/test.jpg' \
'https://api.mercadolibre.com/pictures/items/upload'
```

La respuesta con los dominios nuevos tendrán una D_NQ_NP_ al principio de la uri:

```
{
   "id": "123-MLA456_112021",
   "variations": [
       {
           "size": "1920x1076",
           "url": "http://http2.mlstatic.com/D_NQ_NP_123-MLA456_112021-F.jpg",
           "secure_url": "https://http2.mlstatic.com/D_NQ_NP_123-MLA456_112021-F.jpg"
       },
       {
           "size": "500x280",
           "url": "http://http2.mlstatic.com/D_NQ_NP_123-MLA456_112021-O.jpg",
           "secure_url": "https://http2.mlstatic.com/D_NQ_NP_123-MLA456_112021-O.jpg"
       },
       {
           "size": "400x400",
                 "url": "http://http2.mlstatic.com/D_NQ_NP_123-MLA456_112021-C.jpg",
           "secure_url": "https://http2.mlstatic.com/D_NQ_NP_123-MLA456_112021-C.jpg"
       },
[...]
}
```

Te recomendamos utilizar el id obtenido para realizar una nueva publicación o asociar la imagen a una publicación existente.

## Vincular una imagen a tu artículo

Con el picture_id antes obtenido, puedes vincular la imagen a tu artículo, así:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -H "Accept: application/json" -d
'{
   "id":"MLA430387888_032012"
}'
'https://api.mercadolibre.com/items/MLA421101451/pictures'
```

¡Eso es todo! Dirígete a la página de descripción de tu artículo (utilizando el campo permalink) y controla cómo se muestra tu imagen.

## Reemplazar imágenes

Ejemplo:

```
curl -X PUT  -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -H "Accept: application/json" -d
'{
  "pictures":[
    {"source":"http://www.apertura.com/export/sites/revistaap/img/Tecnologia/Logo_ML_NUEVO.jpg_33442984.jpg"},
    {"source":"http://appsuser.net/www/wp-content/uploads/2012/10/logo-mercadolibre.jpg"}
  ]
}' 
'https://api.mercadolibre.com/items/{item_id}'
```

**¡A tener en cuenta!**

- En caso que se desee reemplazar una imagen se deberá crear un nuevo source (darle otro nombre a la imagen) de lo contrario, al re utilizar el mismo que ya existía con diferente contenido no se actualizará la imagen.

- En caso de tener un grupo de imágenes y deseas realizar las siguientes acciones: Agregar imagen: deberás mandar los IDs de las imágenes cargadas que deseas conservar más los source (URL) de las nuevas imágenes. Además, puedes modificar el orden enviando el body del PUT de la forma en que quieras verlas.

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN'  -H "Content-Type: application/json" -H "Accept: application/json" -d
'{
"pictures": [{"source": "http://SOURCE_IMAGEN_NUEVA.jpg"},
			{"id": "111111 - IMAGEN_EXISTENTE_111111"},
			{"id": "111111 - IMAGEN_EXISTENTE_111111"},
			{"id": "111111 - IMAGEN_EXISTENTE_111111"}
],

"variations": [{
"id": "16787985187",
"picture_ids": [
		"http://SOURCE_IMAGEN_NUEVA.jpg", 
        "111111 - IMAGEN_EXISTENTE_111111", 
        "111111 - IMAGEN_EXISTENTE_111111", 
        "111111 - IMAGEN_EXISTENTE_111111"]},
{
"id": "16787985190",
"picture_ids": [
		"http://SOURCE_IMAGEN_NUEVA.jpg", 
        "111111 - IMAGEN_EXISTENTE_111111", 
        "111111 - IMAGEN_EXISTENTE_111111", 
        "111111 - IMAGEN_EXISTENTE_111111"]},

{
"id": "16787985193",
"picture_ids": [
		"http://SOURCE_IMAGEN_NUEVA.jpg", 
        "111111 - IMAGEN_EXISTENTE_111111", 
        "111111 - IMAGEN_EXISTENTE_111111", 
        "111111 - IMAGEN_EXISTENTE_111111"]}]
}' 
'http://api.mercadolibre.com/items/$ITEM_ID'
```

Para borrar la imagen, deberás mandar sólo los IDs de las imágenes cargadas que deseas conservar.

## Revisa posibles errores

Si al cargar el ítem, la imagen muestra error (por ejemplo,“Procesando imagen…”), puedes realizar algunas de estas verificaciones:

Llamada:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pictures/$PICTURE_ID/errors?
```

Ejemplo:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pictures/970736-MLU11111111111_092017/errors
```

Respuesta:

```
{
   "id": "970736-MLU11111111111_092017",
   "source": "https://s3.amazonaws.com/images/pictures/146.111111.jpg",
   "error": {
       "message": "{error_code=response_code, meta={responseCode=403, responseMessage=Forbidden, contentType=application/xml, contentLength=-1}}",
       "items": "MLU111111111"
 }
}
```

### Formato de la imagen

- Comprobar por navegador que la imagen exista y revisar posibles errores.

- Si al cargar el ítem la imagen queda con error podrás identificar a qué se debe utilizando la llamada anterior.

- Verificar Content-Type con la extensión, comprobando la imagen con curl -v

```
curl -v 'enlace de la imagen' >> /dev/null
```

```
curl -v 'https://s3.amazonaws.com/images/pictures/146.111111.jpg' >> /dev/null
```

- Descargar la imagen con curl -O "link de la imagen" y luego ejecutar el comando File para verificar la extensión.

```
curl -O "https://s3.amazonaws.com/images/pictures/146.111111.jpg"
```

```
file 146.111111.jpg
```

```
146.111111.jpg: XML 1.0 document text, ASCII text
```

Ambos deben coincidir teniendo en cuenta los formatos con los que trabajamos:

*de acuerdo a la velocidad de carga

- JPG

- JPEG

- PNG

## Errores

| Error_code | Mensaje del error | Descripción | Posible solución |
| --- | --- | --- | --- |
| 400 | Bad_request. Ver detalle del mensaje | Por alta carga de procesamiento del recurso, limitamos los request por minuto (RPM) por cada app_id. | Superaste tu cuota asignada. Aguarda para reintentar, aún no tienes una cuota asignada. |
| Unable to find valid certification path to requested target |  | El certificado HTTPS no es válido para nuestros servidores. | Cambiar la URL, colocando http (sin o “s” en el final). De esta manera, la imagen se descarga sin validar el certificado. |
| 301 redirect/moved permanently/etc | error_code=content_type,meta={responseCode=301,responseMessage=Moved Permanently, contentType=text/html; charset=UTF-8, contentLength=221, contentEncoding=null} | La imagen que están descargando redirige a otra URL (si la pruebas por navegador, puedes ver la redirección). | No trabajamos con redireccionamientos, envia la URL final de la imagen. |
| 404 (not found) | {error_code=response_code, meta={responseCode=404, responseMessage=Not Found, contentType=application/json, contentLength=30, contentEncoding=null}} | El servidor no encontró la imagen. | Verifica que exista la imagen y tengan nuestras ip’s en la whitelist. |
| 403 o 401 (Forbidden) |  | No fue posible descargar la imagen porque el servido externo está bloqueando nuestro acceso. | Verifica que tengas nuestras ip´s en la whitelist. |
| Connect timed out, Slow_domain_to_many_posts, Slow_domain |  | No fue posible hacer la conexión con el servidor externo para descargarla imagen. | Verifica que la URL sea válida y que el servidor externo tenga liberado nuestras IP´s. |
| Received fatal alert: protocol_version |  | Incompatibilidad del protocolo ssl por HTTPS. | Usa HTTP sin redireccionar. |
| Picture wasnt create in buckets |  | La imagen no existe. | Verifica la página por el browser. |
| 400 validation_error | "cause_id": 508 "Picture id 642584-MLA107576465620_032026 has an invalid status 'ERROR'. Only ACTIVE or PENDING pictures are allowed." |  | Enviar un nuevo ID de imagen para una imagen activa. |
| 400 validation_error | "cause_id": 509 "Picture id 650349-MLA10B360106259_032026 is below the minimum allowed size." |  | Ajustar el tamaño de la imagen. |

## Conexion/bloqueo

Si tu integración utiliza imágenes guardadas en tus servidores, recuerda agregar las siguientes direcciones IP a tu whitelist o lista de permitidas, para que la conexión con Mercado Libre sea exitosa.

- 216.33.196.4

- 216.33.196.25

- 54.88.218.97

- 18.215.140.160

- 18.213.114.129

- 18.206.34.84

Comprobar si en su URL hay algún tipo de redirección. El link debe ser exacto al de la imagen. Por ejemplo, si la URL es HTTP pero al ingresarla en el browser cambia a HTTPS, significa que hubo una redirección.

Si el certificado de SSL es incompatible con nuestro servidor, te sugerimos quitar el SSL enviando las URLs con HTTP.

## Moderación de imágenes

Consulta más información sobre [Moderaciones de imágenes](https://developers.mercadolibre.com.ar/es_ar/moderaciones-de-imagenes) para identificar los motivos por los cuales el ítem está perdiendo exposición en los listados y/o no cumple los requisitos de imágenes.
