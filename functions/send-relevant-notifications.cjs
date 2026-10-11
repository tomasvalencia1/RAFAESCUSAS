/*
 * Despachador de notificaciones para GitHub Actions (respaldo periodico).
 *
 * El envio inmediato lo hace api/notificar.js en Vercel cuando alguien publica;
 * esta ejecucion recoge lo que hubiera quedado pendiente. La logica esta en
 * notificaciones-core.cjs y es la misma en ambos lados.
 *
 * El JSON de la cuenta de servicio existe solo en el secreto
 * FIREBASE_SERVICE_ACCOUNT, nunca en este repositorio.
 *
 * Modo de prueba: si se define PRUEBA_UID, envia UNA notificacion de prueba solo
 * a los dispositivos de esa cuenta y termina, sin tocar el estado del despachador.
 */
const { cert, initializeApp, deleteApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');
const { despacharConBloqueo, enviarPrueba } = require('./notificaciones-core.cjs');

const DATABASE_URL = 'https://rafaescusas-default-rtdb.firebaseio.com';

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    // Anotacion visible en el resumen de la ejecucion, sin marcarla como fallida.
    console.log('::error::Falta el secreto FIREBASE_SERVICE_ACCOUNT. Configúralo en GitHub > Settings > Secrets and variables > Actions.');
    return null;
  }
  try { return JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido.'); }
}

async function main() {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return;
  const app = initializeApp({ credential: cert(serviceAccount), databaseURL: DATABASE_URL });
  try {
    const db = getDatabase(app);
    const messaging = getMessaging(app);
    const testUid = (process.env.PRUEBA_UID || '').trim();
    if (testUid) {
      const r = await enviarPrueba(db, messaging, testUid);
      console.log(`Prueba: ${r.registrados} dispositivo(s) registrado(s), ${r.entregadas} entregada(s), ${r.fallidas || 0} con error, ${r.caducados || 0} token(s) caducado(s).`);
      if (r.motivo === 'id-invalido') { console.log('::error::PRUEBA_UID no es un ID de cuenta válido.'); process.exitCode = 1; }
      else if (r.motivo === 'sin-dispositivos') console.log('::warning::Esa cuenta no tiene ningún teléfono registrado. Abre la APK, inicia sesión y acepta el permiso de notificaciones; después repite la prueba.');
      else if (!r.ok) process.exitCode = 1;
      return;
    }
    const r = await despacharConBloqueo(db, messaging);
    if (r.estado === 'en-curso') console.log('Ya había un despacho en curso; se le pidió que repita al terminar.');
    else console.log(`Notificaciones terminadas: ${r.eventos} evento(s) nuevo(s), ${r.entregas} entrega(s), ${r.caducados} token(s) caducado(s) eliminado(s), ${r.cuentasConTelefono} cuenta(s) con teléfono registrado.${r.primeraVez ? ' (Primera ejecución: línea base fijada.)' : ''}`);
  } finally {
    // Cierra la conexion persistente de Realtime Database. Sin esto el proceso de
    // Node nunca termina y GitHub cancela el job al agotar el tiempo.
    await Promise.race([deleteApp(app), new Promise(resolve => setTimeout(resolve, 5000))]);
  }
}

main()
  .catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  // Salida explicita como red de seguridad ante cualquier conexion que quede abierta.
  .finally(() => process.exit(process.exitCode ?? 0));
