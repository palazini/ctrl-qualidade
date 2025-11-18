// src/pages/company/QualityArchivedPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { CompanyOutletContext } from './CompanyLayoutPage';
import {
  Badge,
  Button,
  Card,
  Center,
  Group,
  Loader,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconSearch, IconTrash } from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';

type VersionStage =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'NEEDS_CHANGES'
  | 'EDITED_BY_QUALITY'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED';

type RiskLevel = 'LOW' | 'HIGH';

type ArchivedDoc = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  updatedAt: string;
  docTypeLabel: string | null;
  riskLevel: RiskLevel | null;
  fileUrl: string | null;
  fileName: string | null;
  lastStage: VersionStage | null;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

// mesmo helper das outras telas
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

function stageBadge(stage: VersionStage | null) {
  if (!stage) {
    return (
      <Badge size="xs" color="gray" variant="light">
        Sem status
      </Badge>
    );
  }

  const labelMap: Record<VersionStage, string> = {
    SUBMITTED: 'Enviado',
    UNDER_REVIEW: 'Em revisão',
    NEEDS_CHANGES: 'Precisa de ajustes',
    EDITED_BY_QUALITY: 'Editado pela Qualidade',
    READY_TO_PUBLISH: 'Pronto para publicar',
    PUBLISHED: 'Publicado',
  };

  const colorMap: Record<VersionStage, string> = {
    SUBMITTED: 'blue',
    UNDER_REVIEW: 'indigo',
    NEEDS_CHANGES: 'orange',
    EDITED_BY_QUALITY: 'grape',
    READY_TO_PUBLISH: 'teal',
    PUBLISHED: 'green',
  };

  return (
    <Badge size="xs" color={colorMap[stage]} variant="light">
      {labelMap[stage]}
    </Badge>
  );
}

function normalizeForCompare(value: string | null | undefined) {
    if (!value) return '';
    return value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' '); // colapsa múltiplos espaços em um só
}

export default function QualityArchivedPage() {
  const { company, currentRole, appUser } =
    useOutletContext<CompanyOutletContext>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<ArchivedDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const isQualityOrAdmin =
    currentRole === 'GESTOR_QUALIDADE' || appUser.system_role === 'SITE_ADMIN';

  if (!isQualityOrAdmin) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Arquivados</Text>
          <Text size="sm" c="dimmed">
            Esta área é restrita à Qualidade ou ao Administrador do site.
          </Text>
        </Stack>
      </Card>
    );
  }

  async function loadArchivedDocs() {
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
        updated_at,
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
          stage,
          created_at
        ),
        versions:document_versions!document_versions_document_id_fkey (
          id,
          version_number,
          pdf_file_url,
          pdf_file_name,
          source_file_url,
          source_file_name,
          stage,
          created_at
        )
      `
      )
      .eq('company_id', company.id)
      .eq('status', 'ARCHIVED')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(error);
      setError('Erro ao carregar documentos arquivados.');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as any[];

    const mapped: ArchivedDoc[] = rows.map((row) => {
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

      const fileUrl = cv?.pdf_file_url || cv?.source_file_url || null;
      const fileName = cv?.pdf_file_name || cv?.source_file_name || null;

      return {
        id: row.id as string,
        title: row.title as string,
        code: (row.code as string) ?? null,
        status: (row.status as string) ?? null,
        updatedAt: (row.updated_at as string) ?? '',
        docTypeLabel,
        riskLevel: (row.risk_level as RiskLevel | null) ?? null,
        fileUrl,
        fileName,
        lastStage: (cv?.stage as VersionStage | null) ?? null,
      };
    });

    setDocs(mapped);

    if (mapped.length === 0) {
      setSelectedId(null);
    } else {
      setSelectedId((prev) => {
        if (prev && mapped.some((d) => d.id === prev)) return prev;
        return mapped[0].id;
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadArchivedDocs();
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

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId]
  );

  const previewUrl = buildPreviewUrl(selectedDoc?.fileUrl ?? null);

  async function handleUnarchive(doc: ArchivedDoc) {
    const confirmed = window.confirm(
      'Deseja desarquivar este documento e retorná-lo para a biblioteca?'
    );
    if (!confirmed) return;

    setUnarchivingId(doc.id);

    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('documents')
        .update({
          status: 'PUBLISHED',
          updated_at: nowIso,
        })
        .eq('id', doc.id);

      if (error) {
        console.error(error);
        throw new Error('Falha ao desarquivar documento.');
      }

      await loadArchivedDocs();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao desarquivar documento.');
    } finally {
      setUnarchivingId(null);
    }
  }

  async function handlePermanentDelete(doc: ArchivedDoc) {
    // mesma regra usada no disabled do botão
    const typed = normalizeForCompare(deleteConfirmText);
    const title = normalizeForCompare(doc.title);

    if (typed !== title) {
        alert(
        'Para excluir permanentemente, digite exatamente o título do documento no campo indicado.'
        );
        return;
    }

    setDeletingId(doc.id);

    try {
        // 1) buscar versões para apagar arquivos no Storage
        const { data: versions, error: vError } = await supabase
        .from('document_versions')
        .select('id, source_file_url, pdf_file_url')
        .eq('document_id', doc.id);

        if (vError) {
        console.error(vError);
        throw new Error('Falha ao buscar versões do documento.');
        }

        const pathsToDelete: string[] = [];

        (versions ?? []).forEach((v: any) => {
        const urls = [v.source_file_url as string | null, v.pdf_file_url as string | null];

        urls.forEach((url) => {
            if (!url) return;
            const marker = '/storage/v1/object/public/documents/';
            const idx = url.indexOf(marker);
            if (idx === -1) return;
            const path = url.substring(idx + marker.length);
            pathsToDelete.push(path);
        });
        });

        if (pathsToDelete.length > 0) {
        const { error: delStorageErr } = await supabase.storage
            .from('documents')
            .remove(pathsToDelete);

        if (delStorageErr) {
            console.error('Erro ao remover arquivos do Storage:', delStorageErr);
        }
        }

        // 2) limpar current_version_id para liberar a FK
        const { error: clearCurrentErr } = await supabase
            .from('documents')
            .update({ current_version_id: null })
            .eq('id', doc.id);

        if (clearCurrentErr) {
            console.error(clearCurrentErr);
            throw new Error(
                'Falha ao limpar a versão atual do documento antes da exclusão.'
            );
        }

        // 3) apaga versões
        const { error: delVersionsErr } = await supabase
            .from('document_versions')
            .delete()
            .eq('document_id', doc.id);

        if (delVersionsErr) {
            console.error(delVersionsErr);
            throw new Error('Falha ao excluir versões do documento.');
        }

        // 4) apaga o documento
        const { error: delDocErr } = await supabase
            .from('documents')
            .delete()
            .eq('id', doc.id);

        if (delDocErr) {
            console.error(delDocErr);
            throw new Error('Falha ao excluir o documento.');
        }

        if (delDocErr) {
            console.error(delDocErr);
            throw new Error('Falha ao excluir o documento.');
        }

        // limpa campo e recarrega lista
        setDeleteConfirmText('');
        await loadArchivedDocs();
    } catch (err: any) {
        console.error(err);
        alert(err.message || 'Erro ao excluir documento.');
    } finally {
        setDeletingId(null);
    }
  }

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
          <Text fw={500}>Arquivados</Text>
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
          <Text fw={500}>Arquivados</Text>
          <Text size="sm" c="dimmed">
            Não há documentos arquivados para esta companhia.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm" h="100%">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text fw={500}>Arquivados</Text>
            <Text size="xs" c="dimmed">
              Documentos retirados da biblioteca, mas ainda mantidos para
              histórico. Aqui é possível desarquivar ou excluir
              definitivamente.
            </Text>
          </Stack>
          <Badge variant="light" color="blue">
            {docs.length} documento(s)
          </Badge>
        </Group>

        <SimpleGrid
          cols={{ base: 1, md: 2 }}
          spacing="md"
          style={{ alignItems: 'stretch' }}
        >
          {/* Lista à esquerda */}
          <Card withBorder radius="md" shadow="xs">
            <Stack gap="sm">
              <TextInput
                label="Buscar"
                placeholder="Título ou código..."
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                leftSection={<IconSearch size={14} />}
                size="xs"
              />

              <ScrollArea h="60vh" type="always">
                <Stack gap="xs" pr="xs">
                  {filteredDocs.length === 0 ? (
                    <Center h={200}>
                      <Text size="sm" c="dimmed">
                        Nenhum documento encontrado com o termo informado.
                      </Text>
                    </Center>
                  ) : (
                    filteredDocs.map((doc) => {
                      const isActive = doc.id === selectedDoc?.id;
                      const updatedLabel = formatDateTime(doc.updatedAt);

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
                          shadow={isActive ? 'sm' : 'xs'}
                          onClick={() => setSelectedId(doc.id)}
                          style={{
                            cursor: 'pointer',
                            borderColor: isActive ? '#228be6' : undefined,
                            backgroundColor: isActive ? '#f5f9ff' : undefined,
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
                                {stageBadge(doc.lastStage)}
                                <Badge
                                  size="xs"
                                  color={riskColor}
                                  variant="light"
                                >
                                  {riskLabel}
                                </Badge>
                              </Stack>
                            </Group>

                            {updatedLabel && (
                              <Text size="xs" c="dimmed">
                                Atualizado em: {updatedLabel}
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      );
                    })
                  )}
                </Stack>
              </ScrollArea>
            </Stack>
          </Card>

          {/* Detalhes / ações à direita */}
          <Card withBorder radius="md" shadow="xs">
            {selectedDoc ? (
              <Stack gap="sm" h="100%">
                <Stack gap={2}>
                  <Group justify="space-between" align="flex-start">
                    <Stack gap={0}>
                      <Text fw={500}>{selectedDoc.title}</Text>
                      {selectedDoc.code && (
                        <Text size="sm" c="dimmed">
                          Código: {selectedDoc.code}
                        </Text>
                      )}
                      {selectedDoc.docTypeLabel && (
                        <Text size="xs" c="dimmed">
                          Tipo: {selectedDoc.docTypeLabel}
                        </Text>
                      )}
                    </Stack>
                    <Stack gap={4} align="flex-end">
                      {stageBadge(selectedDoc.lastStage)}
                      {selectedDoc.riskLevel && (
                        <Badge
                          size="xs"
                          color={
                            selectedDoc.riskLevel === 'HIGH' ? 'red' : 'green'
                          }
                          variant="light"
                        >
                          {selectedDoc.riskLevel === 'HIGH'
                            ? 'Risco alto'
                            : 'Risco baixo'}
                        </Badge>
                      )}
                    </Stack>
                  </Group>

                  {selectedDoc.fileName && (
                    <Text size="xs" c="dimmed">
                      Arquivo atual: {selectedDoc.fileName}
                    </Text>
                  )}

                  {selectedDoc.updatedAt && (
                    <Text size="xs" c="dimmed">
                      Atualizado em:{' '}
                      {formatDateTime(selectedDoc.updatedAt)}
                    </Text>
                  )}
                </Stack>

                {/* Ações principais */}
                <Group justify="flex-end" gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    onClick={() => handleUnarchive(selectedDoc)}
                    loading={unarchivingId === selectedDoc.id}
                  >
                    Desarquivar (voltar à biblioteca)
                  </Button>
                </Group>

                {/* Preview */}
                <Stack gap={4} mt="sm">
                  <Text fw={500} size="sm">
                    Visualização online
                  </Text>
                  <div
                    style={{
                      border: '1px solid #e1e4e8',
                      borderRadius: 8,
                      overflow: 'hidden',
                      height: '40vh',
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
                </Stack>

                {/* Zona de perigo: exclusão definitiva */}
                <Stack
                  gap="xs"
                  mt="sm"
                  p="sm"
                  style={{
                    borderRadius: 8,
                    border: '1px solid #ffe3e3',
                    backgroundColor: '#fff5f5',
                  }}
                >
                  <Group gap="xs" align="center">
                    <IconAlertTriangle size={16} color="#fa5252" />
                    <Text fw={500} size="sm" c="red">
                      Exclusão permanente
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed">
                    Esta ação irá remover definitivamente o documento, todas as
                    versões associadas e os arquivos do Storage. Não será
                    possível recuperar depois.
                  </Text>

                  <Text size="xs">
                    Para confirmar, digite exatamente o título do documento
                    abaixo:
                  </Text>

                  <Text size="xs" fw={500}>
                    {selectedDoc.title}
                  </Text>

                  <TextInput
                    placeholder="Digite o título do documento para confirmar"
                    value={deleteConfirmText}
                    onChange={(e) =>
                      setDeleteConfirmText(e.currentTarget.value)
                    }
                    size="xs"
                  />

                  <Group justify="flex-end">
                    <Button
                        size="xs"
                        color="red"
                        variant="filled"
                        leftSection={<IconTrash size={14} />}
                        disabled={
                            normalizeForCompare(deleteConfirmText) !==
                            normalizeForCompare(selectedDoc.title)
                        }
                        loading={deletingId === selectedDoc.id}
                        onClick={() => handlePermanentDelete(selectedDoc)}
                        >
                        Excluir permanentemente
                    </Button>
                  </Group>
                </Stack>
              </Stack>
            ) : (
              <Center h="100%">
                <Text size="sm" c="dimmed">
                  Selecione um documento à esquerda para ver detalhes.
                </Text>
              </Center>
            )}
          </Card>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
