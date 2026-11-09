<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/validacion-de-datos -->
<!-- Sección: Recursos de la API > Usuarios -->

# Preguntas frecuentes sobre validación de datos

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Preguntas frecuentes sobre validación de datos

La validación de datos tiene como objetivo probar la identidad de los usuarios registrados en Mercado Libre y se aplica a todos los perfiles de usuarios (buyers, sellers e integradores). La validación debe ser hecha por el propietario de la cuenta o el representante legal.

## ¿Por qué debo realizar el flujo de validación de datos?

Para poder operar en Mercado Libre, como vendedor o integrador, necesitamos que los datos estén cargados y validados, para que:

- Cuando se crea una cuenta (y eso es necesario tanto para perfiles vendedor como integrador).

- O cuando se tiene que revalidar datos. Se pide la revalidación de datos, cuando cuenta cambia de perfil (por ejemplo, pasa a transaccionar pagos, un cambio de titularidad u otras nuevas acciones).

## ¿Cómo saber quién es titular de la cuenta?

Antes de realizar el proceso de validación de identidad, Hay que verificar quién figura en la documentación subida en la cuenta al momento en que fue creada:

- Ingresa Mi Perfil > Mis datos personales

Tenga en cuenta que:

- Al completar los datos en la cuenta, luego deberá realizar la validación de identidad.

- El representante legal de una cuenta empresa es quien sube la documentación correspondiente que confirma que es quien dice ser y que demuestra esta relación.

## ¿Cómo saber que hay datos pendientes en la cuenta?

Podrás reconocer las pendencias accediendo a tu cuenta en Mercado Libre:

- Meu perfil > Minhas informações > Dados pessoais (el usuario podrá ver que faltan informaciones y será direccionado a regularizar).

Desde Mercado Libre también se envían [Novedades](https://developers.mercadolibre.com.ar/es_ar/conoce-las-novedades-que-reciben-los-vendedores) para que el usuario se regularice.

## ¿El flujo de validación aplica a Empresas?

Sí. En el caso de empresas con Persona Jurídica (PJ), cada cuenta tiene asociadas dos identidades:

- La de la empresa, identificada por su ID tributario.

- La de la persona autorizada para representar a la empresa en esa cuenta, con su documentación de persona física.

## ¿Por qué pedimos validación de identidad para empresas?

Regulatoriamente debemos validar la composición y estructura societaria de la persona jurídica, así como la identidad de la persona humana que opera en nombre y representación de ella.

## Tengo representante legal en el país pero los beneficiarios finales son extranjeros, ¿es necesario enviar la documentación de los beneficiarios finales?

- En México pedimos datos de los beneficiarios finales, pero de forma declarativa; no deben subir documentación respaldatoria.

- Para Argentina y Chile pedimos información sobre beneficiarios reales, es declarativa.

- En Brasil esta información se toma del documento que declara la composición de la sociedad.

## Una vez cargados los datos, ¿Hasta cuanto puede demorar la validación?

Una vez cargados los datos, el proceso de validación de los mismos tiene un tiempo de demora de hasta 72 horas.

## ¿Cómo los datos de una cuenta están completos y validados ?

Los usuários podrán acceder a sus datos, ingresando a su cuenta de Mercado Libre, en las secciones:

- Mi Perfil > Datos personales

- Mi Perfil > Datos de su cuenta

Ambos deben mostrar la marca de que están validados. Si alguna de las secciones aparece con datos pendientes, debes acceder al flujo y completarlo.

## ¿Qué sucederá a las cuentas que no tengan los datos regularizados ?

- Usuarios seller tendrán sus publicaciones inactivadas y tampoco podrán dar nuevas autorizaciones a aplicaciones.

- Usuarios Integrador no podrán recibir nuevas [autorizaciones](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion#Autorizaci%C3%B3n) autorizaciones de nuevos sellers.
