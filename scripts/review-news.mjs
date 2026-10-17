import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve(import.meta.dirname,'..');
const candidatesPath=resolve(root,'data/candidates.json');
const newsPath=resolve(root,'data/news.json');
const [command,arg1]=process.argv.slice(2);
const candidates=JSON.parse(await readFile(candidatesPath,'utf8'));

if(command==='list'){
  const pending=candidates.items.filter(item=>item.status==='pending');
  if(!pending.length)console.log('当前没有待审核候选。');
  for(const item of pending)console.log(`${item.candidateId}\t${item.publishedAt}\t${item.source}\t${item.title}`);
  process.exit(0);
}

if(command!=='approve'||!arg1){
  console.error('用法：node scripts/review-news.mjs list | approve <审核文件.json>');
  process.exit(1);
}

const reviewPath=resolve(process.cwd(),arg1);
const review=JSON.parse(await readFile(reviewPath,'utf8'));
const candidate=candidates.items.find(item=>item.candidateId===review.candidateId);
if(!candidate||candidate.status!=='pending')throw new Error('找不到对应的待审核候选，请检查 candidateId。');

const requiredStrings=['status','title','summary','fact','background','why','grade','sourceReason','accent'];
const requiredArrays=['impact','actions','tags','group'];
for(const field of requiredStrings)if(typeof review[field]!=='string'||!review[field].trim())throw new Error(`审核文件缺少 ${field}`);
for(const field of requiredArrays)if(!Array.isArray(review[field])||!review[field].length)throw new Error(`审核文件缺少 ${field}`);
if(!['A','B'].includes(review.grade))throw new Error('只有 A 或 B 级资讯可以发布。');

const news=JSON.parse(await readFile(newsPath,'utf8'));
if(news.some(item=>item.url===candidate.url))throw new Error('该原文已存在于正式资讯中。');
const now=new Date();
const shanghai=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(now);
const item={
  id:Math.max(0,...news.map(item=>item.id))+1,source:candidate.source,
  icon:[...candidate.source][0],date:candidate.publishedAt,display:candidate.publishedAt,
  verified:shanghai,status:review.status,title:review.title,summary:review.summary,
  fact:review.fact,background:review.background,why:review.why,impact:review.impact,
  actions:review.actions,url:candidate.url,tags:review.tags,group:review.group,
  accent:review.accent,grade:review.grade,sourceTitle:candidate.title,
  sourceReason:review.sourceReason,sourceType:candidate.sourceType
};
news.push(item);
candidate.status='approved';candidate.reviewedAt=now.toISOString();candidate.publishedNewsId=item.id;
await writeFile(newsPath,`${JSON.stringify(news,null,2)}\n`,'utf8');
await writeFile(candidatesPath,`${JSON.stringify(candidates,null,2)}\n`,'utf8');
const build=spawnSync(process.execPath,[resolve(root,'scripts/build-data.mjs')],{stdio:'inherit'});
if(build.status!==0)process.exit(build.status||1);
console.log(`审核发布完成：#${item.id} ${item.title}`);
