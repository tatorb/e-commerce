<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestionar-evidencia-de-reclamos -->
<!-- Sección: Guía para productos > Reclamos, Devoluciones y Cambios > Reclamos -->

# Gestionar evidencia de reclamos

Última actualización 13/04/2025

## ¿Qué es gestionar la evidencia de reclamos?

Gestionar la evidencia de los reclamos en Mercado Libre es fundamental para proteger tu reputación como vendedor y asegurar una resolución justa. Este proceso consiste en recopilar, organizar y presentar de manera efectiva toda la información pertinente relacionada con el reclamo. A continuación, se detallan los pasos estratégicos para gestionar la evidencia de manera eficiente.

### Obtener evidencia del reclamo

El servicio de gestión de evidencias es fundamental para elevar la transparencia y la trazabilidad de las transacciones en nuestra aplicación. Este servicio abarca varios tipos de evidencias, cada uno diseñado estratégicamente para abordar situaciones específicas y asegurar la confiabilidad del proceso.

**Shipping Evidence:**  Este servicio es crucial para el seguimiento de envíos que no están gestionados por Mercado Envíos 2, sino que son despachados directamente por el vendedor a través de otras empresas de envío (Correos, transportistas, entrega en mano, envío por email, entre otros). Las pruebas asociadas a estos envíos, conocidas como shipping evidence, se utilizan para rastrear detalladamente la información relacionada con el transporte de productos. Esto proporciona una visión completa de las operaciones logísticas, asegurando así la transparencia y eficiencia en cada etapa del proceso de entrega.

Nota:

Actualmente solo existe la carga de evidencia de envío que realiza el vendedor.

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/evidences
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/evidences
```

**Respuesta:**

```
[
    {
        "attachments": [],
        "type": "shipping_evidence",
        "date_shipped": "2018-03-07T05:00:00Z",
        "date_delivered": null,
        "destination_agency": null,
        "receiver_email": null,
        "receiver_id": null,
        "receiver_name": null,
        "shipping_company_name": "servientrega",
        "shipping_method": "mail",
        "tracking_number": "132456787"
    }
]
```

## Upload del archivo adjunto

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN'
{
  "file"="@/Users/user/Desktop/file.jpg"
}
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/attachments-evidences
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/5123456/attachments-evidences \
--header 'Authorization: Bearer xxxxxx' \
--header 'x-public: true' \
--form 'file=@"/Users/test/Downloads/pendrive.png"'
```

**Respuesta:**

```
{
  "user_id": 12345,
  "file_name": "abcdef.png"
}
```

**Nota:**  El POST debe realizarse como form.data con file = ubicación del archivo.
 Los usuarios tienen la capacidad de adjuntar una variedad de documentos útiles, como fotos, manuales de instrucciones y facturas, en formatos JPG, PNG y PDF, siempre que no excedan los 5 MB de tamaño. Considere que $ATTACHMENT_ID = file_name.

## Obtener informaciones del adjunto enviado

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/attachments-evidences/$ATTACHMENT_ID
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/5123456/attachments-evidences/$ATTACHMENT_ID
```

**Respuesta:**

```
{
  "filename": "abcdef.png",
  "original_filename": "pendrive.png",
  "size": 1235,
  "date_created": "2025-04-04T14:48:30.000-04:00",
  "type": "image/png"
}
```

## Descargar el archivo adjunto enviado

**Llamada:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/attachments-evidences/$ATTACHMENTS_ID/download
```

**Ejemplo:**

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'
https://api.mercadolibre.com/post-purchase/v1/claims/5123456/attachments-evidences/$ATTACHMENTS_ID/download
```

## Cargar evidencias de envíos

Cuando un comprador abre un reclamo para recibir su producto o buscar una solución, y el vendedor ya ha despachado el artículo y cuenta con evidencias, deberá utilizar el siguiente recurso para gestionar el reclamo de manera efectiva.

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/evidences
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d 
'{
    "type": "shipping_evidence",
    "shipping_method": "entrusted",
    "shipping_company_name": "Total",
    "destination_agency": "Agencia",
    "date_shipped": "2018-08-17T05:00:01.858-03:00",
    "receiver_name": "Jose da Silva",
    "receiver_id": "12345678",
    "tracking_number": "XX123456789XX",
    "attachments": []
}'

https://api.mercadolibre.com/post-purchase/v1/claims/5204934310/actions/evidences
```

**Respuesta:**

```
[
    {
        "attachments": [],
        "type": "shipping_evidence",
        "date_shipped": "2018-03-07T05:00:00Z",
        "date_delivered": null,
        "destination_agency": null,
        "receiver_email": null,
        "receiver_id": null,
        "receiver_name": null,
        "shipping_company_name": "servientrega",
        "shipping_method": "mail",
        "tracking_number": "132456787",
        "handling_date": null, 
    }
]
```

### Campos de la respuesta

La respuesta de un POST al recurso `/claims/actions/evidences` proporcionará los siguientes parámetros:

- **attachments** : archivos

- **type** : es el tipo de demostración  **shipping_evidence:**  cuando el vendedor ya tiene la prueba de envío **handling_shipping_evidence** : que debe usarse cuando existe una previsión de publicaciones.

- **date_shipped** : fecha de envío

- **date_delivered** : fecha de entrega

- **destination_agency** : nombre de la agencia de destino.

- **receiver_email** : correo electrónico del destinatario del pedido digital.

- **receiver_id** : documento de quién recibió el producto.

- **receiver_name** : nombre del destinatario.

- **shipping_company_name** : debes ingresar el nombre del transportista.

- **shipping_method** : refiere a cómo enviaron el producto, por correo, encomienda (por un transportista), entrega personal (por una persona) o por email (correo electrónico).

- **tracking_number** : Ingrese el número de seguimiento.

- **handling_date** : Fecha de publicación.

Nota:

- Todas las fechas deben usarse en los siguientes formatos:

- Formato largo: aaaa-MM-dd'T'HH: mm: ss.SSSZ. Ej: 2019-08-06T14: 00: 00.000-0400; Formato corto: aaaa-MM-dd. Ej: 2019-08-06

Para verificar dentro del Marketplace los archivos enviados por la API, puede acceder a la sección "Actividad" en Mercado Pago. En esta sección, encontrará el apartado "Detalle de la Reclamación", que incluye un botón "Mostrar datos del envío". Al hacer clic en este botón, se mostrarán los archivos enviados a través de la API o del Marketplace, proporcionando una visión clara y detallada de los envíos.

## Entrega por correo

| Query params | Obligatoriedad | Detalle value |
| --- | --- | --- |
| Type | Obligatorio | Tipo de entrega |
| shipping_company_name | Obligatorio | Nombre de la compañía por la que se envía |
| shipping_method | Obligatorio | método de envío |
| date_shipped | Obligatorio | fecha de envío |
| tracking_number | Opcional | Id del trackeo del envío |
| attachments | Opcional | archivo adjunto |

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/evidences
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d 
'{
    "type": "shipping_evidence",
    "shipping_method": "mail",
    "shipping_company_name": "Correios",
    "date_shipped": "2018-08-17T05:00:01.858-03:00",
    "tracking_number": "XX123456789XX",
    "attachments": ["38f4e399-0f18-41e4-8f48-91aecd2dee1a_419059118.png"]
}'
https://api.mercadolibre.com/post-purchase/v1/claims/949903015/actions/evidences
```

**Respuesta:**

```
[
    {
        "attachments": [
            {
             "filename":"38f4e399-0f18-41e4-8f48-91aecd2dee1a_419059118.png",
                "original_filename": "Captura de Tela 2019-07-30 a?s 09.45.40.png",
                "size": 63337,
                "date_created": "2019-08-21T09:33:02.325-04:00",
                "type": "image/png",
               
            }
        ],
        "date_shipped": "2018-03-07T04:00:01.858-04:00",
        "date_delivered": null,
        "destination_agency": null,
        "receiver_email": null,
        "receiver_id": null,
        "receiver_name": null,
        "shipping_company_name": "Correios",
        "shipping_method": "mail",
        "tracking_number": "XX123456789XX",
        "type": "shipping_evidence",
        "handling_date": null
    }
]
```

## Entrega por encomienda

| Query params | Obligatoriedad | Detalle value |
| --- | --- | --- |
| Type | Obligatorio | Tipo de entrega |
| shipping_company_name | Obligatorio | Nombre de la compañía por la que se envía |
| shipping_method | Obligatorio | método de envío |
| date_shipped | Obligatorio | fecha de envío |
| destination_agency | Obligatorio | Nombre de la agencia destino |
| receiver_name | Obligatorio | Nombre del que recibe |
| receiver_id | Opcional | ID del que recibe |
| tracking_number | Opcional | Id del trackeo del envío |
| date_delivered | Opcional | Fecha de entrega |
| receiver_email | Opcional | Email del que recibe |
| attachments | Opcional | archivo adjunto |

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/evidences
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d 
'{
    "type": "shipping_evidence",
    "shipping_method": "entrusted",
    "shipping_company_name": "Total",
    "destination_agency": "Agencia",
    "date_shipped": "2018-08-17T05:00:01.858-03:00",
    "receiver_name": "Jose da Silva"
    "receiver_id": "12345678"
    "tracking_number": "XX123456789XX",
    "attachments": []
}'
https://api.mercadolibre.com/post-purchase/v1/claims/949903015/actions/evidences
```

**Respuesta:**

```
[
    {
        "attachments": [],
        "date_shipped": "2018-08-17T04:00:01.858-04:00",
        "date_delivered": null,
        "destination_agency": "Agencia",
        "receiver_email": null,
        "receiver_id": 12345678,
        "receiver_name": "Jose da Silva",
        "shipping_company_name": "Total",
        "shipping_method": "mail",
        "tracking_number": "XX123456789XX",
        "type": "shipping_evidence",
        "handling_date": null
    }
]
```

## Entrega en mano

| Query params | Obligatoriedad | Detalle value |
| --- | --- | --- |
| Type | Obligatorio | Tipo de entrega |
| shipping_method | Obligatorio | método de envío |
| date_delivered | Opcional | Fecha de entrega |
| attachments | Opcional | archivo adjunto |

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/evidences
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d 
'{
    "type": "shipping_evidence",
    "shipping_method": "personal_delivery",
    "date_delivered": "2018-03-07T05:00:01.858-03:00"
    "attachments": []
}'
https://api.mercadolibre.com/post-purchase/v1/claims/949903015/actions/evidences
```

**Respuesta:**

```
[
    {
        "attachments": [],
        "date_shipped": null,
        "date_delivered": "2018-03-07T05:00:01.858-03:00",
        "destination_agency": null,
        "receiver_email": null,
        "receiver_id": null,
        "receiver_name": null,
        "shipping_company_name": null,
        "shipping_method": "personal_delivery",
        "tracking_number": null,
        "type": "shipping_evidence"
        "handling_date": null
    }
]
```

## Entrega en email

| Query params | Obligatoriedad | Detalle value |
| --- | --- | --- |
| Type | Obligatorio | Tipo de entrega |
| shipping_method | Obligatorio | método de envío |
| receiver_email | Obligatorio | Email del receptor |
| date_shipped | Obligatorio | fecha de envío |
| attachments | Opcional | archivo adjunto |

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/actions/evidences
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d 
'{
    "type": "shipping_evidence",
    "shipping_method": "email",
    "receiver_email": "teste@teste.com.br"
    "date_shipped": "2018-03-07T05:00:01.858-03:00"
    "attachments": []
}'
https://api.mercadolibre.com/post-purchase/v1/claims/949903015/actions/evidences
```

**Respuesta:**

```
[
    {
        "attachments": [],
        "date_shipped": "2018-03-07T05:00:01.858-03:00",
        "date_delivered": null,
        "destination_agency": null,
        "receiver_email": "teste@teste.com.br",
        "receiver_id": null,
        "receiver_name": null,
        "shipping_company_name": null,
        "shipping_method": "email",
        "tracking_number": null,
        "type": "shipping_evidence"
        "handling_date": null
    }
]
```

## Promesa de envío

En situaciones donde los productos aún no han sido enviados, pero el vendedor tiene una fecha prevista de envío, puede utilizar el siguiente recurso para gestionar la situación de manera proactiva:

**Llamada:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/post-purchase/v1/claims/$CLAIM_ID/evidences
```

**Ejemplo:**

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -d 
{
    "type": "handling_shipping_evidence",
    "handling_date": "2024-06-13"
}

https://api.mercadolibre.com/post-purchase/v1/claims/949903019/evidences
```

**Respuesta:**

```
{
        "attachments": [],
        "type": "handling_shipping_evidence",
        "date_shipped": null,
        "shipping_company_name": null,
        "shipping_method": null,
        "destination_agency": null,
        "date_delivered": null,
        "receiver_email": null,
        "receiver_id": null,
        "receiver_name": null,
        "tracking_number": null,
        "handling_date": "2024-06-13T00:00:00.000-04:00"
    }
```

Nota:

Cuando el "stage" del reclamo de un producto se encuentra en "discusión/mediación", el vendedor no podrá enviar pruebas de envío. Además, una vez enviada cualquier tipo de prueba, no será posible modificarla. Por ello, es fundamental que completes toda la información necesaria antes de enviar la prueba.

Siguiente: [Errores](https://developers.mercadolibre.com.ar/es_ar/errores)
