/**
 * util.js
 * Helpers compartidos. Sin dependencias, sin acceso al DOM.
 */

import { UI } from './constantes.js';

/** Convierte 'YYYY-MM-DD' + 'HH:MM:SS' a Date local (sin lios de zona horaria). */
export function aFechaLocal(fechaIso, hora) {
  const [a, m, d] = fechaIso.split('-').map(Number);
  const [hh, mm, ss] = (hora || '00:00:00').split(':').map(Number);
  return new Date(a, m - 1, d, hh, mm, ss || 0);
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY' */
export function fechaLegible(fechaIso) {
  if (!fechaIso) return '';
  const [a, m, d] = fechaIso.split('-');
  return `${d}/${m}/${a}`;
}

/** 'YYYY-MM-DD' -> 'Lun' */
export function diaSemanaCorto(fechaIso) {
  const f = aFechaLocal(fechaIso, '12:00:00');
  return UI.DIAS_SEMANA_CORTO[f.getDay()];
}

/** 'YYYY-MM-DD' -> 'Lunes' */
export function diaSemanaLargo(fechaIso) {
  const f = aFechaLocal(fechaIso, '12:00:00');
  return UI.DIAS_SEMANA[f.getDay()];
}

/** true si la fecha ISO cae sabado o domingo. */
export function esFinDeSemana(fechaIso) {
  const dia = aFechaLocal(fechaIso, '12:00:00').getDay();
  return dia === 0 || dia === 6;
}

/** 514 -> '8:34' */
export function minutosAHoraTexto(minutos) {
  if (minutos === null || minutos === undefined || Number.isNaN(minutos)) return '';
  const signo = minutos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${signo}${h}:${String(m).padStart(2, '0')}`;
}

/** 514 -> 8.57 */
export function minutosADecimal(minutos) {
  if (minutos === null || minutos === undefined || Number.isNaN(minutos)) return null;
  return Math.round((minutos / 60) * 100) / 100;
}

/** Date -> 'HH:MM:SS' */
export function horaDeFecha(fecha) {
  const p = (n) => String(n).padStart(2, '0');
  return `${p(fecha.getHours())}:${p(fecha.getMinutes())}:${p(fecha.getSeconds())}`;
}

/** Date -> 'HH:MM' */
export function horaCorta(fecha) {
  if (!fecha) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(fecha.getHours())}:${p(fecha.getMinutes())}`;
}

/** Date -> 'YYYY-MM-DD' */
export function fechaIsoDe(fecha) {
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}`;
}

/** Date -> minutos transcurridos del dia (07:23 -> 443). */
export function minutosDelDia(fecha) {
  if (!fecha) return null;
  return fecha.getHours() * 60 + fecha.getMinutes() + fecha.getSeconds() / 60;
}

/** Marca de tiempo compacta para nombres de archivo: '20260826-1530' */
export function selloDeTiempo(fecha = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}${p(fecha.getMonth() + 1)}${p(fecha.getDate())}-${p(fecha.getHours())}${p(fecha.getMinutes())}`;
}

/** Ordena por varias claves: ordenarPor(lista, ['legajo', 'fecha']) */
export function ordenarPor(lista, claves) {
  const cs = Array.isArray(claves) ? claves : [claves];
  return [...lista].sort((a, b) => {
    for (const c of cs) {
      const va = a[c];
      const vb = b[c];
      if (va === vb) continue;
      if (va === null || va === undefined) return 1;
      if (vb === null || vb === undefined) return -1;
      return va < vb ? -1 : 1;
    }
    return 0;
  });
}

/** Agrupa una lista en un Map usando la clave que devuelve fn. */
export function agrupar(lista, fn) {
  const mapa = new Map();
  for (const item of lista) {
    const clave = fn(item);
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(item);
  }
  return mapa;
}

/** Escapa texto para insertar en HTML. */
export function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Normaliza un legajo: saca espacios y, si corresponde, ceros a la izquierda. */
export function normalizarLegajo(valor, quitarCeros = false) {
  let l = String(valor ?? '').trim();
  if (quitarCeros && /^0+\d/.test(l)) l = l.replace(/^0+/, '');
  return l;
}
