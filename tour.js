/* Skippable first-visit tour. Re-open any time with the "Take the tour" button. */
(() => {
const KEY = 'meetings-explorer-tour-v1';
const STEPS = [
 {t:'Welcome',b:'This explorer links diplomatic <b>meetings</b> to the <b>documents</b> their sources mention and to the saved <b>source texts</b>. Every finding can be traced back to its evidence. This 1-minute tour covers the main controls; skip it any time with Esc.'},
 {el:'#stats',t:'Live totals',b:'These three counts always describe what is currently matched: related meetings, documents and sources. They change as you search and filter.'},
 {el:'.timeline',t:'Meetings per month',b:'Bar height shows how many matching meetings fall in each month. Hover a bar for the month. The chart narrows with your filters, so it shows when a country, official or topic was most active.'},
 {el:'.view-switch',t:'Three ways to look at the data',b:'<b>Meetings</b>: who met whom. <b>Documents</b>: memos, joint statements and other documents mentioned in sources, with the exact sentences. <b>Sources &amp; full text</b>: search the saved pages, titles and snippets directly. Filters and search carry across views.'},
 {el:'.search',t:'Search',b:'Type names, places or keywords. Search ignores case and accents, and <b>every word you enter must match the same record</b>, so adding words narrows results. Matches are highlighted.'},
 {el:'#filters',t:'Filters that work together',b:'Pick several values in each menu. Filters combine and <b>narrow each other</b>: choose a country and the Official menu lists only officials who met someone from it. Menus after Meeting status (document type, availability, connection, review, source coverage) refine the Documents and Sources views. Selected filters appear as chips below; click a chip to remove it.'},
 {el:'.side',max:260,t:'Quick filters',b:'These panels rank topics, officials and countries among the current results. <b>Click a bar to filter</b> by it; click again to undo.'},
 {el:'.toolbar',t:'Sort, share and export',b:'Change the sort order, <b>copy a link</b> that restores your exact view (view, search, filters, open record), or <b>export all matching results</b> as CSV, including the evidence.'},
 {el:'#list',t:'Results and evidence',b:'<b>Click a title to expand it.</b> A meeting shows its counterparts, what the source says, its sources and document references. Names in blue jump to the related meeting, document or source. Note: document links are automated extractions marked <i>Needs review</i>, and a document mentioned in a source may be background context rather than something discussed at that meeting.',max:260},
];
let i = 0, root, spot, card, target;
const $ = s => document.querySelector(s);
const seen = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const mark = () => { try { localStorage.setItem(KEY, '1'); } catch {} };

function place() {
 const s = STEPS[i]; target = s.el && $(s.el);
 let r = target ? target.getBoundingClientRect() : null;
 if (r) {
  const h = Math.min(r.height, s.max || 1e9), pad = 8;
  Object.assign(spot.style, {display:'block', top:r.top-pad+'px', left:r.left-pad+'px', width:r.width+2*pad+'px', height:h+2*pad+'px'});
 } else spot.style.display = 'none';
 root.firstChild.style.background = r ? '' : 'rgba(15,18,25,.62)';
 const cw = Math.min(380, innerWidth - 24), ch = card.offsetHeight;
 let top, left = Math.max(12, Math.min(innerWidth - cw - 12, r ? r.left : (innerWidth - cw) / 2));
 if (!r) top = Math.max(12, (innerHeight - ch) / 2);
 else {
  const bottom = Math.min(r.bottom, r.top + (s.max || 1e9)) + 16;
  top = bottom + ch < innerHeight ? bottom : (r.top - ch - 16 > 0 ? r.top - ch - 16 : Math.max(12, innerHeight - ch - 12));
 }
 Object.assign(card.style, {width:cw+'px', top:top+'px', left:left+'px'});
}
function show() {
 const s = STEPS[i], last = i === STEPS.length - 1;
 card.innerHTML = `<div class="tour-n">Step ${i+1} of ${STEPS.length}</div><h2>${s.t}</h2><p>${s.b}</p>
  <div class="tour-btns"><button data-t="skip" class="tour-skip">${last ? '' : 'Skip tour'}</button><span>${i ? '<button data-t="back">Back</button>' : ''}<button data-t="next" class="tour-go">${last ? 'Start exploring' : 'Next'}</button></span></div>`;
 const t = s.el && $(s.el);
 if (t) t.scrollIntoView({block:s.max?'start':'center',behavior:'instant'});
 requestAnimationFrame(() => { place(); card.querySelector('.tour-go').focus({preventScroll:true}); });
}
function end() { mark(); root.remove(); removeEventListener('resize', place); removeEventListener('scroll', place, true); removeEventListener('keydown', key); $('#tour-open')?.focus(); }
function key(e) { if (e.key === 'Escape') end(); else if (e.key === 'ArrowRight') go(1); else if (e.key === 'ArrowLeft') go(-1); }
function go(d) { if (i + d >= STEPS.length) return end(); i = Math.max(0, i + d); show(); }
function start() {
 if ($('#tour')) return;
 i = 0; root = document.createElement('div'); root.id = 'tour';
 root.innerHTML = '<div class="tour-block"></div><div class="tour-spot"></div><div class="tour-card" role="dialog" aria-modal="true" aria-label="Explorer tour"></div>';
 document.body.append(root); spot = root.querySelector('.tour-spot'); card = root.querySelector('.tour-card');
 card.onclick = e => { const a = e.target.dataset.t; if (a === 'next') go(1); else if (a === 'back') go(-1); else if (a === 'skip') end(); };
 addEventListener('resize', place); addEventListener('scroll', place, true); addEventListener('keydown', key);
 show();
}
const btn = $('#tour-open'); if (btn) btn.onclick = start;
if (!seen()) start();
})();
