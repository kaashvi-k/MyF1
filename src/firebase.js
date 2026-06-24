import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAavGJxy4qVrRiGesBPhbqdk8GJEVNGBcU",
  authDomain: "myf1-e46f1.firebaseapp.com",
  projectId: "myf1-e46f1",
  storageBucket: "myf1-e46f1.firebasestorage.app",
  messagingSenderId: "495745229566",
  appId: "1:495745229566:web:c2b097ebcafee0a8e3fbaf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);