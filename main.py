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
        print(f"CraftUtopia demo gallery: http://{host}:{port}/index.html")
        print(f"Sydney runtime demo: http://{host}:{port}/demos/viewer/?demo=sydney-opera-house")
        print("Edit data/demos/<demo-id>/demo.json and the referenced log manifest for each demo.")
        server.serve_forever()


if __name__ == "__main__":
    main()
