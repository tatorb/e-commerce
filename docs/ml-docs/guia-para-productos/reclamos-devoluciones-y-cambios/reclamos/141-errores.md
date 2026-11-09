<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/errores -->
<!-- Sección: Guía para productos > Reclamos, Devoluciones y Cambios > Reclamos -->

# Errores

Última actualización 10/02/2025

## Errores

### Posibles errores al trabajar con reclamos

Al gestionar reclamos, es posible que te encuentres con los siguientes errores. Es crucial que entiendas la causa de cada uno y sepas cómo corregirlos, para manejar eficientemente la situación. Aquí tienes la información necesaria para identificar y resolver estos problemas.

```
{
    "message": "You don't have permission to access the resource",
    "error": "forbidden_error",
    "status": 403,
    "cause": []
}
```

**Recurso no encontrado:**

```
{
    "message": "Resource not found",
    "error": "business_logic_error",
    "status": 404,
    "cause": []
}
```

**Usuário no autorizado:**

```
{
    "message": "user not authorized",
    "error": "unauthorized_request_error",
    "status": 401,
    "cause": []
}
```

**Error interno :**

```
{
    "message": "Internal Server Error",
    "error": "internal_server_error",
    "status": 500,
    "cause": []
}
```

**Indica que el usuario ha enviado muchas solicitudes en un período de tiempo determinado:**

```
{
    "message": "Too Many Requests",
    "error": "too_many_requests",
    "status": 429,
    "cause": []
}
```

**Tuvimos un error interno:**

```
{
    "message": "Bad Gateway",
    "error": "bad_gateway",
    "status": 502,
    "cause": []
}
```

**Servidor en manutención:**

```
{
    "message": "Service not available",
    "error": "service_not_available",
    "status": 503,
    "cause": []
}
```

**No pudimos responder a tiempo:**

```
{
    "message": "Gateway Timeout",
    "error": "gateway_timeout",
    "status": 504,
    "cause": []
}
```

## Api Errors

**Adjunto no encontrado:**

```
{
    "message": "Attachment not found [claim: $claim_id - fileName: $file_name]",
    "error": "business_logic_error",
    "status": 400,
    "cause": []
}
```

**Acción enable_partial_refund no disponible para el player:**

```
{
    "message": "Action allow_partial_refund not available for player",
    "error": "bad_request_error",
    "status": 400,
    "cause": []
}
```

**Reembolso de acción no disponible para el player:**

```
{
    "message": "Action refund not available for player",
    "error": "bad_request_error",
    "status": 400,
    "cause": []
}
```

**Acción open_dispute no disponible para el player:**

```
{
    "message": "Action open_dispute not available for player",
    "error": "bad_request_error",
    "status": 400,
    "cause": []
}
```

**Acción enable_return no disponible para el player:**

```
{
    "message": "Action allow_return not available for player",
    "error": "bad_request_error",
    "status": 400,
    "cause": []
}
```

**Acción send_message_to_complainant no disponible para el player:**

```
{
    "message": "Action send_message_to_complainant not available for player",
    "error": "bad_request_error",
    "status": 400,
    "cause": []
}
```

**Acción send_message_to_mediator no disponible para el player:**

```
{
    "message": "Action send_message_to_mediator not available for player",
    "error": "bad_request_error",
    "status": 400,
    "cause": []
}
```

## Metadata

Disponibilizaremos en el header de las llamadas el campo **metadata** , que proporcionará información relevante para el procesamiento de la solicitud en caso de error no bloqueante. Esta información se presentará en formato JSON, lo que permitirá su conversión a un objeto. El campo **metadata**  incluirá los siguientes datos:

| Campo | Tipo | Descripción | Ejemplo |
| --- | --- | --- | --- |
| execution_details | List<MetadataExecutionDetail> | Lista con el detalle de las consultas realizadas sin éxito | [{"id":"buyer_not_authorized","type":"error","message":"User not authorized, you must be the Seller to access this information","suggested_action":"check_user"}] |

**Descripción del objeto MetadataExecutionDetail:**

| Campo | Tipo | Tamaño máximo | Descripción | Ejemplo |
| --- | --- | --- | --- | --- |
| id | String | 40 caracteres | ID referente al detalle de la ejecución. | "buyer_not_authorized" |
| type | String | 10 caracteres | Tipo del detalle de la ejecución.  Posibles valores:  info: informativo warning: aviso error: error | "warning" |
| message | String | 100 caracteres | Mensaje descriptivo informando cuál fue el error que ocurrió. | "User not authorized, you must be the Seller to access this information" |
| suggested_action | String | 20 caracteres | Acción sugerida a tomar.  Posibles valores:  retry: intente nuevamente check_user: verifique el usuario enviado check_documentation: revise la documentación wait_to_retry: intente nuevamente más tarde | "check_user" |

Siguiente: [Devoluciones](https://developers.mercadolibre.com.ar/es_ar/gestionar-devoluciones)
