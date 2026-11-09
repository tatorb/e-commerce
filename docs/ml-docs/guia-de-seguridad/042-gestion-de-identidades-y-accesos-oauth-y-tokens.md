<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestion-de-identidades-y-accesos-oauth-y-tokens -->
<!-- Sección: Guía de seguridad -->

# Gestión de Identidades y Accesos (OAuth y Tokens)

Última actualización 30/03/2026

## Gestión de Identidades y Accesos

### OAuth y gestión de Tokens

La puerta de entrada a la experiencia del seller es el protocolo OAuth 2.0, el estándar para la autorización en plataformas abiertas que garantiza el acceso adecuado a información de nuestros clientes.

**Al utilizar este protocolo, el integrador asegura que el seller nunca tenga que compartir su contraseña directamente, reduciendo el riesgo de robo de identidad.**

Mercadolibre dispone un mecanismo único de autenticación y autorización para acceder a las APIs del ecosistema en nombre de un Seller. Sin embargo es necesario que la aplicación que se integra implemente sus propios controles de autenticación y autorización sólidos, que garanticen que la información pueda ser gestionada de manera legítima y segura.

### Credenciales de la aplicación

Garantice en todo momento que las credenciales de la aplicación que se integra (Client_ID, Client_Secret, Access_token y refresh_token) **estén almacenadas de forma segura, cifradas en reposo y con acceso restringido.**

## Protección de tokens y credenciales

Los access tokens de MercadoLibre permiten operar en nombre del seller. Un token comprometido da acceso completo a su cuenta: órdenes, publicaciones, mensajes, datos de compradores, entre otros datos sensibles.

### Almacenamiento seguro

- **Cifrado en base de datos:**  cifrar los Access Token a través de una clave de cifrado idealmente ubicada en un gestor de llaves (vault seguro), evitando su almacenamiento en código u archivos de configuración, y usando algoritmo de cifrado AES-256 para su almacenamiento en base de datos.

- **Sanitización de logs:**  prestar especial cuidado con los logs, garantizando que se encuentran sanitizados y no registran tokens, ni información confidencial de la conexión. Evitar desde el código registrar en logs objetos completos que pueden contener data PII o Secretos.

- **En headers, no en URLs:**  los tokens deben viajar siempre mediante headers y no query strings.

A continuación te mostramos cómo se ve un almacenamiento inseguro vs uno seguro, para que puedas identificar en cuál situación está tu aplicación:

### En la base de datos

❌ **INCORRECTO – Token sin cifrar:**

```
           TABLA: seller_tokens

  +------------------+------------------------------------------+
  | seller_id        | access_token                             |
  +------------------+------------------------------------------+
  | 12345            | APP-1234567890-abcdef-123456...          |
  | 67890            | APP-0987654321-fedcba-987654...          |
  +------------------+------------------------------------------+

Problema: Si hackean tu base de datos, tienen todos los tokens en texto plano. Pueden acceder a TODAS las cuentas de tus sellers.
```

✅ **CORRECTO – Token cifrado con AES-256:**

```
           TABLA: seller_tokens

  +------------------+------------------------------------------+
  | seller_id        | access_token_encrypted                   |
  +------------------+------------------------------------------+
  | 12345            | gAAAAABl2K8xQ7N...[datos cifrados]       |
  | 67890            | gAAAAABl2K9yR8M...[datos cifrados]       |
  +------------------+------------------------------------------+

La clave de cifrado está en un gestor de secretos (AWS Secrets Manager, HashiCorp Vault, etc.), 
NO en el código ni en la misma base de datos.

Resultado: Aunque hackeen la BD, los tokens son inútiles sin la clave.
```

### En el código

❌ **INCORRECTO - Credenciales hardcodeadas:**

```
# config.py
CLIENT_ID = "1234567890"
CLIENT_SECRET = "AbCdEfGhIjKlMnOpQrStUvWxYz"  # ¡PELIGRO!

Problemas:
- Cualquiera con acceso al código ve las credenciales
- Si subes a GitHub, quedan expuestas públicamente
- Si un desarrollador se va, se lleva las credenciales
```

✅ **CORRECTO - Credenciales en variables de entorno:**

```
# .env (este archivo NUNCA se sube al repositorio)
CLIENT_ID=1234567890
CLIENT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz

# config.py (este sí se sube)
import os
CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")

# .gitignore (asegura que .env no se suba)
.env
.env.local
.env.*.local
```

### En los logs

❌ **INCORRECTO - Token visible en logs:**

```
[2026-01-15 10:30:45] INFO:  Conectando con seller 12345
[2026-01-15 10:30:45] DEBUG: Token: APP-1234567890-abcdef-123456789...
[2026-01-15 10:30:45] INFO:  Obteniendo órdenes...
[2026-01-15 10:30:46] DEBUG: Headers: {"Authorization": "Bearer APP-1234567890..."}

Problema: Cualquiera con acceso a logs puede ver los tokens.
```

✅ **CORRECTO - Token sanitizado en logs:**

```
[2026-01-15 10:30:45] INFO:  Conectando con seller 12345
[2026-01-15 10:30:45] DEBUG: Token: [REDACTED]
[2026-01-15 10:30:45] INFO:  Obteniendo órdenes...
[2026-01-15 10:30:46] DEBUG: Headers: {"Authorization": "Bearer [REDACTED]"}

O mejor: No loguear tokens ni headers de autorización en absoluto.
```

### En tránsito / transmisión

❌ **INCORRECTO - Token en URL (query string):**

```
GET https://api.mercadolibre.com/orders?access_token=APP-1234567890...

Problemas:
- Queda en logs del servidor
- Queda en historial del navegador
- Puede quedar en logs de proxies intermedios
- Visible en la barra de direcciones
```

✅ **CORRECTO - Token en header:**

```
GET https://api.mercadolibre.com/orders
Headers:
  Authorization: Bearer APP-1234567890...

Ventajas:
- No queda en URLs
- No queda en historial
- Más difícil de filtrar accidentalmente
```

### ¿Cómo podríamos verificar?

**Buscar credenciales hardcodeadas en tu código:**

```
# Buscar client_secret hardcodeado
grep -rn "client_secret.*=.*['\"]" --include="*.py" --include="*.js" --include="*.ts" .

# Buscar patrones de tokens de MercadoLibre
grep -rn "APP-[0-9]" --include="*.py" --include="*.js" --include="*.ts" .
```

**Verificar que .env está en .gitignore:**

```
cat .gitignore | grep ".env"
```

**Revisar los logs en busca de tokens o info confidencial:**

```
grep -rn "APP-" logs/  # Ajustar ruta según tu proyecto
grep -rn "access_token" logs/
```

## Renovación y revocación de tokens

La revocación de tokens no es solo un mecanismo utilizado para cuando las cosas salen mal. Es parte fundamental del ciclo de vida de las credenciales: los tokens deben renovarse periódicamente, eliminarse cuando ya no son necesarios, y revocarse inmediatamente ante cualquier sospecha de compromiso.

**Una buena gestión de revocación protege tanto a tu aplicación como a los sellers que confían en ti.**

Es por esto necesario que:

- Implementar refresh automático revocando antes de que expire el access_token.

- Manejar errores de refresh: si el refresh falla se debe solicitar nuevamente re-autorización al seller.

- Almacenar de forma segura el nuevo refresh token que se genera en cada revocación.

- Se debe eliminar tokens almacenados en caso de que el seller desconecte su app de su cuenta.

- En caso de sospechas de compromiso de los tokens, se debe revocar tokens vía API y solicitar re-autorización.

- En caso de que un empleado deje la empresa, se debe auditar y rotar credenciales que pudiera conocer.

A continuación te mostramos cómo se ve un manejo incorrecto y correcto de tokens:

### Revocación de tokens

❌ **INCORRECTO - No manejar expiración:**

```
1. Obtienes access_token
2. Lo guardas
3. Lo usas por siempre hasta que falla
4. Cuando falla, muestras error al usuario

Problema: El usuario experimenta errores inesperados.
```

✅ **CORRECTO - Refresh automático:**

```
1. Obtienes access_token (válido por 6 horas)
2. Guardas access_token Y refresh_token
3. Antes de que expire (ej: a las 5 horas), refrescas automáticamente
4. Guardas el nuevo access_token y refresh_token
5. El usuario nunca ve un error de token expirado
```

### A continuación un ejemplo visual:

### Escenarios de revocación

| **Escenario** | **Acción requerida** |
| --- | --- |
| Seller se desconecta de tu app | Eliminar todos los tokens almacenados de ese seller |
| Sospecha de compromiso | Revocar tokens vía API y pedir re-autorización |
| Empleado deja la empresa | Auditar y rotar todas las credenciales que conocía |
| Error de refresh | Pedir re-autorización al seller |

## Referencias

- [OWASP Password Storage:](https://owasp.org/www-community/attacks/password_cracking) cómo almacenar contraseñas de forma segura.

- [OWASP Secrets Management:](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) guía completa de gestión de secretos y credenciales.

- [CWE-312:](https://cwe.mitre.org/data/definitions/312.html) documentación técnica del problema exacto (guardar tokens sin cifrar). Útil para entender el riesgo.

- [OWASP TOP 10 - A02:2021 Cryptographic Failures:](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/) referencia de alto nivel sobre fallos criptográficos.

## Glosario

| **Término** | **Significado** |
| --- | --- |
| **Access token** | Credencial temporal que permite a tu app actuar en nombre del seller |
| **Refresh Token** | Token de larga duración usado para obtener nuevos access tokens sin pedir autorización al seller otra vez |
| **Cifrado en reposo** | Cifrar datos cuando están guardados (en base de datos o disco), no solo cuando viajan por la red |
| **Texto plano** | Datos sin cifrar, legibles por cualquiera que acceda a ellos |
| **Hardcodear** | Escribir credenciales directamente en el código fuente (mala práctica) |
| **Variables de entorno** | Forma de pasar configuración sensible al programa sin escribirla en el código |
| **Secrets Manager** | Servicio especializado para almacenar y gestionar credenciales de forma segura (ej: HashiCorp Vault, AWS Secrets Manager) |
| **Rotación de credenciales** | Cambiar tokens/contraseñas periódicamente para limitar el impacto si fueron comprometidas |
| **.env** | Archivo donde se guardan variables de entorno localmente. Nunca debe subirse al repositorio |
| **.gitignore** | Archivo que indica a Git qué archivos NO deben subirse al repositorio (como .env) |

**Siguiente** : [Autenticación segura](https://developers.mercadolibre.com.ar/es_ar/autenticacion-segura).
