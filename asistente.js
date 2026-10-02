// asistente.js — Asistente de IA de "Compra tu casa en RD"
// Se carga con: <script type="module" src="asistente.js"></script> (misma carpeta que firebase-config.js)
const ASISTENTE_URL = 'https://asistente-casas.makeg3.workers.dev'; // <- pega aquí la URL de tu Worker
const COLECCIONES = ['propiedades', 'properties', 'inmuebles'];

let catalogo = null, cargando = null;
const historial = []; // { role: 'user' | 'model', text }

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
    if (!(catalogo || []).length) console.warn('Asistente: el catálogo está vacío (revisa COLECCIONES y firebase-config.js)');
    return (catalogo = catalogo || []);
  })();
  return cargando;
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
  const panel = el('div', { id: 'ia-panel' }, el('div', { id: 'ia-head' }, el('span', { textContent: 'Asistente de Compra tu casa en RD' }), cerrar), msgs, chips, form);
  document.body.append(btn, panel);

  const añadir = (clase, texto) => {
    const m = el('div', { className: 'ia-m ' + clase });
    render(m, texto);
    msgs.append(m); msgs.scrollTop = msgs.scrollHeight;
    return m;
  };

  async function enviar(texto) {
    chips.remove();
    añadir('ia-user', texto);
    historial.push({ role: 'user', text: texto });
    const espera = añadir('ia-bot', 'Escribiendo…');
    try {
      if (ASISTENTE_URL.includes('TU-WORKER')) throw new Error('Falta pegar la URL real del Worker en ASISTENTE_URL');
      const cat = await cargarCatalogo();
      const r = await fetch(ASISTENTE_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: (() => { const h = historial.slice(-9); while (h.length && h[0].role !== 'user') h.shift(); return h; })(),
          catalogo: cat.map(({ foto, ...resto }) => resto),
          propiedadActual: location.pathname.includes('detalle') ? (new URLSearchParams(location.search).get('id') || '') : ''
        })
      });
      const data = await r.json();
      if (!r.ok || !data.reply) throw new Error((data.error || 'error') + (data.detalle ? ' — ' + data.detalle : ''));
      historial.push({ role: 'model', text: data.reply });
      espera.textContent = ''; render(espera, data.reply);
    } catch (e) {
      console.error('Asistente:', e); // abre F12 > Consola para ver la causa exacta
      historial.pop();
      espera.textContent = 'No pude responder ahora. Intenta de nuevo en un momento.';
    }
    msgs.scrollTop = msgs.scrollHeight;
  }

  añadir('ia-bot', '¡Hola! Te ayudo a encontrar propiedades en el sitio. Dime qué buscas: zona, presupuesto, habitaciones, si es compra o alquiler…');
  ['Apartamentos en alquiler', 'Algo cerca del metro', 'Con parqueo y amueblado'].forEach(t =>
    chips.append(el('button', { type: 'button', textContent: t, onclick: () => enviar(t) })));
  msgs.after(chips);

  form.addEventListener('submit', e => { e.preventDefault(); const t = input.value.trim(); if (t) { input.value = ''; enviar(t); } });
  const alternar = () => { panel.classList.toggle('abierto'); if (panel.classList.contains('abierto')) { input.focus(); cargarCatalogo(); } };
  btn.addEventListener('click', alternar); cerrar.addEventListener('click', alternar);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
