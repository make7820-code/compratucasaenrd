<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Propiedades | Compra tu casa en RD</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700;800&display=swap" rel="stylesheet">
    <!-- FontAwesome para los iconos sociales exactos -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <!-- Hoja de Estilos -->
    <link rel="stylesheet" href="styles.css">
    <style>
      /* ================= VARIABLES Y TEMAS (CLARO / OSCURO) ================= */
      :root {
        --bg-main: #0b0b0e;
        --bg-card: #121214;
        --bg-dropdown: #18181b;
        --bg-input: rgba(24, 24, 27, 0.8);
        --text-main: #fff;
        --text-muted: #a1a1aa;
        --border-color: rgba(255, 255, 255, 0.1);
        --filter-sidebar-bg: rgba(18, 18, 20, 0.85);
      }

      [data-theme="light"] {
        --bg-main: #f4f4f5;
        --bg-card: #ffffff;
        --bg-dropdown: #ffffff;
        --bg-input: #f1f1f3;
        --text-main: #18181b;
        --text-muted: #52525b;
        --border-color: rgba(0, 0, 0, 0.1);
        --filter-sidebar-bg: rgba(255, 255, 255, 0.9);
      }

      /* Fondo general de la página */
      body {
        background-color: var(--bg-main);
        margin: 0;
        color: var(--text-main);
        transition: background-color 0.3s, color 0.3s;
      }

      /* Contenedor principal con fondo fijo de la Plaza de la Bandera */
      .main-page-wrapper {
        position: relative;
        background-image: url('assets/hero-plaza-bandera.jpg');
        background-size: cover;
        background-position: center center;
        background-repeat: no-repeat;
        background-attachment: fixed;
        min-height: 100vh;
        width: 100%;
      }

      /* Capa oscura translúcida única para todo el contenedor principal */
      .main-page-wrapper::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.65);
        z-index: 1;
        pointer-events: none;
      }

      /* Ajustes del banner superior para modo claro */
      [data-theme="light"] .main-page-wrapper::before {
        background: rgba(244, 244, 245, 0.75);
      }

      .properties-hero {
        background: transparent !important;
        border: none !important;
      }

      .properties-hero-overlap,
      .properties-layout-overlap {
        position: relative;
        z-index: 2;
      }

      .properties-hero-overlap {
        padding-top: 50px;
        padding-bottom: 100px;
      }

      [data-theme="light"] .hero-eyebrow {
        background: rgba(0, 0, 0, 0.05) !important;
        color: #18181b !important;
        border: 1px solid rgba(0, 0, 0, 0.1) !important;
      }

      [data-theme="light"] .hero-title {
        color: #18181b !important;
        text-shadow: none !important;
      }

      [data-theme="light"] .hero-subtitle {
        color: #52525b !important;
        text-shadow: none !important;
      }

      /* Contenedor principal de filtros y propiedades */
      .properties-layout-overlap {
        display: flex;
        gap: 30px;
        max-width: 1400px;
        margin: -70px auto 60px auto;
        padding: 0 20px;
      }

      /* Franja lateral gris translúcida para los filtros */
      .filters-sidebar {
        width: 320px;
        flex-shrink: 0;
        background: var(--filter-sidebar-bg);
        backdrop-filter: blur(12px);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        padding: 24px;
        height: fit-content;
        box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      }

      .properties-content-area {
        flex-grow: 1;
      }

      .filter-group {
        margin-bottom: 20px;
      }

      .filter-group label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--text-muted);
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .filter-group input, .filter-group select {
        width: 100%;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        color: var(--text-main);
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }

      .filter-group input:focus, .filter-group select:focus {
        border-color: #ef4444;
      }

      .filter-row {
        display: flex;
        gap: 10px;
      }

      .properties-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
        gap: 24px;
      }

      .property-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: 20px;
        overflow: hidden;
        transition: transform 0.2s, box-shadow 0.2s, background-color 0.3s;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      }

      .property-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 15px 35px rgba(0,0,0,0.3);
      }

      /* ================= ESTILOS DEL CARRUSEL DE LA TARJETA ================= */
      .property-img-container {
        position: relative;
        height: 220px;
        background: #1e1e24;
        overflow: hidden;
      }

      .property-carousel-track {
        display: flex;
        width: 100%;
        height: 100%;
        transition: transform 0.4s ease-in-out;
      }

      .property-carousel-slide {
        min-width: 100%;
        height: 100%;
        flex-shrink: 0;
      }

      .property-carousel-slide img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      /* Botones de navegación del carrusel (Flechas) */
      .property-carousel-btn {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        background: rgba(0, 0, 0, 0.6);
        color: #fff;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s, background 0.2s;
        z-index: 5;
        backdrop-filter: blur(4px);
      }

      .property-img-container:hover .property-carousel-btn {
        opacity: 1;
      }

      .property-carousel-btn:hover {
        background: rgba(239, 68, 68, 0.8);
      }

      .property-carousel-prev {
        left: 10px;
      }

      .property-carousel-next {
        right: 10px;
      }

      /* Indicadores de puntos (Dots) en la parte inferior de la imagen */
      .property-carousel-dots {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        z-index: 5;
      }

      .property-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.4);
        cursor: pointer;
        transition: background 0.2s, transform 0.2s;
      }

      .property-dot.active {
        background: #fff;
        transform: scale(1.3);
      }

      .property-badge-top {
        position: absolute;
        top: 12px;
        left: 12px;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        z-index: 5;
      }

      .property-actions-top {
        position: absolute;
        top: 12px;
        right: 12px;
        display: flex;
        gap: 8px;
        z-index: 5;
      }

      .property-action-icon {
        background: rgba(0, 0, 0, 0.6);
        border: none;
        color: #fff;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(4px);
        transition: transform 0.1s;
      }

      .property-action-icon:active {
        transform: scale(0.9);
      }

      .property-body {
        padding: 20px;
      }

      .property-type {
        font-size: 12px;
        text-transform: uppercase;
        color: var(--text-muted);
        font-weight: 700;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
      }

      .property-title {
        font-size: 18px;
        font-weight: 700;
        color: var(--text-main);
        margin-bottom: 8px;
      }

      .property-title a {
        color: var(--text-main);
        text-decoration: none;
        transition: color 0.2s;
      }

      .property-title a:hover {
        color: #ef4444;
      }

      .property-location {
        font-size: 13px;
        color: var(--text-muted);
        margin-bottom: 14px;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .property-price {
        font-size: 22px;
        font-weight: 800;
        color: #10b981;
        margin-bottom: 16px;
      }

      .property-footer-info {
        display: flex;
        gap: 16px;
        border-top: 1px solid var(--border-color);
        padding-top: 14px;
        font-size: 13px;
        color: var(--text-muted);
      }

      /* Estilos para el menú flotante del perfil y notificaciones */
      .profile-dropdown-menu {
        display: none;
        position: absolute;
        right: 0;
        top: 50px;
        background: var(--bg-dropdown);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        width: 260px;
        z-index: 1000;
        padding: 12px;
        overflow: hidden;
      }

      .profile-dropdown-menu.show {
        display: block;
      }

      .profile-dropdown-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px 14px;
        color: var(--text-main);
        text-decoration: none;
        background: none;
        border: none;
        font-size: 14px;
        font-weight: 500;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s;
        text-align: left;
      }

      .profile-dropdown-item:hover {
        background: rgba(128, 128, 128, 0.1);
      }

      .profile-dropdown-divider {
        height: 1px;
        background: var(--border-color);
        margin: 8px 0;
      }

      .profile-dropdown-item.logout {
        color: #ef4444;
      }

      .profile-dropdown-item.logout:hover {
        background: rgba(239, 68, 68, 0.1);
      }

      /* Campanita y contenedor de acciones derechas en el header */
      .header-right-actions {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .notification-bell-wrapper {
        position: relative;
      }

      .notification-bell-btn {
        background: transparent;
        border: none;
        color: var(--text-main);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        position: relative;
        font-size: 20px;
      }

      .notification-badge {
        position: absolute;
        top: -2px;
        right: -2px;
        background: #ef4444;
        color: #fff;
        font-size: 10px;
        font-weight: 700;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--bg-card);
      }

      .notification-dropdown {
        display: none;
        position: absolute;
        right: 0;
        top: 50px;
        background: var(--bg-dropdown);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        width: 320px;
        z-index: 1000;
        overflow: hidden;
      }

      .notification-dropdown.show {
        display: block;
      }

      .notification-header {
        padding: 14px 16px;
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .notification-header h4 {
        margin: 0;
        color: var(--text-main);
        font-size: 14px;
        font-weight: 700;
      }

      .notification-list {
        max-height: 280px;
        overflow-y: auto;
      }

      .notification-item {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
        color: var(--text-muted);
        font-size: 13px;
        text-decoration: none;
        display: block;
        transition: background 0.2s;
      }

      .notification-item:hover {
        background: rgba(128, 128, 128, 0.1);
        color: var(--text-main);
      }

      /* ================= FOOTER / BANNER INFERIOR ================= */
      .site-footer {
        background-color: #000000;
        color: #a1a1aa;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        padding: 60px 20px 20px 20px;
        position: relative;
        z-index: 2;
        transition: background-color 0.3s, color 0.3s;
      }

      [data-theme="light"] .site-footer {
        background-color: #e4e4e7;
        color: #52525b;
        border-top: 1px solid rgba(0, 0, 0, 0.1);
      }

      [data-theme="light"] .footer-col-title,
      [data-theme="light"] .footer-brand-title {
        color: #18181b !important;
      }

      [data-theme="light"] .footer-brand-desc,
      [data-theme="light"] .footer-links a,
      [data-theme="light"] .footer-contact-list li,
      [data-theme="light"] .footer-bottom,
      [data-theme="light"] .footer-bottom-links a {
        color: #52525b !important;
      }

      [data-theme="light"] .footer-social-icon {
        background: #ffffff;
        border: 1px solid rgba(0, 0, 0, 0.1);
        color: #18181b;
      }

      [data-theme="light"] .footer-social-icon:hover {
        background: #ef4444;
        color: #ffffff;
        border-color: #ef4444;
      }

      .footer-container {
        max-width: 1400px;
        margin: 0 auto;
        display: grid;
        grid-template-columns: 2fr 1fr 1fr 1.5fr;
        gap: 40px;
        padding-bottom: 40px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      [data-theme="light"] .footer-container {
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      .footer-col-title {
        color: #fff;
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 20px;
        letter-spacing: 0.5px;
      }

      .footer-brand-title {
        color: #fff;
        font-size: 24px;
        font-weight: 800;
        margin-bottom: 14px;
      }

      .footer-brand-title .highlight-red {
        color: #ef4444;
      }

      .footer-brand-desc {
        font-size: 14px;
        line-height: 1.6;
        color: #a1a1aa;
        margin-bottom: 20px;
      }

      .footer-socials {
        display: flex;
        gap: 12px;
      }

      .footer-social-icon {
        background: #121214;
        border: 1px solid rgba(255, 255, 255, 0.05);
        color: #fff;
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        font-size: 16px;
        transition: all 0.2s;
      }

      .footer-links {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .footer-links li {
        margin-bottom: 12px;
      }

      .footer-links a {
        color: #a1a1aa;
        text-decoration: none;
        font-size: 14px;
        transition: color 0.2s;
      }

      .footer-links a:hover {
        color: #ef4444;
      }

      .footer-contact-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .footer-contact-list li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        font-size: 14px;
        color: #a1a1aa;
        margin-bottom: 14px;
      }

      .footer-contact-list .contact-icon {
        font-size: 16px;
        flex-shrink: 0;
      }

      .footer-email {
        color: #3b82f6;
        text-decoration: none;
      }

      .footer-email:hover {
        text-decoration: underline;
      }

      .footer-bottom {
        max-width: 1400px;
        margin: 0 auto;
        padding-top: 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 13px;
        color: #71717a;
      }

      .footer-bottom-links {
        display: flex;
        gap: 20px;
      }

      .footer-bottom-links a {
        color: #71717a;
        text-decoration: none;
        transition: color 0.2s;
      }

      .footer-bottom-links a:hover {
        color: #fff;
      }

      @media(max-width: 900px) {
        .properties-layout-overlap {
          flex-direction: column;
        }
        .filters-sidebar {
          width: 100%;
        }
        .footer-container {
          grid-template-columns: 1fr;
          gap: 30px;
        }
        .footer-bottom {
          flex-direction: column;
          gap: 10px;
          text-align: center;
        }
      }
    </style>
    <!-- SCRIPT GLOBAL DE CARGA DE TEMA -->
    <script src="theme-loader.js"></script>
</head>
