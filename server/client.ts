import { hc } from 'hono/client'
import type { AppType } from "@/server"
export const client = hc<AppType>(process.env.NEXT_PUBLIC_APP_URL!)

export type ClientType = typeof client
