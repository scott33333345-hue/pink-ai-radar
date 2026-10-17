import {readFile,stat,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const siteUrl='https://scott33333345-hue.github.io/pink-ai-radar/';
const news=JSON.parse(await readFile(resolve(root,'data/news.json'),'utf8'));
const index=await readFile(resolve(root,'index.html'),'utf8');
const sitemap=await readFile(resolve(root,'sitemap.xml'),'utf8');
const robots=await readFile(resolve(root,'robots.txt'),'utf8');
const feed=await readFile(resolve(root,'feed.xml'),'utf8');
const image=await stat(resolve(root,'assets/ai-trust-signal.jpg'));

const requiredHome=[
  '<link rel="canonical"',
  '<meta property="og:title"',
  '<meta property="og:description"',
  '<meta property="og:image"',
  '<meta name="twitter:card"',
  '<script type="application/ld+json">'
];
const failures=[];
for(const marker of requiredHome)if(!index.includes(marker))failures.push(`首页缺少 ${marker}`);
if(!robots.includes(`Sitemap: ${siteUrl}sitemap.xml`))failures.push('robots.txt 未声明站点地图');
if(image.size>100000)failures.push(`分享图超过 100 KB：${image.size}`);

const pages=[];
for(const item of news){
  const url=`${siteUrl}news/${item.id}/`;
  const file=resolve(root,'news',String(item.id),'index.html');
  const html=await readFile(file,'utf8').catch(()=>null);
  if(!html){failures.push(`缺少资讯 ${item.id} 的独立页`);continue}
  const checks={
    canonical:html.includes(`<link rel="canonical" href="${url}">`),
    title:html.includes(`<title>${item.title}｜Pink AI Radar</title>`),
    description:html.includes('<meta name="description"'),
    openGraph:html.includes(`<meta property="og:url" content="${url}">`)&&html.includes('<meta property="og:image"'),
    structuredData:html.includes('"@type":"Article"'),
    visibleContent:html.includes(item.fact)&&html.includes(item.why),
    sitemap:sitemap.includes(`<loc>${url}</loc>`),
    feed:feed.includes(`<link>${url}</link>`)
  };
  for(const [name,passed] of Object.entries(checks))if(!passed)failures.push(`资讯 ${item.id} 未通过 ${name}`);
  pages.push({id:item.id,url,checks});
}

const result={
  checkedAt:new Date().toISOString(),
  home:{requiredMetadata:requiredHome.length,passed:failures.filter(value=>value.startsWith('首页')).length===0},
  articles:{expected:news.length,generated:pages.length,allChecksPassed:pages.every(page=>Object.values(page.checks).every(Boolean))},
  discovery:{robots:true,sitemapUrls:(sitemap.match(/<url>/g)||[]).length,feedItems:(feed.match(/<item>/g)||[]).length},
  performance:{shareImageBytes:image.size,shareImageBudgetBytes:100000,originalPngBytes:1642296,reductionPercent:Number((100-image.size/1642296*100).toFixed(1))},
  failures
};

if(process.argv.includes('--write-report'))await writeFile(resolve(root,'docs/step-16-performance-seo/seo-audit.json'),`${JSON.stringify(result,null,2)}\n`);
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exit(1);
