/*
 * Publica database.rules.json en la Realtime Database de produccion usando la
 * cuenta de servicio del secreto FIREBASE_SERVICE_ACCOUNT.
 *
 * Proteccion: antes de publicar compara con las reglas que hay AHORA en
 * produccion. Solo publica si, ignorando los .indexOn, son identicas a las del
 * repositorio. Si alguien cambio las reglas desde la consola de Firebase, no se
 * sobrescriben: el job falla y muestra que nodos difieren.
 */
const { cert } = require('firebase-admin/app');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.RULES_DATABASE_URL || 'https://rafaescusas-default-rtdb.firebaseio.com';
const NS = process.env.RULES_NS ? `?ns=${encodeURIComponent(process.env.RULES_NS)}` : '';
const RULES_FILE = path.join(__dirname, '..', 'database.rules.json');

// Copia sin ningun .indexOn y con las claves ordenadas, para comparar contenido.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.keys(value).filter(k => k !== '.indexOn').sort()
      .reduce((acc, k) => { acc[k] = canonical(value[k]); return acc; }, {});
  }
  return value;
}

function sameIncludingIndexes(a, b) {
  const sorted = v => Array.isArray(v) ? v.map(sorted)
    : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => { o[k] = sorted(v[k]); return o; }, {}) : v;
  return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
}

async function accessToken() {
  if (process.env.RULES_ACCESS_TOKEN) return process.env.RULES_ACCESS_TOKEN; // solo para el emulador
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.');
  return (await cert(JSON.parse(raw)).getAccessToken()).access_token;
}

async function main() {
  const repoText = fs.readFileSync(RULES_FILE, 'utf8');
  const repo = JSON.parse(repoText);
  const headers = { Authorization: `Bearer ${await accessToken()}` };
  const endpoint = `${DATABASE_URL}/.settings/rules.json${NS}`;

  const current = await fetch(endpoint, { headers });
  if (!current.ok) throw new Error(`No se pudieron leer las reglas actuales (HTTP ${current.status}).`);
  const currentText = await current.text();
  let live;
  try { live = JSON.parse(currentText); } catch {
    console.log('::error::Las reglas publicadas contienen comentarios o no son JSON puro. No se sobrescriben: publica database.rules.json a mano desde la consola.');
    process.exitCode = 1;
    return;
  }

  if (sameIncludingIndexes(live, repo)) {
    console.log('Las reglas de producción ya coinciden con database.rules.json. Nada que publicar.');
    return;
  }

  if (JSON.stringify(canonical(live)) !== JSON.stringify(canonical(repo))) {
    const a = canonical(live).rules || {};
    const b = canonical(repo).rules || {};
    const nodes = [...new Set([...Object.keys(a), ...Object.keys(b)])]
      .filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    console.log(`::error::Las reglas de producción no coinciden con las del repositorio (nodos: ${nodes.join(', ') || 'raíz'}). No se sobrescriben. Alguien las cambió desde la consola: sincroniza database.rules.json antes de publicar.`);
    process.exitCode = 1;
    return;
  }

  const put = await fetch(endpoint, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: repoText });
  if (!put.ok) throw new Error(`La publicación falló (HTTP ${put.status}): ${await put.text()}`);
  console.log('Reglas publicadas: solo cambian los índices (.indexOn); los permisos son idénticos a los de producción.');
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
