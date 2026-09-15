/*
 * Free scheduled cleanup for GitHub Actions.
 *
 * The service-account JSON is injected only by GitHub Actions as the
 * FIREBASE_SERVICE_ACCOUNT secret. Never place that JSON in this repository.
 */
const { cert, initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const STUDENT_POST_TTL_MS = 24 * 60 * 60 * 1000;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error([
      'ERROR: Falta el secreto FIREBASE_SERVICE_ACCOUNT.',
      '',
      'Para configurarlo:',
      '1. Ve a Firebase Console > Configuración del proyecto > Cuentas de servicio.',
      '2. Genera una nueva clave privada JSON.',
      '3. En GitHub > tu repositorio > Settings > Secrets and variables > Actions,',
      '   crea el secreto FIREBASE_SERVICE_ACCOUNT y pega el contenido del JSON.',
      '',
      'Mientras el secreto no esté configurado, el cliente sigue ocultando posts',
      'vencidos inmediatamente, pero no se eliminan de la base de datos.'
    ].join('\n'));
    process.exit(0); // Exit cleanly so the workflow doesn't report a failure
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido.');
  }
}

async function cleanupExpiredStudentPosts() {
  initializeApp({
    credential: cert(getServiceAccount()),
    databaseURL: 'https://rafaescusas-default-rtdb.firebaseio.com'
  });

  const postsRef = getDatabase().ref('posts');
  const snapshot = await postsRef.once('value');
  const now = Date.now();
  const updates = {};

  snapshot.forEach((child) => {
    const post = child.val() || {};
    const createdAt = Number(post.createdAt || post.timestamp || 0);
    if (post.authorRole === 'estudiante' && createdAt && now >= createdAt + STUDENT_POST_TTL_MS) {
      updates[child.key] = null;
    }
  });

  const count = Object.keys(updates).length;
  if (count) await postsRef.update(updates);
  console.log(`Limpieza terminada: ${count} publicación(es) de estudiante eliminada(s).`);
}

cleanupExpiredStudentPosts().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
