# Control de Fichadas

Sistema web para procesar la bajada USB del reloj biometrico (`attlog.dat`) y
ver las jornadas por dia con entrada, salida y total de horas, con descarga a
Excel, padron de empleados y usuarios con roles.

Sitio **estatico**: HTML, CSS y JavaScript vanilla, sin build, sin backend
propio. El `.dat` se procesa entero en el navegador y **nunca sale de la
maquina**. Firebase se usa solo para el login y para compartir el padron.

---

## Arranca en modo local

Recien descargado, sin configurar nada, el sistema entra directo sin login y
guarda el padron en el navegador. Sirve para probarlo antes de armar el
proyecto de Firebase. En la barra lateral aparece el cartel "Modo local".

Para probar hace falta un servidor, porque los modulos ES no funcionan con
`file://`:

```bat
python -m http.server 8000
```

Y abris `http://localhost:8000`.

---

## Poner Firebase (7 pasos)

### 1. Crear el proyecto

En [console.firebase.google.com](https://console.firebase.google.com) → Agregar
proyecto. Analytics no hace falta.

### 2. Registrar la app web

Dentro del proyecto → icono `</>` (Web) → le pones un nombre → Registrar app.
Te muestra el objeto `firebaseConfig`.

### 3. Pegar la config

Copia ese objeto en `js/config.js`, reemplazando los `PEGAR_*`.

Estos valores **no son secretos**: van en claro en cualquier app web y se leen
desde el navegador. Es asi por diseno. Lo que protege los datos son las reglas
del paso 6.

### 4. Habilitar el login por email

Authentication → Get started → Sign-in method → Email/Password → Habilitar.
Si te salteas esto, el login falla con "operation-not-allowed".

### 5. Crear Firestore

Firestore Database → Crear base de datos → elegi la region mas cercana
(`southamerica-east1` es Sao Paulo). Arranca en modo produccion.

### 6. Publicar las reglas

Firestore Database → Reglas → pega todo el contenido de `firestore.rules` →
Publicar.

**Este paso no es opcional.** Sin las reglas, cualquiera que abra la pagina
puede leer y escribir toda la base.

### 7. Crear el primer administrador

Es el unico que se hace a mano, porque todavia no hay ningun admin que pueda
crear usuarios desde la app.

1. Authentication → Users → Add user. Poné tu email y una clave.
2. Copia el **User UID** que te queda en la lista.
3. Firestore Database → Iniciar coleccion → ID de coleccion: `usuarios`.
4. ID del documento: **pega el UID** (no lo generes automatico).
5. Agrega estos campos:

| Campo | Tipo | Valor |
|-------|------|-------|
| `email` | string | tu email |
| `nombre` | string | tu nombre |
| `rol` | string | `admin` |
| `activo` | boolean | `true` |

Guarda, recarga la pagina y ya entras con tu email y clave. De ahi en adelante
los usuarios se crean desde la pestaña Usuarios.

---

## Roles

| | Operador | Administrador |
|---|---|---|
| Cargar el `.dat` y ver jornadas | si | si |
| Descargar el Excel | si | si |
| ABM de empleados del reloj | no | si |
| ABM de usuarios del sistema | no | si |

El rol se guarda en `usuarios/{uid}` y las reglas de Firestore lo verifican en
cada operacion. Ocultar botones no alcanza: la seguridad esta en las reglas.

Los custom claims serian el lugar natural para el rol, pero necesitan el Admin
SDK, que corre en servidor. Con un sitio estatico no hay servidor, asi que el
rol vive en Firestore.

---

## Dos limitaciones de Firebase desde el navegador

**Crear usuarios sin desloguearse.** `createUserWithEmailAndPassword` deja
logueado al usuario recien creado. Si se llamara sobre la instancia principal,
el admin se autoexpulsaria en cada alta. El sistema crea una segunda instancia
de Firebase App, da de alta ahi y la descarta (`js/firebase.js` →
`crearAppSecundaria`). La sesion del admin no se toca.

**Borrar usuarios.** Eliminar una cuenta de Authentication requiere el Admin
SDK. Desde el navegador solo se puede **desactivar**: el documento queda con
`activo: false` y las reglas le niegan todo, asi que pierde el acceso al
instante. La cuenta de Authentication sigue existiendo; si la queres borrar de
verdad, es desde la consola de Firebase.

Ademas, las reglas no dejan que un admin se saque a si mismo el rol ni se
desactive, y la app tampoco permite desactivar al ultimo admin activo. Es para
no quedarse afuera del sistema por accidente.

---

## Estructura

```
index.html
firestore.rules              reglas de seguridad (hay que publicarlas)
css/estilos.css
js/
  config.js                  ACA va tu firebaseConfig
  firebase.js                carga del SDK, instancia secundaria, errores
  constantes.js              toda la configuracion de calculo y UI
  util.js                    helpers compartidos
  nucleo/
    parser_dat.js            lee el .dat, sin UI
    calculo.js               arma las jornadas, sin UI
    sesion.js                login, logout, resolucion del rol
    repo_empleados.js        padron en localStorage (modo local)
    repo_empleados_firestore.js  padron en Firestore (misma interfaz)
    repo_usuarios.js         usuarios del sistema
    exportar.js              genera el .xlsx
  interfaz/
    componentes.js           avisos, orden de tablas, lectura de archivos
    vista_login.js
    vista_fichadas.js
    vista_empleados.js
    vista_usuarios.js
  main.js                    arranque, control de acceso, ruteo
ejemplos/
  empleados_plantilla.csv    los 34 legajos de tu .dat, para completar nombres
```

`nucleo/` no toca el DOM. `interfaz/` no tiene logica de negocio. Los dos repos
de empleados implementan la misma interfaz, asi que las vistas y el calculo no
saben de donde vienen los datos.

---

## Formato del .dat

El attlog de ZKTeco, separado por tabulaciones:

```
          1713→2026-08-25 07:23:05→1→0→1→0
```

| # | Campo | Uso |
|---|-------|-----|
| 1 | Legajo (con espacios de relleno) | se limpia con `trim()` |
| 2 | `YYYY-MM-DD HH:MM:SS` | fecha y hora de la marca |
| 3 | Estado del dispositivo | siempre `1` en tu reloj, se ignora |
| 4 | Modo de verificacion | `0` clave, `1` huella, `4` tarjeta |
| 5 | Workcode | se ignora |
| 6 | Reservado | se ignora |

**El archivo no dice si una marca es entrada o salida.** Por eso las marcas se
agrupan por legajo + dia calendario, se ordenan por hora, y se toma la primera
como entrada y la ultima como salida. Nunca se aparean de forma secuencial a
ciegas, porque cuando falta una marca eso genera jornadas falsas de varios dias.

---

## La barra de jornada

Cada fila dibuja su jornada sobre una escala horaria comun (05:00 a 22:00 por
defecto, configurable en `constantes.js` → `BARRA`). Sirve para ver las
anomalias sin leer numeros:

- **Bloque azul**: jornada normal, de entrada a salida.
- **Bloque rojo**: jornada fuera de rango (muy corta o muy larga).
- **Tic con cola punteada**: marca sin par, la jornada no cerro.
- **Extremo cuadrado**: la marca cae fuera de la ventana y esta recortada.

Probado con tu bajada del 25/08/2026: las cinco marcas sueltas y el legajo 1984
con 47 minutos se distinguen de un vistazo del resto.

---

## Casos que la tabla marca sola

- **Marcas duplicadas.** El legajo 2002 fichó 17:18:03 y 17:18:07. Dos marcas
  separadas por menos de `VENTANA_DEDUP_SEGUNDOS` (120) cuentan como una.
- **Jornada incompleta.** Legajos 1714, 1716, 1734, 1914 y 2007 tienen una sola
  marca: la salida queda en blanco y no se inventa un total.
- **Jornada sospechosa.** El 1984 marcó 16:31 y 17:18: queda en `Revisar` por
  estar debajo de `JORNADA_MINIMA_MINUTOS`.
- **Legajo sin empleado cargado.** Se muestra igual, con el nombre en blanco.

---

## Configuracion (`js/constantes.js`)

| Parametro | Default | Que hace |
|-----------|---------|----------|
| `VENTANA_DEDUP_SEGUNDOS` | `120` | ventana para considerar dos marcas como una |
| `JORNADA_MINIMA_MINUTOS` | `60` | debajo de esto se marca `Revisar` |
| `JORNADA_MAXIMA_MINUTOS` | `960` | arriba de esto se marca `Revisar` |
| `DESCONTAR_PAUSAS_INTERMEDIAS` | `false` | con 4 marcas, descontar el almuerzo |
| `REDONDEO_MINUTOS` | `0` | redondear el total al multiplo indicado |
| `CRUCE_MEDIANOCHE` | `false` | turnos que pasan la medianoche (ver limitaciones) |
| `BARRA.INICIO_MIN` / `FIN_MIN` | `300` / `1320` | ventana horaria de la barra |
| `FIREBASE.VERSION_SDK` | `12.18.0` | version del SDK (en `config.js`) |

---

## Limitaciones conocidas

- **Turnos que cruzan la medianoche.** Al agrupar por dia calendario, un turno
  de 22:00 a 06:00 aparece como dos jornadas incompletas. Si en Novadrill hay
  turno noche, hay que resolverlo antes de usar esto para liquidar.
- **Sin horas extras.** Muestra entrada, salida y total. El calculo de extras al
  50% y 100% no esta.
- **Tres CDN.** SheetJS (Excel), Google Fonts (tipografia) y gstatic (Firebase).
  Si el firewall de la empresa bloquea alguna: sin SheetJS no anda la descarga a
  Excel, sin Google Fonts cambia la tipografia pero funciona todo, y sin gstatic
  no se puede entrar. Para uso offline hay que bajar los archivos al repo.
- **Plan gratuito de Firebase.** Alcanza de sobra: solo se guardan el padron y
  los usuarios, nunca las fichadas.

---

## Publicar en GitHub Pages

1. Subi el contenido de esta carpeta a un repo.
2. Settings → Pages → Source: `Deploy from a branch`, branch `main`, `/ (root)`.
3. En Firebase: Authentication → Settings → Authorized domains → agrega
   `usuario.github.io`. Sin eso, el login falla en produccion aunque ande local.

El servidor de Pages es Linux y distingue mayusculas: si anda local pero da 404
publicado, revisa la capitalizacion de las carpetas.

---

Version 0.2
