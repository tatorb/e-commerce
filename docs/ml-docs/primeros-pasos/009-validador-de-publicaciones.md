<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/validador-de-publicaciones -->
<!-- Sección: Primeros pasos -->

# Validador de publicaciones

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Validador de publicaciones

Como sabemos que a veces necesitas más de un intento para realizar tu publicación, te ofrecemos la posibilidad de consultar si tu publicación quedó exactamente como la querías antes de publicarla. El recurso de items ofrece un servicio de validación para controlar los detalles de tu publicación antes de publicarla. ¡Úsala para practicar hasta que lo logres!

## Ejemplos de validación

Veamos un ejemplo de cómo funciona. Supongamos que envías este JSON:

Ejemplo:

```
{
"seller_id":,
"id",
"price":"p",
"seller_contact":null,
"pictures": [[1,2,3]]
}
```

A este url:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/validate
```

Como resultado, recibirás una descripción exacta de las mejoras que debes implementar en tu JSON para publicar con éxito un artículo:

```
{
"message":"body.invalid_field_types",
"error":"[invalid property type: [price] expected Number but was String value: p,
invalid property type: [seller_contact] expected Map but was Null value: null,
invalid property type: [pictures[0]] expected Map but was JSONArray value: [1, 2, 3],
invalid property type: [seller_id] expected Number but was String value: id]",
   "status":400,
   "cause":[

   ]
}
```

### Valida tu artículo

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d'{
  "title":"Teacup",
  "category_id":"MLA1902",
  "price":10,
  "currency_id":"ARS",
  "available_quantity":1,
  "buying_mode":"buy_it_now",
  "listing_type_id":"bronze",
  "condition":"new",
  "description": "Item:, Teacup Model: 1. Size: 5cm. Color: White. New in Box",
  "video_id": "YOUTUBE_ID_HERE",
  "pictures":[
    {"source":"http://upload.wikimedia.org/wikipedia/commons/e/e9/Tea_Cup.jpg"}
  ]
}' https://api.mercadolibre.com/items/validate
```

### Valida un artículo con variaciones

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d '{
   "title":"Short",
   "category_id":"MLA126455",
   "price":10,
   "currency_id":"ARS",
   "buying_mode":"buy_it_now",
   "listing_type_id":"bronze",
   "condition":"new",
   "description": "Short with variations",
   "variations":[
  	{
      "attribute_combinations":[
    	{
          "id":"93000",
          "value_id":"101993"
    	},
    	{
          "id":"83000",
          "value_id":"91993"
    	}
  	],
  	"available_quantity":1,
  	"price":10,
  	"picture_ids":[
          "http://bttpadel.es/image/cache/data/ARTICULOS/PROVEEDORES/BTTPADEL/BERMUDA%20ROJA-240x240.jpg"
  	]
  	},
  	{
      "attribute_combinations":[
        {
          "id":"93000",
          "value_id":"101995"
    	},
            	{
          "id":"83000",
          "value_id":"92013"
    	}
  	],
  	"available_quantity":1,
  	"price":10,
  	"picture_ids":[
      	"http://www.forumsport.com/img/productos/299x299/381606.jpg"
  	]
  	}
   ]
}' https://api.mercadolibre.com/items/validate
```

### Valida tu artículo inmueble

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d' {
  "site_id": "MLA",
  "title": "Propiedad en Alquiler, Item de Testeo, Por favor, no ofertar",
  "category_id": "MLA52745",
  "price": 5000,
  "currency_id": "ARS",
  "available_quantity": 1,
  "buying_mode": "classified",
  "listing_type_id": "silver",
  "condition": "not_specified",
  "pictures": [
	{
      "source":"http://farm3.staticflickr.com/2417/2176897085_946b7b66b8_b.jpg"
	},
	{
      "source":"http://farm2.staticflickr.com/1056/628680053_3b7c315548_b.jpg"
	}
  ],
  "seller_contact": {
	"contact": "Pepe",
	"other_info": "Additional contact info",
	"area_code": "011",
	"phone": "4444-5555",
	"area_code2": "",
	"phone2": "",
	"email": "contact-email@somedomain.com",
	"webmail": ""
  },
  "location": {
	"address_line": "My property address 1234",
	"zip_code": "1111",
	"neighborhood": {
  	"id": "TUxBQlBBUzgyNjBa"
	},
	"latitude": -34.48755,
	"longitude": -58.56987,
  },
  "attributes": [
	{
  	"id": "MLA50547-AMBQTY",
  	"value_id": "MLA50547-AMBQTY-1"
	},
	{
  	"id": "MLA50547-ANTIG",
  	"value_id": "MLA50547-ANTIG-A_ESTRENAR"
	},
	{
  	"id": "MLA50547-MTRS",
  	"value_name": "500"
	},
	{
  	"id": "MLA50547-SUPTOTMX",
  	"value_name": "2000"
	},
	{
  	"id": "MLA50547-BATHQTY",
  	"value_id": "MLA50547-BATHQTY-1"
	},
	{
  	"id": "MLA50547-DORMQTYB",
  	"value_id": "MLA50547-DORMQTYB-3"
	},
	{
  	"id": "MLA50547-EDIFIC",
  	"value_id": "MLA50547-EDIFIC-CHALET"
	}
  ],
   "description" : "This is the real estate property description."
}' https://api.mercadolibre.com/items/validate
```

## Referencia de códigos de error

Si la publicación es correcta recibirás un mensaje “HTTP/1.1 204 No Content” [HTTP/1.1 204 No Content] o los correspondientes errores como vimos en los ejemplos anteriores.

Importante:

Para ver el mensaje “HTTP/1.1 204 No Content” utilizando curl deberás agregar el parámetro -i.

## Consideraciones

Si bien este proceso de validación no es obligatorio, es muy probable que sea de utilidad al probar tu Aplicación. Recuerda que no existe sandbox ni entorno de preproducción, por eso todos los artículos publicados durante tu fase de pruebas serán visibles para cada uno de los usuarios que naveguen en nuestro mercado. Por favor, consulta nuestro tutorial [Realiza pruebas](https://developers.mercadolibre.com.ar/es_ar/realiza-pruebas) para conocer las particularidades y mejores prácticas al iniciar el proceso.

**Siguiente** : [Consulta API Docs](https://developers.mercadolibre.com.ar/es_ar/api-docs-es).
