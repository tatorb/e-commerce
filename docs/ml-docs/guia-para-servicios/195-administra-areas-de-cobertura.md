<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/administra-areas-de-cobertura -->
<!-- Sección: Guía para servicios -->

# Administra áreas de cobertura

Última actualización 15/03/2023

## Administra áreas de cobertura

Las áreas de cobertura permitirán saber a los usuarios si el servicio que estás ofreciendo llega a las áreas donde se encuentran. Debes enviar cada área con los ID preestablecidos que encontrarás en nuestra API.

## Áreas de cobertura por país

Para conocer los ID pertenecientes a las áreas de tu país, realiza una llamada mixta entre sites y agrega recursos de áreas de cobertura.

Ejemplo:

```
curl -X GET  -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/sites/MLA/coverage_areas
```

Respuesta:

```
[
   {
      "id":"TUxBUENBUGw3M2E1",
      "description":"Bs.As. Cap. Federal",
      "zone":"Capital Federal",
      "type":"state"
   },
   {
      "id":"TUxBUEdSQWU4ZDkz",
      "description":"Bs.As. G.B.A. Norte",
      "zone":"Gba Norte",
      "type":"state"
   },
   {
      "id":"TUxBUEdSQWVmNTVm",
      "description":"Bs.As. G.B.A. Oeste",
      "zone":"Gba Oeste",
      "type":"state"
   },
   {
      "id":"TUxBUEdSQXJlMDNm",
      "description":"Bs.As. G.B.A. Sur",
      "zone":"Gba Sur",
      "type":"state"
   },
   {
      "id":"TUxBUENPU2ExMmFkMw",
      "description":"Bs.As. Costa Atlántica",
      "zone":"Gba Costa Atlántica",
      "type":"state"
   },
   {
      "id":"TUxBUFpPTmFpbnRl",
      "description":"Bs.As. Zona Interior",
      "zone":"Buenos Aires",
      "type":"state"
   },
   {
      "id":"TUxBUENBVGFiY2Fm",
      "description":"Catamarca",
      "zone":"Catamarca",
      "type":"state"
   },
   {
      "id":"TUxBUENIQW8xMTNhOA",
      "description":"Chaco",
      "zone":"Chaco",
      "type":"state"
   },
   {
      "id":"TUxBUENIVXQxNDM1MQ",
      "description":"Chubut",
      "zone":"Chubut",
      "type":"state"
   },
   {
      "id":"TUxBUENPUmFkZGIw",
      "description":"Córdoba",
      "zone":"Córdoba",
      "type":"state"
   },
   {
      "id":"TUxBUENPUnM5MjI0",
      "description":"Corrientes",
      "zone":"Corrientes",
      "type":"state"
   },
   {
      "id":"TUxBUEVOVHMzNTdm",
      "description":"Entre Ríos",
      "zone":"Entre Ríos",
      "type":"state"
   },
   {
      "id":"TUxBUEZPUmE1OTk5",
      "description":"Formosa",
      "zone":"Formosa",
      "type":"state"
   },
   {
      "id":"TUxBUEpVSnk3YmUz",
      "description":"Jujuy",
      "zone":"Jujuy",
      "type":"state"
   },
   {
      "id":"TUxBUExBWmE1OWMy",
      "description":"La Pampa",
      "zone":"La Pampa",
      "type":"state"
   },
   {
      "id":"TUxBUExBWmEyNzY0",
      "description":"La Rioja",
      "zone":"La Rioja",
      "type":"state"
   },
   {
      "id":"TUxBUE1FTmE5OWQ4",
      "description":"Mendoza",
      "zone":"Mendoza",
      "type":"state"
   },
   {
      "id":"TUxBUE1JU3MzNjIx",
      "description":"Misiones",
      "zone":"Misiones",
      "type":"state"
   },
   {
      "id":"TUxBUE5FVW4xMzMzNQ",
      "description":"Neuquén",
      "zone":"Neuquén",
      "type":"state"
   },
   {
      "id":"TUxBUFLNT29iZmZm",
      "description":"Río Negro",
      "zone":"Río Negro",
      "type":"state"
   },
   {
      "id":"TUxBUFNBTGFjMTJi",
      "description":"Salta",
      "zone":"Salta",
      "type":"state"
   },
   {
      "id":"TUxBUFNBTm5lYjU4",
      "description":"San Juan",
      "zone":"San Juan",
      "type":"state"
   },
   {
      "id":"TUxBUFNBTnM0ZTcz",
      "description":"San Luis",
      "zone":"San Luis",
      "type":"state"
   },
   {
      "id":"TUxBUFNBTno3ZmY5",
      "description":"Santa Cruz",
      "zone":"Santa Cruz",
      "type":"state"
   },
   {
      "id":"TUxBUFNBTmU5Nzk2",
      "description":"Santa Fe",
      "zone":"Santa Fe",
      "type":"state"
   },
   {
      "id":"TUxBUFNBTm9lOTlk",
      "description":"Santiago del Estero",
      "zone":"Santiago Del Estero",
      "type":"state"
   },
   {
      "id":"TUxBUFRJRVoxM2M5YQ",
      "description":"Tierra del Fuego ",
      "zone":"Tierra Del Fuego",
      "type":"state"
   },
   {
      "id":"TUxBUFRVQ244NmM3",
      "description":"Tucumán",
      "zone":"Tucumán",
      "type":"state"
   },
   {
      "id":"AR",
      "description":"Argentina",
      "zone":"Todo el País",
      "type":"country"
   }
]
```

## Áreas de cobertura por ID

Accede a los detalles sobre un área específica.

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/coverage_areas/TUxBUEpVSnk3YmUz
```

Respuesta:

```
{
   "id":"TUxBUEpVSnk3YmUz",
   "description":"Jujuy",
   "zone":"Jujuy",
   "type":"state"
}
```

## Agrega áreas de cobertura

Para agregar áreas de cobertura a una publicación existente, simplemente realiza una solicitud PUT a la API de artículos con el siguiente JSON.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -H "Accept: application/json" -d
{
coverage_areas: ["TUxBUExBWmEyNzY0","TUxBUEpVSnk3YmUz"]
}
https://api.mercadolibre.com/items/ITEM_ID
```

**Siguiente:**  [Publica servicios.](https://developers.mercadolibre.com.ar/es_ar/publica-servicios)
