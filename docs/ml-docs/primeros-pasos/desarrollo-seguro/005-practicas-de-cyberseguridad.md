<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/practicas-de-cyberseguridad -->
<!-- Sección: Primeros pasos > Desarrollo Seguro -->

# Prácticas de CyberSecurity

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 29/12/2025

## Prácticas de CyberSecurity

En esta documentación encontrarás información extra sobre diversas prácticas que complementarán tu desarrollo seguro. Te invitamos a las consideres para llevar mejorar considerablemente la seguridad de tu integración.

## Auditoría y registro de logs

Es fundamental contar con evidencia concreta que nos permita entender qué está sucediendo en nuestra aplicación (para alertarnos) y qué sucedió en determinado momento con determinado usuario, endpoint o recurso.

Para implementar esto, tenemos distintas alternativas posibles:

- **Logging** :el término log es utilizado para referirse al registro de eventos que están ocurriendo u ocurrieron en una aplicación o sistema. Generalmente los eventos son de 5 grandes tipos: informacional, debugging, warning, error y alert.

- **Auditoría** : es un conjunto de registros que evidencian el conjunto de actividades que afectaron a un recurso o evento a lo largo del tiempo.

- **Monitoreo** : es una herramienta de diagnóstico que utilizamos para conocer el estado de la aplicación.

- 

- Advertencias

- Logging de datos sensibles.

- Se debe evitar al máximo el logging de información sensible, datos personales, secretos o información confidencial.

- 

- Protección contra ataques automatizados

- Existen algunos casos en los que queremos que un usuario pueda utilizar alguna funcionalidad de nuestra aplicación pero de forma limitada para evitar el abuso de la funcionalidad. Un claro ejemplo de esto puede ser el login: uno quiere que el usuario pueda ingresar email y password para validar las credenciales pero también queremos evitar que usuarios malintencionados abusen de la funcionalidad enviando miles de passwords y mails para validar usuarios.

- 

- Es importante mencionar que en esta instancia no tratamos de defendernos contra ataques del tipo de negación de servicio.

- 

- Rate Limiting

- Rate limiting es la práctica de limitar el tráfico a la aplicación o a sus componentes en base a una tasa determinada. La idea de esta práctica es establecer un número finito de veces que el usuario podrá utilizar para acceder a la funcionalidad deseada. Por ejemplo, “un usuario va a poder realizar 5 envíos de dinero por hora”.

- [Referencia de estrategias y técnicas de Rate Limit](https://cloud.google.com/architecture/rate-limiting-strategies-techniques).

- 

- Captcha

- El objetivo del CAPTCHA es evitar automatizaciones, dándole una opción al usuario de “recuperarse” ante la detección del comportamiento anómalo presentándole un challenge que solo un humano podría resolver de manera correcta.

- 

- 

- 

- En general, se delega en el motor de reCAPTCHA la detección de comportamiento anómalo o thresholds en base a los cuales mostrar el CAPTCHA. Existe la alternativa de reCAPTCHA v3 en la cual el servicio nos devuelve un scoring y podemos decidir cuándo mostrarle al usuario el challenge y cuándo no.

- [Referencia de implementación reCAPTCHA](https://developers.google.com/recaptcha).

- 

- Secretos

- En algunas ocasiones es necesario utilizar algún secreto en nuestras aplicaciones, por ejemplo, credenciales de acceso a una base de datos, una key para consumir algún servicio o algún valor aleatorio para firmar mensajes.

- 

- En estos casos, se puede dar una mala práctica que consiste en dejar los secretos hardcodeados en el código. Al hacer esto, el secreto queda disponible para todas las personas con acceso al mismo.

- 

- ¿Cómo implementarlo?

- Las mejores prácticas para el almacenamiento de secretos o keys, indican que se debe hacer uso de las variables de entorno para almacenar allí dichos secretos o bien utilizar un alojamiento externo al código fuente de la aplicación, donde se almacenen todas las credenciales para el funcionamiento de la misma.

- 

- El mismo alojamiento pueden ser archivos de configuración, bases de datos o servicios especializados para el almacenamiento de secretos como los disponibles en los servicios de los diferentes proveedores de nube, y deben estar fuertemente protegidos contra el acceso de personas externas, incluidos otros usuarios locales en el mismo sistema.

- 

- Advertencias

- En muchas ocasiones, al utilizar sistemas de versionado, por error dejamos el secreto en el código y al percatarnos hacemos un nuevo commit. Al hacer esto, el secreto sigue estando en el repositorio.

- 

- Recomendamos que **si un secreto fue puesto en código sea suprimido del código según las recomendaciones anteriores y cambiado por uno nuevo** . En caso que esto no sea posible, te recomendamos remover el commit afectado [guía para Github](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

- 

- Dependencias de software de terceros

- En muchas ocasiones las dependencias de terceros que incluimos en nuestro software poseen vulnerabilidades o son directamente maliciosas.

- 

- Por estas razones, es muy importante que prestemos atención a la seguridad de los componentes de terceros que incluimos, por lo cual al momento de elegir una dependencia, se debe elegir la versión más reciente y sin vulnerabilidades reportadas.

- 

- Criptografía Aplicada

- Antes de aplicar alguna técnica criptográfica es necesario hacer un análisis del tipo de dato que se quiere proteger y su estado (reposo, en tránsito o en uso) con el fin de asegurarse que la técnica a usar va solucionar la necesidad que se requiere. En general si al analizar el tipo de dato que requiere ser protegido, se identifica que:

- Debe ser reversible (volver a su estado original) lo que se debe aplicar es una técnica de cifrado. No debe ser reversible, la técnica apropiada es el hashing. Requiere garantizar el no repudio, la técnica apropiada es la firma digital.      Propiedad Mecanismo Entidades Implementación     Confidencialidad + Autenticidad Cifrado Misma aplicación o proyecto. AES-GCM-256.   Integridad + Autenticidad MAC Misma aplicación / Múltiples. HMAC-SHA256   Integridad + Autenticidad + No repudio Firma digital  Múltiples aplicaciones / Entidades externas  Ed25519      **Siguiente:**  [Validaciones y requerimientos de seguridad](https://developers.mercadolibre.com.ar/es_ar/validaciones-de-seguridad?nocache=true).
