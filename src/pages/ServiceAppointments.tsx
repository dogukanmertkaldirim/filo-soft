import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Calendar, MapPin, Phone, User, Wrench, CircleDot, Clock, CheckCircle, XCircle, Car } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { logActivity } from '../utils/auditLog';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';

interface Appointment {
  id: string;
  company_id: string;
  vehicle_id: string;
  customer_id: string;
  type: 'maintenance' | 'tire_change';
  appointment_date: string;
  location_name: string;
  contact_person: string | null;
  contact_phone: string | null;
  notes: string | null;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
  vehicle?: {
    plate: string;
    brand: string;
    model: string;
  };
  customer?: {
    full_name: string;
    email: string;
  };
}

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
}

interface Customer {
  id: string;
  full_name: string;
  email: string;
}

interface FormData {
  vehicle_id: string;
  customer_id: string;
  type: 'maintenance' | 'tire_change';
  appointment_date: string;
  appointment_time: string;
  location_name: string;
  contact_person: string;
  contact_phone: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
}

const emptyForm: FormData = {
  vehicle_id: '',
  customer_id: '',
  type: 'maintenance',
  appointment_date: '',
  appointment_time: '10:00',
  location_name: '',
  contact_person: '',
  contact_phone: '',
  notes: '',
  status: 'pending',
};

export default function ServiceAppointments() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    if (companyId) {
      loadData();
    }
  }, [companyId]);

  async function loadData() {
    setLoading(true);

    const [appointmentsRes, vehiclesRes, customersRes] = await Promise.all([
      supabase
        .from('service_appointments')
        .select(`
          *,
          vehicle:vehicles(plate, brand, model),
          customer:app_users(full_name, email)
        `)
        .eq('company_id', companyId)
        .order('appointment_date', { ascending: true }),
      supabase
        .from('vehicles')
        .select('id, plate, brand, model')
        .eq('company_id', companyId)
        .is('deleted_at', null),
      supabase
        .from('app_users')
        .select('id, full_name, email')
        .eq('company_id', companyId)
        .eq('role', 'customer'),
    ]);

    setAppointments(appointmentsRes.data || []);
    setVehicles(vehiclesRes.data || []);
    setCustomers(customersRes.data || []);
    setLoading(false);
  }

  function openAddForm() {
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEditForm(apt: Appointment) {
    const date = new Date(apt.appointment_date);
    setFormData({
      vehicle_id: apt.vehicle_id,
      customer_id: apt.customer_id,
      type: apt.type,
      appointment_date: date.toISOString().split('T')[0],
      appointment_time: date.toTimeString().slice(0, 5),
      location_name: apt.location_name,
      contact_person: apt.contact_person || '',
      contact_phone: apt.contact_phone || '',
      notes: apt.notes || '',
      status: apt.status,
    });
    setEditingId(apt.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formData.vehicle_id || !formData.customer_id || !formData.location_name || !formData.appointment_date) {
      alert('Lutfen zorunlu alanlari doldurun');
      return;
    }

    setSaving(true);

    const appointmentDateTime = new Date(`${formData.appointment_date}T${formData.appointment_time}`);

    const data = {
      company_id: companyId,
      vehicle_id: formData.vehicle_id,
      customer_id: formData.customer_id,
      type: formData.type,
      appointment_date: appointmentDateTime.toISOString(),
      location_name: formData.location_name,
      contact_person: formData.contact_person || null,
      contact_phone: formData.contact_phone || null,
      notes: formData.notes || null,
      status: formData.status,
    };

    if (editingId) {
      const { error } = await supabase
        .from('service_appointments')
        .update(data)
        .eq('id', editingId);

      if (!error) {
        await logActivity({
          action: 'UPDATE',
          entity: 'ServiceAppointment',
          entityId: editingId,
          details: `Servis randevusu guncellendi: ${formData.location_name}`,
          userEmail: user?.email,
          companyId,
        });
      }
    } else {
      const { error } = await supabase
        .from('service_appointments')
        .insert(data);

      if (!error) {
        await logActivity({
          action: 'CREATE',
          entity: 'ServiceAppointment',
          entityId: null,
          details: `Yeni servis randevusu olusturuldu: ${formData.location_name}`,
          userEmail: user?.email,
          companyId,
        });
      }
    }

    setSaving(false);
    setShowForm(false);
    loadData();
  }

  async function handleDelete(apt: Appointment) {
    if (!confirm('Bu randevuyu silmek istediginize emin misiniz?')) return;

    await supabase
      .from('service_appointments')
      .delete()
      .eq('id', apt.id);

    await logActivity({
      action: 'DELETE',
      entity: 'ServiceAppointment',
      entityId: apt.id,
      details: `Servis randevusu silindi: ${apt.location_name}`,
      userEmail: user?.email,
      companyId,
    });

    loadData();
  }

  async function handleStatusChange(apt: Appointment, newStatus: string) {
    await supabase
      .from('service_appointments')
      .update({ status: newStatus })
      .eq('id', apt.id);

    loadData();
  }

  function getTypeIcon(type: string) {
    switch (type) {
      case 'maintenance':
        return <Wrench className="h-4 w-4" />;
      case 'tire_change':
        return <CircleDot className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'maintenance':
        return 'Bakim';
      case 'tire_change':
        return 'Lastik Degisimi';
      default:
        return type;
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
            <Clock className="h-3 w-3" /> Bekliyor
          </span>
        );
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
            <CheckCircle className="h-3 w-3" /> Onaylandi
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <CheckCircle className="h-3 w-3" /> Tamamlandi
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <XCircle className="h-3 w-3" /> Iptal
          </span>
        );
      default:
        return null;
    }
  }

  const now = new Date();
  const filteredAppointments = appointments.filter(apt => {
    const aptDate = new Date(apt.appointment_date);
    if (filter === 'upcoming') return aptDate >= now;
    if (filter === 'past') return aptDate < now;
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Servis Randevulari</h1>
          <p className="text-sm text-slate-500 mt-1">Bakim ve lastik degisimi randevularini yonetin</p>
        </div>
        <Button onClick={openAddForm}>
          <Plus className="h-4 w-4 mr-2" />
          Randevu Ekle
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 mb-4">
        <div className="flex border-b border-slate-200">
          {[
            { value: 'upcoming', label: 'Yaklasan' },
            { value: 'past', label: 'Gecmis' },
            { value: 'all', label: 'Tumu' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value as typeof filter)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                filter === f.value
                  ? 'text-teal-600 border-b-2 border-teal-600 bg-teal-50'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Randevu bulunamadi</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredAppointments.map((apt) => (
              <div key={apt.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${
                    apt.type === 'maintenance' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                  }`}>
                    {getTypeIcon(apt.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-900">{getTypeLabel(apt.type)}</span>
                      {getStatusBadge(apt.status)}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                      <Car className="h-4 w-4" />
                      <span>{apt.vehicle?.plate} - {apt.vehicle?.brand} {apt.vehicle?.model}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>
                          {new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{apt.location_name}</span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-600">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="truncate">{apt.customer?.full_name}</span>
                      </div>
                    </div>

                    {apt.notes && (
                      <p className="text-sm text-slate-500 mt-2 p-2 bg-slate-50 rounded-lg">{apt.notes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={apt.status}
                      onChange={(e) => handleStatusChange(apt, e.target.value)}
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="pending">Bekliyor</option>
                      <option value="confirmed">Onaylandi</option>
                      <option value="completed">Tamamlandi</option>
                      <option value="cancelled">Iptal</option>
                    </select>

                    <button
                      onClick={() => openEditForm(apt)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Duzenle"
                    >
                      <Edit2 className="h-4 w-4 text-slate-500" />
                    </button>

                    <button
                      onClick={() => handleDelete(apt)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? 'Randevu Duzenle' : 'Yeni Randevu'}
      >
        <div className="space-y-4">
          <Select
            label="Arac *"
            value={formData.vehicle_id}
            onChange={(e) => setFormData({ ...formData, vehicle_id: e.target.value })}
          >
            <option value="">Arac Secin</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>{v.plate} - {v.brand} {v.model}</option>
            ))}
          </Select>

          <Select
            label="Musteri *"
            value={formData.customer_id}
            onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
          >
            <option value="">Musteri Secin</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </Select>

          <Select
            label="Randevu Tipi *"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as 'maintenance' | 'tire_change' })}
          >
            <option value="maintenance">Bakim</option>
            <option value="tire_change">Lastik Degisimi</option>
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tarih *"
              type="date"
              value={formData.appointment_date}
              onChange={(e) => setFormData({ ...formData, appointment_date: e.target.value })}
            />
            <Input
              label="Saat *"
              type="time"
              value={formData.appointment_time}
              onChange={(e) => setFormData({ ...formData, appointment_time: e.target.value })}
            />
          </div>

          <Input
            label="Servis Lokasyonu *"
            value={formData.location_name}
            onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
            placeholder="Ornek: Borusan Oto Maslak"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Irtibat Kisisi"
              value={formData.contact_person}
              onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              placeholder="Ornek: Ahmet Usta"
            />
            <Input
              label="Irtibat Telefonu"
              value={formData.contact_phone}
              onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
              placeholder="+90 5XX XXX XX XX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="Musteriye gorunecek ek notlar..."
            />
          </div>

          {editingId && (
            <Select
              label="Durum"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as FormData['status'] })}
            >
              <option value="pending">Bekliyor</option>
              <option value="confirmed">Onaylandi</option>
              <option value="completed">Tamamlandi</option>
              <option value="cancelled">Iptal</option>
            </Select>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setShowForm(false)} className="flex-1">
              Iptal
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editingId ? 'Guncelle' : 'Kaydet'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
