/**
 * MÓDULO DE AUTENTICACIÓN Y CONTROL DE SESIÓN - BDG UMC
 * ====================================================
 * ADVERTENCIA DE SEGURIDAD:
 * El Personal Access Token (PAT) de GitHub está presente en este archivo.
 * NUNCA subas este código a un repositorio público.
 * Aplica ofuscación (ej. javascript-obfuscator) antes del despliegue final.
 */

// ---------- CONFIGURACIÓN ----------
const CONFIG = {
    // Datos del repositorio privado donde está usuarios.json
    GITHUB_OWNER: "bdgumc",
    GITHUB_REPO: "bdgumc.github.io",
    FILE_PATH: "usuarios.json",
    // Token de acceso personal (con permisos repo, solo lectura/escritura necesarios)
    GITHUB_TOKEN: "ghp_tuTokenPersonalAqui", // ⚠️ REEMPLAZAR por PAT real

    // Tiempos en milisegundos
    INACTIVITY_TIMEOUT: 20 * 60 * 1000,      // 20 minutos
    COOLDOWN_MINUTES: 5 * 60 * 1000,          // 5 minutos (enfriamiento)

    // Claves de localStorage
    STORAGE_SESSION: "bdg_session",
    STORAGE_LAST_UPDATE: "bdg_last_update",
    STORAGE_COOLDOWN_END: "bdg_cooldown_end"
};

// ---------- ESTADO GLOBAL ----------
let inactivityTimer = null;
let currentSession = null;      // Datos del usuario logueado (sin password)
let lastJsonUpdate = null;      // Fecha ISO de última actualización cargada
let cooldownInterval = null;    // Para el temporizador visual

// ---------- FUNCIONES DE API DE GITHUB ----------

/**
 * Llama a la API de GitHub para obtener el contenido de usuarios.json
 * @returns {Object} JSON parseado del archivo
 */
async function fetchUserDatabase() {
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_OWNER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.FILE_PATH}`;
    try {
        const response = await fetch(url, {
            headers: {
                "Authorization": `token ${CONFIG.GITHUB_TOKEN}`,
                "Accept": "application/vnd.github.v3+json"
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: No se pudo obtener usuarios.json`);
        }

        const data = await response.json();
        // El contenido viene en Base64, lo decodificamos
        const content = atob(data.content);
        const json = JSON.parse(content);

        // Guardamos la última actualización en localStorage para futuras comparaciones
        if (json.ultima_actualizacion) {
            lastJsonUpdate = json.ultima_actualizacion;
            localStorage.setItem(CONFIG.STORAGE_LAST_UPDATE, json.ultima_actualizacion);
        }
        return json;
    } catch (error) {
        console.error("fetchUserDatabase:", error);
        throw error; // Se maneja en la UI con SweetAlert2
    }
}

/**
 * Valida credenciales contra el JSON obtenido de GitHub
 * @param {string} username 
 * @param {string} password 
 * @returns {Object} Datos del usuario si es exitoso, o lanza error descriptivo
 */
async function validateCredentials(username, password) {
    const db = await fetchUserDatabase();
    const usuarioEncontrado = db.usuarios.find(u => u.usuario === username);

    if (!usuarioEncontrado) {
        throw new Error("Usuario no registrado.");
    }

    if (usuarioEncontrado.contraseña !== password) {
        throw new Error("Contraseña incorrecta.");
    }

    if (usuarioEncontrado.estatus !== "activo") {
        throw new Error(`Cuenta ${usuarioEncontrado.estatus}. Acceso denegado.`);
    }

    // No devolvemos la contraseña en la sesión
    const { contraseña, ...userData } = usuarioEncontrado;
    return userData;
}

// ---------- GESTIÓN DE SESIÓN ----------

/**
 * Crea una nueva sesión y la persiste
 * @param {Object} userData (sin password)
 */
function createSession(userData) {
    const session = {
        usuario: userData.usuario,
        jerarquia: userData.jerarquia,
        id: userData.id,
        loginTime: new Date().toISOString(),
        lastActivity: Date.now()
    };
    localStorage.setItem(CONFIG.STORAGE_SESSION, JSON.stringify(session));
    currentSession = session;
    startInactivityTimer();
}

/**
 * Carga la sesión existente desde localStorage (si es válida)
 * @returns {Object|null} sesión o null
 */
function loadSession() {
    const stored = localStorage.getItem(CONFIG.STORAGE_SESSION);
    if (!stored) return null;

    try {
        const session = JSON.parse(stored);
        currentSession = session;
        // Actualizar última actividad al cargar
        currentSession.lastActivity = Date.now();
        localStorage.setItem(CONFIG.STORAGE_SESSION, JSON.stringify(currentSession));
        return session;
    } catch (e) {
        return null;
    }
}

/**
 * Cierra la sesión, limpia todo y redirige al login
 */
function logout(message = "Sesión cerrada.") {
    stopInactivityTimer();
    stopCooldownTimer();
    localStorage.removeItem(CONFIG.STORAGE_SESSION);
    currentSession = null;
    lastJsonUpdate = null;

    if (message) {
        Swal.fire({
            icon: 'info',
            title: 'Sesión finalizada',
            text: message,
            timer: 2000
        }).then(() => {
            window.location.href = "panel.html"; // O index.html, según tu flujo
        });
    } else {
        window.location.href = "panel.html";
    }
}

/**
 * Verifica si hay sesión activa; si no, redirige al login.
 * Se llama al inicio de panel.html y horarios.html
 */
function requireSession() {
    if (!loadSession()) {
        // No hay sesión, redirigimos al login (panel.html con formulario de login)
        window.location.href = "panel.html";
        return null;
    }
    startInactivityTimer();
    return currentSession;
}

// ---------- TEMPORIZADOR DE INACTIVIDAD ----------

function resetInactivityTimer() {
    if (!currentSession) return;
    // Actualizar marca de tiempo en el objeto y en storage
    currentSession.lastActivity = Date.now();
    localStorage.setItem(CONFIG.STORAGE_SESSION, JSON.stringify(currentSession));

    // Reiniciar el timer
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        logout("Tu sesión se cerró por inactividad (20 minutos).");
    }, CONFIG.INACTIVITY_TIMEOUT);
}

function startInactivityTimer() {
    // Escuchamos eventos de actividad del usuario
    ['mousemove', 'keydown', 'scroll', 'click'].forEach(event => {
        window.addEventListener(event, resetInactivityTimer, { passive: true });
    });
    // Inicializamos el timer
    resetInactivityTimer();
}

function stopInactivityTimer() {
    clearTimeout(inactivityTimer);
    ['mousemove', 'keydown', 'scroll', 'click'].forEach(event => {
        window.removeEventListener(event, resetInactivityTimer);
    });
}

// ---------- CONTROL DE COOLDOWN (5 MINUTOS) ----------

/**
 * Verifica si está permitido realizar una actualización (según cooldown)
 * @returns {Object} { allowed: boolean, remaining: number (segundos) }
 */
function canPerformUpdate() {
    // Prioridad 1: Si en esta sesión tenemos un temporizador activo (tras un intento reciente)
    const cooldownEnd = localStorage.getItem(CONFIG.STORAGE_COOLDOWN_END);
    if (cooldownEnd) {
        const endTime = parseInt(cooldownEnd, 10);
        const now = Date.now();
        if (now < endTime) {
            const remaining = Math.ceil((endTime - now) / 1000);
            return { allowed: false, remaining };
        }
        // Cooldown vencido, limpiamos la marca
        localStorage.removeItem(CONFIG.STORAGE_COOLDOWN_END);
    }

    // Prioridad 2: Usamos `ultima_actualizacion` del JSON (si no se ha pedido aún, cargamos desde storage)
    if (!lastJsonUpdate) {
        lastJsonUpdate = localStorage.getItem(CONFIG.STORAGE_LAST_UPDATE);
    }

    if (!lastJsonUpdate) {
        // Si no hay fecha registrada, asumimos que se permite (primer uso)
        return { allowed: true, remaining: 0 };
    }

    const lastUpdate = new Date(lastJsonUpdate).getTime();
    const now = Date.now();
    const diff = now - lastUpdate;

    if (diff < CONFIG.COOLDOWN_MINUTES) {
        const remaining = Math.ceil((CONFIG.COOLDOWN_MINUTES - diff) / 1000);
        // Guardamos cooldownEnd para la cuenta regresiva visual
        const cooldownEnd = now + (CONFIG.COOLDOWN_MINUTES - diff);
        localStorage.setItem(CONFIG.STORAGE_COOLDOWN_END, cooldownEnd.toString());
        return { allowed: false, remaining };
    }

    return { allowed: true, remaining: 0 };
}

/**
 * Inicia un temporizador visual (actualiza cada segundo) mostrando el tiempo restante en un elemento HTML
 * @param {number} seconds segundos restantes
 * @param {string} elementId ID del elemento donde mostrar el contador
 */
function startCooldownTimer(seconds, elementId) {
    stopCooldownTimer(); // por si acaso
    let remaining = seconds;
    const display = document.getElementById(elementId);
    if (!display) return;

    display.style.display = "block";
    display.textContent = `⏳ Espera ${remaining}s para guardar cambios`;

    cooldownInterval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            stopCooldownTimer();
            display.style.display = "none";
            localStorage.removeItem(CONFIG.STORAGE_COOLDOWN_END);
            // Quizás habilitar botón de guardado
            const saveBtn = document.getElementById("btn-guardar");
            if (saveBtn) saveBtn.disabled = false;
        } else {
            display.textContent = `⏳ Espera ${remaining}s para guardar cambios`;
        }
    }, 1000);
}

function stopCooldownTimer() {
    if (cooldownInterval) {
        clearInterval(cooldownInterval);
        cooldownInterval = null;
    }
}

// ---------- ACTUALIZACIÓN DEL JSON (FUTURA) ----------
/**
 * Simulación/plantilla de cómo actualizar el archivo JSON en GitHub
 * (debe implementarse según los módulos de horario, etc.)
 * Esta función se llama al grabar cambios exitosos.
 */
async function updateJsonFile(newContent) {
    // 1. Obtener el SHA actual del archivo
    // 2. Hacer PUT a la API de GitHub con el nuevo contenido (Base64)
    // 3. Si éxito, actualizar lastJsonUpdate y localStorage
    // 4. Iniciar cooldown para todos los usuarios
    // ¡IMPORTANTE! Siempre establecer "ultima_actualizacion": new Date().toISOString()
}

// ---------- INTERFAZ DE LOGIN ----------
/**
 * Maneja el envío del formulario de login.
 * Se debe enlazar al evento submit del formulario en panel.html
 */
async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById("usuario").value.trim();
    const password = document.getElementById("contraseña").value.trim();

    if (!username || !password) {
        Swal.fire("Error", "Completa todos los campos", "warning");
        return;
    }

    // Animación de carga (GSAP opcional)
    const btn = event.target.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Verificando...";
    gsap.to(btn, { scale: 0.95, duration: 0.1 });

    try {
        const userData = await validateCredentials(username, password);
        createSession(userData);

        // SweetAlert2 de éxito
        Swal.fire({
            icon: 'success',
            title: `Bienvenido, ${userData.jerarquia}`,
            text: "Accediendo al panel de control...",
            timer: 1500,
            showConfirmButton: false
        }).then(() => {
            // Redirigir al dashboard real (si el login está en panel.html, recargamos con sesión)
            // Si login está en index.html, redirigir a panel.html
            if (window.location.pathname.includes("panel.html")) {
                location.reload(); // Ahora se mostrará el contenido protegido
            } else {
                window.location.href = "panel.html";
            }
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error de autenticación',
            text: error.message
        });
    } finally {
        btn.disabled = false;
        btn.textContent = "Ingresar";
        gsap.to(btn, { scale: 1, duration: 0.1 });
    }
}

// ---------- VISIBILIDAD SEGÚN JERARQUÍA ----------
/**
 * Aplica RBAC al DOM de panel.html ocultando/mostrando secciones según la jerarquía.
 * Se llama después de requireSession()
 * @param {string} jerarquia 
 */
function applyAccessControl(jerarquia) {
    // Definir qué elementos son visibles para cada nivel
    const rules = {
        administrador: ["admin-tools", "configuracion", "reportes", "horarios"],
        mayor: ["horarios", "reportes"],
        asp: ["horarios"],
        CDT: ["horarios", "asistencia"]
    };

    const allowedIds = rules[jerarquia] || [];
    document.querySelectorAll('.role-based').forEach(el => {
        const role = el.dataset.role;
        if (role && !allowedIds.includes(role)) {
            el.style.display = "none";
        } else {
            el.style.display = "";
        }
    });
}

// ---------- INICIALIZACIÓN PRINCIPAL ----------
/**
 * Inicializa la página protegida (panel.html o horarios.html)
 */
function initProtectedPage() {
    const session = requireSession();
    if (!session) return; // Redirigió

    // Aplicar RBAC
    applyAccessControl(session.jerarquia);

    // Verificar cooldown para futuras acciones (solo una vez al cargar)
    const cooldown = canPerformUpdate();
    if (!cooldown.allowed) {
        // Mostrar temporizador en la UI
        startCooldownTimer(cooldown.remaining, "cooldown-timer");
        // Deshabilitar botones de guardado
        const saveBtns = document.querySelectorAll(".btn-guardar");
        saveBtns.forEach(btn => btn.disabled = true);
    }

    // Mostrar bienvenida
    document.getElementById("welcome-user").textContent = session.usuario;
    document.getElementById("welcome-role").textContent = session.jerarquia.toUpperCase();
}

// ---------- EXPOSICIÓN DE FUNCIONES (si se usa módulo) ----------
// Se pueden exportar para un entorno modular, pero en vanilla script basta con que estén definidas globalmente.
// Si usas <script type="module">, puedes exportarlas.

export {
    handleLogin,
    logout,
    initProtectedPage,
    canPerformUpdate,
    startCooldownTimer,
    stopCooldownTimer
};
