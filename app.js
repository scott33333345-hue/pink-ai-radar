const news=window.PINK_AI_NEWS;
if(!Array.isArray(news))throw new Error('资讯数据未生成，请运行 node scripts/build-data.mjs');

const latestNews=[...news].sort((a,b)=>b.date.localeCompare(a.date))[0];
const dataMeta=window.PINK_AI_META||{generatedOn:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}),coverageThrough:latestNews.date};
const formatDate=value=>value.replaceAll('-','.');
document.querySelector('#briefingUpdated').textContent=`资讯核验至 ${formatDate(dataMeta.generatedOn)} · 最新入选 ${formatDate(dataMeta.coverageThrough)}`;
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
const savedFilter=document.querySelector('#savedFilter');
const savedCount=document.querySelector('#savedCount');
const saveToast=document.querySelector('#saveToast');
const archiveGrid=document.querySelector('#archiveGrid');
const archiveSummary=document.querySelector('#archiveSummary');
const trendChart=document.querySelector('#trendChart');
const trendInsight=document.querySelector('#trendInsight');
const sourceMixSummary=document.querySelector('#sourceMixSummary');
const sourceMixList=document.querySelector('#sourceMixList');
const analyticsDialog=document.querySelector('#analyticsDialog');
const metricGrid=document.querySelector('#metricGrid');
const analyticsStatus=document.querySelector('#analyticsStatus');
let activeTopic='all';
let savedOnly=false;
let activeDate='all';
let openNewsId=null;
let dialogReturnNewsId=null;
const savedStorageKey='pink-ai-radar:saved-news';
const feedbackStorageKey='pink-ai-radar:news-feedback';
const analyticsStorageKey='pink-ai-radar:analytics-v1';
let savedIds=loadSavedIds();
let feedbackById=loadFeedback();
let analyticsEvents=loadAnalyticsEvents();

const topicMap={
  product:['产品','交互','语音','企业'],
  model:['模型','语音'],
  agent:['Agent'],
  governance:['安全','治理','政策'],
  developer:['开发者','迁移提醒']
};
const topicLabels={product:'产品体验',model:'模型能力',agent:'Agent',governance:'安全治理',developer:'开发者'};
const regionLabels={global:'全球',china:'中国'};
const archiveDates=[...new Set(news.map(item=>item.date))].sort((a,b)=>b.localeCompare(a));

function renderTags(tags){return tags.map(tag=>`<span># ${tag}</span>`).join('')}
function renderList(items){return `<ul>${items.map(item=>`<li>${item}</li>`).join('')}</ul>`}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[character]))}
function loadSavedIds(){
  try{return new Set(JSON.parse(localStorage.getItem(savedStorageKey)||'[]').map(Number).filter(Number.isInteger))}catch{return new Set()}
}
function persistSavedIds(){
  try{localStorage.setItem(savedStorageKey,JSON.stringify([...savedIds]))}catch{showSaveToast('浏览器阻止了本地保存')}
}
function loadFeedback(){
  try{return JSON.parse(localStorage.getItem(feedbackStorageKey)||'{}')}catch{return {}}
}
function persistFeedback(){
  try{localStorage.setItem(feedbackStorageKey,JSON.stringify(feedbackById))}catch{showSaveToast('浏览器阻止了本地保存')}
}
function loadAnalyticsEvents(){
  try{const value=JSON.parse(localStorage.getItem(analyticsStorageKey)||'[]');return Array.isArray(value)?value:[]}catch{return []}
}
function trackEvent(type,newsId=null,meta={}){
  analyticsEvents.push({type,newsId:Number.isInteger(newsId)?newsId:null,meta,at:new Date().toISOString()});
  analyticsEvents=analyticsEvents.slice(-300);
  try{localStorage.setItem(analyticsStorageKey,JSON.stringify(analyticsEvents))}catch{}
}
function eventCount(...types){return analyticsEvents.filter(event=>types.includes(event.type)).length}
function renderAnalytics(){
  const metrics=[
    {label:'详情打开',value:eventCount('detail_open'),note:'衡量用户是否进入完整判断'},
    {label:'原文跳转',value:eventCount('source_open'),note:'衡量用户是否继续事实复核'},
    {label:'发现工具使用',value:eventCount('search_used','filter_used','archive_selected','trend_selected'),note:'搜索、筛选、归档与趋势点击'},
    {label:'收藏操作',value:eventCount('save_toggle'),note:'衡量持续跟踪意愿'},
    {label:'反馈提交',value:eventCount('feedback_submit'),note:'衡量判断是否有帮助'},
    {label:'订阅操作',value:eventCount('rss_open','rss_copy'),note:'衡量持续获取意愿'}
  ];
  metricGrid.innerHTML=metrics.map(metric=>`<article><strong>${metric.value}</strong><span>${metric.label}</span><small>${metric.note}</small></article>`).join('');
  analyticsStatus.textContent=`共记录 ${analyticsEvents.length} 个本机事件，最多保留最近 300 个。`;
}
function isSaved(id){return savedIds.has(id)}
function showSaveToast(message){
  saveToast.textContent=message;saveToast.classList.add('show');
  window.clearTimeout(showSaveToast.timer);showSaveToast.timer=window.setTimeout(()=>saveToast.classList.remove('show'),1800);
}
function toggleSaved(id,focusSurface='card'){
  const item=news.find(entry=>entry.id===id);if(!item)return;
  if(isSaved(id)){savedIds.delete(id);showSaveToast('已取消收藏')}else{savedIds.add(id);showSaveToast('已加入我的收藏')}
  persistSavedIds();render();
  trackEvent('save_toggle',id,{saved:isSaved(id)});
  if(openNewsId===id)renderDialog(item);
  window.requestAnimationFrame(()=>{
    const selector=focusSurface==='dialog'?`[data-dialog-save="${id}"]`:`[data-save-id="${id}"]`;
    document.querySelector(selector)?.focus();
  });
}
function correctionUrl(item){
  const title=encodeURIComponent(`[内容纠错] ${item.title}`);
  const body=encodeURIComponent(`## 对应资讯\n\n- 标题：${item.title}\n- 来源：${item.source}\n- 原文：${item.url}\n- 资讯 ID：${item.id}\n\n## 需要纠正的内容\n\n请描述具体问题，并尽可能附上依据：\n`);
  return `https://github.com/scott33333345-hue/pink-ai-radar/issues/new?title=${title}&body=${body}`;
}
function submitFeedback(id,value){
  feedbackById[id]=value;persistFeedback();
  trackEvent('feedback_submit',id,{value});
  const item=news.find(entry=>entry.id===id);if(item)renderDialog(item);
  window.requestAnimationFrame(()=>dialogContent.querySelector(`[data-feedback="${value}"]`)?.focus());
  showSaveToast(value==='helpful'?'谢谢，这条反馈已保存在本机':'谢谢，我们已记录你的选择');
}
function formatArchiveDate(value){
  const [year,month,day]=value.split('-');
  return {year,label:`${Number(month)} 月 ${Number(day)} 日`};
}
function renderArchive(){
  archiveSummary.textContent=`已归档 ${archiveDates.length} 个发布日期 · 共 ${news.length} 条正式简报`;
  archiveGrid.innerHTML=archiveDates.map((date,index)=>{
    const items=news.filter(item=>item.date===date);
    const formatted=formatArchiveDate(date);
    const topics=[...new Set(items.flatMap(item=>item.tags))].slice(0,3);
    return `<button type="button" class="archive-day ${activeDate===date?'active':''}" data-archive-date="${date}" aria-pressed="${activeDate===date}">
      <span class="archive-index">${String(index+1).padStart(2,'0')}</span>
      <span class="archive-date"><strong>${formatted.label}</strong><small>${formatted.year}</small></span>
      <span class="archive-count">${items.length} 条</span>
      <span class="archive-topics">${topics.map(tag=>`#${escapeHtml(tag)}`).join(' ')}</span>
      <span class="archive-arrow" aria-hidden="true">→</span>
    </button>`;
  }).join('');
  archiveGrid.querySelectorAll('[data-archive-date]').forEach(button=>button.addEventListener('click',()=>{
    trackEvent('archive_selected',null,{date:button.dataset.archiveDate});
    activeDate=button.dataset.archiveDate;timeFilter.value='all';syncUrl();render();
    document.querySelector('#briefing').scrollIntoView({behavior:'smooth',block:'start'});
  }));
}
function renderTrends(){
  const windowDates=archiveDates.slice(0,7);
  const windowNews=news.filter(item=>windowDates.includes(item.date));
  const rows=Object.entries(topicMap).map(([key,tags])=>({key,label:topicLabels[key],count:windowNews.filter(item=>tags.some(tag=>item.tags.includes(tag))).length})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'zh-CN'));
  const maxCount=Math.max(1,...rows.map(row=>row.count));
  trendChart.innerHTML=rows.map(row=>`<button type="button" class="trend-row" data-trend-topic="${row.key}" aria-label="查看${row.label}资讯，共 ${row.count} 条">
    <span class="trend-label">${row.label}</span><span class="trend-track"><i style="--trend-width:${row.count/maxCount*100}%"></i></span><strong>${row.count}</strong><small>查看 →</small>
  </button>`).join('');
  trendChart.querySelectorAll('[data-trend-topic]').forEach(button=>button.addEventListener('click',()=>{
    trackEvent('trend_selected',null,{topic:button.dataset.trendTopic});
    selectTopic(button.dataset.trendTopic);activeDate='all';timeFilter.value='all';syncUrl();render();
    document.querySelector('#briefing').scrollIntoView({behavior:'smooth',block:'start'});
  }));
  const peak=rows[0].count;
  const leaders=rows.filter(row=>row.count===peak).map(row=>row.label);
  const sources=Object.entries(windowNews.reduce((summary,item)=>{summary[item.source]=(summary[item.source]||0)+1;return summary},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'zh-CN'));
  const [topSource,topSourceCount]=sources[0];
  const topShare=Math.round(topSourceCount/windowNews.length*100);
  trendInsight.innerHTML=`<span>本期判断</span><h3>${leaders.join('与')}是出现最频繁的信号</h3><p>在最近 ${windowDates.length} 个有内容的发布日期中，相关主题各出现 ${peak} 次。它适合用来确定持续跟踪方向，而不能直接证明市场热度。</p><a href="#briefing" data-lead-topic="${rows[0].key}">查看代表性简报 →</a><small>编辑提示：${topSource} 占样本 ${topShare}%，结论可能受到信源结构影响。</small>`;
  trendInsight.querySelector('[data-lead-topic]').addEventListener('click',event=>{event.preventDefault();trackEvent('trend_selected',null,{topic:event.currentTarget.dataset.leadTopic,surface:'insight'});selectTopic(event.currentTarget.dataset.leadTopic);activeDate='all';timeFilter.value='all';syncUrl();render();document.querySelector('#briefing').scrollIntoView({behavior:'smooth',block:'start'})});
  sourceMixSummary.textContent=`${sources.length} 个来源 · ${windowNews.length} 条简报`;
  sourceMixList.innerHTML=sources.map(([source,count])=>`<span>${escapeHtml(source)} <b>${count}</b></span>`).join('');
}

function render(){
  const query=search.value.trim().toLowerCase();
  const newestDate=Math.max(...news.map(item=>new Date(`${item.date}T00:00:00`).getTime()));
  const list=news.filter(item=>{
    const matchesTopic=activeTopic==='all'||topicMap[activeTopic].some(tag=>item.tags.includes(tag));
    const matchesRegion=regionFilter.value==='all'||item.group.includes(regionFilter.value);
    const ageInDays=Math.floor((newestDate-new Date(`${item.date}T00:00:00`).getTime())/86400000);
    const matchesTime=timeFilter.value==='all'||ageInDays<Number(timeFilter.value);
    const matchesDate=activeDate==='all'||item.date===activeDate;
    const matchesSaved=!savedOnly||isSaved(item.id);
    const searchable=[item.source,item.status,item.title,item.summary,item.fact,item.background,item.why,...item.tags,...item.impact,...item.actions].join(' ').toLowerCase();
    return matchesTopic&&matchesRegion&&matchesTime&&matchesDate&&matchesSaved&&(!query||searchable.includes(query));
  });
  resultCount.textContent=query||activeTopic!=='all'||regionFilter.value!=='all'||timeFilter.value!=='all'||activeDate!=='all'||savedOnly?`找到 ${list.length} 条相关简报`:`共 ${list.length} 条今日精选`;
  savedCount.textContent=String(savedIds.size);
  savedFilter.classList.toggle('active',savedOnly);
  savedFilter.setAttribute('aria-pressed',String(savedOnly));
  savedFilter.querySelector('span').textContent=savedOnly?'♥':'♡';
  clearSearch.hidden=!query;
  renderActiveFilters(query);
  renderArchive();
  grid.innerHTML=list.map((item,index)=>`
    <article class="news-card ${index===0?'news-card--lead':''}" data-id="${item.id}" style="--accent:${item.accent}">
      <div class="news-rank">${String(index+1).padStart(2,'0')}</div>
      <div class="news-body">
        <div class="news-meta">
          <span class="source-badge"><span class="source-icon" aria-hidden="true">${item.icon}</span>${item.source}</span>
          <span class="status">${item.status}</span>
          <time datetime="${item.date}">${item.display}</time>
          <span class="verified">核验于 ${item.verified}</span>
          <span class="source-grade"><i class="grade ${item.grade.toLowerCase()}">${item.grade}</i> 官方信源</span>
        </div>
        <h3 id="news-title-${item.id}">${item.title}</h3>
        <p class="news-summary">${item.summary}</p>
        ${index===0&&item.image?`<img class="lead-visual" src="${item.image}" alt="AI 信任与信息筛选的抽象视觉" width="1200" height="675" loading="lazy" decoding="async">`:''}
        ${index===0?`<p class="news-why"><strong>为什么重要</strong>${item.why}</p>`:''}
        <div class="news-footer"><div class="tags">${renderTags(item.tags)}</div><div class="card-actions"><button class="save-button ${isSaved(item.id)?'active':''}" type="button" data-save-id="${item.id}" aria-pressed="${isSaved(item.id)}" aria-label="${isSaved(item.id)?'取消收藏':'收藏'}：${escapeHtml(item.title)}"><span aria-hidden="true">${isSaved(item.id)?'♥':'♡'}</span>${isSaved(item.id)?'已收藏':'收藏'}</button><button class="read-decision" type="button" aria-haspopup="dialog" aria-label="查看完整判断：${escapeHtml(item.title)}">查看完整判断</button><a class="source-direct" href="${item.url}" target="_blank" rel="noopener" aria-label="查看 ${item.source} 官方原文（新窗口打开）">官方原文</a></div></div>
      </div>
    </article>`).join('');
  empty.hidden=list.length>0;
  if(!list.length&&savedOnly){empty.querySelector('strong').textContent='还没有符合条件的收藏';empty.querySelector('p').textContent='先收藏值得跟进的资讯，之后可以从这里集中查看。'}else{empty.querySelector('strong').textContent='暂时没有匹配的简报';empty.querySelector('p').textContent='可以减少筛选条件，或换一个更宽泛的关键词。'}
  grid.querySelectorAll('[data-save-id]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();toggleSaved(Number(button.dataset.saveId),'card')}));
  grid.querySelectorAll('.read-decision').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();openNews(Number(button.closest('.news-card').dataset.id))}));
  grid.querySelectorAll('.source-direct').forEach(link=>link.addEventListener('click',()=>trackEvent('source_open',Number(link.closest('.news-card').dataset.id),{surface:'card'})));
  grid.querySelectorAll('.news-card').forEach(card=>{
    card.addEventListener('click',event=>{if(event.target.closest('a,button'))return;openNews(Number(card.dataset.id))});
  });
}

function renderActiveFilters(query){
  const selections=[];
  if(query)selections.push({type:'search',label:`搜索：${search.value.trim()}`});
  if(activeTopic!=='all')selections.push({type:'topic',label:topicLabels[activeTopic]});
  if(regionFilter.value!=='all')selections.push({type:'region',label:regionLabels[regionFilter.value]});
  if(timeFilter.value!=='all')selections.push({type:'time',label:`近 ${timeFilter.value} 天`});
  if(activeDate!=='all')selections.push({type:'date',label:`日期：${formatArchiveDate(activeDate).label}`});
  if(savedOnly)selections.push({type:'saved',label:'我的收藏'});
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
  if(type==='date')activeDate='all';
  if(type==='saved')savedOnly=false;
  syncUrl();render();
}

function resetDiscovery(){
  search.value='';selectTopic('all');regionFilter.value='all';timeFilter.value='all';activeDate='all';savedOnly=false;syncUrl();render();search.focus();
}

function syncUrl(){
  const params=new URLSearchParams(window.location.search);
  ['q','topic','region','time','date','saved'].forEach(key=>params.delete(key));
  if(search.value.trim())params.set('q',search.value.trim());
  if(activeTopic!=='all')params.set('topic',activeTopic);
  if(regionFilter.value!=='all')params.set('region',regionFilter.value);
  if(timeFilter.value!=='all')params.set('time',timeFilter.value);
  if(activeDate!=='all')params.set('date',activeDate);
  if(savedOnly)params.set('saved','1');
  const next=`${window.location.pathname}${params.size?`?${params}`:''}${window.location.hash}`;
  window.history.replaceState({},'',next);
}

function openNews(id){
  const item=news.find(entry=>entry.id===id);if(!item)return;
  trackEvent('detail_open',id);
  openNewsId=id;dialogReturnNewsId=id;renderDialog(item);newsDialog.setAttribute('aria-labelledby','dialogTitle');newsDialog.showModal();
}

function renderDialog(item){
  dialogContent.innerHTML=`
    <article class="article-layout">
      <div class="article-main">
        <div class="article-meta"><span class="source-badge"><span class="source-icon" aria-hidden="true" style="--accent:${item.accent}">${item.icon}</span>${item.source}</span><span>${item.display}</span><span>${item.status}</span><button class="save-button detail-save ${isSaved(item.id)?'active':''}" type="button" data-dialog-save="${item.id}" aria-pressed="${isSaved(item.id)}"><span aria-hidden="true">${isSaved(item.id)?'♥':'♡'}</span>${isSaved(item.id)?'已收藏':'收藏稍后读'}</button></div>
        <h2 class="dialog-title" id="dialogTitle">${item.title}</h2>
        <div class="tags article-tags">${renderTags(item.tags)}</div>
        ${item.image?`<img class="article-visual" src="${item.image}" alt="AI 信任与信息筛选的抽象视觉" width="1200" height="675" decoding="async">`:''}
        <section class="article-section article-lead"><span class="section-number" aria-hidden="true">01</span><div><h3>事实摘要</h3><p>${item.fact}</p></div></section>
        <section class="article-section"><span class="section-number" aria-hidden="true">02</span><div><h3>背景</h3><p>${item.background}</p></div></section>
      </div>
      <aside class="article-insight" aria-label="产品判断">
        <section><h3 class="insight-label">为什么重要</h3><p>${item.why}</p></section>
        <section><h3 class="insight-label">影响对象</h3>${renderList(item.impact)}</section>
        <section><h3 class="insight-label">建议行动</h3>${renderList(item.actions)}</section>
        <section class="article-feedback" aria-labelledby="feedbackTitle">
          <h3 class="insight-label" id="feedbackTitle">这条简报对你的判断有帮助吗？</h3>
          <div class="feedback-actions" role="group" aria-label="简报有用性评价">
            <button type="button" data-feedback="helpful" class="${feedbackById[item.id]==='helpful'?'active':''}" aria-pressed="${feedbackById[item.id]==='helpful'}">有帮助</button>
            <button type="button" data-feedback="not-helpful" class="${feedbackById[item.id]==='not-helpful'?'active':''}" aria-pressed="${feedbackById[item.id]==='not-helpful'}">帮助不大</button>
          </div>
          <p class="feedback-note">${feedbackById[item.id]?'已记录，可重新选择。反馈仅保存在当前浏览器。':'选择结果仅保存在当前浏览器，不会上传。'}</p>
          <a class="correction-link" href="${correctionUrl(item)}" target="_blank" rel="noopener">发现事实或链接错误？提交纠错 ↗</a><span class="correction-requirement">需登录 GitHub</span>
        </section>
        <section class="source-proof"><h3 class="insight-label">来源与核验</h3><p><i class="grade ${item.grade.toLowerCase()}">${item.grade}</i> ${item.sourceType} · ${item.status}</p><dl><div><dt>原文标题</dt><dd>${item.sourceTitle}</dd></div><div><dt>评级理由</dt><dd>${item.sourceReason}</dd></div><div><dt>发布时间</dt><dd>${item.display}</dd></div><div><dt>核验时间</dt><dd>${item.verified}</dd></div></dl><div class="detail-links"><a class="source-link" href="${item.url}" target="_blank" rel="noopener" aria-label="查看精确原文（新窗口打开）">查看精确原文</a><a class="permalink" href="news/${item.id}/">打开独立阅读页</a></div></section>
      </aside>
    </article>`;
  dialogContent.querySelector('[data-dialog-save]').addEventListener('click',event=>toggleSaved(Number(event.currentTarget.dataset.dialogSave),'dialog'));
  dialogContent.querySelectorAll('[data-feedback]').forEach(button=>button.addEventListener('click',()=>submitFeedback(item.id,button.dataset.feedback)));
  dialogContent.querySelector('.source-link').addEventListener('click',()=>trackEvent('source_open',item.id,{surface:'detail'}));
}

document.querySelectorAll('[data-topic]').forEach(button=>button.addEventListener('click',()=>{trackEvent('filter_used',null,{kind:'topic',value:button.dataset.topic});selectTopic(button.dataset.topic);syncUrl();render()}));
let searchTimer;
search.addEventListener('input',()=>{syncUrl();render();window.clearTimeout(searchTimer);if(search.value.trim().length>=2)searchTimer=window.setTimeout(()=>trackEvent('search_used',null,{queryLength:search.value.trim().length}),500)});
regionFilter.addEventListener('change',()=>{trackEvent('filter_used',null,{kind:'region',value:regionFilter.value});syncUrl();render()});
timeFilter.addEventListener('change',()=>{trackEvent('filter_used',null,{kind:'time',value:timeFilter.value});syncUrl();render()});
savedFilter.addEventListener('click',()=>{savedOnly=!savedOnly;trackEvent('filter_used',null,{kind:'saved',value:savedOnly});syncUrl();render()});
clearSearch.addEventListener('click',()=>{search.value='';syncUrl();render();search.focus()});
resetFilters.addEventListener('click',resetDiscovery);
emptyReset.addEventListener('click',resetDiscovery);
document.querySelectorAll('.dialog-close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>{dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});dialog.addEventListener('close',()=>{if(dialog===newsDialog){const returnId=dialogReturnNewsId;openNewsId=null;dialogReturnNewsId=null;window.requestAnimationFrame(()=>document.querySelector(`[data-id="${returnId}"] .read-decision`)?.focus())}})});
const subscribeDialog=document.querySelector('#subscribeDialog');
document.querySelector('#subscribeBtn').addEventListener('click',()=>subscribeDialog.showModal());
document.querySelector('#rssOpen').addEventListener('click',()=>trackEvent('rss_open'));
document.querySelector('#copyFeed').addEventListener('click',async()=>{
  trackEvent('rss_copy');
  const feedUrl=new URL('feed.xml',window.location.href).href;
  const copyStatus=document.querySelector('#copyStatus');
  try{
    await navigator.clipboard.writeText(feedUrl);
    copyStatus.textContent='订阅地址已复制，可粘贴到 RSS 阅读器。';
  }catch{
    const field=document.createElement('textarea');field.value=feedUrl;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();
    const copied=document.execCommand('copy');field.remove();
    copyStatus.textContent=copied?'订阅地址已复制，可粘贴到 RSS 阅读器。':`订阅地址：${feedUrl}`;
  }
});
document.querySelector('#analyticsBtn').addEventListener('click',()=>{renderAnalytics();analyticsDialog.showModal()});
document.querySelector('#exportAnalytics').addEventListener('click',()=>{
  const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),events:analyticsEvents},null,2)],{type:'application/json'});
  const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`pink-ai-radar-events-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(link.href);
  analyticsStatus.textContent='本机事件数据已导出。';
});
document.querySelector('#clearAnalytics').addEventListener('click',()=>{
  if(!window.confirm('确定清除当前浏览器中的全部使用数据吗？此操作无法撤销。'))return;
  analyticsEvents=[];localStorage.removeItem(analyticsStorageKey);renderAnalytics();analyticsStatus.textContent='本机使用数据已清除。';
});

const initialParams=new URLSearchParams(window.location.search);
const initialTopic=initialParams.get('topic');
const initialRegion=initialParams.get('region');
const initialTime=initialParams.get('time');
const initialDate=initialParams.get('date');
search.value=initialParams.get('q')||'';
if(initialTopic&&Object.hasOwn(topicMap,initialTopic))selectTopic(initialTopic);
if(['global','china'].includes(initialRegion))regionFilter.value=initialRegion;
if(['3','7','30'].includes(initialTime))timeFilter.value=initialTime;
if(archiveDates.includes(initialDate))activeDate=initialDate;
savedOnly=initialParams.get('saved')==='1';
renderTrends();
render();
trackEvent('page_view');
if(initialParams.get('analytics')==='1'){renderAnalytics();analyticsDialog.showModal()}
const requestedNews=Number(initialParams.get('news'));
if(requestedNews)openNews(requestedNews);
if(['#briefing','#archive','#trends','#sources','#method'].includes(window.location.hash))window.addEventListener('load',()=>document.querySelector(window.location.hash)?.scrollIntoView({block:'start'}));
