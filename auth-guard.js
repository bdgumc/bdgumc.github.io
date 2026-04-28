/**
 * auth-guard.js – Guardián de Sesión Centralizado del Sistema BDG
 * =================================================================
 * Este script debe incluirse en el <head> de CUALQUIER página que requiera
 * autenticación (ej: horarios.html, administracion.html, etc.).
 *
 * Funciones críticas de seguridad:
 *   1. Verifica la existencia de una sesión válida en sessionStorage.
 *   2. Si no hay sesión (o está corrupta), redirige inmediatamente al login (panel.html).
 *   3. Implementa un temporizador de inactividad de 15 minutos.
 *      - Escucha eventos del usuario (movimiento, teclas, clicks, scroll, touch).
 *      - Si no hay actividad durante 15 min, destruye la sesión y redirige
 *        al login con un mensaje de "Sesión expirada por inactividad".
 *
 * La ofuscación de la sesión (Base64) añade una capa mínima contra miradas casuales,
 * pero NO reemplaza un backend seguro. Todo el código se ejecuta en el frontend.
 */

(function() {
  'use strict';

  // ---------------------------
  // Configuración
  // ---------------------------
  const SESSION_KEY = 'bdg_session';
  const LOGIN_URL = 'panel.html';
  const INACTIVITY_TIME = 15 * 60 * 1000; // 15 minutos en milisegundos

  // ---------------------------
  // 1. Recuperar y validar la sesión almacenada
  // ---------------------------
  function obtenerSesion() {
    const token = sessionStorage.getItem(SESSION_KEY);
    if (!token) return null;

    try {
      // Decodificar el Base64 y parsear JSON
      const sesion = JSON.parse(atob(token));
      // Validar estructura mínima (usuario, inicio)
      if (sesion && sesion.usuario && sesion.inicio) {
        return sesion;
      }
    } catch (e) {
      // Token corrupto o manipulado → limpiar y considerar inválido
      sessionStorage.removeItem(SESSION_KEY);
    }
    return null;
  }

  const sesionActiva = obtenerSesion();

  // Si no hay sesión válida, redirigir al login inmediatamente.
  // Esto impide que se renderice cualquier contenido de la página protegida.
  if (!sesionActiva) {
    // Redirección sin mostrar nada de la página
    window.location.href = LOGIN_URL;
    return; // Detiene la ejecución del resto del script
  }

  // ---------------------------
  // 2. Temporizador de inactividad
  // ---------------------------
  let temporizadorInactividad;

  function reiniciarTemporizador() {
    clearTimeout(temporizadorInactividad);
    temporizadorInactividad = setTimeout(cerrarSesionPorInactividad, INACTIVITY_TIME);
  }

  function cerrarSesionPorInactividad() {
    // Destruir la sesión y redirigir con el parámetro 'expired'
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = LOGIN_URL + '?expired=true';
  }

  // Adjuntar escuchas de actividad a los eventos globales
  function adjuntarListeners() {
    const eventosActividad = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    eventosActividad.forEach(evento => {
      window.addEventListener(evento, reiniciarTemporizador, false);
    });
    // Iniciar el temporizador por primera vez
    reiniciarTemporizador();
  }

  // Esperar a que el DOM esté listo para no interferir con la carga inicial
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', adjuntarListeners);
  } else {
    adjuntarListeners();
  }

  // Buenas prácticas: limpiar el temporizador cuando el usuario cierra/recarga
  window.addEventListener('beforeunload', () => {
    clearTimeout(temporizadorInactividad);
  });

})();
