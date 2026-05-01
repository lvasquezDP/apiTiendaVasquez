import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { Pool } from "pg";


const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({
    connectionString: process.env["DATABASE_URL"] as string
  }))
}).$extends({
  result: {
  },
});
export default prisma;