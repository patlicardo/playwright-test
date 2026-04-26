import { Before, After, setDefaultTimeout } from '@cucumber/cucumber';
import { chromium } from 'playwright';
import { PlaywrightWorld } from './world';

setDefaultTimeout(60 * 1000);

Before(async function (this: PlaywrightWorld) {
  this.browser = await chromium.launch();
  this.page = await this.browser.newPage();
});

After(async function (this: PlaywrightWorld) {
  await this.browser?.close();
});
