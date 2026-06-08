import { supabase } from '../lib/supabase';

const QUEUE_KEY = 'offline_handover_queue';

export interface OfflinePayload {
  id: string;
  taskId: string;
  taskType: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  companyId: string;
  submittedData: Record<string, unknown>;
  signatureDataUrl: string | null;
  fileDataUrls: string[];
  rentalUpdate?: {
    type: 'handover' | 'delivery';
    vehicleId: string;
    payload: Record<string, unknown>;
    rentalStatus: string;
  };
  queuedAt: string;
}

export function getOfflineQueue(): OfflinePayload[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(payload: OfflinePayload): void {
  const queue = getOfflineQueue();
  queue.push(payload);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

function removeFromQueue(id: string): void {
  const queue = getOfflineQueue().filter(p => p.id !== id);
  if (queue.length === 0) {
    localStorage.removeItem(QUEUE_KEY);
  } else {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

async function uploadDataUrlToStorage(
  dataUrl: string,
  path: string,
  contentType: string
): Promise<string | null> {
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const { error } = await supabase.storage
      .from('documents')
      .upload(path, blob, { contentType });
    if (error) return null;
    const { data } = supabase.storage.from('documents').getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function processOfflineQueue(): Promise<number> {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  let processed = 0;

  for (const item of queue) {
    try {
      let sigUrl: string | null = null;
      if (item.signatureDataUrl) {
        const sigPath = `signatures/${item.companyId}/${item.taskId}_offline_${Date.now()}.png`;
        sigUrl = await uploadDataUrlToStorage(item.signatureDataUrl, sigPath, 'image/png');
      }

      const uploadedFileUrls: string[] = [];
      for (let i = 0; i < item.fileDataUrls.length; i++) {
        const fileData = item.fileDataUrls[i];
        if (fileData.startsWith('http')) {
          uploadedFileUrls.push(fileData);
        } else {
          const ext = fileData.match(/data:.*?\/(\w+)/)?.[1] || 'jpg';
          const filePath = `task-files/${item.companyId}/${item.taskId}/${Date.now()}_offline_${i}.${ext}`;
          const contentType = fileData.match(/data:(.*?);/)?.[1] || 'application/octet-stream';
          const url = await uploadDataUrlToStorage(fileData, filePath, contentType);
          if (url) uploadedFileUrls.push(url);
        }
      }

      const { error: taskErr } = await supabase.from('operational_tasks').update({
        status: 'pending_sync',
        handover_data: item.submittedData,
        submitted_data: item.submittedData,
        signature_url: sigUrl,
        file_urls: uploadedFileUrls,
      }).eq('id', item.taskId);

      if (taskErr) continue;

      if (item.rentalUpdate) {
        const field = item.rentalUpdate.type === 'handover' ? 'handover_payload' : 'delivery_payload';
        const rentalPayload = {
          ...item.rentalUpdate.payload,
          photos: uploadedFileUrls,
          signature_url: sigUrl,
        };
        await supabase
          .from('rentals')
          .update({ [field]: rentalPayload })
          .eq('vehicle_id', item.rentalUpdate.vehicleId)
          .eq('status', item.rentalUpdate.rentalStatus);
      }

      removeFromQueue(item.id);
      processed++;
    } catch {
      break;
    }
  }

  return processed;
}

export function isNetworkError(error: unknown): boolean {
  if (!error) return false;
  const msg = String(error).toLowerCase();
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('failed') ||
    msg.includes('aborterror') ||
    msg.includes('err_internet_disconnected')
  );
}
