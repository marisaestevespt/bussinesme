-- Cleanup: remove orphan bulk-generated pending NPS records (no config link, future-only)
DELETE FROM public.client_nps_records
WHERE status = 'por_fazer'
  AND is_manual = false
  AND config_id IS NULL
  AND expected_date > CURRENT_DATE;