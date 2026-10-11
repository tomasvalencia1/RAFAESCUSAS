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
const { cert } = require('firebase-admin/app');

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
];

function ordenado(value) {
  if (Array.isArray(value)) return value.map(ordenado);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, k) => { acc[k] = ordenado(value[k]); return acc; }, {});
  }
  return value;
}
const iguales = (a, b) => JSON.stringify(ordenado(a)) === JSON.stringify(ordenado(b));

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
    if (actual === p.despues) continue; // ya aplicado
    if (actual !== p.antes) {
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

module.exports = { PARCHES, INDICES };
