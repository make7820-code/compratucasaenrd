/* =========================================================
   ubicacion-mapa.js
   Utilidades compartidas por publicar.html y detalle.html:
   - Sacar coordenadas de un enlace de Google Maps / Waze
   - Ubicar un sector (Nominatim / OpenStreetMap) cuando no hay enlace
   - Buscar las 2 calles más cercanas a un punto (Overpass / OpenStreetMap)
   - Dibujar el minimapa (Leaflet) y el selector de pin del formulario
   Sin API keys: todo usa servicios abiertos de OpenStreetMap.
========================================================= */

const LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
const LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
const CENTRO_RD = [18.4861, -69.9312]; // Santo Domingo, por defecto
const COLORES_CALLES = ['#f59e0b', '#3b82f6'];

let leafletPromise = null;

export function cargarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = LEAFLET_CSS;
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = LEAFLET_JS;
    s.onload = () => resolve(window.L);
    s.onerror = () => { leafletPromise = null; reject(new Error('No se pudo cargar Leaflet')); };
    document.head.appendChild(s);
  });
  return leafletPromise;
}

/* ---------- Utilidades ---------- */

function coordValida(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

export function esUrlHttp(url) {
  return /^https?:\/\//i.test((url || '').trim());
}

async function fetchJson(url, opciones = {}, ms = 9000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...opciones, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function leerCache(clave) {
  try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; }
}
function guardarCache(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) { /* sin espacio / modo privado */ }
}

/* ---------- 1) Coordenadas desde un enlace ---------- */
/* Funciona con enlaces largos de Google Maps (@lat,lng · !3d..!4d.. · ?q=lat,lng)
   y de Waze (?ll=lat,lng). Los enlaces cortos (maps.app.goo.gl, goo.gl/maps)
   no traen coordenadas y el navegador no puede abrirlos por CORS: en ese caso
   se devuelve null y se usa el pin manual o la ubicación del sector. */
export function extraerCoordsDeLink(url) {
  if (!url) return null;
  let u = String(url);
  try { u = decodeURIComponent(u); } catch (e) { /* se usa tal cual */ }
  const patrones = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|ll|query|center|destination|daddr)=(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/
  ];
  for (const re of patrones) {
    const m = u.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (coordValida(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/* ---------- 2) Ubicar el sector (cuando no hay enlace) ---------- */
export async function geocodificarSector({ distrito, municipio, provincia, ubicacion } = {}) {
  const partes = (a) => a.filter(Boolean).join(', ');
  const consultas = [
    partes([distrito, municipio, provincia, 'República Dominicana']),
    partes([municipio, provincia, 'República Dominicana'])
  ];
  // Propiedades antiguas: solo tienen el texto "distrito, municipio, provincia - detalle"
  if (!distrito && !municipio && ubicacion) {
    consultas.unshift(partes([String(ubicacion).split(' - ')[0], 'República Dominicana']));
  }
  for (const q of consultas.filter((c, i, arr) => c && arr.indexOf(c) === i)) {
    const clave = 'ub_geo_' + q.toLowerCase();
    const cache = leerCache(clave);
    if (cache && coordValida(cache.lat, cache.lng)) return cache;
    try {
      const data = await fetchJson(
        'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=do&accept-language=es&q=' +
        encodeURIComponent(q)
      );
      if (Array.isArray(data) && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (coordValida(lat, lng)) {
          const r = { lat, lng };
          guardarCache(clave, r);
          return r;
        }
      }
    } catch (e) { /* se prueba la siguiente consulta */ }
  }
  return null;
}

/* ---------- 3) Las 2 calles más cercanas ---------- */

function distPuntoSegmentoM(lat, lng, a, b) {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const px = 0, py = 0;
  const ax = (a[1] - lng) * kx, ay = (a[0] - lat) * ky;
  const bx = (b[1] - lng) * kx, by = (b[0] - lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function distMinPolilineaM(lat, lng, pts) {
  if (pts.length === 1) return distPuntoSegmentoM(lat, lng, pts[0], pts[0]);
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    min = Math.min(min, distPuntoSegmentoM(lat, lng, pts[i], pts[i + 1]));
  }
  return min;
}

/* Devuelve hasta 2 calles: [{ nombre, dist, tramos: [[[lat,lng],...], ...] }] */
export async function callesCercanas(lat, lng) {
  const clave = `ub_calles_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  try {
    const c = sessionStorage.getItem(clave);
    if (c) return JSON.parse(c);
  } catch (e) { /* sin sessionStorage */ }

  const tipos = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|' +
    'motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';
  let resultado = [];

  for (const radio of [120, 250, 400]) {
    try {
      const q = `[out:json][timeout:10];way(around:${radio},${lat},${lng})["highway"~"^(${tipos})$"]["name"];out tags geom;`;
      const data = await fetchJson('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(q)
      }, 12000);

      const porNombre = new Map();
      for (const w of data.elements || []) {
        const nombre = w.tags && w.tags.name;
        if (!nombre || !w.geometry || !w.geometry.length) continue;
        const pts = w.geometry.map(g => [g.lat, g.lon]);
        const dist = distMinPolilineaM(lat, lng, pts);
        const prev = porNombre.get(nombre);
        if (prev) {
          prev.dist = Math.min(prev.dist, dist);
          prev.tramos.push(pts);
        } else {
          porNombre.set(nombre, { nombre, dist, tramos: [pts] });
        }
      }
      resultado = [...porNombre.values()].sort((a, b) => a.dist - b.dist).slice(0, 2);
      if (resultado.length >= 2) break; // con 2 calles ya basta; si no, se amplía el radio
    } catch (e) { break; }
  }

  try { sessionStorage.setItem(clave, JSON.stringify(resultado)); } catch (e) { /* ignorar */ }
  return resultado;
}

/* ---------- 4) Resolver la ubicación de una propiedad ---------- */
/* Devuelve { lat, lng, exacta } o null.
   exacta = true  → punto real (pin guardado o coordenadas del enlace): se marcan 2 calles.
   exacta = false → solo el sector: se muestra la zona aproximada. */
export async function resolverUbicacion(prop) {
  const lat = parseFloat(prop.lat);
  const lng = parseFloat(prop.lng);
  if (coordValida(lat, lng)) {
    return { lat, lng, exacta: prop.ubicacionExacta !== false };
  }
  const c = extraerCoordsDeLink(prop.linkUbicacion);
  if (c) return { ...c, exacta: true };
  const g = await geocodificarSector(prop);
  return g ? { ...g, exacta: false } : null;
}

/* Enlace al que manda el botón "Abrir ubicación" */
export function urlAbrirUbicacion(prop, ubi) {
  const link = (prop.linkUbicacion || '').trim();
  if (esUrlHttp(link)) return link;
  if (ubi) return `https://www.google.com/maps/search/?api=1&query=${ubi.lat},${ubi.lng}`;
  const texto = prop.ubicacion || [prop.distrito, prop.municipio, prop.provincia].filter(Boolean).join(', ');
  return texto ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(texto + ', República Dominicana')}` : '';
}

/* ---------- 5) Minimapa de la ficha ---------- */

function iconoPin(L) {
  return L.divIcon({
    className: 'ub-pin',
    html: '<div style="font-size:30px;line-height:30px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));">📍</div>',
    iconSize: [30, 30],
    iconAnchor: [15, 28]
  });
}

/* Dibuja el mapa y devuelve los nombres de las calles marcadas (si exacta) */
export async function montarMapa(el, { lat, lng, exacta }) {
  const L = await cargarLeaflet();
  el.innerHTML = '';
  const mapa = L.map(el, {
    scrollWheelZoom: false,
    dragging: !L.Browser.mobile, // en celular el mapa no atrapa el scroll de la página
    zoomControl: true
  }).setView([lat, lng], exacta ? 17 : 14);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);

  if (!exacta) {
    // Sin enlace: zona aproximada del sector
    L.circle([lat, lng], {
      radius: 700, color: '#f59e0b', weight: 2, fillColor: '#f59e0b', fillOpacity: 0.18
    }).addTo(mapa);
    mapa.setView([lat, lng], 14);
    return [];
  }

  L.marker([lat, lng], { icon: iconoPin(L), keyboard: false }).addTo(mapa);
  const calles = await callesCercanas(lat, lng);
  const grupo = L.featureGroup([L.marker([lat, lng], { opacity: 0 })]);

  calles.forEach((calle, i) => {
    const color = COLORES_CALLES[i % COLORES_CALLES.length];
    let masLarga = calle.tramos[0];
    calle.tramos.forEach(pts => {
      const linea = L.polyline(pts, { color, weight: 6, opacity: 0.85 }).addTo(mapa);
      grupo.addLayer(linea);
      if (pts.length > masLarga.length) masLarga = pts;
    });
    const medio = masLarga[Math.floor(masLarga.length / 2)];
    L.marker(medio, { opacity: 0, interactive: false })
      .bindTooltip(calle.nombre, { permanent: true, direction: 'top', className: 'ub-etiqueta-calle' })
      .addTo(mapa);
  });

  if (calles.length) mapa.fitBounds(grupo.getBounds(), { padding: [30, 30], maxZoom: 18 });
  return calles.map(c => c.nombre);
}

/* ---------- 6) Selector de pin para el formulario de publicar ---------- */
export async function montarSelectorPin(el, { onChange } = {}) {
  const L = await cargarLeaflet();
  const mapa = L.map(el, { scrollWheelZoom: true }).setView(CENTRO_RD, 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(mapa);

  let marcador = null;
  const poner = (lat, lng, avisar = true) => {
    if (marcador) marcador.setLatLng([lat, lng]);
    else marcador = L.marker([lat, lng], { icon: iconoPin(L) }).addTo(mapa);
    if (avisar && onChange) onChange(lat, lng);
  };

  mapa.on('click', (e) => {
    poner(e.latlng.lat, e.latlng.lng);
  });

  return {
    setPos(lat, lng, zoom = 17) {
      poner(lat, lng, false);
      mapa.setView([lat, lng], zoom);
    },
    quitar() {
      if (marcador) { mapa.removeLayer(marcador); marcador = null; }
      mapa.setView(CENTRO_RD, 12);
    },
    centrar(lat, lng, zoom = 14) { mapa.setView([lat, lng], zoom); },
    refrescar() { setTimeout(() => mapa.invalidateSize(), 150); }
  };
}
