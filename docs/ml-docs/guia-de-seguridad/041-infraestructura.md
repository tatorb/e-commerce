<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/infraestructura -->
<!-- Sección: Guía de seguridad -->

# Infraestructura (Cifrado y TLS)

Última actualización 30/03/2026

## Infraestructura: Cifrado y seguridad de transporte

Toda comunicación entre el usuario final, la aplicación que se integra y las APIs de mercado libre viaja a través de internet, una red pública donde los datos pueden ser interceptados, leídos o modificados por atacantes.

**El cifrado de transporte (TLS) es la primera línea de defensa que protege esta comunicación.**

### ¿Qué protegemos con TLS?

- **Interceptación de datos - Confidencialidad:**  los datos estarán cifrados, ilegibles para terceros.

- **Modificación en tránsito - Integridad:**  TLS garantiza que la información no ha sido modificada durante el tránsito.

- **Autenticidad - Identidad del servidor:**  a través de los certificados digitales, TLS asegura al usuario que el servidor remoto "es efectivamente quien dice ser", esto evita que puedan usar el nombre de tu organización para construir sitios de phishing.

### Una implementación incorrecta de TLS puede resultar en:

- Robo de tokens de acceso (ATO).

- Fuga de información de clientes.

- Manipulación no autorizada de datos.

- Pérdida de confianza.

- Incumplimiento regulatorio: PCI DSS, LGPD, GDPR entre otras.

## Requisitos de TLS

Es necesario versiones de TLS seguras tales como: **TLS 1.3 (recomendado) o TLS 1.2** . Las versiones de TLS (1.0 y 1.1) tienen vulnerabilidades conocidas que permiten a atacantes descifrar comunicaciones. No es suficiente con "tener HTTPS" - la versión y configuración del protocolo son críticas.

### Cipher suites recomendadas

#### Para TLS 1.3 (idealmente)

- `TLS_AES_256_GCM_SHA384`

- `TLS_AES_128_GCM_SHA256`

- `TLS_CHACHA20_POLY1305_SHA256`

#### Para TLS 1.2 (aceptadas)

- `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`

- `TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256`

- `TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384`

- `TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256`

### Cipher suites no aceptadas

Cualquier suite que use:

- RC4 (vulnerable)

- DES/3DES (débil)

- MD5 (broken)

- CBC mode sin AEAD (vulnerable a padding oracle)

- RSA key exchange sin ECDHE (sin forward secrecy)

- NULL encryption

- EXPORT ciphers

### Visualización del problema

❌ **CON TLS 1.0 o 1.1 (vulnerable):**

```
Tu App ---------------------------------► API MercadoLibre
         |
    [Atacante]
         |
         +-- Puede explotar vulnerabilidades conocidas
             como BEAST, POODLE, etc. para descifrar
             tus tokens y datos.
```

✅ **CON TLS 1.2+ (seguro):**

```
Tu App ════════════════════════════════► API MercadoLibre
         |
    [Atacante]
         |
         +-- No puede descifrar la comunicación.
             Los datos están protegidos.
```

## ¿Cómo verificar qué versión de TLS usa mi servidor?

### Opción 1: usar SSL Labs

1. Ve a: [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/)

2. Ingresa el dominio de la aplicación que se integra (ej: tuapp.com)

3. Espera que se haga la evaluación.

4. Busca la sección de "protocols"

**Resultado en SSL Labs:**

| **Resultado** | **Acción** |
| --- | --- |
| TLS 1.3: Yes, TLS 1.2: Yes, TLS 1.1: No, TLS 1.0: No | ✅ Correcto |
| TLS 1.1: Yes o TLS 1.0: Yes | ❌ Deshabilitar versiones antiguas |

### Opción 2: verificar con comandos mediante una terminal en el servidor

```
# Verificar si TLS 1.3 está habilitado (recomendado)
openssl s_client -connect tudominio.com:443 -tls1_3

# Verificar si TLS 1.2 está habilitado (debe funcionar)
openssl s_client -connect tudominio.com:443 -tls1_2

# Verificar si TLS 1.1 está deshabilitado (debe fallar)
openssl s_client -connect tudominio.com:443 -tls1_1

# Verificar si TLS 1.0 está deshabilitado (debe fallar)
openssl s_client -connect tudominio.com:443 -tls1
```

| **Comando** | **Resultado esperado** | **Significa** |
| --- | --- | --- |
| `-tls1_3` | Conexión exitosa | ✅ TLS 1.3 habilitado (ideal) |
| `-tls1_3` | Error de conexión | ⚠️ TLS 1.3 no disponible (aceptable si TLS 1.2 funciona). Se recomienda habilitarlo |
| `-tls1_2` | Conexión exitosa | ✅ TLS 1.2 habilitado (mínimo requerido) |
| `-tls1_2` | Error de conexión | ❌ TLS 1.2 no habilitado (Problema grave), es necesario habilitarlo |
| `-tls1_1, -tls1` | Error de conexión | ✅ TLS 1.1 deshabilitado (correcto). Caso contrario deben deshabilitar en el menor tiempo posible |

Nota:

El parámetro `-tls1_3` requiere OpenSSL 1.1.1 o superior. Si tu versión de OpenSSL es anterior, actualízala o usa SSL Labs para verificar TLS 1.3.

## Requisitos de Certificados

El certificado digital es el "documento de identidad" de un servidor. Cuando una aplicación se conecta a https://api.mercadolibre.com, el certificado SSL le permite verificar que realmente está hablando con Mercadolibre y no con un atacante.

**Deshabilitar la validación de certificados es equivalente a:**

- Aceptar un documento de identidad sin mirar la foto.

- Firmar un contrato sin verificar quién te lo presenta.

- Entregar las llaves de tu casa a cualquiera que diga ser el cerrajero.

**Es por esto que la aplicación que se integra debe:**

### Validar certificados

Siempre tener habilitada la opción de verificación de certificados en producción.

❌ **Con la validación de certificados deshabilitada:**

```
Tu app acepta CUALQUIER certificado, incluso uno falso de un atacante.

Tu App ----------► [Atacante con cert falso] ----------► MercadoLibre
                            |
                            +-- Lee y modifica TODO
```

✅ **Con la validación habilitada:**

```
Tu app rechaza certificados inválidos o falsos.

Tu App ══════════════════════════════════════════► MercadoLibre
             [Atacante] ✗ No puede interceptar
```

**Ejemplos de malas prácticas y su correcta implementación.**

**En Python:**

```
# ❌ ¡PELIGRO!
requests.get(url, verify=False)

# ✅ Lo correcto:
requests.get(url)  # Por defecto valida
# o explícitamente:
requests.get(url, verify=True)
```

**En Node.js:**

```
// ❌ ¡PELIGRO!
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// ✅ Lo correcto es no hacer nada especial, valida por defecto.
```

**En PHP:**

```
# ❌ ¡PELIGRO!
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

# ✅ Lo correcto:
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
```

**Para otros lenguajes busca estos patrones peligrosos (ejemplos comunes):**

| **Lenguaje** | **Patrón peligroso** | **Sí lo encuentras:** |
| --- | --- | --- |
| Java | `TrustAllCerts` y/o `HostnameVerifier` que retorna true | ❌ Problema grave, usar el SSLContext por defecto ya verifica correctamente |
| C#/.NET | `ServerCertificateValidationCallback` = ... que retorna true | ❌ Problema grave, se recomienda no configurar ningún callback ya que usa validación por defecto |
| Go | `InsecureSkipVerify: true` | ❌ Problema grave, usar cliente por defecto ya verifica |
| cURL | `--insecure` o `-k` | ❌ Revisar si es producción, quitar la flag –insecure o -k |

### Verificar hostname

El CN (Common Name) o SAN (Subject Alternative Name) debe coincidir con el dominio al que te conectas.

❌ **INCORRECTO:**

```
Te conectas a: api.mercadolibre.com
Certificado dice: *.ejemplo-atacante.com

→ Sin verificación de hostname, tu app acepta este certificado falso
```

✅ **CORRECTO:**

```
Te conectas a: api.mercadolibre.com
Certificado dice: *.mercadolibre.com (coincide)

→ Tu app verifica que el nombre coincide antes de continuar
```

**¿Cómo validarlo?**

La mayoría de librerías HTTP modernas verifican el hostname por defecto. Verifica que no lo haya deshabilitado de forma explícita:

| **Lenguaje** | **Patrón peligroso** | **Sí lo encuentras:** |
| --- | --- | --- |
| Python | `assert_hostname=False` | ❌ Problema, elimina el patrón peligroso o establece el valor en true |
| Node.js | `checkServerIdentity: () => undefined` | ❌ Problema, quitar esta opción completamente |
| Java | `setHostnameVerifier(NoopHostnameVerifier)` | ❌ Problema, quitar esta línea (usa verificador por defecto) |
| Go | `InsecureSkipVerify: true` | ❌ Problema, quitar esta línea (usa verificador por defecto). O establecer el valor en true |

### Verificar la validez de un certificado SSL

Para verificar fechas de generación, fechas de vencimiento, hostname, versiones de TLS, cipher suites, y más, podemos usar las herramientas de [SSL Labs](https://www.ssllabs.com/ssltest).

SSL Labs analiza tu servidor y te da una nota de A+ a T que resume el nivel de seguridad, donde A+ corresponde a un nivel de seguridad óptimo y T un bajo nivel de seguridad.

| **Nota** | **Significado** | **¿Qué hacer?** |
| --- | --- | --- |
| A+ | Excelente, configuración óptima con HSTS | ✅ Perfecto, no cambiar nada |
| A | Muy buena. Cumple todas las mejores prácticas | ✅ Aceptable para producción |
| B | Buena, pero con mejoras posibles | ⚠️ Revisar recomendaciones |
| C - T | Configuraciones inseguras | ❌ Corregir antes de producción |

**Ejemplo: verificar el certificado de Mercadolibre:**

1. Ve a [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/)

2. Consulta por: api.mercadolibre.com

3. Verás la nota

**Ejemplo: verificar TU certificado:**

1. Ve a [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/)

2. Consulta por: tu-dominio.com

3. Verás la nota: Si la nota es A o B estarás listo para producción. Si es C o menor debes revisar las recomendaciones y una vez corregidas realizar nuevamente la prueba

## ¿Cómo verificar que mi aplicación que se integra cumple con este apartado?

La seguridad no es un estado, es un proceso continuo. Una configuración que era segura ayer puede no serlo hoy: los certificados expiran, se descubren nuevas vulnerabilidades en cipher suites, las librerías se actualizan y cambian comportamientos por defecto, se puede introducir código inseguro.

Es por eso importante preguntarnos de manera periódica sí:

- ¿Mi aplicación usa TLS 1.2 o superior?

- ¿Tengo habilitada la validación de certificados?

- ¿Mis dependencias de SSL/TLS están actualizadas?

- ¿Mi servidor tiene certificado válido y vigente?

- ¿Estoy validando frecuentemente fechas de cambios de certificados?

## Referencias

- [OWASP TLS cheat sheet:](https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Protection_Cheat_Sheet.html) guía completa de mejores prácticas TLS.

- [SSL Labs:](https://www.ssllabs.com/ssltest) Herramienta para analizar la configuración TLS de tu servidor.

- [Mozilla SSL configuration generator:](https://ssl-config.mozilla.org/) genera configuración TLS segura para tu servidor.

- [CWE-295:](https://cwe.mitre.org/data/definitions/295.html) Documentación sobre la validación incorrecta de certificados.

- [testssl.sh:](https://github.com/drwetter/testssl.sh) Herramienta de línea de comandos para auditar TLS.

## Glosario

| **Término** | **Significado** |
| --- | --- |
| **TLS** | Transport Layer Security - Protocolo que cifra la comunicación entre tu app y el servidor. Versiones seguras: 1.2 y 1.3 |
| **SSL** | Secure Sockets Layer - Versión antigua de TLS, ya no es segura. No confundir con TLS |
| **HTTPS** | HTTP + TLS = Comunicación web cifrada. La "S" significa "Secure" |
| **Certificado digital** | Documento electrónico que verifica la identidad de un servidor (como una cédula digital) |
| **CA (Certificate Authority)** | Entidad confiable que emite certificados (ej: DigiCert, Let's Encrypt, Comodo) |
| **Cipher Suite** | Conjunto de algoritmos que se usan para cifrar una conexión |

**Siguiente** : [Gestión de Identidades y Accesos](https://developers.mercadolibre.com.ar/es_ar/gestion-de-identidades-y-accesos-oauth-y-tokens).
