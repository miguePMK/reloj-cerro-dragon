/**
 * interfaz/vista_login.js
 * Pantalla de acceso. Tiene dos caras:
 *  - normal: email y clave.
 *  - puesta en marcha: cuando el sistema todavia no tiene ningun usuario,
 *    ofrece crear el administrador inicial.
 */

import { iniciarSesion, enviarResetClave, crearPrimerAdmin } from '../nucleo/sesion.js';
import { avisar, mostrar } from './componentes.js';

/**
 * @param {object} acciones
 * @param {(perfil) => Promise<void>} acciones.alEntrar
 * @param {(fn) => Promise<any>} acciones.envolverAlta corre el alta del primer
 *        admin con el observador de sesion en pausa, para que el cambio de
 *        estado intermedio no lo eche antes de que exista su perfil.
 */
export function crearVistaLogin({ alEntrar, envolverAlta }) {
  const el = {
    // acceso normal
    form: document.getElementById('form-login'),
    email: document.getElementById('login-email'),
    clave: document.getElementById('login-clave'),
    boton: document.getElementById('btn-entrar'),
    olvide: document.getElementById('btn-olvide'),
    error: document.getElementById('login-error'),
    // puesta en marcha
    formInicial: document.getElementById('form-inicial'),
    iniNombre: document.getElementById('inicial-nombre'),
    iniEmail: document.getElementById('inicial-email'),
    iniClave: document.getElementById('inicial-clave'),
    iniBoton: document.getElementById('btn-crear-inicial'),
    iniError: document.getElementById('inicial-error'),
  };

  let modo = 'login';

  function mostrarError(mensaje) {
    const destino = modo === 'inicial' ? el.iniError : el.error;
    destino.textContent = mensaje;
    mostrar(destino, Boolean(mensaje));
  }

  /** Cambia entre el acceso normal y el alta del administrador inicial. */
  function usarModo(cual) {
    modo = cual;
    mostrar(el.form, cual === 'login');
    mostrar(el.formInicial, cual === 'inicial');
    mostrar(el.error, false);
    mostrar(el.iniError, false);
  }

  function ocupado(boton, si, textoOcupado, textoNormal) {
    boton.disabled = si;
    boton.textContent = si ? textoOcupado : textoNormal;
  }

  async function entrar() {
    mostrarError('');
    const email = el.email.value.trim();
    const clave = el.clave.value;

    if (!email || !clave) {
      mostrarError('Completa el email y la clave.');
      (email ? el.clave : el.email).focus();
      return;
    }

    ocupado(el.boton, true, 'Entrando…', 'Entrar');
    try {
      const perfil = await iniciarSesion(email, clave);
      el.clave.value = '';
      await alEntrar(perfil);
    } catch (error) {
      mostrarError(error.message);
      el.clave.select();
    } finally {
      ocupado(el.boton, false, 'Entrando…', 'Entrar');
    }
  }

  async function crearInicial() {
    mostrarError('');
    ocupado(el.iniBoton, true, 'Creando…', 'Crear administrador');
    try {
      const perfil = await envolverAlta(() =>
        crearPrimerAdmin({
          nombre: el.iniNombre.value,
          email: el.iniEmail.value,
          clave: el.iniClave.value,
        })
      );
      el.iniClave.value = '';
      avisar(`Listo, ${perfil.nombre}. Ya podes cargar empleados y crear usuarios.`, 'ok', 7000);
      await alEntrar(perfil);
    } catch (error) {
      mostrarError(error.message);
      // Si alguien se adelanto, la pantalla de alta ya no sirve.
      if (error.motivo === 'ya-inicializado') usarModo('login');
    } finally {
      ocupado(el.iniBoton, false, 'Creando…', 'Crear administrador');
    }
  }

  async function olvide() {
    const email = el.email.value.trim();
    if (!email) {
      mostrarError('Escribi tu email y volve a tocar "Olvide mi clave".');
      el.email.focus();
      return;
    }

    try {
      await enviarResetClave(email);
      mostrarError('');
      avisar(`Te mandamos un mail a ${email} para poner una clave nueva.`, 'ok', 7000);
    } catch (error) {
      mostrarError(error.message);
    }
  }

  el.boton.addEventListener('click', entrar);
  el.olvide.addEventListener('click', olvide);
  el.iniBoton.addEventListener('click', crearInicial);

  el.form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      entrar();
    }
  });

  el.formInicial.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      crearInicial();
    }
  });

  usarModo('login');

  return {
    usarModo,

    /** Deja la pantalla lista para un nuevo intento. */
    reiniciar(mensaje = '') {
      el.clave.value = '';
      mostrarError(mensaje);
      (modo === 'inicial' ? el.iniNombre : el.email).focus();
    },
  };
}
