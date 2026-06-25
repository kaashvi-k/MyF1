importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAavGJxy4qVrRiGesBPhbqdk8GJEVNGBcU",
  authDomain: "myf1-e46f1.firebaseapp.com",
  projectId: "myf1-e46f1",
  storageBucket: "myf1-e46f1.firebasestorage.app",
  messagingSenderId: "495745229566",
  appId: "1:495745229566:web:c2b097ebcafee0a8e3fbaf"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
  });
});