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



// Theme & Profile

const themeToggleBtn = document.getElementById('theme-toggle-btn');

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

const studentHiddenEls = document.querySelectorAll('.student-hidden');

const rightSidebar = document.querySelector('.right-sidebar');



// Globals

let currentUser = null;

let isAdmin = false;

let userRole = null;

let allPostsCache = []; 

let activeChatId = null;

let activeChatListener = null;

let allContactsCache = [];



// === THEME LOGIC ===

function initTheme() {

 const savedTheme = localStorage.getItem('theme');

 if (savedTheme === 'light') {

 document.documentElement.setAttribute('data-theme', 'light');

 themeToggleBtn.innerHTML = "<i class='bx bx-sun'></i>";

 } else {

 document.documentElement.removeAttribute('data-theme');

 themeToggleBtn.innerHTML = "<i class='bx bx-moon'></i>";

 }

}

initTheme();



themeToggleBtn.addEventListener('click', () => {

 const currentTheme = document.documentElement.getAttribute('data-theme');

 if (currentTheme === 'light') {

 document.documentElement.removeAttribute('data-theme');

 localStorage.setItem('theme', 'dark');

 themeToggleBtn.innerHTML = "<i class='bx bx-moon'></i>";

 } else {

 document.documentElement.setAttribute('data-theme', 'light');

 localStorage.setItem('theme', 'light');

 themeToggleBtn.innerHTML = "<i class='bx bx-sun'></i>";

 }

});



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

 if (post.author.uid === currentUser.uid) {

 userPostsCount++;

 userLikesCount += (post.likes ? Object.keys(post.likes).length : 0);

 }

 });



 document.getElementById('popover-avatar').src = currentUser.photoURL || "https://i.pravatar.cc/150?img=68";

 document.getElementById('popover-name').textContent = currentUser.displayName;

 document.getElementById('popover-email').textContent = currentUser.email;

 document.getElementById('popover-posts-count').textContent = userPostsCount;

 document.getElementById('popover-likes-count').textContent = userLikesCount;

 

 const creationTime = new Date(currentUser.metadata.creationTime);

 document.getElementById('popover-date').textContent = creationTime.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

}



// === AUTHENTICATION & STREAK LOGIC ===

loginGoogleBtn.addEventListener('click', async () => {

 try { await signInWithPopup(auth, provider); } 

 catch (error) { 

   console.error("Login Error:", error);

   alert("Hubo un error al iniciar sesión. Revisa la consola."); 

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

 await checkAndUpdateStreak(userSnap.val());

 completeLogin();

 } else {

 loginScreen.classList.remove('active');

 roleSelectionScreen.classList.add('active');

 

 await set(ref(db, `users/${user.uid}`), {

 name: user.displayName,

 email: user.email,

 avatar: user.photoURL || "https://i.pravatar.cc/150?img=68",

 createdAt: Date.now(),

 streakCount: 1,

 lastLoginDate: getTodayDateString(),

 triviaScore: 0

 });

 }

 } else {

 currentUser = null; isAdmin = false; userRole = null; allPostsCache = [];

 loginScreen.classList.add('active'); appContainer.style.display = 'none';

 roleSelectionScreen.classList.remove('active');

 profilePopover.classList.remove('active');

 }

});



// Helpers for dates

function getTodayDateString() {

 const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;

}

function getYesterdayDateString() {

 const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;

}



async function checkAndUpdateStreak(userData) {

 const today = getTodayDateString();

 const yesterday = getYesterdayDateString();

 let streak = userData.streakCount || 0;

 const lastLogin = userData.lastLoginDate;



 if (lastLogin === yesterday) {

 streak += 1;

 await set(ref(db, `users/${currentUser.uid}/streakCount`), streak);

 await set(ref(db, `users/${currentUser.uid}/lastLoginDate`), today);

 } else if (lastLogin !== today) {

 streak = 1; // reset streak

 await set(ref(db, `users/${currentUser.uid}/streakCount`), streak);

 await set(ref(db, `users/${currentUser.uid}/lastLoginDate`), today);

 }

 

 // Update UI for streak

 document.getElementById('streak-count-display').textContent = streak;

}



async function completeLogin() {

 roleSelectionScreen.classList.remove('active');

 loginScreen.classList.remove('active');

 appContainer.style.display = 'block';



 headerAvatar.src = currentUser.photoURL || "https://i.pravatar.cc/150?img=68";

 headerUsername.textContent = currentUser.displayName;



 adminBtns.forEach(btn => btn.style.display = isAdmin ? (btn.id==='add-event-btn'||btn.id==='admin-trivia-btn'?'inline-flex':'flex') : 'none');

 

 if (userRole === 'estudiante') {

 studentHiddenEls.forEach(el => el.style.display = 'none');

 } else {

 studentHiddenEls.forEach(el => el.style.display = 'flex');

 loadChatContacts();

 }



 loadPosts(); loadNews(); loadReports(); loadEvents();

}



// Role Selection

document.querySelectorAll('.role-card').forEach(card => {

 card.addEventListener('click', async () => {

 const selectedRole = card.dataset.role;

 await set(ref(db, `users/${currentUser.uid}/role`), selectedRole);

 userRole = selectedRole;

 completeLogin();

 });

});



// === MODALS TOGGLE ===

document.getElementById('open-modal-btn').onclick = () => postModal.classList.add('active');

document.getElementById('close-modal-btn').onclick = () => { postModal.classList.remove('active'); resetImagePreview(); };

addNewsBtn.onclick = () => newsModal.classList.add('active');

document.getElementById('close-news-modal-btn').onclick = () => newsModal.classList.remove('active');

addReportBtn.onclick = () => reportModal.classList.add('active');

document.getElementById('close-report-modal-btn').onclick = () => reportModal.classList.remove('active');

navEventsBtn.onclick = (e) => { e.preventDefault(); eventsViewModal.classList.add('active'); };

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

 let width = img.width; let height = img.height;

 const MAX_WIDTH = 800; const MAX_HEIGHT = 800;

 if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 

 else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }

 canvas.width = width; canvas.height = height;

 const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);

 currentPostImageBase64 = canvas.toDataURL('image/jpeg', 0.7);

 postImagePreview.src = currentPostImageBase64; imagePreviewContainer.style.display = 'block';

 };

 img.src = event.target.result;

 };

 reader.readAsDataURL(file);

});

removeImageBtn.addEventListener('click', () => resetImagePreview());

function resetImagePreview() { currentPostImageBase64 = null; postImageInput.value = ''; imagePreviewContainer.style.display = 'none'; postImagePreview.src = ''; }



// === POSTS LOGIC ===

document.getElementById('publish-post-btn').addEventListener('click', async (e) => {

 const text = document.getElementById('post-textarea').value.trim();

 if ((!text && !currentPostImageBase64) || !currentUser) return;

 const btn = e.target; btn.textContent = 'Publicando...'; btn.disabled = true;

 try {

 const postData = { author: { uid: currentUser.uid, name: currentUser.displayName, avatar: currentUser.photoURL }, content: text, timestamp: Date.now() };

 if (currentPostImageBase64) postData.imageBase64 = currentPostImageBase64;

 await set(push(ref(db, 'posts')), postData);

 postModal.classList.remove('active'); document.getElementById('post-textarea').value = ''; resetImagePreview();

 } catch (error) { console.error(error); } finally { btn.textContent = 'Publicar'; btn.disabled = false; }

});



function loadPosts() {

 onValue(ref(db, 'posts'), (snapshot) => {

 postsContainer.innerHTML = '';

 if (!snapshot.exists()) { postsContainer.innerHTML = '<div class="glass-card loading-spinner">No hay publicaciones aún.</div>'; allPostsCache = []; return; }

 const postsArray = Object.entries(snapshot.val()).map(([id, data]) => ({id, ...data})).sort((a,b) => b.timestamp - a.timestamp);

 allPostsCache = postsArray;

 postsArray.forEach(post => {

 const minutesAgo = Math.floor((Date.now() - post.timestamp) / 60000);

 const timeStr = minutesAgo < 60 ? `Hace ${minutesAgo} min` : (minutesAgo < 1440 ? `Hace ${Math.floor(minutesAgo/60)} horas` : `Hace ${Math.floor(minutesAgo/1440)} días`);

 const likesCount = post.likes ? Object.keys(post.likes).length : 0;

 const myLike = post.likes && post.likes[currentUser.uid] ? true : false;

 const imageHtml = post.imageBase64 ? `<img src="${post.imageBase64}" alt="Imagen adjunta" style="width: 100%; border-radius: 12px; margin-bottom: 24px; object-fit: contain; max-height: 500px; background: rgba(0,0,0,0.1); border: 1px solid var(--border-color);">` : '';

 const commentsHtml = post.comments ? Object.values(post.comments).map(c => {

 const commentId = Object.keys(post.comments).find(key => post.comments[key] === c);

 return `<div class="comment"><img src="${c.authorAvatar}" class="avatar" alt="Avatar"><div class="comment-content"><div class="comment-text-group"><strong>${c.authorName}</strong>${c.text}</div>${isAdmin ? `<button class="action-btn delete-comment-btn" data-post-id="${post.id}" data-comment-id="${commentId}"><i class='bx bx-x'></i></button>` : ''}</div></div>`;

 }).join('') : '';



 const postEl = document.createElement('article'); postEl.className = 'post-card';

 postEl.innerHTML = `

 <div class="post-header"><div class="user-info"><img src="${post.author.avatar}" alt="Avatar" class="avatar"><div class="user-details"><span class="username">${post.author.name}</span><span class="post-meta">${timeStr}</span></div></div>${isAdmin ? `<button class="action-btn delete-post-btn" data-id="${post.id}"><i class='bx bx-trash'></i></button>` : ''}</div>

 ${post.content ? `<div class="post-content">${post.content}</div>` : ''}${imageHtml}

 <div class="post-actions"><button class="action-btn like-btn ${myLike?'liked':''}" data-id="${post.id}"><i class='bx ${myLike?'bxs-like':'bx-like'}'></i><span class="likes-count">${likesCount}</span></button><button class="action-btn comment-btn" data-id="${post.id}"><i class='bx bx-message-rounded'></i>${post.comments ? Object.keys(post.comments).length : 0}</button></div>

 <div class="comments-section" id="comments-${post.id}"><div class="comments-list">${commentsHtml}</div><div class="comment-input-area"><input type="text" placeholder="Escribe un comentario..." class="new-comment-input" data-id="${post.id}"><button class="comment-submit-btn" data-id="${post.id}"><i class='bx bxs-send'></i></button></div></div>`;

 postsContainer.appendChild(postEl);

 });

 });

}



postsContainer.addEventListener('click', async (e) => {

 if (e.target.closest('.delete-post-btn') && isAdmin) { if(confirm("¿Eliminar publicación?")) await remove(ref(db, `posts/${e.target.closest('.delete-post-btn').dataset.id}`)); }

 const deleteCommentBtn = e.target.closest('.delete-comment-btn');

 if (deleteCommentBtn && isAdmin) { if(confirm("¿Eliminar comentario?")) { const postId = deleteCommentBtn.dataset.postId; const commentId = deleteCommentBtn.dataset.commentId; await remove(ref(db, `posts/${postId}/comments/${commentId}`)); } }

 const likeBtn = e.target.closest('.like-btn');

 if (likeBtn) {

 const id = likeBtn.dataset.id; const likeRef = ref(db, `posts/${id}/likes/${currentUser.uid}`);

 const snap = await get(likeRef);

 if (snap.exists()) { await remove(likeRef); } else { await set(likeRef, true); }

 }

 const commentBtn = e.target.closest('.comment-btn');

 if (commentBtn) document.getElementById(`comments-${commentBtn.dataset.id}`).classList.toggle('visible');

 const submitBtn = e.target.closest('.comment-submit-btn');

 if (submitBtn) await submitComment(submitBtn.dataset.id, document.querySelector(`.new-comment-input[data-id="${submitBtn.dataset.id}"]`));

});

postsContainer.addEventListener('keypress', async (e) => { if (e.key === 'Enter' && e.target.classList.contains('new-comment-input')) await submitComment(e.target.dataset.id, e.target); });

async function submitComment(postId, input) {

 if (!input.value.trim()) return;

 const txt = input.value.trim(); input.value = '';

 await set(push(ref(db, `posts/${postId}/comments`)), { authorUid: currentUser.uid, authorName: currentUser.displayName, authorAvatar: currentUser.photoURL, text: txt, timestamp: Date.now() });

 document.getElementById(`comments-${postId}`).classList.add('visible');

}



// === ADMIN WIDGETS LOGIC ===

document.getElementById('publish-news-btn').onclick = async () => { const t = document.getElementById('news-title-input').value.trim(); const d = document.getElementById('news-desc-input').value.trim(); if(!t || !d || !isAdmin) return; await set(push(ref(db, 'news')), { title: t, desc: d, timestamp: Date.now() }); newsModal.classList.remove('active'); document.getElementById('news-title-input').value=''; document.getElementById('news-desc-input').value=''; };

function loadNews() { onValue(ref(db, 'news'), (snapshot) => { newsContainer.innerHTML = ''; if (!snapshot.exists()) { newsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">No hay noticias.</p>'; return; } const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=>b.timestamp-a.timestamp); arr.forEach(item => { const el = document.createElement('div'); el.className = 'news-item'; el.innerHTML = `${isAdmin ? `<button class="delete-news-btn" data-id="${item.id}"><i class='bx bx-trash'></i></button>` : ''}<h3>${item.title}</h3><p>${item.desc}</p>`; newsContainer.appendChild(el); }); if(isAdmin) document.querySelectorAll('.delete-news-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar noticia?")) await remove(ref(db, `news/${e.currentTarget.dataset.id}`)); }); }); }

document.getElementById('publish-report-btn').onclick = async () => { const title = document.getElementById('report-title-input').value.trim(); const status = document.getElementById('report-status-input').value; if(!title || !isAdmin) return; await set(push(ref(db, 'reports')), { title, status, timestamp: Date.now() }); reportModal.classList.remove('active'); document.getElementById('report-title-input').value=''; };

function loadReports() { onValue(ref(db, 'reports'), (snapshot) => { reportsContainer.innerHTML = ''; if (!snapshot.exists()) { reportsContainer.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Sin reportes.</p>'; return; } const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=>b.timestamp-a.timestamp); arr.forEach(item => { const statusClass = item.status === 'Disponible' ? 'success' : 'warning'; const el = document.createElement('div'); el.className = 'report-item'; el.innerHTML = `<div class="report-info"><i class='bx bx-check-square'></i><span>${item.title}</span></div><div style="display:flex;align-items:center;gap:10px;"><span class="badge ${statusClass}">${item.status}</span>${isAdmin ? `<i class='bx bx-trash delete-report-btn' data-id="${item.id}" style="color:red;cursor:pointer;font-size:18px;"></i>` : ''}</div>`; reportsContainer.appendChild(el); }); if(isAdmin) document.querySelectorAll('.delete-report-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar reporte?")) await remove(ref(db, `reports/${e.target.dataset.id}`)); }); }); }

document.getElementById('publish-event-btn').onclick = async () => { const title = document.getElementById('event-title-input').value.trim(); const date = document.getElementById('event-date-input').value; if(!title || !date || !isAdmin) return; await set(push(ref(db, 'events')), { title, date, timestamp: Date.now() }); eventCreateModal.classList.remove('active'); document.getElementById('event-title-input').value=''; document.getElementById('event-date-input').value=''; };

function loadEvents() { onValue(ref(db, 'events'), (snapshot) => { eventsListContainer.innerHTML = ''; if (!snapshot.exists()) { eventsListContainer.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No hay próximos eventos programados.</p>'; return; } const arr = Object.entries(snapshot.val()).map(([id, d]) => ({id, ...d})).sort((a,b)=> new Date(a.date) - new Date(b.date)); arr.forEach(item => { const el = document.createElement('div'); el.className = 'event-item'; const formattedDate = new Date(item.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' }); el.innerHTML = `<div class="event-info"><h3>${item.title}</h3><span class="event-date"><i class='bx bx-calendar'></i> ${formattedDate}</span></div>${isAdmin ? `<button class="action-btn delete-event-btn" data-id="${item.id}" style="color:red;"><i class='bx bx-trash'></i></button>` : ''}`; eventsListContainer.appendChild(el); }); if(isAdmin) document.querySelectorAll('.delete-event-btn').forEach(b => b.onclick = async (e) => { if(confirm("¿Borrar evento?")) await remove(ref(db, `events/${e.target.closest('.delete-event-btn').dataset.id}`)); }); }); }



// === NEW GAMES LOGIC ===



// 1. STREAK MODAL

document.getElementById('open-streak-btn').onclick = () => {

 document.getElementById('streak-modal').classList.add('active');

};

document.getElementById('close-streak-btn').onclick = () => document.getElementById('streak-modal').classList.remove('active');



// 2. EXCUSES (Juego de Roles)

document.getElementById('open-excuse-btn').onclick = () => {

 document.getElementById('excuse-modal').classList.add('active');

 loadExcuses();

};

document.getElementById('close-excuse-btn').onclick = () => document.getElementById('excuse-modal').classList.remove('active');



document.getElementById('publish-excuse-btn').onclick = async () => {

 const text = document.getElementById('excuse-textarea').value.trim();

 if(!text) return;

 await set(push(ref(db, 'excuses')), {

 authorUid: currentUser.uid, authorName: currentUser.displayName, avatar: currentUser.photoURL,

 text: text, timestamp: Date.now(), votes: 0

 });

 document.getElementById('excuse-textarea').value = '';

};



function loadExcuses() {

 onValue(ref(db, 'excuses'), (snapshot) => {

 const container = document.getElementById('excuses-container');

 container.innerHTML = '';

 if (!snapshot.exists()) { container.innerHTML = '<p style="color:var(--text-muted);">No hay excusas aún. ¡Sé el primero!</p>'; return; }

 

 // Convert to array and sort by votes

 const arr = Object.entries(snapshot.val()).map(([id, d]) => {

 const votesCount = d.voters ? Object.keys(d.voters).length : 0;

 return {id, ...d, votesCount};

 }).sort((a,b)=> b.votesCount - a.votesCount);



 arr.forEach((item, index) => {

 const hasVoted = item.voters && item.voters[currentUser.uid];

 const medalHtml = index === 0 ? '👑 ' : (index === 1 ? '🥈 ' : (index === 2 ? '🥉 ' : ''));

 

 const el = document.createElement('div');

 el.className = 'excuse-item';

 el.innerHTML = `

 <div class="excuse-info" style="display:flex; gap:10px; align-items:center;">

 <img src="${item.avatar}" style="width:30px; height:30px; border-radius:50%;">

 <div style="flex:1;">

 <strong style="font-size:14px;">${medalHtml}${item.authorName}</strong>

 <p style="font-size:14px; margin-top:4px;">"${item.text}"</p>

 </div>

 <button class="action-btn vote-excuse-btn ${hasVoted?'voted':''}" data-id="${item.id}" style="color: ${hasVoted?'var(--primary-blue)':'var(--text-muted)'}; background: ${hasVoted?'var(--hover-bg)':'transparent'}">

 <i class='bx ${hasVoted?'bxs-upvote':'bx-upvote'}'></i> ${item.votesCount}

 </button>

 ${isAdmin ? `<button class="action-btn delete-excuse-btn" data-id="${item.id}"><i class='bx bx-trash'></i></button>`:''}

 </div>

 `;

 container.appendChild(el);

 });



 // Votes delegation

 document.querySelectorAll('.vote-excuse-btn').forEach(b => {

 b.onclick = async (e) => {

 const id = e.currentTarget.dataset.id;

 const voteRef = ref(db, `excuses/${id}/voters/${currentUser.uid}`);

 const snap = await get(voteRef);

 if(snap.exists()){ await remove(voteRef); } else { await set(voteRef, true); }

 };

 });



 if(isAdmin) {

 document.querySelectorAll('.delete-excuse-btn').forEach(b => {

 b.onclick = async (e) => {

 if(confirm('¿Borrar excusa?')) await remove(ref(db, `excuses/${e.currentTarget.dataset.id}`));

 };

 });

 }

 });

}



// 3. TRIVIA

let currentTriviaAnswer = "";

document.getElementById('open-trivia-btn').onclick = () => {

 document.getElementById('trivia-modal').classList.add('active');

 loadTrivia();

 loadTriviaRanking();

};

document.getElementById('close-trivia-btn').onclick = () => {

 document.getElementById('trivia-modal').classList.remove('active');

 document.getElementById('trivia-feedback').textContent = '';

 document.getElementById('trivia-answer-input').value = '';

};



document.getElementById('admin-trivia-btn').onclick = () => document.getElementById('admin-trivia-modal').classList.add('active');

document.getElementById('close-admin-trivia-btn').onclick = () => document.getElementById('admin-trivia-modal').classList.remove('active');



document.getElementById('publish-trivia-btn').onclick = async () => {

 const q = document.getElementById('new-trivia-q-input').value.trim();

 const a = document.getElementById('new-trivia-a-input').value.trim();

 if(!q || !a) return;

 await set(ref(db, 'trivia/current'), { question: q, answer: a.toLowerCase() });

 document.getElementById('admin-trivia-modal').classList.remove('active');

 alert("Pregunta actualizada");

};



function loadTrivia() {

 onValue(ref(db, 'trivia/current'), async (snapshot) => {

 const qBox = document.getElementById('current-trivia-q');

 const inputSection = document.getElementById('trivia-input-section');

 

 if (!snapshot.exists()) {

 qBox.textContent = "No hay pregunta activa hoy. ¡Vuelve pronto!";

 inputSection.style.display = 'none';

 return;

 }

 

 const data = snapshot.val();

 qBox.textContent = data.question;

 currentTriviaAnswer = data.answer;

 

 // Check if user already answered

 const userSnap = await get(ref(db, `users/${currentUser.uid}/triviaAnswered`));

 if (userSnap.exists() && userSnap.val() === data.question) {

 inputSection.style.display = 'none';

 qBox.textContent += " (¡Ya respondiste esta pregunta!)";

 } else {

 inputSection.style.display = 'block';

 }

 });

}



document.getElementById('submit-trivia-btn').onclick = async () => {

 const input = document.getElementById('trivia-answer-input').value.trim().toLowerCase();

 const feedback = document.getElementById('trivia-feedback');

 if(!input) return;

 

 if (input === currentTriviaAnswer) {

 feedback.style.color = 'var(--success-green)';

 feedback.textContent = '¡Correcto! Sumaste 10 puntos.';

 

 // Get current score and add 10

 const scoreSnap = await get(ref(db, `users/${currentUser.uid}/triviaScore`));

 const newScore = (scoreSnap.exists() ? scoreSnap.val() : 0) + 10;

 await set(ref(db, `users/${currentUser.uid}/triviaScore`), newScore);

 

 } else {

 feedback.style.color = 'var(--danger-red)';

 feedback.textContent = 'Incorrecto. ¡Suerte a la próxima!';

 }

 

 // Mark question as answered

 const qSnap = await get(ref(db, 'trivia/current/question'));

 await set(ref(db, `users/${currentUser.uid}/triviaAnswered`), qSnap.val());

 

 document.getElementById('trivia-answer-input').value = '';

 setTimeout(() => { document.getElementById('trivia-input-section').style.display = 'none'; }, 2000);

};



function loadTriviaRanking() {

 onValue(ref(db, 'users'), (snapshot) => {

 const container = document.getElementById('trivia-leaderboard-container');

 container.innerHTML = '';

 if (!snapshot.exists()) return;

 

 const users = Object.values(snapshot.val())

 .filter(u => u.triviaScore && u.triviaScore > 0)

 .sort((a,b) => b.triviaScore - a.triviaScore)

 .slice(0, 5); // Top 5

 

 if(users.length === 0) { container.innerHTML = '<p style="color:var(--text-muted); font-size:14px;">Nadie tiene puntos aún.</p>'; return; }

 

 users.forEach((u, idx) => {

 const pos = idx + 1;

 const medal = pos === 1 ? '🥇' : (pos === 2 ? '🥈' : (pos === 3 ? '🥉' : `${pos}º`));

 container.innerHTML += `

 <div style="display:flex; justify-content:space-between; padding: 10px; background:var(--hover-bg); margin-bottom:5px; border-radius:8px;">

 <span>${medal} ${u.name}</span>

 <strong>${u.triviaScore} pts</strong>

 </div>

 `;

 });

 });

}



// === CHAT SYSTEM ===

if (navChatBtn) navChatBtn.onclick = (e) => { e.preventDefault(); chatPanel.classList.add('active'); };

if (closeChatBtn) closeChatBtn.onclick = () => { chatPanel.classList.remove('active'); };

if (backToContactsBtn) backToContactsBtn.onclick = () => { chatConversation.classList.remove('active'); };



function loadChatContacts() {

 onValue(ref(db, 'users'), (snapshot) => {

 chatContactsList.innerHTML = ''; if (!snapshot.exists()) return;

 const users = snapshot.val(); let contactsHtml = ''; allContactsCache = [];

 Object.entries(users).forEach(([uid, userData]) => {

 if (uid === currentUser.uid) return; if (!userData.role) return; if (userData.role === 'estudiante') return;

 allContactsCache.push({ uid, ...userData });

 contactsHtml += `<div class="contact-item" data-uid="${uid}"><img src="${userData.avatar}" class="avatar-small" alt="Avatar"><div class="contact-info"><div class="contact-name">${userData.name} <span class="badge ${userData.role}">${userData.role}</span></div></div></div>`;

 });

 if (contactsHtml === '') { chatContactsList.innerHTML = '<p style="color:var(--text-muted);text-align:center;margin-top:20px;">No hay contactos.</p>'; } 

 else { chatContactsList.innerHTML = contactsHtml; document.querySelectorAll('.contact-item').forEach(item => { item.addEventListener('click', () => openChat(item.dataset.uid)); }); }

 });

}

chatSearchInput.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.contact-item').forEach(item => { const name = item.querySelector('.contact-name').textContent.toLowerCase(); item.style.display = name.includes(term) ? 'flex' : 'none'; }); });

function getChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }



async function openChat(targetUid) {

 const targetUser = allContactsCache.find(u => u.uid === targetUid); if (!targetUser) return;

 document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));

 const contactItem = document.querySelector(`.contact-item[data-uid="${targetUid}"]`); if(contactItem) contactItem.classList.add('active');

 chatEmptyState.style.display = 'none'; chatConversation.style.display = 'flex'; if(window.innerWidth <= 768) chatConversation.classList.add('active');

 chatActiveAvatar.src = targetUser.avatar; chatActiveName.textContent = targetUser.name; chatActiveRole.textContent = targetUser.role; chatActiveRole.className = `badge ${targetUser.role}`;

 activeChatId = getChatId(currentUser.uid, targetUid);

 if (activeChatListener) activeChatListener();

 const participantsRef = ref(db, `chats/${activeChatId}/participants`); const pSnap = await get(participantsRef);

 if (!pSnap.exists()) { await set(participantsRef, { [currentUser.uid]: true, [targetUid]: true }); }

 const messagesRef = ref(db, `chats/${activeChatId}/messages`);

 activeChatListener = onValue(messagesRef, (snapshot) => {

 conversationMessages.innerHTML = ''; if (!snapshot.exists()) return;

 const msgs = Object.values(snapshot.val()).sort((a,b) => a.timestamp - b.timestamp);

 msgs.forEach(msg => {

 const isMe = msg.sender === currentUser.uid; const dateObj = new Date(msg.timestamp); const timeStr = dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

 conversationMessages.innerHTML += `<div class="chat-msg ${isMe ? 'sent' : 'received'}"><div class="msg-bubble">${msg.text}</div><span class="msg-time">${timeStr}</span></div>`;

 });

 setTimeout(() => { conversationMessages.scrollTop = conversationMessages.scrollHeight; }, 100);

 });

}



sendMessageBtn.addEventListener('click', sendChatMessage);

chatMessageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChatMessage(); });



async function sendChatMessage() {

 const text = chatMessageInput.value.trim(); if (!text || !activeChatId) return; chatMessageInput.value = '';

 const msgData = { sender: currentUser.uid, text: text, timestamp: Date.now() };

 await set(push(ref(db, `chats/${activeChatId}/messages`)), msgData);

 await set(ref(db, `chats/${activeChatId}/lastMessage`), text); await set(ref(db, `chats/${activeChatId}/lastTimestamp`), Date.now());

}



// === ADMIN USERS MANAGEMENT ===

if (navUsersBtn) { navUsersBtn.onclick = (e) => { e.preventDefault(); adminUsersModal.classList.add('active'); loadAllUsersForAdmin(); }; }

if (closeUsersModalBtn) closeUsersModalBtn.onclick = () => adminUsersModal.classList.remove('active');



function loadAllUsersForAdmin() {

 if (!isAdmin) return;

 onValue(ref(db, 'users'), (snapshot) => {

 adminUsersList.innerHTML = ''; if (!snapshot.exists()) return;

 const users = Object.entries(snapshot.val()).map(([uid, data]) => ({uid, ...data})).sort((a,b) => a.name.localeCompare(b.name));

 users.forEach(user => {

 if (user.uid === currentUser.uid) return;

 const role = user.role || 'Sin rol'; const el = document.createElement('div'); el.className = 'admin-user-item';

 el.innerHTML = `<div class="admin-user-info"><img src="${user.avatar}" class="avatar-small"><div><h4>${user.name}</h4><p>${user.email}</p></div></div><div class="admin-user-role"><span class="badge ${role}">${role}</span></div><div class="admin-user-action"><select class="text-input role-select" data-uid="${user.uid}"><option value="estudiante" ${role === 'estudiante' ? 'selected' : ''}>Estudiante</option><option value="profesor" ${role === 'profesor' ? 'selected' : ''}>Profesor</option><option value="padre" ${role === 'padre' ? 'selected' : ''}>Padre</option><option value="directivo" ${role === 'directivo' ? 'selected' : ''}>Directivo</option></select></div>`;

 adminUsersList.appendChild(el);

 });

 document.querySelectorAll('.role-select').forEach(select => {

 select.addEventListener('change', async (e) => {

 const newRole = e.target.value; const uid = e.target.dataset.uid;

 if(confirm(`¿Cambiar rol a ${newRole}?`)) { await set(ref(db, `users/${uid}/role`), newRole); } else { e.target.value = role; }

 });

 });

 });

}
