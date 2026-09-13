import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail =
    process.env.SEED_ADMIN_EMAIL ||
    (process.env.APP_USERNAME && process.env.APP_USERNAME.includes("@")
      ? process.env.APP_USERNAME
      : "admin@workplan.dev");
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || process.env.APP_PASSWORD || "admin123";
  const adminName = "Super Admin";

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: adminEmail }, { role: "SUPER_ADMIN" }],
    },
  });

  if (existing) {
    console.log(`Super Admin account already exists: ${existing.email} (Role: ${existing.role})`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const user = await prisma.user.create({
    data: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  console.log(`Successfully seeded initial Super Admin:`);
  console.log(`- Email: ${user.email}`);
  console.log(`- Role: ${user.role}`);
  console.log(`- Temporary Password: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error("Error during seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
