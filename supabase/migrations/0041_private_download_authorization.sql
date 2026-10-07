-- Private downloads must recheck the current membership on every request.
-- A bearer download URL bypasses subsequent membership revocation until expiry.
-- Keep signed UPLOAD admission and authenticated downloads/listing unchanged.
-- Existing signed URLs are not invalidated by this policy: deployment requires
-- an explicit expiry/invalidation transition before claiming immediate revocation.
begin;

do $$
begin
  if to_regprocedure('storage.allow_any_operation(text[])') is null then
    raise exception 'Storage operation-aware authorization is required';
  end if;
end;
$$;

create policy private_download_requires_current_session
on storage.objects as restrictive
for select to authenticated
using (
  bucket_id <> 'vexa-private'
  or not storage.allow_any_operation(array[
    'object.sign',
    'object.sign_many',
    'render.image_sign'
  ])
);

comment on policy private_download_requires_current_session on storage.objects is
  'Private bytes require authenticated reads; deny reusable download grants, including image transforms. Signed uploads remain permitted.';

commit;
