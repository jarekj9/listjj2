import os
import tempfile
import uuid
from dataclasses import replace

import pytest

_tmp = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["JWT_SECRET"] = "test-secret-with-more-than-32-bytes!!"
os.environ["ADMIN_EMAIL"] = "admin@test.local"
os.environ["ADMIN_BOOTSTRAP_TOKEN"] = "test-admin-bootstrap"
os.environ["MAX_UPLOAD_MB"] = "1"

from fastapi.testclient import TestClient  # noqa: E402

from app import services  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, email, password="secret123"):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def admin(client):
    registered = client.post(
        "/api/auth/register",
        json={"email": "admin@test.local", "password": "secret123", "adminBootstrapToken": "test-admin-bootstrap"},
    )
    assert registered.status_code == 200
    assert "You can now sign in" in registered.json()["message"]
    return _login(client, "admin@test.local")


@pytest.fixture(scope="module")
def user(client, admin):
    assert client.post("/api/auth/register", json={"email": "user@test.local", "password": "secret123"}).status_code == 200
    # pending approval: no access yet
    pending = _login(client, "user@test.local")
    assert client.get("/api/categories", headers=pending).status_code == 403
    me = client.get("/api/auth/me", headers=pending).json()
    r = client.post("/api/users", json={"id": me["id"], "email": "user@test.local", "role": "User"}, headers=admin)
    assert r.status_code == 200, r.text
    return _login(client, "user@test.local")


def test_register_duplicate_and_bad_login(client, admin):
    r = client.post("/api/auth/register", json={"email": "admin@test.local", "password": "secret123"})
    assert r.status_code == 400
    r = client.post("/api/auth/login", json={"email": "admin@test.local", "password": "wrong"})
    assert r.status_code == 401


def test_admin_bootstrap_requires_secret(client, monkeypatch):
    settings = replace(get_settings(), admin_email="bootstrap@test.local")
    monkeypatch.setattr(services, "get_settings", lambda: settings)
    r = client.post("/api/auth/register", json={"email": "bootstrap@test.local", "password": "secret123"})
    assert r.status_code == 400
    assert "bootstrap token" in r.json()["detail"]


def test_admin_sees_role_and_users(client, admin, user):
    me = client.get("/api/auth/me", headers=admin).json()
    assert me["role"] == "Admin"
    response = client.get("/api/users", headers=admin)
    users = response.json()
    assert {u["email"] for u in users} >= {"admin@test.local", "user@test.local"}
    assert all("apiKey" not in u for u in users)


def test_admin_user_upsert_creates_given_id_without_exposing_api_key(client, admin):
    user_id = str(uuid.uuid4())
    response = client.post(
        "/api/users",
        json={"id": user_id, "email": "created-by-admin@test.local", "password": "secret123", "role": "User"},
        headers=admin,
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"id": user_id, "email": "created-by-admin@test.local", "role": "User"}


def test_non_admin_cannot_list_users(client, user):
    assert client.get("/api/users", headers=user).status_code == 403


def test_category_and_item_flow(client, user):
    cat = client.post("/api/categories", json={"name": "Shopping", "description": "stuff"}, headers=user).json()
    cat2 = client.post("/api/categories", json={"name": "Work"}, headers=user).json()

    ids = []
    for name, tags in [("milk", ["dairy"]), ("bread", ["bakery", "fresh"]), ("apple", ["fruit"])]:
        r = client.post(
            "/api/items",
            json={"name": name, "tags": tags, "categoryId": cat["id"], "value": 2},
            headers=user,
        )
        assert r.status_code == 200, r.text
        ids.append(r.json()["id"])

    items = client.get("/api/items", params={"category_id": cat["id"]}, headers=user).json()
    assert [i["name"] for i in items] == ["milk", "bread", "apple"]
    assert [i["sequenceNumber"] for i in items] == [1.0, 2.0, 3.0]

    # move apple up -> it swaps with bread
    assert client.post(f"/api/items/{ids[2]}/move", params={"direction": "up"}, headers=user).json() == {"moved": True}
    names = [i["name"] for i in client.get("/api/items", params={"category_id": cat["id"]}, headers=user).json()]
    assert names == ["milk", "apple", "bread"]
    # first item cannot move up
    assert client.post(f"/api/items/{ids[0]}/move", params={"direction": "up"}, headers=user).json() == {"moved": False}

    # search: words must all match, '!' excludes
    found = client.get("/api/items", params={"q": "fresh"}, headers=user).json()
    assert [i["name"] for i in found] == ["bread"]
    found = client.get("/api/items", params={"q": "!dairy"}, headers=user).json()
    assert "milk" not in [i["name"] for i in found]

    # sort by tags: bakery(bread) < dairy(milk) < fruit(apple)
    assert client.post(f"/api/items/sort-by-tags/{cat['id']}", headers=user).status_code == 204
    names = [i["name"] for i in client.get("/api/items", params={"category_id": cat["id"]}, headers=user).json()]
    assert names == ["bread", "milk", "apple"]

    tags = client.get("/api/tags", params={"category_id": cat["id"]}, headers=user).json()
    assert tags == ["bakery", "dairy", "fresh", "fruit"]

    # recent category
    assert client.put("/api/categories/recent", json={"categoryId": cat["id"]}, headers=user).status_code == 200
    assert client.get("/api/categories/recent", headers=user).json() == {"categoryId": cat["id"]}

    # moving an item to another category gives it a new sequence there
    moved = client.post("/api/items", json={"id": ids[0], "name": "milk", "categoryId": cat2["id"]}, headers=user).json()
    assert moved["categoryId"] == cat2["id"]

    # delete item
    assert client.delete(f"/api/items/{ids[1]}", headers=user).status_code == 204
    assert client.get(f"/api/items/{ids[1]}", headers=user).status_code == 404

    invalid_value = client.post(
        "/api/items",
        json={"name": "not finite", "value": float("inf"), "categoryId": cat["id"]},
        headers=user,
    )
    assert invalid_value.status_code == 422
    assert "finite" in invalid_value.text


def test_search_casefolds_unicode_name_and_tags(client, user):
    category = client.post("/api/categories", json={"name": "Unicode"}, headers=user).json()
    item = client.post(
        "/api/items",
        json={"name": "Łódź notes", "tags": ["Żółty"], "categoryId": category["id"]},
        headers=user,
    ).json()
    by_name = client.get("/api/items", params={"q": "łÓDŹ"}, headers=user).json()
    by_tag = client.get("/api/items", params={"q": "żÓŁTY"}, headers=user).json()
    excluded = client.get("/api/items", params={"q": "!ŻÓŁTY"}, headers=user).json()
    assert item["id"] in {result["id"] for result in by_name}
    assert item["id"] in {result["id"] for result in by_tag}
    assert item["id"] not in {result["id"] for result in excluded}


def test_ownership_is_enforced(client, admin, user):
    other_cat = client.post("/api/categories", json={"name": "Private"}, headers=admin).json()
    assert client.post(
        "/api/items", json={"name": "x", "categoryId": other_cat["id"]}, headers=user
    ).status_code == 404
    assert client.delete(f"/api/categories/{other_cat['id']}", headers=user).status_code == 404


def test_modified_date_filters(client, user):
    category = client.post("/api/categories", json={"name": "Date filter"}, headers=user).json()
    item = client.post(
        "/api/items",
        json={"name": "recent", "categoryId": category["id"]},
        headers=user,
    ).json()
    from_future = client.get("/api/items", params={"date_from": "2099-01-01T00:00:00Z"}, headers=user)
    before_epoch = client.get("/api/items", params={"date_to": "2000-01-01T00:00:00Z"}, headers=user)
    from_past = client.get("/api/items", params={"date_from": "2000-01-01T00:00:00Z"}, headers=user)
    assert item["id"] not in {entry["id"] for entry in from_future.json()}
    assert item["id"] not in {entry["id"] for entry in before_epoch.json()}
    assert item["id"] in {entry["id"] for entry in from_past.json()}


def test_files_upload_download_delete(client, user):
    assert services.sanitize_filename("../bad\r\nname.txt") == "badname.txt"
    cat = client.post("/api/categories", json={"name": "Files"}, headers=user).json()
    item = client.post("/api/items", json={"name": "doc", "categoryId": cat["id"]}, headers=user).json()
    r = client.post(
        f"/api/items/{item['id']}/files", files={"file": ("note.txt", b"hello", "text/plain")}, headers=user
    )
    assert r.status_code == 200, r.text
    file_id = r.json()["id"]
    dl = client.get(f"/api/files/{file_id}", headers=user)
    assert dl.content == b"hello"
    unicode_file = client.post(
        f"/api/items/{item['id']}/files",
        files={"file": ("zażółć.txt", b"utf-8-name", "text/plain")},
        headers=user,
    )
    unicode_download = client.get(f"/api/files/{unicode_file.json()['id']}", headers=user)
    assert unicode_download.status_code == 200
    assert "filename*=UTF-8''za%C5%BC%C3%B3%C5%82%C4%87.txt" in unicode_download.headers["content-disposition"]
    too_big = client.post(
        f"/api/items/{item['id']}/files", files={"file": ("big.bin", b"x" * (2 * 1024 * 1024), "application/octet-stream")}, headers=user
    )
    assert too_big.status_code == 413
    assert client.delete(f"/api/files/{file_id}", headers=user).status_code == 204
    too_big_csv = client.post(
        "/api/items/import",
        files={"file": ("large.csv", b"x" * (2 * 1024 * 1024), "text/csv")},
        headers=user,
    )
    assert too_big_csv.status_code == 413


def test_csv_export_import(client, user):
    csv_text = "SequenceNumber;Value;Name;Description;Category;Active;Tags\n5;3.5;Coffee;beans;Groceries;True;drink,morning\n"
    r = client.post(
        "/api/items/import", files={"file": ("in.csv", csv_text.encode(), "text/csv")}, headers=user
    )
    assert r.status_code == 200, r.text
    assert r.json()["imported"] == 1
    exported = client.get("/api/items/export", headers=user)
    assert exported.status_code == 200
    assert "Coffee;3.5;" in exported.text or "Coffee" in exported.text
    assert exported.text.splitlines()[0] == "SequenceNumber;Value;Name;Description;Category;Active;Tags"

    invalid = "SequenceNumber;Value;Name;Description;Category;Active;Tags\n0;bad;Broken;desc;BrokenCategory;True;tag\n"
    failed_import = client.post(
        "/api/items/import",
        files={"file": ("invalid.csv", invalid.encode(), "text/csv")},
        headers=user,
    )
    assert failed_import.status_code == 200
    assert failed_import.json()["imported"] == 0

    oversized_item_name = "N" * 501
    oversized_category = "C" * 201
    invalid_rows = (
        "SequenceNumber;Value;Name;Description;Category;Active;Tags\n"
        "0;inf;NonFiniteValue;desc;NoCategoryForInf;True;tag\n"
        "nan;1;NonFiniteSequence;desc;NoCategoryForNan;True;tag\n"
        f"0;1;{oversized_item_name};desc;NoCategoryForLongItem;True;tag\n"
        f"0;1;LongCategory;desc;{oversized_category};True;tag\n"
    )
    invalid_rows_response = client.post(
        "/api/items/import",
        files={"file": ("invalid-rows.csv", invalid_rows.encode(), "text/csv")},
        headers=user,
    )
    assert invalid_rows_response.status_code == 200
    assert invalid_rows_response.json()["imported"] == 0
    categories = client.get("/api/categories", headers=user).json()
    category_names = {category["name"] for category in categories}
    assert not category_names.intersection(
        {
            "BrokenCategory",
            "NoCategoryForInf",
            "NoCategoryForNan",
            "NoCategoryForLongItem",
            oversized_category,
        }
    )


def test_api_key_external_and_settings(client, user):
    key = client.post("/api/settings/api-key/generate", headers=user).json()["apiKey"]
    assert uuid.UUID(key)
    api = {"Authorization": f"Bearer {key}"}
    cat = client.post("/api/categories", json={"name": "Watch"}, headers=user).json()
    r = client.post("/api/external/items", json={"name": "ping", "categoryName": "watch"}, headers=api)
    assert r.status_code == 200, r.text
    non_finite = client.post(
        "/api/external/items",
        json={"name": "invalid numeric", "categoryName": "watch", "value": float("inf")},
        headers=api,
    )
    assert non_finite.status_code == 422
    first = client.get("/api/external/categories/Watch/first-item", headers=api)
    assert first.json()["name"] == "ping"
    assert client.get("/api/external/items", headers=api).status_code == 200
    assert client.post("/api/external/items", json={"name": "x", "categoryName": "nope"}, headers=api).status_code == 404
    assert client.get("/api/external/items", headers={"Authorization": "Bearer bad"}).status_code == 401
    assert cat["id"]


def test_unicode_category_name_lookup_for_external_and_csv(client, user):
    category = client.post("/api/categories", json={"name": "Żółć"}, headers=user).json()
    key = client.post("/api/settings/api-key/generate", headers=user).json()["apiKey"]
    api_key = {"Authorization": f"Bearer {key}"}
    external = client.post(
        "/api/external/items",
        json={"name": "external unicode", "categoryName": "żÓŁĆ"},
        headers=api_key,
    )
    assert external.status_code == 200, external.text
    assert external.json()["categoryId"] == category["id"]

    csv_text = "SequenceNumber;Value;Name;Description;Category;Active;Tags\n1;0;CSV unicode;;żółć;True;\n"
    imported = client.post("/api/items/import", files={"file": ("unicode.csv", csv_text.encode(), "text/csv")}, headers=user)
    assert imported.status_code == 200 and imported.json()["imported"] == 1
    categories = client.get("/api/categories", headers=user).json()
    assert sum(c["name"].casefold() == "żółć".casefold() for c in categories) == 1


def test_legacy_watch_api_compatibility(client, user):
    key = client.post("/api/settings/api-key/generate", headers=user).json()["apiKey"]
    bearer = {"Authorization": f"Bearer {key}"}
    client.post("/api/categories", json={"name": "Legacy"}, headers=user)
    supplied_id = str(uuid.uuid4())
    created = client.post(
        "/api/Listjj/AddItem",
        json={"id": supplied_id, "name": "watch item", "categoryName": "Legacy", "value": "4"},
        headers=bearer,
    )
    assert created.status_code == 200 and created.json() == {"status": "ok"}
    all_items = client.get("/api/Listjj/GetAllListjj", headers=bearer)
    assert all_items.status_code == 200
    assert any(item["name"] == "watch item" for item in all_items.json())
    first = client.get("/api/Listjj/GetByCategoryName", params={"name": "Legacy", "key": key})
    assert first.status_code == 200 and first.json()["name"] == "watch item"
    assert first.json()["id"] == supplied_id
    item_id = first.json()["id"]
    deleted = client.post("/api/Listjj/DelItem", json={"id": item_id}, headers=bearer)
    assert deleted.status_code == 200 and deleted.json() == {"status": "Deleted."}
    assert client.get(
        "/api/Listjj/GetByCategoryName", params={"name": "Legacy", "key": "bad"}
    ).status_code == 401


def test_api_docs_use_api_path(client):
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/openapi.json").status_code == 200


def test_mcp_tools(client, user):
    key = client.post("/api/settings/api-key/generate", headers=user).json()["apiKey"]
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }
    init = client.post(
        "/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-03-26",
                "capabilities": {},
                "clientInfo": {"name": "test", "version": "1"},
            },
        },
    )
    assert init.status_code == 200, init.text

    call = client.post(
        "/mcp",
        headers=headers,
        json={"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "add_category", "arguments": {"name": "MCP"}}},
    )
    assert call.status_code == 200, call.text
    assert "MCP" in call.text

    client.post("/api/categories", json={"name": "MCP Żółć"}, headers=user)
    unicode_call = client.post(
        "/mcp",
        headers=headers,
        json={
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {"name": "add_item", "arguments": {"name": "unicode mcp item", "category_name": "mcp żÓŁĆ"}},
        },
    )
    assert unicode_call.status_code == 200, unicode_call.text
    assert "unicode mcp item" in unicode_call.text

    denied = client.post(
        "/mcp",
        headers={**headers, "Authorization": "Bearer nope"},
        json={"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {"name": "get_categories", "arguments": {}}},
    )
    assert "Missing or invalid API key" in denied.text
