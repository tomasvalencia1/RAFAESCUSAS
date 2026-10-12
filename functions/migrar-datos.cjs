/*
 * Migracion de datos que acompana a las reglas de reglas-seguridad.cjs.
 * La ejecuta el workflow de reglas justo despues de publicarlas, con la cuenta de
 * servicio (FIREBASE_SERVICE_ACCOUNT). Es idempotente: si no queda nada que
 * migrar, no escribe nada.
 *
 *   1. Correos: users/{uid}/email -> privado/{uid}/email (solo dueno y admins).
 *   2. Imagenes: posts/{id}/imageBase64 -> imagenesPosts/{id}, y la publicacion
 *      queda con tieneImagen: true. El feed deja de descargar todas las imagenes.
 *   3. Solicitudes de rol ya resueltas (aprobadas/rechazadas): se borran.
 *
 * Cada elemento se mueve con una sola escritura atomica (copia y borrado juntos),
 * asi que un fallo a mitad nunca deja datos perdidos ni duplicados a medias.
 */
const { cert } = require('firebase-admin/app');

const DATABASE_URL = process.env.RULES_DATABASE_URL || 'https://rafaescusas-default-rtdb.firebaseio.com';
const NS = process.env.RULES_NS ? `ns=${encodeURIComponent(process.env.RULES_NS)}` : '';
// Tamano maximo aproximado de cada escritura (las imagenes pesan).
const LOTE_BYTES = 4 * 1024 * 1024;

async function accessToken() {
  if (process.env.RULES_ACCESS_TOKEN) return process.env.RULES_ACCESS_TOKEN; // solo para el emulador
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.');
  return (await cert(JSON.parse(raw)).getAccessToken()).access_token;
}

function url(ruta) {
  return `${DATABASE_URL}/${ruta}.json${NS ? `?${NS}` : ''}`;
}

async function leer(ruta, headers) {
  const res = await fetch(url(ruta), { headers });
  if (!res.ok) throw new Error(`No se pudo leer ${ruta} (HTTP ${res.status}).`);
  return (await res.json()) || {};
}

// Agrupa los cambios de cada elemento (que deben ir juntos) en lotes de tamano acotado.
function enLotes(grupos) {
  const lotes = [];
  let actual = {};
  let bytes = 0;
  for (const grupo of grupos) {
    const tam = JSON.stringify(grupo).length;
    if (bytes && bytes + tam > LOTE_BYTES) { lotes.push(actual); actual = {}; bytes = 0; }
    Object.assign(actual, grupo);
    bytes += tam;
  }
  if (bytes) lotes.push(actual);
  return lotes;
}

async function main() {
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  const [users, posts, solicitudes] = await Promise.all([leer('users', headers), leer('posts', headers), leer('roleRequests', headers)]);

  const grupos = [];
  let correos = 0;
  let imagenes = 0;
  let solicitudesResueltas = 0;

  for (const [uid, usuario] of Object.entries(users)) {
    if (!usuario || typeof usuario.email !== 'string') continue;
    grupos.push({ [`privado/${uid}/email`]: usuario.email, [`users/${uid}/email`]: null });
    correos += 1;
  }
  for (const [id, post] of Object.entries(posts)) {
    if (!post || typeof post.imageBase64 !== 'string' || !post.imageBase64) continue;
    grupos.push({ [`imagenesPosts/${id}`]: post.imageBase64, [`posts/${id}/imageBase64`]: null, [`posts/${id}/tieneImagen`]: true });
    imagenes += 1;
  }
  for (const [uid, solicitud] of Object.entries(solicitudes)) {
    if (solicitud && solicitud.status === 'pending') continue;
    grupos.push({ [`roleRequests/${uid}`]: null });
    solicitudesResueltas += 1;
  }

  if (!grupos.length) {
    console.log('Datos ya migrados. Nada que hacer.');
    return;
  }

  for (const lote of enLotes(grupos)) {
    const res = await fetch(url(''), {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(lote),
    });
    if (!res.ok) throw new Error(`La migración falló (HTTP ${res.status}): ${await res.text()}`);
  }

  // Comprobacion: ya no debe quedar nada pendiente de mover.
  const [usersDespues, postsDespues] = await Promise.all([leer('users', headers), leer('posts', headers)]);
  const quedanCorreos = Object.values(usersDespues).filter(u => u && u.email !== undefined).length;
  const quedanImagenes = Object.values(postsDespues).filter(p => p && p.imageBase64 !== undefined).length;
  if (quedanCorreos || quedanImagenes) {
    console.log(`::error::La migración no terminó: quedan ${quedanCorreos} correo(s) y ${quedanImagenes} imagen(es) sin mover.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Migración completada: ${correos} correo(s) a privado, ${imagenes} imagen(es) a imagenesPosts, ${solicitudesResueltas} solicitud(es) de rol resuelta(s) borrada(s).`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { enLotes };
