// Configuración de PM2 (mantiene el sitio prendido y lo reinicia si se cae o si se reinicia el servidor)
module.exports = {
  apps: [
    {
      name: "street-burger",
      script: "src/app.js",
      instances: 1, // dejar en 1: los avisos en vivo del panel viven en la memoria del proceso
      autorestart: true,
      max_memory_restart: "400M",
      env: { NODE_ENV: "production" },
    },
  ],
};
