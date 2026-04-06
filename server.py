import http.server
import socketserver

PORT = 8888

with socketserver.TCPServer(("", PORT), http.server.SimpleHTTPRequestHandler) as httpd:
    print(f"QIRA Peptide Site running at http://localhost:{PORT}")
    httpd.serve_forever()
