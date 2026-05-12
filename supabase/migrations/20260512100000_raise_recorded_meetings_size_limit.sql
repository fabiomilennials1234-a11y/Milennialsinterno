-- Raise file_size_limit on recorded-meetings bucket from default (500MB) to 5GB.
-- Root cause: browser recordings at 2.5Mbps produce ~1.1GB for 1h meetings,
-- exceeding the 500MB global default and causing HTTP 413 on TUS upload creation.
UPDATE storage.buckets
SET file_size_limit = 5368709120  -- 5 GB
WHERE id = 'recorded-meetings';
