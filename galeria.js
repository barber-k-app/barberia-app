// Configuración de Backblaze B2
const BACKBLAZE_CONFIG = {
  bucketId: '152e8f0a281dc7f6908b041a', // Tu Bucket ID
  endpoint: 'https://s3.us-east-005.backblazeb2.com', // Tu Endpoint
  keyId: '0055efa8d760b4a0000000002', // Reemplaza con tu Key ID
  applicationKey: 'K005i2BsiNdPD3+fIfVsqhGbTWmsm0Y' // Reemplaza con tu Application Key
};

// Función para generar URL firmada
function generarURLFirmada(nombreArchivo) {
  // Aquí va la lógica para generar URLs temporales
  // (La implementaremos en el siguiente paso)
  return `${BACKBLAZE_CONFIG.endpoint}/${BACKBLAZE_CONFIG.bucketId}/${nombreArchivo}`;
}

// Función para mostrar galería
async function mostrarGaleria() {
  const contenedor = document.getElementById('galeria-imagenes');
  if (!contenedor) return;

  // Ejemplo de imágenes (luego se conectarán con Backblaze)
  const imagenes = [
    'foto1.jpg',
    'foto2.jpg',
    'foto3.jpg'
  ];

  contenedor.innerHTML = imagenes.map(img => `
    <div class="galeria-item">
      <img src="${generarURLFirmada(img)}" loading="lazy" alt="Trabajo barbería">
    </div>
  `).join('');
}

// Inicializar galería cuando la página cargue
document.addEventListener('DOMContentLoaded', function() {
  mostrarGaleria();
});



// Variables globales
let archivosSeleccionados = [];

// Función para subir archivos a Backblaze
async function subirArchivoBackblaze(file) {
  console.log('Subiendo archivo:', file.name);
  
  // Mostrar estado de subida
  mostrarMensaje(`📤 Subiendo ${file.name}...`, 'info');
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    // Generar nombre único para evitar sobreescritura
    const nombreUnico = `${Date.now()}_${file.name}`;
    
    const response = await fetch(
      `${BACKBLAZE_CONFIG.endpoint}/file/${BACKBLAZE_CONFIG.bucketId}/${nombreUnico}`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${BACKBLAZE_CONFIG.keyId}:${BACKBLAZE_CONFIG.applicationKey}`)
        },
        body: formData
      }
    );
    
    if (!response.ok) throw new Error('Error en la subida');
    
    console.log('Archivo subido exitosamente:', nombreUnico);
    return nombreUnico;
    
  } catch (error) {
    console.error('Error subiendo archivo:', error);
    throw error;
  }
}

// Función para manejar la selección de archivos
function manejarSeleccionArchivos(event) {
  const files = Array.from(event.target.files);
  if (files.length === 0) return;
  
  archivosSeleccionados = files;
  mostrarPrevisualizacion(files);
}

// Función para mostrar previsualización
function mostrarPrevisualizacion(files) {
  const previewContainer = document.getElementById('preview-container');
  const previsualizacion = document.getElementById('previsualizacion');
  
  previewContainer.innerHTML = '';
  previsualizacion.style.display = 'block';
  
  files.forEach(file => {
    const previewItem = document.createElement('div');
    previewItem.style.margin = '10px';
    previewItem.style.display = 'inline-block';
    
    if (file.type.startsWith('image/')) {
      const img = document.createElement('img');
      img.src = URL.createObjectURL(file);
      img.style.width = '100px';
      img.style.height = '100px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '8px';
      previewItem.appendChild(img);
    } else if (file.type.startsWith('video/')) {
      const videoIcon = document.createElement('div');
      videoIcon.innerHTML = '<i class="fas fa-video" style="font-size: 40px; color: var(--light-gold);"></i>';
      videoIcon.style.textAlign = 'center';
      previewItem.appendChild(videoIcon);
    }
    
    const fileName = document.createElement('div');
    fileName.textContent = file.name.length > 15 ? file.name.substring(0, 15) + '...' : file.name;
    fileName.style.marginTop = '5px';
    fileName.style.fontSize = '12px';
    fileName.style.color = 'var(--light)';
    previewItem.appendChild(fileName);
    
    previewContainer.appendChild(previewItem);
  });
}

// Función para confirmar la subida
async function confirmarSubida() {
  const confirmarBtn = document.getElementById('confirmar-subida');
  const previsualizacion = document.getElementById('previsualizacion');
  
  confirmarBtn.disabled = true;
  confirmarBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo...';
  
  try {
    for (const file of archivosSeleccionados) {
      await subirArchivoBackblaze(file);
    }
    
    mostrarMensaje('✅ ¡Archivos subidos exitosamente!', 'exito');
    previsualizacion.style.display = 'none';
    archivosSeleccionados = [];
    
    // Recargar galería
    setTimeout(() => location.reload(), 2000);
    
  } catch (error) {
    mostrarMensaje('❌ Error al subir archivos', 'error');
  } finally {
    confirmarBtn.disabled = false;
    confirmarBtn.innerHTML = '<i class="fas fa-check"></i> Confirmar Subida';
  }
}

// Función para mostrar mensajes
function mostrarMensaje(texto, tipo) {
  // Puedes implementar tu sistema de mensajes aquí
  alert(`${tipo === 'exito' ? '✅' : '❌'} ${texto}`);
}

// Inicializar event listeners
function inicializarSubidaArchivos() {
  const inputArchivos = document.getElementById('subir-archivos');
  const confirmarBtn = document.getElementById('confirmar-subida');
  
  if (inputArchivos) {
    inputArchivos.addEventListener('change', manejarSeleccionArchivos);
  }
  
  if (confirmarBtn) {
    confirmarBtn.addEventListener('click', confirmarSubida);
  }
}

// Agregar al inicializador existente
document.addEventListener('DOMContentLoaded', function() {
  mostrarGaleria();
  inicializarSubidaArchivos(); // ← Agregar esta línea
});