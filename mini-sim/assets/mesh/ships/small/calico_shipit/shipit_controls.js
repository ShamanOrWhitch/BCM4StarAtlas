/* Three.js r128. setEngineTilt: 0 = aft, 1.45 = down. */
(function(scope){
 scope.createShipitControls=function(root){
  function get(name){var n=root.getObjectByName(name);if(!n)throw new Error('Missing Shipit node: '+name);return n;}
  var pods=['engine_L_pivot','engine_R_pivot','rear_L_pivot','rear_R_pivot'].map(get), ramp=get('cargo_ramp_pivot');
  function clamp(v){if(!Number.isFinite(v))throw new Error('Finite angle required');return Math.max(0,Math.min(1.45,v));}
  return {
   setEngineTilt:function(a){a=clamp(a);pods.forEach(function(p){p.rotation.x=-a;});},
   setCargoRamp:function(a){ramp.rotation.x=-clamp(a);},
   reset:function(){pods.forEach(function(p){p.rotation.x=0;});ramp.rotation.x=0;}
  };
 };
})(typeof window!=='undefined'?window:globalThis);
