-- Agent accounts and agent-onboarded shops were saved with the phone as typed (0XXXXXXXXX);
-- everything else uses 233XXXXXXXXX. Convert them, skipping any number whose 233 form is already taken.

UPDATE users u
SET phone = '233' || substr(regexp_replace(u.phone, '\D', '', 'g'), 2), updated_at = now()
WHERE EXISTS (SELECT 1 FROM merchants m WHERE m.user_id = u.id)
  AND regexp_replace(u.phone, '\D', '', 'g') ~ '^0[0-9]{9}$'
  AND NOT EXISTS (
      SELECT 1 FROM users o
      WHERE o.phone = '233' || substr(regexp_replace(u.phone, '\D', '', 'g'), 2)
  );

UPDATE tenants t
SET phone = '233' || substr(regexp_replace(t.phone, '\D', '', 'g'), 2), updated_at = now()
WHERE (t.onboarded_by_merchant_id IS NOT NULL OR t.serving_merchant_id IS NOT NULL)
  AND regexp_replace(t.phone, '\D', '', 'g') ~ '^0[0-9]{9}$'
  AND NOT EXISTS (
      SELECT 1 FROM tenants o
      WHERE o.phone = '233' || substr(regexp_replace(t.phone, '\D', '', 'g'), 2)
  );
