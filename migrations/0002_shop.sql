create table if not exists categories (
  id         text primary key,
  label      text not null,
  hint       text not null default '',
  sort_order int not null default 0,
  visible    boolean not null default true
);

create table if not exists products (
  id          text primary key,
  name        text not null,
  subtitle    text not null default '',
  category_id text not null references categories(id),
  price       int not null,
  compare_at  int,
  stock       int not null default 0,
  image       text not null default '/images/cat-stream.jpg',
  delivery    text not null default 'account',
  featured    boolean not null default false,
  flash       boolean not null default false,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create index if not exists products_category_idx on products (category_id);

create table if not exists payments (
  id            text primary key,
  method        text not null,
  amount        int not null,
  fee           int not null default 0,
  credit        int not null,
  status        text not null,
  provider      text not null default 'thunder',
  slip_hash     text unique,
  reject_reason text,
  created_at    timestamptz not null default now()
);

create index if not exists payments_created_idx on payments (created_at desc);

create table if not exists shop_settings (
  id              int primary key default 1 check (id = 1),
  slip_provider   text not null default 'thunder',
  wallet_fee      int not null default 3,
  receive_account text not null default '0928160016',
  receive_name    text not null default 'VELTSHOP',
  wallet_phone    text not null default '0928160016'
);

insert into shop_settings (id) values (1) on conflict (id) do nothing;
