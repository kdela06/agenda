import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // <--- IMPORTANTE

// https://vitejs.dev/config/
export default defineConfig({
  base: "/agenda/", // Tu ruta de GitHub Pages
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'mi agenda',
        short_name: 'agenda',
        description: 'mi Agenda',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // <--- ESTO ACTIVA EL MODO APP (Sin barra de navegador)
        start_url: '.',
        icons: [
          {
            src: 'pwa-192x192.png', // ⚠️ DEBES TENER ESTA IMAGEN EN LA CARPETA PUBLIC
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // ⚠️ Y ESTA TAMBIÉN
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})