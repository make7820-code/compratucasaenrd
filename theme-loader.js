// theme-loader.js - Sincronizador global de tema y aspecto físico

(function() {
  // 1. Aplicar el tema guardado al cargar la página de inmediato (evita parpadeos)
  const savedTheme = localStorage.getItem('app_theme') || 'system';
   aplicarTemaEnDocumento(savedTheme);

  function aplicarTemaEnDocumento(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  // 2. Función global para inicializar los botones del menú desplegable en cualquier página
  window.inicializarSelectorDeTema = function() {
    const themeLightBtn = document.getElementById('themeLightBtn');
    const themeSystemBtn = document.getElementById('themeSystemBtn');
    const themeDarkBtn = document.getElementById('themeDarkBtn');

    if (!themeLightBtn || !themeSystemBtn || !themeDarkBtn) return;

    function updateThemeButtons(currentTheme) {
      [themeLightBtn, themeSystemBtn, themeDarkBtn].forEach(btn => {
        if (btn) btn.style.background = 'none';
      });
      if (currentTheme === 'light') {
        themeLightBtn.style.background = 'rgba(128, 128, 128, 0.2)';
      } else if (currentTheme === 'system') {
        themeSystemBtn.style.background = 'rgba(128, 128, 128, 0.2)';
      } else if (currentTheme === 'dark') {
        themeDarkBtn.style.background = 'rgba(128, 128, 128, 0.2)';
      }
    }

    const currentTheme = localStorage.getItem('app_theme') || 'system';
    updateThemeButtons(currentTheme);

    themeLightBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('app_theme', 'light');
      aplicarTemaEnDocumento('light');
      updateThemeButtons('light');
    });

    themeSystemBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('app_theme', 'system');
      aplicarTemaEnDocumento('system');
      updateThemeButtons('system');
    });

    themeDarkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('app_theme', 'dark');
      aplicarTemaEnDocumento('dark');
      updateThemeButtons('dark');
    });
  };

  // 3. Sincronizar automáticamente si se cambia el tema desde otra pestaña o página abierta
  window.addEventListener('storage', (event) => {
    if (event.key === 'app_theme') {
      const nuevoTema = event.newValue || 'system';
      aplicarTemaEnDocumento(nuevoTema);
      // Actualizar botones visualmente si el menú está abierto
      const currentTheme = localStorage.getItem('app_theme') || 'system';
      const themeLightBtn = document.getElementById('themeLightBtn');
      const themeSystemBtn = document.getElementById('themeSystemBtn');
      const themeDarkBtn = document.getElementById('themeDarkBtn');
      if (themeLightBtn && themeSystemBtn && themeDarkBtn) {
        [themeLightBtn, themeSystemBtn, themeDarkBtn].forEach(b => b.style.background = 'none');
        if (nuevoTema === 'light') themeLightBtn.style.background = 'rgba(128, 128, 128, 0.2)';
        if (nuevoTema === 'system') themeSystemBtn.style.background = 'rgba(128, 128, 128, 0.2)';
        if (nuevoTema === 'dark') themeDarkBtn.style.background = 'rgba(128, 128, 128, 0.2)';
      }
    }
  });
})();
