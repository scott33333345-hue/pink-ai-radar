import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const sourcePath=resolve(root,'config/sources.json');
const newsPath=resolve(root,'data/news.json');
const outputPath=resolve(root,'data/candidates.json');
const maxAgeDays=Number(process.env.COLLECT_MAX_AGE_DAYS||30);

const decode=value=>value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')
  .replace(/<[^>]+>/g,' ')
  .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
  .replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'")
  .replace(/\s+/g,' ').trim();
const tag=(block,names)=>{
  for(const name of names){
    const match=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'));
    if(match)return decode(match[1]);
  }
  return '';
};
const linkFrom=block=>{
  const atom=block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return atom?.[1]||tag(block,['link','guid']);
};
const isoDate=value=>{
  const parsed=new Date(value);
  return Number.isNaN(parsed.valueOf())?null:parsed.toISOString().slice(0,10);
};
const candidateId=(source,url)=>`${source}-${createHash('sha256').update(url).digest('hex').slice(0,10)}`;

function parseFeed(xml,source){
  const blocks=[...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(match=>match[2]);
  return blocks.map(block=>{
    const url=linkFrom(block);
    const title=tag(block,['title']);
    const publishedRaw=tag(block,['pubDate','published','updated','dc:date']);
    const publishedAt=isoDate(publishedRaw);
    if(!title||!url||!publishedAt)return null;
    let normalizedUrl;
    try{const parsed=new URL(url);parsed.hash='';normalizedUrl=parsed.toString();}catch{return null;}
    return {
      candidateId:candidateId(source.id,normalizedUrl),sourceId:source.id,source:source.name,
      sourceType:'官方原始来源',title,url:normalizedUrl,publishedAt,
      collectedAt:new Date().toISOString(),status:'pending',group:source.defaultGroup||[]
    };
  }).filter(Boolean);
}

const sources=JSON.parse(await readFile(sourcePath,'utf8')).filter(source=>source.enabled);
const published=JSON.parse(await readFile(newsPath,'utf8'));
const previous=JSON.parse(await readFile(outputPath,'utf8')).items||[];
const knownUrls=new Set(published.map(item=>item.url));
const previousByUrl=new Map(previous.map(item=>[item.url,item]));
const cutoff=Date.now()-maxAgeDays*86400000;
const results=[];
const sourceReports=[];

for(const source of sources){
  try{
    const response=await fetch(source.url,{redirect:'follow',headers:{'user-agent':'PinkAIRadar/1.0 (+GitHub Actions)'}});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const items=parseFeed(await response.text(),source)
      .filter(item=>Date.parse(`${item.publishedAt}T23:59:59Z`)>=cutoff)
      .filter(item=>!knownUrls.has(item.url))
      .map(item=>previousByUrl.get(item.url)||item);
    results.push(...items);
    sourceReports.push({id:source.id,name:source.name,status:'ok',found:items.length});
  }catch(error){
    sourceReports.push({id:source.id,name:source.name,status:'error',message:error.message});
  }
}

const unique=[...new Map(results.map(item=>[item.url,item])).values()]
  .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)||a.title.localeCompare(b.title));
const output={generatedAt:new Date().toISOString(),windowDays:maxAgeDays,sources:sourceReports,items:unique};
await writeFile(outputPath,`${JSON.stringify(output,null,2)}\n`,'utf8');
console.log(`采集完成：${unique.length} 条待审核候选；${sourceReports.filter(item=>item.status==='ok').length}/${sources.length} 个来源成功。`);
for(const report of sourceReports)console.log(`- ${report.name}: ${report.status==='ok'?`${report.found} 条`:report.message}`);
if(sourceReports.every(item=>item.status==='error'))process.exitCode=1;
