/*
 * POST /api/notificar — envio inmediato de notificaciones (funcion de Vercel).
 *
 * La app la llama justo despues de publicar un mensaje, noticia, evento, aviso,
 * publicacion o solicitud de soporte. Solo procesa eventos que ya existen en la
 * base de datos, con la misma logica que el respaldo de GitHub Actions
 * (functions/notificaciones-core.cjs): no se puede usar para inventar avisos.
 *
 * Requiere una sesion valida de Firebase (cabecera Authorization: Bearer <ID token>).
 * Con { "prueba": true } en el cuerpo envia una notificacion de prueba SOLO a los
 * dispositivos de quien la pide.
 *
 * Configuracion: variable de entorno FIREBASE_SERVICE_ACCOUNT en Vercel con el
 * JSON de la cuenta de servicio. Sin ella responde 503 y la app sigue igual.
 */
const { cuentaConAcceso, despacharConBloqueo, enviarPrueba } = require('../functions/notificaciones-core.cjs');
const { creadorDeToken, verificarUsuario, crearBaseDeDatosRest, crearMensajeriaFcm } = require('../functions/adaptadores-rest.cjs');

const DATABASE_URL = 'https://rafaescusas-default-rtdb.firebaseio.com';
// Clave web publica de Firebase: la misma que ya va en app.js (no es un secreto).
const WEB_API_KEY = 'AIzaSyAeUsf3QGFT3_J-k_KmvdJk61AMSiizOvI';

let contexto = null; // se reutiliza entre invocaciones en una instancia caliente

function prepararContexto() {
  if (contexto) return contexto;
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const obtenerToken = creadorDeToken(serviceAccount);
  contexto = {
    db: crearBaseDeDatosRest({ databaseURL: DATABASE_URL, obtenerToken }),
    messaging: crearMensajeriaFcm({ projectId: serviceAccount.project_id, obtenerToken }),
  };
  return contexto;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    return res.status(503).json({ error: 'Las notificaciones no están configuradas en el servidor.' });
  }

  const idToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const uid = await verificarUsuario(idToken, WEB_API_KEY);
  if (!uid) return res.status(401).json({ error: 'Sesión no válida.' });

  try {
    const { db, messaging } = prepararContexto();
    const cuerpo = req.body && typeof req.body === 'object' ? req.body : {};
    if (cuerpo.prueba === true) return res.status(200).json(await enviarPrueba(db, messaging, uid));
    if (!(await cuentaConAcceso(db, uid))) return res.status(403).json({ error: 'Cuenta pendiente de aprobación.' });
    return res.status(200).json(await despacharConBloqueo(db, messaging));
  } catch (error) {
    console.error('Despacho de notificaciones fallido:', error);
    return res.status(500).json({ error: 'No se pudieron procesar las notificaciones.' });
  }
};
