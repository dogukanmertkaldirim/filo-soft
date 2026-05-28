import { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, ChevronRight, Upload, Download, FileText, X, Image as ImageIcon, File } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Partner, PartnerTransaction, Vehicle, PartnerDocument } from '../types/database';
import { formatCurrency, formatDate } from '../utils/format';
import { logActivity } from '../utils/auditLog';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import CurrencyInput from '../components/ui/CurrencyInput';
import Select from '../components/ui/Select';

interface PartnerFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
}

const emptyForm: PartnerFormData = {
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
};

function downloadBase64File(base64Data: string, fileName: string) {
  try {
    const [header, data] = base64Data.split(',');
    const mimeMatch = header.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';

    const byteCharacters = atob(data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download error:', error);
    alert('Dosya indirilirken bir hata olustu');
  }
}

function getFileExtension(base64: string): string {
  if (base64.startsWith('data:image/png')) return '.png';
  if (base64.startsWith('data:image/jpeg') || base64.startsWith('data:image/jpg')) return '.jpg';
  if (base64.startsWith('data:image/gif')) return '.gif';
  if (base64.startsWith('data:image/webp')) return '.webp';
  if (base64.startsWith('data:application/pdf')) return '.pdf';
  return '';
}

export default function Partners() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [partnerTransactions, setPartnerTransactions] = useState<PartnerTransaction[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [partnerDocuments, setPartnerDocuments] = useState<PartnerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState<PartnerFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [transactionForm, setTransactionForm] = useState({
    transaction_type: 'capital_injection',
    description: '',
    amount: 0,
    vehicle_id: '',
  });

  const [uploadingFiles, setUploadingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  async function loadData() {
    if (!companyId) return;

    setLoading(true);
    const [partnersRes, transactionsRes, vehiclesRes, documentsRes] = await Promise.all([
      supabase.from('partners').select('*').eq('company_id', companyId).order('name'),
      supabase.from('partner_transactions').select('*').eq('company_id', companyId).order('transaction_date', { ascending: false }),
      supabase.from('vehicles').select('*').eq('company_id', companyId).neq('status', 'sold'),
      supabase.from('partner_documents').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
    ]);
    setPartners(partnersRes.data || []);
    setPartnerTransactions(transactionsRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setPartnerDocuments(documentsRes.data || []);
    setLoading(false);
  }

  function getPartnerBalance(partnerId: string): number {
    return partnerTransactions
      .filter(t => t.partner_id === partnerId)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  function openAddForm() {
    setEditingPartner(null);
    setFormData(emptyForm);
    setShowForm(true);
  }

  function openEditForm(partner: Partner) {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      email: partner.email || '',
      phone: partner.phone || '',
      address: partner.address || '',
      notes: partner.notes || '',
    });
    setShowForm(true);
  }

  function openDetail(partner: Partner) {
    setSelectedPartner(partner);
    setShowDetail(true);
  }

  async function handleSave() {
    if (!formData.name.trim() || !companyId) return;

    setSaving(true);
    const partnerData = {
      name: formData.name.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null,
      address: formData.address.trim() || null,
      notes: formData.notes.trim() || null,
      company_id: companyId,
    };

    if (editingPartner) {
      await supabase.from('partners').update(partnerData).eq('id', editingPartner.id).eq('company_id', companyId);
      await logActivity({
        action: 'UPDATE',
        entity: 'Partner',
        entityId: editingPartner.id,
        details: `Ortak guncellendi: ${formData.name}`,
        userEmail: user?.email,
        companyId: companyId,
      });
    } else {
      const { data } = await supabase.from('partners').insert(partnerData).select().single();
      await logActivity({
        action: 'CREATE',
        entity: 'Partner',
        entityId: data?.id,
        details: `Yeni ortak eklendi: ${formData.name}`,
        userEmail: user?.email,
        companyId: companyId,
      });
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(partner: Partner) {
    if (!confirm(`${partner.name} ortakligini silmek istediginize emin misiniz?`) || !companyId) return;
    await logActivity({
      action: 'DELETE',
      entity: 'Partner',
      entityId: partner.id,
      details: `Ortak silindi: ${partner.name}`,
      userEmail: user?.email,
      companyId: companyId,
    });
    await supabase.from('partners').delete().eq('id', partner.id).eq('company_id', companyId);
    loadData();
  }

  async function handleAddTransaction() {
    if (!selectedPartner || !transactionForm.description.trim() || !companyId) return;

    setSaving(true);
    await supabase.from('partner_transactions').insert({
      partner_id: selectedPartner.id,
      transaction_type: transactionForm.transaction_type,
      description: transactionForm.description.trim(),
      amount: transactionForm.amount,
      vehicle_id: transactionForm.vehicle_id || null,
      transaction_date: new Date().toISOString().split('T')[0],
      company_id: companyId,
    });

    const newBalance = getPartnerBalance(selectedPartner.id) + transactionForm.amount;
    await supabase.from('partners').update({ total_balance: newBalance }).eq('id', selectedPartner.id).eq('company_id', companyId);

    if (transactionForm.transaction_type === 'capital_injection' && transactionForm.amount > 0) {
      await supabase.from('transactions').insert({
        type: 'income',
        category: 'Capital Injection',
        description: `${selectedPartner.name} sermaye giris: ${transactionForm.description}`,
        amount: transactionForm.amount,
        transaction_date: new Date().toISOString().split('T')[0],
        partner_id: selectedPartner.id,
        company_id: companyId,
      });
    }

    setSaving(false);
    setShowAddTransaction(false);
    setTransactionForm({ transaction_type: 'capital_injection', description: '', amount: 0, vehicle_id: '' });
    loadData();
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedPartner || !companyId || !e.target.files?.length) return;

    setUploadingFiles(true);
    const files = Array.from(e.target.files);

    for (const file of files) {
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const fileType = file.type.startsWith('image/') ? 'image' :
                        file.type === 'application/pdf' ? 'pdf' : 'other';

        await supabase.from('partner_documents').insert({
          partner_id: selectedPartner.id,
          file_name: file.name,
          file_url: base64,
          file_type: fileType,
          company_id: companyId,
        });

        await logActivity({
          action: 'CREATE',
          entity: 'PartnerDocument',
          entityId: selectedPartner.id,
          details: `Ortak belgesi yuklendi: ${file.name}`,
          userEmail: user?.email,
          companyId: companyId,
        });
      } catch (error) {
        console.error('Error uploading file:', error);
      }
    }

    setUploadingFiles(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    loadData();
  }

  async function handleDeleteDocument(doc: PartnerDocument) {
    if (!confirm(`${doc.file_name} belgesini silmek istediginize emin misiniz?`) || !companyId) return;

    await supabase.from('partner_documents').delete().eq('id', doc.id).eq('company_id', companyId);
    await logActivity({
      action: 'DELETE',
      entity: 'PartnerDocument',
      entityId: doc.id,
      details: `Ortak belgesi silindi: ${doc.file_name}`,
      userEmail: user?.email,
      companyId: companyId,
    });
    loadData();
  }

  function handleDownloadDocument(doc: PartnerDocument) {
    const fileName = doc.file_name.includes('.')
      ? doc.file_name
      : doc.file_name + getFileExtension(doc.file_url);
    downloadBase64File(doc.file_url, fileName);
  }

  const filteredPartners = partners.filter(
    p => p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPartnerTransactions = selectedPartner
    ? partnerTransactions.filter(t => t.partner_id === selectedPartner.id)
    : [];

  const selectedPartnerDocuments = selectedPartner
    ? partnerDocuments.filter(d => d.partner_id === selectedPartner.id)
    : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Ortaklar</h1>
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Ortak Ekle
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Ortak ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
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
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Ad Soyad</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">E-posta</th>
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Telefon</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Bakiye</th>
                  <th className="text-center py-3 px-4 font-medium text-slate-600">Islemler</th>
                </tr>
              </thead>
              <tbody>
                {filteredPartners.map((p) => {
                  const balance = getPartnerBalance(p.id);
                  return (
                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium">{p.name}</td>
                      <td className="py-3 px-4">{p.email || '-'}</td>
                      <td className="py-3 px-4">{p.phone || '-'}</td>
                      <td className={`py-3 px-4 text-right font-medium ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {balance >= 0 ? '+' : ''}{formatCurrency(balance)} TL
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openDetail(p)}
                            className="p-1.5 hover:bg-slate-100 rounded text-teal-600"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditForm(p)}
                            className="p-1.5 hover:bg-slate-100 rounded"
                          >
                            <Edit2 className="h-4 w-4 text-slate-500" />
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            className="p-1.5 hover:bg-red-50 rounded"
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
            {filteredPartners.length === 0 && (
              <p className="text-center py-8 text-slate-500">Ortak bulunamadi</p>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingPartner ? 'Ortak Duzenle' : 'Ortak Ekle'}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Ad Soyad *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="E-posta"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="Telefon"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>
          <Input
            label="Adres"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
          <Input
            label="Notlar"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingPartner ? 'Guncelle' : 'Olustur'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showDetail}
        onClose={() => setShowDetail(false)}
        title={`Ortak: ${selectedPartner?.name}`}
        size="lg"
      >
        {selectedPartner && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Mevcut Bakiye</p>
                <p className={`text-2xl font-bold ${getPartnerBalance(selectedPartner.id) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(getPartnerBalance(selectedPartner.id))} TL
                </p>
              </div>
              <Button onClick={() => setShowAddTransaction(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Islem Ekle
              </Button>
            </div>

            <div>
              <h3 className="font-medium text-slate-900 mb-3">Islem Gecmisi</h3>
              {selectedPartnerTransactions.length > 0 ? (
                <div className="space-y-2">
                  {selectedPartnerTransactions.map(t => {
                    const vehicle = vehicles.find(v => v.id === t.vehicle_id);
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-900">{t.description}</p>
                          <p className="text-xs text-slate-500">
                            {t.transaction_type.replace('_', ' ')}
                            {vehicle ? ` - ${vehicle.plate}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${t.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {t.amount >= 0 ? '+' : ''}{formatCurrency(t.amount)} TL
                          </p>
                          <p className="text-xs text-slate-500">{formatDate(t.transaction_date)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center py-8 text-slate-500">Henuz islem yok</p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-slate-900">Anlasmalar ve Protokoller</h3>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className={`
                      inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm cursor-pointer
                      ${uploadingFiles
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-teal-600 text-white hover:bg-teal-700'}
                      transition-colors
                    `}
                  >
                    {uploadingFiles ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Yukleniyor...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Belge Yukle
                      </>
                    )}
                  </label>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-4">
                PDF ve resim dosyalarini yukleyebilirsiniz. Birden fazla dosya secebilirsiniz.
              </p>

              {selectedPartnerDocuments.length > 0 ? (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left py-2 px-3 font-medium text-slate-600">Belge</th>
                        <th className="text-left py-2 px-3 font-medium text-slate-600">Tarih</th>
                        <th className="text-center py-2 px-3 font-medium text-slate-600">Islem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPartnerDocuments.map(doc => (
                        <tr key={doc.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-3">
                              <div className={`
                                w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                                ${doc.file_type === 'pdf' ? 'bg-red-50' : doc.file_type === 'image' ? 'bg-blue-50' : 'bg-slate-50'}
                              `}>
                                {doc.file_type === 'pdf' ? (
                                  <FileText className="h-5 w-5 text-red-500" />
                                ) : doc.file_type === 'image' ? (
                                  <ImageIcon className="h-5 w-5 text-blue-500" />
                                ) : (
                                  <File className="h-5 w-5 text-slate-400" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-slate-900 truncate">{doc.file_name}</p>
                                <p className="text-xs text-slate-500 uppercase">{doc.file_type}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {formatDate(doc.created_at)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDownloadDocument(doc)}
                                className="p-2 hover:bg-teal-50 rounded-lg text-teal-600 transition-colors"
                                title="Indir"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteDocument(doc)}
                                className="p-2 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                                title="Sil"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500">Henuz belge yuklenmedi</p>
                  <p className="text-xs text-slate-400 mt-1">Yuklemek icin yukardaki butonu kullanin</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        title="Ortak Islemi Ekle"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Islem Tipi"
            value={transactionForm.transaction_type}
            onChange={(e) => setTransactionForm({ ...transactionForm, transaction_type: e.target.value })}
            options={[
              { value: 'capital_injection', label: 'Sermaye Girisi' },
              { value: 'vehicle_share', label: 'Arac Payi' },
              { value: 'expense_share', label: 'Gider Payi' },
              { value: 'loan_payment', label: 'Kredi Odemesi' },
              { value: 'withdrawal', label: 'Para Cekme' },
              { value: 'other', label: 'Diger' },
            ]}
          />
          <Input
            label="Aciklama *"
            value={transactionForm.description}
            onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
          />
          <CurrencyInput
            label="Tutar (pozitif = alacak, negatif = borc)"
            value={transactionForm.amount}
            onChange={(v) => setTransactionForm({ ...transactionForm, amount: v })}
          />
          {(transactionForm.transaction_type === 'vehicle_share' || transactionForm.transaction_type === 'loan_payment') && (
            <Select
              label="Ilgili Arac"
              value={transactionForm.vehicle_id}
              onChange={(e) => setTransactionForm({ ...transactionForm, vehicle_id: e.target.value })}
              options={[
                { value: '', label: 'Arac secin...' },
                ...vehicles.map(v => ({ value: v.id, label: `${v.plate} - ${v.brand} ${v.model}` })),
              ]}
            />
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowAddTransaction(false)}>
              Iptal
            </Button>
            <Button onClick={handleAddTransaction} loading={saving}>
              Islem Ekle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
