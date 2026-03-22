import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();
const secret = "828b20104f7d6962b3b1f46b2d329b2ca"; // from .env

async function setup() {
  const userId = uuidv4();
  const username = `test_ai_${Date.now()}`;

  // Create user in DB
  try {
    await prisma.user.create({
      data: {
        id: userId,
        username: username,
        languageCode: "en",
      },
    });
  } catch (e) {
    console.log("User might already exist, proceeding...");
  }

  // Generate JWT
  const token = jwt.sign(
    {
      sub: userId,
      email: "test_ai@example.com",
      role: "authenticated",
    },
    secret,
    { expiresIn: "1h" }
  );

  console.log("USER_ID:", userId);
  console.log("JWT_TOKEN:", token);

  const fs = require('fs');
  fs.writeFileSync('tmp/token.txt', token);
  fs.writeFileSync('tmp/user_id.txt', userId);

  await prisma.$disconnect();
}

setup().catch(console.error);
