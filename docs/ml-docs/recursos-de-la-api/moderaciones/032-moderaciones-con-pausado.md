<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/moderaciones-con-pausado -->
<!-- Sección: Recursos de la API > Moderaciones -->

# Moderaciones con pausado

Última actualización 12/06/2026

## Moderaciones con pausado

A diferencia de las moderaciones con status **under_review** , desde Mercado Libre también **pausamos publicaciones de forma preventiva**  por distintos motivos, como por ejemplo:

- **Cambio inusual de precio** : Cuando el vendedor modifica por error el precio.

- **Ítems sin ventas o abandonados** : Cuando el vendedor tiene ítems sin ventas.

- **Carga de imágenes por URL** : Cuando el vendedor publica imágenes mediante URL y estas aún no son procesadas.

- **Inmueble no disponible** : Cuando compradores reportan que la propiedad ya no está disponible.

Para todos estos casos, el vendedor podrá revisar y activar el ítem.

## Consultar moderaciones con item pausados

Realiza una búsqueda de publicaciones con **status: paused**  y el tag **moderation_penalty** . Para activarla, debes realizar un PUT a /items con **status: active** , ya que este tipo de moderación preventiva solo pausa la publicación.

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/0123456789/items/search?tags=moderation_penalty&status=paused
```

**Respuesta:**

```
{
  "seller_id": "0123456789",
  "paging": {...},
  "results": [
    "MLA1147839589",
    "MLA1148439168",
    "MLA1149506534",
    "MLA1157034561",
    "MLA1164314507",
    "MLA1173423437"
  ],
  "orders": [...],
  "available_orders": [...]
}
```

Cuando identifiques estos ítems, debes consultar sus moderaciones. Por ejemplo:

## Moderación por cambio inusual de precio

**Llamada:**

```
curl -L -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/moderations/last_moderation/$MODERATION_REFERENCE_ID
```

Nota:

Para comprender cómo obtener MODERATION_REFERENCE_ID pueden verlo en la sección de ‘Gestionar Moderaciones’

**Ejemplo:**

```
curl -L -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/moderations/last_moderation/MLA926647862-ITM
```

**Respuesta:**

```
[
  {
    "name": "PAUSED_PREVENTION_PRICE",
    "id": "7123400818",
    "date_created": "2022-10-25 15:57:46.0",
    "wordings": [
      {
        "type": "REASON",
        "value": "La pausamos porque detectamos un cambio inusual en su precio. Verificá el valor antes de reactivarla. Una vez que lo hagas, quedará activa en unos minutos."
      },
      {
        "type": "REMEDY",
        "value": "Inactiva para revisar. La pausamos porque detectamos un cambio inusual en su precio. Verificá el valor antes de reactivarla. Una vez que lo hagas, quedará activa en unos minutos."
      }
    ],
    "evidence": [
      {
        "text_matched": "El precio alertado es 77393.720000",
        "section_name": "item"
      }
    ]
  }
]
```

En este caso te recomendamos dar el accionable al vendedor de [**corregir precio**  y **activar**  el ítem.](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones#Actualiza-tu-art%C3%ADculo)

## Moderación de ítem sin ventas

Los ítems sin ventas y/o sin visitas también podrán ser pausados por Mercado Libre para evitar afectar la reputación del vendedor.
 Ejecutando la misma llamada anterior, obtenemos información sobre este tipo de moderación.

Conoce [cómo gestionar las publicaciones que no tuvieron ventas en un largo periodo de tiempo](https://www.mercadolibre.com.ar/ayuda/31269).

**Ejemplo:**

```
curl -L -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/moderations/last_moderation/MLA123444123-ITM
```

**Respuesta:**

```
[
  {
    "name": "ABANDONED_ITEM_PERFORMANCE_WARNING",
    "id": "7123400817",
    "date_created": "2024-10-07 15:57:46.0",
    "wordings": [
      {
        "type": "REASON",
        "value": "La pausamos porque no tuvo ventas durante un largo periodo de tiempo. Lo hicimos para ayudarte en la gestión y evitarte cancelaciones.",
        "section_focus": "default"
      },
      {
        "type": "REMEDY",
        "value": "Inactiva para revisar. Si todavía querés vender tu publicación, revisala para verificar que esté actualizada y reactivala para que vuelva a estar a la venta, o podés eliminarla si ya no vendés."
      }
    ],
    "evidence": [
      {
        "text_matched": "Moderado por un proceso interno del usecase: abandoned-item-performance y la ejecución abandoned-item-performance_STANDARD",
        "section_name": "item"
      }
    ]
  }
]
```

En este caso te recomendamos dar el **accionable**  al vendedor de **revisar la publicación para verificar que esté actualizada y reactivarla**  para que vuelva a estar a la venta o **eliminarla**  si ya no vende.

## Carga de imágenes por URL

Nota VIS:

A partir de junio , cuando el vendedor realice la carga de imágenes mediante URL, la publicaciones quedarán con status “not_yet_active” o con status “"paused” (dependiendo el tipo de seller) y substatus: “picture_download_pending” mientras Mercado Libre procesa y válida la descarga de todas las imágenes. El rollout será progresivo para cada site:

- MCO y MLM: 4 de junio.

- MLA: 11 de junio.

- MLB: 25 de junio.

- MLC: O1 de agosto.

Al crear un nuevo ítem y subir imágenes mediante URLs (source), Mercado Libre necesita descargar y validar las imágenes antes de activar la publicación. Durante ese proceso, el estado del ítem será:

**1- Para publicaciones de Marketplace:**

- **status:**  "paused"

- **sub_status:**  "picture_download_pending"

**2- Para publicaciones de Inmuebles y Vehículos:**

- Si el vendedor tiene **user_type**  = "normal":  status: "paused" sub_status: "picture_download_pending"

- Si el vendedor tiene **user_type**  = "real_estate_agency" o "car_dealer":  status: "not_yet_active" sub_status: "picture_download_pending"

**Activación automática:**  Cuando las imágenes se descargan correctamente y cumplen con los requisitos, la publicación se activa automáticamente con: **status:**  "active"

## Casos en los que el ítem será moderado

Si las imágenes:

- No pueden descargarse dentro de un período determinado, o

- Se descargan pero no cumplen con las **dimensiones mínimas requeridas** ,  entonces el ítem será moderado con:  **status:**  "under_review" **sub_status:**  "picture_download_pending"

En los casos donde las imágenes no puedan descargarse luego de un período de tiempo definido o que la imagen descargada esté por debajo de las dimensiones mínimas esperadas, el ítem quedará moderado con **status** : “under_review” y **sub_status** : “picture_download_pending”.

**Recuerda**  que cada **imagen será válida**  siempre que su dimensión sea como mínimo de **250px en ambos lados (width y height)**  y al menos un lado de más de **500px** .

Si la imagen no puede descargarse luego de un período de tiempo definido, el ítem quedará moderado con **status:**  under_review, **sub_status:**  picture_downloading_pending.

**Respuesta:**

```
[
  {
    "name": "PICTURE_DOWNLOAD_PENDING",
    "id": "7123400222",
    "date_created": "2025-05-01 02:00:38.0",
    "wordings": [
      {
        "type": "REMEDY",
        "value": "La foto no se cargó correctamente. Corrígela para reactivar tu publicación."
      },
      {
        "type": "REASON",
        "value": "La foto no se cargó correctamente. Corregila para reactivar tu publicación."
      }
    ],
    "evidence": [
      {
        "text_matched": "MLA2087670262",
        "section_name": "item"
      }
    ]
  }
]
```

En este caso te recomendamos dar el **accionable al vendedor cargar nuevamente su imagen de portada**  ya que no pudo ser procesada (link inválido de imagen).

Nota:

Para evitar el pausado automático de las publicaciones, te sugerimos consultar la documentación de ‘Diagnóstico de imágenes’ para revisar las imágenes que quieres para tu publicación y evitar moderaciones.

## Moderación de inmueble no disponible

Las publicaciones de Inmuebles podrán ser pausadas cuando los compradores reporten que la propiedad ya no está disponible (vendida, arrendada o retirada). Esta moderación se activa ante la primera señal recibida, ya sea una **denuncia desde la vista de publicación**  o una **respuesta negativa en la encuesta post-contacto** .

Disponible en: **MLC** , **MLA** , **MLU** , **MLM** .

### Obtener información sobre este tipo de moderación

**Llamada:**

```
curl -L -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/moderations/last_moderation/$ITEM_ID-ITM
```

**Response:**

```
[
    {
        "name": "ABANDONED_ITEM_REX_DEN",
        "id": "9195714319",
        "date_created": "2026-06-03T18:58:51.000-0400",
        "wordings": [
            {
                "type": "REASON",
                "value": "Reportada como no disponible."
            },
            {
                "type": "REMEDY",
                "value": "Pausamos esta publicación porque tus personas interesadas nos avisaron que no está disponible. En caso que la propiedad no esté disponible, elimínala. Sino, reactívala desde el listado de Publicaciones."
            }
        ],
        "evidence": [
            {
                "text_matched": "",
                "section_name": "title"
            }
        ]
    }
]
```

- **name:**  nombre del filtro que generó la moderación.

- **REASON:**  motivo de la pausa — recomendamos mostrarlo al vendedor.

- **REMEDY:**  accionable sugerido para que el vendedor resuelva la moderación.

En este caso te recomendamos dar el accionable al vendedor de revisar la publicación. Si la propiedad sigue disponible, puede reactivarla. Si fue vendida o arrendada, recomendamos cerrarla para evitar nuevas moderaciones.

### Reactivar el ítem

Al igual que los demás tipos de moderación preventiva, para reactivar el ítem debes realizar un PUT a /items con status: active

**Llamada:**

```
curl -X PUT \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -H 'Content-Type: application/json' \
    -d '{"status": "active"}' \
    https://api.mercadolibre.com/items/$ITEM_ID
```

Importante:

Si la propiedad ya no está disponible, reactivar el ítem puede generar una nueva moderación. En esos casos recomendamos cerrar la publicación.

### Vendedores integrados

Los vendedores que publican vía API o CRM externo recibirán la notificación de moderación a través del canal de **webhook/callback**  de moderaciones existente, sin requerir configuración adicional. El topic es **items**  y el recurso referencia el ítem afectado.

```
{
    "resource": "/items/MLC1234567890",
    "user_id": 123456789,
    "topic": "items",
    "application_id": 0000000000000000,
    "attempts": 1,
    "sent": "2026-06-01T12:00:00.000Z",
    "_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

Tras recibir la notificación, consultá el ítem para verificar el cambio de estado y mostrá al vendedor el motivo y el accionable correspondientes.

**Siguiente** : [Diagnóstico de imágenes](https://developers.mercadolibre.com.ar/es_ar/diagnostico-imagenes?nocache=true).
