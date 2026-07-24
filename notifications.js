import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('authContainer');
  if (!authContainer) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) return; // Si no hay sesión, se queda el botón de "Iniciar sesión" por defecto

    let displayName = user.email.split('@')[0];
    let avatarSrc = 'assets/onlybladi-avatar.png';

    // Opcional: Cargar datos adicionales del perfil si existen
    try {
      const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      const docSnap = await getDoc(doc(db, "usuarios", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.nombres) displayName = data.nombres;
        if (data.fotoPerfil) avatarSrc = data.fotoPerfil;
      }
    } catch (e) {
      console.error("Error al cargar perfil en navbar:", e);
    }

    // Escuchar mensajes en tiempo real para las notificaciones globales
    const q = query(collection(db, "mensajes"), where("userId", "==", user.uid));
    
    onSnapshot(q, (snapshot) => {
      const conversationsMap = new Map();
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const propId = data.propertyId || 'general';
        const timeA = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;
        
        if (!conversationsMap.has(propId)) {
          conversationsMap.set(propId, {
            propertyId: propId,
            propertyTitle: data.propertyTitle || 'Consulta Inmobiliaria',
            propertyImage: data.propertyImage || 'assets/puerto-marina.png',
            lastMessage: data.mensaje || data.text || '',
            sender: data.sender || 'user',
            timestamp: timeA
          });
        } else {
          const existing = conversationsMap.get(propId);
          if (timeA >= existing.timestamp) {
            existing.lastMessage = data.mensaje || data.text || '';
            existing.sender = data.sender || 'user';
            existing.timestamp = timeA;
          }
        }
      });

      const convs = Array.from(conversationsMap.values());
      // Consideramos no leídos aquellos donde el último mensaje NO sea del usuario ('user')
      const unreadConvs = convs.filter(c => c.sender && c.sender !== 'user');
      
      renderGlobalNavbar(authContainer, user.uid, displayName, avatarSrc, unreadConvs);
    });
  });
});

function renderGlobalNavbar(container, userId, displayName, avatarSrc, unreadConvs) {
  const hasUnread = unreadConvs.length > 0;

  container.innerHTML = `
    <div style="position: relative; display: inline-block;">
      <button id="notificationBellBtn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 6px; position: relative;">
        <span id="bellIconSpan" class="${hasUnread ? 'bell-ringing' : ''}">🔔</span>
      </button>
      <div id="notificationDropdown" class="notification-dropdown">
        <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700; font-size: 13px; color: #fff;">
          Notificaciones de Mensajes
        </div>
        <div id="notificationListContent" style="max-height: 250px; overflow-y: auto;">
          ${
            unreadConvs.length === 0 
            ? '<div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">No hay mensajes nuevos</div>'
            : unreadConvs.map(c => `
                <div class="notification-item" onclick="window.location.href='mensajes.html?propiedadId=${c.propertyId}'">
                  <img src="${c.propertyImage}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover;" onerror="this.src='assets/puerto-marina.png'">
                  <div style="overflow: hidden;">
                    <div style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.propertyTitle}</div>
                    <div style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.lastMessage}</div>
                  </div>
                </div>
              `).join('')
          }
        </div>
      </div>
    </div>

    <div class="profile-dropdown-container" style="position: relative; display: inline-block;">
      <button id="profileBtn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 4px 8px 4px 4px; border-radius: 999px;">
        <img src="${avatarSrc}" alt="Avatar" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #ef4444;" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}'">
        <span style="color: #fff; font-weight: 600; font-size: 15px;">${displayName}</span>
      </button>
      <div id="profileMenu" class="profile-menu" style="display:none; position: absolute; right: 0; top: 50px; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; width: 180px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 1000;">
        <button class="profile-menu-item" onclick="window.location.href='perfil.html'" style="width:100%; background:none; border:none; color:#fff; text-align:left; padding:8px; cursor:pointer; border-radius:6px;">Ir al Perfil</button>
        <div style="height:1px; background:rgba(255,255,255,0.1); margin:6px 0;"></div>
        <button id="cerrarSesionBtn" style="width:100%; background:none; border:none; color:#ef4444; text-align:left; padding:8px; cursor:pointer; border-radius:6px;">Cerrar Sesión</button>
      </div>
    </div>
  `;

  // Eventos de interacción (hover para la campana y click para el perfil)
  const notificationBellBtn = document.getElementById('notificationBellBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');
  if (notificationBellBtn && notificationDropdown) {
    notificationBellBtn.addEventListener('mouseenter', () => { notificationDropdown.style.display = 'block'; });
    notificationBellBtn.parentElement.addEventListener('mouseleave', () => { notificationDropdown.style.display = 'none'; });
  }

  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => { profileMenu.style.display = 'none'; });
  }

  const cerrarBtn = document.getElementById('cerrarSesionBtn');
  if (cerrarBtn) {
    cerrarBtn.addEventListener('click', async () => {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(auth);
      localStorage.clear();
      window.location.href = 'index.html';
    });
  }
}
