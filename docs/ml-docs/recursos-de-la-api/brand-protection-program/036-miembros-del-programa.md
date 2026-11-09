<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/miembros-del-programa -->
<!-- Sección: Recursos de la API > Brand Protection Program -->

# Miembros del Programa

Última actualización 26/07/2026

## Miembros del Programa

Importante:

Esta funcionalidad puede utilizarla solo quien sea Miembro del Brand Protection Program. Si no lo eres, puedes [adherirte como Miembro al Programa](https://www.mercadolibre.com.ar/noindex/pppi/rights/enroll).

Con las siguientes APIs, el BPP invita a quienes sean titulares de derechos, o sus representantes legales, a proteger todo su portafolio de derechos de propiedad intelectual mediante la denuncia de cualquier publicación que, presuntamente, pueda infringir sus derechos de propiedad intelectual.

## Consultar motivos habilitados

Conoce cuáles son los motivos que tienes habilitados como Miembro para denunciar.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/denounces/$SITE_ID/ITM/options
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/denounces/MLA/ITM/options
```

Respuesta:

```
[
{
"id": "PPPI1",
"group": "PPPI",
"type": "Product",
"description": "Es un producto falsificado",
"description_en": "It is a counterfeit product",
"sub_text": "Es un producto que lleva mi marca pero que no fue fabricado por mí.",
"sub_text_en": "It is a product that has my trademark, but I have not manufactured it.",
"description_pt": "o seu produto pode ser falsificado",
"sub_text_pt": "É um produto que tem minha marca mas que eu não fabriquei."
},
{
"id": "PPPI2",
"group": "PPPI",
"type": "Publication",
"description": "Uso ilegal de mi marca",
"description_en": "Illegal use of my trademark",
"sub_text": "Incluye mi logo en sus imágenes sin tener autorización...",
"sub_text_en": "Includes my logo in the images with no authorization..."
},
{
"id": "PPPI5",
"group": "PPPI",
"type": "Publication",
"description": "Libros",
"description_en": "Books"
},
{
"id": "PPPI6",
"group": "PPPI",
"type": "Publication",
"description": "Imagen / fotos",
"description_en": "Images / photos"
},
{
"id": "PPPI7",
"group": "PPPI",
"type": "Publication",
"description": "Usa mi imagen personal",
"description_en": "Use of my personal image / use of photographic portrait"
},
{
"id": "PPPI8",
"group": "PPPI",
"type": "Product",
"description": "Infringe modelos o diseños industriales",
"description_en": "Infringes industrial designs or models"
},
{
"id": "PPPI9",
"group": "PPPI",
"type": "Product",
"description": "Infringe patentes, modelos de utilidad o variedades vegetales",
"description_en": "Infringes patents, utility models or plant breeder's rights"
},
{
"id": "ACUERDO",
"group": "PPPI",
"type": "Product",
"description": "Tengo un convenio de regulación sobre este producto."
}
]
```

## Realizar denuncia

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/denounces/items/$ITEM_ID
```

Ejemplo:

```
curl -X POST  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/denounces/items/MLB6759546426 
{
  "report_reason_id": "PPPI1",
  "comment": "Comment example.",
}
```

Respuesta:

```
{
  "status": 201,
  "denounce_id": 37072543
}
```

## Consultar estado de denuncia

Obtén información del estado actual de la denuncia para luego responder al vendedor que has denunciado.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/case/$DENOUNCE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/moderations/pppi/case/37072543
```

Respuesta:

```
{
  "item_info": {
    "item_id": "MLB6759546426",
    "price": 1200,
    "description": "",
    "title": "Michelin Ii Primacy Test Bpp 2",
    "pictures": [
      {
        "size": "358x500",
        "url": "https://http2.mlstatic.com/D_800206-MLB95151503674_102025-O.webp",
        "max_size": "859x1199"
      }
    ]
  },
  "last_updated": "2026-05-12T07:32:17.000-0400",
  "is_rollbackable": false,
  "documents": [],
  "date_created": "2026-05-12T07:32:17.000-0400",
  "photos_denounced": [],
  "reason_text": "Uso ilegal da minha marca",
  "due_date": null,
  "member_name": "FAKES IT",
  "reason_id": "PPPI2",
  "user_type": "member",
  "seller_name": "TESTUSER6752067154379118192",
  "case_id": 37072543,
  "current_status": "CREATED",
  "seller_id": "3396749566"
}
```

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

## Responder al vendedor

Una vez que realizas una denuncia como Miembro del Programa, el vendedor tiene **3 días**  (excluyendo domingos) para responder con la documentación y luego tendrás **3 días corridos**  para responder a este.

- **Si no respondes dentro del plazo** , la publicación denunciada del vendedor será reactivada.

- **Para responder rechazando la respuesta del vendedor** , debes agregar dentro del body el campo **reject_member_id**  con el id del motivo de rechazo obtenido previamente en la llamada GET dentro de campo **reject_option_member** .

Nota:

Sólo puedes responder ante casos con estado DOCUMENTATION_PRESENTED.

Ejemplo aprobar denuncia:

```

curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/moderations/pppi/case/$DENOUNCE_ID 
{
  "documentation_approved":"true" ,
  "member_quittance": < string | null >
}
```

Ejemplo rechazar denuncia:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'  https://api.mercadolibre.com/moderations/pppi/case/$DENOUNCE_ID 
{
  "documentation_approved":"false",
  "member_quittance": < string | null >,
 "reject_member_id": "1"
}
```

Respuesta:

```
{
  "item_info" {
    "title": ,
    "description": < string |null >,
    "price": < number | null >, 
    "pictures": < array[object: "url":  ] >,
  },
  "user_type": < string(seller|member) >,
  "reason_text": ,
  "member_name": ,
  "member_quittance": < string | null >,
  "seller_name": ,
  "seller_quittance": < string |null >,
  "document_url": < string |null >,
  "document_name": < string |null >,
  "due_date": ,
"current_status": < string(WAITING_DOCUMENTATION|DOCUMENTATION_PRESENTED|DOCUMENTATION_NOT_PRESENTED|DOCUMENTATION_APPROVED|DOCUMENTATION_NOT_APPROVED|MEMBER_NOT_RESPOND|ROLLBACK|DISCARD_DUE_RESTRICTION) >,
"reject_option_member": [
    {
      "sub_text_en": null,
      "text_en": "The documentation does not correspond to the reported product",
      "id": 1,
      "text_pt": "A documentação não corresponde ao produto denunciado",
      "sub_text_pt": null,
      "text_es": "La documentación no se corresponde con el producto denunciado",
      "sub_text_es": null
    },
    {
      "sub_text_en": null,
      "text_en": "The documentation is illegible",
      "id": 2,
      "text_pt": "A documentação está ilegível",
      "sub_text_pt": null,
      "text_es": "La documentación es ilegible",
      "sub_text_es": null
    },
    {
      "sub_text_en": "The documentation does not prove that they are authorized to use my brands, logos, or that they are official distributors",
      "text_en": "You are not authorized to use this content",
      "id": 3,
      "text_pt": "Não está autorizado a usar este conteúdo",
      "sub_text_pt": "A documentação não comprova que está autorizado a usar minhas marcas, logotipos ou que é um distribuidor oficial",
      "text_es": "No está autorizado a utilizar este contenido",
      "sub_text_es": "La documentación no prueba que está autorizado a usar mis marcas, logos, ni que es un distribuidor oficial"
    }
],
"photos_denounced": [
       {
           "id": "670708-MLA40946169781_022020"
           "status": "REMOVED",
           "src": "http://mla-s2-p.mlstatic.com/670708-MLA40946169781_022020.jpg"
       }
   ],
   "photos_new": [
       {
           "id": "8889-MLA26622267232_012016",
           "src": "http://mla-s2-p.mlstatic.com/670708-MLA40946169781_022020.jpg"
       },
       {
          "id": "792503-MLA40997189396_032020",
           "src": "http://mla-s2-p.mlstatic.com/792503-MLA40997189396_032020-O.jpg"
       }
   ]
}
```

**Siguiente** : [Publicaciones denunciadas](https://developers.mercadolibre.com.ar/es_ar/publicaciones-denunciadas?nocache=true).
