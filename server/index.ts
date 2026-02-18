
import { OpenAPIHono } from "@hono/zod-openapi";
import { swaggerUI } from "@hono/swagger-ui";
import { UserApp } from "./user";

const app = new OpenAPIHono().basePath("/api");

app.doc("/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "User Batch API",
  },
});

app.get("/ui", swaggerUI({ url: "/api/doc" }));

const routes = app
.route("/", UserApp);

export type AppType = typeof routes;
export {app}
