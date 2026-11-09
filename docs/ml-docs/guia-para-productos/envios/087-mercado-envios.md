<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/mercado-envios -->
<!-- Sección: Guía para productos > Envíos -->

# Gestión Mercado Envíos

Última actualización 23/04/2026

## Gestión Mercado Envíos

**Importante:**

Actualmente, esta modalidad de envío está disponible para vendedores de Argentina, Brasil, México, Chile, Colombia, Uruguay, Perú y Ecuador.

**Mercado Envíos**  es una red de servicios de Mercado Libre que proporciona soluciones logísticas para mejorar la experiencia de vendedores y compradores. Además de coordinar con diversos operadores de la industria, la red logística de Mercado Envíos incluye centros de almacenamiento y distribución propios, agencias, y una flota terrestre y aérea en constante crecimiento. Conoce más sobre [envíos para vendedores](https://envios.mercadolibre.com.ar/) y mira nuestro webinar para integrarte:

## Modalidades de Envíos

Mercado Envíos se divide en las siguientes modalidades:

- **Mercado Envíos 1 (ME1):**  es una modalidad de envío que permite a los vendedores vender a través de Mercado Libre, utilizando su propia logística o servicios de terceros.

- **Mercado Envíos 2 (ME2):**  es la modalidad de envío de Mercado Libre, donde se gestiona toda la logística utilizando diversos medios como correos, agencias, entre otros. Esta modalidad se divide a su vez en los siguiente tipos de logística:   [Mercado Envíos Drop_off](https://developers.mercadolibre.com.ar/mercadoenvios-modo-2)   [Mercado Envíos Colectas (cross_docking) y Places (xd_drop_off)](https://developers.mercadolibre.com.ar/envios-colectas-places)   [Mercado Envíos Flex (self_service)](https://developers.mercadolibre.com.ar/envios-flex)   [Mercado Envíos Turbo (turbo)](https://developers.mercadolibre.com.ar/envios-turbo)     [Mercado Envíos Full (fulfillment)](https://developers.mercadolibre.com.ar/envios-fulfillment)

- **Custom:**  es una modalidad de envío donde el vendedor carga una tabla con los precios de envío por cada región y se encarga de la logística.

- **Not Specified:**  es una modalidad de envío donde el vendedor no especifica ningún precio de envío para sus publicaciones y debe ponerse en contacto con el comprador para coordinar el envío.

## Preferencias de envío de un ítem

Para establecer las preferencias de envío de un ítem en Mercado Libre de manera adecuada, es crucial tener en cuenta los siguientes puntos:

La gestión de ítems en Mercado Libre, ya sea mediante publicación, edición o migración, está estrechamente vinculada a las preferencias de envío activas tanto del usuario como del ítem en cuestión. Estas preferencias determinan qué modalidades de envío están disponibles y deben ser revisadas cuidadosamente.

## Servicios de Envíos disponibles por país

Para establecer las preferencias de envío de un ítem en Mercado Libre de manera adecuada, es crucial tener en cuenta los siguientes puntos:

Llamada:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$SITE_ID/shipping_methods
```

Respuesta:

```
  
    {
      {
        "id": 73328,
        "name": "Normal a domicilio",
        "type": "standard",
        "deliver_to": "address",
        "status": "active",
        "site_id": "MLA",
        "free_options": [
          "country"
        ],
        "shipping_modes": [
          "me2"
        ],
        "company_id": 17500240,
        "company_name": "OCA",
        "min_time": 72,
        "max_time": null,
        "currency_id": "ARS"
      },
    ...
    }
  
```

**Parámetros de respuesta:**

- **id:**  es un identificador único para el tipo de envío.

- **name:**  nombre descriptivo del servicio de envío.

- **type:**  define el tipo de servicio de envío.

- **deliver_to:**  Especifica el destino del envío. "address" indica que el paquete será entregado en una dirección física.

- **status:**  indica el estado actual del servicio de envío. "active" significa que el servicio está actualmente disponible y operativo.

- **site_id:**  país al que se aplica este servicio de envío.

- **free_options:**  lista de opciones en las que el servicio de envío puede ser gratuito. En este caso, "country" indica que el envío puede ser gratuito a nivel nacional.

- **shipping_modes:**  indica los modos de envío compatibles.

- **company_id:**  identificador único de la empresa de logística que provee el servicio de envío.

- **company_name:**  nombre de la empresa de logística que maneja el envío.

- **min_time:**  el tiempo mínimo estimado de entrega del envío en horas.

- **max_time:**  el tiempo máximo estimado de entrega del envío en horas.

- **currency_id:**  identificador de la moneda utilizada para cualquier tarifa aplicable al servicio de envío.

**Códigos de Estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se obtuvo correctamente la configuración actual. | - |
| 401 - Unauthorized | invalid access token | Access token inválido. | Validar el access_token. |
| 404 - Not Found | invalid_site_id | No existe el site_id. | Validar el site_id. |

## Preferencias de envío de un usuario

Este endpoint permite conocer las preferencias de envío activas para un usuario y con esto validar previamente que el vendedor puede publicar o editar un item para los tipos de envío según su cuenta.

Llamada:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/shipping_preferences
```

Ejemplo:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/12345678/shipping_preferences
```

Respuesta:

```
  
{
  "local_pick_up": false,
  "modes": [
    "custom",
    "not_specified",
    "me2",
    "me1"
  ],
  "trusted_user": false,
  "bulky": false,
  "custom_calculator": "Axado",
  "picking_type": null,
  "thermal_printer": null,
  "option": "in",
  "tags": [
    "optional_me1_allowed",
    "turbo",
    "flex2_migration"
  ],
  "me2_enablers": [],
  "carrier_pickup": false,
  "items_combination": "enabled",
  "services": [
    153,
    154,
    251,
    422,
    431,
    742746,
    742748
  ],
  "logistics": [
    {
      "mode": "me1",
      "types": [
        {
          "type": "default",
          "carrier_pickup": [],
          "services": [
            251,
            153,
            154
          ],
          "default": true,
          "status": "active"
        }
      ]
    },
    {
      "mode": "me2",
      "types": [
        {
          "type": "drop_off",
          "carrier_pickup": [],
          "services": [
            422,
            431
          ],
          "default": true,
          "status": "active"
        },
        {
          "type": "self_service",
          "carrier_pickup": [],
          "services": [
            742746,
            742748
          ],
          "default": false,
          "status": "active"
        }
      ]
    },
    {
      "mode": "custom",
      "types": [
        {
          "type": "custom",
          "carrier_pickup": [],
          "services": null,
          "default": true,
          "status": "active"
        }
      ]
    },
    {
      "mode": "not_specified",
      "types": [
        {
          "type": "not_specified",
          "carrier_pickup": [],
          "services": null,
          "default": true,
          "status": "active"
        }
      ]
    }
  ],
  "label": {
    "print_danfe": false,
    "print_browser": false,
    "print_voucher": false,
    "print_summary": true,
    "thermal_printer": null,
    "page_size": "a4",
    "page_format": "pdf"
  },
  "content_declaration_disabled": false,
  "conciliation": {
    "type": null
  },
  "mandatory_invoice_data": false,
  "site_id": "MLA",
  "free_configurations": [
    {
      "condition": {
        "value": null,
        "type": "all"
      },
      "rule": {
        "default": true,
        "free_mode": "country",
        "value": null
      }
    }
  ],
  "mandatory_settings": {}
}
  
```

- **local_pick_up:**  indica si el comprador tiene la opción de retirar el paquete en el domicilio del vendedor. Los valores posibles son:  true: permite el retiro. false: no permite el retiro.

- **modes:**  lista de modos de envío configurados para el usuario. Los valores posibles son:  custom not_specified me2 me1

- **trusted_user:**  indica si el usuario es considerado confiable para vender en dominios restringidos. Los valores posibles son:  true false

- **custom_calculator:**  indica si el usuario cuenta con una tabla de contingencia en Mercado Libre. Los valores posibles son:  Axado: tiene ME1 activo con tabla de contingencia. true: tiene ME1 activo sin tabla de contingencia. false: no tiene ME1 activo. CBT: usuario CBT.

- **thermal_printer:**  indica si se utiliza una impresora térmica.

- **option:**  opción de configuración de envío del usuario. Los valores posibles son:  in: usuario tiene Mercado Envíos 2 activo para todas sus publicaciones. out: usuario anteriormente tenía habilitada la opción de Mercado Envíos 2. Sin embargo, esta funcionalidad ya no está activa para su cuenta. trial: usuario tiene Mercado Envíos 2 activo para algunas publicaciones. null: usuario nunca tuvo Mercado Envíos 2 activo.

- **tags:**  lista de etiquetas adicionales relacionadas con la configuración de envío del usuario. Los valores posibles son:  optional_me1_allowed: me2 es la opción mandatoria, y me1 es la preferencia de envío opcional. optional_me2_allowed: me1 es la opción predeterminada, y me2 es la preferencia de envío opcional. turbo: logística turbo activa para el usuario.

- **me2_enablers:**  indica los habilitadores configurados para el vendedor. Los valores posibles son:  bulky_fulfilllment bulky_cross_docking bulky_drop_off pharma cbt_fulfillment entre otros.

- **carrier_pickup:**  indica si tiene habilitado un carrier para colectas.

- **items_combination:**  indica si permite combinación en carrito.

- **services:**  lista de identificadores de servicios disponibles.

- **logistics:**  configuraciones logísticas detalladas para diferentes modos de envío, cada una con tipos específicos y sus atributos.

- **label:**  configuraciones para la impresión de etiquetas, incluyendo opciones de impresión y tamaño/formato de la página.

- **site_id:**  identificador del país del usuario en Mercado Libre.

**Códigos de Estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se obtuvo correctamente la configuración actual. | - |
| 401 - Unauthorized | authorization value not present | Falta informar el access token | Informe un access token válido |
| 401 - Unauthorized | invalid access token | El access token informa es inválido o expirado | Informe un access token válido |

Consideraciones:

- La configuración predeterminada de un usuario con ME2 y ME1 activos es con **optional_me1_allowed** . Esto significa que ME1 está habilitado como un modo de envío opcional, y ME2 mandatorio.

- Si se desea realizar cualquier modificación en esta configuración, es necesario que el vendedor se comunique con su asesor comercial, justificando el cambio requerido.

- Es fundamental validar los modos de envío activos para cada usuario, ya que esto impacta directamente en cómo se gestionarán las publicaciones de sus productos. Los atributos clave a considerar son **optional_me1_allowed**  y **optional_me2_allowed** .

- Recordar que todos los vendedores tienen habilitado custom y not_specified por defecto.

## Consultar modos de envíos de una categoría

Este endpoint permite consultar las preferencias de envío disponibles para la categoría y sirve para identificar previamente las opciones de envío.

Llamada:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/shipping_preferences
```

Ejemplo:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA418448/shipping_preferences
```

Respuesta:

```
  
{
  "dimensions": {
    "height": 5,
    "width": 18,
    "length": 25,
    "weight": 650
  },
  "logistics": [
    {
      "types": [
        "default"
      ],
      "mode": "me1"
    },
    {
      "types": [
        "drop_off",
        "xd_drop_off",
        "self_service",
        "cross_docking",
        "fulfillment"
      ],
      "mode": "me2"
    },
    {
      "types": [
        "not_specified"
      ],
      "mode": "not_specified"
    },
    {
      "types": [
        "custom"
      ],
      "mode": "custom"
    }
  ],
  "me2_restrictions": null,
  "restricted": false,
  "source": {
    "origin": "categories",
    "identifier": "MLA418448"
  },
  "date_created": null,
  "last_modified": null,
  "category_id": "MLA418448"
}
  
```

**Parámetros de respuesta:**

- **dimensions:**  son las dimensiones base (default) de los productos de esta categoría.

- **logistics:**  muestra los tipos logísticos (mode y type) habilitados para la categoría.

- **me2_restrictions:**  en caso que haya alguna restricción que no permita me2, estará identificado. Posibles valores:  fbm_non_totable flex_ne cbt_fulfillment bulky_drop_off farma fragile bulky_cross_docking bulky_fulfillment

- **restricted:**  en caso que haya restricción de me2, estará identificado con true, de lo contrario, es false.

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se obtuvo correctamente la configuración actual. | - |
| 404 - Not Found | Category not found | No existe la categoría. | Validar el category_id. |

## Consultar atributos de shipping por dominio

Este endpoint permite consultar los atributos de preferencias de envío por dominio, para identificar los atributos requeridos para las reglas de envíos a ME2.

Nota:

Verifique que el **domain_id**  se puede obtener tanto en **/categories**  como en la publicación en **/items** .

Llamada:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' http://api.mercadolibre.com/catalog_domains/$DOMAIN_ID/shipping_attributes
```

Ejemplo:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLA-AUTOMOTIVE_TIRES/shipping_attributes
```

Respuesta:

```
  
{
  "domain_id": "MLA-AUTOMOTIVE_TIRES",
  "attributes": [
    {
      "id": "RIM_DIAMETER",
      "type": "NUMBER_UNIT",
      "unit": "\"",
      "index": 1,
      "ranges": null
    },
    {
      "id": "TIRES_NUMBER",
      "type": "INTEGER",
      "unit": "",
      "index": 2,
      "ranges": null
    },
    {
      "id": "SECTION_WIDTH",
      "type": "NUMBER_UNIT",
      "unit": "mm",
      "index": 3,
      "ranges": null
    }
  ],
  "client_id": "app_id",
  "date_created": "2018-11-09T15:31:02.040-03:00",
  "last_modified": "2023-09-11T15:59:30.175-03:00"
}
  
```

**Parámetros de respuesta:**

- **domain_id:**  ID del dominio consultado.

- **attributes:**  atributos que determinan la preferencia de envío de un item.

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se obtuvo correctamente la configuración actual. | - |
| 404 - Not Found | Domain does not exist | No existe el dominio. | Validar el domain_id. |

## Consultar Servicios de Logística de un User Product

Con este recurso, es posible realizar una validación antes de ejecutar el POST de un Item para identificar desde la API qué modos de envío (logistic_types) están disponibles para el producto (UP). Para ellos, debe enviar las informaciones de abajo, enfocando en los atributos del producto. Recuerde observar el recurso de `catalog_domain/$ID/shipping_attributes` para probar con los atributos que se apuntan como necesarios para actualizaciones a ME2.

Este endpoint permite consultar los servicios de logística disponibles para un User Product específico. Es la evolución del recurso `/users/$USER_ID/shipping_modes`, ofreciendo una estructura de respuesta más completa y semánticamente rica. Además, ahora va existir la **convivencia de logisticas diferentes para un mismo UP** , como por ejemplo las logisticas de fulfilment, crossdocking y flex, con eso debes ajustar su integrción para soportar esa nueva funcionalidad.

**Importante:**

Este recurso está disponible para vendedores de Brasil, Argentina, México, Chile, Colombia, Uruguay, Perú y Ecuador. Todavia el encendido va ser progresivo empezando por Brasil en Abril de 2026.

**Nuevo comportamiento: convivencia de logísticas para un mismo UP**

A partir de ahora, **un mismo User Product puede tener más de una logística activa simultáneamente** . Por ejemplo, es posible que el recurso devuelva tanto `fulfillment` como `cross_docking` (u otras combinaciones como `self_service (FLEX)`) para un mismo UP.
 
**Esto es un cambio de comportamiento respecto al funcionamiento anterior** , donde cada UP tenía una única logística asignada (`cross_docking`, `xd_drop_off` o `fulfillment` por ejemplo, y opcionalmente combinadas con flex).
 
En caso de ya tener un ítem publicado, y se decide enviar stock al fulfillment, esto **se incorporará como una logística adicional** , quedando la publicación activa con `cross_docking` y `fulfillment` por ejemplo. Algo que hasta el momento no sucedía, sino que cambiaba la logística de `cross_docking` a `fulfillment` ya que se permitía que tenga solo una.
 
**¿Qué pasará con los user products que ya están publicados en fulfillment?**  Se les incorporará gradualmente `cross_docking`, `xd_drop_off` según corresponda a la logística activa en el user.
 
**¿Dónde aplica hoy?**  Este comportamiento ya está activo en **MLB (Brasil)** . Progresivamente se irá habilitando en el resto de los sites de Mercado Libre.
 
Por este motivo, **es indispensable que adaptes tu integración para manejar múltiples logísticas por UP**  antes de operar en los sites donde esta funcionalidad esté activa, incluso por la parte que impacta en la Gestión de Stock, que es diferente en cada modalidad de envio. Revisa la documentación de [Estoque distribuido](https://developers.mercadolibre.com.ar/es_ar/stock-distribuido#Gestionar-stock) para validar todo los detalles..

### Endpoint

```
GET https://api.mercadolibre.com/customers/marketplace/sites/{SITE_ID}/user-products/{USER_PRODUCT_ID}/contracts/shippability/services
```

### Parámetros de URL

| **Parámetro** | **Tipo** | **Obligatorio** | **Descripción** |
| --- | --- | --- | --- |
| `SITE_ID` | string | Sí | Identificador del sitio (ej: MLB, MLA, MLM) |
| `USER_PRODUCT_ID` | string | Sí | Identificador del User Product (ej: MLAU1234567890) |

### Query Parameters

| **Parámetro** | **Tipo** | **Obligatorio** | **Descripción** |
| --- | --- | --- | --- |
| `legacy_attributes` | boolean | No | Cuando `true`, incluye mapeo hacia atributos heredados (`mode` y `logistic_type`) |

## Llamada

```
curl -X GET   'https://api.mercadolibre.com/customers/marketplace/sites/$SITE_ID/user-products/$USER_PRODUCT_ID/contracts/shippability/services'   -H 'Content-Type: application/json'   -H 'Accept: application/json'
```

## Ejemplo

```
curl -X GET   'https://api.mercadolibre.com/customers/marketplace/sites/MLA/user-products/MLAU1234567890/contracts/shippability/services?legacy_attributes=true'   -H 'Content-Type: application/json'   -H 'Accept: application/json'
```

### Respuesta

```
{
  "services": [
    {
      "type": "distribution",
      "direction": "forward",
      "flavor": "gm",
      "speed": "standard",
      "distribution_attributes": [
        {
          "stock_origin": "sender",
          "transport_by": "meli",
          "network_provider": "meli"
        }
      ],
      "network": {
        "nodes": {
          "888": {
            "collect_node_type": "sender_node"
          }
        }
      },
      "legacy_attributes": {
        "logistic_type": "cross_docking",
        "mode": "me2"
      }
    }
  ]
}
```

### Respuesta

### Objeto Principal

| **Campo** | **Tipo** | **Descripción** |
| --- | --- | --- |
| `services` | array | Lista de servicios de logística disponibles para el User Product |

### Objeto Service

| **Campo** | **Tipo** | **Descripción** |
| --- | --- | --- |
| `type` | string | Tipo de servicio: `distribution`, `technology` o `display_only` |
| `direction` | string | Dirección del servicio: `forward` (envío al comprador) |
| `flavor` | string | Categoría del servicio: `gm`, `pharma`, `super` o `null` |
| `speed` | string | Velocidad de entrega: `standard`, `turbo` o `null` |
| `distribution_attributes` | array | Atributos de distribución (formato estándar) |
| `network` | object | Configuración de los nodos de recolección |
| `legacy_attributes` | object | Mapeo hacia atributos heredados (cuando `legacy_attributes=true`) |

### Objeto distribution_attributes

| **Campo** | **Valores Posibles** | **Descripción** |
| --- | --- | --- |
| `stock_origin` | `sender`, `meli` | Origen del stock |
| `transport_by` | `sender`, `meli`, `commercial-carrier` | Responsable del transporte |
| `network_provider` | `meli`, `external` | Proveedor de la red logística |

### Objeto legacy_attributes

| **Campo** | **Valores Posibles** | **Descripción** |
| --- | --- | --- |
| `logistic_type` | `drop_off`, `cross_docking`, `xd_drop_off`, `fulfillment`, `self_service`, `default`, `"not_specified`, `custom"` | Tipo logístico heredado |
| `mode` | `me1`, `me2`, `"not_specified`, `custom"` | Modo de envío heredado |

### Respuesta

### Objeto Principal

| **Campo** | **Tipo** | **Descripción** |
| --- | --- | --- |
| `services` | array | Lista de servicios de logística disponibles para el User Product |

### Objeto Service

| **Campo** | **Tipo** | **Descripción** |
| --- | --- | --- |
| `type` | string | Tipo de servicio: `distribution`, `technology` o `display_only` |
| `direction` | string | Dirección del servicio: `forward` (envío al comprador) |
| `flavor` | string | Categoría del servicio: `gm`, `pharma`, `super` o `null` |
| `speed` | string | Velocidad de entrega: `standard`, `turbo` o `null` |
| `distribution_attributes` | array | Atributos de distribución (formato estándar) |
| `network` | object | Configuración de los nodos de recolección |
| `legacy_attributes` | object | Mapeo hacia atributos heredados (cuando `legacy_attributes=true`) |

### Objeto distribution_attributes

| **Campo** | **Valores Posibles** | **Descripción** |
| --- | --- | --- |
| `stock_origin` | `sender`, `meli` | Origen del stock |
| `transport_by` | `sender`, `meli`, `commercial-carrier` | Responsable del transporte |
| `network_provider` | `meli`, `external` | Proveedor de la red logística |

### Objeto legacy_attributes

| **Campo** | **Valores Posibles** | **Descripción** |
| --- | --- | --- |
| `logistic_type` | `drop_off`, `cross_docking`, `xd_drop_off`, `fulfillment`, `self_service`, `default`, `"not_specified`, `custom"` | Tipo logístico heredado |
| `mode` | `me1`, `me2`, `"not_specified`, `custom"` | Modo de envío heredado |

## Ejemplos por Escenario

### Respuesta - Cross Docking

```
{
  "services": [
    {
      "type": "distribution",
      "direction": "forward",
      "flavor": "gm",
      "speed": "standard",
      "distribution_attributes": [
        {
          "stock_origin": "sender",
          "transport_by": "meli",
          "network_provider": "meli"
        }
      ],
      "network": {
        "nodes": {
          "888": { "collect_node_type": "sender_node" }
        }
      },
      "legacy_attributes": {
        "logistic_type": "cross_docking",
        "mode": "me2"
      }
    }
  ]
}
```

## Migración del Recurso Heredado

Nota:

- Este endpoint debe ser usado en lugar de `/users/$USER_ID/shipping_modes` para las validaciones sobre publicaciones ya creadas (UPs). 
 - Utiliza el parámetro `legacy_attributes=true` durante el período de migración. 
 - El recurso de `/users/$USER_ID/shipping_modes` sigue vigente y funcional para las validaciones antes de crear una publicación y también para los sites que aun no están encendidos con el nuevo formato.

| **Recurso Heredado** | **Nuevo Recurso** |
| --- | --- |
| `mode: "me2"` | `type: "distribution"` o `type: "technology"` (con `network_provider: "meli"`) |
| `mode: "me1"` | `type: "technology"` (con `network_provider: "external"`) |
| `mode: "custom"` | `type: "display_only"` |
| `logistic_type: "drop_off"` | `distribution_attributes.transport_by: "commercial-carrier"` |
| `logistic_type: "cross_docking"` | `distribution_attributes.transport_by: "meli"` + nodos `sender_node` |
| `logistic_type: "xd_drop_off"` | `distribution_attributes.transport_by: "meli"` + nodos `meli_node` |
| `logistic_type: "fulfillment"` | `distribution_attributes.stock_origin: "meli"` |
| `logistic_type: "self_service"` | `type: "technology"` + `distribution_attributes.transport_by: "sender"` |

## Consideraciones

- El parámetro `legacy_attributes=true` es recomendado durante el período de migración para facilitar la compatibilidad con integraciones existentes.

- El campo `network.nodes` solo está presente cuando hay nodos de recolección específicos configurados.

- Un User Product puede tener múltiples servicios disponibles simultáneamente (ej: Cross Docking + Fulfillment + Self-Service).

- El `flavor` indica la categoría del producto: `gm` (General Merchandise), `pharma` (farmacéuticos), `super` (supermercado).

- El `speed` indica la velocidad de entrega: `standard` o `turbo`.

## Consultar modos de envíos de un ítem para el usuário

Como paso extra, es posible realizar una validación antes de ejecutar el POST del Item para identificar probar si la API permite el modo de envío que estás intentando actualizar. Para ellos, debe enviar las informaciones abajo, enfocando en los atributos de la publicación. Recuerde de observar el recurso de catalog_domaing/$ID/shipping_attributes para probar con los atributos que se apuntan como necesarios para actualización a ME2.

Llamada:

```
  curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 'x-multichannel: true' 'X-Format-New: true' -H "Content-Type: application/json" -d https://api.mercadolibre.com/users/$USER_ID/shipping_modes
```

Ejemplo:

```
	curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 'x-multichannel: true' 'X-Format-New: true' -H 'Content-Type: application/json' -d       
     https://api.mercadolibre.com/users/123456789/shipping_modes
```

```
	{
  "site_id": "MLB",
  "item_id": "MLB3856335025",
  "seller_id": 378277780,
  "title": "Título de teste",
  "item_price": 500,
  "item_currency": "BRL",
  "category_id": "MLB1626",
  "catalog": {
    "domain_id": "MLB-WASHING_MACHINES",
    "attributes": [
      {
        "id": "BRAND",
        "name": "Marca",
        "value_name": "Electrolux",
        "value_id": "188"
      },
      {
        "id": "COLOR",
        "name": "Cor",
        "value_name": "Branco",
        "value_id": "52055"
      },
      {
        "id": "CONTROL_TYPES",
        "name": "Tipos de controle",
        "value_name": "Botões,Manípulos"
      },
      {
        "id": "DEPTH",
        "name": "Profundidade",
        "value_name": "62 cm",
        "value_id": "908239"
      },
      {
        "id": "DISPLAY_TYPE",
        "name": "Tipo de tela",
        "value_name": "Digital",
        "value_id": "102258"
      },
      {
        "id": "DRUMS_NUMBER",
        "name": "Quantidade de cestos",
        "value_name": "1",
        "value_id": "9780701"
      },
      {
        "id": "DRUM_MATERIAL",
        "name": "Material do cesto",
        "value_name": "Polipropileno",
        "value_id": "11131730"
      },
      {
        "id": "ENERGY_EFFICIENCY",
        "name": "Eficiência energética",
        "value_name": "A",
        "value_id": "98473"
      },
      {
        "id": "GTIN",
        "name": "Código universal de produto",
        "value_name": "7896584070767",
        "value_id": "7726347"
      },
      {
        "id": "HEIGHT",
        "name": "Altura",
        "value_name": "1.06 m",
        "value_id": "8711782"
      },
      {
        "id": "INTEGRATED_TECHNOLOGIES",
        "name": "Tecnologias integradas",
        "value_name": "Jet&Clean",
        "value_id": "8004426"
      },
      {
        "id": "IS_INDUSTRIAL",
        "name": "É industrial",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "IS_WASHER_AND_DRYER",
        "name": "É lavadora e secadora",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "ITEM_CONDITION",
        "name": "Condição do item",
        "value_name": "Novo",
        "value_id": "2230284"
      },
      {
        "id": "LINE",
        "name": "Linha",
        "value_name": "Turbo Economia",
        "value_id": "110721"
      },
      {
        "id": "LOADING_TYPE",
        "name": "Tipo de carga",
        "value_name": "Superior",
        "value_id": "111016"
      },
      {
        "id": "MAIN_COLOR",
        "name": "Cor principal",
        "value_name": "Branco",
        "value_id": "2450308"
      },
      {
        "id": "MODEL",
        "name": "Modelo",
        "value_name": "LAC09",
        "value_id": "2269247"
      },
      {
        "id": "MPN",
        "name": "MPN",
        "value_name": "21081JBA106,2001884"
      },
      {
        "id": "SELLER_PACKAGE_HEIGHT",
        "name": "Altura da embalagem do vendor",
        "value_name": "105 cm"
      },
      {
        "id": "SELLER_PACKAGE_LENGTH",
        "name": "Comprimento da embalagem do vendor",
        "value_name": "63 cm"
      },
      {
        "id": "SELLER_PACKAGE_WEIGHT",
        "name": "Peso da embalagem do vendor",
        "value_name": "34400 g"
      },
      {
        "id": "SELLER_PACKAGE_WIDTH",
        "name": "Largura da embalagem do vendor",
        "value_name": "57 cm"
      },
      {
        "id": "SELLER_SKU",
        "name": "SKU",
        "value_name": "2001884"
      },
      {
        "id": "SPIN_SPEED",
        "name": "Velocidade de rotação",
        "value_name": "660 rpm",
        "value_id": "1061038"
      },
      {
        "id": "VOLTAGE",
        "name": "Voltagem",
        "value_name": "127V",
        "value_id": "39205162"
      },
      {
        "id": "WASHING_MACHINE_CAPACITY",
        "name": "Capacidade da máquina de lavar",
        "value_name": "8.5 kg",
        "value_id": "440587"
      },
      {
        "id": "WASHING_MACHINE_TYPE",
        "name": "Tipo de máquina de lavar",
        "value_name": "Automática",
        "value_id": "111101"
      },
      {
        "id": "WASH_CYCLES_NUMBER",
        "name": "Quantidade de programas de lavagem",
        "value_name": "12",
        "value_id": "942738"
      },
      {
        "id": "WASH_SYSTEM",
        "name": "Sistema de lavagem",
        "value_name": "Americano",
        "value_id": "6786680"
      },
      {
        "id": "WATER_LEVELS",
        "name": "Níveis de água",
        "value_name": "4",
        "value_id": "942781"
      },
      {
        "id": "WATER_LOAD_TYPES",
        "name": "Tipos de carga de água",
        "value_name": "Manual",
        "value_id": "11351063"
      },
      {
        "id": "WATER_TEMPERATURE",
        "name": "Temperatura da água",
        "value_name": "Fria",
        "value_id": "364145"
      },
      {
        "id": "WEIGHT",
        "name": "Peso",
        "value_name": "30.5 kg",
        "value_id": "8180925"
      },
      {
        "id": "WIDTH",
        "name": "Largura",
        "value_name": "54 cm",
        "value_id": "908290"
      },
      {
        "id": "WITH_ANTI_CREASE_FUNCTION",
        "name": "Com função antirrugas",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_DELAY_START",
        "name": "Com começo diferido",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_DISPLAY",
        "name": "Com tela",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_DOOR_SAFETY_BLOCK",
        "name": "Com bloqueio de segurança de porta",
        "value_name": "Sim",
        "value_id": "242085"
      },
      {
        "id": "WITH_FILTER",
        "name": "Com filtro",
        "value_name": "Sim",
        "value_id": "242085"
      },
      {
        "id": "WITH_FINISH_ALARM",
        "name": "Com alarme de finalização",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_INVERTER_TECHNOLOGY",
        "name": "Com tecnologia inverter",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_PANEL_BLOCK",
        "name": "Com bloqueio de painel",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_QUICK_WASH",
        "name": "Com lavagem rápida",
        "value_name": "Sim",
        "value_id": "242085"
      },
      {
        "id": "WITH_SELF_ADAPTATIVE_LOAD",
        "name": "Com carga autoadaptable",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_SMARTPHONE_CONTROL_FUNCTION",
        "name": "Com função para controle de smartphone",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_SPIN",
        "name": "Com rotação",
        "value_name": "Sim",
        "value_id": "242085"
      },
      {
        "id": "WITH_SPIN_AUTOBALANCE",
        "name": "Com rotação autobalance",
        "value_name": "Não",
        "value_id": "242084"
      },
      {
        "id": "WITH_WI_FI_CONNECTION",
        "name": "Com conexão Wi-Fi",
        "value_name": "Não",
        "value_id": "242084"
      }
    ]
  },
  "sale_terms": [],
  "listing_type_id": "gold_pro",
  "buying_mode": "buy_it_now",
  "condition": "new",
  "channels": [
    {
      "id": "marketplace"
    }
  ],
  "new_format": true,
  "verbose": false
}     
```

Respuesta:

```
  {
    "channels": {
        "marketplace": {
            "available_modes": [
                {
                    "mode": "custom",
                    "logistic_types": [
                        {
                            "type": "custom",
                            "default": true,
                            "attributes": {
                                "dimensions": "optional",
                                "costs": "required",
                                "adoption": "not_required",
                                "free_shipping": "not_allowed",
                                "local_pick_up": "optional",
                                "tags": []
                            }
                        }
                    ],
                    "shipping_attributes": {
                        "dimensions": "optional",
                        "costs": "required",
                        "adoption": "not_required",
                        "free_shipping": "not_allowed",
                        "local_pick_up": "optional",
                        "tags": []
                    }
                },
                {
                    "mode": "not_specified",
                    "logistic_types": [
                        {
                            "type": "not_specified",
                            "default": true,
                            "attributes": {
                                "dimensions": "optional",
                                "costs": "not_allowed",
                                "adoption": "not_required",
                                "free_shipping": "optional",
                                "local_pick_up": "optional",
                                "tags": []
                            }
                        }
                    ],
                    "shipping_attributes": {
                        "dimensions": "optional",
                        "costs": "not_allowed",
                        "adoption": "not_required",
                        "free_shipping": "optional",
                        "local_pick_up": "optional",
                        "tags": []
                    }
                },
                {
                    "mode": "me2",
                    "logistic_types": [
                        {
                            "type": "self_service",
                            "default": true,
                            "attributes": {
                                "dimensions": "clear",
                                "costs": "not_allowed",
                                "adoption": "not_required",
                                "free_shipping": "mandatory",
                                "local_pick_up": "optional",
                                "tags": []
                            }
                        }
                    ],
                    "shipping_attributes": {
                        "dimensions": "clear",
                        "costs": "not_allowed",
                        "adoption": "not_required",
                        "free_shipping": "mandatory",
                        "local_pick_up": "optional",
                        "tags": []
                    }
                }
            ],
            "warnings": null,
            "channel_id": "marketplace"
        }
    }
}
```

**Parámetros de respuesta:**

- **mode:**  modos de envíos permitidos.

- **logistic_types**    **type:**  tipos de logísticas acorde a cada modo de envío.   **default:**  si el tipo de logística es definido por patrón.   **attributes:**    **dimensions:**  en caso que haya una dimensión default, se completa.   **costs:**  reglas relacionadas al costo de envío.   **adoption:**  indica la configuración sobre activar me2 en la publicación   **free_shipping:**  si es default la configuración de envío grátis.   **local_pick_up:**  indica la configuración sobre la opción de retirar la compra con el vendedor   **tags:**  tags internas relacionadas a las características de cada tipo de logística.

Nota:

- En caso de que desees validar un ítem existente, es necesario enviar el atributo item_id. Si este no está presente, se validarán las reglas de manera genérica. Por lo tanto, se recomienda utilizar al menos los siguientes atributos para obtener una respuesta más precisa: item_id, seller_id, category_id, channels, catalog, domain, attributes, new_format y verbose. 
 - Los atributos de algunos dominios que son relacionados a dimensión y peso, validados por el recurso arriba de Consultar atributos de shipping por dominio, tendrán valores de referencia ilustrativos (no son restriciciones).

## Consultar un ítem

También es posible validar ciertas informaciones relacionadas al envío de la publicación consultando su detalle por la API /Items.

Llamada:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA1718222111
```

Respuesta

```
  
{
  "id": "MLA1718222111",
  "site_id": "MLA",
  "title": "Silla Director Coleman Sillon Plegable Acero Resistente 136k Color Rojo",
  "seller_id": 309720111,
  "category_id": "MLA79227",
  "user_product_id": "MLAU255412797",
  "official_store_id": 66111,
  "price": 105622,
  "base_price": 105622,
  "original_price": 126900,
  "currency_id": "ARS",
  "initial_quantity": 4,
  "available_quantity": 2,
  "sold_quantity": 2,
  "shipping": {
    "mode": "me2",
    "methods": [],
    "tags": [
      "self_service_out",
      "mandatory_free_shipping"
    ],
    "dimensions": null,
    "local_pick_up": true,
    "free_shipping": true,
    "logistic_type": "cross_docking",
    "store_pick_up": false
  }
}
  
```

Ahora que ya sabes cómo validar previamente las informaciones de su vendedor, revise las siguientes documentaciones para saber cómo gestionar las publicaciones:

- [Mercado Envíos 1](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-1)

- [Mercado Envíos 2](https://developers.mercadolibre.com.ar/es_ar/mercadoenvios-modo-2)

- [Envíos Personalizados](https://developers.mercadolibre.com.ar/es_ar/envios-personalizados)
