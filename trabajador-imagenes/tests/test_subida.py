"""La subida del clip por el navegador, contra una copia de la pantalla de Mercado Libre."""

import os
import shutil
from pathlib import Path

import pytest

playwright_api = pytest.importorskip("playwright.sync_api")
from mrb_videos import subida  # noqa: E402

CHROME = os.environ.get("MRB_CHROME") or ("/opt/pw-browsers/chromium" if Path("/opt/pw-browsers/chromium").exists() else shutil.which("chromium") or shutil.which("google-chrome"))
pytestmark = pytest.mark.skipif(not CHROME, reason="hace falta un Chrome para probar la subida")

SUBIDA = "https://www.mercadolibre.com.ar/video/creator/upload?item_id=MLA4188931774&item_syi=MLA4188931774&user_product_id=MLAU1&user_product_syi=MLAU1&origin=syi_dropdown"


def fila(codigo: str, opcion: str = "Crear video", href: str = SUBIDA) -> str:
    return f"""
    <div class="fila" data-codigo="{codigo}">
      <button class="sll-list-row-secondary-actions-trigger" aria-label="Acciones secundarias" onclick="this.nextElementSibling.hidden = false"></button>
      <ul hidden>
        <li><a class="sll-list-row-secondary-action__label--link" href="https://www.mercadolibre.com.ar/publicar/omni/variantes/X">Agregar variante</a></li>
        <li><a class="sll-list-row-secondary-action__label--link" target="_self" href="{href}">{opcion}</a></li>
        <li><button>Eliminar todas las variantes</button></li>
      </ul>
    </div>"""


CREAR = """
<title>Crear clip con IA</title><h1>Crear video</h1>
<input type="checkbox" id="CHECKBOX_SHOW_VIDEO_IN_ALL_VARIANTS" checked>
<h2>Tus videos</h2>
<div class="clip-dropzone" role="button" tabindex="0">Subir más
  <input type="file" class="clip-dropzone__file-input" accept=".mp4,.mpeg,.avi,.mov" style="display:none"
    onchange="document.querySelector('#paso').innerHTML = '<h2>Revisá tu video</h2><p>' + this.files[0].name + '</p><button class=&quot;andes-button andes-button--loud&quot; data-testid=&quot;publish&quot;>Publicar video</button>'">
</div>
<div id="paso"></div>"""


@pytest.fixture(scope="module")
def navegador():
    with playwright_api.sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        yield b
        b.close()


@pytest.fixture
def pagina(navegador):
    contexto = navegador.new_context()
    pagina = contexto.new_page()
    pagina.paginas = {"listado": fila("MLA1"), "crear": CREAR}
    pagina.pedidos = []

    def responder(ruta):
        url = ruta.request.url
        pagina.pedidos.append((ruta.request.method, url))
        if "/publicaciones/listado" in url:
            return ruta.fulfill(content_type="text/html", body=pagina.paginas["listado"])
        if "/video/creator/upload" in url:
            return ruta.fulfill(content_type="text/html", body=pagina.paginas["crear"])
        return ruta.fulfill(status=404, body="")

    pagina.route("**/*", responder)
    yield pagina
    contexto.close()


@pytest.fixture
def clip(tmp_path):
    archivo = tmp_path / "clip.mp4"
    archivo.write_bytes(b"\0" * 2048)
    return archivo


def esperas_cortas(monkeypatch):
    monkeypatch.setattr(subida, "ESPERA_MS", 3_000)
    monkeypatch.setattr(subida, "_esperar_quieta", lambda pagina, **_: pagina.wait_for_timeout(200))


def test_llega_hasta_elegir_el_archivo_y_anota_la_pantalla(pagina, clip, tmp_path, monkeypatch):
    esperas_cortas(monkeypatch)
    r = subida.subir_clip(pagina, "MLA1", clip, confirmar=False, carpeta=tmp_path / "informe")
    assert r.subido is False and r.etapa == "archivo elegido, sin confirmar"
    # Buscó la publicación por su código y entró por el link de Crear video, sin tocar otra opción.
    urls = [u for _, u in pagina.pedidos]
    assert urls[0] == "https://www.mercadolibre.com.ar/publicaciones/listado?search=MLA1"
    assert urls[1] == SUBIDA
    assert all(m == "GET" for m, _ in pagina.pedidos)
    # Lo que apareció después de elegir el archivo queda anotado, con el botón que habría que tocar.
    botones = [b["texto"] for b in r.informe["despues"]["botones"]]
    assert "Publicar video" in botones and "Publicar video" not in [b["texto"] for b in r.informe["antes"]["botones"]]
    assert (tmp_path / "informe" / "informe.json").exists() and r.captura and r.captura.exists()
    # Y no lo tocó.
    assert pagina.locator("[data-testid=publish]").count() == 1


def test_no_confirma_mientras_no_se_conozca_el_paso(pagina, clip, monkeypatch):
    esperas_cortas(monkeypatch)
    with pytest.raises(subida.PantallaDesconocida) as e:
        subida.subir_clip(pagina, "MLA1", clip, confirmar=True)
    assert e.value.definitivo


def test_con_dos_publicaciones_no_elige(pagina, clip, monkeypatch):
    esperas_cortas(monkeypatch)
    pagina.paginas["listado"] = fila("MLA1") + fila("MLA2")
    with pytest.raises(subida.NoSePudoSubir, match="2 publicaciones"):
        subida.subir_clip(pagina, "MLA1", clip, confirmar=False)
    assert not any("/video/creator" in u for _, u in pagina.pedidos)


def test_si_cambia_la_pantalla_se_frena(pagina, clip, tmp_path, monkeypatch):
    esperas_cortas(monkeypatch)
    # El menú ya no ofrece Crear video.
    pagina.paginas["listado"] = fila("MLA1", opcion="Crear video con IA")
    with pytest.raises(subida.PantallaDesconocida, match="no ofrece"):
        subida.subir_clip(pagina, "MLA1", clip, confirmar=False, carpeta=tmp_path)
    assert (tmp_path / "pantalla-desconocida.json").exists()
    # El link lleva a otro lado.
    pagina.paginas["listado"] = fila("MLA1", href="https://www.mercadolibre.com.ar/publicar/kit")
    with pytest.raises(subida.PantallaDesconocida, match="no lleva a la subida"):
        subida.subir_clip(pagina, "MLA1", clip, confirmar=False)
    # La pantalla de subida no tiene dónde elegir el archivo.
    pagina.paginas["listado"] = fila("MLA1")
    pagina.paginas["crear"] = "<h1>Crear video</h1>"
    with pytest.raises(subida.PantallaDesconocida, match="dónde elegir"):
        subida.subir_clip(pagina, "MLA1", clip, confirmar=False)


def test_sesion_cerrada_y_captcha(pagina, clip, monkeypatch):
    esperas_cortas(monkeypatch)
    pagina.paginas["listado"] = '<form><input type="password"></form>'
    with pytest.raises(subida.SesionCerrada, match="sesion_mercadolibre.sh"):
        subida.subir_clip(pagina, "MLA1", clip, confirmar=False)
    pagina.paginas["listado"] = '<iframe src="https://x.example/captcha"></iframe>'
    with pytest.raises(subida.PidePersona, match="captcha"):
        subida.subir_clip(pagina, "MLA1", clip, confirmar=False)


def test_no_sube_un_formato_que_no_acepta(pagina, tmp_path):
    otro = tmp_path / "clip.mkv"
    otro.write_bytes(b"x")
    with pytest.raises(subida.NoSePudoSubir, match="MP4"):
        subida.subir_clip(pagina, "MLA1", otro, confirmar=False)
    assert pagina.pedidos == []
