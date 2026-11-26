import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: ICI,
  plugins: [react(), tailwind()],
  build: {
    outDir: path.resolve(ICI, "../../dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // En développement le front tourne sur Vite, l'API reste sur le serveur Node.
    proxy: { "/api": "http://127.0.0.1:3737" },
  },
});
