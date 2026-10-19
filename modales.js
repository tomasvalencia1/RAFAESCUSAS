// RafaApp · Accesibilidad de las ventanas modales
// -----------------------------------------------------------------------------
// app.js abre y cierra cada ventana poniendo o quitando la clase `active` en su
// `.modal-overlay`. Este modulo observa esa clase y, sin tocar esos manejadores,
// añade lo que necesitan TalkBack y el teclado:
//   - role="dialog", aria-modal y como nombre el titulo de la ventana;
//   - aria-hidden al dia con lo que se ve;
//   - el foco entra al abrir (al campo con data-autofocus o a la ventana) y
//     vuelve al boton que la abrio al cerrar;
//   - Tab no se sale de la ventana abierta;
//   - Escape cierra lo que esta encima, igual que el boton Atras de Android
//     (window.onAndroidBack, en app.js).

const modales = [...document.querySelectorAll('.modal-overlay')];
const abiertos = new Map();   // modal -> elemento que tenia el foco al abrirse
let titulosSinId = 0;

function panelDe(modal) {
  return modal.querySelector('.modal-content') || modal;
}

function prepararModal(modal) {
  const panel = panelDe(modal);
  if (!panel.hasAttribute('role')) panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  if (!panel.hasAttribute('aria-labelledby') && !panel.hasAttribute('aria-label')) {
    const titulo = panel.querySelector('h2');
    if (titulo) {
      if (!titulo.id) titulo.id = `modal-titulo-${++titulosSinId}`;
      panel.setAttribute('aria-labelledby', titulo.id);
    }
  }
  // Permite enfocar la ventana misma cuando no tiene un campo con el que empezar.
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;
  modal.setAttribute('aria-hidden', String(!modal.classList.contains('active')));
}

function enfocables(modal) {
  return [...modal.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && !el.closest('[hidden]') && el.getClientRects().length > 0);
}

function alAbrir(modal) {
  abiertos.set(modal, document.activeElement);
  modal.setAttribute('aria-hidden', 'false');
  // Se espera a que la ventana se pinte. Si app.js ya puso el foco en un campo
  // (perfil, soporte, tareas), se respeta.
  setTimeout(() => {
    if (!modal.classList.contains('active') || modal.contains(document.activeElement)) return;
    const destino = modal.querySelector('[data-autofocus]:not([disabled])') || panelDe(modal);
    destino.focus({ preventScroll: true });
  }, 80);
}

function alCerrar(modal) {
  modal.setAttribute('aria-hidden', 'true');
  const origen = abiertos.get(modal);
  abiertos.delete(modal);
  const focoPerdido = modal.contains(document.activeElement) || document.activeElement === document.body;
  if (focoPerdido && origen?.isConnected && origen.getClientRects().length > 0) {
    origen.focus({ preventScroll: true });
  }
}

const observador = new MutationObserver((cambios) => {
  for (const { target } of cambios) {
    const activo = target.classList.contains('active');
    if (activo === abiertos.has(target)) continue;
    if (activo) alAbrir(target);
    else alCerrar(target);
  }
});

modales.forEach((modal) => {
  prepararModal(modal);
  if (modal.classList.contains('active')) abiertos.set(modal, null);
  observador.observe(modal, { attributes: true, attributeFilter: ['class'] });
});

// La ventana de encima es la ultima abierta en el documento (mismo criterio que
// onAndroidBack: "Nueva tarea" va despues de "Tareas").
function modalDeEncima() {
  const activos = document.querySelectorAll('.modal-overlay.active');
  return activos[activos.length - 1] || null;
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.defaultPrevented) {
    if (window.onAndroidBack?.()) event.preventDefault();
    return;
  }
  if (event.key !== 'Tab') return;
  const modal = modalDeEncima();
  if (!modal) return;
  const lista = enfocables(modal);
  if (!lista.length) { event.preventDefault(); return; }
  const primero = lista[0];
  const ultimo = lista[lista.length - 1];
  const actual = document.activeElement;
  const fuera = !modal.contains(actual) || actual === panelDe(modal);
  if (event.shiftKey && (actual === primero || fuera)) {
    event.preventDefault();
    ultimo.focus();
  } else if (!event.shiftKey && (actual === ultimo || fuera)) {
    event.preventDefault();
    primero.focus();
  }
});
