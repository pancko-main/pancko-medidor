/* Pancko Medidor V0.4 — motor geométrico sin dependencias externas */
(function(root, factory){
  "use strict";
  const api = factory();
  if(typeof module === "object" && module.exports) module.exports = api;
  if(root) root.PanckoGeometry = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function(){
  "use strict";

  const EPS = 1e-12;

  function assertFinitePoints(points, count, label="puntos"){
    if(!Array.isArray(points) || points.length !== count) throw new Error(`Se necesitan ${count} ${label}.`);
    if(points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error(`Hay ${label} no válidos.`);
  }

  function distance(a,b){ return Math.hypot(b.x-a.x,b.y-a.y); }

  function signedPolygonArea(points){
    let sum=0;
    for(let i=0;i<points.length;i++){
      const a=points[i], b=points[(i+1)%points.length];
      sum += a.x*b.y-b.x*a.y;
    }
    return sum/2;
  }

  function polygonArea(points){ return Math.abs(signedPolygonArea(points)); }

  function cross(a,b,c){
    return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  }

  function convexHull(points){
    const sorted=points.map(p=>({x:p.x,y:p.y})).sort((a,b)=>a.x-b.x || a.y-b.y);
    const lower=[];
    for(const p of sorted){
      while(lower.length>=2 && cross(lower[lower.length-2],lower[lower.length-1],p)<=0) lower.pop();
      lower.push(p);
    }
    const upper=[];
    for(let i=sorted.length-1;i>=0;i--){
      const p=sorted[i];
      while(upper.length>=2 && cross(upper[upper.length-2],upper[upper.length-1],p)<=0) upper.pop();
      upper.push(p);
    }
    lower.pop(); upper.pop();
    return lower.concat(upper);
  }

  function pointScale(points){
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
    return Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),1);
  }

  function hasDuplicatePoints(points){
    const tolerance=pointScale(points)*1e-8;
    for(let i=0;i<points.length;i++) for(let j=i+1;j<points.length;j++){
      if(distance(points[i],points[j])<=tolerance) return true;
    }
    return false;
  }

  function orderQuad(points){
    assertFinitePoints(points,4,"esquinas");
    if(hasDuplicatePoints(points)) throw new Error("Hay esquinas duplicadas o demasiado juntas.");
    let ordered=convexHull(points);
    if(ordered.length!==4) throw new Error("Las cuatro esquinas no forman un cuadrilátero convexo válido.");
    let start=0, best=Infinity;
    ordered.forEach((p,i)=>{
      const score=p.x+p.y;
      if(score<best){best=score;start=i;}
    });
    ordered=ordered.slice(start).concat(ordered.slice(0,start));
    if(signedPolygonArea(ordered)<0) ordered=[ordered[0],ordered[3],ordered[2],ordered[1]];
    return ordered;
  }

  function quadMetrics(points){
    const ordered=orderQuad(points);
    const sides=[0,1,2,3].map(i=>distance(ordered[i],ordered[(i+1)%4]));
    const angles=ordered.map((p,i)=>{
      const prev=ordered[(i+3)%4], next=ordered[(i+1)%4];
      const ax=prev.x-p.x, ay=prev.y-p.y, bx=next.x-p.x, by=next.y-p.y;
      const cosine=Math.max(-1,Math.min(1,(ax*bx+ay*by)/(Math.hypot(ax,ay)*Math.hypot(bx,by))));
      return Math.acos(cosine)*180/Math.PI;
    });
    const xs=ordered.map(p=>p.x), ys=ordered.map(p=>p.y);
    const bboxArea=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));
    return {
      ordered,
      area:polygonArea(ordered),
      sides,
      angles,
      fillRatio:bboxArea>0?polygonArea(ordered)/bboxArea:0,
      oppositeRatio:Math.max(sides[0]/sides[2],sides[2]/sides[0],sides[1]/sides[3],sides[3]/sides[1])
    };
  }

  function validateQuad(points){
    try{
      const m=quadMetrics(points);
      const scale=pointScale(m.ordered);
      if(m.area<=scale*scale*1e-8) return {valid:false,reason:"La geometría es degenerada o casi colineal."};
      if(m.sides.some(s=>s<=scale*1e-8)) return {valid:false,reason:"Algún lado es demasiado corto."};
      return {valid:true,ordered:m.ordered,metrics:m};
    }catch(error){
      return {valid:false,reason:error.message};
    }
  }

  function gaussianSolve(A,b){
    const n=b.length;
    const M=A.map((row,i)=>row.slice().concat(b[i]));
    let maxPivot=0, minPivot=Infinity;
    for(let col=0;col<n;col++){
      let pivot=col;
      for(let row=col+1;row<n;row++) if(Math.abs(M[row][col])>Math.abs(M[pivot][col])) pivot=row;
      const pivotAbs=Math.abs(M[pivot][col]);
      if(!Number.isFinite(pivotAbs) || pivotAbs<1e-11) throw new Error("Geometría degenerada: no se puede calcular una transformación estable.");
      maxPivot=Math.max(maxPivot,pivotAbs); minPivot=Math.min(minPivot,pivotAbs);
      [M[col],M[pivot]]=[M[pivot],M[col]];
      const divisor=M[col][col];
      for(let c=col;c<=n;c++) M[col][c]/=divisor;
      for(let row=0;row<n;row++){
        if(row===col) continue;
        const factor=M[row][col];
        for(let c=col;c<=n;c++) M[row][c]-=factor*M[col][c];
      }
    }
    if(minPivot/maxPivot<1e-12) throw new Error("La homografía es casi singular. Repetí o corregí la toma.");
    const solution=M.map(row=>row[n]);
    if(solution.some(v=>!Number.isFinite(v))) throw new Error("La homografía produjo valores no finitos.");
    return solution;
  }

  function multiply3(A,B){
    const C=new Array(9).fill(0);
    for(let r=0;r<3;r++) for(let c=0;c<3;c++) for(let k=0;k<3;k++) C[r*3+c]+=A[r*3+k]*B[k*3+c];
    return C;
  }

  function inverse3(M){
    const [a,b,c,d,e,f,g,h,i]=M;
    const A=e*i-f*h, B=c*h-b*i, C=b*f-c*e;
    const D=f*g-d*i, E=a*i-c*g, F=c*d-a*f;
    const G=d*h-e*g, H=b*g-a*h, I=a*e-b*d;
    const det=a*A+b*D+c*G;
    if(Math.abs(det)<EPS) throw new Error("Transformación singular.");
    return [A,B,C,D,E,F,G,H,I].map(v=>v/det);
  }

  function normalization(points){
    const cx=points.reduce((s,p)=>s+p.x,0)/points.length;
    const cy=points.reduce((s,p)=>s+p.y,0)/points.length;
    const mean=points.reduce((s,p)=>s+Math.hypot(p.x-cx,p.y-cy),0)/points.length;
    if(mean<EPS) throw new Error("Los puntos no tienen separación suficiente.");
    const scale=Math.SQRT2/mean;
    const T=[scale,0,-scale*cx, 0,scale,-scale*cy, 0,0,1];
    return {T,points:points.map(p=>({x:scale*(p.x-cx),y:scale*(p.y-cy)}))};
  }

  function transformPoint(H,p){
    const denominator=H[6]*p.x+H[7]*p.y+H[8];
    if(!Number.isFinite(denominator) || Math.abs(denominator)<EPS) throw new Error("Punto fuera del plano transformable.");
    const x=(H[0]*p.x+H[1]*p.y+H[2])/denominator;
    const y=(H[3]*p.x+H[4]*p.y+H[5])/denominator;
    if(!Number.isFinite(x)||!Number.isFinite(y)) throw new Error("La transformación produjo un punto no válido.");
    return {x,y};
  }

  function homography(src,dst){
    assertFinitePoints(src,4,"correspondencias de origen");
    assertFinitePoints(dst,4,"correspondencias de destino");
    const srcValidation=validateQuad(src), dstValidation=validateQuad(dst);
    if(!srcValidation.valid) throw new Error(`Referencia inválida: ${srcValidation.reason}`);
    if(!dstValidation.valid) throw new Error(`Plano métrico inválido: ${dstValidation.reason}`);
    const ns=normalization(src), nd=normalization(dst);
    const A=[], b=[];
    for(let i=0;i<4;i++){
      const x=ns.points[i].x, y=ns.points[i].y, u=nd.points[i].x, v=nd.points[i].y;
      A.push([x,y,1,0,0,0,-u*x,-u*y]); b.push(u);
      A.push([0,0,0,x,y,1,-v*x,-v*y]); b.push(v);
    }
    const h=gaussianSolve(A,b);
    const normalizedH=[h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];
    let H=multiply3(multiply3(inverse3(nd.T),normalizedH),ns.T);
    const factor=Math.abs(H[8])>EPS?H[8]:Math.max(...H.map(Math.abs));
    H=H.map(v=>v/factor);
    const targetScale=pointScale(dst);
    const maxResidual=Math.max(...src.map((p,i)=>distance(transformPoint(H,p),dst[i])));
    if(maxResidual>Math.max(1e-8,targetScale*1e-7)) throw new Error("La homografía no pudo recuperar las correspondencias con estabilidad.");
    return H;
  }

  function quadDimensions(points){
    assertFinitePoints(points,4,"esquinas métricas");
    const top=distance(points[0],points[1]), right=distance(points[1],points[2]);
    const bottom=distance(points[2],points[3]), left=distance(points[3],points[0]);
    return {width:(top+bottom)/2,height:(left+right)/2,sides:{top,right,bottom,left},method:"promedio de lados opuestos"};
  }

  function measureSurface(refPoints,refWidth,refHeight,surfacePoints){
    if(!(refWidth>0) || !(refHeight>0)) throw new Error("Las medidas de la referencia deben ser positivas.");
    const ref=orderQuad(refPoints), surface=orderQuad(surfacePoints);
    const destination=[{x:0,y:0},{x:refWidth,y:0},{x:refWidth,y:refHeight},{x:0,y:refHeight}];
    const H=homography(ref,destination);
    const metricPoints=surface.map(p=>transformPoint(H,p));
    const area=polygonArea(metricPoints), dimensions=quadDimensions(metricPoints);
    if(!Number.isFinite(area)||area<=0) throw new Error("El área calculada no es válida.");
    return {H,metricPoints,area,width:dimensions.width,height:dimensions.height,dimensions};
  }

  function segmentsIntersect(a,b,c,d){
    const o1=cross(a,b,c),o2=cross(a,b,d),o3=cross(c,d,a),o4=cross(c,d,b);
    return o1*o2<0&&o3*o4<0;
  }

  function isSelfCrossingQuad(q){
    if(!q||q.length!==4) return false;
    return segmentsIntersect(q[0],q[1],q[2],q[3])||segmentsIntersect(q[1],q[2],q[3],q[0]);
  }

  function nearImageEdge(points,w,h,margin=2){
    return points.some(p=>p.x<=margin||p.y<=margin||p.x>=w-margin||p.y>=h-margin);
  }

  function qualityAssessment(refPoints,surfacePoints,imageW,imageH){
    const issues=[];
    let severity=0;
    const imageArea=imageW*imageH;
    function issue(text,weight){issues.push(text);severity+=weight;}
    if(refPoints&&refPoints.length===4){
      const validation=validateQuad(refPoints);
      if(!validation.valid) issue(validation.reason,4);
      else{
        const m=validation.metrics, ratio=m.area/imageArea;
        if(ratio<0.001) issue("REFERENCIA DEMASIADO PEQUEÑA. Usá una referencia mayor o acercate.",3);
        else if(ratio<0.004) issue("La referencia es pequeña en la imagen; el ajuste de puntos será sensible.",1);
        if(Math.min(...m.sides)<24) issue("Algún lado de la referencia tiene menos de 24 píxeles.",2);
        if(m.oppositeRatio>5||Math.min(...m.angles)<12) issue("La perspectiva sobre la referencia es extrema.",3);
        else if(m.oppositeRatio>3||Math.min(...m.angles)<20) issue("La perspectiva sobre la referencia es pronunciada.",1);
        if(nearImageEdge(m.ordered,imageW,imageH)) issue("La referencia toca el borde de la imagen; comprobá que esté completa.",2);
      }
    }
    if(surfacePoints&&surfacePoints.length===4){
      const validation=validateQuad(surfacePoints);
      if(!validation.valid) issue(`Superficie inválida: ${validation.reason}`,4);
      else{
        if(validation.metrics.area/imageArea<0.03) issue("La superficie marcada ocupa muy poco de la imagen.",1);
        if(nearImageEdge(validation.ordered,imageW,imageH)) issue("La superficie toca el borde; comprobá que esté completamente encuadrada.",1);
      }
    }
    if(severity===0) return {level:"good",label:"BUENA TOMA",issues:["Geometría consistente para una estimación."]};
    if(severity<=2) return {level:"ok",label:"TOMA ACEPTABLE",issues};
    return {level:"bad",label:"CONVIENE REPETIR",issues};
  }

  function wallAreas(width,height,discounts=[]){
    const gross=width*height;
    const discount=discounts.reduce((sum,d)=>sum+d.width*d.height*d.quantity,0);
    return {gross,discount,net:Math.max(0,gross-discount),rawNet:gross-discount};
  }

  function roomAreas(length,width,height,discounts=[],includeCeiling=true,applyDiscounts=true){
    const wallsGross=2*(length+width)*height;
    const discount=applyDiscounts?discounts.reduce((sum,d)=>sum+d.width*d.height*d.quantity,0):0;
    const rawWallsNet=wallsGross-discount;
    const wallsNet=Math.max(0,rawWallsNet);
    const ceiling=includeCeiling?length*width:0;
    return {wallsGross,discount,wallsNet,rawWallsNet,ceiling,total:wallsNet+ceiling,includeCeiling,applyDiscounts};
  }

  function poolAreas(length,width,depth){
    const floor=length*width, walls=2*(length+width)*depth;
    return {floor,walls,total:floor+walls};
  }

  function solariumArea(length,width,sides){
    const outerLength=length+sides.top+sides.bottom;
    const outerWidth=width+sides.left+sides.right;
    const outer=outerLength*outerWidth, pool=length*width;
    return {outerLength,outerWidth,outer,pool,area:outer-pool};
  }

  function compareMeasurement(measured,real){
    if(!(real>0)) return null;
    const difference=measured-real;
    return {measured,real,difference,errorPercent:difference/real*100};
  }

  return {
    homography,transformPoint,polygonArea,signedPolygonArea,distance,quadDimensions,
    orderQuad,validateQuad,quadMetrics,isSelfCrossingQuad,qualityAssessment,
    measureSurface,wallAreas,roomAreas,poolAreas,solariumArea,compareMeasurement
  };
});
