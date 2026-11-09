<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/crea-una-aplicacion-en-mercado-libre-es -->
<!-- Sección: Primeros pasos -->

# Crea una aplicación en Mercado Libre

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 06/08/2026

## Crea una aplicación en Mercado Libre

**Importante:**

A partir del 30/08/2026, las aplicaciones deberán estar separadas entre Mercado Libre y Mercado Pago — una aplicación por unidad. Las aplicaciones que no realicen la adecuación perderán el acceso a las APIs de Mercado Libre.
Revisá los Escopos de tu aplicación y confirmá mediante `GET applications/$APP_ID` que no hay escopos del tipo `urn:mp:...` Si los hay, accedé al DevCenter de Mercado Pago para realizar los ajustes.

Para crear una aplicación, debes loguearte e ingresar a **Mis aplicaciones**  ([Argentina](https://developers.mercadolibre.com.ar/devcenter/), [Brasil](https://developers.mercadolivre.com.br/devcenter/), [Chile](https://developers.mercadolibre.cl/devcenter/), [México](https://developers.mercadolibre.com.mx/devcenter/), [Colombia](https://developers.mercadolibre.com.co/devcenter/), [Uruguay](https://developers.mercadolibre.com.uy/devcenter/), [Peru](https://developers.mercadolibre.com.pe/devcenter/), [Ecuador](https://developers.mercadolibre.com.ec/devcenter/) e [Venezuela](https://developers.mercadolibre.com.ve/devcenter/)) y completar la información que se solicita. Luego, obtendrás un Client Id y Secret Key, necesarios para autenticarte con nuestra API.

Antes de crear una aplicación, asegúrate que la cuenta que estás utilizando es **la cuenta del propietario**  en la solución que va a desarrollar, evitando así problemas de transferencia de cuenta en el futuro. Recomendamos que la cuenta se cree bajo una entidad legal.

Estos son los pasos para crear una aplicación dentro de Mercado Libre, que te permitirá acceder al ecosistema de APIs públicas desde una integración:

1. Accede a nuestro [DevCenter](https://developers.mercadolibre.com.ar/devcenter).

2. 

3. 

4. Haz clic en **Crear nueva aplicación** , y completa todos los datos obligatorios.

5. Nota:   En algunos países (Argentina, México, Brasil y Chile), solo se permite crear una aplicación luego de la inclusión y validación de los datos del titular de la cuenta. Para ello, debes estar atento a la información ingresada al momento de crear la cuenta, porque debe ser exactamente la misma. En caso de no tener esta información, sugerimos que te contactes con el equipo de atención al cliente de Mercado Libre para obtener orientación sobre la cuenta.

6. 

7. Información básica de la aplicación

8. 

9. 

10. **Nombre** : nombre de tu aplicación. Debe ser único.

11. **Descripción** : esta descripción (hasta 150 caracteres) se mostrará cuando la aplicación solicite una autorización.

12. **Logo** : incluye una imagen de su empresa con las dimensiones informadas.

13. 

14. En URIs de redirect se suman las posibles URIs de redireccionamiento en donde se devolverá el Code de la autorización recibida. Completa con la raíz del dominio.

15. 

16. 

17. Importante:   Para crear una aplicación dentro de la sección de **Mis aplicaciones**  es obligatorio utilizar el protocolo HTTPS en su URI de redireccionamiento, ya que de esta forma se asegura que el mensaje se envía encriptado y solo las personas autorizadas puedan leerlo.

18. **Use PKCE (Proof Key for Code Exchange)** : esto determina si la aplicación tendrá activa la validación de PCKE para la generación de token. Esto permite hacer un segundo chequeo para evitar ataques de inyección de código de autorización y CSRF(Cross-site Request Forgery), su uso es opcional aunque se recomienda utilizarlo.

19. 

20. **Device Grant** : Este flujo se utiliza cuando las aplicaciones solicitan un token de acceso, utilizando solo sus credenciales, para acceder a sus propios recursos, no en nombre de un usuario. La principal diferencia con el resto de flujos, para este token se realizan llamadas recurrentes hasta que el usuario finaliza el proceso de autorización y se puede devolver el token de autorización o hasta que se supera el tiempo asignado para el flujo.

21. 

22. Scopes

23. Lectura: permite el uso de métodos API GET HTTPS.  Escritura: permite el uso de métodos API PUT, POST y DELETE HTTPS..

24. [Conozca más sobre nuestros Permisos funcionales.](https://developers.mercadolibre.com.ar/es_ar/permisos-funcionales)

25. 

26. **Tópicos**: contiene un check list que clasifica por temas específicos, podrás seleccionar únicamente [los intereses que tienes en recibir notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones) y en el campo **"Notificaciones callbacks URL"**  se debe configurar una ruta para recibir estas notificaciones.****

27. 

28. Importante:   Completa este campo con una URL adecuada, válida y configurada para recibir notificaciones.

29. 

30. 

31. **Tópicos** : existen varios, estos son los principales

32. 

33. Orders Messages Items Catalog Shipments Promotions

34. Mercado Libre realiza solicitudes para esta ruta siempre que ocurra una novedad entre los tópicos seleccionados. Obtén más información [consultando la documentación de notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones).

35. 

36. Guarda el proyecto y serás redirigido a la página de inicio donde incluiremos tu aplicación. Puedes ver el ID y la clave secreta (Secret_Key) que tu aplicación ha expuesto. Con estos valores, podemos comenzar nuestra integración.

37. 

38. Con la aplicación creada y configurada correctamente, debes revisar la documentación de [autenticación y autorización](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion) para seguir con su integración y ver cómo generar un token.

## Gestionar mis aplicaciones

Una vez creada la aplicación dentro de Mercado Libre puedes acceder en [DevCenter](https://developers.mercadolibre.com.ar/devcenter). Si tienes alguna aplicación ya generada, ingresa a la vista de **Configurar**  para visualizar y gestionar tu aplicación.

## Configurar

Existen cuatro grupos de información en este formulario:

- Configuración de la aplicación

- Información Básica de la aplicación

- [Autenticación y Seguridad](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion)

- [Configuraciones de Notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones)

### Configuración de la aplicación

**client id** : es el APP ID de la aplicación que se creó.

**client secret** : clave de tu aplicación en Mercado Libre. **Este código es secreto, no lo compartas con nadie** .

**programar renovación** : acción para programar la actualización del Client Secret.

**renovar ahora** : acción para la renovación del Client Secret.

**Editar aplicación**

Siempre que quieras modificar el Client Secret puedes hacerlo de forma manual siguiendo estos pasos:

1. Accede a "Configuración de la aplicación".

2. Cambia el modo para "Ocultar" o "Mostrar" el Client Secret.

Haz clic en los tres puntos y selecciona una de las acciones que se muestran para programar la forma de renovar el Client secret: **"Renovar ahora"**  o **"Programar renovación"** .

**Renovar ahora**

Esta es la confirmación para realizar la renovación de Client Secret. Al seleccionar esta opción, se generará automáticamente una nueva clave en ese mismo momento, la clave anterior caducará y se llevará a cabo la renovación.

Recomendamos actualizar la nueva clave en tus desarrollos a la brevedad, debido a que en ese lapso de tiempo los nuevos usuarios que quieran dar permiso a la aplicación tendrán error.

**Programar renovación**

Esta es la opción que recomendamos usar, ya que maximiza la seguridad de tu integración, tendrás la posibilidad de preparar tu desarrollo y sus diferentes ambientes (desarrollo/test), para el cambio de clave en la fecha de actualización programada.

Para esto:

1. Selecciona la fecha en la que desees que la clave actual expire, el selector se desplegará hasta 7 días.

2. También podrás seleccionar la hora, el selector se desplegará mostrándote opciones cada 30 minutos.

3. Por último, haz clic en **Renovar**, para confirmar la actualización programada del Client Secret en la fecha y hora que indicaste.****

Al programar la renovación tendrás 2 Client Secret “vigentes” **Client secret nuevo**  y **Client secret actual**  antes de que culmine el plazo.

Por otro lado, una vez realizada la confirmación para la actualización programada, tendrás disponibles las opciones de Cancelar renovación (acción para la cancelación de la renovación del Client Secret ) o Expirar ahora (acción para la renovación del Client Secret ).

**Cancelar renovación**

Una vez programada la renovación del Client Secret , es posible cancelarla. Si se cancela la renovación, el Client Secret generado expirará y continuará siendo válido el Client Secret vigente.

**Expirar Ahora**

Esta acción te permitirá adelantar la renovación programada, el Client Secret nuevo es el que queda funcional y el Client Secret vigente expirará en ese mismo momento.

### Consideraciones sobre scopes

Existen varios tipos de aplicaciones. No obstante, las dividiremos en tres grupos para explicar los scopes requeridos.

#### Aplicaciones de solo lectura

Aplicación que permite a un usuario anónimo o autenticado acceder a información personalizada de MELI. En este caso, un usuario anónimo podría buscar artículos, leer descripciones, etc. y un usuario autenticado puede ver la información personal. Si no realizas ninguna modificación a los datos de MELI (ninguna actualización de la información de usuario, publicación de artículos ni compra de artículos), todo lo que necesitas es un scope de lectura. Recuerda que cualquier intento por modificar datos a través de las API de Meli arrojaría error.

#### Aplicaciones online de lectura/escritura

Este tipo de aplicación permite que un usuario anónimo realice ciertas operaciones de solo lectura en MELI, así como también permite a un usuario autenticado modificar datos, publicar nuevos artículos (vender), publicar pedidos (comprar), etc. En este caso, la aplicación requiere un scope de escritura para que el usuario pueda otorgar permisos de escritura y la aplicación actúe en su nombre. La aplicación podrá modificar datos en nombre del usuario mientras el access token tenga validez. Una vez expirado, el usuario debe renovar el access token para volver a tener acceso.

#### Aplicaciones offline de lectura/escritura

Si tu aplicación debe actuar en nombre del usuario aún cuando este último está offline, requerirá permiso de acceso offline por parte del usuario. Al solicitar este scope, una vez aceptada por el usuario, la aplicación tendrá tanto el access token para actuar en nombre del usuario como un refresh token para obtener un nuevo access token válido cuando expire el anterior.

## Administrar permisos

Podrás acceder al listado de usuarios que le [dieron permisos a tu aplicación.](https://developers.mercadolibre.com.ar/es_ar/gestiona-tus-aplicaciones#Usuarios-que-le-dieron-permisos-a-tu-aplicaci%C3%B3n)

**Nuevo** : autorización creada en las últimas 24 horas.

**Inactivo (bullet gray)** : autorización sin usar por más de 3 meses.

**Inactivo (bullet blue)** : autorización sin usar menos de 3 meses.

**Activo** : autorización con uso constante.

## Eliminar

Ingresando a **Mis aplicaciones**  tienes la opción de **Eliminar** , esta acción te permite borrar la aplicación. Una vez realizada esta acción, no hay forma de recuperar la aplicación eliminada.

**Conoce más:**  sobre nuestro [programa de certificación](https://developers.mercadolibre.com.ar/es_ar/developer-partner-program).

**Siguiente:**  [Autenticación y Autorización](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion).
