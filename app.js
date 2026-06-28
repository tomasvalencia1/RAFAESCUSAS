import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, remove, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

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

const postsContainer = document.getElementById('posts-container');
const newsContainer = document.getElementById('news-container');
const reportsContainer = document.getElementById('reports-container');
const eventsListContainer = document.getElementById('events-list-container');

// Modals
const postModal = document.getElementById('post-modal');
const newsModal = document.getElementById('news-modal');
const reportModal = document.getElementById('report-modal');
const eventsViewModal = document.getElementById('events-view-modal');
const eventCreateModal = document.getElementById('event-create-modal');
const roleSelectionScreen = document.getElementById('role-selection-screen');
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
const mobileHomeBtn = document.getElementById('mobile-home-btn');
const mobileChatBtn = document.getElementById('mobile-chat-btn');
const mobileOpenModalBtn = document.getElementById('mobile-open-modal-btn');
const mobileEventsBtn = document.getElementById('mobile-events-btn');
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
let hasResolvedInitialAuth = false;
let isLoginInProgress = false;
const TEACHER_CHAT_ROLES = ['maestro', 'profesor', 'padre', 'acudiente', 'directivo'];

function normalizeRole(role) {
    return (role || '').toString().toLowerCase();
}

function getRoleClass(role) {
    return normalizeRole(role).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'sin-rol';
}

function canUseTeacherChat(role = userRole) {
    return isAdmin || TEACHER_CHAT_ROLES.includes(normalizeRole(role));
}

function isTeacherChatContactRole(role) {
    return TEACHER_CHAT_ROLES.includes(normalizeRole(role));
}

function formatRoleLabel(role) {
    const labels = {
        estudiante: 'Estudiante',
        maestro: 'Maestro',
        profesor: 'Profesor',
        padre: 'Padre',
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
// Hardcoded to dark mode per new design aesthetic
document.documentElement.setAttribute('data-theme', 'dark');
localStorage.setItem('theme', 'dark');

// === PROFILE POPOVER LOGIC ===
profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profilePopover.classList.toggle('active');
    updateProfileStats();
});

document.addEventListener('click', (e) => {
    if (!profilePopover.contains(e.target) && !profileBtn.contains(e.target)) {
        profilePopover.classList.remove('active');
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
    if (hasResolvedInitialAuth) return;
    hasResolvedInitialAuth = true;
    authLoadingScreen.classList.remove('active');
}

function showLoginScreen() {
    finishInitialAuthCheck();
    setLoginButtonLoading(false);
    loginScreen.classList.add('active');
    appContainer.style.display = 'none';
}

loginGoogleBtn.addEventListener('click', async () => {
    if (isLoginInProgress || !hasResolvedInitialAuth) return;
    setLoginButtonLoading(true);

    try { 
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            await signInWithRedirect(auth, provider); 
        } else {
            await signInWithPopup(auth, provider);
        }
    } 
    catch (error) { 
        console.error(error);
        setLoginButtonLoading(false);
        alert("Hubo un error al iniciar sesión."); 
    }
});
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const adminSnap = await get(ref(db, `admins/${user.uid}`));
        isAdmin = adminSnap.exists() && adminSnap.val() === true;
        
        const userSnap = await get(ref(db, `users/${user.uid}`));
        if (userSnap.exists() && userSnap.val().role) {
            userRole = userSnap.val().role;
            completeLogin();
        } else {
            finishInitialAuthCheck();
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
        if (activeChatListener) { activeChatListener(); activeChatListener = null; }
        if (chatContactsListener) { chatContactsListener(); chatContactsListener = null; }
        activeChatId = null;
        allContactsCache = [];
        showLoginScreen();
        roleSelectionScreen.classList.remove('active');
        profilePopover.classList.remove('active');
    }
});

async function completeLogin() {
    finishInitialAuthCheck();
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

    loadPosts(); 
    loadNews(); 
    loadReports(); 
    loadEvents();
}

// Role Selection Event Listeners
document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', async () => {
        const selectedRole = card.dataset.role;
        await set(ref(db, `users/${currentUser.uid}/role`), selectedRole);
        userRole = selectedRole;
        completeLogin();
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

// === POSTS LOGIC ===
document.getElementById('publish-post-btn').addEventListener('click', async (e) => {
    const text = document.getElementById('post-textarea').value.trim();
    if ((!text && !currentPostImageBase64) || !currentUser) return;
    
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
        postsContainer.innerHTML = '';
        if (!snapshot.exists()) { 
            postsContainer.innerHTML = '<div class="glass-card loading-spinner">No hay publicaciones aún.</div>'; 
            allPostsCache = [];
            return; 
        }
        
        const postsArray = Object.entries(snapshot.val()).map(([id, data]) => ({id, ...data})).sort((a,b) => b.timestamp - a.timestamp);
        allPostsCache = postsArray;

        postsArray.forEach(post => {
            const minutesAgo = Math.floor((Date.now() - post.timestamp) / 60000);
            const timeStr = minutesAgo < 60 ? `Hace ${minutesAgo} min` : (minutesAgo < 1440 ? `Hace ${Math.floor(minutesAgo/60)} horas` : `Hace ${Math.floor(minutesAgo/1440)} días`);
            
            const likesCount = post.likes ? Object.keys(post.likes).length : 0;
            const myLike = post.likes && post.likes[currentUser.uid] ? true : false;
            const postId = escapeAttribute(post.id);
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

            const postEl = document.createElement('article');
            postEl.className = 'post-card';
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
            postsContainer.appendChild(postEl);
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

// === ADMIN WIDGETS LOGIC (News, Reports, Events) ===

// News
document.getElementById('publish-news-btn').onclick = async (e) => {
    const t = document.getElementById('news-title-input').value.trim();
    const d = document.getElementById('news-desc-input').value.trim();
    if(!t || !d || !isAdmin) return;
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
        if(isAdmin) document.querySelectorAll('.delete-news-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar noticia?")) await remove(ref(db, `news/${e.currentTarget.dataset.id}`)); });
    });
}

// Reports
document.getElementById('publish-report-btn').onclick = async () => {
    const title = document.getElementById('report-title-input').value.trim();
    const status = document.getElementById('report-status-input').value;
    if(!title || !isAdmin) return;
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
        if(isAdmin) document.querySelectorAll('.delete-report-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar reporte?")) await remove(ref(db, `reports/${e.target.dataset.id}`)); });
    });
}

// Events
document.getElementById('publish-event-btn').onclick = async () => {
    const title = document.getElementById('event-title-input').value.trim();
    const date = document.getElementById('event-date-input').value;
    if(!title || !date || !isAdmin) return;
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
        if(isAdmin) document.querySelectorAll('.delete-event-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar evento?")) await remove(ref(db, `events/${e.target.closest('.delete-event-btn').dataset.id}`)); });
    }); 
}

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

if (resetGameBtn) resetGameBtn.onclick = initGame;

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
        const participantsRef = ref(db, `chats/${activeChatId}/participants`);
        const pSnap = await get(participantsRef);
        if (!pSnap.exists()) {
            await set(participantsRef, { [currentUser.uid]: true, [targetUid]: true });
        }
    } catch (error) {
        console.error('No se pudo preparar el chat:', error);
        renderInlineStatus(conversationMessages, 'No se pudo abrir el chat. Revisa las reglas de Firebase para permitir leer y escribir chats.');
        return;
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
    
    chatMessageInput.value = '';
    sendMessageBtn.disabled = true;
    const msgData = {
        sender: currentUser.uid,
        senderName: currentUser.displayName || 'Usuario',
        senderRole: userRole || (isAdmin ? 'admin' : ''),
        text: text,
        timestamp: Date.now()
    };
    
    try {
        await set(push(ref(db, `chats/${activeChatId}/messages`)), msgData);
        await set(ref(db, `chats/${activeChatId}/lastMessage`), text);
        await set(ref(db, `chats/${activeChatId}/lastTimestamp`), Date.now());
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
            </div>
            <div class="admin-user-action">
                <select class="text-input role-select" data-uid="${safeUid}" data-current-role="${safeRole}">
                    <option value="estudiante" ${role === 'estudiante' ? 'selected' : ''}>Estudiante</option>
                    <option value="maestro" ${role === 'maestro' ? 'selected' : ''}>Maestro</option>
                    <option value="profesor" ${role === 'profesor' ? 'selected' : ''}>Profesor</option>
                    <option value="padre" ${role === 'padre' ? 'selected' : ''}>Padre</option>
                    <option value="acudiente" ${role === 'acudiente' ? 'selected' : ''}>Acudiente</option>
                    <option value="directivo" ${role === 'directivo' ? 'selected' : ''}>Directivo</option>
                </select>
            </div>
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
            } else {
                e.target.value = previousRole;
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
