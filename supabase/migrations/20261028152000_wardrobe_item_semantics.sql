alter table public.wardrobe_items
  add column if not exists semantics jsonb not null default '{}'::jsonb;

alter table public.wardrobe_items
  drop constraint if exists wardrobe_items_semantics_object;

alter table public.wardrobe_items
  add constraint wardrobe_items_semantics_object
  check (jsonb_typeof(semantics) = 'object');

comment on column public.wardrobe_items.semantics is
  'Normalized visual garment semantics used by outfit constraints and ranking.';
