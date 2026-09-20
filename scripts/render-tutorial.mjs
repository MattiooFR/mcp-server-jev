// Render the saved, synthetic live results. This never calls an API.
import fs from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const cases = JSON.parse(await fs.readFile(new URL('examples/tutorial/cases.json', root)));
const report = JSON.parse(await fs.readFile(new URL('docs/tutorial/results.json', root)));
const clients = JSON.parse(await fs.readFile(new URL('docs/tutorial/client-results.json', root)));
const out = new URL('docs/tutorial/screens/', root);
await fs.mkdir(out, { recursive: true });
const esc = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const num = x => String(x).replace('.', ',');
const labels = { facturation: 'Facturation', technique: 'Technique', commercial: 'Commercial', autre: 'Autre', information: 'Information', achat: 'Achat', navigation: 'Navigation', comparaison: 'Comparaison', meme: 'Même entité', distinct: 'Entités distinctes', a_verifier: 'À vérifier' };
const val = a => a.type === 'choice' ? labels[a.choice] || a.choice : num(a.noul ?? a.score);
const th = a => '<tr>' + a.map(t => `<th>${esc(t)}</th>`).join('') + '</tr>';
const td = a => '<tr>' + a.map(t => `<td>${t}</td>`).join('') + '</tr>';
const table = (head, rows) => `<table><thead>${th(head)}</thead><tbody>${rows.map(td).join('')}</tbody></table>`;
const note = x => `<aside>${x}</aside>`;
const stat = (value, label) => `<div><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
const style = `*{box-sizing:border-box}body{margin:0;background:#f3f1e9;color:#172923;font-family:Arial,Helvetica,sans-serif}main{max-width:1280px;margin:auto;padding:36px 44px 24px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #c3cec6;padding-bottom:18px;font-size:14px}header b{font-size:20px;letter-spacing:-.6px}.badge{background:#dbe9d4;color:#255c32;border-radius:30px;padding:8px 13px;font-size:12px;font-weight:bold}.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:30px 0 12px;color:#62736a}h1{font-size:39px;letter-spacing:-1.5px;line-height:1.12;margin:0 0 12px;max-width:1050px}p{font-size:17px;line-height:1.5;margin:12px 0 20px;color:#4b5d54}.stats{display:flex;gap:45px;border-top:1px solid #c3cec6;border-bottom:1px solid #c3cec6;padding:20px 0;margin:22px 0}.stats strong{display:block;font-size:30px;letter-spacing:-1px}.stats span{font-size:12px;color:#5c6f62;display:block;margin-top:5px}table{border-collapse:collapse;width:100%;background:#fffdf8;border:1px solid #d5ded6;border-radius:8px;font-size:15px}th{text-align:left;background:#e6eade;padding:13px 16px;color:#4e6256;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.6px}td{padding:15px 16px;line-height:1.45;border-top:1px solid #e1e7dd;vertical-align:top}td:first-child{max-width:650px}td b{display:block;font-size:13px;margin-bottom:5px;color:#4b7960}.value{font-size:20px;font-weight:bold;white-space:nowrap}small{display:block;color:#68786c;font-size:12px;margin-top:5px}aside{background:#e5ecd9;border-left:4px solid #69914a;padding:15px 18px;margin-top:20px;font-size:16px;line-height:1.5}.warn{background:#f6e7ca;border-color:#bd8328}.split{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{background:#fffdf8;padding:20px;border:1px solid #d5ded6}.card h2{font-size:22px;margin:0 0 14px}.card p{font-size:15px}footer{margin-top:22px;font-size:11px;line-height:1.5;color:#697b6e;display:flex;justify-content:space-between;gap:20px}a{color:#28604a}pre{white-space:pre-wrap;word-break:break-word;background:#18342c;color:#e8f0da;border-radius:5px;padding:22px;font-size:15px;line-height:1.6}nav{margin-top:18px;display:flex;flex-wrap:wrap;gap:12px;font-size:12px}h3{font-size:18px;margin:12px 0}.big{font-size:56px;letter-spacing:-3px}.legend{font-size:13px;margin-top:14px}@media(max-width:700px){main{padding:22px 18px}h1{font-size:29px}.split{grid-template-columns:1fr}.stats{gap:20px;flex-wrap:wrap}table{font-size:12px}td,th{padding:10px 8px}.stats strong{font-size:25px}}`;
function page(title, intro, stats, body, active = '') {
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | Jev, tests réels</title><style>${style}</style><main><header><b>La Minute IA / Jev</b><span class="badge">API RÉELLE · DONNÉES FICTIVES</span></header><div class="eyebrow">MCP open source · essais du 20 septembre 2026</div><h1>${esc(title)}</h1><p>${esc(intro)}</p><section class="stats">${stats}</section>${body}<footer><span>Vue créée pour ce tutoriel à partir des réponses JSON enregistrées.<br>Aucun score modifié. Ce n'est pas l'interface de TypeSafe, Codex ou Claude.</span><span>mcp-server-jev 0.1.0 · jev-1.13.0<br>Les durées du tool excluent le raisonnement de l'agent.</span></footer><nav><a href="overview.html">Vue d'ensemble</a>${cases.map(c => `<a href="${c.id}.html"${active === c.id ? ' aria-current="page"' : ''}>${esc(c.id)}</a>`).join('')}<a href="clients.html">Codex + Claude</a></nav></main></html>`;
}
for (const c of cases) {
  const run = report.runs.find(r => r.case_id === c.id); const a = run.result.answers; const docs = c.input.state.documents;
  let body = '';
  if (c.id === 'support' || c.id === 'batch') {
    body = table(['Ticket', 'Service', 'Remboursement', 'Urgence / 2'], docs.slice(0, c.id === 'batch' ? 4 : 10).map(d => [
      `<b>${d.id}</b>${esc(d.text)}`, `<span class="value">${val(a[d.id + '_route'])}</span>`, `<span class="value">${val(a[d.id + '_refund'])}</span><small>Probabilité de oui</small>`, `<span class="value">${val(a[d.id + '_urgency'])}</span>`
    ]));
    body += note(c.id === 'batch' ? 'Le lot contient les 4 tickets ci-dessus, répétés 5 fois : 20 entrées, 60 questions. Trois appels mesurés : <b>521, 442 et 491 ms</b>. Médiane : <b>491 ms</b>. Ce lot répétitif ne mesure pas la précision sur 20 cas indépendants.' : 'Un seul appel renvoie les 12 réponses. La demande de remboursement est bien détectée ; elle ne déclenche aucun paiement.');
  } else if (c.id === 'intent' || c.id === 'injection') {
    body = table(['Texte transmis', 'Choix retourné', 'Confiance'], docs.map(d => [`<b>${d.id}</b>${esc(d.text)}`, `<span class="value">${val(a[d.id])}</span>`, `<span class="value">${num(a[d.id].confidence)}</span>`]));
    body += note(c.id === 'injection' ? 'Les 4 classements attendus sont obtenus sur ces exemples. Cela ne prouve pas une protection générale contre les injections.' : 'La requête Q6 reste plus ambiguë : « comparaison » reçoit une probabilité de 0,72, avec une confiance de 0,63.');
  } else if (c.id === 'leads') {
    body = table(['Prospect fictif', 'Budget ≥ 300 €', 'Délai ≤ 30 j', '≥ 5 personnes'], docs.map(d => [`<b>${d.id}</b>${esc(d.text)}`, ...['budget', 'soon', 'staff'].map(k => `<span class="value">${num(a[d.id + '_' + k].noul)}</span>`)]));
    body += '<aside class="warn">Le délai de L1 reçoit <b>0,78</b>, sous notre seuil prédéfini de <b>0,80</b>. Un seuil trop rigide écarterait ce prospect malgré la mention « ce mois-ci ». Le budget absent de L3 reste non confirmé.</aside>';
  } else if (c.id === 'editorial') {
    body = table(['Document fourni', 'Date contradictoire', 'Placeholder gênant'], docs.map(d => [`<b>${d.id} · publication ${d.published_at}</b>${esc(d.text)}`, `<span class="value">${num(a[d.id + '_date'].noul)}</span>`, `<span class="value">${num(a[d.id + '_placeholder'].noul)}</span>`]));
    body += '<aside class="warn">Le placeholder d’A3 est détecté à <b>0,90</b>. Mais A1 et A2 obtiennent <b>0,28 et 0,25</b> sur cette question, au-dessus du maximum de 0,20 attendu. Ces scores intermédiaires ne prouvent pas un outil cassé.</aside>';
  } else if (c.id === 'duplicates') {
    body = table(['Paire de fiches', 'Choix retourné', 'Confiance'], docs.map(d => [`<b>${d.id}</b>${esc(Object.values(d.a).join(' · '))}<br>${esc(Object.values(d.b).join(' · '))}`, `<span class="value">${val(a[d.id])}</span>`, `<span class="value">${num(a[d.id].confidence)}</span>`]));
    body += '<aside class="warn"><b>D4 ne passe pas notre contrôle.</b> Le modèle choisit « même entité » à 0,56, contre 0,44 pour « à vérifier ». Sa confiance est de 0,34. Deux homonymes dans une ville ne suffisent pas : aucune fusion automatique.</aside>';
  } else if (c.id === 'rubric') {
    body = table(['Message identique', 'Grille vague / 2', 'Grille précise / 2'], docs.map(d => [`<b>${d.id}</b>${esc(d.text)}`, `<span class="value">${num(a[d.id + '_vague'].score)}</span><small>Confiance ${num(a[d.id + '_vague'].confidence)}</small>`, `<span class="value">${num(a[d.id + '_precise'].score)}</span><small>Confiance ${num(a[d.id + '_precise'].confidence)}</small>`]));
    body += note('Grille vague : faible, moyenne, forte.<br>Grille précise : activité non bloquée, échéance explicite, activité bloquée sans solution de secours.<br>Sur R1, préciser le sens du score fait passer la note de <b>0,85 à 0</b>.');
  }
  const stats = stat(run.question_count, 'questions dans l’appel') + stat(run.wall_ms + ' ms', 'aller-retour MCP mesuré') + stat(run.result.usage.input_tokens.toLocaleString('fr-FR'), 'tokens en entrée') + stat(run.checks.filter(x => x.pass).length + ' / ' + run.checks.length, 'attentes prédéfinies respectées');
  await fs.writeFile(new URL(c.id + '.html', out), page(c.title, c.context, stats, body, c.id));
}
const first = report.runs.slice(0, 8);
let overview = table(['Scénario', 'Questions', 'Durée MCP', 'Contrôles respectés'], cases.map(c => {
  const r = first.find(r => r.case_id === c.id);
  return [`<a href="${c.id}.html">${esc(c.title)}</a>`, String(r.question_count), r.wall_ms + ' ms', r.checks.filter(x => x.pass).length + ' / ' + r.checks.length];
}));
overview += '<aside class="warn">Les 4 écarts sont conservés : 1 seuil de délai, 2 scores de placeholder trop élevés, 1 doublon indécidable classé à tort. Les contrôles illustrent ces exemples ; ils ne mesurent pas une précision générale du modèle.</aside>';
await fs.writeFile(new URL('overview.html', out), page('Jev dans tes agents : huit tests, résultats à l’appui', 'Tri, notation, dates, doublons et cas piégés. Les entrées, les attentes et les réponses sont disponibles dans le dépôt.', stat('8', 'scénarios fictifs') + stat('108', 'questions au premier passage') + stat('491 ms', 'médiane du lot de 60 questions') + stat('MIT', 'connecteur open source'), overview));
const cards = clients.map(c => `<div class="card"><h2>${c.client === 'codex' ? 'Codex' : 'Claude Code'}</h2><p>Un seul appel réel à <b>jev_evaluate</b>.</p><pre>${esc(JSON.stringify({ service: c.result.answers.service.choice, remboursement: Object.values(c.result.answers).find(a => a.type === 'noul').noul, urgence_sur_2: c.result.answers.urgence.score, model: c.result.model, latency_ms: c.result.latency_ms, usage: c.result.usage }, null, 2))}</pre></div>`).join('');
await fs.writeFile(new URL('clients.html', out), page('Codex et Claude appellent le même outil', 'Archive publique 0.1.0 installée dans un dossier neuf, empreinte SHA256 vérifiée. Extraits des résultats des appels, remis en forme pour la lecture.', stat('2', 'clients réellement testés') + stat('1', 'appel Jev par client') + stat('3', 'types de question dans chaque appel'), `<div class="split">${cards}</div>${note('Ticket fictif commun : « Une commande mais deux débits de 49 euros. Je demande le remboursement du doublon. » Les agents ont formulé leurs propres questions : leurs scores peuvent différer.')}`));
console.log('Rendered 10 evidence pages in docs/tutorial/screens');
