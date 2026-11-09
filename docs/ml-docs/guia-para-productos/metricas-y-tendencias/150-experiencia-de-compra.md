<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/experiencia-de-compra -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Experiencia de compra

Última actualización 03/02/2026

## Experiencia de compra

Importante:

Esta funcionalidad está disponible para Argentina, Brasil, Uruguay, México, Colombia, Chile y Perú.

Experiencia de compra es un algoritmo que aplica reglas nuevas para posicionar cada ítem según su rendimiento, basándose en distintos indicadores de atención al cliente. La iniciativa busca ayudar al vendedor a detectar problemas en sus ítems para que pueda mejorar la calidad de su atención en base a sus reclamos y cancelaciones.

El impacto será en el front de Mercado Libre, cambiando las vistas de listado de publicaciones, métricas, editor masivo online (EMON) y modificar individual, cada una con experiencias visuales diferentes.
 La finalidad de esta documentación es brindar un origen único, devolviendo los contenidos de experiencia de compra en un contrato específico para integradores. De esta manera, se facilita el mantenimiento de los textos y se optimiza la calidad del servicio.

Nota:

A la experiencia ya conocida del recurso [/health](https://developers.mercadolibre.com.ar/es_ar/calidad-de-publicaciones) (calidad de la publicación), se le suma la nueva experiencia de compra, la cual cuenta con sus distintos niveles y soluciones. 
 Permite mostrar a los vendedores la experiencia de compra que ofrecen en sus publicaciones, sabiendo qué acciones están cumplidas y cuáles están pendientes. De esta manera, pueden alcanzar los objetivos de publicación y aumentar la calidad de las publicaciones, mejorando la exposición del ítem y también la experiencia de venta y compra.

El recurso **/purchase_experience/integrators**  te permite identificar el estado de tus publicaciones, con el nivel alcanzado y sus correspondientes accionables para el caso de que necesiten mejorar con respecto a la experiencia de compra ofrecida.

Importante:

A partir del encendido del [nuevo recurso por UP](https://developers.mercadolibre.com.ar/es_ar/experiencia-de-compra#Consulta-por-User-Product), todas las solicitudes realizadas sobre ítems migrados a la nueva estructura de User Products responderán con **HTTP 302** . Esto aplica solo a los ítems ya migrados; para el resto de los ítems se mantiene el comportamiento actual.

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/reputation/items/$ITEM_ID/purchase_experience/integrators
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/reputation/items/MLA1391786841/purchase_experience/integrators?locale=es_AR
```

Respuesta:

```
{
    "item_id": "MLA1391786841",
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Tienes un problema con este producto. Revisa los consejos sobre cómo mejorar."
        },
        {
            "order": 1,
            "text": "La experiencia que brinda tu publicación afecta tu exposición y podríamos pausarla."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Pausar desde el listado"
        }
    ],
    "reputation": {
        "color": "orange",
        "text": "Media",
        "value": 50
    },
    "status": {
        "id": "active"
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "PRODUCT",
                "color": "#7267E4",
                "quantity": "1 problema",
                "cancellations": 1,
                "claims": 0,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "POOR_CONDITION",
                    "title": {
                        "text": "Estaban en mal estado"
                    }
                },
                "level_three": {
                    "key": "BROKEN_PRODUCT",
                    "title": {
                        "text": "El producto llegó abierto y/o dañado"
                    },
                    "remedy": {
                        "text": "Revisa que los productos que vendes y su embalaje estén en buenas condiciones antes de enviarlos o despacharlos. "
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-07-04T19:08:56Z",
            "to": "2023-11-04T19:08:56Z",
            "level_one": [
                {
                    "key": "PRODUCT",
                    "title": {
                        "text": "Con el producto entregado"
                    },
                    "color": "#7267E4",
                    "percentage": 100.0,
                    "quantities_level_two": [
                        {
                            "key": "POOR_CONDITION",
                            "title": {
                                "text": "Estaban en mal estado"
                            },
                            "quantity": 11
                        }
                    ]
                }
            ]
        }
    }
}
```

## Parámetro requeridos

El único **parámetro requerido es el de locale** , con el fin de obtener los textos correspondientes para cada idioma, logrando brindar información detallada y clara.

| Query params | Type | Mandatory | Values | Only one |
| --- | --- | --- | --- | --- |
| locale | string | YES | es_MX, es_UY, es_CO,  es_CL,  es_AR, es_PE,  pt_BR,  en_US. | YES |

### Campos de la respuesta

**item_id** : identificación del ítem que se está consultando.
 **freeze** : aviso de freezado de experiencia por el cual no se generan acciones sobre el ítem. 
 **status** : información del estado de la publicación. (active | paused | moderated).
 **title** : motivo principal por el que el ítem se encuentra en el estado actual. 
 **subtitles** : detalles por los cuales el ítem se encuentra en el estado actual. 
 **actions** : accionables posibles para modificar la situación actual del ítem. 
 **reputation** : color, detalle y valor actual de la reputación según la experiencia de compra. 
 **metrics_details** : detalle de los problemas, niveles, posibles soluciones, accionables y la distribución para dar detalles de la experiencia de compra del ítem.

- Status -> **paused**

- Status -> **active**

## Campos y componentes de la respuesta

**Text**

```
{
    "order": uint,
    "text": string,
    "placeholders": []string,
}
```

Ejemplo: asdasd {0} asdasd {1}. [0]

- Los {} deberán ser reemplazados por los placeholders.

- Los [] deberán ser reemplazados por los action.

```
{
    "text": "Por el momento {0}esta publicación no perderá exposición ni será pausada o anulada por brindar experiencia mala o media.{1} Es importante solucionar sus problemas para mejorar la experiencia que brindas.",
    "placeholders": [
        "",
        ""
    ]
}
```

**Freeze**

La primera parte del wording de freeze cambia de acuerdo al tipo de freeze aplicado.

- Req_commercial

```
   "freeze": {
    "text": "Debido a un Acuerdo comercial, {0}esta publicación no perderá exposición, ni será pausada o anulada por tener experiencia de compra mala o media.{1} Ten en cuenta que es importante solucionar los problemas para mejorar la experiencia que brindas.",
    "placeholders": [
        "",
        ""
    ]
},
```

- Internal_recovery_grntee

```
  "freeze": {
    "text": "Debido al Beneficio de reputación, {0}esta publicación no perderá exposición, ni será pausada o anulada por tener experiencia de compra mala o media.{1} Ten en cuenta que es importante solucionar los problemas para mejorar la experiencia que brindas.",
    "placeholders": [
        "",
        ""
    ]
},
```

- Internal_recovery

```
    "freeze": {
    "text": "Debido al Beneficio Verde claro, {0}esta publicación no perderá exposición, ni será pausada o anulada por tener experiencia de compra mala o media.{1} Ten en cuenta que es importante solucionar los problemas para mejorar la experiencia que brindas.",
    "placeholders": [
        "",
        ""
    ]
},
```

- Internal_newbie_grntee

```
 "freeze": {
    "text": "Debido al Beneficio de reputación, {0}esta publicación no perderá exposición, ni será pausada o anulada por tener experiencia de compra mala o media.{1} Ten en cuenta que es importante solucionar los problemas para mejorar la experiencia que brindas.",
    "placeholders": [
        "",
        ""
    ]
},
```

- Resto de freezados

Los demás tipos de freezado son: **grace_time, internal_reputation, req_legal, frozen.** .

```
   "freeze": {
    "text": "Por el momento {0}esta publicación no perderá exposición ni será pausada o anulada por brindar experiencia mala o media.{1} Es importante solucionar sus problemas para mejorar la experiencia que brindas.",
    "placeholders": [
        "",
        ""
    ]
},
```

**Status**

```
{
    "id": enum (active | paused | moderated),
    "assigned_by": enum (reputation | other),
    "text": string
}
```

**Subtitle**

Se sumó un cambio para obtener la cantidad de ventas de un ítem en los últimos 180 días y mostrarlo en los fronts.

Nota:

Este cambio es paulatino, por lo cual deberían poder reconocer la respuesta actual (sin placeholders) y la respuesta nueva (con placeholders). 
 Tener en cuenta [ejemplos de Ítems con score 100 (con o sin problemas)](https://developers.mercadolibre.com.ar/es_ar/experiencia-de-compra#Ejemplos-de-casos-de-uso).

Respuesta actual

```
"subtitles": [
    {
        "order": 0,
        "text": "Tienes 9 problemas con este producto. Revisa los consejos sobre cómo mejorar."
    },
    {
        "order": 1,
        "text": "La experiencia que brinda tu publicación afecta tu exposición y podríamos anularla."
    }
],
```

Respuesta nueva

```
"subtitles": [
    {
        "order": 0,
        "text": "En los últimos 180 días hiciste {0}12 ventas{1} y tuviste {0}9 problemas.{1} Revisa los consejos sobre cómo mejorar.",
        "placeholders": [
            "",
            ""
        ]
    },
    {
        "order": 1,
        "text": "La experiencia que brinda tu publicación afecta tu exposición y podríamos anularla."
    }
],
```

**Action**

```
{
    "order": uint,
    "text": string,
 }
```

De acuerdo a las condiciones que muestre el ítem, los accionables posibles son los siguientes.

**Ítems activos**

- Si el ítem tiene score 100 y no tiene problemas: Ver publicación.

- Si el ítem tiene score 100 con problemas o un score menor (excluyendo score -1, que es cuando el ítem no tiene ventas): Modificar publicación y Pausar desde el listado.

**Ítems pausados**

- Pausado por el seller: Modificar publicación y Ver publicación.

- Pausado por Experiencia de Compra: Modificar publicación y Reactivar desde el listado.

**Ítem anulado**

- Anulado por experiencia de compra: Cómo brindar buena experiencia.

- Anulado por otra moderación: Ver publicación.

**Reputation**

```
{
    "color": string,
    "text": string,
    "value": int
}
```

**Metrics details**

```
{
    "empty_state_title": string,
    "problems": []problem,
    "distribution": distribution
}
```

**Problem**

```
{
  "order": unit,
  "key": string, // key de L1
  "color": string, // de L1
  "quantity": text, // de L3
  "cancellations": unit, // de l3
  "claims": unit, // de l3
  "tag": string,
    "level_2": level_2,
    "level_3": level_3
}
```

**Level 2**

```
{
    "key": string, // key de L2
    "title": text,
 }
```

**Level 3**

```
{
    "key": string, // key de L3
    "title": text,
    "remedy": text,
}
```

**Distribution**

```
{
    "from": date,
    "to": date,
    "level_1": []level_1
}
```

**Formato date**

```
{"from": "2023-07-04T19:08:56Z",
"to": "2023-11-04T19:08:56Z",
}
```

**Level 1**

```
{
  "key": string, // key de L1
  "title": text,
  "color": string,
  "percentage": float,
  "quantities_level_2": [
        {
            "key": string, // L2 key
            "title": text,
            "quantity": uint
        }
    ]
}
```

### Posibles errores

| Error_code | Mensaje de error | Descripción |
| --- | --- | --- |
| 400 | Bad Request | La solicitud es inválida o no se puede entender por el servidor. |
| 404 | Resource not found | El recurso no está funcionando o que se realizó mal la llamada. |
| 500 | Internal Server Error | El servidor ha tenido un error inesperado y no puede completar la solicitud. |

## Ejemplos de casos de uso

- **Ítem activo con score 100 (sin problemas)**

Importante:

No devolvemos el detalle, pero devolvemos en **central_tag: ¡Sigue así! No tienes ventas con problemas en los últimos 180 días.** 
 Se suma una mejora, en donde se permite reconocer la cantidad de ventas de un item en los últimos 180 días para poder mostrarlo, esto nos permite mostrar con mayor precisión.

Ejemplo ítem tradicional (sin problemas):

```
{
    "item_id": "MLA1391786841",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "No tuviste problemas con este producto."
        },
        {
            "order": 1,
            "text": "Estás brindando una buena experiencia de compra. ¡Sigue así!"
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Ver publicación"
        }
    ],
    "reputation": {
        "color": "green",
        "text": "Buena",
        "value": 100
    },
    "status": {
        "id": "active"
    },
    "metrics_details": {
        "empty_state_title": "No tuviste ventas con problemas en los últimos 180 días.",
        "distribution": {
            "from": "2023-07-04T19:08:56Z",
            "to": "2023-11-04T19:08:56Z",
            "level_one": []
        }
    }
 }
```

Ejemplo de respuesta de ítem tradicional con Score 100 (con problemas)

```
{
    "item_id": "MLA1391786841",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "En los últimos 180 días hiciste {0}12 ventas{1} y tuviste {0}9 problemas.{1}",
            "placeholders": [
                "",
                ""
            ]
        },
        {
            "order": 1,
            "text": "Estás brindando una buena experiencia de compra, pero si continúas con problemas, podría impactar tu exposición."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Pausar desde el listado"
        }
    ],
    "reputation": {
        "color": "green",
        "text": "Buena",
        "value": 100
    },
    "status": {
        "id": "active"
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "3 problemas",
                "cancellations": 2,
                "claims": 1,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "order": 0,
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "PRODUCT_NOT_PREPARED",
                    "title": {
                        "order": 0,
                        "text": "El producto no terminó de prepararse"
                    },
                    "remedy": {
                        "order": 0,
                        "text": "Valida el stock disponible de tu publicación y revisa los tiempos que tienes para preparar tu envío. Si por algún motivo, no estarás o no tienes stock suficiente, pausa tu publicación."
                    }
                }
            },
            {
                "order": 1,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "2 problemas",
                "cancellations": 2,
                "claims": 0,
                "tag": "",
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "order": 0,
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "LABEL_PRINTING_PROBLEMS",
                    "title": {
                        "order": 0,
                        "text": "Dificultades para imprimir la etiqueta"
                    },
                    "remedy": {
                        "order": 0,
                        "text": "Verifica que la impresión sea de buena calidad, no cambies el tamaño de la etiqueta y al pegar la etiqueta en el paquete, no la rayes ni la tapes con la cinta adhesiva."
                    }
                }
            },
            {
                "order": 2,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "2 problemas",
                "cancellations": 2,
                "claims": 0,
                "tag": "",
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "order": 0,
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "WITHOUT_STOCK",
                    "title": {
                        "order": 0,
                        "text": "No tenías stock disponible"
                    },
                    "remedy": {
                        "order": 0,
                        "text": "Valida el stock disponible de tu publicación y revisa los tiempos que tienes para preparar tu envío. Si por algún motivo, no estarás o no tienes stock suficiente, pausa tu publicación."
                    }
                }
            },
            {
                "order": 3,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "2 problemas",
                "cancellations": 0,
                "claims": 2,
                "tag": "",
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "order": 0,
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "STOP_DUE_HOLIDAY",
                    "title": {
                        "order": 0,
                        "text": "No estabas operando o parecías inactivo"
                    },
                    "remedy": {
                        "order": 0,
                        "text": "Si por algún motivo, no estarás disponible te sugerimos pausar tus publicaciones."
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-04-13T20:08:26Z",
            "to": "2023-10-10T20:08:26Z",
            "level_one": [
                {
                    "key": "OPERATION",
                    "title": {
                        "order": 0,
                        "text": "Al gestionar o preparar la venta"
                    },
                    "color": "#EC79BC",
                    "percentage": 100.0,
                    "quantities_level_two": [
                        {
                            "key": "PACK_OFF",
                            "title": {
                                "order": 0,
                                "text": "Dificultades para preparar el pedido"
                            },
                            "quantity": 9
                        }
                    ]
                }
            ]
        }
    }
 }
```

Ejemplo de respuesta para Item de catálogo (sin problemas)

```
{
   "item_id": "MLA1391786841",
   "freeze": {
       "text": ""
   },
   "title": {
       "text": "Experiencia de compra"
   },
   "subtitles": [
       {
           "order": 0,
           "text": "No tuviste problemas con este producto."
       },
       {
           "order": 1,
           "text": "Brindar buena experiencia te ayuda a competir en catálogo."
       }
   ],
   "actions": [
       {
           "order": 0,
           "text": "Ver publicación"
       }
   ],
   "reputation": {
       "color": "green",
       "text": "Buena",
       "value": 100
   },
   "status": {
       "id": "active"
   },
   "metrics_details": {
       "empty_state_title": "No tuviste ventas con problemas en los últimos 180 días.",
       "distribution": {
           "from": "2023-07-04T19:08:56Z",
           "to": "2023-11-04T19:08:56Z",
           "level_one": []
       }
   }
}
```

Ejemplo de respuesta de ítem de catálogo (con problemas)

```
{
   "item_id": "MLA1391786841",
   "freeze": {
       "text": ""
   },
   "title": {
       "text": "Experiencia de compra"
   },
   "subtitles": [
       {
           "order": 0,
           "text": "En los últimos 180 días hiciste {0}12 ventas{1} y tuviste {0}9 problemas.{1}",
           "placeholders": [
               "",
               ""
           ]
       },
       {
           "order": 1,
           "text": "Estás brindando una buena experiencia de compra, pero si continúas con problemas, podría afectarte en la competencia en catálogo."
       }
   ],
   "actions": [
       {
           "order": 0,
           "text": "Modificar publicación"
       },
       {
           "order": 1,
           "text": "Pausar desde el listado"
       }
   ],
   "reputation": {
       "color": "green",
       "text": "Buena",
       "value": 100
   },
   "status": {
       "id": "active"
   },
   "metrics_details": {
       "problems": [
           {
               "order": 0,
               "key": "OPERATION",
               "color": "#EC79BC",
               "quantity": "3 problemas",
               "cancellations": 2,
               "claims": 1,
               "tag": "PROBLEMA PRINCIPAL",
               "level_two": {
                   "key": "PACK_OFF",
                   "title": {
                       "order": 0,
                       "text": "Dificultades para preparar el pedido"
                   }
               },
               "level_three": {
                   "key": "PRODUCT_NOT_PREPARED",
                   "title": {
                       "order": 0,
                       "text": "El producto no terminó de prepararse"
                   },
                   "remedy": {
                       "order": 0,
                       "text": "Valida el stock disponible de tu publicación y revisa los tiempos que tienes para preparar tu envío. Si por algún motivo, no estarás o no tienes stock suficiente, pausa tu publicación."
                   }
               }
           },
           {
               "order": 1,
               "key": "OPERATION",
               "color": "#EC79BC",
               "quantity": "2 problemas",
               "cancellations": 2,
               "claims": 0,
               "tag": "",
               "level_two": {
                   "key": "PACK_OFF",
                   "title": {
                       "order": 0,
                       "text": "Dificultades para preparar el pedido"
                   }
               },
               "level_three": {
                   "key": "LABEL_PRINTING_PROBLEMS",
                   "title": {
                       "order": 0,
                       "text": "Dificultades para imprimir la etiqueta"
                   },
                   "remedy": {
                       "order": 0,
                       "text": "Verifica que la impresión sea de buena calidad, no cambies el tamaño de la etiqueta y al pegar la etiqueta en el paquete, no la rayes ni la tapes con la cinta adhesiva."
                   }
               }
           },
           {
               "order": 2,
               "key": "OPERATION",
               "color": "#EC79BC",
               "quantity": "2 problemas",
               "cancellations": 2,
               "claims": 0,
               "tag": "",
               "level_two": {
                   "key": "PACK_OFF",
                   "title": {
                       "order": 0,
                       "text": "Dificultades para preparar el pedido"
                   }
               },
               "level_three": {
                   "key": "WITHOUT_STOCK",
                   "title": {
                       "order": 0,
                       "text": "No tenías stock disponible"
                   },
                   "remedy": {
                       "order": 0,
                       "text": "Valida el stock disponible de tu publicación y revisa los tiempos que tienes para preparar tu envío. Si por algún motivo, no estarás o no tienes stock suficiente, pausa tu publicación."
                   }
               }
           },
           {
               "order": 3,
               "key": "OPERATION",
               "color": "#EC79BC",
               "quantity": "2 problemas",
               "cancellations": 0,
               "claims": 2,
               "tag": "",
               "level_two": {
                   "key": "PACK_OFF",
                   "title": {
                       "order": 0,
                       "text": "Dificultades para preparar el pedido"
                   }
               },
               "level_three": {
                   "key": "STOP_DUE_HOLIDAY",
                   "title": {
                       "order": 0,
                       "text": "No estabas operando o parecías inactivo"
                   },
                   "remedy": {
                       "order": 0,
                       "text": "Si por algún motivo, no estarás disponible te sugerimos pausar tus publicaciones."
                   }
               }
           }
       ],
       "distribution": {
           "from": "2023-04-13T20:08:26Z",
           "to": "2023-10-10T20:08:26Z",
           "level_one": [
               {
                   "key": "OPERATION",
                   "title": {
                       "order": 0,
                       "text": "Al gestionar o preparar la venta"
                   },
                   "color": "#EC79BC",
                   "percentage": 100.0,
                   "quantities_level_two": [
                       {
                           "key": "PACK_OFF",
                           "title": {
                               "order": 0,
                               "text": "Dificultades para preparar el pedido"
                           },
                           "quantity": 9
                       }
                   ]
               }
           ]
       }
   }
}
```

- **Ítem activo con score 50**

Ejemplo:

```
{
    "item_id": "MLA1391786841",
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Tienes un problema con este producto. Revisa los consejos sobre cómo mejorar."
        },
        {
            "order": 1,
            "text": "La experiencia que brinda tu publicación afecta tu exposición y podríamos pausarla."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Pausar desde el listado"
        }
    ],
    "reputation": {
        "color": "orange",
        "text": "Media",
        "value": 50
    },
    "status": {
        "id": "active"
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "PRODUCT",
                "color": "#7267E4",
                "quantity": "1 problema",
                "cancellations": 1,
                "claims": 0,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "POOR_CONDITION",
                    "title": {
                        "text": "Estaban en mal estado"
                    }
                },
                "level_three": {
                    "key": "BROKEN_PRODUCT",
                    "title": {
                        "text": "El producto llegó abierto y/o dañado"
                    },
                    "remedy": {
                        "text": "Revisa que los productos que vendes y su embalaje estén en buenas condiciones antes de enviarlos o despacharlos. "
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-07-04T19:08:56Z",
            "to": "2023-11-04T19:08:56Z",
            "level_one": [
                {
                    "key": "PRODUCT",
                    "title": {
                        "text": "Con el producto entregado"
                    },
                    "color": "#7267E4",
                    "percentage": 100,
                    "quantities_level_two": [
                        {
                            "key": "POOR_CONDITION",
                            "title": {
                                "text": "Estaban en mal estado"
                            },
                            "quantity": 11
                        }
                    ]
                }
            ]
        }
    }
}
```

- **Ítems inactivos por experiencia de compra**

Ejemplo:

```
{
    "item_id": "MLA1391786841",
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Tuviste un problema con este producto. Revisa los consejos sobre cómo mejorar."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Reactivar desde el listado"
        }
    ],
    "reputation": {
        "color": "red",
        "text": "Mala",
        "value": 30
    },
    "status": {
        "id": "paused",
        "assigned_by": "reputation",
        "text": "Tu publicación está inactiva. La pausamos porque está brindando una mala experiencia de compra."
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "PRODUCT",
                "color": "#7267E4",
                "quantity": "1 problema",
                "cancellations": 0,
                "claims": 1,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "POOR_CONDITION",
                    "title": {
                        "text": "Estaban en mal estado"
                    }
                },
                "level_three": {
                    "key": "PRODUCT_IN_BAD_CONDITION",
                    "title": {
                        "text": "El producto llegó en mal estado"
                    },
                    "remedy": {
                        "text": "Revisa que los productos que vendes estén en buenas condiciones antes de enviarlos o despacharlos. "
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-04-21T18:41:45Z",
            "to": "2023-10-18T18:41:45Z",
            "level_one": [
                {
                    "key": "PRODUCT",
                    "title": {
                        "text": "Con el producto entregado"
                    },
                    "color": "#7267E4",
                    "percentage": 100.0,
                    "quantities_level_two": [
                        {
                            "key": "POOR_CONDITION",
                            "title": {
                                "text": "Estaban en mal estado"
                            },
                            "quantity": 1
                        }
                    ]
                }
            ]
        }
    }
}
```

- **Ítem inactivo por moderaciones, se puede reactivar**

Ejemplo:

```
{
    "item_id": "MLU1234",
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Tuviste 9 problemas con este producto. Revisa los consejos sobre cómo mejorar."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Reactivar desde el listado"
        }
    ],
    "reputation": {
        "color": "red",
        "text": "Mala",
        "value": 30
    },
    "status": {
        "id": "paused",
        "assigned_by": "reputation",
        "text": "Tu publicación está inactiva. La pausamos porque está brindando una mala experiencia de compra."
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "3 problemas",
                "cancellations": 2,
                "claims": 1,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "PRODUCT_NOT_PREPARED",
                    "title": {
                        "text": "El producto no terminó de prepararse"
                    },
                    "remedy": {
                        "text": "Valida el stock disponible de tu publicación y revisa los tiempos que tienes para preparar tu envío. Si por algún motivo, no estarás o no tienes stock suficiente, pausa tu publicación."
                    }
                }
            },
            {
                "order": 1,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "2 problemas",
                "cancellations": 2,
                "claims": 0,
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "LABEL_PRINTING_PROBLEMS",
                    "title": {
                        "text": "Dificultades para imprimir la etiqueta"
                    },
                    "remedy": {
                        "text": "Verifica que la impresión sea de buena calidad, no cambies el tamaño de la etiqueta y al pegar la etiqueta en el paquete, no la rayes ni la tapes con la cinta adhesiva."
                    }
                }
            },
            {
                "order": 2,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "2 problemas",
                "cancellations": 2,
                "claims": 0,
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "WITHOUT_STOCK",
                    "title": {
                        "text": "No tenías stock disponible"
                    },
                    "remedy": {
                        "text": "Valida el stock disponible de tu publicación y revisa los tiempos que tienes para preparar tu envío. Si por algún motivo, no estarás o no tienes stock suficiente, pausa tu publicación."
                    }
                }
            },
            {
                "order": 3,
                "key": "OPERATION",
                "color": "#EC79BC",
                "quantity": "2 problemas",
                "cancellations": 0,
                "claims": 2,
                "level_two": {
                    "key": "PACK_OFF",
                    "title": {
                        "text": "Dificultades para preparar el pedido"
                    }
                },
                "level_three": {
                    "key": "STOP_DUE_HOLIDAY",
                    "title": {
                        "text": "No estabas operando o parecías inactivo"
                    },
                    "remedy": {
                        "text": "Si por algún motivo, no estarás disponible te sugerimos pausar tus publicaciones."
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-04-03T00:51:39Z",
            "to": "2023-09-30T00:51:39Z",
            "level_one": [
                {
                    "key": "OPERATION",
                    "title": {
                        "text": "Al gestionar o preparar la venta"
                    },
                    "color": "#EC79BC",
                    "percentage": 100.0,
                    "quantities_level_two": [
                        {
                            "key": "PACK_OFF",
                            "title": {
                                "text": "Dificultades para preparar el pedido"
                            },
                            "quantity": 9
                        }
                    ]
                }
            ]
        }
    }
}
```

- **Ítem pausado por experiencia de compra**

Cae a 30 el nivel de experiencia de compra.

Ejemplo:

```
{
    "item_id": "MLA1391786841",
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Tuviste 15 problemas con este producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Ver publicación"
        }
    ],
    "reputation": {
        "color": "red",
        "text": "Mala",
        "value": 30
    },
    "status": {
        "id": "paused",
        "assigned_by": "other",
        "text": "Tu publicación está inactiva."
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "PRODUCT",
                "color": "#7267E4",
                "quantity": "15 problemas",
                "cancellations": 3,
                "claims": 7,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "POOR_CONDITION",
                    "title": {
                        "text": "Estaban en mal estado"
                    }
                },
                "level_three": {
                    "key": "DEFECTS_AFTER_USE",
                    "title": {
                        "text": "Aparecieron defectos después del uso del producto"
                    },
                    "remedy": {
                        "text": "Asegúrate de vender productos de buena calidad. Si tu producto tiene defectos de fábrica, reemplázalos lo antes posible."
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-07-04T19:08:56Z",
            "to": "2023-11-04T19:08:56Z",
            "level_one": [
                {
                    "key": "PRODUCT",
                    "title": {
                        "text": "Con el producto entregado"
                    },
                    "color": "#7267E4",
                    "percentage": 100.0,
                    "quantities_level_two": [
                        {
                            "key": "POOR_CONDITION",
                            "title": {
                                "text": "Estaban en mal estado"
                            },
                            "quantity": 15
                        }
                    ]
                }
            ]
        }
    }
}
```

- **Ítem inactivo por el vendedor**

Ejemplo:

```
{
    "item_id": "MLA1391786841",
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Estás brindando una buena experiencia de compra. ¡Sigue así!"
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Ver publicación"
        }
    ],
    "reputation": {
        "color": "green",
        "text": "Buena",
        "value": 100
    },
    "status": {
        "id": "paused",
        "assigned_by": "other",
        "text": "Tu publicación está inactiva."
    },
    "metrics_details": {
        "empty_state_title": "No tuviste ventas con problemas en los últimos 180 días.",
        "distribution": {
            "from": "2023-04-21T18:39:20Z",
            "to": "2023-10-18T18:39:20Z",
            "level_one": []
        }
    }
}
```

- **Ítem sin experiencia de compra**

Importante:

No devolvemos el detalle, pero devolvemos en **empty_state_title: No tuviste ventas con problemas en los últimos 180 días.**

Ejemplo:

```
{
    "item_id": "MLA1391786841",
    "title": {
        "text": "Aún no podemos medir tu experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "La calcularemos con las ventas de los últimos 180 días."
        }
    ],
    "actions": [],
    "reputation": {
        "color": "gray",
        "value": -1
    },
    "status": {
        "id": "active"
    },
    "metrics_details": {
        "empty_state_title": "No tuviste ventas con problemas en los últimos 180 días.",
        "distribution": {
            "from": "2023-07-04T19:08:56Z",
            "to": "2023-11-04T19:08:56Z",
            "level_one": []
        }
    }
}
```

- **Ítem freezado**

Ejemplo:

```
{
    "item_id": "MLA1391786841",
    "freeze": {
        "text": "Por el momento {0}esta publicación no perderá exposición ni será pausada o anulada por brindar experiencia mala o media.{1} Es importante solucionar sus problemas para mejorar la experiencia que brindas.",
        "placeholders": [
            "",
            ""
        ]
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Tienes 22 problemas con este producto. Revisa los consejos sobre cómo mejorar."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Pausar desde el listado"
        }
    ],
    "reputation": {
        "color": "orange",
        "text": "Media",
        "value": 65
    },
    "status": {
        "id": "active"
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "PRODUCT",
                "color": "#7267E4",
                "quantity": "10 problemas",
                "cancellations": 3,
                "claims": 7,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "POOR_CONDITION",
                    "title": {
                        "text": "Estaban en mal estado"
                    }
                },
                "level_three": {
                    "key": "PRODUCT_IN_BAD_CONDITION",
                    "title": {
                        "text": "El producto llegó en mal estado"
                    },
                    "remedy": {
                        "text": "Revisa que los productos que vendes estén en buenas condiciones antes de enviarlos o despacharlos. "
                    }
                }
            },
            {
                "order": 1,
                "key": "PRODUCT",
                "color": "#7267E4",
                "quantity": "12 problemas",
                "cancellations": 3,
                "claims": 7,
                "level_two": {
                    "key": "POOR_CONDITION",
                    "title": {
                        "text": "Estaban en mal estado"
                    }
                },
                "level_three": {
                    "key": "NEXT_TO_EXPIRE",
                    "title": {
                        "text": "El producto había expirado o iba a expirar pronto"
                    },
                    "remedy": {
                        "text": "Verifica la fecha de expiración de los productos que vendes antes de despacharlos o enviarlos."
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-07-04T19:08:56Z",
            "to": "2023-11-04T19:08:56Z",
            "level_one": [
                {
                    "key": "PRODUCT",
                    "title": {
                        "text": "Con el producto entregado"
                    },
                    "color": "#7267E4",
                    "percentage": 100.0,
                    "quantities_level_two": [
                        {
                            "key": "POOR_CONDITION",
                            "title": {
                                "text": "Estaban en mal estado"
                            },
                            "quantity": 22
                        }
                    ]
                }
            ]
        }
    }
}
```

- **Nivel de experiencia de compra 30 - Reactivado**

Ejemplo:

```
{
    "item_id": "MLA1391786841",
    "title": {
        "text": "Experiencia de compra"
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Tienes un problema con este producto. Revisa los consejos sobre cómo mejorar."
        },
        {
            "order": 1,
            "text": "Podríamos anular tu publicación si continúa brindando mala experiencia."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        },
        {
            "order": 1,
            "text": "Pausar desde el listado"
        }
    ],
    "reputation": {
        "color": "red",
        "text": "Mala",
        "value": 30
    },
    "status": {
        "id": "active"
    },
    "metrics_details": {
        "problems": [
            {
                "order": 0,
                "key": "PRODUCT",
                "color": "#7267E4",
                "quantity": "1 problema",
                "cancellations": 0,
                "claims": 1,
                "tag": "PROBLEMA PRINCIPAL",
                "level_two": {
                    "key": "POOR_CONDITION",
                    "title": {
                        "text": "Estaban en mal estado"
                    }
                },
                "level_three": {
                    "key": "PRODUCT_IN_BAD_CONDITION",
                    "title": {
                        "text": "El producto llegó en mal estado"
                    },
                    "remedy": {
                        "text": "Revisa que los productos que vendes estén en buenas condiciones antes de enviarlos o despacharlos. "
                    }
                }
            }
        ],
        "distribution": {
            "from": "2023-04-21T09:06:05Z",
            "to": "2023-10-18T09:06:05Z",
            "level_one": [
                {
                    "key": "PRODUCT",
                    "title": {
                        "text": "Con el producto entregado"
                    },
                    "color": "#7267E4",
                    "percentage": 100.0,
                    "quantities_level_two": [
                        {
                            "key": "POOR_CONDITION",
                            "title": {
                                "text": "Estaban en mal estado"
                            },
                            "quantity": 1
                        }
                    ]
                }
            ]
        }
    }
}
```

## Detalle de problemas

## Distribución con tooltip

Ejemplo:

```
{
    "distribution": {
        "from": "2023-02-01T00:00:00-03:00",
        "to": "2023-08-11T00:00:00-03:00",
        "level_1": [
            {
                "key": "OPERATION",
                "title": {
                    "text": "Con el producto entregado"
                },
                "color": "#102012",
                "percentage": 80,
                "quantities_level_2": [
                    {
                        "key": "X",
                        "title": {
                            "text": "Tenia fallas"
                        },
                        "quantity": 70
                    },
                    {
                        "key": "X",
                        "title": {
                            "text": "Es diferente a lo pedido"
                        },
                        "quantity": 16
                    }
                ]
            },
            {
                "key": "X",
                "title": {
                    "text": "Al despachar o entregar el producto"
                },
                "color": "#103012",
                "percentage": 15
            },
            {
                "key": "PRODUCT_NOT_PREPARED",
                "title": {
                    "text": "Al preparar o gestionar la venta"
                },
                "color": "#103012",
                "percentage": 5
            }
        ]
    }
}
```

## Consulta por User Product (Nuevo)

Este recurso permite a los integradores consumir la experiencia de compra orientada a User Products (UPs) con análisis de Inteligencia Artificial. Este modelo incorpora nuevas fuentes de información, razonamientos detallados en relación al "porqué" de la misma y sugiere acciones.

- **IA Explicativa:**  Razonamientos detallados sobre el score de “experiencia de compra” de tus productos.

- **Visión Completa:**  Considera demoras en envíos, cancelaciones del vendedor y problemas detectados en reclamos, opiniones y comunicaciones.

- **Evaluación Inteligente:**  Para productos con pocas ventas, utiliza el rendimiento de productos similares del mismo vendedor.

- **Foco Optimizado:**  Ya no se consideran arrepentimientos de los compradores.

### Llamada

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/reputation/user_products/{UP_ID}/purchase_experience/integrators
```

### Ejemplo

```

curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/reputation/user_products/MLAU1391786841/purchase_experience/integrators?locale=es_AR
```

### Respuesta

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": "Asegúrate de evitar problemas en tus próximas ventas para proteger tu exposición."
        }
    },
    "reputation": {
        "color": "green",
        "text": "Buena",
        "value": 100
    },
    "status": {
        "id": "active"
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Mantuviste baja la tasa de problemas de producto. Gestionaste reclamos y cancelaciones con eficacia..."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": "Qué puedes hacer"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Revisa tus procesos de entrega para reducir demoras."
            },
            {
                "order": 1,
                "text": "Mejora la gestión de reclamos."
            }
        ]
    },
    "principal_actionable": {
        "order": 0,
        "text": "Asegúrate de entregar el producto correcto."
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### Parámetros requeridos

El único parámetro requerido es el de locale, con el fin de obtener los textos correspondientes para cada idioma, logrando brindar información detallada y clara.

| Query params | Type | Mandatory | Values | Only one |
| --- | --- | --- | --- | --- |
| locale | string | YES | es_MX, es_UY, es_CO, es_CL, es_AR, es_PE, pt_BR | YES |

### Campos de la Respuesta

- **up_id (string):**  Identificador único del User Product.

- **freeze (object):**  Objeto que contiene información sobre el freeze aplicado al UP.

- **text (string):**  aviso de freezado de experiencia por el cual no se aplican consecuencias sobre el UP (puede estar vacío).

- **placeholders (array of strings):**  Arreglo de strings que representan los placeholders para formatear el texto de "freeze". Ejemplo: asdasd {0} asdasd {1}. Los {} deberán ser reemplazados por los placeholders.

- **title (object):**  Objeto que contiene el título de la sección.

- **text (string):**  Texto del título (en este caso, "Experiencia de compra").

- **consequence (object):**  Objeto que describe la posible consecuencia en base al resultado de la experiencia de compra del UP.

- **title (object):**  Objeto que contiene el texto de la consecuencia.

- **order (integer):**  Orden de la consecuencia.

- **text (string):**  Texto de la consecuencia.

- **reputation (object):**  Objeto que describe la experiencia de compra del producto.

- **color (string):**  Color asociado a la experiencia de compra (ej: "green").

- **text (string):**  Descripción textual de la experiencia de compra (ej: "Buena").

- **value (integer):**  Valor numérico de la experiencia de compra (ej: 100).

- **status (object):**  Objeto que describe el estado del UP.

- **id (string):**  Identificador del estado (ej: "active").

- **reasoning (object):**  Objeto que explica el razonamiento detrás de la evaluación.

- **title (object):**  Objeto que contiene el título del razonamiento.

- **order (integer):**  Orden del título del razonamiento.

- **text (string):**  Texto del título del razonamiento.

- **subtitles (array of objects):**  Arreglo de subtítulos que explican el razonamiento.

- **order (integer):**  Orden del subtítulo.

- **text (string):**  Texto del subtítulo.

- **recommendations (object):**  Objeto que contiene recomendaciones para mejorar.

- **title (object):**  Objeto que contiene el título de las recomendaciones.

- **order (integer):**  Orden del título de las recomendaciones.

- **text (string):**  Texto del título de las recomendaciones.

- **subtitles (array of objects):**  Arreglo de recomendaciones específicas (puede retornar hasta 3 recomendaciones por UP).

- **order (integer):**  Orden de la recomendación.

- **text (string):**  Recomendación.

- **principal_actionable (object):**  Objeto que describe la acción principal a realizar a modo de resumen de recomendaciones.

- **order (integer):**  Orden de la acción principal.

- **text (string):**  Texto de la acción principal.

- **ai_generated (object):**  Objeto que indica que la información fue generada por IA.

- **order (integer):**  Orden de la indicación de IA.

- **text (string):**  Texto que indica que la información fue generada por IA.

## Ejemplos

### UP activo con score 100 - sin recomendaciones

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": "¡Bien hecho! Asegúrate de evitar problemas en tus próximas ventas para cuidar tu exposición."
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "green",
        "text": "Buena",
        "value": 100
    },
    "status": {
        "id": "active"
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Brindaste una excelente experiencia de compra. Sigue manteniendo este desempeño en tus próximas ventas."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": ""
        },
        "subtitles": []
    },
    "principal_actionable": {
        "order": 0,
        "text": ""
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### UP activo con score 100 - con recomendaciones / score 75

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": "Asegúrate de evitar problemas en tus próximas ventas para cuidar tu exposición."
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "green",
        "text": "Buena",
        "value": 100
    },
    "status": {
        "id": "active"
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Mantuviste baja la tasa de problemas de producto. Gestionaste reclamos, cancelaciones y demoras con eficacia. Lograste opiniones superiores al promedio."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": "Qué puedes hacer"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Revisá tus procesos de entrega para reducir demoras y cumplir los tiempos prometidos."
            },
            {
                "order": 1,
                "text": "Mejorá la gestión de reclamos para resolverlos en forma rápida y completa."
            },
            {
                "order": 2,
                "text": "Ajustá controles de calidad para disminuir incidencias de producto."
            }
        ]
    },
    "principal_actionable": {
        "order": 0,
        "text": "Asegurate de entregar el producto correcto."
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### UP activo con score 65 - 50

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": "Está afectando tu exposición. Podríamos anular tu publicación si sigues brindando mala experiencia."
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "orange",
        "text": "Media",
        "value": 65
    },
    "status": {
        "id": "active"
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Recibiste demoras reiteradas en envíos. Tuviste reclamos sin resolver y mayor proporción de problemas de producto que la categoría. Tus opiniones quedaron apenas debajo del promedio."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": "Qué puedes hacer"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Revisá tus procesos de entrega para reducir demoras y cumplir los tiempos prometidos."
            },
            {
                "order": 1,
                "text": "Mejorá la gestión de reclamos para resolverlos en forma rápida y completa."
            },
            {
                "order": 2,
                "text": "Ajustá controles de calidad para disminuir incidencias de producto."
            }
        ]
    },
    "principal_actionable": {
        "order": 0,
        "text": "Asegurate de entregar el producto correcto."
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### UP activo con score 30

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": "Tienes muy baja exposición. Podríamos anular tu publicación si sigues brindando mala experiencia."
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "red",
        "text": "Mala",
        "value": 30
    },
    "status": {
        "id": "active"
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Recibiste demoras reiteradas en envíos. Tuviste reclamos sin resolver y mayor proporción de problemas de producto que la categoría. Tus opiniones quedaron apenas debajo del promedio."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": "Qué puedes hacer"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Revisá tus procesos de entrega para reducir demoras y cumplir los tiempos prometidos."
            },
            {
                "order": 1,
                "text": "Mejorá la gestión de reclamos para resolverlos en forma rápida y completa."
            },
            {
                "order": 2,
                "text": "Ajustá controles de calidad para disminuir incidencias de producto."
            }
        ]
    },
    "principal_actionable": {
        "order": 0,
        "text": "Asegurate de entregar el producto correcto."
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### UP pausado con score 50

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": ""
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "orange",
        "text": "Media",
        "value": 50
    },
    "status": {
        "id": "paused",
        "text": "Tu publicación está inactiva."
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Recibiste demoras reiteradas en envíos. Tuviste reclamos sin resolver y mayor proporción de problemas de producto que la categoría. Tus opiniones quedaron apenas debajo del promedio."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": "Qué puedes hacer"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Revisá tus procesos de entrega para reducir demoras y cumplir los tiempos prometidos."
            },
            {
                "order": 1,
                "text": "Mejorá la gestión de reclamos para resolverlos en forma rápida y completa."
            },
            {
                "order": 2,
                "text": "Ajustá controles de calidad para disminuir incidencias de producto."
            }
        ]
    },
    "principal_actionable": {
        "order": 0,
        "text": "Asegurate de entregar el producto correcto."
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### UP moderado con score 30

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": ""
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "red",
        "text": "Mala",
        "value": 30
    },
    "status": {
        "id": "moderated",
        "text": "Tu publicación está inactiva."
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Recibiste demoras reiteradas en envíos. Tuviste reclamos sin resolver y mayor proporción de problemas de producto que la categoría. Tus opiniones quedaron apenas debajo del promedio."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": "Qué puedes hacer"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Revisá tus procesos de entrega para reducir demoras y cumplir los tiempos prometidos."
            },
            {
                "order": 1,
                "text": "Mejorá la gestión de reclamos para resolverlos en forma rápida y completa."
            },
            {
                "order": 2,
                "text": "Ajustá controles de calidad para disminuir incidencias de producto."
            }
        ]
    },
    "principal_actionable": {
        "order": 0,
        "text": "Asegúrate de entregar el producto correcto."
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### UP freezado con score 50

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": "Por el momento esta publicación no perderá exposición ni la anularemos por ofrecer una experiencia mala o media. {0}Evita problemas en tus próximas ventas para mejorar.{1}",
        "placeholders": [
            "",
            ""
        ]
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": ""
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "orange",
        "text": "Media",
        "value": 50
    },
    "status": {
        "id": "active"
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": "Qué evaluamos para calcular tu desempeño"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Recibiste demoras reiteradas en envíos. Tuviste reclamos sin resolver y mayor proporción de problemas de producto que la categoría. Tus opiniones quedaron apenas debajo del promedio."
            }
        ]
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": "Qué puedes hacer"
        },
        "subtitles": [
            {
                "order": 0,
                "text": "Revisá tus procesos de entrega para reducir demoras y cumplir los tiempos prometidos."
            },
            {
                "order": 1,
                "text": "Mejorá la gestión de reclamos para resolverlos en forma rápida y completa."
            },
            {
                "order": 2,
                "text": "Ajustá controles de calidad para disminuir incidencias de producto."
            }
        ]
    },
    "principal_actionable": {
        "order": 0,
        "text": "Asegurate de entregar el producto correcto."
    },
    "ai_generated": {
        "order": 0,
        "text": "Generado por inteligencia artificial"
    }
}
```

### UP sin experiencia de compra

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": ""
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        },
        {
            "order": 2,
            "text": "Todavía no tuviste suficientes ventas como para calcularla."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "gray",
        "value": -1
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": ""
        },
        "subtitles": []
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": ""
        },
        "subtitles": []
    },
    "principal_actionable": {
        "order": 0,
        "text": ""
    },
    "ai_generated": {
        "order": 0,
        "text": ""
    }
}
```

### UP en estado fallback

```

{
    "up_id": "MLMU1234",
    "freeze": {
        "text": ""
    },
    "title": {
        "text": "Experiencia de compra"
    },
    "consequence": {
        "title": {
            "order": 0,
            "text": ""
        }
    },
    "subtitles": [
        {
            "order": 0,
            "text": "Para calcularla, comparamos tu desempeño con el de otros vendedores. Consideramos los reclamos que recibes, las demoras en el envío y las cancelaciones que realices."
        },
        {
            "order": 1,
            "text": "También analizamos preguntas y respuestas, opiniones y tu mensajería para identificar problemas con el producto."
        },
        {
            "order": 2,
            "text": "No pudimos calcular tu experiencia de compra."
        }
    ],
    "actions": [
        {
            "order": 0,
            "text": "Modificar publicación"
        }
    ],
    "reputation": {
        "color": "gray",
        "value": -1
    },
    "reasoning": {
        "title": {
            "order": 0,
            "text": ""
        },
        "subtitles": []
    },
    "recommendations": {
        "title": {
            "order": 0,
            "text": ""
        },
        "subtitles": []
    },
    "principal_actionable": {
        "order": 0,
        "text": ""
    },
    "ai_generated": {
        "order": 0,
        "text": ""
    }
}
```

## Ejemplo UP de un Kit Virtual

### Respuesta UP Kit

```

{
    "up_id": "MLAU1000",
    "is_kit": true,
    "title": {
        "text": "Experiencia de compra de los productos del kit",
        "tooltip": {
            "paragraphs": [
                {
                    "order": 0,
                    "text": "La experiencia de compra del kit se ve afectada por el producto con peor experiencia."
                }
            ]
        }
    },
    "status": {
        "id": "active"
    },
    "kit_components": [
        {
            "order": 0,
            "up_id": "MLAU1001",
            "affecting_kit": true,
            "subtitles": [
                {
                    "text": "Asegúrate de entregar el producto correcto."
                }
            ],
            "actions": [
                {
                    "order": 0,
                    "text": "Revisar problemas"
                }
            ],
            "reputation": {
                "color": "red",
                "value": 30
            },
            "status": {
                "id": "active"
            },
            "tag": {
                "text": "AFECTANDO AL KIT"
            }
        },
        {
            "order": 1,
            "up_id": "MLAU1002",
            "affecting_kit": false,
            "subtitles": [
                {
                    "text": "Asegúrate de entregar el producto correcto."
                }
            ],
            "actions": [
                {
                    "order": 0,
                    "text": "Revisar problemas"
                }
            ],
            "reputation": {
                "color": "orange",
                "value": 65
            },
            "status": {
                "id": "active"
            }
        },
        {
            "order": 2,
            "up_id": "MLAU1003",
            "affecting_kit": false,
            "subtitles": [
                {
                    "text": "Estás brindando una buena experiencia. ¡Seguí así!"
                }
            ],
            "actions": [
                {
                    "order": 1,
                    "text": "Ver publicación"
                }
            ],
            "reputation": {
                "color": "green",
                "value": 100
            },
            "status": {
                "id": "active"
            }
        },
        {
            "order": 3,
            "up_id": "MLAU1004",
            "affecting_kit": false,
            "subtitles": [
                {
                    "text": "Estás brindando una buena experiencia. ¡Seguí así!"
                }
            ],
            "actions": [
                {
                    "order": 1,
                    "text": "Ver publicación"
                }
            ],
            "reputation": {
                "color": "green",
                "value": 100
            },
            "status": {
                "id": "active"
            }
        }
    ]
}
```

### Campos de la Respuesta UP Kit

- **up_id (string):**  Identificador único del User Product Kit.

- **is_kit (boolean):**  Indica si el User Product corresponde a un kit de productos. Puede ser **true**  (el UP es un kit).

- **title (object):**  Objeto que contiene la información del título de la sección.  **text (string):**  Texto del título principal de la sección. **tooltip (object):**  Objeto que contiene información contextual adicional.  **paragraphs (array of objects):**  Arreglo de párrafos informativos.  **order (integer):**  Orden del párrafo. **text (string):**  Texto explicativo del tooltip.

- **status (object):**  Objeto que describe el estado actual del kit.  **id (string):**  Identificador del estado (ej: "active").

- **kit_components (array of objects):**  Arreglo que representa los productos que componen el kit. Cada elemento corresponde a un User Product individual.  **order (integer):**  Orden del producto dentro del kit. **up_id (string):**  Identificador único del User Product componente. **affecting_kit (boolean):**  Indica si el producto está afectando negativamente la experiencia general del kit. **subtitles (array of objects):**  Mensajes informativos asociados al producto.  **text (string):**  Texto del mensaje informativo.   **actions (array of objects):**  Acciones disponibles para el producto.  **order (integer):**  Orden de la acción. **text (string):**  Texto de la acción.   **reputation (object):**  Objeto que describe la experiencia de compra del producto.  **color (string):**  Color semántico asociado a la experiencia (ej: "green", "orange", "red"). **value (integer):**  Valor numérico de la experiencia de compra (0-100).   **status (object):**  Objeto que describe el estado del User Product componente.  **id (string):**  Identificador del estado (ej: "active").   **tag (object):**  (opcional) Objeto utilizado para destacar visualmente un producto dentro del kit.  **text (string):**  Texto de la etiqueta (ej: "AFECTANDO AL KIT").

## Ejemplos

### Kit - Un componente afectando al kit

```

{
    "up_id": "MLAU1000",
    "is_kit": true,
    "title": {
        "text": "Experiencia de compra de los productos del kit",
        "tooltip": {
            "paragraphs": [
                {
                    "order": 0,
                    "text": "La experiencia de compra del kit se ve afectada por el producto con peor experiencia."
                }
            ]
        }
    },
    "status": {
        "id": "active"
    },
    "kit_components": [
        {
            "order": 0,
            "up_id": "MLAU1001",
            "affecting_kit": true,
            "subtitles": [
                { "text": "Asegúrate de entregar el producto correcto." }
            ],
            "actions": [
                { "order": 0, "text": "Revisar problemas" }
            ],
            "reputation": { "color": "red", "value": 30 },
            "status": { "id": "active" },
            "tag": { "text": "AFECTANDO AL KIT" }
        },
        {
            "order": 1,
            "up_id": "MLAU1002",
            "affecting_kit": false,
            "subtitles": [
                { "text": "Asegúrate de entregar el producto correcto." }
            ],
            "actions": [
                { "order": 0, "text": "Revisar problemas" }
            ],
            "reputation": { "color": "orange", "value": 65 },
            "status": { "id": "active" }
        },
        {
            "order": 2,
            "up_id": "MLAU1003",
            "affecting_kit": false,
            "subtitles": [
                { "text": "Estás brindando una buena experiencia. ¡Seguí así!" }
            ],
            "actions": [
                { "order": 1, "text": "Ver publicación" }
            ],
            "reputation": { "color": "green", "value": 100 },
            "status": { "id": "active" }
        },
        {
            "order": 3,
            "up_id": "MLAU1004",
            "affecting_kit": false,
            "subtitles": [
                { "text": "Estás brindando una buena experiencia. ¡Seguí así!" }
            ],
            "actions": [
                { "order": 1, "text": "Ver publicación" }
            ],
            "reputation": { "color": "green", "value": 100 },
            "status": { "id": "active" }
        }
    ]
}
```

### Kit - Todos sus componentes activos con score 100

```

{
    "up_id": "MLAU1000",
    "is_kit": true,
    "title": {
        "text": "Experiencia de compra de los productos del kit",
        "tooltip": {
            "paragraphs": [
                {
                    "order": 0,
                    "text": "La experiencia de compra del kit se ve afectada por el producto con peor experiencia."
                }
            ]
        }
    },
    "status": {
        "id": "active"
    },
    "kit_components": [
        {
            "order": 0,
            "up_id": "MLAU1001",
            "affecting_kit": false,
            "subtitles": [
                { "text": "Estás brindando una buena experiencia. ¡Seguí así!" }
            ],
            "actions": [
                { "order": 1, "text": "Ver publicación" }
            ],
            "reputation": { "color": "green", "value": 100 },
            "status": { "id": "active" }
        },
        {
            "order": 1,
            "up_id": "MLAU1002",
            "affecting_kit": false,
            "subtitles": [
                { "text": "Estás brindando una buena experiencia. ¡Seguí así!" }
            ],
            "actions": [
                { "order": 1, "text": "Ver publicación" }
            ],
            "reputation": { "color": "green", "value": 100 },
            "status": { "id": "active" }
        },
        {
            "order": 2,
            "up_id": "MLAU1003",
            "affecting_kit": false,
            "subtitles": [
                { "text": "Estás brindando una buena experiencia. ¡Seguí así!" }
            ],
            "actions": [
                { "order": 1, "text": "Ver publicación" }
            ],
            "reputation": { "color": "green", "value": 100 },
            "status": { "id": "active" }
        },
        {
            "order": 3,
            "up_id": "MLAU1004",
            "affecting_kit": false,
            "subtitles": [
                { "text": "Estás brindando una buena experiencia. ¡Seguí así!" }
            ],
            "actions": [
                { "order": 1, "text": "Ver publicación" }
            ],
            "reputation": { "color": "green", "value": 100 },
            "status": { "id": "active" }
        }
    ]
}
```

### Posibles errores

| Error_code | Mensaje de error | Descripción |
| --- | --- | --- |
| 400 | Bad Request | La solicitud es inválida o no se puede entender por el servidor. |
| 404 | Resource not found | El recurso no está funcionando o que se realizó mal la llamada. |
| 500 | Internal Server Error | El servidor ha tenido un error inesperado y no puede completar la solicitud. |
