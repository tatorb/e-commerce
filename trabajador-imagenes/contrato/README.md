# Contrato entre la app y el trabajador

Ejemplos de los mensajes que se dicen la app (`src/domain/photo-contract.ts`) y el trabajador (`mrb_imagenes/app.py`). Las pruebas de los dos lados leen estos mismos archivos: si uno cambia la forma de un mensaje sin cambiar el otro, alguna prueba falla.

- `trabajo.json`: lo que la app le da al trabajador al preguntar por trabajo.
- `resultado.json`: lo que el trabajador entrega al terminar un paso.
- `fallo.json`: lo que entrega cuando no pudo hacerlo.

Los datos son inventados.

Los del editor de videos (`src/domain/video-edit.ts` y `mrb_videos/conexion.py`):

- `video_trabajo.json`: lo que la app le da a la Mac al preguntar por un video para editar.
- `video_resultado.json`: lo que la Mac entrega al terminar el clip.
- `video_fallo.json`: lo que entrega cuando no pudo.
