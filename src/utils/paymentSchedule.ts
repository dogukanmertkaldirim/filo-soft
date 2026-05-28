import { supabase } from '../lib/supabase';
import type { Rental, RentalPaymentSchedule, Transaction } from '../types/database';
import { addMonths, format, parseISO, isBefore, isToday, startOfDay } from 'date-fns';

export type WithholdingRate = 'none' | '5/10' | '7/10' | '9/10' | 'full_exemption';
export type PaymentTiming = 'beginning_of_period' | 'end_of_period';
export type RentalType = 'short_term' | 'operational_leasing';

export interface TaxCalculationResult {
  netAmount: number;
  taxAmount: number;
  withholdingDeduction: number;
  totalPayable: number;
}

export function getWithholdingFraction(rate: WithholdingRate): number {
  switch (rate) {
    case '5/10':
      return 0.5;
    case '7/10':
      return 0.7;
    case '9/10':
      return 0.9;
    case 'full_exemption':
      return 1.0;
    case 'none':
    default:
      return 0;
  }
}

export function calculateTaxBreakdown(
  netAmount: number,
  taxRate: number,
  withholdingRate: WithholdingRate
): TaxCalculationResult {
  const taxAmount = netAmount * (taxRate / 100);
  const withholdingFraction = getWithholdingFraction(withholdingRate);
  const withholdingDeduction = taxAmount * withholdingFraction;
  const totalPayable = netAmount + taxAmount - withholdingDeduction;

  return {
    netAmount,
    taxAmount,
    withholdingDeduction,
    totalPayable,
  };
}

export interface PaymentScheduleInput {
  rentalId: string;
  companyId: string;
  startDate: string;
  monthlyNetAmount: number;
  contractMonths: number;
  taxRate: number;
  withholdingRate: WithholdingRate;
  paymentTiming?: PaymentTiming;
}

export interface PaymentScheduleRecord {
  dueDate: string;
  netAmount: number;
  taxAmount: number;
  withholdingDeduction: number;
  totalPayable: number;
}

export function generatePaymentScheduleWithTax(
  startDate: string,
  contractMonths: number,
  monthlyNetAmount: number,
  taxRate: number,
  withholdingRate: WithholdingRate,
  paymentTiming: PaymentTiming = 'beginning_of_period'
): PaymentScheduleRecord[] {
  const schedules: PaymentScheduleRecord[] = [];
  const start = parseISO(startDate);

  for (let i = 0; i < contractMonths; i++) {
    let dueDate: Date;

    if (paymentTiming === 'end_of_period') {
      dueDate = addMonths(start, i + 1);
    } else {
      dueDate = addMonths(start, i);
    }

    const taxCalc = calculateTaxBreakdown(monthlyNetAmount, taxRate, withholdingRate);

    schedules.push({
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      netAmount: taxCalc.netAmount,
      taxAmount: taxCalc.taxAmount,
      withholdingDeduction: taxCalc.withholdingDeduction,
      totalPayable: taxCalc.totalPayable,
    });
  }

  return schedules;
}

export function generatePaymentScheduleDates(
  startDate: string,
  contractMonths: number,
  monthlyAmount: number
): Array<{ dueDate: string; amount: number }> {
  const schedules: Array<{ dueDate: string; amount: number }> = [];
  const start = parseISO(startDate);

  for (let i = 0; i < contractMonths; i++) {
    const dueDate = addMonths(start, i);
    schedules.push({
      dueDate: format(dueDate, 'yyyy-MM-dd'),
      amount: monthlyAmount,
    });
  }

  return schedules;
}

export async function createPaymentSchedules(
  input: PaymentScheduleInput
): Promise<RentalPaymentSchedule[]> {
  const schedules = generatePaymentScheduleWithTax(
    input.startDate,
    input.contractMonths,
    input.monthlyNetAmount,
    input.taxRate,
    input.withholdingRate,
    input.paymentTiming || 'beginning_of_period'
  );

  const scheduleRecords = schedules.map((schedule) => ({
    rental_id: input.rentalId,
    company_id: input.companyId,
    due_date: schedule.dueDate,
    amount: schedule.totalPayable,
    net_amount: schedule.netAmount,
    tax_amount: schedule.taxAmount,
    withholding_deduction: schedule.withholdingDeduction,
    total_payable: schedule.totalPayable,
    is_processed: false,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('rental_payment_schedules')
    .insert(scheduleRecords)
    .select();

  if (error) {
    console.error('Error creating payment schedules:', error);
    throw error;
  }

  return data || [];
}

export async function deletePaymentSchedulesForRental(rentalId: string): Promise<void> {
  const { error } = await supabase
    .from('rental_payment_schedules')
    .delete()
    .eq('rental_id', rentalId);

  if (error) {
    console.error('Error deleting payment schedules:', error);
    throw error;
  }
}

export async function markScheduleAsPaid(
  scheduleId: string,
  transactionId?: string
): Promise<RentalPaymentSchedule | null> {
  const { data, error } = await supabase
    .from('rental_payment_schedules')
    .update({
      status: 'paid',
      is_processed: true,
      paid_at: new Date().toISOString(),
      payment_transaction_id: transactionId || null,
    })
    .eq('id', scheduleId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error marking schedule as paid:', error);
    throw error;
  }

  return data;
}

export async function markScheduleAsInvoiced(
  scheduleId: string,
  invoiceNumber?: string
): Promise<RentalPaymentSchedule | null> {
  const { data, error } = await supabase
    .from('rental_payment_schedules')
    .update({
      status: 'invoiced',
      is_processed: true,
      invoice_number: invoiceNumber || null,
    })
    .eq('id', scheduleId)
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error marking schedule as invoiced:', error);
    throw error;
  }

  return data;
}

export function calculateCurrentDueDebt(
  schedules: RentalPaymentSchedule[]
): number {
  const today = startOfDay(new Date());

  return schedules
    .filter((schedule) => {
      const dueDate = startOfDay(parseISO(schedule.due_date));
      const isDueOrPast = isBefore(dueDate, today) || isToday(dueDate);
      const isNotPaid = schedule.status !== 'paid';
      return isDueOrPast && isNotPaid;
    })
    .reduce((sum, schedule) => sum + (schedule.total_payable || schedule.amount), 0);
}

export function calculateTotalContractValue(
  schedules: RentalPaymentSchedule[]
): number {
  return schedules.reduce((sum, schedule) => sum + (schedule.total_payable || schedule.amount), 0);
}

export function calculateTotalNetAmount(
  schedules: RentalPaymentSchedule[]
): number {
  return schedules.reduce((sum, schedule) => sum + (schedule.net_amount || schedule.amount), 0);
}

export function calculateTotalTaxAmount(
  schedules: RentalPaymentSchedule[]
): number {
  return schedules.reduce((sum, schedule) => sum + (schedule.tax_amount || 0), 0);
}

export function calculateTotalWithholdingDeduction(
  schedules: RentalPaymentSchedule[]
): number {
  return schedules.reduce((sum, schedule) => sum + (schedule.withholding_deduction || 0), 0);
}

export function calculatePaidAmount(
  schedules: RentalPaymentSchedule[]
): number {
  return schedules
    .filter((schedule) => schedule.status === 'paid')
    .reduce((sum, schedule) => sum + (schedule.total_payable || schedule.amount), 0);
}

export function calculateRemainingDebt(
  schedules: RentalPaymentSchedule[]
): number {
  return schedules
    .filter((schedule) => schedule.status !== 'paid')
    .reduce((sum, schedule) => sum + (schedule.total_payable || schedule.amount), 0);
}

export function getOverdueSchedules(
  schedules: RentalPaymentSchedule[]
): RentalPaymentSchedule[] {
  const today = startOfDay(new Date());

  return schedules.filter((schedule) => {
    const dueDate = startOfDay(parseISO(schedule.due_date));
    return isBefore(dueDate, today) && schedule.status !== 'paid';
  });
}

export function getUpcomingSchedules(
  schedules: RentalPaymentSchedule[],
  daysAhead: number = 30
): RentalPaymentSchedule[] {
  const today = startOfDay(new Date());
  const futureDate = addMonths(today, 1);

  return schedules.filter((schedule) => {
    const dueDate = startOfDay(parseISO(schedule.due_date));
    return (
      !isBefore(dueDate, today) &&
      isBefore(dueDate, futureDate) &&
      schedule.status !== 'paid'
    );
  });
}

export interface RentalDebtCalculation {
  billingType: 'upfront' | 'monthly';
  totalContractValue: number;
  totalNetAmount: number;
  totalTaxAmount: number;
  totalWithholdingDeduction: number;
  currentDueDebt: number;
  paidAmount: number;
  remainingDebt: number;
  overdueAmount: number;
  schedules?: RentalPaymentSchedule[];
}

export function calculateRentalDebt(
  rental: Rental,
  schedules: RentalPaymentSchedule[],
  payments: Transaction[]
): RentalDebtCalculation {
  const billingType = rental.billing_type || 'upfront';

  if (billingType === 'upfront') {
    const totalPayments = payments
      .filter(
        (t) =>
          t.rental_id === rental.id &&
          t.type === 'income' &&
          t.category === 'Rental Income'
      )
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      billingType: 'upfront',
      totalContractValue: rental.total_amount,
      totalNetAmount: rental.total_amount,
      totalTaxAmount: 0,
      totalWithholdingDeduction: 0,
      currentDueDebt: rental.total_amount - totalPayments,
      paidAmount: totalPayments,
      remainingDebt: rental.total_amount - totalPayments,
      overdueAmount: rental.total_amount - totalPayments,
    };
  }

  const rentalSchedules = schedules.filter((s) => s.rental_id === rental.id);
  const totalContract = calculateTotalContractValue(rentalSchedules);
  const totalNet = calculateTotalNetAmount(rentalSchedules);
  const totalTax = calculateTotalTaxAmount(rentalSchedules);
  const totalWithholding = calculateTotalWithholdingDeduction(rentalSchedules);
  const currentDue = calculateCurrentDueDebt(rentalSchedules);
  const paid = calculatePaidAmount(rentalSchedules);
  const remaining = calculateRemainingDebt(rentalSchedules);
  const overdue = getOverdueSchedules(rentalSchedules).reduce(
    (sum, s) => sum + (s.total_payable || s.amount),
    0
  );

  return {
    billingType: 'monthly',
    totalContractValue: totalContract,
    totalNetAmount: totalNet,
    totalTaxAmount: totalTax,
    totalWithholdingDeduction: totalWithholding,
    currentDueDebt: currentDue,
    paidAmount: paid,
    remainingDebt: remaining,
    overdueAmount: overdue,
    schedules: rentalSchedules,
  };
}

export function getWithholdingRateLabel(rate: WithholdingRate): string {
  switch (rate) {
    case '5/10':
      return '5/10 Tevkifat';
    case '7/10':
      return '7/10 Tevkifat';
    case '9/10':
      return '9/10 Tevkifat';
    case 'full_exemption':
      return 'Tam Muafiyet';
    case 'none':
    default:
      return 'Yok';
  }
}

export function getTaxRateLabel(rate: number): string {
  return `%${rate} KDV`;
}

export function getPaymentTimingLabel(timing: PaymentTiming): string {
  switch (timing) {
    case 'beginning_of_period':
      return 'Donem Basi (Pesin)';
    case 'end_of_period':
      return 'Donem Sonu (Vadeli)';
    default:
      return 'Donem Basi';
  }
}

export function getRentalTypeLabel(type: RentalType): string {
  switch (type) {
    case 'short_term':
      return 'Gunluk Kiralama';
    case 'operational_leasing':
      return 'Operasyonel Leasing';
    default:
      return 'Gunluk Kiralama';
  }
}

export interface LeasingService {
  key: string;
  label: string;
  description: string;
}

export const LEASING_SERVICES: LeasingService[] = [
  { key: 'maintenance', label: 'Bakim', description: 'Periyodik bakim ve servis' },
  { key: 'tires', label: 'Lastik', description: 'Lastik degisimi ve rotasyon' },
  { key: 'insurance', label: 'Sigorta', description: 'Kasko ve trafik sigortasi' },
  { key: 'replacement_car', label: 'Ikame Arac', description: 'Ariza durumunda ikame arac' },
  { key: 'roadside_assistance', label: 'Yol Yardimi', description: '7/24 yol yardim hizmeti' },
  { key: 'hgs_ogs', label: 'HGS/OGS', description: 'Gecis sistemi yonetimi' },
];

export function getServiceLabel(serviceKey: string): string {
  const service = LEASING_SERVICES.find(s => s.key === serviceKey);
  return service?.label || serviceKey;
}

export const CONTRACT_DURATIONS = [
  { value: 6, label: '6 Ay' },
  { value: 12, label: '12 Ay (1 Yil)' },
  { value: 24, label: '24 Ay (2 Yil)' },
  { value: 36, label: '36 Ay (3 Yil)' },
  { value: 48, label: '48 Ay (4 Yil)' },
  { value: 60, label: '60 Ay (5 Yil)' },
];

export type RentalModel = 'rent_a_car' | 'operational_leasing' | 'financial_leasing';

export function getRentalModelLabel(model: RentalModel): string {
  switch (model) {
    case 'rent_a_car':
      return 'Rent a Car';
    case 'operational_leasing':
      return 'Operasyonel Leasing';
    case 'financial_leasing':
      return 'Finansal Leasing';
    default:
      return 'Rent a Car';
  }
}

export interface EarlyTerminationResult {
  daysUsedInLastMonth: number;
  monthlyPrice: number;
  proRataFee: number;
  totalMonthsCompleted: number;
  remainingContractValue: number;
  totalEarlyTerminationFee: number;
}

export function calculateEarlyTerminationFee(
  startDate: Date,
  actualReturnDate: Date,
  monthlyPrice: number,
  contractMonths: number,
  earlyTerminationFee: number = 0
): EarlyTerminationResult {
  const diffMs = actualReturnDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const monthsCompleted = Math.floor(diffDays / 30);
  const daysInLastMonth = diffDays % 30;

  const proRataFee = Math.round((monthlyPrice / 30) * daysInLastMonth * 100) / 100;
  const remainingMonths = Math.max(0, contractMonths - monthsCompleted - 1);
  const remainingContractValue = remainingMonths * monthlyPrice;
  const totalFee = proRataFee + earlyTerminationFee;

  return {
    daysUsedInLastMonth: daysInLastMonth,
    monthlyPrice,
    proRataFee,
    totalMonthsCompleted: monthsCompleted,
    remainingContractValue,
    totalEarlyTerminationFee: totalFee,
  };
}

export async function calculateEarlyReturnFeeFromDB(
  rentalId: string,
  actualReturnDate: Date
): Promise<EarlyTerminationResult | null> {
  const { data, error } = await supabase.rpc('calculate_early_return_fee', {
    p_rental_id: rentalId,
    p_actual_return_date: format(actualReturnDate, 'yyyy-MM-dd'),
  });

  if (error) {
    console.error('Error calculating early return fee:', error);
    return null;
  }

  if (data && data.length > 0) {
    const result = data[0];
    return {
      daysUsedInLastMonth: result.days_used_in_last_month,
      monthlyPrice: result.monthly_price,
      proRataFee: result.pro_rata_fee,
      totalMonthsCompleted: result.total_months_completed,
      remainingContractValue: result.remaining_contract_value,
      totalEarlyTerminationFee: result.pro_rata_fee,
    };
  }

  return null;
}
