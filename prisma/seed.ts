import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const password = "DemoPass!1";

const upsertUser = async (
  name: string,
  email: string,
  address: string,
  role: "ADMIN" | "NORMAL_USER" | "STORE_OWNER",
) =>
  prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name,
      email,
      address,
      role,
      emailVerified: true,
      passwordHash: await bcrypt.hash(password, 12),
    },
  });

const main = async () => {
  const admin = await upsertUser(
    "Alexandra Morgan Administrator",
    "admin@storefront.local",
    "14 Market Street, Pune, Maharashtra 411001",
    "ADMIN",
  );
  const owner = await upsertUser(
    "Priyanka Shah Store Owner",
    "owner@storefront.local",
    "28 Koregaon Park, Pune, Maharashtra 411001",
    "STORE_OWNER",
  );
  const customer = await upsertUser(
    "Rohan Deshmukh Customer User",
    "user@storefront.local",
    "6 Baner Road, Pune, Maharashtra 411045",
    "NORMAL_USER",
  );

  const store = await prisma.store.upsert({
    where: { email: "hello@harvesttable.local" },
    update: {},
    create: {
      name: "Harvest Table Market",
      email: "hello@harvesttable.local",
      address: "21 Koregaon Park, Pune, Maharashtra 411001",
      ownerId: owner.id,
    },
  });
  await prisma.store.upsert({
    where: { email: "contact@paperandpine.local" },
    update: {},
    create: {
      name: "Paper & Pine Bookstore",
      email: "contact@paperandpine.local",
      address: "8 FC Road, Pune, Maharashtra 411004",
    },
  });
  await prisma.rating.upsert({
    where: { userId_storeId: { userId: customer.id, storeId: store.id } },
    update: {},
    create: { userId: customer.id, storeId: store.id, value: 4 },
  });

  console.info(`Seeded ${admin.email}, ${owner.email}, and ${customer.email}.`);
};

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
