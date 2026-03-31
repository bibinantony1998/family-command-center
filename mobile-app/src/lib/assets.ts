import { supabase } from './supabase';

// ==========================================
// TYPE DEFINITIONS (inline for mobile portability)
// ==========================================

export interface Asset {
    id: string;
    family_id: string;
    type: 'vehicle' | 'property' | 'other';
    details: Record<string, string>;
    added_by: string;
    created_at: string;
}

export interface Bill {
    id: string;
    family_id: string;
    category: string;
    provider_name: string;
    consumer_number: string;
    due_date?: string | null;
    amount: number;
    status: 'pending' | 'paid' | 'overdue';
    auto_pay: boolean;
    visibility: 'personal' | 'public';
    added_by: string;
    created_at: string;
}

export interface InsurancePolicy {
    id: string;
    family_id: string;
    target_id?: string | null;
    type: 'health' | 'life' | 'vehicle' | 'property' | 'medical';
    provider: string;
    premium_amount: number;
    coverage_amount?: number | null;
    expiry_date: string;
    next_due_date?: string | null;
    created_at: string;
}

// ==========================================
// ASSETS
// ==========================================

export async function fetchAssets(familyId: string): Promise<Asset[]> {
    const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('family_id', familyId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createAsset(
    familyId: string,
    assetData: Omit<Asset, 'id' | 'family_id' | 'created_at' | 'added_by'>,
    addedBy: string
): Promise<Asset> {
    const { data, error } = await supabase
        .from('assets')
        .insert([{ family_id: familyId, added_by: addedBy, ...assetData }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteAsset(familyId: string, assetId: string): Promise<void> {
    const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId)
        .eq('family_id', familyId);
    if (error) throw error;
}

// ==========================================
// BILLS
// ==========================================

export async function fetchBills(familyId: string): Promise<Bill[]> {
    const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('family_id', familyId)
        .order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createBill(
    familyId: string,
    billData: Omit<Bill, 'id' | 'family_id' | 'created_at'>
): Promise<Bill> {
    const { data, error } = await supabase
        .from('bills')
        .insert([{ family_id: familyId, ...billData }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateBillStatus(
    familyId: string,
    billId: string,
    status: Bill['status']
): Promise<void> {
    const { error } = await supabase
        .from('bills')
        .update({ status })
        .eq('id', billId)
        .eq('family_id', familyId);
    if (error) throw error;
}

export async function deleteBill(familyId: string, billId: string): Promise<void> {
    const { error } = await supabase
        .from('bills')
        .delete()
        .eq('id', billId)
        .eq('family_id', familyId);
    if (error) throw error;
}

// ==========================================
// INSURANCE POLICIES
// ==========================================

export async function fetchInsurancePolicies(familyId: string): Promise<InsurancePolicy[]> {
    const { data, error } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('family_id', familyId)
        .order('next_due_date', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function createInsurancePolicy(
    familyId: string,
    policyData: Omit<InsurancePolicy, 'id' | 'family_id' | 'created_at'>
): Promise<InsurancePolicy> {
    const { data, error } = await supabase
        .from('insurance_policies')
        .insert([{ family_id: familyId, ...policyData }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteInsurancePolicy(familyId: string, policyId: string): Promise<void> {
    const { error } = await supabase
        .from('insurance_policies')
        .delete()
        .eq('id', policyId)
        .eq('family_id', familyId);
    if (error) throw error;
}
