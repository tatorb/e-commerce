// En las pantallas de la app: avisa que la extensión está, cuenta cómo va la
// lectura y le pasa al fondo el pedido de leer ahora. No lee ni guarda nada de
// la página.
(() => {
  const decir = (datos) => window.postMessage({ origen: 'mrb-insur', ...datos }, location.origin);
  const VIEJA = 'La extensión se actualizó: recargá esta página.';
  // Cuando la extensión se recarga, esta copia que quedó en la página ya no
  // puede hablar con el fondo: Chrome lo corta de golpe, y hay que atajarlo.
  const pedir = (mensaje) => {
    try {
      return chrome.runtime.sendMessage(mensaje);
    } catch (e) {
      return Promise.reject(e);
    }
  };
  let cortada = false;
  const estado = () => {
    if (cortada) return decir({ tipo: 'estado', version: null, error: VIEJA });
    return pedir({ tipo: 'estado' })
      .then((r) => decir({ tipo: 'estado', ...r }))
      .catch(() => {
        cortada = true;
        decir({ tipo: 'estado', version: null, error: VIEJA });
      });
  };

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin || e.data?.origen !== 'mrb-app-insur') return;
    if (e.data.tipo === 'estado') return estado();
    if (e.data.tipo !== 'correr') return;
    if (cortada) return decir({ tipo: 'pedido', ok: false, error: VIEJA });
    pedir({ tipo: 'correr', soloMostrar: e.data.soloMostrar === true })
      .then((r) => {
        decir({ tipo: 'pedido', ok: r?.ok === true, error: r?.error ?? null });
        return estado();
      })
      .catch(() => decir({ tipo: 'pedido', ok: false, error: VIEJA }));
  });
  estado();
})();
