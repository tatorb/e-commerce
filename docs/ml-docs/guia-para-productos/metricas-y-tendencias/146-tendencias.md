<!-- Fuente: https://developers.mercadolibre.com.ar/es_ar/tendencias -->
<!-- Sección: Guía para productos > Métricas y Tendencias -->

# Tendencias

Última actualización 27/05/2025

## Tendencias

Desde el recurso **/trends** , puedes explorar los 50 productos más populares entre los usuarios de Mercado Libre. La información se actualiza semanalmente y está disponible para los siguientes países: [Argentina](https://tendencias.mercadolibre.com.ar/), [Brasil](https://tendencias.mercadolivre.com.br/), [Chile](https://tendencias.mercadolibre.cl/), [México](https://tendencias.mercadolibre.com.mx/), [Colombia](https://tendencias.mercadolibre.com.co/), [Uruguay](https://tendencias.mercadolibre.com.uy/), [Perú](https://tendencias.mercadolibre.com.pe/).

Este endpoint es útil para identificar tendencias de búsqueda y optimizar estrategias comerciales en función de los intereses actuales de los usuarios.

Además, tienes la opción de filtrar las tendencias por categoría para obtener resultados más específicos.

Nota:

La API proporciona tres criterios para analizar tendencias:

- **Búsquedas con mayor crecimiento:**  productos con el mayor incremento en ingresos durante la última semana.

- **Búsquedas más deseadas:**  productos con el mayor volumen de búsquedas registradas en la última semana.

- **Tendencias más populares:**  productos que han experimentado un aumento significativo en la cantidad de búsquedas en la última semana, comparado con dos semanas atrás.

## Consultar tendencias por país

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/trends/$SITE_ID
```

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/trends/MLA
```

Respuesta:

```
[
    {
        "keyword": "alfombras",
        "url": "https://hogar.mercadolibre.com.ar/textiles-decoracion-alfombras-carpetas/alfombras"
    },
    {
        "keyword": "lavarropa automatico",
        "url": "https://listado.mercadolibre.com.ar/lavado-lavarropas-lavasecarropas/lavarropas-automaticos"
    },
    {
        "keyword": "bmw 330",
        "url": "https://autos.mercadolibre.com.ar/bmw/serie-3/bmw-330"
    },
    {
        "keyword": "ford focus ",
        "url": "https://listado.mercadolibre.com.ar/ford-focus"
    },
    {
        "keyword": "microfono karaoke",
        "url": "https://electronica.mercadolibre.com.ar/audio/microfonos-pies-preamp/microfonos/microfono-karaoke"
    },
    {
        "keyword": "monster high",
        "url": "https://juegos-juguetes.mercadolibre.com.ar/munecos-munecas-bebotes/monster-high"
    },
    {
        "keyword": "cama",
        "url": "https://hogar.mercadolibre.com.ar/dormitorio/camas-respaldos/camas/cama"
    },
    {
        "keyword": "mesa comedor",
        "url": "https://hogar.mercadolibre.com.ar/muebles/mesas-comedor"
    },
    {
        "keyword": "bomba de agua",
        "url": "https://listado.mercadolibre.com.ar/bomba-de-agua"
    },
    {
        "keyword": "alquiler monoambiente",
        "url": "https://listado.mercadolibre.com.ar/alquiler-monoambiente"
    },
    {
        "keyword": "taraborelli usados",
        "url": "https://autos.mercadolibre.com.ar/taraborelli-usados"
    },
    {
        "keyword": "zapatillas botitas hombre",
        "url": "https://zapatillas.mercadolibre.com.ar/calzado/zapatillas-botitas-hombre"
    },
    {
        "keyword": "kia sportage",
        "url": "https://autos.mercadolibre.com.ar/kia/sportage/kia-sportage"
    },
    {
        "keyword": "soldadora tig",
        "url": "https://listado.mercadolibre.com.ar/herramientas-electricas-soldadura-soldadoras/soldadora-tig"
    },
    {
        "keyword": "espejo redondo",
        "url": "https://hogar.mercadolibre.com.ar/decoracion/espejos/espejo-redondo"
    },
    {
        "keyword": "tripode celular",
        "url": "https://listado.mercadolibre.com.ar/tripode-celular"
    },
    {
        "keyword": "go pro",
        "url": "https://camaras-digitales.mercadolibre.com.ar/filmadoras-camaras-accion/go-pro"
    },
    {
        "keyword": "zapatillas jaguar niños",
        "url": "https://listado.mercadolibre.com.ar/zapatillas-jaguar-ni%C3%B1os"
    },
    {
        "keyword": "corset",
        "url": "https://listado.mercadolibre.com.ar/corset"
    },
    {
        "keyword": "chevrolet tracker",
        "url": "https://autos.mercadolibre.com.ar/chevrolet/tracker/chevrolet-tracker"
    },
    {
        "keyword": "pinza amperometrica",
        "url": "https://listado.mercadolibre.com.ar/testers-equipos-medicion-medidores-electricidad-pinzas-amperimetricas/pinza-amperometrica"
    },
    {
        "keyword": "vw fox",
        "url": "https://autos.mercadolibre.com.ar/volkswagen/fox/vw-fox"
    },
    {
        "keyword": "body encaje",
        "url": "https://ropa.mercadolibre.com.ar/ropa-interior-y-de-dormir/ropa-interior/lenceria/body/body-encaje"
    },
    {
        "keyword": "iveco daily",
        "url": "https://vehiculos.mercadolibre.com.ar/iveco-daily"
    },
    {
        "keyword": "brochas maquillaje",
        "url": "https://listado.mercadolibre.com.ar/maquillaje-aplicadores-herramientas-brochas/brochas-maquillaje"
    },
    {
        "keyword": "audio",
        "url": "https://electronica.mercadolibre.com.ar/audio/audio"
    },
    {
        "keyword": "moto g52",
        "url": "https://listado.mercadolibre.com.ar/moto-g52"
    },
    {
        "keyword": "volkswagen vento",
        "url": "https://autos.mercadolibre.com.ar/volkswagen/vento/volkswagen-vento"
    },
    {
        "keyword": "autos 0km",
        "url": "https://autos.mercadolibre.com.ar/autos-0km"
    },
    {
        "keyword": "smart tv 32",
        "url": "https://televisores.mercadolibre.com.ar/televisores/smart-tv-32"
    },
    {
        "keyword": "cinta caminadora electrica",
        "url": "https://deportes.mercadolibre.com.ar/fitness-musculacion-maquinas-cardiovasculares-cintas-correr/cinta-caminadora-electrica"
    },
    {
        "keyword": "samsung a22",
        "url": "https://listado.mercadolibre.com.ar/samsung-a22"
    },
    {
        "keyword": "tocadiscos",
        "url": "https://electronica.mercadolibre.com.ar/audio/hogar/tocadiscos/tocadiscos"
    },
    {
        "keyword": "cinta metrica",
        "url": "https://listado.mercadolibre.com.ar/testers-equipos-medicion-medidores-longitud-cintas-metricas/cinta-metrica"
    },
    {
        "keyword": "pantalón cargo hombre",
        "url": "https://listado.mercadolibre.com.ar/pantal%C3%B3n-cargo-hombre"
    },
    {
        "keyword": "disco ssd 240gb",
        "url": "https://computacion.mercadolibre.com.ar/computacion/disco-ssd-240gb"
    },
    {
        "keyword": "priapus gel",
        "url": "https://listado.mercadolibre.com.ar/priapus-gel"
    },
    {
        "keyword": "sofa",
        "url": "https://hogar.mercadolibre.com.ar/muebles-sillas-sillones-banquetas-sofas/sofa"
    },
    {
        "keyword": "pantuflas peluche",
        "url": "https://zapatos.mercadolibre.com.ar/zapatos-pantuflas/pantuflas-peluche"
    },
    {
        "keyword": "linterna tactica",
        "url": "https://deportes.mercadolibre.com.ar/camping/linternas-faroles/linternas/de-mano/linterna-tactica"
    },
    {
        "keyword": "cerveza",
        "url": "https://listado.mercadolibre.com.ar/cerveza"
    },
    {
        "keyword": "tazas",
        "url": "https://hogar.mercadolibre.com.ar/cocina/bazar/vajilla/tazas/tazas"
    },
    {
        "keyword": "kerastase",
        "url": "https://listado.mercadolibre.com.ar/cuidado-del-cabello-tratamientos/kerastase"
    },
    {
        "keyword": "ford ranger usada",
        "url": "https://autos.mercadolibre.com.ar/ford/ranger/ford-ranger-usadas"
    },
    {
        "keyword": "escritorio gamer",
        "url": "https://listado.mercadolibre.com.ar/escritorio-gamer"
    },
    {
        "keyword": "cartera",
        "url": "https://bolsos.mercadolibre.com.ar/carteras-billeteras/cartera"
    },
    {
        "keyword": "patines nena",
        "url": "https://deportes.mercadolibre.com.ar/patin-skateboard-patines-rollers/patines-nena"
    },
    {
        "keyword": "bicicleta electrica",
        "url": "https://deportes.mercadolibre.com.ar/bicicletas-y-ciclismo/bicicletas/adultos/electricas/bicicleta-electrica"
    },
    {
        "keyword": "heladera samsung",
        "url": "https://listado.mercadolibre.com.ar/electrodomesticos/heladeras-freezers/heladeras/heladera-samsung"
    },
    {
        "keyword": "pizarra magica",
        "url": "https://juegos-juguetes.mercadolibre.com.ar/dibujo-pintura-manualidades-atriles-pizarras-pizarrones/pizarra-magica"
    },
    {
        "keyword": "suplementos proteinas",
        "url": "https://deportes.mercadolibre.com.ar/suplementos-shakers-deportivos/proteina"
    },
    {
        "keyword": "motorola e7",
        "url": "https://listado.mercadolibre.com.ar/motorola-e7"
    },
    {
        "keyword": "ventilador de techo",
        "url": "https://listado.mercadolibre.com.ar/electrodomesticos/climatizacion/ventiladores/ventilador-techo"
    },
    {
        "keyword": "moto g60s",
        "url": "https://listado.mercadolibre.com.ar/moto-g60s"
    },
    {
        "keyword": "termotanque eléctrico",
        "url": "https://listado.mercadolibre.com.ar/termotanque-el%C3%A9ctrico"
    },
    {
        "keyword": "guantes de arquero",
        "url": "https://deportes.mercadolibre.com.ar/futbol-ropa-calzado-guantes-arquero/guantes-de-arquero"
    },
    {
        "keyword": "juego sanitarios",
        "url": "https://listado.mercadolibre.com.ar/construccion-banos-sanitarios/juego-sanitarios"
    },
    {
        "keyword": "alquiler temporario",
        "url": "https://listado.mercadolibre.com.ar/alquiler-temporario"
    },
    {
        "keyword": "yamaha xtz 250",
        "url": "https://motos.mercadolibre.com.ar/enduro/yamaha/xtz-250/yamaha-xtz-250"
    },
    {
        "keyword": "lavarropas samsung",
        "url": "https://listado.mercadolibre.com.ar/lavado-lavarropas-lavasecarropas/lavarropas-samsung"
    },
    {
        "keyword": "cocina industrial",
        "url": "https://listado.mercadolibre.com.ar/industrias-oficinas/gastronomia/hornos-y-cocinas/cocinas-industriale/cocina-industrial"
    },
    {
        "keyword": "reloj rolex",
        "url": "https://relojes.mercadolibre.com.ar/relojes-pulsera/rolex"
    },
    {
        "keyword": "xtz 250",
        "url": "https://motos.mercadolibre.com.ar/enduro/yamaha/xtz-250/xtz-250"
    },
    {
        "keyword": "paba electrica",
        "url": "https://listado.mercadolibre.com.ar/pequenos-electrodomesticos-cocina-jarras-electricas/paba-electrica"
    },
    {
        "keyword": "ducati",
        "url": "https://motos.mercadolibre.com.ar/ducati/ducati"
    },
    {
        "keyword": "borcegos mujer cuero",
        "url": "https://zapatos.mercadolibre.com.ar/zapatos-botas-botinet/borcegos-mujer-cuero"
    },
    {
        "keyword": "gabinete gamer",
        "url": "https://computacion.mercadolibre.com.ar/componentes-pc/gabinetes/gabinetes/gabinete-gamer"
    },
    {
        "keyword": "yamaha ybr 125",
        "url": "https://motos.mercadolibre.com.ar/naked/yamaha/ybr-125/yamaha-ybr-125"
    },
    {
        "keyword": "cargador iphone",
        "url": "https://celulares.mercadolibre.com.ar/accesorios/cargador-iphone"
    },
    {
        "keyword": "billetera de mujer",
        "url": "https://bolsos.mercadolibre.com.ar/carteras-billeteras-monederos/billeteras-mujer"
    },
    {
        "keyword": "muñeca barbie",
        "url": "https://juegos-juguetes.mercadolibre.com.ar/mu%C3%B1ecas-barbie"
    },
    {
        "keyword": "televisores usados",
        "url": "https://televisores.mercadolibre.com.ar/televisores/televisores-usados"
    },
    {
        "keyword": "smart tv 55 pulgadas",
        "url": "https://televisores.mercadolibre.com.ar/televisores/smart-tv-55-pulgadas"
    },
    {
        "keyword": "sexshopp juguetes",
        "url": "https://listado.mercadolibre.com.ar/sexshopp-juguetes"
    },
    {
        "keyword": "zapatilla deportiva mujer",
        "url": "https://zapatillas.mercadolibre.com.ar/calzado/zapatillas-deportivas-mujer"
    },
    {
        "keyword": "benelli trk 502",
        "url": "https://motos.mercadolibre.com.ar/touring/benelli/benelli-trk-502"
    },
    {
        "keyword": "laptop",
        "url": "https://computacion.mercadolibre.com.ar/laptops/notebooks/laptop"
    },
    {
        "keyword": "yerba",
        "url": "https://listado.mercadolibre.com.ar/alimentos-bebidas/comestibles/infusiones/yerba-mate/yerba"
    },
    {
        "keyword": "sweaters hombre",
        "url": "https://ropa.mercadolibre.com.ar/saquitos-sweaters-chalecos/sweaters/sweaters-hombre"
    },
    {
        "keyword": "pintura latex",
        "url": "https://listado.mercadolibre.com.ar/pintureria-pinturas-esmaltes-latex/pintura-latex"
    },
    {
        "keyword": "anillos",
        "url": "https://joyas.mercadolibre.com.ar/joyas/anillos/anillos"
    },
    {
        "keyword": "estabilizador",
        "url": "https://listado.mercadolibre.com.ar/estabilizador"
    },
    {
        "keyword": "luz led",
        "url": "https://listado.mercadolibre.com.ar/luz-led"
    },
    {
        "keyword": "juguetes ",
        "url": "https://listado.mercadolibre.com.ar/juguetes"
    },
    {
        "keyword": "estante flotante",
        "url": "https://hogar.mercadolibre.com.ar/muebles-cubos-repisas/estantes-flotantes"
    },
    {
        "keyword": "celular xiaomi",
        "url": "https://celulares.mercadolibre.com.ar/xiaomi"
    },
    {
        "keyword": "dodge journey",
        "url": "https://autos.mercadolibre.com.ar/dodge/journey/dodge-journey"
    },
    {
        "keyword": "bici rodado 29",
        "url": "https://deportes.mercadolibre.com.ar/bicicletas-y-ciclismo/bicicletas/bicicleta-rodado-29"
    },
    {
        "keyword": "xbox series x",
        "url": "https://listado.mercadolibre.com.ar/xbox-series-x"
    },
    {
        "keyword": "zapatillas nike air max",
        "url": "https://zapatillas.mercadolibre.com.ar/calzado/zapatillas-nike-air-max"
    },
    {
        "keyword": "camperas",
        "url": "https://ropa.mercadolibre.com.ar/campera"
    },
    {
        "keyword": "exprimidor electrico",
        "url": "https://listado.mercadolibre.com.ar/para-cocina-preparacion-bebidas-exprimidores-electricos/exprimidor-electrico"
    },
    {
        "keyword": "iphone 6",
        "url": "https://celulares.mercadolibre.com.ar/iphone-6"
    },
    {
        "keyword": "iphone 7 plus usados",
        "url": "https://celulares.mercadolibre.com.ar/iphone-7-plus-usado"
    },
    {
        "keyword": "samsung a02",
        "url": "https://listado.mercadolibre.com.ar/samsung-a02"
    },
    {
        "keyword": "salamandras usadas",
        "url": "https://listado.mercadolibre.com.ar/electrodomesticos/climatizacion/climatizadores/salamandras/salamandras-usadas"
    },
    {
        "keyword": "zapatillas adidas niño",
        "url": "https://listado.mercadolibre.com.ar/zapatillas-adidas-ni%C3%B1os"
    },
    {
        "keyword": "rack tv flotante",
        "url": "https://hogar.mercadolibre.com.ar/muebles-tv/rack-tv-flotante"
    },
    {
        "keyword": "caja registradora",
        "url": "https://listado.mercadolibre.com.ar/caja-registradora"
    },
    {
        "keyword": "xbox one",
        "url": "https://videojuegos.mercadolibre.com.ar/consolas/xbox-one"
    },
    {
        "keyword": "ferrari",
        "url": "https://autos.mercadolibre.com.ar/ferrari/ferrari"
    }
]
```

**Campos de la respuesta**

Este servicio devuelve un arreglo de 50 objetos en formato JSON, organizado de la siguiente manera:

- **Primeros 10 elementos:**  corresponden a las búsquedas con mayor crecimiento.

- **Siguientes 20 elementos:**  representan las búsquedas más deseadas por los usuarios.

- **Últimos 20 elementos:**  muestran las tendencias más populares de la semana.

Cada objeto dentro del arreglo contiene los siguientes campos:

- **keyword:**  término o producto que los usuarios han buscado.

- **url:**  enlace que dirige a los resultados de búsqueda relacionados con ese término.

## Consultar tendencias por país y categoría

Si deseas explorar tendencias dentro de una categoría específica, debes incluir el parámetro **{category_id}**  en tu solicitud, además del parámetro de país.

Para encontrar los IDs de categoría disponibles por país, consulta la siguiente documentación: [Categorías por sitio](https://developers.mercadolibre.com.ar/es_ar/categoriza-productos#).

Ejemplo:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/trends/$SITE_ID/$CATEGORY_ID
```

Llamada:

```
curl -X GET -H 'Authorization: Bearer $ACCESS_TOKEN' https://api.mercadolibre.com/trends/MLA/MLA1246
```

Respuesta:

```
[
   {
       "keyword": "mesa manicura plegable",
       "url": "https://listado.mercadolibre.com.ar/mesa-manicura-plegable#trend"
   },
   {
       "keyword": "afeitadora cleancut",
       "url": "https://listado.mercadolibre.com.ar/afeitadora-cleancut#trend"
   },
   {
       "keyword": "afeitadora gama",
       "url": "https://listado.mercadolibre.com.ar/afeitadora-gama#trend"
   },
   {
       "keyword": "cepillo brushing",
       "url": "https://listado.mercadolibre.com.ar/cepillo-brushing#trend"
   },
   {
       "keyword": "dd2 regalos",
       "url": "https://listado.mercadolibre.com.ar/dd2-regalos#trend"
   },
   {
       "keyword": "kit de barberia",
       "url": "https://listado.mercadolibre.com.ar/kit-de-barberia#trend"
   },
   {
       "keyword": "avon",
       "url": "https://listado.mercadolibre.com.ar/avon#trend"
   },
   {
       "keyword": "piedra alumbre",
       "url": "https://listado.mercadolibre.com.ar/piedra-alumbre#trend"
   },
   {
       "keyword": "aceite para masajes",
       "url": "https://listado.mercadolibre.com.ar/aceite-para-masajes#trend"
   },
   {
       "keyword": "punta de diamante cosmetologia",
       "url": "https://listado.mercadolibre.com.ar/punta-de-diamante-cosmetologia#trend"
   },
   {
       "keyword": "farmacity",
       "url": "https://listado.mercadolibre.com.ar/farmacity#trend"
   },
   {
       "keyword": "natura",
       "url": "https://listado.mercadolibre.com.ar/natura#trend"
   },
   {
       "keyword": "loreal",
       "url": "https://listado.mercadolibre.com.ar/loreal#trend"
   },
   {
       "keyword": "dermapen",
       "url": "https://listado.mercadolibre.com.ar/dermapen#trend"
   },
   {
       "keyword": "idraet",
       "url": "https://listado.mercadolibre.com.ar/idraet#trend"
   },
   {
       "keyword": "farmacia selma",
       "url": "https://listado.mercadolibre.com.ar/farmacia-selma#trend"
   },
   {
       "keyword": "philips one blade",
       "url": "https://listado.mercadolibre.com.ar/philips-one-blade#trend"
   },
   {
       "keyword": "garnier",
       "url": "https://listado.mercadolibre.com.ar/garnier#trend"
   },
   {
       "keyword": "labial",
       "url": "https://listado.mercadolibre.com.ar/labial#trend"
   },
   {
       "keyword": "corta barba",
       "url": "https://listado.mercadolibre.com.ar/corta-barba#trend"
   },
   {
       "keyword": "recortadora barba",
       "url": "https://listado.mercadolibre.com.ar/recortadora-barba#trend"
   },
   {
       "keyword": "lancome",
       "url": "https://listado.mercadolibre.com.ar/lancome#trend"
   },
   {
       "keyword": "desodorante",
       "url": "https://listado.mercadolibre.com.ar/desodorante#trend"
   },
   {
       "keyword": "crema",
       "url": "https://listado.mercadolibre.com.ar/crema#trend"
   },
   {
       "keyword": "las margaritas",
       "url": "https://listado.mercadolibre.com.ar/las-margaritas#trend"
   },
   {
       "keyword": "revlon",
       "url": "https://listado.mercadolibre.com.ar/revlon#trend"
   },
   {
       "keyword": "dove",
       "url": "https://listado.mercadolibre.com.ar/dove#trend"
   },
   {
       "keyword": "electroporador portatil",
       "url": "https://listado.mercadolibre.com.ar/electroporador-portatil#trend"
   },
   {
       "keyword": "gillette",
       "url": "https://listado.mercadolibre.com.ar/gillette#trend"
   },
   {
       "keyword": "hisopos",
       "url": "https://listado.mercadolibre.com.ar/hisopos#trend"
   },
   {
       "keyword": "rasuradora",
       "url": "https://listado.mercadolibre.com.ar/rasuradora#trend"
   },
   {
       "keyword": "mesa manicura",
       "url": "https://listado.mercadolibre.com.ar/mesa-manicura#trend"
   },
   {
       "keyword": "barberia",
       "url": "https://listado.mercadolibre.com.ar/barberia#trend"
   },
   {
       "keyword": "las margaritas peluqueria",
       "url": "https://listado.mercadolibre.com.ar/las-margaritas-peluqueria#trend"
   },
   {
       "keyword": "mesa manicuria",
       "url": "https://listado.mercadolibre.com.ar/mesa-manicuria#trend"
   },
   {
       "keyword": "dermapenn",
       "url": "https://listado.mercadolibre.com.ar/dermapenn#trend"
   },
   {
       "keyword": "voluminizador labial",
       "url": "https://listado.mercadolibre.com.ar/voluminizador-labial#trend"
   },
   {
       "keyword": "productos natura",
       "url": "https://listado.mercadolibre.com.ar/productos-natura#trend"
   },
   {
       "keyword": "perfilador cejas",
       "url": "https://listado.mercadolibre.com.ar/perfilador-cejas#trend"
   },
   {
       "keyword": "kit barberia",
       "url": "https://listado.mercadolibre.com.ar/kit-barberia#trend"
   },
   {
       "keyword": "afeitadoras",
       "url": "https://listado.mercadolibre.com.ar/afeitadoras#trend"
   },
   {
       "keyword": "mesa de manicura",
       "url": "https://listado.mercadolibre.com.ar/mesa-de-manicura#trend"
   },
   {
       "keyword": "peluqueria",
       "url": "https://listado.mercadolibre.com.ar/peluqueria#trend"
   },
   {
       "keyword": "mary kay",
       "url": "https://listado.mercadolibre.com.ar/mary-kay#trend"
   },
   {
       "keyword": "dd2",
       "url": "https://listado.mercadolibre.com.ar/dd2#trend"
   },
   {
       "keyword": "mesa para manicura",
       "url": "https://listado.mercadolibre.com.ar/mesa-para-manicura#trend"
   },
   {
       "keyword": "henna",
       "url": "https://listado.mercadolibre.com.ar/henna#trend"
   },
   {
       "keyword": "clean cut",
       "url": "https://listado.mercadolibre.com.ar/clean-cut#trend"
   },
   {
       "keyword": "afeitadora wahl",
       "url": "https://listado.mercadolibre.com.ar/afeitadora-wahl#trend"
   },
   {
       "keyword": "maquina afeitar",
       "url": "https://listado.mercadolibre.com.ar/maquina-afeitar#trend"
   }
]
```
