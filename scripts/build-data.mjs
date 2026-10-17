import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const inputPath=resolve(root,'data/news.json');
const outputPath=resolve(root,'data/news.js');
const feedPath=resolve(root,'feed.xml');
const sitemapPath=resolve(root,'sitemap.xml');
const robotsPath=resolve(root,'robots.txt');
const requiredStrings=['source','icon','date','display','verified','status','title','summary','fact','background','why','url','accent','grade','sourceTitle','sourceReason','sourceType'];
const requiredArrays=['impact','actions','tags','group'];

const data=JSON.parse(await readFile(inputPath,'utf8'));
const errors=[];
const seenIds=new Set();
const seenTitles=new Set();
const seenUrls=new Set();

if(!Array.isArray(data)||data.length===0)errors.push('news.json 必须是非空数组');

for(const [index,item] of data.entries()){
  const label=`第 ${index+1} 条资讯`;
  if(!Number.isInteger(item.id)||item.id<1)errors.push(`${label}: id 必须是正整数`);
  if(seenIds.has(item.id))errors.push(`${label}: id ${item.id} 重复`);else seenIds.add(item.id);
  for(const field of requiredStrings){
    if(typeof item[field]!=='string'||!item[field].trim())errors.push(`${label}: ${field} 缺失`);
  }
  for(const field of requiredArrays){
    if(!Array.isArray(item[field])||item[field].length===0||item[field].some(value=>typeof value!=='string'||!value.trim()))errors.push(`${label}: ${field} 必须是非空字符串数组`);
  }
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||Number.isNaN(Date.parse(`${item.date}T00:00:00Z`)))errors.push(`${label}: date 必须是有效 YYYY-MM-DD`);
  if(!['A','B','C'].includes(item.grade))errors.push(`${label}: grade 只能是 A、B 或 C`);
  if(!/^#[0-9a-f]{6}$/i.test(item.accent))errors.push(`${label}: accent 必须是六位十六进制颜色`);
  try{const url=new URL(item.url);if(url.protocol!=='https:')errors.push(`${label}: url 必须使用 HTTPS`);if(url.pathname==='/'||(/\/news\/?$/.test(url.pathname)&&url.searchParams.size===0))errors.push(`${label}: url 必须指向精确原文，不能是网站首页或新闻列表`)}catch{errors.push(`${label}: url 无效`)}
  const normalizedTitle=item.title.trim().toLowerCase();
  if(seenTitles.has(normalizedTitle))errors.push(`${label}: 标题重复`);else seenTitles.add(normalizedTitle);
  if(seenUrls.has(item.url))errors.push(`${label}: 原文链接重复`);else seenUrls.add(item.url);
}

if(errors.length){
  console.error(`数据校验失败（${errors.length} 项）：`);
  errors.forEach(error=>console.error(`- ${error}`));
  process.exit(1);
}

const sorted=[...data].sort((a,b)=>b.date.localeCompare(a.date)||a.id-b.id);
const generatedOn=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const output=`// 此文件由 scripts/build-data.mjs 自动生成，请勿手动编辑。\nwindow.PINK_AI_META=${JSON.stringify({generatedOn,coverageThrough:sorted[0].date})};\nwindow.PINK_AI_NEWS=${JSON.stringify(sorted,null,2)};\n`;
const xmlEscape=value=>String(value).replace(/[<>&'\"]/g,character=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[character]));
const htmlEscape=value=>String(value).replace(/[<>&'\"]/g,character=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&#39;','"':'&quot;'}[character]));
const siteUrl='https://scott33333345-hue.github.io/pink-ai-radar/';
const feedItems=sorted.map(item=>`    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${siteUrl}news/${item.id}/</link>
      <guid isPermaLink="true">${siteUrl}news/${item.id}/</guid>
      <pubDate>${new Date(`${item.date}T12:00:00+08:00`).toUTCString()}</pubDate>
      <description>${xmlEscape(`${item.summary}\n\n为什么重要：${item.why}\n\n精确原文：${item.url}`)}</description>
      <category>${xmlEscape(item.source)}</category>
      <source url="${xmlEscape(item.url)}">${xmlEscape(item.source)}</source>
    </item>`).join('\n');
const feed=`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pink AI Radar</title>
    <link>${siteUrl}</link>
    <description>面向中文产品从业者的 AI 决策简报</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date(`${generatedOn}T12:00:00+08:00`).toUTCString()}</lastBuildDate>
    <atom:link xmlns:atom="http://www.w3.org/2005/Atom" href="${siteUrl}feed.xml" rel="self" type="application/rss+xml" />
${feedItems}
  </channel>
</rss>
`;

const absoluteImage=item=>item.image?new URL(item.image,siteUrl).href:`${siteUrl}assets/ai-trust-signal.jpg`;
const articlePage=item=>{
  const pageUrl=`${siteUrl}news/${item.id}/`;
  const tags=item.tags.map(tag=>`<span># ${htmlEscape(tag)}</span>`).join('');
  const list=items=>`<ul>${items.map(value=>`<li>${htmlEscape(value)}</li>`).join('')}</ul>`;
  const structuredData=JSON.stringify({
    '@context':'https://schema.org','@type':'Article',headline:item.title,description:item.summary,
    datePublished:item.date,dateModified:generatedOn,inLanguage:'zh-CN',mainEntityOfPage:pageUrl,
    image:absoluteImage(item),author:{'@type':'Organization',name:'Pink AI Radar',url:siteUrl},
    publisher:{'@type':'Organization',name:'Pink AI Radar',url:siteUrl}
  }).replaceAll('<','\\u003c');
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${htmlEscape(item.summary)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <meta name="theme-color" content="#fffafc">
  <link rel="canonical" href="${pageUrl}">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="zh_CN">
  <meta property="og:site_name" content="Pink AI Radar">
  <meta property="og:title" content="${htmlEscape(item.title)}">
  <meta property="og:description" content="${htmlEscape(item.summary)}">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:image" content="${absoluteImage(item)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="675">
  <meta property="article:published_time" content="${item.date}T12:00:00+08:00">
  <meta name="twitter:card" content="summary_large_image">
  <title>${htmlEscape(item.title)}｜Pink AI Radar</title>
  <link rel="alternate" type="application/rss+xml" title="Pink AI Radar RSS" href="../../feed.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../styles.css">
  <script type="application/ld+json">${structuredData}</script>
</head>
<body class="static-page">
  <a class="skip-link" href="#article">跳到文章内容</a>
  <header class="site-header static-header"><a class="brand" href="../../" aria-label="返回 Pink AI Radar 首页"><span class="logo">P</span><span>Pink AI Radar</span></a><a class="secondary" href="../../#briefing">浏览全部简报</a></header>
  <main class="static-main" id="article" tabindex="-1">
    <a class="static-back" href="../../#briefing">← 返回今日简报</a>
    <article class="static-article">
      <div class="static-content">
        <div class="article-meta"><span class="source-badge"><span class="source-icon" aria-hidden="true">${htmlEscape(item.icon)}</span>${htmlEscape(item.source)}</span><time datetime="${item.date}">${htmlEscape(item.display)}</time><span>${htmlEscape(item.status)}</span></div>
        <h1>${htmlEscape(item.title)}</h1>
        <p class="static-summary">${htmlEscape(item.summary)}</p>
        <div class="tags article-tags">${tags}</div>
        ${item.image?`<img class="static-image" src="../../${htmlEscape(item.image)}" alt="AI 信任与信息筛选的抽象视觉" width="1200" height="675" decoding="async">`:''}
        <section class="static-section"><h2>事实摘要</h2><p>${htmlEscape(item.fact)}</p></section>
        <section class="static-section"><h2>背景</h2><p>${htmlEscape(item.background)}</p></section>
      </div>
      <aside class="static-aside" aria-label="产品判断">
        <section><h2>为什么重要</h2><p>${htmlEscape(item.why)}</p></section>
        <section><h2>影响对象</h2>${list(item.impact)}</section>
        <section><h2>建议行动</h2>${list(item.actions)}</section>
        <section><h2>来源与核验</h2><p><strong>${htmlEscape(item.grade)} 级来源</strong> · ${htmlEscape(item.sourceType)} · ${htmlEscape(item.status)}</p><p>${htmlEscape(item.sourceReason)}</p><a class="static-source" href="${htmlEscape(item.url)}" target="_blank" rel="noopener" aria-label="查看 ${htmlEscape(item.source)} 精确原文（新窗口打开）">查看精确原文</a></section>
      </aside>
    </article>
  </main>
  <footer><div class="brand"><span class="logo">P</span><span>Pink AI Radar</span></div><p>少一点噪音，多一点确定。</p><span>© 2026 · Curated with care</span></footer>
</body>
</html>
`;
};
const articlePages=new Map(sorted.map(item=>[resolve(root,'news',String(item.id),'index.html'),articlePage(item)]));
const sitemap=`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}</loc><lastmod>${generatedOn}</lastmod></url>
${sorted.map(item=>`  <url><loc>${siteUrl}news/${item.id}/</loc><lastmod>${item.date}</lastmod></url>`).join('\n')}
</urlset>
`;
const robots=`User-agent: *
Allow: /
Sitemap: ${siteUrl}sitemap.xml
`;

if(process.argv.includes('--check')){
  const current=await readFile(outputPath,'utf8').catch(()=>null);
  const currentFeed=await readFile(feedPath,'utf8').catch(()=>null);
  const currentSitemap=await readFile(sitemapPath,'utf8').catch(()=>null);
  const currentRobots=await readFile(robotsPath,'utf8').catch(()=>null);
  const articleChecks=await Promise.all([...articlePages].map(async([file,contents])=>(await readFile(file,'utf8').catch(()=>null))===contents));
  if(current!==output||currentFeed!==feed||currentSitemap!==sitemap||currentRobots!==robots||articleChecks.some(valid=>!valid)){
    console.error('生成数据、RSS 或 SEO 页面不是最新版本，请运行 npm run data:build');
    process.exit(1);
  }
  console.log(`数据校验通过：${sorted.length} 条资讯，网页数据、RSS、站点地图与独立阅读页已同步。`);
}else{
  await writeFile(outputPath,output,'utf8');
  await writeFile(feedPath,feed,'utf8');
  await writeFile(sitemapPath,sitemap,'utf8');
  await writeFile(robotsPath,robots,'utf8');
  for(const [file,contents] of articlePages){await mkdir(resolve(file,'..'),{recursive:true});await writeFile(file,contents,'utf8')}
  console.log(`数据构建完成：${sorted.length} 条资讯 → 数据、RSS、站点地图与独立阅读页`);
}
