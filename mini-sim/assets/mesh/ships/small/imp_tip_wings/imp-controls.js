// Three.js r128: articulated rigid nodes, not a skinned GLTF skeleton.
function createIMPControls(root) {
  var j={}, names=['body_pivot','cockpit_pivot','shoulder_left','shoulder_right','elbow_left','elbow_right','hip_left','hip_right','knee_left','knee_right','ankle_left','ankle_right'];
  names.forEach(function(n){j[n]=root.getObjectByName(n);if(!j[n])throw Error('Missing joint: '+n);});
  var t=0,target=0,rad=Math.PI/180;
  function apply(t){
    var a=t*t*(3-2*t);j.body_pivot.rotation.set(0,0,0); // cockpit remains fixed to body; no independent motion
    ['left','right'].forEach(function(side){
      var sign=side==='left'?-1:1;
      j['shoulder_'+side].rotation.set(0,0,0);
      j['elbow_'+side].rotation.set(90*rad*a,0,sign*(.72+.28*a));
      j['hip_'+side].rotation.set(1.48*a,0,0);
      j['knee_'+side].rotation.set(-.18-.07*a,0,0);
      j['ankle_'+side].rotation.set(.22*a,0,0);
    });
  }
  function update(dt,seconds,walking){
    dt=Math.max(0,Math.min(.1,dt));t+=Math.max(-dt/1.5,Math.min(dt/1.5,target-t));apply(t);
    if(target===0&&t<.001&&walking){
      var a=Math.sin(seconds*4)*Math.max(0,Math.min(1,walking));
      j.hip_left.rotation.x=a*.35;j.hip_right.rotation.x=-a*.35;
      j.knee_left.rotation.x=-.18-Math.max(0,-a)*.45;
      j.knee_right.rotation.x=-.18-Math.max(0,a)*.45;
      j.shoulder_left.rotation.x=-a*.16;j.shoulder_right.rotation.x=a*.16;
    }
  }
  apply(0);
  return {joints:j,setFlight:function(on){target=on?1:0;},update:update,getProgress:function(){return t;}};
}
// var imp=createIMPControls(gltf.scene); imp.setFlight(true);
// Each frame: imp.update(deltaSeconds,elapsedSeconds,isWalking?1:0);
// Or manipulate imp.joints.knee_left.rotation.x yourself when update() is not driving it.
