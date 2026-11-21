-- El paso Promociones del pipeline, después de Precio: las etiquetas, el almanaque y la grilla por forma de cobro.
ALTER TYPE "PipelineStep" ADD VALUE 'PROMOTIONS' AFTER 'PRICE';
