<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/bonificaciones-para-product-ads -->
<!-- Sección: Guía para Mercado Ads -->

# Bonificaciones para Product Ads

Última actualización 08/01/2026

## Bonificaciones para Product Ads

Esta iniciativa permite que los vendedores accedan a la información relacionada con las bonificaciones de Product Ads disponibles para su cuenta o campañas, con el objetivo de ofrecer mayor visibilidad, trazabilidad y capacidad analítica sobre los incentivos otorgados a cada vendedor.

## Tipos de bonificaciones

El programa de Bonificaciones de Product Ads contempla diferentes tipos de beneficios destinados a incentivar la adopción y el uso estratégico de las soluciones publicitarias dentro del ecosistema de Mercado Libre.

Estos beneficios se aplican de acuerdo con criterios específicos, como nivel de reputación, volumen de inversión, certificaciones, participación en programas de incentivo o acciones comerciales puntuales. Cada tipo de bonificación posee condiciones y reglas propias de elegibilidad.

A continuación, se detallan los principales tipos de beneficios actualmente vigentes en el programa:

- **CERTIFICACIÓN:**  Beneficio otorgado a los usuarios que se certifican en Ads Academy (Product Ads) y poseen contrato activo de Product Ads. El valor definido para el beneficio de certificación depende del sitio.

- **SELLER STARTUP PROGRAM:**  Beneficio destinado a apoyar a nuevos vendedores que forman parte del programa de despegue y contratan Product Ads.

- **SMART BENEFITS:**  Beneficio otorgado a usuarios que crean una campaña durante una temporada específica de publicidad y que sean público objetivo de la bonificación.

- **MANUAL:**  Beneficio otorgado por el equipo de negocios.

## Consultar bonificación

Este endpoint permite consultar las bonificaciones activas o inactivas asociadas a un anunciante específico. A través de esta llamada, es posible obtener información detallada sobre los beneficios aplicados a **nivel de cuenta**  y de **campaña de Product Ads** , incluyendo el valor otorgado, el saldo restante, el período de vigencia y el estado de la campaña vinculada (cuando corresponda).

Llamada:

```
curl -L -X GET 'https://api.mercadolibre.com/advertising/advertisers/bonifications' \
-H 'Authorization: Bearer $ACCESS_TOKEN'
```

Ejemplo de respuesta bonificación **nivel campaña** :

```
{
  "bonification": [
    {
      "status": "ACTIVE",
      "creation_date": "2025-09-30T20:00:14Z",
      "end_date": "2025-10-10T16:00:04Z",
      "campaign_name": "Liquida 10.10",
      "currency_id": "BRL",
      "level": "Campaign",
      "amount": 10000,
      "balance": 10000,
      "days_remaining": 1,
      "campaign_id": 354548091,
      "campaign_status": "deleted",
      "benefit_name": "smart_benefit"
    }
  ]
}
```

Ejemplo de respuesta bonificación **nivel cuenta** :

```
{
    "bonification": [
        {
            "status": "ACTIVE",
            "creation_date": "2025-10-30T04:00:00Z",
            "end_date": "2025-12-31T04:00:00Z",
            "currency_id": "BRL",
            "level": "Account",
            "amount": 10,
            "balance": 10,
            "days_remaining": 54,
            "campaign_id": 0,
            "benefit_name": "manual"
        }
    ]
}
```

### Campos de respuesta

| Campo | Valores posibles | Descripción |
| --- | --- | --- |
| status | ACTIVE | Estado actual de la bonificación |
| creation_date |  | Fecha de creación de la bonificación |
| end_date |  | Fecha de finalización de la bonificación |
| campaign_name |  | Nombre de la campaña asociada a la bonificación. **Visible solo cuando el beneficio fue otorgado a nivel de campaña** . |
| currency_id | ARS BRL MXN UYU COP PEN USD CLP | Identificador de la moneda utilizada en la bonificación |
| level | Campaign Account | Define si fue asignada por campaña o por cuenta |
| amount |  | Valor total de la bonificación |
| balance |  | Saldo actual de la bonificación |
| campaign_id |  | Identificador único de la campaña asociada |
| campaign_status | Active Paused Finished Deleted | Estado actual de la campaña asociada. **Visible solo cuando el beneficio fue otorgado a nivel de campaña** . |
| benefit_name | Certification Seller-startup-program Smart-benefit Manual | Tipo de bonificación |

## Respuesta cuando no hay bonificaciones

Para el vendedor que no posee bonificaciones activas o históricas, la respuesta será un **200 - OK**  con el array **bonification**  vacío.

```
{
  "bonification": []
}
```

## Posibles errores al consultar bonificaciones

Access token inválido o expirado:

```
{
    "status": 401,
    "error_code": "unauthorized",
    "display_message": "invalid access token"
}
```
