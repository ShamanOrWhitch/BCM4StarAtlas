/* BCM4SA Warp sector scene — CPU transforms, Three.js r128 rendering only. */
(function (root) {
  "use strict";
  var Core=root&&root.BCMWarpSectorCore;
  var SLOT_COUNT=8,DEFAULT_SECTOR_LENGTH=180,DEFAULT_CLUSTER_COUNT=3;
  var ASSET_NAMES=["cluster_01.glb","cluster_02.glb","cluster_03.glb","cluster_04.glb","cluster_05.glb","cluster_06.glb"];
  function num(v,d){var n=Number(v);return Number.isFinite(n)?n:d;}
  function selfTest(){var e=[];if(SLOT_COUNT!==8)e.push("scene ring must have exactly eight slots");if(ASSET_NAMES.length!==6)e.push("six local asteroid cluster templates must be configured");if(DEFAULT_CLUSTER_COUNT<1)e.push("each sector must contain at least one cluster instance");return e;}
  function create(options){
    var c=options||{},THREE=c.THREE||(root&&root.THREE),scene=c.scene||null;
    if(!THREE)throw new Error("Warp sector scene requires the existing THREE r128 runtime");
    if(!Core)throw new Error("Warp sector CPU core is not loaded");
    var assetBase=String(c.assetBase||""),sectorLength=Math.max(1,num(c.sectorLength,DEFAULT_SECTOR_LENGTH));
    var clusterCount=Math.max(1,Math.min(8,Math.floor(num(c.clusterCount,DEFAULT_CLUSTER_COUNT))));
    var hysteresisRatio=Math.max(0,Math.min(0.20,num(c.hysteresisRatio,0.05)));
    var runSeed=(Number(c.runSeed)>>>0)||1;
    var rootGroup=new THREE.Group();rootGroup.name="bcm-warp-sector-window";rootGroup.userData.bcmWarpSectorManager=true;
    var slots=Array.from({length:SLOT_COUNT},function(_,i){return {slotId:i,sectorIndex:null,generation:0,seed:0,status:"EMPTY",root:null,instances:[],transforms:[],matrices:[]};});
    var windowState=Core.createWindowState(),odometer=null,axis=null,templatePromise=null,templates=[];
    var active=false,destroyed=false,frameCount=0,rebuildCount=0,lastError="";
    var dummy=new THREE.Object3D(),worldOrigin=new THREE.Vector3(),worldAxis=new THREE.Vector3(0,0,-1);
    var localForward=new THREE.Vector3(0,0,-1),groupQuaternion=new THREE.Quaternion();
    function meshNodes(gltf){
      var source=gltf&&(gltf.scene||(Array.isArray(gltf.scenes)?gltf.scenes[0]:null));
      if(!source||typeof source.traverse!=="function")throw new Error("Asteroid GLB has no scene root");
      source.updateMatrixWorld(true);var found=[];
      source.traverse(function(node){if(node&&node.isMesh&&node.geometry&&node.material)found.push(node);});
      if(found.length!==1)throw new Error("Asteroid sector cluster must contain exactly one instancing mesh");
      return found;
    }
    function ensureTemplates(){
      if(templatePromise)return templatePromise;
      if(!root||!root.document)return Promise.reject(new Error("GLTFLoader requires the browser document"));
      templatePromise=new Promise(function(resolve,reject){
        function begin(Loader){
          if(!Loader){reject(new Error("Local r128 GLTFLoader is unavailable"));return;}
          var loaded=[],index=0;
          function next(){
            if(destroyed){reject(new Error("Warp sector manager was destroyed during asset loading"));return;}
            if(index>=ASSET_NAMES.length){templates=loaded;resolve(templates);return;}
            var file=ASSET_NAMES[index++],loader=new Loader();
            loader.load(assetBase+file,function(gltf){
              try{var node=meshNodes(gltf)[0],geometry=node.geometry.clone();geometry.applyMatrix4(node.matrixWorld);
                loaded.push({file:file,geometry:geometry,material:node.material});next();}
              catch(error){reject(error);}
            },undefined,function(error){reject(new Error("Unable to load local asteroid cluster "+file+": "+(error&&error.message||"GLB load failed")));});
          }
          next();
        }
        if(THREE.GLTFLoader){begin(THREE.GLTFLoader);return;}
        var url=String(c.gltfLoaderUrl||"");
        if(!url){reject(new Error("Local r128 GLTFLoader URL is missing"));return;}
        var existing=root.document.querySelector('script[data-bcm-r128-sector-loader="1"], script[data-bcm-r128-gltf-loader="1"]');
        if(existing){existing.addEventListener("load",function(){begin(THREE.GLTFLoader);},{once:true});existing.addEventListener("error",function(){reject(new Error("Local r128 GLTFLoader request failed"));},{once:true});return;}
        var script=root.document.createElement("script");script.src=url;script.async=true;script.dataset.bcmR128SectorLoader="1";
        script.onload=function(){begin(THREE.GLTFLoader);};script.onerror=function(){reject(new Error("Local r128 GLTFLoader request failed"));};
        root.document.head.appendChild(script);
      }).catch(function(error){templatePromise=null;lastError=error&&error.message?error.message:String(error);throw error;});
      return templatePromise;
    }
    function removeSlot(slot){
      if(!slot||!slot.root)return;
      if(slot.root.parent)slot.root.parent.remove(slot.root);
      slot.root.traverse(function(node){
        if(!node||!node.userData||node.userData.slotOwned!==true)return;
        if(node.isInstancedMesh&&typeof node.dispose==="function")node.dispose();
      });
      slot.sectorIndex=null;slot.seed=0;slot.status="EMPTY";slot.root=null;
      slot.instances=[];slot.transforms=[];slot.matrices=[];
    }
    function clearSlots(){
      slots.forEach(function(slot){slot.generation+=1;removeSlot(slot);});
      windowState=Core.createWindowState();
    }
    function instantiateSlot(slot,change,generation){
      if(destroyed||slot.generation!==generation)return false;
      var layout=Core.layoutForSector(runSeed,change.sectorIndex,{sectorLength:sectorLength,clusterCount:clusterCount});
      var template=templates[layout.templateIndex%templates.length];
      if(!template)throw new Error("Asteroid cluster template is missing");
      var group=new THREE.Group();group.name="warp-sector-"+change.sectorIndex;
      group.userData.slotOwned=true;group.userData.slotId=slot.slotId;group.userData.sectorIndex=change.sectorIndex;group.userData.generation=generation;
      var instances=new THREE.InstancedMesh(template.geometry,template.material,layout.transforms.length);
      instances.name="warp-sector-instances-"+change.sectorIndex;instances.userData.slotOwned=true;
      instances.userData.sharedTemplate=template.file;instances.frustumCulled=false;
      if(instances.instanceMatrix&&typeof instances.instanceMatrix.setUsage==="function")instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(instances);var matrices=[];
      layout.transforms.forEach(function(t,i){
        dummy.position.set(t.x,t.y,change.sectorIndex*sectorLength+t.along);
        dummy.rotation.set(t.rotationX,t.rotationY,t.rotationZ,"XYZ");dummy.scale.setScalar(t.scale);dummy.updateMatrix();
        instances.setMatrixAt(i,dummy.matrix);matrices.push(dummy.matrix.clone());
      });
      instances.count=layout.transforms.length;instances.instanceMatrix.needsUpdate=true;
      slot.root=group;slot.instances=[instances];slot.transforms=layout.transforms;slot.matrices=matrices;
      slot.sectorIndex=change.sectorIndex;slot.seed=layout.seed;slot.status="READY";rootGroup.add(group);
      rebuildCount+=1;return true;
    }
    function assignChanges(plan){
      if(!plan.changes.length)return Promise.resolve(plan);
      var reservations=plan.changes.map(function(change){
        var slot=slots[change.slotIndex],generation=slot.generation+1;removeSlot(slot);
        slot.generation=generation;slot.sectorIndex=change.sectorIndex;slot.seed=change.seed;slot.status="BUILDING";
        return {change:change,slot:slot,generation:generation};
      });
      Core.commitWindowPlan(windowState,plan);
      return ensureTemplates().then(function(){
        if(destroyed||!active)return plan;
        reservations.forEach(function(r){
          var slot=r.slot;if(slot.generation!==r.generation||slot.sectorIndex!==r.change.sectorIndex||slot.status!=="BUILDING")return;
          instantiateSlot(slot,r.change,r.generation);
        });
        return plan;
      }).catch(function(error){
        reservations.forEach(function(r){if(r.slot.generation===r.generation&&r.slot.status==="BUILDING")r.slot.status="ERROR";});
        lastError=error&&error.message?error.message:String(error);throw error;
      });
    }
    function resetOdometer(frame){
      var ship=frame.ship,originMesh=frame.originMesh;
      if(!ship||!ship.position||!originMesh||typeof originMesh.getWorldPosition!=="function")throw new Error("Warp sector origin requires the live ONICSS station mesh and ship position");
      originMesh.getWorldPosition(worldOrigin);localForward.set(0,0,-1);
      if(ship.quaternion)localForward.applyQuaternion(ship.quaternion);
      if(ship.velocity&&ship.velocity.lengthSq&&ship.velocity.lengthSq()>0.25)worldAxis.copy(ship.velocity).normalize();
      else worldAxis.copy(localForward).normalize();
      axis={x:worldAxis.x,y:worldAxis.y,z:worldAxis.z};
      odometer=Core.createOdometer({origin:{x:worldOrigin.x,y:worldOrigin.y,z:worldOrigin.z},
        position:{x:ship.position.x,y:ship.position.y,z:ship.position.z},axis:axis});
      rootGroup.position.copy(ship.position);
      groupQuaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),worldAxis);rootGroup.quaternion.copy(groupQuaternion);
      windowState=Core.createWindowState();
    }
    function updateMatrices(ship){
      rootGroup.position.copy(ship.position);
      slots.forEach(function(slot){
        if(slot.status!=="READY"||!slot.instances.length)return;
        var mesh=slot.instances[0];
        slot.transforms.forEach(function(t,i){
          dummy.position.set(t.x,t.y,slot.sectorIndex*sectorLength+t.along-odometer.traveled);
          dummy.rotation.set(t.rotationX,t.rotationY,t.rotationZ,"XYZ");dummy.scale.setScalar(t.scale);dummy.updateMatrix();
          if(slot.matrices[i])slot.matrices[i].copy(dummy.matrix);mesh.setMatrixAt(i,dummy.matrix);
        });
        mesh.instanceMatrix.needsUpdate=true;
      });
    }
    function tick(frame){
      if(destroyed)return null;var f=frame||{},ship=f.ship;
      if(f.paused)return null;
      if(!f.active){
        if(active){active=false;clearSlots();odometer=null;axis=null;}
        return null;
      }
      if(!scene||!ship||!ship.position||!ship.velocity)return null;
      if(!active||!odometer){
        active=true;runSeed=(Number(f.runSeed)>>>0)||runSeed||1;resetOdometer(f);
      }
      Core.advanceOdometer(odometer,{dt:f.dt,position:{x:ship.position.x,y:ship.position.y,z:ship.position.z},
        velocity:{x:ship.velocity.x,y:ship.velocity.y,z:ship.velocity.z}});
      var plan=Core.planWindow(windowState,odometer.traveled,{sectorLength:sectorLength,hysteresisRatio:hysteresisRatio,runSeed:runSeed});
      if(plan.changes.length)assignChanges(plan).catch(function(error){lastError=error&&error.message?error.message:String(error);});
      if(!rootGroup.parent)scene.add(rootGroup);updateMatrices(ship);frameCount+=1;
      return {origin:odometer.origin,drift:odometer.drift,traveled:odometer.traveled,sector:plan.currentSector,
        anchorSector:plan.anchorSector,residentSectors:plan.sectors.slice(),residentSlotCount:SLOT_COUNT,
        frameCount:frameCount,rebuildCount:rebuildCount};
    }
    function destroy(){
      if(destroyed)return;destroyed=true;active=false;clearSlots();
      if(rootGroup.parent)rootGroup.parent.remove(rootGroup);
      var seenMaterials=new Set(),seenTextures=new Set();
      templates.forEach(function(t){
        if(t.geometry&&typeof t.geometry.dispose==="function")t.geometry.dispose();
        var materials=Array.isArray(t.material)?t.material:[t.material];
        materials.forEach(function(m){
          if(!m||seenMaterials.has(m))return;seenMaterials.add(m);
          Object.keys(m).forEach(function(k){var texture=m[k];if(texture&&texture.isTexture&&typeof texture.dispose==="function"&&!seenTextures.has(texture)){seenTextures.add(texture);texture.dispose();}});
          if(typeof m.dispose==="function")m.dispose();
        });
      });
      templates=[];templatePromise=null;odometer=null;axis=null;
    }
    function snapshot(){
      return {active:active,odometer:odometer?{origin:{x:odometer.origin.x,y:odometer.origin.y,z:odometer.origin.z},
        drift:{x:odometer.drift.x,y:odometer.drift.y,z:odometer.drift.z},traveled:odometer.traveled,
        axis:{x:odometer.axis.x,y:odometer.axis.y,z:odometer.axis.z}}:null,
        slots:slots.map(function(s){return {slotId:s.slotId,sectorIndex:s.sectorIndex,generation:s.generation,seed:s.seed,status:s.status};}),
        frameCount:frameCount,rebuildCount:rebuildCount,lastError:lastError};
    }
    if(scene)scene.add(rootGroup);
    return {tick:tick,destroy:destroy,snapshot:snapshot,getSlotCount:function(){return slots.length;},getTemplates:function(){return templates.slice();}};
  }
  var api={SLOT_COUNT:SLOT_COUNT,SECTOR_LENGTH:DEFAULT_SECTOR_LENGTH,ASSET_NAMES:ASSET_NAMES.slice(),create:create,selfTest:selfTest};
  if(root){
    root.BCMWarpSectorScene=api;root.BCMWarpSectorSceneManager=root.BCMWarpSectorSceneManager||null;
    root.BCMWarpSectorSceneFrame=function(frame){
      if(!root.BCMWarpSectorSceneManager){
        if(!frame||!frame.active||frame.paused)return null;
        root.BCMWarpSectorSceneManager=create({THREE:frame.THREE,scene:frame.scene,
          assetBase:frame.assetBase||(root.BCMMiniSimConfig&&root.BCMMiniSimConfig.warpSectorAssetBase)||"",
          gltfLoaderUrl:frame.gltfLoaderUrl||(root.BCMMiniSimConfig&&root.BCMMiniSimConfig.gltfLoaderUrl)||"",
          runSeed:frame.runSeed});
      }
      return root.BCMWarpSectorSceneManager.tick(frame);
    };
    root.BCMWarpSectorSceneDestroy=function(){
      if(!root.BCMWarpSectorSceneManager)return;root.BCMWarpSectorSceneManager.destroy();root.BCMWarpSectorSceneManager=null;
    };
  }
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);