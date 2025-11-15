import { defineConfig } from "vite";

const DEV_API_PORT = Number(process.env.MOTO_DEV_API_PORT) || 5174;

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/app.js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "assets/app.css";
          }
          return "assets/[name][extname]";
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: `http://localhost:${DEV_API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
