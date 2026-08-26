/**
 * interfaz/vista_usuarios.js
 * ABM de los usuarios que entran al sistema. Solo para el rol admin.
 */

import { ROLES, ETIQUETA_ROL } from '../nucleo/sesion.js';
import { escaparHtml } from '../util.js';
import { avisar, texto } from './componentes.js';

export function crearVistaUsuarios(estado, repoUsuarios) {
  const el = {
    form: document.getElementById('form-usuario'),
    nombre: document.getElementById('usr-nombre'),
    email: document.getElementById('usr-email'),
    clave: document.getElementById('usr-clave'),
    rol: document.getElementById('usr-rol'),
    btnCrear: document.getElementById('btn-crear-usuario'),
    cuerpo: document.getElementById('tabla-usuarios-cuerpo'),
  };

  let cache = [];

  async function refrescar() {
    el.cuerpo.innerHTML = `<tr><td colspan="5" class="celda-vacia">Cargando…</td></tr>`;
    try {
      cache = await repoUsuarios.listar();
      pintar();
    } catch (error) {
      cache = [];
      el.cuerpo.innerHTML = `<tr><td colspan="5" class="celda-vacia">No se pudo leer la lista: ${escaparHtml(error.message)}</td></tr>`;
    }
  }

  function pintar() {
    el.cuerpo.innerHTML = cache.length
      ? cache.map(fila).join('')
      : `<tr><td colspan="5" class="celda-vacia">Todavia no hay usuarios cargados.</td></tr>`;

    texto('conteo-usuarios', `${cache.length} usuario${cache.length === 1 ? '' : 's'}`);
    texto('menu-detalle-usuarios', `${cache.length} con acceso`);
  }

  function fila(u) {
    const yo = u.uid === estado.sesion?.uid;
    return `<tr${u.activo ? '' : ' class="fila--inactiva"'}>
      <td>${escaparHtml(u.nombre)}${yo ? ' <span class="obs-texto">vos</span>' : ''}</td>
      <td class="num">${escaparHtml(u.email)}</td>
      <td><span class="chip chip--${u.rol}">${ETIQUETA_ROL[u.rol]}</span></td>
      <td>${u.activo ? '<span class="chip chip--ok">Activo</span>' : '<span class="chip chip--baja">Inactivo</span>'}</td>
      <td class="acciones">
        <button type="button" class="btn btn--chico" data-accion="rol" data-uid="${escaparHtml(u.uid)}"${yo ? ' disabled title="No podes cambiar tu propio rol"' : ''}>
          ${u.rol === ROLES.ADMIN ? 'Pasar a operador' : 'Pasar a admin'}
        </button>
        <button type="button" class="btn btn--chico" data-accion="clave" data-email="${escaparHtml(u.email)}">Resetear clave</button>
        <button type="button" class="btn btn--chico ${u.activo ? 'btn--peligro' : ''}" data-accion="activo" data-uid="${escaparHtml(u.uid)}"${yo ? ' disabled title="No podes desactivarte a vos mismo"' : ''}>
          ${u.activo ? 'Desactivar' : 'Reactivar'}
        </button>
      </td>
    </tr>`;
  }

  function limpiarForm() {
    el.nombre.value = '';
    el.email.value = '';
    el.clave.value = '';
    el.rol.value = ROLES.OPERADOR;
  }

  async function crear() {
    el.btnCrear.disabled = true;
    el.btnCrear.textContent = 'Creando…';
    try {
      const usuario = await repoUsuarios.crear({
        nombre: el.nombre.value,
        email: el.email.value,
        clave: el.clave.value,
        rol: el.rol.value,
      });
      avisar(`Usuario ${usuario.email} creado como ${ETIQUETA_ROL[usuario.rol].toLowerCase()}.`, 'ok');
      limpiarForm();
      await refrescar();
    } catch (error) {
      avisar(error.message, 'error', 8000);
    } finally {
      el.btnCrear.disabled = false;
      el.btnCrear.textContent = 'Crear usuario';
    }
  }

  async function cambiarRol(uid) {
    const u = cache.find((x) => x.uid === uid);
    if (!u) return;

    const nuevo = u.rol === ROLES.ADMIN ? ROLES.OPERADOR : ROLES.ADMIN;
    const activos = cache.filter((x) => x.rol === ROLES.ADMIN && x.activo);
    if (nuevo === ROLES.OPERADOR && activos.length <= 1) {
      avisar('No podes dejar el sistema sin ningun administrador activo.', 'error');
      return;
    }

    if (!confirm(`Pasar a ${u.nombre} a ${ETIQUETA_ROL[nuevo].toLowerCase()}?`)) return;

    try {
      await repoUsuarios.actualizar(uid, { rol: nuevo });
      avisar(`${u.nombre} ahora es ${ETIQUETA_ROL[nuevo].toLowerCase()}.`, 'ok');
      await refrescar();
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  async function cambiarActivo(uid) {
    const u = cache.find((x) => x.uid === uid);
    if (!u) return;

    const activos = cache.filter((x) => x.rol === ROLES.ADMIN && x.activo);
    if (u.activo && u.rol === ROLES.ADMIN && activos.length <= 1) {
      avisar('No podes desactivar al unico administrador activo.', 'error');
      return;
    }

    const accion = u.activo ? 'Desactivar' : 'Reactivar';
    if (!confirm(`${accion} el acceso de ${u.nombre}?`)) return;

    try {
      await repoUsuarios.activar(uid, !u.activo);
      avisar(`${u.nombre}: acceso ${u.activo ? 'desactivado' : 'reactivado'}.`, 'ok');
      await refrescar();
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  async function resetClave(email) {
    if (!confirm(`Mandar a ${email} un mail para restablecer la clave?`)) return;
    try {
      await repoUsuarios.resetClave(email);
      avisar(`Mail enviado a ${email}.`, 'ok');
    } catch (error) {
      avisar(error.message, 'error');
    }
  }

  el.btnCrear.addEventListener('click', crear);

  el.form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      crear();
    }
  });

  el.cuerpo.addEventListener('click', (e) => {
    const boton = e.target.closest('button[data-accion]');
    if (!boton || boton.disabled) return;

    if (boton.dataset.accion === 'rol') cambiarRol(boton.dataset.uid);
    else if (boton.dataset.accion === 'activo') cambiarActivo(boton.dataset.uid);
    else if (boton.dataset.accion === 'clave') resetClave(boton.dataset.email);
  });

  return { refrescar };
}
