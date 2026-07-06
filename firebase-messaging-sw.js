// Scripts para Firebase Messaging en segundo plano
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAeUsf3QGFT3_J-k_KmvdJk61AMSiizOvI",
  authDomain: "rafaescusas.firebaseapp.com",
  databaseURL: "https://rafaescusas-default-rtdb.firebaseio.com",
  projectId: "rafaescusas",
  storageBucket: "rafaescusas.firebasestorage.app",
  messagingSenderId: "134452511415",
  appId: "1:134452511415:web:9213173d006f95c0048332",
  measurementId: "G-L4E0J0SGX8"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano: ', payload);
  
  const notificationTitle = payload.notification?.title || 'Nueva Notificación';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes contenido nuevo.',
    icon: '/logo.png' // Icono de tu app
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
