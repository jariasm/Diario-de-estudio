// ============================================================
// Diario de Estudio
// ------------------------------------------------------------
// Todo se guarda en localStorage del navegador.
// Las fechas se manejan SIEMPRE en hora local del usuario.
// ============================================================

// Clave con la que guardamos las sesiones en localStorage.
const CLAVE_ALMACEN = 'diarioDeEstudio.sesiones';

// Referencias a los elementos del HTML.
const formulario = document.getElementById('formulario');
const campoFecha = document.getElementById('fecha');
const campoTema = document.getElementById('tema');
const campoMinutos = document.getElementById('minutos');
const campoError = document.getElementById('error');
const rachaNumero = document.getElementById('racha-numero');
const mejorRachaNumero = document.getElementById('mejor-racha-numero');
const rachaMarcas = document.getElementById('racha-marcas');
const rachaUnidad = document.getElementById('racha-unidad');
const mejorRachaUnidad = document.getElementById('mejor-racha-unidad');
const minutosSemana = document.getElementById('minutos-semana');
const diasMes = document.getElementById('dias-mes');
const listaSesiones = document.getElementById('lista-sesiones');
const mensajeVacio = document.getElementById('mensaje-vacio');
const tituloSesion = document.getElementById('titulo-sesion');
const botonGuardar = document.getElementById('guardar');
const botonCancelar = document.getElementById('cancelar');
const aviso = document.getElementById('aviso');

// Vistas (registrar / estadísticas) y sus gráficos.
const vistaRegistro = document.getElementById('vista-registro');
const vistaEstadisticas = document.getElementById('vista-estadisticas');
const enlaceRegistro = document.getElementById('enlace-registro');
const enlaceEstadisticas = document.getElementById('enlace-estadisticas');
const kpiTotal = document.getElementById('kpi-total');
const kpiDias = document.getElementById('kpi-dias');
const kpiMedia = document.getElementById('kpi-media');
const kpiMejor = document.getElementById('kpi-mejor');
const kpiMejorFecha = document.getElementById('kpi-mejor-fecha');
const graficoTendencia = document.getElementById('grafico-tendencia');
const tendenciaVacio = document.getElementById('tendencia-vacio');
const graficoPie = document.getElementById('grafico-pie');
const leyendaPie = document.getElementById('leyenda-pie');
const pieVacio = document.getElementById('pie-vacio');

// Últimas sesiones pintadas: las estadísticas se dibujan a partir de aquí.
let sesionesActuales = [];

// Índice de la sesión que se está editando en el formulario.
// null = no estamos editando (el formulario crea una sesión nueva).
let indiceEnEdicion = null;

// ------------------------------------------------------------
// Fechas (en hora local, nunca UTC)
// ------------------------------------------------------------

// Convierte un objeto Date a texto "AAAA-MM-DD" usando la fecha local.
function fechaLocalAISO(fecha) {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

// Devuelve "AAAA-MM-DD" del día de hoy.
function hoyISO() {
  return fechaLocalAISO(new Date());
}

// Devuelve "AAAA-MM-DD" de hace N días (0 = hoy, 1 = ayer, 2 = anteayer...).
function diaHaciaAtras(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - dias);
  return fechaLocalAISO(fecha);
}

// Devuelve "AAAA-MM-DD" del día siguiente (en hora local).
function sumarUnDia(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia); // medianoche local
  fecha.setDate(fecha.getDate() + 1);
  return fechaLocalAISO(fecha);
}

// Comprueba que una fecha es un día real con formato "AAAA-MM-DD".
function esFechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }
  const [anio, mes, dia] = fecha.split('-').map(Number);
  // Si al volver a formatearla no coincide, era una fecha imposible (mes 13, 32 de enero...).
  return fechaLocalAISO(new Date(anio, mes - 1, dia)) === fecha;
}

// Convierte "AAAA-MM-DD" a texto "DD/MM/AAAA" para mostrarlo.
function mostrarFecha(fechaISO) {
  if (typeof fechaISO !== 'string') {
    return '';
  }
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

// Devuelve "AAAA-MM-DD" del lunes de la semana actual (en hora local).
function inicioDeSemanaISO() {
  const hoy = new Date();
  const desfase = (hoy.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo
  hoy.setDate(hoy.getDate() - desfase);
  return fechaLocalAISO(hoy);
}

// ------------------------------------------------------------
// Guardar y leer de localStorage
// ------------------------------------------------------------

// Lee las sesiones guardadas. Siempre devuelve un array.
function cargarSesiones() {
  const datos = localStorage.getItem(CLAVE_ALMACEN);
  if (!datos) {
    return [];
  }
  try {
    const sesiones = JSON.parse(datos);
    return Array.isArray(sesiones) ? sesiones : [];
  } catch (error) {
    // Si el dato está dañado, empezamos de cero para no romper la web.
    return [];
  }
}

// Guarda el array de sesiones en localStorage.
function guardarSesiones(sesiones) {
  localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(sesiones));
}

// ------------------------------------------------------------
// Racha
// ------------------------------------------------------------

// Devuelve un Set con las fechas válidas que tienen al menos una sesión.
// Ignora fechas malformadas para no romper los cálculos.
function diasConSesionDe(sesiones) {
  const dias = new Set();
  for (const sesion of sesiones) {
    if (sesion && esFechaValida(sesion.fecha)) {
      dias.add(sesion.fecha);
    }
  }
  return dias;
}

// Calcula los días consecutivos con sesión.
//
// Reglas:
// - Cuenta desde hoy si hoy ya hay sesión.
// - Si hoy no hay sesión pero ayer sí, la racha sigue viva y
//   se cuenta desde ayer (no se rompe hasta que acabe el día).
// - En cualquier otro caso, la racha es 0.
function calcularRacha(sesiones) {
  // Un Set guarda las fechas que tienen al menos una sesión.
  const diasConSesion = diasConSesionDe(sesiones);

  // Decidimos desde qué día empezamos a contar.
  let inicio = 0; // 0 = hoy
  if (!diasConSesion.has(diaHaciaAtras(0))) {
    if (diasConSesion.has(diaHaciaAtras(1))) {
      inicio = 1; // ayer, pero la racha sigue viva
    } else {
      return 0; // ni hoy ni ayer: no hay racha
    }
  }

  // Contamos hacia atrás mientras los días tengan sesión.
  let racha = 0;
  while (diasConSesion.has(diaHaciaAtras(inicio + racha))) {
    racha++;
  }
  return racha;
}

// Calcula la mejor racha: la secuencia más larga de días consecutivos
// con sesión en todo el historial (no tiene que terminar en hoy).
// A diferencia de la racha actual, NO aplica la "regla del día vivo".
function calcularMejorRacha(sesiones) {
  // Fechas ordenadas de más antigua a más reciente
  // (el formato "AAAA-MM-DD" se ordena bien como texto).
  const dias = [...diasConSesionDe(sesiones)].sort();

  let mejor = 0;
  let racha = 0;
  let anterior = null;

  for (const dia of dias) {
    // Si este día es justo el siguiente al anterior, la racha sigue.
    if (anterior !== null && sumarUnDia(anterior) === dia) {
      racha++;
    } else {
      racha = 1;
    }
    if (racha > mejor) {
      mejor = racha;
    }
    anterior = dia;
  }

  return mejor;
}

// ------------------------------------------------------------
// Estadísticas
// ------------------------------------------------------------

// Suma los minutos de las sesiones desde el lunes hasta hoy (hora local).
// Excluye las fechas futuras y las inválidas.
function calcularMinutosSemana(sesiones) {
  const inicio = inicioDeSemanaISO();
  const fin = hoyISO();
  let total = 0;
  for (const sesion of sesiones) {
    if (
      sesion &&
      esFechaValida(sesion.fecha) &&
      sesion.fecha >= inicio &&
      sesion.fecha <= fin
    ) {
      total += Number(sesion.minutos) || 0;
    }
  }
  return total;
}

// Convierte una cantidad de minutos a texto: "45 min", "1 h", "2 h 30 min".
function formatearMinutos(total) {
  if (total < 60) {
    return `${total} min`;
  }
  const horas = Math.floor(total / 60);
  const minutos = total % 60;
  return minutos === 0 ? `${horas} h` : `${horas} h ${minutos} min`;
}

// Prefijo del mes actual: "AAAA-MM" (hora local).
function prefijoMesActual() {
  return hoyISO().slice(0, 7);
}

// Cuenta los días distintos con sesión en el mes actual (excluye futuros).
function calcularDiasDelMes(sesiones) {
  const prefijo = prefijoMesActual();
  const fin = hoyISO();
  let dias = 0;
  for (const fecha of diasConSesionDe(sesiones)) {
    if (fecha.slice(0, 7) === prefijo && fecha <= fin) {
      dias++;
    }
  }
  return dias;
}

// Texto del recuento de días: "0 días", "1 día", "N días".
function formatearDias(total) {
  return total === 1 ? '1 día' : `${total} días`;
}

// ------------------------------------------------------------
// Analíticas (para la vista de estadísticas)
// ------------------------------------------------------------

// Sesiones con fecha real y no futura: la base de todos los agregados.
function sesionesValidas(sesiones) {
  const hoy = hoyISO();
  return sesiones.filter(
    (sesion) => sesion && esFechaValida(sesion.fecha) && sesion.fecha <= hoy
  );
}

// Minutos de una sesión, saneados (ni negativos ni decimales).
function minutosDe(sesion) {
  return Math.max(0, Math.round(Number(sesion.minutos) || 0));
}

// Agrupa por día: Map "AAAA-MM-DD" -> { minutos, sesiones }.
function agregadoPorDia(sesiones) {
  const porDia = new Map();
  for (const sesion of sesionesValidas(sesiones)) {
    const actual = porDia.get(sesion.fecha) || { minutos: 0, sesiones: 0 };
    actual.minutos += minutosDe(sesion);
    actual.sesiones += 1;
    porDia.set(sesion.fecha, actual);
  }
  return porDia;
}

// Serie de los últimos N días (del más antiguo a hoy), con ceros en los huecos.
function serieUltimosDias(sesiones, dias) {
  const porDia = agregadoPorDia(sesiones);
  const serie = [];
  for (let i = dias - 1; i >= 0; i--) {
    const fecha = diaHaciaAtras(i);
    const dato = porDia.get(fecha) || { minutos: 0, sesiones: 0 };
    serie.push({ fecha, minutos: dato.minutos, sesiones: dato.sesiones });
  }
  return serie;
}

// Clave para agrupar temas ignorando mayúsculas, acentos y espacios sobrantes.
function claveTema(tema) {
  const texto = typeof tema === 'string' ? tema.trim() : '';
  if (!texto) {
    return '';
  }
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Minutos por tema, agrupando variantes y quedándose con la grafía más usada.
function agregadoPorTema(sesiones) {
  const porClave = new Map();
  for (const sesion of sesionesValidas(sesiones)) {
    const grafia =
      typeof sesion.tema === 'string' && sesion.tema.trim() ? sesion.tema.trim() : 'Sin tema';
    const clave = claveTema(grafia);
    let grupo = porClave.get(clave);
    if (!grupo) {
      grupo = { minutos: 0, grafias: new Map() };
      porClave.set(clave, grupo);
    }
    grupo.minutos += minutosDe(sesion);
    grupo.grafias.set(grafia, (grupo.grafias.get(grafia) || 0) + 1);
  }

  const lista = [];
  for (const grupo of porClave.values()) {
    let tema = '';
    let veces = -1;
    for (const [grafia, usos] of grupo.grafias) {
      if (usos > veces) {
        tema = grafia;
        veces = usos;
      }
    }
    lista.push({ tema, minutos: grupo.minutos });
  }
  // De mayor a menor; los empates conservan el orden de aparición.
  lista.sort((a, b) => b.minutos - a.minutos);
  return lista;
}

// Reduce el reparto a las N rebanadas mayores más una de "Otros".
function repartoPie(lista, max) {
  const conMinutos = lista.filter((item) => item.minutos > 0);
  if (conMinutos.length <= max) {
    return conMinutos;
  }
  const principales = conMinutos.slice(0, max);
  const resto = conMinutos.slice(max).reduce((suma, item) => suma + item.minutos, 0);
  principales.push({ tema: 'Otros', minutos: resto });
  return principales;
}

// Porcentaje entero (redondeado) de una parte sobre el total.
function porcentajeDe(parte, total) {
  if (!total) {
    return 0;
  }
  return Math.round((parte / total) * 100);
}

// Resumen histórico para los indicadores de cabecera.
function resumenHistorico(sesiones) {
  const porDia = agregadoPorDia(sesiones);
  let total = 0;
  let mejorFecha = null;
  let mejorMinutos = 0;

  for (const [fecha, dato] of porDia) {
    total += dato.minutos;
    if (
      dato.minutos > 0 &&
      (dato.minutos > mejorMinutos || (dato.minutos === mejorMinutos && mejorFecha && fecha > mejorFecha))
    ) {
      mejorMinutos = dato.minutos;
      mejorFecha = fecha;
    }
  }

  const dias = porDia.size;
  const media = dias > 0 ? Math.round(total / dias) : 0;
  return { total, dias, media, mejorFecha, mejorMinutos };
}

// Redondea la escala de un eje a un valor "bonito" (1, 2 o 5 por su magnitud).
function redondearBonito(valor) {
  if (!(valor > 0)) {
    return 1;
  }
  const magnitud = Math.pow(10, Math.floor(Math.log10(valor)));
  const resto = valor / magnitud;
  let paso;
  if (resto <= 1) {
    paso = 1;
  } else if (resto <= 2) {
    paso = 2;
  } else if (resto <= 5) {
    paso = 5;
  } else {
    paso = 10;
  }
  return paso * magnitud;
}

// "DD/MM" (para las etiquetas del eje de tiempo).
function mostrarFechaCorta(fechaISO) {
  if (typeof fechaISO !== 'string' || fechaISO.length < 10) {
    return '';
  }
  return `${fechaISO.slice(8, 10)}/${fechaISO.slice(5, 7)}`;
}

// ------------------------------------------------------------
// Dibujar en pantalla
// ------------------------------------------------------------

// Dibuja la racha como marcas de conteo: grupos de cuatro rayas
// y una cruz que los tacha. Con 0 días, un guion tenue.
function pintarMarcas(contenedor, total) {
  contenedor.innerHTML = '';

  if (total <= 0) {
    const guion = document.createElement('span');
    guion.className = 'marca-guion';
    guion.textContent = '—';
    contenedor.appendChild(guion);
    return;
  }

  let restantes = total;
  while (restantes > 0) {
    const enGrupo = Math.min(restantes, 5);
    const grupo = document.createElement('span');
    grupo.className = 'marca-grupo';

    // Cuatro rayas verticales...
    for (let i = 0; i < Math.min(enGrupo, 4); i++) {
      const raya = document.createElement('span');
      raya.className = 'marca-linea';
      grupo.appendChild(raya);
    }

    // ...y, si el grupo llega a cinco, la cruz que las tacha.
    if (enGrupo === 5) {
      const cruz = document.createElement('span');
      cruz.className = 'marca-cruz';
      grupo.appendChild(cruz);
    }

    contenedor.appendChild(grupo);
    restantes -= enGrupo;
  }
}

// Iconos en SVG en línea: sin archivos ni librerías, funcionan sin conexión.
const ICONO_LAPIZ = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>';
const ICONO_PAPELERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>';

// Ordena de la más reciente a la más antigua, guardando junto a cada
// sesión su posición en el array guardado. Así, aunque haya sesiones
// idénticas, sabemos exactamente cuál editar o cuál borrar.
function sesionesOrdenadasConIndice(sesiones) {
  return sesiones
    .map((sesion, indice) => ({ sesion, indice }))
    .sort((a, b) => (a.sesion.fecha < b.sesion.fecha ? 1 : a.sesion.fecha > b.sesion.fecha ? -1 : 0));
}

// Texto que describe una sesión (para mensajes y etiquetas accesibles).
function descripcionSesion(sesion) {
  const tema = typeof sesion.tema === 'string' && sesion.tema ? sesion.tema : 'sesión sin tema';
  const fecha = esFechaValida(sesion.fecha) ? ` del ${mostrarFecha(sesion.fecha)}` : '';
  return `«${tema}»${fecha}`;
}

// Crea un botón de icono con su nombre accesible.
function crearBotonIcono(etiqueta, svg, alPulsar, peligro) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = peligro ? 'boton-icono peligro' : 'boton-icono';
  boton.innerHTML = svg;
  boton.setAttribute('aria-label', etiqueta);
  boton.addEventListener('click', alPulsar);
  return boton;
}

// Anuncia un mensaje a los lectores de pantalla (el texto no se ve).
function anunciar(texto) {
  aviso.textContent = '';
  // Un instante de margen para que el cambio se detecte y se lea.
  setTimeout(() => {
    aviso.textContent = texto;
  }, 60);
}

// Muestra la racha, la lista de sesiones y el mensaje de "vacío".
function pintar(sesiones) {
  const racha = calcularRacha(sesiones);
  const mejorRacha = calcularMejorRacha(sesiones);

  rachaNumero.textContent = racha;
  rachaUnidad.textContent = racha === 1 ? 'día seguido' : 'días seguidos';
  mejorRachaNumero.textContent = mejorRacha;
  mejorRachaUnidad.textContent = mejorRacha === 1 ? 'día' : 'días';
  pintarMarcas(rachaMarcas, racha);

  minutosSemana.textContent = formatearMinutos(calcularMinutosSemana(sesiones));
  diasMes.textContent = formatearDias(calcularDiasDelMes(sesiones));

  const filas = sesionesOrdenadasConIndice(sesiones);

  // Mensaje cuando todavía no hay sesiones.
  mensajeVacio.hidden = filas.length > 0;

  listaSesiones.innerHTML = '';
  for (const { sesion, indice } of filas) {
    // Cada entrada es una fila del libro: fecha, tema, minutos y acciones.
    const elemento = document.createElement('li');
    elemento.className = indice === indiceEnEdicion ? 'sesion editando' : 'sesion';

    const fecha = document.createElement('span');
    fecha.className = 'sesion-fecha';
    fecha.textContent = mostrarFecha(sesion.fecha);

    const tema = document.createElement('span');
    tema.className = 'sesion-tema';
    tema.textContent = sesion.tema;

    const minutos = document.createElement('span');
    minutos.className = 'sesion-minutos';
    minutos.textContent = `${sesion.minutos} min`;

    const acciones = document.createElement('span');
    acciones.className = 'sesion-acciones';

    const etiqueta = descripcionSesion(sesion);
    acciones.appendChild(
      crearBotonIcono(`Editar ${etiqueta}`, ICONO_LAPIZ, () => iniciarEdicion(indice))
    );
    acciones.appendChild(
      crearBotonIcono(`Borrar ${etiqueta}`, ICONO_PAPELERA, () => pedirBorrar(indice), true)
    );

    elemento.appendChild(fecha);
    elemento.appendChild(tema);
    elemento.appendChild(minutos);
    elemento.appendChild(acciones);
    listaSesiones.appendChild(elemento);
  }

  // Guardamos las sesiones y, si la vista de estadísticas está a la vista,
  // la volvemos a dibujar (necesita medir el ancho real para los gráficos).
  sesionesActuales = sesiones;
  if (!vistaEstadisticas.hidden) {
    pintarEstadisticas(sesiones);
  }
}

// ------------------------------------------------------------
// Gráficos de estadísticas (SVG dibujado a mano, sin librerías)
// ------------------------------------------------------------

const ESPACIO_SVG = 'http://www.w3.org/2000/svg';

// Crea un nodo SVG con sus atributos.
function crearNodoSVG(nombre, atributos) {
  const nodo = document.createElementNS(ESPACIO_SVG, nombre);
  if (atributos) {
    for (const clave in atributos) {
      nodo.setAttribute(clave, String(atributos[clave]));
    }
  }
  return nodo;
}

// Texto SVG: siempre con textContent, nunca innerHTML con texto del usuario.
function crearTextoSVG(x, y, texto, clase) {
  const nodo = crearNodoSVG('text', { x, y, class: clase });
  nodo.textContent = texto;
  return nodo;
}

// Punto de la circunferencia: 0º arriba y en sentido de las agujas del reloj.
function puntoEnCirculo(cx, cy, radio, angulo) {
  const radianes = ((angulo - 90) * Math.PI) / 180;
  return { x: cx + radio * Math.cos(radianes), y: cy + radio * Math.sin(radianes) };
}

// Trazado de una rebanada de tarta entre dos ángulos.
function trazadoDeRebanada(cx, cy, radio, inicio, fin) {
  const p1 = puntoEnCirculo(cx, cy, radio, inicio);
  const p2 = puntoEnCirculo(cx, cy, radio, fin);
  const arcoGrande = fin - inicio > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radio} ${radio} 0 ${arcoGrande} 1 ${p2.x} ${p2.y} Z`;
}

// Trazado de la línea que une una lista de puntos.
function trazadoDeLinea(puntos) {
  return puntos.map((punto, i) => `${i === 0 ? 'M' : 'L'} ${punto.x} ${punto.y}`).join(' ');
}

// Gráfico de tendencia: minutos por día (arriba) y sesiones por día (abajo),
// los dos sobre el mismo eje de tiempo.
function construirTendencia(serie, ancho, alto) {
  const margen = { izq: 44, der: 12, sup: 26, inf: 32 };
  const x0 = margen.izq;
  const x1 = ancho - margen.der;
  const anchoUtil = x1 - x0;

  const espacio = alto - margen.sup - margen.inf;
  const alturaSes = Math.round(espacio * 0.28);
  const separacion = 24;
  const alturaMin = espacio - alturaSes - separacion;
  const yMinBase = margen.sup + alturaMin;
  const ySesTop = yMinBase + separacion;
  const ySesBase = ySesTop + alturaSes;

  const n = serie.length;
  const pasoX = n > 1 ? anchoUtil / (n - 1) : 0;
  const xDe = (i) => x0 + pasoX * i;

  const maxMinutos = Math.max(0, ...serie.map((d) => d.minutos));
  const maxSesiones = Math.max(0, ...serie.map((d) => d.sesiones));
  const escalaMin = redondearBonito(maxMinutos);
  const escalaSes = redondearBonito(maxSesiones);
  const totalMinutos = serie.reduce((suma, d) => suma + d.minutos, 0);

  const svg = crearNodoSVG('svg', {
    viewBox: `0 0 ${ancho} ${alto}`,
    class: 'grafico-svg',
    role: 'img',
    'aria-label': `Tendencia de los últimos ${n} días: ${formatearMinutos(totalMinutos)} en total; máximo ${formatearMinutos(maxMinutos)} en un día.`,
  });

  // --- Banda de minutos: título, rejilla y etiquetas ---
  svg.appendChild(crearTextoSVG(x0, margen.sup - 12, 'Minutos por día', 'grafico-titulo-banda'));
  [0, escalaMin / 2, escalaMin].forEach((valor) => {
    const y = yMinBase - (valor / escalaMin) * alturaMin;
    svg.appendChild(crearNodoSVG('line', { x1: x0, y1: y, x2: x1, y2: y, class: 'grafico-rejilla' }));
    svg.appendChild(crearTextoSVG(x0 - 8, y + 3, `${Math.round(valor)}`, 'grafico-eje-y'));
  });

  const puntos = serie.map((d, i) => ({ x: xDe(i), y: yMinBase - (d.minutos / escalaMin) * alturaMin }));
  const area =
    `M ${x0} ${yMinBase} ` + puntos.map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${x1} ${yMinBase} Z`;
  svg.appendChild(crearNodoSVG('path', { d: area, class: 'grafico-area' }));
  svg.appendChild(crearNodoSVG('path', { d: trazadoDeLinea(puntos), class: 'grafico-linea' }));
  puntos.forEach((p) => svg.appendChild(crearNodoSVG('circle', { cx: p.x, cy: p.y, r: 2.4, class: 'grafico-punto' })));

  // --- Banda de sesiones: título, línea base y barras ---
  svg.appendChild(crearTextoSVG(x0, ySesTop - 8, 'Sesiones por día', 'grafico-titulo-banda'));
  svg.appendChild(crearNodoSVG('line', { x1: x0, y1: ySesBase, x2: x1, y2: ySesBase, class: 'grafico-rejilla' }));
  const anchoBarra = Math.max(3, (anchoUtil / n) * 0.5);
  serie.forEach((d, i) => {
    if (d.sesiones <= 0) {
      return;
    }
    const altoBarra = (d.sesiones / escalaSes) * alturaSes;
    svg.appendChild(crearNodoSVG('rect', {
      x: xDe(i) - anchoBarra / 2,
      y: ySesBase - altoBarra,
      width: anchoBarra,
      height: altoBarra,
      rx: 1,
      class: 'grafico-barra',
    }));
  });

  // --- Etiquetas del eje de tiempo (un día sí, otro no, para no amontonar) ---
  const paso = Math.max(1, Math.ceil(n / 6));
  for (let i = 0; i < n - 1; i += paso) {
    svg.appendChild(crearTextoSVG(xDe(i), alto - 12, mostrarFechaCorta(serie[i].fecha), 'grafico-eje-x'));
  }
  svg.appendChild(crearTextoSVG(xDe(n - 1), alto - 12, 'hoy', 'grafico-eje-x'));

  return svg;
}

// Gráfico de tarta del reparto por tema.
function construirPie(reparto, total) {
  const tam = 240;
  const cx = tam / 2;
  const cy = tam / 2;
  const radio = tam / 2 - 6;

  const svg = crearNodoSVG('svg', {
    viewBox: `0 0 ${tam} ${tam}`,
    class: 'grafico-svg grafico-svg-pie',
    role: 'img',
    'aria-label': `Reparto por tema: ${reparto
      .map((item) => `${item.tema}, ${formatearMinutos(item.minutos)}`)
      .join('; ')}.`,
  });

  // Con una sola rebanada, un arco de 360º no se dibuja: usamos un círculo.
  if (reparto.length === 1) {
    svg.appendChild(crearNodoSVG('circle', { cx, cy, r: radio, class: 'cuña cuña-1' }));
    return svg;
  }

  let angulo = 0;
  reparto.forEach((item, i) => {
    const barrido = (item.minutos / total) * 360;
    svg.appendChild(crearNodoSVG('path', {
      d: trazadoDeRebanada(cx, cy, radio, angulo, angulo + barrido),
      class: `cuña cuña-${i + 1}`,
    }));
    angulo += barrido;
  });
  return svg;
}

// Una fila de la leyenda de la tarta.
function construirFilaLeyenda(item, total, numero) {
  const fila = document.createElement('li');
  fila.className = 'leyenda-item';

  const color = document.createElement('span');
  color.className = `leyenda-color cuña-${numero}`;
  color.setAttribute('aria-hidden', 'true');

  const nombre = document.createElement('span');
  nombre.className = 'leyenda-tema';
  nombre.textContent = item.tema;

  const valor = document.createElement('span');
  valor.className = 'leyenda-valor';
  valor.textContent = `${formatearMinutos(item.minutos)} · ${porcentajeDe(item.minutos, total)} %`;

  fila.appendChild(color);
  fila.appendChild(nombre);
  fila.appendChild(valor);
  return fila;
}

// Dibuja toda la vista de estadísticas.
function pintarEstadisticas(sesiones) {
  // Indicadores de cabecera.
  const resumen = resumenHistorico(sesiones);
  kpiTotal.textContent = formatearMinutos(resumen.total);
  kpiDias.textContent = String(resumen.dias);
  kpiMedia.textContent = formatearMinutos(resumen.media);
  if (resumen.mejorFecha) {
    kpiMejor.textContent = formatearMinutos(resumen.mejorMinutos);
    kpiMejorFecha.textContent = `mejor día · ${mostrarFecha(resumen.mejorFecha)}`;
  } else {
    kpiMejor.textContent = '—';
    kpiMejorFecha.textContent = 'mejor día';
  }

  // Tendencia de los últimos 30 días.
  const serie = serieUltimosDias(sesiones, 30);
  const hayDatos = resumen.dias > 0;
  tendenciaVacio.hidden = hayDatos;
  graficoTendencia.hidden = !hayDatos;
  graficoTendencia.innerHTML = '';
  if (hayDatos) {
    const ancho = graficoTendencia.clientWidth || 540;
    const alto = Math.max(210, Math.min(320, Math.round(ancho * 0.46)));
    graficoTendencia.appendChild(construirTendencia(serie, ancho, alto));
  }

  // Reparto por tema (Top 5 + "Otros").
  const reparto = repartoPie(agregadoPorTema(sesiones), 5);
  const totalPie = reparto.reduce((suma, item) => suma + item.minutos, 0);
  const hayPie = totalPie > 0;
  pieVacio.hidden = hayPie;
  graficoPie.hidden = !hayPie;
  graficoPie.innerHTML = '';
  leyendaPie.innerHTML = '';
  if (hayPie) {
    graficoPie.appendChild(construirPie(reparto, totalPie));
    reparto.forEach((item, i) => leyendaPie.appendChild(construirFilaLeyenda(item, totalPie, i + 1)));
  }
}

// ------------------------------------------------------------
// Formulario
// ------------------------------------------------------------

function mostrarError(texto) {
  campoError.textContent = texto;
  campoError.hidden = false;
}

function ocultarError() {
  campoError.textContent = '';
  campoError.hidden = true;
}

// Ajusta el formulario según el modo: crear una sesión nueva o editar una.
function aplicarModoFormulario() {
  const editando = indiceEnEdicion !== null;
  tituloSesion.textContent = editando ? 'Editar sesión' : 'Nueva sesión';
  botonGuardar.textContent = editando ? 'Guardar cambios' : 'Guardar sesión';
  botonCancelar.hidden = !editando;
}

// Carga una sesión en el formulario para editarla.
function iniciarEdicion(indice) {
  const sesiones = cargarSesiones();
  const sesion = sesiones[indice];
  if (!sesion) {
    return;
  }

  indiceEnEdicion = indice;
  ocultarError();

  campoFecha.value = esFechaValida(sesion.fecha) ? sesion.fecha : hoyISO();
  campoTema.value = typeof sesion.tema === 'string' ? sesion.tema : '';
  campoMinutos.value = Number.isFinite(Number(sesion.minutos)) ? sesion.minutos : '';

  aplicarModoFormulario();
  pintar(sesiones); // resalta la fila que se está editando

  campoTema.focus();
}

// Vuelve al modo "nueva sesión", limpia el formulario y repinta.
function terminarEdicion(mensaje) {
  indiceEnEdicion = null;
  ocultarError();
  formulario.reset();
  campoFecha.value = hoyISO();
  aplicarModoFormulario();
  pintar(cargarSesiones());
  if (mensaje) {
    anunciar(mensaje);
  }
  campoTema.focus();
}

// Pide confirmación y borra la sesión indicada.
function pedirBorrar(indice) {
  const sesiones = cargarSesiones();
  const sesion = sesiones[indice];
  if (!sesion) {
    return;
  }

  if (!confirm(`¿Borrar ${descripcionSesion(sesion)}?`)) {
    return;
  }

  sesiones.splice(indice, 1);
  guardarSesiones(sesiones);

  // Al borrar cambian las posiciones: si estábamos editando, salimos del modo edición.
  if (indiceEnEdicion !== null) {
    terminarEdicion('Sesión borrada.');
  } else {
    pintar(sesiones);
    anunciar('Sesión borrada.');
  }
}

// Se ejecuta al enviar el formulario (crear una sesión nueva o guardar cambios).
function alEnviar(evento) {
  evento.preventDefault();
  ocultarError();

  const fecha = campoFecha.value; // ya viene como "AAAA-MM-DD"
  const tema = campoTema.value.trim();
  const minutos = Number(campoMinutos.value);

  const sesiones = cargarSesiones();
  const sesionOriginal = indiceEnEdicion !== null ? sesiones[indiceEnEdicion] : null;

  // Comprobamos que los datos son correctos.
  if (!fecha) {
    mostrarError('Elige una fecha.');
    return;
  }
  // No se admiten fechas futuras (salvo conservar una ya guardada sin cambios).
  if (fecha > hoyISO() && (!sesionOriginal || fecha !== sesionOriginal.fecha)) {
    mostrarError('La fecha no puede ser futura.');
    return;
  }
  if (!tema) {
    mostrarError('Escribe el tema que has estudiado.');
    return;
  }
  if (!minutos || minutos <= 0) {
    mostrarError('Los minutos deben ser un número mayor que 0.');
    return;
  }

  if (sesionOriginal) {
    // Editamos: la sesión se queda en su misma posición del array.
    sesiones[indiceEnEdicion] = { fecha, tema, minutos };
    guardarSesiones(sesiones);
    terminarEdicion('Sesión actualizada.');
  } else {
    // Creamos la sesión y la ponemos al principio (la más nueva primero).
    sesiones.unshift({ fecha, tema, minutos });
    guardarSesiones(sesiones);
    pintar(sesiones);

    // Dejamos el formulario listo para la siguiente sesión.
    formulario.reset();
    campoFecha.value = hoyISO();
    campoTema.focus();
  }
}

// ------------------------------------------------------------
// Vistas (registrar / estadísticas)
// ------------------------------------------------------------

// Hash actual de la URL, tolerante a entornos sin location.
function hashActual() {
  return typeof location !== 'undefined' && location.hash ? location.hash : '';
}

// Muestra una vista u otra según el hash de la URL.
function mostrarVista() {
  const enEstadisticas = hashActual() === '#estadisticas';
  vistaEstadisticas.hidden = !enEstadisticas;
  vistaRegistro.hidden = enEstadisticas;
  enlaceRegistro.setAttribute('aria-current', enEstadisticas ? 'false' : 'page');
  enlaceEstadisticas.setAttribute('aria-current', enEstadisticas ? 'page' : 'false');

  // Al entrar en estadísticas medimos y dibujamos (la vista oculta no tiene ancho).
  if (enEstadisticas) {
    pintarEstadisticas(sesionesActuales);
  }
}

// Al cambiar el ancho, las gráficas se vuelven a trazar para no deformarse.
let temporizadorAncho = null;
function alCambiarAncho() {
  clearTimeout(temporizadorAncho);
  temporizadorAncho = setTimeout(() => {
    if (!vistaEstadisticas.hidden) {
      pintarEstadisticas(sesionesActuales);
    }
  }, 120);
}

// ------------------------------------------------------------
// Arranque
// ------------------------------------------------------------

formulario.addEventListener('submit', alEnviar);
botonCancelar.addEventListener('click', () => terminarEdicion(null));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', mostrarVista);
  window.addEventListener('resize', alCambiarAncho);
}

// Al abrir la página, la fecha por defecto es hoy y no se admiten días futuros.
campoFecha.max = hoyISO();
campoFecha.value = hoyISO();
aplicarModoFormulario();

// Elegimos la vista antes de pintar, para que los gráficos midan bien.
mostrarVista();

// Mostramos lo que ya había guardado.
pintar(cargarSesiones());
