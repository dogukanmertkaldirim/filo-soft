import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  parseISO,
  isWithinInterval,
  addDays,
  addWeeks,
  addYears,
  getDate,
  getMonth,
  getDayOfYear,
  isBefore,
  isAfter
} from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertCircle,
  Plus,
  X,
  Trash2,
  Repeat,
  Edit2
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'inspection' | 'insurance' | 'kasko' | 'payment' | 'custom';
  color: string;
  details?: string;
  isCustom?: boolean;
  customEventId?: string;
  recurrencePattern?: string;
}

interface CustomEvent {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  description: string;
  start_date: string;
  is_all_day: boolean;
  color: string;
  recurrence_pattern: string;
}

const COLOR_OPTIONS = [
  { value: 'blue', label: 'Mavi', bgClass: 'bg-blue-500' },
  { value: 'green', label: 'Yeşil', bgClass: 'bg-emerald-500' },
  { value: 'purple', label: 'Mor', bgClass: 'bg-purple-500' },
  { value: 'pink', label: 'Pembe', bgClass: 'bg-pink-500' },
  { value: 'cyan', label: 'Turkuaz', bgClass: 'bg-cyan-500' },
  { value: 'rose', label: 'Gül', bgClass: 'bg-rose-500' }
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Tek Seferlik' },
  { value: 'daily', label: 'Her Gün' },
  { value: 'weekly', label: 'Her Hafta' },
  { value: 'monthly', label: 'Her Ay' },
  { value: 'yearly', label: 'Her Yıl' }
];

function getColorClass(color: string): string {
  const option = COLOR_OPTIONS.find(c => c.value === color);
  return option?.bgClass || 'bg-blue-500';
}

export default function Calendar() {
  const { user, effectiveCompanyId: companyId } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CustomEvent | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CustomEvent | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    color: 'blue',
    recurrence_pattern: 'none'
  });

  useEffect(() => {
    loadEvents();
  }, [currentMonth]);

  async function loadEvents() {
    setLoading(true);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const allEvents: CalendarEvent[] = [];

      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, plate, brand, model, inspection_expiry, traffic_insurance_expiry, kasko_expiry')
        .or(`inspection_expiry.gte.${format(monthStart, 'yyyy-MM-dd')},traffic_insurance_expiry.gte.${format(monthStart, 'yyyy-MM-dd')},kasko_expiry.gte.${format(monthStart, 'yyyy-MM-dd')}`)
        .or(`inspection_expiry.lte.${format(monthEnd, 'yyyy-MM-dd')},traffic_insurance_expiry.lte.${format(monthEnd, 'yyyy-MM-dd')},kasko_expiry.lte.${format(monthEnd, 'yyyy-MM-dd')}`);

      if (vehicles) {
        vehicles.forEach((vehicle) => {
          if (vehicle.inspection_expiry) {
            const eventDate = parseISO(vehicle.inspection_expiry);
            if (isWithinInterval(eventDate, { start: monthStart, end: monthEnd })) {
              allEvents.push({
                id: `inspection-${vehicle.id}`,
                title: `Muayene - ${vehicle.plate}`,
                date: eventDate,
                type: 'inspection',
                color: 'bg-red-500',
                details: `${vehicle.brand} ${vehicle.model}`
              });
            }
          }

          if (vehicle.traffic_insurance_expiry) {
            const eventDate = parseISO(vehicle.traffic_insurance_expiry);
            if (isWithinInterval(eventDate, { start: monthStart, end: monthEnd })) {
              allEvents.push({
                id: `insurance-${vehicle.id}`,
                title: `Sigorta - ${vehicle.plate}`,
                date: eventDate,
                type: 'insurance',
                color: 'bg-orange-500',
                details: `${vehicle.brand} ${vehicle.model}`
              });
            }
          }

          if (vehicle.kasko_expiry) {
            const eventDate = parseISO(vehicle.kasko_expiry);
            if (isWithinInterval(eventDate, { start: monthStart, end: monthEnd })) {
              allEvents.push({
                id: `kasko-${vehicle.id}`,
                title: `Kasko - ${vehicle.plate}`,
                date: eventDate,
                type: 'kasko',
                color: 'bg-amber-500',
                details: `${vehicle.brand} ${vehicle.model}`
              });
            }
          }
        });
      }

      const { data: loanPayments } = await supabase
        .from('loan_payments')
        .select(`
          id,
          payment_date,
          amount,
          is_paid,
          loans (
            bank,
            loan_type,
            vehicles (plate, brand, model)
          )
        `)
        .gte('payment_date', format(monthStart, 'yyyy-MM-dd'))
        .lte('payment_date', format(monthEnd, 'yyyy-MM-dd'))
        .eq('is_paid', false);

      if (loanPayments) {
        loanPayments.forEach((payment: any) => {
          const eventDate = parseISO(payment.payment_date);
          const loan = payment.loans;
          let title = `Kredi Ödemesi - ${loan?.bank || 'Bilinmeyen'}`;
          let details = `${payment.amount.toLocaleString('tr-TR')} ₺`;

          if (loan?.loan_type === 'vehicle' && loan.vehicles) {
            title += ` (${loan.vehicles.plate})`;
            details = `${loan.vehicles.brand} ${loan.vehicles.model} - ${details}`;
          }

          allEvents.push({
            id: `payment-${payment.id}`,
            title,
            date: eventDate,
            type: 'payment',
            color: 'bg-green-500',
            details
          });
        });
      }

      const { data: customEventsData } = await supabase
        .from('custom_events')
        .select('*')
        .is('deleted_at', null);

      if (customEventsData) {
        setCustomEvents(customEventsData);
        const customCalendarEvents = generateRecurringEvents(customEventsData, monthStart, monthEnd);
        allEvents.push(...customCalendarEvents);
      }

      setEvents(allEvents);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  }

  function generateRecurringEvents(
    customEventsData: CustomEvent[],
    monthStart: Date,
    monthEnd: Date
  ): CalendarEvent[] {
    const result: CalendarEvent[] = [];
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

    customEventsData.forEach((event) => {
      const eventStartDate = parseISO(event.start_date);
      const recurrence = event.recurrence_pattern;

      if (recurrence === 'none') {
        if (isWithinInterval(eventStartDate, { start: calendarStart, end: calendarEnd })) {
          result.push({
            id: `custom-${event.id}-${format(eventStartDate, 'yyyy-MM-dd')}`,
            title: event.title,
            date: eventStartDate,
            type: 'custom',
            color: getColorClass(event.color),
            details: event.description,
            isCustom: true,
            customEventId: event.id,
            recurrencePattern: recurrence
          });
        }
      } else if (recurrence === 'daily') {
        let currentDate = eventStartDate;
        if (isBefore(currentDate, calendarStart)) {
          currentDate = calendarStart;
        }
        while (!isAfter(currentDate, calendarEnd)) {
          if (!isBefore(currentDate, eventStartDate)) {
            result.push({
              id: `custom-${event.id}-${format(currentDate, 'yyyy-MM-dd')}`,
              title: event.title,
              date: new Date(currentDate),
              type: 'custom',
              color: getColorClass(event.color),
              details: event.description,
              isCustom: true,
              customEventId: event.id,
              recurrencePattern: recurrence
            });
          }
          currentDate = addDays(currentDate, 1);
        }
      } else if (recurrence === 'weekly') {
        let currentDate = eventStartDate;
        if (isBefore(currentDate, calendarStart)) {
          const weeksDiff = Math.ceil(
            (calendarStart.getTime() - currentDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
          );
          currentDate = addWeeks(eventStartDate, weeksDiff);
          if (isBefore(currentDate, calendarStart)) {
            currentDate = addWeeks(currentDate, 1);
          }
        }
        while (!isAfter(currentDate, calendarEnd)) {
          if (!isBefore(currentDate, eventStartDate)) {
            result.push({
              id: `custom-${event.id}-${format(currentDate, 'yyyy-MM-dd')}`,
              title: event.title,
              date: new Date(currentDate),
              type: 'custom',
              color: getColorClass(event.color),
              details: event.description,
              isCustom: true,
              customEventId: event.id,
              recurrencePattern: recurrence
            });
          }
          currentDate = addWeeks(currentDate, 1);
        }
      } else if (recurrence === 'monthly') {
        const dayOfMonth = getDate(eventStartDate);
        const eachMonth = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        const processedMonths = new Set<string>();

        eachMonth.forEach((day) => {
          const monthKey = format(day, 'yyyy-MM');
          if (processedMonths.has(monthKey)) return;

          const targetDate = new Date(day.getFullYear(), day.getMonth(), dayOfMonth);
          if (
            isWithinInterval(targetDate, { start: calendarStart, end: calendarEnd }) &&
            !isBefore(targetDate, eventStartDate)
          ) {
            processedMonths.add(monthKey);
            result.push({
              id: `custom-${event.id}-${format(targetDate, 'yyyy-MM-dd')}`,
              title: event.title,
              date: targetDate,
              type: 'custom',
              color: getColorClass(event.color),
              details: event.description,
              isCustom: true,
              customEventId: event.id,
              recurrencePattern: recurrence
            });
          }
        });
      } else if (recurrence === 'yearly') {
        const eventMonth = getMonth(eventStartDate);
        const eventDay = getDate(eventStartDate);
        const currentYear = calendarStart.getFullYear();
        const endYear = calendarEnd.getFullYear();

        for (let year = currentYear; year <= endYear; year++) {
          const targetDate = new Date(year, eventMonth, eventDay);
          if (
            isWithinInterval(targetDate, { start: calendarStart, end: calendarEnd }) &&
            !isBefore(targetDate, eventStartDate)
          ) {
            result.push({
              id: `custom-${event.id}-${format(targetDate, 'yyyy-MM-dd')}`,
              title: event.title,
              date: targetDate,
              type: 'custom',
              color: getColorClass(event.color),
              details: event.description,
              isCustom: true,
              customEventId: event.id,
              recurrencePattern: recurrence
            });
          }
        }
      }
    });

    return result;
  }

  function openAddModal(date?: Date) {
    setEditingEvent(null);
    setFormData({
      title: '',
      description: '',
      start_date: format(date || new Date(), 'yyyy-MM-dd'),
      color: 'blue',
      recurrence_pattern: 'none'
    });
    setShowEventModal(true);
  }

  function openEditModal(event: CustomEvent) {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      start_date: format(parseISO(event.start_date), 'yyyy-MM-dd'),
      color: event.color,
      recurrence_pattern: event.recurrence_pattern
    });
    setShowEventModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      if (editingEvent) {
        const { error } = await supabase
          .from('custom_events')
          .update({
            title: formData.title,
            description: formData.description,
            start_date: new Date(formData.start_date).toISOString(),
            color: formData.color,
            recurrence_pattern: formData.recurrence_pattern
          })
          .eq('id', editingEvent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('custom_events')
          .insert([{
            title: formData.title,
            description: formData.description,
            start_date: new Date(formData.start_date).toISOString(),
            color: formData.color,
            recurrence_pattern: formData.recurrence_pattern,
            user_id: user?.username || 'anonymous',
            company_id: companyId
          }]);

        if (error) throw error;
      }

      setShowEventModal(false);
      loadEvents();
    } catch (error) {
      console.error('Error saving event:', error);
      alert('Etkinlik kaydedilirken bir hata oluştu');
    }
  }

  function confirmDelete(event: CustomEvent) {
    setEventToDelete(event);
    setShowDeleteConfirm(true);
  }

  async function handleDelete() {
    if (!eventToDelete) return;

    try {
      const { error } = await supabase
        .from('custom_events')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', eventToDelete.id);

      if (error) throw error;

      setShowDeleteConfirm(false);
      setEventToDelete(null);
      loadEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Etkinlik silinirken bir hata oluştu');
    }
  }

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) => {
    return events.filter(event => isSameDay(event.date, day));
  };

  const selectedDayEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const getCustomEventById = (id: string) => {
    return customEvents.find(e => e.id === id);
  };

  const getRecurrenceLabel = (pattern: string) => {
    return RECURRENCE_OPTIONS.find(o => o.value === pattern)?.label || 'Tek Seferlik';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Akilli Takvim</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={() => openAddModal()}>
            <Plus className="w-5 h-5 mr-2" />
            Etkinlik Ekle
          </Button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold min-w-[200px] text-center">
              {format(currentMonth, 'MMMM yyyy', { locale: tr })}
            </h2>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {['Pzt', 'Sal', 'Car', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => (
                <div key={day} className="p-3 text-center font-semibold text-gray-700 text-sm">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDate(day)}
                    onDoubleClick={() => openAddModal(day)}
                    className={`
                      min-h-[100px] p-2 border-b border-r border-gray-200 cursor-pointer
                      transition-colors hover:bg-gray-50
                      ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-400' : 'bg-white'}
                      ${isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''}
                    `}
                  >
                    <div className={`
                      text-sm font-medium mb-1 flex items-center justify-center w-7 h-7 rounded-full
                      ${isToday ? 'bg-blue-600 text-white' : ''}
                    `}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`text-xs px-1.5 py-0.5 rounded text-white ${event.color} truncate flex items-center gap-1`}
                          title={event.title}
                        >
                          {event.recurrencePattern && event.recurrencePattern !== 'none' && (
                            <Repeat className="w-3 h-3 flex-shrink-0" />
                          )}
                          <span className="truncate">{event.title}</span>
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500 px-1.5">
                          +{dayEvents.length - 3} daha
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                {selectedDate ? format(selectedDate, 'd MMMM yyyy', { locale: tr }) : 'Etkinlik Detaylari'}
              </h3>
              {selectedDate && (
                <button
                  onClick={() => openAddModal(selectedDate)}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Bu tarihe etkinlik ekle"
                >
                  <Plus className="w-4 h-4 text-blue-600" />
                </button>
              )}
            </div>

            {selectedDate && selectedDayEvents.length === 0 && (
              <p className="text-gray-500 text-sm">Bu tarihte hic etkinlik yok.</p>
            )}

            {selectedDate && selectedDayEvents.length > 0 && (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {selectedDayEvents.map((event) => {
                  const customEvent = event.customEventId ? getCustomEventById(event.customEventId) : null;

                  return (
                    <div
                      key={event.id}
                      className="border-l-4 pl-3 py-2 group relative"
                      style={{ borderColor: event.color.includes('bg-') ? undefined : event.color }}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${event.color} rounded-l`}></div>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 flex items-center gap-1">
                            {event.recurrencePattern && event.recurrencePattern !== 'none' && (
                              <Repeat className="w-3 h-3 text-gray-500 flex-shrink-0" />
                            )}
                            <span className="truncate">{event.title}</span>
                          </div>
                          {event.details && (
                            <div className="text-xs text-gray-600 mt-1">{event.details}</div>
                          )}
                          {event.recurrencePattern && event.recurrencePattern !== 'none' && (
                            <div className="text-xs text-gray-500 mt-1 italic">
                              {getRecurrenceLabel(event.recurrencePattern)}
                            </div>
                          )}
                        </div>
                        {event.isCustom && customEvent && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(customEvent)}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Duzenle"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                            <button
                              onClick={() => confirmDelete(customEvent)}
                              className="p-1 hover:bg-gray-100 rounded"
                              title="Sil"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full text-white ${event.color}`}>
                        {event.type === 'inspection' && 'Muayene'}
                        {event.type === 'insurance' && 'Sigorta'}
                        {event.type === 'kasko' && 'Kasko'}
                        {event.type === 'payment' && 'Odeme'}
                        {event.type === 'custom' && 'Etkinlik'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">Aciklama</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span className="text-gray-600">Muayene Tarihleri</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded"></div>
                  <span className="text-gray-600">Sigorta Tarihleri</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded"></div>
                  <span className="text-gray-600">Kasko Tarihleri</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded"></div>
                  <span className="text-gray-600">Kredi Odemeleri</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span className="text-gray-600">Ozel Etkinlikler</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal isOpen={showEventModal} onClose={() => setShowEventModal(false)}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingEvent ? 'Etkinligi Duzenle' : 'Yeni Etkinlik Ekle'}
          </h2>
          <button
            onClick={() => setShowEventModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Baslik *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Etkinlik basligi"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aciklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Opsiyonel aciklama"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tarih *
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tekrar
            </label>
            <select
              value={formData.recurrence_pattern}
              onChange={(e) => setFormData({ ...formData, recurrence_pattern: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {RECURRENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {formData.recurrence_pattern !== 'none' && (
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <Repeat className="w-3 h-3" />
                Bu etkinlik secilen periyotta tekrar edecek
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Renk
            </label>
            <div className="flex gap-3 flex-wrap">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`
                    w-10 h-10 rounded-full ${color.bgClass}
                    transition-all duration-200 relative
                    ${formData.color === color.value ? 'ring-4 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}
                  `}
                  title={color.label}
                >
                  {formData.color === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {editingEvent ? 'Guncelle' : 'Kaydet'}
            </Button>
            <Button
              type="button"
              onClick={() => setShowEventModal(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600"
            >
              Iptal
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Etkinligi Sil</h3>
          {eventToDelete && (
            <>
              <p className="text-gray-600 mb-2">
                "{eventToDelete.title}" etkinligini silmek istediginizden emin misiniz?
              </p>
              {eventToDelete.recurrence_pattern !== 'none' && (
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg mb-4">
                  <Repeat className="w-4 h-4 inline mr-1" />
                  Bu tekrarlayan bir etkinliktir. Silme islemi tum tekrarlari kaldiracaktir.
                </p>
              )}
            </>
          )}
          <div className="flex gap-3 mt-6">
            <Button
              onClick={handleDelete}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              Evet, Sil
            </Button>
            <Button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600"
            >
              Iptal
            </Button>
          </div>
        </div>
      </Modal>

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Etkinlikler yukleniyor...</p>
          </div>
        </div>
      )}
    </div>
  );
}
