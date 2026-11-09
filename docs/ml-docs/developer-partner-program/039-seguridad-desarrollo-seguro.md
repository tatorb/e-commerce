<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/seguridad-desarrollo-seguro -->
<!-- Sección: Developer Partner Program -->

# Seguridad - Desarrollo Seguro

Última actualización 04/03/2026

## Seguridad en Integraciones

A continuación compartimos una serie de acciones en un plan que permite al integrador reducir riesgos de seguridad. Este plan es el estándar que exigimos en Mercado Libre. Si el integrador cumple con esto, su postura de seguridad pasará de "vulnerable" a "referente del ecosistema".

# Resumen

→ 1.1: Limpieza, Rotación y Quick Wins Técnicos
 → 2.2: Autenticación, Fuerza Bruta y PII
 → 3.3: Lógica de Negocio (IDOR) y Webhooks
 → 4.4: Monitoreo, Incidentes y Mínimo Privilegio
 → 5.5: ¿Qué ganamos con estos cambios?

## 1.1: Limpieza, Rotación y Quick Wins Técnicos

**Objetivo:**  Neutralizar amenazas actuales y cerrar vectores de ataque "simples".

### Eliminación de Secretos y Rotación (Crítico)

- Escaneo de repositorios y purga de secretos

- Utilizar herramientas como `git-secrets` o `TruffleHog`

- Revocar inmediatamente cualquier credencial expuesta

### MFA Obligatorio e Inmediato

- Activar 2FA para todo el personal con acceso a la infraestructura o datos de sellers

- Activar 2FA para todos los usuarios del sitio

- Utilizar TOTP o llaves de seguridad (YubiKey)

### Quick Win: Análisis de Dependencias (SCA)

- Ejecutar escaneo de vulnerabilidades en las bibliotecas del proyecto

- Comandos: `npm audit`, `pip audit`, `snyk`

- Actualizar inmediatamente cualquier biblioteca con vulnerabilidades críticas/altas

- Un integrador con bibliotecas desactualizadas es un riesgo para todo Meli

### Quick Win: Headers de Seguridad

- Implementar en todos los endpoints los headers:

- `Strict-Transport-Security` — Fuerza HTTPS

- `Content-Security-Policy` — Previene la inyección de scripts

- `X-Content-Type-Options: nosniff` — Evita el MIME type sniffing

- `X-Frame-Options: DENY` — Previene el clickjacking

- Es un cambio de 5 minutos que previene ataques de inyección

## 2.2: Autenticación, Fuerza Bruta y PII

**Objetivo:**  Blindar el acceso y proteger el activo más valioso: los datos del cliente.

### Autenticación en el 100% de los Endpoints

- Aplicar el principio de "Denegación por Defecto"

- Ningún recurso es público a menos que esté explícitamente definido así

- Validar JWT u OAuth 2.0 en cada solicitud

### Defensa contra Fuerza Bruta y Rate Limiting

- Configurar bloqueos después de 5 intentos fallidos de login

- Implementar Rate Limiting por IP y por Token para evitar el scraping masivo de datos

- Ejemplo: máximo 100 solicitudes por minuto por IP

- Usar bibliotecas como `express-rate-limit` o `slowhttptest`

### Cifrado de PII y Data Masking

- Cifrar datos sensibles (E-mails, IDs, Teléfonos) con AES-256

- Implementar enmascaramiento en la UI: el personal del integrador no debe ver el e-mail completo del comprador a menos que sea estrictamente necesario

- Ejemplo: mostrar solo `usuario***@email.com`

- Usar bibliotecas como `crypto-js` o `libsodium`

## 3.3: Lógica de Negocio (IDOR) y Webhooks

**Objetivo:**  Garantizar que la aplicación se comporte como debe y no confíe en datos externos.

### Mitigación de IDOR (Control de Acceso Horizontal)

- Implementar una matriz de autorización

- Antes de entregar cualquier dato de un pedido, el sistema DEBE verificar:

- `SELECT * FROM orders WHERE id = ? AND seller_id = ?`

- Nunca usar solo el ID del pedido

- Validar que el usuario logueado es el propietario del recurso solicitado

### Validación Robusta de Webhooks

- No procesar pagos o cambios de estado basados solo en el JSON recibido

- El webhook debe disparar una consulta a la API oficial de Mercado Libre para validar el estado real del recurso

- Validar la firma del webhook con una clave secreta (HMAC-SHA256)

- Implementar idempotencia: verificar si el evento ya fue procesado

### TLS 1.2+ y Validación de Certificados

- Desactivar versiones inseguras de TLS (1.0, 1.1)

- Garantizar que el integrador valide el certificado de Meli

- Evitar ataques Man-in-the-Middle

- Usar certificados con pinning (certificate pinning) cuando sea posible

## 4.4: Monitoreo, Incidentes y Mínimo Privilegio

**Objetivo:**  Capacidad de detección y resiliencia ante el compromiso.

### Quick Win: Alertas de Anomalías

- Configurar una alerta simple: si un token de un seller se usa desde una IP geográfica inusual, bloquear el token y alertar

- Si descarga más de X pedidos en 1 minuto, bloquear y notificar

- Usar herramientas como `ELK Stack` o `Splunk` para monitoreo

### Mínimo Privilegio (RBAC)

- Auditar roles: ¿el desarrollador realmente necesita acceso a la base de datos de producción?

- ¿El bot de reportes necesita permisos de escritura?

- Implementar Role-Based Access Control (RBAC) con roles bien definidos

- Usar el principio de "Need-to-Know"

### Playbook de Respuesta

- Definir el flujo de comunicación con Mercado Libre ante una Violación

- Tener listo el proceso de revocación masiva de tokens

- Documentar todos los pasos: detección → notificación → contención → remediación

### Sanitización Definitiva de Logs

- Garantizar que, después de todos los cambios, los logs sigan limpios de PII y secretos

- Usar regex para enmascarar datos sensibles en logs

- Implementar rotación de logs y retención apropiada

## 5.5 ¿Qué ganamos con estos cambios?

| Acción | Beneficio |
| --- | --- |
| **SCA** | Cerramos la puerta trasera que muchos olvidan: bibliotecas vulnerables que pueden ser explotadas por atacantes. |
| **Headers de Seguridad** | Protegemos el navegador del usuario final con un esfuerzo casi nulo y reducimos drásticamente la superficie de ataque. |
| **Rate Limiting** | Evitamos que un atacante "perfore" la API para extraer datos de forma masiva o ejecutar ataques de fuerza bruta. |
| **Validación de Webhooks** | Evitamos fraudes por notificaciones falsas y garantizamos la integridad de las transacciones. |
| **Autenticación Fuerte** | Reducimos drásticamente el riesgo de acceso no autorizado y robo de datos. |
| **Monitoreo** | La detección rápida de anomalías permite una respuesta ágil antes de que ocurran daños mayores. |

Conclusión:

Este plan es el estándar que exigimos en Mercado Libre. Si el integrador cumple con esto, su postura de seguridad pasará de "vulnerable" a "referente del ecosistema". La implementación no necesita hacerse de una sola vez, pero seguir la secuencia de puntos garantiza que los riesgos más críticos se mitiguen primero, creando una base sólida para el resto de la infraestructura.
