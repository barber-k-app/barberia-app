// 1. Configuración Segura de Supabase (usa .env en producción)
const supabaseUrl = 'https://jjihjvegheguvmradmau.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqaWhqdmVnaGVndXZtcmFkbWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODU5MzEsImV4cCI6MjA3MDY2MTkzMX0._wkRKxSbsEaHXXYhQMYSIgLBOLfeLAZbH0E9Tx4W7Tk';

// Inicializar Supabase con verificación mejorada
let supabase;
if (typeof window !== 'undefined' && window.supabase) {
  supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
  // Cargar el script dinámicamente si es necesario
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/@supabase/supabase-js@2';
  script.onload = () => {
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    console.log('Supabase cargado dinámicamente');
    // Volver a inicializar componentes que dependen de Supabase
    if (document.readyState === 'complete') {
      inicializarComponentes();
    }
  };
  document.head.appendChild(script);
}

// Configuración de horarios para Venezuela (mejorada con objetos Date)
const CONFIG_VENEZUELA = {
  intervaloEntreCitas: 40, // minutos entre citas
  horarioApertura: '08:00',
  horarioCierre: '21:00',
  zonaHoraria: 'America/Caracas',
  diasTrabajo: [1, 2, 3, 4, 5, 6], // Lunes(1) a Sábado(6)
  // Funciones para convertir horarios a Date (mejor comparación)
  getAperturaDate: function() {
    const [hora, minuto] = this.horarioApertura.split(':').map(Number);
    const date = new Date();
    date.setHours(hora, minuto, 0, 0);
    return date;
  },
  getCierreDate: function() {
    const [hora, minuto] = this.horarioCierre.split(':').map(Number);
    const date = new Date();
    date.setHours(hora, minuto, 0, 0);
    return date;
  }
};

// 2. Función mejorada para obtener hora actual de Venezuela
function obtenerHoraActualVenezuela() {
  try {
    const options = {
      timeZone: CONFIG_VENEZUELA.zonaHoraria,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date().toLocaleTimeString('es-VE', options).slice(0, 5);
  } catch (error) {
    console.error('Error al obtener hora Venezuela:', error);
    // Fallback a hora UTC si hay error
    const now = new Date();
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  }
}

// 3. Función mejorada para mostrar mensajes (con más opciones)
function mostrarMensaje(texto, tipo = 'info', elementoId = 'mensaje', tiempo = 5000) {
  const mensajeDiv = document.getElementById(elementoId);
  if (!mensajeDiv) {
    console.warn(`No se encontró el elemento #${elementoId} para mostrar mensajes`);
    return;
  }
  
  // Limpiar mensajes anteriores con animación
  mensajeDiv.classList.add('fade-out');
  setTimeout(() => {
    mensajeDiv.innerHTML = '';
    mensajeDiv.className = ''; // Resetear clases
    mensajeDiv.classList.remove('fade-out');
    
    // Crear elemento de mensaje
    const mensajeElement = document.createElement('div');
    mensajeElement.className = `mensaje mensaje-${tipo}`;
    mensajeElement.innerHTML = `
      <span class="mensaje-texto">${texto}</span>
      <button class="cerrar-mensaje" aria-label="Cerrar mensaje">×</button>
    `;
    
    mensajeDiv.appendChild(mensajeElement);
    mensajeDiv.style.display = 'block';
    
    // Agregar evento al botón de cerrar
    const cerrarBtn = mensajeElement.querySelector('.cerrar-mensaje');
    cerrarBtn.onclick = () => {
      mensajeDiv.classList.add('fade-out');
      setTimeout(() => {
        mensajeDiv.style.display = 'none';
      }, 300);
    };
    
    // Ocultar automáticamente después del tiempo especificado
    if (tiempo > 0) {
      setTimeout(() => {
        if (mensajeDiv.style.display === 'block') {
          mensajeDiv.classList.add('fade-out');
          setTimeout(() => {
            mensajeDiv.style.display = 'none';
          }, 300);
        }
      }, tiempo);
    }
  }, 300);
}

// 4. Función mejorada para verificar disponibilidad de horario
async function verificarDisponibilidad(fecha, hora) {
  if (!supabase) {
    return {
      disponible: false,
      mensaje: 'Error de conexión con el servidor'
    };
  }

  try {
    // Validación básica de hora
    if (!hora || !hora.match(/^\d{2}:\d{2}$/)) {
      throw new Error('Formato de hora inválido');
    }

    // Convertir hora seleccionada a minutos
    const [horaSel, minSel] = hora.split(':').map(Number);
    const minutosSel = horaSel * 60 + minSel;
    
    // Validar horario laboral
    const horaCita = new Date(`${fecha}T${hora}`);
    const horaApertura = CONFIG_VENEZUELA.getAperturaDate();
    const horaCierre = CONFIG_VENEZUELA.getCierreDate();
    
    if (horaCita.getHours() < horaApertura.getHours() || 
        (horaCita.getHours() === horaCierre.getHours() && horaCita.getMinutes() >= horaCierre.getMinutes()) ||
        horaCita.getHours() > horaCierre.getHours()) {
      return {
        disponible: false,
        mensaje: `Fuera del horario laboral (${CONFIG_VENEZUELA.horarioApertura} a ${CONFIG_VENEZUELA.horarioCierre})`
      };
    }

    // Obtener todas las citas para esa fecha
    const { data: citas, error } = await supabase
      .from('citas')
      .select('hora, estado')
      .eq('fecha', fecha);
    
    if (error) throw error;
    
    // Verificar cada cita existente
    for (const cita of citas) {
      // Solo considerar citas activas (no canceladas)
      if (cita.estado === 'cancelada') continue;
      
      const [horaExistente, minExistente] = cita.hora.split(':').map(Number);
      const minutosExistente = horaExistente * 60 + minExistente;
      
      // Calcular diferencia en minutos
      const diferencia = Math.abs(minutosSel - minutosExistente);
      
      // Si hay menos del intervalo requerido, está ocupado
      if (diferencia < CONFIG_VENEZUELA.intervaloEntreCitas) {
        return {
          disponible: false,
          mensaje: `El horario ${hora} no está disponible (hay otra cita muy cercana). Por favor elige otro.`
        };
      }
    }
    
    return { disponible: true };
  } catch (error) {
    console.error('Error verificando disponibilidad:', error);
    return {
      disponible: false,
      mensaje: error.message || 'Error al verificar disponibilidad. Intenta nuevamente.'
    };
  }
}

// 5. Validación mejorada de formulario con horario Venezuela
function validarFormulario({nombre, telefono, fecha, hora, servicio, barbero}) {
  // Validación de nombre
  if (!nombre || nombre.trim().length < 3) {
    return {valido: false, error: 'El nombre debe tener al menos 3 caracteres'};
  }
  
  // Validación de teléfono (acepta +58 para Venezuela)
  if (!telefono || !/^(\+58|0)\d{9,15}$/.test(telefono)) {
    return {valido: false, error: 'Teléfono inválido. Debe comenzar con +58 o 0 y tener 10-15 dígitos'};
  }
  
  // Validación de fecha
  if (!fecha) {
    return {valido: false, error: 'Por favor seleccione una fecha'};
  }
  
  // Validación de hora
  if (!hora) {
    return {valido: false, error: 'Por favor seleccione una hora'};
  }
  
  // Validación de servicio
  if (!servicio) {
    return {valido: false, error: 'Por favor seleccione un servicio'};
  }
  
  // Validación de barbero
  if (!barbero) {
    return {valido: false, error: 'Por favor seleccione un barbero'};
  }
  
  const fechaCita = new Date(`${fecha}T${hora}`);
  const ahora = new Date();
  
  // Validar que la cita no sea en el pasado
  if (fechaCita < ahora) {
    return {valido: false, error: 'La cita no puede ser en el pasado'};
  }
  
  // Validar horario laboral en Venezuela
  const horaApertura = CONFIG_VENEZUELA.getAperturaDate();
  const horaCierre = CONFIG_VENEZUELA.getCierreDate();
  const horaCitaTime = fechaCita.getHours() * 60 + fechaCita.getMinutes();
  const aperturaTime = horaApertura.getHours() * 60 + horaApertura.getMinutes();
  const cierreTime = horaCierre.getHours() * 60 + horaCierre.getMinutes();
  
  if (horaCitaTime < aperturaTime || horaCitaTime >= cierreTime) {
    return {
      valido: false, 
      error: `Horario no disponible (${CONFIG_VENEZUELA.horarioApertura} a ${CONFIG_VENEZUELA.horarioCierre})`
    };
  }
  
  return {valido: true};
}

// 6. Función mejorada para inicializar selectores con validación para Venezuela
function inicializarSelectores() {
  const fechaInput = document.getElementById('fecha');
  const horaInput = document.getElementById('hora');
  
  if (!fechaInput || !horaInput) {
    console.warn('No se encontraron los inputs de fecha/hora');
    return;
  }

  // Configurar fecha mínima (hoy) según hora de Venezuela
  const hoy = new Date();
  const hoyVenezuela = new Date(hoy.toLocaleString('es-VE', { timeZone: CONFIG_VENEZUELA.zonaHoraria }));
  const fechaMinima = hoyVenezuela.toISOString().split('T')[0];
  
  fechaInput.min = fechaMinima;
  fechaInput.value = fechaMinima;
  
  // Configurar hora según horario Venezuela
  horaInput.min = CONFIG_VENEZUELA.horarioApertura;
  horaInput.max = CONFIG_VENEZUELA.horarioCierre;
  
  // Mostrar input de hora y marcarlo como requerido
  horaInput.style.display = 'block';
  horaInput.required = true;
  
  // Establecer hora actual de Venezuela como sugerencia
  const horaActual = obtenerHoraActualVenezuela();
  if (horaActual) {
    horaInput.value = horaActual;
  }
  
  // Validar días de trabajo (Lunes a Sábado)
  fechaInput.addEventListener('change', function() {
    const fechaSeleccionada = new Date(this.value);
    const diaSemana = fechaSeleccionada.getDay(); // 0=Domingo, 1=Lunes, etc.
    
    if (!CONFIG_VENEZUELA.diasTrabajo.includes(diaSemana)) {
      mostrarMensaje('No trabajamos los domingos. Por favor seleccione un día hábil de Lunes a Sábado.', 'error');
      this.value = fechaInput.min; // Resetear a fecha mínima
    } else {
      // Generar horarios cuando se selecciona una fecha válida
      generarHorariosDisponibles(this.value);
    }
  });
}

// 7. Función mejorada para enviar notificación a Telegram
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
        parse_mode: 'Markdown',
        disable_notification: false
      })
    });

    const data = await response.json();
    
    if (!response.ok || !data.ok) {
      throw new Error(data.description || 'Error al enviar notificación a Telegram');
    }
    
    console.log('Notificación enviada al barbero:', data);
    return true;
  } catch (error) {
    console.error('Error en notificación Telegram:', error);
    // No mostrar error al usuario para no afectar su experiencia
    return false;
  }
}

// 8. Función mejorada para guardar cita con validación de horario
async function guardarCita(citaData) {
  if (!supabase) {
    throw new Error('Error de conexión con el servidor');
  }

  try {
    // Validar datos antes de verificar disponibilidad
    const validacion = validarFormulario(citaData);
    if (!validacion.valido) {
      throw new Error(validacion.error);
    }

    // Verificar disponibilidad
    const disponibilidad = await verificarDisponibilidad(citaData.fecha, citaData.hora);
    if (!disponibilidad.disponible) {
      throw new Error(disponibilidad.mensaje);
    }

    // Guardar la cita en Supabase
    const { data, error } = await supabase
      .from('citas')
      .insert([{
        ...citaData,
        estado: 'pendiente',
        creado_en: new Date().toISOString(),
        actualizado_en: new Date().toISOString()
      }])
      .select();
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No se recibieron datos de la cita guardada');
    
    // Enviar notificación a Telegram (no bloqueante)
    enviarNotificacionTelegram(citaData)
      .then(success => {
        if (!success) {
          console.warn('No se pudo enviar notificación a Telegram');
        }
      })
      .catch(e => console.error('Error secundario en notificación:', e));
    
    return data[0]; // Retorna solo el primer elemento del array
  } catch (error) {
    console.error('Error al guardar cita:', error);
    throw error; // Re-lanzar el error para manejo superior
  }
}

// 9. Función mejorada para generar horarios disponibles
async function generarHorariosDisponibles(fecha) {
  const horariosContainer = document.getElementById('horariosDisponibles');
  if (!horariosContainer) {
    console.warn('No se encontró el contenedor de horarios');
    return;
  }

  // Mostrar loader mientras se cargan los horarios
  horariosContainer.innerHTML = '<div class="loader">Cargando horarios...</div>';
  
  try {
    // Validar fecha
    if (!fecha) throw new Error('No se ha seleccionado una fecha');
    
    // Obtener citas existentes para esta fecha (solo las no canceladas)
    const { data: citas, error } = await supabase
      .from('citas')
      .select('hora, estado')
      .eq('fecha', fecha)
      .neq('estado', 'cancelada');

    if (error) throw error;

    // Convertir horas ocupadas a minutos
    const horasOcupadas = citas.map(cita => {
      const [h, m] = cita.hora.split(':').map(Number);
      return h * 60 + m;
    });

    // Limpiar contenedor
    horariosContainer.innerHTML = '';
    
    // Generar horarios desde apertura hasta cierre
    const horaApertura = CONFIG_VENEZUELA.getAperturaDate();
    const horaCierre = CONFIG_VENEZUELA.getCierreDate();
    const intervalo = CONFIG_VENEZUELA.intervaloEntreCitas;
    
    let hayHorariosDisponibles = false;

    for (let hora = horaApertura.getHours(); hora <= horaCierre.getHours(); hora++) {
      for (let minuto = 0; minuto < 60; minuto += intervalo) {
        // No generar horarios después de la hora de cierre
        if (hora === horaCierre.getHours() && minuto >= horaCierre.getMinutes()) {
          continue;
        }
        
        const totalMinutos = hora * 60 + minuto;
        const horaFormato = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;

        // Verificar si está ocupado
        const estaOcupado = horasOcupadas.some(ocupado => {
          return Math.abs(ocupado - totalMinutos) < intervalo;
        });

        // Crear botón de horario
        const horaBtn = document.createElement('button');
        horaBtn.type = 'button';
        horaBtn.className = `hora-btn ${estaOcupado ? 'hora-ocupada' : 'hora-disponible'}`;
        horaBtn.textContent = horaFormato;
        horaBtn.disabled = estaOcupado;
        horaBtn.title = estaOcupado ? 'Horario no disponible' : 'Horario disponible';
        horaBtn.dataset.hora = horaFormato;
        
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
        if (!estaOcupado) hayHorariosDisponibles = true;
      }
    }
    
    if (!hayHorariosDisponibles) {
      horariosContainer.innerHTML = '<div class="sin-horarios">No hay horarios disponibles para esta fecha</div>';
    }
  } catch (error) {
    console.error('Error generando horarios:', error);
    horariosContainer.innerHTML = `<div class="error-horarios">Error al cargar horarios: ${error.message}</div>`;
  }
}

// 10. Función mejorada para mostrar información de cola
async function mostrarInformacionCola(fecha, hora) {
  const queueInfo = document.getElementById('queueInfo');
  if (!queueInfo) return;

  try {
    // Validar parámetros
    if (!fecha || !hora) {
      throw new Error('Faltan parámetros para mostrar información de cola');
    }
    
    // Obtener citas antes de esta (solo las no canceladas)
    const { data: citas, error } = await supabase
      .from('citas')
      .select('hora, estado')
      .eq('fecha', fecha)
      .lt('hora', hora)
      .neq('estado', 'cancelada')
      .order('hora', { ascending: true });

    if (error) throw error;

    const cantidad = citas.length;
    let mensaje;
    
    if (cantidad === 0) {
      mensaje = 'Serás el primero en este horario';
    } else if (cantidad === 1) {
      mensaje = 'Hay 1 persona por delante';
    } else {
      mensaje = `Hay ${cantidad} personas por delante`;
    }

    // Actualizar UI
    const queueMessage = document.getElementById('queueMessage');
    if (queueMessage) {
      queueMessage.textContent = mensaje;
      queueInfo.style.display = 'block';
      
      // Ocultar después de 10 segundos
      setTimeout(() => {
        if (queueInfo.style.display === 'block') {
          queueInfo.style.display = 'none';
        }
      }, 10000);
    }
  } catch (error) {
    console.error('Error al obtener información de cola:', error);
    queueInfo.style.display = 'none';
  }
}

// 11. Función mejorada para manejar login
async function handleLogin() {
  const usuario = document.getElementById('loginNombre').value.trim();
  const password = document.getElementById('loginPassword').value;

  // Validación básica
  if (!usuario || !password) {
    mostrarMensaje('Por favor complete todos los campos', 'error', 'authMessage');
    return;
  }

  try {
    // 1. Busca el usuario en Supabase (con hash de contraseña en producción)
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('usuario', usuario)
      .eq('password', password) // En producción, usar autenticación segura
      .maybeSingle(); // Devuelve null si no hay resultados

    if (error) throw error;
    if (!data) throw new Error("Usuario o contraseña incorrectos");

    // 2. Guarda la sesión en localStorage (en producción considerar sessionStorage o cookies seguras)
    localStorage.setItem('clienteAutenticado', JSON.stringify(data));
    
    // 3. Mostrar mensaje de éxito y recargar
    mostrarMensaje(`Bienvenido ${data.nombre}!`, 'exito', 'authMessage');
    
    // 4. Redirigir después de breve espera
    setTimeout(() => {
      document.getElementById('authContainer')?.classList.remove('active');
      document.getElementById('citaContainer')?.classList.add('active');
      location.reload(); // Para asegurar que todos los componentes se actualicen
    }, 1500);

  } catch (error) {
    console.error("Error en login:", error);
    mostrarMensaje(error.message || 'Error al iniciar sesión', 'error', 'authMessage');
  }
}

// 12. Función mejorada para manejar registro
async function handleRegister() {
  // 1. Obtener datos del formulario con validación
  const userData = {
    nombre: document.getElementById('registerNombre').value.trim(),
    telefono: document.getElementById('registerTelefono').value.trim(),
    usuario: document.getElementById('registerUsuario').value.trim(),
    password: document.getElementById('registerPassword').value,
    confirmPassword: document.getElementById('registerConfirmPassword').value
  };

  // Validación frontend
  if (!userData.nombre || userData.nombre.length < 3) {
    mostrarMensaje('El nombre debe tener al menos 3 caracteres', 'error', 'authMessage');
    return;
  }

  if (!userData.telefono || !/^(\+58|0)\d{9,15}$/.test(userData.telefono)) {
    mostrarMensaje('Teléfono inválido. Debe comenzar con +58 o 0 y tener 10-15 dígitos', 'error', 'authMessage');
    return;
  }

  if (!userData.usuario || userData.usuario.length < 4) {
    mostrarMensaje('El usuario debe tener al menos 4 caracteres', 'error', 'authMessage');
    return;
  }

  if (!userData.password || userData.password.length < 6) {
    mostrarMensaje('La contraseña debe tener al menos 6 caracteres', 'error', 'authMessage');
    return;
  }

  if (userData.password !== userData.confirmPassword) {
    mostrarMensaje('Las contraseñas no coinciden', 'error', 'authMessage');
    return;
  }

  try {
    // 2. Verificar si el usuario ya existe
    const { data: existingUser, error: queryError } = await supabase
      .from('clientes')
      .select('usuario, telefono')
      .or(`usuario.eq.${userData.usuario},telefono.eq.${userData.telefono}`);

    if (queryError) throw queryError;
    
    if (existingUser && existingUser.length > 0) {
      const usuarioExistente = existingUser.some(u => u.usuario === userData.usuario);
      const telefonoExistente = existingUser.some(u => u.telefono === userData.telefono);
      
      if (usuarioExistente && telefonoExistente) {
        throw new Error("⚠️ El usuario y teléfono ya están registrados");
      } else if (usuarioExistente) {
        throw new Error("⚠️ El usuario ya está registrado");
      } else {
        throw new Error("⚠️ El teléfono ya está registrado");
      }
    }

    // 3. Insertar en Supabase (sin la confirmación de contraseña)
    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nombre: userData.nombre,
        telefono: userData.telefono,
        usuario: userData.usuario,
        password: userData.password // En producción, usar hash!
      }])
      .select();

    if (error) throw error;
    if (!data || data.length === 0) throw new Error("No se recibieron datos del registro");

    // 4. Éxito: mostrar mensaje y cambiar a login
    mostrarMensaje('✅ Registro exitoso! Ahora puedes iniciar sesión', 'exito', 'authMessage');
    
    // Limpiar formularios y mostrar login
    document.getElementById('registerForm').reset();
    document.getElementById('loginForm').reset();
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('showRegister').style.display = 'block';

  } catch (error) {
    console.error("Error en registro:", error);
    mostrarMensaje(error.message || 'Error en el registro. Intente nuevamente.', 'error', 'authMessage');
  }
}

// 13. Función mejorada para manejar autenticación de usuarios
function manejarAutenticacion() {
  const authContainer = document.getElementById('authContainer');
  const citaContainer = document.getElementById('citaContainer');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const showRegister = document.getElementById('showRegister');
  const showLogin = document.getElementById('showLogin');
  const authForm = document.getElementById('authForm');
  const logoutBtn = document.getElementById('logoutBtn');

  // Estado inicial: mostrar login
  if (loginForm && registerForm) {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
  }

  // Mostrar formulario de registro
  showRegister?.addEventListener('click', (e) => {
    e.preventDefault();
    if (loginForm && registerForm) {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      showRegister.style.display = 'none';
      showLogin.style.display = 'block';
    }
  });

  // Mostrar formulario de login
  showLogin?.addEventListener('click', (e) => {
    e.preventDefault();
    if (loginForm && registerForm) {
      registerForm.style.display = 'none';
      loginForm.style.display = 'block';
      showLogin.style.display = 'none';
      showRegister.style.display = 'block';
    }
  });

  // Manejar logout
  logoutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('clienteAutenticado');
    mostrarMensaje('Sesión cerrada correctamente', 'info', 'authMessage');
    
    if (authContainer && citaContainer) {
      authContainer.classList.add('active');
      citaContainer.classList.remove('active');
    }
    
    // Resetear formularios
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
    
    // Mostrar login por defecto
    if (loginForm && registerForm && showLogin && showRegister) {
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      showLogin.style.display = 'none';
      showRegister.style.display = 'block';
    }
  });

  // Validación en tiempo real para el formulario de registro
  registerForm?.addEventListener('input', function(e) {
    const password = document.getElementById('registerPassword')?.value;
    const confirmPassword = document.getElementById('registerConfirmPassword')?.value;
    
    if (e.target.id === 'registerConfirmPassword' || e.target.id === 'registerPassword') {
      const confirmPasswordInput = document.getElementById('registerConfirmPassword');
      if (confirmPasswordInput) {
        if (password !== confirmPassword) {
          confirmPasswordInput.setCustomValidity('Las contraseñas no coinciden');
        } else {
          confirmPasswordInput.setCustomValidity('');
        }
      }
    }
  });

  // Manejar envío de formulario de autenticación
  authForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const isLogin = loginForm && loginForm.style.display !== 'none';
    
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

// 14. Inicialización principal mejorada
function inicializarComponentes() {
  // Verificar autenticación al cargar
  const cliente = JSON.parse(localStorage.getItem('clienteAutenticado'));
  
  if (cliente) {
    // Mostrar vista de citas
    document.getElementById('authContainer')?.classList.remove('active');
    document.getElementById('citaContainer')?.classList.add('active');
    
    // Rellenar datos automáticamente
    document.getElementById('nombre')?.value = cliente.nombre || '';
    document.getElementById('telefono')?.value = cliente.telefono || '';
    
    // Mostrar nombre de usuario en navbar
    const userNavElement = document.getElementById('userNav');
    if (userNavElement) {
      userNavElement.textContent = cliente.nombre || cliente.usuario;
    }
  }

  // Verificar Supabase
  if (!supabase) {
    mostrarMensaje('Error en la configuración del sistema. Recarga la página.', 'error');
    return;
  }

  // Inicializar componentes
  manejarAutenticacion();
  inicializarSelectores();

  // Generar horarios para la fecha inicial
  const fechaInput = document.getElementById('fecha');
  if (fechaInput?.value) {
    generarHorariosDisponibles(fechaInput.value);
  }

  // Manejar envío del formulario de citas
  const citaForm = document.getElementById('citaForm');
  if (citaForm) {
    citaForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      const submitBtn = citaForm.querySelector('button[type="submit"]');
      if (!submitBtn) return;
      
      // Estado de carga
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Agendando...';
      
      try {
        // Obtener valores del formulario
        const formData = {
          nombre: document.getElementById('nombre')?.value.trim() || '',
          telefono: document.getElementById('telefono')?.value.trim() || '',
          fecha: document.getElementById('fecha')?.value || '',
          hora: document.getElementById('hora')?.value || '',
          servicio: document.getElementById('servicio')?.value || '',
          barbero: document.getElementById('barbero')?.value || ''
        };

        // Validar datos
        const validacion = validarFormulario(formData);
        if (!validacion.valido) {
          throw new Error(validacion.error);
        }

        // Guardar cita
        const citaGuardada = await guardarCita(formData);
        
        // Mostrar éxito y resetear
        mostrarMensaje('✅ Cita agendada correctamente. Te esperamos!', 'exito');
        
        // Resetear solo los campos de cita, mantener nombre y teléfono
        document.getElementById('fecha').value = fechaInput?.min || '';
        document.getElementById('hora').value = '';
        document.getElementById('servicio').value = '';
        document.getElementById('barbero').value = '';
        
        // Regenerar horarios
        if (formData.fecha) {
          generarHorariosDisponibles(formData.fecha);
        }
        
      } catch (error) {
        console.error('Error al procesar cita:', error);
        mostrarMensaje(`❌ ${error.message}`, 'error');
      } finally {
        // Restaurar botón
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
  // Si Supabase ya está cargado, inicializar componentes
  if (typeof window.supabase !== 'undefined') {
    inicializarComponentes();
  }
  
  // También escuchar cambios en caso de carga asíncrona
  document.addEventListener('supabaseReady', inicializarComponentes);
});
