// Busca la marca de agua personal del agente que publicó una propiedad.
// Devuelve la URL (string) o null. Si devuelve null, marca-agua.js usa la de la empresa.
import { db, doc, getDoc } from './firebase-config.js';

const ROLES_CON_MARCA = ['agente', 'agentepro'];
const cache = {};

export async function obtenerMarcaAgente(uid) {
  if (!uid) return null;
  if (uid in cache) return cache[uid];
  let url = null;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    if (snap.exists()) {
      const d = snap.data();
      const rol = String(d.rol || '').toLowerCase();
      if (ROLES_CON_MARCA.includes(rol) && typeof d.marcaAgua === 'string' && d.marcaAgua.trim()) {
        url = d.marcaAgua.trim();
      }
    }
  } catch (e) {
    console.warn('No se pudo leer la marca de agua del agente:', e);
  }
  cache[uid] = url;
  return url;
}
