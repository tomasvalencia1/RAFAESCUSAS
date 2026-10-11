/*
 * Asegura los indices (.indexOn) que necesita el despachador de notificaciones
 * en la Realtime Database de produccion, usando la cuenta de servicio del
 * secreto FIREBASE_SERVICE_ACCOUNT.
 *
 * No publica database.rules.json: las reglas de produccion se editan tambien
 * desde la consola y pueden haber cambiado. Toma las reglas VIVAS, les anade
 * solo los indices y, tras publicar, verifica que todos los permisos siguen
 * identicos. Si algo no cuadra, no toca nada y el job falla.
 */
const { cert } = require('firebase-admin/app');

const DATABASE_URL = process.env.RULES_DATABASE_URL || 'https://rafaescusas-default-rtdb.firebaseio.com';
const NS = process.env.RULES_NS ? `?ns=${encodeURIComponent(process.env.RULES_NS)}` : '';

// Indices que usan las consultas de functions/send-relevant-notifications.cjs
const INDICES = {
  posts: ['createdAt', 'timestamp'],
  chats: ['lastTimestamp'],
  news: ['timestamp'],
  events: ['timestamp'],
  soporte: ['timestamp'],
};

// Copia sin ningun .indexOn y con las claves ordenadas, para comparar permisos.
function sinIndices(value) {
  if (Array.isArray(value)) return value.map(sinIndices);
  if (value && typeof value === 'object') {
    return Object.keys(value).filter(k => k !== '.indexOn').sort()
      .reduce((acc, k) => { acc[k] = sinIndices(value[k]); return acc; }, {});
  }
  return value;
}

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

async function main() {
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  const endpoint = `${DATABASE_URL}/.settings/rules.json${NS}`;

  const vivas = await leerReglas(endpoint, headers);
  if (!vivas || typeof vivas.rules !== 'object') {
    console.log('::error::Las reglas publicadas contienen comentarios o no son JSON puro. No se tocan: añade los índices a mano desde la consola.');
    process.exitCode = 1;
    return;
  }

  const nuevas = JSON.parse(JSON.stringify(vivas));
  const anadidos = [];
  for (const [nodo, campos] of Object.entries(INDICES)) {
    const regla = nuevas.rules[nodo];
    if (!regla || typeof regla !== 'object') { console.log(`::warning::El nodo "${nodo}" no tiene reglas propias; se omite su índice.`); continue; }
    const actuales = Array.isArray(regla['.indexOn']) ? regla['.indexOn'] : (regla['.indexOn'] ? [regla['.indexOn']] : []);
    const union = [...new Set([...actuales, ...campos])];
    if (union.length !== actuales.length) { regla['.indexOn'] = union; anadidos.push(`${nodo}: ${union.join(', ')}`); }
  }

  if (!anadidos.length) {
    console.log('Los índices ya estaban publicados. Nada que hacer.');
    return;
  }

  const put = await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(nuevas, null, 2) });
  if (!put.ok) throw new Error(`La publicación falló (HTTP ${put.status}): ${await put.text()}`);

  // Verificacion: los permisos publicados deben ser exactamente los de antes.
  const despues = await leerReglas(endpoint, headers);
  if (JSON.stringify(sinIndices(despues)) !== JSON.stringify(sinIndices(vivas))) {
    // Restaura las reglas originales tal cual estaban.
    await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(vivas, null, 2) });
    console.log('::error::Tras publicar, los permisos no coincidían con los originales. Se restauraron las reglas anteriores.');
    process.exitCode = 1;
    return;
  }
  console.log(`Índices publicados (${anadidos.join(' | ')}). Permisos verificados: idénticos a los anteriores.`);
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
