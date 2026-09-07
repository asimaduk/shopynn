-- Optional: enable pgcrypto if not already
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO industries (id, name, code, description, product_categorization, created_at, updated_at) VALUES
-- 1. Supermarkets & FMCG Retail
(gen_random_uuid(),
 'Supermarkets & FMCG Retail',
 'SUPERMARKET',
 'Retail of fast-moving consumer goods (food, drinks, toiletries, household items).',
 1,
 NOW(), NOW()),

-- 2. Pharmacies & Health Shops
(gen_random_uuid(),
 'Pharmacies & Health Shops',
 'PHARMACY',
 'Retail of prescription/OTC medicines, supplements, and health products.',
 2,
 NOW(), NOW()),

-- 3. Electronics & Mobile Phones
(gen_random_uuid(),
 'Electronics & Mobile Phones',
 'ELECTRONICS',
 'Retail of phones, computers, TVs, accessories and electronics.',
 3,
 NOW(), NOW()),

-- 4. Fashion & Textiles
(gen_random_uuid(),
 'Fashion & Textiles',
 'FASHION',
 'Clothing, footwear, fabrics and fashion accessories.',
 4,
 NOW(), NOW()),

-- 5. Building Materials & Hardware
(gen_random_uuid(),
 'Building Materials & Hardware',
 'HARDWARE',
 'Cement, iron rods, paints, plumbing & electrical materials.',
 5,
 NOW(), NOW()),

-- 6. Agro Inputs & Farm Supplies
(gen_random_uuid(),
 'Agro Inputs & Farm Supplies',
 'AGRO',
 'Seeds, fertilizers, agrochemicals, farm tools and animal feed.',
 6,
 NOW(), NOW()),

-- 7. Automotive Parts & Tyres
(gen_random_uuid(),
 'Automotive Parts & Tyres',
 'AUTO_PARTS',
 'Spare parts, tyres, batteries, lubricants and car accessories.',
 7,
 NOW(), NOW()),

-- 8. Hospitality (Restaurants, Bars, Hotels)
(gen_random_uuid(),
 'Hospitality (Restaurants, Bars, Hotels)',
 'HOSPITALITY',
 'Food service, drinks, and hotel-related inventory.',
 8,
 NOW(), NOW()),

-- 9. Stationery & Office Supplies
(gen_random_uuid(),
 'Stationery & Office Supplies',
 'STATIONERY',
 'Books, pens, paper, office equipment and school supplies.',
 9,
 NOW(), NOW()),

-- 10. Fuel & Lubricants Retail
(gen_random_uuid(),
 'Fuel & Lubricants Retail',
 'FUEL_RETAIL',
 'Fuel stations and lubricant shops.',
 10,
 NOW(), NOW()),
 
 -- 11. Fire & Safety Equipment
(gen_random_uuid(),
    'Fire & Safety Equipment',
    'FIRE_SAFETY',
    'Sales of fire extinguishers, addressable sounders, red canvas hoses, fire alarms and related safety equipment.',
    11,
    NOW(),
    NOW()
);