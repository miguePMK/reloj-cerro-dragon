/**
 * firebase.js
 * Carga el SDK de Firebase por CDN y guarda una sola instancia.
 *
 * Los modulos se importan de forma dinamica: si el sistema corre en modo
 * local, nunca se pide nada por red.
 */

import { FIREBASE } from './config.js';

const url = (servicio) =>
  `https://www.gstatic.com/firebasejs/${FIREBASE.VERSION_SDK}/firebase-${servicio}.js`;

let instancia = null;

/**
 * Devuelve { appMod, authMod, dbMod, app, auth, db }.
 * Los modulos crudos se exponen a proposito: asi cada repo usa las funciones
 * que necesita sin tener que enumerar aca los treinta imports del SDK.
 */
export async function obtenerFirebase() {
  if (instancia) return instancia;

  let appMod;
  let authMod;
  let dbMod;
  try {
    [appMod, authMod, dbMod] = await Promise.all([
      import(url('app')),
      import(url('auth')),
      import(url('firestore')),
    ]);
  } catch {
    throw new Error(
      'No se pudo cargar Firebase. Revisa la conexion o si el firewall bloquea gstatic.com.'
    );
  }

  const app = appMod.initializeApp(FIREBASE.config);
  const auth = authMod.getAuth(app);
  const db = dbMod.getFirestore(app);

  // La sesion sobrevive al cierre del navegador.
  try {
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
  } catch {
    /* si falla queda la persistencia por defecto */
  }

  instancia = { appMod, authMod, dbMod, app, auth, db };
  return instancia;
}

/**
 * Crea una segunda instancia de Firebase App, aislada de la principal.
 *
 * Hace falta porque createUserWithEmailAndPassword deja logueado al usuario
 * recien creado: si lo llamaramos sobre la instancia principal, el admin se
 * autoexpulsaria cada vez que da de alta a alguien. Creando el usuario en una
 * instancia aparte y descartandola despues, la sesion del admin no se toca.
 *
 * Devuelve { app, auth, cerrar() }. Siempre llamar cerrar() en un finally.
 */
export async function crearAppSecundaria() {
  const fb = await obtenerFirebase();
  const nombre = `alta-${Date.now()}`;
  const app = fb.appMod.initializeApp(FIREBASE.config, nombre);
  const auth = fb.authMod.getAuth(app);

  return {
    app,
    auth,
    async cerrar() {
      try {
        await fb.authMod.signOut(auth);
      } catch {
        /* no importa si no habia sesion */
      }
      try {
        await fb.appMod.deleteApp(app);
      } catch {
        /* ya estaba borrada */
      }
    },
  };
}

/** Traduce los codigos de error del SDK a algo que se pueda leer en pantalla. */
export function mensajeDeError(error) {
  const codigo = error?.code || '';
  const mapa = {
    'auth/invalid-credential': 'Email o clave incorrectos.',
    'auth/invalid-login-credentials': 'Email o clave incorrectos.',
    'auth/wrong-password': 'Email o clave incorrectos.',
    'auth/user-not-found': 'Email o clave incorrectos.',
    'auth/invalid-email': 'Ese email no tiene un formato valido.',
    'auth/user-disabled': 'Esta cuenta esta deshabilitada.',
    'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos.',
    'auth/network-request-failed': 'Sin conexion con Firebase.',
    'auth/email-already-in-use': 'Ya existe un usuario con ese email.',
    'auth/weak-password': 'La clave tiene que tener al menos 6 caracteres.',
    'auth/requires-recent-login': 'Por seguridad, volve a iniciar sesion antes de hacer este cambio.',
    'auth/operation-not-allowed':
      'Falta habilitar el metodo Email/Password en Authentication → Sign-in method.',
    'permission-denied': 'Tu usuario no tiene permiso para esta accion.',
    unavailable: 'Firestore no responde. Revisa la conexion.',
    'failed-precondition': 'Firestore rechazo la operacion. Revisa las reglas.',
  };
  return mapa[codigo] || error?.message || 'Ocurrio un error inesperado.';
}
