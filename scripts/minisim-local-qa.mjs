#!/usr/bin/env node
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import { runRingTowerPlaythrough } from "./minisim-ring-tower-playthrough.mjs";

const HANDLE_FILES={
 "bcm-mini-sim-js":"mini-sim/assets/js/mini-sim.js",
 "bcm-deep-space-warp-js":"mini-sim/assets/js/deep-space-warp.js",
 "bcm-crew-wallet-js":"mini-sim/assets/js/crew-wallet.js",
 "bcm-tower-js":"mini-sim/tower/assets/js/tower.js",
 "bcm-mini-sim-css":"mini-sim/assets/css/mini-sim.css",
 "bcm-tower-css":"mini-sim/tower/assets/css/tower.css"
};
function wordpressHandleMap(html,pageUrl){
 const map=new Map();
 for(const tag of html.match(/<(?:script|link)\b[^>]*>/gi)||[]){
  const id=(tag.match(/\bid=["']([^"']+)["']/i)||[])[1];
  const file=HANDLE_FILES[id];
  if(!file)continue;
  const ref=(tag.match(/\b(?:src|href)=["']([^"']+)["']/i)||[])[1];
  if(!ref)continue;
  try{map.set(new URL(ref.replace(/&amp;/g,"&"),pageUrl).href.split("#")[0],file);}catch(e){}
 }
 return map;
}
const root=process.cwd(),argv=process.argv.slice(2);
const requireQa=createRequire(resolve(root,"tools/minisim-qa/package.json"));
let chromium;
try { ({chromium}=requireQa("playwright")); }
catch(e) { console.error("Playwright is not installed in tools/minisim-qa. Run: cd tools/minisim-qa && npm install && npx playwright install chromium"); process.exit(2); }
const arg=k=>{const i=argv.indexOf(k);return i>=0?argv[i+1]:"";};
const url=arg("--url")||process.env.MINISIM_URL||"",full=argv.includes("--full-media"),headed=argv.includes("--headed"),ringTower=argv.includes("--ring-tower");
const standalone=process.env.MINISIM_QA_TARGET_KIND==="standalone-repository-build";
const out=resolve(root,".qa-artifacts");
const report={targetUrl:url,mode:full?"full-media":"light-media",startedAt:new Date().toISOString(),overrides:[],pluginAssetRequests:[],blockedVideos:[],httpErrors:[],consoleErrors:[],pageErrors:[],failedRequests:[],checks:[],screenshots:[]};
const check=(ok,message)=>{report.checks.push({ok:!!ok,message});if(!ok)throw Error(message);};
const shot=async(page,name)=>{await page.screenshot({path:resolve(out,name),fullPage:false});report.screenshots.push(".qa-artifacts/"+name);};
const mime=p=>({".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".gif":"image/gif",".mp4":"video/mp4",".webm":"video/webm",".mp3":"audio/mpeg",".wav":"audio/wav",".m4a":"audio/mp4",".ogg":"audio/ogg"}[extname(p).toLowerCase()]||"application/octet-stream");
const isVideo=p=>/\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(p);
if(!url){console.error('Usage: npm run qa:minisim -- --url "http://localhost/mini-sim-page/" [--headed] [--full-media]');process.exit(2);}
await mkdir(out,{recursive:true});
let handleMap=new Map();
try{
 const pre=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(60000)});
 report.preflightStatus=pre.status;
 if(pre.ok)handleMap=wordpressHandleMap(await pre.text(),pre.url||url);
}catch(e){report.preflightError=String(e&&e.message?e.message:e);}
report.handleAliases=[...handleMap.entries()].map(([requested,file])=>({requested,file}));
let browser,page;
try{
 browser=await chromium.launch({headless:!headed});
 const context=await browser.newContext({viewport:{width:1440,height:900},ignoreHTTPSErrors:true});
 await context.addInitScript(({ qaEnabled })=>{
   window.__BCM_QA_ENABLED=!!qaEnabled;
   window.__BCM_QA_MEDIA=new Set();window.__BCM_QA_MEDIA_EVENTS=[];
   const create=Document.prototype.createElement;
   Document.prototype.createElement=function(name,options){const node=create.call(this,name,options);if(["audio","video"].includes(String(name).toLowerCase()))window.__BCM_QA_MEDIA.add(node);return node;};
   const play=HTMLMediaElement.prototype.play;
   HTMLMediaElement.prototype.play=function(){window.__BCM_QA_MEDIA.add(this);window.__BCM_QA_MEDIA_EVENTS.push({action:"play",tag:this.tagName,src:this.currentSrc||this.src||"",at:performance.now()});return play.apply(this,arguments);};
   const pause=HTMLMediaElement.prototype.pause;
   HTMLMediaElement.prototype.pause=function(){window.__BCM_QA_MEDIA.add(this);window.__BCM_QA_MEDIA_EVENTS.push({action:"pause",tag:this.tagName,src:this.currentSrc||this.src||"",at:performance.now()});return pause.apply(this,arguments);};
 },{qaEnabled:ringTower});
 page=await context.newPage();
 page.setDefaultTimeout(20000);
 page.setDefaultNavigationTimeout(60000);
 page.on("request",r=>{if(r.url().includes("/wp-content/plugins/mini-sim/"))report.pluginAssetRequests.push(r.url());});
 page.on("console",m=>{if(m.type()==="error")report.consoleErrors.push(m.text());});
 page.on("pageerror",e=>report.pageErrors.push(String(e&&e.stack?e.stack:e)));
 page.on("response",r=>{if(r.status()>=400)report.httpErrors.push({url:r.url(),status:r.status()});});
 page.on("requestfailed",r=>{const e=r.failure()?.errorText||"";if(e.includes("ERR_ABORTED")||(!full&&isVideo(r.url())))return;report.failedRequests.push({url:r.url(),error:e});});
 await page.route("**/*",async route=>{
   const req=route.request().url();let path;
   const fulfillLocal=async(file)=>{
     const local=resolve(root,file);
     const info=await stat(local);
     if(!info.isFile())return false;
     const body=await readFile(local);
     report.overrides.push({requested:req,file,bytes:info.size});
     await route.fulfill({status:200,contentType:mime(local),body,headers:{"cache-control":"no-store"}});
     return true;
   };
   const alias=handleMap.get(req.split("#")[0]);
   if(alias){try{if(await fulfillLocal(alias))return;}catch(e){}}
   try{path=decodeURIComponent(new URL(req).pathname);}catch(e){return route.continue();}
   if(!full&&isVideo(path)){report.blockedVideos.push(req);return route.abort("blockedbyclient");}
   const marker="/wp-content/plugins/mini-sim/",i=path.indexOf(marker);
   if(i>=0){
     const rel=path.slice(i+marker.length).replace(/^\/+/,""),base=resolve(root,"mini-sim"),local=resolve(base,rel);
     if(local.startsWith(base+sep)){
       try{if(await fulfillLocal(local.slice(root.length+1).split(sep).join("/")))return;}catch(e){}
     }
   }
   return route.continue();
 });
 const response=await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
 report.httpStatus=response?response.status():null;
 await page.locator(".bcm-mini-sim").first().waitFor({state:"attached",timeout:30000});
 await page.locator(".bcm-mini-sim-canvas").first().waitFor({state:"visible",timeout:30000});
 await page.waitForTimeout(900);await shot(page,"01-menu.png");
 check(!!response&&response.status()<400,standalone?"Standalone QA fixture responds successfully":"WordPress page responds successfully");
 check(await page.locator(".bcm-mini-sim").count()>0,standalone?"Mini-Sim fixture root is present":"Mini-Sim shortcode is present");
 check(report.overrides.some(item=>item.file==="mini-sim/assets/js/mini-sim.js"),"Main Mini-Sim JavaScript is served from this GitHub commit");
 check(report.overrides.some(item=>item.file==="mini-sim/assets/js/deep-space-warp.js"),"Warp JavaScript is served from this GitHub commit");
 check(report.overrides.some(item=>item.file==="mini-sim/assets/css/mini-sim.css"),"Mini-Sim CSS is served from this GitHub commit");
 await page.locator(".bcm-mini-sim-start").first().click({timeout:12000});
 await page.locator(".bcm-mini-sim-crew-preflight:not([hidden])").first().waitFor({state:"visible",timeout:12000});
 await shot(page,"02-crew-preflight.png");
 const start=page.locator("[data-crew-start]").first();await start.waitFor({state:"visible",timeout:10000});await start.click({timeout:12000});
 try{await page.waitForFunction(()=>{const r=document.querySelector(".bcm-mini-sim");return !!r&&r.classList.contains("game-active")&&!!window.BCMiniSimAPI;},null,{timeout:30000});}
 catch(e){const status=await page.locator(".bcm-mini-sim-crew-preflight-status").first().textContent().catch(()=>"");throw Error("Crew preflight did not start: "+(status||e.message));}
 check(true,"flight starts from Crew preflight");
 const before=await page.evaluate(()=>{const p=window.BCMiniSimAPI?.getRuntime?.()?.ship?.position;return p?[p.x,p.y,p.z]:null;});
 await page.keyboard.press("V");await page.locator(".bcm-warp-overlay:not([hidden])").first().waitFor({state:"visible",timeout:10000});await page.waitForTimeout(250);await shot(page,"03-warp-map.png");
 const current=await page.locator("[data-warp-current]").first().textContent();
 check(/ONI CSS|NEUNO|-40|TEST/i.test(current||""),"WARP map shows its current start point");
 const activeAudio=async()=>page.evaluate(()=>{const all=new Set([...(window.__BCM_QA_MEDIA||[]),...document.querySelectorAll("audio")]);return [...all].filter(a=>a&&a.tagName==="AUDIO"&&!a.paused&&!a.ended&&!a.muted&&a.volume>0).map(a=>({src:a.currentSrc||a.src||"",time:a.currentTime}));});
 const mapAudio=await activeAudio();report.audioOnMap=mapAudio;
 check(mapAudio.length===1&&/warp\.mp3/i.test(mapAudio[0].src),"Warp OST is audible already on the map");
 const mapTrackTime=mapAudio[0]?.time||0;
 const neighbor=page.locator('[data-warp-grid] .bcm-warp-grid-cell.is-connected').first();await neighbor.waitFor({state:"visible",timeout:15000});await neighbor.click();
 await page.locator("[data-warp-start]").click();await page.locator('[data-warp-view="tube"]:not([hidden])').waitFor({state:"visible",timeout:8000});await page.waitForTimeout(700);await shot(page,"04-tube.png");
 check(true,"choosing a neighbour opens Tube");
 const during=await activeAudio();report.audioDuringTube=during;
 check(during.length===1&&/warp\.mp3/i.test(during[0].src),"Warp OST remains the only audible track in Tube");
 check(during[0].time>mapTrackTime,"Warp OST continues forward instead of resetting when Tube begins");
 await page.locator("[data-tube-abort]").waitFor({state:"visible",timeout:55000});
  check(true,"Tube reaches its result screen and exposes the explicit cancel action");
  await shot(page,"04b-tube-result.png");
  await page.locator("[data-tube-abort]").click();
  await page.waitForFunction(()=>!!document.querySelector(".bcm-warp-overlay[hidden]"),null,{timeout:8000});await page.waitForTimeout(350);
 const after=await page.evaluate(()=>{const p=window.BCMiniSimAPI?.getRuntime?.()?.ship?.position,all=new Set([...(window.__BCM_QA_MEDIA||[]),...document.querySelectorAll("audio")]);return{position:p?[p.x,p.y,p.z]:null,audio:[...all].filter(a=>a&&a.tagName==="AUDIO"&&!a.paused&&!a.ended&&!a.muted&&a.volume>0).map(a=>a.currentSrc||a.src||"")};});
 report.afterCancel=after;await shot(page,"05-after-cancel.png");
 check(!!before&&!!after.position&&after.position.every((v,i)=>Math.abs(v-before[i])<1),"cancel restores the ship position");
 check(after.audio.length===1&&!/warp\\.mp3/i.test(after.audio[0]),"cancel stops Warp OST and restores the normal flight OST");
 if(ringTower)await runRingTowerPlaythrough({page,report,shot});
 const benignConsole=text=>!full&&/ERR_BLOCKED_BY_CLIENT/.test(text);
 const benignPage=text=>{const m=String(text).match(/base64,([A-Za-z0-9+/=]+)/);if(!m)return false;try{return Buffer.from(m[1],"base64").toString("utf8").includes("wy-preloader");}catch(e){return false;}};
 report.seriousConsoleErrors=report.consoleErrors.filter(text=>!benignConsole(text));
 report.seriousPageErrors=report.pageErrors.filter(text=>!benignPage(text));
 report.pluginHttpErrors=report.httpErrors.filter(item=>item.url.includes("/wp-content/plugins/mini-sim/")&&(full||!isVideo(item.url)));
 report.status=report.checks.every(c=>c.ok)&&report.seriousPageErrors.length===0&&report.pluginHttpErrors.length===0?"PASS":"FAIL";
}catch(e){report.status="FAIL";report.error=String(e&&e.stack?e.stack:e);if(page){try{await shot(page,"failure.png");}catch(_){}}}
finally{
 report.finishedAt=new Date().toISOString();
 try{await writeFile(resolve(out,"minisim-qa-report.json"),JSON.stringify(report,null,2)+"\n","utf8");}catch(e){}
 if(browser)await browser.close().catch(()=>{});
}
console.log(JSON.stringify({status:report.status,url:report.targetUrl,checks:report.checks,journey:report.journey?.summary||null,localOverrides:report.overrides.length,overriddenFiles:[...new Set(report.overrides.map(item=>item.file))],pluginHttpErrors:report.pluginHttpErrors,httpErrors:report.httpErrors,blockedVideoRequests:report.blockedVideos.length,seriousConsoleErrors:report.seriousConsoleErrors,seriousPageErrors:report.seriousPageErrors,consoleErrors:report.consoleErrors,pageErrors:report.pageErrors,failedRequests:report.failedRequests,screenshots:report.screenshots,report:".qa-artifacts/minisim-qa-report.json",error:report.error},null,2));
if(report.status!=="PASS")process.exitCode=1;
