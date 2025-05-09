import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function ensureUserInDb(emailOrUsername: string, password: string) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: emailOrUsername },
        { email: `${emailOrUsername}@test.com` },
      ],
    },
  });
  if (!user) {
    await prisma.user.create({
      data: {
        email: `${emailOrUsername}@test.com`,
        username: emailOrUsername,
        password: await bcrypt.hash(password, 10),
        isVerified: true,
        name: emailOrUsername,
      },
    });
    console.log(`Created user: ${emailOrUsername}`);
  } else {
    console.log(`User already exists: ${emailOrUsername}`);
  }
}

async function main() {
  await ensureUserInDb("streamer1", "password1");
  await ensureUserInDb("watcher1", "password2");
  await ensureUserInDb("watcher2", "password3");
  await prisma.$disconnect();
}

main().catch(console.error);
