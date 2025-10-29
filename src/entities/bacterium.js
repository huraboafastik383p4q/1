import { clamp, lerp, hypot, now } from '../core/utils.js';
import { PAL } from '../core/palette.js';
import { Particle, SlimeSpring } from '../physics/physics.js';
class Bacterium{
  constructor(x,y,opt){
    this.params = { elasticity:0.7, damping:0.4, mass:1.0, stiffness:0.3, plasticity:0.8 };
    Object.assign(this.params, opt?.params||{});

    const N = clamp(opt?.count??14, 12, 16);

    // ▼ ещё уменьшили габарит ~25–30% от 48x38 → 30x25
    const rx = opt?.rx ?? 30;
    const ry = opt?.ry ?? 25;

    // ▼ радиусы частиц тоже меньше
    this.center = new Particle(x,y,{mass:1.4*this.params.mass, radius:7});
    this.nodes=[];
    for(let i=0;i<N;i++){
      const t=i/N*Math.PI*2;
      this.nodes.push(new Particle(
        x + Math.cos(t)*rx,
        y + Math.sin(t)*ry,
        {mass:1*this.params.mass, radius:5.2}
      ));
    }
    this.all=[this.center, ...this.nodes];

    this.linearDamping = 0.1 + 0.6*this.params.damping;

    this.baseGravity=500; this.gravity=this.baseGravity;

    // управление остаётся отзывчивым (из предыдущего тюнинга)
    this.baseMaxVx=650;
    this.baseAccelRate=7800;
    this.maxVx=this.baseMaxVx;
    this.accelRate=this.baseAccelRate;
    this.controlForceLimit=12000;

    this.breathT=rand(0,100); this.breathAmp=0.035;
    this.shapeScale=1; this.shapeTarget=1;

    // --- пружины ---
    this.springs=[];
    const Nn=this.nodes.length, half=(Nn/2)|0;
    const stiff=this.params.stiffness;
    const K_RING = lerp(240,460,stiff);   // чуть выше, чтобы кольцо не рвалось
    const K_RAD  = lerp(280,520,stiff);
    const K_CROSS= lerp(180,380,stiff);
    const C=3.6;

    // кольцевые
    for(let i=0;i<Nn;i++){
      const a=this.nodes[i], b=this.nodes[(i+1)%Nn]; const rest=hypot(b.x-a.x,b.y-a.y);
      this.springs.push(new SlimeSpring(a,b,rest,{k:K_RING,c:C,plasticity:this.params.plasticity,elasticity:this.params.elasticity,shapeDamp:4.2,yield:rest*0.06}));
    }
    // радиальные
    for(let i=0;i<Nn;i++){
      const n=this.nodes[i]; const rest=hypot(n.x-x,n.y-y);
      this.springs.push(new SlimeSpring(this.center,n,rest,{k:K_RAD,c:C,plasticity:this.params.plasticity*0.55,elasticity:this.params.elasticity,shapeDamp:4.2,yield:rest*0.05}));
    }
    // противоположные
    for(let i=0;i<Nn;i++){
      const a=this.nodes[i], b=this.nodes[(i+half)%Nn]; const rest=hypot(b.x-a.x,b.y-a.y);
      this.springs.push(new SlimeSpring(a,b,rest,{k:K_CROSS,c:C,plasticity:this.params.plasticity*0.4,elasticity:this.params.elasticity,shapeDamp:3.8,yield:rest*0.04}));
    }
    // ▼ изгибные пружины (i ↔ i+2) — подавляют «переломы» и комкание
    const K_BEND = lerp(140,260,stiff);
    for(let i=0;i<Nn;i++){
      const a=this.nodes[i], b=this.nodes[(i+2)%Nn]; const rest=hypot(b.x-a.x,b.y-a.y);
      this.springs.push(new SlimeSpring(a,b,rest,{k:K_BEND,c:3.2,plasticity:this.params.plasticity*0.25,elasticity:0.85,shapeDamp:5.0,yield:rest*0.02}));
    }

    this.restArea=Math.abs(this._area()); this.pressureK=940; this.centerFollowK=44;

    this.hp=100; this.invuln=0; this.hurtT=0; this.phaseT=0; this.squashAmp=0; this.hurtShake=0;
  }

  _area(){ let s=0; const pts=this.nodes, n=pts.length; for(let i=0;i<n;i++){ const A=pts[i],B=pts[(i+1)%n]; s+=A.x*B.y - B.x*A.y; } return 0.5*Math.abs(s); }
  _centroid(){ let x=0,y=0; const n=this.nodes.length; for(let i=0;i<n;i++){ x+=this.nodes[i].x; y+=this.nodes[i].y; } return {x:x/n,y:y/n}; }

  takeDamage(intensity){ const k = clamp(intensity/100, 0, 1); this.hurtT=Math.max(this.hurtT,0.42+0.12*k); this.phaseT=Math.max(this.phaseT,0.22+0.12*k); this.squashAmp=Math.max(this.squashAmp,0.22+0.15*k); this.hurtShake=Math.max(this.hurtShake,3+6*k); }

  applyGlobalForces(){
    for(const p of this.all){
      p.addForce(0,this.gravity*p.mass);
      // чуть меньше «воздушный тормоз», чтобы чувствовалась лёгкость
      p.addForce(-0.26*p.vx,-0.26*p.vy);
    }
  }

  applyBuffs(o){
    o=o||{};
    const speedFactor=o.speedFactor??1, growScale=o.growScale??1;
    this.maxVx=this.baseMaxVx*speedFactor;
    this.accelRate=this.baseAccelRate*speedFactor;
    this.shapeTarget=growScale;
    for(const s of this.springs) s.setScale(this.shapeTarget);
  }

  applyControl(axis,dt){
    const desiredVx=this.maxVx*clamp(axis,-1,1);
    const dv=desiredVx-this.center.vx, maxDv=this.accelRate*dt;
    const appliedDv=clamp(dv,-maxDv,maxDv);
    const ax=appliedDv/Math.max(dt,1e-6);
    const fx=clamp(ax*this.center.mass,-this.controlForceLimit,this.controlForceLimit);
    this.center.addForce(fx,0);

    // мягкая волна по оболочке (визуально)
    const N=this.nodes.length, drive = 85*axis, t=now()*3.0;
    for(let i=0;i<N;i++){
      const n=this.nodes[i], prev=this.nodes[(i-1+N)%N], next=this.nodes[(i+1)%N];
      const tx=next.x-prev.x, ty=next.y-prev.y, L=hypot(tx,ty), ux=tx/L, uy=ty/L;
      const w = Math.sin((i/N)*Math.PI*2 + t)*0.5 + 0.5; const f=drive*(0.5+0.5*w);
      n.addForce(ux*f,uy*f);
    }
  }

  applyBreathAndRound(dt){
    this.breathT += dt; const b = 1 + this.breathAmp*Math.sin(this.breathT*2.2);
    const target = this.shapeTarget * b;
    this.shapeScale = lerp(this.shapeScale, target, 1 - Math.exp(-dt*3));
    for(const s of this.springs) s.setScale(this.shapeScale);

    const desiredArea=this.restArea*this.shapeScale*this.shapeScale;
    const area=Math.abs(this._area());
    if(isFinite(area)&&area>1e-3){
      const e=clamp((desiredArea-area)/desiredArea,-0.6,0.6);
      const c=this._centroid(), mag=this.pressureK*e;
      for(const n of this.nodes){
        const dx=n.x-c.x, dy=n.y-c.y, L=hypot(dx,dy), nx=dx/L, ny=dy/L;
        n.addForce(nx*mag,ny*mag);
      }
      const dx=c.x-this.center.x, dy=c.y-this.center.y;
      this.center.addForce(dx*this.centerFollowK, dy*this.centerFollowK);
    }
  }

  // ▼ стабилизация контура: сглаживание + радиальный контроль + подавление острых углов
  _stabilizeContour(dt){
    const pts=this.nodes, N=pts.length, c=this._centroid();
    let rsum=0; for(let i=0;i<N;i++){ const dx=pts[i].x-c.x, dy=pts[i].y-c.y; rsum+=Math.hypot(dx,dy); }
    const rAvg = rsum/N;

    const smoothK = 18;   // к соседним средним
    const radialK = 22;   // к допустимому радиусу
    const bendK   = 30;   // при слишком остром угле

    for(let i=0;i<N;i++){
      const n=pts[i], a=pts[(i-1+N)%N], b=pts[(i+1)%N];

      // сглаживание к середине соседей
      const mx=(a.x+b.x)*0.5, my=(a.y+b.y)*0.5;
      n.addForce((mx-n.x)*smoothK, (my-n.y)*smoothK);

      // радиальный контроль (не даём загибаться внутрь/наружу слишком резко)
      const dx=n.x-c.x, dy=n.y-c.y, L=Math.hypot(dx,dy)||1e-6;
      const desired = clamp(L, rAvg*0.80, rAvg*1.25);
      const corr = desired - L;
      n.addForce((dx/L)*corr*radialK, (dy/L)*corr*radialK);

      // подавление острых углов (если cos угла сильно отрицательный)
      const v1x=n.x-a.x, v1y=n.y-a.y, v2x=b.x-n.x, v2y=b.y-n.y;
      const l1=Math.hypot(v1x,v1y)||1e-6, l2=Math.hypot(v2x,v2y)||1e-6;
      const cos = (v1x*v2x+v1y*v2y)/(l1*l2);
      if(cos < -0.3){ n.addForce((mx-n.x)*bendK, (my-n.y)*bendK); }
    }
  }

  solveSprings(dt){ for(const s of this.springs) s.applyForces(dt); }
  integrate(dt){ for(const p of this.all) p.integrate(dt,this.linearDamping); }

  collideWalls(x0,x1){
    for(const p of this.all){
      if(p.x-p.radius<x0){ p.x=x0+p.radius+0.3; if(p.vx<0)p.vx=-p.vx*0.10; p.vy*=0.995; }
      else if(p.x+p.radius>x1){ p.x=x1-p.radius-0.3; if(p.vx>0)p.vx=-p.vx*0.10; p.vy*=0.995; }
    }
  }
  postLimitVelocity(){ this.center.vx=clamp(this.center.vx,-this.maxVx,this.maxVx); }

  step(dt,corridor,axis){
    const maxSub=1/120, steps=clamp(Math.ceil(dt/maxSub),1,8), h=dt/steps;
    for(let i=0;i<steps;i++){
      if(this.invuln>0) this.invuln=Math.max(0,this.invuln-h);
      this.applyGlobalForces();
      this.applyControl(axis,h);
      this.applyBreathAndRound(h);
      this.solveSprings(h);

      // ▼ стабилизация перед интеграцией — чтобы силы успели сработать
      this._stabilizeContour(h);

      this.integrate(h);
      this.collideWalls(corridor.x0,corridor.x1);
      this.postLimitVelocity();

      if(this.hurtT>0) this.hurtT=Math.max(0,this.hurtT-h);
      if(this.phaseT>0) this.phaseT=Math.max(0,this.phaseT-h);
      this.squashAmp = lerp(this.squashAmp, 0, 1 - Math.exp(-h*10));
      this.hurtShake = lerp(this.hurtShake, 0, 1 - Math.exp(-h*10));
    }
  }

  render(ctx,opt){
    opt=opt||{}; const shieldGlow=opt.shieldGlow?opt.shieldGlow:0, glowAmp=opt.glowAmp??1;
    const N=this.nodes.length; if(N<3)return; const cx=this.center.x, cy=this.center.y;
    let avgR=0; for(let i=0;i<N;i++){ const n=this.nodes[i]; avgR+=hypot(n.x-cx,n.y-cy); } avgR=(avgR/N)*1.05;
    const t = now(); const jA=this.hurtShake>0?this.hurtShake:0, jx=(Math.sin(t*80)+Math.sin(t*53))*0.5*jA, jy=(Math.cos(t*90)+Math.sin(t*47))*0.5*jA;
    const squash=this.squashAmp, sx=1+squash*0.18, sy=1-squash*0.18, phaseAlpha=this.phaseT>0?(1-0.45*clamp(this.phaseT/0.3,0,1)):1;
    const pts=this.nodes; const Nn=pts.length; const mid=(a,b)=>({x:(a.x+b.x)*0.5,y:(a.y+b.y)*0.5});
    ctx.save(); ctx.translate(cx+jx,cy+jy); ctx.scale(sx,sy); ctx.translate(-cx,-cy);

    const bodyPath=()=>{ ctx.beginPath(); const m0=mid(pts[Nn-1],pts[0]); ctx.moveTo(m0.x,m0.y); for(let i=0;i<Nn;i++){ const a=pts[i], b=pts[(i+1)%Nn], m=mid(a,b); ctx.quadraticCurveTo(a.x,a.y,m.x,m.y);} ctx.closePath(); };

    const body=ctx.createRadialGradient(cx,cy,avgR*0.1,cx,cy,Math.max(avgR,1));
    body.addColorStop(0,'#7bffd7b0'); body.addColorStop(0.5,'#45f0b890'); body.addColorStop(1,'#24b98c70');

    bodyPath();
    ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.shadowColor=PAL.neonCyan; ctx.shadowBlur=12*glowAmp; ctx.globalAlpha=phaseAlpha; ctx.fillStyle=body; ctx.fill(); ctx.restore();

    ctx.globalAlpha=phaseAlpha; ctx.fillStyle=body; ctx.fill();
    ctx.lineWidth=2; ctx.strokeStyle=PAL.neonCyanDim; ctx.stroke();

    if(this.hurtT>0){
      const blink=clamp(this.hurtT/0.42,0,1);
      ctx.save(); bodyPath(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle='rgba(255,40,60,'+(0.60*blink)+')'; ctx.fill(); ctx.restore();
    }

    if(shieldGlow>0){
      const sg=ctx.createRadialGradient(cx,cy,0,cx,cy,avgR*1.2);
      sg.addColorStop(0,'rgba(160,245,255,'+(0.16*shieldGlow)+')'); sg.addColorStop(1,'rgba(160,245,255,0)');
      ctx.save(); ctx.clip(); ctx.globalCompositeOperation='lighter'; ctx.fillStyle=sg; ctx.fillRect(cx-avgR*2,cy-avgR*2,avgR*4,avgR*4); ctx.restore();
    }

    const coreG=ctx.createRadialGradient(cx-2,cy-2,1,cx,cy,12*this.shapeScale);
    coreG.addColorStop(0,'#ffffffdd'); coreG.addColorStop(1,'#ffffff22');
    ctx.globalAlpha=phaseAlpha; ctx.fillStyle=coreG; ctx.beginPath(); ctx.arc(cx,cy,8*this.shapeScale,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#ffffff33'; ctx.lineWidth=1; ctx.stroke();

    ctx.restore();
  }
}

export { Bacterium };
