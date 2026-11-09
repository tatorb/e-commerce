<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestion-de-incidentes -->
<!-- Sección: Guía de seguridad -->

# Gestión de inicidentes

Última actualización 06/04/2026

## Gestión de incidentes

La gestión de incidentes de seguridad es el conjunto de procesos, roles y herramientas que permiten a una organización detectar, responder y recuperarse de eventos que comprometan la seguridad de sus sistemas o datos. No se trata solo de reaccionar cuando algo sale mal, sino de tener un plan estructurado que minimice el impacto, acelere la recuperación y convierta cada incidente en una oportunidad de mejora.

Importante:

Siempre notifica a MercadoLibre al correo **security@mercadolibre.com**  lo antes posible si el incidente involucra tokens, datos de sellers o compradores, o afecta la integración.

| **Sin plan de incidentes** | **Con plan de incidentes** |
| --- | --- |
| Pánico y confusión | Pasos claros a seguir |
| No saber a quién llamar | Contactos y roles definidos |
| Decisiones improvisadas | Procesos y medidas probadas |
| Comunicación tardía o incorrecta | Notificaciones planificadas |
| Repetir los mismos errores | Mejora continua con post-mortems |

### El impacto de una respuesta lenta:

| **Métrica** | **Sin plan** | **Con plan** |
| --- | --- | --- |
| Tiempo de contención | Días o semanas | Horas |
| Costo promedio del incidente | +55% mayor | Controlado |
| Daño reputacional | Severo (noticias y medios) | Minimizado |
| Multas regulatorias | Máximas (por no notificar a tiempo) | Reducidas o evitadas |
| Pérdidas de clientes | Un buen porcentaje puede abandonar | Mínima con buena comunicación. |

## Clasificación de incidentes por severidad

No todos los incidentes requieren la misma respuesta, clasificarlos permite una priorización correcta:

| **SEVERIDAD** | **CRITERIOS** | **TIEMPO RESP.** | **EJEMPLO** |
| --- | --- | --- | --- |
| **● Crítica (P1)** | Brecha confirmada, datos expuestos, múltiples sellers afectados. | Inmediato ( < 15 min ) | Tokens de 100+ sellers expuestos en internet. |
| **● Alta (P2)** | Vulnerabilidad explotable, potencial exposición, servicio degradado. | < 1 hora | SQL injection detectada, no confirmada explotación. |
| **● Media (P3)** | Vulnerabilidad identificada sin explotación, impacto limitado. | < 4 horas | Certificado próximo a expirar, dependencia vulnerable. |
| **● Baja (P4)** | Mejora de seguridad, hallazgo menor. | < 24 horas | Password débil en cuenta de prueba. |

## El ciclo de respuesta a incidentes (Framework NIST)

El estándar NIST SP 800-61 define 4 fases para la gestión de incidentes:

## Roles y responsabilidad durante un incidente

Define quién hace qué ANTES de que ocurra el incidente:

| **Rol** | **Responsabilidad** |
| --- | --- |
| **Incident Commander (IC)** | Lidera la respuesta, toma decisiones, coordina. |
| **Technical Lead** | Investiga causa raíz, ejecuta contención técnica. |
| **Communications Lead** | Redacta y envía comunicaciones a los afectados. |
| **Scribe / Documentador** | Registra timeline, decisiones, acciones. |
| **Subject Matter Expert** | Aporta conocimiento específico según el tipo de incidente. |

Importante:

- Define respaldos para cada rol (¿Qué pasa si el IC está de vacaciones?).

- Publica esta información donde todos puedan encontrarla.

- Actualiza cuando haya cambios de personal.

## Comunicación durante incidentes

La comunicación puede hacer o deshacer tu reputación. Principios claves:

### Comunicación interna:

| **Qué comunicar** | **Cuándo** | **A quién** |
| --- | --- | --- |
| Incidente detectado | Inmediato | Equipo de respuesta |
| Actualizaciones de estado | Cada 30 - 60 min | Liderazgo y stakeholders |
| Resolución | Al cerrar | Toda la organización |

### Comunicación externa: sellers / usuarios afectados:

- **Sé transparente:**  no minimices ni ocultes.

- **Sé oportuno:**  comunica lo antes posible, aunque no tengas todos los detalles.

- **Sé claro:**  evita jerga técnica.

- **Sé accionable:**  informa qué deben hacer (cambiar contraseña, revocar permisos, etc.)

### Plantilla de notificación:

## Proceso Post-mortem efectivo

Un incidente resuelto no es el final, es el comienzo del aprendizaje. El post-mortem es el proceso de analizar qué pasó, por qué pasó, y qué podemos hacer para que no vuelva a ocurrir. Es la diferencia entre repetir los mismos errores y construir un sistema cada vez más robusto.

### Principios del post-mortem:

- **Asume buena intención:**  todos actuaron con la mejor información disponible.

- **Enfócate en sistemas, no personas:**  "¿Por qué el sistema permitió esto?" vs "¿Quién cometió el error?".

- **Busca causas raíz:**  usa "5 Whys" para llegar al fondo, consiste en preguntar ¿Por qué? repetidamente hasta llegar a la causa fundamental del problema.

- **Genera acciones concretas:**  cada lección debe tener una action item asignado.

### Estructura de un post-mortem

## Métricas de respuesta a incidentes

Lo que no se mide, no se mejora. Las métricas de respuesta a incidentes te permiten saber si tu equipo está mejorando con el tiempo, identificar cuellos de botella en el proceso, y justificar inversiones en seguridad con datos concretos.

| **Métrica** | **Qué mide** | **Objetivo** |
| --- | --- | --- |
| **MTTD (Mean Time To Detect)** | Tiempo desde que ocurre hasta que se detecta. | < 1 hora |
| **MTTA (Mean Time To Acknowledge)** | Tiempo desde detección hasta que alguien responde. | < 15 minutos |
| **MTTC (Mean Time To Contain)** | Tiempo hasta contener el daño. | < 4 horas |
| **MTTR (Mean Time To Resolve)** | Tiempo hasta resolver completamente. | Depende de severidad |
| **Incidents per month** | Cantidad de incidentes. | Tendencia descendente |
| **Post-mortems completed** | % de incidentes P1/P2 con post-mortem. | 100% |

### Ejemplo respuestas a incidentes

Veamos cómo se ve una respuesta caótica vs una organizada:

## Referencias

- [NIST SP 800-61:](https://csrc.nist.gov/publications/detail/sp/800-61/rev-2/final) guía de manejo de incidentes de seguridad informática.

- [OWASP Incident Response:](https://owasp.org/www-project-incident-response/) escenarios de respuestas a incidentes.

- [SANS Incident Handler's Handbook:](https://www.sans.org/white-papers/33901/) manual práctico de gestión de incidentes.

## Glosario

| **Término** | **Significado** |
| --- | --- |
| **Incidente de seguridad** | Evento que compromete o puede comprometer la confidencialidad, integridad o disponibilidad de datos. |
| **Brecha** | Incidente confirmado donde datos sensibles fueron accedidos o exfiltrados. |
| **Contención** | Acciones inmediatas para limitar el daño de un incidente en curso. |
| **Erradicación** | Eliminar la causa raíz del incidente (ej: cerrar la vulnerabilidad). |
| **Recuperación** | Restaurar sistemas y servicios a operación normal. |
| **Post-mortem** | Análisis posterior al incidente para aprender y prevenir recurrencias. |
| **Playbook** | Guía paso a paso de cómo responder a tipos específicos de incidentes. |
| **Tiempo de respuesta** | Tiempo desde que se detecta un incidente hasta que se toman acciones. |
| **Notificación** | Comunicar el incidente a las partes afectadas (usuarios, reguladores, MercadoLibre). |
