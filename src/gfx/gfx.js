import { clamp, rand } from '../core/utils.js';
import { PAL } from '../core/palette.js';

class Camera{
  constructor(){ this.y=0; this.shakeT=0; this.shakeAmp=0; this.flash=0; }
  follow(targetY,dt){ const screenTarget=targetY-Game.height*0.35; this.y=lerp(this.y,screenTarget,1-Math.exp(-dt*3)); if(this.shakeT>0)this.shakeT=Math.max(0,this.shakeT-dt); this.flash=Math.max(0,this.flash-dt*1.8); }
  triggerShake(amp,dur){ this.shakeAmp=Math.max(this.shakeAmp,amp||12); this.shakeT=Math.max(this.shakeT,dur||0.3); }
  triggerFlash(intensity){ this.flash=Math.max(this.flash,intensity||0.9); }
  getShakeOffset(){ if(this.shakeT<=0) return {x:0,y:0}; const t=(performance.now()%1000)/1000, s=this.shakeAmp*(this.shakeT); return { x:(Math.sin(t*40)*s)|0, y:(Math.cos(t*35)*s)|0 }; }
}
class FXSystem{
  constructor(){ this.particles=[]; this.rings=[]; }
  burst(x,y,color,count,spread){ count=count||18; spread=spread||180;
    for(let i=0;i<count;i++){ const a=rand(-spread,spread)*Math.PI/180, sp=rand(100,360);
      this.particles.push({ x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(0.35,0.6),r:rand(1,2.6),color:color });
    }
  }
  burstDirected(x,y,nx,ny,color,count){
    count=count||18; const base=Math.atan2(ny,nx);
    for(let i=0;i<count;i++){ const a = base + rand(-0.5,0.5); const sp=rand(180,420);
      this.particles.push({ x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:rand(0.25,0.6),r:rand(1.2,3.0),color:color });
    }
  }
  explodeJelly(cx,cy){
    const colors=['#7bffd7','#45f0b8','#24b98c','#ffffffaa'];
    for(let i=0;i<120;i++){
      const ang=rand(0,Math.PI*2), sp=rand(120,520);
      const col = colors[(Math.random()*colors.length)|0];
      this.particles.push({ x:cx, y:cy, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:rand(0.4,0.9), r:rand(1.2,3.5), color:col });
    }
    for(let i=0;i<18;i++){
      const ang=rand(0,Math.PI*2), sp=rand(180,380);
      this.particles.push({ x:cx, y:cy, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp, life:rand(0.6,1.0), r:rand(3.5,6.0), color:'#45f0b8' });
    }
  }
  // NEW: ударная волна-кольцо
  shockRing(x,y,{color='#ff6688', life=0.55, r0=14, r1=280, width=7}={}){
    this.rings.push({x,y,t:0,life,r0,r1,width,color});
  }

  update(dt){
    for(let i=0;i<this.particles.length;i++){
      const p=this.particles[i];
      p.vy+=600*dt; p.vx*=(1-1.5*dt); p.vy*=(1-0.8*dt);
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
    }
    this.particles=this.particles.filter(p=>p.life>0);

    for(let i=0;i<this.rings.length;i++){ this.rings[i].t+=dt; }
    this.rings=this.rings.filter(r=> r.t<r.life);
  }

  render(ctx){
    // particles
    for(let i=0;i<this.particles.length;i++){
      const p=this.particles[i]; ctx.globalAlpha=Math.max(0,p.life*1.6);
      ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;

    // rings
    for(let i=0;i<this.rings.length;i++){
      const r=this.rings[i]; const t=clamp(r.t/r.life,0,1);
      const R=r.r0+(r.r1-r.r0)*Math.pow(t,0.85); const a=(1-t)*0.9;
      ctx.save(); ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=a;
      ctx.lineWidth=Math.max(0.8, r.width*(1-t));
      ctx.strokeStyle=r.color; ctx.beginPath(); ctx.arc(r.x,r.y,R,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }
}
class DamageText{
  constructor(x,y,txt,color){ this.x=x; this.y=y; this.t=0; this.txt=txt; this.color=color||'#ff6a6a'; }
  update(dt){ this.t+=dt; }
  get alive(){ return this.t<0.9; }
  render(ctx, camY){
    const a = clamp(1 - this.t/0.9, 0, 1);
    const dy = -20*this.t - 10*Math.sin(this.t*6);
    ctx.globalAlpha = a;
    ctx.fillStyle=this.color;
    ctx.font = 'bold 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    ctx.fillText(this.txt, this.x, this.y - camY + dy);
    ctx.globalAlpha = 1;
  }
}
class Background{
  constructor(){ this.t=Math.random()*10; }
  render(ctx, camY){
    const g=ctx.createLinearGradient(0,0,0,Game.height); g.addColorStop(0,PAL.bgTop); g.addColorStop(1,PAL.bgBot);
    ctx.fillStyle=g; ctx.fillRect(0,0,Game.width,Game.height);

    // «liquid flow lines» — один слой
    const L={ alpha:0.14, width:3, amp1:14, amp2:9, freq1:0.018, freq2:0.042, speed:0.8, factor:0.28, color:'#57e7ff22' };
    ctx.save(); ctx.globalAlpha=L.alpha; ctx.strokeStyle=L.color; ctx.lineWidth=L.width; const t=(performance.now()*0.001*L.speed);
    const rows=9;
    for(let i=0;i<rows;i++){
      const baseY=((i/rows)*Game.height*2 - (camY*L.factor)%(Game.height*2)) - Game.height*0.2;
      ctx.beginPath();
      for(let x=-50;x<=Game.width+50;x+=20){
        const off=Math.sin((x*L.freq1)+(t*1.2)+i)*L.amp1 + Math.cos((x*L.freq2)-(t*0.9))*L.amp2;
        const yy=baseY+off; if(x===-50) ctx.moveTo(x,yy); else ctx.lineTo(x,yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}

export { Camera, FXSystem, DamageText, Background };
