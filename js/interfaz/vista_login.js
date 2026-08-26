/**
 * interfaz/vista_login.js
 * Pantalla de acceso.
 */

import { iniciarSesion, enviarResetClave } from '../nucleo/sesion.js';
import { avisar, mostrar } from './componentes.js';

export function crearVistaLogin(alEntrar) {
  const el = {
    email: document.getElementById('login-email'),
    clave: document.getElementById('login-clave'),
    boton: document.getElementById('btn-entrar'),
    olvide: document.getElementById('btn-olvide'),
    error: document.getElementById('login-error'),
    form: document.getElementById('form-login'),
  };

  function mostrarError(mensaje) {
    el.error.textContent = mensaje;
    mostrar(el.error, Boolean(mensaje));
  }

  function ocupado(si) {
    el.boton.disabled = si;
    el.boton.textContent = si ? 'Entrando…' : 'Entrar';
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

    ocupado(true);
    try {
      const perfil = await iniciarSesion(email, clave);
      el.clave.value = '';
      await alEntrar(perfil);
    } catch (error) {
      mostrarError(error.message);
      el.clave.select();
    } finally {
      ocupado(false);
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

  el.form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      entrar();
    }
  });

  return {
    /** Deja la pantalla lista para un nuevo intento. */
    reiniciar(mensaje = '') {
      el.clave.value = '';
      mostrarError(mensaje);
      el.email.focus();
    },
  };
}
