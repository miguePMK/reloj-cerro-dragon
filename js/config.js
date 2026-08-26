/**
 * config.js
 * ----------------------------------------------------------------------
 * Configuracion del proyecto de Firebase "reloj-cerro-dragon".
 *
 * Estos valores NO son secretos: van en claro en cualquier app web y se
 * pueden leer desde el navegador de cualquier visitante. Es asi por diseno,
 * y por eso no hay problema en subirlos a Git.
 *
 * Lo que protege los datos de verdad son las reglas de Firestore
 * (firestore.rules). Sin publicarlas, cualquiera con esta URL puede leer y
 * escribir toda la base.
 * ----------------------------------------------------------------------
 */

export const FIREBASE = {
  // Version del SDK que se carga por CDN. Para actualizar, cambia solo esto.
  VERSION_SDK: '12.18.0',

  config: {
    apiKey: 'AIzaSyBsHyREZsxoh4UIzw5CQttfYQ_nOEfrEVY',
    authDomain: 'reloj-cerro-dragon.firebaseapp.com',
    databaseURL: 'https://reloj-cerro-dragon-default-rtdb.firebaseio.com',
    projectId: 'reloj-cerro-dragon',
    storageBucket: 'reloj-cerro-dragon.firebasestorage.app',
    messagingSenderId: '384046342183',
    appId: '1:384046342183:web:4bbe4401ff9c19fcaa2e02',
  },
};

/** true cuando config.js ya tiene datos reales y hay que usar Firebase. */
export function firebaseConfigurado() {
  const c = FIREBASE.config;
  const pendiente = (v) => !v || String(v).startsWith('PEGAR_');
  return !pendiente(c.apiKey) && !pendiente(c.projectId) && !pendiente(c.appId);
}

/** Nombres de las colecciones en Firestore. */
export const COLECCIONES = {
  USUARIOS: 'usuarios',
  EMPLEADOS: 'empleados',
};
