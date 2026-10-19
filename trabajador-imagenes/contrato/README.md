# Contrato entre la app y el trabajador

Ejemplos de los mensajes que se dicen la app (`src/domain/photo-contract.ts`) y el trabajador (`mrb_imagenes/app.py`). Las pruebas de los dos lados leen estos mismos archivos: si uno cambia la forma de un mensaje sin cambiar el otro, alguna prueba falla.

- `trabajo.json`: lo que la app le da al trabajador al preguntar por trabajo.
- `resultado.json`: lo que el trabajador entrega al terminar un paso.
- `fallo.json`: lo que entrega cuando no pudo hacerlo.

Los datos son inventados.
