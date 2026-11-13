import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatsArgs, opencodeHostEnv } from '../build/opencode-cli.js';

test('stats uses boolean section flags and a single row limit', () => {
  assert.deepEqual(buildStatsArgs({ days: 7, topTools: 5 }), [
    'stats', '--days', '7', '--tools', '--limit', '5',
  ]);
  assert.deepEqual(buildStatsArgs({ topModels: 3 }), [
    'stats', '--models', '--limit', '3',
  ]);
  assert.deepEqual(buildStatsArgs({ topTools: 5, topModels: 8 }), [
    'stats', '--tools', '--models', '--limit', '8',
  ]);
});

test('stats accepts today (0 days) and project filters', () => {
  assert.deepEqual(buildStatsArgs({ days: 0, project: '.' }), [
    'stats', '--days', '0', '--project', '.',
  ]);
});

test('stats rejects invalid row counts', () => {
  assert.throws(() => buildStatsArgs({ topTools: 0 }), /topTools must be 1-100/);
  assert.throws(() => buildStatsArgs({ topModels: 101 }), /topModels must be 1-100/);
  assert.throws(() => buildStatsArgs({ days: -1 }), /days must be 0-3650/);
});

test('isolated cell home is mapped back to the login home', () => {
  const env = opencodeHostEnv({
    HOME: '/installation/data/hela-runtime',
    XDG_CONFIG_HOME: '/installation/data/hela-runtime/config',
    PATH: '/usr/bin',
  }, '/home/ubuntu');
  assert.equal(env.HOME, '/home/ubuntu');
  assert.equal(env.XDG_CONFIG_HOME, '/home/ubuntu/.config');
  assert.equal(env.XDG_DATA_HOME, '/home/ubuntu/.local/share');
  assert.equal(env.XDG_CACHE_HOME, '/home/ubuntu/.cache');
  assert.equal(env.XDG_STATE_HOME, '/home/ubuntu/.local/state');
  assert.equal(env.PATH, '/usr/bin');
});

test('normal host environments keep their existing XDG paths', () => {
  const env = opencodeHostEnv({
    HOME: '/home/dev',
    XDG_CONFIG_HOME: '/mnt/config',
    XDG_DATA_HOME: '/mnt/data',
  }, '/home/dev');
  assert.equal(env.HOME, '/home/dev');
  assert.equal(env.XDG_CONFIG_HOME, '/mnt/config');
  assert.equal(env.XDG_DATA_HOME, '/mnt/data');
});

test('explicit host overrides win over passwd defaults', () => {
  const env = opencodeHostEnv({
    HOME: '/installation/data/hela-runtime',
    OPENCODE_HOST_HOME: '/srv/opencode',
    OPENCODE_HOST_CONFIG_HOME: '/srv/opencode/config',
  }, '/home/ubuntu');
  assert.equal(env.HOME, '/srv/opencode');
  assert.equal(env.XDG_CONFIG_HOME, '/srv/opencode/config');
  assert.equal(env.XDG_DATA_HOME, '/srv/opencode/.local/share');
});
