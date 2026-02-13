import { Redis } from "ioredis";

export const connection = new Redis({
    username: process.env.REDIS_USERNAME!,
    password: process.env.REDIS_PASSWORD!,
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT!)
})
