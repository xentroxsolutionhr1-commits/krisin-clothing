from pathlib import Path

server = Path("server-example/server.pg-migration.js")
routes_file = Path("server-example/customer-order-routes.tmp")

content = server.read_text(encoding="utf-8-sig")
routes = routes_file.read_text(encoding="utf-8-sig")
marker = "// List all orders"

if "app.get(\"/api/orders/my-orders\"" in content:
    raise SystemExit("STOP: Customer order routes already exist. No changes made.")

if content.count(marker) != 1:
    raise SystemExit("STOP: Expected insertion marker was not found exactly once. No changes made.")

if not routes.strip():
    raise SystemExit("STOP: Temporary routes file is empty. No changes made.")

updated = content.replace(marker, routes.rstrip() + "\n\n" + marker, 1)
server.write_text(updated, encoding="utf-8", newline="\n")
print("Customer routes inserted successfully.")
