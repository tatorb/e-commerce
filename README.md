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
| Publicación | `Publication` | El producto armado para una tienda: título, descripción, atributos, precio, ID externo, link, estado. |
| Catálogo | (pantalla) | La lista de todas las publicaciones, en `/publicaciones`. Desde ahí se eligen las que entran al pipeline. |
| Pipeline | `Publication.pipelineStatus` | La etapa que se ve de cada publicación: Sin tocar, En pipeline (con su paso), Corregida o Descartada (con su motivo). Solo entran las que tienen código del canal. |
| Tablero | (pantalla) | La sección Pipeline: una columna por paso, con una tarjeta por publicación. Al tocarla se abre su paso, con los botones para volver, avanzar, marcarla como corregida o sacarla del pipeline. |
| Paso del pipeline | `PipelineStep` | Información, Título, Imágenes, Videos, Organización de multimedia, Descripción y Publicación, en ese orden. Al sacar una publicación se conserva el paso, para retomar ahí. |
| Movimiento del pipeline | `PipelineMovement` | Cuándo entró y salió una publicación de cada paso, quién la movió y por qué salió: avanzó, volvió, se sacó o terminó. |
| Paso Información | (pantalla) | Muestra y edita los datos de la ficha que usa el título (tipo, marca, número de pieza, línea, medidas y compatibilidades con cilindrada y combustible) y guarda la competencia. Lo que se edita queda en la ficha. |
| Competencia | `CompetitorListing` | De 3 a 5 publicaciones de otros vendedores que más venden, cargadas a mano: link, título y vendidos. Sus títulos suman palabras al mapa. |
| Reglas de título | `TitleRuleSet` | Largo máximo, signos y palabras no permitidas, y estructura sugerida por familia, por cuenta y canal. Sin reglas propias valen las del canal. Se editan en Ajustes. |
| Semilla | `TitleWork.seeds` | Lo que se escribe en el buscador del canal para ver qué sugiere. La app las arma con la ficha y se pueden cambiar. |
| Sugerencias del buscador | `SearchSuggestion` | Lo que completa el buscador para una semilla, leído por la app o pegado a mano, con fecha. Son de la cuenta: sirven para todas las publicaciones con la misma semilla. |
| Mapa de palabras | (se calcula) | Las palabras de las sugerencias y de la competencia, con de dónde salen y cuántas veces aparecen. Cada una se tilda o se descarta (`TitleWork.words`). |
| Posición | `SearchPosition` | En qué página y posición aparece la publicación en una búsqueda principal, con fecha. Es la foto del antes. |
| Título aprobado | `TitleApproval` | El título que quedó, el que tenía, la propuesta de la IA que se eligió, si se editó y si se escribió en la publicación, quedó para la copia con cuotas o se mantuvo. |
| Prueba de conexión | `ChannelProbe` | Si la app puede leer sola las sugerencias y las posiciones del canal, sin cuenta o con la cuenta conectada de la tienda. Se corre en Ajustes, Conexión, y habilita la lectura automática. |
| Conexión por API | `ChannelConnection` | La cuenta del canal de una tienda, autorizada con OAuth. Cada cliente crea su propia aplicación en el canal y carga su App ID y clave secreta en Ajustes, Conexión. La clave secreta y las llaves se guardan cifradas con `CHANNEL_TOKEN_KEY` y nunca se muestran. Las llaves se renuevan solas, una sola vez a la vez. |
| Pedido de permiso | `ConnectAttempt` | Un link de autorización en curso: un código de control de un solo uso que vence a los 10 minutos, o a las 24 horas si es el link para mandarle al cliente. |
| Investigación del producto | `ProductResearch` | Lo que se junta en el paso Información y es del producto: sitio y página del fabricante, texto pegado del fabricante, aclaraciones para las imágenes (texto con formato, guardado como HTML limpio con solo negrita, cursiva y listas) y las preguntas de los compradores. La comparten todas las publicaciones del producto. |
| Archivo del fabricante | `ProductFile` | Imagen o PDF del fabricante, subido directo del navegador al depósito privado de Vercel (Vercel Blob) con un permiso que da `/api/archivos` solo con sesión. La app anota tipo y peso reales que informa el depósito, y los muestra en `/api/archivos/<id>`, también solo con sesión. |
| Dolor u objeción | `BuyerInsight` | Lo que preocupa o frena al comprador, en dos listas ordenables por producto. |
| Conexión con Claude | `McpToken` | El permiso para que Claude use la app en nombre de una persona, desde claude.ai u otro programa de Claude. Se agrega como conector con la dirección `/api/mcp`, dura 30 días y se corta en Equipo. Cada cambio queda a nombre de esa persona. En la base se guarda solo la huella de la llave. |
| Título bloqueado | (se calcula) | Cuando el canal no deja cambiar el título. Lo dicen las ventas de la última medición, con la regla de cada canal; si no hay datos, se marca a mano en la publicación. |
| Estado de la propuesta | `Stage` | Sin propuesta, Propuesta generada, En revisión, Aprobado, Aplicado en canal, Medido. Es el recorrido de la propuesta completa con IA, no la etapa de la publicación. |
| Movimiento de la propuesta | `StageMovement` | Cuándo entró y salió una publicación de cada estado de la propuesta, y quién la movió. |
| Medición | `Measurement` | Cómo estaba una publicación en una fecha: visitas, ventas y lo que tenía cargado. Es el "antes" para comparar. |
| Importación | `ImportRun` | Quién importó qué archivo, cuándo y qué resultó. Se puede deshacer. |
| Relación de columnas | `ImportMapping` | Qué columna de un archivo va a qué campo. Se guarda para reusarla. |
| Cambio de importación | `ImportChange` | Un campo que una importación completó o reemplazó en algo que ya estaba: cómo estaba y cómo quedó. Es lo que permite deshacerla. |
| Propuesta | `Proposal` | Lo que la IA propone cambiar en una publicación, campo por campo, con el motivo y lo que hay que confirmar. No cambia nada hasta que se aprueba. Guarda cómo estaba todo al generarla. |
| Revisión | `Proposal.review` | Donde una persona corrige la propuesta, campo por campo, y la aprueba o la rechaza. Al aprobar se escribe en la ficha y la publicación, y queda qué propuso la IA, qué quedó y qué se editó. No deja aprobar con marcas [A CONFIRMAR: …] ni con un título más largo que el del canal. |
| Aplicación | `ChannelApplication` | Cuándo lo aprobado quedó aplicado en el canal, de qué forma (a mano, por planilla o por API) y qué campos. Es el punto de partida para medir el antes y el después. |
| Planilla de contenido | (archivo) | CSV que se baja desde el Catálogo, con una fila por publicación y lo que la app ya sabe. Se completa a mano o con IA y se vuelve a importar. |
| Regla del estándar | `StandardRule` | Qué tiene que tener una publicación correcta, por cuenta y canal: qué revisa, con qué valor y cuánto pesa. |
| Puntaje | (se calcula) | De 0 a 100: lo que suman las reglas cumplidas sobre lo que suman las que aplican. No se guarda, se calcula cada vez. |

## Cómo está ordenado

- `src/domain/`: producto, publicación, pipeline, etapas, mediciones, estándar, contenido, propuestas y revisión. No sabe nada
  de canales ni de archivos. `pipeline.ts` agrega, mueve y saca publicaciones del pipeline, y avisa las repetidas. `content.ts` compara el contenido que llega con el que hay, campo
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
  API (OAuth): link de permiso, llaves y renovación. Para probar sin el canal real, `MERCADOLIBRE_SUGGEST_URL`,
  `MERCADOLIBRE_API_URL`, `MERCADOLIBRE_LISTING_URL` y `MERCADOLIBRE_AUTH_URL` cambian las direcciones.
  El resto de la app usa la interfaz `ChannelAdapter`.
- `src/lib/files.ts` y `src/lib/file-rules.ts`: los archivos del fabricante en el depósito de Vercel. Sin
  `BLOB_READ_WRITE_TOKEN`, el paso Información muestra los pasos para crearlo. Para probar sin Vercel,
  `VERCEL_BLOB_API_URL` y `NEXT_PUBLIC_VERCEL_BLOB_API_URL` apuntan a un depósito simulado y
  `BLOB_TEST_URL_PREFIX` acepta sus direcciones.
- `src/lib/mcp/`: la conexión con Claude (MCP). `oauth.ts` es el permiso: registro del programa, código de un solo
  uso con PKCE, llaves de 30 días y desconexión. `redirect-allowlist.ts` dice a qué direcciones puede volver el
  permiso (las de Claude, las de la propia computadora y las de `MCP_OAUTH_REDIRECT_URIS`). `read-tools.ts` y
  `write-tools.ts` son las herramientas: una capa fina sobre las mismas consultas y la misma lógica de las
  pantallas, con las mismas reglas y avisos. Nunca devuelven precios ni datos de las conexiones con los canales,
  y cada cambio queda a nombre de la persona que conectó a Claude. No usan la IA de la app. `server.ts` resuelve el protocolo a mano, una respuesta por pedido.
  La pantalla de permiso es `/conectar-claude`.
- `src/importers/`: el único lugar que sabe leer archivos. Lee Excel y CSV en el navegador,
  propone qué columna va a qué campo, traba las columnas confidenciales y traduce cada fila a
  producto, publicación y medición. Al importar vincula por ID de publicación o por SKU. A lo
  que ya estaba solo le completa lo vacío, o también reemplaza si se elige; una celda vacía nunca
  borra nada. Anota de qué importación vino cada cosa y cada cambio, para poder deshacerla.
  También arma la planilla de contenido (`content-sheet.ts`).
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
