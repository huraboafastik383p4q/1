import { clamp } from '../core/utils.js';
class FoodIconRenderer{
  constructor(canvas){
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') || null;
    this.t = 0;
    this.pulseT = 0;     // время пульса (сек)
    this.running = false;
    if(this.ctx){
      this._resize();
      addEventListener('resize', ()=>this._resize());
      this.start();
    }
  }
  _resize(){
    if(!this.canvas) return;
    const dpr = Math.max(1, devicePixelRatio || 1);
    const w = Math.max(1, this.canvas.clientWidth);
    const h = Math.max(1, this.canvas.clientHeight);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.scale(this.canvas.width/w, this.canvas.height/h);
  }
  start(){
    if(this.running || !this.ctx) return;
    this.running = true;
    const loop = (ts)=>{
      if(!this.running) return;
      this.update(1/60);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
  stop(){ this.running=false; }
  pulse(){ this.pulseT = 0.5; } // пульс ~0.5s при сборе

  update(dt){
    this.t += dt;
    if(this.pulseT>0) this.pulseT = Math.max(0, this.pulseT - dt);
  }

  render(){
    const ctx=this.ctx; if(!ctx) return;
    const w=this.canvas.clientWidth, h=this.canvas.clientHeight;
    ctx.clearRect(0,0,w,h);
    const cx=w/2, cy=h/2;

    // базовый радиус
    const baseR = Math.min(w,h)*0.45;

    // лёгкое дыхание + пульс по событию
    const idle = 1 + 0.05*Math.sin(this.t*4.0);
    const pulse = (this.pulseT>0) ? (1 + 0.35*Math.sin((1 - this.pulseT/0.5)*Math.PI)) : 1;
    const R = baseR * idle * pulse;

    // тело частицы — как в игре: белое ядро + бирюзовый градиент + исчезающий край
    const g = ctx.createRadialGradient(cx-0.5,cy-0.5,0, cx,cy,R);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#eaffff');
    g.addColorStop(0.66, '#7bffd7');
    g.addColorStop(1, 'rgba(36,185,140,0)');
    ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();

    // мягкое светящее кольцо
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    ctx.strokeStyle='rgba(160,255,240,0.85)';
    ctx.lineWidth=Math.max(1, R*0.2);
    ctx.beginPath(); ctx.arc(cx,cy,R*0.75,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}
export { FoodIconRenderer };
