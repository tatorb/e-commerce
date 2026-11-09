<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/autenticacion-segura -->
<!-- Sección: Guía de seguridad -->

# Autenticación segura

Última actualización 30/03/2026

## Autenticación segura

La aplicación que se integra puede llegar a tener sus propios usuarios (operadores, administradores, sub-cuentas) que acceden a datos de múltiples sellers de Mercado Libre. **Una autenticación débil significa:**

- Acceso no autorizado.

- Suplantación de identidad.

- Robo de credenciales.

- Acceso a datos de usuarios de Mercado Libre.

Es por eso que recomendamos las siguientes prácticas a tener en cuenta para que su sistema de autenticación sea seguro y robusto:

### Política de contraseñas seguras

- **Complejidad:**  mayúsculas, minúsculas, números y símbolos.

- **Longitud:**  mínimo 12 caracteres.

- **Verificación contra listas (Denylist):**  rechazar contraseñas comunes conocidas o que sigan patrones relacionados al usuario.

- **El almacenamiento seguro es fundamental:**  usar HASH con Argon2 o bcrypt (nunca texto plano ni MD5/SHA1).

Una contraseña débil es la puerta de entrada más fácil para un atacante. Compara estos ejemplos para evaluar tu política actual:

#### Ejemplo de contraseñas:

❌ **CONTRASEÑAS DÉBILES (no permitir):**

```
123456          -> Demasiado simple
password        -> Palabra común
admin123        -> Patrón predecible
empresa2026     -> Relacionada con el contexto
qwerty          -> Patrón de teclado
```

✅ **CONTRASEÑAS FUERTES (requerir):**

```
Mínimo 12 caracteres
+ Mayúsculas: A-Z
+ Minúsculas: a-z
+ Números: 0-9
+ Símbolos: !@#$%^&*
Ejemplo válido: "K9#mPx$vL2@nQ4"
```

### Almacenamiento de contraseñas

❌ **INCORRECTO:**

```
Texto plano:
  password = "MiContraseña123"

MD5 (roto):
  password = "5f4dcc3b5aa765d61d8327deb882cf99"
  -> Se descifra en segundos con tablas rainbow

SHA1 (débil):
  password = "cbfdac6008f9cab4083784cbd1874f76618d2a97"
  -> También vulnerable a tablas rainbow
```

✅ **CORRECTO:**

```
bcrypt:
  password = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.oUy..."
  -> Incluye salt automático
  -> Diseñado para ser lento (resistente a fuerza bruta)

Argon2 (recomendado):
  password = "$argon2id$v=19$m=65536,t=3,p=4$..."
  -> Resistente a ataques con GPU
```

### Flujo de recordar contraseña

El proceso de "Forgot Password" es un vector común de ataque cuando no se implementa con controles adecuados. Es necesario validar la seguridad del flujo de recuperación de contraseñas, verificando aspectos como:

- Enlaces de un solo uso y expiración corta.

- Imposibilidad de reutilización de tokens.

- Protección contra fuerza bruta.

- Integración con segundo factor de autenticación (2FA) para validación de identidad del usuario.

### ¿Cómo verificar?

1. Revisa el código de su aplicación en la funcionalidad de registro y cambio de contraseña.

2. Busca la función de hash que se usó.

**Sí encuentras:**

| **Resultado** | **Evaluación** |
| --- | --- |
| `bcrypt.hash()` ó `argon2.hash()` | ✅ Seguro |
| `hashlib.md5()` o `hashlib.sha1()` | ❌ Inseguro, cambiar en el menor tiempo posible. |
| Contraseña guardada sin hash | ❌ Crítico, cambiar inmediatamente |

## Autenticación multifactor (MFA)

Usar MFA es crucial porque añade una capa de defensa que neutraliza muy bien los ataques a cuentas, incluso si la contraseña ha sido robada o filtrada. Al exigir una segunda prueba de identidad que solo el usuario posee (TOTP, llaves de seguridad, notificaciones push o biometría), evita el secuestro de cuentas por phishing o fuerza bruta, protegiendo así la integridad de los datos sensibles y la confianza de los usuarios en la aplicación.

Se recomienda que los siguientes tipos de usuarios tengan MFA:

- **Administradores**  (obligatorio).

- **Operadores con acceso a funcionalidades sensibles**  (altamente recomendado).

- **Usuarios regulares**  (recomendado para acciones importantes).

Las siguientes operaciones se consideran críticas y deben ser protegidas con MFA:

#### Acceso administrativo y gestión de cuentas:

- Login inicial, en especial a paneles de control (backoffice) del integrador.

- Cambio de credenciales.

- Gestión de roles y permisos.

- Operaciones sobre ventas que generen un cambio importante.

- Gestión de datos sensibles o información de identificación personal (PII).

- Cambios críticos en el negocio (gestión de publicaciones, cambios de precios, stock).

**¿Por qué es crucial? Veamos un ejemplo:**

```
FLUJO DE AUTENTICACION: SEGURIDAD CON Y SIN MFA

SIN MFA (INSEGURO)

1. Atacante obtiene contrasena --> 2. Inicia sesion
--> 3. ACCESO COMPLETO ❌
   (Riesgo critico - Cuenta comprometida)

---------------------------------------------------

CON MFA (RECOMENDADO)

1. Atacante obtiene contrasena --> 2. Intenta iniciar sesion
--> 3. Sistema pide Codigo MFA --> 4. ACCESO DENEGADO ✅
   (Atacante NO tiene el           (Ataque bloqueado)
   dispositivo/app)
```

## Protección contra ataques de fuerza bruta

Un vector de ataque común es cuando el atacante prueba miles de combinaciones de usuario/contraseña por segundo usando herramientas automatizadas. Sin un mecanismo de protección adecuada, es solo cuestión de tiempo para que adivine credenciales válidas.

Es por esto que tener los siguientes controles podría prevenir que esto suceda:

- **Límites de intentos:**  máximo 5 intentos fallidos por cuenta.

- **Política de bloqueo temporal:**  15 - 30 minutos después de exceder los intentos.

- **CAPTCHA:**  mostrar desde el inicio y después de 3 intentos fallidos.

- **Notificación vía mail**  alertando al usuario sobre intentos de inicio de sesión fallidos y exitosos, con la ubicación desde la cual se hicieron los intentos, con hora y dispositivo.

Veamos cómo se comporta un sistema vulnerable vs uno protegido frente a ataques de fuerza bruta:

❌ **SIN PROTECCIÓN:**

```
Atacante:
Intento 1:  admin / 123456    --> ❌ Incorrecto
Intento 2:  admin / password  --> ❌ Incorrecto
Intento 3:  admin / admin123  --> ❌ Incorrecto
... (continua automaticamente)
Intento 10,000: admin / @Dm1n2026! --> ✅ ¡Correcto!

---------------------------------------------------

Tiempo total: ~5 minutos con herramienta automatica
☹️ Resultado: Atacante tiene acceso
```

✅ **CON PROTECCIÓN:**

```
Atacante:
Intento 1: admin / 123456   --> Incorrecto
Intento 2: admin / password --> Incorrecto
Intento 3: admin / admin123 --> Incorrecto + CAPTCHA aparece
Intento 4: admin / qwerty   --> Incorrecto + CAPTCHA
Intento 5: admin / letmein  --> Incorrecto

⛔ CUENTA BLOQUEADA POR 30 MINUTOS
[mail] Email enviado al usuario: "Detectamos intentos..."

---------------------------------------------------

⏳ Tiempo para 10,000 intentos: ~1000 horas
✅ Resultado: Atacante no puede continuar + Usuario alertado
```

### ¿Cómo verificar si estamos protegidos?

Nota:

Lo ideal es que se use un ambiente de desarrollo que simule el ambiente productivo en todas sus características.

1. Intenta hacer login con contraseña incorrecta 6 o más veces.

2. Observa qué pasa:

| **Comportamiento** | **Resultado** |
| --- | --- |
| Puedo seguir intentando sin límite | ❌ Sin protección |
| Aparece CAPTCHA después de 3 intentos | ✅ Protección básica |
| Cuenta bloqueada temporalmente | ✅ Protección fuerte |
| Recibo notificación de intentos fallidos | ✅ Protección + alertas |

## Gestión de sesiones

Para proteger a tus usuarios, las sesiones deben: generarse de forma segura, expirar a tiempo, regenerarse tras autenticación, e invalidarse completamente al cerrar sesión. A continuación, los puntos clave:

- **Tokens de sesión seguros:**  usar tokens generados con funciones criptográficas seguras.

- **Timeout por inactividad:**  cerrar sesión después de un tiempo considerado (a definir por el integrador).

- **Timeout absoluto:**  cierre de sesión máxima de 8 a 12 horas (o que represente el tiempo de trabajo diario de un usuario en la plataforma para pedir re-login).

- **Regeneración de ID de sesión:**  siempre crear un nuevo ID de sesión después de un login e inactivar el resto de sesiones activas.

- **Logout seguro:**  invalidar sesión en el servidor y permitir cerrar todas las sesiones activas.

### Uso de cookies de sesiones

En caso de usar cookies para sesiones, procure tener activos los atributos `Secure`, `HttpOnly` y `SameSite`. Estos mecanismos aseguran que las cookies no sean accesibles por terceros sin autorización.

Compara tu implementación de cookies actual con estos escenarios:

❌ **INCORRECTO - Cookie insegura:**

```
Set-Cookie: session=abc123
```

**Problemas:**

- Puede ser robada por un Javascript malicioso.

- Puede ser enviada por el protocolo inseguro HTTP (sin cifrar).

- Puede ser enviada a otros sitios web maliciosos (CSRF).

✅ **CORRECTO - Cookie segura:**

```
Set-Cookie: session=abc123; Secure; HttpOnly; SameSite=Lax

Atributos:
- Secure:        Solo se envía por HTTPS
- HttpOnly:      No accesible desde JavaScript
- SameSite=Lax:  Protege contra CSRF
```

### ¿Cómo verificar las cookies de mi sitio web?

1. Abre la aplicación en el navegador.

2. Presiona F12 o haz click derecho e inspeccionar.

3. Ve a la sección **Application > Cookies** .

4. Revisa la cookie de sesión:

| **Atributo** | **Debe estar** |
| --- | --- |
| Secure | ✓ |
| HttpOnly | ✓ |
| SameSite | Lax o Strict |

## Referencias

- [OWASP Authentication Cheat Sheet:](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) buenas prácticas de autenticación: contraseñas, MFA, sesiones, entre otros.

- [OWASP Session Management Cheat Sheet:](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) gestión completa de sesiones, cookies, timeouts entre otros.

- [NIST SP 800-63B: Digital Identity Guidelines:](https://pages.nist.gov/800-63-3/sp800-63b.html) estándar oficial de contraseñas y MFA.

- [OWASP Blocking Brute Force Attacks:](https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks) guía específica de protección contra fuerza bruta.

- [CWE-287: Improper Authentication:](https://cwe.mitre.org/data/definitions/287.html) categorización de todos los problemas de autenticación.

- [CAPTCHA:](https://www.google.com/recaptcha/about/) mecanismo de protección frente a ataques automatizados.

## Glosario

| **Término** | **Significado** |
| --- | --- |
| **Autenticación** | Verificar la identidad de un usuario (confirmar que es quien dice ser) |
| **MFA / 2FA** | Autenticación multifactor / de dos factores. Requiere algo que sabes (contraseña) + algo que tienes (celular) o algo que eres (huella). |
| **TOTP** | Time-based One-Time Password. Código de 6 dígitos que cambia cada 30 segundos (Google Authenticator, Authy) |
| **Fuerza bruta** | Ataque que prueba todas las combinaciones posibles de contraseñas hasta encontrar la correcta |
| **Hardcodear** | Escribir credenciales directamente en el código fuente (mala práctica) |
| **Rate limiting** | Limitar cuántos intentos de login se permiten por minuto/hora para frenar ataques |
| **CAPTCHA** | Prueba para verificar que el usuario es humano, no un bot automatizado |
| **Hash de contraseña** | Transformación irreversible de la contraseña para almacenarla de forma segura |
| **Salt** | Valor aleatorio agregado a la contraseña antes de hashearla para prevenir ataques de diccionario |

**Siguiente** : [Control de acceso y autorización](https://developers.mercadolibre.com.ar/es_ar/control-de-acceso-y-autorizacion).
