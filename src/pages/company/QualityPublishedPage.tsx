// src/pages/company/QualityPublishedPage.tsx
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
  SimpleGrid,
  TextInput,
  Select,
} from '@mantine/core';
import { IconSearch, IconReload } from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';

// tipos/helpers centralizados
import type { RiskLevel } from '../../types/documents';
import { formatDateTime, buildPreviewUrl } from '../../utils/documents';
import { RiskBadge } from '../../components/documents/RiskBadge';

type VersionRow = {
  id: string;
  version_number: number;
  pdf_file_url: string | null;
  pdf_file_name: string | null;
  source_file_url: string | null;
  source_file_name: string | null;
};

type DocTypeRow = {
  id: string;
  name: string;
  code: string | null;
};

type DocumentRow = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  published_at: string | null;
  risk_level: RiskLevel | null;
  elaborator: string | null;
  approver: string | null;
  doc_type: DocTypeRow[] | null;
  current_version: VersionRow[] | null;
  versions: VersionRow[] | null;
};

type PublishedDoc = {
  id: string;
  title: string;
  code: string | null;
  status: string | null;
  publishedAt: string | null;
  riskLevel: RiskLevel | null;
  elaborator: string | null;
  approver: string | null;
  docTypeLabel: string | null;

  versionId: string | null;
  versionNumber: number;
  fileUrl: string | null;
  fileName: string | null;
};

type RiskFilter = 'ALL' | 'LOW' | 'HIGH';

export default function QualityPublishedPage() {
  const { company, currentRole } =
    useOutletContext<CompanyOutletContext>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<PublishedDoc[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');

  const [archiving, setArchiving] = useState(false);
  const [sendingBack, setSendingBack] = useState(false);

  // só Gestor de Qualidade
  if (currentRole !== 'GESTOR_QUALIDADE') {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Documentos publicados</Text>
          <Text size="sm" c="dimmed">
            Esta área é restrita a Gestores de Qualidade.
          </Text>
        </Stack>
      </Card>
    );
  }

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
        elaborator,
        approver,
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
          source_file_name
        ),
        versions:document_versions!document_versions_document_id_fkey (
          id,
          version_number,
          pdf_file_url,
          pdf_file_name,
          source_file_url,
          source_file_name
        )
      `
      )
      .eq('company_id', company.id)
      .eq('status', 'PUBLISHED')
      .order('published_at', { ascending: false });

    if (error) {
      console.error(error);
      setError('Erro ao carregar documentos publicados.');
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as DocumentRow[];

    const mapped: PublishedDoc[] = rows.map((doc) => {
      const currentArray = Array.isArray(doc.current_version)
        ? doc.current_version
        : [];
      const versionsArray = Array.isArray(doc.versions)
        ? doc.versions
        : [];

      // tenta current_version; se não tiver, cai pra última versão pelo número
      let cv: VersionRow | null =
        currentArray.length > 0 ? currentArray[0] : null;

      if (!cv && versionsArray.length > 0) {
        cv = [...versionsArray].sort(
          (a, b) => (b.version_number ?? 0) - (a.version_number ?? 0)
        )[0];
      }

      const dt =
        doc.doc_type && doc.doc_type.length > 0 ? doc.doc_type[0] : null;

      const docTypeLabel =
        dt && dt.code
          ? `${dt.code} - ${dt.name}`
          : dt
          ? dt.name
          : null;

      const fileUrl = cv
        ? cv.pdf_file_url || cv.source_file_url || null
        : null;
      const fileName = cv
        ? cv.pdf_file_name || cv.source_file_name || null
        : null;

      return {
        id: doc.id,
        title: doc.title,
        code: doc.code,
        status: doc.status,
        publishedAt: doc.published_at,
        riskLevel: doc.risk_level,
        elaborator: doc.elaborator,
        approver: doc.approver,
        docTypeLabel,

        versionId: cv?.id ?? null,
        versionNumber: cv?.version_number ?? 0,
        fileUrl,
        fileName,
      };
    });

    setDocs(mapped);

    if (mapped.length === 0) {
      setSelectedId(null);
    } else {
      setSelectedId((prev) =>
        prev && mapped.some((d) => d.id === prev) ? prev : mapped[0].id
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  const filteredDocs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return docs.filter((d) => {
      if (riskFilter === 'HIGH' && d.riskLevel !== 'HIGH') return false;
      if (riskFilter === 'LOW' && d.riskLevel !== 'LOW') return false;

      if (!term) return true;

      const haystack = `${d.title} ${d.code ?? ''} ${
        d.elaborator ?? ''
      } ${d.approver ?? ''}`.toLowerCase();

      return haystack.includes(term);
    });
  }, [docs, search, riskFilter]);

  const selectedDoc: PublishedDoc | null = useMemo(
    () => filteredDocs.find((d) => d.id === selectedId) ?? null,
    [filteredDocs, selectedId]
  );

  const previewUrl = buildPreviewUrl(selectedDoc?.fileUrl ?? null);

  async function handleArchive() {
    if (!selectedDoc) return;

    const confirmed = window.confirm(
      'Retirar este documento da biblioteca? Ele deixará de aparecer para os colaboradores, mas o registro ficará arquivado.'
    );
    if (!confirmed) return;

    setArchiving(true);
    try {
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from('documents')
        .update({
          status: 'ARCHIVED',
          updated_at: nowIso,
        })
        .eq('id', selectedDoc.id);

      if (error) {
        console.error(error);
        throw new Error('Falha ao arquivar documento.');
      }

      await loadDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao arquivar documento.');
    } finally {
      setArchiving(false);
    }
  }

  async function handleSendBackToReview() {
    if (!selectedDoc) return;

    const confirmed = window.confirm(
      'Enviar este documento de volta para revisão? Ele sairá da biblioteca e voltará para a fila da Qualidade.'
    );
    if (!confirmed) return;

    setSendingBack(true);
    try {
      const nowIso = new Date().toISOString();

      // 1) documento volta a ficar "IN_REVIEW"
      const { error: dErr } = await supabase
        .from('documents')
        .update({
          status: 'IN_REVIEW',
          updated_at: nowIso,
        })
        .eq('id', selectedDoc.id);

      if (dErr) {
        console.error(dErr);
        throw new Error('Falha ao atualizar status do documento.');
      }

      // 2) opcional: estágio da versão atual volta para UNDER_REVIEW
      if (selectedDoc.versionId) {
        const { error: vErr } = await supabase
          .from('document_versions')
          .update({ stage: 'UNDER_REVIEW' })
          .eq('id', selectedDoc.versionId);

        if (vErr) {
          console.error(vErr);
          throw new Error('Falha ao atualizar estágio da versão.');
        }
      }

      await loadDocuments();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao reenviar documento para revisão.');
    } finally {
      setSendingBack(false);
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
          <Text fw={500}>Documentos publicados (Qualidade)</Text>
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
          <Text fw={500}>Documentos publicados (Qualidade)</Text>
          <Text size="sm" c="dimmed">
            Ainda não há documentos publicados para esta companhia.
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
            <Text fw={500}>Documentos publicados (Qualidade)</Text>
            <Text size="xs" c="dimmed">
              Visão interna da Qualidade com informações de risco, elaborador,
              aprovador e data de publicação.
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconReload size={14} />}
              onClick={loadDocuments}
            >
              Atualizar
            </Button>
            <Badge variant="light" color="blue">
              {docs.length} documento(s)
            </Badge>
          </Group>
        </Group>

        <Group align="flex-end" gap="sm">
          <TextInput
            label="Buscar"
            placeholder="Título, código, elaborador, aprovador..."
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            leftSection={<IconSearch size={14} />}
            size="xs"
            style={{ minWidth: 260 }}
          />
          <Select
            label="Risco"
            size="xs"
            data={[
              { value: 'ALL', label: 'Todos' },
              { value: 'LOW', label: 'Baixo' },
              { value: 'HIGH', label: 'Alto' },
            ]}
            value={riskFilter}
            onChange={(value) =>
              setRiskFilter((value as RiskFilter) || 'ALL')
            }
            style={{ width: 160 }}
          />
        </Group>

        <SimpleGrid
          cols={{ base: 1, md: 2 }}
          spacing="md"
          style={{ alignItems: 'stretch' }}
        >
          {/* Lista à esquerda */}
          <Card withBorder radius="md" shadow="xs">
            <ScrollArea h="60vh" type="always">
              <Stack gap="xs" pr="xs">
                {filteredDocs.length === 0 ? (
                  <Center h={200}>
                    <Text size="sm" c="dimmed">
                      Nenhum documento encontrado com os filtros atuais.
                    </Text>
                  </Center>
                ) : (
                  filteredDocs.map((doc) => {
                    const isActive = doc.id === selectedDoc?.id;
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
                              {doc.versionNumber > 0 && (
                                <Text size="xs" c="dimmed">
                                  Versão atual: Rev. {doc.versionNumber}
                                </Text>
                              )}
                            </Stack>
                            <RiskBadge risk={doc.riskLevel} size="xs" />
                          </Group>

                          <Text size="xs" c="dimmed">
                            Elaborador: {doc.elaborator || '—'} · Aprovador:{' '}
                            {doc.approver || '—'}
                          </Text>

                          {doc.publishedAt && (
                            <Text size="xs" c="dimmed">
                              Publicado em:{' '}
                              {formatDateTime(doc.publishedAt)}
                            </Text>
                          )}
                        </Stack>
                      </Card>
                    );
                  })
                )}
              </Stack>
            </ScrollArea>
          </Card>

          {/* Detalhes + preview à direita */}
          <Card withBorder radius="md" shadow="xs">
            {selectedDoc ? (
              <Stack gap="sm">
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={500}>{selectedDoc.title}</Text>
                    {selectedDoc.code && (
                      <Text size="sm" c="dimmed">
                        Código: {selectedDoc.code}
                      </Text>
                    )}
                    {selectedDoc.docTypeLabel && (
                      <Text size="xs" c="dimmed">
                        Tipo: <b>{selectedDoc.docTypeLabel}</b>
                      </Text>
                    )}
                    {selectedDoc.versionNumber > 0 && (
                      <Text size="xs" c="dimmed">
                        Versão atual: Rev. {selectedDoc.versionNumber}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      Elaborador: {selectedDoc.elaborator || '—'} · Aprovador:{' '}
                      {selectedDoc.approver || '—'}
                    </Text>
                    {selectedDoc.publishedAt && (
                      <Text size="xs" c="dimmed">
                        Publicado em:{' '}
                        {formatDateTime(selectedDoc.publishedAt)}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={4} align="flex-end">
                    <RiskBadge risk={selectedDoc.riskLevel} size="xs" />
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="outline"
                        color="red"
                        onClick={handleArchive}
                        loading={archiving}
                      >
                        Retirar da biblioteca
                      </Button>
                      <Button
                        size="xs"
                        variant="light"
                        onClick={handleSendBackToReview}
                        loading={sendingBack}
                      >
                        Enviar para revisão
                      </Button>
                    </Group>
                  </Stack>
                </Group>

                <Stack gap={4} mt="sm">
                  <Text fw={500} size="sm">
                    Visualização do documento
                  </Text>

                  {previewUrl ? (
                    <div
                      style={{
                        border: '1px solid #e1e4e8',
                        borderRadius: 8,
                        overflow: 'hidden',
                        height: '55vh',
                      }}
                    >
                      <iframe
                        src={previewUrl}
                        title="Visualização do documento publicado"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                        }}
                      />
                    </div>
                  ) : (
                    <Center
                      style={{
                        border: '1px solid #e1e4e8',
                        borderRadius: 8,
                        height: '55vh',
                      }}
                    >
                      <Text size="sm" c="dimmed">
                        Nenhum arquivo disponível para visualização.
                      </Text>
                    </Center>
                  )}

                  <Text size="xs" c="dimmed">
                    A visualização utiliza o leitor do navegador ou o Office
                    Online. Use rolagem e zoom da própria área de preview.
                  </Text>
                </Stack>
              </Stack>
            ) : (
              <Center h="100%">
                <Text size="sm" c="dimmed">
                  Selecione um documento na lista ao lado.
                </Text>
              </Center>
            )}
          </Card>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
