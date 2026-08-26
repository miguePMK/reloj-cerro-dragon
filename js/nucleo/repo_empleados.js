/**
 * nucleo/repo_empleados.js
 * Acceso a los empleados del reloj.
 *
 * La interfaz es asincronica a proposito: hoy guarda en localStorage,
 * y en la fase 2 se reemplaza por Firestore sin tocar la interfaz ni la
 * logica de calculo. Cualquier repo nuevo solo tiene que implementar
 * estos mismos metodos.
 */

import { ALMACENAMIENTO, PARSER } from '../constantes.js';
import { normalizarLegajo } from '../util.js';

/** Deja un empleado en forma canonica. Devuelve null si el legajo no sirve. */
export function normalizarEmpleado(crudo) {
  const legajo = normalizarLegajo(crudo?.legajo ?? crudo?.Legajo, PARSER.QUITAR_CEROS_IZQUIERDA);
  if (!legajo) return null;
  return {
    legajo,
    nombre: String(crudo?.nombre ?? crudo?.Nombre ?? '').trim(),
    sector: String(crudo?.sector ?? crudo?.Sector ?? '').trim(),
    activo: crudo?.activo === undefined ? true : Boolean(crudo.activo),
  };
}

export class RepoEmpleadosLocal {
  constructor(clave = ALMACENAMIENTO.CLAVE_EMPLEADOS) {
    this.clave = clave;
  }

  _leer() {
    try {
      const bruto = localStorage.getItem(this.clave);
      const datos = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(datos) ? datos : [];
    } catch {
      return [];
    }
  }

  _escribir(lista) {
    localStorage.setItem(this.clave, JSON.stringify(lista));
  }

  async listar() {
    return this._leer().sort((a, b) => a.legajo.localeCompare(b.legajo, 'es', { numeric: true }));
  }

  /** legajo -> empleado, para que el calculo resuelva nombres. */
  async mapa() {
    const m = new Map();
    for (const e of await this.listar()) m.set(e.legajo, e);
    return m;
  }

  async obtener(legajo) {
    const l = normalizarLegajo(legajo);
    return this._leer().find((e) => e.legajo === l) || null;
  }

  /** Alta o modificacion segun exista el legajo. */
  async guardar(crudo) {
    const emp = normalizarEmpleado(crudo);
    if (!emp) throw new Error('El legajo es obligatorio');
    const lista = this._leer();
    const i = lista.findIndex((e) => e.legajo === emp.legajo);
    if (i >= 0) lista[i] = emp;
    else lista.push(emp);
    this._escribir(lista);
    return emp;
  }

  async eliminar(legajo) {
    const l = normalizarLegajo(legajo);
    this._escribir(this._leer().filter((e) => e.legajo !== l));
  }

  /**
   * Carga masiva. Devuelve cuantos entraron nuevos y cuantos se actualizaron.
   * @param {boolean} reemplazar si es true borra todo lo anterior
   */
  async importar(lista, reemplazar = false) {
    const validos = (lista || []).map(normalizarEmpleado).filter(Boolean);
    const actuales = reemplazar ? [] : this._leer();
    const indice = new Map(actuales.map((e) => [e.legajo, e]));

    let nuevos = 0;
    let actualizados = 0;
    for (const emp of validos) {
      if (indice.has(emp.legajo)) actualizados += 1;
      else nuevos += 1;
      indice.set(emp.legajo, emp);
    }

    this._escribir([...indice.values()]);
    return { nuevos, actualizados, ignorados: (lista || []).length - validos.length };
  }

  async vaciar() {
    this._escribir([]);
  }
}

/** Punto unico de creacion para el modo local. En modo Firebase, main.js usa RepoEmpleadosFirestore. */
export function crearRepoEmpleadosLocal() {
  return new RepoEmpleadosLocal();
}

/* ------------------------------------------------------------------ */
/* Importacion desde archivos                                          */
/* ------------------------------------------------------------------ */

/** Lee un CSV simple: legajo,nombre,sector  (con o sin encabezado). */
export function empleadosDesdeCsv(texto) {
  const lineas = String(texto ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const salida = [];

  for (const linea of lineas) {
    if (!linea.trim()) continue;
    const cols = linea.split(/[;,\t]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    // Salta el encabezado.
    if (/^legajo$/i.test(cols[0])) continue;
    const emp = normalizarEmpleado({ legajo: cols[0], nombre: cols[1], sector: cols[2] });
    if (emp) salida.push(emp);
  }
  return salida;
}

/** Lee un JSON exportado por esta misma app. */
export function empleadosDesdeJson(texto) {
  const datos = JSON.parse(texto);
  const lista = Array.isArray(datos) ? datos : datos?.empleados;
  if (!Array.isArray(lista)) throw new Error('El JSON no tiene una lista de empleados');
  return lista.map(normalizarEmpleado).filter(Boolean);
}
