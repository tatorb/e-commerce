<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/bloqueo-de-aplicaciones -->
<!-- Sección: Recursos de la API > Usuarios -->

# Bloqueo de aplicaciones

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 15/04/2026

## Bloqueo de aplicaciones

## ¿Por qué se ha bloqueado mi aplicación?

Si llegaste a esta página es posible que una(s) de tú(s) aplicación(es) esté bloqueada porque se cometió alguna infracción.

## Motivo de Bloqueo

| Motivo | Descripción |
| --- | --- |
| NOT_COMPLY_KYC | Problema de validación de los datos. |
| NOT_COMPLY_T&C_RULES | Infracciones en los Términos y Condiciones. |
| EXCESSIVE_API_CALL | Volumen excesivo de llamadas de APIs o uso incorrecto de Access Token. |
| INTEGRATORS_DATA_INFRACTION | Problemas con el tráfico de datos. |

## ¿Cómo afecta el bloqueo de mi aplicación a mi negocio?

El bloqueo de su aplicación significa que no podrás operar con ninguna API de Mercado Libre o Mercado Pago. Todos los servicios que utilicen nuestras APIs se pondrán en pausa hasta que se resuelva el problema.

## ¿Afectará el bloqueo de mi aplicación a mis vendedores?

Sí, lo hará, ya que su aplicación está bloqueada para consumir Apis de Mercado Libre, por eso su vendedor no podrá operar a través de esta aplicación/integración y tendrá que realizar sus acciones a través del front end durante el periodo de bloqueo.
 El error devuelto a los usuarios será: Código de error: "unauthorized_scopes" Estado de error "401".

## ¿Cómo puedo desbloquear mi aplicación?

En Mis aplicaciones vas a poder ver el motivo del bloqueo y abajo podrás ver detalles de cómo accionar.

## Acciones a seguir

| Motivo | Descripción |
| --- | --- |
| NOT_COMPLY_KYC | Los bloqueos causados por validación de datos se producen debido a conflictos con uno o más datos en su cuenta. Por lo tanto, ingrese a Mi cuenta > Configuración > Mis datos y compruebe que la información es correcta.  Puede realizar correcciones como:   - Utilizar otro correo electrónico en mi cuenta.   - Cambiar el país de mi cuenta.  - Corregir mi nombre o apellido.  - Corregir mi número de seguridad social.  - Cambiar la titularidad de mi cuenta.   - Cambiar o incluir foto  Después de verificar o corregir su información, debe [validar su identidad.](https://developers.mercadolibre.com.ar/es_ar/validacion-de-datos#A-que-link-tengo-que-acceder) El proceso de validación de la identidad puede tardar hasta 72 horas. |
| NOT_COMPLY_T&C_RULES | Para obtener más información sobre nuestros Términos y Condiciones,[consulte aquí](https://developers.mercadolibre.com.ar/es_ar/terminos-y-condiciones). |
| EXCESSIVE_API_CALL | Tenga siempre presente que debe controlar los errores de la familia 400, no previstos en nuestra documentación, porque un número excesivo de ellos puede hacer que su aplicación se bloquee. |
| INTEGRATORS_DATA_INFRACTION | Se bloqueará por infracción de datos cuando se utilicen únicamente datos de lectura, sin consumo de APIs que generen valor. Podrá validarlo a través de la API de aplicaciones para más detalles [Gestiona tus aplicaciones](https://developers.mercadolibre.com.ar/es_ar/gestiona-tus-aplicaciones). |
