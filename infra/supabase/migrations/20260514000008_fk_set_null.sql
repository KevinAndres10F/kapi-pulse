-- ============== FK on user delete → set null ==============
-- Permite eliminar un user en auth.users sin perder las cuentas / posts /
-- invitaciones que creó. El historial queda con creator nulo en vez de
-- bloquear la operación.

alter table kapi_pulse.social_accounts
  drop constraint social_accounts_connected_by_fkey,
  add constraint social_accounts_connected_by_fkey
    foreign key (connected_by) references kapi_pulse.profiles(id) on delete set null;

alter table kapi_pulse.posts
  drop constraint posts_created_by_fkey,
  add constraint posts_created_by_fkey
    foreign key (created_by) references kapi_pulse.profiles(id) on delete set null;

alter table kapi_pulse.invitations
  drop constraint invitations_invited_by_fkey,
  add constraint invitations_invited_by_fkey
    foreign key (invited_by) references kapi_pulse.profiles(id) on delete set null;
