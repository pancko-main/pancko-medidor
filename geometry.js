/* Pancko Medidor — motor geométrico sin dependencias externas */
(function(global){
  "use strict";

  function gaussianSolve(A, b){
    const n = b.length;
    const M = A.map((row,i)=>row.slice().concat(b[i]));
    for(let col=0; col<n; col++){
      let pivot = col;
      for(let r=col+1; r<n; r++){
        if(Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
      }
      if(Math.abs(M[pivot][col]) < 1e-12) throw new Error("Geometría degenerada: no se puede calcular una transformación estable.");
      [M[col], M[pivot]] = [M[pivot], M[col]];
      const div = M[col][col];
      for(let c=col; c<=n; c++) M[col][c] /= div;
      for(let r=0; r<n; r++){
        if(r === col) continue;
        const factor = M[r][col];
        for(let c=col; c<=n; c++) M[r][c] -= factor * M[col][c];
      }
    }
    return M.map(row=>row[n]);
  }

  function homography(src, dst){
    if(src.length !== 4 || dst.length !== 4) throw new Error("Se necesitan cuatro correspondencias.");
    const A=[], b=[];
    for(let i=0;i<4;i++){
      const {x,y}=src[i], {x:u,y:v}=dst[i];
      A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u);
      A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v);
    }
    const h = gaussianSolve(A,b);
    return [h[0],h[1],h[2], h[3],h[4],h[5], h[6],h[7],1];
  }

  function transformPoint(H,p){
    const d = H[6]*p.x + H[7]*p.y + H[8];
    if(Math.abs(d) < 1e-12) throw new Error("Punto fuera del plano transformable.");
    return {
      x:(H[0]*p.x + H[1]*p.y + H[2])/d,
      y:(H[3]*p.x + H[4]*p.y + H[5])/d
    };
  }

  function polygonArea(pts){
    let s=0;
    for(let i=0;i<pts.length;i++){
      const a=pts[i], b=pts[(i+1)%pts.length];
      s += a.x*b.y - b.x*a.y;
    }
    return Math.abs(s)/2;
  }

  function distance(a,b){ return Math.hypot(b.x-a.x,b.y-a.y); }

  function quadDimensions(pts){
    const top=distance(pts[0],pts[1]), right=distance(pts[1],pts[2]);
    const bottom=distance(pts[2],pts[3]), left=distance(pts[3],pts[0]);
    return {width:(top+bottom)/2, height:(left+right)/2, sides:{top,right,bottom,left}};
  }

  function orderQuad(pts){
    if(!pts || pts.length !== 4) return (pts || []).slice();
    const p = pts.map(q=>({x:q.x,y:q.y}));
    const sums = p.map(q=>q.x+q.y);
    const diffs = p.map(q=>q.y-q.x);
    const iTL = sums.indexOf(Math.min(...sums));
    const iBR = sums.indexOf(Math.max(...sums));
    const iTR = diffs.indexOf(Math.min(...diffs));
    const iBL = diffs.indexOf(Math.max(...diffs));
    const idx = [iTL,iTR,iBR,iBL];
    if(new Set(idx).size === 4) return idx.map(i=>p[i]);

    const cx=p.reduce((s,q)=>s+q.x,0)/4, cy=p.reduce((s,q)=>s+q.y,0)/4;
    let ordered=p.slice().sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
    let start=0, best=Infinity;
    ordered.forEach((q,i)=>{const s=q.x+q.y;if(s<best){best=s;start=i}});
    ordered=ordered.slice(start).concat(ordered.slice(0,start));
    if(ordered[1].x < ordered[3].x) ordered=[ordered[0],ordered[3],ordered[2],ordered[1]];
    return ordered;
  }

  function signedCross(a,b,c){
    return (b.x-a.x)*(c.y-a.y) - (b.y-a.y)*(c.x-a.x);
  }

  function segmentsIntersect(a,b,c,d){
    const o1=signedCross(a,b,c), o2=signedCross(a,b,d), o3=signedCross(c,d,a), o4=signedCross(c,d,b);
    return (o1*o2 < 0 && o3*o4 < 0);
  }

  function isSelfCrossingQuad(q){
    return segmentsIntersect(q[0],q[1],q[2],q[3]) || segmentsIntersect(q[1],q[2],q[3],q[0]);
  }

  function quadAreaPixels(q){ return polygonArea(q); }

  function qualityAssessment(refPts, surfacePts, imageW, imageH){
    const issues=[];
    let score=0;
    if(refPts && refPts.length===4){
      refPts=orderQuad(refPts);
      const refArea=quadAreaPixels(refPts);
      const imageArea=imageW*imageH;
      const ratio=refArea/imageArea;
      if(ratio < 0.002){ issues.push("La referencia ocupa muy pocos píxeles. Acercate o usá una referencia más grande."); score+=2; }
      else if(ratio < 0.006){ issues.push("La referencia es algo pequeña en la imagen."); score+=1; }
      if(isSelfCrossingQuad(refPts)){ issues.push("Los puntos de la referencia están cruzados."); score+=3; }
      const d=quadDimensions(refPts).sides;
      const minSide=Math.min(d.top,d.right,d.bottom,d.left), maxSide=Math.max(d.top,d.right,d.bottom,d.left);
      if(minSide < 20){ issues.push("Algún lado de la referencia es demasiado corto en la imagen."); score+=2; }
      if(maxSide/minSide > 8){ issues.push("La perspectiva sobre la referencia es extrema."); score+=2; }
    }
    if(surfacePts && surfacePts.length===4){
      surfacePts=orderQuad(surfacePts);
      const a=quadAreaPixels(surfacePts)/(imageW*imageH);
      if(a < 0.03){ issues.push("La superficie marcada ocupa muy poco de la imagen."); score+=1; }
    }
    if(score===0) return {level:"good",label:"BUENA TOMA",issues:["Geometría consistente para una estimación."]};
    if(score<=2) return {level:"ok",label:"TOMA ACEPTABLE",issues};
    return {level:"bad",label:"CONVIENE REPETIR",issues};
  }

  global.PanckoGeometry = {
    homography, transformPoint, polygonArea, distance, quadDimensions,
    orderQuad, isSelfCrossingQuad, qualityAssessment
  };
})(window);
