// src/utils/documents.ts
import type { RiskLevel } from '../types/documents';

// Datas em pt-BR (reaproveitado em todas as telas)
export function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// URL de preview (PDF direto / Office Web Viewer para Office)
export function buildPreviewUrl(fileUrl: string | null) {
  if (!fileUrl) return null;

  const lower = fileUrl.toLowerCase();

  if (lower.endsWith('.pdf')) {
    return fileUrl;
  }

  const officeExts = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx'];
  if (officeExts.some((ext) => lower.endsWith(ext))) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      fileUrl
    )}`;
  }

  return fileUrl;
}

export function getRiskLabel(risk: RiskLevel | null | undefined): string {
  if (risk === 'HIGH') return 'Risco alto';
  if (risk === 'LOW') return 'Risco baixo';
  return 'Risco não informado';
}

export function getRiskColor(risk: RiskLevel | null | undefined): string {
  if (risk === 'HIGH') return 'red';
  if (risk === 'LOW') return 'green';
  return 'gray';
}

// Título amigável a partir do nome do arquivo
export function prettyTitleFromFilename(fileName: string): string {
  if (!fileName) return '';

  const withoutExt = fileName.replace(/\.[^/.]+$/, '');
  return withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
