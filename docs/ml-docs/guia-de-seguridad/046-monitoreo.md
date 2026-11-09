<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/monitoreo -->
<!-- Sección: Guía de seguridad -->

# Monitoreo

Última actualización 30/03/2026

## Monitoreo

## Registro de eventos y auditoría

Los logs son esenciales para detectar incidentes, investigar problemas y cumplir requisitos de auditoría. Sin embargo, logs mal implementados pueden exponer información sensible.

### Eventos recomendados a registrar

- **Autenticación:**  login exitoso, login fallido, logout, cambios de contraseña, entre otros.

- **Autorización:**  accesos denegado/concedidos, cambios de permisos, cambios de rol, entre otros.

- **Operaciones críticas:**  cambios de configuración, CRUD de datos, seguimiento a transacciones, generación de informes, entre otras.

- **Seguridad:**  rate limits alcanzados y errores generados por la activación de un control.

✅ **EJEMPLO DE LOG COMPLETO:**

```
{
  "timestamp": "2026-01-15T10:30:45.123Z",
  "user_id": "12345",
  "action": "view_order",
  "resource": "order/67890",
  "result": "success",
  "ip": "192.168.1.100",
  "request_id": "abc123-def456"
}
```

#### Información importante a incluir:

- **Timestamp:**  fecha y hora en UTC.

- **Usuario:**  id del usuario en cuestión.

- **Acción:**  ¿Qué se intentó hacer?

- **Recurso:**  ¿Sobre qué recurso?

- **Resultado:**  Éxito o fallo.

- **IP origen:**  dirección IP de la petición.

- **Request ID:**  identificador único por petición para correlación.

#### Información a NO incluir:

- Contraseñas o tokens.

- Datos personales completos (emails, teléfonos, direcciones, entre otros).

- Datos financieros.

- Cualquier otro tipo de información que se considere confidencial.

### Referencias

- [OWASP Logging Cheat Sheet:](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) mejores prácticas de logging de seguridad.

- [OWASP Logging Vocabulary:](https://owasp.org/www-project-logging-vocabulary/) vocabulario estándar para logs de seguridad.

- [CWE-778 (Insufficient Logging):](https://cwe.mitre.org/data/definitions/778.html) documentación sobre logging insuficiente.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **Log** | Registro de eventos que ocurren en tu sistema. |
| **Auditoría** | Revisión de logs para verificar qué pasó, cuándo y quién lo hizo. |
| **Timestamp** | Marca de tiempo que indica cuándo ocurrió un evento. |
| **RequestID** | Identificador único para rastrear una petición a través de todo el sistema. |
| **Evento de seguridad** | Acción relevante para seguridad: login, logout, cambio de permisos, acceso denegado, etc. |
| **Retención de logs** | Por cuánto tiempo guardan los registros antes de eliminarlos. |

## Gestión de anomalías

Detectar anomalías a tiempo puede ser la diferencia entre prevenir un incidente y sufrir una brecha de seguridad. Si no monitoreas tu sistema, los atacantes pueden operar durante días o semanas sin ser detectados.

| **SIN GESTIÓN DE ANOMALÍAS** | **CON GESTIÓN DE ANOMALÍAS** |
| --- | --- |
| Te enteras del problema cuando un seller se queja | Recibes alerta automática antes de que afecte a usuarios |
| No sabes si hay ataques en curso | Detectas patrones sospechosos en tiempo real |
| Investigas manualmente cada problema | El sistema prioriza y categoriza automáticamente |
| Reaccionas tarde | Actúas proactivamente |

### Tipos de anomalías

No todas las anomalías son iguales. Entender los tipos te ayuda a configurar mejor tus alertas:

#### Anomalías puntuales:

Un evento único que se desvía significativamente de lo normal:

```
MONITOREO DE SEGURIDAD: DETECCION DE ANOMALIAS
---------------------------------------------

ESTADO NORMAL:
Frecuencia: 5-10 logins fallidos por hora

ESTADO ANOMALIA:
Frecuencia: 500 logins fallidos en 1 minuto

INTERPRETACION TECNICA:
Diagnostico: Posible ataque de fuerza bruta
```

#### Anomalías contextuales:

Un evento que es normal en un contexto pero anómalo en otro.

```
MONITOREO DE SEGURIDAD: ANALISIS DE HORARIOS
-------------------------------------------

NORMAL:
Alto tráfico de 9am a 6pm (horario laboral)

ANOMALIA:
Mismo tráfico alto a las 3am

INTERPRETACION TECNICA:
Diagnostico: Posible actividad automatizada maliciosa o bot
```

#### Anomalías colectivas:

Un grupo de eventos que juntos indican un problema, aunque individualmente parezcan normales.

```
MONITOREO DE SEGURIDAD: SECUENCIA DE EVENTOS SOSPECHOSA
------------------------------------------------------

FLUJO DETECTADO:
1. Login exitoso desde Argentina
2. Cambio de contraseña
3. Actualización de email
4. Login desde Nigeria (5 min después)

ANALISIS TECNICO:
Cada evento por separado es normal, pero la secuencia
indica un posible account takeover.
```

### Proceso de detección de anomalías

Un sistema efectivo de detección sigue estas fases:

```
CICLO DE DETECCION DE ANOMALIAS (FEEDBACK LOOP)
-----------------------------------------------

[ 1 ] RECOLECTAR DATOS
      - Logs, metricas y eventos de sistema.
        ^
        |
[ 2 ] ESTABLECER BASELINE
      - Definir parametros de comportamiento "Normal".
        |
        v
[ 3 ] DETECTAR DESVIACION
      - Comparacion en tiempo real contra el baseline.
        |
        v
[ 4 ] ALERTAR
      - Notificacion inmediata al equipo de seguridad.
        |
        v
[ 5 ] RESPONDER
      - Investigacion, contencion y escalamiento.
        |
        v
[ 6 ] MEJORAR / AJUSTAR
      - Refinar umbrales y logica de deteccion.
        |
        +------- RE-ALIMENTACION AL SISTEMA -------+
```

#### Fase 1: Recolectar datos

- Centraliza logs de todos sus servicios.

- Incluye: accesos, errores, transacciones, cambios de configuración.

- Usa formato estructurado (JSON) para facilitar análisis.

#### Fase 2: Establecer baseline

- Define qué es "comportamiento normal" para tu aplicación.

- Considera: hora del día, día de la semana, temporadas (ej: Hot Sale).

- El baseline debe actualizarse periódicamente.

#### Fase 3: Detectar desviaciones

- Compra métricas actuales vs baseline.

- Usa métodos estadísticos (Desviación estándar, percentiles).

- Considera machine learning para patrones complejos.

#### Fase 4: Alertar

- Notifica al equipo correcto (Slack, email, PagerDuty).

- Incluye contexto suficiente para actuar.

- Prioriza por severidad.

#### Fase 5: Responder

- Investiga la causa raíz.

- Escala si es necesario.

- Documenta hallazgos.

#### Fase 6: Mejorar

- Ajusta umbrales para reducir los falsos positivos.

- Agrega nuevas métricas si descubres puntos ciegos.

- Aprende de cada incidente.

### Métricas sugeridas para monitoreo

```
METRICAS DE RENDIMIENTO Y SEGURIDAD
-----------------------------------------

Metrica: MTTD (Mean Time To Detect)
Descripcion: Tiempo promedio para detectar una anomalia
Umbral sugerido: < 15 minutos

Metrica: MTTR (Mean Time To Respond)
Descripcion: Tiempo promedio para responder
Umbral sugerido: < 1 hora

Metrica: False Positive Rate
Descripcion: % de alertas que no son problemas reales
Umbral sugerido: < 20%

Metrica: Alert Fatigue Score
Descripcion: Alertas ignoradas por el equipo
Umbral sugerido: < 5%

Metrica: Coverage
Descripcion: % de sistemas/servicios monitoreados
Umbral sugerido: 100%
```

### Herramientas recomendadas

```
HERRAMIENTAS DE MONITOREO Y OBSERVABILIDAD
------------------------------------------

CATEGORIA: Monitoreo de infraestructura
Herramientas: Datadog, New Relic, Prometheus + Grafana
Nivel: Todos

CATEGORIA: Logging centralizado
Herramientas: ELK Stack, Splunk, Loki
Nivel: Intermedio

CATEGORIA: APM (Application Performance)
Herramientas: Datadog APM, New Relic, Dynatrace
Nivel: Intermedio

CATEGORIA: SIEM (Security focused)
Herramientas: Splunk, Elastic SIEM, Sumo Logic
Nivel: Avanzado

CATEGORIA: Alertas
Herramientas: PagerDuty, OpsGenie, Slack integrations
Nivel: Todos

ESTRATEGIA INICIAL (BAJO COSTO):
- Prometheus + Grafana (open source)
- ELK Stack (open source)
- Alertas via Slack webhooks
```

### Referencias

- [OWASP AppSensor:](https://owasp.org/www-project-appsensor/) detección de ataques en tiempo real a nivel de aplicación.

- [NIST SP 800-137:](https://csrc.nist.gov/publications/detail/sp/800-137/final) monitoreo continuo de seguridad de información.

### Glosario

| **Término** | **Significado** |
| --- | --- |
| **Anomalía** | Comportamiento inusual o fuera de lo esperado en tu sistema (ej: pico de errores, patrones de acceso extraños). |
| **Baseline** | Línea base de comportamiento "normal" contra la cual comparar para detectar anomalías. |
| **Alerta** | Notificación automática cuando se detecta una anomalía o se supera un umbral. |
| **Umbral (Threshold)** | Límite definido que, al superarse, dispara una alerta (ej: más de 100 errores/minuto). |
| **Dashboard** | Panel visual que muestra métricas y estado del sistema en tiempo real. |
| **False positive** | Alerta que se dispara pero no corresponde a un problema real. |
| **SIEM** | Security Information and Event Management - Sistema que centraliza y analiza logs de seguridad. |

**Siguiente** : [Gestión de incidentes](https://developers.mercadolibre.com.ar/es_ar/gestion-de-incidentes).
