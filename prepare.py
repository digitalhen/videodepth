from pathlib import Path
import math, subprocess, json
from PIL import Image
p=Path(__file__).parent; a=p/'assets'
def inv(v):
    return v*v/3 if v<=.5 else (math.exp((v-.55991073)/.17883277)+.28466892)/12
def srgb(v):
    v=max(0,min(1,v)); return 12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055
lut=a/'hlg-to-sdr.cube'
with lut.open('w') as f:
    f.write('LUT_3D_SIZE 33\n')
    for b in range(33):
      for g in range(33):
       for r in range(33):
        rgb=[inv(x/32) for x in (r,g,b)]; y=sum(x*c for x,c in zip(rgb,(.2627,.678,.0593)))
        rgb=[x*max(y,1e-8)**.2*5 for x in rgb]
        rgb=[sum(x*c for x,c in zip(rgb,row)) for row in ((1.6605,-.5876,-.0728),(-.1246,1.1329,-.0083),(-.0182,-.1006,1.1187))]
        f.write(' '.join(str(srgb(max(0,x)/(1+max(0,x)))) for x in rgb)+'\n')
subprocess.run(['ffmpeg','-y','-v','error','-i','/Users/henry/Downloads/IMG_3122.MOV','-vf',f'scale=540:960:in_color_matrix=bt2020:out_color_matrix=bt2020,format=rgb24,lut3d={lut},scale=out_color_matrix=bt709,format=yuv420p,setsar=1','-c:v','libx264','-preset','fast','-crf','20','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-c:a','aac','-movflags','+faststart',str(a/'video.mp4')],check=True)
raw=subprocess.check_output(['ffmpeg','-v','error','-i',str(a/'video.mp4'),'-vf','fps=12,scale=270:480','-f','rawvideo','-pix_fmt','rgb24','-'])
size=270*480*3; frames=[Image.frombytes('RGB',(270,480),raw[i:i+size]) for i in range(0,len(raw),size)]
n=len(frames)
left=Image.new('RGB',(n,480)); right=left.copy(); top=Image.new('RGB',(270,n)); bottom=top.copy()
for i,im in enumerate(frames):
 left.paste(im.crop((0,0,1,480)),(i,0)); right.paste(im.crop((269,0,270,480)),(i,0))
 top.paste(im.crop((0,0,270,1)),(0,i)); bottom.paste(im.crop((0,479,270,480)),(0,i))
 if i%12==0: im.save(a/f'frame-{i//12}.jpg',quality=92)
for name,im in [('left',left),('right',right),('top',top),('bottom',bottom)]: im.save(a/f'{name}.png')
print('Prepared',n,'time samples')
