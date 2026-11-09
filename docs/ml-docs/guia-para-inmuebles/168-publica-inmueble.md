<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publica-inmueble -->
<!-- Sección: Guía para inmuebles -->

# Publica Inmuebles

Última actualización 28/08/2026

## Publicar Inmuebles

Esta sección detalla cómo utilizar la API de Mercado Libre para publicar avisos de inmuebles. Al integrar nuestra API, podrás automatizar la publicación de inmuebles, simplificando la gestión de grandes catálogos y la integración con sistemas de administración inmobiliaria.

**Importante:**

Antes de publicar, revisa la sección [Categorías y Atributos](https://developers.mercadolibre.com.ar/es_ar/categorias-atributos-inmuebles) para conocer los atributos mínimos necesarios para publicar.

# Preparación para la Publicación

Recuerda que necesitarás un **access_token**  para realizar la publicación.

| Requisito | Descripción |
| --- | --- |
| **Obtención del access_token** | Si tienes dudas sobre cómo obtenerlo, consulta la guía de [Autenticación y Autorización](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion). |
| **Validación del JSON** | Recomendamos validar el JSON antes de realizar la solicitud `POST`. Consulta el [tutorial de validación de avisos](https://developers.mercadolibre.cl/es_ar/validador-de-publicaciones). |
| **Creación del JSON** | Crea un JSON para tu inmueble basándote en el ejemplo en **Publica tu inmueble** . Alternativamente, envía el JSON directamente para publicar un producto de prueba en el sitio. |

✓ ¡Listo! Continúa con el siguiente paso.

# Publica tu inmueble

Para publicar tu inmueble, envía una solicitud **POST**  al endpoint /items. Asegúrate de incluir toda la información obligatoria, que puede consultarse en las guías de [Atributos](https://developers.mercadolibre.com.ar/es_ar/atributos-inmuebles), [Localizar inmuebles](https://developers.mercadolibre.com.ar/es_ar/localizar-inmuebles) y [Calidad de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles). Esta información te ayudará a preparar una publicación correcta y completa.

**Importante:**

A partir del **01/10/2026** , los campos **country_code2**  y **phone2**  del objeto **seller_contact**  pasan a ser obligatorios para todas las publicaciones de Inmuebles, para todos los tipos de usuario. El objeto **seller_contact**  debe enviarse completo en el cuerpo de la solicitud. Consulta la sección **[Contacto del vendedor (seller_contact)](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble?nocache=true#Contato-del-vendedor:~:text=tipos%20de%20avisos.-,Contacto%20del%20vendedor%20(seller_contact),-El%20objeto%20seller_contact)**  para el detalle de los campos.

Ejemplo de llamada:

```

curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' "Content-Type: application/json" -d '{
    "attributes": [
        {
            "id": "ROOMS",
            "value_name": "2"
        },
        {
            "id": "FULL_BATHROOMS",
            "value_name": "1"
        },
        {
            "id": "PARKING_LOTS",
            "value_name": "1"
        },
        {
            "id": "BEDROOMS",
            "value_name": "4"
        },
        {
            "id": "COVERED_AREA",
            "value_name": "30 m²"
        },
        {
            "id": "TOTAL_AREA",
            "value_name": "40 m²"
        }
    ],
    "available_quantity": 1,
    "buying_mode": "classified",
    "category_id": "MLA401686",
    "channels": [
        "marketplace"
    ],
    "condition": "not_specified",
    "currency_id": "ARS",
    "description": {
        "plain_text": "Esta es la descripción del inmueble.\n"
    },
    "listing_type_id": "silver",
    "location": {
        "address_line": "Dirección del inmueble 1234",
        "latitude": -34.48755,
        "longitude": -58.56987,
        "neighborhood": {
            "id": "TUxBQlBBUzgyNjBa"
        },
        "zip_code": "01234567"
    },
    "pictures": [
        {
            "source": "http://mla-d2-p.mlstatic.com/item-de-test-no-ofertar-543605-MLA25041518406_092016-O.jpg?square=false"
        }
    ],
    "price": 1500001,
    "seller_contact": {
        "contact": "Nombre del contacto",
        "email": "contacto@tuempresa.com",
        "other_info": "Información adicional de contacto",
        "country_code": "56",
        "area_code": "011",
        "phone": "4444-5555",
        "country_code2": "56",
        "phone2": "992999999",
        "webmail": ""
    },
    "title": "Título del inmueble",
    "video_id": "gqkEN9poKM;matterport"
}
'
https://api.mercadolibre.com/items
```

Ejemplo de respuesta:

```
{
    "id": "MLA3879350706",
    "site_id": "MLA",
    "title": "Título Del Inmueble",
    "seller_id": 1697535834,
    "category_id": "MLA401686",
    "user_product_id": "MLAU4971371215",
    "official_store_id": null,
    "price": 1500001,
    "base_price": 1500001,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "ARS",
    "initial_quantity": 1,
    "available_quantity": 1,
    "sold_quantity": 0,
    "sale_terms": [],
    "buying_mode": "classified",
    "listing_type_id": "silver",
    "start_time": "2026-08-28T11:55:31.263Z",
    "stop_time": "2026-09-27T04:00:00.000Z",
    "end_time": "2026-09-27T04:00:00.000Z",
    "expiration_time": "2026-11-16T11:55:31.381Z",
    "condition": "not_specified",
    "permalink": "http://departamento.mercadolibre.com.ar/MLA-3879350706-titulo-del-inmueble-_JM",
    "pictures": [
        {
            "id": "936060-MLA116858699745_082026",
            "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
            "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-ES.jpg",
            "size": "500x500",
            "max_size": "500x500",
            "quality": ""
        }
    ],
    "video_id": "gqkEN9poKM;matterport",
    "descriptions": [],
    "accepts_mercadopago": false,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": null,
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 1359885413,
        "comment": "Referencia: The Testing Cavern",
        "address_line": "Testing Street 1450",
        "zip_code": "1430",
        "city": {
            "id": "TUxBQlNBQTM3Mzda",
            "name": "Saavedra"
        },
        "state": {
            "id": "AR-C",
            "name": "Capital Federal"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": -34.561195,
        "longitude": -58.491933,
        "search_location": {
            "neighborhood": {
                "id": "TUxBQlNBQTM3Mzda",
                "name": "Saavedra"
            },
            "city": {
                "id": "TUxBQ0NBUGZlZG1sYQ",
                "name": "Capital Federal"
            },
            "state": {
                "id": "TUxBUENBUGw3M2E1",
                "name": "Capital Federal"
            }
        }
    },
    "seller_contact": {
        "contact": "Nombre del contacto",
        "other_info": "Información adicional de contacto",
        "area_code": "011",
        "phone": "4444-5555",
        "area_code2": "",
        "phone2": "992999999",
        "email": "contacto@tuempresa.com",
        "webpage": "",
        "country_code": "56",
        "country_code2": "56"
    },
    "location": {
        "address_line": "Dirección del inmueble 1234",
        "zip_code": "01234567",
        "neighborhood": {
            "id": "TUxBQlBBUzgyNjBa",
            "name": "Paso del Rey"
        },
        "city": {
            "id": "TUxBQ01PUmViMTE3",
            "name": "Moreno"
        },
        "state": {
            "id": "TUxBUEdSQWVmNTVm",
            "name": "Bs.As. G.B.A. Oeste"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": -34.48755,
        "longitude": -58.56987,
        "open_hours": ""
    },
    "geolocation": {
        "latitude": -34.48755,
        "longitude": -58.56987
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "ROOMS",
            "name": "Ambientes",
            "value_id": null,
            "value_name": "2",
            "values": [
                {
                    "id": null,
                    "name": "2",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "FULL_BATHROOMS",
            "name": "Baños",
            "value_id": null,
            "value_name": "1",
            "values": [
                {
                    "id": null,
                    "name": "1",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "PARKING_LOTS",
            "name": "Cocheras",
            "value_id": null,
            "value_name": "1",
            "values": [
                {
                    "id": null,
                    "name": "1",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "BEDROOMS",
            "name": "Dormitorios",
            "value_id": null,
            "value_name": "4",
            "values": [
                {
                    "id": null,
                    "name": "4",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "COVERED_AREA",
            "name": "Superficie cubierta",
            "value_id": null,
            "value_name": "30 m²",
            "values": [
                {
                    "id": null,
                    "name": "30 m²",
                    "struct": {
                        "number": 30,
                        "unit": "m²"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "TOTAL_AREA",
            "name": "Superficie total",
            "value_id": null,
            "value_name": "40 m²",
            "values": [
                {
                    "id": null,
                    "name": "40 m²",
                    "struct": {
                        "number": 40,
                        "unit": "m²"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "PROPERTY_TYPE",
            "name": "Inmueble",
            "value_id": "242062",
            "value_name": "Departamento",
            "values": [
                {
                    "id": "242062",
                    "name": "Departamento",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "OPERATION",
            "name": "Operación",
            "value_id": "242075",
            "value_name": "Venta",
            "values": [
                {
                    "id": "242075",
                    "name": "Venta",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "OPERATION_SUBTYPE",
            "name": "Subtipo de operación",
            "value_id": "244562",
            "value_name": "Propiedad individual",
            "values": [
                {
                    "id": "244562",
                    "name": "Propiedad individual",
                    "struct": null
                }
            ],
            "value_type": "list"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "thumbnail_id": "936060-MLA116858699745_082026",
    "thumbnail": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/I-ES.jpg",
    "status": "active",
    "sub_status": [],
    "tags": [
        "test_item"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLA-INDIVIDUAL_APARTMENTS_FOR_SALE",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2026-08-28T11:55:31.577Z",
    "last_updated": "2026-08-28T11:55:31.577Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

Nota:

Desde el 23 de febrero de 2026, **el envío de al menos una imagen (array pictures) es obligatorio**  en la creación de avisos via POST /items para **Listing Type Silver** . La obligatoriedad también aplica a los avisos **gold, gold_special y gold_premium**  con "requires_picture: true". Las solicitudes sin imágenes son rechazadas con HTTP 400 (error 173 – LTP_PICTURE_REQUIRED). Asegúrate de incluir al menos una imagen en el array pictures para estos tipos de avisos.

## Contacto del vendedor (seller_contact)

El objeto **seller_contact**  reúne los datos de contacto mostrados en la publicación y habilita el contacto vía WhatsApp a través de **country_code2**  y **phone2** .

Nota:

A partir del **01/10/2026** , **country_code2**  y **phone2**  pasan a ser obligatorios para todas las publicaciones de Inmuebles (Real Estate), para todos los tipos de usuario. El número de WhatsApp debe incluir el código de país en **country_code2**  (ej.: "54") y el número de celular en **phone2**  (ej.: "935122222222").

| Campo | Tipo | Estado (a partir del 01/10/2026) | Descripción |
| --- | --- | --- | --- |
| contact | String | Opcional | Nombre del contacto o representante. |
| other_info | String | Opcional | Información adicional de contacto. |
| country_code | String | Opcional | Código de país del teléfono principal. |
| area_code | String | Opcional | Código de área del teléfono principal. |
| phone | String | Opcional | Número de teléfono principal del vendedor. |
| email | String | Opcional | E-mail del vendedor para recibir consultas. |
| webpage | String | Opcional | Sitio web del vendedor o de la inmobiliaria. |
| country_code2 | String | **Obligatorio** | Código de país del número de WhatsApp. |
| phone2 | String | **Obligatorio** | Número de WhatsApp del vendedor. |

Ejemplo de la estructura completa:

```
 "seller_contact": {
    "contact": "",
    "other_info": "",
    "country_code": "54",
    "area_code": "",
    "phone": "935122222222",
    "country_code2": "54",
    "phone2": "935122222222",
    "email": "contato@testimobiliaria.com",
    "webpage": ""
  }
```

### Errores de validación "seller_contact"

**Importante:**

Los campos **country_code2**  y **phone2**  deben contener solo dígitos numéricos, sin los caracteres "+", espacios, paréntesis o guiones. Cada dato debe enviarse en el campo correspondiente. En **country_code2**  solo se debe enviar el código de País y el resto del número concatenado en **phone2** .

Si los campos obligatorios no son enviados o están vacíos, la API retornará **HTTP 400**  con uno de los códigos siguientes.

| Código de error | HTTP | Descripción | Acción |
| --- | --- | --- | --- |
| seller_contact.required | 400 | El objeto seller_contact no fue enviado. | Incluir el objeto seller_contact completo en la solicitud. |
| seller_contact.country_code2.required | 400 | country_code2 es obligatorio para este tipo de publicación. | Incluir un número de WhatsApp válido en seller_contact.country_code2. |
| seller_contact.phone2.required | 400 | phone2 es obligatorio para este tipo de publicación. | Incluir un número de WhatsApp válido en seller_contact.phone2. |
| seller_contact.country_code2.invalid | 400 | El valor de country_code2 no tiene formato válido. | Verificar que no haya caracteres especiales ni espacios. |
| seller_contact.phone2.invalid | 400 | El valor de phone2 no tiene formato válido. | Verificar que no haya caracteres especiales ni espacios. |

## Publicar inmuebles en el Portal Inmobiliario (Chile)

En Chile (MLC), para que el ítem sea correctamente publicado tanto en Mercado Libre como en el Portal Inmobiliario, es necesario incluir en el cuerpo de la solicitud el atributo **CMG_SITE** . Esto agregará el campo **listing_source: portalinmobiliario** , haciendo la publicación visible en ambos portales.

Para incluirlo, ejecuta la siguiente llamada:

```
{
  "id": "CMG_SITE",
  "name": "Site de origen",
  "value_id": null,
  "value_name": "POI",
  "value_struct": null,
  "attribute_group_id": "OTHERS",
  "attribute_group_name": "Otros"
}
```

### Lecturas recomendadas

- [Publicaciones de tiendas oficiales](https://developers.mercadolibre.com.ar/es_ar/publicaciones-de-tiendas-oficiales-para-inmuebles)

- [Actualiza tu inmueble](https://developers.mercadolibre.com.ar/es_ar/actualiza-tus-publicaciones)

- [Ciclo de vida de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/ciclo-de-vida-de-las-publicaciones-de-inmuebles)

- [Calidad de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles)

- [Leads](https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 28/08/2026 | 1.1 | Actualización sobre la obligatoriedad de los campos **country_code2**  y **phone2**  en seller_contact para todas las publicaciones de Inmuebles (Real Estate), independientemente del tipo de usuario. |
| 06/11/2025 | 1.0 | Publicación inicial |
