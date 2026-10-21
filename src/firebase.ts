import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Web config is public by design; access is protected by Firestore security rules.
const firebaseConfig = {
  apiKey: 'AIzaSyAY5EMIL1QKs46N8AX9D5OMYc0l-Mbq6TE',
  authDomain: 'bothaina-9f4b4.firebaseapp.com',
  projectId: 'bothaina-9f4b4',
  storageBucket: 'bothaina-9f4b4.firebasestorage.app',
  messagingSenderId: '162845559523',
  appId: '1:162845559523:web:bcdc797d9406a8c3d093d6',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Everything is cached on the phone, so the app works offline and syncs later.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
