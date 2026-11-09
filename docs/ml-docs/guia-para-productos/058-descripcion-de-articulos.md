<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos -->
<!-- Sección: Guía para productos -->

# Descripción de productos

Última actualización 13/03/2026

## Descripción de productos

La descripción de una publicación contiene información sobre el producto y sirve para complementar lo detallado en la [ficha técnica](https://developers.mercadolibre.com.ar/es_ar/atributos). Recuerda que esta le permitirá al comprador encontrar, de una forma rápida, todas las especificaciones que caracterizan a los productos. Consulta más [detalles sobre cómo describir un producto](https://ayuda.mercadolibre.com.ar/ayuda/completar_datos_productos_3147).

## Consejos para describir una publicación

- Primero carga los datos importantes en la ficha técnica, es decir todas las especificaciones sin olvidar el código universal de producto.

- Verifica que los datos que vas a escribir en la descripción sean los detalles que no están en la ficha técnica.

- Jerarquiza la información para que quede bien organizada. Utiliza mayúsculas, guiones, espaciado, etc.

- Sé breve y realiza una lectura de tu propia descripción para comprobar su longitud.

## Consultar descripción de un ítem

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/description
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLA935110000/description
```

Respuesta:

```
{
   "text": "",
   "plain_text": "Compendio de Anatomía y Disección. H. Rouviere. 1986. Salvat Editores SA. Sin uso.",
   "last_updated": "2021-08-20T02:07:27.000Z",
   "date_created": "2021-08-20T02:07:27.000Z",
   "snapshot": {...}
}
```

## Crear descripción en un ítem

Una vez creado el ítem, puedes cargar su descripción realizando el siguiente POST. Recuerda que debe ser texto plano y no cambiar las fuentes, tamaños ni marcar textos en negrita. Solo puedes realizar saltos de línea de la siguiente forma: \n .

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
   "plain_text":"Descripción con Texto Plano  \n"
}
https://api.mercadolibre.com/items/$ITEM_ID/description
```

Al intentar realizar un POST con descripción en una publicación que ya la tiene, recibirás un error bad request y deberás [editar una descripción existente](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos#Reemplaza-una-descripcion-existente).

## Beneficios del texto plano

- Tendrán un mejor resultado en las búsquedas.

- Las descripciones se descargarán 5 veces más rápido.

- Se verán correctamente en todos los dispositivos (móviles, computadoras, tablets).

- Podrás cargar hasta 10 fotos del producto y/o un link con un video de Youtube.

A continuación te mostraremos un ejemplo sobre la mejor práctica para a armar la descripción:

**Producto:**  “Raqueta Babolat Pure Control 3” [su_custom_gallery source="media: 10252" limit="1" link="lightbox" width="870" height="890"]

Notas:

- Tanto los medios de pago como de envíos que desees utilizar podrán ser añadidos en la VIP.
- Si en una publicación deseas mostrar todas las variantes del ítem, manteniendo incluso stock diferencial por cada una, te alentamos a que utilices [características personalizadas](https://developers.mercadolibre.com.ar/es_ar/variaciones#Caracter%C3%ADstica-personalizada).

## Editar descripción existente

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
   "plain_text":"Los mejores Rayban Wayfarer. Test."
}
https://api.mercadolibre.com/items/$ITEM_ID/description?api_version=2
```

## Errores

**Publicando una descripción**

En caso que realices un POST creando una descripción que contenga algún caracter no aceptado, la respuesta contendrá más información acerca del error, como la posición del carácter equivocado.

Ejemplo:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
   "plain_text":"Texto < br > 😀"
}
https://api.mercadolibre.com/items/$ITEM_ID/description
```

En la respuesta identificas los errores (posición 12):

```
{
   "message":"Validation error",
   "error":"validation_error",
   "status":400,
   "cause":[
      {
         "department":"items",
         "cause_id":398,
         "type":"error",
         "code":"item.description.type.invalid",
         "references":[
            "plain_text[12]"
         ],
         "message":"The description must be in plain text"
      }
   ]
}
```

### Modificando una descripción existente

```
curl -X PUT -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d
{
   "plain_text":"< br > 😀"
}
https://api.mercadolibre.com/items/$ITEM_ID/description?api_version=2
```

Para que la respuesta devuelva la posición del carácter que genera error, debes agregar el parámetro api_version=2.

El error será:

```
{
    "message": "Validation error",
    "error": "validation_error",
    "status": 400,
    "cause": [
        {
            "department": "items",
            "cause_id": 398,
            "type": "error",
            "code": "item.description.type.invalid",
            "references": [
                "plain_text[7]"
            ],
            "message": "The description must be in plain text"
        }
    ]
}
```

En el nodo references puedes obtener la ubicación exacta del caracter que genera el error. En este caso 7.
