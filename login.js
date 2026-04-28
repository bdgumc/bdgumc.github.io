// login.js – Lógica de autenticación del módulo BDG
document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------
  // 1. Detectar si el usuario viene de una sesión expirada (parámetro en URL)
  // --------------------------------------------------------------
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('expired') === 'true') {
    Swal.fire({
      icon: 'warning',
      title: 'Sesión expirada',
      text: 'Tu sesión ha expirado por inactividad. Inicia sesión nuevamente.',
      confirmButtonColor: '#D4AF37',
      background: '#0B1D3A',
      color: '#fff'
    });
    // Limpiar el query string sin recargar la página
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const form = document.getElementById('loginForm');
  const loader = document.getElementById('loader');
  const usernameInput = document.getElementById('usuario');
  const passwordInput = document.getElementById('contraseña');
  const allInputs = document.querySelectorAll('input');

  // --------------------------------------------------------------
  // 2. Validación visual en tiempo real (estilo profesional)
  // --------------------------------------------------------------
  allInputs.forEach(input => {
    input.addEventListener('input', () => {
      if (input.value.trim() !== '') {
        input.classList.add('filled');   // borde verde por tener contenido
        input.classList.remove('invalid');
      } else {
        input.classList.remove('filled');
      }
    });
  });

  // --------------------------------------------------------------
  // 3. Manejo del envío del formulario
  // --------------------------------------------------------------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Marcar campos vacíos como inválidos
    let valid = true;
    if (usernameInput.value.trim() === '') {
      usernameInput.classList.add('invalid');
      valid = false;
    } else {
      usernameInput.classList.remove('invalid');
    }
    if (passwordInput.value.trim() === '') {
      passwordInput.classList.add('invalid');
      valid = false;
    } else {
      passwordInput.classList.remove('invalid');
    }
    if (!valid) return;

    // Mostrar spinner de carga
    loader.style.display = 'flex';

    try {
      // --- FETCH al JSON de usuarios (base de datos estática) ---
      // En producción, ajustar la URL según la ubicación real (GitHub, servidor, etc.)
      const response = await fetch('usuarios.json');
      if (!response.ok) throw new Error('No se pudo cargar la base de datos de usuarios.');

      const data = await response.json();
      const usuarios = data.usuarios || [];

      // ---- NOTA DE SEGURIDAD ----
      // Buscamos por el campo "usuario" (no por ID) para evitar problemas con IDs duplicados.
      // La comparación es exacta (case‑sensitive) para mayor rigor.
      const usuario = usuarios.find(u => u.usuario === usernameInput.value.trim());

      if (!usuario) {
        // Mensaje genérico para no revelar si existe o no el usuario
        throw new Error('Credenciales incorrectas.');
      }

      // Verificar contraseña
      if (usuario.contraseña !== passwordInput.value.trim()) {
        throw new Error('Credenciales incorrectas.');
      }

      // Verificar estatus: solo "activo" puede acceder
      if (usuario.estatus !== 'activo') {
        // SweetAlert profesional para usuarios suspendidos
        await Swal.fire({
          icon: 'error',
          title: 'Acceso denegado',
          text: 'Su cuenta se encuentra suspendida. Contacte al administrador.',
          confirmButtonColor: '#D4AF37',
          background: '#0B1D3A',
          color: '#fff'
        });
        loader.style.display = 'none';
        return; // Salir sin redirigir
      }

      // --- Autenticación exitosa: crear sesión ofuscada ---
      const sessionData = {
        usuario: usuario.usuario,
        jerarquia: usuario.jerarquia,
        inicio: new Date().toISOString()  // timestamp para posibles auditorías
      };

      // Ofuscación simple: JSON → Base64 (no es cifrado real, pero dificulta la lectura directa)
      const token = btoa(JSON.stringify(sessionData));
      sessionStorage.setItem('bdg_session', token);

      // Redirigir a la página principal protegida (horarios.html)
      window.location.href = 'horarios.html';

    } catch (error) {
      // Cualquier error (red, credenciales, etc.) se muestra con SweetAlert2
      await Swal.fire({
        icon: 'error',
        title: 'Error de autenticación',
        text: error.message || 'Error inesperado.',
        confirmButtonColor: '#D4AF37',
        background: '#0B1D3A',
        color: '#fff'
      });
    } finally {
      // Ocultar el spinner siempre, haya éxito o error
      loader.style.display = 'none';
    }
  });
});
