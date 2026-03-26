import { test, expect } from '@playwright/test';

test.describe('Pairing Flow', () => {
  test('Two users can login and pair successfully', async ({ browser }) => {
    // Create two independent browser contexts
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const page1 = await user1Context.newPage();
    const page2 = await user2Context.newPage();

    // 1. User 1 Signup/Login
    await page1.goto('/auth');
    await page1.fill('input[placeholder="Username"]', 'user1_' + Date.now());
    await page1.fill('input[placeholder="Email Address"]', `user1_${Date.now()}@example.com`);
    await page1.fill('input[placeholder="Password"]', 'password123');
    await page1.fill('input[placeholder="Confirm Password"]', 'password123');
    // Switch to signup mode if needed
    if (await page1.isVisible('text=Don\'t have an account? Sign up')) {
      await page1.click('text=Don\'t have an account? Sign up');
    }
    await page1.click('button:has-text("Sign Up")');
    await expect(page1).toHaveURL('/pair', { timeout: 10000 });

    // 2. User 2 Signup/Login
    await page2.goto('/auth');
    await page2.fill('input[placeholder="Username"]', 'user2_' + Date.now());
    await page2.fill('input[placeholder="Email Address"]', `user2_${Date.now()}@example.com`);
    await page2.fill('input[placeholder="Password"]', 'password123');
    await page2.fill('input[placeholder="Confirm Password"]', 'password123');
    if (await page2.isVisible('text=Don\'t have an account? Sign up')) {
      await page2.click('text=Don\'t have an account? Sign up');
    }
    await page2.click('button:has-text("Sign Up")');
    await expect(page2).toHaveURL('/pair', { timeout: 10000 });

    // 3. User 1 generates invite code
    await page1.click('button:has-text("Generate Code")');
    const inviteCode = await page1.locator('span.font-mono').innerText();
    expect(inviteCode).toHaveLength(6);

    // 4. User 2 enters invite code
    await page2.fill('input[placeholder="e.g. A1B2C3"]', inviteCode);
    await page2.click('button:has-text("→")');

    // 5. Verify both are redirected to /chat
    await expect(page2).toHaveURL('/chat', { timeout: 15000 });
    await expect(page1).toHaveURL('/chat', { timeout: 15000 });

    await user1Context.close();
    await user2Context.close();
  });
});
