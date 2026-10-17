const news=window.PINK_AI_NEWS;
if(!Array.isArray(news))throw new Error('资讯数据未生成，请运行 node scripts/build-data.mjs');

const latestNews=[...news].sort((a,b)=>b.date.localeCompare(a.date))[0];
const dataMeta=window.PINK_AI_META||{generatedOn:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),coverageThrough:latestNews.date};
const formatDate=value=>value.replaceAll('-','.');
document.querySelector('#briefingUpdated').textContent=`演示数据截至 ${formatDate(dataMeta.coverageThrough)} · 页面版本 ${formatDate(dataMeta.generatedOn)}`;
document.querySelector('#briefingCount').textContent=String(news.length);
document.querySelector('#traceRate').textContent=`${Math.round(news.filter(item=>item.url&&item.sourceReason).length/news.length*100)}%`;

const grid=document.querySelector('#newsGrid');
const search=document.querySelector('#searchInput');
const empty=document.querySelector('#emptyState');
const newsDialog=document.querySelector('#newsDialog');
const dialogContent=document.querySelector('#dialogContent');
const regionFilter=document.querySelector('#regionFilter');
const timeFilter=document.querySelector('#timeFilter');
const resultCount=document.querySelector('#resultCount');
const clearSearch=document.querySelector('#clearSearch');
const activeFilters=document.querySelector('#activeFilters');
const activeFilterList=document.querySelector('#activeFilterList');
const resetFilters=document.querySelector('#resetFilters');
const emptyReset=document.querySelector('#emptyReset');
let activeTopic='all';

const topicMap={
  product:['产品','交互','语音','企业'],
  model:['模型','语音'],
  agent:['Agent'],
  governance:['安全','治理','政策'],
  developer:['开发者','迁移提醒']
};
const topicLabels={product:'产品体验',model:'模型能力',agent:'Agent',governance:'安全治理',developer:'开发者'};
const regionLabels={global:'全球',china:'中国'};

function renderTags(tags){return tags.map(tag=>`<span># ${tag}</span>`).join('')}
function renderList(items){return `<ul>${items.map(item=>`<li>${item}</li>`).join('')}</ul>`}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]))}

function render(){
  const query=search.value.trim().toLowerCase();
  const newestDate=Math.max(...news.map(item=>new Date(`${item.date}T00:00:00`).getTime()));
  const list=news.filter(item=>{
    const matchesTopic=activeTopic==='all'||topicMap[activeTopic].some(tag=>item.tags.includes(tag));
    const matchesRegion=regionFilter.value==='all'||item.group.includes(regionFilter.value);
    const ageInDays=Math.floor((newestDate-new Date(`${item.date}T00:00:00`).getTime())/86400000);
    const matchesTime=timeFilter.value==='all'||ageInDays<Number(timeFilter.value);
    const searchable=[item.source,item.status,item.title,item.summary,item.fact,item.background,item.why,...item.tags,...item.impact,...item.actions].join(' ').toLowerCase();
    return matchesTopic&&matchesRegion&&matchesTime&&(!query||searchable.includes(query));
  });
  resultCount.textContent=query||activeTopic!=='all'||regionFilter.value!=='all'||timeFilter.value!=='all'?`找到 ${list.length} 条相关简报`:`共 ${list.length} 条今日精选`;
  clearSearch.hidden=!query;
  renderActiveFilters(query);
  grid.innerHTML=list.map((item,index)=>`
    <article class="news-card ${index===0?'news-card--lead':''}" data-id="${item.id}" tabindex="0" aria-label="阅读：${item.title}" style="--accent:${item.accent}">
      <div class="news-rank">${String(index+1).padStart(2,'0')}</div>
      <div class="news-body">
        <div class="news-meta">
          <span class="source-badge"><span class="source-icon">${item.icon}</span>${item.source}</span>
          <span class="status">${item.status}</span>
          <time datetime="${item.date}">${item.display}</time>
          <span class="verified">核验于 ${item.verified}</span>
          <span class="source-grade"><i class="grade ${item.grade.toLowerCase()}">${item.grade}</i> 官方信源</span>
        </div>
        <h3>${item.title}</h3>
        <p class="news-summary">${item.summary}</p>
        ${index===0&&item.image?`<img class="lead-visual" src="${item.image}" alt="AI 信任与信息筛选的抽象视觉">`:''}
        ${index===0?`<p class="news-why"><strong>为什么重要</strong>${item.why}</p>`:''}
        <div class="news-footer"><div class="tags">${renderTags(item.tags)}</div><div class="card-actions"><button class="read-decision" type="button">查看完整判断</button><a class="source-direct" href="${item.url}" target="_blank" rel="noopener" aria-label="查看 ${item.source} 官方原文">官方原文</a></div></div>
      </div>
    </article>`).join('');
  empty.hidden=list.length>0;
  grid.querySelectorAll('.news-card').forEach(card=>{
    card.addEventListener('click',event=>{if(event.target.closest('a'))return;openNews(Number(card.dataset.id))});
    card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openNews(Number(card.dataset.id))}});
  });
}

function renderActiveFilters(query){
  const selections=[];
  if(query)selections.push({type:'search',label:`搜索：${search.value.trim()}`});
  if(activeTopic!=='all')selections.push({type:'topic',label:topicLabels[activeTopic]});
  if(regionFilter.value!=='all')selections.push({type:'region',label:regionLabels[regionFilter.value]});
  if(timeFilter.value!=='all')selections.push({type:'time',label:`近 ${timeFilter.value} 天`});
  activeFilters.hidden=selections.length===0;
  activeFilterList.innerHTML=selections.map(item=>`<button type="button" data-remove="${item.type}" aria-label="移除条件：${escapeHtml(item.label)}">${escapeHtml(item.label)}<span aria-hidden="true">×</span></button>`).join('');
  activeFilterList.querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>removeFilter(button.dataset.remove)));
}

function selectTopic(value){
  activeTopic=value;
  document.querySelectorAll('[data-topic]').forEach(button=>{
    const selected=button.dataset.topic===value;
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
}

function removeFilter(type){
  if(type==='search')search.value='';
  if(type==='topic')selectTopic('all');
  if(type==='region')regionFilter.value='all';
  if(type==='time')timeFilter.value='all';
  syncUrl();render();
}

function resetDiscovery(){
  search.value='';selectTopic('all');regionFilter.value='all';timeFilter.value='all';syncUrl();render();search.focus();
}

function syncUrl(){
  const params=new URLSearchParams(window.location.search);
  ['q','topic','region','time'].forEach(key=>params.delete(key));
  if(search.value.trim())params.set('q',search.value.trim());
  if(activeTopic!=='all')params.set('topic',activeTopic);
  if(regionFilter.value!=='all')params.set('region',regionFilter.value);
  if(timeFilter.value!=='all')params.set('time',timeFilter.value);
  const next=`${window.location.pathname}${params.size?`?${params}`:''}${window.location.hash}`;
  window.history.replaceState({},'',next);
}

function openNews(id){
  const item=news.find(entry=>entry.id===id);if(!item)return;
  dialogContent.innerHTML=`
    <article class="article-layout">
      <div class="article-main">
        <div class="article-meta"><span class="source-badge"><span class="source-icon" style="--accent:${item.accent}">${item.icon}</span>${item.source}</span><span>${item.display}</span><span>${item.status}</span></div>
        <h2 class="dialog-title" id="dialogTitle">${item.title}</h2>
        <div class="tags article-tags">${renderTags(item.tags)}</div>
        ${item.image?`<img class="article-visual" src="${item.image}" alt="AI 信任与信息筛选的抽象视觉">`:''}
        <section class="article-section article-lead"><span class="section-number">01</span><div><h3>事实摘要</h3><p>${item.fact}</p></div></section>
        <section class="article-section"><span class="section-number">02</span><div><h3>背景</h3><p>${item.background}</p></div></section>
      </div>
      <aside class="article-insight" aria-label="产品判断">
        <section><span class="insight-label">为什么重要</span><p>${item.why}</p></section>
        <section><span class="insight-label">影响对象</span>${renderList(item.impact)}</section>
        <section><span class="insight-label">建议行动</span>${renderList(item.actions)}</section>
        <section class="source-proof"><span class="insight-label">来源与核验</span><p><i class="grade ${item.grade.toLowerCase()}">${item.grade}</i> ${item.sourceType} · ${item.status}</p><dl><div><dt>原文标题</dt><dd>${item.sourceTitle}</dd></div><div><dt>评级理由</dt><dd>${item.sourceReason}</dd></div><div><dt>发布时间</dt><dd>${item.display}</dd></div><div><dt>核验时间</dt><dd>${item.verified}</dd></div></dl><a class="source-link" href="${item.url}" target="_blank" rel="noopener">查看精确原文</a></section>
      </aside>
    </article>`;
  newsDialog.setAttribute('aria-labelledby','dialogTitle');newsDialog.showModal();
}

document.querySelectorAll('[data-topic]').forEach(button=>button.addEventListener('click',()=>{selectTopic(button.dataset.topic);syncUrl();render()}));
search.addEventListener('input',()=>{syncUrl();render()});
regionFilter.addEventListener('change',()=>{syncUrl();render()});
timeFilter.addEventListener('change',()=>{syncUrl();render()});
clearSearch.addEventListener('click',()=>{search.value='';syncUrl();render();search.focus()});
resetFilters.addEventListener('click',resetDiscovery);
emptyReset.addEventListener('click',resetDiscovery);
document.querySelectorAll('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()}));
const subscribeDialog=document.querySelector('#subscribeDialog');
document.querySelector('#subscribeBtn').addEventListener('click',()=>subscribeDialog.showModal());
document.querySelector('#subscribeForm').addEventListener('submit',event=>{event.preventDefault();event.target.innerHTML='<p class="subscribe-success">订阅演示完成</p>'});

const initialParams=new URLSearchParams(window.location.search);
const initialTopic=initialParams.get('topic');
const initialRegion=initialParams.get('region');
const initialTime=initialParams.get('time');
search.value=initialParams.get('q')||'';
if(initialTopic&&Object.hasOwn(topicMap,initialTopic))selectTopic(initialTopic);
if(['global','china'].includes(initialRegion))regionFilter.value=initialRegion;
if(['3','7','30'].includes(initialTime))timeFilter.value=initialTime;
render();
const requestedNews=Number(initialParams.get('news'));
if(requestedNews)openNews(requestedNews);
