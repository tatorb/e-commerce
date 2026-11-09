<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/envios-flex -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Envíos Flex

Última actualización 15/10/2026

# Envíos Flex

**Importante:**

Actualmente, esta modalidad de envío está disponible para vendedores de Argentina, Brasil, México, Chile, Colombia, Uruguay, Perú y Ecuador.

Envíos Flex es un servicio que permite a los vendedores realizar envíos por su cuenta, los 7 días de la semana. Integra envíos en el día o al día siguiente para mejorar los tiempos de entrega y aumentar la penetración en el mercado. Con Envíos Flex, los vendedores pueden tener mayor control y seguimiento sobre sus envíos, ofreciendo un servicio más rápido y eficiente a sus clientes.

Conoce más sobre:

- [Cómo funciona Envíos Flex](https://www.mercadolibre.com.ar/ayuda/22381)

- [Tarifas de los Envíos Flex](https://www.mercadolibre.com.ar/ayuda/Costos-envios-Flex_3859)

- [Consejos para gestionar adecuadamente mis Envíos Flex](https://www.mercadolibre.com.ar/ayuda/30897)

- [Cómo puedo gestionar mis domicilios para Envíos Flex](https://www.mercadolibre.com.ar/ayuda/28966)

- [Cómo ofrecer Envíos Flex y Full en la misma publicación](https://www.mercadolibre.com.ar/ayuda/ofrecer-Flex-y-Full_4980)

- [Consejos para hacer entregas con Envíos Flex](https://www.mercadolibre.com.ar/ayuda/Consejos-para-enviar-con-Merca_4459)

- [Cómo evito la suspensión de zonas para mis Envíos Flex](https://www.mercadolibre.com.ar/ayuda/32042)

Nota:

- Es fundamental respetar el límite de 1000 rpm en todas las llamadas a los recursos de FLEX. Mantener este límite garantiza un uso eficiente y equitativo de los recursos disponibles.

- La app de envíos flex de Mercado Libre es necesaria para escanear las entregas y hacer los recorridos de entregas. Sin embargo, no está disponible para integraciones, por lo que las empresas logísticas deberán adaptarse.

- Las APIs no permiten consultar ni modificar el rango extendido de entrega disponible para algunas logísticas. Únicamente se informa si la configuración tiene un rango extendido activo. Si una configuración posee horario extendido de entrega, es posible que ciertos endpoints de actualización V1 respondan con `422 Unprocessable Content`.

### Vista del vendedor:

## Áreas de cobertura por países

Para poder ofrecer Envíos Flex, la dirección de envío del vendedor debe estar habilitada para alguna de las áreas de cobertura según el país:

| País | Cobertura |
| --- | --- |
| Argentina | AMBA (Área Metropolitana de Buenos Aires) Córdoba |
| Brasil | São Paulo Río de Janeiro Brasilia Belo Horizonte Porto Alegre Salvador Bahía Curitiba |
| México | CDMX (Zona Metropolitana del Valle de México) Mérida |
| Chile | Santiago (Región Metropolitana) Valparaíso |
| Colombia | Bogotá Medellín Cali |
| Uruguay | Montevideo Canelones |
| Perú | Lima (Área Metropolitana) |
| Ecuador | Quito |

## Configurar un usuario de test

Para configurar la funcionalidad de Envíos Flex para usuarios de prueba, tomar en cuenta:

1. Inicie sesión en la cuenta en la que desea habilitar Envío Flex.

2. Asegúrese de que la cuenta tenga publicaciones activas en ME2.

3. Verifique que su cuenta tenga una reputación Amarilla o Verde.

4. Asegúrese de tener una dirección de correo compatible con el área de cobertura de su país.

5. Configure la dirección de envío de acuerdo con las áreas de cobertura en los países correspondientes.

6. Active Envíos Flex a la cuenta.

Una vez que haya completado estos pasos, debería poder utilizar Envíos Flex como usuario de prueba.

Nota:

Es recomendable crear un nuevo user test con la nueva configuración para probar este flujo actualizado.

## Consultar suscripciones de un usuario

Este endpoint permite consultar las suscripciones de un usuario, quien puede tener múltiples suscripciones configurables que corresponden a diferentes orígenes, incluso si todas pertenecen al mismo modo.

Nota:

- Se crea una suscripción cuando un vendedor comienza a utilizar Envíos Flex en cualquier modalidad.

- En el contexto de las suscripciones, cada una de ellas cuenta con un identificador único llamado **"service_id"** . Este identificador es fundamental para poder acceder a la configuración de la suscripción y realizar cambios en ella. Para este caso, el que se utilizará será el service_id de la modalidad Flex.

| Params |  |
| --- | --- |
| Params | **site_id**  ⇒ id del site  **user_id**  ⇒ id del user a consultar |

**Llamada:**

```
curl -X GET https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/subscriptions/v1 \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

```
[
    {
        "site_id": "MLA",
        "user_id": 1438865529,
        "service_id": 738216,
        "mode": "FLEX",
        "origin": {
            "address_line": "Testing Address 3000",
            "city": {
                 "id": "TUxBQlNBQTM3Mzda",
                 "name": "Saavedra"
            },
            "id": "1369500000",
            "zip_code": "1234"
        },
        "status": "in", 
        "configuration": {
            "set": {
                    "coverage": {
                           "type":"zone", 
                           "capabilities": {
                                "cutoff_by_zone": false
                            }
                    },
                    "delivery_ranges": "dynamic"/"disabled",
                    "holidays": true ,
                    "transit_times": false
            },
            "available": {
                    "coverage": {
                            "type": ["zone"], 
                            "capabilities": {
                                "cutoff_by_zone": true
                            }
                    }
            }
        }
    }
]
```

El campo `configuration.set.coverage.type` define el modelo de cobertura del seller y determina qué endpoints de configuración de cobertura debe usar:

- `"zone"` → el seller configura su cobertura por zonas geográficas. Usar los endpoints de Consultar/Actualizar zonas de cobertura en esta página.

- `"radius"` → el seller configura su cobertura por radio en km. Usar los endpoints [Consultar/Actualizar radio de cobertura](https://developers.mercadolibre.com.ar/es_ar/envios-turbo) documentados en [Envíos Turbo](https://developers.mercadolibre.com.ar/es_ar/envios-turbo).

El array `configuration.available.coverage.type` confirma qué tipo está disponible para ese seller. Un seller no puede usar los endpoints del tipo que no tenga disponible.

**Parámetros de respuesta:**

- **Detalles de la Suscripción:**   **site_id** : Identificador del sitio (ej. "MLA"). **user_id** : Identificador del usuario propietario de la suscripción. **service_id** : Identificador del servicio al que está asociada la suscripción. **mode** : Modalidad de la suscripción, que puede ser "FLEX" o "TURBO". **status** : Estado actual de la suscripción (ejs. "creating", "pending", "activating", "in", "out").

- **Origen de la Suscripción (origin):**   Información detallada de la dirección de origen. **address_line** : Dirección completa del origen. **id** : Identificador de la dirección de origen. **zip_code** : Código postal de la dirección. **city** :  **id** : Identificador de la ciudad. **name** : Nombre de la ciudad.

- **Configuración de la Suscripción (configuration):**   Detalles de la configuración seteada y las opciones disponibles. **Configuración Activa (set):**   **coverage** : Configuración de la cobertura actual. **type** : Tipo de cobertura activa. Valores posibles:  `"zone"` — cobertura por zonas geográficas (Flex). Los endpoints de `/configurations/coverage/zones/` aplican a este tipo. `"radius"` — cobertura por radio en km (Turbo). Los endpoints de `/configurations/coverage/radius/` aplican a este tipo. Ver [Envíos Turbo](https://developers.mercadolibre.com.ar/es_ar/envios-turbo).   **capabilities** : Capacidades de la cobertura. **cutoff_by_zone** : Indica si la cobertura actual tiene horario de corte por zona. **delivery_ranges** : Tipo de rangos de entrega configurados: "dynamic", "fixed" o "disabled". **holidays** : Indica si la funcionalidad de feriados está habilitada. **transit_times** : Indica si los tiempos de tránsito están habilitados.   **Configuración Disponible (available):**   **coverage** : Opciones de cobertura que el usuario puede configurar. **type** : Tipos de cobertura disponibles (ej. "zone"). **capabilities** : Capacidades de cobertura configurables. **cutoff_by_zone** : Indica si el horario de corte por zonas es una opción configurable.

**Códigos de estado de respuesta:**

- **200 OK** : Consulta exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **500 Internal Server Error** : Error al obtener la configuración.

## Consultar zonas de cobertura

**Este endpoint aplica exclusivamente a sellers con `configuration.set.coverage.type = "zone"`. Los sellers de tipo `"radius"` deben usar los endpoints de radio documentados en [Envíos Turbo → Consultar radio de cobertura](https://developers.mercadolibre.com.ar/es_ar/envios-turbo#consultar-radio).**

Este endpoint te permite obtener información detallada sobre las zonas de cobertura de entrega.

| Params |  |
| --- | --- |
| Params | **site_id**  ⇒ id del site  **user_id**  ⇒ id del user a consultar  **service_id**  ⇒ id del service a consultar |
| Query Params | **show_availables**  ⇒ bool, para mostrar o no los disponibles |

**Llamada:**

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/coverage/zones/v1?show_availables=$boolean
```

**Respuesta:**

```
  {
    "zones": [
        {
            "id": "CABA",
            "cutoff": {
                "week": 12,
                "saturday": 12,
                "sunday": 12
            }
        }
    ],
    "availables": {
        "zones": [
            {
                "id": "CABA",
                "label": "CABA",
                "neighborhoods": [],
                "polygon": {
                    "geometry": {
                        "coordinates": [
                            [
                                [
                                    -57.754044,
                                    -34.907747
                                ],
                                [
                                    -57.785072,
                                    -34.888363
                                ]
                            ]
                        ],
                        "type": "Polygon"
                    },
                    "properties": {
                        "name": null
                    },
                    "type": "Feature"
                },
                "price": {
                    "cents": "99",
                    "currency_id": "ARS",
                    "decimal_separator": ".",
                    "fraction": "8506",
                    "symbol": "$"
                },
                "scope": "LocalLejano",
                "allow_extended": true
            }
        ],
        "cutoffs": {
            "global": {
                "min": 12,
                "max": 18
            },
            "per_scope": {
                "LocalInterno": {
                    "minimum": 12,
                    "maximum": 18
                },
                "LocalAdyacente": {
                    "minimum": 12,
                    "maximum": 18
                },
                "LocalLejano": {
                    "minimum": 10,
                    "maximum": 15
                }
            }
        }
    }
}
```

#### Consideraciones

En el caso de que no posea una configuración específica de horario de corte por zona, el objeto **cutoff**  será omitido en el response.

**Parámetros de respuesta:**

- **zones**   **id** : Identificador de la zona (por ejemplo, "CABA"). **cutoff (week/saturday/sunday)** : Horario de corte configurada para cada día.

- **availables**  (Este objeto se incluye únicamente si el parámetro `show_availables=true` está presente en la consulta)  **zones** : Lista con sus configuraciones de las zonas disponibles. **id** : ID de la zona. **label** : Nombre descriptivo de la zona. **neighborhoods** : Lista de vecindarios dentro de la zona. **polygon** : Definición geográfica de la zona. **geometry** : Datos de la geometría de la zona.  **coordinates** : Coordenadas geográficas. **type** : Tipo de geometría.   **price** : Información del precio de la zona.  **cents** : Valor en centavos. **currency_id** : ID de la moneda. **decimal_separator** : Separador decimal. **fraction** : Fracción de la moneda. **symbol** : Símbolo de la moneda. **scope** : Alcance de la zona. **allow_extended** : indica si la zona soporta un rango extendido de entrega.

- **cutoffs**   **global** : Información global de las horas de corte disponibles.  **min** : Hora mínima global de corte. **max** : Hora máxima global de corte.   **per_scope** : Horas de corte por tipo de alcance. Contiene un objeto por cada alcance posible (`LocalInterno`, `LocalAdyacente`, `LocalLejano`).  **minimum** : Hora mínima de corte para ese alcance. **maximum** : Hora máxima de corte para ese alcance.

#### Códigos de respuesta

- **200 OK** : Consulta exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **501 Not implemented:** : No ha sido implementado aun.

- **500 Internal Server Error** : Error al obtener la configuración.

## Actualizar zonas de cobertura

**Este endpoint aplica exclusivamente a sellers con `configuration.set.coverage.type = "zone"`. Los sellers de tipo `"radius"` deben usar los endpoints de radio documentados en [Envíos Turbo →Actualizar radio de cobertura](https://developers.mercadolibre.com.ar/es_ar/envios-turbo#actualizar-radio).**

Este endpoint te permite modificar la información relacionada con las zonas de cobertura de entrega, como por ejemplo agregar o eliminar zonas, también activar o desactivar horario de corte para los días de la semana, sábados y domingos.

| Params |  |
| --- | --- |
| Params | **site_id**  ⇒ id del site  **user_id**  ⇒ id del user a consultar  **service_id**  ⇒ id del service a consultar |

**Llamada:**

```
  curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/coverage/zones/v1
```

**Ejemplo del request body:**

```
  
{
    "zones": [
        {
            "id": "CABA",
            "cutoff": {
                "week": 12,
                "saturday": 12,
                "sunday": 12
            }
        }
    ]
}
```

### Consideraciones

- Para actualizar, agregar o eliminar zonas sin horario de corte por zona, las zonas se envían sin el objeto de **cutoff** .

- Para activar horario de corte por zona, se envía el objeto de **cutoff**  en las zonas, con valores diferentes para cada zona.

- Para desactivar el horario de corte por zona, se envía el objeto de **cutoff**  en las zonas, pero con los mismos valores para cada zona.

- Para actualizar, agregar o eliminar zonas con horario de corte por zona, se envían las zonas con los valores de **cutoff**  correspondientes.

- Si la configuración actual tiene un rango extendido activo, la actualización será rechazada con `422 Unprocessable Content`.

Nota:

Horario de corte por zona es una funcionalidad disponible para el modo FLEX en la cual el usuario puede diferenciar el horario de corte de ventas en el día para cada zona. Esta funcionalidad tiene que ser activada o desactivada por el usuario.

- En caso de querer activar/desactivar o modificar el horario de corte por zona, se hace mediante la actualización de zonas de cobertura.

#### Códigos de respuesta

- **204 No Content** : Actualización exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **422 Unprocessable Content** : la solicitud es válida, pero no puede procesarse porque la configuración tiene un rango extendido de entrega activo.

- **500 Internal Server Error** : Error al obtener la configuración.

## Consultar días festivos

Este endpoint te permite obtener información detallada sobre cada holiday del site donde está configurado el servicio.

| Params |  |
| --- | --- |
| Params | **site_id**  ⇒ id del site  **user_id**  ⇒ id del user a consultar  **service_id**  ⇒ id del service a consultar |

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/holidays/v1
```

**Respuesta:**

```
{
  "holidays": [
    {
      "date": "2021-12-25",
      "description": "Christmas",
      "selected": true
    }
  ]
}
```

**Parámetros de respuesta:**

- **holidays** : lista de feriados configurados.  **date** : fecha del feriado (formato YYYY-MM-DD). **description** : descripción del feriado. **selected** : indica si el user decide realizar envíos durante ese feriado.

**Códigos de estado de respuesta:**

- **200 OK** : Consulta exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **500 Internal Server Error** : Error al obtener la configuración.

## Actualizar días festivos

Este endpoint permite actualizar la configuración de feriados para un usuario. A través del mismo, se puede marcar un día feriado como hábil o inhábil para realizar entregas.

| Params |  |
| --- | --- |
| Params | **site_id**  ⇒ id del site  **user_id**  ⇒ id del user a consultar  **service_id**  ⇒ id del service a consultar |

**Llamada:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/holidays/v1
```

**Ejemplo:**

```
{
  "holidays": [
    {
      "date": "2021-12-25",
      "description": "Christmas",
      "selected": false
    }
  ]
}
```

**Consideraciones**

- Un usuario solo podrá establecer un día como holiday (inhábil) enviando en el JSON del request body **"selected": true** , siempre y cuando ese día esté previamente configurado como día activo de trabajo para el seller.

- Por ejemplo, si el seller no tiene configurado el sábado como día laboral y solicita establecer un holiday en sábado, el endpoint devolverá un error.

**Códigos de estado de respuesta:**

- **204 No Content** : Actualización exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **500 Internal Server Error** : Error al obtener la configuración.

## Consultar rangos de entrega

Este endpoint te permite recuperar información sobre los rangos de entrega de un usuario.

| Params |  |
| --- | --- |
| Params | **site_id**  ⇒ id del site  **user_id**  ⇒ id del user a consultar  **service_id**  ⇒ id del service a consultar |
| Query Params | **show_availables**  ⇒ bool, para mostrar o no los disponibles |

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/delivery-ranges/v1?show_availables=boolean
```

**Respuesta:**

```

{
    "delivery_window": "same_day",
    "delivery_ranges": {
        "week": [
            {
                "capacity": 500,
                "from": 12,
                "to": 12,
                "cutoff": 14
            }
        ],
        "saturday": [
            {
                "capacity": 500,
                "from": 12,
                "to": 12,
                "cutoff": 14
            }
        ],
        "sunday": [
            {
                "capacity": 500,
                "from": 12,
                "to": 12,
                "cutoff": 14
            }
        ]
    },
    "has_extended_range": false,
    "is_downgraded": false,
    "availables": {
        "capacity": {
            "min": 100,
            "max": 500
        },
        "delivery_ranges": {
            "type": "dynamic",
            "ranges": {
                "1": [
                    {
                        "from": 9,
                        "to": 21
                    }
                ]
            },
            "min_hours": 9,
            "max_hours": 21,
            "min_range_quantity": 1,
            "max_range_quantity": 1,
            "min_hours_quantity_between_ranges": 1
        },
        "delivery_windows": [
            "same_day",
            "next_day"
        ],
        "working_days": [
            "week",
            "saturday",
            "sunday"
        ],
        "cutoffs": {
            "global": {
                "min": 12,
                "max": 18
            }
        }
    }
}
```

**Parámetros de respuesta:**

- **delivery_window** : ventana de entrega configurada actualmente ([same_day](https://developers.mercadolibre.com.ar/AGREGAR_LINK) y [next_day](https://developers.mercadolibre.com.ar/AGREGAR_LINK)).

- **delivery_ranges week / saturday / sunday** : rangos de entrega configurados según el día:  **capacity** : capacidad máxima de envíos en cada rango. **from** : hora de inicio del rango de entrega. **to** : hora de fin del rango de entrega. **cutoff** : hora límite para ingresar pedidos en ese rango. (Este campo no será visible si tiene horario de corte). **is_downgraded** : indica si el servicio está moderado. **has_extended_range** : indica si la configuración tiene actualmente un rango extendido de entrega. El rango extendido no se incluye en la respuesta.

- **availables**  (Este objeto se incluye únicamente si el parámetro [show_availables=true](https://developers.mercadolibre.com.ar/AGREGAR_LINK) está presente en la consulta)  **capacity_min** : capacidad mínima disponible para configurar (según flavour). **capacity_max** : capacidad máxima disponible para configurar (según flavour). **delivery_ranges_type** : tipo de rango de entrega disponible. **delivery_ranges_ranges_from** : hora de inicio de entregas. **delivery_ranges_ranges_to** : hora de fin de las entregas. **delivery_ranges_min_range_quantity** : cantidad mínima de rangos de entrega por día. **delivery_ranges_max_range_quantity** : cantidad máxima de rangos de entrega por día. **delivery_ranges_min_hours_quantity_between_ranges** : cantidad mínima de horas entre dos rangos. **delivery_windows** : ventanas de entrega disponibles ([same_day](https://developers.mercadolibre.com.ar/AGREGAR_LINK) y [next_day](https://developers.mercadolibre.com.ar/AGREGAR_LINK)). **working_days** : días hábiles disponibles para operar (week, saturday, sunday). **cutoffs_global_min** : hora mínima global de cutoff disponible. **cutoffs_global_max** : hora máxima global de cutoff disponible.

**Códigos de estado de respuesta:**

- **200 OK** : Consulta exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **500 Internal Server Error** : Error al obtener la configuración.

## Actualizar rangos de entrega

Este endpoint te permite actualizar la configuración de rangos de entrega para un vendedor.

| Params |  |
| --- | --- |
| Params | **site_id**  ⇒ id del site  **user_id**  ⇒ id del user a consultar  **service_id**  ⇒ id del service a consultar |

**Llamada:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/delivery-ranges/v1
```

**Ejemplo:**

```

{
    "delivery_window": "same_day",
    "delivery_ranges": {
        "week": [
            {
                "capacity": 30,
                "from": 11,
                "to": 20,
                "cutoff": 14
            }
        ],
        "saturday": [
            {
                "capacity": 30,
                "from": 11,
                "to": 20,
                "cutoff": 14
            }
        ],
        "sunday": [
            {
                "capacity": 30,
                "from": 11,
                "to": 20,
                "cutoff": 14
            }
        ]
    }
}
```

**Consideraciones**

- **Presencia de horario de corte por zona:**  Si el endpoint tiene definido un horario de corte por zona, no se debe incluir el parámetro de **cutoff**  en la solicitud. Si se intenta enviar este parámetro en este caso, se generará una respuesta con un código de error **400 (Bad Request)** .

- **Ausencia de horario de corte por zona:**  Si no se ha definido un horario de corte por zona, es opcional enviar el parámetro de **cutoff** . Esto significa que puedes decidir si incluirlo o no en la solicitud, dependiendo de la lógica de negocio que desees implementar.

- **Actualizar Delivery Window:**  En caso de querer actualizar el **delivery_window** , se sigue la misma lógica que en los puntos anteriores.  **Delivery Window:**   En caso de tener **delivery_window**  seteado en **"next_day"** , el envío del cutoff es indistinto ya que el mismo será ignorado por que se crea la oferta para el [día](https://developers.mercadolibre.com.ar/AGREGAR_LINK) siguiente. En caso de tener **delivery_window**  seteado en **"same_day"** , el envío del cutoff es indispensable.   **Horario de corte por Zona:**   Si el horario de corte está activado, no se debe enviar el parámetro de **cutoff**  y el nuevo delivery window se actualizará correctamente. Si no tiene activado el horario de corte, se debe incluir el parámetro de **cutoff**  en la solicitud. Este endpoint no permite configurar, modificar ni eliminar rangos extendidos de entrega. Si la configuración actual tiene un rango extendido activo, la actualización completa será rechazada.

Nota:

Horario de corte por zona es una funcionalidad disponible para el modo FLEX en la cual el usuario puede diferenciar el horario de corte de ventas en el día para cada zona. Esta funcionalidad tiene que ser activada o desactivada por el usuario.

- En caso de que esté desactivada el horario de corte para todas las zonas se modificará mediante la actualización de rangos de entrega

**Códigos de estado de respuesta:**

- **204 No Content** : Actualización exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **422 Unprocessable Content** : la solicitud es válida, pero no puede procesarse porque la configuración tiene un rango extendido de entrega activo.

- **500 Internal Server Error** : Error al obtener la configuración.

## Consultar si la categoría permite Flex

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLB438794/shipping_preferences
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLB438794/shipping_preferences
```

**Respuesta:**

```
{
  ...
  "logistics": [
    ...
    {
      "types": [
        "drop_off",
        "xd_drop_off",
        "self_service",
        "cross_docking",
        "fulfillment"
      ],
      "mode": "me2"
    }
  ],
  ...
  "category_id": "MLB438794"
}
```

**Nota:**  Para saber que la categoría permite Flex, debe estar presente la opción **self_service** , dentro del array **logistics** .

Importante:

- La activación de esta funcionalidad se dará de manera progresiva y puede aplicarse de manera diferenciada por dominio y por país.

- Los vendedores serán informados a través de “Notificaciones”, permitiéndoles decidir si desean optar por el servicio Flex para los ítems que tenga en dichos dominios.

## Consultar Flex en el ítem

Este endpoint te permite consultar si el ítem actualmente se está ofreciendo con Envíos Flex o no.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/$SITE_ID/items/$ITEM_ID/v2
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/MLB/items/MLB1493119403/v2
```

**Respuesta:**

```
{"has_flex": true/false}
```

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Ítem existe y devuelve la info. | - |
| 400 - Bad Request | Algún dato recebido es inválido | - | - |
| 401 - Unauthorized | Autorización invalida | - | Revisar permisos de scope |
| 403 - Forbidden | Autenticación invalida | Access_token incorrecto | Revise el access_token utilizado |
| 404 - Not Found | El ítem no existe o no se encuentra | - | -. |
| 500 - Internal Server Error | Error interno inesperado/no controlado | - | - |

Nota:

- El endpoint items ofrece información relevante sobre el ítem, como:

- El atributo tags que brinda detalles adicionales sobre si el ítem tiene activo Envíos Flex (self_service_in) o no (self_service_out).

## Activar Flex en el ítem

Este endpoint permite activar la opción de Envíos Flex al ítem.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/$SITE_ID/items/$ITEM_ID/v2
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/MLB/items/MLB1493119403/v2
```

**Respuesta:**

```
Status: 204 No Content
```

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 204 - No Content | - | Ítem habilitado para Envíos Flex. | - |
| 400 - Bad request | item is already in flex | Ítem ya tiene Flex activado | Validar que el item tiene Flex previo a la petición |
| 403 - Forbidden | item down | Ítem no ofrece Envíos Flex. | Validar las modalidades de envío del ítem. |
| 404 - Not Found | item not found | El país está deshabilitado para Envíos Flex. | Validar los países con Envíos Flex. |
| 409 - Conflict | can't activate item | Conflicto interno al intentar modificar el estado del Ítem | Evitar enviar múltiples solicitudes de actualización para el mismo ítem al mismo tiempo. |

## Desactivar Flex en el ítem

Este endpoint permite desactivar la opción de Envíos Flex al ítem.

**Llamada:**

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/$SITE_ID/items/$ITEM_ID/v2
```

**Ejemplo:**

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/MLB/items/MLB1493119403/v2
```

**Respuesta:**

```
Status: 204 No Content
```

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 204 - No Content | - | Ítem desactivado para envíos Flex. | - |
| 403 - Forbidden | item down | Ítem no ofrece Envíos Flex. | Validar las modalidades de envío del ítem. |
| 404 - Not Found | item not found | El país está deshabilitado para Envíos Flex. | Validar los países con Envíos Flex. |
| 409 - Conflict | can't activate item | Conflicto interno al intentar modificar el estado del Ítem | Evitar enviar múltiples solicitudes de actualización para el mismo ítem al mismo tiempo. |

Nota:

- Recuerda que la activación o desactivación de un ítem en Flex debe ser realizada exclusivamente por el vendedor. Para gestionar estos cambios, el vendedor debe usar los anteriores endpoints o cancelar su suscripción a la logística Flex.

- Es importante evitar procesos automáticos de activación, ya que pueden interferir con el flujo operativo. La selección de los ítems a activar en Flex debe ser una decisión deliberada del vendedor, garantizando así que los procesos se mantengan controlados y eficientes.

## Registrar envíos para mensajería

Este endpoint permite que las mensajerías envíen los shipments que gestionan, para que luego sean procesados y posicionados según su performance, obteniendo así mayor visibilidad para ser seleccionados por un seller.

**Importante:**  Antes de usar este endpoint:

La **mensajería debe haber vinculado su cuenta con la app integradora**  mediante el flujo OAuth. El `access_token` y el `user_id` de MercadoLibre de la mensajería (su cuenta de negocio) se obtendrán como resultado de este flujo. El `access_token` resultante es el que debés usar en el header para las llamadas. Sin esta vinculación, todas las llamadas recibirán un error 403. Ver [Autenticación y Autorización](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion).

### Llamada

### Endpoint

```
POST https://api.mercadolibre.com/flex/sites/{SITE_ID}/users/{COURIER_USER_ID}/courier-shipment/v1
```

### Path Parameters

| **Parámetro** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `SITE_ID` | string | Sí | Identificador del site. Ejemplo: `MLA` para Argentina. |
| `COURIER_USER_ID` | string | Sí | User ID de la **cuenta de negocio de la mensajería**  registrada en Mercado Libre. |

### Headers

| **Nombre** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `Authorization` | string | Sí | Token de acceso en formato `Bearer {ACCESS_TOKEN}`. |

### Body (JSON)

```
{
  "shipment_id": {SHIPMENT_ID}
}
```

| **Campo** | **Tipo** | **Requerido** | **Descripción** |
| --- | --- | --- | --- |
| `SHIPMENT_ID` | number | Sí | ID del envío que la mensajería está gestionando. |

Nota:

Este endpoint de registro de envíos para mensajería de Flex permite hasta 500 peticiones por minuto (RPM) por aplicación (`client_id`). Cuando la aplicación alcanza este límite, el endpoint responde con `429 Too Many Requests`. Cada aplicación tiene una cuota independiente, por lo que el tráfico de una aplicación no consume la cuota de las demás.

## Ejemplo

```
curl -X POST \
-H 'Authorization: Bearer APP_USR-1234567890-...' \
https://api.mercadolibre.com/flex/sites/MLA/users/1444885522/courier-shipment/v1 \
-d '{"shipment_id": 123456786}'
```

**Respuesta exitosa:**

```
204 - No Content
```

## ¿Cómo funciona la integración?

El flujo de integración involucra tres actores principales: la **Mensajería** , el **Desarrollador**  y la **Aplicación Integradora** . La mensajería se registra mediante un formulario, vincula su cuenta vía OAuth 2.0, y el desarrollador crea la app integradora que envía los shipments a la API de MercadoLibre usando el access token de la mensajería.

## Consideraciones

El envío debe ser informado **en el momento en que la mensajería comienza a gestionarlo** . Las peticiones con envíos ya finalizados serán rechazadas.

Los siguientes estados son considerados finalizados y no serán aceptados:

- `delivered`

- `cancelled`

- `not_delivered`

- `shipped` & `delivery_blocked`

- `shipped` & `waiting_for_confirmation`

#### Códigos de respuesta

| **Código** | **Mensaje** | **Descripción** | **Recomendación** |
| --- | --- | --- | --- |
| `204 - No Content` | - | Registro exitoso. | - |
| `400 - Bad Request` | Parámetro inválido | - | - |
| `401 - Unauthorized` | Autorización inválida | - | Revisar permisos de scope. |
| `403 - Forbidden` | Autenticación inválida | `access_token` incorrecto. | Revise el `access_token` utilizado. |
| `404 - Not Found` | No se encontró el shipment | - | - |
| `409 - Conflict` | conflicto de envío de courier | Envío ya asignado a una mensajeria | Verificar si el shipment ya fue procesado antes de reintentar |
| `500 - Internal Server Error` | Error interno inesperado/no controlado | - | - |

## Identificar el código del transportista

Este endpoint facilita la identificación del transportista asignado a un envío, lo que resulta útil para registrar cambios de transportista durante el proceso de entrega.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/$SITE_ID/shipments/$SHIPMENT_ID/assignment/v2
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/MLA/shipments/40070866801/assignment/v2
```

**Respuesta:**

```
{
    "driver_id": 1234
}
```

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Transportista asignado. | - |
| 400 - Bad Request | Parametro inválido | - | - |
| 401 - Unauthorized | Autorización invalida | - | Revisar permisos de scope |
| 403 - Forbidden | Autenticación invalida | Access_token incorrecto | Revise el access_token utilizado |
| 404 - Not Found | shipment_id not found | No posee transportista asignado o no se encuentra la ruta abierta (envío pendiente de ser entregado). No existe (shipment inexistente). | Validar el estado del envío o `shipment_id`. |
| 500 - Internal Server Error | Error interno inesperado/no controlado | - | - |

Nota:

- Para Argentina, en caso que las colectas sean realizadas fuera de la dirección del vendedor, el driver tendrá que ingresar el token alfanumérico válido que le podrá proporcionar el vendedor. Para ubicar el código el vendedor debe acceder a la página de Mercado Libre del usuario> Configuración> Preferencias de venta > Código de autorización.

- Conoce más sobre [¿Cuándo usar el código de autorización en mis colectas de Mercado Libre o Envíos Flex?](https://www.mercadolibre.com.ar/ayuda/29904)

- Para recibir notificaciones cuando se realicen transferencias de paquetes entre transportistas y cuando lo escanee por primera vez, se puede [suscribir a la notificación flex handshakes](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones).

## Estados y subestados Flex

Este endpoint permite conocer los estados y subestados del flujo de envíos Flex.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/$SHIPMENT_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/43319685225
```

**Respuesta:**

```
{
    ...
      "comments": null,
      "substatus": "receiver_absent",
      "date_created": "2024-04-23T10:48:51.245-04:00",
      "date_first_printed": "2024-04-23T13:14:16.093-04:00",
    ...
     "status": "shipped",
        }
```

**Parámetros de respuesta:**

- **status** : El estado general del paquete. Los valores posibles son:  **delivered** : paquetes entregados. **ready_to_ship** : paquetes listos para despachar. **cancelled** : paquetes cancelados. **not_delivered** : paquetes rechazados o que no será posible entregarlos. Dentro de este status tenemos los siguientes substatus posibles:  Rechazado por el comprador.  **refused_delivery** : El comprador ha rechazado la entrega.     **shipped** : paquetes que están en camino al comprador.  **Salida a ruta** : El pedido está en camino.  **out_for_delivery** : El paquete está en camino para ser entregado. **soon_deliver** : El conductor ha notificado al comprador que su paquete es el próximo en la ruta de entrega.   Domicilio incorrecto o incompleto.  **bad_address** : El conductor ha registrado que la dirección proporcionada es incorrecta.   **No hay nadie en el domicilio.**   **receiver_absent** : El conductor ha marcado que el comprador estaba ausente en el momento de la entrega.   El comprador decide reprogramar la compra desde su aplicación.  **buyer_rescheduled** : El comprador ha solicitado reprogramar la entrega.   El conductor marcó como entregado lejos de la dirección del comprador.  **delivery_blocked** : El conductor ha indicado que el paquete se entregó, pero lejos de la dirección del comprador. Se solicita al comprador que confirme si recibió el envío.   El vendedor marca como entregado el envío desde su aplicación.  **waiting_for_confirmation** : El paquete ha sido marcado como entregado por el vendedor después de la fecha prometida. Se solicita al comprador que confirme si recibió el envío.

## Convivencia Full y Flex

Para gestionar stock de Flex cuando el vendedor tiene Fulfillment activo en su publicación, disponibilizamos la funcionalidad de stock distribuído.

Consulte la documentación para entender el funcionamiento: [Convivencia Full y Flex](https://developers.mercadolibre.com.ar/es_ar/convivencia-full-y-flex)

## Items no enviables por ME2 (Items en ME1, custom o not_specified)

Productos en categorías que no son enviados por Mercado Envíos (ME2) en otras modalidades logísticas (drop_off, crossdocking, fulfillment) por sus particularidades, ahora pueden ser enviados por Envíos Flex específicamente.

Son productos considerados no enviables los que poseen la siguiente característica:

- **Inflamable:**  Productos con riesgo de inflamación.

- **Pack 4 Neumáticos:**  Paquetes que contienen cuatro neumáticos.

- **No Maquinable:**  Ítems que no pueden ser procesados por máquinas.

- **Hazmat:**  Materiales peligrosos.

Para activar el Flex en el producto del vendedor, valide que la categoría ahora permite la opción self_service (Flex), como ya se realiza para los demás envíos.

**Categoría ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA45502/shipping_preferences
```

**Respuesta:**

```
{
...
"logistics": [
    ...
    {
        "types": [
            "self_service"
        ],
        "mode": "me2"
    }
],
...
"category_id": "MLA45502"
}
```

Después de esto, para activar el Flex no es necesario modificar el shipping.mode del ítem, sino que solo ejecutar el optin de Flex conforme a la  instrucción de Activar Flex.

Nota:

Realizando esta operación, el ítem es modificado automáticamente para ME2. Eso significa que el item dejará de ser ME1, custom o not_specified.

### Vista del vendedor:

**Próximo:** [Envios Turbo](https://developers.mercadolibre.com.ar/es_ar/envios-turbo)
