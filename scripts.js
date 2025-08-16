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
 * SISTEMA DE CACHÉ PARA BARBER-K (Producción)
 * Mantiene los datos estáticos y reduce consultas a Supabase
 ******************************************/
const BarberCache = {
  // Obtener datos del caché
  get: (key) => {
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
  
  // Guardar datos en caché
  set: (key, data, ttl = 30 * 60 * 1000) => { // 30 minutos por defecto
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl
      };
      localStorage.setItem(`bk_${key}`, JSON.stringify(cacheData));
    } catch (e) {
      console.error('Error guardando en caché:', e);
    }
  },
  
  // Limpiar entradas específicas del caché
  clear: (keyPattern) => {
    Object.keys(localStorage)
      .filter(key => key.startsWith(`bk_${keyPattern}`))
      .forEach(key => localStorage.removeItem(key));
  },
  
  // Limpiar todo el caché de la aplicación
  clearAll: () => {
    Object.keys(localStorage)
      .filter(key => key.startsWith('bk_'))
      .forEach(key => localStorage.removeItem(key));
  }
};

// Configuración de horarios para Venezuela (versión mejorada)
const CONFIG_VENEZUELA = {
  intervaloEntreCitas: 40, // minutos entre citas
  horarioApertura: '08:00',
  horarioCierre: '21:00',
  zonaHoraria: 'America/Caracas',
  diasTrabajo: [1, 2, 3, 4, 5, 6], // Lunes(1) a Sábado(6)
  diasSemana: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] // Para mensajes más descriptivos
};

// Elementos del DOM para mantenimiento
const maintenanceBtn = document.getElementById('maintenanceBtn');
const maintenanceOverlay = document.getElementById('maintenanceOverlay');

// Función para verificar estado de mantenimiento
async function checkMaintenanceStatus() {
  if (!supabase) return;
  
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('maintenance_mode')
      .eq('id', 1)
      .single();

    if (error) {
      console.error("Error al verificar mantenimiento:", error);
      return;
    }

    if (data?.maintenance_mode) {
      maintenanceOverlay.style.display = 'flex';
    } else {
      maintenanceOverlay.style.display = 'none';
    }
  } catch (error) {
    console.error("Error en checkMaintenanceStatus:", error);
  }
}

// Activar/Desactivar mantenimiento
async function toggleMaintenanceMode() {
  if (!supabase) return;
  
  try {
    const { data: config } = await supabase
      .from('app_config')
      .select('maintenance_mode, maintenance_password')
      .eq('id', 1)
      .single();

    const password = prompt(
      config.maintenance_mode 
        ? "🔓 Contraseña para DESACTIVAR mantenimiento:" 
        : "🔒 Contraseña para ACTIVAR mantenimiento:"
    );

    if (password !== config.maintenance_password) {
      alert("❌ Contraseña incorrecta");
      return;
    }

    // Actualiza el estado
    const { error } = await supabase
      .from('app_config')
      .update({ maintenance_mode: !config.maintenance_mode })
      .eq('id', 1);

    if (error) {
      alert("Error al actualizar estado");
      return;
    }

    // Muestra/oculta el overlay
    maintenanceOverlay.style.display = config.maintenance_mode ? 'none' : 'flex';
    alert(config.maintenance_mode ? "✅ Modo mantenimiento DESACTIVADO" : "🛠 Modo mantenimiento ACTIVADO");
  } catch (error) {
    console.error("Error en toggleMaintenanceMode:", error);
    alert("Ocurrió un error al cambiar el modo mantenimiento");
  }
}

// Configura eventos de mantenimiento
function setupMaintenanceListeners() {
  if (maintenanceBtn) {
    maintenanceBtn.addEventListener('click', toggleMaintenanceMode);
  }

  // Bloquear acceso a cliente.html si está en mantenimiento
  document.querySelector('a[href="cliente.html"]')?.addEventListener('click', async (e) => {
    if (!supabase) return;
    
    try {
      const { data } = await supabase
        .from('app_config')
        .select('maintenance_mode')
        .eq('id', 1)
        .single();

      if (data?.maintenance_mode) {
        e.preventDefault();
        maintenanceOverlay.style.display = 'flex';
      }
    } catch (error) {
      console.error("Error al verificar mantenimiento:", error);
    }
  });
}

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
  const cached = BarberCache.get(cacheKey);
  if (cached) return cached;
  
  try {
    const { data: citas, error } = await supabase
      .from('citas')
      .select('*')
      .eq('telefono', telefono)
      .eq('nombre', nombre)
      .eq('fecha', fecha);

    if (error) throw error;
    
    const result = citas && citas.length > 0 
      ? { existe: true, cita: citas[0] } 
      : { existe: false };
    
    BarberCache.set(cacheKey, result, 5 * 60 * 1000); // 5 minutos de caché
    return result;
  } catch (error) {
    console.error('Error verificando cita existente:', error);
    throw error;
  }
}

// Función para verificar límite de citas
async function verificarLimiteCitas(telefono, fecha) {
  const cacheKey = `limite_citas_${telefono}_${fecha}`;
  const cached = BarberCache.get(cacheKey);
  if (cached && cached.count < 2) return; // Si hay caché y no ha alcanzado límite
  
  const { data: citas, error } = await supabase
    .from('citas')
    .select('id', { count: 'exact' })
    .eq('telefono', telefono)
    .eq('fecha', fecha);

  if (error) throw error;
  
  // Guardar en caché solo si no ha alcanzado el límite
  if (citas.length < 2) {
    BarberCache.set(cacheKey, { count: citas.length }, 60 * 60 * 1000); // 1 hora
  }
  
  if (citas.length >= 2) {
    throw new Error('❌ Límite alcanzado: Máximo 2 citas por día por teléfono');
  }
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
  const cached = BarberCache.get(cacheKey);
  if (cached) return cached;
  
  const { data: citas, error } = await supabase
    .from('citas')
    .select('hora')
    .eq('fecha', fecha);
  
  if (error) throw error;
  
  BarberCache.set(cacheKey, citas, 10 * 60 * 1000); // Cachear por 10 minutos
  return citas;
}

// 4. Función para verificar disponibilidad de horario (actualizada con caché)
async function verificarDisponibilidad(fecha, hora) {
  const cacheKey = `disp_${fecha}_${hora}`;
  const cached = BarberCache.get(cacheKey);
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
        BarberCache.set(cacheKey, result, 5 * 60 * 1000); // Cachear por 5 minutos
        return result;
      }
    }
    
    const result = { disponible: true };
    BarberCache.set(cacheKey, result, 5 * 60 * 1000); // Cachear por 5 minutos
    return result;
  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    return {
      disponible: false,
      mensaje: 'Error al verificar disponibilidad. Intenta nuevamente.'
    };
  }
}

// 5. Validación mejorada de formulario con horario Venezuela (VERSIÓN CORREGIDA)
function validarFormulario({nombre, telefono, fecha, hora}) {
  // Validación de nombre mejorada
  const validacionNombre = validarNombre(nombre);
  if (!validacionNombre.valido) return validacionNombre;
  
  // Validación de teléfono mejorada
  const validacionTelefono = validarTelefonoVenezolano(telefono);
  if (!validacionTelefono.valido) return validacionTelefono;
  
  // Crear objeto Date correctamente (considerando zona horaria)
  const fechaCita = new Date(`${fecha}T${hora}:00-04:00`); // Ajuste para Venezuela UTC-4
  const ahora = new Date();
  
  if (fechaCita < ahora) {
    return {valido: false, error: 'La cita no puede ser en el pasado'};
  }
  
  // Validación CORREGIDA del día de la semana
  const diaSemana = fechaCita.getUTCDay(); // Usamos getUTCDay para consistencia
  
  console.log('Día seleccionado:', diaSemana, 'Fecha:', fechaCita); // Para diagnóstico
  
  if (diaSemana === 0) { // 0 es Domingo
    return {
      valido: false, 
      error: 'No trabajamos los domingos. Por favor seleccione un día de Lunes a Sábado.'
    };
  }
  
  // Validación de horario laboral
  const [horaCita, minCita] = hora.split(':').map(Number);
  const horaApertura = parseInt(CONFIG_VENEZUELA.horarioApertura.split(':')[0]);
  const horaCierre = parseInt(CONFIG_VENEZUELA.horarioCierre.split(':')[0]);
  
  if (horaCita < horaApertura || (horaCita >= horaCierre && minCita > 0)) {
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

// 6. Función para inicializar selectores con validación para Venezuela (ACTUALIZADA)
function inicializarSelectores() {
  const fechaInput = document.getElementById('fecha');
  if (!fechaInput) return;

  // Configuración de fecha mínima (hoy)
  const hoy = new Date();
  const fechaMinima = hoy.toISOString().split('T')[0];
  fechaInput.min = fechaMinima;
  fechaInput.value = fechaMinima;

  // Event listener CORREGIDO para cambio de fecha
  fechaInput.addEventListener('change', function() {
    const fechaSeleccionada = new Date(this.value + 'T00:00:00-04:00'); // Ajuste zona horaria
    
    // Diagnóstico importante
    console.log('Fecha seleccionada:', this.value, 'Día numérico:', fechaSeleccionada.getUTCDay());
    
    // Validación CORREGIDA
    if (fechaSeleccionada.getUTCDay() === 0) { // 0 es Domingo
      mostrarMensaje('No trabajamos los domingos. Por favor seleccione un día de Lunes a Sábado.', 'error');
      
      // Encuentra el próximo día laborable (Lunes)
      const proximoLunes = new Date(fechaSeleccionada);
      proximoLunes.setDate(proximoLunes.getDate() + 1);
      this.value = proximoLunes.toISOString().split('T')[0];
      
      return;
    }
    
    actualizarDisponibilidadHorarios(this.value);
  });

  // Generar horarios disponibles
  generarHorariosDisponibles();
  
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
    
    if (error) throw error;
    
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

  // Verificar estado de mantenimiento y configurar listeners
  checkMaintenanceStatus();
  setupMaintenanceListeners();

  // Inicializar selectores de fecha/hora para Venezuela
  inicializarSelectores();

  // Función para actualizar contador de citas
  async function actualizarContador() {
    const telefono = document.getElementById('telefono')?.value.trim();
    const fecha = document.getElementById('fecha')?.value;
    const contador = document.getElementById('contador-citas');

    if (!telefono || !fecha || !contador) return;

    try {
      const { count } = await supabase
        .from('citas')
        .select('*', { count: 'exact' })
        .eq('telefono', telefono)
        .eq('fecha', fecha);

      const restantes = 2 - (count || 0);
      contador.innerHTML = `<i class="fas fa-info-circle"></i>
        <span>Citas hoy: ${count || 0}/2 (${restantes} restantes)</span>`;
      contador.style.color = count >= 2 ? '#e74c3c' : '#2ecc71';
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
          hora: getElement('hora-select').value,
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

  // Código de diagnóstico
  console.log("Días laborables configurados:", CONFIG_VENEZUELA.diasTrabajo);
  const fechaInput = document.getElementById('fecha');
  if (fechaInput) {
    console.log("Fecha seleccionada:", fechaInput.value, "Día de la semana:", 
      CONFIG_VENEZUELA.diasSemana[new Date(fechaInput.value + 'T00:00:00-04:00').getUTCDay()]);
  }

  // Prueba de diagnóstico en la consola
  function probarFechas() {
    const fechasPrueba = [
      '2025-08-17', // Domingo
      '2025-08-18', // Lunes
      '2025-08-19'  // Martes
    ];
    
    fechasPrueba.forEach(fecha => {
      const dia = new Date(fecha + 'T00:00:00-04:00').getUTCDay();
      console.log(`Fecha: ${fecha} - Día numérico: ${dia} - ${dia === 0 ? 'Domingo' : dia === 1 ? 'Lunes' : 'Otro día'}`);
    });
  }

  // Ejecutar diagnóstico al cargar
  probarFechas();
});
