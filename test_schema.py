import os
from cloud_api.routers.notion_auth import _get, WATCHLIST_DB_ID, TRADELOG_DB_ID

print("=== WATCHLIST DB PROPERTIES ===")
res = _get(f"databases/{WATCHLIST_DB_ID}")
for k, v in res.get("properties", {}).items():
    print(f"'{k}': {v['type']}")

print("\n=== TRADELOG DB PROPERTIES ===")
res = _get(f"databases/{TRADELOG_DB_ID}")
for k, v in res.get("properties", {}).items():
    print(f"'{k}': {v['type']}")
