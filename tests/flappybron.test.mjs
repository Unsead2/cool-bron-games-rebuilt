import test from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, circleRect, nextGap, createGame } from '../dist/games/flappybron.js';

test('circle collision checks closest point, not bounding box alone',()=>{
 assert.equal(circleRect(0,0,5,4,4,10,10),false);
 assert.equal(circleRect(0,0,6,4,4,10,10),true);
 assert.equal(circleRect(10,10,2,0,0,20,20),true);
 assert.equal(circleRect(0,0,5,5,0,20,20),false);
});
test('spawn gaps remain on screen and within reachable height changes',()=>{
 for(const cfg of Object.values(DIFFICULTIES)){
  let y=280;
  for(let i=0;i<100;i++){
   const next=nextGap(y,cfg.gap,()=>i%2?1:0);
   assert.ok(Math.abs(next-y)<=65);
   assert.ok(next-cfg.gap/2>=52);
   assert.ok(next+cfg.gap/2<=488);
   y=next;
  }
 }
});
test('idle does not kill player; input starts; loss fires once',()=>{
 let finishes=0, final;
 const game=createGame({difficulty:'normal',updateHUD(){},finish(v){finishes++;final=v;}});
 for(let i=0;i<1000;i++)game.update(1/60);
 assert.equal(finishes,0);
 game.action('primary',true);
 for(let i=0;i<1000;i++)game.update(1/60);
 assert.equal(finishes,1);
 assert.equal(final.score,0);
 assert.equal(final.coins,0);
 game.action('primary',false);game.action('primary',true);
 game.update(1/60);assert.equal(finishes,1);
});
test('holding flap does not repeatedly retrigger input',()=>{
 let flaps=0;
 const game=createGame({sound(name){if(name==='flap')flaps++;}});
 game.action('primary',true);game.action('primary',true);
 assert.equal(flaps,1);
 game.action('primary',false);game.action('primary',true);
 assert.equal(flaps,2);
 game.destroy();
});
