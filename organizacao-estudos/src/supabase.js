import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://gktbxjphvrhjhfrrevfz.supabase.co";

const supabaseKey =
  "sb_publishable_1am-70d6Ewfp27PEHXNlFg_XFNwYJUm";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);