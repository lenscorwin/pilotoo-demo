import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ICI = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // Mode démo : site statique autonome, chemins relatifs pour pouvoir le
  // déposer sur un sous-domaine comme dans un sous-dossier, sans serveur.
  const demo = mode === "demo";
  return {
    root: ICI,
    base: demo ? "./" : "/",
    plugins: [react(), tailwind()],
    build: {
      outDir: path.resolve(ICI, demo ? "../../dist-demo" : "../../dist"),
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      // En développement le front tourne sur Vite, l'API reste sur le serveur Node.
      proxy: demo ? undefined : { "/api": "http://127.0.0.1:3737" },
    },
  };
});
