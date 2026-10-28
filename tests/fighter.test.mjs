import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../dist/games/fighter.js', import.meta.url), 'utf8');
const {createGame, inAttackRange, hitDamage} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function make(mode='versus'){const events=[];return {events, game:createGame({mode,difficulty:'normal',updateHUD(){},finish(x){events.push(x);},sound(){}})};}
const advance = (g,n) => {for(let i=0;i<n;i++)g.update(1/60)};
test('hits require reach, facing and vertical overlap',()=>{
 const a={x:100,y:486,facing:1};
 assert.equal(inAttackRange(a,{x:200,y:486},75),true);
 assert.equal(inAttackRange(a,{x:250,y:486},75),false);
 assert.equal(inAttackRange(a,{x:80,y:486},75),false);
 assert.equal(inAttackRange(a,{x:160,y:350},75),false);
 assert.equal(hitDamage(10,true),2);assert.equal(hitDamage(17,false),17);
});
test('walk, jump and landing stay inside court and prevent overlap',()=>{
 const {game}=make();game.action('left',true);advance(game,180);game.action('left',false);
 assert.equal(game.getState().player1.x,64);
 game.action('up',true);advance(game,10);assert.ok(game.getState().player1.y<486);
 game.action('up',false);advance(game,120);assert.equal(game.getState().player1.y,486);
 game.action('right',true);advance(game,240);game.action('right',false);
 const s=game.getState();assert.ok(s.player2.x-s.player1.x>=52.99);
});
test('a held strike resolves once and a complete duel reports once',()=>{
 const {game,events}=make();game.action('right',true);advance(game,75);game.action('right',false);
 game.action('secondary',true);advance(game,60);assert.equal(game.getState().player2.hp,83);
 advance(game,60);assert.equal(game.getState().player2.hp,83);
 game.action('secondary',false);
 for(let i=0;i<12&&!game.getState().ended;i++){
  game.action('right',true);advance(game,30);game.action('right',false);
  game.action('secondary',true);advance(game,40);game.action('secondary',false);
 }
 assert.equal(events.length,1);assert.ok(events[0].score>0);assert.match(events[0].message,/PLAYER 1 WINS/);
 advance(game,500);assert.equal(events.length,1);
});
test('timer resolves a drawn local duel once',()=>{
 const {game,events}=make();advance(game,4300);assert.equal(events.length,1);assert.match(events[0].message,/DRAW/);
});
test('CPU moves, attacks, and completes an unattended campaign attempt',()=>{
 const {game,events}=make('cpu');advance(game,4300);assert.equal(events.length,1);assert.equal(game.getState().ended,true);assert.ok(game.getState().player1.hp<100);
});
