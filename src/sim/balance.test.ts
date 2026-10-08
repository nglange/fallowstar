/**
 * Balance harness. Runs scripted players over many seeds and checks the
 * tuning targets: a careful player usually wins with a few days to spare, a
 * careless one usually does not. Run `npm run sim` for a verbose report.
 */
import { describe, expect, it } from 'vitest';
import { runBot, type BotKind, type BotResult } from './bots';

const RUNS = Number(import.meta.env.SIM_RUNS) || 40;
const seeds = Array.from({ length: RUNS }, (_, i) => `balance-${i}`);

function summarize(kind: BotKind, results: BotResult[]): string {
  const wins = results.filter((r) => r.outcome?.result === 'won');
  const reasons: Record<string, number> = {};
  for (const r of results) {
    const k = r.outcome ? `${r.outcome.result}:${r.outcome.reason}` : 'unfinished';
    reasons[k] = (reasons[k] ?? 0) + 1;
  }
  const avg = (f: (r: BotResult) => number, rs = results) => (rs.length ? (rs.reduce((s, r) => s + f(r), 0) / rs.length).toFixed(1) : '-');
  return [
    `${kind}: ${wins.length}/${results.length} wins (${Math.round((wins.length / results.length) * 100)}%)`,
    `  outcomes ${JSON.stringify(reasons)}`,
    `  door found ${results.filter((r) => r.doorFound).length}/${results.length}`,
    `  avg days to spare on wins ${avg((r) => r.outcome!.daysToSpare, wins)}`,
    `  avg battles ${avg((r) => r.battles)}, fled ${avg((r) => r.fled)}, forages ${avg((r) => r.forages)}, days ${avg((r) => r.days)}`,
  ].join('\n');
}

describe('balance', () => {
  const careful = seeds.map((s) => runBot(s, 'careful'));
  const careless = seeds.map((s) => runBot(s, 'careless'));
  console.log(summarize('careful', careful));
  console.log(summarize('careless', careless));

  it('a careful player usually wins', () => {
    const rate = careful.filter((r) => r.outcome?.result === 'won').length / careful.length;
    expect(rate).toBeGreaterThanOrEqual(0.6);
  });

  it('a careful win leaves a few days to spare, not a month', () => {
    const wins = careful.filter((r) => r.outcome?.result === 'won');
    const avg = wins.reduce((s, r) => s + r.outcome!.daysToSpare, 0) / Math.max(1, wins.length);
    expect(avg).toBeGreaterThanOrEqual(2);
    expect(avg).toBeLessThanOrEqual(12);
  });

  it('a careless player usually does not win', () => {
    const rate = careless.filter((r) => r.outcome?.result === 'won').length / careless.length;
    expect(rate).toBeLessThanOrEqual(0.4);
  });

  it('every run terminates', () => {
    for (const r of [...careful, ...careless]) expect(r.outcome, r.seed).not.toBeNull();
  });
});
