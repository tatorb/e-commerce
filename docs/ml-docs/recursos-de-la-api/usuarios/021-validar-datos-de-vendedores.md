<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/validar-datos-de-vendedores -->
<!-- Sección: Recursos de la API > Usuarios -->

# Validar datos de vendedores

Puedes usar esta documentación para las siguientes unidades de negocio:

Última actualización 30/12/2025

## Validar datos de vendedores

Con este recurso los integradores pueden reconocer la situación de sus usuarios (vendedores nuevos y actuales), y determinar si estos tienen sus datos completos para poder vender en Mercado Libre, recibir dinero por Mercado Pago y usar la tarjeta prepaga. 

 Conoce más [porqué deben completar la información de su cuenta](https://www.mercadopago.com.ar/ayuda/16804).

Si el vendedor tiene su cuenta bloqueada, por falta de documentación, compártele el siguiente link para [completar sus datos y seguir usando su cuenta](https://www.mercadolibre.com.ar/kyc?initiative=supply-communications&congrats=true&landing=true). Para consultar esto, utiliza el recurso /users:

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/$USER_ID?attributes=status
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/users/123456789?attributes=status
```

Respuesta:

```
{
    "status": {
        "billing": {
            "allow": true,
            "codes": []
        },
        "buy": {
            "immediate_payment": {
                "reasons": [],
                "required": false
            },
            "allow": true,
            "codes": []
        },
        "required_action": null,
        "sell": {
            "allow": true,
            "codes": [],
            "immediate_payment": {
                "reasons": [],
                "required": false
            }
        },
        "mercadopago_account_type": "personal",
        "mercadopago_tc_accepted": true,
        "site_status": "active",
        "confirmed_email": false,
        "shopping_cart": {
            "buy": "allowed",
            "sell": "allowed"
        },
        "immediate_payment": false,
        "list": {
            "allow": false,
            "codes": [
                "rejected_by_regulations"
            ],
            "immediate_payment": {
                "reasons": [],
                "required": false
            }
        },
        "mercadoenvios": "not_accepted",
        "user_type": null
    }
}
```

En la respuesta anterior puedes ver que el usuario está bloqueado para publicar (list: "allow”: false) debido a que tiene pendiente completar información regulatoria (“codes”: "rejected_by_regulations").

## Consideraciones

- Antes de realizar el proceso de validación de identidad, verifica que eres quien figura en la documentación subida en tu cuenta al momento en que fue creada.   Ingresa a Mi cuenta > Configuración > [Mis datos](https://myaccount.mercadolibre.com.ar/profile#menu-user).   En caso de necesitar alterar información de la cuenta, accede a Mis datos > **Necesito ayuda**  para efectuar el cambio (como e-mail, titularidad, nombre y apellido, documento, etc).  Al completar los datos en tu cuenta, igual debes realizar la [validación de identidad](https://www.mercadolibre.com.ar/kyc?initiative=supply-communications&congrats=true&landing=true).

- El representante legal de una cuenta empresa es quien realiza la validación de identidad presentando la documentación correspondiente que demuestre esta relación.

- La validación de identidad del usuario puede demorar hasta 3 días hábiles.
