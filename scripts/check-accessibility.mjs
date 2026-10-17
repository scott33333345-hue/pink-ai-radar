import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root=process.cwd();
const outputDir=path.resolve("docs/step-15-accessibility");
const browserPort=9444;
const sitePort=4273;
const edge="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const mime={".html":"text/html",".css":"text/css",".js":"text/javascript",".json":"application/json",".svg":"image/svg+xml",".webp":"image/webp"};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

await mkdir(outputDir,{recursive:true});
const server=createServer(async(request,response)=>{
  try{
    const pathname=new URL(request.url,`http://127.0.0.1:${sitePort}`).pathname;
    const relative=pathname==="/"?"index.html":decodeURIComponent(pathname.slice(1));
    const file=path.resolve(root,relative);
    if(!file.startsWith(`${root}${path.sep}`)&&file!==path.join(root,"index.html"))throw new Error("invalid path");
    const body=await readFile(file);
    response.writeHead(200,{"Content-Type":`${mime[path.extname(file)]||"application/octet-stream"}; charset=utf-8`});
    response.end(body);
  }catch{response.writeHead(404);response.end("Not found")}
});
await new Promise(resolve=>server.listen(sitePort,"127.0.0.1",resolve));

const browser=spawn(edge,["--headless=new","--disable-gpu","--no-first-run",`--remote-debugging-port=${browserPort}`,`--user-data-dir=${path.join(outputDir,".edge-a11y-profile")}`,"about:blank"],{stdio:"ignore",windowsHide:true});
let endpoint;
for(let attempt=0;attempt<30;attempt+=1){
  try{const pages=await fetch(`http://127.0.0.1:${browserPort}/json/list`).then(response=>response.json());endpoint=pages.find(page=>page.type==="page")?.webSocketDebuggerUrl;if(endpoint)break}catch{}
  await sleep(250);
}
if(!endpoint)throw new Error("Could not connect to Edge");

const socket=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{socket.addEventListener("open",resolve,{once:true});socket.addEventListener("error",reject,{once:true})});
let id=1;
const pending=new Map();
socket.addEventListener("message",event=>{const message=JSON.parse(event.data);if(!message.id||!pending.has(message.id))return;const handlers=pending.get(message.id);pending.delete(message.id);message.error?handlers.reject(new Error(message.error.message)):handlers.resolve(message.result)});
const command=(method,params={})=>{const callId=id++;socket.send(JSON.stringify({id:callId,method,params}));return new Promise((resolve,reject)=>pending.set(callId,{resolve,reject}))};
const evaluate=async expression=>JSON.parse((await command("Runtime.evaluate",{expression:`JSON.stringify(${expression})`,returnByValue:true})).result.value);
const key=async value=>{
  const code=value===" "?"Space":value;
  const virtualKey=value==="Enter"?13:value===" "?32:value==="Tab"?9:value==="Escape"?27:0;
  const params={key:value,code,windowsVirtualKeyCode:virtualKey,nativeVirtualKeyCode:virtualKey};
  await command("Input.dispatchKeyEvent",{type:"rawKeyDown",...params});
  if(value==="Enter")await command("Input.dispatchKeyEvent",{type:"char",...params,text:"\r",unmodifiedText:"\r"});
  await command("Input.dispatchKeyEvent",{type:"keyUp",...params});
};
const screenshot=async file=>{const result=await command("Page.captureScreenshot",{format:"png",fromSurface:true});await writeFile(path.join(outputDir,file),Buffer.from(result.data,"base64"))};

await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride",{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
await command("Page.navigate",{url:`http://127.0.0.1:${sitePort}/?qa=step15`});
await sleep(2500);

const staticAudit=await evaluate(`(()=>{
  const interactive='a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
  const visible=element=>element.getClientRects().length>0&&!element.closest('[hidden]');
  const name=element=>element.getAttribute('aria-label')||element.getAttribute('aria-labelledby')||element.textContent.trim()||element.getAttribute('placeholder')||'';
  const ids=[...document.querySelectorAll('[id]')].map(element=>element.id);
  return {
    language:document.documentElement.lang,
    mainCount:document.querySelectorAll('main').length,
    skipLink:Boolean(document.querySelector('.skip-link[href="#main-content"]')),
    dialogs:[...document.querySelectorAll('dialog')].every(dialog=>dialog.hasAttribute('aria-labelledby')),
    unnamed:[...document.querySelectorAll(interactive)].filter(element=>visible(element)&&!name(element)).length,
    duplicateIds:[...new Set(ids.filter((value,index)=>ids.indexOf(value)!==index))],
    imagesWithoutAlt:[...document.images].filter(image=>!image.hasAttribute('alt')).length,
    nestedInteractive:[...document.querySelectorAll(interactive)].filter(element=>element.parentElement?.closest(interactive)).length
  };
})()`);

await key("Tab");
const skipFocused=await evaluate(`({className:document.activeElement.className,text:document.activeElement.textContent.trim()})`);
await screenshot("03-skip-link-focus.png");
await key("Enter");
const skipTarget=await evaluate(`({id:document.activeElement.id})`);

await command("Runtime.evaluate",{expression:`document.querySelector('.read-decision').focus()`});
await screenshot("04-card-action-focus.png");
await key("Enter");
await sleep(300);
const dialogOpened=await evaluate(`({open:document.querySelector('#newsDialog').open,labelledBy:document.querySelector('#newsDialog').getAttribute('aria-labelledby'),active:document.activeElement.className})`);
await screenshot("05-detail-keyboard.png");

await command("Runtime.evaluate",{expression:`document.querySelector('[data-dialog-save]').focus()`});
await key("Enter");
await sleep(100);
const saveFocus=await evaluate(`({active:document.activeElement.hasAttribute('data-dialog-save'),pressed:document.activeElement.getAttribute('aria-pressed')})`);
await command("Runtime.evaluate",{expression:`document.querySelector('[data-feedback="helpful"]').focus()`});
await key("Enter");
await sleep(100);
const feedbackFocus=await evaluate(`({active:document.activeElement.dataset.feedback,pressed:document.activeElement.getAttribute('aria-pressed')})`);
await screenshot("06-feedback-focus.png");
await key("Escape");
await sleep(100);
const focusReturn=await evaluate(`({closed:!document.querySelector('#newsDialog').open,active:document.activeElement.className})`);

const result={staticAudit,skipFocused,skipTarget,dialogOpened,saveFocus,feedbackFocus,focusReturn};
await writeFile(path.join(outputDir,"keyboard-audit.json"),`${JSON.stringify(result,null,2)}\n`);
process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
await command("Browser.close");
socket.close();
server.close();
