(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const G = window.PanckoGeometry;

  const state = {
    view:"home",
    imageMode:"photo",
    stream:null,
    imageCanvas:null,
    imageBitmap:null,
    points:[],
    dragging:-1,
    gesture:null,
    zoom:100,
    calibration:"a4",
    lastImageResult:null,
    openingSeq:0
  };

  function fmt(n,d=2){
    return Number(n).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:d});
  }
  function val(id){ return Number($(id).value)||0; }
  function show(el, yes=true){ el.classList.toggle("hidden",!yes); }
  function setView(name){
    $$(".view").forEach(v=>v.classList.remove("active"));
    $(`#${name}View`).classList.add("active");
    state.view=name;
    show($("#backBtn"), name!=="home");
    window.scrollTo({top:0,behavior:"smooth"});
  }
  $("#backBtn").addEventListener("click", ()=>{
    stopCamera();
    setView("home");
  });

  $$(".mode-card").forEach(b=>b.addEventListener("click",()=>{
    const mode=b.dataset.go;
    if(mode==="manual") return setView("manual");
    openImageMode(mode);
  }));

  function openImageMode(mode){
    state.imageMode=mode;
    setView("image");
    resetImageFlow();
    const defaultRadio=document.querySelector('input[name="calibrationMode"][value="a4"]');
    if(defaultRadio) defaultRadio.checked=true;
    state.calibration="a4";
    show($("#a4OrientationFields"),true);
    show($("#customReferenceFields"),false);
    show($("#knownPlaneFields"),false);
    $("#imageModeTitle").textContent = mode==="camera" ? "Medir con cámara" : "Medir desde foto";
    $("#imageModeHelp").textContent = mode==="camera"
      ? "Colocá una referencia conocida sobre el mismo plano y sacá una foto completa."
      : "Cargá una foto o captura y calibrala con una referencia conocida.";
    show($("#cameraPanel"), mode==="camera");
    show($("#uploadPanel"), mode==="photo");
    $$(".photo-only").forEach(x=>show(x,mode==="photo"));
    if(mode==="camera") startCamera();
  }

  function resetImageFlow(){
    state.points=[];
    state.lastImageResult=null;
    show($("#calibrationCard"),false);
    show($("#editorCard"),false);
    show($("#imageResultCard"),false);
    $("#compareOutput").textContent="";
    $("#realAreaInput").value="";
    $("#photoInput").value="";
  }

  async function startCamera(){
    stopCamera();
    const msg=$("#cameraMsg");
    if(!navigator.mediaDevices?.getUserMedia){
      msg.textContent="Este navegador no expone acceso directo a cámara. Usá la opción de foto/captura.";
      return;
    }
    try{
      state.stream=await navigator.mediaDevices.getUserMedia({
        video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},
        audio:false
      });
      $("#cameraVideo").srcObject=state.stream;
      $("#captureBtn").disabled=false;
      msg.textContent="Cámara lista. Encuadrá la superficie completa y la referencia.";
    }catch(err){
      msg.textContent="No pude abrir la cámara. Revisá permiso/HTTPS o usá Medir desde foto.";
      $("#captureBtn").disabled=true;
    }
  }
  function stopCamera(){
    if(state.stream){ state.stream.getTracks().forEach(t=>t.stop()); state.stream=null; }
    $("#captureBtn").disabled=true;
  }
  $("#startCameraBtn").addEventListener("click",startCamera);
  $("#captureBtn").addEventListener("click",()=>{
    const video=$("#cameraVideo");
    if(!video.videoWidth) return;
    const c=document.createElement("canvas");
    const max=2200, scale=Math.min(1,max/Math.max(video.videoWidth,video.videoHeight));
    c.width=Math.round(video.videoWidth*scale); c.height=Math.round(video.videoHeight*scale);
    c.getContext("2d").drawImage(video,0,0,c.width,c.height);
    stopCamera();
    useCanvasImage(c);
  });

  $("#photoInput").addEventListener("change", async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    try{
      const img=await loadImageFile(file);
      const c=downsampleImage(img,2200);
      useCanvasImage(c);
    }catch(err){ alert("No pude leer esa imagen."); }
  });

  function loadImageFile(file){
    return new Promise((res,rej)=>{
      const url=URL.createObjectURL(file), img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);res(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error("image"))};
      img.src=url;
    });
  }
  function downsampleImage(img,max){
    const s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement("canvas");
    c.width=Math.max(1,Math.round(img.naturalWidth*s)); c.height=Math.max(1,Math.round(img.naturalHeight*s));
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    return c;
  }
  function useCanvasImage(c){
    state.imageCanvas=c;
    show($("#calibrationCard"),true);
    $("#calibrationCard").scrollIntoView({behavior:"smooth",block:"start"});
  }

  $$('input[name="calibrationMode"]').forEach(r=>r.addEventListener("change",()=>{
    state.calibration=$('input[name="calibrationMode"]:checked').value;
    show($("#a4OrientationFields"),state.calibration==="a4");
    show($("#customReferenceFields"),state.calibration==="custom");
    show($("#knownPlaneFields"),state.calibration==="known-plane");
  }));

  $("#beginMarkingBtn").addEventListener("click",()=>{
    if(!state.imageCanvas) return;
    state.calibration=$('input[name="calibrationMode"]:checked').value;
    if(state.calibration==="custom" && (val("#refWidth")<=0 || val("#refHeight")<=0)) return alert("Ingresá medidas válidas para la referencia.");
    if(state.calibration==="known-plane" && (val("#planeWidth")<=0 || val("#planeHeight")<=0)) return alert("Ingresá ancho y alto reales.");
    state.points=[];
    setupEditorCanvas();
    show($("#editorCard"),true);
    show($("#imageResultCard"),false);
    updateEditorUI();
    $("#editorCard").scrollIntoView({behavior:"smooth",block:"start"});
  });

  function setupEditorCanvas(){
    const src=state.imageCanvas, c=$("#editorCanvas");
    c.width=src.width; c.height=src.height;
    applyZoom(100);
    hideLoupe();
    renderEditor();
  }

  function setActiveZoomPreset(value){
    $$(".zoom-preset").forEach(btn=>btn.classList.toggle("active", Number(btn.dataset.zoom)===Number(value)));
  }

  function applyZoom(value){
    state.zoom=Number(value)||100;
    $("#zoomRange").value=state.zoom;
    $("#editorCanvas").style.width=`${state.zoom}%`;
    setActiveZoomPreset(state.zoom);
  }

  function hideLoupe(){
    show($("#loupe"), false);
  }

  function showLoupe(point, clientX, clientY){
    if(!state.imageCanvas) return;
    const loupe=$("#loupe"), lc=$("#loupeCanvas"), lctx=lc.getContext("2d");
    const size=lc.width;
    const zoomFactor=2.6;
    const sample=size/zoomFactor;
    lctx.clearRect(0,0,size,size);
    lctx.imageSmoothingEnabled=true;
    lctx.drawImage($("#editorCanvas"),
      point.x - sample/2, point.y - sample/2, sample, sample,
      0,0,size,size
    );
    lctx.save();
    lctx.strokeStyle="rgba(255,255,255,.95)";
    lctx.lineWidth=2;
    lctx.beginPath(); lctx.moveTo(size/2,0); lctx.lineTo(size/2,size); lctx.stroke();
    lctx.beginPath(); lctx.moveTo(0,size/2); lctx.lineTo(size,size/2); lctx.stroke();
    lctx.restore();

    const vp=$("#canvasViewport");
    const rect=vp.getBoundingClientRect();
    const loupeSize=160, gap=18;
    let left=(clientX-rect.left)+gap;
    let top=(clientY-rect.top)-loupeSize-gap;
    if(left+loupeSize > rect.width-6) left=(clientX-rect.left)-loupeSize-gap;
    if(left < 6) left=6;
    if(top < 6) top=(clientY-rect.top)+gap;
    if(top+loupeSize > rect.height-6) top=Math.max(6, rect.height-loupeSize-6);
    loupe.style.left=`${left}px`;
    loupe.style.top=`${top}px`;
    show(loupe, true);
  }

  function targetPointCount(){ return state.calibration==="known-plane" ? 4 : 8; }
  function updateEditorUI(){
    const n=state.points.length, target=targetPointCount();
    $("#pointCount").textContent=n; $("#pointTarget").textContent=target;
    if(state.calibration==="known-plane"){
      $("#markingTitle").textContent="Marcá las 4 esquinas de la superficie";
      $("#markingInstruction").textContent="Tocá las 4 esquinas en cualquier orden. Después podés arrastrarlas y hacer zoom.";
    }else if(n<4){
      $("#markingTitle").textContent="Marcá la referencia";
      $("#markingInstruction").textContent=`Esquina ${n+1}/4 · podés tocarlas en cualquier orden.`;
    }else{
      $("#markingTitle").textContent="Marcá la superficie";
      $("#markingInstruction").textContent=`Esquina ${Math.min(4,n-3)}/4 · podés tocarlas en cualquier orden.`;
    }
    $("#calculateImageBtn").disabled=n!==target;
    updateQuality();
    renderEditor();
  }

  function canvasPointFromEvent(e){
    const c=$("#editorCanvas"), r=c.getBoundingClientRect();
    return {x:(e.clientX-r.left)*(c.width/r.width), y:(e.clientY-r.top)*(c.height/r.height)};
  }
  function hitPoint(p){
    const c=$("#editorCanvas"), r=c.getBoundingClientRect();
    const scale=c.width/r.width, radius=24*scale;
    let best=-1,bd=Infinity;
    state.points.forEach((q,i)=>{const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<radius&&d<bd){best=i;bd=d}});
    return best;
  }
  const canvas=$("#editorCanvas");
  canvas.addEventListener("pointerdown",e=>{
    if(!state.imageCanvas) return;
    const p=canvasPointFromEvent(e), hit=hitPoint(p);
    canvas.setPointerCapture(e.pointerId);
    if(hit>=0){
      state.dragging=hit;
      state.gesture=null;
      renderEditor();
      showLoupe(state.points[hit], e.clientX, e.clientY);
    }else{
      const vp=$("#canvasViewport");
      state.gesture={
        pointerId:e.pointerId,
        startX:e.clientX,startY:e.clientY,
        scrollLeft:vp.scrollLeft,scrollTop:vp.scrollTop,
        point:p,moved:false
      };
    }
    e.preventDefault();
  });

  canvas.addEventListener("pointermove",e=>{
    if(state.dragging>=0){
      const p=canvasPointFromEvent(e);
      p.x=Math.max(0,Math.min(canvas.width,p.x)); p.y=Math.max(0,Math.min(canvas.height,p.y));
      state.points[state.dragging]=p;
      renderEditor();
      updateQuality();
      showLoupe(p, e.clientX, e.clientY);
      e.preventDefault();
      return;
    }
    if(state.gesture && state.gesture.pointerId===e.pointerId){
      const dx=e.clientX-state.gesture.startX, dy=e.clientY-state.gesture.startY;
      if(Math.hypot(dx,dy)>7 && state.zoom>100){
        state.gesture.moved=true;
        const vp=$("#canvasViewport");
        vp.scrollLeft=state.gesture.scrollLeft-dx;
        vp.scrollTop=state.gesture.scrollTop-dy;
      }
      e.preventDefault();
    }
  });

  function endPointer(e){
    if(state.dragging>=0){
      state.dragging=-1;
      hideLoupe();
      updateEditorUI();
    }else if(state.gesture && state.gesture.pointerId===e.pointerId){
      if(!state.gesture.moved && state.points.length<targetPointCount()){
        state.points.push(state.gesture.point);
        updateEditorUI();
      }
      state.gesture=null;
    }
  }
  canvas.addEventListener("pointerup",endPointer);
  canvas.addEventListener("pointercancel",()=>{state.dragging=-1;state.gesture=null;hideLoupe();renderEditor()});

  $("#undoPointBtn").addEventListener("click",()=>{state.points.pop();hideLoupe();updateEditorUI()});
  $("#resetPointsBtn").addEventListener("click",()=>{state.points=[];hideLoupe();updateEditorUI()});

  $("#zoomRange").addEventListener("input",e=>{
    applyZoom(Number(e.target.value));
    if(Number(e.target.value)>100 && !$("#markingInstruction").textContent.includes("arrastrá el fondo")){
      $("#markingInstruction").textContent += " Con zoom, arrastrá el fondo para moverte.";
    }
  });
  $$(".zoom-preset").forEach(btn=>btn.addEventListener("click",()=>{
    applyZoom(Number(btn.dataset.zoom));
    if(Number(btn.dataset.zoom)>100 && !$("#markingInstruction").textContent.includes("arrastrá el fondo")){
      $("#markingInstruction").textContent += " Con zoom, arrastrá el fondo para moverte.";
    }
  }));

  function renderEditor(){
    const c=$("#editorCanvas"), ctx=c.getContext("2d");
    if(!state.imageCanvas) return;
    ctx.clearRect(0,0,c.width,c.height); ctx.drawImage(state.imageCanvas,0,0);
    const groups = state.calibration==="known-plane"
      ? [{pts:state.points.slice(0,4),color:"#22c55e",base:0}]
      : [{pts:state.points.slice(0,4),color:"#f59e0b",base:0},{pts:state.points.slice(4,8),color:"#22c55e",base:4}];
    groups.forEach(g=>drawGroup(ctx,g.pts,g.color,g.base));
  }
  function drawGroup(ctx,pts,color,baseIndex=0){
    if(!pts.length)return;
    ctx.save();ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=Math.max(3,canvas.width/500);
    ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
    if(pts.length===4)ctx.closePath();ctx.stroke();
    const rad=Math.max(10,canvas.width/110);
    pts.forEach((p,i)=>{
      const globalIndex=baseIndex+i;
      const isActive=globalIndex===state.dragging;
      const pointRadius=isActive ? rad*1.22 : rad;
      if(isActive){
        ctx.beginPath();
        ctx.arc(p.x,p.y,pointRadius+6,0,Math.PI*2);
        ctx.fillStyle="rgba(255,255,255,.92)";
        ctx.fill();
        ctx.fillStyle=color;
      }
      ctx.beginPath();ctx.arc(p.x,p.y,pointRadius,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#111827";ctx.font=`bold ${Math.max(14,pointRadius*1.1)}px sans-serif`;ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText(String(i+1),p.x,p.y);ctx.fillStyle=color;
    });ctx.restore();
  }

  function updateQuality(){
    const box=$("#qualityBox");
    if(!state.imageCanvas || state.points.length<4){show(box,false);return}
    const ref=state.calibration==="known-plane"?null:state.points.slice(0,4);
    const surf=state.calibration==="known-plane"?state.points.slice(0,4):(state.points.length>=8?state.points.slice(4,8):null);
    const q=G.qualityAssessment(ref,surf,state.imageCanvas.width,state.imageCanvas.height);
    box.className=`quality ${q.level}`; box.innerHTML=`<strong>${q.label}</strong><br>${q.issues.join(" ")}`; show(box,true);
  }

  $("#calculateImageBtn").addEventListener("click",()=>{
    try{
      let area,width,height,origin,warning="";
      if(state.calibration==="known-plane"){
        const q=G.orderQuad(state.points.slice(0,4));
        width=val("#planeWidth");height=val("#planeHeight");area=width*height;
        origin="ESTIMACIÓN DESDE IMAGEN";
        warning="El ancho y alto reales fueron aportados por vos; la imagen sirve para definir el plano. En Street View tratá el resultado como estimación.";
      }else{
        const ref=G.orderQuad(state.points.slice(0,4)), surf=G.orderQuad(state.points.slice(4,8));
        let rw,rh;
        if(state.calibration==="a4"){
          const landscape=$("#a4Orientation").value==="landscape";
          rw=landscape?.297:.210; rh=landscape?.210:.297;
        } else {rw=val("#refWidth")/100;rh=val("#refHeight")/100}
        const dst=[{x:0,y:0},{x:rw,y:0},{x:rw,y:rh},{x:0,y:rh}];
        const H=G.homography(ref,dst);
        const metric=surf.map(p=>G.transformPoint(H,p));
        area=G.polygonArea(metric);
        const dims=G.quadDimensions(metric);width=dims.width;height=dims.height;
        if(!isFinite(area)||area<=0||area>100000) throw new Error("El resultado no es geométricamente razonable. Revisá los puntos.");
        origin=state.imageMode==="camera"?"MEDICIÓN CON CÁMARA + REFERENCIA":"MEDICIÓN DESDE REFERENCIA FOTOGRÁFICA";
      }
      state.lastImageResult={area,width,height};
      $("#imageOrigin").textContent=origin;
      $("#imageArea").textContent=fmt(area,1);
      $("#imageWidth").textContent=`${fmt(width,2)} m`;
      $("#imageHeight").textContent=`${fmt(height,2)} m`;
      $("#imageResultWarning").textContent=warning;show($("#imageResultWarning"),!!warning);
      show($("#imageResultCard"),true);
      $("#imageResultCard").scrollIntoView({behavior:"smooth",block:"start"});
    }catch(err){alert(err.message||"No pude calcular la superficie.");}
  });

  $("#adjustImageBtn").addEventListener("click",()=>$("#editorCard").scrollIntoView({behavior:"smooth"}));
  $("#newImageMeasureBtn").addEventListener("click",()=>{
    stopCamera(); resetImageFlow();
    show($("#cameraPanel"),state.imageMode==="camera"); show($("#uploadPanel"),state.imageMode==="photo");
    if(state.imageMode==="camera") startCamera();
  });
  $("#compareRealBtn").addEventListener("click",()=>{
    if(!state.lastImageResult)return;
    const real=val("#realAreaInput");if(real<=0)return alert("Ingresá una superficie real válida.");
    const measured=state.lastImageResult.area, diff=measured-real, pct=diff/real*100;
    $("#compareOutput").innerHTML=`Medido: <strong>${fmt(measured,2)} m²</strong> · Real: <strong>${fmt(real,2)} m²</strong><br>Diferencia: <strong>${diff>=0?"+":""}${fmt(diff,2)} m² (${pct>=0?"+":""}${fmt(pct,2)} %)</strong>`;
  });

  // Manual
  $$(".seg").forEach(b=>b.addEventListener("click",()=>{
    $$(".seg").forEach(x=>x.classList.toggle("active",x===b));
    $$(".manual-panel").forEach(x=>show(x,false));
    show($(`#${b.dataset.manual}Panel`),true);
  }));

  function addOpening(data={name:"Ventana",w:1.2,h:1.1,qty:1}){
    const id=++state.openingSeq, wrap=document.createElement("div");
    wrap.className="opening-row";wrap.dataset.id=id;
    wrap.innerHTML=`
      <label>Nombre<input class="op-name" type="text" value="${data.name}"></label>
      <label>Ancho<input class="op-w" type="number" inputmode="decimal" min="0" step=".01" value="${data.w}"></label>
      <label>Alto<input class="op-h" type="number" inputmode="decimal" min="0" step=".01" value="${data.h}"></label>
      <label class="qty-wrap">Cant.<input class="op-q" type="number" inputmode="numeric" min="1" step="1" value="${data.qty}"></label>
      <button class="remove-opening" aria-label="Quitar">×</button>`;
    wrap.querySelector(".remove-opening").addEventListener("click",()=>wrap.remove());
    $("#openingsList").appendChild(wrap);
  }
  $("#addOpeningBtn").addEventListener("click",()=>addOpening());
  addOpening({name:"Ventana",w:1.2,h:1.1,qty:2});
  addOpening({name:"Puerta",w:.9,h:2,qty:1});
  addOpening({name:"Portón",w:3,h:2.2,qty:1});

  $("#calcWallBtn").addEventListener("click",()=>{
    const w=val("#wallW"),h=val("#wallH"),gross=w*h;
    let disc=0,lines="";
    $$("#openingsList .opening-row").forEach(r=>{
      const name=r.querySelector(".op-name").value||"Descuento";
      const ow=Number(r.querySelector(".op-w").value)||0, oh=Number(r.querySelector(".op-h").value)||0, q=Math.max(1,Number(r.querySelector(".op-q").value)||1);
      const a=ow*oh*q;disc+=a;lines+=line(`${name} × ${q}`,`− ${fmt(a,2)} m²`);
    });
    const net=Math.max(0,gross-disc);
    $("#wallResult").innerHTML=`<div class="calc-summary">${line("Superficie bruta",`${fmt(gross,2)} m²`)}${lines}${line("SUPERFICIE NETA",`${fmt(net,2)} m²`,"total")}</div>`;
  });

  $("#calcFloorBtn").addEventListener("click",()=>{
    const a=val("#floorL")*val("#floorW");
    $("#floorResult").innerHTML=`<div class="calc-summary">${line("SUPERFICIE",`${fmt(a,2)} m²`,"total")}</div>`;
  });

  $("#calcPoolBtn").addEventListener("click",()=>{
    const L=val("#poolL"),W=val("#poolW"),D=val("#poolD");
    const floor=L*W,walls=2*(L+W)*D,total=floor+walls;
    $("#poolResult").innerHTML=`<div class="calc-summary">${line("Piso",`${fmt(floor,2)} m²`)}${line("Paredes",`${fmt(walls,2)} m²`)}${line("TOTAL INTERIOR",`${fmt(total,2)} m²`,"total")}</div>`;
  });

  $("#uniformSolarium").addEventListener("change",e=>{
    show($("#uniformSolFields"),e.target.checked);show($("#sideSolFields"),!e.target.checked);
  });
  $("#calcSolBtn").addEventListener("click",()=>{
    const L=val("#solPoolL"),W=val("#solPoolW");
    let t,b,l,r;
    if($("#uniformSolarium").checked){t=b=l=r=val("#solUniform")}
    else{t=val("#solTop");b=val("#solBottom");l=val("#solLeft");r=val("#solRight")}
    const outerL=L+t+b, outerW=W+l+r, outer=outerL*outerW, pool=L*W, sol=outer-pool;
    $("#solResult").innerHTML=`<div class="calc-summary">${line("Rectángulo exterior",`${fmt(outer,2)} m²`)}${line("Pileta",`− ${fmt(pool,2)} m²`)}${line("SOLÁRIUM",`${fmt(sol,2)} m²`,"total")}</div>`;
  });

  function line(a,b,cls=""){return `<div class="calc-line ${cls}"><span>${a}</span><strong>${b}</strong></div>`}

  applyZoom(100);

  // PWA
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
  }

  // cálculo inicial útil
  $("#calcWallBtn").click();
})();
