// Importa los SDKs necesarios de Firebase desde su CDN oficial[cite: 6]
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";[cite: 6]
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";[cite: 6]
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";[cite: 6]
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";[cite: 6]

// Tus credenciales limpias[cite: 6]
const firebaseConfig = {
  apiKey: "AIzaSyDJjporsjk6QnY5HaHAU-8QfeCJvDsayyc",[cite: 6]
  authDomain: "compratucasaenrd-11e1a.firebaseapp.com",[cite: 6]
  projectId: "compratucasaenrd-11e1a",[cite: 6]
  storageBucket: "compratucasaenrd-11e1a.firebasestorage.app",[cite: 6]
  messagingSenderId: "991077320424",[cite: 6]
  appId: "1:991077320424:web:9acb43c5b31875332eab5d"[cite: 6]
};

// Inicializar Firebase[cite: 6]
const app = initializeApp(firebaseConfig);[cite: 6]
const auth = getAuth(app);[cite: 6]
const db = getFirestore(app);[cite: 6]
const storage = getStorage(app);[cite: 6]

// Exportar todas las herramientas incluyendo 'onSnapshot'[cite: 6]
export { auth, db, storage, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, onSnapshot, ref, uploadBytes, getDownloadURL };[cite: 6]
