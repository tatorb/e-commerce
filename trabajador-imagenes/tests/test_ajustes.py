from mrb_imagenes.ajustes import AJUSTES_DEFECTO, leer_ajustes
from mrb_imagenes.pasos import armar_pasos
from mrb_imagenes.pasos.perspectiva import Perspectiva


def test_ajustes_por_defecto_y_valores_invalidos():
    a = leer_ajustes({"margen": 12, "fondo": "#f0f0f0", "calidad_jpg": 500, "topes": {"giro": 5, "inventado": 3}})
    assert a["margen"] == 12
    assert a["fondo"] == "#F0F0F0"
    assert a["calidad_jpg"] == AJUSTES_DEFECTO["calidad_jpg"]
    assert a["topes"]["giro"] == 5
    assert "inventado" not in a["topes"]


def test_ningun_valor_pasa_su_tope():
    ajustes = leer_ajustes({"topes": {"giro": 5}})
    valores, avisos = Perspectiva().limitar({"giro": -14, "vertical": "no es un número"}, ajustes)
    assert valores["giro"] == -5
    assert valores["vertical"] == 0
    assert avisos == ["Giro: se pidió -14° y el tope es -5°."]


def test_si_no_se_redondea_y_faltantes_toman_el_defecto():
    lente = armar_pasos(lambda rgb: rgb[..., 0])[0]
    valores, _ = lente.limitar({"distorsion": 0.2, "vineta": True}, leer_ajustes())
    assert valores == {"distorsion": 0.0, "aberracion": 1.0, "vineta": 1.0}


def test_cada_paso_tiene_nombre_consigna_y_parametros():
    for paso in armar_pasos(lambda rgb: rgb[..., 0]):
        assert paso.clave and paso.nombre and paso.consigna
        claves = [p.clave for p in paso.parametros]
        assert len(claves) == len(set(claves))
