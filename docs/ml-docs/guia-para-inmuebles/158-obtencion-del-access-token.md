<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/obtencion-del-access-token -->
<!-- Sección: Guía para inmuebles -->

# Obtención del Access Token

Última actualización 05/11/2025

## Obtención del Access Token

La obtención del Access Token es un paso crucial para acceder a la API de MercadoLibre de manera segura. A continuación, se detallan los pasos necesarios para obtener tu Access Token, que funcionará como una llave para realizar peticiones a la API.

## ¿Qué es un Access Token y para qué sirve?

Un Access Token es una cadena de caracteres que actúa como una credencial temporal de acceso. Es generado por MercadoLibre una vez que el usuario autoriza a una aplicación a interactuar con su cuenta. Este token permite que tu aplicación realice operaciones seguras sobre la API en nombre del usuario, como obtener información de sus publicaciones, gestionar ventas o responder preguntas, entre otras acciones.

En otras palabras, el Access Token es como una llave digital única que identifica y valida que tu aplicación tiene permiso para acceder a ciertos recursos dentro del ecosistema de MercadoLibre. Este token tiene una duración limitada y debe ser renovado periódicamente mediante un proceso de refresh.

## 1. Preparación de Credenciales

Requisito:

Debes haber creado tu aplicación, siguiendo los pasos de la guía de creación, o según se indica en la guía de configuración.

Antes de comenzar, asegúrate de tener a mano la siguiente información:

- **Client ID:**  ID de tu aplicación.

- **Client Secret:**  Clave secreta de tu aplicación.

- **Redirect URI:**  Dirección URL definida al crear tu aplicación.

Podrás obtenerlos tal cómo se indica en la guía de gestión de aplicaciones.

## 2. Diagrama de Autenticación

**Explicación del Proceso de Autenticación:**

En este punto, estamos en el paso 3, donde necesitamos obtener nuestro código de autorización. Este código es imprescindible para obtener el Access Token que permitirá el uso de la API. Asegúrate de seguir los pasos correctamente para evitar errores.

## 3. Obtención del Código de Autorización

Para obtener el código de autorización, necesitas:

- Tu APP ID y Redirect URI definidos al crear la aplicación.

- Tener iniciada sesión con la cuenta de MercadoLibre que utilizaste para crear la aplicación.

En la siguiente URL, reemplaza $APP_ID por tu APP ID obtenida y así mismo hazlo con $REDIRECT_URL, luego copiala y pegala en una pestaña del navegador donde estés logueado con tu cuenta de MercadoLibre.

```
https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$APP_ID&redirect_uri=$REDIRECT_URL
```

Nota:

Si experimentas un error de conexión o intermitencia con la aplicación, por favor, inténtalo de nuevo construyendo la URL y pegándola en el navegador. Recuerda que debes haber iniciado sesión con el usuario (de prueba o el que usaste para crear la aplicación) al que le estás generando el token.

Una vez completado el paso anterior, serás redirigido a la URL que definiste al crear tu aplicación, en la URL encontrarás, en el parámetro `code`, el código de autorización que se requerirá para obtener el token. La URL se presentará de la siguiente manera:

```
https://YOUR_REDIRECT_URI?code=$SERVER_GENERATED_AUTHORIZATION_CODE
```

## 4. Obtener el Access Token

Ahora que cuentas con el código de autorización, puedes solicitar el Access Token ejecutando la siguiente consulta:

Importante:

No olvides reemplazar los parámetros de client id, client secret, código obtenido en el paso anterior, y tu url de redirect.

```
curl -X POST \
-H "accept: application/json" \
-H "content-type: application/x-www-form-urlencoded" \
'https://api.mercadolibre.com/oauth/token' \
-d 'grant_type=authorization_code' \
-d 'client_id=$client_id' \
-d 'client_secret=$client_secret' \
-d 'code=$code' \
-d 'redirect_uri=$redirect_uri'
```

Si la solicitud se ha procesado correctamente, recibirás una respuesta de la API con un código de estado 200 OK, junto con el siguiente cuerpo de datos.

Respuesta:

```
{
    "access_token": "APP_USR-0303456-053009-cc03aaf33-123456", 
    "token_type": "Bearer", 
    "expires_in": 21600, 
    "scope": "offline_access", 
    "user_id": 123456, 
    "refresh_token": "TG-0303456abc-123456" 
}
```

### Problemas Comunes

Si recibes un error, no te preocupes. Consulta la sección de errores comunes relacionados con Access Tokens en nuestra documentación de Autenticación y Autorización.

### Conclusión

Si has llegado hasta aquí, ya te encuentras conectado a nuestra API. Sin embargo, ten en cuenta que has configurado la conexión con tu cuenta real. Para evitar cargos, continúa con los siguientes pasos utilizando un usuario de prueba.

Vuelve a la guía de configuración para continuar el proceso.
