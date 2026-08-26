/**
 * main.js
 * Arranque, control de acceso y ruteo.
 *
 * Dos modos:
 *  - firebase: config.js tiene datos reales → login, roles y padron en Firestore.
 *  - local:    config.js sin configurar → sin login, padron en este navegador.
 *              Sirve para probar el sistema antes de crear el proyecto.
 */

import { APP } from './constantes.js';
import { firebaseConfigurado } from './config.js';
import {
  ROLES,
  ETIQUETA_ROL,
  observarSesion,
  cerrarSesion,
  esAdmin,
  sistemaInicializado,
} from './nucleo/sesion.js';
import { crearRepoEmpleadosLocal } from './nucleo/repo_empleados.js';
import { RepoEmpleadosFirestore } from './nucleo/repo_empleados_firestore.js';
import { RepoUsuarios } from './nucleo/repo_usuarios.js';
import { crearVistaLogin } from './interfaz/vista_login.js';
import { crearVistaFichadas } from './interfaz/vista_fichadas.js';
import { crearVistaEmpleados } from './interfaz/vista_empleados.js';
import { crearVistaUsuarios } from './interfaz/vista_usuarios.js';
import { avisar, mostrar, texto } from './interfaz/componentes.js';

const MODO_FIREBASE = firebaseConfigurado();

const estado = {
  modo: MODO_FIREBASE ? 'firebase' : 'local',
  sesion: null,          // perfil del usuario logueado
  repo: null,            // repo de empleados (local o Firestore)
  puedeEditarPadron: false,
  lectura: null,         // salida de parsearDat()
  jornadas: [],          // salida de construirJornadas()
  filtrosIniciados: false,
};

const pantallas = {
  carga: document.getElementById('pantalla-carga'),
  login: document.getElementById('pantalla-login'),
  app: document.getElementById('app'),
};

const VISTAS = {
  fichadas: { id: 'vista-fichadas', soloAdmin: false },
  // El operador ve el padron en modo lectura: la vista se muestra igual y es
  // ella la que se acomoda segun el rol.
  empleados: { id: 'vista-empleados', soloAdmin: false },
  usuarios: { id: 'vista-usuarios', soloAdmin: true, soloFirebase: true },
};

let vistas = null;
let vistaLogin = null;
let observadorEnPausa = false;

/* ------------------------------------------------------------------ */
/* Pantallas                                                          */
/* ------------------------------------------------------------------ */

function verPantalla(cual) {
  mostrar(pantallas.carga, cual === 'carga');
  mostrar(pantallas.login, cual === 'login');
  mostrar(pantallas.app, cual === 'app');
}

/* ------------------------------------------------------------------ */
/* Ruteo                                                              */
/* ------------------------------------------------------------------ */

/** Rutas permitidas para el rol actual. */
function rutasHabilitadas() {
  return Object.entries(VISTAS)
    .filter(([, v]) => {
      if (v.soloFirebase && estado.modo !== 'firebase') return false;
      if (v.soloAdmin && !estado.puedeEditarPadron) return false;
      return true;
    })
    .map(([nombre]) => nombre);
}

function rutaActual() {
  const hash = (location.hash || '').replace(/^#\/?/, '');
  const permitidas = rutasHabilitadas();
  return permitidas.includes(hash) ? hash : permitidas[0];
}

function navegar() {
  const ruta = rutaActual();

  for (const [nombre, v] of Object.entries(VISTAS)) {
    const seccion = document.getElementById(v.id);
    if (seccion) seccion.hidden = nombre !== ruta;
  }

  document.querySelectorAll('.menu-item').forEach((item) => {
    const activo = item.dataset.ruta === ruta;
    item.classList.toggle('menu-item--activo', activo);
    item.setAttribute('aria-current', activo ? 'page' : 'false');
  });

  if (ruta === 'empleados') vistas?.empleados?.refrescar();
  if (ruta === 'usuarios') vistas?.usuarios?.refrescar();
}

/** Oculta del menu lo que el rol no puede usar. */
function aplicarPermisos() {
  document.querySelectorAll('.menu-item').forEach((item) => {
    const v = VISTAS[item.dataset.ruta];
    if (!v) return;
    const permitido =
      (!v.soloAdmin || estado.puedeEditarPadron) &&
      (!v.soloFirebase || estado.modo === 'firebase');
    item.hidden = !permitido;
  });
}

/* ------------------------------------------------------------------ */
/* Armado de la aplicacion                                            */
/* ------------------------------------------------------------------ */

/**
 * Arma las vistas que el rol actual puede usar.
 *
 * Es idempotente por vista a proposito: cada crearVista* engancha listeners
 * en el DOM, asi que armar dos veces la misma vista duplicaria los handlers
 * (un archivo se cargaria dos veces, cada aviso saldria repetido). Por eso
 * las vistas nunca se descartan al cerrar sesion, solo se limpian.
 */
function montarVistas() {
  vistas = vistas || {};

  if (!vistas.fichadas) {
    vistas.fichadas = crearVistaFichadas(estado);
  }

  if (!vistas.empleados) {
    vistas.empleados = crearVistaEmpleados(estado, () => vistas.fichadas.refrescar());
  }

  // Si primero entra un operador y despues un admin en la misma carga de
  // pagina, esta se arma recien en ese momento.
  if (!vistas.usuarios && estado.modo === 'firebase' && estado.puedeEditarPadron) {
    vistas.usuarios = crearVistaUsuarios(estado, new RepoUsuarios());
  }

  return vistas;
}

async function entrarAlSistema(perfil) {
  estado.sesion = perfil;

  if (estado.modo === 'firebase') {
    estado.repo = new RepoEmpleadosFirestore();
    estado.puedeEditarPadron = esAdmin(perfil);
    texto('sesion-nombre', perfil.nombre);
    texto('sesion-rol', ETIQUETA_ROL[perfil.rol]);
    texto(
      'nota-almacenamiento',
      'El padron se guarda en Firestore: lo ven todos los usuarios del sistema.'
    );
    mostrar(document.getElementById('btn-salir'), true);
    mostrar(document.getElementById('modo-local'), false);
  } else {
    estado.repo = crearRepoEmpleadosLocal();
    estado.puedeEditarPadron = true;
    texto('sesion-nombre', 'Sin sesion');
    texto('sesion-rol', 'Modo local');
    texto(
      'nota-almacenamiento',
      'El padron se guarda en este navegador. Exportalo para respaldarlo o pasarlo a otra maquina.'
    );
    mostrar(document.getElementById('btn-salir'), false);
    mostrar(document.getElementById('modo-local'), true);
  }

  aplicarPermisos();
  montarVistas();
  verPantalla('app');
  navegar();

  // Trae el padron: el operador tambien lo necesita para ver los nombres.
  await vistas.empleados.refrescar();
}

/** Borra de memoria y de pantalla los datos de la sesion anterior. */
function limpiarSesion() {
  estado.sesion = null;
  estado.repo = null;
  estado.puedeEditarPadron = false;

  // Las vistas quedan armadas (ver montarVistas), solo se limpia su contenido.
  vistas?.fichadas?.limpiar();

  estado.lectura = null;
  estado.jornadas = [];
  estado.filtrosIniciados = false;
}

/**
 * Corre una operacion con el observador de sesion en pausa.
 *
 * Hace falta para el alta del administrador inicial: crear la cuenta abre la
 * sesion antes de que exista el documento usuarios/{uid}, y el observador
 * leeria ese estado intermedio como "cuenta sin habilitar" y lo echaria justo
 * cuando se esta dando de alta.
 */
async function conObservadorEnPausa(operacion) {
  observadorEnPausa = true;
  try {
    return await operacion();
  } finally {
    observadorEnPausa = false;
  }
}

/* ------------------------------------------------------------------ */
/* Arranque                                                           */
/* ------------------------------------------------------------------ */

texto('marca-empresa', APP.EMPRESA);
texto('login-empresa', APP.EMPRESA);

window.addEventListener('hashchange', navegar);

document.getElementById('btn-salir').addEventListener('click', async () => {
  try {
    await cerrarSesion();
  } catch (error) {
    avisar(error.message, 'error');
  }
});

async function arrancar() {
  if (estado.modo === 'local') {
    // Sin Firebase no hay a quien preguntarle nada: se entra directo.
    await entrarAlSistema({ nombre: 'Sin sesion', rol: ROLES.ADMIN });
    return;
  }

  vistaLogin = crearVistaLogin({
    alEntrar: entrarAlSistema,
    envolverAlta: conObservadorEnPausa,
  });

  /**
   * Decide que cara mostrar del login. La primera vez que se abre el sistema
   * no hay ningun usuario, asi que en lugar de pedir una clave que no existe
   * ofrece crear el administrador inicial.
   */
  async function elegirCaraDelLogin(mensaje = '') {
    try {
      vistaLogin.usarModo((await sistemaInicializado()) ? 'login' : 'inicial');
    } catch {
      // Si no se puede leer el centinela (reglas sin publicar, sin conexion),
      // mostramos el acceso normal: es lo menos sorprendente.
      vistaLogin.usarModo('login');
    }
    verPantalla('login');
    vistaLogin.reiniciar(mensaje);
  }

  try {
    // Se dispara al arrancar (por si ya habia sesion) y en cada cambio.
    await observarSesion(async (perfil, error) => {
      if (observadorEnPausa) return;

      if (perfil) {
        // Si ya estabamos adentro, no rearmamos todo.
        if (estado.sesion?.uid === perfil.uid) return;
        await entrarAlSistema(perfil);
        return;
      }

      // Sesion cerrada. Si vino con error, es una cuenta que autentico pero
      // no esta habilitada: hay que decirle por que no entra.
      limpiarSesion();
      await elegirCaraDelLogin(error?.message || '');
    });
  } catch (error) {
    // No se pudo ni cargar el SDK: mostramos el login con el motivo.
    verPantalla('login');
    vistaLogin.reiniciar(error.message);
  }
}

arrancar();
