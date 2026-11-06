const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),test=require('node:test');
const appRoot=process.env.PKU_APP_ROOT||path.resolve(__dirname,'..');
const programNames=['main','glass','membrane','ceramic','foliage','stone','mapped','ground','shadow','skyProg','particles','post'];
function assertProgramOrder(q,people=false){const names=people?[...programNames,'peopleShadow']:programNames;assert.deepEqual(names.map(name=>q.e[name].p),q.programs);}
function setup(fail=null){
 const ctx=vm.createContext({YY:{}});vm.runInContext(fs.readFileSync(path.join(appRoot,'src/math.js'),'utf8'),ctx);for(const n of ['engine.js','pedestrians-v46.js'])vm.runInContext(fs.readFileSync(path.join(appRoot,'src',n),'utf8'),ctx);
 const shaders=[],programs=[],events=[],deletedShaders=[],deletedPrograms=[];let num=0;const gl={getExtension(){return null},isContextLost(){return false},VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,createShader(type){const s={id:++num,type};shaders.push(s);return s},shaderSource(s,src){s.src=src},compileShader(s){events.push(['compile',s.id])},createProgram(){const p={id:++num,stages:[]};programs.push(p);return p},attachShader(p,s){p.stages.push(s)},detachShader(){},linkProgram(p){events.push(['link',p.id]);if(fail==='linkThrow'&&p.stages.some(s=>s.src.includes('uPlaneDepth')))throw Error('injected link submit')},getShaderParameter(s){events.push(['checkShader',s.id]);return !(fail==='compile'&&s.src.includes('uPlaneDepth'))},getProgramParameter(p){events.push(['checkProgram',p.id]);return !(fail==='link'&&p.stages.some(s=>s.src.includes('uPlaneDepth')))},getShaderInfoLog(){return'injected compile'},getProgramInfoLog(){return'injected link'},deleteShader(s){deletedShaders.push(s.id)},deleteProgram(p){deletedPrograms.push(p.id)},bindVertexArray(){},deleteVertexArray(){},deleteBuffer(){},deleteSync(){},deleteTexture(){},deleteFramebuffer(){},deleteRenderbuffer(){}};
 const e=Object.assign(Object.create(ctx.YY.Engine.prototype),{gl,buckets:new Map(),visibilityCaches:new Map(),meshResources:[]});
 const walker=()=>Object.assign(Object.create(ctx.YY.Pedestrians46.Walkers.prototype),{engine:e,meshes:new Map()});return{e,walker,shaders,programs,events,deletedShaders,deletedPrograms,ctx};
}
test('moves same pedestrian program into deferred batch; first walker draws compile no program',()=>{
 const old=setup();old.e.compilePrograms(true,false);assertProgramOrder(old);assert.equal(old.programs.length,12);old.e.finishPrograms();const w0=old.walker();w0.ensureGPU();assert.equal(old.programs.length,13);
 const cur=setup();cur.e.compilePrograms(true,true);assertProgramOrder(cur,true);assert.equal(cur.programs.length,13);assert(!cur.events.some(e=>e[0].startsWith('check')));cur.e.finishPrograms();const before=cur.events.length,w=cur.walker();w.ensureGPU();assert.equal(cur.events.length,before);assert.equal(w.shadow,cur.e.peopleShadow);
 const src=q=>q.programs.map(p=>p.stages.map(s=>s.src));assert.deepEqual(src(cur),src(old));
 const lastLink=cur.events.map(e=>e[0]).lastIndexOf('link'),firstCheck=cur.events.findIndex(e=>e[0].startsWith('check'));assert(lastLink<firstCheck);
});
test('negative control disabled preparation preserves lazy program compilation and ownership',()=>{
 const q=setup();q.e.compilePrograms(true,false);q.e.finishPrograms();assert.equal(q.programs.length,12);const before=q.events.length,w=q.walker();w.ensureGPU();assert.equal(q.programs.length,13);assert(q.events.length>before);w.dispose();assert.deepEqual(q.deletedPrograms,[w.shadow.p.id]);q.e.dispose();assert.equal(new Set(q.deletedPrograms).size,13);assert.equal(q.deletedPrograms.length,13);
});
test('engine owns prepared program even when walkers never created; no double delete when used',()=>{
 for(const used of [false,true]){const q=setup();q.e.compilePrograms(true,true);q.e.finishPrograms();if(used){q.e.people=q.walker();q.e.people.ensureGPU();q.e.people.dispose();assert.equal(q.deletedPrograms.length,0);}q.e.dispose();q.e.dispose();assert.equal(q.deletedPrograms.length,13);assert.equal(new Set(q.deletedPrograms).size,13);assert.equal(q.deletedShaders.length,q.shaders.length);assert.equal(new Set(q.deletedShaders).size,q.shaders.length);}
});
test('compile/link validation failures and submission failure clean all pedestrian-program resources',()=>{
 for(const fail of ['compile','link','linkThrow']){const q=setup(fail);if(fail==='linkThrow')assert.throws(()=>q.e.compilePrograms(true,true),/injected/);else{q.e.compilePrograms(true,true);assert.throws(()=>q.e.finishPrograms(),/injected/);}q.e.dispose();assert.equal(q.deletedPrograms.length,13);assert.equal(new Set(q.deletedPrograms).size,13);assert.equal(q.deletedShaders.length,q.shaders.length);assert.equal(new Set(q.deletedShaders).size,q.shaders.length);}
});
test('cancellation before validation releases stages; recovery uses fresh program',()=>{
 const a=setup(),b=setup();a.e.compilePrograms(true,true);const old=a.e.peopleShadow;a.e.dispose();assert.equal(a.deletedPrograms.length,13);assert.equal(a.deletedShaders.length,a.shaders.length);b.e.compilePrograms(true,true);b.e.finishPrograms();assert.notEqual(b.e.peopleShadow,old);const w=b.walker();w.ensureGPU();assert.equal(w.shadow,b.e.peopleShadow);
});
test('actual app init requests preparation only for enabled nonisolated people, including recovery',async()=>{
 const src=fs.readFileSync(path.join(appRoot,'src/app-v29.js'),'utf8'),start=src.indexOf('async function init(recover=false){'),end=src.indexOf('\ncanvas.addEventListener',start);assert(start>=0&&end>start);const initSource=src.slice(start,end);
 for(const recover of [false,true])for(const people of [true,false])for(const isolate of [0,169]){
  const calls=[],created=[],state={people,isolate},nodes=new Map(),node=id=>{if(!nodes.has(id))nodes.set(id,{dataset:{},classList:{toggle(){},contains(){return false}},hidden:false});return nodes.get(id)},canvas={},root=node('root');let disposed=0,warmed=0;
  class Engine{constructor(c,options){assert.equal(c,canvas);assert.equal(options.deferPrograms,true);created.push(this)}resize(){}compilePrograms(...args){calls.push(args)}dispose(){}}
  const Y={SceneCache46:{warmup(){warmed++;return{dispose(){disposed++}}}},SCENE_PACKAGE46:{},Engine,Pedestrians46:{create(e,c,s){assert.equal(e,created[0]);assert.equal(s,state);return{}}}};
  const noop=()=>{},ctx=vm.createContext({YY:{},qualityPreset:'high',performance,Y,state,canvas,root,$:node,renderCatalog:noop,routeOptions:noop,credit:noop,localStorage:{getItem(){return null}},innerWidth:1440,innerHeight:1000,syncDisclosure:noop,fitRegion:noop,renderGeneration:0,engine:null,loadRenderResources:async()=>({}),campus:null,ready:false,lastVisualKey:'',last:1,lastDraw:1,D:{features:[]},window:{},orbit:{},planView:{},mode:'3d',select:noop,changeMode:noop,developmentReferences:false,frameRequest:1,cancelAnimationFrame:noop,requestAnimationFrame(){return 2},tick:noop,console:{error(e){throw e}}});
  const helperStart=src.indexOf('/* Time-based orbit transitions.'),helperEnd=src.indexOf('/* Campus viewer */',helperStart);assert(helperStart>=0&&helperEnd>helperStart);
  vm.runInContext(src.slice(helperStart,helperEnd),ctx);
  for(const name of ['panelLayoutOffset','finishPanelOffset','syncHighCPUControl']){const line=src.split('\n').find(s=>s.startsWith('function '+name+'('));assert(line);vm.runInContext(line,ctx);}
  ctx.panelOffset=new ctx.YY.PanelOffset(ctx.panelLayoutOffset());
  const init=vm.runInContext('('+initSource+')',ctx);await init(recover);assert.equal(calls.length,1);assert.equal(calls[0][0],true);assert.equal(calls[0][1],people&&!isolate);assert.equal(warmed,1);assert.equal(disposed,1);assert.equal(ctx.ready,true);assert.equal(root.dataset.ready,'true');
 }
});
