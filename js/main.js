// ==============================================
// PROVEER EL TOKEN DE GITHUB DE MANERA SEGURA
// En producción, este valor debe inyectarse desde
// el servidor o mediante un build (ej. Vite con env).
// NUNCA subir el token a repositorios públicos.
// ==============================================
const GITHUB_TOKEN = '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';          // <-- REEMPLAZAR CON TU TOKEN
const GITHUB_OWNER = 'bdgumc'; // <-- REEMPLAZAR
const GITHUB_REPO = 'bdgumc.github.io';            // <-- REEMPLAZAR
const JSON_PATH = 'usuarios.json';        // Ruta dentro del repo

// Función para obtener usuarios.json desde la API de GitHub
async function fetchUsers() {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${JSON_PATH}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });

  if (!response.ok) {
    throw new Error(`Error ${response.status}: No se pudo obtener el archivo de usuarios`);
  }

  const data = await response.json();
  // El contenido viene en base64, lo decodificamos
  const decoded = atob(data.content);
  const usuarios = JSON.parse(decoded);
  return usuarios.usuarios; // array de usuarios
}

// Manejador del formulario de login
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const usuarioInput = document.getElementById('usuario').value.trim();
  const passwordInput = document.getElementById('password').value.trim();

  if (!usuarioInput || !passwordInput) {
    Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos',
      text: 'Por favor, complete todos los campos.',
      confirmButtonColor: '#ffd700'
    });
    return;
  }

  try {
    Swal.fire({
      title: 'Autenticando...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const usuarios = await fetchUsers();

    // Buscar coincidencia exacta de usuario y contraseña
    const usuarioEncontrado = usuarios.find(
      u => u.usuario === usuarioInput && u.contraseña === passwordInput
    );

    if (!usuarioEncontrado) {
      Swal.fire({
        icon: 'error',
        title: 'Credenciales inválidas',
        text: 'Usuario o contraseña incorrectos.',
        confirmButtonColor: '#e63946'
      });
      return;
    }

    // Verificar estatus
    if (usuarioEncontrado.estatus === 'suspendido') {
      Swal.fire({
        icon: 'error',
        title: 'Acceso denegado',
        text: 'Su cuenta se encuentra suspendida. Contacte al administrador.',
        confirmButtonColor: '#e63946'
      });
      return;
    }

    // Éxito: crear sesión (sin contraseña)
    const sesion = {
      usuario: usuarioEncontrado.usuario,
      jerarquia: usuarioEncontrado.jerarquia,
      timestamp: Date.now()
    };
    sessionStorage.setItem('sesion', JSON.stringify(sesion));

    // Cambiar a vista de dashboard
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'block';

    // Mostrar datos del usuario
    document.getElementById('display-usuario').textContent = sesion.usuario;
    document.getElementById('display-jerarquia').textContent = sesion.jerarquia;

    // Cargar dinámicamente auth-guard.js para proteger la sesión y controlar inactividad
    const script = document.createElement('script');
    script.src = 'js/auth-guard.js';
    document.head.appendChild(script);

    Swal.fire({
      icon: 'success',
      title: 'Acceso permitido',
      text: `Bienvenido/a, ${sesion.jerarquia} ${sesion.usuario}`,
      timer: 2000,
      showConfirmButton: false,
      confirmButtonColor: '#2a9d8f'
    });

  } catch (error) {
    console.error(error);
    Swal.fire({
      icon: 'error',
      title: 'Error del sistema',
      text: 'No se pudo conectar con el repositorio. Intente más tarde.',
      confirmButtonColor: '#e63946'
    });
  }
});
