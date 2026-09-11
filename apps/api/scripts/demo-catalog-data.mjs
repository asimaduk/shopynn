/**
 * Ghana retail demo catalog — realistic SKUs for demos / screenshots.
 * Used by scripts/seed-demo-catalog.mjs
 */

export const DEMO_CATEGORIES = [
	{ key: 'beverages', name: 'Beverages', description: 'Drinks, juices, water, malt' },
	{ key: 'dairy', name: 'Dairy & Milk', description: 'Milk powder, evaporated milk, yogurt' },
	{ key: 'staples', name: 'Staples & Grains', description: 'Rice, oil, flour, pasta' },
	{ key: 'condiments', name: 'Condiments & Seasoning', description: 'Tomato paste, spices, sauces' },
	{ key: 'snacks', name: 'Snacks & Biscuits', description: 'Biscuits, chips, confectionery' },
	{ key: 'household', name: 'Household', description: 'Detergent, soap, cleaning' },
	{ key: 'personal', name: 'Personal Care', description: 'Soap, toothpaste, hygiene' },
	{ key: 'baby', name: 'Baby & Kids', description: 'Diapers and baby care' },
];

/** @type {Array<{ category: string, name: string, sku: string, unit_price: number, actual_cost: number, reorder: number, stock: number, barcode?: string, description?: string }>} */
export const DEMO_PRODUCTS = [
	// Beverages
	{ category: 'beverages', name: 'Voltic Water 750ml', sku: 'VOL-750', unit_price: 4.5, actual_cost: 3.2, reorder: 24, stock: 180, barcode: '6001067001012', description: 'Still mineral water' },
	{ category: 'beverages', name: 'Voltic Water 1.5L', sku: 'VOL-1500', unit_price: 7.0, actual_cost: 5.0, reorder: 20, stock: 96, barcode: '6001067001029', description: 'Still mineral water' },
	{ category: 'beverages', name: 'Bel-Aqua Water 750ml', sku: 'BEL-750', unit_price: 4.0, actual_cost: 2.8, reorder: 24, stock: 140 },
	{ category: 'beverages', name: 'Coca-Cola 500ml', sku: 'COKE-500', unit_price: 6.5, actual_cost: 4.5, reorder: 36, stock: 220 },
	{ category: 'beverages', name: 'Fanta Orange 500ml', sku: 'FANTA-500', unit_price: 6.5, actual_cost: 4.5, reorder: 36, stock: 160 },
	{ category: 'beverages', name: 'Sprite 500ml', sku: 'SPRITE-500', unit_price: 6.5, actual_cost: 4.5, reorder: 24, stock: 90 },
	{ category: 'beverages', name: 'Malta Guinness 330ml', sku: 'MALTA-330', unit_price: 8.0, actual_cost: 5.5, reorder: 24, stock: 110 },
	{ category: 'beverages', name: 'Beta Malt 330ml', sku: 'BETA-330', unit_price: 7.5, actual_cost: 5.2, reorder: 24, stock: 75 },
	{ category: 'beverages', name: 'Alvaro Malt Drink 330ml', sku: 'ALV-330', unit_price: 7.0, actual_cost: 4.8, reorder: 18, stock: 48 },
	{ category: 'beverages', name: 'Sobolo Drink 500ml', sku: 'SOB-500', unit_price: 5.0, actual_cost: 3.0, reorder: 12, stock: 30 },
	{ category: 'beverages', name: 'Kalypso Juice 350ml', sku: 'KAL-350', unit_price: 8.5, actual_cost: 6.0, reorder: 18, stock: 55 },
	{ category: 'beverages', name: 'Tampico Citrus 500ml', sku: 'TAM-500', unit_price: 7.0, actual_cost: 5.0, reorder: 18, stock: 62 },

	// Dairy
	{ category: 'dairy', name: 'Peak Milk Powder 400g', sku: 'PEAK-400', unit_price: 58.0, actual_cost: 48.0, reorder: 10, stock: 42 },
	{ category: 'dairy', name: 'Nido Fortified 400g', sku: 'NIDO-400', unit_price: 62.0, actual_cost: 52.0, reorder: 10, stock: 28 },
	{ category: 'dairy', name: 'Cowbell Milk Powder 400g', sku: 'COW-400', unit_price: 45.0, actual_cost: 36.0, reorder: 12, stock: 50 },
	{ category: 'dairy', name: 'Ideal Evaporated Milk 170g', sku: 'IDL-170', unit_price: 9.5, actual_cost: 7.2, reorder: 36, stock: 200 },
	{ category: 'dairy', name: 'Ideal Evaporated Milk 410g', sku: 'IDL-410', unit_price: 18.0, actual_cost: 14.0, reorder: 24, stock: 86 },
	{ category: 'dairy', name: 'FanYogo Strawberry 125ml', sku: 'FANY-125', unit_price: 5.5, actual_cost: 3.8, reorder: 24, stock: 70 },
	{ category: 'dairy', name: 'FanIce Vanilla Cup', sku: 'FANICE-V', unit_price: 4.0, actual_cost: 2.5, reorder: 30, stock: 95 },
	{ category: 'dairy', name: 'Nestlé Milo 400g', sku: 'MILO-400', unit_price: 55.0, actual_cost: 45.0, reorder: 12, stock: 38, description: 'Chocolate malt drink powder' },
	{ category: 'dairy', name: 'Nestlé Milo 900g', sku: 'MILO-900', unit_price: 110.0, actual_cost: 92.0, reorder: 6, stock: 18 },

	// Staples
	{ category: 'staples', name: 'Royal Aroma Rice 5kg', sku: 'RICE-5KG', unit_price: 95.0, actual_cost: 78.0, reorder: 8, stock: 24 },
	{ category: 'staples', name: 'Royal Aroma Rice 25kg', sku: 'RICE-25KG', unit_price: 420.0, actual_cost: 360.0, reorder: 3, stock: 8 },
	{ category: 'staples', name: 'Frytol Cooking Oil 1L', sku: 'FRY-1L', unit_price: 38.0, actual_cost: 30.0, reorder: 12, stock: 40 },
	{ category: 'staples', name: 'Frytol Cooking Oil 5L', sku: 'FRY-5L', unit_price: 165.0, actual_cost: 140.0, reorder: 4, stock: 12 },
	{ category: 'staples', name: 'Gino Vegetable Oil 1L', sku: 'GINO-OIL-1', unit_price: 36.0, actual_cost: 28.0, reorder: 12, stock: 35 },
	{ category: 'staples', name: 'Indomie Chicken Noodles (Pack of 5)', sku: 'IND-5', unit_price: 18.0, actual_cost: 13.0, reorder: 20, stock: 80 },
	{ category: 'staples', name: 'Obaapa Wheat Flour 1kg', sku: 'FLOUR-1KG', unit_price: 16.0, actual_cost: 12.0, reorder: 15, stock: 45 },
	{ category: 'staples', name: 'Gari White 1kg', sku: 'GARI-1KG', unit_price: 12.0, actual_cost: 8.0, reorder: 15, stock: 60 },
	{ category: 'staples', name: 'Sugar White 1kg', sku: 'SUG-1KG', unit_price: 14.0, actual_cost: 11.0, reorder: 20, stock: 70 },
	{ category: 'staples', name: 'Salt Iodized 500g', sku: 'SALT-500', unit_price: 4.0, actual_cost: 2.5, reorder: 24, stock: 100 },

	// Condiments
	{ category: 'condiments', name: 'Gino Tomato Paste 70g', sku: 'GINO-70', unit_price: 4.5, actual_cost: 3.0, reorder: 48, stock: 240 },
	{ category: 'condiments', name: 'Gino Tomato Paste 400g', sku: 'GINO-400', unit_price: 18.0, actual_cost: 13.5, reorder: 24, stock: 90 },
	{ category: 'condiments', name: 'Gino Tomato Paste 2.2kg', sku: 'GINO-2K', unit_price: 72.0, actual_cost: 58.0, reorder: 6, stock: 14 },
	{ category: 'condiments', name: 'Maggi Cubes Chicken (50s)', sku: 'MAG-50', unit_price: 12.0, actual_cost: 9.0, reorder: 24, stock: 85 },
	{ category: 'condiments', name: 'Royco Cubes Beef (50s)', sku: 'ROY-50', unit_price: 11.0, actual_cost: 8.2, reorder: 24, stock: 70 },
	{ category: 'condiments', name: 'Geisha Sardines in Oil 155g', sku: 'GEI-155', unit_price: 14.0, actual_cost: 10.5, reorder: 24, stock: 64 },
	{ category: 'condiments', name: 'Titus Sardines 125g', sku: 'TIT-125', unit_price: 13.0, actual_cost: 9.8, reorder: 24, stock: 58 },
	{ category: 'condiments', name: 'Bournvita 500g', sku: 'BOU-500', unit_price: 48.0, actual_cost: 38.0, reorder: 8, stock: 22 },

	// Snacks
	{ category: 'snacks', name: 'Digestive Biscuits 400g', sku: 'DIG-400', unit_price: 22.0, actual_cost: 16.0, reorder: 12, stock: 40 },
	{ category: 'snacks', name: 'Cabin Biscuits 400g', sku: 'CAB-400', unit_price: 18.0, actual_cost: 13.0, reorder: 12, stock: 36 },
	{ category: 'snacks', name: 'Tom Tom Candy Pack', sku: 'TOMTOM', unit_price: 3.0, actual_cost: 1.8, reorder: 40, stock: 150 },
	{ category: 'snacks', name: 'Bongo Toffee Pack', sku: 'BONGO', unit_price: 2.5, actual_cost: 1.5, reorder: 40, stock: 120 },
	{ category: 'snacks', name: 'Pringles Original 165g', sku: 'PRIN-165', unit_price: 35.0, actual_cost: 28.0, reorder: 8, stock: 20 },

	// Household
	{ category: 'household', name: 'Omo Detergent 1kg', sku: 'OMO-1KG', unit_price: 32.0, actual_cost: 25.0, reorder: 10, stock: 34 },
	{ category: 'household', name: 'Key Soap Bar 200g', sku: 'KEY-200', unit_price: 6.0, actual_cost: 4.0, reorder: 24, stock: 90 },
	{ category: 'household', name: 'Sunlight Dishwashing Liquid 500ml', sku: 'SUN-500', unit_price: 18.0, actual_cost: 13.0, reorder: 12, stock: 40 },
	{ category: 'household', name: 'Harpic Toilet Cleaner 500ml', sku: 'HAR-500', unit_price: 28.0, actual_cost: 21.0, reorder: 8, stock: 18 },
	{ category: 'household', name: 'Jik Bleach 1L', sku: 'JIK-1L', unit_price: 16.0, actual_cost: 11.0, reorder: 10, stock: 26 },
	{ category: 'household', name: 'Matches Box (10 packs)', sku: 'MATCH-10', unit_price: 5.0, actual_cost: 3.0, reorder: 20, stock: 80 },

	// Personal care
	{ category: 'personal', name: 'Closeup Toothpaste 100ml', sku: 'CLO-100', unit_price: 12.0, actual_cost: 8.5, reorder: 18, stock: 55 },
	{ category: 'personal', name: 'Pepsodent Toothpaste 100ml', sku: 'PEP-100', unit_price: 11.0, actual_cost: 8.0, reorder: 18, stock: 48 },
	{ category: 'personal', name: 'Geisha Soap 225g', sku: 'GEISHA-225', unit_price: 8.0, actual_cost: 5.5, reorder: 24, stock: 72 },
	{ category: 'personal', name: 'Always Sanitary Pads (8s)', sku: 'ALW-8', unit_price: 14.0, actual_cost: 10.0, reorder: 15, stock: 40 },
	{ category: 'personal', name: 'Nivea Body Lotion 200ml', sku: 'NIV-200', unit_price: 35.0, actual_cost: 26.0, reorder: 8, stock: 22 },

	// Baby
	{ category: 'baby', name: 'Softcare Diapers Medium (40s)', sku: 'SOFT-M40', unit_price: 75.0, actual_cost: 58.0, reorder: 6, stock: 16 },
	{ category: 'baby', name: 'Softcare Diapers Large (40s)', sku: 'SOFT-L40', unit_price: 80.0, actual_cost: 62.0, reorder: 6, stock: 12 },
	{ category: 'baby', name: 'Pampers New Baby (20s)', sku: 'PAM-NB20', unit_price: 55.0, actual_cost: 42.0, reorder: 6, stock: 10 },
	{ category: 'baby', name: 'Johnson Baby Oil 200ml', sku: 'JB-OIL', unit_price: 28.0, actual_cost: 20.0, reorder: 8, stock: 18 },

	// Intentional low / out of stock for demo alerts
	{ category: 'beverages', name: 'Club Beer 625ml', sku: 'CLUB-625', unit_price: 12.0, actual_cost: 9.0, reorder: 24, stock: 5, description: 'Near reorder — demo low stock' },
	{ category: 'staples', name: 'Tasty Tom Tomato Mix 70g', sku: 'TT-70', unit_price: 5.0, actual_cost: 3.5, reorder: 36, stock: 0, description: 'Out of stock — demo' },
	{ category: 'household', name: 'Dettol Antiseptic 250ml', sku: 'DET-250', unit_price: 32.0, actual_cost: 24.0, reorder: 10, stock: 3, description: 'Near reorder — demo low stock' },
];
