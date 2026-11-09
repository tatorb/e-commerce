<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/localizacion-de-vehiculos -->
<!-- Sección: Guía para vehículos -->

# Localiza vehículos

Última actualización 21/07/2025

## Localiza vehículos

Al publicar un inmueble, vehículo o servicio, es necesario identificar la ubicación. Se debe establecer el ID de ciudad y, de forma opcional, estado y barrio. Para este propósito, utiliza el recurso classified_locations.

## Parametrización de ubicación

En la solicitud de publicación, envía solo el ID correspondiente al barrio o ciudad.

- Si mandas el ID de barrio, la API completa automáticamente estado y ciudad relacionados.

- Si la ciudad no tiene barrios, envía el ID de la ciudad.

- No envíes directamente el ID de estado (si lo haces, la API rechaza la publicación), ya que este dato se determina a partir de barrio o ciudad.

## Explorar todos los países

Consulta el listado completo de los países habilitados. Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/countries
```

Respuesta:

```
[
  {
  "id": "AR",
  "name": "Argentina",
  "locale": "es_AR",
  "currency_id": "ARS"
  },
  {
  "id": "BR",
  "name": "Brasil",
  "locale": "pt_BR",
  "currency_id": "BRL"
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
  "id": "CL",
  "name": "Chile",
  "locale": "es_CL",
  "currency_id": "CLP"
  },
  {
  "id": "EC",
  "name": "Ecuador",
  "locale": "es_EC",
  "currency_id": "USD"
  },
  {
  "id": "MX",
  "name": "Mexico",
  "locale": "es_MX",
  "currency_id": "MXN"
  },
  {
  "id": "PA",
  "name": "Panamá",
  "locale": "es_PA",
  "currency_id": "USD"
  },
  {
  "id": "PE",
  "name": "Peru",
  "locale": "es_PE",
  "currency_id": "PEN"
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
  "currency_id": "VEF"
  }
]
```

## Explorar información de un país

Consulta detalles de un país específico, como nombre, monedas y estados (provincias o regiones). Consulta los datos de un estado y sus ciudades asociadas. Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/countries/{Country_Id}
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/countries/AR
```

Respuesta:

```
{
    "id": "AR",
    "name": "Argentina",
    "locale": "es_AR",
    "site": "MLA",
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
        {
            "id": "TUxBUEJSQWwyMzA1",
            "name": "Brasil"
        },
        {
            "id": "TUxBUENPU2ExMmFkMw",
            "name": "Bs.As. Costa Atlántica"
        },
        {
            "id": "TUxBUEdSQWU4ZDkz",
            "name": "Bs.As. G.B.A. Norte"
        },
        {
            "id": "TUxBUEdSQWVmNTVm",
            "name": "Bs.As. G.B.A. Oeste"
        },
        {
            "id": "TUxBUEdSQXJlMDNm",
            "name": "Bs.As. G.B.A. Sur"
        },
        {
            "id": "QnVlbm9zIEFpcmVz",
            "name": "Buenos Aires"
        },
        {
            "id": "TUxBUFpPTmFpbnRl",
            "name": "Buenos Aires Interior"
        },
        {
            "id": "TUxBUENBUGw3M2E1",
            "name": "Capital Federal"
        },
        {
            "id": "TUxBUENBVGFiY2Fm",
            "name": "Catamarca"
        },
        {
            "id": "TUxBUENIQW8xMTNhOA",
            "name": "Chaco"
        },
        {
            "id": "Y2hpbGU=",
            "name": "Chile"
        },
        {
            "id": "TUxBUENIVXQxNDM1MQ",
            "name": "Chubut"
        },
        {
            "id": "TUxBUENPUnM5MjI0",
            "name": "Corrientes"
        },
        {
            "id": "TUxBUENPUmFkZGIw",
            "name": "Córdoba"
        },
        {
            "id": "TUxBUEVOVHMzNTdm",
            "name": "Entre Ríos"
        },
        {
            "id": "TUxBUEZPUmE1OTk5",
            "name": "Formosa"
        },
        {
            "id": "TUxBUEpVSnk3YmUz",
            "name": "Jujuy"
        },
        {
            "id": "TUxBUExBWmE1OWMy",
            "name": "La Pampa"
        },
        {
            "id": "TUxBUExBWmEyNzY0",
            "name": "La Rioja"
        },
        {
            "id": "TUxBUE1FTmE5OWQ4",
            "name": "Mendoza"
        },
        {
            "id": "TUxBUE1JU3MzNjIx",
            "name": "Misiones"
        },
        {
            "id": "TUxBUE5FVW4xMzMzNQ",
            "name": "Neuquén"
        },
        {
            "id": "UHJvdmlua2lhdmVvIGRlIEJ1ZW5vcyBBaXJl",
            "name": "Província de Buenos Aires"
        },
        {
            "id": "TUxBUFJFUDQyMjQ4Ng",
            "name": "República Dominicana"
        },
        {
            "id": "TUxBUFLNT29iZmZm",
            "name": "Río Negro"
        },
        {
            "id": "TUxBUFNBTGFjMTJi",
            "name": "Salta"
        },
        {
            "id": "TUxBUFNBTm5lYjU4",
            "name": "San Juan"
        },
        {
            "id": "TUxBUFNBTnM0ZTcz",
            "name": "San Luis"
        },
        {
            "id": "TUxBUFNBTno3ZmY5",
            "name": "Santa Cruz"
        },
        {
            "id": "TUxBUFNBTmU5Nzk2",
            "name": "Santa Fe"
        },
        {
            "id": "TUxBUFNBTm9lOTlk",
            "name": "Santiago del Estero"
        },
        {
            "id": "TUxBUFRJRVoxM2M5YQ",
            "name": "Tierra del Fuego"
        },
        {
            "id": "TUxBUFRVQ244NmM3",
            "name": "Tucumán"
        },
        {
            "id": "TUxBUFVTQWl1cXdlMg",
            "name": "USA"
        },
        {
            "id": "TUxBUFVSVXllZDVl",
            "name": "Uruguay"
        }
    ]
}
```

## Explorar información de un estado

Consulta los datos de un estado y sus ciudades asociadas. Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/states/{State_id}
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/states/TUxBUENBUGw3M2E1
```

Respuesta:

```
{
    "id": "TUxBUENBUGw3M2E1",
    "name": "Capital Federal",
    "country": {
        "id": "AR",
        "name": "Argentina"
    },
    "site": "MLA",
    "geo_information": {
        "location": {
            "latitude": -34.6143048,
            "longitude": -58.4401655
        }
    },
    "time_zone": "GMT-03:00",
    "time_zone_name": "America/Buenos_Aires",
    "cities": [
        {
            "id": "TUxBQ0NBUGZlZG1sYQ",
            "name": "Capital Federal"
        }
    ]
}
```

## Explorar información de una ciudad

Consulta detalles de una ciudad, sus barrios y datos geográficos. Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/cities/{City_id}
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/cities/TUxBQ0NBUGZlZG1sYQ
```

Respuesta:

```
{
    "id": "TUxBQ0NBUGZlZG1sYQ",
    "name": "Capital Federal",
    "site": "MLA",
    "state": {
        "id": "TUxBUENBUGw3M2E1",
        "name": "Capital Federal"
    },
    "country": {
        "id": "AR",
        "name": "Argentina"
    },
    "neighborhoods": [
        {
            "id": "TUxBQkFHUjk3NjJa",
            "name": "Agronomía"
        },
        {
            "id": "TUxBQkFMTTMwNTBa",
            "name": "Almagro"
        },
        {
            "id": "TUxBQkJBTDMxMDZa",
            "name": "Balvanera"
        },
        {
            "id": "TUxBQkJBUjM0MDha",
            "name": "Barracas"
        },
        {
            "id": "TUxBQkJBUjQwMDQ3MA",
            "name": "Barrio Norte"
        },
        {
            "id": "TUxBQkJFTDcyNTJa",
            "name": "Belgrano"
        },
        {
            "id": "TUxBQkJFTDkwNjNa",
            "name": "Belgrano Barrancas"
        },
        {
            "id": "TUxBQkJFTDk4MDRa",
            "name": "Belgrano C"
        },
        {
            "id": "TUxBQkJFTDU0ODda",
            "name": "Belgrano Chico"
        },
        {
            "id": "TUxBQkJFTDU5NzNa",
            "name": "Belgrano R"
        },
        {
            "id": "TUxBQkJPRTQ0OTRa",
            "name": "Boedo"
        },
        {
            "id": "TUxBQkJPVDQ2NTFa",
            "name": "Botánico"
        },
        {
            "id": "TUxBQkNBQjM4MDda",
            "name": "Caballito"
        },
        {
            "id": "TUxBQkNIQTM5NjBa",
            "name": "Chacarita"
        },
        {
            "id": "TUxBQkNPRzY5MTZa",
            "name": "Coghlan"
        },
        {
            "id": "TUxBQkNPTDI3NDNa",
            "name": "Colegiales"
        },
        {
            "id": "TUxBQkNPTjgyODY1Mg",
            "name": "Congreso"
        },
        {
            "id": "TUxBQkNPTjExMDBa",
            "name": "Constitución"
        },
        {
            "id": "TUxBQkZMTzMwNzRa",
            "name": "Flores"
        },
        {
            "id": "TUxBQkZMTzg5MjFa",
            "name": "Floresta"
        },
        {
            "id": "TUxBQkxBQjk1ODJa",
            "name": "La Boca"
        },
        {
            "id": "TUxBQkxBUzIxNTJa",
            "name": "Las Cañitas"
        },
        {
            "id": "TUxBQkxJTjEzNTha",
            "name": "Liniers"
        },
        {
            "id": "TUxBQk1BVDMwMDJa",
            "name": "Mataderos"
        },
        {
            "id": "TUxBQk1PTjUxOTJa",
            "name": "Monserrat"
        },
        {
            "id": "TUxBQk1PTjE2OTBa",
            "name": "Monte Castro"
        },
        {
            "id": "TUxBQk5VRTc3MTZa",
            "name": "Nueva Pompeya"
        },
        {
            "id": "TUxBQk7a0TcwOTRa",
            "name": "Núñez"
        },
        {
            "id": "TUxBQk9OQzM1Mjk5Ng",
            "name": "Once"
        },
        {
            "id": "TUxBQlBBTDI1MTVa",
            "name": "Palermo"
        },
        {
            "id": "TUxBQlBBTDg3OTha",
            "name": "Palermo Chico"
        },
        {
            "id": "TUxBQlBBTDg1NjJa",
            "name": "Palermo Hollywood"
        },
        {
            "id": "TUxBQlBBTDgwMjla",
            "name": "Palermo Nuevo"
        },
        {
            "id": "TUxBQlBBTDg3MDda",
            "name": "Palermo Soho"
        },
        {
            "id": "TUxBQlBBTDE5ODla",
            "name": "Palermo Viejo"
        },
        {
            "id": "TUxBQlBBUjQ1NDda",
            "name": "Parque Avellaneda"
        },
        {
            "id": "TVhYUGFycXVlIENlbnRlbmFyaW9UVXhCUTBOQ",
            "name": "Parque Centenario"
        },
        {
            "id": "TUxBQlBBUjUyOTZa",
            "name": "Parque Chacabuco"
        },
        {
            "id": "TVhYUGFycXVlIENoYXNUVXhCUTBOQlVHWmxaR",
            "name": "Parque Chas"
        },
        {
            "id": "TUxBQlBBUjYwMzZa",
            "name": "Parque Patricios"
        },
        {
            "id": "TUxBQlBBVDI0ODFa",
            "name": "Paternal"
        },
        {
            "id": "TUxBQlBVRTQ5NjBa",
            "name": "Puerto Madero"
        },
        {
            "id": "TVhYUHVlcnRvIFJldGlyb1RVeEJRME5CVUdab",
            "name": "Puerto Retiro"
        },
        {
            "id": "TUxBQlJFQzkyMTVa",
            "name": "Recoleta"
        },
        {
            "id": "TUxBQlJFVDgyMDVa",
            "name": "Retiro"
        },
        {
            "id": "TUxBQlNBQTM3Mzda",
            "name": "Saavedra"
        },
        {
            "id": "TUxBQlNBTjkwNTZa",
            "name": "San Cristóbal"
        },
        {
            "id": "TUxBQlNBTjgzMjRa",
            "name": "San Nicolás"
        },
        {
            "id": "TUxBQlNBTjgxMzNa",
            "name": "San Telmo"
        },
        {
            "id": "TUxBQlNBTjEyMjNa",
            "name": "Santa Rita"
        },
        {
            "id": "TUxBQlZFTDIwNDha",
            "name": "Velez Sarsfield"
        },
        {
            "id": "TUxBQlZFUjY3MDFa",
            "name": "Versalles"
        },
        {
            "id": "TUxBQlZJTDQyMjBa",
            "name": "Villa Crespo"
        },
        {
            "id": "TUxBQlZJTDYzNzZa",
            "name": "Villa Devoto"
        },
        {
            "id": "TUxBQlZJTDI1ODla",
            "name": "Villa Gral. Mitre"
        },
        {
            "id": "TUxBQlZJTDQ4MzBa",
            "name": "Villa Lugano"
        },
        {
            "id": "TUxBQlZJTDI3MDJa",
            "name": "Villa Luro"
        },
        {
            "id": "TUxBQlZJTDQyMjFa",
            "name": "Villa Ortúzar"
        },
        {
            "id": "TUxBQlZJTDE2MDBa",
            "name": "Villa Pueyrredón"
        },
        {
            "id": "TUxBQlZJTDM3Mzda",
            "name": "Villa Real"
        },
        {
            "id": "TUxBQlZJTDU5MTFa",
            "name": "Villa Riachuelo"
        },
        {
            "id": "TUxBQlZJTDM5MjZa",
            "name": "Villa Soldati"
        },
        {
            "id": "TUxBQlZJTDcwOTla",
            "name": "Villa Urquiza"
        },
        {
            "id": "TUxBQlZJTDc4MDda",
            "name": "Villa del Parque"
        }
    ],
    "geo_information": {
        "location": {
            "latitude": -34.6084175,
            "longitude": -58.3731613
        }
    }
}
```

## Explorar información de un barrio

Consulta los detalles de un barrio específico. Incluye información de país, estado, ciudad y coordenadas. Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/neighborhoods/{Neighborhood_Id}
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/classified_locations/neighborhoods/TUxBQkNBQjM4MDda
```

Respuesta:

```
{
    "id": "TUxBQkNBQjM4MDda",
    "name": "Caballito",
    "site": "MLA",
    "city": {
        "id": "TUxBQ0NBUGZlZG1sYQ",
        "name": "Capital Federal"
    },
    "state": {
        "id": "TUxBUENBUGw3M2E1",
        "name": "Capital Federal"
    },
    "country": {
        "id": "AR",
        "name": "Argentina"
    },
    "geo_information": {
        "location": {
            "latitude": -34.6166667,
            "longitude": -58.45
        }
    },
    "subneighborhoods": []
}
```

**Siguiente** : [Gestiona paquetes](https://developers.mercadolibre.com.ar/es_ar/vehiculos-gestiona-paquetes).
