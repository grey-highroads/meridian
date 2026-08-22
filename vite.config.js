import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "app",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "app/index.html"),
        landing: resolve(__dirname, "app/landing.html"),
        place: resolve(__dirname, "app/place.html"),
        artist: resolve(__dirname, "app/artist.html"),
      },
    },
  },
});
