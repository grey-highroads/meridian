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
        scenes: resolve(__dirname, "app/scenes.html"),
        reviews: resolve(__dirname, "app/reviews.html"),
        landing: resolve(__dirname, "app/landing.html"),
        intelligence: resolve(__dirname, "app/intelligence.html"),
        artist: resolve(__dirname, "app/artist.html"),
        tour: resolve(__dirname, "app/tour.html"),
        scene: resolve(__dirname, "app/scene.html"),
        handoff: resolve(__dirname, "app/handoff.html"),
        direction: resolve(__dirname, "app/direction.html"),
        request: resolve(__dirname, "app/request.html"),
        admin: resolve(__dirname, "app/admin.html"),
        setPassword: resolve(__dirname, "app/set-password.html"),
      },
    },
  },
});
