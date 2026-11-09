<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/direcciones-del-usuario -->
<!-- Sección: Recursos de la API > Usuarios -->

# Direcciones del usuario

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Direcciones del usuario

El recurso /addresses detalla los campos obtenidos en el response correspondiente a su consulta, junto con las posibles respuestas a los mismos.

## Consultar direcciones del usuario

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID/addresses
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/145834937/addresses
```

Respuesta:

```
{
   "id":145834937,
   "user_id":"160252486",
   "contact":null,
   "phone":null,
   "address_line":"Guatemala 5100",
   "floor":null,
   "apartment":null,
   "street_number":"5100",
   "street_name":"Guatemala",
   "zip_code":"1000",
   "city":{
      "id":"TUxBQlBBTDI1MTVa",
      "name":"Palermo"
   },
   "state":{
      "id":"AR-C",
      "name":"Capital Federal"
   },
   "country":{
      "id":"AR",
      "name":"Argentina"
   },
   "neighborhood":{
      "id":null,
      "name":null
   },
   "municipality":{
      "id":null,
      "name":null
   },
   "search_location":{
      "state":{
         "id":"TUxBUENBUGw3M2E1",
         "name":"Capital Federal"
      },
      "city":{
         "id":"TUxBQ0NBUGZlZG1sYQ",
         "name":"Capital Federal"
      },
      "neighborhood":{
         "id":"TUxBQlBBTDI1MTVa",
         "name":"Palermo"
      }
   },
   "types":[
      "default_selling_address",
      "shipping"
   ],
   "comment":"",
   "geolocation_type":"RANGE_INTERPOLATED",
   "latitude":-34.5834729,
   "longitude":-58.4281022,
   "status":"active",
   "date_created":"2014-06-05T12:26:54.000-04:00",
   "normalized":true,
   "open_hours":{
      "on_holidays":{
         "hours":[

         ],
         "status":"closed"
      }
   }
}
```

## Campos de la respuesta

| Campo | Subcampo | Descripción |
| --- | --- | --- |
| **id** |  | ID de la dirección solicitada. |
| **user_id** |  | ID del usuario. |
| **contact** |  | Nombre de la persona propietaria de la información (usuario). |
| **phone** |  | Número telefónico del usuario. |
| **address_line** |  | Domicilio completo del usuario (calle y número). |
| **floor** |  | Piso del edificio, en caso de ser el domicilio un departamento. |
| **apartment** |  | Identificación del departamento (número o letra). |
| **street_number** |  | Número de la calle del domicilio citado en “address_line”. |
| **street_name** |  | Nombre de la calle del domicilio citado en “address_line”. |
| **zip_code** |  | Código postal. |
| **city** |  | Ciudad en la que se encuentra el domicilio. |
|  | id | Identificador único de la ciudad (locations api core). |
|  | name | Nombre de la ciudad. |
| **state** |  | Estado/Provincia en la que se encuentra la ciudad. |
|  | id | Identificador único del estado/provincia (locations api core). |
|  | name | Nombre del estado/provincia. |
| **country** |  | País en el que se encuentra la dirección. |
|  | id | Identificador único del país (locations api core). |
|  | name | Nombre del país |
| **neighborhood** |  | Barrio asociado a la dirección. |
|  | id | Identificador único del barrio. |
|  | name | Nombre del barrio. |
| **municipality** |  | Municipalidad asociada a la dirección. |
|  | id | Identificador único de la municipalidad. |
|  | name | Nombre de la municipalidad. |
| **search_location** |  | Información del domicilio que se utilizará en los listados de búsqueda. |
|  | state | Estado/Provincia en la que se encuentra la ciudad, en Classified.El id está asociado a la api de locations de classified. |
|  | city | Ciudad en la que se encuentra el domicilio, según Classified. El id está asociado a la api de locations de classified. |
|  | neighbourhood | Barrio en el que se encuentra el domicilio, según Classified. El id está asociado a la api de locations de classified. |
| **types** |  | Especifica el tipo de domicilio. Valores posibles: **default_selling_address** : domicilio de venta **default_buying_address** : domicilio de compra **shipping** : domicilio desde el cual se efectuarán los envíos **billing** : domicilio de facturación de MercadoLibre. |
| **comment** |  | Comentarios sobre la información del domicilio. |
| **geolocation_type** |  | Rango aproximado de la dirección en cuestión. Acorde a los parámetros de latitud y longitud otorgados por Google Maps. |
| **latitude** |  | Latitud otorgada por Google Maps. |
| **longitude** |  | Longitud otorgada por Google Maps. |
| **status** |  | Estado de la dirección. Valores posibles: active o inactive. |
| **date_created** |  | Fecha y hora en la cual fue dada de alta. |
| **normalized** |  | Indica si los datos almacenados son correctos. En caso de no serlos, será false. Valores posibles: true, false. |
| **open_hours** |  | Horario de atención, en caso de pertenecer la dirección a un comercio. |
|  | on_holidays | Horario de atención especial para vacaciones. Posee el sub-atributo hours. |

**Siguiente:**  [Marcadores](https://developers.mercadolibre.com.ar/es_ar/marcadores).
