import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "LinkedBack",
    description: "Never lose a LinkedIn post again.",
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
