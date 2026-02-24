import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xwzogxjtysfqaxcxhbmd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DrvbSeX8ZqoeXZBvdQrW6g_HqwbEOsT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);