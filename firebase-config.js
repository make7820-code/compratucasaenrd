// Importa los SDKs necesarios de Firebase desde su CDN oficial[cite: 3]
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";[cite: 3]
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";[cite: 3]
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";[cite: 3]
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";[cite: 3]

// Tus credenciales limpias sin el measurementId problemático
const firebaseConfig = {
  apiKey: "AIzaSyDJjporsjk6QnY5HaHAU-8QfeCJvDsayyc",
  authDomain: "compratucasaenrd-11e1a.firebaseapp.com",
  projectId: "compratucasaenrd-11e1a",
  storageBucket: "compratucasaenrd-11e1a.firebasestorage.app",
  messagingSenderId: "991077320424",
  appId: "1:991077320424:web:9acb43c5b31875332eab5d"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 
const db = getFirestore(app);
const storage = getStorage(app);

// Exportar todas las herramientas incluyendo 'auth'[cite: 3]
export { auth, db, storage, collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, ref, uploadBytes, getDownloadURL };[cite: 3]
