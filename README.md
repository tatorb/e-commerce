# E-commerce Studio MRB

Herramienta que Studio MRB aporta a sus clientes para preparar, corregir y mejorar
publicaciones de productos en distintos canales de venta. Va a vivir en
`e-commerce.studiomrb.com`.

**La regla que guía todo:** la app es la fuente única de verdad del producto. Los canales
(Mercado Libre, tienda web, otros) son solo lugares donde ese producto se muestra.

## Vocabulario

| En la app | En el código | Qué es |
| --- | --- | --- |
| Cuenta | `Account` | El cliente del estudio. Todo dato pertenece a una cuenta. |
| Producto | `Product` | La ficha maestra, independiente del canal. |
| Medida | `ProductVariant` | Variante del producto, por ejemplo STD o 0.50, con su SKU. |
| Activo | `Asset` | Foto o video del producto. Por ahora solo el link. |
| Canal | `Channel` | Mercado Libre, tienda web, etc. |
| Tienda | `Store` | La presencia de una cuenta en un canal, por ejemplo INSURMOTOR. Guarda la forma de aplicar: manual, planilla o API. |
| Individual o combo | `Product.kind`, `ComboItem` | Un producto individual se vende tal cual. Un combo se arma con productos individuales, cada uno con su cantidad; no puede tener otro combo adentro. En el canal los dos son publicaciones del mismo nivel. Un individual que está en un combo no se puede borrar ni pasar a combo. Productos, Catálogo y Pipeline filtran por tipo (`?tipo=individual`, `?tipo=combo`). |
| Publicación | `Publication` | El producto armado para una tienda: título, descripción, atributos, precio, ID externo, link, estado y las preguntas que recibió de los compradores (`ownQuestions`). Un producto puede tener varias publicaciones: la ficha la comparten todas, y las tarjetas del paso Información que son del producto lo avisan ("Es del producto: lo ven sus N publicaciones"). |
| Catálogo | (pantalla) | La lista de todas las publicaciones, en `/publicaciones`. Desde ahí se eligen las que entran al pipeline. |
| Pipeline | `Publication.pipelineStatus` | La etapa que se ve de cada publicación: Sin tocar, En pipeline (con su paso), Corregida o Descartada (con su motivo). También entran las que todavía no están publicadas: llevan "Sin publicar" en lugar del código, el título nunca está bloqueado y la posición se mide después de publicar. El código se carga en el paso Publicación, y sin código no se puede marcar como corregida. Las del mismo producto o con el mismo título que otra del pipeline entran igual, con un aviso. |
| Tablero | (pantalla) | La sección Pipeline, que es la página de inicio: una columna por paso, con una tarjeta por publicación, y la tienda cuando la cuenta tiene más de una. "Nueva publicación" crea una sin publicar, de un producto que ya está o con una ficha corta, y la deja en Información. Al tocarla se abre su paso, con los botones para volver, avanzar, marcarla como corregida o sacarla del pipeline. Desde la línea de pasos se puede mirar y trabajar cualquier otro paso (`?paso=informacion`, `?paso=titulo`…), también en otra pestaña; los botones para mover la publicación están solo en su paso actual. |
| Paso del pipeline | `PipelineStep` | Información, Título, Imágenes, Videos, Organización de multimedia, Descripción y Publicación, en ese orden. Al sacar una publicación se conserva el paso, para retomar ahí. |
| Movimiento del pipeline | `PipelineMovement` | Cuándo entró y salió una publicación de cada paso, quién la movió y por qué salió: avanzó, volvió, se sacó o terminó. |
| Paso Información | (pantalla) | Muestra y edita los datos de la ficha que usa el título (tipo, marca, número de pieza, línea, origen, medidas y compatibilidades con cilindrada y combustible) y guarda la competencia. Lo que se edita queda en la ficha. |
| Competencia | `CompetitorListing` | Las publicaciones de otros vendedores que más venden, cargadas a mano: link, título y vendidos. Conviene al menos 3; el tope de 100 es solo de protección. Sus títulos suman palabras al mapa. |
| Reglas de título | `TitleRuleSet` | Largo máximo, signos y palabras no permitidas, y estructura sugerida por familia, por cuenta y canal. Sin reglas propias valen las del canal. Se editan en Ajustes. |
| Semilla | `TitleWork.seeds` | Lo que se escribe en el buscador del canal para ver qué sugiere. La app las arma con la ficha y se pueden cambiar. |
| Sugerencias del buscador | `SearchSuggestion` | Lo que completa el buscador para una semilla, leído por la app o pegado a mano, con fecha. Son de la cuenta: sirven para todas las publicaciones con la misma semilla. |
| Mapa de palabras | (se calcula) | Las palabras de las sugerencias y de la competencia, con de dónde salen y cuántas veces aparecen. Cada una se tilda o se descarta (`TitleWork.words`). |
| Posición | `SearchPosition` | En qué página y posición aparece la publicación en una búsqueda principal, con fecha. Es la foto del antes. |
| Título aprobado | `TitleApproval` | El título que quedó, el que tenía, la propuesta de la IA que se eligió, si se editó y si se escribió en la publicación, quedó para la copia con cuotas o se mantuvo. |
| Prueba de conexión | `ChannelProbe` | Si la app puede leer sola las sugerencias y las posiciones del canal, sin cuenta o con la cuenta conectada de la tienda. Se corre en Ajustes, Conexión, y habilita la lectura automática. |
| Conexión por API | `ChannelConnection` | La cuenta del canal de una tienda, autorizada con OAuth. Cada cliente crea su propia aplicación en el canal y carga su App ID y clave secreta en Ajustes, Conexión. La clave secreta y las llaves se guardan cifradas con `CHANNEL_TOKEN_KEY` y nunca se muestran. Las llaves se renuevan solas, una sola vez a la vez. |
| Pedido de permiso | `ConnectAttempt` | Un link de autorización en curso: un código de control de un solo uso que vence a los 10 minutos, o a las 24 horas si es el link para mandarle al cliente. |
| Investigación del producto | `ProductResearch` | Lo que se junta en el paso Información y es del producto: sitio y página del fabricante, texto pegado del fabricante, aclaraciones para las imágenes (texto con formato, guardado como HTML limpio con solo negrita, cursiva y listas) y las preguntas de las publicaciones de la competencia. La comparten todas las publicaciones del producto. Las preguntas que recibió cada publicación son de esa publicación. |
| Archivo del fabricante | `ProductFile` | Imagen o PDF del fabricante, subido directo del navegador al depósito privado de Vercel (Vercel Blob) con un permiso que da `/api/archivos` solo con sesión. La app anota tipo y peso reales que informa el depósito, y los muestra en `/api/archivos/<id>`, también solo con sesión. |
| Dolor u objeción | `BuyerInsight` | Lo que preocupa o frena al comprador, en dos listas ordenables por producto. |
| Línea de imágenes | `PhotoEdit` | Una foto del producto en el paso Imágenes. El original, subido desde la Mac (JPG, PNG, HEIC o TIFF) o bajado del canal en su tamaño más grande, queda en el depósito y nunca se toca. Pasa por un solo paso con aprobación, Corrección de la foto, con 8 ajustes que la Mac hace de corrido: lente, perspectiva, blancos, luces, color, fondo, recorte y exportar. Los pasos y sus ajustes están en `src/domain/photo-steps.ts`. Es del producto: la ven todas sus publicaciones. |
| Paso de una foto | `PhotoStepRun` | Cada intento del paso. Por cada ajuste (`parts`) guarda si se aplicó, lo que propuso Claude con su razón, lo que se usó y lo que midió el programa; además la vista y los archivos. Al rehacer se piden juntos los valores de todos los ajustes y los ajustes apagados (`requested`), y se vuelve a hacer desde el original. Espera aprobación; rehacer reemplaza el intento anterior. Hay uno solo abierto por foto (`openFor`). |
| Trabajador de imágenes | `ImageWorker` | El programa que corrige las fotos, en la Mac del estudio (`trabajador-imagenes/`). Pregunta por trabajo, lo hace y lo entrega; la app nunca le habla a la Mac. Entra con su propia llave, que se crea y se corta en Equipo, y de la que se guarda solo la huella. Uno solo para todo el estudio. Cómo instalarlo está en `IMAGENES.md`. |
| Ajustes de imágenes | `PhotoSettings` | Margen del recorte, color de fondo y calidad del JPG, y el tope de cada ajuste, por cuenta. Sin cargar valen los de `src/domain/photo-settings.ts`. Cada paso guarda una copia de los que usó. |
| Datos de catálogo | `Publication.attributes` | Los campos del formulario del canal para la categoría de la publicación, con sus opciones, por ejemplo "Tipo de embrague" o "Incluye disco". Cada canal trae sus categorías y campos (los de Mercado Libre están en `src/channels/mercadolibre/catalog/`, bajados de su API pública). La categoría sale de la familia del producto o se elige a mano (`Publication.channelCategory`). Marca, número de pieza y origen salen de la ficha. Solo se guardan valores válidos, como nombre y valor. |
| Conexión con Claude | `McpToken` | El permiso para que Claude use la app en nombre de una persona, desde claude.ai u otro programa de Claude. Se agrega como conector con la dirección `/api/mcp`, dura 30 días y se corta en Equipo. Cada cambio queda a nombre de esa persona. En la base se guarda solo la huella de la llave. |
| Título bloqueado | (se calcula) | Cuando el canal no deja cambiar el título. Lo dicen los vendidos y las ventas de las mediciones, con la regla de cada canal; si no hay datos, se marca a mano en la publicación. |
| Estado de la propuesta | `Stage` | Sin propuesta, Propuesta generada, En revisión, Aprobado, Aplicado en canal, Medido. Es el recorrido de la propuesta completa con IA, no la etapa de la publicación. |
| Movimiento de la propuesta | `StageMovement` | Cuándo entró y salió una publicación de cada estado de la propuesta, y quién la movió. |
| Medición | `Measurement` | Cómo estaba una publicación en una fecha: visitas, ventas y lo que tenía cargado. Es el "antes" para comparar. Cada pantalla muestra el último dato que se tiene de cada métrica (`latestMetrics`): por ejemplo, las visitas de la última lectura del canal y las ventas de 90 días de la última planilla. |
| Importación | `ImportRun` | Quién importó qué, cuándo y qué resultó. Viene de un archivo o del canal (`origin`). Se puede deshacer: los productos que creó y después sumaron otras publicaciones, o están en un combo, quedan como cargados a mano, y el historial dice cuántos (`productsKept`). |
| Traer del canal | (pantalla) | En Importar, para cada tienda conectada: elige activas, pausadas o finalizadas, lee las publicaciones con la cuenta conectada y sigue con la misma revisión, modo y deshacer que un archivo. Lee de a 100 con una pausa entre tandas; si el canal pide esperar, espera y sigue, y si sigue cortando deja seguir desde donde quedó (`CHANNEL_READ_PAUSE_SECONDS` y `CHANNEL_READ_WAIT_SECONDS` acortan las esperas para probar). Trae título, descripción, link, estado, precio público, datos de catálogo, marca, número de pieza, SKU, medidas de las variantes, tipo de producto (la familia de la categoría, o el nombre de la categoría), fotos, y una medición con vendidos, visitas de 90 días, fotos, video, atributos y calidad. En lo que ya estaba, estado, link y precio se actualizan siempre, y la ficha solo se completa. No lee órdenes, compradores ni mensajes, así que las ventas de 90 días siguen saliendo de la planilla. |
| Relación de columnas | `ImportMapping` | Qué columna de un archivo va a qué campo. Se guarda para reusarla. |
| Cambio de importación | `ImportChange` | Un campo que una importación completó o reemplazó en algo que ya estaba: cómo estaba y cómo quedó. Es lo que permite deshacerla. |
| Propuesta | `Proposal` | Lo que la IA propone cambiar en una publicación, campo por campo, con el motivo y lo que hay que confirmar. No cambia nada hasta que se aprueba. Guarda cómo estaba todo al generarla. |
| Revisión | `Proposal.review` | Donde una persona corrige la propuesta, campo por campo, y la aprueba o la rechaza. Los campos de la ficha llevan la marca "De la ficha", y si el producto tiene otras publicaciones la pantalla las lista, porque esos cambios también les llegan. En compatibilidades, ficha técnica y medidas se elige fila por fila qué se suma, qué se saca y qué cambia; lo que se saca viene sin marcar. Al aprobar se escribe en la ficha y la publicación, y queda qué propuso la IA, qué quedó y qué se editó. No deja aprobar con marcas [A CONFIRMAR: …] ni con un título más largo que el del canal. |
| Aplicación | `ChannelApplication` | Cuándo lo aprobado quedó aplicado en el canal, de qué forma (a mano, por planilla o por API) y qué campos. Es el punto de partida para medir el antes y el después. |
| Planilla de contenido | (archivo) | CSV que se baja desde el Catálogo, con una fila por publicación y lo que la app ya sabe. Se completa a mano o con IA y se vuelve a importar. |
| Regla del estándar | `StandardRule` | Qué tiene que tener una publicación correcta, por cuenta y canal: qué revisa, con qué valor y cuánto pesa. |
| Puntaje | (se calcula) | De 0 a 100: lo que suman las reglas cumplidas sobre lo que suman las que aplican. No se guarda, se calcula cada vez. |

## Cómo está ordenado

- `src/domain/`: producto, publicación, pipeline, etapas, mediciones, estándar, contenido, propuestas y revisión. No sabe nada
  de canales ni de archivos. `pipeline.ts` agrega, mueve y saca publicaciones del pipeline, y avisa las del mismo producto. `pipeline-publications.ts` crea una publicación nueva sin publicar, con ficha corta si hace falta. `content.ts` compara el contenido que llega con el que hay, campo
  por campo, y decide qué se completa o se reemplaza. `moveToStage` es la única forma de cambiar de etapa. `standard.ts` tiene las
  revisiones que puede hacer una regla y el cálculo del puntaje: primero mira la ficha y la
  publicación, y si la app todavía no tiene ese dato usa la última medición.
- `src/ai/`: los pedidos a Claude, la propuesta completa y las 3 propuestas de título. Reciben la
  ficha, la publicación y lo necesario de cada caso, y devuelven una respuesta con forma fija. No sabe de archivos ni de canales, y nunca recibe
  precios, visitas ni ventas. El modelo y los precios están en `claude.ts`.
- `src/channels/`: lo único que sabe de cada canal (formato del ID, link, largo del título, cuándo
  el título está bloqueado, reglas de título iniciales, link de búsqueda y la guía para aplicar a mano,
  con los datos en el orden del formulario del canal). `research.ts` es lo que se lee del canal desde el
  servidor: sugerencias del buscador, posición y la prueba de conexión. `connect.ts` es la conexión por
  API (OAuth): link de permiso, llaves y renovación. `listings.ts` lee las publicaciones propias con la
  cuenta conectada y las devuelve en un formato neutro (`ChannelListing`). En Mercado Libre, varias
  publicaciones se leen juntas con `/items/bulk` (`mercadolibre/http.ts`), que reemplaza a `/items?ids=`
  desde el 25/10/2026, con reintentos cuando el canal pide esperar. Las visitas de cada tanda van en un
  solo pedido (`/items/visits`), o de a una si Mercado Libre no lo acepta. Para probar sin el canal real, `MERCADOLIBRE_SUGGEST_URL`,
  `MERCADOLIBRE_API_URL`, `MERCADOLIBRE_LISTING_URL` y `MERCADOLIBRE_AUTH_URL` cambian las direcciones.
  El resto de la app usa la interfaz `ChannelAdapter`.
- `src/lib/files.ts` y `src/lib/file-rules.ts`: los archivos del fabricante en el depósito de Vercel. La app
  entra con el permiso automático de Vercel (OIDC, `BLOB_STORE_ID`) o con la clave `BLOB_READ_WRITE_TOKEN`.
  El navegador y el trabajador suben y bajan con links firmados (`src/lib/blob-uploads.ts`), que andan con
  cualquiera de los dos. Sin depósito, el paso Información muestra los pasos para crearlo. Para probar sin Vercel,
  `VERCEL_BLOB_API_URL` y `NEXT_PUBLIC_VERCEL_BLOB_API_URL` apuntan a un depósito simulado y
  `BLOB_TEST_URL_PREFIX` acepta sus direcciones.
- `src/lib/photo-queue.ts`: la cola de la línea de imágenes. El trabajador toma un paso con `FOR UPDATE SKIP LOCKED`,
  con un turno que sube cada vez: un resultado con turno viejo no se acepta. Si no avisa en 15 minutos, el paso
  vuelve a la cola, y a los 3 intentos queda fallido. Los pedidos del trabajador van a `/api/imagenes/trabajador/`
  (`siguiente`, `latido`, `resultado`) con la forma de `src/domain/photo-contract.ts`; los ejemplos de
  `trabajador-imagenes/contrato/` los prueban la app y el trabajador. `photo-files.ts` arma los permisos para que el
  trabajador baje el original con un link firmado y suba sus archivos directo al depósito. Las fotos se ven en
  `/api/imagenes/ver`, solo con sesión.
- `trabajador-imagenes/`: el trabajador, en Python. No entra en el armado de la app ni en Vercel.
- `src/lib/mcp/`: la conexión con Claude (MCP). `oauth.ts` es el permiso: registro del programa, código de un solo
  uso con PKCE, llaves de 30 días y desconexión. `redirect-allowlist.ts` dice a qué direcciones puede volver el
  permiso (las de Claude, las de la propia computadora y las de `MCP_OAUTH_REDIRECT_URIS`). `read-tools.ts` y
  `write-tools.ts` son las herramientas: una capa fina sobre las mismas consultas y la misma lógica de las
  pantallas, con las mismas reglas y avisos. Nunca devuelven precios ni datos de las conexiones con los canales,
  y cada cambio queda a nombre de la persona que conectó a Claude. No usan la IA de la app. `server.ts` resuelve el protocolo a mano, una respuesta por pedido.
  La pantalla de permiso es `/conectar-claude`.
- `src/importers/`: el único lugar que sabe leer archivos. Lee Excel y CSV en el navegador,
  propone qué columna va a qué campo, traba las columnas confidenciales y traduce cada fila a
  producto, publicación y medición. Al importar vincula por ID de publicación o por SKU; con un
  SKU repetido en varias fichas, gana la más antigua. A lo que ya estaba solo le completa lo
  vacío, o también reemplaza si se elige; una celda vacía nunca borra nada. Una fila que es otra
  publicación de un producto que ya está (mismo SKU, otro código) solo completa lo vacío de la
  ficha, aunque se elija reemplazar. Si los SKU de una fila son de productos distintos, crea una
  ficha nueva y avisa que puede ser un combo. Anota de qué importación vino cada cosa y cada cambio, para poder deshacerla.
  También arma la planilla de contenido (`content-sheet.ts`). `channel-listings.ts` convierte lo leído del
  canal en las mismas filas que una planilla, y `listing-fields.ts` guarda y deshace el estado, el link,
  el precio y los datos de catálogo de la publicación.
- `src/components/ui/` y `src/components/dashboard/`: componentes y estructura de pantalla
  copiados de app.studiomrb.com (`tatorb/LGM-processor`). El estilo no se inventa: si hace
  falta algo nuevo, se toma de allá.
- `prisma/`: tablas, migraciones y datos iniciales (cuenta Insur, canal Mercado Libre,
  tienda INSURMOTOR).

## Reglas

- Los precios internos y las listas de proveedores de los clientes son confidenciales. No van
  en datos de ejemplo, en registros ni en nada compartible. El producto no tiene campos de
  costo; el único precio es el público de cada publicación.
- Textos de la interfaz en castellano, con voseo y el vocabulario de arriba.

## Correr el proyecto en una computadora

Hace falta Node 22 o más nuevo y una base Postgres.

```bash
cp .env.example .env      # y completá DATABASE_URL y BETTER_AUTH_SECRET
npm install
npm run db:migrate        # crea las tablas
npm run db:seed           # carga cuenta, canal y tienda
npm run dev               # http://localhost:3000
```

La primera vez, la app pide crear el primer usuario.

## Controles

```bash
npm run typecheck
npm run lint
TEST_DATABASE_URL="postgresql://…/base_de_prueba" npm test
```

Las pruebas que usan base se saltean si no hay `TEST_DATABASE_URL`. Esa base se pisa: no uses
la de producción.

## Publicación en Vercel

Vercel corre `npm run vercel-build`, que aplica las migraciones, carga los datos iniciales y
arma la app. Necesita estas variables:

- `DATABASE_URL` y `DATABASE_URL_UNPOOLED`: las carga sola la integración de Neon.
- `BETTER_AUTH_SECRET`: clave del login, una frase larga al azar.
- `ANTHROPIC_API_KEY`: clave de la API de Claude, para las propuestas con IA. Se saca en
  console.anthropic.com. Sin ella, los botones de propuestas aparecen apagados.
