-- Reconcile only the verified concurrently-installed function. No data or permissions are changed.
DO $repair$
DECLARE body text; source text; digest text;
BEGIN
 SELECT prosrc INTO body FROM pg_proc WHERE oid='public.nexid_editorial_commit_v1(uuid,uuid,text,uuid,jsonb,jsonb)'::regprocedure;
 digest:=encode(sha256(convert_to(body,'UTF8')),'hex');
 IF digest='d3319d903a5ffa9ea7941d3bc257a02d3b151ba2d42c22a271c63a68d3b18db4' THEN RETURN; END IF;
 IF digest<>'25e4017b11439e8469632de7729c652d528556778ca0ac9b2e643b3aaa934bf4' THEN RAISE EXCEPTION 'editorial_function_changed_reconcile'; END IF;
 SELECT pg_get_functiondef('public.nexid_editorial_commit_v1(uuid,uuid,text,uuid,jsonb,jsonb)'::regprocedure) INTO source;
 source:=replace(source,'    OR p_next IS NULL OR next_revision IS NULL',E'    OR jsonb_typeof(p_command->\'request\') IS DISTINCT FROM \'object\' OR p_command#>>\'{request,action}\' IS DISTINCT FROM action\n    OR p_command#>>\'{request,operationId}\' IS DISTINCT FROM p_operation::text\n    OR p_next IS NULL OR next_revision IS NULL');
 source:=replace(source,'next_revision<>1 OR next_state<>''draft'' OR expected<>0','next_revision IS DISTINCT FROM 1 OR next_state IS DISTINCT FROM ''draft'' OR expected IS DISTINCT FROM 0');
 source:=replace(replace(source,'e.','eh.'),'passport_editorial_history e ','passport_editorial_history eh ');
 source:=replace(replace(source,'AND revision<=','AND eh.revision<='),'ORDER BY revision DESC','ORDER BY eh.revision DESC');
 EXECUTE source;
 SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') INTO digest FROM pg_proc WHERE oid='public.nexid_editorial_commit_v1(uuid,uuid,text,uuid,jsonb,jsonb)'::regprocedure;
 IF digest<>'d3319d903a5ffa9ea7941d3bc257a02d3b151ba2d42c22a271c63a68d3b18db4' THEN RAISE EXCEPTION 'editorial_function_repair_hash_mismatch'; END IF;
END;
$repair$;
