"""Dev server con hot-reload (SSE), sin dependencias externas.

- Sirve el directorio de este archivo (frontend/) en un puerto fijo.
- Manda Cache-Control: no-store (nada de peleas con la caché del navegador).
- Inyecta un cliente SSE en cada .html; un hilo vigila *.html/*.css/*.js y, ante
  cualquier cambio de mtime, empuja un evento → el navegador se recarga solo.

Uso:  python3 frontend/devserver.py [puerto]     (default 5600)
Link: http://localhost:5600/map.html?api=http://127.0.0.1:8099
"""
from __future__ import annotations

import sys
import time
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = 0  # se incrementa ante cualquier cambio de archivo

_RELOAD_SNIPPET = (
    b"<script>\n"
    b"(() => { const es = new EventSource('/__reload');\n"
    b"  es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };\n"
    b"  es.onerror = () => {}; })();\n"
    b"</script>\n</body>"
)


def _watch() -> None:
    """Poll de mtimes; bump de VERSION ante cualquier cambio."""
    global VERSION
    exts = {".html", ".css", ".js"}
    prev: dict[str, float] = {}
    while True:
        snap = {str(p): p.stat().st_mtime
                for p in ROOT.iterdir() if p.suffix in exts and p.is_file()}
        if prev and snap != prev:
            VERSION += 1
        prev = snap
        time.sleep(0.3)


class DevHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *a):  # silencioso salvo errores
        pass

    def do_GET(self):
        if self.path.split("?")[0] == "/__reload":
            return self._sse()
        path = self.path.split("?")[0]
        if path in ("/", ""):
            path = "/map.html"
        if path.endswith(".html"):
            return self._html(path)
        return super().do_GET()

    def _html(self, path: str):
        f = ROOT / path.lstrip("/")
        if not f.is_file():
            self.send_error(404)
            return
        body = f.read_bytes()
        # __nolive en la query desactiva el SSE (para capturas headless que si no
        # quedan colgadas esperando el stream abierto).
        nolive = "__nolive" in self.path
        if not nolive and b"</body>" in body:
            body = body.replace(b"</body>", _RELOAD_SNIPPET, 1)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _sse(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        last = VERSION
        try:
            while True:
                if VERSION != last:
                    last = VERSION
                    self.wfile.write(b"data: reload\n\n")
                else:
                    self.wfile.write(b": keepalive\n\n")
                self.wfile.flush()
                time.sleep(0.3)
        except (BrokenPipeError, ConnectionResetError):
            pass


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5600
    threading.Thread(target=_watch, daemon=True).start()
    handler = partial(DevHandler, directory=str(ROOT))
    print(f"dev server (hot-reload) → http://localhost:{port}/  sirviendo {ROOT}")
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


if __name__ == "__main__":
    main()
