<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/proximity-gestion-de-pedidos -->
<!-- Sección: Guía para Proximity > Gestión de Pedidos -->

# Consulta de Pedidos

Última actualización 20/08/2026

## Consulta de Pedidos

Nota:

**Para consultar los datos de una orden, realiza un GET enviando `shipment_id` y `access_token` (generados por el proceso de autenticación OAuth) al endpoint.**  Consulta [Seguridad](https://www.mercadopago.com.ar/developers/es/docs/mp-delivery/additional-content/security/oauth/introduction) para obtener más información sobre OAuth. En la siguiente documentación encontrará recursos referentes a Mercado Pago, para más información consulta el site de [Developers Mercado Pago](https://www.mercadopago.com.ar/developers/es/docs/mp-delivery/introduction).

## Consulta de Pedido by ID

### Llamada

```
curl -X GET \
'https://api.mercadopago.com/proximity-integration/v1/orders/$SHIPMENT_ID' \
--header 'Content-Type: application/json' \
--header 'x-time-zone: GMT-3' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

### Ejemplo

```
curl --location 'https://api.mercadopago.com/proximity-integration/v2/orders/44962414957' \
--header 'Content-Type: application/json' \
--header 'x-time-zone: GMT-3' \
--header 'Authorization: Bearer $ACCESS_TOKEN'
```

### Respuesta - Completa

```
{
  "id": "42456789268",
  "type": "DELIVERY",
  "displayId": "8637",
  "createdAt": "2025-07-15T14:37:09Z",
  "orderTiming": "INSTANT",
  "preparationStartDateTime": "2025-07-15T14:37:23Z",
  "merchant": {
    "id": "314941456",
    "name": "Burger Delivery"
  },
  "items": [
    {
      "id": "MLA2403369654",
      "name": "Combo Jamón Y Queso Xl 30% Off",
      "externalCode": "SKU1212",
      "unit": "UNIT",
      "quantity": 1,
      "options": [
        {
          "id": "MLA2271395286",
          "name": "Papas Regulares",
          "externalCode": "1104002",
          "unit": "UNIT",
          "quantity": 1,
          "unitPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "totalPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "extension": {
            "group": "Acompañamiento"
          }
        },
        {
          "id": "MLA2066333338",
          "name": "Pomelo Botella",
          "externalCode": "1110038",
          "unit": "UNIT",
          "quantity": 1,
          "unitPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "totalPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "extension": {
            "group": "Bebida"
          }
        },
        {
          "id": "MLA2210351246",
          "name": "Sin Adicional.",
          "externalCode": "110043",
          "unit": "UNIT",
          "quantity": 1,
          "unitPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "totalPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "extension": {
            "group": "Adicional."
          }
        }
      ],
      "unitPrice": {
        "value": 13650.0,
        "currency": "ARS"
      },
      "fullUnitPrice": {
        "value": 19500.0,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 0.0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 13650.0,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 13650.0,
          "currency": "ARS"
        }
      }
    },
    {
      "id": "MLA2403369654",
      "name": "Combo Jamón Y Queso Xl 30% Off",
      "externalCode": "SKU1313",
      "unit": "UNIT",
      "quantity": 1,
      "options": [
        {
          "id": "MLA2276008506",
          "name": "Papas Medianas",
          "externalCode": "SKU1311",
          "unit": "UNIT",
          "quantity": 1,
          "unitPrice": {
            "value": 3200.0,
            "currency": "ARS"
          },
          "totalPrice": {
            "value": 3200.0,
            "currency": "ARS"
          },
          "extension": {
            "group": "Acompañamiento"
          }
        },
        {
          "id": "MLA2066333338",
          "name": "Pomelo Botella",
          "externalCode": "SKU1314",
          "unit": "UNIT",
          "quantity": 1,
          "unitPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "totalPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "extension": {
            "group": "Bebida"
          }
        },
        {
          "id": "MLA2210351246",
          "name": "Sin Adicional.",
          "externalCode": "SKU1315",
          "unit": "UNIT",
          "quantity": 1,
          "unitPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "totalPrice": {
            "value": 0.0,
            "currency": "ARS"
          },
          "extension": {
            "group": "Adicional."
          }
        }
      ],
      "unitPrice": {
        "value": 13650.0,
        "currency": "ARS"
      },
      "fullUnitPrice": {
        "value": 19500.0,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 3200.0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 16850.0,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 13650.0,
          "currency": "ARS"
        }
      }
    }
  ],
  "item_discounts": [
    {
      "type": "item_discount",
      "items": [
        {
          "id": "MLA2403369654",
          "amounts": {
            "seller": 11700.00,
            "meli": 3900.00,
            "currency": "ARS"
          }
        }
      ]
    }
  ],
  "discounts": [
    {
      "type": "order_discount",
      "amount": {
        "value": 5000.0,
        "currency": "ARS"
      },
      "target": "CART",
      "sponsorshipValues": [
        {
          "name": "MARKETPLACE",
          "amount": {
            "value": 5000.0,
            "currency": "ARS"
          }
        }
      ],
      "extension": {
        "id": "COUPON-XYZ-001",
        "name": "coupon_off"
      }
    }
  ],
  "total": {
    "itemsPrice": {
      "value": 30500.0,
      "currency": "ARS"
    },
    "fullItemsPrice": {
      "value": 42200.0,
      "currency": "ARS"
    },
    "otherFees": {
      "value": 0,
      "currency": "ARS"
    },
    "discount": {
      "value": 5000.0,
      "currency": "ARS"
    },
    "orderAmount": {
      "value": 25500.0,
      "currency": "ARS"
    }
  },
  "payments": {
    "prepaid": 25500,
    "pending": 0,
    "methods": [
      {
        "value": 25500,
        "currency": "ARS",
        "type": "PREPAID",
        "method": "DIGITAL_WALLET"
      }
    ]
  },
  "customer": {
    "id": "222444999",
    "name": "Jose Perez"
  },
  "delivery": {
    "deliveredBy": "MARKETPLACE",
    "deliveryAddress": {
      "country": "Argentina",
      "state": "Buenos Aires",
      "city": "Capital Federal",
      "street": "Calle Doctor",
      "number": "369",
      "formattedAddress": "Calle Doctor 1112",
      "postalCode": "1706",
      "coordinates": {
        "latitude": -34.638651,
        "longitude": -58.581745
      }
    },
    "estimatedDeliveryDateTime": "2025-07-15T15:58:51Z"
  },
  "extension": {
    "status": "cancelled",
    "store": {
      "id": "22123",
      "brandId": 43,
      "brandName": "Brand Name"
    },
    "cancellationDateTime": "2025-07-15T14:49:02Z",
    "estimatedPickupDate": "2025-07-15T18:48:52Z",
    "paymentsInfo": [
      {
        "id": 129470511425,
        "entity": "ORDER",
        "entityId": 2000013427541490
      },
      {
        "id": 130046187226,
        "entity": "ORDER",
        "entityId": 2000013427539752
      }
    ]
  }
}
```

### Respuesta - 1 Item con descuento Seller + MeLi

```
{
  "id": "44969732488",
  "type": "DELIVERY",
  "displayId": "7809",
  "createdAt": "2025-06-05T20:34:43+0000",
  "orderTiming": "INSTANT",
  "preparationStartDateTime": "2025-06-05T20:34:56+0000",
  "merchant": {
    "id": "1273291432",
    "name": "McCafe A7L"
  },
  "items": [
    {
      "id": "MLA111111111",
      "name": "Café + Tostado Lomo y Queso",
      "externalCode": "26805_4cc19d8a12fe4f25bdef2f3eda53ebc0",
      "unit": "UNIT",
      "quantity": 1,
      "fullUnitPrice": {
        "value": 10000,
        "currency": "ARS"
      },
      "unitPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 7000,
          "currency": "ARS"
        }
      }
    }
  ],
  "total": {
    "itemsPrice": {
      "value": 7000,
      "currency": "ARS"
    },
    "otherFees": {
      "value": 0,
      "currency": "ARS"
    },
    "discount": {
      "value": 0,
      "currency": "ARS"
    },
    "orderAmount": {
      "value": 7000,
      "currency": "ARS"
    },
    "fullItemsPrice": {
      "value": 10000,
      "currency": "ARS"
    }
  },
  "discounts": [],
  "item_discounts": [
    {
      "type": "item_discount",
      "items": [
        {
          "id": "MLA111111111",
          "amounts": {
            "seller": 2000,
            "meli": 1000,
            "currency": "ARS"
          }
        }
      ]
    }
  ],
  "payments": {
    "prepaid": 7000,
    "pending": 0,
    "methods": [
      {
        "value": 7000,
        "currency": "ARS",
        "type": "PREPAID",
        "method": "DEBIT"
      }
    ]
  },
  "customer": {
    "id": "400412664",
    "name": "xxxxxxxx"
  },
  "delivery": {
    "deliveredBy": "MARKETPLACE",
    "deliveryAddress": {
      "country": "Argentina",
      "state": "Buenos Aires",
      "city": "La Plata",
      "district": "La Plata",
      "street": "xxxx",
      "number": "111",
      "reference": "xxxx",
      "formattedAddress": "xxxx",
      "postalCode": "1900",
      "coordinates": {
        "latitude": -34,
        "longitude": -57
      }
    },
    "estimatedDeliveryDateTime": "2025-06-05T20:57:27+0000",
    "deliveryDateTime": "2025-06-05T20:58:06+0000"
  },
  "extension": {
    "status": "delivered",
    "store": {
      "id": "70032846",
      "externalCode": "70032846",
      "brandId": 10922,
      "brandName": "McCafé"
    },
    "estimatedPickupDate": "2025-06-05T20:47:45+0000",
    "paymentsInfo": [
      {
        "id": 113566231521,
        "entity": "ORDER",
        "entityId": 2000011850006100
      },
      {
        "id": 113566199723,
        "entity": "ORDER",
        "entityId": 2000011850000694
      }
    ]
  }
}
```

### Respuesta - 1 item con descuento solo MeLi

```
{
  "id": "44969732488",
  "type": "DELIVERY",
  "displayId": "7809",
  "createdAt": "2025-06-05T20:34:43+0000",
  "orderTiming": "INSTANT",
  "preparationStartDateTime": "2025-06-05T20:34:56+0000",
  "merchant": {
    "id": "1273291432",
    "name": "McCafe A7L"
  },
  "items": [
    {
      "id": "MLA111111111",
      "name": "Café + Tostado Lomo y Queso",
      "externalCode": "26805_4cc19d8a12fe4f25bdef2f3eda53ebc0",
      "unit": "UNIT",
      "quantity": 2,
      "fullUnitPrice": {
        "value": 8000,
        "currency": "ARS"
      },
      "unitPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 14000,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 7000,
          "currency": "ARS"
        }
      }
    }
  ],
  "total": {
    "itemsPrice": {
      "value": 14000,
      "currency": "ARS"
    },
    "otherFees": {
      "value": 0,
      "currency": "ARS"
    },
    "discount": {
      "value": 0,
      "currency": "ARS"
    },
    "orderAmount": {
      "value": 14000,
      "currency": "ARS"
    },
    "fullItemsPrice": {
      "value": 16000,
      "currency": "ARS"
    }
  },
  "discounts": [],
  "item_discounts": [
    {
      "type": "item_discount",
      "items": [
        {
          "id": "MLA111111111",
          "amounts": {
            "seller": 0,
            "meli": 2000,
            "currency": "ARS"
          }
        }
      ]
    }
  ],
  "payments": {
    "prepaid": 14000,
    "pending": 0,
    "methods": [
      {
        "value": 14000,
        "currency": "ARS",
        "type": "PREPAID",
        "method": "DEBIT"
      }
    ]
  },
  "customer": {
    "id": "400412664",
    "name": "xxxxxxxx"
  },
  "delivery": {
    "deliveredBy": "MARKETPLACE",
    "deliveryAddress": {
      "country": "Argentina",
      "state": "Buenos Aires",
      "city": "La Plata",
      "district": "La Plata",
      "street": "xxxx",
      "number": "111",
      "reference": "xxxx",
      "formattedAddress": "xxxx",
      "postalCode": "1900",
      "coordinates": {
        "latitude": -34,
        "longitude": -57
      }
    },
    "estimatedDeliveryDateTime": "2025-06-05T20:57:27+0000",
    "deliveryDateTime": "2025-06-05T20:58:06+0000"
  },
  "extension": {
    "status": "delivered",
    "store": {
      "id": "70032846",
      "externalCode": "70032846",
      "brandId": 10922,
      "brandName": "McCafé"
    },
    "estimatedPickupDate": "2025-06-05T20:47:45+0000",
    "paymentsInfo": [
      {
        "id": 113566231521,
        "entity": "ORDER",
        "entityId": 2000011850006100
      },
      {
        "id": 113566199723,
        "entity": "ORDER",
        "entityId": 2000011850000694
      }
    ]
  }
}
```

### Respuesta - 1 Item con y 1 sin descuento

```
{
  "id": "44969732488",
  "type": "DELIVERY",
  "displayId": "7809",
  "createdAt": "2025-06-05T20:34:43+0000",
  "orderTiming": "INSTANT",
  "preparationStartDateTime": "2025-06-05T20:34:56+0000",
  "merchant": {
    "id": "1273291432",
    "name": "McCafe A7L"
  },
  "items": [
    {
      "id": "MLA111111111",
      "name": "Café + Tostado Lomo y Queso",
      "externalCode": "26805_4cc19d8a12fe4f25bdef2f3eda53ebc0",
      "unit": "UNIT",
      "quantity": 1,
      "fullUnitPrice": {
        "value": 10000,
        "currency": "ARS"
      },
      "unitPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 7000,
          "currency": "ARS"
        }
      }
    },
    {
      "id": "MLA222222222",
      "name": "Poundcake Banana y nuez al 50OFF",
      "externalCode": "8419_caa8bf68f8a0410eb521790d3676d6c5",
      "unit": "UNIT",
      "quantity": 1,
      "fullUnitPrice": {
        "value": 4500,
        "currency": "ARS"
      },
      "unitPrice": {
        "value": 4500,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 4500,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 4500,
          "currency": "ARS"
        }
      }
    }
  ],
  "total": {
    "itemsPrice": {
      "value": 11500,
      "currency": "ARS"
    },
    "otherFees": {
      "value": 0,
      "currency": "ARS"
    },
    "discount": {
      "value": 0,
      "currency": "ARS"
    },
    "orderAmount": {
      "value": 11500,
      "currency": "ARS"
    },
    "fullItemsPrice": {
      "value": 14500,
      "currency": "ARS"
    }
  },
  "discounts": [],
  "item_discounts": [
    {
      "type": "item_discount",
      "items": [
        {
          "id": "MLA111111111",
          "amounts": {
            "seller": 2000,
            "meli": 1000,
            "currency": "ARS"
          }
        }
      ]
    }
  ],
  "payments": {
    "prepaid": 11500,
    "pending": 0,
    "methods": [
      {
        "value": 11500,
        "currency": "ARS",
        "type": "PREPAID",
        "method": "DEBIT"
      }
    ]
  },
  "customer": {
    "id": "400412664",
    "name": "xxxxxxxx"
  },
  "delivery": {
    "deliveredBy": "MARKETPLACE",
    "deliveryAddress": {
      "country": "Argentina",
      "state": "Buenos Aires",
      "city": "La Plata",
      "district": "La Plata",
      "street": "xxxx",
      "number": "111",
      "reference": "xxxx",
      "formattedAddress": "xxxx",
      "postalCode": "1900",
      "coordinates": {
        "latitude": -34,
        "longitude": -57
      }
    },
    "estimatedDeliveryDateTime": "2025-06-05T20:57:27+0000",
    "deliveryDateTime": "2025-06-05T20:58:06+0000"
  },
  "extension": {
    "status": "delivered",
    "store": {
      "id": "70032846",
      "externalCode": "70032846",
      "brandId": 10922,
      "brandName": "McCafé"
    },
    "estimatedPickupDate": "2025-06-05T20:47:45+0000",
    "paymentsInfo": [
      {
        "id": 113566231521,
        "entity": "ORDER",
        "entityId": 2000011850006100
      },
      {
        "id": 113566199723,
        "entity": "ORDER",
        "entityId": 2000011850000694
      }
    ]
  }
}
```

### Respuesta - 2 Items iguales con descuento

```
{
  "id": "44969732488",
  "type": "DELIVERY",
  "displayId": "7809",
  "createdAt": "2025-06-05T20:34:43+0000",
  "orderTiming": "INSTANT",
  "preparationStartDateTime": "2025-06-05T20:34:56+0000",
  "merchant": {
    "id": "1273291432",
    "name": "McCafe A7L"
  },
  "items": [
    {
      "id": "MLA111111111",
      "name": "Café + Tostado Lomo y Queso",
      "externalCode": "26805_4cc19d8a12fe4f25bdef2f3eda53ebc0",
      "unit": "UNIT",
      "quantity": 2,
      "fullUnitPrice": {
        "value": 10000,
        "currency": "ARS"
      },
      "unitPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 14000,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 7000,
          "currency": "ARS"
        }
      }
    }
  ],
  "total": {
    "itemsPrice": {
      "value": 14000,
      "currency": "ARS"
    },
    "otherFees": {
      "value": 0,
      "currency": "ARS"
    },
    "discount": {
      "value": 0,
      "currency": "ARS"
    },
    "orderAmount": {
      "value": 14000,
      "currency": "ARS"
    },
    "fullItemsPrice": {
      "value": 20000,
      "currency": "ARS"
    }
  },
  "discounts": [],
  "item_discounts": [
    {
      "type": "item_discount",
      "items": [
        {
          "id": "MLA111111111",
          "amounts": {
            "seller": 4000,
            "meli": 2000,
            "currency": "ARS"
          }
        }
      ]
    }
  ],
  "payments": {
    "prepaid": 14000,
    "pending": 0,
    "methods": [
      {
        "value": 14000,
        "currency": "ARS",
        "type": "PREPAID",
        "method": "DEBIT"
      }
    ]
  },
  "customer": {
    "id": "400412664",
    "name": "xxxxxxxx"
  },
  "delivery": {
    "deliveredBy": "MARKETPLACE",
    "deliveryAddress": {
      "country": "Argentina",
      "state": "Buenos Aires",
      "city": "La Plata",
      "district": "La Plata",
      "street": "xxxx",
      "number": "111",
      "reference": "xxxx",
      "formattedAddress": "xxxx",
      "postalCode": "1900",
      "coordinates": {
        "latitude": -34,
        "longitude": -57
      }
    },
    "estimatedDeliveryDateTime": "2025-06-05T20:57:27+0000",
    "deliveryDateTime": "2025-06-05T20:58:06+0000"
  },
  "extension": {
    "status": "delivered",
    "store": {
      "id": "70032846",
      "externalCode": "70032846",
      "brandId": 10922,
      "brandName": "McCafé"
    },
    "estimatedPickupDate": "2025-06-05T20:47:45+0000",
    "paymentsInfo": [
      {
        "id": 113566231521,
        "entity": "ORDER",
        "entityId": 2000011850006100
      },
      {
        "id": 113566199723,
        "entity": "ORDER",
        "entityId": 2000011850000694
      }
    ]
  }
}
```

### Respuesta - Descuento en Order

```
{
  "id": "44969732488",
  "type": "DELIVERY",
  "displayId": "7809",
  "createdAt": "2025-06-05T20:34:43+0000",
  "orderTiming": "INSTANT",
  "preparationStartDateTime": "2025-06-05T20:34:56+0000",
  "merchant": {
    "id": "1273291432",
    "name": "McCafe A7L"
  },
  "items": [
    {
      "id": "MLA111111111",
      "name": "Café + Tostado Lomo y Queso",
      "externalCode": "26805_4cc19d8a12fe4f25bdef2f3eda53ebc0",
      "unit": "UNIT",
      "quantity": 2,
      "fullUnitPrice": {
        "value": 10000,
        "currency": "ARS"
      },
      "unitPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 0,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 14000,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 7000,
          "currency": "ARS"
        }
      }
    }
  ],
  "total": {
    "itemsPrice": {
      "value": 14000,
      "currency": "ARS"
    },
    "otherFees": {
      "value": 0,
      "currency": "ARS"
    },
    "discount": {
      "value": 5000,
      "currency": "ARS"
    },
    "orderAmount": {
      "value": 9000,
      "currency": "ARS"
    },
    "fullItemsPrice": {
      "value": 20000,
      "currency": "ARS"
    }
  },
  "discounts": [
    {
      "type": "order_discount",
      "amount": {
        "value": 5000,
        "currency": "ARS"
      },
      "target": "CART",
      "sponsorshipValues": [
        {
          "name": "MARKETPLACE",
          "amount": {
            "value": 5000,
            "currency": "ARS"
          }
        }
      ],
      "extension": {
        "id": "115762178479-001",
        "name": "coupon_off"
      }
    }
  ],
  "item_discounts": [
    {
      "type": "item_discount",
      "items": [
        {
          "id": "MLA111111111",
          "amounts": {
            "seller": 4000,
            "meli": 2000,
            "currency": "ARS"
          }
        }
      ]
    }
  ],
  "payments": {
    "prepaid": 9000,
    "pending": 0,
    "methods": [
      {
        "value": 9000,
        "currency": "ARS",
        "type": "PREPAID",
        "method": "DEBIT"
      }
    ]
  },
  "customer": {
    "id": "400412664",
    "name": "xxxxxxxx"
  },
  "delivery": {
    "deliveredBy": "MARKETPLACE",
    "deliveryAddress": {
      "country": "Argentina",
      "state": "Buenos Aires",
      "city": "La Plata",
      "district": "La Plata",
      "street": "xxxx",
      "number": "111",
      "reference": "xxxx",
      "formattedAddress": "xxxx",
      "postalCode": "1900",
      "coordinates": {
        "latitude": -34,
        "longitude": -57
      }
    },
    "estimatedDeliveryDateTime": "2025-06-05T20:57:27+0000",
    "deliveryDateTime": "2025-06-05T20:58:06+0000"
  },
  "extension": {
    "status": "delivered",
    "store": {
      "id": "70032846",
      "externalCode": "70032846",
      "brandId": 10922,
      "brandName": "McCafé"
    },
    "estimatedPickupDate": "2025-06-05T20:47:45+0000",
    "paymentsInfo": [
      {
        "id": 113566231521,
        "entity": "ORDER",
        "entityId": 2000011850006100
      },
      {
        "id": 113566199723,
        "entity": "ORDER",
        "entityId": 2000011850000694
      }
    ]
  }
}
```

### Respuesta - Item con Descuento y Options con precio

```
{
  "id": "44969732488",
  "type": "DELIVERY",
  "displayId": "7809",
  "createdAt": "2025-06-05T20:34:43+0000",
  "orderTiming": "INSTANT",
  "preparationStartDateTime": "2025-06-05T20:34:56+0000",
  "merchant": {
    "id": "1273291432",
    "name": "McCafe A7L"
  },
  "items": [
    {
      "id": "MLA111111111",
      "name": "Café + Tostado Lomo y Queso",
      "externalCode": "26805_4cc19d8a12fe4f25bdef2f3eda53ebc0",
      "unit": "UNIT",
      "quantity": 2,
      "options": [
        {
          "id": "MLA2076110742",
          "name": "Latte Espresso",
          "externalCode": "CHO-26805-42130",
          "unit": "UNIT",
          "quantity": 1,
          "unitPrice": {
            "value": 500,
            "currency": "ARS"
          },
          "totalPrice": {
            "value": 500,
            "currency": "ARS"
          },
          "extension": {
            "group": "Seleccione su Bebida"
          }
        }
      ],
      "fullUnitPrice": {
        "value": 10500,
        "currency": "ARS"
      },
      "unitPrice": {
        "value": 7000,
        "currency": "ARS"
      },
      "optionsPrice": {
        "value": 500,
        "currency": "ARS"
      },
      "totalPrice": {
        "value": 15000,
        "currency": "ARS"
      },
      "extension": {
        "unitNetPrice": {
          "value": 7000,
          "currency": "ARS"
        }
      }
    }
  ],
  "total": {
    "itemsPrice": {
      "value": 15000,
      "currency": "ARS"
    },
    "otherFees": {
      "value": 0,
      "currency": "ARS"
    },
    "discount": {
      "value": 0,
      "currency": "ARS"
    },
    "orderAmount": {
      "value": 15000,
      "currency": "ARS"
    },
    "fullItemsPrice": {
      "value": 22000,
      "currency": "ARS"
    }
  },
  "discounts": [],
  "item_discounts": [
    {
      "type": "item_discount",
      "items": [
        {
          "id": "MLA111111111",
          "amounts": {
            "seller": 4000,
            "meli": 2000,
            "currency": "ARS"
          }
        }
      ]
    }
  ],
  "payments": {
    "prepaid": 15000,
    "pending": 0,
    "methods": [
      {
        "value": 15000,
        "currency": "ARS",
        "type": "PREPAID",
        "method": "DEBIT"
      }
    ]
  },
  "customer": {
    "id": "400412664",
    "name": "xxxxxxxx"
  },
  "delivery": {
    "deliveredBy": "MARKETPLACE",
    "deliveryAddress": {
      "country": "Argentina",
      "state": "Buenos Aires",
      "city": "La Plata",
      "district": "La Plata",
      "street": "xxxx",
      "number": "111",
      "reference": "xxxx",
      "formattedAddress": "xxxx",
      "postalCode": "1900",
      "coordinates": {
        "latitude": -34,
        "longitude": -57
      }
    },
    "estimatedDeliveryDateTime": "2025-06-05T20:57:27+0000",
    "deliveryDateTime": "2025-06-05T20:58:06+0000"
  },
  "extension": {
    "status": "delivered",
    "store": {
      "id": "70032846",
      "externalCode": "70032846",
      "brandId": 10922,
      "brandName": "McCafé"
    },
    "estimatedPickupDate": "2025-06-05T20:47:45+0000",
    "paymentsInfo": [
      {
        "id": 113566231521,
        "entity": "ORDER",
        "entityId": 2000011850006100
      },
      {
        "id": 113566199723,
        "entity": "ORDER",
        "entityId": 2000011850000694
      }
    ]
  }
}
```

## Parámetros de Request

### Path

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **shipment_id**  (obligatorio) | string | Shipment ID del pedido. |

### Header

| Parámetro | Tipo | Descripción |
| --- | --- | --- |
| **x-time-zone**  (obligatorio) | string | Zona horaria de las horas que se muestran en el JSON. Por ejemplo: `GMT-3`. |

## Parámetros de Respuesta

| Campo / Tipo | Valor / Descripción |
| --- | --- |
| **id**  (string) | Shipment ID del pedido. |
| **type**  (string) | Este campo hace referencia a la forma en que se entregará el pedido.  **DELIVERY** : the restaurant will be responsible for delivering the order. **TAKEOUT** : the buyer will pick up the order from the restaurant. |
| **displayId**  (string) | ID de pedido que se muestra en la interfaz de la aplicación de pedidos para el comprador. |
| **createdAt**  (string) | Hora de creación del pedido. |
| **orderTiming**  (string) | Hora prevista para empezar a preparar un pedido. Por ahora, solo se implementa el inicio inmediato, y el valor de este campo siempre será **INSTANT** . |
| **preparationStartDateTime**  (string) | Valor referente al inicio de preparación de un pedido. Por ahora, el valor contenido en este campo será el momento en que el pedido cambió su estado a `ready_to_ship/ready_to_print`. |
| **merchant**  (object) | Informaciones sobre el seller.  **id**  (string): ID de usuario de la cuenta del restaurante vinculado a Mercado Pago. **name**  (string): Nombre del restaurante. |
| **items**  (Array) | Array de objetos que contienen la información del ítem para un pedido.  **id**  (string): ID del Item. **name**  (string): Nombre del item. **externalCode**  (string): Código externo de un artículo que puede ser utilizado por punto de venta. **unit**  (string): Unidad de medida del ítem. Por ahora, solo el valor **UNIT**  está disponible. **quantity**  (number): La cantidad del ítem. **specialInstructions**  (string): Comentario sobre el ítem pedido insertado por el comprador. **options**  (Array): Campo referente a los complementos de un ítem. Si el ítem pedido no tiene complementos, este campo estará vacío.  **id**  (string): ID del Item del complemento. **name**  (string): Nombre del Item del complemento. **externalCode**  (string): Código externo del ítem de complemento que puede ser utilizado por un punto de venta. **unit**  (string): Unidad de medida del ítem del complemento. Por ahora, solo el valor **UNIT**  está disponible. **quantity**  (number): La cantidad del ítem complementario. **unitPrice**  (object): Precio unitario de un ítem de complemento.  **value**  (number): Precio unitario de un ítem de complemento. **currency**  (string): Moneda relacionada con el precio.   **totalPrice**  (object): El precio total de un item de complemento.  **value**  (number): El precio total de un artículo de complemento (`unitPrice * quantity`). **currency**  (string): Moneda relacionada con el precio.   **extension**  (object): Extensiones.  **group** : Nombre del grupo al que pertenece el complemento seleccionado.     **unitPrice**  (object): Precio unitario del ítem seleccionado.  **value**  (number): Precio unitario del ítem seleccionado. **currency**  (string): Moneda relacionada con el precio.   **fullUnitPrice**  (object): Precio unitario de lista sin descuentos (no incluye options). Útil para calcular el "sin descuentos".  **value**  (number): Precio unitario del item sin descuento. **currency**  (string): Moneda relacionada con el precio.   **optionsPrice**  (object): Suma de los precios de los complementos de un ítem.  **value**  (number): Suma de los precios de los complementos de un ítem. **currency**  (string): Moneda relacionada con el precio.   **totalPrice**  (object): Precio total de un item, considerando su cantidad y complementos.  **value**  (number): Precio total de un item, considerando su cantidad y complementos ((`unitPrice + optionsPrice`) × `quantity`). **currency**  (string): Moneda relacionada con el precio.   **extension**  (object): Additional information about the item.  **unitNetPrice**  (object): En caso de que el producto tenga descuento, este campo mostrará la información del valor del producto con el descuento aplicado.  **value**  (number): Valor del producto con descuento. **currency**  (string): Moneda relacionada con el precio. |
| **item_discounts**  (Array) | Descuentos por Items agregados. Desglosados por sponsor (total por ítem).  **type**  (string): Identifica el tipo de descuento. **items**  (Array): Ítems alcanzados por el descuento.  **id**  (string): Id del item alcanzado. **amounts**  (object): Total por sponsor para el item (suma todas sus lineas).  **seller**  (number): Descuento total financiado por el Seller. **meli**  (number): Descuento total financiado por Mercado Libre. **currency**  (string): Moneda relacionada con el precio. |
| **discounts**  (Array) | Información sobre los descuentos de cupón aplicados al carrito.  **type**  (string): Identifica el tipo de descuento. Valor posible: **order_discount** . **amount**  (object): Monto total del cupón aplicado.  **value**  (number): Valor del descuento. **currency**  (string): Moneda relacionada con el precio.   **target**  (string): Dónde se aplica el descuento. Valor posible: **CART** .  **CART** : El descuento se aplica sobre el carrito.   **sponsorshipValues**  (Array): Indica quién patrocinó el descuento. Contiene un único elemento.  **name**  (string): Quién patrocinó el descuento.  **MARKETPLACE** : El Marketplace patrocina el descuento. **MERCHANT** : El Merchant patrocina el descuento.   **amount**  (object):  **value**  (number): Valor del descuento. **currency**  (string): Moneda relacionada con el precio.     **extension**  (object): Información del cupón de descuento.  **id**  (string): Id del cupón. **name**  (string): Nombre del cupón. |
| **otherFees**  (Array) | Array de objetos con montos de tarifas cobradas por el pedido.  **name**  (string): Nombre de la tarifa. **type**  (string): Campo que especifica el tipo de tarifa.  **DELIVERY_FEE** : fee charged for shipping the product. **SERVICE_FEE** : fee for the using of Marketplace. **TIP** : Value of the tip.   **receivedBy**  (string): Campo que especifica quién recibirá el monto de la tarifa.  **MERCHANT** : the fee amount that will be received by the merchant. **MARKETPLACE** : the fee amount that will be received by the marketplace. **LOGISTIC_SERVICES** : the fee amount that will be received by the Service of Logistic.   **receiverDocument**  (string): Documento del receptor del importe de la tarifa. **price**  (object):  **value**  (number): Precio de la tarifa. **currency**  (string): Moneda relacionada con el precio. |
| **total**  (object) | Objeto que contiene información sobre todos los montos cobrados.  **itemsPrice**  (object): Precio total de los artículos seleccionados.  **value**  (number): Precio total de los artículos seleccionados. **currency**  (string): Moneda relacionada con el precio.      Nota:    `**itemsPrice**` representa el monto sumarizado de todos los items, sin el descuento MELI.      **fullItemsPrice**  (object): Monto TOTAL sin descuentos = ((`fullUnitPrice + optionsPrice`) × `quantity`).  **value**  (number): Monto total sin descuentos. **currency**  (string): Moneda relacionada con el precio.   **otherFees**  (object): Suma de todas las tarifas.  **value**  (number): Suma de todas las tarifas. **currency**  (string): Moneda relacionada con el valor.   **discount**  (object): Suma de todos los descuentos.  **value**  (number): Suma de todos los descuentos. **currency**  (string): Moneda relacionada con el valor.   **orderAmount**  (object): Valor total pagado en el pedido. **ItemsPrice - discount**  (si solo hay cupón).  **value**  (number): Valor total pagado en el pedido (`itemsPrice + otherFees - discounts`). **currency**  (string): Moneda relacionada con el valor pagado. |
| **payments**  (object) | Información de los medios de pago.  **prepaid**  (number): Cantidad que ya ha sido pagada. **pending**  (number): Importe cuyo pago aún está pendiente. **methods**  (Array): Métodos de pago utilizados.  **value**  (number): Valor pagado. **currency**  (string): Moneda relacionada con el pago. **type**  (string): Hora en que se efectuó o se realizará el pago. Por ahora, el único valor posible es **PREPAID** . **method**  (string): Método utilizado para el pago.  **DIGITAL_WALLET** : amount paid using the Digital Wallet of Mercado Pago. |
| **customer**  (object) | Información sobre el comprador.  **id**  (string): ID de usuario del comprador. **name**  (string): Nombre del comprador. |
| **delivery**  (object) | Información sobre el lugar donde se debe entregar el pedido.  **deliveredBy**  (string): Responsable de la entrega de pedidos.  **MERCHANT** : The restaurant is responsible for the order delivery. **MARKETPLACE** : Mercado Pago is responsible for the order delivery.   **deliveryAddress**  (object): Dirección de delivery.  **country**  (string): Nombre del país. **state**  (string): Nombre del estado. **city**  (string): Nombre de la ciudad. **street**  (string): Nombre de la calle. **number**  (string): Número del lugar de entrega. Si no hay número, el valor será **SN** . **complement**  (string): Información adicional sobre el lugar de entrega. **reference**  (string): Referencias sobre el lugar de entrega. **formattedAddress**  (string): Concatenación de nombre y número de calle. **postalCode**  (string): Código postal del lugar de entrega. **coordinates**  (object): Coordenadas del lugar de entrega.  **latitude**  (number): Latitud del lugar de entrega. **longitude**  (number): Longitud del lugar de entrega.     **estimatedDeliveryDateTime**  (string): Tiempo de entrega estimado. **deliveryDateTime**  (string): Hora de finalización de la entrega. Esta información se configurará una vez entregado el pedido. |
| **extension**  (object) | Información adicional del pedido.  **status**  (string): Estado de un pedido.  **ready_to_ship** : order created. **shipped** : order sent for delivery. **not_delivered** : order not delivered. **delivered** : order delivered. **cancelled** : order cancelled.   **substatus**  (string): Subestado de un pedido, junto con el estado definen el estado actual de un pedido.  **ready_to_print** : order awaiting acceptance. **printed** : order accepted. **out_for_delivery** : order went out for delivery. **delivery_failed** : delivery not completed.   **store**  (object): Datos de la tienda.  **id**  (string): ID interno de la tienda que utiliza Mercado Pago. **externalCode**  (string): Un campo opcional que hace referencia a un código externo que se puede utilizar en un punto de venta. **brandId**  (number): Valor referente al Brand ID que está vinculado a la tienda. **brandName**  (string): Nombre de la marca que está vinculada a la tienda.   **qr**  (object): Datos del QR.  **id**  (string): ID del pedido. **sender_id**  (number): ID del seller. **hash_code**  (string): Hash code. **security_digit**  (string): Código de información de seguridad.   **cancellationDateTime**  (string): Fecha/hora de cancelación (aparece cuando status = 'cancelled'). **estimatedPickupDate**  (string): Tiempo estimado que el repartidor llegará al restaurante para tomar el pedido. **paymentsInfo**  (Array): Array de ids de pagos. Cada ítem del pedido tiene su propio `payment_id`.  **id**  (string): ID del pago. **entity**  (string):  **ORDER** : Payment of an item of the order. **SHIPMENT** : Payment for the shipping cost.   **entityId**  (string): ID referente a la entidad. |

## Errores

| Código de Error | Descripción |
| --- | --- |
| **401**  Unauthorized | Access Token inválido. |
| **403**  Forbidden | El usuario no puede acceder a este recurso. |
| **404**  Not Found | No se pudo encontrar el envío. |
| **424**  Not Found | No se pudo obtener alguna información de la orden. |
| **500**  Internal Server Error | Error interno del servidor. |

**Siguiente** : [Aceptar pedido.](https://developers.mercadolibre.com.ar/es_ar/proximity-aceptar-pedidos)
