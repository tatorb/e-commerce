<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios -->
<!-- Sección: Guía para productos > Precios y Costos -->

# Automatizaciones de precios

Última actualización 01/10/2026

## Gestionar automatizaciones

Las automatizaciones de precios en MercadoLibre son herramientas fundamentales para los vendedores que desean mantener sus productos competitivos y maximizar sus márgenes de ganancia. Estas herramientas permiten ajustar los precios de los productos de manera dinámica y estratégica en respuesta a modificaciones en la competencia. A continuación, se detallan las funcionalidades disponibles para gestionar automatizaciones.

**Importante:**

Antes de enviar una actualización de precio para un item via **/items/$ITEM_ID** , verifica si la publicación **tiene la automatización de precios activa** , ya que las actualizaciones de precio para ítems automatizados vía API pasarán a ser **rechazadas** .

A partir del **18 de marzo de 2026** , los ítems con Automatización de Precios activa **tendrán la edición de precio bloqueada**  vía API. Esta alteración busca proteger las estrategias de precios de los vendedores, evitando desactivaciones involuntarias y garantizando mayor estabilidad, alineando el comportamiento de la API con lo que ya se practica en el front-end.

### Qué cambia?

Las peticiones **PUT**  al recurso **/items/$ITEM_ID**  que contengan actualizaciones de precio para ítems automatizados serán rechazadas.El comportamiento variará según el contenido del payload:

1. Si el intento de actualización contiene **únicamente el campo price** :

- **Status Code:**  400 Bad Request.

- **Resultado:**  La solicitud será rechazada integramente.

- **Respuesta:**  Indicará un error de validación, informando que el precio no puede editarse debido a la automatización activa.

Ejemplo del error:

```
{
  "message": "Cannot modify price on items with dynamic pricing",
  "error": "item.price.not_modifiable",
  "status": 400,
  "cause": []
}
```

2. Si el intento de actualización de **precio se envía junto con otros atributos** :

- **Status Code:**  200 OK.

- **Resultado:**  Los demás atributos se actualizarán con éxito.

- **Comportamiento del Precio:**  El campo **price**  será ignorado y el valor original permanecerá sin cambios.

- **Respuesta:**  Contendrá un objeto de **warnings**  detallando que el precio no fue modificado debido a la automatización activa.

Ejemplo del warning:

```
"warnings": [
  {
    "department": "items",
    "cause_id": 502,
    "code": "item.price.not_modifiable",
    "message": "Cannot modify price on items with dynamic pricing",
    "references": [
      "item.price"
    ]
  }
]
```

### Identificación Previa

Para evitar fallas en el flujo de actualización, es fundamental realizar la identificación previa de los ítems que poseen la automatización activa a través del endpoint [**Obtener automatización de precios de ítems por vendedor**](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#:~:text=access%20token%22%0A%7D-,Obtener%20automatizaci%C3%B3n%20de%20precios%20de%20%C3%ADtems%20por%20vendedor,-Este%20recurso%20devuelve).

## Obtener reglas disponibles para un ítem

Para un ítem específico, se puede obtener el listado de reglas disponibles que pueden ser utilizadas para una automatización de precios, es necesario realizar un GET al recurso **/pricing-automation/items/$ITEM_ID/rules** .

### Reglas

| rule_id | Título | Descripción |
| --- | --- | --- |
| “INT_EXT” | Mejor precio dentro y fuera de Mercado Libre | Tu precio se ajustará al precio más bajo entre publicaciones similares de Mercado Libre y otras fuera del sitio. |
| “INT” | Precio para ganar en Mercado Libre | Tu precio se ajustará al precio más bajo entre publicaciones similares de Mercado Libre. |

### Pre condiciones para obtener las reglas disponibles para un ítem

- Debe consultarse sobre un ítem existente

- El ítem debe poder automatizarse

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/pricing-automation/items/$ITEM_ID/rules
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/pricing-automation/items/MLA12345678/rules
```

**Respuesta:**

```
{
    "item_id": "MLA123456",
    "rules": [
        {
            "rule_id": "INT_EXT"
        },
        {
            "rule_id": "INT"
        }
    ]
}
```

### Campos de la respuesta

La respuesta de un GET al recurso **/pricing-automation/items/$ITEM_ID/rules**  proporcionará los siguientes parámetros:

- **item_id** : Identificador del ítem

- **rules** : Lista de reglas disponibles para un ítem. Actualmente solo puede ser **INT_EXT**  y **INT**   **rule_id** : Regla de automatización.

### Posibles errores al obtener las reglas disponibles

Al obtener las reglas disponibles para un ítem, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

**Ítem no encontrado:**

```
{
    "error": "item_not_found",
      "message" : "Item with id [MLA123456] not found",
    "status": 404,
      "cause": []
}
```

**Usuario no autorizado:**

```
{
    "error": "user_not_authorized",
    "message": "User is not allowed to automate items",
    "status": 412,
    "cause": []
}
```

**No es posible automatizar el item:**

```
{          
    "error": "item_not_automatizable",
    "message" : "Item with id [MLA123456] has no rules available",
    "status": 412,
    "cause": []
}
```

**No se puede procesar la estrategia establecida:**

```
{           
    "error": "unprocessable_get_strategies",
    "message" : "Error calling retrieve item strategies service",
    "status": 422,
    "cause": []
}
```

**No autorizado:**

```
{
    "code": "unauthorized",
    "message": "invalid access token"
}
```

## Obtener automatización de precios de ítems por vendedor

Este recurso devuelve una lista paginada de todos los ítems automatizados asociados a un determinado vendedor, eliminando la necesidad de verificar ítem por ítem y mejorando la gestión e integración para sellers con alto volumen de publicaciones.

### Parámetros

| Parámetro | Descripción | Valores |
| --- | --- | --- |
| **offset** | Posición inicial de la consulta (opcional). | Predeterminado: **0** , Mínimo: **0** |
| **limit** | Cantidad máxima de ítems devueltos (opcional). | Predeterminado: **50** , Máximo: **100** |

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/users/$USER_ID/items
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/users/1167132037/items
```

**Respuesta:**

```
{
    "items": [
        "MLB4605019098",
        "MLB4211305575"
    ],
    "paging": {
        "total": 2,
        "offset": 0,
        "limit": 50
    }
}
```

Nota:

Este endpoint devuelve un máximo de 100 ítems por solicitud. Si el vendedor posee más ítems automatizados, es necesario realizar llamadas adicionales **incrementando el valor del parámetro offset**  para obtener los demás resultados. Utilice el campo paging.total de la respuesta para identificar el número total de ítems automatizados y determinar cuántas llamadas son necesarias.

Ejemplo de paginación: // Segunda llamada (ítems 101 a 200) 
 GET /pricing-automation/users/$USER_ID/items?offset=100&limit=100

### Campos de la Respuesta

La respuesta del GET al recurso **/pricing-automation/users/$USER_ID/items**  proporcionará los siguientes parámetros:

- **items** : Lista de IDs de ítems que el usuario tiene automatizados.

- **paging** : Objeto que contiene la información de paginación del resultado.  **total** : Total de ítems automatizados disponibles para el usuario. **offset** : Posición a partir de la cual se devolvió la lista. **limit** : Cantidad máxima de ítems devueltos en la respuesta.

## Asignar nueva automatización de precios

Para asignar una nueva automatización de precios, es necesario realizar un POST al recurso **/pricing-automation/items/$ITEM_ID/automation**

**Importante:**

**Automatizaciones en Publicaciones:** 
 Al aplicar automatizaciones a tus publicaciones, **incrementas**  la probabilidad de que se destaquen. Por ejemplo, podrán recibir la etiqueta “Recomendado” en los resultados de búsqueda y la distinción VIP. Si tus precios **bajan mediante un ajuste automático** , tus compradores verán tus precios **con descuento** , aumentando tus posibilidades de vender.

**Migración a UP:** 
 Si una publicación automatizada se migra a [UP](https://developers.mercadolibre.com.ar/es_ar/precio-variacion), los ítems correspondientes heredarán automáticamente la configuración de automatización.

**Opt-In a Catálogo:** 
 De igual forma, si se aplica una automatización a un ítem tradicional y posteriormente se realiza el opt-in a catálogo, la configuración de automatización se transferirá al ítem de catálogo.

### Pre condiciones para asignar una automatización

- Se debe aplicar la regla a un ítem existente

- Debe tener sí o sí un precio mínimo

- Los precios no pueden ser absurdos (Maximo y Minimo)

- Debe cumplir las [condiciones](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#Obtener-reglas-disponibles-para-un-item) de Creación

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{
    "rule_id" : "INT_EXT", 
    "min_price": 100000,
    "max_price": 1000000
}
https://api.mercadolibre.com/pricing-automation/items/$ITEM_ID/automation
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{
    "rule_id" : "INT_EXT", 
    "min_price": 100000,
    "max_price": 1000000
}
https://api.mercadolibre.com/pricing-automation/items/MLA12345678/automation
```

**Respuesta:**

```
{
    "item_id": "MLA123456",
    "status": "ACTIVE",
    "item_rule": {
        "rule_id": "INT_EXT",
    },
    "min_price": 100000,
    "max_price": 1000000
}
```

### Campos de la respuesta

La respuesta de un POST al recurso **/pricing-automation/items/$ITEM_ID/automation**  proporcionará los siguientes parámetros

- **item_id** : Identificador del ítem

- **status** : Estado de la automatización, posibles status:  ACTIVE PAUSED

- **item_rule** : Regla de automatización, actualmente las únicas reglas disponibles son:

- **rule_id** : Regla de automatización.

- **“INT_EXT”**  (Competencia interna y externa en simultáneo). **“INT”**  (Competencia interna únicamente, en caso de ser de catálogo solo se tomarán en cuenta ese tipo de publicaciones).  **title:**  Nombre de la regla seleccionada. La única disponible es “Precio para ganar ventas”  **description:**  Descripción de la regla seleccionada.  **min_price** : Precio mínimo seteado a la automatización. **max_price** : Precio máximo seteado a la automatización.

- 

- Posibles errores al asignar una automatización

- Al asignar una nueva automatización, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

- 

- **Campo rule_id sin valor:**

- `{ "error": "argument_not_valid", "message": "rule_id must not be null", "status": 400, "cause": [ { "code": "rule_id_not_null", "message": "Rule identifier is required" } ] }`

- **Ítem no encontrado:**

- `{ "error": "item_not_found", "message" : "Item with id [MLA123456] not found", "status": 404 }`

- **Usuário no autorizado:**

- `{ "error": "user_not_authorized", "message": "User is not allowed to automate items", "status": 412 }`

- **Automatización ya creada:**

- `{ "error": "automation_already_created", "message" : "Automation already created", "status": 412 }`

- **Automatización no permitida:**

- `{ "error": "automation_operation_not_allowed", "message" : "Cannot perform [assign automation] for item with id [MLA123456]", "status": 412 }`

- **No se puede procesar la regla establecida:**

- `{ "error": "unprocessable_set_rule", "message" : "Error calling rule assignment service", "status": 422 }`

- **No autorizado**

- `{ "code": "unauthorized", "message": "invalid access token" }`

- **Error por valor de precio inusual**

- `{ "message": "unusual value for your listing, unusual value for your listing", "error": "bad_request", "status": 400, "cause": [] }`

- Este error ocurre cuando uno o ambos valores enviados en min_price o max_price son considerados anómalamente bajos por la validación de precios. La validación compara cada valor con referencias recientes del mismo ítem, considerando ventas y precios históricos de los últimos 60 días o, cuando no existe historial suficiente, el precio standard.

- 

- Obtener automatización de precios existente por ítem

- Para obtener una automatización de un ítem, es necesario consultar el recurso **/pricing-automation/items/$ITEM_ID/automation**

- 

- Pre condiciones para obtener una automatización

- Debe corresponder a un ítem existente Debe ser una automatización ya asignada Debe cumplir las [condiciones](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#Obtener-reglas-disponibles-para-un-item) de Obtención

- **Llamada:**

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/items/$ITEM_ID/automation`

- **Ejemplo:**

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/items/MLA12345678/automation`

- **Respuesta:**

- `{ "item_id": "MLA123456", "status": "ACTIVE | PAUSED" "item_rule": { "rule_id": "INT_EXT", }, "min_price": 100000, "max_price": 1000000, "status_detail": { "cause": "ITEM_NO_ACTIVE| PROMO|COMPETITORS", "message": "Item paused message" } }`

- Nota:   Cuando un ítem tradicional está sincronizado con un ítem de catálogo, la automatización de precios se **centraliza exclusivamente en el ítem de catálogo** . En este caso, el ítem tradicional no posee automatización propia. Al consultar este endpoint pasando el ITEM_ID de un ítem tradicional sincronizado, la API identificará el ítem de catálogo vinculado y **devolverá los datos de automatización del ítem de catálogo, no del ítem tradicional consultado** .

- Campos de la respuesta

- La respuesta de un GET al recurso **pricing-automation/items/$ITEM_ID/automation**  proporcionará los siguientes parámetros:

- **item_id** : Identificador del ítem **status** : Estado de la automatización, posibles status:  ACTIVE PAUSED   **item_rule** :  **rule_id** : Regla de automatización.   **min_price** : Precio mínimo seteado a la automatización. **max_price** : Precio máximo seteado a la automatización. **status_detail** : Estado de la automatización pausado por alguna de estas causas:  COMPETITORS PROMO ITEM_NO_ACTIVE   **cause** : causa de la automatización pausada **message** : mensaje detallando cuál de las causas pausó la automatización

- 

- Nota:   Cuando un ítem configurado con automatización entra en una **promoción** , la automatización se **pausa** .

- Posibles errores al obtener una automatización

- Al consultar una automatización, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

- 

- **Ítem no encontrado:**

- `{ "error": "item_not_found", "message" :"Item with id [MLA123456] not found", "status": 404, "cause": [] }`

- **Automatización no encontrada:**

- `{ "error": "automation_not_found", "message" : "Automation not found for item with id [MLA123456]", "status": 404, "cause": [] }`

- **Usuário no autorizado:**

- `{ "error": "user_not_authorized", "message": "User is not allowed to automate items", "status": 412, "cause": [] }`

- **Automatización no permitida:**

- `{ "error": "automation_operation_not_allowed", "message" : "Cannot perform [get automation] for item with id [MLA123456]", "status": 412, "cause": [] }`

- **No se puede procesar la regla establecida:**

- `{ "error": "unprocessable_get_rule", "message" : "Error calling rule assignment service", "status": 422 }`

- **No autorizado:**

- `{ "code": "unauthorized", "message": "invalid access token" }`

- Actualizar una automatización de precios

- Para actualizar una regla de automatización de un ítem que se encuentra asignada, es necesario realizar un PUT al recurso **/pricing-automation/items/$ITEM_ID/automation** .

- 

- Pre condiciones para actualizar una automatización

- Se debe aplicar la regla a un ítem existente. Es obligatorio que tenga un precio mínimo. Los precios no pueden ser absurdos (Máximo y Mínimo). Debe cumplir las [condiciones](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#Obtener-reglas-disponibles-para-un-item) de Modificación.

- **Llamada:**

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' { "rule_id" : "INT_EXT", "min_price": 100000, "max_price": 1000000 } https://api.mercadolibre.com/pricing-automation/items/$ITEM_ID/automation`

- **Ejemplo:**

- `curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' { "rule_id" : "INT_EXT", "min_price": 100000, "max_price": 1000000 } https://api.mercadolibre.com/pricing-automation/items/MLA12345678/automation`

- **Respuesta:**

- `{ "item_id": "MLA123456", "status": "ACTIVE", "item_rule": { "rule_id": "INT_EXT", }, "min_price": 100000, "max_price": 1000000 }`

- Campos de la respuesta

- La respuesta de un PUT al recurso **/pricing-automation/items/$ITEM_ID/automation**  proporcionará los siguientes parámetros:

- **item_id** : Identificador del ítem **status** : Estado de la automatización, posibles status:  ACTIVE PAUSED   **item_rule** :  **rule_id** : Regla de automatización.   **min_price** : Precio mínimo seteado a la automatización. **max_price** : Precio máximo seteado a la automatización.

- 

- Posibles errores al actualizar una automatización

- Al actualizar una automatización, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

- 

- **Campo rule_id sin valor:**

- `{ "error": "argument_not_valid", "message": "rule_id must not be null", "status": 400, "cause": [ { "code": "rule_id_not_null", "message": "Rule identifier is required" } ] }`

- **Ítem no encontrado:**

- `{ "error": "item_not_found", "message" : "Item with id [MLA123456] not found", "status": 404, "cause": [] }`

- **Usuário no autorizado:**

- `{ "error": "user_not_authorized", "message": "User is not allowed to automate items", "status": 412, "cause": [] }`

- **Automatización no permitida:**

- `{ "error": "automation_operation_not_allowed", "message" : "Cannot perform [assign automation] for item with id [MLA123456]", "status": 412, "cause": [] }`

- **No se puede procesar la regla establecida:**

- `{ "error": "unprocessable_set_rule", "message" : "Error calling rule retrieve service", "status": 422, "cause": [] }`

- **No autorizado:**

- `{ "code": "unauthorized", "message": "invalid access token" }`

- **Error por valor de precio inusual**

- `{ "message": "unusual value for your listing, unusual value for your listing", "error": "bad_request", "status": 400, "cause": [] }`

- Este error ocurre cuando uno o ambos valores enviados en min_price o max_price son considerados anómalamente bajos por la validación de precios. La validación compara cada valor con referencias recientes del mismo ítem, considerando ventas y precios históricos de los últimos 60 días o, cuando no existe historial suficiente, el precio standard.

- 

- Eliminar una automatización de precios

- Para eliminar una regla de automatización de un ítem que se encuentra asignada, es necesario realizar un DELETE al recurso **/pricing-automation/items/$ITEM_ID/automation**

- 

- Pre condiciones para eliminar una automatización

- Se debe eliminar la regla a un ítem existente Se debe eliminar una regla existente

- **Llamada:**

- `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/items/$ITEM_ID/automation`

- **Ejemplo:**

- `curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/items/MLA12345678/automation`

- 

- La respuesta exitosa será solo un "200 - OK" con un retorno vacío.

- `{}`

- 

- 

- Posibles errores al eliminar una automatización

- Al eliminar una automatización, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

- 

- **Ítem no encontrado:**

- `{ "error": "item_not_found", "message" : "Item with id [MLA123456] not found", "status": 404, "cause": [] }`

- **Automatización no encontrada:**

- `{ "error": "automation_not_found", "message" : "Automation not found for item with id [MLA123456]", "status": 404, "cause": [] }`

- **Usuário no autorizado:**

- `{ "error": "user_not_authorized", "message": "User is not allowed to automate items", "status": 412, "cause": [] }`

- **Automatización no permitida:**

- `{ "error": "automation_operation_not_allowed", "message" : "Cannot perform [delete automation] for item with id [MLA123456]", "status": 412, "cause": [] }`

- **No se puede procesar la regla establecida:**

- `{ "error": "unprocessable_delete_rule", "message" : "Error calling rule retrieve service", "status": 422, "cause": [] }`

- **No autorizado:**

- `{ "code": "unauthorized", "message": "invalid access token" }`

- Obtener histórico de precios para un ítem automatizado

- Para un ítem específico, se puede obtener el histórico de las modificaciones de precios generado por las automatizaciones aplicadas, es necesario realizar un GET al recurso **/pricing-automation/items/$ITEM_ID/price/history**.****

- 

- Pre condiciones para obtener el historial de precios para un ítem

- Debe consultarse sobre un ítem existente

- **Parámetros:**

- Query params Obligatoriedad Detalle value     days Opcional por defecto es 30   page Opcional por defecto es 0   size Opcional por defecto es 10

- **Llamada:**

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/items/$ITEM_ID/price/history`

- **Ejemplo:**

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/items/MLA12345678/price/history`

- **Respuesta:**

- `{ "result_code": 200, "result": { "content": [ { "date_time": "2024-07-12T15:26:15Z", "percent_change": 0, "usd_price": 0, "deal_id": "68719c01-0566-4728-adef-2701750be2d0", "price": 120, "event": "CurrentStrategyConfirmed", "strategy_type": "automation_min_price" } ], "pageable": { "offset": 0, "page_number": 0, "page_size": 1 }, "total_elements": 9, "total_pages": 9, "size": 1, "number_of_elements": 1, "empty": false }, "result_message": "OK" }`

- Campos de la respuesta

- La respuesta de un GET al recurso **/pricing-automation/items/$ITEM_ID/price/history**  proporcionará los siguientes parámetros:

- **result_code** : Código HTTP de respuesta a la request recibida. **result** : Contiene el contenido de la respuesta y la información de paginación.  **content** : Lista de objetos que contienen los detalles del histórico de precios.  **date_time** : Fecha que indica la fecha y hora en la que se registró el cambio de precio. **percent_change** : Variación porcentual del precio respecto al valor anterior. **usd_price** : Precio en USD del ítem. Puede ser 0 si no está disponible. **deal_id** : Identificador único asociado a la transacción o evento de precio. **price** : Precio del ítem en la moneda local en el momento del evento. **event** : Nombre del evento que provocó el cambio de precio. **strategy_type** : Tipo de estrategia utilizada para el ajuste del precio.   **pageable** : Información sobre la paginación de los resultados.  **offset** : Desplazamiento desde el inicio de la lista de resultados. **page_number** : Número de la página actual en la paginación. **page_size** : Número máximo de elementos por página.   **total_elements** : Número total de elementos disponibles en la respuesta. **total_pages** : Número total de páginas disponibles según el tamaño de la página. **size** : Número de elementos presentes en la página actual. **number_of_elements** : Número de elementos en la página actual. **empty** : Indicador de si la respuesta contiene o no datos.   **result_message** : Mensaje que proporciona una descripción del estado de la solicitud.

- 

- Historial para ítem sin automatización aplicada

- En caso de que el ítem consultado no tenga ninguna automatización de precio aplicada, la API retornará result_code: 200 con la lista content vacía y el campo **empty: true** , indicando que no hay registros de cambios generados por automatización para ese ítem.

- 

- Respuesta esperada:

- `{ "result_code": 200, "result": { "content": [], "pageable": { "offset": 0, "page_number": 0, "page_size": 10 }, "total_elements": 0, "total_pages": 0, "size": 10, "number_of_elements": 0, "empty": true }, "result_message": "OK" }`

- Posibles errores al obtener el historial de precio de un ítem

- Al obtener el historial de cambio de precios para un ítem, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

- 

- **No autorizado:**

- `{ "code": "unauthorized", "message": "invalid access token" }`

- **El item no pertenece al seller:**

- `{ "message": "User is not item owner", "error": "user_not_authorized", "status": 412, "cause": [] }`

- **Error al recuperar artículos del historial de precios**

- `{ "message": "Error calling retrieve price history item service", "error": "unprocessable_get_price_history", "status": 422, "cause": [] }`

## Asignar nueva automatización de precios por producto de catálogo

Asignar una nueva regla de automatización a un ítem de catálogo con los datos del producto asociado a él. Para la asignación de la regla, es necesario que exista un precio mínimo establecido, que el ítem sea de catálogo y que posea oportunidades.

### Precondiciones para asignar una automatización

- La regla debe aplicarse a un ítem existente

- Debe tener un precio mínimo obligatorio

- Los precios no pueden ser absurdos (Máximo y Mínimo)

- El usuario debe tener buena reputación (Amarilla, Verde claro o Verde).

- El ítem debe ser de catálogo.

- El producto asociado debe tener oportunidades.

- El ítem debe ser nuevo.

- Debe cumplir las condiciones de Creación

Importante:

- Cuando un **ítem tradicional está sincronizado a un ítem de catálogo** , la automatización solo puede aplicarse **a partir del ítem de catálogo** . En ese caso, los precios del ítem tradicional se **sincronizarán automáticamente** , reflejando los cambios realizados en el ítem de catálogo.

- No está permitido crear la automatización directamente en el ítem tradicional si ya está vinculado a un ítem de catálogo.

Si un **ítem tradicional no está sincronizado a un ítem de catálogo y está automatizado** , y posteriormente ese ítem se vincula a un ítem de catálogo, la **automatización se transferirá automáticamente**  al ítem de catálogo.

Si la automatización se **elimina del ítem de catálogo** , también se **eliminará del ítem tradicional**  correspondiente.

No significa que ambos (tradicional y catálogo) queden automatizados de forma independiente. La automatización se centraliza en solo uno de ellos, pero, debido al comportamiento estándar de sincronización, siempre que el precio se actualice en uno, el valor se reflejará en el otro.

### Parámetros

| Parámetros de consulta | Obligatoriedad | Detalle del valor |
| --- | --- | --- |
| Item_id | Obligatorio | identificador de publicación |
| catalog_product_id | Obligatorio | identificador del producto de catálogo |

Llamada:

```

curl -X POST 
'https://api.mercadolibre.com/pricing-automation/items/$ITEM_ID/automation/by-product/$CATALOG_PRODUCT_ID' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "rule_id" : "INT",
  "min_price": 1890,
  "max_price": 2000
}'
```

Ejemplo:

```

curl -X POST 
'https://api.mercadolibre.com/pricing-automation/items/MLB4211305575/automation/by-product/MLB38607446' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
  "rule_id" : "INT",
  "min_price": 1890,
  "max_price": 2000
}'
```

Respuesta:

```
{
  "item_id": "MLB4211305575",
  "status": "ACTIVE",
  "item_rule": {
    "rule_id": "INT"
  },
  "min_price": 1890,
  "max_price": 2000
}
```

### Campos de la respuesta

- **item_id** : Identificador del ítem

- **status** : Estado de la automatización, posibles estados:  ACTIVE PAUSED

- **item_rule** : Regla de automatización. Las reglas disponibles son:  **rule_id** : Regla de automatización. **"INT_EXT"**  (Competencia interna y externa simultáneamente) **"INT"**  (Solo competencia interna; en el caso de catálogo, se considerarán solo este tipo de publicaciones)

- **min_price** : Precio mínimo asignado a la automatización.

- **max_price** : Precio máximo asignado a la automatización.

### Posibles errores al asignar una automatización

Al asignar una nueva automatización, es posible que encuentres los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para gestionar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

#### Automatización ya creada:

```
{
  "message": "Automation already created",
  "error": "automation_already_created",
  "status": 412,
  "cause": []
}
```

#### El ítem no es de catálogo:

```
{
  "message": "The item [MLB363980000] isn't from catalog",
  "error": "item_not_catalog",
  "status": 412,
  "cause": []
}
```

#### Automatización no permitida:

```
{
  "message": "Cannot perform [assign automation] for item with id [MLB5742509500]",
  "error": "automation_operation_not_allowed",
  "status": 412,
  "cause": []
}
```

#### Valor del campo rule_id incorrecto:

```
{
  "message": "rule identifier is not valid",
  "error": "argument_not_valid",
  "status": 400,
  "cause": [
    {
      "code": "rule_id_not_valid",
      "message": "Rule identifier is not valid"
    }
  ]
}
```

#### ITEM_ID no encontrado:

```
{
  "message": "Item with id [MLB416190419] not found",
  "error": "item_not_found",
  "status": 404,
  "cause": []
}
```

#### CATALOG_PRODUCT_ID inválido:

```
{
  "message": "Product with id [MLB192960] not found",
  "error": "product_not_found",
  "status": 404,
  "cause": []
}
```

#### El ítem no es nuevo:

```
{
  "message": "Item id [MLB416190331] doesn't have a condition: new.",
  "error": "item_not_new",
  "status": 412,
  "cause": []
}
```

#### No autorizado:

```
{
  "code": "unauthorized",
  "message": "invalid access token"
}
```

**Error por valor de precio inusual**

```
{
  "message": "unusual value for your listing, unusual value for your listing",
  "error": "bad_request",
  "status": 400,
  "cause": []
}
```

Este error ocurre cuando uno o ambos valores enviados en min_price o max_price son considerados anómalamente bajos por la validación de precios. La validación compara cada valor con referencias recientes del mismo ítem, considerando ventas y precios históricos de los últimos 60 días o, cuando no existe historial suficiente, el precio standard.

## Obtener reglas disponibles para producto de catálogo

Para un producto específico, es posible obtener la lista de reglas disponibles que pueden utilizarse para una automatización de precios.

### Precondiciones para obtener las reglas disponibles para un ítem

- Debe consultarse sobre un producto existente.

- El usuario debe tener buena reputación (Amarilla, Verde claro, Verde).

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/products/$CATALOG_PRODUCT_ID/rules
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/pricing-automation/products/MLA123456/rules
```

Respuesta:

```
{
  "product_id": "MLA123456",
  "rules": [
    { "rule_id": "INT_EXT" },
    { "rule_id": "INT" }
  ]
}
```

### Campos de la respuesta

La respuesta de un **GET**  para el recurso **pricing-automation/products/$CATALOG_PRODUCT_ID/rules**  proporcionará los siguientes parámetros:

- **catalog_product_id** : Identificador del producto de catálogo

- **rules** : Lista de reglas disponibles para un ítem. Actualmente solo puede ser **INT_EXT**  e **INT** .

- **rule_id** : Regla de automatización.

### Posibles errores al obtener las reglas disponibles

Al obtener las reglas disponibles para un producto, es posible que encuentres los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para gestionar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

#### $CATALOG_PRODUCT_ID no encontrado:

```
{
  "message": "Product with id [MLA123456] not found",
  "error": "product_not_found",
  "status": 404,
  "cause": []
}
```

#### No autorizado:

```
{
  "code": "unauthorized",
  "message": "invalid access token"
}
```

Nota:

- Para consultar la automatización de un ítem de catálogo, consulta **[Obtener automatización de precios existente](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#Obtener-automatizaci%C3%B3n-de-precios-existente:~:text=access%20token%22%0A%7D-,Obtener%20automatizaci%C3%B3n%20de%20precios%20existente,-Para%20obtener%20una)** .

- Para actualizar una regla de automatización de un ítem de catálogo, consulta **[Actualizar una automatización de precios](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#Actualizar-una-automatizaci%C3%B3n-de-precios:~:text=access%20token%22%0A%7D-,Actualizar%20una%20automatizaci%C3%B3n%20de%20precios,-Para%20actualizar%20una)** .

- Para eliminar una regla de automatización de un ítem de catálogo, consulta **[Eliminar una automatización de precios](https://developers.mercadolibre.com.ar/es_ar/automatizaciones-de-precios#Eliminar-una-automatizaci%C3%B3n-de-precios:~:text=access%20token%22%0A%7D-,Eliminar%20una%20automatizaci%C3%B3n%20de%20precios,-Para%20eliminar%20una)** .

**En todos los casos, recuerda utilizar el parámetro `$ITEM_ID` del ítem de catálogo.**

## Identificar publicaciones con automatización de precios

En el recurso /items es posible identificar si la publicación tiene automatización de precios configurada, a través del tag**"dynamic_standard_price"** .

Llamada:

```
curl --location --request GET
'https://api.mercadolibre.com/items/$ITEM_ID' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo:

```
curl --location --request GET
'https://api.mercadolibre.com/items/MLB6713483676' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```

{
    "id": "MLB6713483676",
    "site_id": "MLB",
    "title": "Michelin Ii Primacy Test Pxq B2c - Auto",
    "family_name": null,
    "seller_id": 3347552577,
    "category_id": "MLB2233",
    "user_product_id": null,
    "official_store_id": null,
    "price": 50000.0,
    "base_price": 50000.0,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 5,
    "available_quantity": 5,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WARRANTY_TYPE",
            "name": "Tipo de garantia",
            "value_id": "6150835",
            "value_name": "Sem garantia",
            "value_struct": null,
            "values": [
                {
                    "id": "6150835",
                    "name": "Sem garantia",
                    "struct": null
                }
            ],
            "value_type": "list"
        }
    ],
    "buying_mode": "buy_it_now",
    "listing_type_id": "gold_special",
    "start_time": "2026-05-04T20:33:43.861Z",
    "stop_time": "2046-04-29T04:00:00.000Z",
    "end_time": "2046-04-29T04:00:00.000Z",
    "expiration_time": "2026-07-23T20:33:43.926Z",
    "condition": "new",
    "permalink": "https://produto.mercadolivre.com.br/MLB-6713483676-michelin-ii-primacy-test-pxq-b2c-auto-_JM",
    "thumbnail_id": "800206-MLB95151503674_102025",
    "thumbnail": "http://http2.mlstatic.com/D_800206-MLB95151503674_102025-I.webp",
    "pictures": [
        {
            "id": "800206-MLB95151503674_102025",
            "url": "http://http2.mlstatic.com/D_800206-MLB95151503674_102025-O.webp",
            "secure_url": "https://http2.mlstatic.com/D_800206-MLB95151503674_102025-O.webp",
            "size": "358x500",
            "max_size": "859x1199",
            "quality": ""
        }
    ],
    "video_id": null,
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "me2",
        "methods": [],
        "tags": [
            "mandatory_free_shipping"
        ],
        "dimensions": null,
        "local_pick_up": false,
        "free_shipping": true,
        "logistic_type": "drop_off",
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "address_line": "daw da SN",
        "zip_code": "14010030",
        "city": {
            "id": "BR-SP-23",
            "name": "Ribeirão Preto"
        },
        "state": {
            "id": "BR-SP",
            "name": "São Paulo"
        },
        "country": {
            "id": "BR",
            "name": "Brasil"
        },
        "search_location": {
            "neighborhood": {
                "id": "TVhYQ2VudHJvVFZoWVVtbGlaV2x5dzZOdklGQ0",
                "name": "Centro"
            },
            "city": {
                "id": "TVhYUmliZWlyw6NvIFByZXRvVFV4Q1VGTkJUM",
                "name": "Ribeirão Preto"
            },
            "state": {
                "id": "TUxCUFNBT085N2E4",
                "name": "São Paulo"
            }
        },
        "latitude": -21.1817961,
        "longitude": -47.8002979,
        "id": 1610141194
    },
    "seller_contact": null,
    "location": {},
    "geolocation": {
        "latitude": -21.1817961,
        "longitude": -47.8002979
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "AUTOMOTIVE_TIRE_ASPECT_RATIO",
            "name": "Relação de aspecto",
            "value_id": "5913921",
            "value_name": "55",
            "values": [
                {
                    "id": "5913921",
                    "name": "55",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "76166",
            "value_name": "Michelin",
            "values": [
                {
                    "id": "76166",
                    "name": "Michelin",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "EXTERNAL_NOISE_REDUCTION_EFFICIENCY",
            "name": "Eficiência de redução de ruído externo",
            "value_id": "11308238",
            "value_name": "A",
            "values": [
                {
                    "id": "11308238",
                    "name": "A",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "EXTERNAL_NOISE_REDUCTION_LEVEL",
            "name": "Nivel de redução de ruído externo",
            "value_id": "11363510",
            "value_name": "68 dBA",
            "values": [
                {
                    "id": "11363510",
                    "name": "68 dBA",
                    "struct": {
                        "number": 68,
                        "unit": "dBA"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_SAVING_EFFICIENCY",
            "name": "Eficiência de poupança de combustível",
            "value_id": "11300936",
            "value_name": "C",
            "values": [
                {
                    "id": "11300936",
                    "name": "C",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "IS_DIRECTIONAL",
            "name": "É direcional",
            "value_id": "242084",
            "value_name": "Não",
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "IS_RUN_FLAT",
            "name": "É run flat",
            "value_id": "242084",
            "value_name": "Não",
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condição do item",
            "value_id": "2230284",
            "value_name": "Novo",
            "values": [
                {
                    "id": "2230284",
                    "name": "Novo",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "LINE",
            "name": "Linha",
            "value_id": "5914488",
            "value_name": "Primacy",
            "values": [
                {
                    "id": "5914488",
                    "name": "Primacy",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "LOAD_INDEX",
            "name": "Índice de carga",
            "value_id": "75319",
            "value_name": "94",
            "values": [
                {
                    "id": "75319",
                    "name": "94",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MANUFACTURER_TIRE_SIZE",
            "name": "Tamanho",
            "value_id": "36524054",
            "value_name": "295/55 R16",
            "values": [
                {
                    "id": "36524054",
                    "name": "295/55 R16",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "7741851",
            "value_name": "Primacy 4",
            "values": [
                {
                    "id": "7741851",
                    "name": "Primacy 4",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "OUTSIDE_DIAMETER",
            "name": "Diâmetro externo",
            "value_id": "7494998",
            "value_name": "631.9 mm",
            "values": [
                {
                    "id": "7494998",
                    "name": "631.9 mm",
                    "struct": {
                        "number": 631.9,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "RIM_DIAMETER",
            "name": "Diâmetro da roda",
            "value_id": null,
            "value_name": "17 \"",
            "values": [
                {
                    "id": null,
                    "name": "17 \"",
                    "struct": {
                        "number": 17,
                        "unit": "\""
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SECTION_WIDTH",
            "name": "Largura de secção",
            "value_id": null,
            "value_name": "205 mm",
            "values": [
                {
                    "id": null,
                    "name": "205 mm",
                    "struct": {
                        "number": 205,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_HEIGHT",
            "name": "Altura da embalagem do vendor",
            "value_id": null,
            "value_name": "66 cm",
            "values": [
                {
                    "id": null,
                    "name": "66 cm",
                    "struct": {
                        "number": 66,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_LENGTH",
            "name": "Comprimento da embalagem do vendor",
            "value_id": null,
            "value_name": "21 cm",
            "values": [
                {
                    "id": null,
                    "name": "21 cm",
                    "struct": {
                        "number": 21,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_WEIGHT",
            "name": "Peso da embalagem do vendor",
            "value_id": null,
            "value_name": "9219 g",
            "values": [
                {
                    "id": null,
                    "name": "9219 g",
                    "struct": {
                        "number": 9219,
                        "unit": "g"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_WIDTH",
            "name": "Largura da embalagem do vendor",
            "value_id": null,
            "value_name": "66 cm",
            "values": [
                {
                    "id": null,
                    "name": "66 cm",
                    "struct": {
                        "number": 66,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SERVICE_TYPE",
            "name": "Tipo de serviço",
            "value_id": "4369800",
            "value_name": "P",
            "values": [
                {
                    "id": "4369800",
                    "name": "P",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "SIDEWALL",
            "name": "Lateral",
            "value_id": "13384862",
            "value_name": "BSW",
            "values": [
                {
                    "id": "13384862",
                    "name": "BSW",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "TERRAIN_TYPE",
            "name": "Tipo de terreno",
            "value_id": "4369773",
            "value_name": "HT",
            "values": [
                {
                    "id": "4369773",
                    "name": "HT",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TIRES_NUMBER",
            "name": "Quantidade de pneus",
            "value_id": "2726554",
            "value_name": "1",
            "values": [
                {
                    "id": "2726554",
                    "name": "1",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "TIRE_ASPECT_RATIO",
            "name": "Relação de aspecto do pneu",
            "value_id": null,
            "value_name": "55 %",
            "values": [
                {
                    "id": null,
                    "name": "55 %",
                    "struct": {
                        "number": 55,
                        "unit": "%"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "TIRE_CONSTRUCTION_TYPE",
            "name": "Tipo de construção",
            "value_id": "79419",
            "value_name": "Radial",
            "values": [
                {
                    "id": "79419",
                    "name": "Radial",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "UNITS_PER_PACK",
            "name": "Unidades por kit",
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
            "id": "VEHICLE_TYPE",
            "name": "Tipo de veículo",
            "value_id": "11377043",
            "value_name": "Carro/Caminhonete",
            "values": [
                {
                    "id": "11377043",
                    "name": "Carro/Caminhonete",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "WET_GRIP_EFFICIENCY",
            "name": "Eficiência de aderência em molhado",
            "value_id": "11300941",
            "value_name": "A",
            "values": [
                {
                    "id": "11300941",
                    "name": "A",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "WITH_NOISE_REDUCTION",
            "name": "Com redução de ruído",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [
        {
            "id": 194124095262,
            "price": 50000.0,
            "attribute_combinations": [
                {
                    "id": "SPEED_INDEX",
                    "name": "Índice de velocidade",
                    "value_id": "362211",
                    "value_name": "A1",
                    "values": [
                        {
                            "id": "362211",
                            "name": "A1",
                            "struct": null
                        }
                    ],
                    "value_type": "list"
                }
            ],
            "available_quantity": 5,
            "sold_quantity": 0,
            "sale_terms": [],
            "picture_ids": [
                "800206-MLB95151503674_102025"
            ],
            "seller_custom_field": null,
            "catalog_product_id": null,
            "inventory_id": null,
            "item_relations": [],
            "user_product_id": "MLBU3946235076"
        }
    ],
    "status": "active",
    "sub_status": [],
    "tags": [
        "dynamic_standard_price",
        "good_quality_thumbnail",
        "catalog_listing_eligible",
        "test_item",
        "standard_price_by_quantity",
        "immediate_payment",
        "cart_eligible"
    ],
    "warranty": "Sem garantia",
    "catalog_product_id": "MLB35830119",
    "domain_id": "MLB-AUTOMOTIVE_TIRES",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2026-05-04T20:33:44.027Z",
    "last_updated": "2026-05-08T12:38:16.669Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

**Siguiente** : [Precios netos por cantidad](https://developers.mercadolibre.com.ar/es_ar/precios-netos)
