/**
 * constantes.js
 * Toda la configuracion del sistema vive aca.
 * Para cambiar un comportamiento no hace falta tocar la logica.
 */

export const APP = {
  NOMBRE: 'Control de Fichadas',
  VERSION: '0.2',
  EMPRESA: 'Novadrill S.R.L.',
};

/* ------------------------------------------------------------------ */
/* Parser del archivo .dat                                             */
/* ------------------------------------------------------------------ */

export const PARSER = {
  // Separador principal del attlog.dat de ZKTeco. Si la linea no tiene
  // tabulaciones se cae a un split por espacios en blanco.
  SEPARADOR: '\t',

  // Indices de columna (base 0) segun el formato:
  // legajo | fecha y hora | estado | verificacion | workcode | reservado
  COL_LEGAJO: 0,
  COL_FECHA_HORA: 1,
  COL_ESTADO: 2,
  COL_VERIFICACION: 3,

  // Cantidad minima de columnas para considerar la linea valida.
  COLUMNAS_MINIMAS: 2,

  // El legajo viene con espacios de relleno a la izquierda.
  QUITAR_CEROS_IZQUIERDA: false,

  // Nombres legibles para el modo de verificacion (campo 4).
  MODOS_VERIFICACION: {
    0: 'Clave',
    1: 'Huella',
    2: 'Tarjeta',
    3: 'Huella + clave',
    4: 'Tarjeta',
    15: 'Rostro',
  },
};

/* ------------------------------------------------------------------ */
/* Calculo de jornadas                                                 */
/* ------------------------------------------------------------------ */

export const CALCULO = {
  // Dos marcas del mismo legajo separadas por menos de esto se consideran
  // una sola (el reloj a veces registra doble toque).
  VENTANA_DEDUP_SEGUNDOS: 120,

  // Jornada de menos minutos que esto se marca para revisar.
  JORNADA_MINIMA_MINUTOS: 60,

  // Jornada de mas minutos que esto se marca para revisar.
  JORNADA_MAXIMA_MINUTOS: 16 * 60,

  // Si es true, descuenta las pausas intermedias (marcas del medio) del
  // total. Si es false, el total es simplemente salida - entrada.
  DESCONTAR_PAUSAS_INTERMEDIAS: false,

  // Redondeo del total en minutos. 0 = sin redondear, 5 = al multiplo de 5.
  REDONDEO_MINUTOS: 0,

  // Turnos que cruzan la medianoche. Desactivado: las marcas se agrupan
  // siempre por dia calendario.
  CRUCE_MEDIANOCHE: false,
};

/* ------------------------------------------------------------------ */
/* Exportacion a Excel                                                 */
/* ------------------------------------------------------------------ */

export const EXPORTACION = {
  PREFIJO_ARCHIVO: 'fichadas',
  HOJA_DETALLE: 'Detalle',
  HOJA_RESUMEN: 'Resumen',
  INCLUIR_HOJA_RESUMEN: true,
  INCLUIR_HORAS_DECIMALES: true,
};

/* ------------------------------------------------------------------ */
/* Interfaz                                                            */
/* ------------------------------------------------------------------ */

export const UI = {
  DIAS_SEMANA: ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'],
  DIAS_SEMANA_CORTO: ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'],
  EXTENSIONES_ACEPTADAS: ['.dat', '.txt'],
  FILAS_POR_PAGINA: 0, // 0 = sin paginado
};

/**
 * Ventana horaria de la barra de jornada. Las marcas que caigan afuera se
 * recortan al borde y la barra se muestra con el extremo cortado.
 */
export const BARRA = {
  INICIO_MIN: 5 * 60,   // 05:00
  FIN_MIN: 22 * 60,     // 22:00
  ESCALA: [6, 9, 12, 15, 18, 21], // horas rotuladas en el encabezado
};

/* ------------------------------------------------------------------ */
/* Almacenamiento                                                      */
/* ------------------------------------------------------------------ */

export const ALMACENAMIENTO = {
  CLAVE_EMPLEADOS: 'fichadas.empleados.v1',
  CLAVE_PREFERENCIAS: 'fichadas.preferencias.v1',
};

export const ESTADOS_JORNADA = {
  OK: 'ok',
  INCOMPLETA: 'incompleta',
  REVISAR: 'revisar',
};
