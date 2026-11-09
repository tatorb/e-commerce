<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publicaciones-denunciadas -->
<!-- Sección: Recursos de la API > Brand Protection Program -->

# Publicaciones denunciadas

Última actualización 26/07/2026

## Publicaciones denunciadas

Para reducir las denuncias en el marco del Brand Protection Program ponemos a disposición las siguientes funcionalidades para consultar y responder denuncias realizadas a vendedores. **En caso de infracciones reincidentes, las sanciones pueden incluir impacto en la reputación, restricciones en la cuenta, suspensión o inhabilitación temporal y/o permanente** . También podrás utilizar el flujo de Mercado Libre para [responder una denuncia](https://www.mercadolibre.com.ar/ayuda/como-responder-denuncia_4814).

## Consultar ítems denunciados

Con el siguiente recurso podrás obtener ítems denunciados de un vendedor, fecha de la denuncia, fecha de vencimiento (plazo máximo para responder a la denuncia), motivo de la denuncia, el id que identifica el caso y su estado.

### Parámetros obligatorios

| Parámetro | Descripción |
| --- | --- |
| **offset** | Limita la cantidad de resultados. El resultado máximo por página es 50. Para obtener los primeros resultados debes enviar 0, después 50, 100, 150, 200 y así sucesivamente. |
| **date_created** | Fecha de creación de denuncias. Con este parámetro delimitarás desde un día hasta la fecha actual. |
| **current_status** | Estado de la denuncia. Los estados relevantes para los vendedores son:  CREATED PENDING_MODERATION WAITING_DOCUMENTATION DOCUMENTATION_PRESENTED DOCUMENTATION_APPROVED DOCUMENTATION_NOT_APPROVED DOCUMENTATION_NOT_PRESENTED MEMBER_NOT_RESPOND |

Si no quieres filtrar las denuncias, deberás enviar obligatoriamente los campos date_created y status vacíos: **?offset=0&date_created=&status=**

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/cases?offset=0&date_created=2026-05-19&status=$STATUS_ID
```

Llamada ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/cases?offset=0&date_created=2026-05-19&status=DOCUMENTATION_APPROVED
```

Respuesta:

```
[
  {
    "case_id": 37111392,
    "item_id": "MLA6759546426",
    "current_status": "DOCUMENTATION_APPROVED",
    "date_created": "2026-05-19T14:50:52Z",
    "due_date": "2026-05-26T15:11:44Z",
    "element_related_count": 1,
    "reason_text": "Tu producto puede estar utilizando su marca de forma ilegítima (por ejemplo, mencionar que eres un distribuidor oficial cuando en realidad no lo eres, incluir sus logotipos en la descripción o en las imágenes del anuncio).",
    "user_product_ids": []
  },
  {
    "case_id": 37111394,
    "item_id": "MLA6759545714",
    "current_status": "DOCUMENTATION_APPROVED",
    "date_created": "2026-05-19T14:50:52Z",
    "due_date": "2026-05-26T15:11:45Z",
    "element_related_count": 1,
    "reason_text": "Tu anuncio puede estar utilizando una copia ilegal de imágenes protegidas por sus derechos de autor (fotos de catálogo protegidas, personajes de dibujos animados, videos, imágenes de celebridades).",
    "user_product_ids": []
  },
  {
    "total": 2,
    "offset": 0,
    "limit": 50
  }
]
```

### Campos de respuesta

**item_id** : identificador del ítem.
 **date_created** : fecha de creación de la denuncia recibida.
 **due_date** : fecha de vencimiento para responder la denuncia. Si no responde, el estado de la denuncia pasará a DOCUMENTATION_NOT_PRESENTED y el ítem será moderado y eliminado (forbidden).
 **case_id** : identificador de denuncia. Permitirá conocer más detalle de la denuncia recibida.
 **reason_text** : motivo de la denuncia.
 **current_status** : estado actual de la denuncia. Este cambiará conforme a la respuesta y resoluciones.

### Conoce los diferentes status:

| Current_status | Nombre | Descripción | Estado del ítem |
| --- | --- | --- | --- |
| **CREATED** | Denuncia creada | Estado inicial y transitorio de la denuncia. Desde aquí puede avanzar automáticamente a WAITING_DOCUMENTATION o ir a PENDING_MODERATION si requiere moderación. | Activo |
| **PENDING_MODERATION** | En moderación | La denuncia está en la cola de moderación. Puede avanzar a WAITING_DOCUMENTATION si es aprobada, o ser REJECTED o DISCARDED. | Activo |
| **WAITING_DOCUMENTATION** | Esperando respuesta | Estamos esperando respuesta de la denuncia por parte del vendedor. | Pausado |
| **ROLLBACK** | Revertida | La denuncia fue revertida para reiniciar el pedido de documentación al vendedor. | Pausado |
| **DOCUMENTATION_PRESENTED** | Documentación presentada | La denuncia fue respondida por el vendedor y está a la espera de una respuesta por parte del miembro. | Pausado |
| **WAITING_FOR_PATCH_PDP** | Esperando corrección de catálogo | La denuncia está esperando que el vendedor corrija la publicación de catálogo. | Eliminado |
| **DOCUMENTATION_APPROVED** | Documentación aprobada | La denuncia fue respondida por el vendedor, el miembro aprobó la documentación y retiró su denuncia. | Activo |
| **DOCUMENTATION_NOT_APPROVED** | Documentación no aprobada | La denuncia fue respondida por el vendedor, pero el miembro ratificó su denuncia. | Eliminado |
| **DOCUMENTATION_NOT_PRESENTED** | Documentación no presentada | La denuncia no fue respondida por el vendedor. | Eliminado |
| **MEMBER_NOT_RESPOND** | Denuncia sin respuesta del miembro | La denuncia fue respondida por el vendedor, pero el denunciante no respondió a tiempo. | Activo |
| **ACUERDO_CLOSED** | Restricción regulatoria | La publicación fue denunciada por un organismo gubernamental o regulatorio. El ítem fue restringido o eliminado en función de una regulación local del país. Este tipo de denuncia no requiere respuesta ni presentación de documentación por parte del vendedor. | Eliminado |
| **DISCARDED** | Descartada | La denuncia fue descartada. Puede ocurrir por decisión de moderación manual, por falta de respuesta del vendedor, por documentación no aprobada o porque el miembro no respondió a tiempo. | Activo |
| **DISCARDED_DUE_RESTRICTION** | Descartada por restricción | La denuncia fue descartada porque el proceso de contranotificación tiene una restricción activa. | Activo |
| **REJECTED** | Rechazada | La denuncia fue rechazada. Puede ocurrir durante la moderación manual o mientras se esperaba la documentación del vendedor. | Activo |
| **REJECTED_BY_ABUSE** | Rechazada por abuso | La denuncia fue rechazada porque se detectó un uso abusivo del sistema al crearla o procesarla. | Activo |
| **REJECTED_BY_ABUSE_COUNTER_NOTICE** | Rechazada por abuso en contranotificación | La denuncia fue rechazada porque se detectó abuso en la contranotificación o en la respuesta del proceso. | Activo |
| **REJECTED_BY_RESTRICTION** | Rechazada por restricción | La denuncia fue rechazada porque el miembro tiene una restricción activa que le impide denunciar en este caso. | Activo |
| **REJECTED_PDP_ITEM** | Rechazada (ítem) | La denuncia fue rechazada a nivel de ítem. | Activo |
| **REJECTED_PDP_CATALOG** | Rechazada (catálogo) | La denuncia fue rechazada a nivel de catálogo. | Activo |
| **REJECTED_PDP_IMAGE_RANKER** | Rechazada (clasificador de imágenes) | La denuncia fue rechazada por el clasificador de imágenes. | Activo |
| **REJECTED_MODIFIED** | Rechazada por modificación | La denuncia fue rechazada después de que el vendedor realizó las correcciones requeridas. | Activo |

## Consultar detalle del ítem denunciado

Para más información sobre el caso y el ítem denunciado, realiza la siguiente consulta:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/case/$CASE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/case/37168941
```

Respuesta:

```
{
  "case_id": 37168941,
  "current_status": "DOCUMENTATION_NOT_PRESENTED",
  "item_info": {
    "item_id": "MLB6759545714",
    "price": 980,
    "title": "Michelin Ii Primacy Test Bpp"
  },
  "reason_id": "PPPI6",
  "public_member_name": "FAKES IT",
  "date_created": "2026-05-28T08:56:36.000-0400",
  "due_date": "2026-05-01T08:56:36.000-0400",
  "last_updated": "2026-05-28T10:40:31.000-0400",
  "is_rollbackable": true,
  "documents": [],
  "document_name": null,
  "document_url": null,
  "photos_denounced": [
    {
      "id": "904878-MLA99980238649_112025",
      "status": "ACTIVE"
    },
    {
      "id": "996479-MLA52729912696_122022",
      "status": "ACTIVE"
    },
    {
      "id": "665684-MLA52729912700_122022",
      "status": "ACTIVE"
    }
  ],
  "photos_new": [],
  "element_related_count": 1,
  "member_quittance": null,
  "seller_quittance": null,
  "user_product_ids": []
}
```

### Campos de respuesta

**item_info** : información relevante del ítem.
 **last_updated** : fecha de la última actualización de la denuncia.
 **date_created** : fecha de creación de la denuncia.
 **photos_denounced** : imágenes denunciadas.
 **due_date** : fecha de vencimiento para responder a la denuncia.
 **photos_new** : imágenes nuevas para añadir al ítem. Una vez respondida la denuncia con este campo, Mercado Libre añade las pictures id en la publicación.
 **case_id** : identificador de denuncia.
 **user_product_ids** : id del user product.
 **member_quittance** : comentario del miembro del programa.
 **document_name** : nombre del documento enviado por el miembro.
 **public_member_name** : nombre público del miembro del programa.
 **current_status** : estado actual de la denuncia.
 **document_url** : url del documento enviado por el miembro.
 **reason_id** : identificador de la denuncia.
 **is_rollbackable** : indica si la denuncia puede ser revertida. Es un valor booleano (true / false). Retorna true únicamente cuando current_status es uno de los siguientes: WAITING_DOCUMENTATION, DOCUMENTATION_NOT_PRESENTED, DOCUMENTATION_NOT_APPROVED o WAITING_FOR_PATCH_PDP. En cualquier otro estado, retorna false.

### Conoce los diferentes tipos de denuncias:

| Reason ID | Nombre | Descripción |
| --- | --- | --- |
| PPPI1 | Producto Falsificado | Es una copia o falsificación de un producto que no fue fabricado por la marca. |
| PPPI2 | Uso indebido de marca | Utiliza la marca indebidamente en la publicación. Por ejemplo: en el título, en la descripción, en las fotos, etc. |
| PPPI3 | Derecho de Autor - Software | La publicación ofrece un programa de computación que infringe los derechos. |
| PPPI5 | Derecho de Autor - Libros | La publicación ofrece una obra literaria que infringe los derechos. |
| PPPI6 | Derecho de Autor - Imágenes | La publicación contiene imágenes y/o fotos que el vendedor no tiene autorización para utilizar. |
| PPPI7 | Derecho de Autor - Imagen Personal | Utiliza la imagen personal del denunciado. |
| PPPI8 | Modelo o Diseño Industrial | Infringe un modelo o diseño industrial. |
| PPPI9 | Infringe patentes, modelos de utilidad o derechos de obtentor | Infringe patentes, modelos de utilidad o derechos de obtentor de variedades vegetales. |
| PPPI10 | Producto no destinado a la venta | Ej. Muestra gratis, productos no lanzados en el mercado, otros productos entregados en fianza. |
| PPPI11 | Derecho de Autor - Cursos | La publicación ofrece un curso que infringe los derechos. |
| PPPI12 | Derecho de Autor - Videojuegos | La publicación ofrece un videojuego que infringe sus derechos. |
| PPPI14 | Derecho de Autor - Videos / Películas | La publicación ofrece una obra audiovisual que infringe mis derechos. |
| PPPI15 | Derecho de Autor - Música | La publicación ofrece un contenido musical que infringe sus derechos. |
| PPPI16 | Derecho de Autor - Personaje | La publicación ofrece productos que incluyen personajes sin autorización. |
| PPPI17 | Derechos de Autor - Otros | La publicación ofrece otro tipo de obra (dibujo, pintura, escultura, etc.) que infringe sus derechos. |
| PPPI18 | Derechos Conexos - Reproducciones ilegales | Vinculaciones o reproducciones no autorizadas. |
| PPPI19 | Derechos Conexos - Imagen personal | Usa la imagen personal asociada a su interpretación artística sin autorización. |
| PPPI20 | Derechos Conexos - Material Auditivo | Usa material auditivo sin autorización. Música o sonidos grabados. |
| PPPI21 | Derechos Conexos - Material Audiovisual | Películas, series, videos, grabaciones de recitales, espectáculos y eventos deportivos. |
| PPPI22 | Derechos Conexos - Transmisión ilegal | Servicios para acceder a señales de manera ilegal. |
| PPPI23 | Derechos Conexos - Dispositivo ilegal | Dispositivos que captan señales de manera ilegal. |
| ACUERDO | Restricción regulatoria | La publicación infringe una regulación gubernamental o normativa local del país. Este tipo de denuncia es realizada por organismos gubernamentales o regulatorios habilitados y no requiere respuesta ni presentación de documentación por parte del vendedor. |

## Flujo para responder denuncias

### 1. Identificar tipo de respuesta

- **Si el vendedor tiene derechos de uso de las imágenes** , deberá responder a la denuncia con un comentario (opcional) y adjuntar el documento (obligatorio).

- **Si el vendedor no tiene derechos sobre estas imágenes** , deberá cargar nuevas imágenes y enviar en su respuesta los ids de las imágenes nuevas y los ids de las imágenes eliminadas. [Utiliza nuestra API de /pictures](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes).

- **Por documentación** : el vendedor debe responder a la denuncia con un comentario (obligatorio) y con la documentación (opcional). Antes de enviar la respuesta, recomendamos cargar el documento en el endpoint.

### 2. Cargar documento probatorio

Una vez que los vendedores diferencien si se trata de una denuncia por uso de imágenes o documentación, deberán cargar el documento en Mercado Libre de la siguiente manera:

### Parâmetros obrigatórios

**case_id** : identificador de la denuncia.
 **name** : nombre del archivo.
 **form** : archivo o documento oficial que pruebe la respuesta de la denuncia.

Nota:

Solo se permite adjuntar archivos PDF, JPG o PNG con un peso máximo de 5 MB.

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/moderations/pppi/case/files?case_id=$CASE_ID&name=$NAME_FILE.JPG -Form =@/Users/Nombre/Ejemplo/documento-denuncia-Nike.jpg
```

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/moderations/pppi/case/files?case_id=32679944&name=testFile.jpg'--form '=@"/Users/Nombre/Ejemplo/documento-denuncia-Nike.jpg"'
```

Respuesta:

```
{
  "file_name":"32679944.jpg"
}
```

Este file_name debe ser utilizado para el campo **document_name**  al momento de adjuntar una documentación comprobatoria ante una denuncia.

### 3. Enviar respuesta ante denuncia

Nota:

Si el vendedor no envía documentación en casos opcionales, podrá enviar un string vacío ("document_name": " ").

### Respuesta por uso de imágenes (sin variaciones):

**seller_quittance** : comentario del vendedor.
 **document_name** : nombre del documento enviado por el miembro.
 **photos_new** : fotos nuevas que el vendedor enviará y Mercado Libre cargará en el ítem.
 **photos_removed** : id de las imágenes que desea eliminar. Mercado Libre eliminará estas imágenes.

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/case/12344
{
  "seller_quittance": "comentario",
  "document_name": "32618474.png",
  "photos_new": ["799744-MLA1234_112022"],
  "photos_removed": ["637858-MLA124_112022"],
  "variations": []
}
```

### Respuesta por uso de imágenes (con variaciones):

**variations** : indica el id de la variación del ítem con las imágenes que desea que permanezcan en la publicación.

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/case/12344
{
  "seller_quittance": "test",
  "document_name": "32618474.png",
  "photos_new": ["799744-MLA1234_112022"],
  "photos_removed": ["637858-MLA124_112022"],
  "variations": [{
    "id": "16787985187",
    "picture_ids": [
      "111111 - IMAGEN_EXISTENTE_111111",
      "111111 - IMAGEN_EXISTENTE_111111",
      "111111 - IMAGEN_EXISTENTE_111111"
    ]
  }]
}
```

Conoce más sobre [cómo trabajar con imágenes](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes).

### Respuesta de denuncia con documento:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/case/12344
{
  "seller_quittance": "comentario del vendedor",
  "document_name": "32618474.png"
}
```

## Recomendaciones para responder denuncias

| Infracción | Motivo | Respuesta esperada |
| --- | --- | --- |
| Producto falsificado, copias o réplicas | Es ilegal vender falsificaciones, copias o réplicas de productos de una marca registrada. Publicar este tipo de productos está prohibido por nuestros Términos y condiciones. | - Enviar fotos de la factura de compra que demuestre que el producto es original, que lo compró legalmente y que justifique el stock ofrecido. - Enviar imágenes de las etiquetas y empaque original del producto. El titular de derechos podría pedir documentación específica. |
| Uso ilegal de marca registrada | Una marca registrada es una señal distintiva que se usa para identificar productos o servicios. | - Adjuntar copia de la autorización del titular. - Si eres titular de la marca, envía una copia de tu título de marca. |
| Software pirata | Es ilegal vender copias no autorizadas de software. | Enviar copia de la licencia que te autoriza a distribuir el software. |
| Infracciones de derechos de autor | Protegen obras intelectuales originales. Evitan que otros puedan usar una obra sin permiso. | - Acreditar que es el titular de estos derechos. - Enviar copia de la autorización del titular. - Enviar copia del certificado de depósito de la obra. |
| Infracciones de derechos conexos | Da protección a quien contribuye con creatividad, técnica u organización en el proceso de poner a disposición del público una obra. | - Enviar autorizaciones para grabar actuación. Si es denuncia de productores: facturas de adquisición, contratos de consignación o licencias. Si es de radiodifusión: licencia de distribución. |
| Infracción de una patente o modelo de utilidad | Derecho exclusivo otorgado a una invención que implica una solución técnica nueva. | - Probar titularidad de la patente. - Enviar copia de autorización para explotar comercialmente la invención. |
| Infracción de un modelo o diseño industrial | Protegen el aspecto ornamental o estético aplicado a un producto. | - Probar titularidad. - Enviar copia de la autorización para explotación comercial. |
| Producto no destinado para la venta | El propietario no lo destinó para fines comerciales (muestras gratis). En Brasil es infracción vender productos no lanzados oficialmente. | Enviar documentación que pruebe que compró el producto sin limitaciones para venderlo. |
