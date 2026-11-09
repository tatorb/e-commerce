<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/recuperacion-reputacion -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Programa de Despegue y Beneficio de Reputación

Última actualización 04/02/2025

## Programa de Despegue y Beneficio de Reputación

Importante:

Disponible en Argentina (MLA), Brasil (MLB), México (MLM), Chile (MLC) y Colombia (MCO) para vendedores sin reputación o color rojo, amarillo o naranja.

Esta iniciativa permite a los vendedores sin reputación o con reputación rojo, naranja, o amarillo tener una oportunidad durante un periodo de tiempo en el cual su nivel permanecerá congelado en verde por reglas establecidas de tal manera que pueda aumentar su exposición y sus ventas. El vendedor podrá dejar una cantidad de dinero en garantía y teniendo en cuenta la cantidad de problemas (reclamos, cancelaciones, demoras) generados se le regresa una parte o el total del dinero.

- **Programa de Despegue**  (NEWBIE_GRNTEE): para vendedores con reputación sin color (level_id: null). Adicional acceden a beneficios de Mercado Libre Ads, Clips y tendrán más posibilidad de ganar en Catálogo. Términos y Condiciones: [Argentina (MLA)](https://www.mercadolibre.com.ar/ayuda/terminos-y-condiciones-programa-despegue_33285), [Brasil (MLB)](https://www.mercadolivre.com.br/ajuda/termos-e-condi%C3%A7%C3%B5es-programa-decola_33285), [México (MLM)](https://www.mercadolibre.com.mx/ayuda/terminos-y-condiciones-programa-despegue_33285), [Chile (MLC)](https://www.mercadolibre.cl/ayuda/terminos-y-condiciones-programa-despegue_33285) e [Colombia (MCO)](https://www.mercadolibre.com.co/ayuda/33285).

- **Beneficio de Reputación/Seller Recovery**  (RECOVERY_GRNTEE): aplica a vendedores con reputación rojo, naranja o amarillo (leve_id: 1_red, 2_orange o 3_yellow). Términos y Condiciones: [Argentina (MLA)](https://www.mercadolibre.com.ar/ayuda/terminos-y-condiciones-beneficio-de-reputacion_29528), [Brasil (MLB)](https://www.mercadolivre.com.br/ajuda/termos-e-condicoes-reputacao-vantagens_29528), [México (MLM)](https://www.mercadolibre.com.mx/ayuda/terminos-y-condiciones-beneficio-de-reputacion_29528), [Chile (MLC)](https://www.mercadolibre.cl/ayuda/terminos-y-condiciones-beneficio-de-reputacion_29528) e [Colombia (MCO)](https://www.mercadolibre.com.co/ayuda/terminos-y-condiciones-beneficio-de-reputacion_29528).

- 

## Flujo técnico

## Notificaciones

Actualmente, los vendedores son notificados por email, notificaciones y novedades en Mercado Libre. Utiliza la [api de novedades](https://developers.mercadolibre.com.ar/es_ar/conoce-las-novedades-que-reciben-los-vendedores#Obtener-novedades) (**/communications/notices** ) para que los vendedores estén avisados mediante tu integración apenas sean invitados a participar. Próximamente, habilitaremos un nuevo tópico de notificaciones.

## Consultar reputación

Primero, te recomendamos [consultar la reputación del vendedor](https://developers.mercadolibre.com.ar/es_ar/reputacion-de-vendedores?nocache=true) para garantizar que aplique en algún programa. Si el vendedor tiene reputación sin color, rojo, naranja o amarillo, utiliza los siguientes endpoints. 
Los vendedores con reputación verde (id: 4_light_green o 5_green) están excluidos de participar.

Llamada:

```
curl -X GET -H 'Authorization: Bearer Token' https://api.mercadolibre.com/users/$USER_ID
```

Respuesta:

```
{
  "id": 123456,
  ...
  "seller_reputation": {
      "level_id": null,
      "power_seller_status": null,
      "transactions": {
          ...
          },
          "total": 8
      }
  ...
}
```

Nota:

Es posible que un usuario cumpla con el requisito del nivel de reputación pero aún no haya sido invitado a participar de la protección debido a reglas internas de seguridad.

## Conocer detalle del Programa

El vendedor habilitado para participar de un programa puede obtener información detallada sobre la protección, garantía, límites, y dinero disponible en Mercado Ads.

Nota:

El rate limit es de 100 RPM por vendedor (user_id).

Llamada:

```
curl -X GET -H 'Authorization: Bearer Token' https://api.mercadolibre.com/users/reputation/seller_recovery/status
```

Respuesta:

```
{
    "seller_id": 1234567,
    "current_level": "newbie",
    "status": "AVAILABLE",
    "type": "NEWBIE_GRNTEE",
    "site_id": "MLA",
    "protection_limits": {
        "max_issues_allowed": 5,
        "protection_days_limit": 365
    },
    "guarantee_limits": {
        "guarantee_price": "$45.000",
        "advertising_amount": 45000
    },
    "guarantee_detail": {
        "guarantee_status": "OFF"
    },
    "is_renewal": false
}
```

### Campos de respuesta

**seller_id** : ID del vendedor.

**status** : Estado actual de la protección. Valores posibles:

- **AVAILABLE** : protección habilitada.

- **ACTIVE** : protección activada.

- **UNAVAILABLE** : protección no disponible.

- **FINISHED_BY_DATE** : protección finalizada por fecha.

- **FINISHED_BY_ISSUES** : protección finalizada por problemas.

- **FINISHED_BY_LEVEL** : protección finalizada por color recuperado.

- **FINISHED_BY_USER** : protección cancelada por el vendedor.

- **FINISHED** : protección finalizada por diversas razones.

**type** : tipo de protección: Programa de Despegue (NEWBIE_GRNTEE) o Programa Seller Recovery (RECOVERY_GRNTEE).
 **site_id** : país.

**protection_limits** : límites de protección.

- **max_issues_allowed** : cantidad máxima de problemas permitidos.

- **protection_days_limit** : duración (días) de protección.

**guarantee_limits** : límites de garantía.

- **guarantee_price** : valor de la garantía.

- **advertising_amount** : valor de bonificación en Mercado Ads. Aplica solo para programa de Despegue (NEWBIE_GRNTEE).

**protection_detail** : detalles sobre la protección actual.

- **warning** : alerta sobre finalización de protección.

- **reactivated** : indica si la protección fue reactivada.

- **init_date** : fecha de inicio de la protección.

- **end_date** : fecha de finalización de la protección.

- **protection_days** : días de protección vigentes.

- **start_level** : color del vendedor al iniciar la protección.

- **end_level** : color del vendedor al terminar la protección.

**sales_detail** : detalles de ventas durante la protección.

- **orders_qty** : cantidad de órdenes vendidas.

- **total_issues** : problemas del vendedor.

- **claims_qty** : cantidad de reclamos.

- **cancel_qty** : cantidad de cancelaciones.

- **delay_qty** : cantidad de envíos demorados.

**guarantee_detail** : detalles sobre la garantía.

- **guarantee_status** : estado de la garantía.

- **guarantee_end_date** : fecha de finalización de la garantía.

- **guarantee_buffer** : duración del buffer para evaluar la garantía.

- **guarantee_release_amount** : dinero en reserva de garantía.

- **guarantee_charge_amount** : dinero del cargo de garantía.

## Activar programa

Antes de activar el programa, el vendedor debe ingresar en su cuenta de Mercado Pago el monto de dinero informado previamente o reservar dicho monto si ya tuviera dinero en cuenta. En caso de no tener el dinero disponible, al activar el programa recibirá error. Una vez que el vendedor activa el programa (opt-in), inicia el periodo de protección.

Llamada:

```
curl -X POST -H 'Authorization: Bearer Token' -H 'Content-Type: application/json'
https://api.mercadolibre.com/users/reputation/seller_recovery/activate
```

Respuesta:

```
{
  "message": "ok"
}
```

## Desactivar programa

En cualquier momento el vendedor podrá solicitar su cancelación y enviar el siguiente parámetro opbligatorio: **cancellation_reason** : motivo de la cancelación del programa (obligatorio para Startup Programa, en Recovery Color no se requiere). Posibles valores:

- **business_not_ready** : mi negocio no está preparado.

- **program_not_useful** : el programa no me sirvió.

- **need_money** : necesito el dinero.

- **goal_achieved** : ya logré mi objetivo.

- **without_reason** : sin razón.

Ejemplo:

```
curl -X PUT -H 'Authorization: Bearer Token' -H 'Content-Type: application/json'-D 
{
    "cancellation_reason" : "goal_achieved"
}
https://api.mercadolibre.com/users/reputation/seller_recovery/cancel_guarantee
```

Respuesta:

```
{
   "message": "ok"
}
```

## Descargar domiciliación legal

Importante:

Aplica obligatoriamente para México y Colombia.

Aquellos integradores con usuarios (vendedores) de México y Colombia están obligados legalmente a mostrar a los vendedores de estos países la descarga de domiciliación legal, que podrá ser una versión preliminar y completa.

### Parámetro obligatorio

**type** : es el tipo de domiciliación legal que puedes descargar. Valores posibles:

- **preview** : solo es posible llamar en modo preview si la protección está en estado AVAILABLE y la garantia esta en estado OFF.

- **complete** : una vez el seller ha activado la protección del programa (sea Despegue o Recovery) puede descargar el documento completo. Solamente se puede descargar si la protección está en estado ACTIVE o FINISHED_BY_*.

Llamada:

```
curl -X GET -H 'Authorization: Bearer Token' https://api.mercadolibre.com/users/reputation/seller_recovery/legal-document?type=(PREVIEW|COMPLETE)
```

Respuesta:

```
{
    "document": "JVBERi0xLjQKJfbk/N8KMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovVmVyc2lvbiAvMS41Ci9QYWdlcyAyIDAgUgovTmFtZXMgMyAwIFIKPj4KZW5kb2JqCjQgMCBvYmoKPDwKL01vZERhdGUgKEQ6MjAyNDA5MTkxN"
}
```

Por seguridad, la respuesta será un tipo de dato codificado en base64, el cual puedes desencodear mediante un script en python y obtener el pdf.
 Ejemplo:

```
import base64

# The base64 string you provided
base64_data = ""  

# Add the proper padding if necessary
base64_data = base64_data.rstrip('=')  # Remove any previous padding, if there is any
padding_needed = len(base64_data) % 4
if padding_needed:
    base64_data += '=' * (4 - padding_needed)

# Decode the base64 string
pdf_data = base64.b64decode(base64_data)

# Save the binary data as a PDF file
with open('output.pdf', 'wb') as pdf_file:
    pdf_file.write(pdf_data)

print("PDF saved as output.pdf")
```

Para **activar estos programas en usuarios test** , envíanos por medio de Soporte 2 usuarios test con reputación null (sin color) y activaremos un programa en cada uno de ellos.

**Siguiente** : [Reputación de vendedores](https://developers.mercadolibre.com.ar/es_ar/reputacion-de-vendedores?nocache=true).
