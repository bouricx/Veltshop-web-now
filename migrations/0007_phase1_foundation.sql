-- Phase 1 foundation: additive commerce, wallet, authorization, and audit records.
-- No existing rows are deleted or rewritten. User ids remain TEXT so this works
-- with Better Auth and the preview dev user.

create table if not exists roles (
  id          text primary key,
  name        text not null unique,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists permissions (
  id          text primary key,
  name        text not null unique,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists role_permissions (
  role_id       text not null references roles(id) on delete cascade,
  permission_id text not null references permissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table if not exists user_roles (
  user_id    text not null,
  role_id    text not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table if not exists orders (
  id           text primary key,
  user_id      text not null,
  status       text not null default 'pending',
  subtotal     int not null default 0,
  total        int not null default 0,
  currency     text not null default 'THB',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists orders_user_created_idx on orders (user_id, created_at desc);
create index if not exists orders_status_created_idx on orders (status, created_at desc);

create table if not exists order_items (
  id           text primary key,
  order_id     text not null references orders(id) on delete cascade,
  product_id   text not null references products(id),
  product_name text not null,
  unit_price   int not null,
  quantity     int not null check (quantity > 0),
  line_total   int not null,
  created_at   timestamptz not null default now()
);

create index if not exists order_items_order_idx on order_items (order_id);

create table if not exists inventory_movements (
  id          text primary key,
  product_id  text not null references products(id),
  order_id    text references orders(id),
  quantity    int not null check (quantity <> 0),
  reason      text not null,
  actor_id    text,
  created_at  timestamptz not null default now()
);

create index if not exists inventory_movements_product_created_idx
  on inventory_movements (product_id, created_at desc);

create table if not exists wallet_accounts (
  user_id     text primary key,
  balance     int not null default 0 check (balance >= 0),
  currency    text not null default 'THB',
  updated_at  timestamptz not null default now()
);

create table if not exists wallet_ledger (
  id             text primary key,
  user_id        text not null,
  payment_id     text references payments(id),
  order_id       text references orders(id),
  amount         int not null check (amount <> 0),
  balance_after  int not null check (balance_after >= 0),
  reason         text not null,
  actor_id       text,
  created_at     timestamptz not null default now()
);

create index if not exists wallet_ledger_user_created_idx
  on wallet_ledger (user_id, created_at desc);

create table if not exists transactions (
  id             text primary key,
  user_id        text,
  order_id       text references orders(id),
  payment_id     text references payments(id),
  kind           text not null,
  status         text not null default 'pending',
  amount         int not null default 0,
  currency       text not null default 'THB',
  provider       text,
  provider_ref   text,
  error_message  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists transactions_status_created_idx
  on transactions (status, created_at desc);
create unique index if not exists transactions_provider_ref_idx
  on transactions (provider, provider_ref)
  where provider is not null and provider_ref is not null;

create table if not exists audit_logs (
  id          text primary key,
  actor_id    text,
  action      text not null,
  entity_type text not null,
  entity_id   text,
  metadata    text not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists audit_logs_entity_created_idx
  on audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_created_idx
  on audit_logs (actor_id, created_at desc);

insert into roles (id, name, description)
values ('admin', 'admin', 'Administrative access')
on conflict (id) do nothing;

insert into roles (id, name, description)
values ('customer', 'customer', 'Standard customer access')
on conflict (id) do nothing;

insert into permissions (id, name, description) values
  ('catalog.read', 'catalog.read', 'Read catalog data'),
  ('catalog.manage', 'catalog.manage', 'Create and update catalog data'),
  ('orders.read', 'orders.read', 'Read order data'),
  ('orders.manage', 'orders.manage', 'Manage order state'),
  ('wallet.manage', 'wallet.manage', 'Manage wallet ledger entries'),
  ('audit.read', 'audit.read', 'Read audit logs')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
select 'admin', id from permissions
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
values ('customer', 'catalog.read')
on conflict (role_id, permission_id) do nothing;
