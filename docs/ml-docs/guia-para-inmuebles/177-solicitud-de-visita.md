<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/solicitud-de-visita -->
<!-- Sección: Guía para inmuebles -->

# Solicitud de visita

Última actualización 06/11/2026

## Solicitud de visita

En MercadoLibre, nos esforzamos por optimizar la experiencia de compra y alquiler de inmuebles, no solo asegurando la disponibilidad de las propiedades, sino también garantizando respuestas ágiles y eficientes a las consultas y solicitudes de visitas.

Esta guía tiene como objetivo detallar cómo MercadoLibre colabora con los distintos actores involucrados en el proceso de solicitud de visitas, describiendo el recorrido del cliente y estableciendo claramente el rol y las responsabilidades de cada participante en cada etapa del proceso.

Además de detallar el proceso, esta guía busca proporcionar herramientas y recursos para facilitar la gestión de las solicitudes y optimizar la experiencia tanto de los clientes como de los colaboradores.

Nota

Las funcionalidades de Solicitud de Visita estarán habilitados en los países de:

- [Chile](https://developers.mercadolibre.cl/devcenter/) (MLC)

## Trabajando con Solicitudes de Visita

Para trabajar eficazmente con las solicitudes de visita, además de activar las publicaciones, se requiere configurar horarios, métodos de contacto e integración con calendario, así como recibir notificaciones en tiempo real sobre nuevas solicitudes, cambios de disponibilidad y actualizaciones de contacto. Esto permite responder ágilmente, evitar malentendidos y programar visitas eficientes para maximizar las posibilidades de éxito de tus publicaciones.

## Actualizaciones en Tiempo Real

Es fundamental que los vendedores utilicen herramientas de gestión de calendario y reciban notificaciones instantáneas sobre solicitudes de visita, cambios de disponibilidad y actualizaciones de contacto. Esto facilita respuestas rápidas, evita problemas y optimiza la programación de visitas, aumentando las oportunidades de negocio.

Las actualizaciones en tiempo real sobre la intención de visita benefician tanto al vendedor como a la plataforma, permitiendo proporcionar información precisa. Es crucial que el vendedor configure completamente su aplicación con la URL donde recibirá las notificaciones y además haga uso correcto de los recursos de la API.

Importante

A partir de Octubre de 2024, las publicaciones de arriendo o alquiler de casas y departamentos en MLC (Chile) deberán incluir la opción de agendamiento online para cumplir con los nuevos criterios de calidad y tener una buena exposición. La ausencia de esta opción se refleja en el atributo `online_scheduling` del endpoint de health, afectando negativamente la evaluación de la publicación. Puedes conocer más en la guía de [calidad de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/calidad-de-las-publicaciones-inmuebles).

## Pasos para iniciar la integración

Las solicitudes de visita son parte importante de la experiencia de inmuebles. Para poder habilitar esta experiencia es necesario que asegures los siguientes pasos:

### 1. La cuenta del vendedor profesional o inmobiliaria debe estar registrada

- Registra una cuenta de vendedor profesional en el siguiente [link](https://www.mercadolibre.cl/hub/registration?from_landing=true&contextual=unified_normal&entity=no_apply)

- Si es para tu usuario de test, sigue la guía de [configuración de tu usuario](https://developers.mercadolibre.com.ar/es_ar/pasos-rapidos-para-publicar-un-inmueble-de-prueba#:~:text=seguro%20y%20controlado.-,2.Configura%20tu%20usuario%20de%20prueba%20como%20inmobiliaria,-Una%20vez%20que)

### 2. Registrar la aplicación para la obtención del token

- Sigue los pasos para lograr autorizaciones y tokens tal como se detalla en la [guía](https://developers.mercadolibre.com.ar/es_ar/obtencion-del-access-token)

### 3. Publicar ítems en la plataforma.

- Si ya has publicado o estás listo para publicar, genera tus primeras publicaciones para luego habilitar la solicitud de visita en ellas.

Una vez realices los pasos anteriores, en esta guía se explica cómo:

- 1. Marcar tus publicaciones para que tengan disponible la solicitud de visita.

- 2. Obtener detalles de este lead para gestionar tu agenda de solicitudes de la mejor manera posible.

## Activar Solicitud de Visita en Publicaciones

Si tu usuario está habilitado como inmobiliaria o corredora en uno de los países indicados al inicio de esta guía, tus publicaciones tendrán automáticamente la opción de visita habilitada. Asegúrate de enviar el atributo CONTACT_SCHEDULE junto con los demás atributos obligatorios al momento de publicar tu artículo.

No obstante, si tu publicación no tiene la solicitud de visita marcada, o si necesitas deshabilitarla, puedes hacerlo siguiendo estos pasos:

1. 1. Inicia sesión en MercadoLibre con tu usuario de prueba o vendedor.

2. 2.Haz clic en tu nombre de usuario, despliega el menú y selecciona **“Publicaciones”** .

3. 

4. 

5. 3. En el listado de publicaciones, busca la publicación que deseas habilitar y haz clic en los tres puntos del lado derecho. Luego, selecciona **“Modificar”** .

6. 

7. 

8. 4. En la ventana de modificación, dirígete a la sección **“Solicitud de visita”** , y haz clic sobre ella para desplegar las opciones.

9. 5. Para habilitar la funcionalidad de solicitud de visita en línea, selecciona **“Ofrecer solicitud online de visita”** . Si prefieres el método tradicional, selecciona **“Coordinar visitas tradicionalmente”** .

10. 6. Para finalizar, haz clic en **“Confirmar”** .

Importante

La función de solicitud de visitas se deshabilitará automáticamente si el vendedor se encuentra en alguna de las siguientes situaciones:

- Su nivel de reputación disminuye.

- Cancela más del 50% de las visitas programadas.

- Vuelve a publicar anuncios que ya tenía.

## Notificaciones de Leads de Visita

Se generará una notificación automática a través del canal público de **VIS Leads**  con el filtro “Visit Request” cuando un cliente potencial (comprador) en el marketplace de MercadoLibre muestre interés en visitar una propiedad, o cuando se realice una modificación en la agenda (independientemente del cambio de estado).

Para activar esta notificación, dirígete al gestor de aplicaciones donde creaste tu aplicación ([Argentina](https://developers.mercadolibre.com.ar/devcenter/), [Brasil](https://developers.mercadolivre.com.br/devcenter/), [Chile](https://developers.mercadolibre.cl/devcenter/), [México](https://developers.mercadolibre.com.mx/devcenter/), [Colombia](https://developers.mercadolibre.com.co/devcenter/), [Uruguay](https://developers.mercadolibre.com.uy/devcenter/), [Perú](https://developers.mercadolibre.com.pe/devcenter/), [Ecuador](https://developers.mercadolibre.com.ec/devcenter/) y [Venezuela](https://developers.mercadolibre.com.ve/devcenter/)). Deberás loguearte con el usuario que creó la aplicación y ejecutar los siguientes pasos:

1. 1. Desde el menú de tres puntos de la aplicación, selecciona la opción **“Editar”** .

2. 

3. 

4. 2. En la sección **“Información básica”** , haz clic en **“Continuar”** .

5. 

6. 

7. 3. Dentro de **“Configuración y permisos”** , busca **“VIS Leads”**  en la sección **“Tópicos”**  y selecciona **“Visit request”** .

8. 

9. 

10. 4. Finalmente, configura la URL para recibir las notificaciones y haz clic en **“Editar”**  para guardar los cambios.

Nota

Para más información puedes consultar la guía de [notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones)

Cuando recibas una notificación de solicitud de visita, será similar a la presentada en el siguiente ejemplo:

```
{
  "_id": "abcd-qwer-1234",
  "topic": "vis_leads",
  "resource": "/vis/leads/{lead_id}",
  "user_id": 123456789,
  "application_id": 123456789123456789,
  "sent": "2025-01-27T18:21:06.159Z",
  "attempts": 1,
  "received": "2025-01-27T18:21:06.057Z",
  "actions": [
    "visit_request"
  ]
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| _id | String | Identificador único de la notificación (lead). |
| topic | String | Tema del registro, para el caso, `"vis_leads"`. |
| resource | String | Recurso o URL asociado. |
| user_id | Number | Identificador del usuario. |
| application_id | Number | Identificador de la aplicación. |
| sent | DateTime String | Fecha y hora de envío de la notificación. |
| attempts | Number | Número de intentos. |
| received | DateTime String | Fecha y hora de recepción. |
| actions | Array | Lista de acciones asociadas, para el caso será `["visit_request"]`, solicitud de visita. |

Puedes obtener más información de este tipo de notificaciones utilizando los recursos que se describen en la sección de Leads.

## Gestión de Agenda

### Generar Agenda

Actualmente, no hay un endpoint de API disponible para crear agendas directamente en el modelo de datos. Sin embargo, es posible simular la generación de agendas en publicaciones de prueba ingresando a la URL del ítem publicado y dando clic en **Solicitar visita** . Posteriormente se podrá generar la agenda.

Posteriormente se podrá generar la agenda. Es importante destacar que es necesario estar autenticado con un usuario de pruebas en el navegador.

Una vez selecciones la disponibilidad y envíes la solicitud, se confirma la acción con un mensaje similar al siguiente:

Ingresa con tu usuario de test que tiene la publicación marcada con solicitud de visita, e ingresa a **tu perfil**:****

En el menú del lado izquierdo ingresa al panel de **personas interesadas** . En la parte superior del panel, aparecerá una pestaña con las **solicitudes de visita pendientes** , al dar clic sobre esta pestaña, se listaran dichas solicitudes, posteriormente da clic en el botón **Agendar visita**  para gestionarla.

Nota

Una forma de obtener el `id` de las solicitudes, mediante el uso de los recursos disponibles de la API, es por medio de los leads. Puedes conocer sobre esto en la guía de [consulta de leads](https://developers.mercadolibre.com.ar/es_ar/leads-inmuebles).

### Obtención detalle de agenda

**Importante:**

El cambio de formato de `external_id` aplica únicamente a los leads con `contact_type` igual a `schedule`. En estos leads, `external_id` identifica la agenda y es diferente del ID del lead. Los demás tipos de lead no se ven afectados por este cambio.

Actualmente, el ID numérico de una agenda ya se entrega en `external_id` como texto, por ejemplo `"4823917"`. Las agendas creadas a partir de la implementación del 21/12/26 tendrán un ID UUID, que puede ser UUIDv7. Las agendas anteriores conservan su mismo ID numérico, que seguirá siendo válido para consulta y actualización después del 31/12. Conserva ambos formatos como texto, sin convertir el identificador a número ni depender de que sea secuencial. Utiliza `external_id` como identificador para consultar la agenda.

Para la integración de experiencia para inmuebles en Chile, consulta el detalle y la actualización del estado de la agenda en [Experiencia para inmuebles](https://developers.mercadolibre.cl/es_cl/experiencia-para-inmuebles).

Para consultar los datos del lead de una solicitud de visita, utiliza el identificador del lead (LEAD_ID) recibido en la notificación. En un lead de tipo `schedule`, el campo `external_id` contiene el identificador de la agenda. Ambos identificadores son diferentes.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/leads/$LEAD_ID
```

### Parámetros

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| ACCESS_TOKEN | String | No | Token de autenticación de la API. |
| LEAD_ID | String | No | Identificador del lead a consultar. |

La respuesta obtenida será similar a la siguiente:

```
{
  "id": "44115522",
  "item_id": "MLA4037459422",
  "created_at": "2024-06-14T00:00:00Z",
  "contact_type": "schedule",
  "external_id": "13864821",
  "status": "active",
  "buyer_id": 123654987,
  "name": "Test Test",
  "email": "john@example.com",
  "phone": "+55 01 1111-1111"
}
```

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| id | String | El identificador único del objeto. |
| item_id | String | El identificador del artículo relacionado. |
| created_at | String | La fecha y hora de creación de la agenda en formato ISO 8601. |
| contact_type | String | El tipo de contacto, en este caso `"schedule"`. |
| external_id | String | Un identificador externo asociado a la agenda. |
| status | String | El estado actual de la solicitud. |
| buyer_id | Int | El identificador del comprador. |
| name | String | El nombre del comprador. |
| email | String | La dirección de correo electrónico del comprador. |
| phone | String | El número de teléfono del comprador. |

### Lecturas recomendadas

- [Gestiona Paquetes de inmuebles](https://developers.mercadolibre.com.ar/es_ar/gestionar-paquetes-de-inmuebles)

- [Publica Inmuebles](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 06/11/2025 | 1.0 | Publicación Inicial |
