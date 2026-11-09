<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/vehiculos-gestiona-paquetes -->
<!-- Sección: Guía para vehículos -->

# Gestiona paquetes de vehículos

Última actualización 24/11/2025

## Gestión de Paquetes de Vehículos

En vehículos, para publicar un anuncio, el vendedor necesita tener contratado un paquete de publicación con Mercado Libre. Esta contratación se realiza directamente con el equipo comercial. Los paquetes de anuncios sirven para mostrar los vehículos. Tienen una duración mensual, trimestral, semestral y anual, con renovación automática, es decir, se renuevan periódicamente para que los anuncios estén siempre visibles. Con el paquete asignado, tanto el vendedor como el integrador están listos para publicar, ya sea a través de la API o mediante nuestra plataforma. El tipo de paquete se representa mediante el campo **listing_type**  del anuncio.

Importante:

A partir del 02/01/2025, en los sitios MLM y MCO implementaremos cambios en nuestro modelo de paquetes, separando la suscripción (derecho de publicar) del destacado (aumento de visibilidad). Este cambio brindará más flexibilidad a los dealers y facilitará la gestión de los anuncios.

Nota:

Para realizar pruebas, deberás enviar el usuario de prueba al canal de soporte para que sea activado como vehículos y asignado a un paquete de publicación.

## Tipos de Paquete

**Importante:**

Con el objetivo de elevar la calidad de las publicaciones y garantizar una mejor experiencia a los compradores, a partir del **20 de enero de 2026** , será **obligatorio el envío de al menos una imagen**  para todas las publicaciones creadas con **Listing Type Silver** .

De esta forma, ya **no será posible crear el anuncio primero y agregar las imágenes posteriormente** . Las peticiones de creación de publicaciones con Listing Type Silver que no contengan el array de imágenes (“pictures”) serán rechazadas.

Recomendamos que **ajusten sus desarrollos**  para incluir el campo “pictures” en el payload de la petición POST /items antes de la fecha límite, para que no tengan las **publicaciones moderadas** .

**Paquete de publicación** : obligatorio para que el vendedor pueda realizar publicaciones. Este es el paquete Plata (silver), o sea,listing_type = silver.

**Suscripción (Solo MLM y MCO)** : obligatorio para que el vendedor pueda realizar publicaciones (con diferentes cantidades de listing_type permitidos).

**Paquete destacado** : este paquete es opcional; el vendedor lo utiliza para aumentar la exposición de sus publicaciones. Puede ser Oro (listing_type = gold) u Oro Premium (listing_type = gold_premium).

Estos dos paquetes ofrecen cupos que se consumen con cada anuncio publicado (en el caso de un paquete de publicación) y cada vez que se realiza una actualización / destaque (en el caso de un paquete destacado).
 Actualmente, cada usuario debe contratar los paquetes de publicaciones y destacados a través de un ejecutivo de cuentas de Mercado Libre. Esta acción no es posible a través de la API.
 El listing_type utilizado para publicar un anuncio siempre será el más bajo: "Plata", y, en caso de querer destacar la publicación, será necesario actualizarla con el listing_type deseado (con lo cual se consume una cuota en el paquete destacado).

Recuerda que en las llamadas GET al recurso de API [classifieds_promotion_packs](https://api.mercadolibre.com/categories/MLB1459/classifieds_promotion_packs), puedes usar el parámetro package_content (tipo de paquete) para saber qué paquete quieres consultar:

**Parámetro:**  package_content
 **Obligatorio:**  No
 **Default:**  publications
 **Tipo:**  String
 **Valores:**  tipo de paquete:

- publications - paquetes de publicación

- upgrades - paquetes destacados

- ALL - devuelve todos los paquetes disponibles

Un cliente debe tener, obligatoriamente, un paquete de publicación para anunciar, pero los paquetes destacados son opcionales. El cliente también puede tener más de un paquete activo simultáneamente. Cada paquete activo tiene sus propias cuotas, fechas de vencimiento, etc. 
 Para saber cómo enviar una publicación, visita la página [Publicación de vehículos](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos), y recuerda: el anuncio debe ser primero enviado y publicado con un paquete de publicación, para después actualizarlo como paquete destacado, según se explica más adelante en esta página.

## Nuevo Modelo de Paquetes (MLM y MCO)

A partir de 02 enero de 2025, implementaremos cambios en nuestro modelo de paquetes, separando la suscripción (derecho de publicar) del destacado (aumento de visibilidad). Este cambio brindará más flexibilidad a los dealers y facilitará la gestión de los anuncios. 
**¿Qué cambia?**

- Suscripción y Destacados se venderán por separado, ofreciendo más control y personalización a los dealers.

- Gestión simplificada: Los dealers podrán contratar y gestionar los paquetes de forma independiente, incluyendo opciones de autoservicio.

### Nuevos listing_type

El nuevo modelo de paquetes tendrá nuevos listing_type:

- Oro (Listing_type = gold) será **"Acelerador"** .

- Oro Premium (listing_type = gold_premium) será **"Acelerador Plus"** .

En Mercado Libre podrás ver los paquetes de la siguiente manera:

- **Paquetes de destacados agrupados por listing_type y tipo de engagement_type:**

- **Agrupación de packs por capacidad, mostrando ahorros por contratar Trimestral:**

- **Vista para contratar destaques:**

- **Al terminar de publicar se muestra la experiencia para que puedan utilizar destaques disponibles o contratar un nuevo acelerador:**

## FAQs Nuevo Modelo de Paquetes

**¿Puedo pausar el paquete?**

No, una vez el pack se activé no se puede pausar.

**¿Puedo cambiar los destaques entre las publicaciones?**

Si, puedes inactivar el destaque de una publicación para liberar el cupo

**¿Qué duración tiene el paquete?**

Mensuales o trimestrales

**¿Cuál es la diferencia entre el paquete de suscripción y destaque?**

El paquete de suscripción define el cupo (cantidad de publicaciones) disponibles para usar y el de destaque define una cantidad determinada de cupos para destacar las publicaciones de suscripción.

**¿Cuál es la diferencia entre Acelerador y Acelerador Plus?**

El acelerador tiene una exposición ALTA, el acelerador Plus tiene una exposición MUY ALTA aumentando la oportunidad de venta.

Importante:

El nuevo modelo de paquetes está disponible solo para los sitios MLM y MCO.

## Consultar paquetes por categoría

Para consultar los paquetes disponibles para las categorías de clasificados, primero es necesario saber qué categoría será utilizada y de qué sitio. Por ejemplo, en Brasil, la categoría de vehículos es MLB1743.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATETGORY_ID/classifieds_promotion_packs
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLB1743/classifieds_promotion_packs
```

Respuesta:

```
[
  {
    "id": "PUS30FREE",
    "category_id": "MLB1459",
    "brand": "MLREALESTATE",
    "description": "Todo o seu estoque",
    "price": 0,
    "package_type": "unlimited",
    "package_content": "publications",
    "duration": 30,
    "status": "active",
    "charge_type_id": "free",
    "max_upgrades": 0,
    "quota_type": "reusable",
    "listing_details": [
      {
        "listing_type_id": "silver",
        "available_listings": 100000
      }
    ]
  }
]
```

## Consultar paquetes de publicaciones contratados por un usuario

Esta consulta es importante, pues a través de ella es posible saber qué paquetes tiene un cliente y cuál es la cantidad de anuncios disponibles en cada uno, ingresando el id del usuario (cliente), el tipo de paquete (package content) y el token. A continuación, presentamos un ejemplo de llamada.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/{user_id}/classifieds_promotion_packs?package_content=$PACKAGE_CONTENT;
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/135146148/classifieds_promotion_packs?package_content=ALL;
```

Respuesta:

```
[
    {
     "id": 754985,
     "user_id": "135146148",
     "promotion_pack_id": "MPAB",
     "category_id": "MLU1743",
     "description": "Paquete 15 Básico",
     "package_type": "rotary",
     "package_content": "publications",
     "status": "active",
     "date_created": "2013-05-23T15:34:48.498-04:00",
     "date_start": "2013-05-23T15:34:47.544-04:00",
     "date_expires": "2013-06-22T15:34:47.544-04:00",
     "date_stopped": null,
     "last_updated": "2013-05-23T15:35:48.211-04:00",
     "engagement_type": "none",
     "charge_id": 822129921,
     "remaining_listings": 15,
     "used_listings": 0,
     "listing_details": [
        {
           "listing_type_id": "silver",
           "available_listings": 15,
           "used_listings": 0,
           "remaining_listings": 15
        }
     ]
    }
]
```

Presta atención al campo status = active; a través de él solo es posible verificar los planes que todavía están activos. A través del package_content, es posible verificar si el paquete es de publicación (publications) o destacado (upgrades). Finalmente, a través del campo remaining_listings, es posible saber cuántas publicaciones el cliente todavía tiene disponibles. Esto es importante, ya que verás en tu sistema cuántos paquetes tiene el cliente y el número de anuncios que le quedan para publicar y destacar, antes de enviar una publicación a Mercado Libre.

## Descripción de recursos

| Atributo | Descripción |
| --- | --- |
| **id** | Identificador único del paquete. |
| **user_id** | ID único del usuario que contrató el paquete. |
| **category_id** | Categoría del paquete. |
| **description** | Nombre del paquete. |
| **package_type** | Detalle del paquete. |
| **status** | Los valores posibles del estado del paquete son: activo: el usuario puede utilizar este paquete para publicar. Se descontará una available_listing cuando lo haga. pendiente: el paquete aún no está activo. finalizado: paquete expirado. |
| **date_created** | Fecha de creación del paquete. |
| **date_start** | Fecha de activación del paquete. |
| **date_expires** | Fecha de expiración del paquete. |
| **date_stopped** | Fecha de finalización del paquete. |
| **last_updated** | Última actualización del paquete. |
| **engagement_type** | Los valores posibles son: “ninguno”: El paquete se contrató por única vez. “recontratación”: Cuando el paquete expira, se recontratará automáticamente un package_type similar. |
| **charge_id** | ID único del cargo generado durante la contratación del paquete. |
| **listing_details** | información detallada sobre tipos y disponibilidad de publicaciones. |
| **listing_type_id** | listing_type asociado con el paquete. |
| **available_listings** | cantidad de publicaciones que el usuario obtiene con el paquete. |
| **used_listings** | Publicaciones ya utilizadas. |
| **remaining_listings** | Publicaciones restantes disponibles. |

## Verificar si un usuario tiene un listing_type específico disponible

Esta es una forma más rápida de saber si el usuario cuenta con un listing_type específico.
 Se puede aplicar para conocer:
 1) Conocer si un usuario tiene cupo de publicaciones (Silver)
 2) Conocer si un usuario tiene cupo de destaques (upgrades) disponibles.

Aqui el ejemplo para conocer si hay cupo de destaques disponibles, recordar que debe incluir el parámetro **upgrades**  para conocer si el destaque está activo o no. Para cupos Silver **de publicaciones** , quitar el parámetro de upgrades.

Llamada para consultar si tiene disponible Upgrades:

```
curl -X GET https://api.mercadolibre.com/users/$USER_ID/classifieds_promotion_packs/$LISTING_TYPE/available?categoryId=$CATEGORY_ID&upgrades=true
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/123456789/classifieds_promotion_packs/gold_premium/available?categoryId=MLM1744&upgrades=true
```

Respuesta:

```
{
  "has_available_listings": true
}
```

## Actualizar un anuncio (destacar)

Para destacar un anuncio, tendrás que realizar el siguiente posteo. Recuerda que para poder realizar esta acción el usuario debe haber contratado previamente un paquete destacado.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/{item_id}/listing_type
```

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA111111111/listing_type -d '{"id":"gold_premium"}
```

En el ejemplo anterior, el anuncio está siendo actualizado al listing type = gold_premium (Oro Premium). Recuerda también que no se genera ningún tipo de cobro al realizar esta llamada y que, en caso de deshacerse la actualización, la cuota destacada vuelve a quedar disponible. Tampoco es posible destacar una publicación sin que se haya contratado por lo menos un paquete destacado.

## Tiempo de vigencia de la publicación

Importante:

Esta condición aplica para autos y motos, publicados por usuarios profesionales (**user_type: car_dealer** ).

Existe un tiempo máximo de ciclo de vida del ítem. Es decir, para que un ítem esté publicado dependerá de dos condiciones principales:

- Que tenga cupo activo del paquete de publicación correspondiente;

- Que esté dentro del ciclo de vida esperado.

- 

- 

- 

- Para **autos**  en **venta**  y **motos**  en venta, la API finalizará el ítem luego de **xx días**  de publicados, aplicando la regla de ciclo mostrada en la tabla anterior.

- Significado de los parámetros de tiempo de ciclo de vida del ítem para autos y motos:

- **start_time** : la API lo define al momento de crear el ítem.

- **stop_time** : la API lo define al momento de crear el ítem según la categoría.

- **expiration_time** : la API lo define al momento de crear el ítem de acuerdo a la duración del promotion pack (pack de publicaciones activo que tenga).

- 

- Cuando el ítem llegue al **stop_time** , la API finalizara el ítem, el estado del ítem pasa de **active**  a **closed**  con sub status **expired** .

- 

- Cuando el paquete está activo y cayó el ítem por **closed/sub_status: expired** , puede ser porque llego el ciclo de vida del ítem al final. El integrador puede revisar el **start_time**  del ítem para confirmar o no eso.

- 

- Exemplo:

- Un ítem auto en venta (categoría MLC157522) que fue publicado con:

- **start_time** : 2022-01-01T00:06:15.000Z

- **stop_time** : 01/06/2022T00:06:15.000Z

- **expiration_time** : 2022-02-01T00:06:15.000Z (vencimiento del paquete de publicaciones mensual)

- 

- Fue publicado el 01/01/2022 y se mantendrá activo mientras el paquete de publicaciones esté activo y esté dentro del ciclo de vida (ciclo de vida de 180 días por ser venta). Llegado el 01/06/2022 el ítem se finalizará.

- 

- 

- Reglas para renovación automática de paquetes con recontratación automática

- Los paquetes ejecutan una serie de validaciones para renovar un paquete engagement-type "re-engagement":

- El paquete no debe estar pausado. El usuario debe estar habilitado para publicar (verificar status.list.allow=true). El usuario no debe tener deudas (verificar si en status.list.codes y status.list.immediate_payment.reasons está definido como "has_debt").

- **¿Cómo cancelar la renovación automática de destacados?**

- Actualmente, esta cancelación no se realiza a través de la API. El usuario vendedor/tienda deberá ir a su cuenta de Mercado Libre > Luego, hacer clic en la sección Resumen. Después, desmarcar la opción de renovación del paquete, confirmar y listo.

- 

- 

- **Siguiente**

- [Publica vehículos](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos)

- 
