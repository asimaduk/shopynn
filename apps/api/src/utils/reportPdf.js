/**
 * Branded PDF for mobile/web report exports (PDFKit).
 * Layout: header band, meta strip, summary card grid, detail table, page footers.
 */

const THEME = '#0A74DA';
const THEME_DARK = '#0B4F8A';
const INK = '#0F172A';
const MUTED = '#64748B';
const LINE = '#E2E8F0';
const SURFACE = '#F8FAFC';
const WHITE = '#FFFFFF';

const MARGIN = 42;
const PAGE_BOTTOM = 56;

function safeText(value) {
	if (value == null || value === '') return '—';
	if (typeof value === 'number' && Number.isFinite(value)) {
		return Number.isInteger(value)
			? String(value)
			: value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}
	const raw = String(value).trim();
	if (!raw) return '—';
	// Already-formatted currency / counts — keep as-is
	return raw;
}

function humanizeKey(key) {
	return String(key || '')
		.replace(/_/g, ' ')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\b\w/g, (c) => c.toUpperCase());
}

function isLikelyNumericColumn(key, rows) {
	const k = String(key || '').toLowerCase();
	if (
		/(amount|total|sales|price|value|cogs|spend|balance|revenue|profit|qty|quantity|count|units|orders)/.test(
			k
		)
	) {
		return true;
	}
	let numericHits = 0;
	let samples = 0;
	for (const row of rows.slice(0, 12)) {
		const v = row?.[key];
		if (v == null || v === '') continue;
		samples += 1;
		if (typeof v === 'number' && Number.isFinite(v)) numericHits += 1;
		else if (/^(GHS|GH₵|\$|€)?\s*-?[\d,]+(\.\d+)?%?$/i.test(String(v).trim())) numericHits += 1;
	}
	return samples > 0 && numericHits / samples >= 0.7;
}

function columnWeights(columns, rows) {
	return columns.map((key) => {
		const k = String(key).toLowerCase();
		if (/(name|customer|staff|item|product|description|supplier)/.test(k)) return 2.4;
		if (isLikelyNumericColumn(key, rows)) return 1.15;
		if (/(date|period|sku|ref)/.test(k)) return 1.3;
		return 1.5;
	});
}

function fillStrokeRoundRect(doc, x, y, w, h, r, fill, stroke = LINE) {
	doc.roundedRect(x, y, w, h, r).lineWidth(1).fillAndStroke(fill, stroke);
}

/**
 * @param {{
 *   title?: string,
 *   companyName?: string,
 *   dateRangeLabel?: string,
 *   cards?: Array<{ label?: string, value?: unknown, color?: string }>,
 *   rows?: Array<Record<string, unknown>>,
 * }} payload
 * @returns {Promise<Buffer>}
 */
export async function buildReportPdfBuffer(payload = {}) {
	const PDFDocument = (await import('pdfkit')).default;
	const title = String(payload.title || 'Report').trim() || 'Report';
	const companyName = String(payload.companyName || 'Shopynn').trim() || 'Shopynn';
	const dateRangeLabel = String(payload.dateRangeLabel || 'All time').trim() || 'All time';
	const cards = Array.isArray(payload.cards) ? payload.cards.slice(0, 8) : [];
	const rows = Array.isArray(payload.rows) ? payload.rows : [];
	const exportedAt = new Date().toLocaleString('en-GB', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});

	const columns =
		rows.length > 0
			? Object.keys(rows[0]).filter((k) => k !== '_raw' && k !== 'id')
			: [];
	const numericCols = new Set(columns.filter((c) => isLikelyNumericColumn(c, rows)));
	const weights = columnWeights(columns, rows);
	const weightSum = weights.reduce((a, b) => a + b, 0) || 1;

	return new Promise((resolve, reject) => {
		const doc = new PDFDocument({
			margin: MARGIN,
			size: 'A4',
			bufferPages: true,
			info: {
				Title: `${title} — ${companyName}`,
				Author: 'Shopynn',
				Creator: 'Shopynn Reports',
			},
		});
		const chunks = [];
		doc.on('data', (chunk) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);

		const pageWidth = doc.page.width;
		const contentWidth = pageWidth - MARGIN * 2;
		const contentLeft = MARGIN;

		const drawHeaderBand = (isFirstPage) => {
			// Top accent bar
			doc.rect(0, 0, pageWidth, 6).fill(THEME);

			if (isFirstPage) {
				// Hero band
				doc.rect(0, 6, pageWidth, 78).fill(THEME_DARK);
				doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(11);
				doc.text('SHOPYNN', contentLeft, 18, { width: contentWidth, align: 'left' });
				doc.font('Helvetica').fontSize(8).fillColor('#BFDBFE');
				doc.text('Business intelligence report', contentLeft, 34, {
					width: contentWidth * 0.55,
				});

				doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(18);
				doc.text(companyName, contentLeft, 50, {
					width: contentWidth * 0.62,
					ellipsis: true,
				});

				// Right meta block on hero
				doc.font('Helvetica').fontSize(8).fillColor('#BFDBFE');
				doc.text('REPORT', contentLeft + contentWidth * 0.62, 22, {
					width: contentWidth * 0.38,
					align: 'right',
				});
				doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE);
				doc.text(title, contentLeft + contentWidth * 0.55, 36, {
					width: contentWidth * 0.45,
					align: 'right',
					ellipsis: true,
				});
				return 100;
			}

			// Continuation pages — slim header
			doc.rect(0, 6, pageWidth, 36).fill(SURFACE);
			doc.fillColor(THEME_DARK).font('Helvetica-Bold').fontSize(10);
			doc.text(companyName, contentLeft, 16, { width: contentWidth * 0.5, ellipsis: true });
			doc.font('Helvetica').fontSize(9).fillColor(MUTED);
			doc.text(title, contentLeft + contentWidth * 0.45, 16, {
				width: contentWidth * 0.55,
				align: 'right',
				ellipsis: true,
			});
			doc.moveTo(contentLeft, 42).lineTo(contentLeft + contentWidth, 42).strokeColor(LINE).lineWidth(1).stroke();
			return 52;
		};

		let y = drawHeaderBand(true);

		// Title + meta strip
		y += 14;
		doc.fillColor(INK).font('Helvetica-Bold').fontSize(20);
		doc.text(title, contentLeft, y, { width: contentWidth });
		y = doc.y + 10;

		const metaItems = [
			{ label: 'Period', value: dateRangeLabel },
			{ label: 'Exported', value: exportedAt },
			{ label: 'Records', value: String(rows.length) },
		];
		const metaGap = 8;
		const metaW = (contentWidth - metaGap * (metaItems.length - 1)) / metaItems.length;
		metaItems.forEach((item, i) => {
			const x = contentLeft + i * (metaW + metaGap);
			fillStrokeRoundRect(doc, x, y, metaW, 38, 8, SURFACE);
			doc.fillColor(MUTED).font('Helvetica').fontSize(7.5);
			doc.text(item.label.toUpperCase(), x + 10, y + 8, { width: metaW - 20 });
			doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5);
			doc.text(item.value, x + 10, y + 20, { width: metaW - 20, ellipsis: true });
		});
		y += 52;

		// Summary cards grid
		if (cards.length) {
			doc.fillColor(THEME_DARK).font('Helvetica-Bold').fontSize(11);
			doc.text('Summary', contentLeft, y);
			y += 18;

			const cols = cards.length === 1 ? 1 : cards.length === 3 ? 3 : 2;
			const gap = 10;
			const cardW = (contentWidth - gap * (cols - 1)) / cols;
			const cardH = 58;

			cards.forEach((card, i) => {
				const col = i % cols;
				const row = Math.floor(i / cols);
				const x = contentLeft + col * (cardW + gap);
				const cy = y + row * (cardH + gap);
				const accent = String(card.color || THEME);

				fillStrokeRoundRect(doc, x, cy, cardW, cardH, 8, WHITE);
				doc.rect(x, cy, 4, cardH).fill(accent);

				doc.fillColor(MUTED).font('Helvetica').fontSize(8);
				doc.text(String(card.label || 'Metric').toUpperCase(), x + 14, cy + 12, {
					width: cardW - 24,
					ellipsis: true,
				});
				doc.fillColor(INK).font('Helvetica-Bold').fontSize(13);
				doc.text(safeText(card.value), x + 14, cy + 28, {
					width: cardW - 24,
					ellipsis: true,
				});
			});

			const rowsUsed = Math.ceil(cards.length / cols);
			y += rowsUsed * (cardH + gap) + 8;
		}

		// Details table
		if (columns.length && rows.length) {
			if (y > doc.page.height - 140) {
				doc.addPage();
				y = drawHeaderBand(false) + 12;
			}

			doc.fillColor(THEME_DARK).font('Helvetica-Bold').fontSize(11);
			doc.text('Details', contentLeft, y);
			y += 16;

			const colWidths = weights.map((w) => (w / weightSum) * contentWidth);
			const rowH = 18;
			const headerH = 24;

			const drawTableHeader = (top) => {
				doc.roundedRect(contentLeft, top, contentWidth, headerH, 6).fill(THEME);
				// Cover bottom radius so body connects cleanly
				doc.rect(contentLeft, top + headerH - 6, contentWidth, 6).fill(THEME);

				doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(7.5);
				let x = contentLeft;
				columns.forEach((key, i) => {
					const align = numericCols.has(key) ? 'right' : 'left';
					doc.text(humanizeKey(key), x + 6, top + 8, {
						width: colWidths[i] - 12,
						align,
						ellipsis: true,
					});
					x += colWidths[i];
				});
				return top + headerH;
			};

			y = drawTableHeader(y);
			doc.font('Helvetica').fontSize(8);

			rows.forEach((row, rowIndex) => {
				if (y + rowH > doc.page.height - PAGE_BOTTOM) {
					doc.addPage();
					y = drawHeaderBand(false) + 12;
					doc.fillColor(THEME_DARK).font('Helvetica-Bold').fontSize(11);
					doc.text('Details (continued)', contentLeft, y);
					y += 16;
					y = drawTableHeader(y);
					doc.font('Helvetica').fontSize(8);
				}

				const bg = rowIndex % 2 === 1 ? SURFACE : WHITE;
				doc.rect(contentLeft, y, contentWidth, rowH).fill(bg);

				let x = contentLeft;
				columns.forEach((key, i) => {
					const align = numericCols.has(key) ? 'right' : 'left';
					doc.fillColor(INK).text(safeText(row[key]), x + 6, y + 5, {
						width: colWidths[i] - 12,
						align,
						ellipsis: true,
						lineBreak: false,
					});
					x += colWidths[i];
				});
				y += rowH;
			});

			// Table bottom border
			doc.moveTo(contentLeft, y).lineTo(contentLeft + contentWidth, y).strokeColor(LINE).lineWidth(1).stroke();
			y += 12;
		} else if (!rows.length) {
			fillStrokeRoundRect(doc, contentLeft, y, contentWidth, 48, 8, SURFACE);
			doc.fillColor(MUTED).font('Helvetica').fontSize(10);
			doc.text('No detail rows for this period.', contentLeft, y + 18, {
				width: contentWidth,
				align: 'center',
			});
		}

		// Page numbers + footer on every page
		const range = doc.bufferedPageRange();
		for (let i = 0; i < range.count; i++) {
			doc.switchToPage(range.start + i);
			const footerY = doc.page.height - 36;
			doc.moveTo(MARGIN, footerY - 8)
				.lineTo(pageWidth - MARGIN, footerY - 8)
				.strokeColor(LINE)
				.lineWidth(0.8)
				.stroke();
			doc.fillColor(MUTED).font('Helvetica').fontSize(8);
			doc.text('Generated by Shopynn', MARGIN, footerY, {
				width: contentWidth * 0.5,
				align: 'left',
			});
			doc.text(`Page ${i + 1} of ${range.count}`, MARGIN + contentWidth * 0.5, footerY, {
				width: contentWidth * 0.5,
				align: 'right',
			});
		}

		doc.end();
	});
}
