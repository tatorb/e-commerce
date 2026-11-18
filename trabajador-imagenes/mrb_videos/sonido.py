"""El sonido del clip: la voz en off, la música y los subtítulos.

La voz y la música las genera ElevenLabs. La voz se pide línea por línea, con
el momento exacto de cada palabra: de ahí salen los subtítulos. Cada línea se
ubica donde empieza su tramo del clip y nunca encima de la anterior.

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
# Cuánto se espera entre una línea y la siguiente, y antes de la primera palabra de cada tramo.
AIRE_ENTRE_LINEAS = 0.25
AIRE_AL_EMPEZAR = 0.3
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
    tramos: list[tuple[float, float]],
    voz: str,
    carpeta: Path,
    cancelado: Callable[[], bool] | None = None,
    informar: Callable[[str, float | None], None] | None = None,
) -> list[Linea]:
    """Dice cada línea y la ubica en el clip: donde empieza su tramo, y nunca encima de la anterior."""
    carpeta.mkdir(parents=True, exist_ok=True)
    dichas: list[Linea] = []
    con_texto = [(i, " ".join(linea.split())) for i, linea in enumerate(lineas) if linea and linea.strip()]
    for n, (i, texto) in enumerate(con_texto):
        if cancelado and cancelado():
            raise Cancelado()
        if informar:
            informar(f"Generando la voz, línea {n + 1} de {len(con_texto)}", 100 * n / len(con_texto))
        anterior = " ".join(t for _, t in con_texto[:n])
        siguiente = " ".join(t for _, t in con_texto[n + 1 :])
        audio, palabras = eleven.decir(texto, voz, anterior, siguiente)
        archivo = carpeta / f"linea_{i:02d}.mp3"
        archivo.write_bytes(audio)
        dura = leer_duracion(archivo)
        inicio = tramos[i][0] + AIRE_AL_EMPEZAR
        if dichas:
            inicio = max(inicio, dichas[-1].fin + AIRE_ENTRE_LINEAS)
        dichas.append(Linea(texto=texto, inicio=round(inicio, 3), fin=round(inicio + dura, 3), archivo=archivo, palabras=palabras))
    return dichas


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
# Blanco con borde negro, y la palabra que se está diciendo en amarillo.
COLOR_DE_LA_PALABRA = "&H0033E6FF&"


def _reloj(segundos: float) -> str:
    cs = int(round(max(0.0, segundos) * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


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


def subtitulos(lineas: list[Linea], ancho: int = 1080, alto: int = 1920) -> str:
    """El guión escrito sobre el video, de a pocas palabras, con la que se está diciendo resaltada."""
    tamano = round(alto * 0.036)
    encabezado = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {ancho}
PlayResY: {alto}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Voz,Arial,{tamano},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,{max(3, tamano // 14)},1,2,{round(ancho * 0.08)},{round(ancho * 0.08)},{round(alto * 0.2)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    eventos = []
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
                texto = " ".join(f"{{\\c{COLOR_DE_LA_PALABRA}}}{_limpio(x.texto)}{{\\c&HFFFFFF&}}" if x is palabra else _limpio(x.texto) for x in grupo)
                eventos.append(f"Dialogue: 0,{_reloj(desde)},{_reloj(max(hasta, desde + 0.05))},Voz,,0,0,0,,{texto}")
    return encabezado + "\n".join(eventos) + "\n"
