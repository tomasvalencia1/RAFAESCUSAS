/*
 * Reglas de seguridad de las ramas users, privado, posts, imagenesPosts, chats,
 * aprobados, fcmTokens, siguiendo, personalTasks, roleRequests y de los campos
 * de soporte.
 *
 * publish-database-rules.cjs las aplica a produccion sustituyendo cada rama
 * completa, y solo si la rama viva es exactamente la que habia antes (se compara
 * su huella). database.rules.json lleva las mismas ramas como referencia.
 *
 * Principios:
 *   - Nadie escribe datos a nombre de otro: los ids de autor deben ser auth.uid.
 *   - Los tamanos estan acotados (texto, fotos, imagenes).
 *   - Las fechas no pueden estar en el futuro (asi una publicacion de estudiante
 *     no puede evitar caducar).
 *   - Los correos no estan en el nodo publico users: van en privado/{uid}, que
 *     solo leen su dueno y los administradores.
 */
const ES_ADMIN = (uid = 'auth.uid') => `root.child('admins').child(${uid}).val() === true`;
const ROL = (uid) => `root.child('users').child(${uid}).child('role').val()`;
// Roles con chat institucional (los mismos que TEACHER_CHAT_ROLES en app.js) o admin.
const PUEDE_CHATEAR = (uid) =>
  `(${['maestro', 'profesor', 'padre', 'acudiente', 'directivo'].map(r => `${ROL(uid)} === '${r}'`).join(' || ')} || ${ES_ADMIN(uid)})`;
const NO_FUTURO = (campo) => `newData.child('${campo}').val() <= now + 60000`;
// Foto de perfil: la de Google, una JPEG pequena subida desde la app, vacia, o la
// que ya tenia (asi las cuentas antiguas pueden cambiar su nombre sin tocar la foto).
const FOTO_VALIDA = "newData.isString() && (newData.val() === data.val() || newData.val() === '' || (newData.val().length <= 20000 && ("
  + ['data:image/jpeg;base64,', 'https://lh3.googleusercontent.com/', 'https://lh4.googleusercontent.com/',
     'https://lh5.googleusercontent.com/', 'https://lh6.googleusercontent.com/']
    .map(prefijo => `newData.val().beginsWith('${prefijo}')`).join(' || ')
  + ')))';
const PARTICIPANTE = (uid) => `($chatId.beginsWith(${uid} + '_') || $chatId.endsWith('_' + ${uid}))`;
const SOY_PARTICIPANTE = "root.child('chats').child($chatId).child('participants').child(auth.uid).exists()";
// Cuenta aprobada por un administrador (o administrador). Hasta entonces la cuenta
// solo ve su propio perfil: nada de publicaciones, personas ni avisos del colegio.
const APROBADO = `(root.child('aprobados').child(auth.uid).val() === true || ${ES_ADMIN()})`;

const users = {
  '.read': `auth != null && ${APROBADO}`,
  $uid: {
    '.read': 'auth != null && auth.uid === $uid',
    '.write': `auth != null && (auth.uid === $uid || ${ES_ADMIN()})`,
    name: { '.validate': 'newData.isString() && newData.val().length >= 1 && newData.val().length <= 60' },
    avatar: { '.validate': FOTO_VALIDA },
    role: { '.validate': `newData.isString() && (newData.val() === 'estudiante' || ${ES_ADMIN()})` },
    createdAt: { '.validate': 'newData.isNumber()' },
    // Cualquier otro campo (incluido email, que ahora vive en privado) se rechaza.
    $otro: { '.validate': false },
  },
};

const privado = {
  '.read': `auth != null && ${ES_ADMIN()}`,
  $uid: {
    '.read': 'auth != null && auth.uid === $uid',
    '.write': 'auth != null && auth.uid === $uid',
    // El correo solo puede ser el de la propia cuenta de Google.
    email: { '.validate': 'newData.isString() && newData.val() === auth.token.email' },
    $otro: { '.validate': false },
  },
};

const posts = {
  '.indexOn': ['createdAt', 'timestamp'],
  '.read': `auth != null && ${APROBADO}`,
  $postId: {
    '.write': `auth != null && ((!data.exists() && newData.exists() && ${APROBADO} && newData.child('author').child('uid').val() === auth.uid && newData.child('authorRole').val() === root.child('users').child(auth.uid).child('role').val()) || (data.exists() && !newData.exists() && (data.child('author').child('uid').val() === auth.uid || data.child('autorId').val() === auth.uid || root.child('admins').child(auth.uid).val() === true)) || (data.exists() && newData.exists() && root.child('admins').child(auth.uid).val() === true))`,
    // Al crearla: campos obligatorios, sin fechas futuras y sin "me gusta" ni
    // comentarios inventados de antemano.
    '.validate': `data.exists() || !newData.exists() || (newData.hasChildren(['author', 'authorRole', 'timestamp', 'createdAt']) && ${NO_FUTURO('createdAt')} && ${NO_FUTURO('timestamp')} && !newData.child('likes').exists() && !newData.child('comentarios').exists() && !newData.child('comments').exists())`,
    author: {
      '.validate': "newData.hasChildren(['uid'])",
      uid: { '.validate': 'newData.isString()' },
      name: { '.validate': 'newData.isString() && newData.val().length <= 60' },
      avatar: { '.validate': 'newData.isString() && newData.val().length <= 20000' },
      $otro: { '.validate': false },
    },
    authorRole: { '.validate': 'newData.isString()' },
    content: { '.validate': 'newData.isString() && newData.val().length <= 2000' },
    timestamp: { '.validate': 'newData.isNumber()' },
    createdAt: { '.validate': 'newData.isNumber()' },
    flagged: { '.validate': 'newData.isBoolean()' },
    reason: { '.validate': 'newData.isString() && newData.val().length <= 100' },
    tieneImagen: { '.validate': 'newData.isBoolean()' },
    // Las imagenes van en imagenesPosts/{postId}: asi el feed no las descarga todas.
    imageBase64: { '.validate': false },
    likes: {
      $uid: {
        '.write': `auth != null && auth.uid === $uid && ${APROBADO}`,
        '.validate': 'newData.val() === true',
      },
    },
    comentarios: {
      $commentId: {
        '.write': `auth != null && ((!data.exists() && newData.exists() && ${APROBADO} && newData.child('autorId').val() === auth.uid && (data.parent().parent().child('authorRole').val() !== 'estudiante' || now < data.parent().parent().child('createdAt').val() + 86400000)) || (data.exists() && !newData.exists() && root.child('admins').child(auth.uid).val() === true))`,
        '.validate': `!newData.exists() || (newData.hasChildren(['autorId', 'autorNombre', 'texto', 'timestamp']) && newData.child('autorId').val() === auth.uid && newData.child('texto').isString() && newData.child('texto').val().length >= 1 && newData.child('texto').val().length <= 500 && newData.child('timestamp').isNumber() && ${NO_FUTURO('timestamp')} && newData.child('autorNombre').isString() && newData.child('autorNombre').val().length <= 60 && (!newData.child('autorAvatar').exists() || (newData.child('autorAvatar').isString() && newData.child('autorAvatar').val().length <= 20000)))`,
      },
    },
    // Ruta antigua de comentarios: ya no se escribe; solo un admin puede borrarlos.
    comments: {
      $commentId: { '.write': `auth != null && data.exists() && !newData.exists() && ${ES_ADMIN()}` },
    },
    $otro: { '.validate': false },
  },
};

const imagenesPosts = {
  $postId: {
    '.read': `auth != null && ${APROBADO}`,
    // Se crea junto con su publicacion (en la misma escritura) y solo por su autor.
    // La borran el autor o un admin, o cualquiera si su publicacion ya no existe.
    '.write': `auth != null && ((!data.exists() && newData.exists() && !root.child('posts').child($postId).exists() && newData.parent().parent().child('posts').child($postId).child('author').child('uid').val() === auth.uid) || (data.exists() && !newData.exists() && (root.child('posts').child($postId).child('author').child('uid').val() === auth.uid || ${ES_ADMIN()} || !newData.parent().parent().child('posts').child($postId).exists())))`,
    '.validate': "newData.isString() && newData.val().length <= 300000 && newData.val().beginsWith('data:image/jpeg;base64,')",
  },
};

const chats = {
  '.indexOn': ['lastTimestamp'],
  $chatId: {
    '.read': "auth != null && data.child('participants').child(auth.uid).exists()",
    // El id del chat es "uidA_uidB": solo esas dos personas pueden crearlo y ser
    // sus participantes, y ambas deben tener un rol con chat. Una vez creado, la
    // lista de participantes no cambia.
    participants: {
      '.write': `auth != null && !data.exists() && ${PARTICIPANTE('auth.uid')} && ${PUEDE_CHATEAR('auth.uid')}`,
      '.validate': 'newData.child(auth.uid).val() === true',
      $uid: { '.validate': `newData.val() === true && ${PARTICIPANTE('$uid')} && ${PUEDE_CHATEAR('$uid')}` },
    },
    // Los mensajes solo se anaden: nadie los edita ni los borra, y cada uno va a
    // nombre de quien lo escribe.
    messages: {
      $messageId: {
        '.write': `auth != null && !data.exists() && newData.exists() && ${SOY_PARTICIPANTE}`,
        '.validate': `newData.hasChildren(['senderId', 'text', 'timestamp']) && newData.child('senderId').val() === auth.uid && newData.child('text').isString() && newData.child('text').val().length >= 1 && newData.child('text').val().length <= 1000 && newData.child('timestamp').isNumber() && ${NO_FUTURO('timestamp')}`,
        senderId: { '.validate': 'newData.isString()' },
        text: { '.validate': 'newData.isString()' },
        timestamp: { '.validate': 'newData.isNumber()' },
        senderName: { '.validate': 'newData.isString() && newData.val().length <= 60' },
        sender: { '.validate': 'newData.val() === auth.uid' },
        senderRole: { '.validate': 'newData.isString() && newData.val().length <= 30' },
        $otro: { '.validate': false },
      },
    },
    lastMessage: {
      '.write': `auth != null && ${SOY_PARTICIPANTE}`,
      '.validate': 'newData.isString() && newData.val().length <= 1000',
    },
    lastTimestamp: {
      '.write': `auth != null && ${SOY_PARTICIPANTE}`,
      '.validate': 'newData.isNumber() && newData.val() <= now + 60000',
    },
  },
};

// Aprobacion de cuentas: solo los administradores la conceden o la retiran.
// Cada persona puede leer la suya (la app la consulta para mostrar la espera).
const aprobados = {
  '.read': `auth != null && ${ES_ADMIN()}`,
  $uid: {
    '.read': 'auth != null && auth.uid === $uid',
    '.write': `auth != null && ${ES_ADMIN()}`,
    '.validate': 'newData.isBoolean()',
  },
};

// Nodos que escribe cada persona para si misma: tamano y campos acotados, para que
// nadie llene la base de datos ni infle lo que descarga el despachador. Las reglas
// no pueden limitar cuantas entradas se crean; si limitan cada una.

// Telefonos registrados para notificaciones: cada entrada es un token de FCM.
const fcmTokens = {
  $uid: {
    '.read': 'auth != null && auth.uid === $uid',
    '.write': 'auth != null && auth.uid === $uid',
    '.validate': 'newData.hasChildren()',
    $token: { '.validate': '$token.length <= 600 && newData.isString() && newData.val().length >= 1 && newData.val().length <= 400' },
  },
};

// A quien sigue cada persona: solo a cuentas que existen.
const siguiendo = {
  $seguidorId: {
    '.read': 'auth != null && auth.uid === $seguidorId',
    $seguidoId: {
      '.write': "auth != null && auth.uid === $seguidorId && (newData.val() === null || (newData.child('seguidoId').val() === $seguidoId && newData.child('creadoEn').isNumber()))",
      '.validate': "newData.hasChildren(['seguidoId', 'creadoEn']) && root.child('users').child($seguidoId).exists()",
      seguidoId: { '.validate': 'newData.isString()' },
      creadoEn: { '.validate': 'newData.isNumber()' },
      $otro: { '.validate': false },
    },
  },
};

// Tareas del calendario personal (las mismas longitudes que el formulario).
const personalTasks = {
  $uid: {
    '.read': 'auth != null && auth.uid === $uid',
    '.write': 'auth != null && auth.uid === $uid',
    '.validate': 'newData.hasChildren()',
    $taskId: {
      '.validate': "data.exists() || newData.hasChildren(['title', 'dueDate', 'completed', 'createdAt'])",
      title: { '.validate': 'newData.isString() && newData.val().length >= 1 && newData.val().length <= 120' },
      dueDate: { '.validate': 'newData.isString() && newData.val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)' },
      completed: { '.validate': 'newData.isBoolean()' },
      createdAt: { '.validate': 'newData.isNumber()' },
      completedAt: { '.validate': 'newData.isNumber()' },
      $otro: { '.validate': false },
    },
  },
};

// Solicitudes de rol: los campos que escribe la app al pedirlo, y solo los roles
// que se piden (RESTRICTED_ROLES en app.js); al aprobar, ese texto pasa a ser el rol.
const roleRequests = {
  $uid: {
    '.read': `auth != null && (auth.uid === $uid || ${ES_ADMIN()})`,
    '.write': `auth != null && ((auth.uid === $uid && !data.exists() && newData.child('requestedRole').val() !== 'estudiante' && newData.child('status').val() === 'pending') || ${ES_ADMIN()})`,
    '.validate': "newData.hasChildren(['requestedRole', 'status'])",
    name: { '.validate': 'newData.isString() && newData.val().length <= 100' },
    email: { '.validate': 'newData.isString() && newData.val().length <= 254' },
    requestedRole: { '.validate': "newData.val() === 'profesor' || newData.val() === 'padre' || newData.val() === 'directivo'" },
    status: { '.validate': 'newData.isString() && newData.val().length <= 20' },
    requestedAt: { '.validate': 'newData.isNumber()' },
    $otro: { '.validate': false },
  },
};

// Solicitudes de soporte: se anaden campo a campo bajo soporte/$ticketId, cuyos
// permisos (.read/.write) se mantienen como estan en produccion.
const soporteCampos = {
  '.validate': "data.exists() || newData.hasChildren(['userId', 'texto', 'timestamp', 'estado'])",
  userId: { '.validate': 'newData.isString() && newData.val().length <= 128' },
  texto: { '.validate': 'newData.isString() && newData.val().length <= 1000' },
  timestamp: { '.validate': 'newData.isNumber()' },
  estado: { '.validate': "newData.val() === 'pendiente' || newData.val() === 'resuelto'" },
  resueltoPor: { '.validate': 'newData.isString() && newData.val().length <= 128' },
  resueltoPorNombre: { '.validate': 'newData.isString() && newData.val().length <= 100' },
  resueltoEn: { '.validate': 'newData.isNumber()' },
  $otro: { '.validate': false },
};

module.exports = { users, privado, posts, imagenesPosts, chats, aprobados, fcmTokens, siguiendo, personalTasks, roleRequests, soporteCampos, APROBADO };
