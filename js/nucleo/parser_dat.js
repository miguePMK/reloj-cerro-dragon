/**
 * nucleo/parser_dat.js
 * Lee el attlog.dat del reloj biometrico y devuelve marcas normalizadas.
 * Formato ZKTeco:
 *   legajo <TAB> YYYY-MM-DD HH:MM:SS <TAB> estado <TAB> verificacion <TAB> workcode <TAB> reservado
 *
 * Sin acceso al DOM. Recibe texto, devuelve datos.
 */

import { PARSER } from '../constantes.js';
import { aFechaLocal, normalizarLegajo } from '../util.js';

const RE_FECHA_HORA = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/;

/** Extrae el numero de serie del reloj del nombre de archivo (ZTC8252300165_attlog.dat). */
export function serieDesdeNombre(nombreArchivo) {
  if (!nombreArchivo) return '';
  const m = String(nombreArchivo).match(/^([A-Za-z0-9]+)_attlog/i);
  return m ? m[1] : '';
}

/** Parte una linea en columnas: por tabulacion, o por espacios si no hay tabs. */
function partirLinea(linea) {
  if (linea.includes(PARSER.SEPARADOR)) {
    return linea.split(PARSER.SEPARADOR).map((c) => c.trim());
  }
  // Fallback: ancho fijo separado por espacios. La fecha y hora quedan
  // partidas en dos, asi que las volvemos a unir.
  const partes = linea.trim().split(/\s+/);
  if (partes.length >= 3 && /^\d{4}-\d{1,2}-\d{1,2}$/.test(partes[1]) && /^\d{1,2}:\d{2}/.test(partes[2])) {
    return [partes[0], `${partes[1]} ${partes[2]}`, ...partes.slice(3)];
  }
  return partes;
}

/**
 * @param {string} texto contenido completo del .dat
 * @param {string} nombreArchivo para extraer el numero de serie del reloj
 * @returns {{marcas: Array, errores: Array, serie: string, legajos: string[], rango: {desde: string, hasta: string}|null}}
 */
export function parsearDat(texto, nombreArchivo = '') {
  const marcas = [];
  const errores = [];

  // Saca el BOM si el archivo viene de Windows con firma UTF-8.
  const contenido = String(texto ?? '').replace(/^\uFEFF/, '');
  const lineas = contenido.split(/\r?\n/);

  lineas.forEach((lineaCruda, i) => {
    const nroLinea = i + 1;
    const linea = lineaCruda.replace(/\r$/, '');
    if (!linea.trim()) return; // linea vacia: se ignora en silencio

    const cols = partirLinea(linea);

    if (cols.length < PARSER.COLUMNAS_MINIMAS) {
      errores.push({ linea: nroLinea, contenido: linea.trim(), motivo: 'Faltan columnas' });
      return;
    }

    const legajo = normalizarLegajo(cols[PARSER.COL_LEGAJO], PARSER.QUITAR_CEROS_IZQUIERDA);
    if (!legajo) {
      errores.push({ linea: nroLinea, contenido: linea.trim(), motivo: 'Legajo vacio' });
      return;
    }

    const bruto = (cols[PARSER.COL_FECHA_HORA] || '').trim();
    const m = bruto.match(RE_FECHA_HORA);
    if (!m) {
      errores.push({ linea: nroLinea, contenido: linea.trim(), motivo: `Fecha y hora ilegible: "${bruto}"` });
      return;
    }

    const [, a, mes, d, hh, mm, ss] = m;
    const fechaIso = `${a}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hora = `${String(hh).padStart(2, '0')}:${mm}:${ss || '00'}`;
    const ts = aFechaLocal(fechaIso, hora);

    if (Number.isNaN(ts.getTime())) {
      errores.push({ linea: nroLinea, contenido: linea.trim(), motivo: 'Fecha invalida' });
      return;
    }

    const codigoVerif = cols[PARSER.COL_VERIFICACION];
    marcas.push({
      legajo,
      fecha: fechaIso,
      hora,
      ts,
      estado: cols[PARSER.COL_ESTADO] ?? '',
      verificacion: PARSER.MODOS_VERIFICACION[Number(codigoVerif)] ?? String(codigoVerif ?? ''),
      linea: nroLinea,
    });
  });

  const fechas = marcas.map((x) => x.fecha).sort();
  const legajos = [...new Set(marcas.map((x) => x.legajo))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true })
  );

  return {
    marcas,
    errores,
    serie: serieDesdeNombre(nombreArchivo),
    archivo: nombreArchivo || '',
    legajos,
    rango: fechas.length ? { desde: fechas[0], hasta: fechas[fechas.length - 1] } : null,
  };
}
