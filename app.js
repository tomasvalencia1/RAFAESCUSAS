import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, remove, get, update, query, orderByChild, orderByKey, limitToLast, startAt, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeUsf3QGFT3_J-k_KmvdJk61AMSiizOvI",
  authDomain: "rafaescusas.firebaseapp.com",
  databaseURL: "https://rafaescusas-default-rtdb.firebaseio.com",
  projectId: "rafaescusas",
  storageBucket: "rafaescusas.firebasestorage.app",
  messagingSenderId: "134452511415",
  appId: "1:134452511415:web:9213173d006f95c0048332",
  measurementId: "G-L4E0J0SGX8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();
// Siempre se muestra el selector de cuentas de Google: en un telefono compartido
// o tras entrar con la cuenta equivocada, se puede elegir otra.
provider.setCustomParameters({ prompt: 'select_account' });
const isAndroidDevice = /Android/i.test(navigator.userAgent);

let lastHapticTime = 0;
window.hapticTap = function(type = 1) {
    // type: 1 = Tap normal, 2 = Confirmación/Éxito, 3 = Eliminar/Error
    const now = Date.now();
    if (now - lastHapticTime < 50) return; // debounce
    lastHapticTime = now;
    
    if (window.AndroidFCM && typeof window.AndroidFCM.triggerHaptic === 'function') {
        // Usar motor háptico premium de Android (HapticFeedbackConstants)
        window.AndroidFCM.triggerHaptic(type);
    } else if ('vibrate' in navigator) {
        // Fallback para web tradicional
        if (type === 2) navigator.vibrate([40, 60, 40]);
        else if (type === 3) navigator.vibrate([50, 40, 50]);
        else navigator.vibrate(40);
    }
}

document.body.addEventListener('click', (e) => {
    // Detect interactive elements
    const isButton = e.target.closest('button, .btn, .action-btn, a, .role-card, .contact-item, .nav-btn, .mobile-nav-btn, .tic-tac-toe-cell');
    if (!isButton) return;
    
    // Determine firmness based on button type
    if (isButton.closest('.delete-news-btn, .delete-report-btn, .delete-event-btn, .delete-post-btn, .delete-comment-btn, .task-delete-btn')) {
        window.hapticTap(3); // Destructive
    } else if (isButton.closest('#publish-post-btn, #publish-news-btn, #publish-report-btn, #publish-event-btn, #save-task-btn, .comment-submit-btn, #send-message-btn, .task-complete-btn')) {
        window.hapticTap(5); // Fireworks / Success (Publish)
    } else {
        window.hapticTap(1); // Standard solid tap
    }
}, true); // Use capture phase so it runs before any other click listener

// WebView Detection for Android Status Bar
// WebView Detection for Android Status Bar (AVANZADO)
let isApp = false;
const ua = navigator.userAgent;

// 1. Detectar webviews de Android comunes y antiguos
if (/Android/i.test(ua) && (/wv|WebView|Version\//i.test(ua))) {
    isApp = true;
}
// 2. Detectar si la web fue instalada como aplicación (PWA)
if (window.matchMedia('(display-mode: standalone)').matches) {
    isApp = true;
}
// 3. Forzar el margen en CUALQUIER dispositivo Android (infalible)
// Si prefieres que el margen se aplique a todos los celulares Android, descomenta la siguiente línea:
isApp = /Android/i.test(ua);

if (isApp) {
    document.body.classList.add('is-webview');
}

function isAndroidWebView() {
    return /Android/i.test(navigator.userAgent) && (
        /wv|WebView|Version\//i.test(navigator.userAgent) ||
        typeof window.AndroidFCM !== 'undefined'
    );
}

function getAndroidBridge() {
    return window.AndroidFCM && typeof window.AndroidFCM.signInWithGoogle === 'function'
        ? window.AndroidFCM
        : null;
}

function checkApkVersion() {
    if (!isAndroidWebView()) return true;

    let currentVersion = 1;
    if (window.AndroidFCM && typeof window.AndroidFCM.getVersionCode === 'function') {
        currentVersion = window.AndroidFCM.getVersionCode();
    }

    const REQUIRED_APK_VERSION = 3;

    if (currentVersion < REQUIRED_APK_VERSION) {
        const updateOverlay = document.createElement('div');
        updateOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(10,8,5,0.98);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;flex-direction:column;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
        
        updateOverlay.innerHTML = `
            <div style="background:#241e18;padding:32px;border-radius:24px;border:1px solid rgba(255,250,242,0.1);max-width:400px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                <div style="font-size:64px;margin-bottom:20px;line-height:1;">⚠️</div>
                <h2 style="font-size:22px;font-weight:700;color:#fffaf2;margin-bottom:12px;font-family:'Inter',sans-serif;letter-spacing:-0.5px;">Instale la nueva versión de RafaApp</h2>
                <p style="font-size:14px;color:rgba(255,250,242,0.7);line-height:1.5;font-family:'Inter',sans-serif;">
                    Desinstale esta versión e instale la versión actualizada para continuar usando la aplicación.
                </p>
            </div>
        `;
        document.body.appendChild(updateOverlay);
        return false;
    }
    return true;
}

checkApkVersion();

function waitForAndroidBridge(timeout = 1200) {
    return new Promise((resolve) => {
        const startedAt = Date.now();
        const check = () => {
            const bridge = getAndroidBridge();
            if (bridge) {
                resolve(bridge);
                return;
            }

            if (Date.now() - startedAt >= timeout) {
                resolve(null);
                return;
            }

            setTimeout(check, 100);
        };

        check();
    });
}

// DOM Elements
const authLoadingScreen = document.getElementById('auth-loading-screen');
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginGoogleBtn = document.getElementById('login-google-btn');
const logoutBtn = document.getElementById('logout-btn');
const headerAvatar = document.getElementById('header-avatar');
const headerUsername = document.getElementById('header-username');

// Profile
const profileBtn = document.getElementById('profile-btn');
const profilePopover = document.getElementById('profile-popover');
const profileBackBtn = document.getElementById('profile-back-btn');

const postsContainer = document.getElementById('posts-container');
const newsContainer = document.getElementById('news-container');
const reportsContainer = document.getElementById('reports-container');
const eventsListContainer = document.getElementById('events-list-container');
const taskCalendarGrid = document.getElementById('task-calendar-grid');
const taskCalendarMonthLabel = document.getElementById('task-calendar-month-label');
const taskListTitle = document.getElementById('task-list-title');
const tasksList = document.getElementById('tasks-list');
const clearTaskDateFilterBtn = document.getElementById('clear-task-date-filter-btn');

// Modals
const postModal = document.getElementById('post-modal');
const newsModal = document.getElementById('news-modal');
const reportModal = document.getElementById('report-modal');
const eventsViewModal = document.getElementById('events-view-modal');
const eventCreateModal = document.getElementById('event-create-modal');
const tasksModal = document.getElementById('tasks-modal');
const taskCreateModal = document.getElementById('task-create-modal');
const roleSelectionScreen = document.getElementById('role-selection-screen');
const pendingApprovalScreen = document.getElementById('pending-approval-screen');
const roleRequestModal = document.getElementById('role-request-modal');
const roleRequestModalMessage = document.getElementById('role-request-modal-message');
const roleRequestModalBtn = document.getElementById('role-request-modal-btn');
const chatPanel = document.getElementById('chat-panel');
const adminUsersModal = document.getElementById('admin-users-modal');

// Chat Elements
const navChatBtn = document.getElementById('nav-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatContactsList = document.getElementById('chat-contacts-list');
const chatSearchInput = document.getElementById('chat-search-input');
const chatConversation = document.getElementById('chat-conversation');
const chatEmptyState = document.getElementById('chat-empty-state');
const conversationMessages = document.getElementById('conversation-messages');
const chatMessageInput = document.getElementById('chat-message-input');
const sendMessageBtn = document.getElementById('send-message-btn');
const backToContactsBtn = document.getElementById('back-to-contacts-btn');
const chatActiveAvatar = document.getElementById('chat-active-avatar');
const chatActiveName = document.getElementById('chat-active-name');
const chatActiveRole = document.getElementById('chat-active-role');

// Admin Elements
const navUsersBtn = document.getElementById('nav-users-btn');
const adminUsersList = document.getElementById('admin-users-list');
const adminUserSearchInput = document.getElementById('admin-user-search-input');
const closeUsersModalBtn = document.getElementById('close-users-modal-btn');

// Image Upload Elements
let currentPostImageBase64 = null;
const postImageInput = document.getElementById('post-image-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const postImagePreview = document.getElementById('post-image-preview');
const removeImageBtn = document.getElementById('remove-image-btn');

// Admin Buttons (Display toggle)
const adminBtns = document.querySelectorAll('.admin-only');
const addNewsBtn = document.getElementById('add-news-btn');
const addReportBtn = document.getElementById('add-report-btn');
const addEventBtn = document.getElementById('add-event-btn');

// Nav & Inputs
const navEventsBtn = document.getElementById('nav-events-btn');
const navTasksBtn = document.getElementById('nav-tasks-btn');
const mobileHomeBtn = document.getElementById('mobile-home-btn');
const mobileChatBtn = document.getElementById('mobile-chat-btn');
const mobileOpenModalBtn = document.getElementById('mobile-open-modal-btn');
const mobileEventsBtn = document.getElementById('mobile-events-btn');
const mobileTasksBtn = document.getElementById('mobile-tasks-btn');
const mobileUsersBtn = document.getElementById('mobile-users-btn');
const studentHiddenEls = document.querySelectorAll('.student-hidden');
const teacherChatEls = document.querySelectorAll('.teacher-chat-only');
const rightSidebar = document.querySelector('.right-sidebar');

// Globals
let currentUser = null;
let isAdmin = false;
let userRole = null;
let allPostsCache = [];
let activeChatId = null;
let activeChatListener = null;
let chatContactsListener = null;
let allContactsCache = [];
let allAdminUsersCache = [];
let allRoleRequestsCache = {};
// Aprobacion de cuentas (ver aprobados/{uid} en las reglas).
let cuentaAprobada = true;
// Tutorial de bienvenida (tutorial.js): se abre solo a las cuentas nuevas, es decir,
// la que acaba de ser aprobada en esta sesion o la creada desde que existe el
// tutorial (hace menos de 30 dias). Las cuentas de antes no lo ven solas.
const TUTORIAL_DESDE = Date.UTC(2026, 9, 15);
const TUTORIAL_CUENTA_NUEVA_MS = 30 * 24 * 60 * 60 * 1000;
let perfilCreadoEn = 0;
let recienAprobada = false;
let aprobacionListener = null;
let aprobadosCache = {};
let adminAprobadosListener = null;
let personalTasksCache = [];
let personalTasksListener = null;
let taskCalendarDate = new Date();
let selectedTaskDate = null;
let hasResolvedInitialAuth = false;
let initialAuthFinishPromise = null;
let isLoginInProgress = false;
let pendingAndroidFcmToken = null;
let androidGoogleSignInTimeout = null;

// === AVISOS BREVES ===
// Sustituyen a alert(): no bloquean la pantalla y el lector de pantalla los lee
// (#aviso tiene role="status"). Con `accion`, el aviso ofrece un boton, p. ej.
// "Reintentar". Los mensajes hablan como el usuario: nada de Firebase ni reglas.
const avisoEl = document.getElementById('aviso');
const avisoTexto = document.getElementById('aviso-texto');
const avisoBoton = document.getElementById('aviso-accion');
let avisoTemporizador = 0;
let avisoAccion = null;

function avisar(mensaje, { accion = null, textoAccion = 'Reintentar' } = {}) {
    if (!avisoEl) return;
    avisoAccion = accion;
    avisoTexto.textContent = mensaje;
    avisoBoton.hidden = !accion;
    avisoBoton.textContent = textoAccion;
    avisoEl.classList.add('is-visible');
    programarCierreAviso();
}

function programarCierreAviso() {
    clearTimeout(avisoTemporizador);
    // Con boton se deja mas tiempo para alcanzarlo.
    avisoTemporizador = setTimeout(cerrarAviso, avisoAccion ? 10000 : 6000);
}

function cerrarAviso() {
    clearTimeout(avisoTemporizador);
    avisoEl?.classList.remove('is-visible');
    avisoAccion = null;
}

avisoBoton?.addEventListener('click', () => {
    const accion = avisoAccion;
    cerrarAviso();
    accion?.();
});
// Mientras el dedo o el foco estan sobre el aviso, no se cierra solo.
avisoEl?.addEventListener('pointerenter', () => clearTimeout(avisoTemporizador));
avisoEl?.addEventListener('focusin', () => clearTimeout(avisoTemporizador));
avisoEl?.addEventListener('pointerleave', () => { if (avisoEl.classList.contains('is-visible')) programarCierreAviso(); });
avisoEl?.addEventListener('focusout', () => { if (avisoEl.classList.contains('is-visible')) programarCierreAviso(); });

// Formularios de varios campos: en vez de no hacer nada, se marcan los campos
// vacios, se pone el foco en el primero y se dice exactamente que falta.
// `campos` es una lista de [campo, mensaje si esta vacio].
function faltanCampos(campos) {
    const vacios = campos.filter(([campo]) => campo && !campo.value.trim());
    campos.forEach(([campo]) => campo?.setAttribute('aria-invalid', String(vacios.some(([vacio]) => vacio === campo))));
    if (!vacios.length) return false;
    const [primero, mensaje] = vacios[0];
    primero.focus();
    avisar(mensaje);
    return true;
}
document.addEventListener('input', event => {
    if (event.target.getAttribute?.('aria-invalid') === 'true' && event.target.value.trim()) {
        event.target.setAttribute('aria-invalid', 'false');
    }
});

// Botones de envio de un solo campo: se activan solo cuando hay algo que enviar.
// Mientras se envia (aria-busy) el boton sigue desactivado aunque se escriba.
const contenidoRequerido = new Map();
function exigirContenido(boton, hayContenido, campos) {
    if (!boton) return;
    contenidoRequerido.set(boton, hayContenido);
    campos.forEach(campo => campo?.addEventListener('input', () => revisarContenido(boton)));
    revisarContenido(boton);
}
function revisarContenido(boton) {
    const hayContenido = contenidoRequerido.get(boton);
    if (!boton || !hayContenido || boton.getAttribute('aria-busy') === 'true') return;
    boton.disabled = !hayContenido();
}
// 'maestro' se mantiene aquí solo por compatibilidad con cuentas antiguas que ya
// tenían ese rol guardado en la base de datos. Ya no se puede elegir desde el menú.
const TEACHER_CHAT_ROLES = ['maestro', 'profesor', 'padre', 'acudiente', 'directivo'];
// Roles que un usuario puede elegir sin aprobación (autoservicio, riesgo bajo).
const SELF_SERVICE_ROLES = ['estudiante'];
// Roles que requieren aprobación de un administrador antes de activarse.
const RESTRICTED_ROLES = ['profesor', 'padre', 'directivo'];

function normalizeRole(role) {
    return (role || '').toString().toLowerCase();
}

function getRoleClass(role) {
    const normalized = normalizeRole(role);
    // Cuentas antiguas con rol "maestro" se muestran/agrupan visualmente como "profesor".
    const merged = normalized === 'maestro' ? 'profesor' : normalized;
    return merged.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'sin-rol';
}

function canUseTeacherChat(role = userRole) {
    return isAdmin || TEACHER_CHAT_ROLES.includes(normalizeRole(role));
}

// The school requested that destructive moderation controls remain exclusive
// to accounts explicitly registered in the legacy `admins/{uid}` node.
function canManageContent() {
    return isAdmin;
}

function canDeletePost(post) {
    if (!currentUser || !post) return false;
    const authorId = post.author?.uid || post.autorId || '';
    return canManageContent() || authorId === currentUser.uid;
}

// Pueden publicar avisos del profesorado: profesores y administradores.
function puedePublicarAvisos() {
    return isProfessor() || isAdmin;
}

function isProfessor() {
    return ['profesor', 'maestro'].includes(normalizeRole(userRole));
}

function isTeacherChatContactRole(role) {
    return TEACHER_CHAT_ROLES.includes(normalizeRole(role));
}

function formatRoleLabel(role) {
    const labels = {
        estudiante: 'Estudiante',
        maestro: 'Profesor', // alias heredado: se etiqueta igual que "profesor"
        profesor: 'Profesor',
        padre: 'Padre de familia',
        acudiente: 'Acudiente',
        directivo: 'Directivo'
    };
    return labels[normalizeRole(role)] || 'Sin rol';
}

function escapeHTML(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
}

function tokenToFirebaseKey(token) {
    return btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function saveAndroidFcmToken(token) {
    if (!token) return;
    pendingAndroidFcmToken = token;
    if (!currentUser || !currentUser.uid) return;

    try {
        await set(ref(db, `fcmTokens/${currentUser.uid}/${tokenToFirebaseKey(token)}`), token);
        pendingAndroidFcmToken = null;
    } catch (error) {
        console.error('No se pudo guardar el token FCM:', error);
    }
}

window.registerAndroidFcmToken = saveAndroidFcmToken;
window.addEventListener('androidFcmToken', (event) => {
    saveAndroidFcmToken(event.detail);
});

// The native APK exposes these optional methods. Existing APKs keep working;
// the notification-enabled build will request Android 13+ permission and pass
// its current FCM token through the function above.
async function initializeAndroidNotifications() {
    const bridge = window.AndroidFCM;
    if (!bridge || !currentUser) return;

    try {
        if (typeof bridge.requestNotificationPermission === 'function'
            && !localStorage.getItem('rafa-notifications-requested')) {
            localStorage.setItem('rafa-notifications-requested', 'true');
            await Promise.resolve(bridge.requestNotificationPermission());
        }

        const getToken = bridge.getFcmToken || bridge.getNotificationToken;
        if (typeof getToken === 'function') {
            const token = await Promise.resolve(getToken.call(bridge));
            if (token) await saveAndroidFcmToken(token);
        }
    } catch (error) {
        // Permission can be rejected by the user. The app itself must remain
        // fully usable and Android may provide the token later by event.
        console.warn('No se pudieron inicializar las notificaciones Android:', error);
    }
}

// === AVISO AL DESPACHADOR DE NOTIFICACIONES ===
// Tras publicar algo notificable se avisa a /api/notificar (Vercel), que envia las
// notificaciones al momento. Se agrupan los avisos seguidos en uno solo. Si falla,
// no pasa nada: el respaldo de GitHub Actions lo recoge mas tarde.
let avisoNotificacionesPendiente = null;
function avisarDespachadorDeNotificaciones() {
    clearTimeout(avisoNotificacionesPendiente);
    avisoNotificacionesPendiente = setTimeout(async () => {
        try {
            const token = await auth.currentUser?.getIdToken();
            if (!token) return;
            await fetch('/api/notificar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, keepalive: true });
        } catch (error) { /* las notificaciones nunca bloquean la app */ }
    }, 1200);
}

// === PRUEBA DE NOTIFICACIONES (panel de perfil) ===
// Envia una notificacion de prueba solo a los telefonos de quien la pide.
const testNotificationsBtn = document.getElementById('test-notifications-btn');
if (testNotificationsBtn) testNotificationsBtn.addEventListener('click', async () => {
    const etiqueta = testNotificationsBtn.querySelector('strong');
    const mostrar = (texto, ms = 6000) => {
        if (etiqueta) etiqueta.textContent = texto;
        setTimeout(() => { if (etiqueta) etiqueta.textContent = 'Probar notificaciones'; testNotificationsBtn.disabled = false; }, ms);
    };
    testNotificationsBtn.disabled = true;
    if (etiqueta) etiqueta.textContent = 'Enviando…';
    try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return mostrar('Inicia sesión primero');
        const res = await fetch('/api/notificar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ prueba: true })
        });
        const datos = await res.json().catch(() => ({}));
        if (res.status === 503) return mostrar('Falta configurar el servidor');
        if (!res.ok) return mostrar('No se pudo enviar la prueba');
        if (datos.motivo === 'sin-dispositivos') {
            // En la APK, se pide de nuevo el token para que el telefono quede registrado.
            if (window.AndroidFCM?.requestToken) window.AndroidFCM.requestToken();
            return mostrar(window.AndroidFCM ? 'Registrando este teléfono… prueba otra vez' : 'Ningún teléfono registrado');
        }
        mostrar(datos.entregadas ? `Enviada a ${datos.entregadas} teléfono(s)` : 'No se pudo entregar');
    } catch (error) {
        mostrar('Sin conexión con el servidor');
    }
});

async function signInWithAndroidGoogle(idToken) {
    if (!idToken) {
        setLoginButtonLoading(false);
        avisar('No se pudo completar el inicio de sesión con Google.', { accion: () => loginGoogleBtn.click() });
        return;
    }

    setLoginButtonLoading(true);
    clearTimeout(androidGoogleSignInTimeout);
    androidGoogleSignInTimeout = setTimeout(() => {
        setLoginButtonLoading(false);
        avisar('El inicio de sesión tardó demasiado. Revisa tu conexión.', { accion: () => loginGoogleBtn.click() });
    }, 20000);

    try {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        clearTimeout(androidGoogleSignInTimeout);
    } catch (error) {
        clearTimeout(androidGoogleSignInTimeout);
        console.error('No se pudo iniciar sesion con Google nativo:', error);
        setLoginButtonLoading(false);
        avisar('No se pudo iniciar sesión con Google.', { accion: () => loginGoogleBtn.click() });
    }
}

window.signInWithAndroidGoogle = signInWithAndroidGoogle;
window.addEventListener('androidGoogleSignInFailed', () => {
    clearTimeout(androidGoogleSignInTimeout);
    setLoginButtonLoading(false);
});

function escapeAttribute(value) {
    return (value == null ? '' : String(value))
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function sanitizeName(name) {
    if (!name) return 'Usuario';
    try {
        return decodeURIComponent(escape(name));
    } catch (e) {
        return name;
    }
}

function safeImageSrc(value, fallback = "https://i.pravatar.cc/150?img=68") {
    const src = (value || '').toString().trim();
    if (!src) return fallback;
    if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src)) return src;

    try {
        const url = new URL(src, window.location.origin);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (error) {
        if (/^[a-z0-9_./-]+\.(png|jpe?g|gif|webp|svg)$/i.test(src) && !src.includes('..')) return src;
    }

    return fallback;
}

function escapeSelector(value) {
    const text = value == null ? '' : String(value);
    return window.CSS && CSS.escape ? CSS.escape(text) : text.replace(/["\\]/g, '\\$&');
}

function renderInlineStatus(container, message) {
    if (!container) return;
    container.innerHTML = `<p style="color:var(--text-muted);text-align:center;margin:20px 14px;font-size:13px;line-height:1.45;">${escapeHTML(message)}</p>`;
}

function formatChatDate(timestamp) {
    const date = new Date(timestamp || Date.now());
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === yesterday.toDateString()) return 'Ayer';

    return date.toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function formatChatTime(timestamp) {
    return new Date(timestamp || Date.now()).toLocaleTimeString('es-CO', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function getChatMessageSenderId(message) {
    return message?.senderId || message?.sender || message?.uid || message?.userId || message?.authorUid || message?.authorId || message?.from || '';
}

// El nombre sale del perfil real de quien envia (por su id), nunca del nombre
// guardado en el mensaje: asi nadie puede firmar con el nombre de otro.
function getChatSenderName(message, targetUser, isMe) {
    if (isMe) return sanitizeName(miNombre());
    const senderId = getChatMessageSenderId(message);
    if (senderId === targetUser?.uid && targetUser.name) return sanitizeName(targetUser.name);
    return sanitizeName(nombreVisible(senderId, message.senderName || 'Contacto'));
}

// === DIRECTORIO: NOMBRE Y FOTO REALES DE CADA PERSONA ===
// Lo que se muestra de cada autor (publicaciones, comentarios, chat, avisos) se
// toma de su perfil en users/{uid}, no de la copia que guarda cada mensaje.
// Las copias solo se usan si la persona ya no esta en el directorio.
let directorioPorUid = new Map();

function perfilDe(uid) {
    if (!uid) return null;
    if (uid === currentUser?.uid) return { name: miNombre(), avatar: miAvatar() };
    return directorioPorUid.get(uid) || null;
}

function nombreVisible(uid, respaldo = 'Usuario') {
    return perfilDe(uid)?.name || respaldo || 'Usuario';
}

function avatarVisible(uid, respaldo = '') {
    const perfil = perfilDe(uid);
    return perfil ? (perfil.avatar || '') : respaldo;
}

// Los elementos marcados con data-nombre-de / data-foto-de se actualizan cuando
// llega o cambia el directorio (puede llegar despues que las publicaciones).
function refrescarAutoresVisibles() {
    document.querySelectorAll('[data-nombre-de]').forEach(el => {
        const perfil = perfilDe(el.dataset.nombreDe);
        if (perfil?.name && el.textContent !== perfil.name) el.textContent = perfil.name;
    });
    document.querySelectorAll('[data-foto-de]').forEach(img => {
        const perfil = perfilDe(img.dataset.fotoDe);
        if (!perfil) return;
        const src = safeImageSrc(perfil.avatar);
        if (img.getAttribute('src') !== src) img.src = src;
    });
}

// === THEME LOGIC ===
// El tema oscuro es el predeterminado. El script en linea de index.html lo aplica
// antes de pintar, para que no haya parpadeo; aqui solo vive el conmutador. El tema
// unicamente cambia cuando el usuario lo elige, nunca por la preferencia del sistema.
const TEMA_CLAVE = 'rafaconecta-tema';

function temaActual() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function aplicarTema(tema, recordar = true) {
    document.documentElement.setAttribute('data-theme', tema);
    // Color de la barra del navegador y de la barra de estado en la PWA.
    document.getElementById('meta-theme-color')?.setAttribute('content', tema === 'light' ? '#FBFAF9' : '#171312');
    if (recordar) {
        try { localStorage.setItem(TEMA_CLAVE, tema); } catch (e) { /* almacenamiento no disponible */ }
    }
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        const esOscuro = tema === 'dark';
        btn.setAttribute('aria-pressed', String(esOscuro));
        const icono = btn.querySelector('i');
        if (icono) icono.className = esOscuro ? 'bx bx-sun' : 'bx bx-moon';
        const etiqueta = btn.querySelector('strong');
        if (etiqueta) etiqueta.textContent = esOscuro ? 'Tema claro' : 'Tema oscuro';
    }
}

// Sincroniza el estado visual del conmutador con el tema ya aplicado.
aplicarTema(temaActual(), false);

document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    aplicarTema(temaActual() === 'dark' ? 'light' : 'dark');
});

// === PROFILE POPOVER LOGIC ===
function openProfilePopover() {
    profilePopover.classList.add('active');
    document.body.classList.add('profile-menu-open');
    updateProfileStats();
}

function closeProfilePopover() {
    profilePopover.classList.remove('active');
    document.body.classList.remove('profile-menu-open');
}

profileBtn.addEventListener('click', (e) => {
    // El panel está dentro del disparador de perfil. Sus propios botones no
    // deben volver a alternar/cerrar el menú al hacer clic en ellos.
    if (e.target.closest('.profile-popover')) return;
    e.stopPropagation();
    if (profilePopover.classList.contains('active')) {
        closeProfilePopover();
    } else {
        openProfilePopover();
    }
});

if (profileBackBtn) {
    profileBackBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeProfilePopover();
    });
}

document.addEventListener('click', (e) => {
    if (!profilePopover.contains(e.target) && !profileBtn.contains(e.target)) {
        closeProfilePopover();
    }
});

function updateProfileStats() {
    if (!currentUser) return;

    let userPostsCount = 0;
    let userLikesCount = 0;

    allPostsCache.forEach(post => {
        if (post.author?.uid === currentUser.uid) {
            userPostsCount++;
            userLikesCount += (post.likes ? Object.keys(post.likes).length : 0);
        }
    });

    document.getElementById('popover-avatar').src = safeImageSrc(miAvatar());
    document.getElementById('popover-name').textContent = miNombre();
    document.getElementById('popover-email').textContent = currentUser.email;
    document.getElementById('popover-posts-count').textContent = userPostsCount;
    document.getElementById('popover-likes-count').textContent = userLikesCount;

    const creationTime = new Date(currentUser.metadata.creationTime);
    document.getElementById('popover-date').textContent = creationTime.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const lastLogin = currentUser.metadata.lastSignInTime ? new Date(currentUser.metadata.lastSignInTime) : null;
    const roleEl = document.getElementById('popover-role');
    if (roleEl) {
        roleEl.textContent = formatRoleLabel(userRole);
        roleEl.className = `badge ${getRoleClass(userRole)}`;
    }
    const lastLoginEl = document.getElementById('popover-last-login');
    if (lastLoginEl) {
        lastLoginEl.textContent = lastLogin
            ? lastLogin.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'No disponible';
    }
    const adminStateEl = document.getElementById('popover-admin-state');
    if (adminStateEl) adminStateEl.textContent = isAdmin ? 'Administrador' : 'Usuario regular';
    const chatAccessEl = document.getElementById('popover-chat-access');
    if (chatAccessEl) chatAccessEl.textContent = canUseTeacherChat() ? 'Disponible' : 'No disponible para tu rol';
    const uidEl = document.getElementById('popover-uid');
    if (uidEl) uidEl.textContent = currentUser.uid;
}

// === AUTHENTICATION ===
function setLoginButtonLoading(isLoading) {
    isLoginInProgress = isLoading;
    loginGoogleBtn.disabled = isLoading;
    loginGoogleBtn.innerHTML = isLoading
        ? "<i class='bx bx-loader-alt bx-spin'></i> Conectando..."
        : "<i class='bx bxl-google'></i> Continuar con Google";
}

function finishInitialAuthCheck() {
    if (initialAuthFinishPromise) return initialAuthFinishPromise;

    // La pantalla de carga dura solo lo que tarda en confirmarse la sesion: antes
    // se forzaban 5 segundos en cada apertura aunque todo estuviera listo.
    initialAuthFinishPromise = Promise.resolve().then(() => {
        hasResolvedInitialAuth = true;
        authLoadingScreen.classList.remove('active');
    });

    return initialAuthFinishPromise;
}

async function showLoginScreen() {
    await finishInitialAuthCheck();
    setLoginButtonLoading(false);
    loginScreen.classList.add('active');
    appContainer.style.display = 'none';
}

loginGoogleBtn.addEventListener('click', async () => {
    if (isLoginInProgress || !hasResolvedInitialAuth) return;
    hapticTap(15);
    setLoginButtonLoading(true);

    try {
        const androidBridge = getAndroidBridge() || (isAndroidDevice ? await waitForAndroidBridge() : null);
        if (androidBridge) {
            androidBridge.signInWithGoogle();
            return;
        }

        if (isAndroidWebView()) {
            setLoginButtonLoading(false);
            avisar('Esta versión de la app ya no puede iniciar sesión. Instala la versión nueva de RafaApp o entra desde el navegador.');
            return;
        }

        // Ventana emergente en todos los navegadores. La redireccion falla en los
        // que bloquean el almacenamiento de terceros (Safari y Chrome recientes,
        // tambien en Android), porque la web (vercel.app) y Firebase Auth
        // (firebaseapp.com) estan en dominios distintos. La redireccion queda solo
        // como respaldo si el navegador bloquea la ventana.
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            if (error?.code !== 'auth/popup-blocked' && error?.code !== 'auth/operation-not-supported-in-this-environment') throw error;
            await signInWithRedirect(auth, provider);
        }
    }
    catch (error) {
        setLoginButtonLoading(false);
        // Cerrar la ventana de Google no es un error: solo se vuelve al boton.
        if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return;
        console.error(error);
        avisar('No se pudo iniciar sesión.', { accion: () => loginGoogleBtn.click() });
    }
});
logoutBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (logoutBtn.disabled) return;

    hapticTap(15);
    logoutBtn.disabled = true;
    logoutBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Cerrando sesión...";

    try {
        await signOut(auth);
    } catch (error) {
        console.error('No se pudo cerrar sesión:', error);
        avisar('No se pudo cerrar la sesión.', { accion: () => logoutBtn.click() });
    } finally {
        // Se restaura siempre, no solo si falla: si no, al volver a iniciar sesión
        // en la misma pestaña el botón seguía en "Cerrando sesión..." y desactivado.
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = "<i class='bx bx-log-out'></i> Cerrar sesión";
    }
});

// === PERFIL: NOMBRE Y FOTO EDITABLES ===
// El nombre y la foto salen de users/{uid}, que es lo que ven los demas en el
// buscador y el chat. La cuenta de Google solo da el valor inicial. El correo
// no se puede cambiar.
let perfilActual = { nombre: '', avatar: '' };
const NOMBRE_MIN = 2;
const NOMBRE_MAX = 40;
const FOTO_LADO = 128;

function miNombre(respaldo = 'Usuario') {
    return perfilActual.nombre || currentUser?.displayName || respaldo;
}

function miAvatar() {
    return perfilActual.avatar || currentUser?.photoURL || '';
}

function cargarPerfil(datos, usuario) {
    perfilActual = {
        nombre: String(datos?.name || usuario?.displayName || ''),
        avatar: String(datos?.avatar || usuario?.photoURL || '')
    };
}

function pintarMiPerfil() {
    const avatar = safeImageSrc(miAvatar());
    [headerAvatar, document.getElementById('inline-avatar'), document.getElementById('popover-avatar')]
        .forEach(img => { if (img) img.src = avatar; });
    if (headerUsername) headerUsername.textContent = miNombre();
    const popoverName = document.getElementById('popover-name');
    if (popoverName) popoverName.textContent = miNombre();
}

function normalizarNombre(texto) {
    return String(texto || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
}

// Recorta al centro un cuadrado de 128 px y lo comprime en JPEG (unos 5 KB).
// El perfil viaja en el nodo users, que cada sesion descarga entero: una foto
// grande la descargarian todos en cada inicio.
async function prepararFotoDePerfil(archivo) {
    if (!archivo || !/^image\//.test(archivo.type)) throw new Error('Elige un archivo de imagen.');
    if (archivo.size > 20 * 1024 * 1024) throw new Error('La imagen es demasiado grande (máximo 20 MB).');
    let imagen;
    try {
        // Respeta la orientacion de las fotos hechas con el movil.
        imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
    } catch (error) {
        imagen = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
            img.src = URL.createObjectURL(archivo);
        });
    }
    const lado = Math.min(imagen.width, imagen.height);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = FOTO_LADO;
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imagen, (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado, 0, 0, FOTO_LADO, FOTO_LADO);
    let calidad = 0.75;
    let datos = lienzo.toDataURL('image/jpeg', calidad);
    while (datos.length > 12000 && calidad > 0.4) {
        calidad -= 0.1;
        datos = lienzo.toDataURL('image/jpeg', calidad);
    }
    if (datos.length > 16000) throw new Error('No se pudo reducir la imagen lo suficiente.');
    return datos;
}

const editProfileModal = document.getElementById('edit-profile-modal');
const editProfileForm = document.getElementById('edit-profile-form');
const editProfileName = document.getElementById('edit-profile-name');
const editProfileNameMsg = document.getElementById('edit-profile-name-msg');
const editProfileAvatar = document.getElementById('edit-profile-avatar');
const editProfilePhotoInput = document.getElementById('edit-profile-photo-input');
const editProfilePhotoMsg = document.getElementById('edit-profile-photo-msg');
const saveProfileBtn = document.getElementById('save-profile-btn');
let fotoPendiente = null; // null: la foto no cambia

function abrirEditorDePerfil() {
    if (!currentUser || !editProfileModal) return;
    closeProfilePopover();
    fotoPendiente = null;
    editProfileName.value = miNombre('');
    editProfileName.setAttribute('aria-invalid', 'false');
    editProfileNameMsg.textContent = '';
    editProfilePhotoMsg.textContent = '';
    editProfileAvatar.src = safeImageSrc(miAvatar());
    document.getElementById('edit-profile-email').value = currentUser.email || '';
    saveProfileBtn.disabled = false;
    saveProfileBtn.textContent = 'Guardar cambios';
    editProfileModal.classList.add('active');
    editProfileModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => editProfileName.focus(), 50);
}

function cerrarEditorDePerfil() {
    if (!editProfileModal) return;
    editProfileModal.classList.remove('active');
    editProfileModal.setAttribute('aria-hidden', 'true');
    fotoPendiente = null;
    if (editProfilePhotoInput) editProfilePhotoInput.value = '';
}

function validarNombre() {
    const nombre = normalizarNombre(editProfileName.value);
    let error = '';
    if (nombre.length < NOMBRE_MIN) error = `Escribe al menos ${NOMBRE_MIN} caracteres.`;
    else if (nombre.length > NOMBRE_MAX) error = `Máximo ${NOMBRE_MAX} caracteres.`;
    editProfileNameMsg.textContent = error;
    editProfileName.setAttribute('aria-invalid', String(Boolean(error)));
    return error ? null : nombre;
}

document.getElementById('edit-profile-btn')?.addEventListener('click', abrirEditorDePerfil);
document.getElementById('close-edit-profile-btn')?.addEventListener('click', cerrarEditorDePerfil);
document.getElementById('cancel-edit-profile-btn')?.addEventListener('click', cerrarEditorDePerfil);
editProfileModal?.addEventListener('click', event => { if (event.target === editProfileModal) cerrarEditorDePerfil(); });
// Validacion en linea: una vez marcado el error, se re-evalua al escribir.
editProfileName?.addEventListener('input', () => {
    if (editProfileName.getAttribute('aria-invalid') === 'true') validarNombre();
});

editProfilePhotoInput?.addEventListener('change', async () => {
    const archivo = editProfilePhotoInput.files?.[0];
    if (!archivo) return;
    editProfilePhotoMsg.textContent = 'Preparando la foto…';
    try {
        fotoPendiente = await prepararFotoDePerfil(archivo);
        editProfileAvatar.src = fotoPendiente;
        editProfilePhotoMsg.textContent = 'Foto lista. Pulsa «Guardar cambios».';
    } catch (error) {
        fotoPendiente = null;
        editProfilePhotoMsg.textContent = error.message;
    } finally {
        editProfilePhotoInput.value = '';
    }
});

document.getElementById('edit-profile-photo-reset')?.addEventListener('click', () => {
    fotoPendiente = currentUser?.photoURL || '';
    editProfileAvatar.src = safeImageSrc(fotoPendiente);
    editProfilePhotoMsg.textContent = 'Se usará la foto de tu cuenta de Google.';
});

editProfileForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentUser) return;
    const nombre = validarNombre();
    if (!nombre) { editProfileName.focus(); return; }
    const avatar = fotoPendiente ?? miAvatar();
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = 'Guardando…';
    try {
        await update(ref(db, `users/${currentUser.uid}`), { name: nombre, avatar });
        perfilActual = { nombre, avatar };
        pintarMiPerfil();
        refrescarAutoresVisibles();
        saveProfileBtn.textContent = '¡Guardado!';
        setTimeout(cerrarEditorDePerfil, 800);
    } catch (error) {
        console.error('No se pudo guardar el perfil:', error);
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = 'Guardar cambios';
        editProfilePhotoMsg.textContent = 'No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.';
    }
});

// === BUZON DE SOPORTE (solo administradores) ===
// Todas las solicitudes del Centro de soporte. Las reglas solo permiten listar el
// nodo `soporte` a quien figura en admins/{uid}. Al llegar una nueva, el
// despachador de notificaciones avisa a los administradores.
let supportInboxListener = null;
let supportTicketsCache = [];
let supportFilter = 'pendiente';
const supportInboxModal = document.getElementById('support-inbox-modal');
const supportInboxList = document.getElementById('support-inbox-list');
const supportInboxCount = document.getElementById('support-inbox-count');

function datosDeUsuario(uid) {
    if (uid && uid === currentUser?.uid) return { name: miNombre(), avatar: miAvatar(), email: currentUser.email };
    const perfil = directorioPorUid.get(uid) || {};
    return { ...perfil, email: correosPorUid[uid] || '' };
}

// === CORREOS (solo administradores) ===
// Los correos no estan en el nodo publico users: viven en privado/{uid}, que
// solo pueden leer su dueno y los administradores.
let correosPorUid = {};
let correosListener = null;

function cargarCorreosParaAdmin() {
    if (correosListener) { correosListener(); correosListener = null; }
    correosPorUid = {};
    if (!isAdmin) return;
    correosListener = onValue(ref(db, 'privado'), snapshot => {
        correosPorUid = Object.fromEntries(Object.entries(snapshot.val() || {}).map(([uid, datos]) => [uid, datos?.email || '']));
        if (supportTicketsCache.length) renderSupportInbox();
        if (adminUsersModal?.classList.contains('active')) renderAdminUsers(adminUserSearchInput ? adminUserSearchInput.value : '');
    }, error => console.warn('No se pudieron cargar los correos:', error));
}

function renderSupportTicket(ticket) {
    const usuario = datosDeUsuario(ticket.userId);
    const resuelto = ticket.estado === 'resuelto';
    const detalle = [usuario.email ? escapeHTML(usuario.email) : '', ticket.timestamp ? formatPostTime(ticket.timestamp) : '']
        .filter(Boolean).join(' · ');
    const id = escapeAttribute(ticket.id);
    const acciones = resuelto
        ? `<span class="support-ticket__meta">Resuelta por ${escapeHTML(ticket.resueltoPorNombre || 'un administrador')}${ticket.resueltoEn ? ` · ${formatPostTime(ticket.resueltoEn)}` : ''}</span>
           <button class="text-action-btn" type="button" data-support-action="reabrir" data-id="${id}">Reabrir</button>`
        : `<button class="btn-primary btn-primary--sm" type="button" data-support-action="resolver" data-id="${id}"><i class='bx bx-check'></i> Marcar como resuelta</button>`;
    return `<article class="support-ticket${resuelto ? ' is-resuelto' : ''}">
        <header class="support-ticket__head">
            <img class="avatar-small" src="${escapeAttribute(safeImageSrc(usuario.avatar))}" alt="" width="34" height="34">
            <div class="support-ticket__who"><strong>${escapeHTML(usuario.name || 'Usuario')}</strong><span>${detalle}</span></div>
            <span class="badge ${resuelto ? 'success' : 'warning'}">${resuelto ? 'Resuelta' : 'Pendiente'}</span>
        </header>
        <p class="support-ticket__text">${escapeHTML(ticket.texto || '')}</p>
        <footer class="support-ticket__actions">${acciones}</footer>
    </article>`;
}

function renderSupportInbox() {
    const pendientes = supportTicketsCache.filter(ticket => ticket.estado !== 'resuelto').length;
    if (supportInboxCount) {
        supportInboxCount.textContent = String(pendientes);
        supportInboxCount.hidden = pendientes === 0;
    }
    const contadorFiltro = document.getElementById('support-count-pendiente');
    if (contadorFiltro) contadorFiltro.textContent = String(pendientes);
    if (!supportInboxList) return;

    const visibles = supportTicketsCache.filter(ticket => supportFilter === 'todas'
        || (supportFilter === 'resuelto' ? ticket.estado === 'resuelto' : ticket.estado !== 'resuelto'));
    supportInboxList.innerHTML = visibles.length
        ? visibles.map(renderSupportTicket).join('')
        : `<p class="empty-state">${supportFilter === 'pendiente' ? 'No hay solicitudes pendientes. Todo al día.' : 'No hay solicitudes en esta vista.'}</p>`;
}

function loadSupportInbox() {
    if (supportInboxListener) { supportInboxListener(); supportInboxListener = null; }
    supportTicketsCache = [];
    if (!isAdmin) return;
    supportInboxListener = onValue(ref(db, 'soporte'), snapshot => {
        supportTicketsCache = Object.entries(snapshot.val() || {})
            .map(([id, ticket]) => ({ id, ...(ticket || {}) }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderSupportInbox();
    }, error => {
        console.error('No se pudo cargar el buzón de soporte:', error);
        if (supportInboxList) supportInboxList.innerHTML = '<p class="empty-state">No se pudo cargar el buzón de soporte. Inténtalo de nuevo en unos minutos.</p>';
    });
}

function abrirBuzonDeSoporte() {
    if (!isAdmin || !supportInboxModal) return;
    renderSupportInbox();
    supportInboxModal.classList.add('active');
    supportInboxModal.setAttribute('aria-hidden', 'false');
}

function cerrarBuzonDeSoporte() {
    if (!supportInboxModal) return;
    supportInboxModal.classList.remove('active');
    supportInboxModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('nav-support-inbox-btn')?.addEventListener('click', event => {
    event.preventDefault();
    abrirBuzonDeSoporte();
});
document.getElementById('close-support-inbox-btn')?.addEventListener('click', cerrarBuzonDeSoporte);
supportInboxModal?.addEventListener('click', event => { if (event.target === supportInboxModal) cerrarBuzonDeSoporte(); });
// Escape (como el boton Atras de Android) lo gestiona modales.js para todas las ventanas.

document.querySelectorAll('[data-support-filter]').forEach(boton => {
    boton.addEventListener('click', () => {
        supportFilter = boton.dataset.supportFilter;
        document.querySelectorAll('[data-support-filter]').forEach(b => b.setAttribute('aria-selected', String(b === boton)));
        renderSupportInbox();
    });
});

supportInboxList?.addEventListener('click', async event => {
    const boton = event.target.closest('[data-support-action]');
    if (!boton || !isAdmin || !currentUser) return;
    const resolver = boton.dataset.supportAction === 'resolver';
    boton.disabled = true;
    try {
        await update(ref(db, `soporte/${boton.dataset.id}`), resolver
            ? { estado: 'resuelto', resueltoPor: currentUser.uid, resueltoPorNombre: miNombre(), resueltoEn: Date.now() }
            : { estado: 'pendiente', resueltoPor: null, resueltoPorNombre: null, resueltoEn: null });
        if (resolver) avisarDespachadorDeNotificaciones();
    } catch (error) {
        console.error('No se pudo actualizar la solicitud:', error);
        boton.disabled = false;
        boton.textContent = 'No se pudo guardar. Reintentar';
    }
});

// Una lectura que no responde (sin conexion, red inestable) no debe dejar la app
// colgada en la pantalla de carga: pasado este tiempo se considera un fallo.
const ESPERA_MAXIMA_MS = 15000;
function conLimiteDeTiempo(promesa, ms = ESPERA_MAXIMA_MS) {
    let temporizador;
    return Promise.race([
        promesa,
        new Promise((_, rechazar) => { temporizador = setTimeout(() => rechazar(new Error('Tiempo de espera agotado')), ms); })
    ]).finally(() => clearTimeout(temporizador));
}

// Solo se aceptan fotos de Google (las reglas rechazan otras direcciones).
function fotoDeGoogle(url) {
    return /^https:\/\/lh[3-6]\.googleusercontent\.com\//.test(url || '') ? url : '';
}

// Aprobacion de la cuenta. Es solo para la interfaz: quien bloquea de verdad son
// las reglas. Si no se puede leer (reglas antiguas aun sin publicar), se deja pasar.
async function leerAprobacion(uid) {
    try { return (await conLimiteDeTiempo(get(ref(db, `aprobados/${uid}`)))).val() === true; }
    catch (error) { return true; }
}

async function prepararSesion(user) {
    currentUser = user;
    const [adminSnap, userSnap] = await conLimiteDeTiempo(Promise.all([
        get(ref(db, `admins/${user.uid}`)),
        get(ref(db, `users/${user.uid}`))
    ]));
    isAdmin = adminSnap.exists() && adminSnap.val() === true;
    cuentaAprobada = isAdmin || await leerAprobacion(user.uid);
    if (pendingAndroidFcmToken) saveAndroidFcmToken(pendingAndroidFcmToken);
    // El correo vive en privado/{uid}: solo lo leen su dueno y los administradores.
    if (user.email) set(ref(db, `privado/${user.uid}/email`), user.email).catch(error => console.warn('No se pudo guardar el correo privado:', error));

    const perfil = userSnap.val() || {};
    // Sin rol todavia = cuenta recien creada. Una cuenta antigua sin fecha cuenta como antigua.
    perfilCreadoEn = Number(perfil.createdAt) || (perfil.role ? 0 : Date.now());
    cargarPerfil(perfil, user);
    if (perfil.role) {
        userRole = perfil.role;
        completeLogin();
        return;
    }

    await finishInitialAuthCheck();
    loginScreen.classList.remove('active');
    roleSelectionScreen.classList.add('active');
    // Perfil publico inicial. Solo se completan los campos que falten, para no
    // pisar un nombre o una foto que la persona ya hubiera cambiado.
    const inicial = {};
    if (!perfil.name && user.displayName) inicial.name = user.displayName.slice(0, 60);
    if (perfil.avatar === undefined) inicial.avatar = fotoDeGoogle(user.photoURL);
    if (!perfil.createdAt) inicial.createdAt = serverTimestamp();
    if (Object.keys(inicial).length) await update(ref(db, `users/${user.uid}`), inicial);
}

// Si el arranque falla, la pantalla de carga muestra el motivo y un boton para
// reintentar, en lugar de quedarse para siempre en "Comprobando sesion...".
function mostrarFalloDeArranque(user) {
    const mensaje = document.getElementById('auth-loading-msg');
    const reintentar = document.getElementById('auth-retry-btn');
    authLoadingScreen.classList.add('active', 'has-error');
    if (mensaje) mensaje.textContent = 'No se pudo conectar con RafaApp. Revisa tu conexión a internet.';
    if (!reintentar) return;
    reintentar.hidden = false;
    reintentar.onclick = async () => {
        reintentar.hidden = true;
        authLoadingScreen.classList.remove('has-error');
        if (mensaje) mensaje.textContent = 'Comprobando sesión...';
        try { await prepararSesion(user); }
        catch (error) { console.error('El arranque volvió a fallar:', error); mostrarFalloDeArranque(user); }
    };
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            await prepararSesion(user);
        } catch (error) {
            console.error('No se pudo preparar la sesión:', error);
            mostrarFalloDeArranque(user);
        }
    } else {
        currentUser = null; isAdmin = false; userRole = null; allPostsCache = [];
        perfilActual = { nombre: '', avatar: '' };
        if (postsListener) { postsListener(); postsListener = null; }
        if (followingListener) { followingListener(); followingListener = null; }
        if (userDirectoryListener) { userDirectoryListener(); userDirectoryListener = null; }
        if (teacherMessagesListener) { teacherMessagesListener(); teacherMessagesListener = null; }
        if (moderationConfigListener) { moderationConfigListener(); moderationConfigListener = null; }
        if (supportInboxListener) { supportInboxListener(); supportInboxListener = null; }
        if (correosListener) { correosListener(); correosListener = null; }
        detenerEscuchasDeAdmin();
        if (aprobacionListener) { aprobacionListener(); aprobacionListener = null; }
        pendingApprovalScreen?.classList.remove('active');
        cuentaAprobada = true;
        [newsListener, reportsListener, eventsListener].forEach(cancelar => cancelar?.());
        newsListener = reportsListener = eventsListener = null;
        supportTicketsCache = []; correosPorUid = {};
        followingIds = {}; userDirectoryCache = []; directorioPorUid = new Map(); followActionIds.clear(); teacherMessagesCache = [];
        [userSearchInput, mobileUserSearchInput].forEach(input => {
            if (input) { input.value = ''; input.setAttribute('aria-expanded', 'false'); }
        });
        [userSearchResults, mobileUserSearchResults].forEach(results => { if (results) results.innerHTML = ''; });
        if (mobileUserSearchStatus) mobileUserSearchStatus.textContent = 'Escribe al menos 2 letras.';
        if (activeChatListener) { activeChatListener(); activeChatListener = null; }
        if (chatContactsListener) { chatContactsListener(); chatContactsListener = null; }
        detenerResumenesChat();
        if (personalTasksListener) { personalTasksListener(); personalTasksListener = null; }
        activeChatId = null;
        allContactsCache = [];
        personalTasksCache = [];
        showLoginScreen();
        roleSelectionScreen.classList.remove('active');
        closeProfilePopover();
    }
});

// Cuenta sin aprobar: pantalla de espera en lugar de la app. Se queda escuchando
// su aprobacion y entra sola en cuanto un administrador la concede.
async function mostrarCuentaPendiente() {
    await finishInitialAuthCheck();
    setLoginButtonLoading(false);
    roleSelectionScreen.classList.remove('active');
    loginScreen.classList.remove('active');
    appContainer.style.display = 'none';
    prepararAyudaPendiente();
    pendingApprovalScreen?.classList.add('active');
    // En la APK se pide ya el permiso de notificaciones y se registra el telefono:
    // asi le llega el aviso de "cuenta aprobada" aunque cierre la app mientras espera.
    const avisoAprobacion = document.getElementById('pending-approval-aviso');
    if (avisoAprobacion) avisoAprobacion.hidden = !window.AndroidFCM;
    initializeAndroidNotifications();
    if (aprobacionListener || !currentUser) return;
    aprobacionListener = onValue(ref(db, `aprobados/${currentUser.uid}`), snapshot => {
        if (snapshot.val() !== true) return;
        aprobacionListener?.();
        aprobacionListener = null;
        cuentaAprobada = true;
        recienAprobada = true;
        pendingApprovalScreen?.classList.remove('active');
        completeLogin();
    }, error => console.warn('No se pudo comprobar la aprobación de la cuenta:', error));
}

document.getElementById('pending-approval-logout-btn')?.addEventListener('click', () => logoutBtn.click());

// La espera no es un callejon sin salida: se ve con que correo se entro (por si
// es la cuenta equivocada) y se puede escribir a un administrador desde aqui.
// Soporte admite mensajes de cuentas sin aprobar (ver soporte en las reglas).
const pendingHelpBtn = document.getElementById('pending-help-btn');
const pendingHelpForm = document.getElementById('pending-help-form');
const pendingHelpText = document.getElementById('pending-help-text');
const pendingHelpSend = document.getElementById('pending-help-send');
const pendingHelpSent = document.getElementById('pending-help-sent');
let pendingHelpUid = null;

function prepararAyudaPendiente() {
    const correo = currentUser?.email || '';
    const email = document.getElementById('pending-approval-email');
    if (email) email.textContent = correo;
    const cuenta = document.getElementById('pending-approval-account');
    if (cuenta) cuenta.hidden = !correo;
    // Otra cuenta en la misma sesion empieza sin el mensaje de la anterior.
    if (pendingHelpUid === currentUser?.uid) return;
    pendingHelpUid = currentUser?.uid || null;
    if (pendingHelpBtn) { pendingHelpBtn.hidden = false; pendingHelpBtn.setAttribute('aria-expanded', 'false'); }
    if (pendingHelpForm) pendingHelpForm.hidden = true;
    if (pendingHelpSent) pendingHelpSent.hidden = true;
    if (pendingHelpText) pendingHelpText.value = '';
    revisarContenido(pendingHelpSend);
}

pendingHelpBtn?.addEventListener('click', () => {
    pendingHelpBtn.hidden = true;
    pendingHelpBtn.setAttribute('aria-expanded', 'true');
    pendingHelpForm.hidden = false;
    pendingHelpText.focus();
});
exigirContenido(pendingHelpSend, () => Boolean(pendingHelpText?.value.trim()), [pendingHelpText]);

pendingHelpForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const texto = pendingHelpText.value.trim();
    if (!texto || !currentUser || pendingHelpSend.disabled) return;
    pendingHelpSend.disabled = true;
    pendingHelpSend.setAttribute('aria-busy', 'true');
    pendingHelpSend.textContent = 'Enviando...';
    try {
        // El correo va delante para que el administrador sepa a quien aprobar.
        const encabezado = `Cuenta pendiente de aprobación (${currentUser.email || 'sin correo'}): `;
        await set(push(ref(db, 'soporte')), {
            userId: currentUser.uid,
            texto: (encabezado + texto).slice(0, 1000),
            timestamp: Date.now(),
            estado: 'pendiente'
        });
        avisarDespachadorDeNotificaciones();
        pendingHelpForm.hidden = true;
        pendingHelpSent.hidden = false;
    } catch (error) {
        console.error('No se pudo enviar la solicitud de ayuda:', error);
        avisar('No se pudo enviar el mensaje. Revisa tu conexión.', { accion: () => pendingHelpForm.requestSubmit() });
    } finally {
        pendingHelpSend.textContent = 'Enviar mensaje';
        pendingHelpSend.removeAttribute('aria-busy');
        revisarContenido(pendingHelpSend);
    }
});

async function completeLogin() {
    if (!cuentaAprobada) { await mostrarCuentaPendiente(); return; }
    await finishInitialAuthCheck();
    setLoginButtonLoading(false);
    roleSelectionScreen.classList.remove('active');
    loginScreen.classList.remove('active');
    appContainer.style.display = 'block';

    headerAvatar.src = safeImageSrc(miAvatar());
    headerUsername.textContent = miNombre();

    const inlineAvatar = document.getElementById('inline-avatar');
    if (inlineAvatar) inlineAvatar.src = safeImageSrc(miAvatar());

    adminBtns.forEach(btn => btn.style.display = isAdmin ? (btn.id==='add-event-btn'?'inline-flex': (btn.id==='nav-users-btn' ? 'flex' : 'flex')) : 'none');

    if (isAdmin) escucharAprobaciones();

    if (userRole === 'estudiante') {
        studentHiddenEls.forEach(el => el.style.display = 'none');
    } else {
        studentHiddenEls.forEach(el => el.style.display = 'flex');
    }

    if (canUseTeacherChat()) {
        teacherChatEls.forEach(el => el.style.display = 'flex');
        loadChatContacts();
    } else {
        teacherChatEls.forEach(el => el.style.display = 'none');
        if (chatContactsListener) { chatContactsListener(); chatContactsListener = null; }
        detenerResumenesChat();
        if (activeChatListener) { activeChatListener(); activeChatListener = null; }
        activeChatId = null;
        allContactsCache = [];
        chatPanel.classList.remove('active');
        chatContactsList.innerHTML = '';
    }

    initializeCommunityFeatures();
    cargarCorreosParaAdmin();
    initializeAndroidNotifications();
    loadNews();
    loadReports();
    loadEvents();
    loadPersonalTasks();

    checkPendingRoleRequest();

    // Sesion lista: tutorial.js decide si abre el recorrido de bienvenida.
    const cuentaNueva = recienAprobada
        || (perfilCreadoEn >= TUTORIAL_DESDE && Date.now() - perfilCreadoEn < TUTORIAL_CUENTA_NUEVA_MS);
    window.rafaSesionActual = { uid: currentUser.uid, rol: normalizeRole(userRole), esAdmin: isAdmin, nombre: miNombre(), cuentaNueva };
    document.dispatchEvent(new CustomEvent('rafa:sesion', { detail: window.rafaSesionActual }));
}

document.getElementById('ver-tutorial-btn')?.addEventListener('click', () => {
    closeProfilePopover();
    document.dispatchEvent(new CustomEvent('rafa:ver-tutorial'));
});

async function checkPendingRoleRequest() {
    const banner = document.getElementById('pending-role-banner');
    if (!banner || !currentUser) return;
    try {
        const snap = await get(ref(db, `roleRequests/${currentUser.uid}`));
        if (snap.exists() && snap.val().status === 'pending') {
            banner.textContent = `Tu solicitud para ser ${formatRoleLabel(snap.val().requestedRole)} está pendiente de aprobación por un administrador.`;
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    } catch (error) {
        // Si no hay permisos o no existe, simplemente no se muestra el aviso.
        banner.style.display = 'none';
    }
}

// Muestra el modal de confirmación de solicitud de rol (reemplaza al alert() nativo)
function showRoleRequestModal(message, onClose) {
    if (!roleRequestModal) { if (onClose) onClose(); return; }
    roleRequestModalMessage.textContent = message;
    roleRequestModal.classList.add('active');
    const handleClose = () => {
        roleRequestModal.classList.remove('active');
        roleRequestModalBtn.removeEventListener('click', handleClose);
        if (onClose) onClose();
    };
    roleRequestModalBtn.addEventListener('click', handleClose);
}

// Role Selection Event Listeners
document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', async () => {
        hapticTap(15);
        const selectedRole = card.dataset.role;
        const originalHTML = card.innerHTML;
        card.style.pointerEvents = 'none';
        card.style.opacity = '0.6';

        try {
            if (SELF_SERVICE_ROLES.includes(selectedRole)) {
                // Estudiante: bajo riesgo, se activa al instante.
                await set(ref(db, `users/${currentUser.uid}/role`), selectedRole);
                userRole = selectedRole;
                completeLogin();
                return;
            }

            if (RESTRICTED_ROLES.includes(selectedRole)) {
                // Profesor / Padre de familia / Directivo: requieren aprobación de un admin.
                // Mientras tanto, la cuenta queda como Estudiante (acceso mínimo) y
                // las reglas de Firebase solo permiten que el propio usuario se
                // asigne 'estudiante', nunca un rol elevado directamente.
                await set(ref(db, `users/${currentUser.uid}/role`), 'estudiante');
                await set(ref(db, `roleRequests/${currentUser.uid}`), {
                    name: miNombre(''),
                    email: currentUser.email || '',
                    requestedRole: selectedRole,
                    status: 'pending',
                    requestedAt: Date.now()
                });
                userRole = 'estudiante';
                showRoleRequestModal(`Tu solicitud para ser ${formatRoleLabel(selectedRole)} fue enviada. Mientras un administrador la aprueba, tendrás acceso como Estudiante.`, completeLogin);
                return;
            }
        } catch (error) {
            // El detalle tecnico (p. ej. PERMISSION_DENIED por reglas sin "roleRequests")
            // queda en la consola; al usuario solo se le dice que lo intente de nuevo.
            console.error('No se pudo guardar la eleccion de rol:', error);
            avisar('No se pudo guardar tu rol. Inténtalo de nuevo en unos minutos.');
            card.innerHTML = originalHTML;
            card.style.pointerEvents = '';
            card.style.opacity = '';
        }
    });
});

// === MODALS TOGGLE & IMAGE UPLOAD ===
const postTextarea = document.getElementById('post-textarea');
const publishPostBtn = document.getElementById('publish-post-btn');
const postExpiryNote = document.getElementById('post-expiry-note');

// Las publicaciones de estudiantes se borran a las 24 horas: se avisa antes de
// escribir, no despues de publicar.
function abrirCompositor() {
    if (postExpiryNote) postExpiryNote.hidden = normalizeRole(userRole) !== 'estudiante';
    revisarContenido(publishPostBtn);
    postModal.classList.add('active');
}
exigirContenido(publishPostBtn, () => Boolean(postTextarea.value.trim() || currentPostImageBase64), [postTextarea]);

const openModalBtnFeed = document.getElementById('open-modal-btn-feed');
if (openModalBtnFeed) openModalBtnFeed.onclick = abrirCompositor;

const openModalBtn = document.getElementById('open-modal-btn');
if (openModalBtn) openModalBtn.onclick = abrirCompositor;
if (mobileOpenModalBtn) mobileOpenModalBtn.onclick = abrirCompositor;
if (mobileHomeBtn) mobileHomeBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

document.getElementById('close-modal-btn').onclick = () => {
    postModal.classList.remove('active');
    resetImagePreview();
};
document.getElementById('cancel-post-btn').onclick = () => {
    postModal.classList.remove('active');
    resetImagePreview();
};

addNewsBtn.onclick = () => newsModal.classList.add('active');
document.getElementById('close-news-modal-btn').onclick = () => newsModal.classList.remove('active');

addReportBtn.onclick = () => reportModal.classList.add('active');
document.getElementById('close-report-modal-btn').onclick = () => reportModal.classList.remove('active');

navEventsBtn.onclick = (e) => { e.preventDefault(); eventsViewModal.classList.add('active'); };
if (mobileEventsBtn) mobileEventsBtn.onclick = () => eventsViewModal.classList.add('active');
document.getElementById('close-events-view-btn').onclick = () => eventsViewModal.classList.remove('active');

addEventBtn.onclick = () => eventCreateModal.classList.add('active');
document.getElementById('close-event-create-btn').onclick = () => eventCreateModal.classList.remove('active');

// Image upload and compression logic
// Las reglas aceptan imagenes JPEG de hasta 300.000 caracteres en base64.
const IMAGEN_POST_MAX = 280000;

postImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
        avisar('Ese archivo no es una imagen. Elige una foto.');
        resetImagePreview();
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;

            if (width > height) {
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            } else {
                if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
            }

            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            let calidad = 0.7;
            let datos = canvas.toDataURL('image/jpeg', calidad);
            while (datos.length > IMAGEN_POST_MAX && calidad > 0.3) {
                calidad -= 0.1;
                datos = canvas.toDataURL('image/jpeg', calidad);
            }
            if (datos.length > IMAGEN_POST_MAX) {
                avisar('La imagen es demasiado pesada. Prueba con otra.');
                resetImagePreview();
                return;
            }
            currentPostImageBase64 = datos;

            postImagePreview.src = currentPostImageBase64;
            imagePreviewContainer.style.display = 'block';
            revisarContenido(publishPostBtn);
        };
        img.onerror = () => {
            avisar('No se pudo leer la imagen. Prueba con otra.');
            resetImagePreview();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

removeImageBtn.addEventListener('click', () => {
    resetImagePreview();
});

function resetImagePreview() {
    currentPostImageBase64 = null;
    postImageInput.value = '';
    imagePreviewContainer.style.display = 'none';
    postImagePreview.src = '';
    revisarContenido(publishPostBtn);
}

// === COMMUNITY FEED, EXPIRY, COMMENTS, FOLLOWS & MODERATION ===

const STUDENT_POST_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_PROHIBITED_WORDS = ['groseria', 'idiota', 'mierda', 'puta', 'malparido', 'gonorrea'];
let postsListener = null;
let followingListener = null;
let userDirectoryListener = null;
let teacherMessagesListener = null;
let moderationConfigListener = null;
let followingIds = {};
let userDirectoryCache = [];
const followActionIds = new Set();
let teacherMessagesCache = [];
let prohibitedWords = [...DEFAULT_PROHIBITED_WORDS];

const teacherMessagesList = document.getElementById('teacher-messages-list');
const teacherMessageComposer = document.getElementById('teacher-message-composer');
const teacherMessageInput = document.getElementById('teacher-message-input');
const teacherMessageCount = document.getElementById('teacher-message-count');
const teacherMessageLimit = document.getElementById('teacher-message-limit');
const sendTeacherMessageBtn = document.getElementById('send-teacher-message-btn');
const supportFab = document.getElementById('support-fab');
const supportModal = document.getElementById('support-modal');
const supportText = document.getElementById('support-text');
const userSearchInput = document.getElementById('user-search-input');
const userSearchResults = document.getElementById('user-search-results');
const mobileUserSearchInput = document.getElementById('mobile-user-search-input');
const mobileUserSearchResults = document.getElementById('mobile-user-search-results');
const mobileUserSearchStatus = document.getElementById('mobile-user-search-status');
const moderationModal = document.getElementById('moderation-modal');
const moderationPostsList = document.getElementById('moderation-posts-list');
const moderationCount = document.getElementById('moderation-count');
const navModerationBtn = document.getElementById('nav-moderation-btn');
const confirmModal = document.getElementById('confirm-modal');
let pendingConfirmResolver = null;

function todayKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function countWords(text) {
    return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function normalizeModerationText(text) {
    return (text || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizeProhibitedWords(value) {
    const candidates = Array.isArray(value) ? value : Object.values(value || {});
    const words = candidates.map(word => normalizeModerationText(word).trim()).filter(Boolean);
    return words.length ? [...new Set(words)] : [...DEFAULT_PROHIBITED_WORDS];
}

function containsProhibitedWord(text) {
    const normalizedText = normalizeModerationText(text);
    const tokens = normalizedText.split(/[^a-z0-9ñ]+/).filter(Boolean);
    return prohibitedWords.some(word => word.includes(' ')
        ? normalizedText.includes(word)
        : tokens.includes(word));
}

function postCreatedAt(post) {
    return Number(post?.createdAt || post?.timestamp || 0);
}

function isExpiredStudentPost(post, now = Date.now()) {
    return normalizeRole(post?.authorRole) === 'estudiante' && postCreatedAt(post) > 0 && now >= postCreatedAt(post) + STUDENT_POST_TTL_MS;
}

// Caducar es lo normal, no un error: el aviso va en gris y solo pasa a rojo
// en la ultima hora, cuando de verdad conviene fijarse.
function postExpiryHtml(post) {
    const remaining = Math.max(0, postCreatedAt(post) + STUDENT_POST_TTL_MS - Date.now());
    const hora = 60 * 60 * 1000;
    const pronto = remaining < hora;
    const texto = pronto
        ? `Se borra en ${Math.max(1, Math.ceil(remaining / 60000))} min`
        : `Visible ${Math.ceil(remaining / hora)} h más`;
    return `<span class="post-expiry${pronto ? ' post-expiry--pronto' : ''}"><i class='bx bx-time-five' aria-hidden="true"></i>${texto}</span>`;
}

function formatPostTime(timestamp) {
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 60) return `Hace ${minutes} min`;
    const horas = Math.floor(minutes / 60);
    if (minutes < 1440) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
    const dias = Math.floor(minutes / 1440);
    return `Hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

// Inicio: lo propio, lo de profesores y directivos (aunque no los sigas) y lo de
// quien sigues. Lo pendiente de revision solo lo ven su autor y quienes moderan.
const ROLES_SIEMPRE_EN_INICIO = ['profesor', 'maestro', 'directivo'];

// A profesores y directivos se les ve siempre en Inicio: seguirlos solo activa las
// notificaciones de sus publicaciones. El boton dice eso en vez de "Seguir".
function soloActivaAvisos(role) {
    return ROLES_SIEMPRE_EN_INICIO.includes(normalizeRole(role));
}
function contenidoBotonSeguir(sigue, soloAvisos) {
    if (!soloAvisos) return sigue ? 'Siguiendo' : 'Seguir';
    // El texto va en su propio span: en el telefono la tarjeta lo oculta a la vista.
    return sigue
        ? `<i class='bx bxs-bell' aria-hidden="true"></i><span class="follow-btn__texto">Avisos activos</span>`
        : `<i class='bx bx-bell' aria-hidden="true"></i><span class="follow-btn__texto">Activar avisos</span>`;
}
function isPostVisibleInFeed(post) {
    if (!currentUser || isExpiredStudentPost(post)) return false;
    const authorId = post.author?.uid || post.autorId;
    if (authorId === currentUser.uid) return true;
    if (post.flagged && !canManageContent()) return false;
    return ROLES_SIEMPRE_EN_INICIO.includes(normalizeRole(post.authorRole)) || Boolean(followingIds[authorId]);
}

function commentsForPost(post) {
    // The former UI stored legacy comments in English. New comments use the
    // requested Spanish RTDB path and both remain readable during migration.
    return { ...(post.comments || {}), ...(post.comentarios || {}) };
}

function buildCommentsHtml(post, postId) {
    const comments = [
        ...Object.entries(post.comments || {}).map(([id, value]) => ({ id, value, path: 'comments' })),
        ...Object.entries(post.comentarios || {}).map(([id, value]) => ({ id, value, path: 'comentarios' }))
    ].sort((a, b) => (a.value.timestamp || 0) - (b.value.timestamp || 0));
    return comments.map(({ id: commentId, value: comment, path }) => {
        const authorId = comment.autorId || comment.authorUid || '';
        const canDelete = canManageContent();
        const nombre = nombreVisible(authorId, comment.autorNombre || comment.authorName || 'Usuario');
        const foto = avatarVisible(authorId, comment.autorAvatar || comment.authorAvatar);
        return `<div class="comment">
            <img src="${escapeAttribute(safeImageSrc(foto))}" class="avatar" alt="" data-foto-de="${escapeAttribute(authorId)}">
            <div class="comment-content"><div class="comment-text-group"><strong data-nombre-de="${escapeAttribute(authorId)}">${escapeHTML(nombre)}</strong>${escapeHTML(comment.texto || comment.text || '')}</div>
            ${canDelete ? `<button class="action-btn delete-comment-btn" aria-label="Eliminar comentario" data-post-id="${escapeAttribute(postId)}" data-comment-id="${escapeAttribute(commentId)}" data-comment-path="${path}" data-author-id="${escapeAttribute(authorId)}"><i class='bx bx-x'></i></button>` : ''}</div>
        </div>`;
    }).join('');
}

// === PESTAÑAS DEL FEED: INICIO / DESCUBRIR ===
// Las dos pestañas comparten #posts-container, asi que todas las escuchas
// delegadas (me gusta, comentar, borrar, seguir) funcionan igual en ambas.
const FEED_PAGE_SIZE = 10;
let feedMode = 'inicio';
let feedLimit = FEED_PAGE_SIZE;
const feedSection = document.querySelector('.feed-section');
const feedTabs = document.querySelectorAll('[data-feed-tab]');

// Descubrir: todas las publicaciones vigentes de la comunidad, menos las propias.
// No depende de a quien sigues, para que una tarjeta no desaparezca al pulsar
// "Seguir". Las marcadas para revision solo las ven quienes moderan.
function isPostVisibleInDiscover(post) {
    if (!currentUser || isExpiredStudentPost(post)) return false;
    const authorId = post.author?.uid || post.autorId;
    if (!authorId || authorId === currentUser.uid) return false;
    return !post.flagged || canManageContent();
}

function setFeedMode(mode) {
    if (!['inicio', 'descubrir'].includes(mode) || mode === feedMode) return;
    feedMode = mode;
    feedLimit = FEED_PAGE_SIZE;
    feedSection?.setAttribute('data-feed', mode);
    feedTabs.forEach(tab => {
        const active = tab.dataset.feedTab === mode;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
    });
    postsContainer?.setAttribute('aria-labelledby', `feed-tab-${mode}`);
    // Lienzo limpio: cada pestaña tiene su propio conjunto y orden de tarjetas.
    if (postsContainer) postsContainer.innerHTML = '';
    renderCommunityFeed();
    // Las sugerencias de Descubrir dependen de quien ha publicado: se rehacen al entrar.
    if (mode === 'descubrir') renderUserDirectoryResults();
}

// Desde el inicio vacio: abre Descubrir y deja el cursor en el buscador visible
// (el de Descubrir en el movil, el de la cabecera en pantallas grandes).
function irAEncontrarPersonas() {
    setFeedMode('descubrir');
    const buscador = [mobileUserSearchInput, userSearchInput].find(input => input?.getClientRects().length);
    buscador?.closest('section, #user-search')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    buscador?.focus({ preventScroll: true });
}

feedTabs.forEach(tab => {
    tab.addEventListener('click', () => setFeedMode(tab.dataset.feedTab));
    // Patron de pestañas accesible: las flechas cambian de pestaña.
    tab.addEventListener('keydown', event => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const next = tab.dataset.feedTab === 'inicio' ? 'descubrir' : 'inicio';
        setFeedMode(next);
        document.getElementById(`feed-tab-${next}`)?.focus();
    });
});

// "Inicio" en la barra lateral no tenia manejador; ahora vuelve a la pestaña
// Inicio y sube. El de la barra inferior conserva su onclick y ademas cambia de pestaña.
const navHomeBtn = document.getElementById('nav-home-btn');
if (navHomeBtn) navHomeBtn.addEventListener('click', event => {
    event.preventDefault();
    setFeedMode('inicio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
if (mobileHomeBtn) mobileHomeBtn.addEventListener('click', () => setFeedMode('inicio'));

function renderCommunityFeed() {
    if (!postsContainer || !currentUser) return;
    const isDiscover = feedMode === 'descubrir';
    const matchingPosts = allPostsCache.filter(isDiscover ? isPostVisibleInDiscover : isPostVisibleInFeed);
    // Descubrir carga de 10 en 10 (las imagenes viajan en base64 dentro de cada
    // publicacion). Inicio conserva su comportamiento: todo de una vez.
    const visiblePosts = isDiscover ? matchingPosts.slice(0, feedLimit) : matchingPosts;

    // Retira todo lo que no sea una tarjeta: avisos de carga o de feed vacio y el
    // boton "Ver mas". Antes la reconciliacion nunca los quitaba y el aviso de
    // "aun no hay publicaciones" se quedaba al final de un feed con publicaciones.
    [...postsContainer.children].forEach(child => {
        if (!child.matches('.post-card[id]')) child.remove();
    });

    if (!visiblePosts.length) {
        postsContainer.innerHTML = isDiscover
            ? '<div class="glass-card loading-spinner">Todavía no hay publicaciones de la comunidad para descubrir.</div>'
            : `<div class="glass-card loading-spinner feed-vacio">
                <p>Aún no hay publicaciones de personas que sigues.</p>
                <button class="btn-primary" type="button" data-accion="encontrar-personas"><i class='bx bx-user-plus' aria-hidden="true"></i> Encontrar personas</button>
            </div>`;
        renderModerationQueue();
        return;
    }

    // --- Incremental DOM reconciliation (Fix #7) ---
    const _currentIds = new Set(visiblePosts.map(p => p.id));
    const _existingEls = postsContainer.querySelectorAll('.post-card[id]');
    const _existingMap = new Map();
    _existingEls.forEach(el => {
        const eid = (el.id || '').replace('post-', '');
        if (!_currentIds.has(eid)) {
            el.remove();
        } else {
            _existingMap.set(eid, el);
        }
    });

    visiblePosts.forEach((post, index) => {
        const existingEl = _existingMap.get(post.id);
        if (existingEl) {
            actualizarTarjeta(existingEl, post);
            if (postsContainer.children[index] !== existingEl) {
                postsContainer.insertBefore(existingEl, postsContainer.children[index]);
            }
        } else {
            const newEl = crearTarjeta(post);
            if (postsContainer.children[index]) {
                postsContainer.insertBefore(newEl, postsContainer.children[index]);
            } else {
                postsContainer.appendChild(newEl);
            }
            prepararImagenDePost(newEl);
        }
    });

    if (isDiscover && matchingPosts.length > visiblePosts.length) {
        const remaining = matchingPosts.length - visiblePosts.length;
        const moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'action-btn feed-more-btn';
        moreBtn.innerHTML = `Ver más publicaciones <small>(${remaining})</small>`;
        moreBtn.addEventListener('click', () => {
            feedLimit += FEED_PAGE_SIZE;
            renderCommunityFeed();
        });
        postsContainer.appendChild(moreBtn);
    }
    renderModerationQueue();
}

// Firma de los comentarios de una publicacion: si cambia (uno nuevo o uno
// borrado), la lista se vuelve a dibujar.
function firmaDeComentarios(post) {
    return Object.keys(commentsForPost(post)).sort().join(',');
}

function crearTarjeta(post) {
    const postId = post.id;
    const postIdSafe = escapeAttribute(postId);
    const authorId = post.author?.uid || post.autorId || '';
    // Nombre y foto del perfil real del autor (la copia del post es solo respaldo).
    const authorName = escapeHTML(nombreVisible(authorId, post.author?.name || post.autorNombre || 'Usuario'));
    const authorAvatar = escapeAttribute(safeImageSrc(avatarVisible(authorId, post.author?.avatar || post.autorAvatar)));
    const comments = commentsForPost(post);
    const likesCount = Object.keys(post.likes || {}).length;
    const liked = Boolean(post.likes?.[currentUser.uid]);
    const canFollow = authorId && authorId !== currentUser.uid;
    const canDel = canDeletePost(post);
    const followsAuthor = Boolean(followingIds[authorId]);
    // El rol no se puede falsificar (las reglas lo comprueban al publicar): se
    // muestra junto a la hora para que nadie pase por profesor o directivo.
    const rol = normalizeRole(post.authorRole) ? `${escapeHTML(formatRoleLabel(post.authorRole))} · ` : '';
    const expiry = authorId === currentUser.uid && normalizeRole(post.authorRole) === 'estudiante'
        ? postExpiryHtml(post) : '';
    const flagged = canManageContent() && post.flagged ? '<span class="post-flag">Pendiente de revisión</span>' : '';
    // Imagen: las publicaciones antiguas la llevan dentro; las nuevas, aparte
    // (imagenesPosts) y se descarga solo cuando la tarjeta se acerca a la pantalla.
    const imagenAntigua = safeImageSrc(post.imageBase64, '');
    const imagen = imagenAntigua
        ? `<img src="${escapeAttribute(imagenAntigua)}" alt="Imagen adjunta" class="post-image-full" decoding="async">`
        : (post.tieneImagen ? `<img alt="Imagen adjunta" class="post-image-full" data-imagen-post="${postIdSafe}" decoding="async">` : '');

    const newEl = document.createElement('article');
    newEl.className = 'post-card';
    newEl.id = `post-${postIdSafe}`;
    newEl.dataset.comentarios = firmaDeComentarios(post);
    newEl.innerHTML = `
        <div class="post-header"><div class="user-info"><img src="${authorAvatar}" alt="" class="avatar" data-foto-de="${escapeAttribute(authorId)}"><div class="user-details"><span class="username" data-nombre-de="${escapeAttribute(authorId)}">${authorName}</span><span class="post-meta">${rol}${formatPostTime(postCreatedAt(post))}</span>${expiry}</div></div>
            <div class="post-header-actions">${flagged}${canFollow ? `<button class="action-btn follow-btn${soloActivaAvisos(post.authorRole) ? ' follow-btn--avisos' : ''} ${followsAuthor ? 'following' : ''}" data-author-id="${escapeAttribute(authorId)}" data-following="${followsAuthor}" data-solo-avisos="${soloActivaAvisos(post.authorRole)}" aria-pressed="${followsAuthor}" type="button">${contenidoBotonSeguir(followsAuthor, soloActivaAvisos(post.authorRole))}</button>` : ''}${canDel ? `<button class="action-btn delete-post-btn" aria-label="Eliminar publicación" data-id="${postIdSafe}" type="button"><i class='bx bx-trash'></i></button>` : ''}</div>
        </div>
        ${post.content ? `<div class="post-content">${escapeHTML(post.content)}</div>` : ''}
        ${imagen}
        <div class="post-actions"><button class="action-btn like-btn ${liked ? 'liked' : ''}" data-id="${postIdSafe}" type="button"><i class='bx ${liked ? 'bxs-heart' : 'bx-heart'}'></i><span class="likes-count">${likesCount}</span></button><button class="action-btn comment-btn" data-id="${postIdSafe}" type="button"><i class='bx bx-message-rounded'></i><span>${Object.keys(comments).length}</span></button></div>
        <div class="comments-section" id="comments-${postIdSafe}"><div class="comments-list">${buildCommentsHtml(post, postId)}</div><div class="comment-input-area"><input type="text" maxlength="500" placeholder="Escribe un comentario..." class="new-comment-input" data-id="${postIdSafe}"><button class="comment-submit-btn" data-id="${postIdSafe}" type="button" aria-label="Publicar comentario"><i class='bx bxs-send'></i></button></div></div>
    `;
    return newEl;
}

// Actualiza una tarjeta ya pintada sin recrearla (conserva lo que se esta escribiendo).
function actualizarTarjeta(el, post) {
    const likesBtn = el.querySelector('.like-btn');
    if (likesBtn) {
        const liked = Boolean(post.likes?.[currentUser.uid]);
        const countSpan = likesBtn.querySelector('.likes-count');
        if (countSpan) countSpan.textContent = Object.keys(post.likes || {}).length;
        likesBtn.classList.toggle('liked', liked);
        const icon = likesBtn.querySelector('i');
        if (icon) icon.className = liked ? 'bx bxs-heart' : 'bx bx-heart';
    }
    const commentCount = el.querySelector('.comment-btn span');
    if (commentCount) commentCount.textContent = Object.keys(commentsForPost(post)).length;
    // Antes solo cambiaba el contador: el comentario nuevo (o el borrado) no se
    // veia hasta recargar la app.
    const firma = firmaDeComentarios(post);
    if (el.dataset.comentarios !== firma) {
        const lista = el.querySelector('.comments-list');
        if (lista) lista.innerHTML = buildCommentsHtml(post, post.id);
        el.dataset.comentarios = firma;
    }
    const followBtn = el.querySelector('.follow-btn');
    if (followBtn) {
        const followsAuthor = Boolean(followingIds[post.author?.uid || post.autorId || '']);
        followBtn.classList.toggle('following', followsAuthor);
        followBtn.dataset.following = String(followsAuthor);
        followBtn.setAttribute('aria-pressed', String(followsAuthor));
        followBtn.innerHTML = contenidoBotonSeguir(followsAuthor, followBtn.dataset.soloAvisos === 'true');
    }
    // La marca de revision aparece o desaparece al moderar.
    const acciones = el.querySelector('.post-header-actions');
    const marca = acciones?.querySelector('.post-flag');
    const debeMarcar = canManageContent() && Boolean(post.flagged);
    if (debeMarcar && !marca) acciones?.insertAdjacentHTML('afterbegin', '<span class="post-flag">Pendiente de revisión</span>');
    if (!debeMarcar && marca) marca.remove();
}

// --- Imagenes de las publicaciones, bajo demanda ---
const imagenesDePosts = new Map(); // postId -> Promise<src | ''>
const observadorDeImagenes = 'IntersectionObserver' in window
    ? new IntersectionObserver(entradas => entradas.forEach(entrada => {
        if (!entrada.isIntersecting) return;
        observadorDeImagenes.unobserve(entrada.target);
        cargarImagenDePost(entrada.target);
    }), { rootMargin: '800px 0px' })
    : null;

function prepararImagenDePost(tarjeta) {
    const img = tarjeta.querySelector('img[data-imagen-post]');
    if (!img) return;
    if (observadorDeImagenes) observadorDeImagenes.observe(img);
    else cargarImagenDePost(img);
}

async function cargarImagenDePost(img) {
    const id = img.dataset.imagenPost;
    if (!imagenesDePosts.has(id)) {
        imagenesDePosts.set(id, get(ref(db, `imagenesPosts/${id}`))
            .then(snapshot => safeImageSrc(snapshot.val(), ''))
            .catch(() => { imagenesDePosts.delete(id); return ''; }));
    }
    const src = await imagenesDePosts.get(id);
    if (src) img.src = src;
    else img.remove();
}

async function cleanupExpiredStudentPosts(posts) {
    // In the client fallback only an administrator can remove records, matching the
    // moderation delete permission. Everyone else still stops seeing them now.
    if (!canManageContent()) return;
    const expired = posts.filter(post => isExpiredStudentPost(post));
    if (!expired.length) return;
    const updates = {};
    expired.forEach(post => {
        updates[`posts/${post.id}`] = null;
        // Solo si tiene imagen aparte: borrar una ruta inexistente lo rechazan las reglas.
        if (post.tieneImagen) updates[`imagenesPosts/${post.id}`] = null;
    });
    try { await update(ref(db), updates); } catch (error) { console.warn('No se pudo limpiar publicaciones vencidas:', error); }
}

// El feed descarga solo las publicaciones mas recientes, y sin imagenes (van
// aparte). Antes cada apertura bajaba todas, con sus imagenes dentro.
const LIMITE_POSTS = 100;
// Largo maximo de texto (el mismo que aceptan las reglas y el maxlength del HTML).
const LIMITE_TEXTO_POST = 2000;
const LIMITE_TEXTO_CHAT = 1000;

function loadPosts() {
    if (postsListener) postsListener();
    postsListener = onValue(query(ref(db, 'posts'), orderByChild('createdAt'), limitToLast(LIMITE_POSTS)), snapshot => {
        allPostsCache = snapshot.exists()
            ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })).sort((a, b) => postCreatedAt(b) - postCreatedAt(a))
            : [];
        renderCommunityFeed();
        cleanupExpiredStudentPosts(allPostsCache);
    }, error => {
        console.error('No se pudieron cargar las publicaciones:', error);
        renderInlineStatus(postsContainer, 'No se pudieron cargar las publicaciones. Revisa tu conexión y vuelve a abrir la app.');
    });
}

function loadFollowing() {
    if (!currentUser) return;
    if (followingListener) followingListener();
    followingListener = onValue(ref(db, `siguiendo/${currentUser.uid}`), snapshot => {
        followingIds = snapshot.exists() ? snapshot.val() : {};
        renderCommunityFeed();
        renderUserDirectoryResults();
    });
}

function normalizeUserSearchText(value) {
    return (value || '').toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es-CO')
        .trim();
}

// Sin busqueda, Descubrir sugiere a quien seguir: primero quien ha publicado hace
// poco. Profesores y directivos no hacen falta: ya salen siempre en Inicio.
// La lista se fija en cuanto hay publicaciones, para que quien sigue a alguien lo
// vea pasar a "Siguiendo" en vez de desaparecer de la lista.
let personasSugeridas = [];
function sugerenciasDePersonas(max = 5) {
    if (!personasSugeridas.length || !allPostsCache.length) {
        const ultimaPublicacion = new Map();
        allPostsCache.forEach(post => {
            const uid = post.author?.uid || post.autorId;
            const cuando = postCreatedAt(post);
            if (uid && cuando > (ultimaPublicacion.get(uid) || 0)) ultimaPublicacion.set(uid, cuando);
        });
        personasSugeridas = userDirectoryCache
            .filter(user => !followingIds[user.uid] && !soloActivaAvisos(user.role))
            .sort((a, b) => (ultimaPublicacion.get(b.uid) || 0) - (ultimaPublicacion.get(a.uid) || 0))
            .slice(0, max)
            .map(user => user.uid);
    }
    return personasSugeridas.map(uid => directorioPorUid.get(uid)).filter(Boolean);
}

function filaDePersona(user) {
    const followed = Boolean(followingIds[user.uid]);
    const isUpdating = followActionIds.has(user.uid);
    return `<article class="user-search-result" role="listitem">
            <img src="${escapeAttribute(safeImageSrc(user.avatar))}" alt="" class="avatar-small">
            <div class="user-search-person"><strong>${escapeHTML(user.name || 'Usuario')}</strong><span>${escapeHTML(formatRoleLabel(user.role))}</span></div>
            <button class="action-btn user-search-follow-btn ${followed ? 'following' : ''}" data-user-id="${escapeAttribute(user.uid)}" aria-pressed="${followed}" type="button" ${isUpdating ? 'disabled' : ''}>${isUpdating ? 'Guardando...' : contenidoBotonSeguir(followed, soloActivaAvisos(user.role))}</button>
        </article>`;
}

function renderUserDirectoryFor(input, results, status, sugerir = false) {
    if (!input || !results) return;
    const term = normalizeUserSearchText(input.value);

    if (term.length < 2) {
        const sugeridas = sugerir ? sugerenciasDePersonas() : [];
        results.innerHTML = sugeridas.map(filaDePersona).join('');
        input.setAttribute('aria-expanded', 'false');
        if (status) status.textContent = sugeridas.length
            ? 'Sugerencias para seguir. Escribe un nombre para buscar a alguien más.'
            : 'Escribe al menos 2 letras.';
        return;
    }

    const matches = userDirectoryCache
        .filter(user => normalizeUserSearchText(user.name).includes(term))
        .slice(0, 8);

    input.setAttribute('aria-expanded', 'true');
    if (status) status.textContent = matches.length
        ? `${matches.length} ${matches.length === 1 ? 'persona encontrada' : 'personas encontradas'}.`
        : 'No encontramos personas con ese nombre.';

    if (!matches.length) {
        results.innerHTML = '<p class="user-search-empty">No encontramos personas con ese nombre.</p>';
        return;
    }

    results.innerHTML = matches.map(filaDePersona).join('');
}

function renderUserDirectoryResults() {
    renderUserDirectoryFor(userSearchInput, userSearchResults);
    renderUserDirectoryFor(mobileUserSearchInput, mobileUserSearchResults, mobileUserSearchStatus, true);
}

function loadUserDirectory() {
    if (!currentUser) return;
    if (userDirectoryListener) userDirectoryListener();
    userDirectoryListener = onValue(ref(db, 'users'), snapshot => {
        const todos = Object.entries(snapshot.val() || {}).map(([uid, data]) => ({ uid, ...(data || {}) }));
        directorioPorUid = new Map(todos.map(user => [user.uid, user]));
        userDirectoryCache = todos
            .filter(user => user.uid !== currentUser.uid && Boolean(user.name))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es-CO', { sensitivity: 'base' }));
        renderUserDirectoryResults();
        refrescarAutoresVisibles();
        if (teacherMessagesCache.length) renderTeacherMessages();
        if (supportTicketsCache.length) renderSupportInbox();
        actualizarCuentasPendientes();
    }, error => {
        console.error('No se pudo cargar el directorio de usuarios:', error);
        userDirectoryCache = [];
        if (mobileUserSearchStatus) mobileUserSearchStatus.textContent = 'No se pudo cargar la lista de personas.';
    });
}

// Burbuja breve que sale de la campana de una publicacion al tocarla: dice si las
// notificaciones de esa persona quedan activadas. No recibe toques y se va sola.
// Va oculta al lector de pantalla: el boton ya anuncia su estado (aria-pressed).
let burbujaAvisos = null;
let burbujaAvisosTimer = 0;
function mostrarBurbujaAvisos(boton, activadas) {
    clearTimeout(burbujaAvisosTimer);
    burbujaAvisos?.remove();

    const burbuja = document.createElement('div');
    burbuja.className = 'burbuja-avisos';
    burbuja.setAttribute('aria-hidden', 'true');
    burbuja.innerHTML = activadas
        ? `<i class='bx bxs-bell-ring'></i>Notificaciones activadas`
        : `<i class='bx bx-bell-off'></i>Notificaciones desactivadas`;
    // Va dentro de la tarjeta, junto a la campana: si algo de encima cambia de
    // alto mientras se ve, la burbuja se mueve con ella.
    const contenedor = boton.parentElement;
    contenedor.appendChild(burbuja);

    // Encima de la campana, o debajo si arriba la tapa la cabecera. Sin salirse
    // de la pantalla, con la flecha apuntando al centro de la campana.
    const caja = contenedor.getBoundingClientRect();
    const campana = boton.getBoundingClientRect();
    const ancho = burbuja.offsetWidth;
    const alto = burbuja.offsetHeight;
    const centro = campana.left + campana.width / 2;
    const izquierda = Math.min(Math.max(8, centro - ancho / 2), document.documentElement.clientWidth - ancho - 8);
    const techo = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
    const abajo = campana.top - alto - 10 < techo;
    burbuja.classList.toggle('burbuja-avisos--abajo', abajo);
    burbuja.style.left = `${izquierda - caja.left}px`;
    burbuja.style.top = `${(abajo ? campana.bottom + 10 : campana.top - alto - 10) - caja.top}px`;
    burbuja.style.setProperty('--flecha', `${centro - izquierda}px`);

    burbujaAvisos = burbuja;
    // Ya se midio (offsetWidth), asi que la clase dispara la transicion de entrada.
    burbuja.classList.add('is-visible');
    burbujaAvisosTimer = setTimeout(() => {
        burbuja.classList.remove('is-visible');
        setTimeout(() => burbuja.remove(), 250);
        if (burbujaAvisos === burbuja) burbujaAvisos = null;
    }, 1800);
}

async function toggleFollow(authorId) {
    if (!authorId || !currentUser || authorId === currentUser.uid || followActionIds.has(authorId)) return;
    followActionIds.add(authorId);
    renderUserDirectoryResults();
    const path = ref(db, `siguiendo/${currentUser.uid}/${authorId}`);
    try {
        if (followingIds[authorId]) await remove(path);
        else await set(path, { seguidoId: authorId, creadoEn: Date.now() });
    } catch (error) {
        console.error('No se pudo actualizar el seguimiento:', error);
        avisar('No se pudo actualizar el seguimiento. Inténtalo de nuevo.');
    } finally {
        followActionIds.delete(authorId);
        renderUserDirectoryResults();
    }
}

async function submitComment(postId, input) {
    const text = input?.value?.trim();
    if (!text || !currentUser) return;
    input.value = '';
    try {
        // La foto y el nombre que se muestran salen del perfil del autor; el
        // nombre se guarda solo como respaldo. La hora la pone el servidor.
        await set(push(ref(db, `posts/${postId}/comentarios`)), {
            autorId: currentUser.uid,
            autorNombre: miNombre().slice(0, 60),
            texto: text.slice(0, 500),
            timestamp: serverTimestamp()
        });
        document.getElementById(`comments-${escapeSelector(postId)}`)?.classList.add('visible');
    } catch (error) {
        console.error('No se pudo publicar el comentario:', error);
        // Se devuelve el texto para no obligar a escribirlo otra vez.
        if (input && !input.value) input.value = text;
        avisar('No se pudo publicar el comentario.', { accion: () => submitComment(postId, input) });
    }
}

function openConfirmModal({ title, message, confirmLabel = 'Confirmar', destructive = false }) {
    return new Promise(resolve => {
        const titleEl = document.getElementById('confirm-modal-title');
        const messageEl = document.getElementById('confirm-modal-message');
        const acceptBtn = document.getElementById('confirm-accept-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        if (!confirmModal || !titleEl || !messageEl || !acceptBtn || !cancelBtn) { resolve(window.confirm(message)); return; }
        titleEl.textContent = title;
        messageEl.textContent = message;
        acceptBtn.textContent = confirmLabel;
        acceptBtn.classList.toggle('danger-btn', destructive);
        confirmModal.classList.add('active');
        const close = result => {
            confirmModal.classList.remove('active');
            acceptBtn.removeEventListener('click', accepted);
            cancelBtn.removeEventListener('click', cancelled);
            pendingConfirmResolver = null;
            resolve(result);
        };
        const accepted = () => close(true);
        const cancelled = () => close(false);
        pendingConfirmResolver = cancelled;
        acceptBtn.addEventListener('click', accepted);
        cancelBtn.addEventListener('click', cancelled);
    });
}

async function deletePostWithLog(postId) {
    const post = allPostsCache.find(item => item.id === postId);
    if (!currentUser || !canDeletePost(post)) return;
    const shouldDelete = await openConfirmModal({ title: 'Eliminar publicación', message: 'Esta acción eliminará también sus comentarios y no se puede deshacer.', confirmLabel: 'Eliminar', destructive: true });
    if (!shouldDelete) return;
    const updates = { [`posts/${postId}`]: null };
    if (post.tieneImagen) updates[`imagenesPosts/${postId}`] = null;

    // El historial de moderación registra solo acciones administrativas. Los
    // autores pueden retirar su propio contenido sin obtener permiso de logs.
    if (canManageContent()) {
        const logId = push(ref(db, 'logs_moderacion')).key;
        updates[`logs_moderacion/${logId}`] = {
            moderadorId: currentUser.uid,
            moderadorNombre: miNombre('Administrador'),
            postId,
            autorPostId: post.author?.uid || post.autorId || '',
            accion: 'eliminar_publicacion',
            timestamp: Date.now()
        };
    }
    try {
        await update(ref(db), updates);
    } catch (error) {
        console.error('No se pudo eliminar la publicación:', error);
        avisar('No se pudo eliminar la publicación. Inténtalo de nuevo.');
    }
}

async function deleteComment(postId, commentId, authorId, commentPath = 'comentarios') {
    if (!currentUser || !canManageContent()) return;
    const confirmed = await openConfirmModal({ title: 'Eliminar comentario', message: '¿Quieres eliminar este comentario?', confirmLabel: 'Eliminar', destructive: true });
    if (!confirmed) return;
    try {
        await remove(ref(db, `posts/${postId}/${commentPath}/${commentId}`));
    } catch (error) {
        console.error('No se pudo eliminar el comentario:', error);
        avisar('No se pudo eliminar el comentario. Inténtalo de nuevo.');
    }
}

function renderModerationQueue() {
    const flaggedPosts = allPostsCache.filter(post => post.flagged && !isExpiredStudentPost(post));
    if (moderationCount) {
        moderationCount.hidden = flaggedPosts.length === 0;
        moderationCount.textContent = flaggedPosts.length > 99 ? '99+' : String(flaggedPosts.length);
    }
    if (!moderationPostsList) return;
    if (!canManageContent()) { moderationPostsList.innerHTML = ''; return; }
    moderationPostsList.innerHTML = flaggedPosts.length ? flaggedPosts.map(post => `<article class="moderation-item"><div class="moderation-item-header"><span>${escapeHTML(post.author?.name || 'Usuario')}</span><span class="post-flag">${escapeHTML(post.reason || 'Revisión requerida')}</span></div><p>${escapeHTML(post.content || '(Publicación con imagen)')}</p><div class="moderation-actions"><button class="btn-primary moderation-delete-btn" data-id="${escapeAttribute(post.id)}" type="button">Eliminar</button><button class="action-btn moderation-dismiss-btn" data-id="${escapeAttribute(post.id)}" type="button">Descartar alerta</button></div></article>`).join('') : '<p class="empty-state">No hay publicaciones pendientes de revisión.</p>';
}

function loadModerationConfig() {
    if (moderationConfigListener) moderationConfigListener();
    moderationConfigListener = onValue(ref(db, 'configuracion/moderacion/palabrasProhibidas'), snapshot => {
        prohibitedWords = normalizeProhibitedWords(snapshot.val());
    }, () => { prohibitedWords = [...DEFAULT_PROHIBITED_WORDS]; });
}

function updateTeacherComposer() {
    if (!teacherMessageComposer || !teacherMessageInput || !teacherMessageCount || !sendTeacherMessageBtn) return;
    const words = countWords(teacherMessageInput.value);
    const sentToday = teacherMessagesCache.filter(message => message.autorId === currentUser?.uid && message.dia === todayKey()).length;
    const exceedsWords = words > 15;
    teacherMessageCount.textContent = `${words}/15 palabras`;
    teacherMessageCount.style.color = exceedsWords ? 'var(--danger-red)' : '';
    sendTeacherMessageBtn.disabled = !puedePublicarAvisos() || !teacherMessageInput.value.trim() || exceedsWords || sentToday >= 3;
    if (teacherMessageLimit) teacherMessageLimit.textContent = sentToday >= 3 ? 'Ya usaste tus 3 mensajes de hoy.' : `${3 - sentToday} mensaje${3 - sentToday === 1 ? '' : 's'} disponible${3 - sentToday === 1 ? '' : 's'} hoy.`;
}

function renderTeacherMessages() {
    if (!teacherMessagesList) return;
    const latest = teacherMessagesCache.slice(0, 20);
    teacherMessagesList.innerHTML = latest.length ? latest.map(message => `<article class="teacher-message">${botonBorrarAviso(message)}<strong>${escapeHTML(nombreVisible(message.autorId, message.autorNombre || 'Profesor'))}</strong><p>${escapeHTML(message.texto || '')}</p><time>${new Date(message.timestamp || Date.now()).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</time></article>`).join('') : '<p class="empty-state">Aún no hay anuncios del profesorado.</p>';
    updateTeacherComposer();
}

function botonBorrarAviso(message) {
    if (!isAdmin || !message.autorId || !message._slot || !message.dia) return '';
    return `<button class="teacher-message__delete" type="button" data-borrar-aviso data-dia="${escapeAttribute(message.dia)}" data-autor="${escapeAttribute(message.autorId)}" data-slot="${escapeAttribute(message._slot)}" aria-label="Borrar el aviso de ${escapeAttribute(nombreVisible(message.autorId, message.autorNombre || 'Profesor'))}"><i class='bx bx-trash'></i></button>`;
}

// Un administrador borra cualquier aviso, tras confirmarlo.
teacherMessagesList?.addEventListener('click', async event => {
    const boton = event.target.closest('[data-borrar-aviso]');
    if (!boton || !isAdmin) return;
    const confirmado = await openConfirmModal({ title: 'Borrar aviso', message: 'El aviso desaparecerá para todos. Esta acción no se puede deshacer.', confirmLabel: 'Borrar', destructive: true });
    if (!confirmado) return;
    boton.disabled = true;
    const { dia, autor, slot } = boton.dataset;
    try {
        await remove(ref(db, `mensajes_profesor/${dia}/${autor}/${slot}`));
    } catch (error) {
        console.error('No se pudo borrar el aviso:', error);
        boton.disabled = false;
        avisar('No se pudo borrar el aviso. Inténtalo de nuevo.');
    }
});

// Solo los avisos de la ultima semana (los dias son las claves del nodo): antes
// se descargaba todo el historial de avisos en cada apertura.
const DIAS_DE_AVISOS = 7;

function loadTeacherMessages() {
    if (teacherMessagesListener) teacherMessagesListener();
    const desde = todayKey(new Date(Date.now() - DIAS_DE_AVISOS * 24 * 60 * 60 * 1000));
    teacherMessagesListener = onValue(query(ref(db, 'mensajes_profesor'), orderByKey(), startAt(desde)), snapshot => {
        const root = snapshot.val() || {};
        teacherMessagesCache = Object.entries(root).flatMap(([dia, byTeacher]) => Object.values(byTeacher || {}).flatMap(slots => Object.entries(slots || {}).map(([slot, message]) => ({ ...message, dia: message.dia || dia, _slot: slot })))).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderTeacherMessages();
    }, () => renderInlineStatus(teacherMessagesList, 'No se pudieron cargar los anuncios.'));
}

async function sendTeacherMessage() {
    if (!puedePublicarAvisos() || !currentUser || !teacherMessageInput) return;
    const texto = teacherMessageInput.value.trim();
    const words = countWords(texto);
    const dia = todayKey();
    const todaysMessages = teacherMessagesCache.filter(message => message.autorId === currentUser.uid && message.dia === dia);
    if (!texto || words > 15 || todaysMessages.length >= 3) { updateTeacherComposer(); return; }
    const occupied = new Set(todaysMessages.map(message => String(message._slot || '')));
    const slot = ['1', '2', '3'].find(value => !occupied.has(value)) || String(todaysMessages.length + 1);
    try {
        await set(ref(db, `mensajes_profesor/${dia}/${currentUser.uid}/${slot}`), {
            autorId: currentUser.uid,
            autorNombre: miNombre('Profesor'),
            texto,
            timestamp: Date.now(),
            dia
        });
        avisarDespachadorDeNotificaciones();
        teacherMessageInput.value = '';
        updateTeacherComposer();
    } catch (error) {
        console.error('No se pudo enviar el anuncio:', error);
        avisar('No se pudo enviar el mensaje. Revisa tu conexión.', { accion: sendTeacherMessage });
    }
}

function configureCommunityVisibility() {
    const contentManager = canManageContent();
    document.querySelectorAll('.moderation-only').forEach(element => { element.style.display = contentManager ? 'flex' : 'none'; });
    if (teacherMessageComposer) teacherMessageComposer.style.display = puedePublicarAvisos() ? 'block' : 'none';
    updateTeacherComposer();
}

function initializeCommunityFeatures() {
    configureCommunityVisibility();
    loadModerationConfig();
    loadFollowing();
    loadUserDirectory();
    loadPosts();
    loadTeacherMessages();
    loadSupportInbox();
}

document.getElementById('publish-post-btn').addEventListener('click', async event => {
    const text = document.getElementById('post-textarea').value.trim();
    if ((!text && !currentPostImageBase64) || !currentUser) return;
    const button = event.currentTarget;
    button.textContent = 'Publicando...'; button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
        const flagged = containsProhibitedWord(text);
        // La hora la pone el servidor (las reglas rechazan fechas futuras).
        const postData = {
            author: { uid: currentUser.uid, name: miNombre().slice(0, 60), avatar: miAvatar() },
            authorRole: normalizeRole(userRole),
            content: text.slice(0, LIMITE_TEXTO_POST),
            timestamp: serverTimestamp(),
            createdAt: serverTimestamp(),
            flagged,
            reason: flagged ? 'lenguaje inapropiado' : null
        };
        const postId = push(ref(db, 'posts')).key;
        const escritura = { [`posts/${postId}`]: postData };
        // La imagen va aparte, en la misma escritura atomica: el feed no la descarga
        // hasta que la tarjeta se acerca a la pantalla.
        if (currentPostImageBase64) {
            postData.tieneImagen = true;
            escritura[`imagenesPosts/${postId}`] = currentPostImageBase64;
        }
        await update(ref(db), escritura);
        avisarDespachadorDeNotificaciones();
        postModal.classList.remove('active');
        document.getElementById('post-textarea').value = '';
        resetImagePreview();
    } catch (error) {
        console.error('No se pudo publicar:', error);
        avisar('No se pudo publicar. Revisa tu conexión.', { accion: () => button.click() });
    } finally {
        button.textContent = 'Publicar';
        button.removeAttribute('aria-busy');
        revisarContenido(button);
    }
});

postsContainer.addEventListener('click', async event => {
    if (event.target.closest('[data-accion="encontrar-personas"]')) return irAEncontrarPersonas();
    const deleteButton = event.target.closest('.delete-post-btn');
    if (deleteButton) return deletePostWithLog(deleteButton.dataset.id);
    const followButton = event.target.closest('.follow-btn');
    if (followButton) {
        const autor = followButton.dataset.authorId;
        if (followButton.classList.contains('follow-btn--avisos') && autor && !followActionIds.has(autor)) {
            mostrarBurbujaAvisos(followButton, !followingIds[autor]);
        }
        return toggleFollow(autor);
    }
    const likeButton = event.target.closest('.like-btn');
    if (likeButton && currentUser) {
        // Un toque a la vez por publicacion: dos toques rapidos no se pisan.
        if (likeButton.dataset.guardando) return;
        likeButton.dataset.guardando = '1';
        const post = allPostsCache.find(item => item.id === likeButton.dataset.id);
        const likeRef = ref(db, `posts/${likeButton.dataset.id}/likes/${currentUser.uid}`);
        try {
            if (post?.likes?.[currentUser.uid]) await remove(likeRef);
            else await set(likeRef, true);
        } catch (error) {
            console.error('No se pudo guardar el me gusta:', error);
            avisar('No se pudo guardar tu me gusta. Inténtalo de nuevo.');
        } finally {
            delete likeButton.dataset.guardando;
        }
        return;
    }
    const commentButton = event.target.closest('.comment-btn');
    if (commentButton) return document.getElementById(`comments-${escapeSelector(commentButton.dataset.id)}`)?.classList.toggle('visible');
    const submitButton = event.target.closest('.comment-submit-btn');
    if (submitButton) return submitComment(submitButton.dataset.id, postsContainer.querySelector(`.new-comment-input[data-id="${escapeSelector(submitButton.dataset.id)}"]`));
    const deleteCommentButton = event.target.closest('.delete-comment-btn');
    if (deleteCommentButton) return deleteComment(deleteCommentButton.dataset.postId, deleteCommentButton.dataset.commentId, deleteCommentButton.dataset.authorId, deleteCommentButton.dataset.commentPath);
});

postsContainer.addEventListener('keypress', event => {
    if (event.key === 'Enter' && event.target.classList.contains('new-comment-input')) submitComment(event.target.dataset.id, event.target);
});

[userSearchInput, mobileUserSearchInput].forEach(input => {
    if (!input) return;
    input.addEventListener('input', renderUserDirectoryResults);
    input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            // Solo limpia la busqueda: que no cierre ademas la ventana de debajo.
            event.preventDefault();
            input.value = '';
            input.blur();
            renderUserDirectoryResults();
        }
    });
});

[userSearchResults, mobileUserSearchResults].forEach(results => {
    results?.addEventListener('click', event => {
        const followButton = event.target.closest('.user-search-follow-btn');
        if (followButton) toggleFollow(followButton.dataset.userId);
    });
});

document.addEventListener('click', event => {
    if (event.target.closest('#user-search, .user-search-mobile')) return;
    let changed = false;
    [userSearchInput, mobileUserSearchInput].forEach(input => {
        if (input?.value) { input.value = ''; changed = true; }
    });
    if (changed) renderUserDirectoryResults();
});

if (teacherMessageInput) teacherMessageInput.addEventListener('input', updateTeacherComposer);
if (sendTeacherMessageBtn) sendTeacherMessageBtn.addEventListener('click', sendTeacherMessage);
if (navModerationBtn) navModerationBtn.addEventListener('click', event => { event.preventDefault(); if (canManageContent()) moderationModal?.classList.add('active'); });
document.getElementById('close-moderation-btn')?.addEventListener('click', () => moderationModal?.classList.remove('active'));
moderationPostsList?.addEventListener('click', async event => {
    const deleteButton = event.target.closest('.moderation-delete-btn');
    if (deleteButton) return deletePostWithLog(deleteButton.dataset.id);
    const dismissButton = event.target.closest('.moderation-dismiss-btn');
    if (!dismissButton || !canManageContent()) return;
    dismissButton.disabled = true;
    try {
        await update(ref(db, `posts/${dismissButton.dataset.id}`), { flagged: false, reason: null });
    } catch (error) {
        console.error('No se pudo descartar la alerta:', error);
        dismissButton.disabled = false;
        avisar('No se pudo descartar la alerta. Inténtalo de nuevo.');
    }
});

function toggleSupportModal(open) {
    if (!supportModal) return;
    supportModal.classList.toggle('active', open);
    supportModal.setAttribute('aria-hidden', String(!open));

    if (open) {
        requestAnimationFrame(() => supportText?.focus());
    }
}

if (supportFab) {
    supportFab.addEventListener('click', event => {
        // El botón está dentro de la vista principal: en WebView evitamos que
        // el toque se propague a elementos que puedan estar debajo del modal.
        event.preventDefault();
        event.stopPropagation();
        toggleSupportModal(true);
    });
}
document.getElementById('close-support-btn')?.addEventListener('click', () => toggleSupportModal(false));
supportModal?.addEventListener('click', event => {
    if (event.target === supportModal) toggleSupportModal(false);
});
document.getElementById('send-support-btn')?.addEventListener('click', async event => {
    const text = supportText?.value.trim();
    if (!text || !currentUser) return;
    const button = event.currentTarget;
    button.disabled = true; button.textContent = 'Enviando...';
    button.setAttribute('aria-busy', 'true');
    try {
        await set(push(ref(db, 'soporte')), { userId: currentUser.uid, texto: text, timestamp: Date.now(), estado: 'pendiente' });
        avisarDespachadorDeNotificaciones();
        supportText.value = '';
        button.textContent = '¡Solicitud enviada!';
        setTimeout(() => {
            supportModal?.classList.remove('active');
            button.textContent = 'Enviar solicitud';
            button.removeAttribute('aria-busy');
            revisarContenido(button);
        }, 1200);
    } catch (error) {
        console.error('No se pudo enviar soporte:', error);
        button.textContent = 'Reintentar';
        button.removeAttribute('aria-busy');
        button.disabled = false;
    }
});
exigirContenido(document.getElementById('send-support-btn'), () => Boolean(supportText?.value.trim()), [supportText]);

// === ADMIN WIDGETS LOGIC (News, Reports, Events) ===

// Publica una sola vez aunque se toque varias veces: el boton queda bloqueado
// mientras guarda y, si falla, se avisa en vez de no hacer nada.
async function publicarUnaVez(boton, accion) {
    if (!boton || boton.disabled) return;
    const texto = boton.innerHTML;
    boton.disabled = true;
    boton.textContent = 'Publicando...';
    try {
        await accion();
    } catch (error) {
        console.error('No se pudo publicar:', error);
        avisar('No se pudo publicar. Revisa tu conexión.', { accion: () => boton.click() });
    } finally {
        boton.disabled = false;
        boton.innerHTML = texto;
    }
}

async function borrarConConfirmacion(pregunta, ruta) {
    if (!confirm(pregunta)) return;
    hapticTap(40);
    try {
        await remove(ref(db, ruta));
    } catch (error) {
        console.error('No se pudo borrar:', error);
        avisar('No se pudo borrar. Inténtalo de nuevo.');
    }
}

let newsListener = null;
let reportsListener = null;
let eventsListener = null;

// News
document.getElementById('publish-news-btn').onclick = (e) => {
    const t = document.getElementById('news-title-input').value.trim();
    const d = document.getElementById('news-desc-input').value.trim();
    if (!isAdmin) return;
    if (faltanCampos([
        [document.getElementById('news-title-input'), 'Escribe el título de la noticia.'],
        [document.getElementById('news-desc-input'), 'Escribe la descripción de la noticia.'],
    ])) return;
    hapticTap([10,30,10]);
    publicarUnaVez(e.currentTarget, async () => {
        await set(push(ref(db, 'news')), { title: t, desc: d, timestamp: Date.now() });
        avisarDespachadorDeNotificaciones();
        newsModal.classList.remove('active'); document.getElementById('news-title-input').value=''; document.getElementById('news-desc-input').value='';
    });
};

function loadNews() {
    newsListener?.();
    newsListener = onValue(ref(db, 'news'), (snapshot) => {
        newsContainer.innerHTML = '';
        if (!snapshot.exists()) { newsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No hay noticias.</p>'; return; }
        const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=>b.timestamp-a.timestamp);
        arr.forEach(item => {
            const el = document.createElement('div'); el.className = 'news-item';
            const itemId = escapeAttribute(item.id);
            const title = escapeHTML(item.title);
            const desc = escapeHTML(item.desc);
            el.innerHTML = `${isAdmin ? `<button class="delete-news-btn" data-id="${itemId}"><i class='bx bx-trash'></i></button>` : ''}<h3>${title}</h3><p>${desc}</p>`;
            newsContainer.appendChild(el);
        });
        if(isAdmin) document.querySelectorAll('.delete-news-btn').forEach(b => b.onclick = (e) => borrarConConfirmacion('¿Borrar noticia?', `news/${e.currentTarget.dataset.id}`));
    });
}

// Reports
document.getElementById('publish-report-btn').onclick = (e) => {
    const title = document.getElementById('report-title-input').value.trim();
    const status = document.getElementById('report-status-input').value;
    if (!isAdmin) return;
    if (faltanCampos([[document.getElementById('report-title-input'), 'Escribe el nombre del reporte.']])) return;
    hapticTap([10,30,10]);
    publicarUnaVez(e.currentTarget, async () => {
        await set(push(ref(db, 'reports')), { title, status, timestamp: Date.now() });
        reportModal.classList.remove('active'); document.getElementById('report-title-input').value='';
    });
};

const ESTADOS_REPORTE = {
    'Disponible':  { clase: 'success', icono: 'bx-check-circle' },
    'En revisión': { clase: 'info',    icono: 'bx-time-five' },
    'Pendiente':   { clase: 'warning', icono: 'bx-hourglass' },
};

function loadReports() {
    reportsListener?.();
    reportsListener = onValue(ref(db, 'reports'), (snapshot) => {
        reportsContainer.innerHTML = '';
        if (!snapshot.exists()) { reportsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Sin reportes.</p>'; return; }
        const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=>b.timestamp-a.timestamp);
        arr.forEach(item => {
            // Cada estado con su icono y color: antes todos llevaban una casilla
            // marcada, tambien "Pendiente", que parecia ya resuelto.
            const estado = ESTADOS_REPORTE[item.status] || ESTADOS_REPORTE.Pendiente;
            const el = document.createElement('div'); el.className = `report-item report-item--${estado.clase}`;
            const itemId = escapeAttribute(item.id);
            const title = escapeHTML(item.title);
            const status = escapeHTML(item.status);
            el.innerHTML = `<div class="report-info"><i class='bx ${estado.icono}' aria-hidden="true"></i><span>${title}</span></div>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span class="badge ${estado.clase}">${status}</span>
                                ${isAdmin ? `<button class="delete-report-btn" type="button" data-id="${itemId}" aria-label="Borrar el reporte ${title}"><i class='bx bx-trash' aria-hidden="true"></i></button>` : ''}
                            </div>`;
            reportsContainer.appendChild(el);
        });
        if(isAdmin) document.querySelectorAll('.delete-report-btn').forEach(b => b.onclick = (e) => borrarConConfirmacion('¿Borrar reporte?', `reports/${e.currentTarget.dataset.id}`));
    });
}

// Events
document.getElementById('publish-event-btn').onclick = (e) => {
    const title = document.getElementById('event-title-input').value.trim();
    const date = document.getElementById('event-date-input').value;
    if (!isAdmin) return;
    if (faltanCampos([
        [document.getElementById('event-title-input'), 'Escribe el nombre del evento.'],
        [document.getElementById('event-date-input'), 'Elige la fecha del evento.'],
    ])) return;
    hapticTap([10,30,10]);
    publicarUnaVez(e.currentTarget, async () => {
        await set(push(ref(db, 'events')), { title, date, timestamp: Date.now() });
        avisarDespachadorDeNotificaciones();
        eventCreateModal.classList.remove('active'); document.getElementById('event-title-input').value=''; document.getElementById('event-date-input').value='';
    });
};

function fechaDeEvento(fecha) {
    const [anio, mes, dia] = (fecha || '').split('-').map(Number);
    return new Date(anio, mes - 1, dia);
}

function loadEvents() {
    eventsListener?.();
    eventsListener = onValue(ref(db, 'events'), (snapshot) => {
        eventsListContainer.innerHTML = '';
        // Solo los de hoy en adelante: los pasados ya no son "proximos eventos".
        const hoy = todayKey();
        const arr = Object.entries(snapshot.val() || {})
            .map(([id, d]) => ({id, ...d}))
            .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(item.date || '') && item.date >= hoy)
            .sort((a, b) => fechaDeEvento(a.date) - fechaDeEvento(b.date));
        if (!arr.length) { eventsListContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No hay próximos eventos programados.</p>'; return; }
        arr.forEach(item => {
            const el = document.createElement('div'); el.className = 'event-item';
            const formattedDate = fechaDeEvento(item.date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'long' });
            const itemId = escapeAttribute(item.id);
            const title = escapeHTML(item.title);
            const dateText = escapeHTML(formattedDate);
            el.innerHTML = `
                <div class="event-info"><h3>${title}</h3><span class="event-date"><i class='bx bx-calendar'></i> ${dateText}</span></div>
                ${isAdmin ? `<button class="action-btn delete-event-btn" data-id="${itemId}" style="color:red;"><i class='bx bx-trash'></i></button>` : ''}
            `;
            eventsListContainer.appendChild(el);
        });
        if(isAdmin) document.querySelectorAll('.delete-event-btn').forEach(b => b.onclick = (e) => borrarConConfirmacion('¿Borrar evento?', `events/${e.target.closest('.delete-event-btn').dataset.id}`));
    });
}

// === PERSONAL TASKS ===
function getLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getDateFromKey(dateKey) {
    const [year, month, day] = (dateKey || '').split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatTaskDate(dateKey) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey || '')) return 'Sin fecha';
    return getDateFromKey(dateKey).toLocaleDateString('es-CO', {
        weekday: 'short', day: 'numeric', month: 'short'
    });
}

function isTaskInCurrentMonth(task) {
    const taskDate = getDateFromKey(task.dueDate);
    return taskDate.getFullYear() === taskCalendarDate.getFullYear() &&
        taskDate.getMonth() === taskCalendarDate.getMonth();
}

function loadPersonalTasks() {
    if (!currentUser) return;
    if (personalTasksListener) personalTasksListener();

    personalTasksListener = onValue(ref(db, `personalTasks/${currentUser.uid}`), (snapshot) => {
        personalTasksCache = snapshot.exists()
            ? Object.entries(snapshot.val()).map(([id, task]) => ({ id, ...task }))
            : [];
        renderPersonalTasks();
    }, (error) => {
        console.error('No se pudieron cargar las tareas personales:', error);
        personalTasksCache = [];
        renderPersonalTasks();
    });
}

function renderPersonalTasks() {
    renderTaskCalendar();
    renderTaskList();
}

function renderTaskCalendar() {
    if (!taskCalendarGrid || !taskCalendarMonthLabel) return;

    const year = taskCalendarDate.getFullYear();
    const month = taskCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOffset = (firstDay.getDay() + 6) % 7;

    taskCalendarMonthLabel.textContent = new Intl.DateTimeFormat('es-CO', {
        month: 'long', year: 'numeric'
    }).format(firstDay);
    taskCalendarGrid.innerHTML = '';

    for (let index = 0; index < firstDayOffset; index += 1) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'task-calendar-day empty';
        taskCalendarGrid.appendChild(emptyDay);
    }

    const todayKey = getLocalDateKey(new Date());
    for (let day = 1; day <= daysInMonth; day += 1) {
        const dateKey = getLocalDateKey(new Date(year, month, day));
        const dayTasks = personalTasksCache.filter(task => task.dueDate === dateKey);
        const hasPendingTask = dayTasks.some(task => !task.completed);
        const allTasksCompleted = dayTasks.length > 0 && dayTasks.every(task => task.completed);
        const calendarDay = document.createElement('button');
        calendarDay.type = 'button';
        calendarDay.className = 'task-calendar-day';
        calendarDay.dataset.date = dateKey;
        const estadoDia = !dayTasks.length ? ''
            : `, ${dayTasks.length} tarea${dayTasks.length === 1 ? '' : 's'}, ${allTasksCompleted ? (dayTasks.length === 1 ? 'completada' : 'todas completadas') : (dateKey < todayKey ? 'con entrega vencida' : 'con entrega pendiente')}`;
        calendarDay.setAttribute('aria-label', `${day} de ${taskCalendarMonthLabel.textContent}${estadoDia}`);

        if (dateKey === todayKey) calendarDay.classList.add('today');
        if (dateKey === selectedTaskDate) calendarDay.classList.add('selected');
        if (hasPendingTask) calendarDay.classList.add(dateKey < todayKey ? 'overdue' : 'has-pending');
        if (allTasksCompleted) calendarDay.classList.add('all-completed');

        calendarDay.innerHTML = `<span>${day}</span>${dayTasks.length ? `<small>${dayTasks.length}</small>` : ''}`;
        calendarDay.addEventListener('click', () => {
            selectedTaskDate = dateKey;
            renderPersonalTasks();
        });
        taskCalendarGrid.appendChild(calendarDay);
    }
}

function renderTaskList() {
    if (!tasksList || !taskListTitle) return;

    const visibleTasks = (selectedTaskDate
        ? personalTasksCache.filter(task => task.dueDate === selectedTaskDate)
        : personalTasksCache.filter(isTaskInCurrentMonth)
    ).sort((firstTask, secondTask) => {
        const completionOrder = Number(firstTask.completed) - Number(secondTask.completed);
        return completionOrder || (firstTask.dueDate || '').localeCompare(secondTask.dueDate || '');
    });

    const selectedDateLabel = selectedTaskDate ? formatTaskDate(selectedTaskDate) : null;
    taskListTitle.textContent = selectedDateLabel ? `Tareas: ${selectedDateLabel}` : 'Tareas del mes';
    clearTaskDateFilterBtn.hidden = !selectedTaskDate;
    tasksList.innerHTML = '';

    if (!visibleTasks.length) {
        const emptyState = document.createElement('p');
        emptyState.className = 'task-empty-state';
        emptyState.textContent = selectedDateLabel
            ? 'No hay tareas con esta fecha de entrega.'
            : 'No tienes tareas para este mes.';
        tasksList.appendChild(emptyState);
        return;
    }

    const todayKey = getLocalDateKey(new Date());
    visibleTasks.forEach((task) => {
        const isCompleted = task.completed === true;
        const isOverdue = !isCompleted && task.dueDate < todayKey;
        const taskElement = document.createElement('article');
        taskElement.className = `task-item${isCompleted ? ' completed' : ''}${isOverdue ? ' overdue' : ''}`;
        const taskId = escapeAttribute(task.id);
        const taskTitle = escapeHTML(task.title || 'Tarea sin titulo');
        const statusLabel = isCompleted ? 'Completada' : (isOverdue ? 'Vencida' : 'Pendiente');
        const statusClass = isCompleted ? 'completed' : (isOverdue ? 'overdue' : 'pending');

        taskElement.innerHTML = `
            <button class="task-complete-btn" type="button" data-id="${taskId}" aria-label="${isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}">
                <i class='bx ${isCompleted ? 'bx-check' : 'bx-circle'}'></i>
            </button>
            <div class="task-item-content">
                <h4>${taskTitle}</h4>
                <span><i class='bx bx-calendar'></i> Entrega: ${escapeHTML(formatTaskDate(task.dueDate))}</span>
            </div>
            <div class="task-item-actions">
                <span class="task-status ${statusClass}">${statusLabel}</span>
                <button class="task-delete-btn" type="button" data-id="${taskId}" aria-label="Eliminar tarea"><i class='bx bx-trash'></i></button>
            </div>
        `;
        tasksList.appendChild(taskElement);
    });

    tasksList.querySelectorAll('.task-complete-btn').forEach((button) => {
        button.addEventListener('click', () => togglePersonalTask(button.dataset.id));
    });
    tasksList.querySelectorAll('.task-delete-btn').forEach((button) => {
        button.addEventListener('click', () => deletePersonalTask(button.dataset.id));
    });
}

async function togglePersonalTask(taskId) {
    const task = personalTasksCache.find(item => item.id === taskId);
    if (!task || !currentUser) return;
    hapticTap(10);

    try {
        const completed = !task.completed;
        await update(ref(db, `personalTasks/${currentUser.uid}/${taskId}`), {
            completed,
            completedAt: completed ? Date.now() : null
        });
    } catch (error) {
        console.error('No se pudo actualizar la tarea:', error);
        avisar('No se pudo actualizar la tarea. Intenta de nuevo.');
    }
}

async function deletePersonalTask(taskId) {
    if (!currentUser || !taskId || !confirm('¿Eliminar esta tarea?')) return;
    hapticTap(40);

    try {
        await remove(ref(db, `personalTasks/${currentUser.uid}/${taskId}`));
    } catch (error) {
        console.error('No se pudo eliminar la tarea:', error);
        avisar('No se pudo eliminar la tarea. Intenta de nuevo.');
    }
}

function openPersonalTasks() {
    taskCalendarDate = new Date();
    selectedTaskDate = null;
    renderPersonalTasks();
    tasksModal.classList.add('active');
}

if (navTasksBtn) {
    navTasksBtn.onclick = (event) => {
        event.preventDefault();
        openPersonalTasks();
    };
}
if (mobileTasksBtn) mobileTasksBtn.onclick = openPersonalTasks;

document.getElementById('close-tasks-btn').onclick = () => tasksModal.classList.remove('active');
document.getElementById('task-calendar-prev-btn').onclick = () => {
    taskCalendarDate = new Date(taskCalendarDate.getFullYear(), taskCalendarDate.getMonth() - 1, 1);
    selectedTaskDate = null;
    renderPersonalTasks();
};
document.getElementById('task-calendar-next-btn').onclick = () => {
    taskCalendarDate = new Date(taskCalendarDate.getFullYear(), taskCalendarDate.getMonth() + 1, 1);
    selectedTaskDate = null;
    renderPersonalTasks();
};
clearTaskDateFilterBtn.onclick = () => {
    selectedTaskDate = null;
    renderPersonalTasks();
};

const taskTitleInput = document.getElementById('task-title-input');
const taskDateInput = document.getElementById('task-date-input');
const saveTaskBtn = document.getElementById('save-task-btn');
document.getElementById('add-task-btn').onclick = () => {
    taskTitleInput.value = '';
    taskDateInput.value = selectedTaskDate || getLocalDateKey(new Date());
    taskCreateModal.classList.add('active');
    taskTitleInput.focus();
};
document.getElementById('close-task-create-btn').onclick = () => taskCreateModal.classList.remove('active');

saveTaskBtn.onclick = async () => {
    const title = taskTitleInput.value.trim();
    const dueDate = taskDateInput.value;
    if (!currentUser) return;
    if (faltanCampos([
        [taskTitleInput, 'Escribe el nombre de la tarea.'],
        [taskDateInput, 'Elige la fecha de entrega.'],
    ])) return;
    hapticTap([10,30,10]);

    saveTaskBtn.disabled = true;
    try {
        await set(push(ref(db, `personalTasks/${currentUser.uid}`)), {
            title,
            dueDate,
            completed: false,
            createdAt: Date.now()
        });
        taskCreateModal.classList.remove('active');
    } catch (error) {
        console.error('No se pudo guardar la tarea:', error);
        avisar('No se pudo guardar la tarea. Revisa tu conexión.', { accion: () => saveTaskBtn.click() });
    } finally {
        saveTaskBtn.disabled = false;
    }
};

// === GAMES & CHALLENGES (TIC TAC TOE) ===
const navGamesBtn = document.getElementById('nav-games-btn');
const gamesModal = document.getElementById('games-modal');
const closeGamesModalBtn = document.getElementById('close-games-modal-btn');
const boardEl = document.getElementById('tic-tac-toe-board');
const statusText = document.getElementById('game-status-text');
const resetGameBtn = document.getElementById('reset-game-btn');

let boardState = Array(9).fill(null);
let xIsNext = true;
let gameActive = false;

if (navGamesBtn) {
    navGamesBtn.onclick = (e) => {
        e.preventDefault();
        gamesModal.classList.add('active');
        initGame();
    };
}
if (closeGamesModalBtn) closeGamesModalBtn.onclick = () => gamesModal.classList.remove('active');

function initGame() {
    boardState = Array(9).fill(null);
    xIsNext = true;
    gameActive = true;
    statusText.textContent = "Tu turno (X)";
    boardEl.innerHTML = '';

    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'tic-tac-toe-cell';
        cell.dataset.index = i;
        cell.addEventListener('click', handleCellClick);
        boardEl.appendChild(cell);
    }
}

function handleCellClick(e) {
    const idx = e.target.dataset.index;
    if (!gameActive || boardState[idx]) return;
    hapticTap(10);

    boardState[idx] = xIsNext ? 'X' : 'O';
    e.target.textContent = boardState[idx];
    e.target.classList.add(boardState[idx].toLowerCase());

    if (checkWin()) {
        statusText.textContent = `¡${boardState[idx]} ha ganado!`;
        gameActive = false;
        return;
    }

    if (!boardState.includes(null)) {
        statusText.textContent = "¡Empate!";
        gameActive = false;
        return;
    }

    xIsNext = !xIsNext;
    statusText.textContent = `Turno de ${xIsNext ? 'X' : 'O'}`;
}

function checkWin() {
    const lines = [
        [0,1,2], [3,4,5], [6,7,8],
        [0,3,6], [1,4,7], [2,5,8],
        [0,4,8], [2,4,6]
    ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
            return true;
        }
    }
    return false;
}

if (resetGameBtn) resetGameBtn.onclick = () => {
    hapticTap(15);
    initGame();
};

// === CHAT SYSTEM ===
// La lista del chat muestra arriba las conversaciones (extracto del ultimo
// mensaje, hora y mensajes sin leer) y debajo el resto de contactos. De cada
// contacto se escuchan los ultimos mensajes de su chat: asi una conversacion
// nueva aparece en cuanto la otra persona escribe, aunque el panel este cerrado.
const CHAT_MENSAJES_RESUMEN = 10; // ultimos mensajes que se miran de cada chat
const CHAT_MAX_SIN_LEER = 9;      // a partir de aqui la fila muestra "9+"
let resumenesChat = new Map();    // uid del contacto -> { chatId, off, mensajes, cargado, sinAcceso }
let chatLeidos = {};              // chatId -> hora del ultimo mensaje recibido que se vio
let chatLeidosListener = null;
let lecturaChatPendiente = null;  // lectura que espera a que la app vuelva a verse
let activeChatUid = null;
let chatListaTimer = 0;
let chatEsperaTimer = 0;
let chatRelojTimer = 0;
let chatCargaHasta = 0;

function openTeacherChatPanel() {
    if (!canUseTeacherChat()) {
        avisar('El chat está disponible solo para maestros, profesores, acudientes y administradores.');
        return;
    }
    chatPanel.classList.add('active');
    loadChatContacts();
    // La hora de cada conversacion ("Hace 5 min") se refresca mientras el panel esta abierto.
    clearInterval(chatRelojTimer);
    chatRelojTimer = setInterval(() => {
        if (chatPanel.classList.contains('active')) renderChatList();
        else { clearInterval(chatRelojTimer); chatRelojTimer = 0; }
    }, 60000);
}

if (navChatBtn) navChatBtn.onclick = (e) => {
    e.preventDefault();
    openTeacherChatPanel();
};
if (mobileChatBtn) mobileChatBtn.onclick = (e) => {
    e.preventDefault();
    openTeacherChatPanel();
};
if (closeChatBtn) closeChatBtn.onclick = () => {
    chatPanel.classList.remove('active');
    closeActiveChat();
};
if (backToContactsBtn) backToContactsBtn.onclick = () => {
    // En movil la conversacion tapa la lista: al volver, el foco va a su fila.
    const uid = activeChatUid;
    closeActiveChat();
    renderChatList();
    if (uid) chatContactsList.querySelector(`[data-uid="${escapeSelector(uid)}"]`)?.focus();
};

function closeActiveChat() {
    if (activeChatListener) {
        activeChatListener();
        activeChatListener = null;
    }
    activeChatId = null;
    activeChatUid = null;
    lecturaChatPendiente = null;
    conversationMessages.innerHTML = '';
    chatMessageInput.value = '';
    revisarContenido(sendMessageBtn);
    chatConversation.classList.remove('active');
    chatConversation.style.display = 'none';
    chatEmptyState.style.display = 'flex';
    programarListaChat();
}

function loadChatContacts() {
    if (!canUseTeacherChat()) {
        renderInlineStatus(chatContactsList, 'El chat no está disponible para tu rol.');
        return;
    }

    // Ya se escuchan los contactos: basta con reintentar los chats que no se
    // pudieron leer (con las reglas anteriores, los que aun no existian).
    if (chatContactsListener) {
        resumenesChat.forEach((resumen, uid) => {
            if (resumen.sinAcceso) escucharResumenChat(uid, resumen.chatId);
        });
        renderChatList();
        return;
    }

    chatContactsList.innerHTML = '<div class="loading-spinner small">Cargando contactos...</div>';
    escucharChatsLeidos();
    // Margen para que lleguen los ultimos mensajes de cada chat antes de pintar
    // la lista: asi las filas no saltan de "Contactos" a "Conversaciones".
    chatCargaHasta = Date.now() + 3000;

    chatContactsListener = onValue(ref(db, 'users'), (snapshot) => {
        allContactsCache = [];
        Object.entries(snapshot.val() || {}).forEach(([uid, userData]) => {
            if (uid === currentUser.uid) return;
            if (!userData?.role) return;
            if (!isTeacherChatContactRole(userData.role)) return;
            allContactsCache.push({ uid, ...userData });
        });
        sincronizarResumenesChat();

        if (!allContactsCache.length) {
            renderInlineStatus(chatContactsList, snapshot.exists()
                ? 'No hay maestros, profesores, acudientes o directivos disponibles.'
                : 'No hay usuarios registrados para iniciar un chat.');
            return;
        }
        programarListaChat();
    }, (error) => {
        console.error('No se pudieron cargar los contactos del chat:', error);
        // La escucha se cancelo: se vuelve a intentar al abrir el panel.
        chatContactsListener = null;
        allContactsCache = [];
        sincronizarResumenesChat();
        renderInlineStatus(chatContactsList, 'No se pudieron cargar los contactos. Revisa tu conexión y vuelve a intentarlo.');
    });
}

// Escucha los ultimos mensajes del chat con un contacto. Se vuelve a llamar si
// la escucha anterior fallo o si el chat abierto resulto ser otro (el antiguo "v2_").
function escucharResumenChat(uid, chatId = getChatId(currentUser.uid, uid)) {
    const previo = resumenesChat.get(uid);
    if (previo && previo.chatId === chatId && !previo.sinAcceso) return;
    previo?.off?.();

    const resumen = { chatId, off: null, mensajes: [], cargado: false, sinAcceso: false };
    resumenesChat.set(uid, resumen);
    const ultimos = query(ref(db, `chats/${chatId}/messages`), limitToLast(CHAT_MENSAJES_RESUMEN));
    resumen.off = onValue(ultimos, (snapshot) => {
        resumen.mensajes = Object.values(snapshot.val() || {})
            .filter(msg => msg && typeof msg.text === 'string')
            .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
        resumen.cargado = true;
        resumen.sinAcceso = false;
        programarListaChat();
    }, () => {
        // Con las reglas anteriores, leer un chat que aun no existe se deniega.
        resumen.mensajes = [];
        resumen.cargado = true;
        resumen.sinAcceso = true;
        programarListaChat();
    });
}

function sincronizarResumenesChat() {
    const vigentes = new Set(allContactsCache.map(contacto => contacto.uid));
    resumenesChat.forEach((resumen, uid) => {
        if (vigentes.has(uid)) return;
        resumen.off?.();
        resumenesChat.delete(uid);
    });
    vigentes.forEach(uid => {
        if (!resumenesChat.has(uid)) escucharResumenChat(uid);
    });
}

function detenerResumenesChat() {
    resumenesChat.forEach(resumen => resumen.off?.());
    resumenesChat = new Map();
    if (chatLeidosListener) { chatLeidosListener(); chatLeidosListener = null; }
    chatLeidos = {};
    lecturaChatPendiente = null;
    activeChatUid = null;
    clearTimeout(chatListaTimer);
    clearTimeout(chatEsperaTimer);
    clearInterval(chatRelojTimer);
    chatListaTimer = chatEsperaTimer = chatRelojTimer = 0;
    actualizarContadorChats(0);
}

// Hasta donde se leyo cada chat: chatsLeidos/{uid}/{chatId}, privado de cada persona.
function escucharChatsLeidos() {
    if (chatLeidosListener) return;
    chatLeidosListener = onValue(ref(db, `chatsLeidos/${currentUser.uid}`), (snapshot) => {
        // Se queda la marca mas reciente: la de esta sesion puede ir por delante
        // de la guardada mientras la escritura llega al servidor.
        Object.entries(snapshot.val() || {}).forEach(([chatId, hora]) => {
            if (Number(hora) > (chatLeidos[chatId] || 0)) chatLeidos[chatId] = Number(hora);
        });
        programarListaChat();
    }, (error) => {
        // Sin la rama en las reglas solo cuenta lo leido durante esta sesion.
        console.warn('No se pudieron leer las marcas de lectura del chat:', error);
        chatLeidosListener = null;
    });
}

// Guarda hasta donde se leyo un chat: la hora del ultimo mensaje recibido que se
// ha visto. Con la app en segundo plano espera a que vuelva a verse.
function marcarChatLeido(chatId, mensajes) {
    const hora = mensajes.reduce((max, msg) => (getChatMessageSenderId(msg) === currentUser.uid
        ? max
        : Math.max(max, Number(msg.timestamp) || 0)), 0);
    if (!hora || hora <= (chatLeidos[chatId] || 0)) return;
    if (document.visibilityState !== 'visible') {
        lecturaChatPendiente = { chatId, mensajes };
        return;
    }
    chatLeidos[chatId] = hora;
    programarListaChat();
    set(ref(db, `chatsLeidos/${currentUser.uid}/${chatId}`), hora)
        .catch(error => console.warn('No se pudo guardar la lectura del chat:', error));
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !lecturaChatPendiente) return;
    const { chatId, mensajes } = lecturaChatPendiente;
    lecturaChatPendiente = null;
    if (chatId === activeChatId) marcarChatLeido(chatId, mensajes);
});

// Mensajes sin leer de un chat: los de la otra persona posteriores a la ultima
// lectura y a la ultima respuesta propia. El chat abierto no tiene nada sin leer.
function chatSinLeer(uid, resumen) {
    if (uid === activeChatUid || !resumen) return 0;
    const leido = chatLeidos[resumen.chatId] || 0;
    let sinLeer = 0;
    for (let i = resumen.mensajes.length - 1; i >= 0; i--) {
        const msg = resumen.mensajes[i];
        if (getChatMessageSenderId(msg) === currentUser.uid || (Number(msg.timestamp) || 0) <= leido) break;
        sinLeer++;
    }
    return sinLeer;
}

// Hora del ultimo mensaje: corta en la fila y completa para el lector de pantalla.
function horaRelativaChat(timestamp) {
    const fecha = new Date(timestamp);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(hoy.getDate() - 1);
    const minutos = Math.max(0, Math.floor((hoy - fecha) / 60000));
    if (minutos < 1) return { corta: 'Ahora', larga: 'ahora mismo' };
    if (minutos < 60) return { corta: `Hace ${minutos} min`, larga: `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}` };
    if (fecha.toDateString() === hoy.toDateString()) {
        const horas = Math.floor(minutos / 60);
        return { corta: `Hace ${horas} h`, larga: `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}` };
    }
    if (fecha.toDateString() === ayer.toDateString()) return { corta: 'Ayer', larga: 'ayer' };
    if (minutos < 6 * 1440) {
        const dia = fecha.toLocaleDateString('es-CO', { weekday: 'long' });
        return { corta: dia.charAt(0).toUpperCase() + dia.slice(1), larga: `el ${dia}` };
    }
    const anio = fecha.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {};
    return {
        corta: fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', ...anio }),
        larga: `el ${fecha.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', ...anio })}`,
    };
}

function recortarTexto(texto, max) {
    return texto.length > max ? `${texto.slice(0, max - 1).trimEnd()}…` : texto;
}

function filaConversacionHtml({ contacto, ultimo, sinLeer }) {
    const nombre = sanitizeName(contacto.name || 'Usuario');
    const mio = getChatMessageSenderId(ultimo) === currentUser.uid;
    const texto = String(ultimo.text || '').replace(/\s+/g, ' ').trim();
    const hora = horaRelativaChat(Number(ultimo.timestamp) || Date.now());
    const activa = contacto.uid === activeChatUid;
    const muchos = sinLeer > CHAT_MAX_SIN_LEER;
    // El nombre accesible lo dice todo en una frase; lo visible va dentro como decoracion.
    const etiqueta = [
        `Conversación con ${nombre}`,
        formatRoleLabel(contacto.role),
        sinLeer ? `${muchos ? `más de ${CHAT_MAX_SIN_LEER}` : sinLeer} sin leer` : '',
        `último mensaje${mio ? ' tuyo' : ''}: ${recortarTexto(texto, 100)}`,
        hora.larga,
    ].filter(Boolean).join(', ');
    return `<li><button type="button" class="contact-item chat-fila${sinLeer ? ' chat-fila--sin-leer' : ''}${activa ? ' active' : ''}" data-uid="${escapeAttribute(contacto.uid)}" aria-label="${escapeAttribute(etiqueta)}"${activa ? ' aria-current="true"' : ''}>
        <img src="${escapeAttribute(safeImageSrc(contacto.avatar))}" class="avatar-small" alt="">
        <span class="chat-fila__cuerpo">
            <span class="chat-fila__linea">
                <span class="contact-name">${escapeHTML(nombre)}</span>
                <span class="chat-fila__hora">${escapeHTML(hora.corta)}</span>
            </span>
            <span class="chat-fila__linea">
                <span class="chat-fila__extracto">${mio ? 'Tú: ' : ''}${escapeHTML(recortarTexto(texto, 140))}</span>
                ${sinLeer ? `<b class="chat-fila__contador">${muchos ? `${CHAT_MAX_SIN_LEER}+` : sinLeer}</b>` : ''}
            </span>
        </span>
    </button></li>`;
}

function filaContactoHtml(contacto) {
    const nombre = sanitizeName(contacto.name || 'Usuario');
    const rol = formatRoleLabel(contacto.role);
    const activa = contacto.uid === activeChatUid;
    return `<li><button type="button" class="contact-item chat-fila${activa ? ' active' : ''}" data-uid="${escapeAttribute(contacto.uid)}" aria-label="${escapeAttribute(`Iniciar conversación con ${nombre}, ${rol}`)}"${activa ? ' aria-current="true"' : ''}>
        <img src="${escapeAttribute(safeImageSrc(contacto.avatar))}" class="avatar-small" alt="">
        <span class="chat-fila__cuerpo">
            <span class="chat-fila__linea">
                <span class="contact-name">${escapeHTML(nombre)}</span>
                <span class="badge ${getRoleClass(contacto.role)}">${escapeHTML(rol)}</span>
            </span>
        </span>
    </button></li>`;
}

// Varias escuchas cambian a la vez (al abrir, al llegar un mensaje): se pinta una vez.
function programarListaChat() {
    if (chatListaTimer) return;
    chatListaTimer = setTimeout(() => {
        chatListaTimer = 0;
        renderChatList();
    }, 0);
}

// Conversaciones con mensajes sin leer, en el boton Chats de la barra inferior y del
// menu lateral. navegacion.js suma esta cifra a "Más" si Chats queda dentro de la hoja.
let chatsSinLeerMostrados = -1;
function actualizarContadorChats(n) {
    if (n === chatsSinLeerMostrados) return;
    chatsSinLeerMostrados = n;
    [mobileChatBtn, navChatBtn].forEach(boton => {
        const contador = boton?.querySelector('.nav-count');
        if (!contador) return;
        contador.hidden = n === 0;
        contador.textContent = String(n);
        // Nombre del boton: su texto visible y, si hay, cuantas conversaciones esperan.
        const etiqueta = boton.querySelector('span')?.firstChild?.textContent.trim();
        if (n) boton.setAttribute('aria-label', `${etiqueta}, ${n} ${n === 1 ? 'conversación' : 'conversaciones'} sin leer`);
        else boton.removeAttribute('aria-label');
    });
}

function renderChatList() {
    if (!currentUser || !canUseTeacherChat()) return;

    const conversaciones = [];
    const contactos = [];
    let esperando = 0;
    allContactsCache.forEach(contacto => {
        const resumen = resumenesChat.get(contacto.uid);
        if (!resumen?.cargado) esperando++;
        const ultimo = resumen?.mensajes[resumen.mensajes.length - 1];
        if (ultimo) conversaciones.push({ contacto, ultimo, sinLeer: chatSinLeer(contacto.uid, resumen) });
        else contactos.push(contacto);
    });
    conversaciones.sort((a, b) => (Number(b.ultimo.timestamp) || 0) - (Number(a.ultimo.timestamp) || 0));
    contactos.sort((a, b) => sanitizeName(a.name || '').localeCompare(sanitizeName(b.name || ''), 'es'));
    actualizarContadorChats(conversaciones.filter(c => c.sinLeer).length);
    if (!allContactsCache.length) return;

    clearTimeout(chatEsperaTimer);
    if (esperando && Date.now() < chatCargaHasta) {
        if (!chatContactsList.querySelector('.loading-spinner')) {
            chatContactsList.innerHTML = '<div class="loading-spinner small">Cargando conversaciones...</div>';
        }
        chatEsperaTimer = setTimeout(renderChatList, chatCargaHasta - Date.now());
        return;
    }

    const termino = normalizeModerationText(chatSearchInput?.value || '').trim();
    const coincide = (contacto) => !termino || normalizeModerationText(sanitizeName(contacto.name || '')).includes(termino);
    const filasConversaciones = conversaciones.filter(c => coincide(c.contacto)).map(filaConversacionHtml);
    const filasContactos = contactos.filter(coincide).map(filaContactoHtml);

    const partes = [];
    if (filasConversaciones.length) {
        partes.push(`<h3 class="chat-seccion" id="chat-seccion-conversaciones">Conversaciones</h3>
            <ul class="chat-lista" aria-labelledby="chat-seccion-conversaciones">${filasConversaciones.join('')}</ul>`);
    } else if (!termino) {
        partes.push('<p class="chat-lista-nota">Aún no tienes conversaciones. Elige un contacto para escribirle.</p>');
    }
    if (filasContactos.length) {
        partes.push(`<h3 class="chat-seccion" id="chat-seccion-contactos">${conversaciones.length ? 'Otros contactos' : 'Contactos'}</h3>
            <ul class="chat-lista" aria-labelledby="chat-seccion-contactos">${filasContactos.join('')}</ul>`);
    }
    if (!partes.length) partes.push('<p class="chat-lista-nota">No hay nadie con ese nombre.</p>');

    // Se redibuja sin perder el foco ni la posicion de la lista.
    const enfocado = chatContactsList.contains(document.activeElement) ? document.activeElement.dataset.uid : null;
    const scroll = chatContactsList.scrollTop;
    chatContactsList.innerHTML = partes.join('');
    chatContactsList.scrollTop = scroll;
    if (enfocado) chatContactsList.querySelector(`[data-uid="${escapeSelector(enfocado)}"]`)?.focus();
}

if (chatContactsList) {
    chatContactsList.addEventListener('click', (e) => {
        const item = e.target.closest('.contact-item');
        if (item && item.dataset.uid) openChat(item.dataset.uid);
    });
}

if (chatSearchInput) {
    chatSearchInput.addEventListener('input', () => renderChatList());
}

// Id del chat entre dos personas: sus uid ordenados y unidos por "_". Las reglas
// solo permiten crearlo a esas dos personas (nadie puede colarse ni bloquearlo).
function getChatId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Algunos chats antiguos se crearon con el prefijo "v2_". Se siguen abriendo
// para no perder su historial, pero los nuevos siempre usan el id principal.
function getLegacyChatId(uid1, uid2) {
    return `v2_${getChatId(uid1, uid2)}`;
}

// true si el chat existe y participo en el (las reglas solo dejan leerlo entonces).
async function participoEnChat(chatId) {
    try {
        return (await get(ref(db, `chats/${chatId}/participants/${currentUser.uid}`))).exists();
    } catch (error) {
        return false;
    }
}

// Devuelve el id del chat con esa persona, creandolo si aun no existe, o null.
async function resolverChat(targetUid) {
    const principal = getChatId(currentUser.uid, targetUid);
    if (await participoEnChat(principal)) return principal;
    try {
        await set(ref(db, `chats/${principal}/participants`), { [currentUser.uid]: true, [targetUid]: true });
        return principal;
    } catch (error) {
        console.warn('No se pudo crear el chat principal:', error);
    }
    const antiguo = getLegacyChatId(currentUser.uid, targetUid);
    return (await participoEnChat(antiguo)) ? antiguo : null;
}

async function openChat(targetUid) {
    if (!canUseTeacherChat()) {
        avisar('El chat está disponible solo para maestros, profesores, acudientes y administradores.');
        return;
    }

    const targetUser = allContactsCache.find(u => u.uid === targetUid);
    if (!targetUser || !isTeacherChatContactRole(targetUser.role)) {
        avisar('No se pudo abrir este contacto. Actualiza la lista e inténtalo de nuevo.');
        return;
    }

    activeChatUid = targetUid;
    renderChatList();

    chatEmptyState.style.display = 'none';
    chatConversation.style.display = 'flex';
    chatConversation.classList.add('active');
    conversationMessages.innerHTML = '<div class="loading-spinner small">Cargando mensajes...</div>';

    chatActiveAvatar.src = safeImageSrc(targetUser.avatar);
    chatActiveName.textContent = targetUser.name || 'Docente';
    chatActiveRole.textContent = formatRoleLabel(targetUser.role);
    chatActiveRole.className = `badge ${getRoleClass(targetUser.role)}`;

    if (activeChatListener) { activeChatListener(); activeChatListener = null; }
    activeChatId = await resolverChat(targetUid);
    if (!activeChatId) {
        renderInlineStatus(conversationMessages, 'No se pudo abrir el chat. Inténtalo de nuevo en unos minutos.');
        return;
    }
    // El chat puede acabar de crearse (su escucha en la lista pudo fallar) o ser el antiguo.
    escucharResumenChat(targetUid, activeChatId);

    const chatId = activeChatId;
    const messagesRef = ref(db, `chats/${chatId}/messages`);
    activeChatListener = onValue(messagesRef, (snapshot) => {
        conversationMessages.innerHTML = '';
        if (!snapshot.exists()) {
            renderInlineStatus(conversationMessages, 'Todavía no hay mensajes. Escribe el primero.');
            return;
        }

        const msgs = Object.values(snapshot.val()).sort((a,b) => a.timestamp - b.timestamp);
        const messagesHtml = [];
        let lastDateLabel = '';

        msgs.forEach(msg => {
            const messageSenderId = getChatMessageSenderId(msg);
            const isMine = messageSenderId === auth.currentUser?.uid;
            const msgClass = isMine ? 'sent' : 'received';
            const dateLabel = formatChatDate(msg.timestamp);
            const timeStr = formatChatTime(msg.timestamp);
            const senderName = isMine ? '' : getChatSenderName(msg, targetUser, isMine);
            const senderHtml = isMine ? '' : `<span class="msg-sender">${escapeHTML(senderName)}</span>`;
            const safeText = escapeHTML(msg.text);

            if (dateLabel !== lastDateLabel) {
                messagesHtml.push(`<div class="chat-date-divider"><span>${escapeHTML(dateLabel)}</span></div>`);
                lastDateLabel = dateLabel;
            }

            messagesHtml.push(`
                <div class="chat-msg ${msgClass}">
                    ${senderHtml}
                    <div class="msg-bubble">${safeText}</div>
                    <span class="msg-time">${timeStr}</span>
                </div>
            `);
        });
        conversationMessages.innerHTML = messagesHtml.join('');
        marcarChatLeido(chatId, msgs);

        setTimeout(() => {
            conversationMessages.scrollTop = conversationMessages.scrollHeight;
        }, 100);
    }, (error) => {
        console.error('No se pudieron cargar los mensajes:', error);
        renderInlineStatus(conversationMessages, 'No se pudieron cargar los mensajes. Revisa tu conexión y vuelve a intentarlo.');
    });
}

if (sendMessageBtn) sendMessageBtn.addEventListener('click', sendChatMessage);
if (chatMessageInput) {
    chatMessageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendChatMessage();
        }
    });
}

async function sendChatMessage() {
    const text = chatMessageInput.value.trim().slice(0, LIMITE_TEXTO_CHAT);
    if (!text || !activeChatId || !canUseTeacherChat()) return;
    hapticTap(15);

    chatMessageInput.value = '';
    sendMessageBtn.disabled = true;
    sendMessageBtn.setAttribute('aria-busy', 'true');
    const chatId = activeChatId;
    const messageId = push(ref(db, `chats/${chatId}/messages`)).key;
    // Mensaje y resumen del chat en una sola escritura. La hora la pone el
    // servidor; el nombre se guarda solo como respaldo (se muestra el del perfil).
    const msgData = {
        senderId: currentUser.uid,
        senderName: miNombre().slice(0, 60),
        text,
        timestamp: serverTimestamp()
    };

    try {
        await update(ref(db, `chats/${chatId}`), {
            [`messages/${messageId}`]: msgData,
            lastMessage: text,
            lastTimestamp: serverTimestamp()
        });
        avisarDespachadorDeNotificaciones();
    } catch (error) {
        console.error('No se pudo enviar el mensaje:', error);
        chatMessageInput.value = text;
        avisar('No se pudo enviar el mensaje. Revisa tu conexión.', { accion: sendChatMessage });
    } finally {
        sendMessageBtn.removeAttribute('aria-busy');
        revisarContenido(sendMessageBtn);
        chatMessageInput.focus();
    }
}
exigirContenido(sendMessageBtn, () => Boolean(chatMessageInput.value.trim()), [chatMessageInput]);

// === ADMIN USERS MANAGEMENT ===
// Las escuchas se crean una sola vez por sesion. Antes cada apertura de la
// ventana anadia dos nuevas sin cerrar las anteriores, y la lista se redibujaba
// tantas veces como se hubiera abierto.
let adminRoleRequestsListener = null;
let adminUsersListener = null;

function detenerEscuchasDeAdmin() {
    adminRoleRequestsListener?.();
    adminUsersListener?.();
    adminAprobadosListener?.();
    adminRoleRequestsListener = adminUsersListener = adminAprobadosListener = null;
    aprobadosCache = {};
    allAdminUsersCache = [];
    allRoleRequestsCache = {};
}

// Cuentas que esperan aprobacion: contador para los administradores.
function actualizarCuentasPendientes() {
    const contador = document.getElementById('pending-accounts-count');
    if (!contador) return;
    const n = isAdmin && Object.keys(aprobadosCache).length
        ? [...directorioPorUid.keys()].filter(uid => aprobadosCache[uid] !== true).length
        : 0;
    contador.hidden = n === 0;
    contador.textContent = String(n);
}

function escucharAprobaciones() {
    if (!isAdmin || adminAprobadosListener) return;
    adminAprobadosListener = onValue(ref(db, 'aprobados'), snapshot => {
        aprobadosCache = snapshot.val() || {};
        actualizarCuentasPendientes();
        if (adminUsersModal.classList.contains('active')) renderAdminUsers(adminUserSearchInput ? adminUserSearchInput.value : '');
    }, () => { /* reglas antiguas: aun no hay aprobaciones que mostrar */ });
}

function openAdminUsersModal() {
    if (!isAdmin) return;
    adminUsersModal.classList.add('active');
    loadAllUsersForAdmin();
    renderAdminUsers(adminUserSearchInput ? adminUserSearchInput.value : '');
}

if (navUsersBtn) {
    navUsersBtn.onclick = (e) => {
        e.preventDefault();
        openAdminUsersModal();
    };
}
if (mobileUsersBtn) mobileUsersBtn.onclick = openAdminUsersModal;
if (closeUsersModalBtn) closeUsersModalBtn.onclick = () => adminUsersModal.classList.remove('active');
if (adminUserSearchInput) {
    adminUserSearchInput.addEventListener('input', () => {
        renderAdminUsers(adminUserSearchInput.value);
    });
}

function loadAllUsersForAdmin() {
    if (!isAdmin || adminUsersListener) return;
    adminRoleRequestsListener = onValue(ref(db, 'roleRequests'), (snapshot) => {
        allRoleRequestsCache = snapshot.exists() ? snapshot.val() : {};
        renderAdminUsers(adminUserSearchInput ? adminUserSearchInput.value : '');
    });
    adminUsersListener = onValue(ref(db, 'users'), (snapshot) => {
        if (!snapshot.exists()) {
            allAdminUsersCache = [];
            adminUsersList.innerHTML = '<div class="loading-spinner">No hay usuarios registrados.</div>';
            return;
        }

        allAdminUsersCache = Object.entries(snapshot.val())
            .map(([uid, data]) => ({uid, ...data}))
            .filter(user => user.uid !== currentUser.uid)
            .sort((a,b) => (a.name || '').localeCompare(b.name || ''));

        renderAdminUsers(adminUserSearchInput ? adminUserSearchInput.value : '');
    });
}

// Cambia el rol y, si habia una solicitud, la borra en la misma escritura: ya no
// quedan solicitudes resueltas acumuladas en la base de datos.
async function guardarRol(uid, rol) {
    const cambios = { [`users/${uid}/role`]: rol };
    if (allRoleRequestsCache?.[uid]) cambios[`roleRequests/${uid}`] = null;
    await update(ref(db), cambios);
}

function renderAdminUsers(filter = '') {
    if (!isAdmin) return;
    const term = normalizeRole(filter);
    const users = allAdminUsersCache.filter(user => {
        const searchable = [
            user.name,
            correosPorUid[user.uid],
            user.role,
            formatRoleLabel(user.role)
        ].join(' ').toLowerCase();
        return searchable.includes(term);
    });

    const hayAprobaciones = Object.keys(aprobadosCache).length > 0;
    const sinAcceso = (user) => hayAprobaciones && aprobadosCache[user.uid] !== true;
    users.sort((a, b) => Number(sinAcceso(b)) - Number(sinAcceso(a)));

    adminUsersList.innerHTML = '';

    if (users.length === 0) {
        adminUsersList.innerHTML = '<div class="loading-spinner">No se encontraron usuarios.</div>';
        return;
    }

    users.forEach(user => {
        const role = user.role || 'Sin rol';
        const roleKey = getRoleClass(role);
        const avatar = escapeAttribute(safeImageSrc(user.avatar));
        const name = escapeHTML(user.name || 'Usuario');
        const email = escapeHTML(correosPorUid[user.uid] || 'Sin correo');
        const safeUid = escapeAttribute(user.uid);
        const safeRole = escapeAttribute(role);
        const pendingRequest = allRoleRequestsCache && allRoleRequestsCache[user.uid] && allRoleRequestsCache[user.uid].status === 'pending'
            ? allRoleRequestsCache[user.uid]
            : null;

        const el = document.createElement('div');
        el.className = 'admin-user-item';
        el.innerHTML = `
            <div class="admin-user-info">
                <img src="${avatar}" class="avatar-small" alt="">
                <div>
                    <h4>${name}</h4>
                    <p>${email}</p>
                </div>
            </div>
            <div class="admin-user-role">
                <span class="badge ${roleKey}">${formatRoleLabel(role)}</span>
                ${role === 'maestro' ? '<p class="admin-legacy-hint">Rol antiguo "Maestro": vuelve a asignarlo como Profesor cuando puedas.</p>' : ''}
            </div>
            <div class="admin-user-action">
                <select class="text-input role-select" data-uid="${safeUid}" data-current-role="${safeRole}" aria-label="Rol de ${name}">
                    <option value="estudiante" ${role === 'estudiante' ? 'selected' : ''}>Estudiante</option>
                    <option value="profesor" ${(role === 'profesor' || role === 'maestro') ? 'selected' : ''}>Profesor</option>
                    <option value="padre" ${role === 'padre' ? 'selected' : ''}>Padre de familia</option>
                    <option value="acudiente" ${role === 'acudiente' ? 'selected' : ''}>Acudiente</option>
                    <option value="directivo" ${role === 'directivo' ? 'selected' : ''}>Directivo</option>
                </select>
            </div>
            ${pendingRequest ? `
            <div class="admin-user-request">
                <span class="badge warning">Solicita: ${formatRoleLabel(pendingRequest.requestedRole)}</span>
                ${RESTRICTED_ROLES.includes(pendingRequest.requestedRole) ? `<button class="btn-small btn-approve" data-uid="${safeUid}" data-role="${escapeAttribute(pendingRequest.requestedRole)}">Aprobar</button>` : ''}
                <button class="btn-small btn-reject" data-uid="${safeUid}">Rechazar</button>
            </div>` : ''}
            ${sinAcceso(user) ? `
            <div class="admin-user-request">
                <span class="badge warning">Sin acceso</span>
                <button class="btn-small btn-aprobar-acceso" data-aprobar-acceso="${safeUid}" type="button">Aprobar acceso</button>
            </div>` : (hayAprobaciones ? `
            <div class="admin-user-access"><button class="text-action-btn" data-quitar-acceso="${safeUid}" type="button">Quitar acceso</button></div>` : '')}
        `;
        adminUsersList.appendChild(el);
    });

    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const newRole = e.target.value;
            const uid = e.target.dataset.uid;
            const previousRole = e.target.dataset.currentRole;
            if (!confirm(`¿Cambiar rol a ${formatRoleLabel(newRole)}?`)) {
                e.target.value = previousRole;
                return;
            }
            try {
                await guardarRol(uid, newRole);
            } catch (error) {
                console.error('No se pudo cambiar el rol:', error);
                e.target.value = previousRole;
                avisar('No se pudo cambiar el rol. Inténtalo de nuevo.');
            }
        });
    });

    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            const requestedRole = btn.dataset.role;
            if (!confirm(`¿Aprobar a este usuario como ${formatRoleLabel(requestedRole)}?`)) return;
            btn.disabled = true;
            try {
                await guardarRol(uid, requestedRole);
            } catch (error) {
                console.error('No se pudo aprobar la solicitud:', error);
                btn.disabled = false;
                avisar('No se pudo aprobar la solicitud. Inténtalo de nuevo.');
            }
        });
    });

    adminUsersList.querySelectorAll('[data-aprobar-acceso]').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
                await set(ref(db, `aprobados/${btn.dataset.aprobarAcceso}`), true);
                // La persona recibe al momento la notificacion de cuenta aprobada.
                avisarDespachadorDeNotificaciones();
            } catch (error) {
                console.error('No se pudo aprobar la cuenta:', error);
                btn.disabled = false;
                avisar('No se pudo aprobar la cuenta. Inténtalo de nuevo.');
            }
        });
    });

    adminUsersList.querySelectorAll('[data-quitar-acceso]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!confirm('¿Quitar el acceso a esta cuenta? Dejará de ver RafaApp hasta que la apruebes de nuevo.')) return;
            btn.disabled = true;
            try {
                await remove(ref(db, `aprobados/${btn.dataset.quitarAcceso}`));
            } catch (error) {
                console.error('No se pudo quitar el acceso:', error);
                btn.disabled = false;
                avisar('No se pudo quitar el acceso. Inténtalo de nuevo.');
            }
        });
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            if (!confirm('¿Rechazar esta solicitud? El usuario seguirá como Estudiante.')) return;
            btn.disabled = true;
            try {
                // Rechazar es borrar la solicitud: no queda registro basura.
                await remove(ref(db, `roleRequests/${uid}`));
            } catch (error) {
                console.error('No se pudo rechazar la solicitud:', error);
                btn.disabled = false;
                avisar('No se pudo rechazar la solicitud. Inténtalo de nuevo.');
            }
        });
    });
}

// === EFFECTS & INTERACTIONS ===
document.querySelectorAll('.btn-primary').forEach(btn => {
    btn.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
    });
});

let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (!header) return;

    const currentScrollY = window.scrollY;

    // En Android el encabezado se mantiene siempre anclado bajo la barra de
    // estado. Evita que reaparezca sobre las publicaciones al deslizar hacia arriba.
    if (document.body.classList.contains('is-webview')) {
        header.classList.remove('header-hidden');
        header.classList.toggle('scrolled', currentScrollY > 20);
        lastScrollY = Math.max(currentScrollY, 0);
        return;
    }

    const isScrollingDown = currentScrollY > lastScrollY + 6;
    const isScrollingUp = currentScrollY < lastScrollY - 6;

    header.classList.toggle('scrolled', currentScrollY > 20);

    if (currentScrollY <= 20 || isScrollingUp) {
        header.classList.remove('header-hidden');
    } else if (isScrollingDown && currentScrollY > 80) {
        header.classList.add('header-hidden');
    }

    lastScrollY = Math.max(currentScrollY, 0);
}, { passive: true });
// === INTERCEPTOR DEL BOTÓN ATRÁS DE ANDROID ===
window.onAndroidBack = function() {
    // El tutorial va por encima de todo: Atras vuelve al paso anterior o lo cierra.
    if (window.RafaTutorial?.atras()) return true;

    if (typeof confirmModal !== 'undefined' && confirmModal.classList.contains('active') && pendingConfirmResolver) {
        pendingConfirmResolver();
        return true;
    }

    // La hoja "Más" es un <dialog> modal: siempre queda por encima de todo.
    const masSheet = document.getElementById('mas-sheet');
    if (masSheet?.open) {
        masSheet.close();
        return true;
    }

    // 1. Cerrar popover de perfil si está abierto
    if (typeof profilePopover !== 'undefined' && profilePopover.classList.contains('active')) {
        closeProfilePopover();
        return true;
    }
    
    // 2. Cerrar conversación de chat (la vista hija del panel)
    if (typeof chatConversation !== 'undefined' && chatConversation.classList.contains('active')) {
        closeActiveChat();
        return true;
    }
    
    // 3. Cerrar panel de chat principal
    if (typeof chatPanel !== 'undefined' && chatPanel.classList.contains('active')) {
        chatPanel.classList.remove('active');
        return true;
    }

    // 4. Cerrar el modal abierto que queda encima: el ultimo del documento
    //    ("Nueva tarea" va despues de "Tareas", "Nuevo evento" despues de
    //    "Eventos"). La eleccion de rol es obligatoria y no se cierra.
    const abiertos = document.querySelectorAll('.modal-overlay.active:not(#role-selection-screen)');
    const modal = abiertos[abiertos.length - 1];
    if (modal) {
        if (modal === editProfileModal) cerrarEditorDePerfil();
        else if (modal === supportInboxModal) cerrarBuzonDeSoporte();
        else modal.classList.remove('active');

        // Caso especial: limpiar vista previa si es el modal de posts
        if (modal.id === 'post-modal' && typeof resetImagePreview === 'function') {
            resetImagePreview();
        }
        return true; // Indicamos a Android que nosotros manejamos el "Atrás"
    }
    
    // Si no había ningún menú/modal abierto, retornamos false
    // Esto le avisa al código nativo que debe proceder a salir de la app.
    return false;
};
