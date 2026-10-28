-- Rollback de 20261130000000_vexa_private_read_roles.sql (STO-01): vuelve a la lectura por membresia.
drop policy if exists vexa_private_read_roles on storage.objects;
