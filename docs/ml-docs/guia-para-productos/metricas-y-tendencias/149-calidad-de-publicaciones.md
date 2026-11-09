<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Calidad de publicaciones

Última actualización 31/01/2025

## Calidad de publicaciones

**Importante:**

Mercado Libre está actualizando la forma de medir la calidad de sus publicaciones. Como resultado, la API /health será descontinuada el 7 de febrero y reemplazada por la API /performance, que engloba todas las métricas y acciones necesarias para aumentar la calidad de las publicaciones.

El recurso /performance te permite mostrarle a los usuarios (vendedores) la calidad de las publicaciones, sabiendo qué acciones están cumplidas y las pendientes. De esta manera, pueden alcanzar los objetivos de publicación y aumentar la calidad de las publicaciones, mejorando la exposición del ítem y también la experiencia de venta y compra.

## Niveles de calidad por sitio

El nivel de calidad está separado por sitio en el campo level_wording de la siguiente manera:

| Site | Bad | Medium | Good |
| --- | --- | --- | --- |
| MLB | Básica | Satisfatória | Profissional |
| MLA | Básica | Estándar | Profesional |
| CBT | Basic | Standard | Professional |
| Otros sites | Básica | Estándar | Profesional |

## Detalle de la calidad por ítem

Para conocer el nivel de calidad de un ítem, dispones del recurso /performance. En este, puedes ver todos los datos de calidad del ítem, la cantidad de objetivos cumplidos y las acciones aplicables. Y además, conoces el nivel en el que se encuentra.

**Importante:**

Todos los datos de la API /health anterior se agruparon en 1 endpoint, sin necesidad de realizar más consultas para obtener más detalles.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/item/$ITEM_ID/performance
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/item/MLA1435540505/performance
```

Respuesta:

```

{
    "entity_type": "ITEM",
    "entity_id": "MLA1435540505",
    "score": 69,
    "level": "Good",
    "level_wording": "Profesional",
    "calculated_at": "2024-07-02T14:56:58Z",
    "buckets": [
        {
            "key": "CHARACTERISTICS",
            "type": "",
            "status": "PENDING",
            "score": 74.337616,
            "title": "Datos del producto",
            "calculated_at": "2024-07-02T14:56:58Z",
            "variables": [
                {
                    "key": "GTIN",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Indicá el código universal de tu producto para no perder exposición",
                    "rules": [
                        {
                            "key": "HAS_GTIN",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Asegurate de completar el código que pertenezca a este producto para estar más arriba en los resultados de búsqueda.",
                                "label": "Completar código universal",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=universal_code_no_variations&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "PICTURES",
                    "status": "PENDING",
                    "score": 33.333336,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Mejorá las fotos para tener más visitas",
                    "rules": [
                        {
                            "key": "PICTURES_QUANTITY_MIN",
                            "status": "PENDING",
                            "progress": 0.33333334,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Agregá más fotos para mostrar tu producto desde diferentes ángulos, subí 3 como mínimo.",
                                "label": "Agregar fotos",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=picture_uploader_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "TITLE",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Corregí el título para que puedan encontrar tu producto más fácil",
                    "rules": [
                        {
                            "key": "TITLE_LENGTH_MIN",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Sumá más detalles, el título debe tener al menos 3 palabras.",
                                "label": "Mejorar título",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=title_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "TECHNICAL_SPECIFICATIONS_MAIN",
                    "status": "PENDING",
                    "score": 47.499996,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Corregí las características para recibir menos preguntas y devoluciones",
                    "rules": [
                        {
                            "key": "TS_MAIN_QUANTITY",
                            "status": "PENDING",
                            "progress": 0.67499995,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Completá las características principales.",
                                "label": "Completar características",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=technical_specifications_task&itemId=MLA1435540505"
                            }
                        },
                        {
                            "key": "TS_MAIN_QUALITY_INCOMPLETE_REQUIRED",
                            "status": "PENDING",
                            "progress": 1,
                            "mode": "WARNING",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Completá los datos marcados como “requeridos”.",
                                "label": "Completar características",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=technical_specifications_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                }
            ]
        },
        {
            "key": "OFFER",
            "type": "",
            "status": "PENDING",
            "score": 61.111107,
            "title": "Condiciones de venta",
            "calculated_at": "2024-07-02T14:56:58Z",
            "variables": [
                {
                    "key": "STOCK_AVAILABILITY_TIME",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Reducí el tiempo de disponibilidad para que tu publicación sea más competitiva",
                    "rules": [
                        {
                            "key": "BEST_STOCK_AVAILABILITY_TIME",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Reducí el tiempo de disponibilidad para que tu publicación sea más competitiva",
                                "label": "Modificar tiempo",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=stock_availability_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "FREE_SHIPPING",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Ofrecé envío gratis para que tu publicación sea más competitiva",
                    "rules": [
                        {
                            "key": "HAS_FREE_SHIPPING",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Ofrecé envío gratis para que tu publicación sea más competitiva",
                                "label": "Modificar envío",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=shipping_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "ME",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Ofrecé envíos con Mercado Libre para que te compren desde todo el país",
                    "rules": [
                        {
                            "key": "HAS_MERCADO_ENVIOS",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Ofrecé envíos con Mercado Libre para que te compren desde todo el país",
                                "label": "Modificar envío",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=shipping_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "FINANCING",
                    "status": "PENDING",
                    "score": 0,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Agregá cuotas al mismo precio que publicaste para que tu publicación sea más competitiva",
                    "rules": [
                        {
                            "key": "BEST_FINANCING",
                            "status": "PENDING",
                            "progress": 0,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Agregá cuotas al mismo precio que publicaste para que tu publicación sea más competitiva",
                                "label": "Agregar cuotas",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=listing_types_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "STOCK_DEPOSITO",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-07-02T14:56:58Z",
                    "title": "Agregá más stock y evitá perder ventas",
                    "rules": [
                        {
                            "key": "HAS_STOCK_DEPOSITO",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-07-02T14:56:58Z",
                            "wordings": {
                                "title": "Asegurate de que tu publicación tenga 2 o más unidades disponibles.",
                                "label": "Agregar unidades",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=stock_sku_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                }
            ]
        }
    ]
}
```

## Detalle de la calidad por User Product

Además es posible obtener los detalles a nível User Product, consultando todos los datos de calidad, su nível y acciones necesarias:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-product/$USER-PRODUCT-ID/performance
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/user-product/MLAU395977691/performance
```

Respuesta:

```

{
    "entity_type": "USER_PRODUCT",
    "entity_id": "MLAU395977691",
    "score": 68,
    "level": "Profesional",
    "calculated_at": "2024-12-10T14:17:59Z",
    "buckets": [
        {
            "key": "USER_PRODUCT",
            "type": "USER_PRODUCT",
            "status": "PENDING",
            "score": 78.31277,
            "title": "Datos del producto",
            "calculated_at": "2024-12-10T14:17:58Z",
            "variables": [
                {
                    "key": "UP_PICTURES",
                    "status": "PENDING",
                    "score": 33.333336,
                    "calculated_at": "2024-12-10T14:17:58Z",
                    "title": "Mejorá las fotos para tener más visitas",
                    "rules": [
                        {
                            "key": "UP_PICTURES_QUANTITY_MIN",
                            "status": "PENDING",
                            "progress": 0.33333334,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:58Z",
                            "wordings": {
                                "title": "Agregá más fotos para mostrar tu producto desde diferentes ángulos, subí 3 como mínimo.",
                                "label": "Agregar fotos",
                                "link": "https://www.mercadolibre.com.ar/publicaciones/MLAU395977691/modificar/omni/variation/dominio/picture-uploader-default"
                            }
                        }
                    ]
                },
                {
                    "key": "UP_TECHNICAL_SPECIFICATIONS_MAIN",
                    "status": "PENDING",
                    "score": 65,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Corregí las características para recibir menos preguntas y devoluciones",
                    "rules": [
                        {
                            "key": "UP_TS_MAIN_QUANTITY",
                            "status": "PENDING",
                            "progress": 0.85,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Completa las características principales.",
                                "label": "Completar características",
                                "link": "https://www.mercadolibre.com.ar/publicaciones/MLAU395977691/modificar/omni/variation/dominio/techspecs-primary"
                            }
                        },
                        {
                            "key": "UP_TS_MAIN_QUALITY_INCOMPLETE_REQUIRED",
                            "status": "PENDING",
                            "progress": 1,
                            "mode": "WARNING",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Completá los datos marcados como “requeridos”.",
                                "label": "Completar características",
                                "link": "https://www.mercadolibre.com.ar/publicaciones/MLAU395977691/modificar/omni/variation/dominio/techspecs-primary"
                            }
                        }
                    ]
                },
                {
                    "key": "UP_GTIN",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Indicá el código universal de tu producto para no perder exposición",
                    "rules": [
                        {
                            "key": "UP_HAS_GTIN",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Asegurate de completar el código que pertenezca a este producto para estar más arriba en los resultados de búsqueda.",
                                "label": "Completar código universal",
                                "link": "https://www.mercadolibre.com.ar/publicaciones/MLAU395977691/modificar/omni/variation/dominio/universal-code-default"
                            }
                        }
                    ]
                },
                {
                    "key": "UP_STOCK_DEPOSITO",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Revisa tu stock para que puedas seguir vendiendo",
                    "rules": [
                        {
                            "key": "UP_HAS_STOCK_DEPOSITO",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Agregá stock a tu publicación",
                                "label": "Agregar unidades",
                                "link": "https://www.mercadolibre.com.ar/publicaciones/MLAU395977691/modificar/omni/variation/dominio/stock-sku-default"
                            }
                        }
                    ]
                },
                {
                    "key": "UP_TITLE",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Corregí el título para que puedan encontrar tu producto más fácil",
                    "rules": [
                        {
                            "key": "UP_TITLE_LENGTH_MIN",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Sumá más detalles, el título debe tener al menos 3 palabras.",
                                "label": "Mejorar título",
                                "link": "https://www.mercadolibre.com.ar/publicaciones/MLAU395977691/modificar/omni/variation/dominio/title-default"
                            }
                        }
                    ]
                },
                {
                    "key": "UP_STOCK_AVAILABILITY_TIME",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Reducí el tiempo de disponibilidad para que tu publicación sea más competitiva",
                    "rules": [
                        {
                            "key": "UP_BEST_STOCK_AVAILABILITY_TIME",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Reducí el tiempo de disponibilidad para que tu publicación sea más competitiva",
                                "label": "Modificar tiempo",
                                "link": "https://www.mercadolibre.com.ar/publicaciones/MLAU395977691/modificar/omni/variation/dominio/stock-availability-default"
                            }
                        }
                    ]
                }
            ]
        },
        {
            "key": "MLA1435540505",
            "type": "ITEM",
            "status": "PENDING",
            "score": 53.33333,
            "title": "Condiciones de venta",
            "calculated_at": "2024-12-10T14:17:58Z",
            "variables": [
                {
                    "key": "UP_FINANCING",
                    "status": "PENDING",
                    "score": 0,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Agregá cuotas al mismo precio que publicaste para que tu publicación sea más competitiva",
                    "rules": [
                        {
                            "key": "UP_BEST_FINANCING",
                            "status": "PENDING",
                            "progress": 0,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Agregá cuotas al mismo precio que publicaste para que tu publicación sea más competitiva",
                                "label": "Agregar cuotas",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=listing_types_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "UP_FREE_SHIPPING",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Ofrecé envío gratis para que tu publicación sea más competitiva",
                    "rules": [
                        {
                            "key": "UP_HAS_FREE_SHIPPING",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Ofrecé envío gratis para que tu publicación sea más competitiva",
                                "label": "Modificar envío",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=shipping_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                },
                {
                    "key": "UP_ME",
                    "status": "COMPLETED",
                    "score": 100,
                    "calculated_at": "2024-12-10T14:17:59Z",
                    "title": "Ofrecé envíos con Mercado Libre para que te compren desde todo el país",
                    "rules": [
                        {
                            "key": "UP_HAS_MERCADO_ENVIOS",
                            "status": "COMPLETED",
                            "progress": 1,
                            "mode": "OPPORTUNITY",
                            "calculated_at": "2024-12-10T14:17:59Z",
                            "wordings": {
                                "title": "Ofrecé envíos con Mercado Libre para que te compren desde todo el país",
                                "label": "Modificar envío",
                                "link": "https://www.mercadolibre.com.ar/syi/core/modify?taskId=shipping_task&itemId=MLA1435540505"
                            }
                        }
                    ]
                }
            ]
        }
    ]
}
```

### Campos de la respuesta

Estos son el detalle de los datos que devuelve la API:

- **entity_type** : Indica qué tipo de entidad es el ID consultado, si ITEM o USER_PRODUCT.

- **entity_id** : Id del ITEM/USER_PRODUCT.

- **score** : Representa el porcentaje de calidad del ítem. La escala va de 0 a 100.

- **level** : Identificación del nivel de calidad en que se encuentra el ítem: Básica, Estándar o Profesional.

- **calculated_at** : Fecha y hora del último cálculo de la calidad del ítem.

- **buckets** : Lista de objetos del tipo bucket.

- **key** : Identificador de la entidad.

- **type** : Indica si el bucket pertenece a un ITEM o un USER_PRODUCT.

- **status** : Indica el estado de la entidad. "PENDING" si faltan realizar acciones o "COMPLETED" si se realizaron todas.

- **score** : Indica el porcentaje cumplido.

- **calculated_at** : Fecha y hora del último cálculo de la entidad.

- **title** : Texto principal de la entidad.

- **variables** : Lista de objetos del tipo variable.

- **key** : Identificador de la entidad.

- **status** : Indica el estado de la entidad. "PENDING" si faltan realizar acciones o "COMPLETED" si se realizaron todas.

- **score** : Indica el porcentaje cumplido.

- **calculated_at** : Fecha y hora del último cálculo de la entidad.

- **title** : Texto principal de la entidad.

- **rules** : Lista de objetos del tipo rule.

- **key** : Identificador de la entidad.

- **status** : Indica el estado de la entidad. "PENDING" si faltan realizar acciones o "COMPLETED" si se realizaron todas.

- **progress** : Indica el porcentaje cumplido.

- **mode** : Indica si la entidad es del tipo OPPORTUNITY, oportunidades para mejorar la calidad de la publicación, o WARNING, problemas con la calidad que disminuyen el score hasta que se resuelvan.

- **calculated_at** : Fecha y hora del último cálculo de la entidad.

- **wordings** : Textos utilizados en la entidad.

- **title** : Texto principal de la entidad.

- **label** : Texto para representar el link.

- **link** : URL que lleva al vendedor a completar el objetivo.

### Errores

Posibles errores en la API:

| Error | Mensaje | Motivo |
| --- | --- | --- |
| 400 | The request sent is not valid | Problemas de formateo de la request |
| 401 | Caller must be the seller of the item | El ítem/user-product que estás enviando no pertenece al usuario del access_token |
| 403 | You do not have permission to access this resource | Problemas de permisos en el access_token |
| 404 | Not found item performance | Datos de rendimiento no generados |
| 500 | We are presenting problems. We will solve them as soon as possible. | Error interno en el servidor |
