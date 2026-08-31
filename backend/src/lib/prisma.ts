import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new (PrismaClient as any)({ adapter });

// BigInt JSON serialization fix for Express res.json
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export default prisma;