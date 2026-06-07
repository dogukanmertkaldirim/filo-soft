import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Vehicle, Rental, Loan, LoanPayment, ActivityLog, Transaction } from '../types/database';

interface FleetStatus {
  rented: number;
  idle: number;
  maintenance: number;
}

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
}

interface UpcomingAlert {
  id: string;
  type: 'inspection' | 'insurance' | 'kasko' | 'rental_end' | 'loan_payment' | 'reservation';
  title: string;
  description: string;
  dueDate: string;
  daysUntil: number;
  vehiclePlate?: string;
  severity: 'critical' | 'warning' | 'info';
}

interface PendingRequests {
  extensions: number;
  kmReports: number;
  receipts: number;
  maintenance: number;
  damages: number;
  driverSubmissions: number;
  total: number;
}

interface DashboardStats {
  totalVehicles: number;
  activeRentals: number;
  monthlyRevenue: number;
  lastMonthRevenue: number;
  pendingMaintenance: number;
  fleetStatus: FleetStatus;
  monthlyData: MonthlyData[];
  upcomingAlerts: UpcomingAlert[];
  recentActivity: ActivityLog[];
  totalLoanDebt: number;
  monthlyLoanPayment: number;
  occupancyRate: number;
  pendingRequests: PendingRequests;
  monthlyOverhead: number;
  monthlyFleetCost: number;
  monthlyNetProfit: number;
}

const initialStats: DashboardStats = {
  totalVehicles: 0,
  activeRentals: 0,
  monthlyRevenue: 0,
  lastMonthRevenue: 0,
  pendingMaintenance: 0,
  fleetStatus: { rented: 0, idle: 0, maintenance: 0 },
  monthlyData: [],
  upcomingAlerts: [],
  recentActivity: [],
  totalLoanDebt: 0,
  monthlyLoanPayment: 0,
  occupancyRate: 0,
  pendingRequests: { extensions: 0, kmReports: 0, receipts: 0, maintenance: 0, damages: 0, driverSubmissions: 0, total: 0 },
  monthlyOverhead: 0,
  monthlyFleetCost: 0,
  monthlyNetProfit: 0,
};

function getDaysUntil(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthName(date: Date): string {
  const months = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  return months[date.getMonth()];
}

export function useDashboardStats() {
  const { effectiveCompanyId } = useAuth();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!effectiveCompanyId) return;

    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      const currentMonth = today.toISOString().slice(0, 7);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().slice(0, 7);
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);
      const threeDaysLater = new Date(today);
      threeDaysLater.setDate(today.getDate() + 3);
      const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

      const [
        vehiclesRes,
        rentalsRes,
        loansRes,
        loanPaymentsRes,
        transactionsRes,
        activityLogsRes,
        reservationsRes,
        customerRequestsRes,
        damageReportsRes,
        driverSubmissionsRes,
        companyExpensesRes,
      ] = await Promise.all([
        supabase.from('vehicles').select('*').eq('company_id', effectiveCompanyId).is('deleted_at', null),
        supabase.from('rentals').select('*, customers(company_title)').eq('company_id', effectiveCompanyId).eq('status', 'active'),
        supabase.from('loans').select('*').eq('company_id', effectiveCompanyId).is('deleted_at', null),
        supabase.from('loan_payments').select('*').eq('company_id', effectiveCompanyId).eq('is_paid', false).order('payment_date'),
        supabase.from('transactions').select('*').eq('company_id', effectiveCompanyId).gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0]),
        supabase.from('activity_logs').select('*').eq('company_id', effectiveCompanyId).order('created_at', { ascending: false }).limit(5),
        supabase.from('reservations').select('*, vehicles(plate), customers(company_title)').eq('company_id', effectiveCompanyId).eq('status', 'confirmed').gte('start_date', today.toISOString().split('T')[0]).lte('start_date', threeDaysLater.toISOString().split('T')[0]),
        supabase.from('customer_requests').select('request_type').eq('company_id', effectiveCompanyId).eq('status', 'pending'),
        supabase.from('damage_reports').select('id').eq('company_id', effectiveCompanyId).in('status', ['pending', 'in_progress']),
        supabase.from('driver_submissions').select('id').eq('company_id', effectiveCompanyId).eq('status', 'approved_pending_lessor'),
        supabase.from('company_expenses').select('amount').eq('company_id', effectiveCompanyId).gte('due_date', `${currentMonth}-01`).lte('due_date', `${currentMonth}-31`),
      ]);

      const vehicles: Vehicle[] = vehiclesRes.data || [];
      const rentals: Rental[] = rentalsRes.data || [];
      const loans: Loan[] = loansRes.data || [];
      const loanPayments: LoanPayment[] = loanPaymentsRes.data || [];
      const transactions: Transaction[] = transactionsRes.data || [];
      const activityLogs: ActivityLog[] = activityLogsRes.data || [];
      const reservations = reservationsRes.data || [];
      const customerRequests = customerRequestsRes.data || [];
      const damageReports = damageReportsRes.data || [];
      const driverSubs = driverSubmissionsRes.data || [];

      const pendingRequests: PendingRequests = {
        extensions: customerRequests.filter((r: any) => r.request_type === 'extend_rental').length,
        kmReports: customerRequests.filter((r: any) => r.request_type === 'km_report').length,
        receipts: customerRequests.filter((r: any) => r.request_type === 'payment_receipt').length,
        maintenance: customerRequests.filter((r: any) => r.request_type === 'maintenance_request').length,
        damages: damageReports.length,
        driverSubmissions: driverSubs.length,
        total: customerRequests.length + damageReports.length + driverSubs.length,
      };

      const activeVehicles = vehicles.filter(v => v.status !== 'sold');
      const totalVehicles = activeVehicles.length;
      const activeRentals = rentals.length;

      const fleetStatus: FleetStatus = {
        rented: activeVehicles.filter(v => v.status === 'rented').length,
        idle: activeVehicles.filter(v => v.status === 'idle').length,
        maintenance: activeVehicles.filter(v => v.status === 'maintenance').length,
      };

      const currentMonthTransactions = transactions.filter(t => t.transaction_date.startsWith(currentMonth));
      const lastMonthTransactions = transactions.filter(t => t.transaction_date.startsWith(lastMonth));

      const monthlyRevenue = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      const lastMonthRevenue = lastMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      let pendingMaintenance = 0;
      activeVehicles.forEach(v => {
        const inspectionDays = getDaysUntil(v.inspection_expiry);
        const insuranceDays = getDaysUntil(v.traffic_insurance_expiry);
        const kaskoDays = getDaysUntil(v.kasko_expiry);
        if (inspectionDays <= 7 || insuranceDays <= 7 || kaskoDays <= 7) {
          pendingMaintenance++;
        }
      });

      const monthlyDataMap = new Map<string, { income: number; expense: number }>();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = date.toISOString().slice(0, 7);
        monthlyDataMap.set(key, { income: 0, expense: 0 });
      }

      transactions.forEach(t => {
        const monthKey = t.transaction_date.slice(0, 7);
        if (monthlyDataMap.has(monthKey)) {
          const data = monthlyDataMap.get(monthKey)!;
          if (t.type === 'income') {
            data.income += t.amount;
          } else {
            data.expense += t.amount;
          }
        }
      });

      const monthlyData: MonthlyData[] = [];
      monthlyDataMap.forEach((value, key) => {
        const date = new Date(key + '-01');
        monthlyData.push({
          month: getMonthName(date),
          income: value.income,
          expense: value.expense,
        });
      });

      const upcomingAlerts: UpcomingAlert[] = [];

      activeVehicles.forEach(v => {
        const checks = [
          { date: v.inspection_expiry, type: 'inspection' as const, title: 'Muayene', titleOverdue: 'Muayene Gecikti', desc: 'Arac muayenesi' },
          { date: v.traffic_insurance_expiry, type: 'insurance' as const, title: 'Sigorta', titleOverdue: 'Sigorta Gecikti', desc: 'Trafik sigortası' },
          { date: v.kasko_expiry, type: 'kasko' as const, title: 'Kasko', titleOverdue: 'Kasko Gecikti', desc: 'Kasko bitiş tarihi' },
        ];

        checks.forEach(check => {
          if (check.date) {
            const days = getDaysUntil(check.date);
            if (days <= 7 && days >= -30) {
              const isOverdue = days < 0;
              upcomingAlerts.push({
                id: `${v.id}-${check.type}`,
                type: check.type,
                title: isOverdue ? check.titleOverdue : check.title,
                description: isOverdue ? `${Math.abs(days)} gun gecikti` : check.desc,
                dueDate: check.date,
                daysUntil: days,
                vehiclePlate: v.plate,
                severity: isOverdue ? 'critical' : days <= 3 ? 'warning' : 'info',
              });
            }
          }
        });
      });

      rentals.forEach(r => {
        const days = getDaysUntil(r.end_date);
        if (days <= 7 && days >= -14) {
          const vehicle = vehicles.find(v => v.id === r.vehicle_id);
          const isOverdue = days < 0;
          upcomingAlerts.push({
            id: `rental-${r.id}`,
            type: 'rental_end',
            title: isOverdue ? 'Kiralama Suresi Gecti' : 'Kiralama Bitiyor',
            description: (r as any).customers?.company_title || 'Musteri',
            dueDate: r.end_date,
            daysUntil: days,
            vehiclePlate: vehicle?.plate,
            severity: isOverdue ? 'critical' : days <= 3 ? 'warning' : 'info',
          });
        }
      });

      loans.forEach(l => {
        const nextPayment = loanPayments.find(p => p.loan_id === l.id);
        if (nextPayment) {
          const days = getDaysUntil(nextPayment.payment_date);
          if (days <= 7 && days >= -30) {
            const isOverdue = days < 0;
            upcomingAlerts.push({
              id: `loan-${l.id}`,
              type: 'loan_payment',
              title: isOverdue ? 'Kredi Odemesi Gecikti' : 'Kredi Odemesi',
              description: `${l.bank} - ${l.installment_amount.toLocaleString('tr-TR')} TL`,
              dueDate: nextPayment.payment_date,
              daysUntil: days,
              severity: isOverdue ? 'critical' : days <= 3 ? 'warning' : 'info',
            });
          }
        }
      });

      reservations.forEach((r: any) => {
        const days = getDaysUntil(r.start_date);
        upcomingAlerts.push({
          id: `res-${r.id}`,
          type: 'reservation',
          title: 'Rezervasyon Baslıyor',
          description: r.customers?.company_title || 'Musteri',
          dueDate: r.start_date,
          daysUntil: days,
          vehiclePlate: r.vehicles?.plate,
          severity: days <= 1 ? 'critical' : 'info',
        });
      });

      upcomingAlerts.sort((a, b) => a.daysUntil - b.daysUntil);

      const totalLoanDebt = loans
        .filter(l => l.status !== 'completed')
        .reduce((sum, l) => sum + l.remaining_debt, 0);
      const monthlyLoanPayment = loans
        .filter(l => l.status !== 'completed')
        .reduce((sum, l) => sum + l.installment_amount, 0);

      const occupancyRate = totalVehicles > 0 ? Math.round((activeRentals / totalVehicles) * 100) : 0;

      const monthlyOverhead = (companyExpensesRes.data || []).reduce((sum: number, e: any) => sum + (e.amount || 0), 0);
      const monthlyFleetCost = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const monthlyNetProfit = monthlyRevenue - (monthlyFleetCost + monthlyOverhead);

      setStats({
        totalVehicles,
        activeRentals,
        monthlyRevenue,
        lastMonthRevenue,
        pendingMaintenance,
        fleetStatus,
        monthlyData,
        upcomingAlerts: upcomingAlerts.slice(0, 5),
        recentActivity: activityLogs,
        totalLoanDebt,
        monthlyLoanPayment,
        occupancyRate,
        pendingRequests,
        monthlyOverhead,
        monthlyFleetCost,
        monthlyNetProfit,
      });
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
      setError('Veriler yuklenirken hata olustu');
    } finally {
      setLoading(false);
    }
  }, [effectiveCompanyId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return { stats, loading, error, refresh: loadStats };
}
