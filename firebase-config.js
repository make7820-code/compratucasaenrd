// Importa los SDKs necesarios de Firebase desde su CDN oficial
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// Tus credenciales reales de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDJjporsjk6QnY5HaHAU-8QfeCJvDsayyc",
  authDomain: "compratucasaenrd-11e1a.firebaseapp.com",
  projectId: "compratucasaenrd-11e1a",
  storageBucket: "compratucasaenrd-11e1a.firebasestorage.app",
  messagingSenderId: "991077320424",
  appId: "1:991077320424:web:9acb43c5b31875332eab5d",
  measurementId: "G-L662JQL7RS"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); // <-- Añadido para inicializar el módulo de autenticación
const db = getFirestore(app);
const storage = getStorage(app);

// Exportar todas las herramientas incluyendo 'auth'
export { auth, db, storage, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, ref, uploadBytes, getDownloadURL };