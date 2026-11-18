"""El sonido del clip: la voz en off, la música y los subtítulos.

La voz y la música las genera ElevenLabs. La voz dice el guión del clip, que
llega ya escrito y revisado: no relata el video, da las certezas de la
publicación. Se pide frase por frase, con el momento exacto de cada palabra,
de ahí salen los subtítulos. Primero se dice todo, para saber cuánto dura, y
con eso se decide cuánto dura el clip; después cada frase se reparte a lo
largo del video.

La mezcla es la de siempre: la voz a volumen de redes, la música de fondo y
bajando sola cuando hay voz, con entrada y salida suaves.
"""

from __future__ import annotations

import base64
import json
import os
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path

import ssl

from mrb_imagenes.app import _contexto_tls
from mrb_imagenes.inspector import SERVICIO_LLAVERO

from .medios import Cancelado, correr, leer, programa

ELEVENLABS = "https://api.elevenlabs.io"
MODELO_DE_VOZ = "eleven_multilingual_v2"
FORMATO = "mp3_44100_128"

# La mezcla.
VOZ_LUFS = -14.0
MUSICA_BAJO_LA_VOZ = 0.16
MUSICA_SOLA_LUFS = -18.0
ENTRADA_S = 0.8
SALIDA_S = 1.6
# La voz arranca enseguida y termina un poco antes que el clip.
AIRE_AL_EMPEZAR = 0.4
AIRE_AL_TERMINAR = 0.8
# La pausa entre una frase y la siguiente: nunca menos que la primera, para que se entienda, ni más
# que la segunda, para que no parezca que la voz se cortó.
PAUSA_MIN = 0.4
PAUSA_MAX = 2.5
# La música que pide ElevenLabs dura al menos esto.
MUSICA_MIN_S = 10.0


class SinElevenLabs(RuntimeError):
    """Falta la clave, no vale, o ElevenLabs no respondió. El mensaje es para mostrar."""


def obtener_clave_elevenlabs() -> str | None:
    clave = os.environ.get("ELEVENLABS_API_KEY")
    if clave:
        return clave
    try:
        import keyring

        return keyring.get_password(SERVICIO_LLAVERO, "elevenlabs")
    except Exception:
        return None


@dataclass
class Palabra:
    texto: str
    inicio: float
    fin: float


@dataclass
class Linea:
    """Una línea del guión ya dicha: dónde va en el clip y cada palabra con su momento."""

    texto: str
    inicio: float
    fin: float
    archivo: Path
    palabras: list[Palabra] = field(default_factory=list)


def palabras_de(alineacion: dict) -> list[Palabra]:
    """De los momentos de cada letra a los de cada palabra."""
    letras = alineacion.get("characters") or []
    inicios = alineacion.get("character_start_times_seconds") or []
    fines = alineacion.get("character_end_times_seconds") or []
    palabras: list[Palabra] = []
    actual, desde, hasta = "", 0.0, 0.0
    for letra, inicio, fin in zip(letras, inicios, fines):
        if letra.isspace():
            if actual:
                palabras.append(Palabra(actual, desde, hasta))
            actual = ""
            continue
        if not actual:
            desde = float(inicio)
        actual += letra
        hasta = float(fin)
    if actual:
        palabras.append(Palabra(actual, desde, hasta))
    return palabras


class ElevenLabs:
    def __init__(self, clave: str, base: str = ELEVENLABS, timeout: float = 240):
        self.clave = clave
        self.base = base.rstrip("/")
        self.timeout = timeout
        # En una red que pide sus propios certificados, valen los que diga SSL_CERT_FILE.
        self._tls = ssl.create_default_context(cafile=os.environ["SSL_CERT_FILE"]) if os.environ.get("SSL_CERT_FILE") else _contexto_tls()

    @classmethod
    def desde_entorno(cls) -> ElevenLabs:
        clave = obtener_clave_elevenlabs()
        if not clave:
            raise SinElevenLabs("Falta la clave de ElevenLabs en la Mac. Cargala con bash configurar.sh.")
        return cls(clave)

    def _post(self, ruta: str, cuerpo: dict) -> bytes:
        pedido = urllib.request.Request(
            f"{self.base}{ruta}",
            data=json.dumps(cuerpo, ensure_ascii=False).encode("utf-8"),
            method="POST",
            headers={"Content-Type": "application/json", "xi-api-key": self.clave},
        )
        try:
            with urllib.request.urlopen(pedido, timeout=self.timeout, context=self._tls) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            raise SinElevenLabs(_motivo(e.code, e.read().decode("utf-8", "replace"))) from None
        except (urllib.error.URLError, TimeoutError) as e:
            raise SinElevenLabs(f"No se pudo conectar con ElevenLabs: {getattr(e, 'reason', e)}.") from None

    def decir(self, texto: str, voz: str, anterior: str = "", siguiente: str = "") -> tuple[bytes, list[Palabra]]:
        """La frase dicha, en MP3, y el momento de cada palabra."""
        cuerpo = {"text": texto, "model_id": MODELO_DE_VOZ, "language_code": "es"}
        # Lo que se dijo antes y lo que sigue, para que la entonación sea de una sola locución.
        if anterior:
            cuerpo["previous_text"] = anterior[-500:]
        if siguiente:
            cuerpo["next_text"] = siguiente[:500]
        datos = json.loads(self._post(f"/v1/text-to-speech/{voz}/with-timestamps?output_format={FORMATO}", cuerpo))
        return base64.b64decode(datos["audio_base64"]), palabras_de(datos.get("alignment") or {})

    def musica(self, estilo: str, segundos: float) -> bytes:
        """Una pista instrumental del largo pedido, en MP3."""
        cuerpo = {"prompt": estilo, "music_length_ms": int(max(segundos, MUSICA_MIN_S) * 1000)}
        return self._post(f"/v1/music?output_format={FORMATO}", cuerpo)


def _motivo(estado: int, cuerpo: str) -> str:
    estado_dicho = ""
    try:
        detalle = json.loads(cuerpo).get("detail")
        dicho = detalle.get("message") if isinstance(detalle, dict) else str(detalle or "")
        estado_dicho = str(detalle.get("status") or "") if isinstance(detalle, dict) else ""
    except ValueError:
        dicho = cuerpo[:200]
    dicho = " ".join(str(dicho or "").split())[:300]
    if estado in (402, 429) or "quota" in f"{dicho} {estado_dicho}".lower() or "credit" in dicho.lower():
        return f"La cuenta de ElevenLabs no tiene créditos o llegó a su límite. ElevenLabs dijo «{dicho}»."
    if "must start with" in dicho:
        return "La clave de ElevenLabs que está cargada en la Mac no es una clave: empiezan con sk_. Cargala de nuevo con bash configurar.sh."
    if estado == 401 and "permission" in dicho:
        return f"La clave de ElevenLabs no tiene permiso para esto. En ElevenLabs, en API Keys, dale acceso a Text to Speech y a Music. ElevenLabs dijo «{dicho}»."
    if estado == 401:
        return "La clave de ElevenLabs no vale. Cargala de nuevo con bash configurar.sh."
    if estado == 404:
        return "ElevenLabs no encontró esa voz. Revisá el ID de la voz en los ajustes de video de la cuenta."
    return f"ElevenLabs rechazó el pedido (respuesta {estado}). ElevenLabs dijo «{dicho}»."


def decir_guion(
    eleven: ElevenLabs,
    lineas: list[str],
    voz: str,
    carpeta: Path,
    cancelado: Callable[[], bool] | None = None,
    informar: Callable[[str, float | None], None] | None = None,
) -> list[Linea]:
    """Dice cada frase del guión. Todavía sin lugar en el clip: primero hay que saber cuánto dura cada una."""
    carpeta.mkdir(parents=True, exist_ok=True)
    dichas: list[Linea] = []
    frases = [" ".join(linea.split()) for linea in lineas if linea and linea.strip()]
    for n, texto in enumerate(frases):
        if cancelado and cancelado():
            raise Cancelado()
        if informar:
            informar(f"Generando la voz, frase {n + 1} de {len(frases)}", 100 * n / len(frases))
        # Lo que se dijo antes y lo que sigue, para que la entonación sea de una sola locución.
        audio, palabras = eleven.decir(texto, voz, " ".join(frases[:n]), " ".join(frases[n + 1 :]))
        archivo = carpeta / f"frase_{n:02d}.mp3"
        archivo.write_bytes(audio)
        dichas.append(Linea(texto=texto, inicio=0.0, fin=round(leer_duracion(archivo), 3), archivo=archivo, palabras=palabras))
    return dichas


def largo_de_la_voz(dichas: list[Linea]) -> float:
    """Lo mínimo que tiene que durar el clip para que entre toda la voz, con sus pausas y su aire al principio y al final."""
    if not dichas:
        return 0.0
    return AIRE_AL_EMPEZAR + sum(d.fin - d.inicio for d in dichas) + PAUSA_MIN * (len(dichas) - 1) + AIRE_AL_TERMINAR


def ubicar(dichas: list[Linea], segundos: float) -> list[Linea]:
    """
    Reparte las frases a lo largo del clip: arrancan enseguida y la pausa entre una y otra se estira para
    acompañar todo el video, sin pasar de un silencio que se note. Lo que sobre queda al final, con la música.
    """
    if not dichas:
        return []
    duraciones = [d.fin - d.inicio for d in dichas]
    libre = segundos - AIRE_AL_EMPEZAR - AIRE_AL_TERMINAR - sum(duraciones)
    pausa = PAUSA_MIN if len(dichas) < 2 else min(PAUSA_MAX, max(PAUSA_MIN, libre / (len(dichas) - 1)))
    ubicadas, t = [], AIRE_AL_EMPEZAR
    for d, dura in zip(dichas, duraciones):
        ubicadas.append(Linea(texto=d.texto, inicio=round(t, 3), fin=round(t + dura, 3), archivo=d.archivo, palabras=d.palabras))
        t += dura + pausa
    return ubicadas


def leer_duracion(archivo: Path) -> float:
    res = correr([programa("ffprobe"), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(archivo)])
    return float(res.stdout.decode().strip() or 0)


def mezclar(lineas: list[Linea], musica: Path | None, segundos: float, salida: Path, cancelado: Callable[[], bool] | None = None) -> Path:
    """La pista de sonido del clip, del largo exacto del clip."""
    if not lineas and not musica:
        raise ValueError("No hay voz ni música para mezclar.")
    args = [programa("ffmpeg"), "-v", "error", "-y"]
    for linea in lineas:
        args += ["-i", str(linea.archivo)]
    if musica:
        args += ["-stream_loop", "-1", "-i", str(musica)]
    filtros = []
    if lineas:
        for i, linea in enumerate(lineas):
            ms = int(round(linea.inicio * 1000))
            filtros.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={ms}:all=1[l{i}]")
        entradas = "".join(f"[l{i}]" for i in range(len(lineas)))
        junta = f"amix=inputs={len(lineas)}:normalize=0:dropout_transition=0," if len(lineas) > 1 else ""
        filtros.append(f"{entradas}{junta}apad=whole_dur={segundos:.3f},atrim=0:{segundos:.3f},loudnorm=I={VOZ_LUFS}:TP=-1.5:LRA=11,aresample=48000[voz]")
    if musica:
        m = len(lineas)
        fin = max(0.0, segundos - SALIDA_S)
        base = f"[{m}:a]atrim=0:{segundos:.3f},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo"
        fundidos = f"afade=t=in:d={ENTRADA_S},afade=t=out:st={fin:.3f}:d={SALIDA_S}"
        if lineas:
            filtros.append(f"{base},volume={MUSICA_BAJO_LA_VOZ},{fundidos}[m]")
            filtros.append("[voz]asplit=2[v][sc]")
            filtros.append("[m][sc]sidechaincompress=threshold=0.05:ratio=4:attack=30:release=400[md]")
            filtros.append("[v][md]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]")
        else:
            filtros.append(f"{base},loudnorm=I={MUSICA_SOLA_LUFS}:TP=-1.5:LRA=11,aresample=48000,{fundidos}[out]")
    else:
        filtros.append("[voz]alimiter=limit=0.89[out]")
    # Los filtros de volumen comen unas centésimas: se completa con silencio hasta el largo exacto.
    filtros.append("[out]apad[fin]")
    args += ["-filter_complex", ";".join(filtros), "-map", "[fin]", "-ar", "48000", "-ac", "2", "-t", f"{segundos:.3f}", str(salida)]
    correr(args, cancelado=cancelado)
    return salida


def volumen(archivo: Path) -> float | None:
    """El volumen percibido de la pista, en LUFS: Claude no puede escuchar, se controla con el medidor."""
    res = correr([programa("ffmpeg"), "-hide_banner", "-nostats", "-i", str(archivo), "-map", "0:a:0", "-af", "ebur128", "-f", "null", "-"])
    for renglon in reversed(res.stderr.decode("utf-8", "replace").splitlines()):
        partes = renglon.split()
        if len(partes) >= 3 and partes[0] == "I:" and partes[2] == "LUFS":
            try:
                return float(partes[1])
            except ValueError:
                return None
    return None


# ───────────────────────────── Subtítulos ─────────────────────────────

# Cuántas palabras se ven a la vez, y hasta cuántas letras.
PALABRAS_POR_GRUPO = 3
LETRAS_POR_GRUPO = 22

def _peso(palabra: str) -> float:
    """Cuánto tarda en decirse una palabra escrita, a ojo: un número lleva más que sus pocos caracteres."""
    digitos = sum(c.isdigit() for c in palabra)
    letras = sum(c.isalpha() for c in palabra)
    # "1.3" se dice "uno punto tres": cada dígito y cada punto o coma entre dígitos es una palabra.
    separadores = sum(1 for i, c in enumerate(palabra) if c in ".,/x" and 0 < i < len(palabra) - 1 and palabra[i - 1].isdigit())
    return max(1.0, letras + 4.0 * digitos + 5.0 * separadores)


def mostrar(lineas: list[Linea], textos: list[str] | None) -> list[Linea]:
    """
    Las líneas como se escriben en pantalla, cuando no es lo mismo que dice la voz.

    La voz dice "uno punto tres" y el subtítulo muestra "1.3". Cada línea conserva su tiempo; sus palabras
    pasan a ser las escritas. Con la misma cantidad de palabras, cada una toma el momento de la que se dijo;
    si no, se reparten en el tiempo de la línea según lo que tarda en decirse cada una.
    """
    if not textos:
        return lineas
    salida: list[Linea] = []
    for n, linea in enumerate(lineas):
        escrito = (textos[n] if n < len(textos) else "").split()
        if not escrito or not linea.palabras or " ".join(escrito) == " ".join(p.texto for p in linea.palabras):
            salida.append(linea)
            continue
        if len(escrito) == len(linea.palabras):
            palabras = [Palabra(texto, dicha.inicio, dicha.fin) for texto, dicha in zip(escrito, linea.palabras)]
        else:
            desde, hasta = linea.palabras[0].inicio, linea.palabras[-1].fin
            pesos = [_peso(p) for p in escrito]
            total = sum(pesos)
            palabras, t = [], desde
            for texto, peso in zip(escrito, pesos):
                fin = t + (hasta - desde) * peso / total
                palabras.append(Palabra(texto, t, fin))
                t = fin
        salida.append(Linea(texto=" ".join(escrito), inicio=linea.inicio, fin=linea.fin, archivo=linea.archivo, palabras=palabras))
    return salida


def _limpio(texto: str) -> str:
    return texto.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ")


def grupos_de(palabras: list[Palabra]) -> list[list[Palabra]]:
    grupos: list[list[Palabra]] = []
    for p in palabras:
        actual = grupos[-1] if grupos else None
        if actual and len(actual) < PALABRAS_POR_GRUPO and sum(len(x.texto) + 1 for x in actual) + len(p.texto) <= LETRAS_POR_GRUPO and not actual[-1].texto.endswith((".", "?", "!")):
            actual.append(p)
        else:
            grupos.append([p])
    return grupos


@dataclass
class Subtitulos:
    """Los subtítulos ya dibujados: la lista de imágenes para ffmpeg, y dónde van sobre el video."""

    lista: Path
    y: int


# La letra de los subtítulos viene con el programa, así se ven igual en cualquier máquina: Poppins Bold,
# de uso libre (su licencia está al lado). Si no se pudiera leer, se prueba con las del sistema.
LETRAS = (
    str(Path(__file__).resolve().parent / "letras" / "Poppins-Bold.woff"),
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
)
BLANCO = (255, 255, 255, 255)
NEGRO = (0, 0, 0, 255)
# El color de la palabra que se está diciendo, si la cuenta no eligió el suyo.
COLOR_RESALTADO = "#FFE633"


def color_de(texto: str | None) -> tuple[int, int, int, int]:
    """De "#6FA82C" a sus tres componentes. Si no vale, el de siempre."""
    limpio = (texto or "").strip().lstrip("#")
    if len(limpio) != 6:
        limpio = COLOR_RESALTADO.lstrip("#")
    try:
        return (int(limpio[0:2], 16), int(limpio[2:4], 16), int(limpio[4:6], 16), 255)
    except ValueError:
        return color_de(COLOR_RESALTADO)


def _letra(tamano: int):
    from PIL import ImageFont

    for ruta in LETRAS:
        try:
            return ImageFont.truetype(ruta, tamano)
        except OSError:
            continue
    return ImageFont.load_default(size=tamano)


def momentos_de(lineas: list[Linea]) -> list[tuple[float, float, list[str], int]]:
    """Cada momento de los subtítulos: desde y hasta cuándo, las palabras que se ven y cuál se está diciendo."""
    momentos = []
    for linea in lineas:
        grupos = grupos_de(linea.palabras)
        for g, grupo in enumerate(grupos):
            for i, palabra in enumerate(grupo):
                desde = linea.inicio + palabra.inicio
                # Cada palabra queda resaltada hasta que empieza la siguiente; la última del grupo, hasta que empieza el próximo.
                if i + 1 < len(grupo):
                    hasta = linea.inicio + grupo[i + 1].inicio
                elif g + 1 < len(grupos):
                    hasta = linea.inicio + grupos[g + 1][0].inicio
                else:
                    hasta = linea.inicio + palabra.fin + 0.25
                momentos.append((desde, max(hasta, desde + 0.05), [x.texto for x in grupo], i))
    # En orden y sin pisarse: cada uno termina, a lo sumo, donde empieza el siguiente.
    momentos.sort(key=lambda m: m[0])
    return [(d, min(h, momentos[n + 1][0]) if n + 1 < len(momentos) else h, palabras, i) for n, (d, h, palabras, i) in enumerate(momentos)]


def dibujar_franja(palabras: list[str], resaltada: int, ancho: int, alto_franja: int, tamano: int, color: str | None = None):
    """Una franja transparente con las palabras al medio, en blanco con borde negro, y la que se dice en su color."""
    resaltado = color_de(color)
    from PIL import Image, ImageDraw

    franja = Image.new("RGBA", (ancho, alto_franja), (0, 0, 0, 0))
    lapiz = ImageDraw.Draw(franja)
    margen = round(ancho * 0.06)
    while True:
        letra = _letra(tamano)
        borde = max(3, tamano // 12)
        espacio = lapiz.textlength(" ", font=letra)
        anchos = [lapiz.textlength(p, font=letra) for p in palabras]
        total = sum(anchos) + espacio * (len(palabras) - 1)
        if total <= ancho - 2 * margen or tamano <= 24:
            break
        # Si no entra, se achica la letra.
        tamano = int(tamano * 0.9)
    x = (ancho - total) / 2
    for i, (palabra, w) in enumerate(zip(palabras, anchos)):
        lapiz.text((x, alto_franja / 2), palabra, font=letra, fill=resaltado if i == resaltada else BLANCO, stroke_width=borde, stroke_fill=NEGRO, anchor="lm")
        x += w + espacio
    return franja


def subtitulos(lineas: list[Linea], carpeta: Path, segundos: float, ancho: int = 1080, alto: int = 1920, color: str | None = None) -> Subtitulos:
    """
    El guión escrito sobre el video, de a pocas palabras, con la que se está diciendo resaltada.

    Lo dibuja el programa, imagen por imagen, y ffmpeg las pega sobre el video: no depende de que ffmpeg
    sepa escribir subtítulos, que en algunas instalaciones no viene.
    """
    from PIL import Image

    carpeta.mkdir(parents=True, exist_ok=True)
    tamano = round(alto * 0.036)
    alto_franja = (round(tamano * 2.4) // 2) * 2
    vacia = carpeta / "vacia.png"
    Image.new("RGBA", (ancho, alto_franja), (0, 0, 0, 0)).save(vacia)
    renglones = ["ffconcat version 1.0"]
    t = 0.0

    def poner(archivo: Path, dura: float) -> None:
        renglones.append(f"file '{archivo.name}'")
        renglones.append(f"duration {dura:.3f}")

    for n, (desde, hasta, palabras, resaltada) in enumerate(momentos_de(lineas)):
        if desde >= segundos:
            break
        if desde - t > 0.02:
            poner(vacia, desde - t)
        archivo = carpeta / f"s{n:04d}.png"
        dibujar_franja([_limpio(p) for p in palabras], resaltada, ancho, alto_franja, tamano, color).save(archivo)
        hasta = min(hasta, segundos)
        poner(archivo, hasta - desde)
        t = hasta
    poner(vacia, max(0.5, segundos - t + 0.5))
    # La última imagen va dos veces: así ffmpeg respeta su duración.
    renglones.append(f"file '{vacia.name}'")
    lista = carpeta / "subtitulos.txt"
    lista.write_text("\n".join(renglones) + "\n", encoding="utf-8")
    # Un poco por debajo del medio de la parte de abajo, lejos de los botones del canal.
    return Subtitulos(lista=lista, y=round(alto * 0.8) - alto_franja)
