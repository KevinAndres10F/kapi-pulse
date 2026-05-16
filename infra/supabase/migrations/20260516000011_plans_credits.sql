-- ============== Plans & Credits Economy (schema kapi_pulse) ==============

create table kapi_pulse.plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  monthly_credits int not null default 0,
  bonus_credits int not null default 0,
  price_cents int not null default 0,
  features jsonb default '{}'::jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

insert into kapi_pulse.plans (code, name, monthly_credits, bonus_credits, price_cents) values
  ('free',    'Free',    100, 200, 0),
  ('starter', 'Starter', 1500, 0, 1900),
  ('pro',     'Pro',     6000, 0, 4900);

alter table kapi_pulse.organizations
  add column if not exists plan_id uuid references kapi_pulse.plans(id) on delete set null;

create table kapi_pulse.organization_credits (
  organization_id uuid primary key references kapi_pulse.organizations(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  total_granted int not null default 0,
  total_consumed int not null default 0,
  last_reset_at timestamptz default now(),
  updated_at timestamptz default now()
);

create type kapi_pulse.credit_tx_type as enum (
  'grant', 'consume', 'refund', 'plan_renewal', 'admin_adjust'
);

create table kapi_pulse.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references kapi_pulse.organizations(id) on delete cascade,
  type kapi_pulse.credit_tx_type not null,
  amount int not null,
  balance_after int not null,
  reason text,
  reference_type text,
  reference_id uuid,
  metadata jsonb default '{}'::jsonb,
  created_by uuid references kapi_pulse.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_kp_credit_tx_org_created
  on kapi_pulse.credit_transactions(organization_id, created_at desc);

-- ============== RPC: deduct_credits (atomic, FOR UPDATE lock) ==============
create or replace function kapi_pulse.deduct_credits(
  p_org_id uuid,
  p_amount int,
  p_reason text,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns kapi_pulse.credit_transactions
language plpgsql
security definer
set search_path = kapi_pulse, public
as $$
declare
  v_balance int;
  v_tx kapi_pulse.credit_transactions;
  v_user uuid := auth.uid();
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  select balance into v_balance
  from kapi_pulse.organization_credits
  where organization_id = p_org_id
  for update;

  if v_balance is null then
    raise exception 'org has no credit ledger' using errcode = '02000';
  end if;

  if v_balance < p_amount then
    raise exception 'insufficient credits: balance=% requested=%', v_balance, p_amount
      using errcode = '23514';
  end if;

  update kapi_pulse.organization_credits
    set balance = balance - p_amount,
        total_consumed = total_consumed + p_amount,
        updated_at = now()
    where organization_id = p_org_id;

  insert into kapi_pulse.credit_transactions
    (organization_id, type, amount, balance_after, reason, reference_type, reference_id, metadata, created_by)
  values
    (p_org_id, 'consume', -p_amount, v_balance - p_amount, p_reason, p_reference_type, p_reference_id, p_metadata, v_user)
  returning * into v_tx;

  return v_tx;
end;
$$;

create or replace function kapi_pulse.refund_credits(
  p_org_id uuid,
  p_amount int,
  p_reason text,
  p_reference_id uuid default null
) returns kapi_pulse.credit_transactions
language plpgsql security definer
set search_path = kapi_pulse, public
as $$
declare
  v_balance int;
  v_tx kapi_pulse.credit_transactions;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  update kapi_pulse.organization_credits
    set balance = balance + p_amount,
        total_consumed = greatest(0, total_consumed - p_amount),
        updated_at = now()
    where organization_id = p_org_id
    returning balance into v_balance;

  if v_balance is null then
    raise exception 'org has no credit ledger' using errcode = '02000';
  end if;

  insert into kapi_pulse.credit_transactions
    (organization_id, type, amount, balance_after, reason, reference_type, reference_id)
  values
    (p_org_id, 'refund', p_amount, v_balance, p_reason, 'generation_job', p_reference_id)
  returning * into v_tx;

  return v_tx;
end;
$$;

create or replace function kapi_pulse.grant_credits(
  p_org_id uuid,
  p_amount int,
  p_reason text,
  p_type kapi_pulse.credit_tx_type default 'grant'
) returns kapi_pulse.credit_transactions
language plpgsql security definer
set search_path = kapi_pulse, public
as $$
declare
  v_balance int;
  v_tx kapi_pulse.credit_transactions;
begin
  insert into kapi_pulse.organization_credits (organization_id, balance, total_granted)
  values (p_org_id, p_amount, p_amount)
  on conflict (organization_id) do update
    set balance = kapi_pulse.organization_credits.balance + p_amount,
        total_granted = kapi_pulse.organization_credits.total_granted + p_amount,
        updated_at = now()
  returning balance into v_balance;

  insert into kapi_pulse.credit_transactions
    (organization_id, type, amount, balance_after, reason)
  values (p_org_id, p_type, p_amount, v_balance, p_reason)
  returning * into v_tx;

  return v_tx;
end;
$$;

-- ============== Trigger: bootstrap credits when org is created ==============
create or replace function kapi_pulse.bootstrap_org_credits()
returns trigger language plpgsql security definer
set search_path = kapi_pulse, public
as $$
declare
  v_plan kapi_pulse.plans;
begin
  select * into v_plan from kapi_pulse.plans where code = 'free' limit 1;
  if v_plan.id is null then
    return new;
  end if;

  update kapi_pulse.organizations
    set plan_id = v_plan.id
    where id = new.id and plan_id is null;

  perform kapi_pulse.grant_credits(
    new.id,
    v_plan.bonus_credits + v_plan.monthly_credits,
    'initial_grant'
  );

  return new;
end;
$$;

drop trigger if exists trg_kp_bootstrap_org_credits on kapi_pulse.organizations;
create trigger trg_kp_bootstrap_org_credits
  after insert on kapi_pulse.organizations
  for each row execute function kapi_pulse.bootstrap_org_credits();

-- ============== RLS ==============
alter table kapi_pulse.plans enable row level security;
alter table kapi_pulse.organization_credits enable row level security;
alter table kapi_pulse.credit_transactions enable row level security;

create policy "todos los autenticados ven plans" on kapi_pulse.plans
  for select using (auth.uid() is not null);

create policy "miembros ven balance de su org" on kapi_pulse.organization_credits
  for select using (kapi_pulse.is_member_of(organization_id));

create policy "miembros ven transacciones de su org" on kapi_pulse.credit_transactions
  for select using (kapi_pulse.is_member_of(organization_id));

-- ============== Grants ==============
grant execute on function kapi_pulse.deduct_credits(uuid, int, text, text, uuid, jsonb) to authenticated, service_role;
grant execute on function kapi_pulse.refund_credits(uuid, int, text, uuid) to service_role;
grant execute on function kapi_pulse.grant_credits(uuid, int, text, kapi_pulse.credit_tx_type) to service_role;
