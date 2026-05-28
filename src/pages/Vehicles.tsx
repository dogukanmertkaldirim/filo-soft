import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, CreditCard as Edit2, Trash2, Search, Car, FileText, History, Download, Wallet, TrendingUp, TrendingDown, FileSpreadsheet, Eye, FileDown, AlertTriangle, Receipt, Shield, Mail, Printer, Wrench, RotateCcw, ChevronUp, ChevronDown, MapPin, X, ZoomIn, UserPlus, Building, Key, ChevronRight, ChevronLeft, Check, PlayCircle, CreditCard, Info, Camera, Fuel, Droplets, Upload, Settings2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Vehicle, Customer, Rental, RentalExpense, Accident, CompanyProfile, Loan, Maintenance, Supplier, VehicleSale, AppUser, ServiceDetails } from '../types/database';
import MaintenanceDetailsView from '../components/maintenance/MaintenanceDetailsView';
import { formatCurrency, formatDate, formatCustomerLabel, formatVehicleLabel } from '../utils/format';
import { exportToExcel } from '../utils/exportExcel';
import { logActivity, formatVehicleDetails } from '../utils/auditLog';
import { getProposalEmailData, type EmailData } from '../utils/emailTemplates';
import { useAuth } from '../context/AuthContext';
import { usePagination } from '../hooks/usePagination';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';
import FileUpload from '../components/ui/FileUpload';
import EmailDropdown from '../components/ui/EmailDropdown';
import ProposalGenerator from '../components/documents/ProposalGenerator';
import ContractGenerator from '../components/documents/ContractGenerator';
import HandoverForm from '../components/handover/HandoverForm';
import Pagination from '../components/ui/Pagination';
import VehicleReturnModal from '../components/rental/VehicleReturnModal';
import DeliveryReturnReport from '../components/rental/DeliveryReturnReport';
import DeliveryReport from '../components/rental/DeliveryReport';
import { createPaymentSchedules, deletePaymentSchedulesForRental, calculateTaxBreakdown, getWithholdingRateLabel, LEASING_SERVICES, CONTRACT_DURATIONS, type WithholdingRate } from '../utils/paymentSchedule';
import { downloadVehicleTemplate, parseVehicleExcel, mapRowsToVehicles } from '../utils/vehicleImport';
import Autocomplete from '../components/ui/Autocomplete';
import CarDamageSchema from '../components/vehicle/CarDamageSchema';
import VideoUpload from '../components/rental/VideoUpload';
import VehicleActionsModal from '../components/vehicle/VehicleActionsModal';
import VehicleGalleryUpload from '../components/vehicle/VehicleGalleryUpload';
import ImageLightbox from '../components/ui/ImageLightbox';
import { toTurkishTitleCase } from '../utils/turkishCase';

type RentalModel = 'rent_a_car' | 'operational_leasing' | 'financial_leasing';

interface VehicleHandover {
  id: string;
  type: 'delivery' | 'return';
  fuel_level: number;
  current_km: number;
  exterior_photos: string[];
  general_notes: string | null;
  is_confirmed: boolean;
  confirmed_at: string | null;
  handover_date: string;
  staff?: { full_name: string };
}

interface VehicleFormData {
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string;
  chassis_number: string;
  photo_url: string | null;
  gallery_urls: string[];
  license_owner: string;
  license_document_url: string | null;
  initial_damage_status: string;
  damage_schema: Record<string, string>;
  purchase_price: number;
  purchase_date: string;
  traffic_insurance_expiry: string;
  traffic_insurance_agency: string;
  traffic_insurance_agent_name: string;
  traffic_insurance_agent_phone: string;
  traffic_insurance_amount: number;
  traffic_insurance_policy_url: string | null;
  kasko_expiry: string;
  kasko_agency: string;
  kasko_agent_name: string;
  kasko_agent_phone: string;
  kasko_amount: number;
  kasko_policy_url: string | null;
  inspection_expiry: string;
  tire_type: 'summer' | 'winter' | 'all_season' | '';
  tire_size: string;
  tire_brand: string;
  spare_tire_location: string;
  has_spare_key: boolean;
  spare_key_location: string;
  has_tracker: boolean;
  tracker_model: string;
  tracker_serial_number: string;
  gps_provider: string;
  gps_device_id: string;
  ownership_type: 'oz_mal' | 'kiralik';
  supplier_id: string;
  supplier_cost_price: number;
  supplier_cost_period: 'daily' | 'monthly';
  supplier_start_date: string;
  supplier_end_date: string;
  supplier_contract_url: string | null;
}

type SortField = 'plate' | 'brand' | 'status' | 'monthly_income' | 'created_at' | 'year' | 'start_date' | 'end_date' | 'loan_amount' | 'customer';
type SortDirection = 'asc' | 'desc';

const emptyForm: VehicleFormData = {
  plate: '',
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  color: '',
  chassis_number: '',
  photo_url: null,
  gallery_urls: [],
  license_owner: '',
  license_document_url: null,
  initial_damage_status: '',
  damage_schema: {},
  purchase_price: 0,
  purchase_date: '',
  traffic_insurance_expiry: '',
  traffic_insurance_agency: '',
  traffic_insurance_agent_name: '',
  traffic_insurance_agent_phone: '',
  traffic_insurance_amount: 0,
  traffic_insurance_policy_url: null,
  kasko_expiry: '',
  kasko_agency: '',
  kasko_agent_name: '',
  kasko_agent_phone: '',
  kasko_amount: 0,
  kasko_policy_url: null,
  inspection_expiry: '',
  tire_type: '',
  tire_size: '',
  tire_brand: '',
  spare_tire_location: '',
  has_spare_key: false,
  spare_key_location: '',
  has_tracker: false,
  tracker_model: '',
  tracker_serial_number: '',
  gps_provider: 'none',
  gps_device_id: '',
  ownership_type: 'oz_mal',
  supplier_id: '',
  supplier_cost_price: 0,
  supplier_cost_period: 'monthly',
  supplier_start_date: '',
  supplier_end_date: '',
  supplier_contract_url: null,
};

export default function Vehicles() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [vehicleSales, setVehicleSales] = useState<VehicleSale[]>([]);
  const [customerUsers, setCustomerUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'sold' | 'rented' | 'idle'>('active');
  const [viewMode, setViewMode] = useState<'active' | 'trash'>('active');

  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const pagination = usePagination(20);

  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [showRentalForm, setShowRentalForm] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [formData, setFormData] = useState<VehicleFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);

  const [companyProfiles, setCompanyProfiles] = useState<CompanyProfile[]>([]);

  const [insuranceSuggestions, setInsuranceSuggestions] = useState<{
    agencies: string[];
    agentMap: Record<string, string>;
  }>({ agencies: [], agentMap: {} });

  const [rentalVehicle, setRentalVehicle] = useState<Vehicle | null>(null);
  const [rentalWizardStep, setRentalWizardStep] = useState(1);
  const [rentalData, setRentalData] = useState({
    customer_id: '',
    company_profile_id: '',
    start_datetime: '',
    end_datetime: '',
    starting_km: 0,
    fuel_status: 'full' as 'empty' | '1/4' | '1/2' | '3/4' | 'full',
    daily_rate: 0,
    daily_km_limit: 0,
    monthly_km_limit: 0,
    per_km_overage_fee: 0,
    deposit_amount: 0,
    notes: '',
    initial_damage_notes: '',
    delivery_damage_condition: {} as Record<string, string>,
    start_cleanliness_status: 'clean' as 'clean' | 'normal' | 'dirty',
    start_fuel_percentage: 100,
    start_photos: [] as string[],
    delivery_video_url: null as string | null,
    contract_document_url: null as string | null,
    rental_model: 'rent_a_car' as RentalModel,
    contract_months: 12,
    monthly_rate: 0,
    tax_rate: 20,
    withholding_rate: 'none' as WithholdingRate,
    services_included: [] as string[],
    down_payment: 0,
    transfer_ownership: false,
    agreed_payment_method: 'transfer' as 'transfer' | 'credit_card' | 'cash' | 'check' | 'promissory_note',
  });
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [rentalCreationSuccess, setRentalCreationSuccess] = useState(false);
  const [createdRental, setCreatedRental] = useState<Rental | null>(null);
  const [showDeliveryReport, setShowDeliveryReport] = useState(false);

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returningVehicle, setReturningVehicle] = useState<Vehicle | null>(null);
  const [returningRental, setReturningRental] = useState<Rental | null>(null);
  const [returnData, setReturnData] = useState({
    return_datetime: '',
    return_km: 0,
    return_fuel_status: 'full' as 'empty' | '1/4' | '1/2' | '3/4' | 'full',
    return_cleanliness_status: 'clean' as 'clean' | 'normal' | 'dirty',
    handover_document_url: null as string | null,
    return_damage_notes: '',
  });
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutRental, setCheckoutRental] = useState<Rental | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyVehicle, setHistoryVehicle] = useState<Vehicle | null>(null);
  const [rentalHistory, setRentalHistory] = useState<(Rental & { customer_name?: string })[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'rentals' | 'maintenance' | 'accidents' | 'sales'>('rentals');
  const [vehicleMaintenances, setVehicleMaintenances] = useState<(Maintenance & { supplier?: Supplier })[]>([]);
  const [expandedMaintenanceId, setExpandedMaintenanceId] = useState<string | null>(null);
  const [vehicleAccidentsHistory, setVehicleAccidentsHistory] = useState<Accident[]>([]);
  const [vehicleSaleInfo, setVehicleSaleInfo] = useState<VehicleSale | null>(null);
  const [vehicleLifetimeStats, setVehicleLifetimeStats] = useState<{ totalIncome: number; totalExpenses: number } | null>(null);

  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>([]);

  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonRental, setComparisonRental] = useState<(Rental & { customer_name?: string }) | null>(null);
  const [contractCompanyProfile, setContractCompanyProfile] = useState<CompanyProfile | null>(null);

  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeVehicle, setFinanceVehicle] = useState<Vehicle | null>(null);
  const [vehicleTransactions, setVehicleTransactions] = useState<any[]>([]);
  const [loadingFinance, setLoadingFinance] = useState(false);
  const [financeDateRange, setFinanceDateRange] = useState({ start: '', end: '' });

  const [showRentalDetailModal, setShowRentalDetailModal] = useState(false);
  const [detailRental, setDetailRental] = useState<(Rental & { customer_name?: string }) | null>(null);
  const [detailVehicle, setDetailVehicle] = useState<Vehicle | null>(null);
  const [detailTab, setDetailTab] = useState<'expenses' | 'accidents' | 'handovers' | 'payment_schedule'>('expenses');
  const [rentalExpenses, setRentalExpenses] = useState<RentalExpense[]>([]);
  const [rentalAccidents, setRentalAccidents] = useState<Accident[]>([]);
  const [rentalHandovers, setRentalHandovers] = useState<VehicleHandover[]>([]);
  const [rentalPaymentSchedules, setRentalPaymentSchedules] = useState<import('../types/database').RentalPaymentSchedule[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showHandoverForm, setShowHandoverForm] = useState(false);
  const [handoverType, setHandoverType] = useState<'delivery' | 'return'>('delivery');

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseData, setExpenseData] = useState({
    expense_type: 'hgs' as 'hgs' | 'traffic_fine' | 'bridge_toll' | 'damage_repair' | 'other',
    amount: 0,
    expense_date: '',
    description: '',
    billable_to_customer: true,
  });

  const [showAccidentForm, setShowAccidentForm] = useState(false);
  const [accidentData, setAccidentData] = useState({
    accident_date: '',
    driver_fault_rate: 0,
    is_driver_alcohol_involved: false,
    insurance_type: 'none' as 'traffic' | 'kasko' | 'none',
    repair_cost: 0,
    valuation_loss: 0,
    accident_report_url: null as string | null,
    description: '',
    charge_to_customer: false,
  });

  const [showProposalModal, setShowProposalModal] = useState(false);
  const [proposalVehicle, setProposalVehicle] = useState<Vehicle | null>(null);
  const [proposalData, setProposalData] = useState({
    customer_id: '',
    daily_rate: 0,
  });

  const [showProposalGenerator, setShowProposalGenerator] = useState(false);
  const [proposalGeneratorVehicle, setProposalGeneratorVehicle] = useState<Vehicle | null>(null);
  const [showContractGenerator, setShowContractGenerator] = useState(false);
  const [contractRentalId, setContractRentalId] = useState<string>('');

  const [showEditRentalModal, setShowEditRentalModal] = useState(false);
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [editRentalData, setEditRentalData] = useState({
    start_date: '',
    end_date: '',
    daily_rate: 0,
    daily_km_limit: 0,
    per_km_overage_fee: 0,
    total_amount: 0,
    manual_total_override: false,
  });

  const [showAssignCustomerModal, setShowAssignCustomerModal] = useState(false);
  const [assignVehicle, setAssignVehicle] = useState<Vehicle | null>(null);
  const [selectedCustomerUserId, setSelectedCustomerUserId] = useState<string>('');
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [showMaintenanceCompleteModal, setShowMaintenanceCompleteModal] = useState(false);
  const [maintenanceVehicle, setMaintenanceVehicle] = useState<Vehicle | null>(null);
  const [maintenanceRepairCost, setMaintenanceRepairCost] = useState<number>(0);
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [savingMaintenanceComplete, setSavingMaintenanceComplete] = useState(false);

  const [showDeliveryReturnReport, setShowDeliveryReturnReport] = useState(false);
  const [deliveryReturnReportRentalId, setDeliveryReturnReportRentalId] = useState<string>('');

  const [showActionsModal, setShowActionsModal] = useState(false);
  const [actionsModalVehicle, setActionsModalVehicle] = useState<Vehicle | null>(null);

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleVehicle, setSaleVehicle] = useState<Vehicle | null>(null);
  const [saleFormData, setSaleFormData] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    sale_amount: 0,
    buyer_name: '',
    notes: '',
    notary_document_url: null as string | null,
    insurance_cancelled: false,
    casco_cancelled: false,
  });
  const [savingSale, setSavingSale] = useState(false);

  const [importing, setImporting] = useState(false);
  const [showExcelMenu, setShowExcelMenu] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const excelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (excelMenuRef.current && !excelMenuRef.current.contains(e.target as Node)) {
        setShowExcelMenu(false);
      }
    }
    if (showExcelMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExcelMenu]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'rented' || statusParam === 'idle') {
      setStatusFilter(statusParam);
      setViewMode('active');
    }
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      pagination.reset();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadData();
  }, [companyId, viewMode, debouncedSearch, statusFilter, pagination.page, pagination.pageSize, sortField, sortDirection]);

  useEffect(() => {
    loadSupportingData();
  }, [companyId]);

  async function loadSupportingData() {
    if (!companyId) return;

    const [customersRes, companyProfilesRes, customerUsersRes] = await Promise.all([
      supabase.from('customers').select('*').eq('company_id', companyId).is('deleted_at', null).order('company_title'),
      supabase.from('company_profiles').select('*').eq('company_id', companyId).order('created_at', { ascending: true }),
      supabase.from('app_users').select('*').eq('company_id', companyId).eq('role', 'customer').order('full_name'),
    ]);

    setCustomers(customersRes.data || []);
    setCompanyProfiles(companyProfilesRes.data || []);
    setCustomerUsers(customerUsersRes.data || []);

    loadInsuranceSuggestions();
  }

  async function loadInsuranceSuggestions() {
    if (!companyId) return;
    const { data } = await supabase
      .from('vehicles')
      .select('traffic_insurance_agency, traffic_insurance_agent_name, traffic_insurance_agent_phone, kasko_agency, kasko_agent_name, kasko_agent_phone')
      .eq('company_id', companyId)
      .is('deleted_at', null);

    if (!data) return;

    const agencySet = new Set<string>();
    const agentMap: Record<string, string> = {};

    for (const v of data) {
      if (v.traffic_insurance_agency) agencySet.add(v.traffic_insurance_agency);
      if (v.kasko_agency) agencySet.add(v.kasko_agency);
      if (v.traffic_insurance_agent_name && v.traffic_insurance_agent_phone) {
        agentMap[v.traffic_insurance_agent_name] = v.traffic_insurance_agent_phone;
      }
      if (v.kasko_agent_name && v.kasko_agent_phone) {
        agentMap[v.kasko_agent_name] = v.kasko_agent_phone;
      }
    }

    setInsuranceSuggestions({
      agencies: [...agencySet].sort((a, b) => a.localeCompare(b, 'tr')),
      agentMap,
    });
  }

  async function loadData() {
    if (!companyId) return;
    setLoading(true);

    let vehiclesQuery = supabase.from('vehicles').select('*', { count: 'exact' }).eq('company_id', companyId);

    if (viewMode === 'active') {
      vehiclesQuery = vehiclesQuery.is('deleted_at', null);

      if (statusFilter === 'sold') {
        vehiclesQuery = vehiclesQuery.eq('status', 'sold');
      } else if (statusFilter === 'rented') {
        vehiclesQuery = vehiclesQuery.eq('status', 'rented');
      } else if (statusFilter === 'idle') {
        vehiclesQuery = vehiclesQuery.eq('status', 'idle');
      } else if (statusFilter === 'active') {
        vehiclesQuery = vehiclesQuery.in('status', ['idle', 'rented', 'maintenance']);
      }
    } else if (viewMode === 'trash') {
      vehiclesQuery = vehiclesQuery.not('deleted_at', 'is', null);
    }

    if (debouncedSearch) {
      vehiclesQuery = vehiclesQuery.or(`plate.ilike.%${debouncedSearch}%,brand.ilike.%${debouncedSearch}%,model.ilike.%${debouncedSearch}%`);
    }

    const sortAscending = sortDirection === 'asc';
    if (sortField === 'plate') {
      vehiclesQuery = vehiclesQuery.order('plate', { ascending: sortAscending });
    } else if (sortField === 'brand') {
      vehiclesQuery = vehiclesQuery.order('brand', { ascending: sortAscending }).order('model', { ascending: sortAscending });
    } else if (sortField === 'status') {
      vehiclesQuery = vehiclesQuery.order('status', { ascending: sortAscending });
    } else {
      vehiclesQuery = vehiclesQuery.order('created_at', { ascending: sortAscending });
    }

    vehiclesQuery = vehiclesQuery.range(pagination.offset, pagination.offset + pagination.pageSize - 1);

    const [vehiclesRes, rentalsRes, loansRes, vehicleSalesRes, suppliersRes] = await Promise.all([
      vehiclesQuery,
      supabase.from('rentals').select('*').eq('company_id', companyId).eq('status', 'active'),
      supabase.from('loans').select('*').eq('company_id', companyId).eq('loan_type', 'vehicle').is('deleted_at', null),
      supabase.from('vehicle_sales').select('*').eq('company_id', companyId),
      supabase.from('suppliers').select('id, name').eq('company_id', companyId).is('deleted_at', null).order('name'),
    ]);

    setVehicles(vehiclesRes.data || []);
    setRentals(rentalsRes.data || []);
    setLoans(loansRes.data || []);
    setVehicleSales(vehicleSalesRes.data || []);
    setAllSuppliers(suppliersRes.data || []);
    pagination.setTotalCount(vehiclesRes.count || 0);
    setLoading(false);
  }

  async function handleContractUpload(file: File) {
    setUploadingContract(true);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    const filePath = `contracts/${fileName}`;

    const { error } = await supabase.storage.from('supplier-contracts').upload(filePath, file);
    if (error) {
      alert('Dosya yuklenemedi: ' + error.message);
      setUploadingContract(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('supplier-contracts').getPublicUrl(filePath);
    setFormData(prev => ({ ...prev, supplier_contract_url: publicUrl }));
    setUploadingContract(false);
  }

  function openAddForm() {
    setEditingVehicle(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEditForm(vehicle: Vehicle) {
    if (vehicle.deleted_at) {
      alert('Bu arac silinmistir, islem yapilamaz.');
      return;
    }
    setEditingVehicle(vehicle);
    setFormData({
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color || '',
      chassis_number: vehicle.chassis_number || '',
      photo_url: vehicle.photo_url,
      gallery_urls: (vehicle as any).gallery_urls || [],
      license_owner: vehicle.license_owner || '',
      license_document_url: vehicle.license_document_url,
      initial_damage_status: vehicle.initial_damage_status || '',
      damage_schema: (vehicle.damage_schema as Record<string, string>) || {},
      purchase_price: vehicle.purchase_price,
      purchase_date: vehicle.purchase_date || '',
      traffic_insurance_expiry: vehicle.traffic_insurance_expiry || '',
      traffic_insurance_agency: vehicle.traffic_insurance_agency || '',
      traffic_insurance_agent_name: vehicle.traffic_insurance_agent_name || '',
      traffic_insurance_agent_phone: vehicle.traffic_insurance_agent_phone || '',
      traffic_insurance_amount: vehicle.traffic_insurance_amount || 0,
      traffic_insurance_policy_url: vehicle.traffic_insurance_policy_url,
      kasko_expiry: vehicle.kasko_expiry || '',
      kasko_agency: vehicle.kasko_agency || '',
      kasko_agent_name: vehicle.kasko_agent_name || '',
      kasko_agent_phone: vehicle.kasko_agent_phone || '',
      kasko_amount: vehicle.kasko_amount || 0,
      kasko_policy_url: vehicle.kasko_policy_url,
      inspection_expiry: vehicle.inspection_expiry || '',
      tire_type: vehicle.tire_type || '',
      tire_size: vehicle.tire_size || '',
      tire_brand: vehicle.tire_brand || '',
      spare_tire_location: vehicle.spare_tire_location || '',
      has_spare_key: vehicle.has_spare_key || false,
      spare_key_location: vehicle.spare_key_location || '',
      has_tracker: vehicle.has_tracker || false,
      tracker_model: vehicle.tracker_model || '',
      tracker_serial_number: vehicle.tracker_serial_number || '',
      gps_provider: vehicle.gps_provider || 'none',
      gps_device_id: vehicle.gps_device_id || '',
      ownership_type: vehicle.ownership_type || 'oz_mal',
      supplier_id: vehicle.supplier_id || '',
      supplier_cost_price: vehicle.supplier_cost_price || 0,
      supplier_cost_period: vehicle.supplier_cost_period || 'monthly',
      supplier_start_date: vehicle.supplier_start_date || '',
      supplier_end_date: vehicle.supplier_end_date || '',
      supplier_contract_url: vehicle.supplier_contract_url || null,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.plate || !formData.brand || !formData.model || !companyId) return;

    setSaving(true);

    const plateUpper = formData.plate.trim().toUpperCase();
    const { data: existingPlate } = await supabase
      .from('vehicles')
      .select('id')
      .eq('company_id', companyId)
      .eq('plate', plateUpper)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingPlate && (!editingVehicle || existingPlate.id !== editingVehicle.id)) {
      alert(`"${plateUpper}" plakasi zaten kayitli. Ayni plaka ile ikinci arac ekleyemezsiniz.`);
      setSaving(false);
      return;
    }

    const vehicleData = {
      plate: plateUpper,
      brand: formData.brand,
      model: formData.model,
      year: formData.year,
      color: formData.color || null,
      chassis_number: formData.chassis_number || null,
      photo_url: formData.photo_url,
      gallery_urls: formData.gallery_urls,
      license_owner: formData.license_owner || null,
      license_document_url: formData.license_document_url,
      initial_damage_status: formData.initial_damage_status || null,
      damage_schema: Object.keys(formData.damage_schema).length > 0 ? formData.damage_schema : null,
      purchase_price: formData.purchase_price,
      purchase_date: formData.purchase_date || null,
      traffic_insurance_expiry: formData.traffic_insurance_expiry || null,
      traffic_insurance_agency: formData.traffic_insurance_agency || null,
      traffic_insurance_agent_name: formData.traffic_insurance_agent_name || null,
      traffic_insurance_agent_phone: formData.traffic_insurance_agent_phone || null,
      traffic_insurance_amount: formData.traffic_insurance_amount || null,
      traffic_insurance_policy_url: formData.traffic_insurance_policy_url,
      kasko_expiry: formData.kasko_expiry || null,
      kasko_agency: formData.kasko_agency || null,
      kasko_agent_name: formData.kasko_agent_name || null,
      kasko_agent_phone: formData.kasko_agent_phone || null,
      kasko_amount: formData.kasko_amount || null,
      kasko_policy_url: formData.kasko_policy_url,
      inspection_expiry: formData.inspection_expiry || null,
      tire_type: formData.tire_type || null,
      tire_size: formData.tire_size || null,
      tire_brand: formData.tire_brand || null,
      spare_tire_location: formData.spare_tire_location || null,
      has_spare_key: formData.has_spare_key,
      spare_key_location: formData.has_spare_key ? (formData.spare_key_location || null) : null,
      has_tracker: formData.has_tracker,
      tracker_model: formData.tracker_model || null,
      tracker_serial_number: formData.tracker_serial_number || null,
      gps_provider: formData.gps_provider || 'none',
      gps_device_id: formData.gps_device_id || null,
      ownership_type: formData.ownership_type,
      supplier_id: formData.ownership_type === 'kiralik' ? (formData.supplier_id || null) : null,
      supplier_cost_price: formData.ownership_type === 'kiralik' ? (formData.supplier_cost_price || null) : null,
      supplier_cost_period: formData.ownership_type === 'kiralik' ? (formData.supplier_cost_period || null) : null,
      supplier_start_date: formData.ownership_type === 'kiralik' ? (formData.supplier_start_date || null) : null,
      supplier_end_date: formData.ownership_type === 'kiralik' ? (formData.supplier_end_date || null) : null,
      supplier_contract_url: formData.ownership_type === 'kiralik' ? (formData.supplier_contract_url || null) : null,
      company_id: companyId,
    };

    let vehicleId: string;

    if (editingVehicle) {
      await supabase.from('vehicles').update(vehicleData).eq('id', editingVehicle.id);
      vehicleId = editingVehicle.id;

      await logActivity({
        action: 'UPDATE',
        entity: 'Vehicle',
        entityId: vehicleId,
        details: `Arac guncellendi: ${formData.plate} - ${formData.brand} ${formData.model}`,
        userEmail: user?.email,
        companyId: companyId,
      });
    } else {
      const { data } = await supabase.from('vehicles').insert(vehicleData).select().single();
      vehicleId = data!.id;

      await logActivity({
        action: 'CREATE',
        entity: 'Vehicle',
        entityId: vehicleId,
        details: `Yeni arac eklendi: ${formData.plate} - ${formData.brand} ${formData.model}`,
        userEmail: user?.email,
        companyId: companyId,
      });

      if (formData.purchase_price > 0) {
        await supabase.from('transactions').insert({
          type: 'expense',
          category: 'Vehicle Purchase',
          description: `Purchase of ${formData.plate}`,
          amount: formData.purchase_price,
          transaction_date: formData.purchase_date || new Date().toISOString().split('T')[0],
          vehicle_id: vehicleId,
          company_id: companyId,
        });
      }
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(vehicle: Vehicle) {
    if (!companyId || !confirm(`${vehicle.plate} aracini silmek istediginize emin misiniz?`)) return;

    await logActivity({
      action: 'DELETE',
      entity: 'Vehicle',
      entityId: vehicle.id,
      details: formatVehicleDetails(vehicle),
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase
      .from('vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', vehicle.id)
      .eq('company_id', companyId);
    loadData();
  }

  async function handleRestore(vehicle: Vehicle) {
    if (!companyId || !confirm('Bu araci geri yuklemek istediginizden emin misiniz?')) return;

    await logActivity({
      action: 'UPDATE',
      entity: 'Vehicle',
      entityId: vehicle.id,
      details: `Restored vehicle: ${vehicle.plate}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase
      .from('vehicles')
      .update({ deleted_at: null })
      .eq('id', vehicle.id)
      .eq('company_id', companyId);

    loadData();
  }

  function openProposalModal(vehicle: Vehicle) {
    if (vehicle.deleted_at) {
      alert('Bu arac silinmistir, islem yapilamaz.');
      return;
    }
    setProposalVehicle(vehicle);
    setProposalData({ customer_id: '', daily_rate: 0 });
    setShowProposalModal(true);
  }

  function openRentalForm(vehicle: Vehicle) {
    if (vehicle.deleted_at) {
      alert('Bu arac silinmistir, islem yapilamaz.');
      return;
    }
    setRentalVehicle(vehicle);
    setRentalWizardStep(1);
    const now = new Date();
    const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    const defaultProfile = companyProfiles.find(p => p.is_default) || companyProfiles[0];
    setRentalData({
      customer_id: '',
      company_profile_id: defaultProfile?.id || '',
      start_datetime: localDateTime,
      end_datetime: '',
      starting_km: vehicle.current_km || 0,
      fuel_status: 'full',
      daily_rate: 0,
      daily_km_limit: 0,
      monthly_km_limit: 0,
      per_km_overage_fee: 0,
      deposit_amount: 0,
      notes: '',
      initial_damage_notes: '',
      delivery_damage_condition: (vehicle.damage_schema as Record<string, string>) || {},
      start_cleanliness_status: 'clean',
      start_fuel_percentage: 100,
      start_photos: [],
      delivery_video_url: null,
      contract_document_url: null,
      rental_model: 'rent_a_car',
      contract_months: 12,
      monthly_rate: 0,
      tax_rate: 20,
      withholding_rate: 'none',
      services_included: [],
      down_payment: 0,
      transfer_ownership: false,
      agreed_payment_method: 'transfer',
    });
    setShowRentalForm(true);
  }

  function toggleRentalService(serviceKey: string) {
    setRentalData(prev => ({
      ...prev,
      services_included: prev.services_included.includes(serviceKey)
        ? prev.services_included.filter(s => s !== serviceKey)
        : [...prev.services_included, serviceKey],
    }));
  }

  async function handleCreateRental() {
    if (!rentalVehicle || !rentalData.customer_id || !rentalData.start_datetime) {
      alert('Lutfen tum gerekli alanlari doldurun');
      return;
    }

    const isLongTerm = rentalData.rental_model === 'operational_leasing' || rentalData.rental_model === 'financial_leasing';
    const isFinancialLeasing = rentalData.rental_model === 'financial_leasing';

    if (!isLongTerm && !rentalData.end_datetime) {
      alert('Bitiş tarihi gereklidir');
      return;
    }

    if (isLongTerm && (!rentalData.monthly_rate || rentalData.monthly_rate <= 0)) {
      alert('Uzun donem kiralama icin aylik ucret girilmelidir');
      return;
    }

    if (!isLongTerm && (!rentalData.daily_rate || rentalData.daily_rate <= 0)) {
      alert('Gunluk ucret girilmelidir');
      return;
    }

    setSaving(true);
    const startDate = new Date(rentalData.start_datetime);

    let endDate: Date;
    let totalAmount: number;
    let dailyRateForRecord: number;
    let billingType: 'upfront' | 'monthly';
    let contractMonths: number | null = null;

    if (isLongTerm) {
      const { addMonths } = await import('date-fns');
      endDate = addMonths(startDate, rentalData.contract_months);
      totalAmount = rentalData.monthly_rate * rentalData.contract_months;
      if (isFinancialLeasing) {
        totalAmount += rentalData.down_payment;
      }
      dailyRateForRecord = rentalData.monthly_rate / 30;
      billingType = 'monthly';
      contractMonths = rentalData.contract_months;
    } else {
      endDate = new Date(rentalData.end_datetime);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      totalAmount = days * rentalData.daily_rate;
      dailyRateForRecord = rentalData.daily_rate;
      billingType = 'upfront';
    }

    if (endDate <= startDate) {
      alert('Bitiş tarihi başlangıç tarihinden sonra olmalıdır');
      setSaving(false);
      return;
    }

    const legacyRentalType = rentalData.rental_model === 'rent_a_car' ? 'short_term' : 'operational_leasing';
    const endDateStr = isLongTerm
      ? endDate.toISOString().slice(0, 10)
      : rentalData.end_datetime.split('T')[0];
    const endDateTimeStr = isLongTerm
      ? `${endDateStr}T18:00`
      : rentalData.end_datetime;

    const rentalInsert = {
      vehicle_id: rentalVehicle.id,
      customer_id: rentalData.customer_id,
      company_profile_id: rentalData.company_profile_id || null,
      start_date: rentalData.start_datetime.split('T')[0],
      end_date: endDateStr,
      start_datetime: rentalData.start_datetime,
      end_datetime: endDateTimeStr,
      starting_km: rentalData.starting_km || null,
      fuel_status: rentalData.fuel_status,
      daily_rate: dailyRateForRecord,
      daily_km_limit: rentalData.rental_model === 'rent_a_car' ? (rentalData.daily_km_limit || null) : null,
      monthly_km_limit: isLongTerm ? (rentalData.monthly_km_limit || null) : null,
      per_km_overage_fee: rentalData.per_km_overage_fee || null,
      total_amount: totalAmount,
      deposit_amount: rentalData.deposit_amount,
      notes: rentalData.notes || null,
      delivery_damage_condition: rentalData.delivery_damage_condition,
      initial_damage_notes: rentalData.initial_damage_notes || null,
      start_cleanliness_status: rentalData.start_cleanliness_status,
      start_fuel_percentage: rentalData.start_fuel_percentage || 100,
      start_photos: rentalData.start_photos || [],
      delivery_video_url: rentalData.delivery_video_url || null,
      contract_document_url: rentalData.contract_document_url,
      status: 'active',
      company_id: companyId,
      rental_type: legacyRentalType,
      rental_model: rentalData.rental_model,
      billing_type: billingType,
      contract_months: contractMonths,
      contract_duration_months: isLongTerm ? rentalData.contract_months : null,
      tax_rate: rentalData.tax_rate,
      withholding_rate: rentalData.withholding_rate,
      services_included: isLongTerm ? rentalData.services_included : [],
      down_payment: isFinancialLeasing ? rentalData.down_payment : 0,
      transfer_ownership: isFinancialLeasing,
      monthly_price: isLongTerm ? rentalData.monthly_rate : null,
      early_termination_logic: 'pro_rata_daily',
      agreed_payment_method: rentalData.agreed_payment_method,
    };

    const { data: rental, error } = await supabase.from('rentals').insert(rentalInsert).select().single();

    if (error) {
      console.error('Rental create error:', error.message);
      alert('Kiralama olusturulurken bir hata olustu. Lutfen tekrar deneyin.');
      setSaving(false);
      return;
    }

    if (billingType === 'monthly' && contractMonths && companyId) {
      try {
        await createPaymentSchedules({
          rentalId: rental.id,
          companyId: companyId,
          startDate: rentalData.start_datetime.split('T')[0],
          monthlyNetAmount: rentalData.monthly_rate,
          contractMonths: contractMonths,
          taxRate: rentalData.tax_rate,
          withholdingRate: rentalData.withholding_rate,
        });
      } catch (scheduleError) {
        console.error('Error creating payment schedules:', scheduleError);
      }
    }

    await supabase.from('vehicles').update({ status: 'rented' }).eq('id', rentalVehicle.id);

    const customer = customers.find(c => c.id === rentalData.customer_id);
    const modelLabels: Record<RentalModel, string> = {
      'rent_a_car': 'Gunluk kiralama',
      'operational_leasing': 'Operasyonel leasing',
      'financial_leasing': 'Finansal leasing',
    };
    const modelLabel = modelLabels[rentalData.rental_model];
    const durationLabel = isLongTerm ? ` (${rentalData.contract_months} ay)` : '';
    await logActivity({
      action: 'CREATE',
      entity: 'Rental',
      entityId: rental.id,
      details: `Arac kiralandi: ${rentalVehicle.plate} -> ${customer?.company_title || 'Bilinmeyen Müşteri'} - ${modelLabel}${durationLabel}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    if (rentalData.deposit_amount > 0) {
      await supabase.from('transactions').insert({
        type: 'income',
        category: 'Rental Deposit',
        description: `Security deposit for ${rentalVehicle.plate}`,
        amount: rentalData.deposit_amount,
        transaction_date: rentalData.start_datetime.split('T')[0],
        vehicle_id: rentalVehicle.id,
        rental_id: rental.id,
        company_id: companyId,
      });
    }

    setSaving(false);
    setCreatedRental(rental);
    setRentalCreationSuccess(true);
    loadData();
  }

  function handleCloseRentalForm() {
    setShowRentalForm(false);
    setRentalCreationSuccess(false);
    setCreatedRental(null);
    setRentalWizardStep(1);
  }

  function handlePrintDeliveryReport() {
    setShowDeliveryReport(true);
  }

  function openEditRentalForm(rental: Rental) {
    setEditingRental(rental);
    setEditRentalData({
      start_date: rental.start_date,
      end_date: rental.end_date,
      daily_rate: rental.daily_rate,
      daily_km_limit: rental.daily_km_limit || 0,
      per_km_overage_fee: rental.per_km_overage_fee || 0,
      total_amount: rental.total_amount,
      manual_total_override: false,
    });
    setShowEditRentalModal(true);
  }

  async function handleSaveEditRental() {
    if (!editingRental) return;

    const startDate = new Date(editRentalData.start_date);
    const endDate = new Date(editRentalData.end_date);

    if (endDate <= startDate) {
      alert('Bitiş tarihi başlangıç tarihinden sonra olmalıdır');
      return;
    }

    setSaving(true);

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const calculatedTotal = days * editRentalData.daily_rate;
    const finalTotal = editRentalData.manual_total_override ? editRentalData.total_amount : calculatedTotal;

    const { data: result, error } = await supabase.rpc('update_rental_with_vehicle', {
      p_rental_id: editingRental.id,
      p_start_date: editRentalData.start_date,
      p_end_date: editRentalData.end_date,
      p_daily_rate: editRentalData.daily_rate,
      p_daily_km_limit: editRentalData.daily_km_limit || null,
      p_per_km_overage_fee: editRentalData.per_km_overage_fee || null,
      p_total_amount: editRentalData.manual_total_override ? finalTotal : null,
    });

    if (error) {
      console.error('Vehicle operation error:', error.message);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      setSaving(false);
      return;
    }

    if (result && !result.success) {
      console.error('Vehicle save error:', result.error);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      setSaving(false);
      return;
    }

    const vehicle = vehicles.find(v => v.id === editingRental.vehicle_id);
    await logActivity({
      action: 'UPDATE',
      entity: 'Rental',
      entityId: editingRental.id,
      details: `Kiralama guncellendi: ${vehicle?.plate || 'Bilinmeyen Arac'}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    setSaving(false);
    setShowEditRentalModal(false);
    loadData();
  }

  function openAssignCustomerModal(vehicle: Vehicle) {
    if (vehicle.deleted_at) {
      alert('Bu arac silinmistir, islem yapilamaz.');
      return;
    }
    setAssignVehicle(vehicle);
    const assignedUser = customerUsers.find(u =>
      u.linked_vehicle_ids?.includes(vehicle.id)
    );
    setSelectedCustomerUserId(assignedUser?.id || '');
    setShowAssignCustomerModal(true);
  }

  async function handleAssignCustomer() {
    if (!assignVehicle) return;

    setSavingAssignment(true);

    const previouslyAssignedUser = customerUsers.find(u =>
      u.linked_vehicle_ids?.includes(assignVehicle.id)
    );

    if (previouslyAssignedUser && previouslyAssignedUser.id !== selectedCustomerUserId) {
      const updatedIds = (previouslyAssignedUser.linked_vehicle_ids || [])
        .filter(id => id !== assignVehicle.id);

      await supabase
        .from('app_users')
        .update({ linked_vehicle_ids: updatedIds })
        .eq('id', previouslyAssignedUser.id);
    }

    if (selectedCustomerUserId) {
      const newAssignedUser = customerUsers.find(u => u.id === selectedCustomerUserId);
      if (newAssignedUser) {
        const currentIds = newAssignedUser.linked_vehicle_ids || [];
        if (!currentIds.includes(assignVehicle.id)) {
          const updatedIds = [...currentIds, assignVehicle.id];

          const { error } = await supabase
            .from('app_users')
            .update({ linked_vehicle_ids: updatedIds })
            .eq('id', selectedCustomerUserId);

          if (error) {
            console.error('Vehicle operation error:', error.message);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
            setSavingAssignment(false);
            return;
          }
        }
      }

      await logActivity({
        action: 'UPDATE',
        entity: 'Vehicle',
        entityId: assignVehicle.id,
        details: `Arac musteriye atandi: ${assignVehicle.plate} -> ${newAssignedUser?.full_name}`,
        userEmail: user?.email,
        companyId: companyId,
      });
    } else if (previouslyAssignedUser) {
      await logActivity({
        action: 'UPDATE',
        entity: 'Vehicle',
        entityId: assignVehicle.id,
        details: `Arac musteri atamasi kaldirildi: ${assignVehicle.plate}`,
        userEmail: user?.email,
        companyId: companyId,
      });
    }

    setSavingAssignment(false);
    setShowAssignCustomerModal(false);
    setAssignVehicle(null);
    loadData();
  }

  function openMaintenanceCompleteModal(vehicle: Vehicle) {
    setMaintenanceVehicle(vehicle);
    setMaintenanceRepairCost(0);
    setMaintenanceNotes('');
    setShowMaintenanceCompleteModal(true);
  }

  function openSaleForm(vehicle: Vehicle) {
    if (vehicle.deleted_at) {
      alert('Bu arac silinmistir, islem yapilamaz.');
      return;
    }
    if (vehicle.status === 'rented') {
      alert('Kiradaki arac satilamaz. Oncelikle araci teslim alin.');
      return;
    }
    setSaleVehicle(vehicle);
    setSaleFormData({
      sale_date: new Date().toISOString().split('T')[0],
      sale_amount: 0,
      buyer_name: '',
      notes: '',
      notary_document_url: null,
      insurance_cancelled: false,
      casco_cancelled: false,
    });
    setShowSaleModal(true);
  }

  async function handleSaleSubmit() {
    if (!saleVehicle || !companyId) return;
    if (!saleFormData.buyer_name.trim()) {
      alert('Alici adi zorunludur.');
      return;
    }
    if (saleFormData.sale_amount <= 0) {
      alert('Satis tutari sifirdan buyuk olmalidir.');
      return;
    }

    setSavingSale(true);

    try {
      const { error: saleError } = await supabase.from('vehicle_sales').insert({
        vehicle_id: saleVehicle.id,
        sale_date: saleFormData.sale_date,
        sale_amount: saleFormData.sale_amount,
        buyer_name: saleFormData.buyer_name.trim(),
        notes: saleFormData.notes.trim() || null,
        notary_document_url: saleFormData.notary_document_url,
        insurance_cancelled: saleFormData.insurance_cancelled,
        casco_cancelled: saleFormData.casco_cancelled,
        company_id: companyId,
      });

      if (saleError) throw saleError;

      await supabase.from('vehicles').update({ status: 'sold' }).eq('id', saleVehicle.id).eq('company_id', companyId);

      await supabase.from('transactions').insert({
        type: 'income',
        category: 'Vehicle Sale',
        description: `${saleVehicle.plate} satisi - ${saleFormData.buyer_name.trim()}`,
        amount: saleFormData.sale_amount,
        transaction_date: saleFormData.sale_date,
        vehicle_id: saleVehicle.id,
        company_id: companyId,
      });

      await logActivity({
        action: 'CREATE',
        entity: 'VehicleSale',
        details: `Arac satildi: ${saleVehicle.plate} - ${saleVehicle.brand} ${saleVehicle.model} -> ${saleFormData.buyer_name.trim()} - ${saleFormData.sale_amount.toLocaleString('tr-TR')} TL`,
        companyId,
      });

      setShowSaleModal(false);
      setSaleVehicle(null);
      loadData();
    } catch (err) {
      console.error('Error saving sale:', err);
      alert('Satis kaydedilirken hata olustu.');
    } finally {
      setSavingSale(false);
    }
  }

  async function handleUnassignVehicle(vehicle: Vehicle) {
    if (!confirm(`"${vehicle.plate}" aracının durumunu sıfırlamak istediğinize emin misiniz?\n\nBu işlem:\n- Araç durumunu "Boş" yapacak\n- Tüm kiralama bağlantılarını temizleyecek\n- Müşteri atamasını kaldıracak`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('vehicles')
        .update({
          status: 'idle',
          current_customer_id: null,
          current_rental_id: null,
          start_date: null,
          end_date: null,
        })
        .eq('id', vehicle.id);

      if (error) throw error;

      await logActivity({
        action: 'UPDATE',
        entity: 'Vehicle',
        entityId: vehicle.id,
        details: `Araç durumu sıfırlandı: ${vehicle.plate} (Zorla Sıfırlama)`,
        userEmail: user?.email,
        companyId: companyId,
      });

      loadData();
    } catch (err) {
      console.error('Error resetting vehicle:', err);
      alert('İşlem sırasında hata oluştu. Lütfen tekrar deneyin.');
    }
  }

  async function handleMaintenanceComplete() {
    if (!maintenanceVehicle) return;

    setSavingMaintenanceComplete(true);

    try {
      const { error: vehicleError } = await supabase
        .from('vehicles')
        .update({ status: 'idle' })
        .eq('id', maintenanceVehicle.id);

      if (vehicleError) throw vehicleError;

      if (maintenanceRepairCost > 0) {
        const { error: expenseError } = await supabase
          .from('expenses')
          .insert({
            vehicle_id: maintenanceVehicle.id,
            expense_type: 'other',
            amount: maintenanceRepairCost,
            expense_date: new Date().toISOString().slice(0, 10),
            description: `Bakim/Onarim Gideri - ${maintenanceVehicle.plate}`,
            notes: maintenanceNotes || null,
            company_id: companyId,
          });

        if (expenseError) console.error('Failed to create repair expense:', expenseError);
      }

      await logActivity({
        action: 'UPDATE',
        entity: 'Vehicle',
        entityId: maintenanceVehicle.id,
        details: `Arac bakimdan cikti: ${maintenanceVehicle.plate}${maintenanceRepairCost > 0 ? ` - Onarim: ${formatCurrency(maintenanceRepairCost)}` : ''}`,
        userEmail: user?.email,
        companyId: companyId,
      });

      setShowMaintenanceCompleteModal(false);
      setMaintenanceVehicle(null);
      loadData();
    } catch (err) {
      console.error('Error completing maintenance:', err);
      alert('Islem sirasinda hata olustu');
    } finally {
      setSavingMaintenanceComplete(false);
    }
  }

  function openReturnForm(vehicle: Vehicle) {
    if (vehicle.deleted_at) {
      alert('Bu arac silinmistir, islem yapilamaz.');
      return;
    }
    const rental = rentals.find(r => r.vehicle_id === vehicle.id);
    if (!rental) return;

    const rentalWithVehicle = {
      ...rental,
      vehicles: { plate_number: vehicle.plate, brand: vehicle.brand, model: vehicle.model },
      customers: customers.find(c => c.id === rental.customer_id),
    };
    setCheckoutRental(rentalWithVehicle as any);
    setShowCheckoutModal(true);
  }

  async function handleReturnVehicle() {
    if (!returningVehicle || !returningRental || !returnData.return_datetime) {
      alert('Please fill in all required fields');
      return;
    }

    if (returnData.return_km < (returningRental.starting_km || 0)) {
      alert('Return KM cannot be less than Starting KM');
      return;
    }

    setSaving(true);

    await supabase.from('rentals').update({
      status: 'completed',
      return_datetime: returnData.return_datetime,
      return_km: returnData.return_km,
      return_fuel_status: returnData.return_fuel_status,
      return_cleanliness_status: returnData.return_cleanliness_status,
      handover_document_url: returnData.handover_document_url,
      return_damage_notes: returnData.return_damage_notes || null,
    }).eq('id', returningRental.id);

    await supabase.from('vehicles').update({
      status: 'idle',
      current_km: returnData.return_km,
    }).eq('id', returningVehicle.id);

    const kmDiff = returnData.return_km - (returningRental.starting_km || 0);
    await logActivity({
      action: 'UPDATE',
      entity: 'Rental',
      entityId: returningRental.id,
      details: `Arac teslim alindi: ${returningVehicle.plate}. Kullanilan KM: ${kmDiff}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    setSaving(false);
    setShowReturnForm(false);
    loadData();
  }

  async function openRentalHistory(vehicle: Vehicle) {
    setHistoryVehicle(vehicle);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    setHistoryTab(vehicle.status === 'sold' ? 'sales' : 'rentals');

    const [rentalsRes, maintenancesRes, accidentsRes, transactionsRes] = await Promise.all([
      supabase
        .from('rentals')
        .select('*, customers(company_title)')
        .eq('company_id', companyId)
        .eq('vehicle_id', vehicle.id)
        .order('start_date', { ascending: false }),
      supabase
        .from('maintenances')
        .select('*, supplier:suppliers(*)')
        .eq('company_id', companyId)
        .eq('vehicle_id', vehicle.id)
        .order('entry_date', { ascending: false }),
      supabase
        .from('accidents')
        .select('*')
        .eq('company_id', companyId)
        .eq('vehicle_id', vehicle.id)
        .order('accident_date', { ascending: false }),
      supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('vehicle_id', vehicle.id),
    ]);

    const historyData = (rentalsRes.data || []).map(r => ({
      ...r,
      customer_name: (r as any).customers?.company_title || '-',
    }));

    setRentalHistory(historyData);
    setVehicleMaintenances(maintenancesRes.data || []);
    setVehicleAccidentsHistory(accidentsRes.data || []);

    // Calculate lifetime stats
    const transactions = transactionsRes.data || [];
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    setVehicleLifetimeStats({ totalIncome, totalExpenses });

    // Get sale info if sold
    const saleInfo = vehicleSales.find(s => s.vehicle_id === vehicle.id);
    setVehicleSaleInfo(saleInfo || null);

    setLoadingHistory(false);
  }

  async function openFinanceHistory(vehicle: Vehicle) {
    setFinanceVehicle(vehicle);
    setShowFinanceModal(true);
    setLoadingFinance(true);
    setFinanceDateRange({ start: '', end: '' });

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .eq('vehicle_id', vehicle.id)
      .order('transaction_date', { ascending: false });

    setVehicleTransactions(data || []);
    setLoadingFinance(false);
  }

  async function filterFinanceTransactions() {
    if (!financeVehicle) return;
    setLoadingFinance(true);

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('company_id', companyId)
      .eq('vehicle_id', financeVehicle.id)
      .order('transaction_date', { ascending: false });

    if (financeDateRange.start) {
      query = query.gte('transaction_date', financeDateRange.start);
    }
    if (financeDateRange.end) {
      query = query.lte('transaction_date', financeDateRange.end);
    }

    const { data } = await query;
    setVehicleTransactions(data || []);
    setLoadingFinance(false);
  }

  function getFinanceSummary() {
    const incomeCategories = ['Rental Income', 'Vehicle Sale', 'Rental Deposit', 'Other Income'];
    const totalIncome = vehicleTransactions
      .filter(t => t.type === 'income' || incomeCategories.includes(t.category))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const totalExpense = vehicleTransactions
      .filter(t => t.type === 'expense' && !incomeCategories.includes(t.category))
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    return {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
    };
  }

  async function toggleKabisStatus(rental: Rental) {
    const newStatus = !rental.kabis_notification_status;
    await supabase.from('rentals').update({ kabis_notification_status: newStatus }).eq('id', rental.id);
    setRentals(rentals.map(r => r.id === rental.id ? { ...r, kabis_notification_status: newStatus } : r));
  }

  async function openRentalDetail(vehicle: Vehicle) {
    setDetailVehicle(vehicle);
    setDetailTab('expenses');
    setShowRentalDetailModal(true);
    setLoadingDetail(true);

    const { data: freshRental, error: rentalError } = await supabase
      .from('rentals')
      .select('*')
      .eq('company_id', companyId)
      .eq('vehicle_id', vehicle.id)
      .eq('status', 'active')
      .maybeSingle();

    if (rentalError || !freshRental) {
      setShowRentalDetailModal(false);
      setLoadingDetail(false);
      return;
    }

    const customer = customers.find(c => c.id === freshRental.customer_id);
    setDetailRental({ ...freshRental, customer_name: customer?.company_title });

    const [expensesRes, accidentsRes, handoversRes, schedulesRes] = await Promise.all([
      supabase.from('rental_expenses').select('*').eq('company_id', companyId).eq('rental_id', freshRental.id).order('expense_date', { ascending: false }),
      supabase.from('accidents').select('*').eq('company_id', companyId).eq('rental_id', freshRental.id).order('accident_date', { ascending: false }),
      supabase.from('vehicle_handovers').select('*, staff:staff_id(full_name)').eq('company_id', companyId).eq('rental_id', freshRental.id).order('handover_date', { ascending: false }),
      supabase.from('rental_payment_schedules').select('*').eq('company_id', companyId).eq('rental_id', freshRental.id).order('due_date', { ascending: true }),
    ]);

    setRentalExpenses(expensesRes.data || []);
    setRentalAccidents(accidentsRes.data || []);
    setRentalHandovers((handoversRes.data || []).map(h => ({
      ...h,
      exterior_photos: h.exterior_photos || [],
      staff: h.staff as any
    })));
    setRentalPaymentSchedules(schedulesRes.data || []);
    setLoadingDetail(false);
  }

  async function handleHandoverSuccess() {
    setShowHandoverForm(false);
    if (detailRental && detailVehicle) {
      const { data } = await supabase
        .from('vehicle_handovers')
        .select('*, staff:staff_id(full_name)')
        .eq('company_id', companyId)
        .eq('rental_id', detailRental.id)
        .order('handover_date', { ascending: false });

      setRentalHandovers((data || []).map(h => ({
        ...h,
        exterior_photos: h.exterior_photos || [],
        staff: h.staff as any
      })));
    }
  }

  function openExpenseForm() {
    const today = new Date().toISOString().split('T')[0];
    setExpenseData({
      expense_type: 'hgs',
      amount: 0,
      expense_date: today,
      description: '',
      billable_to_customer: true,
    });
    setShowExpenseForm(true);
  }

  async function handleAddExpense() {
    if (!detailRental || !expenseData.expense_date || expenseData.amount <= 0) {
      alert('Lutfen tum alanlari doldurun');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.from('rental_expenses').insert({
      rental_id: detailRental.id,
      expense_type: expenseData.expense_type,
      amount: expenseData.amount,
      expense_date: expenseData.expense_date,
      description: expenseData.description || null,
      billable_to_customer: expenseData.billable_to_customer,
      company_id: companyId,
    }).select().single();

    if (error) {
      console.error('Vehicle operation error:', error.message);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      setSaving(false);
      return;
    }

    setRentalExpenses([data, ...rentalExpenses]);
    setShowExpenseForm(false);
    setSaving(false);
  }

  async function handleDeleteExpense(expenseId: string) {
    if (!confirm('Bu harcamayi silmek istediginizden emin misiniz?')) return;
    await supabase.from('rental_expenses').delete().eq('id', expenseId);
    setRentalExpenses(rentalExpenses.filter(e => e.id !== expenseId));
  }

  function openAccidentForm() {
    const today = new Date().toISOString().split('T')[0];
    setAccidentData({
      accident_date: today,
      driver_fault_rate: 0,
      is_driver_alcohol_involved: false,
      insurance_type: 'none',
      repair_cost: 0,
      valuation_loss: 0,
      accident_report_url: null,
      description: '',
      charge_to_customer: false,
    });
    setShowAccidentForm(true);
  }

  async function handleAddAccident() {
    if (!detailRental || !detailVehicle || !accidentData.accident_date) {
      alert('Lutfen tum alanlari doldurun');
      return;
    }

    setSaving(true);
    const { data, error } = await supabase.from('accidents').insert({
      rental_id: detailRental.id,
      vehicle_id: detailVehicle.id,
      accident_date: accidentData.accident_date,
      driver_fault_rate: accidentData.driver_fault_rate,
      is_driver_alcohol_involved: accidentData.is_driver_alcohol_involved,
      insurance_type: accidentData.insurance_type,
      repair_cost: accidentData.repair_cost,
      valuation_loss: accidentData.valuation_loss,
      accident_report_url: accidentData.accident_report_url,
      description: accidentData.description || null,
      charge_to_customer: accidentData.charge_to_customer,
      company_id: companyId,
    }).select().single();

    if (error) {
      console.error('Vehicle operation error:', error.message);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
      setSaving(false);
      return;
    }

    setRentalAccidents([data, ...rentalAccidents]);
    setShowAccidentForm(false);
    setSaving(false);
  }

  async function handleDeleteAccident(accidentId: string) {
    if (!confirm('Bu kaza kaydini silmek istediginizden emin misiniz?')) return;
    await supabase.from('accidents').delete().eq('id', accidentId);
    setRentalAccidents(rentalAccidents.filter(a => a.id !== accidentId));
  }

  function calculateRentalTotal(rental: Rental | null, expenses: RentalExpense[], accidents: Accident[]) {
    if (!rental) return { rentalAmount: 0, kmPenalty: 0, billableExpenses: 0, billableAccidents: 0, grandTotal: 0 };

    const startDate = new Date(rental.start_datetime || rental.start_date);
    const returnDate = rental.return_datetime ? new Date(rental.return_datetime) : new Date();
    const daysRented = Math.max(1, Math.ceil((returnDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const rentalAmount = daysRented * (rental.daily_rate || 0);

    const startKm = rental.starting_km || 0;
    const returnKm = rental.return_km || startKm;
    const drivenKm = returnKm - startKm;
    const dailyLimit = rental.daily_km_limit || 0;
    const allowedKm = dailyLimit > 0 ? daysRented * dailyLimit : null;
    const excessKm = allowedKm && drivenKm > allowedKm ? drivenKm - allowedKm : 0;
    const kmPenalty = excessKm * (rental.per_km_overage_fee || 0);

    const billableExpenses = expenses
      .filter(e => e.billable_to_customer)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const billableAccidents = accidents
      .filter(a => a.charge_to_customer)
      .reduce((sum, a) => sum + (a.repair_cost || 0) + (a.valuation_loss || 0), 0);

    return {
      rentalAmount,
      kmPenalty,
      billableExpenses,
      billableAccidents,
      grandTotal: rentalAmount + kmPenalty + billableExpenses + billableAccidents,
    };
  }

  const expenseTypeLabels: Record<string, string> = {
    hgs: 'HGS Gecis',
    traffic_fine: 'Trafik Cezasi',
    bridge_toll: 'Kopru Gecisi',
    damage_repair: 'Hasar Onarimi',
    other: 'Diger',
  };

  function getDownloadFilename(dataUrl: string | null | undefined, baseName: string): string {
    if (!dataUrl) return baseName;
    const isImage = dataUrl.startsWith('data:image');
    const isPdf = dataUrl.startsWith('data:application/pdf');
    if (isImage) {
      const match = dataUrl.match(/data:image\/(\w+)/);
      const ext = match ? match[1] : 'png';
      return `${baseName}.${ext}`;
    }
    if (isPdf) return `${baseName}.pdf`;
    return baseName;
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }

  function getMonthlyIncome(vehicleId: string): number {
    const rental = rentals.find(r => r.vehicle_id === vehicleId);
    return rental ? rental.daily_rate * 30 : 0;
  }

  const filteredVehicles = [...vehicles].sort((a, b) => {
    const getEndDate = (vehicleId: string) => {
      const rental = rentals.find(r => r.vehicle_id === vehicleId);
      return rental?.end_date || '9999-12-31';
    };

    const getLoanAmount = (vehicleId: string) => {
      const vehicleLoans = loans.filter(l => l.vehicle_id === vehicleId);
      return vehicleLoans.reduce((sum, l) => sum + (l.remaining_debt || 0), 0);
    };

    const getCustomerName = (vehicleId: string) => {
      const rental = rentals.find(r => r.vehicle_id === vehicleId);
      if (!rental) return 'zzz';
      const customer = customers.find(c => c.id === rental.customer_id);
      return customer?.company_title?.toLowerCase() || 'zzz';
    };

    if (sortField === 'start_date') {
      const getStartDate = (vehicleId: string) => {
        const rental = rentals.find(r => r.vehicle_id === vehicleId);
        return rental?.start_date || '9999-12-31';
      };
      const dateA = getStartDate(a.id);
      const dateB = getStartDate(b.id);
      return sortDirection === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }

    if (sortField === 'end_date') {
      const dateA = getEndDate(a.id);
      const dateB = getEndDate(b.id);
      return sortDirection === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
    }

    if (sortField === 'loan_amount') {
      const loanA = getLoanAmount(a.id);
      const loanB = getLoanAmount(b.id);
      return sortDirection === 'asc' ? loanA - loanB : loanB - loanA;
    }

    if (sortField === 'customer') {
      const customerA = getCustomerName(a.id);
      const customerB = getCustomerName(b.id);
      return sortDirection === 'asc' ? customerA.localeCompare(customerB) : customerB.localeCompare(customerA);
    }

    if (sortField === 'monthly_income') {
      const incomeA = getMonthlyIncome(a.id);
      const incomeB = getMonthlyIncome(b.id);
      return sortDirection === 'asc' ? incomeA - incomeB : incomeB - incomeA;
    }

    if (sortField === 'year') {
      const yearA = a.year || 0;
      const yearB = b.year || 0;
      return sortDirection === 'asc' ? yearA - yearB : yearB - yearA;
    }

    return 0;
  });

  async function handleExcelImport(file: File) {
    if (!companyId) return;
    setImporting(true);
    setImportResult(null);
    try {
      const rows = await parseVehicleExcel(file);
      if (rows.length === 0) {
        setImportResult({ success: 0, errors: ['Excel dosyasında veri bulunamadı.'] });
        setImporting(false);
        return;
      }
      const { vehicles: mapped, errors } = mapRowsToVehicles(rows, companyId);
      if (mapped.length === 0) {
        setImportResult({ success: 0, errors: errors.length > 0 ? errors : ['Geçerli araç verisi bulunamadı.'] });
        setImporting(false);
        return;
      }

      const importPlates = mapped.map(v => v.plate);
      const { data: existingVehicles } = await supabase
        .from('vehicles')
        .select('plate')
        .eq('company_id', companyId)
        .in('plate', importPlates)
        .is('deleted_at', null);
      const existingPlateSet = new Set((existingVehicles || []).map(v => v.plate));
      const filteredMapped = mapped.filter(v => {
        if (existingPlateSet.has(v.plate)) {
          errors.push(`"${v.plate}" plakası zaten sistemde kayıtlı, atlandı.`);
          return false;
        }
        return true;
      });

      if (filteredMapped.length === 0) {
        setImportResult({ success: 0, errors });
        setImporting(false);
        return;
      }

      const BATCH_SIZE = 500;
      let totalInserted = 0;
      for (let i = 0; i < filteredMapped.length; i += BATCH_SIZE) {
        const batch = filteredMapped.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('vehicles').insert(batch);
        if (error) {
          console.error(`Batch insert error (rows ${i + 2}-${i + batch.length + 1}):`, error.message);
          errors.push(`Satir ${i + 2}-${i + batch.length + 1} arasinda ekleme hatasi olustu.`);
        } else {
          totalInserted += batch.length;
        }
      }
      setImportResult({ success: totalInserted, errors });
      if (totalInserted > 0) {
        loadData();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata oluştu.';
      setImportResult({ success: 0, errors: [message] });
    }
    setImporting(false);
  }

  async function handleExportVehicles() {
    const [loansRes, transactionsRes] = await Promise.all([
      supabase.from('loans').select('*').eq('company_id', companyId),
      supabase.from('transactions').select('*').eq('company_id', companyId),
    ]);

    const loans = loansRes.data || [];
    const transactions = transactionsRes.data || [];

    const statusLabels: Record<string, string> = {
      idle: 'Bos',
      rented: 'Kirada',
      maintenance: 'Bakimda',
      sold: 'Satildi',
    };

    const formatPurchaseDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    };

    const exportData = filteredVehicles.map(vehicle => {
      const activeRental = rentals.find(
        r => r.vehicle_id === vehicle.id && r.status === 'active'
      );
      const customer = activeRental
        ? customers.find(c => c.id === activeRental.customer_id)
        : null;

      const vehicleLoans = loans.filter(l => l.vehicle_id === vehicle.id);
      const loanBanks = vehicleLoans.map(l => l.bank).join(', ') || '';
      const loanPaymentDays = vehicleLoans.map(l => l.payment_day).join(', ') || '';
      const totalMonthlyInstallment = vehicleLoans.reduce((sum, l) => sum + l.installment_amount, 0);
      const totalRemainingDebt = vehicleLoans.reduce((sum, l) => sum + l.remaining_debt, 0);

      const vehicleTransactions = transactions.filter(t => t.vehicle_id === vehicle.id);
      const totalIncome = vehicleTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = vehicleTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const netProfit = totalIncome - totalExpense;

      return {
        plaka: vehicle.plate,
        marka_model: `${vehicle.brand} ${vehicle.model}`,
        ruhsat_sahibi: vehicle.license_owner || '',
        arac_alim_tarihi: formatPurchaseDate(vehicle.purchase_date),
        arac_alim_bedeli: vehicle.purchase_price || '',
        durum: statusLabels[vehicle.status] || vehicle.status,
        guncel_musteri: customer?.company_title || '',
        kira_baslangic: activeRental?.start_date ? formatDate(activeRental.start_date) : '',
        kira_bitis: activeRental?.end_date ? formatDate(activeRental.end_date) : '',
        guncel_km: vehicle.current_km || '',
        kredi_bankasi: loanBanks,
        kredi_odeme_gunu: loanPaymentDays,
        kredi_taksit_tutari: totalMonthlyInstallment || '',
        kalan_kredi_borcu: totalRemainingDebt || '',
        sigorta_bitis: vehicle.traffic_insurance_expiry ? formatDate(vehicle.traffic_insurance_expiry) : '',
        kasko_bitis: vehicle.kasko_expiry ? formatDate(vehicle.kasko_expiry) : '',
        muayene_bitis: vehicle.inspection_expiry ? formatDate(vehicle.inspection_expiry) : '',
        toplam_gelir: totalIncome || '',
        toplam_gider: totalExpense || '',
        net_kar: netProfit || '',
        tahmini_guncel_deger: '',
      };
    });

    const columns = [
      { key: 'plaka' as const, header: 'Plaka' },
      { key: 'marka_model' as const, header: 'Marka/Model' },
      { key: 'ruhsat_sahibi' as const, header: 'Ruhsat Sahibi' },
      { key: 'arac_alim_tarihi' as const, header: 'Arac Alim Tarihi' },
      { key: 'arac_alim_bedeli' as const, header: 'Arac Alim Bedeli' },
      { key: 'durum' as const, header: 'Durum' },
      { key: 'guncel_musteri' as const, header: 'Guncel Müşteri' },
      { key: 'kira_baslangic' as const, header: 'Kira Baslangic' },
      { key: 'kira_bitis' as const, header: 'Kira Bitis' },
      { key: 'guncel_km' as const, header: 'Guncel KM' },
      { key: 'kredi_bankasi' as const, header: 'Kredi Bankasi' },
      { key: 'kredi_odeme_gunu' as const, header: 'Kredi Odeme Gunu' },
      { key: 'kredi_taksit_tutari' as const, header: 'Kredi Taksit Tutari' },
      { key: 'kalan_kredi_borcu' as const, header: 'Kalan Kredi Borcu' },
      { key: 'sigorta_bitis' as const, header: 'Sigorta Bitis' },
      { key: 'kasko_bitis' as const, header: 'Kasko Bitis' },
      { key: 'muayene_bitis' as const, header: 'Muayene Bitis' },
      { key: 'toplam_gelir' as const, header: 'Toplam Gelir' },
      { key: 'toplam_gider' as const, header: 'Toplam Gider' },
      { key: 'net_kar' as const, header: 'Net Kar' },
      { key: 'tahmini_guncel_deger' as const, header: 'Tahmini Guncel Deger' },
    ];

    exportToExcel(exportData, columns, 'Filo_Master_Rapor');
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Araclar</h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={handleExportVehicles}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Filo Master Rapor
          </Button>
          <div className="relative" ref={excelMenuRef}>
            <Button
              variant="secondary"
              onClick={() => setShowExcelMenu(!showExcelMenu)}
              disabled={importing}
            >
              {importing ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-teal-600 border-t-transparent mr-2" />
              ) : (
                <FileSpreadsheet className="h-4 w-4 mr-2" />
              )}
              {importing ? 'Aktariliyor...' : 'Excel Islemleri'}
            </Button>
            {showExcelMenu && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                <button
                  onClick={() => {
                    downloadVehicleTemplate();
                    setShowExcelMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                >
                  <Download className="h-4 w-4 text-slate-400" />
                  Ornek Sablon Indir
                </button>
                <label className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-colors">
                  <Upload className="h-4 w-4 text-slate-400" />
                  Excel ile Ice Aktar
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleExcelImport(file);
                        e.target.value = '';
                      }
                      setShowExcelMenu(false);
                    }}
                  />
                </label>
              </div>
            )}
          </div>
          <Button onClick={openAddForm}>
            <Plus className="h-4 w-4 mr-2" />
            Arac Ekle
          </Button>
        </div>
      </div>

      {importResult && (
        <div className={`mb-4 rounded-lg border p-4 ${importResult.success > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-start justify-between">
            <div>
              {importResult.success > 0 && (
                <p className="text-sm font-medium text-green-800">
                  {importResult.success} adet arac basariyla eklendi.
                </p>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-1">
                  <p className="text-sm font-medium text-red-800">Hatalar:</p>
                  <ul className="mt-1 text-xs text-red-700 space-y-0.5 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button onClick={() => setImportResult(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="flex flex-col gap-4">
            {/* View Mode Tabs - Active/Trash */}
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('active')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'active'
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Aktif Araclar
              </button>
              <button
                onClick={() => setViewMode('trash')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  viewMode === 'trash'
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Silinenler ({vehicles.length})
              </button>
            </div>

            {/* Status Filter and Search - Only shown in active mode */}
            {viewMode === 'active' && (
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setStatusFilter('active');
                      setSearchParams({});
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === 'active'
                        ? 'bg-teal-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Tumu ({vehicles.filter(v => v.status !== 'sold').length})
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter('rented');
                      setSearchParams({ status: 'rented' });
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === 'rented'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Kirada ({vehicles.filter(v => v.status === 'rented').length})
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter('idle');
                      setSearchParams({ status: 'idle' });
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === 'idle'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Bos ({vehicles.filter(v => v.status === 'idle').length})
                  </button>
                  <button
                    onClick={() => {
                      setStatusFilter('sold');
                      setSearchParams({});
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      statusFilter === 'sold'
                        ? 'bg-slate-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Satildi ({vehicles.filter(v => v.status === 'sold').length})
                  </button>
                </div>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Araç ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
            )}

            {/* Search only for trash mode */}
            {viewMode === 'trash' && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Silinen araclar icinde ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            )}
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
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Foto</th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('plate')}
                  >
                    <div className="flex items-center gap-1">
                      Plaka
                      <span className={`inline-flex ${sortField === 'plate' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'plate' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('brand')}
                  >
                    <div className="flex items-center gap-1">
                      Marka/Model
                      <span className={`inline-flex ${sortField === 'brand' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'brand' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-center py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('year')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Yıl
                      <span className={`inline-flex ${sortField === 'year' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'year' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Durum
                      <span className={`inline-flex ${sortField === 'status' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'status' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('customer')}
                  >
                    <div className="flex items-center gap-1">
                      Müşteri
                      <span className={`inline-flex ${sortField === 'customer' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'customer' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('start_date')}
                  >
                    <div className="flex items-center gap-1">
                      Başlangıç Tarihi
                      <span className={`inline-flex ${sortField === 'start_date' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'start_date' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-left py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('end_date')}
                  >
                    <div className="flex items-center gap-1">
                      Bitiş Tarihi
                      <span className={`inline-flex ${sortField === 'end_date' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'end_date' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('monthly_income')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Aylık Getiri
                      <span className={`inline-flex ${sortField === 'monthly_income' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'monthly_income' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th
                    className="text-right py-3 px-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100 select-none transition-colors"
                    onClick={() => handleSort('loan_amount')}
                  >
                    <div className="flex items-center justify-end gap-1">
                      Kredi Ödemesi
                      <span className={`inline-flex ${sortField === 'loan_amount' ? 'text-teal-600' : 'text-slate-300'}`}>
                        {sortField === 'loan_amount' && sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                    </div>
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v) => (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      {v.photo_url ? (
                        <button
                          onClick={() => {
                            const gallery = ((v as any).gallery_urls || []).filter((url: string) => url !== v.photo_url);
                            setLightboxImages([v.photo_url, ...gallery]);
                            setLightboxIndex(0);
                            setLightboxOpen(true);
                          }}
                          className="relative group"
                        >
                          <img src={v.photo_url} alt={v.plate} className="h-10 w-14 object-cover rounded" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                            <ZoomIn className="h-4 w-4 text-white" />
                          </div>
                          {((v as any).gallery_urls?.length || 0) > 1 && (
                            <span className="absolute -top-1 -right-1 bg-slate-700 text-white text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
                              {(v as any).gallery_urls.length}
                            </span>
                          )}
                        </button>
                      ) : (
                        <div className="h-10 w-14 bg-slate-100 rounded flex items-center justify-center">
                          <Car className="h-5 w-5 text-slate-400" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium">{v.plate}</td>
                    <td className="py-3 px-4">{v.brand} {v.model}</td>
                    <td className="py-3 px-4 text-center text-slate-600">{v.year || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            v.status === 'rented'
                              ? 'bg-green-100 text-green-700'
                              : v.status === 'idle'
                              ? 'bg-amber-100 text-amber-700'
                              : v.status === 'sold'
                              ? 'bg-red-100 text-red-700'
                              : v.status === 'maintenance'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {v.status === 'rented' ? 'Kirada' : v.status === 'idle' ? 'Bos' : v.status === 'sold' ? 'SATILDI' : v.status === 'maintenance' ? 'Bakimda' : v.status}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-[10px] font-semibold rounded-full ${
                          v.ownership_type === 'kiralik'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-sky-100 text-sky-700'
                        }`}>
                          {v.ownership_type === 'kiralik' ? 'Kiralik' : 'Oz Mal'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {(() => {
                        const rental = rentals.find(r => r.vehicle_id === v.id);
                        if (rental) {
                          const customer = customers.find(c => c.id === rental.customer_id);
                          return customer ? formatCustomerLabel(customer) : '-';
                        }
                        return <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {(() => {
                        const rental = rentals.find(r => r.vehicle_id === v.id);
                        return rental ? formatDate(rental.start_date) : <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {(() => {
                        const rental = rentals.find(r => r.vehicle_id === v.id);
                        return rental ? formatDate(rental.end_date) : <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(() => {
                        const rental = rentals.find(r => r.vehicle_id === v.id);
                        if (rental && rental.daily_rate > 0) {
                          const monthlyIncome = rental.daily_rate * 30;
                          return <span className="text-green-600 font-medium">{formatCurrency(monthlyIncome)}</span>;
                        }
                        return <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {(() => {
                        const vehicleLoans = loans.filter(l => l.vehicle_id === v.id && l.remaining_debt > 0);
                        if (vehicleLoans.length > 0) {
                          const monthlyPayment = vehicleLoans.reduce((sum, l) => sum + l.installment_amount, 0);
                          return <span className="text-red-600 font-medium">{formatCurrency(monthlyPayment)}</span>;
                        }
                        return <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center">
                        {viewMode === 'active' ? (
                          <button
                            onClick={() => {
                              setActionsModalVehicle(v);
                              setShowActionsModal(true);
                            }}
                            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors"
                            title="Islemler"
                          >
                            <Settings2 className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestore(v)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Geri Yukle
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredVehicles.length === 0 && !loading && (
              <p className="text-center py-8 text-slate-500">Arac bulunamadi</p>
            )}

            {pagination.totalCount > 0 && (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                totalCount={pagination.totalCount}
                pageSize={pagination.pageSize}
                hasNextPage={pagination.hasNextPage}
                hasPrevPage={pagination.hasPrevPage}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingVehicle ? 'Arac Duzenle' : 'Arac Ekle'}
        size="full"
      >
        <div className="space-y-6">
          {/* Ownership Type Toggle */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
            <label className="text-sm font-medium text-slate-700 block mb-3">Arac Sahiplik Turu</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, ownership_type: 'oz_mal' })}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  formData.ownership_type === 'oz_mal'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${formData.ownership_type === 'oz_mal' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                  Oz Mal Arac
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, ownership_type: 'kiralik' })}
                className={`flex-1 py-3 px-4 rounded-lg border-2 text-sm font-medium transition-all ${
                  formData.ownership_type === 'kiralik'
                    ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${formData.ownership_type === 'kiralik' ? 'bg-orange-500' : 'bg-slate-300'}`} />
                  Disaridan Kiralik Arac
                </div>
              </button>
            </div>

            {formData.ownership_type === 'kiralik' && (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tedarikci Firma</label>
                    <select
                      value={formData.supplier_id}
                      onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Tedarikci Secin</option>
                      {allSuppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        label="Tedarik Maliyeti (TL)"
                        type="number"
                        value={formData.supplier_cost_price || ''}
                        onChange={(e) => setFormData({ ...formData, supplier_cost_price: Number(e.target.value) })}
                        placeholder="0"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Periyot</label>
                      <select
                        value={formData.supplier_cost_period}
                        onChange={(e) => setFormData({ ...formData, supplier_cost_period: e.target.value as 'daily' | 'monthly' })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="monthly">Aylik</option>
                        <option value="daily">Gunluk</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Tedarik Baslangic Tarihi"
                    type="date"
                    value={formData.supplier_start_date}
                    onChange={(e) => setFormData({ ...formData, supplier_start_date: e.target.value })}
                  />
                  <Input
                    label="Tedarik Bitis Tarihi"
                    type="date"
                    value={formData.supplier_end_date}
                    onChange={(e) => setFormData({ ...formData, supplier_end_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Tedarik Sozlesmesi Yukle (PDF / Gorsel)</label>
                  {formData.supplier_contract_url ? (
                    <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-green-800 truncate">Sozlesme yuklendi</p>
                        <a
                          href={formData.supplier_contract_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-600 hover:underline"
                        >
                          Belgeyi Goruntule
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, supplier_contract_url: null })}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Kaldir"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      uploadingContract ? 'border-teal-300 bg-teal-50' : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
                    }`}>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/*"
                        disabled={uploadingContract}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleContractUpload(file);
                          e.target.value = '';
                        }}
                      />
                      {uploadingContract ? (
                        <div className="flex items-center gap-2 text-teal-600">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600" />
                          <span className="text-sm">Yukleniyor...</span>
                        </div>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <span className="text-sm text-slate-600">PDF veya gorsel yukleyin</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Maks. 10MB</span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              label="Plaka *"
              value={formData.plate}
              onChange={(e) => setFormData({ ...formData, plate: e.target.value })}
              placeholder="34 ABC 123"
            />
            <Input
              label="Marka *"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              onBlur={() => setFormData(prev => ({ ...prev, brand: toTurkishTitleCase(prev.brand) }))}
              placeholder="Ford"
            />
            <Input
              label="Model *"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              onBlur={() => setFormData(prev => ({ ...prev, model: toTurkishTitleCase(prev.model) }))}
              placeholder="Focus"
            />
            <Input
              label="Yil"
              type="number"
              value={formData.year || ''}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || null })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              label="Renk"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            />
            <Input
              label="Sasi No"
              value={formData.chassis_number}
              onChange={(e) => setFormData({ ...formData, chassis_number: e.target.value })}
              placeholder="VIN / Sasi Numarasi"
            />
            <Input
              label="Ruhsat Sahibi"
              value={formData.license_owner}
              onChange={(e) => setFormData({ ...formData, license_owner: e.target.value })}
            />
            <Input
              label="Alis Tarihi"
              type="date"
              value={formData.purchase_date}
              onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
            />
            <CurrencyInput
              label="Alis Fiyati"
              value={formData.purchase_price}
              onChange={(v) => setFormData({ ...formData, purchase_price: v })}
            />
          </div>

          <VehicleGalleryUpload
            galleryUrls={formData.gallery_urls}
            coverUrl={formData.photo_url}
            plateNumber={formData.plate}
            onGalleryChange={(urls) => setFormData({ ...formData, gallery_urls: urls })}
            onCoverChange={(url) => setFormData({ ...formData, photo_url: url })}
          />

          <FileUpload
            label="Ruhsat Belgesi (Foto/PDF)"
            accept="image/*,.pdf"
            value={formData.license_document_url}
            onChange={(v) => setFormData({ ...formData, license_document_url: v })}
            downloadFilename={`${formData.plate || 'arac'}_ruhsat`}
          />

          <CarDamageSchema
            value={formData.damage_schema}
            onChange={(schema) => setFormData({ ...formData, damage_schema: schema })}
          />

          <Input
            label="Hasar Notu (opsiyonel)"
            value={formData.initial_damage_status}
            onChange={(e) => setFormData({ ...formData, initial_damage_status: e.target.value })}
            placeholder="Ek hasar aciklamasi..."
          />

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-medium text-slate-900 mb-4">Trafik Sigortasi</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Bitiş Tarihi"
                type="date"
                value={formData.traffic_insurance_expiry}
                onChange={(e) => setFormData({ ...formData, traffic_insurance_expiry: e.target.value })}
              />
              <Autocomplete
                label="Acenta"
                value={formData.traffic_insurance_agency}
                onChange={(v) => setFormData({ ...formData, traffic_insurance_agency: v })}
                suggestions={insuranceSuggestions.agencies}
                placeholder="AXA Sigorta..."
              />
              <Autocomplete
                label="Acente Yetkilisi"
                value={formData.traffic_insurance_agent_name}
                onChange={(v) => {
                  const phone = insuranceSuggestions.agentMap[v];
                  setFormData(prev => ({
                    ...prev,
                    traffic_insurance_agent_name: v,
                    ...(phone ? { traffic_insurance_agent_phone: phone } : {}),
                  }));
                }}
                suggestions={Object.keys(insuranceSuggestions.agentMap)}
              />
              <Input
                label="Yetkili Telefon"
                value={formData.traffic_insurance_agent_phone}
                onChange={(e) => setFormData({ ...formData, traffic_insurance_agent_phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <CurrencyInput
                label="Tutar"
                value={formData.traffic_insurance_amount}
                onChange={(v) => setFormData({ ...formData, traffic_insurance_amount: v })}
              />
              <FileUpload
                label="Police Belgesi"
                value={formData.traffic_insurance_policy_url}
                onChange={(v) => setFormData({ ...formData, traffic_insurance_policy_url: v })}
                downloadFilename={`${formData.plate || 'arac'}_trafik_sigortasi`}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-medium text-slate-900 mb-4">Kasko</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Bitiş Tarihi"
                type="date"
                value={formData.kasko_expiry}
                onChange={(e) => setFormData({ ...formData, kasko_expiry: e.target.value })}
              />
              <Autocomplete
                label="Acenta"
                value={formData.kasko_agency}
                onChange={(v) => setFormData({ ...formData, kasko_agency: v })}
                suggestions={insuranceSuggestions.agencies}
                placeholder="AXA Sigorta..."
              />
              <Autocomplete
                label="Acente Yetkilisi"
                value={formData.kasko_agent_name}
                onChange={(v) => {
                  const phone = insuranceSuggestions.agentMap[v];
                  setFormData(prev => ({
                    ...prev,
                    kasko_agent_name: v,
                    ...(phone ? { kasko_agent_phone: phone } : {}),
                  }));
                }}
                suggestions={Object.keys(insuranceSuggestions.agentMap)}
              />
              <Input
                label="Yetkili Telefon"
                value={formData.kasko_agent_phone}
                onChange={(e) => setFormData({ ...formData, kasko_agent_phone: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <CurrencyInput
                label="Tutar"
                value={formData.kasko_amount}
                onChange={(v) => setFormData({ ...formData, kasko_amount: v })}
              />
              <FileUpload
                label="Police Belgesi"
                value={formData.kasko_policy_url}
                onChange={(v) => setFormData({ ...formData, kasko_policy_url: v })}
                downloadFilename={`${formData.plate || 'arac'}_kasko`}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-medium text-slate-900 mb-4">Muayene</h3>
            <Input
              label="Muayene Bitiş Tarihi"
              type="date"
              value={formData.inspection_expiry}
              onChange={(e) => setFormData({ ...formData, inspection_expiry: e.target.value })}
              className="max-w-xs"
            />
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-medium text-slate-900 mb-4">Lastikler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                label="Lastik Tipi"
                value={formData.tire_type}
                onChange={(e) => setFormData({ ...formData, tire_type: e.target.value as any })}
                options={[
                  { value: '', label: 'Secin...' },
                  { value: 'summer', label: 'Yaz' },
                  { value: 'winter', label: 'Kis' },
                  { value: 'all_season', label: 'Dort Mevsim' },
                ]}
              />
              <Input
                label="Ebat"
                value={formData.tire_size}
                onChange={(e) => setFormData({ ...formData, tire_size: e.target.value })}
                placeholder="205/55R16"
              />
              <Input
                label="Marka"
                value={formData.tire_brand}
                onChange={(e) => setFormData({ ...formData, tire_brand: e.target.value })}
              />
              <Input
                label="Stepne Konumu"
                value={formData.spare_tire_location}
                onChange={(e) => setFormData({ ...formData, spare_tire_location: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
              <Key className="h-4 w-4 text-slate-500" />
              Yedek Anahtar
            </h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.has_spare_key}
                    onChange={(e) => setFormData({ ...formData, has_spare_key: e.target.checked, spare_key_location: e.target.checked ? formData.spare_key_location : '' })}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-teal-500 transition-colors" />
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
                </div>
                <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900">Yedek Anahtar Var mi?</span>
              </label>
              {formData.has_spare_key && (
                <div className="max-w-md">
                  <Input
                    label="Yedek Anahtar Konumu"
                    value={formData.spare_key_location}
                    onChange={(e) => setFormData({ ...formData, spare_key_location: e.target.value })}
                    placeholder="Merkez Ofis Kasa"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              GPS Takip Sistemi
            </h3>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">Bu aracta kurulu olan takip sistemini secin. Entegrasyon ayarlari Entegrasyon Merkezi'nden yapilandirilir.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Select
                label="GPS Saglayici"
                value={formData.gps_provider}
                onChange={(e) => setFormData({ ...formData, gps_provider: e.target.value })}
                options={[
                  { value: 'none', label: 'Takip sistemi yok' },
                  { value: 'arvento', label: 'Arvento' },
                  { value: 'mobiliz', label: 'Mobiliz' },
                  { value: 'trio', label: 'Trio Mobil' },
                  { value: 'filoturk', label: 'FiloTurk' },
                  { value: 'other', label: 'Diger' },
                ]}
              />
              {formData.gps_provider !== 'none' && (
                <Input
                  label="Cihaz ID / IMEI"
                  value={formData.gps_device_id}
                  onChange={(e) => setFormData({ ...formData, gps_device_id: e.target.value })}
                  placeholder="Saglayici tarafindan verilen cihaz kimlik numarasi"
                />
              )}
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Fiziksel Cihaz Bilgileri (Opsiyonel)</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.has_tracker}
                      onChange={(e) => setFormData({ ...formData, has_tracker: e.target.checked })}
                      className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700">Fiziksel cihaz bilgisi kaydet</span>
                  </label>
                </div>
                {formData.has_tracker && (
                  <>
                    <Input
                      label="Cihaz Modeli"
                      value={formData.tracker_model}
                      onChange={(e) => setFormData({ ...formData, tracker_model: e.target.value })}
                      placeholder="Marka/Model"
                    />
                    <Input
                      label="Seri Numarasi"
                      value={formData.tracker_serial_number}
                      onChange={(e) => setFormData({ ...formData, tracker_serial_number: e.target.value })}
                      placeholder="Cihaz seri no"
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingVehicle ? 'Guncelle' : 'Olustur'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showRentalForm}
        onClose={handleCloseRentalForm}
        title={rentalCreationSuccess ? '' : `Yeni Kiralama: ${rentalVehicle?.plate}`}
        size="xl"
      >
        {rentalCreationSuccess ? (
          <div className="py-8 px-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <Check className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Kiralama Basariyla Olusturuldu</h2>
              <p className="text-slate-600 mb-8 max-w-md">
                {rentalVehicle?.plate} plakali arac icin kiralama islemi tamamlandi.
                Simdi teslim tutanagini yazdirabilirsiniz.
              </p>

              <div className="bg-slate-50 rounded-xl p-6 mb-8 w-full max-w-md">
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <Car className="h-6 w-6 text-slate-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-slate-900">{rentalVehicle?.plate}</p>
                    <p className="text-sm text-slate-500">{rentalVehicle?.brand} {rentalVehicle?.model}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500">Müşteri:</span>
                    <p className="font-medium text-slate-900">
                      {customers.find(c => c.id === rentalData.customer_id)?.company_title || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Baslangic:</span>
                    <p className="font-medium text-slate-900">
                      {rentalData.start_datetime ? new Date(rentalData.start_datetime).toLocaleDateString('tr-TR') : '-'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handlePrintDeliveryReport}
                  className="flex items-center gap-2 px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors font-semibold shadow-lg shadow-teal-600/20"
                >
                  <Printer className="h-5 w-5" />
                  Teslim Tutanagini Yazdir
                </button>
                <button
                  onClick={handleCloseRentalForm}
                  className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
                >
                  Kapat
                </button>
              </div>
            </div>
          </div>
        ) : (
        (() => {
          const isLongTerm = rentalData.rental_model === 'operational_leasing' || rentalData.rental_model === 'financial_leasing';
          const isFinancialLeasing = rentalData.rental_model === 'financial_leasing';

          const stepLabels: Record<RentalModel, string> = {
            'rent_a_car': 'Kiralama Detaylari',
            'operational_leasing': 'Operasyonel Leasing',
            'financial_leasing': 'Finansal Leasing',
          };

          const wizardSteps = [
            { step: 1, label: 'Kiralama Modeli', icon: Car },
            { step: 2, label: stepLabels[rentalData.rental_model], icon: FileText },
            { step: 3, label: 'Finansal Bilgiler', icon: CreditCard },
            { step: 4, label: 'Arac Durumu', icon: Camera },
          ];

          return (
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
                {wizardSteps.map((s, i) => (
                  <div key={s.step} className="flex items-center">
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                        rentalWizardStep === s.step
                          ? 'bg-teal-50 text-teal-700'
                          : rentalWizardStep > s.step
                          ? 'text-teal-600'
                          : 'text-slate-400'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          rentalWizardStep === s.step
                            ? 'bg-teal-600 text-white'
                            : rentalWizardStep > s.step
                            ? 'bg-teal-100 text-teal-600'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {rentalWizardStep > s.step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                      </div>
                      <span className="text-sm font-medium hidden sm:block">{s.label}</span>
                    </div>
                    {i < wizardSteps.length - 1 && (
                      <ChevronRight className="h-5 w-5 mx-2 text-slate-300" />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 rounded-lg mb-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <Car className="h-6 w-6 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{rentalVehicle?.plate}</p>
                    <p className="text-sm text-slate-500">{rentalVehicle?.brand} {rentalVehicle?.model} ({rentalVehicle?.year})</p>
                  </div>
                </div>
              </div>

              {rentalWizardStep === 1 && (
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

              {rentalWizardStep === 2 && rentalData.rental_model === 'rent_a_car' && (
                <div className="space-y-4">
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg mb-4">
                    <p className="text-sm font-medium text-teal-800">RENT A CAR - Kisa Donem Kiralama</p>
                    <p className="text-xs text-teal-600">Gunluk/haftalik kiralamalar icin tarih ve KM limiti belirleyin.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Müşteri *"
                      value={rentalData.customer_id}
                      onChange={(e) => setRentalData({ ...rentalData, customer_id: e.target.value })}
                      options={[
                        { value: '', label: 'Müşteri secin...' },
                        ...customers.map(c => ({ value: c.id, label: formatCustomerLabel(c) })),
                      ]}
                    />
                    <Select
                      label="Şirket Profili"
                      value={rentalData.company_profile_id}
                      onChange={(e) => setRentalData({ ...rentalData, company_profile_id: e.target.value })}
                      options={[
                        { value: '', label: 'Şirket secin...' },
                        ...companyProfiles.map(p => ({ value: p.id, label: `${p.title}${p.is_default ? ' (Varsayilan)' : ''}` })),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Başlangıç Tarih/Saat *"
                      type="datetime-local"
                      value={rentalData.start_datetime}
                      onChange={(e) => setRentalData({ ...rentalData, start_datetime: e.target.value })}
                    />
                    <Input
                      label="Bitiş Tarih/Saat *"
                      type="datetime-local"
                      value={rentalData.end_datetime}
                      onChange={(e) => setRentalData({ ...rentalData, end_datetime: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Başlangıç KM"
                      type="number"
                      value={rentalData.starting_km || ''}
                      onChange={(e) => setRentalData({ ...rentalData, starting_km: Number(e.target.value) })}
                    />
                    <Input
                      label="Gunluk KM Limiti"
                      type="number"
                      value={rentalData.daily_km_limit || ''}
                      onChange={(e) => setRentalData({ ...rentalData, daily_km_limit: Number(e.target.value) })}
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
                      <label className="block text-sm font-medium text-slate-700">Ek Hizmetler ve Guvenceler</label>
                      <span className="text-xs text-slate-500 font-medium">Varsayilan: HARIC (Istege bagli)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {LEASING_SERVICES.map(service => (
                        <button
                          key={service.key}
                          type="button"
                          onClick={() => toggleRentalService(service.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all ${
                            rentalData.services_included.includes(service.key)
                              ? 'bg-teal-50 border-teal-500 text-teal-700'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            rentalData.services_included.includes(service.key)
                              ? 'bg-teal-600 border-teal-600'
                              : 'border-slate-300'
                          }`}>
                            {rentalData.services_included.includes(service.key) && <Check className="h-3 w-3 text-white" />}
                          </div>
                          {service.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {rentalWizardStep === 2 && isLongTerm && (
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

                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Müşteri *"
                      value={rentalData.customer_id}
                      onChange={(e) => setRentalData({ ...rentalData, customer_id: e.target.value })}
                      options={[
                        { value: '', label: 'Müşteri secin...' },
                        ...customers.map(c => ({ value: c.id, label: formatCustomerLabel(c) })),
                      ]}
                    />
                    <Select
                      label="Şirket Profili"
                      value={rentalData.company_profile_id}
                      onChange={(e) => setRentalData({ ...rentalData, company_profile_id: e.target.value })}
                      options={[
                        { value: '', label: 'Şirket secin...' },
                        ...companyProfiles.map(p => ({ value: p.id, label: `${p.title}${p.is_default ? ' (Varsayilan)' : ''}` })),
                      ]}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Başlangıç Tarihi"
                      type="datetime-local"
                      value={rentalData.start_datetime}
                      onChange={(e) => setRentalData({ ...rentalData, start_datetime: e.target.value })}
                    />
                    <div>
                      <Input
                        label="Sozlesme Suresi (Ay)"
                        type="number"
                        min={1}
                        value={rentalData.contract_months}
                        onChange={(e) => setRentalData({ ...rentalData, contract_months: Math.max(1, parseInt(e.target.value) || 1) })}
                        placeholder="Ornek: 12, 24, 36, 55..."
                      />
                      <div className="flex gap-2 mt-2">
                        {[12, 24, 36, 48, 60].map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setRentalData({ ...rentalData, contract_months: m })}
                            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                              rentalData.contract_months === m
                                ? 'bg-teal-600 text-white border-teal-600'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                            }`}
                          >
                            {m} Ay
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

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

                  <div className="grid grid-cols-3 gap-4">
                    <Input
                      label="Başlangıç KM"
                      type="number"
                      value={rentalData.starting_km || ''}
                      onChange={(e) => setRentalData({ ...rentalData, starting_km: Number(e.target.value) })}
                    />
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
                      <label className="block text-sm font-medium text-slate-700">Dahil Olan Hizmetler</label>
                      {isFinancialLeasing ? (
                        <span className="text-xs text-amber-600 font-medium">Varsayilan: HARIC</span>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Varsayilan: DAHIL</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {LEASING_SERVICES.map(service => (
                        <button
                          key={service.key}
                          type="button"
                          onClick={() => toggleRentalService(service.key)}
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
                </div>
              )}

              {rentalWizardStep === 3 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {isLongTerm ? (
                      <CurrencyInput
                        label="Aylik Kira Bedeli (TL) *"
                        value={rentalData.monthly_rate}
                        onChange={(v) => setRentalData({ ...rentalData, monthly_rate: v })}
                      />
                    ) : (
                      <CurrencyInput
                        label="Gunluk Ucret (TL) *"
                        value={rentalData.daily_rate}
                        onChange={(v) => setRentalData({ ...rentalData, daily_rate: v })}
                      />
                    )}
                    <CurrencyInput
                      label="Depozito (TL)"
                      value={rentalData.deposit_amount}
                      onChange={(v) => setRentalData({ ...rentalData, deposit_amount: v })}
                    />
                  </div>

                  <Select
                    label="Odeme Yontemi"
                    value={rentalData.agreed_payment_method}
                    onChange={(e) => setRentalData({ ...rentalData, agreed_payment_method: e.target.value as any })}
                    options={[
                      { value: 'transfer', label: 'Havale/EFT' },
                      { value: 'credit_card', label: 'Kredi Karti' },
                      { value: 'cash', label: 'Nakit' },
                      { value: 'check', label: 'Cek' },
                      { value: 'promissory_note', label: 'Senet' },
                    ]}
                  />

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Vergi Ayarlari
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
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

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                    <textarea
                      value={rentalData.notes}
                      onChange={(e) => setRentalData({ ...rentalData, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Ek notlar..."
                    />
                  </div>
                </div>
              )}

              {rentalWizardStep === 4 && (
                <div className="space-y-6">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                    <p className="text-sm font-medium text-amber-800">Arac Teslim Durumu</p>
                    <p className="text-xs text-amber-600">Aracin mevcut durumunu kaydedin. Temizlik, yakit ve hasar bilgilerini girin.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">Temizlik Durumu</label>
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      {[
                        { value: 'clean', label: 'Temiz', icon: '✨', color: 'text-green-600 bg-green-50 border-green-300' },
                        { value: 'normal', label: 'Orta', icon: '😐', color: 'text-amber-600 bg-amber-50 border-amber-300' },
                        { value: 'dirty', label: 'Kirli', icon: '🌫️', color: 'text-red-600 bg-red-50 border-red-300' },
                      ].map((opt, idx) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setRentalData({ ...rentalData, start_cleanliness_status: opt.value as any })}
                          className={`flex-1 py-3 px-4 text-sm font-medium transition-all ${
                            idx > 0 ? 'border-l border-slate-200' : ''
                          } ${
                            rentalData.start_cleanliness_status === opt.value
                              ? opt.color + ' ring-2 ring-inset'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-lg block mb-1">{opt.icon}</span>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Fuel className="h-4 w-4" />
                        Yakit Seviyesi
                      </label>
                      <span className="text-lg font-bold text-slate-900">{rentalData.start_fuel_percentage}%</span>
                    </div>
                    <div className="relative">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={rentalData.start_fuel_percentage}
                        onChange={(e) => {
                          const pct = parseInt(e.target.value);
                          let status: 'empty' | '1/4' | '1/2' | '3/4' | 'full' = 'full';
                          if (pct <= 10) status = 'empty';
                          else if (pct <= 30) status = '1/4';
                          else if (pct <= 55) status = '1/2';
                          else if (pct <= 80) status = '3/4';
                          setRentalData({ ...rentalData, start_fuel_percentage: pct, fuel_status: status });
                        }}
                        className="w-full h-3 rounded-full appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #ef4444 0%, #f59e0b 25%, #eab308 50%, #84cc16 75%, #22c55e 100%)`,
                        }}
                      />
                      <div className="flex justify-between text-xs text-slate-400 mt-1">
                        <span>Bos</span>
                        <span>1/4</span>
                        <span>1/2</span>
                        <span>3/4</span>
                        <span>Dolu</span>
                      </div>
                    </div>
                    <div className="mt-3 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 relative">
                      <div
                        className="h-full transition-all duration-300"
                        style={{
                          width: `${rentalData.start_fuel_percentage}%`,
                          background: rentalData.start_fuel_percentage <= 25 ? '#ef4444' :
                                      rentalData.start_fuel_percentage <= 50 ? '#f59e0b' :
                                      rentalData.start_fuel_percentage <= 75 ? '#eab308' : '#22c55e',
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Fuel className={`h-4 w-4 ${rentalData.start_fuel_percentage > 50 ? 'text-white' : 'text-slate-600'}`} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <AlertTriangle className="h-4 w-4 inline mr-1 text-amber-500" />
                      Arac Hasar Ekspertizi
                    </label>
                    <p className="text-xs text-slate-500 mb-3">Aracin mevcut hasar durumu otomatik olarak yuklenmistir. Yeni hasarlari isaretlemek icin parca uzerine tiklayin.</p>
                    <CarDamageSchema
                      value={rentalData.delivery_damage_condition}
                      onChange={(schema) => setRentalData({ ...rentalData, delivery_damage_condition: schema })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      <Camera className="h-4 w-4 inline mr-1" />
                      Arac Fotograflari (Teslim Oncesi)
                    </label>
                    <p className="text-xs text-slate-500 mb-3">Aracin mevcut durumunu gosteren fotograflar yukleyin. Sinir yok, birden fazla fotograf secebilirsiniz.</p>

                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:border-slate-400 transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={async (e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;

                          setUploadingPhotos(true);
                          const newPhotos: string[] = [...(rentalData.start_photos || [])];

                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const fileExt = file.name.split('.').pop();
                            const fileName = `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                            const filePath = `deliveries/${rentalVehicle?.plate || 'unknown'}/${fileName}`;

                            const { error: uploadError } = await supabase.storage
                              .from('rental-photos')
                              .upload(filePath, file);

                            if (!uploadError) {
                              const { data: { publicUrl } } = supabase.storage
                                .from('rental-photos')
                                .getPublicUrl(filePath);
                              newPhotos.push(publicUrl);
                            }
                          }

                          setRentalData({ ...rentalData, start_photos: newPhotos });
                          setUploadingPhotos(false);
                          e.target.value = '';
                        }}
                        className="hidden"
                        id="photo-upload"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="flex flex-col items-center justify-center cursor-pointer py-4"
                      >
                        {uploadingPhotos ? (
                          <>
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-2"></div>
                            <p className="text-sm text-slate-600">Yukleniyor...</p>
                          </>
                        ) : (
                          <>
                            <Camera className="h-10 w-10 text-slate-400 mb-2" />
                            <p className="text-sm font-medium text-slate-700">Fotograf Ekle</p>
                            <p className="text-xs text-slate-500">Birden fazla fotograf secebilirsiniz</p>
                          </>
                        )}
                      </label>
                    </div>

                    {Array.isArray(rentalData.start_photos) && rentalData.start_photos.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-slate-500 mb-2">{rentalData.start_photos.length} fotograf yuklendi</p>
                        <div className="grid grid-cols-5 gap-2">
                          {(rentalData.start_photos || []).map((photo, idx) => (
                            <div key={idx} className="relative group aspect-square">
                              <img
                                src={photo}
                                alt={`Fotograf ${idx + 1}`}
                                className="w-full h-full object-cover rounded-lg border border-slate-200"
                              />
                              <button
                                type="button"
                                onClick={async () => {
                                  const path = photo.split('/rental-photos/')[1];
                                  if (path) {
                                    await supabase.storage.from('rental-photos').remove([path]);
                                  }
                                  setRentalData({
                                    ...rentalData,
                                    start_photos: (rentalData.start_photos || []).filter((_, i) => i !== idx),
                                  });
                                }}
                                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <VideoUpload
                    label="Video Kanıt (Teslim Öncesi)"
                    videoUrl={rentalData.delivery_video_url}
                    onVideoChange={(url) => setRentalData({ ...rentalData, delivery_video_url: url })}
                    storagePath={`deliveries/${rentalVehicle?.plate || 'unknown'}`}
                  />
                </div>
              )}

              <div className="flex justify-between gap-3 pt-4 mt-6 border-t border-slate-200">
                <div>
                  {rentalWizardStep > 1 && (
                    <Button variant="secondary" onClick={() => setRentalWizardStep(s => s - 1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Geri
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={handleCloseRentalForm}>
                    Iptal
                  </Button>
                  {rentalWizardStep < 4 ? (
                    <Button onClick={() => setRentalWizardStep(s => s + 1)}>
                      Devam
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  ) : (
                    <Button onClick={handleCreateRental} loading={saving || uploadingPhotos} disabled={uploadingPhotos}>
                      <PlayCircle className="h-4 w-4 mr-2" />
                      {rentalData.rental_model === 'rent_a_car'
                        ? 'Kiralamavi Baslat'
                        : rentalData.rental_model === 'operational_leasing'
                          ? 'Uzun Donem Kiralamavi Baslat'
                          : 'Leasing Sozlesmesini Baslat'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })()
        )}
      </Modal>

      <Modal
        isOpen={showReturnForm}
        onClose={() => setShowReturnForm(false)}
        title={`Arac Teslim Al: ${returningVehicle?.plate}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Kiralama Detaylari</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-600">Müşteri: </span>
                <span className="font-medium">{customers.find(c => c.id === returningRental?.customer_id)?.company_title}</span>
              </div>
              <div>
                <span className="text-slate-600">Gunluk Ucret: </span>
                <span className="font-medium">{formatCurrency(returningRental?.daily_rate || 0)} TL</span>
              </div>
              <div>
                <span className="text-slate-600">Baslangic Tarihi: </span>
                <span className="font-medium">{returningRental?.start_datetime ? new Date(returningRental.start_datetime).toLocaleString() : '-'}</span>
              </div>
              <div>
                <span className="text-slate-600">Beklenen Bitis: </span>
                <span className="font-medium">{returningRental?.end_datetime ? new Date(returningRental.end_datetime).toLocaleString() : '-'}</span>
              </div>
              {returningRental?.daily_km_limit && returningRental.daily_km_limit > 0 && (
                <>
                  <div>
                    <span className="text-slate-600">Gunluk KM Limiti: </span>
                    <span className="font-medium">{returningRental.daily_km_limit} km</span>
                  </div>
                  <div>
                    <span className="text-slate-600">KM Asim Ucreti: </span>
                    <span className="font-medium">
                      {returningRental.per_km_overage_fee
                        ? `${formatCurrency(returningRental.per_km_overage_fee)} TL/km`
                        : 'Belirlenmedi'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <Input
            label="Teslim Tarih/Saat *"
            type="datetime-local"
            value={returnData.return_datetime}
            onChange={(e) => setReturnData({ ...returnData, return_datetime: e.target.value })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                label="Teslim KM *"
                type="number"
                min={returningRental?.starting_km || 0}
                value={returnData.return_km}
                onChange={(e) => setReturnData({ ...returnData, return_km: parseFloat(e.target.value) || 0 })}
              />
              <p className="text-xs text-slate-500 mt-1">
                Cikis KM: {returningRental?.starting_km || 0}
                {returnData.return_km > (returningRental?.starting_km || 0) &&
                  ` | Mesafe: ${returnData.return_km - (returningRental?.starting_km || 0)} km`
                }
              </p>
            </div>
            <div>
              <Select
                label="Teslim Yakit Durumu *"
                value={returnData.return_fuel_status}
                onChange={(e) => setReturnData({ ...returnData, return_fuel_status: e.target.value as any })}
                options={[
                  { value: 'empty', label: 'Bos' },
                  { value: '1/4', label: '1/4' },
                  { value: '1/2', label: '1/2' },
                  { value: '3/4', label: '3/4' },
                  { value: 'full', label: 'Dolu' },
                ]}
              />
              <p className="text-xs text-slate-500 mt-1">
                Cikis Yakit: {returningRental?.fuel_status || '-'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Teslim Temizlik Durumu *"
              value={returnData.return_cleanliness_status}
              onChange={(e) => setReturnData({ ...returnData, return_cleanliness_status: e.target.value as any })}
              options={[
                { value: 'clean', label: 'Temiz (Ic/Dis)' },
                { value: 'normal', label: 'Orta' },
                { value: 'dirty', label: 'Kirli' },
              ]}
            />
            <FileUpload
              label="Teslim Tutanagi"
              accept="image/*,.pdf"
              value={returnData.handover_document_url}
              onChange={(v) => setReturnData({ ...returnData, handover_document_url: v })}
              downloadFilename={`${returningVehicle?.plate || 'arac'}_teslim_tutanagi`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tespit Edilen Yeni Hasarlar
            </label>
            <textarea
              value={returnData.return_damage_notes}
              onChange={(e) => setReturnData({ ...returnData, return_damage_notes: e.target.value })}
              rows={3}
              placeholder="Teslimde tespit edilen yeni hasar, cizik veya sorunlari aciklayin..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {returningRental && (
            <div className="space-y-3">
              {returningRental.daily_km_limit && returningRental.daily_km_limit > 0 && returnData.return_km > 0 && (
                (() => {
                  const startKm = returningRental.starting_km || 0;
                  const drivenKm = returnData.return_km - startKm;
                  const startDate = new Date(returningRental.start_datetime || returningRental.start_date);
                  const returnDate = returnData.return_datetime ? new Date(returnData.return_datetime) : new Date();
                  const daysRented = Math.max(1, Math.ceil((returnDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                  const allowedKm = daysRented * returningRental.daily_km_limit;
                  const overLimit = drivenKm - allowedKm;
                  const overageFee = returningRental.per_km_overage_fee || 0;
                  const penaltyAmount = overLimit > 0 ? overLimit * overageFee : 0;

                  return (
                    <div className={`p-3 rounded-lg border ${overLimit > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <h4 className="text-sm font-semibold mb-2 text-slate-800">KM Analizi</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-slate-600">Gunluk KM Limiti: </span>
                          <span className="font-medium">{returningRental.daily_km_limit} km</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Kiralama Suresi: </span>
                          <span className="font-medium">{daysRented} gun</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Toplam Izin: </span>
                          <span className="font-medium">{allowedKm} km</span>
                        </div>
                        <div>
                          <span className="text-slate-600">Kullanilan: </span>
                          <span className="font-medium">{drivenKm} km</span>
                        </div>
                      </div>
                      {overLimit > 0 ? (
                        <div className="mt-2 pt-2 border-t border-red-200 space-y-1">
                          <p className="text-sm font-bold text-red-700">
                            KM Siniri Asildi! (+{overLimit} km)
                          </p>
                          {overageFee > 0 && (
                            <p className="text-sm font-bold text-red-700">
                              KM Asim Cezasi: {formatCurrency(penaltyAmount)} TL ({overLimit} km x {formatCurrency(overageFee)} TL)
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 pt-2 border-t border-green-200">
                          <p className="text-sm font-medium text-green-700">
                            Limit dahilinde ({Math.abs(overLimit)} km kaldi)
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
              {(() => {
                const startDate = new Date(returningRental.start_datetime || returningRental.start_date);
                const returnDate = returnData.return_datetime ? new Date(returnData.return_datetime) : new Date();
                const daysRented = Math.max(1, Math.ceil((returnDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
                const realizedTotal = daysRented * (returningRental.daily_rate || 0);

                const startKm = returningRental.starting_km || 0;
                const drivenKm = returnData.return_km - startKm;
                const dailyLimit = returningRental.daily_km_limit || 0;
                const allowedKm = dailyLimit > 0 ? daysRented * dailyLimit : null;
                const excessKm = allowedKm && drivenKm > allowedKm ? drivenKm - allowedKm : 0;
                const overageFee = returningRental.per_km_overage_fee || 0;
                const penaltyAmount = excessKm * overageFee;
                const grandTotal = realizedTotal + penaltyAmount;

                return (
                  <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Kullanilan Sure:</span>
                      <span className="font-medium">{daysRented} gun</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Kiralama Tutari:</span>
                      <span className="font-medium">{formatCurrency(realizedTotal)} TL</span>
                    </div>
                    {penaltyAmount > 0 && (
                      <div className="flex justify-between text-sm text-red-700">
                        <span>KM Asim Cezasi:</span>
                        <span className="font-medium">+{formatCurrency(penaltyAmount)} TL</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm pt-2 border-t border-teal-200">
                      <span className="font-semibold text-teal-700">GENEL TOPLAM:</span>
                      <span className="font-bold text-teal-700">{formatCurrency(grandTotal)} TL</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowReturnForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleReturnVehicle} loading={saving}>
              Teslimi Tamamla
            </Button>
          </div>
        </div>
      </Modal>

      {showCheckoutModal && checkoutRental && (
        <VehicleReturnModal
          rental={checkoutRental}
          onClose={() => {
            setShowCheckoutModal(false);
            setCheckoutRental(null);
          }}
          onComplete={() => {
            setShowCheckoutModal(false);
            setCheckoutRental(null);
            loadData();
          }}
        />
      )}

      <Modal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        title={
          <div className="flex items-center gap-3">
            <span>Arac Gecmisi: {historyVehicle?.plate}</span>
            {historyVehicle?.status === 'sold' && (
              <span className="inline-flex px-3 py-1 text-sm font-bold rounded-full bg-red-100 text-red-700">
                SATILDI
              </span>
            )}
          </div>
        }
        size="full"
      >
        <div className="border-b border-slate-200 mb-4">
          <nav className="flex flex-wrap gap-4">
            {historyVehicle?.status === 'sold' && (
              <button
                onClick={() => setHistoryTab('sales')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                  historyTab === 'sales'
                    ? 'border-red-600 text-red-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <TrendingUp className="h-4 w-4 inline mr-2" />
                Satis Bilgileri
              </button>
            )}
            <button
              onClick={() => setHistoryTab('rentals')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                historyTab === 'rentals'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <History className="h-4 w-4 inline mr-2" />
              Kiralama Gecmisi ({rentalHistory.length})
            </button>
            <button
              onClick={() => setHistoryTab('maintenance')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                historyTab === 'maintenance'
                  ? 'border-teal-600 text-teal-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Wrench className="h-4 w-4 inline mr-2" />
              Servis Gecmisi ({vehicleMaintenances.length})
            </button>
            <button
              onClick={() => setHistoryTab('accidents')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                historyTab === 'accidents'
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              Kazalar ({vehicleAccidentsHistory.length})
            </button>
          </nav>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : historyTab === 'sales' ? (
          <div className="space-y-6">
            {vehicleSaleInfo ? (
              <>
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Satis Detaylari</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Satis Tarihi</p>
                      <p className="text-lg font-medium text-slate-900">{formatDate(vehicleSaleInfo.sale_date)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Satis Tutari</p>
                      <p className="text-lg font-semibold text-green-600">{formatCurrency(vehicleSaleInfo.sale_amount)} TL</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Alici</p>
                      <p className="text-lg font-medium text-slate-900">{vehicleSaleInfo.buyer_name}</p>
                    </div>
                  </div>
                  {vehicleSaleInfo.notes && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-sm text-slate-500 mb-1">Notlar</p>
                      <p className="text-slate-700">{vehicleSaleInfo.notes}</p>
                    </div>
                  )}

                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <p className="text-sm text-slate-500 mb-2">Noter Belgesi</p>
                        {vehicleSaleInfo.notary_document_url ? (
                          <a
                            href={vehicleSaleInfo.notary_document_url}
                            download="noter_satis_belgesi"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-100 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            Belgeyi Indir
                          </a>
                        ) : (
                          <span className="text-sm text-slate-400">Yuklenmemis</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-2">Trafik Sigortasi</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                          vehicleSaleInfo.insurance_cancelled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {vehicleSaleInfo.insurance_cancelled ? (
                            <><Check className="h-3.5 w-3.5" /> Iptal Edildi</>
                          ) : (
                            <><AlertTriangle className="h-3.5 w-3.5" /> Iptal Bekliyor</>
                          )}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm text-slate-500 mb-2">Kasko</p>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${
                          vehicleSaleInfo.casco_cancelled
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {vehicleSaleInfo.casco_cancelled ? (
                            <><Check className="h-3.5 w-3.5" /> Iptal Edildi</>
                          ) : (
                            <><AlertTriangle className="h-3.5 w-3.5" /> Iptal Bekliyor</>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-slate-50 to-teal-50 border border-slate-200 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">Arac Omur Boyu Karlilik</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-slate-100">
                      <p className="text-xs text-slate-500 mb-1">Alis Fiyati</p>
                      <p className="text-lg font-medium text-slate-700">{formatCurrency(historyVehicle?.purchase_price || 0)} TL</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-100">
                      <p className="text-xs text-green-600 mb-1">Toplam Gelir</p>
                      <p className="text-lg font-medium text-green-600">{formatCurrency(vehicleLifetimeStats?.totalIncome || 0)} TL</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-red-100">
                      <p className="text-xs text-red-600 mb-1">Toplam Gider</p>
                      <p className="text-lg font-medium text-red-600">{formatCurrency(vehicleLifetimeStats?.totalExpenses || 0)} TL</p>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-100">
                      <p className="text-xs text-green-600 mb-1">Satis Tutari</p>
                      <p className="text-lg font-medium text-green-600">{formatCurrency(vehicleSaleInfo.sale_amount)} TL</p>
                    </div>
                    <div className={`rounded-lg p-4 border ${
                      ((vehicleLifetimeStats?.totalIncome || 0) + Number(vehicleSaleInfo.sale_amount) - (vehicleLifetimeStats?.totalExpenses || 0) - (historyVehicle?.purchase_price || 0)) >= 0
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <p className={`text-xs mb-1 ${
                        ((vehicleLifetimeStats?.totalIncome || 0) + Number(vehicleSaleInfo.sale_amount) - (vehicleLifetimeStats?.totalExpenses || 0) - (historyVehicle?.purchase_price || 0)) >= 0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}>Toplam Karlilik</p>
                      <p className={`text-xl font-bold ${
                        ((vehicleLifetimeStats?.totalIncome || 0) + Number(vehicleSaleInfo.sale_amount) - (vehicleLifetimeStats?.totalExpenses || 0) - (historyVehicle?.purchase_price || 0)) >= 0
                          ? 'text-green-700'
                          : 'text-red-700'
                      }`}>
                        {formatCurrency(
                          (vehicleLifetimeStats?.totalIncome || 0) +
                          Number(vehicleSaleInfo.sale_amount) -
                          (vehicleLifetimeStats?.totalExpenses || 0) -
                          (historyVehicle?.purchase_price || 0)
                        )} TL
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-4">
                    Hesaplama: (Toplam Gelir + Satis Tutari) - (Toplam Gider + Alis Fiyati)
                  </p>
                </div>
              </>
            ) : (
              <p className="text-center py-8 text-slate-500">Satis bilgisi bulunamadi</p>
            )}
          </div>
        ) : historyTab === 'accidents' ? (
          vehicleAccidentsHistory.length === 0 ? (
            <p className="text-center py-8 text-slate-500">Bu arac icin kaza kaydi bulunamadi</p>
          ) : (
            <div className="space-y-4">
              {vehicleAccidentsHistory.map((accident) => (
                <div key={accident.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        accident.driver_fault_rate >= 75
                          ? 'bg-red-100 text-red-700'
                          : accident.driver_fault_rate >= 40
                          ? 'bg-orange-100 text-orange-700'
                          : accident.driver_fault_rate > 0
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        Kusur: %{accident.driver_fault_rate}
                      </span>
                      <span className="font-medium text-slate-900">{formatDate(accident.accident_date)}</span>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      accident.insurance_type === 'kasko' ? 'bg-blue-100 text-blue-700' :
                      accident.insurance_type === 'traffic' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {accident.insurance_type === 'kasko' ? 'Kasko' : accident.insurance_type === 'traffic' ? 'Trafik Sigortasi' : 'Sigortasiz'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500">Tamir Maliyeti: </span>
                      <span className="font-medium text-red-600">{formatCurrency(accident.repair_cost || 0)} TL</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Deger Kaybi: </span>
                      <span className="font-medium text-red-600">{formatCurrency(accident.valuation_loss || 0)} TL</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Alkol: </span>
                      <span className={`font-medium ${accident.is_driver_alcohol_involved ? 'text-red-600' : 'text-green-600'}`}>
                        {accident.is_driver_alcohol_involved ? 'Evet' : 'Hayir'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Müşteriye Yansi: </span>
                      <span className={`font-medium ${accident.charge_to_customer ? 'text-green-600' : 'text-slate-600'}`}>
                        {accident.charge_to_customer ? 'Evet' : 'Hayir'}
                      </span>
                    </div>
                  </div>
                  {accident.description && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-sm text-slate-600">{accident.description}</p>
                    </div>
                  )}
                </div>
              ))}
              <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Toplam Kaza Maliyeti:</span>{' '}
                  <span className="text-red-600 font-semibold">
                    {formatCurrency(vehicleAccidentsHistory.reduce((sum, a) => sum + (a.repair_cost || 0) + (a.valuation_loss || 0), 0))} TL
                  </span>
                </p>
              </div>
            </div>
          )
        ) : historyTab === 'rentals' ? (
          rentalHistory.length === 0 ? (
            <p className="text-center py-8 text-slate-500">Bu arac icin kiralama gecmisi bulunamadi</p>
          ) : (
          <div className="space-y-4">
            {rentalHistory.map((rental) => (
              <div key={rental.id} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      rental.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}>
                      {rental.status === 'active' ? 'Aktif' : 'Tamamlandi'}
                    </span>
                    <span className="font-medium text-slate-900">{rental.customer_name}</span>
                    {rental.early_return_days && rental.early_return_days > 0 && (
                      <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                        Erken Donus ({rental.early_return_days} gun)
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-teal-600 font-semibold">
                      {formatCurrency(rental.total_amount)} TL
                    </span>
                    {(rental as any).original_total_amount && (rental as any).original_total_amount > rental.total_amount && (
                      <div className="text-xs text-amber-600">
                        <span className="line-through">{formatCurrency((rental as any).original_total_amount)}</span>
                        <span className="ml-1">(Revize)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-slate-500">Baslangic: </span>
                    <span className="font-medium">
                      {rental.start_datetime
                        ? new Date(rental.start_datetime).toLocaleString('tr-TR')
                        : formatDate(rental.start_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Bitis: </span>
                    <span className="font-medium">
                      {rental.end_datetime
                        ? new Date(rental.end_datetime).toLocaleString('tr-TR')
                        : formatDate(rental.end_date)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Gunluk Ucret: </span>
                    <span className="font-medium">{formatCurrency(rental.daily_rate)} TL</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Depozito: </span>
                    <span className="font-medium">{formatCurrency(rental.deposit_amount || 0)} TL</span>
                  </div>
                </div>

                {rental.status === 'completed' && rental.return_datetime && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3 pt-3 border-t border-slate-100">
                    <div>
                      <span className="text-slate-500">Teslim Tarihi: </span>
                      <span className="font-medium">{new Date(rental.return_datetime).toLocaleString('tr-TR')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Cikis KM: </span>
                      <span className="font-medium">{rental.starting_km || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Teslim KM: </span>
                      <span className="font-medium">{rental.return_km || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Mesafe: </span>
                      <span className="font-medium">
                        {rental.return_km && rental.starting_km
                          ? `${rental.return_km - rental.starting_km} km`
                          : '-'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setContractRentalId(rental.id);
                      setShowContractGenerator(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Printer className="h-4 w-4" />
                    Sozlesme Yazdir
                  </button>
                  <button
                    onClick={() => {
                      setDeliveryReturnReportRentalId(rental.id);
                      setShowDeliveryReturnReport(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    Teslim/Iade Tutanagi
                  </button>
                  {rental.contract_document_url && (
                    <a
                      href={rental.contract_document_url}
                      download={getDownloadFilename(rental.contract_document_url, `${historyVehicle?.plate}_sozlesme_${formatDate(rental.start_date)}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Kiralama Sozlesmesi
                    </a>
                  )}
                  {rental.handover_document_url && (
                    <a
                      href={rental.handover_document_url}
                      download={getDownloadFilename(rental.handover_document_url, `${historyVehicle?.plate}_teslim_tutanagi_${formatDate(rental.return_datetime || rental.end_date)}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 text-sm font-medium rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Teslim Tutanagi
                    </a>
                  )}
                  {!rental.contract_document_url && !rental.handover_document_url && rental.status !== 'completed' && (
                    <span className="text-sm text-slate-400">Belge yuklenmemis</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          )
        ) : (
          vehicleMaintenances.length === 0 ? (
            <p className="text-center py-8 text-slate-500">Bu arac icin servis gecmisi bulunamadi</p>
          ) : (
            <div className="space-y-3">
              {vehicleMaintenances.map((maintenance) => {
                const isExpanded = expandedMaintenanceId === maintenance.id;
                const sd = maintenance.service_details as ServiceDetails | null;
                const hasServiceDetails = sd && (
                  sd.checklist?.some((i) => i.status !== 'na') ||
                  sd.custom_operations?.some((op) => op.name?.trim())
                );
                return (
                  <div key={maintenance.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <div
                      className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => setExpandedMaintenanceId(isExpanded ? null : maintenance.id)}
                    >
                      <div className="flex items-center gap-1 text-slate-400">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatDate(maintenance.entry_date)}</p>
                          {maintenance.return_date ? (
                            <p className="text-[11px] text-slate-500">Cikis: {formatDate(maintenance.return_date)}</p>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-amber-100 text-amber-700">
                              Serviste
                            </span>
                          )}
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-xs text-slate-400">Servis</p>
                          <p className="text-sm text-slate-700 truncate">{maintenance.supplier?.name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Maliyet</p>
                          <p className="text-sm font-semibold text-slate-900">{formatCurrency(maintenance.cost)} TL</p>
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-xs text-slate-400">KM</p>
                          <p className="text-sm text-slate-700">{maintenance.current_km ? `${maintenance.current_km.toLocaleString()}` : '-'}</p>
                        </div>
                      </div>
                      {hasServiceDetails && (
                        <span className="flex-shrink-0 px-2 py-0.5 text-[10px] font-medium rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                          Detay
                        </span>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        <div className="bg-[#0f1b2d] px-5 py-3">
                          <h4 className="text-xs font-bold text-white uppercase tracking-widest">Servis Raporu</h4>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(maintenance.entry_date)}{maintenance.return_date ? ` - ${formatDate(maintenance.return_date)}` : ''}
                            {maintenance.supplier?.name ? ` | ${maintenance.supplier.name}` : ''}
                          </p>
                        </div>

                        <div className="p-5 space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Maliyet</p>
                              <p className="text-sm font-bold text-slate-900 mt-0.5">{formatCurrency(maintenance.cost)} TL</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mevcut KM</p>
                              <p className="text-sm font-medium text-slate-700 mt-0.5">{maintenance.current_km ? `${maintenance.current_km.toLocaleString()} km` : '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sonraki Bakim</p>
                              <p className="text-sm font-medium text-slate-700 mt-0.5">{maintenance.next_maintenance_km ? `${maintenance.next_maintenance_km.toLocaleString()} km` : '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Durum</p>
                              <p className="text-sm font-medium mt-0.5">
                                {maintenance.return_date ? (
                                  <span className="text-emerald-600">Tamamlandi</span>
                                ) : (
                                  <span className="text-amber-600">Serviste</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {maintenance.description && (
                            <div>
                              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Aciklama</p>
                              <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2">{maintenance.description}</p>
                            </div>
                          )}

                          {hasServiceDetails && (
                            <div className="border-t border-slate-200 pt-4">
                              <MaintenanceDetailsView serviceDetails={sd} />
                            </div>
                          )}

                          {!hasServiceDetails && !maintenance.description && (
                            <p className="text-sm text-slate-400 italic text-center py-2">Detayli islem bilgisi girilmemis.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-600">
                  <span className="font-medium">Toplam Bakim Maliyeti:</span>{' '}
                  <span className="text-slate-900 font-semibold">
                    {formatCurrency(vehicleMaintenances.reduce((sum, m) => sum + (m.cost || 0), 0))} TL
                  </span>
                </p>
              </div>
            </div>
          )
        )}
      </Modal>

      <Modal
        isOpen={showFinanceModal}
        onClose={() => setShowFinanceModal(false)}
        title={`Finansal Gecmis: ${financeVehicle?.plate}`}
        size="full"
      >
        {loadingFinance ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {(() => {
              const summary = getFinanceSummary();
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      </div>
                      <span className="text-sm font-medium text-green-700">Toplam Gelir</span>
                    </div>
                    <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.totalIncome)} TL</p>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      </div>
                      <span className="text-sm font-medium text-red-700">Toplam Gider</span>
                    </div>
                    <p className="text-2xl font-bold text-red-700">{formatCurrency(summary.totalExpense)} TL</p>
                  </div>

                  <div className={`border rounded-xl p-4 ${
                    summary.netProfit >= 0
                      ? 'bg-teal-50 border-teal-200'
                      : 'bg-orange-50 border-orange-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        summary.netProfit >= 0 ? 'bg-teal-100' : 'bg-orange-100'
                      }`}>
                        <Wallet className={`h-5 w-5 ${
                          summary.netProfit >= 0 ? 'text-teal-600' : 'text-orange-600'
                        }`} />
                      </div>
                      <span className={`text-sm font-medium ${
                        summary.netProfit >= 0 ? 'text-teal-700' : 'text-orange-700'
                      }`}>Net Kar/Zarar</span>
                    </div>
                    <p className={`text-2xl font-bold ${
                      summary.netProfit >= 0 ? 'text-teal-700' : 'text-orange-700'
                    }`}>
                      {summary.netProfit >= 0 ? '+' : ''}{formatCurrency(summary.netProfit)} TL
                    </p>
                  </div>
                </div>
              );
            })()}

            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-end gap-4 mb-4">
                <Input
                  label="Başlangıç Tarihi"
                  type="date"
                  value={financeDateRange.start}
                  onChange={(e) => setFinanceDateRange({ ...financeDateRange, start: e.target.value })}
                  className="w-40"
                />
                <Input
                  label="Bitiş Tarihi"
                  type="date"
                  value={financeDateRange.end}
                  onChange={(e) => setFinanceDateRange({ ...financeDateRange, end: e.target.value })}
                  className="w-40"
                />
                <Button size="sm" onClick={filterFinanceTransactions}>
                  Filtrele
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setFinanceDateRange({ start: '', end: '' });
                    if (financeVehicle) openFinanceHistory(financeVehicle);
                  }}
                >
                  Sifirla
                </Button>
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="ml-auto"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Finansal Raporu Yazdir
                </Button>
              </div>

              {vehicleTransactions.length === 0 ? (
                <p className="text-center py-8 text-slate-500">Bu arac icin finansal kayit bulunamadi</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Tarih</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Tip</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Kategori</th>
                        <th className="text-left py-3 px-4 font-medium text-slate-600">Aciklama</th>
                        <th className="text-right py-3 px-4 font-medium text-slate-600">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleTransactions.map((t) => (
                        <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4">{formatDate(t.transaction_date)}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              t.type === 'income'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {t.type === 'income' ? 'Gelir' : 'Gider'}
                            </span>
                          </td>
                          <td className="py-3 px-4">{t.category}</td>
                          <td className="py-3 px-4 text-slate-600">{t.description || '-'}</td>
                          <td className={`py-3 px-4 text-right font-medium ${
                            t.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)} TL
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
        title="Teslim Tutanagi / Ekspertiz Raporu"
        size="full"
      >
        {comparisonRental && (
          <div id="comparison-report" className="space-y-6">
            {contractCompanyProfile && (
              <div className="flex items-start justify-between pb-4 border-b-2 border-slate-300 mb-6">
                <div className="flex items-center gap-4">
                  {contractCompanyProfile.logo_url && (
                    <img
                      src={contractCompanyProfile.logo_url}
                      alt={contractCompanyProfile.title}
                      className="h-16 w-16 object-contain"
                    />
                  )}
                  <div>
                    <h1 className="text-lg font-bold text-slate-900">{contractCompanyProfile.legal_name}</h1>
                    {contractCompanyProfile.address && (
                      <p className="text-xs text-slate-600 max-w-md">{contractCompanyProfile.address}</p>
                    )}
                    <div className="flex gap-4 mt-1 text-xs text-slate-500">
                      {contractCompanyProfile.tax_office && (
                        <span>V.D.: {contractCompanyProfile.tax_office}</span>
                      )}
                      {contractCompanyProfile.tax_no && (
                        <span>VKN: {contractCompanyProfile.tax_no}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  {contractCompanyProfile.phone && <p>Tel: {contractCompanyProfile.phone}</p>}
                  {contractCompanyProfile.email && <p>{contractCompanyProfile.email}</p>}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{historyVehicle?.plate}</h2>
                <p className="text-sm text-slate-500">{historyVehicle?.brand} {historyVehicle?.model}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Müşteri (Kiralayan)</p>
                <p className="font-semibold text-slate-900">{comparisonRental.customer_name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Cikis (Teslim Edildi)
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Tarih/Saat:</span>
                    <span className="font-medium text-blue-900">
                      {comparisonRental.start_datetime
                        ? new Date(comparisonRental.start_datetime).toLocaleString('tr-TR')
                        : formatDate(comparisonRental.start_date)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">KM:</span>
                    <span className="font-medium text-blue-900">{comparisonRental.starting_km || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Yakit Durumu:</span>
                    <span className="font-medium text-blue-900">{comparisonRental.fuel_status || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Temizlik:</span>
                    <span className="font-medium text-blue-900">
                      {comparisonRental.start_cleanliness_status === 'clean' ? 'Temiz' :
                       comparisonRental.start_cleanliness_status === 'normal' ? 'Normal' :
                       comparisonRental.start_cleanliness_status === 'dirty' ? 'Kirli' : '-'}
                    </span>
                  </div>
                  {comparisonRental.initial_damage_notes && (
                    <div className="pt-2 border-t border-blue-200">
                      <span className="text-blue-700 block mb-1">Hasar Notlari:</span>
                      <p className="text-blue-900 bg-blue-100 p-2 rounded text-xs">{comparisonRental.initial_damage_notes}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-green-50 rounded-xl p-5 border border-green-200">
                <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  Donus (Teslim Alindi)
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Tarih/Saat:</span>
                    <span className="font-medium text-green-900">
                      {comparisonRental.return_datetime
                        ? new Date(comparisonRental.return_datetime).toLocaleString('tr-TR')
                        : '-'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">KM:</span>
                    <span className="font-medium text-green-900">{comparisonRental.return_km || '-'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-700">Yakit Durumu:</span>
                    <span className={`font-medium px-2 py-0.5 rounded ${
                      comparisonRental.return_fuel_status !== comparisonRental.fuel_status
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-green-900'
                    }`}>
                      {comparisonRental.return_fuel_status || '-'}
                      {comparisonRental.return_fuel_status !== comparisonRental.fuel_status && ' (Degisik)'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-700">Temizlik:</span>
                    <span className={`font-medium px-2 py-0.5 rounded ${
                      comparisonRental.return_cleanliness_status !== comparisonRental.start_cleanliness_status
                        ? 'bg-amber-100 text-amber-700'
                        : 'text-green-900'
                    }`}>
                      {comparisonRental.return_cleanliness_status === 'clean' ? 'Temiz' :
                       comparisonRental.return_cleanliness_status === 'normal' ? 'Normal' :
                       comparisonRental.return_cleanliness_status === 'dirty' ? 'Kirli' : '-'}
                      {comparisonRental.return_cleanliness_status !== comparisonRental.start_cleanliness_status && ' (Degisik)'}
                    </span>
                  </div>
                  {comparisonRental.return_damage_notes && (
                    <div className="pt-2 border-t border-green-200">
                      <span className="text-green-700 block mb-1">Yeni Hasar Notlari:</span>
                      <p className="text-red-700 bg-red-50 p-2 rounded text-xs border border-red-200">{comparisonRental.return_damage_notes}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {(() => {
              const startKm = comparisonRental.starting_km || 0;
              const returnKm = comparisonRental.return_km || 0;
              const drivenKm = returnKm - startKm;
              const startDate = new Date(comparisonRental.start_datetime || comparisonRental.start_date);
              const returnDate = comparisonRental.return_datetime ? new Date(comparisonRental.return_datetime) : new Date();
              const daysRented = Math.max(1, Math.ceil((returnDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
              const dailyLimit = comparisonRental.daily_km_limit || 0;
              const allowedKm = dailyLimit > 0 ? daysRented * dailyLimit : null;
              const overLimit = allowedKm ? drivenKm - allowedKm : null;

              return (
                <div className={`p-5 rounded-xl border ${
                  overLimit && overLimit > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
                }`}>
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">KM Analizi</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Cikis KM</p>
                      <p className="text-xl font-bold text-slate-900">{startKm}</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Donus KM</p>
                      <p className="text-xl font-bold text-slate-900">{returnKm}</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Kullanilan</p>
                      <p className="text-xl font-bold text-teal-600">{drivenKm} km</p>
                    </div>
                    {dailyLimit > 0 && (
                      <>
                        <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                          <p className="text-xs text-slate-500 mb-1">Izin ({dailyLimit}/gun x {daysRented} gun)</p>
                          <p className="text-xl font-bold text-slate-900">{allowedKm} km</p>
                        </div>
                        <div className={`text-center p-3 rounded-lg border ${
                          overLimit && overLimit > 0
                            ? 'bg-red-100 border-red-300'
                            : 'bg-green-100 border-green-300'
                        }`}>
                          <p className="text-xs text-slate-500 mb-1">Durum</p>
                          {overLimit && overLimit > 0 ? (
                            <p className="text-xl font-bold text-red-600">+{overLimit} km ASIM</p>
                          ) : (
                            <p className="text-xl font-bold text-green-600">Limit Dahilinde</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {(() => {
              const startDate = new Date(comparisonRental.start_datetime || comparisonRental.start_date);
              const returnDate = comparisonRental.return_datetime ? new Date(comparisonRental.return_datetime) : new Date();
              const actualDaysRented = Math.max(1, Math.ceil((returnDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
              const realizedTotal = actualDaysRented * (comparisonRental.daily_rate || 0);

              const startKm = comparisonRental.starting_km || 0;
              const returnKm = comparisonRental.return_km || 0;
              const drivenKm = returnKm - startKm;
              const dailyLimit = comparisonRental.daily_km_limit || 0;
              const allowedKm = dailyLimit > 0 ? actualDaysRented * dailyLimit : null;
              const excessKm = allowedKm && drivenKm > allowedKm ? drivenKm - allowedKm : 0;
              const overageFee = comparisonRental.per_km_overage_fee || 0;
              const penaltyAmount = excessKm * overageFee;
              const grandTotal = realizedTotal + penaltyAmount;

              return (
                <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Finansal Ozet</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Gunluk Ucret</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(comparisonRental.daily_rate)} TL</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Kullanilan Sure</p>
                      <p className="text-xl font-bold text-slate-900">{actualDaysRented} Gun</p>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                      <p className="text-xs text-slate-500 mb-1">Depozito</p>
                      <p className="text-xl font-bold text-slate-900">{formatCurrency(comparisonRental.deposit_amount || 0)} TL</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-700 mb-1">Kiralama Tutari</p>
                      <p className="text-xl font-bold text-blue-700">{formatCurrency(realizedTotal)} TL</p>
                    </div>
                  </div>

                  {dailyLimit > 0 && overageFee > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pt-4 border-t border-slate-200">
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">KM Asim Ucreti</p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(overageFee)} TL/km</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Izin Verilen KM</p>
                        <p className="text-xl font-bold text-slate-900">{allowedKm}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500 mb-1">Asim Miktari</p>
                        <p className={`text-xl font-bold ${excessKm > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {excessKm > 0 ? `+${excessKm} km` : 'Yok'}
                        </p>
                      </div>
                      <div className={`text-center p-3 rounded-lg border ${
                        penaltyAmount > 0 ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300'
                      }`}>
                        <p className={`text-xs mb-1 ${penaltyAmount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          KM Asim Cezasi
                        </p>
                        <p className={`text-xl font-bold ${penaltyAmount > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {penaltyAmount > 0 ? `+${formatCurrency(penaltyAmount)} TL` : '0 TL'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-300">
                    <div className="flex justify-between items-center p-4 bg-teal-100 rounded-lg border border-teal-300">
                      <div>
                        <p className="text-sm text-teal-700 font-medium">GENEL TOPLAM</p>
                        {penaltyAmount > 0 && (
                          <p className="text-xs text-teal-600">
                            ({formatCurrency(realizedTotal)} TL kiralama + {formatCurrency(penaltyAmount)} TL ceza)
                          </p>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-teal-700">{formatCurrency(grandTotal)} TL</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {contractCompanyProfile?.iban_details && (
              <div className="bg-slate-100 rounded-lg p-4 border border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Banka Bilgileri</h4>
                <p className="text-sm text-slate-600 whitespace-pre-line">{contractCompanyProfile.iban_details}</p>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setShowComparisonModal(false)}>
                Kapat
              </Button>
              <Button onClick={() => {
                const element = document.getElementById('comparison-report');
                if (element) {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>Teslim Tutanagi - ${historyVehicle?.plate}</title>
                          <style>
                            body { font-family: Arial, sans-serif; padding: 20px; }
                            .grid { display: grid; gap: 20px; }
                            .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
                            .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
                            .grid-cols-5 { grid-template-columns: repeat(5, 1fr); }
                            .bg-blue-50 { background-color: #eff6ff; }
                            .bg-green-50 { background-color: #f0fdf4; }
                            .bg-slate-50 { background-color: #f8fafc; }
                            .rounded-xl { border-radius: 12px; }
                            .p-5 { padding: 20px; }
                            .border { border: 1px solid #e2e8f0; }
                            .text-center { text-align: center; }
                            .font-bold { font-weight: bold; }
                            .text-xl { font-size: 1.25rem; }
                            .text-lg { font-size: 1.125rem; }
                            .text-sm { font-size: 0.875rem; }
                            .text-xs { font-size: 0.75rem; }
                            .mb-4 { margin-bottom: 16px; }
                            .mb-1 { margin-bottom: 4px; }
                            .space-y-6 > * + * { margin-top: 24px; }
                            .space-y-3 > * + * { margin-top: 12px; }
                            h2 { font-size: 1.5rem; margin: 0; }
                            h3 { font-size: 1.125rem; margin-bottom: 16px; }
                            @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                          </style>
                        </head>
                        <body>
                          ${element.innerHTML}
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }
              }}>
                <FileDown className="h-4 w-4 mr-2" />
                PDF Indir
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showRentalDetailModal}
        onClose={() => setShowRentalDetailModal(false)}
        title={`Kiralama Detayi: ${detailVehicle?.plate}`}
        size="full"
      >
        {loadingDetail ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : detailRental && (
          <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
              <div></div>
              <button
                onClick={() => {
                  setDeliveryReturnReportRentalId(detailRental.id);
                  setShowDeliveryReturnReport(true);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                <FileText className="h-5 w-5" />
                Teslim/Iade Tutanagi Yazdir
              </button>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-slate-500">Müşteri:</span>
                  <p className="font-medium">{detailRental.customer_name}</p>
                </div>
                <div>
                  <span className="text-slate-500">Baslangic:</span>
                  <p className="font-medium">
                    {detailRental.start_datetime
                      ? new Date(detailRental.start_datetime).toLocaleString('tr-TR')
                      : formatDate(detailRental.start_date)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">Beklenen Bitis:</span>
                  <p className="font-medium">
                    {detailRental.end_datetime
                      ? new Date(detailRental.end_datetime).toLocaleString('tr-TR')
                      : formatDate(detailRental.end_date)}
                  </p>
                </div>
                <div>
                  <span className="text-slate-500">KABIS Durumu:</span>
                  <p className={`font-medium ${detailRental.kabis_notification_status ? 'text-green-600' : 'text-red-600'}`}>
                    {detailRental.kabis_notification_status ? 'Bildirildi' : 'Bildirilmedi'}
                  </p>
                </div>
              </div>
            </div>

            {(() => {
              const totals = calculateRentalTotal(detailRental, rentalExpenses, rentalAccidents);
              return (
                <div className="p-4 bg-teal-50 rounded-lg border border-teal-200">
                  <h4 className="text-sm font-semibold text-teal-800 mb-3">Finansal Ozet</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="text-center p-2 bg-white rounded border border-teal-200">
                      <p className="text-xs text-slate-500">Kiralama</p>
                      <p className="font-bold text-slate-900">{formatCurrency(totals.rentalAmount)} TL</p>
                    </div>
                    <div className="text-center p-2 bg-white rounded border border-teal-200">
                      <p className="text-xs text-slate-500">KM Cezasi</p>
                      <p className={`font-bold ${totals.kmPenalty > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatCurrency(totals.kmPenalty)} TL
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white rounded border border-teal-200">
                      <p className="text-xs text-slate-500">Ek Harcamalar</p>
                      <p className={`font-bold ${totals.billableExpenses > 0 ? 'text-orange-600' : 'text-slate-900'}`}>
                        {formatCurrency(totals.billableExpenses)} TL
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white rounded border border-teal-200">
                      <p className="text-xs text-slate-500">Kaza Maliyeti</p>
                      <p className={`font-bold ${totals.billableAccidents > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatCurrency(totals.billableAccidents)} TL
                      </p>
                    </div>
                    <div className="text-center p-2 bg-teal-100 rounded border border-teal-300">
                      <p className="text-xs text-teal-700">TOPLAM BORC</p>
                      <p className="font-bold text-teal-700">{formatCurrency(totals.grandTotal)} TL</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="border-b border-slate-200">
              <nav className="flex gap-4">
                <button
                  onClick={() => setDetailTab('expenses')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === 'expenses'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Receipt className="h-4 w-4 inline mr-2" />
                  Ek Harcamalar ({rentalExpenses.length})
                </button>
                <button
                  onClick={() => setDetailTab('accidents')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === 'accidents'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  Kaza & Hasar ({rentalAccidents.length})
                </button>
                <button
                  onClick={() => setDetailTab('handovers')}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === 'handovers'
                      ? 'border-teal-600 text-teal-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <FileText className="h-4 w-4 inline mr-2" />
                  Tutanaklar ({rentalHandovers.length})
                </button>
                {detailRental?.billing_type === 'monthly' && (
                  <button
                    onClick={() => setDetailTab('payment_schedule')}
                    className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                      detailTab === 'payment_schedule'
                        ? 'border-teal-600 text-teal-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Wallet className="h-4 w-4 inline mr-2" />
                    Odeme Plani ({rentalPaymentSchedules.length})
                  </button>
                )}
              </nav>
            </div>

            {detailTab === 'expenses' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-slate-900">Ek Harcamalar</h4>
                  <Button size="sm" onClick={openExpenseForm}>
                    <Plus className="h-4 w-4 mr-1" />
                    Harcama Ekle
                  </Button>
                </div>

                {showExpenseForm && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                    <h5 className="font-medium text-slate-800">Yeni Harcama</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Select
                        label="Harcama Tipi"
                        value={expenseData.expense_type}
                        onChange={(e) => setExpenseData({ ...expenseData, expense_type: e.target.value as any })}
                        options={[
                          { value: 'hgs', label: 'HGS Gecis' },
                          { value: 'traffic_fine', label: 'Trafik Cezasi' },
                          { value: 'bridge_toll', label: 'Kopru Gecisi' },
                          { value: 'damage_repair', label: 'Hasar Onarimi' },
                          { value: 'other', label: 'Diger' },
                        ]}
                      />
                      <CurrencyInput
                        label="Tutar (TL)"
                        value={expenseData.amount}
                        onChange={(v) => setExpenseData({ ...expenseData, amount: v })}
                      />
                      <Input
                        label="Tarih"
                        type="date"
                        value={expenseData.expense_date}
                        onChange={(e) => setExpenseData({ ...expenseData, expense_date: e.target.value })}
                      />
                      <div className="flex items-end">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={expenseData.billable_to_customer}
                            onChange={(e) => setExpenseData({ ...expenseData, billable_to_customer: e.target.checked })}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-slate-700">Müşteriye Yansit</span>
                        </label>
                      </div>
                    </div>
                    <Input
                      label="Aciklama"
                      value={expenseData.description}
                      onChange={(e) => setExpenseData({ ...expenseData, description: e.target.value })}
                      placeholder="Ornegin: FSM Koprusu gecis ucreti"
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setShowExpenseForm(false)}>
                        Iptal
                      </Button>
                      <Button size="sm" onClick={handleAddExpense} loading={saving}>
                        Kaydet
                      </Button>
                    </div>
                  </div>
                )}

                {rentalExpenses.length === 0 ? (
                  <p className="text-center py-8 text-slate-500">Henuz harcama kaydedilmemis</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Tarih</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Tip</th>
                          <th className="text-left py-2 px-3 font-medium text-slate-600">Aciklama</th>
                          <th className="text-right py-2 px-3 font-medium text-slate-600">Tutar</th>
                          <th className="text-center py-2 px-3 font-medium text-slate-600">Yansitildi</th>
                          <th className="text-center py-2 px-3 font-medium text-slate-600">Islem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentalExpenses.map((expense) => (
                          <tr key={expense.id} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-2 px-3">{formatDate(expense.expense_date)}</td>
                            <td className="py-2 px-3">
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
                                {expenseTypeLabels[expense.expense_type] || expense.expense_type}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{expense.description || '-'}</td>
                            <td className="py-2 px-3 text-right font-medium">{formatCurrency(expense.amount)} TL</td>
                            <td className="py-2 px-3 text-center">
                              {expense.billable_to_customer ? (
                                <span className="text-green-600 font-medium">Evet</span>
                              ) : (
                                <span className="text-slate-400">Hayir</span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                className="p-1 hover:bg-red-50 rounded text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'accidents' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-slate-900">Kaza & Hasar Kayitlari</h4>
                  <Button size="sm" onClick={openAccidentForm}>
                    <Plus className="h-4 w-4 mr-1" />
                    Kaza Bildir
                  </Button>
                </div>

                {showAccidentForm && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">
                    <h5 className="font-medium text-slate-800">Yeni Kaza Kaydi</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Input
                        label="Kaza Tarihi"
                        type="date"
                        value={accidentData.accident_date}
                        onChange={(e) => setAccidentData({ ...accidentData, accident_date: e.target.value })}
                      />
                      <Input
                        label="Kusur Orani (%)"
                        type="number"
                        min="0"
                        max="100"
                        value={accidentData.driver_fault_rate}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setAccidentData({ ...accidentData, driver_fault_rate: Math.min(100, Math.max(0, val)) });
                        }}
                        placeholder="0-100 arasi deger girin"
                      />
                      <Select
                        label="Sigorta Tipi"
                        value={accidentData.insurance_type}
                        onChange={(e) => setAccidentData({ ...accidentData, insurance_type: e.target.value as any })}
                        options={[
                          { value: 'none', label: 'Sigorta Yok' },
                          { value: 'traffic', label: 'Trafik Sigortasi' },
                          { value: 'kasko', label: 'Kasko' },
                        ]}
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <CurrencyInput
                        label="Onarim Maliyeti (TL)"
                        value={accidentData.repair_cost}
                        onChange={(v) => setAccidentData({ ...accidentData, repair_cost: v })}
                      />
                      <CurrencyInput
                        label="Deger Kaybi (TL)"
                        value={accidentData.valuation_loss}
                        onChange={(v) => setAccidentData({ ...accidentData, valuation_loss: v })}
                      />
                      <div className="flex items-end">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={accidentData.is_driver_alcohol_involved}
                            onChange={(e) => setAccidentData({ ...accidentData, is_driver_alcohol_involved: e.target.checked })}
                            className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                          />
                          <span className="text-sm text-slate-700">Alkol Tespiti</span>
                        </label>
                      </div>
                      <div className="flex items-end">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={accidentData.charge_to_customer}
                            onChange={(e) => setAccidentData({ ...accidentData, charge_to_customer: e.target.checked })}
                            className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                          <span className="text-sm text-slate-700">Müşteriye Yansit</span>
                        </label>
                      </div>
                    </div>
                    <Input
                      label="Aciklama"
                      value={accidentData.description}
                      onChange={(e) => setAccidentData({ ...accidentData, description: e.target.value })}
                      placeholder="Kaza detaylari..."
                    />
                    <FileUpload
                      label="Kaza Tutanagi (PDF/Resim)"
                      accept="image/*,.pdf"
                      value={accidentData.accident_report_url}
                      onChange={(v) => setAccidentData({ ...accidentData, accident_report_url: v })}
                      downloadFilename={`kaza_tutanagi_${detailVehicle?.plate}`}
                    />
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => setShowAccidentForm(false)}>
                        Iptal
                      </Button>
                      <Button size="sm" onClick={handleAddAccident} loading={saving}>
                        Kaydet
                      </Button>
                    </div>
                  </div>
                )}

                {rentalAccidents.length === 0 ? (
                  <p className="text-center py-8 text-slate-500">Henuz kaza kaydedilmemis</p>
                ) : (
                  <div className="space-y-4">
                    {rentalAccidents.map((accident) => (
                      <div key={accident.id} className="p-4 border border-slate-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                              accident.driver_fault_rate >= 75
                                ? 'bg-red-100 text-red-700'
                                : accident.driver_fault_rate >= 40
                                ? 'bg-orange-100 text-orange-700'
                                : accident.driver_fault_rate > 0
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              %{accident.driver_fault_rate} Kusur
                            </span>
                            <span className="text-sm text-slate-600">{formatDate(accident.accident_date)}</span>
                            {accident.is_driver_alcohol_involved && (
                              <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                Alkol Tespiti
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteAccident(accident.id)}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                          <div>
                            <span className="text-slate-500">Sigorta:</span>
                            <p className="font-medium">
                              {accident.insurance_type === 'traffic' ? 'Trafik' : accident.insurance_type === 'kasko' ? 'Kasko' : 'Yok'}
                            </p>
                          </div>
                          <div>
                            <span className="text-slate-500">Onarim Maliyeti:</span>
                            <p className="font-medium">{formatCurrency(accident.repair_cost || 0)} TL</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Deger Kaybi:</span>
                            <p className="font-medium">{formatCurrency(accident.valuation_loss || 0)} TL</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Müşteriye Yansitildi:</span>
                            <p className={`font-medium ${accident.charge_to_customer ? 'text-green-600' : 'text-slate-400'}`}>
                              {accident.charge_to_customer ? 'Evet' : 'Hayir'}
                            </p>
                          </div>
                        </div>

                        {accident.description && (
                          <p className="text-sm text-slate-600 mb-3">{accident.description}</p>
                        )}

                        {accident.accident_report_url && (
                          <a
                            href={accident.accident_report_url}
                            download={`kaza_tutanagi_${formatDate(accident.accident_date)}`}
                            className="inline-flex items-center gap-1 text-sm text-teal-600 hover:text-teal-700"
                          >
                            <Download className="h-4 w-4" />
                            Kaza Tutanagi Indir
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'handovers' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-slate-900">Teslim Tutanaklari</h4>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setHandoverType('delivery');
                        setShowHandoverForm(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Teslim Tutanagi
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setHandoverType('return');
                        setShowHandoverForm(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Iade Tutanagi
                    </Button>
                  </div>
                </div>

                {rentalHandovers.length === 0 ? (
                  <p className="text-center py-8 text-slate-500">Henuz tutanak olusturulmamis</p>
                ) : (
                  <div className="space-y-3">
                    {rentalHandovers.map((handover) => (
                      <div key={handover.id} className="p-4 border border-slate-200 rounded-lg">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                              handover.type === 'delivery'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {handover.type === 'delivery' ? 'Teslim' : 'Iade'}
                            </span>
                            <span className="text-sm text-slate-600">
                              {new Date(handover.handover_date).toLocaleString('tr-TR')}
                            </span>
                            {handover.is_confirmed && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-teal-100 text-teal-700">
                                <Eye className="h-3 w-3" />
                                Onaylandi
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-slate-500">Kilometre:</span>
                            <p className="font-medium">{handover.current_km.toLocaleString('tr-TR')} km</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Yakit:</span>
                            <p className="font-medium">%{handover.fuel_level}</p>
                          </div>
                          <div>
                            <span className="text-slate-500">Fotograflar:</span>
                            <p className="font-medium">{handover.exterior_photos.length} adet</p>
                          </div>
                          {handover.staff && (
                            <div>
                              <span className="text-slate-500">Personel:</span>
                              <p className="font-medium">{handover.staff.full_name}</p>
                            </div>
                          )}
                        </div>

                        {handover.general_notes && (
                          <p className="text-sm text-slate-600 mt-3 p-2 bg-slate-50 rounded">
                            {handover.general_notes}
                          </p>
                        )}

                        {handover.exterior_photos.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                            {handover.exterior_photos.map((photo, idx) => (
                              <button
                                key={idx}
                                onClick={() => {
                                  setLightboxImages(handover.exterior_photos);
                                  setLightboxIndex(idx);
                                  setLightboxOpen(true);
                                }}
                                className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-slate-100"
                              >
                                <img src={photo} alt={`Fotograf ${idx + 1}`} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {detailTab === 'payment_schedule' && detailRental?.billing_type === 'monthly' && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="text-sm font-semibold text-blue-800">Sozlesme Ozeti</h4>
                    {(detailRental.tax_rate > 0 || detailRental.withholding_rate !== 'none') && (
                      <div className="text-xs text-slate-500">
                        {detailRental.tax_rate > 0 && <span className="mr-2">%{detailRental.tax_rate} KDV</span>}
                        {detailRental.withholding_rate !== 'none' && (
                          <span className="text-amber-600">{getWithholdingRateLabel(detailRental.withholding_rate)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div className="text-center p-2 bg-white rounded border border-blue-200">
                      <p className="text-xs text-slate-500">Toplam Net</p>
                      <p className="font-bold text-slate-900">
                        {formatCurrency(rentalPaymentSchedules.reduce((sum, s) => sum + (s.net_amount || s.amount), 0))} TL
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white rounded border border-blue-200">
                      <p className="text-xs text-slate-500">Toplam Odenecek</p>
                      <p className="font-bold text-blue-600">
                        {formatCurrency(rentalPaymentSchedules.reduce((sum, s) => sum + (s.total_payable || s.amount), 0))} TL
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white rounded border border-blue-200">
                      <p className="text-xs text-slate-500">Odenen</p>
                      <p className="font-bold text-green-600">
                        {formatCurrency(rentalPaymentSchedules.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.total_payable || s.amount), 0))} TL
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white rounded border border-orange-200">
                      <p className="text-xs text-slate-500">Vadesi Gelen Borc</p>
                      <p className="font-bold text-orange-600">
                        {formatCurrency(rentalPaymentSchedules.filter(s => s.status !== 'paid' && new Date(s.due_date) <= new Date()).reduce((sum, s) => sum + (s.total_payable || s.amount), 0))} TL
                      </p>
                    </div>
                    <div className="text-center p-2 bg-white rounded border border-slate-200">
                      <p className="text-xs text-slate-500">Vadesi Gelmemis</p>
                      <p className="font-bold text-slate-600">
                        {formatCurrency(rentalPaymentSchedules.filter(s => s.status !== 'paid' && new Date(s.due_date) > new Date()).reduce((sum, s) => sum + (s.total_payable || s.amount), 0))} TL
                      </p>
                    </div>
                  </div>
                  {rentalPaymentSchedules.some(s => s.withholding_deduction > 0) && (
                    <p className="text-xs text-amber-600 mt-3">
                      * Toplam Tevkifat: {formatCurrency(rentalPaymentSchedules.reduce((sum, s) => sum + (s.withholding_deduction || 0), 0))} TL (Müşteri tarafindan devlete odenir)
                    </p>
                  )}
                </div>

                <h4 className="font-medium text-slate-900">Odeme Plani</h4>

                {rentalPaymentSchedules.length === 0 ? (
                  <p className="text-center py-8 text-slate-500">Odeme plani bulunamadi</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-3 font-medium text-slate-600">Vade</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">Net</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">KDV</th>
                          {rentalPaymentSchedules.some(s => s.withholding_deduction > 0) && (
                            <th className="text-right py-3 px-3 font-medium text-slate-600">Tevkifat</th>
                          )}
                          <th className="text-right py-3 px-3 font-medium text-slate-600">Odenecek</th>
                          <th className="text-center py-3 px-3 font-medium text-slate-600">Durum</th>
                          <th className="text-right py-3 px-3 font-medium text-slate-600">Islem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rentalPaymentSchedules.map((schedule) => {
                          const isPast = new Date(schedule.due_date) < new Date();
                          const isOverdue = isPast && schedule.status !== 'paid';
                          const hasWithholding = rentalPaymentSchedules.some(s => s.withholding_deduction > 0);
                          return (
                            <tr key={schedule.id} className={`border-b border-slate-100 ${isOverdue ? 'bg-red-50' : ''}`}>
                              <td className="py-3 px-3">
                                <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                                  {formatDate(schedule.due_date)}
                                </span>
                                {isOverdue && (
                                  <span className="ml-1 text-xs text-red-600">(Gecikti)</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right">{formatCurrency(schedule.net_amount || schedule.amount)} TL</td>
                              <td className="py-3 px-3 text-right text-slate-500">{formatCurrency(schedule.tax_amount || 0)} TL</td>
                              {hasWithholding && (
                                <td className="py-3 px-3 text-right text-amber-600">
                                  {schedule.withholding_deduction > 0 ? `-${formatCurrency(schedule.withholding_deduction)} TL` : '-'}
                                </td>
                              )}
                              <td className="py-3 px-3 text-right font-medium">{formatCurrency(schedule.total_payable || schedule.amount)} TL</td>
                              <td className="py-3 px-3 text-center">
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  schedule.status === 'paid'
                                    ? 'bg-green-100 text-green-700'
                                    : schedule.status === 'invoiced'
                                    ? 'bg-blue-100 text-blue-700'
                                    : isOverdue
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {schedule.status === 'paid' ? 'Odendi' : schedule.status === 'invoiced' ? 'Faturalanmis' : 'Bekliyor'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right">
                                {schedule.status !== 'paid' ? (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={async () => {
                                      if (confirm('Bu odeme "Odendi" olarak isaretlensin mi?')) {
                                        const paidAt = new Date().toISOString();
                                        await supabase
                                          .from('rental_payment_schedules')
                                          .update({ status: 'paid', is_processed: true, paid_at: paidAt })
                                          .eq('id', schedule.id);

                                        await supabase
                                          .from('transactions')
                                          .insert({
                                            company_id: companyId,
                                            vehicle_id: detailRental.vehicle_id,
                                            type: 'income',
                                            category: 'Rental Income',
                                            description: `Kiralama Geliri - ${formatDate(schedule.due_date)}`,
                                            amount: schedule.total_payable || schedule.amount,
                                            transaction_date: paidAt.slice(0, 10),
                                            reference_id: schedule.id,
                                            reference_type: 'rental_payment_schedule',
                                          });

                                        const schedulesRes = await supabase
                                          .from('rental_payment_schedules')
                                          .select('*')
                                          .eq('rental_id', detailRental.id)
                                          .order('due_date', { ascending: true });
                                        setRentalPaymentSchedules(schedulesRes.data || []);
                                      }
                                    }}
                                  >
                                    Odendi Isaretle
                                  </Button>
                                ) : (
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className="text-xs text-slate-500">
                                      {schedule.paid_at ? new Date(schedule.paid_at).toLocaleDateString('tr-TR') : ''}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="text-amber-600 hover:bg-amber-50"
                                      onClick={async () => {
                                        if (confirm('Bu odeme "Bekliyor" durumuna geri alinsin mi? Kayitli gelir de silinecektir.')) {
                                          await supabase
                                            .from('rental_payment_schedules')
                                            .update({ status: 'pending', is_processed: false, paid_at: null })
                                            .eq('id', schedule.id);

                                          await supabase
                                            .from('transactions')
                                            .delete()
                                            .eq('reference_id', schedule.id)
                                            .eq('reference_type', 'rental_payment_schedule');

                                          const schedulesRes = await supabase
                                            .from('rental_payment_schedules')
                                            .select('*')
                                            .eq('rental_id', detailRental.id)
                                            .order('due_date', { ascending: true });
                                          setRentalPaymentSchedules(schedulesRes.data || []);
                                        }
                                      }}
                                    >
                                      Geri Al
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-slate-200">
              <Button variant="secondary" onClick={() => setShowRentalDetailModal(false)}>
                Kapat
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {showHandoverForm && detailRental && detailVehicle && companyId && user && (
        <HandoverForm
          rentalId={detailRental.id}
          vehicleId={detailVehicle.id}
          companyId={companyId}
          staffId={user.id}
          type={handoverType}
          currentVehicleKm={detailVehicle.current_km || undefined}
          onClose={() => setShowHandoverForm(false)}
          onSuccess={handleHandoverSuccess}
        />
      )}

      <Modal
        isOpen={showProposalModal}
        onClose={() => setShowProposalModal(false)}
        title={`Teklif Gonder: ${proposalVehicle?.plate}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="text-sm font-medium text-slate-700 mb-2">Arac Bilgileri</h4>
            <div className="text-sm space-y-1">
              <p><span className="text-slate-500">Marka/Model:</span> {proposalVehicle?.brand} {proposalVehicle?.model}</p>
              {proposalVehicle?.year && <p><span className="text-slate-500">Yil:</span> {proposalVehicle.year}</p>}
              {proposalVehicle?.color && <p><span className="text-slate-500">Renk:</span> {proposalVehicle.color}</p>}
            </div>
          </div>

          <Select
            label="Müşteri *"
            value={proposalData.customer_id}
            onChange={(e) => setProposalData({ ...proposalData, customer_id: e.target.value })}
            options={[
              { value: '', label: 'Müşteri secin...' },
              ...customers.map(c => ({ value: c.id, label: `${formatCustomerLabel(c)}${c.email ? ` (${c.email})` : ''}` })),
            ]}
          />

          <CurrencyInput
            label="Gunluk Kiralama Bedeli (TL)"
            value={proposalData.daily_rate}
            onChange={(v) => setProposalData({ ...proposalData, daily_rate: v })}
          />

          {proposalData.customer_id && !customers.find(c => c.id === proposalData.customer_id)?.email && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-sm text-amber-700">
                Secilen musterinin e-posta adresi kayitli degil. Mail gonderilmeden once e-posta eklemeniz oneriliyor.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button variant="secondary" onClick={() => setShowProposalModal(false)}>
              Iptal
            </Button>
            {proposalVehicle && proposalData.customer_id && (() => {
              const customer = customers.find(c => c.id === proposalData.customer_id);
              const defaultProfile = companyProfiles.find(p => p.is_default) || companyProfiles[0];
              if (customer) {
                const emailData = getProposalEmailData({
                  customer,
                  vehicle: proposalVehicle,
                  dailyRate: proposalData.daily_rate,
                  companyProfile: defaultProfile,
                });
                return (
                  <EmailDropdown
                    to={emailData.to}
                    subject={emailData.subject}
                    body={emailData.body}
                    buttonLabel="Teklifi Mail At"
                  />
                );
              }
              return (
                <Button disabled>
                  <Mail className="h-4 w-4 mr-2" />
                  Müşteri Secin
                </Button>
              );
            })()}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showEditRentalModal}
        onClose={() => setShowEditRentalModal(false)}
        title="Kiralamay Duzenle"
        size="lg"
      >
        {editingRental && (() => {
          const vehicle = vehicles.find(v => v.id === editingRental.vehicle_id);
          const customer = customers.find(c => c.id === editingRental.customer_id);

          const days = editRentalData.start_date && editRentalData.end_date
            ? Math.ceil((new Date(editRentalData.end_date).getTime() - new Date(editRentalData.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1
            : 0;
          const calculatedTotal = days * editRentalData.daily_rate;

          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Arac</p>
                  <p className="font-medium">{vehicle?.plate} - {vehicle?.brand} {vehicle?.model}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Müşteri</p>
                  <p className="font-medium">{customer ? formatCustomerLabel(customer) : '-'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Başlangıç Tarihi *"
                  type="date"
                  value={editRentalData.start_date}
                  onChange={(e) => {
                    setEditRentalData({ ...editRentalData, start_date: e.target.value });
                  }}
                />
                <Input
                  label="Bitiş Tarihi *"
                  type="date"
                  value={editRentalData.end_date}
                  onChange={(e) => {
                    setEditRentalData({ ...editRentalData, end_date: e.target.value });
                  }}
                />
              </div>

              {days > 0 && (
                <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                  <p className="text-sm text-teal-700">
                    <strong>Toplam Gun:</strong> {days} gun
                  </p>
                </div>
              )}

              <CurrencyInput
                label="Gunluk Kiralama Ucreti (TL)"
                value={editRentalData.daily_rate}
                onChange={(v) => {
                  setEditRentalData({ ...editRentalData, daily_rate: v, manual_total_override: false });
                }}
              />

              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Gunluk KM Limiti"
                  type="number"
                  value={editRentalData.daily_km_limit || ''}
                  onChange={(e) => setEditRentalData({ ...editRentalData, daily_km_limit: Number(e.target.value) })}
                  placeholder="0 = Limitsiz"
                />
                <CurrencyInput
                  label="KM Asim Ucreti (TL)"
                  value={editRentalData.per_km_overage_fee}
                  onChange={(v) => setEditRentalData({ ...editRentalData, per_km_overage_fee: v })}
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Toplam Tutar
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={editRentalData.manual_total_override}
                      onChange={(e) => setEditRentalData({ ...editRentalData, manual_total_override: e.target.checked })}
                      className="rounded"
                    />
                    Manuel Duzenleme
                  </label>
                </div>

                {editRentalData.manual_total_override ? (
                  <CurrencyInput
                    value={editRentalData.total_amount}
                    onChange={(v) => setEditRentalData({ ...editRentalData, total_amount: v })}
                  />
                ) : (
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <p className="text-lg font-bold text-slate-900">
                      {formatCurrency(calculatedTotal)} TL
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {days} gun x {formatCurrency(editRentalData.daily_rate)} TL
                    </p>
                  </div>
                )}

                {editRentalData.manual_total_override && (
                  <p className="text-xs text-amber-600 mt-2">
                    Otomatik hesaplama: {formatCurrency(calculatedTotal)} TL
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="secondary" onClick={() => setShowEditRentalModal(false)}>
                  Iptal
                </Button>
                <Button onClick={handleSaveEditRental} loading={saving}>
                  Kaydet
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <ProposalGenerator
        isOpen={showProposalGenerator}
        onClose={() => {
          setShowProposalGenerator(false);
          setProposalGeneratorVehicle(null);
        }}
        preselectedVehicle={proposalGeneratorVehicle}
      />

      <ContractGenerator
        isOpen={showContractGenerator}
        onClose={() => {
          setShowContractGenerator(false);
          setContractRentalId('');
        }}
        rentalId={contractRentalId}
      />

      {actionsModalVehicle && (
        <VehicleActionsModal
          isOpen={showActionsModal}
          onClose={() => {
            setShowActionsModal(false);
            setActionsModalVehicle(null);
          }}
          vehicle={actionsModalVehicle}
          rental={rentals.find(r => r.vehicle_id === actionsModalVehicle.id)}
          customers={customers}
          companyProfiles={companyProfiles}
          customerUsers={customerUsers}
          onRent={openRentalForm}
          onPrepareProposal={(vehicle) => {
            setProposalGeneratorVehicle(vehicle);
            setShowProposalGenerator(true);
          }}
          onPrintContract={(rentalId) => {
            setContractRentalId(rentalId);
            setShowContractGenerator(true);
          }}
          onEditRental={openEditRentalForm}
          onReturnVehicle={openReturnForm}
          onRentalHistory={openRentalHistory}
          onFinanceHistory={openFinanceHistory}
          onAssignCustomer={openAssignCustomerModal}
          onEdit={openEditForm}
          onDelete={handleDelete}
          onToggleKabis={toggleKabisStatus}
          onViewRentalDetail={openRentalDetail}
          onSell={openSaleForm}
          hasLinkedCustomer={customerUsers.some(u => u.linked_vehicle_ids?.includes(actionsModalVehicle.id))}
          hasCustomerUsers={customerUsers.length > 0}
        />
      )}

      <Modal
        isOpen={showAssignCustomerModal}
        onClose={() => setShowAssignCustomerModal(false)}
        title={`Müşteriye Ata: ${assignVehicle?.plate}`}
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-3">
              {assignVehicle?.photo_url ? (
                <img src={assignVehicle.photo_url} alt={assignVehicle.plate} className="h-12 w-16 object-cover rounded" />
              ) : (
                <div className="h-12 w-16 bg-slate-200 rounded flex items-center justify-center">
                  <Car className="h-6 w-6 text-slate-400" />
                </div>
              )}
              <div>
                <p className="font-medium text-slate-900">{assignVehicle?.plate}</p>
                <p className="text-sm text-slate-500">{assignVehicle?.brand} {assignVehicle?.model}</p>
              </div>
            </div>
          </div>

          {customerUsers.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                Henuz musteri hesabi bulunmuyor. Kullanicilar sayfasindan "customer" rolu ile yeni kullanici olusturun.
              </p>
            </div>
          ) : (
            <>
              <Select
                label="Müşteri Hesabi"
                value={selectedCustomerUserId}
                onChange={(e) => setSelectedCustomerUserId(e.target.value)}
              >
                <option value="">Müşteri secin veya atama kaldir...</option>
                {customerUsers.map(cu => (
                  <option key={cu.id} value={cu.id}>
                    {cu.full_name} (@{cu.username})
                    {cu.email && ` - ${cu.email}`}
                  </option>
                ))}
              </Select>

              {selectedCustomerUserId && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    Bu arac secili musteriye atanacak. Müşteri, Müşteri Portalinda bu araci gorebilecek.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAssignCustomerModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleAssignCustomer} loading={savingAssignment} className="flex-1">
              Kaydet
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showMaintenanceCompleteModal}
        onClose={() => setShowMaintenanceCompleteModal(false)}
        title="Bakim/Onarimi Tamamla"
      >
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Wrench className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900">{maintenanceVehicle?.plate}</p>
                <p className="text-sm text-green-700">{maintenanceVehicle?.brand} {maintenanceVehicle?.model}</p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              Bu arac su anda bakimda. Onarimi tamamlayarak araci tekrar kiraya verilebilir (aktif) duruma getirebilirsiniz.
            </p>
          </div>

          <CurrencyInput
            label="Onarim Maliyeti (Opsiyonel)"
            value={maintenanceRepairCost}
            onChange={setMaintenanceRepairCost}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Onarim Notlari</label>
            <textarea
              value={maintenanceNotes}
              onChange={(e) => setMaintenanceNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              placeholder="Yapilan onarim detaylari..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowMaintenanceCompleteModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button
              onClick={handleMaintenanceComplete}
              loading={savingMaintenanceComplete}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-1" />
              Aktife Al
            </Button>
          </div>
        </div>
      </Modal>

      <DeliveryReturnReport
        isOpen={showDeliveryReturnReport}
        onClose={() => {
          setShowDeliveryReturnReport(false);
          setDeliveryReturnReportRentalId('');
        }}
        rentalId={deliveryReturnReportRentalId}
        companyId={companyId}
      />

      <ImageLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <DeliveryReport
        isOpen={showDeliveryReport}
        onClose={() => setShowDeliveryReport(false)}
        rental={createdRental}
        vehicle={rentalVehicle}
        customer={customers.find(c => c.id === rentalData.customer_id) || null}
        companyId={companyId || ''}
      />

      <Modal
        isOpen={showSaleModal}
        onClose={() => {
          setShowSaleModal(false);
          setSaleVehicle(null);
        }}
        title={`Arac Sat: ${saleVehicle?.plate || ''}`}
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3">
              {saleVehicle?.photo_url ? (
                <img src={saleVehicle.photo_url} alt={saleVehicle.plate} className="h-14 w-20 object-cover rounded-lg" />
              ) : (
                <div className="h-14 w-20 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Car className="h-7 w-7 text-amber-500" />
                </div>
              )}
              <div>
                <p className="font-semibold text-amber-900">{saleVehicle?.plate}</p>
                <p className="text-sm text-amber-700">{saleVehicle?.brand} {saleVehicle?.model} ({saleVehicle?.year})</p>
                {saleVehicle?.color && <p className="text-xs text-amber-600">{saleVehicle.color}</p>}
              </div>
            </div>
          </div>

          <Input
            label="Satis Tarihi *"
            type="date"
            value={saleFormData.sale_date}
            onChange={(e) => setSaleFormData({ ...saleFormData, sale_date: e.target.value })}
          />

          <CurrencyInput
            label="Satis Tutari *"
            value={saleFormData.sale_amount}
            onChange={(val) => setSaleFormData({ ...saleFormData, sale_amount: val })}
          />

          <Input
            label="Alici Adi / Firma *"
            value={saleFormData.buyer_name}
            onChange={(e) => setSaleFormData({ ...saleFormData, buyer_name: e.target.value })}
            placeholder="Alici ad soyad veya firma unvani"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
            <textarea
              value={saleFormData.notes}
              onChange={(e) => setSaleFormData({ ...saleFormData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
              placeholder="Ek notlar..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={saleFormData.insurance_cancelled}
                onChange={(e) => setSaleFormData({ ...saleFormData, insurance_cancelled: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Sigorta Iptal</span>
                <p className="text-xs text-slate-500">Kasko/Trafik iptal edildi</p>
              </div>
            </label>
            <label className="flex items-center gap-2 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={saleFormData.casco_cancelled}
                onChange={(e) => setSaleFormData({ ...saleFormData, casco_cancelled: e.target.checked })}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Kasko Iptal</span>
                <p className="text-xs text-slate-500">Kasko policesi iptal edildi</p>
              </div>
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              variant="secondary"
              onClick={() => {
                setShowSaleModal(false);
                setSaleVehicle(null);
              }}
              className="flex-1"
            >
              Iptal
            </Button>
            <Button
              onClick={handleSaleSubmit}
              loading={savingSale}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              Satisi Tamamla
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
