// En las pantallas de la app: avisa que la extensión está y pasa los pedidos de
// subida al fondo, y los avances del fondo a la pantalla.
(() => {
  const version = chrome.runtime.getManifest().version;
  const decir = (datos) => window.postMessage({ origen: 'mrb-clips', ...datos }, location.origin);

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.origen !== 'mrb-app') return;
    if (e.data.tipo === 'hola') return decir({ tipo: 'hola', version });
    if (e.data.tipo !== 'subir') return;
    const { publicacion, video, codigo, nombre, tipoDeArchivo } = e.data;
    chrome.runtime
      .sendMessage({ tipo: 'subir', publicacion, video, codigo, nombre, tipoDeArchivo })
      .then((r) => decir({ tipo: 'avance', publicacion, video, texto: r?.ok ? 'Abriendo la publicación en Mercado Libre…' : null, error: r?.ok ? null : (r?.error ?? 'La extensión no respondió.') }))
      .catch(() => decir({ tipo: 'avance', publicacion, video, texto: null, error: 'La extensión se actualizó: recargá esta página.' }));
  });

  chrome.runtime.onMessage.addListener((mensaje) => {
    if (mensaje?.tipo === 'avance') decir(mensaje);
  });
  decir({ tipo: 'hola', version });
})();
