import { useState, useEffect } from 'react';
import { Clock, Check, X, CalendarPlus, Gauge, AlertTriangle, Car, User, ChevronRight, AlertCircle, Wrench, Receipt, FileText, ZoomIn, Image as ImageIcon, MapPin, Users, Truck, Upload, Trash2, Phone, Send, Settings } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/auditLog';
import { formatCurrency } from '../utils/format';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import CurrencyInput from '../components/ui/CurrencyInput';
import Select from '../components/ui/Select';

interface CustomerRequest {
  id: string;
  company_id: string;
  user_id: string;
  vehicle_id: string | null;
  rental_id: string | null;
  request_type: 'extend_rental' | 'km_report' | 'accident_report' | 'payment_receipt' | 'maintenance_request';
  status: 'pending' | 'approved' | 'rejected';
  data: Record<string, unknown>;
  admin_notes: string | null;
  is_read: boolean;
  created_at: string;
  user?: { full_name: string; email: string };
  vehicle?: { plate: string; brand: string; model: string; current_km: number };
  rental?: {
    id: string;
    end_date: string;
    daily_rate: number;
    daily_km_limit: number | null;
    per_km_overage_fee: number | null;
    starting_km: number | null;
    customer_id: string;
  };
}

interface DamageReport {
  id: string;
  company_id: string;
  vehicle_id: string;
  customer_id: string;
  incident_type: 'accident' | 'breakdown' | 'damage';
  description: string;
  photo_urls: string[];
  urgency: string;
  status: 'pending' | 'in_progress' | 'resolved';
  admin_notes: string | null;
  created_at: string;
  vehicle?: { plate: string; brand: string; model: string };
  customer?: { full_name: string };
}

interface TransferRequest {
  id: string;
  company_id: string;
  customer_id: string;
  status: 'pending' | 'offered' | 'confirmed' | 'cancelled' | 'completed';
  vehicle_type: 'sedan' | 'vip_vito' | 'minibus' | 'bus' | 'truck';
  passenger_count: number;
  pickup_location: string;
  pickup_datetime: string;
  dropoff_location: string;
  notes: string | null;
  admin_notes: string | null;
  offered_price: number | null;
  proposal_photos: string[] | null;
  assigned_plate: string | null;
  assigned_driver_name: string | null;
  assigned_driver_phone: string | null;
  vehicle_color: string | null;
  meeting_point_note: string | null;
  passengers_submitted_at: string | null;
  created_at: string;
  customer?: { full_name: string; email: string };
}

interface TransferPassenger {
  id: string;
  transfer_request_id: string;
  full_name: string;
  tc_identity_number: string;
}

type TabType = 'requests' | 'damage' | 'transfers';

export default function CustomerRequests() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('requests');
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [damageReports, setDamageReports] = useState<DamageReport[]>([]);
  const [transferRequests, setTransferRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending'>('pending');

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);
  const [transferOfferPrice, setTransferOfferPrice] = useState(0);
  const [transferAdminNote, setTransferAdminNote] = useState('');
  const [transferPhotos, setTransferPhotos] = useState<File[]>([]);
  const [transferPhotoPreview, setTransferPhotoPreview] = useState<string[]>([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentTransfer, setAssignmentTransfer] = useState<TransferRequest | null>(null);
  const [assignmentPassengers, setAssignmentPassengers] = useState<TransferPassenger[]>([]);
  const [assignmentData, setAssignmentData] = useState({
    plate: '',
    driverName: '',
    driverPhone: '',
    vehicleColor: '',
    meetingNote: ''
  });
  const [savingAssignment, setSavingAssignment] = useState(false);

  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showKmModal, setShowKmModal] = useState(false);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxImage, setLightboxImage] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<CustomerRequest | null>(null);
  const [selectedDamage, setSelectedDamage] = useState<DamageReport | null>(null);
  const [processing, setProcessing] = useState(false);

  const [extensionData, setExtensionData] = useState({
    newEndDate: '',
    additionalCost: 0,
    addToDebt: true,
    adminNote: '',
  });

  const [kmData, setKmData] = useState({
    newKm: 0,
    kmOverage: 0,
    overageFee: 0,
    addFeeToDebt: false,
    adminNote: '',
  });

  const [damageData, setDamageData] = useState({
    billableToCustomer: false,
    repairCost: 0,
    maintenanceNote: '',
    adminNote: '',
  });

  const [receiptData, setReceiptData] = useState({
    amount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'bank_transfer',
    adminNote: '',
  });

  const [maintenanceData, setMaintenanceData] = useState({
    description: '',
    estimatedCost: 0,
    adminNote: '',
  });

  useEffect(() => {
    if (companyId) loadData();
  }, [companyId]);

  async function loadData() {
    setLoading(true);

    const [requestsRes, damageRes, transfersRes] = await Promise.all([
      supabase
        .from('customer_requests')
        .select(`
          *,
          user:app_users(full_name, email),
          vehicle:vehicles(plate, brand, model, current_km),
          rental:rentals(id, end_date, daily_rate, daily_km_limit, per_km_overage_fee, starting_km, customer_id)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('damage_reports')
        .select(`
          *,
          vehicle:vehicles(plate, brand, model),
          customer:app_users(full_name)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('transfer_requests')
        .select(`
          *,
          customer:customer_id(full_name, email)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
    ]);

    setRequests(requestsRes.data || []);
    setDamageReports(damageRes.data || []);
    setTransferRequests((transfersRes.data || []).map(t => ({
      ...t,
      customer: t.customer as any
    })));
    setLoading(false);
  }

  async function markAsRead(requestId: string) {
    await supabase
      .from('customer_requests')
      .update({ is_read: true })
      .eq('id', requestId);
  }

  function openExtensionModal(req: CustomerRequest) {
    markAsRead(req.id);
    const requestedDate = req.data.requested_end_date as string;
    const currentEndDate = req.rental?.end_date || '';
    const dailyRate = req.rental?.daily_rate || 0;

    let extraDays = 0;
    if (requestedDate && currentEndDate) {
      const requested = new Date(requestedDate);
      const current = new Date(currentEndDate);
      extraDays = Math.max(0, Math.ceil((requested.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const estimatedCost = extraDays * dailyRate;

    setSelectedRequest(req);
    setExtensionData({
      newEndDate: requestedDate,
      additionalCost: estimatedCost,
      addToDebt: true,
      adminNote: '',
    });
    setShowExtensionModal(true);
  }

  function openKmModal(req: CustomerRequest) {
    markAsRead(req.id);
    const reportedKm = (req.data.reported_km as number) || 0;
    const rental = req.rental;
    const dailyKmLimit = rental?.daily_km_limit || null;
    const startingKm = rental?.starting_km || 0;
    const overageFeePerKm = rental?.per_km_overage_fee || 0;

    let kmOverage = 0;
    let overageFee = 0;

    if (dailyKmLimit && rental) {
      const startDate = new Date(rental.end_date);
      const today = new Date();
      const daysPassed = Math.max(1, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const allowedKm = startingKm + (dailyKmLimit * daysPassed);

      if (reportedKm > allowedKm) {
        kmOverage = reportedKm - allowedKm;
        overageFee = kmOverage * overageFeePerKm;
      }
    }

    setSelectedRequest(req);
    setKmData({
      newKm: reportedKm,
      kmOverage,
      overageFee,
      addFeeToDebt: overageFee > 0,
      adminNote: '',
    });
    setShowKmModal(true);
  }

  function openReceiptModal(req: CustomerRequest) {
    markAsRead(req.id);
    setSelectedRequest(req);
    setReceiptData({
      amount: (req.data.amount as number) || 0,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'bank_transfer',
      adminNote: '',
    });
    setShowReceiptModal(true);
  }

  function openMaintenanceModal(req: CustomerRequest) {
    markAsRead(req.id);
    setSelectedRequest(req);
    setMaintenanceData({
      description: (req.data.description as string) || '',
      estimatedCost: 0,
      adminNote: '',
    });
    setShowMaintenanceModal(true);
  }

  function openDamageModal(damage: DamageReport) {
    setSelectedDamage(damage);
    setDamageData({
      billableToCustomer: false,
      repairCost: 0,
      maintenanceNote: '',
      adminNote: '',
    });
    setShowDamageModal(true);
  }

  function openLightbox(imageUrl: string) {
    setLightboxImage(imageUrl);
    setShowLightbox(true);
  }

  async function handleApproveExtension() {
    if (!selectedRequest) {
      alert('Talep secilmedi.');
      return;
    }

    if (!selectedRequest.rental_id) {
      alert('Bu talep bir kiralama kaydina bagli degil. Lutfen talebi kontrol edin.');
      return;
    }

    if (!extensionData.newEndDate) {
      alert('Yeni bitis tarihi secilmedi.');
      return;
    }

    setProcessing(true);

    try {
      const { data: rentalUpdateData, error: rentalError } = await supabase
        .from('rentals')
        .update({
          end_date: extensionData.newEndDate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.rental_id)
        .select('id, end_date')
        .single();

      if (rentalError) {
        console.error('Rental update error:', rentalError);
        throw new Error(`Kiralama guncelleme hatasi: ${rentalError.message}`);
      }

      if (!rentalUpdateData) {
        throw new Error('Kiralama kaydi guncellenemedi. Kayit bulunamadi.');
      }

      if (extensionData.addToDebt && extensionData.additionalCost > 0) {
        const { error: paymentError } = await supabase
          .from('customer_payments')
          .insert({
            company_id: companyId,
            user_id: selectedRequest.user_id,
            rental_id: selectedRequest.rental_id,
            vehicle_id: selectedRequest.vehicle_id,
            payment_type: 'rental_extension',
            description: `Kiralama suresi uzatimi - ${new Date(extensionData.newEndDate).toLocaleDateString('tr-TR')} tarihine kadar`,
            amount: extensionData.additionalCost,
            status: 'pending',
            related_request_id: selectedRequest.id,
          });

        if (paymentError) {
          console.error('Payment insert error:', paymentError);
          throw new Error(`Borc kaydi olusturulamadi: ${paymentError.message}`);
        }
      }

      const { error: requestError } = await supabase
        .from('customer_requests')
        .update({
          status: 'approved',
          admin_notes: extensionData.adminNote || null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (requestError) {
        console.error('Request update error:', requestError);
        throw new Error(`Talep durumu guncellenemedi: ${requestError.message}`);
      }

      await logActivity({
        action: 'UPDATE',
        entity: 'CustomerRequest',
        entityId: selectedRequest.id,
        details: `Sure uzatma talebi onaylandi: ${selectedRequest.vehicle?.plate} - Yeni bitis: ${extensionData.newEndDate}${extensionData.addToDebt ? ` - Borc: ${formatCurrency(extensionData.additionalCost)}` : ''}`,
        userEmail: user?.email,
        companyId,
      });

      alert(`Kiralama suresi ${new Date(extensionData.newEndDate).toLocaleDateString('tr-TR')} tarihine uzatildi.`);

      setShowExtensionModal(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      console.error('Error approving extension:', error);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }

    setProcessing(false);
  }

  async function handleApproveKm() {
    if (!selectedRequest) {
      alert('Talep secilmedi.');
      return;
    }

    if (!selectedRequest.vehicle_id) {
      alert('Bu talep bir araca bagli degil. Lutfen talebi kontrol edin.');
      return;
    }

    if (!kmData.newKm || kmData.newKm <= 0) {
      alert('Gecerli bir KM degeri girilmedi.');
      return;
    }

    setProcessing(true);

    try {
      const { data: vehicleUpdateData, error: vehicleError } = await supabase
        .from('vehicles')
        .update({
          current_km: kmData.newKm,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.vehicle_id)
        .select('id, current_km')
        .single();

      if (vehicleError) {
        console.error('Vehicle update error:', vehicleError);
        throw new Error(`Arac KM guncelleme hatasi: ${vehicleError.message}`);
      }

      if (!vehicleUpdateData) {
        throw new Error('Arac KM guncellenemedi. Arac bulunamadi.');
      }

      if (kmData.addFeeToDebt && kmData.overageFee > 0) {
        const { error: paymentError } = await supabase
          .from('customer_payments')
          .insert({
            company_id: companyId,
            user_id: selectedRequest.user_id,
            rental_id: selectedRequest.rental_id,
            vehicle_id: selectedRequest.vehicle_id,
            payment_type: 'km_overage',
            description: `KM asimi ucreti - ${kmData.kmOverage.toLocaleString('tr-TR')} km fazla kullanim`,
            amount: kmData.overageFee,
            status: 'pending',
            related_request_id: selectedRequest.id,
          });

        if (paymentError) {
          console.error('Payment insert error:', paymentError);
          throw new Error(`Asim ucreti kaydi olusturulamadi: ${paymentError.message}`);
        }
      }

      const { error: requestError } = await supabase
        .from('customer_requests')
        .update({
          status: 'approved',
          admin_notes: kmData.adminNote || null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (requestError) {
        console.error('Request update error:', requestError);
        throw new Error(`Talep durumu guncellenemedi: ${requestError.message}`);
      }

      await logActivity({
        action: 'UPDATE',
        entity: 'CustomerRequest',
        entityId: selectedRequest.id,
        details: `KM bildirimi onaylandi: ${selectedRequest.vehicle?.plate} - Yeni KM: ${kmData.newKm.toLocaleString('tr-TR')}${kmData.addFeeToDebt ? ` - Asim ucreti: ${formatCurrency(kmData.overageFee)}` : ''}`,
        userEmail: user?.email,
        companyId,
      });

      alert(`Arac KM ${kmData.newKm.toLocaleString('tr-TR')} olarak guncellendi.`);

      setShowKmModal(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      console.error('Error approving km:', error);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }

    setProcessing(false);
  }

  async function handleApproveReceipt() {
    if (!selectedRequest) return;

    setProcessing(true);

    try {
      const customerId = selectedRequest.rental?.customer_id;

      if (customerId && receiptData.amount > 0) {
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            company_id: companyId,
            type: 'income',
            category: 'Kira Odemesi',
            description: `Musteri dekont odemesi - ${selectedRequest.user?.full_name}${selectedRequest.vehicle ? ` - ${selectedRequest.vehicle.plate}` : ''}`,
            amount: receiptData.amount,
            transaction_date: receiptData.paymentDate,
            rental_id: selectedRequest.rental_id,
          });

        if (transactionError) throw transactionError;
      }

      const { error: requestError } = await supabase
        .from('customer_requests')
        .update({
          status: 'approved',
          admin_notes: receiptData.adminNote || null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (requestError) throw requestError;

      await logActivity({
        action: 'UPDATE',
        entity: 'CustomerRequest',
        entityId: selectedRequest.id,
        details: `Dekont onaylandi: ${selectedRequest.user?.full_name} - Tutar: ${formatCurrency(receiptData.amount)}`,
        userEmail: user?.email,
        companyId,
      });

      setShowReceiptModal(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      console.error('Error approving receipt:', error);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }

    setProcessing(false);
  }

  async function handleApproveMaintenance() {
    if (!selectedRequest || !selectedRequest.vehicle_id) return;

    setProcessing(true);

    try {
      const { error: maintenanceError } = await supabase
        .from('maintenances')
        .insert({
          company_id: companyId,
          vehicle_id: selectedRequest.vehicle_id,
          entry_date: new Date().toISOString().split('T')[0],
          cost: maintenanceData.estimatedCost,
          description: `[Musteri Talebi] ${maintenanceData.description || (selectedRequest.data.description as string) || 'Bakim talebi'}`,
        });

      if (maintenanceError) throw maintenanceError;

      const { error: requestError } = await supabase
        .from('customer_requests')
        .update({
          status: 'approved',
          admin_notes: maintenanceData.adminNote || null,
          resolved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (requestError) throw requestError;

      await logActivity({
        action: 'UPDATE',
        entity: 'CustomerRequest',
        entityId: selectedRequest.id,
        details: `Bakim talebi onaylandi: ${selectedRequest.vehicle?.plate} - Bakim kaydi olusturuldu`,
        userEmail: user?.email,
        companyId,
      });

      setShowMaintenanceModal(false);
      setSelectedRequest(null);
      loadData();
    } catch (error) {
      console.error('Error approving maintenance:', error);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }

    setProcessing(false);
  }

  async function handleResolveDamage() {
    if (!selectedDamage) return;

    setProcessing(true);

    try {
      const { error: maintenanceError } = await supabase
        .from('maintenances')
        .insert({
          company_id: companyId,
          vehicle_id: selectedDamage.vehicle_id,
          entry_date: new Date().toISOString().split('T')[0],
          cost: damageData.repairCost,
          description: `[Hasar Bildirimi] ${selectedDamage.incident_type === 'accident' ? 'Kaza' : selectedDamage.incident_type === 'breakdown' ? 'Ariza' : 'Hasar'}: ${selectedDamage.description}${damageData.maintenanceNote ? ` - ${damageData.maintenanceNote}` : ''}`,
        });

      if (maintenanceError) throw maintenanceError;

      if (damageData.billableToCustomer && damageData.repairCost > 0) {
        const { error: paymentError } = await supabase
          .from('customer_payments')
          .insert({
            company_id: companyId,
            user_id: selectedDamage.customer_id,
            vehicle_id: selectedDamage.vehicle_id,
            payment_type: 'damage_repair',
            description: `Hasar onarim ucreti - ${selectedDamage.vehicle?.plate}`,
            amount: damageData.repairCost,
            status: 'pending',
            related_damage_report_id: selectedDamage.id,
          });

        if (paymentError) throw paymentError;
      }

      const { error: damageError } = await supabase
        .from('damage_reports')
        .update({
          status: 'resolved',
          admin_notes: damageData.adminNote || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedDamage.id);

      if (damageError) throw damageError;

      await logActivity({
        action: 'UPDATE',
        entity: 'DamageReport',
        entityId: selectedDamage.id,
        details: `Hasar bildirimi cozumlendi: ${selectedDamage.vehicle?.plate} - Maliyet: ${formatCurrency(damageData.repairCost)}${damageData.billableToCustomer ? ' (Musteriye fatura edildi)' : ''}`,
        userEmail: user?.email,
        companyId,
      });

      setShowDamageModal(false);
      setSelectedDamage(null);
      loadData();
    } catch (error) {
      console.error('Error resolving damage:', error);
      alert('Islem sirasinda bir hata olustu. Lutfen tekrar deneyin.');
    }

    setProcessing(false);
  }

  async function handleRejectRequest(req: CustomerRequest) {
    const reason = prompt('Red sebebini girin (opsiyonel):');

    const { error } = await supabase
      .from('customer_requests')
      .update({
        status: 'rejected',
        admin_notes: reason || null,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'CustomerRequest',
        entityId: req.id,
        details: `Talep reddedildi: ${req.request_type} - ${req.vehicle?.plate}${reason ? ` - Sebep: ${reason}` : ''}`,
        userEmail: user?.email,
        companyId,
      });
      loadData();
    }
  }

  function getRequestTypeIcon(type: string) {
    switch (type) {
      case 'extend_rental':
        return <CalendarPlus className="h-5 w-5" />;
      case 'km_report':
        return <Gauge className="h-5 w-5" />;
      case 'accident_report':
        return <AlertTriangle className="h-5 w-5" />;
      case 'payment_receipt':
        return <Receipt className="h-5 w-5" />;
      case 'maintenance_request':
        return <Wrench className="h-5 w-5" />;
      default:
        return <Clock className="h-5 w-5" />;
    }
  }

  function getRequestTypeLabel(type: string) {
    switch (type) {
      case 'extend_rental':
        return 'Sure Uzatma';
      case 'km_report':
        return 'KM Bildirimi';
      case 'accident_report':
        return 'Kaza Bildirimi';
      case 'payment_receipt':
        return 'Odeme Dekontu';
      case 'maintenance_request':
        return 'Bakim Talebi';
      default:
        return type;
    }
  }

  function getRequestTypeColor(type: string) {
    switch (type) {
      case 'extend_rental':
        return 'bg-blue-100 text-blue-600';
      case 'km_report':
        return 'bg-emerald-100 text-emerald-600';
      case 'accident_report':
        return 'bg-red-100 text-red-600';
      case 'payment_receipt':
        return 'bg-teal-100 text-teal-600';
      case 'maintenance_request':
        return 'bg-amber-100 text-amber-600';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Bekliyor
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <Check className="h-3 w-3" /> Onaylandi
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <X className="h-3 w-3" /> Reddedildi
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
            <Wrench className="h-3 w-3" /> Isleniyor
          </span>
        );
      case 'resolved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <Check className="h-3 w-3" /> Cozumlendi
          </span>
        );
      default:
        return null;
    }
  }

  function getUrgencyBadge(urgency: string) {
    switch (urgency) {
      case 'critical':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-red-500 text-white">KRITIK</span>;
      case 'high':
        return <span className="px-2 py-0.5 text-xs font-bold rounded bg-orange-500 text-white">YUKSEK</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-amber-100 text-amber-700">ORTA</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-100 text-slate-600">DUSUK</span>;
    }
  }

  function openRequestModal(req: CustomerRequest) {
    switch (req.request_type) {
      case 'extend_rental':
        openExtensionModal(req);
        break;
      case 'km_report':
        openKmModal(req);
        break;
      case 'payment_receipt':
        openReceiptModal(req);
        break;
      case 'maintenance_request':
        openMaintenanceModal(req);
        break;
    }
  }

  const filteredRequests = filter === 'pending'
    ? requests.filter(r => r.status === 'pending')
    : requests;

  const filteredDamageReports = filter === 'pending'
    ? damageReports.filter(d => d.status === 'pending' || d.status === 'in_progress')
    : damageReports;

  const filteredTransfers = filter === 'pending'
    ? transferRequests.filter(t => t.status === 'pending' || t.status === 'offered')
    : transferRequests;

  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;
  const pendingDamageCount = damageReports.filter(d => d.status === 'pending' || d.status === 'in_progress').length;
  const pendingTransferCount = transferRequests.filter(t => t.status === 'pending').length;
  const unreadCount = requests.filter(r => !r.is_read && r.status === 'pending').length;

  function openTransferModal(transfer: TransferRequest) {
    setSelectedTransfer(transfer);
    setTransferOfferPrice(transfer.offered_price || 0);
    setTransferAdminNote(transfer.admin_notes || '');
    setTransferPhotos([]);
    setTransferPhotoPreview([]);
    setShowTransferModal(true);
  }

  function handleTransferPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const newFiles = Array.from(files);
    const validFiles = newFiles.filter(file => file.type.startsWith('image/'));

    if (validFiles.length + transferPhotos.length > 6) {
      alert('En fazla 6 fotograf yukleyebilirsiniz.');
      return;
    }

    setTransferPhotos(prev => [...prev, ...validFiles]);

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTransferPhotoPreview(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removeTransferPhoto(index: number) {
    setTransferPhotos(prev => prev.filter((_, i) => i !== index));
    setTransferPhotoPreview(prev => prev.filter((_, i) => i !== index));
  }

  async function uploadTransferPhotos(): Promise<string[]> {
    if (transferPhotos.length === 0) return [];

    setUploadingPhotos(true);
    const uploadedUrls: string[] = [];

    for (const file of transferPhotos) {
      const timestamp = Date.now();
      const fileName = `${selectedTransfer?.id}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;

      const { error } = await supabase.storage
        .from('transfer-photos')
        .upload(fileName, file, { upsert: true });

      if (!error) {
        const { data: urlData } = supabase.storage
          .from('transfer-photos')
          .getPublicUrl(fileName);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }
    }

    setUploadingPhotos(false);
    return uploadedUrls;
  }

  function getVehicleTypeLabel(type: string) {
    switch (type) {
      case 'sedan': return 'Sedan';
      case 'vip_vito': return 'VIP Vito';
      case 'minibus': return 'Minibus';
      case 'bus': return 'Otobus';
      case 'truck': return 'Kamyon';
      default: return type;
    }
  }

  function getTransferStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700"><Clock className="h-3 w-3" /> Bekliyor</span>;
      case 'offered':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700"><Truck className="h-3 w-3" /> Teklif Verildi</span>;
      case 'confirmed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700"><Check className="h-3 w-3" /> Onaylandi</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700"><X className="h-3 w-3" /> Iptal</span>;
      case 'completed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700"><Check className="h-3 w-3" /> Tamamlandi</span>;
      default:
        return null;
    }
  }

  async function handleOfferTransfer() {
    if (!selectedTransfer || transferOfferPrice <= 0) {
      alert('Lutfen gecerli bir fiyat girin.');
      return;
    }

    setProcessing(true);

    let photoUrls: string[] = [];
    if (transferPhotos.length > 0) {
      photoUrls = await uploadTransferPhotos();
    }

    const { error } = await supabase
      .from('transfer_requests')
      .update({
        status: 'offered',
        offered_price: transferOfferPrice,
        admin_notes: transferAdminNote || null,
        proposal_photos: photoUrls.length > 0 ? photoUrls : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedTransfer.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'TransferRequest',
        entityId: selectedTransfer.id,
        details: `Transfer talebi icin teklif verildi: ${selectedTransfer.pickup_location} -> ${selectedTransfer.dropoff_location} - Fiyat: ${formatCurrency(transferOfferPrice)}${photoUrls.length > 0 ? ` - ${photoUrls.length} fotograf eklendi` : ''}`,
        userEmail: user?.email,
        companyId,
      });

      setShowTransferModal(false);
      setSelectedTransfer(null);
      setTransferPhotos([]);
      setTransferPhotoPreview([]);
      loadData();
    } else {
      alert('Islem sirasinda bir hata olustu.');
    }

    setProcessing(false);
  }

  async function handleRejectTransfer(transfer: TransferRequest) {
    const reason = prompt('Iptal sebebini girin (opsiyonel):');

    const { error } = await supabase
      .from('transfer_requests')
      .update({
        status: 'cancelled',
        admin_notes: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfer.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'TransferRequest',
        entityId: transfer.id,
        details: `Transfer talebi iptal edildi: ${transfer.pickup_location} -> ${transfer.dropoff_location}${reason ? ` - Sebep: ${reason}` : ''}`,
        userEmail: user?.email,
        companyId,
      });
      loadData();
    }
  }

  async function handleCompleteTransfer(transfer: TransferRequest) {
    const { error } = await supabase
      .from('transfer_requests')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfer.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'TransferRequest',
        entityId: transfer.id,
        details: `Transfer tamamlandi: ${transfer.pickup_location} -> ${transfer.dropoff_location}`,
        userEmail: user?.email,
        companyId,
      });
      loadData();
    }
  }

  async function openAssignmentModal(transfer: TransferRequest) {
    setAssignmentTransfer(transfer);
    setAssignmentData({
      plate: transfer.assigned_plate || '',
      driverName: transfer.assigned_driver_name || '',
      driverPhone: transfer.assigned_driver_phone || '',
      vehicleColor: transfer.vehicle_color || '',
      meetingNote: transfer.meeting_point_note || ''
    });

    const { data: passengers } = await supabase
      .from('transfer_passengers')
      .select('*')
      .eq('transfer_request_id', transfer.id);

    setAssignmentPassengers(passengers || []);
    setShowAssignmentModal(true);
  }

  async function handleSaveAssignment() {
    if (!assignmentTransfer) return;

    if (!assignmentData.plate.trim() || !assignmentData.driverName.trim() || !assignmentData.driverPhone.trim()) {
      alert('Lutfen Plaka, Sofor Adi ve Telefon alanlarini doldurun.');
      return;
    }

    setSavingAssignment(true);

    const { error } = await supabase
      .from('transfer_requests')
      .update({
        assigned_plate: assignmentData.plate,
        assigned_driver_name: assignmentData.driverName,
        assigned_driver_phone: assignmentData.driverPhone,
        vehicle_color: assignmentData.vehicleColor || null,
        meeting_point_note: assignmentData.meetingNote || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentTransfer.id);

    if (!error) {
      await logActivity({
        action: 'UPDATE',
        entity: 'TransferRequest',
        entityId: assignmentTransfer.id,
        details: `Transfer operasyon atamasi yapildi: ${assignmentTransfer.pickup_location} -> ${assignmentTransfer.dropoff_location} - Plaka: ${assignmentData.plate}, Sofor: ${assignmentData.driverName}`,
        userEmail: user?.email,
        companyId,
      });

      setShowAssignmentModal(false);
      setAssignmentTransfer(null);
      setAssignmentPassengers([]);
      loadData();
    } else {
      alert('Islem sirasinda bir hata olustu.');
    }

    setSavingAssignment(false);
  }

  function isAssigned(transfer: TransferRequest): boolean {
    return !!transfer.assigned_plate && !!transfer.assigned_driver_name;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Talepler & Bildirimler</h1>
          <p className="text-sm text-slate-500 mt-1">Musteri taleplerini inceleyin ve yonetin</p>
        </div>
        {unreadCount > 0 && (
          <div className="px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="text-sm font-medium text-amber-800">{unreadCount} yeni talep</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'requests'
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="h-4 w-4" />
            Talepler
            {pendingRequestsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-amber-500 text-white rounded-full">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('damage')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'damage'
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            Hasar Bildirimleri
            {pendingDamageCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">
                {pendingDamageCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'transfers'
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Truck className="h-4 w-4" />
            Transfer Talepleri
            {pendingTransferCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold bg-blue-500 text-white rounded-full">
                {pendingTransferCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex border-b border-slate-100 px-4">
          {['pending', 'all'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                filter === f
                  ? 'text-teal-600 border-b-2 border-teal-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'pending' ? 'Bekleyenler' : 'Tumu'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : activeTab === 'requests' ? (
          filteredRequests.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Talep bulunamadi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRequests.map((req) => (
                <div
                  key={req.id}
                  className={`p-4 hover:bg-slate-50 transition-colors ${!req.is_read && req.status === 'pending' ? 'bg-amber-50/50' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${getRequestTypeColor(req.request_type)}`}>
                      {getRequestTypeIcon(req.request_type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">{getRequestTypeLabel(req.request_type)}</span>
                        {!req.is_read && req.status === 'pending' && (
                          <span className="px-1.5 py-0.5 text-xs font-bold bg-teal-500 text-white rounded">YENI</span>
                        )}
                        {getStatusBadge(req.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                        {req.vehicle && (
                          <span className="flex items-center gap-1">
                            <Car className="h-4 w-4 text-slate-400" />
                            {req.vehicle.plate} - {req.vehicle.brand} {req.vehicle.model}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4 text-slate-400" />
                          {req.user?.full_name}
                        </span>
                      </div>

                      {req.request_type === 'extend_rental' && (
                        <div className="text-sm bg-slate-50 rounded-lg p-2 mb-2">
                          <p>
                            <span className="text-slate-500">Mevcut bitis:</span>{' '}
                            <span className="font-medium">{req.rental?.end_date ? new Date(req.rental.end_date).toLocaleDateString('tr-TR') : '-'}</span>
                            {' '}<ChevronRight className="h-4 w-4 inline text-slate-400" />{' '}
                            <span className="text-slate-500">Talep edilen:</span>{' '}
                            <span className="font-medium text-blue-600">
                              {req.data.requested_end_date ? new Date(req.data.requested_end_date as string).toLocaleDateString('tr-TR') : '-'}
                            </span>
                          </p>
                          {req.data.note && <p className="text-slate-500 mt-1">Not: {req.data.note as string}</p>}
                        </div>
                      )}

                      {req.request_type === 'km_report' && (
                        <div className="text-sm bg-slate-50 rounded-lg p-2 mb-2">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-slate-500">Onceki KM:</span>{' '}
                              <span className="font-medium">{((req.data.previous_km as number) || 0).toLocaleString('tr-TR')}</span>
                              {' '}<ChevronRight className="h-4 w-4 inline text-slate-400" />{' '}
                              <span className="text-slate-500">Bildirilen:</span>{' '}
                              <span className="font-medium text-emerald-600">
                                {((req.data.reported_km as number) || 0).toLocaleString('tr-TR')} km
                              </span>
                            </div>
                            {req.data.photo_url && (
                              <button
                                onClick={() => openLightbox(req.data.photo_url as string)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                              >
                                <ImageIcon className="h-3 w-3" />
                                Foto
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {req.request_type === 'payment_receipt' && (
                        <div className="text-sm bg-slate-50 rounded-lg p-2 mb-2">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-slate-500">Bildirilen Tutar:</span>{' '}
                              <span className="font-semibold text-teal-600">{formatCurrency((req.data.amount as number) || 0)}</span>
                            </div>
                            {req.data.receipt_url && (
                              <button
                                onClick={() => openLightbox(req.data.receipt_url as string)}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-teal-100 text-teal-700 rounded hover:bg-teal-200 transition-colors"
                              >
                                <ZoomIn className="h-3 w-3" />
                                Dekont Gor
                              </button>
                            )}
                          </div>
                          {req.data.description && <p className="text-slate-500 mt-1">{req.data.description as string}</p>}
                        </div>
                      )}

                      {req.request_type === 'maintenance_request' && (
                        <div className="text-sm bg-slate-50 rounded-lg p-2 mb-2">
                          <p className="text-slate-600">{req.data.description as string}</p>
                          {req.data.urgency && (
                            <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded ${
                              req.data.urgency === 'high' ? 'bg-red-100 text-red-700' :
                              req.data.urgency === 'medium' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {req.data.urgency === 'high' ? 'Acil' : req.data.urgency === 'medium' ? 'Normal' : 'Dusuk'}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-slate-500">
                        {new Date(req.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {req.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openRequestModal(req)}
                          className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                        >
                          Incele
                        </button>
                        <button
                          onClick={() => handleRejectRequest(req)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Reddet"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activeTab === 'damage' ? (
          filteredDamageReports.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Hasar bildirimi bulunamadi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDamageReports.map((damage) => (
                <div key={damage.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${
                      damage.incident_type === 'accident' ? 'bg-red-100 text-red-600' :
                      damage.incident_type === 'breakdown' ? 'bg-amber-100 text-amber-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      <AlertTriangle className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">
                          {damage.incident_type === 'accident' ? 'Kaza' : damage.incident_type === 'breakdown' ? 'Ariza' : 'Hasar'}
                        </span>
                        {getUrgencyBadge(damage.urgency)}
                        {getStatusBadge(damage.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                        <span className="flex items-center gap-1">
                          <Car className="h-4 w-4 text-slate-400" />
                          {damage.vehicle?.plate} - {damage.vehicle?.brand} {damage.vehicle?.model}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4 text-slate-400" />
                          {damage.customer?.full_name}
                        </span>
                      </div>

                      <p className="text-sm text-slate-600 mb-2">{damage.description}</p>

                      {damage.photo_urls && damage.photo_urls.length > 0 && (
                        <div className="flex gap-2 mb-2">
                          {damage.photo_urls.slice(0, 4).map((url, i) => (
                            <button
                              key={i}
                              onClick={() => openLightbox(url)}
                              className="relative group"
                            >
                              <img src={url} alt={`Foto ${i + 1}`} className="w-16 h-16 object-cover rounded-lg" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                                <ZoomIn className="h-4 w-4 text-white" />
                              </div>
                            </button>
                          ))}
                          {damage.photo_urls.length > 4 && (
                            <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-sm text-slate-500">
                              +{damage.photo_urls.length - 4}
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-slate-500">
                        {new Date(damage.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {(damage.status === 'pending' || damage.status === 'in_progress') && (
                      <button
                        onClick={() => openDamageModal(damage)}
                        className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                      >
                        Cozumle
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          filteredTransfers.length === 0 ? (
            <div className="text-center py-12">
              <Truck className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Transfer talebi bulunamadi</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransfers.map((transfer) => (
                <div key={transfer.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                      <Truck className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-900">Transfer Talebi</span>
                        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">
                          {getVehicleTypeLabel(transfer.vehicle_type)}
                        </span>
                        {getTransferStatusBadge(transfer.status)}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-2">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4 text-slate-400" />
                          {transfer.customer?.full_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-slate-400" />
                          {transfer.passenger_count} Yolcu
                        </span>
                      </div>

                      <div className="text-sm bg-slate-50 rounded-lg p-3 mb-2">
                        <div className="flex items-start gap-2 mb-2">
                          <MapPin className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs text-slate-500">Alis:</span>
                            <p className="font-medium text-slate-800">{transfer.pickup_location}</p>
                            <p className="text-xs text-slate-500">
                              {new Date(transfer.pickup_datetime).toLocaleString('tr-TR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-xs text-slate-500">Bırakış:</span>
                            <p className="font-medium text-slate-800">{transfer.dropoff_location}</p>
                          </div>
                        </div>
                      </div>

                      {transfer.notes && (
                        <p className="text-sm text-slate-600 mb-2 italic">"{transfer.notes}"</p>
                      )}

                      {transfer.offered_price && transfer.status !== 'pending' && (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 border border-green-200 rounded text-sm mb-2">
                          <span className="text-green-600">Teklif:</span>
                          <span className="font-semibold text-green-700">{formatCurrency(transfer.offered_price)}</span>
                        </div>
                      )}

                      <p className="text-xs text-slate-500">
                        {new Date(transfer.created_at).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {transfer.status === 'pending' && (
                        <>
                          <button
                            onClick={() => openTransferModal(transfer)}
                            className="px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            Teklif Ver
                          </button>
                          <button
                            onClick={() => handleRejectTransfer(transfer)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Iptal Et"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {transfer.status === 'confirmed' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openAssignmentModal(transfer)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              isAssigned(transfer)
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-amber-500 text-white hover:bg-amber-600'
                            }`}
                          >
                            <Settings className="h-4 w-4" />
                            {isAssigned(transfer) ? 'Operasyon' : 'Atama Yap'}
                          </button>
                          {isAssigned(transfer) && (
                            <button
                              onClick={() => handleCompleteTransfer(transfer)}
                              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Tamamla
                            </button>
                          )}
                        </div>
                      )}
                      {transfer.status === 'offered' && (
                        <span className="text-xs text-blue-600 font-medium">Musteri onayı bekleniyor</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {showLightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setShowLightbox(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white transition-colors"
            onClick={() => setShowLightbox(false)}
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={lightboxImage}
            alt="Buyutulmus goruntu"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Modal
        isOpen={showExtensionModal}
        onClose={() => setShowExtensionModal(false)}
        title="Sure Uzatma Onayi"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Car className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900">
                {selectedRequest?.vehicle?.plate} - {selectedRequest?.vehicle?.brand} {selectedRequest?.vehicle?.model}
              </span>
            </div>
            <p className="text-sm text-blue-700">
              Musteri: {selectedRequest?.user?.full_name}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs text-slate-500 mb-1">Mevcut Bitis</p>
              <p className="font-semibold text-slate-900">
                {selectedRequest?.rental?.end_date ? new Date(selectedRequest.rental.end_date).toLocaleDateString('tr-TR') : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Gunluk Ucret</p>
              <p className="font-semibold text-slate-900">
                {formatCurrency(selectedRequest?.rental?.daily_rate || 0)}
              </p>
            </div>
          </div>

          <Input
            label="Yeni Bitis Tarihi"
            type="date"
            value={extensionData.newEndDate}
            onChange={(e) => {
              const newDate = e.target.value;
              const currentEnd = selectedRequest?.rental?.end_date || '';
              const dailyRate = selectedRequest?.rental?.daily_rate || 0;
              let extraDays = 0;
              if (newDate && currentEnd) {
                const requested = new Date(newDate);
                const current = new Date(currentEnd);
                extraDays = Math.max(0, Math.ceil((requested.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)));
              }
              setExtensionData({
                ...extensionData,
                newEndDate: newDate,
                additionalCost: extraDays * dailyRate,
              });
            }}
          />

          <CurrencyInput
            label="Ek Ucret"
            value={extensionData.additionalCost}
            onChange={(value) => setExtensionData({ ...extensionData, additionalCost: value })}
          />

          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <input
              type="checkbox"
              id="addToDebt"
              checked={extensionData.addToDebt}
              onChange={(e) => setExtensionData({ ...extensionData, addToDebt: e.target.checked })}
              className="h-4 w-4 text-teal-600 rounded"
            />
            <label htmlFor="addToDebt" className="text-sm text-amber-800">
              <span className="font-medium">Bu tutari musteri borcuna ekle</span>
              <span className="block text-xs text-amber-600">Odeme bekleyenler listesinde gorunur</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Notu (Opsiyonel)</label>
            <textarea
              value={extensionData.adminNote}
              onChange={(e) => setExtensionData({ ...extensionData, adminNote: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Dahili not..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowExtensionModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleApproveExtension} loading={processing} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Onayla
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showKmModal}
        onClose={() => setShowKmModal(false)}
        title="KM Bildirimi Onayi"
      >
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Car className="h-5 w-5 text-emerald-600" />
              <span className="font-semibold text-emerald-900">
                {selectedRequest?.vehicle?.plate} - {selectedRequest?.vehicle?.brand} {selectedRequest?.vehicle?.model}
              </span>
            </div>
            <p className="text-sm text-emerald-700">
              Musteri: {selectedRequest?.user?.full_name}
            </p>
          </div>

          {selectedRequest?.data.photo_url && (
            <div className="relative">
              <img
                src={selectedRequest.data.photo_url as string}
                alt="KM Gostergesi"
                className="w-full h-48 object-cover rounded-xl cursor-pointer"
                onClick={() => openLightbox(selectedRequest.data.photo_url as string)}
              />
              <button
                onClick={() => openLightbox(selectedRequest.data.photo_url as string)}
                className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded flex items-center gap-1"
              >
                <ZoomIn className="h-3 w-3" />
                Buyut
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
            <div>
              <p className="text-xs text-slate-500 mb-1">Onceki KM</p>
              <p className="font-semibold text-slate-900">
                {((selectedRequest?.data.previous_km as number) || 0).toLocaleString('tr-TR')} km
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Bildirilen KM</p>
              <p className="font-semibold text-emerald-600">
                {kmData.newKm.toLocaleString('tr-TR')} km
              </p>
            </div>
          </div>

          {kmData.kmOverage > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-900">KM Limiti Asildi!</span>
              </div>
              <p className="text-sm text-red-700 mb-2">
                Sozlesme limiti {kmData.kmOverage.toLocaleString('tr-TR')} km asildi.
              </p>

              <CurrencyInput
                label="Asim Ucreti"
                value={kmData.overageFee}
                onChange={(value) => setKmData({ ...kmData, overageFee: value })}
              />

              <div className="flex items-center gap-3 mt-3">
                <input
                  type="checkbox"
                  id="addFeeToDebt"
                  checked={kmData.addFeeToDebt}
                  onChange={(e) => setKmData({ ...kmData, addFeeToDebt: e.target.checked })}
                  className="h-4 w-4 text-teal-600 rounded"
                />
                <label htmlFor="addFeeToDebt" className="text-sm text-red-800">
                  <span className="font-medium">Bu ucreti musteri borcuna ekle</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Notu (Opsiyonel)</label>
            <textarea
              value={kmData.adminNote}
              onChange={(e) => setKmData({ ...kmData, adminNote: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Dahili not..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowKmModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleApproveKm} loading={processing} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Onayla
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        title="Odeme Dekontu Onayi"
      >
        <div className="space-y-4">
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Receipt className="h-5 w-5 text-teal-600" />
              <span className="font-semibold text-teal-900">Odeme Bildirimi</span>
            </div>
            <p className="text-sm text-teal-700">
              Musteri: {selectedRequest?.user?.full_name}
            </p>
            {selectedRequest?.vehicle && (
              <p className="text-sm text-teal-700">
                Arac: {selectedRequest.vehicle.plate}
              </p>
            )}
          </div>

          {selectedRequest?.data.receipt_url && (
            <div className="relative">
              <img
                src={selectedRequest.data.receipt_url as string}
                alt="Dekont"
                className="w-full h-64 object-contain bg-slate-100 rounded-xl cursor-pointer"
                onClick={() => openLightbox(selectedRequest.data.receipt_url as string)}
              />
              <button
                onClick={() => openLightbox(selectedRequest.data.receipt_url as string)}
                className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/60 text-white text-sm rounded flex items-center gap-1"
              >
                <ZoomIn className="h-4 w-4" />
                Tam Ekran
              </button>
            </div>
          )}

          {selectedRequest?.data.description && (
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-600">{selectedRequest.data.description as string}</p>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800">
              <span className="font-medium">Musteri Bildirimi:</span>{' '}
              {formatCurrency((selectedRequest?.data.amount as number) || 0)}
            </p>
          </div>

          <CurrencyInput
            label="Onaylanan Tutar"
            value={receiptData.amount}
            onChange={(value) => setReceiptData({ ...receiptData, amount: value })}
          />

          <Input
            label="Odeme Tarihi"
            type="date"
            value={receiptData.paymentDate}
            onChange={(e) => setReceiptData({ ...receiptData, paymentDate: e.target.value })}
          />

          <Select
            label="Odeme Yontemi"
            value={receiptData.paymentMethod}
            onChange={(e) => setReceiptData({ ...receiptData, paymentMethod: e.target.value })}
            options={[
              { value: 'bank_transfer', label: 'Banka Havale/EFT' },
              { value: 'credit_card', label: 'Kredi Karti' },
              { value: 'cash', label: 'Nakit' },
            ]}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Notu (Opsiyonel)</label>
            <textarea
              value={receiptData.adminNote}
              onChange={(e) => setReceiptData({ ...receiptData, adminNote: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Dahili not..."
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800">
              Bu islem otomatik olarak Finans sayfasina bir gelir kaydi olusturacaktir.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowReceiptModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleApproveReceipt} loading={processing} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Odemeyi Onayla
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showMaintenanceModal}
        onClose={() => setShowMaintenanceModal(false)}
        title="Bakim Talebi"
      >
        <div className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Wrench className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-900">Bakim/Servis Talebi</span>
            </div>
            <p className="text-sm text-amber-700">
              Musteri: {selectedRequest?.user?.full_name}
            </p>
            {selectedRequest?.vehicle && (
              <p className="text-sm text-amber-700">
                Arac: {selectedRequest.vehicle.plate} - {selectedRequest.vehicle.brand} {selectedRequest.vehicle.model}
              </p>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500 mb-1">Musteri Aciklamasi</p>
            <p className="text-sm text-slate-700">{selectedRequest?.data.description as string}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bakim Aciklamasi</label>
            <textarea
              value={maintenanceData.description}
              onChange={(e) => setMaintenanceData({ ...maintenanceData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Bakim detaylari..."
            />
          </div>

          <CurrencyInput
            label="Tahmini Maliyet"
            value={maintenanceData.estimatedCost}
            onChange={(value) => setMaintenanceData({ ...maintenanceData, estimatedCost: value })}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Notu (Opsiyonel)</label>
            <textarea
              value={maintenanceData.adminNote}
              onChange={(e) => setMaintenanceData({ ...maintenanceData, adminNote: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Dahili not..."
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Bu islem Bakim sayfasinda yeni bir kayit olusturacaktir.
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowMaintenanceModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleApproveMaintenance} loading={processing} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Bakim Kaydi Olustur
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDamageModal}
        onClose={() => setShowDamageModal(false)}
        title="Hasar Bildirimi Cozumle"
      >
        <div className="space-y-4">
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="font-semibold text-red-900">
                {selectedDamage?.incident_type === 'accident' ? 'Kaza' : selectedDamage?.incident_type === 'breakdown' ? 'Ariza' : 'Hasar'}
              </span>
              {selectedDamage && getUrgencyBadge(selectedDamage.urgency)}
            </div>
            <p className="text-sm text-red-700">
              {selectedDamage?.vehicle?.plate} - {selectedDamage?.customer?.full_name}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-700">{selectedDamage?.description}</p>
          </div>

          {selectedDamage?.photo_urls && selectedDamage.photo_urls.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {selectedDamage.photo_urls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => openLightbox(url)}
                  className="relative group aspect-square"
                >
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                    <ZoomIn className="h-5 w-5 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}

          <CurrencyInput
            label="Onarim Maliyeti"
            value={damageData.repairCost}
            onChange={(value) => setDamageData({ ...damageData, repairCost: value })}
          />

          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <input
              type="checkbox"
              id="billableToCustomer"
              checked={damageData.billableToCustomer}
              onChange={(e) => setDamageData({ ...damageData, billableToCustomer: e.target.checked })}
              className="h-4 w-4 text-teal-600 rounded"
            />
            <label htmlFor="billableToCustomer" className="text-sm text-amber-800">
              <span className="font-medium">Bu maliyeti musteriye fatura et</span>
              <span className="block text-xs text-amber-600">Musteri borcuna eklenir</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bakim Notu</label>
            <textarea
              value={damageData.maintenanceNote}
              onChange={(e) => setDamageData({ ...damageData, maintenanceNote: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Bakim kaydina eklenecek not..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admin Notu (Opsiyonel)</label>
            <textarea
              value={damageData.adminNote}
              onChange={(e) => setDamageData({ ...damageData, adminNote: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Dahili not..."
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-800">
                Bu islem otomatik olarak bir bakim kaydi olusturacaktir.
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowDamageModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleResolveDamage} loading={processing} className="flex-1">
              <Check className="h-4 w-4 mr-2" />
              Cozumle
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Transfer Talebi Teklifi"
      >
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-900">Transfer Talebi</span>
              {selectedTransfer && (
                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                  {getVehicleTypeLabel(selectedTransfer.vehicle_type)}
                </span>
              )}
            </div>
            <p className="text-sm text-blue-700">
              Musteri: {selectedTransfer?.customer?.full_name}
            </p>
            <p className="text-sm text-blue-700">
              Yolcu Sayisi: {selectedTransfer?.passenger_count}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-slate-500">Alis Noktasi</span>
                  <p className="font-medium text-slate-800">{selectedTransfer?.pickup_location}</p>
                  <p className="text-sm text-slate-600">
                    {selectedTransfer && new Date(selectedTransfer.pickup_datetime).toLocaleString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs text-slate-500">Bırakış Noktasi</span>
                  <p className="font-medium text-slate-800">{selectedTransfer?.dropoff_location}</p>
                </div>
              </div>
            </div>
          </div>

          {selectedTransfer?.notes && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs font-medium text-amber-800 mb-1">Musteri Notu</p>
              <p className="text-sm text-amber-700">{selectedTransfer.notes}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Arac Fotograflari</label>
            <p className="text-xs text-slate-500 mb-2">Musteriye gosterilecek arac fotograflari ekleyin (max 6)</p>

            {transferPhotoPreview.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {transferPhotoPreview.map((preview, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={preview}
                      alt={`Fotograf ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removeTransferPhoto(index)}
                      className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {transferPhotos.length < 6 && (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-teal-500 hover:bg-teal-50/30 transition-colors">
                <Upload className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-sm text-slate-600 font-medium">Fotograf Sec</span>
                <span className="text-xs text-slate-400 mt-1">Ic mekan, dis mekan, detay</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleTransferPhotoSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <CurrencyInput
            label="Teklif Fiyati"
            value={transferOfferPrice}
            onChange={setTransferOfferPrice}
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Musteri Notu (Opsiyonel)</label>
            <textarea
              value={transferAdminNote}
              onChange={(e) => setTransferAdminNote(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Ornegin: KDV dahil, soforu ile birlikte..."
            />
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-sm text-blue-800">
              Teklif verildiginde musteri panelinde goruntulenecek ve musteri onaylayabilecektir.
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowTransferModal(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleOfferTransfer} loading={processing || uploadingPhotos} className="flex-1">
              {uploadingPhotos ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Yukluyor...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Teklifi Gonder
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAssignmentModal}
        onClose={() => {
          setShowAssignmentModal(false);
          setAssignmentTransfer(null);
          setAssignmentPassengers([]);
        }}
        title="Operasyon Atamasi"
      >
        <div className="space-y-4">
          <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Truck className="h-5 w-5 text-teal-600" />
              <span className="font-semibold text-teal-900">{getVehicleTypeLabel(assignmentTransfer?.vehicle_type || '')}</span>
            </div>
            <p className="text-sm text-teal-700">
              {assignmentTransfer?.customer?.full_name}
            </p>
            <p className="text-xs text-teal-600 mt-1">
              {assignmentTransfer?.pickup_location} → {assignmentTransfer?.dropoff_location}
            </p>
            <p className="text-xs text-teal-600">
              {assignmentTransfer?.pickup_datetime && new Date(assignmentTransfer.pickup_datetime).toLocaleString('tr-TR')}
            </p>
          </div>

          {assignmentPassengers.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">Yolcu Listesi ({assignmentPassengers.length})</span>
              </div>
              <div className="space-y-1">
                {assignmentPassengers.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 bg-teal-100 rounded-full flex items-center justify-center text-xs font-medium text-teal-700">
                      {i + 1}
                    </span>
                    <span className="text-slate-800">{p.full_name}</span>
                    <span className="text-slate-400 text-xs">TC: {p.tc_identity_number}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800 font-medium mb-1">Sofor & Arac Atamasi</p>
            <p className="text-xs text-amber-600">Bu bilgiler musteri panelinde goruntulenecektir.</p>
          </div>

          <Input
            label="Arac Plakasi *"
            value={assignmentData.plate}
            onChange={(e) => setAssignmentData({ ...assignmentData, plate: e.target.value.toUpperCase() })}
            placeholder="34 ABC 123"
          />

          <Input
            label="Sofor Adi *"
            value={assignmentData.driverName}
            onChange={(e) => setAssignmentData({ ...assignmentData, driverName: e.target.value })}
            placeholder="Ahmet Yilmaz"
          />

          <Input
            label="Sofor Telefonu *"
            value={assignmentData.driverPhone}
            onChange={(e) => setAssignmentData({ ...assignmentData, driverPhone: e.target.value })}
            placeholder="0532 123 45 67"
          />

          <Input
            label="Arac Rengi (Opsiyonel)"
            value={assignmentData.vehicleColor}
            onChange={(e) => setAssignmentData({ ...assignmentData, vehicleColor: e.target.value })}
            placeholder="Siyah"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Bulusma Noktasi Notu (Opsiyonel)</label>
            <textarea
              value={assignmentData.meetingNote}
              onChange={(e) => setAssignmentData({ ...assignmentData, meetingNote: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Ornek: Havalimani Dis Hatlar Cikisi, Kapi 9"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => {
                setShowAssignmentModal(false);
                setAssignmentTransfer(null);
                setAssignmentPassengers([]);
              }}
              className="flex-1"
            >
              Iptal
            </Button>
            <Button onClick={handleSaveAssignment} loading={savingAssignment} className="flex-1">
              <Send className="h-4 w-4 mr-2" />
              Kaydet & Bildir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
