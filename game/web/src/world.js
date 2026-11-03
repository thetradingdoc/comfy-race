import * as THREE from 'three';
// Illustrative landing-page scenery only. Never used for gameplay or physics.
const TAU=Math.PI*2;
const TRACK={radiusX:52,radiusZ:36,roadWidth:12};
const sampleTrack=t=>({x:52*Math.cos(t),z:36*Math.sin(t),heading:Math.atan2(-52*Math.sin(t),36*Math.cos(t))});
const CHECKPOINTS=[Math.PI/2,Math.PI,Math.PI*1.5,0].map(sampleTrack);

const themes = {
  nairobi: { sky: 0x111426, fog: 0x111624, neon: 0xff843d, accent: 0x4bccc6, label: 'NAIROBI  /  AFTER HOURS' },
  tokyo: { sky: 0x111025, fog: 0x16142a, neon: 0xff4597, accent: 0x53e9fa, label: 'TOKYO  /  NEON RELAY' },
  'new-york': { sky: 0x0e1525, fog: 0x111c2a, neon: 0xffb34e, accent: 0x88aaff, label: 'NEW YORK  /  NIGHT SHIFT' },
};
const mix = (a,b,t) => a + (b-a)*t;
const smoothAngle = (a,b,t) => a + Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
const random = (seed) => { const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n); };

export class RaceWorld {
  constructor(canvas) {
    this.canvas=canvas;this.mode='home';this.city='nairobi';this.players=[];this.models=new Map();this.quality='auto';this.time=0;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(themes.nairobi.sky);this.scene.fog=new THREE.FogExp2(themes.nairobi.fog,.009);
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setClearColor(themes.nairobi.sky);this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.35;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.2,700);
    this.camera.position.set(62,5.5,8);this.camera.lookAt(52,1,0);
    this.scene.add(new THREE.HemisphereLight(0x8b9bd4,0x28222b,2));
    const moon=new THREE.DirectionalLight(0xc2d1ff,3.2);moon.position.set(-45,70,25);moon.castShadow=true;
    moon.shadow.mapSize.set(2048,2048);Object.assign(moon.shadow.camera,{left:-90,right:90,top:90,bottom:-90,near:1,far:180});moon.shadow.normalBias=.04;this.scene.add(moon);
    const warm=new THREE.DirectionalLight(0xffb475,1.2);warm.position.set(70,12,-30);this.scene.add(warm);
    const envCanvas=document.createElement('canvas');envCanvas.width=1024;envCanvas.height=512;const env=envCanvas.getContext('2d');
    const envSky=env.createLinearGradient(0,0,0,512);envSky.addColorStop(0,'#253452');envSky.addColorStop(.48,'#151e2d');envSky.addColorStop(1,'#070b12');env.fillStyle=envSky;env.fillRect(0,0,1024,512);
    for(const [x,y,w,h,color]of [[130,130,270,48,'#c8def4'],[720,150,160,95,'#ffffff'],[340,255,200,18,'#ffbb91'],[15,235,80,110,'#8db8db']]){env.fillStyle=color;env.fillRect(x,y,w,h);}
    const envTexture=new THREE.CanvasTexture(envCanvas);envTexture.mapping=THREE.EquirectangularReflectionMapping;envTexture.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromEquirectangular(envTexture).texture;this.scene.environmentIntensity=.48;envTexture.dispose();pmrem.dispose();
    this.cityGroup=new THREE.Group();this.scene.add(this.cityGroup);this.accentMaterials=[];
    this.buildTrack();this.buildCity();
    this.heroCar=this.makeCar('#ff6838');this.heroCar.position.set(52,.08,-4);this.heroCar.rotation.y=0;this.scene.add(this.heroCar);
    this.heroLight=new THREE.PointLight(0xff682a,18,22,2);this.heroLight.position.set(55,2,-2);this.scene.add(this.heroLight);
    const keyLight=new THREE.SpotLight(0xe4efff,170,30,Math.PI/4,.75,2);keyLight.position.set(55,6,1);keyLight.target.position.set(52,.8,-4);this.scene.add(keyLight,keyLight.target);
    const rimLight=new THREE.PointLight(0x75c9ff,70,18,2);rimLight.position.set(48,2,-7);this.scene.add(rimLight);
    this.resize=()=>this.setSize();window.addEventListener('resize',this.resize);this.setSize();
    this.last=performance.now();this.running=true;this.frame=requestAnimationFrame(t=>this.animate(t));
  }
  material(color,roughness=.7,metalness=.1){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
  box(w,h,d,material,x=0,y=0,z=0,parent=this.scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  asphaltTexture(){
    const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#34383f';x.fillRect(0,0,256,256);
    for(let i=0;i<9000;i++){const r=random(i+1);x.fillStyle=`rgba(${r>.5?'150,157,170':'0,0,0'},${.02+r*.13})`;x.fillRect(random(i+5)*256,random(i+17)*256,1+random(i+100),1+random(i+90));}
    const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(14,14);tex.colorSpace=THREE.SRGBColorSpace;return tex;
  }
  ribbon(inner,outer,mat,segments=256,height=0){
    const vertices=[],uv=[],indices=[];
    for(let i=0;i<=segments;i++){const t=i/segments*TAU;const p=sampleTrack(t);const nx=Math.cos(p.heading),nz=-Math.sin(p.heading);for(const off of [inner,outer]){vertices.push(p.x+nx*off,height,p.z+nz*off);uv.push(i/segments*16,off);}}
    for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,mat);mesh.receiveShadow=true;this.scene.add(mesh);return mesh;
  }
  buildTrack(){
    const ground=this.material(0x111c22,1,0);this.box(700,.2,700,ground,0,-.25,0);
    this.ribbon(-8.6,8.6,this.material(0x4d4a4c,.9),256,-.05);
    const asphalt=new THREE.MeshStandardMaterial({color:0x969caa,map:this.asphaltTexture(),roughness:.37,metalness:.25,side:THREE.DoubleSide});this.ribbon(-6,6,asphalt,256,0);
    const line=new THREE.MeshStandardMaterial({color:0xb7bcc4,emissive:0x4e5260,emissiveIntensity:.18,roughness:.8});
    this.ribbon(-5.65,-5.5,line,256,.02);this.ribbon(5.5,5.65,line,256,.02);
    for(let i=0;i<76;i++){const t=i/76*TAU,p=sampleTrack(t);const m=this.box(.1,.025,1.7,line,p.x,.025,p.z);m.rotation.y=p.heading;}
    const curbRed=this.material(0x7a3534),curbLight=this.material(0x9ca2a7);
    for(let i=0;i<128;i++){const t=i/128*TAU,p=sampleTrack(t),nx=Math.cos(p.heading),nz=-Math.sin(p.heading);for(const side of [-1,1]){const m=this.box(.45,.13,1.9,i%2?curbRed:curbLight,p.x+nx*6.15*side,.04,p.z+nz*6.15*side);m.rotation.y=p.heading;}}
    const rail=this.material(0x485463,.4,.65);for(let i=0;i<80;i++){const t=i/80*TAU,p=sampleTrack(t),nx=Math.cos(p.heading),nz=-Math.sin(p.heading);for(const side of [-1,1]){if(i<2||i>78)continue;const m=this.box(.18,.42,3.3,rail,p.x+nx*8.2*side,.7,p.z+nz*8.2*side);m.rotation.y=p.heading;this.box(.13,.9,.13,rail,p.x+nx*8.2*side,.4,p.z+nz*8.2*side);}}
    const white=this.material(0xe6e4dc),black=this.material(0x171b24);for(let i=0;i<12;i++)for(let j=0;j<3;j++)this.box(1,.02,.7,(i+j)%2?white:black,46.5+i,.035,-.7+j*.7);
    for(const [i,p]of CHECKPOINTS.entries()){
      const gate=new THREE.Group();gate.position.set(p.x,0,p.z);gate.rotation.y=p.heading;
      const metal=this.material(0x1b252e,.4,.7),neon=new THREE.MeshStandardMaterial({color:0xff7b39,emissive:0xff5b19,emissiveIntensity:3});this.accentMaterials.push(neon);
      this.box(.28,5,.28,metal,-6.65,2.5,0,gate);this.box(.28,5,.28,metal,6.65,2.5,0,gate);this.box(13.6,.65,.35,metal,0,5,0,gate);
      this.box(.12,4.7,.12,neon,-6.65,2.5,-.12,gate);this.box(.12,4.7,.12,neon,6.65,2.5,-.12,gate);this.box(13.2,.07,.12,neon,0,5.3,-.22,gate);
      const sign=this.sign(i===3?'COMFY RACE  //  FINISH':`CHECKPOINT  0${i+1}`,10,.5,0xffffff,0x17202c);sign.position.set(0,5,-.2);sign.rotation.y=Math.PI;gate.add(sign);this.scene.add(gate);
    }
    const poleMat=this.material(0x283540,.5,.7),lampMat=new THREE.MeshBasicMaterial({color:0xffdba0});
    for(let i=0;i<24;i++){if(i===0)continue;const p=sampleTrack(i/24*TAU),nx=Math.cos(p.heading),nz=-Math.sin(p.heading);const g=new THREE.Group();g.position.set(p.x+nx*9.3,0,p.z+nz*9.3);g.rotation.y=p.heading;
      this.box(.14,7,.14,poleMat,0,3.5,0,g);this.box(2.5,.14,.14,poleMat,-1.1,7,0,g);this.box(.9,.1,.5,lampMat,-2.1,6.9,0,g);this.scene.add(g);
      if(i%3===0){const light=new THREE.PointLight(0xffbd7b,12,22,2);light.position.set(g.position.x-nx*2,6,g.position.z-nz*2);this.scene.add(light);}
    }
  }
  windowTexture(seed){
    const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d');x.fillStyle='#111720';x.fillRect(0,0,64,128);
    for(let i=0;i<8;i++)for(let j=0;j<18;j++){const r=random(seed+i*39+j);x.fillStyle=r>.66?'#eacba4':r>.43?'#627b97':'#192731';x.fillRect(i*8+2,j*7+2,3,3);}
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;tex.magFilter=THREE.NearestFilter;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
  }
  sign(text,width,height,color=0xffa664,bg=0x111821){
    const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle=`#${bg.toString(16).padStart(6,'0')}`;ctx.fillRect(0,0,c.width,c.height);ctx.font='bold 45px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=`#${color.toString(16).padStart(6,'0')}`;ctx.fillText(text,512,64);
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});return new THREE.Mesh(new THREE.PlaneGeometry(width,height),m);
  }
  buildCity(){
    const winTextures=Array.from({length:5},(_,i)=>this.windowTexture(i*33));
    for(let i=0;i<165;i++){
      let x=(random(i*7+1)-.5)*340,z=(random(i*7+2)-.5)*280;
      const q=Math.sqrt((x/52)**2+(z/36)**2);if(q>.65&&q<1.5)continue;if(q<.65&&(Math.abs(x)>29||Math.abs(z)>17))continue;
      const w=5+random(i+9)*11,d=5+random(i+3)*10,h=8+random(i+13)**2*55;
      const mat=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.59,.15,.22+random(i)*.1),map:winTextures[i%5],emissiveMap:winTextures[i%5],emissive:0x7f95ac,emissiveIntensity:.47,roughness:.8});
      this.box(w,h,d,mat,x,h/2-.1,z,this.cityGroup);
      const trim=this.material(0x1a242d,.4,.5);this.box(w+.4,.25,d+.4,trim,x,h+.05,z,this.cityGroup);this.box(w*.6,1,d*.4,trim,x,h+.5,z,this.cityGroup);
      if(i%7===0){const m=new THREE.MeshStandardMaterial({color:0xff8055,emissive:0xff7544,emissiveIntensity:2});this.accentMaterials.push(m);this.box(.12,h,.15,m,x+w/2+.1,h/2,z-d/2,this.cityGroup);}
    }
    const trunks=this.material(0x574034),leaves=this.material(0x1e4038);
    for(let i=0;i<24;i++){
      const p=sampleTrack((i+.3)/24*TAU),nx=Math.cos(p.heading),nz=-Math.sin(p.heading),x=p.x+nx*11.5,z=p.z+nz*11.5;
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.14,.23,5,5),trunks);trunk.position.set(x,2.5,z);trunk.castShadow=true;this.cityGroup.add(trunk);
      for(let j=0;j<5;j++){const leaf=new THREE.Mesh(new THREE.ConeGeometry(.8,3.6,4),leaves);leaf.position.set(x+Math.cos(j/5*TAU)*1.1,5.1,z+Math.sin(j/5*TAU)*1.1);leaf.rotation.z=Math.PI/2.8;leaf.rotation.y=-j/5*TAU;this.cityGroup.add(leaf);}
    }
    const sign=this.sign(themes.nairobi.label,20,2.5);sign.position.set(73,9,9);sign.rotation.y=-Math.PI/2;this.cityGroup.add(sign);this.citySign=sign;
    const horizon=this.sign('COMFY RACE  /  THE CITY IS YOURS',26,2.2,0x9cb8cb,0x101721);horizon.position.set(-8,16,-56);this.cityGroup.add(horizon);
    const stars=new THREE.BufferGeometry(),pts=[];for(let i=0;i<500;i++){const a=random(i*2)*TAU,r=180+random(i*4)*100;pts.push(Math.cos(a)*r,55+random(i*3)*150,Math.sin(a)*r);}stars.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));this.scene.add(new THREE.Points(stars,new THREE.PointsMaterial({color:0xd9e6ff,size:.3,transparent:true,opacity:.5})));
  }
  makeCar(color){
    // Original procedural coupe. This is landing artwork, never the Matrix vehicle.
    const car=new THREE.Group();
    const paint=new THREE.MeshPhysicalMaterial({color,metalness:.52,roughness:.22,clearcoat:1,clearcoatRoughness:.075,envMapIntensity:1.8});
    const carbon=this.material(0x090c12,.4,.38),trim=this.material(0x20242b,.24,.82);
    const glass=new THREE.MeshPhysicalMaterial({color:0x111f2c,metalness:.4,roughness:.075,clearcoat:1,envMapIntensity:1.6,side:THREE.DoubleSide});
    const add=(geometry,material=paint)=>{const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;car.add(m);return m;};
    const quad=(points,material)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return add(g,material);};
    const line=(points,radius,material)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),Math.max(8,points.length*8),radius,6,false),material);
    // Cross sections create a tapered nose, sculpted shoulders and wide rear haunches.
    const profile=[[-2.61,.91,.36,.75,.80],[-2.40,1.11,.33,.95,.91],[-1.60,1.23,.34,1.14,1.01],[-.90,1.16,.32,1.04,1.02],[0,1.10,.31,.99,.98],[.78,1.14,.32,1.02,.94],[1.57,1.23,.34,1.13,.91],[2.12,1.16,.32,.85,.80],[2.60,.94,.35,.63,.67]];
    const ringCount=95,ringSize=10,positions=[],indices=[];
    for(let i=0;i<ringCount;i++){
      const z=-2.61+i/(ringCount-1)*5.21;let a=profile[0],b=profile[1];for(let j=0;j<profile.length-1;j++)if(z>=profile[j][0]){a=profile[j];b=profile[j+1];}
      const t=Math.max(0,Math.min(1,(z-a[0])/(b[0]-a[0]))),w=mix(a[1],b[1],t),lo=mix(a[2],b[2],t),shoulder=mix(a[3],b[3],t),top=mix(a[4],b[4],t);
      let arch=lo;for(const wheelZ of [-1.58,1.58]){const dz=z-wheelZ;if(Math.abs(dz)<.60)arch=Math.max(arch,.49+Math.sqrt(.60*.60-dz*dz));}
      const xy=[[0,lo],[w*.96,arch],[w,Math.max(shoulder-.06,arch+.018)],[w*.91,Math.max(shoulder,arch+.03)],[w*.65,top],[0,top+.024],[-w*.65,top],[-w*.91,Math.max(shoulder,arch+.03)],[-w,Math.max(shoulder-.06,arch+.018)],[-w*.96,arch]];
      for(const [x,y]of xy)positions.push(x,y,z);
      if(i<ringCount-1)for(let j=0;j<ringSize;j++){const a=i*ringSize+j,b=i*ringSize+(j+1)%ringSize,c=(i+1)*ringSize+j,d=(i+1)*ringSize+(j+1)%ringSize;indices.push(a,b,c,b,d,c);}
    }
    for(const [offset,flip]of [[0,true],[(ringCount-1)*ringSize,false]])for(let j=1;j<ringSize-1;j++)indices.push(offset,offset+(flip?j+1:j),offset+(flip?j:j+1));
    const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.setIndex(indices);shell.computeVertexNormals();add(shell);
    // Sloped windscreen and fastback rear glass, with tapered side windows.
    quad([[-.91,1.00,.79],[.91,1.00,.79],[.71,1.51,-.10],[-.71,1.51,-.10]],glass);
    quad([[-.72,1.51,-.90],[.72,1.51,-.90],[.98,1.01,-1.80],[-.98,1.01,-1.80]],glass);
    for(const side of [-1,1]){
      quad([[side*.97,1.005,.72],[side*.72,1.51,-.12],[side*.73,1.51,-.91],[side*1.01,1.02,-1.74]],glass);
      line([[side*.94,1.01,.79],[side*.75,1.44,.02],[side*.71,1.54,-.12]],.035,paint);
      line([[side*.98,1.02,-1.78],[side*.79,1.45,-1.02],[side*.73,1.54,-.90]],.043,paint);
      line([[side*.98,1.00,.77],[side*1.035,1.01,-.65],[side*1.015,1.02,-1.76]],.025,trim);
      line([[side*.75,1.51,-.48],[side*.98,1.01,-.52]],.025,carbon);
      // Door cut line, recessed handle, side intake and low side skirt.
      line([[side*1.12,.96,.72],[side*1.105,.48,.69],[side*1.14,.39,-.89],[side*1.17,.95,-1.02]],.007,carbon);
      this.box(.035,.035,.21,trim,side*1.13,.89,-.65,car);
      quad([[side*1.17,.69,-.94],[side*1.21,.85,-1.10],[side*1.22,.78,-1.38],[side*1.17,.48,-1.03]],carbon);
      this.box(.14,.10,2.80,carbon,side*1.12,.29,0,car);
      // Mirrors have short stalks and rounded housings instead of a square cabin.
      line([[side*.98,1.06,.52],[side*1.23,1.06,.45]],.025,carbon);
      const mirror=add(new THREE.SphereGeometry(.17,16,8),paint);mirror.scale.set(1.2,.46,.75);mirror.position.set(side*1.25,1.08,.45);
      const mirrorGlass=add(new THREE.SphereGeometry(.16,12,6),glass);mirrorGlass.scale.set(.11,.4,.7);mirrorGlass.position.set(side*1.42,1.08,.45);
    }
    // A gently crowned roof catches a continuous strip of environment reflection.
    const roofPos=[],roofIdx=[];for(let z=0;z<=12;z++)for(let x=0;x<=16;x++){const u=x/16*2-1,v=z/12;roofPos.push(u*(.71+Math.sin(v*Math.PI)*.015),1.535+Math.cos(u*Math.PI/2)*.045,-.10-v*.82);if(x<16&&z<12){const a=z*17+x;roofIdx.push(a,a+17,a+1,a+1,a+17,a+18);}}
    const roof=new THREE.BufferGeometry();roof.setAttribute('position',new THREE.Float32BufferAttribute(roofPos,3));roof.setIndex(roofIdx);roof.computeVertexNormals();add(roof);
    // Panel seams and twin hood vents follow the sculpture of the front clip.
    for(const side of [-1,1]){
      line([[side*.72,.997,.81],[side*.67,.91,1.43],[side*.61,.775,2.16]],.008,carbon);
      const vent=this.box(.13,.014,.62,carbon,side*.78,.974,1.21,car);vent.rotation.x=.13;vent.rotation.z=side*-.12;
      for(let n=0;n<3;n++)this.box(.15,.018,.026,trim,side*.78,.991,1.0+n*.16,car);
    }
    // Black headlight pockets, thin LED blades, projector lenses and front intakes.
    const led=new THREE.MeshBasicMaterial({color:0xd9f4ff}),red=new THREE.MeshBasicMaterial({color:0xff2a28});
    for(const side of [-1,1]){
      quad([[side*.43,.58,2.612],[side*.98,.61,2.48],[side*1.04,.78,2.32],[side*.48,.77,2.48]],carbon);
      line([[side*.45,.719,2.548],[side*.81,.731,2.45],[side*.99,.729,2.36]],.024,led);
      line([[side*.46,.714,2.55],[side*.48,.62,2.58]],.014,led);
      const projector=add(new THREE.SphereGeometry(.065,12,8),led);projector.position.set(side*.82,.65,2.48);projector.scale.z=.45;
      const intake=this.box(.32,.19,.045,carbon,side*.90,.46,2.49,car);intake.rotation.y=side*-.25;
      line([[side*.20,.804,-2.61],[side*.74,.827,-2.54],[side*1.01,.86,-2.39]],.025,red);
    }
    this.box(.78,.15,.035,carbon,0,.43,2.62,car);for(let i=0;i<8;i++)this.box(.014,.13,.04,trim,-.33+i*.095,.43,2.646,car);
    this.box(2.23,.055,.31,carbon,0,.275,2.43,car);this.box(2.17,.085,.38,carbon,0,.29,-2.42,car);
    for(let i=0;i<5;i++)this.box(.035,.19,.46,carbon,-.68+i*.34,.29,-2.41,car);
    for(const side of [-1,1]){const exhaust=add(new THREE.CylinderGeometry(.086,.086,.22,16),trim);exhaust.rotation.x=Math.PI/2;exhaust.position.set(side*.74,.35,-2.61);const bore=add(new THREE.CircleGeometry(.066,16),carbon);bore.position.set(side*.74,.35,-2.73);bore.rotation.y=Math.PI;}
    // Low rear wing with an airfoil profile and two narrow supports.
    for(const side of [-1,1])this.box(.06,.25,.12,carbon,side*.76,1.055,-2.13,car);
    const wingShape=new THREE.Shape();wingShape.moveTo(-.22,0);wingShape.quadraticCurveTo(.05,.07,.28,.015);wingShape.lineTo(.27,-.035);wingShape.lineTo(-.22,-.04);wingShape.closePath();
    const wing=add(new THREE.ExtrudeGeometry(wingShape,{depth:2.45,bevelEnabled:false}),carbon);wing.rotation.y=Math.PI/2;wing.position.set(-1.225,1.20,-2.17);
    for(const side of [-1,1])this.box(.025,.16,.44,carbon,side*1.22,1.20,-2.16,car);
    // Fully modeled rubber, machined rims, twin spokes, discs and contrasting calipers.
    const rubber=this.material(0x101217,.86,.03),alloy=this.material(0x8e9aa8,.20,.95),disc=this.material(0x5c6670,.42,.87),caliper=this.material(0xffb438,.34,.28);
    for(const side of [-1,1])for(const z of [-1.58,1.58]){
      const tire=add(new THREE.TorusGeometry(.385,.125,12,40),rubber);tire.rotation.y=Math.PI/2;tire.position.set(side*1.12,.49,z);tire.scale.z=1.15;
      const discMesh=add(new THREE.CylinderGeometry(.31,.31,.022,32),disc);discMesh.rotation.z=Math.PI/2;discMesh.position.set(side*1.235,.49,z);
      const outer=add(new THREE.TorusGeometry(.355,.023,8,40),alloy);outer.rotation.y=Math.PI/2;outer.position.set(side*1.285,.49,z);
      const rimBarrel=add(new THREE.CylinderGeometry(.36,.36,.20,32,1,true),trim);rimBarrel.rotation.z=Math.PI/2;rimBarrel.position.set(side*1.18,.49,z);
      for(let j=0;j<5;j++)for(const offset of [-.065,.065]){const angle=j/5*TAU+offset;const spoke=this.box(.035,.031,.335,alloy,side*1.294,.49+Math.sin(angle)*.19,z+Math.cos(angle)*.19,car);spoke.rotation.x=-angle;}
      const hub=add(new THREE.CylinderGeometry(.09,.09,.045,16),alloy);hub.rotation.z=Math.PI/2;hub.position.set(side*1.31,.49,z);
      this.box(.05,.19,.11,caliper,side*1.255,.55,z+.23,car);
      for(let j=0;j<12;j++){const t=j/12*TAU;const hole=add(new THREE.CircleGeometry(.012,6),carbon);hole.rotation.y=side*Math.PI/2;hole.position.set(side*1.25,.49+Math.sin(t)*.25,z+Math.cos(t)*.25);}
      const arch=[];for(let i=0;i<=20;i++){const t=i/20*Math.PI;arch.push([side*1.23,.49+Math.sin(t)*.606,z+Math.cos(t)*.606]);}line(arch,.018,paint);
    }
    const under=add(new THREE.PlaneGeometry(2.2,4.8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.09,depthWrite:false}));under.rotation.x=-Math.PI/2;under.position.y=.035;
    const shadowCanvas=document.createElement('canvas');shadowCanvas.width=128;shadowCanvas.height=256;const shadowCtx=shadowCanvas.getContext('2d');const gradient=shadowCtx.createRadialGradient(64,128,12,64,128,116);gradient.addColorStop(0,'#000000b0');gradient.addColorStop(1,'#00000000');shadowCtx.fillStyle=gradient;shadowCtx.fillRect(0,0,128,256);
    const contact=add(new THREE.PlaneGeometry(3.6,6.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(shadowCanvas),transparent:true,depthWrite:false}));contact.rotation.x=-Math.PI/2;contact.position.y=.021;
    car.userData.paint=paint;car.userData.under=under;return car;
  }
  setColor(color){this.heroCar.userData.paint.color.set(color);this.heroCar.userData.under.material.color.set(color);}
  setCity(city){
    if(!themes[city])city='nairobi';if(this.city===city)return;this.city=city;const th=themes[city];this.scene.background.set(th.sky);this.scene.fog.color.set(th.fog);
    this.heroLight.color.set(th.neon);for(const mat of this.accentMaterials){mat.color.set(th.neon);mat.emissive.set(th.neon);}
    const sign=this.sign(th.label,20,2.5,th.neon);sign.position.copy(this.citySign.position);sign.rotation.copy(this.citySign.rotation);this.cityGroup.remove(this.citySign);this.citySign.geometry.dispose();this.citySign.material.map.dispose();this.citySign.material.dispose();this.citySign=sign;this.cityGroup.add(sign);
  }
  setMode(){this.heroCar.visible=true;}
  setQuality(quality){this.quality=quality;this.setSize();return {width:this.canvas.width,height:this.canvas.height};}
  setSize(){
    this.width=innerWidth;this.height=innerHeight;const maxTexture=this.renderer.capabilities.maxTextureSize;
    const target=this.quality==='4k'?3840/innerWidth:this.quality==='1080p'?1920/innerWidth:Math.min(devicePixelRatio||1,innerWidth<760?1.25:1.5);
    const pixelBudget=this.quality==='4k'?8_294_400:4_147_200;
    const ratio=Math.min(target,Math.sqrt(pixelBudget/(this.width*this.height)),maxTexture/Math.max(this.width,this.height),2.5);
    this.renderer.setPixelRatio(Math.max(.6,ratio));this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();
  }
  animate(now){
    if(!this.running)return;this.frame=requestAnimationFrame(t=>this.animate(t));const dt=Math.min((now-this.last)/1000,.05);this.last=now;this.time+=dt;
    if(document.hidden||this.canvas.hidden)return;
    const w=this.width,h=this.height;this.renderer.setScissorTest(false);this.renderer.setViewport(0,0,w,h);this.renderer.clear();
    {
      this.camera.clearViewOffset();this.camera.aspect=w/h;this.camera.fov=45;this.camera.updateProjectionMatrix();
      const sway=Math.sin(this.time*.11)*.8;this.camera.position.set(59.2+sway*.5,2.65,4.8);this.camera.lookAt(52,.84,-4);
      if(w>=760)this.camera.setViewOffset(w,h,-w*.19,0,w,h);else this.camera.setViewOffset(w,h,0,-h*.18,w,h);
      this.renderer.render(this.scene,this.camera);
    }
  }
  dispose(){this.running=false;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.resize);this.renderer.dispose();}
}
