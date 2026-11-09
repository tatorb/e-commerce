<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/importar-catalogo -->
<!-- Sección: Guía para Proximity > Gestión de Catalogo -->

# Importar Catálogo Foods

Última actualización 13/10/2026

## Importar catálogo Foods

Nota:

Al insertar los IDs de las tiendas que recibirán el catálogo, se deben insertar los `externals_ids`. El ID externo de una tienda se puede configurar a través del endpoint [Modificar ID externo de la sucursal](https://developers.mercadolibre.com.ar/es_ar/modificar-id-externo-de-la-sucursal).

Importante:

Debido a que el proceso de carga del catálogo es asíncrono, se debe usar el endpoint [Consultar estado de publicación](https://developers.mercadolibre.com.ar/es_ar/consultar-el-estado-de-la-publicacion) para verificar si el catálogo se importó correctamente. Si hay un error en la validación de esta publicación, recomendamos implementar un mecanismo de reintentos.

## Llamada

```
curl -X POST \
    'https://api.mercadopago.com/proximity/integration/v1/catalog' \
    -H 'Content-Type: application/json' \
    -H 'Authorization: Bearer $ACCESS_TOKEN' \
    -d '{
    "store_ids": [
        "EXTERNAL-ID"
    ],
    "sections": [
        {
            "description": "Descripción de la sección",
            "name": "Promociones",
            "items": [
                {
                    "description": "Descripción del combo promocional.",
                    "external_id": "cajita-nuggets-combo-cuarto-xl",
                    "image": "https://example.com/image.jpg",
                    "name": "Combo Familiar",
                    "price": 10000.0,
                    "discount_price": 0.0,
                    "status": "active",
                    "options": [
                        {
                            "name": "Selecciona tu plato principal",
                            "group_min": 1,
                            "group_max": 1,
                            "complements": [
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "cuarto-xl-001",
                                    "image": null,
                                    "min": 0,
                                    "max": 1,
                                    "name": "Plato Principal A",
                                    "price": 0.0,
                                    "status": "active"
                                }
                            ]
                        },
                        {
                            "name": "Selecciona tu menú infantil",
                            "group_min": 1,
                            "group_max": 1,
                            "complements": [
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "cajita-nuggets-001",
                                    "image": null,
                                    "min": 0,
                                    "max": 1,
                                    "name": "Menú Infantil A",
                                    "price": 0.0,
                                    "status": "active"
                                }
                            ]
                        },
                        {
                            "name": "Elegí tu bebida",
                            "group_min": 2,
                            "group_max": 2,
                            "complements": [
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "bebida-coca-original",
                                    "image": null,
                                    "min": 0,
                                    "max": 2,
                                    "name": "Bebida A",
                                    "price": 0.0,
                                    "status": "active"
                                },
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "bebida-coca-zero",
                                    "image": null,
                                    "min": 0,
                                    "max": 2,
                                    "name": "Bebida B",
                                    "price": 0.0,
                                    "status": "active"
                                },
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "bebida-fanta",
                                    "image": null,
                                    "min": 0,
                                    "max": 2,
                                    "name": "Bebida C",
                                    "price": 0.0,
                                    "status": "active"
                                },
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "bebida-sprite",
                                    "image": null,
                                    "min": 0,
                                    "max": 2,
                                    "name": "Bebida D",
                                    "price": 0.0,
                                    "status": "active"
                                },
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "bebida-sprite-zero",
                                    "image": null,
                                    "min": 0,
                                    "max": 2,
                                    "name": "Bebida E",
                                    "price": 0.0,
                                    "status": "active"
                                }
                            ]
                        },
                        {
                            "name": "Selecciona el acompañamiento",
                            "group_min": 2,
                            "group_max": 2,
                            "complements": [
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "acomp-papas-regulares",
                                    "image": null,
                                    "min": 0,
                                    "max": 2,
                                    "name": "Acompañamiento A",
                                    "price": 0.0,
                                    "status": "active"
                                }
                            ]
                        },
                        {
                            "name": "Selecciona el regalo",
                            "group_min": 1,
                            "group_max": 1,
                            "complements": [
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "juguete-perro",
                                    "image": null,
                                    "min": 0,
                                    "max": 1,
                                    "name": "Regalo A",
                                    "price": 0.0,
                                    "status": "active"
                                },
                                {
                                    "description": "Descripción del complemento.",
                                    "external_id": "juguete-gato",
                                    "image": null,
                                    "min": 0,
                                    "max": 1,
                                    "name": "Regalo B",
                                    "price": 0.0,
                                    "status": "active"
                                }
                            ]
                        }
                    ]
                }
            ]
        }
    ]
}'
```

### Respuesta

```
{
  "msg": "Success",
  "results": [
    {
      "store_id": "EXTERNAL-ID",
      "catalog_id": "b2f6b992-5133-11ed-a81f-acde48001122",
      "status": "processing"
    }
  ]
}
```

## Códigos de Respuesta

| Código | Descripción |
| --- | --- |
| **202**  - Success | Todas las solicitudes se enviaron correctamente. |
| **206**  - Partial Error | Alguna solicitud no fue enviada correctamente y contiene un error. |

## Parámetros de Request

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **Authorization**  (obligatorio) | string | Access Token obtenido a través del panel de desarrollador. Obligatorio ser enviado en todas las solicitudes. |

### Body

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **store_ids** | array | Array que recibe los `external_ids` de las tiendas que deben recibir el catálogo. |
| **sections** | array | Array de objetos que contienen información sobre las secciones que deben importarse al catálogo.  **name**  (string): Nombre de la sección. **description**  (string): Descripción de la sección. **items**  (array): Array de ítems de la sección.  **name**  (string): Nombre del ítem. **description**  (string): Descripción del ítem. **external_id**  (string): ID externo del ítem (SKU). **Cada item debe tener un id único.**  **image**  (string): URL de la imagen del ítem. **price**  (number): Precio del ítem. Debe ser mayor a 200. **discount_price**  (number): Precio con descuento del ítem. **status**  (string): Estado del ítem (`active` o `paused`). **options**  (array): Array de opciones/complementos.  **name**  (string): Nombre del grupo de opciones. **group_min**  (number): Cantidad mínima de complementos que el cliente debe seleccionar del grupo. **group_max**  (number): Cantidad máxima de complementos que el cliente puede seleccionar del grupo. **complements**  (array): Array de complementos individuales.  **name**  (string): Nombre del complemento. **description**  (string): Descripción del complemento. **external_id**  (string): ID externo del complemento. **Cada item debe tener un id único** . **image**  (string): URL de la imagen del complemento. **min**  (number): Cantidad mínima de este complemento específico. **Debe ser `0`**  (ver nota abajo). **max**  (number): Cantidad máxima de este complemento específico. Debe ser menor o igual a `group_max`. **price**  (number): Precio del complemento. **status**  (string): Estado del complemento (`active` o `paused`). |

Importante - Configuración de complementos:

La suma de los valores

`min`

de todos los complementos individuales

**nunca debe exceder**

el valor de

`group_max`

.

**Regla de configuración:**

- Cuando el grupo es obligatorio (`group_min > 0`), significa que el cliente debe elegir al menos una opción del grupo.

- En este caso, cada complemento individual debe configurarse con `min: 0` para indicar que la obligatoriedad recae en el **grupo** , no en cada ítem individual.

- El valor `max` de cada complemento debe ser **menor o igual**  a `group_max`.

**Ejemplo correcto:**

Un grupo con

`group_min: 1`

y

`group_max: 3`

indica que el cliente

debe

elegir entre 1 y 3 complementos del grupo. Cada complemento dentro de ese grupo debe tener

`min: 0`

, delegando la obligatoriedad al grupo. El sistema interpreta que "elegir algo es obligatorio" porque

`group_min: 1`

, pero

cuál

complemento elegir es decisión del cliente.

## Parámetros de Response

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **msg** | string | Descripción del resultado de la operación. |
| **results** | array | Array de resultados de publicación por tienda.  **store_id**  (string): ID externo de la tienda. **catalog_id**  (string): ID del catálogo generado para verificar el estado del proceso. **status**  (string): Estado del proceso (`processing`). |

## Errores

| Código de Error | Descripción |
| --- | --- |
| **400** | Error de publicación causado por alguna inconsistencia en los campos. |
| **404** | No se encontró una tienda asociada al identificador enviado. |

### Error 404

```
{
  "message": "Store not found: 122",
  "status": 404
}
```

Cómo resolverlo:

Este error indica que no se encontró una tienda asociada al identificador informado. Puede ocurrir si la tienda no tiene configurado su `external_id` o si todavía no está habilitada para publicar el catálogo. Verificá que el `external_id` enviado corresponda a una tienda existente y que esta se encuentre lista para operar. Si necesitás configurarlo, consultá el endpoint [**Modificar ID externo de la sucursal**](https://developers.mercadolibre.com.ar/es_ar/modificar-id-externo-de-la-sucursal). Una vez corregida la configuración, podés reintentar la solicitud.

**Siguiente** : [Consultar estado de publicación](https://developers.mercadolibre.com.ar/es_ar/consultar-el-estado-de-la-publicacion)
