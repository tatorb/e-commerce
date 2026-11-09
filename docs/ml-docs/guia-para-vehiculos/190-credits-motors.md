<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/credits-motors -->
<!-- Sección: Guía para vehículos -->

# Créditos pre aprobados

Última actualización 15/03/2023

## Créditos pre aprobados

Importante:

Este recurso está disponible para vehículos en Brasil e inmuebles en Chile.

El recurso de /vis/loans permite al vendedor identificar créditos pre-aprobados por los bancos en caso de negociación con el comprador.

## Notificaciones de nuevos leads de Créditos

Con el [tópico leads credits](https://developers.mercadolibre.com.ar/es_ar/productos-recibe-notificaciones#Leads-credits) podrás suscribirte y comenzar a recibir notificaciones sobre los nuevos leads de créditos generados en sus publicaciones, te permitirá reconocer un nuevo crédito creado en Meli al momento de su creación.

## Consultar créditos disponibilizados para los ítems del vendedor

Ahora, el vendedor puede consultar todos los créditos disponibles por sus negociaciones, con la posibilidad de paginarlos con el parámetro offset y con un límite máximo de 100 ítems por página. Los datos estarán disponibles en un período máximo de consulta de 3 meses.

Nota:

Incluímos los campos de status y proposal_id en las respuestas, ahora será posible consultar y filtrar los créditos con status **no aprobados** .

Para obtener los datos de pruebas, utilice el header **'x-sandbox: true'**

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/loans/search?seller_id=$SELLER_ID&date_from=AAAA-MM-DDTHH:MM:SS&date_to=AAAA-MM-DDTHH:MM:SS
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/loans/search?seller_id=707775316&date_from=2020-12-10T00:00:00&date_to=2021-01-01T00:00:00
```

Respuesta:

```
{
  "results": [{
    "id": "14b556e2-85dc-11eb-8436-2753cb1f9665",
    "item_id": "MLB5903538649",
    "down_payment_amount": 9012.0,
    "installments_number": 9,
    "installments_amount": 1001.0,
    "seller_id": 707775316,
    "buyer_id": 65979,
    "proposal_id": "40962",
    "date_created": "2020-12-19T14:00:59",
    "financial_entity_id": "VOTORANTIM",
    "expired": false
  }],
  "paging": {
    "offset": 0,
    "limit": 10,
    "total": 1
  },
  "date_from": "2020-12-10T00:00:00",
  "date_to": "2021-01-01T00:00:00"
}
```

Parámetros disponibles:
 **item_id** 
 **status** : approved, rejected, in_analysis, all. Si no se agrega, traeremos los aprobados por defecto.
 **financial_entity_id** : MERCADO_PAGO, VOTORANTIM, SANTANDER o SCOTIA.

**Campos de respuesta**

- **ID** : id de crédito.

- **item_id** : id Item.

- **down_payment_amount:** : monto de entrada de crédito.

- **installments_number** : quantidade de taxas.

- **installments_amount** : monto de la cuota.

- **seller_id** : id del vendedor.

- **buyer_id** : id del comprador.

- **proposal_id** : solo devuelve información cuando la entidad financiera lo disponibiliza.

- **date_created** : fecha de creación del crédito.

- **financial_entity_id** : id banco.

- **expired** : true or false.

- 

- 

- Detalles del crédito disponibilizado

- Con el ID del crédito, puedes acceder a los detalles incluidos los datos de contacto del comprador.

- Para obtener los datos de pruebas, utilice el header **'x-sandbox: true'** .

- Llamada:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/loans/$CREDIT_ID?seller_id=$SELLER_ID`

- Ejemplo:

- `curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/vis/loans/14b52fd8-85dc-11eb-8436-2753cb1f9665?seller_id=707775316`

- Respuesta:

- `{ "id": "14b52fd8-85dc-11eb-8436-2753cb1f9665", "item_id": "MLB3450596169", "down_payment_amount": 3575.0, "installments_number": 21, "installments_amount": 170.0, "seller_id": 707775316, "date_created": "2021-03-08T04:41:39", "financial_entity_id": "VOTORANTIM", "buyer": { "id": 7165, "full_name": "Natália Costa", "email": "Bernardo.Silva@example.com", "phone": "(46) 6501-4768" } }`

- **Campos de respuesta**

- **buyer.id** : id del comprador. **buyer.full_name** : nombre del comprador. **buyer.email** : e-mail del comprador. **buyer.phone** : número de teléfono contacto del comprador. **status** : status del crédito. **proposal_id** : solo devuelve información cuando la entidad financiera lo disponibiliza.

- 

- 

- Posibles errores

- Errores en la búsqueda por créditos:

- Error_code Tipo Mensaje del error Solución     401 Unauthorized Unauthorized Sin access token   400 Bad Request "Value of seller_id parameter must match value obtained from auth token" Access token no pertenece al vendedor   400 Bad Request Invalid date_from format. It must follow ISO format Formato de la fecha inválido   400 Bad Request Date range cannot exceed 3 months Periodo de búsqueda mayor a 3 meses   400 Bad Request Invalid financial entity Banco no existe   400 Bad Request item_id value must match M[A-Z]{2}[0-9]+$ item inválido

- 

- 

- Errores para obtener los detalles del crédito:

- Error_code Tipo Mensaje del error Solución     401 Unauthorized Unauthorized Sin access token   400 Bad Request Value of seller_id parameter must match value obtained from auth token Access token no pertenece al vendedor:   400 Bad Request id value must match [a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12} like an uuid" Identificador inválido   404 Not Found Detail not found for credit with id Crédito inexistente   410 The resource is expired Gone Crédito expirado
