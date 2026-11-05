#!/usr/bin/env python3
"""Local server for the Live 3D page: serves web/ on http://localhost:8765 and appends what the page streams
(samples, band status, page log) to research-tools/live-logs/, so a developer can read the band in real time.

    python3 research-tools/live_server.py        # then open http://localhost:8765/live/ in Chrome

Web Bluetooth works on localhost (a secure context). Only the page served from localhost posts data; the public
site never does. Logs stay on this machine (live-logs/ is git-ignored).
"""
import http.server, json, os, socketserver, time

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(os.path.dirname(ROOT), 'web')
LOGS = os.path.join(ROOT, 'live-logs')
os.makedirs(LOGS, exist_ok=True)
STAMP = time.strftime('%Y%m%d-%H%M%S')
SAMPLES = os.path.join(LOGS, f'samples-{STAMP}.csv')
EVENTS = os.path.join(LOGS, f'events-{STAMP}.log')
HEADER = 't_ms,seq,label,ax_g,ay_g,az_g,gx_dps,gy_dps,gz_dps,tap,armed,cooling,tap_pending,tilt_candidate,in_dip,event,roll_deg,pitch_deg\n'


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=WEB, **k)

    def log_message(self, *a):
        pass

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > 2_000_000:
            self.send_response(413); self.end_headers(); return
        body = self.rfile.read(n).decode('utf-8', 'replace')
        if self.path == '/ingest/samples':
            new = not os.path.exists(SAMPLES)
            with open(SAMPLES, 'a') as f:
                if new: f.write(HEADER)
                f.write(body if body.endswith('\n') else body + '\n')
        elif self.path == '/ingest/events':
            with open(EVENTS, 'a') as f:
                for line in json.loads(body or '[]'):
                    f.write(f"{time.strftime('%H:%M:%S')} {line}\n")
        else:
            self.send_response(404); self.end_headers(); return
        self.send_response(204); self.end_headers()


socketserver.ThreadingTCPServer.allow_reuse_address = True
with socketserver.ThreadingTCPServer(('127.0.0.1', 8765), Handler) as srv:
    print(f'Live 3D: http://localhost:8765/live/\nsamples -> {SAMPLES}\nevents  -> {EVENTS}', flush=True)
    srv.serve_forever()
