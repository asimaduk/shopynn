#!/usr/bin/env python3
"""Generate FK-ordered INSERTs from ims-modules CSV exports."""

from __future__ import annotations

import csv
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parents[1] / "data_import_inventory_sales_purchases.sql"
OLD_WH = "bdb74359-b5d8-4aed-8dc1-895b5517e6cc"
NEW_WH = "1b22ecfe-3048-4266-8d09-bd4f8f1e8530"
# Same as ims-services/products_import_from_desktop_csv.sql (all FK user/tenant columns use these)
IMPORT_TENANT_ID = "10ecd5bb-6d37-4013-a397-e763e3c03bcf"
IMPORT_CREATOR_ID = "6db9a046-43f9-41ac-8de2-971a48fb0dbb"

NULL_MARKERS = frozenset(("", "NULL", "\\N"))


def esc(s: str) -> str:
    return s.replace("'", "''")


def is_null(raw: str | None) -> bool:
    if raw is None:
        return True
    return raw.strip() in NULL_MARKERS


def lit_str(raw: str | None) -> str:
    if is_null(raw):
        return "NULL"
    return f"'{esc(raw.strip())}'"


def lit_ts(raw: str | None) -> str:
    return lit_str(raw)


def lit_int(raw: str | None) -> str:
    if is_null(raw):
        return "NULL"
    return str(int(float(raw.strip())))


def lit_dec(raw: str | None) -> str:
    if is_null(raw):
        return "NULL"
    return raw.strip()


def lit_wh(raw: str | None) -> str:
    """Map export warehouse and missing warehouse to target warehouse."""
    if is_null(raw):
        return f"'{NEW_WH}'"
    v = raw.strip()
    if v == OLD_WH:
        return f"'{NEW_WH}'"
    return f"'{esc(v)}'"


def lit_notes_array(raw: str | None) -> str:
    if is_null(raw):
        return "NULL"
    v = raw.strip()
    return f"ARRAY[{lit_str(v)}]::varchar[]"


def lit_import_tenant() -> str:
    return f"'{IMPORT_TENANT_ID}'"


def lit_import_user(raw: str | None) -> str:
    """Map export user FKs to the products-import creator; preserve SQL NULL when unset."""
    if is_null(raw):
        return "NULL"
    return f"'{IMPORT_CREATOR_ID}'"


def read_csv(name: str) -> list[dict[str, str]]:
    path = BASE / name
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> None:
    loc_rows = read_csv("locations.csv")

    lines: list[str] = [
        "-- Import: locations → suppliers → purchases → purchasedetails → sales → saledetails → inventories",
        f"-- tenant_id / creator_id match products_import_from_desktop_csv.sql",
        f"--   tenant_id  = {IMPORT_TENANT_ID}",
        f"--   creator_id = {IMPORT_CREATOR_ID} (creator_id, receiver_id, and any non-null updated_by)",
        f"-- Prerequisites: those rows exist in tenants / users; products for all product_id values;",
        f"-- warehouses row id = {NEW_WH}; customers if customer_id is non-null in sales.",
        "-- Inserts a minimal inactive users row for creator_id if that id is still missing.",
        "-- Re-run safety: truncate child tables first or use ON CONFLICT — invoice_number is UNIQUE on purchases/sales.",
        "BEGIN;",
        "",
        "-- FK: same creator as products import",
        "INSERT INTO users (id, first_name, last_name, email, phone, tenant_id, created_at, updated_at, is_active, user_type)",
        "SELECT",
        f"    '{IMPORT_CREATOR_ID}',",
        "    'Data',",
        "    'Import',",
        f"    'import-{IMPORT_CREATOR_ID.replace('-', '')}@ims-csv-import.invalid',",
        "    '+000006db9a046001',",
        f"    '{IMPORT_TENANT_ID}',",
        "    now(),",
        "    now(),",
        "    false,",
        "    3",
        f"WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = '{IMPORT_CREATOR_ID}');",
        "",
    ]

    # locations
    lines.append("INSERT INTO locations (id, name, manager, phone, address, created_at, updated_at, creator_id, notes, tenant_id) VALUES")
    vals = []
    for r in loc_rows:
        vals.append(
            "({})".format(
                ", ".join(
                    [
                        lit_str(r["id"]),
                        lit_str(r["name"]),
                        lit_str(r["manager"]),
                        lit_str(r["phone"]),
                        lit_str(r["address"]),
                        lit_ts(r["created_at"]),
                        lit_ts(r["updated_at"]),
                        lit_import_user(r["creator_id"]),
                        lit_str(r["notes"]),
                        lit_import_tenant(),
                    ]
                )
            )
        )
    lines.append(",\n".join(vals) + ";")
    lines.append("")

    # suppliers
    sup_rows = read_csv("suppliers.csv")
    lines.append(
        "INSERT INTO suppliers (id, name, address, manager, phone, created_at, updated_at, creator_id, notes, tenant_id) VALUES"
    )
    vals = []
    for r in sup_rows:
        vals.append(
            "({})".format(
                ", ".join(
                    [
                        lit_str(r["id"]),
                        lit_str(r["name"]),
                        lit_str(r["address"]),
                        lit_str(r["manager"]),
                        lit_str(r["phone"]),
                        lit_ts(r["created_at"]),
                        lit_ts(r["updated_at"]),
                        lit_import_user(r["creator_id"]),
                        lit_str(r["notes"]),
                        lit_import_tenant(),
                    ]
                )
            )
        )
    lines.append(",\n".join(vals) + ";")
    lines.append("")

    # purchases
    pur_rows = read_csv("purchases.csv")
    lines.append(
        "INSERT INTO purchases (id, number_of_items, total_amount, discount_amount, invoice_number, "
        "created_at, updated_at, due_date, current_status, payment_type, payment_number, payment_status, "
        "payment_date, payment_reference, notes, updated_by, receiver_id, warehouse_id, supplier_id, tenant_id) VALUES"
    )
    vals = []
    for r in pur_rows:
        vals.append(
            "({})".format(
                ", ".join(
                    [
                        lit_str(r["id"]),
                        lit_int(r["number_of_items"]),
                        lit_dec(r["total_amount"]),
                        lit_dec(r["discount_amount"]),
                        lit_str(r["invoice_number"]),
                        lit_ts(r["created_at"]),
                        lit_ts(r["updated_at"]),
                        lit_ts(r["due_date"]),
                        lit_int(r["current_status"]),
                        lit_int(r["payment_type"]),
                        lit_str(r["payment_number"]),
                        lit_int(r["payment_status"]),
                        lit_ts(r["payment_date"]),
                        lit_str(r["payment_reference"]),
                        lit_str(r["notes"]),
                        lit_import_user(r["updated_by"]),
                        lit_import_user(r["receiver_id"]),
                        lit_wh(r["warehouse_id"]),
                        lit_str(r["supplier_id"]),
                        lit_import_tenant(),
                    ]
                )
            )
        )
    lines.append(",\n".join(vals) + ";")
    lines.append("")

    # purchasedetails
    pd_rows = read_csv("purchasedetails.csv")
    lines.append(
        "INSERT INTO purchasedetails (id, purchase_id, product_id, supplier_id, unit_price, quantity, "
        "created_at, updated_at, warehouse_id, tenant_id, creator_id) VALUES"
    )
    vals = []
    for r in pd_rows:
        vals.append(
            "({})".format(
                ", ".join(
                    [
                        lit_str(r["id"]),
                        lit_str(r["purchase_id"]),
                        lit_str(r["product_id"]),
                        lit_str(r["supplier_id"]),
                        lit_dec(r["unit_price"]),
                        lit_int(r["quantity"]),
                        lit_ts(r["created_at"]),
                        lit_ts(r["updated_at"]),
                        lit_wh(r["warehouse_id"]),
                        lit_import_tenant(),
                        lit_import_user(r["creator_id"]),
                    ]
                )
            )
        )
    lines.append(",\n".join(vals) + ";")
    lines.append("")

    # sales
    sal_rows = read_csv("sales.csv")
    lines.append(
        "INSERT INTO sales (id, number_of_items, total_amount, discount_amount, invoice_number, sale_date, "
        "created_at, updated_at, due_date, current_status, payment_type, payment_number, payment_status, "
        "payment_date, payment_reference, notes, updated_by, creator_id, customer_id, warehouse_id, tenant_id) VALUES"
    )
    vals = []
    for r in sal_rows:
        vals.append(
            "({})".format(
                ", ".join(
                    [
                        lit_str(r["id"]),
                        lit_int(r["number_of_items"]),
                        lit_dec(r["total_amount"]),
                        lit_dec(r["discount_amount"]),
                        lit_str(r["invoice_number"]),
                        lit_ts(r["sale_date"]),
                        lit_ts(r["created_at"]),
                        lit_ts(r["updated_at"]),
                        lit_ts(r["due_date"]),
                        lit_int(r["current_status"]),
                        lit_int(r["payment_type"]),
                        lit_str(r["payment_number"]),
                        lit_int(r["payment_status"]),
                        lit_ts(r["payment_date"]),
                        lit_str(r["payment_reference"]),
                        lit_str(r["notes"]),
                        lit_import_user(r["updated_by"]),
                        lit_import_user(r["creator_id"]),
                        lit_str(r["customer_id"]),
                        lit_wh(r["warehouse_id"]),
                        lit_import_tenant(),
                    ]
                )
            )
        )
    lines.append(",\n".join(vals) + ";")
    lines.append("")

    # saledetails
    sd_rows = read_csv("saledetails.csv")
    lines.append(
        "INSERT INTO saledetails (id, sale_id, product_id, supplier_id, unit_price, quantity, "
        "created_at, updated_at, warehouse_id, tenant_id, creator_id) VALUES"
    )
    vals = []
    for r in sd_rows:
        vals.append(
            "({})".format(
                ", ".join(
                    [
                        lit_str(r["id"]),
                        lit_str(r["sale_id"]),
                        lit_str(r["product_id"]),
                        lit_str(r["supplier_id"]),
                        lit_dec(r["unit_price"]),
                        lit_int(r["quantity"]),
                        lit_ts(r["created_at"]),
                        lit_ts(r["updated_at"]),
                        lit_wh(r["warehouse_id"]),
                        lit_import_tenant(),
                        lit_import_user(r["creator_id"]),
                    ]
                )
            )
        )
    lines.append(",\n".join(vals) + ";")
    lines.append("")

    # inventories (omit expiration_date, batch_number, serial_number)
    inv_rows = read_csv("inventories.csv")
    lines.append(
        "INSERT INTO inventories (id, quantity_available, minimum_stock_level, maximum_stock_level, "
        "created_at, updated_at, notes, creator_id, product_id, warehouse_id, tenant_id) VALUES"
    )
    vals = []
    for r in inv_rows:
        vals.append(
            "({})".format(
                ", ".join(
                    [
                        lit_str(r["id"]),
                        lit_int(r["quantity_available"]),
                        lit_int(r["minimum_stock_level"]),
                        lit_int(r["maximum_stock_level"]),
                        lit_ts(r["created_at"]),
                        lit_ts(r["updated_at"]),
                        lit_notes_array(r["notes"]),
                        lit_import_user(r["creator_id"]),
                        lit_str(r["product_id"]),
                        lit_wh(r["warehouse_id"]),
                        lit_import_tenant(),
                    ]
                )
            )
        )
    lines.append(",\n".join(vals) + ";")
    lines.append("")
    lines.append("COMMIT;")

    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
