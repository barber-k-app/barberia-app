<!-- ******************** JAVASCRIPT ******************** -->
  <script>
      // Variables globales
      let todasLasCitas = [];
      let modalAbierto = false;
      let canalCitas = null;

    // Función para mostrar notificaciones
    function mostrarNotificacion(mensaje, tipo = 'info') {
      const notificacion = document.createElement('div');
      notificacion.className = `notificacion notificacion-${tipo}`;
      notificacion.innerHTML = `
        <i class="fas fa-${tipo === 'info' ? 'info-circle' : 
                          tipo === 'success' ? 'check-circle' : 
                          tipo === 'warning' ? 'exclamation-triangle' : 
                          'times-circle'}"></i>
        <p>${mensaje}</p>
      `;
      document.body.appendChild(notificacion);
      
      // Mostrar notificación
      setTimeout(() => {
        notificacion.classList.add('show');
      }, 10);
      
      // Ocultar después de 3 segundos
      setTimeout(() => {
        notificacion.classList.remove('show');
        notificacion.classList.add('hide');
        
        // Eliminar después de la animación
        setTimeout(() => notificacion.remove(), 300);
      }, 3000);
    }

    // Verificación de seguridad para barberos
    async function verificarAccesoBarbero() {
      // Contraseña simple (puedes cambiarla)
      const CONTRASENA = "barbero123";
      // Verificar si ya está autenticado
      const yaAutenticado = sessionStorage.getItem('barberoAutenticado');
      if (yaAutenticado === 'true') {
        return true;
      }
      
      // Mostrar modal de verificación
      const modal = document.getElementById('modal-verificacion');
      modal.style.display = 'flex';
      
      return new Promise((resolve) => {
        const verificar = () => {
          const inputPassword = document.getElementById('input-password').value;
          if (!inputPassword) return;
          
          // Mostrar estado de carga
          const btnVerificar = document.getElementById('btn-verificar');
          btnVerificar.classList.add('verificando');
          btnVerificar.disabled = true;
          
          // Simular verificación con retraso (para mejor UX)
          setTimeout(() => {
            if (inputPassword === CONTRASENA) {
              sessionStorage.setItem('barberoAutenticado', 'true');
              modal.style.display = 'none';
              mostrarNotificacion('Acceso concedido', 'success');
              resolve(true);
            } else {
              document.getElementById('mensaje-error-verificacion').style.display = 'block';
              mostrarNotificacion('Contraseña incorrecta', 'error');
              btnVerificar.classList.remove('verificando');
              btnVerificar.disabled = false;
              resolve(false);
            }
          }, 800);
        };
        
        // Configurar eventos
        document.getElementById('btn-verificar').onclick = verificar;
        document.getElementById('input-password').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            verificar();
          }
        });
      });
    }

    // Función para mostrar botón de cerrar sesión
    function mostrarBotonCerrarSesion() {
      // Eliminar botón existente si existe
      const botonExistente = document.getElementById('btn-cerrar-sesion');
      if (botonExistente) botonExistente.remove();
  
      // Crear nuevo botón
      const botonCerrar = document.createElement('button');
      botonCerrar.id = 'btn-cerrar-sesion';
      botonCerrar.innerHTML = `
        <i class="fas fa-sign-out-alt"></i>
        <span>Salir del panel</span>
      `;

      // Estilos en línea como garantía
      botonCerrar.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: rgba(10, 10, 10, 0.95);
        color: #D4AF37;
        border: 1px solid #D4AF37;
        padding: 8px 15px;
        border-radius: 4px;
        z-index: 1000;
        font-family: inherit;
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
        transition: all 0.3s ease;
      `;
  
      botonCerrar.addEventListener('mouseenter', () => {
        botonCerrar.style.background = '#D4AF37';
        botonCerrar.style.color = '#0a0a0a';
      });
  
      botonCerrar.addEventListener('mouseleave', () => {
        botonCerrar.style.background = 'rgba(10, 10, 10, 0.95)';
        botonCerrar.style.color = '#D4AF37';
      });
  
      botonCerrar.addEventListener('click', () => {
        sessionStorage.removeItem('barberoAutenticado');
        mostrarNotificacion('Sesión cerrada correctamente', 'success');
        setTimeout(() => window.location.reload(), 1000);
      });
  
      document.body.appendChild(botonCerrar);
    }
     
    
    // Cargar citas desde Supabase
    async function cargarCitas() {
      const contenedor = document.getElementById('citasContainer');
      if (!contenedor) return;

      try {
        contenedor.innerHTML = `
          <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>Cargando citas...</p>
          </div>
        `;

        const { data: citas, error } = await supabase
          .from('citas')
          .select('*')
          .order('fecha', { ascending: true })
          .order('hora', { ascending: true });

        if (error) throw error;

        todasLasCitas = citas || [];
        mostrarCitas(todasLasCitas);
        actualizarEstadisticas(todasLasCitas);
        mostrarHistorialCitas(todasLasCitas);
        
      } catch (error) {
        console.error('Error al cargar citas:', error);
        contenedor.innerHTML = `
          <div class="mensaje-error">
            <p>Error al cargar citas. Por favor intente nuevamente.</p>
            <button onclick="window.location.reload()" class="btn-reintentar">
              <i class="fas fa-sync-alt"></i> Reintentar
            </button>
          </div>
        `;
      }
    }

    // Mostrar citas en la tabla
    function mostrarCitas(citas) {
      const contenedor = document.getElementById('citasContainer');
      if (!contenedor) return;

      if (!citas || citas.length === 0) {
        contenedor.innerHTML = '<p class="no-citas">No hay citas agendadas actualmente</p>';
        return;
      }

      let html = `
        <div class="table-responsive">
          <div class="select-all-container">
            <input type="checkbox" id="select-all" class="select-all-checkbox">
            <button id="btn-eliminar-multiple" class="btn-eliminar-multiple" disabled>
              <i class="fas fa-trash"></i> Eliminar seleccionados
            </button>
          </div>
          <table class="tabla-citas">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th>Fecha</th>
                <th>Hora</th>
                <th>Servicio</th>
                <th>Barbero</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
      `;

      citas.forEach(cita => {
        const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-ES');
        const horaFormateada = cita.hora.substring(0, 5);
        
        html += `
          <tr>
            <td>
              <input type="checkbox" class="cita-checkbox" data-id="${cita.id}">
              ${cita.nombre}
            </td>
            <td>${cita.telefono}</td>
            <td>${fechaFormateada}</td>
            <td>${horaFormateada}</td>
            <td>${cita.servicio}</td>
            <td>${cita.barbero}</td>
            <td class="estado-cita" data-estado="${cita.estado}">
              ${cita.estado}
            </td>
            <td class="acciones">
              <button class="btn-accion btn-completar" data-id="${cita.id}" title="Completar">
                <i class="fas fa-check"></i>
              </button>
              <button class="btn-accion btn-cancelar" data-id="${cita.id}" title="Cancelar">
                <i class="fas fa-times"></i>
              </button>
              <button class="btn-accion btn-detalles" data-id="${cita.id}" title="Detalles">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-accion btn-eliminar" data-id="${cita.id}" title="Eliminar">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
      contenedor.innerHTML = html;
      agregarEventosBotones();
      configurarSeleccionMultiple();
    }

    // Configurar la selección múltiple de citas
    function configurarSeleccionMultiple() {
      const selectAllCheckbox = document.getElementById('select-all');
      const checkboxes = document.querySelectorAll('.cita-checkbox');
      const deleteMultipleBtn = document.getElementById('btn-eliminar-multiple');
      
      // Seleccionar/deseleccionar todos
      if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
          checkboxes.forEach(checkbox => {
            checkbox.checked = e.target.checked;
          });
          actualizarBotonEliminarMultiple();
        });
      }
      
      // Actualizar botón eliminar múltiple
      if (checkboxes) {
        checkboxes.forEach(checkbox => {
          checkbox.addEventListener('change', actualizarBotonEliminarMultiple);
        });
      }
      
      // Eliminar múltiples citas
      if (deleteMultipleBtn) {
        deleteMultipleBtn.addEventListener('click', eliminarCitasSeleccionadas);
      }
    }
    
    // Actualizar estado del botón eliminar múltiple
    function actualizarBotonEliminarMultiple() {
      const checkboxes = document.querySelectorAll('.cita-checkbox:checked');
      const deleteMultipleBtn = document.getElementById('btn-eliminar-multiple');
      
      if (deleteMultipleBtn) {
        deleteMultipleBtn.disabled = checkboxes.length === 0;
      }
      
      // Actualizar checkbox "seleccionar todos"
      const selectAllCheckbox = document.getElementById('select-all');
      if (selectAllCheckbox) {
        const allCheckboxes = document.querySelectorAll('.cita-checkbox');
        selectAllCheckbox.checked = allCheckboxes.length > 0 && checkboxes.length === allCheckboxes.length;
        selectAllCheckbox.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
      }
    }
    
    // Eliminar citas seleccionadas
    async function eliminarCitasSeleccionadas() {
      const checkboxes = document.querySelectorAll('.cita-checkbox:checked');
      if (checkboxes.length === 0) return;
      
      if (!confirm(`¿Estás seguro de que deseas eliminar ${checkboxes.length} citas seleccionadas?`)) return;
      
      const ids = Array.from(checkboxes).map(checkbox => checkbox.dataset.id);
      
      try {
        const { error } = await supabase
          .from('citas')
          .delete()
          .in('id', ids);
        
        if (error) throw error;
        
        mostrarNotificacion(`${ids.length} citas eliminadas correctamente`, 'success');
        await cargarCitas();
        
      } catch (error) {
        console.error('Error al eliminar citas:', error);
        mostrarNotificacion('Error al eliminar las citas seleccionadas', 'error');
      }
    }

    // Mostrar historial de citas
    function mostrarHistorialCitas(citas) {
      const contenedor = document.getElementById('historialCitas');
      if (!contenedor) return;

      // Ordenar citas por fecha más reciente primero
      const citasOrdenadas = [...citas].sort((a, b) => {
        const fechaA = new Date(`${a.fecha}T${a.hora}`);
        const fechaB = new Date(`${b.fecha}T${b.hora}`);
        return fechaB - fechaA;
      });

      // Limitar a las últimas 20 citas para el historial
      const ultimasCitas = citasOrdenadas.slice(0, 20);

      if (ultimasCitas.length === 0) {
        contenedor.innerHTML = '<p style="color: rgba(255,255,255,0.6); text-align: center;">No hay citas en el historial</p>';
        document.getElementById('contador-historial').textContent = '0 citas';
        return;
      }

      let html = '';
      
      ultimasCitas.forEach(cita => {
        const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
        
        const horaFormateada = cita.hora.substring(0, 5);
        
        html += `
          <div class="historial-item">
            <div class="historial-item-header">
              <span class="historial-cliente">${cita.nombre}</span>
              <span class="historial-fecha">${fechaFormateada} a las ${horaFormateada}</span>
            </div>
            <div class="historial-servicio">${cita.servicio} con ${cita.barbero}</div>
            <span class="historial-estado ${cita.estado}">${cita.estado}</span>
          </div>
        `;
      });

      contenedor.innerHTML = html;
      document.getElementById('contador-historial').textContent = `${ultimasCitas.length} citas recientes`;
    }

    // Agregar eventos a los botones de acción
    function agregarEventosBotones() {
      document.querySelectorAll('.btn-completar').forEach(btn => {
        btn.addEventListener('click', () => cambiarEstadoCita(btn.dataset.id, 'completado'));
      });
      
      document.querySelectorAll('.btn-cancelar').forEach(btn => {
        btn.addEventListener('click', () => cambiarEstadoCita(btn.dataset.id, 'cancelado'));
      });
      
      document.querySelectorAll('.btn-detalles').forEach(btn => {
        btn.addEventListener('click', () => mostrarDetallesCita(btn.dataset.id));
      });
      
      document.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => eliminarCita(btn.dataset.id));
      });
    }

    // Cambiar estado de una cita
    async function cambiarEstadoCita(id, nuevoEstado) {
      try {
        const { error } = await supabase
          .from('citas')
          .update({ estado: nuevoEstado })
          .eq('id', id);
        
        if (error) throw error;
        
        mostrarNotificacion(`Cita marcada como ${nuevoEstado}`, 'success');
        await cargarCitas();
        
      } catch (error) {
        console.error('Error al actualizar cita:', error);
        mostrarNotificacion('Error al actualizar el estado de la cita', 'error');
      }
    }
    
    // Eliminar una cita
    async function eliminarCita(id) {
      if (!confirm('¿Estás seguro de que deseas eliminar esta cita?')) return;
      
      try {
        const { error } = await supabase
          .from('citas')
          .delete()
          .eq('id', id);
        
        if (error) throw error;
        
        mostrarNotificacion('Cita eliminada correctamente', 'success');
        await cargarCitas();
        
      } catch (error) {
        console.error('Error al eliminar cita:', error);
        mostrarNotificacion('Error al eliminar la cita', 'error');
      }
    }

    // Mostrar detalles de cita en modal
    async function mostrarDetallesCita(id) {
      if (modalAbierto) return;
      modalAbierto = true;
      
      const modal = document.getElementById('modal-detalles');
      const modalBody = document.getElementById('modal-body');
      
      try {
        const { data: cita, error } = await supabase
          .from('citas')
          .select('*')
          .eq('id', id)
          .single();
        
        if (error) throw error;
        
        const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-ES', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        modalBody.innerHTML = `
          <div class="detalle-item">
            <h3>Cliente:</h3>
            <p>${cita.nombre}</p>
          </div>
          <div class="detalle-item">
            <h3>Teléfono:</h3>
            <p>${cita.telefono}</p>
          </div>
          <div class="detalle-item">
            <h3>Fecha:</h3>
            <p>${fechaFormateada}</p>
          </div>
          <div class="detalle-item">
            <h3>Hora:</h3>
            <p>${cita.hora.substring(0, 5)}</p>
          </div>
          <div class="detalle-item">
            <h3>Servicio:</h3>
            <p>${cita.servicio}</p>
          </div>
          <div class="detalle-item">
            <h3>Barbero:</h3>
            <p>${cita.barbero}</p>
          </div>
          <div class="detalle-item">
            <h3>Estado:</h3>
            <p class="estado-cita" data-estado="${cita.estado}">${cita.estado}</p>
          </div>
          <button class="btn-cerrar-detalles" style="margin-top: 20px; padding: 10px; background: var(--gold); color: var(--dark); border: none; border-radius: 5px; cursor: pointer;">
            Cerrar detalles
          </button>
        `;
        
        modal.style.display = 'flex';
        
        // Configurar cierre del modal
        document.querySelector('.btn-cerrar-detalles').addEventListener('click', cerrarModal);
        document.querySelector('.close-modal').addEventListener('click', cerrarModal);
        
      } catch (error) {
        console.error('Error al cargar detalles:', error);
        modalBody.innerHTML = '<p class="mensaje-error">Error al cargar los detalles de la cita</p>';
        modal.style.display = 'flex';
      }
    }

    function cerrarModal() {
      const modal = document.getElementById('modal-detalles');
      modal.style.display = 'none';
      modalAbierto = false;
    }
	
	// Filtrar citas
    function filtrarCitas() {
      const textoBusqueda = document.getElementById('buscador')?.value.toLowerCase() || '';
      const filtroEstado = document.getElementById('filtro-estado')?.value || 'todas';
      const filtroBarbero = document.getElementById('filtro-barbero')?.value || 'todos';

      let citasFiltradas = todasLasCitas.filter(cita => {
        const coincideNombre = cita.nombre.toLowerCase().includes(textoBusqueda);
        const coincideTelefono = cita.telefono.includes(textoBusqueda);
        const coincideEstado = filtroEstado === 'todas' || cita.estado === filtroEstado;
        const coincideBarbero = filtroBarbero === 'todos' || cita.barbero === filtroBarbero;
        
        return (coincideNombre || coincideTelefono) && coincideEstado && coincideBarbero;
      });

      mostrarCitas(citasFiltradas);
    }

    // Actualizar estadísticas
    function actualizarEstadisticas(citas) {
      const totalCitas = document.getElementById('total-citas');
      const pendientesCitas = document.getElementById('pendientes-citas');
      const completadasCitas = document.getElementById('completadas-citas');
      
      if (totalCitas) totalCitas.textContent = citas.length;
      if (pendientesCitas) pendientesCitas.textContent = citas.filter(c => c.estado === 'pendiente').length;
      if (completadasCitas) completadasCitas.textContent = citas.filter(c => c.estado === 'completado').length;
    }

    // Exportar citas a CSV
    function exportarCitas() {
      if (todasLasCitas.length === 0) {
        mostrarNotificacion('No hay citas para exportar', 'warning');
        return;
      }
      
      let csv = 'Nombre,Telefono,Fecha,Hora,Servicio,Barbero,Estado\n';
      
      todasLasCitas.forEach(cita => {
        csv += `"${cita.nombre}","${cita.telefono}","${cita.fecha}","${cita.hora}","${cita.servicio}","${cita.barbero}","${cita.estado}"\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `citas_barberia_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      mostrarNotificacion('Exportación completada con éxito', 'success');
    }

    // Conectar a websockets para cambios en tiempo real
    function conectarWebsockets() {
      if (canalCitas) {
        supabase.removeChannel(canalCitas);
      }

      canalCitas = supabase
        .channel('schema-db-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'citas'
          },
          (payload) => {
            console.log('Cambio recibido:', payload);
            cargarCitas();
          }
        )
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('Canal suscrito correctamente');
          }
          if (err) {
            console.error('Error en suscripción:', err);
          }
        });
    }

    // Inicialización del panel
    async function inicializarPanel() {
      try {
        const accesoPermitido = await verificarAccesoBarbero();
        if (!accesoPermitido) {
          window.location.href = 'index.html';
          return;
        }

        // Mostrar botón de cerrar sesión si ya está autenticado
        if (sessionStorage.getItem('barberoAutenticado') === 'true') {
           mostrarBotonCerrarSesion();
        }

        // Configurar eventos y cargar citas
        document.getElementById('buscador')?.addEventListener('input', filtrarCitas);
        document.getElementById('filtro-estado')?.addEventListener('change', filtrarCitas);
        document.getElementById('filtro-barbero')?.addEventListener('change', filtrarCitas);
        document.getElementById('btn-exportar')?.addEventListener('click', exportarCitas);
        
        await cargarCitas();
        conectarWebsockets();
        
      } catch (error) {
        console.error('Error en inicialización:', error);
        mostrarNotificacion('Error al inicializar el panel', 'error');
      }
    }

    // Iniciar cuando el DOM esté listo
    document.addEventListener('DOMContentLoaded', inicializarPanel);
  </script>
</body>
</html>
