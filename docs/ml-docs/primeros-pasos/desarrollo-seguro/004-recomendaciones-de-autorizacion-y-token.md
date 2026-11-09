<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token -->
<!-- Sección: Primeros pasos > Desarrollo Seguro -->

# Recomendaciones de Autorización y Token

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Recomendaciones de Autorización y Token

Desde Mercado Libre velamos día a día por la seguridad de nuestros usuarios a la hora de lanzar nuevas funcionalidades en la plataforma y además, ¡queremos que tu aplicación también forme parte de este proceso! 
A la hora de desarrollar una aplicación es importante estar atento a como el código está escrito ya que puede tener brechas de fraudes o robos de información por eso, ten en cuenta las siguientes recomendaciones para poder mitigar vulnerabilidades.

## Obtener access token enviando parámetros por body

Cuando realices un POST al recurso /oauth/token para obtener el access token, deberás enviar los [parámetros](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion#Parametros-Refresh-token) en el cuerpo y no como query. ¡Esto permite que vayan de manera más segura!

Ejemplo:

```
curl -X POST \
-H 'accept: application/json' \
-H 'content-type: application/x-www-form-urlencoded' \
'https://api.mercadolibre.com/oauth/token' \
-d 'grant_type=authorization_code' \
-d 'client_id=$client_id' \
-d 'client_secret=$client_secret' \
-d 'code=$code' \
-d 'redirect_uri=$redirect_uri'
```

## Generación de ID para obtener access token

Como una medida opcional para aumentar la seguridad en los procesos para obtener access tokens, te recomendamos que generes un valor random de tipo secure y lo envies como parámetro state. 
Por ejemplo para crear el secure random id, en Java:

```
SecureRandom random = new SecureRandom();
```

Ejemplo agregando state:

```
curl -X  GET https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$APP_ID&state=ABC123&redirect_uri=$REDIRECT_URL
```

Recibirás el código de autorización y también el identificador seguro en la URL de retorno especificada:

```
https://YOUR_REDIRECT_URI?code=$SERVER_GENERATED_AUTHORIZATION_CODE&state=ABC123
```

¡Recuerda revisar el valor para asegurarte que la respuesta pertenece a una solicitud iniciada por tu aplicación!

## Utilización de misma redirect URI

¡Recuerda enviar como redirect_uri la misma URL que colocaste cuando creaste la aplicación!

[Ver más](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion#Autenticaci%C3%B3n)

## Validación de URLs para recibir notificaciones

En primera instancia valida el origen para saber que estás recibiendo las notificaciones solo desde Mercado Libre y luego ten en cuenta revisar las URLs al recibir notificaciones para asegurarte que los recursos que tu aplicación va a consultar sean válidos.

## Access token en todas las peticiones

En cada llamada que realices a la api de Mercado Libre, ten en cuenta agregar el access token en todos los recursos tanto públicos como privados y que corresponda al usuário que la consulta.
