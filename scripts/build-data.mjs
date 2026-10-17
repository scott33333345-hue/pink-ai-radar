import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const inputPath=resolve(root,'data/news.json');
const outputPath=resolve(root,'data/news.js');
const feedPath=resolve(root,'feed.xml');
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
const siteUrl='https://scott33333345-hue.github.io/pink-ai-radar/';
const feedItems=sorted.map(item=>`    <item>
      <title>${xmlEscape(item.title)}</title>
      <link>${siteUrl}?news=${item.id}</link>
      <guid isPermaLink="false">pink-ai-radar-${item.id}</guid>
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

if(process.argv.includes('--check')){
  const current=await readFile(outputPath,'utf8').catch(()=>null);
  const currentFeed=await readFile(feedPath,'utf8').catch(()=>null);
  if(current!==output||currentFeed!==feed){
    console.error('生成数据不是最新版本，请运行 npm run data:build');
    process.exit(1);
  }
  console.log(`数据校验通过：${sorted.length} 条资讯，网页数据与 RSS 已同步。`);
}else{
  await writeFile(outputPath,output,'utf8');
  await writeFile(feedPath,feed,'utf8');
  console.log(`数据构建完成：${sorted.length} 条资讯 → data/news.js + feed.xml`);
}
