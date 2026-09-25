const SIZE = 8;
const SHAPES = [
  [[0,0]], [[0,0],[1,0]], [[0,0],[1,0],[2,0]], [[0,0],[0,1],[0,2]],
  [[0,0],[1,0],[0,1],[1,1]], [[0,0],[1,0],[2,0],[0,1]], [[0,0],[0,1],[1,1]],
  [[0,0],[1,0],[2,0],[1,1]], [[0,0],[0,1],[0,2],[1,2]], [[0,0],[1,0],[1,1]]
];
const COLORS=['#62d5b6','#ef86bb','#f5c958','#76d57c','#75c9f4'];
const boardEl = document.querySelector('#board');
const trayEl = document.querySelector('#tray');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const fillEl = document.querySelector('#progressFill');
const overEl = document.querySelector('#gameOver');
const rescueStatus=document.querySelector('#rescueStatus');
let board, score, pieces, drag, rescueMode=false;
let audioCtx;
const realBirdCall=new Audio('assets/bourkes-parrot-call.ogv');
realBirdCall.id='realBirdCall'; realBirdCall.preload='auto'; realBirdCall.volume=.72; realBirdCall.hidden=true; document.body.append(realBirdCall);

function audio(){
  if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function tone(from,to,duration=.12,volume=.04,type='sine',delay=0){
  const a=audio(),t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(from,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,to),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g).connect(a.destination);o.start(t);o.stop(t+duration+.02);
}
function noise(duration=.12,volume=.035,delay=0,lowpass=1200){
  const a=audio(),t=a.currentTime+delay,len=Math.ceil(a.sampleRate*duration),buffer=a.createBuffer(1,len,a.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<len;i++)data[i]=(Math.random()*2-1)*(1-i/len);const src=a.createBufferSource(),filter=a.createBiquadFilter(),g=a.createGain();src.buffer=buffer;filter.type='lowpass';filter.frequency.value=lowpass;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);src.connect(filter).connect(g).connect(a.destination);src.start(t);
}
function birdCall(){realBirdCall.pause();realBirdCall.currentTime=0;realBirdCall.play().catch(()=>{})}
function wingSfx(){noise(.16,.018,0,1800);tone(650,420,.12,.012,'triangle')}
function peckSfx(delay=0){tone(1750,620,.055,.045,'square',delay);noise(.045,.018,delay,2500)}
function hammerWhoosh(){noise(.28,.045,0,650);tone(170,75,.3,.06,'sawtooth')}
function hammerHitSfx(){tone(95,42,.16,.075,'sine');noise(.13,.055,0,480)}
function placeSfx(){tone(520,360,.07,.025,'triangle')}
function clearSfx(){tone(520,980,.16,.035,'sine');tone(720,1320,.2,.03,'sine',.08)}

for(let i=0;i<SIZE*SIZE;i++){ const c=document.createElement('div'); c.className='cell'; c.dataset.i=i; boardEl.append(c); }
const cells=[...boardEl.children];
const key=(x,y)=>y*SIZE+x;

function initialBoard(){
  const b=Array(SIZE*SIZE).fill(0);
  [[3,0],[4,0],[3,1],[4,1],[3,2],[4,2],[0,3],[1,3],[2,3],[5,3],[6,3],[7,3],[0,4],[1,4],[2,4],[5,4],[6,4],[7,4],[3,5],[4,5],[3,6],[4,6],[3,7],[4,7]].forEach(([x,y])=>b[key(x,y)]='#75d17a');
  return b;
}
function newGame(){
  board=initialBoard(); score=0; pieces=[{shape:[[0,0],[1,0],[0,1],[1,1]],color:'#f5c958'}];
  rescueMode=false; rescueStatus.hidden=true; overEl.open&&overEl.close(); render();
}
function render(){
  cells.forEach((c,i)=>{c.className='cell'+(board[i]?' filled':'');c.style.setProperty('--block-color',board[i]||'')});
  scoreEl.textContent=score; const best=Math.max(score,+(localStorage.blockBest||0)); bestEl.textContent=best;
  fillEl.style.width=Math.min(100,score/10)+'%'; renderTray();
}
function renderTray(){
  trayEl.innerHTML=''; pieces.forEach((piece,index)=>{
    if(!piece){ trayEl.append(document.createElement('div')); return; } const {shape,color}=piece;
    const maxX=Math.max(...shape.map(p=>p[0])), maxY=Math.max(...shape.map(p=>p[1]));
    const p=document.createElement('div'); p.className='piece'; p.style.setProperty('--cols',maxX+1); p.style.setProperty('--rows',maxY+1); p.style.setProperty('--piece-color',color); p.dataset.piece=index;
    shape.forEach(([x,y])=>{const b=document.createElement('i'); b.className='block'; b.style.gridColumn=x+1; b.style.gridRow=y+1; p.append(b)});
    p.addEventListener('pointerdown',startDrag); trayEl.append(p);
  });
}
function canPlace(shape,x,y){return shape.every(([dx,dy])=>x+dx>=0&&x+dx<SIZE&&y+dy>=0&&y+dy<SIZE&&!board[key(x+dx,y+dy)]);}
function clearPreview(){cells.forEach(c=>c.classList.remove('preview','bad'));}
function clearBlastPreview(){cells.forEach(c=>c.classList.remove('blast-target','blast-center'));}
function preview(shape,x,y,ok,color){clearPreview();shape.forEach(([dx,dy])=>{const X=x+dx,Y=y+dy;if(X>=0&&X<SIZE&&Y>=0&&Y<SIZE&&!board[key(X,Y)]){cells[key(X,Y)].classList.add(ok?'preview':'bad');cells[key(X,Y)].style.setProperty('--preview-color',color)}});}
function pointCell(clientX,clientY){
  const r=boardEl.getBoundingClientRect();
  const cellW=r.width/SIZE,cellH=r.height/SIZE;
  return {x:Math.floor((clientX-r.left)/cellW),y:Math.floor((clientY-r.top)/cellH)};
}
function startDrag(e){
  if(rescueMode)return;
  const el=e.currentTarget, index=+el.dataset.piece, {shape,color}=pieces[index]; el.setPointerCapture(e.pointerId); el.classList.add('dragging');
  const ghost=el.cloneNode(true); ghost.className='drag-ghost'; document.body.append(ghost);
  drag={el,index,shape,color,ghost,x:-9,y:-9}; moveDrag(e);
  el.onpointermove=moveDrag; el.onpointerup=endDrag; el.onpointercancel=endDrag;
}
function moveDrag(e){
  if(!drag)return;
  drag.ghost.style.left=e.clientX+'px'; drag.ghost.style.top=e.clientY+'px';
  const p=pointCell(e.clientX,e.clientY);
  const w=Math.max(...drag.shape.map(v=>v[0]))+1,h=Math.max(...drag.shape.map(v=>v[1]))+1;
  // 指针锚定在形状底边中央：视觉方块与实际落点始终使用同一格坐标。
  drag.x=p.x-Math.floor(w/2); drag.y=p.y-h+1;
  preview(drag.shape,drag.x,drag.y,canPlace(drag.shape,drag.x,drag.y),drag.color);
}
async function endDrag(){
  if(!drag)return; const {shape,color,x,y,index,el,ghost}=drag; clearPreview(); el.classList.remove('dragging'); ghost.remove();
  if(canPlace(shape,x,y)){
    shape.forEach(([dx,dy])=>board[key(x+dx,y+dy)]=color); pieces[index]=null; score+=shape.length; placeSfx(); render(); await clearLines();
    if(pieces.every(p=>!p)) pieces=Array.from({length:3},()=>({shape:SHAPES[Math.floor(Math.random()*SHAPES.length)],color:COLORS[Math.floor(Math.random()*COLORS.length)]}));
  }
  drag=null; render(); if(!hasMove()) gameOver();
}
async function clearLines(){
  const rows=[],cols=[]; for(let y=0;y<SIZE;y++)if(Array.from({length:SIZE},(_,x)=>board[key(x,y)]).every(Boolean))rows.push(y);
  for(let x=0;x<SIZE;x++)if(Array.from({length:SIZE},(_,y)=>board[key(x,y)]).every(Boolean))cols.push(x);
  const doomed=new Set(); rows.forEach(y=>{for(let x=0;x<SIZE;x++)doomed.add(key(x,y))});cols.forEach(x=>{for(let y=0;y<SIZE;y++)doomed.add(key(x,y))});
  if(doomed.size){clearSfx();doomed.forEach(i=>cells[i].classList.add('clearing'));burst([...doomed]);popScore((rows.length+cols.length)*10*SIZE);await new Promise(r=>setTimeout(r,430));}
  rows.forEach(y=>{for(let x=0;x<SIZE;x++)board[key(x,y)]=0}); cols.forEach(x=>{for(let y=0;y<SIZE;y++)board[key(x,y)]=0});
  if(rows.length+cols.length) score+=(rows.length+cols.length)*10*SIZE;
}
function burst(indices,count=2){const br=boardEl.getBoundingClientRect(),s=br.width/SIZE;indices.forEach(i=>{const x=i%SIZE,y=Math.floor(i/SIZE);for(let n=0;n<count;n++){const p=document.createElement('i');p.className='particle';p.style.left=br.left+(x+.5)*s+'px';p.style.top=br.top+(y+.5)*s+'px';p.style.setProperty('--particle',board[i]||'#ff9b3f');p.style.setProperty('--dx',(Math.random()*130-65)+'px');p.style.setProperty('--dy',(Math.random()*125-88)+'px');document.body.append(p);setTimeout(()=>p.remove(),650)}})}
function popScore(amount){const p=document.createElement('b');p.className='score-pop';p.textContent='+'+amount;document.querySelector('.game-shell').append(p);setTimeout(()=>p.remove(),800)}
function hasMove(){return pieces.filter(Boolean).some(p=>{for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(canPlace(p.shape,x,y))return true;return false});}
function gameOver(){localStorage.blockBest=Math.max(score,+(localStorage.blockBest||0));document.querySelector('#finalScore').textContent=score;setTimeout(()=>{if(!overEl.open)overEl.showModal()},250);}
async function hammerRescue(){
  overEl.close(); rescueMode='cinematic'; const shell=document.querySelector('.game-shell'),frame=document.querySelector('.board-frame');
  hammerWhoosh();
  const comic=document.createElement('div');comic.className='comic-entry';comic.innerHTML='<b>巨锤降临!</b>';shell.append(comic);await new Promise(r=>setTimeout(r,520));comic.remove();
  const hammer=document.createElement('div');hammer.className='mega-hammer';hammer.textContent='🔨';shell.append(hammer);
  const br=boardEl.getBoundingClientRect(),sr=shell.getBoundingClientRect(),s=br.width/SIZE;
  hammer.style.left='-100px';hammer.style.top=(br.top-sr.top+br.height*.5)+'px';
  await hammer.animate([{left:'-100px',transform:'translate(-50%,-58%) rotate(-80deg) scale(.45)'},{left:'58%',transform:'translate(-50%,-80%) rotate(24deg) scale(1.18)'},{left:'18%',transform:'translate(-50%,-58%) rotate(-38deg) scale(1)'}],{duration:620,easing:'cubic-bezier(.18,.9,.24,1.2)',fill:'forwards'}).finished;
  const occupied=cells.map((_,i)=>i).filter(i=>board[i]);
  for(const target of occupied){
    const left=br.left-sr.left+(target%SIZE+.5)*s,top=br.top-sr.top+(Math.floor(target/SIZE)+.5)*s;
    await hammer.animate([{left:hammer.style.left,top:hammer.style.top,transform:'translate(-50%,-58%) rotate(-38deg)'},{left:left+'px',top:top+'px',transform:'translate(-50%,-70%) rotate(-54deg)'}],{duration:95,easing:'cubic-bezier(.25,.8,.35,1)',fill:'forwards'}).finished;hammer.style.left=left+'px';hammer.style.top=top+'px';
    cells[target].classList.add('hammer-warning');await hammer.animate([{transform:'translate(-50%,-70%) rotate(-72deg) scale(1.08)'},{transform:'translate(-50%,-35%) rotate(22deg) scale(1.2)'}],{duration:115,easing:'cubic-bezier(.65,0,.9,.5)',fill:'forwards'}).finished;
    hammerHitSfx();cells[target].classList.remove('hammer-warning');cells[target].classList.add('cracked','clearing');frame.classList.remove('cinematic-shake');void frame.offsetWidth;frame.classList.add('cinematic-shake');
    const star=document.createElement('i');star.className='impact-star';star.style.left=left-11+'px';star.style.top=top-11+'px';shell.append(star);burst([target],5);board[target]=0;setTimeout(()=>star.remove(),400);await new Promise(r=>setTimeout(r,35));
  }
  await new Promise(r=>setTimeout(r,180));
  await hammer.animate([{left:hammer.style.left,opacity:1},{left:(shell.clientWidth+120)+'px',top:'90px',opacity:0,transform:'translate(-50%,-58%) rotate(320deg) scale(.5)'}],{duration:520,easing:'cubic-bezier(.5,0,.9,.4)',fill:'forwards'}).finished;
  hammer.remove();frame.classList.remove('cinematic-shake');rescueMode=false;render();
}
function birdRescue(){
  overEl.close(); rescueMode='cinematic'; rescueStatus.hidden=true;
  birdCall();wingSfx();setTimeout(wingSfx,780);
  const shell=document.querySelector('.game-shell'),bird=document.createElement('div');bird.className='bird-scout bird-sprite bird-innocent';bird.id='birdScout';bird.setAttribute('role','img');bird.setAttribute('aria-label','偷偷靠近的牡丹鹦鹉');shell.append(bird);
  const br=boardEl.getBoundingClientRect(),sr=shell.getBoundingClientRect(),floor=br.top-sr.top+br.height-106;
  bird.style.left='-150px';bird.style.top=floor+'px';
  bird.animate([
    {offset:0,left:'-150px',top:(floor+5)+'px',transform:'rotate(-7deg) scale(.52)'},
    {offset:.16,left:'-4%',top:(floor-3)+'px',transform:'rotate(4deg) scale(.57)'},
    {offset:.32,left:'10%',top:(floor+4)+'px',transform:'rotate(-4deg) scale(.6)'},
    {offset:.48,left:'22%',top:(floor-4)+'px',transform:'rotate(4deg) scale(.62)'},
    {offset:.64,left:'33%',top:(floor+3)+'px',transform:'rotate(-3deg) scale(.64)'},
    {offset:.8,left:'42%',top:(floor-3)+'px',transform:'rotate(2deg) scale(.66)'},
    {offset:1,left:'calc(50% - 70px)',top:floor+'px',transform:'rotate(0) scale(.68)'}
  ],{duration:1750,easing:'cubic-bezier(.32,.02,.25,1)',fill:'forwards'}).finished.then(()=>{bird.style.left='calc(50% - 70px)';bird.style.top=floor+'px';bird.classList.remove('bird-innocent');bird.classList.add('bird-angry','enraged');const eyes=document.createElement('i');eyes.className='bird-eyes';eyes.style.left='calc(50% - 23px)';eyes.style.top=(floor+37)+'px';shell.append(eyes);setTimeout(()=>eyes.remove(),380);setTimeout(birdAttack,420)});
}
async function birdAttack(){
  const bird=document.querySelector('#birdScout');if(!bird)return;const stealScore=score>0&&Math.random()<.28,shell=document.querySelector('.game-shell'),sr=shell.getBoundingClientRect();
  if(stealScore){
    const text=String(score),pos=Math.floor(Math.random()*text.length),digit=text[pos],next=text.slice(0,pos)+text.slice(pos+1),rect=scoreEl.getBoundingClientRect();
    bird.classList.remove('bird-angry');bird.classList.add('bird-dive');const scoreLeft=rect.left-sr.left+rect.width/2-70,scoreTop=rect.top-sr.top-45;wingSfx();await bird.animate([{transform:'scale(.7) rotate(-8deg)'},{left:scoreLeft+'px',top:scoreTop+'px',transform:'scale(.58) rotate(-22deg)'}],{duration:560,easing:'cubic-bezier(.55,.05,.8,.3)',fill:'forwards'}).finished;peckSfx();peckSfx(.12);peckSfx(.24);await bird.animate([{transform:'translateY(0) rotate(-22deg)'},{transform:'translateY(15px) rotate(-35deg)'},{transform:'translateY(-7px) rotate(-10deg)'},{transform:'translateY(13px) rotate(-34deg)'},{transform:'translateY(0) rotate(-20deg)'}],{duration:360,easing:'ease-in-out'}).finished;
    const d=document.createElement('b');d.className='stolen-digit';d.textContent=digit;d.style.left=rect.left-sr.left+rect.width/2+'px';d.style.top=rect.top-sr.top+'px';shell.append(d);score=Math.max(0,parseInt(next||'0',10));scoreEl.textContent=score;setTimeout(()=>d.remove(),1050);
  } else {
    const occupied=cells.map((_,i)=>i).filter(i=>board[i]);if(occupied.length){const target=occupied[Math.floor(Math.random()*occupied.length)],br=boardEl.getBoundingClientRect(),s=br.width/SIZE,x=target%SIZE,y=Math.floor(target/SIZE),left=br.left-sr.left+(x+.5)*s-70,top=br.top-sr.top+(y+.5)*s-80;bird.classList.remove('bird-angry');bird.classList.add('bird-dive');wingSfx();await bird.animate([{transform:'scale(.72) rotate(-8deg)'},{left:left+'px',top:top+'px',transform:'scale(.58) rotate(-24deg)'}],{duration:560,easing:'cubic-bezier(.55,.05,.8,.3)',fill:'forwards'}).finished;cells[target].classList.add('hammer-warning');peckSfx();peckSfx(.14);peckSfx(.28);await bird.animate([{transform:'translateY(0) rotate(-24deg)'},{transform:'translateY(18px) rotate(-38deg)'},{transform:'translateY(-8px) rotate(-10deg)'},{transform:'translateY(16px) rotate(-36deg)'},{transform:'translateY(-5px) rotate(-12deg)'},{transform:'translateY(15px) rotate(-35deg)'}],{duration:420,easing:'ease-in-out'}).finished;cells[target].classList.add('cracked');burst([target],8);await new Promise(r=>setTimeout(r,150));cells[target].classList.remove('hammer-warning');cells[target].classList.add('clearing');await new Promise(r=>setTimeout(r,400));board[target]=0;}
  }
  bird.remove();rescueMode=false;render();if(!hasMove())gameOver();
}
function startRescue(kind){if(rescueMode)return;if(overEl.open)overEl.close();kind==='hammer'?hammerRescue():birdRescue();}
document.querySelectorAll('[data-rescue]').forEach(b=>b.onclick=()=>startRescue(b.dataset.rescue));
document.querySelector('#restart').onclick=newGame;
newGame();
