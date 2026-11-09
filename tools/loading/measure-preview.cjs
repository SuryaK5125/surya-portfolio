/** Local-only reproducible production timing server; never part of the site. */
const http=require('http'),fs=require('fs'),path=require('path');
const args=Object.fromEntries(process.argv.slice(2).map((v,i,a)=>v.startsWith('--')?[v.slice(2),a[i+1]]:null).filter(Boolean));
const root=path.resolve(args.root||'public'),out=path.resolve(args.out||'loading-measurements'),port=Number(args.port||4210),label=(args.label||'run').replace(/[^a-z0-9-]/gi,'');
fs.mkdirSync(out,{recursive:true});
const script=`(() => {
 const topPage=window===window.top, events=[],longTasks=[],frames=[],started=performance.timeOrigin;
 const round=n=>Math.round(n*10)/10;
 const resource=()=>performance.getEntriesByType('resource').filter(e=>e.name.startsWith(location.origin)).map(e=>({url:new URL(e.name).pathname,start:round(e.startTime),end:round(e.responseEnd),duration:round(e.duration),transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize,initiator:e.initiatorType}));
 const report=(phase)=>{const payload={label:${JSON.stringify(label)},page:location.pathname,started,phase,at:round(performance.now()),events,longTasks,resources:resource(),frameMs:frames.length?{count:frames.length,median:round([...frames].sort((a,b)=>a-b)[Math.floor(frames.length/2)]),p95:round([...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)])}:null};navigator.sendBeacon('/__measure/report',JSON.stringify(payload));console.info('[loading measure] '+phase+' '+round(performance.now())+' ms');};
 try{new PerformanceObserver(list=>list.getEntries().forEach(e=>longTasks.push({start:round(e.startTime),duration:round(e.duration)}))).observe({type:'longtask',buffered:true});}catch{}
 const mark=(name,detail)=>{events.push({name,at:round(performance.now()),detail});if(name!=='loadedSource')console.info('[loading measure] '+name+' '+round(performance.now())+' ms');};
 for(const name of ['loadedSource','loadingScreenDone','introStart','introDone','backgroundResourcesReady','sceneReady','enterMonitor','drawerFocusChange'])document.addEventListener(name,e=>{mark(name,e.detail);if(name==='introDone'&&topPage){let prev;const begin=performance.now();const frame=t=>{if(prev)frames.push(t-prev);prev=t;if(t-begin<3500)requestAnimationFrame(frame);else report('settled');};requestAnimationFrame(frame);report('interactive');}});
 addEventListener('load',()=>{mark('window-load');setTimeout(()=>report('window-loaded'),1000);});
 setTimeout(()=>report('watchdog'),45000);
})();`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.glb':'model/gltf-binary','.wasm':'application/wasm','.pdf':'application/pdf','.json':'application/json','.ico':'image/x-icon'};
let seq=0;
const server=http.createServer((req,res)=>{
 const requestAt=Date.now(),order=++seq;
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/__measure/report'&&req.method==='POST'){
  let body='';req.on('data',b=>{body+=b;if(body.length>2e6)req.destroy();});req.on('end',()=>{try{const j=JSON.parse(body);fs.writeFileSync(path.join(out,label+'-'+j.started+'-'+j.page.replace(/[^a-z0-9]/gi,'_')+'-'+j.phase+'.json'),JSON.stringify(j,null,2));res.writeHead(204);res.end();}catch{res.writeHead(400);res.end();}});return;
 }
 if(url.pathname==='/__measure.js'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end(script);}
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end();}
 let file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 try{
  if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
  let data=fs.readFileSync(file);const ext=path.extname(file);
  if(ext==='.html')data=Buffer.from(data.toString('utf8').replace('<head>','<head><script src="/__measure.js"></script>'));
  res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','Content-Length':data.length,'Cache-Control':ext==='.html'||args.cache!=='on'?'no-store':'public, max-age=3600'});
  res.end(req.method==='HEAD'?undefined:data);
  fs.appendFileSync(path.join(out,label+'-requests.jsonl'),JSON.stringify({order,path:url.pathname,bytes:data.length,start:requestAt,end:Date.now()})+'\n');
 }catch{res.writeHead(404);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log('Measurement preview http://127.0.0.1:'+port+' / '+label+' / asset cache '+(args.cache==='on'?'enabled':'disabled')));
