<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/localizar-inmuebles -->
<!-- Sección: Guía para inmuebles -->

# Localizar Inmuebles

Última actualización 08/11/2025

## Localizar Inmuebles

### Introducción: Potenciando la búsqueda y publicación de inmuebles con nuestra API

La API de Inmuebles de MercadoLibre proporciona a los desarrolladores las herramientas necesarias para integrar funciones de búsqueda y publicación de propiedades en sus aplicaciones. Al comenzar con la API de Localización de Inmuebles, los desarrolladores pueden obtener listados de propiedades altamente segmentados utilizando filtros precisos, como la ubicación geográfica (ciudad, barrio, estado), precio y tipo de propiedad.

Esta capacidad de localización avanzada es esencial para plataformas inmobiliarias, aplicaciones de gestión de propiedades y cualquier sistema que requiera acceso dinámico y filtrado por ubicación a la amplia base de datos de inmuebles de MercadoLibre.

Para utilizar esta API, explicaremos primero los países, luego estados, ciudades y barrios. Al final, tendrás toda la información necesaria para buscar una propiedad por su ubicación o incluso ocultar la información de ubicación exacta si es necesario.

## Explorar Países

Este es el punto de partida para usar la API. Te da la lista de países donde opera MercadoLibre y donde puedes buscar inmuebles. Úsalo para crear apps que funcionen en varios países, permitiendo a los usuarios elegir el país que les interesa antes de buscar propiedades.

La respuesta que obtienes es una lista de objetos JSON, cada uno representa un país con la información que necesitas para seguir usando la API.

```

curl -X GET 
-H 'Authorization: Bearer $ACCESS_TOKEN' 
https://api.mercadolibre.com/classified_locations/countries
```

Nota:

Este endpoint no requiere parámetros de consulta.

Ejemplo de Respuesta:

```
[
  {
    "id": "AR",
    "name": "Argentina",
    "locale": "es_AR",
    "currency_id": "ARS"
  },
  {
    "id": "BO",
    "name": "Bolivia",
    "locale": "es_BO",
    "currency_id": "BOB"
  },
  {
    "id": "BR",
    "name": "Brasil",
    "locale": "pt_BR",
    "currency_id": "BRL"
  },
  {
    "id": "CL",
    "name": "Chile",
    "locale": "es_CL",
    "currency_id": "CLP"
  },
  {
    "id": "CN",
    "name": "China",
    "locale": "zh_CN",
    "currency_id": "CNY"
  },
  {
    "id": "CO",
    "name": "Colombia",
    "locale": "es_CO",
    "currency_id": "COP"
  },
  {
    "id": "CR",
    "name": "Costa Rica",
    "locale": "es_CR",
    "currency_id": "CRC"
  },
  {
    "id": "CBT",
    "name": "Cross Border Trade",
    "locale": "es_AR",
    "currency_id": "ARS"
  },
  {
    "id": "EC",
    "name": "Ecuador",
    "locale": "es_EC",
    "currency_id": "USD"
  },
  {
    "id": "SV",
    "name": "El Salvador",
    "locale": "es_SV",
    "currency_id": "USD"
  },
  {
    "id": "GT",
    "name": "Guatemala",
    "locale": "es_GT",
    "currency_id": "GTQ"
  },
  {
    "id": "HN",
    "name": "Honduras",
    "locale": "es_HN",
    "currency_id": "HNL"
  },
  {
    "id": "MX",
    "name": "Mexico",
    "locale": "es_MX",
    "currency_id": "MXN"
  },
  {
    "id": "NI",
    "name": "Nicaragua",
    "locale": "es_NI",
    "currency_id": "NIO"
  },
  {
    "id": "PA",
    "name": "Panamá",
    "locale": "es_PA",
    "currency_id": "USD"
  },
  {
    "id": "PY",
    "name": "Paraguay",
    "locale": "es_PY",
    "currency_id": "PYG"
  },
  {
    "id": "PE",
    "name": "Peru",
    "locale": "es_PE",
    "currency_id": "PEN"
  },
  {
    "id": "PT",
    "name": "Portugal",
    "locale": "pt_PT",
    "currency_id": "EUR"
  },
  {
    "id": "PR",
    "name": "Puerto Rico",
    "locale": "es_PR",
    "currency_id": "USD"
  },
  {
    "id": "GB",
    "name": "Reino Unido",
    "locale": "en_GB",
    "currency_id": "GBP"
  },
  {
    "id": "DO",
    "name": "República Dominicana",
    "locale": "es_DO",
    "currency_id": "DOP"
  },
  {
    "id": "UY",
    "name": "Uruguay",
    "locale": "es_UY",
    "currency_id": "UYU"
  },
  {
    "id": "VE",
    "name": "Venezuela",
    "locale": "es_VE",
    "currency_id": "VES"
  },
  {
    "id": "COL",
    "name": "newCOL",
    "locale": "es_COL",
    "currency_id": "COLS"
  }
]
```

Nota:

En el ejemplo de respuesta JSON, se observa un valor atípico, **CBT**  o Cross Border Trade. Esto no representa un país, sino una situación particular de MercadoLibre para el negocio entre fronteras. Además, también puede observarse el resultado **COL**  o newCOL. Esto no se trata de un reemplazo efectivo, por lo tanto debe desestimarse.

### Estructura de respuesta esperada

El resultado esperado es un arreglo de **países**  con la siguiente estructura:

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| id | String | No | Identificador único de 2 o 3 caracteres |
| name | String | No | Nombre del País |
| locale | String | No | Locale determinado para el país |
| currency_id | String | No | Identificador de moneda principal del país |

## Explorar información del País

Después de obtener la lista de países, puedes explorar los detalles de cada uno. Esto te permitirá conocer información específica sobre sus estados, ciudades y otros aspectos relevantes.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/countries/$COUNTRY_ID
```

**Parámetros**

**Id del País** : El parámetro **COUNTRY_ID**  permite filtrar por país. Admite el uso del identificador (ID) del país, en formato de 2 o 3 caracteres, como se detalla en la estructura previa.

Ejemplo de llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/countries/AR
```

Respuesta:

```
{
  "id": "AR",
  "name": "Argentina",
  "locale": "es_AR",
  "currency_id": "ARS",
  "decimal_separator": ",",
  "thousands_separator": ".",
  "time_zone": "GMT-03:00",
  "time_zone_name": "",
  "geo_information": {
    "location": {
      "latitude": -38.416096,
      "longitude": -63.616673
    }
  },
  "states": [
    { "id": "TUxBUEJSQWwyMzA1", "name": "Brasil" },
    { "id": "TUxBUENPU2ExMmFkMw", "name": "Bs.As. Costa Atlántica" },
    { "id": "TUxBUEdSQWU4ZDkz", "name": "Bs.As. G.B.A. Norte" },
    { "id": "TUxBUEdSQWVmNTVm", "name": "Bs.As. G.B.A. Oeste" },
    { "id": "TUxBUEdSQXJlMDNm", "name": "Bs.As. G.B.A. Sur" },
    { "id": "QnVlbm9zIEFpcmVz", "name": "Buenos Aires" },
    { "id": "TUxBUFpPTmFpbnRl", "name": "Buenos Aires Interior" },
    { "id": "TUxBUENBUGw3M2E1", "name": "Capital Federal" },
    { "id": "TUxBUENBVGFiY2Fm", "name": "Catamarca" },
    { "id": "TUxBUENIQW8xMTNhOA", "name": "Chaco" },
    { "id": "Y2hpbGU=", "name": "Chile" },
    { "id": "TUxBUENIVXQxNDM1MQ", "name": "Chubut" },
    { "id": "TUxBUENPUnM5MjI0", "name": "Corrientes" },
    { "id": "TUxBUENPUmFkZGIw", "name": "Córdoba" },
    { "id": "TUxBUEVOVHMzNTdm", "name": "Entre Ríos" },
    { "id": "TUxBUEZPUmE1OTk5", "name": "Formosa" },
    { "id": "TUxBUEpVSnk3YmUz", "name": "Jujuy" },
    { "id": "TUxBUExBWmE1OWMy", "name": "La Pampa" },
    { "id": "TUxBUExBWmEyNzY0", "name": "La Rioja" },
    { "id": "TUxBUE1FTmE5OWQ4", "name": "Mendoza" },
    { "id": "TUxBUE1JU3MzNjIx", "name": "Misiones" },
    { "id": "TUxBUE5FVW4xMzMzNQ", "name": "Neuquén" },
    { "id": "UHJvdmlua2lhdmVvIGRlIEJ1ZW5vcyBBaXJl", "name": "Província de Buenos Aires" },
    { "id": "TUxBUFJFUDQyMjQ4Ng", "name": "República Dominicana" },
    { "id": "TUxBUFLNT29iZmZm", "name": "Río Negro" },
    { "id": "TUxBUFNBTGFjMTJi", "name": "Salta" },
    { "id": "TUxBUFNBTm5lYjU4", "name": "San Juan" },
    { "id": "TUxBUFNBTnM0ZTcz", "name": "San Luis" },
    { "id": "TUxBUFNBTno3ZmY5", "name": "Santa Cruz" },
    { "id": "TUxBUFNBTmU5Nzk2", "name": "Santa Fe" },
    { "id": "TUxBUFNBTm9lOTlk", "name": "Santiago del Estero" },
    { "id": "TUxBUFRJRVoxM2M5YQ", "name": "Tierra del Fuego" },
    { "id": "TUxBUFRVQ244NmM3", "name": "Tucumán" },
    { "id": "TUxBUFVTQWl1cXdlMg", "name": "USA" },
    { "id": "TUxBUFVSVXllZDVl", "name": "Uruguay" }
  ]
}
```

Nota:

Se puede identificar que dentro de la estructura de **states**  para el país también se incluyen países limítrofes. En este caso del ejemplo de Argentina, se incluyen países limítrofes como Chile, Brasil, Uruguay, Bolivia, Paraguay.

### Estructura de respuesta esperada

El resultado esperado es una entidad **país**  con la siguiente estructura:

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| id | string | No | Identificador único de 2 o 3 caracteres |
| name | string | No | Nombre del País |
| locale | string | No | Locale determinado para el país |
| currency_id | string | No | Identificador de moneda principal del país |
| decimal_separator | string | No | Carácter designado como separador de decimales en el currency |
| thousands_separator | string | No | Carácter designado como separador de miles en el currency |
| time_zone | string | No | Time Zone local al país |
| time_zone_name | string | Sí | Nombre de ese time zone |
| geo_information.location.latitude | float | No | Latitud del país |
| geo_information.location.longitude | float | No | Longitud del país |
| states | array | No | Arreglo con listado de estados, cada uno identificados por un id y name |

### Manejo de Errores

**País no encontrado:**

```
{
  "message": "Country not found",
  "error": "not_found",
  "status": 404,
  "cause": []
}
```

## Explorar información de Estados

Tras obtener los identificadores de estado en las operaciones previas, se puede conseguir información adicional de cada uno de ellos (también conocidos como provincias o regiones en algunos países). Esta información ampliada incluirá datos como la geolocalización, las ciudades que corresponden a cada estado y otros detalles.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/states/$STATE_ID
```

**Parámetros:**

**Id del Estado** : El parámetro **STATE_ID**  permite filtrar por estado. Admite el uso del identificador (ID) del estado, en formato string o cadena de caracteres, como se detalla en la estructura previa.

Ejemplo de llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/states/TUxBUENPUmFkZGIw
```

Respuesta:

```
{
  "id": "TUxBUENPUmFkZGIw",
  "name": "Córdoba",
  "country": { "id": "AR", "name": "Argentina" },
  "geo_information": { "location": { "latitude": -32.2968402, "longitude": -63.580611 } },
  "time_zone": "GMT-03:00",
  "time_zone_name": "America/Cordoba",
  "cities": [
    { "id": "TVhYQWNoaXJhc1RVeEJVRU5QVW1Ga1pHSXc", "name": "Achiras" },
    { "id": "TVhYQWx0YSBHcmFjaWFUVXhCVUVOUFVtRmtaR", "name": "Alta Gracia" },
    { "id": "TVhYQXJyb3lpdG9UVXhCVUVOUFVtRmtaR0l3", "name": "Arroyito" },
    { "id": "TVhYQmVycm90YXLDoW5UVXhCVUVOUFVtRmtaR", "name": "Berrotarán" },
    { "id": "TVhYQmlhbGV0IE1hc3PDqVRVeEJVRU5QVW1Ga", "name": "Bialet Massé" },
    { "id": "TUxBQ0NBTGMwYWZk", "name": "Calamuchita" },
    { "id": "TUxBQ0NPTDdlNmZl", "name": "Colón" },
    { "id": "TVhYQ29zcXXDrW5UVXhCVUVOUFVtRmtaR0l3", "name": "Cosquín" },
    { "id": "TVhYQ3J1eiBBbHRhVFV4QlVFTlBVbUZrWkdJd", "name": "Cruz Alta" },
    { "id": "TUxBQ0NSVWVjOGJh", "name": "Cruz del Eje" },
    { "id": "TUxBQ0NBUGNiZGQx", "name": "Córdoba" },
    { "id": "TVhYRnJleXJlVFV4QlVFTlBVbUZrWkdJdw", "name": "Freyre" },
    { "id": "TVhYR2VuZXJhbCBEZWhlemFUVXhCVUVOUFVtR", "name": "General Deheza" },
    { "id": "TUxBQ0dFTjMwYzFh", "name": "General Roca" },
    { "id": "TUxBQ0dFTmE2OGQ2", "name": "General San Martín" },
    { "id": "TUxBQ0lTQzJkZGM2", "name": "Ischilín" },
    { "id": "TVhYSmVzw7pzIE1hcsOtYVRVeEJVRU5QVW1Ga", "name": "Jesús María" },
    { "id": "TUxBQ0pVwTUyMmRh", "name": "Juárez Celman" },
    { "id": "TVhYTGEgQm9sc2FUVXhCVUVOUFVtRmtaR0l3", "name": "La Bolsa" },
    { "id": "TVhYTGEgQ2FsZXJhVFV4QlVFTlBVbUZrWkdJd", "name": "La Calera" },
    { "id": "TVhYTGEgQ2FybG90YVRVeEJVRU5QVW1Ga1pHS", "name": "La Carlota" },
    { "id": "TVhYTGEgRmFsZGFUVXhCVUVOUFVtRmtaR0l3", "name": "La Falda" },
    { "id": "TVhYTGEgUGFpc2FuaXRhVFV4QlVFTlBVbUZrW", "name": "La Paisanita" },
    { "id": "TVhYTGFndW5hIExhcmdhVFV4QlVFTlBVbUZrW", "name": "Laguna Larga" },
    { "id": "TVhYTG9zIEVzcGluaWxsb3NUVXhCVUVOUFVtR", "name": "Los Espinillos" },
    { "id": "TVhYTWFsYWd1ZcOxb1RVeEJVRU5QVW1Ga1pHS", "name": "Malagueño" },
    { "id": "TUxBQ01BUmU2ZjEx", "name": "Marcos Juárez" },
    { "id": "TVhYTWVuZGlvbGF6YVRVeEJVRU5QVW1Ga1pHS", "name": "Mendiolaza" },
    { "id": "TUxBQ01JTjI2ZDRi", "name": "Minas" },
    { "id": "TVhYT25jYXRpdm9UVXhCVUVOUFVtRmtaR0l3", "name": "Oncativo" },
    { "id": "TVhYT25nYW1pcmFUVXhCVUVOUFVtRmtaR0l3", "name": "Ongamira" },
    { "id": "TUxBQ1BPQ2RiODcy", "name": "Pocho" },
    { "id": "TVhYUG90cmVybyBkZSBHYXJheVRVeEJVRU5QV", "name": "Potrero de Garay" },
    { "id": "TUxBQ1BSRTljM2Mw", "name": "Presidente Roque Sáenz Peña" },
    { "id": "TVhYUHVlcnRvIGRlbCBBZ3VpbGFUVXhCVUVOU", "name": "Puerto del Aguila" },
    { "id": "TUxBQ1BVTjkyMmI4", "name": "Punilla" },
    { "id": "TVhYUsOtbyBDZWJhbGxvc1RVeEJVRU5QVW1Ga", "name": "Río Ceballos" },
    { "id": "TUxBQ1LNTzc4N2Fm", "name": "Río Cuarto" },
    { "id": "TUxBQ1LNT2E3Y2E5", "name": "Río Primero" },
    { "id": "TUxBQ1LNT2EzZjhm", "name": "Río Seco" },
    { "id": "TUxBQ1LNT2RiZTBj", "name": "Río Segundo" },
    { "id": "TUxBQ1NBTmIxNDY", "name": "San Alberto" },
    { "id": "TUxBQ1NBTjcyMDk5OA", "name": "San Francisco" },
    { "id": "TUxBQ1NBTjM3OTVl", "name": "San Javier" },
    { "id": "TUxBQ1NBTjk4MzY", "name": "San Justo" },
    { "id": "TUxBQ1NBTjlmZjVh", "name": "Santa María" },
    { "id": "TVhYU2FudGEgUm9zYSBkZSBDYWxhbXVjaGl0Y", "name": "Santa Rosa de Calamuchita" },
    { "id": "TUxBQ1NPQjVkNGVi", "name": "Sobremonte" },
    { "id": "TUxBQ1RFUmJmYmYy", "name": "Tercero Arriba" },
    { "id": "TUxBQ1RPVGIxNmYy", "name": "Totoral" },
    { "id": "TUxBQ1RVTDgxNTI5", "name": "Tulumba" },
    { "id": "TUxBQ1VOSTg2Yzhl", "name": "Unión" },
    { "id": "TVhYVmlsbGEgQWxsZW5kZVRVeEJVRU5QVW1Ga", "name": "Villa Allende" },
    { "id": "TVhYVmlsbGEgQ2FybG9zIFBhelTVeEJVRU5QV", "name": "Villa Carlos Paz" },
    { "id": "TVhYUGxvdHRpZXJUVXhCVUVOUFVtRmtaR0l3", "name": "Villa General Belgrano" },
    { "id": "TUxBQ1ZJTDE4NjE1Mg", "name": "Villa María" },
    { "id": "TVhYVmlsbGEgU2FudGEgUm9zYVRVeEJVRU5QV", "name": "Villa Santa Rosa" }
  ]
}
```

### Estructura de respuesta esperada

El resultado esperado es una entidad **Estado**  con la siguiente estructura:

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| id | string | No | Identificador único en formato cadena caracteres |
| name | string | No | Nombre del Estado |
| country.id | string | No | Identificador único de 2 o 3 caracteres |
| country.name | string | No | Nombre del País |
| geo_information.location.latitude | float | No | Latitud del estado |
| geo_information.location.longitude | float | No | Longitud del estado |
| time_zone | string | No | Time Zone local al estado |
| time_zone_name | string | No | Nombre de ese time zone |
| cities | array | No | Arreglo con listado de ciudades, cada una identificadas por un id y name |

### Manejo de Errores

**Estado no encontrado:**

```
{
    "message": "State not found",
    "error": "not_found",
    "status": 404,
    "cause": []
}
```

## Explorar información de Ciudades

Después de obtener los identificadores de ciudades en las operaciones previas, se puede conseguir información adicional de cada una de ellas. Esta información ampliada incluirá la geolocalización, los barrios o comunas que la componen y otros detalles. Es importante aclarar que estas ciudades pueden representar regiones menores donde se incluyan no solo barrios o comunas sino también pueblos enmarcados en la región.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/cities/$CITY_ID
```

**Parámetros:**

**Id del Ciudad** : El parámetro **CITY_ID**  permite filtrar por ciudad. Admite el uso del identificador (ID) de la ciudad, en formato string o cadena de caracteres, como se detalla en la estructura previa.

Ejemplo de llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/cities/TUxBQ1LNTzc4N2Fm
```

Respuesta:

```
{
  "id": "TUxBQ1LNTzc4N2Fm",
  "name": "Río Cuarto",
  "state": { "id": "TUxBUENPUmFkZGIw", "name": "Córdoba" },
  "country": { "id": "AR", "name": "Argentina" },
  "neighborhoods": [
    { "id": "TUxBQkFERTc1Njc1OA", "name": "Adelia María" },
    { "id": "TUxBQkFMQzUxMTMxNg", "name": "Alcira" },
    { "id": "TUxBQkFMUDQ0Nzk5MA", "name": "Alpa Corral" },
    { "id": "TUxBQkJFUjUxNzQyMg", "name": "Berrotarán" },
    { "id": "TUxBQkJVTDUzODIyMA", "name": "Bulnes" },
    { "id": "TUxBQkNIQTYxMTY3MQ", "name": "Chaján" },
    {about:blank#blocked
      "id": "TUxBQkNIVTQ2OTM5NA",
      "name": "Chucul"
    },
    { "id": "TUxBQkNPUjg0MTg2NQ", "name": "Coronel Baigorria" },
    { "id": "TUxBQkNPUjYwMjM4OQ", "name": "Coronel Moldes" },
    { "id": "TUxBQkVMRTc3MDY5MQ", "name": "Elena" },
    { "id": "TUxBQkxBQzU2NTY4OQ", "name": "La Carolina" },
    { "id": "TUxBQkxBQzk2NzMzNg", "name": "La Cautiva" },
    { "id": "TUxBQkxBRzU0OTAyNg", "name": "La Gilda" },
    { "id": "TUxBQkxBUzkyODY4MQ", "name": "Las Acequias" },
    { "id": "TUxBQkxBUzU1NzY0NQ", "name": "Las Albahacas" },
    { "id": "TUxBQkxBUzU4OTkzMQ", "name": "Las Higueras" },
    { "id": "TUxBQkxBUzU0MjIyOA", "name": "Las Peñas" },
    { "id": "TUxBQkxBUzIzMTA1NQ", "name": "Las Vertientes" },
    { "id": "TUxBQk1BTDI2MTYwNA", "name": "Malena" },
    { "id": "TUxBQk1PTjIzNjExOQ", "name": "Monte de los Gauchos" },
    { "id": "TUxBQlBBUzg5NDM5Ng", "name": "Paso del Durazno" },
    { "id": "TUxBQlLNTzM2NDg2OA", "name": "Río Cuarto" },
    { "id": "TUxBQlNBTTkxNzExOQ", "name": "Sampacho" },
    { "id": "TUxBQlNBTjE3MDY1Mw", "name": "San Basilio" },
    { "id": "TUxBQlNBTjQxNzg4Mg", "name": "Santa Catalina" },
    { "id": "TUxBQlNVQzkzMDI3Ng", "name": "Suco" },
    { "id": "TUxBQlRPUzczNjQyMQ", "name": "Tosquitas" },
    { "id": "TUxBQlZJQzY2MDY1NA", "name": "Vicuña Mackenna" },
    { "id": "TUxBQlZJTDU3NTIxNQ", "name": "Villa El Chacay" },
    { "id": "TUxBQlZJTDMwNDk5OQ", "name": "Villa Santa Eugenia" },
    { "id": "TUxBQldBUzkyMDA1Mw", "name": "Washington" }
  ],
  "geo_information": { "location": { "latitude": -33.3475232, "longitude": -64.5266446 } }
}
```

### Estructura de respuesta esperada

El resultado esperado es una entidad **Ciudad**  con la siguiente estructura:

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| id | string | No | Identificador único en formato cadena caracteres |
| name | string | No | Nombre de la Ciudad |
| state.id | string | No | Identificador único en formato cadena caracteres para el estado |
| state.name | string | No | Nombre del Estado |
| country.id | string | No | Identificador único de 2 o 3 caracteres |
| country.name | string | No | Nombre del País |
| geo_information.location.latitude | float | No | Latitud de la Ciudad |
| geo_information.location.longitude | float | No | Longitud de la Ciudad |
| neighborhoods | array | No | Arreglo con listado de barrios, cada una identificadas por un id y name |

### Manejo de Errores

**Ciudad no encontrada:**

```
{
    "message": "City not found",
    "error": "not_found",
    "status": 404,
    "cause": []
}
```

## Explorar información de Barrios

Tras obtener los ID de los barrios en las operaciones previas, se puede conseguir información adicional de cada uno. Esta información incluirá la geolocalización, los sub barrios o comunas que lo componen y otros detalles. Cabe aclarar que estos barrios también pueden representar comunas menores o pueblos.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/neighborhoods/$NEIGHBORHOOD_ID
```

**Parámetros:**

**Id del Estado** : El parámetro **NEIGHBORHOOD_ID**  permite filtrar por barrio. Admite el uso del identificador (ID) del barrio, en formato string o cadena de carácteres, como se detalla en la estructura previa.

Ejemplo de llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/neighborhoods/TUxBQlLNTzM2NDg2OA
```

Respuesta:

```
{
  "id": "TUxBQlLNTzM2NDg2OA",
  "name": "Río Cuarto",
  "city": { "id": "TUxBQ1LNTzc4N2Fm", "name": "Río Cuarto" },
  "state": { "id": "TUxBUENPUmFkZGIw", "name": "Córdoba" },
  "country": { "id": "AR", "name": "Argentina" },
  "geo_information": { "location": { "latitude": -33.123158, "longitude": -64.34934 } },
  "subneighborhoods": []
}
```

### Estructura de respuesta esperada

El resultado esperado es una entidad **Barrio**  con la siguiente estructura:

| Parámetro | Tipo | Opcional | Descripción |
| --- | --- | --- | --- |
| id | string | No | Identificador único en formato cadena caracteres para el Barrio |
| name | string | No | Nombre del Barrio |
| city.id | string | No | Identificador único en formato cadena caracteres para la ciudad |
| city.name | string | No | Nombre de la Ciudad |
| state.id | string | No | Identificador único en formato cadena caracteres para el estado |
| state.name | string | No | Nombre del Estado |
| country.id | string | No | Identificador único de 2 o 3 caracteres |
| country.name | string | No | Nombre del País |
| geo_information.location.latitude | float | No | Latitud de la Ciudad |
| geo_information.location.longitude | float | No | Longitud de la Ciudad |
| subneighborhoods | array | No | Arreglo con listado de sub barrios, cada uno identificado por un id y name |

### Manejo de Errores

**Barrio no encontrado:**

```
{
    "message": "Neighborhood not found",
    "error": "not_found",
    "status": 404,
    "cause": []
}
```

## Busca Inmuebles por Ubicación

Una vez que hayas seleccionado la ubicación deseada para tu inmueble, podrás utilizar este recurso para buscar artículos por su ubicación geográfica. Para ello, deberás especificar un rango de latitud y longitud que delimite el área donde quieres buscar.

**Recuerda que la precisión de tu búsqueda dependerá en gran medida del rango de latitud y longitud que proporciones** : Un rango más amplio te mostrará más resultados, pero menos precisos, mientras que un rango más estrecho te dará resultados más relevantes para una zona específica.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/$COUNTRY_ID/search?item_location=lat:$LATITUDE1_LATITUDE2,lon:$LONGITUDE1_LONGITUDE2&category=$CATEGORY_ID
```

**Parámetros:**

- **Id del País** : COUNTRY_ID permite filtrar por país. Formato string.

- **Latitud** : LATITUDE1_LATITUDE2 permite filtrar por latitud.

- **Longitud** : LONGITUDE1_LONGITUDE2 permite filtrar por longitud.

- **Id de Categoría** : CATEGORY_ID permite filtrar por categoría del inmueble.

Importante:

El parámetro que integra latitud y longitud para la búsqueda por ubicación del inmueble es item_location y el formato correcto esperado es el siguiente:**item_location=lat:$LATITUDE1_LATITUDE2,lon:$LONGITUDE1_LONGITUDE2**

Ejemplo de llamada:

En el siguiente ejemplo se están buscando los inmuebles de la categoría `MLA1459` en Argentina, limitando este resultado, para los valores indicados de latitud y longitud.

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/search?item_location=lat:-37.987148_-30.987148,lon:-57.5483864_-50.5483864&category=MLA1459&limit=1
```

Respuesta:

```
{
  "site_id": "MLA",
  "country_default_time_zone": "GMT-03:00",
  "paging": { "total": 66065, "primary_results": 1000, "offset": 0, "limit": 1 },
  "results": [ {...} ],
  "sort": { "id": "relevance", "name": "Más relevantes" },
  "available_sorts": [
    { "id": "price_asc", "name": "Menor precio" },
    { "id": "price_desc", "name": "Mayor precio" }
  ],
  "filters": [
    {
      "id": "category",
      "name": "Categorías",
      "type": "text",
      "values": [
        {
          "id": "MLA1459",
          "name": "Inmuebles",
          "path_from_root": [ { "id": "MLA1459", "name": "Inmuebles" } ]
        }
      ]
    },
    {
      "id": "item_location",
      "name": "Ubicación",
      "type": "text",
      "values": [
        {
          "id": "lat:-37.987148_-30.987148,lon:-57.5483864_-50.5483864",
          "name": "Área del mapa seleccionada"
        }
      ]
    }
  ],
  "available_filters": [ {...} ],
  "currency": { "id": "ARS", "symbol": "$" },
  "available_currencies": {
    "currencies": [ { "id": "USD", "symbol": "US$" } ],
    "conversions": { "ars_usd": 0.00093589, "usd_ars": 1068.5 }
  },
  "pdp_tracking": { "group": false, "product_info": [] },
  "user_context": null,
  "ranking_introspection": {}
}
```

Nota:

A los fines prácticos de la guía, buscando mejorar la legibilidad del resultado esperado dado su tamaño, se ha omitido información de resultados `results` y filtros habilitados en la búsqueda `available_filters`.

## Ocultar la dirección exacta de la propiedad.

La decisión de mostrar o no la ubicación exacta de una propiedad en un anuncio publicado recae en el gestor del inmueble. Esta medida se toma principalmente por razones de seguridad y privacidad. Sin embargo, incluso si la ubicación exacta no se revela, la publicación siempre incluirá la localización y el número de la propiedad.

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/address_line_by_reference
```

**Parámetros:**

**Id del Item** : El parámetro **ITEM_ID**  permite filtrar por ítem o anuncio.

## Revertir Ocultamiento

Para revertir el ocultamiento de la dirección exacta, puedes realizar un delete del tag.

```
curl -X DELETE -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/address_line_by_reference
```

### Siguientes Pasos

- [Gestiona paquetes inmuebles.](https://developers.mercadolibre.com.ar/es_ar/gestionar-paquetes-de-inmuebles)

- [Publica inmuebles.](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble)

### Lecturas Recomendadas

- [Publicaciones de tiendas oficiales](https://developers.mercadolibre.com.ar/es_ar/publicaciones-de-tiendas-oficiales-para-inmuebles)

- [Ciclo de vida de las publicaciones](https://developers.mercadolibre.com.ar/es_ar/ciclo-de-vida-de-las-publicaciones-de-inmuebles).

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 05/11/2025 | 1.0 | Publicación Inicial |
