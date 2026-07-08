/* validate.js — DQAF: referential integrity DATA→CL, duplicate detection, and the
 * statistical identities (GDP 3-method, regional reconciliation, T-account sanity).
 * Surfaces every anomaly with refs — never silently fixes or drops. */
'use strict';

const { isNum } = require('./primitives');

const EPS = 0.5; // mln GEL reconciliation tolerance (declared, not magic)

/** Structural integrity common to every dataset. */
function validateStructure(ds) {
  const report = { dataset: ds.datasetCode, obs: ds.data.length, dims: {}, checks: [], anomalies: [] };

  for (const dim of ds.dimensions) {
    if (dim === 'time') continue;
    const cl = ds.codelists[dim];
    const used = new Set(ds.data.map((o) => o[dim]));
    report.dims[dim] = used.size;
    for (const code of used) {
      if (!cl.has(code)) report.anomalies.push(`REF-INTEGRITY: ${dim}="${code}" in DATA but missing from CL_${dim.toUpperCase()}`);
    }
    for (const c of cl.conflicts) {
      report.anomalies.push(`CL conflict ${dim} code="${c.code}" ${c.field}: "${c.had}" vs "${c.got}"`);
    }
  }

  if (ds.data.some((o) => !isNum(o.obs_value))) {
    report.anomalies.push(`${ds.data.filter((o) => !isNum(o.obs_value)).length} non-numeric obs_value rows`);
  }

  const keyOf = (o) => ds.dimensions.map((d) => (d === 'time' ? o.time : o[d])).join('|');
  const seen = new Map();
  let dups = 0;
  for (const o of ds.data) {
    const k = keyOf(o);
    if (seen.has(k)) { dups++; if (dups <= 5) report.anomalies.push(`DUP series-key ${k} (${seen.get(k)} & ${o.obs_value})`); }
    else seen.set(k, o.obs_value);
  }
  if (dups) report.anomalies.push(`TOTAL duplicate series keys: ${dups}`);

  return report;
}

function checkGdpIdentity(ds, report) {
  const byYear = {};
  for (const o of ds.data) {
    if (o.approach === '_Z') continue;
    const yr = (byYear[o.time] ||= { PROD: 0, EXP: 0, INC: 0, totals: {} });
    if (o.contribution_role === 'total') { yr.totals[o.approach] = o.obs_value; continue; }
    if (o.contribution_role === 'subtract') yr[o.approach] -= o.obs_value;
    else yr[o.approach] += o.obs_value;
  }
  let pass = 0, fail = 0;
  for (const [yr, v] of Object.entries(byYear)) {
    const ref = v.totals.PROD ?? v.totals.EXP ?? v.totals.INC;
    for (const ap of ['PROD', 'EXP', 'INC']) {
      if (v.totals[ap] == null) continue;
      if (Math.abs(v[ap] - v.totals[ap]) > EPS) { fail++; report.anomalies.push(`IDENTITY ${ap} ${yr}: components ${v[ap].toFixed(2)} ≠ declared ${v.totals[ap].toFixed(2)}`); }
      else pass++;
      if (ref != null && Math.abs(v.totals[ap] - ref) > EPS) { fail++; report.anomalies.push(`IDENTITY cross-approach ${yr}: ${ap}=${v.totals[ap].toFixed(2)} ≠ ${ref.toFixed(2)}`); }
    }
  }
  report.checks.push(`GDP identity: ${pass} approach-year checks pass, ${fail} flagged (ε=${EPS})`);
}

function checkRegionalReconcile(ds, report) {
  const totalByYear = {}, sumRegByYear = {};
  for (const o of ds.data) {
    if (o.sector !== '_T') continue;
    if (o.geo === '_T') totalByYear[o.time] = o.obs_value;
    else sumRegByYear[o.time] = (sumRegByYear[o.time] || 0) + o.obs_value;
  }
  let pass = 0, fail = 0;
  for (const [yr, tot] of Object.entries(totalByYear)) {
    const s = sumRegByYear[yr] || 0;
    if (Math.abs(s - tot) > EPS) { fail++; report.anomalies.push(`TOTAL_RECONCILE ${yr}: Σregions ${s.toFixed(2)} ≠ total ${tot.toFixed(2)}`); }
    else pass++;
  }
  report.checks.push(`Regional Σregions=total: ${pass} years pass, ${fail} flagged (ε=${EPS})`);

  const regTotal = {}, regAct = {};
  for (const o of ds.data) {
    if (o.geo === '_T') continue;
    if (o.sector === '_T') (regTotal[o.geo] ||= {})[o.time] = o.obs_value;
    else { (regAct[o.geo] ||= {}); regAct[o.geo][o.time] = (regAct[o.geo][o.time] || 0) + o.obs_value; }
  }
  let gaps = 0;
  for (const geo of Object.keys(regTotal)) for (const yr of Object.keys(regTotal[geo])) {
    if (Math.abs(regTotal[geo][yr] - ((regAct[geo] && regAct[geo][yr]) || 0)) > EPS) gaps++;
  }
  report.checks.push(`Regional Σactivities vs region _T: ${gaps} region-years differ >ε (EXPECTED — activity breakdown is partial GVA; residual does not close to the regional total; informational, not an error)`);
}

function checkAccountsBalance(ds, report) {
  const sides = new Set(ds.data.map((o) => o.side));
  const ok = [...sides].every((s) => s === 'U' || s === 'R');
  report.checks.push(`T-account sides ∈ {U,R}: ${ok ? 'OK' : 'VIOLATION ' + [...sides].join(',')}`);
  report.checks.push(`T-account split: ${ds.data.filter((o) => o.side === 'U').length} Uses, ${ds.data.filter((o) => o.side === 'R').length} Resources`);
}

function validate(ds) {
  const report = validateStructure(ds);
  if (ds.datasetCode === 'GDP_ANNUAL') checkGdpIdentity(ds, report);
  if (ds.datasetCode === 'REGIONAL_GVA') checkRegionalReconcile(ds, report);
  if (ds.datasetCode === 'ACCOUNTS_SEQUENCE') checkAccountsBalance(ds, report);
  return report;
}

module.exports = { validate, EPS };
