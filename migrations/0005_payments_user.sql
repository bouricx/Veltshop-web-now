alter table payments add column if not exists user_id text;
create index if not exists payments_user_created_idx on payments (user_id, created_at desc);
