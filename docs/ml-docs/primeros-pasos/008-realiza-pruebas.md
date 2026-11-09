<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas -->
<!-- Sección: Primeros pasos -->

# Realiza pruebas

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Realiza pruebas

En Mercado Libre no contamos con un ambiente de test o sandbox, sino que disponibilizamos la utilización de usuarios test para probar directamente en producción. La ventaja de trabajar con un usuario de test es que puedes simular con esos usuarios las mismas acciones permitidas para los usuarios reales: Publicar, actualizar datos, preguntar, responder, comprar, vender, etc - entre usuarios de test -, sin abonar cargos o recibir sanciones y, al mismo tiempo, evitando perjudicar la reputación de un usuario real. Este tutorial te orientará para comenzar a trabajar con nuestra API mientras tu aplicación se encuentra en desarrollo.

Importante:

Todas las operaciones test deben ser realizadas con usuarios test. Recuerda que las cuentas personales no deben ser utilizadas para test.

## Enviar access token por header

Para mayor seguridad, te recomendamos enviar tu access token por header
        al realizar llamadas a la API. Por ejemplo, realizando un GET al recurso
        /users/me sería:

```
curl -H ‘Authorization: Bearer APP_USR-12345678-031820-X-12345678’ \
https://api.mercadolibre.com/users/me
```

## Crea un usuario de test

Para crear un usuario de test debes tener un token. Si aún no tienes tu ACCESS TOKEN, comienza con nuestra [guía de Autenticación y Autorización](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion/). Lo único que debes enviar en el JSON es el país donde deseas operar. Consulta nuestra [API de Sites](https://api.mercadolibre.com/sites) para conocer el site_id perteneciente a cada país. Te recomendamos la creación de al menos un usuario vendedor y un usuario comprador para realizar operaciones entre ellos.Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-type: application/json" -d 
'{
   	"site_id":"MLA"
}' 
'https://api.mercadolibre.com/users/test_user'
```

Respuesta:

```
{
	"id":120506781,
    "nickname":"TEST0548",
    "password":"qatest328",
    "site_status":"active"
}
```

¡Excelente! En la respuesta recibes el User_id, apodo, contraseña y estado actual de tu nuevo usuario de test.

Nota:

Una vez creado el usuario de prueba te recomendamos guardar sus datos y credenciales.

## Consideraciones

- Puedes crear hasta 10 usuarios de test con tu cuenta de Mercado Libre (cuando se crea al user de test las credenciales deben ser guardadas, ya que no contamos con un recurso que muestre los usuarios de test creados y sus credenciales).

- Los usuarios de test no estarán activos durante mucho tiempo, pero una vez que expiran, puedes crear nuevos.

- Los artículos deben titularse “Item de Prueba - Por favor, NO OFERTAR”.

- En la medida de lo posible, publica en la categoría “Otros”.

- Nunca publiques en “gold” ni “gold_premium” para que no llegue a nuestra página de inicio.

- Los usuarios de test pueden simular operaciones solo con artículos de prueba: los usuarios de test solo pueden comprar, vender y formular preguntas sobre artículos de otros usuarios test: sólo pueden comprar, vender, realizar preguntas, etc. en publicaciones test, creadas por cuentas test.

- Los usuarios de test sin actividad (comprar, preguntar, publicar, etc.) durante 60 días se eliminan de inmediato.

- Estos artículos se eliminan en forma periódica.

- Si su usuario de prueba está bloqueado indebidamente, envía los datos de tu usuario de prueba en el sopote por site.  [Argentina](https://developers.mercadolibre.com.ar/support) [México](https://developers.mercadolibre.com.mx/support) [Chile](https://developers.mercadolibre.cl/support) [Bolivia](https://developers.mercadolibre.com.bo/support) [Colombia](https://developers.mercadolibre.com.co/support) [Costa Rica](https://developers.mercadolibre.co.cr/support) [República Dominicana](https://developers.mercadolibre.com.do/support) [Ecuador](https://developers.mercadolibre.com.ec/support) [Uruguay](https://developers.mercadolibre.com.uy/support) [Perú](https://developers.mercadolibre.com.pe/support)

- El **código de validación del email para usuarios de test** será igual a los últimos dígitos del user id y puede tener 4 o 6 dígitos. Por ejemplo, para el user id 653764425, el código podría ser 764425.

## Compra y vende entre usuarios de test

Recuerda que las pruebas en la plataforma y todas las transacciones deben hacerse con usuarios test. Además, las cuentas personales o de familiares no deben contener anuncios. Para simular compras entre usuarios de test, debes [utilizar tarjetas de prueba](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/additional-content/your-integrations/test/cards). Recuerda que los de test en la plataforma y todas las operaciones deben ser hechas entre usuarios test. Además, las cuentas personales no deben tener artículos para este fin.

Notas:

- Los datos que debes cargar son ficticios y, por seguridad, no agregamos los nombres de los bancos en las tarjetas disponibles para hacer pruebas.

- Al ingresar al link de tarjetas de prueba, será necesario que modifiques la URL por la del país en el que te encuentres. Ten en cuenta que el link solo estará disponible para los países que tengan activo Mercado Pago.

- Para probar diferentes resultados de pago, completa el estado de pago deseado en el nombre y apellido del titular de la tarjeta al realizar la compra. Por ejemplo, si deseas que el pago sea aprobado, debes ingresar "APRO APRO".
