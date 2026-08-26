/**
 * nucleo/repo_empleados_firestore.js
 * Padron de empleados del reloj, guardado en Firestore.
 *
 * Implementa exactamente la misma interfaz que RepoEmpleadosLocal, asi que
 * las vistas y el calculo no saben ni les importa de donde salen los datos.
 * El id de cada documento es el numero de legajo.
 */

import { COLECCIONES } from '../config.js';
import { obtenerFirebase } from '../firebase.js';
import { normalizarLegajo } from '../util.js';
import { normalizarEmpleado } from './repo_empleados.js';

const TOPE_LOTE = 400; // Firestore admite 500 operaciones por lote.

export class RepoEmpleadosFirestore {
  constructor() {
    this._cache = null;
  }

  async _fb() {
    return obtenerFirebase();
  }

  _invalidar() {
    this._cache = null;
  }

  async listar() {
    if (this._cache) return this._cache;

    const fb = await this._fb();
    const snap = await fb.dbMod.getDocs(fb.dbMod.collection(fb.db, COLECCIONES.EMPLEADOS));

    const lista = [];
    snap.forEach((doc) => {
      const emp = normalizarEmpleado({ ...doc.data(), legajo: doc.data().legajo || doc.id });
      if (emp) lista.push(emp);
    });

    lista.sort((a, b) => a.legajo.localeCompare(b.legajo, 'es', { numeric: true }));
    this._cache = lista;
    return lista;
  }

  async mapa() {
    const m = new Map();
    for (const e of await this.listar()) m.set(e.legajo, e);
    return m;
  }

  async obtener(legajo) {
    const l = normalizarLegajo(legajo);
    return (await this.listar()).find((e) => e.legajo === l) || null;
  }

  async guardar(crudo) {
    const emp = normalizarEmpleado(crudo);
    if (!emp) throw new Error('El legajo es obligatorio');

    const fb = await this._fb();
    await fb.dbMod.setDoc(
      fb.dbMod.doc(fb.db, COLECCIONES.EMPLEADOS, emp.legajo),
      { ...emp, actualizado: fb.dbMod.serverTimestamp() },
      { merge: true }
    );

    this._invalidar();
    return emp;
  }

  async eliminar(legajo) {
    const l = normalizarLegajo(legajo);
    const fb = await this._fb();
    await fb.dbMod.deleteDoc(fb.dbMod.doc(fb.db, COLECCIONES.EMPLEADOS, l));
    this._invalidar();
  }

  async importar(lista, reemplazar = false) {
    const validos = (lista || []).map(normalizarEmpleado).filter(Boolean);
    const fb = await this._fb();
    const previos = new Set((await this.listar()).map((e) => e.legajo));

    if (reemplazar) await this.vaciar();

    let nuevos = 0;
    let actualizados = 0;

    for (let i = 0; i < validos.length; i += TOPE_LOTE) {
      const lote = fb.dbMod.writeBatch(fb.db);
      for (const emp of validos.slice(i, i + TOPE_LOTE)) {
        lote.set(
          fb.dbMod.doc(fb.db, COLECCIONES.EMPLEADOS, emp.legajo),
          { ...emp, actualizado: fb.dbMod.serverTimestamp() },
          { merge: true }
        );
        if (!reemplazar && previos.has(emp.legajo)) actualizados += 1;
        else nuevos += 1;
      }
      await lote.commit();
    }

    this._invalidar();
    return { nuevos, actualizados, ignorados: (lista || []).length - validos.length };
  }

  async vaciar() {
    const fb = await this._fb();
    const actuales = await this.listar();

    for (let i = 0; i < actuales.length; i += TOPE_LOTE) {
      const lote = fb.dbMod.writeBatch(fb.db);
      for (const emp of actuales.slice(i, i + TOPE_LOTE)) {
        lote.delete(fb.dbMod.doc(fb.db, COLECCIONES.EMPLEADOS, emp.legajo));
      }
      await lote.commit();
    }

    this._invalidar();
  }
}
