import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Carpeta raíz del sitio (donde vive este archivo). Sirve para que los enlaces y las
// imágenes funcionen igual desde páginas que están en subcarpetas (como mensajesempresa.html).
const BASE = new URL('./', import.meta.url).href;
const R = (ruta) => BASE + ruta;

// ⚠️ AJUSTA ESTA RUTA: carpeta + nombre del panel de mensajes de empresa, relativa a la raíz del sitio.
// Ejemplo: 'empresa/mensajesempresa.html'
const RUTA_PANEL_EMPRESA = 'mensajes/mensajesempresa.html';

const ROLES_STAFF = ['agente', 'agentepro', 'admin', 'superadmin'];

document.addEventListener('DOMContentLoaded', () => {
  const authContainer = document.getElementById('authContainer');
  // Si la página tiene este contenedor (ej. el panel de empresa), la campanita se dibuja
  // SOLO ahí y no se toca el menú de perfil que esa página ya tiene.
  const bellContainer = document.getElementById('notifBellContainer');
  if (!authContainer && !bellContainer) return;

  // Estilos propios de la campanita (no dependen del CSS de cada página)
  if (!document.getElementById('notif-panel-styles')) {
    const st = document.createElement('style');
    st.id = 'notif-panel-styles';
    st.textContent = `
      @keyframes ringBell { 0% { transform: rotate(0deg); } 20% { transform: rotate(15deg); } 40% { transform: rotate(-15deg); } 60% { transform: rotate(10deg); } 80% { transform: rotate(-10deg); } 100% { transform: rotate(0deg); } }
      .bell-ringing { animation: ringBell 1s infinite ease-in-out; display: inline-block; }
      .notif-panel { display: none; position: absolute; right: 0; top: 46px; width: 340px; max-width: 92vw;
        height: auto; max-height: none; background: #18181b; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 2000; overflow: hidden; }
      #notificationListContent { display: block; height: auto; max-height: 380px; overflow-y: auto; }
      .notif-panel .notification-item:hover { background: rgba(255,255,255,0.06); }
      @media (max-width: 768px) {
        .notif-panel { position: fixed; left: 10px; right: 10px; top: var(--notif-top, 70px); width: auto; max-width: none; }
        #notificationListContent { max-height: 60vh; }
      }
    `;
    document.head.appendChild(st);
  }

  // Aplicar el tema (claro/oscuro/sistema) guardado, igual que hacía cada página por separado
  const savedTheme = localStorage.getItem('site_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-mode');
  } else if (savedTheme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.body.classList.add('light-mode');
    }
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return; // Si no hay sesión, se queda el botón de "Iniciar sesión" por defecto

    let displayName = user.email.split('@')[0];
    let avatarSrc = R('assets/onlybladi-avatar.png');
    let zonasPref = { modo: 'todas', zonas: [] };
    let rol = '';

    // Cargar datos adicionales del perfil si existen
    try {
      const docSnap = await getDoc(doc(db, "usuarios", user.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.nombres) displayName = data.nombres;
        if (data.fotoPerfil) avatarSrc = data.fotoPerfil;
        if (data.notifZonas) zonasPref = data.notifZonas;
        rol = (data.rol || '').toLowerCase();
      }
    } catch (e) {
      console.error("Error al cargar perfil en navbar:", e);
    }

    const esStaff = ROLES_STAFF.includes(rol);
    const esAdmin = rol === 'admin' || rol === 'superadmin';

    // Estado combinado de la campanita:
    //  - unreadConvs: respuestas que me escribieron a mí como cliente
    //  - newProps:    propiedades nuevas
    //  - staffUnread: (solo agentes/admins) mensajes de clientes sin leer
    //  - teamUnread:  (solo agentes/admins) mensajes internos del equipo sin leer
    let unreadConvs = [];
    let newProps = [];
    let staffUnread = [];
    let teamUnread = [];
    const rerender = () => renderGlobalNavbar(authContainer, bellContainer, user.uid, displayName, avatarSrc, unreadConvs, newProps.filter(p => coincideZona(p, zonasPref)), savedTheme, staffUnread, teamUnread);

    // Se notifican las propiedades publicadas en los últimos DIAS_VENTANA días
    // (las que el usuario ya abrió o marcó como leídas no vuelven a aparecer).
    const DIAS_VENTANA = 7;
    // true = quien publica también recibe su propia notificación (útil para probar). Pon false cuando ya funcione.
    const NOTIFICAR_AL_AUTOR = true;
    const desde = new Date(Date.now() - DIAS_VENTANA * 24 * 60 * 60 * 1000).toISOString();

    // Escuchar en tiempo real las últimas propiedades publicadas
    const qProps = query(collection(db, "propiedades"), orderBy("fechaCreacion", "desc"), limit(50));
    onSnapshot(qProps, (snap) => {
      newProps = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p =>
          p.archivada !== true &&
          (NOTIFICAR_AL_AUTOR || p.creadoPorUid !== user.uid) &&
          p.fechaCreacion && p.fechaCreacion > desde
        );
      lastPropsError = "";
      rerender();
    }, (err) => {
      console.error("[Notificaciones] Error al leer 'propiedades':", err);
      lastPropsError = (err && (err.code || err.message)) || "error desconocido";
      rerender();
    });

    // Escuchar mensajes en tiempo real para las notificaciones globales (como cliente)
    const q = query(collection(db, "mensajes"), where("userId", "==", user.uid));

    let secuenciaCliente = 0;
    onSnapshot(q, async (snapshot) => {
      const miSecuenciaCliente = ++secuenciaCliente;
      const conversationsMap = new Map();

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const propId = data.propertyId || 'general';
        const timeA = data.timestamp?.toMillis ? data.timestamp.toMillis() : 0;

        if (!conversationsMap.has(propId)) {
          conversationsMap.set(propId, {
            propertyId: propId,
            propertyTitle: data.propertyTitle || 'Consulta Inmobiliaria',
            propertyImage: data.propertyImage || R('assets/puerto-marina.png'),
            lastMessage: data.mensaje || data.text || '',
            sender: data.sender || 'user',
            leido: data.leidoPorUsuario || false,
            timestamp: timeA
          });
        } else {
          const existing = conversationsMap.get(propId);
          if (timeA >= existing.timestamp) {
            existing.lastMessage = data.mensaje || data.text || '';
            existing.sender = data.sender || 'user';
            existing.leido = data.leidoPorUsuario || false;
            existing.timestamp = timeA;
          }
        }
      });

      const convs = Array.from(conversationsMap.values());

      // Usar la primera imagen real de la publicación (no la imagen por defecto)
      await Promise.all(convs.map(async c => {
        c.propertyImages = await imagenesPropiedad(c.propertyId);
        if (c.propertyImages[0]) c.propertyImage = c.propertyImages[0];
        else if (esPaginaHtml(c.propertyImage)) c.propertyImage = R('assets/puerto-marina.png');
      }));
      if (miSecuenciaCliente !== secuenciaCliente) return; // llegó un cambio más nuevo
      // No leídos: el último mensaje NO es del usuario ('user') Y no se marcó como leído en mensajes.html
      unreadConvs = convs.filter(c => c.sender && c.sender !== 'user' && !c.leido);

      rerender();
    });

    // ===== SOLO AGENTES / ADMINS =====
    if (esStaff) {
      // 1) Mensajes de clientes sin leer (misma lógica que el punto rojo de mensajesempresa.html)
      let secuencia = 0;
      onSnapshot(query(collection(db, "mensajes")), async (snapshot) => {
        const miSecuencia = ++secuencia;
        const mapa = new Map();

        snapshot.forEach(d => {
          const x = d.data();
          const clientId = x.userId;
          if (!clientId) return;
          const propId = x.propertyId || 'general';
          const key = `${clientId}_${propId}`;

          let c = mapa.get(key);
          if (!c) {
            c = {
              clientId, propertyId: propId,
              propertyTitle: x.propertyTitle || 'Consulta Inmobiliaria',
              propertyImage: x.propertyImage || R('assets/puerto-marina.png'),
              agentId: null, noLeido: false, lastMessage: '', timestamp: 0
            };
            mapa.set(key, c);
          }

          // El agentId solo se toma de mensajes del cliente (igual que en el panel)
          if (x.sender === 'user' && x.agentId !== undefined) c.agentId = x.agentId || null;

          if (x.sender === 'user' && x.tipo !== 'sistema' && x.leidoPorAgente !== true) {
            c.noLeido = true;
            const t = x.timestamp?.toMillis ? x.timestamp.toMillis() : Date.now();
            if (t >= c.timestamp) {
              c.timestamp = t;
              c.lastMessage = x.mensaje || x.text || '';
            }
          }
        });

        let lista = Array.from(mapa.values()).filter(c => c.noLeido);

        // Agentes/agentepro solo ven lo suyo; admin y superadmin ven todo (igual que el panel)
        if (!esAdmin) {
          const duenos = await Promise.all(lista.map(c => creadorPropiedad(c.propertyId)));
          lista = lista.filter((c, i) => {
            if (duenos[i] === user.uid) return true;
            if (c.propertyId.startsWith('solicitud_') && (!c.agentId || c.agentId === user.uid)) return true;
            return false;
          });
        }

        // Las conversaciones finalizadas no avisan
        const estados = await Promise.all(lista.map(async c => {
          try {
            const s = await getDoc(doc(db, "conversaciones", `${c.clientId}_${c.propertyId}`));
            return s.exists() ? (s.data().estado || 'activa') : 'activa';
          } catch (e) { return 'activa'; }
        }));
        lista = lista.filter((c, i) => estados[i] !== 'finalizada');

        await Promise.all(lista.map(async c => {
          c.clientName = await nombreUsuario(c.clientId);
          // Primera imagen real de la publicación (no la imagen por defecto)
          c.propertyImages = await imagenesPropiedad(c.propertyId);
          if (c.propertyImages[0]) c.propertyImage = c.propertyImages[0];
          else if (esPaginaHtml(c.propertyImage)) c.propertyImage = R('assets/puerto-marina.png');
        }));

        if (miSecuencia !== secuencia) return; // llegó un cambio más nuevo mientras consultaba
        staffUnread = lista.sort((a, b) => b.timestamp - a.timestamp);
        rerender();
      }, (err) => {
        console.error("[Notificaciones] Error al leer mensajes de clientes:", err);
      });

      // 2) Mensajes internos del equipo sin leer
      onSnapshot(query(collection(db, "mensajesInternos"), where("participantes", "array-contains", user.uid)), (snapshot) => {
        const mapa = new Map();
        snapshot.forEach(d => {
          const x = d.data();
          if (x.tipo === 'sistema') return;
          if (x.senderUid === user.uid) return;
          if ((x.leidoPor || []).includes(user.uid)) return;

          const t = x.timestamp?.toMillis ? x.timestamp.toMillis() : Date.now();
          const c = mapa.get(x.senderUid) || { otroUid: x.senderUid, nombre: x.senderNombre || 'Equipo', lastMessage: '', timestamp: 0 };
          if (t >= c.timestamp) {
            c.timestamp = t;
            c.lastMessage = x.mensaje || '';
          }
          mapa.set(x.senderUid, c);
        });
        teamUnread = Array.from(mapa.values()).sort((a, b) => b.timestamp - a.timestamp);
        rerender();
      }, (err) => {
        console.error("[Notificaciones] Error al leer mensajes internos:", err);
      });
    }
  });
});

// ===== Utilidades para los avisos de agentes =====
const cacheNombres = {};
async function nombreUsuario(uid) {
  if (cacheNombres[uid]) return cacheNombres[uid];
  let nombre = uid.substring(0, 8) + '...';
  try {
    const s = await getDoc(doc(db, "usuarios", uid));
    if (s.exists()) nombre = s.data().nombres || s.data().nombre || nombre;
  } catch (e) { /* ignorar */ }
  cacheNombres[uid] = nombre;
  return nombre;
}

// Imágenes de la publicación (propiedades/{id}.imagenes). Se guardan en caché para no repetir lecturas.
const cacheImagenesProp = {};
// Un enlace a una página (detalle.html, etc.) no es una imagen
const esPaginaHtml = (u) => /\.html?(\?|#|$)/i.test(String(u || ''));
const MAX_FOTOS_CARRUSEL = 6;
function listaDeImagenes(d) {
  const arr = Array.isArray(d.imagenes) ? d.imagenes : [];
  const urls = arr.map(x => typeof x === 'string' ? x : (x && (x.url || x.src))).filter(Boolean);
  if (!urls.length) [d.image, d.imagen, d.imagenPrincipal].forEach(x => { if (typeof x === 'string' && x) urls.push(x); });
  return [...new Set(urls)].filter(u => !esPaginaHtml(u)).slice(0, MAX_FOTOS_CARRUSEL);
}
async function imagenesPropiedad(propId) {
  if (!propId || propId === 'general' || propId.startsWith('solicitud_') || propId.startsWith('perfil-agente-')) return [];
  if (propId in cacheImagenesProp) return cacheImagenesProp[propId];
  let lista = [];
  try {
    const s = await getDoc(doc(db, "propiedades", propId));
    if (s.exists()) lista = listaDeImagenes(s.data());
  } catch (e) { /* ignorar */ }
  cacheImagenesProp[propId] = lista;
  return lista;
}

const cacheCreadores = {};
async function creadorPropiedad(propId) {
  if (!propId || propId === 'general') return null;
  if (propId in cacheCreadores) return cacheCreadores[propId];
  // Chats que salen del perfil de un agente: el id trae el uid del agente
  const PREFIJO = 'perfil-agente-';
  if (propId.startsWith(PREFIJO)) {
    cacheCreadores[propId] = propId.slice(PREFIJO.length) || null;
    return cacheCreadores[propId];
  }
  let uid = null;
  try {
    const s = await getDoc(doc(db, "propiedades", propId));
    if (s.exists()) uid = s.data().creadoPorUid || null;
  } catch (e) { /* ignorar */ }
  cacheCreadores[propId] = uid;
  return uid;
}

// ===== Filtro por zonas elegidas en el perfil (usuarios/{uid}.notifZonas) =====
const normZona = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function coincideZona(p, pref) {
  if (!pref || pref.modo !== 'elegidas') return true;           // "Todas las zonas"
  const zonas = Array.isArray(pref.zonas) ? pref.zonas : [];
  if (!zonas.length) return true;                                // sin zonas elegidas = no se filtra nada
  const prov = normZona(p.provincia), mun = normZona(p.municipio), dis = normZona(p.distrito), ub = normZona(p.ubicacion);
  // Si la propiedad es antigua y no trae el campo, se busca el nombre dentro de su texto de ubicación
  const ok = (zv, pv) => !zv || (pv ? pv === zv : ub.includes(zv));
  return zonas.some(z => ok(normZona(z.provincia), prov) && ok(normZona(z.municipio), mun) && ok(normZona(z.distrito), dis));
}

// ===== Carrusel de fotos en las miniaturas de la campanita =====
function thumbCarrusel(lista, principal, fallback, size, radius) {
  const fotos = (Array.isArray(lista) && lista.length ? lista : [principal]).filter(Boolean);
  const src = fotos[0] || fallback;
  const data = fotos.length > 1 ? ` data-imgs="${esc(JSON.stringify(fotos))}" data-i="0"` : '';
  return `<img class="notif-thumb" src="${esc(src)}"${data} style="width: ${size}px; height: ${size}px; border-radius: ${radius}px; object-fit: cover; flex-shrink: 0; transition: opacity 0.3s;" onerror="this.src='${esc(fallback)}'">`;
}

let notifCarruselTimer = null;
function iniciarCarrusel() {
  if (notifCarruselTimer) return;
  notifCarruselTimer = setInterval(() => {
    if (!notifOpen) return; // solo gira con la campanita abierta
    document.querySelectorAll('img.notif-thumb[data-imgs]').forEach(im => {
      let fotos;
      try { fotos = JSON.parse(im.dataset.imgs || '[]'); } catch (e) { return; }
      if (fotos.length < 2) return;
      const n = ((parseInt(im.dataset.i || '0', 10)) + 1) % fotos.length;
      const pre = new Image();
      pre.onload = () => {
        im.style.opacity = '0';
        setTimeout(() => { im.src = fotos[n]; im.dataset.i = String(n); im.style.opacity = '1'; }, 300);
      };
      pre.onerror = () => { fotos.splice(n, 1); im.dataset.imgs = JSON.stringify(fotos); };
      pre.src = fotos[n];
    });
  }, 2800);
}

let notifOpen = false; // la campana queda abierta/cerrada por clic, y se conserva aunque se actualice la lista
let outsideClickBound = false;
let lastPropsError = ""; // se muestra en la campana si falla la lectura de propiedades

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function getSeenProps(userId) {
  try { return new Set(JSON.parse(localStorage.getItem(`props_seen_${userId}`) || '[]')); }
  catch (e) { return new Set(); }
}

function addSeenProps(userId, ids) {
  try {
    const seen = getSeenProps(userId);
    ids.forEach(id => seen.add(id));
    localStorage.setItem(`props_seen_${userId}`, JSON.stringify(Array.from(seen).slice(-100)));
  } catch (e) { /* sin almacenamiento disponible */ }
}

function formatPropPrice(p) {
  const main = p.precio || p.precioAlquiler;
  const cur = p.precio ? (p.moneda || '') : (p.monedaAlquiler || p.moneda || '');
  return main ? `${cur} ${main}`.trim() : '';
}

function renderGlobalNavbar(container, bellContainer, userId, displayName, avatarSrc, unreadConvs, newProps, savedTheme, staffUnread = [], teamUnread = []) {
  // Solo ocultamos los mensajes que ya existían cuando se marcó "leído" la última vez;
  // los que lleguen después de esa marca de tiempo sí vuelven a sonar.
  const clearedAt = parseInt(sessionStorage.getItem(`notifications_cleared_at_${userId}`) || '0', 10);
  const visibleUnread = unreadConvs.filter(c => c.timestamp > clearedAt);
  const visibleStaff = staffUnread.filter(c => c.timestamp > clearedAt);
  const visibleTeam = teamUnread.filter(c => c.timestamp > clearedAt);
  const seenProps = getSeenProps(userId);
  const visibleProps = (newProps || []).filter(p => !seenProps.has(p.id));
  const totalUnread = visibleUnread.length + visibleProps.length + visibleStaff.length + visibleTeam.length;
  const hasUnread = totalUnread > 0;

  // Contador en la pestaña del navegador: "(3) Título"
  const tituloBase = document.title.replace(/^\(\d+\)\s*/, '');
  document.title = hasUnread ? `(${totalUnread}) ${tituloBase}` : tituloBase;

  iniciarCarrusel();

  const itemStyle = 'display: flex; align-items: center; gap: 10px; padding: 10px 16px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.04);';
  const imgFallback = R('assets/puerto-marina.png');

  const bellHtml = `
    <div style="position: relative; display: inline-flex; align-items: center;">
      <button id="notificationBellBtn" style="background: none; border: none; cursor: pointer; font-size: 20px; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; padding: 0; position: relative; line-height: 1;">
        <span id="bellIconSpan" class="${hasUnread ? 'bell-ringing' : ''}" style="display: inline-block; margin-top: 2px;">🔔</span>
        ${hasUnread ? `<span id="notifBadge" style="position:absolute; top:2px; right:0; min-width:16px; height:16px; padding:0 4px; border-radius:999px; background:#ef4444; color:#fff; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; line-height:1;">${totalUnread}</span>` : ''}
      </button>
      <div id="notificationDropdown" class="notif-panel">
        <div style="padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); font-weight: 700; font-size: 13px; color: #fff; display: flex; justify-content: space-between; align-items: center;">
          <span>Notificaciones</span>
          ${hasUnread ? '<button id="markAllReadBtn" style="background:none; border:none; color:#3b82f6; font-size:11px; cursor:pointer; font-weight:600;">Marcar leídos</button>' : ''}
        </div>
        <div id="notificationListContent" style="max-height: 320px; overflow-y: auto;">
          ${
            !hasUnread
            ? '<div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">No hay notificaciones nuevas' + (lastPropsError ? `<div style="margin-top:8px; color:#ef4444;">⚠️ No se pudieron leer las propiedades: ${esc(lastPropsError)}</div>` : '') + '</div>'
            : visibleStaff.map(c => `
                <div class="notification-item" data-staff-cliente="${esc(c.clientId)}" data-staff-prop="${esc(c.propertyId)}" style="${itemStyle}">
                  ${thumbCarrusel(c.propertyImages, c.propertyImage, imgFallback, 36, 8)}
                  <div style="overflow: hidden;">
                    <div style="font-size: 10px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.4px;">💬 Mensaje de cliente</div>
                    <div style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.clientName)} · ${esc(c.propertyTitle)}</div>
                    <div style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.lastMessage)}</div>
                  </div>
                </div>`).join('')
              + visibleTeam.map(c => `
                <div class="notification-item" data-equipo="${esc(c.otroUid)}" style="${itemStyle}">
                  <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(168,85,247,0.18); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink: 0;">👥</div>
                  <div style="overflow: hidden;">
                    <div style="font-size: 10px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.4px;">Mensaje del equipo</div>
                    <div style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.nombre)}</div>
                    <div style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.lastMessage)}</div>
                  </div>
                </div>`).join('')
              + visibleProps.map(p => {
                const img = (Array.isArray(p.imagenes) && p.imagenes[0]) || imgFallback;
                const price = formatPropPrice(p);
                const meta = [p.operacion, price].filter(Boolean).join(' · ');
                return `
                <div class="notification-item" data-newprop="${esc(p.id)}" style="${itemStyle}">
                  ${thumbCarrusel(listaDeImagenes(p), img, imgFallback, 44, 8)}
                  <div style="overflow: hidden;">
                    <div style="font-size: 10px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.4px;">🏠 Nueva propiedad</div>
                    <div style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(p.titulo)}</div>
                    <div style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(meta)}</div>
                    <div style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">📍 ${esc(p.ubicacion)}</div>
                  </div>
                </div>`;
              }).join('')
              + visibleUnread.map(c => `
                <div class="notification-item" data-prop="${esc(c.propertyId)}" style="${itemStyle}">
                  ${thumbCarrusel(c.propertyImages, c.propertyImage, imgFallback, 36, 6)}
                  <div style="overflow: hidden;">
                    <div style="font-size: 13px; font-weight: 700; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">💬 ${esc(c.propertyTitle)}</div>
                    <div style="font-size: 11px; color: #a1a1aa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${esc(c.lastMessage)}</div>
                  </div>
                </div>
              `).join('')
          }
        </div>
      </div>
    </div>
  `;

  const profileHtml = `
    <div class="profile-dropdown-container" style="position: relative; display: inline-flex; align-items: center;">
      <button id="profileBtn" style="background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 12px; padding: 4px 8px 4px 4px; border-radius: 999px;">
        <img src="${esc(avatarSrc)}" alt="Avatar" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid #ef4444;" onerror="this.src='https://api.dicebear.com/7.x/avataaars/svg?seed=${esc(userId)}'">
        <span style="color: #fff; font-weight: 600; font-size: 15px;">${esc(displayName)}</span>
      </button>
      <div id="profileMenu" class="profile-menu" style="display:none; position: absolute; right: 0; top: 50px; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px; width: 200px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 1000;">
        <button class="profile-menu-item" onclick="window.location.href='${R('perfil.html')}'" style="width:100%; background:none; border:none; color:#fff; text-align:left; padding:8px; cursor:pointer; border-radius:6px; display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          Ir al Perfil
        </button>
        <button class="profile-menu-item" onclick="window.location.href='${R('mensajes.html')}'" style="width:100%; background:none; border:none; color:#fff; text-align:left; padding:8px; cursor:pointer; border-radius:6px; display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          Mensajes
        </button>

        <div style="height:1px; background:rgba(255,255,255,0.1); margin:6px 0;"></div>
        <div style="font-size:11px; color:#a1a1aa; font-weight:700; text-transform:uppercase; padding:4px 8px; letter-spacing:0.5px;">Aspecto físico</div>

        <div style="display:flex; gap:6px; padding:6px 8px;">
          <button class="theme-btn ${savedTheme === 'light' ? 'active' : ''}" data-theme="light" title="Claro" style="flex:1;">☀️</button>
          <button class="theme-btn ${savedTheme === 'system' ? 'active' : ''}" data-theme="system" title="Sistema" style="flex:1;">💻</button>
          <button class="theme-btn ${savedTheme === 'dark' ? 'active' : ''}" data-theme="dark" title="Oscuro" style="flex:1;">🌙</button>
        </div>

        <div style="height:1px; background:rgba(255,255,255,0.1); margin:6px 0;"></div>
        <button id="cerrarSesionBtn" style="width:100%; background:none; border:none; color:#ef4444; text-align:left; padding:8px; cursor:pointer; border-radius:6px;">Cerrar Sesión</button>
      </div>
    </div>
  `;

  // Modo normal: campanita + perfil en authContainer.
  // Modo panel: solo la campanita en notifBellContainer (el perfil lo dibuja la propia página).
  const raiz = bellContainer || container;
  if (bellContainer) {
    bellContainer.innerHTML = bellHtml;
  } else {
    container.innerHTML = bellHtml + profileHtml;
  }

  // Campanita: un clic abre y se queda abierta; otro clic la cierra
  const notificationBellBtn = document.getElementById('notificationBellBtn');
  const notificationDropdown = document.getElementById('notificationDropdown');

  // En pantallas pequeñas (celular/app) el menú se ancla a la pantalla, centrado y con márgenes,
  // para que no quede cortado a la izquierda.
  function positionDropdown() {
    if (!notificationDropdown || !notificationBellBtn) return;
    const top = Math.round(notificationBellBtn.getBoundingClientRect().bottom + 8);
    notificationDropdown.style.setProperty('--notif-top', top + 'px');
  }

  if (notificationBellBtn && notificationDropdown) {
    positionDropdown();
    notificationDropdown.style.display = notifOpen ? 'block' : 'none';

    notificationBellBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifOpen = !notifOpen;
      positionDropdown();
      notificationDropdown.style.display = notifOpen ? 'block' : 'none';
      const pm = document.getElementById('profileMenu');
      if (notifOpen && pm) pm.style.display = 'none';
    });

    // Evita que los clics dentro de la lista la cierren
    notificationDropdown.addEventListener('click', (e) => e.stopPropagation());
    window.__notifReposition = positionDropdown;
  }

  // Clic fuera de la campana: se cierra (se registra una sola vez)
  if (!outsideClickBound) {
    outsideClickBound = true;
    window.addEventListener('resize', () => { if (typeof window.__notifReposition === 'function') window.__notifReposition(); });
    document.addEventListener('click', () => {
      if (!notifOpen) return;
      notifOpen = false;
      const dd = document.getElementById('notificationDropdown');
      if (dd) dd.style.display = 'none';
    });
  }

  // Marcar como leídas al hacer clic en el botón interno o al hacer clic en cualquier notificación individual
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sessionStorage.setItem(`notifications_cleared_at_${userId}`, Date.now().toString());
      addSeenProps(userId, visibleProps.map(p => p.id));
      const bellIconSpan = document.getElementById('bellIconSpan');
      if (bellIconSpan) bellIconSpan.classList.remove('bell-ringing');
      const badgeEl = document.getElementById('notifBadge');
      if (badgeEl) badgeEl.remove();
      notifOpen = false;
      notificationDropdown.style.display = 'none';
      const listContent = document.getElementById('notificationListContent');
      if (listContent) listContent.innerHTML = '<div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">No hay notificaciones nuevas</div>';
      if (markAllReadBtn) markAllReadBtn.style.display = 'none';
      document.title = document.title.replace(/^\(\d+\)\s*/, '');
    });
  }

  // Actualiza globito, campana y mensaje de "vacío" tras quitar una notificación
  function refreshBellState() {
    const remaining = raiz.querySelectorAll('.notification-item').length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (remaining === 0) badge.remove();
      else badge.textContent = String(remaining);
    }
    if (remaining === 0) {
      const bell = document.getElementById('bellIconSpan');
      if (bell) bell.classList.remove('bell-ringing');
      const list = document.getElementById('notificationListContent');
      if (list) list.innerHTML = '<div style="padding: 20px; text-align: center; color: #71717a; font-size: 12px;">No hay notificaciones nuevas</div>';
      const mk = document.getElementById('markAllReadBtn');
      if (mk) mk.style.display = 'none';
    }
  }

  // Redirección y marcado automático al hacer clic en una notificación específica
  const notificationItems = raiz.querySelectorAll('.notification-item');
  notificationItems.forEach(item => {
    item.addEventListener('click', () => {
      // Mensaje de un cliente (agentes/admins): abre ese chat en el panel de empresa.
      // El panel lo marca como leído y la campanita se actualiza sola.
      const staffCliente = item.getAttribute('data-staff-cliente');
      if (staffCliente) {
        const staffProp = item.getAttribute('data-staff-prop');
        window.location.href = `${R(RUTA_PANEL_EMPRESA)}?cliente=${encodeURIComponent(staffCliente)}&propiedad=${encodeURIComponent(staffProp)}`;
        return;
      }

      // Mensaje interno del equipo: abre la pestaña "Equipo" con ese agente
      const equipoUid = item.getAttribute('data-equipo');
      if (equipoUid) {
        window.location.href = `${R(RUTA_PANEL_EMPRESA)}?equipo=${encodeURIComponent(equipoUid)}`;
        return;
      }

      // Propiedad nueva: se marca como vista y se abre su detalle
      const newPropId = item.getAttribute('data-newprop');
      if (newPropId) {
        addSeenProps(userId, [newPropId]);
        item.remove();          // desaparece de la campanita al instante
        refreshBellState();
        window.location.href = `${R('detalle.html')}?id=${encodeURIComponent(newPropId)}`;
        return;
      }
      sessionStorage.setItem(`notifications_cleared_at_${userId}`, Date.now().toString());
      const propId = item.getAttribute('data-prop');
      window.location.href = `${R('mensajes.html')}?propiedadId=${encodeURIComponent(propId)}`;
    });
  });

  // Evento de clic en el enlace general de "Mensajes" del menú principal para limpiar también la campana
  const navMensajes = document.getElementById('navMensajes');
  if (navMensajes) {
    navMensajes.addEventListener('click', () => {
      sessionStorage.setItem(`notifications_cleared_at_${userId}`, Date.now().toString());
    });
  }

  const profileBtn = document.getElementById('profileBtn');
  const profileMenu = document.getElementById('profileMenu');
  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (notifOpen) {
        notifOpen = false;
        const dd = document.getElementById('notificationDropdown');
        if (dd) dd.style.display = 'none';
      }
      profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
    });
    document.addEventListener('click', () => { profileMenu.style.display = 'none'; });
  }

  const themeBtns = container ? container.querySelectorAll('.theme-btn') : [];
  themeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const theme = btn.getAttribute('data-theme');
      themeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (theme === 'light') {
        document.body.classList.add('light-mode');
        localStorage.setItem('site_theme', 'light');
      } else if (theme === 'dark') {
        document.body.classList.remove('light-mode');
        localStorage.setItem('site_theme', 'dark');
      } else if (theme === 'system') {
        localStorage.setItem('site_theme', 'system');
        if (window.matchMedia('(prefers-color-scheme: light)').matches) {
          document.body.classList.add('light-mode');
        } else {
          document.body.classList.remove('light-mode');
        }
      }
    });
  });

  const cerrarBtn = document.getElementById('cerrarSesionBtn');
  if (cerrarBtn) {
    cerrarBtn.addEventListener('click', async () => {
      const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
      await signOut(auth);
      // Conservamos el registro de propiedades ya vistas para que no vuelvan a sonar al re-entrar
      const keep = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('props_')) keep[k] = localStorage.getItem(k);
      }
      localStorage.clear();
      Object.entries(keep).forEach(([k, v]) => localStorage.setItem(k, v));
      sessionStorage.clear();
      window.location.href = R('index.html');
    });
  }
}
