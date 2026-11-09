<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/vehiculos-sincroniza-publicaciones -->
<!-- Sección: Guía para vehículos -->

# Sincroniza publicaciones (vehículos)

Última actualización 28/08/2026

## Sincroniza publicaciones (vehículos)

Una vez que tienes publicaciones activas en nuestro sitio, es probable que debas actualizarlas y modificarlas en forma periódica para sincronizar para excluir los anuncios ya vendidos, pausar publicaciones, mejorar descripciones, actualizar precios, etc. Sigue esta guía para aprender cómo hacerlo.

**Importante:**

A partir del **01/10/2026** , los campos **country_code2**  y **phone2**  del objeto **seller_contact**  pasan a ser obligatorios para las actualizaciones de publicaciones de Vehículos (Motors), cuando la cuenta del vendedor tiene perfil de **concesionario (car dealer)** . El objeto seller_contact debe enviarse completo en el cuerpo de la solicitud. Las actualizaciones sin estos datos serán rechazadas con HTTP 400. Consulta la sección **[Contacto del vendedor (seller_contact)](https://developers.mercadolibre.com.ar/es_ar/vehiculos-sincroniza-publicaciones#Contato-del-vendedor:~:text=realizar%20una%20actualizaci%C3%B3n.-,Contacto%20del%20vendedor%20(seller_contact),-El%20objeto%20seller_contact)**  para el detalle de los campos.

## Consideraciones

Puedes modificar los valores para:

- Title

- Price

- Video

- Pictures

- Description*

- Location

- Atributos de la publicación (array “attributes”)

- Category

*No es posible modificar, sólo agregar un post. También recuerda que el tipo de publicación se puede modificar solo una vez.

Nota:

Desde el **12 de marzo de 2026** , las solicitudes de actualización de publicaciones de tipo **silver, gold, gold_special y gold_premium**  que presenten **requires_picture: true**  son rechazadas (**HTTP 400** ) si no incluyen imágenes. Incluye al menos una imagen en el array **pictures**  para estos tipos de publicaciones.

## Actualiza tu artículo

Veamos un ejemplo básico de actualización del título y el precio de una publicación. Lo único que necesitas es el item_id del producto publicado y, por supuesto, el access_token del vendedor.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "title": "Your new title",
  "price": 1000
}
https://api.mercadolibre.com/items/ITEM_ID
```

Bien, el título y precio de tu publicación fueron actualizados y deberías recibir un estado de respuesta con código 200 OK para confirmar que no hubo inconvenientes. Recuerda que puede tardar un momento hasta ver la información actualizada.

## Descripciones

Es muy fácil actualizar una descripción y lo puedes hacer independientemente de que el artículo tenga o no ofertas. Pero como existen ciertas consideraciones que debes recordar al agregar o reemplazar descripciones, consulta nuestro [artículo sobre descripciones](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos) para asegurarte de entenderlo bien.

## Imágenes

Siempre puedes agregar o reemplazar imágenes de artículos; consulta [nuestro tutorial Trabajar con imágenes](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes) para conocer la mejor forma de hacerlo.

## Tipos de publicación

Cuando quieres más exposición para tu artículo, debes actualizar el tipo de publicación. Conoce nuestro tutorial [Tipos de publicación y cómo obtener mayor exposición](https://developers.mercadolibre.com.ar/es_ar/tipos-de-publicacion-y-actualizaciones-de-articulos) y aprende cómo realizar una actualización.

## Contacto del vendedor (seller_contact)

El objeto **seller_contact**  reúne los datos de contacto mostrados en la publicación y habilita el contacto vía WhatsApp a través de **country_code2**  y **phone2** .

Nota:

A partir del **01/10/2026** , **country_code2**  y **phone2**  pasan a ser obligatorios para las actualizaciones de publicaciones de Vehículos (Motors), cuando la cuenta del vendedor tiene perfil de **concesionario (car dealer)** . El número de WhatsApp debe incluir el código de país en **country_code2**  (ej.: "54") y el número de celular en **phone2**  (ej.: "935122222222").

| Campo | Tipo | Estado (a partir del 01/10/2026) | Descripción |
| --- | --- | --- | --- |
| contact | String | Opcional | Nombre del contacto o representante. |
| other_info | String | Opcional | Información adicional de contacto. |
| country_code | String | Opcional | Código de país del teléfono principal. |
| area_code | String | Opcional | Código de área del teléfono principal. |
| phone | String | Opcional | Número de teléfono principal del vendedor. |
| email | String | Opcional | E-mail del vendedor para recibir consultas. |
| webpage | String | Opcional | Sitio web del vendedor o de la inmobiliaria. |
| country_code2 | String | **Obligatorio** | Código de país del número de WhatsApp. |
| phone2 | String | **Obligatorio** | Número de WhatsApp del vendedor. |

Ejemplo de llamada:

```

curl -L -X PUT 'https://api.mercadolibre.com/items/MLA753960000 \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
--data-raw '{
    "seller_contact": {
        "contact": "Contact name",
        "other_info": "Additional contact info",
        "country_code": "55",
        "area_code": "011",
        "phone": "4444-5555",
        "country_code2": "55",
        "phone2": "992999999",
        "email": "contact-email@somedomain.com",
        "webpage": ""
    }
}'
```

### Errores de validación "seller_contact"

**Importante:**

Los campos **country_code2**  y **phone2**  deben contener solo dígitos numéricos, sin los caracteres "+", espacios, paréntesis o guiones. Cada dato debe enviarse en el campo correspondiente. En **country_code2**  solo se debe enviar el código de País y el resto del número concatenado en **phone2** .

Si los campos obligatorios no son enviados o están vacíos, la API retornará **HTTP 400**  con uno de los códigos siguientes.

| Código de error | HTTP | Descripción | Acción |
| --- | --- | --- | --- |
| seller_contact.required | 400 | El objeto seller_contact no fue enviado. | Incluir el objeto seller_contact completo en la solicitud. |
| seller_contact.country_code2.required | 400 | country_code2 es obligatorio para este tipo de publicación. | Incluir un número de WhatsApp válido en seller_contact.country_code2. |
| seller_contact.phone2.required | 400 | phone2 es obligatorio para este tipo de publicación. | Incluir un número de WhatsApp válido en seller_contact.phone2. |
| seller_contact.country_code2.invalid | 400 | El valor de country_code2 no tiene formato válido. | Verificar que no haya caracteres especiales ni espacios. |
| seller_contact.phone2.invalid | 400 | El valor de phone2 no tiene formato válido. | Verificar que no haya caracteres especiales ni espacios. |

Nota:

Cuando hay preguntas de compradores en los anuncios, Mercado Libre las envía al correo electrónico del vendedor (consignado en el campo seller_contact.email). En caso de que no sea informado, Mercado Libre utilizará el correo electrónico de la cuenta del vendedor en el sitio.

## Cambia el estado de las publicaciones

Cualquier artículo publicado en nuestro marketplace puede tener diferentes estados; analiza la descripción de cada uno a continuación:

- **cerrado:**  finaliza tu publicación. Una vez cerrado, no se puede volver a activar, pero se puede volver a publicar.

- **pausado:**  pausa tu publicación. Una vez pausado, los visitantes no podrán entrar en contacto ya que los datos serán eliminados.

- **activo:**  reactiva un artículo previamente pausado. Si necesitas realizar cambios en el estado del artículo, debes enviar uno de estos valores para el campo "estado”.

Recuerda que el valor distingue entre mayúsculas y minúsculas y se debe enviar en minúscula. Para pausar un artículo activo, sigue el ejemplo a continuación:

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
  "status":"paused"
}
https://api.mercadolibre.com/items/ITEM_ID
```

Excelente! Tu publicación ha sido pausada. Ahora puedes intentar reactivarla realizando exactamente la misma llamada, pero enviando "activo" en lugar de "pausado" como valor del estado. Si actualmente tu publicación está cerrada y quieres volver a publicarla, consulta nuestro artículo sobre volver a publicar para hacerlo rápido. Para más información sobre el estado del artículo, por favor consulta el artículo sobre el [tiempo de vigencia de la publicación](https://developers.mercadolibre.com.ar/es_ar/vehiculos-gestiona-paquetes?nocache=true#Ciclo-de-vida).

## Actualización con atributo WITH_FINANCING_OPTIONS (Opciones de financiamiento)

Importante:

La inclusión del atributo [WITH_FINANCING_OPTIONS](https://developers.mercadolibre.com.ar/%E2%80%9Chttps://developers.mercadolibre.com.ar/es_ar/publica-vehiculos#Definicion-de-atributos:~:text=Central%20de%20Venezuela.-,Opciones%20de%20Financiamiento,-Importante%3A%E2%80%9D) está actualmente habilitada solo para el **site MLA (Argentina)** .

El envío del campo **WITH_FINANCING_OPTIONS**  posibilita al vendedor señalar en sus publicaciones la disposición para negociar condiciones alternativas de pago (financiamiento) con el comprador.

Para actualizar (agregar o modificar) el atributo de financiamiento en una publicación existente, debes enviar el array sale_terms mediante una llamada **PUT**  al endpoint /items/{ItemID}. Este atributo es de tipo booleano, donde el value_id define si el producto es financiable o no.

| Parámetro | Opcional | Valores |
| --- | --- | --- |
| id | No | WITH_FINANCING_OPTIONS |
| value_id | No | 242085 (Sí = financiable) / 242084 (No = no financiable) |
| value_name | No | Sí / No |

Nota:

Es necesario que toda publicación contenga el precio final del producto en el campo price. El uso de este atributo no exime al vendedor del requisito de informar el precio total.

Ejemplo de llamada:

```
curl -L -X PUT 'https://api.mercadolibre.com/items/MLA1568702067' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
  "sale_terms": [
    {
      "id": "WITH_FINANCING_OPTIONS",
      "value_id": "242085",
      "value_name": "Sí"    
    }
  ]
}'
```

Identificación del atributo en la respuesta:

```
{
  "id": "MLA1568702067",
  "site_id": "MLA",
  "title": "Citroën C4 Picasso 1.6 Origine Hdi 115cv",
  ...
  "sale_terms": [
    ...
    {
      "id": "WITH_FINANCING_OPTIONS",
      "name": "Con opciones de financiamiento",
      "value_id": "242085",
      "value_name": "Sí",
      ...
    }
  ]
}
```

## Actualización con el atributo INITIAL_PAYMENT_AMOUNT (financiación con anticipo)

Importante:

La inclusión de este atributo está actualmente **habilitada solo para el sitio MLA (Argentina)** .

El atributo **INITIAL_PAYMENT_AMOUNT**  permite al vendedor informar el valor inicial (anticipo) que el comprador debe pagar al cerrar la operación. Este campo es una excelente forma de dar transparencia a la negociación. Al activar esta opción, enviando el atributo, el anuncio exhibirá el valor del anticipo.

Para actualizar (agregar o modificar) el atributo de valor del anticipo en una publicación existente, debes enviar el array **sale_terms**  mediante una llamada **PUT**  al endpoint **/items/$ITEM_ID** . Donde el campo **value_name**  informa el valor del anticipo del producto.

| Parámetro | Opcional | Valores |
| --- | --- | --- |
| id | No | INITIAL_PAYMENT_AMOUNT |
| value_name | No | Valor numérico de la entrada acompañado de la unidad monetaria de la moneda (ej.: 6000000 ARS) |
| value_struct.unit | Sí | Unidad monetaria correspondiente. Ej.: ARS |

El valor informado en el campo **"value_name"**  debe corresponder a la **misma moneda (currency_id) que el ítem** . En caso de que el valor de "INITIAL_PAYMENT_AMOUNT" sea enviado en una moneda distinta, el sistema realizará automáticamente la conversión a la moneda del ítem.

Importante:

El atributo **INITIAL_PAYMENT_AMOUNT**  es condicional. Solo puede incluirse/actualizarse cuando el anuncio ya tenga **WITH_FINANCING_OPTIONS habilitado** . Si WITH_FINANCING_OPTIONS está deshabilitado, no está permitido definir INITIAL_PAYMENT_AMOUNT.

Ejemplo de llamada:

```
curl -L -X PUT 'https://api.mercadolibre.com/items/MLA2736093652' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
  "sale_terms": [
    {
      "id": "INITIAL_PAYMENT_AMOUNT",
      "value_name": "7500000 ARS",
      "value_struct": {
        "unit": "ARS"
      }
    }
  ]
}'
```

Identificación del atributo en la respuesta:

```
"sale_terms": [
  {
    "id": "INITIAL_PAYMENT_AMOUNT",
    "name": "Valor del anticipo",
    "value_id": null,
    "value_name": "7500000 ARS",
    "value_struct": {
      "number": 7500000,
      "unit": "ARS"
    }
  }
]
```

## ¿Cómo remover el valor de entrada?

Para remover el valor del anticipo del anuncio, actualiza el ítem enviando en el array **sale_terms**  el objeto con id igual a **INITIAL_PAYMENT_AMOUNT**  y el campo **value_name**  vacío ("").

Llamada de ejemplo:

```
curl -L -X PUT 'https://api.mercadolibre.com/items/MLA2736093652' \
-H 'Content-Type: application/json' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-d '{
  "sale_terms": [
    {
      "id": "INITIAL_PAYMENT_AMOUNT",
      "value_name": ""
    }
  ]
}'
```

Si el atributo se elimina correctamente, la API devolverá un **200 OK**  con la representación completa del ítem actualizado, sin el atributo **INITIAL_PAYMENT_AMOUNT**  que fue eliminado.

Nota:

Es necesario que toda publicación contenga el precio final del producto en el campo “price”. El uso del atributo **“INITIAL_PAYMENT_AMOUNT”**  no exime al vendedor del requisito de informar el precio total. El envío de este atributo es opcional.

## Elimina publicaciones

Después de eliminar una publicación no hay vuelta atrás, así que ten cuidado cuando llames a esta acción. También tené en cuenta que no hay necesidad de eliminar los artículos cerrados, ya que se descartarán automáticamente después de algún tiempo. Si todavía necesita eliminar un artículo, por ejemplo los artículos en estado payment_required que no responden al estado 'cerrado', haga lo siguiente.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
"status": "closed"
}
https://api.mercadolibre.com/items/ITEM_ID
Segundo paso
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
"deleted":"true"
}
https://api.mercadolibre.com/items/ITEM_ID
```

Nota:

En caso de que al hacer el segundo PUT obtengas el error:

message: item optimistic

locking error: conflict

status: 409

cause: array(0)

Se debe a que deberás esperar unos segundos hasta que se actualice la información. Una vez eliminada la publicación se continuará viendo en la VIP por un período de tiempo corto bajo la leyenda "publicación finalizada".

**Siguiente:**  [Gestiona contactos y visitas](https://developers.mercadolibre.com.ar/es_ar/vehiculos-gestiona-contactos-y-visitas).
