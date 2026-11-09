<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/seguridad-apps -->
<!-- Sección: Guía de seguridad -->

# Seguridad de aplicaciones

Última actualización 23/06/2026

## Seguridad de aplicaciones

## Protección de datos personales

Garantizar mecanismos robustos de protección de datos personales es fundamental para que los integradores preserven la confianza del ecosistema, de los usuarios y aseguren la continuidad del negocio. El mal manejo de éstos no solo expone a la organización a brechas de seguridad y fraudes comerciales, sino que conlleva a riesgos legales, multas por incumplimiento de normativas y la posible revocación definitiva de los permisos de acceso a la API. En última instancia, proteger la información del vendedor y comprador es proteger la reputación y estabilidad de la propia integración. Es por eso que recomendamos a tener en cuenta:

### Principios de protección de datos

- **Minimización,**  solo recolectar y almacenar datos estrictamente necesarios.

- **Limitación de uso,**  usar datos solo para el propósito declarado.

- **Retención limitada,**  eliminar datos cuando ya no sean necesarios.

- **Seguridad,**  proteger datos con medidas técnicas adecuadas.

### Datos sensibles de Mercado Libre:

Estos datos se clasifican como información de identificación personal (PII) y deben ser cifrados en reposo, enmascarados en logs y de acceso restringido, los siguientes son algunos ejemplos de este tipo de datos:

- Emails

- Teléfonos

- Dirección de envío

- Documento de identidad

- Cualquier otro dato de uso exclusivo del usuario.

### Prácticas requeridas:

- Cifrar data PII en reposo, usar AES-256 o equivalente.

- Enmascarar logs, no registrar e-mails, teléfonos y documentos de identidad completos.

- Solo usuarios con los roles y/o permisos adecuados pueden acceder a esta data.

- Registro de acceso que permita identificar quién accedió a datos sensibles y que hizo con ellos.

- Establecer una política de retención de datos.

- Derecho de eliminación, capacidad de eliminar datos si el usuario lo solicita.

Veamos cómo se ve un manejo inseguro vs seguro de datos personales:

#### En base de datos:

SEGURIDAD DE DATOS PERSONALES: ALMACENAMIENTO

❌ **INCORRECTO: SIN CIFRADO**

```
+--------------+------------------+------------------+
| comprador_id | email            | telefono         |
+--------------+------------------+------------------+
| 12345        | juan@email.com   | 1155551234       |
+--------------+------------------+------------------+
⚠️ RIESGO CRITICO: Si hackean la BD, se exponen todos los datos personales.
```

✅ **CORRECTO: CON CIFRADO (ENCRIPTADO)**

```
+--------------+------------------+------------------+
| comprador_id | email_encrypted  | phone_encrypted  |
+--------------+------------------+------------------+
| 12345        | gAAAAABl2K8...   | gAAAAABl2K9...   |
|              | [cifrado]        | [cifrado]        |
+--------------+------------------+------------------+
✅ SEGURIDAD ROBUSTA: Aunque hackeen la BD, los datos están protegidos e ilegibles.
```

#### En logs:

❌ **INCORRECTO:**

```
[2026-01-15] Orden creada para: juan@email.com, tel: +5491155551234

⚠️ Cualquiera con acceso a logs ve los datos personales
```

✅ **CORRECTO:**

```
[2026-01-15] Orden creada para: j***@***.com, tel: ***1234

O mejor:
[2026-01-15] Orden 12345 creada para comprador_id: 67890

✅ Los datos personales están ofuscados o reemplazados
por IDs, protegiendo la privacidad.
```

### Referencias

- [OWASP Data Protection:](https://owasp.org/www-community/controls/Protect_Data_At_Rest) Mejores prácticas de protección de datos.

- [PCI DSS:](https://www.pcisecuritystandards.org/) Estándar de seguridad para datos de tarjetas.

- [CWE-359: Exposure of Private Personal Information:](https://cwe.mitre.org/data/definitions/359.html) Documentación técnica sobre exposición de información personal privada.

- [OWASP Top 10 - A02:2021 Sensitive Data Exposure:](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/) Documentación sobre exposición de datos sensibles, incluye PII.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **PII** | Personally Identifiable Information - Datos que identifican a una persona (nombre, email, teléfono, documento). |
| **Cifrado en reposo** | Cifrar datos cuando están guardados en la base de datos (no solo en tránsito). |
| **Enmascaramiento** | Ocultar parte de un dato sensible (ej: mostrar j***@***.com en vez del email completo). |
| **Minimización** | Principio de solo guardar los datos estrictamente necesarios. |
| **Retención** | Por cuánto tiempo guardan los datos antes de eliminarlos. |

## Validación de datos

La validación de datos es la primera línea de defensa de cualquier sistema porque actúa como el filtro que separa los datos legítimos del código malicioso diseñado para manipular la lógica del servidor. Es el vector de ataque más común; sin una validación rigurosa, un atacante puede inyectar comandos (como en ataques SQLi o XSS) que el sistema procesa por error como instrucciones válidas. En esencia, si una aplicación "confía" plenamente en lo que el usuario escribe, un atacante puede causar vulnerabilidades de seguridad, corrupción de datos o comportamiento inesperado.

### Principios de validación

- **Validar tanto el frontend como el backend,**  nunca confiar solo en validaciones del lado del cliente.

- **Usar allowlist y no blocklist,**  definir qué está permitido y no que está prohibido.

- **Validar tipo y formato,**  verificar que los datos son del tipo esperado.

- **Validar rangos,**  aceptar solo la cantidad de caracteres necesarios estableciendo límites lógicos.

- **Rechazar lo invalidado**  sin intentar "arreglar" datos malformados y gestionando los manejos de errores para evitar entregar información técnica extra en las respuestas.

### Validaciones por tipo:

- **Strings:**  longitud máxima, caracteres permitidos, encoding.

- **Números:**  Tipo (entero/decimal), rango, signo.

- **Emails:**  formato válido, longitud.

- **URLs:**  protocolo permitido (HTTPS), dominio válido.

- **IDs:**  validar formato esperado, existencia.

- **Fechas:**  formato ISO, rango lógico.

Un campo sin validar puede ser la puerta de entrada para SQL injection, XSS o ejecución de comandos. Revisa estos ejemplos:

#### Validar en backend (no solo frontend):

❌ **INCORRECTO: SOLO FRONTEND**

```
JavaScript (navegador)
  if (email.includes("@")) { submit(); }

⚠️ Problema: El atacante puede saltarse el JavaScript con herramientas externas.
```

✅ **CORRECTO: FRONTEND + BACKEND**

```
Navegador (JavaScript)
  if (email.includes("@")) { submit(); }

Servidor (Python)
  if not is_valid_email(email):
      return error("Email inválido")

✅ Doble capa de seguridad: El servidor siempre valida la integridad de los datos.
```

#### Allowlist vs Blocklist:

❌ **INCORRECTO: BLOCKLIST (qué está prohibido)**

```
# Prohibir caracteres peligrosos
if "<script>" in input or "DROP TABLE" in input:
    reject()

⚠️ Problema: Los atacantes siempre encuentran formas de evitar la lista negra.
```

✅ **CORRECTO: ALLOWLIST (qué está permitido)**

```
# Solo permitir lo que esperamos
if not re.match(r"^[a-zA-Z0-9_]{3,20}$", username):
    reject()

✅ Si no coincide exactamente con lo permitido, rechazar.
```

#### Validar tipo y formato:

❌ **INCORRECTO: SIN VALIDACIÓN DE TIPO**

```
# Aceptar cualquier cosa
order_id = request.get("order_id")
order = get_order(order_id)

⚠️ Problema: ¿Qué pasa si order_id = "abc" o
   "1; DROP TABLE orders"?
```

✅ **CORRECTO: CON VALIDACIÓN**

```
order_id = request.get("order_id")

# Validar que es un número
if not order_id.isdigit():
    return error("ID de orden inválido")

order = get_order(int(order_id))

✅ Al forzar el tipo de dato, evitas inyecciones y
   errores de ejecución inesperados.
```

### Referencias

- [OWASP Input Validation:](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) Guía completa de validación de entrada.

- [OWASP SQL Injection Prevention:](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) Cómo prevenir SQL injection.

- [OWASP XSS Prevention:](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) Cómo prevenir Cross-Site Scripting.

- [OWASP Command injection:](https://owasp.org/www-community/attacks/Command_Injection) Cómo prevenir inyección de comandos.

- [CWE-20 (Input Validation):](https://cwe.mitre.org/data/definitions/20.html) Documentación sobre validación incorrecta y definición de su riesgo.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **Validación** | Verificar que los datos recibidos tienen el formato y valores esperados. |
| **Sanitización** | Limpiar datos de entrada, removiendo caracteres peligrosos. |
| **SQL Injection** | Ataque donde se inyecta código SQL malicioso a través de campos de entrada. |
| **XSS** | Cross-Site Scripting - Ataque donde se inyecta JavaScript malicioso en páginas web. |
| **Command Injection** | Ataque donde se inyectan comandos del sistema operativo. |
| **Allowlist (Lista blanca)** | Definir QUÉ está permitido (más seguro). |
| **Blocklist (Lista negra)** | Definir QUÉ está prohibido (menos seguro, siempre se puede evadir). |
| **Regex** | Regular Expression - Patrón para validar formato de texto. |

## Manejo de errores

Los mensajes de error pueden revelar información valiosa para atacantes: estructura de base de datos, rutas de archivos, versiones de software y lógica de negocio.

- Los mensajes deben ser genéricos para el usuario, no se deben exponer detalles técnicos.

- Los detalles solo en logs, errores tipo stack traces y técnicos van a los logs internos.

- Es buena práctica usar códigos de error que permitan investigar sin exponer detalles.

- Consistencia usando los mismos mensajes para errores similares.

### Información a NO exponer

- Stack traces o excepciones.

- Rutas de archivos del sistema.

- Consultas SQL o errores de base de datos.

- Nombres de tablas o columnas.

- Versiones de software o frameworks.

- IPs internas o nombres de servidores.

- Si un usuario existe o no (en login).

Un mensaje de error detallado es oro para un atacante: revela rutas, tecnologías y lógica interna. Compara estos escenarios:

### Referencias

- [OWASP Input Validation:](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) Guía completa de validación de entrada.

- [OWASP SQL Injection Prevention:](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) Cómo prevenir SQL injection.

- [OWASP XSS Prevention:](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) Cómo prevenir Cross-Site Scripting.

- [OWASP Command injection:](https://owasp.org/www-community/attacks/Command_Injection) Cómo prevenir inyección de comandos.

- [CWE-20 (Input Validation):](https://cwe.mitre.org/data/definitions/20.html) Documentación sobre validación incorrecta y definición de su riesgo.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **Stack Trace** | Detalle técnico del error que muestra líneas de código, rutas de archivos, etc. |
| **Information Disclosure** | Fuga de información - Revelar datos internos del sistema en mensajes de error. |
| **Error genérico** | Mensaje de error que no revela detalles técnicos (ej: "Ocurrió un error"). |
| **Logging** | Guardar registro de eventos y errores internamente (no mostrar al usuario). |

## Seguridad en notificaciones (WebHooks)

MercadoLibre envía notificaciones (webhooks) a tu aplicación cuando ocurren eventos importantes: nuevas órdenes, pagos, cambios en publicaciones, mensajes, etc. Tu aplicación debe tener un endpoint público que reciba estas notificaciones.

Sin la protección adecuada de éste endpoint, un atacante podría:

- Enviar notificaciones falsas.

- Enviar y procesar datos fraudulentos.

- Realizar un denegación de servicio DoS.

Es por esto que recomendamos implementar los siguientes requisitos:

### Usar HTTPS obligatoriamente

❌ **INCORRECTO:**

```
http://tuapp.com/webhooks/meli

Problema: Las notificaciones viajan sin cifrar. Un atacante puede interceptar y leer los datos.
```

✅ **CORRECTO:**

```
https://tuapp.com/webhooks/meli

Las notificaciones viajan cifradas. Nadie puede leer el contenido en tránsito.
```

Cuando configuras tu aplicación en el gestor de aplicaciones, la URL de callback debe usar HTTPS.

### Validar que la notificación viene de Mercadolibre

Mercadolibre envía notificaciones desde estas IPS:

- 54.88.218.97

- 18.215.140.160

- 18.213.114.129

- 18.206.34.84

- 35.236.253.169

- 35.245.91.34

- 35.245.20.104

- 35.186.182.146

El flujo con la validación debería verse así:

[Placeholder: diagrama-validacion-ips-webhook.png]

**Importante:**  Las IPs pueden cambiar. Consulta siempre la documentación para obtener la lista actualizada.

Otra opción de validar es consultando el recurso, la forma más segura de validar una notificación es no confiar en los datos del webhook, sino usar la notificación como un "aviso" y luego consultar directamente a la API de mercadolibre, sería algo así:

```
FLUJO SEGURO:
                            |
  1. Recibes notificación: |  {
                            |    "resource": "/orders/123",
                            v    "user_id": 789 ...
                               }

  2. Responder HTTP 200 inmediatamente
     (confirmar recepción)
                           |
                           v
  3. Encolar para procesamiento async
                           |
                           v
  4. Consultar directamente a la API de MELI:
     GET https://api.mercadolibre.com/orders/123
     con TU access_token
                           |
                           v
  5. Usar los datos de la respuesta de la API
     ⚠️ (NO los datos del webhook)
```

### Responder rápidamente

MercadoLibre espera una respuesta HTTP 200 en menos de 500 milisegundos:

❌ **SI NO RESPONDES A TIEMPO:**

```
Intento 1 --> Tu servidor (timeout) --> MELI reintenta
Intento 2 --> Tu servidor (timeout) --> MELI reintenta
...
Intento 8 --> Tu servidor (timeout) --> MELI desactiva tus
                                        notificaciones

Resultado: Pierdes notificaciones y debes reactivar
           manualmente.
```

✅ **PATRÓN CORRECTO:**

```
1. Recibir webhook
2. Guardar en cola (Redis, RabbitMQ, base de datos)
3. Responder HTTP 200 inmediatamente
4. Procesar la cola de forma asíncrona

    Webhook --> +-----------------+
                | Recibir         | --> HTTP 200 (inmediato)
                | y encolar       |
                +--------+--------+
                         |
                         v
                +-----------------+
                | Cola            |
                | (async)         |
                +--------+--------+
                         |
                         v
                +-----------------+
                | Procesar        | --> Consultar API MELI
                | (worker)        | --> Actualizar tu BD
                +-----------------+
```

### Proteger contra abuso o consumos excesivos

❌ **SIN PROTECCIÓN:**

```
  Atacante envía 10,000 requests/segundo
                   |
                   v
          Tu servidor se satura
                   |
                   v
    No puedes procesar webhooks reales de MELI
```

```
+------------------------------------------------+
| ✅ CON PROTECCIÓN: Implementa Rate Limiting            |
+------------------------------------------------+

+------------------------+-----------------------+
| Medida                 | Configuración sugerida |
+------------------------+-----------------------+
| Rate limit por IP      | 100 req/minuto máximo  |
| Timeout de conexión    | 30 segundos máximo     |
| Tamaño máx. de payload | 1 MB máximo            |
| Bloqueo de IPs         | Tras 10 req. inválidos |
+------------------------+-----------------------+

✅ Al limitar el tráfico, aseguras que los recursos de tu
   servidor estén siempre disponibles para Mercado Libre.
```

### Referencias

- [MELI - Notificaciones:](https://developers.mercadolibre.com.ar/es_ar/notificaciones) documentación oficial de notificaciones en Mercadolibre.

- [Webhook security:](https://owasp.org/www-community/attacks/Denial_of_Service) Riesgos asociados a webhooks.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **Webhook** | Notificación automática que MELI envía a tu servidor cuando algo cambia (nueva orden, pago, etc.). |
| **Payload** | En este contexto son los datos que vienen dentro de la notificación (el contenido JSON). |
| **IP Whitelist** | Lista de IPs permitidas - solo aceptar conexiones de esas IPs específicas. |
| **Rate Limiting** | Limitar cuántas peticiones por minuto puede recibir tu servidor. |
| **Async / Asíncrono** | Procesar algo en segundo plano, sin hacer esperar al que envió la petición. |
| **DoS** | Denial of Service - Ataque que satura tu servidor con muchas peticiones. |

## Protección contra abuso

La aplicación que se integra puede ser objetivo de ataques automatizados: fuerza bruta, scraping, denegación de servicio. Además, se debe respetar los límites de la API de Mercado Libre para evitar bloqueos.

### Rate limiting en la aplicación que se integra (sugerencia)

- Para el inicio de sesión 5 intentos / 15 min.

- Registro de nuevas cuentas 3 intentos / hora / IP.

- APIs / endpoints sensibles 30 - 60 peticiones / min (a considerar según necesidad del negocio).

- APIs / endpoints generales 100 - 200 peticiones / min.

❌ **SIN RATE LIMITING:**

```
Atacante hace 10,000 requests por minuto
Tu servidor se satura
O: Tu cuenta de MercadoLibre se bloquea por exceder limites
```

✅ **CON RATE LIMITING:**

```
+----------------------------+--------------------+
|     RATE LIMITS RECOMENDADOS                    |
+----------------------------+--------------------+
| Endpoint                   | Limite             |
+----------------------------+--------------------+
| Login                      | 5 intentos/15 min  |
| Registro de cuentas        | 3 intentos/hora/IP |
| APIs sensibles             | 30-60 req/min      |
| APIs generales             | 100-200 req/min    |
+----------------------------+--------------------+

Request 101 en 1 minuto:
   -> HTTP 429 Too Many Requests
   -> Header: Retry-After: 30
```

### Protección adicional

- Implementar sistema de captcha y que se active especialmente después de N intentos fallidos o al detectar comportamiento sospechoso.

- Bloqueo temporal de IP o de cuenta ante abusos.

- Detección de bots mediante el análisis de patrones de comportamiento.

### Referencias

- [OWASP Blocking Brute Force:](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks) Cómo prevenir ataques de fuerza bruta.

- [OWASP Denial of Service:](https://owasp.org/www-community/attacks/Denial_of_Service) Guía de protección contra DoS.

- [Rate Limiting Best Practices:](https://www.cloudflare.com/learning/bots/what-is-rate-limiting/) Mejores prácticas de rate limiting.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **Rate Limiting** | Limitar cuántas peticiones puede hacer un usuario/IP por minuto. |
| **Brute Force** | Ataque que prueba muchas combinaciones hasta encontrar la correcta (ej: contraseñas). |
| **CAPTCHA** | Prueba para verificar que el usuario es humano y no un bot. |
| **DoS / DDoS** | (Distributed) Denial of Service - Ataque que satura el servidor con peticiones. |
| **Scraping** | Extracción automatizada de datos de un sitio web. |
| **BOT** | Programa automatizado que hace peticiones sin intervención humana. |
| **HTTP 429** | Código de respuesta que significa "Demasiadas peticiones" (Too Many Requests). |
| **Throttling** | Reducir la velocidad de respuesta cuando hay muchas peticiones. |

## Seguridad en Dependencias

Las librerías de terceros pueden contener vulnerabilidades conocidas. Un componente desactualizado puede ser la puerta de entrada a su aplicación que se integra.

Se recomienda:

- Realizar escaneos regulares para verificar vulnerabilidades conocidas al menos semanalmente, existen diferentes soluciones en el mercado que podrían ayudarle en este proceso: Snyk, Owasp dependency-check, npm audit, renovate entre otros.

- Aplicar las actualizaciones de seguridad identificadas lo antes posible.

- Se recomienda usar versiones específicas y no rangos abiertos.

- Es importante evaluar una dependencia a nivel de seguridad y mantenimiento antes de usarla, esto se puede hacer mediante la herramientas mencionadas anteriormente.

- Es útil también estar al tanto de noticias relacionadas con dependencias comunes, las empresas detrás de estos software análisis de dependencia suelen permitir suscribirse a sus boletines informativos (newsletters).

### ¿Cómo podemos verificarlo?, veamos algunos ejemplos en lenguajes comúnes:

| **Lenguaje** | **Herramienta** | **Comando** |
| --- | --- | --- |
| Python | Safety, pip-audit | `safety check` ó `pip-audit` |
| Node.js | Npm audit | `npm audit` |
| Java | OWASP dependency-check | Plugin maven/gradle |
| Otros lenguajes | Snyk | `snyk test` |

#### Ejemplo de resultado:

```
$ npm audit
found 3 vulnerabilities (1 low, 1 moderate, 1 high)

+---------------+---------------------------------------+
| high          | Prototype Pollution in lodash         |
+---------------+---------------------------------------+
| Package       | lodash                                |
+---------------+---------------------------------------+
| Patched in    | >=4.17.21                             |
+---------------+---------------------------------------+
| Dependency of | your-app                              |
+---------------+---------------------------------------+
| Path          | your-app > lodash                     |
+---------------+---------------------------------------+
```

### Referencias

- [OWASP Dependency Check:](https://owasp.org/www-project-dependency-check/) Herramienta para detectar vulnerabilidades en dependencias.

- [Snyk:](https://snyk.io/) Plataforma de seguridad para dependencias.

- [npm audit:](https://docs.npmjs.com/cli/v10/commands/npm-audit) Documentación de auditoría de npm.

- [Pip-audit:](https://github.com/pypa/pip-audit) Herramienta de auditoría para Python.

- [CWE-1104 (Unmaintained Components):](https://cwe.mitre.org/data/definitions/1104.html) Documentación sobre componentes sin mantenimiento.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **Dependencia** | Librería o paquete de terceros que usas en tu proyecto (ej: requests, lodash, axios). |
| **Vulnerabilidad** | Falla de seguridad en el código que puede ser explotada. |
| **CVE** | Common Vulnerabilities and Exposures - Identificador único para vulnerabilidades conocidas. |
| **npm audit** | Comando de Node.js para detectar vulnerabilidades en dependencias. |
| **pip-audit / safety** | Herramientas de Python para detectar vulnerabilidades en dependencias. |
| **Patch** | Actualización que corrige una vulnerabilidad. |

**Siguiente** : [Monitoreo](https://developers.mercadolibre.com.ar/es_ar/monitoreo).
