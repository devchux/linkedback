import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifestVersion: 3,
  manifest: {
    name: "LinkedBack",
    permissions: ["storage", "alarms"],
    action: { default_title: "Open LinkedBack" },
    description: "Never lose a LinkedIn post again.",
  },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
});
