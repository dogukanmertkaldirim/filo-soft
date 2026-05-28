import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
  StickyNote,
  Plus,
  Edit2,
  Trash2,
  Globe,
  Lock,
  X,
  Search,
  GripVertical,
  Filter
} from 'lucide-react';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Note {
  id: string;
  content: string;
  color: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  position: number;
}

const COLOR_OPTIONS = [
  { value: 'yellow', label: 'Sari', bgClass: 'bg-yellow-200', borderClass: 'border-yellow-300' },
  { value: 'blue', label: 'Mavi', bgClass: 'bg-blue-200', borderClass: 'border-blue-300' },
  { value: 'pink', label: 'Pembe', bgClass: 'bg-pink-200', borderClass: 'border-pink-300' },
  { value: 'green', label: 'Yesil', bgClass: 'bg-green-200', borderClass: 'border-green-300' },
  { value: 'purple', label: 'Mor', bgClass: 'bg-purple-200', borderClass: 'border-purple-300' },
  { value: 'orange', label: 'Turuncu', bgClass: 'bg-orange-200', borderClass: 'border-orange-300' }
];

type VisibilityFilter = 'all' | 'private' | 'public';

function getColorClasses(color: string) {
  const colorOption = COLOR_OPTIONS.find(c => c.value === color);
  return colorOption || COLOR_OPTIONS[0];
}

interface SortableNoteCardProps {
  note: Note;
  isOwn: boolean;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}

function SortableNoteCard({ note, isOwn, onEdit, onDelete }: SortableNoteCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1
  };

  const colorClasses = getColorClasses(note.color);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative ${colorClasses.bgClass} ${colorClasses.borderClass}
        border-2 rounded-lg p-5 shadow-lg
        transition-all duration-200
        group min-h-[200px] flex flex-col
        ${isDragging ? 'shadow-2xl scale-105 rotate-3' : 'hover:shadow-xl'}
      `}
    >
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-12 h-3 bg-gray-400 opacity-50 rounded-sm shadow-sm"></div>
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isOwn && (
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-black/10 rounded transition-colors"
              title="Tasimak icin surukle"
            >
              <GripVertical className="w-4 h-4 text-gray-600" />
            </div>
          )}
          {note.is_public ? (
            <Globe className="w-4 h-4 text-gray-600" title="Herkese Acik" />
          ) : (
            <Lock className="w-4 h-4 text-gray-600" title="Ozel" />
          )}
        </div>

        {isOwn && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(note)}
              className="p-1.5 bg-white rounded-md hover:bg-gray-100 transition-colors shadow-sm"
              title="Duzenle"
            >
              <Edit2 className="w-4 h-4 text-blue-600" />
            </button>
            <button
              onClick={() => onDelete(note.id)}
              className="p-1.5 bg-white rounded-md hover:bg-gray-100 transition-colors shadow-sm"
              title="Sil"
            >
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <p className="text-gray-800 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {note.content}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-400/30">
        <p className="text-xs text-gray-600 italic">
          {isOwn ? 'Siz' : note.created_by}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(note.created_at).toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })}
        </p>
      </div>
    </div>
  );
}

function NoteCardOverlay({ note }: { note: Note }) {
  const colorClasses = getColorClasses(note.color);

  return (
    <div
      className={`
        relative ${colorClasses.bgClass} ${colorClasses.borderClass}
        border-2 rounded-lg p-5 shadow-2xl
        min-h-[200px] flex flex-col
        rotate-6 scale-105
        w-[280px]
      `}
    >
      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="w-12 h-3 bg-gray-400 opacity-50 rounded-sm shadow-sm"></div>
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-600" />
          {note.is_public ? (
            <Globe className="w-4 h-4 text-gray-600" />
          ) : (
            <Lock className="w-4 h-4 text-gray-600" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <p className="text-gray-800 whitespace-pre-wrap break-words text-sm leading-relaxed line-clamp-6">
          {note.content}
        </p>
      </div>
    </div>
  );
}

export default function Notes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    content: '',
    color: 'yellow',
    is_public: false
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('all');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  useEffect(() => {
    loadNotes();
  }, [user]);

  async function loadNotes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .order('position', { ascending: true });

      if (error) throw error;

      const filteredNotes = data?.filter(note =>
        note.is_public || note.created_by === user?.username
      ) || [];

      setNotes(filteredNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredNotes = useMemo(() => {
    let result = notes;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(note =>
        note.content.toLowerCase().includes(query)
      );
    }

    if (colorFilter) {
      result = result.filter(note => note.color === colorFilter);
    }

    if (visibilityFilter === 'private') {
      result = result.filter(note => !note.is_public && note.created_by === user?.username);
    } else if (visibilityFilter === 'public') {
      result = result.filter(note => note.is_public);
    }

    return result;
  }, [notes, searchQuery, colorFilter, visibilityFilter, user]);

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const note = notes.find(n => n.id === active.id);
    if (note) {
      setActiveNote(note);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveNote(null);

    if (!over || active.id === over.id) return;

    const oldIndex = notes.findIndex(n => n.id === active.id);
    const newIndex = notes.findIndex(n => n.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newNotes = arrayMove(notes, oldIndex, newIndex);
    setNotes(newNotes);

    try {
      const updates = newNotes.map((note, index) => ({
        id: note.id,
        position: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('notes')
          .update({ position: update.position })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating positions:', error);
      loadNotes();
    }
  }

  function openAddModal() {
    setEditingNote(null);
    setFormData({
      content: '',
      color: 'yellow',
      is_public: false
    });
    setShowModal(true);
  }

  function openEditModal(note: Note) {
    setEditingNote(note);
    setFormData({
      content: note.content,
      color: note.color,
      is_public: note.is_public
    });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      if (editingNote) {
        const { error } = await supabase
          .from('notes')
          .update({
            ...formData,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingNote.id);

        if (error) throw error;
      } else {
        const maxPosition = notes.length > 0 ? Math.max(...notes.map(n => n.position || 0)) : 0;
        const { error } = await supabase
          .from('notes')
          .insert([{
            ...formData,
            created_by: user?.username || 'anonymous',
            position: maxPosition + 1
          }]);

        if (error) throw error;
      }

      setShowModal(false);
      loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Not kaydedilirken bir hata olustu');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Bu notu silmek istediginizden emin misiniz?')) return;

    try {
      const { error } = await supabase
        .from('notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
      alert('Not silinirken bir hata olustu');
    }
  }

  const isOwnNote = (note: Note) => note.created_by === user?.username;

  const clearFilters = () => {
    setSearchQuery('');
    setColorFilter(null);
    setVisibilityFilter('all');
  };

  const hasActiveFilters = searchQuery || colorFilter || visibilityFilter !== 'all';

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StickyNote className="w-8 h-8 text-amber-600" />
          <h1 className="text-3xl font-bold text-gray-900">Yapiskan Notlar</h1>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" />
          Yeni Not Ekle
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Notlarda ara..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600 mr-1">Renk:</span>
            <div className="flex gap-1.5">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setColorFilter(colorFilter === color.value ? null : color.value)}
                  className={`
                    w-7 h-7 rounded-full ${color.bgClass} ${color.borderClass}
                    border-2 transition-all duration-200
                    ${colorFilter === color.value ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-105'}
                  `}
                  title={color.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Gorunum:</span>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="all">Tum Notlar</option>
              <option value="private">Ozel Notlarim</option>
              <option value="public">Herkese Acik</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Temizle
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
            <span>{filteredNotes.length} not bulundu</span>
            {searchQuery && (
              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                "{searchQuery}"
              </span>
            )}
            {colorFilter && (
              <span className={`px-2 py-0.5 rounded ${getColorClasses(colorFilter).bgClass}`}>
                {COLOR_OPTIONS.find(c => c.value === colorFilter)?.label}
              </span>
            )}
            {visibilityFilter !== 'all' && (
              <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {visibilityFilter === 'private' ? 'Ozel' : 'Herkese Acik'}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <StickyNote className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          {hasActiveFilters ? (
            <>
              <p className="text-gray-500 text-lg">Filtrelere uygun not bulunamadi</p>
              <p className="text-gray-400 text-sm mt-2">Filtreleri degistirmeyi deneyin</p>
              <button
                onClick={clearFilters}
                className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
              >
                Filtreleri Temizle
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-lg">Henuz not yok</p>
              <p className="text-gray-400 text-sm mt-2">Ilk notunuzu eklemek icin yukaridaki butona tiklayin</p>
            </>
          )}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={filteredNotes.map(n => n.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredNotes.map((note) => (
                <SortableNoteCard
                  key={note.id}
                  note={note}
                  isOwn={isOwnNote(note)}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeNote ? <NoteCardOverlay note={activeNote} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            {editingNote ? 'Notu Duzenle' : 'Yeni Not Ekle'}
          </h2>
          <button
            onClick={() => setShowModal(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Not Icerigi
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Notunuzu buraya yazin..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Renk Secin
            </label>
            <div className="grid grid-cols-6 gap-3">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: color.value })}
                  className={`
                    ${color.bgClass} ${color.borderClass}
                    border-2 rounded-lg h-12 relative
                    transition-all duration-200
                    ${formData.color === color.value ? 'ring-4 ring-blue-500 scale-110' : 'hover:scale-105'}
                  `}
                  title={color.label}
                >
                  {formData.color === color.value && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_public}
                onChange={(e) => setFormData({ ...formData, is_public: e.target.checked })}
                className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Bu notu herkese acik yap
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-2 ml-8">
              Herkese acik notlar tum kullanicilar tarafindan gorulebilir
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit" className="flex-1">
              {editingNote ? 'Guncelle' : 'Kaydet'}
            </Button>
            <Button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600"
            >
              Iptal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
