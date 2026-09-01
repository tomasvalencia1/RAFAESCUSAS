import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, signInWithCredential, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, remove, get, update } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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
const isAndroidDevice = /Android/i.test(navigator.userAgent);
const isIOSDevice = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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

    const REQUIRED_APK_VERSION = 2;

    if (currentVersion < REQUIRED_APK_VERSION) {
        const updateOverlay = document.createElement('div');
        updateOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(10,8,5,0.98);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;flex-direction:column;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);';
        
        updateOverlay.innerHTML = `
            <div style="background:#241e18;padding:32px;border-radius:24px;border:1px solid rgba(255,250,242,0.1);max-width:400px;width:100%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
                <div style="font-size:64px;margin-bottom:20px;line-height:1;">⚠️</div>
                <h2 style="font-size:22px;font-weight:700;color:#fffaf2;margin-bottom:12px;font-family:'Inter',sans-serif;letter-spacing:-0.5px;">Instale la nueva versión de RafaConecta</h2>
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
let personalTasksCache = [];
let personalTasksListener = null;
let taskCalendarDate = new Date();
let selectedTaskDate = null;
const initialAuthLoadingStartedAt = Date.now();
let hasResolvedInitialAuth = false;
let initialAuthFinishPromise = null;
let isLoginInProgress = false;
let pendingAndroidFcmToken = null;
let androidGoogleSignInTimeout = null;
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

async function signInWithAndroidGoogle(idToken) {
    if (!idToken) {
        setLoginButtonLoading(false);
        alert('No se recibio el token de Google. Intenta iniciar sesion de nuevo.');
        return;
    }

    setLoginButtonLoading(true);
    clearTimeout(androidGoogleSignInTimeout);
    androidGoogleSignInTimeout = setTimeout(() => {
        setLoginButtonLoading(false);
        alert('El inicio de sesion tardo demasiado. Revisa tu conexion e intenta de nuevo.');
    }, 20000);

    try {
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        clearTimeout(androidGoogleSignInTimeout);
    } catch (error) {
        clearTimeout(androidGoogleSignInTimeout);
        console.error('No se pudo iniciar sesion con Google nativo:', error);
        setLoginButtonLoading(false);
        alert('No se pudo iniciar sesion con Google.');
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

function getChatSenderName(message, targetUser, isMe) {
    if (message.senderName) return sanitizeName(message.senderName);
    if (isMe) return sanitizeName(auth.currentUser?.displayName || currentUser?.displayName || 'Usuario');
    const senderId = getChatMessageSenderId(message);
    if (senderId === targetUser?.uid) return sanitizeName(targetUser.name || 'Contacto');
    const cachedUser = allContactsCache.find(user => user.uid === senderId);
    return sanitizeName(cachedUser?.name || 'Contacto');
}

// === THEME LOGIC ===
// Flat, light visual system shared by the website and Capacitor WebView.
document.documentElement.setAttribute('data-theme', 'dark');
localStorage.setItem('theme', 'dark');

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

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && profilePopover.classList.contains('active')) {
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

    document.getElementById('popover-avatar').src = safeImageSrc(currentUser.photoURL);
    document.getElementById('popover-name').textContent = currentUser.displayName;
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

    // La comprobación de sesión sigue ocurriendo de inmediato. Este retardo solo
    // garantiza que la pantalla inicial permanezca visible por cinco segundos.
    const remainingLoadingTime = Math.max(0, 5000 - (Date.now() - initialAuthLoadingStartedAt));
    initialAuthFinishPromise = new Promise((resolve) => {
        setTimeout(() => {
            hasResolvedInitialAuth = true;
            authLoadingScreen.classList.remove('active');
            resolve();
        }, remainingLoadingTime);
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
            alert('Esta version de la app necesita actualizarse para iniciar sesion con Google. Instala la APK nueva o abre RafaExcusas desde un navegador.');
            return;
        }

        // Safari bloquea el almacenamiento de terceros que requiere el flujo
        // con redirección entre Vercel y firebaseapp.com. El popup se abre
        // directamente desde el toque del usuario y conserva la sesión al volver.
        if (isIOSDevice) {
            await signInWithPopup(auth, provider);
        } else {
            const isMobile = /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
            if (isMobile) {
                await signInWithRedirect(auth, provider);
            } else {
                await signInWithPopup(auth, provider);
            }
        }
    }
    catch (error) {
        console.error(error);
        setLoginButtonLoading(false);
        alert("Hubo un error al iniciar sesión.");
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
        logoutBtn.disabled = false;
        logoutBtn.innerHTML = "<i class='bx bx-log-out'></i> Cerrar sesión";
        alert('No se pudo cerrar la sesión. Inténtalo de nuevo.');
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const adminSnap = await get(ref(db, `admins/${user.uid}`));
        isAdmin = adminSnap.exists() && adminSnap.val() === true;
        if (pendingAndroidFcmToken) saveAndroidFcmToken(pendingAndroidFcmToken);

        const userSnap = await get(ref(db, `users/${user.uid}`));
        if (userSnap.exists() && userSnap.val().role) {
            userRole = userSnap.val().role;
            completeLogin();
        } else {
            await finishInitialAuthCheck();
            loginScreen.classList.remove('active');
            roleSelectionScreen.classList.add('active');

            await set(ref(db, `users/${user.uid}`), {
                name: user.displayName,
                email: user.email,
                avatar: user.photoURL || "https://i.pravatar.cc/150?img=68",
                createdAt: Date.now()
            });
        }
    } else {
        currentUser = null; isAdmin = false; userRole = null; allPostsCache = [];
        if (postsListener) { postsListener(); postsListener = null; }
        if (followingListener) { followingListener(); followingListener = null; }
        if (userDirectoryListener) { userDirectoryListener(); userDirectoryListener = null; }
        if (teacherMessagesListener) { teacherMessagesListener(); teacherMessagesListener = null; }
        if (moderationConfigListener) { moderationConfigListener(); moderationConfigListener = null; }
        followingIds = {}; userDirectoryCache = []; followActionIds.clear(); teacherMessagesCache = [];
        [userSearchInput, mobileUserSearchInput].forEach(input => {
            if (input) { input.value = ''; input.setAttribute('aria-expanded', 'false'); }
        });
        [userSearchResults, mobileUserSearchResults].forEach(results => { if (results) results.innerHTML = ''; });
        if (mobileUserSearchStatus) mobileUserSearchStatus.textContent = 'Escribe al menos 2 letras.';
        if (activeChatListener) { activeChatListener(); activeChatListener = null; }
        if (chatContactsListener) { chatContactsListener(); chatContactsListener = null; }
        if (personalTasksListener) { personalTasksListener(); personalTasksListener = null; }
        activeChatId = null;
        allContactsCache = [];
        personalTasksCache = [];
        showLoginScreen();
        roleSelectionScreen.classList.remove('active');
        closeProfilePopover();
    }
});

async function completeLogin() {
    await finishInitialAuthCheck();
    setLoginButtonLoading(false);
    roleSelectionScreen.classList.remove('active');
    loginScreen.classList.remove('active');
    appContainer.style.display = 'block';

    headerAvatar.src = safeImageSrc(currentUser.photoURL);
    headerUsername.textContent = currentUser.displayName;

    const inlineAvatar = document.getElementById('inline-avatar');
    if (inlineAvatar) inlineAvatar.src = safeImageSrc(currentUser.photoURL);

    adminBtns.forEach(btn => btn.style.display = isAdmin ? (btn.id==='add-event-btn'?'inline-flex': (btn.id==='nav-users-btn' ? 'flex' : 'flex')) : 'none');

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
        if (activeChatListener) { activeChatListener(); activeChatListener = null; }
        activeChatId = null;
        allContactsCache = [];
        chatPanel.classList.remove('active');
        chatContactsList.innerHTML = '';
    }

    initializeCommunityFeatures();
    loadNews();
    loadReports();
    loadEvents();
    loadPersonalTasks();

    checkPendingRoleRequest();
}

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
                    name: currentUser.displayName || '',
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
            console.error(error);
            const isPermissionError = (error && (error.code === 'PERMISSION_DENIED' || /permission_denied/i.test(error.message || '')));
            alert(isPermissionError
                ? 'Firebase rechazó el guardado por permisos (PERMISSION_DENIED). Esto pasa si las reglas de Realtime Database en Firebase todavía no incluyen el nodo "roleRequests". Actualiza las reglas en la consola de Firebase y vuelve a intentar.'
                : `No se pudo procesar tu selección de rol: ${error && error.message ? error.message : 'error desconocido'}. Intenta de nuevo.`);
            card.innerHTML = originalHTML;
            card.style.pointerEvents = '';
            card.style.opacity = '';
        }
    });
});

// === MODALS TOGGLE & IMAGE UPLOAD ===
const openModalBtnFeed = document.getElementById('open-modal-btn-feed');
if (openModalBtnFeed) openModalBtnFeed.onclick = () => postModal.classList.add('active');

const openModalBtn = document.getElementById('open-modal-btn');
if (openModalBtn) openModalBtn.onclick = () => postModal.classList.add('active');
if (mobileOpenModalBtn) mobileOpenModalBtn.onclick = () => postModal.classList.add('active');
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
postImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

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

            currentPostImageBase64 = canvas.toDataURL('image/jpeg', 0.7);

            postImagePreview.src = currentPostImageBase64;
            imagePreviewContainer.style.display = 'block';
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
}

// Legacy post renderer retained only as migration reference. The application
// below uses the RTDB-aware social feed with expiry, follows and moderation.
if (false) {
// === POSTS LOGIC ===
document.getElementById('publish-post-btn').addEventListener('click', async (e) => {
    const text = document.getElementById('post-textarea').value.trim();
    if ((!text && !currentPostImageBase64) || !currentUser) return;
    hapticTap([10,30,10]);

    const btn = e.target; btn.textContent = 'Publicando...'; btn.disabled = true;
    try {
        const postData = {
            author: { uid: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL },
            content: text,
            timestamp: Date.now()
        };
        if (currentPostImageBase64) {
            postData.imageBase64 = currentPostImageBase64;
        }

        await set(push(ref(db, 'posts')), postData);
        postModal.classList.remove('active');
        document.getElementById('post-textarea').value = '';
        resetImagePreview();
    } catch (error) { console.error(error); }
    finally { btn.textContent = 'Publicar'; btn.disabled = false; }
});

function loadPosts() {
    onValue(ref(db, 'posts'), (snapshot) => {
        if (!snapshot.exists()) {
            postsContainer.innerHTML = '<div class="glass-card loading-spinner">No hay publicaciones aún.</div>';
            allPostsCache = [];
            return;
        }

        const postsArray = Object.entries(snapshot.val()).map(([id, data]) => ({id, ...data})).sort((a,b) => b.timestamp - a.timestamp);
        allPostsCache = postsArray;

        const newPostIds = new Set(postsArray.map(p => 'post-' + escapeAttribute(p.id)));
        
        // Eliminar posts que ya no existen
        Array.from(postsContainer.children).forEach(child => {
            if (child.id && child.id.startsWith('post-')) {
                if (!newPostIds.has(child.id)) child.remove();
            } else if (child.classList.contains('loading-spinner')) {
                child.remove();
            }
        });

        postsArray.forEach((post, index) => {
            const minutesAgo = Math.floor((Date.now() - post.timestamp) / 60000);
            const timeStr = minutesAgo < 60 ? `Hace ${minutesAgo} min` : (minutesAgo < 1440 ? `Hace ${Math.floor(minutesAgo/60)} horas` : `Hace ${Math.floor(minutesAgo/1440)} días`);

            const likesCount = post.likes ? Object.keys(post.likes).length : 0;
            const myLike = post.likes && post.likes[currentUser.uid] ? true : false;
            const postId = escapeAttribute(post.id);
            const domId = 'post-' + postId;
            const authorName = escapeHTML(post.author?.name || 'Usuario');
            const authorAvatar = escapeAttribute(safeImageSrc(post.author?.avatar));
            const postContent = escapeHTML(post.content);
            const postImageSrc = safeImageSrc(post.imageBase64, '');

            const imageHtml = postImageSrc ? `<img src="${escapeAttribute(postImageSrc)}" alt="Imagen adjunta" class="post-image-full">` : '';

            const commentsHtml = post.comments ? Object.values(post.comments).map(c => {
                const commentId = Object.keys(post.comments).find(key => post.comments[key] === c);
                const safeCommentId = escapeAttribute(commentId);
                const commentAvatar = escapeAttribute(safeImageSrc(c.authorAvatar));
                const commentAuthor = escapeHTML(c.authorName || 'Usuario');
                const commentText = escapeHTML(c.text);
                return `
                <div class="comment">
                    <img src="${commentAvatar}" class="avatar" alt="Avatar">
                    <div class="comment-content">
                        <div class="comment-text-group">
                            <strong>${commentAuthor}</strong>${commentText}
                        </div>
                        ${isAdmin ? `<button class="action-btn delete-comment-btn" data-post-id="${postId}" data-comment-id="${safeCommentId}"><i class='bx bx-x'></i></button>` : ''}
                    </div>
                </div>`;
            }).join('') : '';

            let postEl = document.getElementById(domId);
            
            if (postEl) {
                const likeBtn = postEl.querySelector('.like-btn');
                if (likeBtn) {
                    likeBtn.className = `action-btn like-btn ${myLike?'liked':''}`;
                    likeBtn.innerHTML = `<i class='bx ${myLike?'bxs-heart':'bx-heart'}'></i><span class="likes-count">${likesCount}</span>`;
                }
                
                const commentBtn = postEl.querySelector('.comment-btn');
                if (commentBtn) {
                    commentBtn.innerHTML = `<i class='bx bx-message-rounded'></i>${post.comments ? Object.keys(post.comments).length : 0}`;
                }
                
                const commentsList = postEl.querySelector('.comments-list');
                if (commentsList && commentsList.innerHTML !== commentsHtml) {
                    commentsList.innerHTML = commentsHtml;
                }
                
                const metaSpan = postEl.querySelector('.post-meta');
                if(metaSpan) metaSpan.textContent = timeStr;

            } else {
                postEl = document.createElement('article');
                postEl.className = 'post-card';
                postEl.id = domId;
                postEl.innerHTML = `
                    <div class="post-header">
                        <div class="user-info">
                            <img src="${authorAvatar}" alt="Avatar" class="avatar">
                            <div class="user-details"><span class="username">${authorName}</span><span class="post-meta">${timeStr}</span></div>
                        </div>
                        ${isAdmin ? `<button class="action-btn delete-post-btn" data-id="${postId}"><i class='bx bx-trash'></i></button>` : ''}
                    </div>
                    ${post.content ? `<div class="post-content">${postContent}</div>` : ''}
                    ${imageHtml}
                    <div class="post-actions">
                        <button class="action-btn like-btn ${myLike?'liked':''}" data-id="${postId}"><i class='bx ${myLike?'bxs-heart':'bx-heart'}'></i><span class="likes-count">${likesCount}</span></button>
                        <button class="action-btn comment-btn" data-id="${postId}"><i class='bx bx-message-rounded'></i>${post.comments ? Object.keys(post.comments).length : 0}</button>
                    </div>
                    <div class="comments-section" id="comments-${postId}">
                        <div class="comments-list">${commentsHtml}</div>
                        <div class="comment-input-area">
                            <input type="text" placeholder="Escribe un comentario..." class="new-comment-input" data-id="${postId}">
                            <button class="comment-submit-btn" data-id="${postId}"><i class='bx bxs-send'></i></button>
                        </div>
                    </div>
                `;
            }

            if (postsContainer.children[index] !== postEl) {
                postsContainer.insertBefore(postEl, postsContainer.children[index]);
            }
        });
    });
}

// Interacciones en posts (delegadas)
postsContainer.addEventListener('click', async (e) => {
    if (e.target.closest('.delete-post-btn') && isAdmin) {
        if(confirm("¿Eliminar publicación?")) await remove(ref(db, `posts/${e.target.closest('.delete-post-btn').dataset.id}`));
    }
    const deleteCommentBtn = e.target.closest('.delete-comment-btn');
    if (deleteCommentBtn && isAdmin) {
        if(confirm("¿Eliminar comentario?")) {
            const postId = deleteCommentBtn.dataset.postId;
            const commentId = deleteCommentBtn.dataset.commentId;
            await remove(ref(db, `posts/${postId}/comments/${commentId}`));
        }
    }
    const likeBtn = e.target.closest('.like-btn');
    if (likeBtn) {
        const id = likeBtn.dataset.id;
        const likeRef = ref(db, `posts/${id}/likes/${currentUser.uid}`);
        const snap = await get(likeRef);
        if (snap.exists()) {
            await remove(likeRef);
        } else {
            await set(likeRef, true);
        }
    }
    const commentBtn = e.target.closest('.comment-btn');
    if (commentBtn) document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('visible');

    const submitBtn = e.target.closest('.comment-submit-btn');
    if (submitBtn) await submitComment(submitBtn.dataset.id, document.querySelector(`.new-comment-input[data-id="${escapeSelector(submitBtn.dataset.id)}"]`));
});

postsContainer.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('new-comment-input')) await submitComment(e.target.dataset.id, e.target);
});

async function submitComment(postId, input) {
    if (!input.value.trim()) return;
    const txt = input.value.trim(); input.value = '';
    await set(push(ref(db, `posts/${postId}/comments`)), { authorUid: currentUser.uid, authorName: currentUser.displayName, authorAvatar: currentUser.photoURL, text: txt, timestamp: Date.now() });
    document.getElementById(`comments-${postId}`).classList.add('visible');
}

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

function postExpiryLabel(post) {
    const remaining = Math.max(0, postCreatedAt(post) + STUDENT_POST_TTL_MS - Date.now());
    const hours = Math.ceil(remaining / (60 * 60 * 1000));
    return `Expira en ${hours}h`;
}

function formatPostTime(timestamp) {
    const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
    if (minutes < 60) return `Hace ${minutes} min`;
    if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} horas`;
    return `Hace ${Math.floor(minutes / 1440)} días`;
}

function isPostVisibleInFeed(post) {
    if (!currentUser || isExpiredStudentPost(post)) return false;
    const authorId = post.author?.uid || post.autorId;
    const authorRole = normalizeRole(post.authorRole);
    return authorId === currentUser.uid || authorRole === 'profesor' || authorRole === 'maestro' || Boolean(followingIds[authorId]);
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
        return `<div class="comment">
            <img src="${escapeAttribute(safeImageSrc(comment.autorAvatar || comment.authorAvatar))}" class="avatar" alt="Avatar">
            <div class="comment-content"><div class="comment-text-group"><strong>${escapeHTML(comment.autorNombre || comment.authorName || 'Usuario')}</strong>${escapeHTML(comment.texto || comment.text || '')}</div>
            ${canDelete ? `<button class="action-btn delete-comment-btn" aria-label="Eliminar comentario" data-post-id="${escapeAttribute(postId)}" data-comment-id="${escapeAttribute(commentId)}" data-comment-path="${path}" data-author-id="${escapeAttribute(authorId)}"><i class='bx bx-x'></i></button>` : ''}</div>
        </div>`;
    }).join('');
}

function renderCommunityFeed() {
    if (!postsContainer || !currentUser) return;
    const visiblePosts = allPostsCache.filter(isPostVisibleInFeed);
    if (!visiblePosts.length) {
        postsContainer.innerHTML = '<div class="glass-card loading-spinner">Aún no hay publicaciones de personas que sigues. Sigue a alguien o espera un anuncio del profesorado.</div>';
        renderModerationQueue();
        return;
    }

    postsContainer.innerHTML = visiblePosts.map(post => {
        const postId = escapeAttribute(post.id);
        const authorId = post.author?.uid || post.autorId || '';
        const authorName = escapeHTML(post.author?.name || post.autorNombre || 'Usuario');
        const authorAvatar = escapeAttribute(safeImageSrc(post.author?.avatar || post.autorAvatar));
        const comments = commentsForPost(post);
        const likesCount = Object.keys(post.likes || {}).length;
        const liked = Boolean(post.likes?.[currentUser.uid]);
        const canFollow = authorId && authorId !== currentUser.uid;
        const followsAuthor = Boolean(followingIds[authorId]);
        const imageSrc = safeImageSrc(post.imageBase64, '');
        const expiry = authorId === currentUser.uid && normalizeRole(post.authorRole) === 'estudiante'
            ? `<span class="post-expiry">${postExpiryLabel(post)}</span>` : '';
        const flagged = canManageContent() && post.flagged ? '<span class="post-flag">Pendiente de revisión</span>' : '';
        return `<article class="post-card" id="post-${postId}">
            <div class="post-header"><div class="user-info"><img src="${authorAvatar}" alt="Avatar" class="avatar"><div class="user-details"><span class="username">${authorName}</span><span class="post-meta">${formatPostTime(postCreatedAt(post))}</span>${expiry}</div></div>
                <div class="post-header-actions">${flagged}${canFollow ? `<button class="action-btn follow-btn ${followsAuthor ? 'following' : ''}" data-author-id="${escapeAttribute(authorId)}" data-following="${followsAuthor}" type="button">${followsAuthor ? 'Siguiendo' : 'Seguir'}</button>` : ''}${canManageContent() ? `<button class="action-btn delete-post-btn" aria-label="Eliminar publicación" data-id="${postId}" type="button"><i class='bx bx-trash'></i></button>` : ''}</div>
            </div>
            ${post.content ? `<div class="post-content">${escapeHTML(post.content)}</div>` : ''}
            ${imageSrc ? `<img src="${escapeAttribute(imageSrc)}" alt="Imagen adjunta" class="post-image-full">` : ''}
            <div class="post-actions"><button class="action-btn like-btn ${liked ? 'liked' : ''}" data-id="${postId}" type="button"><i class='bx ${liked ? 'bxs-heart' : 'bx-heart'}'></i><span class="likes-count">${likesCount}</span></button><button class="action-btn comment-btn" data-id="${postId}" type="button"><i class='bx bx-message-rounded'></i><span>${Object.keys(comments).length}</span></button></div>
            <div class="comments-section" id="comments-${postId}"><div class="comments-list">${buildCommentsHtml(post, post.id)}</div><div class="comment-input-area"><input type="text" maxlength="500" placeholder="Escribe un comentario..." class="new-comment-input" data-id="${postId}"><button class="comment-submit-btn" data-id="${postId}" type="button" aria-label="Publicar comentario"><i class='bx bxs-send'></i></button></div></div>
        </article>`;
    }).join('');
    renderModerationQueue();
}

async function cleanupExpiredStudentPosts(posts) {
    // In the client fallback only an administrator can remove records, matching the
    // moderation delete permission. Everyone else still stops seeing them now.
    if (!canManageContent()) return;
    const expired = posts.filter(post => isExpiredStudentPost(post));
    if (!expired.length) return;
    const updates = {};
    expired.forEach(post => { updates[`posts/${post.id}`] = null; });
    try { await update(ref(db), updates); } catch (error) { console.warn('No se pudo limpiar publicaciones vencidas:', error); }
}

function loadPosts() {
    if (postsListener) postsListener();
    postsListener = onValue(ref(db, 'posts'), snapshot => {
        allPostsCache = snapshot.exists()
            ? Object.entries(snapshot.val()).map(([id, data]) => ({ id, ...data })).sort((a, b) => postCreatedAt(b) - postCreatedAt(a))
            : [];
        renderCommunityFeed();
        cleanupExpiredStudentPosts(allPostsCache);
    }, error => {
        console.error('No se pudieron cargar las publicaciones:', error);
        renderInlineStatus(postsContainer, 'No se pudieron cargar las publicaciones. Revisa las reglas de Firebase.');
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

function renderUserDirectoryFor(input, results, status) {
    if (!input || !results) return;
    const term = normalizeUserSearchText(input.value);

    if (term.length < 2) {
        results.innerHTML = '';
        input.setAttribute('aria-expanded', 'false');
        if (status) status.textContent = 'Escribe al menos 2 letras.';
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

    results.innerHTML = matches.map(user => {
        const followed = Boolean(followingIds[user.uid]);
        const isUpdating = followActionIds.has(user.uid);
        return `<article class="user-search-result" role="listitem">
            <img src="${escapeAttribute(safeImageSrc(user.avatar))}" alt="" class="avatar-small">
            <div class="user-search-person"><strong>${escapeHTML(user.name || 'Usuario')}</strong><span>${escapeHTML(formatRoleLabel(user.role))}</span></div>
            <button class="action-btn user-search-follow-btn ${followed ? 'following' : ''}" data-user-id="${escapeAttribute(user.uid)}" type="button" ${isUpdating ? 'disabled' : ''}>${isUpdating ? 'Guardando...' : (followed ? 'Siguiendo' : 'Seguir')}</button>
        </article>`;
    }).join('');
}

function renderUserDirectoryResults() {
    renderUserDirectoryFor(userSearchInput, userSearchResults);
    renderUserDirectoryFor(mobileUserSearchInput, mobileUserSearchResults, mobileUserSearchStatus);
}

function loadUserDirectory() {
    if (!currentUser) return;
    if (userDirectoryListener) userDirectoryListener();
    userDirectoryListener = onValue(ref(db, 'users'), snapshot => {
        userDirectoryCache = snapshot.exists()
            ? Object.entries(snapshot.val())
                .map(([uid, data]) => ({ uid, ...(data || {}) }))
                .filter(user => user.uid !== currentUser.uid && Boolean(user.name))
                .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es-CO', { sensitivity: 'base' }))
            : [];
        renderUserDirectoryResults();
    }, error => {
        console.error('No se pudo cargar el directorio de usuarios:', error);
        userDirectoryCache = [];
        if (mobileUserSearchStatus) mobileUserSearchStatus.textContent = 'No se pudo cargar la lista de personas.';
    });
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
        alert('No se pudo actualizar el seguimiento. Inténtalo de nuevo.');
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
        await set(push(ref(db, `posts/${postId}/comentarios`)), {
            autorId: currentUser.uid,
            autorNombre: currentUser.displayName || 'Usuario',
            autorAvatar: currentUser.photoURL || '',
            texto: text,
            timestamp: Date.now()
        });
        document.getElementById(`comments-${escapeSelector(postId)}`)?.classList.add('visible');
    } catch (error) {
        console.error('No se pudo publicar el comentario:', error);
        alert('No se pudo publicar el comentario. Inténtalo de nuevo.');
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
    if (!canManageContent() || !currentUser) return;
    const shouldDelete = await openConfirmModal({ title: 'Eliminar publicación', message: 'Esta acción eliminará también sus comentarios y no se puede deshacer.', confirmLabel: 'Eliminar', destructive: true });
    if (!shouldDelete) return;
    const post = allPostsCache.find(item => item.id === postId);
    const logId = push(ref(db, 'logs_moderacion')).key;
    try {
        await update(ref(db), {
            [`posts/${postId}`]: null,
            [`logs_moderacion/${logId}`]: {
                moderadorId: currentUser.uid,
                moderadorNombre: currentUser.displayName || 'Administrador',
                postId,
                autorPostId: post?.author?.uid || '',
                accion: 'eliminar_publicacion',
                timestamp: Date.now()
            }
        });
    } catch (error) {
        console.error('No se pudo eliminar la publicación:', error);
        alert('No se pudo eliminar la publicación. Revisa las reglas de Firebase.');
    }
}

async function deleteComment(postId, commentId, authorId, commentPath = 'comentarios') {
    if (!currentUser || !canManageContent()) return;
    const confirmed = await openConfirmModal({ title: 'Eliminar comentario', message: '¿Quieres eliminar este comentario?', confirmLabel: 'Eliminar', destructive: true });
    if (!confirmed) return;
    await remove(ref(db, `posts/${postId}/${commentPath}/${commentId}`));
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
    sendTeacherMessageBtn.disabled = !isProfessor() || !teacherMessageInput.value.trim() || exceedsWords || sentToday >= 3;
    if (teacherMessageLimit) teacherMessageLimit.textContent = sentToday >= 3 ? 'Ya usaste tus 3 mensajes de hoy.' : `${3 - sentToday} mensaje${3 - sentToday === 1 ? '' : 's'} disponible${3 - sentToday === 1 ? '' : 's'} hoy.`;
}

function renderTeacherMessages() {
    if (!teacherMessagesList) return;
    const latest = teacherMessagesCache.slice(0, 20);
    teacherMessagesList.innerHTML = latest.length ? latest.map(message => `<article class="teacher-message"><strong>${escapeHTML(message.autorNombre || 'Profesor')}</strong><p>${escapeHTML(message.texto || '')}</p><time>${new Date(message.timestamp || Date.now()).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</time></article>`).join('') : '<p class="empty-state">Aún no hay anuncios del profesorado.</p>';
    updateTeacherComposer();
}

function loadTeacherMessages() {
    if (teacherMessagesListener) teacherMessagesListener();
    teacherMessagesListener = onValue(ref(db, 'mensajes_profesor'), snapshot => {
        const root = snapshot.val() || {};
        teacherMessagesCache = Object.entries(root).flatMap(([dia, byTeacher]) => Object.values(byTeacher || {}).flatMap(slots => Object.entries(slots || {}).map(([slot, message]) => ({ ...message, dia: message.dia || dia, _slot: slot })))).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderTeacherMessages();
    }, () => renderInlineStatus(teacherMessagesList, 'No se pudieron cargar los anuncios.'));
}

async function sendTeacherMessage() {
    if (!isProfessor() || !currentUser || !teacherMessageInput) return;
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
            autorNombre: currentUser.displayName || 'Profesor',
            texto,
            timestamp: Date.now(),
            dia
        });
        teacherMessageInput.value = '';
        updateTeacherComposer();
    } catch (error) {
        console.error('No se pudo enviar el anuncio:', error);
        alert('No se pudo enviar el anuncio. Revisa las reglas de Firebase.');
    }
}

function configureCommunityVisibility() {
    const contentManager = canManageContent();
    document.querySelectorAll('.moderation-only').forEach(element => { element.style.display = contentManager ? 'flex' : 'none'; });
    if (teacherMessageComposer) teacherMessageComposer.style.display = isProfessor() ? 'block' : 'none';
    updateTeacherComposer();
}

function initializeCommunityFeatures() {
    configureCommunityVisibility();
    loadModerationConfig();
    loadFollowing();
    loadUserDirectory();
    loadPosts();
    loadTeacherMessages();
}

document.getElementById('publish-post-btn').addEventListener('click', async event => {
    const text = document.getElementById('post-textarea').value.trim();
    if ((!text && !currentPostImageBase64) || !currentUser) return;
    const button = event.currentTarget;
    button.textContent = 'Publicando...'; button.disabled = true;
    try {
        const flagged = containsProhibitedWord(text);
        const postData = {
            author: { uid: currentUser.uid, name: currentUser.displayName || 'Usuario', avatar: currentUser.photoURL || '' },
            authorRole: normalizeRole(userRole),
            content: text,
            timestamp: Date.now(),
            createdAt: Date.now(),
            flagged,
            reason: flagged ? 'lenguaje inapropiado' : null
        };
        if (currentPostImageBase64) postData.imageBase64 = currentPostImageBase64;
        await set(push(ref(db, 'posts')), postData);
        postModal.classList.remove('active');
        document.getElementById('post-textarea').value = '';
        resetImagePreview();
    } catch (error) {
        console.error('No se pudo publicar:', error);
        alert('No se pudo publicar. Revisa tu conexión e inténtalo de nuevo.');
    } finally { button.textContent = 'Publicar'; button.disabled = false; }
});

postsContainer.addEventListener('click', async event => {
    const deleteButton = event.target.closest('.delete-post-btn');
    if (deleteButton) return deletePostWithLog(deleteButton.dataset.id);
    const followButton = event.target.closest('.follow-btn');
    if (followButton) return toggleFollow(followButton.dataset.authorId);
    const likeButton = event.target.closest('.like-btn');
    if (likeButton && currentUser) {
        const likeRef = ref(db, `posts/${likeButton.dataset.id}/likes/${currentUser.uid}`);
        const snapshot = await get(likeRef);
        return snapshot.exists() ? remove(likeRef) : set(likeRef, true);
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
    if (dismissButton && canManageContent()) await update(ref(db, `posts/${dismissButton.dataset.id}`), { flagged: false, reason: null });
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
    try {
        await set(push(ref(db, 'soporte')), { userId: currentUser.uid, texto: text, timestamp: Date.now(), estado: 'pendiente' });
        supportText.value = '';
        button.textContent = '¡Solicitud enviada!';
        setTimeout(() => { supportModal?.classList.remove('active'); button.textContent = 'Enviar solicitud'; button.disabled = false; }, 1200);
    } catch (error) {
        console.error('No se pudo enviar soporte:', error);
        button.textContent = 'Reintentar'; button.disabled = false;
    }
});

// === ADMIN WIDGETS LOGIC (News, Reports, Events) ===

// News
document.getElementById('publish-news-btn').onclick = async (e) => {
    const t = document.getElementById('news-title-input').value.trim();
    const d = document.getElementById('news-desc-input').value.trim();
    if(!t || !d || !isAdmin) return;
    hapticTap([10,30,10]);
    await set(push(ref(db, 'news')), { title: t, desc: d, timestamp: Date.now() });
    newsModal.classList.remove('active'); document.getElementById('news-title-input').value=''; document.getElementById('news-desc-input').value='';
};

function loadNews() {
    onValue(ref(db, 'news'), (snapshot) => {
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
        if(isAdmin) document.querySelectorAll('.delete-news-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar noticia?")) { hapticTap(40); await remove(ref(db, `news/${e.currentTarget.dataset.id}`)); } });
    });
}

// Reports
document.getElementById('publish-report-btn').onclick = async () => {
    const title = document.getElementById('report-title-input').value.trim();
    const status = document.getElementById('report-status-input').value;
    if(!title || !isAdmin) return;
    hapticTap([10,30,10]);
    await set(push(ref(db, 'reports')), { title, status, timestamp: Date.now() });
    reportModal.classList.remove('active'); document.getElementById('report-title-input').value='';
};

function loadReports() {
    onValue(ref(db, 'reports'), (snapshot) => {
        reportsContainer.innerHTML = '';
        if (!snapshot.exists()) { reportsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Sin reportes.</p>'; return; }
        const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=>b.timestamp-a.timestamp);
        arr.forEach(item => {
            const statusClass = item.status === 'Disponible' ? 'success' : 'warning';
            const el = document.createElement('div'); el.className = 'report-item';
            const itemId = escapeAttribute(item.id);
            const title = escapeHTML(item.title);
            const status = escapeHTML(item.status);
            el.innerHTML = `<div class="report-info"><i class='bx bx-check-square'></i><span>${title}</span></div>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span class="badge ${statusClass}">${status}</span>
                                ${isAdmin ? `<i class='bx bx-trash delete-report-btn' data-id="${itemId}" style="color:red;cursor:pointer;font-size:18px;"></i>` : ''}
                            </div>`;
            reportsContainer.appendChild(el);
        });
        if(isAdmin) document.querySelectorAll('.delete-report-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar reporte?")) { hapticTap(40); await remove(ref(db, `reports/${e.target.dataset.id}`)); } });
    });
}

// Events
document.getElementById('publish-event-btn').onclick = async () => {
    const title = document.getElementById('event-title-input').value.trim();
    const date = document.getElementById('event-date-input').value;
    if(!title || !date || !isAdmin) return;
    hapticTap([10,30,10]);
    await set(push(ref(db, 'events')), { title, date, timestamp: Date.now() });
    eventCreateModal.classList.remove('active'); document.getElementById('event-title-input').value=''; document.getElementById('event-date-input').value='';
};

function loadEvents() {
    onValue(ref(db, 'events'), (snapshot) => {
        eventsListContainer.innerHTML = '';
        if (!snapshot.exists()) { eventsListContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No hay próximos eventos programados.</p>'; return; }
        const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=> new Date(a.date) - new Date(b.date));
        arr.forEach(item => {
            const el = document.createElement('div'); el.className = 'event-item';
            const formattedDate = new Date(item.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' });
            const itemId = escapeAttribute(item.id);
            const title = escapeHTML(item.title);
            const dateText = escapeHTML(formattedDate);
            el.innerHTML = `
                <div class="event-info"><h3>${title}</h3><span class="event-date"><i class='bx bx-calendar'></i> ${dateText}</span></div>
                ${isAdmin ? `<button class="action-btn delete-event-btn" data-id="${itemId}" style="color:red;"><i class='bx bx-trash'></i></button>` : ''}
            `;
            eventsListContainer.appendChild(el);
        });
        if(isAdmin) document.querySelectorAll('.delete-event-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar evento?")) { hapticTap(40); await remove(ref(db, `events/${e.target.closest('.delete-event-btn').dataset.id}`)); } });
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
        calendarDay.setAttribute('aria-label', `${day} de ${taskCalendarMonthLabel.textContent}`);

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
        alert('No se pudo actualizar la tarea. Intenta de nuevo.');
    }
}

async function deletePersonalTask(taskId) {
    if (!currentUser || !taskId || !confirm('¿Eliminar esta tarea?')) return;
    hapticTap(40);

    try {
        await remove(ref(db, `personalTasks/${currentUser.uid}/${taskId}`));
    } catch (error) {
        console.error('No se pudo eliminar la tarea:', error);
        alert('No se pudo eliminar la tarea. Intenta de nuevo.');
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
    if (!title || !dueDate || !currentUser) {
        alert('Escribe el nombre y la fecha de entrega de la tarea.');
        return;
    }
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
        alert('No se pudo guardar la tarea. Revisa tu conexion e intenta de nuevo.');
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
function openTeacherChatPanel() {
    if (!canUseTeacherChat()) {
        alert('El chat está disponible solo para maestros, profesores, acudientes y administradores.');
        return;
    }
    chatPanel.classList.add('active');
    loadChatContacts();
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
if (backToContactsBtn) backToContactsBtn.onclick = () => closeActiveChat();

function closeActiveChat() {
    if (activeChatListener) {
        activeChatListener();
        activeChatListener = null;
    }
    activeChatId = null;
    conversationMessages.innerHTML = '';
    chatMessageInput.value = '';
    chatConversation.classList.remove('active');
    chatConversation.style.display = 'none';
    chatEmptyState.style.display = 'flex';
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
}

function loadChatContacts() {
    if (!canUseTeacherChat()) {
        renderInlineStatus(chatContactsList, 'El chat no estÃ¡ disponible para tu rol.');
        return;
    }

    if (chatContactsListener) {
        chatContactsListener();
        chatContactsListener = null;
    }

    chatContactsList.innerHTML = '<div class="loading-spinner small">Cargando contactos...</div>';

    chatContactsListener = onValue(ref(db, 'users'), (snapshot) => {
        chatContactsList.innerHTML = '';
        if (!snapshot.exists()) {
            allContactsCache = [];
            renderInlineStatus(chatContactsList, 'No hay usuarios registrados para iniciar un chat.');
            return;
        }

        const users = snapshot.val();
        let contactsHtml = '';
        allContactsCache = [];

        Object.entries(users).forEach(([uid, userData]) => {
            if (uid === currentUser.uid) return;
            if (!userData.role) return;
            if (!isTeacherChatContactRole(userData.role)) return;

            allContactsCache.push({ uid, ...userData });
            const role = getRoleClass(userData.role);
            const roleLabel = formatRoleLabel(userData.role);
            const avatar = escapeAttribute(safeImageSrc(userData.avatar));
            const safeUid = escapeAttribute(uid);
            const safeName = escapeHTML(userData.name || 'Usuario');

            contactsHtml += `
                <div class="contact-item" data-uid="${safeUid}">
                    <img src="${avatar}" class="avatar-small" alt="Avatar">
                    <div class="contact-info">
                        <div class="contact-name">${safeName} <span class="badge ${role}">${roleLabel}</span></div>
                    </div>
                </div>
            `;
        });

        if (contactsHtml === '') {
            renderInlineStatus(chatContactsList, 'No hay maestros, profesores, acudientes o directivos disponibles.');
        } else {
            chatContactsList.innerHTML = contactsHtml;
        }
    }, (error) => {
        console.error('No se pudieron cargar los contactos del chat:', error);
        allContactsCache = [];
        renderInlineStatus(chatContactsList, 'No se pudieron cargar los contactos. Revisa las reglas de Firebase para permitir leer users.');
    });
}

if (chatContactsList) {
    chatContactsList.addEventListener('click', (e) => {
        const item = e.target.closest('.contact-item');
        if (item && item.dataset.uid) openChat(item.dataset.uid);
    });
}

if (chatSearchInput) {
    chatSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.contact-item').forEach(item => {
            const name = item.querySelector('.contact-name').textContent.toLowerCase();
            item.style.display = name.includes(term) ? 'flex' : 'none';
        });
    });
}

function getChatId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function getFallbackChatId(uid1, uid2) {
    return `v2_${getChatId(uid1, uid2)}`;
}

async function prepareChatParticipants(chatId, targetUid) {
    await update(ref(db, `chats/${chatId}/participants`), {
        [currentUser.uid]: true,
        [targetUid]: true
    });
}

async function openChat(targetUid) {
    if (!canUseTeacherChat()) {
        alert('El chat está disponible solo para maestros, profesores, acudientes y administradores.');
        return;
    }

    const targetUser = allContactsCache.find(u => u.uid === targetUid);
    if (!targetUser || !isTeacherChatContactRole(targetUser.role)) {
        alert('No se pudo abrir este contacto. Actualiza la lista e intÃ©ntalo de nuevo.');
        return;
    }

    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    const contactItem = document.querySelector(`.contact-item[data-uid="${escapeSelector(targetUid)}"]`);
    if(contactItem) contactItem.classList.add('active');

    chatEmptyState.style.display = 'none';
    chatConversation.style.display = 'flex';
    chatConversation.classList.add('active');
    conversationMessages.innerHTML = '<div class="loading-spinner small">Cargando mensajes...</div>';

    chatActiveAvatar.src = safeImageSrc(targetUser.avatar);
    chatActiveName.textContent = targetUser.name || 'Docente';
    chatActiveRole.textContent = formatRoleLabel(targetUser.role);
    chatActiveRole.className = `badge ${getRoleClass(targetUser.role)}`;

    activeChatId = getChatId(currentUser.uid, targetUid);

    if (activeChatListener) activeChatListener();

    try {
        await prepareChatParticipants(activeChatId, targetUid);
    } catch (error) {
        console.warn('No se pudo preparar el chat principal, intentando chat alterno:', error);
        activeChatId = getFallbackChatId(currentUser.uid, targetUid);
        try {
            await prepareChatParticipants(activeChatId, targetUid);
        } catch (fallbackError) {
            console.error('No se pudo preparar el chat:', fallbackError);
            renderInlineStatus(conversationMessages, 'No se pudo abrir el chat. Revisa las reglas de Firebase para permitir leer y escribir chats.');
            return;
        }
    }

    const messagesRef = ref(db, `chats/${activeChatId}/messages`);
    activeChatListener = onValue(messagesRef, (snapshot) => {
        conversationMessages.innerHTML = '';
        if (!snapshot.exists()) {
            renderInlineStatus(conversationMessages, 'TodavÃ­a no hay mensajes. Escribe el primero.');
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

        setTimeout(() => {
            conversationMessages.scrollTop = conversationMessages.scrollHeight;
        }, 100);
    }, (error) => {
        console.error('No se pudieron cargar los mensajes:', error);
        renderInlineStatus(conversationMessages, 'No se pudieron cargar los mensajes. Revisa las reglas de Firebase para chats.');
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
    const text = chatMessageInput.value.trim();
    if (!text || !activeChatId || !canUseTeacherChat()) return;
    hapticTap(15);

    chatMessageInput.value = '';
    sendMessageBtn.disabled = true;
    const timestamp = Date.now();
    const messageRef = push(ref(db, `chats/${activeChatId}/messages`));
    const msgData = {
        senderId: currentUser.uid,
        sender: currentUser.uid,
        senderName: currentUser.displayName || 'Usuario',
        senderRole: userRole || (isAdmin ? 'admin' : ''),
        text: text,
        timestamp
    };

    try {
        await update(ref(db), {
            [`chats/${activeChatId}/messages/${messageRef.key}`]: msgData,
            [`chats/${activeChatId}/lastMessage`]: text,
            [`chats/${activeChatId}/lastTimestamp`]: timestamp
        });
    } catch (error) {
        console.error('No se pudo enviar el mensaje:', error);
        chatMessageInput.value = text;
        alert('No se pudo enviar el mensaje. Revisa la conexiÃ³n o las reglas de Firebase para chats.');
    } finally {
        sendMessageBtn.disabled = false;
        chatMessageInput.focus();
    }
}

// === ADMIN USERS MANAGEMENT ===
function openAdminUsersModal() {
    if (!isAdmin) return;
    adminUsersModal.classList.add('active');
    loadAllUsersForAdmin();
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
    if (!isAdmin) return;
    onValue(ref(db, 'roleRequests'), (snapshot) => {
        allRoleRequestsCache = snapshot.exists() ? snapshot.val() : {};
        renderAdminUsers(adminUserSearchInput ? adminUserSearchInput.value : '');
    });
    onValue(ref(db, 'users'), (snapshot) => {
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

function renderAdminUsers(filter = '') {
    if (!isAdmin) return;
    const term = normalizeRole(filter);
    const users = allAdminUsersCache.filter(user => {
        const searchable = [
            user.name,
            user.email,
            user.role,
            formatRoleLabel(user.role)
        ].join(' ').toLowerCase();
        return searchable.includes(term);
    });

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
        const email = escapeHTML(user.email || 'Sin correo');
        const safeUid = escapeAttribute(user.uid);
        const safeRole = escapeAttribute(role);
        const pendingRequest = allRoleRequestsCache && allRoleRequestsCache[user.uid] && allRoleRequestsCache[user.uid].status === 'pending'
            ? allRoleRequestsCache[user.uid]
            : null;

        const el = document.createElement('div');
        el.className = 'admin-user-item';
        el.innerHTML = `
            <div class="admin-user-info">
                <img src="${avatar}" class="avatar-small">
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
                <select class="text-input role-select" data-uid="${safeUid}" data-current-role="${safeRole}">
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
                <button class="btn-small btn-approve" data-uid="${safeUid}" data-role="${escapeAttribute(pendingRequest.requestedRole)}">Aprobar</button>
                <button class="btn-small btn-reject" data-uid="${safeUid}">Rechazar</button>
            </div>` : ''}
        `;
        adminUsersList.appendChild(el);
    });

    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const newRole = e.target.value;
            const uid = e.target.dataset.uid;
            const previousRole = e.target.dataset.currentRole;
            if(confirm(`¿Cambiar rol a ${formatRoleLabel(newRole)}?`)) {
                await set(ref(db, `users/${uid}/role`), newRole);
                // Si tenía una solicitud pendiente, queda resuelta al cambiar el rol manualmente.
                await set(ref(db, `roleRequests/${uid}/status`), 'approved').catch(() => {});
            } else {
                e.target.value = previousRole;
            }
        });
    });

    document.querySelectorAll('.btn-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            const requestedRole = btn.dataset.role;
            if (!confirm(`¿Aprobar a este usuario como ${formatRoleLabel(requestedRole)}?`)) return;
            await set(ref(db, `users/${uid}/role`), requestedRole);
            await set(ref(db, `roleRequests/${uid}/status`), 'approved');
        });
    });

    document.querySelectorAll('.btn-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
            const uid = btn.dataset.uid;
            if (!confirm('¿Rechazar esta solicitud? El usuario seguirá como Estudiante.')) return;
            await set(ref(db, `roleRequests/${uid}/status`), 'rejected');
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
    if (typeof confirmModal !== 'undefined' && confirmModal.classList.contains('active') && pendingConfirmResolver) {
        pendingConfirmResolver();
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

    // 4. Cerrar cualquier otro modal general abierto
    const activeModals = [
        typeof postModal !== 'undefined' ? postModal : null,
        typeof newsModal !== 'undefined' ? newsModal : null, 
        typeof reportModal !== 'undefined' ? reportModal : null, 
        typeof eventsViewModal !== 'undefined' ? eventsViewModal : null, 
        typeof eventCreateModal !== 'undefined' ? eventCreateModal : null, 
        typeof tasksModal !== 'undefined' ? tasksModal : null, 
        typeof taskCreateModal !== 'undefined' ? taskCreateModal : null, 
        typeof roleRequestModal !== 'undefined' ? roleRequestModal : null,
        typeof supportModal !== 'undefined' ? supportModal : null,
        typeof confirmModal !== 'undefined' ? confirmModal : null,
        typeof moderationModal !== 'undefined' ? moderationModal : null,
        typeof gamesModal !== 'undefined' ? gamesModal : null,
        typeof adminUsersModal !== 'undefined' ? adminUsersModal : null
    ];
    
    for (let modal of activeModals) {
        if (modal && modal.classList.contains('active')) {
            modal.classList.remove('active');
            
            // Caso especial: limpiar vista previa si es el modal de posts
            if (modal.id === 'post-modal' && typeof resetImagePreview === 'function') {
                resetImagePreview();
            }
            return true; // Indicamos a Android que nosotros manejamos el "Atrás"
        }
    }
    
    // Si no había ningún menú/modal abierto, retornamos false
    // Esto le avisa al código nativo que debe proceder a salir de la app.
    return false;
};
