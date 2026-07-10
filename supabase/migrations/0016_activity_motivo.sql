-- El formulario de "sugerir actividad eventual" pide nombre + motivo, pero
-- activities no tenía columna para el motivo (solo activity_corrections la
-- tiene). Nullable: solo se usa cuando una colaboradora sugiere.
alter table public.activities add column motivo text;
