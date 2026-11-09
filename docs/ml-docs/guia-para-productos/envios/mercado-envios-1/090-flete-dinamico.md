<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/flete-dinamico -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 1 -->

# Flete dinámico

Última actualización 16/10/2026

## Flete Dinámico

Flete Dinámico es una funcionalidad de Mercado Envíos 1 que agiliza la selección de precios y plazos de envío para vendedores y brinda a los compradores información precisa sobre los plazos de entrega. Esta configuración verifica en tiempo real los precios y condiciones de envío, y muestra el costo del envío antes de la compra, mejorando la experiencia y la eficiencia logística. Asimismo, para poder registrar correctamente el desarrollo de esta funcionalidad es necesario incurrir en un proceso de homologación.

## Dinámica de Homologación

La homologación es un proceso en el que Mercado Libre verifica y aprueba una URL externa para que los usuarios puedan registrarse en Mercado Libre desde ese sitio de manera segura y confiable. Ello implica pruebas técnicas, evaluación de seguridad y la implementación de medidas necesarias para garantizar la autenticidad y protección de los datos de los usuarios. Una vez aprobada, la URL se convierte en un canal válido para los usuarios de ME1.

## Requisitos de Homologación

A continuación se presentan los requisitos de homologación para garantizar una integración exitosa con nuestra plataforma de flete dinámico:

- Cumplimiento del Contrato

- Tiempo de Respuesta Óptimo

- Ubicación de Infraestructura

- Especificaciones del Origen y Destino de Datos

- Uso de Caché

- Monitoreo de errores

- Contingencia Mercado Libre

## Cumplimiento del Contrato

A continuación, te presentamos un enfoque paso a paso al crear el endpoint para la homologación:

- La URL no tiene una estructura específica, lo que brinda flexibilidad en la configuración.

- Cada request debe contener únicamente un ítem de un vendedor. Esto es fundamental para mantener la eficiencia en la transmisión de datos.

- Utiliza el método HTTP GET para acceder al endpoint. Este método es adecuado para solicitar datos y es comúnmente utilizado en integraciones web.

- Detalla claramente la fuente de datos (origen) y el sistema de destino. Comprender estos aspectos es fundamental para garantizar un flujo de datos sin problemas y preciso.

Importante:

Reúne los siguientes elementos necesarios:

- URL o endpoint que deseas registrar.

- Headers requeridos para la comunicación.

- Formato de body o JSON request que cumpla con las especificaciones.

- Nombre y ID de tu aplicación.

- Video de demostración.

- 

- [Registra tu aplicación](https://developers.mercadolibre.com.ar/es_ar/crea-una-aplicacion-en-mercado-libre-es)

- 

- 

- [Developer Partner Program](https://developers.mercadolibre.com.ar/es_ar/developer-partner-program)

## Tiempo de Respuesta Óptimo

Este enfoque es esencial para garantizar una experiencia de usuario eficiente y evitar problemas de integración con los vendedores, para ello:

- Familiarízate con la necesidad de mantener el tiempo de respuesta por debajo de los 400 ms y comprende su importancia para una integración exitosa.

- Antes de activar el endpoint, somételo a una validación de carga inicial. Esto implica evaluar su tiempo de respuesta bajo condiciones normales de uso.

- Si el tiempo de respuesta supera el límite, se requieren acciones correctivas. Esto puede incluir la revisión y optimización del código y la infraestructura.

- Si el tiempo de respuesta cumple con el requisito de 400 ms, la integración es aprobada y puede ser activada para los vendedores.

- Asegúrate de seguir optimizando el tiempo de respuesta de forma continua para brindar una experiencia de usuario excepcional.

## Ubicación de Infraestructura

Siguiendo estos pasos, podrás tomar decisiones informadas para mejorar el rendimiento de tu aplicación en función de la ubicación de la infraestructura:

- Considera que la actual infraestructura de flete dinámico se encuentra en la región este de EE.UU., específicamente en Virginia.

- Evalúa si es necesario optimizar tu aplicación o ajustar la configuración para aprovechar al máximo la ubicación de la infraestructura.

## Origen y Destino de Datos

### Especificaciones de la fuente de datos (origen)

Las especificaciones de la fuente de datos forman parte del protocolo de comunicación o intercambio de datos en el proceso de homologación:

Ejemplo por Zip_Code:

```
{
  "seller_id": 337352780,
  "buyer_id": 3123212,
  "declared_value": 69.9,
  "items": [
    {
      "id": "MLB1223500643",
      "variation_id": 0,
      "category_id": "ABC1234",
      "price": 69.9,
      "quantity": 1,
      "SKU": "RB-PC890A",
      "store_id": 231,
      "dimensions": {
        "height": 10,
        "width": 10,
        "length": 31,
        "weight": 500
      }
    }
  ],
  "destination": {
    "type": "zipcode",
    "value": "88063038"
  },
  "origin": {
    "type": "zipcode",
    "value": "88063038"
  }
}
```

Ejemplo por City:

```
{
  "seller_id": 337352780,
  "buyer_id": 3123212,
  "declared_value": 69.9,
  "items": [
    {
      "id": "MLB1223500643",
      "variation_id": 0,
      "category_id": "ABC1234",
      "price": 69.9,
      "quantity": 1,
      "SKU": "RB-PC890A",
      "store_id": 231,
      "dimensions": {
        "height": 10,
        "width": 10,
        "length": 31,
        "weight": 500
      }
    }
  ],
"destination": {
    "type": "city",
    "value": "Ñuble/Yungay"
  },
  "origin": {
    "type": "city",
    "value": "Metropolitana/Pudahuel"
   }
}
```

### Parámetros de respuesta:

- **seller_id**  (Int)​​: Obligatorio. Es la identificación de la cuenta dentro de Mercado Libre.

- **buyer_id**  (Int): Opcional. Es el identificador del usuario que está comprando en Mercado Libre. Solo está disponible cuando el usuario que realiza la está logueado en la plataforma Mercado Libre.

- **declared_value**  (float)​​: Opcional. Es el valor que va ser declarado en la factura.

- **items**  (array): obligatorio. Información del ítem comprado.

- **items.id**  (string): Obligatorio. Es la identificación del producto registrado en Mercado Libre. **items.variation_id**  (Int): Obligatorio. Es la identificación de la variante elegida por el buyer para la compra, tiene dato solo cuando la cotización corresponde a un ítem con variación. **items.category_id**  (string)​​: Opcional. Es la identificación de la categoría del producto dentro de Mercado Libre. **items.price**  (float)​​: Opcional. Es el precio unitario del producto multiplicado por la cantidad de ítems elegidos por el comprador, al momento de la cotización. **items.quantity**  (int)​​: Obligatorio. Es la cantidad que será comprada de un mismo producto. **items.SKU**  (string)​​: Obligatorio. Es la identificación del producto al ser comprado. **items.store_id**  (string)​​: Opcional. Es la identificación de la tienda oficial dentro de Mercado Libre. **items.dimensions**  (object)​​: Obligatorio. Es la lista de medidas de un producto. **items.dimensions.length**  (int)​​: Obligatorio. Es el largo del producto (en centímetros).**items.dimensions.width**  (int)​​: Obligatorio. Es el ancho del producto (en centímetros). **items.dimensions.height**  (int)​​: Obligatorio. Es el alto del producto (en centímetros).  **items.dimensions.weight**  (int)​​: Obligatorio. Es el peso del producto (en gramos).

- **origin**  (object)​​: Opcional. Es la información de la dirección de origen de la entrega o del vendedor.

- **destination**  (object)​: )bligatorio. Es la información de la dirección donde el producto va ser entregado. A continuación, el detalle de acuerdo a cada país:

| País | Detalle |
| --- | --- |
| Brasil | Código Postal |
| Argentina | Código Postal |
| México | Código Postal |
| Chile | Región / Comuna |
| Colombia | Departamento / Localidad |
| Perú | Departamento / Provincia o Distrito |
| Ecuador | Província / Ciudad |
| Uruguay | Departamento / Localidad |

Nota:

- Cuando la cantidad de ítems sea mayor a 1, Mercado Libre utilizará un algoritmo para consolidar las dimensiones en la mejor combinación posible para optimizar el espacio. En este caso, la integración debe usar los valores enviados en el request sin realizar ninguna multiplicación.

- La respuesta debe incluir la cotización correspondiente al ítem comprado.

- Es posible enviar varias cotizaciones, cada una con distinto plazo/promesa de entrega y precio.

- Todos los valores de respuesta son obligatorios y deben ser proporcionados.

## Especificaciones del destino de los datos (destino)

Las especificaciones del destino de datos forman parte del protocolo de comunicación o intercambio de datos en el proceso de homologación:

Ejemplo:

```
{
   "destinations":[
      "88063038"
   ],
   "packages":[
      {
         "dimensions":{
            "height":10,
            "width":10,
            "length":15,
            "weight":500
         },
         "items":[
            {
               "id":"MLB1223500643",
               "variation_id":3123212,
               "quantity":1,
               "dimensions":{
                  "height":10,
                  "width":10,
                  "length":15,
                  "weight":500
               }
            }
         ],
         "quotations":[
            {
               "price":120,
               "handling_time":0,
               "shipping_time":4,
               "promise":4,
               "service":99
            },
            {
               "price":0,
               "handling_time":0,
               "shipping_time":6,
               "promise":6,
               "service":99
            }
         ]
      }
   ]
}
```

### Parámetros de respuesta:

- **destinations**  (array)​​: Información que contiene códigos postales u otras identificaciones de destinos a los que se enviarán los paquetes.

- **packages**  (array)​​: Información que representa los paquetes creados por el vendedor.

- **packages.dimensions**  (object)​​: Obligatorio. Es la lista de medidas del paquete.

- **items**  (array): obligatorio. Información del ítem comprado.

- **items.id**  (string): obligatorio. Es la identificación del ítem registrado en Mercado Libre. **items.variation_id**  (string): Obligatorio. Es la identificación de la variante elegida por el comprador. **items.quantity**  (int)​​: Es la cantidad del producto que se enviará. **items.dimensions**  (object)​​: Obligatorio. Es la lista de medidas del ítem.

- **quotations**  (array)​​: obligatorio. Información del flete para un producto.

- **quotations.price**  (int | float)​​: Es el precio del flete que será presentado al comprador. Para Colombia y Chile debe ser enviado como entero sin decimales. **quotations.handling_time**  (int)​​: Es el tiempo, en días hábiles, que se utilizará para separar y embalar el producto. Abarca todos los procesos previos al envío efectivo del paquete. En el caso de que esa información no esté disponible, debe devolverse el valor 0. **quotations.shipping_time**  (int)​​: Es el tiempo, en días hábiles, de tránsito del paquete (desde la entrada al camión hasta la entrega al comprador). **quotations.promise**  (int)​​: Es la suma de los valores de handling_time y shipping_time. **quotations.service**  (int) : Es el código del servicio/carrier con identificación única que va de 0 a 99, asignada por el vendedor/integrador.

Nota:

En el caso del atributo quotations.service:

- Este código es de responsabilidad exclusiva del vendedor/integrador, Mercado Libre solo lo transmite.

- Este código se utilizará posteriormente en el **shipping**  del pedido, en el campo **option_id**  para identificar a la transportadora.

- El ID estará en la tercera y cuarta posición del ID generado en este campo.

- Por ejemplo, si el ID de option_id es 11**22** 33445566, el ID del transportista, en este caso, es 22, que debe coincidir con el valor enviado en la cotización en el campo **quotations.service** . Recuerda consultar el recurso de envío utilizando el encabezado x-format-new=true según la [documentación](https://developers.mercadolibre.com.ar/es_ar/envios).

- Si envías solo un dígito, se completará automáticamente con un 0 a la izquierda. Por ejemplo, si envías 5, se convertirá en 05.

- En caso de enviar más de 2 dígitos, la información no será integrada y el código del carrier retornará "00". Por ejemplo, si envías 123, la respuesta será 00.

- Es fundamental incluir al menos un objeto dentro del array **quotations** .

En el caso de que se produzca un error interno o que un ítem esté relacionado con un error, la estructura de la respuesta debe seguir el siguiente formato:

- Para el código de error 3 (sin cobertura), el estado HTTP debe ser 400 (Solicitud incorrecta).

- Para cualquier otro código de error o error interno relacionado con la cotización, el estado HTTP debe ser 500 (Error interno del servidor).

Ejemplo de Respuesta:

```
{
   "message": "any message",
   "error_code": 1
}
```

## Uso de Caché

En este contexto, será utilizado la [RFC IETF 7234](https://datatracker.ietf.org/doc/html/rfc7234), una especificación ampliamente reconocida que establece las mejores prácticas para el almacenamiento en caché de llamadas HTTP.

## Verbo HTTP

En este contexto, es esencial alinear la semántica de nuestras llamadas con el protocolo HTTP, que sugiere que solo las llamadas **GET**  deben ser cacheadas.

## Headers

Se deben incorporar encabezados adicionales en las llamadas y respuestas realizadas a integradores. En el caso de las llamadas, se deben agregar los siguientes encabezados:

| Atributo | Descripción |
| --- | --- |
| If-None-Match | Identificador del recurso (cotización) en cuestión (header ETag). Es utilizada para verificar si la versión del recurso aún es válida. Es válido si el partner devuelve el HTTP status 304 sin contenido. En caso contrario, devuelve una nueva versión del recurso y una nueva ETag. |

Por otro lado, en las respuestas proporcionadas de los integradores, es necesario incluir los siguientes encabezados adicionales:

| Atributo | Descripción |
| --- | --- |
| Cache-Control | Utilizado para especificar las directivas para el caché de las respuestas. Las directivas que debes adaptar son:   no-store: (opcional) indica que la respuesta no debe ser cacheada. Se utiliza esta directiva, las demás no son necesarias. must-revalidate: Debes verificar si la respuesta es válida con el integrador. Este debe devolver el HTTP Status 304 si aún fuera válido o 200 con el nuevo valor para la cotización. Esta validación es opcional y queda a criterio del integrador adoptarla o no. Si no la adaptas, será utilizado el max-age para definir el TTL de la respuesta en el caché. private: (obligatorio) la respuesta no debe ser almacenada por cualquier proxy intermediario. max-age: (obligatorio) tiempo máximo en segundos que la respuesta es válida. |
| Age | Tiempo en segundos desde que la versión del recurso pasó a ser válida. En caso de no existir este control por parte de los partners, debes enviar el valor cero (0). |
| ETag | Identificador de la versión del recurso. Es obligatorio utilizarlo. |

En busca de optimizar nuestras respuestas y reducir el número de llamadas, el atributo llamado **destinations**  contendrá una lista de destinos en forma de strings, indicando todos los lugares donde se puede utilizar la cotización. Ahora, con una sola cotización se pueden evitar realizar múltiples llamadas, mejorando significativamente la eficiencia de nuestras API. 
 A continuación, presentamos un ejemplo de cómo se puede verificar el header ETag devuelto para determinar si la respuesta cacheada sigue siendo válida. Ejemplo de llamada con validación caché:

| Headers | Estado | Body |
| --- | --- | --- |
| - Cache-Control:private;max-age:1000000  - Age:50000  - ETag:0943dc18-a8d7-4508-97a9-ba9221fa | 304 | No Content |

Para brindar un control más granular sobre el almacenamiento en caché, estamos introduciendo la directiva **no-store**  en el header **Cache-Control**  de nuestras respuestas. Esta directiva permite a los partners indicar que una cita no debe almacenarse en caché.

Ejemplo de respuesta sin permitir el caché:

| Headers | Estado | Body |
| --- | --- | --- |
| - Cache-Control:no-store | 200 | Igual body de la respuesta de la cotización |

Ejemplo de respuesta con caché:

| Headers | Estado | Body |
| --- | --- | --- |
| - Cache-Control:private;max-age:1000000  - Age:0  - ETag:0943dc18-a8d7-4508-97a9-ba9221fa | 200 | Igual body de la respuesta de la cotización |

## Monitoreo de errores

A continuación, enumeramos los posibles errores en relación al manejo de Flete Dinámico:

| Parámetro | Descripción | Posible Solución |
| --- | --- | --- |
| -1 | Este error se produce cuando la aplicación del integrador experimenta problemas internos que impiden su funcionamiento adecuado. Como resultado, el comprador recibirá una cotización de la calculadora MELI en modo de contingencia. | En caso de un error interno en la aplicación del integrador, se recomienda tener en cuenta la Tabla de Contingencia como un plan de respaldo. **Cuando se detecta un error interno, la aplicación activa automáticamente la consulta a la Tabla de Contingencia.** |
| 1 | Este error ocurre cuando el producto seleccionado por el comprador no está disponible en el inventario. Como resultado, no es posible calcular una cotización de envío para un producto que no se encuentra en stock. | Se recomienda implementar un proceso de gestión de inventario efectivo o considerar mostrar alternativas de productos similares disponibles. |
| 2 | Este error ocurre cuando el destino (código postal, comuna, etc) proporcionado por el comprador no es válido. Como resultado, no se puede calcular una cotización de envío precisa. | Al detectar que el destino proporcionado no es válido, la aplicación no consulta la tabla de contingencia. El proceso de cotización se detiene y se devuelve un error al comprador, quien debe facilitar un destino válido para que se genere una nueva cotización. |
| 3 | Este error se produce cuando el producto seleccionado por el comprador no está disponible para su entrega en el destino especificado. Como resultado, no se puede calcular una cotización de envío. | Cuando el producto no puede entregarse en el destino especificado, la aplicación no consulta la tabla de contingencia. El proceso de cotización se detiene y se devuelve un error al comprador indicando que la entrega no está disponible para la ubicación seleccionada. Es necesario proporcionar un destino que cuente con cobertura de entrega. |
| 4 | Este error se produce cuando la aplicación no puede encontrar el producto especificado por el comprador. Esto impide calcular una cotización de envío precisa. | Asegurar que la base de datos de productos esté actualizada y sea fácilmente accesible para la aplicación. |

## Métricas de calidad de las cotizaciones

Este servicio permite consultar las métricas y performance de las cotizaciones de un integrador de flete dinámico en general o por vendedor específico. Estas métricas brindan información detallada sobre latencia, uptime, uso de caché, porcentaje de contingencia y desglose de errores, lo que permite monitorear y optimizar la calidad del servicio de flete dinámico.

**Endpoint:**  GET /shipping/me1/sites/{site_id}/metrics

**Autenticación:**  Bearer token obligatorio (validación de partner)

**Parámetros:**

| Parámetro | Tipo | Ubicación | Obligatorio | Descripción |
| --- | --- | --- | --- | --- |
| site_id | string | path | Sí | Identificador del site o país (ej: MLA, MLB, MCO) |
| seller_id | string | query | No | ID del vendedor para usar como filtro (numérico) |
| ts_from | string | query | Sí | Fecha inicial como timestamp en formato ISO-8601 UTC (YYYY-MM-DDTHH:MM:SSZ) |
| ts_to | string | query | Sí | Fecha final como timestamp en formato ISO-8601 UTC (YYYY-MM-DDTHH:MM:SSZ) |

**Importante:**

Este servicio de métricas de calidad es de uso exclusivo para integradores de flete dinámico.

**Sites válidos:**  MLA, MLB, MCO, MLC, MLM, MLU, MBO, MPE, MLV

**Ejemplo de requisición (métricas generales):**

```
curl -X GET \
"https://api.mercadolibre.com/shipping/me1/sites/MLB/metrics?ts_from=2023-10-01T00:00:00Z&ts_to=2023-10-31T23:59:59Z" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Content-Type: application/json"
```

**Ejemplo de requisición (métricas por vendedor):**

```
curl -X GET \
"https://api.mercadolibre.com/shipping/me1/sites/MLB/metrics?seller_id=123456789&ts_from=2023-10-01T00:00:00Z&ts_to=2023-10-31T23:59:59Z" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Content-Type: application/json"
```

**Ejemplo de respuesta (200 OK):**

```
{
  "site_id": "MLB",
  "seller_id": 123456789,
  "partner": "partner_name",
  "from": "2023-10-01T00:00:00Z",
  "to": "2023-10-31T23:59:59Z",
  "summary": {
    "latency_avg_ms": 150.5,
    "latency_max_ms": 2500.0,
    "uptime_pct": 99.95,
    "contingency_pct": 0.05,
    "cache_pct": 85.2,
    "revalidation_pct": 2.1,
    "errors": {
      "4xx_pct": 0.1,
      "5xx_pct": 0.05,
      "item": [
        {
          "type": "timeout",
          "pct": 0.03
        },
        {
          "type": "connection_error",
          "pct": 0.02
        }
      ]
    }
  },
  "totals": {
    "req_count": 1000000,
    "error_count": 150,
    "contingency_count": 500,
    "revalidation_count": 21000,
    "cache_hit_count": 852000
  }
}
```

## Campos de respuesta

- **site_id**  (string): Identificador del site consultado

- **seller_id**  (integer, opcional): Identificador del seller (solo cuando se filtra)

- **partner**  (string): Nombre del partner asociado al cliente

- **from**  (string): Inicio del intervalo consultado (timestamp UTC ISO-8601)

- **to**  (string): Fin del intervalo consultado (timestamp UTC ISO-8601)

- **summary**  (object): Resumen de las métricas de calidad  **latency_avg_ms**  (number): Latencia promedio en milisegundos **latency_max_ms**  (number): Latencia máxima en milisegundos **uptime_pct**  (number): Porcentaje de uptime **contingency_pct**  (number): Porcentaje de solicitudes que usaron contingencia **cache_pct**  (number): Porcentaje de cache hits **revalidation_pct**  (number): Porcentaje de revalidaciones **errors**  (object): Desglose de errores  **4xx_pct**  (number): Porcentaje de errores 4xx **5xx_pct**  (number): Porcentaje de errores 5xx **item**  (array): Lista de errores específicos con sus porcentajes

- **totals**  (object): Totales agregados de las métricas  **req_count**  (integer): Total de solicitudes **error_count**  (integer): Total de errores **contingency_count**  (integer): Total de solicitudes con contingencia **revalidation_count**  (integer): Total de revalidaciones **cache_hit_count**  (integer): Total de cache hits

## Códigos de error HTTP

| Código | Descripción |
| --- | --- |
| 400 | Bad Request - parámetros inválidos, site_id ausente, formato de timestamp inválido o formato de seller_id inválido |
| 401 | Unauthorized - token inválido o client ID inválido |
| 403 | Forbidden - cliente no autorizado para este recurso o seller_id no permitido en el partner |
| 500 | Internal Server Error - error en el servicio del partner o servicio upstream |
| 503 | Service Unavailable - servicio de autenticación indisponible |

## Contingencia Mercado Libre

La Tabla de Contingencia, también conocida como Tabla Axado, se trata de una plantilla de transportadoras que se puede cargar directamente desde Mercado Libre. Su función principal es actuar como un plan de respaldo en caso de que el endpoint o URL del integrador falle. En otras palabras, es una herramienta de seguridad diseñada para mantener la operación de los vendedores en marcha incluso cuando surgen problemas inesperados. 
 A continuación, algunos criterios a tener en cuenta:

- Requerimiento Inicial: El Asesor Comercial de MELI solicitará al vendedor la Tabla de Contingencia al activar la integración con el integrador de flete dinámico.

- Responsabilidad del Vendedor: El vendedor debe completar y mantener actualizada esta tabla con los valores tanto en el integrador como en MELI.

- Establecer Reglas de Flete: Se recomienda que el vendedor establezca reglas claras de flete, como costos cero para ubicaciones cercanas, para optimizar la entrega.

- Actualización Fácil: Si el vendedor desea actualizar la tabla, puede hacerlo desde MELI ubicándolo desde Mi Perfil -> Ventas -> Preferencias de Ventas -> Transportadoras.

Además, adjuntamos un desglose por país junto con un enlace de referencia a la Tabla de Contingencia Modelo:

| País | Detalle | Link |
| --- | --- | --- |
| Brasil | Código Postal | [https://www.mercadolivre.com.br/transportadoras/config](https://www.mercadolivre.com.br/transportadoras/config) |
| Argentina | Código Postal | [https://www.mercadolibre.com.ar/transportadoras/config](https://www.mercadolibre.com.ar/transportadoras/config) |
| México | Código Postal | [https://www.mercadolibre.com.mx/transportadoras/config](https://www.mercadolibre.com.mx/transportadoras/config) |
| Chile | Región / Comuna | [https://www.mercadolibre.cl/transportadoras/config](https://www.mercadolibre.cl/transportadoras/config) |
| Colombia | Departamento / Localidad | [https://www.mercadolibre.com.co/transportadoras/config](https://www.mercadolibre.com.co/transportadoras/config) |
| Perú | Departamento / Provincia o Distrito | [https://www.mercadolibre.com.pe/transportadoras/config](https://www.mercadolibre.com.pe/transportadoras/config) |
| Ecuador | Província / Ciudad | [https://www.mercadolibre.com.ec/transportadoras/config](https://www.mercadolibre.com.pe/transportadoras/config) |
| Uruguay | Departamento / Localidad | [https://www.mercadolibre.com.uy/transportadoras/config](https://www.mercadolibre.com.uy/transportadoras/config) |

Importante:

Para evitar errores al cargar la Tabla de Contingencia, es importante seguir estas reglas:

Recuerda que los transportistas registrados en Mercado Libre siguen el estándar de código 16 para vendedores de Brasil y 17 para otros países, según lo establecido en la Tabla de Contingencia.

- **Verificar extensión del archivo:**  Asegurarse de que el archivo tenga la extensión correcta según el modelo de Mercado Libre (.xlsx).

- **Mantener los nombres de las pestañas:**  No modificar los nombres de las pestañas en el modelo a cargar. Todo debe coincidir con el modelo original. Además, ninguna pestaña debe ser eliminada.

- **Preservar los encabezados:**  No alterar los encabezados en el archivo. Verificar que la estructura de la planilla se mantenga de acuerdo con el modelo.

- **Validar información:**  Verificar que los códigos postales sean correctos. Prestar atención a las mayúsculas y minúsculas al referirse a departamentos, ciudades, comunidades, etc.

- **Verificar tamaño del archivo:**  Asegurarse de que el archivo tenga un tamaño máximo de 7 MB.

- **Verificar líneas duplicadas:**  Asegurarse de que el archivo no tenga líneas duplicadas.

- **Verificar intervalos de código postal:**  Asegurarse de que el archivo no tenga intervalos de código postal que se superpongan a otro intervalo, ej.: Tener un intervalo de 1 a 10 con precio 12 y promesa de 2 días, y tener otro intervalo de 5 a 15 con precio 15 y promesa de 3 días — en este caso los intervalos se superponen en los códigos postales del 5 al 10.

- **Verificar intervalos de peso:**  Asegurarse de que el archivo no tenga superposiciones en los intervalos de peso para el mismo código postal, ej.: Tener para el mismo código postal un intervalo de peso de 1 a 5 con precio 10, y tener otro intervalo de 3 a 7 con precio 12 — en este caso los intervalos se superponen en los pesos de 3 a 5.

- **Verificar intervalos invertidos:**  Asegurarse de que el archivo no tenga intervalos (Código Postal y Peso) invertidos, ej.: Tener un intervalo de 5 a 1 — en este caso el valor inicial es mayor que el final.

## Gestión de tabla de contingencia vía API

A partir de ahora, es posible gestionar la tabla de contingencia directamente vía API, lo que permite que integradores actualicen las tablas de tarifas de los vendedores. Esto garantiza que la tabla de contingencia esté siempre sincronizada con los precios reales utilizados por el integrador.

## Descarga de template de tarifas

Este endpoint permite descargar el template correcto de tarifas para cada site, garantizando que la planilla esté en el formato y modelo esperado por el sistema.

**Endpoint:**  GET /shipping/me1/v1/tariff/template

**Autenticación:**  Bearer token obligatorio

**Parámetros:**

| Parámetro | Tipo | Ubicación | Obligatorio | Descripción |
| --- | --- | --- | --- | --- |
| site | string | query | Sí | Identificador del site (MLB, MLA, MLM, MLC, MLU, MCO, MPE) |

## Ejemplo de solicitud

```
curl -X GET \
"https://api.mercadolibre.com/shipping/me1/v1/tariff/template?site=MLB" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Content-Type: application/json"
```

## Ejemplo de respuesta (200 OK)

```
{
  "site": "MLB",
  "filename": "tariff_template_MLB.xlsx",
  "content": "UEsDBBQABgAIAAAAIQBi7p1...",
  "encoding": "base64",
  "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
}
```

## Códigos de error HTTP

| Código | Descripción |
| --- | --- |
| 400 | Bad Request - parámetro site ausente o inválido |
| 401 | Unauthorized - token inválido |
| 404 | Not Found - template no encontrado para el site especificado |
| 500 | Internal Server Error - error al leer o codificar el archivo de template |
| 503 | Service Unavailable - servicio de autenticación no disponible |

### Upload de tarifario

Este endpoint permite realizar el upload de una tabla de tarifario que tendrá procesamiento asíncrono. El vendedor se identifica por el caller_id del token de autenticación y debe tener habilitado el modo ME1.

**Endpoint:**  POST /shipping/me1/v1/tariff/update

**Autenticación:**  Bearer token obligatorio (debe contener caller_id)

**Content-Type:**  multipart/form-data

**Parámetros del form:**

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| site | string | Sí | Identificador del site (MLB, MLA, MLM, MLC, MLU, MCO, MPE) |
| service | string | Sí | Nombre del servicio o transportadora en minúscula (ej: transportadora-17) |
| file | file | Sí | Archivo Excel (.xlsx) con el tarifario (máximo 7MB) |
| callback_url | string | Sí | URL HTTPS para notificaciones webhook (no puede ser localhost) |

## Validaciones

- Seguir orientaciones de [este tópico](https://developers.mercadolibre.com.ar/es_ar/flete-dinamico#Contingencia-Mercado-Libre)

- El archivo no puede contener caracteres especiales

- callback_url debe usar el protocolo HTTPS

- callback_url no puede ser localhost ni una IP privada

- callback_url debe aceptar el método POST

- El vendedor debe tener habilitado el modo ME1

## Ejemplo de solicitud

```
curl -X POST \
"https://api.mercadolibre.com/shipping/me1/v1/tariff/update" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-F "site=MLB" \
-F "service=transportadora-17" \
-F "file=@tariff_table.xlsx" \
-F "callback_url=https://example.com/webhook"
```

## Ejemplo de respuesta (202 Accepted)

```
{
  "resource_id": "daba7e52-1ca7-5640-b54b-406423a405f5",
  "status": "accepted",
  "message": "Tariff update request accepted and will be processed asynchronously",
  "seller_id": 123456,
  "site": "MLB",
  "service": "transportadora-17",
  "submitted_at": "2025-01-15T10:30:00Z"
}
```

## Procesamiento asíncrono

El upload se procesa de forma asíncrona. Cuando finalice el procesamiento, se enviará una notificación al callback_url informado. El resource_id devuelto se puede usar para consultar el estado del tarifario.

## Notificación webhook

Cuando finalice el procesamiento del tarifario, con éxito o error, se enviará una solicitud POST al callback_url informado.

## Formato de la solicitud webhook

| Atributo | Valor |
| --- | --- |
| Método | POST |
| URL | callback_url informado en el upload |
| Content-Type | application/json |
| Timeout | 1 segundo |

**Payload del webhook:**

```
{
  "event": "tariff.published | tariff.error",
  "timestamp": "2024-12-04T10:35:00Z",
  "data": {
    "resource_id": "550e8400-e29b-41d4-a716-446655440000",
    "seller_id": 123456789,
    "site_id": "MLB",
    "service": "transportadora-17",
    "status": "success | error",
    "errors": [
      {
        "error": "greater_than_or_equal_to(0)",
        "field": "max_sum_dimensions",
        "lines": "1"
      }
    ],
    "warnings": [
      {
        "warning": "price below minimum threshold",
        "field": "price",
        "lines": "15,23"
      }
    ]
  }
}
```

## Campos del payload

- **event**  (string): Tipo del evento (tariff.published para éxito o tariff.error para error)

- **timestamp**  (string): Fecha y hora del evento en formato ISO-8601 UTC

- **data**  (object): Datos del evento

- **data.resource_id**  (string): Identificador único del tarifario (el mismo retornado en la respuesta del upload)

- **data.seller_id**  (integer): ID del vendedor

- **data.site_id**  (string): Identificador del site (MLB, MLA, MLM, etc.)

- **data.service**  (string): Nombre del servicio o transportadora

- **data.status**  (string): Estado del procesamiento (success o error)

- **data.errors**  (array): Lista de errores de validación (vacía si el estado es success)

- **errors[].error**  (string): Descripción del error

- **errors[].field**  (string): Campo que causó el error

- **errors[].lines**  (string): Números de las líneas afectadas

- **data.warnings**  (array): Lista de avisos de validación

- **warnings[].warning**  (string): Descripción del aviso

- **warnings[].field**  (string): Campo que generó el aviso

- **warnings[].lines**  (string): Números de las líneas afectadas

**Ejemplo de webhook de éxito:**

```
{
  "event": "tariff.published",
  "timestamp": "2024-12-04T10:35:00Z",
  "data": {
    "resource_id": "550e8400-e29b-41d4-a716-446655440000",
    "seller_id": 123456789,
    "site_id": "MLB",
    "service": "transportadora-17",
    "status": "success",
    "errors": [],
    "warnings": [
      {
        "warning": "price below minimum threshold",
        "field": "price",
        "lines": "15,23"
      }
    ]
  }
}
```

**Ejemplo de webhook de error:**

```
{
  "event": "tariff.error",
  "timestamp": "2024-12-04T10:35:00Z",
  "data": {
    "resource_id": "550e8400-e29b-41d4-a716-446655440000",
    "seller_id": 123456789,
    "site_id": "MLB",
    "service": "transportadora-17",
    "status": "error",
    "errors": [
      {
        "error": "greater than or equal to(0)",
        "field": "max_sum_dimensions",
        "lines": "1"
      },
      {
        "error": "not_nullable",
        "field": "price",
        "lines": "5,10"
      }
    ],
    "warnings": []
  }
}
```

**Códigos de error HTTP:**

| Código | Descripción |
| --- | --- |
| 400 | Bad Request - parámetros ausentes o inválidos, callback_url inválido, archivo excede 7MB |
| 401 | Unauthorized - token inválido o caller_id ausente |
| 403 | Forbidden - el vendedor no tiene el modo ME1 habilitado |
| 404 | Not Found - vendedor no encontrado |
| 429 | Too Many Requests - límite de tasa excedido |
| 500 | Internal Server Error - error interno del servidor |
| 503 | Service Unavailable - servicio de autenticación no disponible |

## Download de tarifario por resource id

Este endpoint permite recuperar una tabla de tarifario específica por su resource_id. El archivo se retorna como contenido Base64 codificado en formato JSON.

**Endpoint:**  GET /shipping/me1/v1/tariff/{resource_id}

**Autenticación:**  Bearer token obligatorio (debe contener caller_id)

**Parámetros:**

| Parámetro | Tipo | Ubicación | Obligatorio | Descripción |
| --- | --- | --- | --- | --- |
| resource_id | string | path | Sí | Identificador único (UUID) del tarifario |

**Ejemplo de requisición:**

```
curl -X GET \
"https://api.mercadolibre.com/shipping/me1/v1/tariff/550e8400-e29b-41d4-a716-446655440000" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Content-Type: application/json"
```

**Ejemplo de respuesta (200 OK):**

```
{
  "seller_id": 123456789,
  "filename": "tariff_550e8400-e29b-41d4-a716-446655440000.xlsx",
  "content": "UEsDBBQABgAIAAAAIQBi7p...",
  "encoding": "base64",
  "created_at": "2025-01-15T10:30:00Z",
  "status": "active",
  "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "errors": [],
  "warnings": []
}
```

**Status posibles:**

- Active - Tarifario activo y válido

- Created - Tarifario creado y aguardando procesamiento

- Validating - Tarifario en validación

- Error - Error en la validación (verificar array errors)

- Inactive - Tarifario inactivo

**Ejemplo de respuesta con errores de validación:**

```
{
  "seller_id": 123456789,
  "filename": "tariff_550e8400-e29b-41d4-a716-446655440000.xlsx",
  "content": "UEsDBBQABgAIAAAAIQBi7p...",
  "encoding": "base64",
  "created_at": "2025-01-15T10:30:00Z",
  "status": "error",
  "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "errors": [
    {
      "error": "greater_than_or_equal_to(0)",
      "field": "max_sum_dimensions",
      "lines": "1"
    },
    {
      "error": "not_nullable",
      "field": "price",
      "lines": "5,10"
    }
  ],
  "warnings": [
    {
      "warning": "price below minimum threshold",
      "field": "price",
      "lines": "15,23"
    }
  ]
}
```

**Códigos de error HTTP:**

| Código | Descripción |
| --- | --- |
| 400 | Bad Request - resource_id ausente o formato de caller_id inválido |
| 401 | Unauthorized - token inválido, client ID inválido o caller_id ausente |
| 403 | Forbidden - el vendedor no tiene el modo ME1 habilitado |
| 404 | Not Found - tarifario no encontrado para el resource_id provisto |
| 500 | Internal Server Error - error al recuperar el tarifario, descargar el archivo o codificar el contenido |
| 503 | Service Unavailable - servicio de autenticación no disponible |

## Simulación de cotación

Este endpoint permite simular una cotación de flete para validar si la tabla de contingencia está funcionando correctamente. Es útil para probar diferentes escenarios de dimensiones, peso y destino después de hacer upload de la tabla, cuando la tabla esté activa.

**Endpoint:**  POST /shipping/me1/v1/quotation/simulate

**Autenticación:**  Bearer token obligatorio (debe contener caller_id)

**Content-Type:**  application/json

**Rate limiting:**  50 requisiciones por minuto (RPM)

**Parámetros del body:**

| Parámetro | Tipo | Obligatorio | Descripción |
| --- | --- | --- | --- |
| declared_value | float | Sí | Valor declarado del paquete (debe ser mayor que 0) |
| dimensions | object | Sí | Dimensiones del paquete |
| dimensions.width | float | Sí | Ancho en centímetros (debe ser mayor que 0) |
| dimensions.height | float | Sí | Alto en centímetros (debe ser mayor que 0) |
| dimensions.length | float | Sí | Largo en centímetros (debe ser mayor que 0) |
| dimensions.weight | integer | Sí | Peso en gramos (debe ser mayor que 0). Debe ser un número entero; valores decimais serán rechazados con HTTP 400. |
| destination | object | Sí | Información de destino |
| destination.type | string | Sí | Tipo de destino: "zipcode" o "city" |
| destination.value | string | Sí | Valor del destino (CEP o ciudad) |

**Ejemplo de requisición (destino por CEP):**

```
curl -X POST \
"https://api.mercadolibre.com/shipping/me1/v1/quotation/simulate" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "declared_value": 150.00,
  "dimensions": {
    "width": 20.0,
    "height": 15.0,
    "length": 30.0,
    "weight": 1000
  },
  "destination": {
    "type": "zipcode",
    "value": "01310100"
  }
}'
```

**Ejemplo de requisición (destino por ciudad):**

```
curl -X POST \
"https://api.mercadolibre.com/shipping/me1/v1/quotation/simulate" \
-H "Authorization: Bearer $ACCESS_TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "declared_value": 500.00,
  "dimensions": {
    "width": 40.0,
    "height": 30.0,
    "length": 50.0,
    "weight": 2000
  },
  "destination": {
    "type": "city",
    "value": "São Paulo"
  }
}'
```

**Ejemplo de respuesta (200 OK):**

```
{
  "quotations": [
    {
      "price": 25.50,
      "speed": 3,
      "service": "standard"
    },
    {
      "price": 45.00,
      "speed": 1,
      "service": "express"
    },
    {
      "price": 18.90,
      "speed": 7,
      "service": "economic"
    }
  ]
}
```

## Campos de respuesta

- **quotations**  (array): Lista de opciones de cotación disponibles

- **price**  (float): Precio del flete

- **speed**  (int): Tiempo estimado de entrega en días hábiles

- **service**  (string): Nombre del servicio o transportadora

**Códigos de error HTTP:**

| Código | Descripción |
| --- | --- |
| 400 | Bad Request - parámetros ausentes o inválidos (declared_value <= 0, dimensiones <= 0, tipo de destino inválido) |
| 401 | Unauthorized - token inválido, client ID inválido, caller_id ausente o formato inválido |
| 403 | Forbidden - el vendedor no tiene el modo ME1 habilitado |
| 404 | Not Found - recurso no encontrado |
| 429 | Too Many Requests - límite de tasa excedido (50 RPM) |
| 500 | Internal Server Error - error al simular la cotación o al obtener datos del vendedor |
| 503 | Service Unavailable - servicio de autenticación o calculadora no disponible |
