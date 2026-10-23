/* Meetings, document evidence, and source corpus share the same filter state. */
(() => {
const $ = id => document.getElementById(id), PAGE = 40;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nice = value => String(value || '').replace(/_/g,' ').replace(/^./, c => c.toUpperCase());
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const catalog = window.DOCUMENTS || {documents:[],meeting_ids:[]};
const corpus = window.SOURCES || {sources:[]};
const M = DATA.meetings, D = catalog.documents, S = corpus.sources;
const byMeeting = new Map(), byDocument = new Map(D.map(d => [d.id,d])), bySource = new Map(S.map(s => [s.url,s]));
const colors = ['#2f5d8a','#c8553d','#3a8f6b','#d39b2a','#8e5ba8','#c26a8f','#4f8fb8','#7a8b3c','#a0663a','#8a8f99'];
const TC = Object.fromEntries(DATA.topics.map((t,i) => [t,colors[i % colors.length]]));
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const typeLabel = value => ({memorandum:'Memo / MoU',diplomatic_cable:'Diplomatic cable',official_readout:'Official readout',joint_instrument:'Declaration / joint statement',letter_or_exchange:'Letter / exchange',framework_or_plan:'Framework / plan'}[value] || nice(value));
const connectionLabel = value => ({explicit:'Explicit meeting connection',background:'Background reference in a meeting source',source_document:'Source is the document'}[value] || nice(value));
const availabilityLabel = value => ({text_available:'Document text available',mentioned_only:'Mentioned only',unknown:'Availability unknown'}[value] || nice(value));
const coverageLabel = value => ({full_text:'Body text saved',snippet_only:'Snippet only',unavailable:'Title / URL only'}[value] || nice(value));
M.forEach((m,i) => { m.id = m.id || catalog.meeting_ids[i] || `meeting-${i}`; m.y = m.d.slice(0,4) || 'No date'; m.docs = []; m.hay = normalize([m.o,m.cp,...m.c,m.t,m.g,m.pl,m.oc,m.ev].join(' ')); byMeeting.set(m.id,m); });
D.forEach(d => { d.mentions.forEach(n => { n.meeting_ids = n.meeting_ids.filter(id => byMeeting.has(id)); }); d.meetingIds = [...new Set(d.mentions.flatMap(n => n.meeting_ids))]; d.meetingIds.forEach(id => byMeeting.get(id).docs.push(d)); d.hay = normalize([d.title,d.type,d.parties,...d.mentions.map(n => n.sentence)].join(' ')); });
S.forEach(s => { s.meeting_ids = s.meeting_ids.filter(id => byMeeting.has(id)); s.hay = normalize([s.title,s.url,s.snippet,s.text].join(' ')); });
const F = {
 c:['Country',m => m.c],o:['Official',m => [m.o]],t:['Topic',m => [m.t]],y:['Year',m => [m.y]],
 ty:['Meeting type',m => [m.ty],nice],st:['Meeting status',m => [m.st],nice],
 dt:['Document type',null,typeLabel],av:['Document availability',null,availabilityLabel],
 cn:['Connection',null,connectionLabel],rv:['Review',null,v => v === 'reviewed' ? 'Reviewed extraction' : 'Needs review'],
 cv:['Source coverage',null,coverageLabel],
};
const state = {q:'',sort:'new',view:'meetings',focus:''}; Object.keys(F).forEach(k => state[k]=[]);
let hits = [], meetingHits = [], shown = PAGE, searchTimer;
const words = () => normalize(state.q).split(/\s+/).filter(Boolean);
const textMatches = text => words().every(w => text.includes(w));
const selects = (k,values) => !state[k].length || values.some(v => state[k].includes(v));
const basicMeeting = m => ['c','o','t','y','ty','st'].every(k => selects(k,F[k][1](m)));
const activeMeetingFilters = () => ['c','o','t','y','ty','st'].some(k => state[k].length);
const activeDocFilters = () => ['dt','av','cn','rv'].some(k => state[k].length);
function eligibleMentions(d,meetingId) {
 if (!selects('dt',[d.type]) || !selects('av',[d.availability]) || !selects('rv',[d.review])) return [];
 return d.mentions.filter(n => selects('cn',[n.connection]) && (!meetingId || n.meeting_ids.includes(meetingId)) &&
   (!activeMeetingFilters() || n.meeting_ids.some(id => basicMeeting(byMeeting.get(id)))) &&
   (!state.cv.length || selects('cv',[bySource.get(n.source_url)?.coverage || 'unavailable'])));
}
const sourcePasses = s => selects('cv',[s.coverage]) && (!activeMeetingFilters() || s.meeting_ids.some(id => basicMeeting(byMeeting.get(id))));
function meetingPasses(m) {
 return basicMeeting(m) && (!activeDocFilters() || m.docs.some(d => eligibleMentions(d,m.id).length)) &&
   (!state.cv.length || m.src.some(url => selects('cv',[bySource.get(url)?.coverage || 'unavailable'])));
}
function highlight(text) {
 const tokens = words().map(w => w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).filter(Boolean);
 if (!tokens.length) return esc(text);
 const re = new RegExp(tokens.join('|'),'ig'); let out='',last=0;
 for (const match of String(text).matchAll(re)) { out += esc(text.slice(last,match.index)) + '<mark>' + esc(match[0]) + '</mark>'; last=match.index+match[0].length; }
 return out+esc(String(text).slice(last));
}
function excerpt(text,size=360) {
 if (!text) return '';
 const folded=normalize(text), positions=words().map(w => folded.indexOf(w)).filter(i => i>=0);
 const at=positions.length?Math.min(...positions):0, start=Math.max(0,at-90);
 return (start?'…':'')+text.slice(start,start+size)+(text.length>start+size?'…':'');
}
function passages(text) {
 const positions = words().flatMap(w => { const out=[], folded=normalize(text); let p=folded.indexOf(w); while(p>=0 && out.length<8){out.push(p);p=folded.indexOf(w,p+w.length);}return out; }).sort((a,b)=>a-b);
 const ranges=[]; for(const p of positions){if(!ranges.some(([a,b])=>p>=a&&p<b))ranges.push([Math.max(0,p-100),Math.min(text.length,p+260)]);if(ranges.length===2)break;}
 if(!ranges.length && text)ranges.push([0,Math.min(text.length,360)]);
 return ranges.map(([a,b])=>(a?'…':'')+text.slice(a,b)+(b<text.length?'…':''));
}
function chip(text,cls=''){return `<span class="tag ${cls}">${esc(text)}</span>`;}
function domain(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch{return url;}}
function dateLabel(d){if(!d)return 'No date';const [y,m,day]=d.split('-');return `${day?+day+' ':''}${MON[+m-1] || ''} ${y}`;}
function mentionHTML(n) {
 return `<div class="evidence"><span class="connection">${esc(connectionLabel(n.connection))}</span><blockquote>${highlight(n.sentence)}</blockquote><a href="${esc(n.source_url)}" target="_blank" rel="noopener">${esc(n.source_title || domain(n.source_url))}</a><div>${n.meeting_ids.map(id=>meetingLink(byMeeting.get(id))).join('')}</div></div>`;
}
function meetingLink(m){return `<button class="meeting-link" data-meeting="${esc(m.id)}">${esc(dateLabel(m.d))} · ${esc(m.o)} · ${esc(m.cp || m.c.join(', '))}</button><br>`;}
function documentReference(d,m){
 const mentions=d.mentions.filter(n=>n.meeting_ids.includes(m.id));
 return `<div class="doc-reference"><button data-document="${esc(d.id)}">${esc(d.title)}</button><div class="connection">${esc(typeLabel(d.type))} · ${esc(connectionLabel(mentions[0]?.connection))}</div><p class="excerpt">${highlight(excerpt(mentions[0]?.sentence || ''))}</p></div>`;
}
function meetingDetails(m){return `<div class="more"><div><dt>Counterparts</dt><dd>${esc(m.cp)}</dd></div>${m.oc?`<div><dt>Occasion</dt><dd>${esc(m.oc)}</dd></div>`:''}<div><dt>What the source says</dt><dd>${highlight(m.ev)}</dd></div><div><dt>Sources (${m.src.length})</dt><dd>${m.src.map(url=>`<button class="meeting-link" data-source="${esc(url)}">${esc(domain(url))} · ${esc(coverageLabel(bySource.get(url)?.coverage || 'unavailable'))}</button><br>`).join('')}</dd></div><div><dt>Document references (${m.docs.length})</dt><dd>${m.docs.length?m.docs.map(d=>documentReference(d,m)).join(''):'No document reference identified in the saved source text.'}</dd></div></div>`;}
function meetingCard(m){return `<article class="card record"><button class="result-title" data-expand="${esc(m.id)}" aria-expanded="${state.focus===m.id}">${esc(m.g || m.cp || 'Meeting')}</button><div class="meta">${esc(dateLabel(m.d))}${m.d&&!m.x?' (approximate)':''} · <b>${esc(m.o)}</b> · ${esc(m.c.join(', '))}</div><div class="tags">${chip(m.t)}${chip(nice(m.ty))}${chip(nice(m.st))}${chip(`${m.ns} sources`)}${m.docs.length?chip(`${m.docs.length} document references`,'document'):''}</div>${state.focus===m.id?meetingDetails(m):''}</article>`;}
function docCard(d){const mentions=eligibleMentions(d), sources=new Set(mentions.map(n=>n.source_url)), mids=new Set(mentions.flatMap(n=>n.meeting_ids)); return `<article class="card record"><button class="result-title" data-expand="${esc(d.id)}" aria-expanded="${state.focus===d.id}">${highlight(d.title)}</button><div class="tags">${chip(typeLabel(d.type),'document')}${chip(availabilityLabel(d.availability))}${chip(d.review==='reviewed'?'Reviewed extraction':'Needs review','candidate')}</div><div class="meta">${sources.size} source${sources.size===1?'':'s'} · ${mentions.length} mention${mentions.length===1?'':'s'} · ${mids.size} related meeting${mids.size===1?'':'s'}${d.parties?' · '+esc(d.parties):''}</div><p class="excerpt">${highlight(excerpt(mentions.find(n=>textMatches(normalize(n.sentence)))?.sentence || mentions[0]?.sentence || ''))}</p>${state.focus===d.id?`<p class="connection">Related meetings are connected through their cited sources. Each quotation states whether the connection is explicit or background context.</p>${mentions.map(mentionHTML).join('')}`:''}</article>`;}
function sourceCard(s){const combined=[s.snippet,s.text].filter(Boolean).join('\n\n');return `<article class="card record"><button class="result-title" data-expand="${esc(s.id)}" aria-expanded="${state.focus===s.id}">${highlight(s.title || domain(s.url))}</button><div class="meta">${esc(domain(s.url))} · ${s.meeting_ids.length} related meetings</div><div class="tags">${chip(coverageLabel(s.coverage))}</div>${passages(combined).map(p=>`<p class="excerpt">${highlight(p)}</p>`).join('')}${state.focus===s.id?`<div class="evidence"><a href="${esc(s.url)}" target="_blank" rel="noopener">Open original source</a>${s.snippet?`<h3 class="list-section">Saved search snippet</h3><blockquote>${highlight(s.snippet)}</blockquote>`:''}${s.text?`<details><summary>Read saved body text (${s.text.length.toLocaleString()} characters)</summary><div class="body-text">${highlight(s.text)}</div></details>`:'<p class="connection">No usable body text was saved for this source.</p>'}<h3 class="list-section">Related meetings</h3>${s.meeting_ids.length?s.meeting_ids.map(id=>meetingLink(byMeeting.get(id))).join(''):'<p class="connection">No associated meeting appears in this explorer. The source may be uncited or linked to a record outside the date window.</p>'}</div>`:''}</article>`;}
function filterValues(k) {
 if(F[k][1])return M.flatMap(F[k][1]);
 return k==='dt'?D.map(d=>d.type):k==='av'?D.map(d=>d.availability):k==='rv'?D.map(d=>d.review):k==='cn'?D.flatMap(d=>d.mentions.map(n=>n.connection)):S.map(s=>s.coverage);
}
function buildFilters(){
 $('filters').innerHTML=Object.entries(F).map(([k,[label]])=>{const counts={};filterValues(k).forEach(v=>counts[v]=(counts[v]||0)+1);const keys=Object.keys(counts).sort();return `<div class="ms" id="f-${k}"><button type="button" aria-haspopup="true" aria-expanded="false">${label}: any</button><div class="pop" hidden>${keys.length>12?`<input type="search" placeholder="Find ${label.toLowerCase()}" aria-label="Find ${label.toLowerCase()}">`:''}<div class="opts">${keys.map(v=>optionLabel(k,v)).join('')}</div><div class="foot"><button data-clear="${k}">Clear</button><button data-done="${k}">Done</button></div></div></div>`;}).join('');
 Object.keys(F).forEach(k=>{const box=$('f-'+k),pop=box.querySelector('.pop');box.querySelector('button').onclick=()=>{const open=pop.hidden;closePops();pop.hidden=!open;box.querySelector('button').setAttribute('aria-expanded',String(open));};pop.querySelector('.opts').onchange=()=>set(k,[...pop.querySelectorAll('input:checked')].map(i=>i.value));const search=pop.querySelector('input[type=search]');if(search)search.oninput=()=>pop.querySelectorAll('label').forEach(l=>l.hidden=!normalize(l.textContent).includes(normalize(search.value)));});
}
function optionLabel(k,v){return `<label><input type="checkbox" value="${esc(v)}"><span>${esc(F[k][2]?.(v)||v)}</span></label>`;}
// Faceted options: a meeting filter lists only values on meetings that pass every other active filter (plus anything already selected).
function refreshOptions(){
 for(const k of ['c','o','t','y','ty','st']){
  const keep=state[k];state[k]=[];const ok=M.filter(meetingPasses);state[k]=keep;
  const keys=[...new Set([...ok.flatMap(F[k][1]),...keep])].sort();
  const box=$('f-'+k).querySelector('.pop'),q=box.querySelector('input[type=search]');
  box.querySelector('.opts').innerHTML=keys.map(v=>optionLabel(k,v)).join('')||'<p class="meta">No matching values</p>';
  if(q&&q.value)q.oninput();
 }
}
function closePops(){document.querySelectorAll('.pop').forEach(p=>{p.hidden=true;p.previousElementSibling.setAttribute('aria-expanded','false');});}
function set(k,v){state[k]=v;state.focus='';shown=PAGE;sync();render();}
function sync(){
 refreshOptions();
 $('q').value=state.q;$('sort').value=state.sort;
 document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===state.view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 Object.keys(F).forEach(k=>{const box=$('f-'+k),v=state[k];box.hidden=state.view==='sources'&&['dt','av','cn','rv'].includes(k);box.querySelectorAll('input[type=checkbox]').forEach(i=>i.checked=v.includes(i.value));box.classList.toggle('on',!!v.length);box.querySelector('button').textContent=F[k][0]+': '+(v.length?(v.length<=2?v.map(x=>F[k][2]?.(x)||x).join(', '):v.length+' selected'):'any');});
 const p=new URLSearchParams();if(state.view!=='meetings')p.set('view',state.view);if(state.q)p.set('q',state.q);if(state.sort!=='new')p.set('sort',state.sort);if(state.focus)p.set('focus',state.focus);Object.keys(F).forEach(k=>state[k].forEach(v=>p.append(k,v)));history.replaceState(null,'',p.size?'#'+p:location.pathname);
 $('q').placeholder=state.view==='sources'?'Search all saved text, titles and snippets — e.g. “critical minerals”':state.view==='documents'?'Search document names and mentioning sentences':'Search meetings and their document references';
 $('q').setAttribute('aria-label',$('q').placeholder);
 $('scope-note').textContent=state.view==='sources'?`Search covers ${S.length.toLocaleString()} sources cited by meeting records, including saved body texts and snippets. All entered words must occur in the same source. Dates and countries filter associated meetings.`:state.view==='documents'?'Each result groups document references from saved meeting sources. “Needs review” indicates an automated extraction. Dates and countries filter related meetings.':'Document references may describe the meeting or background context in its sources. Expand a meeting to see the exact evidence.';
}
function render(){
 meetingHits=M.filter(meetingPasses);
 if(state.view==='meetings')hits=meetingHits.filter(m=>textMatches(m.hay+' '+m.docs.map(d=>d.hay).join(' ')));
 else if(state.view==='documents')hits=D.filter(d=>eligibleMentions(d).length && textMatches(d.hay));
 else hits=S.filter(s=>sourcePasses(s)&&textMatches(s.hay));
 const dates=item=>state.view==='meetings'?item.d:(state.view==='documents'?item.meetingIds:item.meeting_ids).map(id=>byMeeting.get(id)?.d||'').sort().at(-1)||'';
 hits.sort((a,b)=>{if(state.sort==='src')return state.view==='meetings'?b.ns-a.ns:state.view==='documents'?new Set(b.mentions.map(n=>n.source_url)).size-new Set(a.mentions.map(n=>n.source_url)).size:b.meeting_ids.length-a.meeting_ids.length;if(state.sort==='o'||state.sort==='c'){const prop=state.sort==='o'?'o':'c',get=x=>state.view==='meetings'?x:byMeeting.get((x.meetingIds||x.meeting_ids)[0]);return String(get(a)?.[prop]||'').localeCompare(String(get(b)?.[prop]||''));}const x=dates(a),y=dates(b);return (!x-!y)||(state.sort==='old'?x.localeCompare(y):y.localeCompare(x));});
 const active=Object.keys(F).flatMap(k=>state[k].map(v=>`<button class="chip" data-remove="${k}" data-value="${esc(v)}">${F[k][0]}: ${esc(F[k][2]?.(v)||v)} <i>×</i></button>`));if(state.q)active.unshift(`<button class="chip" data-remove="q">“${esc(state.q)}” <i>×</i></button>`);if(active.length)active.push('<button class="chip clear" data-reset>Clear all</button>');$('active').innerHTML=active.join('');
 const mids=new Set(state.view==='meetings'?hits.map(m=>m.id):hits.flatMap(x=>x.meetingIds||x.meeting_ids)), docs=state.view==='documents'?hits:new Set([...mids].flatMap(id=>byMeeting.get(id)?.docs.map(d=>d.id)||[])), sourceCount=state.view==='sources'?hits.length:state.view==='documents'?new Set(hits.flatMap(d=>eligibleMentions(d).map(n=>n.source_url))).size:new Set(hits.flatMap(m=>m.src)).size;
 $('stats').innerHTML=[[mids.size,'related meetings'],[docs.size??docs.length,'documents'],[sourceCount,'sources']].map(([n,label])=>`<div class="stat"><b>${n.toLocaleString()}</b><span>${label}</span></div>`).join('');
 $('count').textContent=`${hits.length.toLocaleString()} ${hits.length===1?state.view.slice(0,-1):state.view}`;
 const relevant=[...mids].map(id=>byMeeting.get(id)).filter(Boolean);drawBars(relevant);drawHist(relevant);drawList();
}
function drawBars(ms){for(const [k,limit] of [['t',10],['o',8],['c',8]]){const count={};ms.forEach(m=>F[k][1](m).forEach(v=>count[v]=(count[v]||0)+1));const entries=Object.entries(count).sort((a,b)=>b[1]-a[1]).slice(0,limit),max=entries[0]?.[1]||1;$('b-'+k).innerHTML=entries.map(([v,n])=>`<button data-filter="${k}" data-value="${esc(v)}" class="${state[k].includes(v)?'sel':''}"><div class="lbl"><span>${esc(v)}</span><span class="n">${n}</span></div><div class="track"><div class="fill" style="width:${n/max*100}%"></div></div></button>`).join('')||'<p class="meta">No related meetings</p>';}}
const months=[...new Set(M.map(m=>m.d.slice(0,7)).filter(Boolean))].sort();
function drawHist(ms){const count={};ms.forEach(m=>{if(m.d)count[m.d.slice(0,7)]=(count[m.d.slice(0,7)]||0)+1;});const max=Math.max(1,...Object.values(count));$('hist').innerHTML=months.map(k=>`<div title="${esc(k)}: ${count[k]||0} related meetings"><i style="height:${(count[k]||0)/max*100}%"></i></div>`).join('');$('histax').innerHTML=months.map(k=>`<span>${k.endsWith('-01')?k.slice(0,4):''}</span>`).join('');$('tlnote').textContent='Related meetings by month';}
function drawList(){
 const subset=hits.slice(0,shown);$('list').innerHTML=subset.map(state.view==='meetings'?meetingCard:state.view==='documents'?docCard:sourceCard).join('')||`<div class="empty"><b>No ${state.view} match</b>Try fewer search words or remove a filter.</div>`;
 $('loadmore').hidden=hits.length<=shown;$('loadmore').style.display=hits.length>shown?'block':'none';$('loadmore').textContent=`Show more (${Math.max(0,hits.length-shown).toLocaleString()} left)`;
}
function goRecord(view,id){state.view=view;state.focus=id;state.q='';Object.keys(F).forEach(k=>state[k]=[]);shown=PAGE;sync();render();const i=hits.findIndex(x=>x.id===id);if(i>=PAGE){shown=(Math.floor(i/PAGE)+1)*PAGE;drawList();}requestAnimationFrame(()=>document.querySelector(`[data-expand="${CSS.escape(id)}"]`)?.scrollIntoView({block:'center'}));}
document.addEventListener('click',e=>{
 const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;state.focus='';if(state.view==='sources')['dt','av','cn','rv'].forEach(k=>state[k]=[]);shown=PAGE;sync();render();return;}
 const expand=e.target.closest('[data-expand]');if(expand){state.focus=state.focus===expand.dataset.expand?'':expand.dataset.expand;sync();const card=expand.closest('.record'),item=hits.find(x=>x.id===expand.dataset.expand);card.outerHTML=(state.view==='meetings'?meetingCard:state.view==='documents'?docCard:sourceCard)(item);document.querySelector(`[data-expand="${CSS.escape(item.id)}"]`)?.focus({preventScroll:true});return;}
 const doc=e.target.closest('[data-document]');if(doc){goRecord('documents',doc.dataset.document);return;}
 const meeting=e.target.closest('[data-meeting]');if(meeting){goRecord('meetings',meeting.dataset.meeting);return;}
 const source=e.target.closest('[data-source]');if(source){const s=bySource.get(source.dataset.source);if(s)goRecord('sources',s.id);return;}
 const filter=e.target.closest('[data-filter]');if(filter){const k=filter.dataset.filter,v=filter.dataset.value;set(k,state[k].includes(v)?state[k].filter(x=>x!==v):[...state[k],v]);return;}
 const remove=e.target.closest('[data-remove]');if(remove){const k=remove.dataset.remove;set(k,k==='q'?'':state[k].filter(x=>x!==remove.dataset.value));return;}
 if(e.target.closest('[data-reset]')){Object.keys(F).forEach(k=>state[k]=[]);state.q='';state.focus='';shown=PAGE;sync();render();return;}
 const clear=e.target.closest('[data-clear]');if(clear)set(clear.dataset.clear,[]);
 if(e.target.closest('[data-done]')||!e.target.closest('.ms'))closePops();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePops();});
$('q').oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>set('q',e.target.value),180);};
$('sort').onchange=e=>set('sort',e.target.value);$('loadmore').onclick=()=>{shown+=PAGE;drawList();};
function restore(){Object.keys(F).forEach(k=>state[k]=[]);state.q='';state.sort='new';state.view='meetings';state.focus='';new URLSearchParams(location.hash.slice(1)).forEach((v,k)=>{if(k in F){if(filterValues(k).includes(v))state[k].push(v);}else if(['q','focus'].includes(k))state[k]=v;else if(k==='view'&&['meetings','documents','sources'].includes(v))state.view=v;else if(k==='sort'&&['new','old','o','c','src'].includes(v))state.sort=v;});}
window.addEventListener('hashchange',()=>{restore();sync();render();if(state.focus){const i=hits.findIndex(x=>x.id===state.focus);if(i>=shown){shown=i+1;drawList();}}});
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2200);}
$('share').onclick=()=>navigator.clipboard.writeText(location.href).then(()=>toast('Link copied'),()=>toast('Copy the address bar to share this view'));
function exportRows(){
 if(state.view==='meetings')return [['Meeting ID','Date','Official','Counterparts','Countries','Topic','Summary','Evidence','Sources','Document IDs'],...hits.map(m=>[m.id,m.d,m.o,m.cp,m.c.join('; '),m.t,m.g,m.ev,m.src.join(' '),m.docs.map(d=>d.id).join('; ')])];
 if(state.view==='documents')return [['Document ID','Document','Type','Review','Availability','Mention ID','Connection','Sentence','Source','Meeting IDs'],...hits.flatMap(d=>eligibleMentions(d).map(n=>[d.id,d.title,d.type,d.review,d.availability,n.id,n.connection,n.sentence,n.source_url,n.meeting_ids.join('; ')]))];
 return [['Source ID','Title','URL','Coverage','Snippet','Saved body text','Meeting IDs'],...hits.map(s=>[s.id,s.title,s.url,s.coverage,s.snippet,s.text,s.meeting_ids.join('; ')])];
}
$('export').onclick=()=>{const cell=v=>{v=String(v??'');if(/^[=+@\-]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';},rows=exportRows(),csv=rows.map(row=>row.map(cell).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${state.view}-filtered.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Exported ${hits.length} ${state.view}`);};
buildFilters();restore();sync();render();if(state.focus){const i=hits.findIndex(x=>x.id===state.focus);if(i>=shown){shown=i+1;drawList();}}
})();
