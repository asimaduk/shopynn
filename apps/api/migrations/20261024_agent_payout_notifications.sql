-- Last payout status the agent was emailed about, so the approve response and the Paystack
-- webhook reporting the same outcome only send one email.
ALTER TABLE merchant_payouts ADD COLUMN IF NOT EXISTS notified_status varchar(32);
