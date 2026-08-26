/**
 * nucleo/calculo.js
 * Convierte marcas sueltas en jornadas diarias con entrada, salida y total.
 *
 * Regla base: las marcas se agrupan SIEMPRE por legajo + dia calendario.
 * Nunca se aparean de forma secuencial a ciegas, porque eso genera
 * jornadas falsas de varios dias cuando falta una marca.
 */

import { CALCULO, ESTADOS_JORNADA } from '../constantes.js';
import { agrupar, minutosADecimal, minutosAHoraTexto, diaSemanaCorto, esFinDeSemana } from '../util.js';

/** Descarta marcas repetidas dentro de la ventana configurada. */
function deduplicar(marcasOrdenadas, ventanaSegundos) {
  const conservadas = [];
  const descartadas = [];
  for (const marca of marcasOrdenadas) {
    const ultima = conservadas[conservadas.length - 1];
    if (ultima && (marca.ts - ultima.ts) / 1000 < ventanaSegundos) {
      descartadas.push(marca);
    } else {
      conservadas.push(marca);
    }
  }
  return { conservadas, descartadas };
}

/** Redondea al multiplo configurado. */
function redondear(minutos, paso) {
  if (!paso || paso <= 0) return minutos;
  return Math.round(minutos / paso) * paso;
}

/**
 * Suma los tramos trabajados descontando las pausas intermedias.
 * Con 4 marcas (entrada, salida almuerzo, vuelta, salida) suma el tramo 1-2 y el 3-4.
 */
function minutosPorTramos(marcas) {
  let total = 0;
  for (let i = 0; i + 1 < marcas.length; i += 2) {
    total += (marcas[i + 1].ts - marcas[i].ts) / 60000;
  }
  return total;
}

/**
 * @param {Array} marcas salida de parsearDat().marcas
 * @param {Map<string,object>} mapaEmpleados legajo -> {nombre, sector}
 * @param {object} opciones sobrescribe CALCULO
 * @returns {{jornadas: Array, resumen: Array, totales: object}}
 */
export function construirJornadas(marcas, mapaEmpleados = new Map(), opciones = {}) {
  const cfg = { ...CALCULO, ...opciones };
  const jornadas = [];

  const porDia = agrupar(marcas, (m) => `${m.legajo}|${m.fecha}`);

  for (const [clave, lista] of porDia) {
    const [legajo, fecha] = clave.split('|');
    const ordenadas = [...lista].sort((a, b) => a.ts - b.ts);
    const { conservadas, descartadas } = deduplicar(ordenadas, cfg.VENTANA_DEDUP_SEGUNDOS);

    const empleado = mapaEmpleados.get(legajo) || null;
    const entrada = conservadas[0] || null;
    const salida = conservadas.length >= 2 ? conservadas[conservadas.length - 1] : null;

    let minutos = null;
    let estado = ESTADOS_JORNADA.OK;
    const notas = [];

    if (!salida) {
      estado = ESTADOS_JORNADA.INCOMPLETA;
      notas.push('Marca unica: falta la salida');
    } else {
      const brutos = cfg.DESCONTAR_PAUSAS_INTERMEDIAS && conservadas.length >= 4
        ? minutosPorTramos(conservadas)
        : (salida.ts - entrada.ts) / 60000;

      minutos = redondear(brutos, cfg.REDONDEO_MINUTOS);

      if (minutos < cfg.JORNADA_MINIMA_MINUTOS) {
        estado = ESTADOS_JORNADA.REVISAR;
        notas.push(`Jornada muy corta (${minutosAHoraTexto(minutos)})`);
      }
      if (minutos > cfg.JORNADA_MAXIMA_MINUTOS) {
        estado = ESTADOS_JORNADA.REVISAR;
        notas.push(`Jornada muy larga (${minutosAHoraTexto(minutos)})`);
      }

      const intermedias = conservadas.length - 2;
      if (intermedias > 0) {
        notas.push(
          cfg.DESCONTAR_PAUSAS_INTERMEDIAS
            ? `${intermedias} marca(s) intermedia(s) descontada(s)`
            : `${intermedias} marca(s) intermedia(s) ignorada(s)`
        );
        if (conservadas.length % 2 !== 0) {
          estado = ESTADOS_JORNADA.REVISAR;
          notas.push('Cantidad impar de marcas');
        }
      }
    }

    if (descartadas.length) {
      notas.push(`${descartadas.length} marca(s) duplicada(s) descartada(s)`);
    }
    if (!empleado) {
      notas.push('Legajo sin empleado cargado');
    }

    jornadas.push({
      legajo,
      nombre: empleado?.nombre || '',
      sector: empleado?.sector || '',
      fecha,
      dia: diaSemanaCorto(fecha),
      finDeSemana: esFinDeSemana(fecha),
      entrada,
      salida,
      horaEntrada: entrada ? entrada.hora.slice(0, 5) : '',
      horaSalida: salida ? salida.hora.slice(0, 5) : '',
      minutos,
      horasTexto: minutos === null ? '' : minutosAHoraTexto(minutos),
      horasDecimal: minutos === null ? null : minutosADecimal(minutos),
      cantidadMarcas: conservadas.length,
      duplicadas: descartadas.length,
      marcas: conservadas,
      estado,
      observacion: notas.join(' · '),
      empleadoCargado: Boolean(empleado),
    });
  }

  jornadas.sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return a.legajo.localeCompare(b.legajo, 'es', { numeric: true });
  });

  return { jornadas, resumen: resumirPorEmpleado(jornadas), totales: totalizar(jornadas) };
}

/** Un renglon por empleado con sus totales del periodo. */
export function resumirPorEmpleado(jornadas) {
  const porLegajo = agrupar(jornadas, (j) => j.legajo);
  const filas = [];

  for (const [legajo, lista] of porLegajo) {
    const conHoras = lista.filter((j) => j.minutos !== null);
    const minutos = conHoras.reduce((acc, j) => acc + j.minutos, 0);
    filas.push({
      legajo,
      nombre: lista[0].nombre,
      sector: lista[0].sector,
      dias: lista.length,
      diasCalculados: conHoras.length,
      incompletas: lista.filter((j) => j.estado === ESTADOS_JORNADA.INCOMPLETA).length,
      aRevisar: lista.filter((j) => j.estado === ESTADOS_JORNADA.REVISAR).length,
      minutos,
      horasTexto: minutosAHoraTexto(minutos),
      horasDecimal: minutosADecimal(minutos),
      promedioTexto: conHoras.length ? minutosAHoraTexto(minutos / conHoras.length) : '',
      empleadoCargado: lista[0].empleadoCargado,
    });
  }

  filas.sort((a, b) => a.legajo.localeCompare(b.legajo, 'es', { numeric: true }));
  return filas;
}

/** Totales globales para la tira de indicadores. */
export function totalizar(jornadas) {
  const conHoras = jornadas.filter((j) => j.minutos !== null);
  const minutos = conHoras.reduce((acc, j) => acc + j.minutos, 0);
  return {
    jornadas: jornadas.length,
    empleados: new Set(jornadas.map((j) => j.legajo)).size,
    minutos,
    horasTexto: minutosAHoraTexto(minutos),
    horasDecimal: minutosADecimal(minutos),
    incompletas: jornadas.filter((j) => j.estado === ESTADOS_JORNADA.INCOMPLETA).length,
    aRevisar: jornadas.filter((j) => j.estado === ESTADOS_JORNADA.REVISAR).length,
    sinEmpleado: new Set(jornadas.filter((j) => !j.empleadoCargado).map((j) => j.legajo)).size,
  };
}

/** Aplica los filtros de la pantalla sobre las jornadas ya calculadas. */
export function filtrarJornadas(jornadas, filtros = {}) {
  const { legajo, desde, hasta, soloObservaciones, texto } = filtros;
  const busqueda = (texto || '').trim().toLowerCase();

  return jornadas.filter((j) => {
    if (legajo && j.legajo !== legajo) return false;
    if (desde && j.fecha < desde) return false;
    if (hasta && j.fecha > hasta) return false;
    if (soloObservaciones && j.estado === ESTADOS_JORNADA.OK) return false;
    if (busqueda) {
      const bolsa = `${j.legajo} ${j.nombre} ${j.sector}`.toLowerCase();
      if (!bolsa.includes(busqueda)) return false;
    }
    return true;
  });
}
