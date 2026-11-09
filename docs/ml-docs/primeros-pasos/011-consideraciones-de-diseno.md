<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/consideraciones-de-diseno -->
<!-- Sección: Primeros pasos -->

# Consideraciones de diseño

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Consideraciones de diseño

Al momento de comenzar a trabajar con nuestra API, deberás tener en cuenta algunos conceptos básicos.

## Formato JSON

El formato JSON es un estándar abierto basado en texto ligero diseñado para el intercambio de datos legibles. Podrás leer este tipo de mensajes a través de un navegador, herramientas específicas (Ej: Postman) o desde cualquier desarrollo que consuma la API de Mercado Libre.

## Uso de JSONP

Si incluyes un parámetro callback, la API responderá con JSONP. El valor de este parámetro se utilizará como la función de callback. 
Ejemplo:

```
curl -X GET https://api.mercadolibre.com/currencies/ARS
```

Respuesta:

```
{
  "id": "ARS",
  "description": "Peso argentino",
  "symbol": "$",
  "decimal_places": 2,
}
```

Para una respuesta JSONP, agrega un parámetro callback como éste:

```
curl -X GET https://api.mercadolibre.com/currencies/ARS?callback=foo
```

Respuesta:

```
foo
( [ 200, {
  "Content-Type": ["text/javascript;charset=UTF-8"],
  "Cache-Control": ["max-age=3600,stale-while-revalidate=1800, stale-if-error=7200"]
}, {
  "id": "ARS",
  "symbol": "$",
  "description": "Peso argentino",
  "decimal_places": 2
} ] )
```

Como puedes ver, la respuesta es un conjunto de 3 valores:

- Código de estado HTTPS

- Encabezados de respuesta HTTPS

- Cuerpo de la respuesta

Todas las respuestas JSONP siempre serán 200 OK. El propósito es darte la posibilidad de manejar respuestas 30X, 40X y 50X.

## Manejo de errores

El formato estándar de un error es el siguiente:

```
{
  "message": "human readable text",
  "error": "machine_readable_error_code",
  "status": 400,
  "cause": [ ],
}
```

## Reducción de respuestas

Para contar con respuestas más breves, con menos datos, puedes agregar el parámetro atributos con una coma separando la lista de campos que se deberían incluir en la respuesta. Todos los demás campos de la respuesta original se ignorarán.

```
curl -X GET https://api.mercadolibre.com/currencies?attributes=id
[
  {
  "id": "BRL"
  },
  {
  "id": "UYU"
  },
  {
  "id": "CLP"
  },
  ...
]
```

## Uso de OPCIONES

La API entregará documentación en formato JSON utilizando OPTIONS.

```
curl -X OPTIONS https://api.mercadolibre.com/currencies
{
  "name":"Monedas",
    "description":"Devuelve información correspondiente al ISO de las monedas que se usan en MercadoLibre.",
  "attributes": {
     "id":"ID de la moneda (Código ISO)",
        "description":"Denominación oficial de la moneda",
      "symbol":"Símbolo ISO para representar la moneda",
        "decimal_places":"Número de decimales manejados con la moneda"
  },
  "methods": [
     {
            "method":"GET",
            "example":"/currencies/",
            "description":"Devuelve el listado con todas las monedas."
      },
      {
            "method":"GET",
            "example":"/currencies/:id",
          "description":"Devuelve información con respecto a una moneda específica."
      }
  ],
  "related_resources":[],
  "connections": {
        "id":"/currencies/:id"
  }
}
```

## Paginación de resultados

Puedes definir el tamaño de página de la lista de resultados. Existen 2 parámetros: limit y offset. Ambos parámetros definen el bloque de tamaño de los resultados. Este artículo se basa en el ejemplo de búsqueda, pero puedes utilizar paginación en cada recurso que se presente en la información de respuesta sobre "paginación", según se muestra a continuación:

```
.....
  "paging": {
  "total": 285,
  "offset": 0,
  "limit": 50,
  }
  .....
```

### Valores por defecto

Los valores por defecto son offset=0 y limit=50.

```
curl https://api.mercadolibre.com/sites/MLA/search?q=ipod nano
```

En la sección de paginación de la respuesta JSON, puedes ver la cantidad total de artículos que coinciden con la búsqueda y el valor de offset con el limit por defecto aplicado.

```
.....
  "paging": {
  "total": 285,
  "offset": 0,
  "limit": 50,
  }
  .....
```

### Limit

Para reducir el tamaño de página, puedes cambiar el parámetro de limit. Por ejemplo, si estás interesado en recuperar solo los primeros 3 artículos:

```
curl https://api.mercadolibre.com/sites/MLA/search?q=ipod nano&limit=3
```

Esta acción recupera un dato JSON con un conjunto de 3 artículos, como se ilustra a continuación:

```
{
  "site_id": "MLA",
  "query": "ipod nano",
  "paging": {
  "total": 284,
  "offset": 0,
  "limit": 3,
  },
  "results": [
  {...},
  {...},
  {...},
  ],
  "sort": {...},
  "available_sorts": [...],
  "filters": [...],
  "available_filters": [...],
}
```

### Offset

Al utilizar el atributo offset, puedes mover el limit inferior del bloque de resultados. Por ejemplo, si te interesa recuperar los 50 artículos que siguen la respuesta por defecto:

```
curl https://api.mercadolibre.com/sites/MLA/search?q=ipod nano&offset=50
{
  "site_id": "MLA",
  "query": "ipod nano",
  "paging": {
  "total": 285,
  "offset": 50,
  "limit": 50,
  },
  "results": [...],
  "sort": {...},
  "available_sorts": [...],
  "filters": [...],
  "available_filters": [...],
}
```

Esta respuesta recupera 50 artículos a partir de los primeros cincuenta.

### Definir un rango de resultados

Es posible combinar ambos parámetros. Puedes recuperar artículos desde el tercero al sexto en el resultado de búsqueda original:

```
curl https://api.mercadolibre.com/sites/MLA/search?q=ipod nano&offset=3&limit=3
```

Esta acción recupera un dato JSON con un conjunto de 5 artículos, como se ilustra a continuación:

```
{
  "site_id": "MLA",
  "query": "ipod nano",
  "paging": {
  "total": 285,
  "offset": 3,
  "limit": 3,
  },
  "results": [
  {...},
  {...},
  {...},
  ],
  "sort": {...},
  "available_sorts": [...],
  "filters": [...],
  "available_filters": [...],
}
```

**Siguiente:**  [Registra tu aplicación](https://developers.mercadolibre.com.ar/es_ar/registra-tu-aplicacion).
