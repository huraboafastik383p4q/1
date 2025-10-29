import { clamp } from '../core/utils.js';
class InputController{
  constructor(canvas){
    this.canvas=canvas; this.keyLeft=false; this.keyRight=false; this.touchLeft=false; this.touchRight=false;
    this.mouseX=null; this.tiltGamma=0; this.axis=0; this._rawAxis=0; this._fast=false;
    this.btnMotion=document.getElementById('btn-motion')||null;
    this.btnLeft=document.getElementById('btn-left')||null;
    this.btnRight=document.getElementById('btn-right')||null;
    this._bindKeyboard(); this._bindMouse(); this._bindTouchButtons(); this._setupMotion();
  }
  _computeRawAxis(){
    const keyAxis=(this.keyLeft?-1:0)+(this.keyRight?1:0);
    const touchAxis=(this.touchLeft?-1:0)+(this.touchRight?1:0);
    let mouseAxis=0; if(this.mouseX!==null){ const rect=this.canvas.getBoundingClientRect(), cx=rect.left+rect.width/2; mouseAxis=clamp((this.mouseX-cx)/(rect.width*0.35),-1,1); }
    const tiltAxis=clamp(this.tiltGamma/35,-1,1);
    const candidates=[keyAxis,touchAxis,mouseAxis,tiltAxis]; let best=0,mag=0; for(let i=0;i<candidates.length;i++){ const v=candidates[i]; if(Math.abs(v)>mag){mag=Math.abs(v);best=v;} }
    this._rawAxis=clamp(best,-1,1); this._fast=(Math.abs(keyAxis)>0||Math.abs(touchAxis)>0);
  }
  update(dt){
    this._computeRawAxis();
    const rate=this._fast?40:20, alpha=1-Math.exp(-dt*rate);
    this.axis += (this._rawAxis-this.axis)*alpha;
    if(Math.abs(this.axis)<0.02) this.axis=0;
    return this.axis;
  }
  _bindKeyboard(){ const on=(e,v)=>{ switch(e.code){ case'ArrowLeft':case'KeyA':this.keyLeft=v;break; case'ArrowRight':case'KeyD':this.keyRight=v;break; } };
    window.addEventListener('keydown',e=>on(e,true)); window.addEventListener('keyup',e=>on(e,false)); }
  _bindMouse(){ window.addEventListener('mousemove',e=>{ this.mouseX=e.clientX; },{passive:true}); window.addEventListener('mouseleave',()=>{ this.mouseX=null; },{passive:true}); }
  _bindTouchButtons(){
    if(!this.btnLeft||!this.btnRight) return;
    const set=(side,v,ev)=>{ ev.preventDefault(); if(side==='L')this.touchLeft=v; else this.touchRight=v; };
    const down=ev=>set(ev.currentTarget===this.btnLeft?'L':'R',true,ev);
    const up  =ev=>set(ev.currentTarget===this.btnLeft?'L':'R',false,ev);
    ['pointerdown'].forEach(ev=>{ this.btnLeft.addEventListener(ev,down); this.btnRight.addEventListener(ev,down); });
    ['pointerup','pointerout','pointercancel'].forEach(ev=>{ this.btnLeft.addEventListener(ev,up); this.btnRight.addEventListener(ev,up); });
  }
  async _setupMotion(){
    const needBtn=(typeof DeviceMotionEvent!=='undefined' && typeof DeviceMotionEvent.requestPermission==='function');
    if(needBtn && this.btnMotion){
      this.btnMotion.classList.remove('hidden');
      this.btnMotion.addEventListener('click', async ()=>{
        try{ const perm=await DeviceMotionEvent.requestPermission(); if(perm==='granted'){ this._enableOrientation(); this.btnMotion.classList.add('hidden'); } }catch(_){}
      },{once:true});
    } else { if(this.btnMotion) this.btnMotion.classList.add('hidden'); this._enableOrientation(); }
  }
  _enableOrientation(){
    window.addEventListener('deviceorientation', e=>{ if(typeof e.gamma==='number') this.tiltGamma=e.gamma; }, true);
    window.addEventListener('devicemotion', e=>{ const g=e.accelerationIncludingGravity; if(!g)return; this.tiltGamma=clamp((g.x||0)*6,-90,90); }, true);
  }
}
export { InputController };
