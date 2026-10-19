// RafaApp · Navegacion movil por configuracion
// -----------------------------------------------------------------------------
// Para añadir, quitar o reordenar una seccion de la barra inferior o de la hoja
// "Más", se edita SOLO el array SECCIONES.
//
// Este modulo no contiene logica de permisos ni de negocio. Cada seccion apunta
// a un boton que ya existe en index.html (`destino`) y reutiliza su manejador de
// app.js mediante element.click(). La visibilidad por rol tambien se hereda: si
// app.js oculta el boton destino (display:none en linea), la seccion desaparece
// de la barra y de la hoja sin tener que repetir aqui ninguna regla de roles.

export const SECCIONES = [
  // barra: true -> puede ocupar un hueco de la barra inferior, por orden de aparicion.
  { id: 'inicio',     etiqueta: 'Inicio',     icono: 'bxs-home',          destino: 'mobile-home-btn',   barra: true },
  { id: 'tareas',     etiqueta: 'Tareas',     icono: 'bx-calendar-check', destino: 'mobile-tasks-btn',  barra: true },
  { id: 'chats',      etiqueta: 'Chats',      icono: 'bx-chat',           destino: 'mobile-chat-btn',   barra: true, contador: 'chat-unread-count' },
  { id: 'eventos',    etiqueta: 'Eventos',    icono: 'bx-calendar-event', destino: 'mobile-events-btn', barra: true },
  { id: 'noticias',   etiqueta: 'Noticias',   icono: 'bx-broadcast',      accion: 'ir-a-noticias' },
  { id: 'juegos',     etiqueta: 'Juegos',     icono: 'bx-joystick',       destino: 'nav-games-btn' },
  { id: 'moderacion', etiqueta: 'Moderación', icono: 'bx-shield-quarter', destino: 'nav-moderation-btn', contador: 'moderation-count' },
  { id: 'buzon',      etiqueta: 'Buzón de soporte', icono: 'bx-support', destino: 'nav-support-inbox-btn', contador: 'support-inbox-count' },
  { id: 'roles',      etiqueta: 'Roles',      icono: 'bx-user-check',     destino: 'mobile-users-btn', contador: 'pending-accounts-count' },
  { id: 'soporte',    etiqueta: 'Soporte',    icono: 'bx-help-circle',    destino: 'support-fab' },
  { id: 'tema',       etiqueta: 'Tema',       icono: 'bx-moon',           destino: 'theme-toggle-btn' },
  { id: 'tutorial',   etiqueta: 'Tutorial',   icono: 'bx-book-open',      accion: 'ver-tutorial' },
];

// Huecos de la barra inferior, sin contar "Crear" (al centro) ni "Más" (al final).
const HUECOS_BARRA = 3;

const barra = document.querySelector('.mobile-bottom-bar nav');
const botonCrear = document.getElementById('mobile-open-modal-btn');
const botonMas = document.getElementById('mobile-more-btn');
const contadorMas = document.getElementById('mobile-more-count');
const hoja = document.getElementById('mas-sheet');
const listaHoja = document.getElementById('mas-sheet-list');
const cerrarHoja = document.getElementById('mas-sheet-close');

let seccionesEnHoja = [];

function disponible(seccion) {
  if (seccion.accion) return true;
  const destino = document.getElementById(seccion.destino);
  // app.js oculta por rol con display:none en linea; esa es la unica fuente de verdad.
  return Boolean(destino) && destino.style.display !== 'none';
}

function temaOscuro() {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

// Cifra de pendientes que muestra app.js en el elemento `contador` de una seccion.
function pendientes(seccion) {
  const fuente = seccion?.contador && document.getElementById(seccion.contador);
  if (!fuente || fuente.hidden) return 0;
  return Number(fuente.textContent) || 0;
}

function organizar() {
  if (!barra || !botonCrear || !botonMas) return;
  const visibles = SECCIONES.filter(disponible);
  const enBarra = visibles.filter((s) => s.barra).slice(0, HUECOS_BARRA);
  seccionesEnHoja = visibles.filter((s) => !enBarra.includes(s));

  // Se reordena el DOM (no solo con CSS `order`) para que el orden de tabulacion
  // coincida con el visual: [1] [2] [Crear] [3] [Más].
  const enBarraEls = enBarra.map((s) => document.getElementById(s.destino));
  const desplazados = [...barra.querySelectorAll('.mobile-nav-item')]
    .filter((b) => b !== botonCrear && b !== botonMas && !enBarraEls.includes(b));

  enBarraEls.forEach((b) => b.classList.remove('en-mas'));
  desplazados.forEach((b) => b.classList.add('en-mas'));

  const secuencia = [...enBarraEls.slice(0, 2), botonCrear, ...enBarraEls.slice(2), ...desplazados, botonMas];
  const actual = [...barra.children];
  if (secuencia.some((b, i) => actual[i] !== b)) secuencia.forEach((b) => barra.appendChild(b));

  botonMas.hidden = seccionesEnHoja.length === 0;
  actualizarContador();
}

function actualizarContador() {
  if (!contadorMas || !botonMas) return;
  // El boton Mas suma los pendientes de todas las secciones que hay dentro de la hoja.
  const n = seccionesEnHoja.reduce((total, s) => total + pendientes(s), 0);
  contadorMas.hidden = n === 0;
  contadorMas.textContent = String(n);
  botonMas.setAttribute('aria-label', n
    ? `Más opciones, ${n} ${n === 1 ? 'asunto pendiente' : 'asuntos pendientes'}`
    : 'Más opciones');
}

function crearItem(seccion) {
  const esTema = seccion.id === 'tema';
  const icono = esTema ? (temaOscuro() ? 'bx-sun' : 'bx-moon') : seccion.icono;
  const etiqueta = esTema ? (temaOscuro() ? 'Tema claro' : 'Tema oscuro') : seccion.etiqueta;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'mas-item';
  boton.dataset.seccion = seccion.id;

  const caja = document.createElement('span');
  caja.className = 'mas-item__icon';
  caja.setAttribute('aria-hidden', 'true');
  const i = document.createElement('i');
  i.className = `bx ${icono}`;
  caja.appendChild(i);

  const texto = document.createElement('span');
  texto.textContent = etiqueta;
  boton.append(caja, texto);

  if (seccion.contador) {
    const n = pendientes(seccion);
    if (n > 0) {
      const insignia = document.createElement('b');
      insignia.className = 'nav-count mas-item__badge';
      insignia.textContent = String(n);
      boton.appendChild(insignia);
      boton.setAttribute('aria-label', `${etiqueta}, ${n} pendientes`);
    }
  }

  boton.addEventListener('click', () => activar(seccion));
  return boton;
}

function activar(seccion) {
  // Primero se cierra la hoja: un <dialog> modal vive en la capa superior y
  // taparia cualquier modal que se abra a continuacion.
  hoja?.close();
  if (seccion.accion === 'ir-a-noticias') {
    document.querySelector('.news-widget')?.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'start' });
    return;
  }
  if (seccion.accion === 'ver-tutorial') {
    // Lo abre tutorial.js.
    document.dispatchEvent(new CustomEvent('rafa:ver-tutorial'));
    return;
  }
  document.getElementById(seccion.destino)?.click();
}

function abrirHoja() {
  if (!hoja || !listaHoja) return;
  // Se recalcula en el momento de abrir: la hoja siempre refleja los permisos
  // actuales aunque un cambio de rol llegara mientras la app estaba en segundo plano.
  organizar();
  listaHoja.replaceChildren(...seccionesEnHoja.map(crearItem));
  hoja.showModal();
}

botonMas?.addEventListener('click', abrirHoja);
cerrarHoja?.addEventListener('click', () => hoja.close());
// Tocar el fondo oscurecido cierra la hoja.
hoja?.addEventListener('click', (event) => {
  if (event.target !== hoja) return;
  const r = hoja.getBoundingClientRect();
  const fuera = event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
  if (fuera) hoja.close();
});

// Se reorganiza cuando app.js cambia la visibilidad por rol o el contador.
// setTimeout y no requestAnimationFrame: rAF se congela con la pagina oculta, y en
// Android el inicio de sesion con Google tapa el WebView justo cuando llegan los roles.
let pendiente = 0;
function programar() {
  if (pendiente) return;
  pendiente = setTimeout(() => { pendiente = 0; organizar(); }, 0);
}
const observador = new MutationObserver(programar);
SECCIONES.forEach((s) => {
  const el = s.destino && document.getElementById(s.destino);
  if (el) observador.observe(el, { attributes: true, attributeFilter: ['style'] });
});
SECCIONES.filter((s) => s.contador).forEach((s) => {
  const el = document.getElementById(s.contador);
  if (el) observador.observe(el, { attributes: true, attributeFilter: ['hidden'], childList: true, characterData: true, subtree: true });
});

organizar();

// El tutorial (tutorial.js) explica que hay dentro de "Más", que cambia segun el rol.
window.RafaNavegacion = {
  etiquetasEnMas() {
    organizar();
    return seccionesEnHoja.map((s) => s.etiqueta);
  },
};
