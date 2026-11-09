<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/ciclo-de-vida-de-las-publicaciones-de-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Ciclo de vida de las publicaciones de Inmuebles

Última actualización 08/11/2025

## Ciclo de vida de las publicaciones de Inmuebles

Este apartado detalla el ciclo de vida de una publicación de inmuebles dentro de la plataforma. Comprender la vigencia y los estados de una publicación es crucial para gestionar correctamente los listados a través de la API, permitiendo a los integradores un control preciso sobre la visibilidad y disponibilidad de los inmuebles.

## Duración máxima y condiciones de publicación

Cada publicación de inmueble tiene un tiempo de vida máximo definido. Para que un ítem se mantenga publicado y activo, deben cumplirse dos condiciones fundamentales:

1. **Cupo Activo en el Paquete de Publicación:**  La publicación debe estar asociada a un paquete de publicación que tenga cupo disponible. Una vez que el cupo del paquete se agota, la publicación puede ser automáticamente despublicada. Es importante verificar y gestionar los cupos de los paquetes para asegurar la continuidad de las publicaciones.

2. 

3. **Dentro del Ciclo de Vida Esperado:**  Toda publicación tiene un ciclo de vida predefinido, con una fecha de inicio y una fecha de finalización (o un período de vigencia). La publicación debe encontrarse dentro de este período para permanecer activa. Una vez que el ciclo de vida expira, la publicación será despublicada.

Estas vigencias, se encuentran definidas en la siguiente tabla, dónde por cada site, categoría y tipo de operación se dan los días de vigencia de las publicaciones:

| Site | Tipo de propiedad | Operación | Días |
| --- | --- | --- | --- |
| MLM | Casas | Venta | 180 |
| MLM | Departamentos | Alquiler | 90 |
| MCO | Casas | Venta | 180 |
| MCO | Departamentos | Alquiler | 90 |
| MLA | Casas | Venta | 270 |
| MLA | Casas | Alquiler | 60 |
| MLA | Departamentos | Venta | 270 |
| MLA | Departamentos | Alquiler | 90 |
| MLU | Casas | Venta | 120 |
| MLU | Departamentos | Alquiler | 90 |
| MLV | Casas | Venta | 90 |
| MLV | Departamentos | Alquiler | 90 |
| MLC | Casas | Venta | 180 |
| MLC | Casas | Alquiler | 45 |
| MLC | Departamentos | Venta | 180 |
| MLC | Departamentos | Alquiler | 45 |
| All sites | Resto de las categorías | — | 354 |

## Parámetros de tiempo del ciclo de vida

Al publicar tu inmueble, en la respuesta de la API se incluyen parámetros relacionados con el ciclo de vida de la publicación (dependen de la categoría y del estado del paquete de publicaciones).

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| start_time | string | Fecha y hora en que se creó el ítem. |
| stop_time | string | Fecha y hora en que finaliza el ciclo de vida del ítem, definida según la categoría y el tipo de operación (venta o arriendo). |
| expiration_time | string | Fecha y hora de expiración del paquete de publicaciones activo que cubre este ítem. |

## Comportamiento del ciclo de vida

- Cuando el ítem alcanza el momento definido en **stop_time** , la API finaliza la publicación automáticamente. El estado del ítem cambia de **active**  a **closed**  con sub-estado **expired** .

- Si el paquete de publicaciones está activo pero el ítem está en **closed**  con sub-estado **expired** , esto indica que el ciclo de vida del ítem llegó a su fin.   Puedes consultar el valor de **start_time**  para confirmar la duración del ciclo de vida al validar el cierre del ítem.

**Ejemplo:**  Un ítem de tipo Departamento en Venta (Categoría MLA401806), creado con los siguientes parámetros:

```
{
  "start_time": "2022-01-01T00:06:15.000Z",
  "stop_time": "2022-09-28T00:06:15.000Z",
  "expiration_time": "2023-02-01T00:06:15.000Z"
}
```

Se puede establecer lo siguiente:

- El ítem fue publicado el 1 de enero de 2022 (**start_time** ).

- Se mantendrá activo mientras el paquete de publicaciones esté vigente y dentro del ciclo de vida (270 días para venta de departamentos en Argentina (MLA).

- Al llegar el 28 de septiembre de 2022 (**stop_time** ), la publicación del ítem finaliza y su estado cambia a **closed/expired** .

## Estados del ciclo de vida

| Estado | Descripción |
| --- | --- |
| active | La publicación está activa, visible y disponible para los usuarios en la plataforma. |
| paused | La publicación está pausada temporalmente y no es visible para los usuarios. Puede reactivarse en cualquier momento. |
| closed | La publicación está cerrada y no puede ser reactivada. Generalmente indica que se vendió o retiró el inmueble. |

### Lecturas recomendadas

- [Variaciones](https://developers.mercadolibre.com.ar/es_ar/variaciones-para-inmuebles)

- [Calidad de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles)

- [Desarrollos inmobiliarios](https://developers.mercadolibre.com.ar/es_ar/test-guia-inmuebles)

## Actualizaciones de versión

Esta sección resume el historial de cambios de la guía/API.

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
