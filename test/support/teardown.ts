import { closeLocalDb } from '../../src/db/client';
import { closeTestApps } from './app';

// Each Jest worker keeps one PGlite instance and a Nest module per test; close both
// so the worker can exit cleanly instead of being killed.
afterEach(() => closeTestApps());
afterAll(() => closeLocalDb());
