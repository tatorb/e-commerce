// En la pestaña de Mercado Libre que abrió la extensión: busca la publicación,
// entra por "Crear video" y carga el archivo del clip. Ante cualquier pantalla
// que no reconoce, no insiste ni adivina: se frena y avisa. No toca nada de la
// publicación que no sea el video. La subida termina cuando Mercado Libre suma el
// video a "Tus videos": no hay nada que confirmar.
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

  // Abre el menú de una fila, lee el link de «Crear video» y lo cierra. Null si no lo tiene.
  const linkDeCrear = async (boton) => {
    boton.click();
    await MRB.esperar(MRB.OPCION, 10000);
    await MRB.pausa(300);
    const opciones = [...document.querySelectorAll(MRB.OPCION)].filter((a) => MRB.visible(a) && a.textContent.trim() === MRB.TEXTO_OPCION);
    const href = opciones.length === 1 ? opciones[0].getAttribute('href') : null;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    document.body.click();
    await MRB.pausa(400);
    if (!href) return null;
    const url = new URL(href, location.href);
    return MRB.esSubida(url) ? url : null;
  };
  // Entre los links de las opciones de venta, el de esta publicación. Si no está a la vista,
  // cualquiera del mismo producto: el clip es del producto y se ve en todas sus opciones de venta.
  const elegirLink = (links, codigo) => {
    const propio = links.filter((u) => u.searchParams.get('item_id')?.toUpperCase() === codigo);
    if (propio.length > 0) return propio[0];
    const productos = new Set(links.map((u) => u.searchParams.get('user_product_id')).filter(Boolean));
    return links.length > 0 && productos.size === 1 && links.every((u) => u.searchParams.get('user_product_id')) ? links[0] : null;
  };

  try {
    const persona = MRB.pidePersona();
    if (persona) return await frenar(persona, false);

    // El listado del vendedor: Mercado Libre lo abre en /publicaciones/listado o lo pasa a /publicaciones.
    const enElListado = /^\/publicaciones(\/listado)?\/?$/.test(location.pathname) && new URLSearchParams(location.search).get('search')?.toUpperCase() === trabajo.codigo;
    if (trabajo.etapa === 'listado' && enElListado) {
      await decir(`Buscando la publicación ${trabajo.codigo}…`);
      if (!(await MRB.esperar(MRB.MENU))) return await frenar(MRB.pidePersona() ?? `La publicación ${trabajo.codigo} no aparece en tu listado de Mercado Libre.`);
      await MRB.pausa(800);
      const numero = trabajo.codigo.replace(/^[A-Z]+/, '');
      // Lo que se ve antes de desplegar nada: tiene que ser una sola fila, la del producto.
      const arriba = [...document.querySelectorAll(MRB.MENU)].filter((b) => MRB.visible(b) && !b.closest(MRB.MEDIDA));
      if (arriba.length === 0) return await frenar(`La publicación ${trabajo.codigo} no aparece en tu listado de Mercado Libre.`);
      // Varias filas: un producto con varias opciones de venta, cada una con su menú. Se lee a
      // qué publicación lleva el «Crear video» de cada una, sin tocar nada más.
      if (arriba.length > 1) {
        const links = [];
        for (const b of arriba) links.push(await linkDeCrear(b));
        const destino = elegirLink(links.filter(Boolean), trabajo.codigo);
        if (!destino) return await frenar(`El listado mostró ${arriba.length} publicaciones al buscar ${trabajo.codigo} y ninguna lleva a esa publicación ni a su mismo producto: no se sabe a cuál subirle el clip.`);
        await pedir({ tipo: 'etapa', etapa: 'crear' });
        location.assign(destino.href);
        return;
      }
      let boton = arriba[0];
      let codigos = null;
      // Un producto con varias medidas: se despliega y se entra por la medida que tiene esta publicación.
      const flecha = [...document.querySelectorAll(MRB.FLECHA)].find(MRB.visible);
      if (flecha) {
        if (flecha.getAttribute('aria-expanded') !== 'true') flecha.click();
        await MRB.esperar(MRB.MEDIDA, 15000);
        await MRB.pausa(800);
        const medidas = [...document.querySelectorAll(MRB.MEDIDA)].filter((f) => f.id === trabajo.codigo || MRB.codigosDe(f).includes(numero));
        if (medidas.length !== 1) return await frenar(`Entre las medidas del producto hay ${medidas.length} con la publicación ${trabajo.codigo}: no se sabe a cuál subirle el clip.`);
        codigos = MRB.codigosDe(medidas[0]);
        boton = [...medidas[0].querySelectorAll(MRB.MENU)].find(MRB.visible);
        if (!boton) return await frenar('La medida no tiene su menú de opciones. Puede que Mercado Libre haya cambiado la pantalla: no se tocó nada.');
      }
      boton.click();
      await MRB.esperar(MRB.OPCION, 10000);
      await MRB.pausa(300);
      const opciones = [...document.querySelectorAll(MRB.OPCION)].filter((a) => MRB.visible(a) && a.textContent.trim() === MRB.TEXTO_OPCION);
      if (opciones.length !== 1) return await frenar(`El menú de la publicación no ofrece «${MRB.TEXTO_OPCION}». Puede que Mercado Libre haya cambiado la pantalla: no se tocó nada.`);
      const destino = new URL(opciones[0].getAttribute('href') ?? '', location.href);
      const item = destino.searchParams.get('item_id') ?? '';
      if (!MRB.esSubida(destino)) {
        return await frenar('El link de Crear video no lleva a la subida de videos. Puede que Mercado Libre haya cambiado la pantalla: no se tocó nada.');
      }
      // En un producto con medidas, el link tiene que ser de una publicación de esa medida.
      if (codigos && !codigos.includes(item.replace(/^[A-Z]+/, ''))) return await frenar('El link de Crear video apunta a otra medida del producto: no se tocó nada.');
      await pedir({ tipo: 'etapa', etapa: 'crear' });
      location.assign(destino.href);
      return;
    }

    if (trabajo.etapa === 'crear' && location.pathname.includes('/video/creator/upload')) {
      await decir('Preparando el clip…');
      const campo = await MRB.esperar(MRB.ARCHIVO);
      if (!campo) return await frenar(MRB.pidePersona() ?? 'La pantalla Crear video no tiene dónde elegir el archivo. Puede que Mercado Libre la haya cambiado: no se tocó nada.');
      // El clip se ve en todas las medidas del producto, o solo en esta.
      const casilla = document.querySelector(MRB.TODAS);
      if (casilla && casilla.checked !== trabajo.todas) {
        casilla.click();
        await MRB.pausa(500);
      }
      if (casilla ? casilla.checked !== trabajo.todas : !trabajo.todas) {
        return await frenar('No se pudo elegir si el video se ve en todas las medidas o solo en esta. Puede que Mercado Libre haya cambiado la pantalla: no se subió nada.');
      }
      const antes = MRB.mirar();
      const videosAntes = document.querySelectorAll(MRB.VIDEO).length;

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
      await MRB.pausa(1500);
      const termino = await MRB.cargado();
      const persona2 = MRB.pidePersona();
      if (persona2) return await frenar(persona2, false);
      if (!termino) return await frenar('Mercado Libre tardó más de diez minutos en cargar el clip. Mirá la pestaña: puede que haya terminado o que haya que probar de nuevo.');
      await MRB.pausa(1000);
      // Al terminar, Mercado Libre suma el video a "Tus videos" con su estado: ahí termina la subida.
      const ahora = document.querySelectorAll(MRB.VIDEO).length;
      const informe = { antes, despues: MRB.mirar() };
      if (ahora <= videosAntes) return await decir(null, { error: 'Mercado Libre no sumó el video a «Tus videos». Mirá la pestaña: puede que lo haya rechazado.', informe });
      await decir('El clip quedó subido en Mercado Libre. Lo revisan antes de mostrarlo, puede tardar hasta 48 horas.', { listo: true, subido: true, informe });
      return;
    }

    if (trabajo.etapa === 'cargado') return;
    await frenar('Mercado Libre abrió una pantalla que no es la esperada: no se tocó nada.');
  } catch (e) {
    await frenar(`Algo falló en la extensión: ${String(e?.message ?? e)}`).catch(() => {});
  }
})();
