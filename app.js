import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
const $=id=>document.getElementById(id), video=$('video'), stage=$('viewport');
async function init(){
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(38,1,.01,150);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.autoRotateSpeed=.8;controls.minDistance=2;controls.maxDistance=35;
const root=new THREE.Group();scene.add(root);
const width=1.8,height=3.2;
const loader=new THREE.TextureLoader();async function load(url){const t=await loader.loadAsync(url);t.colorSpace=THREE.SRGBColorSpace;return t;}
await new Promise((resolve,reject)=>{if(video.readyState>=2)return resolve();video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error('Could not load the local video.')),{once:true});});
const duration=video.duration, count=Math.ceil(duration);
const [left,right,top,bottom,...frames]=await Promise.all(['left.png','right.png','top.png','bottom.png',...Array.from({length:count},(_,i)=>`frame-${i}.jpg`)].map(f=>load('assets/'+f)));
const live=new THREE.VideoTexture(video);live.colorSpace=THREE.SRGBColorSpace;
const material=map=>new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide});
const sides=[left,right,top,bottom].map(material), frozen=frames.map(material), liveMat=material(live);
// Quads use explicit world-space vertices: u/v represent image x/y or time.
function quad(mat){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(8),2));g.setIndex([0,1,2,0,2,3]);const m=new THREE.Mesh(g,mat);m.frustumCulled=false;return m;}
function set(q,vertices,uv){q.geometry.attributes.position.array.set(vertices.flat());q.geometry.attributes.position.needsUpdate=true;q.geometry.attributes.uv.array.set(uv.flat());q.geometry.attributes.uv.needsUpdate=true;}
const slabs=Array.from({length:count},(_,i)=>{const g=new THREE.Group();root.add(g);const faces=[...sides,frozen[i],frozen[Math.min(i+1,count-1)]].map(quad);faces.forEach(f=>g.add(f));const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(width,height,1)),new THREE.LineBasicMaterial({color:0xd7f1cf,transparent:true,opacity:.24}));g.add(line);return {g,faces,line};});
const currentOutline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-width/2,-height/2,0),new THREE.Vector3(width/2,-height/2,0),new THREE.Vector3(width/2,height/2,0),new THREE.Vector3(-width/2,height/2,0)]),new THREE.LineBasicMaterial({color:0xbaf18d}));root.add(currentOutline);
const x=width/2,y=height/2, square=[[0,0],[1,0],[1,1],[0,1]];
function update(){const t=Math.min(video.currentTime,duration),d=+$('depth').value,gap=+$('gap').value;const last=Math.min(count-1,Math.max(0,Math.ceil(t)-1));const total=Math.max(.006,t*d)+last*gap;root.position.z=-total/2;
slabs.forEach(({g,faces:f,line},i)=>{g.visible=i<=last;if(!g.visible)return;let elapsed=Math.max(.0001,Math.min(1,t-i)), a=i*d+i*gap,b=a+elapsed*d,ta=i/duration,tb=Math.min(duration,i+elapsed)/duration;
set(f[0],[[-x,-y,a],[-x,-y,b],[-x,y,b],[-x,y,a]],[[ta,0],[tb,0],[tb,1],[ta,1]]);
set(f[1],[[x,-y,a],[x,-y,b],[x,y,b],[x,y,a]],[[ta,0],[tb,0],[tb,1],[ta,1]]);
set(f[2],[[-x,y,a],[x,y,a],[x,y,b],[-x,y,b]],[[0,1-ta],[1,1-ta],[1,1-tb],[0,1-tb]]);
set(f[3],[[-x,-y,a],[x,-y,a],[x,-y,b],[-x,-y,b]],[[0,1-ta],[1,1-ta],[1,1-tb],[0,1-tb]]);
set(f[4],[[-x,-y,a],[x,-y,a],[x,y,a],[-x,y,a]],square);
set(f[5],[[-x,-y,b],[x,-y,b],[x,y,b],[-x,y,b]],square);f[5].material=i===last?liveMat:frozen[Math.min(i+1,count-1)];line.position.z=(a+b)/2;line.scale.z=b-a;
// Hide touching interior caps in solid mode to avoid coplanar flicker.
f[4].visible=gap>0||i===0;f[5].visible=gap>0||i===last;
});currentOutline.position.z=total+.003;
$('clock').textContent=t.toFixed(2);$('seek').value=t;$('time').textContent=`${t.toFixed(2)} / ${duration.toFixed(2)} s`;
window.volumeState={time:t,layers:last+1,completed:Math.floor(t),depth:total,spacing:gap,playing:!video.paused};
}
function view(name){const span=Math.max(4,duration*+$('depth').value+(count-1)*+$('gap').value),dist=Math.max(8,span*1.55);controls.target.set(0,0,0);camera.up.set(0,1,0);const pos={perspective:[.8,.45,1],front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,.001],bottom:[0,-1,.001]}[name];camera.position.set(...pos).normalize().multiplyScalar(dist);controls.update();}
$('seek').max=duration;$('play').disabled=false;$('restart').disabled=false;$('loading').hidden=true;
async function play(){try{if(video.ended)video.currentTime=0;await video.play();}catch(e){$('loading').hidden=false;$('loading').textContent='Press Play to start the video.';}}
$('play').onclick=()=>video.paused?play():video.pause();video.onplay=()=>{$('play').textContent='Pause';$('loading').hidden=true;};video.onpause=()=>{$('play').textContent=video.ended?'Replay':'Play';};video.onended=()=>{if($('loop').checked){video.currentTime=0;play();}};
$('restart').onclick=()=>{video.currentTime=0;play();};$('seek').oninput=e=>{video.currentTime=+e.target.value;};$('speed').onchange=e=>video.playbackRate=+e.target.value;$('spin').onchange=e=>controls.autoRotate=e.target.checked;$('sound').onchange=e=>video.muted=!e.target.checked;
$('gap').oninput=()=>{$('gapValue').value=+$('gap').value===0?'Solid':(+$('gap').value).toFixed(2);view('perspective');};$('depth').oninput=()=>{$('depthValue').value=(+$('depth').value).toFixed(2);};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));
window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','BUTTON','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('play').click();}});
new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(stage);
view('perspective');let previous=performance.now();renderer.setAnimationLoop(now=>{update();controls.update(Math.min(.1,(now-previous)/1000));previous=now;renderer.render(scene,camera);});
}
init().catch(e=>{$('loading').textContent='Unable to start: '+e.message;console.error(e);});
