/**
 * config.js
 * ----------------------------------------------------------------------
 * ACA VA LA CONFIGURACION DE TU PROYECTO DE FIREBASE.
 *
 * Consola de Firebase → Configuracion del proyecto → Tus apps → Web →
 * "SDK setup and configuration" → Config. Copia el objeto y pegalo abajo.
 *
 * Estos valores NO son secretos: van en claro en cualquier app web y se
 * pueden leer desde el navegador. Es asi por diseno. La seguridad real
 * esta en las reglas de Firestore (mira firestore.rules).
 *
 * Mientras no lo configures, el sistema arranca en MODO LOCAL: sin login,
 * con el padron guardado en este navegador. Sirve para probar.
 * ----------------------------------------------------------------------
 */

export const FIREBASE = {
  // Version del SDK que se carga por CDN. Para actualizar, cambia solo esto.
  VERSION_SDK: '12.18.0',

  config: {
    apiKey: 'PEGAR_API_KEY',
    authDomain: 'PEGAR_PROYECTO.firebaseapp.com',
    projectId: 'PEGAR_PROYECTO',
    storageBucket: 'PEGAR_PROYECTO.appspot.com',
    messagingSenderId: 'PEGAR_SENDER_ID',
    appId: 'PEGAR_APP_ID',
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
