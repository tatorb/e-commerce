<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/user-products -->
<!-- Sección: Guía para productos > User Products -->

# User Products

Última actualización 17/06/2026

## User Products

Importante:

Podrás realizar pruebas al solicitar la ambientación de tus usuarios de TEST con el siguiente [formulario](https://docs.google.com/forms/d/e/1FAIpQLSfC3RVMKKDrTU0vVVOC_TsbidG_ImvKMLggkB3004hrr0eMqw/viewform).

User Product (UP) es un nuevo concepto dentro de Mercado Libre que tiene como objetivo permitir al vendedor la elección de diferentes condiciones de venta para cada variante de un mismo producto.

En el modelo anterior de publicaciones de un vendedor, es posible crear variantes que agrupan diferentes opciones del mismo producto, por ejemplo una camisa en varios colores o tallas. Estas variantes permiten ofrecer productos relacionados dentro de una misma publicación. Sin embargo, este modelo tiene varias limitaciones:

- No es posible establecer diferentes precios por variante.

- No es posible configurar diferentes formas de entrega por variantes.

- No es posible aplicar promociones o cuotas de pago específicas a una variante y no a otras.

Nuestro objetivo es adaptar un nuevo modelo que permita resolver estos problemas y unificar la experiencia, desacoplando las condiciones de venta para permitir diferencias por cada variante y así escalar las publicaciones.
A partir de esto, surge la idea de crear "User Products" (Productos de Usuario), donde las iniciativas a trabajar serán:

- [Precio por variación.](https://developers.mercadolibre.com.ar/es_ar/precio-variacion)

- [Stock distribuido.](https://developers.mercadolibre.com.ar/es_ar/stock-distribuido)

- [Stock multi origen.](https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen)

Este enfoque permitirá ofrecer una mayor flexibilidad en la configuración de publicaciones, permitiendo precios y gestión de stock específicos para cada variante, lo que mejorará la experiencia del comprador y la eficiencia en las operaciones de venta.

## Conceptos importantes

Para comprender el modelo de User Product (UP), es fundamental tener en cuenta los siguientes conceptos:

1. Ítem:

2. Es la representación de la publicación de un producto que un comprador visualiza en la plataforma.

3. Contiene información relativa a condiciones de venta (precio, cuotas, etc).

4. Cada ítem tiene un identificador único (item_id) asociado.

5. 

6. User Product (UP):

7. Representa un producto físico que un vendedor posee y que oferta a través de la plataforma.

8. Un UP describe al producto de la manera más específica posible (a nivel de variación).

9. Cada UP tiene un identificador único (user_product_id) asignado automáticamente por el sistema.

10. Puede estar asociado a uno o más ítems. ej. un iphone rojo (el UP) puede estar en el item1 en 3 cuotas y en el item2 con otro precio distinto.

11. Todo UP podrá visualizarse en Mercado Libre a través de una User Products Page (UPP).

12. 

13. Familia:

14. Se autogenera en base a la información de los productos.

15. Cada UP pertenece a una familia (family_id), y cada familia agrupa a varios UPs.

16. Los ítems de la misma familia van a tener el mismo family_name y van a ser representados como pickers diferentes en la UPP. Los pickers son las opciones que se le ofrece a un buyer para comprar un producto, incluyendo diferentes condiciones de venta y atributos, por ejemplo, el color.

17. Para agrupar User Products en una familia, se consideran los atributos marcados como **PARENT_PK** , que deben tener los mismos valores en todos los productos de la familia. Los atributos **CHILD_PK**  y los customizados solo aportan su id y nombre al cálculo, permitiendo que sus valores varíen entre productos de la misma familia. Los atributos read_only no se consideran. Así, una familia reúne productos con características principales iguales y permite variaciones.

18. Los campos a utilizar para definir una familia son:  Name (en caso de tener family_name priorizamos el family_name frente al name) Domain_id User_id Attributes:  PARENT_PK CHILD_PK Custom Attributes Item Condition    *No se consideran los atributos child_pk y parent_pk que sean read_only para generar la familia

19. La modificación de los ítems mediante el [PUT al recurso /items](https://developers.mercadolibre.com.ar/es_ar/producto-sincroniza-modifica-publicaciones) que refiere a características del User Product se replicará por Mercado Libre de manera asíncrona en todos los ítems asociados al mismo User Product. Los campos del ítem que se sincronizan son:

20. title   family_name   attributes   pictures   domain_id   catalog_product_id   condition   available_quantity

21. Para ítems de moda, [la guía de talles](https://developers.mercadolibre.com.ar/es_ar/guias-de-talles) va a ser compartida por la variación (User products) y sus condiciones de venta (ítems).

A continuación, para ejemplificar los conceptos antes mencionados, presentamos un comparativo entre una publicación en el modelo anterior vs el endgame con User Products.

Con base en el nuevo modelo, presentamos un ejemplo para una familia y su composición tanto en UP como en sus ítems y condiciones de venta:

Nota:

Nota: Para conocer cómo gestionar el stock acceda a la documentación de [“Stock distribuido”.](https://developers.mercadolibre.com.ar/es_ar/stock-distribuido)

## FAQs

## Precio por variación

**¿Qué tipo de integradores deben adaptar sus desarrollos a esta iniciativa?**

La iniciativa de Precio por variación y UPtin aplica a todos los integradores que publican, sincronizan o inclusive muestran listado de publicaciones para los vendedores. La iniciativa de Stock Distribuido y Multiorigen aplica para todos los vendedores que publican, sincronizan o toman información de las órdenes y envíos.

**¿Qué impacto tendré en caso de no implementar la iniciativa?**

Una vez que los sellers sean activados para comenzar a publicar bajo el nuevo modelo de Precio por Variació, en caso de que el integrador no esté adaptado a los cambios, **no será posible publicar con el modelo anterior**  (informando title y array de variations).
 Para los integradores que sincronizan ítems, actualizan stock, precio, o resguardan en sus bases de datos información sobre los items deben tener en cuenta la nueva estructura de modificación de stock (a nivel de UP) y además recibir notificaciones de cambios por migración de ítems para mantener consistencia de información en sus bases de datos.
 Finalmente, para los integradores que listan publicaciones, deben considerar actualizar su front para adaptarse a la propuesta de valor que otorgará Mercado Libre con esta iniciativa. Es decir, agrupar los ítems por familia, por user product y además (en casos de publicar o modificar) permitir que se establezcan diferentes condiciones de venta para cada variación.

**¿Cómo puedo identificar los sellers que ya se encuentran bajo el nuevo modelo de Precio por Variación?**

A través del tag **"user_product_seller"**  en la API /users.

**¿Cómo puedo identificar los ítems que ya se encuentran en el modelo de Precio por Variación?**

Validando si el ítem cuenta con **family_name distinto a null** . Esto sucederá en:

- Ítems/Live Listings (LL) que ya pasaron el proceso de **UPtin** .

- Nuevos ítems (NOLs) que fueron publicados a partir de que al **seller**  se le asignó el tag "user_product_seller".

**¿Los ítems de catálogo contarán con el tag user_product_listing = true?**

No.

**¿Cómo puedo probar el flujo de User Products?**

Para probar los nuevos flujos, solicitamos que lo hagan a través de este [formulario](https://docs.google.com/forms/d/e/1FAIpQLSfC3RVMKKDrTU0vVVOC_TsbidG_ImvKMLggkB3004hrr0eMqw/viewform). Cada 7 días, activaremos estos nuevos usuarios.

**¿Todos los vendedores serán habilitados para trabajar con precio por variaciones?**

En el endgame, sí, todos los sellers estarán habilitados para publicar utilizarlo. A partir de octubre de 2024 los sellers se irán habilitando de manera progresiva hasta llegar al 100% de sellers en 2025.

**¿Todos los ítems contarán con user_product_id, family_id y family_name?**

- Previo a la activación del tag "user_product_seller": los Live Listing contarán con **user_product_id**  y no tendrán **family_name** . La relación de **user_product_id**  y **item_id**  será 1:1.

- Posterior a la activación del tag "user_product_seller": se realizará un proceso de unificación para ítems mono-variantes y sin variantes, con la finalidad de agrupar los ítems que deberían pertenecer al mismo **user_product_id** , permitiendo que un **user_product_id**  esté asociado a 1 o más ítems. Posterior a la unificación, los ítems contarán con el atributo **family_name** .

- Cuando el seller decide realizar migrar un ítem multivariante al nuevo modelo (UPtin). En dicho caso, los nuevos ítems generados estarán asociados al mismo **user_product_id**  y también contarán con **family_name** .

**¿Hasta cuando el seller podrá publicar en el modelo viejo?**

Hasta la activación del tag "user_product_seller". A partir de la activación, los nuevos ítems deberán ser creados bajo el nuevo modelo.

**¿Existe algún endpoint para listar todos las familias de un seller?**

No, actualmente no existe.

**¿Cómo puedo obtener todos los ítems que corresponden a una misma familia?**

Realizando las siguientes peticiones:

- GET a /items para obtener el **user_product_id**

- GET a /user-products/$USER_PRODUCT_ID para obtener el **family_id**

- GET a /sites/$SITE_ID/user-products-families/$FAMILY_ID para **obtener todos los User Products asociados a una familia**

- GET a /users/$SELLER_ID/items/search?user_product_id=$USER_PRODUCT_ID para **obtener todos los ítems asociados a un user product.**  Se pueden enviar varios user_products_ids en el parámetro en forma de lista, ejemplo: GET /users/$SELLER_ID/items/search?user_product_id=MLAU1234,MLAU12345

**¿De qué tamaño debe ser el family_name ingresado por el vendedor durante la publicación?**

El family_name que podrá ingresar deberá ser menor o igual al “max_title_length” del dominio.

**¿Es posible actualizar el family_name?**

Sí, únicamente cuando ninguna de las condiciones de venta asociadas al User Product tenga ventas. Ten en cuenta de que en caso de que un ítem esté asociado a un UP con varios ítems, el family_name será posible actualizarlo y se sincronizará con todos los ítems del UP.

**Al alterar la condición de venta de un User Product, ¿se va a alterar también su family_name?**

No debería ser alterado, ya que el family_name no está relacionado con las condiciones de venta (por ejemplo, precio, tipo de listado).

**¿El family_name será gestionado por el integrador, correcto? Es decir, ¿Meli no va a cambiar el valor de este campo?**

Sí, es responsabilidad del vendedor/integrador. Sólo en el caso de UPtin Mercado Libre creará el family_name al artículo.

**¿Puedo publicar con atributos tipo custom en el modelo de Precio por Variación?**

Sí, se puede publicar sumando el atributo, ejemplo:

```

{
	"attributes": [
		{
			"name": "my-custom-attribute-name",
			"value_name":"my-custom-attribute-value"
		}
	]
}
```

**¿El recurso /categories continuará funcionando igual para que podamos consultar los atributos y sus tags? Por ejemplo, allow_variations y variation_attribute.**

Sí, incluso, podrás tomar como referencia (no regla) estos atributos para entender cuál será el atributo llevado para la completitud del **family_name**  de la publicación.

**¿Será posible enviar el array de variations después de la activación de un seller para trabajar con Precio por Variación?**

No, no se podrá enviar el array, porque cada una de las variaciones van a ser User Products diferentes.

## UPtin

**¿Los ítems que se encuentren en el modelo anterior migrarán de manera automática al nuevo modelo?**

Una vez que al seller se le active el modelo de Precio por Variación (cuente con el tag "user_product_seller), los ítems sin variantes serán migrados de manera automática por Mercado Libre hacía el nuevo modelo.

**¿Todos los ítems son candidatos a migrar al nuevo modelo de Precio por Variación?**

No, es necesario utilizar el [endpoint de elegibilidad](https://developers.mercadolibre.com.ar/es_ar/precio-variacion#Elegibilidad-de-los-items-uptin) para validar si es posible migrar el ítem.

**¿Cuándo el seller migre una publicación con 3 variantes del modelo actual al modelo User Products, ¿Cómo será enviada la notificación de creación?**

Vas a a recibir una notificación por cada ítem creado a través del tópico de ítems. EI, el ítem antiguo quedará con el status closed y cada publicación nueva creada tendrá el tag “variations_migration_uptin”.

**¿Qué pasará con la información de las ventas de las publicaciones antiguas?**

El campo sold quantity reflejará las mismas ventas que el sold quantity de la variante, sin embargo las ordenes viejas quedarán asociadas al item_id viejo.

## Stock distribuido y multiorigen

**¿Cómo convivirá el nuevo y viejo mundo?**

Cuando un vendedor se configura para multiorigen, todos los ítems pasan a gestionarse como de multiorigen también, no hay distinción entre viejo modelo y nuevo modelo.

**¿El mismo anuncio podrá estar en más de un almacén (stock_location) del seller?**

Sí, para los vendedores que tengan activo Multiorigen (tag warehouse_management) podrán distribuir el stock en sus diferentes stock_location. Conoce más sobre cómo distribuir stock en la documentación de [Stock Multiorigen.](https://developers.mercadolibre.com.ar/es_ar/stock-multi-origen)

**¿Una vez que el seller es encendido a multiorigen, cómo se debe distribuir el stock para publicaciones que se encuentran en el modelo antiguo?**

Una vez que se prenda el seller a multiorigen el stock debedeve ser gestionado con el PUT a seller_warehouse.

**Siguiente** : [Precio por variación](https://developers.mercadolibre.com.ar/es_ar/precio-variacion).
