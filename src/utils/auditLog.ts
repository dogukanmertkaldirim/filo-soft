import { supabase } from '../lib/supabase';

export type AuditAction = 'DELETE' | 'UPDATE' | 'CREATE';
export type AuditEntity =
  | 'Transaction' | 'Vehicle' | 'Customer' | 'Loan' | 'Rental'
  | 'Partner' | 'Supplier' | 'Bakim' | 'VehicleSale' | 'ExternalService'
  | 'PartnerDocument' | 'User' | 'Reservation' | 'ServiceAppointment'
  | 'CustomerRequest' | 'DamageReport' | 'TransferRequest' | 'Payment';

interface AuditLogParams {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  details: string;
  userEmail?: string;
  companyId?: string;
}

function getAuthFromStorage(): { userId?: string; userName?: string; userEmail?: string; companyId?: string } {
  try {
    const raw = localStorage.getItem('fleet_auth');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const user = parsed.user;
    if (!user) return {};
    return {
      userId: user.id || undefined,
      userName: user.full_name || undefined,
      userEmail: user.username || user.email || undefined,
      companyId: user.company_id || undefined,
    };
  } catch {
    return {};
  }
}

export async function logActivity(params: AuditLogParams): Promise<void> {
  const { action, entity, entityId, details, userEmail, companyId } = params;

  const stored = getAuthFromStorage();

  const resolvedUserId = stored.userId || null;
  const resolvedUserName = stored.userName || null;
  const resolvedUserEmail = userEmail || stored.userEmail || null;
  const resolvedCompanyId = companyId || stored.companyId || null;

  try {
    await supabase.from('activity_logs').insert({
      action,
      entity,
      entity_id: entityId || null,
      details,
      user_id: resolvedUserId,
      user_name: resolvedUserName,
      user_email: resolvedUserEmail,
      company_id: resolvedCompanyId,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export async function createAuditLog(
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  entity: string,
  entityId: string | null,
  details: string,
  userEmail: string | null,
  companyId?: string | null
) {
  await logActivity({
    action,
    entity: entity as AuditEntity,
    entityId: entityId || undefined,
    details,
    userEmail: userEmail || undefined,
    companyId: companyId || undefined,
  });
}

export function formatTransactionDetails(transaction: {
  type: string;
  category: string;
  amount: number;
  description?: string | null;
}): string {
  const typeLabel = transaction.type === 'income' ? 'Gelir' : 'Gider';
  return `${typeLabel} silindi. Tutar: ${transaction.amount.toLocaleString('tr-TR')} TL, Kategori: ${transaction.category}${transaction.description ? `, Aciklama: ${transaction.description}` : ''}`;
}

export function formatVehicleDetails(vehicle: {
  plate: string;
  brand: string;
  model: string;
}): string {
  return `Arac silindi. Plaka: ${vehicle.plate}, Marka/Model: ${vehicle.brand} ${vehicle.model}`;
}

export function formatCustomerDetails(customer: {
  company_title: string;
  authorized_person?: string | null;
}): string {
  return `Musteri silindi. Firma: ${customer.company_title}${customer.authorized_person ? `, Yetkili: ${customer.authorized_person}` : ''}`;
}

export function formatLoanDetails(loan: {
  bank: string;
  total_amount: number;
  remaining_debt: number;
  title?: string | null;
}): string {
  return `Kredi silindi. Banka: ${loan.bank}${loan.title ? `, Baslik: ${loan.title}` : ''}, Toplam: ${loan.total_amount.toLocaleString('tr-TR')} TL, Kalan Borc: ${loan.remaining_debt.toLocaleString('tr-TR')} TL`;
}
