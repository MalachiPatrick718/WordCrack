-- Align Supabase products table with App Store Connect product IDs
-- Old IDs (wordcrack_premium_*) were placeholders.

begin;

-- Ensure new product IDs exist
insert into public.products (id, type) values
  ('com.wordcrack.premium.month','subscription'),
  ('com.wordcrack.premium.annual','subscription')
on conflict (id) do nothing;

-- If you previously tested with placeholder IDs, map purchases over.
update public.purchases
set product_id = 'com.wordcrack.premium.month'
where product_id = 'wordcrack_premium_monthly';

update public.purchases
set product_id = 'com.wordcrack.premium.annual'
where product_id = 'wordcrack_premium_annual';

-- Optional: keep placeholders around (harmless), but you can remove them if unused.
-- delete from public.products where id in ('wordcrack_premium_monthly','wordcrack_premium_annual');

commit;

