importScripts(
  "https://www.gstatic.com/firebasejs/12.15.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging-compat.js"
);

const firebaseConfig = {
  apiKey: "AIzaSyAavGJxy4qVrRiGesBPhbqdk8GJEVNGBcU",
  authDomain: "myf1-e46f1.firebaseapp.com",
  projectId: "myf1-e46f1",
  storageBucket: "myf1-e46f1.firebasestorage.app",
  messagingSenderId: "495745229566",
  appId: "1:495745229566:web:c2b097ebcafee0a8e3fbaf",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("Background message received:", payload);

  const notificationTitle =
    payload.notification?.title || "MyF1";

  const notificationOptions = {
    body: payload.notification?.body || "",
    icon: "/favicon.ico",
  };

  self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});