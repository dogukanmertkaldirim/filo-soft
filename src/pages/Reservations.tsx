import { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Search, PlayCircle, Calendar, X, Check, Clock, Ban, Car, FileText, CreditCard, ChevronRight, ChevronLeft, AlertTriangle, Info, Eye, Shield, Building, Key, ClipboardCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Reservation, Vehicle, Customer, CompanyProfile, AgreedPaymentMethod, Rental } from '../types/database';
import { formatDate, formatCurrency, formatCustomerLabel, formatVehicleLabel } from '../utils/format';
import { logActivity } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';
import RentalDetailModal from '../components/rental/RentalDetailModal';
import CarDamageSchema from '../components/vehicle/CarDamageSchema';
import VideoUpload from '../components/rental/VideoUpload';
import {
  generatePaymentScheduleWithTax,
  LEASING_SERVICES,
  CONTRACT_DURATIONS,
  type PaymentTiming,
  type WithholdingRate,
} from '../utils/paymentSchedule';
import { format, addMonths, parseISO, differenceInDays } from 'date-fns';
import { tr } from 'date-fns/locale';

type RentalModel = 'rent_a_car' | 'operational_leasing' | 'financial_leasing';

interface ReservationFormData {
  vehicle_id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  note: string;
}

const emptyForm: ReservationFormData = {
  vehicle_id: '',
  customer_id: '',
  start_date: '',
  end_date: '',
  note: '',
};

export default function Reservations() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [showForm, setShowForm] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [formData, setFormData] = useState<ReservationFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [showRentalModal, setShowRentalModal] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [activeRentals, setActiveRentals] = useState<Rental[]>([]);
  const [showRentalDetail, setShowRentalDetail] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [viewMode, setViewMode] = useState<'reservations' | 'rentals'>('reservations');
  const [rentalData, setRentalData] = useState({
    company_profile_id: '',
    start_datetime: '',
    end_datetime: '',
    daily_rate: 0,
    deposit_amount: 0,
    starting_km: 0,
    fuel_status: 'full' as const,
    daily_km_limit: 0,
    monthly_km_limit: 0,
    per_km_overage_fee: 0,
    notes: '',
    rental_model: 'rent_a_car' as RentalModel,
    payment_timing: 'beginning_of_period' as PaymentTiming,
    billing_type: 'upfront' as 'upfront' | 'monthly',
    contract_duration_months: 12,
    monthly_rate: 0,
    early_termination_fee: 0,
    services_included: [] as string[],
    tax_rate: 20,
    withholding_rate: 'none' as WithholdingRate,
    agreed_payment_method: 'transfer' as AgreedPaymentMethod,
    down_payment: 0,
    transfer_ownership: false,
    delivery_damage_condition: {} as Record<string, string>,
    initial_damage_notes: '',
    start_cleanliness_status: 'clean' as 'clean' | 'normal' | 'dirty',
    start_fuel_percentage: 100,
    delivery_video_url: null as string | null,
  });

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);
    const [reservationsRes, vehiclesRes, customersRes, profilesRes, rentalsRes] = await Promise.all([
      supabase.from('reservations').select('*').eq('company_id', companyId).order('start_date', { ascending: true }),
      supabase.from('vehicles').select('*').eq('company_id', companyId).in('status', ['idle', 'rented']).order('plate'),
      supabase.from('customers').select('*').eq('company_id', companyId).order('company_title'),
      supabase.from('company_profiles').select('*').eq('company_id', companyId).order('created_at', { ascending: true }),
      supabase.from('rentals').select('*').eq('company_id', companyId).eq('status', 'active').is('deleted_at', null).order('start_date', { ascending: false }),
    ]);
    setReservations(reservationsRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setCustomers(customersRes.data || []);
    setCompanyProfiles(profilesRes.data || []);
    setActiveRentals(rentalsRes.data || []);
    setLoading(false);
  }

  function openRentalDetail(rental: Rental) {
    setSelectedRental(rental);
    setShowRentalDetail(true);
  }

  function openAddForm() {
    setEditingReservation(null);
    const today = new Date().toISOString().split('T')[0];
    setFormData({ ...emptyForm, start_date: today, end_date: today });
    setShowForm(true);
  }

  function openEditForm(reservation: Reservation) {
    setEditingReservation(reservation);
    setFormData({
      vehicle_id: reservation.vehicle_id,
      customer_id: reservation.customer_id,
      start_date: reservation.start_date,
      end_date: reservation.end_date,
      note: reservation.note || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!companyId) return;

    if (!formData.vehicle_id || !formData.customer_id || !formData.start_date || !formData.end_date) {
      alert('Lutfen zorunlu alanlari doldurun');
      return;
    }

    setSaving(true);
    const reservationData = {
      vehicle_id: formData.vehicle_id,
      customer_id: formData.customer_id,
      start_date: formData.start_date,
      end_date: formData.end_date,
      note: formData.note.trim() || null,
      company_id: companyId,
    };

    if (editingReservation) {
      await supabase.from('reservations').update(reservationData).eq('id', editingReservation.id).eq('company_id', companyId);
      await logActivity({
        action: 'UPDATE',
        entity: 'Reservation',
        entityId: editingReservation.id,
        details: `Rezervasyon guncellendi`,
        userEmail: user?.email,
        companyId: companyId,
      });
    } else {
      const { data } = await supabase.from('reservations').insert({ ...reservationData, status: 'pending' }).select().single();
      await logActivity({
        action: 'CREATE',
        entity: 'Reservation',
        entityId: data?.id,
        details: `Yeni rezervasyon olusturuldu`,
        userEmail: user?.email,
        companyId: companyId,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(reservation: Reservation) {
    if (!companyId) return;

    const vehicle = vehicles.find(v => v.id === reservation.vehicle_id);
    const customer = customers.find(c => c.id === reservation.customer_id);
    if (!confirm(`${vehicle?.plate || 'Arac'} - ${customer?.company_title || 'Musteri'} rezervasyonunu silmek istediginize emin misiniz?`)) return;

    await logActivity({
      action: 'DELETE',
      entity: 'Reservation',
      entityId: reservation.id,
      details: `Rezervasyon silindi: ${vehicle?.plate} - ${customer?.company_title}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase.from('reservations').delete().eq('id', reservation.id).eq('company_id', companyId);
    loadData();
  }

  async function handleStatusChange(reservation: Reservation, newStatus: 'confirmed' | 'cancelled') {
    if (!companyId) return;

    await supabase.from('reservations').update({ status: newStatus }).eq('id', reservation.id).eq('company_id', companyId);
    await logActivity({
      action: 'UPDATE',
      entity: 'Reservation',
      entityId: reservation.id,
      details: `Rezervasyon durumu guncellendi: ${newStatus === 'confirmed' ? 'Onaylandi' : 'Iptal edildi'}`,
      userEmail: user?.email,
      companyId: companyId,
    });
    loadData();
  }

  function openRentalModal(reservation: Reservation) {
    setSelectedReservation(reservation);
    setWizardStep(1);
    const vehicle = vehicles.find(v => v.id === reservation.vehicle_id);
    const defaultProfile = companyProfiles.find(p => p.is_default) || companyProfiles[0];

    const startDate = new Date(reservation.start_date);
    const endDate = new Date(reservation.end_date);
    startDate.setHours(9, 0, 0);
    endDate.setHours(18, 0, 0);

    setRentalData({
      company_profile_id: defaultProfile?.id || '',
      start_datetime: startDate.toISOString().slice(0, 16),
      end_datetime: endDate.toISOString().slice(0, 16),
      daily_rate: 0,
      deposit_amount: 0,
      starting_km: vehicle?.current_km || 0,
      fuel_status: 'full',
      daily_km_limit: 0,
      monthly_km_limit: 0,
      per_km_overage_fee: 0,
      notes: reservation.note || '',
      rental_model: 'rent_a_car',
      payment_timing: 'beginning_of_period',
      billing_type: 'upfront',
      contract_duration_months: 12,
      monthly_rate: 0,
      early_termination_fee: 0,
      services_included: [],
      tax_rate: 20,
      withholding_rate: 'none',
      agreed_payment_method: 'transfer',
      down_payment: 0,
      transfer_ownership: false,
      delivery_damage_condition: vehicle?.damage_schema || {},
      initial_damage_notes: vehicle?.initial_damage_status || '',
      start_cleanliness_status: 'clean',
      start_fuel_percentage: 100,
      delivery_video_url: null,
    });
    setShowRentalModal(true);
  }

  async function handleStartRental() {
    if (!companyId) return;
    if (!selectedReservation) return;

    const startDate = new Date(rentalData.start_datetime);
    const isLongTerm = rentalData.rental_model === 'operational_leasing' || rentalData.rental_model === 'financial_leasing';
    const isFinancialLeasing = rentalData.rental_model === 'financial_leasing';

    let endDate: Date;
    let totalAmount: number;
    let billingType: 'upfront' | 'monthly';
    let contractMonths: number | null = null;

    if (isLongTerm) {
      endDate = addMonths(startDate, rentalData.contract_duration_months);
      totalAmount = rentalData.monthly_rate * rentalData.contract_duration_months;
      if (isFinancialLeasing) {
        totalAmount += rentalData.down_payment;
      }
      billingType = 'monthly';
      contractMonths = rentalData.contract_duration_months;
    } else {
      endDate = new Date(rentalData.end_datetime);
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) || 1;
      totalAmount = rentalData.daily_rate * days;
      billingType = rentalData.billing_type;
      if (billingType === 'monthly') {
        const months = Math.ceil(days / 30);
        contractMonths = months;
      }
    }

    const legacyRentalType = rentalData.rental_model === 'rent_a_car' ? 'short_term' : 'operational_leasing';

    const rentalRecord = {
      vehicle_id: selectedReservation.vehicle_id,
      customer_id: selectedReservation.customer_id,
      company_profile_id: rentalData.company_profile_id || null,
      start_date: format(startDate, 'yyyy-MM-dd'),
      end_date: format(endDate, 'yyyy-MM-dd'),
      start_datetime: rentalData.start_datetime,
      end_datetime: isLongTerm ? format(endDate, "yyyy-MM-dd'T'18:00") : rentalData.end_datetime,
      daily_rate: isLongTerm ? 0 : rentalData.daily_rate,
      total_amount: totalAmount,
      deposit_amount: rentalData.deposit_amount,
      starting_km: rentalData.starting_km,
      fuel_status: rentalData.fuel_status,
      daily_km_limit: rentalData.rental_model === 'rent_a_car' ? (rentalData.daily_km_limit || null) : null,
      monthly_km_limit: isLongTerm ? (rentalData.monthly_km_limit || null) : null,
      per_km_overage_fee: rentalData.per_km_overage_fee || 0,
      notes: rentalData.notes || null,
      status: 'active',
      company_id: companyId,
      rental_type: legacyRentalType,
      rental_model: rentalData.rental_model,
      payment_timing: rentalData.payment_timing,
      billing_type: billingType,
      contract_months: contractMonths,
      contract_duration_months: isLongTerm ? rentalData.contract_duration_months : null,
      early_termination_fee: isLongTerm ? rentalData.early_termination_fee : 0,
      early_termination_logic: 'pro_rata_daily',
      services_included: isLongTerm ? rentalData.services_included : [],
      tax_rate: rentalData.tax_rate,
      withholding_rate: rentalData.withholding_rate,
      agreed_payment_method: rentalData.agreed_payment_method,
      down_payment: isFinancialLeasing ? rentalData.down_payment : 0,
      transfer_ownership: isFinancialLeasing,
      monthly_price: isLongTerm ? rentalData.monthly_rate : null,
      delivery_damage_condition: rentalData.delivery_damage_condition,
      initial_damage_notes: rentalData.initial_damage_notes || null,
      start_cleanliness_status: rentalData.start_cleanliness_status,
      start_fuel_percentage: rentalData.start_fuel_percentage,
      delivery_video_url: rentalData.delivery_video_url || null,
    };

    const { data: rental } = await supabase.from('rentals').insert(rentalRecord).select().single();

    if (rental && billingType === 'monthly' && contractMonths) {
      const monthlyAmount = isLongTerm ? rentalData.monthly_rate : (totalAmount / contractMonths);
      const schedules = generatePaymentScheduleWithTax(
        format(startDate, 'yyyy-MM-dd'),
        contractMonths,
        monthlyAmount,
        rentalData.tax_rate,
        rentalData.withholding_rate,
        rentalData.payment_timing
      );

      const scheduleRecords = schedules.map((schedule) => ({
        rental_id: rental.id,
        company_id: companyId,
        due_date: schedule.dueDate,
        amount: schedule.totalPayable,
        net_amount: schedule.netAmount,
        tax_amount: schedule.taxAmount,
        withholding_deduction: schedule.withholdingDeduction,
        total_payable: schedule.totalPayable,
        is_processed: false,
        status: 'pending' as const,
      }));

      await supabase.from('rental_payment_schedules').insert(scheduleRecords);
    }

    await supabase.from('vehicles').update({ status: 'rented' }).eq('id', selectedReservation.vehicle_id).eq('company_id', companyId);

    await supabase.from('reservations').update({ status: 'completed' }).eq('id', selectedReservation.id).eq('company_id', companyId);

    const modelLabels: Record<RentalModel, string> = {
      'rent_a_car': 'Gunluk kiralama',
      'operational_leasing': 'Operasyonel leasing',
      'financial_leasing': 'Finansal leasing',
    };

    await logActivity({
      action: 'CREATE',
      entity: 'Rental',
      entityId: rental?.id,
      details: isLongTerm
        ? `${modelLabels[rentalData.rental_model]} olusturuldu (${rentalData.contract_duration_months} ay)`
        : `Rezervasyondan kiralama olusturuldu`,
      userEmail: user?.email,
      companyId: companyId,
    });

    setShowRentalModal(false);
    setSelectedReservation(null);
    loadData();
  }

  function toggleService(serviceKey: string) {
    setRentalData(prev => ({
      ...prev,
      services_included: prev.services_included.includes(serviceKey)
        ? prev.services_included.filter(s => s !== serviceKey)
        : [...prev.services_included, serviceKey],
    }));
  }

  function getPaymentPreview() {
    const isLongTermModel = rentalData.rental_model === 'operational_leasing' || rentalData.rental_model === 'financial_leasing';

    if (rentalData.rental_model === 'rent_a_car' && rentalData.billing_type === 'upfront') {
      return null;
    }

    const startDate = rentalData.start_datetime ? format(parseISO(rentalData.start_datetime), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
    const monthlyAmount = isLongTermModel ? rentalData.monthly_rate : rentalData.daily_rate * 30;
    const months = isLongTermModel ? rentalData.contract_duration_months : (rentalData.billing_type === 'monthly' ?
      Math.ceil(differenceInDays(
        rentalData.end_datetime ? parseISO(rentalData.end_datetime) : new Date(),
        rentalData.start_datetime ? parseISO(rentalData.start_datetime) : new Date()
      ) / 30) || 1 : 0);

    if (months <= 0) return null;

    return generatePaymentScheduleWithTax(
      startDate,
      Math.min(months, 6),
      monthlyAmount,
      rentalData.tax_rate,
      rentalData.withholding_rate,
      rentalData.payment_timing
    );
  }

  const filteredReservations = reservations.filter(r => {
    const vehicle = vehicles.find(v => v.id === r.vehicle_id);
    const customer = customers.find(c => c.id === r.customer_id);
    const matchesSearch =
      vehicle?.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.company_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700"><Clock className="h-3 w-3" />Beklemede</span>;
      case 'confirmed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700"><Check className="h-3 w-3" />Onaylandi</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700"><X className="h-3 w-3" />Iptal</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700"><Check className="h-3 w-3" />Tamamlandi</span>;
      default:
        return null;
    }
  };

  const availableVehicles = vehicles.filter(v => v.status === 'idle');

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Rezervasyonlar</h1>
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Rezervasyon Ekle
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Arac veya musteri ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="all">Tum Durumlar</option>
              <option value="pending">Beklemede</option>
              <option value="confirmed">Onaylandi</option>
              <option value="cancelled">Iptal</option>
              <option value="completed">Tamamlandi</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Arac</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Musteri</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Başlangıç</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Bitiş</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Durum</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredReservations.map((r) => {
                  const vehicle = vehicles.find(v => v.id === r.vehicle_id);
                  const customer = customers.find(c => c.id === r.customer_id);
                  const canStartRental = r.status === 'confirmed' && vehicle?.status === 'idle';
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{vehicle?.plate || '-'}</div>
                        <div className="text-xs text-slate-500">{vehicle?.brand} {vehicle?.model}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {customer?.is_blacklisted && (
                            <span className="text-red-500" title={customer.blacklist_reason || 'Kara Listede'}>
                              <Ban className="h-4 w-4" />
                            </span>
                          )}
                          <div>
                            <div className={customer?.is_blacklisted ? 'text-red-700 font-medium' : 'font-medium'}>
                              {customer?.company_title || '-'}
                            </div>
                            <div className="text-xs text-slate-500">{customer?.authorized_person}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">{formatDate(r.start_date)}</td>
                      <td className="py-3 px-4">{formatDate(r.end_date)}</td>
                      <td className="py-3 px-4 text-center">{getStatusBadge(r.status)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {r.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleStatusChange(r, 'confirmed')}
                                className="p-1.5 hover:bg-green-50 rounded"
                                title="Onayla"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </button>
                              <button
                                onClick={() => handleStatusChange(r, 'cancelled')}
                                className="p-1.5 hover:bg-red-50 rounded"
                                title="Iptal Et"
                              >
                                <X className="h-4 w-4 text-red-500" />
                              </button>
                            </>
                          )}
                          {canStartRental && (
                            <button
                              onClick={() => openRentalModal(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-teal-600 text-white text-xs font-medium rounded hover:bg-teal-700 transition-colors"
                              title="Kiralamaya Donustur"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              Kirala
                            </button>
                          )}
                          {(r.status === 'pending' || r.status === 'confirmed') && (
                            <button
                              onClick={() => openEditForm(r)}
                              className="p-1.5 hover:bg-slate-100 rounded"
                              title="Duzenle"
                            >
                              <Edit2 className="h-4 w-4 text-slate-500" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(r)}
                            className="p-1.5 hover:bg-red-50 rounded"
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredReservations.length === 0 && (
              <p className="text-center py-8 text-slate-500">Rezervasyon bulunamadi</p>
            )}
          </div>
        )}
      </div>

      {activeRentals.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 mt-6">
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <Car className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Aktif Kiralamalar</h2>
                <p className="text-sm text-slate-500">{activeRentals.length} adet aktif kiralama</p>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Arac</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Musteri</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Başlangıç</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Bitiş</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Tip</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {activeRentals.map((rental) => {
                  const vehicle = vehicles.find(v => v.id === rental.vehicle_id);
                  const customer = customers.find(c => c.id === rental.customer_id);
                  return (
                    <tr key={rental.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium">{vehicle?.plate || '-'}</div>
                        <div className="text-xs text-slate-500">{vehicle?.brand} {vehicle?.model}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium">{customer?.company_title || '-'}</div>
                        <div className="text-xs text-slate-500">{customer?.authorized_person}</div>
                      </td>
                      <td className="py-3 px-4">{formatDate(rental.start_date)}</td>
                      <td className="py-3 px-4">{formatDate(rental.end_date)}</td>
                      <td className="py-3 px-4">
                        {(() => {
                          const model = rental.rental_model || (rental.rental_type === 'operational_leasing' ? 'operational_leasing' : 'rent_a_car');
                          if (model === 'rent_a_car') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-teal-100 text-teal-700">
                                RENT A CAR
                              </span>
                            );
                          } else if (model === 'operational_leasing') {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md">
                                OPERASYONEL
                              </span>
                            );
                          } else {
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md">
                                FINANSAL
                              </span>
                            );
                          }
                        })()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => openRentalDetail(rental)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-xs font-medium rounded-lg hover:bg-teal-100 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Detay
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingReservation ? 'Rezervasyon Duzenle' : 'Rezervasyon Ekle'}
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Arac *"
            value={formData.vehicle_id}
            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
            options={[
              { value: '', label: 'Arac secin...' },
              ...availableVehicles.map(v => ({ value: v.id, label: formatVehicleLabel(v) })),
            ]}
          />

          <Select
            label="Musteri *"
            value={formData.customer_id}
            onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
            options={[
              { value: '', label: 'Musteri secin...' },
              ...customers.filter(c => !c.is_blacklisted).map(c => ({
                value: c.id,
                label: `${formatCustomerLabel(c)}${c.authorized_person ? ` (${c.authorized_person})` : ''}`
              })),
            ]}
          />

          {formData.customer_id && customers.find(c => c.id === formData.customer_id)?.is_blacklisted && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700 font-medium">Bu musteri kara listede!</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Başlangıç Tarihi *"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="Bitiş Tarihi *"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Not</label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="Rezervasyon notu..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingReservation ? 'Guncelle' : 'Olustur'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRentalModal}
        onClose={() => setShowRentalModal(false)}
        title="Kiralama Olustur"
        size="xl"
      >
        {selectedReservation && (() => {
          const vehicle = vehicles.find(v => v.id === selectedReservation.vehicle_id);
          const customer = customers.find(c => c.id === selectedReservation.customer_id);
          const isLongTerm = rentalData.rental_model === 'operational_leasing' || rentalData.rental_model === 'financial_leasing';
          const isFinancialLeasing = rentalData.rental_model === 'financial_leasing';
          const paymentPreview = getPaymentPreview();

          const stepLabels: Record<RentalModel, string> = {
            'rent_a_car': 'Kiralama Detaylari',
            'operational_leasing': 'Operasyonel Leasing',
            'financial_leasing': 'Finansal Leasing',
          };

          const wizardSteps = [
            { step: 1, label: 'Kiralama Modeli', icon: Car },
            { step: 2, label: stepLabels[rentalData.rental_model], icon: FileText },
            { step: 3, label: 'Finansal Bilgiler', icon: CreditCard },
            { step: 4, label: 'Arac Durumu', icon: ClipboardCheck },
          ];

          return (
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                {wizardSteps.map((s, i) => (
                  <div key={s.step} className="flex items-center">
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        wizardStep === s.step
                          ? 'bg-teal-50 text-teal-700'
                          : wizardStep > s.step
                          ? 'text-teal-600'
                          : 'text-slate-400'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          wizardStep === s.step
                            ? 'bg-teal-600 text-white'
                            : wizardStep > s.step
                            ? 'bg-teal-100 text-teal-600'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {wizardStep > s.step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium hidden sm:block">{s.label}</span>
                    </div>
                    {i < wizardSteps.length - 1 && (
                      <ChevronRight className="h-5 w-5 mx-2 text-slate-300" />
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg mb-6">
                <div>
                  <p className="text-sm text-slate-500">Arac</p>
                  <p className="font-medium">{vehicle?.plate} - {vehicle?.brand} {vehicle?.model}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Musteri</p>
                  <p className="font-medium">{customer ? formatCustomerLabel(customer) : '-'}</p>
                </div>
              </div>

              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <p className="text-base font-semibold text-slate-900 mb-1">Kiralama Modelini Secin</p>
                    <p className="text-sm text-slate-500">3 farkli kiralama modeli arasinda secim yapin:</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => setRentalData({
                        ...rentalData,
                        rental_model: 'rent_a_car',
                        billing_type: 'upfront',
                        services_included: [],
                        transfer_ownership: false,
                        down_payment: 0,
                      })}
                      className={`p-5 rounded-xl border-2 text-left transition-all ${
                        rentalData.rental_model === 'rent_a_car'
                          ? 'border-teal-500 bg-teal-50 ring-2 ring-teal-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Car className={`h-7 w-7 mb-2 ${rentalData.rental_model === 'rent_a_car' ? 'text-teal-600' : 'text-slate-400'}`} />
                      <h3 className="font-semibold text-slate-900 text-sm">RENT A CAR</h3>
                      <p className="text-xs text-teal-600 font-medium">Kisa Donem</p>
                      <p className="text-xs text-slate-500 mt-2">Gunluk/haftalik kiralamalar</p>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400">Gunluk fiyat + KM limiti</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRentalData({
                        ...rentalData,
                        rental_model: 'operational_leasing',
                        billing_type: 'monthly',
                        services_included: LEASING_SERVICES.map(s => s.key),
                        transfer_ownership: false,
                        down_payment: 0,
                      })}
                      className={`p-5 rounded-xl border-2 text-left transition-all ${
                        rentalData.rental_model === 'operational_leasing'
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Building className={`h-7 w-7 mb-2 ${rentalData.rental_model === 'operational_leasing' ? 'text-blue-600' : 'text-slate-400'}`} />
                      <h3 className="font-semibold text-slate-900 text-sm">OPERASYONEL</h3>
                      <p className="text-xs text-blue-600 font-medium">Filo Kiralama</p>
                      <p className="text-xs text-slate-500 mt-2">Uzun donemli sozlesme (6-60 ay)</p>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400">Arac firma'ya geri doner</p>
                        <p className="text-xs text-green-600 font-medium mt-1">Hizmetler DAHIL</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRentalData({
                        ...rentalData,
                        rental_model: 'financial_leasing',
                        billing_type: 'monthly',
                        services_included: [],
                        transfer_ownership: true,
                        down_payment: 0,
                      })}
                      className={`p-5 rounded-xl border-2 text-left transition-all ${
                        rentalData.rental_model === 'financial_leasing'
                          ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <Key className={`h-7 w-7 mb-2 ${rentalData.rental_model === 'financial_leasing' ? 'text-amber-600' : 'text-slate-400'}`} />
                      <h3 className="font-semibold text-slate-900 text-sm">FINANSAL</h3>
                      <p className="text-xs text-amber-600 font-medium">Sahiplik Transferi</p>
                      <p className="text-xs text-slate-500 mt-2">Sozlesme sonunda mulkiyet gecer</p>
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs text-slate-400">Pesinat + Aylik taksit</p>
                        <p className="text-xs text-amber-600 font-medium mt-1">Hizmetler HARIC</p>
                      </div>
                    </button>
                  </div>

                  {rentalData.rental_model === 'financial_leasing' && (
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mt-4">
                      <Info className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Finansal Leasing Bilgisi</p>
                        <p className="text-sm text-amber-600">Sozlesme sonunda arac mulkiyeti kiraciya gecer. Pesinat tutari belirleyebilirsiniz.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wizardStep === 2 && rentalData.rental_model === 'rent_a_car' && (
                <div className="space-y-4">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg mb-4">
                    <p className="text-sm font-medium text-teal-800">RENT A CAR - Kisa Donem Kiralama</p>
                    <p className="text-xs text-teal-600">Gunluk/haftalik kiralamalar icin tarih ve KM limiti belirleyin.</p>
                  </div>

                  <Select
                    label="Sirket Profili"
                    value={rentalData.company_profile_id}
                    onChange={(e) => setRentalData({ ...rentalData, company_profile_id: e.target.value })}
                    options={[
                      { value: '', label: 'Profil secin...' },
                      ...companyProfiles.map(p => ({ value: p.id, label: p.title })),
                    ]}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Başlangıç Tarih/Saat"
                      type="datetime-local"
                      value={rentalData.start_datetime}
                      onChange={(e) => setRentalData({ ...rentalData, start_datetime: e.target.value })}
                    />
                    <Input
                      label="Bitiş Tarih/Saat"
                      type="datetime-local"
                      value={rentalData.end_datetime}
                      onChange={(e) => setRentalData({ ...rentalData, end_datetime: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Başlangıç KM"
                      type="number"
                      value={rentalData.starting_km || ''}
                      onChange={(e) => setRentalData({ ...rentalData, starting_km: Number(e.target.value) })}
                    />
                    <Select
                      label="Yakit Durumu"
                      value={rentalData.fuel_status}
                      onChange={(e) => setRentalData({ ...rentalData, fuel_status: e.target.value as 'full' | '3/4' | '1/2' | '1/4' | 'empty' })}
                      options={[
                        { value: 'full', label: 'Dolu' },
                        { value: '3/4', label: '3/4' },
                        { value: '1/2', label: '1/2' },
                        { value: '1/4', label: '1/4' },
                        { value: 'empty', label: 'Bos' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Gunluk KM Limiti"
                      type="number"
                      value={rentalData.daily_km_limit || ''}
                      onChange={(e) => setRentalData({ ...rentalData, daily_km_limit: Number(e.target.value) })}
                      placeholder="0 = Limitsiz"
                    />
                    <Input
                      label="KM Asim Ucreti (TL)"
                      type="number"
                      value={rentalData.per_km_overage_fee || ''}
                      onChange={(e) => setRentalData({ ...rentalData, per_km_overage_fee: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}

              {wizardStep === 2 && isLongTerm && (
                <div className="space-y-4">
                  <div className={`p-3 rounded-lg mb-4 ${
                    isFinancialLeasing
                      ? 'bg-amber-50 border border-amber-200'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm font-medium ${isFinancialLeasing ? 'text-amber-800' : 'text-blue-800'}`}>
                      {isFinancialLeasing ? 'FINANSAL LEASING - Sahiplik Transferi' : 'OPERASYONEL LEASING - Filo Kiralama'}
                    </p>
                    <p className={`text-xs ${isFinancialLeasing ? 'text-amber-600' : 'text-blue-600'}`}>
                      {isFinancialLeasing
                        ? 'Sozlesme sonunda arac mulkiyeti kiraciya gecer.'
                        : 'Sozlesme sonunda arac firmaya geri doner.'}
                    </p>
                  </div>

                  <Select
                    label="Sirket Profili"
                    value={rentalData.company_profile_id}
                    onChange={(e) => setRentalData({ ...rentalData, company_profile_id: e.target.value })}
                    options={[
                      { value: '', label: 'Profil secin...' },
                      ...companyProfiles.map(p => ({ value: p.id, label: p.title })),
                    ]}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Başlangıç Tarihi"
                      type="datetime-local"
                      value={rentalData.start_datetime}
                      onChange={(e) => setRentalData({ ...rentalData, start_datetime: e.target.value })}
                    />
                    <Select
                      label="Sozlesme Suresi (Ay)"
                      value={rentalData.contract_duration_months.toString()}
                      onChange={(e) => setRentalData({ ...rentalData, contract_duration_months: Number(e.target.value) })}
                      options={CONTRACT_DURATIONS.map(d => ({ value: d.value.toString(), label: d.label }))}
                    />
                  </div>

                  {rentalData.contract_duration_months < 6 && (
                    <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-800">Kisa Sozlesme Uyarisi</p>
                        <p className="text-sm text-amber-600">Leasing sozlesmeleri minimum 6 ay olmalidir.</p>
                      </div>
                    </div>
                  )}

                  {isFinancialLeasing && (
                    <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                      <label className="block text-sm font-semibold text-amber-800 mb-2">Pesinat Tutari (TL)</label>
                      <p className="text-xs text-amber-600 mb-3">Finansal leasing icin baslangic odeme tutari.</p>
                      <CurrencyInput
                        value={rentalData.down_payment}
                        onChange={(val) => setRentalData({ ...rentalData, down_payment: val })}
                        placeholder="0.00"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Başlangıç KM"
                      type="number"
                      value={rentalData.starting_km || ''}
                      onChange={(e) => setRentalData({ ...rentalData, starting_km: Number(e.target.value) })}
                    />
                    <Select
                      label="Yakit Durumu"
                      value={rentalData.fuel_status}
                      onChange={(e) => setRentalData({ ...rentalData, fuel_status: e.target.value as 'full' | '3/4' | '1/2' | '1/4' | 'empty' })}
                      options={[
                        { value: 'full', label: 'Dolu' },
                        { value: '3/4', label: '3/4' },
                        { value: '1/2', label: '1/2' },
                        { value: '1/4', label: '1/4' },
                        { value: 'empty', label: 'Bos' },
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Aylik KM Limiti"
                      type="number"
                      value={rentalData.monthly_km_limit || ''}
                      onChange={(e) => setRentalData({ ...rentalData, monthly_km_limit: Number(e.target.value) })}
                      placeholder="0 = Limitsiz"
                    />
                    <Input
                      label="KM Asim Ucreti (TL/km)"
                      type="number"
                      value={rentalData.per_km_overage_fee || ''}
                      onChange={(e) => setRentalData({ ...rentalData, per_km_overage_fee: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-slate-700">Hizmet Paketi (Dahil Hizmetler)</label>
                      {isFinancialLeasing ? (
                        <span className="text-xs text-amber-600 font-medium">Varsayilan: HARIC (musteri oder)</span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Varsayilan: DAHIL (firma oder)</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-3">
                      {isFinancialLeasing
                        ? 'Finansal leasingde hizmetler genellikle musteri tarafindan karsilanir.'
                        : 'Operasyonel leasingde hizmetler genellikle firmaya dahildir.'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {LEASING_SERVICES.map(service => (
                        <button
                          key={service.key}
                          type="button"
                          onClick={() => toggleService(service.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                            rentalData.services_included.includes(service.key)
                              ? isFinancialLeasing
                                ? 'bg-amber-50 border-amber-500 text-amber-700'
                                : 'bg-blue-50 border-blue-500 text-blue-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            rentalData.services_included.includes(service.key)
                              ? isFinancialLeasing
                                ? 'bg-amber-600 border-amber-600'
                                : 'bg-blue-600 border-blue-600'
                              : 'border-slate-300'
                          }`}>
                            {rentalData.services_included.includes(service.key) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          {service.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    label="Erken Fesih Ucreti (TL)"
                    type="number"
                    value={rentalData.early_termination_fee || ''}
                    onChange={(e) => setRentalData({ ...rentalData, early_termination_fee: Number(e.target.value) })}
                    placeholder="Sozlesme erken sonlandirilirsa uygulanacak ucret"
                  />
                </div>
              )}

              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {isLongTerm ? (
                      <Input
                        label="Aylik Kira Bedeli (TL)"
                        type="number"
                        value={rentalData.monthly_rate || ''}
                        onChange={(e) => setRentalData({ ...rentalData, monthly_rate: Number(e.target.value) })}
                      />
                    ) : (
                      <Input
                        label="Gunluk Ucret (TL)"
                        type="number"
                        value={rentalData.daily_rate || ''}
                        onChange={(e) => setRentalData({ ...rentalData, daily_rate: Number(e.target.value) })}
                      />
                    )}
                    <Input
                      label="Depozito (TL)"
                      type="number"
                      value={rentalData.deposit_amount || ''}
                      onChange={(e) => setRentalData({ ...rentalData, deposit_amount: Number(e.target.value) })}
                    />
                  </div>

                  <Select
                    label="Odeme Yontemi (Sozlesme)"
                    value={rentalData.agreed_payment_method}
                    onChange={(e) => setRentalData({ ...rentalData, agreed_payment_method: e.target.value as AgreedPaymentMethod })}
                    options={[
                      { value: 'transfer', label: 'Havale/EFT' },
                      { value: 'credit_card', label: 'Kredi Karti' },
                      { value: 'cash', label: 'Nakit' },
                      { value: 'check', label: 'Cek' },
                      { value: 'promissory_note', label: 'Senet' },
                    ]}
                  />

                  {rentalData.rental_model === 'rent_a_car' && (
                    <Select
                      label="Faturalama Tipi"
                      value={rentalData.billing_type}
                      onChange={(e) => setRentalData({ ...rentalData, billing_type: e.target.value as 'upfront' | 'monthly' })}
                      options={[
                        { value: 'upfront', label: 'Pesin' },
                        { value: 'monthly', label: 'Aylik' },
                      ]}
                    />
                  )}

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Vergi ve Muafiyet Ayarlari
                    </h4>
                    <p className="text-xs text-slate-500 mb-4">Bu ayarlar tum kiralama modelleri icin gecerlidir.</p>

                    {(isLongTerm || rentalData.billing_type === 'monthly') && (
                      <Select
                        label="Fatura Donemi"
                        value={rentalData.payment_timing}
                        onChange={(e) => setRentalData({ ...rentalData, payment_timing: e.target.value as PaymentTiming })}
                        options={[
                          { value: 'beginning_of_period', label: 'Donem Basi (Pesin)' },
                          { value: 'end_of_period', label: 'Donem Sonu (Vadeli)' },
                        ]}
                      />
                    )}

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <Select
                        label="KDV Orani"
                        value={rentalData.tax_rate.toString()}
                        onChange={(e) => setRentalData({ ...rentalData, tax_rate: Number(e.target.value) })}
                        options={[
                          { value: '0', label: '%0' },
                          { value: '10', label: '%10' },
                          { value: '20', label: '%20' },
                        ]}
                      />
                      <Select
                        label="Tevkifat Orani"
                        value={rentalData.withholding_rate}
                        onChange={(e) => setRentalData({ ...rentalData, withholding_rate: e.target.value as WithholdingRate })}
                        options={[
                          { value: 'none', label: 'Yok' },
                          { value: '5/10', label: '5/10 Tevkifat' },
                          { value: '7/10', label: '7/10 Tevkifat' },
                          { value: '9/10', label: '9/10 Tevkifat' },
                          { value: 'full_exemption', label: 'Tam Muafiyet' },
                        ]}
                      />
                    </div>
                  </div>

                  {paymentPreview && paymentPreview.length > 0 && (
                    <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2 mb-3">
                        <Info className="h-4 w-4 text-teal-600" />
                        <h4 className="font-medium text-slate-900">Odeme Plani Onizleme</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-3 font-medium text-slate-600">Vade</th>
                              <th className="text-right py-2 px-3 font-medium text-slate-600">Net</th>
                              <th className="text-right py-2 px-3 font-medium text-slate-600">KDV</th>
                              <th className="text-right py-2 px-3 font-medium text-slate-600">Tevkifat</th>
                              <th className="text-right py-2 px-3 font-medium text-slate-600">Toplam</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentPreview.map((schedule, index) => (
                              <tr key={index} className="border-b border-slate-100">
                                <td className="py-2 px-3">{format(parseISO(schedule.dueDate), 'd MMM yyyy', { locale: tr })}</td>
                                <td className="py-2 px-3 text-right">{formatCurrency(schedule.netAmount)}</td>
                                <td className="py-2 px-3 text-right">{formatCurrency(schedule.taxAmount)}</td>
                                <td className="py-2 px-3 text-right text-red-600">-{formatCurrency(schedule.withholdingDeduction)}</td>
                                <td className="py-2 px-3 text-right font-medium">{formatCurrency(schedule.totalPayable)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {(isLongTerm ? rentalData.contract_duration_months : Math.ceil(differenceInDays(
                          rentalData.end_datetime ? parseISO(rentalData.end_datetime) : new Date(),
                          rentalData.start_datetime ? parseISO(rentalData.start_datetime) : new Date()
                        ) / 30)) > 6 && (
                          <p className="text-xs text-slate-500 mt-2 text-center">...ve daha fazlasi</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                    <textarea
                      value={rentalData.notes}
                      onChange={(e) => setRentalData({ ...rentalData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div className="space-y-5">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <p className="text-sm font-medium text-amber-800">ARAC TESLIM DURUMU</p>
                    <p className="text-xs text-amber-600">Aracinizi teslim ederken mevcut hasar ve kosullarini kaydedin.</p>
                  </div>

                  <CarDamageSchema
                    value={rentalData.delivery_damage_condition}
                    onChange={(schema) => setRentalData({ ...rentalData, delivery_damage_condition: schema })}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Temizlik Durumu"
                      value={rentalData.start_cleanliness_status}
                      onChange={(e) => setRentalData({ ...rentalData, start_cleanliness_status: e.target.value as 'clean' | 'normal' | 'dirty' })}
                      options={[
                        { value: 'clean', label: 'Temiz' },
                        { value: 'normal', label: 'Normal' },
                        { value: 'dirty', label: 'Kirli' },
                      ]}
                    />
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Yakit Yuzde (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={rentalData.start_fuel_percentage}
                        onChange={(e) => setRentalData({ ...rentalData, start_fuel_percentage: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                  </div>

                  <VideoUpload
                    label="Video Kanıt (Teslim Öncesi)"
                    videoUrl={rentalData.delivery_video_url}
                    onVideoChange={(url) => setRentalData({ ...rentalData, delivery_video_url: url })}
                    storagePath={`deliveries/${vehicle?.plate || 'unknown'}`}
                  />

                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 mt-6 border-t border-slate-200">
                <div>
                  {wizardStep > 1 && (
                    <Button variant="secondary" onClick={() => setWizardStep(s => s - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Geri
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setShowRentalModal(false)}>
                    Iptal
                  </Button>
                  {wizardStep < 4 ? (
                    <Button onClick={() => setWizardStep(s => s + 1)}>
                      Devam
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button onClick={handleStartRental}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      {rentalData.rental_model === 'rent_a_car'
                        ? 'Kiralamaya Basla'
                        : rentalData.rental_model === 'operational_leasing'
                          ? 'Operasyonel Leasing Baslat'
                          : 'Finansal Leasing Baslat'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      <RentalDetailModal
        isOpen={showRentalDetail}
        onClose={() => {
          setShowRentalDetail(false);
          setSelectedRental(null);
        }}
        rental={selectedRental}
        vehicle={selectedRental ? vehicles.find(v => v.id === selectedRental.vehicle_id) || null : null}
        customer={selectedRental ? customers.find(c => c.id === selectedRental.customer_id) || null : null}
        companyId={companyId || ''}
        userEmail={user?.email}
        onUpdate={loadData}
      />
    </div>
  );
}
