<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/cargar-factura -->
<!-- Sección: Guía para productos > Facturación -->

# Cargar y Obtener Facturas - Emisión Propia

Última actualización 16/03/2026

# Cargar y Obtener Facturas

Con esta nueva funcionalidad, los vendedores de Mercado Libre pueden compartir las facturas de sus compradores de manera ordenada dentro del proceso de compra-venta. De esta manera, facilitamos el acceso a los documentos evitando que sean adjuntos en la mensajería posventa y mejorando la experiencia de compra. Sigue nuestra guía, aprenderás a cargar, obtener y eliminar facturas por pack u order.

## Cargar factura en detalle de venta

Para poder realizar la carga de una factura debes realizar un POST como form.data con key: tipo **file**  y value **fiscal_document**  que referencia al **fiscal_document**  (archivo del documento que adjuntas), **pack_id**  (ID del pack) y **access_token**  (token público).

Para conocer el pack_id, deberás obtener el campo "pack_id" en la respuesta de /orders/.
 **En caso que el pack id contenga un valor null, debes tomar por defecto el order ID, manteniendo el recurso /packs en la llamada a la API** .

El archivo debe tener un tamaño máximo de 1 MB, estar en formato PDF y podrá ser únicamente un fiscal_document por pack. Además, en caso de que necesites adjuntar un archivo XML y PDF asociado, puedes cargar los dos fiscal_documents como te mostramos en [Adjuntar XML](https://developers.mercadolibre.com.ar/es_ar/cargar-factura#Adjuntar-XML).

Recuerda que si programaste mensajes automáticos notificando la carga de la factura, debes cancelar su envío para evitar moderaciones, ya que Mercado Libre envía una notificación y un email.

Llamada:

```
curl -X POST  https://api.mercadolibre.com/packs/$PACK_ID/fiscal_documents
-H 'Content-Type: multipart/form-data' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-F 'fiscal_document=@/home/user/.../Factura_adjunta.pdf'
```

Ejemplo:

```
curl -X POST https://api.mercadolibre.com/packs/2000000089077943/fiscal_documents
  -H 'Authorization: Bearer $ACCESS_TOKEN' \
  -H 'content-type: multipart/form-data'
  -F 'fiscal_document=@/home/user/.../Factura_adjunta.pdf'
```

Respuesta:

```
{
	"ids" : ["415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d"]
}
```

La respuesta devolverá el ID del fiscal_document cargado, que deberás guardar para poder recuperarlo. Si adjuntas un archivo erróneo, puedes [eliminar el fiscal_document existente](https://developers.mercadolibre.com.ar/es_ar/carga-y-envio-de-facturas?nocache=true#Eliminar-factura) y luego volver a subirlo correctamente.

## Adjuntar archivo XML

Actualmente, cuando necesites adjuntar la factura en XML asociado, debes realizar el siguiente POST y especificar alguno de los siguientes formatos:

- **application/pdf**

- **application/xml**

- **text/xml**

Llamada:

```
curl -X POST https://api.mercadolibre.com/packs/$PACK_ID/fiscal_documents
  -H 'content-type: multipart/form-data'
  -H 'Authorization: Bearer $ACCESS_TOKEN'
  -F 'fiscal_document=@/home/user/.../Factura_adjunta.pdf'
  -F 'fiscal_document=@/home/user/.../Factura_adjunta.xml'
```

Ejemplo:

```
curl -X POST 'https://api.mercadolibre.com/packs/2000000089077943/fiscal_documents'
  -H 'Authorization: Bearer $ACCESS_TOKEN'
  -H 'content-type: multipart/form-data'
  -F 'fiscal_document=@/home/user/.../Factura_adjunta.pdf'
  -F 'fiscal_document=@/home/user/.../Factura_adjunta.xml'
```

Respuesta:

```
{
  "ids" : ["415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d",
               "415460047_4c942945-ae16-46f2-98fa-a772322c7e70" ]
}
```

## Posibles errores en la carga de factura

El usuario no está autorizado a subir una factura:

```
{
    "message": "Access Denied, you are not authorized.",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```

El archivo no puede ser null o no se encuentra:

```
{
    "message": "File cannot be empty",
    "error": "bad_request",
    "status": 400,
    "cause": []
}
```

Tipo de archivo no permitido:

```
{
   "message":"File type: $FILE_TYPE is not allowed",
   "error":"bad_request",
   "status":400,
   "cause":[

   ]
}
```

Archivo excede el tamaño máximo:

```
{
   "message":"File Not allowed, exceeds maximum size",
   "error":"bad_request",
   "status":400,
   "cause":[]
}
```

Adjuntar más de un archivo:

```
{
   "message":"Files Not allowed, you can upload only two files, one of each type",
   "error":"bad_request",
   "status":400,
   "cause":[

   ]
}
```

Adjuntar más de un archivo en un pack del mismo tipo:

```
{
   "message":"Files Not allowed, you can upload only one file of type: $FILE_TYPE",
   "error":"conflict",
   "status":409,
   "cause":[

   ]
}
```

Adjuntar un archivo en un pack que ya tiene la cantidad máxima de archivos cargados previamente:

```
{
   "message":"File Not allowed, the max amount of files already exist for the pack: $PACK_ID and seller: $SELLER_ID",
   "error":"conflict",
   "status":409,
   "cause":[

   ]
}
```

Adjuntar un archivo de un tipo en un pack que ya tiene un archivo de ese tipo cargado previamente:

```
{
   "message":"File Not allowed, a file already exists for the pack: $PACK_ID and seller: $SELLER_ID of the type: $FILE_TYPE",
   "error":"conflict",
   "status":409,
   "cause":[

   ]
}
```

Adjuntar archivo con nombre vacío:

```
{
   "message":"Filename cannot be empty",
   "error":"bad_request",
   "status":400,
   "cause":[]
}
```

Adjuntar archivo para pack con envío fulfillment o cross-docking:

Importante:

Este error ocurre cuando se intenta hacer el upload de una factura para un pack con un tipo logístico no habilitado. Aplica solo a envíos de: **Mercado Libre Chile (MLC)** : no está permitido el upload de facturas para envíos con logística **fulfillment** . **Mercado Libre Brasil (MLB)** : no está permitido el upload de facturas para envíos con logística **fulfillment** , **cross_docking**  o **xd_drop_off** .

```
{
   "message": "Access denied, you must use the biller of MercadoLibre",
   "error": "forbidden",
   "status": 403,
   "cause": []
}
```

## Obtener IDs de las facturas

Para poder obtener el ID de las facturas, debes realizar una llamada GET. La respuesta dependerá del rol del usuario que haga la consulta y podrá ser:
 **Rol vendedor** : los IDs de las facturas que cargó en el pack.
 **Rol comprador** : todos los IDs de las facturas que pertenecen al pack. 

 Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/packs/$PACK_ID/fiscal_documents
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/packs/2000000089077943/fiscal_documents
```

Respuesta:

```
{
    "pack_id": 2000000089077943,
    "fiscal_documents":[
      {
         "id":"fc76f79d-1599-43ed-8675-569482e2ec21",
         "date":"2020-04-27T23:10:21Z",
         "file_type":"application/pdf"
         "filename":"factura.pdf"
      }
   ]
}
```

La respuesta devolverá el/los IDS de los fiscal_document cargados, que deberás guardar para poder realizar la descarga, la fecha en que fue cargado y el tipo de archivo que sea (PDF o XML). Si existen fiscal_document que fueron eliminados, la lista de ids de fiscal_documents puede aparecer vacía.

## Posibles errores obteniendo IDs de facturas

El usuario no está autorizado a obtener los IDs de facturas asociada al pack:

```
{
    "message": "Access Denied, you are not authorized.",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```

Si el pack no tiene ninguna factura cargada:

```
{
   "message": "The pack_fiscal_document with pack_id: %d does not exist",
    "error": "not_found",
    "status": 404,
    "cause": []
}
```

Si el usuario no tiene ninguna factura cargada por él dentro del pack:

```
{
   "message": "The pack_fiscal_document with pack_id: %d does not have any fiscal_document attached for the user_id: %d",
    "error": "not_found",
    "status": 404,
    "cause": []
}
```

## Obtener factura

Para poder obtener facturas, debes realizar una llamada GET con el filename, es decir, el ID del file. La respuesta será exitosa cuando devuelva el archivo que solicitas.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/packs/$PACK_ID/fiscal_documents/$FISCAL_DOCUMENT_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/packs/2000000089077943/fiscal_documents/415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d
```

## Posibles errores por obtener facturas

El usuario no está autorizado a obtener la factura asociada al pack:

```
{
    "message": "Access Denied for user with id : ${ID} to the fiscal_document with id: ${ID}.",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```

No existe el fiscal_document que se quiere obtener:

```
{
    "message": "The fiscal_document with id: ${ID} does not exist",
    "error": "bad_request",
    "status": 400,
    "cause": []
}
```

La factura no pudo ser encontrada en el servidor, intente nuevamente en unos segundos:

```
{
    "message": "The fiscal_document with id: ${ID} could not be retrieved from storage",
    "error": "not_found",
    "status": 404,
    "cause": []
}
```

## Eliminar factura

Para eliminar la factura, debes realizar una llamada DELETE especificando el pack_id es decir el ID del pack. De esta manera, eliminarás todos los archivos que hayas cargado en el pack.

Llamada:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/packs/$PACK_ID/fiscal_documents
```

Ejemplo:

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/packs/2000000089077943/fiscal_documents
```

Si el vendedor tiene 1 solo archivo adjuntado al PACK_ID, esta es la respuesta:

```
{
  "message" : "The fiscal_document with "id" : 415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d was deleted"
}
```

Si tiene mas de un archivo adjuntado, es decir PDF y XML, la respuesta es la siguiente:

```
{
  "message" : "The fiscal_documents with the following ids: 415460047_a96d8dea-38cd-4402-938e-80a1c134fc5d,              415460047_4c942945-ae16-46f2-98fa-a772322c7e70 were deleted
}
```

En caso de que hayas cargado un solo fiscal_document, en la respuesta obtendrás el ID de este que fue borrado. En caso de sean dos fiscal_document, obtendrás ambos IDs.

## Posibles errores por eliminar facturas

Eliminar una factura de un pack que no existe o que ya fue borrada:

```
{
   "message":"Cannot delete. The pack: 2000000089077943 doesn't have a fiscal_document attached",
   "error":"not_found",
   "status":404,
   "cause":[]
}
```

Usuario no está autorizado a eliminar la factura asociada al pack:

```
{
    "message": "Access Denied, you are not authorized.",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```

### Posibles errores por solicitar datos de facturación

El body se encuentra vacío:

```
{
    "message": "The body of the request cannot be empty",
    "error": "internal_server_error",
    "status": 500,
    "cause": []
}
```

No se pudo recuperar el body del request:

```
{
    "message": "Error retrieving the body from the request",
    "error": "internal_server_error",
    "status": 500,
    "cause": []
}
```

El usuario no está autorizado a pedir los datos fiscales:

```
{
    "message": "Access Denied, you are not authorized.",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```

Si el usuario no puede usar la mensajería:

```
{
    "message": "You cannot ask for the billing_info because you are not allowed to use the messaging service",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```

Si el texto supera la cantidad máxima de caracteres:

```
{
    "message": "The text content is too long, max characters allowed are: 500",
    "error": "bad_request",
    "status": 400,
    "cause": []
}
```

Si el texto está vacío:

```
{
    "message": "The text content cannot be empty",
    "error": "bad_request",
    "status": 400,
    "cause": []
}
```

Si el texto no es válido:

```
{
    "message": "You cannot ask for the billing_info because the text is not valid. Check Messaging Post Sale documentation for more information",
    "error": "not_acceptable",
    "status": 406,
    "cause": []
}
```

## Errores generales

El ID de la orden no pertenece a un pack:

```
{
   "message":"The order belong to a pack/purchase",
   "error":"bad_request",
   "status":400,
   "cause":[]
}
```

Pack_id vacío o no numérico:

```
{
   "message":"pack.id must be numeric and not empty",
   "error":"bad_request",
   "status":400,
   "cause":[]
}
```

Pack_id negativo o 0:

```
{
   "message":"pack.id is invalid",
   "error":"bad_request",
   "status":400,
   "cause":[]
}
```

**Error por Access token**

En caso de que realices la consulta sin el access token correspondiente, obtendrás el siguiente error:

```
{
    "message": "access_token was not sent",
    "error": "access_token_not_granted",
    "status": 403,
    "cause": []
}
```

**Error por acceso desde site no autorizado**

En caso de que quieran utilizar la API desde algún site en el cual no está disponible, obtendrás el siguiente error:

```
{
    "message": "Access Denied, this API is not available on your site: MLB",
    "error": "forbidden",
    "status": 403,
    "cause": []
}
```
