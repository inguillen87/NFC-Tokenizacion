ALTER TABLE carrier_profiles
  DROP CONSTRAINT IF EXISTS carrier_profiles_family_check;

ALTER TABLE carrier_profiles
  ADD CONSTRAINT carrier_profiles_family_check
  CHECK (family IN ('qr', 'gs1', 'nfc', 'rfid', 'iot'));
