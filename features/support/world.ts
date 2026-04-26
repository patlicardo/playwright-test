import { setWorldConstructor, World, IWorldOptions } from '@cucumber/cucumber';
import type { Browser, Page } from 'playwright';

export class PlaywrightWorld extends World {
  browser!: Browser;
  page!: Page;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(PlaywrightWorld);
