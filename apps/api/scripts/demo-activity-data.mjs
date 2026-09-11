/** Demo partners + expense templates for seed-demo-catalog activity. */

export const DEMO_CUSTOMERS = [
	{ name: 'Ama Mensah', phone: '233244100001', email: 'ama.mensah@example.com', address: 'Osu, Accra', customer_group: 'Retail' },
	{ name: 'Kwame Boateng', phone: '233244100002', email: 'kwame.b@example.com', address: 'Adum, Kumasi', customer_group: 'Wholesale' },
	{ name: 'Akosua Darko', phone: '233244100003', email: 'akosua.d@example.com', address: 'Takoradi Market Circle', customer_group: 'Retail' },
	{ name: 'Yaw Asante', phone: '233244100004', email: 'yaw.asante@example.com', address: 'Madina, Accra', customer_group: 'Wholesale' },
	{ name: 'Efua Owusu', phone: '233244100005', email: 'efua.o@example.com', address: 'Spintex Road', customer_group: 'Retail' },
	{ name: 'Kofi Adjei', phone: '233244100006', email: 'kofi.adjei@example.com', address: 'Tema Community 1', customer_group: 'Retail' },
	{ name: 'Abena Serwaa', phone: '233244100007', email: 'abena.s@example.com', address: 'East Legon', customer_group: 'Retail' },
	{ name: 'Kojo Mensah Trading', phone: '233244100008', email: 'kojo.trading@example.com', address: 'Kaneshie', customer_group: 'Wholesale' },
	{ name: 'Walk-In Customer', phone: null, email: null, address: 'In-store', customer_group: 'Walk-In' },
	{ name: 'Nana Yaa Boutique', phone: '233244100010', email: 'nanayaa@example.com', address: 'Cape Coast', customer_group: 'Retail' },
	{ name: 'Bright Foods Ltd', phone: '233244100011', email: 'bright.foods@example.com', address: 'Industrial Area', customer_group: 'Wholesale' },
	{ name: 'Sister Akua Shop', phone: '233244100012', email: null, address: 'Kasoa', customer_group: 'Retail' },
];

export const DEMO_SUPPLIERS = [
	{ name: 'Nestlé Ghana Distributors', manager: 'Joseph Mensah', phone: '233302100001', address: 'Tema Free Zones' },
	{ name: 'Unilever Ghana Wholesale', manager: 'Patricia Owusu', phone: '233302100002', address: 'North Industrial Area' },
	{ name: 'PZ Cussons Depot', manager: 'Ibrahim Fuseini', phone: '233302100003', address: 'Spintex' },
	{ name: 'Accra Cold Chain Supply', manager: 'Grace Addo', phone: '233302100004', address: 'Agbogbloshie' },
	{ name: 'Voltic / Bel-Aqua Agents', manager: 'Daniel Tetteh', phone: '233302100005', address: 'Kasoa Depot' },
	{ name: 'Local Market Provisions', manager: 'Auntie Mansa', phone: '233302100006', address: 'Makola' },
];

export const DEMO_EXPENSE_TEMPLATES = [
	{ category: 'Utilities', description: 'Electricity bill (ECG)', amount: [180, 420], payment_method: 'MoMo' },
	{ category: 'Utilities', description: 'Water bill', amount: [40, 120], payment_method: 'Cash' },
	{ category: 'Rent', description: 'Shop rent', amount: [800, 1500], payment_method: 'Bank Transfer' },
	{ category: 'Transport', description: 'Goods delivery / fuel', amount: [50, 200], payment_method: 'Cash' },
	{ category: 'Salaries', description: 'Staff wages (partial)', amount: [300, 900], payment_method: 'MoMo' },
	{ category: 'Maintenance', description: 'Shop repairs / cleaning', amount: [30, 150], payment_method: 'Cash' },
	{ category: 'Marketing', description: 'Flyers / WhatsApp boost', amount: [20, 80], payment_method: 'MoMo' },
	{ category: 'Supplies', description: 'Packaging / carrier bags', amount: [25, 100], payment_method: 'Cash' },
	{ category: 'Internet', description: 'Data / Wi‑Fi for POS', amount: [40, 90], payment_method: 'MoMo' },
];
