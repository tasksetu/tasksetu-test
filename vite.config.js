import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from 'tailwindcss';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: "./client",
  build: {
    outDir: "../dist/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000, // Increase chunk size warning limit to 2MB
  },
  cacheDir: path.resolve(__dirname, "node_modules/.vite"),
  server: {
    allowedHosts: [
      "25b3cec7-b6b2-48b7-a8f4-7ee8a9c12574-00-36vzyej2u9kbm.kirk.replit.dev",
      ".replit.dev",
      "localhost",
    ],
    host: "0.0.0.0",
    port: 5173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
      "@shared": path.resolve(__dirname, "./shared"),
      // Feature-based aliases for improved architecture
      "@features": path.resolve(__dirname, "./client/src/features"),
      "@features-shared": path.resolve(__dirname, "./client/src/features/shared"),
      "@features-dashboard": path.resolve(__dirname, "./client/src/features/dashboard"),
      "@features-tasks": path.resolve(__dirname, "./client/src/features/tasks"),
      "@features-calendar": path.resolve(__dirname, "./client/src/features/calendar"),
      "@features-auth": path.resolve(__dirname, "./client/src/features/auth"),
      // Force single React instance
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
    // Ensure single React instance
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
  },
});
