<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/gestionar-ips-de-una-aplicacion -->
<!-- Sección: Primeros pasos -->

# Gestionar IPs de una aplicación

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Gestionar IPs de una aplicación

Importante:

Esta funcionalidad es exclusiva a integradores withelisteados por Mercado Libre.

Esta documentación tiene la finalidad de mostrar la funcionalidad disponible desde el [devcenter](https://developers.mercadolibre.com.ar/devcenter/) para gestión y configuración de rangos de IP que serán permitidos para el consumo de nuestras APIs. Describiendo los posibles flujos que un usuario puede ejecutar desde esta nueva pantalla.

## Configuración IP

Para ingresar a las aplicaciones el usuario administrador debe estar logueado al [devcenter](https://developers.mercadolibre.com.ar/devcenter/). Por cada aplicación integrada encontrarás un menú desplegable, en donde se visualizará la opción de **Configuración IP** .

Nota:

- Si **Configuración Ip**  no se lista es porque la aplicación no está habilitada para realizar gestión de IPs.

## Listado de rangos

En la parte inferior de la pantalla, se muestra un listado de las IPs configuradas en la aplicación. En la barra de búsqueda se puede digitar el rango que desea encontrar de una manera más rápida:

## Agregar nuevas IPs

En la parte derecha de la pantalla se muestra la cantidad de IPs que se agregaron para la aplicación y la cantidad de IPs disponibles. Si aún tiene rangos disponibles se habilitará la sección para agregar una nueva IP.

Existe la posibilidad de agregar nuevas IPs de dos maneras:

1. Agregando la IP de forma individual.

2. De forma masiva, cargando un archivo con extensión .csv con el listado de IPs a agregar.

3. 

4. 

5. 

6. 

7. Consideraciones

8. Se permiten sólo IPs v4 o v6 en formato CIDR (Classles inter-domain routing), se muestra un error cuando el formato no es el correcto:     Se realiza validación de cantidad de rangos de IPs disponibles tanto en el proceso individual como en el masivo.    Agregando la IP de forma individual Es necesario digitar la nueva IP que desea agregar, si no tiene ningún error de formato podrá dar clic en el botón **Agregar** .  Se mostrará un mensaje de error o de éxito según el resultado del proceso:         Carga masiva de IPs Para agregar varios rangos de IPs al mismo tiempo, es necesario dar clic sobre el botón **Adjuntar .csv** . Se abrirá un modal en donde el usuario cargará el archivo:     Consideraciones  El archivo debe tener extensión **.csv** . Se mostrará un error si no cumple esta condición:     El archivo no debe contener encabezados. Cada rango de IP debe estar separado por una coma (,). Cada IP debe contar con el formato correspondiente o no se tendrá en cuenta en la carga masiva.   Ejemplo de archivo a cargar: **Nombre** : test.csv **Contenido** :     Una vez adjuntado el archivo, se procede a dar clic sobre el botón **Cargar archivo CSV** .     El sistema mostrará un mensaje de éxito o de error según el resultado del proceso. **Mensaje éxito** : se muestra cuando todos los rangos de IP del archivo fueron cargados exitosamente.       **Mensaje de error** : se muestra cuando la adición de todos o algún rango falló. Ya sea por formato del registro o por error de superposición de rangos.    En el modal se mostrará la cantidad de rangos que se agregaron exitosamente y la cantidad de rangos que fallaron.       Se tiene la opción de dar clic sobre el botón **Revisar archivo**  en donde se descargará un archivo con extensión .csv con la información de los registros que no se pudieron agregar y una descripción del error. Esto con el fin de que el usuario pueda visualizar los errores, corregirlos y volver a intentar realizar la carga masiva con los rangos faltantes.     Eliminar rangos de IPs Para eliminar un rango, basta con dar clic sobre la opción de **Seleccionar todos**  si se desea eliminar todos los rangos parametrizados o seleccionar solo aquellos que se desean eliminar.  Luego, se procede a hacer clic sobre el botón **Eliminar** .     Se mostrará un modal a modo de advertencia para que el usuario confirme la ejecución del proceso.    Finalmente, se mostrará un mensaje de error o de éxito según el resultado de la eliminación de los rangos correspondientes.
