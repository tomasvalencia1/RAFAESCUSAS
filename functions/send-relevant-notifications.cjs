/*
 * Free notification dispatcher for GitHub Actions.
 *
 * It reads RTDB with Firebase Admin, sends FCM notifications, and records the
 * event IDs already dispatched. The service-account JSON exists only in the
 * FIREBASE_SERVICE_ACCOUNT GitHub Actions secret — never in this repository.
 */
const { cert, initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { getMessaging } = require('firebase-admin/messaging');

const DATABASE_URL = 'https://rafaescusas-default-rtdb.firebaseio.com';
const STATE_PATH = 'notificacionesSistema/despachador';
const MAX_SENT_AGE_MS = 35 * 24 * 60 * 60 * 1000;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT.');
  try { return JSON.parse(raw); } catch { throw new Error('FIREBASE_SERVICE_ACCOUNT no contiene un JSON válido.'); }
}

function safeKey(value) {
  return String(value || '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 700);
}

function asEntries(value) {
  return Object.entries(value || {});
}

function flattenTeacherMessages(root) {
  const items = [];
  for (const [day, byTeacher] of asEntries(root)) {
    for (const [teacherId, slots] of asEntries(byTeacher)) {
      for (const [slot, message] of asEntries(slots)) {
        items.push({ id: `${day}_${teacherId}_${slot}`, value: message || {} });
      }
    }
  }
  return items;
}

function flattenChatMessages(chats) {
  const items = [];
  for (const [chatId, chat] of asEntries(chats)) {
    for (const [messageId, message] of asEntries(chat?.messages)) {
      items.push({ id: `${chatId}_${messageId}`, chat: chat || {}, value: message || {} });
    }
  }
  return items;
}

function tokenEntriesForUsers(tokensByUser, userIds) {
  const entries = [];
  for (const uid of new Set(userIds.filter(Boolean))) {
    for (const [tokenKey, token] of asEntries(tokensByUser?.[uid])) {
      if (typeof token === 'string' && token) entries.push({ uid, tokenKey, token });
    }
  }
  return entries;
}

async function sendToUsers({ tokensByUser, userIds, title, body, type, entityId }) {
  const entries = tokenEntriesForUsers(tokensByUser, userIds);
  if (!entries.length) return { delivered: 0, invalid: [] };

  const invalid = [];
  let delivered = 0;
  for (let start = 0; start < entries.length; start += 500) {
    const batch = entries.slice(start, start + 500);
    const response = await getMessaging().sendEachForMulticast({
      tokens: batch.map(item => item.token),
      notification: { title, body },
      data: { type, entityId: String(entityId || '') },
      android: {
        priority: 'high',
        notification: { channelId: 'rafa_importante', sound: 'default' }
      },
      webpush: {
        notification: { icon: '/logo.png', badge: '/logo.png' },
        fcmOptions: { link: 'https://rafaexcusas.vercel.app/' }
      }
    });

    response.responses.forEach((result, index) => {
      if (result.success) { delivered += 1; return; }
      const code = result.error?.code || '';
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        invalid.push(batch[index]);
      } else {
        console.warn(`FCM no entregó una notificación (${code || 'error desconocido'}).`);
      }
    });
  }
  return { delivered, invalid };
}

async function dispatchNotifications() {
  initializeApp({ credential: cert(getServiceAccount()), databaseURL: DATABASE_URL });
  const db = getDatabase();
  const runStartedAt = Date.now();
  const [stateSnap, tokensSnap, usersSnap, followingSnap, chatsSnap, newsSnap, eventsSnap, teacherSnap, postsSnap, supportSnap] = await Promise.all([
    db.ref(STATE_PATH).once('value'),
    db.ref('fcmTokens').once('value'),
    db.ref('users').once('value'),
    db.ref('siguiendo').once('value'),
    db.ref('chats').once('value'),
    db.ref('news').once('value'),
    db.ref('events').once('value'),
    db.ref('mensajes_profesor').once('value'),
    db.ref('posts').once('value'),
    db.ref('soporte').once('value')
  ]);

  const state = stateSnap.val() || {};
  const lastProcessedAt = Number(state.lastProcessedAt || 0);
  const tokensByUser = tokensSnap.val() || {};
  const users = usersSnap.val() || {};
  const following = followingSnap.val() || {};
  const sent = state.sent || {};
  const updates = {};
  const invalidTokens = [];
  let delivered = 0;

  // On the first execution, establish a baseline instead of flooding every
  // installed device with historical chats and posts.
  if (!lastProcessedAt) {
    updates[`${STATE_PATH}/lastProcessedAt`] = runStartedAt;
    updates[`${STATE_PATH}/initializedAt`] = runStartedAt;
    await db.ref().update(updates);
    console.log('Notificaciones inicializadas. Los eventos anteriores no se enviaron.');
    return;
  }

  const processEvent = async ({ eventId, timestamp, targets, title, body, type, entityId }) => {
    if (!timestamp || timestamp <= lastProcessedAt || sent[eventId]) return;
    const response = await sendToUsers({ tokensByUser, userIds: targets, title, body, type, entityId });
    delivered += response.delivered;
    invalidTokens.push(...response.invalid);
    updates[`${STATE_PATH}/sent/${eventId}`] = timestamp;
  };

  for (const item of flattenChatMessages(chatsSnap.val())) {
    const message = item.value;
    const senderId = message.senderId || message.sender || message.uid || '';
    const targets = asEntries(item.chat.participants).filter(([, active]) => active === true).map(([uid]) => uid).filter(uid => uid !== senderId);
    await processEvent({
      eventId: safeKey(`chat_${item.id}`), timestamp: Number(message.timestamp || 0), targets,
      title: `Mensaje de ${message.senderName || 'RafaConecta'}`,
      body: 'Tienes un nuevo mensaje en el chat institucional.', type: 'chat', entityId: item.id
    });
  }

  const allUsers = Object.keys(users);
  for (const [id, item] of asEntries(newsSnap.val())) {
    await processEvent({ eventId: safeKey(`news_${id}`), timestamp: Number(item?.timestamp || 0), targets: allUsers,
      title: 'Nueva noticia institucional', body: String(item?.title || 'Hay una nueva noticia para ti.').slice(0, 120), type: 'news', entityId: id });
  }
  for (const [id, item] of asEntries(eventsSnap.val())) {
    await processEvent({ eventId: safeKey(`event_${id}`), timestamp: Number(item?.timestamp || 0), targets: allUsers,
      title: 'Nuevo evento institucional', body: String(item?.title || 'Hay un evento nuevo.').slice(0, 120), type: 'event', entityId: id });
  }
  for (const item of flattenTeacherMessages(teacherSnap.val())) {
    const message = item.value;
    await processEvent({ eventId: safeKey(`teacher_${item.id}`), timestamp: Number(message.timestamp || 0), targets: allUsers.filter(uid => uid !== message.autorId),
      title: `Anuncio de ${message.autorNombre || 'profesorado'}`, body: String(message.texto || 'Hay un nuevo anuncio.').slice(0, 120), type: 'teacher_message', entityId: item.id });
  }
  for (const [id, post] of asEntries(postsSnap.val())) {
    const authorId = post?.author?.uid || post?.autorId || '';
    const followers = asEntries(following).filter(([, list]) => Boolean(list?.[authorId])).map(([uid]) => uid);
    await processEvent({ eventId: safeKey(`post_${id}`), timestamp: Number(post?.createdAt || post?.timestamp || 0), targets: followers,
      title: `Nueva publicación de ${post?.author?.name || post?.autorNombre || 'una persona que sigues'}`,
      body: 'Hay una publicación nueva en RafaConecta.', type: 'post', entityId: id });
  }
  const directivos = asEntries(users).filter(([, user]) => user?.role === 'directivo').map(([uid]) => uid);
  for (const [id, ticket] of asEntries(supportSnap.val())) {
    await processEvent({ eventId: safeKey(`support_${id}`), timestamp: Number(ticket?.timestamp || 0), targets: directivos.filter(uid => uid !== ticket.userId),
      title: 'Nueva solicitud de soporte', body: 'Una persona necesita ayuda en RafaConecta.', type: 'support', entityId: id });
  }

  updates[`${STATE_PATH}/lastProcessedAt`] = runStartedAt;
  for (const [eventId, sentAt] of asEntries(sent)) {
    if (Number(sentAt) < runStartedAt - MAX_SENT_AGE_MS) updates[`${STATE_PATH}/sent/${eventId}`] = null;
  }
  for (const entry of invalidTokens) updates[`fcmTokens/${entry.uid}/${entry.tokenKey}`] = null;
  await db.ref().update(updates);
  console.log(`Notificaciones terminadas: ${delivered} entrega(s), ${invalidTokens.length} token(es) inválido(s) eliminado(s).`);
}

dispatchNotifications().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
