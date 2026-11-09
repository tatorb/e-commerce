<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/items-atributos-de-envio-y-dimensiones -->
<!-- Sección: FAQs -->

# Items - Atributos de envío y dimensiones

Última actualización 14/08/2026

[FAQs](https://developers.mercadolibre.com.ar/es_ar/faq-preguntas-frecuentes) › Items - Atributos de envío y dimensiones

## Items - Atributos de envío y dimensiones

¿Qué atributos debo enviar para que la API acepte dimensiones y peso del paquete (seller_package_*) y en qué unidades?

Las dimensiones deben enviarse como valores numéricos con unidades: height/width/length en centímetros y weight en gramos (entero). En shipping.dimensions suele utilizarse el formato AxBxC, peso, con dimensiones en cm y peso en gramos. La API valida límites y formatos; en algunos sites enviar el peso en gramos entero evita errores por fracciones.

Recomendación

Normalice unidades en su integración (cm y g), convierta fracciones a enteros cuando corresponda y valide contra los límites de la API antes de enviar.

¿Por qué recibo error "seller_package dimensions are too small / invalid" si envío dimensiones reales muy pequeñas (p. ej. delineadores)?

El sistema valida el realismo de las dimensiones y puede rechazar medidas extremadamente pequeñas; la validación espera dimensiones de embalaje (caja o sobre) y no medidas del producto crudo si la categoría exige mínimos.

Recomendación

Envíe las dimensiones del embalaje real utilizado (caja o sobre) y ajuste a mínimos de categoría cuando sea requerido.

Al actualizar un ítem con ME2 me aparecen warnings y las dimensiones no cambian. ¿Por qué?

Para logística ME2/fulfillment, ciertas dimensiones son gestionadas por la operación logística y no siempre son modificables vía API; la plataforma puede imponer valores o considerar algunas medidas como read-only hasta el ingreso físico en depósito.

Recomendación

Si el ítem está en modo fulfillment, considere que algunas dimensiones serán gestionadas por la logística y planifique actualizaciones coordinadas con el flujo operativo.

¿Por qué la API rechaza las dimensiones del paquete con "item.attribute.invalid.seller.package.dimensions" aunque los datos parezcan correctos?

Los atributos de dimensiones del paquete (SELLER_PACKAGE_HEIGHT, SELLER_PACKAGE_WIDTH, SELLER_PACKAGE_LENGTH, SELLER_PACKAGE_WEIGHT) deben enviarse como strings numéricos puros, sin texto de unidad en el valor. Por ejemplo, enviar "69" y no "69cm" o "69 cm". El peso debe estar expresado en gramos como número entero. Además, el campo MANUFACTURING_TIME dentro de sale_terms no puede ser null ni estar ausente — debe contener un entero que indique los días de fabricación. Omitirlo o enviarlo como null genera un error de validación que bloquea la publicación incluso cuando las dimensiones son correctas.

Recomendación

Antes de publicar, valida que todos los valores de dimensión sean strings numéricos sin unidades, que el peso esté en gramos enteros, y que MANUFACTURING_TIME tenga un valor entero válido. Un valor de 0 es aceptable si el producto se encuentra disponible de inmediato.

¿Por qué un ítem recién creado pasa automáticamente al estado "closed" pocos minutos después de la creación?

Cuando un ítem transiciona de not_yet_active a closed en pocos minutos sin que el integrador lo solicite, la causa más frecuente es que la plataforma detectó el listado como un posible duplicado de un ítem existente en la cuenta, o que el proceso de descarga y validación de imágenes activó un filtro automático de calidad. En algunos casos, la plataforma puede crear un nuevo ítem con un ID diferente (relist o repost) que se activa en lugar del original, dejando el ítem inicial en estado closed. Este comportamiento no implica necesariamente un error en el payload enviado.

Recomendación

Después de crear un ítem, consulta su estado con un breve retardo antes de asumir que está activo. Guarda la relación entre el ID original y cualquier relist generado. Si el problema es recurrente, verifica que las imágenes cumplan los requisitos de calidad y revisa que no existan listados con atributos idénticos ya publicados en la cuenta.
