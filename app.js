import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
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

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginGoogleBtn = document.getElementById('login-google-btn');
const logoutBtn = document.getElementById('logout-btn');
const headerAvatar = document.getElementById('header-avatar');
const headerUsername = document.getElementById('header-username');

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

// Admin Buttons (Display toggle)
const adminBtns = document.querySelectorAll('.admin-only');
const addNewsBtn = document.getElementById('add-news-btn');
const addReportBtn = document.getElementById('add-report-btn');
const addEventBtn = document.getElementById('add-event-btn');

// Nav & Inputs
const navEventsBtn = document.getElementById('nav-events-btn');

// Globals
let currentUser = null;
let isAdmin = false;

// === AUTHENTICATION ===
loginGoogleBtn.addEventListener('click', async () => {
    try { await signInWithPopup(auth, provider); } 
    catch (error) { alert("Hubo un error al iniciar sesión."); }
});
logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const snapshot = await get(ref(db, `admins/${user.uid}`));
        isAdmin = snapshot.exists() && snapshot.val() === true;

        headerAvatar.src = user.photoURL || "https://i.pravatar.cc/150?img=68";
        headerUsername.textContent = user.displayName;
        loginScreen.classList.remove('active');
        appContainer.style.display = 'block';

        // Toggle admin buttons visibility
        adminBtns.forEach(btn => btn.style.display = isAdmin ? (btn.id==='add-event-btn'?'inline-flex':'flex') : 'none');

        // Load data
        loadPosts(); loadNews(); loadReports(); loadEvents();
    } else {
        currentUser = null; isAdmin = false;
        loginScreen.classList.add('active'); appContainer.style.display = 'none';
    }
});

// === MODALS TOGGLE ===
document.getElementById('open-modal-btn').onclick = () => postModal.classList.add('active');
document.getElementById('close-modal-btn').onclick = () => postModal.classList.remove('active');

addNewsBtn.onclick = () => newsModal.classList.add('active');
document.getElementById('close-news-modal-btn').onclick = () => newsModal.classList.remove('active');

addReportBtn.onclick = () => reportModal.classList.add('active');
document.getElementById('close-report-modal-btn').onclick = () => reportModal.classList.remove('active');

navEventsBtn.onclick = (e) => { e.preventDefault(); eventsViewModal.classList.add('active'); };
document.getElementById('close-events-view-btn').onclick = () => eventsViewModal.classList.remove('active');

addEventBtn.onclick = () => eventCreateModal.classList.add('active');
document.getElementById('close-event-create-btn').onclick = () => eventCreateModal.classList.remove('active');

// === POSTS LOGIC ===
document.getElementById('publish-post-btn').addEventListener('click', async (e) => {
    const text = document.getElementById('post-textarea').value.trim();
    if (!text || !currentUser) return;
    const btn = e.target; btn.textContent = 'Publicando...'; btn.disabled = true;
    try {
        await set(push(ref(db, 'posts')), {
            author: { uid: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL },
            content: text, timestamp: Date.now(), likesCount: 0
        });
        postModal.classList.remove('active'); document.getElementById('post-textarea').value = '';
    } catch (error) { console.error(error); } 
    finally { btn.textContent = 'Publicar'; btn.disabled = false; }
});

function loadPosts() {
    onValue(ref(db, 'posts'), (snapshot) => {
        postsContainer.innerHTML = '';
        if (!snapshot.exists()) { postsContainer.innerHTML = '<div class="glass-card loading-spinner">No hay publicaciones aún.</div>'; return; }
        const postsArray = Object.entries(snapshot.val()).map(([id, data]) => ({id, ...data})).sort((a,b) => b.timestamp - a.timestamp);
        
        postsArray.forEach(post => {
            const minutesAgo = Math.floor((Date.now() - post.timestamp) / 60000);
            const timeStr = minutesAgo < 60 ? `Hace ${minutesAgo} min` : (minutesAgo < 1440 ? `Hace ${Math.floor(minutesAgo/60)} horas` : `Hace ${Math.floor(minutesAgo/1440)} días`);
            const myLike = post.likes && post.likes[currentUser.uid] ? true : false;
            
            const commentsHtml = post.comments ? Object.values(post.comments).map(c => `
                <div class="comment">
                    <img src="${c.authorAvatar}" class="avatar" alt="Avatar">
                    <div class="comment-content"><strong>${c.authorName}</strong>${c.text}</div>
                </div>`).join('') : '';

            const postEl = document.createElement('article');
            postEl.className = 'post-card';
            postEl.innerHTML = `
                <div class="post-header">
                    <div class="user-info">
                        <img src="${post.author.avatar}" alt="Avatar" class="avatar">
                        <div class="user-details"><span class="username">${post.author.name}</span><span class="post-meta">${timeStr}</span></div>
                    </div>
                    ${isAdmin ? `<button class="action-btn delete-post-btn" data-id="${post.id}"><i class='bx bx-trash'></i></button>` : ''}
                </div>
                <div class="post-content">${post.content}</div>
                <div class="post-actions">
                    <button class="action-btn like-btn ${myLike?'liked':''}" data-id="${post.id}"><i class='bx ${myLike?'bxs-like':'bx-like'}'></i><span class="likes-count">${post.likesCount || 0}</span></button>
                    <button class="action-btn comment-btn" data-id="${post.id}"><i class='bx bx-message-rounded'></i>${post.comments ? Object.keys(post.comments).length : 0}</button>
                </div>
                <div class="comments-section" id="comments-${post.id}">
                    <div class="comments-list">${commentsHtml}</div>
                    <div class="comment-input-area">
                        <input type="text" placeholder="Escribe un comentario..." class="new-comment-input" data-id="${post.id}">
                        <button class="comment-submit-btn" data-id="${post.id}"><i class='bx bxs-send'></i></button>
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
    const likeBtn = e.target.closest('.like-btn');
    if (likeBtn) {
        const id = likeBtn.dataset.id;
        const likeRef = ref(db, `posts/${id}/likes/${currentUser.uid}`);
        const snap = await get(likeRef);
        const count = (await get(ref(db, `posts/${id}`))).val().likesCount || 0;
        if (snap.exists()) { await remove(likeRef); await set(ref(db, `posts/${id}/likesCount`), count - 1); }
        else { await set(likeRef, true); await set(ref(db, `posts/${id}/likesCount`), count + 1); }
    }
    const commentBtn = e.target.closest('.comment-btn');
    if (commentBtn) document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('visible');
    const submitBtn = e.target.closest('.comment-submit-btn');
    if (submitBtn) await submitComment(submitBtn.dataset.id, document.querySelector(`.new-comment-input[data-id="${submitBtn.dataset.id}"]`));
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
            el.innerHTML = `${isAdmin ? `<button class="delete-news-btn" data-id="${item.id}"><i class='bx bx-trash'></i></button>` : ''}<h3>${item.title}</h3><p>${item.desc}</p>`;
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
            el.innerHTML = `<div class="report-info"><i class='bx bx-check-square'></i><span>${item.title}</span></div>
                            <div style="display:flex;align-items:center;gap:10px;">
                                <span class="badge ${statusClass}">${item.status}</span>
                                ${isAdmin ? `<i class='bx bx-trash delete-report-btn' data-id="${item.id}" style="color:red;cursor:pointer;font-size:18px;"></i>` : ''}
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
        const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=> new Date(a.date) - new Date(b.date)); // Sort by date ascending
        arr.forEach(item => {
            const el = document.createElement('div'); el.className = 'event-item';
            const formattedDate = new Date(item.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' });
            el.innerHTML = `
                <div class="event-info"><h3>${item.title}</h3><span class="event-date"><i class='bx bx-calendar'></i> ${formattedDate}</span></div>
                ${isAdmin ? `<button class="action-btn delete-event-btn" data-id="${item.id}" style="color:red;"><i class='bx bx-trash'></i></button>` : ''}
            `;
            eventsListContainer.appendChild(el);
        });
        if(isAdmin) document.querySelectorAll('.delete-event-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar evento?")) await remove(ref(db, `events/${e.currentTarget.dataset.id}`)); });
    });
}
