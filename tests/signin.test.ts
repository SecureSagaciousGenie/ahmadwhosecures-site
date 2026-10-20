// Author: Ahmad Shaukat
// Scenario tests for the example Conditional Access evaluation behind the sign-in panel.
// Run with: npm test  (Node 22.12 or later, which strips the TypeScript types itself)
import { evaluate, policies, type Scenario } from '../src/lib/signin.ts';

const base: Scenario = { person: 'staff', place: 'usual', device: 'laptop', app: 'mail', risk: 'none', mode: 'enforce' };

// [name, scenario changes, expected verdict, blocking policies or required controls]
const cases: [string, Partial<Scenario>, 'granted' | 'blocked', string][] = [
  ['staff, usual country, company laptop', {}, 'granted', 'MFA|Compliant device'],
  ['staff from an unexpected country', { place: 'unexpected' }, 'blocked', policies.location],
  ['unexpected country, rollout in report-only', { place: 'unexpected', mode: 'report' }, 'granted', 'MFA'],
  ['staff on a personal laptop', { device: 'personal' }, 'blocked', policies.compliant],
  ['staff on a phone', { device: 'phone' }, 'granted', 'MFA|App protection policy'],
  ['admin on the admin portal', { person: 'admin', app: 'portal' }, 'granted', 'Phishing-resistant MFA|Compliant device'],
  ['guest on a personal laptop', { person: 'guest', device: 'personal', app: 'files' }, 'granted', 'MFA'],
  ['guest from an unexpected country', { person: 'guest', place: 'unexpected' }, 'blocked', policies.location],
  ['IMAP client, even with rollout report-only', { app: 'imap', mode: 'report' }, 'blocked', policies.legacy],
  ['staff with a leaked password', { risk: 'user' }, 'granted', 'MFA|Compliant device|Secure password change'],
  ['staff with an unfamiliar sign-in', { risk: 'signin' }, 'granted', 'MFA|Compliant device|Sign-in every time'],
  [
    'admin with an unfamiliar sign-in',
    { person: 'admin', risk: 'signin' },
    'granted',
    'Phishing-resistant MFA|Compliant device|Sign-in every time',
  ],
];

let failed = 0;
for (const [name, change, verdict, detail] of cases) {
  const r = evaluate({ ...base, ...change });
  const got = r.verdict === 'blocked' ? r.blockers.map((b) => b.name).join(',') : r.requires.join('|');
  const ok = r.verdict === verdict && got === detail;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(44)} ${r.verdict.padEnd(8)} ${got}`);
}
console.log(failed ? `${failed} of ${cases.length} failed` : `all ${cases.length} passed`);
process.exitCode = failed ? 1 : 0;
