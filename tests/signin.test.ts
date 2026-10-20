// Author: Ahmad Shaukat
// Scenario tests for the example Conditional Access evaluation behind the sign-in panel.
// Run with: npm test  (Node 22.12 or later, which strips the TypeScript types itself)
import { evaluate, type Scenario } from '../src/lib/signin.ts';

const base: Scenario = { person: 'office', place: 'office', device: 'laptop', app: 'mail', risk: 'none', mode: 'enforce' };

// [name, scenario changes, expected verdict, blocking policies or required controls]
const cases: [string, Partial<Scenario>, 'granted' | 'blocked', string][] = [
  ['office staff, office, company laptop', {}, 'granted', 'MFA|Compliant company device'],
  ['finance away on a company laptop', { person: 'finance', place: 'away' }, 'blocked', 'CA06'],
  ['finance away, tier policies report-only', { person: 'finance', place: 'away', mode: 'report' }, 'granted', 'MFA'],
  [
    'finance in the office',
    { person: 'finance' },
    'granted',
    'Phishing-resistant MFA|Compliant company device|Sign-in every hour|Monitored browser session',
  ],
  ['office staff on an approved phone', { device: 'phone' }, 'blocked', 'CA10'],
  ['executive away, approved phone, mail', { person: 'exec', place: 'away', device: 'phone' }, 'granted', 'MFA|App protection policy'],
  ['executive, approved phone, files', { person: 'exec', device: 'phone', app: 'files' }, 'blocked', 'CA09'],
  ['team leader away on a phone', { person: 'leader', place: 'away', device: 'phone' }, 'granted', 'MFA|App protection policy'],
  ['team leader away on a laptop', { person: 'leader', place: 'away' }, 'blocked', 'CA06'],
  [
    'IT admin away, admin portal',
    { person: 'admin', place: 'away', app: 'portal' },
    'granted',
    'Phishing-resistant MFA|Compliant company device',
  ],
  ['IMAP client, even with tiers report-only', { app: 'imap', mode: 'report' }, 'blocked', 'CA03'],
  ['executive on a personal laptop', { person: 'exec', device: 'personal' }, 'blocked', 'CA07'],
  ['executive on a new phone', { person: 'exec', device: 'newphone' }, 'blocked', 'CA09'],
  ['office staff, leaked password', { risk: 'user' }, 'granted', 'MFA|Compliant company device|Secure password change'],
  [
    'office staff, unfamiliar sign-in',
    { risk: 'signin' },
    'granted',
    'Phishing-resistant MFA|Compliant company device|Sign-in every time',
  ],
];

let failed = 0;
for (const [name, change, verdict, detail] of cases) {
  const r = evaluate({ ...base, ...change });
  const got = r.verdict === 'blocked' ? r.blockers.map((b) => b.id).join(',') : r.requires.join('|');
  const ok = r.verdict === verdict && got === detail;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(42)} ${r.verdict.padEnd(8)} ${got}`);
}
console.log(failed ? `${failed} of ${cases.length} failed` : `all ${cases.length} passed`);
process.exitCode = failed ? 1 : 0;
