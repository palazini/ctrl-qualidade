// src/pages/company/LibraryPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from './CompanyLayoutPage';
import {
  Card,
  Stack,
  Text,
  Group,
  Badge,
  Button,
  Loader,
  Center,
  ScrollArea,
  TextInput,
} from '@mantine/core';
import {
  IconSearch,
  IconArrowLeft,
  IconFileDownload,
} from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';

type VersionStage =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CHANGES'
  | 'EDITED_BY_QUALITY'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED';

type RiskLevel = 'LOW' | 'HIGH';

type LibraryDoc = {
  id: string;
  title: string;
  code: string | null;
  docTypeLabel: string | null;
  riskLevel: RiskLevel | null;
  publishedAt: string | null;
  fileUrl: string | null;
  fileName: string | null;
};

// formata datas para exibição
function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// gera URL para pré-visualização (PDF direto / Office viewer)
function buildPreviewUrl(fileUrl: string | null) {
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

export default function LibraryPage() {
  const { company } = useOutletContext<CompanyOutletContext>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<LibraryDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<LibraryDoc | null>(null);

  const [search, setSearch] = useState('');

  async function loadDocuments() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('documents')
      .select(
        `
        id,
        title,
        code,
        status,
        published_at,
        risk_level,
        doc_type:document_types (
          id,
          name,
          code
        ),
        current_version:document_versions!documents_current_version_fk (
          id,
          version_number,
          pdf_file_url,
          pdf_file_name,
          source_file_url,
          source_file_name,
          created_at
        ),
        versions:document_versions!document_versions_document_id_fkey (
          id,
          version_number,
          pdf_file_url,
          pdf_file_name,
          source_file_url,
          source_file_name,
          created_at
        )
      `
      )
      .eq('company_id', company.id)
      .eq('status', 'PUBLISHED')
      .order('title', { ascending: true });

    if (error) {
      console.error(error);
      setError('Erro ao carregar documentos publicados.');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as any[];

    const mapped: LibraryDoc[] = rows.map((row) => {
      const dt =
        row.doc_type && Array.isArray(row.doc_type) && row.doc_type.length > 0
          ? row.doc_type[0]
          : null;

      const docTypeLabel =
        dt && dt.code
          ? `${dt.code} - ${dt.name}`
          : dt
          ? (dt.name as string)
          : null;

      const currentArray: any[] = Array.isArray(row.current_version)
        ? row.current_version
        : [];
      const versionsArray: any[] = Array.isArray(row.versions)
        ? row.versions
        : [];

      let cv: any = currentArray.length > 0 ? currentArray[0] : null;

      // fallback: se não houver current_version, pega a última versão pelo version_number
      if (!cv && versionsArray.length > 0) {
        cv = [...versionsArray].sort(
          (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)
        )[0];
      }

      const fileUrl =
        cv?.pdf_file_url || cv?.source_file_url || null;
      const fileName =
        cv?.pdf_file_name || cv?.source_file_name || null;

      return {
        id: row.id as string,
        title: row.title as string,
        code: (row.code as string) ?? null,
        docTypeLabel,
        riskLevel: (row.risk_level as RiskLevel | null) ?? null,
        publishedAt: (row.published_at as string) ?? null,
        fileUrl,
        fileName,
      };
    });

    setDocs(mapped);
    setSelectedDoc(null); // volta pra lista ao recarregar
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const filteredDocs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter((d) => {
      const haystack = `${d.title} ${d.code ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [docs, search]);

  const previewUrl = buildPreviewUrl(selectedDoc?.fileUrl ?? null);

  // 1) Estado de loading / erro / sem documentos
  if (loading) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Center h={220}>
          <Loader size="lg" />
        </Center>
      </Card>
    );
  }

  if (error) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Biblioteca de documentos</Text>
          <Text size="sm" c="dimmed">
            {error}
          </Text>
        </Stack>
      </Card>
    );
  }

  if (docs.length === 0) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Biblioteca de documentos</Text>
          <Text size="sm" c="dimmed">
            Ainda não há documentos publicados para esta companhia.
          </Text>
        </Stack>
      </Card>
    );
  }

  // 2) MODO LISTA (sem documento selecionado)
  if (!selectedDoc) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="md" h="100%">
          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text fw={500}>Biblioteca de documentos</Text>
              <Text size="sm" c="dimmed">
                Toque em um documento para abrir em tela cheia.
              </Text>
            </Stack>
            <Badge variant="light" color="blue">
              {docs.length} documento(s)
            </Badge>
          </Group>

          <Group align="flex-end" gap="sm">
            <TextInput
              label="Buscar"
              placeholder="Título ou código..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              leftSection={<IconSearch size={14} />}
              size="xs"
              style={{ minWidth: 220 }}
            />
          </Group>

          <ScrollArea h="65vh" type="always">
            <Stack gap="xs" pr="xs">
              {filteredDocs.length === 0 ? (
                <Center h={200}>
                  <Text size="sm" c="dimmed">
                    Nenhum documento encontrado com o termo informado.
                  </Text>
                </Center>
              ) : (
                filteredDocs.map((doc) => {
                  const riskLabel =
                    doc.riskLevel === 'HIGH'
                      ? 'Risco alto'
                      : doc.riskLevel === 'LOW'
                      ? 'Risco baixo'
                      : 'Risco não informado';

                  const riskColor =
                    doc.riskLevel === 'HIGH'
                      ? 'red'
                      : doc.riskLevel === 'LOW'
                      ? 'green'
                      : 'gray';

                  return (
                    <Card
                      key={doc.id}
                      withBorder
                      radius="md"
                      shadow="xs"
                      onClick={() => setSelectedDoc(doc)}
                      style={{
                        cursor: 'pointer',
                        transition:
                          'border-color 120ms ease, box-shadow 120ms ease',
                      }}
                    >
                      <Stack gap={4}>
                        <Group justify="space-between" align="flex-start">
                          <Stack gap={0}>
                            <Text fw={500} size="sm">
                              {doc.title}
                            </Text>
                            {doc.code && (
                              <Text size="xs" c="dimmed">
                                Código: {doc.code}
                              </Text>
                            )}
                            {doc.docTypeLabel && (
                              <Text size="xs" c="dimmed">
                                Tipo: {doc.docTypeLabel}
                              </Text>
                            )}
                          </Stack>
                          <Stack gap={4} align="flex-end">
                            <Badge
                              size="xs"
                              color={riskColor}
                              variant="light"
                            >
                              {riskLabel}
                            </Badge>
                            {doc.publishedAt && (
                              <Text size="xs" c="dimmed">
                                Publicado em:{' '}
                                {formatDateTime(doc.publishedAt)}
                              </Text>
                            )}
                          </Stack>
                        </Group>
                      </Stack>
                    </Card>
                  );
                })
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Card>
    );
  }

  // 3) MODO VISUALIZAÇÃO (tela cheia dentro do main)
  return (
    <Card
      withBorder
      shadow="sm"
      radius="md"
      style={{ height: 'calc(100vh - 120px)' }}
    >
      <Stack gap="sm" h="100%">
        {/* Barra superior bem enxuta */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconArrowLeft size={14} />}
              onClick={() => setSelectedDoc(null)}
            >
              Voltar
            </Button>
            <Stack gap={0} ml="xs">
              <Text fw={500} size="sm">
                {selectedDoc.title}
              </Text>
              <Group gap="xs">
                {selectedDoc.code && (
                  <Text size="xs" c="dimmed">
                    Código:{' '}
                    <Text span fw={500}>
                      {selectedDoc.code}
                    </Text>
                  </Text>
                )}
                {selectedDoc.docTypeLabel && (
                  <Text size="xs" c="dimmed">
                    · {selectedDoc.docTypeLabel}
                  </Text>
                )}
              </Group>
            </Stack>
          </Group>

          <Group gap="xs">
            {selectedDoc.riskLevel && (
              <Badge
                size="xs"
                color={selectedDoc.riskLevel === 'HIGH' ? 'red' : 'green'}
                variant="light"
              >
                {selectedDoc.riskLevel === 'HIGH'
                  ? 'Risco alto'
                  : 'Risco baixo'}
              </Badge>
            )}

            {selectedDoc.fileUrl && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconFileDownload size={14} />}
                component="a"
                href={selectedDoc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Baixar
              </Button>
            )}
          </Group>
        </Group>

        {/* Preview ocupando praticamente todo o espaço */}
        <div
          style={{
            flex: 1,
            border: '1px solid #e1e4e8',
            borderRadius: 8,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title="Visualização do documento"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
            />
          ) : (
            <Center h="100%">
              <Text size="sm" c="dimmed">
                Nenhum arquivo disponível para visualização.
              </Text>
            </Center>
          )}
        </div>

        <Text size="xs" c="dimmed">
          Use a rolagem e o zoom da própria área de visualização. Este modo é
          pensado para uso em tablets, ocupando o máximo de espaço de tela com o
          documento.
        </Text>
      </Stack>
    </Card>
  );
}
