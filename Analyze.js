// Analyze.js
let logs = [];
let hudEl = null;

export function initDebug(hudId){
  hudEl = document.getElementById(hudId);
  log("debug initialized");
}

function log(msg){
  const t = new Date().toLocaleTimeString();
  const line = `[${t}] ${msg}`;
  logs.push(line);
  if(hudEl) hudEl.textContent = line;
  console.log(line);
}

export function copyDebugLog(){
  navigator.clipboard.writeText(logs.join("\n"));
  alert("デバッグログをコピーしました");
}

/* ===== 共通 ===== */
function angle2D(a,b,c){
  const v1 = {x:a.x-b.x, y:a.y-b.y};
  const v2 = {x:c.x-b.x, y:c.y-b.y};
  const dot = v1.x*v2.x + v1.y*v2.y;
  const mag = Math.hypot(v1.x,v1.y)*Math.hypot(v2.x,v2.y);
  return Math.acos(dot/mag)*180/Math.PI;
}

async function processVideo(file, cb){
  const video=document.createElement("video");
  video.src=URL.createObjectURL(file);
  await video.play();

  const canvas=document.createElement("canvas");
  const ctx=canvas.getContext("2d");

  const hands=new Hands({
    locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`
  });
  hands.setOptions({maxNumHands:1,modelComplexity:1});
  hands.onResults(cb);

  for(let t=0;t<video.duration;t+=0.5){
    log(`seek ${t.toFixed(2)}s`);
    video.currentTime=t;
    await new Promise(r=>video.onseeked=r);
    canvas.width=video.videoWidth;
    canvas.height=video.videoHeight;
    ctx.drawImage(video,0,0);
    await hands.send({image:canvas});
  }
}

/* ===== ① MP / IP ===== */
export async function analyzeMPIP(file, outId){
  log("analyze MP/IP start");
  let MP=[], IP=[];
  await processVideo(file,res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];
    MP.push(180-angle2D(lm[0],lm[2],lm[3]));
    IP.push(180-angle2D(lm[2],lm[3],lm[4]));
  });
  document.getElementById(outId).innerHTML=
    `① MP / IP<br>
     MP：屈曲 ${Math.max(...MP).toFixed(1)}° / 伸展 ${Math.min(...MP).toFixed(1)}°<br>
     IP：屈曲 ${Math.max(...IP).toFixed(1)}° / 伸展 ${Math.min(...IP).toFixed(1)}°`;
  log("analyze MP/IP finished");
}

/* ===== ②③ CMC 外転（JOA準拠） ===== */
export async function analyzeCMC(file, outId, label){
  log(`analyze ${label} start`);
  let vals=[];
  await processVideo(file,res=>{
    if(!res.multiHandLandmarks) return;
    const lm=res.multiHandLandmarks[0];

    // 示指方向（基準 0°）
    const refA = lm[5];   // index MCP
    const refB = lm[6];   // index PIP

    // 母指第1中手骨方向
    const thA  = lm[1];   // thumb CMC
    const thB  = lm[2];   // thumb MCP

    const raw = angle2D(refB, refA, thB);
    const joa = Math.max(0, 180 - raw); // JOA定義
    vals.push(joa);
  });

  document.getElementById(outId).innerHTML +=
    `<br>${label}：${Math.max(...vals).toFixed(1)}°`;
  log(`analyze ${label} finished`);
}
