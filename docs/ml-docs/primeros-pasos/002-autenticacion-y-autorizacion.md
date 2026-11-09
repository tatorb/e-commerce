<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion -->
<!-- Sección: Primeros pasos -->

# Autenticación y Autorización

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 15/07/2026

## Autenticación y Autorización

Para comenzar a utilizar nuestros recursos es necesario que puedas desarrollar los procesos de Autenticación y Autorización. De esta manera, podrás trabajar con los recursos privados del usuario cuando autorice tu aplicación.

## Enviar access token por header

Por seguridad, debes enviar el access token por header cada vez que
        realices llamadas a la API.

```
curl -H 'Authorization: Bearer APP_USR-12345678-031820-X-12345678'
```

Y por ejemplo, realizando un GET al recurso /users/me sería:

```
curl -H 'Authorization: Bearer APP_USR-12345678-031820-X-12345678' \
https://api.mercadolibre.com/users/me
```

Conoce más sobre [la seguridad de tu desarrollo](https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token).

## Autenticación

El proceso de autenticación es utilizado para verificar la identidad de una persona en función de uno o varios factores, asegurando que los datos de quien los envió sean los correctos. Si bien existen diferentes métodos, en Mercado Libre utilizamos el basado en contraseñas.

## Autorización

La autorización es el proceso por el cual permitimos acceder a recursos privados. En este proceso, se deberá definir qué recursos y operaciones se pueden realizar (“sólo lectura” o “lectura y escritura”).

### ¿Cómo logramos la autorización?

A través del Protocolo OAuth 2.0, uno de los más utilizados en plataforma abiertas (Twitter, Facebook, etc.) y método seguro para trabajar con recursos privados.

Este protocolo nos brinda:

- Confidencialidad, el usuario no deberá revelar su clave en ningún momento.

- Integridad, solo podrán ver datos privados aquellas aplicaciones que tengan el permiso de hacerlo.

- Disponibilidad, los datos siempre estarán disponibles en el momento que se necesiten.

El protocolo de operación se llama Grant Types, y el que se utiliza es The Authorization Code Grant Type (Server Side).

A continuación te mostraremos cómo trabajar con los recursos de Mercado Libre utilizando el flujo Authorization Code en el Server Side.

## Server side

El flujo Server side es el más adecuado para las aplicaciones que ejecutan código del lado del servidor. Por ejemplo, aplicaciones desarrolladas en lenguajes como Java, Grails, Go, etc.

En resumen, el proceso que estarás realizando es el siguiente:

**Referencias**

1. Redirecciona la aplicación a Mercado Libre

2. No tienes que preocuparte por la autenticación de los usuarios a Mercado Libre, ¡nuestra plataforma se encargará de ello!

3. Página de autorización

4. POST para intercambiar el código de autorización por un access token

5. La API de Mercado Libre intercambia el código de autorización por un access token

6. Ya puedes utilizar el access token para realizar llamadas a nuestra API y así obtener acceso a los datos privados del usuario

### Paso a paso:

## 1. Realizando la autorización

1.1. Conecta tu usuario de Mercado Libre:

Notas:

- Puedes [utilizar un usuario de test](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas#Crea-un-usuario-de-test). 
- Recuerda que **el usuario que inicie sesión debe ser administrador** , para que el access token obtenido tenga los permisos suficientes para realizar las consultas.
- Si el usuario es un operador/colaborador, el grant no será válido y recibirás el error **invalid_operator_user_id** .
- Los siguientes eventos pueden invalidar un access token antes del tiempo de expiración:

- Cambio de contraseña por parte del usuario.

- Actualización del [Client Secret](https://developers.mercadolibre.com.ar/es_ar/registra-tu-aplicacion#Editar) por parte de una aplicación.

- Revocación de permisos a tu aplicación por parte del usuario.

- Si no utilizas la aplicación con alguna llamada en https://api.mercadolibre.com/ durante 4 meses.

Importante:

El redirect_uri debe corresponder exactamente a lo registrado en las configuraciones de tu aplicación para evitar errores de acceso, la url no puede contener información variable.

1.2. Coloca la siguiente URL en la ventana de tu navegador para obtener la autorización:

```
https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$APP_ID&redirect_uri=$YOUR_URL&code_challenge=$CODE_CHALLENGE&code_challenge_method=$CODE_METHOD
```

En el ejemplo utilizamos el URL para Argentina (MLA) pero si estás trabajando en otros países ten en cuenta cambiar el .com.ar por el dominio del país correspondiente. [Conoce los países donde operamos](https://api.mercadolibre.com/sites).

### Parámetros

**response_type** : enviando el valor “code” obtendrás un access token que te permitirá interactuar con la app de Mercado Libre.
 **redirec_URI** : el atributo YOUR_URL se completa con el valor cargado cuando [tu app fue creada](https://developers.mercadolibre.com.ar/devcenter/create-app). Debe ser exacto al que configuraste y no puede tener información variable

**client_id** : una vez creada la aplicación, se identificará como APP ID.

**State** : para aumentar la seguridad recomendamos que incluyas el parámetro del estado en la URL de autorización para garantizar que la respuesta pertenezca a una solicitud iniciada por tu aplicación. En caso de que tengas un identificar aleatorio seguro, podrás crearlo utilizando SecureRandom, debes ser exclusivo para intento de llamada.

Es necesario que el llamado al recurso /authorization sea de la siguiente forma:

```
https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$APP_ID&redirect_uri=https://mercadolibre.com.ar
```

Un uso adecuado para el parámetro **state**  es enviar un estado que necesitas conocer cuándo la URL establecida en el redirect_uri sea llamada. Recuerda que el redirect_uri debe ser una URL estática, por lo tanto si estás considerando enviar parametros en esta URL utiliza el parámetro state para enviar esta información, de lo contrario to request fallará por que el redirect_uri no coincide exactamente con el configurado en tu aplicación.

Los siguientes parámetros son opcionales y solo aplica si la aplicación tiene habilitado el flujo de **PKCE**  (Proof Key for Code Exchange), sin embargo, cuando esta opción está activada, el envío del campo se vuelve obligatorio:

**code_challenge** : código de verificación generado a partir de code_verifier y cifrado con code_challenge_method.

**code_challenge_method** : método utilizado para generar el code challenge. Actualmente se soportan los siguientes valores:

- S256: especifica que el code_challenge se encuentra cifrado usando el algoritmo de cifrado SHA-256.

- plain: se envía como code_challenge el mismo code_verifier. Por seguridad no se recomienda utilizar esté método.

El redirect_uri debe corresponder **exactamente**  a lo cargado cuando tu aplicación ID fue creado para evitar errores, no puede contener información variable:

1.3. Como último paso, el usuario será redirigido a la siguiente pantalla donde se le solicitará que vincule la aplicación con su cuenta.

Nota:

Agregamos información de DPP **(nivel de integrador)**  para comunicar al vendedor si la aplicación está certificada o no.

Si revisamos la URL, se puede observar que se agregó el parámetro code.

```
https://YOUR_REDIRECT_URI?code=$SERVER_GENERATED_AUTHORIZATION_CODE
```

Este code, será utilizado cuando se necesite generar un access token, que permitirá el acceso a nuestras API.

Nota:

Ten en cuenta que si el usuario es operador/colaborador, NO será posible que otorgue grant a la aplicación. Recibirás el error **invalid_operator_user_id** .

1.4 Si aparece el mensaje de error: **Lo sentimos, la aplicación no puede conectarse a tu cuenta** . se deben tomar las siguientes consideraciones:

1. 1. El redirect_uri debe corresponder exactamente a lo registrado en las configuraciones de tu aplicación para evitar errores de acceso; la URL no puede contener información variable.

2. 2. Validar que los token y grant del APP son válidos.

3. 3. Validar que el seller esté ingresando con la cuenta principal, no con un colaborador.

4. 4. Verifique si el vendedor o el owner de la aplicación tiene [datos pendientes de validación](https://developers.mercadolibre.com.ar/es_ar/validacion-de-datos), o alguna inhabilitación en la cuenta.

## 2. Cambiando el code por un token

Para que el código de autorización sea trocado por un access token, debes realizar un POST enviando los parámetros por BODY:

```
curl -X POST \
-H 'accept: application/json' \
-H 'content-type: application/x-www-form-urlencoded' \
'https://api.mercadolibre.com/oauth/token' \
-d 'grant_type=authorization_code' \
-d 'client_id=$APP_ID' \
-d 'client_secret=$SECRET_KEY' \
-d 'code=$SERVER_GENERATED_AUTHORIZATION_CODE' \
-d 'redirect_uri=$REDIRECT_URI' \
-d 'code_verifier=$CODE_VERIFIER' 
```

### Parámetros

**grant_type** : authorization_code indica que la operación deseada es intercambiar el “code” por un access token. 
 **client_id** : es el APP ID de la aplicación que se creó. 
 **client_secret** : es Secret Key que se generó al crear la aplicación.
 **code** : el código de autorización obtenido en el paso anterior.
 **redirect_uri** : el redirect URI configurado para tu aplicación, no puede tener información variable.

El siguiente parámetro es opcional y solo aplica si la aplicación tiene habilitado el flujo de **PKCE**  (Proof Key for Code Exchange):

**code_verifier** : secuencia de caracteres aleatoria con la que se generó el code_challenge. Esto será utilizado para verificar y validar la petición.

Respuesta:

```
{
    "access_token": "APP_USR-123456-090515-8cc4448aac10d5105474e1351-1234567",
    "token_type": "bearer",
    "expires_in": 10800,
    "scope": "offline_access read write",
    "user_id": 1234567,
    "refresh_token": "TG-5b9032b4e23464aed1f959f-1234567"
}
```

¡Listo! Ya puedes utilizar el access token para realizar llamadas a nuestra API y así obtener acceso a los recursos privados del usuario.

## 3. Refresh token

Ten en cuenta que el access token generado expirará transcurridas 6 horas desde que se solicitó. Por eso, para asegurar que puedas trabajar por un tiempo prolongado y no sea necesario solicitar constantemente al usuario que se vuelva a loguear para generar un token nuevo, te brindamos la solución de trabajar con un refresh token. Además, recuerda que el refresh_token es de uso **único y recibirás uno nuevo en cada proceso de actualización del token** .

Cada vez que realices la llamada que intercambie el code por un access token,
  también vendrá el dato de un refresh_token, que deberás guardar para
  intercambiarlo por un nuevo access token una vez que expire.

Para renovar tu access token debes efectuar la siguiente llamada:

```
curl -X POST \
-H 'accept: application/json' \
-H 'content-type: application/x-www-form-urlencoded' \
'https://api.mercadolibre.com/oauth/token' \
-d 'grant_type=refresh_token' \
-d 'client_id=$APP_ID' \
-d 'client_secret=$SECRET_KEY' \
-d 'refresh_token=$REFRESH_TOKEN'
```

### Parámetros

**grant_type** : refresh_token indica que la operación deseada es actualizar un token. 
 **refresh_token** : el refresh token del paso de aprobación guardado previamente. 
 **client_id** : es el APP ID de la aplicación que se creó. 
 **client_secret** : es Secret Key que se generó al crear la aplicación.

Respuesta:

```
{
    "access_token": "APP_USR-12345657984-090515-b0ad156bce70050973466faa15-1234567",
    "token_type": "bearer",
    "expires_in": 10800,
    "scope": "offline_access read write",
    "user_id": 1234567,
    "refresh_token": "TG-5b9032b4e4b0714aed1f959f-1234567"
}
```

La respuesta incluye un nuevo access token válido por 6 horas más y un nuevo REFRESH_TOKEN que necesitarás guardar para utilizarlo cada vez que expire.

Importante:

- Solo **permitimos utilizar el último REFRESH_TOKEN**  generado para hacer el intercambio.
- El **REFRESH_TOKEN solo puede ser usado una vez**  y solo por el client_id con el que está asociado, luego de ser utilizado quedará inválido. 
- Para optimizar los procesos de tu desarrollo, te sugerimos que renueves tu access token únicamente cuando pierda validez.

## Referencia de códigos de error

**1. invalid_client** : el client_id y/o client_secret de tu aplicación provisto es inválido.
 **2. invalid_grant** : este error se puede producir por diferentes motivos relacionados con: el authorization_code y refresh_token, puede ser porque el authorization_code o refresh_token son inválidos, [fueron revocados o expiraron](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion?nocache=true#Error-invalid-grant), se envió en el flujo incorrecto, pertenece a otro cliente o si el redirect_uri usado en el flujo de autorización no coinciden con el configurado en su aplicación, o el usuário (vendedor) tiene pendiente incluir dados y/o documentos.
 **3. invalid_scope** : el alcance solicitado es inválido, desconocido o está mal formado. Los valores permitidos para el parámetro alcance son: “offline_access”,”write”,”read”.
 **4. invalid_request** : la solicitud no incluye un parámetro obligatorio, incluye un parámetro o valor de parámetro no soportado, hay algún valor duplicado o está mal formada de otro modo.
 **unsupported_grant_type** : los valores permitidos para grant_type son “authorization_code” o “refresh_token”.
 **5. forbidden (403)** : la llamada no autoriza el acceso, posiblemente se está utilizando el token de otro usuario, [o el IP esta bloqueado, o faltam scopes](https://developers.mercadolibre.com.ar/es_ar/error-403). Para el caso de grant el usuario no tiene acceso a la URL de Mercado Libre de su site (.ar, .br, .mx, etc) y debe verificar que su conexión o navegador funcione correctamente para los domínio de MELI.
 **6. local_rate_limited (429)** : por llamadas excesivas se rechaza la request temporalmente. Inténtalo de nuevo en unos segundos.
 **7. unauthorized_client** : la aplicación no tiene autorización para el usuario solicitado o la autorización existente no autoriza los scopes con los que se quiere crear el token.
 **8. unauthorized_application** : [la aplicación está bloqueada](https://developers.mercadolibre.com.ar/es_ar/bloqueo-de-aplicaciones), por lo tanto, no es posible operar hasta que resuelva el problema.

## Error Invalid Grant

En el flujo de refresh token o authorization code es posible obtener el error **invalid_grant**  con el mensaje "Error validating grant. Your authorization code or refresh token may be expired or it was already used"

```
{
    "error_description": "Error validating grant. Your authorization code or refresh token may be expired or it was already used",
    "error": "invalid_grant",
    "status": 400,
    "cause": []
}
```

El mensaje indica que el authorization_code o refresh_token enviados no existen y los mismos fueron borrados. Algunos de los motivos son:

- **Expiración:** cumplido el tiempo de duración del [refresh_token](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion?nocache=true#Refresh-token) (6 meses), expira automáticamente y se debe realizar nuevamente el proceso para obtener uno nuevo.

- **Revocación de autorización:**  al revocarse la autorización entre seller y aplicación (ya sea por parte del integrador o el seller), se dispara el borrado de todos los access_token y refresh_token asociados a los mismos. Puedes verificar aquellos sellers que ya no tienen grant con tu aplicación, desde la opción “Administrar Permisos” (en el panel de Mis Aplicaciones) o utilizando el recurso para acceder al listado de [usuarios que otorgaron permiso a tu aplicación](https://developers.mercadolibre.com.ar/es_ar/gestiona-tus-aplicaciones#Usuarios-que-le-dieron-permisos-a-tu-aplicaci%C3%B3n).

- **Revocación Interna:** existen algunos flujos internos que realizan borrado de credenciales de los usuarios, lo cual impide que los integradores puedan seguir actuando en nombre del seller, y tengan que realizar nuevamente el flujo de autorización/autenticación. Estos flujos son disparados principalmente por borrado de sesión de usuario; los motivos son varios, destacándose como los más comunes el cambio de contraseña, desvinculación de dispositivos o detección de fraude. Conoce cómo [revocar la autorización de un usuario a tu aplicación](https://developers.mercadolibre.com.ar/es_ar/gestiona-tus-aplicaciones#Revoca-la-autorizaci%C3%B3n-del-usuario).

Importante:

Para este último flujo, apenas describimos algunos ejemplos y no todos los casos existentes.

**Siguiente** : [Consulta API Docs](https://developers.mercadolibre.com.ar/es_ar/api-docs-es).
