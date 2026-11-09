<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/pasos-rapidos-para-publicar-un-inmueble-de-prueba -->
<!-- Sección: Guía para inmuebles -->

# Pasos rápidos para publicar un inmueble de prueba

Última actualización 05/01/2026

## Pasos Rápidos para Publicar un Inmueble de Prueba

Antes de iniciar, te dejamos la [Guía para inmuebles](https://developers.mercadolibre.com.ar/es_ar/introduccion-guia-de-inmuebles)

## 1. Crea un usuario de prueba: experimenta sin costo

Para familiarizarte con el proceso de publicación de inmuebles y probar la API sin incurrir en costos reales, te recomendamos crear un usuario de prueba.

- Utiliza nuestra [API de Usuarios de Prueba](https://developers.mercadolibre.cl/es_ar/realiza-pruebas): para generar un usuario con credenciales falsas que podrás usar para realizar pruebas en un entorno seguro y controlado.

## 2.Configura tu usuario de prueba como inmobiliaria

Una vez que hayas creado tu usuario de prueba, puedes configurarlo como una cuenta de inmobiliaria. Esto te permitirá probar las funcionalidades específicas que Mercadolibre ofrece a las inmobiliarias.

**Para registrar tu usuario de prueba como inmobiliaria, sigue estos pasos:**

1. Accede al sitio de MercadoLibre correspondiente al país en el que estás trabajando utilizando las credenciales (usuario y contraseña) que generaste para tu usuario de prueba.

2. Regístrate como empresa inmobiliaria: Busca y sigue las instrucciones indicadas en el apartado **Registrarme como inmobiliaria**  (opcional) en esta [guía](https://developers.mercadolibre.com.ar/es_ar/consulta-de-usuarios#:~:text=consulta%20de%20usuarios.-,Registrarte%20como%20inmobiliaria%20(opcional),-Si%20eres%20una).

3. Contacta a nuestro equipo: pide la activación como empresa de tu usuario de prueba mediante este [formulario](https://docs.google.com/forms/d/e/1FAIpQLSeuq9lWo7ax0var28sVSEC8J-Rd-yqCUtYXEa-vozx3k2krbA/viewform) seleccionando la opción de activar usuario.

Este paso **es obligatorio**  para que puedas explorar todas las opciones disponibles para la publicación de inmuebles si eres una inmobiliaria.

## 3.Contrata un paquete de publicaciones (promotion pack)

Cuando recibas la confirmación de que activamos tu usuario desde el canal de soporte, tienes que contratar un paquete de publicaciones para que puedas publicar inmuebles.

**Importante:**

Asegúrate de no generar cargos en tu cuenta personal. Procurar utilizar el access token de tu usuario de test y no el de tu cuenta personal, el contratar paquetes de publicación puede generar cargos en las cuentas asociadas a los access tokens.

**Para contratar un paquete de publicaciones, sigue estos pasos:**

1. **Accede al sitio de MercadoLibre correspondiente al país en el que estás trabajando:**  utilizando las credenciales (usuario y contraseña) que generaste para tu usuario de prueba.

2. **Contrata un paquete de publicación desde la sección Resumen en MyML:**  Ingresando a [https://www.mercadolibre.cl/seller-packs/publications](https://www.mercadolibre.cl/seller-packs/publications) y contrata uno de los paquetes disponibles.

## 4. Obtener access token del usuario de test

Prepara tus credenciales, estas tienen que ser las mismas que utilizaste en los requisitos previos para obtener un access token y crear un usuario de test. Asegúrate de tener a mano:

- Tu Client ID.

- Tu Client Secret.

- La Redirect URI que definiste al crear tu aplicación.

**Pasos para obtener el Access Token:**

1. **Inicia sesión:**  Accede a MercadoLibre con las credenciales de tu usuario de prueba.

2. **Crea un código de uso único:**  Ve a la sección [Generación de ID para obtener access token](https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token#:~:text=%27redirect_uri%3D%24redirect_uri%27-,Generaci%C3%B3n%20de%20ID%20para%20obtener%20access%20token,-Como%20una%20medida) y sigue las instrucciones para generar un código de autorización único, el cual será necesario para el siguiente paso. Recuerda que cada vez que necesites un nuevo Access Token, deberás generar un nuevo código de autorización. **Importante:**  Asegúrate de utilizar el dominio de mercadolibre correspondiente a tu país para evitar posibles errores.

3. **Crea un Access Token para acceder a nuestra API:**  Ve a la sección [Obtener access token enviando parámetros por body](https://developers.mercadolibre.com.ar/es_ar/recomendaciones-de-autorizacion-y-token#:~:text=poder%20mitigar%20vulnerabilidades.-,Obtener%20access%20token%20enviando%20par%C3%A1metros%20por%20body,-Cuando%20realices%20un) y sigue las instrucciones para enviar una petición POST con tus credenciales (Client ID, Client Secret, Redirect URI) y el código de autorización que generaste en el paso anterior. Asegúrate de reemplazar los marcadores "client_id", "client_secret" y "redirect_uri" con tus valores reales. El Access Token tiene una duración limitada. Consulta la documentación para conocer su tiempo de expiración y cómo renovarlo.

4. **Valida el Token:**  Para confirmar que el access token corresponde a tu usuario de prueba, ejecuta el siguiente llamado utilizando este nuevo token.

Llamada:

```
curl -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/me
```

**Importante:**

Los datos que recibas en la respuesta deberán coincidir con la información de tu usuario de prueba.

Si el proceso se completó correctamente, ya puedes continuar con los siguientes pasos utilizando el access token generado.

## 5.Publica tu inmueble

Si llegaste hasta este punto, ya estás listo para publicar un inmueble con tu usuario de prueba. Para ello, debes ejecutar una llamada **POST**  a la API de publicación de inmuebles, incluyendo toda la información que has reunido en los pasos anteriores (token de acceso, categoría, atributos, ubicación, etc.).

Llamada:

```
curl --location 'https://api.mercadolibre.com/items' \
--header 'Authorization: Bearer $ACCESS_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "title": "Propiedad de Test por favor no contactar",
    "listing_type_id": "silver",
    "category_id": "MLC157520",
    "currency_id": "CLP",
    "price": 100000000,
    "available_quantity": 1,
    "attributes": [
        {
            "id": "TOTAL_AREA",
            "name": "Superficie total",
            "value_id": null, 
            "value_name": "4300 m²",
            "value_struct": {
                "number": 4300,
                "unit": "m²"
            },
            "values": [
                {
                    "id": null,
                    "name": "4300 m²",
                    "struct": {
                        "number": 4300,
                        "unit": "m²"
                    },
                    "source": 6596781661210240
                }
            ],
            "attribute_group_id": "FIND",
            "attribute_group_name": "Ficha técnica",
            "source": 6596781661210240,
            "value_type": "number_unit"
        },
        {
            "id": "PARKING_LOTS",
            "name": "Estacionamientos",
            "value_id": null,
            "value_name": "2",
            "value_struct": null,
            "values": [
                {
                    "id": null,
                    "name": "2",
                    "struct": null,
                }
            ],
            "attribute_group_id": "FIND",
            "attribute_group_name": "Ficha técnica",
            "value_type": "number"
        },
        {
            "id": "COVERED_AREA",
            "name": "Superficie útil",
            "value_id": null,
            "value_name": "390 m²",
            "value_struct": {
                "number": 390,
                "unit": "m²"
            },
            "values": [
                {
                    "id": null,
                    "name": "390 m²",
                    "struct": {
                        "number": 390,
                        "unit": "m²"
                    },
                    "source": 6596781661210240
                }
            ],
            "attribute_group_id": "FIND",
            "attribute_group_name": "Ficha técnica",
            "source": 6596781661210240,
            "value_type": "number_unit"
        },
        {
            "id": "BEDROOMS",
            "name": "Dormitorios",
            "value_id": null,
            "value_name": "4",
            "value_struct": null,
            "values": [
                {
                    "id": null,
                    "name": "4",
                    "struct": null,
                    "source": 6596781661210240
                }
            ],
            "attribute_group_id": "FIND",
            "attribute_group_name": "Ficha técnica",
            "source": 6596781661210240,
            "value_type": "number"
        },
        {
            "id": "FULL_BATHROOMS",
            "name": "Baños",
            "value_id": null,
            "value_name": "5",
            "value_struct": null,
            "values": [
                {
                    "id": null,
                    "name": "5",
                    "struct": null,
                    "source": 6596781661210240
                }
            ],
            "attribute_group_id": "FIND",
            "attribute_group_name": "Ficha técnica",
            "source": 6596781661210240,
            "value_type": "number"
        }

    ],
    "condition": "used",
    "location": {
        "address_line": "H-20, La Estrella, O'\''Higgins, Chile",
        "zip_code": "",
        "neighborhood": {
            "id": "",
            "name": ""
        },
        "city": {
            "id": "TUxDQ0xBWmE0Y2Zm",
            "name": "La Estrella"
        },
        "state": {
            "id": "TUxDUE9IUzFjODg",
            "name": "Libertador B. O'\''Higgins"
        },
        "country": {
            "id": "CL",
            "name": "Chile"
        },
        "latitude": -34.2065985,
        "longitude": -71.6742634
    }
    
}'
```

### Parámetros de publicación de inmuebles

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en el punto 4.3 de la guía “Pasos Rápidos para Publicar un Inmueble de Prueba”. |
| listing_type_id | string | No | Tipo de paquete contratado para publicación:  **silver** : Paquete de publicación **gold** : Paquete básico de destaque **gold_premium** : Paquete premium de destaque |
| category_id | string | No | Id de la categoría a la cual corresponde tu publicación. |
| currency_id | string | No | Tipo de moneda, más información en [Ubicación y monedas](https://developers.mercadolibre.cl/es_ar/ubicacion-y-monedas). |
| price | number | No | Precio de la publicación. |
| available_quantity | int | No | Cantidad; para inmuebles siempre deberá ser 1. |
| attributes |  |  |  |
| TOTAL_AREA | float | No | Área total de la propiedad. |
| PARKING_LOTS | int | No | Número de espacios de estacionamiento con los que se cuenta. |
| COVERED_AREA | float | No | Área útil de la propiedad. |
| BEDROOMS | int | No | Cantidad de habitaciones con los que se cuenta. |
| FULL_BATHROOMS | int | No | Cantidad de baños con los que se cuenta. |
| condition | string | No | Nueva (`new`) o usada (`used`). |
| location |  |  |  |
| neighborhood | string | No | Barrio donde se encuentra ubicado el inmueble. |
| city | string | No | Ciudad donde se encuentra ubicado el inmueble. |
| state | string | No | Municipio o departamento donde se encuentra ubicado el inmueble. |
| country | string | No | País donde se encuentra ubicado el inmueble. |
| latitude | double | No | Coordenadas de la ubicación del inmueble. |
| longitude | double | No | Coordenadas de la ubicación del inmueble. |

**Importante:**

Recuerda reemplazar **$ACCESS_TOKEN**  con el token de acceso que obtuviste para tu usuario de prueba para que no incurras en gastos adicionales. Ajusta los demás datos según corresponda a las características de tu inmueble.

## 6.Verificar el estado de la publicación

Una vez que hayas publicado el inmueble, obtendrás un id en la respuesta de la API. Utiliza este id para verificar el estado de la publicación mediante una petición GET:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

### Parámetros

| Parámetro | Tipo | Opcional | Valores |
| --- | --- | --- | --- |
| ACCESS_TOKEN | string | No | Recuerda utilizar el token que generaste en el punto 4.3 de la guía “Pasos Rápidos para Publicar un Inmueble de Prueba”. |
| ITEM_ID | string | No | Item id obtenido como respuesta al publicar el inmueble. |

Puedes conocer más acerca de publicar y consultar inmuebles en la sección de [Publica inmuebles](https://developers.mercadolibre.com.ar/%E2%80%9Chttps://developers.mercadolibre.com.ar/es_ar/publica-inmueble%E2%80%9D)

## 7. Soporte

En caso de requerir ayuda con algún punto en específico que no pudiste solucionar mediante la documentación, puedes [contactar a soporte aquí](https://developers.mercadolibre.com.ar/support), ingresando con tu cuenta.

**Importante:**

Ten en cuenta que esta guía es una introducción. Para obtener información detallada sobre la publicación de inmuebles y otras secciones relevantes, consulta las secciones específicas de la guía.

### ¿A dónde vamos?

Si deseas profundizar más en los diversos aspectos de la publicación de inmuebles en Mercado Libre y optimizar el uso de nuestra API, te recomendamos explorar las siguientes lecturas y recursos:

- [Categorías y Atributos de publicación.](https://developers.mercadolibre.com.ar/es_ar/categorias-atributos-inmuebles)

- [Localizar Inmuebles.](https://developers.mercadolibre.com.ar/es_ar/localizar-inmuebles)

- [Gestiona paquetes inmuebles.](https://developers.mercadolibre.com.ar/es_ar/gestionar-paquetes-de-inmuebles)

- [Publica inmuebles.](https://developers.mercadolibre.com.ar/es_ar/publica-inmueble)

- [Desarrollos inmobiliarios.](https://developers.mercadolibre.com.ar/es_ar/test-guia-inmuebles)

- [Estadísticas de publicación.](https://developers.mercadolibre.com.ar/es_ar/estadisticas-de-interacciones-en-inmuebles)
