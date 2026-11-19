-- O acesso é feito apenas pelo backend autorizado do painel.
create table if not exists public.transcricoes (
  id bigint generated always as identity primary key,
  criado_em timestamptz not null default now(),
  usuario text not null,
  nome_arquivo text not null,
  referencia text not null default '',
  metadados jsonb not null default '{}'::jsonb,
  texto text not null
);
alter table public.transcricoes enable row level security;
revoke all on public.transcricoes from anon, authenticated;
grant select, insert on public.transcricoes to service_role;
grant usage, select on sequence public.transcricoes_id_seq to service_role;
create index if not exists transcricoes_usuario_criado_em_idx on public.transcricoes (usuario, criado_em desc);
create index if not exists transcricoes_criado_em_idx on public.transcricoes (criado_em desc);
