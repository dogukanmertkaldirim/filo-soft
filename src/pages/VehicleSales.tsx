import { useState, useEffect } from 'react';
import { Plus, Car, DollarSign, Pencil, Trash2, FileText, Shield, ShieldOff, Download, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import type { Vehicle, VehicleSale } from '../types/database';
import { formatCurrency, formatDate } from '../utils/format';
import { logActivity } from '../utils/auditLog';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import CurrencyInput from '../components/ui/CurrencyInput';
import FileUpload from '../components/ui/FileUpload';

interface SaleFormData {
  vehicle_id: string;
  sale_date: string;
  sale_amount: number;
  buyer_name: string;
  notes: string;
  notary_document_url: string | null;
  insurance_cancelled: boolean;
  casco_cancelled: boolean;
}

export default function VehicleSales() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [sales, setSales] = useState<VehicleSale[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [allVehicles, setAllVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingSale, setEditingSale] = useState<VehicleSale | null>(null);
  const [formData, setFormData] = useState<SaleFormData>({
    vehicle_id: '',
    sale_date: new Date().toISOString().split('T')[0],
    sale_amount: 0,
    buyer_name: '',
    notes: '',
    notary_document_url: null,
    insurance_cancelled: false,
    casco_cancelled: false,
  });
  const [saving, setSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSale, setDeletingSale] = useState<VehicleSale | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);
    const [salesRes, availableVehiclesRes, allVehiclesRes] = await Promise.all([
      supabase
        .from('vehicle_sales')
        .select('*')
        .eq('company_id', companyId)
        .order('sale_date', { ascending: false }),
      supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'idle'),
      supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId),
    ]);
    setSales(salesRes.data || []);
    setVehicles(availableVehiclesRes.data || []);
    setAllVehicles(allVehiclesRes.data || []);
    setLoading(false);
  }

  function openSaleForm() {
    setEditingSale(null);
    setFormData({
      vehicle_id: '',
      sale_date: new Date().toISOString().split('T')[0],
      sale_amount: 0,
      buyer_name: '',
      notes: '',
      notary_document_url: null,
      insurance_cancelled: false,
      casco_cancelled: false,
    });
    setShowForm(true);
  }

  function openEditForm(sale: VehicleSale) {
    setEditingSale(sale);
    setFormData({
      vehicle_id: sale.vehicle_id,
      sale_date: sale.sale_date,
      sale_amount: sale.sale_amount,
      buyer_name: sale.buyer_name,
      notes: sale.notes || '',
      notary_document_url: sale.notary_document_url || null,
      insurance_cancelled: sale.insurance_cancelled || false,
      casco_cancelled: sale.casco_cancelled || false,
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!companyId) return;
    if (!formData.buyer_name.trim() || formData.sale_amount <= 0) return;

    setSaving(true);

    if (editingSale) {
      await supabase.from('vehicle_sales').update({
        sale_date: formData.sale_date,
        sale_amount: formData.sale_amount,
        buyer_name: formData.buyer_name.trim(),
        notes: formData.notes.trim() || null,
        notary_document_url: formData.notary_document_url,
        insurance_cancelled: formData.insurance_cancelled,
        casco_cancelled: formData.casco_cancelled,
      }).eq('id', editingSale.id).eq('company_id', companyId);

      await supabase.from('transactions').update({
        description: `${allVehicles.find(v => v.id === editingSale.vehicle_id)?.plate || 'Arac'} satisi - ${formData.buyer_name.trim()}`,
        amount: formData.sale_amount,
        transaction_date: formData.sale_date,
      }).eq('vehicle_id', editingSale.vehicle_id).eq('company_id', companyId).eq('category', 'Vehicle Sale');

      const editVehicle = allVehicles.find(v => v.id === editingSale.vehicle_id);
      await logActivity({
        action: 'UPDATE',
        entity: 'VehicleSale',
        entityId: editingSale.id,
        details: `Arac satisi guncellendi: ${editVehicle?.plate || 'Arac'} - ${formData.buyer_name.trim()} - ${formData.sale_amount.toLocaleString('tr-TR')} TL`,
        companyId,
      });
    } else {
      if (!formData.vehicle_id) {
        setSaving(false);
        return;
      }

      await supabase.from('vehicle_sales').insert({
        vehicle_id: formData.vehicle_id,
        sale_date: formData.sale_date,
        sale_amount: formData.sale_amount,
        buyer_name: formData.buyer_name.trim(),
        notes: formData.notes.trim() || null,
        notary_document_url: formData.notary_document_url,
        insurance_cancelled: formData.insurance_cancelled,
        casco_cancelled: formData.casco_cancelled,
        company_id: companyId,
      });

      await supabase.from('vehicles').update({ status: 'sold' }).eq('id', formData.vehicle_id).eq('company_id', companyId);

      const vehicle = vehicles.find(v => v.id === formData.vehicle_id);
      await supabase.from('transactions').insert({
        type: 'income',
        category: 'Vehicle Sale',
        description: `${vehicle?.plate || 'Arac'} satisi - ${formData.buyer_name}`,
        amount: formData.sale_amount,
        transaction_date: formData.sale_date,
        vehicle_id: formData.vehicle_id,
        company_id: companyId,
      });

      await logActivity({
        action: 'CREATE',
        entity: 'VehicleSale',
        details: `Arac satildi: ${vehicle?.plate || 'Arac'} - ${vehicle?.brand} ${vehicle?.model} -> ${formData.buyer_name.trim()} - ${formData.sale_amount.toLocaleString('tr-TR')} TL`,
        companyId,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  function confirmDelete(sale: VehicleSale) {
    setDeletingSale(sale);
    setShowDeleteConfirm(true);
  }

  async function handleDelete() {
    if (!companyId) return;
    if (!deletingSale) return;

    setDeleting(true);

    const vehicle = vehicles.find(v => v.id === deletingSale.vehicle_id);
    const vehicleInfo = vehicle ? `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}` : '';

    await logActivity({
      action: 'DELETE',
      entity: 'VehicleSale',
      entityId: deletingSale.id,
      details: `Arac satisi silindi: ${vehicleInfo} - ${deletingSale.buyer_name} - ${formatCurrency(deletingSale.sale_amount)}`,
      userEmail: user?.email,
      companyId: companyId,
    });

    await supabase.from('transactions')
      .delete()
      .eq('vehicle_id', deletingSale.vehicle_id)
      .eq('company_id', companyId)
      .eq('category', 'Vehicle Sale');

    await supabase.from('vehicles')
      .update({ status: 'idle' })
      .eq('id', deletingSale.vehicle_id)
      .eq('company_id', companyId);

    await supabase.from('vehicle_sales')
      .delete()
      .eq('id', deletingSale.id)
      .eq('company_id', companyId);

    setDeleting(false);
    setShowDeleteConfirm(false);
    setDeletingSale(null);
    loadData();
  }

  const totalSalesAmount = sales.reduce((sum, s) => sum + s.sale_amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Arac Satislari</h1>
        <Button onClick={openSaleForm} disabled={vehicles.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Arac Sat
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <Car className="h-5 w-5 text-teal-600" />
            </div>
            <span className="text-sm text-slate-500">Toplam Satis</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{sales.length} arac</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <span className="text-sm text-slate-500">Toplam Gelir</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalSalesAmount)} TL</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {vehicles.length === 0 && sales.length === 0 && (
          <div className="p-6 text-center text-slate-500">
            Satilabilecek bosta arac yok. Once arac ekleyin veya kirada olan araclari bosta olarak isaretleyin.
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : sales.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Tarih</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Arac</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Alici</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Satis Tutari</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Belgeler & Durum</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const vehicle = allVehicles.find(v => v.id === s.vehicle_id);
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">{formatDate(s.sale_date)}</td>
                      <td className="py-3 px-4 font-medium">
                        {vehicle ? `${vehicle.plate} - ${vehicle.brand} ${vehicle.model}` : 'Bilinmiyor'}
                      </td>
                      <td className="py-3 px-4">{s.buyer_name}</td>
                      <td className="py-3 px-4 text-right font-medium text-green-600">
                        {formatCurrency(s.sale_amount)} TL
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col items-center gap-1.5">
                          {s.notary_document_url ? (
                            <a
                              href={s.notary_document_url}
                              download="noter_satis_belgesi"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <Download className="h-3 w-3" />
                              Noter Belgesi
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400">
                              <FileText className="h-3 w-3" />
                              Belge yok
                            </span>
                          )}
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.insurance_cancelled ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {s.insurance_cancelled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              Trafik
                            </span>
                            <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${s.casco_cancelled ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {s.casco_cancelled ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                              Kasko
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditForm(s)}
                            className="p-2 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                            title="Duzenle"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => confirmDelete(s)}
                            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center py-8 text-slate-500">Henuz satis kaydedilmedi</p>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingSale ? 'Satisi Duzenle' : 'Arac Sat'}
        size="md"
      >
        <div className="space-y-4">
          {!editingSale && (
            <Select
              label="Arac *"
              value={formData.vehicle_id}
              onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
              options={[
                { value: '', label: 'Arac secin...' },
                ...vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })),
              ]}
            />
          )}
          {editingSale && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Arac</label>
              <p className="px-3 py-2 bg-slate-100 rounded-lg text-slate-700">
                {allVehicles.find(v => v.id === editingSale.vehicle_id)?.plate || 'Bilinmiyor'} - {allVehicles.find(v => v.id === editingSale.vehicle_id)?.brand} {allVehicles.find(v => v.id === editingSale.vehicle_id)?.model}
              </p>
            </div>
          )}
          <Input
            label="Alici Adi *"
            value={formData.buyer_name}
            onChange={(e) => setFormData({ ...formData, buyer_name: e.target.value })}
          />
          <Input
            label="Satis Tarihi"
            type="date"
            value={formData.sale_date}
            onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
          />
          <CurrencyInput
            label="Satis Tutari *"
            value={formData.sale_amount}
            onChange={(v) => setFormData({ ...formData, sale_amount: v })}
          />
          <Input
            label="Notlar"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="border-t border-slate-200 pt-4">
            <FileUpload
              label="Noter Satis Belgesi (PDF / Gorsel)"
              accept="image/*,.pdf"
              value={formData.notary_document_url}
              onChange={(v) => setFormData({ ...formData, notary_document_url: v })}
              downloadFilename="noter_satis_belgesi"
            />
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700">Sigorta Iptal Durumlari</h4>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.insurance_cancelled}
                  onChange={(e) => setFormData({ ...formData, insurance_cancelled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-teal-500 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
              </div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900">Trafik Sigortasi Iptal Edildi</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.casco_cancelled}
                  onChange={(e) => setFormData({ ...formData, casco_cancelled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-200 rounded-full peer-checked:bg-teal-500 transition-colors" />
                <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm peer-checked:translate-x-5 transition-transform" />
              </div>
              <span className="text-sm text-slate-700 group-hover:text-slate-900">Kasko Iptal Edildi</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingSale ? 'Kaydet' : 'Satisi Tamamla'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Satisi Sil"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-600">
            Bu satis kaydini silmek istediginizden emin misiniz? Arac tekrar "bosta" durumuna alinacak ve ilgili finansal kayit silinecektir.
          </p>
          {deletingSale && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm font-medium text-slate-900">
                {allVehicles.find(v => v.id === deletingSale.vehicle_id)?.plate} - {deletingSale.buyer_name}
              </p>
              <p className="text-sm text-slate-500">
                {formatDate(deletingSale.sale_date)} - {formatCurrency(deletingSale.sale_amount)} TL
              </p>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
              Iptal
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              Sil
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
