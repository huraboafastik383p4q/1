import { clamp, lerp, hypot } from '../core/utils.js';
class Particle{
  constructor(x,y,opt){
    opt=opt||{};
    this.x=x; this.y=y;
    this.vx=0; this.vy=0;
    this.fx=0; this.fy=0;
    this.mass = opt.mass!=null?opt.mass:1;
    this.invMass = this.mass>0 ? 1/this.mass : 0;
    this.baseRadius = opt.radius!=null?opt.radius:6;
    this.radius = this.baseRadius;
  }
  addForce(fx,fy){ this.fx+=fx; this.fy+=fy; }
  integrate(dt, linearDamping){
    const ax=this.fx*this.invMass, ay=this.fy*this.invMass;
    this.vx += ax*dt; this.vy += ay*dt;
    const damp = Math.max(0, 1 - (linearDamping||0)*dt);
    this.vx *= damp; this.vy *= damp;
    this.x  += this.vx*dt; this.y += this.vy*dt;
    this.fx=0; this.fy=0;
  }
}

class SlimeSpring{
  constructor(a,b,rest0,opt){
    opt=opt||{};
    this.a=a; this.b=b;
    this.rest0=rest0; this.rest=rest0; this.restVel=0;
    this.k=opt.k||300; this.c=opt.c||3;
    this.plasticity=opt.plasticity||0.8;
    this.elasticity=opt.elasticity||0.7;
    this.shapeDamp=opt.shapeDamp||4.0;
    this.yield=opt.yield!=null?opt.yield:rest0*0.06;
    this.scale=1;
  }
  setScale(s){ this.scale=s; }
  applyForces(dt){
    const dx=this.b.x-this.a.x, dy=this.b.y-this.a.y, dist=hypot(dx,dy);
    const nx=dx/dist, ny=dy/dist;
    const stretch=dist - this.rest*this.scale;

    let f = -this.k*stretch;
    const rvx=this.b.vx-this.a.vx, rvy=this.b.vy-this.a.vy;
    f += -this.c*(rvx*nx + rvy*ny);

    const fx=f*nx, fy=f*ny;
    this.a.addForce(-fx,-fy); this.b.addForce(fx,fy);

    // пластичность/восстановление
    const dev = dist - this.rest0*this.scale;
    const sign = dev>=0?1:-1;
    const amount = Math.max(0, Math.abs(dev) - this.yield);
    const flow = this.plasticity * amount * sign;
    const restore = - this.elasticity * (this.rest - this.rest0);

    this.restVel += (flow + restore - this.shapeDamp*this.restVel) * dt;
    this.rest += this.restVel * dt;

    const rMin = this.rest0*0.55, rMax=this.rest0*1.9;
    if(this.rest<rMin){ this.rest=rMin; this.restVel=0; }
    if(this.rest>rMax){ this.rest=rMax; this.restVel=0; }
  }
}

export { Particle, SlimeSpring };
