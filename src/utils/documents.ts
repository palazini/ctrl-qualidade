// src/utils/documents.ts
import type { RiskLevel, DocumentActionType } from '../types/documents';
import {
  DOCUMENT_ACTION_LABELS,
  DOCUMENT_ACTION_COLORS,
} from '../types/documents';

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

// Rótulo e cor de risco — pra usar em badges/listas
export function getRiskLabel(risk?: RiskLevel | null): string {
  if (risk === 'HIGH') return 'Risco alto';
  if (risk === 'LOW') return 'Risco baixo';
  return 'Risco não informado';
}

export function getRiskColor(risk?: RiskLevel | null): string {
  if (risk === 'HIGH') return 'red';
  if (risk === 'LOW') return 'green';
  return 'gray';
}

export function prettyTitleFromFilename(fileName: string): string {
  if (!fileName) return '';

  // remove a extensão (".docx", ".pdf", etc.)
  const withoutExt = fileName.replace(/\.[^/.]+$/, '');

  // troca _ e - por espaço, colapsa espaços e trim
  return withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getActionLabel(action: DocumentActionType): string {
  return DOCUMENT_ACTION_LABELS[action] ?? action;
}

export function getActionColor(action: DocumentActionType): string {
  return DOCUMENT_ACTION_COLORS[action] ?? 'gray';
}