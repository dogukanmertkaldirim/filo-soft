import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Campaign {
  id: string;
  title: string;
  sponsor_name: string;
  discount_rate: string | null;
  image_url: string | null;
  promo_code: string | null;
  external_link: string | null;
}

interface SponsorCarouselProps {
  variant?: 'login' | 'dashboard';
}

export default function SponsorCarousel({ variant = 'dashboard' }: SponsorCarouselProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [current, setCurrent] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (campaigns.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setCurrent(prev => (prev + 1) % campaigns.length);
    }, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [campaigns.length]);

  async function loadCampaigns() {
    const { data } = await supabase
      .from('campaigns')
      .select('id, title, sponsor_name, discount_rate, image_url, promo_code, external_link')
      .eq('status', true)
      .order('created_at', { ascending: false });
    setCampaigns(data || []);
  }

  if (campaigns.length === 0) return null;

  if (variant === 'login') {
    return (
      <div className="w-full overflow-hidden bg-slate-900/80 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Tag className="h-4 w-4 text-teal-400 flex-shrink-0" />
          <div className="flex-1 overflow-hidden relative h-5">
            {campaigns.map((c, i) => (
              <div
                key={c.id}
                className={`absolute inset-0 flex items-center transition-all duration-500 ${
                  i === current ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                }`}
              >
                <p className="text-sm text-white/90 truncate">
                  <span className="text-teal-300 font-medium">Filosoft Kullaniclarina Ozel:</span>{' '}
                  {c.sponsor_name} - {c.discount_rate || c.title}
                  {c.promo_code && <span className="ml-2 text-xs bg-white/10 px-1.5 py-0.5 rounded font-mono">{c.promo_code}</span>}
                </p>
              </div>
            ))}
          </div>
          {campaigns[current]?.external_link && (
            <a
              href={campaigns[current].external_link!}
              target="_blank"
              rel="noreferrer"
              className="p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5 text-white/60" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // Dashboard variant
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Tag className="h-4 w-4 text-teal-600" />
          Size Ozel Ayricaliklar
        </h3>
        {campaigns.length > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrent(prev => (prev - 1 + campaigns.length) % campaigns.length)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <span className="text-xs text-slate-400">{current + 1}/{campaigns.length}</span>
            <button
              onClick={() => setCurrent(prev => (prev + 1) % campaigns.length)}
              className="p-1 hover:bg-slate-100 rounded transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-lg">
        {campaigns.map((c, i) => (
          <div
            key={c.id}
            className={`transition-all duration-500 ${
              i === current ? 'opacity-100 relative' : 'opacity-0 absolute inset-0'
            }`}
          >
            <div className="flex items-center gap-4 p-3 bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-100 rounded-lg">
              {c.image_url && (
                <img
                  src={c.image_url}
                  alt={c.sponsor_name}
                  className="h-10 w-10 rounded-lg object-cover border border-teal-200 flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{c.title}</p>
                <p className="text-xs text-slate-500">{c.sponsor_name}</p>
                {c.discount_rate && (
                  <span className="inline-block mt-1 text-xs font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                    {c.discount_rate}
                  </span>
                )}
              </div>
              {c.external_link && (
                <a
                  href={c.external_link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors flex-shrink-0"
                >
                  Incele
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dots indicator */}
      {campaigns.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {campaigns.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === current ? 'w-4 bg-teal-600' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
