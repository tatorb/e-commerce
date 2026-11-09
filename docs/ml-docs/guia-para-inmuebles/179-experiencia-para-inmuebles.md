<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/experiencia-para-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Experiencia para inmuebles

Última actualización 06/11/2026

## Experiencia para inmuebles

Importante:

Recurso disponible exclusivamente para el sitio **MLC**  (Chile).

Desde Mercado Libre queremos generar una nueva experiencia de arriendo y venta de propiedades para el buyer a través de publicaciones que ofrezcan una experiencia superior con foco en asegurar la disponibilidad de los inmuebles, y garantizar la respuesta a dudas y solicitudes de agenda en tiempo y forma.

Esta guía tiene como objetivo describir y ejemplificar cómo Mercado Libre se conecta con los partners que hoy están dentro del modelo de solicitud de visita, el customer journey y en qué etapa participa cada uno de los actores involucrados dentro del mismo.

## Objetivos

- Describir brevemente el customer journey de solicitud de visita.

- Describir cada uno de los webhooks y cuales son los dominios de variable que acepta.

- Entregar lineamientos técnicos de cómo integrarse con nuestro sistema para poder hacer uso de la actualizacion en tiempo real y APIs.

- 

- Pasos para iniciar la integración

- La cuenta del seller profesional debe estar [registrada](https://www.mercadolibre.cl/hub/registration/landing). Registrar la aplicación para la [obtención del token](https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token). [Autenticación](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion#:~:text=20/10/2023-,Autenticaci%C3%B3n%20y%20Autorizaci%C3%B3n,-Para%20comenzar%20a) como seller o integrador según corresponda. Publicar ítems en la [plataforma](https://developers.mercadolibre.com.ar/es_ar/publica-inmuebles). Marcar ítems como solicitud de visita. Obtener detalles de la agenda para verificar el flujo.

- 

- Actualizaciones en Tiempo Real

- Estas actualizaciones en tiempo real son utilizadas por el partner para obtener más información sobre la intención de visita. Al mismo tiempo, también nos permiten proporcionar más información sobre el estado de la intención de visita generada por el buyer.

- 

- Es importante que el seller haya configurado en su sistema todos los endpoints de nuestra API y realice las llamadas siempre que desee cambiar el estado de una agenda. Tan pronto como un buyer programe una visita, la información se envía al seller, quien podrá comenzar a realizar las llamadas a nuestra API para cambiar el estado.

- 

- Importante:    El criterio de calidad que exige la opción de agendamiento online para publicaciones de alquiler (casas y departamentos) en MLC es obligatorio. Para que las publicaciones mantengan una buena exposición, es fundamental tener esta funcionalidad activa. Si tu desarrollo no contempla esta opción, el atributo online_scheduling aparecerá como afectado en el endpoint de health.

- Configuraciones

- Las configuraciones son necesarias para operar en los flujos de visita y adicionalmente informar acerca de las condiciones de arriendo de cada seller sobre sus propiedades, esta información se visualiza en cada publicación y dentro del flujo de visita.

- 

- Crear configuración

- Nota:   La creación de la configuración es necesaria tanto para las propiedades en arriendo como para las de venta. Aunque en el caso de las propiedades en venta no se muestran las condiciones de arriendo, ya que estas solo aplican a las propiedades en arriendo, es imprescindible que la configuración esté creada para poder operar adecuadamente en el flujo de solicitud de visita.

- 

- Para aquellos sellers que SOLO tienen propiedades en VENTA los valores por defecto deben ser los siguientes:

- Atributo Tipo Default Descripción     **seller_id**  Long Sustituir por el identificador único Identificador único de proveedor o seller   **codebtor_required**  Boolean true Requisito de aval   **latest_dependent_worker_payrolls**  Integer 3 Cantidad de últimas liquidaciones de sueldo   **latest_independent_worker_payrolls**  Integer 6 Cantidad de boletas de honorarios   **email_notify_schedule**  Boolean true Notificación de agendas por correo al partner   **salary_multiplier**  Double 3 Factor multiplicador de renta   **allow_guest_login**  Boolean false Permite agendas de usuarios no logueados

- 

- Llamada:

- `curl --location --request POST 'https://api.mercadolibre.com/vis-transactions-hub/configurations/provider' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' \ --header 'Content-Type: application/json' \ --data-raw '{ "seller_id": 123456789, "codebtor_required": false, "latest_dependent_worker_payrolls": 6, "latest_independent_worker_payrolls": 10, "email_notify_schedule": true, "salary_multiplier": 4, "allow_guest_login": true }'`

- 

- A continuación se detallan las validaciones aplicadas en cada atributo.

- Atributo Requerido Min Max Tipo Default Descripción     **seller_id**  Sí 1 - Long - Identificador único de proveedor o seller   **codebtor_required**  No - - Boolean, valores permitidos true o false true Requisito de aval   **latest_dependent_worker_payrolls**  No 0 12 Integer 3 Cantidad de últimas liquidaciones de sueldo   **latest_independent_worker_payrolls**  No 0 24 Integer 6 Cantidad de boletas de honorarios   **email_notify_schedule**  No - - Boolean, valores permitidos true o false true Notificación de agendas por correo al partner   **salary_multiplier**  No 1 10 Double 3 Factor multiplicador de renta   **allow_guest_login**  No - - Boolean false Permite agendas de usuarios no logueados

- 

- Actualizar configuración

- Llamada:

- `curl --location --request PATCH 'https://api.mercadolibre.com/vis-transactions-hub/configurations/provider/{pro viderId}' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' \ --header 'Content-Type: application/json' \ --data-raw '{ "codebtor_required": false, "latest_dependent_worker_payrolls": 6, "latest_independent_worker_payrolls": 10, "email_notify_schedule": true, "salary_multiplier": 3, "allow_guest_login": true }'`

- 

- A continuación se detallan las validaciones aplicadas en cada atributo:

- Nota:   Dado que es una actualización parcial, todos los campos son opcionales y sólo se deben enviar los que se quieran actualizar. .

- 

- Atributo Requerido Min Max Tipo     **codebtor_required**  No - - Boolean, valores permitidos true ó false   **latest_dependent_worker_payrolls**  No 0 12 Integer   **latest_independent_worker_payrolls**  No 0 24 Integer   **email_notify_schedule**  No - - Boolean, valores permitidos true ó false   **salary_multiplier**  No 1 10 Double   **allow_guest_login**  No - - Boolean, valores permitidos true ó false

- Obtención de configuración

- **Mediante provider_Id:**

- 

- Llamada:

- `curl --location --request GET 'https://api.mercadolibre.com/vis-transactions-hub/configurations/provider/$provider_Id' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' \`

- 

- **Mediante seller_Id:**

- 

- Llamada:

- `curl --location --request GET 'https://api.mercadolibre.com/vis-transactions-hub/configurations/seller/$seller_Id' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' \`

- 

- Respuesta

- 

- En ambos casos, mediante providerId y sellerId, el JSON retornado será el siguiente:

- `{ "provider_id": "123456789", "codebtor_required": false, "latest_dependent_worker_payrolls": 6, "latest_independent_worker_payrolls": 12, "email_notify_schedule": true, "salary_multiplier": 3, "allow_guest_login": true }`

- Descripción de atributos

- A continuación se detallan las validaciones en cada parámetro para obtener una configuración:

- Variable Tipo Descripción   **provider_id**  String Identificador único de proveedor o seller.  **codebtor_required**  Boolean Requisito de aval.   **latest_dependent_worker_payrolls**  Integer Cantidad de últimas liquidaciones de sueldo.   **latest_independent_worker_payrolls**  Integer Cantidad de boletas de honorarios.   **email_notify_schedule**  Boolean Notificación de agendas por correo al partner.   **salary_multiplier**  Double Factor multiplicador de renta.   **allow_guest_login**  Boolean Permite agendas de usuarios no logueados.

- 

- Marcado y Desmarcado de ítems

- Marcar y desmarcar ítems

- Este endpoint se utiliza para marcar ítems que no están con Solicitud de Visita para que sean convertidos al modelo con Solicitud de visita y viceversa, esta acción dependerá del campo **enable_rex**  enviado. En caso de que ya se intentara marcar o desmarcar y por algún motivo el proceso falle, se puede ejecutar este endpoint para intentar marcarlo nuevamente.

- 

- Durante el proceso de marcado de ítems es posible obtener un código de **status 422** , indicando que la petición fue aceptada pero no se pudo procesar, debido a que el seller no cumple con las condiciones para marcar ítems.

- 

- 

- Los parámetros para hacer la llamada son los siguientes:

- Campo Descripción Ejemplo   **seller_id**  ID del seller al cual pertenecen los ítems. 12345678  **item_ids**  Corresponde a los ítems que van a ser marcados.   Debe ser un arreglo donde los ids deben estar todos juntos y separados por comas (,) ej: MLC123,MLC321 Nota: los ítems que se vayan a marcar, deben pertenecer al “seller_id” que se haya colocado      **enable_rex**  Corresponde a la acción de convertir o revertir item con Solicitud de Visita. Para convertir un item con Solicitud de visita se debe colocar en **true**  Para revertir un item con Solicitud de visita se debe colocar en **false** .

- 

- 

- Llamada:

- `curl --location --request POST 'https://api.mercadolibre.com/vis-transactions-hub/{providerId}/entities/items/tags' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' \ --header 'Content-Type: application/json' \ --data-raw '{ "seller_id": 123123123, "item_ids": ["MLC123","MLC321"], "enable_rex": true }'`

- Y el JSON retornado será el lista de ítems marcados/desmarcados:

- `[ "MLC123", "MLC321" ]`

- APIs

- Notificación de leads de agenda

- Identificador de la agenda El cambio de formato de `external_id` aplica únicamente a los leads con `contact_type` igual a `schedule`. En estos leads, el campo identifica la agenda asociada y es distinto del ID del lead; los demás tipos de lead no se ven afectados por este cambio. Actualmente, el ID numérico de una agenda ya se entrega en `external_id` como texto, por ejemplo `"4823917"`. Las agendas creadas a partir de la implementación del 21/12/26 tendrán un ID UUID, que puede ser UUIDv7. Las agendas anteriores conservan su mismo ID numérico, que seguirá siendo válido para consulta y actualización después del 31/12. Conserva ambos formatos como texto y evita convertir el valor a número o depender de que sea secuencial.

- Cuando desde el marketplace de Mercadolibre.cl, se gatille una intención de visita por parte del cliente (buyer) o cuando se actualice una agenda a cualquier otro estado, se enviará una notificación a través del tópico público de **VIS Leads** , utilizando el filtro de **Visit Request** .

- 

- 

- 

- Para ello es necesario ir a la aplicación que recibe todos los leads y habilitar este filtro. El callback URL que definió para recibir las notificaciones, recibirá el contenido de la siguiente forma:

- `{ "_id": "abcd-qwer-1234", "topic": "vis_leads", "resource": "/vis/leads/{lead_id}", "user_id": 123456789, "application_id": 123456789123456789, "sent": "2025-01-27T18:21:06.159Z", "attempts": 1, "received": "2025-01-27T18:21:06.057Z", "actions": [ "visit_request" ] }`

- El campo **lead_id**  corresponde al identificador del Lead de agenda, luego se debe hacer el API Call para poder consultarlo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/leads/$LEAD_ID`

- 

- Para más detalles, consultar la documentación en la sección [VIS Leads](https://developers.mercadolibre.com.ar/productos-recibe-notificaciones#Accede-a-los-detalles:~:text=/%24CANDIDATE_ID-,VIS%20Leads%3A,-Importante%3A). Finalmente al consultar el Lead, podrá obtener el **ID de la agenda asociada**  dado por el campo external_id. Con él podrá consultar la agenda y su estado en la sección [Obtención detalle de agenda.](https://developers.mercadolibre.com.ar/es_ar/experiencia-para-inmuebles?nocache=true#:~:text=publicaci%C3%B3n%2C%20ejemplo%3A%20MLC916101223.-,Obtenci%C3%B3n%20detalle%20de%20agenda,-Ambiente%20de%20stage)

- **Importante:**     El **23 marzo de 2026** , el campo **notification_url**  será descontinuado. Por eso, recomendamos que **actives lo antes posible**  el filtro ["Visit Request"](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#:~:text=Visit_request%3A%20Notifica%20cuando%20haya%20una%20solicitud%20para%20agendar%20una%20visita%20en%20una%20propiedad.) en el tópico **"VIS Leads"** , para seguir recibiendo las notificaciones de visita.

- Para los integradores que cuentan con “notification_url” definida en su configuración y hayan habilitado el filtro de “Visit Request” en el tópico de “VIS Leads”, estarán recibiendo la notificación de agenda tanto por nuestros sistemas como en su callback URL de notificaciones, es decir de forma duplicada.

- Si desea sólo recibir notificaciones desde el tópico de “VIS Leads”, debe actualizar el campo “notification_url” y dejarlo vacío.

- 

- `{ "notification_url": "" }`

- 

- De esta forma se dejará de notificar las agendas por nuestro sistema interno. Para más detalles de cómo cambiar la configuración, ir a la sección [Actualizar configuración](https://developers.mercadolibre.com.ar/es_ar/experiencia-para-inmuebles#Actualizar-configuraci%C3%B3n)

- Visita

- Generar Agenda

- Para realizar una agenda desde el portal de Mercado Libre debe hacerse la mediante URL:

- `https://www.mercadolibre.cl/agendar/visita-inmuebles/{itemId}`

- Es importante resaltar que esta url se debe utilizar directamente en el buscador reemplazando el parámetro {itemId} por el correspondiente a la publicación y por otro lado tanto el usuario como la publicación deben ser de prueba por lo cual no se deben utilizar datos productivos.

- 

- El parámetro para especificar la publicación sobre la cual crear la agenda es:

- `{itemId}`

- El cual representa el ID de la publicación, ejemplo: MLC916101223.

- 

- Obtención detalle de agenda

- Cambio en el identificador de agenda A partir del 21/12/26, el identificador de agenda utilizado en la consulta puede contener un UUID y el campo `id` de la respuesta se entrega como string, incluso para agendas con un ID numérico. Las agendas anteriores conservan el mismo ID numérico, que seguirá siendo válido para consulta y actualización después del 31/12; las agendas creadas a partir de la implementación tendrán un UUID, que puede ser UUIDv7. Cuando consultes un lead con `contact_type` igual a `schedule`, utiliza su `external_id` como identificador de la agenda. El cambio de `external_id` aplica únicamente a este tipo de lead.

- Llamada:

- `curl --location --request GET 'https://api.mercadolibre.com/vis-transactions-hub/{providerId}/entities/schedules/$schedule_Id' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}'`

- El parámetro para hacer la llamada es:

- `$schedule_Id`

- El cual representa el ID de la agenda a consultar. Ejemplo de respuesta actual, antes del 21/12/26:

- `{ "id": 27002, "unit_name ":"1808-B", "user_id": 1006753330, "email": "useremail@email.cl", "name": "Test Test", "last_name": "", "item_id": "MLC916101223", "phone": "1111-1111", "scheduling_date": ["2022-03-30"], "scheduling_time_period": [{"from": "09:00:00","to": "12:00:00"}], }`

- Ejemplo parcial de respuesta a partir del 21/12/26:

- `{ "id": "019b4a35-7c00-7a3f-8b92-5d6e7f809abc", "item_id": "MLC123456789" }`

- El ejemplo muestra únicamente los campos relevantes para el cambio.

- Sus respectivos tipos de datos son:

- Variable Tipo   **id**  Long (actual); String (a partir del 21/12/26)  **unit_name**  String   **user_id**  Long   **email**  String   **name**  String   **last_name**  String   **item_id**  String   **phone1**  String   **phone2**  String   **scheduling_time**  List (String)    **scheduling_time_period**  List (String)

- 

- 

- Actualización status agenda

- Cambio en scheduling_id A partir del 21/12/26, envía `scheduling_id` como string. Para una agenda anterior, utiliza el mismo ID numérico representado como texto; este seguirá siendo válido después del 31/12. Las agendas creadas a partir de la implementación tendrán un UUID. El cambio de formato del campo `external_id` en leads aplica únicamente cuando `contact_type` es `schedule`.

- Llamada actual, antes del 21/12/26:

- `curl --location --request PUT 'https://api.mercadolibre.com/vis-transactions-hub/{providerId}/entities/schedules' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' --header 'Content-Type: application/json' \ --data-raw '{ "scheduling_id": 12345, "status_code": 12345, "status_name": "string", "message": "string", "timestamp": "ISO 8601", "data": {} }'`

- Ejemplo de llamada a partir del 21/12/26:

- `curl --location --request PUT \ 'https://api.mercadolibre.com/vis-transactions-hub/{providerId}/entities/schedules' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' \ --header 'Content-Type: application/json' \ --data-raw '{ "scheduling_id": "019b4a35-7c00-7a3f-8b92-5d6e7f809abc", "status_code": 4, "status_name": "visit_success", "message": "Visita realizada", "timestamp": "2026-12-21T14:48:00.000Z", "data": {} }'`

- Utiliza el identificador y la fecha correspondientes a la agenda, y envía los campos de `data` según el estado informado.

- A continuación se detallan el dominio de variable data:

- Status_code Status_name Descripción Body     2 scheduling_canceled Agenda cancelada { code: "string", reason: "string" }   3 scheduling_modified Horario modificado    4 visit_success Visita exitosa {}   6 scheduling_confirmed Horario confirmado { scheduling_date: "date", scheduling_time: "string" }   **7***  **scheduling_contacting**  **Gestionando visita**  **{}**

- 

- (*) El estado **scheduling_contacting**  sirve para indicar que el seller ya se está comunicando con el buyer para coordinar una fecha y hora de la visita. El objetivo de utilizar este estado es evitar el proceso de expiración de agendas, tal como se explica en la sección Agenda expirada. Este estado es utilizado cuando un seller usa algún canal de contacto como Whatsapp, Call para contactar al buyer. Desde **Mercado Libre**  el proceso se encuentra automatizado para detectar intenciones de contacto desde el **Panel de Personas interesadas** , **Emails**  y **Whatsapp**  al buyer.

- 

- Scheduling_canceled

- El dominio de variable del Status_code: 2 **(scheduling_canceled)**  es el siguiente:

- Code Reason Descripción Usada por Usada por tipoo de propriedad  2 buyer_out_of_reach No se puede comunicar con el buyer. Integradores, Panel. Arriendo/Venta   6 requirements_not_met buyer no cumple requisitos. Integradores, Panel. Arriendo   14 buyer_searching_for_later buyer busca para más adelante. Integradores, Panel. Arriendo   **15****  **property_not_available**  Propiedad no está disponible. De forma interna. N/A   16 buyer_cancel_visit Cancelada por el buyer. Integradores, Panel. Arriendo/Venta   **18****  **property_not_available_from_life_cycle**  Propiedad no disponible por ciclo de vidas. De forma interna. N/A   **19****  **property_not_available_from_pack_finished**  Propiedad no disponible por paquete de publicaciones finalizado. De forma interna. N/A   **20****  **property_not_available_from_seller_finished**  Propiedad no disponible porque el seller la finalizó. De forma interna. N/A   **21****  **property_not_available_from_partner_finished**  Propiedad no disponible porque integrador la finalizó. De forma interna. N/A   **24****  **property_not_available_from_seller_penalty**  Propiedad no disponible por penalización al seller. De forma interna. N/A   **25*****  **property_not_available_seller**  Cancelado por propiedad no disponible. Integradores, Panel. Arriendo/Venta

- 

- (**) Estas razones se utiliza para señalar aquellas agendas que fueron canceladas por los siguientes motivos:

- Automática para las agendas que son canceladas por ciclo de vida del ítem (**18** ). Automática por finalización del paquete de destaque (**19** ). Mecanismo de control de disponibilidad ejecutado por MercadoLibre o tras finalizar una publicación. (**24** ). Seller que finaliza manualmente su ítem y este posee agendas asociadas. (**15, 20, 21** ).

- 

- Cabe destacar que estas razones son solo de uso interno, por lo que no deberían usarse directamente en los requests.

- 

- Como estas son razones de forma automática e interna, se estará notificando el estado de la cancelación tal como indica en la sección [notificación de estados de agenda](https://developers.mercadolibre.com.ar/es_ar/experiencia-para-inmuebles?nocache=true#APIs).

- Importante:   Al utilizar la razón con código 25 (“property_not_available_seller”) se procede a cancelar la agenda y, se llevará a cabo la acción de finalizar la publicación en MercadoLibre. Una vez que se complete esta acción, se cancelarán automáticamente todas las agendas asociadas a dicha publicación

- Razones del buyer

- Estos códigos y razones corresponden a la respuesta que nos entrega el Buyer. **No deben ser utilizados por el integrador/seller.**

- Código Razón Descripción Usada por Usada por Tipo de propiedad     **100*****  **property_not_available_buyer**  **Propiedad no está disponible**  buyer N/A    **101***  **buyer_out_of_reach**  **No contactaron al buyer**  buyer N/A    **102**  **buyer_cancel_visit**  **Cancelaron la visita**  buyer N/A    **103**  **requirements_not_met**  **Buyer no cumple requisitos**  buyer N/A    **104**  **buyer_searching_for_later**  **Busca para otra fecha**  buyer N/A    **105**  **other_reason**  **Otro motivo**  buyer N/A

- Nota:   Si las agendas no han sido gestionadas, se consultará al buyer por Correo y por Whatsapp si pudo visitar la propiedad. Si la respuesta es que no pudo, el buyer cancelará la agenda especificando la razón de cancelación.

- 

- Importante:   Al utilizar la razón con código 100 (“property_not_available_buyer”) , que indica que la propiedad no está disponible, NO se ejecutará el proceso para finalizar la publicación, a diferencia de la razón con código 25, esto dado que es informado por el buyer y no por el seller.

- 

- Visit_success

- Como se indicó anteriormente, cuando una agenda no se gestiona, se consulta al buyer si pudo o no visitar la propiedad, en caso de que indique que sí pudo visitar la propiedad, la agenda pasará a **Visita Realizada** , junto con ello, indicamos la siguiente razón de por qué una agenda se puede completar por el buyer:

- 

- Razón Descripción Usada por Usada por Tipo de propiedad     **buyer_completed_whatsapp**  Visita realizada a través de WhatsApp Buyer N/A   **buyer_completed_email**  Visita realizada a través de correo Buyer N/A

- 

- 

- Agenda expirada (proceso automático interno)

- El sistema cuenta con un proceso automático que se encarga de expirar todas las agendas que no han sido gestionadas y se encuentran en el estado de “agendas creadas”, esta acción se ejecuta después de 3 días seguidos desde la fecha de intención del buyer a visitar la propiedad.

- 

- **Ejemplo** : el buyer genera una solicitud de visita con la intención de visitar la propiedad el día **1 de noviembre,**  luego de pasados 3 días consecutivos **(4 de noviembre)** , al **4to día a primera hora** , si la agenda sigue sin gestionarse, esta procederá a expirar. Las agendas creadas que son expiradas quedan con la siguiente condición:

- 

- Code Reason Descripción   1 seller_no_response Expiró la agenda por no respuesta del seller después de 3 días seguidos desde la fecha de intención del buyer a visitar la propiedad.

- 

- Como esta es una razón de forma automática e interna, se estará notificando el estado de la expiración tal como indica en la sección [Notificación de leads de Agenda.](https://developers.mercadolibre.com.ar/es_ar/experiencia-para-inmuebles#APIs:~:text=Notificaci%C3%B3n%20de%20leads%20de%20agenda).

- 

- Unidades MultiFamily

- Nota:   Esta sección NO aplica para propiedades en VENTA. .

- 

- Edición de precio, aumento o disminución de unidades

- Este endpoint se utiliza para actualizar el precio de las unidades así como también aumentar o disminuir el stock de las mismas. Con el objetivo de que no se muestren unidades en la publicación que no están disponible y por ende no se vayan generando nuevos agendamientos, en el caso de estar nuevamente disponible se puedan mostrar. Adicionalmente ofrece la opción de actualizar el precio de las unidades.

- 

- El endpoint soporta la actualización de una lista de unidades mediante su campo units en el body.

- Envía `item_id` como cadena con el identificador de la publicación de alquiler. Por ejemplo: `"MLC123"`.

- 

- Llamada:

- `curl --location --request PUT \ 'https://api.mercadolibre.com/vis-transactions-hub/{providerId}/entities/items' \ --header 'Authorization: Bearer {{ACCESS_TOKEN}}' \ --header 'Content-Type: application/json' \ --data-raw '{ "item_id": "MLC123", "status_code": 1, "status_name": "update_units", "message": "string", "timestamp": "ISO 8601", "data": { "units": [ { "unit_name": "string", "price": 200000, "operation": "price_updated" }, { "unit_name": "string", "price": 400000, "operation": "unit_added" } ] } }'`

- El body es el siguiente:

- `{ item_id: "string", status_code: "int", status_name: "string", message: "string", timestamp: "ISO 8601", // ej: 2011-10-05T14:48:00.000Z data: { units: [ { unit_name: "string", price: "int", operation:"string" } ] } }`

- A continuación se detalla los valores de **status_code**  y **status_name** .

- Status_code Status_name   1 **update_units**

- 

- A continuación se detalla el dominio del atributo operation:

- Operation Descripción   **price_updated**  Permite actualizar el precio de la unidad.  **unit_added**  Permite aumentar la unidad.   **unit_removed**  Permite disminuir la unidad.

- 

- Nota:   para el caso de la operación **unit_added**  sí se envía el precio este también se actualiza. Para el caso de remover unidades no se permite la actualización del precio.

- 

F
