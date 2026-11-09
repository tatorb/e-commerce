<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/dias-no-laborables -->
<!-- Sección: Guía para productos > Envíos > Mercado Envíos 2 -->

# Envíos en feriados opcionales

Última actualización 24/02/2025

## Envíos en feriados opcionales

El recurso de Envíos en feriados opcionales permite al vendedor configurar los días, predefinidos por Mercado Libre, donde no van a trabajar y así no tener impacto en la reputación.

## Listar días no laborables

Los días no laborables pueden ser obtenidos a través de la siguiente llamada:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipping/seller/$SELLER_ID/working_day_middleend
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipping/seller/12345678/working_day_middleend
```

Respuesta:

```
{
    "dates": [
     {
      "finalized": false,
      "closed": false,
      "enabled": true,
      "checked": false,
      "description": "Día del perdón",
      "date": "2022-09-26", 
     },
     {
      "finalized": false,
      "closed": false,
      "enabled": true,
      "checked": false,
      "description": "Día del perdón",
      "date": "2022-09-27" 
     }
   ]
 }
 
```

**Campos de respuesta:**

- **finalized** : indica que el día no laboral ya finalizó.

- **closed** : indica si se habilita ese día en su página de configuración.

- **enabled** : indica si se debe mostrar habilitado o no el día no laboral.

- **checked** : indica si el checkbox debe estar tildado o no.

- **description** : nombre del día no laborable.

- **date** : fecha en formato yyyy-mm-dd del día no laboral.

## Actualizar día no laboral

Para actualizar el día no laboral, debes realizar la siguiente llamada:

Llamada:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipping/seller/$SELLER_ID/working_day_middleend

    {
       "site_id": "MLA",
       "dates":[
        {
         "checked": true,
         "description": "Día del perdón",
         "date": "2022-09-26"
        },
        {
         "checked": true,
         "description": "Día del perdón",
         "date": "2022-09-27"
        }
      ]
    }    
```

Respuesta **Status 200 OK:**

```
"all working days were saved"
```

**Campos de respuesta:**

- **checked** : caso sea true, el seller no trabaja en el día.

- **description** : nombre del día no laborable.

- **date** : fecha en formato yyyy-mm-dd del día no laboral.

## Buscar por día no laboral

Conociendo la fecha, es posible hacer una búsqueda por el día no laboral. Para esto debes realizar la siguiente llamada:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipping/seller/$SELLER_ID/working_day_middleend/optout?date=AAAA-MM-DD
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipping/seller/$SELLER_ID/working_day_middleend/optout?date=2022-10-17
```

Respuesta:

```
{
    "dates": [
       {
        "description": "Día del perdón",
        "date": "2022-09-26", 
       }
    ]
    }
```

Si el vendedor no tiene ningún día configurado, el recurso devuelve una respuesta vacía con status 200 en la llamada.

En caso de no conocer el día no laboral, con el mismo recurso (sin usar el parámetro date), puedes conocer los días no laborales configurados por el vendedor.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/shipping/seller/$SELLER_ID/working_day_middleend/optout
```

Respuesta:

```
{
    "dates": [
       {
        "description": "Día del perdón",
        "date": "2022-09-26", 
       }
    ]
    }
```
