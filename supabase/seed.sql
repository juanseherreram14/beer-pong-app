insert into public.players (id, name, nickname) values ('juanse','Juanse','Juanse'), ('tommy','Tommy','Tommy') on conflict (id) do nothing;
