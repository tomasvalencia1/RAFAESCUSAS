// Estado inicial mockeado basado en la imagen
const initialPosts = [
    {
        id: 1,
        author: {
            name: "Prof. Maria Gonzalez",
            avatar: "https://i.pravatar.cc/150?img=47"
        },
        timeAgo: "Hace 2 horas",
        content: "¡Excelente trabajo a los estudiantes de 10º grado en la feria de ciencias! Sus proyectos sobre energías renovables fueron verdaderamente inspiradores. 🌟 🔬 #CienciaRU #OrgulloEscolar",
        image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80",
        likes: 45,
        comments: [
            { author: "Juan P.", text: "¡Estuvo increíble!" }
        ],
        likedByMe: false
    },
    {
        id: 2,
        author: {
            name: "Dirección Académica",
            avatar: "https://i.pravatar.cc/150?img=11"
        },
        timeAgo: "Hace 5 horas",
        content: "Recordatorio importante: Las inscripciones para las actividades extracurriculares del segundo semestre cierran este viernes. Por favor, asegúrense de completar el formulario en línea.",
        image: null,
        likes: 120,
        comments: [],
        likedByMe: false
    }
];

// Inicializar LocalStorage si está vacío
if (!localStorage.getItem('ru_posts')) {
    localStorage.setItem('ru_posts', JSON.stringify(initialPosts));
}

// Variables de estado
let posts = JSON.parse(localStorage.getItem('ru_posts'));
let currentUserId = "me";
let currentUser = {
    name: "Tú",
    avatar: "https://i.pravatar.cc/150?img=68"
};

// Elementos del DOM
const postsContainer = document.getElementById('posts-container');
const modal = document.getElementById('post-modal');
const openModalBtn = document.getElementById('open-modal-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const publishBtn = document.getElementById('publish-post-btn');
const postTextarea = document.getElementById('post-textarea');

// Funciones de renderizado
function renderPosts() {
    postsContainer.innerHTML = '';
    
    posts.forEach(post => {
        const postElement = document.createElement('article');
        postElement.className = 'post-card';
        postElement.dataset.id = post.id;
        
        let imageHtml = post.image ? `<img src="${post.image}" alt="Imagen del post" class="post-image">` : '';
        
        let commentsHtml = post.comments.map(c => `
            <div class="comment">
                <img src="https://i.pravatar.cc/150?u=${encodeURIComponent(c.author)}" class="avatar" alt="Avatar">
                <div class="comment-content">
                    <strong>${c.author}</strong>
                    ${c.text}
                </div>
            </div>
        `).join('');

        postElement.innerHTML = `
            <div class="post-header">
                <div class="user-info">
                    <img src="${post.author.avatar}" alt="${post.author.name}" class="avatar">
                    <div class="user-details">
                        <span class="username">${post.author.name}</span>
                        <span class="post-meta">${post.timeAgo} &bull; <i class='bx bx-world'></i></span>
                    </div>
                </div>
                <button class="action-btn"><i class='bx bx-dots-horizontal-rounded'></i></button>
            </div>
            
            <div class="post-content">${post.content}</div>
            ${imageHtml}
            
            <div class="post-actions">
                <button class="action-btn like-btn ${post.likedByMe ? 'liked' : ''}" data-id="${post.id}">
                    <i class='bx ${post.likedByMe ? 'bxs-like' : 'bx-like'}'></i> 
                    <span class="likes-count">${post.likes}</span>
                </button>
                <button class="action-btn comment-btn" data-id="${post.id}">
                    <i class='bx bx-message-rounded'></i> ${post.comments.length}
                </button>
                <button class="action-btn share-btn">
                    <i class='bx bx-share'></i>
                </button>
            </div>
            
            <div class="comments-section" id="comments-${post.id}">
                <div class="comments-list">
                    ${commentsHtml}
                </div>
                <div class="comment-input-area">
                    <img src="${currentUser.avatar}" class="avatar" alt="Tu avatar">
                    <input type="text" placeholder="Escribe un comentario..." class="new-comment-input" data-id="${post.id}">
                    <button class="comment-submit-btn" data-id="${post.id}"><i class='bx bxs-send'></i></button>
                </div>
            </div>
        `;
        
        postsContainer.appendChild(postElement);
    });
}

// Guardar en LocalStorage
function savePosts() {
    localStorage.setItem('ru_posts', JSON.stringify(posts));
}

// Event Listeners
openModalBtn.addEventListener('click', () => {
    modal.classList.add('active');
    postTextarea.focus();
});

closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    postTextarea.value = '';
});

// Cerrar modal al hacer click fuera
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.classList.remove('active');
    }
});

// Crear nuevo post
publishBtn.addEventListener('click', () => {
    const text = postTextarea.value.trim();
    if (!text) return;

    const newPost = {
        id: Date.now(),
        author: {
            name: currentUser.name,
            avatar: currentUser.avatar
        },
        timeAgo: "Hace un momento",
        content: text,
        image: null,
        likes: 0,
        comments: [],
        likedByMe: false
    };

    posts.unshift(newPost); // Añadir al principio
    savePosts();
    renderPosts();
    
    modal.classList.remove('active');
    postTextarea.value = '';
});

// Delegación de eventos para los botones de los posts
postsContainer.addEventListener('click', (e) => {
    // Like button
    const likeBtn = e.target.closest('.like-btn');
    if (likeBtn) {
        const id = parseInt(likeBtn.dataset.id);
        const postIndex = posts.findIndex(p => p.id === id);
        
        if (posts[postIndex].likedByMe) {
            posts[postIndex].likes--;
            posts[postIndex].likedByMe = false;
        } else {
            posts[postIndex].likes++;
            posts[postIndex].likedByMe = true;
        }
        
        savePosts();
        renderPosts(); // Re-render for simplicity
        return;
    }

    // Toggle Comments button
    const commentBtn = e.target.closest('.comment-btn');
    if (commentBtn) {
        const id = commentBtn.dataset.id;
        const commentsSection = document.getElementById(`comments-${id}`);
        commentsSection.classList.toggle('visible');
        return;
    }

    // Submit comment button
    const submitBtn = e.target.closest('.comment-submit-btn');
    if (submitBtn) {
        const id = parseInt(submitBtn.dataset.id);
        const input = document.querySelector(`.new-comment-input[data-id="${id}"]`);
        const text = input.value.trim();
        
        if (text) {
            const postIndex = posts.findIndex(p => p.id === id);
            posts[postIndex].comments.push({
                author: currentUser.name,
                text: text
            });
            savePosts();
            renderPosts();
            // Mantener la sección de comentarios visible después de renderizar
            setTimeout(() => {
                document.getElementById(`comments-${id}`).classList.add('visible');
            }, 0);
        }
    }
});

// Enter key to submit comment
postsContainer.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('new-comment-input')) {
        const id = parseInt(e.target.dataset.id);
        const text = e.target.value.trim();
        
        if (text) {
            const postIndex = posts.findIndex(p => p.id === id);
            posts[postIndex].comments.push({
                author: currentUser.name,
                text: text
            });
            savePosts();
            renderPosts();
            setTimeout(() => {
                document.getElementById(`comments-${id}`).classList.add('visible');
            }, 0);
        }
    }
});

// Render inicial
renderPosts();
