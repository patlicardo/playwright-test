import { Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Then('I intentionally fail PT-6', async function () {
  await expect(true).toBe(false);
});
