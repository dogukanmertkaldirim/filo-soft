import type { Vehicle, Customer, Rental, CompanyProfile } from '../types/database';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { formatCurrency } from './format';

export type EmailTemplateType = 'proposal' | 'rental_confirmation' | 'payment_reminder';

export interface EmailData {
  to: string;
  subject: string;
  body: string;
}

interface ProposalEmailData {
  customer: Customer;
  vehicle: Vehicle;
  dailyRate: number;
  companyProfile?: CompanyProfile | null;
}

interface RentalConfirmationEmailData {
  customer: Customer;
  vehicle: Vehicle;
  rental: Rental;
  companyProfile?: CompanyProfile | null;
}

interface PaymentReminderEmailData {
  customer: Customer;
  debtAmount: number;
  companyProfile?: CompanyProfile | null;
}

function formatDate(date: string): string {
  return format(new Date(date), 'd MMMM yyyy', { locale: tr });
}

export function generateProposalEmail(data: ProposalEmailData): string {
  const { customer, vehicle, dailyRate, companyProfile } = data;
  const companyName = companyProfile?.title || 'Firmamız';
  const customerName = customer.authorized_person || customer.company_title;
  const vehicleInfo = `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`;

  const subject = `Araç Kiralama Teklifi - ${companyName}`;
  const body = `Sayın ${customerName},

İlgilendiğiniz ${vehicleInfo} araç için fiyat teklifimiz aşağıdaki gibidir:

ARAÇ BİLGİLERİ:
- Plaka: ${vehicle.plate}
- Marka/Model: ${vehicle.brand} ${vehicle.model}
${vehicle.year ? `- Yıl: ${vehicle.year}` : ''}
${vehicle.color ? `- Renk: ${vehicle.color}` : ''}

KİRALAMA KOŞULLARI:
- Günlük Kiralama Bedeli: ${formatCurrency(dailyRate)}
- Depozito: Sözleşme anında belirlenir
- Kilometre Limiti: Sözleşme anında belirlenir

Detaylı bilgi ve rezervasyon için bizimle iletişime geçebilirsiniz.

Saygılarımızla,
${companyName}
${companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ''}
${companyProfile?.email ? `E-posta: ${companyProfile.email}` : ''}
${companyProfile?.address ? `Adres: ${companyProfile.address}` : ''}`;

  const email = customer.email || '';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function generateRentalConfirmationEmail(data: RentalConfirmationEmailData): string {
  const { customer, vehicle, rental, companyProfile } = data;
  const companyName = companyProfile?.title || 'Firmamız';
  const customerName = customer.authorized_person || customer.company_title;

  const subject = `Kiralama Bilgileriniz - ${vehicle.plate}`;
  const body = `Sayın ${customerName},

${formatDate(rental.start_date)} - ${formatDate(rental.end_date)} tarihleri arasındaki kiralamanız başlamıştır.

KİRALAMA DETAYLARI:
- Araç: ${vehicle.brand} ${vehicle.model} (${vehicle.plate})
- Başlangıç Tarihi: ${formatDate(rental.start_date)}${rental.start_datetime ? ` ${rental.start_datetime.slice(11, 16)}` : ''}
- Bitiş Tarihi: ${formatDate(rental.end_date)}${rental.end_datetime ? ` ${rental.end_datetime.slice(11, 16)}` : ''}
- Günlük Ücret: ${formatCurrency(rental.daily_rate)}
- Toplam Tutar: ${formatCurrency(rental.total_amount)}
${rental.deposit_amount ? `- Depozito: ${formatCurrency(rental.deposit_amount)}` : ''}
${rental.daily_km_limit ? `- Günlük KM Limiti: ${rental.daily_km_limit} km` : ''}

${rental.notes ? `NOT: ${rental.notes}` : ''}

İyi yolculuklar dileriz.

Saygılarımızla,
${companyName}
${companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ''}`;

  const email = customer.email || '';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function generatePaymentReminderEmail(data: PaymentReminderEmailData): string {
  const { customer, debtAmount, companyProfile } = data;
  const companyName = companyProfile?.title || 'Firmamız';
  const customerName = customer.authorized_person || customer.company_title;

  const subject = `Ödeme Hatırlatması - ${companyName}`;
  const body = `Sayın ${customerName},

Sistemlerimizde ${formatCurrency(debtAmount)} tutarında güncel cari borcunuz görünmektedir.

Ödemenizi aşağıdaki hesap bilgilerine yapabilirsiniz:

${companyProfile?.iban_details || 'IBAN bilgisi için bizimle iletişime geçin.'}

Ödemenizi yaptıktan sonra dekont paylaşmanızı rica ederiz.

Herhangi bir sorunuz varsa lütfen bizimle iletişime geçin.

Saygılarımızla,
${companyName}
${companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ''}
${companyProfile?.email ? `E-posta: ${companyProfile.email}` : ''}`;

  const email = customer.email || '';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function getProposalEmailData(data: ProposalEmailData): EmailData {
  const { customer, vehicle, dailyRate, companyProfile } = data;
  const companyName = companyProfile?.title || 'Firmamız';
  const customerName = customer.authorized_person || customer.company_title;
  const vehicleInfo = `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` (${vehicle.year})` : ''}`;

  const subject = `Araç Kiralama Teklifi - ${companyName}`;
  const body = `Sayın ${customerName},

İlgilendiğiniz ${vehicleInfo} araç için fiyat teklifimiz aşağıdaki gibidir:

ARAÇ BİLGİLERİ:
- Plaka: ${vehicle.plate}
- Marka/Model: ${vehicle.brand} ${vehicle.model}
${vehicle.year ? `- Yıl: ${vehicle.year}` : ''}
${vehicle.color ? `- Renk: ${vehicle.color}` : ''}

KİRALAMA KOŞULLARI:
- Günlük Kiralama Bedeli: ${formatCurrency(dailyRate)}
- Depozito: Sözleşme anında belirlenir
- Kilometre Limiti: Sözleşme anında belirlenir

Detaylı bilgi ve rezervasyon için bizimle iletişime geçebilirsiniz.

Saygılarımızla,
${companyName}
${companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ''}
${companyProfile?.email ? `E-posta: ${companyProfile.email}` : ''}
${companyProfile?.address ? `Adres: ${companyProfile.address}` : ''}`;

  return {
    to: customer.email || '',
    subject,
    body,
  };
}

export function getRentalConfirmationEmailData(data: RentalConfirmationEmailData): EmailData {
  const { customer, vehicle, rental, companyProfile } = data;
  const companyName = companyProfile?.title || 'Firmamız';
  const customerName = customer.authorized_person || customer.company_title;

  const subject = `Kiralama Bilgileriniz - ${vehicle.plate}`;
  const body = `Sayın ${customerName},

${formatDate(rental.start_date)} - ${formatDate(rental.end_date)} tarihleri arasındaki kiralamanız başlamıştır.

KİRALAMA DETAYLARI:
- Araç: ${vehicle.brand} ${vehicle.model} (${vehicle.plate})
- Başlangıç Tarihi: ${formatDate(rental.start_date)}${rental.start_datetime ? ` ${rental.start_datetime.slice(11, 16)}` : ''}
- Bitiş Tarihi: ${formatDate(rental.end_date)}${rental.end_datetime ? ` ${rental.end_datetime.slice(11, 16)}` : ''}
- Günlük Ücret: ${formatCurrency(rental.daily_rate)}
- Toplam Tutar: ${formatCurrency(rental.total_amount)}
${rental.deposit_amount ? `- Depozito: ${formatCurrency(rental.deposit_amount)}` : ''}
${rental.daily_km_limit ? `- Günlük KM Limiti: ${rental.daily_km_limit} km` : ''}

${rental.notes ? `NOT: ${rental.notes}` : ''}

İyi yolculuklar dileriz.

Saygılarımızla,
${companyName}
${companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ''}`;

  return {
    to: customer.email || '',
    subject,
    body,
  };
}

export function getPaymentReminderEmailData(data: PaymentReminderEmailData): EmailData {
  const { customer, debtAmount, companyProfile } = data;
  const companyName = companyProfile?.title || 'Firmamız';
  const customerName = customer.authorized_person || customer.company_title;

  const subject = `Ödeme Hatırlatması - ${companyName}`;
  const body = `Sayın ${customerName},

Sistemlerimizde ${formatCurrency(debtAmount)} tutarında güncel cari borcunuz görünmektedir.

Ödemenizi aşağıdaki hesap bilgilerine yapabilirsiniz:

${companyProfile?.iban_details || 'IBAN bilgisi için bizimle iletişime geçin.'}

Ödemenizi yaptıktan sonra dekont paylaşmanızı rica ederiz.

Herhangi bir sorunuz varsa lütfen bizimle iletişime geçin.

Saygılarımızla,
${companyName}
${companyProfile?.phone ? `Tel: ${companyProfile.phone}` : ''}
${companyProfile?.email ? `E-posta: ${companyProfile.email}` : ''}`;

  return {
    to: customer.email || '',
    subject,
    body,
  };
}
