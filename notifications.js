import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, limit, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('authContainer');
  if (!authContainer) return;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      authContainer.innerHTML = `
        <a href="login.html" style="color: #fff; text-decoration: none; font-weight: 600; font-size: 14px;">Iniciar sesión</a>
      `;
      return;
    }

    let displayName = user.email.split('@')[0];
    let avatarSrc = 'assets/onlybladi-avatar.png';

    try {
      const docSnap = await getDoc(doc(db, "usuarios", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.nombres) displayName = data.nombres;
        if (data.fotoPerfil) avatarSrc = data.fotoPerfil;
      }
    } catch (e) {
      console.error("Error al cargar perfil en navbar:", e);
    }

    // Consulta general optimizada para capturar mensajes recientes de la base de datos
    const q = query(collection(db, "mensajes"), limit(50));
    
    onSnapshot(q, (snapshot) => {
      const conversationsMap = new Map();
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        
        // Verificamos si el mensaje pertenece al usuario actual (ya sea como receptor o emisor)
        const isForThisUser = data.userId === user.uid || data.receiverId === user.uid || data.agentId === user.uid || !data.userId;
        if (!isForThisUser) return;

        const propId = data.propertyId || data.propiedadId || 'general';
        const timeA = data.timestamp?.toMillis ? data.timestamp.toMillis() : (data.creadoen ? new Date(data.creadoen).getTime() : Date.now());
        
        // Determinamos si el mensaje fue enviado por alguien más
        const senderVal = data.sender || data.remitente || '';
        const isFromMe = senderVal === 'user' || senderVal === user.uid || data.emisor === user.uid;
        
        if (!conversationsMap.has(propId)) {
          conversationsMap.set(propId, {
            propertyId: propId,
            propertyTitle: data.propertyTitle || data.titulo || 'Consulta Inmobiliaria',
            propertyImage: data.propertyImage || data.imagen || 'assets/puerto-marina.png',
            lastMessage: data.mensaje || data.text || data.contenido || '',
            isFromMe: isFromMe,
            timestamp: timeA
          });
        } else {
          const existing = conversationsMap.get(propId);
          if (timeA >= existing.timestamp) {
            existing.lastMessage = data.mensaje || data.text || data.contenido || '';
            existing.isFromMe = isFromMe;
            existing.timestamp = timeA;
          }
        }
      });

      const convs = Array.from(conversationsMap.values());
      // Consideramos no leído si el último mensaje NO fue enviado por mí
      const unreadConvs = convs.filter(c => !c.isFromMe);
      
      renderGlobalNavbar(authContainer, user.uid, displayName, avatarSrc, unreadConvs);
    });
  });
});

function renderGlobalNavbar(container, userId, displayName, avatarSrc, unreadConvs) {
  const sessionCleared = sessionStorage.getItem(`notifications_cleared_${userId}`) === 'true';
  const hasUnread = !sessionCleared && unreadConvs.length > 0;

  container.innerHTML = `
    <div style="position: relative; display: inline-block;">
      <button id="notificationBellBtn" style="background: none; border: none; cursor: pointer; font-size: 20px; padding: 6px; position: relative;">
        <span id="bellIconSpan" class="${hasUnread ? 'bell-ringing' : ''}">🔔</span>
        ${hasUnread ? '<span style="position: absolute; top: 2px; right: 2px; width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>' : ''}
      </button>
      <div id="notificationDropdown" class="notification-dropdown" style="display:none; position: absolute; right: 0; top: 45px; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; width: 280px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 1000;">
        <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700; font-size: 13px; color: #fff; display: flex; justify-content: space-between; align-items: center;">
          <span>Notificaciones de Mensajes</span>
          ${unreadConvs.length > 0 ? '<button id="markAllReadBtn" style="background:none; border:none; color:#3b82f6; font-size:11px; cursor:pointer; font-weight:600;">Marcar leídos</button>' : ''}
        </div>
        <div id="notificationListContent" style="max-height: 250px; overflow-y: auto;">
          ${
            unreadConvs.length === 0 || sessionCleared
            ? '<div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">No hay mensajes nuevos</div>'
            : unreadConvs.map(c => `
                <div class="notification-item" data-prop="${c.propertyId}" style="display: flex; align-items: center; gap: 10px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04);">
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

    <div class="profile-dropdown-container" style="position: relative; display: inline-block; margin-left: 10px;">
      <button id="profileBtn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 10px; padding: 4px 8px 4px 4px; border-radius: 999px;">
        <img src="${avatarSrc}" alt="Avatar" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid ${hasUnread ? '#10b981' : '#ef4444'};" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}'">
        <span style="color: #fff; font-weight: 600; font-size: 15px;">${displayName}</span>
      </button>
      <div id="profileMenu" class="profile-menu" style="display:none; position: absolute; right: 0; top: 50px; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; width: 180px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 1000;">
        <button class="profile-menu-item" onclick="window.location.href='mensajes.html'" style="width:100%; background:none; border:none; color:#fff; text-align:left; padding:8px; cursor:pointer; border-radius:6px; font-size: 13px;">💬 Mensajes</button>
        <button class="profile-menu-item" onclick="window.location.href='perfil.html'" style="width:100%; background:none; border:none; color:#fff; text-align:left; padding:8px; cursor:pointer; border-radius:6px; font-size: 13px;">👤 Ir al Perfil</button>
        <div style="height:1px; background:rgba(255,255,255,0.1); margin:6px 0;"></div>
        <button id="cerrarSesionBtn" style="width:100%; background:none; border:none; color:#ef4444; text-align:left; padding:8px; cursor:pointer; border-radius:6px; font-size: 13px;">⎋ Cerrar Sesión</button>
      </div>
    </div>
  `;

  const notificationBellBtn = document.getElementById('notificationBellBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');
  
  if (notificationBellBtn && notificationDropdown) {
    notificationBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = notificationDropdown.style.display === 'block';
      notificationDropdown.style.display = isVisible ? 'none' : 'block';
      const profileMenu = document.getElementById('profileMenu');
      if (profileMenu) profileMenu.style.display = 'none';
    });
  }

  const markAllReadBtn = document.getElementById('markAllReadBtn');
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sessionStorage.setItem(`notifications_cleared_${userId}`, 'true');
      const bellIconSpan = document.getElementById('bellIconSpan');
      if (bellIconSpan) bellIconSpan.classList.remove('bell-ringing');
      if (notificationDropdown) notificationDropdown.style.display = 'none';
      const listContent = document.getElementById('notificationListContent');
      if (listContent) listContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">No hay mensajes nuevos</div>';
      markAllReadBtn.style.display = 'none';
    });
  }

  container.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', () => {
      sessionStorage.setItem(`notifications_cleared_${userId}`, 'true');
      const propId = item.getAttribute('data-prop');
      window.location.href = `mensajes.html?propiedadId=${propId}`;
    });
  });

  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = profileMenu.style.display === 'block';
      profileMenu.style.display = isVisible ? 'none' : 'block';
      if (notificationDropdown) notificationDropdown.style.display = 'none';
    });
  }

  document.addEventListener('click', () => {
    if (notificationDropdown) notificationDropdown.style.display = 'none';
    if (profileMenu) profileMenu.style.display = 'none';
  });

  const cerrarBtn = document.getElementById('cerrarSesionBtn');
  if (cerrarBtn) {
    cerrarBtn.addEventListener('click', async () => {
      await signOut(auth);
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = 'index.html';
    });
  }
}
