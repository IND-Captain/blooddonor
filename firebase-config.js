// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// TODO: Add your own Firebase configuration from your project settings
const firebaseConfig = {
  apiKey: "AIzaSyCoYWblGtpZPpOyCchhgfWzaSOxX8izw04",
  authDomain: "oasis-4761b.firebaseapp.com",
  projectId: "oasis-4761b",
  storageBucket: "oasis-4761b.firebasestorage.app",
  messagingSenderId: "1016563423327",
  appId: "1:1016563423327:web:9fe8433f974104a4c623ea",
  measurementId: "G-Q05E389JB6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);