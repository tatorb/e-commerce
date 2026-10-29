"""Cada paso cumple la regla de oro: corrige lo que hay, no inventa nada."""

import io

import numpy as np
import pytest
from PIL import Image

from conftest import foto_de_prueba
from mrb_imagenes.ajustes import leer_ajustes
from mrb_imagenes.imagen import Foto, a_lineal, luminancia
from mrb_imagenes.pasos.blancos import Blancos, muestra_de_fondo
from mrb_imagenes.pasos.color import Color
from mrb_imagenes.pasos.exportar import Exportar
from mrb_imagenes.pasos.fondo import Fondo
from mrb_imagenes.pasos.lente import Lente
from mrb_imagenes.pasos.luces import Luces, curva
from mrb_imagenes.pasos.perspectiva import Perspectiva
from mrb_imagenes.pasos.recorte import Recorte

AJUSTES = leer_ajustes()


def correr(paso, foto, valores=None):
    medicion = paso.medir(foto, AJUSTES)
    usados, _ = paso.limitar(valores if valores is not None else medicion.sugeridos, AJUSTES)
    return medicion, paso.aplicar(foto, usados, AJUSTES, medicion)


# ── 1. Lente


def test_lente_se_salta_sin_datos_o_en_telefonos(foto):
    medicion, r = correr(Lente(), foto)
    assert r.salteado and "no trae datos de cámara" in r.nota
    foto.datos["camara"] = {"marca": "Apple", "modelo": "iPhone 13 Pro Max", "lente": "back camera", "focal": 5.7}
    _, r = correr(Lente(), foto)
    assert r.salteado and "teléfono" in r.nota
    assert r.foto is foto


def test_lente_corrige_sin_dejar_zonas_sin_foto():
    import lensfunpy

    db = lensfunpy.Database()
    cam = db.find_cameras("Canon", "Canon EOS 5D Mark III")[0]
    lente = next(l for l in db.find_lenses(cam, "Canon", "EF 24-105mm f/4L IS USM"))
    foto = foto_de_prueba(400, 600)
    foto.datos["camara"] = {
        "marca": "Canon",
        "modelo": "Canon EOS 5D Mark III",
        "marca_lente": "Canon",
        "lente": lente.model,
        "focal": 24.0,
        "apertura": 4.0,
    }
    medicion, r = correr(Lente(), foto)
    assert not r.salteado, r.nota
    assert "perfil_encontrado" in medicion.medidas
    # Ningún píxel negro: las zonas sin foto se recortaron, no se rellenaron.
    assert r.foto.rgb.min() > 0.05
    assert r.foto.ancho <= foto.ancho and r.foto.alto <= foto.alto


# ── 2. Perspectiva


def test_perspectiva_mide_la_inclinacion_y_endereza_sin_esquinas_vacias():
    foto = foto_de_prueba(inclinacion=3.0)
    medicion, r = correr(Perspectiva(), foto)
    assert medicion.medidas["torcida_grados"] == pytest.approx(3.0, abs=0.6)
    assert r.valores["giro"] == pytest.approx(-3.0, abs=0.6)
    assert r.foto.rgb.min() > 0.05
    assert r.foto.ancho < foto.ancho
    # Después de girar, la línea queda derecha.
    medida, _ = correr(Perspectiva(), r.foto, {"giro": 0})
    assert abs(medida.medidas["torcida_grados"]) < 0.6


def test_perspectiva_sin_valores_no_toca_la_foto(foto):
    _, r = correr(Perspectiva(), foto, {"giro": 0, "vertical": 0, "horizontal": 0})
    assert r.foto is foto


def test_perspectiva_vertical_no_deja_esquinas_vacias(foto):
    _, r = correr(Perspectiva(), foto, {"giro": 0, "vertical": 8, "horizontal": -4})
    assert r.foto.rgb.min() > 0.05


def test_perspectiva_gira_de_a_90_grados_sin_tocar_los_pixeles():
    foto = foto_de_prueba(30, 40)
    _, r = correr(Perspectiva(), foto, {"cuartos": 1, "giro": 0, "vertical": 0, "horizontal": 0})
    # En sentido horario: lo que estaba abajo a la izquierda queda arriba a la izquierda.
    assert (r.foto.alto, r.foto.ancho) == (40, 30)
    assert np.array_equal(r.foto.rgb, np.rot90(foto.rgb, k=-1))
    assert np.array_equal(r.foto.rgb[0, 0], foto.rgb[29, 0])
    assert "90°" in r.nota and not r.salteado
    _, r = correr(Perspectiva(), foto, {"cuartos": 2})
    assert np.array_equal(r.foto.rgb, foto.rgb[::-1, ::-1])
    _, r = correr(Perspectiva(), foto, {"cuartos": 3})
    assert np.array_equal(r.foto.rgb, np.rot90(foto.rgb, k=1))


def test_perspectiva_endereza_despues_de_girar_90_grados():
    foto = foto_de_prueba(inclinacion=3.0)
    _, solo = correr(Perspectiva(), foto, {"cuartos": 1, "giro": 0})
    _, r = correr(Perspectiva(), foto, {"cuartos": 1, "giro": -3.0})
    # El giro fino se hace sobre la foto ya girada, y recorta hacia adentro.
    assert r.foto.alto < solo.foto.alto and r.foto.ancho < solo.foto.ancho
    assert r.foto.alto > r.foto.ancho
    assert r.foto.rgb.min() > 0.05


def test_cuartos_de_vuelta_dan_la_vuelta_entera():
    paso = Perspectiva()
    assert paso.limitar({"cuartos": -1}, AJUSTES)[0]["cuartos"] == 3
    assert paso.limitar({"cuartos": 5}, AJUSTES)[0]["cuartos"] == 1
    assert paso.limitar({}, AJUSTES)[0]["cuartos"] == 0


# ── 3. Blancos


def test_blancos_deja_el_fondo_neutro(foto):
    medicion, r = correr(Blancos(), foto)
    assert medicion.medidas["tono_del_fondo"] > 0  # tiraba a cálido
    fondo = np.median(muestra_de_fondo(r.foto.rgb), axis=0)
    assert np.abs(fondo - fondo.mean()).max() < 0.01


def test_blancos_es_la_misma_regla_para_cada_pixel(foto):
    _, r = correr(Blancos(), foto)
    # Dos píxeles del mismo color salen del mismo color.
    f = foto.rgb.copy()
    f[0, 0] = f[5, 5] = [0.5, 0.4, 0.3]
    _, r = correr(Blancos(), Foto(rgb=f, datos={}))
    assert np.array_equal(r.foto.rgb[0, 0], r.foto.rgb[5, 5])


def test_blancos_en_cero_no_toca_la_foto(foto):
    _, r = correr(Blancos(), foto, {"intensidad": 0, "temperatura": 0, "tinte": 0})
    assert r.foto is foto


# ── 4. Luces


def test_curvas_no_dan_vuelta_los_tonos():
    l = np.linspace(0, 1, 2001, dtype=np.float32)
    for s, h in [(60, 0), (0, 60), (100, 100)]:
        assert (np.diff(curva(l, s, h)) >= -1e-6).all()


def test_luces_cambia_el_brillo_pero_no_el_color(foto):
    _, r = correr(Luces(), foto, {"exposicion": 0.3, "sombras": 30, "luces": 20, "claridad": 25})
    antes, despues = a_lineal(foto.rgb), a_lineal(r.foto.rgb)
    ok = (despues.max(axis=-1) < 0.99) & (antes.min(axis=-1) > 0.02)
    proporcion_antes = antes[ok][:, 0] / antes[ok][:, 1]
    proporcion_despues = despues[ok][:, 0] / despues[ok][:, 1]
    assert np.abs(proporcion_antes - proporcion_despues).max() < 0.01


def test_luces_en_cero_no_toca_la_foto(foto):
    _, r = correr(Luces(), foto, {"exposicion": 0, "sombras": 0, "luces": 0, "claridad": 0})
    assert r.foto is foto


# ── 5. Color


def test_color_no_cambia_el_brillo(foto):
    _, r = correr(Color(), foto, {"saturacion": 20, "vivacidad": 10})
    assert np.abs(luminancia(a_lineal(r.foto.rgb)) - luminancia(a_lineal(foto.rgb))).max() < 2e-3
    assert r.foto.rgb.std(axis=-1).mean() > foto.rgb.std(axis=-1).mean()


# ── 6. Fondo


def _mascara_rectangulo(rgb):
    alto, ancho = rgb.shape[:2]
    m = np.zeros((alto, ancho), np.float32)
    m[int(alto * 0.3) : int(alto * 0.7), int(ancho * 0.32) : int(ancho * 0.68)] = 1
    m[10:14, 10:14] = 1  # una mota suelta
    return m


def test_quitar_fondo_no_cambia_ningun_color(foto):
    paso = Fondo(_mascara_rectangulo)
    _, r = correr(paso, foto)
    assert r.foto.rgb is foto.rgb or np.array_equal(r.foto.rgb, foto.rgb)
    assert r.foto.alfa is not None and r.mascara is not None
    # La mota suelta se borra con el mínimo por defecto.
    assert r.foto.alfa[12, 12] == 0
    assert r.medidas["piezas"] == 1 and r.medidas["motas_sacadas"] == 1


def test_quitar_fondo_sin_minimo_conserva_las_piezas_chicas(foto):
    _, r = correr(Fondo(_mascara_rectangulo), foto, {"detalle": 0, "refinar_bordes": 0, "motas": 0, "dureza": 0})
    assert r.foto.alfa[12, 12] == 1
    assert r.medidas["piezas"] == 2


# ── 7. Recorte


def _con_fondo_quitado(alto=600, ancho=800, caja=(500, 200, 780, 400)):
    foto = foto_de_prueba(alto, ancho)
    alfa = np.zeros((alto, ancho), np.float32)
    x0, y0, x1, y1 = caja
    alfa[y0:y1, x0:x1] = 1
    return Foto(rgb=foto.rgb, alfa=alfa, datos={})


def test_recorte_cuadrado_con_margen_parejo_y_lienzo_vacio():
    foto = _con_fondo_quitado()
    _, r = correr(Recorte(), foto, {"margen": 10})
    alto, ancho = r.foto.rgb.shape[:2]
    assert alto == ancho
    filas = np.where((r.foto.alfa >= 0.5).any(axis=1))[0]
    cols = np.where((r.foto.alfa >= 0.5).any(axis=0))[0]
    izq, der = cols[0], ancho - 1 - cols[-1]
    arr, aba = filas[0], alto - 1 - filas[-1]
    assert abs(izq - der) <= 1 and abs(arr - aba) <= 1
    assert min(izq, arr) >= int(ancho * 0.1) - 1
    # La pieza estaba pegada al borde derecho: se agregó lienzo vacío, transparente.
    assert r.medidas["lienzo_agregado"]
    assert r.foto.alfa[alto // 2, -2] == 0


def test_recorte_solo_copia_pixeles():
    foto = _con_fondo_quitado(caja=(300, 200, 500, 380))
    _, r = correr(Recorte(), foto, {"margen": 8})
    filas = np.where((r.foto.alfa >= 0.5).any(axis=1))[0]
    cols = np.where((r.foto.alfa >= 0.5).any(axis=0))[0]
    copia = r.foto.rgb[filas[0] : filas[-1] + 1, cols[0] : cols[-1] + 1]
    assert np.array_equal(copia, foto.rgb[200:380, 300:500])
    assert not r.medidas["lienzo_agregado"]


def test_recorte_avisa_si_la_foto_queda_chica():
    foto = _con_fondo_quitado(caja=(300, 200, 500, 380))
    _, r = correr(Recorte(), foto, {"margen": 8})
    assert "no se agranda" in r.nota.lower()


# ── 8. Exportar


def test_exportar_png_transparente_y_jpg_blanco_sin_bajar_resolucion():
    foto = _con_fondo_quitado(caja=(300, 200, 500, 380))
    _, recortada = correr(Recorte(), foto, {"margen": 8})
    _, r = correr(Exportar(), recortada.foto)
    png = Image.open(io.BytesIO(r.archivos["final.png"]))
    jpg = Image.open(io.BytesIO(r.archivos["final.jpg"]))
    lado = recortada.foto.ancho
    assert png.mode == "RGBA" and png.size == (lado, lado)
    assert jpg.mode == "RGB" and jpg.size == (lado, lado)
    assert png.getpixel((0, 0))[3] == 0
    assert jpg.getpixel((0, 0)) == (255, 255, 255)
    # Sin datos de la cámara (ni ubicación) y con perfil sRGB.
    assert not jpg.getexif() and not png.getexif()
    assert jpg.info.get("icc_profile") and png.info.get("icc_profile")


def test_la_segunda_pasada_mira_solo_la_zona_del_producto(foto):
    vistas = []

    def segmentador(rgb):
        vistas.append(rgb.shape[:2])
        m = _mascara_rectangulo(rgb) if len(vistas) == 1 else np.ones(rgb.shape[:2], np.float32)
        if len(vistas) > 1:
            m[: rgb.shape[0] // 2, : rgb.shape[1] // 2] = 0  # la segunda pasada separa mejor una parte
        return m

    paso = Fondo(segmentador)
    medicion = paso.medir(foto, AJUSTES)
    assert len(vistas) == 2 and vistas[1][0] < vistas[0][0]
    assert medicion.medidas["segunda_pasada_disponible"]
    con, _ = paso.limitar({"detalle": 1, "refinar_bordes": 0, "motas": 0, "dureza": 0}, AJUSTES)
    sin, _ = paso.limitar({"detalle": 0, "refinar_bordes": 0, "motas": 0, "dureza": 0}, AJUSTES)
    a = paso.aplicar(foto, con, AJUSTES, medicion).foto.alfa
    b = paso.aplicar(foto, sin, AJUSTES, medicion).foto.alfa
    assert not np.array_equal(a, b)
    # Fuera de la zona del producto, la segunda pasada no agrega nada.
    assert a[12, 12] == 0


def _pieza_grande(rgb):
    """Una pieza que llena casi toda su caja, como un pistón de cerca."""
    alto, ancho = rgb.shape[:2]
    m = np.zeros((alto, ancho), np.float32)
    m[int(alto * 0.25) : int(alto * 0.75), int(ancho * 0.25) : int(ancho * 0.75)] = 1
    return m


def test_la_segunda_pasada_deja_entorno_alrededor_del_producto(foto):
    vistas = []

    def segmentador(rgb):
        vistas.append(rgb.shape[:2])
        return _pieza_grande(rgb) if len(vistas) == 1 else np.ones(rgb.shape[:2], np.float32)

    medicion = Fondo(segmentador).medir(foto, AJUSTES)
    (alto, ancho), (alto_zona, ancho_zona) = vistas
    assert alto_zona < alto and ancho_zona < ancho
    # El producto ocupa a lo sumo la mitad de lo que mira la segunda pasada.
    assert (alto * ancho / 4) <= 0.5 * alto_zona * ancho_zona
    assert medicion.medidas["segunda_pasada_disponible"]


def test_la_segunda_pasada_se_descarta_si_pierde_parte_del_producto(foto):
    def segmentador(rgb):
        m = _pieza_grande(rgb)
        if rgb.shape[:2] != foto.rgb.shape[:2]:
            m[:, rgb.shape[1] // 2 :] = 0  # la segunda pasada se queda con media pieza
        return m

    paso = Fondo(segmentador)
    medicion = paso.medir(foto, AJUSTES)
    assert medicion.medidas["segunda_pasada_descartada"]
    assert not medicion.medidas["segunda_pasada_disponible"]
    _, r = correr(paso, foto, {"detalle": 1, "refinar_bordes": 0, "motas": 0, "dureza": 0})
    # La pieza queda entera, con la máscara de la primera pasada.
    assert r.foto.alfa[300, 550] == 1 and r.medidas["piezas"] == 1
    assert "segunda pasada" in r.nota
    assert np.array_equal(r.foto.rgb, foto.rgb)


def _pieza_con_huecos(rgb):
    alto, ancho = rgb.shape[:2]
    m = np.zeros((alto, ancho), np.float32)
    m[100:300, 100:400] = 1
    m[180:200, 200:230] = 0  # un reflejo que el modelo tomó por fondo
    m[150:250, 500:700] = 1
    m[170:230, 520:680] = 0  # el centro de un aro: es fondo de verdad
    return m


def test_rellenar_huecos_solo_tapa_los_chicos_y_no_cambia_colores(foto):
    paso = Fondo(_pieza_con_huecos)
    valores = {"detalle": 0, "refinar_bordes": 0, "motas": 0, "dureza": 0}
    _, sin = correr(paso, foto, {**valores, "rellenar_huecos": 0})
    _, con = correr(paso, foto, {**valores, "rellenar_huecos": 1})
    assert sin.foto.alfa[190, 215] == 0
    assert con.foto.alfa[190, 215] == 1
    assert con.foto.alfa[200, 600] == 0  # el centro del aro sigue transparente
    assert con.foto.alfa[50, 50] == 0  # y el fondo de afuera también
    assert con.medidas["huecos_rellenados"] == 1
    assert np.array_equal(con.foto.rgb, foto.rgb)


def test_el_modelo_del_fondo_se_elige_por_la_memoria(monkeypatch):
    from mrb_imagenes.pasos import fondo

    monkeypatch.delenv("MRB_MODELO_FONDO", raising=False)
    monkeypatch.setattr(fondo, "memoria_gb", lambda: 8.0)
    assert fondo.elegir_modelo() == "isnet-general-use"
    monkeypatch.setattr(fondo, "memoria_gb", lambda: 16.0)
    assert fondo.elegir_modelo() == "birefnet-general"
    assert fondo.elegir_modelo("liviano") == "isnet-general-use"
    monkeypatch.setenv("MRB_MODELO_FONDO", "liviano")
    assert fondo.elegir_modelo() == "isnet-general-use"


def test_la_claridad_da_lo_mismo_en_chico_y_en_grande():
    """La app la calcula sobre una copia chica para editar en vivo: tiene que coincidir con la Mac."""
    import cv2

    from mrb_imagenes.pasos.luces import _FUERZA, aplicar_curvas, celdas_de, contraste_local, curvas_locales

    grande = foto_de_prueba(1800, 2400)
    l = luminancia(a_lineal(grande.rgb))
    hecho = contraste_local(l, 40)
    assert np.abs(hecho - l).mean() > 0.002  # cambia algo
    chica = cv2.resize(l, (1200, 900), interpolation=cv2.INTER_AREA)
    curvas, cy, cx = curvas_locales(chica, 5.0, celdas_de(1800, 2400))
    en_chico = np.clip(chica + 0.4 * _FUERZA * (aplicar_curvas(chica, curvas, cy, cx) - chica), 0, 1)
    achicado = cv2.resize(hecho, (1200, 900), interpolation=cv2.INTER_AREA)
    assert np.abs(en_chico - achicado).mean() < 0.002


# ── 6. Fondo: recuperar partes


def _caja_con_cuadricula(alto=600, ancho=800, linea=4, lado=40, con_borde_arriba=True):
    """Una caja azul con cuadrícula blanca sobre fondo gris, y la máscara que haría un modelo que la toma por malla."""
    rgb = np.full((alto, ancho, 3), 0.80, np.float32)
    y0, y1, x0, x1 = 150, 450, 150, 650
    rgb[y0:y1, x0:x1] = [0.10, 0.16, 0.60]
    lineas = np.zeros((alto, ancho), bool)
    for x in range(x0, x1, lado):
        lineas[y0:y1, x : x + linea] = True
    for y in range(y0 if con_borde_arriba else y0 + lado, y1, lado):
        lineas[y : y + linea, x0:x1] = True
    lineas[y0:y1, x1 - linea : x1] = True
    lineas[y1 - linea : y1, x0:x1] = True
    rgb[lineas] = [0.93, 0.93, 0.94]
    # El modelo se queda con las líneas y deja transparentes los cuadrados azules.
    mascara = lineas.astype(np.float32)
    return Foto(rgb=rgb, datos={"camara": {}}), mascara, (y0, y1, x0, x1)


SIN_EXTRAS = {"detalle": 0, "refinar_bordes": 0, "rellenar_huecos": 0, "motas": 0, "dureza": 0}


def test_recuperar_partes_devuelve_los_cuadrados_de_una_caja_con_cuadricula():
    foto, mascara, (y0, y1, x0, x1) = _caja_con_cuadricula()
    paso = Fondo(lambda rgb: mascara)
    _, sin = correr(paso, foto, {**SIN_EXTRAS, "recuperar": 0})
    _, con = correr(paso, foto, {**SIN_EXTRAS, "recuperar": 1})
    centro_de_un_cuadrado = (y0 + 60, x0 + 100)
    assert sin.foto.alfa[centro_de_un_cuadrado] == 0
    assert con.foto.alfa[centro_de_un_cuadrado] == 1
    # La caja entera queda opaca, y el fondo de afuera sigue transparente.
    assert (con.foto.alfa[y0 + 4 : y1 - 4, x0 + 4 : x1 - 4] == 1).mean() > 0.99
    assert con.foto.alfa[50, 50] == 0 and con.foto.alfa[y1 + 40, (x0 + x1) // 2] == 0
    assert con.medidas["partes_recuperadas"] > 50
    # Solo cambia la transparencia: los colores son los mismos.
    assert np.array_equal(con.foto.rgb, foto.rgb)


def test_recuperar_partes_cierra_los_cuadrados_abiertos_del_borde_sin_tocar_el_fondo():
    # Sin la línea de arriba, los cuadrados de la primera fila quedan abiertos al fondo.
    foto, mascara, (y0, y1, x0, x1) = _caja_con_cuadricula(con_borde_arriba=False)
    _, con = correr(Fondo(lambda rgb: mascara), foto, {**SIN_EXTRAS, "recuperar": 1})
    assert con.foto.alfa[y0 + 10, x0 + 100] == 1
    assert con.foto.alfa[y0 - 10, x0 + 100] == 0


def test_recuperar_partes_no_tapa_el_centro_de_un_aro_ni_una_sombra():
    alto, ancho = 600, 800
    rgb = np.full((alto, ancho, 3), 0.82, np.float32)
    yy, xx = np.mgrid[0:alto, 0:ancho]
    r = np.hypot(yy - 300, xx - 400)
    aro = (r > 120) & (r < 160)
    rgb[aro] = [0.20, 0.20, 0.22]
    # Adentro del aro se ve el fondo, con una sombra: más oscuro pero del mismo color.
    sombra = (r <= 120) & (yy > 330)
    rgb[sombra] = 0.55
    paso = Fondo(lambda x: aro.astype(np.float32))
    _, con = correr(paso, Foto(rgb=rgb, datos={"camara": {}}), {**SIN_EXTRAS, "recuperar": 1})
    assert con.foto.alfa[300, 400] == 0
    assert con.foto.alfa[380, 400] == 0
    assert con.medidas["partes_recuperadas"] == 0
