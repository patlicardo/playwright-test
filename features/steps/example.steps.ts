import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { PlaywrightWorld } from '../support/world';

Given('I open the Playwright home page', async function (this: PlaywrightWorld) {
  await this.page.goto('https://playwright.dev/');
});

Then('the page title should contain {string}', async function (this: PlaywrightWorld, text: string) {
  await expect(this.page).toHaveTitle(new RegExp(text));
});

When('I follow the {string} link', async function (this: PlaywrightWorld, name: string) {
  await this.page.getByRole('link', { name }).click();
});

Then('I should see heading {string}', async function (this: PlaywrightWorld, name: string) {
  await expect(this.page.getByRole('heading', { name })).toBeVisible();
});
