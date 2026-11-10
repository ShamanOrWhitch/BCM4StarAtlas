/* Photoli Lite for Three.js r128. CPU deformation + vertex colours; no custom shader. */
(function (scope) {
  scope.createPhotoliLite = function (root) {
    var hull=root.getObjectByName('photoli_hull');
    if(!hull || !hull.isMesh) throw Error('photoli_hull mesh not found');
    var previousGeometry=hull.geometry, previousMaterial=hull.material;
    var geometry=previousGeometry.clone();
    var pos=geometry.getAttribute('position');
    var base=new Float32Array(pos.array), colors=new Float32Array(pos.count*3);
    var cb=new THREE.BufferAttribute(colors,3); geometry.setAttribute('color',cb);
    hull.geometry=geometry;
    var material=new THREE.MeshBasicMaterial({vertexColors:true}); hull.material=material;
    var morph=0,activity=0,hue=0,flow=1,irid=0.7,gloss=0.7,last=-Infinity,dirty=true;
    function clamp(v){if(!Number.isFinite(v))throw Error('Expected finite number');return Math.max(0,Math.min(1,v));}
    function update(time,camera){
      if(!Number.isFinite(time))return;
      if(!dirty && time-last<1/12 && time>=last)return;
      dirty=false;last=time;
      var angle=0;
      if(camera){var c=new THREE.Vector3();camera.getWorldPosition(c);hull.worldToLocal(c);angle=Math.atan2(c.x,c.z);}
      for(var i=0;i<pos.count;i++){
        var k=i*3,x=base[k],y=base[k+1],z=base[k+2],u=Math.max(0,Math.min(1,(z+1.75)/3.5)),s=Math.sin(Math.PI*u);
        pos.array[k]=x*(1+morph*.38*s)+morph*.13*Math.sin(2*Math.PI*u);
        pos.array[k+1]=y*(1-morph*.28*s)+activity*.018*s*Math.sin(time*1.2+u*9);
        pos.array[k+2]=z;
        var t=time*flow;
        var flowA=Math.sin(z*4.2+x*3.1-t*.85),flowB=Math.sin(z*7.3-y*5.2+t*.55);
        var band=Math.pow(Math.max(0,flowA*.5+.5),8)*(.10+.12*irid)*(.5+.5*activity);
        var phase=angle*1.2+u*2+t*.10+hue;
        var ir=(.05+.10*irid);
        colors[k]=Math.min(1,.34+.08*gloss+band+ir*Math.cos(phase));
        colors[k+1]=Math.min(1,.38+.08*gloss+band+ir*Math.cos(phase+2.094));
        colors[k+2]=Math.min(1,.43+.08*gloss+band+ir*Math.cos(phase+4.188));
      }
      pos.needsUpdate=true;cb.needsUpdate=true;geometry.computeBoundingSphere();
    }
    return {
      setMorph:function(v){var q=clamp(v);if(q!==morph){morph=q;dirty=true;}},
      setActivity:function(v){var q=clamp(v);if(q!==activity){activity=q;dirty=true;}},
      setHue:function(v){if(!Number.isFinite(v))throw Error('Expected finite number');hue=v;dirty=true;},
      setFlow:function(v){if(!Number.isFinite(v))throw Error('Expected finite number');flow=Math.max(0,Math.min(3,v));dirty=true;},
      setIridescence:function(v){var q=clamp(v);if(q!==irid){irid=q;dirty=true;}},
      setGloss:function(v){var q=clamp(v);if(q!==gloss){gloss=q;dirty=true;}},
      update:update,
      dispose:function(){hull.geometry=previousGeometry;hull.material=previousMaterial;geometry.dispose();material.dispose();}
    };
  };
})(typeof window!=='undefined'?window:globalThis);
