import userRoute from "./organization";
import { OpenAPIHono } from "@hono/zod-openapi";

export const UserApp = new OpenAPIHono()
.route("/", userRoute);
