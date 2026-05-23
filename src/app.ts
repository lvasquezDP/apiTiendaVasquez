import { AppRoutes } from "./router";
import { Server } from "./server";

(async () => { main(); })();

async function main() {
  const server = new Server(3000);

  server.setRoutes(AppRoutes.routes);
  server.start();
}