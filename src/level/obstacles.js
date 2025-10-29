import { clamp, rand } from '../core/utils.js';
import { PAL } from '../core/palette.js';

class CircleObstacle{
  constructor(x,y,r,opt){
    opt=opt||{};
    this.x=x; this.y=y; this.r=r;
    this.baseX=x; this.vx=0; this.vy=opt.vy||0;
    this.osc=opt.oscillateX||0; this.phase=Math.random()*Math.PI*2; this.speed=opt.speed||1;
    this.hazard=!!opt.hazard; this.big=!!opt.big;
    this.type=opt.kind|| (this.hazard?(this.big?'virusBig':'virusSmall'):'circle');
    this.damage = (opt.damage!=null)?opt.damage:(this.hazard?(this.big?90:50):0);
    this.color = opt.color || (this.hazard?(this.big?PAL.hazardBig:PAL.hazardSmall):'#182a57');
  }
  update(dt){ this.phase+=dt*this.speed; this.x=this.baseX+Math.sin(this.phase)*this.osc; this.y+=this.vy*dt; }
  getAABB(){ return {x0:this.x-this.r, y0:this.y-this.r, x1:this.x+this.r, y1:this.y+this.r}; }
  collideParticle(p){
    const dx=p.x-this.x, dy=p.y-this.y, d2=dx*dx+dy*dy, rr=(this.r+p.radius)*(this.r+p.radius);
    if(d2<rr){
      const d=Math.sqrt(Math.max(d2,1e-6)), nx=dx/d, ny=dy/d, overlap=(this.r+p.radius)-d;
      p.x+=nx*(overlap+0.9); p.y+=ny*(overlap+0.9);
      let vn=p.vx*nx+p.vy*ny, vtX=p.vx-vn*nx, vtY=p.vy-vn*ny;
      const rest=0.12; let newVn=Math.max(-vn*rest,32); vtX*=0.99; vtY*=0.99; p.vx=vtX+newVn*nx; p.vy=vtY+newVn*ny;
      return { hit:true, normal:{x:nx,y:ny}, point:{x:this.x+nx*this.r,y:this.y+ny*this.r}, hazard:this.hazard, big:this.big, damage:this.damage, obstacle:this, type:this.type };
    }
    return {hit:false};
  }
  render(ctx){
    ctx.fillStyle=this.color;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.strokeStyle=this.hazard?'#ffd0e0aa':'#a6b7ff55'; ctx.lineWidth=1.6; ctx.shadowBlur=6; ctx.shadowColor=this.hazard?PAL.hazardSmall:PAL.neonBlue; ctx.beginPath(); ctx.arc(this.x,this.y,this.r*1.02,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
}
class CellCluster{
  constructor(cx, cy, R, opt){
    opt=opt||{};
    this.type='cellCluster';
    this.hazard=false;

    this.cx=cx; this.cy=cy; this.R=R;

    this.spacing  = opt.spacing  ?? 18;
    this.kReturn  = opt.kReturn  ?? 18;
    this.kCouple  = opt.kCouple  ?? 40;
    this.visc     = opt.visc     ?? 3.5;

    this.popOverlap = opt.popOverlap ?? 0.22;
    this.popSpeed   = opt.popSpeed   ?? 120;
    this.popTime    = opt.popTime    ?? 0.06;

    // ▼ ещё мягче: общий коэффициент замедления
    this.slowFactor = 0.28;     // было 0.42

    this.cells=[];   // {x,y,vx,vy, rx,ry, r, hi, popped, offx,offy, contactT}
    this.nei=[]; this.popFX=[];
    this._build(); this._updateAABB();
  }

  _build(){
    const S=this.spacing, R=this.R-8;
    const rows = Math.ceil(this.R/S)+2;
    for(let row=-rows; row<=rows; row++){
      const y = this.cy + row*S*0.86;
      const shift = (row&1)? S*0.5 : 0;
      const cols = Math.ceil(this.R/S)+2;
      for(let col=-cols; col<=cols; col++){
        const x = this.cx + col*S + shift;
        const dx=x-this.cx, dy=y-this.cy;
        if(dx*dx+dy*dy <= R*R){
          const r = rand(6,10);
          this.cells.push({ x,y,vx:0,vy:0, rx:x,ry:y, r, hi:0, popped:false, offx:0, offy:0, contactT:0 });
        }
      }
    }
    const lim=(this.spacing*1.2)*(this.spacing*1.2);
    this.nei = new Array(this.cells.length);
    for(let i=0;i<this.cells.length;i++){
      const a=this.cells[i], arr=[];
      for(let j=0;j<this.cells.length;j++){
        if(i===j) continue;
        const b=this.cells[j]; const dx=b.rx-a.rx, dy=b.ry-a.ry;
        if(dx*dx+dy*dy <= lim) arr.push(j);
      }
      this.nei[i]=arr;
    }
  }

  _updateAABB(){ this.aabb={ x0:this.cx-this.R-20, x1:this.cx+this.R+20, y0:this.cy-this.R-20, y1:this.cy+this.R+20 }; }
  getAABB(){ return this.aabb; }

  _spawnPop(x,y,r){
    const fx={ t:0, x,y, R0:Math.max(6, r*0.6), R1:r*2.4, drops:[], bubs:[] };
    const nDrops = 14 + (Math.random()*10|0);
    for(let i=0;i<nDrops;i++){
      const ang=rand(0,Math.PI*2), sp=rand(160,380);
      fx.drops.push({ x,y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, r:rand(1.6,3.2), life:rand(0.45,0.9),
        color: (Math.random()<0.5? '#7bffd7' : '#45f0b8') });
    }
    const nB = 6 + (Math.random()*6|0);
    for(let i=0;i<nB;i++){
      fx.bubs.push({ x: x+rand(-r*0.4,r*0.4), y: y+rand(-r*0.4,r*0.4), vx: rand(-20,20), vy: rand(-40,-10), r: rand(1.2,2.0), life: rand(0.5,1.0) });
    }
    this.popFX.push(fx);
    if(window.Game && Game.fx) Game.fx.burst(x, y, '#a8ffd880', 8, 220);
  }
  _updatePopFX(dt){
    for(let i=0;i<this.popFX.length;i++){
      const f=this.popFX[i]; f.t+=dt;
      for(let j=0;j<f.drops.length;j++){
        const d=f.drops[j]; d.vy += 520*dt; d.vx*=(1-1.8*dt); d.vy*=(1-1.2*dt); d.x+=d.vx*dt; d.y+=d.vy*dt; d.life-=dt;
      }
      f.drops=f.drops.filter(d=>d.life>0);
      for(let j=0;j<f.bubs.length;j++){
        const b=f.bubs[j]; b.vy -= 60*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
      }
      f.bubs=f.bubs.filter(b=>b.life>0);
    }
    this.popFX = this.popFX.filter(f=> f.t < 0.75 || f.drops.length || f.bubs.length);
  }

  update(dt){
    for(const c of this.cells){ if(c.popped) continue; c.offx=c.x-c.rx; c.offy=c.y-c.ry; }
    for(let i=0;i<this.cells.length;i++){
      const c=this.cells[i]; if(c.popped) continue;
      c.vx += (-this.kReturn*c.offx) * dt;
      c.vy += (-this.kReturn*c.offy) * dt;
      const nlist=this.nei[i]; let sx=0, sy=0;
      for(let j=0;j<nlist.length;j++){ const nb=this.cells[nlist[j]]; if(nb.popped) continue; sx += nb.offx - c.offx; sy += nb.offy - c.offy; }
      c.vx += (this.kCouple*sx*0.2) * dt;
      c.vy += (this.kCouple*sy*0.2) * dt;
      c.vx *= (1 - 1.2*dt);
      c.vy *= (1 - 1.2*dt);
      c.x += c.vx*dt; c.y += c.vy*dt;
      const vmax=260; c.vx=clamp(c.vx,-vmax,vmax); c.vy=clamp(c.vy,-vmax,vmax);
      c.hi = Math.max(0, c.hi - dt*1.4);
      c.contactT = Math.max(0, c.contactT - dt*0.5);
    }
    this._updatePopFX(dt);
  }

  collideParticle(p){
    const r=p.radius;
    if(p.x+r<this.aabb.x0 || p.x-r>this.aabb.x1 || p.y+r<this.aabb.y0 || p.y-r>this.aabb.y1) return {hit:false};

    const dt = (window.Game && Game.dt) ? Game.dt : 1/60;
    const preVx = p.vx, preVy = p.vy;

    let hit=false, resistance=0, popCount=0;

    for(let i=0;i<this.cells.length;i++){
      const c=this.cells[i]; if(c.popped) continue;

      const dx=p.x - c.x, dy=p.y - c.y;
      const sumR = r + c.r;
      const d2 = dx*dx+dy*dy;

      const infl = Math.exp(-(d2)/((this.spacing*2.2)*(this.spacing*2.2)));
      resistance += infl;

      if(d2 < sumR*sumR){
        const d = Math.sqrt(Math.max(d2,1e-6));
        const nx=dx/d, ny=dy/d;
        const pen=(sumR - d);

        c.contactT += dt * (1 + Math.min(1, (pen/c.r)*2));

        const relVx=p.vx - c.vx, relVy=p.vy - c.vy;
        const vn = relVx*nx + relVy*ny;

        const overlapOK = (pen / c.r) >= this.popOverlap;
        const speedOK   = vn > this.popSpeed;
        const timeOK    = c.contactT >= this.popTime;

        if(overlapOK || speedOK || timeOK){
          c.popped=true; c.hi=1; c.contactT=0; popCount++;
          this._spawnPop(c.x, c.y, c.r);
          continue;
        }

        // минимальная коррекция (почти всё смещение у клетки)
        const shareP=0.05, shareC=0.95;
        p.x += nx*pen*shareP; p.y += ny*pen*shareP;
        c.x -= nx*pen*shareC; c.y -= ny*pen*shareC;

        // ещё слабее трение по касательной: 0.03
        const tx = -ny, ty = nx;
        const vt = (p.vx - c.vx)*tx + (p.vy - c.vy)*ty;
        const tF = 0.03;
        p.vx -= vt*tx*tF;  p.vy -= vt*ty*tF;
        c.vx += vt*tx*(tF*0.6); c.vy += vt*ty*(tF*0.6);

        c.hi = Math.min(1, c.hi + 0.7);
        const neigh=this.nei[i];
        for(let k=0;k<neigh.length;k++){ const nb=this.cells[neigh[k]]; if(nb && !nb.popped) nb.hi = Math.min(1, nb.hi + 0.2); }

        hit=true;
      }
    }

    // глобальная вязкость от плотности — мягче (кэп 0.30 и slowFactor 0.28)
    if(resistance>0){
      const viscK = this.visc * Math.min(1.6, resistance*0.18);
      const kRaw = clamp(viscK * dt, 0, 0.30);
      const k = kRaw * this.slowFactor;
      p.vx *= (1 - k); p.vy *= (1 - k);
      hit = true;
    }

    // торможение за «лопнувшие» клетки — слабее
    if(popCount>0){
      let popDrag = clamp(0.06*popCount, 0, 0.35);
      popDrag *= this.slowFactor;
      p.vx *= (1 - popDrag);
      p.vy *= (1 - popDrag);
    }

    // анти-подброс и мягкий лимит на рост скорости вниз (чтобы не «вязло»)
    const maxRise = 300 * dt;           // позволяем слегка набирать вниз
    p.vy = Math.min(p.vy, preVy + maxRise);
    p.vy = Math.max(0, p.vy);

    return {hit, hazard:false, type:'cellCluster'};
  }

  render(ctx){
    for(let i=0;i<this.cells.length;i++){
      const c=this.cells[i]; if(c.popped) continue;
      const base = 0.35 + 0.35*Math.sin((c.rx+c.ry)*0.02 + performance.now()*0.001);
      const a = clamp(base + c.hi*0.5, 0.2, 0.95);
      const g = ctx.createRadialGradient(c.x-1,c.y-1,1, c.x,c.y, c.r*1.45);
      g.addColorStop(0, `rgba(180,255,220,${0.55+0.30*c.hi})`);
      g.addColorStop(1, `rgba(70,150,120,${a})`);
      ctx.fillStyle=g;
      ctx.beginPath(); ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation='lighter';
      ctx.strokeStyle=`rgba(120,220,200,${0.25+0.5*c.hi})`;
      ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.arc(c.x,c.y,c.r*1.05,0,Math.PI*2); ctx.stroke();
      ctx.globalCompositeOperation='source-over';
    }

    // POP FX
    for(let i=0;i<this.popFX.length;i++){
      const f=this.popFX[i], t=clamp(f.t/0.75,0,1);
      const flash = ctx.createRadialGradient(f.x,f.y,0, f.x,f.y, f.R1*0.9);
      flash.addColorStop(0, `rgba(180,255,220,${0.42*(1-t)})`);
      flash.addColorStop(1, 'rgba(180,255,220,0)');
      ctx.globalCompositeOperation='lighter';
      ctx.fillStyle=flash; ctx.fillRect(f.x-f.R1, f.y-f.R1, f.R1*2, f.R1*2);

      const R = f.R0 + (f.R1 - f.R0)*Math.pow(t,0.8);
      ctx.lineWidth = 1.8*(1-t);
      ctx.strokeStyle = `rgba(160,255,230,${0.7*(1-t)})`;
      ctx.beginPath(); ctx.arc(f.x,f.y,R,0,Math.PI*2); ctx.stroke();

      for(let j=0;j<f.drops.length;j++){
        const d=f.drops[j]; const a=clamp(d.life/0.9,0,1);
        ctx.fillStyle = d.color + Math.floor(170*a).toString(16).padStart(2,'0');
        ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,Math.PI*2); ctx.fill();
      }
      ctx.globalCompositeOperation='source-over';
      for(let j=0;j<f.bubs.length;j++){
        const b=f.bubs[j]; const a=clamp(b.life/1.0,0,1)*0.8;
        ctx.strokeStyle=`rgba(220,255,245,${a})`; ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.stroke();
      }
    }
    ctx.globalCompositeOperation='source-over';
  }
}

export { CircleObstacle, CellCluster };
