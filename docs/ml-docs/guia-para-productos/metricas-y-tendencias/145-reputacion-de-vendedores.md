<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/reputacion-de-vendedores -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Reputación de vendedores

Última actualización 11/08/2025

## Reputación de vendedores

La reputación de un vendedor en Mercado Libre es la imagen tiene dentro de la plataforma para que los compradores y vendedores generen confianza al momento de transaccionar con él. Es importante cuidarla, para poder potenciarse dentro del sitio. Conoce [Qué es y cómo funciona la reputación como vendedor](https://www.mercadolibre.com.ar/ayuda/Como-funciona-la-reputacion-de-vendedor_866).

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/128885
```

Respuesta:

```
"seller_reputation": {
        "level_id": "5_green",
        "power_seller_status": "platinum",
        "real_level": "red",
        "protection_end_date": "2019-12-27T00:00:00.000-04:00",
        "transactions": {
            "canceled": 981,
            "completed": 6211,
            "period": "historic",
            "ratings": {
                "negative": 0.04,
                "neutral": 0.08,
                "positive": 0.88
            },
            "total": 7192
        },
        "metrics": {
            "sales": {
                "period": "60 days",
                "completed": 244
            },
            "claims": {
                "period": "60 days",
                "rate": 0,
                "value": 0,
                "excluded": { 
                    "real_value": 24, 
                    "real_rate": 0.0912 
                }
            },
            "delayed_handling_time": {
                "period": "60 days",
                "rate": 0,
                "value": 0,
                "excluded": { 
                    "real_value": 47, 
                    "real_rate": 0.723 
                }
            },
            "cancellations": {
                "period": "60 days",
                "rate": 0,
                "value": 0,
                "excluded": { 
                    "real_value": 6, 
                    "real_rate": 0.0228 
                }
            }
        }
    },
```

Nota:

Recuerda que si eres un vendedor protegido, verás los datos reales dentro del campo excluded.

### Campos de la respuesta

- **level_id:**  nivel de reputación del usuario, descrita en numeración y color del termometro.

- **power_seller_status:**  este campo indica si el vendedor es Mercado Lider, y el nombre de la medalla recibida, puede ser Silver, Gold o Platinum.

- **real_level** : nivel real de reputación del vendedor, durante el período de protección (aparece solo cuando el vendedor está protegido).

- **protection_end_date** : fecha de fin de la protección (solo cuando el vendedor está protegido).

- **transactions:**  cantidad de ventas realizadas por el usuario en un determinado periodo.

- **canceled** : cantidad de operaciones canceladas.  **completed** : cantidad de transacciones completadas.  **period** : período tenido en cuenta.  **ratings** : ratio de ventas calificadas en negativas, neutras, o positivas.  **total** : total de transacciones.

## Métricas de calidad

- **sales:**  la cantidad de **ventas**  que tiene el vendedor.  **period** : el período considerado para calcular el ratio dependerá de la cantidad de ventas concretadas que haya realizado en los últimos 60 días. **completed** : cantidad de ventas completadas. Se cuenta si la orden tiene o no reclamos, por lo que si una orden posee más de un reclamo / disputa, para que la misma no sea contabilizada todos los reclamos / disputas deben ser excluidos de la reputación (tag avoid_reputation).

Dependiendo del país y la cantidad de ventas es el período a evaluar:

**México (MLM)**

| Transacciones en los últimos 60 días | Período a evaluar para la reputación |
| --- | --- |
| **Para MLM > o = a 40 ventas** | Se tiene en cuenta los últimos 60 días. |
| **Para MLM < a 40 ventas** | Se tiene en cuenta todo el historial de ventas en los últimos 365 días. |

**Brasil (MLB)**

| Transacciones en los últimos 60 días | Período a evaluar para la reputación |
| --- | --- |
| **Para MLB > o = a 60 ventas** | Se tiene en cuenta los últimos 60 días. |
| **Para MLB < a 60 ventas** | Se tiene en cuenta todo el historial de ventas de los últimos 365 días. |

**Argentina (MLA)**

| Transacciones en los últimos 60 días | Período a evaluar para la reputación |
| --- | --- |
| **Para MLA > o = a 50 ventas** | Se tiene en cuenta los últimos 60 días. |
| **Para MLA < a 50 ventas** | Se tiene en cuenta todo el historial de ventas de los últimos 365 días. |

**Colombia (MCO)**

| Transacciones en los últimos 60 días | Período a evaluar para la reputación |
| --- | --- |
| **Para MCO > o = a 60 ventas** | Se tiene en cuenta los últimos 60 días. |
| **Para MCO < a 60 ventas** | Se tiene en cuenta todo el historial de ventas de los últimos 365 días. |

**Chile (MLC)**

| Transacciones en los últimos 60 días | Período a evaluar para la reputación |
| --- | --- |
| **Para MLC > o = a 40 ventas** | Se tiene en cuenta los últimos 60 días. |
| **Para MLC < a 40 ventas** | Se tiene en cuenta todo el historial de ventas de los últimos 365 días. |

**Uruguay (MLU)**

| Transacciones concretadas en los últimos 120 ddías | Período a evaluar para la reputación |
| --- | --- |
| **Para MLU > o = a 25 ventas** | Se tiene en cuenta los últimos 120 días. |
| **Para MLU < a 25 ventas** | Se tiene en cuenta todo el historial de ventas últimos 365 días. |

**Ecuador (MEC)**

| Transacciones en los últimos 120 días | Período a evaluar para la reputación |
| --- | --- |
| **Para MEC > o = a 20 ventas** | Se tiene en cuenta los últimos 120 días. |
| **Para MEC < a 20 ventas** | Se tiene en cuenta todo el historial de ventas en los últimos 365 días. |

**Perú (MPE)**

| Transacciones en los últimos 120 días | Período a evaluar para la reputación |
| --- | --- |
| **Para MPE > o = a 20 ventas** | Se tiene en cuenta los últimos 120 días. |
| **Para MPE < a 20 ventas** | Se tiene en cuenta todo el historial de ventas en los últimos 365 días. |

Para Venezuela el sistema de reputación es el antiguo, para conocer más información al respecto accede a los siguientes links de ayuda:

- [Venezuela](https://www.mercadolibre.com.ve/ayuda/Como-funciona-la-reputacion-vendedor_1621)

Notas:

- Las ventas concretadas se calculan sobre el total ventas menos ventas canceladas por el vendedor o comprador.
- Con "venta no concretada" hacemos referencia a órdenes con fulfilled = false.
- Los valores elegidos fueron los valores de entrada al programa de Mercado Líderes correspondiente a cada país.
- Ventas totales se refiere a la cantidad de operaciones del vendedor en el período considerado, sin distinguir modalidad de pago ni envío. No consideramos ventas de usuarios que fueron inhabilitados, ventas de usuarios fraudulentos, ventas con todos sus pagos rechazados ni ventas inválidas.

Excepciones:

Ciertas mediaciones son automáticamente ignoradas cuando cumplen reglas específicas. Para casos excepcionales un proceso se aplicará un proceso vía contacto con CX.

## Reclamos (Claims)

Para realizar el cálculo se tendrá en cuenta las ventas con reclamos iniciados por el comprador sin distinguir la modalidad de envío o pago. Es decir, no consideramos ventas de usuarios que fueron inhabilitados, ventas de usuarios fraudulentos, ventas con pagos rechazados ni ventas inválidas.

Fórmula

**claims_rate = ventas con reclamos / ventas totales**

Notas:

- Los vendedores necesitan tener más de 10 ventas en su historial.

Una vez sabido el período que se tomará para calcular la cantidad de ventas que realizó el vendedor, se determinará el color del termómetro según el porcentaje que tenga el vendedor.
Ejemplo de termómetro de la misma forma que lo visualizará el vendedor en la cuenta:

## Tiempo de entrega con retraso (Handling Time)

El Handling Time es la diferencia entre el momento que está listo para enviar (ready_to_ship) y cuando realmente el correo indica que lo colectó (shipped). Excepto para tipos de envíos Cross Docking, donde el Handling Time es la diferencia entre el momento en el que el paquete está en el HUB (in_hub) y cuando realmente el correo indica que lo colectó (shipped) El delayed handling time es el porcentaje de ventas con envíos tardíos.

- Solo contemplaremos aquellos vendedores que utilicen Mercado Envíos y tengan 10 o más ventas enviadas. El resto no se verá afectado por esta métrica y asumimos que sus ventas entregadas fuera de término es de 0%. El tiempo que tomamos para medir esto son los últimos 60 días en caso de que el vendedor tenga más de 50 ventas en MLA, 60 ventas en MLB, 40 ventas en MLC, 60 ventas en MCO y 40 ventas en MLM realizadas en ese período y serán los últimos 365 si no llegan a esta cantidad de ventas en sus países.

Fórmula: **delayed handling time rate = ventas con despacho tardío / ventas despachadas con me2**

Período considerado: 60 o 365 dias, dependiendo la cantidad de transacciones en los últimos 60 días. Para MLU consideramos 120 o 365 días. 
Para el caso en el que el carrito tenga varios pedidos con el mismo envío, si se despacha tarde, afecta tantas veces al vendedor como pedidos tenga el paquete.

- 

También puedes [utilizar el recurso /schedule](https://developers.mercadolibre.com.ar/es_ar/horario-de-despacho-por-logistica) para obtener los horarios de despacho y evitar retrasos.

## Cancelaciones (Cancellations)

Esta métrica nos muestra la cantidad de cancelaciones que hace el vendedor en donde no hay un reclamo de por medio. 
 Es un recurso conocido por los Mercado Lideres, que ahora va a aplicar para todos los vendedores. 
 La fórmula que se utiliza para calcularla: 
 **Cancellations rate = cancelaciones que hace el vendedor / ventas totales**  
 Aplica a todos los sites donde está vigente el nuevo sistema de reputación: **MLA** , **MLB** , **MLM** , **MCO** , **MLC** , **MLU** , **MPE** , **MEC** .

## Límites para cada variable

Modificamos los límites para cada variable en todos los colores, niveles y sites. Los nuevos límites son los siguientes:

**MLB**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 1% | 2% | 4,5% | 8% | > 8% |
| Cancellations | 0,5% | 1,5% | 3,5% | 4% | > 4% |
| delayed handling time | 6% | 10% | 18% | 22% | > 22% |

**MLA**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 1% | 1,5% | 3% | 6% | > 6% |
| Cancellations | 0,5% | 1% | 2,5% | 3% | > 3% |
| delayed handling time | 8% | 10% | 15% | 22% | > 22% |

**MLM**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 1% | 1,5% | 3% | 6% | > 6% |
| Cancellations | 0,5% | 1% | 2,5% | 3% | > 3% |
| delayed handling time | 8% | 10% | 15% | 22% | > 22% |

**MCO**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 2,5% | 3,5% | 5,5% | 7% | > 7% |
| Cancellations | 1,5% | 2,5% | 7% | 9% | > 9% |
| delayed handling time | 10% | 12% | 18% | 26% | > 26% |

**MLU**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 2,5% | 3,5% | 5,5% | 7% | > 7% |
| Cancellations | 1,5% | 2,5% | 7% | 9% | > 9% |
| delayed handling time | 10% | 12% | 18% | 26% | > 26% |

**MLC**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 2,5% | 3,5% | 5,5% | 7% | > 7% |
| Cancellations | 1,5% | 2,5% | 7% | 9% | > 9% |
| delayed handling time | 10% | 12% | 18% | 26% | > 26% |

**MEC**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 4% | 4,0% | 6% | 8% | > 8% |
| Cancellations | 3% | 3% | 8% | 11% | > 11% |
| delayed handling time | 12% | 12% | 20% | 30% | > 30% |

**MPE**

| Variables | Líderes | Green | Yellow | Orange | Red |
| --- | --- | --- | --- | --- | --- |
| Claim | 2% | 2% | 4,5% | 8% | > 8% |
| Cancellations | 2,5% | 2,5% | 7% | 9% | > 9% |
| delayed handling time | 12% | 12% | 18% | 26% | > 26% |
