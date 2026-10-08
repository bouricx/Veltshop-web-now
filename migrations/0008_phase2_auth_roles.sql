-- Phase 2: additive roles, permissions, and profile defaults.
-- Existing email-allowlisted admins remain authorized through requireAdmin.
-- No user, session, account, or existing role rows are deleted or downgraded.

insert into roles (id, name, description) values
  ('super_admin', 'Super Admin', 'Full system access and administrator management'),
  ('staff', 'Staff', 'Limited operational access')
on conflict (id) do nothing;

insert into permissions (id, name, description) values
  ('users.read', 'users.read', 'Read user profiles'),
  ('users.manage', 'users.manage', 'Manage user profiles'),
  ('roles.read', 'roles.read', 'Read roles and permissions'),
  ('roles.manage', 'roles.manage', 'Assign roles and permissions'),
  ('system.manage', 'system.manage', 'Manage system settings and backup operations'),
  ('products.manage', 'products.manage', 'Manage products'),
  ('orders.manage', 'orders.manage', 'Manage orders'),
  ('stock.manage', 'stock.manage', 'Manage stock'),
  ('topups.manage', 'topups.manage', 'Review top-ups'),
  ('gift_codes.manage', 'gift_codes.manage', 'Manage gift codes'),
  ('claims.manage', 'claims.manage', 'Manage claims')
on conflict (id) do nothing;

insert into role_permissions (role_id, permission_id)
select 'super_admin', id from permissions
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select 'admin', id from permissions
where id in (
  'users.read', 'users.manage', 'products.manage', 'orders.manage',
  'stock.manage', 'topups.manage', 'gift_codes.manage', 'claims.manage'
)
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select 'staff', id from permissions
where id in ('products.manage', 'orders.manage', 'stock.manage', 'claims.manage')
on conflict (role_id, permission_id) do nothing;

create index if not exists user_roles_user_idx on user_roles (user_id);
create index if not exists role_permissions_permission_idx on role_permissions (permission_id);
