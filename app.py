from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
from dataclasses import dataclass, asdict
import threading
import webbrowser
from doubly_linked_list import DoublyLinkedList

BASE_DIR = Path(__file__).parent
HOST = "127.0.0.1"
PORT = 8000

@dataclass
class Checkpoint:
    code: str
    name: str
    zone: str
    depth: int
    status: str

class SurveyManager:
    def __init__(self):
        self.route = DoublyLinkedList()
        self.selected_code = None
        self.load_demo_data()

    def load_demo_data(self):
        self.route.clear()
        demo = [
            Checkpoint("AS-01", "Shipwreck bow", "Sector A", 42, "Mapped"),
            Checkpoint("AS-02", "Ceramic field", "Sector B", 58, "Pending"),
            Checkpoint("AS-03", "Stone anchor", "Sector C", 64, "Pending"),
            Checkpoint("AS-04", "Cargo scatter", "Sector D", 71, "Pending"),
            Checkpoint("AS-05", "Hull debris", "Sector E", 79, "Pending"),
        ]
        for item in demo:
            self.route.append(item)
        self.selected_code = "AS-01"

    def next_code(self):
        numbers = []
        for item in self.route.traverse_forward():
            try:
                numbers.append(int(item.code.split("-")[-1]))
            except ValueError:
                pass
        return f"AS-{max(numbers, default=0) + 1:02d}"

    def selected_node(self):
        if not self.selected_code:
            return None
        return self.route.find(lambda item: item.code == self.selected_code)

    def validate_checkpoint(self, name, zone, depth, status):
        if not name or not zone:
            raise ValueError("Checkpoint name and survey zone are required.")
        depth = int(depth)
        if depth < 1 or depth > 200:
            raise ValueError("Depth must be between 1 and 200 meters.")
        allowed = {"Pending", "Mapped", "Needs review", "Restricted"}
        if status not in allowed:
            raise ValueError("Invalid status.")
        return Checkpoint(self.next_code(), name, zone, depth, status)

    def add_checkpoint(self, name, zone, depth, status, after_code=None):
        item = self.validate_checkpoint(name, zone, depth, status)
        if after_code:
            node = self.route.find(lambda value: value.code == after_code)
            if node is None:
                raise ValueError("The selected checkpoint does not exist.")
            self.route.insert_after(node, item)
        else:
            self.route.append(item)
        self.selected_code = item.code

    def delete_selected(self):
        node = self.selected_node()
        if node is None:
            raise ValueError("Select a checkpoint first.")
        replacement = node.next or node.prev or self.route.head
        self.route.delete_node(node)
        self.selected_code = replacement.value.code if replacement else None

    def move_selection(self, direction):
        node = self.selected_node()
        if node is None:
            raise ValueError("Select a checkpoint first.")
        target = node.next if direction == "next" else node.prev
        if target:
            self.selected_code = target.value.code

    def payload(self):
        return {
            "head": self.route.head.value.code if self.route.head else None,
            "tail": self.route.tail.value.code if self.route.tail else None,
            "selected": self.selected_code,
            "count": self.route.size,
            "forward": [asdict(x) for x in self.route.traverse_forward()],
            "backward": [asdict(x) for x in self.route.traverse_backward()],
        }

manager = SurveyManager()

class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length).decode("utf-8") or "{}")

    def serve_file(self, relative, content_type):
        path = BASE_DIR / relative
        if not path.exists():
            self.send_json(404, {"error": "Frontend file not found."})
            return
        data = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/api/health":
            self.send_json(200, {"status": "ok", "service": "AquaSurvey"}); return
        if self.path == "/api/state":
            self.send_json(200, manager.payload()); return
        routes = {"/":"frontend/index.html", "/index.html":"frontend/index.html", "/styles.css":"frontend/styles.css", "/app.js":"frontend/app.js"}
        if self.path in routes:
            types = {".html":"text/html", ".css":"text/css", ".js":"application/javascript"}
            suffix = Path(routes[self.path]).suffix
            self.serve_file(routes[self.path], types[suffix]); return
        self.send_json(404, {"error":"Not found"})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        if self.path != "/api/action":
            self.send_json(404, {"error":"Not found"}); return
        try:
            data = self.body()
            action = data.get("action")
            if action in {"append", "insert_after"}:
                manager.add_checkpoint(
                    data.get("name", "").strip(), data.get("zone", "").strip(),
                    data.get("depth", 0), data.get("status", "Pending"),
                    data.get("after_code") if action == "insert_after" else None
                )
            elif action == "delete":
                manager.delete_selected()
            elif action == "move":
                manager.move_selection(data.get("direction"))
            elif action == "select":
                code = data.get("code")
                if manager.route.find(lambda value: value.code == code) is None:
                    raise ValueError("Checkpoint not found.")
                manager.selected_code = code
            elif action == "reset":
                manager.load_demo_data()
            else:
                raise ValueError("Unknown action.")
            self.send_json(200, manager.payload())
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})

    def log_message(self, format, *args):
        print(f"[AquaSurvey] {self.address_string()} - {format % args}")

if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    url = f"http://{HOST}:{PORT}/"
    print(f"AquaSurvey running at {url}")
    print("Open the URL above. Do NOT use Live Server for this project.")
    print("Press Ctrl+C to stop the server.")
    threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()
