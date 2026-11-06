/* Ground-level navigation uses the existing road graph, without changing scene geometry. */
(function(Y){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function project(p,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1),0,1);return[a[0]+dx*t,a[1]+dz*t];}
class FirstPerson {
 constructor(graph,{ground=()=>0,blocked=()=>false,clear=(p,r)=>!blocked(p),crosses=()=>false,groundClear=()=>true,entryRadius=()=>12,snapBlocked=blocked}={}){
  this.ground=ground;this.blocked=blocked;this.clear=clear;this.crosses=crosses;this.groundClear=groundClear;this.entryRadius=entryRadius;this.snapBlocked=snapBlocked;this.position=[0,0];this.yaw=0;this.pitch=0;this.component=null;this.cells=new Map();
  const roots=graph.nodes.map((_,i)=>i),find=i=>{while(roots[i]!==i){roots[i]=roots[roots[i]];i=roots[i]}return i;};
  for(const e of graph.edges)roots[find(e.a)]=find(e.b);
  this.segments=graph.edges.flatMap(e=>e.points.slice(1).map((b,i)=>({a:e.points[i],b,width:Math.max(.65,(e.w||3)/2-.3),component:find(e.a)}))).filter(s=>distance(s.a,s.b)>.001);
  for(const s of this.segments)for(let x=Math.floor((Math.min(s.a[0],s.b[0])-s.width)/24);x<=Math.floor((Math.max(s.a[0],s.b[0])+s.width)/24);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-s.width)/24);z<=Math.floor((Math.max(s.a[1],s.b[1])+s.width)/24);z++){const key=x+','+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(s);}
 }
 enter(point,yaw=0){
  let best=null,bestDistance=Infinity;
  for(const s of this.segments){const p=project(point,s.a,s.b),d=distance(point,p);if(d<bestDistance&&!this.snapBlocked(p)){best={p,s};bestDistance=d;}}
  if(!best)return false;
  this.position=best.p;this.component=best.s.component;this.yaw=yaw;this.pitch=0;return true;
 }
 // Free browsing starts near the existing snap, with room to look along the road.
 // Explicit route entry keeps enter() and its exact projection unchanged.
 enterNearby(point,yaw=0){
  const saved={position:this.position,component:this.component,yaw:this.yaw,pitch:this.pitch};
  if(!this.enter(point,yaw))return false;
  // The source road graph may pass across an excavated court/raised bridge where
  // the generic ground-height function is not a walk surface. Choose the initial
  // overhead-to-ground snap outside that registered model region, on this component.
  if(!this.groundClear(this.position,1.2)){
   const original=this.position,radius=this.entryRadius(original);let seed=null;
   for(const s of this.segments){if(s.component!==this.component)continue;for(const p of [project(point,s.a,s.b),s.a,s.b]){
    if(distance(original,p)>radius||!this.clear(p,1.2))continue;
    const d=distance(point,p);if(!seed||d<seed.d)seed={p,d};
   }}
   if(!seed){Object.assign(this,saved);return false;}this.position=seed.p.slice();
  }
  const anchor=this.position;let best=null;
  const pathClear=p=>{if(this.crosses(anchor,p))return false;const n=Math.max(1,Math.ceil(distance(anchor,p)/.18));for(let i=1;i<=n;i++)if(!this.allowed([anchor[0]+(p[0]-anchor[0])*i/n,anchor[1]+(p[1]-anchor[1])*i/n]))return false;return true;};
  for(const s of this.segments){
   if(s.component!==this.component)continue;
   const base=project(anchor,s.a,s.b),len=distance(s.a,s.b),ux=(s.b[0]-s.a[0])/len,uz=(s.b[1]-s.a[1])/len;
   if(distance(anchor,base)>12)continue;
   for(const offset of [0,-1,1,-2,2,-4,4,-8,8,-12,12]){
    const p=project([base[0]+ux*offset,base[1]+uz*offset],s.a,s.b),d=distance(anchor,p);
    if(d>12||!this.clear(p,1.2)||!pathClear(p))continue;
    const tangent=Math.atan2(ux,-uz);
    for(const heading of [yaw,tangent,tangent+Math.PI]){
     // Check a narrow forward corridor, not just a ray touching a facade.
     let visible=0;for(let t=.5;t<=8;t+=.5){if(!this.clear([p[0]+Math.sin(heading)*t,p[1]-Math.cos(heading)*t],.8))break;visible=t;}
     if(visible<6)continue;
     const turn=Math.abs(Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw))),score=d+turn*.35;
     if(!best||score<best.score)best={p,heading,score};
    }
   }
  }
  if(!best){Object.assign(this,saved);return false;}
  this.position=best.p;this.yaw=best.heading;this.pitch=0;return true;
 }
 allowed(p){return !this.blocked(p)&&(this.cells.get(Math.floor(p[0]/24)+','+Math.floor(p[1]/24))||[]).some(s=>s.component===this.component&&distance(p,project(p,s.a,s.b))<=s.width);}
 look(dx,dy){this.yaw+=dx*.004;this.pitch=clamp(this.pitch-dy*.0035,-1.1,1.1);}
 move(forward,side,seconds,fast=false){
  const norm=Math.hypot(forward,side);if(!norm||!(seconds>0))return false;
  const step=Math.min(.16,seconds)*(fast?4.2:2.1)/Math.max(1,norm),dx=(Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side)*step,dz=(-Math.cos(this.yaw)*forward+Math.sin(this.yaw)*side)*step;
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.18));let moved=false;
  for(let i=0;i<n;i++){const p=this.position,q=[p[0]+dx/n,p[1]+dz/n];if(this.allowed(q)){this.position=q;moved=true;}else{for(const q of [[p[0]+dx/n,p[1]],[p[0],p[1]+dz/n]])if(this.allowed(q)){this.position=q;moved=true;break;}}}
  return moved;
 }
 follow(route,d,seconds=0){
  if(!route||route.length<=0)return false;
  const p=Y.Network.sample(route.points,d);if(this.blocked(p.point))return false;
  const ahead=Y.Network.sample(route.points,Math.min(route.length,d+2.8)),v=distance(p.point,ahead.point)>.05?[ahead.point[0]-p.point[0],ahead.point[1]-p.point[1]]:p.direction;
  if(Math.hypot(...v)>.001){const yaw=Math.atan2(v[0],-v[1]),delta=Math.atan2(Math.sin(yaw-this.yaw),Math.cos(yaw-this.yaw));this.yaw+=delta*(seconds?1-Math.exp(-7*seconds):1);}
  this.position=p.point.slice();return true;
 }
 camera(){const p=this.position,y=(this.ground(...p)||0)+1.68,c=Math.cos(this.pitch);return{eye:[p[0],y,p[1]],target:[p[0]+Math.sin(this.yaw)*c*12,y+Math.sin(this.pitch)*12,p[1]-Math.cos(this.yaw)*c*12],fov:1.05,offsetX:0,offsetY:0};}
}
Y.FirstPerson=FirstPerson;
})(YY);
/* Time-based orbit transitions. Direct manipulation always cancels at the visible pose. */
(function(Y){'use strict';
const copy=o=>({target:[...o.target],distance:o.distance,yaw:o.yaw,elevation:o.elevation});
const assign=(o,p)=>{for(let i=0;i<3;i++)o.target[i]=p.target[i];o.distance=p.distance;o.yaw=p.yaw;o.elevation=p.elevation;};
class BrowseCamera {
 constructor(orbit,{clock=()=>performance.now(),immediate=()=>false}={}){this.orbit=orbit;this.clock=clock;this.immediate=immediate;this.goal=null;this.pending=null;this.time=0;this.tau=.095;}
 cancel(finish=false){if(finish&&this.goal)assign(this.orbit,this.goal);this.goal=null;this.pending=null;this.time=0;}
 focus(mutate){const from=copy(this.orbit);this.cancel();mutate();if(this.immediate())return;this.goal=copy(this.orbit);assign(this.orbit,from);this.time=this.clock();this.tau=.095;}
 zoom(factor){
  if(!(factor>0)||!Number.isFinite(factor))return;
  const next=copy(this.goal||this.orbit),reversing=this.goal&&(factor-1)*(this.goal.distance-this.orbit.distance)<0,now=this.clock();
  if(reversing){next.distance=this.orbit.distance;this.pending=null;this.time=Math.max(this.time,now);}
  else if(this.goal&&!this.immediate()){this.pending=this.pending||copy(this.orbit);this.step(now,false);}
  next.distance=Math.max(3,Math.min(10000,next.distance*factor));
  if(this.immediate()){assign(this.orbit,next);this.cancel();return;}
  if(!this.goal)this.time=now;this.goal=next;this.tau=.065;
 }
 step(now,publish=true){
  if(!this.goal)return false;
  if(this.immediate()){this.cancel(true);return true;}
  const dt=Math.max(0,(now-this.time)/1000);this.time=Math.max(this.time,now);if(!dt&&!this.pending)return false;
  const a=-Math.expm1(-dt/this.tau),o=this.pending||this.orbit,g=this.goal;
  for(let i=0;i<3;i++)o.target[i]+=(g.target[i]-o.target[i])*a;
  o.distance=Math.exp(Math.log(o.distance)+(Math.log(g.distance)-Math.log(o.distance))*a);
  const yaw=Math.atan2(Math.sin(g.yaw-o.yaw),Math.cos(g.yaw-o.yaw));o.yaw+=yaw*a;o.elevation+=(g.elevation-o.elevation)*a;
  if(publish&&this.pending){assign(this.orbit,o);this.pending=null;}
  if(Math.max(...g.target.map((v,i)=>Math.abs(v-o.target[i])))<.001&&Math.abs(Math.log(g.distance/o.distance))<1e-6&&Math.abs(yaw)*(1-a)<1e-6&&Math.abs(g.elevation-o.elevation)<1e-6){if(publish)this.cancel(true);else assign(o,g);}
  return true;
 }
}
Y.BrowseCamera=BrowseCamera;
})(YY);

(function(Y){'use strict';
// Prototype only: layout's canonical offsets remain separate from displayed offsets.
class PanelOffset {
 constructor({offsetX=0,offsetY=0}={}){this.offsetX=offsetX;this.offsetY=offsetY;this.goal={offsetX,offsetY};this.active=false;this.start=0;this.fromX=offsetX;this.fromY=offsetY;}
 request(goal,now,{immediate=false}={}){
  if(goal.offsetX===this.goal.offsetX&&goal.offsetY===this.goal.offsetY){if(immediate)this.finish();else this.step(now);return;}
  this.goal={offsetX:goal.offsetX,offsetY:goal.offsetY};
  this.fromX=this.offsetX;this.fromY=this.offsetY;this.start=now;this.active=true;
  if(immediate)this.finish();
 }
 step(now){if(!this.active)return false;const t=Math.max(0,Math.min(1,(now-this.start)/160));const a=t*t*(3-2*t);this.offsetX=this.fromX+(this.goal.offsetX-this.fromX)*a;this.offsetY=this.fromY+(this.goal.offsetY-this.fromY)*a;if(t===1)this.finish();return true;}
 finish(){this.offsetX=this.goal.offsetX;this.offsetY=this.goal.offsetY;this.active=false;}
}
Y.PanelOffset=PanelOffset;
})(YY);

/* Campus viewer */
(function(Y){'use strict';const D=Y.CAMPUS,F=Y.Footprints,M=Y.M,$=id=>document.getElementById(id),root=$('app'),svg=$('plan'),canvas=$('scene'),NS='http://www.w3.org/2000/svg';
const developmentReferences=new URLSearchParams(location.search).get('dev')==='1'&&(['localhost','127.0.0.1','[::1]'].includes(location.hostname)||location.protocol==='file:');
const by=new Map(D.features.map(f=>[f.properties.pickId,f])),bySource=new Map(D.features.map(f=>[f.properties.id,f]));
// Observation-button camera override only: retain canonical geography and model dimensions.
// Fixed bounds enclose the reviewed full statue and base; oblique side avoids the foreground trunk.
const liSideCameraOverride1111=by.get(1111);if(liSideCameraOverride1111?.properties.id==='node/2773008893')liSideCameraOverride1111.properties.sideObservation46={"target":[-168.7591552734375,1.6809999905526638,43.56147384643555],"bounds":[-169.93510984982132,-0.08000000268220903,42.235674161603676,-167.58320069705368,3.441999983787537,44.88727353126742],"yaw":-0.27896754852838135,"elevation":0.18};
// Quality preference is independent of camera and scene selection.
const qualityNames=new Set(['low','medium','high']),qualityStorageKey='yanyuan.quality.preset';
function readQualityPreset(){try{const value=localStorage.getItem(qualityStorageKey);if(qualityNames.has(value))return value;}catch{}return 'high';}
function saveQualityPreset(value){try{localStorage.setItem(qualityStorageKey,value);return true;}catch{return false;}}
let qualityPreset=readQualityPreset();
const highCPUStorageKey='yanyuan.high.cpu',highCPUDefault=false;
function readHighCPUPreference(){try{const v=localStorage.getItem(highCPUStorageKey);if(v==='1'||v==='0')return v==='1';}catch{}return highCPUDefault;}
function syncHighCPUControl(){const c=$('cpu-optimization');c.checked=state.highVisibilityBatch;c.disabled=!ready||!engine||engine.disposed||qualityPreset!=='high';}
function changeHighCPUPreference(){if(!ready||!engine||engine.disposed||qualityPreset!=='high'){syncHighCPUControl();return;}state.highVisibilityBatch=$('cpu-optimization').checked;try{localStorage.setItem(highCPUStorageKey,state.highVisibilityBatch?'1':'0');}catch{}if(state.highVisibilityBatch)engine.scheduleHighVisibilityBatch();else engine.cancelHighVisibilityBatch();lastVisualKey='';syncHighCPUControl();}
function changeQualityPreset(){
 const control=$('quality-preset');
 if(!ready||!engine||engine.disposed){control.value=qualityPreset;return;}
 try{engine.setQualityPreset(control.value);qualityPreset=engine.qualityPreset;control.value=qualityPreset;lastVisualKey='';if(!saveQualityPreset(qualityPreset))say('画质已切换，本次设置无法保存。');}
 catch(error){control.value=qualityPreset;say('画质切换未完成，请重试。');}finally{syncHighCPUControl();}
}
const state={labels:true,time:0,hour:10.5,season:1,weather:0,selected:0,isolate:0,explode:0,selection:[0,0,0,0],contact:true,detailLOD:true,mapClarity:true,vegetation:true,people:true,routeEdges:new Set(),highVisibilityBatch:readHighCPUPreference()};
let engine,campus,ready=false,mode='3d',filter='精选',animation=!matchMedia('(prefers-reduced-motion: reduce)').matches,selected=0,last=0,lastDraw=0,labelTick=0,gesture=null,keys=new Set(),route=null,routePlaying=false,routeDistance=0,routeBackup=null,isolationBackup=null,toastTimer,walker=null,walkBackup=null,walkDetached=false;
const orbit={target:[-20,0,30],distance:2250,elevation:1.05,yaw:0},planView={x:-20,z:30,w:1500},presets={campus:D.displayScope45.bounds,lake:[-210,-320,250,120],north:[-265,-690,495,-320],central:[-270,50,135,365],west:[-610,180,-110,745],science:[190,-45,490,365],teaching:[180,340,470,520],sports:[180,450,510,755],gardens:[-1240,-450,-470,100]};
const browseMotion=matchMedia('(prefers-reduced-motion: reduce)');
const browseCamera=new Y.BrowseCamera(orbit,{immediate:()=>browseMotion.matches||mode!=='3d'||!ready||document.hidden||state.firstPerson});
function panelLayoutOffset(){return{offsetX:innerWidth>650?(!$('detail').hidden?.22:!root.classList.contains('catalog-hidden')?-.18:0):0,offsetY:innerWidth<=650&&!$('detail').hidden?.34:0};}
const panelOffset=new Y.PanelOffset(panelLayoutOffset());
function finishPanelOffset(){panelOffset.request(panelLayoutOffset(),performance.now(),{immediate:true});}
browseMotion.addEventListener('change',()=>{if(browseMotion.matches){browseCamera.cancel(true);finishPanelOffset();}});
function focusFeature(f){if(state.firstPerson)exitFirstPerson();browseCamera.focus(()=>focusFeatureImmediate(f));}
// Compact narrow and short mid-width cards; fitting still reads their actual layout.
function setDetailCompact(compact,focusTarget=null){
 const detail=$('detail'),expand=$('detail-expand'),parts=[$('detail-category'),$('detail-overview'),$('detail-information')];
 compact=!!(compact&&(innerWidth<=650||(innerWidth<=1050&&innerHeight<=560))&&!detail.hidden&&mode==='3d'&&!state.firstPerson);
 if(!compact&&!detail.classList.contains('detail-compact'))return;
 const active=document.activeElement;
 if(compact&&parts.some(part=>part.contains(active)))(focusTarget||$('front-view')).focus({preventScroll:true});
 if(!compact&&active===expand)$('detail-title').focus({preventScroll:true});
 detail.classList.toggle('detail-compact',compact);
 for(const part of parts)part.hidden=compact;
 expand.hidden=!compact;expand.setAttribute('aria-expanded',String(!compact));detail.scrollTop=0;
}
function architectureView(roof=false,offset=0){if(!selected)return;if(state.firstPerson)exitFirstPerson();changeMode('3d');setDetailCompact(true,$(roof?'roof-view':offset===Math.PI?'back-view':offset===Math.PI/2?'side-view':'front-view'));browseCamera.focus(()=>architectureViewImmediate(roof,offset));}
const featured=['node/9706378262','node/10060807295','heritage/temple-gate','heritage/bell-pavilion','way/240825554','way/240825562','relation/3249649','way/226703926','way/240832216','relation/3249764','way/240825557','way/240825556','way/240825555','relation/13059307','relation/14962081','way/240832248','way/33457546','way/272349094'];
const selectable=D.features.filter(f=>f.properties.kind!=='road'&&f.properties.kind!=='boundary'&&!f.properties.supersededBy43);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function say(s,ms=3000){$('status').textContent=s;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('status').textContent='',ms)}
function title(f){return f.properties.label}function bounds(f){return f.properties.bounds}function point(f){return f.properties.centre}
function query(){return $('search').value.trim().toLocaleLowerCase()}
function renderCatalog(){const q=query();let items=selectable.filter(f=>{let p=f.properties;return q?([p.label,...p.aliases||[]].join(' ').toLocaleLowerCase().includes(q)):(filter==='精选'?featured.includes(p.id)||p.name==='未名湖':filter==='全部'||p.category===filter)});items.sort((a,b)=>{const score=f=>{let n=featured.indexOf(f.properties.id);return n<0?100:n};return score(a)-score(b)||title(a).localeCompare(title(b),'zh-CN')});$('result-count').textContent=q?`${items.length} 个匹配地点`:`${items.length} 个${filter==='全部'?'地点':filter+'地点'}`;const fragment=document.createDocumentFragment();for(const f of items){const p=f.properties,b=document.createElement('button');b.className='place';b.setAttribute('aria-pressed',String(p.pickId===selected));b.dataset.place=p.pickId;b.innerHTML=`<span class="place-number" aria-hidden="true">${String(fragment.childElementCount+1).padStart(2,'0')}</span><span class="place-name"><strong>${esc(p.label)}</strong><small>${esc(p.category)}</small></span><span class="place-arrow" aria-hidden="true">↗</span>`;b.onclick=()=>select(p.pickId,true);fragment.append(b)}if(!items.length){const p=document.createElement('p');p.className='small';p.textContent='没有找到对应地点，试试简称或楼名。';fragment.append(p)}$('place-list').replaceChildren(fragment)}
function select(id,focus=false){if(state.firstPerson)exitFirstPerson();const parent=by.get(+id)?.properties.supersededBy43;if(parent)id=bySource.get(parent).properties.pickId;if(by.get(+id)?.properties.id==='node/1422005424')id=bySource.get('way/226703926').properties.pickId;const f=by.get(+id);if(!f||f.properties.kind==='road')return;setDetailCompact(false);selected=+id;state.selected=selected;const p=f.properties;state.selection=[p.centre[0],p.centre[1],Math.max(p.bounds[2]-p.bounds[0],p.bounds[3]-p.bounds[1])/2,0];if(state.isolate&&state.isolate!==selected)exitIsolate(false);$('detail').hidden=false;$('detail').scrollTop=0;$('environment').hidden=true;$('detail-category').textContent=p.category+' / '+(p.confidence==='user-located-form-approximate'?'使用者定位 · 近似复原':p.candidate32?'影像补绘候选':p.precinct32?'片区索引':p.heritage31?(p.markerOnly?'位置标记':'园林细节'):p.reviewed?'影像修订轮廓':'公开地图参考');$('detail-title').textContent=p.label;$('ne-view').hidden=p.id!=='way/33457546';$('detail-summary').textContent=p.architecture?.summary||(p.kind==='building'?(p.architecture?.strategy==='wang'?'南部高塔、两侧退台与北部低层裙房；按照片重做石材窗格、玻璃竖带和挑出平顶。':p.architecture?.strategy!=='footprint'?'结合既有逐楼资料重建屋顶、体量与立面，保留当前底图位置。':'依据屋顶影像调整坡屋面和层数；未见立面仍作类型近似。'):p.kind==='water'?'水面及内环沿当前底图绘制，岛屿与岸线保留原有关系。':p.kind==='sport'?'场地边界取自当前地图，内部线条为示意。':'此对象已接入统一的校园坐标。');let facts=`<dt>平面来源</dt><dd>${p.confidence==='user-located-form-approximate'?'使用者标注':p.candidate32?'卫星屋顶补绘 / 编号校图':p.precinct32?'当前地图与校图片区对应':p.heritage31?'具名地图点 / 地面影像':p.reviewed?'2026 影像描绘':'OpenStreetMap'}</dd>`;if(p.envelopeMetres)facts+=`<dt>外包尺寸</dt><dd>约 ${p.envelopeMetres.map(value=>Number(value.toFixed(1))).join(' × ')} 米</dd>`;if(p.kind==='building')facts+=`<dt>模型高度</dt><dd>${(p.modelEnvelopeHeight??p.height).toFixed(1)} 米</dd><dt>高度依据</dt><dd>${esc(p.heightSource)}</dd>`;$('detail-facts').innerHTML=facts;renderReferenceGallery(p);$('detail-note').textContent=p.scopeNote||'地图参考数据，未完成独立测绘复核。';$('detail-links').innerHTML=(p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener">${p.candidate32||p.precinct32?'查看定位依据':'查看原始地图要素'} ↗</a>`:'')+(developmentReferences?(p.references||[]):[]).filter(r=>/^https?:\/\//.test(r.url||'')).slice(0,2).map(r=>`<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)} ↗</a>`).join('');$('detail-reference').textContent=developmentReferences&&p.kind==='building'?'参考照片不覆盖全部立面；高度、坡度和未见细部仍有拟合。外包尺寸不等于建筑面积。':'';$('isolate').disabled=!['building','pier','heritage','gate','sport'].includes(p.kind);$('route-to').value=String(selected);if(innerWidth<=650||focus)root.classList.add('catalog-hidden');if(focus)focusFeature(f);renderCatalog();drawPlan();if(engine)engine.shadowDirty=true;}
function closeDetail(){if($('detail').contains(document.activeElement))(mode==='3d'?canvas:$('catalog-toggle')).focus({preventScroll:true});setDetailCompact(false);selected=0;state.selected=0;$('detail').hidden=true;exitIsolate(false);renderCatalog();drawPlan()}
function fitRegion(name){browseCamera.cancel();if(state.firstPerson)exitFirstPerson();const b=presets[name]||presets.campus;closeDetail();routePlaying=false;const cx=(b[0]+b[2])/2,cz=(b[1]+b[3])/2,w=b[2]-b[0],h=b[3]-b[1],aspect=innerWidth/innerHeight;planView.x=cx;planView.z=cz;const frame=mapFrame45();planView.w=Math.max(w*innerWidth/frame.w,h*innerWidth/frame.h)*1.07;orbit.target=[cx,0,cz];orbit.elevation=1.13;orbit.yaw=0;
// Fit the full precinct box in perspective, leaving room for top/bottom controls.
const se=Math.sin(orbit.elevation),ce=Math.cos(orbit.elevation),tan=Math.tan(.4),safeX=innerWidth<=650?.80:root.classList.contains('catalog-hidden')?.88:.68,safeY=innerWidth<=650?.65:.78;
const maxHeight=Math.max(0,...D.features.filter(f=>{const p=f.properties;return p.centre[0]>=b[0]&&p.centre[0]<=b[2]&&p.centre[1]>=b[1]&&p.centre[1]<=b[3]}).map(f=>f.properties.height||0));
orbit.distance=Math.max(100,...[-w/2,w/2].flatMap(x=>[-h/2,h/2].flatMap(z=>[0,maxHeight].map(y=>Math.max(y*se+z*ce+Math.abs(x)/(tan*aspect*safeX),y*se+z*ce+Math.abs(y*ce-z*se)/(tan*safeY))))));finishPanelOffset();drawPlan();if(engine)engine.shadowDirty=true;}
function renderReferenceGallery(p){const boxRoot=$('reference-gallery');boxRoot.hidden=!developmentReferences;if(!developmentReferences){boxRoot.replaceChildren();return;}const media=YY.REFERENCE_GALLERY,photos=media?.places[String(p.pickId)]||[],box=$('reference-gallery');box.innerHTML=photos.length?'<h3>外观参照</h3><div class="reference-strip">'+photos.map((r,i)=>`<button class="reference-thumb" data-photo="${i}" aria-label="查看参考照片：${esc(r.title)}"><img loading="lazy" decoding="async" src="${media.images[r.key]}" alt="${esc(r.title)}"><span>${esc(r.title)}</span></button>`).join('')+'</div>':'';box.querySelectorAll('[data-photo]').forEach(button=>button.onclick=()=>{const r=photos[+button.dataset.photo];$('photo-title').textContent=r.title;$('photo-large').src=media.images[r.key];$('photo-large').alt=r.title;$('photo-caption').textContent=[r.direction,'历史参考照片，未据此认定所有立面现状。'].filter(Boolean).join(' · ');$('photo-source').href=r.url;$('photo-viewer').showModal()});}
function frontObservation46(f,key='frontObservation46'){
 const q=f.properties[key],finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&Array.from(a).every(Number.isFinite);
 if(!q||!finiteArray(q.target,3)||!finiteArray(q.bounds,6)||!Number.isFinite(q.yaw)||!Number.isFinite(q.elevation)||q.elevation<=0||q.elevation>=Math.PI/2)return null;
 for(let i=0;i<3;i++)if(q.bounds[i]>=q.bounds[i+3]||q.target[i]<q.bounds[i]||q.target[i]>q.bounds[i+3])return null;
 return q;
}
// For these five buildings, named side/back views share the validated front pose basis.
// Explicit per-direction observations retain priority. This makes no visibility claim.
function directionObservation321(f,key,offset){
 const explicit=frontObservation46(f,key);if(explicit)return explicit;
 if((offset!==Math.PI/2&&offset!==Math.PI)||!['way/1031892011','way/1031892012','way/1031892013','way/1031892015','way/1122569396'].includes(f.properties.id))return null;
 const front=frontObservation46(f);return front?{...front,target:[...front.target],bounds:[...front.bounds],yaw:front.yaw+offset}:null;
}
function architectureViewImmediate(roof=false,offset=0){if(!selected)return;const f=by.get(selected);focusFeatureImmediate(f);const observationKey=offset===0?'frontObservation46':offset===Math.PI?'backObservation46':offset===Math.PI/2?'sideObservation46':null,observation=!roof&&!state.isolate&&observationKey?directionObservation321(f,observationKey,offset):null;if(observation){orbit.target=[...observation.target];orbit.elevation=observation.elevation;orbit.yaw=observation.yaw;}else{orbit.elevation=roof?1.5:!state.isolate&&Number.isFinite(f.properties.frontElevation46)?f.properties.frontElevation46:!state.isolate&&f.properties.id===Y.Building019?.id?.55:.18;orbit.yaw=roof?0:frontAngle(f)+offset;}fitArchitectureView(f,observation?.bounds);}
// Fit all envelope corners in the visible space around the existing off-centre camera.
function architectureDistance46(box,target,yaw,elevation,aspect,safeX,safeY){
 const sy=Math.sin(yaw),cy=Math.cos(yaw),se=Math.sin(elevation),ce=Math.cos(elevation),tan=Math.tan(.4);
 let distance=5;
 for(const x of [box[0],box[3]])for(const y of [box[1],box[4]])for(const z of [box[2],box[5]]){
  const dx=x-target[0],dy=y-target[1],dz=z-target[2],across=dx*cy-dz*sy,along=dx*sy+dz*cy,up=dy*ce-along*se,depth=dy*se+along*ce;
  distance=Math.max(distance,depth+Math.abs(across)/(tan*aspect*safeX),depth+Math.abs(up)/(tan*safeY));
 }
 return distance*1.08;
}
function fitArchitectureView(f,observationBounds){
 const p=f.properties,b=bounds(f),c=point(f),ground=Y.Landscape42?.elevation(...c)||0,extent=p.displayRadius||0;
 // Optional rendered extent is already in world coordinates; source bounds stay intact.
 const display=p.displayBounds46,validDisplay=Array.isArray(display)&&display.length===6&&Array.from(display).every(Number.isFinite)&&[0,1,2].every(i=>display[i]<display[i+3]);
 const framingBounds=observationBounds||(validDisplay?display:null);
 const box=framingBounds?[...framingBounds]:[b[0],ground,b[1],b[2],ground+(p.height||0),b[3]];
 // Point-mapped gates and monuments have no polygon; retain their declared model extent.
 if(!framingBounds&&b[2]-b[0]<.01&&b[3]-b[1]<.01&&extent){box[0]=c[0]-extent/2;box[3]=c[0]+extent/2;box[2]=c[1]-extent/2;box[5]=c[1]+extent/2;}
 const mobile=innerWidth<=650,cam=panelLayoutOffset(),cx=innerWidth*(1-(cam.offsetX||0))/2,cy=innerHeight*(1-(cam.offsetY||0))/2;
 const panel=$('detail').getBoundingClientRect(),top=document.querySelector('.topbar').getBoundingClientRect().bottom+12;
 const right=!mobile&&!$('detail').hidden?panel.left-16:innerWidth-16,bottom=mobile&&!$('detail').hidden?panel.top-12:innerHeight-60;
 const safeX=Math.max(.10,Math.min(cx-16,right-cx)*2/innerWidth),safeY=Math.max(.10,Math.min(cy-top,bottom-cy)*2/innerHeight);
 orbit.distance=architectureDistance46(box,orbit.target,orbit.yaw,orbit.elevation,innerWidth/innerHeight,safeX,safeY);
}
function frontAngle(f){if(Number.isFinite(f.properties.frontAngle46))return f.properties.frontAngle46;if(Number.isFinite(f.properties.frontAngle44))return f.properties.frontAngle44;if(f.properties.id===Y.Building018?.id){const b=Y.Building018,e=b.entrance,p=b.world(e.u,e.v),q=b.world(e.u,e.v+1);return Math.atan2(q[0]-p[0],q[1]-p[1]);}if(f.properties.id===Y.Building019?.id){const b=Y.Building019,e=b.entrances[0],p=b.world(e.u,e.v),q=b.world(e.u-1,e.v);return Math.atan2(q[0]-p[0],q[1]-p[1]);}if(f.properties.id==='way/240832248')return Math.PI+.0467;if(f.properties.id==='way/445012606')return -Math.PI/2+.0467;if(f.properties.architecture?.strategy==='qiu')return Math.PI+.046732;if(f.properties.gate33)return f.properties.rotation||0;if(f.properties.heritage31)return f.properties.rotation||0;if(f.properties.architecture?.strategy==='teaching3')return Math.PI;if(f.properties.architecture?.strategy==='hall')return .879;return YY.ARCHIVE?.legacy[String(f.properties.legacyId)]?.r||0;}
function focusFeatureImmediate(f){if(state.firstPerson)exitFirstPerson();const b=bounds(f),h=f.properties.height,aspect=innerWidth/innerHeight;planView.x=(b[0]+b[2])/2;planView.z=(b[1]+b[3])/2;planView.w=Math.max(110,b[2]-b[0]+65,(b[3]-b[1]+65)*aspect);orbit.target=[...point(f).slice(0,1),h*.42+(Y.Landscape42?.elevation(...point(f))||0),point(f)[1]];const radius=f.properties.displayRadius||Math.max(b[2]-b[0],b[3]-b[1]);orbit.distance=Math.max(f.properties.kind==='heritage'?5:32,radius*2.05,h*2.7)*(innerWidth<=650?2.5:1);orbit.elevation=.62;orbit.yaw=frontAngle(f)-.48;drawPlan();}
function changeMode(next){browseCamera.cancel();finishPanelOffset();if(Y.ASSETS.externalMaps&&Y.ASSETS.mapLinks[next]){window.open(Y.ASSETS.mapLinks[next],'_blank','noopener');return;}if(state.firstPerson)exitFirstPerson();if(next===mode)return;setDetailCompact(false);routePlaying=false;if(state.isolate)exitIsolate(true);if(mode==='3d'){planView.x=orbit.target[0];planView.z=orbit.target[2];planView.w=Math.max(70,orbit.distance*2*Math.tan(.4)*innerWidth/innerHeight);}else if(next==='3d'){orbit.target=[planView.x,0,planView.z];orbit.distance=planView.w/(2*Math.tan(.4)*innerWidth/innerHeight);}
 mode=next;canvas.hidden=mode!=='3d';svg.toggleAttribute('hidden',mode==='3d');$('labels').hidden=mode!=='3d';$('map-options').hidden=mode==='3d';$('overlay').checked=mode==='plan';$('raw-overlay').checked=false;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('view-hint').textContent=mode==='3d'?'左键拖动旋转 · 右键拖动平移 · 滚轮缩放':'左键拖动平移 · 滚轮缩放 · 点击建筑查看';credit();drawPlan();}
function credit(){$('map-credit').innerHTML=mode==='satellite'?'影像 © Esri / Vantor / Earthstar':'数据 © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · <a href="https://github.com/sldyns/PKU-3D/blob/main/DATA_LICENSE.md" target="_blank" rel="noopener">ODbL</a>'; }
function isolate(){browseCamera.cancel();finishPanelOffset();setDetailCompact(false);if(!selected)return;if(mode!=='3d')changeMode('3d');if(state.isolate)return exitIsolate(true);isolationBackup={...orbit,target:[...orbit.target]};state.isolate=selected;$('isolation-banner').hidden=false;$('isolate').textContent='返回校园';focusFeatureImmediate(by.get(selected));engine.shadowDirty=true;}
function exitIsolate(restore=true){browseCamera.cancel();setDetailCompact(false);if($('isolation-banner').contains(document.activeElement)){const detail=$('detail');if(!detail.hidden)detail.scrollTop=0;(!detail.hidden?$('detail-title'):mode==='3d'?canvas:$('catalog-toggle')).focus({preventScroll:true});}state.isolate=0;$('isolation-banner').hidden=true;$('isolate').textContent='独立查看';if(restore&&isolationBackup)Object.assign(orbit,isolationBackup,{target:[...isolationBackup.target]});if(engine)engine.shadowDirty=true;}
function camera(){if(state.firstPerson)return walker.camera();const ce=Math.cos(orbit.elevation),d=orbit.distance;return{eye:[orbit.target[0]+Math.sin(orbit.yaw)*ce*d,orbit.target[1]+Math.sin(orbit.elevation)*d,orbit.target[2]+Math.cos(orbit.yaw)*ce*d],target:[...orbit.target],fov:.80,offsetX:panelOffset.offsetX,offsetY:panelOffset.offsetY};}
function el(tag,attrs={},parent=svg){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e}
const planPaths=new WeakMap();
function path(g){if(planPaths.has(g))return planPaths.get(g);const line=(r,close)=>r.map((p,i)=>(i?'L':'M')+p.join(',')).join(' ')+(close?'Z':'');const result=g.type==='LineString'?line(g.coordinates,false):F.polygons(g).flatMap(pg=>pg.map(r=>line(r,true))).join(' ');planPaths.set(g,result);return result;}
function mapFrame45(){const mobile=innerWidth<=650,catalog=!root.classList.contains('catalog-hidden'),left=(!mobile&&catalog?$('catalog').getBoundingClientRect().right+14:14),right=innerWidth-(mobile?14:86),top=mobile?138:134,bottom=Math.max(top+120,$('map-footer').getBoundingClientRect().top-14);return{x:(left+right)/2,y:(top+bottom)/2,w:Math.max(120,right-left),h:Math.max(120,bottom-top)}}
function planBox(){const h=planView.w*innerHeight/innerWidth,f=mapFrame45();return[planView.x-planView.w*f.x/innerWidth,planView.z-planView.w*f.y/innerWidth,planView.w,h]}
let planQueued=false,plainMapMode=null;
function drawPlan(){if(mode==='3d'||planQueued)return;planQueued=true;requestAnimationFrame(()=>{planQueued=false;drawPlanNow();});}
function drawPlanNow(){Y.Dorm45Basement338?.hide();if(mode==='3d')return;const v=planBox(),m=planView.w/innerWidth;svg.setAttribute('viewBox',v.join(' '));const publicMap=mode==='satellite'||mode==='standard',plainMap=publicMap&&!$('overlay').checked&&!$('raw-overlay').checked&&!route;if(plainMap&&plainMapMode===mode)return;plainMapMode=plainMap?mode:null;svg.replaceChildren();if(publicMap){for(const a of D.peripheryImagery||[]){const r=a.rect;el('image',{href:Y.ASSETS.periphery[a.id][mode],x:r[0],y:r[1],width:r[2],height:r[3],preserveAspectRatio:'none'});}let r=D.imagery.rect;el('image',{href:Y.ASSETS[mode],x:r[0],y:r[1],width:r[2],height:r[3],preserveAspectRatio:'none'});}const show=$('overlay').checked||mode==='plan';
 if(show){for(const k of ['boundary','landscape','water','sport','road','building','pier','gate','heritage'])for(const f of D.features){const p=f.properties,g=f.geometry,b=p.bounds;if(p.supersededBy43||p.kind!==k||b[2]<v[0]||b[0]>v[0]+v[2]||b[3]<v[1]||b[1]>v[1]+v[3])continue;let fill={boundary:publicMap?'none':'#dbe3d0',water:'#99b8b1',sport:'#b8cba9',building:'#c5c8ba',road:'none',landscape:'#b0c398',pier:'#c7b697',gate:'#916c4f',heritage:'#a78561'}[k],stroke=k==='road'?'#d0cdbf':k==='water'?'#88a89c':k==='building'?'#8e9e8c':'#bdc9b2';if(publicMap){fill='none';stroke=p.reviewed?'#ffcf8b':'#e6e7c0'}if(p.pickId===selected){stroke='#ac653d';fill=publicMap?'none':'#e7d1ad';}let e;if(g.type==='Point')e=el('circle',{cx:g.coordinates[0],cy:g.coordinates[1],r:3*m,fill:'#956e49'});else e=el('path',{d:path(g),fill,stroke,'fill-rule':'evenodd','stroke-width':k==='road'?(publicMap?m*.8:Math.max(m*.6,p.width)):m*(p.pickId===selected?2.2:.9),'stroke-linejoin':'round'});e.dataset.id=p.pickId;if(k!=='road')el('title',{},e).textContent=p.label;}}
 Y.Dorm45Basement338?.drawPlan({el,selected,state,show,metresPerPixel:m});
 if($('raw-overlay').checked)for(const f of D.rawFeatures)if(['building','sport'].includes(f.properties.kind))el('path',{d:path(f.geometry),fill:'none',stroke:'#ce7455','stroke-width':m,'stroke-dasharray':`${4*m} ${3*m}`,'pointer-events':'none'});
 if(route){el('path',{d:path({type:'LineString',coordinates:route.points}),fill:'none',stroke:'#277c67','stroke-width':3*m,'stroke-linecap':'round'});const q=Y.Network.sample(route.points,routeDistance).point;el('circle',{cx:q[0],cy:q[1],r:4*m,fill:'#fff',stroke:'#277c67','stroke-width':2*m});}
 if(show&&state.labels){const occupied=[];for(const f of labelCandidates()){const p=f.properties,[x,z]=p.centre;if(x<v[0]||x>v[0]+v[2]||z<v[1]||z>v[1]+v[3])continue;const screen=[(x-v[0])/m,(z-v[1])/m];if(blocked(screen,Math.min(170,p.label.length*11),20,occupied))continue;occupied.push([screen[0]-p.label.length*5,screen[1]-10,Math.min(170,p.label.length*11),20]);const t=el('text',{x,y:z,'font-size':11*m,'text-anchor':'middle','dominant-baseline':'middle',fill:'#2a4c3b',stroke:'#f6f7ef','stroke-width':3*m,'paint-order':'stroke','stroke-linejoin':'round','pointer-events':'none'});t.textContent=p.label;if(occupied.length>=22)break;}}
}
function labelCandidates(){const candidates=selectable.filter(f=>(f.properties.name||f.properties.displayName)&&(!f.properties.precinct32||f.properties.pickId===selected||(mode==='3d'?orbit.distance>650:planView.w>650)));if(candidates.length<2)return candidates;const groups=new Map();for(const f of candidates){const score=f.properties.pickId===selected?-100:f.properties.name==='未名湖'?-10:featured.includes(f.properties.id)?featured.indexOf(f.properties.id):100,group=groups.get(score);if(group)group.push(f);else groups.set(score,[f]);}return [...groups.keys()].sort((a,b)=>a-b).flatMap(score=>groups.get(score))}
function blocked(q,w,h,occupied){if(q[0]<w/2+10||q[0]>innerWidth-w/2-10||q[1]<145||q[1]>innerHeight-110)return true;for(const id of ['catalog','detail','environment','route-panel']){const e=$(id);if(e.hidden||(id==='catalog'&&root.classList.contains('catalog-hidden')))continue;const r=e.getBoundingClientRect();if(q[0]+w/2>r.left&&q[0]-w/2<r.right&&q[1]+h/2>r.top&&q[1]-h/2<r.bottom)return true;}return occupied.some(r=>q[0]+w/2>r[0]-6&&q[0]-w/2<r[0]+r[2]+6&&q[1]+h/2>r[1]-5&&q[1]-h/2<r[1]+r[3]+5)}
let labelNodes=new Map();
function drawLabels(){Y.Dorm45Basement338?.hide();if(!ready||mode!=='3d')return;if(!state.labels){for(const n of labelNodes.values())if(!n.hidden)n.hidden=true;return;}Y.Dorm45Basement338?.draw3D({engine,state,selected,ready,mode,container:$('labels'),viewport:{width:innerWidth,height:innerHeight}});const occupied=engine.people?.labelBoxes()||[],chosen=[];for(const f of labelCandidates()){const p=f.properties;if(state.isolate&&p.pickId!==state.isolate)continue;if(selected&&orbit.distance<180&&p.pickId!==selected&&Math.hypot(p.centre[0]-orbit.target[0],p.centre[1]-orbit.target[2])>100)continue;if(orbit.distance>1500&&!featured.includes(p.id)&&p.name!=='未名湖'&&p.pickId!==selected)continue;const q=engine.project([p.centre[0],p.height+4+(Y.Landscape42?.elevation(...p.centre)||0),p.centre[1]]),w=Math.min(205,p.label.length*10+14),h=22;if(!q.visible||blocked([q.x,q.y],w,h,occupied))continue;occupied.push([q.x-w/2,q.y-h/2,w,h]);chosen.push({p,q});if(occupied.length>=(innerWidth<=650?8:18))break;}const chosenIds=new Set(chosen.map(({p})=>p.pickId));for(const [id,n] of labelNodes)if(!chosenIds.has(id)&&!n.hidden)n.hidden=true;for(const {p,q} of chosen){let n=labelNodes.get(p.pickId);if(!n){n=document.createElement('button');n.className='world-label';n.textContent=p.label;n.setAttribute('aria-label','查看'+p.label);n.onclick=()=>select(p.pickId,true);$('labels').append(n);labelNodes.set(p.pickId,n)}if(n.hidden)n.hidden=false;const left=q.x+'px',top=q.y+'px',current=String(p.pickId===selected);if(n.style.left!==left)n.style.left=left;if(n.style.top!==top)n.style.top=top;if(n.getAttribute('aria-current')!==current)n.setAttribute('aria-current',current);}}
function zoom(f,smooth=true){if(state.firstPerson)return;finishPanelOffset();if(mode==='3d'){if(smooth)browseCamera.zoom(f);else{browseCamera.cancel();orbit.distance=Math.max(3,Math.min(10000,orbit.distance*f));}}else{planView.w=Math.max(55,Math.min(6500,planView.w*f));drawPlan();}}
const pointers=new Map();function pointerDown(e){if(e.button>2||(state.firstPerson&&pointers.size))return;browseCamera.cancel();finishPanelOffset();pauseTravel();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);gesture={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,button:e.button,shift:e.shiftKey};if(pointers.size===2){const a=[...pointers.values()];gesture.pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}root.classList.add('dragging')}
function pointerMove(e){if(!pointers.has(e.pointerId)||!gesture)return;browseCamera.cancel();finishPanelOffset();const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(state.firstPerson){walker.look(dx,dy);}else if(pointers.size===2){const a=[...pointers.values()],d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(gesture.pinch)zoom(gesture.pinch/d,false);gesture.pinch=d;gesture.moved=true;}else if(mode!=='3d'){const m=planView.w/innerWidth;planView.x-=dx*m;planView.z-=dy*m;drawPlan();}else if(gesture.button===2||gesture.shift){const m=orbit.distance*.0008,c=Math.cos(orbit.yaw),s=Math.sin(orbit.yaw);orbit.target[0]-=(dx*c+dy*s)*m;orbit.target[2]-=(-dx*s+dy*c)*m;}else{orbit.yaw-=dx*.006;orbit.elevation=M.clamp(orbit.elevation+dy*.005,.18,1.56)}gesture.moved ||= Math.hypot(e.clientX-gesture.startX,e.clientY-gesture.startY)>5;gesture.x=e.clientX;gesture.y=e.clientY;}
function pointerUp(e){const click=gesture&&!gesture.moved&&pointers.size===1;pointers.delete(e.pointerId);if(click&&ready&&!state.firstPerson){if(mode==='3d'){const id=engine.pick(e.clientX,e.clientY);if(by.has(id))select(id,false);}else{const v=planBox(),q=[v[0]+e.clientX/innerWidth*v[2],v[1]+e.clientY/innerHeight*v[3]];const hit=[...selectable].reverse().find(f=>f.geometry.type==='Point'?Math.hypot(q[0]-point(f)[0],q[1]-point(f)[1])<5:F.inside(q,f.geometry));if(hit)select(hit.properties.pickId,false);}}if(!pointers.size){gesture=null;root.classList.remove('dragging')}else{const a=[...pointers.values()][0];gesture={x:a.x,y:a.y,startX:a.x,startY:a.y,moved:true,button:0};}}
for(const e of [canvas,svg]){e.addEventListener('pointerdown',pointerDown);e.addEventListener('pointermove',pointerMove);e.addEventListener('pointerup',pointerUp);e.addEventListener('pointercancel',()=>{gesture=null;pointers.clear();root.classList.remove('dragging')});e.addEventListener('contextmenu',e=>e.preventDefault());e.addEventListener('wheel',e=>{e.preventDefault();zoom(Math.exp(e.deltaY*.001))},{passive:false})}
function routeOptions(){for(const sel of ['route-from','route-to']){const list=sel==='route-from'?selectable.filter(f=>f.properties.kind==='gate'):selectable.filter(f=>['building','pier','heritage'].includes(f.properties.kind));for(const f of list){const o=document.createElement('option');o.value=f.properties.pickId;o.textContent=f.properties.label;$(sel).append(o)}}}
function planRoute(){if(!campus)return;const from=by.get(+$('route-from').value),to=by.get(+$('route-to').value);if(!from||!to)return;const g=campus.network,a=Y.Network.nearest(g,point(from)),b=Y.Network.nearest(g,point(to));route=a&&b?Y.Network.route(g,a.p,b.p):null;routePlaying=false;routeDistance=0;if(!route){state.routeEdges=new Set();$('route-status').textContent='这两个附近路段在现有公开路网中未连通，暂不补画连接。';$('route-progress').disabled=$('route-play').disabled=true;drawPlan();return}if(route.length===0){route=null;state.routeEdges=new Set();$('route-status').textContent='这两个位置之间没有需要浏览的路段。';$('route-progress').value=0;$('route-progress').disabled=$('route-play').disabled=true;drawPlan();return}state.routeEdges=new Set(Y.Network.routeEdges(g,route));const gap=Math.round(Math.hypot(point(to)[0]-b.p[0],point(to)[1]-b.p[1]));$('route-status').textContent=`公开路网约 ${Math.round(route.length)} 米；终点是距对象中心约 ${gap} 米的道路节点。`;$('route-progress').disabled=$('route-play').disabled=false;$('route-play').textContent='开始步行';$('route-progress').value=0;drawPlan();say('路线只沿现有地图道路显示。');}
function moveAlong(){browseCamera.cancel();finishPanelOffset();if(!route)return;const p=Y.Network.sample(route.points,routeDistance);if(state.firstPerson){walker.follow(route,routeDistance);syncWalkPosition();}else if(mode==='3d'){orbit.target=[p.point[0],1+(Y.Landscape42?.elevation(...p.point)||0),p.point[1]];orbit.distance=125;orbit.elevation=.73;}else{planView.x=p.point[0];planView.z=p.point[1];planView.w=Math.min(planView.w,310);drawPlan();}$('route-progress').value=String(Math.round(routeDistance/route.length*1000));}
function clearRoute(){if(state.firstPerson)exitFirstPerson();route=null;routePlaying=false;state.routeEdges=new Set();$('route-status').textContent='选择校门和对象，查看公开道路网络。';$('route-progress').disabled=$('route-play').disabled=true;drawPlan();}
function makeWalker(){
 const solids=D.features.filter(f=>f.properties.kind==='building'&&!f.properties.supersededBy43&&!f.properties.precinct32&&f.geometry.type!=='Point');
 // Same excavations that scene-v29.js cuts from its ground plates and ribbons.
 // They include elevated decks; Landscape42.elevation alone is not their floor.
 const cuts=[Y.Building008,Y.Building080,Y.StudentCenterSouth46].filter(q=>q?.groundCut).map(q=>({type:'Polygon',coordinates:[q.groundCut.excavationRing||q.groundCut.ring]}));
 const near=(p,r,g)=>F.inside(p,g)||F.polygons(g).some(poly=>poly.some(ring=>ring.some((a,i)=>F.distSegment(p,a,ring[(i+1)%ring.length])<=r)));
 const groundClear=(p,r=0)=>!cuts.some(g=>near(p,r,g));
 const entryRadius=p=>Math.max(12,...cuts.filter(g=>near(p,1.2,g)).map(g=>Math.max(...F.polygons(g).flat(2).map(q=>Math.hypot(q[0]-p[0],q[1]-p[1])))+12));
 const obstacles=[...solids,...cuts.map(geometry=>{const ps=F.polygons(geometry).flat(2);return{geometry,properties:{bounds:[Math.min(...ps.map(p=>p[0])),Math.min(...ps.map(p=>p[1])),Math.max(...ps.map(p=>p[0])),Math.max(...ps.map(p=>p[1]))]}}})];
 const clear=(p,r=0)=>!obstacles.some(f=>{const b=f.properties.bounds;if(p[0]<b[0]-r||p[0]>b[2]+r||p[1]<b[1]-r||p[1]>b[3]+r)return false;return F.inside(p,f.geometry)||F.polygons(f.geometry).some(poly=>poly.some(ring=>ring.some((a,i)=>F.distSegment(p,a,ring[(i+1)%ring.length])<=r)));});
 // Reject exact footprint-edge crossings too, including barriers narrower than a movement substep.
 const crosses=(a,b)=>obstacles.some(f=>{const box=f.properties.bounds;if(Math.max(a[0],b[0])<box[0]||Math.min(a[0],b[0])>box[2]||Math.max(a[1],b[1])<box[1]||Math.min(a[1],b[1])>box[3])return false;const dx=b[0]-a[0],dz=b[1]-a[1];return F.polygons(f.geometry).some(poly=>poly.some(ring=>ring.some((c,i)=>{const d=ring[(i+1)%ring.length],ex=d[0]-c[0],ez=d[1]-c[1],den=dx*ez-dz*ex;if(Math.abs(den)<1e-10)return false;const qx=c[0]-a[0],qz=c[1]-a[1],t=(qx*ez-qz*ex)/den,u=(qx*dz-qz*dx)/den;return t>1e-7&&t<=1&&u>=0&&u<=1;})));});
 const snapBlocked=p=>solids.some(f=>{const b=f.properties.bounds;return p[0]>b[0]&&p[0]<b[2]&&p[1]>b[1]&&p[1]<b[3]&&F.inside(p,f.geometry);});
 return new Y.FirstPerson(campus.network,{ground:(x,z)=>Y.Landscape42?.elevation(x,z)||0,blocked:p=>snapBlocked(p)||!groundClear(p,.3),snapBlocked,clear,crosses,groundClear,entryRadius});
}
function enterFirstPerson(start=null){browseCamera.cancel();
 if(!ready||!campus?.network){say('校园加载后即可开始步行');return false;}
 if(state.firstPerson)return true;
 walker ||= makeWalker();
 const f=selected&&by.get(selected),origin=start||(f?point(f):mode==='3d'?[orbit.target[0],orbit.target[2]]:[planView.x,planView.z]);
 if(!(start?walker.enter(origin,-orbit.yaw):walker.enterNearby(origin,-orbit.yaw))){say('附近没有留有足够空间的地图道路，请换一个位置');return false;}
 walkBackup={orbit:{...orbit,target:[...orbit.target]},plan:{...planView},mode,catalog:!root.classList.contains('catalog-hidden'),selected,labels:state.labels,detail:!$('detail').hidden,route:!$('route-panel').hidden};
 changeMode('3d');closeDetail();$('route-panel').hidden=true;$('environment').hidden=true;root.classList.add('catalog-hidden','first-person');state.firstPerson=true;state.labels=false;$('show-labels').checked=false;walkDetached=true;
 $('walk-hud').hidden=false;$('walk-pad').hidden=false;canvas.setAttribute('aria-label','第一人称校园漫游，WASD 或方向键移动，拖动环顾，Esc 退出');
 syncWalkPosition();syncWalkUI();finishPanelOffset();canvas.focus({preventScroll:true});return true;
}
function exitFirstPerson(){
 if(!state.firstPerson)return;
 stopWalkInput();state.firstPerson=false;root.classList.remove('first-person');$('walk-hud').hidden=true;$('walk-pad').hidden=true;
 canvas.setAttribute('aria-label','燕园三维校园，拖动旋转，右键拖动平移，滚轮缩放，点击建筑查看');
 const saved=walkBackup;walkBackup=null;
 if(saved){state.labels=saved.labels;$('show-labels').checked=state.labels;if(saved.mode!==mode)changeMode(saved.mode);Object.assign(orbit,saved.orbit);Object.assign(planView,saved.plan);root.classList.toggle('catalog-hidden',!saved.catalog);if(saved.detail&&saved.selected)select(saved.selected);$('route-panel').hidden=!saved.route;}
 $('view-hint').textContent=mode==='3d'?'左键拖动旋转 · 右键拖动平移 · 滚轮缩放':'拖动平移 · 滚轮缩放';
 syncWalkUI();drawPlan();finishPanelOffset();engine.shadowDirty=true;const returnControl=$('walk-start');if(returnControl.getClientRects().length)returnControl.focus({preventScroll:true});else{const detail=$('detail');if(!detail.hidden)detail.scrollTop=0;(!detail.hidden?$('detail-title'):mode==='3d'?canvas:$('catalog-toggle')).focus({preventScroll:true});}
}
function syncWalkPosition(){const p=walker.position;orbit.target=[p[0],1.68+(Y.Landscape42?.elevation(...p)||0),p[1]];orbit.distance=75;orbit.yaw=-walker.yaw;}
function syncWalkUI(){
 const label=(id,text)=>{const e=$(id);if(e.textContent!==text)e.textContent=text;};
 const hasRoute=Boolean(route&&route.length>0),done=hasRoute&&routeDistance>=route.length;
 $('walk-pause').hidden=!hasRoute;label('walk-pause',routePlaying?'暂停':done?'再走一遍':walkDetached?'回到路线':'继续步行');
 label('walk-mode',routePlaying?'沿路步行':hasRoute&&!walkDetached?(done?'已到附近道路':'已暂停'):'自由步行');
 label('walk-distance',hasRoute&&!walkDetached?`${Math.round(routeDistance)} / ${Math.round(route.length)} m`:'沿校园道路漫游');
 label('route-play',routePlaying?'暂停步行':done?'再走一遍':'开始步行');
 $('route-progress').value=hasRoute?String(Math.round(routeDistance/route.length*1000)):'0';
 if(state.firstPerson)label('view-hint','WASD 移动 · 拖动环顾 · Esc 退出');
}
function pauseTravel(){routePlaying=false;syncWalkUI();}
function stopWalkInput(){lastInput=null;keys.clear();document.querySelectorAll('[data-walk-key]').forEach(b=>b.classList.remove('pressed'));pauseTravel();}
function toggleTravel(){
 if(!route||route.length<=0)return;
 if(routePlaying){pauseTravel();return;}
 if(routeDistance>=route.length)routeDistance=0;
 const p=Y.Network.sample(route.points,routeDistance),wasWalking=state.firstPerson;
 if(!enterFirstPerson(p.point))return;
 if(!walker.enter(p.point,walker.yaw)||!walker.follow(route,routeDistance)){if(!wasWalking)exitFirstPerson();say('此处道路经过建筑或尚不支持步行的下沉庭院、台阶，请换一个起点');return;}
 walkDetached=false;routePlaying=true;syncWalkPosition();syncWalkUI();canvas.focus({preventScroll:true});
}
$('walk-start').onclick=()=>enterFirstPerson();$('walk-here').onclick=()=>enterFirstPerson();
$('walk-exit').onclick=exitFirstPerson;$('walk-pause').onclick=toggleTravel;
for(const button of document.querySelectorAll('[data-walk-key]')){
 button.addEventListener('pointerdown',e=>{if(!state.firstPerson)return;e.preventDefault();pauseTravel();walkDetached=true;button.setPointerCapture(e.pointerId);keys.add(button.dataset.walkKey);button.classList.add('pressed');syncWalkUI();});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>{keys.delete(button.dataset.walkKey);button.classList.remove('pressed');});
}
$('show-people').onchange=()=>{state.people=$('show-people').checked;};
$('walkers-view').onclick=()=>{if(!ready||!engine.people)return;changeMode('3d');closeDetail();routePlaying=false;$('environment').hidden=true;root.classList.add('catalog-hidden');Object.assign(orbit,engine.people.closeView());finishPanelOffset();engine.shadowDirty=true;};
$('quality-preset').value=qualityPreset;$('quality-preset').onchange=changeQualityPreset;$('cpu-optimization').onchange=changeHighCPUPreference;syncHighCPUControl();
$('show-labels').onchange=()=>{state.labels=$('show-labels').checked;drawLabels();drawPlan();};$('vegetation').onchange=()=>{state.vegetation=$('vegetation').checked;engine.shadowDirty=true;};$('search').oninput=renderCatalog;document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderCatalog()});document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>changeMode(b.dataset.mode));$('catalog-toggle').onclick=()=>setCatalogOpen(root.classList.contains('catalog-hidden'));$('catalog-collapse').onclick=()=>setCatalogOpen(false,true);$('catalog-restore').onclick=()=>setCatalogOpen(true,true);$('detail-close').onclick=closeDetail;$('detail-expand').onclick=()=>setDetailCompact(false);$('focus').onclick=()=>selected&&focusFeature(by.get(selected));$('isolate').onclick=isolate;$('front-view').onclick=()=>architectureView();$('side-view').onclick=()=>architectureView(false,Math.PI/2);$('back-view').onclick=()=>architectureView(false,Math.PI);$('roof-view').onclick=()=>architectureView(true);$('ne-view').onclick=()=>{if(!selected)return;changeMode('3d');browseCamera.cancel();finishPanelOffset();focusFeatureImmediate(by.get(selected));orbit.yaw=Math.PI*.75;orbit.elevation=.58;engine.shadowDirty=true;};$('isolation-exit').onclick=()=>exitIsolate();$('show-plan').onclick=()=>{changeMode('plan');if(selected)focusFeature(by.get(selected))};$('overlay').onchange=drawPlan;$('raw-overlay').onchange=drawPlan;$('home').onclick=()=>fitRegion('campus');$('north').onclick=()=>{browseCamera.cancel();finishPanelOffset();orbit.yaw=0;say('正北朝上')};$('top').onclick=()=>{browseCamera.cancel();finishPanelOffset();orbit.yaw=0;orbit.elevation=1.56;say('垂直俯视 · 北向朝上')};$('zoom-in').onclick=()=>zoom(.78);$('zoom-out').onclick=()=>zoom(1/.78);$('controls-open').onclick=()=>{stopWalkInput();$('controls-help').showModal()};$('sources-open').onclick=()=>$('sources').showModal();$('environment-open').onclick=()=>{stopWalkInput();$('environment').hidden=!$('environment').hidden;$('route-panel').hidden=true};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{const e=$(b.dataset.close);e instanceof HTMLDialogElement?e.close():e.hidden=true;if(b.dataset.close==='route-panel')routePlaying=false});$('hour').oninput=()=>{state.hour=+$('hour').value;$('hour-value').textContent=String(Math.floor(state.hour)).padStart(2,'0')+':'+String(Math.round(state.hour%1*60)).padStart(2,'0');engine.shadowDirty=true};$('season').onchange=()=>{state.season=+$('season').value;engine.shadowDirty=true};$('weather').onchange=()=>{state.weather=+$('weather').value;engine.shadowDirty=true};$('animation').checked=animation;$('animation').onchange=()=>animation=$('animation').checked;$('route-open').onclick=()=>{if(state.firstPerson)exitFirstPerson();$('route-panel').hidden=false;$('environment').hidden=true;if(selected)$('route-to').value=String(selected)};$('route-plan').onclick=planRoute;$('route-clear').onclick=clearRoute;$('route-play').onclick=toggleTravel;$('route-progress').oninput=()=>{if(!route)return;const progress=+$('route-progress').value;pauseTravel();routeDistance=progress/1000*route.length;moveAlong();syncWalkUI()};
const walkKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
window.addEventListener('keydown',e=>{
 if(root.querySelector('dialog[open]'))return;
 const typing=/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)||document.activeElement.isContentEditable;
 if(e.key==='Escape'){if(state.firstPerson){exitFirstPerson();return;}closeDetail();$('environment').hidden=true;$('route-panel').hidden=true;pauseTravel();}
 if(typing)return;
 if(state.firstPerson&&walkKeys.has(e.code)){e.preventDefault();keys.add(e.code);return;}
 if(state.firstPerson&&e.code==='Space'&&e.target===canvas){e.preventDefault();if(!e.repeat)toggleTravel();return;}
 if(e.key==='/'){e.preventDefault();setCatalogOpen(true,true)}
 if(e.key==='+'||e.key==='=')zoom(.85);if(e.key==='-')zoom(1.18);
 if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){browseCamera.cancel();finishPanelOffset();e.preventDefault();const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0,dz=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;if(mode==='3d'){orbit.target[0]+=dx*orbit.distance*.03;orbit.target[2]+=dz*orbit.distance*.03;}else{planView.x+=dx*planView.w*.05;planView.z+=dz*planView.w*.05;drawPlan()}}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{browseCamera.cancel();finishPanelOffset();stopWalkInput();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){browseCamera.cancel();finishPanelOffset();stopWalkInput();}});
document.addEventListener('focusin',e=>{if(e.target.matches('input,select,textarea,[contenteditable="true"]')||e.target.closest('dialog'))stopWalkInput();});
function resize(){browseCamera.cancel();if(innerWidth>650&&(innerWidth>1050||innerHeight>560))setDetailCompact(false);finishPanelOffset();if(engine)engine.resize(innerWidth,innerHeight);drawPlan()}window.addEventListener('resize',resize);
const noWalkRoute=new Set();
let lastVisualKey='',labelsPending=false,renderGeneration=0,frameRequest=0,lastInput=null;
let lastLabelCameraKey='';
function tick(now){
 frameRequest=requestAnimationFrame(tick);if(!ready||document.hidden){last=now;lastInput=null;return;}
 // Keep plan navigation and its canvas redraw on the existing low-frequency cadence.
 if(mode!=='3d'&&now-lastDraw<(engine.software?90:33))return;
 // Advance navigation on visible rAFs, independently of GPU submission. Discard
 // long event-loop stalls beyond the existing 160 ms cap; substep navigation
 // below without slowing ordinary low-refresh displays.
 const inputDt=lastInput===null?0:Math.min(.16,Math.max(0,(now-lastInput)/1000));lastInput=now;
 if(state.firstPerson){
  if(root.querySelector('dialog[open]'))pauseTravel();
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  if(inputDt>0&&(forward||side)){walkDetached=true;pauseTravel();let remaining=inputDt;while(remaining>0){const step=Math.min(.05,remaining);walker.move(forward,side,step,keys.has('ShiftLeft')||keys.has('ShiftRight'));remaining-=step;}syncWalkPosition();}
 }
 if(inputDt>0&&routePlaying&&route){
  if(state.firstPerson){let remaining=inputDt;while(remaining>0&&routeDistance<route.length){const step=Math.min(.05,remaining),next=Math.min(route.length,routeDistance+step*2.1);if(!walker.follow(route,next,step)){pauseTravel();say('前方道路经过建筑或尚不支持步行的下沉庭院、台阶，已停下');break;}routeDistance=next;remaining-=step;}syncWalkPosition();}
  else{routeDistance=Math.min(route.length,routeDistance+inputDt*18);moveAlong();}
  if(routeDistance>=route.length)pauseTravel();else if(state.firstPerson&&routePlaying)syncWalkUI();
 }
 // Hardware follows display cadence; the engine still bounds GPU work to two frames.
 if(mode==='3d'&&!engine.frameAvailable())return;
 if(now-lastDraw<(engine.software?90:mode==='3d'?0:33))return;
 const dt=Math.min(.16,(now-(last||now))/1000);last=now;lastDraw=now;if(animation)state.time+=dt;
 if(mode==='3d'){
  browseCamera.step(now);
  panelOffset.request(panelLayoutOffset(),now,{immediate:browseMotion.matches||state.firstPerson});
  const view=camera(),mask=state.inspectionMask;
  const labelCameraKey=[...view.eye,...view.target,...(view.up||[0,1,0]),view.fov||.80,view.offsetX||0,view.offsetY||0,canvas.width,canvas.height,innerWidth,innerHeight].join(',');
  const labelCameraChanged=labelCameraKey!==lastLabelCameraKey;
  const visualKey=[...view.eye,...view.target,view.offsetX,view.offsetY,state.hour,state.season,state.weather,state.selected,state.isolate,state.explode,state.contact,state.detailLOD,state.labels,state.vegetation,state.people,qualityPreset,state.highVisibilityBatch,[...state.routeEdges].join('/'),mask?.objectId,mask?.buckets?[...mask.buckets].join('/'):null,canvas.width,canvas.height,$('environment').hidden,$('route-panel').hidden].join(',');
  if(!animation&&!routePlaying&&!engine.shadowDirty&&visualKey===lastVisualKey&&!labelCameraChanged){if(labelsPending&&now-labelTick>170){drawLabels();labelTick=now;labelsPending=false;}return;}
  lastVisualKey=visualKey;engine.people?.setMotion(dt,animation);engine.render(view,state.firstPerson?{...state,routeEdges:noWalkRoute}:state);lastLabelCameraKey=labelCameraKey;labelsPending=true;if(labelCameraChanged||now-labelTick>170){drawLabels();labelTick=now;labelsPending=false;}
 }
}

async function loadRenderResources(next,onProgress,prepared){
 // Independent texture, mesh and program resources can load together. Wait for all
 // even on failure, so disposal cannot race a remaining resource upload.
 const results=await Promise.allSettled([next.loadMaterials(),Promise.resolve().then(()=>Y.SceneCache46&&Y.SCENE_PACKAGE46?Y.SceneCache46.load(next,onProgress,prepared):Promise.resolve(Y.loadBuilderData318?.()).then(()=>Y.createMetricCampus(next))),next.loadScan1119(),next.waitForPrograms()]);
 for(const result of results)if(result.status==='rejected')throw result.reason;
 return results[1].value;
}
async function init(recover=false){finishPanelOffset();
 if(!recover){renderCatalog();routeOptions();credit();let catalogChoice=null;try{catalogChoice=localStorage.getItem('yanyuan.catalog.collapsed');}catch{}root.classList.toggle('catalog-hidden',catalogChoice===null?innerWidth<=650:catalogChoice==='1');syncDisclosure();fitRegion('campus');}
 const generation=++renderGeneration;let next,prepared;
 try{
  prepared=Y.SceneCache46&&Y.SCENE_PACKAGE46?Y.SceneCache46.warmup():undefined;
  next=new Y.Engine(canvas,{deferPrograms:true,qualityPreset});engine=next;next.resize(innerWidth,innerHeight);
  next.compilePrograms(true,state.people!==false&&!state.isolate);
  next.onInstanceDataReady=()=>{if(generation===renderGeneration&&!next.disposed&&mode==='3d')next.prepareInitialVisibility(camera(),state.firstPerson?{...state,routeEdges:noWalkRoute}:state);};
  const scene=await loadRenderResources(next,(n,total)=>{if(generation===renderGeneration)$('status').textContent=(recover?'正在恢复校园… ':'正在打开校园… ')+Math.round(n/total*100)+'%';},prepared);
  if(generation!==renderGeneration){next.dispose();return;}
  campus=scene;next.people=Y.Pedestrians46.create(next,campus,state);$('show-people').disabled=false;$('walkers-view').disabled=false;$('quality-preset').disabled=false;ready=true;syncHighCPUControl();lastVisualKey='';lastInput=null;last=lastDraw=0;root.dataset.ready='true';$('coverage').textContent=`${D.features.filter(f=>f.properties.kind==='building'&&!f.properties.supersededBy43).length} 个建筑对象`;$('status').textContent='';
  window.Yanyuan={version:'1.5.5',data:D,engine,campus,state,orbit,planView,get mode(){return mode},get walker(){return walker},select,changeMode,fitRegion};
  if(!recover&&developmentReferences){const script=document.createElement('script');script.src='private/reference-gallery.js';script.onload=()=>{if(selected)renderReferenceGallery(by.get(selected).properties);};document.head.appendChild(script);}
   cancelAnimationFrame(frameRequest);frameRequest=requestAnimationFrame(tick);
 }catch(e){next?.dispose();if(generation!==renderGeneration)return;$('quality-preset').disabled=true;console.error(e);$('status').textContent='三维暂不可用，已切换平面地图。';changeMode('plan');ready=true;root.dataset.ready='plan-only';}finally{prepared?.dispose();}
}
canvas.addEventListener('webglcontextlost',event=>{browseCamera.cancel();finishPanelOffset();stopWalkInput();event.preventDefault();renderGeneration++;ready=false;syncHighCPUControl();$('quality-preset').disabled=true;cancelAnimationFrame(frameRequest);engine?.dispose();root.dataset.ready='recovering';$('status').textContent='正在恢复校园…';});
canvas.addEventListener('webglcontextrestored',()=>init(true));

// Keep disclosure buttons accurate when keyboard, selection or close controls hide panels.
const syncDisclosure=()=>{const open=!root.classList.contains('catalog-hidden');$('catalog-toggle').setAttribute('aria-expanded',String(open));$('catalog-toggle').setAttribute('aria-label',open?'收起地点目录':'展开地点目录');$('catalog-restore').hidden=open;$('catalog-restore').setAttribute('aria-expanded',String(open));$('environment-open').setAttribute('aria-expanded',String(!$('environment').hidden));};
function setCatalogOpen(open,focus=false){if(open&&state.firstPerson)exitFirstPerson();if(open&&innerWidth<=650)$('detail').hidden=true;root.classList.toggle('catalog-hidden',!open);try{localStorage.setItem('yanyuan.catalog.collapsed',open?'0':'1');}catch{}syncDisclosure();drawPlan();drawLabels();if(focus)$(open?'search':'catalog-restore').focus();}
const disclosureObserver=new MutationObserver(syncDisclosure);disclosureObserver.observe(root,{attributes:true,attributeFilter:['class']});disclosureObserver.observe($('environment'),{attributes:true,attributeFilter:['hidden']});syncDisclosure();
init();
})(YY);
