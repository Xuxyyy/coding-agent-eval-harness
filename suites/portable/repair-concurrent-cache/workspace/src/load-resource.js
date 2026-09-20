import {fixtureResources} from '../fixtures/data.js';
export async function loadResource(key) {
  return fixtureResources.get(key) ?? null;
}
