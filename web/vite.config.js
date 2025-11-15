import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEV_API_PORT = Number(process.env.MOTO_DEV_API_PORT) || 5174;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        admin: resolve(__dirname, "index.html"),
        race: resolve(__dirname, "race.html"),
      },
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "assets/[name].css";
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
