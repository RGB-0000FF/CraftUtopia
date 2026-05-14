from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class CraftDemoHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".json": "application/json; charset=utf-8",
    }


def main() -> None:
    root = Path(__file__).resolve().parent
    host = "127.0.0.1"
    port = 8000
    handler = lambda *args, **kwargs: CraftDemoHandler(*args, directory=root, **kwargs)

    with ThreadingHTTPServer((host, port), handler) as server:
        print(f"CraftUtopia demo: http://{host}:{port}/index.html")
        print("Edit data/run-config.json for stage metadata and data/run-events.json for the right-side log.")
        server.serve_forever()


if __name__ == "__main__":
    main()
