const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueCreated } = require('firebase-functions/v2/database');
const { logger } = require('firebase-functions');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

initializeApp();

const STUDENT_POST_TTL_MS = 24 * 60 * 60 * 1000;

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Permanently deletes expired student posts (and their nested comments/likes)
 * every hour. The client already hides them immediately; this is the cleanup.
 */
exports.cleanupExpiredStudentPosts = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'America/Bogota', region: 'us-central1' },
  async () => {
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

    if (Object.keys(updates).length) {
      await postsRef.update(updates);
      logger.info(`Removed ${Object.keys(updates).length} expired student posts.`);
    }
  }
);

/**
 * RTDB rules can hard-cap the three numbered slots, but cannot split strings
 * into words. This defensive server-side validation removes malformed or
 * overlong teacher announcements made outside the official client.
 */
exports.enforceTeacherMessagePolicy = onValueCreated(
  { ref: '/mensajes_profesor/{day}/{teacherId}/{slot}', region: 'us-central1' },
  async (event) => {
    const message = event.data.val() || {};
    const { day, teacherId, slot } = event.params;
    const roleSnapshot = await getDatabase().ref(`users/${teacherId}/role`).once('value');
    const isValid = ['profesor', 'maestro'].includes(roleSnapshot.val())
      && ['1', '2', '3'].includes(String(slot))
      && message.autorId === teacherId
      && message.dia === day
      && typeof message.texto === 'string'
      && wordCount(message.texto) <= 15;

    if (!isValid) {
      logger.warn('Removed an invalid teacher announcement.', { teacherId, day, slot });
      await event.data.ref.remove();
    }
  }
);
