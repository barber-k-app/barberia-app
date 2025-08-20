// 1. Configuración Segura de Supabase (usa .env en producción)
const supabaseUrl = 'https://jjihjvegheguvmradmau.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaWhqdmVnaGVndXZtcmFkbWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODU5MzEsImV4cCI6MjA3MDY2MTkzMX0._wkRKxSbsEaHXXYhQMYSIgLBOLfeLAZbH0E9Tx4W7Tk';

// Inicializar Supabase
const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.error('Error: No se pudo inicializar Supabase');
  // Cargar el script dinámicamente si es necesario
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@supabase/supabase-js@2';
  script.onload = () => {
    window.supabase = supabase.createClient(supabaseUrl, supabaseKey);
    console.log('Supabase cargado dinámicamente');
  };
  document.head.appendChild(script);
}

/******************************************
 * SISTEMA DE CACHÉ MEJORADO PARA BARBER-K
 * Reduce drásticamente las consultas a Supabase
 ******************************************/
const BarberCache = {
  // Caché en memoria para datos de corta duración
  memoryCache: new Map(),
  memoryCacheTimers: new Map(),
  
  // Obtener datos del caché (localStorage + memoria)
  get: (key, useMemory = true) => {
    // Primero verificar caché en memoria (más rápido)
    if (useMemory && BarberCache.memoryCache.has(key)) {
      const cached = BarberCache.memoryCache.get(key);
      if (cached.ttl && Date.now() - cached.timestamp > cached.ttl) {
        BarberCache.memoryCache.delete(key);
        BarberCache.memoryCacheTimers.delete(key);
      } else {
        return cached.data;
      }
    }
    
    // Si no está en memoria, verificar localStorage
    try {
      const cached = localStorage.getItem(`bk_${key}`);
      if (!cached) return null;
      
      const { data, timestamp, ttl } = JSON.parse(cached);
      
      // Verificar si el caché ha expirado
      if (ttl && Date.now() - timestamp > ttl) {
        localStorage.removeItem(`bk_${key}`);
        return null;
      }
      
      return data;
    } catch (e) {
      console.error('Error leyendo caché:', e);
      return null;
    }
  },
  
  // Guardar datos en caché (ambos almacenamientos)
  set: (key, data, ttl = 30 * 60 * 1000, useMemory = true) => {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl
      };
      
      // Guardar en localStorage para persistencia
      localStorage.setItem(`bk_${key}`, JSON.stringify(cacheData));
      
      // Guardar en memoria para acceso rápido
      if (useMemory) {
        BarberCache.memoryCache.set(key, cacheData);
        
        // Programar limpieza automática de memoria
        if (ttl) {
          // Limpiar timer existente si hay uno
          if (BarberCache.memoryCacheTimers.has(key)) {
            clearTimeout(BarberCache.memoryCacheTimers.get(key));
          }
          
          // Establecer nuevo timer
          const timer = setTimeout(() => {
            BarberCache.memoryCache.delete(key);
            BarberCache.memoryCacheTimers.delete(key);
          }, ttl);
          
          BarberCache.memoryCacheTimers.set(key, timer);
        }
      }
    } catch (e) {
      console.error('Error guardando en caché:', e);
    }
  },
  
  // Limpiar entradas específicas del caché
  clear: (keyPattern) => {
    // Limpiar de memoria
    for (const key of BarberCache.memoryCache.keys()) {
      if (key.startsWith(keyPattern)) {
        BarberCache.memoryCache.delete(key);
        if (BarberCache.memoryCacheTimers.has(key)) {
          clearTimeout(BarberCache.memoryCacheTimers.get(key));
          BarberCache.memoryCacheTimers.delete(key);
        }
      }
    }
    
    // Limpiar de localStorage
    Object.keys(localStorage)
      .filter(key => key.startsWith(`bk_${keyPattern}`))
      .forEach(key => localStorage.removeItem(key));
  },
  
  // Limpiar todo el caché de la aplicación
  clearAll: () => {
    // Limpiar memoria
    BarberCache.memoryCache.clear();
    for (const timer of BarberCache.memoryCacheTimers.values()) {
      clearTimeout(timer);
    }
    BarberCache.memoryCacheTimers.clear();
    
    // Limpiar localStorage
    Object.keys(localStorage)
      .filter(key => key.startsWith('bk_'))
      .forEach(key => localStorage.removeItem(key));
  }
};

// Sistema de deduplicación de solicitudes
const pendingRequests = new Map();

async function deduplicatedSupabaseQuery(key, queryFn, ttl = 5 * 60 * 1000) {
  // Primero verificar caché
  const cached = BarberCache.get(key);
  if (cached) return cached;
  
  // Verificar si ya hay una solicitud en curso para esta clave
  if (pendingRequests.has(key)) {
    // Esperar a que la solicitud existente se complete
    return pendingRequests.get(key);
  }
  
  try {
    // Crear nueva promesa para esta solicitud
    const requestPromise = queryFn();
    pendingRequests.set(key, requestPromise);
    
    // Ejecutar la consulta
    const result = await requestPromise;
    
    // Guardar en caché
    BarberCache.set(key, result, ttl);
    
    return result;
  } finally {
    // Limpiar la solicitud pendiente
    pendingRequests.delete(key);
  }
}

// Configuración de horarios para Venezuela
const CONFIG_VENEZUELA = {
  intervaloEntreCitas: 40, // minutos entre citas
  horarioApertura: '08:00',
  horarioCierre: '21:00',
  zonaHoraria: 'America/Caracas',
  diasTrabajo: [1, 2, 3, 4, 5, 6] // Lunes(1) a Sábado(6)
};

// Función para validar nombre
function validarNombre(nombre) {
  // 1. Eliminar espacios al inicio y final
  const nombreLimpio = nombre.trim();
  
  // 2. Verificar longitud (entre 3 y 50 caracteres)
  if (nombreLimpio.length < 3 || nombreLimpio.length > 50) {
    return {
      valido: false,
      error: 'El nombre debe tener entre 3 y 50 caracteres'
    };
  }
  
  // 3. Verificar que solo contenga letras, espacios y tildes
  const regexNombre = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/;
  if (!regexNombre.test(nombreLimpio)) {
    return {
      valido: false,
      error: 'Solo se permiten letras, espacios y tildes en el nombre'
    };
  }
  
  // 4. Verificar que no sean solo espacios
  if (!nombreLimpio.replace(/\s/g, '').length) {
    return {
      valido: false,
      error: 'El nombre no puede contener solo espacios'
    };
  }
  
  return { valido: true, nombre: nombreLimpio };
}

// Función para validar teléfono venezolano
function validarTelefonoVenezolano(telefono) {
  // 1. Eliminar todos los caracteres no numéricos
  const telefonoLimpio = telefono.replace(/\D/g, '');
  
  // 2. Verificar que tenga exactamente 11 dígitos
  if (telefonoLimpio.length !== 11) {
    return {
      valido: false,
      error: 'El teléfono debe tener 11 dígitos (ej: 04121234567)'
    };
  }
  
  // 3. Verificar que comience con 0
  if (!telefonoLimpio.startsWith('0')) {
    return {
      valido: false,
      error: 'El teléfono debe comenzar con 0 (ej: 04121234567)'
    };
  }
  
  // 4. Verificar códigos de operadoras venezolanas
  const codigosOperadoras = [
    '412', '414', '416', '418', '424', '426', '416', '428', '432', '434'
  ];
  
  const codigo = telefonoLimpio.substring(1, 4); // Obtener los 3 dígitos después del 0
  
  if (!codigosOperadoras.includes(codigo)) {
    return {
      valido: false,
      error: 'Código de operadora no válido. Debe ser un teléfono venezolano (0412, 0414, 0424, etc.)'
    };
  }
  
  return { valido: true, telefono: telefonoLimpio };
}

// Función para verificar si ya existe una cita con el mismo teléfono y nombre
async function verificarCitaExistente(telefono, nombre, fecha) {
  const cacheKey = `cita_existente_${telefono}_${nombre}_${fecha}`;
  
  return deduplicatedSupabaseQuery(cacheKey, async () => {
    try {
      const { data: citas, error } = await supabase
        .from('citas')
        .select('*')
        .eq('telefono', telefono)
        .eq('nombre', nombre)
        .eq('fecha', fecha);

      if (error) throw error;
      
      return citas && citas.length > 0 
        ? { existe: true, cita: citas[0] } 
        : { existe: false };
    } catch (error) {
      console.error('Error verificando cita existente:', error);
      throw error;
    }
  }, 5 * 60 * 1000); // 5 minutos de caché
}

// Función para verificar límite de citas
async function verificarLimiteCitas(telefono, fecha) {
  const cacheKey = `limite_citas_${telefono}_${fecha}`;
  
  return deduplicatedSupabaseQuery(cacheKey, async () => {
    const { data: citas, error } = await supabase
      .from('citas')
      .select('id', { count: 'exact' })
      .eq('telefono', telefono)
      .eq('fecha', fecha);

    if (error) throw error;
    
    return { count: citas.length };
  }, 60 * 60 * 1000); // 1 hora de caché
}

// Función auxiliar para formatear fechas
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 2. Función para obtener hora actual de Venezuela
function obtenerHoraActualVenezuela() {
  return new Date().toLocaleTimeString('es-VE', {
    timeZone: CONFIG_VENEZUELA.zonaHoraria,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 3. Función mejorada para mostrar mensajes
function mostrarMensaje(texto, tipo = 'info') {
  const mensajeDiv = document.getElementById('mensaje');
  if (!mensajeDiv) {
    console.warn('No se encontró el elemento para mostrar mensajes');
    return;
  }
  
  // Limpiar mensajes anteriores
  mensajeDiv.innerHTML = '';
  mensajeDiv.className = ''; // Resetear clases
  
  // Crear elemento de mensaje
  const mensajeElement = document.createElement('div');
  mensajeElement.className = `mensaje ${tipo}`;
  mensajeElement.textContent = texto;
  
  // Agregar botón de cerrar
  const cerrarBtn = document.createElement('button');
  cerrarBtn.textContent = '×';
  cerrarBtn.className = 'cerrar-mensaje';
  cerrarBtn.onclick = () => mensajeDiv.style.display = 'none';
  
  mensajeElement.prepend(cerrarBtn);
  mensajeDiv.appendChild(mensajeElement);
  mensajeDiv.style.display = 'block';
  
  // Ocultar automáticamente después de 5 segundos
  setTimeout(() => {
    mensajeDiv.style.display = 'none';
  }, 5000);
}

// Nueva función auxiliar con caché para obtener citas
async function obtenerCitasParaFecha(fecha) {
  const cacheKey = `citas_${fecha}`;
  
  return deduplicatedSupabaseQuery(cacheKey, async () => {
    const { data: citas, error } = await supabase
      .from('citas')
      .select('hora')
      .eq('fecha', fecha);
    
    if (error) throw error;
    
    return citas;
  }, 10 * 60 * 1000); // Cachear por 10 minutos
}

// 4. Función para verificar disponibilidad de horario (actualizada con caché)
async function verificarDisponibilidad(fecha, hora) {
  const cacheKey = `disp_${fecha}_${hora}`;
  const cached = BarberCache.get(cacheKey, true); // Usar caché en memoria
  if (cached) return cached;
  
  try {
    const [horaSel, minSel] = hora.split(':').map(Number);
    const minutosSel = horaSel * 60 + minSel;
    
    // Obtener citas con caché
    const citas = await obtenerCitasParaFecha(fecha);
    
    // Verificar cada cita existente
    for (const cita of citas) {
      const [horaExistente, minExistente] = cita.hora.split(':').map(Number);
      const minutosExistente = horaExistente * 60 + minExistente;
      
      const diferencia = Math.abs(minutosSel - minutosExistente);
      
      if (diferencia < CONFIG_VENEZUELA.intervaloEntreCitas) {
        const result = {
          disponible: false,
          mensaje: `El horario ${hora} no está disponible. Por favor elige otro.`
        };
        BarberCache.set(cacheKey, result, 5 * 60 * 1000, true); // Cachear en memoria por 5 minutos
        return result;
      }
    }
    
    const result = { disponible: true };
    BarberCache.set(cacheKey, result, 5 * 60 * 1000, true); // Cachear en memoria por 5 minutos
    return result;
  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    return {
      disponible: false,
      mensaje: 'Error al verificar disponibilidad. Intenta nuevamente.'
    };
  }
}

// 5. Validación mejorada de formulario con horario Venezuela
function validarFormulario({nombre, telefono, fecha, hora}) {
  // Validación de nombre mejorada
  const validacionNombre = validarNombre(nombre);
  if (!validacionNombre.valido) {
    return validacionNombre;
  }
  
  // Validación de teléfono mejorada
  const validacionTelefono = validarTelefonoVenezolano(telefono);
  if (!validacionTelefono.valido) {
    return validacionTelefono;
  }
  
  const fechaCita = new Date(`${fecha}T${hora}`);
  const ahora = new Date();
  
  if (fechaCita < ahora) {
    return {valido: false, error: 'La cita no puede ser en el pasado'};
  }
  
  // Validar que no sea domingo
  if (fechaCita.getDay() === 0) {
    return {valido: false, error: 'No trabajamos los domingos. Por favor seleccione un día de Lunes a Sábado.'};
  }
  
  // Validar horario laboral en Venezuela
  const [horaCita, minCita] = hora.split(':').map(Number);
  const [horaApertura] = CONFIG_VENEZUELA.horarioApertura.split(':').map(Number);
  const [horaCierre] = CONFIG_VENEZUELA.horarioCierre.split(':').map(Number);
  
  if (horaCita < horaApertura || horaCita >= horaCierre) {
    return {
      valido: false, 
      error: `Horario no disponible (${CONFIG_VENEZUELA.horarioApertura} a ${CONFIG_VENEZUELA.horarioCierre})`
    };
  }
  
  return {valido: true, telefono: validacionTelefono.telefono || telefono};
}

// Función para generar horarios disponibles
function generarHorariosDisponibles() {
  const selectHorario = document.getElementById('hora-select');
  if (!selectHorario) return;

  // Limpiar opciones existentes
  selectHorario.innerHTML = '';
  const optionDefault = document.createElement('option');
  optionDefault.value = '';
  optionDefault.disabled = true;
  optionDefault.selected = true;
  optionDefault.textContent = 'Selecciona un horario';
  selectHorario.appendChild(optionDefault);

  // Generar horarios de 8:00 AM a 9:00 PM cada 40 minutos
  const horarios = [];
  for (let hora = 8; hora <= 21; hora++) {
    for (let minuto = 0; minuto < 60; minuto += 40) {
      if (hora === 21 && minuto > 0) break; // No pasar de las 9:00 PM
      
      const horaStr = hora.toString().padStart(2, '0');
      const minutoStr = minuto.toString().padStart(2, '0');
      horarios.push(`${horaStr}:${minutoStr}`);
    }
  }

  // Agregar opciones al select
  horarios.forEach(horario => {
    const option = document.createElement('option');
    option.value = horario;
    option.textContent = horario;
    option.dataset.disponible = 'true'; // Marcamos todos como disponibles inicialmente
    selectHorario.appendChild(option);
  });
}

// Función para actualizar disponibilidad en tiempo real (actualizada con caché)
async function actualizarDisponibilidadHorarios(fecha) {
  const selectHorario = document.getElementById('hora-select');
  if (!selectHorario || !fecha) return;

  try {
    // Obtener citas con caché
    const citas = await obtenerCitasParaFecha(fecha);
    
    // Convertir horas de citas existentes a minutos
    const horasOcupadas = citas.map(cita => {
      const [h, m] = cita.hora.split(':').map(Number);
      return h * 60 + m;
    });

    // Procesar opciones de horario
    Array.from(selectHorario.options).forEach(option => {
      if (!option.value) return;
      
      const [h, m] = option.value.split(':').map(Number);
      const minutos = h * 60 + m;
      
      const ocupado = horasOcupadas.some(ocupado => {
        return Math.abs(ocupado - minutos) < CONFIG_VENEZUELA.intervaloEntreCitas;
      });
      
      if (ocupado) {
        option.disabled = true;
        option.dataset.disponible = 'false';
        option.textContent = `${option.value} - No disponible`;
      } else {
        option.disabled = false;
        option.dataset.disponible = 'true';
        option.textContent = option.value;
      }
    });
  } catch (error) {
    console.error('Error actualizando disponibilidad:', error);
  }
}

// 6. Función para inicializar selectores con validación para Venezuela
function inicializarSelectores() {
  const fechaInput = document.getElementById('fecha');
  if (!fechaInput) return;

  // Obtener fecha actual en Venezuela con formato correcto
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  
  const fechaMinima = `${anio}-${mes}-${dia}`;
  
  fechaInput.min = fechaMinima;
  fechaInput.value = fechaMinima;
  
  // Generar horarios disponibles
  generarHorariosDisponibles();
  
  // Actualizar disponibilidad cuando cambia la fecha
  fechaInput.addEventListener('change', function() {
    const fechaSeleccionada = new Date(this.value);
    const diaSemana = fechaSeleccionada.getDay(); // 0 es domingo, 1 es lunes, etc.
    
    // Verificar si es domingo (0)
    if (diaSemana === 0) {
      mostrarMensaje('No trabajamos los domingos. Por favor seleccione un día de Lunes a Sábado.', 'error');
      this.value = fechaMinima; // Resetear al día actual
      return;
    }
    
    actualizarDisponibilidadHorarios(this.value);
  });
  
  // Actualizar el input de hora oculto
  const selectHorario = document.getElementById('hora-select');
  const horaInput = document.getElementById('hora');
  
  if (selectHorario && horaInput) {
    selectHorario.addEventListener('change', function() {
      horaInput.value = this.value;
    });
  }
  
  // Actualizar disponibilidad inicial
  actualizarDisponibilidadHorarios(fechaInput.value);
}

// 7. Función para enviar notificación a Telegram
async function enviarNotificacionTelegram(citaData) {
  const BOT_TOKEN = "8473537897:AAE4DhBRqFSgkerepYMSA-meEBwn0pXjXag";
  const CHAT_ID = "8330674980";
  
  try {
    const mensaje = `📌 *Nueva cita agendada*:\n
👤 Cliente: *${citaData.nombre}* (${citaData.telefono})\n
📅 Fecha: *${citaData.fecha}*\n
⏰ Hora: *${citaData.hora}*\n
✂️ Servicio: *${citaData.servicio}*\n
💈 Barbero: *${citaData.barbero}*`;

    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: mensaje,
        parse_mode: 'Markdown'
      })
    });

    if (!response.ok) {
      throw new Error('Error al enviar notificación a Telegram');
    }
    
    console.log('Notificación enviada al barbero');
  } catch (error) {
    console.error('Error en notificación Telegram:', error);
  }
}

// 8. Función para guardar cita con validación de horario (actualizada con caché)
async function guardarCita(citaData) {
  if (!supabase) {
    throw new Error('Error de conexión con el servidor');
  }

  try {
    // Verificar cita existente con caché
    const { existe: citaExistente } = await verificarCitaExistente(
      citaData.telefono, 
      citaData.nombre, 
      citaData.fecha
    );
    
    if (citaExistente) {
      throw new Error('❌ Ya existe una cita registrada con este teléfono y nombre para esta fecha');
    }
    
    await verificarLimiteCitas(citaData.telefono, citaData.fecha);
    
    const disponibilidad = await verificarDisponibilidad(citaData.fecha, citaData.hora);
    if (!disponibilidad.disponible) {
      throw new Error(disponibilidad.mensaje);
    }

    const { data, error } = await supabase
      .from('citas')
      .insert([{
        ...citaData,
        estado: 'pendiente',
        creado_en: new Date().toISOString()
      }])
      .select();

    if (error) {
      // Verificar si es error de duplicado (código 23505)
      if (error.code === '23505') {
        throw new Error('❌ Este horario ya fue reservado. Por favor elige otro.');
      }
      throw error; // Propagar otros errores
    }
    
    // LIMPIAR CACHÉ RELACIONADO CON ESTA FECHA
    BarberCache.clear(`citas_${citaData.fecha}`);
    BarberCache.clear(`disp_${citaData.fecha}_`);
    BarberCache.clear(`limite_citas_${citaData.telefono}_${citaData.fecha}`);
    BarberCache.clear(`cita_existente_${citaData.telefono}_${citaData.nombre}_${citaData.fecha}`);
    
    enviarNotificacionTelegram(citaData).catch(e => console.error(e));
    
    return data;
  } catch (error) {
    console.error('Error al guardar cita:', error);
    throw error;
  }
}

// 9. Inicialización principal adaptada para Venezuela
document.addEventListener('DOMContentLoaded', function() {
  // Verificar si Supabase está inicializado
  if (!supabase) {
    mostrarMensaje('Error en la configuración del sistema. Recarga la página.', 'error');
    return;
  }

  // Inicializar selectores de fecha/hora para Venezuela
  inicializarSelectores();

  // Función para actualizar contador de citas
  async function actualizarContador() {
    const telefono = document.getElementById('telefono')?.value.trim();
    const fecha = document.getElementById('fecha')?.value;
    const contador = document.getElementById('contador-citas');

    if (!telefono || !fecha || !contador) return;

    try {
      const cacheKey = `contador_${telefono}_${fecha}`;
      const cached = BarberCache.get(cacheKey);
      
      if (cached) {
        const restantes = 2 - (cached.count || 0);
        contador.innerHTML = `<i class="fas fa-info-circle"></i>
          <span>Citas hoy: ${cached.count || 0}/2 (${restantes} restantes)</span>`;
        contador.style.color = cached.count >= 2 ? '#e74c3c' : '#2ecc71';
        return;
      }
      
      const { count } = await supabase
        .from('citas')
        .select('*', { count: 'exact' })
        .eq('telefono', telefono)
        .eq('fecha', fecha);

      const restantes = 2 - (count || 0);
      contador.innerHTML = `<i class="fas fa-info-circle"></i>
        <span>Citas hoy: ${count || 0}/2 (${restantes} restantes)</span>`;
      contador.style.color = count >= 2 ? '#e74c3c' : '#2ecc71';
      
      // Guardar en caché
      BarberCache.set(cacheKey, { count }, 2 * 60 * 1000); // 2 minutos
    } catch (error) {
      console.error('Error al contar citas:', error);
    }
  }

  // Configurar listeners para actualizar contador
  document.getElementById('telefono')?.addEventListener('input', actualizarContador);
  document.getElementById('fecha')?.addEventListener('change', actualizarContador);

  // Manejar envío del formulario
  const citaForm = document.getElementById('citaForm');
  if (citaForm) {
    citaForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // Mostrar estado de carga
      const submitBtn = citaForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Agendando...';
      
      try {
        // Función auxiliar para obtener elementos de forma segura
        const getElement = (id) => {
          const el = document.getElementById(id);
          if (!el) throw new Error(`Elemento ${id} no encontrado`);
          return el;
        };

        // Obtener valores del formulario de manera segura
        const formData = {
          nombre: getElement('nombre').value.trim(),
          telefono: getElement('telefono').value.trim(),
          fecha: getElement('fecha').value,
          hora: getElement('hora-select').value, // Usamos directamente el select
          servicio: getElement('servicio').value,
          barbero: getElement('barbero').value
        };

        // Validar que se haya seleccionado un horario
        if (!formData.hora) {
          throw new Error('Por favor seleccione un horario disponible');
        }

        // Resto de la validación...
        const validacion = validarFormulario(formData);
        if (!validacion.valido) {
          throw new Error(validacion.error);
        }

        // Usar el teléfono limpio (sin caracteres especiales)
        if (validacion.telefono) {
          formData.telefono = validacion.telefono;
        }

        // Guardar cita
        const citaGuardada = await guardarCita(formData);
        console.log('Cita guardada:', citaGuardada);
        
        mostrarMensaje('✅ Cita agendada correctamente. Te esperamos!', 'exito');
        citaForm.reset();
        inicializarSelectores();
        
      } catch (error) {
        console.error('Error al procesar cita:', error);
        mostrarMensaje(`❌ ${error.message}`, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
});
