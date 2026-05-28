export function formatCustomerLabel(customer: { customer_code?: string | null; company_title: string }): string {
  if (customer.customer_code) {
    return `[${customer.customer_code}] ${customer.company_title}`;
  }
  return customer.company_title;
}

export function formatVehicleLabel(vehicle: { plate: string; brand: string; model: string }): string {
  return `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}`;
}

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('tr-TR');
}

export function getDaysUntil(date: string | null | undefined): number {
  if (!date) return Infinity;
  const target = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getAlertLevel(daysUntil: number): 'critical' | 'normal' | 'minor' | null {
  if (daysUntil <= 3) return 'critical';
  if (daysUntil <= 7) return 'normal';
  if (daysUntil <= 15) return 'minor';
  return null;
}

export function calculateDaysElapsed(startDate: string, endDate: string, status: 'active' | 'completed' | 'cancelled'): number {
  const start = new Date(startDate);
  const today = new Date();
  const end = new Date(endDate);

  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let daysElapsed: number;

  if (status === 'completed') {
    daysElapsed = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } else if (status === 'active') {
    if (today < start) {
      daysElapsed = 0;
    } else {
      daysElapsed = Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  } else {
    daysElapsed = 0;
  }

  const totalDuration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(daysElapsed, totalDuration);
}

export function calculateAccruedAmount(dailyRate: number, startDate: string, endDate: string, status: 'active' | 'completed' | 'cancelled'): number {
  const daysElapsed = calculateDaysElapsed(startDate, endDate, status);
  return daysElapsed * dailyRate;
}

export function calculateCurrentDebt(accruedAmount: number, totalPayments: number): number {
  const debt = accruedAmount - totalPayments;
  return Math.max(0, debt);
}

export interface MonthlyRentalDebt {
  totalContractValue: number;
  currentDueDebt: number;
  paidAmount: number;
  overdueAmount: number;
  futureDebt: number;
}

export function calculateMonthlyRentalDebt(
  schedules: Array<{
    due_date: string;
    amount: number;
    status: 'pending' | 'invoiced' | 'paid';
  }>
): MonthlyRentalDebt {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalContractValue = 0;
  let currentDueDebt = 0;
  let paidAmount = 0;
  let overdueAmount = 0;
  let futureDebt = 0;

  for (const schedule of schedules) {
    totalContractValue += schedule.amount;

    if (schedule.status === 'paid') {
      paidAmount += schedule.amount;
    } else {
      const dueDate = new Date(schedule.due_date);
      dueDate.setHours(0, 0, 0, 0);

      if (dueDate <= today) {
        currentDueDebt += schedule.amount;
        overdueAmount += schedule.amount;
      } else {
        futureDebt += schedule.amount;
      }
    }
  }

  return {
    totalContractValue,
    currentDueDebt,
    paidAmount,
    overdueAmount,
    futureDebt,
  };
}

export function calculateRentalDebtByType(
  rental: {
    billing_type?: 'upfront' | 'monthly';
    daily_rate: number;
    start_date: string;
    end_date: string;
    status: 'active' | 'completed' | 'cancelled';
    total_amount: number;
  },
  totalPayments: number,
  schedules?: Array<{
    due_date: string;
    amount: number;
    status: 'pending' | 'invoiced' | 'paid';
  }>
): { currentDebt: number; totalContract: number; billingType: 'upfront' | 'monthly' } {
  const billingType = rental.billing_type || 'upfront';

  if (billingType === 'monthly' && schedules && schedules.length > 0) {
    const monthlyDebt = calculateMonthlyRentalDebt(schedules);
    return {
      currentDebt: monthlyDebt.currentDueDebt,
      totalContract: monthlyDebt.totalContractValue,
      billingType: 'monthly',
    };
  }

  const accruedAmount = calculateAccruedAmount(
    rental.daily_rate,
    rental.start_date,
    rental.end_date,
    rental.status
  );
  const currentDebt = calculateCurrentDebt(accruedAmount, totalPayments);

  return {
    currentDebt,
    totalContract: rental.total_amount,
    billingType: 'upfront',
  };
}
