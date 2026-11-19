import "./setup.js";
import { after } from "node:test";
import { createServer } from "vite";

const server = await createServer({
  cacheDir: "node_modules/.vite-tests",
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
});

after(async () => {
  await server.close();
  window.close();
});

await server.ssrLoadModule("/tests/ReadingForm.test.jsx");
