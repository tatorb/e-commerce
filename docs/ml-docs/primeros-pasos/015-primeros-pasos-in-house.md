<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/primeros-pasos-in-house -->
<!-- Sección: Primeros pasos -->

# Desarrollo in-house Quick Start

Última actualización 06/10/2026

# Quick Start: Integración In-house con las APIs de Mercado Libre

Guía rápida para tiendas oficiales que van a desarrollar su propia integración de punta a punta con las APIs de Mercado Libre — sin integrador externo — cubriendo autenticación, autorización, notificaciones y uso de los recursos de la plataforma. Aplicable a todos los sitios de LATAM y CBT.

## 1. Consulte la documentación

- •Use como referencia la [documentación de Argentina](https://developers.mercadolibre.com.ar/es_ar) o la [documentación de Brasil](https://developers.mercadolivre.com.br/pt_br), según el país de la integración. Si la página está en otro idioma, use la función de traducción de página del navegador.

- •Revise las diferencias regionales y los requisitos específicos de cada recurso antes de implementarlo. Confirme el dominio de autenticación, el site_id, las monedas, los flujos fiscales y las condiciones de envío aplicables al país.

## 2. Cree la aplicación en el DevCenter

- •Siga la guía oficial para [crear una aplicación](https://developers.mercadolibre.com.ar/es_ar/crea-una-aplicacion-en-mercado-libre-es).

- •Defina desde el inicio quién será titular y administrador de la aplicación. Mantenga la titularidad y los accesos bajo control de la empresa y documente quién puede administrar credenciales y configuraciones.

- •En algunos países, la creación depende de que los datos del titular de la cuenta estén completos y validados.

- •**Importante desde el 30/08/2026:**  las aplicaciones de Mercado Libre y Mercado Pago deben estar separadas, con una aplicación por unidad de negocio. Verifique mediante `GET /applications/$APP_ID` que la aplicación de Mercado Libre no tenga scopes de Mercado Pago (por ejemplo, `urn:mp:...`); de lo contrario, puede perder acceso a las APIs de Mercado Libre.

**Recomendación crítica:**  cree la aplicación directamente en la cuenta oficial del Vendedor (cuenta de la empresa), nunca en la cuenta personal de un desarrollador. Las aplicaciones no se pueden transferir entre cuentas — si el empleado se va, la empresa pierde el control de la app.

## 3. Complete la información básica de la aplicación

- •**Nombre** : debe ser único.

- •**Nombre corto** : se utiliza para generar la URL de la aplicación.

- •**Descripción** : se muestra durante la autorización y admite hasta 150 caracteres.

- •**Logotipo** : seleccione o arrastre un archivo PNG al área de carga. El tamaño máximo permitido es de 1 MB.

- •Complete los demás campos obligatorios que indique el DevCenter y mantenga nombre, descripción y propósito de la aplicación claros para quien autoriza.

**Descripción (Propuesta de Valor):**  este texto se muestra al usuario cuando autoriza su aplicación y es fundamental para que comprenda su propósito.

**Recomendación:**  resuma claramente el valor que ofrece su solución (por ejemplo, “Integra tu ERP con Mercado Libre para actualizar el inventario automáticamente”).

## 4. Configure el Redirect URI e implemente la autorización OAuth

- •Registre la URL de redirección en el DevCenter. La documentación de creación de aplicaciones indica que debe usar HTTPS.

- •En el flujo OAuth, el `redirect_uri` enviado debe coincidir exactamente con uno registrado y no debe contener valores variables.

- •Use `state` como valor impredecible, vinculado a la sesión, para asociar datos dinámicos y validar que la respuesta corresponde a una solicitud iniciada por su aplicación; rechace estados ausentes o que no coincidan.

- •Para Argentina, dirija al usuario a la URL de autorización. Para otros países, use el dominio correspondiente: `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=$APP_ID&redirect_uri=$REDIRECT_URI&state=$STATE`

- •El usuario inicia sesión y autoriza la aplicación. Mercado Libre lo redirige al URI configurado con el parámetro `code`; intercambie ese código por tokens desde el backend.

- •El `redirect_uri` debe ser estático y coincidir exactamente con la URL registrada. Use `state` para comprobar que la respuesta corresponde a la solicitud iniciada.

- •PKCE es opcional al configurar la aplicación, pero si está habilitado, la solicitud debe incluir los parámetros de PKCE requeridos.

## 5. Defina los permisos con el mínimo necesario

- •Los [permisos funcionales](https://developers.mercadolibre.com.ar/es_ar/permisos-funcionales) determinan qué áreas de la plataforma puede usar la integración.

- •Los scopes básicos incluyen solo lectura (`read`) y lectura y escritura (`write`). El acceso sin conexión requiere solicitar también `offline_access`.

- •Solicite únicamente los permisos que su solución necesita. Consulte y configure los permisos en el DevCenter.

- •Verifique que la aplicación corresponda a la unidad de negocio correcta: Mercado Libre y Mercado Pago requieren aplicaciones separadas.

## 6. Intercambie el CODE por Access Token y Refresh Token

- •Envíe un `POST` a `https://api.mercadolibre.com/oauth/token` con `grant_type=authorization_code`, `client_id`, `client_secret`, `code` y el mismo `redirect_uri`.

- •El Access Token tiene una vigencia de 6 horas.

- •El Refresh Token es de un solo uso. Cada renovación devuelve un Refresh Token nuevo; guarde el nuevo y deje de usar el anterior.

- •Renueve el Access Token cuando haya expirado. Proteja el Client Secret y los tokens y no los exponga en el navegador, el código cliente ni registros públicos.

- •Consulte la guía oficial de [autorización y tokens](https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token) para conocer el flujo y las recomendaciones de OAuth.

## 7. Permisos funcionales

Cada permiso funcional agrupa un conjunto de endpoints de la API según un flujo de negocio específico. El nivel de acceso puede configurarse como **Lectura (Read)** , **Escritura (Write)**  o **Acceso offline (Offline Access)** .

Asigne únicamente los scopes que su aplicación realmente necesita. Todos los scopes seleccionados se mostrarán al usuario durante la autorización.

- •**Usuarios:**  consultar y actualizar los datos de la cuenta registrada en Mercado Libre. Este permiso ya está habilitado por defecto para todos.

- •**Comunicaciones pre y posventa:**  leer y enviar mensajes antes y después de la compra.

- •**Publicación y sincronización:**  crear, actualizar, pausar y eliminar publicaciones de la tienda.

- •**Publicidad de productos:**  acceder, crear y administrar campañas publicitarias.

- •**Ingresos por ventas:**  administrar datos de facturación, facturas, ingresos, transacciones y saldos.

- •**Métricas de negocio:**  monitorear ventas, inventario, reputación, información fiscal e informes operativos.

- •**Promociones, cupones y descuentos:**  acceder a los recursos para consultar, crear y administrar ofertas y cupones.

- •**Venta y envío de productos:**  administrar ventas, envíos, devoluciones, reembolsos y reclamaciones.

**Tópicos:**  suscríbase a los tópicos de notificación para recibir actualizaciones de eventos en tiempo real.

## 8. Configure las notificaciones (webhooks)

- •Configure una URL pública de callback y seleccione los tópicos que la aplicación debe procesar.

- •El callback debe confirmar la recepción con HTTP 200 en un máximo de 500 ms. Valide lo mínimo indispensable, registre el evento y encoléelo; procese la lógica de negocio y consulte el recurso actualizado de forma asíncrona.

- •Use `missed_feeds` para recuperar notificaciones que no se entregaron; la documentación indica que conserva hasta 2 días de historial. Para el tópico `items`, incluya también `site_id`.

- •Las notificaciones avisan de cambios; consulte el recurso correspondiente para obtener el estado actualizado. Diseñe el procesamiento para tolerar reintentos, eventos repetidos y llegadas fuera de orden; registre identificadores y resultado de cada evento.

- •Consulte la [documentación de notificaciones](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones) para revisar los tópicos y el formato de cada evento.

**Atención:**  el alcance es global — usted recibe notificaciones de todos los vendedores que autorizaron su app, sin filtro por usuario en el origen. Dimensione la infraestructura para el volumen de tráfico.

Desde el 15/06/2026, desactivamos las notificaciones de aplicaciones con más del 80% de errores o alta intermitencia. Para reactivarlas, ingrese a su aplicación y edítela incluyendo la nueva URL de notificaciones; luego, asegure la recepción exitosa. Use la API `missed_feeds` para recuperar eventos.

## 9. Cree usuarios de prueba antes de pasar a producción

- •Siga la guía oficial de [pruebas con usuarios de test](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas). Mercado Libre no ofrece un ambiente sandbox para este flujo.

- •Se pueden crear hasta 10 usuarios de prueba por cuenta de Mercado Libre. La respuesta de creación incluye las credenciales; guárdelas de forma segura porque no hay un recurso para consultarlas después y no las reutilice como credenciales de producción.

- •Cree al menos un usuario de prueba comprador y otro vendedor por cada sitio que necesite validar.

- •Realice las pruebas y transacciones únicamente entre usuarios de prueba y con publicaciones de prueba. La documentación recomienda titular los artículos: “Item de Prueba - Por favor, NO OFERTAR”. Pruebe autorización, compra, notificaciones y operaciones posteriores a la venta antes de habilitar tráfico real.

**Regla crítica:**  transaccione solo entre usuarios de prueba. Un usuario real que interactúa con un usuario de prueba puede activar los sistemas antifraude y bloquear su cuenta real.

## 10. Explore los recursos de API por etapa del recorrido de venta

- •**Antes de vender** : publicaciones, categorías y atributos, imágenes, variaciones y kits.

- •**Configuración** : catálogo, envíos y datos fiscales, según el país y el tipo de solución.

- •**Después de vender** : pedidos, mensajes, envíos, reclamaciones, devoluciones, facturación, promociones y métricas.

Considere usar el [**Mercado Libre MCP Server**](https://developers.mercadolibre.com.ar/es_ar/mcp-server) en su entorno de desarrollo (compatible con Cursor, Windsurf, Cline, Claude Desktop, entre otros) para buscar documentación, generar código de integración y acelerar el desarrollo.

## 11. Consulte las comunicaciones de Mercado Libre

- •El recurso `/communications/notices` ofrece novedades, alertas, lanzamientos y comunicaciones vigentes.

- •Para consultar comunicaciones dirigidas a un vendedor, use el Access Token de ese vendedor. Para comunicaciones de la integración, use el token del usuario propietario de la aplicación.

- •Consulte la [documentación de comunicaciones](https://developers.mercadolibre.com.ar/es_ar/conoce-las-novedades-que-reciben-los-vendedores).

La consulta de `/communications/notices` es la única forma de saber si hay novedades o cambios aplicados a su aplicación. Consúltela con regularidad.

## 12. Revise el flujo fiscal de cada país

- •Los datos de facturación, la emisión de comprobantes y la importación de documentos dependen del país, el perfil fiscal del vendedor y la logística. Trate la información fiscal como dato sensible y solicite solo los campos necesarios.

- •Para obtener los datos fiscales del comprador, extraiga `buyer.billing_info.id` de la orden y consulte `GET /orders/billing-info/{site_id}/{billing_info_id}`. El flujo anterior de `/orders/billing-info` está deprecado. Consulte [Facturación / Billing info](https://developers.mercadolibre.com.ar/es_ar/facturacion-billing-info).

- •En Brasil, revise la documentación específica del Facturador, la importación de NF-e y la DC-e. No aplique un único flujo fiscal a todos los países o tipos de vendedor.

## 13. Consulte los horarios de despacho y el tiempo de preparación

- •Para consultar la agenda de Coletas, use `GET /users/$USER_ID/shipping/schedule/$LOGISTIC_TYPE`; reemplace `$LOGISTIC_TYPE` por la logística que corresponda, por ejemplo `cross_docking`.

- •La herramienta `processing_time_tool` usa el tipo de servicio `carrier_pickup`, que cubre Cross Docking y XD Drop Off. Si la cuenta usa Multi-Origen (`warehouse_management`), la consulta debe hacerse por `NODE_ID`. Consulte la versión y los parámetros actuales en la documentación de [Envíos, Colecta y Places](https://developers.mercadolibre.com.ar/es_ar/envios-colectas-places).

## 14. Gestione reclamaciones, devoluciones y cambios

- •Suscríbase a los tópicos de notificación `claims` y `claims_actions`. Consulte la reclamación en `/post-purchase/v1/claims/$CLAIM_ID` y revise `related_entities` y `available_actions` antes de decidir la siguiente acción.

- •Cuando la reclamación tenga una devolución asociada, consulte `/post-purchase/v2/claims/$CLAIM_ID/returns`. Use las acciones disponibles para ese caso; no asuma que todas las opciones aplican a todas las reclamaciones.

- •Para cambios, consulte `/post-purchase/v1/claims/$CLAIM_ID/changes`. `allow_replace` es una acción del vendedor disponible solo cuando la API la informa entre las acciones permitidas.

- •Consulte la documentación vigente de [reclamaciones](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos), [devoluciones](https://developers.mercadolibre.com.ar/es_ar/gestionar-devoluciones) y [cambios](https://developers.mercadolibre.com.ar/es_ar/changes).

## 15. Ciberseguridad / Desarrollo Seguro

Proteja la integración durante todo el ciclo de desarrollo y operación. Priorice estos controles:

- •**Proteja la autenticación y los tokens:**  envíe los parámetros para intercambiar el token en el body, use el access token correspondiente al usuario y valide `state` y el Redirect URI en el flujo OAuth.

- •**Proteja los secretos:**  no incluya credenciales, tokens ni claves en el código o en el repositorio. Guárdelos en variables de entorno o en un servicio de gestión de secretos; si quedan expuestos, reemplácelos. No registre tokens, datos personales ni información confidencial en los logs.

- •**Valide en el backend:**  autentique las solicitudes, compruebe que el usuario tenga autorización para cada recurso y valide los datos de entrada en formato y significado antes de procesarlos. Prefiera listas de valores permitidos y consultas parametrizadas.

- •**Monitoree y limite los abusos:**  mantenga registros de auditoría que permitan identificar quién hizo qué, cuándo, desde dónde y con qué resultado. Aplique límites de solicitudes y controles contra automatizaciones indebidas, especialmente en operaciones que modifican recursos.

- •**Mantenga segura la aplicación:**  revise las dependencias de terceros y corrija vulnerabilidades. Elija técnicas criptográficas adecuadas al tipo de dato y al propósito de protección.

Consulte las guías oficiales de seguridad:

- •[Introducción](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos/introduccion-seguridad)

- •[Infraestructura (Cifrado y TLS)](https://developers.mercadolibre.com.ar/es_ar/administra-proyectos-aplicaciones/infraestructura)

- •[Gestión de Identidades y Accesos (OAuth y Tokens)](https://developers.mercadolibre.com.ar/es_ar/administra-proyectos-aplicaciones/gestion-de-identidades-y-accesos-oauth-y-tokens)

- •[Autenticación segura](https://developers.mercadolibre.com.ar/productos-recibe-notificaciones/autenticacion-segura)

- •[Control de acceso y autorización](https://developers.mercadolibre.com.ar/es_ar/como-empezar/control-de-acceso-y-autorizacion)

- •[Seguridad de aplicaciones](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos/seguridad-apps)

- •[Monitoreo](https://developers.mercadolibre.com.ar/es_ar/administra-proyectos-aplicaciones/monitoreo)

- •[Gestión de incidentes](https://developers.mercadolibre.com.ar/es_ar/es_ar/gestion-de-incidentes)

### Checklist resumido

- •Consultar la documentación de Brasil o Argentina y confirmar el país y la unidad de negocio de la integración.

- •Crear la aplicación con la cuenta del propietario de la solución y separar Mercado Libre de Mercado Pago.

- •Completar los datos de la aplicación y configurar el Redirect URI HTTPS exacto.

- •Solicitar solo los permisos funcionales y scopes necesarios.

- •Implementar OAuth con validación de `state` y PKCE cuando esté habilitado.

- •Configurar los permisos funcionales y habilitar únicamente los scopes necesarios para cada flujo de negocio.

- •Guardar de forma segura los tokens y reemplazar el Refresh Token después de cada uso.

- •Configurar webhooks para responder HTTP 200 en 500 ms y recuperar fallos recientes con `missed_feeds`.

- •Probar únicamente con usuarios y publicaciones de test.

- •Integrar recursos de venta, logística, fiscalidad y postventa según el sitio.

- •Mantener TLS 1.2 o superior y validar los certificados en las conexiones HTTPS.

- •Proteger tokens y credenciales con almacenamiento seguro y acceso restringido; no registrarlos en logs y revocarlos si hay sospecha de exposición.

- •Autenticar a los usuarios con controles robustos y validar en el backend, en cada solicitud, los permisos y el acceso del usuario al seller y al recurso.

- •Recolectar solo los datos personales necesarios, protegerlos en reposo y enmascararlos en los logs, con acceso y retención controlados.

- •Auditar y monitorear eventos de seguridad, limitar intentos automatizados, mantener las dependencias actualizadas y contar con un plan de respuesta a incidentes.
