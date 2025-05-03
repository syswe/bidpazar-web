import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';
import { config } from 'dotenv';

// Load test environment variables
config({ path: join(process.cwd(), '.env.test') });

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  // Drop and recreate the test database
  execSync('npx prisma db push --force-reset', {
    env: {
      ...process.env,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
    },
  });

  // Seed test data
  await seedTestData();
}

export async function seedTestData() {
  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      username: 'testuser',
      password: 'hashedpassword',
      name: 'Test User',
      isVerified: true,
    },
  });

  // Create test stream
  const testStream = await prisma.liveStream.create({
    data: {
      title: 'Test Stream',
      description: 'Test Description',
      userId: testUser.id,
      status: 'SCHEDULED',
    },
  });

  return { testUser, testStream };
}

export async function cleanupTestDatabase() {
  // Delete all data from all tables
  const tables = [
    'StreamModeration',
    'StreamAnalytics',
    'StreamHighlight',
    'StreamReward',
    'StreamShare',
    'StreamViewTime',
    'ChatMessage',
    'AuctionListing',
    'Bid',
    'LiveStream',
    'Notification',
    'Message',
    'Conversation',
    'ProductMedia',
    'Product',
    'Category',
    'User',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE;`);
  }
}

export { prisma }; 