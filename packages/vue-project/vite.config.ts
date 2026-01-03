import { defineConfig } from "vite";
import vueplay from "vite-plugin-vueplay";

export default defineConfig({
  plugins: [vueplay()],
  server: {
    port: 9560
  }
});
