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
| Etapa | `Stage` | Importado, Propuesta generada, En revisión, Aprobado, Aplicado en canal, Medido. Vive en la publicación. |
| Movimiento de etapa | `StageMovement` | Cuándo entró y salió una publicación de cada etapa, y quién la movió. |
| Medición | `Measurement` | Cómo estaba una publicación en una fecha: visitas, ventas y lo que tenía cargado. Es el "antes" para comparar. |
| Importación | `ImportRun` | Quién importó qué archivo, cuándo y qué resultó. Se puede deshacer. |
| Relación de columnas | `ImportMapping` | Qué columna de un archivo va a qué campo. Se guarda para reusarla. |

## Cómo está ordenado

- `src/domain/`: producto, publicación y etapas. No sabe nada de canales ni de archivos.
  `moveToStage` es la única forma de cambiar de etapa.
- `src/channels/`: lo único que sabe de cada canal (formato del ID, link, largo del título).
  El resto de la app usa la interfaz `ChannelAdapter`.
- `src/importers/`: el único lugar que sabe leer archivos. Lee Excel y CSV en el navegador,
  propone qué columna va a qué campo, traba las columnas confidenciales y traduce cada fila a
  producto, publicación y medición. Al importar vincula por ID de publicación o por SKU, nunca
  pisa lo que ya está en la app y anota de qué importación vino cada cosa para poder deshacerla.
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
