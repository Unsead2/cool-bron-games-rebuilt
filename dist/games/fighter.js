/** Deterministic fixed-step street-court fighter. No browser globals required. */
export const instructions = 'P1: A/D move · W jump · F punch · G kick · H/S block. P2: ←/→ move · ↑ jump · J punch · K kick · L/↓ block.';
export const ATTACKS = Object.freeze({
  punch: { duration: .34, startup: .075, end: .18, reach: 75, damage: 10, knockback: 17 },
  kick: { duration: .56, startup: .17, end: .31, reach: 105, damage: 17, knockback: 27 }
});
export function hitDamage(base, guarded) { return guarded ? Math.max(1, Math.round(base * .2)) : base; }
export function inAttackRange(attacker, defender, reach) {
  const dx = defender.x - attacker.x;
  return dx * attacker.facing >= 0 && Math.abs(dx) <= reach + 26 && Math.abs(attacker.y - defender.y) < 84;
}
const FLOOR = 486, LEFT = 64, RIGHT = 896;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function player(x, facing) { return { x, y: FLOOR, vy: 0, facing, hp: 100, guard: 100, attack: null, stun: 0, flash: 0, blocking: false, moving: false, combo: 0, comboTime: 0 }; }

export function createGame(api) {
  const versus = api.mode === 'versus';
  const difficulty = ({easy: .6, normal: 1, hard: 1.4})[api.difficulty] || 1;
  let a = player(290, 1), b = player(670, -1), round = 1, time = 70, score = 0, ended = false;
  let transition = 0, banner = '', cpuClock = .5, hudClock = 0, elapsed = 0, particles = [], hitText = [];
  const held = new Set();
  function hud() { api.updateHUD({ score, status: `${versus ? 'Local duel' : `Campaign · round ${round}/3`} · ${Math.ceil(time)}s` }); }
  function attack(p, type) {
    if (ended || transition || p.attack || p.stun > 0) return;
    p.blocking = false;
    p.attack = { type, t: 0, hit: false };
    api.sound?.('attack');
  }
  function jump(p) {
    if (p.y >= FLOOR && !p.stun && !p.attack && !transition && !ended) { p.vy = -590; p.blocking = false; api.sound?.('jump'); }
  }
  function trigger(name) {
    const p2 = name.startsWith('p2');
    if (p2 && !versus) return;
    const p = p2 ? b : a, n = p2 ? name.slice(2) : name;
    if (n === 'primary') attack(p, 'punch');
    if (n === 'secondary') attack(p, 'kick');
    if (n === 'up') jump(p);
  }
  function action(name, down) {
    if (down) { if (!held.has(name)) trigger(name); held.add(name); }
    else held.delete(name);
  }
  function controls(p, prefix, dt) {
    const block = held.has(prefix+'block') || held.has(prefix+'down');
    p.blocking = block && p.guard > 5 && !p.attack && p.stun <= 0 && p.y >= FLOOR;
    const dir = Number(held.has(prefix+'right')) - Number(held.has(prefix+'left'));
    p.moving = !!dir && !p.stun;
    if (p.stun <= 0) p.x += dir * (p.attack ? 80 : p.blocking ? 75 : 245) * dt;
  }
  function cpu(dt) {
    cpuClock -= dt;
    const distance = Math.abs(a.x - b.x);
    b.moving = false;
    b.blocking = !b.attack && !b.stun && b.y >= FLOOR && b.guard > 10 && !!a.attack && distance < 150 && a.attack.t > .035 / difficulty;
    if (!b.stun && !b.attack) {
      const dir = Math.sign(a.x - b.x);
      if (distance > 105) { b.x += dir * (135 + 45 * difficulty + round * 7) * dt; b.moving = true; }
      else if (distance < 69 && !b.blocking) { b.x -= dir * 80 * dt; b.moving = true; }
    }
    if (cpuClock <= 0 && !b.stun && !b.attack) {
      cpuClock = Math.max(.32, .9 / difficulty - round * .055);
      if (distance < 138 && !b.blocking) attack(b, Math.sin(elapsed * 2.3) > -.2 ? 'kick' : 'punch');
      else if (a.y < FLOOR - 75 && distance < 200) jump(b);
    }
  }
  function tickPlayer(p, dt) {
    p.x = clamp(p.x, LEFT, RIGHT);
    p.vy += 1500 * dt; p.y += p.vy * dt;
    if (p.y >= FLOOR) { p.y = FLOOR; p.vy = 0; }
    p.stun = Math.max(0, p.stun - dt); p.flash = Math.max(0, p.flash-dt);
    p.comboTime -= dt; if (p.comboTime <= 0) p.combo = 0;
    p.guard = clamp(p.guard + (p.blocking ? 3 : 18) * dt, 0, 100);
    if (p.attack) { p.attack.t += dt; if (p.attack.t > ATTACKS[p.attack.type].duration) p.attack = null; }
  }
  function strike(attacker, defender) {
    const move = attacker.attack;
    if (!move || move.hit) return;
    const spec = ATTACKS[move.type];
    if (move.t < spec.startup || move.t > spec.end || !inAttackRange(attacker, defender, spec.reach)) return;
    move.hit = true;
    const guarding = defender.blocking && defender.facing === -attacker.facing && defender.guard > 4;
    const damage = hitDamage(spec.damage, guarding);
    defender.hp = Math.max(0, defender.hp-damage);
    defender.stun = guarding ? .07 : .16;
    defender.flash = .16;
    defender.x = clamp(defender.x + attacker.facing * (guarding ? 6 : spec.knockback), LEFT, RIGHT);
    if (guarding) { defender.guard = Math.max(0, defender.guard-spec.damage*1.4); if (defender.guard < 5) defender.stun = .45; }
    else { attacker.combo++; attacker.comboTime = 1.1; }
    if (attacker === a) score += damage * 10 + Math.max(0, attacker.combo-1)*5;
    api.sound?.(guarding ? 'block' : 'hit');
    const x = (attacker.x + defender.x)/2, y = defender.y-85;
    hitText.push({x, y:y-35, text:guarding ? 'BLOCK' : attacker.combo > 1 ? `${attacker.combo} HIT` : String(damage), t:.65, color:guarding?'#b2a7ff':'#ffdd58'});
    for (let i=0; i<9; i++) particles.push({x,y,vx:Math.cos(i*1.9)*130,vy:Math.sin(i*1.9)*130,t:.3,color:guarding?'#b2a7ff':'#ffdd58'});
  }
  function result() {
    if (ended || transition) return;
    if (a.hp > 0 && b.hp > 0 && time > 0) return;
    const won = a.hp > b.hp, draw = a.hp === b.hp;
    if (won) score += 500 + Math.ceil(time)*5;
    if (won && !versus && round < 3) { transition = 2.2; banner = `ROUND ${round} WON`; api.sound?.('win'); }
    else {
      ended = true; banner = draw ? 'DRAW GAME' : won ? versus ? 'PLAYER 1 WINS' : 'COURT CHAMPION' : versus ? 'PLAYER 2 WINS' : 'KEEP HOOPING';
      hud(); api.finish({score, coins: Math.max(1,Math.floor(score/150)), message: `${banner}. ${draw ? 'An even match — run it back.' : won ? 'The court is yours.' : 'Mix up jumps, blocks and attacks. Try again!'}`});
    }
  }
  function update(dt) {
    if (ended) return;
    dt = clamp(dt, 0, .05); elapsed += dt;
    particles = particles.filter(p=> (p.t-=dt)>0); particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;});
    hitText = hitText.filter(p=>(p.t-=dt)>0); hitText.forEach(p=>p.y-=25*dt);
    if (transition) {
      transition -= dt;
      if (transition <= 0) { transition=0; round++; time=70; a=player(290,1); b=player(670,-1); banner=''; cpuClock=.65; held.clear(); hud(); }
      return;
    }
    time = Math.max(0,time-dt);
    if (!a.attack) a.facing = b.x >= a.x ? 1 : -1;
    if (!b.attack) b.facing = a.x >= b.x ? 1 : -1;
    controls(a,'',dt); if (versus) controls(b,'p2',dt); else cpu(dt);
    tickPlayer(a,dt); tickPlayer(b,dt);
    const gap = b.x-a.x;
    if (Math.abs(gap)<53 && Math.abs(a.y-b.y)<95) {
      const offset = (53-Math.abs(gap))/2, direction = gap >= 0 ? 1 : -1;
      a.x=clamp(a.x-offset*direction,LEFT,RIGHT); b.x=clamp(b.x+offset*direction,LEFT,RIGHT);
    }
    // Both strikes are resolved in the same tick, allowing fair trades.
    strike(a,b); strike(b,a); result();
    hudClock-=dt; if(hudClock<=0){hudClock=.2;hud();}
  }
  function draw(ctx,w=960,h=600) {
    ctx.save(); ctx.scale(w/960,h/600);
    court(ctx,elapsed);
    health(ctx,a,40,38,'PLAYER 1',false); health(ctx,b,590,38,versus?'PLAYER 2':`RIVAL ${round}`,true);
    ctx.fillStyle='#f5e9ff'; ctx.textAlign='center'; ctx.font='bold 32px system-ui'; ctx.fillText(String(Math.ceil(time)).padStart(2,'0'),480,62);
    ctx.font='bold 11px system-ui';ctx.fillStyle='#a79bb7';ctx.fillText(versus?'VS':'ROUND '+round+' / 3',480,81);
    fighter(ctx,a,api.skin === 'miami' ? '#e84d5d' : api.skin === 'cavs' ? '#962849' : '#7e4bea','#ffdb56',elapsed);
    fighter(ctx,b,round===2?'#1e8b82':round===3?'#f2b544':'#d94d60',round===3?'#472e66':'#f4e0c0',elapsed);
    particles.forEach(p=>{ctx.globalAlpha=p.t/.3;ctx.fillStyle=p.color;ctx.fillRect(p.x-3,p.y-3,6,6);}); ctx.globalAlpha=1;
    hitText.forEach(p=>{ctx.globalAlpha=Math.min(1,p.t*3);ctx.fillStyle=p.color;ctx.font='900 19px system-ui';ctx.textAlign='center';ctx.fillText(p.text,p.x,p.y);});ctx.globalAlpha=1;
    ctx.textAlign='center';ctx.font='600 12px system-ui';ctx.fillStyle='#a99aba';
    ctx.fillText(versus?'LOCAL DUEL · P1: A D W / F G H     P2: ← → ↑ / J K L':'MOVE · JUMP · MIX YOUR ATTACKS · HOLD BLOCK TO DEFEND',480,571);
    if (transition || ended) {ctx.fillStyle='#100b24c9';ctx.fillRect(180,220,600,125);ctx.fillStyle='#ffdc5c';ctx.font='900 38px system-ui';ctx.fillText(banner,480,281);ctx.fillStyle='#e0d6ed';ctx.font='16px system-ui';ctx.fillText(transition?'Next challenger approaching…':'Run it back from the game menu',480,317);}
    ctx.restore();
  }
  hud();
  return { update, draw, action, destroy(){held.clear();ended=true;}, getState(){return {round,time,score,ended,player1:{...a},player2:{...b}};} };
}

function court(c,t) {
  const sky=c.createLinearGradient(0,0,0,510);sky.addColorStop(0,'#101025');sky.addColorStop(.65,'#30213f');sky.addColorStop(1,'#512e46');c.fillStyle=sky;c.fillRect(0,0,960,600);
  c.fillStyle='#dec1ff'; c.beginPath();c.arc(775,138,28,0,Math.PI*2);c.fill();
  for(let i=0;i<14;i++) {const x=i*78-25, ht=65+(i*43)%125;c.fillStyle=i%2?'#19162d':'#211a35';c.fillRect(x,305-ht,65,ht+30);c.fillStyle='#61405a';for(let yy=320-ht;yy<290;yy+=24)for(let xx=x+10;xx<x+60;xx+=20)c.fillRect(xx,yy,7,10);}
  c.strokeStyle='#594263';c.lineWidth=1;c.globalAlpha=.4;for(let x=-260;x<1200;x+=28){c.beginPath();c.moveTo(x,303);c.lineTo(x+190,470);c.stroke();c.beginPath();c.moveTo(x+190,303);c.lineTo(x,470);c.stroke();}c.globalAlpha=1;
  c.fillStyle='#161327';c.fillRect(0,470,960,130);const floor=c.createLinearGradient(0,470,0,600);floor.addColorStop(0,'#483447');floor.addColorStop(1,'#251f33');c.fillStyle=floor;c.fillRect(0,470,960,130);
  c.strokeStyle='#b39169';c.lineWidth=2;c.beginPath();c.moveTo(0,487);c.lineTo(960,487);c.moveTo(480,487);c.lineTo(480,600);c.stroke();c.beginPath();c.ellipse(480,538,132,34,0,0,Math.PI*2);c.stroke();
  c.strokeStyle='#5d4655';for(let y=510;y<600;y+=27){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
  c.fillStyle='#3b304e';c.fillRect(91,202,9,269);c.fillRect(860,202,9,269);c.fillStyle='#b5afbf';c.fillRect(43,192,108,73);c.fillRect(810,192,108,73);c.strokeStyle='#77587d';c.lineWidth=5;c.strokeRect(76,217,43,34);c.strokeRect(842,217,43,34);c.strokeStyle='#f0a95d';c.lineWidth=5;c.beginPath();c.moveTo(76,255);c.lineTo(119,255);c.moveTo(842,255);c.lineTo(885,255);c.stroke();c.strokeStyle='#b2a3bb';c.lineWidth=1;for(let x=80;x<119;x+=9){c.beginPath();c.moveTo(x,258);c.lineTo(98+(x-98)*.6,292);c.stroke();}
  c.save();c.translate(480,191);c.fillStyle='#1c1633';c.fillRect(-164,-35,328,69);c.strokeStyle='#9d72d3';c.lineWidth=2;c.strokeRect(-164,-35,328,69);c.fillStyle='#ffdd67';c.font='900 27px system-ui';c.textAlign='center';c.fillText('THE KING’S COURT',0,2);c.fillStyle='#ad90c9';c.font='700 10px system-ui';c.fillText('AKRON  •  OHIO  •  EST. 1984',0,22);c.restore();
}
function health(c,p,x,y,label,reverse) {
  c.fillStyle='#0b0b1b';c.fillRect(x-3,y-3,336,29);c.fillStyle='#43364d';c.fillRect(x,y,330,23);c.fillStyle=p.hp>30?'#ffda55':'#fa6a73';const width=330*p.hp/100;c.fillRect(reverse?x+330-width:x,y,width,23);c.fillStyle='#b497e8';c.fillRect(x,y+31,330*p.guard/100,4);c.fillStyle='#efebf6';c.font='bold 12px system-ui';c.textAlign=reverse?'right':'left';c.fillText(label,reverse?x+330:x,y-12);c.font='bold 12px system-ui';c.textAlign='center';c.fillStyle='#201829';c.fillText(Math.ceil(p.hp)+' HP',x+165,y+16);
}
function fighter(c,p,jersey,trim,t) {
  c.save();c.translate(p.x,p.y);c.fillStyle='#0a081c70';c.beginPath();c.ellipse(0,FLOOR-p.y+5,42,10,0,0,Math.PI*2);c.fill();c.scale(p.facing,1);
  const bob=p.moving&&p.y>=FLOOR?Math.sin(t*18)*3:Math.sin(t*3)*1.3;
  c.translate(0,bob);const skin=p.flash>0?'#f3d2b0':'#9d6548', dark='#472f2e';
  const strike=p.attack, spec=strike&&ATTACKS[strike.type];const extension=strike?Math.sin(Math.min(1,strike.t/spec.end)*Math.PI):0;
  c.lineCap='round'; c.lineJoin='round';
  // Legs and sneakers.
  c.strokeStyle=skin;c.lineWidth=15;c.beginPath();c.moveTo(-13,-48);c.lineTo(-18,-23);c.lineTo(-22,0);c.stroke();
  c.beginPath();c.moveTo(12,-48);if(strike?.type==='kick'){c.lineTo(31+extension*24,-62);c.lineTo(29+extension*69,-71);}else{c.lineTo(19,-25);c.lineTo(25,0);}c.stroke();
  c.strokeStyle='#eee8f2';c.lineWidth=12;c.beginPath();c.moveTo(-26,-2);c.lineTo(-11,-2);c.stroke();c.beginPath();if(strike?.type==='kick'){c.moveTo(27+extension*69,-71);c.lineTo(42+extension*69,-70);}else{c.moveTo(20,-2);c.lineTo(36,-2);}c.stroke();
  // Shorts and jersey.
  c.fillStyle=jersey;c.beginPath();c.moveTo(-26,-74);c.lineTo(26,-74);c.lineTo(28,-43);c.lineTo(3,-42);c.lineTo(0,-54);c.lineTo(-3,-42);c.lineTo(-28,-43);c.closePath();c.fill();c.fillStyle=trim;c.fillRect(-27,-48,24,5);c.fillRect(3,-48,24,5);
  c.fillStyle=jersey;c.beginPath();c.moveTo(-23,-121);c.lineTo(23,-121);c.lineTo(27,-74);c.lineTo(-27,-74);c.closePath();c.fill();c.strokeStyle=trim;c.lineWidth=4;c.beginPath();c.moveTo(-23,-120);c.lineTo(-27,-77);c.moveTo(23,-120);c.lineTo(27,-77);c.stroke();
  c.fillStyle=trim;c.font='900 27px system-ui';c.textAlign='center';c.save();c.scale(p.facing,1);c.fillText('23',0,-85);c.restore();
  // Arms: a visible defensive pose and an extending punch.
  c.strokeStyle=skin;c.lineWidth=14;c.beginPath();c.moveTo(-24,-114);if(p.blocking){c.lineTo(-17,-136);c.lineTo(7,-143);}else{c.lineTo(-34,-94);c.lineTo(-16,-86);}c.stroke();c.beginPath();c.moveTo(24,-114);if(p.blocking){c.lineTo(38,-125);c.lineTo(33,-148);}else if(strike?.type==='punch'){c.lineTo(38+extension*18,-113);c.lineTo(43+extension*50,-119);}else{c.lineTo(39,-98);c.lineTo(48,-117);}c.stroke();
  c.fillStyle=skin;c.fillRect(-9,-137,18,19);c.beginPath();c.ellipse(0,-149,21,26,0,0,Math.PI*2);c.fill();
  c.fillStyle='#29212a';c.beginPath();c.ellipse(0,-163,21,13,0,Math.PI,Math.PI*2);c.lineTo(21,-154);c.lineTo(-20,-156);c.closePath();c.fill();c.fillStyle=dark;c.beginPath();c.moveTo(-19,-143);c.lineTo(-14,-127);c.lineTo(10,-123);c.lineTo(20,-139);c.lineTo(10,-134);c.lineTo(-8,-136);c.closePath();c.fill();
  c.fillStyle='#1c1622';c.fillRect(6,-153,6,3);c.fillStyle=trim;c.fillRect(-20,-163,41,4);
  if(p.blocking){c.strokeStyle='#b197edaa';c.lineWidth=3;c.beginPath();c.arc(22,-104,58,-1.2,1.2);c.stroke();}
  c.restore();
}
