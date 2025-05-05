import 'dotenv/config';
import { test, expect, Browser, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to ensure a user exists in the DB (directly via Prisma)
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
  }
}

// Utility to log in a user (matches your login form)
async function login(page: Page, emailOrUsername: string, password: string) {
  await page.context().clearCookies();
  await page.goto('http://localhost:3000/login');
  await page.fill('input[name="emailOrUsername"]', emailOrUsername);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|home/);
}

test.beforeAll(async () => {
  await ensureUserInDb('streamer1', 'password1');
  await ensureUserInDb('watcher1', 'password2');
  await ensureUserInDb('watcher2', 'password3');
});

test('Live stream auction flow: streamer, watchers, auction, bids', async ({ browser }) => {
  // --- Streamer logs in and creates a live stream ---
  const streamerContext = await browser.newContext();
  const streamerPage = await streamerContext.newPage();
  await login(streamerPage, 'streamer1', 'password1');
  await streamerPage.goto('http://localhost:3000/live-streams/create');
  await streamerPage.waitForSelector('input[name="title"]', { timeout: 10000 });
  await streamerPage.fill('input[name="title"]', 'Test Live Auction');
  await streamerPage.fill('textarea[name="description"]', 'Automated test stream');
  await streamerPage.click('button[type="submit"]');
  // Wait for redirect to the new stream page
  await streamerPage.waitForURL(/\/live-streams\/[\w-]+/);
  const streamUrl = streamerPage.url();
  
  // Wait for the page to load and stabilize
  // Look for the heading that should appear for the streamer when the stream is in SCHEDULED state
  await streamerPage.waitForSelector('text=Yayına Başlamaya Hazır Mısın?', { timeout: 30000 });

  // Now wait for the button to be enabled and visible
  const startButton = streamerPage.locator('button:has-text("Yayını Başlat")');
  await startButton.waitFor({ state: 'visible', timeout: 10000 });
  await expect(startButton).toBeEnabled();
  await startButton.click();

  // Now wait for the WebRTC video and stream title to be visible
  await streamerPage.waitForSelector('video', { timeout: 30000 });
  await streamerPage.waitForSelector('text=Yayın Başlığı', { timeout: 10000 });

  // --- 3 watchers join (2 logged-in, 1 anonymous) ---
  const watcherContexts = await Promise.all([1,2,3].map(() => browser.newContext()));
  const watcherPages = await Promise.all(watcherContexts.map(ctx => ctx.newPage()));

  // Log in 2 watchers
  await login(watcherPages[0], 'watcher1', 'password2');
  await login(watcherPages[1], 'watcher2', 'password3');
  // 3rd watcher stays anonymous

  // All watchers go to the stream
  for (const page of watcherPages) {
    await page.goto(streamUrl);
    await expect(page).toHaveURL(streamUrl);
    await page.waitForSelector('video', { timeout: 30000 }); // Wait for video/WebRTC
    await page.waitForSelector('text=Yayın Başlığı', { timeout: 10000 }); // Wait for stream title
  }

  // --- Streamer adds a product auction (simulate via UI if possible) ---
  // You may need to adjust selectors and flow here to match your real UI for adding a product/auction in the live stream
  // Example (pseudo-selectors):
  // await streamerPage.click('button#add-product');
  // await streamerPage.fill('input[name="productTitle"]', 'Test Product');
  // await streamerPage.fill('textarea[name="productDescription"]', 'Test product for auction');
  // await streamerPage.fill('input[name="startPrice"]', '100');
  // await streamerPage.setInputFiles('input[type="file"]', 'src/tests/mocks/test-image.jpg');
  // await streamerPage.fill('input[name="countdown"]', '60');
  // await streamerPage.click('button#confirm-add-product');
  // await expect(streamerPage.locator('text=Test Product')).toBeVisible();

  // --- 2 watcher clients place bids (adjust selectors to match BiddingInterface) ---
  // Example:
  // await watcherPages[0].fill('input[type="number"]', '120');
  // await watcherPages[0].click('button[type="submit"]');
  // await watcherPages[1].fill('input[type="number"]', '130');
  // await watcherPages[1].click('button[type="submit"]');

  // --- Streamer starts the countdown (if applicable) ---
  // await streamerPage.click('button#start-countdown');
  // await expect(streamerPage.locator('text=Countdown:')).toBeVisible();

  // --- Wait for auction to end and check winner/notifications (adjust as needed) ---
  // await streamerPage.waitForSelector('text=Auction ended', { timeout: 70000 });
  // await expect(streamerPage.locator('text=Winner: watcher2')).toBeVisible();
  // await expect(watcherPages[1].locator('text=You won the auction')).toBeVisible();
  // await expect(watcherPages[0].locator('text=You are a backup bidder')).toBeVisible();

  // --- Clean up ---
  await streamerContext.close();
  for (const ctx of watcherContexts) await ctx.close();
}); 