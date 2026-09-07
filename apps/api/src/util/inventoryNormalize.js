import { toNum } from "./productNormalize.js";

/** Inventory list rows joined with products (`getAllInventoriesService`). */
export function normalizeInventoryListRow(row) {
    if (!row || typeof row !== "object") return row;
    return {
        ...row,
        inventory: toNum(row.inventory, { defaultValue: 0 }),
        minimum: toNum(row.minimum, { defaultValue: 0 }),
        unit_price: row.unit_price != null && row.unit_price !== "" ? toNum(row.unit_price, { defaultValue: null }) : null,
        alt_price: row.alt_price != null && row.alt_price !== "" ? toNum(row.alt_price, { defaultValue: null }) : null,
    };
}
