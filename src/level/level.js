import { clamp, lerp, rand } from '../core/utils.js';
import { CircleObstacle, CellCluster } from './obstacles.js';
import { EnergyItem, SpeedItem, ShieldItem, GrowItem } from '../items/items.js';

class Level{
  constructor(){ this.obstacles=[]; this.items=[]; this.nextY=0; this.segmentBase=360; this.lastHazardY=-Infinity; }
  reset(){ this.obstacles=[]; this.items=[]; this.nextY=0; this.lastHazardY=-Infinity; }

  generateUpTo(yMax, ctx){
    const W=ctx.W, pad=ctx.pad, difficulty=ctx.difficulty, safeRect=ctx.safeRect, introEase=ctx.introEase;
    const segment = lerp(this.segmentBase*1.08, this.segmentBase*0.92, difficulty);

    while(this.nextY < yMax){
      
      const y = this.nextY + rand(60, segment-60);

      // стартовая фаза: плавно вводим опасности
      const rate = Math.max(difficulty, introEase);
      const minGap = lerp(280, 160, rate);
      const wantHaz = Math.random() < lerp(0.10, 0.55, rate);

      if (wantHaz && y - this.lastHazardY > minGap){
        // вирусы — крупные по мере роста сложности
        const allowBig = rate > 0.55;
        if(allowBig && Math.random()<lerp(0.0,0.25,rate)){
          const cx=rand(pad+100,W-pad-100), r=rand(28,40), osc=rand(30,100);
          const big=new CircleObstacle(cx,y,r,{oscillateX:osc,speed:rand(0.6,1.2),hazard:true,kind:'virusBig',big:true});
          if(!Level._overlap(big.getAABB(), safeRect)) this.obstacles.push(big);
        }else{
          const count = (rate<0.25)?1: (Math.random()<0.6?2:3);
          for(let i=0;i<count;i++){
            const cx=rand(pad+40,W-pad-40), r=rand(14,20), osc=rand(20,80);
            const v=new CircleObstacle(cx,y+rand(-40,40),r,{oscillateX:osc,speed:rand(0.8,1.6),hazard:true,kind:'virusSmall',big:false});
            if(!Level._overlap(v.getAABB(), safeRect)) this.obstacles.push(v);
          }
        }
        this.lastHazardY=y;
      if (Math.random() < lerp(0.10, 0.22, rate)) {
          const R  = rand(90, 140) * lerp(0.9, 1.2, rate);
          const cx = rand(pad+R*0.6, W - pad - R*0.6);
          const cy = y + rand(-30, 30);

          const cluster = new CellCluster(cx, cy, R, {
            spacing : rand(16, 20),
            kReturn : lerp(12, 22, rate),
            kCouple : lerp(28, 60, rate),
            visc    : lerp(2.2, 5.0, rate)
          });

          // не спавним прямо в «зоне безопасности» вокруг игрока
          if (!Level._overlap(cluster.getAABB(), safeRect)) {
            this.obstacles.push(cluster);
          }
        }
      }

      // Бонусы: дорожки слева/справа + редкие баффы
      const laneA=rand(pad, W/2-30), laneB=rand(W/2+30, W-pad);
      if(Math.random()<lerp(0.55, 0.80, rate)) this.items.push(new EnergyItem(laneA, y+rand(-40,40)));
      if(Math.random()<lerp(0.55, 0.80, rate)) this.items.push(new EnergyItem(laneB, y+rand(-40,40)));
      const roll=Math.random();
      if(roll<lerp(0.07,0.12,rate)) this.items.push(new SpeedItem(rand(pad,W-pad), y+rand(-30,30)));
      else if(roll<lerp(0.14,0.18,rate)) this.items.push(new ShieldItem(rand(pad,W-pad), y+rand(-30,30)));
      else if(roll<lerp(0.20,0.24,rate)) this.items.push(new GrowItem(rand(pad,W-pad), y+rand(-30,30)));

      this.nextY += segment;
    }
  }

  static _overlap(a,b){ return !(a.x1<b.x0 || a.x0>b.x1 || a.y1<b.y0 || a.y0>b.y1); }

  update(dt){
    for(let i=0;i<this.obstacles.length;i++) this.obstacles[i].update(dt);
    for(let i=0;i<this.items.length;i++) this.items[i].update(dt);
    const minY=Game.camera.y-200;
    this.obstacles=this.obstacles.filter(o=>o.getAABB().y1>minY);
    this.items=this.items.filter(it=>!it.collected && it.getAABB().y1>minY);
  }

  collideBacterium(bac){
    const events=[];
    for(let oi=0;oi<this.obstacles.length;oi++){
      const o=this.obstacles[oi], aabb=o.getAABB(); if(aabb.x1<0||aabb.x0>Game.width) continue;
      for(let pi=0;pi<bac.all.length;pi++){
        const p=bac.all[pi];
        if(p.y+p.radius<aabb.y0||p.y-p.radius>aabb.y1) continue;
        const c=o.collideParticle ? o.collideParticle(p) : {hit:false};
        if(c.hit){ c.obstacle=o; c.particle=p; events.push(c); }
      }
    }
    return events;
  }

  removeObstacles(list){
    if(!list||!list.length) return; const set=new Set(list); this.obstacles=this.obstacles.filter(o=>!set.has(o));
  }
  checkItemPickups(bac){
    const picked=[];
    for(let i=0;i<this.items.length;i++){
      const it=this.items[i]; if(it.collected) continue; const a=it.getAABB();
      if(a.x1<0||a.x0>Game.width) continue;
      if(a.y1<Game.camera.y-50||a.y0>Game.camera.y+Game.height+50) continue;
      if(it.testPickup(bac)) picked.push(it);
    }
    return picked;
  }
  render(ctx){ for(let i=0;i<this.obstacles.length;i++) this.obstacles[i].render(ctx); for(let i=0;i<this.items.length;i++) this.items[i].render(ctx); }
}

export { Level };
