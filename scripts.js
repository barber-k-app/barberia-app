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
function mostrarMensaje(texto, tipo = 'info', elementoId = 'mensaje') {
  const mensajeDiv = document.getElementById(elementoId);
  if (!mensajeDiv) {
    console.warn('No se encontró el elemento para mostrar mensajes');
    return;
  }
  
  // Limpiar mensajes anteriores
  mensajeDiv.innerHTML = '';
  mensajeDiv.className = ''; // Resetear clases
  
  // Crear elemento de mensaje
  const mensajeElement = document.createElement('div');
  mensajeElement.className = `mensaje-${tipo}`;
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
  
  return {valido: true};
}

// 6. Función para inicializar selectores con validación para Venezuela
function inicializarSelectores() {
  const fechaInput = document.getElementById('fecha');
  const horaInput = document.getElementById('hora');
  
  if (!fechaInput || !horaInput) return;

  // Configurar fecha mínima (hoy) según hora de Venezuela
  const hoy = new Date();
  const hoyVenezuela = hoy.toLocaleString('es-VE', { timeZone: CONFIG_VENEZUELA.zonaHoraria });
  const fechaMinima = hoyVenezuela.split(',')[0].trim().split('/').reverse().join('-');
  
  fechaInput.min = fechaMinima;
  fechaInput.value = fechaMinima;
  
  // Configurar hora según horario Venezuela
  horaInput.min = CONFIG_VENEZUELA.horarioApertura;
  horaInput.max = CONFIG_VENEZUELA.horarioCierre;
  
  // Eliminar display: none del input de hora y marcarlo como requerido
  horaInput.style.display = 'block';
  horaInput.required = true;
  
  // Establecer hora actual de Venezuela como sugerencia
  const horaActual = obtenerHoraActualVenezuela();
  horaInput.value = horaActual;
  
  // Validar días de trabajo (Lunes a Sábado)
  fechaInput.addEventListener('change', function() {
    const fechaSeleccionada = new Date(this.value);
    const diaSemana = fechaSeleccionada.getDay(); // 0=Domingo, 1=Lunes, etc.
    
    if (!CONFIG_VENEZUELA.diasTrabajo.includes(diaSemana)) {
      mostrarMensaje('No trabajamos los domingos. Por favor seleccione un día hábil de Lunes a Sábado.', 'error');
      this.value = fechaInput.min; // Resetear a fecha mínima
    }
  });
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

// 8. Función para guardar cita con validación de horario
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
    
    return data;
  } catch (error) {
    console.error('Error completo:', error);
    throw error;
  }
}

// 9. Función para generar horarios disponibles
async function generarHorariosDisponibles(fecha) {
  const horariosContainer = document.getElementById('horariosDisponibles');
  if (!horariosContainer) return;

  // Limpiar contenedor
  horariosContainer.innerHTML = '';

  // Obtener citas existentes para esta fecha
  const { data: citas, error } = await supabase
    .from('citas')
    .select('hora')
    .eq('fecha', fecha);

  if (error) {
    console.error('Error al obtener citas:', error);
    return;
  }

  // Convertir horas ocupadas a minutos
  const horasOcupadas = citas.map(cita => {
    const [h, m] = cita.hora.split(':').map(Number);
    return h * 60 + m;
  });

  // Generar horarios desde apertura hasta cierre
  const [horaApertura] = CONFIG_VENEZUELA.horarioApertura.split(':').map(Number);
  const [horaCierre] = CONFIG_VENEZUELA.horarioCierre.split(':').map(Number);
  const intervalo = CONFIG_VENEZUELA.intervaloEntreCitas;

  for (let hora = horaApertura; hora < horaCierre; hora++) {
    for (let minuto = 0; minuto < 60; minuto += intervalo) {
      const totalMinutos = hora * 60 + minuto;
      const horaFormato = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;

      // Verificar si está ocupado
      const estaOcupado = horasOcupadas.some(ocupado => {
        return Math.abs(ocupado - totalMinutos) < intervalo;
      });

      // Crear botón de horario
      const horaBtn = document.createElement('button');
      horaBtn.className = `hora-btn ${estaOcupado ? 'hora-ocupada' : 'hora-disponible'}`;
      horaBtn.textContent = horaFormato;
      horaBtn.disabled = estaOcupado;
      
      // Manejar selección de horario
      horaBtn.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('hora').value = horaFormato;
        
        // Remover selección anterior
        document.querySelectorAll('.hora-btn').forEach(btn => {
          btn.classList.remove('hora-seleccionada');
        });
        
        // Marcar como seleccionado
        horaBtn.classList.add('hora-seleccionada');
        
        // Mostrar información de cola
        mostrarInformacionCola(fecha, horaFormato);
      });

      horariosContainer.appendChild(horaBtn);
    }
  }
}

// 10. Función para mostrar información de cola
async function mostrarInformacionCola(fecha, hora) {
  const queueInfo = document.getElementById('queueInfo');
  if (!queueInfo) return;

  try {
    // Obtener citas antes de esta
    const { data: citas, error } = await supabase
      .from('citas')
      .select('hora')
      .eq('fecha', fecha)
      .lt('hora', hora)
      .order('hora', { ascending: true });

    if (error) throw error;

    const cantidad = citas.length;
    const mensaje = cantidad > 0 
      ? `Tiene ${cantidad} ${cantidad === 1 ? 'persona' : 'personas'} por delante`
      : 'Es el primero en este horario';

    document.getElementById('queueMessage').textContent = mensaje;
    queueInfo.style.display = 'block';
  } catch (error) {
    console.error('Error al obtener información de cola:', error);
    queueInfo.style.display = 'none';
  }
}

// 11. Función mejorada para manejar login
async function handleLogin() {
  const usuario = document.getElementById('loginNombre').value.trim();
  const password = document.getElementById('loginPassword').value;

  // Debuggeo
  console.log("Credenciales ingresadas:", { usuario, password });

  try {
    // 1. Busca el usuario en Supabase
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('usuario', usuario)
      .eq('password', password)
      .single();

    // Debuggeo
    console.log("Datos de Supabase:", data);

    if (error || !data) {
      throw new Error("Usuario o contraseña incorrectos");
    }

    // 2. Guarda la sesión en localStorage
    localStorage.setItem('clienteAutenticado', JSON.stringify(data));
    
    // 3. Redirige a la vista de citas
    document.getElementById('authContainer').classList.remove('active');
    document.getElementById('citaContainer').classList.add('active');
    
    // 4. Recarga la página para aplicar cambios
    setTimeout(() => location.reload(), 500);

  } catch (error) {
    mostrarMensaje(error.message, 'error');
    console.error("Error en login:", error);
  }
}

// 12. Función para manejar registro
async function handleRegister() {
  // 1. Obtener datos del formulario
  const userData = {
    nombre: document.getElementById('registerNombre').value.trim(),
    telefono: document.getElementById('registerTelefono').value.trim(),
    usuario: document.getElementById('registerUsuario').value.trim(),
    password: document.getElementById('registerPassword').value
  };

  console.log("Datos a registrar:", userData); // Para debuggear

  try {
    // 2. Verificar si el usuario ya existe
    const { data: existingUser, error: queryError } = await supabase
      .from('clientes')
      .select('usuario')
      .eq('usuario', userData.usuario);

    if (queryError) throw new Error("Error al verificar usuario");
    if (existingUser && existingUser.length > 0) {
      throw new Error("⚠️ El usuario ya existe");
    }

    // 3. Insertar en Supabase
    const { data, error } = await supabase
      .from('clientes')
      .insert([userData])
      .select();

    if (error) throw error;
    if (!data) throw new Error("No se recibieron datos");

    // 4. Éxito: guardar sesión y redirigir
    localStorage.setItem('clienteAutenticado', JSON.stringify(data[0]));
    mostrarMensaje('✅ Registro exitoso!', 'exito');
    
    document.getElementById('authContainer').classList.remove('active');
    document.getElementById('citaContainer').classList.add('active');

  } catch (error) {
    console.error("Error en registro:", error);
    mostrarMensaje(error.message, 'error');
  }
}

// 13. Función para manejar autenticación de usuarios con mejoras
function manejarAutenticacion() {
  const authContainer = document.getElementById('authContainer');
  const citaContainer = document.getElementById('citaContainer');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const authForm = document.getElementById('authForm');
  const logoutBtn = document.getElementById('logoutBtn');

  // Mostrar formulario de registro
  showRegister?.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
  });

  // Mostrar formulario de login
  showLogin?.addEventListener('click', () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'block';
  });

  // Manejar logout
  logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('clienteAutenticado');
    authContainer.classList.add('active');
    citaContainer.classList.remove('active');
  });

  // Validación en tiempo real para el formulario de registro
  registerForm?.addEventListener('input', function(e) {
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    if (e.target.id === 'registerConfirmPassword' || e.target.id === 'registerPassword') {
      const confirmPasswordInput = document.getElementById('registerConfirmPassword');
      if (password !== confirmPassword) {
        confirmPasswordInput.setCustomValidity('Las contraseñas no coinciden');
      } else {
        confirmPasswordInput.setCustomValidity('');
      }
    }
  });

  // Manejar envío de formulario de autenticación
  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const isLogin = loginForm.style.display !== 'none';
    const authMessage = document.getElementById('authMessage');

    try {
      if (isLogin) {
        await handleLogin();
      } else {
        await handleRegister();
      }
    } catch (error) {
      console.error('Error en autenticación:', error);
      mostrarMensaje(error.message || 'Error en el proceso de autenticación', 'error', 'authMessage');
    }
  });
}

// 14. Inicialización principal adaptada para Venezuela
document.addEventListener('DOMContentLoaded', function() {
  // Verificar si hay un usuario logueado al cargar la página
  const cliente = JSON.parse(localStorage.getItem('clienteAutenticado'));
  
  if (cliente) {
    // Oculta el login y muestra la vista de citas
    document.getElementById('authContainer')?.classList.remove('active');
    document.getElementById('citaContainer')?.classList.add('active');
    
    // Rellena los datos automáticamente
    document.getElementById('nombre').value = cliente.nombre;
    document.getElementById('telefono').value = cliente.telefono;
  }

  // Verificar si Supabase está inicializado
  if (!supabase) {
    mostrarMensaje('Error en la configuración del sistema. Recarga la página.', 'error');
    return;
  }

  // Manejar autenticación
  manejarAutenticacion();

  // Inicializar selectores de fecha/hora para Venezuela
  inicializarSelectores();

  // Escuchar cambios en la fecha para generar horarios
  document.getElementById('fecha')?.addEventListener('change', function() {
    generarHorariosDisponibles(this.value);
  });

  // Generar horarios para la fecha inicial
  const fechaInicial = document.getElementById('fecha')?.value;
  if (fechaInicial) {
    generarHorariosDisponibles(fechaInicial);
  }

  // Manejar envío del formulario de citas
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

        // Validar que se haya seleccionado un horario
        if (!formData.hora) {
          throw new Error('Por favor seleccione un horario disponible');
        }

        // Guardar cita (incluye validación de disponibilidad)
        const citaGuardada = await guardarCita(formData);
        console.log('Cita guardada:', citaGuardada);
        
        // Mostrar éxito y resetear
        mostrarMensaje('✅ Cita agendada correctamente. Te esperamos!', 'exito');
        citaForm.reset();
        inicializarSelectores();
        
        // Regenerar horarios
        generarHorariosDisponibles(formData.fecha);
        
      } catch (error) {
        console.error('Error al procesar cita:', error);
        mostrarMensaje(`❌ ${error.message}`, 'error');
      } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Confirmar Cita';
      }
    });
  }
});
