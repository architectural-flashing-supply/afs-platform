import { sql } from './__sql.mjs';
const show = (label, rows) => { console.log(`\n=== ${label} ===`); console.log(rows.length ? rows.map(r=>'  '+JSON.stringify(r)).join('\n') : '  (none)'); };

show('RUSH constraints on quote_requests (pg_constraint, live)', await sql(`
  select conname, pg_get_constraintdef(oid) as def
  from pg_constraint where conrelid='quote_requests'::regclass and conname like '%rush%' order by conname;`));

show('job_stage / send_status constraints', await sql(`
  select conname, pg_get_constraintdef(oid) as def
  from pg_constraint where conrelid='quote_requests'::regclass
    and (conname like '%job_stage%' or conname like '%send_status%' or conname like '%approval_channel%') order by conname;`));

show('migration 034 columns present (information_schema)', await sql(`
  select column_name, data_type, is_nullable from information_schema.columns
  where table_name='quote_requests' and column_name in
   ('job_stage','stage_changed_at','approved_at','sent_to_machine_at','done_at','send_status','send_error',
    'pathfinder_profile_ids','rush_source','rush_set_by','rush_set_at','source_tool','approval_channel','followup_draft','followup_drafted_at')
  order by column_name;`));

show('RLS enabled on quote_requests', await sql(`
  select relname, relrowsecurity from pg_class where relname='quote_requests';`));

show('admin_audit_log columns', await sql(`
  select column_name from information_schema.columns where table_name='admin_audit_log' order by ordinal_position;`));

show("leftover rows from any v2-02 test tag", await sql(`
  select count(*)::int as tagged_quote_requests from quote_requests
  where notes like 'V2-02-E2E-WORKBENCH%' or job_name like 'V2-02-E2E-WORKBENCH%'
     or request_number like 'V2VERIFY%' or guest_email = 'v2-02-verify@example.com';`));

show('audit actions mentioning the machine push, last 3 hours', await sql(`
  select action, count(*)::int as n from admin_audit_log
  where created_at > now() - interval '3 hours'
    and (action ilike '%to_machine%' or action ilike '%pathfinder%')
  group by action order by action;`));

show('ALL audit actions, last 3 hours (for context)', await sql(`
  select action, count(*)::int as n from admin_audit_log
  where created_at > now() - interval '3 hours' group by action order by n desc;`));
