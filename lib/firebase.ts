import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

function initFirebase() {
  if (getApps().length > 0) return;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase env vars not set');
  }

  privateKey = privateKey.replace(/\\n/g, '\n');

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export function getFirebaseMessaging() {
  initFirebase();
  return getMessaging();
}