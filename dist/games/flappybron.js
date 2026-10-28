// FlappyBron — deterministic simulation, resolution-independent canvas artwork.
export const DIFFICULTIES = Object.freeze({
  easy: { speed: 170, gap: 212, interval: 1.9, gravity: 820, flap: -330 },
  normal: { speed: 205, gap: 188, interval: 1.8, gravity: 900, flap: -350 },
  hard: { speed: 240, gap: 166, interval: 1.65, gravity: 950, flap: -360 }
});
export function circleRect(x, y, r, rx, ry, rw, rh) {
  const dx = x - Math.max(rx, Math.min(x, rx + rw));
  const dy = y - Math.max(ry, Math.min(y, ry + rh));
  return dx * dx + dy * dy < r * r;
}
export function nextGap(previous, gap, random = Math.random) {
  const margin = gap / 2 + 52;
  return Math.max(margin, Math.min(540 - margin, previous + (random() - .5) * 130));
}

export function createGame(api) {
  const cfg = DIFFICULTIES[api.difficulty] || DIFFICULTIES.normal;
  const player = { x: 215, y: 280, vy: 0, r: 18 };
  const obstacles = [], particles = [];
  let elapsed = 0, spawn = .35, center = 280, score = 0, coins = 0, started = false, ended = false, groundScroll = 0;
  const held = new Set();
  const say = status => api.updateHUD?.({score, status});
  say('Tap, click or press Space to take flight');
  function sound(name) { api.sound?.(name); }
  function finish() {
    if (ended) return;
    ended = true;
    sound('lose');
    api.finish?.({score, coins, message: score ? `${score} hoops cleared. Keep chasing the crown!` : 'A quick tap keeps you flying. Give it another shot!'});
  }
  function flap() {
    if (ended) return;
    started = true;
    player.vy = cfg.flap;
    say('Fly through the hoops · collect gold rings');
    sound('flap');
    for (let i = 0; i < 5; i++) particles.push({x:player.x - 18,y:player.y + i * 3, vx:-45 - i * 12,vy:20+i*9,life:.38});
  }
  function update(dt) {
    if (ended) return;
    dt = Math.min(Math.max(dt, 0), .05);
    elapsed += dt;
    for (let i=particles.length-1; i>=0; i--) {const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
    if (!started) return;
    groundScroll = (groundScroll + cfg.speed * dt) % 100;
    player.vy += cfg.gravity * dt;
    player.y += player.vy * dt;
    if (player.y - player.r < 15 || player.y + player.r > 546) { finish(); return; }
    spawn -= dt;
    if (spawn <= 0) {
      center = nextGap(center, cfg.gap);
      obstacles.push({x:980, center, scored:false, ring:false});
      spawn += cfg.interval;
    }
    for (let i=obstacles.length-1; i>=0; i--) {
      const o=obstacles[i]; o.x -= cfg.speed * dt;
      const top=o.center-cfg.gap/2, bottom=o.center+cfg.gap/2;
      // Render and hitbox use the same 58px-wide obstacle including backboard edge.
      if (circleRect(player.x,player.y,player.r,o.x-5,0,58,top) || circleRect(player.x,player.y,player.r,o.x-5,bottom,58,600-bottom)) {finish();return;}
      if (!o.ring && Math.hypot(player.x-(o.x+24),player.y-o.center) < player.r + 14) {
        o.ring=true;coins++;sound('coin');say(`${coins} ring${coins===1?'':'s'} collected`);
        for(let j=0;j<10;j++){const a=j*Math.PI/5;particles.push({x:o.x+24,y:o.center,vx:Math.cos(a)*90,vy:Math.sin(a)*90,life:.5});}
      }
      if(!o.scored && o.x+53 < player.x-player.r){o.scored=true;score++;sound('score');say(`${score} hoops · ${coins} rings`);}
      if(o.x < -90)obstacles.splice(i,1);
    }
  }
  function action(name,down) {
    if (name !== 'primary' && name !== 'up') return;
    if (!down) {held.delete(name);return;}
    if(held.has(name))return;
    held.add(name);flap();
  }
  function draw(ctx,w,h) {
    ctx.save();ctx.scale(w/960,h/600);
    const sky=ctx.createLinearGradient(0,0,0,600);sky.addColorStop(0,'#191932');sky.addColorStop(.65,'#4d346a');sky.addColorStop(1,'#e6a77b');ctx.fillStyle=sky;ctx.fillRect(0,0,960,600);
    // Sunset, stadium beams and city silhouettes remain deliberately quiet behind gameplay.
    ctx.fillStyle='#e7b4aa';ctx.globalAlpha=.15;ctx.beginPath();ctx.arc(740,230,115,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    for(let i=0;i<19;i++){const x=i*57;const hh=50+(i*37%90);ctx.fillStyle=i%2?'#28213d':'#30233f';ctx.fillRect(x,460-hh,45,hh+90);ctx.fillStyle='#ba8974';ctx.globalAlpha=.25;for(let yy=470-hh;yy<455;yy+=18)for(let xx=x+8;xx<x+37;xx+=13)ctx.fillRect(xx,yy,4,6);ctx.globalAlpha=1;}
    ctx.strokeStyle='#b397be';ctx.globalAlpha=.13;ctx.lineWidth=1;for(let x=0;x<1000;x+=36){ctx.beginPath();ctx.moveTo(x,425);ctx.lineTo(x-90,546);ctx.stroke();}for(let y=425;y<546;y+=18){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(960,y);ctx.stroke();}ctx.globalAlpha=1;
    ctx.fillStyle='#26203a';ctx.fillRect(0,546,960,54);ctx.fillStyle='#ae855a';ctx.fillRect(0,546,960,4);ctx.strokeStyle='#5a405b';ctx.lineWidth=2;for(let i=-1;i<11;i++){ctx.beginPath();ctx.moveTo(i*100-groundScroll,550);ctx.lineTo(i*100-groundScroll-35,600);ctx.stroke();}
    ctx.strokeStyle='#b58b65';ctx.globalAlpha=.3;ctx.beginPath();ctx.ellipse(500,580,180,25,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    for(const o of obstacles){
      const top=o.center-cfg.gap/2, bottom=o.center+cfg.gap/2;
      const beam=ctx.createLinearGradient(o.x,0,o.x+48,0);beam.addColorStop(0,'#6c559c');beam.addColorStop(.35,'#a78ac7');beam.addColorStop(.65,'#6c559c');beam.addColorStop(1,'#48315f');
      ctx.fillStyle=beam;ctx.fillRect(o.x,0,48,top-13);ctx.fillRect(o.x,bottom+13,48,550-bottom);
      ctx.fillStyle='#e9dab4';ctx.fillRect(o.x-5,top-20,58,20);ctx.fillRect(o.x-5,bottom,58,20);
      ctx.fillStyle='#fff2d0';ctx.fillRect(o.x-5,top-20,58,4);ctx.fillRect(o.x-5,bottom,58,4);
      ctx.fillStyle='#d98844';ctx.fillRect(o.x+8,top-13,32,5);ctx.fillRect(o.x+8,bottom+8,32,5);
      ctx.strokeStyle='#927cb0';ctx.lineWidth=1;for(let yy=16;yy<top-25;yy+=30){ctx.beginPath();ctx.moveTo(o.x+4,yy);ctx.lineTo(o.x+44,yy);ctx.stroke();}for(let yy=bottom+40;yy<540;yy+=30){ctx.beginPath();ctx.moveTo(o.x+4,yy);ctx.lineTo(o.x+44,yy);ctx.stroke();}
      if(!o.ring){ctx.save();ctx.translate(o.x+24,o.center);ctx.scale(.75+Math.abs(Math.sin(elapsed*2))*.25,1);ctx.strokeStyle='#ffd56a';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#fff0b0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-1,-1,10,Math.PI,Math.PI*1.8);ctx.stroke();ctx.fillStyle='#fff5c9';ctx.fillRect(17,-18,3,3);ctx.restore();}
    }
    for(const p of particles){ctx.globalAlpha=Math.min(1,p.life*2);ctx.fillStyle='#f5c54b';ctx.fillRect(p.x,p.y,5,5);}ctx.globalAlpha=1;
    drawPlayer(ctx,player.x,started?player.y:player.y+Math.sin(elapsed*2.5)*7,started?Math.max(-.35,Math.min(.75,player.vy/650)):-.12,api.skin);
    if(!started){
      ctx.fillStyle='rgba(13,15,31,.78)';ctx.fillRect(315,230,380,104);ctx.strokeStyle='#8b73ad';ctx.strokeRect(315.5,230.5,380,104);ctx.textAlign='center';ctx.fillStyle='#ffe193';ctx.font='bold 25px system-ui';ctx.fillText('READY FOR TAKEOFF?',505,270);ctx.fillStyle='#ddd5e8';ctx.font='16px system-ui';ctx.fillText('Tap the court or press Space',505,304);
    }
    ctx.restore();
  }
  return {update,draw,action,destroy(){held.clear();obstacles.length=0;particles.length=0;}};
}

function drawPlayer(ctx,x,y,angle,skin){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(1.1,1.1);
  const jersey=skin==='miami'?'#d4464b':skin==='cavs'?'#7e2447':'#f6c74c';
  const trim=skin==='gold'||!skin?'#7a4fb0':'#edc36c';
  // A small, original arcade athlete, built from clean shapes for crisp scaling.
  ctx.fillStyle='#332031';ctx.fillRect(-13,-29,25,15);
  ctx.fillStyle='#ae7150';ctx.fillRect(-13,-24,26,24);ctx.fillRect(10,-19,6,8);
  ctx.fillStyle='#342330';ctx.fillRect(-13,-24,26,4);ctx.fillRect(-10,-6,22,8);ctx.fillRect(8,-11,5,10);
  ctx.fillStyle='#f3ddc1';ctx.fillRect(4,-17,5,4);ctx.fillStyle='#342330';ctx.fillRect(7,-17,2,4);
  ctx.fillStyle='#e5ba69';ctx.fillRect(-12,-26,26,4);
  ctx.fillStyle=jersey;ctx.beginPath();ctx.moveTo(-13,0);ctx.lineTo(12,0);ctx.lineTo(16,28);ctx.lineTo(-16,28);ctx.closePath();ctx.fill();
  ctx.fillStyle=trim;ctx.fillRect(-15,2,4,23);ctx.fillRect(10,2,4,23);ctx.fillRect(-14,24,28,5);
  ctx.fillStyle='#fff4d5';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('23',0,19);
  ctx.fillStyle='#b67d56';ctx.fillRect(-20,4,8,18);ctx.fillRect(12,2,15,8);
  ctx.fillStyle=trim;ctx.fillRect(-13,29,11,10);ctx.fillRect(3,29,11,10);
  ctx.fillStyle='#b67d56';ctx.fillRect(-12,38,8,7);ctx.fillRect(5,38,8,6);
  ctx.fillStyle='#eee8db';ctx.fillRect(-16,43,13,5);ctx.fillRect(5,42,16,5);
  ctx.fillStyle='#dd853e';ctx.beginPath();ctx.arc(28,4,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#6f402c';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(28,4,10,0,Math.PI*2);ctx.moveTo(18,4);ctx.lineTo(38,4);ctx.moveTo(28,-6);ctx.lineTo(28,14);ctx.stroke();
  ctx.restore();
}
