import { PrismaPg } from '@prisma/adapter-pg';
import PrismaModule from '@prisma/client';

export const { Prisma, PrismaClient } = PrismaModule;

export function createPrisma(connectionString = process.env.DATABASE_URL) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, max: Number(process.env.DB_POOL_SIZE) || 10 }) });
}

export const prisma = createPrisma();
