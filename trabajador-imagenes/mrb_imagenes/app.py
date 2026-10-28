"""La conexión con la app.

El trabajador es el que pregunta: pide trabajo, avisa que sigue vivo y
entrega el resultado. La app nunca le habla a la Mac, así que no hay que
abrir nada. Los archivos van y vienen directo del depósito, con los permisos
que la app arma para cada uno.

La forma de los mensajes es la de src/domain/photo-contract.ts en la app, y
los ejemplos de contrato/ los prueban los dos lados.
"""

from __future__ import annotations

import json
import shutil
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field

# Sube cuando cambia la forma de los mensajes, igual que PHOTO_PROTOCOL en la app.
PROTOCOLO = 5

# "vivo" es el paquete para editar la foto en vivo en la app (vivo.py).
TipoSubida = Literal["antes", "vista", "mascara", "png", "jpg", "vivo"]


class Transferencia(BaseModel):
    url: str
    metodo: Literal["GET", "PUT"]
    encabezados: dict[str, str] = Field(default_factory=dict)


class Original(BaseModel):
    nombre: str
    tipo: str
    bajar: Transferencia


class AjusteDeReceta(BaseModel):
    paso: str
    valores: dict[str, float]
    aplicado: bool


class PasoDeReceta(BaseModel):
    """Un paso ya aprobado: qué ajustes se aplicaron y con qué valores."""

    id: str
    grupo: str
    indice: int
    partes: list[AjusteDeReceta]
    ajustes: dict


class Pedidos(BaseModel):
    """Lo que pidió la persona al rehacer: valores por ajuste y los que apagó."""

    valores: dict[str, dict[str, float]] = Field(default_factory=dict)
    apagados: list[str] = Field(default_factory=list)


class Trabajo(BaseModel):
    id: str
    turno: int
    foto: str
    # El paso y sus ajustes, que se hacen de corrido.
    grupo: str
    indice: int
    pasos: list[str]
    producto: str | None = None
    ajustes: dict
    pedidos: Pedidos | None = None
    original: Original
    receta: list[PasoDeReceta] = Field(default_factory=list)
    subidas: dict[TipoSubida, Transferencia] = Field(default_factory=dict)


class Siguiente(BaseModel):
    trabajo: Trabajo | None = None
    volver_en: float = 60


class Parametro(BaseModel):
    clave: str
    etiqueta: str
    ayuda: str
    minimo: float
    maximo: float
    defecto: float
    paso: float
    unidad: str
    tipo: Literal["numero", "si_no", "cuartos"]


class PropuestaParaApp(BaseModel):
    valores: dict[str, float]
    razon: str
    origen: str
    aviso: str | None = None


class OriginalPreparado(BaseModel):
    ancho: int
    alto: int
    camara: dict | None = None


class Parte(BaseModel):
    """Lo que pasó en un ajuste del paso."""

    paso: str
    aplicado: bool
    no_aplica: str | None
    propuesta: PropuestaParaApp | None
    valores: dict[str, float]
    medidas: dict
    parametros: list[Parametro]
    nota: str | None
    uso_claude: dict | None
    segundos: float


class Hecho(BaseModel):
    protocolo: int = PROTOCOLO
    id: str
    turno: int
    ok: Literal[True] = True
    partes: list[Parte]
    segundos: float
    archivos: list[TipoSubida]
    original: OriginalPreparado | None = None


class Fallo(BaseModel):
    protocolo: int = PROTOCOLO
    id: str
    turno: int
    ok: Literal[False] = False
    error: str


class ErrorDeApp(Exception):
    """La app respondió con un error. El mensaje es para mostrar en el registro."""

    def __init__(self, mensaje: str, estado: int | None = None):
        super().__init__(mensaje)
        self.estado = estado

    @property
    def hay_que_configurar(self) -> bool:
        # La llave no vale o el trabajador está desactualizado: reintentar no sirve.
        return self.estado in (401, 409)


def _contexto_tls() -> ssl.SSLContext:
    # El Python que instala uv no siempre encuentra los certificados de macOS.
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        return ssl.create_default_context()


class ClienteApp:
    def __init__(self, base: str, llave: str, timeout: float = 60):
        self.base = base.rstrip("/")
        self.llave = llave
        self.timeout = timeout
        self._tls = _contexto_tls()

    def _abrir(self, pedido: urllib.request.Request, timeout: float | None = None):
        try:
            return urllib.request.urlopen(pedido, timeout=timeout or self.timeout, context=self._tls)
        except urllib.error.HTTPError as e:
            cuerpo = e.read().decode("utf-8", "replace")
            try:
                mensaje = json.loads(cuerpo).get("error") or cuerpo
            except ValueError:
                mensaje = cuerpo or e.reason
            raise ErrorDeApp(f"{mensaje} (respuesta {e.code})", e.code) from None
        except urllib.error.URLError as e:
            raise ErrorDeApp(f"No se pudo conectar con {pedido.full_url.split('?')[0]}: {e.reason}") from None

    def _post(self, ruta: str, cuerpo: dict) -> dict:
        datos = json.dumps(cuerpo, ensure_ascii=False).encode("utf-8")
        pedido = urllib.request.Request(
            f"{self.base}{ruta}",
            data=datos,
            method="POST",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.llave}"},
        )
        with self._abrir(pedido) as r:
            return json.loads(r.read().decode("utf-8"))

    def siguiente(self, info: dict, version: str) -> Siguiente:
        return Siguiente.model_validate(
            self._post("/api/imagenes/trabajador/siguiente", {"protocolo": PROTOCOLO, "version": version, "info": info})
        )

    def latido(self, id: str, turno: int) -> bool:
        r = self._post("/api/imagenes/trabajador/latido", {"protocolo": PROTOCOLO, "id": id, "turno": turno})
        return bool(r.get("vigente"))

    def entregar(self, resultado: Hecho | Fallo) -> dict:
        return self._post("/api/imagenes/trabajador/resultado", resultado.model_dump(mode="json"))

    def _encabezados(self, t: Transferencia) -> dict[str, str]:
        encabezados = dict(t.encabezados)
        # Si el archivo pasa por la app, va con la llave.
        if t.url.startswith(self.base + "/"):
            encabezados["Authorization"] = f"Bearer {self.llave}"
        return encabezados

    def bajar(self, t: Transferencia, destino: Path) -> None:
        """Baja un archivo a disco, sin cargarlo entero en memoria."""
        destino.parent.mkdir(parents=True, exist_ok=True)
        parcial = destino.with_name(destino.name + ".parcial")
        pedido = urllib.request.Request(t.url, method="GET", headers=self._encabezados(t))
        with self._abrir(pedido, timeout=300) as r, open(parcial, "wb") as f:
            shutil.copyfileobj(r, f, 1024 * 1024)
        parcial.replace(destino)

    def subir(self, t: Transferencia, contenido: bytes) -> None:
        encabezados = self._encabezados(t)
        encabezados.setdefault("Content-Type", encabezados.get("x-content-type", "application/octet-stream"))
        pedido = urllib.request.Request(t.url, data=contenido, method=t.metodo, headers=encabezados)
        with self._abrir(pedido, timeout=300) as r:
            r.read()
