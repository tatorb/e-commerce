<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo -->
<!-- Sección: Guía para productos > Reclamos, Devoluciones y Cambios > Reclamos -->

# Gestionar mensajes de un reclamo

Última actualización 14/07/2024

## ¿Qué es un mensaje de un reclamo?

La gestión de mensajes en un reclamo de Mercado Libre es crucial para manejar eficientemente las comunicaciones entre los usuarios y el servicio de atención al cliente ante problemas de transacción. El objetivo principal es ofrecer respuestas rápidas y efectivas a las inquietudes de los usuarios, proveyendo soluciones que aborden y resuelvan los problemas específicos. Esta práctica no solo contribuye a mantener la satisfacción del cliente, sino que también refuerza la calidad del servicio en la plataforma, asegurando una experiencia de usuario óptima y fomentando la confianza en Mercado Libre.

## Obtener todos los mensajes de un reclamo

Los mensajes en un reclamo constituyen el canal principal por el cual las partes involucradas expresan sus solicitudes y argumentan sus posiciones. Esta forma de comunicación es esencial para el intercambio claro y efectivo de información, facilitando una resolución informada y justa de las disputas.

Nota:

**Solo**  se mostrarán los mensajes propios que hayan sido moderados, marcados con el estado “moderated”. Los mensajes de la contraparte que también pasaron por moderación serán automáticamente filtrados. Esta política asegura una comunicación clara y controlada, manteniendo el orden y la relevancia en el intercambio de información durante el proceso de reclamo.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/messages
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/messages
```

**Respuesta:**

```
[
   {
       "sender_role": "respondent",
       "receiver_role": "mediator",
       "message": "Reclamo + mediacion +devo fallida",
       "translated_message": null,
       "date_created": "2023-07-17T12:52:54.000-04:00",
       "last_updated": "2023-07-17T12:52:54.000-04:00",
       "message_date": "2023-07-17T12:52:54.000-04:00",
       "date_read": null,
       "attachments": [
           {
               "filename": "3cf94d52-0248-4bb4-98cc-b76c01ff5dc0.jpeg",
               "original_filename": "ZAPATOFORMALCORDONTEXTURASCOGNAC0022675VISTA1600x600.jpg",
               "size": 17950,
               "date_created": "2023-07-17T12:52:52.000-04:00",
               "type": "image/jpeg"
           }
       ],
       "status": "available",
       "stage": "dispute",
       "message_moderation": {
           "status": "clean",
           "reason": null,
           "source": "online",
           "date_moderated": null
       },
       "repeated": false
   },
   {
       "sender_role": "complainant",
       "receiver_role": "respondent",
       "message": "Reclamo + mediacion +devo fallida",
       "translated_message": null,
       "date_created": "2023-07-17T12:44:05.000-04:00",
       "last_updated": "2023-07-17T12:44:05.000-04:00",
       "message_date": "2023-07-17T12:44:05.000-04:00",
       "date_read": "2023-07-17T16:48:53Z",
       "attachments": [],
       "status": "available",
       "stage": "claim",
       "message_moderation": {
           "status": "clean",
           "reason": "",
           "source": "online",
           "date_moderated": "2023-07-17T16:44:05Z"
       },
       "repeated": false
   }
]
```

### Campos de la respuesta

La respuesta de un GET al recurso /claims/$CLAIMS_ID/messages proporcionará los siguientes parámetros:

- **sender_role** : Player que envió el mensaje  **complainant**  **respondent**

- **receiver_role** : Player hacia quién va dirigido el mensaje  **complainant**  **respondent**

- **message** : texto del mensaje

- **translated_message** : Traducción del mensaje (solo si es necesario que el mensaje tenga traducción: label CBT)

- **date_created** : fecha en la que se creó el mensaje

- **last_updated** : fecha de última actualización

- **message_date** : Fecha en la que se envió el mensaje

- **date_read** : Indica la fecha de lectura del registro

- **attachments** : listado de adjuntos del mensaje  **filename**  **original_filename**  **size**  **date_created**  **type**

- **status** : estado del mensaje  **available**  **moderated**  **rejected**  **pending_translation**

- **stage** : etapa en la que se envió el mensaje

- **message_moderation** : resultado del proceso de moderación.  **status** : Posibles valores:  **clean** : el mensaje está limpio. **rejected** : el mensaje fue moderado. **pending** : la moderación está en proceso. **non_moderated** : no aplicó la moderación. Por ejemplo: casos antiguos actualmente.   **reason** : razón por la cual se moderó el mensaje.  **OUT_OF_PLACE_LANGUAGE** : lenguaje inapropiado.   **source** : modalidad de la moderación. Posibles valores:  **online** : se modera durante la instancia de creación del mensaje. Única modalidad actualmente.   **date_moderated** : fecha en la cual se realizó la moderación.

- **repeated**

## Responder mensajes y adjuntar archivos

Responder eficazmente y adjuntar la documentación relevante permite resolver problemas de manera más eficiente, elevando la satisfacción del cliente y asegurando la calidad del servicio. En el marco de un reclamo, todos los participantes, con la excepción del player **warehouse_dispatcher** , tienen la oportunidad de enviar al menos un mensaje durante el proceso del reclamo.

Los mensajes pueden incluir o no adjuntos. Si un participante desea incluir un adjunto en su mensaje, primero debe subir dicho archivo siguiendo los pasos detallados en la sección "Envío de adjuntos". Una vez subido, el usuario puede utilizar el nombre de archivo generado por la API de adjuntos para incorporarlo en su mensaje, como se ilustra en los ejemplos proporcionados.

Esta estructura de comunicación no solo facilita un intercambio de información más fluido y documentado, sino que también optimiza la gestión de los reclamos, permitiendo una resolución más rápida y transparente de las disputas.

Nota:

Si se decide no incluir un attachment, no es necesario incorporar el campo 'attachments' en el cuerpo del POST. Esta flexibilidad simplifica el proceso de envío de mensajes cuando no se requiere documentación adicional, agilizando las comunicaciones y manteniendo la eficiencia en la gestión de reclamos.

El POST debe realizarse como **form.data con file = ubicación del archivo** .

Los usuarios tienen la capacidad de intercambiar una variedad de documentos útiles, como fotos, manuales de instrucciones y facturas, en formatos JPG, PNG y PDF, siempre que no superen los 5 MB de tamaño.

Además, el nombre del archivo debe ser conciso, no excediendo los 125 caracteres y limitándose a una composición de letras, números, puntos, guiones medios y guiones bajos (`a-zA-Z0-9._-`). Estas normativas garantizan que el intercambio de archivos se realice de manera eficiente y organizada, facilitando la gestión y el acceso a la información relevante durante el proceso de reclamación.

## Carga de archivos

Los archivos pueden ser adjuntados a los mensajes mediante el envío de un POST al endpoint 'attachments'. Esta funcionalidad facilita la incorporación de documentación relevante directamente a la conversación, permitiendo una comunicación más completa y eficaz durante el proceso de resolución de reclamos.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{
 "file"=$FILE_PATH
}

https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/attachments
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{
 "file"=@/Users/user/Desktop/file.jpg
}

https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/attachments
```

**Respuesta:**

```
{
    "user_id": 271959653,
    "filename": "fa8d559e-b6c9-4a9d-9824-aba4607bd869_271959653.jpg",
   }
```

## Crear mensaje con el archivo cargado

Un player está habilitado para enviar un mensaje **solo**  si cuenta con la acción de 'send_message' asignada a su perfil. Para verificar si esta acción está disponible, el player debe consultar las 'available_actions' en el detalle del Claim. Esta estructura asegura que solo los participantes autorizados puedan interactuar en el proceso del reclamo, manteniendo la organización y la eficiencia de la comunicación.

Las acciones que posibilitan el envío de mensajes a otros participantes del reclamo, varían según la etapa y el estado actual del mismo. Estas acciones son fundamentales para facilitar una comunicación efectiva y estratégica entre los involucrados, adaptándose dinámicamente a las necesidades y circunstancias específicas de cada reclamo.

Las acciones son:

| Acción | Disponible para | Receptor | Etapa de reclamo |
| --- | --- | --- | --- |
| send_message_to_complainant | respondent - mediator | complainant | claim |
| send_message_to_respondent | complainant - mediator | respondent | claim |
| send_message_to_mediator | complainant - respondent | mediator | dispute |

**Parámetros:**

| Query params | Type | Values | Detalle value |
| --- | --- | --- | --- |
| message |  |  | Mensaje de un reclamo |
| receiver_role |  | mediator, complainant, respondent | Rol del destinatario |
| attachments |  |  | Nombre del archivo adjuntado previamente (opcional) |

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{ 
  "receiver_role": "complainant| mediator| respondent",
  "message": "MENSAJE DE RECLAMO", 
  "attachments": [ \
    "fa8d559e-b6c9-4a9d-9824-aba4607bd869_271959653.jpg" \
  ] 
}

https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/send-message
```

Nota:

La lista de adjuntos mostrará todos los archivos devueltos en el POST anterior que están asociados al mensaje, **presentándolos**  de manera ordenada y separados por comas. Esta función facilita una visualización rápida y completa de los documentos adjuntos, optimizando la gestión de la información durante el intercambio de mensajes en el reclamo.

**Ejemplo con anexo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{ 
  "receiver_role": "complainant",
  "message": "Este es un mensaje de test del respondent al complainant", 
  "attachments":  ["1330467461_7ed98ebb-03f7-4818-943b-8b4d12a3aaa7.jpg" ]
}

https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/actions/send-message
```

**Respuesta:**

```

"status 201 created"
```

**Ejemplo sin anexo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 

{ 
  "receiver_role": "complainant",
  "message": "Este es un mensaje de test del respondent al complainant", 
  "attachments":  []
}

https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/actions/send-message
```

**Respuesta:**

```

"status 201 created"
```

## Descarga el archivo

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/attachments/$ATTACHMENTS_ID/download
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/555555555/attachments/1325224382_181a6330-d9f6-410c-a2c9-d03f8323bd16.jpg/download
```

## Obtener información del archivo

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/attachments/$ATTACHMENTS_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/555555555/attachments/exemple.jpg'
```

**Respuesta:**

```
{
   "filename": "e3abaa4b-c1b9-41ee-80ed-19f22872777c.jpeg",
   "original_filename": "_b7b5df12-7153-4bf5-a0a0-caa582592c3b.jpeg",
   "size": 128759,
   "date_created": "2024-04-12T08:16:16",
   "type": "image/jpeg"
}
```

Siguiente: [Gestionar resolución de reclamos](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos?)
