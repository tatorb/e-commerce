// En las pantallas de la app: avisa que la extensión está, cuenta cómo va la
// lectura y le pasa al fondo el pedido de leer ahora. No lee ni guarda nada de
// la página.
(() => {
  const decir = (datos) => window.postMessage({ origen: 'mrb-insur', ...datos }, location.origin);
  const estado = () =>
    chrome.runtime
      .sendMessage({ tipo: 'estado' })
      .then((r) => decir({ tipo: 'estado', ...r }))
      .catch(() => decir({ tipo: 'estado', version: null, error: 'La extensión se actualizó: recargá esta página.' }));

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.origen !== 'mrb-app-insur') return;
    if (e.data.tipo === 'estado') return estado();
    if (e.data.tipo !== 'correr') return;
    chrome.runtime
      .sendMessage({ tipo: 'correr', soloMostrar: e.data.soloMostrar === true })
      .then((r) => {
        decir({ tipo: 'pedido', ok: r?.ok === true, error: r?.error ?? null });
        return estado();
      })
      .catch(() => decir({ tipo: 'pedido', ok: false, error: 'La extensión se actualizó: recargá esta página.' }));
  });
  estado();
})();
