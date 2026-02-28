do $$
begin
  if to_regprocedure('private.user_allows_public_progress(uuid)') is not null then
    execute 'grant execute on function private.user_allows_public_progress(uuid) to authenticated';
    execute 'revoke execute on function private.user_allows_public_progress(uuid) from anon';
  end if;

  if to_regprocedure('private.user_allow_public_progress(uuid)') is not null then
    execute 'grant execute on function private.user_allow_public_progress(uuid) to authenticated';
    execute 'revoke execute on function private.user_allow_public_progress(uuid) from anon';
  end if;
end
$$;
