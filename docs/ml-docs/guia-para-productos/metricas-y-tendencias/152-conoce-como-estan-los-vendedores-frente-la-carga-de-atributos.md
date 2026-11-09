<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/conoce-como-estan-los-vendedores-frente-la-carga-de-atributos -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Carga de atributos

Última actualización 13/11/2023

## Carga de atributos

En Mercado Libre le damos mucha importancia a las fichas técnicas y códigos universales de los productos. Completarlos ayudará a los vendedores.

- Tendrán más exposición en los listados.

- Tendrán información más organizada en su publicación, y se evitarán preguntas innecesarias.

- Los datos de sus productos se verán mejor que en la descripción.

- Además, con esta información crearemos filtros de búsqueda para que los encuentren más fácil.

Sabemos que más ventas para ellos significan más ventas para tí. Por eso, te compartimos una API en la que podrás conocer qué datos les faltan a tus vendedores y así ayudarlos a tener publicaciones más completas.

## Glosario

**domains** : Los dominios son familias de productos que comparten características en común. Por ejemplo, todos los “Celulares” tienen pantalla, memoria, etc.
 **pi** : Los products identifier son los códigos universales de productos. Entre ellos están el EAN, UPC, JAN, GTIN14, ISBN, ISBN10 e ISBN13. Ten en cuenta que actualmente GTIN es el PI en el cual se centralizan y agrupan todos los PIs existentes. 
 **ft** : La ficha técnica del producto es el conjunto de atributos que describen al producto.

## Conocer el estado de un vendedor

Para ver las métricas generales de un vendedor, agrupadas por dominio (Celulares, Cámaras digitales, etc), realiza una llamada por seller_id. Si quieres conocer las métricas de un vendedor en relación a un dominio en particular, podrás realizar un llamado por seller_id + domain_id + included_items=true. De esta forma, podrás ver el detalle de las publicaciones de ese dominio. Si prefieres conocer una publicación específica del vendedor, podrás hacer un llamado pasando como parámetro el item_id. 
Al agregarle include_items=true, puede que el JSON se vuelva muy pesado. Por eso, te recomendamos usarlo junto al filtro domain_id. De esta forma, solo verás las publicaciones de un dominio en particular.

Notas:

- Para cada dominio, se devolverán los ids de las publicaciones que estén incompletos o de aquellos que están completos pero no son de calidad.
- Por cada publicación, se devolverán los atributos que faltan completar.
- Esta funcionalidad sólo está disponible para vendedores que tengan hasta 80.000 items publicados.

Llamada:

```
curl -H 'Authorization: Bearer $ACCESS_TOKEN' -X GET https://api.mercadolibre.com/catalog_quality/status?seller_id=$SELLER_ID&include_items=$BOOL&v=$VERSION
```

Ejemplo:

```
curl -H 'Authorization: Bearer $ACCESS_TOKEN' -X GET https://api.mercadolibre.com/catalog_quality/status?seller_id=321654987&include_items=true&v=32
```

Respuesta correcta (code: 200):

```
{
    "status": {
        "metrics": {
            "pi": {
                "complete_items": 12,
                "complete_attributes": 12,
                "incomplete_attributes": 7
            },
            "ft": {
                "complete_items": 17,
                "complete_attributes": 161,
                "incomplete_attributes": 5
            },
            "all": {
                "complete_items": 11,
                "complete_attributes": 173,
                "incomplete_attributes": 12
            }
        },
        "total_items": 19
    },
    "domains": [
        {
            "domain_id": "MLA-CELLPHONES",
            "status": {
                "metrics": {
                    "pi": {
                        "complete_items": 6,
                        "complete_attributes": 6,
                        "incomplete_attributes": 6
                    },
                    "ft": {
                        "complete_items": 12,
                        "complete_attributes": 84,
                        "incomplete_attributes": 0
                    },
                    "all": {
                        "complete_items": 6,
                        "complete_attributes": 90,
                        "incomplete_attributes": 6
                    }
                },
                "total_items": 12
            },
            "items": [
                {
                    "item_id": "MLA853874437",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": false,
                            "attributes": [],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR",
                                "BRAND",
                                "MODEL"
                            ],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        }
                    }
                },
                {
                    "item_id": "MLA853873411",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": false,
                            "attributes": [],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR",
                                "BRAND",
                                "MODEL",
                                "LINE"
                            ],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        }
                    }
                },
                {
                    "item_id": "MLA818878419",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": false,
                            "attributes": [],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "COLOR",
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM"
                            ],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        }
                    }
                },
                {
                    "item_id": "MLA818890468",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": false,
                            "attributes": [],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        }
                    }
                },
                {
                    "item_id": "MLA846817755",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR",
                                "GTIN",
                                "BRAND",
                                "MODEL"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA835210381",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": false,
                            "attributes": [],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR",
                                "BRAND"
                            ],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        }
                    }
                },
                {
                    "item_id": "MLA835209438",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "COLOR",
                                "GTIN",
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA822384992",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "RAM",
                                "COLOR",
                                "GTIN",
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA820020580",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR",
                                "GTIN",
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA814728541",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR",
                                "GTIN"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA814045288",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": false,
                            "attributes": [],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        }
                    }
                },
                {
                    "item_id": "MLA813102974",
                    "domain_id": "MLA-CELLPHONES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "LINE",
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "IS_DUAL_SIM",
                                "INTERNAL_MEMORY",
                                "RAM",
                                "COLOR",
                                "GTIN",
                                "BRAND",
                                "MODEL",
                                "LINE"
                            ],
                            "missing_attributes": []
                        }
                    }
                }
            ]
        },
        {
            "domain_id": "MLA-MICROWAVES",
            "status": {
                "metrics": {
                    "pi": {
                        "complete_items": 2,
                        "complete_attributes": 2,
                        "incomplete_attributes": 0
                    },
                    "ft": {
                        "complete_items": 2,
                        "complete_attributes": 16,
                        "incomplete_attributes": 0
                    },
                    "all": {
                        "complete_items": 2,
                        "complete_attributes": 18,
                        "incomplete_attributes": 0
                    }
                },
                "total_items": 2
            },
            "items": [
                {
                    "item_id": "MLA813975978",
                    "domain_id": "MLA-MICROWAVES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "COLOR",
                                "WITH_MIRRORED_DOOR",
                                "VOLUME_CAPACITY",
                                "WITH_GRILL",
                                "POWER",
                                "MICROWAVE_MOUNTING_TYPE"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "VOLUME_CAPACITY",
                                "WITH_GRILL",
                                "POWER",
                                "MICROWAVE_MOUNTING_TYPE",
                                "MODEL",
                                "COLOR",
                                "WITH_MIRRORED_DOOR",
                                "GTIN"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA813967715",
                    "domain_id": "MLA-MICROWAVES",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "COLOR",
                                "WITH_MIRRORED_DOOR",
                                "VOLUME_CAPACITY",
                                "WITH_GRILL",
                                "POWER",
                                "MICROWAVE_MOUNTING_TYPE"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "WITH_MIRRORED_DOOR",
                                "POWER",
                                "MICROWAVE_MOUNTING_TYPE",
                                "COLOR",
                                "VOLUME_CAPACITY",
                                "WITH_GRILL",
                                "GTIN"
                            ],
                            "missing_attributes": []
                        }
                    }
                }
            ]
        },
        {
            "domain_id": "MLA-REFRIGERATORS",
            "status": {
                "metrics": {
                    "pi": {
                        "complete_items": 4,
                        "complete_attributes": 4,
                        "incomplete_attributes": 0
                    },
                    "ft": {
                        "complete_items": 3,
                        "complete_attributes": 55,
                        "incomplete_attributes": 1
                    },
                    "all": {
                        "complete_items": 3,
                        "complete_attributes": 59,
                        "incomplete_attributes": 1
                    }
                },
                "total_items": 4
            },
            "items": [
                {
                    "item_id": "MLA854752609",
                    "domain_id": "MLA-REFRIGERATORS",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": false,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "WITH_FREEZER",
                                "FREEZER_LOCATION",
                                "WIDTH",
                                "DEPTH",
                                "HEIGHT",
                                "TOTAL_CAPACITY",
                                "IS_MINIBAR",
                                "WITH_INVERTER",
                                "DEFROST_TYPE",
                                "ENERGY_EFFICIENCY",
                                "NUMBER_OF_DOORS"
                            ],
                            "missing_attributes": [
                                "COLOR"
                            ]
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "MODEL",
                                "WITH_FREEZER",
                                "GTIN",
                                "TOTAL_CAPACITY",
                                "IS_MINIBAR",
                                "WITH_INVERTER",
                                "NUMBER_OF_DOORS",
                                "BRAND",
                                "FREEZER_LOCATION",
                                "WIDTH",
                                "HEIGHT",
                                "DEPTH",
                                "DEFROST_TYPE",
                                "ENERGY_EFFICIENCY"
                            ],
                            "missing_attributes": [
                                "COLOR"
                            ]
                        }
                    }
                },
                {
                    "item_id": "MLA827999320",
                    "domain_id": "MLA-REFRIGERATORS",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "FREEZER_LOCATION",
                                "WIDTH",
                                "DEPTH",
                                "HEIGHT",
                                "TOTAL_CAPACITY",
                                "WITH_FREEZER",
                                "IS_MINIBAR",
                                "WITH_INVERTER",
                                "DEFROST_TYPE",
                                "ENERGY_EFFICIENCY",
                                "NUMBER_OF_DOORS",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "WITH_INVERTER",
                                "WIDTH",
                                "WITH_FREEZER",
                                "IS_MINIBAR",
                                "COLOR",
                                "GTIN",
                                "BRAND",
                                "TOTAL_CAPACITY",
                                "DEFROST_TYPE",
                                "FREEZER_LOCATION",
                                "NUMBER_OF_DOORS",
                                "ENERGY_EFFICIENCY",
                                "MODEL",
                                "DEPTH",
                                "HEIGHT"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA813267264",
                    "domain_id": "MLA-REFRIGERATORS",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "FREEZER_LOCATION",
                                "WIDTH",
                                "DEPTH",
                                "HEIGHT",
                                "TOTAL_CAPACITY",
                                "WITH_FREEZER",
                                "IS_MINIBAR",
                                "WITH_INVERTER",
                                "DEFROST_TYPE",
                                "ENERGY_EFFICIENCY",
                                "NUMBER_OF_DOORS",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "TOTAL_CAPACITY",
                                "WITH_FREEZER",
                                "WITH_INVERTER",
                                "NUMBER_OF_DOORS",
                                "WIDTH",
                                "DEPTH",
                                "ENERGY_EFFICIENCY",
                                "COLOR",
                                "GTIN",
                                "BRAND",
                                "MODEL",
                                "HEIGHT",
                                "FREEZER_LOCATION",
                                "IS_MINIBAR",
                                "DEFROST_TYPE"
                            ],
                            "missing_attributes": []
                        }
                    }
                },
                {
                    "item_id": "MLA813265153",
                    "domain_id": "MLA-REFRIGERATORS",
                    "adoption_status": {
                        "pi": {
                            "complete": true,
                            "attributes": [
                                "GTIN"
                            ],
                            "missing_attributes": []
                        },
                        "ft": {
                            "complete": true,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "FREEZER_LOCATION",
                                "WIDTH",
                                "DEPTH",
                                "HEIGHT",
                                "TOTAL_CAPACITY",
                                "WITH_FREEZER",
                                "IS_MINIBAR",
                                "WITH_INVERTER",
                                "DEFROST_TYPE",
                                "ENERGY_EFFICIENCY",
                                "NUMBER_OF_DOORS",
                                "COLOR"
                            ],
                            "missing_attributes": []
                        },
                        "all": {
                            "complete": true,
                            "attributes": [
                                "ENERGY_EFFICIENCY",
                                "FREEZER_LOCATION",
                                "WITH_FREEZER",
                                "TOTAL_CAPACITY",
                                "WITH_INVERTER",
                                "COLOR",
                                "WIDTH",
                                "DEPTH",
                                "HEIGHT",
                                "IS_MINIBAR",
                                "DEFROST_TYPE",
                                "NUMBER_OF_DOORS",
                                "GTIN",
                                "BRAND",
                                "MODEL"
                            ],
                            "missing_attributes": []
                        }
                    }
                }
            ]
        },
        {
            "domain_id": "MLA-T_SHIRTS",
            "status": {
                "metrics": {
                    "pi": {
                        "complete_items": 0,
                        "complete_attributes": 0,
                        "incomplete_attributes": 1
                    },
                    "ft": {
                        "complete_items": 0,
                        "complete_attributes": 6,
                        "incomplete_attributes": 4
                    },
                    "all": {
                        "complete_items": 0,
                        "complete_attributes": 6,
                        "incomplete_attributes": 5
                    }
                },
                "total_items": 1
            },
            "items": [
                {
                    "item_id": "MLA828943540",
                    "domain_id": "MLA-T_SHIRTS",
                    "adoption_status": {
                        "pi": {
                            "complete": false,
                            "attributes": [],
                            "missing_attributes": [
                                "GTIN"
                            ]
                        },
                        "ft": {
                            "complete": false,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "GENDER",
                                "SLEEVE_TYPE",
                                "COLOR",
                                "SIZE"
                            ],
                            "missing_attributes": [
                                "FABRIC_DESIGN",
                                "MAIN_MATERIAL",
                                "T_SHIRT_COLLAR_TYPE",
                                "PRINT_DESIGN"
                            ]
                        },
                        "all": {
                            "complete": false,
                            "attributes": [
                                "BRAND",
                                "MODEL",
                                "GENDER",
                                "SLEEVE_TYPE",
                                "COLOR",
                                "SIZE"
                            ],
                            "missing_attributes": [
                                "MAIN_MATERIAL",
                                "T_SHIRT_COLLAR_TYPE",
                                "PRINT_DESIGN",
                                "GTIN",
                                "FABRIC_DESIGN"
                            ]
                        }
                    }
                }
            ]
        }
    ]
}
```

Respuesta con error (400 BAD REQUEST - Do not send seller_id):

```
{
    "message": "Must provide either item_id, or seller_id, or groups param",
    "code": "bad_request",
    "cause": "",
    "status": 400
}
```

## Conocer el estado de completitud y calidad de una publicación

Para conocer tanto la completitud como la calidad de una publicación, puedes realizar:

Llamada:

```
curl -H 'Authorization: Bearer $ACCESS_TOKEN' -X GET https://api.mercadolibre.com/catalog_quality/status?item_id=$ITEM_ID&v=3
```

Ejemplo:

```
curl -H 'Authorization: Bearer $ACCESS_TOKEN' -X GET https://api.mercadolibre.com/catalog_quality/status?item_id=MLA123456789&v=3
```

Respuesta:

```
{
    "item_id": "MLA123456789",
    "domain_id": "MLA-KITCHEN_RANGE_HOODS",
    "adoption_status": {
        "pi": {
            "complete": false,
            "attributes": [],
            "missing_attributes": [
                "GTIN"
            ]
        },
        "ft": {
            "complete": false,
            "attributes": [
                "BRAND",
                "MODEL",
                "LINE",
                "RANGE_HOOD_TYPE",
                "RANGE_HOOD_MOUNTING",
                "MATERIAL"
            ],
            "missing_attributes": [
                "DUCTED",
                "SPEED_SETTING",
                "BURNERS_NUMBER",
                "COLOR"
            ]
        },
        "required": {
            "complete": true,
            "attributes": [
                "BRAND",
                "RANGE_HOOD_TYPE"
            ],
            "missing_attributes": []
        },
        "all": {
            "complete": false,
            "attributes": [
                "MODEL",
                "LINE",
                "RANGE_HOOD_TYPE",
                "RANGE_HOOD_MOUNTING",
                "MATERIAL",
                "BRAND"
            ],
            "missing_attributes": [
                "BURNERS_NUMBER",
                "COLOR",
                "GTIN",
                "DUCTED",
                "SPEED_SETTING"
            ]
        },
        "quality_level": 0,
        "quality_reason": "PI_INCORRECT"
    },
    "gmv": 0,
    "buying_mode": "buy_it_now"
}
```

Respuesta con error (400 BAD REQUEST - No se envía item_id):

```
{
    "message": "Must provide either item_id, or seller_id, or groups param",
    "code": "bad_request",
    "cause": "",
    "status": 400
}
```

## Parámetros

**v (versión de la API)** : Si bien este parámetro no es requerido se recomienda indicarlo para asegurar que la integración no sufra fricciones al momento de hacer cambios en la API. Actualmente están disponible las siguientes versiones: 
 v=0 (formato inicial) 
 v=1 (retorna un formato de respuesta reducido) 
 v=2 (soporte a ítems sin dominio).
 v=3 (es la última versión estable y la que recomendamos usar)

**seller_id** : Este parámetro es requerido para identificar al vendedor. 
 **item_id** : Este parámetro es requerido para identificar a la publicación. **include_incomplete_items**  Con este parámetro podrás incluir en la respuesta, un listado de publicaciones que tengan o sus fichas técnicas o sus códigos de producto incompletos. Dentro de “all”, el atributo incomplete_items tendrá las publicaciones incompletas, ya sea porque sus códigos o especificaciones en sus fichas técnicas les falta información o porque la información cargada no es correcta.

Notas:

- Por defecto toma el valor false.
- Una publicación puede estar incompleta por no contar con la información completa como por contar con información que no es correcta.

**include_items** : Hace referencia al apartado del JSON donde se especifica la granularidad por item.

Nota:

Por defecto toma el valor false.

**domain_id** : Este parámetro es opcional. Es útil cuando se quiere conocer el estado de un solo dominio.

Nota:

En caso de no ser utilizado, en la respuesta de la llamada se podrán ver todos.

**access_token** : El access token es requerido cuando se hace una llamada vía API.

Nota:

En caso que el parámetro seller_id no coincida con el vendedor identificado por el access_token se devolverá un status code 403.

## Descripción de campos

**pi** : Identificador de Producto (Product identifier PI). 
 **ft** : Ficha técnica. 
 **required**  Requeridos.
 **all** : Todos los atributos. Reconoces los valores que no fueron cargados y los valores cargados pero que son incorrectos. 
 **quality_level** : Nivel de calidad del ítem, el cual puede obtener los valores de 0 cuando no cumple con los requisitos de completitud y calidad y está perdiendo exposición, y 1 cuando está cumpliendo con todos los requisitos. 
 **quality_reason** : Es el motivo por el cual la publicación no cumple con los requisitos de calidad.

Nota:

Es posible que la respuesta devuelva **“quality_level”= 1**  y con **“quality_reason”=“PI_INCORRECT”** .

## Especificaciones

Para todos los campos por los que se mide la calidad (pi, ft, required y all) cuentan con **las secciones de complete**  en donde se especifican los atributos con los que cuenta y **missing_attributes**  para especificar los atributos que le faltan por completar en la publicación como también aquellos que se encuentran cargados pero no cuenta con la calidad suficiente para identificarlos como completos.

**Volver:**  [Atributos](https://developers.mercadolibre.com.ar/es_ar/atributos).
