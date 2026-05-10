DELETE FROM product_costs
WHERE COALESCE(NULLIF(TRIM(cost_name), ''), '') = ''
  AND COALESCE(cost_value, 0) = 0
  AND COALESCE(hours, 0) = 0
  AND COALESCE(hourly_rate, 0) = 0;