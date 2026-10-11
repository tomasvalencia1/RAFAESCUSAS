/*
 * Adaptadores sin dependencias para usar notificaciones-core.cjs desde Vercel.
 *
 * Se usan las API REST de Google con los modulos nativos de Node (fetch, crypto)
 * en lugar de firebase-admin, para no anadir un package.json en la raiz del
 * proyecto: eso cambiaria como Vercel construye la web estatica.
 *
 *   crearBaseDeDatosRest   -> la interfaz de firebase-admin/database que usa el nucleo
 *   crearMensajeriaFcm     -> sendEachForMulticast sobre FCM HTTP v1
 *   creadorDeToken         -> token OAuth2 de la cuenta de servicio (JWT RS256)
 *   verificarUsuario       -> uid de un ID token de Firebase Auth, o null
 */
const crypto = require('crypto');

const SCOPES = [
  'https://www.googleapis.com/auth/firebase.database',
  'https://www.googleapis.com/auth/firebase.messaging',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const b64url = (input) => Buffer.from(input).toString('base64').replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// Devuelve una funcion que entrega un token OAuth2 valido, reutilizandolo
// mientras no caduque (las instancias calientes de Vercel lo aprovechan).
function creadorDeToken(serviceAccount, fetchImpl = fetch) {
  let cache = null;
  return async function obtenerToken() {
    if (cache && cache.expira - Date.now() > 60 * 1000) return cache.token;
    const ahora = Math.floor(Date.now() / 1000);
    const cabecera = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const reclamo = b64url(JSON.stringify({
      iss: serviceAccount.client_email, scope: SCOPES,
      aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600,
    }));
    const firma = crypto.sign('RSA-SHA256', Buffer.from(`${cabecera}.${reclamo}`), serviceAccount.private_key);
    const res = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${cabecera}.${reclamo}.${b64url(firma)}`,
      }),
    });
    const datos = await res.json().catch(() => ({}));
    if (!res.ok || !datos.access_token) throw new Error(`No se obtuvo token de la cuenta de servicio (HTTP ${res.status}).`);
    cache = { token: datos.access_token, expira: Date.now() + Number(datos.expires_in || 3600) * 1000 };
    return cache.token;
  };
}

// uid del usuario si el ID token es valido; null en cualquier otro caso.
async function verificarUsuario(idToken, apiKey, fetchImpl = fetch) {
  if (!idToken || typeof idToken !== 'string' || idToken.length > 4096) return null;
  try {
    const res = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const datos = await res.json();
    return datos?.users?.[0]?.localId || null;
  } catch { return null; }
}

function instantanea(valor) {
  return { val: () => (valor === undefined ? null : valor), exists: () => valor !== null && valor !== undefined };
}

// Interfaz minima de firebase-admin/database sobre la API REST.
// `obtenerToken` da el token de acceso; `ns` solo se usa con el emulador.
function crearBaseDeDatosRest({ databaseURL, obtenerToken, ns = '', fetchImpl = fetch }) {
  const base = databaseURL.replace(/\/+$/, '');

  async function url(path, params = {}) {
    const q = new URLSearchParams({ access_token: await obtenerToken(), ...params });
    if (ns) q.set('ns', ns);
    const ruta = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
    return `${base}/${ruta}.json?${q}`;
  }

  async function pedir(path, opciones = {}, params = {}) {
    const res = await fetchImpl(await url(path, params), opciones);
    const texto = await res.text();
    if (!res.ok) throw new Error(`Realtime Database respondió HTTP ${res.status} en "${path}": ${texto.slice(0, 200)}`);
    return { res, datos: texto ? JSON.parse(texto) : null };
  }

  const consulta = (path, params) => ({
    once: async () => instantanea((await pedir(path, {}, params)).datos),
  });

  function ref(path = '') {
    return {
      once: async () => instantanea((await pedir(path)).datos),
      orderByChild: (campo) => ({ startAt: (valor) => consulta(path, { orderBy: JSON.stringify(campo), startAt: JSON.stringify(valor) }) }),
      orderByKey: () => ({ startAt: (clave) => consulta(path, { orderBy: JSON.stringify('$key'), startAt: JSON.stringify(String(clave)) }) }),
      update: async (cambios) => {
        if (!cambios || !Object.keys(cambios).length) return;
        await pedir(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios) });
      },
      set: async (valor) => { await pedir(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valor) }); },
      remove: async () => { await pedir(path, { method: 'DELETE' }); },
      // Transaccion optimista con ETag: si otro la modifica entre medias, se reintenta.
      transaction: async (fn) => {
        for (let intento = 0; intento < 5; intento += 1) {
          const actual = await fetchImpl(await url(path), { headers: { 'X-Firebase-ETag': 'true' } });
          if (!actual.ok) throw new Error(`Realtime Database respondió HTTP ${actual.status} en "${path}".`);
          const etag = actual.headers.get('etag');
          const valor = JSON.parse((await actual.text()) || 'null');
          const nuevo = fn(valor);
          if (nuevo === undefined) return { committed: false, snapshot: instantanea(valor) };
          const escritura = await fetchImpl(await url(path), {
            method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(nuevo),
          });
          if (escritura.ok) return { committed: true, snapshot: instantanea(nuevo) };
          if (escritura.status !== 412) throw new Error(`Realtime Database respondió HTTP ${escritura.status} en "${path}".`);
        }
        return { committed: false, snapshot: instantanea(null) };
      },
    };
  }

  return { ref };
}

// sendEachForMulticast de firebase-admin, sobre FCM HTTP v1 (un envio por token).
function crearMensajeriaFcm({ projectId, obtenerToken, fetchImpl = fetch, paralelo = 50 }) {
  const endpoint = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;

  function traducir(mensaje, token) {
    const a = mensaje.android || {};
    return {
      message: {
        token,
        notification: mensaje.notification,
        data: mensaje.data,
        android: {
          priority: String(a.priority || 'high').toUpperCase(),
          notification: { channel_id: a.notification?.channelId, sound: a.notification?.sound },
        },
        webpush: mensaje.webpush ? {
          notification: mensaje.webpush.notification,
          fcm_options: { link: mensaje.webpush.fcmOptions?.link },
        } : undefined,
      },
    };
  }

  // Traduce los errores de FCM v1 a los codigos de firebase-admin que usa el nucleo.
  function codigoDeError(status, cuerpo) {
    const err = cuerpo?.error || {};
    const detalle = (err.details || []).map(d => d.errorCode).filter(Boolean)[0] || '';
    if (detalle === 'UNREGISTERED' || status === 404) return 'messaging/registration-token-not-registered';
    if (status === 400 && /registration token/i.test(err.message || '')) return 'messaging/invalid-registration-token';
    return `fcm/${detalle || err.status || status}`;
  }

  async function enviarUno(mensaje, token, accessToken) {
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(traducir(mensaje, token)),
      });
      if (res.ok) return { success: true };
      const cuerpo = await res.json().catch(() => ({}));
      return { success: false, error: { code: codigoDeError(res.status, cuerpo), message: cuerpo?.error?.message || '' } };
    } catch (error) {
      return { success: false, error: { code: 'fcm/red', message: error.message } };
    }
  }

  return {
    async sendEachForMulticast(mensaje) {
      const accessToken = await obtenerToken();
      const respuestas = new Array(mensaje.tokens.length);
      for (let i = 0; i < mensaje.tokens.length; i += paralelo) {
        const lote = mensaje.tokens.slice(i, i + paralelo);
        const r = await Promise.all(lote.map(t => enviarUno(mensaje, t, accessToken)));
        r.forEach((x, j) => { respuestas[i + j] = x; });
      }
      return { responses: respuestas };
    },
  };
}

module.exports = { creadorDeToken, verificarUsuario, crearBaseDeDatosRest, crearMensajeriaFcm };
