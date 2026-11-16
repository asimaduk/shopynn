import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	isOverviewPending,
	overviewDonePayload,
	readTourPreferences,
	tourCompletedPayload
} from './tourPreferences';

describe('tourPreferences', () => {
	it('treats missing overview as pending', () => {
		assert.equal(isOverviewPending({}), true);
		assert.equal(isOverviewPending({ overviewStatus: 'pending' }), true);
		assert.equal(isOverviewPending({ overviewStatus: 'completed' }), false);
		assert.equal(isOverviewPending({ overviewStatus: 'skipped' }), false);
	});

	it('reads nested tour prefs from preferences payload', () => {
		const prefs = readTourPreferences({
			tour: {
				overviewStatus: 'completed',
				completed: { overview: '2026-01-01T00:00:00.000Z', sales: '2026-01-02T00:00:00.000Z' }
			}
		});
		assert.equal(prefs.overviewStatus, 'completed');
		assert.equal(prefs.completed?.sales, '2026-01-02T00:00:00.000Z');
	});

	it('builds skip and complete payloads without wiping other keys', () => {
		assert.deepEqual(overviewDonePayload('skipped'), { tour: { overviewStatus: 'skipped' } });
		const done = overviewDonePayload('completed');
		assert.equal(done.tour.overviewStatus, 'completed');
		assert.ok(done.tour.completed?.overview);

		const sales = tourCompletedPayload('sales');
		assert.ok(sales.tour.completed?.sales);
		assert.equal((sales.tour as { overviewStatus?: string }).overviewStatus, undefined);
	});
});
