/* ---------------------- Utils ---------------------- */
const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
const lerp  = (a,b,t)=> a + (b-a)*t;
const hypot = (x,y)=> Math.hypot(x,y) || 1e-6;
const rand  = (a,b)=> a + Math.random()*(b-a);
const now   = ()=> performance.now()*0.001;

// re-exports:
export { clamp, lerp, hypot, rand, now };
