from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os,re,subprocess,tempfile,shutil,json
os.chdir(Path(__file__).parent)
class Handler(SimpleHTTPRequestHandler):
 def do_GET(self):
  if self.path=='/capabilities':
   data=json.dumps({'conversion':bool(shutil.which('ffmpeg'))}).encode()
   self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
  if any(part.startswith('.') for part in Path(self.path.split('?')[0]).parts) or self.path.startswith(('/assets/','/prepare.py')):
   self.send_error(404);return
  super().do_GET()
 def do_POST(self):
  if self.path!='/convert':self.send_error(404);return
  if self.headers.get('Origin') not in ('http://localhost:8793','http://127.0.0.1:8793'):
   self.send_error(403);return
  if not shutil.which('ffmpeg'):self.send_error(503,'Install FFmpeg for local conversion.');return
  try:
   size=int(self.headers.get('Content-Length','0'))
   if not 0<size<=4*1024**3:self.send_error(413,'Choose a video under 4 GB.');return
   with tempfile.TemporaryDirectory(prefix='videodepth-') as folder:
    source=Path(folder)/'input';dest=Path(folder)/'output.mp4'
    with source.open('wb') as f:
     remaining=size
     while remaining:
      chunk=self.rfile.read(min(1024*1024,remaining))
      if not chunk:raise ValueError('Incomplete file')
      f.write(chunk);remaining-=len(chunk)
    result=subprocess.run(['ffmpeg','-nostdin','-y','-v','error','-i',str(source),'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",'-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-c:a','aac','-movflags','+faststart',str(dest)],capture_output=True,timeout=1800)
    if result.returncode:
     self.send_response(422);self.end_headers();self.wfile.write(b'Could not decode this file. Choose a different video.');return
    self.send_response(200);self.send_header('Content-Type','video/mp4');self.send_header('Content-Length',str(dest.stat().st_size));self.end_headers()
    with dest.open('rb') as f:shutil.copyfileobj(f,self.wfile)
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception:
   self.send_error(500,'Local conversion failed. Try a different video.')
 def send_head(self):
  path=Path(self.translate_path(self.path))
  value=self.headers.get('Range','')
  if path.is_file() and value:
   m=re.fullmatch(r'bytes=(\d*)-(\d*)',value)
   size=path.stat().st_size
   if m:
    start=int(m[1]) if m[1] else max(0,size-int(m[2]))
    end=min(int(m[2]) if m[2] and m[1] else size-1,size-1)
    if start>end:
     self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return None
    f=path.open('rb');f.seek(start);self.remaining=end-start+1
    self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Accept-Ranges','bytes');self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Content-Length',str(self.remaining));self.end_headers();return f
  self.remaining=None
  return super().send_head()
 def copyfile(self,source,outputfile):
  if self.remaining is None:return super().copyfile(source,outputfile)
  remaining=self.remaining
  while remaining:
   data=source.read(min(65536,remaining))
   if not data:break
   outputfile.write(data);remaining-=len(data)
print('videodepth: http://localhost:8793',flush=True)
ThreadingHTTPServer(('127.0.0.1',8793),Handler).serve_forever()
