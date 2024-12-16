import { defineConfig } from "vite";
import UnoCSS from "unocss/vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), UnoCSS()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },

  //   server.middlewares.use((req, res, next) => {
  //     res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  //     res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  //     next();
  //   });
  // },
});
