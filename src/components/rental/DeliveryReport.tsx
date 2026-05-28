import { useEffect, useState } from 'react';
import { Car, Calendar, User, MapPin, Fuel, Phone, Mail, Printer, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Rental, Vehicle, Customer, CompanySettings } from '../../types/database';
import { formatDate } from '../../utils/format';
import Modal from '../ui/Modal';
import DamageSchemaStatic from './DamageSchemaStatic';

interface DeliveryReportProps {
  isOpen: boolean;
  onClose: () => void;
  rental: Rental | null;
  vehicle: Vehicle | null;
  customer: Customer | null;
  companyId: string;
}

export default function DeliveryReport({
  isOpen,
  onClose,
  rental,
  vehicle,
  customer,
  companyId,
}: DeliveryReportProps) {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);

  useEffect(() => {
    if (isOpen && companyId) {
      loadCompanySettings();
    }
  }, [isOpen, companyId]);

  async function loadCompanySettings() {
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .single();

    if (data) {
      setCompanySettings(data);
    }
  }

  function handlePrint() {
    window.print();
  }

  if (!rental || !vehicle || !customer) return null;

  const getFuelLabel = (status: string | null) => {
    switch (status) {
      case 'full': return 'Dolu';
      case '3/4': return '3/4';
      case '1/2': return '1/2';
      case '1/4': return '1/4';
      case 'empty': return 'Bos';
      default: return '-';
    }
  };

  const getCleanlinessLabel = (status: string | null) => {
    switch (status) {
      case 'clean': return 'Temiz';
      case 'normal': return 'Normal';
      case 'dirty': return 'Kirli';
      default: return '-';
    }
  };

  const getRentalModelLabel = (model: string | null) => {
    switch (model) {
      case 'rent_a_car': return 'Kısa Dönem Kiralama';
      case 'operational_leasing': return 'Operasyonel Leasing';
      case 'financial_leasing': return 'Finansal Leasing';
      default: return 'Kiralama';
    }
  };

  const translateService = (service: string) => {
    const translations: Record<string, string> = {
      'maintenance': 'Periyodik Bakım',
      'tires': 'Lastik Yönetimi',
      'insurance': 'Kasko & Sigorta',
      'replacement_car': 'İkame Araç',
      'roadside_assistance': '7/24 Yol Yardımı',
    };
    return translations[service] || service;
  };

  const translateServices = (services: string[]) => {
    return services.map(translateService).join(', ');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="xl">
      <div className="print-container">
        <div className="no-print flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900">Arac Teslim Tutanagi</h2>
          <div className="flex gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium shadow-sm"
            >
              <Printer className="h-5 w-5" />
              Yazdir
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="h-5 w-5" />
              Kapat
            </button>
          </div>
        </div>

        <div className="print-content" id="delivery-report-print">
          <div className="print-header">
            <div className="header-left">
              {companySettings?.logo_url ? (
                <img
                  src={companySettings.logo_url}
                  alt="Sirket Logo"
                  className="company-logo"
                />
              ) : (
                <div className="logo-placeholder">
                  <Car className="h-8 w-8 text-white" />
                </div>
              )}
              <div className="company-info">
                <h1 className="company-name">
                  {companySettings?.company_name || 'Filo Yonetim Sistemi'}
                </h1>
                {companySettings?.address && (
                  <p className="company-detail">{companySettings.address}</p>
                )}
                {companySettings?.phone && (
                  <p className="company-detail">{companySettings.phone}</p>
                )}
              </div>
            </div>
            <div className="header-right">
              <h2 className="document-title">ARAC TESLIM TUTANAGI</h2>
              <p className="document-info">Belge No: {rental.id.slice(0, 8).toUpperCase()}</p>
              <p className="document-info">Tarih: {formatDate(rental.start_date)}</p>
              <p className="document-info rental-type">{getRentalModelLabel(rental.rental_model)}</p>
            </div>
          </div>

          <div className="info-grid">
            <div className="info-section customer-section">
              <h3 className="section-title">
                <User className="h-4 w-4" />
                MUSTERI BILGILERI
              </h3>
              <div className="info-content">
                <div className="info-row">
                  <span className="info-label">Firma Unvani:</span>
                  <span className="info-value">{customer.company_title}</span>
                </div>
                {customer.authorized_person && (
                  <div className="info-row">
                    <span className="info-label">Yetkili Kisi:</span>
                    <span className="info-value">{customer.authorized_person}</span>
                  </div>
                )}
                {customer.tax_office && customer.tax_number && (
                  <div className="info-row">
                    <span className="info-label">Vergi D./No:</span>
                    <span className="info-value">{customer.tax_office} / {customer.tax_number}</span>
                  </div>
                )}
                {customer.phone && (
                  <div className="info-row">
                    <Phone className="h-3 w-3 inline mr-1" />
                    <span className="info-value">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="info-row">
                    <Mail className="h-3 w-3 inline mr-1" />
                    <span className="info-value">{customer.email}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="info-section vehicle-section">
              <h3 className="section-title">
                <Car className="h-4 w-4" />
                ARAC BILGILERI
              </h3>
              <div className="info-content">
                <div className="info-row plate-row">
                  <span className="info-label">Plaka:</span>
                  <span className="info-value plate-value">{vehicle.plate}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Marka/Model:</span>
                  <span className="info-value">{vehicle.brand} {vehicle.model}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Yil:</span>
                  <span className="info-value">{vehicle.year}</span>
                </div>
                {vehicle.vin && (
                  <div className="info-row">
                    <span className="info-label">Sasi No:</span>
                    <span className="info-value vin-value">{vehicle.vin}</span>
                  </div>
                )}
                {vehicle.color && (
                  <div className="info-row">
                    <span className="info-label">Renk:</span>
                    <span className="info-value">{vehicle.color}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <MapPin className="stat-icon" />
              <p className="stat-label">Teslim KM</p>
              <p className="stat-value">{rental.starting_km?.toLocaleString('tr-TR')} km</p>
            </div>
            <div className="stat-box">
              <Fuel className="stat-icon" />
              <p className="stat-label">Yakit</p>
              <p className="stat-value">{getFuelLabel(rental.fuel_status)}</p>
              {rental.start_fuel_percentage !== null && rental.start_fuel_percentage !== undefined && (
                <p className="stat-sub">%{rental.start_fuel_percentage}</p>
              )}
            </div>
            <div className="stat-box">
              <Calendar className="stat-icon" />
              <p className="stat-label">Teslim Tarihi</p>
              <p className="stat-value">{formatDate(rental.start_date)}</p>
            </div>
            <div className="stat-box">
              <span className="stat-icon-text">
                {rental.start_cleanliness_status === 'clean' ? 'Temiz' : rental.start_cleanliness_status === 'normal' ? 'Orta' : 'Kirli'}
              </span>
              <p className="stat-label">Temizlik</p>
              <p className="stat-value">{getCleanlinessLabel(rental.start_cleanliness_status)}</p>
            </div>
          </div>

          {(rental.rental_model === 'operational_leasing' || rental.rental_model === 'financial_leasing') && (
            <div className="contract-section">
              <h3 className="section-title-inline">
                {rental.rental_model === 'financial_leasing' ? 'FINANSAL LEASING' : 'OPERASYONEL KIRALAMA'} DETAYLARI
              </h3>
              <div className="contract-grid">
                <div className="contract-item">
                  <span className="contract-label">Sozlesme Suresi:</span>
                  <span className="contract-value">{rental.contract_months} Ay</span>
                </div>
                <div className="contract-item">
                  <span className="contract-label">Aylik Tutar:</span>
                  <span className="contract-value">{rental.monthly_price?.toLocaleString('tr-TR')} TL</span>
                </div>
                <div className="contract-item">
                  <span className="contract-label">Odeme Donemi:</span>
                  <span className="contract-value">
                    {rental.payment_timing === 'beginning_of_period' ? 'Donem Basi' : 'Donem Sonu'}
                  </span>
                </div>
                {rental.daily_km_limit || rental.monthly_km_limit ? (
                  <div className="contract-item">
                    <span className="contract-label">KM Limiti:</span>
                    <span className="contract-value">
                      {rental.monthly_km_limit ? `${rental.monthly_km_limit} km/ay` : `${rental.daily_km_limit} km/gun`}
                    </span>
                  </div>
                ) : null}
              </div>
              {rental.services_included && Array.isArray(rental.services_included) && rental.services_included.length > 0 && (
                <div className="services-section">
                  <span className="services-label">Dahil Hizmetler:</span>
                  <span className="services-value">{translateServices(rental.services_included as string[])}</span>
                </div>
              )}
            </div>
          )}

          <div className="damage-section">
            <h3 className="section-title-center">ARAC HASAR TESPIT SEMASI</h3>
            <DamageSchemaStatic damageData={rental.delivery_damage_condition} />
          </div>

          {rental.initial_damage_notes && (
            <div className="notes-section">
              <h3 className="section-title-inline">MEVCUT HASARLAR / NOTLAR</h3>
              <p className="notes-content">{rental.initial_damage_notes}</p>
            </div>
          )}

          {rental.notes && (
            <div className="notes-section">
              <h3 className="section-title-inline">EK NOTLAR</h3>
              <p className="notes-content">{rental.notes}</p>
            </div>
          )}

          <div className="signature-section">
            <div className="signature-box">
              <h4 className="signature-title">TESLIM EDEN</h4>
              <div className="signature-content">
                <div className="signature-field">
                  <span className="signature-label">Adi Soyadi:</span>
                  <div className="signature-line"></div>
                </div>
                <div className="signature-field">
                  <span className="signature-label">Imza:</span>
                  <div className="signature-area"></div>
                </div>
              </div>
              <p className="signature-note">(Sirket Yetkilisi)</p>
            </div>

            <div className="signature-box">
              <h4 className="signature-title">TESLIM ALAN</h4>
              <div className="signature-content">
                <div className="signature-field">
                  <span className="signature-label">Adi Soyadi:</span>
                  <div className="signature-line"></div>
                </div>
                <div className="signature-field">
                  <span className="signature-label">Imza:</span>
                  <div className="signature-area"></div>
                </div>
              </div>
              <p className="signature-note">(Musteri)</p>
            </div>
          </div>

          <div className="footer-section">
            <p>Bu belge elektronik ortamda olusturulmustur.</p>
            <p>Teslim tarihi ve saati: {rental.start_datetime ? new Date(rental.start_datetime).toLocaleString('tr-TR') : formatDate(rental.start_date)}</p>
          </div>
        </div>
      </div>

      <style>{`
        .print-container {
          background: white;
        }

        .no-print {
          display: flex;
        }

        .print-content {
          padding: 24px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 16px;
          margin-bottom: 20px;
          border-bottom: 3px solid #0d9488;
        }

        .header-left {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .company-logo {
          height: 48px;
          object-fit: contain;
        }

        .logo-placeholder {
          width: 48px;
          height: 48px;
          background: #0d9488;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .company-name {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .company-detail {
          font-size: 11px;
          color: #64748b;
          margin: 2px 0 0 0;
        }

        .header-right {
          text-align: right;
        }

        .document-title {
          font-size: 16px;
          font-weight: 700;
          color: #0d9488;
          margin: 0 0 8px 0;
          letter-spacing: 0.5px;
        }

        .document-info {
          font-size: 11px;
          color: #64748b;
          margin: 2px 0;
        }

        .rental-type {
          margin-top: 8px;
          padding: 4px 10px;
          background: #f0fdfa;
          color: #0d9488;
          border-radius: 4px;
          font-weight: 600;
          display: inline-block;
        }

        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }

        .info-section {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
        }

        .customer-section {
          background: #f0fdfa;
          border-color: #99f6e4;
        }

        .vehicle-section {
          background: #eff6ff;
          border-color: #bfdbfe;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 10px 0;
          padding-bottom: 6px;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .section-title-inline {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 8px 0;
        }

        .section-title-center {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          text-align: center;
          margin: 0 0 12px 0;
        }

        .info-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .info-row {
          display: flex;
          align-items: center;
          font-size: 11px;
        }

        .info-label {
          color: #64748b;
          min-width: 90px;
        }

        .info-value {
          color: #0f172a;
          font-weight: 500;
        }

        .plate-value {
          font-size: 14px;
          font-weight: 700;
        }

        .vin-value {
          font-size: 9px;
          font-family: monospace;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-box {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px;
          text-align: center;
          background: #f8fafc;
        }

        .stat-icon {
          width: 20px;
          height: 20px;
          color: #64748b;
          margin: 0 auto 4px;
        }

        .stat-icon-text {
          font-size: 10px;
          color: #64748b;
          display: block;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 9px;
          color: #64748b;
          margin: 0 0 2px 0;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 700;
          color: #0f172a;
          margin: 0;
        }

        .stat-sub {
          font-size: 10px;
          color: #64748b;
          margin: 2px 0 0 0;
        }

        .contract-section {
          border: 1px solid #c4b5fd;
          background: #f5f3ff;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .contract-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
        }

        .contract-item {
          font-size: 10px;
        }

        .contract-label {
          color: #64748b;
          display: block;
        }

        .contract-value {
          color: #0f172a;
          font-weight: 600;
        }

        .services-section {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #c4b5fd;
          font-size: 10px;
        }

        .services-label {
          color: #64748b;
        }

        .services-value {
          color: #0f172a;
          font-weight: 500;
        }

        .damage-section {
          border: 2px solid #fbbf24;
          background: #fffbeb;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .notes-section {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 16px;
        }

        .notes-content {
          font-size: 11px;
          color: #334155;
          margin: 0;
          white-space: pre-wrap;
        }

        .signature-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }

        .signature-box {
          border: 2px solid #cbd5e1;
          border-radius: 8px;
          padding: 16px;
        }

        .signature-title {
          font-size: 11px;
          font-weight: 700;
          color: #0f172a;
          text-align: center;
          margin: 0 0 16px 0;
        }

        .signature-content {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .signature-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .signature-label {
          font-size: 9px;
          color: #64748b;
        }

        .signature-line {
          height: 1px;
          background: #cbd5e1;
          margin-top: 16px;
        }

        .signature-area {
          height: 50px;
          border-bottom: 1px solid #cbd5e1;
        }

        .signature-note {
          font-size: 9px;
          color: #94a3b8;
          text-align: center;
          margin: 8px 0 0 0;
        }

        .footer-section {
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
        }

        .footer-section p {
          font-size: 9px;
          color: #94a3b8;
          margin: 2px 0;
        }

        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          body * {
            visibility: hidden;
          }

          .print-content,
          .print-content * {
            visibility: visible;
          }

          .print-content {
            position: fixed;
            left: 0;
            top: 0;
            width: 210mm;
            padding: 0;
            margin: 0;
            font-size: 10px;
          }

          .no-print {
            display: none !important;
          }

          .print-header {
            padding-bottom: 12px;
            margin-bottom: 16px;
          }

          .company-logo {
            height: 40px;
          }

          .logo-placeholder {
            width: 40px;
            height: 40px;
          }

          .company-name {
            font-size: 14px;
          }

          .document-title {
            font-size: 14px;
          }

          .info-grid {
            margin-bottom: 12px;
          }

          .info-section {
            padding: 10px;
          }

          .section-title {
            font-size: 10px;
          }

          .info-row {
            font-size: 10px;
          }

          .stats-grid {
            margin-bottom: 12px;
            gap: 8px;
          }

          .stat-box {
            padding: 8px;
          }

          .stat-value {
            font-size: 12px;
          }

          .damage-section {
            page-break-inside: avoid;
            padding: 10px;
            margin-bottom: 12px;
          }

          .signature-section {
            page-break-inside: avoid;
            margin-top: 16px;
            gap: 16px;
          }

          .signature-box {
            padding: 12px;
          }

          .signature-area {
            height: 40px;
          }

          .contract-section {
            page-break-inside: avoid;
            margin-bottom: 12px;
          }

          .notes-section {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </Modal>
  );
}
