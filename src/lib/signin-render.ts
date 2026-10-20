// Author: Ahmad Shaukat
// Renders a sign-in evaluation as HTML. Used at build time for the first view and in the
// browser when the scenario changes, so both paths produce identical markup.
// Every value is escaped, even though all of it comes from the static policy set.
import type { Gate, Hit, Result } from './signin';

const ENTITIES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

const SVG_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
const ICON_GRANTED = `${SVG_OPEN}<path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;
const ICON_BLOCKED = `${SVG_OPEN}<circle cx="12" cy="12" r="8.5"/><path d="M6 6l12 12"/></svg>`;

const GATES: [Gate, string][] = [
  ['identity', 'Who'],
  ['device', 'Device'],
  ['place', 'Place'],
  ['risk', 'Risk'],
];

const badge = (h: Hit) => {
  if (h.outcome === 'block') return h.enforced ? 'Blocks' : 'Would block';
  return h.enforced ? 'Grants' : 'Would grant';
};

export function summarise(r: Result): string {
  if (r.verdict === 'blocked') return `Blocked by policy: ${r.blockers.map((b) => b.name).join(' and ')}.`;
  return r.requires.length ? `Signed in. Requires ${r.requires.join(', ')}.` : 'Signed in.';
}

export function renderResult(r: Result): string {
  const blocked = r.verdict === 'blocked';
  const first = r.blockers[0];
  const more = r.blockers.length > 1 ? `, plus ${r.blockers.length - 1} more` : '';

  const sub = blocked
    ? `<p class="sv-sub">by policy <b>${esc(first.name)}</b>${more}</p>`
    : `<p class="sv-sub">${r.requires.length ? 'once these controls are satisfied:' : 'with no extra controls.'}</p>` +
      (r.requires.length ? `<ul class="sv-reqs">${r.requires.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '');

  const verdict =
    `<div class="sv" data-verdict="${r.verdict}">` +
    `<p class="sv-label">Decision</p>` +
    `<p class="sv-main">${blocked ? ICON_BLOCKED : ICON_GRANTED}${blocked ? 'Blocked' : 'Signed in'}</p>` +
    sub +
    `</div>`;

  const gates =
    `<ol class="sg" aria-label="The four checks">` +
    GATES.map(
      ([g, label]) =>
        `<li data-state="${r.gates[g].state}"><span class="sg-k">${label}</span><span class="sg-v">${esc(r.gates[g].value)}</span></li>`,
    ).join('') +
    `</ol>`;

  const notes = r.notes.length ? `<div class="sim-notes">${r.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : '';

  const trace =
    `<p class="st-title">Policies that applied: ${r.hits.length}</p>` +
    `<ol class="st-list">` +
    r.hits
      .map(
        (h, n) =>
          `<li class="st" data-outcome="${h.outcome}" data-enforced="${h.enforced}" style="--n:${n}">` +
          `<p class="st-head"><span class="st-name">${esc(h.name)}</span><span class="st-badge">${badge(h)}</span></p>` +
          `<p class="st-why">${esc(h.why)}</p></li>`,
      )
      .join('') +
    `</ol>`;

  const skipped =
    `<details class="sim-skip"><summary>Did not apply: ${r.skipped.length}</summary><ul>` +
    r.skipped.map((s) => `<li>${esc(s.name)} <em>(${esc(s.why)})</em></li>`).join('') +
    `</ul></details>`;

  return verdict + gates + notes + trace + skipped;
}
