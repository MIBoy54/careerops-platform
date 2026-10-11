import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
let browser;
let page;
const code = readFileSync(new URL('../../src/sessionTrendChart.js', import.meta.url), 'utf8').replaceAll('export function', 'function');
const css = readFileSync(new URL('../../src/styles/app.css', import.meta.url), 'utf8');
const report = counts => ({
  window_start: '2026-10-08T15:30:00Z', window_end: '2026-10-09T15:30:00Z',
  buckets: Array.from({ length: 12 }, (_, i) => ({
    start: new Date(Date.UTC(2026, 9, 8, 15, 30) + i * 7200000).toISOString(),
    end: new Date(Date.UTC(2026, 9, 8, 15, 30) + (i + 1) * 7200000).toISOString(), sessions: counts[i] || 0
  }))
});
beforeAll(async () => {
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  page = await browser.newPage();
  await page.setContent(`<style>${css}</style><div id="chart" class="trend-chart"></div>`);
  await page.addScriptTag({ content: code });
});
afterAll(async () => { await browser?.close(); });

describe('session trend browser regression', () => {
  it('shows actual unequal counts and zero-height bars with proportional pixel heights', async () => {
    await page.evaluate(data => renderSessionTrend(document.querySelector('#chart'), data, 'UTC'), report([0, 1, 2, 100]));
    const heights = await page.locator('.trend-bar').evaluateAll(bars => bars.map(bar => bar.getBoundingClientRect().height));
    expect(heights).toHaveLength(12);
    expect(heights[0]).toBe(0);
    expect(heights[1]).toBeGreaterThan(0);
    expect(heights[2]).toBeCloseTo(heights[1] * 2, 1);
    expect(heights[3]).toBe(160);
    expect(await page.locator('.trend-value').allTextContents()).toEqual(['0', '1', '2', '100', ...Array(8).fill('0')]);
    expect(await page.locator('.trend-window').textContent()).toContain('Now (Oct 9');
  });
  it('shows twelve zero buckets and an empty-data explanation', async () => {
    await page.evaluate(data => renderSessionTrend(document.querySelector('#chart'), data, 'UTC'), report([]));
    expect(await page.locator('.trend-bar').evaluateAll(bars => bars.every(bar => bar.getBoundingClientRect().height === 0))).toBe(true);
    expect(await page.locator('[role=status]').textContent()).toContain('No sessions started');
  });
  it('changes timezone labels across midnight without changing counts or instants', async () => {
    const data = report([2, 3]);
    await page.evaluate(data => renderSessionTrend(document.querySelector('#chart'), data, 'UTC'), data);
    const utc = await page.locator('.trend-label').first().textContent();
    await page.evaluate(data => renderSessionTrend(document.querySelector('#chart'), data, 'Asia/Tokyo'), data);
    expect(await page.locator('.trend-label').first().textContent()).toContain('Oct 9');
    expect(utc).toContain('Oct 8');
    expect(await page.locator('.trend-value').allTextContents()).toEqual(['2', '3', ...Array(10).fill('0')]);
  });
  it('distinguishes repeated DST hours with timezone names', async () => {
    const data = report([]);
    data.buckets[0].start = '2026-11-01T06:30:00Z';
    data.buckets[1].start = '2026-11-01T07:30:00Z';
    await page.evaluate(data => renderSessionTrend(document.querySelector('#chart'), data, 'America/Chicago'), data);
    const labels = await page.locator('.trend-label').allTextContents();
    expect(labels[0]).toContain('CDT');
    expect(labels[1]).toContain('CST');
  });
  it('shows loading, rejects concurrent refreshes, shows an error, and recovers', async () => {
    await page.evaluate(() => {
      window.calls = 0;
      window.load = createSessionTrendLoader(document.querySelector('#chart'), () => {
        window.calls++;
        return new Promise(resolve => { window.resolveFetch = resolve; });
      });
      window.pending = window.load();
      window.load();
    });
    expect(await page.locator('#chart').getAttribute('aria-busy')).toBe('true');
    expect(await page.locator('[role=status]').textContent()).toContain('Loading');
    expect(await page.evaluate(() => window.calls)).toBe(1);
    await page.evaluate(async () => { window.resolveFetch({ ok: false }); await window.pending; });
    expect(await page.locator('[role=alert]').textContent()).toContain('unavailable');
    expect(await page.locator('.trend-bar').count()).toBe(0);
    await page.evaluate(async data => {
      window.pending = window.load();
      window.resolveFetch({ ok: true, json: async () => data });
      await window.pending;
    }, report([4]));
    expect(await page.locator('.trend-bar').count()).toBe(12);
    expect(await page.locator('#chart').getAttribute('aria-busy')).toBe('false');
  });
});
