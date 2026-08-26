/**
 * nucleo/sesion.js
 * Login, logout y resolucion del rol. Sin acceso al DOM.
 *
 * El rol NO vive en el token: los custom claims necesitan el Admin SDK, que
 * es de servidor. Vive en el documento usuarios/{uid} de Firestore, y las
 * reglas lo leen desde ahi para autorizar cada operacion.
 */

import { COLECCIONES } from '../config.js';
import { obtenerFirebase, mensajeDeError } from '../firebase.js';

export const ROLES = {
  ADMIN: 'admin',
  OPERADOR: 'operador',
};

export const ETIQUETA_ROL = {
  [ROLES.ADMIN]: 'Administrador',
  [ROLES.OPERADOR]: 'Operador',
};

/** Error propio para poder distinguir "clave mala" de "usuario sin habilitar". */
export class ErrorSesion extends Error {
  constructor(mensaje, motivo = 'generico') {
    super(mensaje);
    this.motivo = motivo;
  }
}

/** Trae el documento usuarios/{uid} y lo valida. */
async function perfilDe(fb, usuarioAuth) {
  const ref = fb.dbMod.doc(fb.db, COLECCIONES.USUARIOS, usuarioAuth.uid);

  let snap;
  try {
    snap = await fb.dbMod.getDoc(ref);
  } catch (error) {
    throw new ErrorSesion(
      `No se pudo leer tu perfil: ${mensajeDeError(error)}`,
      'sin-permiso'
    );
  }

  if (!snap.exists()) {
    throw new ErrorSesion(
      'Tu cuenta existe pero no esta habilitada en el sistema. Pedile a un administrador que te de de alta.',
      'sin-perfil'
    );
  }

  const datos = snap.data();
  if (datos.activo === false) {
    throw new ErrorSesion('Tu usuario esta desactivado. Contacta a un administrador.', 'inactivo');
  }

  return {
    uid: usuarioAuth.uid,
    email: datos.email || usuarioAuth.email || '',
    nombre: datos.nombre || usuarioAuth.email || '',
    rol: datos.rol === ROLES.ADMIN ? ROLES.ADMIN : ROLES.OPERADOR,
    activo: true,
  };
}

/**
 * Inicia sesion y devuelve el perfil.
 * Si la cuenta autentica pero no esta habilitada, cierra la sesion antes de
 * fallar: no queremos dejar a medio loguear a alguien que no puede entrar.
 */
export async function iniciarSesion(email, clave) {
  const fb = await obtenerFirebase();

  let credencial;
  try {
    credencial = await fb.authMod.signInWithEmailAndPassword(fb.auth, email.trim(), clave);
  } catch (error) {
    throw new ErrorSesion(mensajeDeError(error), 'credenciales');
  }

  try {
    return await perfilDe(fb, credencial.user);
  } catch (error) {
    await fb.authMod.signOut(fb.auth).catch(() => {});
    throw error;
  }
}

export async function cerrarSesion() {
  const fb = await obtenerFirebase();
  await fb.authMod.signOut(fb.auth);
}

/**
 * Avisa cada vez que cambia el estado de la sesion, incluido el arranque
 * (por si el usuario ya estaba logueado de antes).
 * @param {(perfil: object|null, error: ErrorSesion|null) => void} alCambiar
 */
export async function observarSesion(alCambiar) {
  const fb = await obtenerFirebase();

  return fb.authMod.onAuthStateChanged(fb.auth, async (usuarioAuth) => {
    if (!usuarioAuth) {
      alCambiar(null, null);
      return;
    }
    try {
      alCambiar(await perfilDe(fb, usuarioAuth), null);
    } catch (error) {
      await fb.authMod.signOut(fb.auth).catch(() => {});
      alCambiar(null, error);
    }
  });
}

/** Manda el mail de restablecimiento de clave. */
export async function enviarResetClave(email) {
  const fb = await obtenerFirebase();
  try {
    await fb.authMod.sendPasswordResetEmail(fb.auth, email.trim());
  } catch (error) {
    throw new ErrorSesion(mensajeDeError(error), 'reset');
  }
}

export function esAdmin(perfil) {
  return perfil?.rol === ROLES.ADMIN;
}

/* ------------------------------------------------------------------ */
/* Puesta en marcha: el primer administrador                          */
/* ------------------------------------------------------------------ */

/**
 * true si el sistema ya tiene su administrador inicial.
 *
 * Se apoya en un documento centinela (config/sistema) porque las reglas de
 * Firestore no pueden preguntar "esta vacia la coleccion usuarios?". Ese
 * documento se lee sin estar logueado: es lo unico publico de la base, y solo
 * dice si el sistema ya arranco.
 */
export async function sistemaInicializado() {
  const fb = await obtenerFirebase();
  const ref = fb.dbMod.doc(fb.db, COLECCIONES.CONFIG, COLECCIONES.DOC_SISTEMA);
  const snap = await fb.dbMod.getDoc(ref);
  return snap.exists();
}

/**
 * Crea la primera cuenta y la deja como administrador.
 *
 * Solo funciona una vez: despues de esto existe config/sistema y las reglas
 * no dejan que nadie mas se autoproclame admin. De ahi en adelante los
 * usuarios se crean desde la pestaña Usuarios.
 *
 * Aca si nos sirve que createUserWithEmailAndPassword deje la sesion abierta:
 * el que crea la cuenta es el propio administrador inicial.
 */
export async function crearPrimerAdmin({ nombre, email, clave }) {
  const correo = String(email || '').trim();
  const nombreLimpio = String(nombre || '').trim();

  if (!nombreLimpio) throw new ErrorSesion('Escribi tu nombre.', 'validacion');
  if (!correo) throw new ErrorSesion('Escribi tu email.', 'validacion');
  if (!clave || clave.length < 6) {
    throw new ErrorSesion('La clave tiene que tener al menos 6 caracteres.', 'validacion');
  }

  const fb = await obtenerFirebase();

  // Si alguien se adelanto entre que se cargo la pantalla y ahora, cortamos.
  if (await sistemaInicializado()) {
    throw new ErrorSesion(
      'El sistema ya tiene un administrador. Entra con tu email y clave.',
      'ya-inicializado'
    );
  }

  let uid;
  try {
    const cred = await fb.authMod.createUserWithEmailAndPassword(fb.auth, correo, clave);
    uid = cred.user.uid;
  } catch (error) {
    throw new ErrorSesion(mensajeDeError(error), 'credenciales');
  }

  const perfil = {
    email: correo,
    nombre: nombreLimpio,
    rol: ROLES.ADMIN,
    activo: true,
  };

  try {
    // Primero el perfil: las reglas lo permiten mientras no exista el centinela.
    await fb.dbMod.setDoc(fb.dbMod.doc(fb.db, COLECCIONES.USUARIOS, uid), {
      ...perfil,
      creado: fb.dbMod.serverTimestamp(),
    });

    // Y recien despues el centinela, que cierra la puerta.
    await fb.dbMod.setDoc(fb.dbMod.doc(fb.db, COLECCIONES.CONFIG, COLECCIONES.DOC_SISTEMA), {
      inicializado: true,
      primerAdmin: uid,
      fecha: fb.dbMod.serverTimestamp(),
    });
  } catch (error) {
    throw new ErrorSesion(
      `Se creo la cuenta ${correo} pero no se pudo guardar el perfil: ${mensajeDeError(error)}. ` +
        'Revisa que las reglas de Firestore esten publicadas.',
      'sin-perfil'
    );
  }

  return { uid, ...perfil };
}
