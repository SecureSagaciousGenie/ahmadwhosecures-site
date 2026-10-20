// Author: Ahmad Shaukat
// Example Conditional Access evaluation behind the sign-in panel on the home page.
// It follows how Entra ID combines policies: every policy that applies is evaluated,
// a block from any of them wins, and the grant controls of the rest add up.
// The policy set is an example built the way I build them. It is not any client's configuration.

export type Person = 'office' | 'finance' | 'leader' | 'exec' | 'admin';
export type Place = 'office' | 'away';
export type Device = 'laptop' | 'personal' | 'phone' | 'newphone';
export type App = 'mail' | 'files' | 'portal' | 'imap';
export type Risk = 'none' | 'signin' | 'user';
export type Mode = 'enforce' | 'report';

export interface Scenario {
  person: Person;
  place: Place;
  device: Device;
  app: App;
  risk: Risk;
  mode: Mode;
}

export type Gate = 'identity' | 'device' | 'place' | 'risk';
export type GateState = 'pass' | 'step' | 'block' | 'logged';

export interface Hit {
  id: string;
  name: string;
  stage: 'baseline' | 'tier';
  enforced: boolean;
  outcome: 'block' | 'grant';
  controls: string[];
  why: string;
  gate: Gate;
}

export interface Skip {
  id: string;
  name: string;
  why: string;
}

export interface GateView {
  state: GateState;
  value: string;
}

export interface Result {
  verdict: 'blocked' | 'granted';
  blockers: Hit[];
  logged: Hit[];
  hits: Hit[];
  skipped: Skip[];
  requires: string[];
  gates: Record<Gate, GateView>;
  notes: string[];
}

export const options = {
  person: [
    ['office', 'Office staff'],
    ['finance', 'Finance'],
    ['leader', 'Team leader'],
    ['exec', 'Executive'],
    ['admin', 'IT admin'],
  ],
  place: [
    ['office', 'In the office'],
    ['away', 'Away'],
  ],
  device: [
    ['laptop', 'Company laptop'],
    ['personal', 'Personal laptop'],
    ['phone', 'Approved phone'],
    ['newphone', 'New phone'],
  ],
  app: [
    ['mail', 'Outlook or Teams'],
    ['files', 'Files in a browser'],
    ['portal', 'Admin portal'],
    ['imap', 'IMAP mail client'],
  ],
  risk: [
    ['none', 'None'],
    ['signin', 'Unfamiliar sign-in'],
    ['user', 'Leaked password'],
  ],
  mode: [
    ['enforce', 'Enforced'],
    ['report', 'Report-only'],
  ],
} as const;

export const defaultScenario: Scenario = {
  person: 'finance',
  place: 'away',
  device: 'laptop',
  app: 'mail',
  risk: 'none',
  mode: 'enforce',
};

export const policyNames: Record<string, string> = {
  CA01: 'Require MFA',
  CA02: 'Admin roles: phishing-resistant MFA',
  CA03: 'Block legacy authentication',
  CA04: 'Block device code flow',
  CA05: 'Admin portals: require MFA',
  CA06: 'Office roles: office network only',
  CA07: 'Laptops: compliant company device',
  CA08: 'Finance: strictest sign-in',
  CA09: 'Phones: one approved phone, mail apps only',
  CA10: 'Office-only roles: no phone access',
  CA11: 'Risky sign-in: prove it again',
  CA12: 'Risky user: secure password change',
};

const PHONE_ROLES: Person[] = ['leader', 'exec', 'admin'];
const OFFICE_ROLES: Person[] = ['office', 'finance'];
const CONTROL_ORDER = [
  'MFA',
  'Phishing-resistant MFA',
  'Compliant company device',
  'App protection policy',
  'Secure password change',
  'Sign-in every hour',
  'Sign-in every time',
  'Monitored browser session',
];

const isPhone = (d: Device) => d === 'phone' || d === 'newphone';
const isLaptop = (d: Device) => d === 'laptop' || d === 'personal';

export function evaluate(s: Scenario): Result {
  const hits: Hit[] = [];
  const skipped: Skip[] = [];
  const tierOn = s.mode === 'enforce';

  const hit = (
    id: string,
    stage: Hit['stage'],
    outcome: Hit['outcome'],
    gate: Gate,
    why: string,
    controls: string[] = [],
  ) => hits.push({ id, name: policyNames[id], stage, enforced: stage === 'baseline' || tierOn, outcome, controls, why, gate });
  const skip = (id: string, why: string) => skipped.push({ id, name: policyNames[id], why });

  // Baseline: always enforced.
  hit('CA01', 'baseline', 'grant', 'identity', 'Everyone proves it is them with a second factor.', ['MFA']);

  if (s.person === 'admin') {
    hit(
      'CA02',
      'baseline',
      'grant',
      'identity',
      'Admin accounts sign in with a passkey or security key, never a code that can be phished.',
      ['Phishing-resistant MFA'],
    );
  } else skip('CA02', 'No admin role');

  if (s.app === 'imap') {
    hit('CA03', 'baseline', 'block', 'identity', 'IMAP, POP and basic SMTP cannot do MFA, so they are blocked for everyone.');
  } else skip('CA03', 'Modern client');

  skip('CA04', 'Not a device code sign-in');

  if (s.app === 'portal') {
    hit('CA05', 'baseline', 'grant', 'identity', 'Admin portals ask for MFA, whoever signs in.', ['MFA']);
  } else skip('CA05', 'Not an admin portal');

  // Tier policies: enforced, or report-only while a rollout is being checked.
  const officeBound = OFFICE_ROLES.includes(s.person) || (s.person === 'leader' && isLaptop(s.device));
  if (officeBound && s.place === 'away') {
    hit(
      'CA06',
      'tier',
      'block',
      'place',
      s.person === 'leader'
        ? 'Team leaders use laptops in the office. Away from it, only their approved phone gets mail.'
        : 'This role works from the office, so a sign-in from anywhere else is refused.',
    );
  } else if (!officeBound) {
    skip('CA06', s.person === 'leader' ? 'Phone sign-ins fall under CA09' : 'Role is not tied to the office');
  } else skip('CA06', 'Signing in from the office network');

  if (s.device === 'laptop') {
    hit(
      'CA07',
      'tier',
      'grant',
      'device',
      'A company laptop enrolled in Intune and passing its compliance checks.',
      ['Compliant company device'],
    );
  } else if (s.device === 'personal') {
    hit(
      'CA07',
      'tier',
      'block',
      'device',
      'A personal laptop is not enrolled, so it cannot show it is compliant. The grant control fails and access is refused.',
    );
  } else skip('CA07', 'Not a laptop');

  if (s.person === 'finance') {
    hit(
      'CA08',
      'tier',
      'grant',
      'identity',
      'Payments and supplier data: a phishing-resistant method, a fresh sign-in every hour and browser sessions that log downloads and sharing.',
      ['Phishing-resistant MFA', 'Sign-in every hour', 'Monitored browser session'],
    );
  } else skip('CA08', 'Not in finance');

  const phoneRole = PHONE_ROLES.includes(s.person);
  if (isPhone(s.device) && phoneRole) {
    if (s.device === 'newphone') {
      hit('CA09', 'tier', 'block', 'device', 'One approved phone per person. A new phone is refused until a ticket approves it.');
    } else if (s.app !== 'mail') {
      hit('CA09', 'tier', 'block', 'device', 'On a phone, company data lives in Outlook and Teams only.');
    } else {
      hit(
        'CA09',
        'tier',
        'grant',
        'device',
        'Outlook and Teams under app protection: nothing saved to the phone, nothing copied out, and IT can wipe the app.',
        ['App protection policy'],
      );
    }
  } else skip('CA09', isPhone(s.device) ? 'Role has no phone access' : 'Not a phone');

  if (isPhone(s.device) && !phoneRole) {
    hit('CA10', 'tier', 'block', 'device', 'This role has no phone access. Mail and files stay on the company laptop.');
  } else skip('CA10', isPhone(s.device) ? 'Role has phone access' : 'Not a phone');

  // Risk policies: baseline.
  if (s.risk === 'signin') {
    hit(
      'CA11',
      'baseline',
      'grant',
      'risk',
      'Unfamiliar sign-in properties raise the sign-in risk. The user proves it again with a phishing-resistant method, every time.',
      ['Phishing-resistant MFA', 'Sign-in every time'],
    );
  } else skip('CA11', 'No sign-in risk');

  if (s.risk === 'user') {
    hit(
      'CA12',
      'baseline',
      'grant',
      'risk',
      'Leaked credentials raise the user risk. Access waits for MFA and a secure password change.',
      ['MFA', 'Secure password change'],
    );
  } else skip('CA12', 'No user risk');

  const blockers = hits.filter((h) => h.outcome === 'block' && h.enforced);
  const logged = hits.filter((h) => !h.enforced);
  let requires = [...new Set(hits.filter((h) => h.outcome === 'grant' && h.enforced).flatMap((h) => h.controls))];
  if (requires.includes('Phishing-resistant MFA')) requires = requires.filter((c) => c !== 'MFA');
  requires.sort((a, b) => CONTROL_ORDER.indexOf(a) - CONTROL_ORDER.indexOf(b));

  const verdict: Result['verdict'] = blockers.length ? 'blocked' : 'granted';
  const gates = gateViews(s, hits, requires);

  const notes: string[] = [];
  if (logged.some((h) => h.outcome === 'block')) {
    const ids = logged.filter((h) => h.outcome === 'block').map((h) => h.id);
    notes.push(
      `Report-only: ${list(ids)} would have blocked this sign-in. The result goes to the sign-in log for review, and nobody is locked out while the policy is checked.`,
    );
  } else if (logged.length) {
    notes.push(`Report-only: ${list(logged.map((h) => h.id))} would add controls here. They are logged, not applied.`);
  }
  if (verdict === 'granted' && s.app === 'portal' && s.person !== 'admin') {
    notes.push('Signed in to the portal, but with no admin role there is nothing to manage.');
  }
  if (verdict === 'granted' && s.app === 'files' && s.person === 'finance') {
    notes.push('Browser sessions for finance run through session monitoring, so downloads and sharing are logged.');
  }

  return { verdict, blockers, logged, hits, skipped, requires, gates, notes };
}

function list(ids: string[]) {
  if (ids.length < 2) return ids.join('');
  return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

function gateViews(s: Scenario, hits: Hit[], requires: string[]): Record<Gate, GateView> {
  const on = (gate: Gate) => hits.filter((h) => h.gate === gate);
  const blockedOn = (gate: Gate) => on(gate).find((h) => h.outcome === 'block' && h.enforced);
  const loggedOn = (gate: Gate) => on(gate).find((h) => h.outcome === 'block' && !h.enforced);

  const identity: GateView = blockedOn('identity')
    ? { state: 'block', value: 'Legacy protocol' }
    : requires.includes('Phishing-resistant MFA')
      ? { state: 'step', value: 'Passkey or key' }
      : { state: 'step', value: 'MFA' };

  let device: GateView;
  const dBlock = blockedOn('device');
  const dLog = loggedOn('device');
  if (dBlock) {
    const value =
      dBlock.id === 'CA07'
        ? 'Not compliant'
        : dBlock.id === 'CA10'
          ? 'No phone access'
          : s.device === 'newphone'
            ? 'Phone not approved'
            : 'Mail apps only';
    device = { state: 'block', value };
  } else if (dLog) device = { state: 'logged', value: 'Would block' };
  else if (requires.includes('App protection policy')) device = { state: 'step', value: 'App protection' };
  else if (requires.includes('Compliant company device')) device = { state: 'pass', value: 'Compliant laptop' };
  else if (on('device').some((h) => !h.enforced)) device = { state: 'logged', value: 'Logged only' };
  else device = { state: 'pass', value: 'Not checked' };

  const pBlock = blockedOn('place');
  const pLog = loggedOn('place');
  const place: GateView = pBlock
    ? { state: 'block', value: 'Outside the office' }
    : pLog
      ? { state: 'logged', value: 'Would block' }
      : { state: 'pass', value: s.place === 'office' ? 'Office network' : 'Allowed away' };

  const risk: GateView =
    s.risk === 'signin'
      ? { state: 'step', value: 'Prove it again' }
      : s.risk === 'user'
        ? { state: 'step', value: 'Password change' }
        : { state: 'pass', value: 'No risk' };

  return { identity, device, place, risk };
}
