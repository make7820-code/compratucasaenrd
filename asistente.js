// asistente.js — Asistente de IA de "Compra tu casa en RD"
// Se carga con: <script type="module" src="asistente.js"></script> (misma carpeta que firebase-config.js)
const ASISTENTE_URL = 'https://asistente-casas.makeg3.workers.dev'; // <- pega aquí la URL de tu Worker
const COLECCIONES = ['propiedades', 'properties', 'inmuebles'];
const DEBUG = true; // true = muestra el error real dentro del chat (ponlo en false cuando todo funcione)
const WHATSAPP = '18498572321';            // número de WhatsApp: código de país + número, sin + ni espacios
const WHATSAPP_VISIBLE = '+1 (849) 857-2321';
const WA_MENSAJE = 'Hola, quiero información sobre el Servicio de Captación de Propiedades.';

/* ---------- Conversación persistente (sobrevive al cambiar de página en la misma pestaña) ---------- */
const KEY = 'ia-chat-v1';
const estado = (() => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const historial = estado.historial || []; // { role: 'user' | 'model', text } -> lo que ve el modelo
const visibles = estado.visibles || [];   // { clase, texto } -> lo que ve el usuario en pantalla
let abierto = !!estado.abierto;
const guardar = () => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({
      historial: historial.slice(-20),
      visibles: visibles.slice(-40),
      abierto
    }));
  } catch {}
};

let catalogo = null, cargando = null;
let servicios = []; // artículos del blog sobre el servicio de captación (se leen de Firestore)

/* ---------- Datos ---------- */
const num = v => parseFloat(String(v ?? '').replace(/[^0-9]/g, '')) || 0;
const esDolar = (m, p) => {
  const s = String(p ?? '').toUpperCase();
  return ['USD', 'US$', 'DÓLARES', 'DOLARES'].includes(String(m || '').toUpperCase()) ||
         s.includes('USD') || s.includes('US$') || s.startsWith('$');
};
const dinero = (p, m) => p ? (esDolar(m, p) ? 'US$ ' : 'RD$ ') + num(p).toLocaleString('es-DO') : '';
const si = v => v === true || ['true', 'si', 'sí', 'on', 1].includes(v);

function cargarCatalogo() {
  if (!cargando) cargando = (async () => {
    let db, collection, getDocs;
    try { ({ db, collection, getDocs } = await import('./firebase-config.js')); }
    catch (e) { console.error('Asistente: no se pudo cargar firebase-config.js', e); return (catalogo = []); }
    for (const nombre of COLECCIONES) {
      try {
        const snap = await getDocs(collection(db, nombre));
        if (snap.empty) continue;
        catalogo = [];
        snap.forEach(d => {
          const p = d.data();
          if (p.archivada === true) return;
          catalogo.push({
            id: d.id,
            titulo: p.titulo || p.title || '',
            tipo: p.tipo || p.type || '',
            distribucion: p.distribucion || '',
            operacion: p.operacion || p.oferta || p.offer || p.tipoOferta || p.status || 'Venta',
            precio: dinero(p.precio, p.moneda || p.currency),
            precioAlquiler: dinero(p.precioAlquiler, p.monedaAlquiler),
            ubicacion: p.ubicacion || p.location || '',
            habitaciones: p.habitaciones || p.habs || 0,
            banos: p.banos || 0,
            parqueos: p.parqueos || p.parking || p.parqueo || 0,
            nivel: p.nivel || p.altura || p.piso || '',
            amueblado: si(p.amueblado ?? p.furnished),
            aceptaExtranjeros: si(p.extranjeros ?? p.extranjero ?? p.aceptanExtranjeros ?? p.permiteExtranjeros),
            negociable: si(p.negociable),
            unidades: parseInt(p.unidadesDisponibles, 10) || 1,
            extras: Array.isArray(p.extras) ? p.extras : (Array.isArray(p.comodidades) ? p.comodidades : []),
            descripcion: String(p.descripcion || p.description || '').slice(0, 220),
            agente: p.agente || '',
            foto: (Array.isArray(p.imagenes) && p.imagenes[0]) || p.image || ''
          });
        });
        break;
      } catch (e) { console.warn('Asistente: no se pudo leer', nombre); }
    }
    // Servicio de captación: se lee del blog (colección articulosBlog) para que siempre esté actualizado
    try {
      const snapB = await getDocs(collection(db, 'articulosBlog'));
      servicios = [];
      snapB.forEach(d => {
        const a = d.data();
        if (a.publicado === false) return;
        if (!sinAcentos(a.titulo).includes('captacion')) return;
        servicios.push({ titulo: String(a.titulo || ''), contenido: String(a.contenido || '').slice(0, 1500) });
      });
    } catch (e) { console.warn('Asistente: no se pudo leer articulosBlog', e); }
    if (!(catalogo || []).length) console.warn('Asistente: el catálogo está vacío (revisa COLECCIONES y firebase-config.js)');
    return (catalogo = catalogo || []);
  })();
  return cargando;
}


/* ---------- Selección de propiedades relevantes (más rápido y barato) ---------- */
const sinAcentos = t => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const IGNORAR = new Set('para una uno unos unas que con por los las del esta este estoy busco buscando necesito quiero quisiera gustaria saber algo hola favor tienen tiene hay como donde cual mas muy pesos peso'.split(' '));
function seleccionar(cat, textoUsuario, idActual, max = 30) {
  if (cat.length <= max) return cat;
  const palabras = [...new Set(sinAcentos(textoUsuario).split(/[^a-z0-9ñ]+/).filter(w => w.length >= 3 && !IGNORAR.has(w)))];
  const puntuada = cat.map((p, i) => {
    const txt = sinAcentos(JSON.stringify(p));
    let pts = p.id === idActual ? 1000 : 0;
    palabras.forEach(w => { if (txt.includes(w)) pts += 1; });
    return { p, pts, i };
  });
  return puntuada.sort((a, b) => b.pts - a.pts || a.i - b.i).slice(0, max).map(x => x.p);
}

/* ---------- Interfaz ---------- */
const css = `
#ia-btn{position:fixed;right:18px;bottom:18px;z-index:9998;width:56px;height:56px;border-radius:50%;border:0;cursor:pointer;
  background:#3b82f6;color:#fff;font-size:26px;box-shadow:0 8px 24px rgba(59,130,246,.45)}
#ia-panel{position:fixed;right:18px;bottom:86px;z-index:9999;width:370px;max-width:calc(100vw - 24px);height:540px;max-height:calc(100vh - 110px);
  display:none;flex-direction:column;background:var(--bg-card,#121214);color:var(--text-main,#fff);border:1px solid var(--border-color,rgba(255,255,255,.1));
  border-radius:18px;box-shadow:0 20px 50px rgba(0,0,0,.45);overflow:hidden;font-family:inherit}
#ia-panel.abierto{display:flex}
#ia-head{padding:14px 16px;font-weight:700;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-color,rgba(255,255,255,.1))}
#ia-head button{background:none;border:0;color:inherit;font-size:20px;cursor:pointer}
#ia-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
.ia-m{max-width:88%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-break:break-word}
.ia-bot{background:var(--bg-input,#1f1f23);align-self:flex-start;border-bottom-left-radius:4px}
.ia-user{background:#3b82f6;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
.ia-card{display:flex;gap:10px;align-items:center;margin-top:8px;padding:8px;border-radius:10px;text-decoration:none;color:inherit;
  background:var(--bg-card,#121214);border:1px solid var(--border-color,rgba(255,255,255,.1));white-space:normal}
.ia-card img{width:64px;height:52px;object-fit:cover;border-radius:8px;flex:none;background:#333}
.ia-card b{display:block;font-size:13px}.ia-card span{display:block;font-size:12px;color:var(--text-muted,#a1a1aa)}
#ia-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}
#ia-chips button{border:1px solid var(--border-color,rgba(255,255,255,.2));background:none;color:inherit;border-radius:16px;padding:6px 11px;font-size:12px;cursor:pointer}
#ia-fin{display:none;padding:12px 14px;border-top:1px solid var(--border-color,rgba(255,255,255,.1));background:var(--bg-input,#1f1f23);font-size:14px}
#ia-fin.visible{display:block}
#ia-fin div{display:flex;gap:8px;margin-top:10px}
#ia-fin button{flex:1;padding:8px;border-radius:10px;cursor:pointer;font-weight:600;border:1px solid var(--border-color,rgba(255,255,255,.2));background:none;color:inherit;font-family:inherit}
#ia-fin button.si{background:#3b82f6;border-color:#3b82f6;color:#fff}
.ia-wa{display:block;margin-top:8px;padding:10px 12px;border-radius:10px;background:#22c55e;color:#fff;font-weight:700;font-size:13px;text-align:center;text-decoration:none;white-space:normal}
.ia-wa:hover{filter:brightness(1.1)}
#ia-form{display:flex;gap:8px;padding:10px;border-top:1px solid var(--border-color,rgba(255,255,255,.1))}
#ia-form input{flex:1;min-width:0;padding:10px 12px;border-radius:12px;border:1px solid var(--border-color,rgba(255,255,255,.15));background:var(--bg-input,#1f1f23);color:inherit;font-size:14px;font-family:inherit}
#ia-form button{border:0;border-radius:12px;padding:0 16px;background:#3b82f6;color:#fff;font-weight:700;cursor:pointer}
#ia-btn:focus-visible,#ia-form button:focus-visible,#ia-form input:focus-visible{outline:2px solid #93c5fd;outline-offset:2px}`;

const el = (tag, props = {}, ...hijos) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...hijos);
  return e;
};

function render(contenedor, texto) {
  texto.split(/\[\[([^\]]+)\]\]/g).forEach((parte, i) => {
    if (i % 2 === 0) { if (parte.trim()) contenedor.append(parte); return; }
    if (parte.trim().toLowerCase() === 'whatsapp') { // botón de contacto por WhatsApp
      contenedor.append(el('a', {
        className: 'ia-wa', target: '_blank', rel: 'noopener',
        href: 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(WA_MENSAJE),
        textContent: '💬 Contactar por WhatsApp · ' + WHATSAPP_VISIBLE
      }));
      return;
    }
    const p = (catalogo || []).find(x => x.id === parte.trim());
    if (!p) return; // solo se muestran propiedades que existen de verdad
    const a = el('a', { className: 'ia-card', href: 'detalle.html?id=' + encodeURIComponent(p.id) },
      el('img', { src: p.foto || 'assets/puerto-marina.png', alt: '' }),
      el('div', {}, el('b', { textContent: p.titulo || 'Propiedad' }),
        el('span', { textContent: [p.precio || p.precioAlquiler, p.ubicacion].filter(Boolean).join(' · ') })));
    contenedor.append(a);
  });
}

function iniciar() {
  document.head.append(el('style', { textContent: css }));
  const btn = el('button', { id: 'ia-btn', textContent: '💬', title: 'Asistente', ariaLabel: 'Abrir asistente' });
  const msgs = el('div', { id: 'ia-msgs' });
  const chips = el('div', { id: 'ia-chips' });
  const input = el('input', { placeholder: 'Escribe tu pregunta…', maxLength: 400, autocomplete: 'off' });
  const form = el('form', { id: 'ia-form' }, input, el('button', { type: 'submit', textContent: 'Enviar' }));
  const cerrar = el('button', { textContent: '✕', ariaLabel: 'Cerrar' });

  // Aviso "¿Desea finalizar la conversación?"
  const fin = el('div', { id: 'ia-fin' },
    el('span', { textContent: '¿Desea finalizar la conversación?' }),
    el('div', {},
      el('button', { className: 'si', type: 'button', textContent: 'Sí, finalizar', onclick: () => finalizar() }),
      el('button', { type: 'button', textContent: 'No, seguir', onclick: () => fin.classList.remove('visible') })));

  const panel = el('div', { id: 'ia-panel' },
    el('div', { id: 'ia-head' }, el('span', { textContent: 'Asistente de Compra tu casa en RD' }), cerrar),
    msgs, chips, fin, form);
  document.body.append(btn, panel);

  const añadir = (clase, texto, persistir = true) => {
    const m = el('div', { className: 'ia-m ' + clase });
    render(m, texto);
    msgs.append(m); msgs.scrollTop = msgs.scrollHeight;
    if (persistir) { visibles.push({ clase, texto }); guardar(); }
    return m;
  };

  async function enviar(texto) {
    chips.remove();
    fin.classList.remove('visible');
    añadir('ia-user', texto);
    historial.push({ role: 'user', text: texto });
    guardar();
    const espera = añadir('ia-bot', 'Escribiendo…', false); // el "Escribiendo…" no se guarda
    try {
      if (ASISTENTE_URL.includes('TU-WORKER')) throw new Error('Falta pegar la URL real del Worker en ASISTENTE_URL');
      const cat = await cargarCatalogo();
      console.info('Asistente: propiedades cargadas =', cat.length);
      if (!cat.length) throw new Error('No se cargaron propiedades desde Firebase (¿bloqueador de anuncios, reglas de Firestore o nombre de colección?)');
      const idActual = location.pathname.includes('detalle') ? (new URLSearchParams(location.search).get('id') || '') : '';
      const r = await fetch(ASISTENTE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: (() => { const h = historial.slice(-9); while (h.length && h[0].role !== 'user') h.shift(); return h; })(),
          catalogo: seleccionar(cat, historial.filter(m => m.role === 'user').slice(-3).map(m => m.text).join(' '), idActual)
            .map(({ foto, agente, ...resto }) =>
              Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== '' && v !== false && v !== 0 && !(Array.isArray(v) && !v.length)))),
          propiedadActual: idActual,
          servicios
        })
      });
      const data = await r.json();
      if (!r.ok || !data.reply) throw new Error((data.error || 'error') + (data.detalle ? ' — ' + data.detalle : ''));
      historial.push({ role: 'model', text: data.reply });
      visibles.push({ clase: 'ia-bot', texto: data.reply });
      guardar();
      espera.textContent = ''; render(espera, data.reply);
    } catch (e) {
      console.error('Asistente:', e); // abre F12 > Consola para ver la causa exacta
      historial.pop();
      guardar();
      espera.textContent = 'No pude responder ahora. Intenta de nuevo en un momento.' + (DEBUG ? '\n\n[debug] ' + String(e.message || e).slice(0, 300) : '');
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  const saludo = () => {
    chips.textContent = '';
    añadir('ia-bot', '¡Hola! Te ayudo a encontrar propiedades en el sitio. Dime qué buscas: zona, presupuesto, habitaciones, si es compra o alquiler…', false);
    ['Apartamentos en alquiler', 'Algo cerca del metro', 'Con parqueo y amueblado', 'Servicio de captación'].forEach(t =>
      chips.append(el('button', { type: 'button', textContent: t, onclick: () => enviar(t) })));
    msgs.after(chips);
  };

  function finalizar() {
    historial.length = 0; visibles.length = 0;
    msgs.textContent = '';
    fin.classList.remove('visible');
    panel.classList.remove('abierto'); abierto = false;
    guardar();
    saludo();
  }

  // Si había una conversación guardada, se restaura; si no, saludo inicial
  if (visibles.length) {
    // Se espera al catálogo para que las tarjetas [[id]] se vuelvan a dibujar
    cargarCatalogo().then(() => visibles.forEach(v => añadir(v.clase, v.texto, false)));
  } else {
    saludo();
  }

  if (abierto) { panel.classList.add('abierto'); cargarCatalogo(); }

  form.addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (t) { input.value = ''; enviar(t); } });

  const alternar = () => {
    panel.classList.toggle('abierto');
    abierto = panel.classList.contains('abierto');
    guardar();
    if (abierto) { input.focus(); cargarCatalogo(); }
  };
  btn.addEventListener('click', alternar);
  cerrar.addEventListener('click', () => {
    // Si ya hay conversación, pregunta antes de cerrar; si no, solo cierra
    if (visibles.some(v => v.clase === 'ia-user')) fin.classList.add('visible');
    else alternar();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
