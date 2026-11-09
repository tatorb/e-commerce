<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/configuracion-o-requisitos-previos -->
<!-- Sección: Guía para inmuebles -->

# Configuración o requisitos previos

Última actualización 06/11/2025

## Configuración o requisitos previos

Antes de comenzar es necesario que realices una serie de pasos previos para que tengas todo listo.

# 1. Crea tu cuenta de MercadoLibre

Para comenzar a usar nuestra API, necesitas una cuenta de MercadoLibre. Esta cuenta será tu acceso principal al ecosistema de desarrollo.

- **¿Ya tienes una cuenta?**  ¡Genial! Puedes saltar al siguiente paso.

- **¿Eres nuevo en MercadoLibre?**  No te preocupes, registrarse es muy fácil. Simplemente visita el sitio web de MercadoLibre correspondiente a [tu país](https://www.mercadolibre.com/) y sigue las instrucciones para crear una cuenta.

## 2. Configura tu aplicación y obtén tus credenciales

Para poder usar la API de MercadoLibre, cada desarrollador necesita crear una aplicación en nuestro portal de desarrolladores. Esto te permitirá obtener las credenciales únicas necesarias para acceder a nuestros servicios.

### **Sigue estos pasos** :

- Visita nuestro [sitio de desarrolladores](https://developers.mercadolibre.com/). En la página, selecciona el país en el que vas a trabajar para acceder a la documentación y recursos correspondientes.

- Sigue esta guía detallada paso a paso para crear tu aplicación: Luego obtendrás un Client ID y un Client Secret. ¡Guárdalos bien, los necesitarás!

Importante:

Durante la creación de tu aplicación, deberás agregar al menos una "Redirect URI". Puedes ingresar una URL de prueba (incluso si no existe), ya que la necesitarás en el siguiente paso.

En resumen, con tus credenciales (Client ID y Client Secret), podrás generar 'Access Tokens' para interactuar con la API.

## 3. Consigue tu Access Token: La llave para acceder a la API

¡Llegó el momento de obtener tu Access Token! Este token es como una llave que te permitirá acceder a la API de MercadoLibre de forma segura. Sigue los pasos detallados en la sección de Autenticación para conseguirlo, luego regresa a este punto para continuar.

¿Quieres saber más?

Para una comprensión más profunda de la autenticación y autorización, puedes consultar nuestra documentación completa: [Autenticación y Autorización](https://developers.mercadolibre.cl/es_ar/autenticacion-y-autorizacion).

## 4. Realiza tu primera petición a la API

Con tu Access Token en mano, vamos a realizar una petición sencilla para verificar que todo esté configurado correctamente.

### Sigue este paso:

Abre tu terminal o línea de comandos y ejecuta la siguiente petición curl:

```
curl -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/me
```

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| `ACCESS_TOKEN` | string | No | Recuerda utilizar el token que generaste en el paso anterior |

### ¿Qué esperar?

Si todo ha ido bien, recibirás una respuesta de nuestra API con un código de estado 200 OK y un cuerpo con los datos de tu usuario. ¡Eso significa que estás conectado!

¿Encuentras algún problema?

Si recibes un error, no te preocupes. Consulta la sección de errores comunes relacionados con Access Tokens en nuestra documentación de Autenticación y Autorización.

## ¡Listo! ya te encuentras conectado con nuestra API

Completaste la configuración inicial.

Pero atención:

lo hiciste con tu cuenta real. Para evitar movimientos o cargos no deseados, los próximos pasos deben hacerse con un usuario de prueba. A continuación, te explicaremos cómo crearlo.

Ahora sí, estás listo para explorar la API de MercadoLibre y empezar a construir soluciones increíbles.
