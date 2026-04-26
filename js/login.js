// js/login.js
document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const mensaje = document.getElementById("mensaje");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usuario = document.getElementById("usuario").value.trim();
        const contraseña = document.getElementById("contraseña").value.trim();

        if (!usuario || !contraseña) {
            mostrarMensaje("Por favor, completa todos los campos.", "error");
            return;
        }

        mostrarMensaje("Verificando credenciales...", "info");

        try {
            const usuarios = await obtenerUsuarios();
            const usuarioEncontrado = usuarios.find(
                (u) => u.usuario === usuario && u.contraseña === contraseña
            );

            if (!usuarioEncontrado) {
                mostrarMensaje("Usuario o contraseña incorrectos.", "error");
                return;
            }

            if (usuarioEncontrado.estatus !== "activo") {
                mostrarMensaje("Tu cuenta está suspendida. Contacta al administrador.", "error");
                return;
            }

            // Guardar sesión en sessionStorage
            sessionStorage.setItem("usuarioBDG", JSON.stringify(usuarioEncontrado));
            mostrarMensaje("¡Ingreso exitoso! Redirigiendo...", "exito");
            setTimeout(() => {
                window.location.href = "horarios.html"; // o panel principal
            }, 1500);

        } catch (error) {
            console.error(error);
            mostrarMensaje("Error al conectar con la base de datos. Intenta más tarde.", "error");
        }
    });

    function mostrarMensaje(texto, tipo) {
        mensaje.textContent = texto;
        mensaje.className = tipo; // "error", "info", "exito"
    }
});

async function obtenerUsuarios() {
    const { githubToken, owner, repo, filePath, branch } = CONFIG;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

    const respuesta = await fetch(url, {
        headers: {
            "Authorization": `token ${githubToken}`,
            "Accept": "application/vnd.github.v3+json"
        }
    });

    if (!respuesta.ok) {
        throw new Error(`Error HTTP: ${respuesta.status}`);
    }

    const data = await respuesta.json();
    // El contenido viene en base64
    const contenido = atob(data.content);
    const json = JSON.parse(contenido);
    return json.usuarios;
}
