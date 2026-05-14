-- Extensiones necesarias para KAPI Pulse
-- (Idempotente: en Supabase ya vienen instaladas en schema "extensions")
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- Schema dedicado a KAPI Pulse para no colisionar con otros productos
-- alojados en el mismo proyecto Supabase.
create schema if not exists kapi_pulse;
