// Auto-generated from main.js
import { clamp, lerp } from './core/utils.js';
import { PAL } from './core/palette.js';
import { Bacterium } from './entities/bacterium.js';
import { InputController } from './input/input-controller.js';
import { Camera, FXSystem, DamageText, Background } from './gfx/gfx.js';
import { Level } from './level/level.js';
import { FoodIconRenderer } from './hud/food-icon.js';

const canvas = document.getElementById('game');
/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

// keep Game API exactly as in original:
const Game={
  canvas:canvas, ctx:ctx, dpr:1, width:0, height:0, lastTime:0, dt:0,
  bacterium:null, input:null,
  camera:new Camera(), fx:new FXSystem(), level:new Level(), bg:null,
  running:true,
  state:'playing',      // 'playing' | 'dying' | 'gameover'
  deathTimer:0,
  score:0, best:0, comboMult:1, comboTimer:0,
  distanceBaseY:0,
  buffs:{ speed:{t:0,d:4}, shield:{t:0,d:3}, grow:{t:0,d:5} },
  timeSinceStart:0,
  vignetteT:0,
  hpDisplay:100,
  energy: 0,            // 🔹 общее кол-во собранных белых частиц (еда)
  hpFlashT:0,
  dmgTexts:[],

  init(){
    this.resize();
    // ensure food chip exists
    (function ensureFoodChip(){
      if(!document.getElementById('foodchip')){
        const chip = document.createElement('div');
        chip.id='foodchip'; chip.className='hud-chip';
        chip.innerHTML = '<span class="icon">🍬</span><span id="foodcount">0</span>';
        document.body.appendChild(chip);
      }
    })();
    window.addEventListener('resize',()=>this.resize(),{passive:true});
    document.addEventListener('visibilitychange',()=>{ this.lastTime=performance.now(); });

    this.bg = new Background();
    this.bacterium=new Bacterium(this.width*0.5, this.height*0.2, {count:14, rx:30, ry:25});
    this.bacterium.center.vx=60;
    this.input=new InputController(this.canvas);

    this.level.reset();
    this.distanceBaseY=this.camera.y;
    this.updateHUD();

    this.best=Number(localStorage.getItem('mt_best')||0);
    const bestEl=document.getElementById('best'); if(bestEl) bestEl.textContent='BEST '+(this.best|0);

    const btn=document.getElementById('btn-restart'); if(btn) btn.addEventListener('click',()=>this.restart());

    this.lastTime=performance.now();
    requestAnimationFrame((t)=>this.loop(t));
  },

  restart(){
    this.energy = 0; 
    this.camera=new Camera(); this.fx=new FXSystem(); this.level=new Level(); this.bg=new Background();
    this.bacterium=new Bacterium(this.width*0.5,this.camera.y+this.height*0.2,{count:14,rx:30,ry:25});
    this.input=new InputController(this.canvas);
    const over=document.getElementById('gameover'); if(over) over.classList.add('hidden');
    this.running=true; this.state='playing'; this.deathTimer=0;
    this.score=0; this.comboMult=1; this.comboTimer=0; this.distanceBaseY=this.camera.y;
    this.buffs.speed.t=0; this.buffs.shield.t=0; this.buffs.grow.t=0; this.timeSinceStart=0;
    this.vignetteT=0; this.hpDisplay=100; this.hpFlashT=0; this.dmgTexts=[];
    this.updateScoreHUD();
    this.updateHUD();
  },

  loop(t){ this.dt=Math.min((t-this.lastTime)/1000,0.25); this.lastTime=t; this.update(this.dt); this.render(); if(this.running) requestAnimationFrame((nt)=>this.loop(nt)); },

  difficulty(){ return clamp(1 - Math.exp(-this.score/2500), 0, 1); },
  fallScale(){ const d=this.difficulty(); return clamp(0.55 + 0.35*d, 0.55, 0.90); },

  startDeath(){
    if(this.state!=='playing') return;
    this.state='dying';
    this.deathTimer = 1.05;
    const cx=this.bacterium.center.x, cy=this.bacterium.center.y;
    this.fx.explodeJelly(cx, cy);
    this.camera.triggerShake(18,0.6);
    this.camera.triggerFlash(1.0);
    this.vignetteT = 1;
  },

  update(dt){
    this.timeSinceStart += dt;

    if(this.state==='dying'){
      this.camera.follow(this.bacterium.center.y, dt);
      this.fx.update(dt);
      for(let i=0;i<this.dmgTexts.length;i++) this.dmgTexts[i].update(dt);
      this.dmgTexts = this.dmgTexts.filter(d=>d.alive);
      if(this.vignetteT>0) this.vignetteT=Math.max(0,this.vignetteT - dt*1.2);
      if(this.hpFlashT>0) this.hpFlashT=Math.max(0,this.hpFlashT - dt*1.5);
      this.hpDisplay = lerp(this.hpDisplay, 0, 1 - Math.exp(-dt*8));
      this.updateHUD();

      this.deathTimer -= dt;
      if(this.deathTimer<=0 && this.running){
        this.running=false; this.state='gameover'; this.onGameOver();
      }
      return;
    }

    // --------- playing -----------
    const axis=this.input.update(dt);
    this.buffs.speed.t=Math.max(0,this.buffs.speed.t-dt);
    this.buffs.shield.t=Math.max(0,this.buffs.shield.t-dt);
    this.buffs.grow.t=Math.max(0,this.buffs.grow.t-dt);

    this.bacterium.applyBuffs({ speedFactor:(this.buffs.speed.t>0?1.55:1), growScale:(this.buffs.grow.t>0?1.30:1) });
    this.bacterium.gravity=this.bacterium.baseGravity*this.fallScale();

    const corridor={x0:20, x1:this.width-20};
    this.bacterium.step(dt, corridor, axis);

    // camera
    this.camera.follow(this.bacterium.center.y, dt);

    // level
    this.level.update(dt);
    const introEase = clamp((this.timeSinceStart - 0.2)/3.0, 0, 1);
    const d=this.difficulty();
    const safeRect={ x0:this.bacterium.center.x-140, x1:this.bacterium.center.x+140, y0:this.bacterium.center.y-180, y1:this.bacterium.center.y+240 };
    this.level.generateUpTo(this.camera.y + this.height*3, { W:this.width, pad:40, difficulty:d, safeRect:safeRect, introEase:introEase });

    // collisions
    const events=this.level.collideBacterium(this.bacterium);

    const hits = new Map();
    for(let i=0;i<events.length;i++){
      const e=events[i];
      if(e.hazard){
        const prev=hits.get(e.obstacle);
        if(!prev || e.damage>prev.damage) hits.set(e.obstacle, e);
      }
    }

    const toRemove=[];
    if(hits.size){
      const it = hits.entries();
      for(let pair=it.next(); !pair.done; pair=it.next()){
        const info = pair.value[1];
        const dmg = info.damage|0;
        const popColor = info.big?'#ff7a94':'#ffd27a';

        if(this.buffs.shield.t>0){
          toRemove.push(info.obstacle);
          this.fx.burstDirected(info.point.x,info.point.y, info.normal.x,info.normal.y, popColor, info.big?26:18);
          this.camera.triggerShake(8,0.25);
          this._onDamageFX(0, info);
        } else if(this.bacterium.hp > dmg){
          const prevHP=this.bacterium.hp;
          this.bacterium.hp = clamp(this.bacterium.hp - dmg, 0, 100);
          this.bacterium.invuln = 0.35;
          toRemove.push(info.obstacle);
          this.fx.burstDirected(info.point.x,info.point.y, info.normal.x,info.normal.y, popColor, info.big?28:20);
          this.camera.triggerShake(info.big?14:10, 0.32);
          this._onDamageFX(prevHP - this.bacterium.hp, info);
        } else {
          const delta=this.bacterium.hp; this._onDamageFX(delta, info); this.bacterium.hp=0; this.startDeath();
        }
      }
    }
    if(toRemove.length) this.level.removeObstacles(toRemove);

    // подстраховка от застреваний повторной коллизией
    for(let i=0;i<1;i++) this.level.collideBacterium(this.bacterium);

    // items
    const picked=this.level.checkItemPickups(this.bacterium);
    for(let i=0;i<picked.length;i++) this.applyPickup(picked[i]);

    // fx & dmg texts
    this.fx.update(dt);
    for(let i=0;i<this.dmgTexts.length;i++) this.dmgTexts[i].update(dt);
    this.dmgTexts = this.dmgTexts.filter(d=>d.alive);
    

    // score by distance
    const dy=this.camera.y-this.distanceBaseY; if(dy>0){ const pts=dy*0.035; this.distanceBaseY=this.camera.y; this.addScore(pts); }

    // combo decay
    if(this.comboTimer>0){ this.comboTimer-=dt; if(this.comboTimer<=0) this.comboMult=1; }

    // vignette decay
    if(this.vignetteT>0) this.vignetteT=Math.max(0, this.vignetteT - dt*2.2);

    // HP display smoothing + flash decay
    const targetHP = this.bacterium.hp; const faster = (this.hpDisplay > targetHP); const k = faster ? 12 : 6;
    this.hpDisplay = lerp(this.hpDisplay, targetHP, 1 - Math.exp(-dt*k));
    if(this.hpFlashT>0) this.hpFlashT=Math.max(0,this.hpFlashT - dt*3);

    this.updateHUD();
  },

  _onDamageFX(deltaHP, info){
    const dmg = Math.max(0, Math.round(deltaHP));
    this.bacterium.takeDamage(dmg);

    // экран
    this.vignetteT = Math.min(1, this.vignetteT + 1.0);  // ярче
    this.hpFlashT  = Math.min(1, this.hpFlashT  + 1.0);

    // ударная волна + осколки в цвет вируса
    const x = info?.point?.x ?? this.bacterium.center.x;
    const y = info?.point?.y ?? this.bacterium.center.y;
    const color = info?.big ? PAL.hazardBig : PAL.hazardSmall;

    this.fx.shockRing(x,y,{color, life:0.6, r0:18, r1: info?.big?360:280, width: info?.big?9:7});
    this.fx.burst(x,y,color, info?.big?28:18, 260);

    // подписать -XX над центром (есть уже)
    if(dmg>0) this.dmgTexts.push(new DamageText(this.bacterium.center.x, this.bacterium.center.y - 10, '-'+dmg, '#ff5a5a'));
  },

  applyPickup(it){
    if (it.type === 'energy'){
      this.energy = (this.energy||0) + 1;     // +1 всегда, без влияния множителя
      this.addScore(10);                       // очки отдельно, с множителем
      this.bacterium.hp = clamp(this.bacterium.hp + 10, 0, 100);

      // вспышки/частицы (как у тебя было) ...
      if(this.fx) this.fx.burst(it.x,it.y,'#ffffff',14,200);

      // красивый "+1" над бактерией
      if(this.dmgTexts) this.dmgTexts.push(new DamageText(
        this.bacterium.center.x,
        this.bacterium.center.y - 14,
        '+1',
        '#b8ffe0' // нежный мятный
      ));

      // пульс иконки еды (только при сборе, не при любом росте очков)
      if(this.foodIcon) this.foodIcon.pulse();

      // чуть-чуть комбо
      this.bumpCombo?.(0.18, 3.2);

      this.updateHUD();
    }
    else if(it.type==='speed'){
      this.addScore(22);                               // ▼ было 50
      this.buffs.speed.t=this.buffs.speed.d;
      this.fx.burst(it.x,it.y,PAL.itemSpeed,18,230);
      this.bumpCombo(0.22, 3.6);
    }
    else if(it.type==='shield'){
      this.addScore(22);
      this.buffs.shield.t=this.buffs.shield.d;
      this.fx.burst(it.x,it.y,PAL.itemShield,18,230);
      this.camera.triggerFlash(0.7);
      this.bumpCombo(0.20, 3.6);
    }
    else if(it.type==='grow'){
      this.addScore(22);
      this.buffs.grow.t=this.buffs.grow.d;
      this.fx.burst(it.x,it.y,PAL.itemGrow,18,230);
      this.bumpCombo(0.20, 3.6);
    }

    // обновим HUD (в т.ч. счётчик еды)
    this.updateHUD();
  },

  addScore(base){ this.score += (base||0)*this.comboMult; this.updateScoreHUD(); },
  bumpCombo(amount=0.2, duration=3.5){
    this.comboMult = clamp(this.comboMult + amount, 1, 5);
    this.comboTimer = Math.max(this.comboTimer, duration);
  },


  onGameOver(){
    const over=document.getElementById('gameover'); if(over) over.classList.remove('hidden');
    const fs=document.getElementById('final-score'); if(fs) fs.textContent=''+(this.score|0);
    this.best=Math.max(this.best, this.score|0); localStorage.setItem('mt_best',''+(this.best|0));
    const fb=document.getElementById('final-best'); if(fb) fb.textContent=''+(this.best|0);
  },

  updateScoreHUD(){
    const sc=document.getElementById('score'); if(sc) sc.textContent=''+(this.score|0);
    const be=document.getElementById('best'); if(be) be.textContent='BEST '+(this.best|0);
  },
  updateHUD(){
    if(!this._hud){
      this._hud = {
        hpFill: document.getElementById('hpVialFill'),
        hpText: document.getElementById('hpVialText'),
        score:  document.getElementById('score'),
        multiText: document.getElementById('multitext'),
        multiFill: document.getElementById('multifill'),
        foodCount: document.getElementById('foodcount'),
      };
      // инициализируем канвас-иконку еды
      const fic = document.getElementById('foodIconCanvas');
      this.foodIcon = new FoodIconRenderer(fic);
    }

    // HP → колба (вертикальная)
    const hp = Math.round(clamp(this.bacterium?.hp ?? 100, 0, 100));
    if (this._hud.hpFill){
      const k = hp / 100;
      this._hud.hpFill.style.transform = `scaleY(${k})`;
      // цвет жидкости: зелёный → жёлтый → красный
      const hue = Math.round(140 * k); // 140=green, 0=red
      document.documentElement.style.setProperty('--hp-hue', hue);
      // лёгкая вспышка при уроне (если есть hpFlashT)
      if (this.hpFlashT && this.hpFlashT > 0){
        const a = Math.min(1, this.hpFlashT);
        this._hud.hpFill.style.filter = `drop-shadow(0 0 ${10+20*a}px rgba(255,60,80,${.25+.35*a}))`;
      } else {
        this._hud.hpFill.style.filter = '';
      }
    }
    if (this._hud.hpText) this._hud.hpText.textContent = hp + '%';

    // Счёт по центру
    if (this._hud.score){
      const s = Math.floor(this.score || 0).toLocaleString('ru-RU');
      this._hud.score.textContent = s;
    }

    // Мультипликатор — тонкая градация
    if (this._hud.multiText && this._hud.multiFill){
      const m = this.comboMult || 1;
      this._hud.multiText.textContent = 'x' + m.toFixed(1);
      const fill = (clamp(m,1,5) - 1) / 4; // 0..1
      this._hud.multiFill.style.width = (fill*100).toFixed(1) + '%';
    }

    // Еда
    if (this._hud.foodCount) this._hud.foodCount.textContent = '' + (this.energy || 0);
  },
  pulseFoodIcon(){
    const el = document.getElementById('foodIcon');
    if(!el) return;
    el.classList.remove('pulse'); // перезапуск анимации
    // рефлоу
    void el.offsetWidth;
    el.classList.add('pulse');
  },

  render(){
    this._clear();

    if(!this.bg) this.bg=new Background();
    this.bg.render(this.ctx, this.camera.y);

    const shake=this.camera.getShakeOffset();
    this.ctx.save(); this.ctx.translate(shake.x,shake.y); this.ctx.translate(0,-this.camera.y);

    // world
    this.level.render(this.ctx);

    if(this.state==='playing'){
      const shieldGlow=(this.buffs.shield.t>0)?1:0;
      this.bacterium.render(this.ctx,{shieldGlow:shieldGlow,glowAmp:1+(this.comboMult-1)*0.18});
    }

    // FX + damage popups
    this.fx.render(this.ctx);
    for(let i=0;i<this.dmgTexts.length;i++) this.dmgTexts[i].render(this.ctx, this.camera.y);

    this.ctx.restore();

    if(this.camera.flash>0){ this.ctx.fillStyle='rgba(255,255,255,'+(this.camera.flash*0.55)+')'; this.ctx.fillRect(0,0,this.width,this.height); }
    if(this.vignetteT>0){
      const a = 0.75 * this.vignetteT;
      const g = this.ctx.createRadialGradient(this.width/2, this.height/2, Math.min(this.width,this.height)*0.35, this.width/2, this.height/2, Math.max(this.width,this.height)*0.82);
      g.addColorStop(0,'rgba(0,0,0,0)');
      g.addColorStop(1,'rgba(255,30,50,'+a+')');
      this.ctx.fillStyle=g; this.ctx.fillRect(0,0,this.width,this.height);
    }

    this.ctx.fillStyle='#ffffff9a'; this.ctx.font='12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    this.ctx.fillText('Build 12.0 — viruses only | tunnels removed', 12, 20);
  },

  resize(){
    const w=window.innerWidth, h=window.innerHeight, dpr=Math.min(window.devicePixelRatio||1,2);
    this.dpr=dpr; this.canvas.width=Math.max(1,Math.floor(w*dpr)); this.canvas.height=Math.max(1,Math.floor(h*dpr));
    this.canvas.style.width=w+'px'; this.canvas.style.height=h+'px'; this.ctx.setTransform(dpr,0,0,dpr,0,0); this.width=w; this.height=h;
  },

  _clear(){ this.ctx.setTransform(1,0,0,1,0,0); this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height); this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0); }
};

// expose and start
window.Game = Game;
window.addEventListener('load', () => Game.init());
