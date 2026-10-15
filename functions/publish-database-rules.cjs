/*
 * Aplica a la Realtime Database de produccion los cambios de reglas que necesita
 * la app, usando la cuenta de servicio del secreto FIREBASE_SERVICE_ACCOUNT.
 *
 * No publica database.rules.json entero: las reglas de produccion tambien se
 * editan desde la consola y pueden diferir del repositorio. Parte de las reglas
 * VIVAS y aplica solo:
 *   - INDICES: los .indexOn que usa el despachador de notificaciones.
 *   - PARCHES: cambios de permisos concretos. Cada uno se aplica solo si la regla
 *     viva coincide exactamente con el valor `antes`; si no, se aborta sin tocar
 *     nada (alguien la cambio y hay que revisarla a mano).
 * Tras publicar, vuelve a leer las reglas y comprueba que el resultado es
 * exactamente el esperado; si no, restaura las anteriores.
 */
const crypto = require('crypto');
const { cert } = require('firebase-admin/app');
const SEGURIDAD = require('./reglas-seguridad.cjs');

const DATABASE_URL = process.env.RULES_DATABASE_URL || 'https://rafaescusas-default-rtdb.firebaseio.com';
const NS = process.env.RULES_NS ? `?ns=${encodeURIComponent(process.env.RULES_NS)}` : '';

// Indices que usan las consultas de functions/notificaciones-core.cjs
const INDICES = {
  posts: ['createdAt', 'timestamp'],
  chats: ['lastTimestamp'],
  news: ['timestamp'],
  events: ['timestamp'],
  soporte: ['timestamp', 'resueltoEn'],
};

const ES_ADMIN = "root.child('admins').child(auth.uid).val() === true";
const ES_DIRECTIVO = "root.child('users').child(auth.uid).child('role').val() === 'directivo'";

// Buzon de soporte para administradores: listar todas las solicitudes y poder
// marcarlas como resueltas. Antes nadie podia listarlas desde la app.
const PARCHES = [
  {
    ruta: ['soporte', '.read'],
    antes: undefined,
    despues: `auth != null && ${ES_ADMIN}`,
  },
  {
    ruta: ['soporte', '$ticketId', '.write'],
    antes: `auth != null && ((!data.exists() && newData.child('userId').val() === auth.uid && newData.child('texto').isString() && newData.child('texto').val().length <= 1000 && newData.child('estado').val() === 'pendiente') || (data.exists() && ${ES_DIRECTIVO}))`,
    despues: `auth != null && ((!data.exists() && newData.child('userId').val() === auth.uid && newData.child('texto').isString() && newData.child('texto').val().length <= 1000 && newData.child('estado').val() === 'pendiente') || (data.exists() && (${ES_DIRECTIVO} || ${ES_ADMIN})))`,
  },
  // Avisos del profesorado: los administradores pueden publicar (en su propio
  // espacio, con los mismos huecos 1-3 por dia) y borrar cualquier aviso.
  {
    ruta: ['mensajes_profesor', '$dia', '$profesorId', '$slot', '.write'],
    antes: "auth != null && auth.uid === $profesorId && (root.child('users').child(auth.uid).child('role').val() === 'profesor' || root.child('users').child(auth.uid).child('role').val() === 'maestro') && !data.exists() && newData.exists() && ($slot === '1' || $slot === '2' || $slot === '3')",
    despues: `auth != null && ((auth.uid === $profesorId && (root.child('users').child(auth.uid).child('role').val() === 'profesor' || root.child('users').child(auth.uid).child('role').val() === 'maestro' || ${ES_ADMIN}) && !data.exists() && newData.exists() && ($slot === '1' || $slot === '2' || $slot === '3')) || (${ES_ADMIN} && data.exists() && !newData.exists()))`,
  },
  // Avisos del profesorado: la hora no puede estar en el futuro (un aviso con fecha
  // futura quedaba fijado el primero de la lista) y el dia debe ser AAAA-MM-DD.
  {
    ruta: ['mensajes_profesor', '$dia', '$profesorId', '$slot', '.validate'],
    antes: "newData.hasChildren(['autorId', 'autorNombre', 'texto', 'timestamp', 'dia']) && newData.child('autorId').val() === auth.uid && newData.child('autorNombre').isString() && newData.child('texto').isString() && newData.child('texto').val().length <= 180 && newData.child('timestamp').isNumber() && newData.child('dia').val() === $dia",
    despues: "newData.hasChildren(['autorId', 'autorNombre', 'texto', 'timestamp', 'dia']) && newData.child('autorId').val() === auth.uid && newData.child('autorNombre').isString() && newData.child('texto').isString() && newData.child('texto').val().length <= 180 && newData.child('timestamp').isNumber() && newData.child('dia').val() === $dia && newData.child('timestamp').val() <= now + 60000 && $dia.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
  },
  // Seguridad (ver reglas-seguridad.cjs): ramas completas. `antesHuella` es la
  // huella SHA-256 de los permisos (sin indices) de la rama de produccion que
  // sustituyen; las nuevas no existian. users, posts e imagenesPosts parten de la
  // version publicada en 166866a y pasan a exigir cuenta aprobada.
  { ruta: ['users'], antesHuella: '0534dea5054159c332e763a41aa5a22bbae53cdd05d5d2f5b176d38c55efa5f0', despues: SEGURIDAD.users },
  { ruta: ['posts'], antesHuella: '620b91f7d26d9be93dcff9e7ee4ee903313e84087752bc5115746e73e40a9ee2', despues: SEGURIDAD.posts },
  // chats parte de la version publicada en 9c7199d: cada persona pasa a poder leer
  // sus chats aunque aun no existan (la lista del chat se entera del primer mensaje).
  { ruta: ['chats'], antesHuella: 'a7af79ee480bdc03fb86f83c4917a1d4730211c97d2c0bcb377d5dad87ecdf3d', despues: SEGURIDAD.chats },
  // Marcas de lectura del chat (mensajes sin leer): rama nueva, privada de cada persona.
  { ruta: ['chatsLeidos'], antes: undefined, despues: SEGURIDAD.chatsLeidos },
  { ruta: ['privado'], antes: undefined, despues: SEGURIDAD.privado },
  { ruta: ['imagenesPosts'], antesHuella: '6cc265851760ba847ccb82a78ec551ab3266def4526666f8610718b6e9fcd46c', despues: SEGURIDAD.imagenesPosts },
  // Aprobacion de cuentas: la rama nueva y la lectura del contenido del colegio
  // solo para cuentas aprobadas (antes bastaba con tener cualquier cuenta de Google).
  { ruta: ['aprobados'], antes: undefined, despues: SEGURIDAD.aprobados },
  ...[['mensajes_profesor'], ['news'], ['reports'], ['events'], ['configuracion', 'moderacion']].map(nodo => ({
    ruta: [...nodo, '.read'], antes: 'auth != null', despues: `auth != null && ${SEGURIDAD.APROBADO}`,
  })),
  // Tamano y campos acotados en lo que cada persona escribe (chats, arriba, ya no
  // admite campos extra en los mensajes; parte de la version publicada en 166866a).
  { ruta: ['fcmTokens'], antesHuella: '791d502da6ce3f754c955ac48d41e5ce2a5425e0e20fd315909d610ca9fa3bd6', despues: SEGURIDAD.fcmTokens },
  { ruta: ['siguiendo'], antesHuella: '11bb30ea3ea35dcbddff92a28f2d084f19a434b1764c2b24103e9f6219db5db2', despues: SEGURIDAD.siguiendo },
  { ruta: ['personalTasks'], antesHuella: '791d502da6ce3f754c955ac48d41e5ce2a5425e0e20fd315909d610ca9fa3bd6', despues: SEGURIDAD.personalTasks },
  // roleRequests en produccion se edito en la consola (lectura de la rama para
  // admins); esta es la huella de esa version viva, comprobada el 2026-10-15.
  { ruta: ['roleRequests'], antesHuella: 'cd1079eb08cfccb801202daa0ef73d148044652d4161c5f4dc71d472711efd75', despues: SEGURIDAD.roleRequests },
  ...Object.entries(SEGURIDAD.soporteCampos).map(([campo, regla]) => ({
    ruta: ['soporte', '$ticketId', campo], antes: undefined, despues: regla,
  })),
];

function ordenado(value) {
  if (Array.isArray(value)) return value.map(ordenado);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => { acc[k] = ordenado(value[k]); return acc; }, {});
  }
  return value;
}
const iguales = (a, b) => JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b));
// La huella cubre solo los permisos: los .indexOn se gestionan aparte (INDICES)
// y su forma puede variar (texto o lista) sin que cambie ningun permiso.
const sinIndices = (v) => (Array.isArray(v) ? v.map(sinIndices) : (v && typeof v === 'object')
  ? Object.keys(v).filter(k => k !== '.indexOn').reduce((acc, k) => { acc[k] = sinIndices(v[k]); return acc; }, {})
  : v);
const huella = (valor) => crypto.createHash('sha256').update(JSON.stringify(ordenado(sinIndices(valor))) || '').digest('hex');
// El valor vivo es el que el parche espera encontrar (texto exacto, rama o huella).
const esElEsperado = (actual, p) => ('antesHuella' in p ? huella(actual) === p.antesHuella : iguales(actual, p.antes));

async function accessToken() {
  if (process.env.RULES_ACCESS_TOKEN) return process.env.RULES_ACCESS_TOKEN; // solo para el emulador
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.');
  return (await cert(JSON.parse(raw)).getAccessToken()).access_token;
}

async function leerReglas(endpoint, headers) {
  const res = await fetch(endpoint, { headers });
  if (!res.ok) throw new Error(`No se pudieron leer las reglas (HTTP ${res.status}).`);
  const texto = await res.text();
  try { return JSON.parse(texto); } catch { return null; }
}

function leerRuta(reglas, ruta) {
  return ruta.reduce((nodo, k) => (nodo && typeof nodo === 'object' ? nodo[k] : undefined), reglas.rules);
}

function escribirRuta(reglas, ruta, valor) {
  let nodo = reglas.rules;
  for (const k of ruta.slice(0, -1)) {
    if (!nodo[k] || typeof nodo[k] !== 'object') throw new Error(`La ruta ${ruta.join('/')} no existe en las reglas vivas.`);
    nodo = nodo[k];
  }
  nodo[ruta[ruta.length - 1]] = valor;
}

async function main() {
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  const endpoint = `${DATABASE_URL}/.settings/rules.json${NS}`;

  const vivas = await leerReglas(endpoint, headers);
  if (!vivas || typeof vivas.rules !== 'object') {
    console.log('::error::Las reglas publicadas contienen comentarios o no son JSON puro. No se tocan: aplica los cambios a mano desde la consola.');
    process.exitCode = 1;
    return;
  }

  const nuevas = JSON.parse(JSON.stringify(vivas));
  const cambios = [];

  // 1) Parches de permisos: todos o ninguno.
  for (const p of PARCHES) {
    const actual = leerRuta(vivas, p.ruta);
    if (iguales(actual, p.despues)) continue; // ya aplicado
    if (!esElEsperado(actual, p)) {
      console.log(`::error::La regla ${p.ruta.join('/')} de producción no es la esperada. No se aplica ningún cambio de permisos: revísala a mano en la consola.`);
      process.exitCode = 1;
      return;
    }
    escribirRuta(nuevas, p.ruta, p.despues);
    cambios.push(`permiso ${p.ruta.join('/')}`);
  }

  // 2) Indices.
  for (const [nodo, campos] of Object.entries(INDICES)) {
    const regla = nuevas.rules[nodo];
    if (!regla || typeof regla !== 'object') { console.log(`::warning::El nodo "${nodo}" no tiene reglas propias; se omite su índice.`); continue; }
    const actuales = Array.isArray(regla['.indexOn']) ? regla['.indexOn'] : (regla['.indexOn'] ? [regla['.indexOn']] : []);
    const union = [...new Set([...actuales, ...campos])];
    if (union.length !== actuales.length) { regla['.indexOn'] = union; cambios.push(`índice ${nodo}`); }
  }

  if (!cambios.length) {
    console.log('Las reglas ya estaban al día. Nada que hacer.');
    return;
  }

  const put = await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(nuevas, null, 2) });
  if (!put.ok) throw new Error(`La publicación falló (HTTP ${put.status}): ${await put.text()}`);

  // Verificacion: lo publicado debe ser exactamente lo esperado, ni mas ni menos.
  const despues = await leerReglas(endpoint, headers);
  if (!iguales(despues, nuevas)) {
    await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(vivas, null, 2) });
    console.log('::error::Lo publicado no coincidía con lo esperado. Se restauraron las reglas anteriores.');
    process.exitCode = 1;
    return;
  }
  console.log(`Reglas actualizadas (${cambios.join(' | ')}). Verificado: el resto de las reglas no cambió.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  });
}

module.exports = { PARCHES, INDICES, huella };
