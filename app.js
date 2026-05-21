import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getDatabase, ref, onValue, push, set, remove, get } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-database.js";

// Tu configuración de Firebase
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

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const provider = new GoogleAuthProvider();

// Elementos del DOM
const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const loginGoogleBtn = document.getElementById('login-google-btn');
const logoutBtn = document.getElementById('logout-btn');
const headerAvatar = document.getElementById('header-avatar');
const headerUsername = document.getElementById('header-username');

const postsContainer = document.getElementById('posts-container');
const newsContainer = document.getElementById('news-container');

// Modales
const postModal = document.getElementById('post-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const publishPostBtn = document.getElementById('publish-post-btn');
const postTextarea = document.getElementById('post-textarea');

const newsModal = document.getElementById('news-modal');
const openNewsModalBtn = document.getElementById('add-news-btn');
const closeNewsModalBtn = document.getElementById('close-news-modal-btn');
const publishNewsBtn = document.getElementById('publish-news-btn');
const newsTitleInput = document.getElementById('news-title-input');
const newsDescInput = document.getElementById('news-desc-input');

// Variables globales
let currentUser = null;
let isAdmin = false;

// === AUTENTICACIÓN ===
loginGoogleBtn.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        alert("Hubo un error al iniciar sesión.");
    }
});

logoutBtn.addEventListener('click', () => {
    signOut(auth);
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Comprobar si es admin
        const adminRef = ref(db, `admins/${user.uid}`);
        const snapshot = await get(adminRef);
        isAdmin = snapshot.exists() && snapshot.val() === true;

        // Actualizar UI
        headerAvatar.src = user.photoURL || "https://i.pravatar.cc/150?img=68";
        headerUsername.textContent = user.displayName;
        loginScreen.classList.remove('active');
        appContainer.style.display = 'block';

        if (isAdmin) {
            openNewsModalBtn.style.display = 'flex';
        } else {
            openNewsModalBtn.style.display = 'none';
        }

        // Cargar datos
        loadPosts();
        loadNews();
    } else {
        currentUser = null;
        isAdmin = false;
        loginScreen.classList.add('active');
        appContainer.style.display = 'none';
    }
});

// === MODALES ===
openModalBtn.addEventListener('click', () => postModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => postModal.classList.remove('active'));
openNewsModalBtn.addEventListener('click', () => newsModal.classList.add('active'));
closeNewsModalBtn.addEventListener('click', () => newsModal.classList.remove('active'));

// === LOGICA DE PUBLICACIONES (POSTS) ===
publishPostBtn.addEventListener('click', async () => {
    const text = postTextarea.value.trim();
    if (!text || !currentUser) return;

    publishPostBtn.textContent = 'Publicando...';
    publishPostBtn.disabled = true;

    try {
        const newPostRef = push(ref(db, 'posts'));
        await set(newPostRef, {
            author: {
                uid: currentUser.uid,
                name: currentUser.displayName,
                avatar: currentUser.photoURL || "https://i.pravatar.cc/150?img=68"
            },
            content: text,
            timestamp: Date.now(),
            likesCount: 0
        });
        
        postModal.classList.remove('active');
        postTextarea.value = '';
    } catch (error) {
        console.error("Error publicando post:", error);
    } finally {
        publishPostBtn.textContent = 'Publicar';
        publishPostBtn.disabled = false;
    }
});

function loadPosts() {
    const postsRef = ref(db, 'posts');
    onValue(postsRef, (snapshot) => {
        postsContainer.innerHTML = '';
        if (!snapshot.exists()) {
            postsContainer.innerHTML = '<div class="loading-spinner">No hay publicaciones aún. ¡Sé el primero!</div>';
            return;
        }

        const postsData = snapshot.val();
        // Convertir a array y ordenar por fecha (más nuevos primero)
        const postsArray = Object.keys(postsData).map(key => ({
            id: key,
            ...postsData[key]
        })).sort((a, b) => b.timestamp - a.timestamp);

        postsArray.forEach(post => {
            const postElement = document.createElement('article');
            postElement.className = 'post-card';
            
            // Tiempo relativo
            const minutesAgo = Math.floor((Date.now() - post.timestamp) / 60000);
            const timeStr = minutesAgo < 60 ? `Hace ${minutesAgo} min` : (minutesAgo < 1440 ? `Hace ${Math.floor(minutesAgo/60)} horas` : `Hace ${Math.floor(minutesAgo/1440)} días`);
            
            // Calcular si di like (Revisando la colección de likes)
            const myLike = post.likes && post.likes[currentUser.uid] ? true : false;
            const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
            
            let commentsHtml = '';
            if (post.comments) {
                commentsHtml = Object.keys(post.comments).map(commentKey => {
                    const c = post.comments[commentKey];
                    return `
                    <div class="comment">
                        <img src="${c.authorAvatar}" class="avatar" alt="Avatar">
                        <div class="comment-content">
                            <strong>${c.authorName}</strong>
                            ${c.text}
                        </div>
                    </div>`;
                }).join('');
            }

            postElement.innerHTML = `
                <div class="post-header">
                    <div class="user-info">
                        <img src="${post.author.avatar}" alt="${post.author.name}" class="avatar">
                        <div class="user-details">
                            <span class="username">${post.author.name}</span>
                            <span class="post-meta">${timeStr} &bull; <i class='bx bx-world'></i></span>
                        </div>
                    </div>
                    ${isAdmin ? `<button class="action-btn delete-post-btn" data-id="${post.id}" title="Eliminar (Admin)"><i class='bx bx-trash'></i></button>` : `<button class="action-btn"><i class='bx bx-dots-horizontal-rounded'></i></button>`}
                </div>
                
                <div class="post-content">${post.content}</div>
                
                <div class="post-actions">
                    <button class="action-btn like-btn ${myLike ? 'liked' : ''}" data-id="${post.id}">
                        <i class='bx ${myLike ? 'bxs-like' : 'bx-like'}'></i> 
                        <span class="likes-count">${post.likesCount || 0}</span>
                    </button>
                    <button class="action-btn comment-btn" data-id="${post.id}">
                        <i class='bx bx-message-rounded'></i> ${commentsCount}
                    </button>
                </div>
                
                <div class="comments-section" id="comments-${post.id}">
                    <div class="comments-list">
                        ${commentsHtml}
                    </div>
                    <div class="comment-input-area">
                        <img src="${currentUser.photoURL || "https://i.pravatar.cc/150?img=68"}" class="avatar" alt="Tu avatar">
                        <input type="text" placeholder="Escribe un comentario..." class="new-comment-input" data-id="${post.id}">
                        <button class="comment-submit-btn" data-id="${post.id}"><i class='bx bxs-send'></i></button>
                    </div>
                </div>
            `;
            postsContainer.appendChild(postElement);
        });
    });
}

// Delegación de eventos para likes, comentarios y borrado
postsContainer.addEventListener('click', async (e) => {
    // Botón borrar (Solo admin)
    const deleteBtn = e.target.closest('.delete-post-btn');
    if (deleteBtn && isAdmin) {
        if(confirm("¿Estás seguro de eliminar esta publicación como administrador?")) {
            const id = deleteBtn.dataset.id;
            await remove(ref(db, `posts/${id}`));
        }
        return;
    }

    // Like button
    const likeBtn = e.target.closest('.like-btn');
    if (likeBtn) {
        const id = likeBtn.dataset.id;
        const likeRef = ref(db, `posts/${id}/likes/${currentUser.uid}`);
        
        // Comprobar estado actual
        const snapshot = await get(likeRef);
        const postData = (await get(ref(db, `posts/${id}`))).val();
        let currentCount = postData.likesCount || 0;

        if (snapshot.exists()) {
            await remove(likeRef);
            await set(ref(db, `posts/${id}/likesCount`), currentCount - 1);
        } else {
            await set(likeRef, true);
            await set(ref(db, `posts/${id}/likesCount`), currentCount + 1);
        }
        return;
    }

    // Mostrar Comentarios
    const commentBtn = e.target.closest('.comment-btn');
    if (commentBtn) {
        const id = commentBtn.dataset.id;
        document.getElementById(`comments-${id}`).classList.toggle('visible');
        return;
    }

    // Enviar comentario
    const submitBtn = e.target.closest('.comment-submit-btn');
    if (submitBtn) {
        const id = submitBtn.dataset.id;
        const input = document.querySelector(`.new-comment-input[data-id="${id}"]`);
        await submitComment(id, input);
    }
});

// Comentar con Enter
postsContainer.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('new-comment-input')) {
        const id = e.target.dataset.id;
        await submitComment(id, e.target);
    }
});

async function submitComment(postId, inputElement) {
    const text = inputElement.value.trim();
    if (text) {
        inputElement.value = '';
        inputElement.disabled = true;
        const newCommentRef = push(ref(db, `posts/${postId}/comments`));
        await set(newCommentRef, {
            authorUid: currentUser.uid,
            authorName: currentUser.displayName,
            authorAvatar: currentUser.photoURL || "https://i.pravatar.cc/150?img=68",
            text: text,
            timestamp: Date.now()
        });
        document.getElementById(`comments-${postId}`).classList.add('visible');
        inputElement.disabled = false;
        inputElement.focus();
    }
}

// === LOGICA DE NOTICIAS (ADMIN) ===
publishNewsBtn.addEventListener('click', async () => {
    const title = newsTitleInput.value.trim();
    const desc = newsDescInput.value.trim();
    
    if (!title || !desc || !isAdmin) return;

    publishNewsBtn.textContent = 'Publicando...';
    publishNewsBtn.disabled = true;

    try {
        const newNewsRef = push(ref(db, 'news'));
        await set(newNewsRef, {
            title: title,
            desc: desc,
            timestamp: Date.now()
        });
        newsModal.classList.remove('active');
        newsTitleInput.value = '';
        newsDescInput.value = '';
    } catch (error) {
        console.error("Error publicando noticia:", error);
    } finally {
        publishNewsBtn.textContent = 'Publicar Noticia';
        publishNewsBtn.disabled = false;
    }
});

function loadNews() {
    const newsRef = ref(db, 'news');
    onValue(newsRef, (snapshot) => {
        newsContainer.innerHTML = '';
        if (!snapshot.exists()) {
            newsContainer.innerHTML = '<div class="news-item"><p>No hay noticias recientes.</p></div>';
            return;
        }

        const newsData = snapshot.val();
        const newsArray = Object.keys(newsData).map(key => ({
            id: key,
            ...newsData[key]
        })).sort((a, b) => b.timestamp - a.timestamp); // Más nuevas primero

        newsArray.forEach(item => {
            const newsEl = document.createElement('div');
            newsEl.className = 'news-item';
            
            // Botón de eliminar si es admin
            const deleteBtn = isAdmin ? `<button class="delete-news-btn" data-id="${item.id}" title="Eliminar Noticia"><i class='bx bx-trash'></i></button>` : '';

            newsEl.innerHTML = `
                ${deleteBtn}
                <h3>${item.title}</h3>
                <p>${item.desc}</p>
            `;
            newsContainer.appendChild(newsEl);
        });

        // Eventos para eliminar noticias
        if (isAdmin) {
            document.querySelectorAll('.delete-news-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    if(confirm("¿Eliminar esta noticia?")) {
                        const id = e.currentTarget.dataset.id;
                        await remove(ref(db, `news/${id}`));
                    }
                });
            });
        }
    });
}
