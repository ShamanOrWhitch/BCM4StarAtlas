(() => {
  "use strict";

  function boot(root){
    const filesInput=root.querySelector(".bcm-tower-slicer-files");
    const modeInput=root.querySelector(".bcm-tower-slicer-mode");
    const rowsInput=root.querySelector(".bcm-tower-slicer-rows");
    const colsInput=root.querySelector(".bcm-tower-slicer-cols");
    const minAreaInput=root.querySelector(".bcm-tower-slicer-min-area");
    const paddingInput=root.querySelector(".bcm-tower-slicer-padding");
    const runButton=root.querySelector(".bcm-tower-slicer-run");
    const exportAllButton=root.querySelector(".bcm-tower-slicer-export-all");
    const status=root.querySelector(".bcm-tower-slicer-status");
    const results=root.querySelector(".bcm-tower-slicer-results");
    const rowWrap=root.querySelector(".bcm-tower-slicer-grid-row-wrap");
    const colWrap=root.querySelector(".bcm-tower-slicer-grid-col-wrap");
    if(!filesInput||!runButton||!results)return;

    let outputs=[];

    function readImage(file){
      return new Promise((resolve,reject)=>{
        const url=URL.createObjectURL(file);
        const img=new Image();
        img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
        img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Не удалось открыть "+file.name))};
        img.src=url;
      });
    }

    function sampleBackground(data,w,h){
      const pts=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[Math.floor(w/2),0],[0,Math.floor(h/2)]];
      const vals=pts.map(([x,y])=>{const i=(y*w+x)*4;return[data[i],data[i+1],data[i+2],data[i+3]]});
      const valid=vals.filter(v=>v[3]>8);
      if(!valid.length)return[0,0,0,0];
      valid.sort((a,b)=>(a[0]+a[1]+a[2])-(b[0]+b[1]+b[2]));
      return valid[Math.floor(valid.length/2)];
    }

    function colorDistance(data,i,bg){
      const dr=data[i]-bg[0],dg=data[i+1]-bg[1],db=data[i+2]-bg[2];
      return Math.sqrt(dr*dr+dg*dg+db*db);
    }

    function detectRegionsAlpha(ctx,w,h,minArea){
      const data=ctx.getImageData(0,0,w,h).data;
      const scale=Math.max(1,Math.ceil(Math.max(w,h)/700));
      const sw=Math.ceil(w/scale),sh=Math.ceil(h/scale);
      const small=document.createElement("canvas");
      small.width=sw;small.height=sh;
      const sctx=small.getContext("2d",{willReadFrequently:true});
      sctx.drawImage(ctx.canvas,0,0,sw,sh);
      const sd=sctx.getImageData(0,0,sw,sh).data;
      const seen=new Uint8Array(sw*sh),boxes=[];
      const minSmall=Math.max(2,Math.floor(minArea/(scale*scale)));
      const idx=(x,y)=>y*sw+x;
      for(let y=0;y<sh;y++){
        for(let x=0;x<sw;x++){
          const p=idx(x,y),a=sd[p*4+3];
          if(seen[p]||a<16)continue;
          const q=[[x,y]];seen[p]=1;let n=0,minX=x,maxX=x,minY=y,maxY=y;
          for(let qi=0;qi<q.length;qi++){
            const [cx,cy]=q[qi];n++;
            if(cx<minX)minX=cx;if(cx>maxX)maxX=cx;if(cy<minY)minY=cy;if(cy>maxY)maxY=cy;
            const nb=[[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]];
            for(const [nx,ny] of nb){
              if(nx<0||ny<0||nx>=sw||ny>=sh)continue;
              const np=idx(nx,ny);if(seen[np]||sd[np*4+3]<16)continue;
              seen[np]=1;q.push([nx,ny]);
            }
          }
          if(n>=minSmall){
            boxes.push({x:minX*scale,y:minY*scale,w:(maxX-minX+1)*scale,h:(maxY-minY+1)*scale});
          }
        }
      }
      return mergeNear(boxes,scale*2,w,h);
    }

    function detectRegionsBackground(ctx,w,h,minArea){
      const max=700,scale=Math.max(1,Math.ceil(Math.max(w,h)/max)),sw=Math.ceil(w/scale),sh=Math.ceil(h/scale);
      const small=document.createElement("canvas");small.width=sw;small.height=sh;
      const sctx=small.getContext("2d",{willReadFrequently:true});sctx.drawImage(ctx.canvas,0,0,sw,sh);
      const data=sctx.getImageData(0,0,sw,sh).data,bg=sampleBackground(data,sw,sh);
      const mask=new Uint8Array(sw*sh);
      for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){const i=(y*sw+x)*4;mask[y*sw+x]=(data[i+3]>18 && colorDistance(data,i,bg)>34)?1:0}
      const seen=new Uint8Array(sw*sh),boxes=[],minSmall=Math.max(2,Math.floor(minArea/(scale*scale)));
      const p=(x,y)=>y*sw+x;
      for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
        const s=p(x,y);if(!mask[s]||seen[s])continue;
        const q=[[x,y]];seen[s]=1;let n=0,minX=x,maxX=x,minY=y,maxY=y;
        for(let qi=0;qi<q.length;qi++){const [cx,cy]=q[qi];n++;minX=Math.min(minX,cx);maxX=Math.max(maxX,cx);minY=Math.min(minY,cy);maxY=Math.max(maxY,cy);
          for(const [nx,ny] of [[cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]]){
            if(nx<0||ny<0||nx>=sw||ny>=sh)continue;const np=p(nx,ny);if(seen[np]||!mask[np])continue;seen[np]=1;q.push([nx,ny]);
          }
        }
        if(n>=minSmall)boxes.push({x:minX*scale,y:minY*scale,w:(maxX-minX+1)*scale,h:(maxY-minY+1)*scale});
      }
      return {boxes:mergeNear(boxes,scale*2,w,h),bg};
    }

    function mergeNear(boxes,gap,w,h){
      boxes=boxes.map(b=>({x:Math.max(0,b.x-gap),y:Math.max(0,b.y-gap),w:Math.min(w-Math.max(0,b.x-gap),b.w+gap*2),h:Math.min(h-Math.max(0,b.y-gap),b.h+gap*2)}));
      let changed=true;
      while(changed){
        changed=false;
        outer:for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
          const a=boxes[i],b=boxes[j];
          if(a.x<=b.x+b.w+gap&&a.x+a.w+gap>=b.x&&a.y<=b.y+b.h+gap&&a.y+a.h+gap>=b.y){
            const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),r=Math.max(a.x+a.w,b.x+b.w),bt=Math.max(a.y+a.h,b.y+b.h);
            boxes.splice(j,1,i, {x,y,w:r-x,h:bt-y});changed=true;break outer;
          }
        }
      }
      return boxes;
    }

    function gridRegions(w,h,rows,cols){
      const boxes=[];
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        boxes.push({x:Math.floor(x*w/cols),y:Math.floor(y*h/rows),w:Math.ceil(w/cols),h:Math.ceil(h/rows)});
      }
      return boxes;
    }

    function cropCanvas(source,b,padding,bg){
      const x=Math.max(0,Math.floor(b.x-padding)),y=Math.max(0,Math.floor(b.y-padding));
      const r=Math.min(source.width,Math.ceil(b.x+b.w+padding)),bt=Math.min(source.height,Math.ceil(b.y+b.h+padding));
      const out=document.createElement("canvas");out.width=Math.max(1,r-x);out.height=Math.max(1,bt-y);
      const o=out.getContext("2d");
      o.drawImage(source,x,y,out.width,out.height,0,0,out.width,out.height);
      if(bg){
        const im=o.getImageData(0,0,out.width,out.height),d=im.data;
        for(let i=0;i<d.length;i+=4){
          if(d[i+3]<12)continue;
          const dr=d[i]-bg[0],dg=d[i+1]-bg[1],db=d[i+2]-bg[2];
          if(Math.sqrt(dr*dr+dg*dg+db*db)<28)d[i+3]=0;
        }
        o.putImageData(im,0,0);
      }
      return out;
    }

    function downloadCanvas(canvas,name){
      canvas.toBlob(blob=>{
        if(!blob)return;
        const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
        setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);
      },"image/png");
    }

    function drawOverlay(baseCanvas,boxes){
      const wrap=document.createElement("div");wrap.className="bcm-tower-slicer-stage";wrap.style.width=Math.min(baseCanvas.width,900)+"px";
      const view=document.createElement("canvas");view.width=baseCanvas.width;view.height=baseCanvas.height;
      view.getContext("2d").drawImage(baseCanvas,0,0);wrap.appendChild(view);
      const scale=Math.min(1,900/baseCanvas.width);
      boxes.forEach((b,i)=>{
        const box=document.createElement("div");box.className="bcm-tower-slicer-box";box.style.left=(b.x*scale)+"px";box.style.top=(b.y*scale)+"px";box.style.width=(b.w*scale)+"px";box.style.height=(b.h*scale)+"px";box.title=String(i+1);wrap.appendChild(box);
      });
      return wrap;
    }

    async function analyze(){
      const files=[...(filesInput.files||[])];
      if(!files.length){status.textContent="Файлы ещё не выбраны.";return}
      results.innerHTML="";outputs=[];exportAllButton.disabled=true;runButton.disabled=true;
      const mode=modeInput.value,rows=Math.max(1,Number(rowsInput.value)||4),cols=Math.max(1,Number(colsInput.value)||4),minArea=Math.max(8,Number(minAreaInput.value)||160),padding=Math.max(0,Number(paddingInput.value)||0);
      let total=0;
      try{
        for(let fi=0;fi<files.length;fi++){
          const img=await readImage(files[fi]);
          const source=document.createElement("canvas");source.width=img.naturalWidth||img.width;source.height=img.naturalHeight||img.height;
          const ctx=source.getContext("2d",{willReadFrequently:true});ctx.drawImage(img,0,0);
          let boxes=[],bg=null;
          if(mode==="grid"){boxes=gridRegions(source.width,source.height,rows,cols)}
          else if(mode==="alpha"){boxes=detectRegionsAlpha(ctx,source.width,source.height,minArea)}
          else{const result=detectRegionsBackground(ctx,source.width,source.height,minArea);boxes=result.boxes;bg=result.bg}
          const sheet=document.createElement("section");sheet.className="bcm-tower-slicer-sheet";
          const h4=document.createElement("h4");h4.textContent=files[fi].name+" · "+boxes.length+" областей";sheet.appendChild(h4);
          sheet.appendChild(drawOverlay(source,boxes));
          const parts=document.createElement("div");parts.className="bcm-tower-slicer-parts";sheet.appendChild(parts);
          boxes.forEach((b,i)=>{
            const c=cropCanvas(source,b,padding,bg);
            const card=document.createElement("div");card.className="bcm-tower-slicer-part";
            const thumb=document.createElement("canvas");thumb.width=c.width;thumb.height=c.height;thumb.getContext("2d").drawImage(c,0,0);card.appendChild(thumb);
            const base=files[fi].name.replace(/\.[^.]+$/,"").replace(/[^a-z0-9_-]+/gi,"_");
            const name=base+"_"+String(i+1).padStart(3,"0")+".png";
            const small=document.createElement("small");small.textContent=name+" · "+c.width+"×"+c.height;card.appendChild(small);
            const btn=document.createElement("button");btn.type="button";btn.textContent="Скачать";btn.addEventListener("click",()=>downloadCanvas(c,name));card.appendChild(btn);
            parts.appendChild(card);outputs.push({canvas:c,name});total++;
          });
          results.appendChild(sheet);
          status.textContent="Обработано "+(fi+1)+"/"+files.length+" · найдено "+total+" областей";
        }
        exportAllButton.disabled=!outputs.length;
        status.textContent="Готово: "+files.length+" листов · "+total+" PNG.";
      }catch(err){status.textContent="Ошибка: "+(err&&err.message?err.message:err)}
      finally{runButton.disabled=false}
    }

    filesInput.addEventListener("change",()=>{
      status.textContent=(filesInput.files?.length||0)+" листов выбрано.";
      results.innerHTML="";outputs=[];exportAllButton.disabled=true;
    });

    function updateModeUI(){
      const grid=modeInput.value==="grid";rowWrap.hidden=!grid;colWrap.hidden=!grid;
    }
    modeInput.addEventListener("change",updateModeUI);updateModeUI();
    runButton.addEventListener("click",analyze);
    exportAllButton.addEventListener("click",()=>{
      if(!outputs.length)return;
      outputs.forEach((item,i)=>setTimeout(()=>downloadCanvas(item.canvas,item.name),i*220));
    });
  }

  function bootAll(){document.querySelectorAll(".bcm-tower-slicer").forEach(boot)}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootAll,{once:true});else bootAll();
})();