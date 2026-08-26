/**
 * nucleo/exportar.js
 * Genera el .xlsx con SheetJS (se carga por CDN en index.html como global XLSX).
 */

import { EXPORTACION, ESTADOS_JORNADA } from '../constantes.js';
import { fechaLegible, diaSemanaLargo, selloDeTiempo } from '../util.js';

const ETIQUETA_ESTADO = {
  [ESTADOS_JORNADA.OK]: 'OK',
  [ESTADOS_JORNADA.INCOMPLETA]: 'Incompleta',
  [ESTADOS_JORNADA.REVISAR]: 'Revisar',
};

function verificarSheetJs() {
  if (typeof XLSX === 'undefined') {
    throw new Error('No se pudo cargar la libreria de Excel. Revisa la conexion e intenta de nuevo.');
  }
}

function anchos(hoja, medidas) {
  hoja['!cols'] = medidas.map((w) => ({ wch: w }));
}

/**
 * @param {Array} jornadas jornadas ya filtradas, en el orden de la pantalla
 * @param {Array} resumen filas de resumirPorEmpleado()
 * @param {object} contexto { serie, archivo, rango }
 */
export function exportarExcel(jornadas, resumen, contexto = {}) {
  verificarSheetJs();

  if (!jornadas.length) {
    throw new Error('No hay jornadas para exportar.');
  }

  const libro = XLSX.utils.book_new();

  /* --- Hoja de detalle --- */
  const detalle = jornadas.map((j) => {
    const fila = {
      Legajo: j.legajo,
      Nombre: j.nombre || '(sin cargar)',
      Sector: j.sector,
      Fecha: fechaLegible(j.fecha),
      Dia: diaSemanaLargo(j.fecha),
      Entrada: j.horaEntrada,
      Salida: j.horaSalida,
      Horas: j.horasTexto,
    };
    if (EXPORTACION.INCLUIR_HORAS_DECIMALES) {
      fila['Horas decimal'] = j.horasDecimal;
    }
    fila.Marcas = j.cantidadMarcas;
    fila.Estado = ETIQUETA_ESTADO[j.estado] || j.estado;
    fila.Observaciones = j.observacion;
    return fila;
  });

  const hojaDetalle = XLSX.utils.json_to_sheet(detalle);
  anchos(hojaDetalle, EXPORTACION.INCLUIR_HORAS_DECIMALES
    ? [9, 28, 16, 12, 11, 9, 9, 8, 13, 8, 12, 46]
    : [9, 28, 16, 12, 11, 9, 9, 8, 8, 12, 46]);
  XLSX.utils.book_append_sheet(libro, hojaDetalle, EXPORTACION.HOJA_DETALLE);

  /* --- Hoja de resumen --- */
  if (EXPORTACION.INCLUIR_HOJA_RESUMEN && resumen?.length) {
    const filas = resumen.map((r) => {
      const fila = {
        Legajo: r.legajo,
        Nombre: r.nombre || '(sin cargar)',
        Sector: r.sector,
        Dias: r.dias,
        'Dias calculados': r.diasCalculados,
        'Total horas': r.horasTexto,
      };
      if (EXPORTACION.INCLUIR_HORAS_DECIMALES) {
        fila['Total decimal'] = r.horasDecimal;
      }
      fila.Promedio = r.promedioTexto;
      fila.Incompletas = r.incompletas;
      fila['A revisar'] = r.aRevisar;
      return fila;
    });

    const hojaResumen = XLSX.utils.json_to_sheet(filas);
    anchos(hojaResumen, [9, 28, 16, 7, 15, 12, 13, 10, 13, 11]);
    XLSX.utils.book_append_sheet(libro, hojaResumen, EXPORTACION.HOJA_RESUMEN);
  }

  const partes = [EXPORTACION.PREFIJO_ARCHIVO];
  if (contexto.rango?.desde) {
    partes.push(
      contexto.rango.desde === contexto.rango.hasta
        ? contexto.rango.desde
        : `${contexto.rango.desde}_al_${contexto.rango.hasta}`
    );
  } else {
    partes.push(selloDeTiempo());
  }

  const nombre = `${partes.join('_')}.xlsx`;
  XLSX.writeFile(libro, nombre);
  return nombre;
}

/** Descarga el padron de empleados como JSON, para respaldo o para pasarlo a otra maquina. */
export function exportarEmpleadosJson(empleados) {
  const contenido = JSON.stringify(
    { generado: new Date().toISOString(), empleados },
    null,
    2
  );
  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `empleados_${selloDeTiempo()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
