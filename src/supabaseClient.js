import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvdolrpnficncqdpduxs.supabase.co';
const supabaseAnonKey = 'sb_publishable_4fWGrCkIvVMRZTu0s0mMIQ_kz7uvaDS';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
