import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { usersTable } from "@/db/schema";


const UserSchema = z.object({
  id: z.number(),
  name: z.string().min(1),
  age: z.coerce.number().min(1),
  birth: z.string(),
})


const BulkUserSchema = z.object({
  users: z.array(UserSchema),
})  

const DeleteSchema = z.object({
  ids: z.array(z.coerce.number()),
})


export const userRoute = new OpenAPIHono()
.openapi(
  createRoute({
  method: "get",
  path: "/users",
  summary: "Get all users",
  responses: {
    200: {
      description: "List all users",
      content: {
        "application/json": {
          schema: z.array(UserSchema),
        },
      },
      400: {
          description: 'Bad Request',
        },
        401: {
          description: 'Unauthorized',
        },
        403: {
          description: 'Forbidden',
        },
        404: {
          description: 'Customer not found',
        },
        500: {
          description: 'Internal Server Error',
        },
      },
    },
  }),
async (c) => {
  const users = await db.select().from(usersTable);
  const formatted = users.map(u => ({
    ...u,
    birth: u.birth.toString(),
  }));
  return c.json(formatted, 200);
})
.openapi(
  createRoute({
  method: "post",
  path: "/users",
  summary: "Bulk create users",
  request: {
    body: {
      content: {
        "application/json": {
          schema: BulkUserSchema,
        },
      },
      description: "Bulk create users",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            count: z.number(),
          }),
        },
      },
      description: "Users created successfully",
    },
    400: {
      description: "Invalid input"
    }
  },
}),
async (c) => {
  const { users } = c.req.valid("json");
  
  if (users.length === 0) {
    return c.json({ message: "No users to create", count: 0 }, 200);
  }
   const usersToInsert = users.map(u => ({
    name: u.name,
    age: u.age,
    birth: u.birth,
  }));

  await db.insert(usersTable).values(usersToInsert);

  return c.json({
    message: "Users created successfully",
    count: users.length,
  }, 200);
})

.openapi(
  createRoute({
  method: "delete",
  path: "/users",
  summary: "Bulk delete users",
  request: {
    body: {
      content: {
        "application/json": {
          schema: DeleteSchema,
        },
      },
      description: "Bulk delete users by IDs",
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            count: z.number(),
          }),
        },
      },
      description: "Users deleted successfully",
    },
  },
}),
async (c) => {
  const { ids } = c.req.valid("json");

  if (ids.length === 0) {
    return c.json({ message: "No users to delete", count: 0 }, 200);
  }

  await db.delete(usersTable).where(inArray(usersTable.id, ids));

  return c.json({
    message: "Users deleted successfully",
    count: ids.length,
  });
})

export default userRoute;