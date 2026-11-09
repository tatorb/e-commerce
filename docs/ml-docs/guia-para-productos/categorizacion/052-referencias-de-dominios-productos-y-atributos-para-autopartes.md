<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/referencias-de-dominios-productos-y-atributos-para-autopartes -->
<!-- Sección: Guía para productos > Categorización -->

# Referencias de dominios, productos y atributos para Autopartes

Última actualización 15/06/2026

## Referencias de dominios, productos y atributos para Autopartes

**Dominios disponibles**

| País | Dominio |
| --- | --- |
| ARGENTINA | MLA-CARS_AND_VANS |
| BRASIL | MLB-CARS_AND_VANS |
| MÉXICO | MLM-CARS_AND_VANS_FOR_COMPATIBILITIES |
| URUGUAY | MLU-CARS_AND_VANS |
| CHILE | MLC-CARS_AND_VANS_FOR_COMPATIBILITIES |
| COLOMBIA | MCO-CARS_AND_VANS_FOR_COMPATIBILITIES |

De acuerdo al dominio del site, sugerimos que dentro de tu gestor de compatibilidades habilites filtros primarios, secundarios y opcionales según se muestra a continuación.

Ejemplo de atributos utilizados en el motor de búsqueda de compatibilidades para vehículos del dominio CARS_AND_VANS que aplica en los sites de MLA, MLB y MLU.

Ejemplo de atributos utilizados en motor de búsqueda de compatibilidades para vehículos del dominio CARS_AND_VANS_FOR_COMPATIBILITIES que aplica en los sites de MLM, MLC y MCO.

### Atributos principales

| Descripción de atributos | Atributos de CARS_AND_VANS (MLA, MLB, MLU) | Atributos de CARS_AND_VANS_FOR_COMPATIBILITIES (MLM, MLC y MCO) |
| --- | --- | --- |
| MARCA | BRAND | BRAND |
| MODELO | MODEL | CAR_AND_VAN_MODEL |
| AÑO | VEHICLE_YEAR | YEAR |
| VERSIÓN | SHORT_VERSION | CAR_AND_VAN_SUBMODEL |
| MOTOR | ENGINE | CAR_AND_VAN_ENGINE |

### Atributos secundarios

| Descripción de atributos | Atributos de CARS_AND_VANS (MLA, MLB y MLU) | Atributos de CARS_AND_VANS_FOR_COMPATIBILITIES (MLM, MLC y MCO) |
| --- | --- | --- |
| COMBUSTIBLE | FUEL_TYPE | N/A |
| POTENCIA | POWER | N/A |
| CARROCERÍA | VEHICLE_BODY_TYPE | N/A |
| TRANSMISIÓN | TRANSMISSION_CONTROL_TYPE | N/A |

### Atributos opcionales

| Descripción de atributos | Atributos de CARS_AND_VANS (MLA, MLB y MLU) | Atributos de CARS_AND_VANS_FOR_COMPATIBILITIES (MLM, MLC y MCO) |
| --- | --- | --- |
| MARCHAS | GEAR_NUMBER | CAR_AND_VAN_ENGINE |
| PUERTAS | DOORS | N/A |
| DIRECCIÓN | STEERING | N/A |
| TRACCIÓN | TRACTION_CONTROL | N/A |
| VÁLVULAS | VALVES_PER_CYLINDER | N/A |
| SISTEMA DE DIRECCIÓN | N/A | STEERING_SYSTEM |
| TIPO DE DIRECCIÓN | N/A | STEERING_TYPE |
| TIPO DE TRACCIÓN | N/A | DRIVE_TYPE |
| CARROCERÍA | N/A | CAR_AND_VAN_BODY_TYPE |
| TIPO DE CONTROL DE LA TRANSMISIÓN | N/A | TRANSMISSION_CONTROL_TYPE |
| CANTIDAD DE VELOCIDADES DE LA TRANSMISIÓN | N/A | TRANSMISSION_SPEEDS_NUMBER |
| CANTIDAD DE PUERTAS | N/A | BODY_DOORS_NUMBER |
| FRENOS ABS | N/A | BRAKE_ABS |

## Atributos por dominio

Recuerda que el detalle de los atributos por cada dominio lo puedes obtener con la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/$DOMAIN_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLA-CARS_AND_VANS
```

## Atributos por categoría

Recuerda que el detalle de los atributos por cada categoría lo puedes obtener con la siguiente llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/$CATEGORY_ID/attributes
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/categories/MLA12345/attributes
```

## Búsqueda de vehículos

A partir del 15/07/2026, el recurso **POST /catalog_compatibilities/products_search/chunks**  ya no está disponible.

Para gestionar las compatibilidades de las publicaciones, utiliza las alternativas que se detallan a continuación.

**1. Identificar publicaciones con compatibilidades sugeridas pendientes**  — utiliza el tag `pending_compatibilities`:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$SELLER_ID/items/search?tags=pending_compatibilities'
```

**2. Identificar publicaciones con compatibilidades incompletas**  — utiliza el tag `incomplete_compatibilities`:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' \
'https://api.mercadolibre.com/users/$SELLER_ID/items/search?tags=incomplete_compatibilities'
```

**3. Gestionar el catálogo de vehículos y aplicar sugerencias**  — utiliza el Gestor de Compatibilidades en Mercado Libre directamente.

## Top values

A continuación puedes ver cómo implementar por medio del recurso Top values la funcionalidad para cargar distintas listas con valores de atributos e ir filtrando los resultados.
 Con el siguiente recurso se pueden obtener los valores de cada combinación e ir refinando cada vez la búsqueda.

Llamada:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/$DOMAIN_ID/attributes/$ATTRIBUTE_ID/top_values 
```

Ejemplo "BRAND":

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLA-CARS_AND_VANS/attributes/BRAND/top_values
```

Respuesta:

```
[
   {
       "id": "60249",
       "name": "Volkswagen",
       "metric": 7781
   },
   {
       "id": "66432",
       "name": "Ford",
       "metric": 5616
   },
   {
       "id": "9909",
       "name": "Renault",
       "metric": 4327
   },
   {
       "id": "60279",
       "name": "Peugeot",
       "metric": 4250
   },
   {
       "id": "67781",
       "name": "Fiat",
       "metric": 4172
   },
[…]
]
```

Ejemplo para filtrar modelos (MODEL) de una marca (BRAND):

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLA-CARS_AND_VANS/attributes/MODEL/top_values 
{
   "known_attributes": [
       {
           "id": "BRAND",
           "value_id": "60249"
       }
   ]
}
```

Respuesta:

```
[
   {
       "id": "63686",
       "name": "Amarok",
       "metric": 1516
   },
   {
       "id": "1252874",
       "name": "Gol Trend",
       "metric": 925
   },
   {
       "id": "62109",
       "name": "Gol",
       "metric": 684
   },
   {
       "id": "1252871",
       "name": "Suran",
       "metric": 604
   },
   {
       "id": "64016",
       "name": "Vento",
       "metric": 585
   },
…
]
```

Ejemplo para obtener los años disponibles (VEHICLE_YEAR) filtrando por marca y modelo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/catalog_domains/MLA-CARS_AND_VANS/attributes/VEHICLE_YEAR/top_values
{
   "known_attributes": [
       {
           "id": "BRAND",
           "value_id": "60249"
       },
       {
           "id": "MODEL",
           "value_id": "63686"
       }
   ]
}
```

Respuesta:

```
[
   {
       "id": "6730991",
       "name": "2020",
       "metric": 732
   },
   {
       "id": "423549",
       "name": "2015",
       "metric": 130
   },
   {
       "id": "436694",
       "name": "2017",
       "metric": 115
   },
   {
       "id": "2451646",
       "name": "2019",
       "metric": 104
   },
[…]
]
```

**Volver** : [Compatibilidades entre ítems y productos de Autopartes](https://developers.mercadolibre.com.ar/es_ar/compatibilidades-entre-items-y-productos).
