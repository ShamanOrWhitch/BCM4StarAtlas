/* Busan Thrill of Life prototype for Three.js r128 */
(function(scope){
 scope.createThrillControls=function(root){
  function get(name){var p=root.getObjectByName(name);if(!p)throw Error('Missing '+name);return p;}
  var w=[get('wing_L_pivot'),get('wing_R_pivot')],f=[get('fin_L_pivot'),get('fin_R_pivot')];
  function clamp(x){if(!Number.isFinite(x))throw Error('Angle must be finite');return Math.max(-.5,Math.min(.5,x));}
  return {setWings:function(a){a=clamp(a);w[0].rotation.z=-a;w[1].rotation.z=a;},setFins:function(a){a=clamp(a);f[0].rotation.z=a;f[1].rotation.z=-a;},reset:function(){w.concat(f).forEach(function(x){x.rotation.z=0;});}};
 };
})(typeof window!=='undefined'?window:globalThis);
