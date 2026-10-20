const toNum = (v) => Number(String(v ?? 0).replace(/,/g, '')) || 0;

/** 'full' when returns cover the sale total, 'partial' when some value was returned, else null. */
export function saleReturnState(totalAmount, returnedAmount) {
    const returned = toNum(returnedAmount);
    if (returned <= 0.02) return null;
    return returned >= toNum(totalAmount) - 0.02 ? 'full' : 'partial';
}
