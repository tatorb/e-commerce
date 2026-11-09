<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestionar-moderaciones -->
<!-- Sección: Recursos de la API > Moderaciones -->

# Gestionar moderaciones

Última actualización 08/06/2026

## Gestionar Moderaciones

Esta guía te ayudará a consultar, entender y actuar sobre las moderaciones aplicadas a tus publicaciones.

- **Inactiva** : La publicación fue dada de baja, el vendedor no puede modificarla o recuperarla.

- **Inactiva para revisar** : La publicación fue pausada y puede reactivarse realizando cambios en la misma.

- **Activa perdiendo exposición** : La publicación está perdiendo exposición y se deben hacer cambios en las fotos o completar la ficha técnica para que cumpla los requisitos.

- 

Para mayor información, consulta las políticas de publicación de Mercado Libre ([Argentina](https://www.mercadolibre.com.ar/ayuda/Politicas-de-Publicacion_1011), [Brasil](https://www.mercadolivre.com.br/ajuda/Politicas-de-Publicacion_1011), [México](https://www.mercadolibre.com.mx/ayuda/Politicas-de-Publicacion_1011), [Chile](https://www.mercadolibre.cl/ayuda/Politicas-de-Publicacion_1011), [Colombia](https://www.mercadolibre.com.co/ayuda/Politicas-de-Publicacion_1011) y [Uruguay](https://www.mercadolibre.com.uy/ayuda/Politicas-de-Publicacion_1011)).

## Consultar moderaciones

Con el recurso **/moderations/last_moderation**  podrás gestionar ítems moderados a partir de notificaciones o consultas activas. Te recomendamos identificar la razón (reason) y solución (remedy) y garantizar accionables para vendedores según el tipo de moderación recibida.

## Flujo recomendado

Nota:

El **moderation_reference_id**  sigue el formato: element_id + "-” + element_type.
 Para construirlo correctamente a partir de una notificación del tópico /items, tomá el valor del campo source y concatenale el sufijo -ITM.

 Sufijos: ITM: publicación | QUE: preguntas y respuestas | REV: reviews de productos.

 Ejemplo: Notificación → id: MLA1234567890 → moderation_reference_id: MLA1234567890-ITM .

Usá este recurso para obtener la última moderación aplicada a un ítem:

**Llamada:**

```
curl -L -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
'https://api.mercadolibre.com/moderations/last_moderation/$MODERATION_REFERENCE_ID'
```

**Respuesta:**

```
[
  {
    "name": "POOR_QUALITY_THUMBNAIL",
    "id": "MLA851234738",
    "date_created": "2021-04-14T10:47:05.270-0400",
    "evidences": [
      {
        "text_matched": "987718-MLA41961234834_052020",
        "section_name": "pictures"
      },
      {
        "text_matched": "MLA373388",
        "section_name": "category"
      }
    ],
    "wordings": [
      {
        "type": "REMEDY",
        "value": "Corrige tus fotos: El fondo de tu foto debe ser blanco digitalizado."
      },
      {
        "type": "REASON",
        "value": "La portada no tiene fondo blanco digitalizado."
      }
    ]
  }
]
```

### Campos de la respuesta

- **name:**  nombre del filtro que generó la moderación

- **id:**  Identificador único de la moderación activa. Una vez que la moderación es resuelta deja de existir, no debe ser usado como referencia persistente.

- **date_created:**  fecha de creación de la moderación. Formato: YYYY-MM-DD

- **evidences:**  referencia a en donde se encontró la infracción  **text_matched:**  Valor o texto específico que fue detectado como infracción (por ejemplo, un ID de imagen o categoría). **section_name:**  Sección del contenido donde se encontró la infracción. Por ejemplo: pictures, category.

- **wordings:**  Mensajes explicativos asociados a la moderación  **type:**  **REASON** : motivo de la infracción | **REMEDY** : acción sugerida para corregirla **value:**  Texto del mensaje correspondiente, dirigido al usuario, explicando el motivo o la acción a tomar.

Para publicaciones que hayan sido dadas de baja y no puedan ser modificadas ni recuperadas debido a una moderación, la **respuesta**  será:

```
[
  {
    "name": "DENYLIST",
    "id": "7123400816",
    "date_created": "2021-04-14T10:47:05.270-0400",
    "evidences": [
      {
        "section_name": "title",
        "text_matched": "Apple - Iphone-BDM-BDS"
      }
    ],
    "wordings": [
      {
        "type": "REASON",
        "value": "Seu anúncio foi cancelado porque a Apple confirmou a denúncia por falsificação."
      }
    ]
  }
]
```

Solo se recibirá el REASON, ya que la moderación no tiene un REMEDY

## Filtrar items moderados de un usuario

Para consultar publicaciones con moderaciones activas, podés consultar aquellas con:

- **status:**  under_review

- **sub_status:**   warning waiting_for_patch held pending_documentation forbidden picture_downloading_pending

**→**  Filtrando por **status=pending**

Nota:

No olvides mostrar las [moderaciones con status **paused**](https://developers.mercadolibre.com.ar/es_ar/moderaciones-con-pausado?nocache=true#) como cambio inusual de precio y [moderaciones con status **active** , como moderaciones de imágenes](https://developers.mercadolibre.com.ar/es_ar/moderaciones-de-imagenes?nocache=true).

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/$USER_ID/items/search?status=pending
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/users/123456/items/search?status=pending
```

**Respuesta:**

```
{
  "seller_id": "123456",
  "query": null,
  "paging": {
    "limit": 50,
    "offset": 0,
    "total": 8
  },
  "results": [
    "MLC951993111",
    "MLC951803222",
    "MLC949619333",
    "MLC949664444",
    "MLC947745555",
    "MLC947725666",
    "MLC947725777",
    "MLC947699888"
  ],
  "orders": [...]
}
```

Una vez ya tengas los ítems que quieras consultar, podés hacerlo directamente sobre /last_moderations agregando el sufijo.

## Status, substatus y tags de moderaciones

| Status | Substatus | Tag | Detalle |
| --- | --- | --- | --- |
|  |  |  |  |
| Closed |  | moderation_penalty | [Ítem sin ventas](https://developers.mercadolibre.com.ar/es_ar/moderaciones-con-pausado?nocache=true#). |
| Paused | picture_downloading_pending |  | [Pausado por carga de foto con URL](https://developers.mercadolibre.com.ar/es_ar/moderaciones-con-pausado?nocache=true#). |
| Paused |  | moderation_penalty | [Cambio inusual de precios + ítem sin ventas](https://developers.mercadolibre.com.ar/es_ar/moderaciones-con-pausado?nocache=true#). |
| Under review | Waiting_for_patch |  | Ítem pausado ya que se detectaron infracciones y el usuario debe modificarlo para que se active. |
| Under review | Forbidden |  | Ítem inhabilitado por Mercado Libre. Sustituye a Inactive. |
| Under review | Held |  | Inactiva. En revisión por Mercado Libre. |
| Under review | pending_documentation |  | Ítem con denuncia de [Brand Protection Program](https://developers.mercadolibre.com.ar/es_ar/publicaciones-denunciadas). |
| Under review | suspended, suspended_for_prevention |  | Suspensión de ítems con riesgo de operaciones fraudulentas. |
| Active |  | poor_quality_thumbnail | [Foto de mala calidad](https://developers.mercadolibre.com.ar/es_ar/moderaciones-de-imagenes?nocache=true). |
| Active |  | moderation_penalty | Ítem con alguna penalidad. Puedes modificar status, blureo u otras. |

Conoce más sobre [flujo y los estados de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones?nocache=true#Flujo-de-estados-de-las-publicaciones).

# Histórico de moderaciones

Con el recurso **/infractions**  accedés al histórico de infracciones detectadas en ítems, preguntas, respuestas y opiniones de productos.

## Flujo recomendado

## Consultar histórico de infracciones de un usuario

Con la siguiente consulta podrás ver las infracciones con **estado final**  (forbidden) y aquellas con **estado temporal**  (waiting_for_patch, held, pending_documentation).

Tené en cuenta que **no se incluyen ítems dados de baja por duplicados** .

Nota:

Si el usuario está suspendido, consulta **/users/$USER_ID**  e identifica el campo **status → list → allow** . En caso de que sea **false** , significa que está suspendido.

**Parámetros de consulta:**

- **related_item_id** : ID de la publicación asociada a la infracción.

- **element_id** : ID del elemento moderado.

- **element_type** : Tipo del elemento moderado. ITM (ítem), REV (review), QUE (pregunta/respuesta).

- **date_created_since** : Fecha de inicio del filtrado. Formato: YYYY-MM-DD

- **date_created_to** : Fecha de fin del filtrado. Formato: YYYY-MM-DD

- **language** : Puedes solicitar los textos del reason y remedy en idioma español o portugués. El idioma por default es inglés. ES (español) o PT (portugués).

- **limit** : Cantidad de infracciones devueltas. El valor es de 1 a 20. Por default 20.

- **offset** : Offset para el paginado.

- **sort** : Ordenar los resultados por fecha de creación de manera ascendente o descendente. Ejemplo `date_created_asc`, `date_created_desc`.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/moderations/infractions/$USER_ID?date_created_since=YYYY-MM-DD&limit=2
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/moderations/infractions/288230000?date_created_since=2023-09-01&limit=2
```

**Respuesta:**

```
{
  "infractions": [
    {
      "id": "1378710000",
      "date_created": "2023-09-11T10:37:45.107-0400",
      "user_id": "288230000",
      "related_item_id": "MLA135230000",
      "element_id": "MLA135200000",
      "element_type": "ITM",
      "site_id": "MLA",
      "filter_subgroup": "DESC",
      "reason": "La pausamos porque detectamos un cambio inusual en su precio. Verificá el valor antes de reactivarla. Una vez que lo hagas, quedará activa en unos minutos.",
      "remedy": "Inactiva para revisarLa pausamos porque detectamos un cambio inusual en su precio. Verificá el valor antes de reactivarla. Una vez que lo hagas, quedará activa en unos minutos."
    },
    {
      "id": "1366077111",
      "date_created": "2023-09-03T13:02:14.109-0400",
      "user_id": "288230000",
      "related_item_id": "MLA138621111",
      "element_id": "MLA138621111",
      "element_type": "ITM",
      "site_id": "MLA",
      "filter_subgroup": "PQT",
      "reason": "Tu foto de portada no tiene fondo blanco puro. Corrígelo para reactivar tu publicación.",
      "remedy": "Tu foto de portada aún tiene problemas, corrígela para reactivar tu publicación. El fondo de esta foto debe ser blanco puro, no uses texturas o elementos de fondo!"
    }
  ],
  "paging": {
    "offset": 0,
    "limit": 2,
    "total": 3
  },
  "sorting_type": "date_created_desc"
}
```

**Parámetros de respuesta:**

- **id** : Identificador único de la infracción.

- **date_created** : Fecha en que se produjo la infracción.

- **user_id** : El usuario que realizó la infracción.

- **related_item_id** : Identificador único de la publicación relacionada con el elemento que posee la infracción. Si la infracción es en una publicación, el valor de este atributo será igual al valor del atributo **element_id** .

- **element_id** : Identificador único del elemento que posee la infracción. Es dependiente del atributo **element_type** .

- **element_type** : Tipo de elemento, los valores pueden ser: ITM (publicación), QUE (preguntas y respuestas) y REV (reviews de productos).

- **subgroup** : Este campo te permite identificar, agrupar y resumir (sumarizar) las infracciones pertenecientes a los distintos grupos de filtros.

| filter_subgroup | Moderación | Solución |
| --- | --- | --- |
|  |  |  |
| DOMAIN | Publicaciones mal categorizadas | [Utiliza el predictor de categorías](https://developers.mercadolibre.com.ar/es_ar/categoriza-productos). |
| PQT | Calidad de foto | Conoce [como mejorar imagen](https://developers.mercadolibre.com.ar/es_ar/moderaciones-de-imagenes?nocache=true). |
| DESC | Cambio inusual de precio | Verifica el precio y activa tu publicación. |
| OPT_OBEY | Catálogo | Crea tu publicación en [Catálogo](https://developers.mercadolibre.com.ar/es_ar/publicacion-en-catalogo). |
| CATALOG_ONLY_RESTRICTED | Catálogo | Crea tu publicación en [Catálogo](https://developers.mercadolibre.com.ar/es_ar/publicacion-en-catalogo), categoría exclusiva de catálogo. |
| OPT_OUT_REPRODUCTIZAR | Catálogo | Necesitas volver a publicar en [Catálogo](https://developers.mercadolibre.com.ar/es_ar/publicacion-en-catalogo), Ítem pasó por el flujo de OPT OUT. |
| COMPATS | Compatibilidades | Ofrece [compatibilidad a productos de Autopartes](https://developers.mercadolibre.com.ar/es_ar/compatibilidades-entre-items-y-productos). |
| DUPLIS | Publicaciones duplicadas | Evitamos [publicaciones repetidas](https://www.mercadolibre.com.ar/ayuda/2517) e invitamos a los vendedores a modificarlas utilizando [variantes](https://developers.mercadolibre.com.ar/es_ar/variaciones#Agregar-nuevas-variaciones) en los productos. Conoce los [beneficios de crear variaciones](https://vendedores.mercadolibre.com.ar/nota/aprende-a-cargar-variantes). |
| LINKS, DP | Datos de contacto | Evita incluir datos de contacto en las publicaciones. |
| BRAND_PROTECTION | Productos falsificados y uso indebido de marca | Conoce [cómo puedes publicar sin infringir propiedad intelectual](https://vendedores.mercadolibre.com.ar/nota/como-publicar-sin-infringir-propiedad-intelectual). |
| CLASI | moderaciones vehículos, inmuebles, servicios | Conoce [qué tener en cuenta para publicar vehículos](https://vendedores.mercadolibre.com.ar/nota/que-tener-en-cuenta-a-la-hora-de-publicar-vehiculos/) o [Inmuebles](https://vendedores.mercadolibre.com.ar/nota/que-tener-en-cuenta-para-publicar-tu-inmueble). |

- **reason** : texto (html) que describe el motivo y política que se infraccionó.

- **remedy** : texto (html) que indica la acción, sólo en los casos en que sea recuperable.

## Moderaciones para VIS

En la siguiente tabla se listan las posibles moderaciones que aplican para las diferentes unidades de negocio relacionadas con vehículos e inmuebles (VIS), así como los posibles accionables y algunas recomendaciones para corregir la moderación:

| BU | Tipo | Status | Reason | Remedy | Recomendaciones |
| --- | --- | --- | --- | --- | --- |
| **VIS-Motors** | Placa Duplicada | under_review, Substatus: waiting_for_patch | Pausamos tu publicación porque tenía una placa igual a otro vehículo. | Modifícala y agrega el dato correcto para reactivarla. | Dar accionable al vendedor para que pueda revisar sus ítems y corregir el campo placa. |
| **VIS-Motors** | Placa inválida | under_review, Substatus: waiting_for_patch | Pausamos tu publicación porque la placa es incorrecta y no coincide con la marca, modelo y año del vehículo. | Agrega el dato correcto para reactivarla. | Dar accionable al vendedor para que pueda revisar sus ítems y corregir el campo placa. |

**Siguiente** : [Moderaciones con pausado](https://developers.mercadolibre.com.ar/es_ar/moderaciones-con-pausado).
