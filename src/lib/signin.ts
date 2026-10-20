// Author: Ahmad Shaukat
// Example Conditional Access evaluation behind the sign-in panel on the home page.
// It follows how Entra ID combines policies: every policy that applies is evaluated,
// a block from any of them wins, and the grant controls of the rest add up.
// The policies are textbook ones, modelled on Microsoft's published common policy templates.
// They do not describe any organisation's configuration.

export type Person = 'staff' | 'admin' | 'guest';
export type Place = 'usual' | 'unexpected';
export type Device = 'laptop' | 'personal' | 'phone';
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
  name: string;
  stage: 'baseline' | 'rollout';
  enforced: boolean;
  outcome: 'block' | 'grant';
  controls: string[];
  why: string;
  gate: Gate;
}

export interface Skip {
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
    ['staff', 'Staff member'],
    ['admin', 'Admin'],
    ['guest', 'Guest'],
  ],
  place: [
    ['usual', 'Usual country'],
    ['unexpected', 'Unexpected country'],
  ],
  device: [
    ['laptop', 'Company laptop'],
    ['personal', 'Personal laptop'],
    ['phone', 'Phone'],
  ],
  app: [
    ['mail', 'Email'],
    ['files', 'Files'],
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
  person: 'staff',
  place: 'unexpected',
  device: 'laptop',
  app: 'mail',
  risk: 'none',
  mode: 'enforce',
};

export const policies = {
  mfa: 'MFA for all users',
  admins: 'Phishing-resistant MFA for admins',
  legacy: 'Block legacy authentication',
  deviceCode: 'Block device code flow',
  portals: 'MFA for admin portals',
  location: 'Block unexpected countries',
  compliant: 'Compliant device on laptops',
  appProtection: 'App protection on phones',
  signinRisk: 'Risky sign-in: MFA every time',
  userRisk: 'Risky user: secure password change',
} as const;

const CONTROL_ORDER = [
  'MFA',
  'Phishing-resistant MFA',
  'Compliant device',
  'App protection policy',
  'Secure password change',
  'Sign-in every time',
];

const quoted = (names: string[]) => {
  const q = names.map((n) => `"${n}"`);
  return q.length < 2 ? q.join('') : `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`;
};

export function evaluate(s: Scenario): Result {
  const hits: Hit[] = [];
  const skipped: Skip[] = [];
  const rolloutOn = s.mode === 'enforce';

  const hit = (
    name: string,
    stage: Hit['stage'],
    outcome: Hit['outcome'],
    gate: Gate,
    why: string,
    controls: string[] = [],
  ) => hits.push({ name, stage, enforced: stage === 'baseline' || rolloutOn, outcome, controls, why, gate });
  const skip = (name: string, why: string) => skipped.push({ name, why });

  const member = s.person !== 'guest';
  const laptop = s.device === 'laptop' || s.device === 'personal';

  // Baseline: always enforced.
  hit(policies.mfa, 'baseline', 'grant', 'identity', 'Every account proves it is the person with a second factor.', ['MFA']);

  if (s.person === 'admin') {
    hit(
      policies.admins,
      'baseline',
      'grant',
      'identity',
      'Admin accounts use a passkey or security key, never a code that can be phished.',
      ['Phishing-resistant MFA'],
    );
  } else skip(policies.admins, 'Not an admin account');

  if (s.app === 'imap') {
    hit(policies.legacy, 'baseline', 'block', 'identity', 'IMAP, POP and basic SMTP cannot do MFA, so they are blocked for everyone.');
  } else skip(policies.legacy, 'Modern sign-in');

  skip(policies.deviceCode, 'Not a device code sign-in');

  if (s.app === 'portal') {
    hit(policies.portals, 'baseline', 'grant', 'identity', 'Admin portals ask for MFA, whoever signs in.', ['MFA']);
  } else skip(policies.portals, 'Not an admin portal');

  // Rollout: location and device policies, enforced or in report-only while they are checked.
  if (s.place === 'unexpected') {
    hit(
      policies.location,
      'rollout',
      'block',
      'place',
      'Sign-ins from countries the organisation does not work in are refused. Travel goes through a time-limited exception.',
    );
  } else skip(policies.location, 'Usual country');

  if (member && laptop) {
    if (s.device === 'laptop') {
      hit(
        policies.compliant,
        'rollout',
        'grant',
        'device',
        'A company laptop enrolled in Intune and passing its compliance checks.',
        ['Compliant device'],
      );
    } else {
      hit(
        policies.compliant,
        'rollout',
        'block',
        'device',
        'A personal laptop is not enrolled, so it cannot show it is compliant. The grant control fails and access is refused.',
      );
    }
  } else skip(policies.compliant, member ? 'Not a laptop' : 'Guests are excluded; their devices are not ours to manage');

  if (member && s.device === 'phone') {
    hit(
      policies.appProtection,
      'rollout',
      'grant',
      'device',
      'Company data stays inside managed apps: nothing saved to the phone, nothing copied out, and the data can be wiped.',
      ['App protection policy'],
    );
  } else skip(policies.appProtection, member ? 'Not a phone' : 'Guests are excluded');

  // Risk policies: baseline.
  if (s.risk === 'signin') {
    hit(
      policies.signinRisk,
      'baseline',
      'grant',
      'risk',
      'Unfamiliar sign-in properties raise the sign-in risk, so the user proves it again, every time.',
      ['MFA', 'Sign-in every time'],
    );
  } else skip(policies.signinRisk, 'No sign-in risk');

  if (s.risk === 'user') {
    hit(
      policies.userRisk,
      'baseline',
      'grant',
      'risk',
      'Leaked credentials raise the user risk. Access waits for MFA and a secure password change.',
      ['MFA', 'Secure password change'],
    );
  } else skip(policies.userRisk, 'No user risk');

  const blockers = hits.filter((h) => h.outcome === 'block' && h.enforced);
  const logged = hits.filter((h) => !h.enforced);
  let requires = [...new Set(hits.filter((h) => h.outcome === 'grant' && h.enforced).flatMap((h) => h.controls))];
  if (requires.includes('Phishing-resistant MFA')) requires = requires.filter((c) => c !== 'MFA');
  requires.sort((a, b) => CONTROL_ORDER.indexOf(a) - CONTROL_ORDER.indexOf(b));

  const verdict: Result['verdict'] = blockers.length ? 'blocked' : 'granted';

  const notes: string[] = [];
  const loggedBlocks = logged.filter((h) => h.outcome === 'block');
  if (loggedBlocks.length) {
    notes.push(
      `Report-only: ${quoted(loggedBlocks.map((h) => h.name))} would have blocked this sign-in. The result goes to the sign-in log for review, and nobody is locked out while the policy is checked.`,
    );
  } else if (logged.length) {
    notes.push(`Report-only: ${quoted(logged.map((h) => h.name))} would add controls here. They are logged, not applied.`);
  }
  if (verdict === 'granted' && s.app === 'portal' && s.person !== 'admin') {
    notes.push('Signed in to the portal, but with no admin role there is nothing to manage.');
  }

  return { verdict, blockers, logged, hits, skipped, requires, gates: gateViews(s, hits, requires), notes };
}

function gateViews(s: Scenario, hits: Hit[], requires: string[]): Record<Gate, GateView> {
  const on = (gate: Gate) => hits.filter((h) => h.gate === gate);
  const blockedOn = (gate: Gate) => on(gate).some((h) => h.outcome === 'block' && h.enforced);
  const loggedBlockOn = (gate: Gate) => on(gate).some((h) => h.outcome === 'block' && !h.enforced);

  const identity: GateView = blockedOn('identity')
    ? { state: 'block', value: 'Legacy protocol' }
    : requires.includes('Phishing-resistant MFA')
      ? { state: 'step', value: 'Passkey or key' }
      : { state: 'step', value: 'MFA' };

  let device: GateView;
  if (blockedOn('device')) device = { state: 'block', value: 'Not compliant' };
  else if (loggedBlockOn('device')) device = { state: 'logged', value: 'Would block' };
  else if (requires.includes('App protection policy')) device = { state: 'step', value: 'App protection' };
  else if (requires.includes('Compliant device')) device = { state: 'pass', value: 'Compliant laptop' };
  else if (on('device').some((h) => !h.enforced)) device = { state: 'logged', value: 'Logged only' };
  else device = { state: 'pass', value: s.person === 'guest' ? 'Not checked for guests' : 'Not checked' };

  const place: GateView = blockedOn('place')
    ? { state: 'block', value: 'Unexpected country' }
    : loggedBlockOn('place')
      ? { state: 'logged', value: 'Would block' }
      : { state: 'pass', value: 'Usual country' };

  const risk: GateView =
    s.risk === 'signin'
      ? { state: 'step', value: 'Prove it again' }
      : s.risk === 'user'
        ? { state: 'step', value: 'Password change' }
        : { state: 'pass', value: 'No risk' };

  return { identity, device, place, risk };
}
