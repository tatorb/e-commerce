<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos -->
<!-- Sección: Guía para vehículos -->

# Publica vehículos

Última actualización 28/08/2026

## Publica vehículos

Los anuncios clasificados son los únicos donde la información de contacto es pública. Por lo que, cuando los usuarios están navegando y tienen interés en una publicación, pueden ponerse en contacto de inmediato. Básicamente no hay ningún tipo de transacciones o intercambios realizados en nuestro sitio para este tipo de artículos, pero estará exponiendo su perfil a cada usuario que esté navegando en la sección "Clasificados" de nuestra plataforma.

**Importante:**

A partir del **01/10/2026** , los campos **country_code2**  y **phone2**  del objeto **seller_contact**  pasan a ser obligatorios para las publicaciones de Vehículos (Motors) cuando la cuenta del vendedor tiene perfil de **concesionario (car dealer)** . El objeto seller_contact debe enviarse completo en el cuerpo de la solicitud. Las publicaciones sin estos datos serán rechazadas con HTTP 400. Consulta la sección **[Contacto del vendedor (seller_contact)](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos?nocache=true#Contato-del-vendedor:~:text=este%20enlace.-,Contacto%20del%20vendedor%20(seller_contact),-El%20objeto%20seller_contact)**  para el detalle de los campos.

## Consultar vehículo

Solo debes conocer el item_id asociado al producto y, como es público, puedes obtenerlo en la página Detalles del artículo en la parte superior de la página, como en la imagen del ejemplo. Debes agregar el site_id antes del número y listo. Llamada:

```
curl - X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID
```

Ejemplo:

```
curl  -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/MLB4277151191
```

Respuesta:

```
{
    "id": "MLB4277151191",
    "site_id": "MLB",
    "title": "Anuncio Teste Carro - Nao Comprar 3",
    "family_name": null,
    "seller_id": 1944040506,
    "category_id": "MLB1744",
    "user_product_id": "MLBU3517669871",
    "official_store_id": null,
    "price": 150000,
    "base_price": 150000,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 1,
    "available_quantity": 1,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WITH_FINANCING_OPTIONS",
            "name": "Com opções de financiamento",
            "value_id": "242085",
            "value_name": "Sim",
            "value_struct": null,
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "IS_FINANCEABLE",
            "name": "É financiável",
            "value_id": "242084",
            "value_name": "Não",
            "value_struct": null,
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "IS_FINANCEABLE_VEHICLE_RISK_PROFILE",
            "name": "É o perfil de risco veicular financiável",
            "value_id": "242084",
            "value_name": "Não",
            "value_struct": null,
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        }
    ],
    "buying_mode": "classified",
    "listing_type_id": "silver",
    "start_time": "2025-10-28T15:18:33.656Z",
    "stop_time": "2026-10-28T04:00:00.000Z",
    "end_time": "2026-10-28T04:00:00.000Z",
    "expiration_time": "2026-01-16T15:18:33.821Z",
    "condition": "used",
    "permalink": "https://carro.mercadolivre.com.br/MLB-4277151191-anuncio-teste-carro-nao-comprar-3-_JM",
    "thumbnail_id": "859393-MLB92379478091_092025",
    "thumbnail": "http://http2.mlstatic.com/D_859393-MLB92379478091_092025-I.jpg",
    "pictures": [
        {
            "id": "859393-MLB92379478091_092025",
            "url": "http://http2.mlstatic.com/D_859393-MLB92379478091_092025-O.jpg",
            "secure_url": "https://http2.mlstatic.com/D_859393-MLB92379478091_092025-O.jpg",
            "size": "500x375",
            "max_size": "1200x900",
            "quality": ""
        }
    ],
    "video_id": "sJLCxVgshzY",
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "methods": [],
        "tags": [],
        "dimensions": null,
        "local_pick_up": false,
        "free_shipping": false,
        "logistic_type": null,
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 0
    },
    "seller_contact": {
        "contact": "",
        "other_info": "",
        "country_code": "",
        "area_code": "",
        "phone": "",
        "country_code2": "",
        "phone2": "",
        "email": "",
        "webpage": ""
    },
    "location": {
        "address_line": "Avenida Juruce, 436",
        "zip_code": "04080011",
        "neighborhood": {
            "id": "",
            "name": ""
        },
        "city": {
            "id": "BR-SP-56",
            "name": "Atibaia"
        },
        "state": {
            "id": "BR-SP",
            "name": "São Paulo"
        },
        "country": {
            "id": "BR",
            "name": "Brasil"
        },
        "latitude": -23.6091774,
        "longitude": -46.6618734
    },
    "geolocation": {
        "latitude": -23.6091774,
        "longitude": -46.6618734
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "HAS_POWER_DOOR_LOCKS",
            "name": "Travas elétricas de portas",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condição do item",
            "value_id": "2230581",
            "value_name": "Usado",
            "values": [
                {
                    "id": "2230581",
                    "name": "Usado",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "SELLER_PACKAGE_HEIGHT",
            "name": "Altura da embalagem do vendor",
            "value_id": null,
            "value_name": "21 cm",
            "values": [
                {
                    "id": null,
                    "name": "21 cm",
                    "struct": {
                        "number": 21,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_LENGTH",
            "name": "Comprimento da embalagem do vendor",
            "value_id": null,
            "value_name": "6 cm",
            "values": [
                {
                    "id": null,
                    "name": "6 cm",
                    "struct": {
                        "number": 6,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_TYPE",
            "name": "Tipo da embalagem do vendor",
            "value_id": "47115156",
            "value_name": "Com embalagem adicional",
            "values": [
                {
                    "id": "47115156",
                    "name": "Com embalagem adicional",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "SELLER_PACKAGE_WEIGHT",
            "name": "Peso da embalagem do vendor",
            "value_id": null,
            "value_name": "179 g",
            "values": [
                {
                    "id": null,
                    "name": "179 g",
                    "struct": {
                        "number": 179,
                        "unit": "g"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SELLER_PACKAGE_WIDTH",
            "name": "Largura da embalagem do vendor",
            "value_id": null,
            "value_name": "15 cm",
            "values": [
                {
                    "id": null,
                    "name": "15 cm",
                    "struct": {
                        "number": 15,
                        "unit": "cm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "CONTACT_SCHEDULE",
            "name": "Horário de contato",
            "value_id": null,
            "value_name": "Me procurar à tarde",
            "values": [
                {
                    "id": null,
                    "name": "Me procurar à tarde",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "ENGINE",
            "name": "Motor",
            "value_id": "2164443",
            "value_name": "1.6",
            "values": [
                {
                    "id": "2164443",
                    "name": "1.6",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "SINGLE_OWNER",
            "name": "Único dono",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "STEERING",
            "name": "Direção",
            "value_id": "405719",
            "value_name": "Elétrica",
            "values": [
                {
                    "id": "405719",
                    "name": "Elétrica",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TRANSMISSION",
            "name": "Transmissão",
            "value_id": "370876",
            "value_name": "Automática",
            "values": [
                {
                    "id": "370876",
                    "name": "Automática",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "VEHICLE_BODY_TYPE",
            "name": "Tipo de carroceria",
            "value_id": "452753",
            "value_name": "Minivan",
            "values": [
                {
                    "id": "452753",
                    "name": "Minivan",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "HAS_AIR_CONDITIONING",
            "name": "Ar-condicionado",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_COASTERS",
            "name": "Porta copos",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ELECTRIC_MIRRORS",
            "name": "Controle elétrico para os retrovisores",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT",
            "name": "Banco motorista com regulagem de altura",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LEATHER_UPHOLSTERY",
            "name": "Bancos em couro",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LIGHT_ON_REMINDER",
            "name": "Alarme de luzes acesas",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ONBOARD_COMPUTER",
            "name": "Computador de bordo",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PARKING_SENSOR",
            "name": "Sensor de estacionamento",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_WINDOWS",
            "name": "Vidros elétricos",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_RAIN_SENSOR",
            "name": "Sensor de chuva",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_REAR_FOLDING_SEAT",
            "name": "Banco traseiro retrátil",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_SLIDING_ROOF",
            "name": "Teto solar elétrico retrátil",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "DISTANCE_BETWEEN_AXES",
            "name": "Distância entre eixos",
            "value_id": null,
            "value_name": "2570 mm",
            "values": [
                {
                    "id": null,
                    "name": "2570 mm",
                    "struct": {
                        "number": 2570,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "ENGINE_DISPLACEMENT",
            "name": "Cilindrada",
            "value_id": "969897",
            "value_name": "1600 cc",
            "values": [
                {
                    "id": "969897",
                    "name": "1600 cc",
                    "struct": {
                        "number": 1600,
                        "unit": "cc"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_CAPACITY",
            "name": "Tanque de combustível",
            "value_id": null,
            "value_name": "54 L",
            "values": [
                {
                    "id": null,
                    "name": "54 L",
                    "struct": {
                        "number": 54,
                        "unit": "L"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "GEAR_NUMBER",
            "name": "Número de velocidades",
            "value_id": "458574",
            "value_name": "6",
            "values": [
                {
                    "id": "458574",
                    "name": "6",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "HAS_PAINTED_FRONT_BUMPER",
            "name": "Para-choque dianteiro com friso na cor do veículo",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PAINTED_REAR_BUMPER",
            "name": "Para-choque traseiro com friso na cor do veículo",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_FRONT_WINDOWS",
            "name": "Vidros elétricos dianteiros",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_REAR_WINDOWS",
            "name": "Vidros elétricos traseiros",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HEIGHT",
            "name": "Altura",
            "value_id": null,
            "value_name": "1625 mm",
            "values": [
                {
                    "id": null,
                    "name": "1625 mm",
                    "struct": {
                        "number": 1625,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "LENGTH",
            "name": "Comprimento",
            "value_id": null,
            "value_name": "4140 mm",
            "values": [
                {
                    "id": null,
                    "name": "4140 mm",
                    "struct": {
                        "number": 4140,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "LICENSE_PLATE",
            "name": "Placa",
            "value_id": null,
            "value_name": "EWP5306",
            "values": [
                {
                    "id": null,
                    "name": "EWP5306",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "PASSENGER_CAPACITY",
            "name": "Quantidade de pessoas",
            "value_id": null,
            "value_name": "8",
            "values": [
                {
                    "id": null,
                    "name": "8",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "POWER",
            "name": "Potência",
            "value_id": "458986",
            "value_name": "126 hp",
            "values": [
                {
                    "id": "458986",
                    "name": "126 hp",
                    "struct": {
                        "number": 126,
                        "unit": "hp"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "SHORT_VERSION",
            "name": "Versões",
            "value_id": "1051889",
            "value_name": "Ex",
            "values": [
                {
                    "id": "1051889",
                    "name": "Ex",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "VALVES_PER_CYLINDER",
            "name": "Válvulas por cilindro",
            "value_id": "970236",
            "value_name": "4",
            "values": [
                {
                    "id": "970236",
                    "name": "4",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "WIDTH",
            "name": "Largura",
            "value_id": null,
            "value_name": "1800 mm",
            "values": [
                {
                    "id": null,
                    "name": "1800 mm",
                    "struct": {
                        "number": 1800,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "HAS_WINDSCREEN_WIPER",
            "name": "Limpador traseiro",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "374002",
            "value_name": "Kia",
            "values": [
                {
                    "id": "374002",
                    "name": "Kia",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "DOORS",
            "name": "Portas",
            "value_id": null,
            "value_name": "4",
            "values": [
                {
                    "id": null,
                    "name": "4",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "FUEL_TYPE",
            "name": "Tipo de combustível",
            "value_id": "64364",
            "value_name": "Gasolina",
            "values": [
                {
                    "id": "64364",
                    "name": "Gasolina",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "KILOMETERS",
            "name": "Quilômetros",
            "value_id": null,
            "value_name": "92000 km",
            "values": [
                {
                    "id": null,
                    "name": "92000 km",
                    "struct": {
                        "number": 92000,
                        "unit": "km"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "235012",
            "value_name": "Soul",
            "values": [
                {
                    "id": "235012",
                    "name": "Soul",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "TRIM",
            "name": "Versão",
            "value_id": null,
            "value_name": "XRS",
            "values": [
                {
                    "id": null,
                    "name": "XRS",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "VEHICLE_TYPE",
            "name": "Tipo de veículo",
            "value_id": "398351",
            "value_name": "Carros e caminhonetes",
            "values": [
                {
                    "id": "398351",
                    "name": "Carros e caminhonetes",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "VEHICLE_YEAR",
            "name": "Ano",
            "value_id": "436707",
            "value_name": "2012",
            "values": [
                {
                    "id": "436707",
                    "name": "2012",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "COLOR",
            "name": "Cor",
            "value_id": "52049",
            "value_name": "Preto",
            "values": [
                {
                    "id": "52049",
                    "name": "Preto",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "CURRENCY",
            "name": "Moeda",
            "value_id": "10837729",
            "value_name": "r$",
            "values": [
                {
                    "id": "10837729",
                    "name": "r$",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "FIPE_BRAND",
            "name": "Marca FIPE",
            "value_id": "8072705",
            "value_name": "kia motors",
            "values": [
                {
                    "id": "8072705",
                    "name": "kia motors",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "FIPE_CODE",
            "name": "Código FIPE",
            "value_id": "7771393",
            "value_name": "018071-8",
            "values": [
                {
                    "id": "7771393",
                    "name": "018071-8",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "FIPE_MODEL",
            "name": "Modelo FIPE",
            "value_id": "8590942",
            "value_name": "soul 1.6/ 1.6 16v flex mec.",
            "values": [
                {
                    "id": "8590942",
                    "name": "soul 1.6/ 1.6 16v flex mec.",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "FIPE_PRICE",
            "name": "Preço FIPE",
            "value_id": "55985369",
            "value_name": "r$ 40.012,00",
            "values": [
                {
                    "id": "55985369",
                    "name": "r$ 40.012,00",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "IS_OFFERED_BY_BRAND",
            "name": "É oferecido pela marca",
            "value_id": "242084",
            "value_name": "Não",
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "LICENSE_PLATE_LAST_DIGIT",
            "name": "Último dígito da placa",
            "value_id": null,
            "value_name": "6",
            "values": [
                {
                    "id": null,
                    "name": "6",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "LICENSE_PLATE_PARITY",
            "name": "Paridade da placa",
            "value_id": "6832186",
            "value_name": "Par",
            "values": [
                {
                    "id": "6832186",
                    "name": "Par",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "MARKET",
            "name": "Mercado",
            "value_id": "2419035",
            "value_name": "BR",
            "values": [
                {
                    "id": "2419035",
                    "name": "BR",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MILEAGE_WARRANTY",
            "name": "Garantia em quilometros",
            "value_id": "17711152",
            "value_name": "80000",
            "values": [
                {
                    "id": "17711152",
                    "name": "80000",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "MOLICAR_CODE",
            "name": "Código Molicar",
            "value_id": "13800937",
            "value_name": "02702525-1",
            "values": [
                {
                    "id": "13800937",
                    "name": "02702525-1",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "PRICE_USED",
            "name": "Preço usado",
            "value_id": "55985370",
            "value_name": "40012",
            "values": [
                {
                    "id": "55985370",
                    "name": "40012",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "VERIFICATION_TYPE",
            "name": "Tipo de verificação",
            "value_id": "10882048",
            "value_name": "De veículo",
            "values": [
                {
                    "id": "10882048",
                    "name": "De veículo",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "YEAR_WARRANTY",
            "name": "Garantia em anos",
            "value_id": "17526370",
            "value_name": "5",
            "values": [
                {
                    "id": "17526370",
                    "name": "5",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "ARMORED",
            "name": "Blindado",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ABS_BRAKES",
            "name": "Freios ABS",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALARM",
            "name": "Alarme",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALLOY_WHEELS",
            "name": "Rodas de liga leve",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_FOG_LIGHT",
            "name": "Faróis anti-nevoeiro",
            "value_id": "242084",
            "value_name": "Não",
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PASSENGER_AIRBAG",
            "name": "Airbag para motorista e passageiro",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_REAR_FOGLIGHTS",
            "name": "Faróis de neblina traseiros",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "TRACTION_CONTROL",
            "name": "Controle de tração",
            "value_id": "493979",
            "value_name": "Dianteira",
            "values": [
                {
                    "id": "493979",
                    "name": "Dianteira",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "HAS_AMFM_RADIO",
            "name": "AM/FM",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AUXILIARY_PORT",
            "name": "Entrada auxiliar",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_MP3_PLAYER",
            "name": "Leitor de MP3",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_STEERING_WHEEL_CONTROL",
            "name": "Controle remoto para rádio no volante",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_USB",
            "name": "Entrada USB",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "status": "active",
    "sub_status": [
        "pack_quota_assigned"
    ],
    "tags": [
        "test_item"
    ],
    "warranty": null,
    "catalog_product_id": "MLB7859304",
    "domain_id": "MLB-CARS_AND_VANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2025-10-28T15:18:33.914Z",
    "last_updated": "2025-11-04T15:19:18.904Z",
    "health": 0.16,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

## Atributos

Ten en cuenta lo siguiente:
 Cuando creas un artículo, algunos atributos son obligatorios, mientras que otros puedes omitir. En determinadas situaciones y basándose en el catálogo de vehículos de MercadoLibre, la plataforma completará aquellos atributos del ítem que el vendedor haya omitido, con el propósito de proporcionar información adicional al comprador, siempre y cuando el vehículo esté dentro de nuestro catálogo. Si el vendedor introduce un valor diferente al registrado en nuestro catálogo, prevalecerá la información proporcionada por el vendedor.
 
 Además, ten presente que estos atributos definirán cómo se muestra el artículo, cómo pueden comprarlo los compradores y la posición en los resultados de la búsqueda, entre otras variables.

Nota:

Al realizar el POST debes especificar el **channel**  al cual estás publicando, asegurate de enviar **marketplace**  para no obtener error al publicar un ítem clasificado. Además puedes ver el campo en el [ejemplo del POST](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos#Publica-veh%C3%ADculo).

### Título

Un buen título debe ser conciso, pero debe contener la marca, la versión y la cantidad de puertas del vehículo. Las palabras del título son muy importantes, dado que son estas las que coinciden con las palabras buscadas por los usuarios; por lo tanto, cuanto mayor sea la coincidencia de estas palabras, mayor será la devolución. Aconsejamos a los integradores que ya auto-completen el título para su cliente, a fin de ya sugerir un título mejor para la publicación que se incluirá. Ejemplo: Chevrolet Astra Hatch Advantage 2.0 4P

### Placa

Importante:

A partir de octubre de 2024 en MLA y febrero de 2025 en MLC, actualice sus sistemas para incluir la PLACA/PATENTE y los últimos 6 caracteres del CHASIS/VIN al registrar o actualizar vehículos en el sitio MLA Y MLC. Es fundamental utilizar correctamente ambos campos, para asegurar que el vehículo sea verificado y garantizar la precisión de la información en la plataforma.

Las siguientes recomendaciones de formato de placa (LICENSE_PLATE) se aplican a Brasil y Argentina:

- La placa debe corresponder al vehículo publicado (marca, modelo, año y versión).

- La placa no debe estar repetida en otra publicación.

- El número permitido de caracteres es 7 (sin guion) o 8 caracteres (con guion).

Formatos para Brasil:

- **AAAnnnn** : formato antiguo, máximo 7 caracteres, letras e números sem separação por guion.

- **AAA-nnnn** : formato antigo, máximo 8 caracteres, letras e números separados por guion.

- **AAAnAnn** : formato Mercosur.

Formatos para Argentina:

- **AA-nnn-nn** : formato atual, 7 caracteres en total, con letras y números separados por guion.

Formatos para Chile:

- **AAAAnn o AAnnnn** : formato actual, 6 caracteres en total, con letras y números.

Asegúrese de que la placa sea correcta y esté conforme con los formatos establecidos para garantizar la verificación adecuada del vehículo.

### Chasis

El campo **"VIN_LAST_DIGITS"**  es esencial para la verificación del vehículo, junto con la placa. Para garantizar que la información del vehículo sea validada correctamente, es necesario completar este campo con los últimos 6 dígitos del chasis. Aunque esta información permanezca oculta en el anuncio, es crucial para la validación del ítem. La correcta inserción de los últimos dígitos contribuye a la integridad de los datos y a la confianza en el proceso de compra y venta de vehículos en la plataforma. Asegúrese de incluir esta información al publicar un vehículo para garantizar que se realicen todas las verificaciones necesarias.

### Descripción

Nota:

Para crear la descripción, antes debes crear la publicación sin descripción y luego enviar la descripción mediante un POST al recurso **/items/$ITEM_ID/description** .

Conoce cómo [agregar la descripción al ítem publicado](https://developers.mercadolibre.com.ar/es_ar/descripcion-de-articulos#Cargar-la-descripci%C3%B3n-en-un-%C3%ADtem).

Nota:

La descripción del producto deberá ser en texto sin formato. Tampoco enviar información de contacto, como teléfono, dirección y sitio en este campo. En caso de que se envíe, aceptaremos la publicación, pero será penalizada o moderada y tendrá un mal clasificado en las búsquedas. Para consultar las publicaciones moderadas consulta [Gestiona moderaciones](https://developers.mercadolibre.com.pe/es_ar/moderaciones).

Conoce cómo consultar una descripción mediante un GET al recurso /items/$ITEM_ID/description.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/items/$ITEM_ID/description
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN'https://api.mercadolibre.com/items/MLA932485344/description
```

Respuesta:

```
{
	"text": "",
	"plain_text": "Texto TEST".
	"date_created": "2021-08-20T22:58:02.000Z",
	"snapshot": {}
}
```

### Imágenes

Las buenas imágenes pueden hacer que un artículo sea más atractivo y ofrecer a los compradores una idea más certera de su aspecto. Básicamente, deberías agregar un conjunto de hasta seis imágenes URL en el JSON.

```
{
 ....
 "pictures":[
  {"source":"http://yourServer/path/to/your/picture.jpg"},
  {"source":"http://yourServer/path/to/your/otherPicture.gif"},
  {"source":"http://yourServer/path/to/your/anotherPicture.png"}
 ]
 ...
}
```

Te recomendamos no utilizar servidores lentos para alojar tus imágenes porque pueden generar desventajas al momento de publicar. También puedes agregar o cambiar las imágenes de tu artículo aquí más adelante. [Por favor, lee más sobre este tema para conocer qué tipo de imágenes se permiten y cómo trabajar con ellas.](https://developers.mercadolibre.com.ar/es_ar/trabajar-con-imagenes)

Nota:

Desde el 23 de febrero de 2026, **el envío de al menos una imagen (array pictures) es obligatorio**  en la creación de anuncios vía POST /items para **Listing Type Silver** . La obligatoriedad también aplica a los anuncios **gold, gold_special y gold_premium**  con "requires_picture: true". Las solicitudes sin imágenes son rechazadas con HTTP 400 (error 173 – LTP_PICTURE_REQUIRED). Asegúrese de incluir al menos una imagen en el array pictures para estos tipos de anuncios.

### Categoría

Previo a publicar ítems, los vendedores deben definir una categoría en el sitio de Mercado Libre y esta acepta un ID preestablecido. Por ende, te recomendamos utilizar [el predictor de categorías](https://developers.mercadolibre.com.ar/es_ar/categorias-y-atributos) para obtener la categoría adecuada y recuerda que [marca y modelo](https://developers.mercadolibre.com.ar/es_ar/publica-vehiculos?#Marca-Modelo-y-versi%C3%B3n) son actualmente atributos obligatorios. A continuación, ilustramos el cambio en el flujo de publicación de ítems vehículos:

Nota:

En la imagen derecha puedes ver un ejemplo de los 2 niveles disponibles y los atributos obligatorios marca y modelo.

Para las categorías de Motocicletas y Náutica, que antes tenían un nivel más que las otras para especificar el tipo de vehículo, también pasan a tener 2 niveles y un nuevo atributo para especificar el tipo: moto_type y vehicle_type.

### Precio

Este atributo es obligatorio. Al definir un nuevo anuncio, este debe tener un precio. Si ya definiste un precio, pero no estás satisfecho con él, podrás modificarlo posteriormente.

### Moneda

Además del precio, deberás definir una moneda. Este atributo también es obligatorio. La moneda deberá ser definida usando una ID predefinida. [Ve ejemplos del recurso de la moneda aquí](https://developers.mercadolibre.com.ar/es_ar/ubicacion-y-monedas).

Nota:

En Venezuela sólo está permitido publicar en dólares los productos y vehículos disponibles. Para hacer la conversión de la moneda, se toma la cotización del día según el Banco Central de Venezuela.

## Opciones de Financiamiento

Importante:

La inclusión de este atributo está actualmente habilitada solo para el site **MLA (Argentina)** .

### Disponibilidad de Financiamiento

El envío del campo **WITH_FINANCING_OPTIONS**  posibilita al vendedor señalar en sus publicaciones la disposición para negociar condiciones alternativas de pago (financiamiento) con el comprador. Al activar esta opción, enviando el atributo, el anuncio mostrará la etiqueta de financiamiento **"Con facilidades de pago"** .

Para incluir el atributo de financiamiento en tu publicación, debes enviar el campo sale_terms como un array en la llamada a la API **/items** . Este atributo es de tipo booleano, donde el value_id define si el producto es financiable o no.

| Parámetro | Opcional | Valores |
| --- | --- | --- |
| id | No | WITH_FINANCING_OPTIONS |
| value_id | No | 242085 (Sí = financiable) / 242084 (No = no financiable) |
| value_name | No | Sí / No |

Nota:

Es necesario que toda publicación contenga el precio final del producto en el campo price. El uso del atributo **“ WITH_FINANCING_OPTIONS”**  es opcional y no exime al vendedor del requisito de informar el precio total.

```
"sale_terms": [
  {
    "id": "WITH_FINANCING_OPTIONS",
    "value_id": "242085",
    "value_name": "Sí"
  }
],
```

Ejemplo de llamada:

```
curl -L -X POST 'https://api.mercadolibre.com/items' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "title": "Anuncio Prueba Auto - No Comprar 3",
    "description": "Veículo em ótimo estado",
    "channels": [
        "marketplace"
    ],
    "pictures": [
        {
            "id": "859393-MLB92379478091_092025"
        }
    ],
    "video_id": "sJLCxVgshzY",
    "category_id": "MLA1744",
    "price": 18000000,
    "currency_id": "ARS",
    "listing_type_id": "silver",
    "available_quantity": 1,
    "location": {
        "address_line": "Solís 2222",
        "zip_code": "",
        "neighborhood": {
            "id": "TUxBQk9MSTgzODNa",
            "name": "Olivos"
        },
        "city": {
            "id": "TUxBQ1ZJQ2E3MTQz",
            "name": "Vicente López"
        },
        "state": {
            "id": "TUxBUEdSQWU4ZDkz",
            "name": "Bs.as. G.b.a. Norte"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "open_hours": "",
        "latitude": -34.5101161,
        "longitude": -58.4765109
    },
    "sale_terms": [
        {
            "id": "WITH_FINANCING_OPTIONS",
            "value_id": "242085",
            "value_name": "Si"
        }
    ],
    "attributes": [
        {
            "id": "BRAND",
            "value_name": "Citroën"
        },
        {
            "id": "MODEL",
            "value_name": "C4 Picasso"
        },
        {
            "id": "VEHICLE_YEAR",
            "value_name": "2015"
        },
        {
            "id": "DOORS",
            "value_name": "2"
        },
        {
            "id": "KILOMETERS",
            "value_name": "92000km"
        },
        {
            "id": "FUEL_TYPE",
            "value_name": "Diésel"
        },
        {
            "id": "COLOR",
            "value_name": "Rojo"
        },
        {
            "id": "STEERING",
            "value_name": "Hidráulica"
        },
        {
            "id": "TRANSMISSION",
            "value_name": "Manual"
        },
        {
            "id": "TRACTION_CONTROL",
            "value_name": "Delantera"
        },
        {
            "id": "HAS_ABS_BRAKES",
            "value_name": "Sí"
        },
        {
            "id": "HAS_AIR_CONDITIONING",
            "value_name": "Sí"
        },
        {
            "id": "HAS_ALARM",
            "value_name": "Sí"
        },
        {
            "id": "HAS_ALLOY_WHEELS",
            "value_name": "Sí"
        },
        {
            "id": "HAS_AMFM_RADIO",
            "value_name": "Sí"
        },
        {
            "id": "HAS_AUXILIARY_PORT",
            "value_name": "Sí"
        },
        {
            "id": "ITEM_CONDITION",
            "value_name": "Usado"
        },
        {
            "id": "PASSENGER_CAPACITY",
            "value_name": "7"
        },
        {
            "id": "TRIM",
            "value_name": "1.6 Origine Hdi 115cv"
        },
        {
            "id": "SINGLE_OWNER",
            "value_name": "Sí"
        },
        {
            "id": "HAS_WINDSCREEN_WIPER",
            "value_name": "Sí"
        },
        {
            "id": "HAS_USB",
            "value_name": "Sí"
        },
        {
            "id": "HAS_STEERING_WHEEL_CONTROL",
            "value_name": "Sí"
        },
        {
            "id": "HAS_POWER_DOOR_LOCKS",
            "value_name": "Sí"
        },
        {
            "id": "HAS_POWER_WINDOWS",
            "value_name": "Sí"
        },
        {
            "id": "HAS_RAIN_SENSOR",
            "value_name": "Sí"
        },
        {
            "id": "HAS_REAR_FOGLIGHTS",
            "value_name": "Si"
        },
        {
            "id": "HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT",
            "value_name": "Sí"
        },
        {
            "id": "HAS_SLIDING_ROOF",
            "value_name": "Sí"
        },
        {
            "id": "HAS_LEATHER_UPHOLSTERY",
            "value_name": "Sí"
        },
        {
            "id": "HAS_LIGHT_ON_REMINDER",
            "value_name": "Sí"
        },
        {
            "id": "HAS_MP3_PLAYER",
            "value_name": "Sí"
        },
        {
            "id": "HAS_ONBOARD_COMPUTER",
            "value_name": "Sí"
        },
        {
            "id": "HAS_PARKING_SENSOR",
            "value_name": "Sí"
        },
        {
            "id": "HAS_PASSENGER_AIRBAG",
            "value_name": "Sí"
        },
        {
            "id": "VEHICLE_BODY_TYPE",
            "value_name": "Monovolumen"
        },
        {
            "id": "HEIGHT",
            "value_name": "1644 mm"
        },
        {
            "id": "WIDTH",
            "value_name": "2000 mm"
        },
        {
            "id": "DISTANCE_BETWEEN_AXES",
            "value_name": "3735 mm"
        },
        {
            "id": "FUEL_CAPACITY",
            "value_name": "55 L"
        },
        {
            "id": "LENGTH",
            "value_name": "4597 mm"
        },
        {
            "id": "VALVES_PER_CYLINDER",
            "value_name": "2"
        },
        {
            "id": "GEAR_NUMBER",
            "value_name": "6"
        }
    ]
}'
```

Respuesta:

```
{
    "id": "MLA2506681148",
    "site_id": "MLA",
    "title": "Anuncio Prueba Auto - No Comprar 3",
    "seller_id": 2197811890,
    "category_id": "MLA1744",
    "user_product_id": "MLAU3525042708",
    "official_store_id": null,
    "price": 18000000,
    "base_price": 18000000,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "ARS",
    "initial_quantity": 1,
    "available_quantity": 1,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WITH_FINANCING_OPTIONS",
            "name": "Con opciones de financiamiento",
            "value_id": "242085",
            "value_name": "Sí",
            "value_struct": null,
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        }
    ],
    "buying_mode": "classified",
    "listing_type_id": "silver",
    "start_time": "2025-10-28T17:02:05.138Z",
    "stop_time": "2025-11-27T04:00:00.000Z",
    "end_time": "2025-11-27T04:00:00.000Z",
    "expiration_time": "2026-01-16T17:02:05.225Z",
    "condition": "used",
    "permalink": "http://auto.mercadolibre.com.ar/MLA-2506681148-anuncio-teste-carro-nao-comprar-3-_JM",
    "pictures": [
        {
            "id": "859393-MLB92379478091_092025",
            "url": "http://mlb-s1-p.mlstatic.com/859393-MLB92379478091_092025-O.jpg",
            "secure_url": "https://mlb-s1-p.mlstatic.com/859393-MLB92379478091_092025-O.jpg",
            "size": "500x375",
            "max_size": "1200x900",
            "quality": ""
        }
    ],
    "video_id": "sJLCxVgshzY",
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": null,
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 0
    },
    "seller_contact": {
        "contact": "",
        "other_info": "",
        "area_code": "",
        "phone": "",
        "phone2": "",
        "email": "",
        "webpage": "",
        "country_code": "",
        "country_code2": ""
    },
    "location": {
        "address_line": "Solís 2222",
        "zip_code": "",
        "neighborhood": {
            "id": "TUxBQk9MSTgzODNa",
            "name": "Olivos"
        },
        "city": {
            "id": "TUxBQ1ZJQ2E3MTQz",
            "name": "Vicente López"
        },
        "state": {
            "id": "TUxBUEdSQWU4ZDkz",
            "name": "Bs.As. G.B.A. Norte"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": -34.5101161,
        "longitude": -58.4765109,
        "open_hours": ""
    },
    "geolocation": {
        "latitude": -34.5101161,
        "longitude": -58.4765109
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "389169",
            "value_name": "Citroën",
            "values": [
                {
                    "id": "389169",
                    "name": "Citroën",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "389410",
            "value_name": "C4 Picasso",
            "values": [
                {
                    "id": "389410",
                    "name": "C4 Picasso",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "VEHICLE_YEAR",
            "name": "Año",
            "value_id": null,
            "value_name": "2015",
            "values": [
                {
                    "id": null,
                    "name": "2015",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "DOORS",
            "name": "Puertas",
            "value_id": null,
            "value_name": "2",
            "values": [
                {
                    "id": null,
                    "name": "2",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "KILOMETERS",
            "name": "Kilómetros",
            "value_id": null,
            "value_name": "92000 km",
            "values": [
                {
                    "id": null,
                    "name": "92000 km",
                    "struct": {
                        "number": 92000,
                        "unit": "km"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_TYPE",
            "name": "Tipo de combustible",
            "value_id": "60406",
            "value_name": "Diésel",
            "values": [
                {
                    "id": "60406",
                    "name": "Diésel",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "COLOR",
            "name": "Color",
            "value_id": "51993",
            "value_name": "Rojo",
            "values": [
                {
                    "id": "51993",
                    "name": "Rojo",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "STEERING",
            "name": "Dirección",
            "value_id": "370874",
            "value_name": "Hidráulica",
            "values": [
                {
                    "id": "370874",
                    "name": "Hidráulica",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TRANSMISSION",
            "name": "Transmisión",
            "value_id": "370877",
            "value_name": "Manual",
            "values": [
                {
                    "id": "370877",
                    "name": "Manual",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TRACTION_CONTROL",
            "name": "Control de tracción",
            "value_id": "493979",
            "value_name": "Delantera",
            "values": [
                {
                    "id": "493979",
                    "name": "Delantera",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "HAS_ABS_BRAKES",
            "name": "Frenos ABS",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AIR_CONDITIONING",
            "name": "Aire acondicionado",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALARM",
            "name": "Alarma",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALLOY_WHEELS",
            "name": "Llantas de aleación",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AMFM_RADIO",
            "name": "AM/FM",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AUXILIARY_PORT",
            "name": "Entrada auxiliar",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condición del ítem",
            "value_id": "2230581",
            "value_name": "Usado",
            "values": [
                {
                    "id": "2230581",
                    "name": "Usado",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "PASSENGER_CAPACITY",
            "name": "Capacidad de personas",
            "value_id": null,
            "value_name": "7",
            "values": [
                {
                    "id": null,
                    "name": "7",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "TRIM",
            "name": "Versión",
            "value_id": null,
            "value_name": "1.6 Origine Hdi 115cv",
            "values": [
                {
                    "id": null,
                    "name": "1.6 Origine Hdi 115cv",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "SINGLE_OWNER",
            "name": "Único dueño",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_WINDSCREEN_WIPER",
            "name": "Limpia/lava luneta",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_USB",
            "name": "Entrada USB",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_STEERING_WHEEL_CONTROL",
            "name": "Comando remoto para radio en el volante",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_DOOR_LOCKS",
            "name": "Cierre centralizado de puertas",
            "value_id": null,
            "value_name": "Sí",
            "values": [
                {
                    "id": null,
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_WINDOWS",
            "name": "Cristales eléctricos",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_RAIN_SENSOR",
            "name": "Sensor de lluvia",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_REAR_FOGLIGHTS",
            "name": "Faros antinieblas traseros",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT",
            "name": "Asiento conductor regulable en altura",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_SLIDING_ROOF",
            "name": "Techo solar eléctrico retráctil",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LEATHER_UPHOLSTERY",
            "name": "Tapizado de cuero",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LIGHT_ON_REMINDER",
            "name": "Alarma de luces encendidas",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_MP3_PLAYER",
            "name": "Reproductor de MP3",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ONBOARD_COMPUTER",
            "name": "Computadora de abordo",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PARKING_SENSOR",
            "name": "Sensor de estacionamiento",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PASSENGER_AIRBAG",
            "name": "Airbag para conductor y pasajero",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "VEHICLE_BODY_TYPE",
            "name": "Tipo de carrocería",
            "value_id": "452752",
            "value_name": "Monovolumen",
            "values": [
                {
                    "id": "452752",
                    "name": "Monovolumen",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "HEIGHT",
            "name": "Altura",
            "value_id": null,
            "value_name": "1644 mm",
            "values": [
                {
                    "id": null,
                    "name": "1644 mm",
                    "struct": {
                        "number": 1644,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "WIDTH",
            "name": "Ancho",
            "value_id": null,
            "value_name": "2000 mm",
            "values": [
                {
                    "id": null,
                    "name": "2000 mm",
                    "struct": {
                        "number": 2000,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "DISTANCE_BETWEEN_AXES",
            "name": "Distancia entre ejes",
            "value_id": null,
            "value_name": "3735 mm",
            "values": [
                {
                    "id": null,
                    "name": "3735 mm",
                    "struct": {
                        "number": 3735,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_CAPACITY",
            "name": "Capacidad del tanque",
            "value_id": null,
            "value_name": "55 L",
            "values": [
                {
                    "id": null,
                    "name": "55 L",
                    "struct": {
                        "number": 55,
                        "unit": "L"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "LENGTH",
            "name": "Largo",
            "value_id": null,
            "value_name": "4597 mm",
            "values": [
                {
                    "id": null,
                    "name": "4597 mm",
                    "struct": {
                        "number": 4597,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "VALVES_PER_CYLINDER",
            "name": "Válvulas por cilindro",
            "value_id": null,
            "value_name": "2",
            "values": [
                {
                    "id": null,
                    "name": "2",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "GEAR_NUMBER",
            "name": "Numero de velocidades",
            "value_id": null,
            "value_name": "6",
            "values": [
                {
                    "id": null,
                    "name": "6",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "VEHICLE_TYPE",
            "name": "Tipo de vehículo",
            "value_id": "398351",
            "value_name": "Autos y camionetas",
            "values": [
                {
                    "id": "398351",
                    "name": "Autos y camionetas",
                    "struct": null
                }
            ],
            "value_type": "string"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "thumbnail_id": "859393-MLB92379478091_092025",
    "thumbnail": "http://mla-s1-p.mlstatic.com/859393-MLB92379478091_092025-I.jpg",
    "status": "payment_required",
    "sub_status": [],
    "tags": [
        "test_item"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLA-CARS_AND_VANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2025-10-28T17:02:05.385Z",
    "last_updated": "2025-10-28T17:02:05.385Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

### Financiación con anticipo

Importante:

La inclusión de este atributo está actualmente **habilitada solo para el sitio MLA (Argentina)** .

El atributo **INITIAL_PAYMENT_AMOUNT**  permite al vendedor informar el valor inicial (anticipo) que el comprador debe pagar al cerrar la operación. Este campo es una excelente forma de dar transparencia a la negociación. Al activar esta opción, enviando el atributo, el anuncio exhibirá el valor del anticipo.

Para incluir el atributo de valor del anticipo en su publicación, debe enviar el campo **sale_terms**  como un array en la llamada a la API /items, donde el **value_name**  informa el valor del anticipo para el producto.

| Parámetro | Opcional | Valores |
| --- | --- | --- |
| **id** | No | INITIAL_PAYMENT_AMOUNT |
| **value_name** | No | Valor numérico de la entrada acompañado de la unidad monetaria de la moneda (ej.: 6000000 ARS) |
| **value_struct.unit** | Sí | Unidad monetaria correspondiente. Ej.: ARS |

El valor informado en el campo **"value_name"**  debe corresponder a la **misma moneda (currency_id) que el ítem** . En caso de que el valor de "INITIAL_PAYMENT_AMOUNT" sea enviado en una moneda distinta, el sistema realizará automáticamente la conversión a la moneda del ítem.

Importante:

El atributo **INITIAL_PAYMENT_AMOUNT**  es condicional. Solo puede ser enviado si el campo **WITH_FINANCING_OPTIONS**  está definido como "Sí" (**value_id: 242085** ).

```
    "sale_terms": [
        {
            "id": "WITH_FINANCING_OPTIONS",
            "value_id": "242085",
            "value_name": "Si"
        },
        {
            "id": "INITIAL_PAYMENT_AMOUNT",
            "value_name": "8000000 ARS",
            "value_struct": {
                "unit": "ARS"
            }
        }
    ]
```

Ejemplo de llamada:

```
curl -L -X POST 'https://api.mercadolibre.com/items' \
-H 'Authorization: Bearer $ACCESS_TOKEN' \
-H 'Content-Type: application/json' \
-d '{
    "title": "Anuncio Prueba Auto - No Comprar 4",
    "description": "Vehículo en excelente estado",
    "channels": [
        "marketplace"
    ],
    "pictures": [
        {
            "id": "859393-MLB92379478091_092025"
        }
    ],
    "video_id": "sJLCxVgshzY",
    "category_id": "MLA1744",
    "price": 25000000,
    "currency_id": "ARS",
    "listing_type_id": "silver",
    "available_quantity": 1,
    "location": {
        "address_line": "Solís 2222",
        "zip_code": "",
        "neighborhood": {
            "id": "TUxBQk9MSTgzODNa",
            "name": "Olivos"
        },
        "city": {
            "id": "TUxBQ1ZJQ2E3MTQz",
            "name": "Vicente López"
        },
        "state": {
            "id": "TUxBUEdSQWU4ZDkz",
            "name": "Bs.as. G.b.a. Norte"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "open_hours": "",
        "latitude": -34.5101161,
        "longitude": -58.4765109
    },
    "sale_terms": [
        {
            "id": "WITH_FINANCING_OPTIONS",
            "value_id": "242085",
            "value_name": "Si"
        },
        {
            "id": "INITIAL_PAYMENT_AMOUNT",
            "value_name": "8000000 ARS",
            "value_struct": {
                "unit": "ARS"
            }
        }
    ],
        "attributes": [
            {
                "id": "BRAND",
                "value_name": "Citroën"
            },
            {
                "id": "MODEL",
                "value_name": "C4 Picasso"
            },
            {
                "id": "VEHICLE_YEAR",
                "value_name": "2015"
            },
            {
                "id": "DOORS",
                "value_name": "2"
            },
            {
                "id": "KILOMETERS",
                "value_name": "92000km"
            },
            {
                "id": "FUEL_TYPE",
                "value_name": "Diésel"
            },
            {
                "id": "COLOR",
                "value_name": "Rojo"
            },
            {
                "id": "STEERING",
                "value_name": "Hidráulica"
            },
            {
                "id": "TRANSMISSION",
                "value_name": "Manual"
            },
            {
                "id": "TRACTION_CONTROL",
                "value_name": "Delantera"
            },
            {
                "id": "HAS_ABS_BRAKES",
                "value_name": "Sí"
            },
            {
                "id": "HAS_AIR_CONDITIONING",
                "value_name": "Sí"
            },
            {
                "id": "HAS_ALARM",
                "value_name": "Sí"
            },
            {
                "id": "HAS_ALLOY_WHEELS",
                "value_name": "Sí"
            },
            {
                "id": "HAS_AMFM_RADIO",
                "value_name": "Sí"
            },
            {
                "id": "HAS_AUXILIARY_PORT",
                "value_name": "Sí"
            },
            {
                "id": "ITEM_CONDITION",
                "value_name": "Usado"
            },
            {
                "id": "PASSENGER_CAPACITY",
                "value_name": "7"
            },
            {
                "id": "TRIM",
                "value_name": "1.6 Origine Hdi 115cv"
            },
            {
                "id": "SINGLE_OWNER",
                "value_name": "Sí"
            },
            {
                "id": "HAS_WINDSCREEN_WIPER",
                "value_name": "Sí"
            },
            {
                "id": "HAS_USB",
                "value_name": "Sí"
            },
            {
                "id": "HAS_STEERING_WHEEL_CONTROL",
                "value_name": "Sí"
            },
            {
                "id": "HAS_POWER_DOOR_LOCKS",
                "value_name": "Sí"
            },
            {
                "id": "HAS_POWER_WINDOWS",
                "value_name": "Sí"
            },
            {
                "id": "HAS_RAIN_SENSOR",
                "value_name": "Sí"
            },
            {
                "id": "HAS_REAR_FOGLIGHTS",
                "value_name": "Si"
            },
            {
                "id": "HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT",
                "value_name": "Sí"
            },
            {
                "id": "HAS_SLIDING_ROOF",
                "value_name": "Sí"
            },
            {
                "id": "HAS_LEATHER_UPHOLSTERY",
                "value_name": "Sí"
            },
            {
                "id": "HAS_LIGHT_ON_REMINDER",
                "value_name": "Sí"
            },
            {
                "id": "HAS_MP3_PLAYER",
                "value_name": "Sí"
            },
            {
                "id": "HAS_ONBOARD_COMPUTER",
                "value_name": "Sí"
            },
            {
                "id": "HAS_PARKING_SENSOR",
                "value_name": "Sí"
            },
            {
                "id": "HAS_PASSENGER_AIRBAG",
                "value_name": "Sí"
            },
            {
                "id": "VEHICLE_BODY_TYPE",
                "value_name": "Monovolumen"
            },
            {
                "id": "HEIGHT",
                "value_name": "1644 mm"
            },
            {
                "id": "WIDTH",
                "value_name": "2000 mm"
            },
            {
                "id": "DISTANCE_BETWEEN_AXES",
                "value_name": "3735 mm"
            },
            {
                "id": "FUEL_CAPACITY",
                "value_name": "55 L"
            },
            {
                "id": "LENGTH",
                "value_name": "4597 mm"
            },
            {
                "id": "VALVES_PER_CYLINDER",
                "value_name": "2"
            },
            {
                "id": "GEAR_NUMBER",
                "value_name": "6"
            }
        ]
    }'
```

Respuesta:

```
{
    "id": "MLA1680239363",
    "site_id": "MLA",
    "title": "Anuncio Prueba Auto - No Comprar 4",
    "seller_id": 1697535834,
    "category_id": "MLA1744",
    "user_product_id": "MLAU3811250684",
    "official_store_id": null,
    "price": 25000000,
    "base_price": 25000000,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "ARS",
    "initial_quantity": 1,
    "available_quantity": 1,
    "sold_quantity": 0,
    "sale_terms": [
        {
            "id": "WITH_FINANCING_OPTIONS",
            "name": "Con opciones de financiamiento",
            "value_id": "242085",
            "value_name": "Sí",
            "value_struct": null,
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "INITIAL_PAYMENT_AMOUNT",
            "name": "Valor del anticipo",
            "value_id": null,
            "value_name": "8000000 ARS",
            "value_struct": {
                "number": 8000000,
                "unit": "ARS"
            },
            "values": [
                {
                    "id": null,
                    "name": "8000000 ARS",
                    "struct": {
                        "number": 8000000,
                        "unit": "ARS"
                    }
                }
            ],
            "value_type": "number_unit"
        }
    ],
    "buying_mode": "classified",
    "listing_type_id": "silver",
    "start_time": "2026-02-23T13:11:25.146Z",
    "stop_time": "2026-03-25T04:00:00.000Z",
    "end_time": "2026-03-25T04:00:00.000Z",
    "expiration_time": "2026-05-14T13:11:25.281Z",
    "condition": "used",
    "permalink": "http://auto.mercadolibre.com.ar/MLA-1680239363-anuncio-prueba-auto-no-comprar-4-_JM",
    "pictures": [
        {
            "id": "859393-MLB92379478091_092025",
            "url": "http://mlb-s1-p.mlstatic.com/859393-MLB92379478091_092025-O.jpg",
            "secure_url": "https://mlb-s1-p.mlstatic.com/859393-MLB92379478091_092025-O.jpg",
            "size": "500x375",
            "max_size": "1200x900",
            "quality": ""
        }
    ],
    "video_id": "sJLCxVgshzY",
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": null,
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 1359885413,
        "comment": "Referencia: The Testing Cavern",
        "address_line": "Testing Street 1450",
        "zip_code": "1430",
        "city": {
            "id": "TUxBQlNBQTM3Mzda",
            "name": "Saavedra"
        },
        "state": {
            "id": "AR-C",
            "name": "Capital Federal"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": -34.5601594,
        "longitude": -58.4715658,
        "search_location": {
            "neighborhood": {
                "id": "TUxBQlNBQTM3Mzda",
                "name": "Saavedra"
            },
            "city": {
                "id": "TUxBQ0NBUGZlZG1sYQ",
                "name": "Capital Federal"
            },
            "state": {
                "id": "TUxBUENBUGw3M2E1",
                "name": "Capital Federal"
            }
        }
    },
    "seller_contact": {
        "contact": "",
        "other_info": "",
        "area_code": "",
        "phone": "",
        "phone2": "",
        "email": "",
        "webpage": "",
        "country_code": "",
        "country_code2": ""
    },
    "location": {
        "address_line": "Solís 2222",
        "zip_code": "",
        "neighborhood": {
            "id": "TUxBQk9MSTgzODNa",
            "name": "Olivos"
        },
        "city": {
            "id": "TUxBQ1ZJQ2E3MTQz",
            "name": "Vicente López"
        },
        "state": {
            "id": "TUxBUEdSQWU4ZDkz",
            "name": "Bs.As. G.B.A. Norte"
        },
        "country": {
            "id": "AR",
            "name": "Argentina"
        },
        "latitude": -34.5101161,
        "longitude": -58.4765109,
        "open_hours": ""
    },
    "geolocation": {
        "latitude": -34.5101161,
        "longitude": -58.4765109
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "389169",
            "value_name": "Citroën",
            "values": [
                {
                    "id": "389169",
                    "name": "Citroën",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "389410",
            "value_name": "C4 Picasso",
            "values": [
                {
                    "id": "389410",
                    "name": "C4 Picasso",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "VEHICLE_YEAR",
            "name": "Año",
            "value_id": null,
            "value_name": "2015",
            "values": [
                {
                    "id": null,
                    "name": "2015",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "DOORS",
            "name": "Puertas",
            "value_id": null,
            "value_name": "2",
            "values": [
                {
                    "id": null,
                    "name": "2",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "KILOMETERS",
            "name": "Kilómetros",
            "value_id": null,
            "value_name": "92000 km",
            "values": [
                {
                    "id": null,
                    "name": "92000 km",
                    "struct": {
                        "number": 92000,
                        "unit": "km"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_TYPE",
            "name": "Tipo de combustible",
            "value_id": "60406",
            "value_name": "Diésel",
            "values": [
                {
                    "id": "60406",
                    "name": "Diésel",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "COLOR",
            "name": "Color",
            "value_id": "51993",
            "value_name": "Rojo",
            "values": [
                {
                    "id": "51993",
                    "name": "Rojo",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "STEERING",
            "name": "Dirección",
            "value_id": "370874",
            "value_name": "Hidráulica",
            "values": [
                {
                    "id": "370874",
                    "name": "Hidráulica",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TRANSMISSION",
            "name": "Transmisión",
            "value_id": "370877",
            "value_name": "Manual",
            "values": [
                {
                    "id": "370877",
                    "name": "Manual",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TRACTION_CONTROL",
            "name": "Control de tracción",
            "value_id": "493979",
            "value_name": "Delantera",
            "values": [
                {
                    "id": "493979",
                    "name": "Delantera",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "HAS_ABS_BRAKES",
            "name": "Frenos ABS",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AIR_CONDITIONING",
            "name": "Aire acondicionado",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALARM",
            "name": "Alarma",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALLOY_WHEELS",
            "name": "Llantas de aleación",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AMFM_RADIO",
            "name": "AM/FM",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AUXILIARY_PORT",
            "name": "Entrada auxiliar",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condición del ítem",
            "value_id": "2230581",
            "value_name": "Usado",
            "values": [
                {
                    "id": "2230581",
                    "name": "Usado",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "PASSENGER_CAPACITY",
            "name": "Capacidad de personas",
            "value_id": null,
            "value_name": "7",
            "values": [
                {
                    "id": null,
                    "name": "7",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "TRIM",
            "name": "Versión",
            "value_id": null,
            "value_name": "1.6 Origine Hdi 115cv",
            "values": [
                {
                    "id": null,
                    "name": "1.6 Origine Hdi 115cv",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "SINGLE_OWNER",
            "name": "Único dueño",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_WINDSCREEN_WIPER",
            "name": "Limpia/lava luneta",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_USB",
            "name": "Entrada USB",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_STEERING_WHEEL_CONTROL",
            "name": "Comando remoto para radio en el volante",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_DOOR_LOCKS",
            "name": "Cierre centralizado de puertas",
            "value_id": null,
            "value_name": "Sí",
            "values": [
                {
                    "id": null,
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_WINDOWS",
            "name": "Cristales eléctricos",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_RAIN_SENSOR",
            "name": "Sensor de lluvia",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_REAR_FOGLIGHTS",
            "name": "Faros antinieblas traseros",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT",
            "name": "Asiento conductor regulable en altura",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_SLIDING_ROOF",
            "name": "Techo solar eléctrico retráctil",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LEATHER_UPHOLSTERY",
            "name": "Tapizado de cuero",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LIGHT_ON_REMINDER",
            "name": "Alarma de luces encendidas",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_MP3_PLAYER",
            "name": "Reproductor de MP3",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ONBOARD_COMPUTER",
            "name": "Computadora de abordo",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PARKING_SENSOR",
            "name": "Sensor de estacionamiento",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PASSENGER_AIRBAG",
            "name": "Airbag para conductor y pasajero",
            "value_id": "242085",
            "value_name": "Sí",
            "values": [
                {
                    "id": "242085",
                    "name": "Sí",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "VEHICLE_BODY_TYPE",
            "name": "Tipo de carrocería",
            "value_id": "452752",
            "value_name": "Monovolumen",
            "values": [
                {
                    "id": "452752",
                    "name": "Monovolumen",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "HEIGHT",
            "name": "Altura",
            "value_id": null,
            "value_name": "1644 mm",
            "values": [
                {
                    "id": null,
                    "name": "1644 mm",
                    "struct": {
                        "number": 1644,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "WIDTH",
            "name": "Ancho",
            "value_id": null,
            "value_name": "2000 mm",
            "values": [
                {
                    "id": null,
                    "name": "2000 mm",
                    "struct": {
                        "number": 2000,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "DISTANCE_BETWEEN_AXES",
            "name": "Distancia entre ejes",
            "value_id": null,
            "value_name": "3735 mm",
            "values": [
                {
                    "id": null,
                    "name": "3735 mm",
                    "struct": {
                        "number": 3735,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_CAPACITY",
            "name": "Capacidad del tanque",
            "value_id": null,
            "value_name": "55 L",
            "values": [
                {
                    "id": null,
                    "name": "55 L",
                    "struct": {
                        "number": 55,
                        "unit": "L"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "LENGTH",
            "name": "Largo",
            "value_id": null,
            "value_name": "4597 mm",
            "values": [
                {
                    "id": null,
                    "name": "4597 mm",
                    "struct": {
                        "number": 4597,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "VALVES_PER_CYLINDER",
            "name": "Válvulas por cilindro",
            "value_id": null,
            "value_name": "2",
            "values": [
                {
                    "id": null,
                    "name": "2",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "GEAR_NUMBER",
            "name": "Numero de velocidades",
            "value_id": null,
            "value_name": "6",
            "values": [
                {
                    "id": null,
                    "name": "6",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "VEHICLE_TYPE",
            "name": "Tipo de vehículo",
            "value_id": "398351",
            "value_name": "Autos y camionetas",
            "values": [
                {
                    "id": "398351",
                    "name": "Autos y camionetas",
                    "struct": null
                }
            ],
            "value_type": "string"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "thumbnail_id": "859393-MLB92379478091_092025",
    "thumbnail": "http://mla-s1-p.mlstatic.com/859393-MLB92379478091_092025-I.jpg",
    "status": "active",
    "sub_status": [],
    "tags": [
        "test_item",
        "immediate_payment"
   ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLA-CARS_AND_VANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2026-02-23T13:11:25.432Z",
    "last_updated": "2026-02-23T13:11:25.432Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

Nota:

Es necesario que toda publicación contenga el precio final del producto en el campo “price”. El uso del atributo **“INITIAL_PAYMENT_AMOUNT”**  no exime al vendedor del requisito de informar el precio total. El envío de este atributo es opcional.

## Listing Type

Básicamente es el plan contratado por su cliente. Se trata de otro caso de un atributo obligatorio que solo admite valores predefinidos y es muy importante. Existen diferentes tipos de publicación disponibles para cada sitio. Debes realizar una llamada mixta a través de los sitios y de los recursos listing_types para saber cuáles son los listing_types admitidos. Sigue nuestra guía para saber [qué tipo de publicación es más conveniente para tu anuncio](https://developers.mercadolibre.com.ar/es_ar/vehiculos-gestiona-paquetes).

## Ubicación

Al publicar un anuncio clasificado, es obligatorio enviar su ubicación. La ubicación de Mercado Libre posee 4 niveles: country, state, city y neighborhood. Debes enviar como mínimo, city o neighborhood. Ejemplo:

```
  location: {
    address_line: "Avenida Jurucê, 436",
    zip_code: "04080011",
    neighborhood: {
      id: "TUxCQklORHduMDB0"
    },
    "city": {
      "id": "TUxCQ1NQLTkxMjE",
    },
    "state": {
    "id": "TUxCUFNBT085N2E4",
    },
    "country": {
    "id": "BR",
    },
  },
```

Para cada ubicación enviada, incluya su respectivo **id** , según el ejemplo anterior. En el campo **address_line** , informe siempre la calle seguida del número. El número debe ser la última información enviada en este campo.

**Ejemplo correcto:**  Avenida Jurucê, 436

**Ejemplo incorrecto:**  Avenida Jurucê, 436 Moema

Para consultar los códigos de ubicación de Mercado Libre, [visite este enlace](https://developers.mercadolibre.com.ar/es_ar/localizacion-de-vehiculos).

## Contacto del vendedor (seller_contact)

El objeto **seller_contact**  reúne los datos de contacto mostrados en la publicación y habilita el contacto vía WhatsApp a través de **country_code2**  y **phone2** .

Nota:

A partir del **01/10/2026** , **country_code2**  y **phone2**  pasan a ser obligatorios para todas las publicaciones de Vehículos (Motors) cuando la cuenta del vendedor tiene perfil de **concesionario (car dealer)** . El número de WhatsApp debe incluir el código de país en **country_code2**  (ej.: "54") y el número de celular en **phone2**  (ej.: "935122222222").

| Campo | Tipo | Estado (a partir del 01/10/2026) | Descripción |
| --- | --- | --- | --- |
| contact | String | Opcional | Nombre del contacto o representante. |
| other_info | String | Opcional | Información adicional de contacto. |
| country_code | String | Opcional | Código de país del teléfono principal. |
| area_code | String | Opcional | Código de área del teléfono principal. |
| phone | String | Opcional | Número de teléfono principal del vendedor. |
| email | String | Opcional | E-mail del vendedor para recibir consultas. |
| webpage | String | Opcional | Sitio web del vendedor o de la inmobiliaria. |
| country_code2 | String | **Obligatorio** | Código de país del número de WhatsApp. |
| phone2 | String | **Obligatorio** | Número de WhatsApp del vendedor. |

Ejemplo de la estructura completa:

```
 "seller_contact": {
    "contact": "",
    "other_info": "",
    "country_code": "54",
    "area_code": "",
    "phone": "935122222222",
    "country_code2": "54",
    "phone2": "935122222222",
    "email": "contato@testimobiliaria.com",
    "webpage": ""
  }
```

### Errores de validación "seller_contact"

**Importante:**

Los campos **country_code2**  y **phone2**  deben contener solo dígitos numéricos, sin los caracteres "+", espacios, paréntesis o guiones. Cada dato debe enviarse en el campo correspondiente. En **country_code2**  solo se debe enviar el código de País y el resto del número concatenado en **phone2** .

Si los campos obligatorios no son enviados o están vacíos, la API retornará **HTTP 400**  con uno de los códigos siguientes.

| Código de error | HTTP | Descripción | Acción |
| --- | --- | --- | --- |
| seller_contact.required | 400 | El objeto seller_contact no fue enviado. | Incluir el objeto seller_contact completo en la solicitud. |
| seller_contact.country_code2.required | 400 | country_code2 es obligatorio para este tipo de publicación. | Incluir un número de WhatsApp válido en seller_contact.country_code2. |
| seller_contact.phone2.required | 400 | phone2 es obligatorio para este tipo de publicación. | Incluir un número de WhatsApp válido en seller_contact.phone2. |
| seller_contact.country_code2.invalid | 400 | El valor de country_code2 no tiene formato válido. | Verificar que no haya caracteres especiales ni espacios. |
| seller_contact.phone2.invalid | 400 | El valor de phone2 no tiene formato válido. | Verificar que no haya caracteres especiales ni espacios. |

Nota:

Cuando hay preguntas de compradores en los anuncios, Mercado Libre las envía al correo electrónico del vendedor (consignado en el campo seller_contact.email). En caso de que no sea informado, Mercado Libre utilizará el correo electrónico de la cuenta del vendedor en el sitio.

## Available_quantity

Siempre debe enviarse “1”. Representa la cantidad de artículos de este anuncio. En Mercado Libre, los anuncios clasificados no funcionan con existencias, cada anuncio representa un registro de inmueble / vehículo / servicio único.

## Condition

Puede ser “new” o “used” según la condición del anuncio que se enviará.

## Publica un vehículo

Importante:

Para evitar errores en la publicación de un ítem de clasificados, **es obligatorio enviar el atributo “buying_mode” con el valor "classified"** . Si este campo no se informa correctamente, se retornará un error solicitando el envío del campo “family_name”, requisito que no aplica a las publicaciones de clasificados.

Estás listo para publicar tu primer artículo. Recuerda que necesitarás un access_token para hacerlo. Si tienes preguntas sobre cómo obtener tu access token, [por favor regresa al tutorial de autenticación](https://developers.mercadolibre.com.ar/es_ar/autenticacion-y-autorizacion/). También te recomendamos utilizar usuarios de test para publicar artículos de prueba. Si no estás familiarizado con los mismos, [por favor consulta la sección generar usuarios de test aquí](https://developers.mercadolibre.com.ar/es_ar/validador-de-publicaciones). 

 Además, te recomendamos validar el JSON que envías antes de realizar la solicitud POST; por eso, será mejor que consultes este tutorial de validación de artículos, que es fácil y rápido. Puedes crear un JSON para tu artículo en base al ejemplo a continuación o simplemente envíalo así y estarás publicando un vehículo de muestra en el site:

```
curl -X POST -H 'Authorization: Bearer $ACCESS_TOKEN' -H "Content-Type: application/json" -d 
{
    "title": "ANUNCIO TESTE PROVA CARRO",
    "category_id": "MLB1744",
    "price": 155000,
    "currency_id": "BRL",
    "available_quantity": 1,
    "buying_mode": "classified",
    "listing_type_id": "silver",
    "condition": "new",
    "description": {
        "plain_text": "Veículo em ótimo estado"
    },
    "channels": [
        "marketplace"
    ],
    "pictures": [
        {
            "source": "https://cdn.pixabay.com/photo/2017/06/15/04/13/car-2404064__340.png"
        },
        {
            "source": "https://cdn.pixabay.com/photo/2018/03/06/19/44/mercedes-benz-3204364__340.png"
        }
    ],
    "video_id": "sJLCxVgshzY",
    "seller_contact": {
        "contact": "Contact name",
        "other_info": "Additional contact info",
        "country_code": "55",
        "area_code": "011",
        "phone": "4444-5555",
        "country_code2": "55",
        "phone2": "992999999",
        "email": "contact-email@somedomain.com",
        "webpage": ""
    },
    "location": {
        "address_line": "Avenida Juruce, 436",
        "zip_code": "04080011",
        "city": {
            "id": "BR-SP-56"
        }
    },
    "attributes": [
        {
            "id": "BRAND",
            "value_name": "Kia"
        },
        {
            "id": "MODEL",
            "value_name": "Soul"
        },
        {
            "id": "VEHICLE_YEAR",
            "value_name": "2012"
        },
        {
            "id": "DOORS",
            "value_name": "4"
        },
        {
            "id": "KILOMETERS",
            "value_name": "92000 km"
        },
        {
            "id": "FUEL_TYPE",
            "value_name": "Gasolina"
        },
        {
            "id": "COLOR",
            "value_name": "Preto"
        },
        {
            "id": "STEERING",
            "value_name": "Elétrica"
        },
        {
            "id": "CONTACT_SCHEDULE",
            "value_name": "Me procurar a tarde"
        },
        {
            "id": "TRANSMISSION",
            "value_name": "Automática"
        },
        {
            "id": "TRACTION_CONTROL",
            "value_name": "Dianteira"
        },
        {
            "id": "ARMORED",
            "value_name": "Não"
        },
        {
            "id": "HAS_ABS_BRAKES",
            "value_name": "Sim"
        },
        {
            "id": "HAS_AIR_CONDITIONING",
            "value_name": "Sim"
        },
        {
            "id": "HAS_ALARM",
            "value_name": "Sim"
        },
        {
            "id": "HAS_ALLOY_WHEELS",
            "value_name": "Sim"
        },
        {
            "id": "HAS_AMFM_RADIO",
            "value_name": "Sim"
        },
        {
            "id": "HAS_AUXILIARY_PORT",
            "value_name": "Sim"
        },
        {
            "id": "LICENSE_PLATE",
            "value_name": "EWP5306"
        },
        {
            "id": "PASSENGER_CAPACITY",
            "value_name": "5"
        },
        {
            "id": "TRIM",
            "value_name": "1.6 16V"
        },
        {
            "id": "SINGLE_OWNER",
            "value_name": "Sim"
        },
        {
            "id": "HAS_WINDSCREEN_WIPER",
            "value_name": "Sim"
        },
        {
            "id": "HAS_USB",
            "value_name": "Sim"
        },
        {
            "id": "HAS_STEERING_WHEEL_CONTROL",
            "value_name": "Sim"
        },
        {
            "id": "HAS_POWER_DOOR_LOCKS",
            "value_name": "Sim"
        },
        {
            "id": "HAS_POWER_WINDOWS",
            "value_name": "Sim"
        },
        {
            "id": "HAS_RAIN_SENSOR",
            "value_name": "Sim"
        },
        {
            "id": "HAS_REAR_FOGLIGHTS",
            "value_name": "Sim"
        },
        {
            "id": "HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT",
            "value_name": "Sim"
        },
        {
            "id": "HAS_SLIDING_ROOF",
            "value_name": "Sim"
        },
        {
            "id": "HAS_LEATHER_UPHOLSTERY",
            "value_name": "Sim"
        },
        {
            "id": "HAS_LIGHT_ON_REMINDER",
            "value_name": "Sim"
        },
        {
            "id": "HAS_MP3_PLAYER",
            "value_name": "Sim"
        },
        {
            "id": "HAS_ONBOARD_COMPUTER",
            "value_name": "Sim"
        },
        {
            "id": "HAS_PARKING_SENSOR",
            "value_name": "Sim"
        },
        {
            "id": "HAS_PASSENGER_AIRBAG",
            "value_name": "Sim"
        },
        {
            "id": "HEIGHT",
            "value_name": "1625 mm"
        },
        {
            "id": "WIDTH",
            "value_name": "1800 mm"
        },
        {
            "id": "DISTANCE_BETWEEN_AXES",
            "value_name": "2570 mm"
        },
        {
            "id": "FUEL_CAPACITY",
            "value_name": "54 L"
        },
        {
            "id": "LENGTH",
            "value_name": "4140 mm"
        },
        {
            "id": "VALVES_PER_CYLINDER",
            "value_name": "4"
        },
        {
            "id": "GEAR_NUMBER",
            "value_name": "6"
        },
        {
            "id": "HAS_CURTAIN_AIRBAG",
            "value_name": "Sim"
        },
        {
            "id": "HAS_FOG_LIGHT",
            "value_name": "Sim"
        },
        {
            "id": "HAS_REAR_FOLDING_SEAT",
            "value_name": "Sim"
        },
        {
            "id": "HAS_ELECTRIC_MIRRORS",
            "value_name": "Sim"
        },
        {
            "id": "HAS_AUTOPILOT",
            "value_name": "Sim"
        }
    ]
}
https://api.mercadolibre.com/items
```

Al realizar el POST anterior, la API de Mercado Libre te enviará el JSON de retorno con la información del artículo creado. Uno de los campos retornados es el permalink, que contiene el enlace a la página de detalles del anuncio recién creado. Ejemplo de respuesta

```
{
    "id": "MLB7539811118",
    "site_id": "MLB",
    "title": "Anuncio Teste Prova Carro",
    "seller_id": 1944040506,
    "category_id": "MLB1744",
    "user_product_id": "MLBU5004044358",
    "official_store_id": null,
    "price": 155000,
    "base_price": 155000,
    "original_price": null,
    "inventory_id": null,
    "currency_id": "BRL",
    "initial_quantity": 1,
    "available_quantity": 1,
    "sold_quantity": 0,
    "sale_terms": [],
    "buying_mode": "classified",
    "listing_type_id": "silver",
    "start_time": "2026-08-28T12:23:24.496Z",
    "stop_time": "2027-08-28T04:00:00.000Z",
    "end_time": "2027-08-28T04:00:00.000Z",
    "expiration_time": "2026-11-16T12:23:24.657Z",
    "condition": "used",
    "permalink": "http://carro.mercadolivre.com.br/MLB-7539811118-anuncio-teste-prova-carro-_JM",
    "pictures": [
        {
            "id": "882251-MLB115434869132_082026",
            "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-PT.jpg",
            "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-PT.jpg",
            "size": "500x500",
            "max_size": "500x500",
            "quality": ""
        },
        {
            "id": "978193-MLB115434869134_082026",
            "url": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-PT.jpg",
            "secure_url": "https://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/O-PT.jpg",
            "size": "500x500",
            "max_size": "500x500",
            "quality": ""
        }
    ],
    "video_id": "sJLCxVgshzY",
    "descriptions": [],
    "accepts_mercadopago": true,
    "non_mercado_pago_payment_methods": [],
    "shipping": {
        "mode": "not_specified",
        "local_pick_up": false,
        "free_shipping": false,
        "methods": [],
        "dimensions": null,
        "tags": [],
        "logistic_type": null,
        "store_pick_up": false
    },
    "international_delivery_mode": "none",
    "seller_address": {
        "id": 0
    },
    "seller_contact": {
        "contact": "Contact name",
        "other_info": "Additional contact info",
        "area_code": "011",
        "phone": "4444-5555",
        "area_code2": "",
        "phone2": "992999999",
        "email": "contact-email@somedomain.com",
        "webpage": "",
        "country_code": "55",
        "country_code2": "55"
    },
    "location": {
        "address_line": "Avenida Juruce, 436",
        "zip_code": "04080011",
        "neighborhood": {
            "id": "",
            "name": ""
        },
        "city": {
            "id": "BR-SP-56",
            "name": "Atibaia"
        },
        "state": {
            "id": "BR-SP",
            "name": "São Paulo"
        },
        "country": {
            "id": "BR",
            "name": "Brasil"
        },
        "open_hours": ""
    },
    "geolocation": {
        "latitude": "",
        "longitude": ""
    },
    "coverage_areas": [],
    "attributes": [
        {
            "id": "BRAND",
            "name": "Marca",
            "value_id": "374002",
            "value_name": "Kia",
            "values": [
                {
                    "id": "374002",
                    "name": "Kia",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "MODEL",
            "name": "Modelo",
            "value_id": "235012",
            "value_name": "Soul",
            "values": [
                {
                    "id": "235012",
                    "name": "Soul",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "VEHICLE_YEAR",
            "name": "Ano",
            "value_id": null,
            "value_name": "2012",
            "values": [
                {
                    "id": null,
                    "name": "2012",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "DOORS",
            "name": "Portas",
            "value_id": null,
            "value_name": "4",
            "values": [
                {
                    "id": null,
                    "name": "4",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "KILOMETERS",
            "name": "Quilômetros",
            "value_id": null,
            "value_name": "92000 km",
            "values": [
                {
                    "id": null,
                    "name": "92000 km",
                    "struct": {
                        "number": 92000,
                        "unit": "km"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_TYPE",
            "name": "Tipo de combustível",
            "value_id": "64364",
            "value_name": "Gasolina",
            "values": [
                {
                    "id": "64364",
                    "name": "Gasolina",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "COLOR",
            "name": "Cor",
            "value_id": "52049",
            "value_name": "Preto",
            "values": [
                {
                    "id": "52049",
                    "name": "Preto",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "STEERING",
            "name": "Direção",
            "value_id": "405719",
            "value_name": "Elétrica",
            "values": [
                {
                    "id": "405719",
                    "name": "Elétrica",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "CONTACT_SCHEDULE",
            "name": "Horário de contato",
            "value_id": null,
            "value_name": "Me procurar a tarde",
            "values": [
                {
                    "id": null,
                    "name": "Me procurar a tarde",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "TRANSMISSION",
            "name": "Transmissão",
            "value_id": "370876",
            "value_name": "Automática",
            "values": [
                {
                    "id": "370876",
                    "name": "Automática",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "TRACTION_CONTROL",
            "name": "Controle de tração",
            "value_id": "493979",
            "value_name": "Dianteira",
            "values": [
                {
                    "id": "493979",
                    "name": "Dianteira",
                    "struct": null
                }
            ],
            "value_type": "list"
        },
        {
            "id": "ARMORED",
            "name": "Blindado",
            "value_id": "242084",
            "value_name": "Não",
            "values": [
                {
                    "id": "242084",
                    "name": "Não",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ABS_BRAKES",
            "name": "Freios ABS",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AIR_CONDITIONING",
            "name": "Ar-condicionado",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALARM",
            "name": "Alarme",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ALLOY_WHEELS",
            "name": "Rodas de liga leve",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AMFM_RADIO",
            "name": "AM/FM",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AUXILIARY_PORT",
            "name": "Entrada auxiliar",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "LICENSE_PLATE",
            "name": "Placa",
            "value_id": null,
            "value_name": "EWP5306",
            "values": [
                {
                    "id": null,
                    "name": "EWP5306",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "PASSENGER_CAPACITY",
            "name": "Quantidade de pessoas",
            "value_id": null,
            "value_name": "5",
            "values": [
                {
                    "id": null,
                    "name": "5",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "TRIM",
            "name": "Versão",
            "value_id": null,
            "value_name": "1.6 16V",
            "values": [
                {
                    "id": null,
                    "name": "1.6 16V",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "SINGLE_OWNER",
            "name": "Único dono",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_WINDSCREEN_WIPER",
            "name": "Limpador traseiro",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_USB",
            "name": "Entrada USB",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_STEERING_WHEEL_CONTROL",
            "name": "Controle remoto para rádio no volante",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_DOOR_LOCKS",
            "name": "Travas elétricas de portas",
            "value_id": null,
            "value_name": "Sim",
            "values": [
                {
                    "id": null,
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_POWER_WINDOWS",
            "name": "Vidros elétricos",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_RAIN_SENSOR",
            "name": "Sensor de chuva",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_REAR_FOGLIGHTS",
            "name": "Faróis de neblina traseiros",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_HEIGHT_ADJUSTABLE_DRIVER_SEAT",
            "name": "Banco motorista com regulagem de altura",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_SLIDING_ROOF",
            "name": "Teto solar elétrico retrátil",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LEATHER_UPHOLSTERY",
            "name": "Bancos em couro",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_LIGHT_ON_REMINDER",
            "name": "Alarme de luzes acesas",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_MP3_PLAYER",
            "name": "Leitor de MP3",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ONBOARD_COMPUTER",
            "name": "Computador de bordo",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PARKING_SENSOR",
            "name": "Sensor de estacionamento",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_PASSENGER_AIRBAG",
            "name": "Airbag para motorista e passageiro",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HEIGHT",
            "name": "Altura",
            "value_id": null,
            "value_name": "1625 mm",
            "values": [
                {
                    "id": null,
                    "name": "1625 mm",
                    "struct": {
                        "number": 1625,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "WIDTH",
            "name": "Largura",
            "value_id": null,
            "value_name": "1800 mm",
            "values": [
                {
                    "id": null,
                    "name": "1800 mm",
                    "struct": {
                        "number": 1800,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "DISTANCE_BETWEEN_AXES",
            "name": "Distância entre eixos",
            "value_id": null,
            "value_name": "2570 mm",
            "values": [
                {
                    "id": null,
                    "name": "2570 mm",
                    "struct": {
                        "number": 2570,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "FUEL_CAPACITY",
            "name": "Tanque de combustível",
            "value_id": null,
            "value_name": "54 L",
            "values": [
                {
                    "id": null,
                    "name": "54 L",
                    "struct": {
                        "number": 54,
                        "unit": "L"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "LENGTH",
            "name": "Comprimento",
            "value_id": null,
            "value_name": "4140 mm",
            "values": [
                {
                    "id": null,
                    "name": "4140 mm",
                    "struct": {
                        "number": 4140,
                        "unit": "mm"
                    }
                }
            ],
            "value_type": "number_unit"
        },
        {
            "id": "VALVES_PER_CYLINDER",
            "name": "Válvulas por cilindro",
            "value_id": null,
            "value_name": "4",
            "values": [
                {
                    "id": null,
                    "name": "4",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "GEAR_NUMBER",
            "name": "Número de velocidades",
            "value_id": null,
            "value_name": "6",
            "values": [
                {
                    "id": null,
                    "name": "6",
                    "struct": null
                }
            ],
            "value_type": "number"
        },
        {
            "id": "HAS_CURTAIN_AIRBAG",
            "name": "Airbag de cortina",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_FOG_LIGHT",
            "name": "Faróis anti-nevoeiro",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_REAR_FOLDING_SEAT",
            "name": "Banco traseiro retrátil",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_ELECTRIC_MIRRORS",
            "name": "Controle elétrico para os retrovisores",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "HAS_AUTOPILOT",
            "name": "Piloto automático",
            "value_id": "242085",
            "value_name": "Sim",
            "values": [
                {
                    "id": "242085",
                    "name": "Sim",
                    "struct": null
                }
            ],
            "value_type": "boolean"
        },
        {
            "id": "VEHICLE_TYPE",
            "name": "Tipo de veículo",
            "value_id": "398351",
            "value_name": "Carros e caminhonetes",
            "values": [
                {
                    "id": "398351",
                    "name": "Carros e caminhonetes",
                    "struct": null
                }
            ],
            "value_type": "string"
        },
        {
            "id": "ITEM_CONDITION",
            "name": "Condição do item",
            "value_id": "2230581",
            "value_name": "Usado",
            "values": [
                {
                    "id": "2230581",
                    "name": "Usado",
                    "struct": null
                }
            ],
            "value_type": "list"
        }
    ],
    "warnings": [],
    "listing_source": "",
    "variations": [],
    "thumbnail_id": "882251-MLB115434869132_082026",
    "thumbnail": "http://http2.mlstatic.com/resources/frontend/statics/processing-image/1.0.0/I-PT.jpg",
    "status": "active",
    "sub_status": [],
        "picture_download_pending"
    ],
    "tags": [
        "test_item"
    ],
    "warranty": null,
    "catalog_product_id": null,
    "domain_id": "MLB-CARS_AND_VANS",
    "seller_custom_field": null,
    "parent_item_id": null,
    "differential_pricing": null,
    "deal_ids": [],
    "automatic_relist": false,
    "date_created": "2026-08-28T12:23:24.854Z",
    "last_updated": "2026-08-28T12:23:24.854Z",
    "health": null,
    "catalog_listing": false,
    "item_relations": [],
    "channels": [
        "marketplace"
    ]
}
```

## Anuncios duplicados

Cada publicación debe incluirse solo una vez. Mercado Libre posee mecanismos para identificar posibles anuncios duplicados, por eso es importante. No enviar publicaciones duplicadas. En caso de que se considere que una publicación fue duplicada, esta se incluirá vía API, pero quedará con el estado “under review”.

## Ítems penalizados

Son los ítems penalizados necesitan de la atención del vendedor para que vuelvan a tener una buena exposición o, en casos graves, no sean pausados. Para identificar estos ítems para los dominios de Vehículos e Inmuebles, disponibilizamos 2 tags con los siguientes motivos de penalización:

- misplaced_personal_data: ítem penalizado por datos personales en campos no indicados.

- moderation_penalty : Ítem penalizado. En este caso, por ser un tag genérico, es necesario hacer una consulta al recurso [/infractions](https://developers.mercadolibre.com.ar/es_ar/validador-de-publicaciones) para conocer el motivo.

Para listar los ítems en esta condición, es posible utilizar el GET:

Llamada:

```
curl --location --request GET 'https://api.mercadolibre.com/users/$USER_ID/items/search?tags=$TAG' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo:

```
curl --location --request GET 'https://api.mercadolibre.com/users/705332753/items/search?tags=misplaced_personal_data' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

Respuesta:

```
{

   "seller_id": "705332753",
   "query": null,
   "paging": {
       "limit": 50,
       "offset": 0,
       "total": 1
   },
   "results": [
       "MLB1790900231"
   ],
   "orders": [
       {
           "id": "stop_time_asc",
           "name": "Order by stop time ascending"
       }
   ],
   "available_orders": [
       {
           "id": "stop_time_asc",
           "name": "Order by stop time ascending"
       },
       {
           "id": "stop_time_desc",
           "name": "Order by stop time descending"
       },
       {
           "id": "start_time_asc",
           "name": "Order by start time ascending"
       },
       {
           "id": "start_time_desc",
           "name": "Order by start time descending"
       },
       {
           "id": "available_quantity_asc",
           "name": "Order by available quantity ascending"
       },
       {
           "id": "available_quantity_desc",
           "name": "Order by available quantity descending"
       },
       {
           "id": "sold_quantity_asc",
           "name": "Order by sold quantity ascending"
       },
       {
           "id": "sold_quantity_desc",
           "name": "Order by sold quantity descending"
       },
       {
           "id": "price_asc",
           "name": "Order by price ascending"
       },
       {
           "id": "price_desc",
           "name": "Order by price descending"
       },
       {
           "id": "last_updated_desc",
           "name": "Order by lastUpdated descending"
       },
       {
           "id": "last_updated_asc",
           "name": "Order by last updated ascending"
       },
       {
           "id": "total_sold_quantity_asc",
           "name": "Order by total sold quantity ascending"
       },
       {
           "id": {
               "id": "total_sold_quantity_desc",
               "field": "sold_quantity",
               "missing": "_last",
               "order": "desc"
           },
           "name": "Order by total sold quantity descending"
       },
       {
 
          "id": {
               "id": "inventory_id_asc",
               "field": "inventory_id",
               "missing": "_last",
               "order": "asc"
           },
           "name": "Order by inventory id ascending"
       }
   ]
}
}
```

## Marca, modelo y versión

Marca y modelo son atributos obligatorios ([obtén más información sobre las categorías y atributos](https://developers.mercadolibre.com.ar/es_ar/categorias-y-atributos)) pero la versión es un atributo denominado “TRIM”. Este atributo también es obligatorio y debe enviarse junto con los otros atributos en la matriz “attributes”. Este es un campo de texto abierto y el integrador debe enviar la versión como tipo texto. En el ejemplo anterior, TRIM = XRS.

## Tiendas Oficiales para Vehículos e Inmuebles

Consulta la siguiente guía sobre [Tiendas Oficiales para Vehículos e Inmuebles](https://developers.mercadolibre.com.ar/es_ar/publica-inmuebles#Tiendas-Oficiales-para-Veh%C3%ADculos-e-Inmuebles).

## Publicar en la categoría Motos transaccionales

Nota:

En los sites México, Argentina, Colombia, Brasil y Uruguay publicar motos transaccionales estará permitido sólo para vendedores autorizados.

Los category_id de Motos transaccionales son: MLM455863, MLA455863, MCO455863, MLB455863 y MLU455863 respectivamente según el site. En caso de que el vendedor no esté autorizado, recibirás el error: **moderations.seller_id.not_authorized**  - **Seller is not authorized for this brand and category** . En caso que el cliente no esté autorizado, debe contactarse con el ejecutivo comercial de Mercado Libre que le fue asignado.

## Configurar paquete para usuario de prueba

Para añadir un paquete para publicaciones de prueba, cargue los datos de su usuario de test en el [formulario.](https://docs.google.com/forms/d/e/1FAIpQLSdRNOPcnfnVBHIq4CFSoTzJh8Rr2g6vJHBcAV7AyeIwSN41ug/viewform)

## Actualizaciones de versión

Esta sección proporciona información sobre las actualizaciones de la API, incluyendo:

### Historial de cambios

| Fecha | Versión | Descripción |
| --- | --- | --- |
| 28/08/2026 | 1.1 | Actualización sobre la obligatoriedad de los campos **country_code2**  y **phone2**  en seller_contact para todas las publicaciones de Vehículos (Motors) cuando la cuenta del vendedor tiene perfil de concesionario (car dealer) |

**Siguiente:**  [Sincroniza publicaciones](https://developers.mercadolibre.com.ar/es_ar/vehiculos-sincroniza-publicaciones).
