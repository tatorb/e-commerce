// En la pestaña de Mercado Libre que abrió la extensión: busca la publicación,
// entra por "Crear video" y carga el archivo del clip. Ante cualquier pantalla
// que no reconoce, no insiste ni adivina: se frena y avisa. No toca nada de la
// publicación que no sea el video, y por ahora no confirma: eso lo hace la persona.
(async () => {
  const pedir = (mensaje) => chrome.runtime.sendMessage(mensaje);
  const trabajo = await pedir({ tipo: 'trabajo' }).catch(() => null);
  // En cualquier otra pestaña de Mercado Libre, la extensión no hace nada.
  if (!trabajo) return;

  const cartel = document.createElement('div');
  cartel.id = 'mrb-clips-cartel';
  cartel.style.cssText =
    'position:fixed;z-index:2147483647;right:16px;bottom:16px;max-width:360px;padding:12px 14px;border-radius:10px;background:#1f2937;color:#fff;font:14px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.3)';
  document.documentElement.appendChild(cartel);
  const decir = (texto, extra = {}) => {
    cartel.textContent = `Studio MRB · ${extra.error ?? texto}`;
    if (extra.error) cartel.style.background = '#991b1b';
    if (extra.listo) cartel.style.background = '#166534';
    return pedir({ tipo: 'avance', texto, ...extra });
  };
  const frenar = (error, conInforme = true) => decir(null, { error, informe: conInforme ? MRB.mirar() : null });

  try {
    const persona = MRB.pidePersona();
    if (persona) return await frenar(persona, false);

    if (trabajo.etapa === 'listado' && location.pathname.includes('/publicaciones/listado')) {
      await decir(`Buscando la publicación ${trabajo.codigo}…`);
      if (!(await MRB.esperar(MRB.MENU))) return await frenar(MRB.pidePersona() ?? `La publicación ${trabajo.codigo} no aparece en tu listado de Mercado Libre.`);
      await MRB.pausa(800);
      const filas = document.querySelectorAll(MRB.MENU);
      // Con más de una fila no se sabe cuál es: mejor no tocar.
      if (filas.length !== 1) return await frenar(`El listado mostró ${filas.length} publicaciones al buscar ${trabajo.codigo}: no se sabe a cuál subirle el clip.`);
      filas[0].click();
      await MRB.esperar(MRB.OPCION, 10000);
      const opcion = [...document.querySelectorAll(MRB.OPCION)].find((a) => a.textContent.trim() === MRB.TEXTO_OPCION);
      if (!opcion) return await frenar(`El menú de la publicación no ofrece «${MRB.TEXTO_OPCION}». Puede que Mercado Libre haya cambiado la pantalla: no se tocó nada.`);
      const destino = new URL(opcion.getAttribute('href') ?? '', location.href);
      if (!/(^|\.)mercadolibre\.com\.ar$/.test(destino.hostname) || !destino.pathname.includes('/video/creator/upload') || !destino.searchParams.get('item_id')) {
        return await frenar('El link de Crear video no lleva a la subida de videos. Puede que Mercado Libre haya cambiado la pantalla: no se tocó nada.');
      }
      await pedir({ tipo: 'etapa', etapa: 'crear' });
      location.assign(destino.href);
      return;
    }

    if (trabajo.etapa === 'crear' && location.pathname.includes('/video/creator/upload')) {
      await decir('Preparando el clip…');
      const campo = await MRB.esperar(MRB.ARCHIVO);
      if (!campo) return await frenar(MRB.pidePersona() ?? 'La pantalla Crear video no tiene dónde elegir el archivo. Puede que Mercado Libre la haya cambiado: no se tocó nada.');
      const antes = MRB.mirar();

      // El clip llega de la app de a pedazos.
      const partes = [];
      let desde = 0;
      let total = null;
      while (total === null || desde < total) {
        const p = await pedir({ tipo: 'pedazo', desde });
        if (!p?.ok) return await frenar(p?.error ?? 'No se pudo traer el clip de la app.', false);
        const crudo = atob(p.datos);
        const bytes = new Uint8Array(crudo.length);
        for (let i = 0; i < crudo.length; i++) bytes[i] = crudo.charCodeAt(i);
        if (bytes.length === 0) return await frenar('La app entregó el clip vacío.', false);
        partes.push(bytes);
        desde = p.hasta;
        total = p.total;
        await decir(`Trayendo el clip: ${Math.min(100, Math.round((desde / total) * 100))} %`);
      }
      const archivo = new File(partes, trabajo.nombre, { type: trabajo.tipoDeArchivo });
      const caja = new DataTransfer();
      caja.items.add(archivo);
      campo.files = caja.files;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      campo.dispatchEvent(new Event('change', { bubbles: true }));
      await pedir({ tipo: 'etapa', etapa: 'cargado' });

      await decir('Mercado Libre está cargando el clip…');
      await MRB.quieta();
      const persona2 = MRB.pidePersona();
      if (persona2) return await frenar(persona2, false);
      await decir('El clip quedó cargado. Revisalo y confirmá vos en esta pantalla, y después marcá Ya lo subí en la app.', { listo: true, informe: { antes, despues: MRB.mirar() } });
      return;
    }

    if (trabajo.etapa === 'cargado') return;
    await frenar('Mercado Libre abrió una pantalla que no es la esperada: no se tocó nada.');
  } catch (e) {
    await frenar(`Algo falló en la extensión: ${String(e?.message ?? e)}`).catch(() => {});
  }
})();
