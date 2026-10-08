alter table payments drop constraint if exists payments_slip_hash_key;

create unique index if not exists payments_slip_success_hash_idx
  on payments (slip_hash)
  where status = 'success' and slip_hash is not null;
