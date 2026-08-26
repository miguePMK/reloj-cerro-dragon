/**
 * interfaz/vista_empleados.js
 * ABM del padron de empleados del reloj. Solo para el rol admin.
 *
 * Todas las operaciones pueden fallar (Firestore puede rechazar por reglas o
 * cortarse la conexion), asi que cada una avisa en pantalla en lugar de
 * quedar en silencio.
 */

import { empleadosDesdeCsv, empleadosDesdeJson } from '../nucleo/repo_empleados.js';
import { exportarEmpleadosJson } from '../nucleo/exportar.js';
import { escaparHtml } from '../util.js';
import { avisar, leerArchivoTexto, habilitarOrden, comparador, mostrar, texto } from './componentes.js';

export function crearVistaEmpleados(estado, alCambiarPadron) {
  const el = {
    form: document.getElementById('form-empleado'),
    legajo: document.getElementById('emp-legajo'),
    nombre: document.getElementById('emp-nombre'),
    sector: document.getElementById('emp-sector'),
    activo: document.getElementById('emp-activo'),
    btnGuardar: document.getElementById('btn-guardar-empleado'),
    btnCancelar: document.getElementById('btn-cancelar-edicion'),
    tituloForm: document.getElementById('form-titulo'),
    tabla: document.getElementById('tabla-empleados'),
    cuerpo: document.getElementById('tabla-empleados-cuerpo'),
    buscar: document.getElementById('buscar-empleado'),
    detectados: document.getElementById('panel-detectados'),
    detectadosLista: document.getElementById('lista-detectados'),
    btnAltaMasiva: document.getElementById('btn-alta-masiva'),
    inputImportar: document.getElementById('archivo-empleados'),
    btnImportar: document.getElementById('btn-importar'),
    btnExportar: document.getElementById('btn-exportar-empleados'),
    btnVaciar: document.getElementById('btn-vaciar-empleados'),
  };

  let editando = null;
  let orden = { clave: 'legajo', desc: false, tipo: 'legajo' };
  let cache = [];

  async function refrescar() {
    try {
      cache = await estado.repo.listar();
    } catch (error) {
      cache = [];
      el.cuerpo.innerHTML = `<tr><td colspan="5" class="celda-vacia">No se pudo leer el padron: ${escaparHtml(error.message)}</td></tr>`;
      texto('conteo-empleados', 'sin datos');
      return;
    }
    pintarTabla();
    pintarDetectados();
  }

  function visibles() {
    const q = el.buscar.value.trim().toLowerCase();
    const filtrados = q
      ? cache.filter((e) => `${e.legajo} ${e.nombre} ${e.sector}`.toLowerCase().includes(q))
      : cache;
    return [...filtrados].sort(comparador(orden.clave, orden.desc, orden.tipo));
  }

  function pintarTabla() {
    const lista = visibles();
    el.cuerpo.innerHTML = lista.length
      ? lista.map(fila).join('')
      : `<tr><td colspan="5" class="celda-vacia">${
          cache.length
            ? 'Ningun empleado coincide con la busqueda.'
            : 'Todavia no hay empleados. Carga el .dat y usa "Dar de alta los legajos detectados", o importa un CSV.'
        }</td></tr>`;

    const etiqueta = `${cache.length} empleado${cache.length === 1 ? '' : 's'}`;
    texto('conteo-empleados', etiqueta);
    texto('menu-detalle-empleados', etiqueta);
  }

  function fila(e) {
    return `<tr${e.activo ? '' : ' class="fila--inactiva"'}>
      <td class="num">${escaparHtml(e.legajo)}</td>
      <td>${escaparHtml(e.nombre) || '<span class="sin-cargar">sin nombre</span>'}</td>
      <td>${escaparHtml(e.sector)}</td>
      <td>${e.activo ? '<span class="chip chip--ok">Activo</span>' : '<span class="chip chip--baja">Inactivo</span>'}</td>
      <td class="acciones">
        <button type="button" class="btn btn--chico" data-accion="editar" data-legajo="${escaparHtml(e.legajo)}">Editar</button>
        <button type="button" class="btn btn--chico btn--peligro" data-accion="eliminar" data-legajo="${escaparHtml(e.legajo)}">Eliminar</button>
      </td>
    </tr>`;
  }

  /** Legajos que aparecen en el .dat pero no estan en el padron. */
  function legajosDetectados() {
    if (!estado.lectura) return [];
    const cargados = new Set(cache.map((e) => e.legajo));
    return estado.lectura.legajos.filter((l) => !cargados.has(l));
  }

  function pintarDetectados() {
    const faltantes = legajosDetectados();
    mostrar(el.detectados, faltantes.length > 0);
    if (!faltantes.length) return;

    texto(
      'detectados-titulo',
      `${faltantes.length} legajo${faltantes.length === 1 ? '' : 's'} del reloj sin cargar`
    );
    el.detectadosLista.innerHTML = faltantes
      .map((l) => `<button type="button" class="pastilla" data-legajo="${escaparHtml(l)}">${escaparHtml(l)}</button>`)
      .join('');
  }

  /* ---------------- formulario ---------------- */

  function limpiarForm() {
    editando = null;
    el.legajo.value = '';
    el.nombre.value = '';
    el.sector.value = '';
    el.activo.checked = true;
    el.legajo.disabled = false;
    el.tituloForm.textContent = 'Nuevo empleado';
    el.btnGuardar.textContent = 'Agregar empleado';
    mostrar(el.btnCancelar, false);
  }

  function cargarEnForm(emp) {
    editando = emp.legajo;
    el.legajo.value = emp.legajo;
    el.nombre.value = emp.nombre;
    el.sector.value = emp.sector;
    el.activo.checked = emp.activo;
    el.legajo.disabled = true;
    el.tituloForm.textContent = `Editar legajo ${emp.legajo}`;
    el.btnGuardar.textContent = 'Guardar cambios';
    mostrar(el.btnCancelar, true);
    el.nombre.focus();
  }

  async function guardar() {
    const legajo = editando || el.legajo.value.trim();
    if (!legajo) {
      avisar('Escribi el numero de legajo.', 'error');
      el.legajo.focus();
      return;
    }

    const nombre = el.nombre.value.trim();
    if (!nombre) {
      avisar('Escribi el nombre del empleado.', 'error');
      el.nombre.focus();
      return;
    }

    if (!editando && cache.some((e) => e.legajo === legajo)) {
      avisar(`El legajo ${legajo} ya esta cargado. Editalo desde la tabla.`, 'error');
      return;
    }

    el.btnGuardar.disabled = true;
    try {
      await estado.repo.guardar({
        legajo,
        nombre,
        sector: el.sector.value.trim(),
        activo: el.activo.checked,
      });
      avisar(editando ? `Legajo ${legajo} actualizado.` : `Legajo ${legajo} agregado.`, 'ok');
      limpiarForm();
      await refrescar();
      await alCambiarPadron();
    } catch (error) {
      avisar(`No se pudo guardar: ${error.message}`, 'error');
    } finally {
      el.btnGuardar.disabled = false;
    }
  }

  async function eliminar(legajo) {
    const emp = cache.find((e) => e.legajo === legajo);
    const quien = emp?.nombre ? `${legajo} (${emp.nombre})` : legajo;
    if (!confirm(`Eliminar el legajo ${quien} del padron?`)) return;

    try {
      await estado.repo.eliminar(legajo);
      if (editando === legajo) limpiarForm();
      avisar(`Legajo ${legajo} eliminado.`, 'ok');
      await refrescar();
      await alCambiarPadron();
    } catch (error) {
      avisar(`No se pudo eliminar: ${error.message}`, 'error');
    }
  }

  /* ---------------- carga masiva ---------------- */

  async function altaMasiva() {
    const faltantes = legajosDetectados();
    if (!faltantes.length) return;

    el.btnAltaMasiva.disabled = true;
    try {
      const r = await estado.repo.importar(
        faltantes.map((l) => ({ legajo: l, nombre: '', sector: '' })),
        false
      );
      avisar(`${r.nuevos} legajo(s) dados de alta. Completa los nombres desde la tabla.`, 'ok');
      await refrescar();
      await alCambiarPadron();
    } catch (error) {
      avisar(`No se pudo dar de alta: ${error.message}`, 'error');
    } finally {
      el.btnAltaMasiva.disabled = false;
    }
  }

  async function importarArchivo(archivo) {
    try {
      const contenido = await leerArchivoTexto(archivo);
      const esJson = archivo.name.toLowerCase().endsWith('.json');
      const lista = esJson ? empleadosDesdeJson(contenido) : empleadosDesdeCsv(contenido);

      if (!lista.length) {
        avisar('El archivo no tiene empleados legibles. Se espera legajo,nombre,sector.', 'error');
        return;
      }

      const r = await estado.repo.importar(lista, false);
      avisar(`${r.nuevos} nuevo(s), ${r.actualizados} actualizado(s).`, 'ok');
      await refrescar();
      await alCambiarPadron();
    } catch (error) {
      avisar(`No se pudo importar: ${error.message}`, 'error');
    } finally {
      el.inputImportar.value = '';
    }
  }

  /* ---------------- cableado ---------------- */

  el.btnGuardar.addEventListener('click', guardar);
  el.btnCancelar.addEventListener('click', limpiarForm);

  el.form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      guardar();
    }
  });

  el.cuerpo.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton) return;
    const legajo = boton.dataset.legajo;
    if (boton.dataset.accion === 'editar') {
      const emp = cache.find((x) => x.legajo === legajo);
      if (emp) cargarEnForm(emp);
    } else {
      eliminar(legajo);
    }
  });

  el.detectadosLista.addEventListener('click', (e) => {
    const pastilla = e.target.closest('button[data-legajo]');
    if (!pastilla) return;
    limpiarForm();
    el.legajo.value = pastilla.dataset.legajo;
    el.nombre.focus();
  });

  el.buscar.addEventListener('input', pintarTabla);
  el.btnAltaMasiva.addEventListener('click', altaMasiva);

  el.btnImportar.addEventListener('click', () => el.inputImportar.click());
  el.inputImportar.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (archivo) importarArchivo(archivo);
  });

  el.btnExportar.addEventListener('click', () => {
    if (!cache.length) {
      avisar('No hay empleados para exportar.', 'error');
      return;
    }
    exportarEmpleadosJson(cache);
  });

  el.btnVaciar.addEventListener('click', async () => {
    if (!cache.length) return;
    if (!confirm(`Borrar los ${cache.length} empleados del padron? No se puede deshacer.`)) return;

    try {
      await estado.repo.vaciar();
      limpiarForm();
      avisar('Padron vaciado.', 'ok');
      await refrescar();
      await alCambiarPadron();
    } catch (error) {
      avisar(`No se pudo vaciar: ${error.message}`, 'error');
    }
  });

  habilitarOrden(el.tabla, (clave, desc, tipo) => {
    orden = { clave, desc, tipo };
    pintarTabla();
  });

  limpiarForm();

  return { refrescar };
}
