/**
 * interfaz/vista_fichadas.js
 * Pantalla principal: cargar el .dat, ver la tabla, exportar.
 */

import { parsearDat } from '../nucleo/parser_dat.js';
import { construirJornadas, filtrarJornadas, resumirPorEmpleado, totalizar } from '../nucleo/calculo.js';
import { exportarExcel } from '../nucleo/exportar.js';
import { ESTADOS_JORNADA, UI, BARRA } from '../constantes.js';
import { fechaLegible, escaparHtml, minutosDelDia } from '../util.js';
import {
  avisar,
  leerArchivoTexto,
  habilitarArrastre,
  habilitarOrden,
  comparador,
  mostrar,
  texto,
} from './componentes.js';

const ETIQUETA_ESTADO = {
  [ESTADOS_JORNADA.OK]: 'OK',
  [ESTADOS_JORNADA.INCOMPLETA]: 'Incompleta',
  [ESTADOS_JORNADA.REVISAR]: 'Revisar',
};

const VENTANA = BARRA.FIN_MIN - BARRA.INICIO_MIN;

/** Pasa un minuto del dia a porcentaje de la pista, recortado a los bordes. */
function aPorcentaje(minutos) {
  const dentro = Math.min(Math.max(minutos, BARRA.INICIO_MIN), BARRA.FIN_MIN);
  return ((dentro - BARRA.INICIO_MIN) / VENTANA) * 100;
}

export function crearVistaFichadas(estado) {
  const el = {
    zona: document.getElementById('zona-carga'),
    input: document.getElementById('archivo-dat'),
    boton: document.getElementById('btn-elegir'),
    lectura: document.getElementById('lectura'),
    resultados: document.getElementById('resultados'),
    vacio: document.getElementById('sin-datos'),
    cuerpo: document.getElementById('tabla-jornadas-cuerpo'),
    tabla: document.getElementById('tabla-jornadas'),
    cuerpoResumen: document.getElementById('tabla-resumen-cuerpo'),
    tablaResumen: document.getElementById('tabla-resumen'),
    escala: document.getElementById('escala-horas'),
    filtroEmpleado: document.getElementById('filtro-empleado'),
    filtroDesde: document.getElementById('filtro-desde'),
    filtroHasta: document.getElementById('filtro-hasta'),
    filtroTexto: document.getElementById('filtro-texto'),
    filtroObs: document.getElementById('filtro-observaciones'),
    btnLimpiar: document.getElementById('btn-limpiar-filtros'),
    btnExcel: document.getElementById('btn-excel'),
    btnDescartar: document.getElementById('btn-descartar'),
    errores: document.getElementById('panel-errores'),
    erroresLista: document.getElementById('lista-errores'),
    avisoSinCargar: document.getElementById('aviso-sin-cargar'),
    avisoBoton: document.getElementById('aviso-sin-cargar-boton'),
  };

  let orden = { clave: 'fecha', desc: false, tipo: 'texto' };
  let ordenResumen = { clave: 'legajo', desc: false, tipo: 'legajo' };

  pintarEscala();

  /** Rotulos de hora en el encabezado de la columna de jornada. */
  function pintarEscala() {
    el.escala.innerHTML = BARRA.ESCALA.map((hora) => {
      const izq = aPorcentaje(hora * 60);
      return `<span class="escala-marca" style="left:${izq.toFixed(2)}%">${String(hora).padStart(2, '0')}</span>`;
    }).join('');
  }

  /* ---------------- carga del archivo ---------------- */

  async function cargarArchivo(archivo) {
    const nombre = archivo.name.toLowerCase();
    if (!UI.EXTENSIONES_ACEPTADAS.some((ext) => nombre.endsWith(ext))) {
      avisar(`"${archivo.name}" no es un archivo del reloj. Se esperaba ${UI.EXTENSIONES_ACEPTADAS.join(' o ')}.`, 'error');
      return;
    }

    try {
      const lectura = parsearDat(await leerArchivoTexto(archivo), archivo.name);

      if (!lectura.marcas.length) {
        avisar('El archivo no tiene marcas legibles. Revisa que sea la bajada del reloj.', 'error');
        return;
      }

      estado.lectura = lectura;
      estado.filtrosIniciados = false;
      await recalcular();
      avisar(`${lectura.marcas.length} marcas leidas de ${lectura.legajos.length} legajos.`, 'ok');
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  /** Recalcula las jornadas contra el padron actual. */
  async function recalcular() {
    if (!estado.lectura) return;

    let mapa = new Map();
    try {
      mapa = await estado.repo.mapa();
    } catch (error) {
      avisar(`No se pudo leer el padron de empleados: ${error.message}`, 'error');
    }

    estado.jornadas = construirJornadas(estado.lectura.marcas, mapa).jornadas;

    if (!estado.filtrosIniciados) {
      el.filtroDesde.value = estado.lectura.rango?.desde || '';
      el.filtroHasta.value = estado.lectura.rango?.hasta || '';
      el.filtroEmpleado.value = '';
      el.filtroTexto.value = '';
      el.filtroObs.checked = false;
      estado.filtrosIniciados = true;
    }

    pintarLectura();
    poblarSelectorEmpleados();
    pintar();
  }

  function pintarLectura() {
    const l = estado.lectura;
    mostrar(el.lectura, true);
    mostrar(el.resultados, true);
    mostrar(el.vacio, false);
    mostrar(el.zona, false);

    texto('lectura-serie', l.serie || '-');
    texto('lectura-archivo', l.archivo);
    texto('lectura-marcas', String(l.marcas.length));
    texto('lectura-legajos', String(l.legajos.length));

    const periodo = l.rango
      ? l.rango.desde === l.rango.hasta
        ? fechaLegible(l.rango.desde)
        : `${fechaLegible(l.rango.desde)} al ${fechaLegible(l.rango.hasta)}`
      : '-';
    texto('lectura-rango', periodo);
    texto('menu-detalle-fichadas', periodo === '-' ? 'sin archivo' : periodo);

    if (l.errores.length) {
      mostrar(el.errores, true);
      texto('errores-cantidad', String(l.errores.length));
      el.erroresLista.innerHTML = l.errores
        .slice(0, 20)
        .map(
          (e) =>
            `<li><span class="linea-nro">Linea ${e.linea}</span> ${escaparHtml(e.motivo)}<code>${escaparHtml(e.contenido)}</code></li>`
        )
        .join('');
    } else {
      mostrar(el.errores, false);
    }
  }

  function poblarSelectorEmpleados() {
    const previo = el.filtroEmpleado.value;
    const vistos = new Map();
    for (const j of estado.jornadas) {
      if (!vistos.has(j.legajo)) vistos.set(j.legajo, j.nombre);
    }

    const opciones = ['<option value="">Todos los empleados</option>'];
    for (const [legajo, nombre] of [...vistos.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], 'es', { numeric: true })
    )) {
      const etiqueta = nombre ? `${legajo} — ${nombre}` : `${legajo} — (sin cargar)`;
      opciones.push(`<option value="${escaparHtml(legajo)}">${escaparHtml(etiqueta)}</option>`);
    }

    el.filtroEmpleado.innerHTML = opciones.join('');
    el.filtroEmpleado.value = previo;
  }

  /* ---------------- pintado ---------------- */

  function filtrosActuales() {
    return {
      legajo: el.filtroEmpleado.value,
      desde: el.filtroDesde.value,
      hasta: el.filtroHasta.value,
      texto: el.filtroTexto.value,
      soloObservaciones: el.filtroObs.checked,
    };
  }

  function pintar() {
    const filtradas = filtrarJornadas(estado.jornadas, filtrosActuales());
    const ordenadas = [...filtradas].sort(comparador(orden.clave, orden.desc, orden.tipo));

    el.cuerpo.innerHTML = ordenadas.length
      ? ordenadas.map(filaJornada).join('')
      : `<tr><td colspan="9" class="celda-vacia">Ningun registro coincide con los filtros.</td></tr>`;

    const t = totalizar(filtradas);
    texto('kpi-empleados', String(t.empleados));
    texto('kpi-jornadas', String(t.jornadas));
    texto('kpi-horas', t.horasTexto || '0:00');
    texto('kpi-pendientes', String(t.incompletas + t.aRevisar));
    texto(
      'conteo-filas',
      `${ordenadas.length} de ${estado.jornadas.length} jornada${estado.jornadas.length === 1 ? '' : 's'}`
    );

    // El aviso de legajos sin cargar solo tiene sentido si el usuario puede
    // hacer algo al respecto: el operador no tiene acceso al padron.
    const puedeEditarPadron = Boolean(estado.puedeEditarPadron);
    mostrar(el.avisoSinCargar, t.sinEmpleado > 0);
    mostrar(el.avisoBoton, puedeEditarPadron);
    if (t.sinEmpleado > 0) {
      const plural = t.sinEmpleado === 1 ? '' : 's';
      texto(
        'aviso-sin-cargar-texto',
        puedeEditarPadron
          ? `${t.sinEmpleado} legajo${plural} del reloj todavia no tiene${plural ? 'n' : ''} empleado cargado.`
          : `${t.sinEmpleado} legajo${plural} del reloj no tiene${plural ? 'n' : ''} nombre cargado. Pedile a un administrador que los complete.`
      );
    }

    const resumen = resumirPorEmpleado(filtradas);
    const resumenOrdenado = [...resumen].sort(
      comparador(ordenResumen.clave, ordenResumen.desc, ordenResumen.tipo)
    );
    el.cuerpoResumen.innerHTML = resumenOrdenado.length
      ? resumenOrdenado.map(filaResumen).join('')
      : `<tr><td colspan="7" class="celda-vacia">Sin datos.</td></tr>`;
  }

  /**
   * Dibuja la jornada sobre la escala horaria.
   * Jornada completa: un bloque de entrada a salida.
   * Marca suelta: un tic con cola punteada, que se lee como "esto no cerro".
   */
  function pistaJornada(j) {
    if (!j.entrada) return '<span class="pista-vacia">sin marcas</span>';

    const ini = minutosDelDia(j.entrada.ts);

    if (!j.salida) {
      const izq = aPorcentaje(ini);
      const resto = Math.max(0, 100 - izq - 0.4);
      return `<div class="pista" title="Marca sin par a las ${j.horaEntrada}">
        <span class="tic" style="left:${izq.toFixed(2)}%"></span>
        <span class="cola" style="left:${(izq + 0.4).toFixed(2)}%;width:${Math.min(resto, 14).toFixed(2)}%"></span>
      </div>`;
    }

    const fin = minutosDelDia(j.salida.ts);
    const izq = aPorcentaje(ini);
    const der = aPorcentaje(fin);
    const ancho = Math.max(der - izq, 0.6);

    const clases = ['barra'];
    if (j.estado === ESTADOS_JORNADA.REVISAR) clases.push('barra--revisar');
    if (ini < BARRA.INICIO_MIN) clases.push('barra--corte-izq');
    if (fin > BARRA.FIN_MIN) clases.push('barra--corte-der');

    return `<div class="pista">
      <span class="${clases.join(' ')}" style="left:${izq.toFixed(2)}%;width:${ancho.toFixed(2)}%"
        title="${j.horaEntrada} a ${j.horaSalida} · ${j.horasTexto}"></span>
    </div>`;
  }

  function filaJornada(j) {
    const clases = [];
    if (j.estado === ESTADOS_JORNADA.INCOMPLETA) clases.push('fila--incompleta');
    if (j.estado === ESTADOS_JORNADA.REVISAR) clases.push('fila--revisar');
    if (j.finDeSemana) clases.push('fila--finde');

    const nombre = j.nombre ? escaparHtml(j.nombre) : '<span class="sin-cargar">sin cargar</span>';

    return `<tr class="${clases.join(' ')}">
      <td class="num">${escaparHtml(j.legajo)}</td>
      <td>${nombre}</td>
      <td class="num">${fechaLegible(j.fecha)}</td>
      <td class="dia">${escaparHtml(j.dia)}</td>
      <td>${pistaJornada(j)}</td>
      <td class="num hora">${j.horaEntrada || '<span class="falta">--:--</span>'}</td>
      <td class="num hora">${j.horaSalida || '<span class="falta">--:--</span>'}</td>
      <td class="num total">${j.horasTexto || '<span class="falta">--</span>'}</td>
      <td class="obs">
        <span class="chip chip--${j.estado}">${ETIQUETA_ESTADO[j.estado]}</span>
        ${j.observacion ? `<span class="obs-texto">${escaparHtml(j.observacion)}</span>` : ''}
      </td>
    </tr>`;
  }

  function filaResumen(r) {
    const nombre = r.nombre ? escaparHtml(r.nombre) : '<span class="sin-cargar">sin cargar</span>';
    const pendientes = r.incompletas + r.aRevisar;
    return `<tr>
      <td class="num">${escaparHtml(r.legajo)}</td>
      <td>${nombre}</td>
      <td>${escaparHtml(r.sector)}</td>
      <td class="num">${r.dias}</td>
      <td class="num total">${r.horasTexto}</td>
      <td class="num hora">${r.promedioTexto || '-'}</td>
      <td class="num">${pendientes ? `<span class="chip chip--revisar">${pendientes}</span>` : '-'}</td>
    </tr>`;
  }

  /* ---------------- acciones ---------------- */

  function exportar() {
    try {
      const filtradas = filtrarJornadas(estado.jornadas, filtrosActuales());
      const ordenadas = [...filtradas].sort(comparador(orden.clave, orden.desc, orden.tipo));
      const nombre = exportarExcel(ordenadas, resumirPorEmpleado(filtradas), {
        serie: estado.lectura?.serie,
        archivo: estado.lectura?.archivo,
        rango: {
          desde: el.filtroDesde.value || estado.lectura?.rango?.desde,
          hasta: el.filtroHasta.value || estado.lectura?.rango?.hasta,
        },
      });
      avisar(`Excel generado: ${nombre}`, 'ok');
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  function descartar() {
    estado.lectura = null;
    estado.jornadas = [];
    el.input.value = '';
    mostrar(el.zona, true);
    mostrar(el.lectura, false);
    mostrar(el.resultados, false);
    mostrar(el.errores, false);
    mostrar(el.vacio, true);
    mostrar(el.avisoSinCargar, false);
    texto('menu-detalle-fichadas', 'sin archivo');
  }

  /* ---------------- cableado ---------------- */

  el.boton.addEventListener('click', () => el.input.click());
  el.input.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) cargarArchivo(archivo);
  });
  habilitarArrastre(el.zona, cargarArchivo);

  [el.filtroEmpleado, el.filtroDesde, el.filtroHasta, el.filtroObs].forEach((c) =>
    c.addEventListener('change', pintar)
  );
  el.filtroTexto.addEventListener('input', pintar);

  el.btnLimpiar.addEventListener('click', () => {
    el.filtroEmpleado.value = '';
    el.filtroTexto.value = '';
    el.filtroObs.checked = false;
    el.filtroDesde.value = estado.lectura?.rango?.desde || '';
    el.filtroHasta.value = estado.lectura?.rango?.hasta || '';
    pintar();
  });

  el.btnExcel.addEventListener('click', exportar);
  el.btnDescartar.addEventListener('click', descartar);

  habilitarOrden(el.tabla, (clave, desc, tipo) => {
    orden = { clave, desc, tipo };
    pintar();
  });
  habilitarOrden(el.tablaResumen, (clave, desc, tipo) => {
    ordenResumen = { clave, desc, tipo };
    pintar();
  });

  return { refrescar: recalcular, limpiar: descartar };
}
