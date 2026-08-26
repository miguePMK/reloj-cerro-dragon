/**
 * interfaz/componentes.js
 * Helpers de presentacion. Nada de logica de negocio aca.
 */

/** Muestra un aviso flotante. tipo: 'ok' | 'error' | 'info' */
export function avisar(mensaje, tipo = 'info', duracion = 4200) {
  const cont = document.getElementById('avisos');
  if (!cont) return;

  const div = document.createElement('div');
  div.className = `aviso aviso--${tipo}`;
  div.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
  div.textContent = mensaje;
  cont.appendChild(div);

  setTimeout(() => {
    div.classList.add('aviso--saliendo');
    setTimeout(() => div.remove(), 300);
  }, duracion);
}

/** Lee un archivo como texto. El .dat del reloj es ASCII, latin1 cubre acentos. */
export function leerArchivoTexto(archivo, codificacion = 'windows-1252') {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader();
    lector.onload = () => resolver(String(lector.result));
    lector.onerror = () => rechazar(new Error(`No se pudo leer "${archivo.name}"`));
    lector.readAsText(archivo, codificacion);
  });
}

/** Habilita arrastrar y soltar sobre un elemento. */
export function habilitarArrastre(elemento, alSoltar) {
  const activar = (e) => {
    e.preventDefault();
    elemento.classList.add('zona--activa');
  };
  const desactivar = () => elemento.classList.remove('zona--activa');

  elemento.addEventListener('dragover', activar);
  elemento.addEventListener('dragenter', activar);
  elemento.addEventListener('dragleave', desactivar);
  elemento.addEventListener('drop', (e) => {
    e.preventDefault();
    desactivar();
    const archivo = e.dataTransfer?.files?.[0];
    if (archivo) alSoltar(archivo);
  });
}

/**
 * Ordenamiento por click en los encabezados.
 * Los th tienen data-orden="clave" y data-tipo="texto|numero".
 */
export function habilitarOrden(tabla, alOrdenar) {
  tabla.querySelectorAll('th[data-orden]').forEach((th) => {
    th.tabIndex = 0;
    const disparar = () => {
      const clave = th.dataset.orden;
      const yaActivo = th.classList.contains('th--asc') || th.classList.contains('th--desc');
      const desc = yaActivo ? th.classList.contains('th--asc') : false;

      tabla.querySelectorAll('th[data-orden]').forEach((otro) => {
        otro.classList.remove('th--asc', 'th--desc');
        otro.removeAttribute('aria-sort');
      });
      th.classList.add(desc ? 'th--desc' : 'th--asc');
      th.setAttribute('aria-sort', desc ? 'descending' : 'ascending');

      alOrdenar(clave, desc, th.dataset.tipo || 'texto');
    };

    th.addEventListener('click', disparar);
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        disparar();
      }
    });
  });
}

/** Comparador segun tipo de dato, con los vacios siempre al final. */
export function comparador(clave, desc, tipo) {
  const signo = desc ? -1 : 1;
  return (a, b) => {
    let va = a[clave];
    let vb = b[clave];

    const vacioA = va === null || va === undefined || va === '';
    const vacioB = vb === null || vb === undefined || vb === '';
    if (vacioA && vacioB) return 0;
    if (vacioA) return 1;
    if (vacioB) return -1;

    if (tipo === 'numero') return (Number(va) - Number(vb)) * signo;
    if (tipo === 'legajo') {
      return String(va).localeCompare(String(vb), 'es', { numeric: true }) * signo;
    }
    return String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' }) * signo;
  };
}

/** Muestra u oculta un elemento. */
export function mostrar(elemento, visible) {
  if (elemento) elemento.hidden = !visible;
}

/** Pone texto en un elemento por id. */
export function texto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}
