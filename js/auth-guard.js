// auth-guard.js
// Este script debe incluirse en todas las páginas protegidas (excepto la pantalla de login).
// Verifica la existencia de sesión y gestiona el cierre por inactividad.

(function() {
  'use strict';

  const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutos en milisegundos
  let timeoutId;

  // Verificar sesión activa en sessionStorage
  const sesionJSON = sessionStorage.getItem('sesion');
  if (!sesionJSON) {
    // Redirigir al login si no hay sesión
    window.location.replace('panel.html');
    return;
  }

  // Parsear sesión
  let sesion;
  try {
    sesion = JSON.parse(sesionJSON);
  } catch (e) {
    sessionStorage.removeItem('sesion');
    window.location.replace('panel.html');
    return;
  }

  // Opcional: actualizar el último timestamp para mantener la actividad
  function actualizarTimestamp() {
    sesion.timestamp = Date.now();
    sessionStorage.setItem('sesion', JSON.stringify(sesion));
  }

  // Función de cierre de sesión
  function cerrarSesion(mensaje = 'Sesión cerrada correctamente.') {
    clearTimeout(timeoutId);
    sessionStorage.removeItem('sesion');
    // Mostrar alerta y luego redirigir
    Swal.fire({
      icon: 'info',
      title: 'Sesión finalizada',
      text: mensaje,
      confirmButtonColor: '#ffd700',
      allowOutsideClick: false
    }).then(() => {
      window.location.replace('panel.html');
    });
  }

  // Función que reinicia el temporizador de inactividad
  function reiniciarTemporizador() {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      cerrarSesion('Sesión expirada por inactividad.');
    }, INACTIVITY_LIMIT);
  }

  // Event listeners para actividad del usuario
  const eventos = ['mousemove', 'keydown', 'click', 'scroll'];
  eventos.forEach(evento => {
    document.addEventListener(evento, reiniciarTemporizador, true);
  });

  // Enlace de cierre de sesión explícito (debe existir un elemento con id="logout-btn")
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      cerrarSesion('Has cerrado sesión exitosamente.');
    });
  }

  // Iniciar el temporizador inicial
  reiniciarTemporizador();
})();
