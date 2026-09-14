/* Utilidades puras del editor táctil — separadas para poder probarlas sin DOM. */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  if(root) root.PanckoEditorUtils=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function clamp(value,min,max){ return Math.max(min,Math.min(value,max)); }

  function loupePosition(pointer,bounds,size=160,gap=22){
    let left=pointer.x+gap;
    let top=pointer.y-size-gap;
    if(left+size>bounds.right) left=pointer.x-size-gap;
    if(top<bounds.top) top=pointer.y+gap;
    if(top+size>bounds.bottom) top=pointer.y-size-gap;
    return {
      left:clamp(left,bounds.left,Math.max(bounds.left,bounds.right-size)),
      top:clamp(top,bounds.top,Math.max(bounds.top,bounds.bottom-size))
    };
  }

  return {loupePosition};
});
