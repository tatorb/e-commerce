<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/envios-turbo -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Envíos Turbo

Última actualización 11/02/2026

## Envíos Turbo

Importante:

Este tipo de logisitica se encuentra disponible solo para vendedores de Argentina - AMBA y para vendedores de Brasil - São Paulo

Envíos Turbo es un servicio de entregas que se enfoca en proporcionar envíos rápidos en menos de 3 horas. Está diseñado para atender en un radio cercano al vendedor y se basa en el modelo logístico de Flex. Este servicio tiene como objetivo ofrecer una opción de entrega extremadamente rápida, lo que puede ser especialmente útil para brindar un servicio de alta calidad a los usuarios.

Encuentra más información relacionada con Turbo en los siguientes enlaces:

- [Envíos Flex](https://developers.mercadolibre.com.ar/es_ar/envios-flex)

- [Cómo calculan los tiempos de entrega con Envíos Turbo](https://www.mercadolibre.com.ar/ayuda/29935)

- [Preguntas frecuentes sobre Envíos Turbo](https://www.mercadolibre.com.ar/ayuda/30924)

- [Llevá tus ventas a un nuevo nivel con Envíos Turbo](https://vendedores.mercadolibre.com.ar/nota/lleva-tus-ventas-a-un-nuevo-nivel-con-envios-turbo)

- [Primeros pasos con Envíos Turbo](https://vendedores.mercadolibre.com.ar/guia/primeros-pasos-con-envios-turbo?siteId=MLA&locale=es-ar)

Nota:

- Es fundamental respetar el límite de 1000 rpm en todas las llamadas a los recursos de Flex y Turbo, dado que es compartido entre estos 2 tipos de envío. Mantener este límite garantiza un uso eficiente y equitativo de los recursos disponibles.
 - La app de envíos Flex de Mercado Libre es necesaria para escanear las entregas y hacer los recorridos de entregas. Sin embargo, no está disponible para integraciones, por lo que las empresas logísticas deberán adaptarse.

## Áreas de cobertura por países

Para poder ofrecer Envíos Turbo, la dirección de envío del vendedor debe estar habilitada para alguna de las áreas de cobertura según el país:

| País | Cobertura |
| --- | --- |
| Argentina | AMBA (Área Metropolitana de Buenos Aires) |
| Brasil | São Paulo |
| Chile | Santiago |

## Configurar un usuario de test

Para configurar la funcionalidad de Envíos Turbo para usuarios de prueba, tomar en cuenta:

1. Inicie sesión en la cuenta en la que desea habilitar Envío Turbo.
 2. Valide que el usuario ya tenga activo Envíos Flex dado que es un requisito previo.
 3. Asegúrese de que la cuenta tenga publicaciones activas en ME2.
 4. Verifique que su cuenta tenga una reputación Amarilla o Verde.
 5. Asegúrese de tener una dirección de correo compatible con el área de cobertura de su país.
 6. Configure la dirección de envío en AMBA.
 7. Active Envíos Turbo a la cuenta, dirigiéndose a “Mi Perfil” > “Ventas” > “Preferencias de Venta”.
 8. Una vez que haya completado estos pasos, debería poder utilizar Envíos Turbo como usuario de prueba.

## Consultar suscripciones de un usuario

Este endpoint permite consultar las suscripciones de un usuario, quien puede tener múltiples suscripciones configurables que corresponden a diferentes orígenes, incluso si todas pertenecen al mismo modo. (flex/turbo).

- Si el usuario activa ambos servicios, Flex y Turbo, tendrá dos suscripciones, **ya que Flex es un requisito para acceder a Turbo** .

Nota:

- Se crea una suscripción cuando un vendedor comienza a utilizar Envíos Flex en cualquier modalidad. 
 - En el contexto de las suscripciones, cada una de ellas cuenta con un **identificador único llamado service_id** . Este identificador es fundamental para poder **acceder a la configuración de la suscripción y realizar cambios en ella** . Para este caso, el que se utilizará será el **service_id de la modalidad Turbo** .

### Parámetros

| Tipo | Parámetro | Descripción |
| --- | --- | --- |
| Path Params | `site_id` | ID del site |
| Path Params | `user_id` | ID del usuario a consultar |

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/subscriptions/v1
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/flex/sites/MLA/users/1438865529/subscriptions/v1
```

Respuesta:

```
[
       {
        "site_id": "MLA",
        "user_id": 1438865529,
        "service_id": 738216,
        "mode": "TURBO",
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
                    "type": "radius",
                    "capabilities": {
                        "cutoff_by_zone": false
                    }
                },
                "delivery_ranges": "fixed",
                "holidays": false,
                "transit_times": false
            },
            "available": {
                "coverage": {
                    "type": [
                        "radius"
                    ],
                    "capabilities": {
                        "cutoff_by_zone": false
                    }
                }
            }
        }
    },
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
                    "type": "zone",
                    "capabilities": {
                        "cutoff_by_zone": false
                    }
                },
                "delivery_ranges": "dinamic"/"disabled",
                "holidays": true,
                "transit_times": false
            },
            "available": {
                "coverage": {
                    "type": [
                        "zone"
                    ],
                    "capabilities": {
                        "cutoff_by_zone": true
                    }
                }
            }
        }
    }
]
```

#### Parámetros de respuesta

- **Detalles de la Suscripción** :  **site_id** : Identificador del sitio (ej. "MLA"). **user_id** : Identificador del usuario propietario de la suscripción. **service_id** : Identificador del servicio al que está asociada la suscripción. **mode** : Modalidad de la suscripción, que puede ser "FLEX" o "TURBO". **status** : Estado actual de la suscripción (ej. "in").

- **Origen de la Suscripción (origin)** :  Información detallada de la dirección de origen. **address_line** : Dirección completa del origen. **id** : Identificador de la dirección de origen. **zip_code** : Código postal de la dirección. **city** :  **id** : Identificador de la ciudad. **name** : Nombre de la ciudad.

- **Configuración de la Suscripción (configuration)** :  Detalles de la configuración activa y las opciones disponibles. **Configuración Activa (set)** :  **coverage** : Configuración de la cobertura actual. **type** : Tipo de cobertura activa, puede ser "zone" o "radius". **capabilities** : Capacidades de la cobertura. **cutoff_by_zone** : Indica si la cobertura actual tiene horario de corte por zona. **delivery_ranges** : Tipo de rangos de entrega configurados: "dinamic", "fixed" o "disabled". **holidays** : Indica si la funcionalidad de feriados está habilitada. **transit_times** : Indica si los tiempos de tránsito están habilitados.   **Configuración Disponible (available)** :  **coverage** : Opciones de cobertura que el usuario puede configurar. **type** : Tipos de cobertura disponibles (ej. ["zone"]). **capabilities** : Capacidades de cobertura configurables. **cutoff_by_zone** : Indica si el corte por zona es una opción configurable.   **accurate_ranges** : rangos horarios disponibles para el servicio.  **from** : hora de inicio del rango. **to** : hora de fin del rango.

### Códigos de respuesta  **200 OK** : Consulta exitosa. **400 Bad Request** : Algún parámetro es inválido. **401 Unauthorized** : No tienes credenciales válidas. **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso. **404 Not Found** : No se encontró la configuración. **500 Internal Server Error** : Error al obtener la configuración.

## Consultar radio de cobertura

Este endpoint te permite recuperar información sobre la configuración del radio de cobertura para las entregas de un usuario.

### Parámetros

| Tipo | Parámetro | Descripción |
| --- | --- | --- |
| Path Params | `site_id` | ID del site |
| Path Params | `user_id` | ID del usuario a consultar |
| Path Params | `service_id` | ID del service a consultar |
| Query Params | `show_availables` | Boolean, para mostrar o no los disponibles |

#### Llamada

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/coverage/radius/v1?show_availables=boolean
```

#### Respuesta

```
{
    "radius": 5000,
    "availables": {
        "radius": {
            "min": 1000,
            "max": 8000
        }
    }
}
```

#### Parámetros de respuesta

- **radius** : configuración actual.

- **availables**  (Este objeto se incluye únicamente si el parámetro `show_availables=true` está presente en la consulta)  **availables** : valores de configuración disponibles. **radius min** : radio mínimo disponible. **radius max** : radio máximo disponible.

#### Códigos de respuesta

- **200 OK**  / **204 No Content** : Consulta exitosa

- **400 Bad Request** : Parámetro inválido

- **401 Unauthorized** : Credenciales inválidas

- **403 Forbidden** : Sin permisos

- **404 Not Found** : No se encontró la configuración

- **500 Internal Server Error** : Error interno

## Actualizar radio de cobertura

Este endpoint te permite actualizar información sobre la configuración del radio de cobertura para las entregas de un usuario.

### Parámetros

| Tipo | Parámetro | Descripción |
| --- | --- | --- |
| Path Params | `site_id` | ID del site |
| Path Params | `user_id` | ID del usuario a actualizar |
| Path Params | `service_id` | ID del service a actualizar |

#### Llamada

```
  curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/coverage/radius/v1
```

#### Ejemplo del request body

```
{
    "radius": 5000
}
```

#### Códigos de respuesta

- **200 OK** : Actualización exitosa.

- **400 Bad Request** : Algún parámetro es inválido.

- **401 Unauthorized** : No tienes credenciales válidas.

- **403 Forbidden** : No tienes permisos suficientes para acceder a este recurso.

- **404 Not Found** : No se encontró la configuración.

- **500 Internal Server Error** : Error al actualizar la configuración.

## Consultar rangos de entrega

Este endpoint te permite recuperar información sobre los rangos de entrega de un usuario.

### Parámetros

| Tipo | Parámetro | Descripción |
| --- | --- | --- |
| Path Params | `site_id` | ID del site |
| Path Params | `user_id` | ID del usuario a consultar |
| Path Params | `service_id` | ID del service a consultar |
| Query Params | `show_availables` | Boolean, para mostrar o no los disponibles |

#### Llamada

```
  curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/delivery-ranges/v1?show_availables=boolean
```

#### Respuesta

```
  {
    "delivery_window": "same_day",
    "delivery_ranges": {
        "week": [
            {
                "capacity": 10,
                "from": 10,
                "to": 12,
                "cutoff": 10
            },
            {
                "capacity": 10,
                "from": 11,
                "to": 13,
                "cutoff": 11
            },
            {
                "capacity": 10,
                "from": 12,
                "to": 14,
                "cutoff": 12
            }
        ]
    },
    "availables": {
        "capacity": {
            "min": 1,
            "max": 50
        },
        "delivery_ranges": {
            "type": "fixed",
            "ranges": {
                "7": [
                    {
                        "from": 10,
                        "to": 12
                    },
                    {
                        "from": 11,
                        "to": 13
                    },
                    {
                        "from": 12,
                        "to": 14
                    },
                    {
                        "from": 13,
                        "to": 15
                    },
                    {
                        "from": 14,
                        "to": 16
                    },
                    {
                        "from": 15,
                        "to": 17
                    },
                    {
                        "from": 16,
                        "to": 18
                    }
                ]
            },
            "min_range_quantity": 3,
            "max_range_quantity": 7
        },
        "delivery_windows": [
            "same_day"
        ],
        "working_days": [
            "week"
        ]
    }
}
```

#### Parámetros de respuesta

- **delivery_window** : ventana de entrega configurada actualmente.

- **delivery_ranges** : rangos de entrega configurados según el día:  **capacity** : capacidad máxima de envíos en cada rango. **from** : hora de inicio del rango de entrega. **to** : hora de fin del rango de entrega. **cutoff** : hora límite para ingresar pedidos en ese rango.

- **availables**  (Este objeto se incluye únicamente si el parámetro `show_availables=true` está presente en la consulta)  **capacity min** : capacidad mínima disponible para configurar (según flavour). **capacity max** : capacidad máxima disponible para configurar (según flavour). **delivery_ranges type** : tipo de rango de entrega disponible. **delivery_ranges ranges from** : hora de inicio de entregas. **delivery_ranges ranges to** : hora de fin del rango de entregas. **delivery_ranges min_range_quantity** : cantidad mínima de rangos de entrega por día. **delivery_ranges max_range_quantity** : cantidad máxima de rangos de entrega por día. **delivery_windows** : ventanas de entrega disponibles. **working_days** : días hábiles disponibles para operar.

Nota:

- A diferencia de la configuración de Rangos Horarios de Entrega de Flex, los envíos Turbo tienen varios Rangos Horarios. Estos rangos de horario definen una ventana de entrega en la cual el vendedor debe realizar los envíos asociados a ventas en la hora previa.

- Los valores de **From y To**  que definen cada rango son fijos y deben tomarse de la respuesta del servicio que devuelve la configuración de Turbo del vendedor en el atributo configuration.accurate_ranges (no se pueden definir rangos custom). En este caso los Rangos Horarios de Entrega solo están disponibles de Lunes a Viernes.

- Por ejemplo: si el Rango Horario es de 12:00 a 14:00, significa que para las ventas realizadas entre las 11:00 y las 12:00 el vendedor debe entregar el paquete entre las 12:00 y las 14:00, pudiendo así pasar un máximo de 3 horas entre la venta y la entrega.

- Para garantizar la precisión de la información sobre la capacidad de entrega, incluso si se modifica la capacidad de un solo rango de entrega, es necesario enviar todos los rangos de entrega activos junto con su capacidad. De lo contrario, se asumirá que los rangos no enviados no están activos.

#### Códigos de respuesta

- **200 OK**  / **204 No Content** : Consulta exitosa

- **400 Bad Request** : Parámetro inválido

- **401 Unauthorized** : Credenciales inválidas

- **403 Forbidden** : Sin permisos

- **404 Not Found** : No se encontró la configuración

- **500 Internal Server Error** : Error interno

## Actualizar rangos de entrega

Este endpoint te permite actualizar la configuración de rangos de entrega para un vendedor.

### Parámetros

| Tipo | Parámetro | Descripción |
| --- | --- | --- |
| Path Params | `site_id` | ID del site |
| Path Params | `user_id` | ID del usuario a actualizar |
| Path Params | `service_id` | ID del service a actualizar |

#### Llamada

```
  curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/flex/sites/$SITE_ID/users/$USER_ID/services/$SERVICE_ID/configurations/delivery-ranges/v1
```

#### Ejemplo del request body

```
  {
    "delivery_window": "same_day",
    "delivery_ranges": {
        "week": [
            {
                "capacity": 10,
                "from": 10,
                "to": 12
            },
            {
                "capacity": 10,
                "from": 11,
                "to": 13
            },
            {
                "capacity": 10,
                "from": 12,
                "to": 14
            },
            {
                "capacity": 10,
                "from": 13,
                "to": 15
            }
        ]
    }
}
```

#### Consideraciones

Si bien el campo **cutoff**  se visualiza en el endpoint de lectura, para actualizar no es necesario enviarlo ya que será omitido. Turbo calcula este valor automáticamente.

Importante:

Los valores de **From y To**  que definen cada rango son fijos y deben tomarse de la respuesta del servicio que devuelve la configuración de Turbo del vendedor en el atributo configuration.accurate_ranges (no se pueden definir rangos custom).

#### Códigos de respuesta

- **200 OK**  / **204 No Content** : Operación exitosa

- **400 Bad Request** : Parámetro inválido

- **401 Unauthorized** : Credenciales inválidas

- **403 Forbidden** : Sin permisos

- **404 Not Found** : Recurso no encontrado

- **500 Internal Server Error** : Error interno

## Identificar órdenes Turbo

Este endpoint determina si un envío se manejará mediante el servicio Turbo, permitiendo concluir la transacción de manera efectiva.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/$SHIPMENT_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipments/42469883906
```

Respuesta:

```
"tags": [
        "turbo"
    ]
```

Nota:

- Es importante aclarar que **Turbo no es un tipo de logística en sí mismo** . Esto significa que cuando estés interactuando con nuestros endpoints, el **atributo logistic_type seguirá devolviendo el valor de self_service**  y **no Turbo.** 
 - Asimismo, se podrá encontrar esta misma diferencia en las tags de:
 - [https://api.mercadolibre.com/users/$USER_ID/shipping_preferences](https://api.mercadolibre.com/users/$USER_ID/shipping_preferences)
 - [https://api.mercadolibre.com/orders/$ORDER_ID/shipments](https://api.mercadolibre.com/orders/$ORDER_ID/shipments)

## Gestión de Ítems Turbo

La gestión de ítems en Turbo implica la activación de Turbo para dichos ítems. A fin de lograrlo, es crucial considerar lo siguiente:

1. Antes de activar Turbo, es necesario habilitar Flex. 
 2. Los ítems que cuentan con Flex activo se ofrecerán por Turbo siempre que cumplan con las restricciones de dimensiones y peso de Envíos Turbo.
 3. La activación es automática una vez que se han cumplido los requisitos previos.

Importante:

Antes de publicar o editar un ítem utilizando en Turbo, es importante tener en cuenta los siguientes aspectos:

1. Verificar que el vendedor ya tenga activo

[el tipo de logística Flex](https://developers.mercadolibre.ar/es_ar/envios-flex)

.

2. Verificar que el ítem tenga

[activo Flex](https://developers.mercadolibre.ar/es_ar/envios-flex)

.

3. Verificar que el ítem cumpla con las dimensiones establecidas:

- Alto: 70 cm

- Ancho: 70 cm

- Largo: 70 cm

- Peso: 30000 gr = 30 kg

4. Tener en cuenta que si un ítem cumple estos requisitos, la activación es automática, es decir, Turbo aparecerá de manera inmediata en la publicación.

5. Si no se desea ofrecer el ítem con Turbo, se recomienda desactivarlo o eliminarlo de Flex.

Estos pasos asegurarán una gestión adecuada de los ítems en Mercado Libre y ayudarán a ofrecer la mejor experiencia de compra para los usuarios.
