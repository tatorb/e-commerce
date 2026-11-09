<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/validaciones-de-seguridad -->
<!-- Sección: Primeros pasos > Desarrollo Seguro -->

# Validaciones y requerimientos de seguridad

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Validaciones y requerimientos de seguridad

En esta documentación encontrarás prácticas de seguridad para implementar que son esenciales para tu integración. Implementarlas te permitirán robustecer el núcleo de los procesos de seguridad de tu desarrollo.

## Requerimientos específicos

### Autenticación

La autenticación es un proceso que nos permite conocer la identidad digital de un usuario (previamente registrado) y consiste en una serie de mecanismos que establecen que este usuario es quien dice ser. Estos mecanismos suelen agruparse en 3 grandes categorías:

- Algo que sé (password).

- Algo que tengo (celular, token de autenticación, yubikey).

- Algo que soy (biometría).

- 

- La combinación de estos factores es lo que genera una **autenticación robusta** .

- 

- 

- Autorización

- Autorización es el mecanismo mediante el cual controlamos el acceso a un recurso, generalmente en base a la identidad de un usuario previamente validada. Es importante diferenciar este proceso de autenticación: el objetivo de la autenticación es determinar la identidad de un usuario, mientras que el de la autorización es determinar si esa identidad tiene los permisos suficientes para realizar la acción que está intentando hacer. Estas validaciones deben ser implementadas en el Backend.  Existen numerosas metodologías para armar matrices de autorización. Dentro de las más conocidas se encuentran RBAC, ABAC, ACL, MAC, entre otras.

- 

- 

- 

- 

- 

- Validación de datos

- La validación de datos es la práctica que permite validar que todos los valores no originados en nuestra aplicación están bien formados tanto semántica como sintácticamente, previo a procesarlos, guardarlos o transmitirlos.

- 

- Por regla general y por seguridad en las aplicaciones, la validación de datos debe ser implementada en los servicios del backend, debido a que son flujos no modificables por el usuario final, a diferencia de las validaciones en el frontend que dan respuesta únicamente a una buena experiencia del usuario.

- 

- Es una práctica común realizar validación de input en el frontend (client-side), por ejemplo, no dejando que el usuario avance en el flujo si no coloca algo con forma de email en un campo de email. Esto es válido desde el punto de vista funcional pero tenemos que tener en cuenta que a nivel seguridad, un usuario puede ignorar las validaciones client-side y así enviar datos maliciosos a las aplicaciones. Por esto, todas las validaciones de input que realizamos client-side también debemos hacerlas server-side.

- 

- Validación sintáctica

- Por validación sintáctica nos referimos a que el valor se encuentre correctamente formado con respecto al tipo o estructura de dato esperado.

- 

- Para tipos de datos primitivos como **float, double, char, boolean, short**  o **long** , una estrategia recomendada es realizar typecasting. La idea simplificada es la siguiente: HTTP es un protocolo basado en texto, por lo que, todo valor de tipo básico que nos llega en un request es fundamentalmente un String (o arreglo de chars) con determinado encoding.

- 

- En la etapa sintáctica, nuestro objetivo es convertir el String a los valores básicos correspondientes que estemos esperando. Por ejemplo:

- 

- Si esperamos un **user_id** , que sabemos que es un **Int** , podemos realizar una validación del estilo:

- 

- 

- 

- Validación semántica

- La validación semántica implica entender si el valor es correcto en términos del contexto en el que se está utilizando.

- En el contexto de tipos básicos de datos podemos pensar en ejemplos como los siguientes:

- El monto de una transacción no debe ser negativo y debe tener como máximo dos ceros de redondeo. Un número de orden no debe ser negativo y debe ser entero. Un apellido no debe tener caracteres especiales o no imprimibles. Una fecha de nacimiento de un usuario no debe ser menor a la del año 1900.   En el contexto de tipos de datos complejos podemos pensar en siguientes ejemplos:  Por más que un documento de office se encuentre bien formado, tenemos que verificar si tiene macros presentes con código potencialmente vulnerable o malicioso. Si estamos recibiendo imágenes, determinar cuál es el peso máximo y mínimo que deben tener, si debemos borrar la metadata, o si contiene únicamente información relacionada a una imagen.   ¡Advertencias! Allow list vs Block list Dentro de las metodologías de validación podemos usar dos grandes estrategias: **Block list**  y **Allow List** . En términos simples, una metodología blocklist consiste en definir y buscar todos los valores no esperados por cada input. Por ejemplo:     El problema general de esta estrategia es que es complejo conocer todos los caracteres peligrosos o no esperados, y por más que hoy tengamos toda la lista, las tecnologías y estándares cambian, dejando la blocklist posiblemente desactualizada y vulnerable.   En su lugar, es recomendado utilizar una estrategia de **Allow list**  que consiste en definir los caracteres o formatos de input esperados por la aplicación. El racional es el siguiente, es mucho más fácil conocer y definir qué datos estoy esperando a conocer los que no estoy esperando.    Siguiendo esta estrategia, debemos ser lo más restrictivos posibles, evitando en todo momento, que se reciban datos de entrada que contengan por ejemplo: “.” o “/”.    En caso de que la lista de caracteres sea muy permisiva porque la aplicación lo requiere, será necesario implementar controles adicionales, para evitar comportamientos no deseados.  Por ejemplo:  Si el parámetro se dirige de una query hacia una base de datos, es necesario parametrizar las consultas. Si el parámetro que esperamos es sumamente específico, debemos implementar expresiones regulares para validar el dato que esperamos. Si el parámetro es retornado al frontend, se deben implementar validaciones adicionales como: codificación o saneamiento.   Requerimientos generales A continuación, se provee una tabla de resumen para usar a modo de check-list.   Resumen de los recursos disponibles    Control Descripción      Autenticación   Validar que todas las funcionalidades de la aplicación se encuentren autenticadas, es decir, que la petición haya sido solicitada por un usuario legítimo.     Autorización   Validar que el usuario previamente autenticado posea permisos para acceder o modificar el recurso específico.    Validación de datos   Asegurar que todos los valores o parámetros se encuentran validados semántica y sintácticamente previos a ser utilizados. Prestar atención a los tipos de datos y utilizar un modelo allow list (valores permitidos) antes de blocklist (valores no permitidos).    Auditoría y registro de logs   Validar si es posible responder “Quién hizo qué, desde dónde, cuándo y con qué resultado” con los logs disponibles en cada funcionalidad de la aplicación. Evitar el “logging” de información de usuarios (PII) o confidencial.   Protección contra ataques automatizados  Validar que todas las funcionalidades de modificación de recursos (POST, PUT, DELETE) cuenten con mecanismos para evitar ataques automatizados como fuerza bruta o enumeración de información.     Secretos   Validar que ningún secreto se encuentra “hardcodeado” en código. Los secretos incluyen credenciales de acceso, tokens de autenticación, certificados digitales, y cualquier otro tipo de información sensible. Todos los secretos deben guardarse y consumirse a través de mecanismos adecuados para su tratamiento.     Dependencias de software de terceros   Validar que las dependencias externas no posean vulnerabilidades.     Criptografía Aplicada   Validar que los esquemas de hashing, cifrado, firma o generación de secuencias random estén siendo utilizadas de forma correcta y sean las adecuadas para resolver el caso de uso particular.
