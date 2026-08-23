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
        bws: resolve(__dirname, "app/bws.html"),
        landing: resolve(__dirname, "app/landing.html"),
        place: resolve(__dirname, "app/bws-place.html"),
        artist: resolve(__dirname, "app/artist.html"),
        tour: resolve(__dirname, "app/tour.html"),
        scene: resolve(__dirname, "app/scene.html"),
        review: resolve(__dirname, "app/review.html"),
        clientReview: resolve(__dirname, "app/client-review.html"),
      },
    },
  },
});
