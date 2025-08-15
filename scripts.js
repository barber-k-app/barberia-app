// 1. Configuración Segura de Supabase (usa .env en producción)
const supabaseUrl = 'https://jjihjvegheguvmradmau.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaWhqdmVnaGVndXZtcmFkbWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODU5MzEsImV4cCI6MjA3MDY2MTkzMX0._wkRKxSbsEaHXXYhQMYSIgLBOLfeLAZbH0E9Tx4W7Tk';

// Inicializar Supabase
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

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

// Configuración de horarios para Venezuela
const CONFIG_VENEZUELA = {
  intervaloEntreCitas: 40, // minutos entre citas
  horarioApertura: '08:00',
  horarioCierre: '21:00',
  zonaHoraria: 'America/Caracas',
  diasTrabajo: [1, 2, 3, 4, 5, 6] // Lunes(1) a Sábado(6)
};

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

// 4. Función para verificar disponibilidad de horario
async function verificarDisponibilidad(fecha, hora) {
  try {
    // Convertir hora seleccionada a minutos
    const [horaSel, minSel] = hora.split(':').map(Number);
    const minutosSel = horaSel * 60 + minSel;
    
    // Obtener todas las citas para esa fecha
    const { data: citas, error } = await supabase
      .from('citas')
      .select('hora')
      .eq('fecha', fecha);
    
    if (error) throw error;
    
    // Verificar cada cita existente
    for (const cita of citas) {
      const [horaExistente, minExistente] = cita.hora.split(':').map(Number);
      const minutosExistente = horaExistente * 60 + minExistente;
      
      // Calcular diferencia en minutos
      const diferencia = Math.abs(minutosSel - minutosExistente);
      
      // Si hay menos del intervalo requerido, está ocupado
      if (diferencia < CONFIG_VENEZUELA.intervaloEntreCitas) {
        return {
          disponible: false,
          mensaje: `El horario ${hora} no está disponible. Por favor elige otro.`
        };
      }
    }
    
    return { disponible: true };
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
  if (!nombre || nombre.trim().length < 3) {
    return {valido: false, error: 'El nombre debe tener al menos 3 caracteres'};
  }
  
  if (!telefono || !/^\d{10,15}$/.test(telefono)) {
    return {valido: false, error: 'Teléfono debe tener entre 10 y 15 dígitos'};
  }
  
  const fechaCita = new Date(`${fecha}T${hora}`);
  const ahora = new Date();
  
  if (fechaCita < ahora) {
    return {valido: false, error: 'La cita no puede ser en el pasado'};
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
  
  // Validar que se haya seleccionado un horario
  if (!hora) {
    return {valido: false, error: 'Por favor selecciona un horario disponible'};
  }
  
  return {valido: true};
}

// 6. Función para generar slots de horarios (versión optimizada)
async function generarHorarios(fecha) {
  const horarioGrid = document.getElementById('horarioGrid');
  if (!horarioGrid) return;

  // Horarios fijos cada 40 minutos (configuración centralizada)
  const horariosFijos = [
    '08:00', '08:40', '09:20', '10:00', '10:40',
    '11:20', '12:00', '12:40', '13:20', '14:00',
    '14:40', '15:20', '16:00', '16:40', '17:20',
    '18:00', '18:40', '19:20', '20:00', '20:40'
  ];

  try {
    // Obtener citas existentes para la fecha seleccionada
    const { data: citas, error } = await supabase
      .from('citas')
      .select('hora')
      .eq('fecha', fecha);

    if (error) throw error;

    // Limpiar grid antes de generar nuevos slots
    horarioGrid.innerHTML = '';

    // Generar todos los slots de horarios
    horariosFijos.forEach(hora => {
      const slot = document.createElement('div');
      slot.className = 'horario-slot';
      slot.textContent = hora;

      // Verificar si el horario está ocupado
      const ocupado = citas.some(cita => {
        const [hExistente, mExistente] = cita.hora.split(':').map(Number);
        const [hActual, mActual] = hora.split(':').map(Number);
        const diff = Math.abs((hExistente * 60 + mExistente) - (hActual * 60 + mActual));
        return diff < CONFIG_VENEZUELA.intervaloEntreCitas;
      });

      if (ocupado) {
        slot.classList.add('horario-ocupado');
      } else {
        slot.classList.add('horario-disponible');
        slot.addEventListener('click', function() {
          // Deseleccionar otros slots
          document.querySelectorAll('.horario-slot').forEach(s => {
            s.classList.remove('horario-seleccionado');
          });
          // Seleccionar este slot
          this.classList.add('horario-seleccionado');
          document.getElementById('hora').value = hora;
        });
      }

      horarioGrid.appendChild(slot);
    });

  } catch (error) {
    console.error('Error al generar horarios:', error);
    horarioGrid.innerHTML = '<div class="error-horarios">Error al cargar horarios. Intente nuevamente.</div>';
  }
}

// Función para mostrar/ocultar el grid de horarios (versión optimizada)
function toggleHorarioGrid() {
  const grid = document.getElementById('horarioGrid');
  const icon = document.getElementById('horarioToggleIcon');
  
  if (grid && icon) {
    grid.classList.toggle('visible');
    icon.style.transform = grid.classList.contains('visible') ? 'rotate(180deg)' : 'rotate(0deg)';
    
    // Alternar atributo aria-expanded para accesibilidad
    const isExpanded = grid.classList.contains('visible');
    document.getElementById('horarioToggleBtn').setAttribute('aria-expanded', isExpanded);
  }
}

// 7. Función para inicializar selectores con validación para Venezuela
function inicializarSelectores() {
  const fechaInput = document.getElementById('fecha');
  if (!fechaInput) return;

  // Formato correcto: yyyy-MM-dd
  const hoy = new Date();
  const año = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  const fechaMinima = `${año}-${mes}-${dia}`;
  
  fechaInput.min = fechaMinima;
  fechaInput.value = fechaMinima;
  
  // Generar horarios iniciales
  generarHorarios(fechaMinima);
  
  // Escuchar cambios de fecha
  fechaInput.addEventListener('change', function() {
    const fechaSeleccionada = this.value;
    const diaSemana = new Date(fechaSeleccionada).getDay();
    
    if (!CONFIG_VENEZUELA.diasTrabajo.includes(diaSemana)) {
      mostrarMensaje('No trabajamos los domingos. Por favor seleccione un día hábil de Lunes a Sábado.', 'error');
      this.value = fechaInput.min;
      return;
    }
    
    document.getElementById('hora').value = '';
    generarHorarios(fechaSeleccionada);
  });
}

// 8. Función para enviar notificación a Telegram
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

// 9. Función para guardar cita con validación de horario (actualizada)
async function guardarCita(citaData) {
  if (!supabase) {
    throw new Error('Error de conexión con el servidor');
  }

  try {
    // Primero verificar disponibilidad
    const disponibilidad = await verificarDisponibilidad(citaData.fecha, citaData.hora);
    if (!disponibilidad.disponible) {
      throw new Error(disponibilidad.mensaje);
    }

    // Si está disponible, guardar la cita
    const { data, error } = await supabase
      .from('citas')
      .insert([{
        ...citaData,
        estado: 'pendiente',
        creado_en: new Date().toISOString()
      }])
      .select();
    
    if (error) {
      console.error('Error Supabase:', error);
      throw new Error(error.message || 'Error al guardar la cita');
    }
    
    // Enviar notificación a Telegram (no bloqueante)
    enviarNotificacionTelegram(citaData).catch(e => console.error(e));
    
    // Actualizar la lista de horarios después de guardar
    generarHorarios(citaData.fecha);
    
    return data;
  } catch (error) {
    console.error('Error completo:', error);
    throw error;
  }
}

// 10. Inicialización principal adaptada para Venezuela
document.addEventListener('DOMContentLoaded', function() {
  // Verificar si Supabase está inicializado
  if (!supabase) {
    mostrarMensaje('Error en la configuración del sistema. Recarga la página.', 'error');
    return;
  }

  // Inicializar selectores de fecha/hora para Venezuela
  inicializarSelectores();

  // Configurar el toggle del grid de horarios si existe el botón
  const toggleBtn = document.getElementById('horarioToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleHorarioGrid);
    // Añadir accesibilidad
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-controls', 'horarioGrid');
  }

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
        // Obtener valores del formulario
        const formData = {
          nombre: document.getElementById('nombre').value.trim(),
          telefono: document.getElementById('telefono').value.trim(),
          fecha: document.getElementById('fecha').value,
          hora: document.getElementById('hora').value,
          servicio: document.getElementById('servicio').value,
          barbero: document.getElementById('barbero').value
        };

        // Validar datos básicos
        const validacion = validarFormulario(formData);
        if (!validacion.valido) {
          throw new Error(validacion.error);
        }

        // Guardar cita (incluye validación de disponibilidad)
        const citaGuardada = await guardarCita(formData);
        console.log('Cita guardada:', citaGuardada);
        
        // Mostrar éxito y resetear
        mostrarMensaje('✅ Cita agendada correctamente. Te esperamos!', 'exito');
        citaForm.reset();
        inicializarSelectores();
        
      } catch (error) {
        console.error('Error al procesar cita:', error);
        mostrarMensaje(`❌ ${error.message}`, 'error');
      } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
});
