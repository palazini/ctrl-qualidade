// src/pages/company/DocumentTypesPage.tsx
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
  ScrollArea,
  SimpleGrid,
  TextInput,
  Textarea,
  Switch,
  Loader,
  Center,
} from '@mantine/core';
import { IconPlus, IconRefresh, IconTrash } from '@tabler/icons-react';
import { supabase } from '../../lib/supabaseClient';
import { formatDateTime } from '../../utils/documents';

type DocTypeRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

export default function DocumentTypesPage() {
  const { company, currentRole, appUser } =
    useOutletContext<CompanyOutletContext>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [types, setTypes] = useState<DocTypeRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [search, setSearch] = useState('');

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const isQualityOrAdmin =
    currentRole === 'GESTOR_QUALIDADE' ||
    appUser.system_role === 'SITE_ADMIN';

  // Bloqueio extra
  if (!isQualityOrAdmin) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Stack gap="xs">
          <Text fw={500}>Tipos de Documento</Text>
          <Text size="sm" c="dimmed">
            Esta área é restrita à Qualidade ou ao Administrador do site.
          </Text>
        </Stack>
      </Card>
    );
  }

  async function loadTypes() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from('document_types')
      .select('id, name, code, description, is_active, created_at, updated_at')
      .eq('company_id', company.id)
      .order('name', { ascending: true });

    if (error) {
      console.error(error);
      setTypes([]);
      setError('Erro ao carregar tipos de documento.');
      setLoading(false);
      return;
    }

    setTypes((data ?? []) as DocTypeRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id]);

  function resetFormForNew() {
    setSelectedId(null);
    setName('');
    setCode('');
    setDescription('');
    setIsActive(true);
  }

  function fillFormFromType(t: DocTypeRow) {
    setSelectedId(t.id);
    setName(t.name);
    setCode(t.code ?? '');
    setDescription(t.description ?? '');
    setIsActive(t.is_active);
  }

  const selectedType = useMemo(
    () => types.find((t) => t.id === selectedId) ?? null,
    [types, selectedId]
  );

  const filteredTypes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return types;
    return types.filter((t) => {
      const haystack = `${t.name} ${t.code ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [types, search]);

  async function handleSave() {
    if (!name.trim()) {
      alert('Informe um nome para o tipo de documento.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        code: code.trim() ? code.trim().toUpperCase() : null,
        description: description.trim() || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (!selectedId) {
        // inserir novo
        const { data, error: insertError } = await supabase
          .from('document_types')
          .insert({
            company_id: company.id,
            created_by: appUser.id,
            ...payload,
          })
          .select('id')
          .single();

        if (insertError || !data) {
          console.error(insertError);
          throw new Error('Falha ao criar tipo de documento.');
        }

        const newId = data.id as string;
        await loadTypes();
        setSelectedId(newId);
      } else {
        // atualizar existente
        const { error: updateError } = await supabase
          .from('document_types')
          .update(payload)
          .eq('id', selectedId);

        if (updateError) {
          console.error(updateError);
          throw new Error('Falha ao atualizar tipo de documento.');
        }

        await loadTypes();
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao salvar tipo de documento.');
    } finally {
      setSaving(false);
    }
  }

  // "Excluir" = desativar (soft delete)
  async function handleDeactivate() {
    if (!selectedId) {
      alert('Selecione um tipo para desativar.');
      return;
    }

    const type = types.find((t) => t.id === selectedId);
    if (!type) return;

    if (!type.is_active) {
      alert('Este tipo já está inativo.');
      return;
    }

    const confirmed = window.confirm(
      'Ao desativar, este tipo não poderá ser usado em novas publicações, ' +
        'mas continuará visível em documentos antigos. Confirmar desativação?'
    );
    if (!confirmed) return;

    setDeactivating(true);

    try {
      const { error: updateError } = await supabase
        .from('document_types')
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedId);

      if (updateError) {
        console.error(updateError);
        throw new Error('Falha ao desativar tipo de documento.');
      }

      await loadTypes();
      // mantém o tipo selecionado, só que agora inativo
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao desativar tipo de documento.');
    } finally {
      setDeactivating(false);
    }
  }

  if (loading) {
    return (
      <Card withBorder shadow="sm" radius="md">
        <Center h={200}>
          <Loader size="lg" />
        </Center>
      </Card>
    );
  }

  return (
    <Card withBorder shadow="sm" radius="md">
      <Stack gap="sm" h="100%">
        <Group justify="space-between" align="center">
          <Stack gap={2}>
            <Text fw={500}>Tipos de Documento</Text>
            <Text size="xs" c="dimmed">
              Cadastre e mantenha os tipos usados ao publicar documentos
              (ex.: Procedimento, Instrução de Trabalho, Norma, Desenho).
            </Text>
          </Stack>
          <Group gap="xs">
            <Button
              size="xs"
              variant="subtle"
              leftSection={<IconRefresh size={14} />}
              onClick={loadTypes}
            >
              Atualizar
            </Button>
            <Badge variant="light" color="blue">
              {types.length} tipo(s)
            </Badge>
          </Group>
        </Group>

        {error && (
          <Text size="xs" c="red">
            {error}
          </Text>
        )}

        <SimpleGrid
          cols={{ base: 1, md: 2 }}
          spacing="md"
          style={{ alignItems: 'stretch' }}
        >
          {/* Lista de tipos */}
          <Card withBorder radius="md" shadow="xs">
            <Stack gap="sm" h="100%">
              <Group justify="space-between" mb={2}>
                <Text size="sm" fw={500}>
                  Tipos cadastrados
                </Text>
                <Button
                  size="xs"
                  leftSection={<IconPlus size={14} />}
                  variant="light"
                  onClick={resetFormForNew}
                >
                  Novo tipo
                </Button>
              </Group>

              <TextInput
                size="xs"
                label="Buscar"
                placeholder="Nome ou código..."
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
              />

              {types.length === 0 ? (
                <Center h="50vh">
                  <Text size="sm" c="dimmed">
                    Nenhum tipo cadastrado ainda.
                  </Text>
                </Center>
              ) : filteredTypes.length === 0 ? (
                <Center h="50vh">
                  <Text size="sm" c="dimmed">
                    Nenhum tipo encontrado para o filtro aplicado.
                  </Text>
                </Center>
              ) : (
                <ScrollArea h="55vh" type="always">
                  <Stack gap="xs" pr="xs">
                    {filteredTypes.map((t) => {
                      const isActiveRow = t.id === selectedId;
                      return (
                        <Card
                          key={t.id}
                          withBorder
                          radius="md"
                          shadow={isActiveRow ? 'sm' : 'xs'}
                          onClick={() => fillFormFromType(t)}
                          style={{
                            cursor: 'pointer',
                            borderColor: isActiveRow ? '#228be6' : undefined,
                            backgroundColor: isActiveRow
                              ? '#f5f9ff'
                              : undefined,
                          }}
                        >
                          <Stack gap={4}>
                            <Group justify="space-between" align="flex-start">
                              <Stack gap={0}>
                                <Text fw={500} size="sm">
                                  {t.name}
                                </Text>
                                {t.code && (
                                  <Text size="xs" c="dimmed">
                                    Código: {t.code}
                                  </Text>
                                )}
                              </Stack>
                              <Badge
                                size="xs"
                                color={t.is_active ? 'green' : 'gray'}
                                variant="light"
                              >
                                {t.is_active ? 'Ativo' : 'Inativo'}
                              </Badge>
                            </Group>
                            {t.description && (
                              <Text size="xs" c="dimmed" lineClamp={2}>
                                {t.description}
                              </Text>
                            )}
                          </Stack>
                        </Card>
                      );
                    })}
                  </Stack>
                </ScrollArea>
              )}
            </Stack>
          </Card>

          {/* Formulário de edição/criação */}
          <Card withBorder radius="md" shadow="xs">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Text size="sm" fw={500}>
                  {selectedId ? 'Editar tipo' : 'Novo tipo'}
                </Text>
                {selectedType && (
                  <Text size="xs" c="dimmed">
                    Criado em {formatDateTime(selectedType.created_at)}
                    {selectedType.updated_at &&
                      ` · Atualizado em ${formatDateTime(
                        selectedType.updated_at
                      )}`}
                  </Text>
                )}
              </Group>

              <TextInput
                label="Nome do tipo"
                placeholder="Ex.: Procedimento, Instrução de Trabalho, Norma..."
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                withAsterisk
              />

              <TextInput
                label="Código (opcional)"
                placeholder="Ex.: PROC, IT, NOR"
                value={code}
                onChange={(e) => setCode(e.currentTarget.value)}
                description="Utilizado para compor o código dos documentos (ex.: PROC-001)."
              />

              <Textarea
                label="Descrição (opcional)"
                placeholder="Ex.: Usado para documentos que descrevem o passo a passo das atividades..."
                minRows={3}
                value={description}
                onChange={(e) => setDescription(e.currentTarget.value)}
              />

              <Switch
                label="Tipo ativo"
                checked={isActive}
                onChange={(e) => setIsActive(e.currentTarget.checked)}
              />

              <Group justify="space-between" mt="sm">
                <Group gap="xs">
                  {selectedId && selectedType?.is_active && (
                    <Button
                      size="xs"
                      variant="outline"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      onClick={handleDeactivate}
                      loading={deactivating}
                    >
                      Desativar tipo
                    </Button>
                  )}
                </Group>

                <Group gap="xs">
                  <Button
                    variant="light"
                    size="xs"
                    onClick={resetFormForNew}
                  >
                    Limpar
                  </Button>
                  <Button
                    size="xs"
                    onClick={handleSave}
                    loading={saving}
                  >
                    Salvar tipo
                  </Button>
                </Group>
              </Group>

              <Text size="xs" c="dimmed">
                • Tipos inativos não aparecem para seleção na publicação de
                novos documentos, mas continuam visíveis em registros já
                existentes.
                <br />
                • Use esta tela para padronizar nomenclaturas e facilitar
                a busca na biblioteca.
              </Text>
            </Stack>
          </Card>
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
