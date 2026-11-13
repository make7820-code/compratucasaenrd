/* =========================================================
   MARCA DE AGUA para fotos y videos descargados
   Compartido por propiedades.html y detalle.html.
   Regla: NUNCA se entrega un archivo sin marca de agua.
   Si no se puede marcar, no se descarga nada.
   Para cambiar la apariencia, edita las constantes de MARCA.
========================================================= */

export const MARCA = {
  logo: 'assets/mi-logo.png',
  texto: 'Compra tu casa en RD',
  dominio: 'compratucasard.com',
  opacidadCentro: 0.30,   // 0 = invisible, 1 = sólido
  anchoCentro: 0.38,      // ancho del logo como fracción del ancho del archivo
  maxLado: 4096,          // límite de tamaño de fotos
  maxLadoVideo: 1280      // límite de tamaño de videos (el proceso es en tiempo real)
};

/* ---------- utilidades ---------- */

export function toast(texto, ms = 4500) {
  const t = document.createElement('div');
  t.textContent = texto;
  t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#18181b;color:#fff;border:1px solid rgba(255,255,255,0.15);padding:12px 20px;border-radius:12px;font-size:14px;z-index:99999;box-shadow:0 10px 30px rgba(0,0,0,0.4);max-width:90vw;text-align:center;';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function limpiarNombre(txt) {
  return (txt || 'propiedad').toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 50) || 'propiedad';
}

export function extension(url, def) {
  try {
    const m = new URL(url, location.href).pathname.match(/\.(jpe?g|png|webp|gif|mp4|mov|webm)$/i);
    return m ? '.' + m[1].toLowerCase() : def;
  } catch (_) { return def; }
}

export function guardarBlob(blob, nombre) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

function cargarJSZip() {
  return new Promise((resolve) => {
    if (window.JSZip) return resolve(window.JSZip);
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    sc.onload = () => resolve(window.JSZip);
    sc.onerror = () => resolve(null);
    document.head.appendChild(sc);
  });
}

let logoPromesa = null;
function cargarLogoMarca() {
  if (!logoPromesa) {
    logoPromesa = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = MARCA.logo;
    });
  }
  return logoPromesa;
}

/* Capa transparente con la marca (logo al centro + dominio abajo a la derecha).
   Se dibuja una sola vez y se pega sobre cada foto o cada fotograma del video. */
function crearCapaMarca(w, h, logo) {
  const capa = document.createElement('canvas');
  capa.width = w;
  capa.height = h;
  const ctx = capa.getContext('2d');

  ctx.save();
  ctx.globalAlpha = MARCA.opacidadCentro;
  if (logo) {
    const lw = w * MARCA.anchoCentro;
    const lh = lw * (logo.naturalHeight / logo.naturalWidth);
    ctx.drawImage(logo, (w - lw) / 2, (h - lh) / 2, lw, lh);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 ' + Math.round(w * 0.06) + 'px Inter, Arial, sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = w * 0.01;
    ctx.fillText(MARCA.texto, w / 2, h / 2);
  }
  ctx.restore();

  ctx.save();
  const fs = Math.max(14, Math.round(w * 0.026));
  ctx.font = '700 ' + fs + 'px Inter, Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = fs * 0.4;
  ctx.fillText(MARCA.dominio, w - fs, h - fs * 0.8);
  ctx.restore();

  return capa;
}

/* ---------- FOTOS ---------- */

function cargarImagenDeBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('imagen no válida')); };
    img.src = url;
  });
}

/* Devuelve { blob, nombre } con la marca aplicada. Lanza error si falla. */
export async function marcarFoto(blob, nombre) {
  const foto = await cargarImagenDeBlob(blob);
  const escala = Math.min(1, MARCA.maxLado / Math.max(foto.naturalWidth, foto.naturalHeight));
  const w = Math.round(foto.naturalWidth * escala);
  const h = Math.round(foto.naturalHeight * escala);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(foto, 0, 0, w, h);
  ctx.drawImage(crearCapaMarca(w, h, await cargarLogoMarca()), 0, 0);

  const esPng = /\.png$/i.test(nombre);
  const salida = await new Promise((res) => canvas.toBlob(res, esPng ? 'image/png' : 'image/jpeg', 0.92));
  if (!salida) throw new Error('no se pudo generar la imagen');
  return { blob: salida, nombre: esPng ? nombre : nombre.replace(/\.[a-z0-9]+$/i, '') + '.jpg' };
}

/* ---------- VIDEOS ----------
   Se vuelve a grabar el video en un canvas con la marca encima (en tiempo real:
   un video de 1 minuto tarda ~1 minuto). Hay que dejar la pestaña abierta. */

function elegirFormatoVideo() {
  const candidatos = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ];
  return candidatos.find(t => MediaRecorder.isTypeSupported(t)) || '';
}

/* Devuelve { blob, nombre } con la marca aplicada. Lanza error si falla. */
export async function marcarVideo(blob, nombre, onProgress) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Este navegador no permite marcar videos');
  }

  const urlVideo = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.src = urlVideo;
  video.playsInline = true;
  video.preload = 'auto';

  let audioCtx = null;
  let stream = null;
  let terminado = false;

  const limpiar = () => {
    terminado = true;
    try { video.pause(); } catch (_) {}
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { if (audioCtx) audioCtx.close(); } catch (_) {}
    URL.revokeObjectURL(urlVideo);
  };

  try {
    await new Promise((res, rej) => {
      video.onloadedmetadata = res;
      video.onerror = () => rej(new Error('video no válido'));
    });

    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw || !vh) throw new Error('video sin dimensiones');
    const esc = Math.min(1, MARCA.maxLadoVideo / Math.max(vw, vh));
    const w = Math.max(2, Math.round(vw * esc / 2) * 2);
    const h = Math.max(2, Math.round(vh * esc / 2) * 2);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const capa = crearCapaMarca(w, h, await cargarLogoMarca());

    stream = canvas.captureStream(30);

    // Audio: se enruta a un destino de grabación (no suena por los parlantes)
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      const fuente = audioCtx.createMediaElementSource(video);
      const destino = audioCtx.createMediaStreamDestination();
      fuente.connect(destino);
      destino.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
    } catch (_) { /* sin audio si el navegador no lo permite */ }

    const mime = elegirFormatoVideo();
    const grabador = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 5000000
    });
    const trozos = [];
    grabador.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };

    const resultado = new Promise((resolve, reject) => {
      grabador.onstop = () => resolve(new Blob(trozos, { type: (grabador.mimeType || mime || 'video/webm').split(';')[0] }));
      grabador.onerror = () => reject(new Error('error al grabar'));
    });

    const dibujar = () => {
      ctx.drawImage(video, 0, 0, w, h);
      ctx.drawImage(capa, 0, 0);
      if (onProgress && video.duration) onProgress(Math.min(1, video.currentTime / video.duration));
    };
    const bucle = () => {
      if (terminado) return;
      dibujar();
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(bucle);
      else requestAnimationFrame(bucle);
    };

    const fin = new Promise((resolve) => {
      video.onended = () => resolve();
      // Seguro por si "ended" nunca llega
      setTimeout(resolve, ((video.duration || 60) * 2 + 30) * 1000);
    });

    dibujar();
    grabador.start(500);
    try {
      await video.play();
    } catch (_) {
      video.muted = true;
      await video.play();
    }
    bucle();

    await fin;
    dibujar();
    await new Promise(r => setTimeout(r, 250));
    if (grabador.state !== 'inactive') grabador.stop();
    const salida = await resultado;
    if (!salida.size) throw new Error('video vacío');

    const ext = salida.type.includes('mp4') ? '.mp4' : '.webm';
    return { blob: salida, nombre: nombre.replace(/\.[a-z0-9]+$/i, '') + ext };
  } finally {
    limpiar();
  }
}

/* ---------- DESCARGAS ---------- */

async function traerBlob(url) {
  const resp = await fetch(url, { mode: 'cors' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  return resp.blob();
}

/* Una sola foto, con marca. */
export async function descargarFotoMarcada(url, nombreBase, btn) {
  if (btn && btn.disabled) return;
  const textoOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  try {
    const blob = await traerBlob(url);
    const m = await marcarFoto(blob, nombreBase + extension(url, '.jpg'));
    guardarBlob(m.blob, m.nombre);
  } catch (err) {
    console.warn('No se pudo descargar la foto con marca de agua', err);
    toast('No se pudo descargar esta foto. Inténtalo de nuevo.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
  }
}

/* Un solo video, con marca. */
export async function descargarVideoMarcado(url, nombreBase, btn) {
  if (btn && btn.disabled) return;
  const textoOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Preparando…'; }
  toast('Preparando el video con marca de agua. No cierres ni cambies de pestaña hasta que termine.', 7000);
  try {
    const blob = await traerBlob(url);
    const m = await marcarVideo(blob, nombreBase + extension(url, '.mp4'), (p) => {
      if (btn) btn.textContent = '⏳ ' + Math.round(p * 100) + '%';
    });
    guardarBlob(m.blob, m.nombre);
    toast('Video listo.');
  } catch (err) {
    console.warn('No se pudo descargar el video con marca de agua', err);
    toast('No se pudo descargar el video con marca de agua en este navegador.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
  }
}

/* Todas las fotos (y el video si es un archivo propio) de una propiedad, con marca.
   m = { titulo, fotos: [url], video: url|null } */
export async function descargarTodoMarcado(m, btn) {
  const base = limpiarNombre(m.titulo);
  const fotos = m.fotos || [];
  if (!fotos.length && !m.video) {
    toast('Esta propiedad no tiene fotos ni videos para descargar.');
    return;
  }

  const textoOriginal = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  if (m.video) toast('El video se marca en tiempo real. No cierres ni cambies de pestaña hasta que termine.', 7000);

  const listos = [];
  let fallos = 0;

  for (let i = 0; i < fotos.length; i++) {
    try {
      const blob = await traerBlob(fotos[i]);
      listos.push(await marcarFoto(blob, base + '-foto-' + (i + 1) + extension(fotos[i], '.jpg')));
    } catch (err) {
      console.warn('No se pudo marcar la foto', fotos[i], err);
      fallos++;
    }
  }

  if (m.video) {
    try {
      const blob = await traerBlob(m.video);
      listos.push(await marcarVideo(blob, base + '-video' + extension(m.video, '.mp4'), (p) => {
        if (btn) btn.textContent = '⏳ ' + Math.round(p * 100) + '%';
      }));
    } catch (err) {
      console.warn('No se pudo marcar el video', err);
      fallos++;
    }
  }

  if (listos.length === 1) {
    guardarBlob(listos[0].blob, listos[0].nombre);
  } else if (listos.length > 1) {
    const JSZip = await cargarJSZip();
    if (JSZip) {
      const zip = new JSZip();
      listos.forEach(d => zip.file(d.nombre, d.blob));
      guardarBlob(await zip.generateAsync({ type: 'blob' }), base + '.zip');
    } else {
      for (const d of listos) {
        guardarBlob(d.blob, d.nombre);
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  if (!listos.length) {
    toast('No se pudo descargar. Inténtalo de nuevo.');
  } else if (fallos) {
    toast('Descarga lista: ' + listos.length + ' archivo(s). ' + fallos + ' no se pudo(ieron) marcar y se omitió(eron).');
  } else {
    toast('Descarga lista: ' + listos.length + (listos.length === 1 ? ' archivo' : ' archivos') + ' con marca de agua.');
  }

  if (btn) { btn.disabled = false; btn.textContent = textoOriginal; }
}
