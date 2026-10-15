// RafaConecta · Tutorial de bienvenida
// -----------------------------------------------------------------------------
// Recorrido guiado por la app: oscurece la pantalla, ilumina cada parte real
// (pestañas, Crear, barra inferior, perfil...) y explica para que sirve en una
// tarjeta. Se adapta al rol y al tamaño de pantalla: un paso cuyo elemento no se
// ve (por ejemplo el chat para un estudiante) se salta solo.
//
// Comunicacion con app.js, sin dependencias directas:
//   - app.js deja la sesion en window.rafaSesionActual y emite `rafa:sesion`
//     ({ uid, rol, esAdmin, nombre, cuentaNueva }). Con cuentaNueva, el tutorial
//     se abre solo la primera vez en ese telefono.
//   - `rafa:ver-tutorial` (Mas › Tutorial, o "Ver tutorial" en el perfil) lo abre
//     cuando la persona quiera.
//   - window.RafaTutorial.atras() lo usa el boton Atras de Android.
// Lo visto se guarda en el telefono (localStorage), como el tema.

const CLAVE_VISTO = 'rafaconecta-tutorial-visto-';
const MARGEN_FOCO = 8;

let sesion = null;
let raiz = null;
let pasos = [];
let indice = 0;
let focoAnterior = null;
let yaAbiertoSolo = false;
let recolocarPendiente = 0;

const esDocente = (rol) => ['profesor', 'maestro'].includes(rol);
const barraInferiorVisible = () => Boolean(document.querySelector('.mobile-bottom-bar')?.getClientRects().length);

function primerNombre(nombre) {
  return String(nombre || '').trim().split(/\s+/)[0] || '';
}

function enLista(etiquetas) {
  if (etiquetas.length <= 1) return etiquetas.join('');
  return `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`;
}

// Lo que hay dentro de la hoja "Más" depende del rol: lo calcula navegacion.js.
function contenidoDeMas() {
  const etiquetas = window.RafaNavegacion?.etiquetasEnMas?.() || [];
  const nombres = etiquetas
    .filter((e) => e !== 'Tutorial')
    .map((e) => (e === 'Tema' ? 'tema claro u oscuro' : e.toLowerCase()));
  return nombres.length ? enLista([...nombres, 'este tutorial']) : 'soporte, tema claro u oscuro y este tutorial';
}

// Cada paso: elemento a iluminar (el primero visible de `objetivos`) y su texto.
// Sin `objetivos`, la tarjeta va centrada (bienvenida y final). `si` decide si el
// paso aplica a esta persona y esta pantalla.
function definirPasos(s) {
  const rol = s?.rol || '';
  return [
    {
      titulo: `Te damos la bienvenida${primerNombre(s?.nombre) ? `, ${primerNombre(s.nombre)}` : ''}`,
      texto: 'RafaConecta es la red de la IE Rafael Uribe Uribe. En un minuto te mostramos dónde está cada cosa.',
      siguiente: 'Empezar',
    },
    {
      objetivos: ['.feed-tabs'],
      titulo: 'Inicio y Descubrir',
      texto: 'En Inicio ves lo que publican las personas que sigues y, siempre, al profesorado y la rectoría. En Descubrir está toda la comunidad y encuentras personas para seguir.',
    },
    {
      objetivos: ['#mobile-open-modal-btn', '#open-modal-btn'],
      titulo: 'Publicar',
      texto: `Toca aquí para compartir algo con texto o con una foto.${rol === 'estudiante' ? ' Tus publicaciones se ven durante 24 horas.' : ''}`,
    },
    {
      objetivos: ['.post-card .post-actions'],
      titulo: 'Me gusta, comentarios y seguir',
      texto: 'Dale me gusta o comenta cualquier publicación. Con Seguir ves a esa persona en tu Inicio; con profesores y directivos, Activar avisos te manda una notificación cuando publican.',
    },
    {
      objetivos: ['#teacher-messages-panel'],
      titulo: 'Mensajes del profesorado',
      texto: esDocente(rol) || s?.esAdmin
        ? 'Aquí publicas anuncios cortos: hasta 15 palabras y 3 al día. Se ven arriba para todos y llegan como notificación a toda la comunidad.'
        : 'Avisos cortos de tus profesores. También te llegan como notificación.',
    },
    {
      objetivos: ['.news-widget'],
      titulo: 'Noticias y reportes',
      texto: 'Las noticias del colegio y, al lado, el estado de trámites como boletines o paz y salvo.',
    },
    {
      objetivos: ['#mobile-tasks-btn', '#nav-tasks-btn'],
      titulo: 'Mis tareas',
      texto: 'Tu agenda personal: anota cada tarea con su fecha de entrega y márcala al terminarla. Solo tú la ves.',
    },
    {
      objetivos: ['#mobile-events-btn', '#nav-events-btn'],
      titulo: 'Eventos',
      texto: 'Las próximas actividades del colegio: jornadas, entregas de boletines y más.',
    },
    {
      objetivos: ['#mobile-chat-btn', '#nav-chat-btn'],
      titulo: 'Chat institucional',
      texto: 'Conversaciones privadas entre profesores, acudientes y directivos.',
    },
    {
      objetivos: ['#nav-games-btn'],
      si: () => !barraInferiorVisible(),
      titulo: 'Juegos y retos',
      texto: 'Un rato de juego entre clases.',
    },
    {
      objetivos: ['#mobile-more-btn'],
      titulo: 'Más',
      texto: () => `Aquí está lo que no cabe en la barra: ${contenidoDeMas()}.`,
    },
    {
      objetivos: ['#support-fab'],
      si: () => !barraInferiorVisible(),
      titulo: 'Soporte',
      texto: 'Si algo no funciona o necesitas ayuda, escribe aquí a los administradores.',
    },
    {
      objetivos: ['#profile-btn'],
      titulo: 'Tu perfil',
      texto: 'Toca tu foto para cambiar tu nombre o tu foto, elegir tema claro u oscuro, probar las notificaciones o cerrar sesión.',
    },
    {
      titulo: '¡Listo!',
      texto: barraInferiorVisible()
        ? 'Si algo no funciona, escribe a Soporte desde Más. Puedes repetir este recorrido en Más › Tutorial.'
        : 'Si algo no funciona, escribe a Soporte. Puedes repetir este recorrido desde tu perfil, en "Ver tutorial".',
      siguiente: 'Empezar a usar RafaConecta',
    },
  ];
}

function visible(el) {
  if (!el || !el.getClientRects().length) return false;
  const estilo = getComputedStyle(el);
  return estilo.visibility !== 'hidden' && estilo.display !== 'none';
}

function prepararPasos() {
  return definirPasos(sesion)
    .filter((paso) => !paso.si || paso.si())
    .map((paso) => ({ ...paso, elemento: (paso.objetivos || []).map((sel) => document.querySelector(sel)).find(visible) || null }))
    .filter((paso) => !paso.objetivos || paso.elemento);
}

function crearRaiz() {
  const el = document.createElement('div');
  el.className = 'tutorial';
  el.innerHTML = `
    <div class="tutorial__foco" aria-hidden="true"></div>
    <div class="tutorial__tarjeta" role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo" aria-describedby="tutorial-texto">
      <div aria-live="polite">
        <p class="tutorial__paso" id="tutorial-paso"></p>
        <h2 id="tutorial-titulo"></h2>
        <p id="tutorial-texto"></p>
      </div>
      <div class="tutorial__acciones">
        <button type="button" class="text-action-btn" data-tutorial="saltar">Saltar</button>
        <div class="tutorial__navegacion">
          <button type="button" class="action-btn" data-tutorial="atras">Atrás</button>
          <button type="button" class="btn-primary" data-tutorial="siguiente">Siguiente</button>
        </div>
      </div>
    </div>`;
  el.addEventListener('click', (event) => {
    const accion = event.target.closest('[data-tutorial]')?.dataset.tutorial;
    if (accion === 'siguiente') siguiente();
    else if (accion === 'atras') anterior();
    else if (accion === 'saltar') cerrar();
  });
  return el;
}

function iniciar() {
  if (raiz || !sesion) return;
  pasos = prepararPasos();
  indice = 0;
  focoAnterior = document.activeElement;
  raiz = crearRaiz();
  document.body.appendChild(raiz);
  document.addEventListener('keydown', alPulsarTecla, true);
  addEventListener('resize', programarColocar);
  addEventListener('scroll', programarColocar, true);
  mostrarPaso();
}

function cerrar() {
  if (!raiz) return;
  try { localStorage.setItem(CLAVE_VISTO + sesion.uid, String(Date.now())); } catch (error) { /* sin almacenamiento: no pasa nada */ }
  document.removeEventListener('keydown', alPulsarTecla, true);
  removeEventListener('resize', programarColocar);
  removeEventListener('scroll', programarColocar, true);
  raiz.remove();
  raiz = null;
  if (focoAnterior?.isConnected) focoAnterior.focus({ preventScroll: true });
}

function siguiente() {
  if (indice >= pasos.length - 1) { cerrar(); return; }
  indice += 1;
  mostrarPaso();
}

function anterior() {
  if (indice === 0) return;
  indice -= 1;
  mostrarPaso();
}

function mostrarPaso() {
  const paso = pasos[indice];
  const texto = typeof paso.texto === 'function' ? paso.texto() : paso.texto;
  raiz.querySelector('#tutorial-paso').textContent = `Paso ${indice + 1} de ${pasos.length}`;
  raiz.querySelector('#tutorial-titulo').textContent = paso.titulo;
  raiz.querySelector('#tutorial-texto').textContent = texto;
  raiz.querySelector('[data-tutorial="atras"]').hidden = indice === 0;
  raiz.querySelector('[data-tutorial="saltar"]').hidden = indice === pasos.length - 1;
  const boton = raiz.querySelector('[data-tutorial="siguiente"]');
  boton.textContent = paso.siguiente || 'Siguiente';

  // Lo que se ilumina tiene que verse: si queda fuera de la pantalla se desplaza
  // hasta el centro (tambien dentro de los carruseles horizontales).
  const el = paso.elemento;
  if (el) {
    const r = el.getBoundingClientRect();
    if (r.top < 72 || r.bottom > innerHeight - 72 || r.left < 0 || r.right > innerWidth) {
      el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }
  // Se coloca en el acto (scrollIntoView sin animacion ya movio la pagina) y otra
  // vez en el siguiente cuadro, por si las fuentes o una imagen cambian el tamaño.
  // No se depende solo de requestAnimationFrame: se congela con la pagina oculta.
  const tarjeta = raiz.querySelector('.tutorial__tarjeta');
  colocar();
  tarjeta.classList.add('is-visible');
  boton.focus({ preventScroll: true });
  programarColocar();
}

function programarColocar() {
  if (recolocarPendiente) return;
  recolocarPendiente = requestAnimationFrame(() => { recolocarPendiente = 0; if (raiz) colocar(); });
}

function colocar() {
  const foco = raiz.querySelector('.tutorial__foco');
  const tarjeta = raiz.querySelector('.tutorial__tarjeta');
  const vw = innerWidth;
  const vh = innerHeight;
  const tw = tarjeta.offsetWidth;
  const th = tarjeta.offsetHeight;
  const el = pasos[indice].elemento;

  if (!el) {
    // Sin elemento: todo oscurecido y la tarjeta en el centro.
    foco.style.transform = `translate(${vw / 2}px, ${vh / 2}px)`;
    foco.style.width = '0px';
    foco.style.height = '0px';
    tarjeta.style.transform = `translate(${Math.round((vw - tw) / 2)}px, ${Math.round((vh - th) / 2)}px)`;
    return;
  }

  const r = el.getBoundingClientRect();
  const x = Math.max(4, r.left - MARGEN_FOCO);
  const y = Math.max(4, r.top - MARGEN_FOCO);
  const w = Math.min(vw - 4, r.right + MARGEN_FOCO) - x;
  const h = Math.min(vh - 4, r.bottom + MARGEN_FOCO) - y;
  foco.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  foco.style.width = `${Math.round(w)}px`;
  foco.style.height = `${Math.round(h)}px`;

  // La tarjeta va debajo si cabe, si no encima; si no cabe en ninguno de los dos
  // lados (un elemento muy alto), abajo del todo, sobre la parte iluminada.
  const separacion = 12;
  let top;
  if (vh - (y + h) >= th + separacion + 16) top = y + h + separacion;
  else if (y >= th + separacion + 16) top = y - th - separacion;
  else top = vh - th - 16;
  const left = Math.min(Math.max(16, r.left + r.width / 2 - tw / 2), vw - tw - 16);
  tarjeta.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(16, top))}px)`;
}

function alPulsarTecla(event) {
  if (!raiz) return;
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cerrar(); return; }
  if (event.key === 'ArrowRight') { event.preventDefault(); siguiente(); return; }
  if (event.key === 'ArrowLeft') { event.preventDefault(); anterior(); return; }
  if (event.key !== 'Tab') return;
  // Tab no sale de la tarjeta.
  const botones = [...raiz.querySelectorAll('button')].filter((b) => !b.hidden);
  const primero = botones[0];
  const ultimo = botones[botones.length - 1];
  if (event.shiftKey && document.activeElement === primero) { event.preventDefault(); ultimo.focus(); }
  else if (!event.shiftKey && document.activeElement === ultimo) { event.preventDefault(); primero.focus(); }
  else if (!raiz.contains(document.activeElement)) { event.preventDefault(); primero.focus(); }
}

function yaVisto(uid) {
  try { return Boolean(localStorage.getItem(CLAVE_VISTO + uid)); } catch (error) { return false; }
}

// Se abre solo una vez la app ya esta en pantalla y sin otra ventana encima
// (por ejemplo, la de solicitud de rol). Se reintenta unos segundos.
function abrirCuandoEsteLista(intentos = 12) {
  const appVisible = document.getElementById('app-container')?.style.display !== 'none';
  const hayVentana = document.querySelector('.modal-overlay.active, .login-overlay.active, dialog[open]');
  if (appVisible && !hayVentana && document.querySelector('.post-card, #posts-container .glass-card')) { iniciar(); return; }
  if (intentos > 0) setTimeout(() => abrirCuandoEsteLista(intentos - 1), 700);
}

function alIniciarSesion(detalle) {
  sesion = detalle;
  if (!detalle?.cuentaNueva || yaAbiertoSolo || yaVisto(detalle.uid)) return;
  yaAbiertoSolo = true;
  setTimeout(() => abrirCuandoEsteLista(), 900);
}

document.addEventListener('rafa:sesion', (event) => alIniciarSesion(event.detail));
document.addEventListener('rafa:ver-tutorial', () => { if (sesion) iniciar(); });
// Si la sesion empezo antes de que cargara este modulo.
if (window.rafaSesionActual) alIniciarSesion(window.rafaSesionActual);

window.RafaTutorial = {
  abierto: () => Boolean(raiz),
  // Boton Atras de Android: paso anterior; en el primero, cierra el tutorial.
  atras() {
    if (!raiz) return false;
    if (indice > 0) anterior();
    else cerrar();
    return true;
  },
};
