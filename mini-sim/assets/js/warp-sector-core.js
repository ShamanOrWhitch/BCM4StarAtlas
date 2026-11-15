/* BCM4SA Warp sector math — CPU-only, browser/THREE independent. */
(function (root) {
  "use strict";
  var SLOT_COUNT = 8, TRAILING_SECTORS = 2, LEADING_SECTORS = 5;
  var DEFAULT_SECTOR_LENGTH = 180, DEFAULT_HYSTERESIS_RATIO = 0.05, DEFAULT_CLUSTER_COUNT = 3;
  function finiteNumber(value, fallback) { var n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function vector(value, fallback) { var s = value || fallback || {}; return { x: finiteNumber(s.x, 0), y: finiteNumber(s.y, 0), z: finiteNumber(s.z, 0) }; }
  function add(a,b) { return {x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}; }
  function subtract(a,b) { return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}; }
  function scale(a,n) { return {x:a.x*n,y:a.y*n,z:a.z*n}; }
  function dot(a,b) { return a.x*b.x+a.y*b.y+a.z*b.z; }
  function length(a) { return Math.sqrt(dot(a,a)); }
  function normalize(a) { var n=length(a); return !Number.isFinite(n)||n<1e-9 ? {x:0,y:0,z:-1} : scale(a,1/n); }
  function positiveModulo(value,modulo) { var size=Math.max(1,Math.floor(finiteNumber(modulo,SLOT_COUNT))); var integer=Math.floor(finiteNumber(value,0)); return ((integer%size)+size)%size; }
  function sectorIndexFor(traveled,sectorLength) { var l=finiteNumber(sectorLength,DEFAULT_SECTOR_LENGTH); if(l<=0)l=DEFAULT_SECTOR_LENGTH; return Math.floor(finiteNumber(traveled,0)/l); }
  function slotIndexFor(sectorIndex) { return positiveModulo(sectorIndex,SLOT_COUNT); }
  function hashSeed(value) { var text=String(value),hash=2166136261; for(var i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);} return (hash>>>0)||1; }
  function randomFrom(seed) { var state=(Number(seed)>>>0)||1; return function(){state+=0x6D2B79F5;var t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;}; }
  function seedForSector(runSeed,sectorIndex) { return hashSeed((Number(runSeed)>>>0)+"|warp-sector|"+Math.trunc(Number(sectorIndex)||0)); }
  function createOdometer(options) {
    var c=options||{},origin=vector(c.origin),position=vector(c.position,origin),drift=subtract(position,origin);
    var axis=normalize(vector(c.axis,{x:0,y:0,z:-1}));
    var traveled=Number.isFinite(Number(c.traveled))?Number(c.traveled):dot(drift,axis);
    return {origin:origin,drift:drift,traveled:traveled,axis:axis};
  }
  function advanceOdometer(odometer,telemetry) {
    if(!odometer||!odometer.origin||!odometer.axis)return odometer;
    var f=telemetry||{},fallback=add(odometer.drift,scale(vector(f.velocity),Math.max(0,finiteNumber(f.dt,0))));
    var position=f.position!=null?vector(f.position):add(odometer.origin,fallback);
    var drift=subtract(position,odometer.origin);
    odometer.drift=drift;odometer.traveled=dot(drift,odometer.axis);return odometer;
  }
  function createWindowState() { return {anchorSector:null,slots:Array.from({length:SLOT_COUNT},function(){return null;})}; }
  function resolveAnchorSector(previousAnchor,traveled,sectorLength,hysteresisRatio) {
    var current=sectorIndexFor(traveled,sectorLength);
    if(previousAnchor==null||!Number.isFinite(Number(previousAnchor)))return current;
    var previous=Math.trunc(Number(previousAnchor));
    var ratio=Math.max(0,Math.min(0.20,finiteNumber(hysteresisRatio,DEFAULT_HYSTERESIS_RATIO)));
    var h=sectorLength*ratio;
    if(current>previous){var f=Math.floor((traveled-h)/sectorLength);return Math.max(previous,Math.min(current,f));}
    if(current<previous){var b=Math.floor((traveled+h)/sectorLength);return Math.min(previous,Math.max(current,b));}
    return previous;
  }
  function planWindow(state,traveled,options) {
    var c=options||{},l=Math.max(1,finiteNumber(c.sectorLength,DEFAULT_SECTOR_LENGTH));
    var current=sectorIndexFor(traveled,l);
    var anchor=resolveAnchorSector(state&&state.anchorSector,finiteNumber(traveled,0),l,c.hysteresisRatio);
    var existing=state&&Array.isArray(state.slots)?state.slots:[];
    var sectors=[],changes=[],retained=[];
    for(var offset=-TRAILING_SECTORS;offset<=LEADING_SECTORS;offset++){
      var sector=anchor+offset,slot=slotIndexFor(sector),previous=existing[slot]==null?null:Number(existing[slot]);
      sectors.push(sector);
      if(previous!==sector)changes.push({slotIndex:slot,previousSector:previous,sectorIndex:sector,seed:seedForSector(c.runSeed||1,sector)});
      else retained.push(sector);
    }
    return {currentSector:current,anchorSector:anchor,sectors:sectors,changes:changes,retained:retained,slotCount:SLOT_COUNT};
  }
  function commitWindowPlan(state,plan) {
    if(!state||!plan)return state;
    state.anchorSector=plan.anchorSector;
    plan.changes.forEach(function(c){state.slots[c.slotIndex]=c.sectorIndex;});
    return state;
  }
  function layoutForSector(runSeed,sectorIndex,options) {
    var c=options||{},l=Math.max(1,finiteNumber(c.sectorLength,DEFAULT_SECTOR_LENGTH));
    var count=Math.max(1,Math.min(8,Math.floor(finiteNumber(c.clusterCount,DEFAULT_CLUSTER_COUNT))));
    var rx=Math.max(1,finiteNumber(c.lateralRadius,74)),ry=Math.max(1,finiteNumber(c.verticalRadius,44));
    var minScale=Math.max(0.1,finiteNumber(c.minScale,1.15)),maxScale=Math.max(minScale,finiteNumber(c.maxScale,2.50));
    var seed=seedForSector(runSeed,sectorIndex),random=randomFrom(seed),transforms=[];
    for(var i=0;i<count;i++)transforms.push({
      x:(random()*2-1)*rx,y:(random()*2-1)*ry,along:l*(0.12+random()*0.76),
      rotationX:random()*Math.PI*2,rotationY:random()*Math.PI*2,rotationZ:random()*Math.PI*2,
      scale:minScale+random()*(maxScale-minScale)
    });
    return {sectorIndex:Math.trunc(Number(sectorIndex)||0),seed:seed,templateIndex:Math.floor(random()*6),transforms:transforms};
  }
  function selfTest() {
    var errors=[];function check(ok,message){if(!ok)errors.push(message);}
    var l=DEFAULT_SECTOR_LENGTH,ring=createWindowState();
    var initial=planWindow(ring,l*0.50,{sectorLength:l,runSeed:77});
    check(initial.sectors.length===8,"initial window must contain exactly eight sectors");
    check(initial.sectors[0]===initial.anchorSector-2&&initial.sectors[7]===initial.anchorSector+5,"window must retain two sectors behind and five ahead");
    commitWindowPlan(ring,initial);
    var forward=planWindow(ring,l*1.06,{sectorLength:l,runSeed:77});
    check(forward.changes.length<=1,"one-sector forward move must rebuild at most one slot");
    commitWindowPlan(ring,forward);
    var backward=planWindow(ring,l*0.94,{sectorLength:l,runSeed:77});
    check(backward.changes.length<=1,"one-sector reverse move must rebuild at most one slot");
    var jf=createWindowState();commitWindowPlan(jf,planWindow(jf,l*0.5,{sectorLength:l}));
    check(planWindow(jf,l*5.06,{sectorLength:l}).changes.length<=5,"five-sector jump must rebuild no more than five slots");
    var je=createWindowState();commitWindowPlan(je,planWindow(je,l*0.5,{sectorLength:l}));
    var jump=planWindow(je,l*10.06,{sectorLength:l});
    check(jump.changes.length<=8&&jump.slotCount===8,"large jump must stay within eight slots");
    var boundary=createWindowState();commitWindowPlan(boundary,planWindow(boundary,l*0.98,{sectorLength:l}));
    var rebuilds=0;
    for(var toggle=0;toggle<40;toggle++){var value=l*(toggle%2===0?1.02:0.98);var p=planWindow(boundary,value,{sectorLength:l});rebuilds+=p.changes.length;commitWindowPlan(boundary,p);}
    check(rebuilds<=1,"40 boundary oscillations inside hysteresis may add at most one rebuild");
    check(sectorIndexFor(-0.01,l)===-1,"negative traveled must floor to a negative sector");
    check(slotIndexFor(-1)===7&&slotIndexFor(-8)===0&&slotIndexFor(-9)===7,"negative sector indices must map to real positive ring slots");
    var idle=planWindow(ring,l*0.94,{sectorLength:l,runSeed:77});commitWindowPlan(ring,idle);
    check(planWindow(ring,l*0.94,{sectorLength:l,runSeed:77}).changes.length===0,"plan must be idempotent without movement");
    var longState=createWindowState(),longPlan=planWindow(longState,l*12000.5,{sectorLength:l});
    check(longPlan.changes.length===8&&longPlan.sectors.length===8,"long trips must still use exactly eight sector slots");
    commitWindowPlan(longState,longPlan);check(longState.slots.length===8,"long-trip slot storage must remain fixed at eight");
    var odo=createOdometer({origin:{x:0,y:0,z:0},position:{x:0,y:0,z:0},axis:{x:0,y:0,z:-1}});
    advanceOdometer(odo,{position:{x:0,y:0,z:-10},velocity:{x:0,y:0,z:-10},dt:1});
    check(Math.abs(odo.traveled-10)<1e-6&&Math.abs(odo.drift.z+10)<1e-6,"odometer must sample the actual signed ship displacement");
    advanceOdometer(odo,{position:{x:0,y:0,z:-5},velocity:{x:0,y:0,z:5},dt:1});
    check(Math.abs(odo.traveled-5)<1e-6,"reverse movement must decrease signed traveled distance");
    var a=layoutForSector(1234,-9,{sectorLength:l}),b=layoutForSector(1234,-9,{sectorLength:l});
    check(a.seed===b.seed&&a.templateIndex===b.templateIndex&&JSON.stringify(a.transforms)===JSON.stringify(b.transforms),"same seed and sector must produce identical CPU layout");
    check(layoutForSector(1234,-9).seed!==layoutForSector(1234,-8).seed,"different sectors must get independent deterministic seeds");
    return errors;
  }
  var api={SLOT_COUNT:SLOT_COUNT,TRAILING_SECTORS:TRAILING_SECTORS,LEADING_SECTORS:LEADING_SECTORS,
    DEFAULT_SECTOR_LENGTH:DEFAULT_SECTOR_LENGTH,DEFAULT_HYSTERESIS_RATIO:DEFAULT_HYSTERESIS_RATIO,
    DEFAULT_CLUSTER_COUNT:DEFAULT_CLUSTER_COUNT,positiveModulo:positiveModulo,sectorIndexFor:sectorIndexFor,
    slotIndexFor:slotIndexFor,seedForSector:seedForSector,createOdometer:createOdometer,
    advanceOdometer:advanceOdometer,createWindowState:createWindowState,planWindow:planWindow,
    commitWindowPlan:commitWindowPlan,layoutForSector:layoutForSector,selfTest:selfTest};
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.BCMWarpSectorCore=api;
})(typeof globalThis!=="undefined"?globalThis:this);