// Lo que se sabe de la pantalla de Mercado Libre, tomado del recorrido del
// 18/11/2026, y cómo mirarla. Lo usa mercadolibre.js.
const MRB = {
  MENU: 'button.sll-list-row-secondary-actions-trigger',
  OPCION: 'a.sll-list-row-secondary-action__label--link',
  TEXTO_OPCION: 'Crear video',
  ARCHIVO: 'input.clip-dropzone__file-input',
  // Un producto con varias medidas: la flechita que las despliega y la fila de cada medida.
  // Cada fila de medida lista los códigos de sus publicaciones, como #2265637921.
  FLECHA: 'button.sll-list-chevron-button__icon',
  MEDIDA: '.sll-list-expanded-row__row',
  CODIGO_EN_FILA: '.sc-copyable-element__text',
  TODAS: '#CHECKBOX_SHOW_VIDEO_IN_ALL_VARIANTS',

  visible(e) {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  },

  // Los códigos de publicación que lista una fila, sin el numeral: ["2265637921", ...].
  codigosDe(fila) {
    return [...fila.querySelectorAll(MRB.CODIGO_EN_FILA)].map((e) => e.textContent.trim()).filter((t) => /^#\d+$/.test(t)).map((t) => t.slice(1));
  },
  // Cada video de "Tus videos".
  VIDEO: '.clip-preview',

  esperar(selector, ms = 30000, raiz = document) {
    return new Promise((resolver) => {
      const ya = raiz.querySelector(selector);
      if (ya) return resolver(ya);
      const mirador = new MutationObserver(() => {
        const e = raiz.querySelector(selector);
        if (e) {
          mirador.disconnect();
          resolver(e);
        }
      });
      mirador.observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(() => {
        mirador.disconnect();
        resolver(null);
      }, ms);
    });
  },

  pausa: (ms) => new Promise((r) => setTimeout(r, ms)),

  // Si el link lleva a la subida de videos de una publicación de Mercado Libre.
  esSubida(url) {
    return /(^|\.)mercadolibre\.com\.ar$/.test(url.hostname) && url.pathname.includes('/video/creator/upload') && Boolean(url.searchParams.get('item_id'));
  },

  // Espera a que la pantalla deje de cambiar, por ejemplo mientras carga el video.
  async quieta(maximo = 180000, quieto = 4000) {
    let anterior = null;
    let igual = 0;
    for (let t = 0; t < maximo; t += 1000) {
      await MRB.pausa(1000);
      const ahora = `${document.body.innerText.length}|${document.querySelectorAll('button').length}|${location.href}`;
      igual = ahora === anterior ? igual + 1000 : 0;
      anterior = ahora;
      if (igual >= quieto) return;
    }
  },

  // Mientras Mercado Libre sube y procesa el video muestra un círculo girando.
  CARGANDO: '.clip-preview__loading, .andes-progress-indicator-circular',

  // Espera a que termine de cargar el video: sin círculo durante unos segundos seguidos.
  async cargado(maximo = 600000, quieto = 3000) {
    let sin = 0;
    for (let t = 0; t < maximo; t += 500) {
      await MRB.pausa(500);
      sin = document.querySelector(MRB.CARGANDO) ? 0 : sin + 500;
      if (sin >= quieto) return true;
    }
    return false;
  },

  // Si Mercado Libre pide algo que solo puede hacer la persona.
  pidePersona() {
    const url = location.href.toLowerCase();
    if (url.includes('/login') || document.querySelector('input[type=password]')) return 'La sesión de Mercado Libre está cerrada: iniciá sesión en esta pestaña y volvé a pedir la subida desde la app.';
    if (url.includes('captcha') || document.querySelector('iframe[src*=captcha], [id*=captcha]')) return 'Mercado Libre pidió resolver un captcha: resolvelo y volvé a pedir la subida desde la app.';
    if (url.includes('authentication') || url.includes('verification')) return 'Mercado Libre pidió verificar la identidad: hacelo y volvé a pedir la subida desde la app.';
    return null;
  },

  // Lo que hay en la pantalla, para entenderla sin verla.
  mirar() {
    const visible = (e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
    };
    const corto = (t) => (t || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const attrs = (e) =>
      Object.fromEntries(
        ['id', 'class', 'data-testid', 'aria-label', 'name', 'role', 'type', 'href', 'disabled', 'aria-disabled', 'accept'].filter((a) => e.hasAttribute(a)).map((a) => [a, corto(e.getAttribute(a))]),
      );
    const lista = (sel, max) =>
      [...document.querySelectorAll(sel)]
        .filter((e) => visible(e) && !e.closest('#mrb-clips-cartel'))
        .slice(0, max)
        .map((e) => ({ tag: e.tagName.toLowerCase(), texto: corto(e.innerText || e.value), ...attrs(e) }));
    return {
      url: location.href,
      titulo: document.title,
      encabezados: lista('h1, h2, h3', 20),
      botones: lista('button, [role=button], a.andes-button, input[type=submit]', 60),
      campos: lista('input:not([type=hidden]), textarea, select', 40),
      archivos: [...document.querySelectorAll('input[type=file]')].map((e) => attrs(e)),
      avisos: lista('[role=alert], [role=status], .andes-message, .andes-snackbar, [class*=error], [class*=progress]', 30),
      videos: lista('.clip-preview, [class*=clip-preview]', 20),
    };
  },
};
