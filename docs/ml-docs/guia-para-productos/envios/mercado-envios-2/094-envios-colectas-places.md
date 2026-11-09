<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/envios-colectas-places -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Envíos Colecta y Places

Última actualización 25/09/2026

# Envíos Colecta y Places

**Importante:**

- Actualmente, estas modalidades de envío están disponibles para vendedores de Argentina, Brasil, México, Chile, Colombia, Uruguay.

- A partir de Agosto de 2025, los vendedores de Brasil contarán con un servicio nuevo que se llamará Colecta rápida. Estos envíos se podrán identificar a traves del recurso de [SLA](https://developers.mercadolibre.com.ar/es_ar/envios#Plazo-m%C3%A1ximo-de-despacho-(SLA)).

**Colecta regular (cross_docking):**

- Proceso: Un carrier recoge los productos del domicilio del vendedor y los lleva a un HUB (almacén).

- Entrega: Desde el HUB, se elige el carrier más conveniente para la entrega al comprador.

- Ruta: Vendedor → Colecta → HUB → Carrier → Comprador.

**Colecta rápida (xd_same_day):**

La colecta rapida es un nuevo método de envíos (por ahora disponible solo en Brasil) que consistirá en una colecta en el domicilio del vendedor, y una entrega al comprador en el día realizados por Mercadolibre. Las ventas pre horario de corte, serán colectadas y entregadas en el día, mientras que las ventas post horario de corte, serán colectadas al otro día y entregadas al comprador.

- Proceso: Un carrier recoge los productos del domicilio del vendedor y los lleva a un HUB (almacén).

- Entrega: Desde el HUB, se elige el carrier más conveniente para la entrega al comprador.

- Ruta: Vendedor → Colecta → HUB → Carrier → Comprador.

Nota:

La hora de corte para la colecta rápida se determina restando una hora a la hora de inicio de la colecta (From). Es decir: 
 **Hora de inicio de colecta (From) - 1 hora (PT) = Horario de corte para colecta rápida**.****

**Cross Docking con Drop Off (XD_drop_off):**

- Proceso: El vendedor deja los productos en un punto de recolección designado (places). Places o puntos de despacho son tiendas comerciales que también llevan el logo de Mercado Libre, Pickit o HOP en la puerta.

- Recolección y Entrega: Una colecta los transporta desde el Place al HUB para su entrega final.

- Ruta: Vendedor → Place → Colecta → HUB → Carrier → Comprador.

**Drop_off:**

- Proceso: El vendedor lleva los productos directamente a la oficina de correos o punto de entrega asignado. Los paquetes siguen el flujo propio del correo hasta que se entregan al comprador.

- Recolección y Entrega: Se selecciona al carrier para su entrega final.

- Ruta: Vendedor → Carrier → Comprador.

**Activar Colecta o Places**

En Mercado Libre, evaluamos semanalmente el rendimiento en la entrega de productos de los vendedores de Colectas y Places. Esta evaluación puede influir en la activación de estos servicios según el desempeño.

Puntos clave de la activación:

- Revisión y Configuración de Domicilios: asegura que las direcciones para envíos, despachos y devoluciones estén siempre actualizadas y configuradas correctamente para evitar problemas.

- Activación de Notificaciones: mantén tus notificaciones activas, esto te permitirá recibir alertas inmediatas sobre cualquier cambio en los servicios de Colecta o Places.

El monitoreo constante de tu desempeño y la correcta configuración de tus direcciones son esenciales para asegurar una operación fluida y sin interrupciones en la logística de tus productos.

Nota:

- Para ubicar las configuraciones de Colecta y Places, se debe acceder a la página de Mercado Libre del usuario> Configuración> Preferencias de venta.

- Perú solo cuenta con el tipo de logística de drop off activo.

## Configurar un usuario de test

Para configurar la modalidad de envío colecta para usuarios de prueba, sigue estos pasos:

1. Iniciar sesión en la página de Developers de Mercado Libre.

2. Seleccionar la categoría a consultar, en este caso: "Configuraciones de test".

3. Desplegar la sección de "Configuración" y elija "Colecta".

4. Completar la información requerida sobre el usuario de prueba.

5. Enviar solicitud de activación de Colecta para su cuenta de usuario de prueba.

| País | Enlace |
| --- | --- |
| Argentina | [Solicitud para activar Colecta a cuenta test](https://developers.mercadolibre.com.ar/support) |
| Brasil | [Solicitud para activar Colecta a cuenta test](https://developers.mercadolivre.com.br/support) |
| México | [Solicitud para activar Colecta a cuenta test](https://developers.mercadolibre.com.mx/support) |
| Chile | [Solicitud para activar Colecta a cuenta test](https://developers.mercadolibre.cl/support) |
| Colombia | [Solicitud para activar Colecta a cuenta test](https://developers.mercadolibre.com.co/support) |
| Uruguay | [Solicitud para activar Colecta a cuenta test](https://developers.mercadolibre.com.uy/support) |
| Perú | [Solicitud para activar Colecta a cuenta test](https://developers.mercadolibre.com.pe/support) |

## Capacidad de envíos

La gestión de capacidad de envíos es una herramienta que permite a los vendedores configurar la cantidad máxima de envíos que pueden despachar en un día sin sufrir demoras. Esto les brinda la flexibilidad de organizarse y evitar retrasos, ya sea frente a cambios planificados en su volumen de ventas o situaciones inesperadas.

**Conoce más sobre:**

- [Qué es mi capacidad de envíos y para qué me sirve](https://www.mercadolibre.com.ar/ayuda/28907907)

- [Qué pasa cuando supero mi capacidad](https://www.mercadolibre.com.ar/ayuda/28908)

- [Hasta cuándo puedo modificarla](https://www.mercadolibre.com.ar/ayuda/28909)

- [Cómo la modifico si tengo más de una colecta en el día](https://www.mercadolibre.com.ar/ayuda/28910)

- [Qué es mi capacidad mínima](https://www.mercadolibre.com.ar/ayuda/28911)

### Vista del vendedor:

## Consultar la capacidad de envíos

Este endpoint permite obtener la configuración actual de la capacidad de envío de un usuario.

**Importante:**

Caso el vendedor tenga la configuración de [Multi Origen](https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen#Gestion-de-vendedores) (tag 'warehouse_management' en /users) activado en su cuenta, debes realizar las requisiciones por NODE_ID en vez de USER_ID.

### Consulta por USER_ID

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/capacity_middleend/$LOGISTIC_TYPE
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/123456789/capacity_middleend/cross_docking
```

**Respuesta:**

```
{
   "peak_season_mode": {
       "start_date": "2025-09-30",
       "end_date": "2025-10-10"
   }
   "capacities": [
       {
           "day": "monday",
           "capacity_min": 40,
           "capacity_max": 50,
           "capacity": {
               "value": 45,
               "maximum": false,
               "source": "seller"
           },
           "can_add_capacity": true,
           "can_subtract_capacity": true,
           "intervention": ""
       },
       ...
       {
           "day": "saturday",
           "capacity_min": 40,
           "capacity_max": 50,
           "capacity": {
               "value": 45,
               "maximum": false,
               "source": "seller"
           },
           "can_add_capacity": true,
           "can_subtract_capacity": true,
           "intervention": ""
       }
   ]
}
```

### Consulta por NODE_ID

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/nodes/$NODE_ID/capacity_middleend
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/nodes/MXP20214899242/capacity_middleend
```

**Respuesta:**

```
{
   "peak_season_mode": null,
   "capacities": [
       {
           "day": "monday",
           "capacity_min": 5,
           "capacity_max": 200,
           "capacity": {
               "value": 100,
               "maximum": false,
               "source": "seller"
           },
           "can_add_capacity": true,
           "can_subtract_capacity": true,
           "intervention": ""
       },
       {
           "day": "tuesday",
           "capacity_min": 5,
           "capacity_max": 200,
           "capacity": {
               "value": 100,
               "maximum": false,
               "source": "seller"
           },
           "can_add_capacity": true,
           "can_subtract_capacity": true,
           "intervention": ""
       },
       {
           "day": "wednesday",
           "capacity_min": 5,
           "capacity_max": 200,
           "capacity": {
               "value": 100,
               "maximum": false,
               "source": "seller"
           },
           "can_add_capacity": true,
           "can_subtract_capacity": true,
           "intervention": ""
       },
       {
           "day": "thursday",
           "capacity_min": 5,
           "capacity_max": 200,
           "capacity": {
               "value": 100,
               "maximum": false,
               "source": "seller"
           },
           "can_add_capacity": true,
           "can_subtract_capacity": true,
           "intervention": ""
       },
       {
           "day": "friday",
           "capacity_min": 5,
           "capacity_max": 200,
           "capacity": {
               "value": 100,
               "maximum": false,
               "source": "seller"
           },
           "can_add_capacity": true,
           "can_subtract_capacity": true,
           "intervention": ""
       }
   ]
}
```

**Parámetros de respuesta:**

- **peak_season_mode:**  En este objeto se indican la fecha de inicio y la fecha de fin en la que el vendedor tiene activo el modo 'temporada alta', donde podrá tener cambios sobre su capacidad de entrega.

- **day:**  Representa el día de la semana al que se refiere la capacidad. Los valores posibles son `monday`, `tuesday`, `wednesday`, `thursday`, `friday`, y `saturday`.

- **capacity_min:**  Es el valor mínimo de capacidad permitido para ese día.

- **capacity_max:**  Es el valor máximo de capacidad permitido para ese día.

- **capacity.value:**  Es el valor de la capacidad actual para el día y semana en la que se encuentra el usuario.

- **capacity.maximum:**  Deprecado. Indica si el usuario tiene la capacidad infinita (`true`). Será siempre `false`.

- **next_capacity.value:**  Es el valor de la capacidad configurada aplicable para la siguiente semana.

- **next_capacity.maximum:**  Deprecado. Indica si el usuario tiene capacidad infinita (`true`) para la siguiente semana. Será siempre `false` o `null`.

- **can_add_capacity:**  Indica si es posible agregar capacidad adicional para ese día. Los posibles valores son `true` o `false`.

- **can_subtract_capacity:**  Indica si es posible restar capacidad para ese día. Los posibles valores son `true` o `false`.

- **intervention:**  Describe el tipo de intervención en el que pueda incurrir el usuario:  `delay`: intervención por demoras. `early`: intervención por entregas tempranas. `null`: no tiene intervención.

### Restricciones de capacidad

- **Capacidad infinita no permitida:**  El campo **maximum**  ya no acepta el valor `true`. Debe ser siempre **false** .

- **Límite máximo:**  El **capacity.value**  debe ser menor o igual a **capacity_max** .

### Consideraciones

- Si no se configura la capacidad de despacho, el sistema no impondrá restricciones. Sin embargo, se recomienda a los vendedores que utilicen esta función para optimizar sus entregas y mejorar la experiencia del cliente.

- Cuando un vendedor no cumple con su objetivo de capacidad de envíos, entra en un estado de intervención por `delay`. Durante este período, hay restricciones en la capacidad de modificar o actualizar la capacidad de envíos. Esto se hace para garantizar que los vendedores se comprometan a mejorar su rendimiento. Una vez que se cumplan los requisitos durante el período de intervención, se levantarán las restricciones y podrás volver a ajustar tu capacidad de envíos.

- Cuando un vendedor puede despachar más de su capacidad, entrega en un estado de intervención por `early`. Durante este período, no hay restricciones en la capacidad de modificar o actualizar la capacidad de envíos, lo que se busca es que el vendedor pueda maximizar su inyección y configurar una capacidad más exacta.

- Para una experiencia óptima, te recomendamos habilitar las Novedades de vendedores, ya que es aquí donde se notificará cualquier actualización o cambio relevante en este proceso.

- Para el `peak_season_mode`, cuando vigente, el vendedor verá en su panel de preferencias de ventas el siguiente aviso:

## Actualizar la capacidad de envíos

**Importante:**

- No se permite capacidad infinita (sin máximo): El campo `maximum` debe ser siempre `false`. La opción de capacidad infinita ya no está disponible.
 - Respetar límite máximo: El `value` enviado debe ser menor o igual al `capacity_max` retornado en el GET, o será rechazada la actualización.
 - Caso el vendedor tenga la configuración de Multi Origen (tag `'warehouse_management'` en `/users`) activado en su cuenta, debes realizar las requisiciones por `NODE_ID` en vez de `USER_ID`.

Este endpoint permite modificar o actualizar la configuración de la capacidad de envío de un usuario.

### Actualización por USER_ID

**Llamada:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/$USER_ID/capacity_middleend/$LOGISTIC_TYPE
```

**Ejemplo:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/users/123456789/capacity_middleend/cross_docking

{
  "capacities": [
    {
      "day": "monday",
      "capacity": {
        "value": 120,
        "maximum": false
      }
    },
    {
      "day": "tuesday",
      "capacity": {
        "value": 120,
        "maximum": false
      }
    },
    {
      "day": "wednesday",
      "capacity": {
        "value": 120,
        "maximum": false
      }
    },
    {
      "day": "thursday",
      "capacity": {
        "value": 120,
        "maximum": false
      }
    },
    {
      "day": "friday",
      "capacity": {
        "value": 120,
        "maximum": false
      }
    },
    {
      "day": "saturday",
      "capacity": {
        "value": 120,
        "maximum": false
      }
    }
  ]
}
```

### Actualización por NODE_ID

**Llamada:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/nodes/$NETWORK_NODE_ID/capacity_middleend
```

**Ejemplo:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/nodes/MXP20214899242/capacity_middleend
```

Utiliza el mismo JSON de ejemplo en la requisición por `USER_ID`.

### Códigos de estado de respuesta

| **Código** | **Mensaje** | **Descripción** | **Recomendación** |
| --- | --- | --- | --- |
| `200 - OK` | - | Se obtuvo correctamente la configuración actual. | - |
| `400 - Bad Request` | there was an error parsing the request body | Error en los parámetros del request body. | Validar el request body. |
| `400 - Bad Request` | capacity value exceeds maximum allowed capacity | El valor supera `capacity_max`. | Consultar `capacity_max` en el GET y enviar un valor menor o igual a este. |
| `400 - Bad Request` | infinite capacity is not allowed | Se intentó usar `maximum: true`. | Enviar siempre `maximum: false`. |
| `404 - Not Found` | not valid logistic type | No existe el usuario o no tiene la logística de `cross_docking`. | Validar el `user_id` y los tipos de logística del usuario. |

## Tiempo de preparación de envíos

El tiempo de preparación de envíos es el tiempo para gestionar o despachar un pedido una vez procesado.

**Importante:**

El Tiempo de Preparación de Envíos se refiere al intervalo necesario para gestionar y despachar un pedido una vez que este ha sido procesado. Es importante no confundir este concepto con el Manufacturing Time, que denota el período requerido para fabricar o preparar el producto en sí.

Conoce más sobre:

- Preguntas frecuentes sobre el tiempo de preparación

- Para qué me sirve ajustarlo

- Hasta cuándo puedo modificarlo en el día

- Cómo lo modifico si tengo más de una colecta en el día

- Por qué hay días con menos opciones de tiempo de preparación

### Consultar el tiempo de preparación

**Importante:**

- Caso el vendedor tenga la configuración de Multi Origen (tag `'warehouse_management'` en `/users`) activado en su cuenta, debes realizar las requisiciones por `NODE_ID` en vez de `USER_ID`.
 - El parámetro `SERVICE_TYPE` en la URL reemplaza al antiguo `LOGISTIC_TYPE`. Actualmente el único valor soportado es `carrier_pickup`, que cubre tanto la logística Cross Docking como XD Drop Off.

Este endpoint permite obtener el tiempo de preparación para el envío.

### Consulta por USER_ID

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'X-Version: v3' \
https://api.mercadolibre.com/users/$USER_ID/service/$SERVICE_TYPE/processing_time_tool
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 'X-Version: v3' \
https://api.mercadolibre.com/users/123456789/service/carrier_pickup/processing_time_tool
```

**Respuesta:**

```
{
  "monday": {
    "modified_by_meli": false,
    "intervention_type": null,
    "visible": true,
    "enabled": true,
    "current_processing_time": null,
    "available_options": [
      {
        "processing_time": "00:30",
        "selected": false,
        "highlight_level": "low",
        "disabled": false
      },
      ...
      {
        "processing_time": "07:00",
        "selected": true,
        "highlight_level": "high",
        "disabled": false
      }
    ]
  }
}
```

### Consulta por NODE_ID

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/nodes/$NETWORK_NODE_ID/service/$SERVICE_TYPE/processing_time_tool
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
https://api.mercadolibre.com/nodes/MXP20157465171/service/carrier_pickup/processing_time_tool
```

**Respuesta:**

```
{
  "monday": {
    "modified_by_meli": false,
    "intervention_type": null,
    "visible": true,
    "available_options": [
      {
        "processing_time": "01:00",
        "selected": false,
        "highlight_level": "",
        "disabled": false
      },
      {
        "processing_time": "01:30",
        "selected": false,
        "highlight_level": "",
        "disabled": false
      },
      ...
    ]
  },
  "saturday": {
    "modified_by_meli": false,
    "intervention_type": null,
    "visible": false,
    "available_options": null,
    "enabled": false,
    "current_processing_time": null
  },
  "sunday": {
    "modified_by_meli": false,
    "intervention_type": null,
    "visible": false,
    "available_options": null,
    "enabled": false,
    "current_processing_time": null
  }
}
```

**Parámetros de respuesta:**

- **modified_by_meli:**  en caso de que venga `true` indica que Mercado Libre es el responsable de modificar su processing time.

- **intervention_type:**  indica si Mercado Libre ha intervenido el processing time del seller para ese día. Los valores posibles son `early` (se adelantó el tiempo), `delay_with_changes` (se retrasó con cambios), `delay` (se retrasó). Si es `null`, no hay intervención activa.

- **visible:**  indica si el día debe ser mostrado en el front.

- **enabled:**  indica si la fila está habilitada para editar.

- **current_processing_time:**  indica el valor del processing time que se encontraba seleccionado antes del cambio. Si es distinto de `null` se mostrará el mensaje de que entrará en vigencia para la próxima semana. Si no, se mostrará el día normalmente.

- **available_options.processing_time:**  indica el tiempo de procesamiento posible a seleccionar en formato HH:MM. Por ejemplo, `"00:30"` (30 minutos).

- **available_options.selected:**  valor actual elegido por el usuario, o el default si es que nunca lo configuró antes.

- **available_options.highlight_level:**  las opciones son:  **low:**  menos tiempo de preparación que el default. **default:**  tiempo de preparación default. **high:**  más tiempo de preparación que el default.

## Actualizar el tiempo de preparación

Este endpoint permite actualizar el tiempo de preparación del envío.

**Importante:**

Caso el vendedor tenga la configuración de Multi Origen (tag `'warehouse_management'` en `/users`) activado en su cuenta, debes realizar las requisiciones por `NODE_ID` en vez de `USER_ID`.

### Actualización por USER_ID

**Llamada:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' 'X-Version:v3' -d \
https://api.mercadolibre.com/users/$USER_ID/service/$SERVICE_TYPE/processing_time_tool
```

**Ejemplo:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' 'X-Version:v3' -d \
https://api.mercadolibre.com/users/123456789/service/carrier_pickup/processing_time_tool

{
  "processing_times": {
    "monday": {
      "processing_time": "01:00"
    },
    "tuesday": {
      "processing_time": "01:00"
    },
    "wednesday": {
      "processing_time": "01:00"
    },
    "thursday": {
      "processing_time": "01:30"
    },
    "friday": {
      "processing_time": "00:30"
    },
    "saturday": {
      "processing_time": "01:00"
    }
  }
}
```

**Respuesta:**

```
{
  "message": "The seller processing times were successfully saved"
}
```

### Actualización por NODE_ID

**Llamada:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' 'x-version: v3' -d \
https://api.mercadolibre.com/nodes/$NETWORK_NODE_ID/service/$SERVICE_TYPE/processing_time_tool
```

**Ejemplo:**

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' 'x-version: v3' -d \
https://api.mercadolibre.com/nodes/MXP20157465171/service/carrier_pickup/processing_time_tool
```

Utiliza el mismo JSON de ejemplo en la requisición por `USER_ID`.

**Respuesta:**

```
{
  "message": "The node processing times were successfully saved"
}
```

### Consideraciones

- Enviar en el formato `"01:00"`, `"00:30"` como viene en el GET.

- En caso de enviarse el campo `processing_times` vacío, la integración tomará los valores default dependiendo la logística: `01:00` cross_docking y `01:30` xd_drop_off.

- En caso de enviarse un día bloqueado, es decir, un día que esté en `enabled: false`, la integración ignora este valor y deja el valor que tiene seleccionado antes del cambio.

- La actualización del `processing_time` del día vigente solo va tener impacto en la próxima semana.

### Códigos de estado de respuesta

| **Código** | **Mensaje** | **Descripción** | **Recomendación** |
| --- | --- | --- | --- |
| `200 - OK` | - | Se obtuvo correctamente la configuración actual. | - |
| `400 - Bad Request` | invalid processing time configuration | Error en los parámetros del request body o formato inválido. | Validar el request body. El formato debe ser `"hh:mm"` y los keys deben ser días de la semana en inglés (monday-sunday). |

## Horarios de despacho

Los horarios de despacho ayudan a los vendedores a programar sus envíos y evitar retrasos, protegiendo su reputación. Para acceder a esta información, es necesario conocer los tipos de logística habilitados en su cuenta. Utiliza el recurso de [preferencia de envío](https://developers.mercadolibre.com.ar/es_ar/mercado-envios#preferencias-de-envio-de-un-usuario) de un usuario para conocer los tipos logísticos del vendedor.

### Consultar los horarios de despacho

Este recurso permite consultar los horarios de despacho de un usuario.

**Importante:**

Caso el vendedor tenga la configuración de [Multi Origen](https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen#Gestion-de-vendedores) (tag 'warehouse_management' en /users) activado en su cuenta, debes realizar las requisiciones por NODE_ID en vez de USER_ID.

### Consulta por USER_ID

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/shipping/schedule/$LOGISTIC_TYPE
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/123456789/shipping/schedule/cross_docking
```

**Respuesta:**

```
{
  "seller_id": 418102956,
  "schedule": {
    "monday": {
      "work": true,
      "detail": [
        {
          "milkrun_same_day": true,
          "from": "13:00",
          "to": "15:00",
          "cutoff": "12:00",
          "sla": ""
        }
      ]
    },
    "tuesday": {
      "work": true,
      "detail": [
        {
          "from": "13:00",
          "to": "15:00",
          "cutoff": "12:00",
          "sla": "same_day",
          "logistic_type": ""
        }
      ]
    },
    "saturday": {
      "work": false,
      "detail": null
    },
    "sunday": {
      "work": false,
      "detail": null
    }
  }
}
```

### Consulta por NODE_ID

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/nodes/$NETWORK_NODE_ID/schedule/$LOGISTIC_TYPE
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/nodes/MXP20157465171/schedule/xd_drop_off
```

**Respuesta:**

```
{
  "seller_id": 418102956,
  "schedule": {
    "monday": {
      "work": true,
      "detail": [
        {
          "milkrun_same_day": true,
          "from": "13:00",
          "to": "15:00",
          "cutoff": "12:00",
          "sla": ""
        }
      ]
    },
    "tuesday": {
      "work": true,
      "detail": [
        {
          "from": "13:00",
          "to": "15:00",
          "cutoff": "12:00",
          "sla": "same_day",
          "logistic_type": ""
        }
      ]
    },
    "saturday": {
      "work": false,
      "detail": null
    },
    "sunday": {
      "work": false,
      "detail": null
    }
  }
}
```

Nota:

**Parámetros de respuesta:**

- **seller_id** : id del vendedor.

- **node_id** : id correspondiente a network_node_id del recurso de stores para identificar el depósito

- **work** : indica si el vendedor trabaja ese día. Aplica a todas las logísticas. No tiene en cuenta los feriados.

- **milkrun_same_day** : indica si es Colecta Rápida o no.

- **from** : es el horario de inicio de la ventana de recolección. Para xd_drop_off es el horario máximo de despacho.

- **to** : es el horario de fin de ventana de recolección.

- **cutoff** : horario de corte.

**Códigos de estado de respuesta:**

| Código | Mensaje | Descripción | Recomendación |
| --- | --- | --- | --- |
| 200 - OK | - | Se obtuvo correctamente la configuración actual. | - |
| 400 - Bad Request | there was an error parsing the request body | Error en los parámetros del request body. | Validar el request body. |
| 404 - Not Found | not valid logistic type | No existe el usuario o no tiene la logística de cross_docking. | Validar el user_id y los tipos de logística del usuario. |
