<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/conoce-las-novedades-que-reciben-los-vendedores -->
<!-- Sección: Recursos de la API -->

# Comunicaciones

Última actualización 07/05/2025

## Comunicaciones

Con el recurso **/communications/notices**  accedes a todas las comunicaciones **vigentes y específicas**  enviadas por Mercado Libre para cada vendedor e integrador, incluyendo:

- **Novedades** : mejoras, nuevas funcionalidades y actualizaciones de políticas.

- **Alertas** : notificaciones urgentes sobre necesidades de regularización, y posibles bloqueos a flujos (como anunciar, vender) cambios operativos e interrupciones del servicio.

- **Lanzamientos** : comunicaciones sobre nuevas herramientas y funcionalidades.

- **Capacitaciones y Eventos** : anuncios de oportunidades educativas, entrenamientos y webinars.

- **Publicidades** : promociones y campañas comerciales de interés.

Importante:

Todos los tipos de comunicaciones pueden generar una acción y dirigir al usuario para que inicie sesión en su cuenta de Mercado Libre. Es fundamental destacar estas novedades en un espacio visible para que tanto los vendedores como los integradores puedan acceder fácilmente a la información.

## Consultar comunicaciones

Las comunicaciones son específicas para cada usuario. Por lo tanto:

- Para recibir comunicaciones dirigidas a vendedores, utiliza el access token de cada vendedor.

- Para acceder a comunicaciones, actualizaciones o alertas relacionadas con tu integración, debes realizar la consulta con el access token del usuario owner de la aplicación. Es decir, debes autoconceder permiso (grant) a tu propia aplicación y obtener un access token válido.

Nota:

Las novedades están ordenadas por fecha de creación, en orden descendente y solo verás aquellas vigentes al momento de consultar.

### Parámetros

**limit** : límite máximo de comunicaciones que se desea recibir.

**offset** : si el total es mayor al límite, el offset se utiliza para el paginado.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/communications/notices?limit=$LIMIT&offset=$OFFSET
```

Respuesta de comunicaciones para vendedores:

```
{
   "paging": {
       "total": 2,
       "offset": 0,
       "limit": 10
   },
   "results": [
       {
           "actions": [
               {
                   "text": "Mas información",
                   "link": "https://developers.mercadolibre.com.ar/es_ar/conoce-las-novedades-que-reciben-los-vendedores"
               },
               {
                   "text": "Dar feedback",
                   "link": "https://www.mercadolibre.com.ar"
               }
           ],
           "id": "3691",
           "label": "Bienvenidos integradores a la central de novedades! prueba 2",
           "description": "Estamos disponibilizando la información de la CDN a todos los integradores desde el mes de junio. Preparate para estar mas informado que nunca de las ultimas novedades de MeLi.\n",
           "highlighted": true,
           "from_date": "2021-07-12T15:00:00.000Z",
           "tags": [
               {
                   "tag": "BLACK_FRIDAY",
                   "type": "EVENTS"
               },
               {
                   "tag": "BILLING",
                   "type": "BILLING"
               },
               {
                   "tag": "SHIPPING_GENERIC",
                   "type": "SHIPPING"
               }
           ]
       },
       {
           "actions": [
               {
                   "text": "Mas información",
                   "link": "https://developers.mercadolibre.com.ar/es_ar/conoce-las-novedades-que-reciben-los-vendedores"
               },
               {
                   "text": "Dar feedback",
                   "link": "https://www.mercadolibre.com.ar"
               }
           ],
           "id": "3446",
           "label": "Bienvenidos integradores a la central de novedades!",
           "description": "Estamos disponibilizando la información de la CDN a todos los integradores desde el mes de junio. Preparate para estar mas informado que nunca de las ultimas novedades de MeLi.\n",
           "highlighted": true,
           "from_date": "2021-07-12T15:00:00.000Z",
           "tags": [
               {
                   "tag": "COVID",
                   "type": "EVENTS"
               },
               {
                   "tag": "SHIPPING_GENERIC",
                   "type": "SHIPPING"
               }
           ]
       }
   ]
}
```

Respuesta de comunicaciones para integradores:

```
{
  "paging": {
      "total": 1,
      "offset": 0,
      "limit": 10
  },
  "results": [
      {
          "actions": [
               {
                   "text": "Ver documentación",
                   "link": "https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token"
               }
           ],
           "id": "18168",
           "label": " Solicitud revisión. ",
           "description": "Hemos identificado que su integración actualmente envía el access token a través de query parameters, una práctica considerada vulnerable según las recomendaciones de WebSec.
Por esta razón, en breve comenzaremos a rechazar las solicitudes que no envíen el token mediante el header, respondiendo con un error 301. 
Para evitar inconvenientes en su integración, les solicitamos actualizar el método de envío lo antes posible.",
           "highlighted": false,
           "from_date": "2025-02-12T03:00:00.000Z",
           "tags": [],
           "dismiss_key": "public-dismiss_1410022527_18168",
           "title": " Solicitud revisión."   

  ]
}
```

## Campos de la respuesta

**paging:**  formato de paginado de resultados.

- **total:**  total de resultados encontrados.

- **offset:**  índice del resultado a partir del que se quiere obtener. Ej: Con 100 novedades en total, utilizando un **limit**  de 20. Si se desea ver una segunda página tengo que mandar offset = 21 y me mostrará del 21 al 40.

- **limit:**  cantidad máxima de resultados para ver en una sola página.

**results:**  lista de novedades

- **actions**  (opcional): Lista con las acciones.  **text:**  texto de la acción. **link:**  link de la acción.

- **id:**  identificación de la comunicación.

- **label:**  título de la comunicación.

- **description:**  descripción de la comunicación.

- **highlighted:**  Indica si la novedad está destacada en Mercado Libre.

- **from_date:**  fecha en formato ISO, indica la creación de la novedad.

- **tags:**  con las siguientes tag identificas los tipos de comunicaciones.

- **category y sub_category:**  permiten organizar y agrupar las novedades, facilitando su identificación, análisis y la toma de decisiones oportunas. .

- **ALERT**  (Alerta)  Bloqueante Requerimiento Restricción advertencia   **NEW**  (Novedad)  Contingencia en la operatoria. Pre aviso de moderación. Cambio de reglas de negocio. Otro tipo.   **RELEASE**  (Lanzamiento)  Nuevo producto o funcionalidad. Mejora de un producto existente. Otro tipo.   **PUBLICITY**  (Publicidad) **MODAL**  (Modal) **OPPORTUNITY**  (Capacitación o evento.)

Además puedes agruparlas según [países, publicaciones, envíos, atención, facturación y eventos.](https://developers.mercadolibre.com.ar/AGREGAR_LINK)

Los

**type**

y sus correspondientes

**Tag**

.

**Atención**

- METRICS: Métricas

- CANCELLATIONS:Cancelaciones

- RETURNS: Devoluciones

**Envíos**

- SHIPPING_GENERIC:Envíos

- SHIPPING: Mercado Envíos

- SHIPPING_XD: Mercado Envíos colecta

- FLEX: Flex

- FULL: Full

- SHIPPING_CARRIER: Mercado Envíos Partnered Carrier

**Eventos**

- CHRISTMAS: Navidad

- BLACK_FRIDAY: Black Friday

- HOT_SALE: Hot Sale

- CYBER_MONDAY: Cyber Monday

- COVID: COVID-19

**Facturación**

- COSTS: Costos

- BILLING: Facturación

- TRANSMITTER: Emisor de NF-e

**Países**

- MCO: Colombia

- MLC_FULFILLMENT: Chile - Full

- MLC_REMOTE: Chile

- MLB: Brasil

- MLM_REMOTE: México

- MLM_FULFILLMENT: México - Full

**Publicaciones**

- PUBLICATIONS: Publicaciones

- PROMOTIONS_CENTRAL: Central de promociones

- CATALOG: Catálogo
