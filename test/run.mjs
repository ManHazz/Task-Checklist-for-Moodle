// Plain-node tests for the parts that do not need a browser: node test/run.mjs
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { md5 } from '../src/md5.js';
import { parseAppRedirect, siteHashMatches, isPendingFresh } from '../src/auth.js';
import { flatten } from '../src/api.js';
import { normalise, merge, group, relative, safeUrl } from '../src/tasks.js';
import { DEFAULT_SITE as SITE, normaliseSite, originPattern } from '../src/config.js';

const norm = (e) => normalise(e, SITE);

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('md5 matches node crypto', () => {
  for (const s of ['', 'a', 'abc', 'message digest', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000), 'ünïcødé']) {
    assert.equal(md5(s), createHash('md5').update(s).digest('hex'), JSON.stringify(s).slice(0, 20));
  }
});

test('app redirect parse + site hash check', () => {
  const passport = 'abc123';
  const sitehash = createHash('md5').update(SITE + passport).digest('hex');
  const b64 = Buffer.from(`${sitehash}:::TOKEN42:::PRIV9`).toString('base64');
  const p = parseAppRedirect(`moodlemobile://token=${b64}`);
  assert.deepEqual(p, { sitehash, token: 'TOKEN42' }, 'privatetoken must be dropped');
  assert.ok(siteHashMatches(p.sitehash, passport, SITE));
  assert.ok(!siteHashMatches(p.sitehash, 'other', SITE));
  assert.ok(!siteHashMatches(p.sitehash, passport, 'https://moodle.other.edu'), 'hash is bound to the site');
  const noPriv = parseAppRedirect(`moodlemobile://token=${encodeURIComponent(Buffer.from(`${sitehash}:::T`).toString('base64'))}`);
  assert.deepEqual(noPriv, { sitehash, token: 'T' });
  assert.equal(parseAppRedirect('moodlemobile://nothing'), null);
});

test('pending login expires after 10 minutes', () => {
  const now = 1_000_000_000;
  assert.ok(isPendingFresh({ passport: 'p', started: now - 9 * 60000 }, now));
  assert.ok(!isPendingFresh({ passport: 'p', started: now - 11 * 60000 }, now));
  assert.ok(!isPendingFresh(null, now));
});

test('safeUrl only allows the configured site', () => {
  const ok = `${SITE}/mod/assign/view.php?id=1`;
  assert.equal(safeUrl(ok, SITE), ok);
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'https://evil.example/', 'https://ulearn.utp.edu.my.evil.example/', 'http://ulearn.utp.edu.my/x', '', undefined]) {
    assert.equal(safeUrl(bad, SITE), `${SITE}/my/`, String(bad));
  }
  // Site installed under a path: siblings on the same host are rejected.
  const sub = 'https://uni.example/moodle';
  assert.equal(safeUrl(`${sub}/mod/quiz/view.php?id=2`, sub), `${sub}/mod/quiz/view.php?id=2`);
  assert.equal(safeUrl('https://uni.example/moodle-evil/x', sub), `${sub}/my/`);
});

test('normaliseSite cleans user input', () => {
  assert.equal(normaliseSite('ulearn.utp.edu.my'), SITE);
  assert.equal(normaliseSite(' https://ulearn.utp.edu.my/ '), SITE);
  assert.equal(normaliseSite('https://ulearn.utp.edu.my/my/'), SITE);
  assert.equal(normaliseSite('https://ulearn.utp.edu.my/login/index.php?x=1#y'), SITE);
  assert.equal(normaliseSite('https://uni.example/moodle/course/view.php?id=3'), 'https://uni.example/moodle');
  assert.equal(normaliseSite('https://uni.example/moodle/index.php'), 'https://uni.example/moodle');
  for (const bad of ['', 'http://ulearn.utp.edu.my', 'ftp://x.y', 'https://']) {
    assert.throws(() => normaliseSite(bad), Error, bad);
  }
  assert.equal(originPattern('https://uni.example/moodle'), 'https://uni.example/*');
});

test('flatten builds PHP-style keys', () => {
  const p = flatten({ a: 1, b: true, c: { d: [5, 6] }, e: null });
  assert.equal(p.toString(), 'a=1&b=1&c%5Bd%5D%5B0%5D=5&c%5Bd%5D%5B1%5D=6');
});

const ev = (id, due, extra = {}) => ({
  id, name: `Ev ${id} is due`, activityname: `Task ${id}`, timesort: Math.floor(due / 1000),
  course: { shortname: 'CS101', fullname: 'Intro CS' }, url: `${SITE}/mod/assign/view.php?id=${id}&amp;x=1`,
  modulename: 'assign', action: { name: 'Add submission', actionable: true }, ...extra,
});

test('normalise maps Moodle event', () => {
  const t = norm(ev(7, 1_700_000_000_000));
  assert.equal(t.id, '7');
  assert.equal(t.name, 'Task 7');
  assert.equal(t.course, 'CS101');
  assert.equal(t.url, `${SITE}/mod/assign/view.php?id=7&x=1`);
  assert.equal(t.due, 1_700_000_000_000);
  assert.equal(t.actionable, true);
});

test('merge keeps done flag, marks vanished as cleared, prunes old', () => {
  const now = Date.UTC(2026, 9, 16);
  const day = 86400000;
  const stored = {
    1: { ...norm(ev(1, now + day)), done: true, onTimeline: true, firstSeen: 5 },
    2: { ...norm(ev(2, now + 2 * day)), onTimeline: true },
    3: { ...norm(ev(3, now - 40 * day)), onTimeline: true },
  };
  const next = merge(stored, [norm(ev(1, now + day))], now);
  assert.equal(next[1].done, true);
  assert.equal(next[1].firstSeen, 5);
  assert.equal(next[2].onTimeline, false);
  assert.equal(next[3], undefined);
});

test('group buckets and relative text', () => {
  const now = new Date(2026, 9, 16, 9, 0).getTime();
  const h = 3600000;
  const tasks = Object.fromEntries([
    ['a', -2 * h], ['b', 3 * h], ['c', 48 * h], ['d', 240 * h],
  ].map(([id, off]) => [id, { id, due: now + off, onTimeline: true }]));
  tasks.e = { id: 'e', due: now + h, onTimeline: false };
  const g = group(tasks, now);
  assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k, v]) => [k, v.map((t) => t.id)])),
    { overdue: ['a'], today: ['b'], week: ['c'], later: ['d'], done: ['e'] });
  assert.equal(relative(now + 90 * 60000, now), 'in 1h 30m');
  assert.equal(relative(now - 26 * h, now), '1d 2h overdue');
});

let failed = 0;
for (const [name, fn] of tests) {
  try { await fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}
console.log(failed ? `${failed} failed` : `all ${tests.length} passed`);
process.exit(failed ? 1 : 0);
