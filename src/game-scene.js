/** A continuously moving, perspective-projected ink drawing. No image assets or game engine. */
import { hash } from './engine.js';

export function createGameScene(canvas, scenario, { motion = true, calm = false, onReady } = {}) {
  const ctx = canvas.getContext('2d');
  let width = 0, height = 0, frame, last = performance.now(), time = 0, travel = 0;
  let decision = null, decisionTime = 0, finished = false;
  const depth = scenario.depth || 0;
  const decay = calm ? 0 : Math.min(.97, Math.max(0, (depth - 3) / 58));
  const seed = hash(scenario.seed);
  const pullLeft = hash(`${scenario.scenarioId}:order`) % 2 === 1;
  const left = pullLeft ? { label: scenario.sideLabel, count: scenario.sideCount, choice: 'pull' } : { label: scenario.mainLabel, count: scenario.mainCount, choice: 'stay' };
  const right = pullLeft ? { label: scenario.mainLabel, count: scenario.mainCount, choice: 'stay' } : { label: scenario.sideLabel, count: scenario.sideCount, choice: 'pull' };
  const palette = () => {
    const dark = Math.max(0, (decay - .43) / .57);
    const mix = (a,b)=>Math.round(a+(b-a)*dark);
    const rgb=[mix(250,17),mix(249,23),mix(243,23)];
    const channels=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
    const luminance=.2126*channels[0]+.7152*channels[1]+.0722*channels[2];
    const inkColor=luminance>.179?(dark>.35?'#000000':'#252a24'):'#ffffff';
    return { paper:`rgb(${rgb.join(',')})`, ink:inkColor, faint:`rgba(${mix(80,165)},${mix(94,196)},${mix(71,166)},.17)`, red: dark>.4?'#dd8a72':'#9b493a', green: dark>.4?'#b3b866':'#cfe77c', dark };
  };
  const p = palette();
  function resize() { const box=canvas.getBoundingClientRect();width=box.width;height=box.height;const dpr=Math.min(devicePixelRatio||1,2);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);if(!motion){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);} }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function noise(n){return Math.sin(n*127.1+seed*.001)*.5+Math.cos(n*71.3+seed*.0001)*.5;}
  function ink(points,{color=p.ink,weight=1.8,closed=false,fill=null,wobble=1}={}){
    if(points.length<2)return;
    ctx.beginPath();
    points.forEach(([x,y],i)=>{const nx=x+noise(i+x*.017)*wobble,ny=y+noise(i+y*.017+10)*wobble;if(i===0)ctx.moveTo(nx,ny);else ctx.lineTo(nx,ny);});
    if(closed)ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill();}
    ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.lineCap='round';ctx.lineJoin='round';ctx.stroke();
  }
  function ellipse(x,y,rx,ry,{color=p.ink,fill=null,weight=1.7,rotation=0}={}){
    ctx.beginPath();ctx.ellipse(x,y,rx,ry,rotation,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke();
  }
  function text(value,x,y,size=13,color=p.ink,align='center') {ctx.font=`${size}px "Comic Sans MS","Chalkboard SE",cursive`;ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(value,x,y);}
  function project(x,z){const s=1/(z+.8),horizon=height*.29;return{x:width/2+x*s*width*.66,y:horizon+s*height*1.62,s:s*Math.min(width,height)*.047};}
  function trackX(z,branch){return z<5?0:branch*Math.pow((z-5)/10,.77)*3.25;}
  function drawRails(branch){
    for(const side of [-.46,.46]){
      const pts=[];for(let z=.55;z<=48;z+=.38){const point=project(trackX(z,branch)+side,z);pts.push([point.x,point.y]);}
      ink(pts,{color:p.ink,weight:1.8,wobble:.6});
      ink(pts.map(([x,y])=>[x+1.8,y+1.6]),{color:p.faint,weight:.9,wobble:1.3});
    }
    for(let i=0;i<38;i++){
      let z=.8+((i*.94+travel*.42)%35.72);
      if(branch===1&&z<5)continue;
      const a=project(trackX(z,branch)-.68,z),b=project(trackX(z,branch)+.68,z);
      ink([[a.x,a.y],[b.x,b.y]],{color:p.ink,weight:Math.max(.7,2.7/(z*.23+1)),wobble:.8});
    }
  }
  function scribbleCloud(x,y,s,n){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=.36;
    const pts=[];for(let a=0;a<=Math.PI*2;a+=.15){const r=1+Math.sin(a*6+n)*.11;pts.push([Math.cos(a)*50*r,Math.sin(a)*15*r]);}
    ink(pts,{color:p.ink,weight:1.1,closed:true,wobble:1});
    if(decay>.62){ellipse(-14,0,5,6);ellipse(14,0,5,6);ink([[-5,8],[6,8]],{weight:1});}ctx.restore();
  }
  function person(x,y,s,index,{back=false,robot=false}={}){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    const wiggle=motion?Math.sin(time*2+index*3)*1.4:0;
    if(robot)ink([[-7,-43],[7,-43],[7,-30],[-7,-30]],{closed:true,fill:p.paper,weight:1.8});
    else ellipse(wiggle,-37,7.5,9,{fill:p.paper,rotation:.12});
    if(!back){ellipse(wiggle-2.5,-38,.7,1,{fill:p.ink});ellipse(wiggle+2.5,-38,.7,1,{fill:p.ink});ink([[wiggle-2,-32],[wiggle+2,-33]],{weight:.8});}
    ink([[wiggle,-28],[0,-9],[-7,0]],{weight:2.2});ink([[0,-9],[8,1]],{weight:2.2});
    const arm=index%3===0?-30:-16;
    ink([[-10,arm],[0,-23],[11,-18+wiggle]],{weight:1.9});
    if(index%5===0&&!back){ink([[-7,-45],[8,-47],[5,-50],[-4,-49]],{weight:1.3});}
    ctx.restore();
  }
  function item(x,y,s,index,kind){
    if(kind==='person'){person(x,y,s,index,{robot:scenario.id.includes('robot')});return;}
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);
    if(kind==='cup'){
      ink([[-8,-22],[8,-22],[7,-3],[-5,-2],[-8,-22]],{fill:p.paper,weight:1.7});
      ink([[8,-18],[14,-18],[15,-10],[8,-8]],{weight:1.5});
      ink([[-11,1],[11,1]],{weight:1.3});
      ink([[-3,-27],[-5,-33],[-2,-38]],{weight:1,color:p.faint});
      ink([[3,-28],[5,-34],[3,-40]],{weight:1,color:p.faint});
    }else if(kind==='parcel'){
      ink([[-10,-23],[9,-25],[11,-3],[-9,0]],{closed:true,fill:p.paper,weight:1.7});ink([[-1,-24],[0,-1]],{weight:1});ink([[-10,-14],[10,-16]],{weight:1});
    }else if(kind==='chair'){
      ink([[-8,-28],[6,-28],[7,-12],[-9,-11],[-8,-28]],{weight:1.7});ink([[-10,-10],[11,-10],[12,-6],[-10,-5],[-9,3]],{weight:1.5});ink([[10,-6],[10,4]],{weight:1.5});
    }else if(kind==='server'){
      ink([[-8,-38],[9,-38],[9,0],[-8,0]],{closed:true,fill:p.paper,weight:1.5});for(let i=0;i<4;i++)ink([[-5,-32+i*8],[6,-32+i*8]],{weight:1});
    }
    ctx.restore();
  }
  function targets(branch,group){
    const z=decision ? Math.max(7,14-(time-decisionTime)*1.5) : 14;
    const point=project(trackX(z,branch),z);
    const count=group.count==null?1:Math.min(group.count,5);
    const scale=Math.max(.5,Math.min(1.4,width/850))*(1+(14-z)*.04);
    const kind=scenario.id==='orientation-coffee'?'cup':scenario.id==='orientation-parcels'?'parcel':scenario.id==='beyond-empty'?'chair':/digital|server|compression/.test(scenario.id)?'server':'person';
    ctx.save();
    const hit=decision&&group.choice===decision;
    if(hit&&time-decisionTime>1.05)ctx.globalAlpha=Math.max(0,1-(time-decisionTime-1.05)/.8);
    for(let i=0;i<count;i++)item(point.x+(i-(count-1)/2)*22*scale,point.y-9+(i%2)*4,scale,i,kind);
    if(group.count===null)text('?',point.x,point.y-45*scale,26*scale);
    const label=group.label.length>23?group.label.replace('conscious ','').replace('people','lives'):group.label;
    text(label,point.x,point.y-66*scale,Math.max(12,14*scale),p.ink);
    // Human traces become scribbled inventory marks, gradually and without hiding the labels.
    if(decay>.36){ctx.globalAlpha=(decay-.36)*.5;for(let i=0;i<count;i++){const x=point.x+(i-(count-1)/2)*22*scale;ink([[x-10,point.y-50],[x+11,point.y+2]],{color:p.red,weight:.8});}}
    ctx.restore();
  }
  function server(x,y,s,i){
    ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=.2+decay*.4;
    const h=45+(i%4)*22;
    ink([[-17,0],[-17,-h],[13,-h-4],[22,-h],[22,0]],{weight:1.1,fill:p.paper});
    ink([[13,-h-4],[13,0]],{weight:.7});
    for(let j=8;j<h;j+=9){ink([[-12,-j],[8,-j]],{weight:.8});ellipse(4,-j-3,.7,.7,{fill:p.ink,weight:.3});}
    ctx.restore();
  }
  function drone(x,y,s,i){
    ctx.save();ctx.translate(x,y+(motion?Math.sin(time+i)*3:0));ctx.scale(s,s);ctx.globalAlpha=.2+decay*.5;
    ink([[-8,0],[0,-3],[8,0],[0,5]],{closed:true,fill:p.paper,weight:1.2});ink([[-5,1],[-19,-5],[-24,-5]],{weight:1.1});ink([[5,1],[19,-5],[24,-5]],{weight:1.1});
    ellipse(-20,-7,10,2,{weight:1});ellipse(20,-7,10,2,{weight:1});ellipse(0,1,1,1,{fill:p.red,color:p.red});
    if(decay>.66){ctx.globalAlpha=.035;ink([[0,6],[-30,90],[30,90]],{closed:true,fill:p.red,color:p.red,weight:.1});}ctx.restore();
  }
  function landscape(){
    const horizon=height*.29;
    const hill=[];for(let x=-20;x<=width+20;x+=12){const y=horizon+Math.sin(x/110+seed*.00001)*7+Math.sin(x/45)*2;hill.push([x,y]);}
    ink(hill,{color:p.faint,weight:1.2,wobble:.9});
    if(decay<.5)for(let i=0;i<3;i++)scribbleCloud(width*(.18+i*.31)+Math.sin(time*.035+i)*15,height*(.11+i%2*.025),.52+(i%2)*.18,i);
    const n=Math.floor(decay*34);
    for(let i=0;i<n;i++){const side=i%2?1:-1,z=9+(i*3.7)%34,x=side*(6+(i%5)*2.5),point=project(x,z);server(point.x,point.y,Math.min(1.5,point.s),i);}
    if(decay>.17)for(let i=0;i<Math.floor((decay-.17)*12);i++)drone(width*(.13+(i*.193)% .76),height*(.14+(i%3)*.035),.45+decay*.3,i);
    // Passing verge marks provide uninterrupted forward optic flow.
    for(let i=0;i<38;i++){
      const z=1.5+((i*2.13+travel*.42)%42),side=i%2?1:-1;
      const point=project(side*(1.2+(i%7)*.57),z),scale=Math.min(1.9,point.s);
      const nearFork=z>5&&Math.abs(side*(1.2+(i%7)*.57)-trackX(z,side))<1.2;if(nearFork)continue;
      ctx.save();ctx.globalAlpha=.23;
      if(decay<.4)ink([[point.x-3*scale,point.y],[point.x,point.y-7*scale],[point.x+2*scale,point.y]],{weight:.7,color:p.ink});
      else ink([[point.x-4*scale,point.y],[point.x-4*scale,point.y-6*scale],[point.x+3*scale,point.y-5*scale]],{weight:.8,color:p.ink});
      ctx.restore();
    }
    if(decay>.6){
      ctx.save();ctx.globalAlpha=(decay-.6)*.5;
      for(let i=0;i<7;i++){const x=width*(i/6);ink([[x,horizon],[width/2+(x-width/2)*1.25,height*.9]],{color:p.red,weight:.6,wobble:1.5});}
      ctx.restore();
    }
  }
  function trolley(){
    const bounce=motion?Math.sin(time*17)*.65+Math.sin(time*8)*.6:0;
    const scale=Math.min(1.25,Math.max(.72,width/970));
    const steer=decision?(decision===left.choice?-1:1)*Math.min(1,(time-decisionTime)/1.1):0;
    const x=width/2+steer*width*.115,y=height*.70+bounce;
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.rotate(steer*.08);
    // An awkward little vehicle, viewed from behind, going somewhere it should not.
    ellipse(0,35,56,8,{color:p.faint,fill:p.faint,weight:.3});
    ink([[-40,19],[-49,-55],[-36,-87],[34,-88],[47,-58],[39,19]],{fill:p.green,closed:true,weight:2.1,wobble:1.4});
    ink([[-49,-55],[47,-58]],{weight:1.7});ink([[-36,-87],[34,-88],[40,-78],[-41,-77]],{closed:true,fill:p.paper,weight:1.8});
    ink([[-35,-66],[32,-68],[34,-37],[-34,-36]],{closed:true,fill:p.paper,weight:1.7,wobble:1});
    ink([[0,-67],[-1,-36]],{weight:1.3});
    ink([[-37,-25],[37,-27]],{weight:1.2});
    ink([[-42,7],[-47,29],[-32,31],[-27,10]],{closed:true,fill:p.ink,weight:1.4});
    ink([[29,8],[32,31],[45,29],[41,6]],{closed:true,fill:p.ink,weight:1.4});
    ink([[-50,10],[50,8],[51,21],[-51,23]],{closed:true,fill:p.paper,weight:1.8});
    ellipse(-33,-14,4,3,{fill:decay>.4?p.red:p.paper,weight:1.1});ellipse(33,-15,4,3,{fill:decay>.4?p.red:p.paper,weight:1.1});
    text(depth>28?'KEEP GOING':'001',0,-13,9,p.ink);
    // The controller is deliberately visible: a body attached to the decisions.
    person(0,36,1.17,0,{back:true});
    ink([[-6,4],[-26,-6],[-29,-14]],{weight:2});ink([[7,7],[26,0],[31,-14]],{weight:2});
    ink([[-30,-16],[-30,10]],{weight:2});ink([[31,-16],[31,10]],{weight:2});
    if(decay>.45){ctx.globalAlpha=(decay-.45)*.5;ink([[-26,-6],[-53,-35],[-70,-45]],{color:p.red,weight:1});ink([[26,0],[59,-23],[74,-50]],{color:p.red,weight:1});ctx.globalAlpha=1;}
    ctx.restore();
    if(!decision&&depth<3){text(['you, apparently','still you','promotion pending'][depth],x+95*scale,y+28*scale,12,p.ink);ink([[x+59*scale,y+20*scale],[x+23*scale,y+21*scale]],{weight:.9,color:p.ink});}
  }
  function draw(now){
    const dt=Math.min(.05,(now-last)/1000);last=now;
    if(motion){time+=dt;travel-=dt*(1.4+decay*2.2);}
    else if(decision)time+=dt;
    ctx.clearRect(0,0,width,height);ctx.fillStyle=p.paper;ctx.fillRect(0,0,width,height);
    landscape();
    const sky=ctx.createLinearGradient(0,0,0,height*.29);
    sky.addColorStop(0,p.paper);sky.addColorStop(.58,p.paper);sky.addColorStop(1,p.paper.replace('rgb(','rgba(').replace(')',',0)'));
    ctx.fillStyle=sky;ctx.fillRect(0,0,width,height*.29);
    drawRails(-1);drawRails(1);targets(-1,left);targets(1,right);trolley();
    if(decay>.3&&motion){const interval=10+Math.floor(seed%9),phase=time%interval;if(phase<.16){ctx.save();ctx.globalAlpha=(decay-.3)*.08;ctx.fillStyle=p.ink;ctx.fillRect(0,height*.38,width,1+decay*5);ctx.restore();}}
    if(decision&&!finished&&time-decisionTime>(motion?2:0.08)){finished=true;onReady?.();}
    if(motion||(decision&&!finished))frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  return { choose(choice, done){decision=choice;decisionTime=time;onReady=done;if(!motion)frame=requestAnimationFrame(draw);}, destroy(){cancelAnimationFrame(frame);observer.disconnect();}, colors:p, left,right,decay };
}
