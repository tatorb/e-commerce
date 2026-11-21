// La ventana de la extensión: la hora de la lectura diaria, el botón para leer
// ahora y cómo salió la última.
const el = (id) => document.getElementById(id);
const ETAPA = { empezando: 'Empezando', listado: 'Leyendo el listado de Insur', fichas: 'Leyendo fichas de Insur', enviando: 'Mandando a la app' };

function mostrar(e) {
  if (!e || e.ok === false) return;
  if (document.activeElement !== el('hora')) el('hora').value = e.hora.padStart(5, '0');
  const c = e.corriendo;
  el('ahora').disabled = Boolean(c);
  el('como').textContent = c ? `${ETAPA[c.etapa] ?? 'Trabajando'}. ${c.detalle ?? ''} Va ${Math.round((Date.now() - c.desde) / 60000)} min.` : 'Sin corridas en curso.';
  const u = e.ultimo;
  el('ultimo').className = `nota ${u ? (u.ok ? 'bien' : 'mal') : ''}`;
  el('ultimo').textContent = u ? `Última corrida, ${new Date(u.cuando).toLocaleString('es-AR')}: ${u.texto}` : 'Todavía no hubo ninguna corrida.';
}

const preguntar = () => chrome.runtime.sendMessage({ tipo: 'estado' }).then(mostrar).catch(() => {});

el('hora').addEventListener('change', () => chrome.runtime.sendMessage({ tipo: 'hora', hora: el('hora').value }).then(mostrar));
el('ahora').addEventListener('click', async () => {
  el('ahora').disabled = true;
  const r = await chrome.runtime.sendMessage({ tipo: 'correr', soloMostrar: el('solo').checked });
  if (r?.ok === false) el('como').textContent = r.error ?? 'No se pudo empezar.';
  preguntar();
});
preguntar();
setInterval(preguntar, 2000);
