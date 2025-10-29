import { rand } from '../core/utils.js';
import { PAL } from '../core/palette.js';

class Item{
  constructor(x,y,r,type,opt){ opt=opt||{}; this.x=x; this.y=y; this.r=r; this.type=type; this.color=opt.color||'#fff'; this.t=0; this.collected=false; }
  update(dt){ this.t+=dt; }
  getAABB(){ return {x0:this.x-this.r,y0:this.y-this.r,x1:this.x+this.r,y1:this.y+this.r}; }
  testPickup(bac){
    if(this.collected) return false;
    for(let i=0;i<bac.all.length;i++){ const p=bac.all[i], dx=p.x-this.x, dy=p.y-this.y; if(dx*dx+dy*dy< (this.r+p.radius)*(this.r+p.radius)){ this.collected=true; return true; } }
    return false;
  }
  render(ctx){
    const pul=1+Math.sin(this.t*6)*0.10;
    ctx.save(); ctx.translate(this.x,this.y); ctx.scale(pul,pul);
    ctx.globalCompositeOperation='lighter';
    const g=ctx.createRadialGradient(0,0,0, 0,0, this.r*2.2);
    g.addColorStop(0,this.color); g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(0,0,this.r*2.2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.9; ctx.fillStyle=this.color; ctx.beginPath(); ctx.arc(0,0,this.r,0,Math.PI*2); ctx.fill();
    ctx.restore(); ctx.globalAlpha=1; ctx.globalCompositeOperation='source-over';
  }
}
class EnergyItem extends Item{ constructor(x,y){ super(x,y,8,'energy',{color:PAL.itemEnergy}); } }
class SpeedItem  extends Item{ constructor(x,y){ super(x,y,10,'speed',{color:PAL.itemSpeed}); } }
class ShieldItem extends Item{ constructor(x,y){ super(x,y,10,'shield',{color:PAL.itemShield}); } }
class GrowItem   extends Item{ constructor(x,y){ super(x,y,10,'grow',{color:PAL.itemGrow}); } }

export { Item, EnergyItem, SpeedItem, ShieldItem, GrowItem };
