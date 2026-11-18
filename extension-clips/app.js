// En las pantallas de la app: avisa que la extensión está y pasa los pedidos de
// subida al fondo, y los avances del fondo a la pantalla.
(() => {
  const version = chrome.runtime.getManifest().version;
  const decir = (datos) => window.postMessage({ origen: 'mrb-clips', ...datos }, location.origin);

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.origen !== 'mrb-app') return;
    if (e.data.tipo === 'hola' || e.data.tipo === 'cola') {
      // Si la extensión sube sola la cola; con «sola», además lo cambia.
      return chrome.runtime
        .sendMessage({ tipo: 'cola', ...(e.data.tipo === 'cola' && typeof e.data.sola === 'boolean' ? { sola: e.data.sola } : {}) })
        .then((r) => decir({ tipo: 'hola', version, sola: r?.sola === true }))
        .catch(() => decir({ tipo: 'hola', version, sola: false }));
    }
    if (e.data.tipo !== 'subir') return;
    const { publicacion, video, codigo, nombre, tipoDeArchivo, todasLasVariantes } = e.data;
    chrome.runtime
      .sendMessage({ tipo: 'subir', publicacion, video, codigo, nombre, tipoDeArchivo, todasLasVariantes })
      .then((r) => decir({ tipo: 'avance', publicacion, video, texto: r?.ok ? 'Abriendo la publicación en Mercado Libre…' : null, error: r?.ok ? null : (r?.error ?? 'La extensión no respondió.') }))
      .catch(() => decir({ tipo: 'avance', publicacion, video, texto: null, error: 'La extensión se actualizó: recargá esta página.' }));
  });

  chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje?.tipo === 'avance') decir(mensaje);
  });
  chrome.runtime
    .sendMessage({ tipo: 'cola' })
    .then((r) => decir({ tipo: 'hola', version, sola: r?.sola === true }))
    .catch(() => decir({ tipo: 'hola', version, sola: false }));
})();
