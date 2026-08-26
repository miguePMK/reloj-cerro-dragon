/**
 * nucleo/repo_usuarios.js
 * Usuarios del sistema (los que entran a la pagina), no los del reloj.
 *
 * Limitacion importante: borrar una cuenta de Authentication requiere el
 * Admin SDK, que corre en servidor. Desde el navegador solo se puede
 * desactivar: el documento queda con activo=false y las reglas de Firestore
 * le niegan todo. La cuenta de Authentication sigue existiendo y hay que
 * borrarla a mano desde la consola si se quiere eliminar de verdad.
 */

import { COLECCIONES } from '../config.js';
import { obtenerFirebase, crearAppSecundaria, mensajeDeError } from '../firebase.js';
import { ROLES } from './sesion.js';

function normalizarRol(rol) {
  return rol === ROLES.ADMIN ? ROLES.ADMIN : ROLES.OPERADOR;
}

export class RepoUsuarios {
  async listar() {
    const fb = await obtenerFirebase();
    const snap = await fb.dbMod.getDocs(fb.dbMod.collection(fb.db, COLECCIONES.USUARIOS));

    const lista = [];
    snap.forEach((doc) => {
      const d = doc.data();
      lista.push({
        uid: doc.id,
        email: d.email || '',
        nombre: d.nombre || '',
        rol: normalizarRol(d.rol),
        activo: d.activo !== false,
        creado: d.creado?.toDate?.() || null,
      });
    });

    lista.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    return lista;
  }

  /**
   * Crea la cuenta de Authentication en una instancia secundaria y despues
   * escribe el perfil con la sesion del admin (que es la que tiene permiso
   * de escritura segun las reglas).
   */
  async crear({ email, clave, nombre, rol }) {
    const correo = String(email || '').trim();
    if (!correo) throw new Error('El email es obligatorio');
    if (!clave || clave.length < 6) throw new Error('La clave tiene que tener al menos 6 caracteres');
    if (!String(nombre || '').trim()) throw new Error('El nombre es obligatorio');

    const fb = await obtenerFirebase();
    const secundaria = await crearAppSecundaria();

    let uid;
    try {
      const cred = await fb.authMod.createUserWithEmailAndPassword(secundaria.auth, correo, clave);
      uid = cred.user.uid;
    } catch (error) {
      throw new Error(mensajeDeError(error));
    } finally {
      await secundaria.cerrar();
    }

    try {
      await fb.dbMod.setDoc(fb.dbMod.doc(fb.db, COLECCIONES.USUARIOS, uid), {
        email: correo,
        nombre: String(nombre).trim(),
        rol: normalizarRol(rol),
        activo: true,
        creado: fb.dbMod.serverTimestamp(),
      });
    } catch (error) {
      // La cuenta quedo creada pero sin perfil: no puede entrar, y hay que
      // avisarlo con claridad porque el email ya esta tomado.
      throw new Error(
        `Se creo la cuenta ${correo} pero no se pudo guardar el perfil (${mensajeDeError(error)}). ` +
          'Borra la cuenta desde la consola de Firebase y volve a intentar.'
      );
    }

    return { uid, email: correo, nombre, rol: normalizarRol(rol), activo: true };
  }

  async actualizar(uid, cambios) {
    const fb = await obtenerFirebase();
    const datos = {};
    if (cambios.nombre !== undefined) datos.nombre = String(cambios.nombre).trim();
    if (cambios.rol !== undefined) datos.rol = normalizarRol(cambios.rol);
    if (cambios.activo !== undefined) datos.activo = Boolean(cambios.activo);

    await fb.dbMod.updateDoc(fb.dbMod.doc(fb.db, COLECCIONES.USUARIOS, uid), datos);
  }

  async activar(uid, activo) {
    return this.actualizar(uid, { activo });
  }

  /** Manda el mail para que el usuario se ponga una clave nueva. */
  async resetClave(email) {
    const fb = await obtenerFirebase();
    try {
      await fb.authMod.sendPasswordResetEmail(fb.auth, String(email).trim());
    } catch (error) {
      throw new Error(mensajeDeError(error));
    }
  }
}
