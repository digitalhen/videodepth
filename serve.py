from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os,re
os.chdir(Path(__file__).parent)
class Handler(SimpleHTTPRequestHandler):
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
print('Time / Volume: http://localhost:8793',flush=True)
ThreadingHTTPServer(('127.0.0.1',8793),Handler).serve_forever()
